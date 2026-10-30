'use client'

import React, { useState, useEffect } from 'react'
import {
  FormattedDormRequest,
  OccupantRecord,
  FlowStep,
  isUserPendingApprover,
} from '@/lib/flow-utils'
import { useSession } from '@/context/SessionContext'
import { useTranslation } from '@/hooks/useTranslation'
import { useDialog } from '@/context/DialogContext'
import { AppFlowStepper } from './AppFlowStepper'
import {
  X,
  Plus,
  Trash2,
  Copy,
  Send,
  CheckCircle2,
  XCircle,
  Building2,
  UserPlus,
} from 'lucide-react'

interface RequestFormModalProps {
  open: boolean
  mode: 'create' | 'view'
  request?: FormattedDormRequest | null
  masterData: any
  onClose: () => void
  onSuccess: (req: FormattedDormRequest) => void
}

function createEmptyOccupant(): OccupantRecord {
  const today = new Date().toISOString().slice(0, 10)
  return {
    name: '',
    status: 'VG',
    gender: 'M',
    birthDay: '1995-01-01',
    nation: 'VNM',
    startDate: today,
    endDate: today,
    typeDoc: 'Thẻ CCCD',
    numDoc: '',
    note: '',
    room: '',
    qrCode: '',
    res_reason: 'Làm việc',
    typeRes: 'Thường trú',
    prov_city: '',
    ward_com: '',
    detailAddr: '',
  }
}

