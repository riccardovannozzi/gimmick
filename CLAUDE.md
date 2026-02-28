# CLAUDE.md - Gimmick Project Context

> Documento di riferimento per Claude Code e AI assistants

---

## 🎯 Cos'è Gimmick

**Gimmick** è un'app mobile per la **cattura rapida** di informazioni multi-formato con **assistente AI** integrato.

### Modalità di utilizzo

1. **Standalone**: Cattura e organizza memo per uso personale
2. **Teleport**: Invia "tiles" ad altre applicazioni collegate (es. Magicaboola)

**Obiettivo**: Ridurre al minimo il tempo tra "ho un'informazione da salvare" e "informazione archiviata" - localmente o in un'altra app.

**Repository**: https://github.com/riccardovannozzi/moca

---

## 🚀 Concetto "Teleport"

Gimmick funziona come un **hub di cattura universale**:

```
┌─────────────────────────────────────────────────────────┐
│                      GIMMICK                            │
│                  (Cattura contenuto)                    │
└─────────────────────────┬───────────────────────────────┘
                          │
                          ▼
              ┌───────────────────────┐
              │   Dove vuoi inviare?  │
              └───────────────────────┘
                          │
          ┌───────────────┼───────────────┐
          ▼               ▼               ▼
    ┌──────────┐   ┌──────────────┐   ┌──────────┐
    │ Gimmick  │   │ Magicaboola  │   │ Altra App│
    │ (locale) │   │  (progetto)  │   │ collegata│
    └──────────┘   └──────────────┘   └──────────┘
```

### Flusso Teleport

1. Utente cattura contenuto (foto, audio, testo, etc.)
2. Sceglie destinazione:
   - **Locale**: salva in Gimmick
   - **Teleport**: invia come "tile" a un'app collegata
3. L'app destinazione riceve la tile con metadati

### Integrazione con altre app

```typescript
// Esempio: invio tile a Magicaboola
const teleportTile = {
  source: 'gimmick',
  type: 'photo',
  content_uri: 'https://storage.../photo.jpg',
  metadata: {
    captured_at: '2026-01-10T12:00:00Z',
    location: { lat: 42.123, lng: 11.456 },
  },
  destination: {
    app: 'magicaboola',
    target: 'project_id_123',  // Associa a progetto specifico
  }
};
```

---

## 🛠 Stack Tecnico

### Mobile (Expo/React Native)
| Tecnologia | Versione | Uso |
|------------|----------|-----|
| Expo | SDK 50+ | Framework, build, deploy |
| React Native | 0.73+ | UI mobile |
| TypeScript | 5.x | Type safety |
| Zustand | 5.x | State management |
| NativeWind | 4.x | Styling (Tailwind) |
| Expo Router | 3.x | Navigation |

### Backend (Express.js)
| Tecnologia | Uso |
|------------|-----|
| Express.js | API REST (porta 5000) |
| TypeScript | Type safety |
| Supabase | Auth, Storage, Database |

### Porte di sviluppo
| Servizio | Porta |
|----------|-------|
| Expo (mobile) | 8081 |
| Express.js (backend) | 5000 |

---

## 📁 Struttura Progetto

