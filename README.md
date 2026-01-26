Supermarket PWA Template

Next.js · Supabase · Stripe · PWA

Un modello di Progressive Web App pronto per la produzione, progettato per supermercati e negozi di alimentari locali, realizzato con Next.js App Router, Supabase e Stripe.

Questo modello fornisce sia una vetrina rivolta al cliente sia una potente dashboard di amministrazione, consentendo ai proprietari dei negozi di gestire prodotti, ordini, pagamenti e consegne senza interagire direttamente con Stripe, Supabase o strumenti di database.

Progettato per sviluppatori, liberi professionisti e agenzie.

🚀 Demo

Demo dal vivo (produzione)
👉 https://YOUR-VERCEL-DEMO.vercel.app

Demo amministratore
Email: admin@demo.com

Password: demo123

⚠️ La demo utilizza solo dati di prova. Non vengono elaborati pagamenti reali.

🧱 Stack tecnologico

Next.js (App Router)

Supabase

PostgreSQL

Auth

Storage

Stripe (pagamenti online)

Tailwind CSS

Progressive Web App (PWA)

Runtime Node.js (Edge Runtime intenzionalmente non utilizzato)

✨ Caratteristiche
Vetrina

Catalogo prodotti

Categorie

Carrello

Checkout

Validazione indirizzo

Calcolo distanza consegna

Calcolo spese di consegna

PWA installabile (mobile e desktop)

Pagamenti

Pagamento con carta online (Stripe Checkout)

POS alla consegna

Pagamento alla consegna

Dashboard di amministrazione

Gestione prodotti

Gestione categorie

Gestione ordini

Configurazione consegna

Caricamento immagini (Supabase Storage)

Gestione manuale pagamenti offline

🏪 Panoramica del progetto

Il template è progettato per supermercati locali che necessitano di una soluzione moderna per ordini online e consegne.

Include:

una vetrina pubblica per i clienti

una dashboard admin protetta

Tutte le operazioni quotidiane possono essere gestite dal pannello admin, senza accesso diretto a Stripe o al database.

💳 Logica di pagamento
Carta online

Gestita tramite Stripe Checkout

Lo stato diventa automaticamente paid al completamento

POS / Contanti

Ordini creati come non pagati

Stato aggiornato manualmente dall’admin

🗄 Database setup (one-shot)

Il progetto è progettato per essere installato su un progetto Supabase vuoto tramite un unico script SQL.

Step

Creare un nuovo progetto Supabase

Aprire SQL Editor

Incollare ed eseguire:

supabase/setup.sql


Questo script:

crea tutte le tabelle

crea funzioni RPC

configura RLS e policy

inserisce i seed minimi

applica patch di compatibilità (SAFE ALTER)

⚠️ Lo script è idempotente: può essere rieseguito senza errori.

## Dati demo (seed)

Il file `supabase/setup.sql` inserisce automaticamente:
- categorie di esempio
- prodotti di esempio (per_unit e per_kg)

Questo serve per avere una demo funzionante immediatamente dopo l’installazione.

Se desideri un database completamente vuoto (produzione reale),
puoi rimuovere o commentare il blocco `DEMO SEED` all’interno di `setup.sql`.



👤 Configurazione utente admin (obbligatoria)

⚠️ IMPORTANTE

Prima di creare l’utente admin, è **obbligatorio** eseguire il file:

supabase/setup.sql

su un progetto Supabase vuoto.

Questo file crea tutte le tabelle, funzioni, trigger e seed necessari.
Senza aver eseguito `setup.sql`, la tabella `public.profiles` non esiste
e la promozione admin fallirà.


Step 1 — Creare utente

Supabase Dashboard → Authentication → Users → Add user

Nota: la riga in `public.profiles` viene creata automaticamente

quando si crea un utente in Supabase Auth (trigger DB).


Step 2 — Assegnare ruolo admin

Dopo aver creato l’utente in Supabase Auth, la riga in `public.profiles` viene creata automaticamente (trigger + backfill).

Imposta admin così (consigliato, by email):

```sql
update public.profiles
set role = 'admin'
where id = (select id from auth.users where email = 'admin@test.com');



possono accedere a /admin.

🔐 Sicurezza e RLS

Il database utilizza Row Level Security (RLS).

Configurato automaticamente da setup.sql:

Utenti pubblici:

leggono solo prodotti e categorie attive

Utenti admin:

gestiscono prodotti

gestiscono categorie

gestiscono ordini

modificano impostazioni negozio

L’accesso admin è basato su:

public.profiles.role = 'admin'

🌍 Variabili d'ambiente

Tutte documentate in .env.example.

Nessun dominio hardcoded.
Funziona automaticamente su localhost e Vercel.

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

⚠️ Limitazioni note

Supporto singolo negozio (no multi-tenant)

Nessuna autenticazione cliente

PayPal non incluso

Google Maps API può avere costi

📄 Licenza

Licenza commerciale.

✔ Utilizzabile per progetti personali e clienti
❌ Non rivendibile come template concorrente o SaaS

🧑‍💻 Supporto

Supporto via Gumroad
Bugfix inclusi
Sviluppo custom escluso

✅ A chi è destinato

✔ Sviluppatori
✔ Freelance
✔ Agenzie

❌ Non per utenti non tecnici

Supabase Storage
Il bucket products viene creato automaticamente da setup.sql.
Non è necessario creare nulla manualmente nella dashboard.

## Stock (DB-first, RPC)

Lo stock è gestito esclusivamente dal database tramite RPC.

RPC pubbliche (PostgREST):
- reserve_order_stock(order_id uuid)
- release_order_stock(order_id uuid)
- cleanup_expired_reservations()

Compatibilità (nomi legacy supportati):
- reserveorderstock(order_id uuid)
- releaseorderstock(order_id uuid)

Node/Next.js non deve mai scalare stock direttamente: orchestration only.

### Stock release (DB-first)

Per annullare un ordine e ripristinare lo stock viene utilizzata la RPC:

release_order_stock(order_id uuid)

La logica è interamente nel database (PL/pgSQL).
Node/Next.js non deve mai modificare lo stock direttamente.


🔚 Fine
## Sistema Stock (DB-first)

Lo stock è gestito **esclusivamente dal database** tramite funzioni RPC PostgreSQL.
Node/Next.js non deve mai modificare direttamente lo stock.

Il sistema è reservation-based (stile Amazon) e non consente overselling.

### RPC pubbliche (PostgREST)

Queste sono le API ufficiali esposte dal database:

reserve_order_stock(order_id uuid)  
release_order_stock(order_id uuid)  
cleanup_expired_reservations()

### Flusso

Alla creazione ordine:
1. vengono creati `orders` e `order_items`
2. viene chiamata `reserve_order_stock(order_id)`
3. lo stock viene scalato nel database
4. `orders.stock_committed = true`

Per `card_online`:
- `payment_status = pending`
- `stock_reserved = true`
- `reserve_expires_at = now + TTL`
- se il pagamento non avviene → `cleanup_expired_reservations()`

Per `cash` / `pos_on_delivery`:
- stock scalato subito
- se annullato → `release_order_stock(order_id)`

## Reset Supabase (fresh install simulation)

Per simulare l’installazione reale su Supabase vuoto senza creare un nuovo progetto:

```sql
drop schema if exists public cascade;
create schema public;
grant usage on schema public to postgres, anon, authenticated, service_role;
grant all on schema public to postgres, service_role;

update public.profiles
set role = 'admin'
where id = (select id from auth.users where email = 'admin@test.com');

