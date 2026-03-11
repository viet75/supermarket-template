# Supermarket PWA Template

🌍 Lingue disponibili:

- 🇬🇧 English → [README.md](README.md)
- 🇮🇹 Italiano

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

### 🎬 Video Demo

Guarda il funzionamento completo del template:

👉 https://youtu.be/FVi38J3yYIo

**Live Demo**

👉 https://supermarketpwa.com


### 🧪 Demo Mode

La demo è configurata per simulare un supermercato locale con consegna a domicilio.

Configurazione demo:

Città: **Milano**  
CAP: **20121**

Per testare correttamente il checkout e la verifica di consegna, utilizza un indirizzo situato in questa area.

Il sistema utilizza queste coordinate per:

- calcolare automaticamente la distanza di consegna
- verificare la copertura del servizio
- determinare se un indirizzo è servito


### 🔐 Accesso pannello Admin (Demo)

Puoi accedere al pannello amministrativo della demo utilizzando:

Admin panel:

👉 https://supermarketpwa.com/admin

Credenziali demo:

Email: `admin@demo.com`  
Password: `demo123`


⚠️ **Nota**

La demo utilizza esclusivamente dati di prova.

- Nessun pagamento reale viene elaborato
- Tutti gli ordini sono simulati
- L'ambiente viene periodicamente ripristinato
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

### No PayPal
PayPal non è incluso per scelta progettuale.

Il template è progettato principalmente per supermercati locali,
dove il cliente conosce già il negozio e ha un rapporto diretto di fiducia.
In questi contesti, i metodi più utilizzati sono:

- pagamento alla consegna (contanti)
- pagamento POS alla consegna
- pagamento con carta online (Stripe Checkout)

Stripe garantisce già elevati standard di sicurezza e conformità (PCI DSS).

PayPal può essere integrato successivamente se richiesto,
ma non è incluso per mantenere il template più semplice,
leggero e focalizzato sul caso d’uso reale dei supermercati locali.

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

### Rimborsi

I rimborsi per i pagamenti online sono gestiti direttamente dal **dashboard Stripe**.

Stripe è la fonte di verità per tutte le operazioni di pagamento, tra cui:

- rimborsi completi
- rimborsi parziali
- eventuali dispute
- storico dei pagamenti

Gestire i rimborsi direttamente in Stripe evita possibili incongruenze tra il provider di pagamento e il database dell'applicazione.

Per gli ordini pagati tramite **POS alla consegna** o **contanti alla consegna**, il rimborso può essere gestito manualmente dal negozio.

🗄 Database Setup (ONE-SHOT)

Il template è progettato per essere installato su un progetto Supabase completamente vuoto utilizzando un unico script SQL.

Questo approccio permette di configurare l’intero backend in pochi minuti.

Step 1 — Creare un progetto Supabase

Vai su
https://supabase.com

Crea un nuovo progetto.

Apri SQL Editor.

Step 2 — Eseguire lo script di installazione

Apri il file:

supabase/setup.sql

Copia l’intero contenuto e incollalo nello SQL Editor di Supabase, quindi eseguilo.

Lo script esegue automaticamente:

creazione di tutte le tabelle

creazione delle funzioni RPC

configurazione RLS e policies

creazione dei bucket Supabase Storage

inserimento di dati demo

applicazione di patch SAFE ALTER

⚠️ Lo script è idempotente
può essere eseguito più volte senza generare errori.

🌱 Dati demo (seed)

Il file supabase/setup.sql inserisce automaticamente:

categorie di esempio

prodotti demo (per_unit e per_kg)

Questo permette di avere una demo funzionante immediatamente.

Se desideri un database completamente vuoto per la produzione, puoi:

commentare

oppure rimuovere

il blocco DEMO SEED presente nel file setup.sql.

👤 Configurazione utente Admin (OBBLIGATORIA)

⚠️ Prima di creare l’utente admin è obbligatorio aver eseguito supabase/setup.sql.

Senza questo step:

la tabella public.profiles non esiste

la promozione admin fallirà

Step 1 — Creare un utente

Vai su:

Supabase Dashboard → Authentication → Users → Add user

Crea un nuovo utente con email e password.

Nota:
Quando un utente viene creato in Supabase Auth, una riga in public.profiles viene creata automaticamente tramite trigger database.

Step 2 — Promuovere l’utente ad admin

Dopo aver creato l’utente, apri SQL Editor ed esegui:

update public.profiles
set role = 'admin'
where id = (
  select id from auth.users
  where email = 'YOUR_ADMIN_EMAIL'
);

Sostituisci YOUR_ADMIN_EMAIL con l’email dell’utente che hai appena creato.

Accesso al pannello admin

