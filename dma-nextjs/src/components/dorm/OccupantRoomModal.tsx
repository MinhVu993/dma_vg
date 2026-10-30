'use client'

import React, { useState, useEffect } from 'react'
import { FormattedDormRequest, OccupantRecord } from '@/lib/flow-utils'
import { useTranslation } from '@/hooks/useTranslation'
import { useDialog } from '@/context/DialogContext'
import {
  X,
  BedDouble,
  QrCode,
  Download,
  Check,
  Save,
  Users,
  Calendar,
  FileText,
  Globe,
  MapPin,
} from 'lucide-react'

interface OccupantRoomModalProps {
  open: boolean
  request: FormattedDormRequest | null
  canEditRoom: boolean
  onClose: () => void
  onSaved: (updated: FormattedDormRequest) => void
}

export function OccupantRoomModal({
  open,
  request,
  canEditRoom,
  onClose,
  onSaved,
}: OccupantRoomModalProps) {
  const { t } = useTranslation()
  const { showToast } = useDialog()
  const [occupants, setOccupants] = useState<OccupantRecord[]>([])
  const [selectedIndices, setSelectedIndices] = useState<Set<number>>(new Set())
  const [bulkRoom, setBulkRoom] = useState('')
  const [saving, setSaving] = useState(false)
  const [previewQr, setPreviewQr] = useState<{
    name: string
    room: string
    qrPath: string
  } | null>(null)

  useEffect(() => {
    if (request && open) {
      setOccupants(request.personnel.map((p) => ({ ...p })))
      setSelectedIndices(new Set())
      setBulkRoom('')
    }
  }, [request, open])

  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') {
        if (previewQr) {
          setPreviewQr(null)
        } else {
          onClose()
        }
      }
    }
    if (open) {
      window.addEventListener('keydown', handleKeyDown)
    }
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [open, previewQr, onClose])

  if (!open || !request) return null

  const allSelected =
    occupants.length > 0 && selectedIndices.size === occupants.length

  const toggleAll = () => {
    if (allSelected) {
      setSelectedIndices(new Set())
    } else {
      setSelectedIndices(new Set(occupants.map((_, idx) => idx)))
    }
  }

  const toggleRow = (idx: number) => {
    const next = new Set(selectedIndices)
    if (next.has(idx)) next.delete(idx)
    else next.add(idx)
    setSelectedIndices(next)
  }

  const handleApplyBulkRoom = () => {
    if (!bulkRoom.trim()) {
      showToast('Vui lòng nhập số phòng', undefined, 'warning')
      return
    }
    const targetRoom = bulkRoom.trim().toUpperCase()
    setOccupants((prev) =>
      prev.map((occ, idx) => {
        if (selectedIndices.size === 0 || selectedIndices.has(idx)) {
          return { ...occ, room: targetRoom, room_no: targetRoom }
        }
        return occ
      })
    )
    showToast(
      `Đã điền phòng ${targetRoom}`,
      'Nhấn "Lưu Số Phòng & Tạo Mã QR" để cập nhật CSDL.',
      'info'
    )
  }

  const handleSaveRooms = async () => {
    setSaving(true)
    try {
      const res = await fetch('/api/vgDorm/updateRoomInName', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: request.id,
          name: occupants,
        }),
      })
      const data = await res.json()
      if (res.ok && data.data) {
        setOccupants(data.data.personnel)
        onSaved(data.data)
        showToast(
          'Cập nhật phòng & QR thành công!',
          `Đơn #${request.id} đã được lưu vào PostgreSQL vg_dma.`,
          'success'
        )
      } else {
        showToast(
          'Lỗi cập nhật phòng',
          data.details || 'Không thể lưu số phòng',
          'error'
        )
      }
    } catch (err: any) {
      showToast('Lỗi kết nối', err?.message, 'error')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={`Danh Sách Người Lưu Trú & Xếp Phòng — Đơn #${request.id}`}
      className="fixed inset-0 z-50 flex flex-col bg-[#eaedf0] dark:bg-[#121214]"
    >
      <div className="flex h-full w-full flex-col overflow-hidden bg-white dark:bg-[#18181C]">
        {/* Header */}
        <div className="flex shrink-0 items-center justify-between border-b border-[#d8dce2] bg-[#f1f3f6] px-4 py-2.5 sm:px-6 dark:border-[#26262C] dark:bg-[#131316]">
          <div className="flex items-center gap-3">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg border border-rose-500/20 bg-rose-500/10 text-rose-600 dark:text-rose-400">
              <Users className="h-4 w-4" />
            </div>
            <div>
              <h3 className="text-sm font-extrabold text-slate-900 sm:text-base dark:text-white">
                Danh Sách Người Lưu Trú & Xếp Phòng — Đơn #{request.id}
              </h3>
              <p className="text-[11px] text-slate-500 dark:text-slate-400">
                Người tạo: <strong>{request.creator_name}</strong> (
                {request.creator_dept}) · Ngày tạo: {request.key_in_date}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="inline-flex h-8 items-center gap-1.5 rounded-md border border-[#d0d5dd] bg-white px-3 text-xs font-bold text-slate-700 hover:bg-slate-100 dark:border-[#26262C] dark:bg-[#18181C] dark:text-slate-200"
          >
            <X className="h-4 w-4" />
            <span>{t.common.close} (Esc)</span>
          </button>
        </div>

        {/* Bulk Room Toolbar */}
        {canEditRoom && (
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[#d8dce2] bg-[#f8f9fb] px-4 py-2.5 sm:px-6 dark:border-[#26262C] dark:bg-[#18181C]">
            <div className="flex flex-wrap items-center gap-2">
              <BedDouble className="h-4 w-4 text-rose-600 dark:text-rose-400" />
              <span className="text-xs font-bold text-slate-700 dark:text-slate-200">
                {t.flow.setRoomBtn}:
              </span>
              <input
                type="text"
                value={bulkRoom}
                onChange={(e) => setBulkRoom(e.target.value)}
                placeholder={t.flow.bulkRoomPlaceholder}
                className="h-8 w-48 rounded-md border border-[#d0d5dd] bg-white px-3 text-xs font-semibold text-slate-800 outline-none focus:border-rose-500 dark:border-[#26262C] dark:bg-[#131316] dark:text-slate-100"
              />
              <button
                type="button"
                onClick={handleApplyBulkRoom}
                className="inline-flex h-8 items-center gap-1.5 rounded-md bg-slate-800 px-3 text-xs font-semibold text-white hover:bg-slate-700 dark:bg-slate-700 dark:hover:bg-slate-600"
              >
                <Check className="h-3.5 w-3.5" />
                {t.flow.applyBulkRoom}
                {selectedIndices.size > 0
                  ? ` (${selectedIndices.size} người)`
                  : ' (Tất cả)'}
              </button>
            </div>

            <button
              type="button"
              onClick={handleSaveRooms}
              disabled={saving}
              className="inline-flex h-8 items-center gap-1.5 rounded-md bg-rose-600 px-4 text-xs font-bold text-white shadow-xs hover:bg-rose-700 disabled:opacity-50"
            >
              <Save className="h-3.5 w-3.5" />
              {saving ? 'Đang lưu & tạo QR...' : 'Lưu Số Phòng & Tạo Mã QR'}
            </button>
          </div>
        )}

        {/* Occupants Table */}
        <div className="flex-1 overflow-auto p-4 sm:p-6">
          <div className="overflow-x-auto rounded-xl border border-[#d8dce2] dark:border-[#26262C]">
            <table className="w-full border-collapse text-left text-xs">
              <thead>
                <tr className="border-b border-[#d0d5dd] bg-[#e6e9ee] text-xs font-bold uppercase tracking-wider text-slate-700 dark:border-[#26262C] dark:bg-[#131316] dark:text-slate-300">
                  {canEditRoom && (
                    <th className="w-10 px-3 py-2.5 text-center">
                      <input
                        type="checkbox"
                        checked={allSelected}
                        onChange={toggleAll}
                        aria-label="Chọn tất cả người lưu trú"
                        className="h-3.5 w-3.5 rounded border-slate-300 accent-rose-600"
                      />
                    </th>
                  )}
                  <th className="w-10 px-3 py-2.5 text-center">STT</th>
                  <th className="px-3 py-2.5">{t.occupant.fullName}</th>
                  <th className="px-3 py-2.5 text-center">
                    {t.occupant.accomStatus}
                  </th>
                  <th className="px-3 py-2.5 text-center">
                    {t.occupant.gender}
                  </th>
                  <th className="px-3 py-2.5 text-center">
                    {t.occupant.birthDay}
                  </th>
                  <th className="px-3 py-2.5 text-center">
                    {t.occupant.nationality}
                  </th>
                  <th className="px-3 py-2.5">Giấy Tờ & Địa Chỉ</th>
                  <th className="px-3 py-2.5 text-center">Thời Gian Lưu Trú</th>
                  <th className="w-32 px-3 py-2.5 text-center">
                    {t.occupant.roomNo}
                  </th>
                  <th className="w-24 px-3 py-2.5 text-center">QR Pass</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#e2e6eb] dark:divide-[#222228]">
                {occupants.map((occ, idx) => (
                  <tr
                    key={idx}
                    className="hover:bg-slate-50/80 dark:hover:bg-[#202026]"
                  >
                    {canEditRoom && (
                      <td className="px-3 py-2.5 text-center">
                        <input
                          type="checkbox"
                          checked={selectedIndices.has(idx)}
                          onChange={() => toggleRow(idx)}
                          aria-label={`Chọn ${occ.name}`}
                          className="h-3.5 w-3.5 rounded border-slate-300 accent-rose-600"
                        />
                      </td>
                    )}
                    <td className="px-3 py-2.5 text-center tabular-nums text-slate-500">
                      {idx + 1}
                    </td>
                    <td className="px-3 py-2.5">
                      <div className="font-bold uppercase text-slate-900 dark:text-white">
                        {occ.name}
                      </div>
                      {occ.note && (
                        <div className="text-[11px] text-slate-500">
                          Ghi chú: {occ.note}
                        </div>
                      )}
                    </td>
                    <td className="px-3 py-2.5 text-center">
                      <span className="rounded bg-slate-100 px-2 py-0.5 font-semibold uppercase text-slate-700 dark:bg-slate-800 dark:text-slate-300">
                        {occ.status || 'VG'}
                      </span>
                    </td>
                    <td className="px-3 py-2.5 text-center">
                      <span
                        className={`rounded-md px-2 py-0.5 text-[11px] font-bold ${
                          occ.gender === 'F'
                            ? 'bg-rose-50 text-rose-700 dark:bg-rose-950/60 dark:text-rose-300'
                            : 'bg-sky-50 text-sky-700 dark:bg-sky-950/60 dark:text-sky-300'
                        }`}
                      >
                        {occ.gender === 'F' ? t.occupant.female : t.occupant.male}
                      </span>
                    </td>
                    <td className="px-3 py-2.5 text-center tabular-nums text-slate-600 dark:text-slate-300">
                      {occ.birthDay || '-'}
                    </td>
                    <td className="px-3 py-2.5 text-center">
                      <span className="inline-flex items-center gap-1 rounded bg-sky-50 px-2 py-0.5 font-bold text-sky-700 dark:bg-sky-950/60 dark:text-sky-300">
                        <Globe className="h-3 w-3" />
                        {occ.nation || 'VNM'}
                      </span>
                    </td>
                    <td className="px-3 py-2.5">
                      <div className="flex items-center gap-1 font-medium text-slate-700 dark:text-slate-200">
                        <FileText className="h-3 w-3 text-slate-400" />
                        <span>
                          {occ.typeDoc || 'Giấy tờ'}:{' '}
                          <strong className="tabular-nums">
                            {occ.numDoc || 'N/A'}
                          </strong>
                        </span>
                      </div>
                      {(occ.detailAddr || occ.prov_city) && (
                        <div className="mt-0.5 flex items-center gap-1 text-[11px] text-slate-500">
                          <MapPin className="h-3 w-3 shrink-0 text-slate-400" />
                          <span>
                            {[occ.detailAddr, occ.ward_com, occ.prov_city]
                              .filter(Boolean)
                              .join(', ')}
                          </span>
                        </div>
                      )}
                    </td>
                    <td className="px-3 py-2.5 text-center tabular-nums">
                      <div className="inline-flex items-center gap-1 text-slate-700 dark:text-slate-200">
                        <Calendar className="h-3 w-3 text-sky-600" />
                        <span>{occ.startDate || '-'}</span>
                        <span>→</span>
                        <span>{occ.endDate || '-'}</span>
                      </div>
                    </td>
                    <td className="px-3 py-2.5 text-center">
                      {canEditRoom ? (
                        <input
                          type="text"
                          value={occ.room || ''}
                          onChange={(e) => {
                            const val = e.target.value.toUpperCase()
                            setOccupants((prev) =>
                              prev.map((item, i) =>
                                i === idx
                                  ? { ...item, room: val, room_no: val }
                                  : item
                              )
                            )
                          }}
                          placeholder="Chưa xếp..."
                          className="h-7 w-24 rounded-md border border-[#d0d5dd] bg-white px-2 text-center tabular-nums text-xs font-bold text-sky-700 outline-none focus:border-rose-500 dark:border-[#26262C] dark:bg-[#131316] dark:text-sky-300"
                        />
                      ) : occ.room ? (
                        <span className="rounded-md bg-emerald-50 px-2.5 py-1 tabular-nums font-bold text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-300">
                          {occ.room}
                        </span>
                      ) : (
                        <span className="text-[11px] italic text-amber-600">
                          Chưa xếp
                        </span>
                      )}
                    </td>
                    <td className="px-3 py-2.5 text-center">
                      {occ.qrCode || occ.room ? (
                        <button
                          type="button"
                          onClick={() =>
                            setPreviewQr({
                              name: occ.name,
                              room: occ.room || 'Assigned',
                              qrPath:
                                occ.qrCode ||
                                `dma/${request.id}_${occ.name}.png`,
                            })
                          }
                          className="inline-flex items-center gap-1 rounded-md border border-[#d8dce2] bg-white px-2 py-1 text-[11px] font-semibold text-slate-700 hover:bg-slate-100 dark:border-[#26262C] dark:bg-[#131316] dark:text-slate-200"
                        >
                          <QrCode className="h-3.5 w-3.5 text-rose-600" />
                          <span>QR</span>
                        </button>
                      ) : (
                        <span className="text-[11px] text-slate-400">—</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Footer */}
        <div className="flex shrink-0 items-center justify-between border-t border-[#d8dce2] bg-[#f1f3f6] px-4 py-2.5 sm:px-6 dark:border-[#26262C] dark:bg-[#131316]">
          <div className="text-xs text-slate-600 dark:text-slate-400">
            Tổng cộng: <strong>{occupants.length}</strong> người lưu trú (Đã xếp
            phòng:{' '}
            <strong className="text-emerald-600">
              {occupants.filter((o) => o.room && o.room.trim() !== '').length}
            </strong>
            )
          </div>
          <div className="flex items-center gap-2">
            <a
              href={`/api/vgDorm/export?type=accom_book&requestId=${request.id}`}
              className="inline-flex h-8 items-center gap-1.5 rounded-md border border-[#d0d5dd] bg-white px-3 text-xs font-semibold text-slate-700 hover:bg-slate-100 dark:border-[#26262C] dark:bg-[#18181C] dark:text-slate-200"
            >
              <Download className="h-3.5 w-3.5 text-emerald-600" />
              <span>Xuất Sổ Lưu Trú (Đơn #{request.id})</span>
            </a>
            <button
              type="button"
              onClick={onClose}
              className="h-8 rounded-md bg-slate-800 px-4 text-xs font-bold text-white hover:bg-slate-700 dark:bg-slate-700"
            >
              {t.common.close}
            </button>
          </div>
        </div>
      </div>

      {/* QR Code Preview Modal */}
      {previewQr && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-slate-900/60 p-4">
          <div className="w-full max-w-sm rounded-xl border border-[#d8dce2] bg-white p-6 text-center shadow-2xl dark:border-[#26262C] dark:bg-[#18181C]">
            <h4 className="text-base font-extrabold text-slate-900 dark:text-white">
              Thẻ QR Lưu Trú Ký Túc Xá
            </h4>
            <p className="mt-1 text-xs text-slate-500">
              {previewQr.name} · Phòng:{' '}
              <strong className="text-rose-600">{previewQr.room}</strong>
            </p>
            <div className="my-4 flex justify-center">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={`/api/vgDorm/getQRCode/${previewQr.qrPath}`}
                alt={previewQr.name}
                width={224}
                height={224}
                className="h-56 w-56 rounded-lg border border-slate-200 p-2 shadow-inner"
              />
            </div>
            <div className="flex justify-center gap-2">
              <a
                href={`/api/vgDorm/getQRCode/${previewQr.qrPath}`}
                download={`QR_${request.id}_${previewQr.name}.png`}
                className="inline-flex h-8 items-center gap-1.5 rounded-md bg-rose-600 px-4 text-xs font-bold text-white hover:bg-rose-700"
              >
                <Download className="h-3.5 w-3.5" />
                Tải ảnh QR
              </a>
              <button
                type="button"
                onClick={() => setPreviewQr(null)}
                className="h-8 rounded-md border border-[#d0d5dd] px-4 text-xs font-semibold text-slate-600 hover:bg-slate-50 dark:border-[#26262C] dark:text-slate-300"
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
