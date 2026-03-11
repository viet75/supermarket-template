# Supermarket PWA Template

🌍 Available languages:

- 🇬🇧 English
- 🇮🇹 Italiano → [README.it.md](README.it.md)

Next.js · Supabase · Stripe · PWA

Supermarket PWA Template is a production-ready Progressive Web App
template for supermarkets and local grocery stores.

It is designed for developers, freelancers and agencies who want to quickly deliver
a complete e-commerce + order management + delivery solution
without having to design architecture, database or payment flows from scratch.

The template includes:

a public storefront for customers

a protected admin dashboard

a DB-first database architecture with critical logic handled in the backend (Supabase)

The store owner manages everything from the admin panel,
without ever interacting directly with Stripe, Supabase or the database.

🚀 Demo
🎬 Video Demo

Watch the full template in action:

👉 https://youtu.be/FVi38J3yYIo

Live Demo

👉 https://supermarketpwa.com

🧪 Demo Mode

The demo is configured to simulate a local supermarket with home delivery.

Demo configuration:

City: Milan
ZIP code: 20121

To properly test checkout and delivery verification,
use an address located within this area.

The system uses these coordinates to:

automatically calculate delivery distance

verify delivery coverage

determine whether an address is serviceable

🔐 Admin Panel Access (Demo)

You can access the administrative panel of the demo using:

Admin panel:

👉 https://supermarketpwa.com/admin

Demo credentials:

Email: admin@demo.com
Password: demo123

⚠️ Note

The demo uses test data only.

No real payments are processed

All orders are simulated

The environment is periodically reset

🧱 Tech Stack

Next.js (App Router)

Supabase

PostgreSQL

Auth

Storage

Stripe (online payments)

Tailwind CSS

Progressive Web App (PWA)

Node.js Runtime
(Edge Runtime intentionally not used)

✨ Features
Customer storefront

Product catalog

Categories

Shopping cart

Checkout

Address validation

Delivery distance calculation

Delivery fee calculation

Installable PWA (mobile and desktop)

Payments

Online card payment (Stripe Checkout)

POS on delivery

Cash on delivery

No PayPal

PayPal is intentionally not included.

The template is designed primarily for local supermarkets,
where customers already know the store and have a direct trust relationship.

In these contexts, the most common payment methods are:

cash on delivery

POS payment on delivery

online card payment (Stripe Checkout)

Stripe already guarantees high security and compliance standards (PCI DSS).

PayPal can be integrated later if required,
but it is not included in order to keep the template simpler,
lighter and focused on the real use case of local grocery stores.

Admin dashboard

Product management

Category management

Order management

Delivery configuration

Image upload (Supabase Storage)

Manual offline payment management

🏪 Project Overview

The template is designed for local supermarkets that need
a modern solution for online orders and home delivery.

All daily operations (products, orders, payments, delivery)
are managed exclusively from the admin panel.

💳 Payment Logic
Online card

Managed via Stripe Checkout

payment_status automatically becomes paid after successful payment

POS / Cash

Orders are created as unpaid

Status is manually updated by the admin

### Refunds

Refunds for online payments are handled directly from the Stripe Dashboard.

Stripe is the single source of truth for all payment operations, including:

- full refunds
- partial refunds
- payment disputes
- payment history

Managing refunds directly in Stripe avoids inconsistencies between the payment provider and the application database.

For orders paid via **POS** or **cash on delivery**, refunds can be handled manually by the store.

🗄 Database Setup (ONE-SHOT)

The template is designed to be installed on a completely empty Supabase project using a single SQL script.

This approach allows you to configure the entire backend in just a few minutes.

Step 1 — Create a Supabase project

Go to

https://supabase.com

Create a new project.

Open SQL Editor.

Step 2 — Run the installation script

Open the file:

supabase/setup.sql

Copy the entire content and paste it into the Supabase SQL Editor, then run it.

The script automatically performs:

