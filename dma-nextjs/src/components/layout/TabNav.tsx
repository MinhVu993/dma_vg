'use client'

import React from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { motion } from 'framer-motion'
import { useTranslation } from '@/hooks/useTranslation'
import {
  ClipboardCheck,
  BedDouble,
  FileSpreadsheet,
} from 'lucide-react'

export function TabNav() {
  const pathname = usePathname()
  const { t } = useTranslation()

  const tabs = [
    {
      id: 'requests',
      href: '/',
      label: t.nav.requests,
      icon: ClipboardCheck,
      active: pathname === '/' || pathname.startsWith('/requests'),
    },
    {
      id: 'rooms',
      href: '/rooms',
      label: t.nav.rooms,
      icon: BedDouble,
      active: pathname.startsWith('/rooms'),
    },
    {
      id: 'exports',
      href: '/exports',
      label: t.nav.exports,
      icon: FileSpreadsheet,
      active: pathname.startsWith('/exports'),
    },
  ]

  return (
    <nav
      className="no-scrollbar flex items-center space-x-1 overflow-x-auto"
      aria-label="Điều hướng chính"
    >
      {tabs.map((tab) => {
        return (
          <Link
            key={tab.id}
            href={tab.href}
            aria-current={tab.active ? 'page' : undefined}
            className={`relative flex h-8 items-center justify-center rounded-lg px-3.5 text-xs font-bold transition-all active:scale-[0.98] ${
              tab.active
                ? 'bg-rose-50 text-rose-600'
                : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
            }`}
          >
            <span className="whitespace-nowrap">{tab.label}</span>
          </Link>
        )
      })}
    </nav>
  )
}
