import { NextRequest, NextResponse } from 'next/server'
import { prisma, serializePrisma } from '@/lib/prisma'
import { formatDormRequestRecord } from '@/lib/flow-utils'
import QRCode from 'qrcode'
import fs from 'fs'
import path from 'path'

async function generateQrForOccupant(
  requestId: number,
  occupantName: string,
  gender: string,
  nation: string,
  room: string,
  startDate: string,
  endDate: string
): Promise<string> {
  try {
    const qrDir = path.join(process.cwd(), 'public', 'qrcodes', 'dma')
    if (!fs.existsSync(qrDir)) {
      fs.mkdirSync(qrDir, { recursive: true })
    }
    const safeName = (occupantName || 'guest')
      .toLowerCase()
      .replace(/[^a-z0-9]/g, '_')
      .slice(0, 20)
    const rand = Math.random().toString(36).substring(2, 7)
    const fileName = `${requestId}_${safeName}_${rand}.png`
    const filePath = path.join(qrDir, fileName)

    const qrText = [
      `VG DORMITORY PASS`,
      `Req ID: #${requestId}`,
      `Name: ${occupantName}`,
      `Gender: ${gender}`,
      `Nation: ${nation}`,
      `Room: ${room}`,
      `Stay: ${startDate} to ${endDate}`,
    ].join('\n')

    await QRCode.toFile(filePath, qrText, {
      width: 320,
      margin: 2,
      color: { dark: '#0f172a', light: '#ffffff' },
    })

    return `dma/${fileName}`
  } catch (err) {
    console.warn('[generateQrForOccupant] fallback:', err)
    return ''
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const requestId = BigInt(body.id)
    const rawList =
      typeof body.name === 'string'
        ? JSON.parse(body.name)
        : Array.isArray(body.name)
          ? body.name
          : Array.isArray(body.personnel)
            ? body.personnel
            : []

    const existingPersonnel = await prisma.dormPersonnel.findMany({
      where: { requestId },
      orderBy: { id: 'asc' },
    })

    for (let i = 0; i < existingPersonnel.length; i++) {
      const dbPerson = existingPersonnel[i]
      const incoming =
        rawList.find(
          (item: any) =>
            (item.id && Number(item.id) === Number(dbPerson.id)) ||
            (item.name || item.full_name) === dbPerson.fullName
        ) || rawList[i]

      if (!incoming) continue

      const newRoom = String(incoming.room ?? incoming.room_no ?? '').trim()
      let qrPath = String(
        incoming.qrCode ?? incoming.qr_code ?? dbPerson.qrCode ?? ''
      ).trim()

      if (newRoom && (!qrPath || dbPerson.roomNo !== newRoom)) {
        const generated = await generateQrForOccupant(
          Number(requestId),
          dbPerson.fullName,
          dbPerson.gender || 'Male',
          dbPerson.nationality || 'VNM',
          newRoom,
          dbPerson.startDate ? dbPerson.startDate.toISOString().slice(0, 10) : '',
          dbPerson.endDate ? dbPerson.endDate.toISOString().slice(0, 10) : ''
        )
        if (generated) qrPath = generated
      }

      await prisma.dormPersonnel.update({
        where: { id: dbPerson.id },
        data: {
          roomNo: newRoom || null,
          qrCode: qrPath || null,
        },
      })
    }

    const updatedReq = await prisma.dormRequest.findUnique({
      where: { id: requestId },
      include: { personnel: { orderBy: { id: 'asc' } } },
    })

    const formatted = formatDormRequestRecord({
      id: updatedReq!.id,
      key_in_date: updatedReq!.keyInDate,
      creator_empno: updatedReq!.creatorEmpno,
      creator_name: updatedReq!.creatorName,
      creator_dept: updatedReq!.creatorDept,
      creator_phone: updatedReq!.creatorPhone,
      reason: updatedReq!.reason,
      approval_flow: updatedReq!.approvalFlow,
      status: updatedReq!.status,
      current_lvl_code: updatedReq!.currentLvlCode,
      approval_logs: updatedReq!.approvalLogs,
      created_at: updatedReq!.createdAt,
      updated_at: updatedReq!.updatedAt,
      personnel: updatedReq!.personnel.map((p) => ({
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

    return NextResponse.json(
      serializePrisma({
        status: 'success',
        data: formatted,
      })
    )
  } catch (error: any) {
    console.error('[POST /api/vgDorm/updateRoomInName] Error:', error)
    return NextResponse.json(
      { error: 'Failed to update room assignment', details: error?.message },
      { status: 500 }
    )
  }
}