```
gimmick/
├── CLAUDE.md              # Questo file
├── DEVELOP.md             # Roadmap e tracking
├── backend/
│   └── src/
│       ├── index.ts           # Entry point
│       ├── config/
│       │   └── supabase.ts
│       ├── middleware/
│       │   ├── auth.ts
│       │   ├── errorHandler.ts
│       │   ├── notFoundHandler.ts
│       │   └── validate.ts
│       ├── routes/
│       │   ├── auth.ts
│       │   ├── memos.ts
│       │   ├── tiles.ts       # API per teleport tiles
│       │   └── upload.ts
│       └── types/
│           └── index.ts
└── mobile/
    ├── app/
    │   ├── (tabs)/            # Tab navigation
    │   │   ├── index.tsx      # Home (cattura)
    │   │   ├── history.tsx    # Storico memo
    │   │   └── settings.tsx   # Impostazioni
    │   ├── auth/
    │   │   └── login.tsx
    │   ├── capture/           # Schermate cattura
    │   │   ├── photo.tsx
    │   │   ├── video.tsx
    │   │   ├── text.tsx
    │   │   ├── voice.tsx
    │   │   ├── file.tsx
    │   │   └── gallery.tsx
    │   └── edit/              # Editor
    │       ├── image.tsx
    │       ├── audio.tsx
    │       └── text.tsx
    ├── components/
    │   ├── capture/
    │   │   ├── BufferBar.tsx
    │   │   ├── CaptureButton.tsx
    │   │   └── PreviewOverlay.tsx
    │   ├── chat/
    │   │   └── ChatInput.tsx
    │   ├── layout/
    │   │   └── SafeAreaWrapper.tsx
    │   └── ui/
    │       ├── Button.tsx
    │       ├── ConfirmModal.tsx
    │       ├── IconButton.tsx
    │       ├── Modal.tsx
    │       └── Toast.tsx
    ├── store/
    │   ├── authStore.ts
    │   ├── bufferStore.ts
    │   ├── settingsStore.ts
    │   └── toastStore.ts
    ├── hooks/
    │   └── useVoiceRecorder.ts
    ├── lib/
    │   ├── api.ts
    │   ├── compression.ts
    │   ├── storage.ts
    │   ├── supabase.ts
    │   └── teleport.ts        # Logica teleport verso altre app
    ├── constants/
    │   ├── colors.ts
    │   └── config.ts
    ├── types/
    │   └── index.ts
    └── utils/
        └── formatters.ts
```

---

## 🎨 Design System

### Palette Colori (Dark Theme)

```typescript
const colors = {
  // Backgrounds
  background1: '#1E1E1E',    // Primary background
  background2: '#252526',    // Cards, modals
  background3: '#2D2D30',    // Hover states
  
  // Text
  primary: '#F5F5F5',        // Primary text
  secondary: '#9CA3AF',      // Secondary text
  tertiary: '#6B7280',       // Muted text
  
  // Accent
  accent: '#528BFF',         // Primary accent (blue)
  
  // Semantic
  success: '#22C55E',
  warning: '#F59E0B',
  error: '#EF4444',
  
  // Border
  border: '#3E3E42',
  
  // Bottoni cattura
  capture: {
    photo: '#3B82F6',      // Blue
    video: '#8B5CF6',      // Purple
    text: '#22C55E',       // Green
    voice: '#EF4444',      // Red
    file: '#F59E0B',       // Amber
    gallery: '#EC4899',    // Pink
  }
};
```

### Spacing

```typescript
const spacing = {
  xs: 4,
  sm: 8,
  md: 16,
  lg: 24,
  xl: 32,
};
```

### Componenti UI

| Componente | Specifiche |
|------------|------------|
| CaptureButton | Height: 56px, full-width, icona+label a sinistra |
| ChatInput | Height: 52px, pill shape (border-radius: 26px) |
| BufferBar | Height: 72px, scroll orizzontale |
| Modal | Background: background2, border: border |

---

## 📐 Pattern e Convenzioni

### Zustand Store Pattern

```typescript
// store/exampleStore.ts
import { create } from 'zustand';

interface ExampleState {
  data: string[];
  isLoading: boolean;
  
  // Actions
  addItem: (item: string) => void;
  clear: () => void;
}

export const useExampleStore = create<ExampleState>((set) => ({
  data: [],
  isLoading: false,
  
  addItem: (item) => set((state) => ({
    data: [...state.data, item],
  })),
  
  clear: () => set({ data: [] }),
}));
```

### Componente Pattern

```typescript
// components/Example.tsx
import React from 'react';
import { View, Text, Pressable } from 'react-native';

interface ExampleProps {
  title: string;
  onPress: () => void;
  disabled?: boolean;
}

export function Example({ title, onPress, disabled = false }: ExampleProps) {
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      className="bg-background2 p-4 rounded-lg border border-border"
    >
      <Text className="text-primary">{title}</Text>
    </Pressable>
  );
}

export default Example;
```

### Import/Export

```typescript
// Usa index.ts per re-export
// components/ui/index.ts
export { Button } from './Button';
export { Modal } from './Modal';
export { Toast } from './Toast';

// Poi importa così:
import { Button, Modal } from '@/components/ui';
```

### Naming Conventions

