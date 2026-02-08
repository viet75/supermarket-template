'use client'

import { useState, useCallback, useEffect } from 'react'

export type Slot = { start: string; end: string }

const DAY_KEYS = ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun'] as const
const DAY_LABELS: Record<(typeof DAY_KEYS)[number], string> = {
  mon: 'Lunedì',
  tue: 'Martedì',
  wed: 'Mercoledì',
  thu: 'Giovedì',
  fri: 'Venerdì',
  sat: 'Sabato',
  sun: 'Domenica',
}

export type WeeklyHours = {
  mon: Slot[]
  tue: Slot[]
  wed: Slot[]
  thu: Slot[]
  fri: Slot[]
  sat: Slot[]
  sun: Slot[]
}

const EMPTY_SLOT: Slot = { start: '09:00', end: '18:00' }
const DEFAULT_WEEKLY_HOURS: WeeklyHours = {
  mon: [{ start: '09:00', end: '19:30' }],
  tue: [{ start: '09:00', end: '19:30' }],
  wed: [{ start: '09:00', end: '19:30' }],
  thu: [{ start: '09:00', end: '19:30' }],
  fri: [{ start: '09:00', end: '19:30' }],
  sat: [{ start: '09:00', end: '13:00' }],
  sun: [],
}

// HH or HH:MM
const TIME_REGEX = /^([0-1]?[0-9]|2[0-3]):?([0-5][0-9])?$/

function normalizeTimeInput(s: string): string {
  const t = String(s).trim()
  if (!t) return '00:00'
  const m = t.match(TIME_REGEX)
  if (!m) return t
  const h = m[1].padStart(2, '0')
  const min = (m[2] ?? '00').padStart(2, '0')
  return `${h}:${min}`
}

export function isValidTime(s: string): boolean {
  const n = normalizeTimeInput(s)
  if (n.length !== 5) return false
  const [h, m] = n.split(':').map(Number)
  return h >= 0 && h <= 23 && m >= 0 && m <= 59
}

function compareTime(a: string, b: string): number {
  const [ha, ma] = normalizeTimeInput(a).split(':').map(Number)
  const [hb, mb] = normalizeTimeInput(b).split(':').map(Number)
  if (ha !== hb) return ha - hb
  return ma - mb
}

function slotsOverlap(slots: Slot[]): boolean {
  const sorted = [...slots].sort((a, b) => compareTime(a.start, b.start))
  for (let i = 1; i < sorted.length; i++) {
    if (compareTime(sorted[i - 1].end, sorted[i].start) > 0) return true
  }
  return false
}

function validateSlots(slots: Slot[]): string | null {
  for (const slot of slots) {
    if (!isValidTime(slot.start)) return `Ora inizio non valida: ${slot.start} (usare HH:MM)`
    if (!isValidTime(slot.end)) return `Ora fine non valida: ${slot.end} (usare HH:MM)`
    if (compareTime(slot.start, slot.end) >= 0) return `Ora fine deve essere dopo ora inizio (${slot.start}–${slot.end})`
  }
  if (slotsOverlap(slots)) return 'Fasce orarie sovrapposte nello stesso giorno'
  return null
}

function parseSlot(raw: unknown): Slot | null {
  if (raw && typeof raw === 'object' && 'start' in raw && 'end' in raw) {
    return { start: String((raw as Slot).start), end: String((raw as Slot).end) }
  }
  if (typeof raw === 'string' && /^\d{1,2}:\d{2}-\d{1,2}:\d{2}$/.test(raw)) {
    const [start, end] = raw.split('-')
    return { start: start.trim(), end: end.trim() }
  }
  return null
}

function parseDayValue(raw: unknown): Slot[] {
  if (raw == null) return []
  if (Array.isArray(raw)) {
    const out: Slot[] = []
    for (const item of raw) {
      const slot = parseSlot(item)
      if (slot) out.push(slot)
    }
    return out
  }
  const slot = parseSlot(raw)
  return slot ? [slot] : []
}

/** Parse API/JSON value into WeeklyHours. Idempotent, adds missing keys as []. */
export function parseWeeklyHours(raw: unknown): WeeklyHours {
  const result = { ...DEFAULT_WEEKLY_HOURS }
  if (raw == null) return result
  let obj: Record<string, unknown> | null = null
  if (typeof raw === 'string') {
    try {
      obj = JSON.parse(raw.trim()) as Record<string, unknown>
    } catch {
      return result
    }
  } else if (typeof raw === 'object' && raw !== null) {
    obj = raw as Record<string, unknown>
  }
  if (!obj) return result
  for (const key of DAY_KEYS) {
    if (key in obj) {
      result[key] = parseDayValue(obj[key])
    }
  }
  return result
}

/** Serialize to JSONB shape: sort slots by start, ensure all keys, trim times. */
export function serializeWeeklyHours(wh: WeeklyHours): Record<string, Slot[]> {
  const out: Record<string, Slot[]> = {}
  for (const key of DAY_KEYS) {
    let list = wh[key] ?? []
    list = list
      .map((s) => ({ start: normalizeTimeInput(s.start), end: normalizeTimeInput(s.end) }))
      .filter((s) => compareTime(s.start, s.end) < 0)
    list.sort((a, b) => compareTime(a.start, b.start))
    out[key] = list
  }
  return out
}

