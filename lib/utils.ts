import { clsx, type ClassValue } from 'clsx'
import { twMerge } from 'tailwind-merge'

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

// Format a date string coming from the backend which is often in the
// YYYY-MM-DD form. Creating a Date from that string (`new Date('2026-10-29')`)
// is parsed as UTC and may show the previous day in local timezones (e.g. UTC-3).
// This helper will parse YYYY-MM-DD as a local date and fall back to normal
// Date parsing for other formats.
export function formatDateString(dateStr?: string | null, locale = "pt-BR") {
  if (!dateStr) return ""

  const m = dateStr.match(/^(\d{4})-(\d{2})-(\d{2})$/)
  if (m) {
    const y = Number(m[1])
    const mo = Number(m[2]) - 1
    const d = Number(m[3])
    return new Date(y, mo, d).toLocaleDateString(locale)
  }

  const dt = new Date(dateStr)
  if (isNaN(dt.getTime())) return dateStr
  return dt.toLocaleDateString(locale)
}