Una volta assegnato il ruolo admin, potrai accedere al pannello amministrativo:

/admin

🔑 Variabili ambiente (OBBLIGATORIE)

Crea un file .env.local nella root del progetto.

Puoi copiare il file .env.example incluso nel template e modificarlo con i tuoi valori reali.

cp .env.example .env.local

Esempio configurazione:

# Supabase
NEXT_PUBLIC_SUPABASE_URL=your_supabase_url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key
SUPABASE_SERVICE_ROLE_KEY=your_service_role_key

# Stripe
STRIPE_SECRET_KEY=your_stripe_secret_key
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=your_stripe_publishable_key
STRIPE_WEBHOOK_SECRET=your_webhook_secret

# Site
NEXT_PUBLIC_SITE_URL=http://localhost:3000

# Admin
INTERNAL_ADMIN_KEY=your_generated_key

# Google Maps (Geolocalizzazione consegne)
GOOGLE_MAPS_API_KEY=your_google_maps_api_key

# Coordinate negozio (OBBLIGATORIE per il calcolo consegna)
NEXT_PUBLIC_STORE_LAT=40.000000
NEXT_PUBLIC_STORE_LNG=16.000000
NEXT_PUBLIC_STORE_NAME=Your Store Name
Dove trovare le chiavi
Supabase

Vai su:

Project Settings → API

Copia:

Project URL

anon public key

service_role key

Stripe

Vai su:

Developers → API Keys

Copia:

Publishable key

Secret key

Google Maps API (Geolocalizzazione consegne)

Serve per:

calcolare la distanza di consegna

verificare la copertura dell'indirizzo del cliente

Vai su:

https://console.cloud.google.com/

Abilita le seguenti API:

Maps JavaScript API

Geocoding API

Distance Matrix API

Coordinate del negozio

Puoi ottenere le coordinate da:

https://maps.google.com

Click destro sulla posizione del negozio → copia coordinate

Esempio:

40.8518
14.2681
⚠️ Importante

Senza Google Maps API e coordinate del negozio:

il calcolo della distanza non funzionerà

la verifica dell’area di consegna non funzionerà

il checkout potrebbe essere bloccato

⚠️ Sicurezza

Non committare mai .env.local nel repository.

Questo file contiene chiavi private e deve rimanere solo nell'ambiente locale o nel server di produzione.

🕐 Store hours & closures

Orari di apertura, cutoff orario e giorni di chiusura sono gestiti in DB-first: la RPC get_fulfillment_preview() è l’unica fonte di verità per UI e API ordini.

Configurazione (Admin)

In Admin → Impostazioni consegna (sezione “Orari e chiusure”):

Cutoff orario (es. 19:00): dopo quest’ora gli ordini vengono evasi dal giorno successivo (o dal primo giorno utile).

Accetta ordini quando chiuso: se attivo, fuori orario/chiusura gli ordini sono accettati e slittano al primo giorno utile; se disattivo, il checkout viene bloccato.

Timezone (es. Europe/Rome): usata per “ora corrente” e date.

Giorni di preparazione: giorni aggiuntivi prima dell’evasione (0 = stesso giorno).

Date di chiusura: una data per riga, formato YYYY-MM-DD (es. festivi).

Orari settimanali (JSON): chiavi 0 (domenica) … 6 (sabato); valore null = chiuso, oppure intervallo "09:00-19:00".

Esempio weekly_hours (orari settimanali)
{
  "0": null,
  "1": "09:00-19:00",
  "2": "09:00-19:00",
  "3": "09:00-19:00",
  "4": "09:00-19:00",
  "5": "09:00-19:00",
  "6": "09:00-13:00"
}

Domenica chiuso, lun–ven 9–19, sabato 9–13.

Esempio closed_dates

Una data per riga (es. in Admin come textarea):

2025-12-25
2025-01-01
Comportamento

In checkout il cliente vede un messaggio (es. “Ordine evaso dal DD/MM/YYYY”) e non può confermare se il negozio non accetta ordini.

In POST /api/orders viene chiamata la stessa RPC: se can_accept === false si risponde con 409 e code: "STORE_CLOSED".

La data di evasione (next_fulfillment_date) viene salvata in orders.fulfillment_date (tipo date).


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

🔧 Prima configurazione consegna (OBBLIGATORIO)

Per motivi di sicurezza, la consegna è disabilitata di default dopo una nuova installazione del database.

Questo comportamento evita che il negozio accetti ordini prima di essere configurato.

🛑 Comportamento iniziale previsto

Subito dopo l'installazione:

❌ Checkout bloccato

❌ Pulsante "Conferma ordine" disabilitato

⚠️ Messaggio mostrato al cliente:

