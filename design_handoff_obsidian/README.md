# Handoff: Gimmick · Obsidian Design System

## Come usare questo pacchetto con Claude Code (VS Code)

Questa cartella è pensata per essere **copiata dentro il tuo repository** (es. in `docs/design/` o nella root) e usata come **fonte di verità** da Claude Code mentre implementi l'interfaccia.

Flusso consigliato (il più semplice ed efficace):

1. Copia l'intera cartella `design_handoff_obsidian/` nel repo.
2. Apri il repo in VS Code con il plugin Claude Code.
3. Dai a Claude Code i prompt nell'ordine indicato in **`PROMPTS.md`** — uno alla volta, verificando l'output prima di passare al successivo.
4. Claude Code legge i file `.dc.html` come riferimento visivo e `TOKENS.md` come specifica esatta di colori/tipografia/spaziature.

> ⚠️ I file `.dc.html` sono **prototipi di design in HTML**, non codice di produzione da copiare. Il compito è **ricreare questi design nell'ambiente del tuo repo** (Next.js, secondo `CLAUDE.md`) usando i suoi pattern e librerie. Per aprirli e vederli: apri un `.dc.html` in un browser (serve `support.js`, incluso).

## Overview

Gimmick è un'app di **cattura rapida multi-formato** (foto, video, voce, testo, galleria, file) con elaborazione AI, organizzazione in *tile*, *flussi* e viste calendario/canvas/kanban. Questo handoff documenta il restyling completo da estetica "Pixel Arcade" a estetica **Obsidian**: calma, ad alta densità, neutri profondi, un solo accento viola, tipografia Geist.

## Fidelity

**Alta fedeltà (hifi).** Colori, tipografia, spaziature e interazioni sono definitivi. Ricrea l'UI in modo fedele usando le librerie/pattern del repo. I token in `TOKENS.md` sono esatti (hex verificati).

## Principi del sistema

- **Un solo accento**: Phantom Violet (`#7C5CCB` light / `#AB9FF2` dark). Nessun'altra direzione (la vecchia "Graphite Ice" cyan è stata rimossa). Il cyan resta solo come colore-identità del beniamino *Bito*, mai come accento di tema.
- **Light + Dark** sono entrambi di prima classe. Ogni componente legge i token dal tema attivo.
- **Tipografia**: `Geist` per l'UI, `Geist Mono` per date, conteggi, etichette tecniche, eyebrow.
- **Densità alta, decorazione bassa**: hairline da 1px, niente ombre dure, raggi morbidi (8–14px), niente gradienti/scanline.
- **Scala colori-tipo unica** (foto/video/voce/testo/file/gallery): vedi `TOKENS.md`. Usata in modo identico su desktop e mobile.
- **Colore tile**: ogni tile può essere *Tinta* (sfondo del colore a bassa opacità + bordo colorato) o *Pieno*. È un'impostazione globale (tweak).
- **Beniamini**: 10 mascotte SVG con coppie di colori fisse (identità) — vedi `Mascot.dc.html`. Non vanno ricolorate.

## Architettura suggerita (per Next.js)

```
lib/theme/obsidian.ts        ← token unici (vedi TOKENS.md) → CSS variables, switch data-theme
components/primitives/        ← Button, IconButton, Chip, Card, Field, Select, Toggle,
                                SegmentedControl, Avatar, Sheet/Modal, Toast, Skeleton,
                                ListRow, TableRow
components/mascot/            ← <Beniamino name size/> + i 10 SVG
components/shell/             ← Desktop: Header, Sidebar, Inspector, ViewContainer
                                Mobile: StatusBar, TopNav, NavPill, Drawer
app/(views)/...              ← le schermate (vedi sezione Screens)
```

Strategia di migrazione **strangler**: introdurre tema + primitive accanto al vecchio `pixel-theme.ts`/`pixel-components.tsx`, sostituire schermata per schermata, eliminare l'arcade (CRT/scanline/pixel) per ultimo.

## Screens / Views

I file DC sono la spec viva di ogni schermata. Mappa rapida:

