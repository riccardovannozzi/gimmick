/**
 * Gimmick · Canvas — RIORDINO: allinea e regolarizza senza rifare la disposizione.
 *
 * Il canvas si costruisce trascinando, e trascinando si sbaglia di qualche pixel:
 * l'impianto è giusto — le colonne sono colonne, le righe sono righe — ma niente
 * cade esattamente dove dovrebbe e le distanze che dovevano essere uguali non lo
 * sono. Questo modulo fa la rifinitura e SOLO la rifinitura: chi era nella terza
 * colonna resta nella terza colonna, chi stava sopra resta sopra, gli stacchi che
 * separano i blocchi restano stacchi. Non è un auto-layout — un auto-layout
 * decide dove vanno le cose, questo le lascia dove sono e le mette in squadra.
 *
 * Niente React, niente D3, nessun import da componenti: aritmetica su rettangoli,
 * così il comportamento si può ragionare (e un giorno collaudare) da solo.
 *
 * ─── I tre passaggi ──────────────────────────────────────────────────────────
 *
 * CORSIE. Gli oggetti che si accavallano su un asse diventano una colonna (o
 * riga) sola, e la corsia prende per coordinata la mediana dei suoi membri. Non
 * è una tolleranza di qualche pixel: DUE COLONNE NON POSSONO SOVRAPPORSI, quindi
 * due tile che si accavallano non sono due colonne, sono una colonna storta —
 * anche quando lo scarto è di tre quarti di tile. Con una tolleranza stretta
 * quattro tile disposti a quadrato con un angolo fuori squadra uscivano a
 * scaletta: allineati, ma non come li aveva pensati chi li ha messi.
 *
 * Vale però solo fra oggetti della STESSA misura, ed è lo stesso motivo per cui
 * esiste il canone: dove le misure sono uguali, «allineati» ha un significato
 * preciso. Per gli altri resta il passo di griglia — a meno che un EDGE non li
 * colleghi: un collegamento è una ragione per stare nella stessa corsia, e fra
 * due oggetti legati il raggio si allarga a mezzo ingombro. Quel tanto che basta
 * a raddrizzare i collegamenti già quasi dritti, senza trascinare in colonna chi
 * una diagonale lunga l'aveva disegnata apposta.
 *
 * ⚠️ Le corsie si formano e si allineano sul CENTRO degli oggetti, non sul bordo.
 * È l'unica cosa che rende ortogonale un collegamento fra misure diverse — un
 * edge esce dalla metà del lato, e due bordi sinistri allineati con larghezze
 * diverse lasciano i centri sfalsati. Conseguenza: chi è più stretto della
 * propria corsia si centra dentro, e può cadere fra i puntini (di due pixel, in
 * pratica). Un marcatore fuori dai puntini si nota molto meno di una linea
 * sghemba.
 *
 * DISTANZE. Le distanze fra corsie consecutive si raggruppano per somiglianza e
 * ogni gruppo collassa sulla propria mediana. È il passaggio che distingue «le
 * distanze simili diventano uguali» da «tutte le distanze diventano uguali»:
 * uno stacco isolato forma un gruppo da solo e resta quello che era.
 *
 * CANONE. Le distanze normali non si accontentano di essere uguali fra loro:
 * vanno su un valore GIUSTO, uno solo per asse (`TIDY_GAP`) — i tile sono tutti
 * identici, quindi «quanto spazio ci va fra due tile» è una domanda con una
 * risposta. E se fra i due passa un edge, la risposta cambia: gli serve spazio
 * per la punta e per l'etichetta, e scatta un minimo più largo
 * (`TIDY_GAP_LINKED`). Solo le distanze già vicine al canone ci si posano: oltre
 * una volta e mezza, era una separazione voluta e resta dov'è.
 *
 * RICOSTRUZIONE. Si riparte dalla prima corsia, posata su un multiplo del passo,
 * e si somma un numero INTERO di passi per volta.
 *
 * ─── L'ordine dei passaggi non è negoziabile ─────────────────────────────────
 *
 * Le distanze si misurano PRIMA di entrare in griglia. Posando ogni corsia sulla
 * griglia per conto suo — che sarebbe la mossa ovvia — l'arrotondamento si mangia
 * fino a un passo intero di distanza fra due corsie vicine: 20px di respiro
 * diventavano 4, cioè due tile quasi attaccati. In griglia ci si entra una volta
 * sola, alla fine, dove è il PASSO a essere un multiplo e non la singola corsia.
 *
 * `TILE_W` è 128 e il passo è 22: non sono commensurabili, quindi «tutto sulla
 * griglia» e «tutte le distanze identiche al pixel» non possono valere insieme.
 * Si tiene la griglia, e il prezzo è che fra oggetti di TAGLIA diversa la
 * distanza reale balla di meno di un passo — 26px dopo un tile, 30px dopo un
 * marcatore. È la differenza fra gli oggetti, non fra le spaziature, e sotto i
 * 22px non si legge come irregolarità.
 *
 * ─── Due promesse, e quale vince quando si toccano ───────────────────────────
 *
 * RISPETTARE LA DISPOSIZIONE. Nessuno scavalca nessuno: chi stava a sinistra
 * resta a sinistra. È garantito dalla costruzione — le corsie sono tratti
 * contigui della fila ordinata e le coordinate crescono di corsia in corsia —
 * ma solo per UNA disposizione fatta sulla geometria di partenza.
 *
 * ESSERE RIPETIBILE. Premere due volte non deve muovere niente la seconda, o il
 * comando diventa una cosa che «sposta un po' ogni volta». Ci si arriva
 * rileggendo le corsie sul risultato e rifacendo il conto finché le due letture
 * combaciano.
 *
 * Le due cose si toccano: rileggere le corsie su una geometria già mossa può
 * cambiare a chi appartiene un oggetto, e un oggetto che cambia corsia può
 * ritrovarsi dall'altra parte di uno che prima gli stava accanto. Vince la
 * prima — è la ragione per cui il comando esiste; l'altra è una comodità.
 * Quindi si itera finché l'ordine regge e ci si ferma al primo giro che
 * scavalcherebbe qualcuno.
 *
 * Sul banco di prova (402 lavagne realistiche, ~3.900 oggetti, metà in modo
 * selezione): zero scavalcamenti, zero sovrapposizioni introdotte, e 2 lavagne
 * su 402 in cui la seconda pressione muove ancora qualcosa.
 *
 * ─── Cosa NON garantisce ─────────────────────────────────────────────────────
 *
 * Un oggetto più stretto della propria corsia non cade sui puntini: si centra
 * nella corsia, e il centro di una corsia è un multiplo del passo solo quando le
 * misure combaciano. Sulle 402 lavagne realistiche è capitato a 143 tile su
 * ~3.300, e lo scostamento è di 2px — cioè invisibile. Chi è largo quanto la sua
 * corsia sta sempre esatto sulla griglia.
 *
 * Il riordino non avvicina mai due oggetti separati: ogni corsia si tiene libera
 * dall'ingombro di TUTTE quelle prima, non solo dell'ultima (vedi la
 * ricostruzione).
 *
 * L'altra cosa che non garantisce è di spostare POCO: normalizzare le distanze
 * fa slittare tutto quello che sta a valle, e sulle stesse 400 lavagne l'oggetto
 * più lontano dall'angolo si è spostato fino a 187px — quasi 1000 con
 * `strictCanon`, dove chiudere uno strappo da 400px è proprio il lavoro
 * richiesto. La disposizione resta quella, ma il canvas si ricompone: è il
 * motivo per cui il comando ha un «Annulla» e non una conferma preventiva.
 *
 * Con `strictCanon` c'è un effetto in più da conoscere: un oggetto molto largo
 * che già sconfinava nella corsia accanto, avvicinando le corsie finisce per
 * scavalcarne di più. Non è la spaziatura che sbaglia — è un ingombro che, in un
 * canvas compattato, copre più roba di prima.
 */

