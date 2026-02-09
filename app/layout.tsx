import './globals.css'
import type { Metadata, Viewport } from 'next'
import DisableIOSZoom from '@/components/DisableIOSZoom'
import ClientRefresher from '@/components/ClientRefresher'

export const metadata: Metadata = {
  title: 'Supermarket Template',
  description: 'Template PWA per supermercati con pannello admin',
  manifest: '/manifest.json',
  icons: {
    icon: '/icons/icon-192x192.png',
    apple: '/icons/apple-touch-icon.png',
  },
}

export const viewport: Viewport = {
  themeColor: '#22c55e',
  colorScheme: 'light dark',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="it">
      <head>
        {/* 🔹 Manifest e icone PWA (icon + apple da metadata.icons) */}
        <link rel="manifest" href="/manifest.json" />

        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-title" content="Supermarket Template" />
        <meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no, viewport-fit=cover" />

        {/* 🔹 Theme color per Android */}
        <meta name="theme-color" content="#10C157" />

        {/* 🔹 Colori chiaro/scuro */}
        <meta name="theme-color" content="#22c55e" media="(prefers-color-scheme: light)" />
        <meta name="theme-color" content="#0a0a0a" media="(prefers-color-scheme: dark)" />
        <meta name="apple-mobile-web-app-status-bar-style" content="default" />

        {/* ===========================================================
            🟩 Splash screen iOS (file in /public/icons)
           =========================================================== */}
        {/* iPhone 12/13/14 Pro Max - Portrait */}
        <link rel="apple-touch-startup-image" href="/icons/apple-splash-1170-2532.png"
          media="(device-width: 390px) and (device-height: 844px) and (-webkit-device-pixel-ratio: 3) and (orientation: portrait)" />
        
        {/* iPhone 12/13/14 Pro Max - Landscape */}
        <link rel="apple-touch-startup-image" href="/icons/apple-splash-2532-1170.png"
          media="(device-width: 390px) and (device-height: 844px) and (-webkit-device-pixel-ratio: 3) and (orientation: landscape)" />

        {/* iPhone 14 Pro Max - Portrait */}
        <link rel="apple-touch-startup-image" href="/icons/apple-splash-1179-2556.png"
          media="(device-width: 393px) and (device-height: 852px) and (-webkit-device-pixel-ratio: 3) and (orientation: portrait)" />
        
        {/* iPhone 14 Pro Max - Landscape */}
        <link rel="apple-touch-startup-image" href="/icons/apple-splash-2556-1179.png"
          media="(device-width: 393px) and (device-height: 852px) and (-webkit-device-pixel-ratio: 3) and (orientation: landscape)" />

        {/* iPhone 14 Plus - Portrait */}
        <link rel="apple-touch-startup-image" href="/icons/apple-splash-1284-2778.png"
          media="(device-width: 428px) and (device-height: 926px) and (-webkit-device-pixel-ratio: 3) and (orientation: portrait)" />
        
        {/* iPhone 14 Plus - Landscape */}
        <link rel="apple-touch-startup-image" href="/icons/apple-splash-2778-1284.png"
          media="(device-width: 428px) and (device-height: 926px) and (-webkit-device-pixel-ratio: 3) and (orientation: landscape)" />

        {/* iPhone 15 Pro Max - Portrait */}
        <link rel="apple-touch-startup-image" href="/icons/apple-splash-1290-2796.png"
          media="(device-width: 430px) and (device-height: 932px) and (-webkit-device-pixel-ratio: 3) and (orientation: portrait)" />
        
        {/* iPhone 15 Pro Max - Landscape */}
        <link rel="apple-touch-startup-image" href="/icons/apple-splash-2796-1290.png"
          media="(device-width: 430px) and (device-height: 932px) and (-webkit-device-pixel-ratio: 3) and (orientation: landscape)" />

        {/* iPhone X/XS/11 Pro - Portrait */}
        <link rel="apple-touch-startup-image" href="/icons/apple-splash-1125-2436.png"
          media="(device-width: 375px) and (device-height: 812px) and (-webkit-device-pixel-ratio: 3) and (orientation: portrait)" />
        
        {/* iPhone X/XS/11 Pro - Landscape */}
        <link rel="apple-touch-startup-image" href="/icons/apple-splash-2436-1125.png"
          media="(device-width: 375px) and (device-height: 812px) and (-webkit-device-pixel-ratio: 3) and (orientation: landscape)" />

        {/* iPhone 6/7/8 Plus - Portrait */}
        <link rel="apple-touch-startup-image" href="/icons/apple-splash-750-1334.png"
          media="(device-width: 375px) and (device-height: 667px) and (-webkit-device-pixel-ratio: 2) and (orientation: portrait)" />
        
        {/* iPhone 6/7/8 Plus - Landscape */}
        <link rel="apple-touch-startup-image" href="/icons/apple-splash-1334-750.png"
          media="(device-width: 375px) and (device-height: 667px) and (-webkit-device-pixel-ratio: 2) and (orientation: landscape)" />

        {/* iPhone XR/11 - Portrait */}
        <link rel="apple-touch-startup-image" href="/icons/apple-splash-828-1792.png"
          media="(device-width: 414px) and (device-height: 896px) and (-webkit-device-pixel-ratio: 2) and (orientation: portrait)" />
        
        {/* iPhone XR/11 - Landscape */}
        <link rel="apple-touch-startup-image" href="/icons/apple-splash-1792-828.png"
          media="(device-width: 414px) and (device-height: 896px) and (-webkit-device-pixel-ratio: 2) and (orientation: landscape)" />

        {/* iPad Pro 12.9" - Portrait */}
        <link rel="apple-touch-startup-image" href="/icons/apple-splash-2048-2732.png"
          media="(device-width: 1024px) and (device-height: 1366px) and (-webkit-device-pixel-ratio: 2) and (orientation: portrait)" />
        
        {/* iPad Pro 12.9" - Landscape */}
        <link rel="apple-touch-startup-image" href="/icons/apple-splash-2732-2048.png"
          media="(device-width: 1024px) and (device-height: 1366px) and (-webkit-device-pixel-ratio: 2) and (orientation: landscape)" />

      </head>

      <body>
        <DisableIOSZoom />
        <ClientRefresher />
        {children}
      </body>
    </html>
  )
}
