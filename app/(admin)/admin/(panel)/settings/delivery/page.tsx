'use client'

import { useEffect, useState } from 'react'
import WeeklyHoursEditor, {
  type WeeklyHours,
  parseWeeklyHours,
} from '../components/WeeklyHoursEditor'

type DeliverySettings = {
  delivery_enabled: boolean
  delivery_base_km: number
  delivery_base_fee: number
  delivery_extra_fee_per_km: number
  delivery_max_km: number
  payment_methods?: string[]
  cutoff_time?: string | null
  accept_orders_when_closed?: boolean
  timezone?: string | null
  preparation_days?: number
  closed_dates?: string[] | null
  weekly_hours?: Record<string, { start: string; end: string }[]> | null
  closed_message?: string | null
}

function numToDisplay(value: number | null | undefined): string {
  return value === 0 || value == null ? '' : String(value)
}

function parseOptionalNumber(v: string): number | null {
  const s = String(v).trim()
  if (s === '') return null
  const n = Number(s)
  return Number.isFinite(n) ? n : null
}

const YYYY_MM_DD = /^\d{4}-\d{2}-\d{2}$/

/** Estrae date valide YYYY-MM-DD da testo (newline, spazi, tab, virgole). Deduplica e ordina. */
function parseClosedDates(input: string): string[] {
  const tokens = input.split(/[\s,]+/).map((s) => s.trim()).filter(Boolean)
  const valid = tokens.filter((t) => YYYY_MM_DD.test(t))
  const unique = [...new Set(valid)]
  unique.sort((a, b) => a.localeCompare(b))
  return unique
}

/** Formatta l'array di date per la textarea (una per riga). */
function formatClosedDates(dates: string[]): string {
  return Array.isArray(dates) ? dates.join('\n') : ''
}

