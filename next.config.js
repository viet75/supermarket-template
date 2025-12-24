/** @type {import('next').NextConfig} */
const nextConfig = {
    images: {
        remotePatterns: [
            // Supabase - hostname vecchio
            {
                protocol: 'https',
                hostname: 'rxyynevklxfaggeumbww.supabase.co',
                pathname: '/storage/v1/object/public/**',
            },
            // Supabase - hostname nuovo
            {
                protocol: 'https',
                hostname: 'ylhridpfwojluakbqktu.supabase.co',
                pathname: '/storage/v1/object/public/**',
            },
            // Supabase - pattern generico (per qualsiasi progetto Supabase)
            {
                protocol: 'https',
                hostname: '*.supabase.co',
                pathname: '/storage/v1/object/public/**',
            },
            // Unsplash
            {
                protocol: 'https',
                hostname: 'images.unsplash.com',
                pathname: '/**',
            },
        ],
    },
}

module.exports = nextConfig
