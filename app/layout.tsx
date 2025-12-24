import './globals.css'
import type { Metadata, Viewport } from 'next'
import Header from '@/components/Header'
import ClientRefresher from '@/components/ClientRefresher'

export const metadata: Metadata = {
  title: 'Supermarket Template',
  description: 'Template PWA per supermercati con pannello admin',
  manifest: '/manifest.json',
}


export const viewport: Viewport = {
  themeColor: '#22c55e',
  colorScheme: 'light dark',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="it">
      <head>
        {/* 🔹 Manifest e icone PWA */}
        <link rel="manifest" href="/manifest.json" />
        <link rel="apple-touch-icon" href="/icons/apple-touch-icon.png" />

        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-title" content="Supermarket Template" />
        <meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover" />

        {/* 🔹 Colori chiaro/scuro */}
        <meta name="theme-color" content="#22c55e" media="(prefers-color-scheme: light)" />
        <meta name="theme-color" content="#0a0a0a" media="(prefers-color-scheme: dark)" />
        <meta name="apple-mobile-web-app-status-bar-style" content="default" media="(prefers-color-scheme: light)" />
        <meta name="apple-mobile-web-app-status-bar-style" content="black" media="(prefers-color-scheme: dark)" />

        {/* ===========================================================
            🟩 Splash screen iOS (file in /public/icons)
           =========================================================== */}
        <link rel="apple-touch-startup-image" href="/icons/splash-640x1136.png"
          media="(device-width: 320px) and (device-height: 568px) and (-webkit-device-pixel-ratio: 2)" />

        <link rel="apple-touch-startup-image" href="/icons/splash-750x1334.png"
          media="(device-width: 375px) and (device-height: 667px) and (-webkit-device-pixel-ratio: 2)" />

        <link rel="apple-touch-startup-image" href="/icons/splash-828x1792.png"
          media="(device-width: 414px) and (device-height: 896px) and (-webkit-device-pixel-ratio: 2)" />

        <link rel="apple-touch-startup-image" href="/icons/splash-1024x1366.png"
          media="(device-width: 768px) and (device-height: 1024px) and (-webkit-device-pixel-ratio: 2)" />

        <link rel="apple-touch-startup-image" href="/icons/splash-1125x2436.png"
          media="(device-width: 375px) and (device-height: 812px) and (-webkit-device-pixel-ratio: 3)" />

        <link rel="apple-touch-startup-image" href="/icons/splash-1242x2208.png"
          media="(device-width: 414px) and (device-height: 736px) and (-webkit-device-pixel-ratio: 3)" />

        <link rel="apple-touch-startup-image" href="/icons/splash-1242x2688.png"
          media="(device-width: 414px) and (device-height: 896px) and (-webkit-device-pixel-ratio: 3)" />

        <link rel="apple-touch-startup-image" href="/icons/splash-1536x2048.png"
          media="(device-width: 768px) and (device-height: 1024px) and (-webkit-device-pixel-ratio: 2)" />

        <link rel="apple-touch-startup-image" href="/icons/splash-2208x1242.png"
          media="(device-width: 736px) and (device-height: 414px) and (-webkit-device-pixel-ratio: 3)" />

        <link rel="apple-touch-startup-image" href="/icons/splash-2688x1242.png"
          media="(device-width: 896px) and (device-height: 414px) and (-webkit-device-pixel-ratio: 3)" />

        <link rel="apple-touch-startup-image" href="/icons/splash-2732x2732.png"
          media="(device-width: 1024px) and (device-height: 1366px) and (-webkit-device-pixel-ratio: 2)" />

        {/* 🔹 Blocca pinch-zoom su iOS */}
        <script
          dangerouslySetInnerHTML={{
            __html: `
              if (/iPhone|iPad|iPod/i.test(navigator.userAgent)) {
                document.addEventListener('touchmove', function(event) {
                  if (event.scale !== 1) { event.preventDefault(); }
                }, { passive: false });
              }
            `,
          }}
        />
      </head>

      <body>
        <ClientRefresher />
        <Header />
        <main className="min-h-screen w-full mx-auto px-3 md:px-4 lg:px-6 pb-24 bg-white dark:bg-gray-900 transition-colors">
          {children}
        </main>
      </body>
    </html>
  )
}
