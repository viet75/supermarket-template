# 🔧 Fix Colonna unit_type e Colonne Mancanti

## Problema
Errore nell'admin prodotti: **"Could not find the 'unit_type' column of 'products' in the schema cache."**

## Analisi

### 1. Dove viene utilizzata la colonna `unit_type`

La colonna `unit_type` è utilizzata in **35 occorrenze** nel progetto:

#### File principali:
- **`app/admin/products/page.tsx`** (righe 192, 314, 420, 423, 429, 535, 538, 544, 741, 744)
  - Form di creazione/modifica prodotti
  - Visualizzazione prezzi e stock
  - Select dropdown per scegliere "Pezzo" o "Kg"

- **`components/ProductCard.tsx`** (righe 15, 64, 76, 155, 177, 180)
  - Determina lo step di incremento nel carrello (0.5 per kg, 1 per unità)
  - Visualizza "kg" o "pz" nei prezzi
  - Gestisce la quantità nel carrello

- **`app/api/products/route.ts`** (righe 35, 71, 100, 156, 192)
  - API per creare e aggiornare prodotti
  - Include unit_type nelle query SELECT

- **`app/api/admin/products/[id]/route.ts`** (riga 54)
  - API per aggiornare un singolo prodotto

- **`lib/types.ts`** (riga 108)
  - Definizione TypeScript: `unit_type?: 'per_unit' | 'per_kg' | null`

- **Altri file**: `components/HomeClient.tsx`, `app/admin/orders/page.tsx`, `app/api/admin/orders/route.ts`

### 2. Stato della tabella `products` nel database

La tabella `products` nello schema iniziale (`supabase/setup.sql`) ha **solo queste colonne**:
- `id` (uuid)
- `name` (text)
- `price` (numeric)
- `category_id` (uuid)
- `image` (text) - ⚠️ NOTA: il codice usa `image_url` invece
- `created_at` (timestamp)
- `deleted_at` (timestamp)

**Colonne mancanti** che il codice si aspetta:
- ❌ `unit_type` - **PRINCIPALE PROBLEMA**
- ❌ `description`
- ❌ `price_sale`
- ❌ `image_url`
- ❌ `images` (JSONB)
- ❌ `stock`
- ❌ `is_active`
- ❌ `sort_order`

### 3. Soluzione

**Opzione consigliata**: Aggiungere tutte le colonne mancanti con una migration SQL completa.

## Fix da Applicare

### Step 1: Esegui la Migration SQL

1. Apri il **Supabase Dashboard** → **SQL Editor**
2. Apri il file `supabase/add-missing-product-columns.sql`
3. Copia e incolla tutto il contenuto nel SQL Editor
4. Esegui lo script

Questo script:
- ✅ Aggiunge tutte le colonne mancanti
- ✅ Imposta valori di default appropriati
- ✅ Aggiorna i prodotti esistenti con valori di default
- ✅ È idempotente (può essere eseguito più volte senza errori)

### Step 2: Verifica

Dopo aver eseguito lo script:
1. Vai alla pagina **admin/prodotti**
2. Prova a creare o modificare un prodotto
3. L'errore dovrebbe essere risolto

## Dettagli Colonne Aggiunte

| Colonna | Tipo | Default | Nullable | Descrizione |
|---------|------|---------|----------|-------------|
| `unit_type` | TEXT | `'per_unit'` | Sì | Valori: `'per_unit'`, `'per_kg'`, o `NULL` |
| `description` | TEXT | - | Sì | Descrizione del prodotto |
| `price_sale` | NUMERIC(10,2) | - | Sì | Prezzo in sconto |
| `image_url` | TEXT | - | Sì | URL immagine da Supabase Storage |
| `images` | JSONB | - | Sì | Array di immagini |
| `stock` | NUMERIC(10,2) | - | Sì | Quantità disponibile (NULL = illimitato) |
| `is_active` | BOOLEAN | `true` | No | Prodotto attivo/inattivo |
| `sort_order` | INTEGER | `100` | No | Ordine di visualizzazione |

## Note Importanti

1. **Prodotti esistenti**: Tutti i prodotti esistenti avranno:
   - `unit_type = 'per_unit'` (venduti per pezzo)
   - `is_active = true` (attivi)
   - `sort_order = 100` (ordine di default)

2. **Compatibilità**: Il codice è già pronto per queste colonne, quindi non serve modificare il codice TypeScript/JavaScript.

3. **Colonna `image` vs `image_url`**: 
   - Lo schema ha `image` (TEXT)
   - Il codice usa `image_url` (TEXT)
   - La migration aggiunge `image_url` - la colonna `image` può essere ignorata o rimossa in futuro

## Alternative (NON CONSIGLIATE)

Se per qualche motivo non vuoi aggiungere le colonne, dovresti:
- Rimuovere tutti i riferimenti a `unit_type` dal codice (35 occorrenze)
- Rimuovere tutti i riferimenti alle altre colonne mancanti
- Modificare i componenti per non usare queste funzionalità

**Questo romperebbe molte funzionalità** (carrello, prezzi, stock, ecc.), quindi **NON è consigliato**.

## Verifica Post-Migration

Dopo aver eseguito la migration, verifica che:
- ✅ La pagina admin/prodotti si carica senza errori
- ✅ Puoi creare un nuovo prodotto
- ✅ Puoi modificare un prodotto esistente
- ✅ Il campo "Tipo unità" (Pezzo/Kg) funziona
- ✅ I prodotti vengono visualizzati correttamente nella home











































