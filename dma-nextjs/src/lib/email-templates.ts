import { FormattedDormRequest } from './flow-utils'

const MSG_CENTER_URL =
  process.env.NEXT_PUBLIC_MSG_CENTER_API ||
  'http://gmo021.cansportsvg.com/api/msg-center/sendOutMsg'

const APP_PUBLIC_URL =
  process.env.NEXT_PUBLIC_APP_URL || 'http://gmo021.cansportsvg.com:32040/'

/**
 * Send email via GMO021 Message Center (`sendOutMsg`).
 * Non-blocking safe wrapper so email errors never break DB transactions.
 */
export async function sendDormEmail(params: {
  to: string
  cc?: string
  subject: string
  htmlContent: string
  attachments?: { filename: string; content: Buffer; contentType: string }[]
}): Promise<{ ok: boolean; error?: string }> {
  try {
    if (!params.to || !params.to.trim()) {
      return { ok: false, error: 'Missing recipient email' }
    }

    const formData = new FormData()
    formData.append('type', 'email')
    formData.append('from', 'vg.Step.admin@cansportsvg.com')
    formData.append('to', params.to)
    if (params.cc) {
      formData.append('cc', params.cc)
    }
    formData.append('subject', params.subject)
    formData.append('msg', params.htmlContent)
    formData.append('isHtml', 'true')

    if (params.attachments && params.attachments.length > 0) {
      for (const att of params.attachments) {
        const blob = new Blob([new Uint8Array(att.content)], {
          type: att.contentType,
        })
        formData.append('files[]', blob, att.filename)
      }
    }

    const res = await fetch(MSG_CENTER_URL, {
      method: 'POST',
      body: formData,
    })

    if (!res.ok) {
      return { ok: false, error: `HTTP ${res.status}` }
    }
    return { ok: true }
  } catch (err: any) {
    console.warn('[sendDormEmail] Warning:', err?.message || err)
    return { ok: false, error: err?.message || 'Failed to send email' }
  }
}

export function buildPendingApprovalEmailHtml(req: FormattedDormRequest): string {
  const rowsHtml = req.personnel
    .map(
      (p, idx) => `
      <tr style="border-bottom: 1px solid #e2e8f0;">
        <td style="padding: 8px 10px; text-align: center;">${idx + 1}</td>
        <td style="padding: 8px 10px; font-weight: 600;">${p.name}</td>
        <td style="padding: 8px 10px; text-align: center;">${p.status}</td>
        <td style="padding: 8px 10px; text-align: center;">${p.gender === 'F' ? 'Female / Nữ' : 'Male / Nam'}</td>
        <td style="padding: 8px 10px; text-align: center;">${p.nation}</td>
        <td style="padding: 8px 10px; text-align: center;">${p.startDate} → ${p.endDate}</td>
        <td style="padding: 8px 10px; text-align: center;">${p.room || '-'}</td>
      </tr>`
    )
    .join('')

  return `
  <div style="font-family: 'Segoe UI', -apple-system, BlinkMacSystemFont, sans-serif; color: #1e293b; line-height: 1.6; max-width: 760px;">
    <h2 style="color: #1d4ed8; margin-bottom: 8px;">[DMA] Dormitory Accommodation Request #${req.id}</h2>
    <p style="margin: 4px 0;">
      <strong>Submitter / Người gửi:</strong> ${req.creator_empno} - ${req.creator_name} (${req.creator_dept}) | Ext: ${req.creator_phone || 'N/A'}
    </p>
    <p style="margin: 4px 0;">
      <strong>Reason / Lý do:</strong> ${req.reason || 'N/A'}
    </p>
    <table style="width: 100%; border-collapse: collapse; margin-top: 14px; font-size: 13px; border: 1px solid #cbd5e1;">
      <thead>
        <tr style="background-color: #f1f5f9; text-align: center;">
          <th style="padding: 8px 10px; border: 1px solid #cbd5e1;">#</th>
          <th style="padding: 8px 10px; border: 1px solid #cbd5e1;">Full Name / Họ tên</th>
          <th style="padding: 8px 10px; border: 1px solid #cbd5e1;">Origin / Khu vực</th>
          <th style="padding: 8px 10px; border: 1px solid #cbd5e1;">Gender / Giới tính</th>
          <th style="padding: 8px 10px; border: 1px solid #cbd5e1;">Nation / Quốc tịch</th>
          <th style="padding: 8px 10px; border: 1px solid #cbd5e1;">Stay Period / Thời gian</th>
          <th style="padding: 8px 10px; border: 1px solid #cbd5e1;">Room / Phòng</th>
        </tr>
      </thead>
      <tbody>
        ${rowsHtml}
      </tbody>
    </table>
    <div style="margin-top: 20px;">
      <a href="${APP_PUBLIC_URL}" style="display: inline-block; background: #2563eb; color: #ffffff; text-decoration: none; padding: 10px 18px; border-radius: 6px; font-weight: bold;">
        Open Dormitory Management System (DMA)
      </a>
    </div>
  </div>
  `
}

export function buildCompletedEmailHtml(req: FormattedDormRequest): string {
  return `
  <div style="font-family: 'Segoe UI', -apple-system, BlinkMacSystemFont, sans-serif; color: #1e293b; line-height: 1.6; max-width: 760px;">
    <h2 style="color: #059669; margin-bottom: 8px;">[DMA] Approved — Dormitory Accommodation Request #${req.id}</h2>
    <p>Dear <strong>${req.creator_name}</strong> (${req.creator_dept}),</p>
    <p>Your dormitory accommodation request <strong>#${req.id}</strong> (${req.personnel.length} occupant(s)) has completed all 4 approval levels.</p>
    <p>The police declaration & accommodation register files are attached to this email.</p>
    <div style="margin-top: 16px;">
      <a href="${APP_PUBLIC_URL}" style="display: inline-block; background: #059669; color: #ffffff; text-decoration: none; padding: 10px 18px; border-radius: 6px; font-weight: bold;">
        View Details & Download QR Codes
      </a>
    </div>
  </div>
  `
}

export function buildDeniedEmailHtml(
  req: FormattedDormRequest,
  denierName: string,
  denyReason: string
): string {
  return `
  <div style="font-family: 'Segoe UI', -apple-system, BlinkMacSystemFont, sans-serif; color: #1e293b; line-height: 1.6; max-width: 760px;">
    <h2 style="color: #dc2626; margin-bottom: 8px;">[DMA] Declined — Dormitory Accommodation Request #${req.id}</h2>
    <p>Dear <strong>${req.creator_name}</strong> (${req.creator_dept}),</p>
    <p>Your dormitory accommodation request <strong>#${req.id}</strong> was declined by <strong>${denierName}</strong>.</p>
    <p style="background: #fef2f2; border-left: 4px solid #dc2626; padding: 10px 14px; color: #991b1b;">
      <strong>Reason / Lý do từ chối:</strong> ${denyReason}
    </p>
    <div style="margin-top: 16px;">
      <a href="${APP_PUBLIC_URL}" style="display: inline-block; background: #475569; color: #ffffff; text-decoration: none; padding: 10px 18px; border-radius: 6px; font-weight: bold;">
        View Request in DMA
      </a>
    </div>
  </div>
  `
}

