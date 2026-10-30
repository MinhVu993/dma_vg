'use client'

import React from 'react'
import { FlowStep, LegacyApprovalItem } from '@/lib/flow-utils'
import { useTranslation } from '@/hooks/useTranslation'
import {
  Check,
  X,
  Clock,
  UserCheck,
  AlertCircle,
} from 'lucide-react'

interface AppFlowStepperProps {
  flowSteps: FlowStep[]
  status?: (boolean | null)[]
  approval?: (LegacyApprovalItem | null)[]
  compact?: boolean
}

export function AppFlowStepper({
  flowSteps,
  status = [null, null, null, null],
  approval = [null, null, null, null],
  compact = false,
}: AppFlowStepperProps) {
  const { t } = useTranslation()

  const stepLabels = [
    t.flow.deptManager,
    t.flow.gaManager,
    t.flow.smpManager,
    t.flow.gmManager,
  ]

  const hasDenied = status.includes(false)
  const pendingIdx = hasDenied ? -1 : status.findIndex((s) => s === null)

  return (
    <div className="rounded-lg border border-[#e2e8f0] bg-white px-3 py-2 shadow-2xs">
      <div className="mb-2 flex items-center justify-between border-b border-slate-100 pb-1.5">
        <div className="flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wider text-slate-800">
          <UserCheck className="h-3.5 w-3.5 text-rose-600" />
          <span>{t.flow.title}</span>
        </div>
      </div>

      {/* Horizontal Connected Stepper - Ultra Compact */}
      <div className="flex w-full items-center justify-between gap-1 overflow-x-auto">
        {[0, 1, 2, 3].map((idx) => {
          const step = flowSteps[idx] || {
            lvl_code: '',
            managers: [],
            deputies: [],
          }
          const st = status[idx]
          const appLog = approval[idx]
          const isCurrentPending = idx === pendingIdx
          const isLast = idx === 3

          // Status circle styles
          let circleBg = 'bg-slate-200 text-slate-500'
          let circleBorder = 'border-slate-300'
          let IconComponent = Clock

          if (st === true) {
            circleBg = 'bg-rose-600 text-white shadow-2xs'
            circleBorder = 'border-rose-600'
            IconComponent = Check
          } else if (st === false) {
            circleBg = 'bg-red-700 text-white shadow-2xs'
            circleBorder = 'border-red-700'
            IconComponent = X
          } else if (isCurrentPending) {
            circleBg = 'bg-amber-500 text-white shadow-2xs'
            circleBorder = 'border-amber-500'
            IconComponent = Clock
          }

          // Active deputies list
          const activeDeputies = (step.deputies || []).filter(
            (d) => d && d.status !== false
          )

          return (
            <React.Fragment key={idx}>
              <div className="flex flex-1 items-center gap-2 min-w-0">
                {/* Stepper Node Circle - Compact 22px */}
                <div
                  className={`relative flex h-5.5 w-5.5 shrink-0 items-center justify-center rounded-full border transition-all ${circleBg} ${circleBorder}`}
                >
                  <IconComponent className="h-3 w-3 stroke-[2.5]" />
                </div>

                {/* Step Content - Inline / Compact Typography */}
                <div className="min-w-0 flex-1 leading-tight">
                  <div className="truncate text-[10px] font-medium text-slate-500">
                    {stepLabels[idx]}
                  </div>

                  <div className="truncate text-[11px] font-bold text-slate-800">
                    {st === true && appLog?.name ? (
                      <span className="text-emerald-700">
                        {appLog.name}
                        {appLog.date ? ` (${appLog.date.slice(0, 10)})` : ''}
                      </span>
                    ) : st === false && appLog?.name ? (
                      <span className="text-rose-700">
                        {appLog.name} (Từ chối)
                      </span>
                    ) : step.managers && step.managers.length > 0 ? (
                      <span>{step.managers.map((m) => m.name).join(', ')}</span>
                    ) : (
                      <span className="italic text-slate-400">--</span>
                    )}
                  </div>

                  {/* Deputies (Người ủy quyền) - Compact inline */}
                  {activeDeputies.length > 0 && (
                    <div className="truncate text-[10px] text-slate-400">
                      <span>Ủy quyền: </span>
                      <span className="font-medium text-slate-600">
                        {activeDeputies.map((d) => d.name).join(', ')}
                      </span>
                    </div>
                  )}
                </div>
              </div>

              {/* Connecting Horizontal Line between steps */}
              {!isLast && (
                <div className="mx-1 h-[1px] w-6 shrink-0 bg-slate-300 lg:w-10" />
              )}
            </React.Fragment>
          )
        })}
      </div>
    </div>
  )
}
