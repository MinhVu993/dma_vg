'use client'

import React, { useState, useEffect } from 'react'
import { FormattedDormRequest } from '@/lib/flow-utils'
import { useTranslation } from '@/hooks/useTranslation'
import {
  FileSpreadsheet,
  FileCode2,
  Download,
  ShieldCheck,
  Calendar,
  Filter,
  Eye,
  X,
  Copy,
  Check,
  Loader2,
  FileText,
} from 'lucide-react'

interface PreviewData {
  type: 'table' | 'xml'
  title: string
  filename: string
  totalCount: number
  headers?: string[]
  rows?: (string | number)[][]
  xmlContent?: string
}

export default function PoliceExportsPage() {
  const { t } = useTranslation()
  const [requests, setRequests] = useState<FormattedDormRequest[]>([])
  const [statusFilter, setStatusFilter] = useState('ALL')
  const [requestId, setRequestId] = useState('')
  const [startFrom, setStartFrom] = useState('')
  const [startTo, setStartTo] = useState('')

  // Preview state
  const [isPreviewOpen, setIsPreviewOpen] = useState(false)
  const [previewLoading, setPreviewLoading] = useState(false)
  const [previewData, setPreviewData] = useState<PreviewData | null>(null)
  const [activeCardId, setActiveCardId] = useState<string>('')
  const [copied, setCopied] = useState(false)

  const handleOpenPreview = async (cardId: string) => {
    setActiveCardId(cardId)
    setIsPreviewOpen(true)
    setPreviewLoading(true)
    setPreviewData(null)
    setCopied(false)

    try {
      const url = `${buildExportUrl(cardId)}&preview=true`
      const res = await fetch(url)
      if (!res.ok) throw new Error('Không thể tải dữ liệu xem trước')
      const data = await res.json()
      setPreviewData(data)
    } catch (err: any) {
      console.error('Preview error:', err)
    } finally {
      setPreviewLoading(false)
    }
  }

  const handleCopyXml = () => {
    if (previewData?.xmlContent) {
      navigator.clipboard.writeText(previewData.xmlContent)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    }
  }

  useEffect(() => {
    fetch('/api/vgDorm/getAllData')
      .then((res) => (res.ok ? res.json() : []))
      .then((list) => {
        if (Array.isArray(list)) {
          setRequests(list)
        }
      })
      .catch((err) => console.error('Error loading requests for export:', err))
  }, [])

  const buildExportUrl = (type: string) => {
    const params = new URLSearchParams()
    params.set('type', type)
    if (statusFilter && statusFilter !== 'ALL') {
      params.set('status', statusFilter)
    }
    if (requestId.trim()) {
      params.set('requestId', requestId.trim())
    }
    if (startFrom) {
      params.set('startFrom', startFrom)
    }
    if (startTo) {
      params.set('startTo', startTo)
    }
    return `/api/vgDorm/export?${params.toString()}`
  }

  const exportCards = [
    {
      id: 'accom_book',
      title: t.export.accomBookTitle,
      desc: t.export.accomBookDesc,
      badge: 'EXCEL (.XLSX) · SỔ TIẾP NHẬN LƯU TRÚ',
      icon: FileSpreadsheet,
      color: 'from-emerald-600 to-teal-700',
    },
    {
      id: 'vn_import',
      title: t.export.vnImportTitle,
      desc: t.export.vnImportDesc,
      badge: 'EXCEL (.XLSX) · CÔNG DÂN VIỆT NAM (VNM)',
      icon: FileSpreadsheet,
      color: 'from-sky-600 to-blue-700',
    },
    {
      id: 'foreign_import',
      title: t.export.foreignImportTitle,
      desc: t.export.foreignImportDesc,
      badge: 'EXCEL (.XLSX) · NGƯỜI NƯỚC NGOÀI',
      icon: FileSpreadsheet,
      color: 'from-amber-600 to-orange-700',
    },
    {
      id: 'visa_xml',
      title: t.export.visaXmlTitle,
      desc: t.export.visaXmlDesc,
      badge: 'XML (<KHAI_BAO_TAM_TRU>) · XUẤT NHẬP CẢNH',
      icon: FileCode2,
      color: 'from-rose-600 to-red-700',
    },
  ]

  return (
    <div className="flex w-full flex-1 flex-col gap-3 bg-[#eaedf0] p-2.5 text-slate-900 sm:p-3.5 dark:bg-[#121214] dark:text-[#F1F2F4]">
      {/* Cockpit Filter Header */}
      <div className="rounded-xl border border-[#d8dce2] bg-[#f1f3f6] p-3.5 shadow-xs dark:border-[#26262C] dark:bg-[#18181C]">
        <div className="flex items-center gap-3">
          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-rose-500/20 bg-rose-500/10 text-rose-600 dark:text-rose-400">
            <ShieldCheck className="h-4 w-4" />
          </div>
          <div>
            <h1 className="text-sm font-bold leading-none text-slate-900 dark:text-white">
              {t.export.title}
            </h1>
            <p className="mt-1 text-[11px] text-slate-500 dark:text-slate-400">
              {t.export.subtitle}
            </p>
          </div>
        </div>

        {/* Filter Bar */}
        <div className="mt-3 grid grid-cols-1 gap-3 border-t border-[#d8dce2] pt-3 sm:grid-cols-2 lg:grid-cols-4 dark:border-[#26262C]">
          <div>
            <label className="mb-1 flex items-center gap-1 text-xs font-bold text-slate-600 dark:text-slate-300">
              <Filter className="h-3.5 w-3.5 text-rose-600" />
              <span>Trạng Thái Đơn</span>
            </label>
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="h-8 w-full rounded-md border border-[#d0d5dd] bg-white px-2.5 text-xs font-semibold outline-none focus:border-rose-500 dark:border-[#26262C] dark:bg-[#131316]"
            >
              <option value="ALL">Tất cả trạng thái (All)</option>
              <option value="COMPLETED">
                Chỉ đơn đã duyệt hoàn tất (COMPLETED)
              </option>
              <option value="PENDING">Đơn đang chờ duyệt (PENDING)</option>
            </select>
          </div>

          <div>
            <label className="mb-1 block text-xs font-bold text-slate-600 dark:text-slate-300">
              Chọn Đơn Cụ Thể (Tùy chọn)
            </label>
            <select
              value={requestId}
              onChange={(e) => setRequestId(e.target.value)}
              className="h-8 w-full rounded-md border border-[#d0d5dd] bg-white px-2 text-xs font-semibold outline-none focus:border-rose-500 dark:border-[#26262C] dark:bg-[#131316]"
            >
              <option value="">-- Tất cả các đơn --</option>
              {requests.map((r) => (
                <option key={r.id} value={r.id}>
                  #{r.id} - {r.creator_name}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="mb-1 flex items-center gap-1 text-xs font-bold text-slate-600 dark:text-slate-300">
              <Calendar className="h-3.5 w-3.5 text-rose-600" />
              <span>Ngày Đến Lưu Trú (Từ ngày)</span>
            </label>
            <input
              type="date"
              value={startFrom}
              onChange={(e) => setStartFrom(e.target.value)}
              className="h-8 w-full rounded-md border border-[#d0d5dd] bg-white px-2.5 text-xs font-semibold outline-none focus:border-rose-500 dark:border-[#26262C] dark:bg-[#131316]"
            />
          </div>

          <div>
            <label className="mb-1 flex items-center gap-1 text-xs font-bold text-slate-600 dark:text-slate-300">
              <Calendar className="h-3.5 w-3.5 text-rose-600" />
              <span>Ngày Đến Lưu Trú (Đến ngày)</span>
            </label>
            <input
              type="date"
              value={startTo}
              onChange={(e) => setStartTo(e.target.value)}
              className="h-8 w-full rounded-md border border-[#d0d5dd] bg-white px-2.5 text-xs font-semibold outline-none focus:border-rose-500 dark:border-[#26262C] dark:bg-[#131316]"
            />
          </div>
        </div>
      </div>

      {/* 4 Official Export Cards */}
      <div className="grid grid-cols-1 gap-3 md:grid-cols-2 lg:grid-cols-4">
        {exportCards.map((card) => {
          const Icon = card.icon
          return (
            <div
              key={card.id}
              className="flex flex-col justify-between rounded-xl border border-[#d8dce2] bg-white p-5 shadow-xs transition-all hover:border-rose-400 dark:border-[#26262C] dark:bg-[#18181C]"
            >
              <div>
                <div className="mb-3 flex items-center justify-between">
                  <span className="rounded bg-slate-100 px-2 py-0.5 text-[10px] font-extrabold tracking-wider text-slate-700 dark:bg-slate-800 dark:text-slate-300">
                    {card.badge}
                  </span>
                  <div
                    className={`flex h-9 w-9 items-center justify-center rounded-lg bg-gradient-to-br ${card.color} text-white shadow-xs`}
                  >
                    <Icon className="h-4 w-4" />
                  </div>
                </div>
                <h3 className="text-sm font-extrabold text-slate-900 dark:text-white">
                  {card.title}
                </h3>
                <p className="mt-2 text-xs leading-relaxed text-slate-600 dark:text-slate-400">
                  {card.desc}
                </p>
              </div>

              <div className="mt-5 flex items-center gap-2 border-t border-slate-100 pt-3.5 dark:border-slate-800">
                <button
                  type="button"
                  onClick={() => handleOpenPreview(card.id)}
                  className="inline-flex h-8 flex-1 items-center justify-center gap-1.5 rounded-md border border-[#d0d5dd] bg-white px-2.5 text-xs font-semibold text-slate-700 transition-colors hover:bg-slate-50 hover:text-slate-900 dark:border-[#333] dark:bg-[#18181C] dark:text-slate-200 dark:hover:bg-[#222]"
                >
                  <Eye className="h-3.5 w-3.5 text-slate-500" />
                  <span>Xem trước</span>
                </button>
                <a
                  href={buildExportUrl(card.id)}
                  className="inline-flex h-8 flex-1 items-center justify-center gap-1.5 rounded-md bg-rose-600 px-2.5 text-xs font-bold text-white transition-colors hover:bg-rose-700"
                >
                  <Download className="h-3.5 w-3.5" />
                  <span>{t.export.downloadBtn}</span>
                </a>
              </div>
            </div>
          )
        })}
      </div>

      {/* Preview Modal */}
      {isPreviewOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-3 sm:p-6 backdrop-blur-[2px]">
          <div className="flex h-full max-h-[88vh] w-full max-w-6xl flex-col rounded-xl border border-[#d8dce2] bg-white shadow-2xl dark:border-[#26262C] dark:bg-[#18181C]">
            {/* Modal Header */}
            <div className="flex items-center justify-between border-b border-[#e2e6eb] px-5 py-3.5 dark:border-[#26262C]">
              <div className="flex items-center gap-2.5">
                <div className="flex h-7 w-7 items-center justify-center rounded-md bg-rose-50 text-rose-600 dark:bg-rose-950/40 dark:text-rose-400">
                  <FileText className="h-4 w-4" />
                </div>
                <div>
                  <h2 className="text-sm font-bold text-slate-900 dark:text-white">
                    {previewData?.title || 'Xem Trước Dữ Liệu Xuất'}
                  </h2>
                  <p className="text-[11px] text-slate-500 dark:text-slate-400">
                    {previewLoading ? (
                      'Đang xử lý dữ liệu...'
                    ) : (
                      <>
                        Tổng số:{' '}
                        <span className="font-bold text-rose-600">
                          {previewData?.totalCount ?? 0}
                        </span>{' '}
                        bản ghi · File dự kiến:{' '}
                        <span className="font-medium text-slate-700 dark:text-slate-300">
                          {previewData?.filename}
                        </span>
                      </>
                    )}
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-2">
                {previewData?.type === 'xml' && previewData.xmlContent && (
                  <button
                    onClick={handleCopyXml}
                    className="inline-flex h-8 items-center gap-1.5 rounded-md border border-[#d0d5dd] bg-white px-2.5 text-xs font-semibold text-slate-700 hover:bg-slate-50 dark:border-[#333] dark:bg-[#1f1f23] dark:text-slate-200"
                  >
                    {copied ? (
                      <>
                        <Check className="h-3.5 w-3.5 text-emerald-600" />
                        <span className="text-emerald-600">Đã sao chép</span>
                      </>
                    ) : (
                      <>
                        <Copy className="h-3.5 w-3.5 text-slate-500" />
                        <span>Sao chép XML</span>
                      </>
                    )}
                  </button>
                )}

                <a
                  href={buildExportUrl(activeCardId)}
                  className="inline-flex h-8 items-center gap-1.5 rounded-md bg-rose-600 px-3 text-xs font-bold text-white transition-colors hover:bg-rose-700"
                >
                  <Download className="h-3.5 w-3.5" />
                  <span>Tải xuống ngay</span>
                </a>

                <button
                  onClick={() => setIsPreviewOpen(false)}
                  className="flex h-8 w-8 items-center justify-center rounded-md text-slate-400 hover:bg-slate-100 hover:text-slate-700 dark:hover:bg-[#26262C] dark:hover:text-white"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
            </div>

            {/* Modal Body */}
            <div className="flex-1 overflow-auto p-4">
              {previewLoading ? (
                <div className="flex h-64 flex-col items-center justify-center gap-2 text-slate-400">
                  <Loader2 className="h-6 w-6 animate-spin text-rose-600" />
                  <span className="text-xs font-medium">Đang trích xuất dữ liệu xem trước...</span>
                </div>
              ) : previewData?.totalCount === 0 ? (
                <div className="flex h-64 flex-col items-center justify-center gap-2 text-slate-400">
                  <FileSpreadsheet className="h-8 w-8 text-slate-300" />
                  <span className="text-xs font-semibold">
                    Không có bản ghi nào phù hợp với bộ lọc đã chọn.
                  </span>
                </div>
              ) : previewData?.type === 'xml' ? (
                <pre className="overflow-auto rounded-lg border border-[#e2e6eb] bg-[#f8fafc] p-4 text-[11px] font-mono leading-relaxed text-slate-800 dark:border-[#26262C] dark:bg-[#121214] dark:text-emerald-400">
                  <code>{previewData.xmlContent}</code>
                </pre>
              ) : (
                <div className="overflow-x-auto rounded-lg border border-[#e2e6eb] dark:border-[#26262C]">
                  <table className="min-w-full divide-y divide-[#e2e6eb] text-left text-xs dark:divide-[#26262C]">
                    <thead className="sticky top-0 bg-[#f8fafc] dark:bg-[#1c1c20]">
                      <tr>
                        {previewData?.headers?.map((header, idx) => (
                          <th
                            key={idx}
                            className="whitespace-nowrap px-3 py-2 font-bold text-slate-600 dark:text-slate-300"
                          >
                            {header}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-[#eef1f4] bg-white dark:divide-[#26262C] dark:bg-[#18181C]">
                      {previewData?.rows?.map((row, rIdx) => (
                        <tr
                          key={rIdx}
                          className="hover:bg-slate-50/80 dark:hover:bg-[#202025]"
                        >
                          {row.map((val, cIdx) => (
                            <td
                              key={cIdx}
                              className={`whitespace-nowrap px-3 py-2 text-slate-700 dark:text-slate-300 ${
                                cIdx === 0
                                  ? 'font-medium text-slate-400 tabular-nums'
                                  : ''
                              }`}
                            >
                              {String(val ?? '')}
                            </td>
                          ))}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>

            {/* Modal Footer */}
            <div className="flex items-center justify-between border-t border-[#e2e6eb] bg-slate-50/50 px-5 py-2.5 text-[11px] text-slate-500 dark:border-[#26262C] dark:bg-[#141416] dark:text-slate-400">
              <span>
                * Dữ liệu xem trước phản ánh đúng định dạng cột và dữ liệu thực tế sẽ được xuất ra tệp.
              </span>
              <button
                type="button"
                onClick={() => setIsPreviewOpen(false)}
                className="rounded-md border border-[#d0d5dd] bg-white px-3 py-1 text-xs font-semibold text-slate-700 hover:bg-slate-100 dark:border-[#333] dark:bg-[#1e1e22] dark:text-slate-200"
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
