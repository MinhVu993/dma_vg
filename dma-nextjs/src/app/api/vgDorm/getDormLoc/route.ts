import { NextResponse } from 'next/server'
import { prisma, serializePrisma } from '@/lib/prisma'

export const dynamic = 'force-dynamic'

export async function GET() {
  try {
    const locations = await prisma.location.findMany({
      orderBy: { id: 'asc' },
    })
    return NextResponse.json(serializePrisma(locations))
  } catch (error: any) {
    console.error('[GET /api/vgDorm/getDormLoc] Error:', error)
    return NextResponse.json([], { status: 500 })
  }
}

