import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import QRCode from 'qrcode'
import fs from 'fs'
import path from 'path'

export async function GET(
  _req: NextRequest,
  context: { params: Promise<{ slug: string[] }> }
) {
  try {
    const { slug } = await context.params
    const relPath = (slug || []).join('/')

    // 1. Check local public/qrcodes directory
    const localFile = path.join(process.cwd(), 'public', 'qrcodes', relPath)
    if (fs.existsSync(localFile)) {
      const fileBuf = fs.readFileSync(localFile)
      return new NextResponse(fileBuf, {
        headers: {
          'Content-Type': 'image/png',
          'Cache-Control': 'public, max-age=86400',
        },
      })
    }

    // 2. Otherwise dynamically generate QR PNG from DB record matching qr_code or request_id
    const person = await prisma.dormPersonnel.findFirst({
      where: {
        OR: [{ qrCode: relPath }, { qrCode: { endsWith: slug[slug.length - 1] } }],
      },
    })

    const qrContent = person
      ? [
          `VG DORMITORY PASS`,
          `Req ID: #${person.requestId}`,
          `Name: ${person.fullName}`,
          `Gender: ${person.gender}`,
          `Nation: ${person.nationality}`,
          `Room: ${person.roomNo || 'Assigned'}`,
          `Stay: ${person.startDate ? person.startDate.toISOString().slice(0, 10) : ''} -> ${person.endDate ? person.endDate.toISOString().slice(0, 10) : ''}`,
        ].join('\n')
      : `VG DORMITORY QR PASS\nRef: ${relPath}`

    const pngBuffer = await QRCode.toBuffer(qrContent, {
      width: 320,
      margin: 2,
      color: { dark: '#0f172a', light: '#ffffff' },
    })

    // Cache on disk for next time
    try {
      const dir = path.dirname(localFile)
      if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true })
      fs.writeFileSync(localFile, pngBuffer)
    } catch {}

    return new NextResponse(new Uint8Array(pngBuffer), {
      headers: {
        'Content-Type': 'image/png',
        'Cache-Control': 'public, max-age=86400',
      },
    })
  } catch (error: any) {
    return NextResponse.json(
      { error: 'Failed to generate QR image' },
      { status: 500 }
    )
  }
}