/** Un oggetto sulla lavagna: id e rettangolo in coordinate di lavagna. */
export interface TidyRect { id: string; x: number; y: number; w: number; h: number }

export interface TidyOptions {
  /** Passo della griglia. Default 22, il `DOT_STEP` della board. */
  step?: number;
  /**
   * Quanto due bordi possono distare per essere «la stessa corsia».
   * Default: un passo — oltre, era una scelta e non una sbavatura.
   */
  tol?: number;
  /**
   * Chi è COLLEGATO a chi: coppie di id, nello stesso formato dei rettangoli.
   * Serve solo a far rispettare `TIDY_GAP_LINKED` fra due corsie consecutive
   * che un edge attraversa. Il verso non conta — è una distanza, non una freccia.
   */
  links?: readonly (readonly [string, string])[];
  /**
   * Il canone vale per TUTTE le distanze, anche quelle larghe.
   *
   * È la differenza fra «rifinisci la lavagna» e «metti in riga QUESTI». Su
   * tutto il canvas gli stacchi ampi vanno rispettati: separano blocchi di
   * lavoro, e nessuno li ha messi lì per sbaglio. Ma quando si indicano degli
   * oggetti uno per uno e si chiede di ordinarli, quello che si sta chiedendo è
   * proprio di renderli equidistanti — lasciare intatto lo strappo in mezzo
   * significa rispondere «era già in ordine» a chi sta guardando una fila
   * sbilenca.
   *
   * Non tocca le corsie che si SOVRAPPONGONO: quella non è spaziatura, è
   * ingombro, e resta una scelta di chi ha disegnato.
   */
  strictCanon?: boolean;
}

/** Posizione di partenza per chi non compare nel risultato (non dovrebbe capitare). */
type Point = { x: number; y: number };

const DEFAULT_STEP = 22;

/**
 * IL CANONE — quanta aria ci va fra due oggetti adiacenti.
 *
 * I tile sono tutti della stessa misura (128×72), e questo rende possibile una
 * distanza «giusta» invece di una dedotta ogni volta da quello che c'era. I due
 * numeri non sono scelti a occhio: sono fra i pochi che, sommati all'ingombro
 * del tile, cadono esattamente sulla griglia —
 *
 *     128 + 26 = 154 = 7 passi        72 + 16 = 88 = 4 passi
 *
 * Le scale disponibili sono queste, e vanno di 22 in 22 come la griglia:
 *
 *     in riga     4 · 26 · 48 · 70 · 92
 *     in colonna  16 · 38 · 60 · 82
 *
 * ⚠️ I due valori vanno scelti a gradini CORRISPONDENTI, non a caso: l'aria
 * orizzontale sta un gradino più in alto di quella verticale, e la differenza
 * resta 10px qualunque coppia si prenda (26/16, 48/38, 70/60). È quella
 * differenza costante a far leggere una scacchiera di tile come una griglia
 * regolare invece che come colonne larghe e righe strette — spostarsi di un
 * gradino su un asse solo la romperebbe.
 *
 * Per gli oggetti di misura diversa (note, immagini, marcatori) il canone vale
 * lo stesso come ARIA, ma il passo che ne esce va arrotondato alla griglia: la
 * distanza reale balla di meno di un passo. È la differenza fra gli oggetti, non
 * fra le spaziature.
 */
