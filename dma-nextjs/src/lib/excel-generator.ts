import ExcelJS from 'exceljs'
import path from 'path'
import fs from 'fs'
import { OccupantRecord } from './flow-utils'

export interface NationMapItem {
  code: string
  nation: {
    cn?: string
    en?: string
    vi?: string
  }
}

export interface ProvinceMapItem {
  code: string
  name: string
}

export interface WardMapItem {
  code: string
  name: string
  province_code: string
}

export interface DocTypeMapItem {
  id: number
  type: {
    cn?: string
    en?: string
    vi?: string
  }
}

export interface ResReasonMapItem {
  id: number
  res_reason: {
    cn?: string
    en?: string
    vi?: string
  }
}

export interface ResTypeMapItem {
  id: number
  name: {
    cn?: string
    en?: string
    vi?: string
  }
}

export interface MasterLookups {
  nations: NationMapItem[]
  provinces: ProvinceMapItem[]
  wards: WardMapItem[]
  docTypes: DocTypeMapItem[]
  resReasons: ResReasonMapItem[]
  resTypes: ResTypeMapItem[]
}

export function formatDMY(dateStr: string | undefined | null): string {
  if (!dateStr) return ''
  const clean = dateStr.slice(0, 10)
  const parts = clean.split('-')
  if (parts.length === 3) {
    return `${parts[2]}/${parts[1]}/${parts[0]}`
  }
  return clean
}

export function getViNation(code: string, lookups: MasterLookups): string {
  if (!code) return ''
  const found = lookups.nations.find(
    (n) => n.code.toUpperCase() === code.toUpperCase()
  )
  return found?.nation?.vi || code
}

export function getViDocType(val: string, lookups: MasterLookups): string {
  if (!val) return 'Hộ chiếu'
  const found = lookups.docTypes.find(
    (d) =>
      String(d.id) === String(val) ||
      d.type?.vi === val ||
      d.type?.en === val ||
      d.type?.cn === val
  )
  return found?.type?.vi || val
}

export function getViResReason(val: string, lookups: MasterLookups): string {
  if (!val) return 'Làm việc'
  const found = lookups.resReasons.find(
    (r) =>
      String(r.id) === String(val) ||
      r.res_reason?.vi === val ||
      r.res_reason?.en === val ||
      r.res_reason?.cn === val
  )
  return found?.res_reason?.vi || val
}

export function getViResType(val: string, lookups: MasterLookups): string {
  if (!val) return 'Thường trú'
  const found = lookups.resTypes.find(
    (r) =>
      String(r.id) === String(val) ||
      r.name?.vi === val ||
      r.name?.en === val ||
      r.name?.cn === val
  )
  return found?.name?.vi || val
}

export function getProvinceName(code: string, lookups: MasterLookups): string {
  if (!code) return ''
  const found = lookups.provinces.find(
    (p) => String(p.code) === String(code) || p.name === code
  )
  return found?.name || code
}

export function getWardName(
  code: string,
  provCode: string,
  lookups: MasterLookups
): string {
  if (!code) return ''
  const found = lookups.wards.find(
    (w) =>
      (String(w.code) === String(code) || w.name === code) &&
      (!provCode || String(w.province_code) === String(provCode))
  )
  if (found) return found.name
  const fallback = lookups.wards.find(
    (w) => String(w.code) === String(code) || w.name === code
  )
  return fallback?.name || code
}

/**
 * 1. Generate Sổ Tiếp Nhận Lưu Trú (Accommodation Registration Book) Excel buffer
 */
