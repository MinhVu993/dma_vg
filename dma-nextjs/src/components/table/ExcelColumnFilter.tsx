'use client'

import React, { useState, useRef, useEffect } from 'react'
import {
  Filter,
  ArrowUpAZ,
  ArrowDownZA,
  Search,
  Check,
  RotateCcw,
} from 'lucide-react'
import { SortDirection } from '@/hooks/useTableExcelFilter'

interface ExcelColumnFilterProps {
  colKey: string
  label: string
  uniqueValues: string[]
  selectedValues?: Set<string>
  sortDirection: SortDirection
  onApplyFilter: (colKey: string, selected: Set<string> | null) => void
  onSort: (colKey: string, dir: SortDirection) => void
  align?: 'left' | 'right'
}

export function ExcelColumnFilter({
  colKey,
  label,
  uniqueValues,
  selectedValues,
  sortDirection,
  onApplyFilter,
  onSort,
  align = 'left',
}: ExcelColumnFilterProps) {
  const [open, setOpen] = useState(false)
  const [search, setSearch] = useState('')
  const [draft, setDraft] = useState<Set<string>>(new Set())
  const containerRef = useRef<HTMLDivElement>(null)

  const isFiltered = Boolean(selectedValues && selectedValues.size > 0)

  useEffect(() => {
    if (open) {
      if (selectedValues && selectedValues.size > 0) {
        setDraft(new Set(selectedValues))
      } else {
        setDraft(new Set(uniqueValues))
      }
      setSearch('')
    }
  }, [open, selectedValues, uniqueValues])

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (
        containerRef.current &&
        !containerRef.current.contains(e.target as Node)
      ) {
        setOpen(false)
      }
    }
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') {
        setOpen(false)
      }
    }
    if (open) {
      document.addEventListener('mousedown', handleClickOutside)
      document.addEventListener('keydown', handleKeyDown)
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside)
      document.removeEventListener('keydown', handleKeyDown)
    }
  }, [open])

  const visibleValues = uniqueValues.filter((v) =>
    v.toLowerCase().includes(search.toLowerCase())
  )

  const allVisibleSelected =
    visibleValues.length > 0 && visibleValues.every((v) => draft.has(v))

  const toggleSelectAllVisible = () => {
    const next = new Set(draft)
    if (allVisibleSelected) {
      visibleValues.forEach((v) => next.delete(v))
    } else {
      visibleValues.forEach((v) => next.add(v))
    }
    setDraft(next)
  }

  const toggleValue = (val: string) => {
    const next = new Set(draft)
    if (next.has(val)) {
      next.delete(val)
    } else {
      next.add(val)
    }
    setDraft(next)
  }

  const handleApply = () => {
    if (draft.size === 0 || draft.size === uniqueValues.length) {
      onApplyFilter(colKey, null)
    } else {
      onApplyFilter(colKey, draft)
    }
    setOpen(false)
  }

  const handleClear = () => {
    onApplyFilter(colKey, null)
    onSort(colKey, null)
    setOpen(false)
  }

  return (
    <div ref={containerRef} className="relative inline-flex items-center gap-1">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        className={`inline-flex cursor-pointer items-center gap-1 rounded px-1.5 py-0.5 text-xs font-bold uppercase tracking-wider transition-colors ${
          isFiltered || sortDirection
            ? 'bg-rose-50 text-rose-700 dark:bg-rose-950/60 dark:text-rose-300'
            : 'text-slate-700 hover:bg-slate-200/70 dark:text-slate-200 dark:hover:bg-slate-800'
        }`}
      >
        <span>{label}</span>
        <Filter
          className={`h-3 w-3 ${
            isFiltered
              ? 'fill-rose-600 text-rose-600 dark:fill-rose-400 dark:text-rose-400'
              : 'text-slate-400'
          }`}
        />
      </button>

      {open && (
        <div
          className={`absolute top-full z-50 mt-1.5 w-64 rounded-xl border border-[#d8dce2] bg-white p-2.5 text-left font-normal shadow-xl dark:border-[#26262C] dark:bg-[#18181C] ${
            align === 'right' ? 'right-0' : 'left-0'
          }`}
        >
          {/* Sort actions */}
          <div className="mb-2 flex gap-1 border-b border-slate-100 pb-2 dark:border-slate-800">
            <button
              type="button"
              onClick={() => {
                onSort(colKey, 'asc')
                setOpen(false)
              }}
              className={`flex flex-1 items-center justify-center gap-1.5 rounded-md px-2 py-1.5 text-xs font-semibold transition-colors ${
                sortDirection === 'asc'
                  ? 'bg-rose-600 text-white'
                  : 'bg-slate-100 text-slate-700 hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-300'
              }`}
            >
              <ArrowUpAZ className="h-3.5 w-3.5" />
              A → Z
            </button>
            <button
              type="button"
              onClick={() => {
                onSort(colKey, 'desc')
                setOpen(false)
              }}
              className={`flex flex-1 items-center justify-center gap-1.5 rounded-md px-2 py-1.5 text-xs font-semibold transition-colors ${
                sortDirection === 'desc'
                  ? 'bg-rose-600 text-white'
                  : 'bg-slate-100 text-slate-700 hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-300'
              }`}
            >
              <ArrowDownZA className="h-3.5 w-3.5" />
              Z → A
            </button>
          </div>

          {/* Search box */}
          <div className="relative mb-2">
            <Search className="pointer-events-none absolute left-2.5 top-2 h-3.5 w-3.5 text-slate-400" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Tìm giá trị..."
              className="w-full rounded-md border border-[#d0d5dd] bg-slate-50 py-1.5 pl-8 pr-2.5 text-xs text-slate-800 outline-none focus:border-rose-500 focus:bg-white dark:border-[#26262C] dark:bg-[#131316] dark:text-slate-100"
            />
          </div>

          {/* Select all */}
          <div className="mb-1 border-b border-slate-100 pb-1 dark:border-slate-800">
            <label className="flex cursor-pointer items-center gap-2 rounded px-2 py-1 text-xs font-semibold text-slate-700 hover:bg-slate-50 dark:text-slate-200 dark:hover:bg-slate-800">
              <input
                type="checkbox"
                checked={allVisibleSelected}
                onChange={toggleSelectAllVisible}
                className="h-3.5 w-3.5 rounded border-slate-300 accent-rose-600"
              />
              <span>Chọn tất cả ({visibleValues.length})</span>
            </label>
          </div>

          {/* Value list */}
          <div className="max-h-44 overflow-y-auto pr-1">
            {visibleValues.map((val) => {
              const checked = draft.has(val)
              return (
                <label
                  key={val}
                  className="flex cursor-pointer items-center gap-2 rounded px-2 py-1 text-xs text-slate-700 hover:bg-slate-50 dark:text-slate-300 dark:hover:bg-slate-800/70"
                >
                  <input
                    type="checkbox"
                    checked={checked}
                    onChange={() => toggleValue(val)}
                    className="h-3.5 w-3.5 rounded border-slate-300 accent-rose-600"
                  />
                  <span className="truncate" title={val}>
                    {val}
                  </span>
                </label>
              )
            })}
          </div>

          {/* Footer buttons */}
          <div className="mt-2 flex items-center justify-between border-t border-slate-100 pt-2 dark:border-slate-800">
            <button
              type="button"
              onClick={handleClear}
              className="inline-flex items-center gap-1 rounded-md px-2 py-1 text-xs font-medium text-slate-500 hover:bg-slate-100 hover:text-slate-700 dark:text-slate-400 dark:hover:bg-slate-800"
            >
              <RotateCcw className="h-3 w-3" />
              Mặc định
            </button>
            <button
              type="button"
              onClick={handleApply}
              className="inline-flex items-center gap-1 rounded-md bg-rose-600 px-3 py-1 text-xs font-bold text-white shadow-xs hover:bg-rose-700"
            >
              <Check className="h-3 w-3" />
              Áp dụng
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