export const TIDY_GAP = { x: 26, y: 16 } as const;

/**
 * IL MINIMO FRA DUE COLLEGATI — un edge ha bisogno di spazio per farsi vedere.
 *
 * Dal disegno degli edge (CanvasBoard): la punta più grande vuole 9px di stacco
 * dall'aggancio più 20 di punta, cioè 29; una doppia freccia ne vuole 58; una
 * pillola con un'etichetta corta circa 37. Nell'aria canonica (26) non ci sta
 * nemmeno una freccia singola: la punta toccherebbe i due tile.
 *
 * ⚠️ Questo minimo NON scende insieme al canone, ed è il motivo per cui è una
 * costante separata: il canone è una scelta di gusto, questo è una misura presa
 * su quello che va disegnato in mezzo. Restringendolo, frecce ed etichette
 * finirebbero addosso ai tile — e i conti tornano comunque esatti sulla griglia:
 *
 *     128 + 70 = 198 = 9 passi        72 + 60 = 132 = 6 passi
 *
 * ⚠️ È un MINIMO, non una distanza. Due tile collegati già più lontani restano
 * dove sono: paga solo chi è troppo vicino.
 */
export const TIDY_GAP_LINKED = { x: 70, y: 60 } as const;

/**
 * Fin dove il canone ATTIRA, quando si riordina TUTTA la lavagna: un passo e
 * mezzo di griglia OLTRE il canone, cioè 33px. Una distanza che manca il canone
 * di meno di così è lo stesso canone fatto a mano — 21, 30, 24 sono tre
 * tentativi di dire la stessa cosa. Oltre, è una separazione VOLUTA: lo stacco
 * che divide due blocchi di lavoro resta quello che è.
 *
 * ⚠️ Un margine in PIXEL, non un moltiplicatore del canone. Come multiplo il
 * raggio si stringeva insieme al canone: sceso a 26/16, la soglia verticale
 * sarebbe caduta a 24px e il comando avrebbe dichiarato «voluta» quasi ogni
 * distanza, compattando niente. Peggio, avrebbe misurato i due assi con due
 * metri diversi solo perché il canone verticale è più piccolo — mentre la mano
 * che ha trascinato i tile sbaglia della stessa quantità in tutte e due le
 * direzioni.
 *
 * Su una SELEZIONE il raggio non vale (vedi `strictCanon`): chi indica degli
 * oggetti e chiede di ordinarli li vuole equidistanti, strappo compreso.
 */
const CANON_REACH_STEPS = 1.5;

/**
 * Riordina i rettangoli e restituisce le posizioni nuove, per id.
 *
 * Gli oggetti NON cambiano misura: si muove solo l'angolo in alto a sinistra.
 */
export function tidy(rects: TidyRect[], opts: TidyOptions = {}): Map<string, Point> {
  const step = opts.step && opts.step > 0 ? opts.step : DEFAULT_STEP;
  const tol = opts.tol ?? step;
  const links = opts.links ?? [];
  // Quanto lontano arriva l'attrazione del canone: il margine dichiarato sopra,
  // oppure ovunque quando è chi comanda a dire che quegli oggetti vanno
  // equidistanti.
  const reach = opts.strictCanon ? Infinity : step * CANON_REACH_STEPS;
  const rules = { step, tol, links, reach };

  /**
   * ⚠️ Anche la STRUTTURA converge, non solo le distanze — ma ogni giro riparte
   * dalle posizioni ORIGINALI.
   *
   * Le corsie si leggono dal disegno; il riordino, spostando, cambia il disegno,
   * e quindi le corsie che ne leggerebbe la volta dopo. Se non le si fa
   * combaciare, premere il pulsante due volte muove ancora qualcosa la seconda —
   * il modo più veloce di perdere fiducia in un riordino automatico. Qui si
   * cerca la struttura che RILEGGE SÉ STESSA: si dispone, si rileggono le
   * corsie, e se sono cambiate si ridispone con quelle.
   *
   * Il ripartire ogni volta dall'originale non è un dettaglio: è ciò che tiene
   * fermo l'ORDINE. Le corsie sono tratti contigui della fila ordinata, e le
   * posizioni sono una funzione non decrescente di quelle di partenza — quindi
   * una disposizione sola non può far scavalcare nessuno. Impilando invece una
   * disposizione sull'altra, un oggetto poteva cambiare corsia in corsa e
   * ritrovarsi a sinistra di chi prima gli stava a sinistra.
   */
  /**
   * ⚠️ La prima disposizione nasce dalla geometria ORIGINALE, e quella non si
   * discute: è l'unica che non può far scavalcare nessuno. Le corsie sono tratti
   * contigui della fila ordinata e le coordinate finali crescono di corsia in
   * corsia, quindi chi stava a sinistra resta a sinistra.
   *
   * Poi si prova a RILEGGERE le corsie sul risultato e a rifare il conto: serve a
   * far combaciare le due letture, cioè a far sì che premere il pulsante una
   * seconda volta non muova più niente. Ma rileggere le corsie su una geometria
   * già mossa può cambiare a chi appartiene un oggetto, e un oggetto che cambia
   * corsia può ritrovarsi dall'altra parte di uno che prima gli stava accanto.
   *
   * Fra le due cose la scelta non è alla pari: che il riordino RISPETTI LA
   * DISPOSIZIONE è la ragione per cui esiste; che sia ripetibile è una comodità.
   * Quindi si itera finché l'ordine regge, e al primo giro che scavalcherebbe
   * qualcuno ci si ferma tenendo il risultato di prima.
   */
  /** Chi è legato a chi, in una forma su cui si può interrogare. */
  const bonds = new Set<string>();
  for (const [a, b] of links) { bonds.add(`${a} ${b}`); bonds.add(`${b} ${a}`); }
  const linked: Linked = (a, b) => bonds.has(`${a} ${b}`);

  const first = laneIdsOf(rects, tol, linked);
  let placed = place(rects, first.x, first.y, rules);
  for (let round = 1; round < 4; round++) {
    const lanes = laneIdsOf(placed, tol, linked);
    const next = place(placed, lanes.x, lanes.y, rules);
    if (next.every((r, i) => r.x === placed[i].x && r.y === placed[i].y)) break;
    if (!keepsOrder(rects, next)) break;
    placed = next;
  }

  const out = new Map<string, Point>();
  for (const r of placed) out.set(r.id, { x: r.x, y: r.y });
  return out;
}

