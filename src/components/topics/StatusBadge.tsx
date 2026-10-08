'use client'

import type { Status } from '@/types'

const CONFIG: Record<Status, { label: string; className: string }> = {
  not_started: { label: 'Not started', className: 'bg-gray-100 text-gray-600' },
  teaching: { label: 'Teaching now', className: 'bg-amber-100 text-amber-700' },
  covered: { label: 'Covered', className: 'bg-green-100 text-green-700' },
}

const NEXT: Record<Status, Status> = {
  not_started: 'teaching',
  teaching: 'covered',
  covered: 'not_started',
}

interface Props {
  status: Status
  onToggle?: () => void
}

export default function StatusBadge({ status, onToggle }: Props) {
  const { label, className } = CONFIG[status]

  return (
    <button
      onClick={onToggle}
      title={`Change status (next: ${CONFIG[NEXT[status]].label})`}
      className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium transition-opacity hover:opacity-80 ${className} ${onToggle ? 'cursor-pointer' : 'cursor-default'}`}
    >
      {label}
    </button>
  )
}

export { NEXT }
