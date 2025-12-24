'use client'

import { useEffect, useState } from 'react'

type DeliverySettings = {
  delivery_enabled: boolean
  delivery_base_km: number
  delivery_base_fee: number
  delivery_extra_fee_per_km: number
  delivery_max_km: number
  payment_methods?: string[]
}

export default function DeliverySettingsPage() {
  const [settings, setSettings] = useState<DeliverySettings | null>(null)
  const [paymentMethods, setPaymentMethods] = useState<string[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState(false)

  // Caricamento iniziale
  useEffect(() => {
    fetch('/api/admin/settings/delivery')
      .then((res) => res.json())
      .then((data) => {
        setSettings(data.settings)
        // Inizializza paymentMethods da store_settings.payment_methods
        if (Array.isArray(data.settings?.payment_methods)) {
          setPaymentMethods(data.settings.payment_methods)
        } else {
          setPaymentMethods([])
        }
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

  async function onSave() {
    if (!settings) return
    setSaving(true)
    setError(null)

    try {
      const res = await fetch('/api/admin/settings/delivery', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...settings,
          payment_methods: paymentMethods,
        }),
      })

      if (!res.ok) {
        const data = await res.json()
        throw new Error(data?.error || 'Errore salvataggio')
      }

      const data = await res.json()
      setSettings(data.settings)
      // Aggiorna anche paymentMethods dal response
      if (Array.isArray(data.settings?.payment_methods)) {
        setPaymentMethods(data.settings.payment_methods)
      }
      setSuccess(true)
    } catch (e: any) {
      setError(e.message)
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

      <div className="grid grid-cols-1 gap-4">
        <div>
          <label className="block text-sm mb-1">Distanza inclusa (km)</label>
          <input
            type="number"
            min={0}
            step={0.1}
            value={settings.delivery_base_km}
            onChange={(e) => update('delivery_base_km', Number(e.target.value))}
            className="w-full border rounded px-3 py-2"
          />
        </div>

        <div>
          <label className="block text-sm mb-1">Costo base consegna (€)</label>
          <input
            type="number"
            min={0}
            step={0.1}
            value={settings.delivery_base_fee}
            onChange={(e) => update('delivery_base_fee', Number(e.target.value))}
            className="w-full border rounded px-3 py-2"
          />
        </div>

        <div>
          <label className="block text-sm mb-1">Costo extra per km (€)</label>
          <input
            type="number"
            min={0}
            step={0.1}
            value={settings.delivery_extra_fee_per_km}
            onChange={(e) =>
              update('delivery_extra_fee_per_km', Number(e.target.value))
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
            value={settings.delivery_max_km}
            onChange={(e) => update('delivery_max_km', Number(e.target.value))}
            className="w-full border rounded px-3 py-2"
          />
        </div>
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

      {error && <div className="text-red-600">{error}</div>}
      {success && <div className="text-green-600">Impostazioni salvate</div>}

      <button
        onClick={onSave}
        disabled={saving}
        className="bg-black text-white px-6 py-2 rounded disabled:opacity-50"
      >
        {saving ? 'Salvataggio…' : 'Salva impostazioni'}
      </button>
    </div>
  )
}