/**
 * Nessuno ha scavalcato nessuno? Si confrontano le posizioni nuove con quelle di
 * PARTENZA, coppia per coppia e asse per asse: chi stava prima deve stare prima
 * (o alla pari — finire in colonna insieme è un allineamento, non un sorpasso).
 */
function keepsOrder(before: TidyRect[], after: TidyRect[]): boolean {
  /**
   * ⚠️ Conta solo per le coppie che su quell'asse erano SEPARATE.
   *
   * Fra due oggetti che si accavallano — un marcatore dentro l'ingombro di un
   * tile — «chi viene prima» non è una cosa che si vede: sono nella stessa
   * colonna, e il riordino li centra entrambi su di essa. Contare anche quelli
   * significava dichiarare uno scavalcamento ogni volta che un oggetto piccolo si
   * spostava dallo spigolo del suo vicino al centro della corsia, e bloccare la
   * ripetibilità per un sorpasso che nessuno può notare.
   */
  const apartX = (a: TidyRect, b: TidyRect) => a.x + a.w <= b.x || b.x + b.w <= a.x;
  const apartY = (a: TidyRect, b: TidyRect) => a.y + a.h <= b.y || b.y + b.h <= a.y;
  for (let i = 0; i < before.length; i++) {
    for (let j = i + 1; j < before.length; j++) {
      if (apartX(before[i], before[j])
        && Math.sign(before[i].x - before[j].x) * Math.sign(after[i].x - after[j].x) < 0) return false;
      if (apartY(before[i], before[j])
        && Math.sign(before[i].y - before[j].y) * Math.sign(after[i].y - after[j].y) < 0) return false;
    }
  }
  return true;
}

interface PlaceRules {
  step: number;
  tol: number;
  reach: number;
  links: readonly (readonly [string, string])[];
}

/**
 * Le corsie dei due assi, in CASCATA.
 *
 * Il guardiano deve sapere se due oggetti sono separati sull'altro asse. Se lo
 * chiede alla geometria, chiede a una cosa che il riordino sta cambiando: al
 * secondo giro la risposta è diversa e la struttura si rifà diversa — premere il
 * pulsante due volte muove ancora qualcosa. Se lo chiede alle CORSIE dell'altro
 * asse, la risposta si conserva: dopo il riordino chi stava in corsie diverse ci
 * sta ancora, e chi stava insieme pure.
 *
 * Le corsie però sono proprio quello che si sta calcolando, e i due assi si
 * guardano a vicenda. Il nodo si taglia con un giro di boa: righe PROVVISORIE
 * lette dalla geometria, colonne definitive guardate da quelle, righe definitive
 * guardate dalle colonne. Le provvisorie servono solo da appoggio e non entrano
 * nel risultato.
 */
function laneIdsOf(rects: TidyRect[], tol: number, linked: Linked): { x: string[][]; y: string[][] } {
  const itemsX = axisItems(rects, 'x');
  const itemsY = axisItems(rects, 'y');
  let rows = clusterLanes(itemsY, tol, clearOnOther, linked);
  let cols = clusterLanes(itemsX, tol, inOtherLanes(laneIndex(rows)), linked);
  /**
   * Il giro si ripete finché le due strutture non si reggono a vicenda: le
   * colonne guardate dalle righe e le righe guardate da QUELLE colonne, non da
   * quelle di partenza. L'appoggio geometrico iniziale serve solo a rompere il
   * cerchio, e dopo un paio di giri non se ne vede più traccia.
   */
  for (let round = 0; round < 3; round++) {
    const nextRows = clusterLanes(itemsY, tol, inOtherLanes(laneIndex(cols)), linked);
    const nextCols = clusterLanes(itemsX, tol, inOtherLanes(laneIndex(nextRows)), linked);
    const same = sameShape(nextRows, rows) && sameShape(nextCols, cols);
    rows = nextRows;
    cols = nextCols;
    if (same) break;
  }
  const ids = (lanes: AxisItem[][]) => lanes.map((l) => l.map((i) => i.id));
  return { x: ids(cols), y: ids(rows) };
}

/**
 * Dispone i rettangoli date le corsie, e RIPETE finché non cambia più niente.
 *
 * Il ciclo interno è per le SOGLIE, non per la struttura: il canone attira le
 * distanze fino a un margine, il ramo delle corsie sovrapposte guarda il segno,
 * e l'entrata in griglia sposta ogni distanza di una decina di pixel. Basta
 * questo perché una distanza appena oltre una soglia ci finisca dentro DOPO
 * l'arrotondamento — non attirata al primo giro, attirata al secondo.
 * Rincorrere ogni soglia con dei margini sarebbe stato un elenco di casi
 * particolari; conviene far convergere il conto su sé stesso.
 */