export async function generateAccommodationBookExcel(
  occupants: OccupantRecord[],
  lookups: MasterLookups
): Promise<Buffer> {
  const wb = new ExcelJS.Workbook()
  const ws = wb.addWorksheet('Sổ tiếp nhận lưu trú')

  ws.views = [{ showGridLines: true }]
  ws.getColumn('A').width = 8
  ws.getColumn('B').width = 28
  ws.getColumn('C').width = 16
  ws.getColumn('D').width = 14
  ws.getColumn('E').width = 20
  ws.getColumn('F').width = 36
  ws.getColumn('G').width = 20
  ws.getColumn('H').width = 22
  ws.getColumn('I').width = 18
  ws.getColumn('J').width = 16
  ws.getColumn('K').width = 16

  // Header Title
  ws.mergeCells('B2:J2')
  const titleCell = ws.getCell('B2')
  titleCell.value = 'BẢNG KÊ THÔNG TIN NGƯỜI LƯU TRÚ'
  titleCell.font = { name: 'Times New Roman', size: 15, bold: true }
  titleCell.alignment = { horizontal: 'center', vertical: 'middle' }

  // Table Headers (Rows 4 & 5)
  ws.mergeCells('A4:A5')
  ws.getCell('A4').value = 'Số TT'

  ws.mergeCells('B4:B5')
  ws.getCell('B4').value = 'Họ chữ đệm và tên'

  ws.mergeCells('C4:C5')
  ws.getCell('C4').value = 'Ngày, tháng, năm sinh'

  ws.mergeCells('D4:D5')
  ws.getCell('D4').value = 'Giới tính'

  ws.mergeCells('E4:E5')
  ws.getCell('E4').value =
    'Số định danh cá nhân/CMND hoặc số hộ chiếu, giấy tờ có giá trị đi lại quốc tế'

  ws.mergeCells('F4:F5')
  ws.getCell('F4').value =
    'Địa chỉ cư trú\n(nơi thường trú hoặc nơi tạm trú; trường hợp không có nơi thường trú, nơi tạm trú thì ghi nơi ở hiện tại)'

  ws.mergeCells('G4:G5')
  ws.getCell('G4').value = 'Nghề nghiệp, nơi làm việc'

  ws.mergeCells('H4:H5')
  ws.getCell('H4').value = 'Quốc tịch, dân tộc'

  ws.mergeCells('I4:K4')
  ws.getCell('I4').value = 'Thông tin lưu trú'
  ws.getCell('I5').value = 'Thời gian đến lưu trú\n(giờ, phút, ngày, tháng, năm)'
  ws.getCell('J5').value = 'Phòng'
  ws.getCell('K5').value = 'Thời gian dự kiến rời đi\n(nếu có)'

  const borderStyle: Partial<ExcelJS.Borders> = {
    top: { style: 'thin' },
    left: { style: 'thin' },
    bottom: { style: 'thin' },
    right: { style: 'thin' },
  }

  for (let r = 4; r <= 5; r++) {
    ws.getRow(r).height = r === 5 ? 38 : 28
    for (let c = 1; c <= 11; c++) {
      const cell = ws.getCell(r, c)
      cell.font = { name: 'Times New Roman', size: 11, bold: true }
      cell.alignment = {
        horizontal: 'center',
        vertical: 'middle',
        wrapText: true,
      }
      cell.border = borderStyle
      cell.fill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: 'FFF2F4F8' },
      }
    }
  }

  occupants.forEach((occ, idx) => {
    const rowIdx = 6 + idx
    const row = ws.getRow(rowIdx)
    row.height = 24

    const isVN = (occ.nation || '').toUpperCase() === 'VNM'
    const provName = getProvinceName(occ.prov_city, lookups)
    const wardName = getWardName(occ.ward_com, occ.prov_city, lookups)
    const fullAddr = isVN
      ? [occ.detailAddr, wardName, provName].filter(Boolean).join(', ')
      : getViNation(occ.nation, lookups)

    row.getCell(1).value = idx + 1
    row.getCell(2).value = occ.name || occ.full_name || ''
    row.getCell(3).value = formatDMY(occ.birthDay || occ.birth_day)
    row.getCell(4).value = occ.gender === 'F' ? 'Nữ' : 'Nam'
    row.getCell(5).value = occ.numDoc || occ.document_number || ''
    row.getCell(6).value = fullAddr
    row.getCell(7).value = 'Công ty TNHH Giày Cần Sports Việt Nam'
    row.getCell(8).value = getViNation(occ.nation || occ.nationality || '', lookups)
    row.getCell(9).value = formatDMY(occ.startDate || occ.start_date)
    row.getCell(10).value = occ.room || occ.room_no || ''
    row.getCell(11).value = formatDMY(occ.endDate || occ.end_date)

    for (let c = 1; c <= 11; c++) {
      const cell = row.getCell(c)
      cell.font = { name: 'Times New Roman', size: 11 }
      cell.alignment = {
        horizontal: c === 2 || c === 6 || c === 7 ? 'left' : 'center',
        vertical: 'middle',
        wrapText: true,
      }
      cell.border = borderStyle
    }
  })

  const arrayBuffer = await wb.xlsx.writeBuffer()
  return Buffer.from(arrayBuffer)
}

/**
 * 2. Generate Vietnamese Occupants Import Excel (`tblt_vn_import.xlsx`)
 */
