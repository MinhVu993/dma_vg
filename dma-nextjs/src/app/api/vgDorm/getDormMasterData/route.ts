import { NextResponse } from 'next/server'
import { prisma, serializePrisma } from '@/lib/prisma'

export const dynamic = 'force-dynamic'

export async function GET() {
  try {
    const [
      locations,
      nations,
      docTypes,
      resReasons,
      resTypes,
      provinces,
      wards,
    ] = await Promise.all([
      prisma.location.findMany({ orderBy: { id: 'asc' } }),
      prisma.nationSub.findMany({ orderBy: { code: 'asc' } }),
      prisma.documentType.findMany({ orderBy: { id: 'asc' } }),
      prisma.resReason.findMany({ orderBy: { id: 'asc' } }),
      prisma.residenceType.findMany({ orderBy: { id: 'asc' } }),
      prisma.province.findMany({ orderBy: { code: 'asc' } }),
      prisma.ward.findMany({ orderBy: { code: 'asc' } }),
    ])

    return NextResponse.json(
      serializePrisma({
        locations,
        nations,
        doc_types: docTypes.map((d) => ({
          id: d.id,
          name: d.name,
          type:
            typeof d.name === 'string' && d.name.startsWith('{')
              ? JSON.parse(d.name)
              : { vi: d.name, en: d.name, cn: d.name },
        })),
        res_reasons: resReasons.map((r) => ({
          id: r.id,
          res_reason:
            typeof r.resReason === 'string' && r.resReason.startsWith('{')
              ? JSON.parse(r.resReason)
              : { vi: r.resReason, en: r.resReason, cn: r.resReason },
        })),
        res_types: resTypes.map((t) => ({
          id: t.id,
          name:
            typeof t.name === 'string' && t.name.startsWith('{')
              ? JSON.parse(t.name)
              : { vi: t.name, en: t.name, cn: t.name },
        })),
        provinces,
        wards,
      })
    )
  } catch (error: any) {
    console.error('[GET /api/vgDorm/getDormMasterData] Error:', error)
    return NextResponse.json(
      { error: 'Failed to load master data', details: error?.message },
      { status: 500 }
    )
  }
}