creation of all tables

creation of RPC functions

configuration of RLS and policies

creation of Supabase Storage buckets

insertion of demo data

application of SAFE ALTER patches

⚠️ The script is idempotent
It can be executed multiple times without generating errors.

🌱 Demo Data (Seed)

The file supabase/setup.sql automatically inserts:

example categories

demo products (per_unit and per_kg)

This allows you to have a working demo immediately.

If you want a completely empty database for production, you can:

comment
or

remove

the DEMO SEED block inside the setup.sql file.

👤 Admin User Setup (REQUIRED)

⚠️ Before creating the admin user it is mandatory to run supabase/setup.sql.

Without this step:

the public.profiles table does not exist

the admin promotion will fail

Step 1 — Create a user

Go to:

Supabase Dashboard → Authentication → Users → Add user

Create a new user with email and password.

Note:
When a user is created in Supabase Auth, a row in public.profiles
is automatically created through a database trigger.

Step 2 — Promote the user to admin

After creating the user, open SQL Editor and run:

update public.profiles
set role = 'admin'
where id = (
  select id from auth.users
  where email = 'YOUR_ADMIN_EMAIL'
);

Replace YOUR_ADMIN_EMAIL with the email of the user you just created.

Accessing the Admin Panel

Once the admin role is assigned, you will be able to access the admin panel:

/admin
🔑 Environment Variables (REQUIRED)

Create a .env.local file in the root of the project.

You can copy the .env.example file included in the template and modify it with your real values.

cp .env.example .env.local

Example configuration:

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

# Google Maps (Delivery geolocation)
GOOGLE_MAPS_API_KEY=your_google_maps_api_key

# Store coordinates (REQUIRED for delivery calculation)
NEXT_PUBLIC_STORE_LAT=40.000000
NEXT_PUBLIC_STORE_LNG=16.000000
NEXT_PUBLIC_STORE_NAME=Your Store Name
Where to find the keys
Supabase

Go to:

Project Settings → API

Copy:

Project URL

anon public key

service_role key

Stripe

Go to:

Developers → API Keys

Copy:

Publishable key

Secret key

Google Maps API (Delivery geolocation)

Required for:

calculating delivery distance

verifying customer address coverage

Go to:

https://console.cloud.google.com/

Enable the following APIs:

Maps JavaScript API

Geocoding API

Distance Matrix API

Store Coordinates

You can get store coordinates from:

https://maps.google.com

Right click on the store location → copy coordinates.

Example:

40.8518
14.2681

⚠️ Important

Without Google Maps API and store coordinates:

delivery distance calculation will not work

delivery area verification will not work

checkout may be blocked

⚠️ Security

Never commit .env.local to the repository.

This file contains private keys and must remain only in the local environment or production server.

🕐 Store hours & closures

Opening hours, cutoff time and closure days are managed DB-first:
the RPC get_fulfillment_preview() is the single source of truth for both UI and order APIs.

Configuration (Admin)

In Admin → Delivery Settings (section “Store hours & closures”):

Cutoff time (e.g. 19:00)
After this time, orders will be fulfilled the next day (or the next available day).

Accept orders when closed
If enabled, orders placed outside opening hours are accepted and scheduled for the next available day.
If disabled, checkout is blocked.

Timezone (e.g. Europe/Rome)
Used for current time calculations.

Preparation days
Additional days before order fulfillment (0 = same day).

Closed dates
One date per line, format YYYY-MM-DD.

Weekly hours (JSON)
Keys 0 (Sunday) → 6 (Saturday)

Value options:

null → closed

"09:00-19:00" → open time range

Example weekly_hours
{
  "0": null,
  "1": "09:00-19:00",
  "2": "09:00-19:00",
  "3": "09:00-19:00",
  "4": "09:00-19:00",
  "5": "09:00-19:00",
  "6": "09:00-13:00"
}

Sunday closed
Monday–Friday 9–19
Saturday 9–13

