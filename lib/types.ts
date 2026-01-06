// === Legacy (compatibilità con vecchi punti del codice, se ancora usati) ===
export type PaymentMethodLegacy = 'cash' | 'pos_on_delivery' | 'online'

export type DeliverySettings = {
    base: number
    per_km: number
    free_over: number
    max_km: number
}

export type PaymentsSettings = {
    cash: boolean
    pos_on_delivery: boolean
    card_online: boolean
}

export type PublicSettings = {
    delivery: DeliverySettings
    payments: PaymentsSettings
}

// === Nuovi tipi per store_settings ===
export type PaymentMethod = 'cash' | 'card_online' | 'pos_on_delivery'

export interface StoreSettings {
    id: string
    delivery_enabled: boolean
    delivery_fee_base: number     // costo fisso di consegna
    delivery_fee_per_km: number   // costo per km extra
    delivery_max_km: number       // distanza massima di consegna
    free_over: number             // soglia oltre la quale la consegna è gratuita
    store_lat: number | null      // coordinate negozio
    store_lng: number | null      // coordinate negozio
    payment_methods: PaymentMethod[]
    updated_at: string            // ISO string
}

// === Tipi per ordine ===
export type OrderItem = {
    id: string
    name: string
    price: number
    qty: number
    unit?: 'per_unit' | 'per_kg' | string
    quantity?: number
}

export type OrderAddress = {
    firstName: string
    lastName: string
    line1: string
    city: string
    cap: string
    note?: string
}

export type OrderPayload = {
    items: OrderItem[]                          // legacy snapshot
    subtotal: number
    delivery_fee: number
    total: number
    distance_km: number
    payment_method: PaymentMethod
    address: OrderAddress
}

export type OrderItemDB = {
    quantity: number
    price: number
    product: { id: string; name: string; unit_type: string | null }
}

export type Order = OrderPayload & {
    id: string
    public_id: string
    status: 'pending' | 'confirmed' | 'delivered' | 'cancelled'
    created_at: string

    // 🔹 Nuovi campi normalizzati
    user_id?: string | null
    first_name?: string | null
    last_name?: string | null
    order_items: OrderItemDB[]   // ✅ non più opzionale
    payment_status: 'pending' | 'paid' | 'failed' | 'refunded'
}



// === Tipi per catalogo ===
export type Category = {
    id: string
    name: string
    deleted_at?: string | null   // <--- aggiunto per soft delete
}

export type Product = {
    id: string                      // obbligatorio
    name: string
    description?: string | null
    price: number
    price_sale?: number | null
    image_url?: string | null
    images?: any[] | null
    category_id?: string | null
    stock?: number | null
    is_active?: boolean
    created_at?: string
    sort_order: number
    unit_type?: 'per_unit' | 'per_kg' | null
    deleted_at?: string | null      // <--- aggiunto per soft delete
}
