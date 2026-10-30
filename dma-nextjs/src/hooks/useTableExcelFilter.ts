'use client'

import { useState, useMemo, useCallback } from 'react'

export type SortDirection = 'asc' | 'desc' | null

export interface SortConfig {
  key: string
  direction: SortDirection
}

export function useTableExcelFilter<T>(
  data: T[],
  accessorMap: Record<string, (row: T) => string | number>
) {
  const [columnFilters, setColumnFilters] = useState<Record<string, Set<string>>>(
    {}
  )
  const [sortConfig, setSortConfig] = useState<SortConfig>({
    key: '',
    direction: null,
  })

  const getUniqueValues = useCallback(
    (colKey: string): string[] => {
      const getter = accessorMap[colKey]
      if (!getter) return []
      const set = new Set<string>()
      data.forEach((row) => {
        const val = String(getter(row) ?? '').trim()
        set.add(val || '(Trống)')
      })
      return Array.from(set).sort((a, b) =>
        a.localeCompare(b, undefined, { numeric: true, sensitivity: 'base' })
      )
    },
    [data, accessorMap]
  )

  const setFilterForColumn = useCallback(
    (colKey: string, selectedValues: Set<string> | null) => {
      setColumnFilters((prev) => {
        const next = { ...prev }
        if (!selectedValues || selectedValues.size === 0) {
          delete next[colKey]
        } else {
          next[colKey] = selectedValues
        }
        return next
      })
    },
    []
  )

  const clearAllColumnFilters = useCallback(() => {
    setColumnFilters({})
    setSortConfig({ key: '', direction: null })
  }, [])

  const toggleSort = useCallback((colKey: string, dir?: SortDirection) => {
    setSortConfig((prev) => {
      if (dir !== undefined) {
        return { key: colKey, direction: dir }
      }
      if (prev.key !== colKey) return { key: colKey, direction: 'asc' }
      if (prev.direction === 'asc') return { key: colKey, direction: 'desc' }
      return { key: '', direction: null }
    })
  }, [])

  const filteredAndSortedData = useMemo(() => {
    let result = data.filter((row) => {
      for (const [colKey, selectedSet] of Object.entries(columnFilters)) {
        if (!selectedSet || selectedSet.size === 0) continue
        const getter = accessorMap[colKey]
        if (!getter) continue
        const val = String(getter(row) ?? '').trim() || '(Trống)'
        if (!selectedSet.has(val)) {
          return false
        }
      }
      return true
    })

    if (sortConfig.key && sortConfig.direction) {
      const getter = accessorMap[sortConfig.key]
      if (getter) {
        const factor = sortConfig.direction === 'asc' ? 1 : -1
        result = [...result].sort((a, b) => {
          const valA = getter(a)
          const valB = getter(b)
          if (typeof valA === 'number' && typeof valB === 'number') {
            return (valA - valB) * factor
          }
          return (
            String(valA ?? '').localeCompare(String(valB ?? ''), undefined, {
              numeric: true,
              sensitivity: 'base',
            }) * factor
          )
        })
      }
    }

    return result
  }, [data, columnFilters, sortConfig, accessorMap])

  const activeFilterCount = Object.keys(columnFilters).length

  return {
    filteredData: filteredAndSortedData,
    columnFilters,
    sortConfig,
    getUniqueValues,
    setFilterForColumn,
    clearAllColumnFilters,
    toggleSort,
    activeFilterCount,
  }
}