Example closed_dates

One date per line:

2025-12-25
2025-01-01
Behavior

During checkout the customer sees a message like:

Order will be fulfilled starting from DD/MM/YYYY

If the store does not accept orders, checkout is blocked.

Backend validation

In POST /api/orders the same RPC is called.

If:

can_accept === false

The API responds with:

409
code: "STORE_CLOSED"

The fulfillment date (next_fulfillment_date) is saved in:

orders.fulfillment_date

(type date)

🔐 Security and RLS

The database uses Row Level Security (RLS).

Configuration is automatically handled by setup.sql.

Public users

Can read:

active products

active categories

Admin users

Can manage:

products

categories

orders

store settings

Admin access is based on:

public.profiles.role = 'admin'
🔐 Security – INTERNAL_ADMIN_KEY (REQUIRED)

The project uses an internal security key to protect sensitive admin actions.

This key is required for:

Server Actions

protected API routes

You must generate a unique key for every installation.

Example:

node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"

Then add it to your environment variables:

INTERNAL_ADMIN_KEY=your_generated_key

⚠️ IMPORTANT

It must always be changed in production

It must never be committed to the repository

Each client installation must have a different key

⚙️ Admin Settings

The admin panel provides two configuration sections.

General Settings

Path:

/admin/settings

Allows configuration of public store information:

Store name

Address

Email

Phone

Opening hours

Google Maps link

These values are automatically displayed in the public footer.

Delivery Settings

Path:

/admin/settings/delivery

Allows configuration of:

Enable / disable delivery

Base delivery cost

Extra cost per km

Maximum delivery distance

Available payment methods

💳 Testing Stripe locally

To test online payments locally you need the Stripe CLI.

Installation
winget install Stripe.StripeCLI
Login
stripe login
Start webhook listener
stripe listen --forward-to localhost:3000/api/webhooks/stripe

Stripe will return a webhook key:

whsec_xxxxxxxxx

Add it to .env.local:

STRIPE_WEBHOOK_SECRET=whsec_xxxxxxxxx

Restart the development server:

npm run dev
Test card
Number: 4242 4242 4242 4242
Expiry: any future date
CVC: any
🔧 First delivery configuration (REQUIRED)

For security reasons, delivery is disabled by default after a new database installation.

This behavior prevents the store from accepting orders before it has been properly configured.

🛑 Expected initial behavior

Immediately after installation:

❌ Checkout blocked
❌ "Confirm order" button disabled

⚠️ Message shown to the customer:

Deliveries are temporarily disabled

This is normal.

✅ How to enable delivery

Go to:

Admin → Delivery settings

Configure at least:

Included distance (km)

Maximum distance (km)

Then enable:

Enable home delivery

Save.

Delivery will be immediately active.

🛡️ Security

This system protects against:

accidental orders after installation

unconfigured store

customers outside delivery area

🧠 Architecture

The delivery guard is implemented on three levels:

1️⃣ UI (CheckoutForm)
2️⃣ API (/api/orders)
3️⃣ Database trigger (guard_orders_delivery_enabled)

Even if the client bypasses the UI,
the database still blocks the order.

🗂 Supabase Storage

The bucket product-images is automatically created by setup.sql.

No manual configuration is required in the Supabase dashboard.

📦 Stock System (DB-first, RPC)

Stock is managed exclusively by the database through PostgreSQL RPC functions.

Node / Next.js must never modify stock directly.

Public RPC functions (PostgREST)
reserve_order_stock(order_id uuid)
release_order_stock(order_id uuid)
cleanup_expired_reservations()
Legacy compatibility

Older function names are still supported:

reserveOrderStock(order_id uuid)
releaseOrderStock(order_id uuid)
cleanupExpiredReservations()
Order flow

When an order is created:

1️⃣ orders and order_items are created

2️⃣ the function is called:

reserve_order_stock(order_id)

