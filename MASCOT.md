# Gimmick · Mascot pack

This file documents the 10 official mascots ("beniamini") of Gimmick. Each
character has a fixed identity (sprite + name + role) and a fixed contextual
appearance inside the product (which screen / state surfaces it). Use the
embedded sprite data to render them at any size; use the contextual cards
to wire them into the right Settings / empty-state / dialog hooks.

---

## How a mascot is defined

```ts
type Mascot = {
  id: string;            // stable key (e.g. "gimmick", "surfer", "tilo")
  name: string;          // display name
  role: string;          // one-line role (caps), e.g. "THE MASCOT"
  description: string;   // 1-2 sentence story for tooltips/onboarding
  sprite: string[];      // 16x16 grid of single chars (see legend below)
  paletteHints: {        // which theme tokens drive the sprite colors
    primary: string;     //   token name from PixelTheme (see pixel-theme.ts)
    secondary: string;
  };
  animation: 'pulse' | 'bob' | 'wobble' | 'none';
  stats: { label: string; val: 1..10; colorToken: string }[];
  context: {             // where this mascot lives inside the app
    where: string;       //   surface label (caps), e.g. "FLOW HUB"
    msg: string;         //   sample dialog line
    surface: string;     //   route/state hook (see "Surfaces" below)
  };
};
```

### Sprite legend (per character)

Every sprite is a 16×16 array of single-char rows. Cell meanings:

| Char | Meaning |
|------|---------|
| `.`  | transparent |
| `1`  | primary color (body) |
| `2`  | secondary (accent / details) |
| `3`  | tertiary (highlights) — usually `theme.accent` |
| `4`  | ink (eyes, outline) — usually `theme.ink` |
| `5`  | white (eye whites / highlights) |

### Animations

- `pulse` — vertical bob 1–3px every 0.8s, 4 steps (energetic)
- `bob` — gentle ease-in-out 2–4px every 1.4s (floaty)
- `wobble` — rotate -1° / +2° every 2s (sleepy / chill)
- `none` — static

### Surfaces

Hook names map to product locations the engineer can subscribe to. Each
mascot is rendered by passing it to `<Mascot id="…" size={…} />` and the
host decides position/scale.

| Hook | Route / state |
|------|---------------|
| `splash`         | app launch screen, first 1.2s |
| `onboarding`     | first-run flow |
| `flow-hub`       | `/flows` |
| `tiles-archive`  | `/history` |
| `chrono-reminder`| Chrono notification popups |
| `buffer-full`    | when the buffer has > 5 items |
| `ai-chat`        | chat assistant panel |
| `focus-mode`     | focus-block screen |
| `good-morning`   | first session of the day |
| `photo-capture`  | `/capture/photo` |
| `motion-transition` | global tween wrapper (low-priority easter egg) |

---

## Roster

### 1 · Gimmick — THE MASCOT
**Identity**: il beniamino ufficiale del brand. Piccolo robot dalle antenne
sempre attive, dice "bip" quando lo tocchi.
**Surface**: splash · app icon · empty-state generale.

```
................
.....1...1......
.....11.11......
......111.......
...11111111.....
..1111111111....
..1144111441....
..1144111441....
..1111111111....
..1144444411....
..1111111111....
...11111111.....
....11..11......
....11..11......
....11..11......
...111..111.....
```

- **primary**: `theme.accent`
- **secondary**: `theme.ink`
- **animation**: `pulse`
- **stats**: BRAND 10 · SOUL 10 · CHARM 10
- **dialog**: `BIP. Sono qui. Premi su di me ogni volta che hai un'idea da catturare.`

---

### 2 · Surfer — THE RIDER
**Identity**: cavalca i Flow di Gimmick. Ogni volta che un'azione passa da un
nodo al successivo, lui ci scivola sopra. Sempre in equilibrio.
**Surface**: `flow-hub` · transition feedback dentro un Flow.

```
................
..........33....
.........3333...
.........1441...
.........11.1...
........11111...
1......1111111..
.1....111111....
..1..1111.......
...11111........
...11..11.......
...11..11.......
..11....11......
.222222222222...
..2255555522....
3..22222222...3.
```

- **primary**: `theme.capture.file.hue`
- **secondary**: `theme.capture.photo.hue`
- **animation**: `bob`
- **stats**: SPEED 9 · ENERGY 10 · CALM 3
- **dialog**: `Onda in arrivo: 3 nodi pronti per il salto. Sali a bordo, scivoliamo insieme.`

---

### 3 · Tilo — THE ARCHIVIST
**Identity**: fantasmino-archivio. Custodisce idee, foto e note vecchie.
Galleggia leggero come uno spirito.
**Surface**: `tiles-archive` · empty-state della lista Tiles.

