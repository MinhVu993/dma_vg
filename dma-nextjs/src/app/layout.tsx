import type { Metadata, Viewport } from 'next'
import './globals.css'
import { SessionProvider } from '@/context/SessionContext'
import { DialogProvider } from '@/context/DialogContext'
import { Header } from '@/components/layout/Header'
import { MobileBottomNav } from '@/components/layout/MobileBottomNav'

export const metadata: Metadata = {
  title: 'VG Dormitory Management System (DMA)',
  description:
    'Hệ thống đăng ký, phê duyệt 4 cấp và quản lý lưu trú ký túc xá Cansports VG',
  icons: {
    icon: '/logo.png',
  },
}

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  viewportFit: 'cover',
  interactiveWidget: 'resizes-content',
  themeColor: '#eaedf0',
  colorScheme: 'light',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="vi" className="light" suppressHydrationWarning>
      <body
        suppressHydrationWarning
        className="flex h-[100dvh] w-full flex-col overflow-hidden bg-[#eaedf0] font-sans text-slate-900 antialiased"
      >
        <SessionProvider>
          <DialogProvider>
            <Header />
            <main
              id="main-content"
              className="flex min-h-0 w-full flex-1 flex-col overflow-y-auto pb-16 md:pb-0"
            >
              {children}
            </main>
            <MobileBottomNav />
          </DialogProvider>
        </SessionProvider>
      </body>
    </html>
  )
}
