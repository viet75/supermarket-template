# 🛒 Supermarket PWA Template

Template completo e pronto all’uso per e-commerce locali con **pannello admin**, **gestione ordini**, **pagamenti online** e **database Supabase**.  
Basato su **Next.js 15**, **Tailwind CSS 4**, **Supabase v2** e **Stripe v18**.

---

## ⚙️ Installazione

### 1️⃣ Clona o scarica il progetto
```bash
git clone https://github.com/yourusername/supermarket-pwa-template.git
cd supermarket-pwa-template

2️⃣ Installa le dipendenze
bash
Copia codice
npm install

3️⃣ Configura le variabili ambiente
Copia il file di esempio e inserisci le tue chiavi:

bash
Copia codice
cp .env.example .env.local
Aggiorna i campi con i tuoi dati:

env
Copia codice
NEXT_PUBLIC_SUPABASE_URL=https://YOUR_SUPABASE_URL.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=YOUR_SUPABASE_ANON_KEY
SUPABASE_SERVICE_ROLE_KEY=YOUR_SUPABASE_SERVICE_ROLE_KEY

STRIPE_SECRET_KEY=YOUR_STRIPE_SECRET_KEY
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=YOUR_STRIPE_PUBLIC_KEY

NEXT_PUBLIC_SITE_URL=https://YOUR_VERCEL_DEPLOY_URL

4️⃣ Crea il database Supabase
Accedi al dashboard Supabase.

Crea un nuovo progetto.

Apri la sezione SQL Editor e incolla il contenuto del file:

arduino
Copia codice
supabase/setup.sql
Esegui lo script per generare le tabelle e i dati demo.

5️⃣ Avvia il progetto in locale
bash
Copia codice
npm run dev
Apri http://localhost:3000 nel browser.

🧱 Stack Tecnologico
Next.js 15 (App Router)

Supabase (PostgreSQL + Auth)

Stripe Payments

Tailwind CSS 4

Framer Motion / Lucide Icons

Zustand store management

📦 Funzionalità Principali
✅ Gestione prodotti, categorie e ordini

✅ Pannello admin responsive e dark mode

✅ Checkout con Stripe o pagamento alla consegna

✅ Calcolo consegna e distanza tramite Nominatim API

✅ Interfaccia PWA installabile su smartphone

🗂️ Struttura Progetto
vbnet
Copia codice
app/                → pagine Next.js
components/         → componenti UI
hooks/              → custom hooks
lib/                → funzioni Supabase / Stripe
stores/             → stato globale (Zustand)
public/             → icone, immagini, manifest.json
supabase/setup.sql  → script per il database
🌐 Deploy su Vercel
Crea un nuovo progetto su https://vercel.com.

Collega il repository GitHub.

Imposta le Environment Variables come nel file .env.example.

Deploy automatico in pochi minuti.

🧩 Personalizzazione
Modifica il nome dell’app in /public/manifest.json

Sostituisci le immagini in /public/images/

Aggiorna colori e stile in tailwind.config.js

Personalizza testi e logo secondo le tue necessità

🔑 Licenza
Rilasciato sotto Licenza MIT.
Puoi usare, modificare e distribuire liberamente mantenendo il credito originale.

## Credenziali di accesso demo
Email: admin@demo.com  
Password: admin123

👤 Autore
Angelo
Email: [petruzziangelo75@gmail.com]
© 2025 Angelo – Tutti i diritti riservati.