export function RequestFormModal({
  open,
  mode,
  request,
  masterData,
  onClose,
  onSuccess,
}: RequestFormModalProps) {
  const { user } = useSession()
  const { t, locale } = useTranslation()
  const { showToast } = useDialog()

  const [extPhone, setExtPhone] = useState(user.ext || '')
  const [reason, setReason] = useState('')
  const [occupants, setOccupants] = useState<OccupantRecord[]>([
    createEmptyOccupant(),
  ])
  const [flowSteps, setFlowSteps] = useState<FlowStep[]>([])
  const [submitting, setSubmitting] = useState(false)
  const [denyPromptOpen, setDenyPromptOpen] = useState(false)
  const [denyReasonText, setDenyReasonText] = useState('')

  useEffect(() => {
    if (!open) return

    if (mode === 'view' && request) {
      setExtPhone(request.creator_phone || '')
      setReason(request.reason || '')
      setOccupants(
        request.personnel.length > 0
          ? request.personnel.map((p) => ({ ...p }))
          : [createEmptyOccupant()]
      )
      setFlowSteps(request.approval_flow || [])
    } else {
      setExtPhone(user.ext || '')
      setReason('')
      setOccupants([createEmptyOccupant()])

      // Resolve IFM approval flow for current user
      if (user.empno) {
        fetch('/api/vgDorm/getAppFlow', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ empno: user.empno, dept: user.dept }),
        })
          .then((r) => r.json())
          .then((data) => {
            if (Array.isArray(data)) setFlowSteps(data)
          })
          .catch(() => {})
      }
    }
  }, [open, mode, request, user.empno, user.dept, user.ext])

  useEffect(() => {
    if (!open) return
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        if (denyPromptOpen) {
          setDenyPromptOpen(false)
        } else {
          onClose()
        }
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [open, denyPromptOpen, onClose])

  if (!open) return null

  const locations = masterData?.locations || [
    { loc: 'VG' },
    { loc: 'TW' },
    { loc: 'Other' },
  ]
  const nations = masterData?.nations || []
  const provinces = masterData?.provinces || []
  const wards = masterData?.wards || []
  const docTypes = masterData?.doc_types || []
  const resReasons = masterData?.res_reasons || []
  const resTypes = masterData?.res_types || []

  const getLocalizedLabel = (obj: any, fallback: string) => {
    if (!obj) return fallback
    if (typeof obj === 'string') return obj
    return obj[locale] || obj.vi || obj.en || obj.cn || fallback
  }

  const updateOccupant = (
    idx: number,
    patch: Partial<OccupantRecord>
  ) => {
    setOccupants((prev) =>
      prev.map((item, i) => (i === idx ? { ...item, ...patch } : item))
    )
  }

  const handleCopyFirstRow = (idx: number) => {
    const first = occupants[0]
    if (!first) return
    updateOccupant(idx, {
      status: first.status,
      nation: first.nation,
      startDate: first.startDate,
      endDate: first.endDate,
      res_reason: first.res_reason,
      typeRes: first.typeRes,
      prov_city: first.prov_city,
      ward_com: first.ward_com,
      detailAddr: first.detailAddr,
    })
    showToast('Đã sao chép thông tin lưu trú từ dòng #1', undefined, 'info')
  }

  const handleAddRow = () => {
    if (occupants.length >= 30) {
      showToast('Tối đa 30 người lưu trú mỗi đơn', undefined, 'warning')
      return
    }
    setOccupants((prev) => [...prev, createEmptyOccupant()])
  }

  const handleRemoveRow = (idx: number) => {
    if (occupants.length <= 1) return
    setOccupants((prev) => prev.filter((_, i) => i !== idx))
  }

  const handleSubmitCreate = async (e: React.FormEvent) => {
    e.preventDefault()
    // Validate all submitter & reason fields
    if (!reason || !reason.trim()) {
      showToast(
        'Thiếu lý do lưu trú',
        'Vui lòng nhập lý do lưu trú (*)',
        'warning'
      )
      return
    }

    if (!extPhone || !extPhone.trim()) {
      showToast(
        'Thiếu số nội bộ / SĐT',
        'Vui lòng nhập số điện thoại hoặc số máy lẻ nội bộ (*)',
        'warning'
      )
      return
    }

    if (occupants.length === 0) {
      showToast(
        'Thiếu thông tin người lưu trú',
        'Vui lòng thêm ít nhất 1 người lưu trú.',
        'warning'
      )
      return
    }

    // Comprehensive validation for all fields of every occupant
    for (let i = 0; i < occupants.length; i++) {
      const occ = occupants[i]
      const order = i + 1
      const isVN = (occ.nation || 'VNM').toUpperCase() === 'VNM'

      if (!occ.name || !occ.name.trim()) {
        showToast(
          `Người #${order}: Thiếu họ và tên`,
          'Vui lòng nhập đầy đủ họ và tên (*)',
          'warning'
        )
        return
      }

      if (!occ.status || !occ.status.trim()) {
        showToast(
          `Người #${order}: Thiếu đơn vị / khu vực`,
          'Vui lòng chọn đơn vị (*)',
          'warning'
        )
        return
      }

      if (!occ.birthDay || !occ.birthDay.trim()) {
        showToast(
          `Người #${order}: Thiếu ngày sinh`,
          'Vui lòng chọn ngày tháng năm sinh (*)',
          'warning'
        )
        return
      }

      if (!occ.nation || !occ.nation.trim()) {
        showToast(
          `Người #${order}: Thiếu quốc tịch`,
          'Vui lòng chọn quốc tịch (*)',
          'warning'
        )
        return
      }

      if (!occ.typeDoc || !occ.typeDoc.trim()) {
        showToast(
          `Người #${order}: Thiếu loại giấy tờ`,
          'Vui lòng chọn loại giấy tờ (*)',
          'warning'
        )
        return
      }

      if (!occ.startDate || !occ.startDate.trim()) {
        showToast(
          `Người #${order}: Thiếu ngày đến`,
          'Vui lòng chọn ngày đến (*)',
          'warning'
        )
        return
      }

      if (!occ.endDate || !occ.endDate.trim()) {
        showToast(
          `Người #${order}: Thiếu ngày rời đi`,
          'Vui lòng chọn ngày rời đi (*)',
          'warning'
        )
        return
      }

      if (occ.startDate > occ.endDate) {
        showToast(
          `Người #${order}: Ngày đến/rời đi không hợp lệ`,
          'Ngày rời đi phải sau hoặc bằng ngày đến (*)',
          'warning'
        )
        return
      }

      if (!occ.numDoc || !occ.numDoc.trim()) {
        showToast(
          `Người #${order}: Thiếu số giấy tờ`,
          'Vui lòng nhập số CCCD hoặc Hộ chiếu (*)',
          'warning'
        )
        return
      }

      if (!occ.res_reason || !occ.res_reason.trim()) {
        showToast(
          `Người #${order}: Thiếu lý do tạm trú`,
          'Vui lòng chọn lý do tạm trú (*)',
          'warning'
        )
        return
      }

      // Address fields for Vietnamese citizens
      if (isVN) {
        if (!occ.typeRes || !occ.typeRes.trim()) {
          showToast(
            `Người #${order}: Thiếu loại cư trú`,
            'Vui lòng chọn Thường trú hoặc Tạm trú (*)',
            'warning'
          )
          return
        }

        if (!occ.prov_city || !occ.prov_city.trim()) {
          showToast(
            `Người #${order}: Thiếu Tỉnh/Thành phố`,
            'Vui lòng chọn Tỉnh hoặc Thành phố (*)',
            'warning'
          )
          return
        }

        if (!occ.ward_com || !occ.ward_com.trim()) {
          showToast(
            `Người #${order}: Thiếu Phường/Xã`,
            'Vui lòng chọn Phường hoặc Xã (*)',
            'warning'
          )
          return
        }

        if (!occ.detailAddr || !occ.detailAddr.trim()) {
          showToast(
            `Người #${order}: Thiếu địa chỉ chi tiết`,
            'Vui lòng nhập số nhà, đường, thôn/ấp/khu phố (*)',
            'warning'
          )
          return
        }
      }
    }

    const validOccupants = occupants.map((o) => ({
      ...o,
      name: o.name.trim(),
      numDoc: o.numDoc.trim(),
      detailAddr: o.detailAddr ? o.detailAddr.trim() : '',
      note: o.note ? o.note.trim() : '',
    }))

    setSubmitting(true)
    try {
      const res = await fetch('/api/vgDorm/savedb', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          key_in: new Date().toISOString().slice(0, 10),
          submitter: {
            empno: user.empno,
            name: user.name,
            dept: user.dept,
            ext: extPhone,
          },
          name: validOccupants,
          reason,
          app_flow: flowSteps,
        }),
      })
      const data = await res.json()
      if (res.ok && data.data) {
        showToast(
          'Tạo đơn đăng ký thành công!',
          `Đơn #${data.id} (${validOccupants.length} người) đã được lưu vào hệ thống.`,
          'success'
        )
        onSuccess(data.data)
        onClose()
      } else {
        showToast(
          'Không thể tạo đơn',
          data.details || 'Lỗi lưu dữ liệu',
          'error'
        )
      }
    } catch (err: any) {
      showToast('Lỗi hệ thống', err?.message, 'error')
    } finally {
      setSubmitting(false)
    }
  }

  const handleApprove = async () => {
    if (!request) return
    setSubmitting(true)
    try {
      const res = await fetch('/api/vgDorm/acceptRequest', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: request.id,
          approver: {
            code: user.empno,
            empid: user.empno,
            name: user.name,
            dept: user.dept,
            email: user.email,
            ext: user.ext,
            date: new Date().toISOString().replace('T', ' ').slice(0, 19),
          },
        }),
      })
      const data = await res.json()
      if (res.ok && data.data) {
        showToast(
          'Đã phê duyệt đơn!',
          `Đơn #${request.id} đã được cập nhật trạng thái phê duyệt.`,
          'success'
        )
        onSuccess(data.data)
        onClose()
      } else {
        showToast('Lỗi phê duyệt', data.details, 'error')
      }
    } catch (err: any) {
      showToast('Lỗi kết nối', err?.message, 'error')
    } finally {
      setSubmitting(false)
    }
  }

  const handleDeny = async () => {
    if (!request) return
    if (!denyReasonText.trim()) {
      showToast('Vui lòng nhập lý do từ chối', undefined, 'warning')
      return
    }
    setSubmitting(true)
    try {
      const res = await fetch('/api/vgDorm/denyRequest', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: request.id,
          reason: denyReasonText.trim(),
          approver: {
            code: user.empno,
            empid: user.empno,
            name: user.name,
            dept: user.dept,
            email: user.email,
            reason: denyReasonText.trim(),
            date: new Date().toISOString().replace('T', ' ').slice(0, 19),
          },
        }),
      })
      const data = await res.json()
      if (res.ok && data.data) {
        showToast(
          'Đã từ chối đơn đăng ký',
          `Đơn #${request.id} đã chuyển sang trạng thái DENIED.`,
          'info'
        )
        onSuccess(data.data)
        setDenyPromptOpen(false)
        onClose()
      } else {
        showToast('Lỗi từ chối đơn', data.details, 'error')
      }
    } catch (err: any) {
      showToast('Lỗi kết nối', err?.message, 'error')
    } finally {
      setSubmitting(false)
    }
  }

  const isReadOnly = mode === 'view'
  const approvalCheck =
    mode === 'view' && request
      ? isUserPendingApprover(request, user.empno)
      : { canApprove: false, stepIndex: -1 }

  const inputCls =
    'h-8 w-full rounded-lg border border-[#d0d5dd] bg-white px-2.5 text-xs font-semibold text-slate-800 outline-none transition-colors focus:border-rose-500 disabled:bg-slate-100 disabled:text-slate-600 dark:border-[#26262C] dark:bg-[#131316] dark:text-slate-100 dark:disabled:bg-[#1c1c22]'

  return (
    <div
      className="fixed inset-0 z-50 flex flex-col bg-[#eaedf0] dark:bg-[#121214]"
      role="dialog"
      aria-modal="true"
    >
      <form
        onSubmit={handleSubmitCreate}
        className="flex h-full w-full flex-col overflow-hidden bg-white dark:bg-[#18181C]"
      >
        {/* Modal Header */}
        <div className="flex shrink-0 items-center justify-between border-b border-[#d8dce2] bg-[#f1f3f6] px-4 py-2.5 sm:px-6 dark:border-[#26262C] dark:bg-[#131316]">
          <div className="flex items-center gap-3">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg border border-rose-500/20 bg-rose-500/10 text-rose-600 dark:text-rose-400">
              <Building2 className="h-4 w-4" />
            </div>
            <div>
              <h2 className="text-sm font-bold text-slate-900 sm:text-base dark:text-white">
                {mode === 'create'
                  ? t.common.createRequest
                  : `Chi Tiết & Phê Duyệt Đơn Ký Túc Xá #${request?.id}`}
              </h2>
              <p className="tabular-nums text-[11px] text-slate-600 dark:text-slate-400">
                {mode === 'create'
                  ? `Người tạo: ${user.empno} - ${user.name} (${user.dept})`
                  : `Người tạo: ${request?.creator_empno} - ${request?.creator_name} (${request?.creator_dept}) · Ngày tạo: ${request?.key_in_date}`}
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="inline-flex h-8 cursor-pointer items-center gap-1.5 rounded-lg border border-[#d0d5dd] bg-white px-3 text-xs font-bold text-slate-700 transition-colors hover:bg-slate-100 dark:border-[#26262C] dark:bg-[#18181C] dark:text-slate-200 dark:hover:bg-[#222228]"
          >
            <X className="h-4 w-4" />
            <span>{t.common.close}</span>
          </button>
        </div>

        {/* Scrollable Body */}
        <div className="custom-scrollbar min-h-0 flex-1 space-y-3 overflow-y-auto p-3 sm:p-4">
          {/* 4-Level Approval Flow Stepper (Placed at the very top) */}
          <AppFlowStepper
            flowSteps={flowSteps}
            status={
              mode === 'view' && request
                ? request.status
                : [null, null, null, null]
            }
            approval={
              mode === 'view' && request
                ? request.approval
                : [null, null, null, null]
            }
          />

          {/* Submitter & Reason Row */}
          <div className="grid grid-cols-1 gap-2.5 rounded-lg border border-[#e2e8f0] bg-[#f8f9fb] p-2.5 md:grid-cols-4 dark:border-[#26262C] dark:bg-[#131316]">
            <div>
              <label className="mb-1 block text-xs font-bold text-slate-600 dark:text-slate-300">
                Người Đăng Ký (Submitter)
              </label>
              <input
                type="text"
                disabled
                value={
                  mode === 'create'
                    ? `${user.empno} - ${user.name}`
                    : `${request?.creator_empno} - ${request?.creator_name}`
                }
                className={inputCls}
              />
            </div>

            <div>
              <label className="mb-1 block text-xs font-bold text-slate-600 dark:text-slate-300">
                Bộ Phận & Số Điện Thoại / Ext (*)
              </label>
              <div className="flex gap-2">
                <input
                  type="text"
                  disabled
                  value={mode === 'create' ? user.dept : request?.creator_dept}
                  className={`${inputCls} !w-28 shrink-0`}
                />
                <input
                  type="text"
                  required
                  disabled={isReadOnly}
                  value={extPhone}
                  onChange={(e) => setExtPhone(e.target.value)}
                  placeholder="Số nội bộ / SĐT (*)..."
                  className={`${inputCls} tabular-nums`}
                />
              </div>
            </div>

            <div className="md:col-span-2">
              <label className="mb-1 block text-xs font-bold text-slate-600 dark:text-slate-300">
                {t.table.reason} (*)
              </label>
              <input
                type="text"
                required
                disabled={isReadOnly}
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                placeholder="Nhập mục đích công tác / lưu trú tại ký túc xá VG..."
                className={inputCls}
              />
            </div>
          </div>

          {/* Occupant Cards / Rows */}
          <div>
            <div className="mb-3 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <UserPlus className="h-4 w-4 text-rose-600 dark:text-rose-400" />
                <h3 className="text-xs font-bold uppercase tracking-wider text-slate-900 dark:text-white">
                  {t.table.occupants} ({occupants.length} người)
                </h3>
              </div>
              {!isReadOnly && (
                <button
                  type="button"
                  onClick={handleAddRow}
                  className="inline-flex h-8 cursor-pointer items-center gap-1.5 rounded-lg bg-rose-600 px-3.5 text-xs font-bold text-white shadow-xs transition-colors hover:bg-rose-700"
                >
                  <Plus className="h-3.5 w-3.5" />
                  <span>{t.occupant.addPerson}</span>
                </button>
              )}
            </div>

            <div className="space-y-3">
              {occupants.map((occ, idx) => {
                const isVN = (occ.nation || 'VNM').toUpperCase() === 'VNM'
                const filteredWards = wards.filter(
                  (w: any) =>
                    !occ.prov_city ||
                    String(w.provinceCode) === String(occ.prov_city) ||
                    w.province?.name === occ.prov_city
                )

                return (
                  <div
                    key={idx}
                    className="rounded-xl border border-[#d8dce2] bg-white p-4 shadow-2xs transition-colors hover:border-sky-400 dark:border-[#26262C] dark:bg-[#131316]"
                  >
                    {/* Card Top Bar */}
                    <div className="mb-2.5 flex items-center justify-between border-b border-slate-100 pb-2 dark:border-[#26262C]">
                      <div className="flex items-center gap-2">
                        <span className="flex h-5 w-5 items-center justify-center rounded-md bg-rose-600 tabular-nums text-[11px] font-black text-white">
                          {idx + 1}
                        </span>
                        <span className="text-xs font-bold uppercase tracking-tight text-slate-800 dark:text-slate-200">
                          {occ.name || `Người lưu trú #${idx + 1}`}
                        </span>
                      </div>

                      {!isReadOnly && (
                        <div className="flex items-center gap-1.5">
                          {idx > 0 && (
                            <button
                              type="button"
                              onClick={() => handleCopyFirstRow(idx)}
                              className="inline-flex h-6.5 cursor-pointer items-center gap-1 rounded-md border border-[#d0d5dd] bg-white px-2 text-[11px] font-semibold text-slate-700 hover:bg-slate-50 dark:border-[#26262C] dark:bg-[#18181C] dark:text-slate-300"
                            >
                              <Copy className="h-3 w-3 text-sky-600" />
                              <span>{t.occupant.copyFirstRow}</span>
                            </button>
                          )}
                          {occupants.length > 1 && (
                            <button
                              type="button"
                              onClick={() => handleRemoveRow(idx)}
                              className="inline-flex h-6.5 cursor-pointer items-center gap-1 rounded-md bg-rose-50 px-2 text-[11px] font-semibold text-rose-600 hover:bg-rose-100 dark:bg-rose-950/50 dark:text-rose-400"
                            >
                              <Trash2 className="h-3 w-3" />
                              <span>{t.occupant.removePerson}</span>
                            </button>
                          )}
                        </div>
                      )}
                    </div>

                    {/* Compact 12-Column Grid Fields */}
                    <div className="grid grid-cols-12 gap-2 text-xs">
                      {/* Row 1: Identity & Demographics */}
                      {/* Full Name */}
                      <div className="col-span-12 sm:col-span-4 md:col-span-3">
                        <label className="mb-0.5 block text-[10px] font-bold uppercase tracking-wider text-slate-500">
                          {t.occupant.fullName} (*)
                        </label>
                        <input
                          type="text"
                          required
                          disabled={isReadOnly}
                          value={occ.name}
                          onChange={(e) =>
                            updateOccupant(idx, { name: e.target.value })
                          }
                          placeholder="Họ và tên..."
                          className={inputCls}
                        />
                      </div>

                      {/* Origin / Location */}
                      <div className="col-span-6 sm:col-span-2 md:col-span-1">
                        <label className="mb-0.5 block truncate text-[10px] font-bold uppercase tracking-wider text-slate-500" title={t.occupant.accomStatus}>
                          Đơn Vị (*)
                        </label>
                        <select
                          required
                          disabled={isReadOnly}
                          value={occ.status}
                          onChange={(e) =>
                            updateOccupant(idx, { status: e.target.value })
                          }
                          className={inputCls}
                        >
                          {locations.map((l: any) => (
                            <option key={l.loc} value={l.loc}>
                              {l.loc}
                            </option>
                          ))}
                        </select>
                      </div>

                      {/* Gender */}
                      <div className="col-span-6 sm:col-span-2 md:col-span-2">
                        <label className="mb-0.5 block text-[10px] font-bold uppercase tracking-wider text-slate-500">
                          {t.occupant.gender} (*)
                        </label>
                        <div className="grid h-8 grid-cols-2 gap-0.5 rounded-lg border border-[#d0d5dd] bg-[#e2e6eb] p-0.5 dark:border-[#26262C] dark:bg-[#222228]">
                          <button
                            type="button"
                            disabled={isReadOnly}
                            onClick={() => updateOccupant(idx, { gender: 'M' })}
                            className={`rounded text-[11px] font-bold transition-all ${
                              occ.gender !== 'F'
                                ? 'bg-sky-600 text-white shadow-2xs'
                                : 'text-slate-600 dark:text-slate-400'
                            }`}
                          >
                            {t.occupant.male}
                          </button>
                          <button
                            type="button"
                            disabled={isReadOnly}
                            onClick={() => updateOccupant(idx, { gender: 'F' })}
                            className={`rounded text-[11px] font-bold transition-all ${
                              occ.gender === 'F'
                                ? 'bg-rose-600 text-white shadow-2xs'
                                : 'text-slate-600 dark:text-slate-400'
                            }`}
                          >
                            {t.occupant.female}
                          </button>
                        </div>
                      </div>

                      {/* Birth Day */}
                      <div className="col-span-6 sm:col-span-2 md:col-span-2">
                        <label className="mb-0.5 block text-[10px] font-bold uppercase tracking-wider text-slate-500">
                          {t.occupant.birthDay} (*)
                        </label>
                        <input
                          type="date"
                          required
                          disabled={isReadOnly}
                          value={occ.birthDay}
                          onChange={(e) =>
                            updateOccupant(idx, { birthDay: e.target.value })
                          }
                          className={`${inputCls} tabular-nums`}
                        />
                      </div>

                      {/* Nationality */}
                      <div className="col-span-6 sm:col-span-2 md:col-span-2">
                        <label className="mb-0.5 block text-[10px] font-bold uppercase tracking-wider text-slate-500">
                          {t.occupant.nationality} (*)
                        </label>
                        <select
                          required
                          disabled={isReadOnly}
                          value={occ.nation}
                          onChange={(e) => {
                            const nextNat = e.target.value
                            updateOccupant(idx, {
                              nation: nextNat,
                              typeDoc:
                                nextNat === 'VNM' ? 'Thẻ CCCD' : 'Hộ chiếu',
                            })
                          }}
                          className={inputCls}
                        >
                          <option value="VNM">VNM - VN</option>
                          <option value="TWN">TWN - TW</option>
                          <option value="CHN">CHN - CN</option>
                          <option value="USA">USA</option>
                          <option value="IDN">IDN</option>
                          <option value="PHL">PHL</option>
                          {nations
                            .filter(
                              (n: any) =>
                                ![
                                  'VNM',
                                  'TWN',
                                  'CHN',
                                  'USA',
                                  'IDN',
                                  'PHL',
                                ].includes(n.code)
                            )
                            .map((n: any) => (
                              <option key={n.code} value={n.code}>
                                {n.code}
                              </option>
                            ))}
                        </select>
                      </div>

                      {/* Document Type */}
                      <div className="col-span-6 sm:col-span-2 md:col-span-2">
                        <label className="mb-0.5 block text-[10px] font-bold uppercase tracking-wider text-slate-500">
                          {t.occupant.docType} (*)
                        </label>
                        <select
                          required
                          disabled={isReadOnly}
                          value={occ.typeDoc}
                          onChange={(e) =>
                            updateOccupant(idx, { typeDoc: e.target.value })
                          }
                          className={inputCls}
                        >
                          {docTypes.length > 0 ? (
                            docTypes.map((d: any) => {
                              const label = getLocalizedLabel(d.type, d.name)
                              return (
                                <option key={d.id} value={label}>
                                  {label}
                                </option>
                              )
                            })
                          ) : (
                            <>
                              <option value="Thẻ CCCD">Thẻ CCCD</option>
                              <option value="Hộ chiếu">Hộ chiếu</option>
                              <option value="CMND">CMND</option>
                            </>
                          )}
                        </select>
                      </div>

                      {/* Row 2: Stay Duration, Document Number & Reason */}
                      {/* Start Date */}
                      <div className="col-span-6 sm:col-span-3 md:col-span-2">
                        <label className="mb-0.5 block text-[10px] font-bold uppercase tracking-wider text-slate-500">
                          {t.occupant.startDate} (*)
                        </label>
                        <input
                          type="date"
                          required
                          disabled={isReadOnly}
                          value={occ.startDate}
                          onChange={(e) =>
                            updateOccupant(idx, { startDate: e.target.value })
                          }
                          className={`${inputCls} tabular-nums`}
                        />
                      </div>

                      {/* End Date */}
                      <div className="col-span-6 sm:col-span-3 md:col-span-2">
                        <label className="mb-0.5 block text-[10px] font-bold uppercase tracking-wider text-slate-500">
                          {t.occupant.endDate} (*)
                        </label>
                        <input
                          type="date"
                          required
                          disabled={isReadOnly}
                          value={occ.endDate}
                          onChange={(e) =>
                            updateOccupant(idx, { endDate: e.target.value })
                          }
                          className={`${inputCls} tabular-nums`}
                        />
                      </div>

                      {/* Document Number */}
                      <div className="col-span-6 sm:col-span-3 md:col-span-3">
                        <label className="mb-0.5 block text-[10px] font-bold uppercase tracking-wider text-slate-500">
                          {t.occupant.docNumber} (*)
                        </label>
                        <input
                          type="text"
                          required
                          disabled={isReadOnly}
                          value={occ.numDoc}
                          onChange={(e) =>
                            updateOccupant(idx, { numDoc: e.target.value })
                          }
                          placeholder="Số CCCD / Hộ chiếu (*)..."
                          className={`${inputCls} font-mono tabular-nums`}
                        />
                      </div>

                      {/* Stay Reason */}
                      <div className="col-span-6 sm:col-span-3 md:col-span-2">
                        <label className="mb-0.5 block text-[10px] font-bold uppercase tracking-wider text-slate-500">
                          {t.occupant.resReason} (*)
                        </label>
                        <select
                          required
                          disabled={isReadOnly}
                          value={occ.res_reason}
                          onChange={(e) =>
                            updateOccupant(idx, { res_reason: e.target.value })
                          }
                          className={inputCls}
                        >
                          {resReasons.length > 0 ? (
                            resReasons.map((r: any) => {
                              const label = getLocalizedLabel(
                                r.res_reason,
                                'Làm việc'
                              )
                              return (
                                <option key={r.id} value={label}>
                                  {label}
                                </option>
                              )
                            })
                          ) : (
                            <option value="Làm việc">Làm việc</option>
                          )}
                        </select>
                      </div>

                      {/* Note */}
                      <div className="col-span-12 md:col-span-3">
                        <label className="mb-0.5 block text-[10px] font-bold uppercase tracking-wider text-slate-500">
                          {t.occupant.note}
                        </label>
                        <input
                          type="text"
                          disabled={isReadOnly}
                          value={occ.note}
                          onChange={(e) =>
                            updateOccupant(idx, { note: e.target.value })
                          }
                          placeholder="Ghi chú thêm..."
                          className={inputCls}
                        />
                      </div>

                      {/* Row 3: Extra Address Fields for Vietnamese Citizens */}
                      {isVN && (
                        <>
                          <div className="col-span-6 sm:col-span-2 md:col-span-2">
                            <label className="mb-0.5 block text-[10px] font-bold uppercase tracking-wider text-slate-500">
                              {t.occupant.resType} (*)
                            </label>
                            <select
                              required
                              disabled={isReadOnly}
                              value={occ.typeRes}
                              onChange={(e) =>
                                updateOccupant(idx, { typeRes: e.target.value })
                              }
                              className={inputCls}
                            >
                              {resTypes.length > 0 ? (
                                resTypes.map((rt: any) => {
                                  const label = getLocalizedLabel(
                                    rt.name,
                                    'Thường trú'
                                  )
                                  return (
                                    <option key={rt.id} value={label}>
                                      {label}
                                    </option>
                                  )
                                })
                              ) : (
                                <>
                                  <option value="Thường trú">Thường trú</option>
                                  <option value="Tạm trú">Tạm trú</option>
                                </>
                              )}
                            </select>
                          </div>

                          <div className="col-span-6 sm:col-span-2 md:col-span-2">
                            <label className="mb-0.5 block text-[10px] font-bold uppercase tracking-wider text-slate-500">
                              {t.occupant.provinceCity} (*)
                            </label>
                            <select
                              required
                              disabled={isReadOnly}
                              value={occ.prov_city}
                              onChange={(e) =>
                                updateOccupant(idx, {
                                  prov_city: e.target.value,
                                  ward_com: '',
                                })
                              }
                              className={inputCls}
                            >
                              <option value="">-- Tỉnh/TP (*) --</option>
                              {provinces.map((p: any) => (
                                <option key={p.code} value={p.code}>
                                  {p.name}
                                </option>
                              ))}
                            </select>
                          </div>

                          <div className="col-span-6 sm:col-span-2 md:col-span-2">
                            <label className="mb-0.5 block text-[10px] font-bold uppercase tracking-wider text-slate-500">
                              {t.occupant.wardCommune} (*)
                            </label>
                            <select
                              required
                              disabled={isReadOnly}
                              value={occ.ward_com}
                              onChange={(e) =>
                                updateOccupant(idx, {
                                  ward_com: e.target.value,
                                })
                              }
                              className={inputCls}
                            >
                              <option value="">-- Phường/Xã (*) --</option>
                              {filteredWards.slice(0, 300).map((w: any) => (
                                <option key={w.code} value={w.code}>
                                  {w.name}
                                </option>
                              ))}
                            </select>
                          </div>

                          <div className="col-span-12 sm:col-span-6 md:col-span-6">
                            <label className="mb-0.5 block text-[10px] font-bold uppercase tracking-wider text-slate-500">
                              {t.occupant.detailAddress} (*)
                            </label>
                            <input
                              type="text"
                              required
                              disabled={isReadOnly}
                              value={occ.detailAddr}
                              onChange={(e) =>
                                updateOccupant(idx, {
                                  detailAddr: e.target.value,
                                })
                              }
                              placeholder="Số nhà, đường, ấp/khu phố (*)..."
                              className={inputCls}
                            />
                          </div>
                        </>
                      )}
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        </div>

        {/* Sticky Bottom Action Bar */}
        <div className="flex shrink-0 flex-wrap items-center justify-between gap-3 border-t border-[#d8dce2] bg-[#f1f3f6] px-4 py-3 sm:px-6 dark:border-[#26262C] dark:bg-[#131316]">
          <div className="text-xs text-slate-600 dark:text-slate-400">
            {mode === 'view' && request && (
              <span>
                Trạng thái hiện tại:{' '}
                <strong className="uppercase text-slate-900 dark:text-slate-100">
                  {request.db_status}
                </strong>
                {approvalCheck.canApprove && (
                  <span className="ml-2 rounded-full bg-rose-500/10 px-2.5 py-0.5 font-bold text-rose-600 dark:text-rose-400">
                    Bạn có quyền duyệt bước #{approvalCheck.stepIndex + 1}
                  </span>
                )}
              </span>
            )}
          </div>

          <div className="flex items-center gap-2.5">
            <button
              type="button"
              onClick={onClose}
              className="h-8 cursor-pointer rounded-lg border border-[#d0d5dd] bg-white px-4 text-xs font-bold text-slate-700 transition-colors hover:bg-slate-100 dark:border-[#26262C] dark:bg-[#18181C] dark:text-slate-200 dark:hover:bg-[#222228]"
            >
              {t.common.cancel}
            </button>

            {mode === 'create' && (
              <button
                type="submit"
                disabled={submitting}
                className="inline-flex h-8 cursor-pointer items-center gap-1.5 rounded-lg bg-rose-600 px-5 text-xs font-bold text-white shadow-xs transition-colors hover:bg-rose-700 disabled:opacity-50"
              >
                <Send className="h-3.5 w-3.5" />
                <span>
                  {submitting ? 'Đang gửi đơn...' : t.common.submit}
                </span>
              </button>
            )}

            {mode === 'view' &&
              request &&
              request.db_status === 'PENDING' && (
                <>
                  <button
                    type="button"
                    disabled={submitting}
                    onClick={() => setDenyPromptOpen(true)}
                    className="inline-flex h-8 cursor-pointer items-center gap-1.5 rounded-lg bg-rose-600 px-4 text-xs font-bold text-white shadow-xs transition-colors hover:bg-rose-700 disabled:opacity-50"
                  >
                    <XCircle className="h-3.5 w-3.5" />
                    <span>{t.flow.denyBtn}</span>
                  </button>
                  <button
                    type="button"
                    disabled={submitting}
                    onClick={handleApprove}
                    className="inline-flex h-8 cursor-pointer items-center gap-1.5 rounded-lg bg-emerald-600 px-5 text-xs font-bold text-white shadow-xs transition-colors hover:bg-emerald-700 disabled:opacity-50"
                  >
                    <CheckCircle2 className="h-3.5 w-3.5" />
                    <span>
                      {submitting ? 'Đang xử lý...' : t.flow.approveBtn}
                    </span>
                  </button>
                </>
              )}
          </div>
        </div>
      </form>

      {/* Deny Reason Sub-modal */}
      {denyPromptOpen && (
        <div
          className="fixed inset-0 z-[60] flex items-center justify-center bg-slate-900/60 p-4 backdrop-blur-xs"
          onClick={() => setDenyPromptOpen(false)}
        >
          <div
            className="w-full max-w-md rounded-2xl border border-[#d8dce2] bg-white p-6 shadow-2xl dark:border-[#26262C] dark:bg-[#18181C]"
            onClick={(e) => e.stopPropagation()}
          >
            <h4 className="text-base font-bold text-rose-600">
              {t.flow.denyBtn} #{request?.id}
            </h4>
            <p className="mt-1 text-xs text-slate-600 dark:text-slate-300">
              {t.flow.denyReasonPrompt}
            </p>
            <textarea
              rows={3}
              autoFocus
              value={denyReasonText}
              onChange={(e) => setDenyReasonText(e.target.value)}
              placeholder="Nhập lý do từ chối..."
              className="mt-3 w-full rounded-xl border border-[#d0d5dd] bg-[#f8f9fb] p-3 text-xs text-slate-800 outline-none focus:border-rose-500 focus:bg-white dark:border-[#26262C] dark:bg-[#131316] dark:text-slate-100"
            />
            <div className="mt-4 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setDenyPromptOpen(false)}
                className="h-8 cursor-pointer rounded-lg border border-[#d0d5dd] bg-white px-4 text-xs font-bold text-slate-700 hover:bg-slate-100 dark:border-[#26262C] dark:bg-[#131316] dark:text-slate-300"
              >
                Hủy
              </button>
              <button
                type="button"
                disabled={submitting}
                onClick={handleDeny}
                className="h-8 cursor-pointer rounded-lg bg-rose-600 px-4 text-xs font-bold text-white hover:bg-rose-700"
              >
                Xác Nhận Từ Chối
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
