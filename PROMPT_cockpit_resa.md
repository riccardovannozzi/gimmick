# Cockpit — conversione da card a riga

**Specifica di riferimento:** `design_handoff_obsidian/GimmickCockpit.dc.html`.
È la fonte di verità sulla resa. Aprilo e leggilo prima di scrivere qualsiasi
cosa: le griglie, le larghezze e i pesi tipografici stanno lì, non in questo
documento.

**Portata:** solo resa. Due file:

- `frontend/components/views/cockpit-live.tsx`
- `frontend/app/obsidian-cockpit.css`

**Non si tocca la derivazione.** `currentStep`, `subtaskBall`, `stalenessFrom`,
`cockpitLane`, `subtaskToStep` in `frontend/lib/tile-visual.ts` restano
esattamente come sono, con i loro commenti. Non si tocca `SubtaskList.tsx`, non
si toccano le API, non si tocca il database.

---

## STEP 0 — Lettura, in sola lettura

Non modificare niente in questo step.

1. Apri il mockup e ricava la griglia della riga: numero di slot, larghezze,
   dimensioni e pesi del testo, colori usati per ciascuno slot.
2. Apri `frontend/app/obsidian-cockpit.css` ed elenca quali classi
   `.ob-cockpit__*` sopravvivono alla conversione, quali vanno riscritte e
   quali vanno eliminate perché appartengono alla card.
3. Verifica quali variabili CSS usate dal mockup esistono già fra gli `--ob-*`
   del progetto e quali sono state inventate nel mockup per comodità. Le
   inventate vanno ricondotte ai token esistenti, **non aggiunte**: se un colore
   non ha un token, dillo e chiedi invece di crearne uno.

Riferisci e fermati. **GATE 0.**

---

## FASE 1 — La riga

`FlowCard` diventa `FlowRow`: da card in colonna a **riga da 30px** con griglia
a cinque slot, come nel mockup.

```
tag  ·  passo corrente  ·  chi / contesto  ·  pioli  ·  età
```

Punti su cui il mockup è vincolante e la versione attuale diverge:

**Il testo principale è il passo, non il titolo del tile.** Oggi la card mette in
evidenza `tile.title` e il passo sotto in seconda fila. Si inverte: il passo
corrente è il testo primario della riga, il titolo del tile diventa contesto.
La ragione è che in una lista di cose da fare si legge l'azione, non il
contenitore.

**Lo slot «chi / contesto» porta contenuti diversi nelle due corsie**, con la
stessa larghezza, lo stesso peso e la stessa posizione:

- corsia `mine` → il titolo del tile, in `subtle`
- corsia `theirs` con contatto → il nome del contatto, in `muted`, con glifo pieno
- corsia `theirs` senza contatto (`is_theirs` vero, `contact_id` nullo) → la
  parola «qualcuno» in corsivo `faint`, con glifo vuoto

I due gradi della marcatura devono leggersi come la stessa cosa a due livelli di
precisione, non come due categorie diverse.

**I pioli restano** come sono oggi, inclusa la resa neutra sui tile chiusi:
quella logica è corretta e non si tocca. Cambia solo l'orientamento, da verticale
a orizzontale in riga.

**L'età resta una chiave d'ordinamento, non un giudizio.** Nessuna soglia,
nessun colore d'allarme, nessuna corsia «fermi». Il giorno zero non si scrive.

**GATE 1 — fermati, mostrami il diff.**

---

## FASE 2 — Il tetto al posto dello scroll

Oggi la corsia ha `limit: 100` e `ob-scroll-quiet`. Entrambi vanno via.

Ogni colonna ha un **tetto** di elementi visibili e, sotto, una riga di collasso
che dichiara il conteggio esatto di quelli non mostrati: `altri N · apri
l'elenco completo`. Stesso pattern di `STEPPER_MAX_SEGMENTS`, che nel progetto
mostra nove segmenti più uno riassuntivo.

Il tetto va tenuto **sotto** la capienza verticale della colonna, non pari alla
capienza: la riga di collasso deve comparire quasi sempre. Se non compare mai,
significa che si sta mostrando tutto, ed è la condizione che questa vista serve
a evitare.

Il tetto è una costante nominata con un commento che ne spiega il perché, non un
numero sparso nel JSX.

**Nessuno scroll interno alle colonne.** La vista sta in altezza di finestra.

**GATE 2 — fermati.**

---

## FASE 3 — I conclusi in coda

Oggi i conclusi hanno una corsia propria, la terza. Vanno invece **in fondo alla
lista a cui appartengono**, sotto un divisore, con i pioli neutri e il testo
attenuato. Restano attività individuate: né completate né da completare.

L'interruttore in barra continua a mostrarli e nasconderli come adesso.

**GATE 3 — fermati.**

---

## FASE 4 — Verifica

Lancia l'agente `notaio` sul diff completo. Questa volta può girare sul
frontend: il divieto valeva per il protocollo di Fase 1, non per questo lavoro.

Interessa in particolare il **CONTROLLO 1**: la conversione non deve aver
ricreato in `cockpit-live.tsx` logica che vive già in `tile-visual.ts`. Il
sospetto tipico è un calcolo di età o una selezione di passo riscritti a mano
per comodità di resa.

Lancia poi `precisino` sui due file. Qui ha senso, al contrario della Fase 1:
c'è UI, e la conversione tocca tipografia, spaziature e colori.

Correggi solo CRITICO e ALTA, massimo tre giri per agente. Se al terzo restano
segnalazioni alte, fermati e riferisci invece di fare un quarto giro.

**GATE 4 — fermati.**

---

## Commit

Due commit isolati su `dev`, senza push:

1. `refactor(cockpit): da card a riga secondo la specifica di resa`
2. `style(cockpit): CSS della riga, tetto, conclusi in coda`

---

## Fuori portata

- la derivazione in `tile-visual.ts`
- `SubtaskList.tsx` e il selettore della palla
- le API, le query, il database
- il filtro `action_type: 'flow'` sulla query dei tile: resta com'è
- aggiungere token `--ob-*` nuovi
