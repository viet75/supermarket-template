// /lib/env.ts
type Env = {
    NEXT_PUBLIC_SUPABASE_URL: string;
    NEXT_PUBLIC_SUPABASE_ANON_KEY: string;
    SUPABASE_SERVICE_ROLE_KEY: string;
    ADMIN_EMAIL: string;
};

const required: (keyof Env)[] = [
    'NEXT_PUBLIC_SUPABASE_URL',
    'NEXT_PUBLIC_SUPABASE_ANON_KEY',
    'SUPABASE_SERVICE_ROLE_KEY',
    'ADMIN_EMAIL',
];

function readEnv(): Env {
    const out: Partial<Env> = {};
    for (const k of required) {
        const v = process.env[k];
        if (!v || v.trim() === '') {
            throw new Error(`Missing required env: ${k}`);
        }
        out[k] = v;
    }
    return out as Env;
}

export const ENV = readEnv();
