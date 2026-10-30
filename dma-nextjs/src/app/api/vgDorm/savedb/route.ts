import { NextRequest, NextResponse } from 'next/server'
import { prisma, serializePrisma } from '@/lib/prisma'
import {
  normalizeApprovalFlow,
  formatDormRequestRecord,
} from '@/lib/flow-utils'
import {
  sendDormEmail,
  buildPendingApprovalEmailHtml,
} from '@/lib/email-templates'

function parseDateOrNull(val: any): Date | null {
  if (!val) return null
  const s = String(val).trim().slice(0, 10)
  if (!s || s.startsWith('0000')) return null
  const d = new Date(`${s}T00:00:00.000Z`)
  return isNaN(d.getTime()) ? null : d
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()

    // Support both modern payload and legacy `{ db: {...} }` payload
    const payload = body.db ? body.db : body

    const submitter =
      typeof payload.submitter === 'string'
        ? JSON.parse(payload.submitter)
        : payload.submitter || {
            empno: payload.creator_empno || '038146',
            name: payload.creator_name || '',
            dept: payload.creator_dept || '',
            ext: payload.creator_phone || '',
          }

    const rawOccupants =
      typeof payload.name === 'string'
        ? JSON.parse(payload.name)
        : Array.isArray(payload.name)
          ? payload.name
          : Array.isArray(payload.personnel)
            ? payload.personnel
            : []

    const rawFlow = payload.app_flow || payload.approval_flow || []
    const flowSteps = normalizeApprovalFlow(rawFlow)

    const keyInDate =
      parseDateOrNull(payload.key_in || payload.key_in_date) || new Date()

    const createdRequest = await prisma.dormRequest.create({
      data: {
        keyInDate,
        creatorEmpno: String(submitter.empno || '').trim(),
        creatorName: String(submitter.name || submitter.username || '').trim(),
        creatorDept: String(submitter.dept || '').trim(),
        creatorPhone: String(submitter.ext || submitter.phone || '').trim(),
        reason: String(payload.reason || '').trim(),
        approvalFlow: flowSteps as any,
        status: 'PENDING',
        currentLvlCode: 'dept_manager',
        approvalLogs: [],
      },
    })

    if (rawOccupants.length > 0) {
      const personnelRows = rawOccupants
        .filter((occ: any) => occ && (occ.name || occ.full_name))
        .map((occ: any) => {
          const rawGender = String(occ.gender || 'M').toUpperCase().trim()
          const pgGender =
            rawGender === 'F' || rawGender === 'FEMALE' || rawGender === 'NỮ'
              ? 'Female'
              : 'Male'

          return {
            requestId: createdRequest.id,
            fullName: String(occ.name || occ.full_name || '').trim(),
            accomStatus: String(occ.status || occ.accom_status || 'VG').trim(),
            gender: pgGender,
            birthDay: parseDateOrNull(occ.birthDay || occ.birth_day),
            nationality: String(
              occ.nation || occ.nationality || 'VNM'
            ).trim(),
            startDate: parseDateOrNull(occ.startDate || occ.start_date),
            endDate: parseDateOrNull(occ.endDate || occ.end_date),
            documentType: String(
              occ.typeDoc || occ.document_type || 'Hộ chiếu'
            ).trim(),
            documentNumber: String(
              occ.numDoc || occ.document_number || ''
            ).trim(),
            notes: String(occ.note || occ.notes || '').trim(),
            roomNo: occ.room || occ.room_no ? String(occ.room || occ.room_no).trim() : null,
            qrCode: occ.qrCode || occ.qr_code ? String(occ.qrCode || occ.qr_code).trim() : null,
            residenceReason: String(
              occ.res_reason || occ.residence_reason || 'Làm việc'
            ).trim(),
            residenceType: String(
              occ.typeRes || occ.residence_type || 'Thường trú'
            ).trim(),
            provinceCity: occ.prov_city || occ.province_city ? String(occ.prov_city || occ.province_city) : null,
            wardCommune: occ.ward_com || occ.ward_commune ? String(occ.ward_com || occ.ward_commune) : null,
            detailedAddress: occ.detailAddr || occ.detailed_address ? String(occ.detailAddr || occ.detailed_address) : null,
          }
        })

      if (personnelRows.length > 0) {
        await prisma.dormPersonnel.createMany({ data: personnelRows })
      }
    }

    const fullRow = await prisma.dormRequest.findUnique({
      where: { id: createdRequest.id },
      include: { personnel: { orderBy: { id: 'asc' } } },
    })

    const formatted = formatDormRequestRecord({
      id: fullRow!.id,
      key_in_date: fullRow!.keyInDate,
      creator_empno: fullRow!.creatorEmpno,
      creator_name: fullRow!.creatorName,
      creator_dept: fullRow!.creatorDept,
      creator_phone: fullRow!.creatorPhone,
      reason: fullRow!.reason,
      approval_flow: fullRow!.approvalFlow,
      status: fullRow!.status,
      current_lvl_code: fullRow!.currentLvlCode,
      approval_logs: fullRow!.approvalLogs,
      created_at: fullRow!.createdAt,
      updated_at: fullRow!.updatedAt,
      personnel: fullRow!.personnel.map((p) => ({
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

    // Notify Step 1 (dept_manager) approvers asynchronously
    const step0 = formatted.approval_flow[0]
    if (step0) {
      const emails = [
        ...(step0.managers || []).map((m) => m.email),
        ...(step0.deputies || []).filter((d) => d.status !== false).map((d) => d.email),
      ].filter(Boolean)

      if (emails.length > 0) {
        sendDormEmail({
          to: emails.join(','),
          subject: `[DMA] Dormitory Request #${formatted.id} Pending Approval (${formatted.creator_name})`,
          htmlContent: buildPendingApprovalEmailHtml(formatted),
        }).catch(() => {})
      }
    }

    return NextResponse.json(
      serializePrisma({
        status: 'success',
        id: Number(createdRequest.id),
        data: formatted,
      })
    )
  } catch (error: any) {
    console.error('[POST /api/vgDorm/savedb] Error:', error)
    return NextResponse.json(
      { error: 'Failed to create dormitory request', details: error?.message },
      { status: 500 }
    )
  }
}