Le consegne sono temporaneamente disabilitate

Questo è normale.

✅ Come abilitare la consegna

Vai in:

Admin → Impostazioni consegna

Configura almeno:

Distanza inclusa (km)

Distanza massima (km)

Poi abilita:

☑ Abilita consegna a domicilio

Salva.

La consegna sarà immediatamente attiva.

🛡️ Sicurezza

Questo sistema protegge da:

ordini accidentali dopo installazione

negozio non configurato

clienti fuori zona

🧠 Architettura

Il blocco è implementato su 3 livelli:

UI (CheckoutForm)

API (/api/orders)

Database trigger (guard_orders_delivery_enabled)

Anche in caso di bypass client, l'ordine viene bloccato dal database.

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

## 📦 Cosa include il template

Questo template include tutto il necessario per lanciare un servizio di consegna a domicilio per supermercati o negozi alimentari locali:

- Applicazione completa Next.js
- Dashboard amministrativa
- Schema database Supabase con funzioni RPC
- Integrazione Stripe Checkout
- Calcolo distanza di consegna (Google Maps API)
- Sistema gestione stock (architettura DB-first)
- Progressive Web App (PWA)
- File di configurazione ambiente (.env.example)
- Documentazione completa di installazione

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

## 🧾 Requisiti

Prima di installare il template è necessario disporre di:

- Node.js 18 o superiore
- Un account Supabase
- Un account Stripe
- Un account Google Cloud (per le Google Maps API)
- Un account Vercel (consigliato per il deploy)

📄 Licenza

Questo progetto è distribuito con Licenza Commerciale.

✔ Puoi utilizzare questo template per progetti personali e per progetti di clienti
✔ Puoi modificare il template in base alle tue esigenze

❌ NON puoi rivendere questo template
❌ NON puoi redistribuire il codice sorgente
❌ NON puoi utilizzare (use this template) per creare template concorrenti o prodotti SaaS concorrenti

Il codice sorgente è concesso in licenza, non venduto.
La piena proprietà resta all’autore.

Consulta il file LICENSE.txt per i termini completi.

🧑‍💻 Supporto

Supporto via Gumroad
Bugfix inclusi
Sviluppo custom escluso

🕒 Gestione Orari e Chiusure (Avanzata)

Orari settimanali configurabili a fasce multiple
(es. 09:00–13:00 / 17:00–21:00)

Supporto riapertura nella stessa giornata
Ordine tra due fasce → evasione nello stesso giorno

Cutoff giornaliero configurabile
Ordini dopo l’orario limite → primo giorno utile

Ferie e chiusure straordinarie

Date singole

Intervalli con motivo personalizzato

Modalità “Accetta e slitta” (default)
Se il negozio è chiuso, l’ordine viene accettato e programmato al primo giorno utile

Messaggio dinamico pre-checkout
Mostra in tempo reale:

apertura futura

riapertura pomeridiana

ordine fuori orario

ferie con motivo

fulfillment_date salvata su ogni ordine
Calcolata lato database (DB-first logic)

📦 Indicatore stock nelle card prodotto

Ogni prodotto mostra:

Testo preciso: Disponibili: X unità / kg

Barra visiva di disponibilità

Il testo è il valore reale e preciso letto dal database.

La barra è solo indicativa e serve come riferimento visivo rapido.

Scala utilizzata:

Prodotti a unità → scala visiva basata su 30 unità

Prodotti a peso → scala visiva basata su 20 kg

Questo non influisce sulla logica di acquisto o sui controlli di stock, che restano sempre basati sul valore reale.
▲ Deploy su Vercel (Produzione)

Vai su https://vercel.com

Importa il repository GitHub

Aggiungi tutte le variabili ambiente

Deploy

Il deploy è automatico ad ogni push su:

master branch

Dopo il deploy:

il sito sarà live

l’admin sarà disponibile su:

/admin

⚡ Aggiornamento stock in tempo reale

Il template utilizza Supabase Realtime.

Quando:

un ordine viene creato

un ordine viene annullato

lo stock viene modificato

la UI si aggiorna automaticamente.

Non è necessario refresh manuale.

⚖️ Vendita a peso (qty_step)

Il sistema supporta:

vendita a pezzi
vendita a peso

Esempi:

0.1 → 100g
0.25 → 250g
0.5 → 500g
1 → 1kg

Configurabile da admin.

🖼 Supabase Storage

Il bucket product-images viene creato automaticamente da setup.sql.

Non è necessario creare nulla manualmente.

📱 Installazione PWA

Su mobile:

Apri il sito

Premi "Aggiungi a Home"

L'app sarà installata.

🧾 Requisiti

Node.js 18+

Supabase account

Stripe account

Vercel account
