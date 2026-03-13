// === Legacy (compatibility with old code, if still used) ===
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

// === New types for store_settings ===
export type PaymentMethod = 'cash' | 'card_online' | 'pos_on_delivery'

export interface StoreSettings {
    id: string
    delivery_enabled: boolean
    delivery_fee_base: number     // fixed delivery cost
    delivery_fee_per_km: number   // extra delivery cost per km
    delivery_max_km: number       // maximum delivery distance
    free_over: number             // threshold beyond which delivery is free
    store_lat: number | null      // store coordinates
    store_lng: number | null      // store coordinates
    payment_methods: PaymentMethod[]
    updated_at: string            // ISO string
    // Store contacts (public footer, only if populated)
    store_name?: string | null
    address?: string | null
    email?: string | null
    phone?: string | null
    opening_hours?: string | null
    maps_link?: string | null
    social_links?: Record<string, string> | null
}

// === Types for orders ===
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
    phone?: string | null
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

    // 🔹 New normalized fields
    user_id?: string | null
    first_name?: string | null
    last_name?: string | null
    customer_phone?: string | null
    order_items: OrderItemDB[]   // ✅ no longer optional
    payment_status: 'pending' | 'paid' | 'failed' | 'refunded'
}

// === Types for categories ===
export type Category = {
    id: string
    name: string
    deleted_at?: string | null   // <--- added for soft delete
}

export type Product = {
    id: string                      // required
    name: string
    description?: string | null
    price: number
    price_sale?: number | null
    image_url?: string | null
    images?: any[] | null
    category_id?: string | null
    stock?: number | null
    stock_baseline?: number | null
    stock_unit?: number | null
    is_active?: boolean
    archived?: boolean              // true = blocked for order_items (trigger DB)
    created_at?: string
    sort_order: number
    unit_type?: 'per_unit' | 'per_kg' | null

    // NEW (UI-only): dynamic increment step (kg for per_kg, unit for per_unit)
    qty_step?: number | null

    deleted_at?: string | null      // <--- added for soft delete
}