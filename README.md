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

👤 Configurazione utente admin (obbligatoria)

Gli utenti Supabase Auth non possono essere creati via SQL.

Step 1 — Creare utente

Supabase Dashboard → Authentication → Users → Add user

Step 2 — Assegnare ruolo admin
insert into public.profiles (id, role)
values ('<AUTH_USER_ID>', 'admin')
on conflict (id) do update set role = 'admin';


Solo utenti con:

profiles.role = 'admin'


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

🔚 Fine