```
................
....11111111....
...1111111111...
..111111111111..
.11111111111111.
.11144111144111.
.11154411115411.
.11154411115411.
.11144111144111.
.11111111111111.
.11111111111111.
.11111111111111.
.11111111111111.
.11111111111111.
.111.1111.1111..
.11...11...11...
```

- **primary**: `theme.capture.photo.hue`
- **secondary**: `theme.capture.gallery.hue`
- **animation**: `bob`
- **stats**: MEMORY 10 · FOCUS 8 · SPEED 4
- **dialog**: `Ho ritrovato 3 spark sepolti. Vuoi rivederli?`

---

### 4 · Kron — THE TIMEKEEPER
**Identity**: il guardiano del Chrono. Scandisce i giorni, ricorda le
scadenze, segnala quando un evento si avvicina.
**Surface**: `chrono-reminder` · Chrono notifications.

```
......1111......
.....111111.....
....11111111....
...1144444411...
..114111111411..
..114144114411..
..114155115411..
..114111111411..
..114111111411..
..114144444411..
...1144444411...
....11111111....
....11.11.11....
....11.11.11....
...22..22..22...
...22..22..22...
```

- **primary**: `theme.ink`
- **secondary**: `theme.capture.file.hue`
- **animation**: `none`
- **stats**: TIME 10 · ORDER 9 · SPEED 5
- **dialog**: `Tra 15 minuti: 'Call Marco — Teleport flow'. Vuoi che apra la tile?`

---

### 5 · Buffy — THE CARRIER
**Identity**: il portatore del buffer. Tiene tra le sue braccine tutto quello
che cattura prima di archiviarlo. Sgranchisce i muscoli quando il buffer è
pieno.
**Surface**: `buffer-full` · Home buffer panel quando ha > 5 spark.

```
................
.....111111.....
....11111111....
...1144114411...
...1155115511...
..111441144111..
..111111111111..
.22111111111122.
.22111111111122.
..111111111111..
..111133331111..
...1111111111...
....11....11....
....11....11....
....22....22....
................
```

- **primary**: `theme.capture.text.hue`
- **secondary**: `theme.capture.file.hue`
- **animation**: `pulse`
- **stats**: GRIP 10 · STAMINA 8 · CHARM 7
- **dialog**: `Ho in braccio 8 spark. Li archiviamo come tile o continuiamo?`

---

### 6 · Bito — THE ASSISTANT
**Identity**: il robot AI. Vive nella chat. Risponde a comandi vocali e
testuali, propone azioni. Pacato, mai invadente.
**Surface**: `ai-chat` · chat panel header e empty-state.

```
.......22.......
.......22.......
......2222......
.1111111111111..
.1111111111111..
.1144111111441..
.1155114411551..
.1155114411551..
.1144111111441..
.1111133331111..
.1111144441111..
.1111111111111..
.1111111111111..
.11.111111.111..
.11.111111.111..
.11.........11..
```

- **primary**: `theme.capture.gallery.hue`
- **secondary**: `theme.capture.video.hue`
- **animation**: `pulse`
- **stats**: BRAIN 10 · PATIENCE 9 · HUMOR 6
- **dialog**: `Ho letto la tua nota. Vuoi che la trasformi in 3 sub-task?`

---

### 7 · Sloth — THE CHILL
**Identity**: compare nel focus mode. Ti ricorda di rallentare, di non
riempire tutti i blocchi di Chrono. Se lo ignori, sbadiglia.
**Surface**: `focus-mode` · empty-state quando il quotidiano è > 80% pieno.

```
..2..........2..
..222......222..
..2222....2222..
..1111111111111.
..111111111111..
.11441111114411.
.11441111114411.
.11331111113311.
.11111441111111.
.11111441111111.
.11111111111111.
.11111111111111.
.11.11111111.11.
.11.11111111.11.
..11..1111..11..
...11......11...
```

- **primary**: `theme.capture.voice.hue`
- **secondary**: `theme.capture.text.hue`
- **animation**: `wobble`
- **stats**: CHILL 10 · WISDOM 8 · SPEED 2
- **dialog**: `Slow down. Tre tile bastano oggi. Vuoi spegnere le notifiche?`

---

### 8 · Flocky — THE EARLY BIRD
**Identity**: il pollo mattutino. Annuncia l'inizio della giornata, propone
una pianificazione veloce.
**Surface**: `good-morning` · prima sessione del giorno.

```
......22........
.....22.22......
....2.22........
....111111......
...11144111.....
...111543333....
...11154333.....
...11144111.....
...111111111....
..1111111111....
.11111111111....
.11111111111....
.22111111111....
.22111111111....
..111111111.....
....33.33.......
```

