'use client'

import React, {
  createContext,
  useContext,
  useState,
  useCallback,
  useEffect,
} from 'react'
import {
  CheckCircle2,
  AlertTriangle,
  XCircle,
  Info,
  X,
} from 'lucide-react'

export type DialogVariant = 'success' | 'error' | 'warning' | 'info' | 'confirm'

interface DialogState {
  open: boolean
  title: string
  message: string
  variant: DialogVariant
  confirmText?: string
  cancelText?: string
  onConfirm?: () => void
  onCancel?: () => void
}

interface ToastItem {
  id: string
  title: string
  message?: string
  variant: 'success' | 'error' | 'warning' | 'info'
}

interface DialogContextType {
  showAlert: (
    title: string,
    message: string,
    variant?: 'success' | 'error' | 'warning' | 'info'
  ) => void
  showConfirm: (options: {
    title: string
    message: string
    confirmText?: string
    cancelText?: string
    onConfirm: () => void
  }) => void
  showToast: (
    title: string,
    message?: string,
    variant?: 'success' | 'error' | 'warning' | 'info'
  ) => void
}

const DialogContext = createContext<DialogContextType>({
  showAlert: () => {},
  showConfirm: () => {},
  showToast: () => {},
})

export function DialogProvider({ children }: { children: React.ReactNode }) {
  const [dialog, setDialog] = useState<DialogState>({
    open: false,
    title: '',
    message: '',
    variant: 'info',
  })
  const [toasts, setToasts] = useState<ToastItem[]>([])

  const showToast = useCallback(
    (
      title: string,
      message?: string,
      variant: 'success' | 'error' | 'warning' | 'info' = 'info'
    ) => {
      const id = `${Date.now()}-${Math.random()}`
      setToasts((prev) => [...prev, { id, title, message, variant }])
      setTimeout(() => {
        setToasts((prev) => prev.filter((t) => t.id !== id))
      }, 4000)
    },
    []
  )

  const showAlert = useCallback(
    (
      title: string,
      message: string,
      variant: 'success' | 'error' | 'warning' | 'info' = 'info'
    ) => {
      setDialog({
        open: true,
        title,
        message,
        variant,
        confirmText: 'Đóng',
      })
    },
    []
  )

  const showConfirm = useCallback(
    (options: {
      title: string
      message: string
      confirmText?: string
      cancelText?: string
      onConfirm: () => void
    }) => {
      setDialog({
        open: true,
        title: options.title,
        message: options.message,
        variant: 'confirm',
        confirmText: options.confirmText || 'Xác nhận',
        cancelText: options.cancelText || 'Hủy',
        onConfirm: options.onConfirm,
      })
    },
    []
  )

  const closeDialog = useCallback(() => {
    setDialog((prev) => ({ ...prev, open: false }))
  }, [])

  useEffect(() => {
    if (!dialog.open) return
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        closeDialog()
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [dialog.open, closeDialog])

  return (
    <DialogContext.Provider value={{ showAlert, showConfirm, showToast }}>
      {children}

      {/* Floating Toasts */}
      <div className="fixed bottom-5 right-5 z-[100] flex flex-col gap-2.5">
        {toasts.map((toast) => (
          <div
            key={toast.id}
            className="flex min-w-[300px] max-w-md items-start gap-3 rounded-xl border border-[#d8dce2] bg-white p-3.5 shadow-xl transition-all dark:border-[#26262C] dark:bg-[#18181C]"
          >
            {toast.variant === 'success' && (
              <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-emerald-500" />
            )}
            {toast.variant === 'error' && (
              <XCircle className="mt-0.5 h-4 w-4 shrink-0 text-rose-500" />
            )}
            {toast.variant === 'warning' && (
              <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-amber-500" />
            )}
            {toast.variant === 'info' && (
              <Info className="mt-0.5 h-4 w-4 shrink-0 text-sky-500" />
            )}
            <div className="flex-1 text-xs">
              <div className="font-bold text-slate-900 dark:text-slate-100">
                {toast.title}
              </div>
              {toast.message && (
                <div className="mt-0.5 text-slate-600 dark:text-slate-400">
                  {toast.message}
                </div>
              )}
            </div>
            <button
              type="button"
              onClick={() =>
                setToasts((prev) => prev.filter((t) => t.id !== toast.id))
              }
              className="cursor-pointer text-slate-400 hover:text-slate-600"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        ))}
      </div>

      {/* Modal Dialog */}
      {dialog.open && (
        <div
          className="fixed inset-0 z-[110] flex items-center justify-center bg-slate-900/50 p-4 backdrop-blur-xs"
          role="dialog"
          aria-modal="true"
          onClick={closeDialog}
        >
          <div
            className="w-full max-w-md rounded-2xl border border-[#d8dce2] bg-white p-6 shadow-2xl dark:border-[#26262C] dark:bg-[#18181C]"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-start gap-3.5">
              {dialog.variant === 'success' && (
                <div className="rounded-full bg-emerald-100 p-2 text-emerald-600 dark:bg-emerald-950 dark:text-emerald-400">
                  <CheckCircle2 className="h-5 w-5" />
                </div>
              )}
              {dialog.variant === 'error' && (
                <div className="rounded-full bg-rose-100 p-2 text-rose-600 dark:bg-rose-950 dark:text-rose-400">
                  <XCircle className="h-5 w-5" />
                </div>
              )}
              {(dialog.variant === 'warning' ||
                dialog.variant === 'confirm') && (
                <div className="rounded-full bg-amber-100 p-2 text-amber-600 dark:bg-amber-950 dark:text-amber-400">
                  <AlertTriangle className="h-5 w-5" />
                </div>
              )}
              {dialog.variant === 'info' && (
                <div className="rounded-full bg-sky-100 p-2 text-sky-600 dark:bg-sky-950 dark:text-sky-400">
                  <Info className="h-5 w-5" />
                </div>
              )}
              <div className="flex-1">
                <h3 className="text-base font-bold text-slate-900 dark:text-slate-100">
                  {dialog.title}
                </h3>
                <p className="mt-1.5 whitespace-pre-line text-sm text-slate-600 dark:text-slate-300">
                  {dialog.message}
                </p>
              </div>
            </div>

            <div className="mt-6 flex justify-end gap-2.5">
              {dialog.variant === 'confirm' && (
                <button
                  type="button"
                  onClick={closeDialog}
                  className="h-8 cursor-pointer rounded-lg border border-[#d0d5dd] bg-white px-4 text-xs font-bold text-slate-700 hover:bg-slate-50 dark:border-[#26262C] dark:bg-[#131316] dark:text-slate-300 dark:hover:bg-[#222228]"
                >
                  {dialog.cancelText || 'Hủy'}
                </button>
              )}
              <button
                type="button"
                onClick={() => {
                  const fn = dialog.onConfirm
                  closeDialog()
                  if (fn) fn()
                }}
                className="h-8 cursor-pointer rounded-lg bg-rose-600 px-4 text-xs font-bold text-white shadow-xs hover:bg-rose-700"
              >
                {dialog.confirmText || 'OK'}
              </button>
            </div>
          </div>
        </div>
      )}
    </DialogContext.Provider>
  )
}

export function useDialog() {
  return useContext(DialogContext)
}
