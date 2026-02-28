# DEVELOP.md - Gimmick Development Tracker

> Roadmap, stato implementazioni e note di sviluppo

---

## 📊 Stato Generale

| Fase | Nome | Completamento | Stato |
|------|------|---------------|-------|
| 1 | MVP | 100% | ✅ Completa |
| 2 | Media | ~80% | 🔄 In corso |
| 3 | Chat AI | ~40% | 🔄 In corso |
| 4 | Editor | ~30% | ⚠️ Parziale |
| 5 | Teleport | 0% | ❌ Non iniziata |
| 6 | Polish | 0% | ❌ Non iniziata |

---

## 🗺 ROADMAP DETTAGLIATA

### Fase 1 - MVP ✅ COMPLETA

- [x] Setup progetto Expo + TypeScript
- [x] Configurazione NativeWind (Tailwind)
- [x] Struttura cartelle (app/, components/, store/, etc.)
- [x] Configurazione Supabase client
- [x] Setup backend Express.js
- [x] Autenticazione (login/logout)
- [x] UI Home con 6 bottoni cattura
- [x] Componente CaptureButton
- [x] Componente BufferBar
- [x] Zustand stores (auth, buffer, settings, toast)
- [x] Cattura foto (expo-camera)
- [x] Cattura testo (input)
- [x] Selezione da galleria (expo-image-picker)
- [x] Buffer pre-invio funzionante
- [x] Upload a Supabase Storage
- [x] API routes backend (auth, memos, upload)

**Data completamento**: Gennaio 2026

---

### Fase 2 - Media 🔄 IN CORSO

- [x] Cattura video (max 30 sec)
  - [x] File `capture/video.tsx` creato
  - [ ] Testare limite 30 secondi
  - [ ] Testare risoluzione 720p
  
- [x] Registrazione audio
  - [x] File `capture/voice.tsx` creato
  - [x] Hook `useVoiceRecorder.ts` creato
  - [ ] Testare su device reale
  
- [x] File picker
  - [x] File `capture/file.tsx` creato
  - [ ] Testare vari tipi file (PDF, DOC, etc.)
  
- [ ] Compressione media
  - [x] File `lib/compression.ts` creato
  - [ ] Implementare compressione immagini (max 1920px)
  - [ ] Implementare compressione video (720p, 2-3 Mbps)
  - [ ] Implementare compressione audio (64kbps AAC)
  - [ ] Generazione thumbnail automatica
  
- [ ] Feedback haptic
  - [ ] Aggiungere `expo-haptics`
  - [ ] Vibrazione su cattura
  - [ ] Vibrazione su invio
  - [ ] Vibrazione su errore

**Note**: 
- Verificare che la compressione funzioni prima dell'upload
- Testare su dispositivi Android e iOS

---

### Fase 3 - Chat AI 🔄 IN CORSO

- [x] ChatInput component
  - [x] File `components/chat/ChatInput.tsx` creato
  - [x] Stato Idle (placeholder + microfono)
  - [ ] Stato Typing (testo + freccia invio)
  - [ ] Stato Recording (pulse + stop)
  - [ ] Stato Processing (spinner)
  
- [x] Registrazione vocale per comandi
  - [x] Hook `useVoiceRecorder.ts` funzionante
  - [ ] Integrazione con ChatInput
  
- [ ] Integrazione AI per parsing comandi
  - [ ] Endpoint backend `/api/ai/parse`
  - [ ] Connessione a servizio AI (OpenAI / Claude API)
  - [ ] Parsing intent (calendario, promemoria, ricerca, etc.)
  - [ ] Estrazione entità (date, nomi, luoghi)
  
- [ ] Esecuzione azioni
  - [ ] Crea evento calendario
  - [ ] Crea promemoria
  - [ ] Ricerca memo
  - [ ] Riassumi memo
  - [ ] Trascrivi audio
  - [ ] Preview azione prima di eseguire
  - [ ] Conferma/annulla azione

