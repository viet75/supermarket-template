import { NextRequest, NextResponse } from 'next/server';
import { supabaseServer } from '@/lib/supabaseServer';
import { normalizeProduct } from '@/lib/normalizeProduct'
import { normalizeStock } from '@/lib/stock'


export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

/* ===========================
   Helpers
=========================== */
function numOrNull(v: unknown): number | null {
    if (v === null || v === undefined || v === '') return null;
    const n = Number(v);
    return Number.isFinite(n) ? n : null;
}
function mustNumber(v: unknown, field = 'number'): number {
    const n = Number(v);
    if (!Number.isFinite(n)) {
        throw new Error(`Invalid ${field}`);
    }
    return n;
}
function normalizeUnitType(
    value: unknown
): 'per_unit' | 'per_kg' | null | undefined {
    if (value === 'per_unit' || value === 'per_kg') return value;
    if (value === null || typeof value === 'undefined') return value;
    throw new Error('unit_type non valido');
}

/* ===========================
   GET /api/products
   Ritorna i prodotti attivi
=========================== */
export async function GET() {
    try {
        const svc = supabaseServer();
        const { data, error } = await svc
            .from('products')
            .select(
                // seleziona le colonne che ti servono; * va bene ma qui esplicito per chiarezza
                'id,name,description,price,price_sale,unit_type,category_id,stock,image_url,images,is_active,deleted_at,created_at'
            )
            .eq('is_active', true)        // <-- fix: usa is_active
            .is('deleted_at', null)
            .order('created_at', { ascending: false });

        if (error) throw error;

        // Normalizza campi numerici ed evita stringhe
        const items = (data ?? []).map((p: any) => ({
            ...p,
            price: mustNumber(p.price, 'price'),
            price_sale: p.price_sale == null ? null : mustNumber(p.price_sale, 'price_sale'),
            stock: numOrNull(p.stock), // null = illimitato, 0 = esaurito, N>0 = limitato
        }));

        return NextResponse.json(
            { items },
            { headers: { 'Cache-Control': 'no-store' } }
        );
    } catch (e: any) {
        return NextResponse.json({ error: e?.message ?? 'Errore' }, { status: 500 });
    }
}

/* ===========================
   POST /api/products
   Crea un prodotto.
   - SKU facoltativo: se mancante/vuoto lo genera il DB
   - Duplicate SKU -> 409
=========================== */
type NewProduct = {
    name: string;
    price: number | string;
    price_sale?: number | string | null;
    sku?: string | null;
    active?: boolean;      // legacy: lo mappiamo su is_active
    is_active?: boolean;   // preferito
    description?: string | null;
    unit_type?: string | null;
    category_id?: string | null;
    image_url?: string | null;
    images?: any[] | null;
    stock?: number | string | null; // null = illimitato
};

export async function POST(req: NextRequest) {
    try {
        const body = (await req.json()) as NewProduct;

        if (!body?.name) {
            return NextResponse.json({ error: 'name è obbligatorio' }, { status: 400 });
        }

        let price: number;
        try {
            price = mustNumber(body.price, 'price');
        } catch (err: any) {
            return NextResponse.json({ error: err.message }, { status: 400 });
        }

        // Normalizza stock (kg reali per per_kg, pezzi interi per per_unit)
        let stockValue: number | null = null;
        if (typeof body.stock !== 'undefined') {
            try {
                const unitType = normalizeUnitType(body.unit_type);
                stockValue = normalizeStock(unitType, body.stock);
            } catch (err: any) {
                return NextResponse.json({ error: err.message }, { status: 400 });
            }
        }

        const insert: any = {
            name: body.name,
            description: body.description ?? '',
            price,
            price_sale: numOrNull(body.price_sale),
            image_url: body.image_url ?? null,
            images: Array.isArray(body.images) ? body.images : null,
            unit_type: body.unit_type ?? null,
            category_id: body.category_id ?? null,
            stock: stockValue, // null = illimitato
            // preferisci is_active; se non passato, default true
            is_active:
                typeof body.is_active === 'boolean'
                    ? body.is_active
                    : typeof body.active === 'boolean'
                        ? body.active
                        : true,
        };

        // SKU: se assente o vuoto, non lo passiamo (gestito da DB)
        if (body.sku && body.sku.trim() !== '') {
            insert.sku = body.sku.trim();
        }

        const svc = supabaseServer();
        const { data, error } = await svc.from('products').insert(insert).select('*').single();

        if (error) {
            const msg = String(error.message || error);
            if (msg.toLowerCase().includes('duplicate key') || msg.toLowerCase().includes('already exists')) {
                return NextResponse.json({ error: 'SKU già in uso' }, { status: 409 });
            }
            return NextResponse.json({ error: msg }, { status: 500 });
        }

        // normalizza numerici anche in risposta
        const product = {
            ...data,
            price: mustNumber(data.price, 'price'),
            price_sale: data.price_sale == null ? null : mustNumber(data.price_sale, 'price_sale'),
            stock: numOrNull(data.stock),
        };

        return NextResponse.json({ product }, { status: 201 });
    } catch (e: any) {
        return NextResponse.json({ error: e?.message ?? 'Errore salvataggio prodotto' }, { status: 500 });
    }
}