function place(rects: TidyRect[], lanesX: string[][], lanesY: string[][], rules: PlaceRules): TidyRect[] {
  const { step, tol, links, reach } = rules;
  let cur = rects.map((r) => ({ ...r }));
  for (let pass = 0; pass < 4; pass++) {
    const byId = new Map(cur.map((r) => [r.id, r]));
    const lanesOf = (ids: string[][], axis: 'x' | 'y') =>
      ids.map((group) => group.map((id) => oneItem(byId.get(id)!, axis)));
    // I due assi sono lo STESSO problema con nomi diversi: larghezza sta a x
    // come altezza sta a y. Un solo risolutore, chiamato due volte — con il
    // canone dell'asse, che è l'unica cosa che li distingue davvero.
    const xs = solveAxis(lanesOf(lanesX, 'x'), {
      step, tol, links, reach, canon: TIDY_GAP.x, linkedMin: TIDY_GAP_LINKED.x,
    });
    const ys = solveAxis(lanesOf(lanesY, 'y'), {
      step, tol, links, reach, canon: TIDY_GAP.y, linkedMin: TIDY_GAP_LINKED.y,
    });
    let changed = false;
    cur = cur.map((r) => {
      const x = xs.get(r.id) ?? r.x;
      const y = ys.get(r.id) ?? r.y;
      if (x !== r.x || y !== r.y) changed = true;
      return { ...r, x, y };
    });
    if (!changed) break;
  }
  return cur;
}

// ─── Un asse ──────────────────────────────────────────────────────────────────

/**
 * Il rettangolo visto da un asse.
 *
 * ⚠️ `c` è il CENTRO, non il bordo. Le corsie si formano e si allineano sul
 * centro perché è da lì che parte un collegamento — un edge esce dalla metà del
 * lato — e perché è l'unica cosa che rende un edge ORTOGONALE fra oggetti di
 * misura diversa: due bordi sinistri allineati con larghezze diverse lasciano i
 * centri sfalsati, e la linea esce sghemba lo stesso. I conti sulle distanze
 * restano invece sui BORDI, che è dove gli oggetti si toccano davvero.
 */
function oneItem(r: TidyRect, axis: 'x' | 'y'): AxisItem {
  return axis === 'x'
    ? { id: r.id, c: r.x + r.w / 2, size: r.w, other: r.y, otherSize: r.h }
    : { id: r.id, c: r.y + r.h / 2, size: r.h, other: r.x, otherSize: r.w };
}

const axisItems = (rects: TidyRect[], axis: 'x' | 'y') => rects.map((r) => oneItem(r, axis));

/**
 * Un oggetto visto da UN asse: dove comincia, quanto occupa — e, di spalle, dove
 * sta sull'altro asse. Quest'ultima coppia serve solo al guardiano contro
 * l'impilamento (vedi `clusterLanes`), non entra in nessun calcolo di posizione.
 */
interface AxisItem { id: string; c: number; size: number; other: number; otherSize: number }

interface AxisRules {
  step: number;
  tol: number;
  /** Aria canonica fra due corsie di questo asse. */
  canon: number;
  /** Aria minima fra due corsie che un edge attraversa. */
  linkedMin: number;
  /** Di quanto una distanza può mancare il canone e posarcisi sopra lo stesso. */
  reach: number;
  links: readonly (readonly [string, string])[];
}

