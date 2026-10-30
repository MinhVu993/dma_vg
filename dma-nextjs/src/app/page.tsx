'use client'

import React, { useState, useEffect, useMemo, useCallback } from 'react'
import {
  FormattedDormRequest,
  isUserPendingApprover,
  isUserInApprovalFlow,
  LegacyApprovalItem,
} from '@/lib/flow-utils'
import { useSession } from '@/context/SessionContext'
import { useTranslation } from '@/hooks/useTranslation'
import { useTableExcelFilter } from '@/hooks/useTableExcelFilter'
import { ExcelColumnFilter } from '@/components/table/ExcelColumnFilter'
import { RequestFormModal } from '@/components/dorm/RequestFormModal'
import { OccupantRoomModal } from '@/components/dorm/OccupantRoomModal'
import {
  Search,
  Plus,
  RefreshCw,
  CheckCircle2,
  XCircle,
  Clock,
  BedDouble,
  Eye,
  Download,
  RotateCcw,
  Users,
  X,
  ClipboardCheck,
  ChevronLeft,
  ChevronRight,
} from 'lucide-react'

type StatusTab = 'all' | 'todo' | 'processing' | 'completed' | 'declined'

export default function RequestsListingPage() {
  const { user } = useSession()
  const { t } = useTranslation()

  const [requests, setRequests] = useState<FormattedDormRequest[]>([])
  const [masterData, setMasterData] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [activeTab, setActiveTab] = useState<StatusTab>('all')
  const [searchQuery, setSearchQuery] = useState('')
  const [page, setPage] = useState(1)
  const [rowsPerPage, setRowsPerPage] = useState(30)
  const [tabInitialized, setTabInitialized] = useState(false)

  // Modals
  const [createOpen, setCreateOpen] = useState(false)
  const [selectedRequest, setSelectedRequest] =
    useState<FormattedDormRequest | null>(null)
  const [roomModalRequest, setRoomModalRequest] =
    useState<FormattedDormRequest | null>(null)
  const [approvalInfoModal, setApprovalInfoModal] = useState<{
    reqId: number
    stepLabel: string
    info: LegacyApprovalItem
  } | null>(null)

  const loadData = useCallback(async () => {
    setLoading(true)
    try {
      const [reqRes, masterRes] = await Promise.all([
        fetch('/api/vgDorm/getAllData'),
        fetch('/api/vgDorm/getDormMasterData'),
      ])
      if (reqRes.ok) {
        const list = await reqRes.json()
        setRequests(Array.isArray(list) ? list : [])
      }
      if (masterRes.ok) {
        setMasterData(await masterRes.json())
      }
    } catch (e) {
      console.error('Error loading requests:', e)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    loadData()
    const handler = () => loadData()
    window.addEventListener('dma-data-updated', handler)
    return () => window.removeEventListener('dma-data-updated', handler)
  }, [loadData])

  // Compute tab counts
  const tabCounts = useMemo(() => {
    let todo = 0
    let processing = 0
    let completed = 0
    let declined = 0

    requests.forEach((r) => {
      if (r.db_status === 'COMPLETED') {
        completed++
      } else if (r.db_status === 'DENIED') {
        declined++
      } else {
        processing++
        if (isUserPendingApprover(r, user.empno).canApprove) {
          todo++
        }
      }
    })

    return {
      all: requests.length,
      todo,
      processing,
      completed,
      declined,
    }
  }, [requests, user.empno])

  // Auto-switch to 'todo' tab if current user has pending items to approve, else default to 'all'
  useEffect(() => {
    if (!tabInitialized && requests.length > 0) {
      if (tabCounts.todo > 0) {
        setActiveTab('todo')
      } else {
        setActiveTab('all')
      }
      setTabInitialized(true)
    }
  }, [tabInitialized, requests.length, tabCounts.todo])

  // Step 1: Filter by Tab & Global Search
  const tabAndSearchFiltered = useMemo(() => {
    const q = searchQuery.trim().toLowerCase()

    return requests.filter((r) => {
      if (activeTab === 'todo') {
        if (!isUserPendingApprover(r, user.empno).canApprove) return false
      } else if (activeTab === 'processing') {
        if (r.db_status !== 'PENDING') return false
      } else if (activeTab === 'completed') {
        if (r.db_status !== 'COMPLETED') return false
      } else if (activeTab === 'declined') {
        if (r.db_status !== 'DENIED') return false
      }

      if (!q) return true

      const matchId = String(r.id).includes(q)
      const matchCreator =
        r.creator_name.toLowerCase().includes(q) ||
        r.creator_empno.toLowerCase().includes(q) ||
        r.creator_dept.toLowerCase().includes(q)
      const matchReason = (r.reason || '').toLowerCase().includes(q)
      const matchOccupant = r.personnel.some(
        (p) =>
          (p.name || '').toLowerCase().includes(q) ||
          (p.room || '').toLowerCase().includes(q) ||
          (p.nation || '').toLowerCase().includes(q) ||
          (p.numDoc || '').toLowerCase().includes(q)
      )

      return matchId || matchCreator || matchReason || matchOccupant
    })
  }, [requests, activeTab, searchQuery, user.empno])

  // Step 2: Excel Column Filters & Sorting
  const accessorMap = useMemo(
    () => ({
      id: (r: FormattedDormRequest) => r.id,
      key_in_date: (r: FormattedDormRequest) => r.key_in_date || '',
      creator: (r: FormattedDormRequest) =>
        `${r.creator_empno} - ${r.creator_name}`,
      dept: (r: FormattedDormRequest) => r.creator_dept || '',
      occupants: (r: FormattedDormRequest) =>
        r.personnel[0]?.name || '(Chưa có)',
      headcount: (r: FormattedDormRequest) => r.occupantCount,
      roomStatus: (r: FormattedDormRequest) =>
        r.assignedRoomCount === r.occupantCount && r.occupantCount > 0
          ? 'Đã xếp đủ phòng'
          : r.assignedRoomCount > 0
            ? 'Xếp một phần'
            : 'Chưa xếp phòng',
      db_status: (r: FormattedDormRequest) => r.db_status,
    }),
    []
  )

  const {
    filteredData,
    columnFilters,
    sortConfig,
    getUniqueValues,
    setFilterForColumn,
    clearAllColumnFilters,
    toggleSort,
    activeFilterCount,
  } = useTableExcelFilter(tabAndSearchFiltered, accessorMap)

  useEffect(() => {
    setPage(1)
  }, [activeTab, searchQuery, activeFilterCount])

  const totalPages = Math.max(1, Math.ceil(filteredData.length / rowsPerPage))
  const paginatedRows = useMemo(() => {
    const start = (page - 1) * rowsPerPage
    return filteredData.slice(start, start + rowsPerPage)
  }, [filteredData, page, rowsPerPage])

  const handleRequestUpdated = (updated: FormattedDormRequest) => {
    setRequests((prev) => {
      const exists = prev.some((item) => item.id === updated.id)
      if (exists) {
        return prev.map((item) => (item.id === updated.id ? updated : item))
      }
      return [updated, ...prev]
    })
  }

  const renderStepCell = (
    req: FormattedDormRequest,
    stepIdx: number,
    stepTitle: string
  ) => {
    const st = req.status[stepIdx]
    const appInfo = req.approval[stepIdx]
    const hasPriorDenied = req.status.slice(0, stepIdx).includes(false)
    const pendingIdx = req.status.includes(false)
      ? -1
      : req.status.findIndex((s) => s === null)
    const isCurrentPending = stepIdx === pendingIdx

    if (st === true) {
      return (
        <button
          type="button"
          onClick={() =>
            appInfo &&
            setApprovalInfoModal({
              reqId: req.id,
              stepLabel: stepTitle,
              info: appInfo,
            })
          }
          className="group inline-flex items-center gap-1.5 text-[11.5px] font-bold text-emerald-700 transition-colors hover:text-emerald-900"
          title={
            appInfo?.name
              ? `${appInfo.name} (${appInfo.date || ''})`
              : 'Đã phê duyệt'
          }
        >
          <span className="flex h-4 w-4 shrink-0 items-center justify-center rounded-full bg-emerald-100 text-emerald-700 group-hover:bg-emerald-200">
            <CheckCircle2 className="h-3 w-3 stroke-[2.5]" />
          </span>
          <span className="max-w-[105px] truncate tracking-tight">
            {appInfo?.name || 'Approved'}
          </span>
        </button>
      )
    }

    if (st === false) {
      return (
        <button
          type="button"
          onClick={() =>
            appInfo &&
            setApprovalInfoModal({
              reqId: req.id,
              stepLabel: stepTitle,
              info: appInfo,
            })
          }
          className="group inline-flex items-center gap-1.5 text-[11.5px] font-bold text-rose-600 transition-colors hover:text-rose-800"
        >
          <span className="flex h-4 w-4 shrink-0 items-center justify-center rounded-full bg-rose-100 text-rose-600 group-hover:bg-rose-200">
            <XCircle className="h-3 w-3 stroke-[2.5]" />
          </span>
          <span className="max-w-[105px] truncate tracking-tight">
            {appInfo?.name || 'Declined'}
          </span>
        </button>
      )
    }

    if (hasPriorDenied) {
      return <span className="font-mono text-xs text-slate-300">—</span>
    }

    const stepFlow = req.approval_flow[stepIdx]
    const primaryMgr = stepFlow?.managers?.[0]?.name || 'Pending'

    if (isCurrentPending) {
      return (
        <button
          type="button"
          onClick={() => setSelectedRequest(req)}
          className="group inline-flex items-center gap-1.5 text-[11px] font-bold text-amber-700 transition-colors hover:text-amber-900"
          title="Đang chờ cấp này duyệt"
        >
          <span className="flex h-4 w-4 shrink-0 items-center justify-center rounded-full bg-amber-100 text-amber-600 group-hover:bg-amber-200">
            <Clock className="h-2.5 w-2.5 stroke-[2.5] animate-spin" />
          </span>
          <span className="max-w-[100px] truncate tracking-tight">
            {primaryMgr}
          </span>
        </button>
      )
    }

    // Upcoming step (chưa tới lượt)
    return (
      <span
        className="inline-flex items-center gap-1 text-[11px] text-slate-400"
        title={`Chờ duyệt: ${primaryMgr}`}
      >
        <span className="h-1.5 w-1.5 rounded-full bg-slate-200" />
        <span className="max-w-[95px] truncate">{primaryMgr}</span>
      </span>
    )
  }

  return (
    <div className="flex h-full min-h-0 w-full flex-1 flex-col overflow-hidden bg-[#eaedf0] p-2.5 text-slate-900 sm:p-3 dark:bg-[#121214] dark:text-[#F1F2F4]">
      {/* ========================================================================= */}
      {/* COCKPIT TOOLBAR (Single-row sleek command center)                         */}
      {/* ========================================================================= */}
      <div className="mb-2.5 flex shrink-0 flex-wrap items-center justify-between gap-3 rounded-lg border border-[#e2e6eb] bg-white px-3.5 py-2 sm:h-12">
        {/* Left: Section Identity + Segmented Status Tabs */}
        <div className="flex min-w-0 flex-wrap items-center gap-3">
          <div className="flex shrink-0 items-center gap-2">
            <span className="h-2 w-2 rounded-full bg-rose-600" />
            <span className="whitespace-nowrap text-xs font-black uppercase tracking-wider text-slate-900">
              {t.nav.requests}
            </span>
          </div>

          <div className="hidden h-4 w-px bg-slate-200 sm:block" />

          {/* Segmented Status Pill Tabs */}
          <div className="inline-flex h-8 items-center rounded-md border border-[#e2e6eb] bg-[#f8f9fb] p-0.5">
            {(
              [
                { id: 'all', label: t.tabs.all, count: tabCounts.all, show: true },
                {
                  id: 'todo',
                  label: t.tabs.todo,
                  count: tabCounts.todo,
                  show: tabCounts.todo > 0,
                },
                {
                  id: 'processing',
                  label: t.tabs.processing,
                  count: tabCounts.processing,
                  show: true,
                },
                {
                  id: 'completed',
                  label: t.tabs.completed,
                  count: tabCounts.completed,
                  show: true,
                },
                {
                  id: 'declined',
                  label: t.tabs.declined,
                  count: tabCounts.declined,
                  show: true,
                },
              ] as { id: StatusTab; label: string; count: number; show: boolean }[]
            )
              .filter((tab) => tab.show)
              .map((tab) => {
                const active = activeTab === tab.id
                return (
                  <button
                    key={tab.id}
                    type="button"
                    onClick={() => setActiveTab(tab.id)}
                    className={`flex h-7 cursor-pointer items-center space-x-1.5 rounded px-2.5 text-xs font-bold transition-all active:scale-[0.98] ${
                      active
                        ? 'border border-[#d0d5dd] bg-white text-slate-900 shadow-2xs'
                        : 'text-slate-500 hover:text-slate-900'
                    }`}
                  >
                    <span>{tab.label}</span>
                    <span
                      className={`rounded px-1.5 py-0.2 tabular-nums text-[10px] font-extrabold ${
                        tab.id === 'todo' && tab.count > 0
                          ? 'bg-rose-600 text-white'
                          : active
                            ? 'bg-rose-50 text-rose-700'
                            : 'bg-slate-200/80 text-slate-600'
                      }`}
                    >
                      {tab.count}
                    </span>
                  </button>
                )
              })}
          </div>
        </div>

        {/* Right: Quick Search & Primary Actions */}
        <div className="flex flex-1 flex-wrap items-center justify-end gap-2 sm:flex-initial">
          <div className="relative w-64 sm:w-80">
            <Search className="pointer-events-none absolute left-2.5 top-2 h-3.5 w-3.5 text-slate-400" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder={t.common.search}
              className="h-8 w-full rounded-md border border-[#d0d5dd] bg-[#f8f9fb] pl-8 pr-7 text-xs font-medium text-slate-800 outline-none transition-colors focus:border-slate-800 focus:bg-white"
            />
            {searchQuery && (
              <button
                type="button"
                onClick={() => setSearchQuery('')}
                className="absolute right-2 top-2 text-slate-400 hover:text-slate-600"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            )}
          </div>

          {activeFilterCount > 0 && (
            <button
              type="button"
              onClick={clearAllColumnFilters}
              className="inline-flex h-8 cursor-pointer items-center gap-1 rounded-md border border-rose-300 bg-rose-50 px-2.5 text-xs font-bold text-rose-700 transition-colors hover:bg-rose-100"
            >
              <RotateCcw className="h-3.5 w-3.5" />
              <span>
                {t.common.clearFilter} ({activeFilterCount})
              </span>
            </button>
          )}

          <div className="hidden h-4 w-px bg-slate-200 sm:block" />

          <button
            type="button"
            onClick={loadData}
            disabled={loading}
            className="flex h-8 w-8 cursor-pointer items-center justify-center rounded-md border border-[#d0d5dd] bg-white text-slate-700 transition-colors hover:bg-slate-50"
            title={t.common.refresh}
          >
            <RefreshCw
              className={`h-3.5 w-3.5 ${loading ? 'animate-spin text-rose-600' : ''}`}
            />
          </button>

          <a
            href="/api/vgDorm/export?type=accom_book"
            className="inline-flex h-8 cursor-pointer items-center gap-1.5 rounded-md border border-[#d0d5dd] bg-white px-3 text-xs font-bold text-slate-700 transition-colors hover:bg-slate-50"
          >
            <Download className="h-3.5 w-3.5 text-slate-600" />
            <span>{t.common.exportExcel}</span>
          </a>

          <button
            type="button"
            onClick={() => setCreateOpen(true)}
            className="inline-flex h-8 shrink-0 cursor-pointer items-center gap-1.5 rounded-md bg-rose-600 px-3.5 text-xs font-bold text-white transition-colors hover:bg-rose-700 active:bg-rose-800"
          >
            <Plus className="h-3.5 w-3.5 text-white stroke-[2.5]" />
            <span>{t.common.createRequest}</span>
          </button>
        </div>
      </div>

      {/* ========================================================================= */}
      {/* FULL-PAGE STICKY HEADER TABLE CONTAINER                                   */}
      {/* ========================================================================= */}
      <div className="flex min-h-0 w-full flex-1 flex-col overflow-hidden rounded-lg border border-[#e2e6eb] bg-white">
        <div className="custom-scrollbar min-h-0 flex-1 overflow-x-auto overflow-y-auto">
          <table className="w-full whitespace-nowrap text-left text-xs">
            <thead className="sticky top-0 z-20 border-b border-[#d0d5dd] bg-[#edf0f4]">
              <tr className="select-none text-[11px] font-black uppercase tracking-wider text-slate-700">
                <th className="w-16 px-3 py-2.5">
                  <ExcelColumnFilter
                    colKey="id"
                    label={t.table.id}
                    uniqueValues={getUniqueValues('id')}
                    selectedValues={columnFilters['id']}
                    sortDirection={
                      sortConfig.key === 'id' ? sortConfig.direction : null
                    }
                    onApplyFilter={setFilterForColumn}
                    onSort={toggleSort}
                  />
                </th>
                <th className="px-3 py-2.5">
                  <ExcelColumnFilter
                    colKey="key_in_date"
                    label={t.table.keyInDate}
                    uniqueValues={getUniqueValues('key_in_date')}
                    selectedValues={columnFilters['key_in_date']}
                    sortDirection={
                      sortConfig.key === 'key_in_date'
                        ? sortConfig.direction
                        : null
                    }
                    onApplyFilter={setFilterForColumn}
                    onSort={toggleSort}
                  />
                </th>
                <th className="px-3 py-2.5">
                  <ExcelColumnFilter
                    colKey="creator"
                    label={t.table.submitter}
                    uniqueValues={getUniqueValues('creator')}
                    selectedValues={columnFilters['creator']}
                    sortDirection={
                      sortConfig.key === 'creator' ? sortConfig.direction : null
                    }
                    onApplyFilter={setFilterForColumn}
                    onSort={toggleSort}
                  />
                </th>
                <th className="px-3 py-2.5">
                  <ExcelColumnFilter
                    colKey="dept"
                    label={t.table.dept}
                    uniqueValues={getUniqueValues('dept')}
                    selectedValues={columnFilters['dept']}
                    sortDirection={
                      sortConfig.key === 'dept' ? sortConfig.direction : null
                    }
                    onApplyFilter={setFilterForColumn}
                    onSort={toggleSort}
                  />
                </th>
                <th className="px-3 py-2.5">
                  <ExcelColumnFilter
                    colKey="occupants"
                    label={t.table.occupants}
                    uniqueValues={getUniqueValues('occupants')}
                    selectedValues={columnFilters['occupants']}
                    sortDirection={
                      sortConfig.key === 'occupants'
                        ? sortConfig.direction
                        : null
                    }
                    onApplyFilter={setFilterForColumn}
                    onSort={toggleSort}
                  />
                </th>
                <th className="px-3 py-2.5">{t.table.reason}</th>
                <th className="px-3 py-2.5 text-center">
                  <ExcelColumnFilter
                    colKey="roomStatus"
                    label={t.table.roomStatus}
                    uniqueValues={getUniqueValues('roomStatus')}
                    selectedValues={columnFilters['roomStatus']}
                    sortDirection={
                      sortConfig.key === 'roomStatus'
                        ? sortConfig.direction
                        : null
                    }
                    onApplyFilter={setFilterForColumn}
                    onSort={toggleSort}
                  />
                </th>
                <th className="px-3 py-2.5 text-center">
                  {t.table.deptApproval}
                </th>
                <th className="px-3 py-2.5 text-center">
                  {t.table.gaApproval}
                </th>
                <th className="px-3 py-2.5 text-center">
                  {t.table.smpApproval}
                </th>
                <th className="px-3 py-2.5 text-center">
                  {t.table.gmApproval}
                </th>
                <th className="px-3 py-2.5 text-center">{t.common.actions}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#e2e6eb] dark:divide-[#222228]">
              {paginatedRows.length === 0 ? (
                <tr>
                  <td
                    colSpan={12}
                    className="py-16 text-center text-sm text-slate-400"
                  >
                    {loading ? t.common.loading : t.common.noData}
                  </td>
                </tr>
              ) : (
                paginatedRows.map((req) => {
                  const firstOcc = req.personnel[0]
                  const extraCount = Math.max(0, req.personnel.length - 1)
                  const roomsList = Array.from(
                    new Set(
                      req.personnel
                        .map((p) => p.room)
                        .filter((r) => r && r.trim() !== '')
                    )
                  )

                  return (
                    <tr
                      key={req.id}
                      className="group border-b border-[#e5e9ee] transition-colors hover:bg-slate-50/90"
                    >
                      {/* ID */}
                      <td className="px-3.5 py-2.5 font-mono text-[11px] font-bold text-sky-800">
                        <span className="rounded bg-sky-50 px-1.5 py-0.5 border border-sky-200/70">
                          #{req.id}
                        </span>
                      </td>

                      {/* Date */}
                      <td className="px-3.5 py-2.5 font-mono text-[11px] tabular-nums text-slate-500">
                        {req.key_in_date}
                      </td>

                      {/* Submitter */}
                      <td className="px-3.5 py-2.5">
                        <div className="font-bold text-[12px] uppercase tracking-tight text-slate-900 group-hover:text-rose-600 transition-colors">
                          {req.creator_name}
                        </div>
                        <div className="flex items-center gap-1 font-mono text-[10px] text-slate-400">
                          <span>{req.creator_empno}</span>
                          {req.creator_phone && (
                            <>
                              <span>·</span>
                              <span>Ext: {req.creator_phone}</span>
                            </>
                          )}
                        </div>
                      </td>

                      {/* Dept */}
                      <td className="px-3.5 py-2.5">
                        <span className="inline-block rounded-md border border-slate-200 bg-[#f4f6f8] px-2 py-0.5 font-mono text-[10.5px] font-bold text-slate-700">
                          {req.creator_dept || '-'}
                        </span>
                      </td>

                      {/* Occupants */}
                      <td className="px-3.5 py-2.5">
                        <button
                          type="button"
                          onClick={() => setRoomModalRequest(req)}
                          className="inline-flex cursor-pointer items-center gap-2 rounded-lg border border-[#d8dce2] bg-white px-2.5 py-1 text-left shadow-2xs transition-all hover:border-sky-400 hover:bg-sky-50/40 active:scale-[0.98]"
                        >
                          <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-md bg-sky-50 text-sky-600 border border-sky-200/60">
                            <Users className="h-3.5 w-3.5" />
                          </div>
                          <div>
                            <div className="flex items-center gap-1.5 text-[11.5px] font-bold uppercase tracking-tight text-slate-800">
                              <span>{firstOcc ? firstOcc.name : 'Chưa có người ở'}</span>
                              {extraCount > 0 && (
                                <span className="rounded bg-sky-600 px-1.5 py-0.2 font-mono text-[10px] font-extrabold text-white">
                                  +{extraCount}
                                </span>
                              )}
                            </div>
                            <div className="font-mono text-[10px] text-slate-500">
                              {req.occupantCount} người ·{' '}
                              <span className="uppercase font-semibold text-slate-600">
                                {firstOcc?.nation || 'VNM'}
                              </span>{' '}
                              (
                              <span className="uppercase text-slate-600">
                                {firstOcc?.status || 'VG'}
                              </span>
                              )
                            </div>
                          </div>
                        </button>
                      </td>

                      {/* Reason */}
                      <td className="max-w-[200px] truncate px-3.5 py-2.5 text-[11.5px] text-slate-600">
                        <span title={req.reason}>{req.reason || '—'}</span>
                      </td>

                      {/* Room Assignment Status */}
                      <td className="px-3.5 py-2.5 text-center">
                        <button
                          type="button"
                          onClick={() => setRoomModalRequest(req)}
                          className={`inline-flex h-6 items-center gap-1.5 rounded-full px-2.5 text-[11px] font-bold shadow-2xs transition-all hover:opacity-90 active:scale-95 ${
                            roomsList.length > 0
                              ? 'border border-emerald-300 bg-emerald-50 text-emerald-800'
                              : 'border border-amber-300 bg-amber-50 text-amber-800'
                          }`}
                        >
                          <BedDouble className="h-3 w-3 shrink-0" />
                          {roomsList.length > 0 ? (
                            <span className="font-mono tracking-tight">
                              {roomsList.slice(0, 2).join(', ')}
                              {roomsList.length > 2
                                ? ` +${roomsList.length - 2}`
                                : ''}
                            </span>
                          ) : (
                            <span className="tracking-tight">
                              Xếp phòng ({req.assignedRoomCount}/{req.occupantCount})
                            </span>
                          )}
                        </button>
                      </td>

                      {/* 4 Approval Levels */}
                      <td className="px-3 py-2 text-center">
                        {renderStepCell(req, 0, t.flow.deptManager)}
                      </td>
                      <td className="px-3 py-2 text-center">
                        {renderStepCell(req, 1, t.flow.gaManager)}
                      </td>
                      <td className="px-3 py-2 text-center">
                        {renderStepCell(req, 2, t.flow.smpManager)}
                      </td>
                      <td className="px-3 py-2 text-center">
                        {renderStepCell(req, 3, t.flow.gmManager)}
                      </td>

                      {/* Actions */}
                      <td className="px-3.5 py-2.5 text-center">
                        <div className="inline-flex items-center gap-1">
                          <button
                            type="button"
                            onClick={() => setSelectedRequest(req)}
                            className="inline-flex h-6.5 items-center gap-1 rounded border border-[#d0d5dd] bg-white px-2.5 text-[11px] font-bold text-slate-700 transition-colors hover:border-slate-800 hover:text-slate-900 active:scale-95"
                            title="Xem chi tiết & phê duyệt"
                          >
                            <Eye className="h-3 w-3 text-slate-500" />
                            <span>{t.common.viewDetails}</span>
                          </button>
                        </div>
                      </td>
                    </tr>
                  )
                })
              )}
            </tbody>
          </table>
        </div>

        {/* Sticky Bottom Pagination Bar */}
        <div className="flex shrink-0 flex-wrap items-center justify-between gap-2 border-t border-[#d8dce2] bg-[#f1f3f6] px-3.5 py-2 text-xs dark:border-[#26262C] dark:bg-[#131316]">
          <div className="flex items-center gap-2 text-slate-600 dark:text-slate-400">
            <span>
              {t.common.showing}{' '}
              <strong className="text-slate-900 dark:text-white">
                {filteredData.length === 0 ? 0 : (page - 1) * rowsPerPage + 1}
              </strong>{' '}
              –{' '}
              <strong className="text-slate-900 dark:text-white">
                {Math.min(page * rowsPerPage, filteredData.length)}
              </strong>{' '}
              {t.common.of}{' '}
              <strong className="text-slate-900 dark:text-white">
                {filteredData.length}
              </strong>{' '}
              {t.common.records}
            </span>
            <select
              value={rowsPerPage}
              onChange={(e) => {
                setRowsPerPage(Number(e.target.value))
                setPage(1)
              }}
              className="ml-2 h-7 rounded-md border border-[#d0d5dd] bg-white px-2 text-xs font-semibold dark:border-[#26262C] dark:bg-[#18181C]"
            >
              {[20, 30, 50, 100].map((size) => (
                <option key={size} value={size}>
                  {size} / trang
                </option>
              ))}
            </select>
          </div>

          <div className="flex items-center gap-1.5">
            <button
              type="button"
              disabled={page <= 1}
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              className="inline-flex h-7 items-center gap-1 rounded-md border border-[#d0d5dd] bg-white px-2.5 font-semibold text-slate-700 hover:bg-slate-100 disabled:opacity-40 dark:border-[#26262C] dark:bg-[#18181C] dark:text-slate-200"
            >
              <ChevronLeft className="h-3.5 w-3.5" />
              <span>Trước</span>
            </button>
            <span className="px-2 tabular-nums font-bold text-slate-700 dark:text-slate-300">
              {page} / {totalPages}
            </span>
            <button
              type="button"
              disabled={page >= totalPages}
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              className="inline-flex h-7 items-center gap-1 rounded-md border border-[#d0d5dd] bg-white px-2.5 font-semibold text-slate-700 hover:bg-slate-100 disabled:opacity-40 dark:border-[#26262C] dark:bg-[#18181C] dark:text-slate-200"
            >
              <span>Sau</span>
              <ChevronRight className="h-3.5 w-3.5" />
            </button>
          </div>
        </div>
      </div>

      {/* Create Request Modal */}
      <RequestFormModal
        open={createOpen}
        mode="create"
        masterData={masterData}
        onClose={() => setCreateOpen(false)}
        onSuccess={handleRequestUpdated}
      />

      {/* View / Approve / Deny Request Modal */}
      <RequestFormModal
        open={Boolean(selectedRequest)}
        mode="view"
        request={selectedRequest}
        masterData={masterData}
        onClose={() => setSelectedRequest(null)}
        onSuccess={handleRequestUpdated}
      />

      {/* Occupant & Room Assignment Modal */}
      <OccupantRoomModal
        open={Boolean(roomModalRequest)}
        request={roomModalRequest}
        canEditRoom={
          Boolean(roomModalRequest) &&
          (user.empno === '038146' ||
            user.role === 'admin' ||
            isUserInApprovalFlow(roomModalRequest!, user.empno))
        }
        onClose={() => setRoomModalRequest(null)}
        onSaved={handleRequestUpdated}
      />

      {/* Approval Step Detail Popup */}
      {approvalInfoModal && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4 backdrop-blur-xs"
          role="dialog"
          aria-modal="true"
          onClick={() => setApprovalInfoModal(null)}
        >
          <div
            className="w-full max-w-sm rounded-2xl border border-[#d8dce2] bg-white p-5 shadow-2xl dark:border-[#26262C] dark:bg-[#18181C]"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between border-b border-slate-100 pb-3 dark:border-[#26262C]">
              <h4 className="text-sm font-bold text-slate-900 dark:text-white">
                Chi Tiết Ký Duyệt — Đơn #{approvalInfoModal.reqId}
              </h4>
              <button
                type="button"
                onClick={() => setApprovalInfoModal(null)}
                className="cursor-pointer text-slate-400 hover:text-slate-600"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
            <div className="mt-3 space-y-2 text-xs">
              <div className="flex justify-between">
                <span className="text-slate-600 dark:text-slate-400">Cấp duyệt:</span>
                <span className="font-bold text-slate-800 dark:text-slate-200">
                  {approvalInfoModal.stepLabel}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-600 dark:text-slate-400">Người ký:</span>
                <span className="font-bold text-slate-800 dark:text-slate-200">
                  {approvalInfoModal.info.name || '-'}{' '}
                  {approvalInfoModal.info.code
                    ? `(${approvalInfoModal.info.code})`
                    : ''}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-600 dark:text-slate-400">Thời gian:</span>
                <span className="font-mono tabular-nums text-slate-700 dark:text-slate-300">
                  {approvalInfoModal.info.date || '-'}
                </span>
              </div>
              {approvalInfoModal.info.reason && (
                <div className="rounded-xl bg-rose-50 p-2.5 text-rose-700 dark:bg-rose-950/60 dark:text-rose-300">
                  <strong>Lý do / Ghi chú:</strong>{' '}
                  {approvalInfoModal.info.reason}
                </div>
              )}
            </div>
            <div className="mt-4 flex justify-end">
              <button
                type="button"
                onClick={() => setApprovalInfoModal(null)}
                className="h-8 cursor-pointer rounded-lg bg-rose-600 px-4 text-xs font-bold text-white hover:bg-rose-700"
              >
                Đóng
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