/* =======================================
   PATCH /api/products
   Aggiorna un prodotto.
   - SKU NON modificabile (immutabile)
   - Se in body compare sku -> 400
======================================= */
type UpdateProduct = {
    id: string;
    name?: string;
    price?: number | string;
    price_sale?: number | string | null;
    active?: boolean;      // legacy
    is_active?: boolean;
    description?: string | null;
    unit_type?: string | null;
    category_id?: string | null;
    image_url?: string | null;
    images?: any[] | null;
    stock?: number | string | null; // null = illimitato
    sku?: string | null;            // non modificabile
};

export async function PATCH(req: NextRequest) {
    try {
        const body = (await req.json()) as UpdateProduct;
        if (!body?.id) {
            return NextResponse.json({ error: 'id obbligatorio' }, { status: 400 });
        }

        if (typeof body.sku !== 'undefined') {
            return NextResponse.json({ error: 'SKU non modificabile' }, { status: 400 });
        }

        const { id, ...rest } = body;

        const update: Record<string, any> = {};
        if (typeof rest.name !== 'undefined') update.name = rest.name;
        if (typeof rest.description !== 'undefined') update.description = rest.description ?? '';
        if (typeof rest.price !== 'undefined') {
            try {
                update.price = mustNumber(rest.price, 'price');
            } catch (err: any) {
                return NextResponse.json({ error: err.message }, { status: 400 });
            }
        }
        if (typeof rest.price_sale !== 'undefined') {
            update.price_sale = numOrNull(rest.price_sale);
        }
        if (typeof rest.image_url !== 'undefined') update.image_url = rest.image_url ?? null;
        if (typeof rest.images !== 'undefined') update.images = Array.isArray(rest.images) ? rest.images : null;
        if (typeof rest.unit_type !== 'undefined') update.unit_type = rest.unit_type ?? null;
        if (typeof rest.category_id !== 'undefined') update.category_id = rest.category_id ?? null;
        
        // Normalizza stock (kg reali per per_kg, pezzi interi per per_unit)
        if (typeof rest.stock !== 'undefined') {
            // Recupera unit_type attuale se non viene modificato
            let unitType: 'per_unit' | 'per_kg' | null | undefined;
            if (rest.unit_type === undefined) {
                const svc = supabaseServer();
                const { data: current } = await svc
                    .from('products')
                    .select('unit_type')
                    .eq('id', id)
                    .single();
                unitType = normalizeUnitType(current?.unit_type ?? null);
            } else {
                try {
                    unitType = normalizeUnitType(rest.unit_type);
                } catch (err: any) {
                    return NextResponse.json({ error: err.message }, { status: 400 });
                }
            }
            try {
                update.stock = normalizeStock(unitType, rest.stock);
            } catch (err: any) {
                return NextResponse.json({ error: err.message }, { status: 400 });
            }
        }

        // mappa legacy active -> is_active
        if (typeof rest.is_active === 'boolean') {
            update.is_active = rest.is_active;
        } else if (typeof rest.active === 'boolean') {
            update.is_active = rest.active;
        }

        if (Object.keys(update).length === 0) {
            // niente da aggiornare
            return NextResponse.json({ product: null });
        }

        const svc = supabaseServer();
        const { data, error } = await svc
            .from('products')
            .update(update)
            .eq('id', id)
            .select('*')
            .single();

        if (error) throw error;

        const product = {
            ...data,
            price: mustNumber(data.price, 'price'),
            price_sale: data.price_sale == null ? null : mustNumber(data.price_sale, 'price_sale'),
            stock: numOrNull(data.stock),
        };

        return NextResponse.json({ product });
    } catch (e: any) {
        return NextResponse.json({ error: e?.message ?? 'Errore aggiornamento prodotto' }, { status: 500 });
    }
}