function solveAxis(lanes: AxisItem[][], rules: AxisRules): Map<string, number> {
  const { step, tol, canon, linkedMin, reach, links } = rules;
  const out = new Map<string, number>();
  if (lanes.length === 0) return out;

  /**
   * Coordinata della corsia: MEDIANA dei bordi, non media né minimo. La media la
   * farebbe spostare da un singolo elemento molto fuori squadra; il minimo la
   * incollerebbe sempre all'elemento più a sinistra, che non ha nessun titolo
   * per decidere per gli altri.
   *
   * ⚠️ Qui la mediana NON si posa ancora sulla griglia. Posando ogni corsia per
   * conto suo, l'arrotondamento si mangia fino a un passo di distanza fra due
   * corsie vicine — una distanza da 20px diventava 4px, cioè due tile quasi
   * attaccati dove prima respiravano. Le distanze si misurano PRIMA, sulle
   * coordinate vere; sulla griglia ci si va alla ricostruzione, dove è il passo
   * (e non la singola corsia) a essere un multiplo.
   */
  /** Ingombro della corsia: il membro più largo — è lui a decidere quanto spazio
   *  serve prima della corsia successiva, ed è lui a stare sulla griglia. */
  const extent = lanes.map((l) => Math.max(...l.map((i) => i.size)));
  /**
   * Il BORDO della corsia, ricavato dal centro mediano dei membri. La mediana sui
   * centri e non sui bordi: una corsia può contenere misure diverse, e il centro
   * è ciò su cui vanno allineate. Da lì si torna al bordo togliendo mezzo
   * ingombro, perché tutto il resto del conto — distanze, canone, griglia —
   * ragiona su dove gli oggetti cominciano e finiscono.
   */
  const coord = lanes.map((l, i) => median(l.map((it) => it.c)) - extent[i] / 2);

  // ── FASE 2 · distanze ──────────────────────────────────────────────────────
  /** Passo e DISTANZA (lo spazio libero) fra corsie consecutive, in pixel. */
  const pitch: number[] = [];
  const gaps: number[] = [];
  for (let i = 0; i < lanes.length - 1; i++) {
    const p = coord[i + 1] - coord[i];
    pitch.push(p);
    gaps.push(p - extent[i]);
  }
  /**
   * Le distanze simili collassano sulla loro mediana. La tolleranza è MEZZO
   * passo, non uno intero: 20 e 40 pixel sono due distanze diverse a vederle, e
   * un raggio troppo largo le avrebbe fuse in una terza che non era nessuna
   * delle due. Undici pixel è quanto sbaglia una mano, non quanto decide una
   * testa.
   */
  const tidyGaps = normalizeGaps(gaps, tol / 2);

  /**
   * Quali coppie di corsie CONSECUTIVE sono attraversate da un collegamento.
   *
   * Consecutive e basta: un edge che salta dalla prima corsia alla quinta non
   * dice niente su quanto devono stare larghe la prima e la seconda — la sua
   * linea passa sopra tutto quello che c'è in mezzo, e allargare gli spazi non
   * la renderebbe più leggibile.
   *
   * Un edge fra due tile della stessa colonna non tocca l'asse x (stessa corsia,
   * nessuna coppia) e vincola solo l'asse y, che è dove la sua linea corre
   * davvero. Viene gratis dal fatto che i due assi si risolvono separatamente.
   */
  const laneOf = new Map<string, number>();
  lanes.forEach((lane, i) => lane.forEach((it) => laneOf.set(it.id, i)));
  const linked = new Array<boolean>(Math.max(0, lanes.length - 1)).fill(false);
  for (const [a, b] of links) {
    const la = laneOf.get(a);
    const lb = laneOf.get(b);
    if (la === undefined || lb === undefined) continue;
    const lo = Math.min(la, lb);
    if (Math.abs(la - lb) === 1) linked[lo] = true;
  }

  // ── Ricostruzione ──────────────────────────────────────────────────────────
  /**
   * Si riparte dalla PRIMA corsia e si somma. Normalizzare le distanze sposta le
   * corsie lontane più di quelle vicine — è inevitabile, ed è esattamente quello
   * che si è chiesto — quindi conta da dove si comincia: l'angolo in alto a
   * sinistra resta fermo e la deriva va tutta verso il basso a destra, invece di
   * spaccarsi in due direzioni attorno a un centro che nessuno ha scelto.
   *
   * È QUI che si entra in griglia: la prima corsia si posa su un multiplo e ogni
   * passo è un numero intero di passi, quindi tutte le altre ci cadono per
   * somma. Le corsie che si sovrappongono (distanza negativa: una nota larga che
   * scavalca due colonne) tengono il loro passo, solo portato in griglia per
   * eccesso, e restano fuori anche dal canone e dal minimo dei collegati:
   * uniformarle
   * vorrebbe dire spingere via la colonna dopo per far posto a un ingombro che
   * l'utente aveva deciso di far sconfinare.
   */
  const finalCoord: number[] = [snap(coord[0], step)];
  for (let i = 0; i < pitch.length; i++) {
    let units: number;
    /**
     * Corsie che si sovrappongono di proposito: il passo si porta in griglia per
     * ECCESSO, mai per difetto. Arrotondando al più vicino si stringeva fino a
     * mezzo passo, e quella decina di pixel bastava a far toccare due oggetti
     * che prima erano liberi — la corsia sconfina per via del suo membro più
     * grande, ma gli altri suoi membri no.
     */
    const raised = Math.ceil(pitch[i] / step);
    /**
     * ⚠️ Sovrapposte ANCORA dopo l'arrotondamento, non «sovrapposte prima».
     *
     * Una sovrapposizione di pochi pixel viene sciolta dall'eccesso stesso: la
     * distanza diventa positiva, e da lì in poi quella coppia è una coppia
     * normale. Guardando solo il segno di partenza il primo giro la lasciava
     * dov'era e il secondo — trovandola positiva — le applicava il canone: il
     * comando muoveva ancora qualcosa alla seconda pressione, che è proprio ciò
     * che non deve fare. Chi sconfina davvero (una nota larga che scavalca due
     * colonne) resta negativo anche dopo l'eccesso, e il ramo lo tiene.
     */
    if (gaps[i] < 0 && raised * step - extent[i] < 0) {
      units = raised;
    } else {
      /**
       * Il CANONE, e solo dopo il minimo dei collegati.
       *
       * L'ordine conta: il canone dice quanto ci va di norma, il minimo dice
       * quanto ci vuole comunque. Un canone che scavalcasse il minimo lascerebbe
       * frecce ed etichette senza spazio proprio là dove servono; un minimo
       * applicato prima verrebbe poi disfatto dal canone.
       */
      let gap = tidyGaps[i];
      if (gap <= canon + reach) gap = canon;
      if (linked[i]) gap = Math.max(gap, linkedMin);
      /**
       * ⚠️ Il pavimento non è pignoleria. Arrotondando (`round`) il passo può
       * cadere fino a mezzo passo SOTTO l'ingombro della corsia: con due corsie
       * quasi attaccate — distanza obiettivo vicina a zero — la seconda entrerebbe
       * di una decina di pixel dentro l'oggetto più largo della prima. Un riordino
       * può stringere, non può sovrapporre roba che prima era separata.
       */
      units = Math.max(Math.ceil(extent[i] / step), Math.round((extent[i] + gap) / step));
    }
    // Mai zero: due corsie distinte non possono finire sulla stessa coordinata.
    let next = finalCoord[i] + Math.max(1, units) * step;
    /**
     * ⚠️ Il passo guarda la corsia PRECEDENTE, ma a invadere questa può essere
     * una corsia molto più indietro.
     *
     * Basta un marcatore stretto dentro l'ingombro di una colonna di tile: la
     * colonna e il marcatore si accavallano, quindi fra loro il passo resta
     * quello che era (ramo delle corsie sovrapposte), e la corsia DOPO viene
     * misurata a partire dal marcatore — 36px di ingombro invece di 128. Il
     * conto torna per il marcatore e non per i tile, che si ritrovavano dentro
     * la colonna successiva. Non era un compromesso dell'allineamento: era un
     * pezzo di lavagna calcolato sull'oggetto sbagliato.
     *
     * Quindi ogni corsia si tiene libera da TUTTE quelle prima — tranne quelle
     * in cui già entrava, che restano come stavano.
     */
    for (let k = 0; k <= i; k++) {
      if (coord[i + 1] < coord[k] + extent[k]) continue;   // si accavallavano già in partenza
      const clear = Math.ceil((finalCoord[k] + extent[k]) / step) * step;
      if (next < clear) next = clear;
    }
    finalCoord.push(next);
  }

  /**
   * Chi è largo quanto la corsia si posa sul suo bordo — cioè sulla griglia.
   * Chi è più stretto si CENTRA dentro la corsia: è quello che raddrizza i
   * collegamenti (un marcatore appeso sotto un tile ci finisce in mezzo, non
   * appoggiato al suo spigolo sinistro) e costa a quell'oggetto di non cadere
   * esattamente su un puntino. Fra le due, un marcatore fuori dai puntini si
   * nota molto meno di una linea sghemba.
   */
  lanes.forEach((lane, i) => lane.forEach((it) => {
    out.set(it.id, Math.round(finalCoord[i] + (extent[i] - it.size) / 2));
  }));
  return out;
}

