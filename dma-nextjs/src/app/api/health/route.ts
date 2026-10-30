import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export const dynamic = 'force-dynamic'

export async function GET() {
  try {
    const [requestCount, personnelCount] = await Promise.all([
      prisma.dormRequest.count(),
      prisma.dormPersonnel.count(),
    ])
    return NextResponse.json({
      status: 'ok',
      database: 'vg_dma (PostgreSQL)',
      requestCount,
      personnelCount,
      timestamp: new Date().toISOString(),
    })
  } catch (error: any) {
    return NextResponse.json(
      {
        status: 'error',
        error: error?.message || 'Database connection error',
      },
      { status: 500 }
    )
  }
}

