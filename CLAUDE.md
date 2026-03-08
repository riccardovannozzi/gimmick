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
  |
  +-- SPARKS (contenuti catturati dall'utente)
  |     +-- foto, testo, gallery
  |     +-- audio, video, file
  |
  +-- METADATI (campi strutturati del Tile)
  |     +-- title, description
  |     +-- is_event, start_at, end_at
  |
  +-- TAGS (etichette AI con grafo co-occorrenza)
  |     +-- name, slug, color, aliases
  |     +-- usage_count, is_root
  |     +-- relazioni pesate tra tag
  |
  +-- SERVIZI AI (layer di interazione)
        +-- chat (conversazione contestuale con tool use)
        +-- tags + summary (generati dagli Spark)
        +-- embedding (vettore semantico)
        +-- date extraction (confidence scoring)
```

### Regola fondamentale

| Layer | Creato da | Persistente? | Vive in |
|-------|-----------|-------------|---------|
| Spark | utente | si | tabella `sparks` |
| Metadati | utente o AI | si | tabella `tiles` |
| Tag | AI (indexing) | si | tabella `tags` + `tile_tags` |
| Servizi AI | interazione | no | stateless / sessione |

- **Sparks**: contenuti catturati dall'utente. Sono atomici e appartengono a un Tile
- **Metadati**: campi strutturati del Tile (title, description, date). Possono essere inseriti dall'utente o estratti dall'AI dagli Spark
- **Tags**: etichette generate dall'AI con grafo di co-occorrenza. Ogni utente ha un tag root "GIMMICK"
- **Servizi AI**: layer di interazione sopra il Tile. La chat AI non e uno Spark — e un'interfaccia

### Schema interno (riferimento rapido)

```
TILE (contenitore)
+-- title, description, is_event
+-- start_at, end_at          (scheduling/eventi)
+-- SPARKS (contenuti)
|   +-- photo, image, video
|   +-- audio_recording, text, file
|   +-- metadata (tags, summary, ai_description, transcript, pending_event)
+-- TAGS (etichette)
|   +-- tile_tags (junction many-to-many)
|   +-- tag_relations (grafo co-occorrenza pesato)
+-- SERVIZI AI
    +-- Chat (Claude Haiku con tool use)
    +-- Tags + Summary (Claude Haiku)
    +-- Embedding (OpenAI text-embedding-3-small)
    +-- Date extraction (Claude Haiku, confidence scoring)
    +-- Vision analysis (Claude per immagini/video)
    +-- Transcription (OpenAI Whisper, italiano)
    +-- TTS (OpenAI text-to-speech)
```

### Entita principali

- **Tile**: Contenitore logico. Puo essere un evento (is_event + start_at/end_at) o un semplice raggruppamento
- **Spark**: Singolo contenuto catturato (foto, video, audio, testo, file, gallery). Appartiene a un Tile
- **Tag**: Etichetta con slug, color, aliases, usage_count. Grafo di co-occorrenza con relazioni pesate

### AI Indexing Pipeline

Quando un nuovo Spark viene creato:
1. Analisi contenuto per tipo (text diretto, audio via Whisper, immagini/video via Claude vision, file via mammoth/pdf-parse)
2. AI genera tags + summary (Claude Haiku, fino a 12 tag in base alla lunghezza)
3. AI genera embedding vettoriale (OpenAI text-embedding-3-small)
4. Per sparks di tipo text/audio: AI estrae date con confidence scoring
   - Confidence >= 0.8: auto-salva start_at/end_at sul tile
   - Confidence 0.3-0.8: salva come `pending_event` nei metadata dello spark
5. Auto-generazione metadati tile (title + description) quando tutti gli spark sono indicizzati
6. Aggiornamento grafo tag (co-occorrenza)

---

## Stack Tecnico

### Frontend (Next.js - Dashboard Web)
| Tecnologia | Versione | Uso |
|------------|----------|-----|
| Next.js | 15.5 | App Router, SSR |
| React | 19.2 | UI |
| TypeScript | 5.x | Type safety |
| Tailwind CSS | 4 | Styling |
| React Query | 5.x | Data fetching |
| Zustand | 5.x | State management |
| FullCalendar | 6.1 | Calendario eventi |
| D3.js | 7.9 | Grafo relazioni |
| shadcn/ui (Radix) | - | Componenti UI |
| react-dropzone | 14.x | Upload file |
| sonner | 2.x | Toast notifications |

### Mobile (Expo/React Native)
| Tecnologia | Versione | Uso |
|------------|----------|-----|
| Expo | SDK 54 | Framework, build, deploy |
| React Native | 0.81 | UI mobile |
| React | 19.1 | UI |
| TypeScript | 5.9 | Type safety |
| Zustand | 5.x | State management |
| NativeWind | 4.x | Styling (Tailwind) |
| Expo Router | 6.x | Navigation (file-based) |
| React Query | 5.x | Data fetching |
| lucide-react-native | 0.562 | Icone |

### Backend (Express.js)
| Tecnologia | Uso |
|------------|-----|
| Express.js | API REST (porta 5000) |
| TypeScript | Type safety |
| Supabase | Auth, Storage, Database (pgvector) |
| Claude API (@anthropic-ai/sdk) | AI chat, indexing, vision, date extraction |
| OpenAI API | Embeddings, Whisper transcription, TTS |
| Zod | Schema validation |
| mammoth | Estrazione testo DOCX |
| pdf-parse | Estrazione testo PDF |
| multer | File upload (50MB limit) |

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
+-- CLAUDE.md              # Questo file
+-- DEVELOP.md             # Roadmap e tracking
+-- frontend/              # Next.js dashboard
|   +-- app/
|   |   +-- (dashboard)/
|   |   |   +-- layout.tsx         # Layout con sidebar + chat panel
|   |   |   +-- page.tsx           # Analytics (home)
|   |   |   +-- sparks/page.tsx    # Lista sparks
|   |   |   +-- tiles/page.tsx     # Lista tiles con tag management
|   |   |   +-- tags/page.tsx      # Gestione tags
|   |   |   +-- calendar/page.tsx  # Calendario eventi
|   |   |   +-- graph/page.tsx     # Grafo relazioni (content + tags)
|   |   |   +-- capture/page.tsx   # Cattura contenuti (6 pulsanti)
|   |   |   +-- settings/page.tsx  # Impostazioni
|   |   +-- (auth)/
|   |   |   +-- login/page.tsx
|   |   |   +-- register/page.tsx
|   |   +-- layout.tsx             # Root layout
|   |   +-- providers.tsx          # Client providers
|   +-- components/
|   |   +-- layout/
|   |   |   +-- header.tsx
|   |   |   +-- sidebar.tsx
|   |   +-- chat/chat-panel.tsx
|   |   +-- spark/spark-viewer.tsx
|   |   +-- tags/tag-manager-modal.tsx
|   |   +-- ui/                    # shadcn/ui components
|   +-- lib/
|   |   +-- api.ts                 # sparksApi, tilesApi, tagsApi, calendarApi, chatApi, uploadApi
|   |   +-- spark-utils.ts         # typeColors, typeLabels, formatDuration, formatFileSize
|   |   +-- utils.ts               # cn() utility
|   +-- store/
|   |   +-- auth-store.ts          # useAuthStore
|   |   +-- filter-store.ts        # useFilterStore (AI chat filters)
|   +-- types/index.ts
+-- backend/
|   +-- src/
|   |   +-- index.ts               # Entry point (Express + routes)
|   |   +-- config/supabase.ts     # supabaseAdmin, supabaseAuth, createUserClient
|   |   +-- middleware/
|   |   |   +-- auth.ts            # authenticate, optionalAuth
|   |   |   +-- errorHandler.ts    # HttpError classes + handler
|   |   |   +-- notFoundHandler.ts
|   |   |   +-- validate.ts        # Zod validation middleware
|   |   +-- routes/
|   |   |   +-- auth.ts            # signup, signin, refresh, signout, me
|   |   |   +-- sparks.ts          # CRUD + search + stats + reindex
|   |   |   +-- tiles.ts           # CRUD + graph endpoint
|   |   |   +-- tags.ts            # CRUD + tile association + graph + relations
|   |   |   +-- calendar.ts        # Events + scheduling + AI filter
|   |   |   +-- chat.ts            # Text chat + voice + TTS
|   |   |   +-- upload.ts          # File upload/delete + signed URLs
|   |   +-- services/
|   |   |   +-- ai.ts              # AI chat con tool use (8 tools)
|   |   |   +-- indexing.ts        # AI indexing pipeline (processNewSpark)
|   |   |   +-- tagGraph.ts        # Tag co-occurrence graph management
|   |   +-- scripts/
|   |   |   +-- reindex-all.ts
|   |   |   +-- fix-orphan-sparks.ts
|   |   |   +-- migrate-calendar.ts
|   |   +-- types/index.ts
+-- mobile/
    +-- app/
    |   +-- _layout.tsx            # Root stack navigator
    |   +-- (tabs)/
    |   |   +-- _layout.tsx        # TopNav con 3 tab
    |   |   +-- index.tsx          # Home (cattura + buffer + AI chat)
    |   |   +-- history.tsx        # Tiles history
    |   |   +-- settings.tsx       # Impostazioni
    |   +-- auth/login.tsx
    |   +-- capture/               # photo, video, text, voice, file, gallery
    |   +-- edit/                  # image, audio, text
    +-- components/
    |   +-- capture/               # CaptureButton, BufferBar, PreviewOverlay
    |   +-- chat/ChatInput.tsx
    |   +-- layout/SafeAreaWrapper.tsx
    |   +-- ui/                    # Button, IconButton, Modal, ConfirmModal, Toast, SvgIcon
    +-- store/
    |   +-- authStore.ts           # Auth con AsyncStorage persistence
    |   +-- bufferStore.ts         # Buffer items (in-memory)
    |   +-- settingsStore.ts       # Settings con AsyncStorage persistence
    |   +-- toastStore.ts          # Toast notifications
    +-- hooks/
    |   +-- useVoiceRecorder.ts    # expo-av audio recording
    +-- lib/
    |   +-- api.ts                 # Backend API client con auto-refresh
    |   +-- storage.ts             # Supabase storage (bucket: sparks)
    |   +-- compression.ts         # Image compression + thumbnails
    |   +-- supabase.ts            # Supabase client
    |   +-- theme.tsx              # ThemeProvider, useThemeColors
    +-- constants/
    |   +-- colors.ts              # captureColors, darkTheme, lightTheme
    |   +-- config.ts              # App config (media limits, UI sizes)
    +-- utils/formatters.ts        # formatFileSize, formatDuration, formatDate
    +-- types/index.ts
```

---

## Design System

### Palette Colori Mobile (Phantom-inspired)

```typescript
// Dark theme (default)
const darkTheme = {
  background1: '#0C0C0E',     // Deepest background
  background2: '#1C1C1E',     // Cards, containers
  background3: '#2C2C2E',     // Elevated, hover
  surfaceVariant: '#232326',   // Action buttons
  primary: '#FFFFFF',          // Pure white text
  secondary: '#8E8E93',       // iOS gray
  tertiary: '#636366',        // Muted gray
  accent: '#AB9FF2',          // Phantom purple
  border: 'rgba(255,255,255,0.08)',
};

// Capture button colors (shared mobile + web)
const captureColors = {
  photo: '#5B8DEF',    // blue
  video: '#E87DA0',    // pink
  gallery: '#AB9FF2',  // purple
  text: '#6FCF97',     // green
  voice: '#EF4444',    // red
  file: '#F2C94C',     // warm yellow
};

const captureColorsBg = {
  photo: '#1A2540',    // dark blue tint
  video: '#2D1A22',    // dark pink tint
  gallery: '#241E35',  // dark purple tint
  text: '#1A2D1E',     // dark green tint
  voice: '#2D1A1A',    // dark red tint
  file: '#2D2A1A',     // dark yellow tint
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
  type TEXT NOT NULL, -- 'photo', 'video', 'text', 'audio_recording', 'file', 'image'
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

### Tabella tags

```sql
CREATE TABLE tags (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id),
  name TEXT NOT NULL,
  slug TEXT,
  color TEXT,
  aliases TEXT[],
  usage_count INTEGER DEFAULT 0,
  is_root BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
```

### Tabella tile_tags (junction)

```sql
CREATE TABLE tile_tags (
  tag_id UUID REFERENCES tags(id) ON DELETE CASCADE,
  tile_id UUID REFERENCES tiles(id) ON DELETE CASCADE,
  PRIMARY KEY (tag_id, tile_id)
);
```

### Tabella tag_relations (grafo co-occorrenza)

```sql
CREATE TABLE tag_relations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tag_from UUID REFERENCES tags(id) ON DELETE CASCADE,
  tag_to UUID REFERENCES tags(id) ON DELETE CASCADE,
  weight INTEGER DEFAULT 0,
  relation_type TEXT,
  UNIQUE(tag_from, tag_to)
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

### Auth (`/api/auth`)
- `POST /signup` - Registrazione (crea tag root GIMMICK)
- `POST /signin` - Login
- `POST /refresh` - Refresh token
- `POST /signout` - Logout
- `GET /me` - User corrente

### Sparks (`/api/sparks`)
- `GET /` - Lista con paginazione e filtri (type, tile_id). Limit max 100
- `GET /stats` - Conteggi per tipo, spazio totale, conteggi giornalieri
- `GET /search?q=...` - Ricerca semantica (embedding)
- `GET /:id` - Dettaglio spark
- `POST /` - Crea spark (auto-crea tile se mancante)
- `POST /batch` - Crea multipli (auto-crea tile)
- `PATCH /:id` - Aggiorna
- `DELETE /:id` - Elimina (+ file storage)
- `POST /:id/reindex` - Ri-indicizza singolo
- `POST /reindex-all` - Ri-indicizza pending/failed

### Tiles (`/api/tiles`)
- `GET /` - Lista con spark count e tags associati
- `GET /graph` - Dati per grafo (tiles + sparks + tags)
- `GET /:id` - Dettaglio con sparks
- `POST /` - Crea (auto-tag GIMMICK)
- `PATCH /:id` - Aggiorna
- `DELETE /:id` - Elimina cascata (sparks + files)

### Tags (`/api/tags`)
- `GET /` - Lista tags utente
- `POST /` - Crea tag (auto-link a GIMMICK root)
- `GET /graph` - Grafo co-occorrenza (nodes + edges)
- `PATCH /relations` - Modifica peso relazione
- `PATCH /:id` - Aggiorna tag
- `DELETE /:id` - Elimina (riassegna orfani a GIMMICK)
- `POST /:id/tiles` - Associa tag a tiles (bulk)
- `DELETE /:id/tiles/:tileId` - Rimuovi tag da tile
- `GET /:id/tiles` - Tiles di un tag
- `GET /:id/related` - Tags correlati per co-occorrenza

### Calendar (`/api/calendar`)
- `GET /events` - Eventi in range (start, end, tag_id opzionale)
- `POST /schedule` - Schedula tile come evento (auto-detect date con AI)
- `POST /create-event` - Crea tile + schedula in un'operazione
- `PATCH /events/:id/reschedule` - Sposta evento (drag-and-drop)
- `PATCH /events/:id` - Aggiorna dettagli evento
- `DELETE /events/:id/unschedule` - Rimuovi da calendario (non elimina tile)
- `POST /ai-filter` - Filtra eventi con query AI in linguaggio naturale

### Chat (`/api/chat`)
- `POST /` - Chat testuale con Claude (tool use loop)
- `POST /voice` - Messaggio vocale (Whisper + Claude)
- `POST /tts` - Text-to-speech (OpenAI)

### Upload (`/api/upload`)
- `POST /file` - Upload singolo (50MB limit)
- `POST /files` - Upload multiplo (max 10 file)
- `DELETE /file` - Elimina file da storage
- `GET /signed-url` - URL firmato (1h expiry)

### AI Chat Tools (disponibili a Claude durante la chat)
1. `search_sparks` - Cerca per tipo, query, date range
2. `count_sparks` - Conta sparks con filtri
3. `list_recent_sparks` - Sparks recenti
4. `get_spark` - Dettaglio spark per ID
5. `delete_spark` - Elimina spark
6. `list_tiles` - Lista tiles con spark count
7. `get_tile_sparks` - Sparks di un tile
8. `semantic_search` - Ricerca per significato (embedding)

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
2. **Chat AI**: non e uno Spark — e un layer di interazione
3. **Tag root**: Ogni utente ha un tag "GIMMICK" (is_root=true) creato al signup
4. **NativeWind**: Usare `className` per Tailwind nel mobile
5. **Supabase RLS**: Row Level Security attivo, filtro per user_id
6. **TypeScript**: Strict mode, evitare `any`
7. **Icone**: `lucide-react-native` (mobile), `lucide-react` (web)
8. **Storage bucket**: `sparks`
9. **Indexing concurrency**: Max 3 job paralleli (limiter in indexing.ts)
10. **Limit API**: Max 100 per pagina su sparks e tiles. Non usare limit > 100

---

## Comandi Utili

```bash
# Frontend
cd frontend && npm run dev          # Next.js su porta 3000

# Backend
cd backend && npm run dev           # Express su porta 5000

# Mobile
cd mobile && npx expo start         # Expo su porta 8081

# Scripts backend
npx tsx src/scripts/reindex-all.ts          # Reindicizza pending/failed
npx tsx src/scripts/reindex-all.ts --all    # Reindicizza tutti
npx tsx src/scripts/fix-orphan-sparks.ts    # Fix sparks senza tile
npx tsx src/scripts/migrate-calendar.ts     # Migra campi calendario

# Build mobile
eas build --platform android --profile preview
eas build --platform android --profile production
```

---

*Ultimo aggiornamento: Marzo 2026*