export async function generateVNImportExcel(
  occupants: OccupantRecord[],
  lookups: MasterLookups
): Promise<Buffer> {
  const vnOccupants = occupants.filter(
    (o) => (o.nation || o.nationality || '').toUpperCase() === 'VNM'
  )

  const wb = new ExcelJS.Workbook()
  const templatePath = path.join(
    process.cwd(),
    'public',
    'templates',
    'tblt_vn_import.xlsx'
  )

  if (fs.existsSync(templatePath)) {
    await wb.xlsx.readFile(templatePath)
  } else {
    const ws = wb.addWorksheet('Sheet1')
    ws.addRow([
      'STT',
      'Họ và tên (*)',
      'Ngày tháng năm sinh (*)',
      'Giới tính (*)',
      'Số ĐDCN/CMND (*)',
      'Số điện thoại',
      'Số hộ chiếu',
      'Quốc gia (*)',
      'Loại cư trú (*)',
      'Tỉnh thành (*)',
      'Quận huyện',
      'Phường xã (*)',
      'Địa chỉ chi tiết (*)',
      'Lý do lưu trú',
      'Thời gian lưu trú (Từ ngày) (*)',
      'Thời gian lưu trú (Đến ngày) (*)',
      'Loại giấy tờ sử dụng (*)',
      'Tên giấy tờ (*)',
      'Số giấy tờ (*)',
      'Tên phòng (*)',
    ])
  }

  const ws = wb.worksheets[0] || wb.addWorksheet('Sheet1')

  // Clear existing sample data below row 1
  if (ws.rowCount > 1) {
    ws.spliceRows(2, ws.rowCount - 1)
  }

  vnOccupants.forEach((occ, idx) => {
    const rowIdx = 2 + idx
    const row = ws.getRow(rowIdx)
    const docTypeName = getViDocType(occ.typeDoc || occ.document_type || '', lookups)
    const docNum = occ.numDoc || occ.document_number || ''
    const isPassport = docTypeName.toLowerCase().includes('hộ chiếu')

    row.getCell(1).value = idx + 1 // A: STT
    row.getCell(2).value = occ.name || occ.full_name || '' // B: Họ và tên
    row.getCell(3).value = formatDMY(occ.birthDay || occ.birth_day) // C: Ngày sinh
    row.getCell(4).value = occ.gender === 'F' ? 'Nữ' : 'Nam' // D: Giới tính
    row.getCell(5).value = isPassport ? '' : docNum // E: Số ĐDCN/CMND
    row.getCell(6).value = '' // F: SĐT
    row.getCell(7).value = isPassport ? docNum : '' // G: Số hộ chiếu
    row.getCell(8).value = 'Cộng hòa xã hội chủ nghĩa Việt Nam' // H: Quốc gia
    row.getCell(9).value = getViResType(occ.typeRes || occ.residence_type || '', lookups) // I: Loại cư trú
    row.getCell(10).value = getProvinceName(occ.prov_city || occ.province_city || '', lookups) // J: Tỉnh thành
    row.getCell(11).value = '' // K: Quận huyện
    row.getCell(12).value = getWardName(
      occ.ward_com || occ.ward_commune || '',
      occ.prov_city || occ.province_city || '',
      lookups
    ) // L: Phường xã
    row.getCell(13).value = occ.detailAddr || occ.detailed_address || '' // M: Địa chỉ chi tiết
    row.getCell(14).value = getViResReason(
      occ.res_reason || occ.residence_reason || '',
      lookups
    ) // N: Lý do lưu trú
    row.getCell(15).value = `${formatDMY(occ.startDate || occ.start_date)} 11:30:00` // O: Từ ngày
    row.getCell(16).value = `${formatDMY(occ.endDate || occ.end_date)} 23:00:00` // P: Đến ngày
    row.getCell(17).value = docTypeName // Q: Loại giấy tờ
    row.getCell(18).value = docTypeName // R: Tên giấy tờ
    row.getCell(19).value = docNum // S: Số giấy tờ
    row.getCell(20).value = occ.room || occ.room_no || 'A' // T: Tên phòng
    row.commit()
  })

  const arrayBuffer = await wb.xlsx.writeBuffer()
  return Buffer.from(arrayBuffer)
}

/**
 * 3. Generate Foreign Occupants Import Excel (`Danh_Sach_Mau_Excel.xlsx`)
 */