**Comandi da supportare**:
```
"Memorizza appuntamento con Luca domani ore 18"
"Ricordami di chiamare Mario tra 2 ore"
"Riassumi gli ultimi 3 memo vocali"
"Cerca tutti i memo su progetto X"
"Trascrivi le note vocali di oggi"
```

---

### Fase 4 - Editor ⚠️ PARZIALE

- [ ] Editor immagine
  - [x] File `edit/image.tsx` creato
  - [ ] Ruota (90° orario/antiorario)
  - [ ] Crop (selezione area)
  - [ ] Resize (preset: 1920, 1080, 720)
  - [ ] Filtri base (luminosità, contrasto)
  - [ ] Libreria: `expo-image-manipulator`
  
- [ ] Editor video
  - [ ] Creare file `edit/video.tsx`
  - [ ] Trim (inizio/fine)
  - [ ] Preview con timeline
  - [ ] Libreria: `ffmpeg-kit-react-native` o `expo-av`
  
- [ ] Editor audio
  - [x] File `edit/audio.tsx` creato
  - [ ] Trim (inizio/fine)
  - [ ] Waveform visualization
  - [ ] Libreria: `expo-av`
  
- [ ] OCR su immagini
  - [ ] Endpoint backend `/api/ai/ocr`
  - [ ] Integrazione ML Kit o Tesseract
  - [ ] Mostra testo estratto
  - [ ] Copia/salva testo
  
- [ ] Trascrizione audio
  - [ ] Endpoint backend `/api/ai/transcribe`
  - [ ] Integrazione Whisper API o Google Speech
  - [ ] Mostra trascrizione
  - [ ] Salva come memo testo

---

### Fase 5 - Teleport 🚀 NON INIZIATA

Funzionalità per inviare "tiles" ad altre applicazioni collegate.

- [ ] Architettura Teleport
  - [ ] Definire protocollo comunicazione tra app
  - [ ] Tabella `tiles` nel database
  - [ ] API endpoint `/api/tiles`
  
- [ ] UI Selezione Destinazione
  - [ ] Modal "Dove vuoi inviare?"
  - [ ] Lista app collegate
  - [ ] Selezione target nell'app destinazione
  
- [ ] Integrazione Magicaboola
  - [ ] API per ricevere tiles in Magicaboola
  - [ ] Associare tile a progetto/location/payment
  - [ ] Notifica ricezione tile
  
