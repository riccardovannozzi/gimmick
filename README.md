# MOCA - Memorize, Organize, Communicate, Analyze

App mobile per cattura rapida di informazioni multi-formato (foto, testo, voce, file, galleria).

## Architettura

```
MOCA/
├── mobile/          # Frontend React Native (Expo)
├── backend/         # Backend Node.js (Express)
└── README.md
```

## Stack Tecnologico

### Mobile (Frontend)
- React Native + Expo SDK 54
- TypeScript
- Expo Router (navigation)
- Zustand (state management)
- NativeWind (Tailwind CSS)
- TanStack Query

### Backend
- Node.js + Express
- TypeScript
- Supabase (Auth, Database, Storage)
- Zod (validation)

## Setup

### 1. Clona il repository
```bash
git clone https://github.com/your-username/MOCA.git
cd MOCA
```

### 2. Configura Supabase
1. Crea un progetto su [supabase.com](https://supabase.com)
2. Esegui lo schema SQL nel database:

```sql
CREATE TABLE memos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  type TEXT NOT NULL CHECK (type IN ('photo', 'image', 'audio_recording', 'audio_file', 'text', 'file')),
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

ALTER TABLE memos ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can CRUD own memos"
  ON memos FOR ALL
  USING (auth.uid() = user_id);
```

3. Crea un bucket Storage chiamato `memos`

### 3. Configura Backend
```bash
cd backend
cp ../.env.example .env
# Modifica .env con le tue credenziali Supabase
npm install
npm run dev
```

Il backend sara disponibile su `http://localhost:3000`

### 4. Configura Mobile
```bash
cd mobile
cp ../.env.example .env
# Modifica .env (EXPO_PUBLIC_API_URL=http://localhost:3000)
npm install
npm start
```

Scansiona il QR code con Expo Go (Android) o Camera (iOS).

## API Endpoints

| Endpoint | Method | Descrizione |
|----------|--------|-------------|
| `/api/auth/signup` | POST | Registrazione |
| `/api/auth/signin` | POST | Login |
| `/api/auth/signout` | POST | Logout |
| `/api/auth/refresh` | POST | Refresh token |
| `/api/auth/me` | GET | Utente corrente |
| `/api/memos` | GET | Lista memos |
| `/api/memos/:id` | GET | Singolo memo |
| `/api/memos` | POST | Crea memo |
| `/api/memos/batch` | POST | Crea multipli |
| `/api/memos/:id` | PATCH | Aggiorna |
| `/api/memos/:id` | DELETE | Elimina |
| `/api/upload/file` | POST | Upload file |
| `/api/upload/files` | POST | Upload multipli |

## Sviluppo

### Backend
```bash
cd backend
npm run dev      # Development con hot reload
npm run build    # Build per produzione
npm start        # Avvia build di produzione
```

### Mobile
```bash
cd mobile
npm start        # Avvia Expo
npm run android  # Avvia su Android
npm run ios      # Avvia su iOS
npm run web      # Avvia versione web
```

## Licenza

MIT
