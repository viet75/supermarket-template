# Supermarket PWA Template

**Next.js · Supabase · Stripe · PWA**

Supermarket PWA Template è un modello **production-ready** di Progressive Web App
per supermercati e negozi alimentari locali.

È pensato per **sviluppatori, freelance e agenzie** che vogliono consegnare
rapidamente una soluzione completa di **e-commerce + gestione ordini + consegna**,
senza dover progettare architettura, database o flussi di pagamento da zero.

Il template include:
- una **vetrina pubblica** per i clienti
- una **dashboard admin protetta**
- un **database DB-first** con logica critica nel backend (Supabase)

Il proprietario del negozio gestisce tutto dal pannello admin,
senza mai interagire direttamente con Stripe, Supabase o il database.

---

## 🚀 Demo

**Demo live (produzione)**  
👉 https://YOUR-VERCEL-DEMO.vercel.app

**Demo admin**  
Email: `admin@demo.com`  
Password: `demo123`

⚠️ La demo utilizza **solo dati di prova**.  
Nessun pagamento reale viene elaborato.

---

## 🧱 Stack tecnologico

- **Next.js** (App Router)
- **Supabase**
  - PostgreSQL
  - Auth
  - Storage
- **Stripe** (pagamenti online)
- **Tailwind CSS**
- **Progressive Web App (PWA)**
- **Runtime Node.js**  
  (Edge Runtime intenzionalmente non utilizzato)

---

## ✨ Funzionalità

### Vetrina clienti
- Catalogo prodotti
- Categorie
- Carrello
- Checkout
- Validazione indirizzo
- Calcolo distanza di consegna
- Calcolo spese di consegna
- PWA installabile (mobile e desktop)

### Pagamenti
- Carta online (Stripe Checkout)
- POS alla consegna
- Pagamento in contanti alla consegna

### Dashboard di amministrazione
- Gestione prodotti
- Gestione categorie
- Gestione ordini
- Configurazione consegna
- Caricamento immagini (Supabase Storage)
- Gestione manuale pagamenti offline

---

## 🏪 Panoramica del progetto

Il template è progettato per supermercati locali che necessitano
di una soluzione moderna per ordini online e consegne a domicilio.

Tutte le operazioni quotidiane (prodotti, ordini, pagamenti, consegna)
sono gestite **esclusivamente dal pannello admin**.

---

## 💳 Logica di pagamento

### Carta online
- Gestita tramite **Stripe Checkout**
- `payment_status` diventa automaticamente `paid` al completamento

### POS / Contanti
- Ordini creati come **non pagati**
- Stato aggiornato manualmente dall’admin

---

## 🗄 Database setup (ONE-SHOT)

Il progetto è progettato per essere installato su
**un progetto Supabase completamente vuoto**
tramite **un unico script SQL**.

### Step obbligatori

1. Creare un nuovo progetto Supabase  
2. Aprire **SQL Editor**  
3. Incollare ed eseguire **prima di tutto** `supabase/setup.sql`

Questo script:

- crea tutte le tabelle  
- crea funzioni RPC  
- configura RLS e policies  
- inserisce seed demo  
- applica patch SAFE ALTER  

⚠️ Lo script è idempotente  
Può essere rieseguito senza errori.

🌱 Dati demo (seed)

Il file supabase/setup.sql inserisce automaticamente:

- categorie di esempio  
- prodotti di esempio (per_unit e per_kg)

Questo permette di avere una demo funzionante immediatamente.

Se desideri un database completamente vuoto (produzione reale),
puoi commentare o rimuovere il blocco DEMO SEED
all’interno di setup.sql.

👤 Configurazione utente admin (OBBLIGATORIA)

⚠️ IMPORTANTE

Prima di creare l’utente admin è obbligatorio
aver eseguito supabase/setup.sql su un progetto Supabase vuoto.

Senza questo step:

- la tabella public.profiles non esiste  
- la promozione admin fallisce  

Step 1 — Creare utente

Supabase Dashboard → Authentication → Users → Add user

Nota  
La riga in public.profiles viene creata automaticamente
tramite trigger DB al momento della creazione dell’utente Auth.

Step 2 — Assegnare ruolo admin

Dopo la creazione dell’utente, promuovilo ad admin:

