import { NextResponse } from 'next/server'
import { prisma, serializePrisma } from '@/lib/prisma'

export const dynamic = 'force-dynamic'

export async function GET() {
  try {
    const nations = await prisma.nationSub.findMany({
      orderBy: { code: 'asc' },
    })
    return NextResponse.json(serializePrisma(nations))
  } catch (error: any) {
    console.error('[GET /api/vgDorm/getDormNation] Error:', error)
    return NextResponse.json([], { status: 500 })
  }
}

