Modello PWA per supermercati

Next.js · Supabase · Stripe · PWA

Un modello di Progressive Web App pronto per la produzione, progettato per supermercati e negozi di alimentari locali , realizzato con Next.js App Router , Supabase e Stripe .

Questo modello fornisce sia una vetrina rivolta al cliente sia una potente dashboard di amministrazione , consentendo ai proprietari dei negozi di gestire prodotti, ordini, pagamenti e consegne senza interagire direttamente con Stripe, Supabase o strumenti di database .

Progettato per sviluppatori, liberi professionisti e agenzie .

🚀 Dimostrazione

Demo dal vivo (produzione)

👉https://YOUR-VERCEL-DEMO.vercel.app


Demo amministratore

E-mail:admin@demo.com

Password:demo123

⚠️ La demo utilizza solo dati di prova . Non vengono elaborati pagamenti reali.



🧱 Stack tecnologico

Next.js (router di applicazioni)

Supabase

database PostgreSQL

Conservazione (immagini del prodotto)

Stripe (pagamenti online)

CSS di Tailwind

Applicazione Web progressiva (PWA)

Runtime Node.js (Edge Runtime intenzionalmente non utilizzato)



✨ Caratteristiche
Vetrina

Catalogo prodotti

Categorie

Carrello

Flusso di pagamento

Convalida dell'indirizzo

Calcolo della distanza di consegna

Calcolo delle spese di consegna

PWA installabile (mobile e desktop)

Pagamenti

Pagamenti con carta online (Stripe Checkout)

POS alla consegna

Pagamento alla consegna

Dashboard di amministrazione

Gestione del prodotto

Gestione delle categorie

Gestione degli ordini

Configurazione di consegna

Caricamento delle immagini (Supabase Storage)

Gestione manuale dello stato dei pagamenti per i pagamenti offline



🏪 Panoramica del progetto

Il modello PWA per supermercati è progettato principalmente per i supermercati locali che necessitano di una soluzione moderna e affidabile per la gestione degli ordini online e delle consegne locali .

Il progetto comprende:

una vetrina pubblica per i clienti

una dashboard di amministrazione protetta per gli operatori del negozio

Tutte le operazioni quotidiane possono essere gestite dal pannello di amministrazione, senza dover accedere direttamente a Stripe, Supabase o al database.



💳 Logica di pagamento

Il checkout supporta tre metodi di pagamento:

Pagamento con carta online (Stripe)

POS alla consegna

Pagamento alla consegna

La gestione dei pagamenti segue i flussi di lavoro reali dei supermercati:

Pagamenti con carta online

Elaborato tramite Stripe Checkout

Contrassegnato automaticamente come paiduna volta che il pagamento è andato a buon fine

POS / Pagamenti in contanti

Gli ordini vengono creati come non pagati

Lo stato del pagamento viene aggiornato manualmente dalla dashboard di amministrazione

Ciò garantisce la massima flessibilità ai negozi che fanno ancora molto affidamento sui pagamenti offline.

🧑‍💼 Dashboard di amministrazione

Il pannello di amministrazione è protetto da credenziali e comprende le seguenti sezioni:

📦 Gestione del prodotto

Gli amministratori possono:

Crea nuovi prodotti

Modifica i dettagli del prodotto (prezzo, tipo di unità, sconti, disponibilità)

Scegli l'unità di vendita:

per pezzo

per chilogrammo

Carica le immagini del prodotto

Eliminazione temporanea dei prodotti (i prodotti archiviati possono essere ripristinati)

Ciò impedisce la perdita accidentale di dati e consente una gestione sicura del prodotto.

📋 Gestione degli ordini

Gli amministratori possono:

Visualizza tutti gli ordini con un ID ordine pubblico

Ispezionare gli articoli acquistati e le quantità

Visualizza il metodo di pagamento e lo stato del pagamento

Aggiorna lo stato dell'ordine:

contrassegna come pagato (per pagamenti POS o in contanti)

confermare gli ordini

contrassegnare gli ordini come consegnati

Non è richiesta alcuna interazione diretta con Stripe o con il database.

🗂 Gestione delle categorie

Gli amministratori possono:

Crea categorie

Elimina categorie

Assegna i prodotti alle categorie utilizzate nella vetrina

🚚 Gestione delle consegne

Le regole di consegna sono completamente configurabili dal pannello di amministrazione:

Abilita o disabilita la consegna

Imposta il raggio massimo di consegna (km)

Definisci la distanza di consegna di base

Definisci il costo di consegna base

Definisci il costo extra per chilometro aggiuntivo

🌍 Geolocalizzazione e convalida della consegna

Gli indirizzi dei clienti vengono convalidati utilizzando l'API di geocodifica di Google Maps

La distanza di consegna viene calcolata utilizzando la formula di Haversine

Gli ordini al di fuori del raggio di consegna vengono automaticamente bloccati

Le spese di consegna vengono calcolate dinamicamente in base alla distanza

📦 Cosa è incluso

Codice sorgente completo

Migrazioni supabase

Dati dimostrativi

Documentazione di configurazione di Supabase Storage

Icone PWA e schermate iniziali

Modello di variabili d'ambiente

Guida all'installazione

licenza commerciale

⚙️ Requisiti

Avrai bisogno di:

Node.js ≥ 18

Account Supabase

Conto Stripe

Chiave API di Google Maps

⚠️ L'utilizzo dell'API di Google Maps potrebbe comportare dei costi a seconda del traffico e dell'utilizzo.

🛠 Installazione

Per una guida completa alla configurazione passo dopo passo, consultare INSTALL.md .

🌍 Variabili d'ambiente

Tutte le variabili di ambiente richieste sono documentate in .env.example .

Nessun dominio hardcoded.
Il progetto funziona automaticamente su localhost e Vercel Production .

⚠️ Limitazioni note

Supporto per un singolo negozio (nessun SaaS multi-tenant)

Nessun sistema di autenticazione del cliente incluso

Pagamenti PayPal non inclusi per impostazione predefinita

Utilizzo dell'API di Google Maps fatturato separatamente da Google

Queste scelte sono intenzionali per mantenere il modello pulito, mirato ed estensibile .

📄 Licenza

Questo progetto è concesso in licenza con una licenza modello commerciale .

✔️ Puoi utilizzarlo per progetti personali e per i clienti
❌ Non puoi rivenderlo, ridistribuirlo o pubblicarlo come modello concorrente o SaaS

Per i termini completi, consultare la LICENZA .

🧑‍💻 Supporto

Supporto fornito tramite messaggi Gumroad

Correzioni di bug incluse

Sviluppo personalizzato non incluso

✅ A chi è destinato questo modello

✔ Sviluppatori
✔ Liberi professionisti
✔ Agenzie

❌ Non destinato a utenti non tecnici

🔚 Fine