| Tipo | Convenzione | Esempio |
|------|-------------|---------|
| Componenti | PascalCase | `CaptureButton.tsx` |
| Hooks | camelCase con "use" | `useVoiceRecorder.ts` |
| Store | camelCase con "Store" | `bufferStore.ts` |
| Tipi/Interface | PascalCase | `BufferItem`, `MemoType` |
| Costanti | UPPER_SNAKE o camelCase | `colors`, `API_URL` |

---

## 🗄 Database Schema

### Tabella memos (contenuti locali)

```sql
CREATE TABLE memos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id),
  type TEXT NOT NULL, -- 'photo', 'video', 'text', 'audio_recording', 'audio_file', 'file', 'image'
  content TEXT,
  storage_path TEXT,
  thumbnail_path TEXT,
  file_name TEXT,
  mime_type TEXT,
  file_size INTEGER,
  duration INTEGER,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
```

### Tabella tiles (per teleport)

```sql
CREATE TABLE tiles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id),
  memo_id UUID REFERENCES memos(id),
  
  -- Destinazione teleport
  destination_app TEXT NOT NULL,      -- 'magicaboola', 'altra_app'
  destination_target TEXT,            -- ID risorsa nell'app destinazione
  
  -- Stato
  status TEXT DEFAULT 'pending',      -- 'pending', 'sent', 'received', 'failed'
  sent_at TIMESTAMPTZ,
  received_at TIMESTAMPTZ,
  
  -- Metadata
  metadata JSONB DEFAULT '{}',
  
  created_at TIMESTAMPTZ DEFAULT NOW()
);
```

### Storage Paths

```
memos/{user_id}/photos/{memo_id}.jpg
memos/{user_id}/videos/{memo_id}.mp4
memos/{user_id}/audio/{memo_id}.m4a
memos/{user_id}/files/{memo_id}_{filename}
thumbnails/{user_id}/{memo_id}_thumb.jpg
```

---

## 🔧 Comandi Utili

### Sviluppo

```bash
# Mobile
cd mobile
npx expo start

# Backend
cd backend
npm run dev

# Installare dipendenza Expo-compatibile
npx expo install [pacchetto]
```

### Git

```bash
git add .
git commit -m "feat: descrizione"
git push
```

### Build

```bash
# APK Android (preview)
eas build --platform android --profile preview

# APK Android (production)
eas build --platform android --profile production
```

---

## 📱 Funzionalità App

### Tipi di Cattura (6)

| Tipo | Icona | Azione |
|------|-------|--------|
| FOTO | 📷 | Scatta con fotocamera |
| VIDEO | 🎬 | Registra max 30 sec, 720p |
| TESTO | 📝 | Scrivi nota |
| VOCE | 🎤 | Registra audio |
| FILE | 📁 | Importa documento |
| GALLERIA | 🖼️ | Seleziona da rullino |

### Chat AI

Input stile Google con campo testo + microfono:
- Comandi testuali o vocali
- AI parsing e esecuzione azioni
- Esempi: "Ricordami di...", "Riassumi gli ultimi memo"

### Flusso Cattura

```
Tap bottone → Cattura → Preview → [Annulla|Aggiungi|Modifica] → Buffer → [Salva locale | Teleport]
```

### Flusso Teleport

```
Buffer pieno → Tap Invia → Scegli destinazione:
  - "Salva in Gimmick" → Upload locale
  - "Invia a Magicaboola" → Teleport tile
  - "Invia a [altra app]" → Teleport tile
```

---

## ⚠️ Note Importanti

1. **NativeWind**: Usare `className` invece di `style` per Tailwind
2. **Expo Router**: File-based routing in `app/`
3. **Supabase RLS**: Row Level Security attivo, ogni query filtrata per user_id
4. **TypeScript**: Strict mode attivo, evitare `any`
5. **Icone**: Usare `lucide-react-native`
6. **Teleport**: Le tile inviate mantengono riferimento al memo originale

---

## 🔗 App Collegate (Teleport)

| App | Descrizione | Stato |
|-----|-------------|-------|
| Magicaboola | Gestione pagamenti strutture turistiche | 🔄 Da integrare |
| (altre) | Future integrazioni | ⏳ Pianificate |

---

*Ultimo aggiornamento: Gennaio 2026*
