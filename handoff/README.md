# Gimmick · Pixel Arcade — Handoff per la codebase

Questo pacchetto contiene tutto il design system 16-bit "Pixel Arcade" già
tradotto in TypeScript pronto per essere importato in:
- **`mobile/`** — Expo React Native + NativeWind
- **`frontend/`** — Next.js + Tailwind

Il design system è composto da **3 livelli**:
1. **Token** (`theme.ts`) — palette, shadow, background pattern, font stack
2. **Atomi** (`components.tsx`) — `PixelButton`, `PixelCard`, `PixelBadge`,
   `PixelToggle`, `Segmented`, `ChipGrid`, `PixelWordmark`, `PixelSparkSprite`
3. **Hook** (`useTheme.ts`) — costruisce il theme runtime da utente settings

---

## Mobile (Expo)

1. Copia `handoff/mobile/pixel-theme.ts` → `mobile/constants/pixel-theme.ts`
2. Copia `handoff/mobile/pixel-components.tsx` → `mobile/components/pixel/index.tsx`
3. Aggiungi i font in `app.config.js`:
   ```js
   expo: {
     plugins: [
       ['expo-font', { fonts: [
         './assets/fonts/PressStart2P-Regular.ttf',
         './assets/fonts/JetBrainsMono-Regular.ttf',
         './assets/fonts/JetBrainsMono-Bold.ttf',
       ]}],
     ],
   }
   ```
   Scarica i font da [Google Fonts](https://fonts.google.com/specimen/Press+Start+2P).
4. Avvolgi `app/_layout.tsx` con il `PixelThemeProvider`.
5. Sostituisci `useThemeColors()` con `usePixelTheme()` nei tuoi screen.

## Frontend (Next.js)

1. Copia `handoff/frontend/pixel-theme.ts` → `frontend/lib/pixel-theme.ts`
2. Copia `handoff/frontend/pixel-components.tsx` → `frontend/components/pixel/index.tsx`
3. Aggiungi gli import font in `app/layout.tsx`:
   ```tsx
   import { Press_Start_2P, JetBrains_Mono } from 'next/font/google';

   const pressStart = Press_Start_2P({ subsets:['latin'], weight:'400',
     variable: '--font-pixel-head' });
   const jetbrains  = JetBrains_Mono({ subsets:['latin'],
     variable: '--font-pixel-body' });
   ```
   Poi `<body className={`${pressStart.variable} ${jetbrains.variable}`}>`.
4. Avvolgi i layout con `<PixelThemeProvider>`.

## Persistenza utente

Salva la scelta dell'utente (mode/palette/shadow/bg/bgColor/treatment/scanlines)
in un singolo record `user_settings` o in `AsyncStorage`/`localStorage` con
shape:
```ts
{ mode: 'light'|'dark', palette: 'cmyk', shadowSize: 'm', bgColor: 'cream',
  background: 'none', captureTreatment: 'tinted', scanlines: false }
```

## Aggiungere palette / background / colori

Tutte le constanti vivono in `pixel-theme.ts`. Per aggiungere una palette
"Vaporwave", apri `PIXEL_PALETTES` e aggiungi una entry con `light` e `dark`.
Il theme builder e il Settings screen la espongono automaticamente.

---

## Cosa manca (decisioni di prodotto)

- **Font caricamento async** — sul mobile devi gestire il preload con
  `useFonts()` di Expo prima di renderizzare l'app.
- **Animation primitives** — `px-press`, `px-blink`, `px-pulse` sono in CSS;
  in React Native vanno reimpiementate con `Animated` o `Reanimated`.
- **Web canvas** — i pattern di background usano `repeating-linear-gradient`;
  in React Native servono `expo-linear-gradient` + `react-native-svg`.

## Da seguire come pattern visivo

- **Bordo hard sempre 2px**, mai sfumato
- **Ombre offset solide** (no blur), mai box-shadow blur
- **Border-radius = 0** ovunque, raggi solo dove la codebase originale ne ha
- **Carattere**: titoli/UI in `Press Start 2P`, body in `JetBrains Mono`
- **Capture color treatment** uniforme (scegliere uno tra tinted/dot/outline/mono)
- **Glyph CMYK** per action (▲ ! ◷ ◾) anziché icone outline complesse
- **Wordmark "GIMMICK"** con sparkle sprite 8×8 come elemento ricorrente
