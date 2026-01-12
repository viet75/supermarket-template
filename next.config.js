const path = require('path')

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
    webpack: (config) => {
        // Configurazione esplicita degli alias per garantire risoluzione corretta in build
        config.resolve.alias = {
            ...config.resolve.alias,
            '@': path.resolve(__dirname),
        }
        return config
    },
}

module.exports = nextConfig
