import { type ClassValue, clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';
// @ts-ignore - date-fns v3 types resolve correctly at runtime
import { formatDistanceToNow, format, parseISO } from 'date-fns';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

// -----------------------------------------------
// Date / Time utilities
// -----------------------------------------------
export function formatRelativeTime(date: string | Date): string {
  const d = typeof date === 'string' ? parseISO(date) : date;
  return formatDistanceToNow(d, { addSuffix: true });
}

export function formatTimestamp(date: string | Date, fmt = 'dd MMM yyyy HH:mm'): string {
  const d = typeof date === 'string' ? parseISO(date) : date;
  return format(d, fmt);
}

export function formatDuration(seconds: number): string {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = seconds % 60;
  if (h > 0) return `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
  return `${m}:${String(s).padStart(2, '0')}`;
}

export function formatVideoTimestamp(seconds: number): string {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = Math.floor(seconds % 60);
  const ms = Math.floor((seconds % 1) * 1000);
  if (h > 0) {
    return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}.${String(ms).padStart(3, '0')}`;
  }
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}.${String(ms).padStart(3, '0')}`;
}

// -----------------------------------------------
// File utilities
// -----------------------------------------------
export function formatFileSize(bytes: number): string {
  if (bytes === 0) return '0 B';
  const units = ['B', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(1024));
  return `${(bytes / Math.pow(1024, i)).toFixed(1)} ${units[i]}`;
}

export function getFileExtension(filename: string): string {
  return filename.split('.').pop()?.toLowerCase() ?? '';
}

export function isVideoFile(filename: string): boolean {
  return ['mp4', 'avi', 'mov', 'mkv', 'webm'].includes(getFileExtension(filename));
}

export function isImageFile(filename: string): boolean {
  return ['jpg', 'jpeg', 'png', 'webp', 'gif', 'bmp'].includes(getFileExtension(filename));
}

// -----------------------------------------------
// Color / Status utilities
// -----------------------------------------------
export function getStatusColor(status: string): string {
  const map: Record<string, string> = {
    active: 'text-success',
    pending: 'text-warning',
    closed: 'text-muted-foreground',
    archived: 'text-muted-foreground',
    processed: 'text-success',
    processing: 'text-accent',
    failed: 'text-danger',
    uploaded: 'text-muted-foreground',
    reviewed: 'text-primary',
  };
  return map[status] ?? 'text-muted-foreground';
}

export function getStatusBadgeClass(status: string): string {
  const map: Record<string, string> = {
    active: 'badge-active',
    processing: 'badge-info',
    processed: 'badge-active',
    pending: 'badge-pending',
    failed: 'badge-critical',
    closed: 'text-xs font-medium px-2 py-0.5 rounded border border-border text-muted-foreground',
    critical: 'badge-critical',
    high: 'badge-pending',
    medium: 'badge-info',
    low: 'text-xs font-medium px-2 py-0.5 rounded border border-border text-muted-foreground',
  };
  return map[status] ?? 'badge-info';
}

export function getPriorityColor(priority: string): string {
  const map: Record<string, string> = {
    critical: 'text-danger',
    high: 'text-warning',
    medium: 'text-accent',
    low: 'text-muted-foreground',
  };
  return map[priority] ?? 'text-muted-foreground';
}

export function getConfidenceColor(confidence: number): string {
  if (confidence >= 85) return 'bg-success';
  if (confidence >= 70) return 'bg-warning';
  if (confidence >= 50) return 'bg-accent';
  return 'bg-danger';
}

export function getConfidenceLabel(confidence: number): string {
  if (confidence >= 90) return 'Very High';
  if (confidence >= 75) return 'High';
  if (confidence >= 60) return 'Medium';
  if (confidence >= 40) return 'Low';
  return 'Very Low';
}

// -----------------------------------------------
// String utilities
// -----------------------------------------------
export function truncate(str: string, maxLen: number): string {
  if (str.length <= maxLen) return str;
  return `${str.slice(0, maxLen)}...`;
}

export function capitalize(str: string): string {
  return str.charAt(0).toUpperCase() + str.slice(1);
}

export function initials(name: string): string {
  return name
    .split(' ')
    .map((part) => part.charAt(0).toUpperCase())
    .slice(0, 2)
    .join('');
}

// -----------------------------------------------
// Evidence type icons
// -----------------------------------------------
export function getEvidenceTypeIcon(type: string): string {
  const map: Record<string, string> = {
    video: 'video',
    image: 'image',
    bodycam: 'camera',
    drone: 'plane',
    audio: 'mic',
    document: 'file-text',
  };
  return map[type] ?? 'file';
}

// -----------------------------------------------
// ID generation
// -----------------------------------------------
export function generateId(prefix = 'id'): string {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

// -----------------------------------------------
// Number formatting
// -----------------------------------------------
export function formatNumber(n: number, decimals = 0): string {
  return new Intl.NumberFormat('en-US', {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  }).format(n);
}