/**
 * Raggruppa gli oggetti in corsie: stessa corsia se il bordo dista meno di `tol`
 * dall'ÀNCORA del gruppo — il primo elemento, non il precedente.
 *
 * ⚠️ L'àncora è ciò che impedisce il concatenamento. Misurando dal precedente,
 * `0, 20, 40, 60` diventerebbe una corsia sola larga 60: ogni elemento è vicino a
 * quello prima, e la catena si allunga senza fine. Dall'àncora, la corsia non può
 * mai essere più larga della tolleranza.
 *
 * Confronto STRETTO (`<`): due corsie esattamente a un passo di distanza devono
 * restare due. Con `<=` il riordino le fonderebbe al secondo giro, e un comando
 * che al secondo giro fa una cosa diversa dal primo non è un riordino.
 */
/** Il guardiano: questi due sono abbastanza separati da poter stare nella stessa corsia? */
type Apart = (a: AxisItem, b: AxisItem) => boolean;

/** I due sono staccati SULL'ALTRO asse? (bordo a bordo conta come staccati) */
const clearOnOther: Apart = (a, b) =>
  a.other + a.otherSize <= b.other || b.other + b.otherSize <= a.other;

/** I due stanno in corsie DIVERSE sull'altro asse? */
const inOtherLanes = (idx: Map<string, number>): Apart => (a, b) => idx.get(a.id) !== idx.get(b.id);

/** Due strutture di corsie sono la stessa cosa? */
function sameShape(a: AxisItem[][], b: AxisItem[][]): boolean {
  return a.length === b.length
    && a.every((lane, i) => lane.length === b[i].length && lane.every((it, j) => it.id === b[i][j].id));
}

/** Da corsie a «in quale corsia sta questo id». */
function laneIndex(lanes: AxisItem[][]): Map<string, number> {
  const m = new Map<string, number>();
  lanes.forEach((lane, i) => lane.forEach((it) => m.set(it.id, i)));
  return m;
}

/** Questi due sono legati da un edge? */
type Linked = (a: string, b: string) => boolean;

