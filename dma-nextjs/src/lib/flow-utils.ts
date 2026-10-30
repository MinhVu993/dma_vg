export const LEVEL_CODES = [
  'dept_manager',
  'ga_manager',
  'smp_manager',
  'vice_general_manager',
] as const

export type LevelCode = (typeof LEVEL_CODES)[number]

export interface FlowPerson {
  empid: string
  name: string
  username?: string
  dept?: string
  email?: string
  ext?: string
  phone?: string
  deputy?: string
  status?: boolean
}

export interface FlowStep {
  lvl_code: string
  managers: FlowPerson[]
  deputies: FlowPerson[]
}

export interface LegacyApprovalItem {
  code?: string
  empid?: string
  name?: string
  username?: string
  dept?: string
  email?: string
  ext?: string
  phone?: string
  reason?: string
  date?: string
  action?: 'APPROVED' | 'DENIED' | string
}

export interface OccupantRecord {
  id?: number
  request_id?: number
  name: string
  full_name?: string
  status: string
  accom_status?: string
  gender: string
  birthDay: string
  birth_day?: string
  nation: string
  nationality?: string
  startDate: string
  start_date?: string
  endDate: string
  end_date?: string
  typeDoc: string
  document_type?: string
  numDoc: string
  document_number?: string
  note: string
  notes?: string
  room: string
  room_no?: string
  qrCode: string
  qr_code?: string
  res_reason: string
  residence_reason?: string
  typeRes: string
  residence_type?: string
  prov_city: string
  province_city?: string
  ward_com: string
  ward_commune?: string
  detailAddr: string
  detailed_address?: string
}

export interface FormattedDormRequest {
  id: number
  key_in: string
  key_in_date: string
  submitter: {
    empno: string
    name: string
    dept: string
    ext: string
    phone?: string
  }
  creator_empno: string
  creator_name: string
  creator_dept: string
  creator_phone: string
  name: OccupantRecord[]
  personnel: OccupantRecord[]
  reason: string
  app_flow: string // JSON string of FlowStep[] for legacy compatibility
  approval_flow: FlowStep[]
  status: (boolean | null)[] // [lvl0, lvl1, lvl2, lvl3]
  db_status: 'PENDING' | 'COMPLETED' | 'DENIED' | string
  current_lvl_code: string | null
  approval: (LegacyApprovalItem | null)[] // [lvl0, lvl1, lvl2, lvl3]
  approval_logs: LegacyApprovalItem[]
  occupantCount: number
  assignedRoomCount: number
  unassignedRoomCount: number
  created_at?: string
  updated_at?: string
}

export function formatDateStr(val: Date | string | null | undefined): string {
  if (!val) return ''
  if (typeof val === 'string') {
    return val.slice(0, 10)
  }
  try {
    return val.toISOString().slice(0, 10)
  } catch {
    return ''
  }
}

export function normalizeApprovalFlow(rawFlow: unknown): FlowStep[] {
  let parsed: any = rawFlow
  if (typeof rawFlow === 'string') {
    try {
      parsed = JSON.parse(rawFlow)
    } catch {
      parsed = []
    }
  }
  if (!Array.isArray(parsed)) return []

  return LEVEL_CODES.map((lvlCode, idx) => {
    const found =
      parsed.find((item: any) => item?.lvl_code === lvlCode) || parsed[idx] || {}
    const rawManagers = Array.isArray(found.managers) ? found.managers : []
    const rawDeputies = Array.isArray(found.deputies) ? found.deputies : []

    // Collect all deputies: from found.deputies AND manager.deputies
    const expandedDeputies: FlowPerson[] = [...rawDeputies]

    const managers: FlowPerson[] = rawManagers.map((m: any) => {
      // Collect manager.deputies (nested array format from IFM API)
      if (Array.isArray(m?.deputies)) {
        m.deputies.forEach((d: any) => {
          if (!d) return
          const depEmpid = String(d.empid || d.empno || '').trim()
          if (
            depEmpid &&
            !expandedDeputies.some(
              (x) => String(x.empid || (x as any).empno).trim() === depEmpid
            )
          ) {
            expandedDeputies.push({
              empid: depEmpid,
              name: String(d.full_name || d.name || d.username || depEmpid),
              username: String(d.username || d.name || d.full_name || depEmpid),
              dept: String(d.dept || d.dep || m.dept || ''),
              email: String(d.email || ''),
              status: d.status !== false,
            })
          }
        })
      }

      // Expand legacy pipe-delimited string deputy: 'empno|name|dept|email|status'
      if (m && typeof m.deputy === 'string' && m.deputy.includes('|')) {
        const parts = m.deputy.split('|').map((s: string) => s.trim())
        const depEmpid = parts[0] || ''
        if (
          depEmpid &&
          !expandedDeputies.some((d) => String(d.empid) === String(depEmpid))
        ) {
          expandedDeputies.push({
            empid: depEmpid,
            name: parts[1] || depEmpid,
            dept: parts[2] || m.dept || '',
            email: parts[3] || '',
            status: parts[4] === 'true',
          })
        }
      }

      return {
        empid: String(m?.empid || m?.empno || ''),
        name: String(m?.full_name || m?.name || m?.username || ''),
        username: String(m?.username || m?.name || m?.full_name || ''),
        dept: String(m?.dept || m?.dep || m?.division_code || ''),
        email: String(m?.email || ''),
        ext: String(m?.ext || m?.phone || ''),
      }
    })

    const deputies: FlowPerson[] = expandedDeputies
      .filter((d: any) => d && (d.empid || d.empno))
      .map((d: any) => ({
        empid: String(d.empid || d.empno || ''),
        name: String(d.full_name || d.name || d.username || ''),
        username: String(d.username || d.name || d.full_name || ''),
        dept: String(d.dept || d.dep || ''),
        email: String(d.email || ''),
        status: d.status !== false,
      }))

    return {
      lvl_code: lvlCode,
      managers,
      deputies,
    }
  })
}

