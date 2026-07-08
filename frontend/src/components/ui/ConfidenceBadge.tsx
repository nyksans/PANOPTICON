import React from 'react'
import { cn } from '@/lib/utils'

interface ConfidenceBadgeProps {
  confidence?: number;
  score?: number;
  className?: string;
  size?: 'sm' | 'md' | 'lg';
  showBar?: boolean;
  showLabel?: boolean;
}

export function ConfidenceBadge({ confidence, score, className, size = 'md', showBar, showLabel = true }: ConfidenceBadgeProps) {
  const val = confidence ?? score ?? 0;
  // If the value is > 1 (e.g. 87 instead of 0.87), use it as percentage directly
  const percentage = val <= 1 ? val * 100 : val;
  
  const getColor = (v: number) => {
    if (v >= 80) return 'bg-green-500/20 text-green-400 border-green-500/30'
    if (v >= 60) return 'bg-blue-500/20 text-blue-400 border-blue-500/30'
    if (v >= 40) return 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30'
    return 'bg-red-500/20 text-red-400 border-red-500/30'
  }

  const getBarColor = (v: number) => {
    if (v >= 80) return 'bg-green-500'
    if (v >= 60) return 'bg-blue-500'
    if (v >= 40) return 'bg-yellow-500'
    return 'bg-red-500'
  }

  return (
    <div className={cn("flex items-center gap-2", className)}>
      <span
        className={cn(
          'inline-flex items-center rounded-full font-medium border',
          size === 'sm' ? 'px-1.5 py-0.5 text-[10px]' : 'px-2.5 py-0.5 text-xs',
          getColor(percentage)
        )}
      >
        {percentage.toFixed(0)}% {showLabel && 'Confidence'}
      </span>
      {showBar && (
        <div className="w-16 h-1.5 bg-white/10 rounded-full overflow-hidden">
          <div 
            className={cn("h-full rounded-full", getBarColor(percentage))} 
            style={{ width: `${percentage}%` }} 
          />
        </div>
      )}
    </div>
  )
}
