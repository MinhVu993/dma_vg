'use client'

import React, { useState, useEffect, useMemo, useCallback } from 'react'
import { FormattedDormRequest } from '@/lib/flow-utils'
import { useTranslation } from '@/hooks/useTranslation'
import { OccupantRoomModal } from '@/components/dorm/OccupantRoomModal'
import {
  BedDouble,
  Search,
  Users,
  Calendar,
  AlertCircle,
  MapPin,
  RefreshCw,
  LayoutGrid,
  Table as TableIcon,
  ChevronLeft,
  ChevronRight,
} from 'lucide-react'

export default function RoomsManagementPage() {
  const { t } = useTranslation()
  const [requests, setRequests] = useState<FormattedDormRequest[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [filterMode, setFilterMode] = useState<
    'all' | 'assigned' | 'unassigned'
  >('all')
  const [viewMode, setViewMode] = useState<'grid' | 'table'>('grid')
  const [unassignedStatusFilter, setUnassignedStatusFilter] = useState<
    'ALL' | 'COMPLETED' | 'PENDING'
  >('ALL')
  const [selectedReq, setSelectedReq] = useState<FormattedDormRequest | null>(
    null
  )
  const [tablePage, setTablePage] = useState(1)
  const [tableRowsPerPage, setTableRowsPerPage] = useState(20)
  const [unassignedPage, setUnassignedPage] = useState(1)
  const [unassignedRowsPerPage, setUnassignedRowsPerPage] = useState(15)

  const loadData = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch('/api/vgDorm/getAllData')
      if (res.ok) {
        setRequests(await res.json())
      }
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    loadData()
  }, [loadData])

  // Group all personnel by room number
  const { roomGroups, unassignedList } = useMemo(() => {
    const groupsMap = new Map<
      string,
      {
        roomNo: string
        occupants: {
          req: FormattedDormRequest
          name: string
          gender: string
          nation: string
          startDate: string
          endDate: string
          status: string
          qrCode: string
        }[]
      }
    >()
    const unassigned: {
      req: FormattedDormRequest
      name: string
      gender: string
      nation: string
      startDate: string
      endDate: string
    }[] = []

    const q = search.trim().toLowerCase()

    requests.forEach((req) => {
      if (req.db_status === 'DENIED') return
      req.personnel.forEach((p) => {
        const room = (p.room || '').trim().toUpperCase()
        const matchesQuery =
          !q ||
          room.toLowerCase().includes(q) ||
          (p.name || '').toLowerCase().includes(q) ||
          (p.nation || '').toLowerCase().includes(q) ||
          String(req.id).includes(q)

        if (!matchesQuery) return

        if (!room) {
          unassigned.push({
            req,
            name: p.name,
            gender: p.gender,
            nation: p.nation,
            startDate: p.startDate,
            endDate: p.endDate,
          })
        } else {
          if (!groupsMap.has(room)) {
            groupsMap.set(room, { roomNo: room, occupants: [] })
          }
          groupsMap.get(room)!.occupants.push({
            req,
            name: p.name,
            gender: p.gender,
            nation: p.nation,
            startDate: p.startDate,
            endDate: p.endDate,
            status: p.status,
            qrCode: p.qrCode,
          })
        }
      })
    })

    const filteredUnassigned = unassigned
      .filter((item) => {
        if (unassignedStatusFilter === 'ALL') return true
        return item.req.db_status === unassignedStatusFilter
      })
      .sort((a, b) => {
        // Sort earliest startDate first (overdue items appear on top)
        if (!a.startDate) return 1
        if (!b.startDate) return -1
        return a.startDate.localeCompare(b.startDate)
      })

    const sortedRooms = Array.from(groupsMap.values()).sort((a, b) =>
      a.roomNo.localeCompare(b.roomNo, undefined, { numeric: true })
    )

    return { roomGroups: sortedRooms, unassignedList: filteredUnassigned, totalUnassigned: unassigned.length }
  }, [requests, search, unassignedStatusFilter])

  // Pagination for Rooms (Applicable for both Grid & Table)
  const paginatedRooms = useMemo(() => {
    const start = (tablePage - 1) * tableRowsPerPage
    return roomGroups.slice(start, start + tableRowsPerPage)
  }, [roomGroups, tablePage, tableRowsPerPage])

  // Pagination for Unassigned Queue
  const paginatedUnassigned = useMemo(() => {
    const start = (unassignedPage - 1) * unassignedRowsPerPage
    return unassignedList.slice(start, start + unassignedRowsPerPage)
  }, [unassignedList, unassignedPage, unassignedRowsPerPage])

  // Reset page when search or filters change
  useEffect(() => {
    setTablePage(1)
    setUnassignedPage(1)
  }, [search, filterMode, unassignedStatusFilter])

  return (
    <div className="flex h-full min-h-0 w-full flex-1 flex-col overflow-hidden bg-[#eaedf0] p-2.5 text-slate-900 sm:p-3 dark:bg-[#121214] dark:text-[#F1F2F4]">
      {/* Cockpit Toolbar */}
      <div className="mb-2.5 flex shrink-0 flex-wrap items-center justify-between gap-2.5 rounded-xl border border-[#d8dce2] bg-white px-3.5 py-2 shadow-xs">
        <div className="flex items-center space-x-2.5">
          <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-rose-500/10 text-rose-600">
            <BedDouble className="h-4 w-4" />
          </div>
          <div>
            <h1 className="text-xs font-black uppercase tracking-wider text-slate-800">
              {t.nav.rooms}
            </h1>
            <p className="text-[10.5px] text-slate-500">
              Quản lý công suất phòng & danh sách cư trú Ký túc xá VG
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <div className="relative w-64">
            <Search className="pointer-events-none absolute left-2.5 top-2 h-3.5 w-3.5 text-slate-400" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Tìm số phòng, tên người, mã đơn..."
              className="h-8 w-full rounded-lg border border-[#d0d5dd] bg-[#f8f9fb] pl-8 pr-3 text-xs font-medium text-slate-800 outline-none transition-colors focus:border-rose-500 focus:bg-white"
            />
          </div>

          <div className="inline-flex h-8 items-center rounded-lg border border-[#d0d5dd] bg-[#f1f3f6] p-0.5 shadow-2xs">
            <button
              type="button"
              onClick={() => setFilterMode('all')}
              className={`flex h-7 cursor-pointer items-center space-x-1.5 rounded-md px-3 text-xs font-bold transition-all active:scale-[0.98] ${
                filterMode === 'all'
                  ? 'border border-[#d0d5dd] bg-white text-rose-600 shadow-2xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Tất cả
            </button>
            <button
              type="button"
              onClick={() => setFilterMode('assigned')}
              className={`flex h-7 cursor-pointer items-center space-x-1.5 rounded-md px-3 text-xs font-bold transition-all active:scale-[0.98] ${
                filterMode === 'assigned'
                  ? 'border border-[#d0d5dd] bg-white text-emerald-600 shadow-2xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <span>Đã xếp</span>
              <span className="rounded bg-emerald-50 px-1.5 py-0.2 font-mono text-[10px] text-emerald-700">
                {roomGroups.length}
              </span>
            </button>
            <button
              type="button"
              onClick={() => setFilterMode('unassigned')}
              className={`flex h-7 cursor-pointer items-center space-x-1.5 rounded-md px-3 text-xs font-bold transition-all active:scale-[0.98] ${
                filterMode === 'unassigned'
                  ? 'border border-[#d0d5dd] bg-white text-amber-600 shadow-2xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <span>Chưa xếp</span>
              <span className="rounded bg-amber-50 px-1.5 py-0.2 font-mono text-[10px] text-amber-700">
                {unassignedList.length}
              </span>
            </button>
          </div>

          <button
            type="button"
            onClick={loadData}
            disabled={loading}
            className="flex h-8 w-8 cursor-pointer items-center justify-center rounded-lg border border-[#d0d5dd] bg-white text-slate-700 shadow-2xs transition-colors hover:bg-slate-50"
            title="Làm mới dữ liệu"
          >
            <RefreshCw
              className={`h-3.5 w-3.5 ${loading ? 'animate-spin text-rose-600' : ''}`}
            />
          </button>
        </div>
      </div>

      {/* 2-Column Split Cockpit Layout */}
      <div className="flex min-h-0 w-full flex-1 gap-2.5 overflow-hidden">
        {/* Left Column (35%): Unassigned Queue */}
        <div className="flex w-full flex-col overflow-hidden rounded-xl border border-[#d8dce2] bg-white shadow-xs md:w-[35%] lg:w-[32%] xl:w-[30%]">
          {/* Header & Status Filter */}
          <div className="shrink-0 border-b border-[#e2e6eb] bg-[#f8f9fb] px-3.5 py-2">
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-2">
                <span className="flex h-2 w-2 rounded-full bg-amber-500 animate-pulse" />
                <span className="text-xs font-bold uppercase tracking-wider text-slate-800">
                  Chờ Xếp Phòng
                </span>
              </div>
              <span className="rounded-full bg-amber-100 px-2 py-0.5 font-mono text-[11px] font-bold text-amber-800">
                {unassignedList.length} người
              </span>
            </div>

            {/* Sub-filter by Request Status */}
            <div className="flex items-center gap-1 rounded-md bg-[#edf0f4] p-0.5 text-[10.5px] font-bold">
              <button
                type="button"
                onClick={() => setUnassignedStatusFilter('ALL')}
                className={`flex-1 rounded py-1 transition-all ${
                  unassignedStatusFilter === 'ALL'
                    ? 'bg-white text-slate-800 shadow-2xs font-extrabold'
                    : 'text-slate-500 hover:text-slate-800'
                }`}
              >
                Tất cả
              </button>
              <button
                type="button"
                onClick={() => setUnassignedStatusFilter('COMPLETED')}
                className={`flex-1 rounded py-1 transition-all ${
                  unassignedStatusFilter === 'COMPLETED'
                    ? 'bg-white text-emerald-700 shadow-2xs font-extrabold'
                    : 'text-slate-500 hover:text-emerald-700'
                }`}
              >
                Đã duyệt xong
              </button>
              <button
                type="button"
                onClick={() => setUnassignedStatusFilter('PENDING')}
                className={`flex-1 rounded py-1 transition-all ${
                  unassignedStatusFilter === 'PENDING'
                    ? 'bg-white text-amber-700 shadow-2xs font-extrabold'
                    : 'text-slate-500 hover:text-amber-700'
                }`}
              >
                Đang duyệt
              </button>
            </div>
          </div>

          {/* Table Container */}
          <div className="custom-scrollbar min-h-0 flex-1 overflow-x-auto overflow-y-auto">
            {unassignedList.length === 0 ? (
              <div className="flex h-full flex-col items-center justify-center p-6 text-center text-slate-400">
                <BedDouble className="h-8 w-8 text-emerald-500 opacity-60" />
                <p className="mt-2 text-xs font-bold text-slate-700">
                  Tất cả người lưu trú đã có phòng!
                </p>
                <p className="text-[11px] text-slate-400">
                  Không còn đơn chờ xếp phòng.
                </p>
              </div>
            ) : (
              <table className="w-full text-left text-xs">
                <thead className="sticky top-0 z-10 border-b border-[#e2e6eb] bg-[#f1f3f6] text-[10px] font-bold uppercase tracking-wider text-slate-600">
                  <tr>
                    <th className="px-3 py-2">Đơn</th>
                    <th className="px-3 py-2">Họ & Tên</th>
                    <th className="px-2 py-2">Ngày đến</th>
                    <th className="px-3 py-2 text-center">Thao tác</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {paginatedUnassigned.map((item, idx) => {
                    const todayStr = new Date().toISOString().slice(0, 10)
                    const isOverdue = item.startDate && item.startDate < todayStr
                    const isToday = item.startDate && item.startDate === todayStr

                    let diffDays = 0
                    if (isOverdue) {
                      const dStart = new Date(item.startDate).getTime()
                      const dToday = new Date(todayStr).getTime()
                      diffDays = Math.max(
                        1,
                        Math.round((dToday - dStart) / (1000 * 60 * 60 * 24))
                      )
                    }

                    return (
                      <tr
                        key={idx}
                        className={`group transition-colors ${
                          isOverdue
                            ? 'bg-rose-50/30 hover:bg-rose-50/70'
                            : 'hover:bg-amber-50/50'
                        }`}
                      >
                        <td className="px-3 py-2 font-mono text-[11px] font-bold text-sky-700">
                          <div className="flex items-center gap-1">
                            <span>#{item.req.id}</span>
                            <span
                              className={`inline-block h-1.5 w-1.5 rounded-full ${
                                item.req.db_status === 'COMPLETED'
                                  ? 'bg-emerald-500'
                                  : 'bg-amber-500'
                              }`}
                              title={
                                item.req.db_status === 'COMPLETED'
                                  ? 'Đơn đã duyệt hoàn tất'
                                  : 'Đơn đang trong luồng phê duyệt'
                              }
                            />
                          </div>
                        </td>
                        <td className="px-3 py-2">
                          <div className="font-bold uppercase text-slate-800 group-hover:text-amber-800">
                            {item.name}
                          </div>
                          <div className="text-[10px] text-slate-500">
                            {item.nation} · {item.gender === 'F' ? 'Nữ' : 'Nam'}
                          </div>
                        </td>
                        <td className="px-2 py-2">
                          <div
                            className={`font-mono text-[11px] tabular-nums font-bold ${
                              isOverdue
                                ? 'text-rose-600'
                                : isToday
                                  ? 'text-amber-600'
                                  : 'text-slate-600'
                            }`}
                          >
                            {item.startDate}
                          </div>
                          {isOverdue && (
                            <span className="inline-flex items-center gap-0.5 rounded border border-rose-200 bg-rose-50 px-1 py-0.2 font-mono text-[9.5px] font-extrabold text-rose-700 shadow-2xs">
                              <AlertCircle className="h-2.5 w-2.5 shrink-0" />
                              <span>Quá hạn {diffDays} ngày</span>
                            </span>
                          )}
                          {isToday && (
                            <span className="inline-flex items-center gap-0.5 rounded border border-amber-200 bg-amber-50 px-1 py-0.2 font-mono text-[9.5px] font-extrabold text-amber-700">
                              <span>Đến hôm nay</span>
                            </span>
                          )}
                        </td>
                        <td className="px-3 py-2 text-center">
                          <button
                            type="button"
                            onClick={() => setSelectedReq(item.req)}
                            className={`inline-flex h-6 items-center gap-1 rounded-full px-2.5 text-[11px] font-bold shadow-2xs transition-all active:scale-95 ${
                              isOverdue
                                ? 'border border-rose-300 bg-rose-50 text-rose-700 hover:bg-rose-100'
                                : 'border border-amber-300 bg-amber-50 text-amber-800 hover:bg-amber-100'
                            }`}
                          >
                            Xếp ngay
                          </button>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            )}
          </div>

          {/* Sticky Bottom Pagination for Unassigned Queue */}
          {unassignedList.length > 0 && (
            <div className="flex shrink-0 items-center justify-between border-t border-[#e2e6eb] bg-[#f8f9fb] px-2.5 py-1.5 text-[11px]">
              <span className="font-mono text-slate-500">
                {(unassignedPage - 1) * unassignedRowsPerPage + 1}–
                {Math.min(unassignedPage * unassignedRowsPerPage, unassignedList.length)}
                /{unassignedList.length}
              </span>
              <div className="flex items-center gap-1">
                <button
                  type="button"
                  disabled={unassignedPage <= 1}
                  onClick={() => setUnassignedPage((p) => Math.max(1, p - 1))}
                  className="inline-flex h-5.5 items-center rounded border border-[#d0d5dd] bg-white px-1.5 font-bold text-slate-700 hover:bg-slate-100 disabled:opacity-40"
                >
                  <ChevronLeft className="h-3 w-3" />
                </button>
                <span className="px-1 font-mono font-bold text-slate-700">
                  {unassignedPage}/{Math.max(1, Math.ceil(unassignedList.length / unassignedRowsPerPage))}
                </span>
                <button
                  type="button"
                  disabled={
                    unassignedPage >=
                    Math.ceil(unassignedList.length / unassignedRowsPerPage)
                  }
                  onClick={() => setUnassignedPage((p) => p + 1)}
                  className="inline-flex h-5.5 items-center rounded border border-[#d0d5dd] bg-white px-1.5 font-bold text-slate-700 hover:bg-slate-100 disabled:opacity-40"
                >
                  <ChevronRight className="h-3 w-3" />
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Right Column (65%): Rooms Matrix */}
        <div className="flex min-h-0 flex-1 flex-col overflow-hidden rounded-xl border border-[#d8dce2] bg-white shadow-xs">
          {/* Header */}
          <div className="flex shrink-0 items-center justify-between border-b border-[#e2e6eb] bg-[#f8f9fb] px-3.5 py-2">
            <div className="flex items-center gap-2">
              <span className="flex h-2 w-2 rounded-full bg-emerald-500" />
              <span className="text-xs font-bold uppercase tracking-wider text-slate-800">
                Sơ Đồ Phòng Ký Túc Xá
              </span>
              <span className="text-[11px] text-slate-400">
                ({roomGroups.length} phòng đang sử dụng)
              </span>
            </div>

            {/* View Switcher: Grid vs Table */}
            <div className="flex items-center gap-1 rounded-md border border-[#d0d5dd] bg-[#edf0f4] p-0.5">
              <button
                type="button"
                onClick={() => setViewMode('grid')}
                className={`flex h-6.5 cursor-pointer items-center gap-1 rounded px-2 text-[11px] font-bold transition-all ${
                  viewMode === 'grid'
                    ? 'border border-[#d0d5dd] bg-white text-rose-600 shadow-2xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
                title="Dạng thẻ lưới (Grid View)"
              >
                <LayoutGrid className="h-3 w-3" />
                <span>Thẻ</span>
              </button>
              <button
                type="button"
                onClick={() => setViewMode('table')}
                className={`flex h-6.5 cursor-pointer items-center gap-1 rounded px-2 text-[11px] font-bold transition-all ${
                  viewMode === 'table'
                    ? 'border border-[#d0d5dd] bg-white text-rose-600 shadow-2xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
                title="Dạng danh sách bảng (Table View)"
              >
                <TableIcon className="h-3 w-3" />
                <span>Bảng</span>
              </button>
            </div>
          </div>

          {/* Matrix Content: Grid or Table */}
          <div className="custom-scrollbar min-h-0 flex-1 overflow-y-auto">
            {roomGroups.length === 0 ? (
              <div className="flex h-full items-center justify-center p-8 text-sm text-slate-400">
                Không tìm thấy phòng nào phù hợp.
              </div>
            ) : viewMode === 'grid' ? (
              <div className="p-3 grid grid-cols-1 gap-2.5 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5">
                {paginatedRooms.map((group) => (
                  <div
                    key={group.roomNo}
                    className="flex flex-col justify-between rounded-lg border border-[#e2e6eb] bg-white p-2.5 shadow-2xs transition-all hover:border-sky-400 hover:shadow-xs"
                  >
                    <div>
                      {/* Room Header */}
                      <div className="mb-2 flex items-center justify-between border-b border-slate-100 pb-1.5">
                        <div className="flex items-center gap-1.5">
                          <div className="flex h-6 w-6 items-center justify-center rounded-md bg-emerald-50 text-emerald-700 border border-emerald-200/70">
                            <BedDouble className="h-3 w-3" />
                          </div>
                          <span className="font-mono text-xs font-black uppercase text-slate-900">
                            Phòng {group.roomNo}
                          </span>
                        </div>
                        <span className="inline-flex items-center gap-1 rounded-full border border-emerald-200 bg-emerald-50 px-2 py-0.2 font-mono text-[10px] font-bold text-emerald-700">
                          <Users className="h-2.5 w-2.5" />
                          {group.occupants.length} người
                        </span>
                      </div>

                      {/* Room Occupants */}
                      <div className="max-h-36 space-y-1 overflow-y-auto pr-0.5">
                        {group.occupants.map((occ, oIdx) => (
                          <div
                            key={oIdx}
                            onClick={() => setSelectedReq(occ.req)}
                            className="group cursor-pointer rounded-md border border-slate-100 bg-[#f8f9fb] p-1.5 text-xs transition-colors hover:border-sky-300 hover:bg-sky-50/50"
                            title="Bấm để xem đơn và chỉnh sửa xếp phòng"
                          >
                            <div className="flex items-center justify-between font-bold text-slate-800">
                              <span className="truncate text-[11px] uppercase group-hover:text-sky-700">
                                {occ.name}
                              </span>
                              <span className="ml-1 font-mono text-[9.5px] text-sky-600">
                                #{occ.req.id}
                              </span>
                            </div>
                            <div className="mt-0.5 flex items-center justify-between font-mono text-[9.5px] text-slate-400">
                              <span>
                                {occ.nation} · {occ.gender === 'F' ? 'Nữ' : 'Nam'}
                              </span>
                              <span className="tabular-nums">
                                {occ.startDate}
                              </span>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              /* High-Density Modern Table View for Room Occupancy */
              <table className="w-full whitespace-nowrap text-left text-xs">
                <thead className="sticky top-0 z-10 border-b border-[#d0d5dd] bg-[#edf0f4]">
                  <tr className="select-none text-[11px] font-black uppercase tracking-wider text-slate-700">
                    <th className="w-24 px-3.5 py-2.5">Số Phòng</th>
                    <th className="w-28 px-3.5 py-2.5 text-center">Người Ở</th>
                    <th className="px-3.5 py-2.5">Chi Tiết Người Lưu Trú (Họ Tên · Quốc Tịch · Thời Gian · Đơn)</th>
                    <th className="w-24 px-3.5 py-2.5 text-center">Thao Tác</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#e2e6eb]">
                  {paginatedRooms.map((group) => (
                    <tr
                      key={group.roomNo}
                      className="group transition-colors hover:bg-slate-50/90"
                    >
                      {/* Room Number Badge */}
                      <td className="px-3.5 py-2">
                        <span className="inline-flex items-center gap-1.5 rounded-lg border border-emerald-300 bg-emerald-50/80 px-2.5 py-1 font-mono text-xs font-black text-emerald-800 shadow-2xs">
                          <BedDouble className="h-3.5 w-3.5 text-emerald-600" />
                          <span>P.{group.roomNo}</span>
                        </span>
                      </td>

                      {/* Headcount Badge */}
                      <td className="px-3.5 py-2 text-center">
                        <span className="inline-flex items-center gap-1 rounded-full border border-slate-200 bg-[#f4f6f8] px-2.5 py-0.5 font-mono text-[11px] font-bold text-slate-700">
                          <Users className="h-3 w-3 text-slate-500" />
                          <span>{group.occupants.length} người</span>
                        </span>
                      </td>

                      {/* Detailed Occupants Chips */}
                      <td className="px-3.5 py-2">
                        <div className="flex flex-wrap items-center gap-1.5">
                          {group.occupants.map((occ, oIdx) => (
                            <button
                              key={oIdx}
                              type="button"
                              onClick={() => setSelectedReq(occ.req)}
                              className="group/chip inline-flex cursor-pointer items-center gap-2 rounded-lg border border-[#d8dce2] bg-white px-2.5 py-1 text-left shadow-2xs transition-all hover:border-sky-400 hover:bg-sky-50 active:scale-[0.98]"
                              title={`Xem đơn #${occ.req.id} · Bấm để đổi phòng`}
                            >
                              <span className="font-bold text-[11.5px] uppercase text-slate-800 group-hover/chip:text-sky-700">
                                {occ.name}
                              </span>
                              <span className="rounded bg-slate-100 px-1.5 py-0.2 font-mono text-[10px] font-semibold text-slate-600">
                                {occ.nation} · {occ.gender === 'F' ? 'Nữ' : 'Nam'}
                              </span>
                              <span className="font-mono text-[10px] text-slate-400">
                                {occ.startDate}
                              </span>
                              <span className="font-mono text-[10px] font-bold text-sky-600">
                                #{occ.req.id}
                              </span>
                            </button>
                          ))}
                        </div>
                      </td>

                      {/* Action */}
                      <td className="px-3.5 py-2 text-center">
                        {group.occupants[0] && (
                          <button
                            type="button"
                            onClick={() => setSelectedReq(group.occupants[0].req)}
                            className="inline-flex h-6.5 items-center gap-1.5 rounded-full border border-rose-200 bg-rose-50 px-3 text-[11px] font-bold text-rose-700 shadow-2xs transition-all hover:bg-rose-100 hover:border-rose-300 active:scale-95"
                          >
                            Đổi phòng
                          </button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>

          {/* Sticky Bottom Pagination Bar for Rooms (Grid & Table) */}
          {roomGroups.length > 0 && (
            <div className="flex shrink-0 flex-wrap items-center justify-between gap-2 border-t border-[#d8dce2] bg-[#f1f3f6] px-3.5 py-2 text-xs">
              <div className="flex items-center gap-2 text-slate-600">
                <span>
                  Hiển thị{' '}
                  <strong className="text-slate-900">
                    {(tablePage - 1) * tableRowsPerPage + 1}
                  </strong>{' '}
                  –{' '}
                  <strong className="text-slate-900">
                    {Math.min(tablePage * tableRowsPerPage, roomGroups.length)}
                  </strong>{' '}
                  trên{' '}
                  <strong className="text-slate-900">{roomGroups.length}</strong>{' '}
                  phòng
                </span>
                <select
                  value={tableRowsPerPage}
                  onChange={(e) => {
                    setTableRowsPerPage(Number(e.target.value))
                    setTablePage(1)
                  }}
                  className="ml-2 h-6.5 rounded-md border border-[#d0d5dd] bg-white px-2 text-xs font-semibold"
                >
                  {[10, 20, 30, 50].map((size) => (
                    <option key={size} value={size}>
                      {size} phòng / trang
                    </option>
                  ))}
                </select>
              </div>

              <div className="flex items-center gap-1.5">
                <button
                  type="button"
                  disabled={tablePage <= 1}
                  onClick={() => setTablePage((p) => Math.max(1, p - 1))}
                  className="inline-flex h-6.5 items-center gap-1 rounded-md border border-[#d0d5dd] bg-white px-2.5 font-semibold text-slate-700 hover:bg-slate-100 disabled:opacity-40"
                >
                  <ChevronLeft className="h-3.5 w-3.5" />
                  <span>Trước</span>
                </button>
                <span className="px-2 font-mono text-xs font-bold text-slate-800">
                  {tablePage} / {Math.max(1, Math.ceil(roomGroups.length / tableRowsPerPage))}
                </span>
                <button
                  type="button"
                  disabled={
                    tablePage >= Math.ceil(roomGroups.length / tableRowsPerPage)
                  }
                  onClick={() => setTablePage((p) => p + 1)}
                  className="inline-flex h-6.5 items-center gap-1 rounded-md border border-[#d0d5dd] bg-white px-2.5 font-semibold text-slate-700 hover:bg-slate-100 disabled:opacity-40"
                >
                  <span>Sau</span>
                  <ChevronRight className="h-3.5 w-3.5" />
                </button>
              </div>
            </div>
          )}
        </div>
      </div>

      <OccupantRoomModal
        open={Boolean(selectedReq)}
        request={selectedReq}
        canEditRoom={true}
        onClose={() => setSelectedReq(null)}
        onSaved={(updated) => {
          setRequests((prev) =>
            prev.map((r) => (r.id === updated.id ? updated : r))
          )
        }}
      />
    </div>
  )
}