/**
 * Reconstruct the 4-element legacy `status` array ([true, null, null, null])
 * and 4-element `approval` array from PostgreSQL's `status`, `current_lvl_code`, and `approval_logs`.
 */
export function deriveLegacyStatusAndApproval(
  dbStatus: string | null | undefined,
  currentLvlCode: string | null | undefined,
  rawLogs: unknown
): {
  statusArray: (boolean | null)[]
  approvalArray: (LegacyApprovalItem | null)[]
  logsList: LegacyApprovalItem[]
} {
  let logs: any[] = []
  if (typeof rawLogs === 'string') {
    try {
      logs = JSON.parse(rawLogs)
    } catch {
      logs = []
    }
  } else if (Array.isArray(rawLogs)) {
    logs = rawLogs
  }

  const normalizedStatus = (dbStatus || 'PENDING').toUpperCase()
  const statusArray: (boolean | null)[] = [null, null, null, null]
  const approvalArray: (LegacyApprovalItem | null)[] = [null, null, null, null]

  // Map logs to their respective step index
  logs.forEach((log, idx) => {
    if (!log) return
    const stepIndex = log.lvl_code
      ? LEVEL_CODES.indexOf(log.lvl_code as LevelCode)
      : idx < 4
        ? idx
        : -1
    const targetIdx = stepIndex >= 0 && stepIndex < 4 ? stepIndex : Math.min(idx, 3)

    approvalArray[targetIdx] = {
      code: log.code || log.empid || '',
      empid: log.empid || log.code || '',
      name: log.name || log.username || '',
      username: log.username || log.name || '',
      dept: log.dept || '',
      email: log.email || '',
      ext: log.ext || '',
      reason: log.reason || '',
      date: log.date || '',
      action: log.action || (log.reason ? 'DENIED' : 'APPROVED'),
    }

    if (log.action === 'DENIED' || (normalizedStatus === 'DENIED' && log.reason)) {
      statusArray[targetIdx] = false
    } else if (log.action === 'APPROVED' || log.empid || log.code || log.name) {
      statusArray[targetIdx] = true
    }
  })

  if (normalizedStatus === 'COMPLETED') {
    for (let i = 0; i < 4; i++) {
      statusArray[i] = true
    }
  } else if (normalizedStatus === 'DENIED') {
    // Ensure at least one false exists
    if (!statusArray.includes(false)) {
      const lvlIdx = currentLvlCode
        ? LEVEL_CODES.indexOf(currentLvlCode as LevelCode)
        : 0
      const targetIdx = lvlIdx >= 0 ? lvlIdx : 0
      for (let i = 0; i < targetIdx; i++) statusArray[i] = true
      statusArray[targetIdx] = false
    }
  } else {
    // PENDING
    const lvlIdx = currentLvlCode
      ? LEVEL_CODES.indexOf(currentLvlCode as LevelCode)
      : -1
    if (lvlIdx >= 0) {
      for (let i = 0; i < lvlIdx; i++) {
        statusArray[i] = true
      }
      for (let i = lvlIdx; i < 4; i++) {
        statusArray[i] = null
      }
    }
  }

  return {
    statusArray,
    approvalArray,
    logsList: approvalArray.filter(Boolean) as LegacyApprovalItem[],
  }
}

/**
 * Convert a PostgreSQL `dorm_request_tbl` record (with `personnel`) into a unified
 * dual-compatible object that satisfies both modern Next.js components and legacy API consumers.
 */
