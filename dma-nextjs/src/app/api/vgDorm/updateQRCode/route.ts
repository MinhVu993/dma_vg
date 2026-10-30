import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import fs from 'fs'
import path from 'path'

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const requestId = BigInt(body.id || 0)
    const occupantId = body.occupantId ? BigInt(body.occupantId) : null
    const qrDataUrl = String(body.qrCode || '')
    const name = String(body.name || 'guest')

    let savedRelativePath = qrDataUrl

    if (qrDataUrl.startsWith('data:image/')) {
      const base64Data = qrDataUrl.replace(/^data:image\/\w+;base64,/, '')
      const buffer = Buffer.from(base64Data, 'base64')
      const qrDir = path.join(process.cwd(), 'public', 'qrcodes', 'dma')
      if (!fs.existsSync(qrDir)) {
        fs.mkdirSync(qrDir, { recursive: true })
      }
      const safeName = name
        .toLowerCase()
        .replace(/[^a-z0-9]/g, '_')
        .slice(0, 20)
      const fileName = `${Number(requestId)}_${safeName}_${Date.now().toString(36)}.png`
      fs.writeFileSync(path.join(qrDir, fileName), buffer)
      savedRelativePath = `dma/${fileName}`
    }

    if (occupantId) {
      await prisma.dormPersonnel.update({
        where: { id: occupantId },
        data: { qrCode: savedRelativePath },
      })
    }

    return NextResponse.json({
      status: 'success',
      qrCode: savedRelativePath,
    })
  } catch (error: any) {
    return NextResponse.json(
      { error: 'Failed to update QR code', details: error?.message },
      { status: 500 }
    )
  }
}