export async function generateForeignImportExcel(
  occupants: OccupantRecord[],
  lookups: MasterLookups
): Promise<Buffer> {
  const foreignOccupants = occupants.filter(
    (o) => (o.nation || o.nationality || '').toUpperCase() !== 'VNM'
  )

  const wb = new ExcelJS.Workbook()
  const templatePath = path.join(
    process.cwd(),
    'public',
    'templates',
    'Danh_Sach_Mau_Excel.xlsx'
  )

  if (fs.existsSync(templatePath)) {
    await wb.xlsx.readFile(templatePath)
  } else {
    const ws = wb.addWorksheet('Sheet1')
    ws.addRow([
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
    ])
  }

  const ws = wb.worksheets[0] || wb.addWorksheet('Sheet1')

  if (ws.rowCount > 1) {
    ws.spliceRows(2, ws.rowCount - 1)
  }

  foreignOccupants.forEach((occ, idx) => {
    const rowIdx = 2 + idx
    const row = ws.getRow(rowIdx)
    row.getCell(1).value = idx + 1 // A: STT
    row.getCell(2).value = occ.name || occ.full_name || '' // B: Họ tên
    row.getCell(3).value = formatDMY(occ.birthDay || occ.birth_day) // C: Ngày sinh
    row.getCell(4).value = occ.gender === 'F' ? 'Nữ' : 'Nam' // D: Giới tính
    row.getCell(5).value = getViNation(occ.nation || occ.nationality || '', lookups) // E: Quốc tịch
    row.getCell(6).value = occ.numDoc || occ.document_number || '' // F: Số giấy tờ
    row.getCell(7).value = occ.room || occ.room_no || 'A' // G: Phòng
    row.getCell(8).value = getViDocType(occ.typeDoc || occ.document_type || '', lookups) // H: Loại giấy tờ
    row.getCell(9).value = getViResReason(
      occ.res_reason || occ.residence_reason || '',
      lookups
    ) // I: Lý do
    row.getCell(10).value = `${formatDMY(occ.startDate || occ.start_date)} 11:30:00` // J: Từ ngày
    row.getCell(11).value = `${formatDMY(occ.endDate || occ.end_date)} 23:00:00` // K: Đến ngày
    row.commit()
  })

  const arrayBuffer = await wb.xlsx.writeBuffer()
  return Buffer.from(arrayBuffer)
}

/**
 * 4. Generate Foreign Police Declaration XML (`visa_info.xml` - `<KHAI_BAO_TAM_TRU>`)
 */
export function generateVisaXml(occupants: OccupantRecord[]): string {
  const foreignOccupants = occupants.filter(
    (o) => (o.nation || o.nationality || '').toUpperCase() !== 'VNM'
  )

  const escapeXml = (unsafe: string) =>
    (unsafe || '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&apos;')

  const itemsXml = foreignOccupants
    .map((occ, idx) => {
      const name = escapeXml(occ.name || occ.full_name || '')
      const gender = escapeXml(occ.gender || 'M')
      const bday = escapeXml(formatDMY(occ.birthDay || occ.birth_day))
      const nation = escapeXml((occ.nation || occ.nationality || '').toUpperCase())
      const passport = escapeXml(occ.numDoc || occ.document_number || '')
      const start = escapeXml(formatDMY(occ.startDate || occ.start_date))
      const end = escapeXml(formatDMY(occ.endDate || occ.end_date))
      const room = escapeXml(occ.room || occ.room_no || '')

      return [
        `  <THONG_TIN_KHACH>`,
        `    <SO_THU_TU>${idx + 1}</SO_THU_TU>`,
        `    <HO_TEN>${name}</HO_TEN>`,
        `    <GIOI_TINH>${gender}</GIOI_TINH>`,
        `    <NGAY_SINH>${bday}</NGAY_SINH>`,
        `    <NGAY_SINH_CHINH_XAC_DEN>D</NGAY_SINH_CHINH_XAC_DEN>`,
        `    <QUOC_TICH>${nation}</QUOC_TICH>`,
        `    <SO_HO_CHIEU>${passport}</SO_HO_CHIEU>`,
        `    <LOAI_HO_CHIEU>P</LOAI_HO_CHIEU>`,
        `    <NGAY_DEN>${start}</NGAY_DEN>`,
        `    <NGAY_DI_DU_KIEN>${end}</NGAY_DI_DU_KIEN>`,
        `    <SO_PHONG>${room}</SO_PHONG>`,
        `  </THONG_TIN_KHACH>`,
      ].join('\n')
    })
    .join('\n')

  return `<?xml version="1.0" encoding="UTF-8"?>\n<KHAI_BAO_TAM_TRU>\n${itemsXml}\n</KHAI_BAO_TAM_TRU>`
}

