/** @type {import('next').NextConfig} */
const nextConfig = {
    images: {
        remotePatterns: [
            // Supabase
            {
                protocol: 'https',
                hostname: 'rxyynevklxfaggeumbww.supabase.co',
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