```sql
update public.profiles
set role = 'admin'
where id = (
  select id from auth.users
  where email = 'admin@test.com'
);
Da questo momento l’utente può accedere a /admin.

🔐 Sicurezza e RLS

Il database utilizza Row Level Security (RLS).

Configurazione automatica tramite setup.sql:

Utenti pubblici:

lettura prodotti e categorie attive

Utenti admin:

gestione prodotti

gestione categorie

gestione ordini

modifica impostazioni negozio

L’accesso admin è basato su:

public.profiles.role = 'admin'

🔐 Security – INTERNAL_ADMIN_KEY (REQUIRED)
Il progetto utilizza una chiave interna di sicurezza per proteggere
le azioni admin sensibili (Server Actions e API).

Devi generare una chiave unica per ogni installazione.

Esempio:

node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
Poi impostarla nelle variabili ambiente:

INTERNAL_ADMIN_KEY=your_generated_key
⚠️ IMPORTANTE:

Deve essere sempre cambiata in produzione

Non va mai committata nel repository

Ogni installazione cliente deve avere una chiave diversa

⚙️ Admin Settings
Il pannello admin fornisce due sezioni di configurazione separate.

General Settings
Percorso:

/admin/settings
Permette di configurare le informazioni pubbliche del negozio:

Nome negozio

Indirizzo

Email

Telefono

Orari di apertura

Link Google Maps

Questi dati vengono mostrati automaticamente nel footer pubblico.

Delivery Settings
Percorso:

/admin/settings/delivery
Permette di configurare:

Attivazione/disattivazione consegna

Costo base consegna

Costo extra per km

Distanza massima

Metodi di pagamento disponibili

💳 Testing Stripe in locale

Per testare i pagamenti online in locale è necessario Stripe CLI.

Installazione
winget install Stripe.StripeCLI

Login
stripe login

Avvio listener webhook
stripe listen --forward-to localhost:3000/api/webhooks/stripe

Riceverai una chiave:

whsec_xxxxxxxxx

Inseriscila in .env.local:

STRIPE_WEBHOOK_SECRET=whsec_xxxxxxxxx

Riavvia:

npm run dev

Carta di test

Numero: 4242 4242 4242 4242
Scadenza: qualsiasi futura
CVC: qualsiasi

🗂 Supabase Storage

Il bucket product-images viene creato automaticamente da setup.sql.

Non è necessario creare nulla manualmente nella dashboard Supabase.

📦 Sistema Stock (DB-first, RPC)

Lo stock è gestito esclusivamente dal database tramite funzioni RPC PostgreSQL.

Node / Next.js non deve mai modificare direttamente lo stock.

RPC pubbliche (PostgREST):

reserve_order_stock(order_id uuid)
release_order_stock(order_id uuid)
cleanup_expired_reservations()

Compatibilità (nomi legacy supportati):

reserveOrderStock(order_id uuid)
releaseOrderStock(order_id uuid)
cleanupExpiredReservations()

Flusso:

Alla creazione di un ordine:

vengono creati orders e order_items

viene chiamata reserve_order_stock(order_id)

lo stock viene scalato nel database

orders.stock_reserved = true

Per card_online:

payment_status = pending
reserve_expires_at = now + TTL

se il pagamento non avviene → cleanup_expired_reservations()

Per cash / pos_on_delivery:

stock scalato subito
se annullato → release_order_stock(order_id)

🔁 Reset Supabase (simulazione fresh install)

Per simulare una installazione reale su Supabase vuoto:

drop schema if exists public cascade;
create schema public;

grant usage on schema public to postgres, anon, authenticated, service_role;
grant all on schema public to postgres, service_role;
Soft Delete (Archive)
Products and categories are soft-deleted (archived) from the admin dashboard and can be restored at any time.

Permanent deletion is intentionally not exposed in the UI to prevent accidental data loss and to preserve data integrity (orders, analytics, history).

Advanced users can permanently remove archived records directly from Supabase if needed.

⚠️ Limitazioni note

Supporto single-store (no multi-tenant)
Nessuna autenticazione cliente
PayPal non incluso
Google Maps API può avere costi

È necessario generare una INTERNAL_ADMIN_KEY univoca per ogni installazione.

Questa chiave viene utilizzata internamente dal backend per proteggere i percorsi API sensibili.

Esempio:
openssl rand -hex 32

Quindi impostala nel tuo ambiente:
INTERNAL_ADMIN_KEY=chiave_generata

📄 Licenza

Licenza commerciale.

✔ Utilizzabile per progetti personali e clienti
❌ Non rivendibile come template concorrente o SaaS

🧑‍💻 Supporto

Supporto via Gumroad
Bugfix inclusi
Sviluppo custom escluso