export default function DeliverySettingsPage() {
  const [settings, setSettings] = useState<DeliverySettings | null>(null)
  const [paymentMethods, setPaymentMethods] = useState<string[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState(false)
  const [cutoffTime, setCutoffTime] = useState('19:00')
  const [acceptWhenClosed, setAcceptWhenClosed] = useState(true)
  const [timezone, setTimezone] = useState('Europe/Rome')
  const [preparationDays, setPreparationDays] = useState(0)
  const [closedDatesText, setClosedDatesText] = useState('')
  const [closedMessage, setClosedMessage] = useState('')
  const [weeklyHours, setWeeklyHours] = useState<WeeklyHours>(() => parseWeeklyHours(null))

  // Valori visualizzati per i campi numerici: vuoto se 0, altrimenti stringa
  const [numDisplay, setNumDisplay] = useState({
    delivery_base_km: '',
    delivery_base_fee: '',
    delivery_extra_fee_per_km: '',
    delivery_max_km: '',
  })

  // Caricamento iniziale
  useEffect(() => {
    fetch('/api/admin/settings/delivery')
      .then((res) => res.json())
      .then((data) => {
        setSettings(data.settings)
        if (Array.isArray(data.settings?.payment_methods)) {
          setPaymentMethods(data.settings.payment_methods)
        } else {
          setPaymentMethods([])
        }
        const s = data.settings
        setNumDisplay({
          delivery_base_km: numToDisplay(s?.delivery_base_km),
          delivery_base_fee: numToDisplay(s?.delivery_base_fee),
          delivery_extra_fee_per_km: numToDisplay(s?.delivery_extra_fee_per_km),
          delivery_max_km: numToDisplay(s?.delivery_max_km),
        })
        setCutoffTime(s?.cutoff_time ?? '19:00')
        setAcceptWhenClosed(s?.accept_orders_when_closed !== false)
        setTimezone(s?.timezone ?? 'Europe/Rome')
        setPreparationDays(typeof s?.preparation_days === 'number' ? s.preparation_days : 0)
        setClosedDatesText(formatClosedDates(Array.isArray(s?.closed_dates) ? s.closed_dates : []))
        setClosedMessage(typeof s?.closed_message === 'string' ? s.closed_message : '')
        setWeeklyHours(parseWeeklyHours(s?.weekly_hours))
        setLoading(false)
      })
      .catch(() => {
        setError('Errore nel caricamento delle impostazioni')
        setLoading(false)
      })
  }, [])

  function update<K extends keyof DeliverySettings>(key: K, value: DeliverySettings[K]) {
    if (!settings) return
    setSettings({ ...settings, [key]: value })
    setSuccess(false)
  }

  function setNumDisplayField(
    field: keyof typeof numDisplay,
    value: string
  ) {
    setNumDisplay((prev) => ({ ...prev, [field]: value }))
    setSuccess(false)
  }

  const baseKm = parseOptionalNumber(numDisplay.delivery_base_km)
  const maxKm = parseOptionalNumber(numDisplay.delivery_max_km)
  const baseFee = parseOptionalNumber(numDisplay.delivery_base_fee)
  const extraFee = parseOptionalNumber(numDisplay.delivery_extra_fee_per_km)
  const missingDeliveryFields =
    settings?.delivery_enabled && (baseKm === null || maxKm === null)
  const invalidDeliveryRange =
    settings?.delivery_enabled &&
    baseKm !== null &&
    maxKm !== null &&
    maxKm < baseKm
  const isDeliveryValid =
    !settings?.delivery_enabled || (!missingDeliveryFields && !invalidDeliveryRange)

  async function onSave() {
    if (!settings) return
    if (!isDeliveryValid) {
      setError(
        missingDeliveryFields
          ? 'Compila i campi obbligatori: distanza inclusa e distanza massima (km).'
          : 'La distanza massima (km) deve essere maggiore o uguale alla distanza inclusa.'
      )
      return
    }
    setSuccess(false)
    setSaving(true)
    setError(null)

    const closedDates = parseClosedDates(closedDatesText)

    const payload = {
      ...settings,
      delivery_base_km: baseKm,
      delivery_base_fee: baseFee ?? 0,
      delivery_extra_fee_per_km: extraFee ?? 0,
      delivery_max_km: maxKm,
      payment_methods: paymentMethods,
      cutoff_time: cutoffTime.trim() || '19:00',
      accept_orders_when_closed: acceptWhenClosed,
      timezone: timezone.trim() || 'Europe/Rome',
      preparation_days: preparationDays,
      closed_dates: closedDates,
      closed_message: closedMessage.trim() || null,
      weekly_hours: weeklyHours,
    }

    try {
      console.log('[delivery onSave] payload', payload)
      const res = await fetch('/api/admin/settings/delivery', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })

      const data = await res.json().catch(() => ({}))
      if (!res.ok) {
        console.log('[delivery onSave] error response', data)
        throw new Error(data?.error || 'Errore salvataggio')
      }

      const s = data?.settings
      if (!s) {
        console.log('[delivery onSave] missing settings in response', data)
        throw new Error('Risposta non valida')
      }
      setSettings(s)
      if (Array.isArray(s.payment_methods)) {
        setPaymentMethods(s.payment_methods)
      }
      setNumDisplay({
        delivery_base_km: numToDisplay(s.delivery_base_km),
        delivery_base_fee: numToDisplay(s.delivery_base_fee),
        delivery_extra_fee_per_km: numToDisplay(s.delivery_extra_fee_per_km),
        delivery_max_km: numToDisplay(s.delivery_max_km),
      })
      setCutoffTime(s.cutoff_time ?? '19:00')
      setAcceptWhenClosed(s.accept_orders_when_closed !== false)
      setTimezone(s.timezone ?? 'Europe/Rome')
      setPreparationDays(typeof s.preparation_days === 'number' ? s.preparation_days : 0)
      setClosedDatesText(formatClosedDates(Array.isArray(s.closed_dates) ? s.closed_dates : []))
      setClosedMessage(typeof s.closed_message === 'string' ? s.closed_message : '')
      setWeeklyHours(parseWeeklyHours(s.weekly_hours))
      setSuccess(true)
    } catch (e: unknown) {
      const message = e instanceof Error ? e.message : 'Errore salvataggio'
      console.log('[delivery onSave] error', e)
      setError(message)
    } finally {
      setSaving(false)
    }
  }

  function togglePaymentMethod(method: string) {
    setPaymentMethods((prev) => {
      if (prev.includes(method)) {
        // Rimuove la chiave se già presente
        return prev.filter((m) => m !== method)
      } else {
        // Aggiunge la chiave se non presente
        return [...prev, method]
      }
    })
    setSuccess(false)
  }

  if (loading) {
    return <div className="p-6">Caricamento…</div>
  }

  if (!settings) {
    return <div className="p-6 text-red-600">{error}</div>
  }

  return (
    <div className="max-w-2xl p-6 space-y-6">
      <h1 className="text-2xl font-semibold">Impostazioni consegna</h1>

      <label className="flex items-center gap-3">
        <input
          type="checkbox"
          checked={settings.delivery_enabled}
          onChange={(e) => update('delivery_enabled', e.target.checked)}
        />
        <span>Abilita consegna a domicilio</span>
      </label>

      {!settings.delivery_enabled && (
        <div className="rounded-md border border-amber-200 bg-amber-50 dark:border-amber-800 dark:bg-amber-900/20 p-3 text-sm text-amber-800 dark:text-amber-200">
          La consegna a domicilio è disabilitata. I clienti non possono completare il checkout.
          <br />
          Per accettare ordini: abilita la consegna e configura almeno <b>distanza inclusa (km)</b> e <b>distanza massima (km)</b>.
        </div>
      )}

      <div className="grid grid-cols-1 gap-4">
        <div>
          <label className="block text-sm mb-1">Distanza inclusa (km)</label>
          <input
            type="number"
            min={0}
            step={0.1}
            value={numDisplay.delivery_base_km}
            onChange={(e) => setNumDisplayField('delivery_base_km', e.target.value)}
            className="w-full border rounded px-3 py-2"
          />
        </div>

        <div>
          <label className="block text-sm mb-1">Costo base consegna (€)</label>
          <input
            type="number"
            min={0}
            step={0.1}
            value={numDisplay.delivery_base_fee}
            onChange={(e) => setNumDisplayField('delivery_base_fee', e.target.value)}
            className="w-full border rounded px-3 py-2"
          />
        </div>

        <div>
          <label className="block text-sm mb-1">Costo extra per km (€)</label>
          <input
            type="number"
            min={0}
            step={0.1}
            value={numDisplay.delivery_extra_fee_per_km}
            onChange={(e) =>
              setNumDisplayField('delivery_extra_fee_per_km', e.target.value)
            }
            className="w-full border rounded px-3 py-2"
          />
        </div>

        <div>
          <label className="block text-sm mb-1">Distanza massima (km)</label>
          <input
            type="number"
            min={0}
            step={0.1}
            value={numDisplay.delivery_max_km}
            onChange={(e) => setNumDisplayField('delivery_max_km', e.target.value)}
            className="w-full border rounded px-3 py-2"
          />
        </div>
      </div>

      {/* Sezione Orari e chiusure */}
      <div className="space-y-4 border-t border-gray-200 dark:border-gray-700 pt-6">
        <h2 className="text-xl font-semibold">Orari e chiusure</h2>
        <p className="text-sm text-gray-500 dark:text-gray-400">
          Cutoff orario, giorni di chiusura e primo giorno utile per evasione ordini. Se il negozio è chiuso puoi accettare ordini e slittare al primo giorno aperto.
        </p>
        <div>
          <label className="block text-sm mb-1">Cutoff orario (es. 19:00)</label>
          <input
            type="text"
            placeholder="19:00"
            value={cutoffTime}
            onChange={(e) => { setCutoffTime(e.target.value); setSuccess(false) }}
            className="w-full border rounded px-3 py-2 dark:bg-gray-800 dark:border-gray-600"
          />
        </div>
        <label className="flex items-center gap-3">
          <input
            type="checkbox"
            checked={acceptWhenClosed}
            onChange={(e) => { setAcceptWhenClosed(e.target.checked); setSuccess(false) }}
          />
          <span>Accetta ordini quando il negozio è chiuso (slitta al primo giorno utile)</span>
        </label>
        <div>
          <label className="block text-sm mb-1">Timezone (es. Europe/Rome)</label>
          <input
            type="text"
            placeholder="Europe/Rome"
            value={timezone}
            onChange={(e) => { setTimezone(e.target.value); setSuccess(false) }}
            className="w-full border rounded px-3 py-2 dark:bg-gray-800 dark:border-gray-600"
          />
        </div>
        <div>
          <label className="block text-sm mb-1">Giorni di preparazione (0 = stesso giorno)</label>
          <input
            type="number"
            min={0}
            value={preparationDays}
            onChange={(e) => { setPreparationDays(Number(e.target.value) || 0); setSuccess(false) }}
            className="w-full border rounded px-3 py-2 dark:bg-gray-800 dark:border-gray-600"
          />
        </div>
        <div>
          <label className="block text-sm mb-1">Date di chiusura (YYYY-MM-DD, separate da riga, spazio o virgola)</label>
          <textarea
            rows={3}
            placeholder="2025-12-25 2025-01-01"
            value={closedDatesText}
            onChange={(e) => { setClosedDatesText(e.target.value); setSuccess(false) }}
            className="w-full border rounded px-3 py-2 font-mono text-sm dark:bg-gray-800 dark:border-gray-600"
          />
        </div>
        <div>
          <label className="block text-sm mb-1">Messaggio chiusura (opzionale)</label>
          <input
            type="text"
            placeholder="Es. Siamo in ferie"
            value={closedMessage}
            onChange={(e) => { setClosedMessage(e.target.value); setSuccess(false) }}
            className="w-full border rounded px-3 py-2 dark:bg-gray-800 dark:border-gray-600"
          />
          <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">Se valorizzato, verrà mostrato quando gli ordini sono bloccati.</p>
        </div>
        <WeeklyHoursEditor
          value={weeklyHours}
          onChange={(next) => { setWeeklyHours(next); setSuccess(false) }}
        />
      </div>

      {/* Sezione Metodi di pagamento */}
      <div className="space-y-4">
        <h2 className="text-xl font-semibold">Metodi di pagamento</h2>
        
        <div className="space-y-3">
          <label className="flex items-center gap-3">
            <input
              type="checkbox"
              checked={paymentMethods.includes('cash')}
              onChange={() => togglePaymentMethod('cash')}
            />
            <span>Contanti alla consegna</span>
          </label>

          <label className="flex items-center gap-3">
            <input
              type="checkbox"
              checked={paymentMethods.includes('pos_on_delivery')}
              onChange={() => togglePaymentMethod('pos_on_delivery')}
            />
            <span>POS alla consegna</span>
          </label>

          <label className="flex items-center gap-3">
            <input
              type="checkbox"
              checked={paymentMethods.includes('card_online')}
              onChange={() => togglePaymentMethod('card_online')}
            />
            <span>Carta online</span>
          </label>
        </div>
      </div>

      {settings.delivery_enabled && !isDeliveryValid && (
        <div className="rounded-md border border-amber-200 bg-amber-50 dark:border-amber-800 dark:bg-amber-900/20 p-3 text-sm text-amber-800 dark:text-amber-200">
          {missingDeliveryFields
            ? 'Con consegna attiva, compila distanza inclusa e distanza massima (km). I costi sono opzionali (consegna gratuita).'
            : 'La distanza massima deve essere maggiore o uguale alla distanza inclusa.'}
        </div>
      )}
      {error && <div className="text-red-600">{error}</div>}
      {success && <div className="text-green-600">Impostazioni salvate</div>}

      <button
        onClick={onSave}
        disabled={saving || !isDeliveryValid}
        className="bg-black text-white px-6 py-2 rounded disabled:opacity-50"
      >
        {saving ? 'Salvataggio…' : 'Salva impostazioni'}
      </button>
    </div>
  )
}
