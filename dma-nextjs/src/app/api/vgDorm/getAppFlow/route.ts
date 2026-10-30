import { NextRequest, NextResponse } from 'next/server'
import { normalizeApprovalFlow } from '@/lib/flow-utils'

const IFM_RESOLVE_URL =
  process.env.NEXT_PUBLIC_IFM_TRACKING_API ||
  'http://gmo021.cansportsvg.com:10003/api/ifm-tracking/resolve'

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}))
    const empno = String(body.empno || '038146').trim()

    const controller = new AbortController()
    const timeout = setTimeout(() => controller.abort(), 6000)

    const res = await fetch(IFM_RESOLVE_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        empno,
        location: 'vg',
        app_code: 'dma',
      }),
      signal: controller.signal,
    })
    clearTimeout(timeout)

    if (res.ok) {
      const data = await res.json()
      const rawSteps =
        data?.result?.flow_data ||
        data?.flow_data ||
        (Array.isArray(data) ? data : null)

      if (Array.isArray(rawSteps) && rawSteps.length > 0) {
        const normalized = normalizeApprovalFlow(rawSteps)
        return NextResponse.json(normalized)
      }
    }
  } catch (err: any) {
    console.error('[POST /api/vgDorm/getAppFlow] Failed to fetch IFM flow:', err?.message)
  }

  return NextResponse.json([], { status: 500 })
}
