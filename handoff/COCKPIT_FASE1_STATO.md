# Stato — Cockpit Fase 1

**Fase corrente:** — **PROTOCOLLO CHIUSO alla Fase 2.**
**Esito:** i numeri veri hanno smentito il disegno; l'utente l'ha rivisto, e la revisione richiedeva l'interfaccia, che la PORTATA escludeva in modo assoluto. Il protocollo prescriveva esattamente questo caso («significa che il piano è sbagliato, non che la portata va allargata»).
**Prosegue in:** il progetto «La palla del passo», che assorbe la migration 049 e la derivazione e vi aggiunge il comando che le scrive. Piano in `~/.claude/plans/piped-watching-star.md`.
**Ultimo aggiornamento:** 5 settembre 2026

---

## Registro

| Fase | Esito | Iterazioni agente | File toccati | Data |
|------|-------|-------------------|--------------|------|
| 0 — Ricognizione | ✅ conclusa · 5/5 premesse confermate · 15 punti censiti · 5 contraddizioni segnalate | — (nessun agente previsto in Fase 0) | **creati:** `scripts/cockpit_recon.sql`, `handoff/COCKPIT_FASE1_STEP0.md`, `handoff/COCKPIT_FASE1_STATO.md` · **modificati:** nessuno | 04/09/2026 |
| 1 — Ciclo del Notaio | ⏸ preliminare: l'agente `notaio` non esisteva. Su scelta dell'utente l'ho scritto io | — | **creato:** `.claude/agents/notaio.md` | 05/09/2026 |
| 1 — giro 1 | ✅ 1 CRITICO + 1 ALTA + 5 BASSA. Entrambe le voci alte verificate in proprio prima di agire: reali. Censimento corretto: +A5, +gruppo G, ritrattata la frase «il gruppo A ha tenuto» | 1 su 3 | **modificato:** `handoff/COCKPIT_FASE1_STEP0.md` | 05/09/2026 |
| 1 — giro 2 | ✅ 1 CRITICO + 1 BASSA. Il CRITICO era un errore introdotto dalle correzioni del giro 1 («fuori portata: 13», incoerente con le proprie tabelle: il totale è 16 e l'enumerazione dimenticava B3). Corretto | 2 su 3 | **modificato:** `handoff/COCKPIT_FASE1_STEP0.md` | 05/09/2026 |
| 1 — giro 3 | ⚠️ 1 CRITICO, **falso positivo verificato**: «Decisioni aperte: 5» non torna perché nel censimento manca il rimando alla n. 4. Ma le decisioni vivono in QUESTO file (righe 21/33/42/56/80), dove il modello del protocollo le colloca; il censimento le richiama soltanto. Nessuna correzione | 3 su 3 — **tetto raggiunto** | nessuno | 05/09/2026 |
| 3-6 | ⛔ **non eseguite come scritte** · sostituite dal progetto «La palla del passo»: migration 049 (con travaso), `subtaskBall()`, il pulsante nella riga di checklist, primo test runner del repository | — | vedi il piano | 05/09/2026 |
| 2 — Decisione umana | ✅ **conclusa** · ricognizione eseguita, disegno rivisto dall'utente su quattro punti. La migration 049 è sospesa, quindi la Fase 3 resta senza contenuto; le fasi 4-6 vanno riscritte | — | nessuno | 05/09/2026 |

---

## Decisioni aperte

### 1. I `cancelled` nel denominatore del «X di Y»

Cinque punti (censimento, gruppo C) contano i passi annullati fra i passi
totali: un flow con due annullati su cinque dice «3 di 5» quando i passi
rimasti sono tre. La Fase 4 stabilisce che *«i `cancelled` non contano mai»*.

Delle due l'una: o la regola vale solo per `currentStep()` e il conteggio resta
com'è, o vale ovunque e i cinque punti vanno allineati — ma è un cambiamento
visibile su ogni card di ogni vista, su web e mobile.

**Non toccato in Fase 0.** Decide l'utente, non prima della Fase 4.

### 2. Dove vive `cockpitDerive.ts`

La Fase 4 dice `backend/src/lib/`. Quella cartella non esiste: il backend ha
già `utils/` (logica pura, senza I/O) e `services/`. Creare `lib/` significa
una terza casa per lo stesso genere di codice.

**Non deciso in Fase 0.** Cambiare il percorso di iniziativa mia sarebbe
allargare la portata al contrario.

### 3. Come si eseguono i test della Fase 5

Il backend non ha un test runner: nessuno script `test`, nessun vitest o jest
fra le dipendenze, zero file di test esistenti. La Fase 5 chiede test *«che
devono passare»*, quindi comprende anche il modo di eseguirli.

Due strade: aggiungere **vitest** come devDependency, oppure usare **`node:test`
con il `tsx` già presente** — che non aggiunge dipendenze, solo uno script.
La seconda tocca `package.json` di una riga; la prima di parecchie.

**Non deciso in Fase 0.**

---

### 4. Chi scrive il `notaio` — **decisa il 05/09/2026**

`.claude/agents/` contiene `doganiere.md` e `precisino.md`. Non c'è nessun
`notaio.md`, e la parola compare nel repository solo dentro il protocollo e i
documenti di questa Fase 1. La Fase 1 quindi non è eseguibile come scritta.

⚠️ **Il punto delicato non è che manchi il file: è CHI lo scrive e QUANDO.**
`doganiere` e `precisino` esistevano prima del codice che controllano. Un
`notaio` scritto adesso sarebbe scritto **dopo** il censimento, da chi il
censimento l'ha fatto, con il censimento sotto gli occhi: sarebbe la griglia di
valutazione compilata da chi viene valutato. La Fase 1 prevede persino di
correggere la definizione dell'agente quando produce falsi positivi — una
scappatoia che, se l'agente me lo scrivo da solo, non vuole più dire niente.

**Scelta dell'utente:** lo scrivo io, e lui lo legge PRIMA che venga lanciato.
La lettura preventiva è ciò che compensa il conflitto: la griglia la scrive chi
viene valutato, ma non entra in funzione prima che l'abbia vista chi valuta.

Il conflitto è scritto **dentro l'agente stesso**, come primo capitolo dopo
l'identità («Conflitto di interessi: leggilo prima di tutto»): il notaio sa che
il censimento gli arriva da chi l'ha scritto, e ha l'ordine di cercare per conto
proprio PRIMA di leggerne le conclusioni. È il massimo che l'artefatto può fare
da sé; il resto lo fa la lettura dell'utente.

### 5. A5 e gruppo G: trovati, ma intoccabili qui

Il giro 1 del Notaio ha aggiunto due voci al censimento. **A5** è una divergenza
in atto: `mobile/app/tile/[id]/list.tsx` disegna i subtask ignorando `state`, e
una riga `cancelled` appare spenta su uno schermo mobile e viva sull'altro. Il
**gruppo G** è la regola «questa riga è spenta», scritta in tre copie di cui due
nello stesso file a dieci righe di distanza.

La PORTATA del protocollo esclude in modo assoluto ogni file in `frontend/` e
`mobile/`. Quindi né A5 né il gruppo G — né, per la stessa ragione, i cinque
punti del gruppo C — sono riparabili dentro questo lavoro.

**Non deciso.** Sono materiale per un progetto successivo. La domanda per
l'utente è se A5, essendo una divergenza già visibile e non un rischio futuro,
meriti un intervento a sé prima delle fasi 3-5 invece di finire in coda.

---

## Rinviate al backlog

*(segnalazioni MEDIA e BASSA degli agenti, da trasformare in tile `anytime`)*

Dal **giro 1 del Notaio** (voci BASSA, non corrette per prescrizione della
Fase 1 — correggerle allargherebbe il diff):

1. **Numeri di riga imprecisi in `COCKPIT_FASE1_STEP0.md`** (contenuto giusto,
   numero sbagliato di poco): la 038 è citata a riga 65 per il `CHECK` che sta
   alle 76-78; la `page.tsx` a riga 365 per un confronto che sta alla 366; la
   027 a riga 7 per una frase che sta a cavallo fra la 7 e la 8.
2. **Descrizione della forma di A2 inesatta**: «tre `if` espliciti», mentre
   `mobile/lib/tile-visual.ts:154-157` ha due `if` e un ternario.
   L'equivalenza di comportamento con A1 resta corretta.
3. **Incoerenza nella sezione 0.3**: dichiara che «ogni CTE porta `user_id`»,
   ma la CTE `proj_tag` (`scripts/cockpit_recon.sql:62-68`) non lo seleziona.

Dal **giro 2**:

4. **A5 dice «la parola `state` non compare nel file»**, ed è falso alla lettera:
   `mobile/app/tile/[id]/list.tsx:73` ha un commento sullo stato React della
   riga. La sostanza di A5 — nessuna lettura del campo `tile_subtasks.state` —
   resta verificata riga per riga; è la formulazione assoluta a essere sbagliata.

⚠️ Nota di merito, non di procedura: la voce 1 lascia in un documento **citazioni
che si sa essere sbagliate**, in un documento il cui unico scopo è essere citato
più avanti. La Fase 1 lo prescrive («MEDIA e BASSA non si toccano») e ho seguito
la prescrizione, ma il costo qui è più alto del solito: chi in Fase 4 aprisse la
038 alla riga 65 cercando il vincolo non lo troverebbe. Bastano tre minuti a
chiuderla, se l'utente preferisce.

---

## GATE 1 — esito e diagnosi

Tre giri, il tetto previsto. **Non se ne fa un quarto**, come prescrive la Fase 1.

Bilancio: tre segnalazioni reali, tutte accolte e corrette — due erano buchi del
censimento di Fase 0 (A5 e il gruppo G), una era un errore introdotto dalle
correzioni stesse. La quarta, al terzo giro, è un falso positivo.

La Fase 1 elenca tre cause per un ciclo che non converge. Qui vale la **prima**:
*l'agente produce falsi positivi su un pattern legittimo → va corretta la
definizione dell'agente, non il codice*.

Il pattern legittimo è che **questo lavoro sta in due documenti**: il censimento
espone le prove, il file di stato tiene le decisioni e il registro. Il Notaio ne
riceve uno solo, e non ha modo di sapere che una voce che non trova nel primo
possa essere in regola nel secondo. Al terzo giro ha dichiarato mancante una
decisione che esiste.

**Correzione proposta**, da applicare a `.claude/agents/notaio.md` — non
applicata, perché il GATE 1 impone di fermarsi e perché quel file l'utente lo ha
letto prima di autorizzarlo:

> Aggiungere al CONTROLLO 1, in coda: *«Un documento può essere metà di una
> coppia: le prove in uno, le decisioni e il registro nell'altro. Prima di
> dichiarare mancante una voce che il documento conta ma non mostra, chiedi
> dove viva la sua sede: un rimando assente non è una voce assente.»*

Da notare, e va detto: il Notaio **non** ha usato la sezione «Quando il problema
sei tu» della sua definizione, che il prompt del giro 3 gli indicava
esplicitamente. Ha presentato il falso positivo come CRITICO. Dall'interno di un
file solo non poteva vedere l'altro, quindi non gli si può imputare la
conclusione — ma la sezione esiste proprio per i casi in cui il sospetto di
essere lui il problema dovrebbe venirgli, e non gli è venuto. È il secondo
argomento a favore della correzione proposta sopra.

---

## Fase 2 — i numeri veri (05/09/2026)

Ricognizione eseguita dall'utente su Supabase. **Lo script compila**: nessun
errore, sei sezioni più la 3b.

**Volume.** 751 tile, 363 voci di checklist, di cui **123 passi aperti** su
**61 tile candidati** — l'8% dei tile, due passi aperti a testa.

**Query 3 — L'ÀNCORA: fallisce.** 60 candidati su 61 non hanno tag `progetto`.
Uno solo ce l'ha. La 3b spiega perché: su 70 tag e 17 `tag_type`, `progetto` ne
ha **uno** («Borgo Santo Pietro»). I tipi realmente usati sono `ortano-mare` 11,
`immobili` 8, `strutture` 8, `family` 7, `money` 7, `golfo-del-sole` 6,
`topic` 5. L'utente non classifica per «progetto»: classifica per luogo e per
dominio. La colonna àncora, come disegnata, sarebbe vuota al 98%.

**Query 5 — ANZIANITÀ: volume sì, distribuzione rovesciata.** 11 / 5 / 30 / 77
nelle quattro fasce. Il 63% dei passi aperti ha più di 20 giorni, l'87% più di
sette. Con la soglia di 14 giorni già scelta una volta (`IDLE_THRESHOLD` nella
pagina di anteprima) circa tre passi su quattro sarebbero «fermi»: una corsia
che contiene quasi tutto non separa niente.
⚠️ Ambiguo: se `occurred_at` è nullo sulla maggioranza, questa non è l'anzianità
di un processo ma la data in cui la riga è stata scritta — e per una lista di
cose da fare è un numero normale che non dice niente.

**Query 6 — LE DUE ZONE: fallisce.** 28 passi `blocked`, di cui **27 senza
contatto**. Il criterio del protocollo («molti `blocked` senza contatto significa
che il modello a due zone non basta») è soddisfatto.
✅ E il numero è leggibile, contro il timore di N2: le due righe «con un
contatto» **non** sono a zero (1 + 24 = 25 passi aperti hanno un contatto).
I contatti nel dato ci sono, quindi il 27 su 28 è un segnale, non un artefatto.

**Correzione a N3.** Il censimento temeva che la palla fosse finita dentro il
testo alla migrazione dei beat. Almeno in parte **non è andata così**: 25 passi
aperti portano un `contact_id`, e nessuna interfaccia lo scrive. Qualcuno ce
l'ha messo — quasi certamente la migrazione. `contact_id` è una sorgente viva.

**Trovato senza cercarlo: 15 candidati su 61 sono chiusi.** 14 `done` e 1
`cancelled` hanno ancora passi aperti (più 2 `paused`). Un Cockpit costruito
sulla definizione attuale di «candidato» mostrerebbe un quarto di tile che
l'utente considera archiviati. `currentStep()` guarda i subtask e non lo status
del tile: la definizione di candidato ha bisogno di un filtro che oggi non ha.

**E i flow sono una minoranza:** 28 candidati su 61. Gli altri 33 sono tile
ordinari (`none` 16, `anytime` 7, `event` 7, `deadline` 3). Il materiale del
Cockpit non è fatto di processi: è fatto di checklist.

---

## Le quattro decisioni dell'utente (05/09/2026)

Rispondono ai numeri della ricognizione e **cambiano il disegno**. Le fasi 3-6
del protocollo non sono più eseguibili come scritte.

### D1 — L'àncora è il TAG, non il `tag_type`

«Per progetto intendevo il TAG (es: `GDS_Varie`)».

Il criterio della Query 3 non fallisce: era mal posto. Il progetto è il **nome
del tag** del tile; il `tag_type` (`golfo-del-sole`, `immobili`…) è il
raggruppamento sopra di esso. Ogni tile ha un tag — e ne ha **uno solo**, per
scelta di disegno — quindi l'àncora è popolata quasi ovunque.

Resta da misurare: quanti candidati portano il solo tag root GIMMICK (lì
l'àncora sarebbe rumore) e quanto sono lunghi i nomi veri, per la larghezza
della colonna. La Query 4 misurava i nomi sbagliati.

### D2 — `is_theirs` è SOSPESO

«Lo sospendiamo per un attimo perché renderebbe la compilazione più faticosa».

Il motivo è di costo d'uso, non di modello: marcare a mano la palla su ogni
passo è lavoro che si paga a ogni riga scritta. È coerente con N1 — quel campo
avrebbe avuto bisogno di un comando che non esiste.

**Conseguenza: la migration 049 non si fa, e la FASE 3 resta senza contenuto.**
La colonna non va creata: una colonna che nessuno scrive è debito, e aggiungerla
domani costa quanto oggi.

### D3 — Niente corsia «fermi»: un elenco ordinabile

«Fermi da troppo non ha senso, inseriamo tutto in un elenco ordinabile poi
vediamo come gestire graficamente la cosa».

Niente soglia, niente `IDLE_THRESHOLD`, niente corsia FERMI. L'anzianità diventa
una **colonna d'ordinamento**, non una classificazione.

`stalenessFrom()` sopravvive e serve ancora — cambia il mestiere: da criterio
che divide a chiave che ordina. È anche ciò che disinnesca il numero più
imbarazzante della ricognizione (77 passi su 123 oltre i venti giorni): con un
ordinamento non esiste una corsia che contiene tutto.

### D4 — I tile chiusi rendono i loro passi NEUTRI

«Le tile chiuse devono automaticamente portare lo step in condizione neutra
(grigio). Restano dentro l'elenco come attività individuate ma né completate né
da completare (è anomalo ma avviene spesso)».

Risponde ai 15 candidati chiusi con passi ancora aperti. È uno **stato nuovo**,
il quinto: `neutral`. Non va salvato sul database — si DERIVA dallo status del
tile, esattamente come `state` si sovrappone a `is_done`. Nessuna migration.

Due conseguenze sulla derivazione:
- lo stato di un passo dipende ora anche dal tile: `subtaskToStep` da solo non
  basta più, serve un secondo argomento;
- un tile chiuso **non ha un passo corrente**: i suoi passi non sono da fare.
  `currentStep()` deve restituire `null`.

### D5 — L'obiettivo resta DUE LISTE: «Tocca a me» / «Tocca a te»

È la risposta alla domanda se scrivere `subtaskBall()`: sì, ed è il cuore della
cosa, non un accessorio.

⚠️ **Ma con i segnali di oggi la seconda lista è quasi vuota, e si svuoterà.**
Su 123 passi aperti, **98 non hanno un contatto** e finirebbero tutti in «Tocca a
me». I 25 che ce l'hanno sono un lascito della migrazione dei beat: nessuna
interfaccia scrive `contact_id`, quindi ogni passo nuovo nasce senza. Man mano
che i vecchi si chiudono, «Tocca a te» tende a zero.

È la tensione lasciata aperta da D2: la marcatura è stata sospesa perché costa
fatica, ma **senza una marcatura qualsiasi la seconda lista non ha sorgente**.

Tre strade, con i numeri:

| | sorgente | «Tocca a te» oggi | costo d'uso |
|---|---|---|---|
| a | solo `contact_id` | ≤ 25, in calo | nessuno, ma niente da marcare = niente lista |
| b | `contact_id` **+** `state='blocked'` | fino a **52** | zero: usa il lucchetto che già esiste e che già usi |
| c | rimettere `is_theirs` | il più preciso | è quello sospeso in D2 |

La **b** merita un pensiero: 27 dei 28 passi `blocked` non hanno un contatto, ed
è esattamente il profilo di «l'ho fermato perché aspetto qualcuno, senza dire
chi» — cioè il caso per cui `is_theirs` era stato pensato. Il pulsante esiste,
è già in interfaccia, e l'hai già premuto 28 volte.

Il suo prezzo: cambia il significato del lucchetto. Oggi `blocked` vuol dire
«fermo per un ostacolo» (migration 038) e il commento di
`mobile/components/obsidian/SubtaskList.tsx:137-139` lo legge come «quello che
devi ancora sbloccare» — che tira verso «tocca a me», non verso «tocca a te».

**Non deciso.** Serve la scelta dell'utente: cambia il corpo di `subtaskBall()`.

Numero mancante per decidere: **quanti dei 25 contatti sono il contatto «Io»**
(`is_self`), che varrebbero «tocca a me». Bastano tre righe di SQL.

### D6 — Àncora: 15 caratteri, poi taglia

«Considera 15 caratteri scritti bene e poi taglia (su hover mostra il testo
esteso)».

Decisione di resa, per il progetto della UI del Cockpit: **non si tocca qui**.
Registrata perché chiude la Query 4 — la larghezza della colonna non dipende più
dalla lunghezza dei nomi veri, quindi quella misura non serve più.

Resta minore, e non blocca: sui candidati che portano il solo tag root l'àncora
mostrerebbe «Gimmick», cioè rumore.

---

## Fase 2 — che cosa si sta aspettando

`scripts/cockpit_recon.sql`, eseguito dall'utente nell'editor SQL di Supabase.
Una Run sola: le sei ricognizioni escono come un elenco unico.

Tre numeri decidono se il disegno del Cockpit regge:

- **Sezione 6** — molti passi `blocked` senza contatto significa che il modello a
  due zone non basta. ⚠️ Da leggere insieme a **N1** e **N2** del censimento:
  `contact_id` non è mai stato scrivibile da nessuna interfaccia, quindi questo
  numero potrebbe misurare l'assenza di un comando e non una proprietà del
  modello. Se le due righe «con un contatto» sono entrambe a zero, il numero non
  dice niente sul modello.
- **Sezione 3** — molti tile candidati senza tag `progetto` significa che la
  colonna àncora sarà piena di trattini. Guardare anche la **3b** prima di
  concludere: `'progetto'` è una convenzione, non un vincolo di schema.
- **Sezione 5** — dice se le attese sono undici o tre. Se sono tre, il layout a
  tre colonne è sbagliato.

Se uno di questi numeri contraddice il disegno, il protocollo **si sospende**: la
revisione va fatta prima della migration, non dopo.

Lo script non è mai stato eseguito, quindi non è provato che compili. Se Postgres
si lamenta, i punti da guardare per primi sono le due `ROW_NUMBER() OVER (ORDER
BY …)` delle sezioni 2 e 3b e il `GROUP BY 2, 4` posizionale della sezione 5.

---

## Note per chi riprende

Il documento da leggere prima di tutto è `handoff/COCKPIT_FASE1_STEP0.md`.
Le cinque contraddizioni N1–N5 sono lì; la più importante è **N1**: dopo la
migration 049, `is_theirs` sarà `FALSE` su tutte le righe e nessuna interfaccia
potrà cambiarlo, perché contatto e data sono stati deliberatamente tolti dalla
riga di checklist. Questo cambia come vanno letti i numeri della Fase 2.
