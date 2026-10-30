'use client'

import React, { useState } from 'react'
import Link from 'next/link'
import { TabNav } from './TabNav'
import { useSession } from '@/context/SessionContext'
import { useTranslation } from '@/hooks/useTranslation'
import { useDialog } from '@/context/DialogContext'
import { LocaleCode } from '@/locales'
import { RefreshCw } from 'lucide-react'

export function Header() {
  const { user, locale, setLocale } = useSession()
  const { t } = useTranslation()
  const { showToast } = useDialog()
  const [syncing, setSyncing] = useState(false)

  const handleSyncMysql = async () => {
    if (syncing) return
    setSyncing(true)
    try {
      const res = await fetch('/api/sync/mysql', { method: 'POST' })
      const data = await res.json()
      if (res.ok && data.status === 'success') {
        showToast(
          'Đồng bộ thành công!',
          'Dữ liệu từ MySQL dorm_db đã được đồng bộ sang PostgreSQL vg_dma.',
          'success'
        )
        window.dispatchEvent(new CustomEvent('dma-data-updated'))
      } else {
        showToast(
          'Đồng bộ thất bại',
          data.details || 'Không thể kết nối MySQL',
          'error'
        )
      }
    } catch (err: any) {
      showToast('Lỗi đồng bộ', err?.message, 'error')
    } finally {
      setSyncing(false)
    }
  }

  return (
    <header className="sticky top-0 z-50 min-h-[52px] w-full shrink-0 border-b border-[#d8dce2] bg-[#f1f3f6] backdrop-blur-xl print:hidden">
      <div className="flex h-[52px] w-full items-center justify-between px-3 sm:px-5 lg:px-6">
        {/* Left: Brand Logo */}
        <div className="flex items-center space-x-3.5">
          <Link
            href="/"
            className="group flex items-center space-x-2.5 rounded-lg focus-visible:outline-none"
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src="/logo.png"
              alt="Logo"
              width={36}
              height={32}
              className="h-8 w-auto max-w-[36px] object-contain drop-shadow-xs transition-transform group-hover:scale-105"
            />
            <div>
              <div className="flex items-center space-x-2 leading-none">
                <span className="text-sm font-extrabold uppercase tracking-tight text-zinc-900">
                  {t.app.title}
                </span>
              </div>
            </div>
          </Link>
        </div>

        {/* Center: Header Menu Tabs */}
        <div className="hidden md:flex">
          <TabNav />
        </div>

        {/* Right: Quick Tools, Language Switcher & Active User */}
        <div className="flex items-center">
          {/* Sync MySQL Button */}
          <button
            type="button"
            onClick={handleSyncMysql}
            disabled={syncing}
            title="Đồng bộ dữ liệu từ MySQL dorm_db sang PostgreSQL vg_dma"
            className="mr-3 inline-flex h-7 items-center gap-1.5 rounded-md bg-teal-600 px-2.5 text-xs font-bold text-white shadow-2xs transition-colors hover:bg-teal-700 disabled:opacity-60 sm:mr-4"
          >
            <RefreshCw
              className={`h-3 w-3 ${syncing ? 'animate-spin' : ''}`}
            />
            <span className="hidden sm:inline">{t.common.syncMysql}</span>
          </button>

          {/* Language Switcher: VI / 中文 / EN */}
          <div className="flex select-none items-center text-xs font-semibold">
            {(
              [
                { code: 'vi', label: 'VI' },
                { code: 'cn', label: '中文' },
                { code: 'en', label: 'EN' },
              ] as { code: LocaleCode; label: string }[]
            ).map((item, idx) => (
              <React.Fragment key={item.code}>
                {idx > 0 && (
                  <span className="mx-2 select-none text-slate-300">
                    /
                  </span>
                )}
                <button
                  type="button"
                  onClick={() => setLocale(item.code)}
                  className={`cursor-pointer transition-colors duration-150 ${
                    locale === item.code
                      ? 'font-bold text-[#EA580C]'
                      : 'text-slate-500 hover:text-slate-800'
                  }`}
                >
                  {item.label}
                </button>
              </React.Fragment>
            ))}
          </div>

          {/* Vertical Divider */}
          <div className="mx-3 h-6 w-[1px] bg-slate-300 sm:mx-4" />

          {/* User Profile Info from active login session */}
          <div className="flex items-center gap-2 rounded-lg px-2 py-1 leading-tight">
            <div>
              <div className="max-w-[200px] truncate text-[13px] font-bold tracking-tight text-slate-900">
                {user.name
                  ? `${user.empno ? user.empno + ' - ' : ''}${user.name}`
                  : 'Đang tải người dùng...'}
              </div>
              <div className="mt-0.5 max-w-[200px] truncate text-[11px] font-normal tracking-tight text-slate-500">
                {user.dept
                  ? `${user.dept}${user.ext ? ' | Ext: ' + user.ext : ''}`
                  : user.email || ''}
              </div>
            </div>
          </div>
        </div>
      </div>
    </header>
  )
}
