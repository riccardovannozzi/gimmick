# CLAUDE.md - Gimmick Project Context

> Documento di riferimento per Claude Code e AI assistants

---

## Cos'e Gimmick

**Gimmick** e un'app multi-piattaforma per la **cattura rapida** di informazioni multi-formato con **assistente AI** integrato.

### Modalita di utilizzo

1. **Standalone**: Cattura e organizza spark per uso personale
2. **Teleport**: Invia "tiles" ad altre applicazioni collegate (es. Magicaboola)

**Obiettivo**: Ridurre al minimo il tempo tra "ho un'informazione da salvare" e "informazione archiviata" - localmente o in un'altra app.

---

## Architettura Entita

### Struttura di un Tile

```
TILE
  │
  ├── SPARKS (contenuti catturati dall'utente)
  │     ├── foto
  │     ├── testo
  │     ├── gallery
  │     ├── audio
  │     ├── video
  │     └── file
  │
  ├── METADATI (campi strutturati del Tile)
  │     ├── title
  │     ├── description
  │     ├── is_event
  │     ├── start_at
  │     └── end_at
  │
  └── SERVIZI AI (layer di interazione)
        ├── chat (conversazione contestuale)
        ├── tags + summary (generati dagli Spark)
        └── embedding (vettore semantico)
```

### Regola fondamentale

| Layer | Creato da | È un dato persistente? | Vive in |
|-------|-----------|----------------------|---------|
| Spark | utente | ✅ | tabella `sparks` |
| Metadati | utente o AI | ✅ | tabella `tiles` |
| Servizi AI | interazione | ❌ | stateless / sessione |

- **Sparks**: contenuti catturati dall'utente. Sono atomici e appartengono a un Tile
- **Metadati**: campi strutturati del Tile (title, description, date). Possono essere inseriti dall'utente o estratti dall'AI dagli Spark
- **Servizi AI**: layer di interazione sopra il Tile. La chat AI non è uno Spark — è un'interfaccia. I risultati AI (es. riassunto) possono diventare Spark solo se l'utente lo sceglie esplicitamente

### Schema interno (riferimento rapido)

```
TILE (contenitore)
├── title, description, is_event
├── start_at, end_at          (scheduling/eventi)
├── SPARKS (contenuti)
│   ├── photo, image, video
│   ├── audio_recording, text, file, gallery
│   └── metadata (tags, summary, ai_description, transcript, pending_event)
└── SERVIZI AI
    ├── Chat (Claude Sonnet)
    ├── Tags + Summary (Claude Haiku)
    ├── Embedding (text-embedding-3-small)
    └── Date extraction (Claude Haiku, confidence scoring)
```

### Entita principali

- **Tile**: Contenitore logico. Puo essere un evento (is_event + start_at/end_at) o un semplice raggruppamento
- **Spark**: Singolo contenuto catturato (foto, video, audio, testo, file, gallery). Appartiene a un Tile
- **Tag**: Etichetta generata dall'AI, con alias per deduplicazione

### AI Indexing Pipeline

Quando un nuovo Spark viene creato:
1. AI genera tags + summary (Claude Haiku)
2. AI genera embedding vettoriale (OpenAI text-embedding-3-small)
3. Per sparks di tipo text/audio: AI estrae date con confidence scoring
   - Confidence >= 0.8: auto-salva start_at/end_at sul tile
   - Confidence 0.3-0.8: salva come `pending_event` nei metadata dello spark

---

## Stack Tecnico

### Frontend (Next.js - Dashboard Web)
| Tecnologia | Uso |
|------------|-----|
| Next.js 15 | App Router, SSR |
| TypeScript | Type safety |
| Tailwind CSS | Styling |
| React Query | Data fetching |
| Zustand | State management |
| FullCalendar | Calendario eventi |
| D3.js | Grafo relazioni |

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
| Claude API | AI chat, indexing, date extraction |
| OpenAI API | Embeddings |

### Porte di sviluppo
| Servizio | Porta |
|----------|-------|
| Next.js (frontend) | 3000 |
| Expo (mobile) | 8081 |
| Express.js (backend) | 5000 |

---

## Struttura Progetto

```
gimmick/
├── CLAUDE.md              # Questo file
├── DEVELOP.md             # Roadmap e tracking
├── frontend/              # Next.js dashboard
│   ├── app/(dashboard)/
│   │   ├── page.tsx           # Dashboard home
│   │   ├── sparks/page.tsx    # Lista sparks
│   │   ├── tiles/page.tsx     # Lista tiles
│   │   ├── calendar/page.tsx  # Calendario eventi
│   │   ├── graph/page.tsx     # Grafo relazioni
│   │   └── capture/page.tsx   # Cattura contenuti
│   ├── components/
│   │   ├── spark/spark-viewer.tsx
│   │   ├── chat/chat-panel.tsx
│   │   └── layout/sidebar.tsx
│   ├── lib/
│   │   ├── api.ts             # sparksApi, tilesApi, calendarApi, chatApi
│   │   └── spark-utils.ts     # Utility per spark types
│   └── types/index.ts
├── backend/
│   └── src/
│       ├── index.ts           # Entry point
│       ├── config/supabase.ts
│       ├── middleware/
│       │   ├── auth.ts
│       │   ├── errorHandler.ts
│       │   ├── notFoundHandler.ts
│       │   └── validate.ts
│       ├── routes/
│       │   ├── auth.ts
│       │   ├── sparks.ts      # CRUD sparks + search + reindex
│       │   ├── tiles.ts       # CRUD tiles
│       │   ├── calendar.ts    # Eventi calendario + create-event
│       │   ├── chat.ts        # AI chat
│       │   └── upload.ts      # File upload
│       ├── services/
│       │   ├── ai.ts          # AI chat con tool use
│       │   └── indexing.ts    # AI indexing pipeline
│       ├── scripts/
│       │   ├── reindex-all.ts
│       │   └── fix-orphan-sparks.ts
│       └── types/index.ts
└── mobile/
    ├── app/
    │   ├── (tabs)/
    │   │   ├── index.tsx      # Home (cattura)
    │   │   ├── history.tsx    # Storico sparks
    │   │   └── settings.tsx   # Impostazioni
    │   ├── auth/login.tsx
    │   ├── capture/           # Schermate cattura
    │   └── edit/              # Editor
    ├── components/
    │   ├── capture/
    │   ├── chat/
    │   ├── layout/
    │   └── ui/
    ├── store/
    │   ├── authStore.ts
    │   ├── bufferStore.ts
    │   ├── settingsStore.ts
    │   └── toastStore.ts
    ├── lib/
    │   ├── api.ts             # sparksApi
    │   ├── storage.ts         # Supabase storage (bucket: sparks)
    │   └── supabase.ts
    └── types/index.ts
```