- [ ] Gestione Stati Tile
  - [ ] Pending (in attesa di invio)
  - [ ] Sent (inviata)
  - [ ] Received (ricevuta dall'app destinazione)
  - [ ] Failed (errore)
  - [ ] Retry automatico su errore
  
- [ ] File `lib/teleport.ts`
  - [ ] `teleportTile(memo, destination)`
  - [ ] `getConnectedApps()`
  - [ ] `getTileStatus(tileId)`

**Schema Tile**:
```typescript
interface Tile {
  id: string;
  memo_id: string;
  destination_app: 'magicaboola' | 'altra_app';
  destination_target?: string;  // ID risorsa destinazione
  status: 'pending' | 'sent' | 'received' | 'failed';
  sent_at?: Date;
  received_at?: Date;
  metadata: Record<string, any>;
}
```

---

### Fase 6 - Polish ❌ NON INIZIATA

- [ ] Offline-first
  - [ ] Setup SQLite locale (`expo-sqlite`)
  - [ ] Schema locale mirror di Supabase
  - [ ] Salvataggio locale immediato
  - [ ] Coda upload pendenti
  - [ ] Indicatore stato sync
  
- [ ] Sync automatico
  - [ ] Detect connessione (`@react-native-community/netinfo`)
  - [ ] Sync quando online
  - [ ] Retry con backoff esponenziale
  - [ ] Conflict resolution
  
- [ ] Widget home screen
  - [ ] Android widget (`react-native-android-widget`)
  - [ ] iOS widget (richiede codice nativo)
  - [ ] Quick capture da widget
  - [ ] Mostra ultimi memo
  
- [ ] Wearable
  - [ ] Apple Watch companion
  - [ ] Wear OS companion
  - [ ] Quick voice memo da watch

---

## 🐛 Bug Noti

| ID | Descrizione | Priorità | Stato |
|----|-------------|----------|-------|
| - | Nessun bug registrato | - | - |

<!--
Formato:
| BUG-001 | Descrizione del bug | 🔴 Alta | 🔄 In fix |
-->

---

## 📝 Note Implementative

### Compressione Media

```typescript
// Configurazione target
const compressionConfig = {
  image: {
    maxWidth: 1920,
    maxHeight: 1920,
    quality: 0.8,
    format: 'jpeg',
  },
  video: {
    maxDuration: 30,      // secondi
    resolution: '720p',
    bitrate: 2500000,     // 2.5 Mbps
  },
  audio: {
    bitrate: 64000,       // 64 kbps
    sampleRate: 22050,
    channels: 1,          // mono
    codec: 'aac',
  },
  thumbnail: {
    maxWidth: 200,
    maxHeight: 200,
    quality: 0.7,
  },
};
```

### ChatInput Stati

```
Idle:       [💬 Chiedi qualcosa...        🎤]
Typing:     [💬 Ricordami di chiamare...  ➤]
Recording:  [🔴 Sto ascoltando...         ⬛]
Processing: [⏳ Elaboro...                  ]
```

### Teleport Flow

```
┌─────────────┐     ┌─────────────┐     ┌─────────────┐
│   Gimmick   │────▶│   Backend   │────▶│ Magicaboola │
│   (mobile)  │     │   (API)     │     │   (web/db)  │
└─────────────┘     └─────────────┘     └─────────────┘
      │                   │                    │
      │ POST /tiles       │ Salva tile         │
      │ {memo, dest}      │ Notifica app       │
      │                   │ destinazione       │
      │                   │                    │
      │◀──────────────────│◀───────────────────│
      │ status: sent      │ status: received   │
```

### Limiti App

| Elemento | Limite |
|----------|--------|
| Dimensione file | 50 MB |
| Elementi buffer | 20 |
| Durata video | 30 secondi |
| Durata audio | 10 minuti |
| Risoluzione max | 4096x4096 px |

---

## 📦 Dipendenze da Aggiungere

### Fase 2
```bash
npx expo install expo-haptics
```

### Fase 4
```bash
npx expo install expo-image-manipulator
# Per video editing valutare ffmpeg-kit
```

### Fase 6
```bash
npx expo install expo-sqlite
npm install @react-native-community/netinfo
```

---

## 🔄 Changelog

### v0.1.0 (Gennaio 2026)
- ✅ Setup iniziale progetto
- ✅ MVP completo
- ✅ 6 tipi cattura funzionanti
- ✅ Buffer e upload Supabase
- ✅ Autenticazione

### v0.2.0 (In sviluppo)
- 🔄 ChatInput component
- 🔄 Editor base
- ⏳ Compressione media
- ⏳ Feedback haptic

### v0.3.0 (Pianificato)
- ⏳ Teleport tiles
- ⏳ Integrazione Magicaboola

---

## 🎯 Prossimi Obiettivi (Sprint corrente)

1. [ ] Verificare compressione immagini funzionante
2. [ ] Aggiungere feedback haptic
3. [ ] Completare stati ChatInput
4. [ ] Test su device Android reale
5. [ ] Generare primo APK preview

---

## 🔗 App Collegate (Teleport)

| App | Descrizione | API Endpoint | Stato |
|-----|-------------|--------------|-------|
| Magicaboola | Gestione pagamenti | `/api/external/tiles` | ⏳ Da creare |

---

## 📞 Risorse

- **Expo Docs**: https://docs.expo.dev
- **Supabase Docs**: https://supabase.com/docs
- **NativeWind**: https://www.nativewind.dev
- **Zustand**: https://zustand-demo.pmnd.rs
- **Lucide Icons**: https://lucide.dev

---

*Ultimo aggiornamento: Gennaio 2026*
