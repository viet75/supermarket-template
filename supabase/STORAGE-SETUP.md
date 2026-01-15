# 📦 Setup Storage Bucket per Immagini Prodotti

## Problema
Quando carichi un'immagine nella pagina admin/prodotti, ricevi l'errore **"bucket not found"**.

## Soluzione

Il bucket `products` non esiste ancora in Supabase Storage. Devi crearlo.

### Opzione 1: Tramite SQL Editor (Consigliato)

1. Vai al **Supabase Dashboard** → **SQL Editor**
2. Apri il file `supabase/create-storage-bucket.sql`
3. Copia e incolla tutto il contenuto nel SQL Editor
4. Esegui lo script

### Opzione 2: Tramite Dashboard UI

1. Vai al **Supabase Dashboard** → **Storage**
2. Clicca su **"New bucket"**
3. Configurazione:
   - **Name**: `products`
   - **Public bucket**: ✅ Sì (le immagini devono essere accessibili pubblicamente)
   - **File size limit**: `5242880` (5MB)
   - **Allowed MIME types**: `image/jpeg, image/jpg, image/png, image/webp, image/gif`
4. Clicca **"Create bucket"**

### Opzione 3: Tramite Supabase CLI

```bash
supabase db execute -f supabase/create-storage-bucket.sql
```

## Verifica

Dopo aver creato il bucket, prova a caricare un'immagine nella pagina admin/prodotti. Dovrebbe funzionare!

## Configurazione Attuale

- **Bucket name**: `products`
- **Percorso file**: `images/[filename]`
- **Accesso**: Pubblico (tutti possono vedere le immagini)
- **Upload**: Solo tramite API route con service role key (sicuro)

## File Coinvolti

- `app/api/admin/upload/route.ts` (righe 21 e 35) - usa il bucket `products`
- `components/AdminImageUploader.tsx` - componente che chiama l'API di upload

## Note

- Il bucket deve essere **pubblico** per permettere la visualizzazione delle immagini nella home
- Le immagini vengono salvate nella cartella `images/` all'interno del bucket
- Il limite di dimensione file è 5MB
- Solo immagini sono permesse (JPEG, PNG, WebP, GIF)











































