import React from 'react'
import { cn } from '@/lib/utils'

interface StatusBadgeProps {
  status: 'active' | 'pending' | 'completed' | 'failed' | 'processing' | 'closed' | 'archived'
  className?: string
}

export function StatusBadge({ status, className }: StatusBadgeProps) {
  const statusStyles = {
    active: 'bg-green-500/20 text-green-400 border-green-500/30',
    pending: 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30',
    completed: 'bg-blue-500/20 text-blue-400 border-blue-500/30',
    failed: 'bg-red-500/20 text-red-400 border-red-500/30',
    processing: 'bg-purple-500/20 text-purple-400 border-purple-500/30',
    closed: 'bg-slate-500/20 text-slate-400 border-slate-500/30',
    archived: 'bg-slate-600/20 text-slate-400 border-slate-600/30',
  }

  const statusLabels = {
    active: 'Active',
    pending: 'Pending',
    completed: 'Completed',
    failed: 'Failed',
    processing: 'Processing',
    closed: 'Closed',
    archived: 'Archived',
  }

  return (
    <span
      className={cn(
        'inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium border',
        statusStyles[status],
        className
      )}
    >
      {statusLabels[status]}
    </span>
  )
}
