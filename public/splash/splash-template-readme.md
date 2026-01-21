# Splash Screen Workflow

## Source of Truth

Gli **SVG in `/public/splash/`** sono la fonte unica e definitiva per tutti gli splash screen.

- Design e proporzioni devono essere modificati **solo negli SVG**
- I file PNG in `/public/icons/` sono generati automaticamente dagli SVG
- **Non modificare manualmente i PNG**: verranno sovrascritti durante l'esportazione

## Workflow di Produzione

1. **Design negli SVG** → Modifica design, colori, layout
2. **Esportazione PNG** → Genera PNG alle risoluzioni richieste
3. **Deploy PNG** → I PNG esportati vanno in `/public/icons/`

## Struttura File

```
public/
├── splash/              # Source of Truth (SVG)
│   ├── splash-ios.svg
│   └── splash-android.svg
└── icons/               # Output Production (PNG/JPG)
    ├── apple-splash-*.jpg    # iOS splash screens
    └── [altri PNG icon]
```

## Risoluzioni Richieste

### iOS (Apple Touch Startup Images)

Le risoluzioni sono già configurate in `app/layout.tsx`:
- iPhone 15 Pro Max: `1290x2796px` (@3x)
- iPhone 14 Pro Max: `1179x2556px` (@3x)
- iPhone 12/13/14: `1170x2532px` (@3x)
- iPhone X/XS/11 Pro: `1125x2436px` (@3x)
- iPhone 6/7/8 Plus: `750x1334px` (@2x)
- iPhone XR/11: `828x1792px` (@2x)
- iPad Pro: varie risoluzioni

### Android

- xxxhdpi: `1080x1920px`
- xxhdpi: `720x1280px`
- xhdpi: `480x800px`
- hdpi: `320x480px`
- mdpi: `240x320px`

## Esportazione

### Da SVG a PNG

```bash
# Usando ImageMagick
convert -background "#F7F7F7" -density 300 public/splash/splash-ios.svg \
  -resize 1179x2556 public/icons/apple-splash-1179-2556.jpg

# Usando Inkscape (CLI)
inkscape public/splash/splash-ios.svg \
  --export-filename=public/icons/apple-splash-1179-2556.jpg \
  --export-width=1179 --export-height=2556
```

### Tool Online

- [CloudConvert](https://cloudconvert.com/svg-to-png)
- [SVG to PNG](https://svgtopng.com/)

## Best Practices

- **White-label ready**: Design neutro, privo di branding specifico
- **Production-ready**: Qualità vettoriale scalabile
- **Maintainable**: Modifiche solo negli SVG, PNG sempre rigenerati
- **Consistent**: Stesso design cross-platform (iOS/Android)

## Nota Importante

⚠️ **Non editare direttamente i PNG**: qualsiasi modifica manuale verrà persa durante le rigenerazioni successive. Tutte le modifiche vanno apportate agli SVG in `/public/splash/`.