type Props = {
  value: WeeklyHours
  onChange: (value: WeeklyHours) => void
  onValidationChange?: (error: string | null) => void
}

export default function WeeklyHoursEditor({ value, onChange, onValidationChange }: Props) {
  const [jsonOpen, setJsonOpen] = useState(false)
  useEffect(() => {
    if (!onValidationChange) return
    let err: string | null = null
    for (const key of DAY_KEYS) {
      const e = validateSlots(value[key] ?? [])
      if (e) {
        err = `${DAY_LABELS[key]}: ${e}`
        break
      }
    }
    onValidationChange(err)
  }, [value, onValidationChange])

  const updateDay = useCallback(
    (day: (typeof DAY_KEYS)[number], slots: Slot[]) => {
      onChange({ ...value, [day]: slots })
    },
    [value, onChange]
  )

  const addSlot = useCallback(
    (day: (typeof DAY_KEYS)[number]) => {
      updateDay(day, [...(value[day] ?? []), { ...EMPTY_SLOT }])
    },
    [value, updateDay]
  )

  const removeSlot = useCallback(
    (day: (typeof DAY_KEYS)[number], index: number) => {
      const list = value[day] ?? []
      updateDay(day, list.filter((_, i) => i !== index))
    },
    [value, updateDay]
  )

  const setSlot = useCallback(
    (day: (typeof DAY_KEYS)[number], index: number, field: 'start' | 'end', v: string) => {
      const list = [...(value[day] ?? [])]
      if (!list[index]) return
      list[index] = { ...list[index], [field]: v }
      updateDay(day, list)
    },
    [value, updateDay]
  )

  const setClosed = useCallback(
    (day: (typeof DAY_KEYS)[number], closed: boolean) => {
      updateDay(day, closed ? [] : [{ ...EMPTY_SLOT }])
    },
    [updateDay]
  )

  let validationError: string | null = null
  for (const key of DAY_KEYS) {
    const err = validateSlots(value[key] ?? [])
    if (err) {
      validationError = `${DAY_LABELS[key]}: ${err}`
      break
    }
  }

  const serialized = serializeWeeklyHours(value)

  return (
    <div className="space-y-3">
      <div className="text-sm font-medium text-gray-700 dark:text-gray-300">Orari settimanali</div>
      {DAY_KEYS.map((day) => {
        const slots = value[day] ?? []
        const isClosed = slots.length === 0
        return (
          <div
            key={day}
            className="rounded-lg border border-gray-200 dark:border-gray-600 p-3 space-y-2 bg-gray-50/50 dark:bg-gray-800/30"
          >
            <div className="flex flex-wrap items-center justify-between gap-2">
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={!isClosed}
                  onChange={(e) => setClosed(day, !e.target.checked)}
                  className="rounded"
                />
                <span className="font-medium text-gray-900 dark:text-gray-100">{DAY_LABELS[day]}</span>
              </label>
              {!isClosed && (
                <button
                  type="button"
                  onClick={() => addSlot(day)}
                  className="text-sm text-green-600 dark:text-green-400 hover:underline"
                >
                  + Aggiungi fascia
                </button>
              )}
            </div>
            {!isClosed && (
              <ul className="space-y-2">
                {slots.map((slot, idx) => (
                  <li key={idx} className="flex flex-wrap items-center gap-2">
                    <input
                      type="text"
                      placeholder="09:00"
                      value={slot.start}
                      onChange={(e) => setSlot(day, idx, 'start', e.target.value)}
                      className="w-20 rounded border border-gray-300 dark:border-gray-600 px-2 py-1.5 text-sm dark:bg-gray-800 dark:text-gray-100"
                    />
                    <span className="text-gray-500">–</span>
                    <input
                      type="text"
                      placeholder="19:30"
                      value={slot.end}
                      onChange={(e) => setSlot(day, idx, 'end', e.target.value)}
                      className="w-20 rounded border border-gray-300 dark:border-gray-600 px-2 py-1.5 text-sm dark:bg-gray-800 dark:text-gray-100"
                    />
                    <button
                      type="button"
                      onClick={() => removeSlot(day, idx)}
                      className="text-red-600 dark:text-red-400 hover:underline text-sm"
                    >
                      Rimuovi
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        )
      })}
      {validationError && (
        <p className="text-sm text-red-600 dark:text-red-400" role="alert">
          {validationError}
        </p>
      )}
      <div className="mt-2">
        <button
          type="button"
          onClick={() => setJsonOpen((o) => !o)}
          className="text-sm text-gray-500 dark:text-gray-400 hover:underline"
        >
          {jsonOpen ? 'Nascondi' : 'Mostra'} anteprima JSON (solo lettura)
        </button>
        {jsonOpen && (
          <pre className="mt-2 p-3 rounded bg-gray-100 dark:bg-gray-800 text-xs overflow-auto max-h-48 border border-gray-200 dark:border-gray-700">
            {JSON.stringify(serialized, null, 2)}
          </pre>
        )}
      </div>
    </div>
  )
}

export { serializeWeeklyHours as weeklyHoursToApi, parseWeeklyHours as apiToWeeklyHours }