export function formatDormRequestRecord(row: any): FormattedDormRequest {
  const id = Number(row.id)
  const keyInStr = formatDateStr(row.key_in_date)
  const flowSteps = normalizeApprovalFlow(row.approval_flow)
  const { statusArray, approvalArray, logsList } = deriveLegacyStatusAndApproval(
    row.status,
    row.current_lvl_code,
    row.approval_logs
  )

  const rawPersonnel = Array.isArray(row.personnel) ? row.personnel : []
  const occupants: OccupantRecord[] = rawPersonnel.map((p: any) => {
    const birthDay = formatDateStr(p.birth_day)
    const startDate = formatDateStr(p.start_date)
    const endDate = formatDateStr(p.end_date)
    const room = p.room_no || ''
    const qrCode = p.qr_code || ''
    const rawGender = String(p.gender || 'Male').trim()
    const isFemale =
      rawGender.toUpperCase() === 'F' ||
      rawGender.toUpperCase() === 'FEMALE' ||
      rawGender.toLowerCase() === 'nữ'
    return {
      id: p.id ? Number(p.id) : undefined,
      request_id: p.request_id ? Number(p.request_id) : id,
      name: p.full_name || '',
      full_name: p.full_name || '',
      status: p.accom_status || '',
      accom_status: p.accom_status || '',
      gender: isFemale ? 'F' : 'M',
      birthDay,
      birth_day: birthDay,
      nation: p.nationality || '',
      nationality: p.nationality || '',
      startDate,
      start_date: startDate,
      endDate,
      end_date: endDate,
      typeDoc: p.document_type || '',
      document_type: p.document_type || '',
      numDoc: p.document_number || '',
      document_number: p.document_number || '',
      note: p.notes || '',
      notes: p.notes || '',
      room,
      room_no: room,
      qrCode,
      qr_code: qrCode,
      res_reason: p.residence_reason || '',
      residence_reason: p.residence_reason || '',
      typeRes: p.residence_type || '',
      residence_type: p.residence_type || '',
      prov_city: p.province_city || '',
      province_city: p.province_city || '',
      ward_com: p.ward_commune || '',
      ward_commune: p.ward_commune || '',
      detailAddr: p.detailed_address || '',
      detailed_address: p.detailed_address || '',
    }
  })

  const assignedRoomCount = occupants.filter(
    (o) => o.room && o.room.trim() !== ''
  ).length

  return {
    id,
    key_in: keyInStr,
    key_in_date: keyInStr,
    submitter: {
      empno: row.creator_empno || '',
      name: row.creator_name || '',
      dept: row.creator_dept || '',
      ext: row.creator_phone || '',
      phone: row.creator_phone || '',
    },
    creator_empno: row.creator_empno || '',
    creator_name: row.creator_name || '',
    creator_dept: row.creator_dept || '',
    creator_phone: row.creator_phone || '',
    name: occupants,
    personnel: occupants,
    reason: row.reason || '',
    app_flow: JSON.stringify(flowSteps),
    approval_flow: flowSteps,
    status: statusArray,
    db_status: (row.status || 'PENDING').toUpperCase(),
    current_lvl_code: row.current_lvl_code || null,
    approval: approvalArray,
    approval_logs: logsList,
    occupantCount: occupants.length,
    assignedRoomCount,
    unassignedRoomCount: occupants.length - assignedRoomCount,
    created_at: row.created_at ? new Date(row.created_at).toISOString() : undefined,
    updated_at: row.updated_at ? new Date(row.updated_at).toISOString() : undefined,
  }
}

/**
 * Determine if a user (by empno) is an eligible approver for the current pending step of a request.
 */
export function isUserPendingApprover(
  req: FormattedDormRequest,
  userEmpno: string | undefined
): { canApprove: boolean; stepIndex: number } {
  if (!userEmpno) return { canApprove: false, stepIndex: -1 }
  if (req.db_status === 'COMPLETED' || req.db_status === 'DENIED') {
    return { canApprove: false, stepIndex: -1 }
  }
  if (req.status.includes(false)) {
    return { canApprove: false, stepIndex: -1 }
  }

  const pendingIndex = req.status.findIndex((s) => s === null)
  if (pendingIndex === -1) return { canApprove: false, stepIndex: -1 }

  const step = req.approval_flow[pendingIndex]
  if (!step) return { canApprove: false, stepIndex: pendingIndex }

  const normalizedEmp = String(userEmpno).trim()
  const isManager = step.managers?.some(
    (m) => String(m.empid).trim() === normalizedEmp
  )
  const isDeputy = step.deputies?.some(
    (d) => d.status !== false && String(d.empid).trim() === normalizedEmp
  )

  return {
    canApprove: Boolean(isManager || isDeputy),
    stepIndex: pendingIndex,
  }
}

/**
 * Determine if a user is part of ANY step in the request's approval flow.
 */
export function isUserInApprovalFlow(
  req: FormattedDormRequest,
  userEmpno: string | undefined
): boolean {
  if (!userEmpno) return false
  const normalizedEmp = String(userEmpno).trim()
  return req.approval_flow.some(
    (step) =>
      step.managers?.some((m) => String(m.empid).trim() === normalizedEmp) ||
      step.deputies?.some(
        (d) => d.status !== false && String(d.empid).trim() === normalizedEmp
      )
  )
}