---

## Design System

### Palette Colori (Dark Theme)

```typescript
const colors = {
  background1: '#1E1E1E',    // Primary background
  background2: '#252526',    // Cards, modals
  background3: '#2D2D30',    // Hover states
  primary: '#F5F5F5',        // Primary text
  secondary: '#9CA3AF',      // Secondary text
  tertiary: '#6B7280',       // Muted text
  accent: '#528BFF',         // Primary accent (blue)
  success: '#22C55E',
  warning: '#F59E0B',
  error: '#EF4444',
  border: '#3E3E42',
  capture: {
    photo: '#3B82F6',
    video: '#8B5CF6',
    text: '#22C55E',
    voice: '#EF4444',
    file: '#F59E0B',
    gallery: '#EC4899',
  }
};
```

---

## Database Schema

### Tabella sparks

```sql
CREATE TABLE sparks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id),
  tile_id UUID REFERENCES tiles(id),
  type TEXT NOT NULL, -- 'photo', 'video', 'text', 'audio_recording', 'file', 'image', 'gallery'
  content TEXT,
  storage_path TEXT,
  thumbnail_path TEXT,
  file_name TEXT,
  mime_type TEXT,
  file_size INTEGER,
  duration INTEGER,
  metadata JSONB DEFAULT '{}',
  ai_status TEXT DEFAULT 'pending', -- 'pending', 'processing', 'completed', 'failed'
  embedding vector(1536),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
```

### Tabella tiles

```sql
CREATE TABLE tiles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id),
  title TEXT,
  description TEXT,
  is_event BOOLEAN DEFAULT FALSE,
  start_at TIMESTAMPTZ,
  end_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
```

### Storage Bucket: `sparks`

```
sparks/{user_id}/photos/{filename}.jpg
sparks/{user_id}/videos/{filename}.mp4
sparks/{user_id}/audio/{filename}.m4a
sparks/{user_id}/files/{filename}
```

---

## API Endpoints

### Sparks
- `GET /api/sparks` - Lista con paginazione e filtri (type, tile_id)
- `GET /api/sparks/:id` - Dettaglio spark
- `GET /api/sparks/search?q=...` - Ricerca semantica
- `GET /api/sparks/stats` - Statistiche per tipo
- `POST /api/sparks` - Crea spark (auto-crea tile se mancante)
- `POST /api/sparks/batch` - Crea multipli
- `PATCH /api/sparks/:id` - Aggiorna
- `DELETE /api/sparks/:id` - Elimina (+ file storage)
- `POST /api/sparks/:id/reindex` - Ri-indicizza singolo
- `POST /api/sparks/reindex-all` - Ri-indicizza pending/failed

### Tiles
- `GET /api/tiles` - Lista con sparks count
- `GET /api/tiles/:id` - Dettaglio con sparks
- `POST /api/tiles` - Crea
- `PATCH /api/tiles/:id` - Aggiorna
- `DELETE /api/tiles/:id` - Elimina (+ sparks + files)

### Calendar
- `GET /api/calendar/events` - Eventi schedulati
- `POST /api/calendar/create-event` - Crea tile evento + spark testo atomicamente
- `PATCH /api/calendar/reschedule/:id` - Rischedula

### Other
- `POST /api/chat` - AI chat
- `POST /api/upload/file` - Upload singolo
- `POST /api/upload/files` - Upload multiplo

---

## Pattern e Convenzioni

### Naming Conventions

| Tipo | Convenzione | Esempio |
|------|-------------|---------|
| Componenti | PascalCase | `SparkViewer.tsx` |
| Hooks | camelCase con "use" | `useVoiceRecorder.ts` |
| Store | camelCase con "Store" | `bufferStore.ts` |
| Tipi/Interface | PascalCase | `Spark`, `SparkType` |
| Costanti | UPPER_SNAKE o camelCase | `colors`, `API_URL` |

### Note Importanti

1. **Entita**: Spark (non Memo) - contenuto catturato. Tile - contenitore
2. **Chat AI**: non è uno Spark — è un layer di interazione. I risultati AI diventano Spark solo se l'utente lo sceglie esplicitamente
3. **NativeWind**: Usare `className` per Tailwind nel mobile
4. **Supabase RLS**: Row Level Security attivo, filtro per user_id
5. **TypeScript**: Strict mode, evitare `any`
6. **Icone**: `lucide-react-native` (mobile), `lucide-react` (web)
7. **Storage bucket**: `sparks` (non `memos`)

---

*Ultimo aggiornamento: Marzo 2026*
