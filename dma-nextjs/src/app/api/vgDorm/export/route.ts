import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { formatDormRequestRecord, OccupantRecord } from '@/lib/flow-utils'
import {
  generateAccommodationBookExcel,
  generateVNImportExcel,
  generateForeignImportExcel,
  generateVisaXml,
  MasterLookups,
} from '@/lib/excel-generator'

export const dynamic = 'force-dynamic'

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

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url)
    const type = searchParams.get('type') || 'accom_book'
    const requestIdParam = searchParams.get('requestId')
    const statusFilter = searchParams.get('status') || 'ALL'
    const startFrom = searchParams.get('startFrom') || ''
    const startTo = searchParams.get('startTo') || ''
    const isPreview = searchParams.get('preview') === 'true'

    const whereClause: any = {}
    if (requestIdParam && requestIdParam !== 'all') {
      whereClause.id = BigInt(requestIdParam)
    } else if (statusFilter && statusFilter !== 'ALL') {
      whereClause.status = statusFilter
    }

    const rows = await prisma.dormRequest.findMany({
      where: whereClause,
      include: { personnel: { orderBy: { id: 'asc' } } },
      orderBy: { id: 'desc' },
    })

    let occupants: OccupantRecord[] = []
    for (const row of rows) {
      const formatted = formatDormRequestRecord({
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
        })),
      })
      occupants.push(...formatted.personnel)
    }

    if (startFrom) {
      occupants = occupants.filter((o) => !o.startDate || o.startDate >= startFrom)
    }
    if (startTo) {
      occupants = occupants.filter((o) => !o.startDate || o.startDate <= startTo)
    }

    const lookups = await loadMasterLookups()
    const suffix = requestIdParam ? `_Req_${requestIdParam}` : `_${new Date().toISOString().slice(0, 10)}`

    // Preview mode: Return JSON with formatted columns and rows or raw XML
    if (isPreview) {
      if (type === 'visa_xml') {
        const foreignOccupants = occupants.filter(
          (o) => (o.nation || o.nationality || '').toUpperCase() !== 'VNM'
        )
        const xmlStr = generateVisaXml(occupants)
        return NextResponse.json({
          type: 'xml',
          title: 'File XML Khai Báo Tạm Trú Người Nước Ngoài',
          filename: `visa_info${suffix}.xml`,
          totalCount: foreignOccupants.length,
          xmlContent: xmlStr,
        })
      }

      if (type === 'vn_import') {
        const vnOccupants = occupants.filter(
          (o) => (o.nation || o.nationality || '').toUpperCase() === 'VNM'
        )
        const headers = [
          'STT',
          'Họ và tên',
          'Ngày sinh',
          'Giới tính',
          'Số ĐDCN/CMND',
          'SĐT',
          'Số hộ chiếu',
          'Quốc gia',
          'Loại cư trú',
          'Tỉnh thành',
          'Phường xã',
          'Địa chỉ chi tiết',
          'Lý do lưu trú',
          'Từ ngày',
          'Đến ngày',
          'Loại giấy tờ',
          'Số giấy tờ',
          'Tên phòng',
        ]
        const rows = vnOccupants.map((occ, idx) => {
          const docTypeName = lookups.docTypes.find(
            (d) =>
              String(d.id) === String(occ.typeDoc || occ.document_type || '') ||
              d.type?.vi === (occ.typeDoc || occ.document_type)
          )?.type?.vi || (occ.typeDoc || occ.document_type || 'CCCD')
          const docNum = occ.numDoc || occ.document_number || ''
          const isPassport = docTypeName.toLowerCase().includes('hộ chiếu')
          const provName = lookups.provinces.find(
            (p) => String(p.code) === String(occ.prov_city) || p.name === occ.prov_city
          )?.name || occ.prov_city || ''
          const wardName = lookups.wards.find(
            (w) => String(w.code) === String(occ.ward_com) || w.name === occ.ward_com
          )?.name || occ.ward_com || ''
          const resType = lookups.resTypes.find(
            (r) => String(r.id) === String(occ.typeRes || occ.residence_type || '')
          )?.name?.vi || 'Tạm trú'
          const resReason = lookups.resReasons.find(
            (r) => String(r.id) === String(occ.res_reason || occ.residence_reason || '')
          )?.res_reason?.vi || ''

          return [
            idx + 1,
            occ.name || occ.full_name || '',
            occ.birthDay || occ.birth_day || '',
            occ.gender === 'F' ? 'Nữ' : 'Nam',
            isPassport ? '' : docNum,
            '',
            isPassport ? docNum : '',
            'Việt Nam',
            resType,
            provName,
            wardName,
            occ.detailAddr || occ.detailed_address || '',
            resReason,
            occ.startDate || occ.start_date || '',
            occ.endDate || occ.end_date || '',
            docTypeName,
            docNum,
            occ.room || occ.room_no || '',
          ]
        })
        return NextResponse.json({
          type: 'table',
          title: 'Mẫu Nhập Liệu Lưu Trú Công Dân Việt Nam (tblt_vn_import.xlsx)',
          filename: `tblt_vn_import${suffix}.xlsx`,
          totalCount: vnOccupants.length,
          headers,
          rows,
        })
      }

      if (type === 'foreign_import') {
        const foreignOccupants = occupants.filter(
          (o) => (o.nation || o.nationality || '').toUpperCase() !== 'VNM'
        )
        const headers = [
          'STT',
          'Họ và tên',
          'Ngày sinh',
          'Giới tính',
          'Quốc tịch',
          'Số hộ chiếu',
          'Số phòng',
          'Loại giấy tờ',
          'Lý do lưu trú',
          'Từ ngày',
          'Đến ngày',
        ]
        const rows = foreignOccupants.map((occ, idx) => {
          const docTypeName = lookups.docTypes.find(
            (d) =>
              String(d.id) === String(occ.typeDoc || occ.document_type || '') ||
              d.type?.vi === (occ.typeDoc || occ.document_type)
          )?.type?.vi || (occ.typeDoc || occ.document_type || 'Hộ chiếu')
          const resReason = lookups.resReasons.find(
            (r) => String(r.id) === String(occ.res_reason || occ.residence_reason || '')
          )?.res_reason?.vi || 'Làm việc'
          const nationName = lookups.nations.find(
            (n) => n.code.toUpperCase() === (occ.nation || occ.nationality || '').toUpperCase()
          )?.nation?.vi || (occ.nation || occ.nationality || '')

          return [
            idx + 1,
            occ.name || occ.full_name || '',
            occ.birthDay || occ.birth_day || '',
            occ.gender === 'F' ? 'Nữ' : 'Nam',
            nationName,
            occ.numDoc || occ.document_number || '',
            occ.room || occ.room_no || 'A',
            docTypeName,
            resReason,
            occ.startDate || occ.start_date || '',
            occ.endDate || occ.end_date || '',
          ]
        })
        return NextResponse.json({
          type: 'table',
          title: 'Mẫu Nhập Liệu Khách Nước Ngoài (Danh_Sach_Mau_Excel.xlsx)',
          filename: `Danh_Sach_Mau_Excel${suffix}.xlsx`,
          totalCount: foreignOccupants.length,
          headers,
          rows,
        })
      }

      // Default: accom_book preview
      const headers = [
        'STT',
        'Họ chữ đệm và tên',
        'Ngày sinh',
        'Giới tính',
        'Số ĐDCN / Hộ chiếu',
        'Địa chỉ cư trú',
        'Nơi làm việc',
        'Quốc tịch',
        'Ngày đến',
        'Phòng',
        'Ngày rời đi dự kiến',
      ]
      const rows = occupants.map((occ, idx) => {
        const isVN = (occ.nation || occ.nationality || '').toUpperCase() === 'VNM'
        const provName = lookups.provinces.find(
          (p) => String(p.code) === String(occ.prov_city) || p.name === occ.prov_city
        )?.name || occ.prov_city || ''
        const wardName = lookups.wards.find(
          (w) => String(w.code) === String(occ.ward_com) || w.name === occ.ward_com
        )?.name || occ.ward_com || ''
        const nationName = lookups.nations.find(
          (n) => n.code.toUpperCase() === (occ.nation || occ.nationality || '').toUpperCase()
        )?.nation?.vi || (occ.nation || occ.nationality || '')
        const fullAddr = isVN
          ? [occ.detailAddr || occ.detailed_address, wardName, provName].filter(Boolean).join(', ')
          : nationName

        return [
          idx + 1,
          occ.name || occ.full_name || '',
          occ.birthDay || occ.birth_day || '',
          occ.gender === 'F' ? 'Nữ' : 'Nam',
          occ.numDoc || occ.document_number || '',
          fullAddr,
          'Công ty TNHH Giày Cần Sports Việt Nam',
          nationName,
          occ.startDate || occ.start_date || '',
          occ.room || occ.room_no || '',
          occ.endDate || occ.end_date || '',
        ]
      })

      return NextResponse.json({
        type: 'table',
        title: 'Sổ Tiếp Nhận Lưu Trú (Bảng Kê Tổng Hợp)',
        filename: `So_Tiep_Nhan_Luu_Tru${suffix}.xlsx`,
        totalCount: occupants.length,
        headers,
        rows,
      })
    }

    if (type === 'visa_xml') {
      const xmlStr = generateVisaXml(occupants)
      return new NextResponse(xmlStr, {
        headers: {
          'Content-Type': 'application/xml; charset=utf-8',
          'Content-Disposition': `attachment; filename="visa_info${suffix}.xml"`,
        },
      })
    }

    if (type === 'vn_import') {
      const buf = await generateVNImportExcel(occupants, lookups)
      return new NextResponse(new Uint8Array(buf), {
        headers: {
          'Content-Type':
            'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
          'Content-Disposition': `attachment; filename="tblt_vn_import${suffix}.xlsx"`,
        },
      })
    }

    if (type === 'foreign_import') {
      const buf = await generateForeignImportExcel(occupants, lookups)
      return new NextResponse(new Uint8Array(buf), {
        headers: {
          'Content-Type':
            'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
          'Content-Disposition': `attachment; filename="Danh_Sach_Mau_Excel${suffix}.xlsx"`,
        },
      })
    }

    // Default: Sổ tiếp nhận lưu trú (accom_book)
    const buf = await generateAccommodationBookExcel(occupants, lookups)
    return new NextResponse(new Uint8Array(buf), {
      headers: {
        'Content-Type':
          'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'Content-Disposition': `attachment; filename="So_Tiep_Nhan_Luu_Tru${suffix}.xlsx"`,
      },
    })
  } catch (error: any) {
    console.error('[GET /api/vgDorm/export] Error:', error)
    return NextResponse.json(
      { error: 'Export failed', details: error?.message },
      { status: 500 }
    )
  }
}
