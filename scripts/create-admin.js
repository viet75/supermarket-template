import { createClient } from '@supabase/supabase-js'
import 'dotenv/config'

const url = process.env.NEXT_PUBLIC_SUPABASE_URL
const service = process.env.SUPABASE_SERVICE_ROLE_KEY

if (!url || !service) {
    console.error("Missing env vars. Check your .env.local file.")
    process.exit(1)
}

const sb = createClient(url, service)

async function run() {
    console.log("Creating admin user...")

    const { data, error } = await sb.auth.admin.createUser({
        email: 'admin@demo.com',
        password: 'admin123',
        email_confirm: true
    })

    if (error) {
        console.error("ERROR:", error)
    } else {
        console.log("SUCCESS:", data)
    }
}

run()