3️⃣ stock is reduced inside the database

orders.stock_reserved = true
Online payments (card)
payment_status = pending
reserve_expires_at = now + TTL

If payment does not complete:

cleanup_expired_reservations()
Cash / POS on delivery

Stock is reduced immediately.

If the order is cancelled:

release_order_stock(order_id)

📦 What the template includes

This template includes everything required to launch a local grocery delivery service for supermarkets or small food stores:

Complete Next.js application

Administrative dashboard

Supabase database schema with RPC functions

Stripe Checkout integration

Delivery distance calculation (Google Maps API)

Stock management system (DB-first architecture)

Progressive Web App (PWA)

Environment configuration file (.env.example)

Complete installation documentation

⚠️ Known limitations

Single-store support (no multi-tenant)

No customer authentication

PayPal not included

Google Maps API may incur costs

A unique INTERNAL_ADMIN_KEY must be generated for every installation.

This key is used internally by the backend to protect sensitive API routes.

Example:

openssl rand -hex 32

Then add it to your environment:

INTERNAL_ADMIN_KEY=generated_key
🧾 Requirements

Before installing the template you must have:

Node.js 18 or higher

A Supabase account

A Stripe account

A Google Cloud account (for Google Maps APIs)

A Vercel account (recommended for deployment)

📄 License

This project is distributed under a Commercial License.

✔ You may use this template for personal projects and client projects
✔ You may modify the template according to your needs

❌ You may NOT resell this template
❌ You may NOT redistribute the source code
❌ You may NOT use it to create competing templates or SaaS products

The source code is licensed, not sold.
Full ownership remains with the author.

See the LICENSE.txt file for full terms.

🧑‍💻 Support

Support is provided via Gumroad.

Included:

Bug fixes

Not included:

Custom development

🕒 Advanced store hours & closures

Features include:

Configurable weekly opening hours with multiple time slots

Example:

09:00–13:00 / 17:00–21:00

Support for same-day reopening
Orders placed between two time slots → fulfilled the same day.

Daily cutoff time

Orders placed after the configured cutoff time are scheduled for the next available day.

Holidays and special closures

Supported options:

Single dates

Date ranges with custom reason

“Accept and postpone” mode (default)

If the store is closed, the order is accepted and automatically scheduled for the next available day.

Dynamic pre-checkout message

The system can display real-time messages such as:

upcoming opening

afternoon reopening

order outside working hours

holiday closures with reason

fulfillment_date saved for each order

The fulfillment date is calculated on the database side and stored in:

orders.fulfillment_date

(DB-first logic)

📦 Stock indicator on product cards

Each product shows:

Precise text: Available: X units / kg

Visual availability bar

The text shows the exact real value from the database.

The bar is only a visual indicator.

Visual scale used

Unit-based products:

visual scale based on 30 units

Weight-based products:

visual scale based on 20 kg

This does not affect the purchasing logic or stock validation.

All stock validation is always based on the real database value.

▲ Deploy on Vercel (Production)

Go to:

https://vercel.com

Steps:

Import the GitHub repository

Add all environment variables

Deploy

Deployment runs automatically on every push to:

master branch

After deployment:

the website will be live

the admin panel will be available at:

/admin
⚡ Real-time stock updates

The template uses Supabase Realtime.

Whenever:

an order is created

an order is cancelled

stock is modified

the UI updates automatically.

No manual refresh is required.

⚖️ Weight-based selling (qty_step)

The system supports:

selling by units

selling by weight

Examples:

0.1 → 100g
0.25 → 250g
0.5 → 500g
1 → 1kg

Configurable directly from the admin panel.

🖼 Supabase Storage

The bucket product-images is automatically created by setup.sql.

No manual configuration is required.

📱 PWA installation

On mobile devices:

Open the website

Tap Add to Home Screen

The app will be installed like a native application.

🧾 Requirements
Node.js 18+
Supabase account
Stripe account
Vercel account
