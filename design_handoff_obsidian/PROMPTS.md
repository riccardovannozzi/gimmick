# Prompt per Claude Code — in ordine

Incolla questi prompt **uno alla volta** in Claude Code (VS Code), verificando l'output prima di procedere. Assumono che `design_handoff_obsidian/` sia dentro il repo.

---

### Prompt 0 — Contesto (sempre per primo)

```
Leggi design_handoff_obsidian/README.md e design_handoff_obsidian/TOKENS.md per intero.
I file .dc.html nella stessa cartella sono prototipi di design HTML: NON copiarli,
ricreali nei pattern di questo repo. Conferma di aver capito riassumendo: accento unico,
scala colori-tipo, light/dark, stack del repo. Non scrivere ancora codice.
```

### Prompt 1 — Token foundation

```
Crea il modulo dei design token in lib/theme/obsidian.ts (o equivalente per questo repo),
trascrivendo ESATTAMENTE i valori di TOKENS.md: accento Phantom Violet, neutri light/dark,
scala colori-tipo, semantici, raggi, spaziatura. Espone i token come CSS variables con
switch via attributo data-theme="light|dark". Aggiungi i font Geist e Geist Mono.
Non modificare ancora i componenti esistenti.
```

### Prompt 2 — Primitive

```
Implementa i componenti primitivi leggendo i token dal tema: Button, IconButton, Chip/Badge,
Card, Field/Input, Select, Toggle, SegmentedControl, Avatar, Sheet/Modal, Toast, Skeleton,
ListRow, TableRow. Riferimento visivo: design_handoff_obsidian/GimmickObsidian.dc.html
(sezione componenti, light e dark). Rispetta raggi, hairline, stati hover/active/focus.
```

### Prompt 3 — Beniamini

```
Crea components/mascot/ con un componente <Beniamino name size/> e i 10 SVG delle mascotte.
Riferimento ESATTO (forme + coppie colore fisse): design_handoff_obsidian/Mascot.dc.html.
Le coppie colore sono identità: non modificarle. Includi il pattern "suggerimento del beniamino"
visto in GimmickCaptureFlows.dc.html (schermata Salva spark).
```

### Prompt 4 — Shell desktop

```
Implementa lo shell desktop: Header, Sidebar (tag/cartelle), Inspector, contenitore viste.
Layout-guida: design_handoff_obsidian/GimmickApp.dc.html. Pezzi isolati con stati light/dark:
GimmickHeader.dc.html, GimmickSidebar.dc.html, GimmickInspector.dc.html. Usa le primitive del Prompt 2.
```

### Prompt 5 — Viste desktop (una per messaggio)

```
Implementa la vista <NOME> seguendo design_handoff_obsidian/<FILE>.dc.html come spec.
Riusa shell e primitive. Mantieni la scala colori-tipo e light/dark.
```
Ripeti per: Tiles (`GimmickTable`), Sparks (`GimmickBuffer`), Canvas (`GimmickCanvas`),
Kanban (`GimmickKanban`/`GimmickKanbanDates`), Chrono (`GimmickChrono`),
Panopticon (`GimmickPanopticon`), Flows (`GimmickFlows`), Settings (`GimmickSettings`),
Ask (`GimmickAsk`), Modali (`GimmickModals`).

### Prompt 6 — Shell + schermate mobile

```
Implementa lo shell mobile (StatusBar, TopNav, NavPill, Drawer) e poi le schermate mobile,
una per messaggio, seguendo i rispettivi DC: GimmickMobileCapture, GimmickCaptureFlows,
GimmickMobileViews, GimmickMobileSparks, GimmickMobileBuffer, GimmickMobileTile,
GimmickMobileAsk, GimmickMobileAuth.
```

### Prompt 7 — Stati di servizio

```
Implementa gli stati trasversali seguendo design_handoff_obsidian/GimmickStates.dc.html:
empty, loading skeleton, offline/error, toast (success/undo/AI/error), centro notifiche.
```

### Prompt 8 — Migrazione e pulizia

```
Sostituisci progressivamente gli import del vecchio sistema (pixel-theme.ts, pixel-components.tsx,
CRT/scanline/pixel) con i nuovi componenti, una rotta alla volta. Quando tutte le rotte sono migrate,
rimuovi i file e gli stili arcade residui. Verifica light/dark, contrasto AA e hit target ≥44px su mobile.
```

---

## Suggerimenti

- Procedi **una schermata per messaggio**: output più accurato e diff più piccoli.
- Tieni aperto in VS Code il `.dc.html` di riferimento (aprilo nel browser) mentre Claude Code lavora.
- Se Claude Code propone colori non in `TOKENS.md`, correggilo: la scala è chiusa.
- Fai committare a Claude Code dopo ogni schermata funzionante.
