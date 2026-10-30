import { NextRequest, NextResponse } from 'next/server'
import { prisma, serializePrisma } from '@/lib/prisma'
import { LEVEL_CODES, formatDormRequestRecord } from '@/lib/flow-utils'
import { sendDormEmail, buildDeniedEmailHtml } from '@/lib/email-templates'

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

    let currentStepIdx = existing.currentLvlCode
      ? LEVEL_CODES.indexOf(existing.currentLvlCode as any)
      : 0
    if (currentStepIdx < 0) currentStepIdx = 0

    const denierInfo = body.approver ||
      (Array.isArray(body.approval)
        ? body.approval.find((a: any) => a && a.reason) ||
          body.approval[currentStepIdx]
        : null) || {
        code: body.empno || '038146',
        empid: body.empno || '038146',
        name: body.name || 'Approver',
        dept: body.dept || '',
        email: body.email || '',
        reason: body.reason || 'Declined',
        date: new Date().toISOString().slice(0, 10),
      }

    const denyReason =
      body.reason || denierInfo.reason || 'Từ chối yêu cầu lưu trú'
    const lvlCode = LEVEL_CODES[currentStepIdx] || 'dept_manager'

    const logEntry = {
      levelIndex: currentStepIdx,
      lvl_code: lvlCode,
      lvlCode: lvlCode,
      code: denierInfo.code || denierInfo.empid || denierInfo.empno || '',
      empid: denierInfo.empid || denierInfo.code || denierInfo.empno || '',
      empno: denierInfo.empno || denierInfo.code || denierInfo.empid || '',
      name: denierInfo.name || denierInfo.username || '',
      username: denierInfo.username || denierInfo.name || '',
      dept: denierInfo.dept || '',
      email: denierInfo.email || '',
      ext: denierInfo.ext || '',
      date:
        denierInfo.date ||
        new Date().toISOString().replace('T', ' ').slice(0, 19),
      stt: 'deny',
      action: 'DENIED',
      reason: denyReason,
    }

    const existingLogIdx = currentLogs.findIndex(
      (l) => l && (l.lvl_code === lvlCode || l.levelIndex === currentStepIdx)
    )
    if (existingLogIdx >= 0) {
      currentLogs[existingLogIdx] = logEntry
    } else {
      currentLogs.push(logEntry)
    }

    const updated = await prisma.dormRequest.update({
      where: { id: requestId },
      data: {
        status: 'DENIED',
        currentLvlCode: lvlCode,
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

    // Notify GA / submitter if email available
    const gaEmails = (formatted.approval_flow[1]?.managers || [])
      .map((m) => m.email)
      .filter(Boolean)
    if (gaEmails.length > 0) {
      sendDormEmail({
        to: gaEmails.join(','),
        subject: `[DMA] Declined Dormitory Request #${formatted.id}`,
        htmlContent: buildDeniedEmailHtml(
          formatted,
          logEntry.name || logEntry.empno,
          denyReason
        ),
      }).catch(() => {})
    }

    return NextResponse.json(
      serializePrisma({
        status: 'success',
        data: formatted,
      })
    )
  } catch (error: any) {
    console.error('[POST /api/vgDorm/denyRequest] Error:', error)
    return NextResponse.json(
      { error: 'Failed to decline request', details: error?.message },
      { status: 500 }
    )
  }
}