**Desktop**
- `GimmickObsidian.dc.html` — showcase del sistema: token, scala tipo, componenti, beniamini, riga di cattura. **Partire da qui.**
- `GimmickApp.dc.html` — app composita: Header + Sidebar (tag/cartelle) + Chrono al centro + Inspector. È il layout-guida desktop.
- `GimmickHeader.dc.html` · `GimmickSidebar.dc.html` · `GimmickInspector.dc.html` — i tre pezzi dello shell, isolati (con stati light/dark affiancati).
- `GimmickTable.dc.html` — vista Tiles come tabella "Quiet rows".
- `GimmickBuffer.dc.html` — vista **Sparks**: elenco filtrabile (Nome · Tipo · Data · Dim. · AI · Azioni) con chip-filtro per tipo e ordinamento per colonna.
- `GimmickCanvas.dc.html` · `GimmickKanban.dc.html` · `GimmickKanbanDates.dc.html` · `GimmickChrono.dc.html` · `GimmickPanopticon.dc.html` — le viste board/calendario/grafo.
- `GimmickFlows.dc.html` — vista Flussi (board per stato).
- `GimmickSettings.dc.html` — impostazioni desktop (Aspetto/Interfaccia/Beniamino/Dati).
- `GimmickAsk.dc.html` — assistente "Ask Gimmick" (chat).
- `GimmickModals.dc.html` — modali Icona + Colore (palette Airtable a 40 swatch).
- `GimmickTileColor.dc.html` · `GimmickSparkButtons.dc.html` — esplorazioni di dettaglio (colore tile, pulsanti spark).

**Mobile (Android, Material status bar)**
- `GimmickMobileCapture.dc.html` — home di cattura: 6 barre + "Invia a Gimmick" + "Set options" + drawer + voice.
- `GimmickCaptureFlows.dc.html` — flussi interni di cattura: Foto, Video, Voce, Testo, Galleria, File, e schermata "Salva spark".
- `GimmickMobileViews.dc.html` — Tiles, Flows, Chrono, Settings mobile (Light + Dark).
- `GimmickMobileSparks.dc.html` · `GimmickMobileBuffer.dc.html` — elenco Sparks e triage/buffer mobile.
- `GimmickMobileTile.dc.html` — dettaglio tile mobile.
- `GimmickMobileAsk.dc.html` — Ask Gimmick mobile.
- `GimmickMobileAuth.dc.html` — login / onboarding / prima cattura.

**Trasversali**
- `GimmickStates.dc.html` — stati di servizio: empty, loading skeleton, offline/error, toast (success/undo/AI/error), centro notifiche.

## Interazioni & comportamento

Le interazioni precise (hover, segmented control, drawer, filtri, ordinamento, registrazione voce/video, stati toast) sono mostrate nei rispettivi DC. Convenzioni globali:
- Hover su righe/celle: sfondo a bassissima opacità (`rgba` neutro ~0.02–0.03).
- Stato attivo nav/tab: pill con `accent-soft` di sfondo e testo/icona `accent`.
- Hit target mobile ≥ 44px.
- Transizioni brevi (120–180ms, ease-out). Niente animazioni decorative.

## Design Tokens

Tutti i valori esatti sono in **`TOKENS.md`**. È l'unico file da considerare autorevole per colori/tipografia/spaziatura/raggi.

## Assets

- **Font**: Geist + Geist Mono (Google Fonts). Caricare via `next/font` o `<link>`.
- **Icone**: set di glyph SVG inline disegnati a mano nei DC (stroke 1.5–2, viewBox 16). Sostituibili con la icon-library del repo mantenendo peso/dimensione coerenti.
- **Beniamini**: 10 mascotte SVG in `Mascot.dc.html` (coppie colore fisse).
- **Palette colore tile**: 40 swatch in stile Airtable, definiti in `GimmickModals.dc.html`.

## Files in questo pacchetto

- `README.md` — questo file.
- `TOKENS.md` — token esatti (colori, tipografia, spaziatura, raggi, colore tile).
- `PROMPTS.md` — sequenza di prompt pronti per Claude Code.
- `*.dc.html` — i prototipi di design (riferimento visivo).
- `support.js` — runtime per aprire i `.dc.html` in un browser.