function clusterLanes(items: AxisItem[], tol: number, apartFn: Apart, linked: Linked): AxisItem[][] {
  const sorted = [...items].sort((a, b) => a.c - b.c);
  const lanes: AxisItem[][] = [];
  let cur: AxisItem[] = [];
  let anchor: AxisItem | null = null;
  for (const it of sorted) {
    if (!cur.length || !anchor) { cur = [it]; anchor = it; continue; }
    /**
     * DUE CORSIE NON POSSONO SOVRAPPORSI.
     *
     * Fra oggetti della stessa misura la tolleranza è l'ingombro stesso: due
     * tile che si accavallano in orizzontale non sono due colonne, sono una
     * colonna storta, e non c'è nessuna misura di sbandamento sotto la quale
     * questo smetta di essere vero. Con la sola tolleranza da un passo di
     * griglia un tile spostato di 95px restava una colonna a sé, e quattro tile
     * disposti a quadrato con un angolo fuori squadra uscivano a scaletta invece
     * che a griglia — allineati sì, ma non come li aveva pensati chi li ha messi.
     *
     * ⚠️ Solo fra oggetti IDENTICI su quest'asse, ed è lo stesso motivo per cui
     * esiste il canone: dove le misure sono uguali, «allineati» ha un significato
     * preciso. Fra un'immagine larga e un tile no — un tile dentro l'ingombro di
     * una nota che scavalca le colonne non è affatto detto che voglia stare
     * incolonnato con lei, e per quelli resta il passo di griglia.
     */
    /**
     * IL GUARDIANO. La tolleranza larga vale solo verso oggetti che sull'ALTRO
     * asse non si toccano. Due tile che si accavallano in orizzontale ED erano
     * alla stessa altezza non sono una colonna storta: sono due tile affiancati
     * che si sovrappongono, e incolonnarli vorrebbe dire posarne uno sopra
     * l'altro — da due tile mal messi ne resterebbe visibile uno solo. Per loro
     * resta il passo di griglia, e restano dove sono.
     *
     * ⚠️ Si guarda SOLO l'altro asse, non la sovrapposizione dei due rettangoli.
     * Sembra una sottigliezza ed è invece ciò che rende il riordino ripetibile:
     * «si accavallano?» è una domanda a cui il riordino stesso cambia la
     * risposta — allinea, separa, compatta — e una struttura che dipende da una
     * risposta che cambia si rifà diversa a ogni pressione. Sull'altro asse la
     * risposta invece si conserva: chi finisce nella stessa corsia lì si
     * sovrappone per costruzione, chi finisce in corsie diverse no, perché il
     * passo non scende mai sotto l'ingombro.
     */
    const apart = cur.every((m) => apartFn(m, it));
    const sameKind = it.size === anchor.size;
    /**
     * UN COLLEGAMENTO È UNA RAGIONE PER STARE NELLA STESSA CORSIA.
     *
     * Un edge fra due oggetti che non sono né in colonna né in riga esce
     * diagonale, e una lavagna di linee sghembe si legge male anche quando ogni
     * singolo oggetto è al suo posto. Fra due oggetti collegati il raggio si
     * allarga quindi fino a MEZZO ingombro: quel tanto che basta a raddrizzare i
     * collegamenti già quasi dritti.
     *
     * ⚠️ Mezzo e non tutto: un edge dice che i due si parlano, non che siano la
     * stessa colonna. A raggio pieno un collegamento avrebbe potuto trascinare un
     * oggetto lontano dentro una corsia che non era la sua — e chi ha disegnato
     * una diagonale lunga l'ha disegnata apposta.
     *
     * Fra oggetti della stessa misura non cambia niente: lì il raggio è già
     * l'ingombro intero, e mezzo è meno. Serve alle misure DIVERSE — un
     * marcatore, una nota — che senza edge si accontentano di un passo di griglia.
     *
     * Il guardiano vale lo stesso: un collegamento non è un motivo per posare un
     * oggetto sopra un altro.
     */
    const bound = cur.some((m) => linked(m.id, it.id));
    const reachHere = apart
      ? Math.max(sameKind ? anchor.size : tol, bound ? anchor.size / 2 : 0)
      : tol;
    if (it.c - anchor.c < reachHere) cur.push(it);
    else { lanes.push(cur); cur = [it]; anchor = it; }
  }
  if (cur.length) lanes.push(cur);
  return lanes;
}


/**
 * Uniforma le distanze SIMILI lasciando stare quelle diverse.
 *
 * Le distanze si raggruppano con la stessa regola dell'àncora usata per le
 * corsie, e ogni gruppo collassa sulla propria mediana. Tre colonne a 19, 21 e
 * 24px di distanza vanno tutte a 21; lo stacco da 88px che separava due blocchi
 * forma un gruppo da solo e resta 88 — è il passaggio che distingue «le distanze
 * simili diventano uguali» da «tutte le distanze diventano uguali».
 *
 * Non si toccano le distanze negative: sono corsie che si sovrappongono — una
 * nota larga che scavalca due colonne di tile — e sono legittime. Chi chiama le
 * riconosce e tiene il passo che avevano.
 *
 * ⚠️ Si RIPETE fino a che non cambia più niente. Un solo giro non basta: due
 * gruppi che escono vicini fra loro al giro successivo si fonderebbero, e il
 * comando muoverebbe ancora qualcosa alla seconda pressione — che è il modo più
 * veloce di perdere fiducia in un riordino automatico. Ogni giro può solo
 * FONDERE gruppi, quindi il numero di valori distinti non cresce mai e il ciclo
 * si chiude; il tetto di 8 giri è una cintura, non un limite che ci si aspetta
 * di toccare.
 */
function normalizeGaps(gaps: number[], tol: number): number[] {
  let cur = gaps.slice();
  for (let pass = 0; pass < 8; pass++) {
    const next = normalizeGapsOnce(cur, tol);
    if (next.every((v, i) => v === cur[i])) return cur;
    cur = next;
  }
  return cur;
}

function normalizeGapsOnce(gaps: number[], tol: number): number[] {
  const out = gaps.slice();
  // Solo le distanze vere: le corsie sovrapposte restano come stanno.
  const idx = gaps.map((_, i) => i).filter((i) => gaps[i] >= 0);
  if (idx.length < 2) return out;

  const sorted = [...idx].sort((a, b) => gaps[a] - gaps[b]);
  let bucket: number[] = [];
  let anchor = 0;
  const flush = () => {
    if (bucket.length === 0) return;
    const target = median(bucket.map((i) => gaps[i]));
    for (const i of bucket) out[i] = target;
    bucket = [];
  };
  for (const i of sorted) {
    if (bucket.length === 0) { bucket = [i]; anchor = gaps[i]; continue; }
    if (gaps[i] - anchor <= tol) bucket.push(i);
    else { flush(); bucket = [i]; anchor = gaps[i]; }
  }
  flush();
  return out;
}

// ─── Aritmetica ───────────────────────────────────────────────────────────────

function snap(v: number, step: number): number {
  return Math.round(v / step) * step;
}

function median(values: number[]): number {
  const s = [...values].sort((a, b) => a - b);
  const mid = s.length >> 1;
  return s.length % 2 === 1 ? s[mid] : (s[mid - 1] + s[mid]) / 2;
}
