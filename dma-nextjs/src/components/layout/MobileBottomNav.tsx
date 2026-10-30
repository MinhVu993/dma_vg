'use client'

import React from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useTranslation } from '@/hooks/useTranslation'
import {
  ClipboardCheck,
  BedDouble,
  FileSpreadsheet,
} from 'lucide-react'

export function MobileBottomNav() {
  const pathname = usePathname()
  const { t } = useTranslation()

  const items = [
    {
      href: '/',
      label: t.nav.requests,
      icon: ClipboardCheck,
      active: pathname === '/' || pathname.startsWith('/requests'),
    },
    {
      href: '/rooms',
      label: t.nav.rooms,
      icon: BedDouble,
      active: pathname.startsWith('/rooms'),
    },
    {
      href: '/exports',
      label: t.nav.exports,
      icon: FileSpreadsheet,
      active: pathname.startsWith('/exports'),
    },
  ]

  return (
    <div className="fixed inset-x-0 bottom-0 z-40 border-t border-[#d8dce2] bg-[#f1f3f6]/95 backdrop-blur-md md:hidden dark:border-[#26262C] dark:bg-[#18181C]/95">
      <div className="grid grid-cols-3">
        {items.map((item) => {
          const Icon = item.icon
          return (
            <Link
              key={item.href}
              href={item.href}
              className={`flex flex-col items-center justify-center gap-1 py-2 text-[11px] font-bold transition-colors ${
                item.active
                  ? 'text-rose-600 dark:text-rose-400'
                  : 'text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white'
              }`}
            >
              <Icon className="h-4 w-4" />
              <span className="max-w-[85px] truncate">{item.label}</span>
            </Link>
          )
        })}
      </div>
    </div>
  )
}
