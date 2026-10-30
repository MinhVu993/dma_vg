import { NextRequest, NextResponse } from 'next/server'
import { prisma, serializePrisma } from '@/lib/prisma'
import {
  LEVEL_CODES,
  formatDormRequestRecord,
} from '@/lib/flow-utils'
import {
  sendDormEmail,
  buildPendingApprovalEmailHtml,
  buildCompletedEmailHtml,
} from '@/lib/email-templates'
import {
  generateAccommodationBookExcel,
  generateVNImportExcel,
  generateForeignImportExcel,
  generateVisaXml,
  MasterLookups,
} from '@/lib/excel-generator'

async function loadMasterLookups(): Promise<MasterLookups> {
  const [nations, provinces, wards, docTypes, resReasons, resTypes] =
    await Promise.all([
      prisma.nationSub.findMany(),
      prisma.province.findMany(),
      prisma.ward.findMany(),
      prisma.documentType.findMany(),
      prisma.resReason.findMany(),
      prisma.residenceType.findMany(),
    ])

  return {
    nations: nations.map((n) => ({
      code: n.code || '',
      nation: (n.nation as any) || {},
    })),
    provinces: provinces.map((p) => ({
      code: p.code || '',
      name: p.name || '',
    })),
    wards: wards.map((w) => ({
      code: w.code || '',
      name: w.name || '',
      province_code: w.provinceCode || '',
    })),
    docTypes: docTypes.map((d) => ({
      id: Number(d.id),
      type:
        typeof d.name === 'string' && d.name.startsWith('{')
          ? JSON.parse(d.name)
          : { vi: d.name, en: d.name, cn: d.name },
    })),
    resReasons: resReasons.map((r) => ({
      id: Number(r.id),
      res_reason:
        typeof r.resReason === 'string' && r.resReason.startsWith('{')
          ? JSON.parse(r.resReason)
          : { vi: r.resReason, en: r.resReason, cn: r.resReason },
    })),
    resTypes: resTypes.map((t) => ({
      id: Number(t.id),
      name:
        typeof t.name === 'string' && t.name.startsWith('{')
          ? JSON.parse(t.name)
          : { vi: t.name, en: t.name, cn: t.name },
    })),
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const requestId = BigInt(body.id)

    const existing = await prisma.dormRequest.findUnique({
      where: { id: requestId },
      include: { personnel: { orderBy: { id: 'asc' } } },
    })

    if (!existing) {
      return NextResponse.json(
        { error: 'Request not found' },
        { status: 404 }
      )
    }

    const currentLogs: any[] = Array.isArray(existing.approvalLogs)
      ? [...(existing.approvalLogs as any[])]
      : []

    // Determine which step is being approved
    let currentStepIdx = existing.currentLvlCode
      ? LEVEL_CODES.indexOf(existing.currentLvlCode as any)
      : 0
    if (currentStepIdx < 0) currentStepIdx = 0

    // If caller passed a 4-item `status` array and `approval` array (legacy format), honour it
    const approverInfo = body.approver ||
      (Array.isArray(body.approval) ? body.approval[currentStepIdx] : null) || {
        code: body.empno || '038146',
        empid: body.empno || '038146',
        name: body.name || 'Approver',
        dept: body.dept || '',
        email: body.email || '',
        date: new Date().toISOString().slice(0, 10),
      }

    const lvlCode = LEVEL_CODES[currentStepIdx] || 'dept_manager'
    const logEntry = {
      levelIndex: currentStepIdx,
      lvl_code: lvlCode,
      lvlCode: lvlCode,
      code: approverInfo.code || approverInfo.empid || approverInfo.empno || '',
      empid: approverInfo.empid || approverInfo.code || approverInfo.empno || '',
      empno: approverInfo.empno || approverInfo.code || approverInfo.empid || '',
      name: approverInfo.name || approverInfo.username || '',
      username: approverInfo.username || approverInfo.name || '',
      dept: approverInfo.dept || '',
      email: approverInfo.email || '',
      ext: approverInfo.ext || '',
      date:
        approverInfo.date ||
        new Date().toISOString().replace('T', ' ').slice(0, 19),
      stt: 'accept',
      action: 'APPROVED',
      reason: approverInfo.reason || '',
    }

    // Replace or append log for this step
    const existingLogIdx = currentLogs.findIndex(
      (l) => l && (l.lvl_code === lvlCode || l.levelIndex === currentStepIdx)
    )
    if (existingLogIdx >= 0) {
      currentLogs[existingLogIdx] = logEntry
    } else {
      currentLogs.push(logEntry)
    }

    const isFinalStep = currentStepIdx >= 3
    const nextStatus = isFinalStep ? 'COMPLETED' : 'PENDING'
    const nextLvlCode = isFinalStep
      ? null
      : LEVEL_CODES[currentStepIdx + 1] || null

    const updated = await prisma.dormRequest.update({
      where: { id: requestId },
      data: {
        status: nextStatus,
        currentLvlCode: nextLvlCode,
        approvalLogs: currentLogs as any,
        updatedAt: new Date(),
      },
      include: { personnel: { orderBy: { id: 'asc' } } },
    })

    const formatted = formatDormRequestRecord({
      id: updated.id,
      key_in_date: updated.keyInDate,
      creator_empno: updated.creatorEmpno,
      creator_name: updated.creatorName,
      creator_dept: updated.creatorDept,
      creator_phone: updated.creatorPhone,
      reason: updated.reason,
      approval_flow: updated.approvalFlow,
      status: updated.status,
      current_lvl_code: updated.currentLvlCode,
      approval_logs: updated.approvalLogs,
      created_at: updated.createdAt,
      updated_at: updated.updatedAt,
      personnel: updated.personnel.map((p) => ({
        id: p.id,
        request_id: p.requestId,
        full_name: p.fullName,
        accom_status: p.accomStatus,
        gender: p.gender,
        birth_day: p.birthDay,
        nationality: p.nationality,
        start_date: p.startDate,
        end_date: p.endDate,
        document_type: p.documentType,
        document_number: p.documentNumber,
        notes: p.notes,
        room_no: p.roomNo,
        qr_code: p.qrCode,
        residence_reason: p.residenceReason,
        residence_type: p.residenceType,
        province_city: p.provinceCity,
        ward_commune: p.wardCommune,
        detailed_address: p.detailedAddress,
      })),
    })

    // Trigger asynchronous email notification
    ;(async () => {
      try {
        if (!isFinalStep) {
          const nextStep = formatted.approval_flow[currentStepIdx + 1]
          if (nextStep) {
            const emails = [
              ...(nextStep.managers || []).map((m) => m.email),
              ...(nextStep.deputies || [])
                .filter((d) => d.status !== false)
                .map((d) => d.email),
            ].filter(Boolean)

            if (emails.length > 0) {
              await sendDormEmail({
                to: emails.join(','),
                subject: `[DMA] Dormitory Request #${formatted.id} Pending Level ${currentStepIdx + 2} Approval`,
                htmlContent: buildPendingApprovalEmailHtml(formatted),
              })
            }
          }
        } else {
          // Final step completed: generate Excel/XML attachments
          const lookups = await loadMasterLookups()
          const accomBuffer = await generateAccommodationBookExcel(
            formatted.personnel,
            lookups
          )
          const attachments: {
            filename: string
            content: Buffer
            contentType: string
          }[] = [
            {
              filename: `So_Tiep_Nhan_Luu_Tru_Req_${formatted.id}.xlsx`,
              content: accomBuffer,
              contentType:
                'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
            },
          ]

          const hasVN = formatted.personnel.some(
            (p) => (p.nation || '').toUpperCase() === 'VNM'
          )
          const hasForeign = formatted.personnel.some(
            (p) => (p.nation || '').toUpperCase() !== 'VNM'
          )

          if (hasVN) {
            const vnBuf = await generateVNImportExcel(
              formatted.personnel,
              lookups
            )
            attachments.push({
              filename: `tblt_vn_import_Req_${formatted.id}.xlsx`,
              content: vnBuf,
              contentType:
                'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
            })
          }

          if (hasForeign) {
            const foreignBuf = await generateForeignImportExcel(
              formatted.personnel,
              lookups
            )
            const xmlStr = generateVisaXml(formatted.personnel)
            attachments.push(
              {
                filename: `Danh_Sach_Mau_Excel_Req_${formatted.id}.xlsx`,
                content: foreignBuf,
                contentType:
                  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
              },
              {
                filename: `visa_info_Req_${formatted.id}.xml`,
                content: Buffer.from(xmlStr, 'utf-8'),
                contentType: 'application/xml',
              }
            )
          }

          const gaStep = formatted.approval_flow[1]
          const recipients = [
            ...(gaStep?.managers || []).map((m) => m.email),
            ...(gaStep?.deputies || []).map((d) => d.email),
          ].filter(Boolean)

          if (recipients.length > 0) {
            await sendDormEmail({
              to: recipients.join(','),
              subject: `[DMA] Approved Dormitory Request #${formatted.id} - Declaration Files Attached`,
              htmlContent: buildCompletedEmailHtml(formatted),
              attachments,
            })
          }
        }
      } catch (e) {
        console.warn('[acceptRequest email notification] non-fatal error:', e)
      }
    })()

    return NextResponse.json(
      serializePrisma({
        status: 'success',
        data: formatted,
      })
    )
  } catch (error: any) {
    console.error('[POST /api/vgDorm/acceptRequest] Error:', error)
    return NextResponse.json(
      { error: 'Failed to approve request', details: error?.message },
      { status: 500 }
    )
  }
}