- **primary**: `theme.capture.file.hue`
- **secondary**: `theme.capture.voice.hue`
- **animation**: `bob`
- **stats**: ENERGY 9 · CHARM 8 · CALM 2
- **dialog**: `Buongiorno! Hai 3 eventi e 1 deadline oggi. Iniziamo dal caffè?`

---

### 9 · Snappy — THE SNAPPER
**Identity**: la macchina fotografica del team. Vive nei capture buttons di
tipo PHOTO. Quando scatti, fa "click" e archivia con riflessi.
**Surface**: `photo-capture` · capture/photo screen header.

```
................
...........22...
....1111.1111...
..111111111111..
.11111111111111.
.11144444444111.
.11144555544111.
.11145544444111.
.11144444444111.
.11144444444111.
.11111111111111.
.11111.11111111.
.11111111111111.
..111111111111..
................
................
```

- **primary**: `theme.capture.photo.hue`
- **secondary**: `theme.ink`
- **animation**: `none`
- **stats**: AIM 10 · SPEED 9 · CHARM 6
- **dialog**: `Click! Pronto a inquadrare. Premi e tieni per video.`

---

### 10 · Ballerina — THE DANCER
**Identity**: quando un'azione si compie con grazia, è lei che la coreografa.
Vive nelle transizioni, nei tween, in ogni piccolo movimento che rende l'app
fluida.
**Surface**: `motion-transition` · easter egg in animazioni lunghe / loading.

```
.......22.......
......2222......
.......22.......
......1111......
......1441......
.......11.......
....11111111....
...11.1111.11...
..11..1144..11..
11.....11.....11
....22222222....
...2222222222...
..222222222222..
.22..22..22..22.
.......11.......
.....11..11.....
```

- **primary**: `theme.capture.gallery.hue`
- **secondary**: `theme.accent`
- **animation**: `bob`
- **stats**: GRACE 10 · FLOW 9 · SPEED 7
- **dialog**: `Una pausa elegante? Solo un momento.`

---

## Settings · "Mascot preferences"

Add to the Settings screen, under a new section **MASCOT**:

```
SETTINGS · MASCOT
  Active mascots ........ multi-select [ Gimmick ✓ Surfer ✓ Tilo ✓ … ]
  Frequency ............. segmented   [ Off · Rare · Normal · Often ]
  Animations ............ toggle      ⬤
  Dialog box ............ toggle      ⬤
```

Stored shape:
```ts
type MascotSettings = {
  enabled: Set<MascotId>;    // ids actively allowed to surface
  frequency: 'off' | 'rare' | 'normal' | 'often';
  animations: boolean;
  dialog: boolean;
};
```

Each `context.surface` hook checks `enabled.has(mascotId)` before rendering.
`frequency` is a global rate-limit (no more than N apparizioni / giorno).

## Settings · "In opera nel prodotto"

For each mascot, the Settings screen previews where they appear with a card:

```
┌────────────────────────────────────────┐
│  [sprite 32px]  GIMMICK · THE MASCOT   │
│                 splash · empty-state   │
│                                        │
│  [dialog box preview]                  │
│   > "BIP. Sono qui. Premi su di me…"   │
│                                        │
│  [ View in app ] [ Disable ]           │
└────────────────────────────────────────┘
```

Implement as a `<MascotPreviewCard mascotId="…" />` component that reads
from the same data table above.

---

## Implementation notes

1. **Source of truth** — copy the data above into `lib/mascots.ts` as a
   single typed `MASCOTS: Record<MascotId, Mascot>` constant. The sprite
   arrays are plain JSON-safe data.
2. **Renderer** — `<MascotSprite pattern={...} palette={...} cell={N} />`
   is already implemented in the design exploration. Reuse 1:1.
3. **Theme tokens** — palette colors come from `PixelTheme` (see
   `handoff/frontend/pixel-theme.ts` / `handoff/mobile/pixel-theme.ts`).
   Never hard-code hex.
4. **Persistence** — store `MascotSettings` per-user in Supabase
   `user_settings.mascots` (single jsonb).
5. **Performance** — mascots are tiny grids of `<div>`s. At 16×16 cells
   you have 256 nodes per sprite; bundling 10 of them in a screen is
   trivial.
6. **A/B** — add `meta.released_at` / `meta.experimental: true` if you
   want to ramp characters gradually.

---

## Adding a new mascot

1. Draw a 16×16 sprite using the legend chars (`.`/`1`/`2`/`3`/`4`/`5`).
2. Pick `paletteHints.primary` + `secondary` from theme tokens.
3. Decide the `context.surface` it lives on (or add a new hook if none
   fits).
4. Add it to the `MASCOTS` table.
5. Add a `MascotPreviewCard` to the Settings list automatically — no
   per-mascot UI work required.
