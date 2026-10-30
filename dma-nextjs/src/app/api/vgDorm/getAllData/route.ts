import { NextResponse } from 'next/server'
import { prisma, serializePrisma } from '@/lib/prisma'
import { formatDormRequestRecord } from '@/lib/flow-utils'

export const dynamic = 'force-dynamic'

export async function GET() {
  try {
    const rows = await prisma.dormRequest.findMany({
      include: {
        personnel: {
          orderBy: { id: 'asc' },
        },
      },
      orderBy: { id: 'desc' },
    })

    const formatted = rows.map((row) =>
      formatDormRequestRecord({
        id: row.id,
        key_in_date: row.keyInDate,
        creator_empno: row.creatorEmpno,
        creator_name: row.creatorName,
        creator_dept: row.creatorDept,
        creator_phone: row.creatorPhone,
        reason: row.reason,
        approval_flow: row.approvalFlow,
        status: row.status,
        current_lvl_code: row.currentLvlCode,
        approval_logs: row.approvalLogs,
        created_at: row.createdAt,
        updated_at: row.updatedAt,
        personnel: row.personnel.map((p) => ({
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
          created_at: p.createdAt,
        })),
      })
    )

    return NextResponse.json(serializePrisma(formatted))
  } catch (error: any) {
    console.error('[GET /api/vgDorm/getAllData] Error:', error)
    return NextResponse.json(
      { error: 'Failed to load dormitory requests', details: error?.message },
      { status: 500 }
    )
  }
}

