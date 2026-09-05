import { describe, it, expect } from 'vitest';
import { subtaskToStep, subtaskBall, currentStep, stalenessFrom, cockpitLane, type StepRow } from '../tile-visual';

/**
 * Le due REGOLE DI LETTURA sopra i campi grezzi di un passo.
 *
 * Sono cinque righe in tutto, e i test non stanno qui perché siano complicate:
 * stanno qui perché sono FRAGILI ALLA SEMPLIFICAZIONE. Un `??` che diventa
 * `||`, due rami invertiti, e la regola cambia senso restando corretta a
 * vederla. Ognuno dei casi qui sotto è un modo in cui l'espressione può essere
 * riscritta "più pulita" e smettere di dire quel che deve.
 */

describe('subtaskToStep — `state` è una sovrastruttura su `is_done`', () => {
  it('senza stato, lo dice il booleano', () => {
    expect(subtaskToStep({ is_done: false, state: null })).toBe('pending');
    expect(subtaskToStep({ is_done: true, state: null })).toBe('done');
  });

  it('lo stato VINCE sul booleano', () => {
    // È tutto il punto del segmento rosso: un passo fermo non è "non ancora
    // fatto". E un passo spuntato che si porta dietro `blocked` resterebbe
    // rosso per sempre — per questo la PATCH lo impedisce in scrittura.
    expect(subtaskToStep({ is_done: false, state: 'blocked' })).toBe('blocked');
    expect(subtaskToStep({ is_done: true, state: 'blocked' })).toBe('blocked');
    expect(subtaskToStep({ is_done: false, state: 'cancelled' })).toBe('cancelled');
  });

  it('una riga senza niente è da fare', () => {
    // `??` e non `||`: con `||` uno `state` a stringa vuota cadrebbe sul ramo
    // sbagliato, e soprattutto la riga vuota deve restare `pending`.
    expect(subtaskToStep({})).toBe('pending');
  });
});

describe('subtaskBall — di chi è la mossa successiva', () => {
  const IO = 'self-contact-id';
  const LUI = 'altro-contatto-id';

  it('niente marcato, niente contatto: tocca a me', () => {
    expect(subtaskBall({}, IO)).toBe('mine');
    expect(subtaskBall({ is_theirs: false, contact_id: null }, IO)).toBe('mine');
  });

  it('un contatto che non sono io: tocca a te', () => {
    expect(subtaskBall({ is_theirs: false, contact_id: LUI }, IO)).toBe('theirs');
  });

  it('il contatto «io» vale come nessun contatto', () => {
    // Un passo assegnato a sé stessi tocca a sé stessi. È anche il motivo per
    // cui «io» non compare nel menu: sceglierlo lascerebbe il pulsante acceso
    // su una riga che si legge spenta.
    expect(subtaskBall({ is_theirs: false, contact_id: IO }, IO)).toBe('mine');
  });

  it('LA MARCATURA VINCE SUL CONTATTO', () => {
    // Il caso che fissa l'ordine dei rami. Chi ha premuto il pulsante ha detto
    // una cosa; un contatto rimasto attaccato da una vecchia migrazione non ha
    // detto niente. Invertire i rami farebbe scavalcare la seconda alla prima.
    expect(subtaskBall({ is_theirs: true, contact_id: IO }, IO)).toBe('theirs');
    expect(subtaskBall({ is_theirs: true, contact_id: null }, IO)).toBe('theirs');
  });

  it('finché la rubrica non è arrivata, un contatto vale «altri»', () => {
    // `selfContactId` arriva in modo asincrono. Per un fotogramma si può
    // sbagliare sul PROPRIO contatto: è il caso raro, e sbagliarlo pesa meno
    // che mostrare vuota una lista che piena lo è.
    expect(subtaskBall({ contact_id: LUI }, null)).toBe('theirs');
    expect(subtaskBall({ contact_id: IO }, undefined)).toBe('theirs');
  });

  it('i nulli del database non contano come marcatura', () => {
    // La colonna è `NOT NULL DEFAULT FALSE`, ma il tipo la ammette nulla: una
    // riga letta prima della migration non deve leggersi «tocca a te».
    expect(subtaskBall({ is_theirs: null, contact_id: null }, IO)).toBe('mine');
  });
});

// ─── IL PASSO CORRENTE ──────────────────────────────────────────────────────

/** Righe minime, con i default che il database garantisce. */
const step = (o: Partial<StepRow> & { id: string }): StepRow => ({
  is_done: false, state: null, sort_order: 0, created_at: '2026-01-01T00:00:00Z', ...o,
});

describe('currentStep — il primo che resta da fare', () => {
  it('checklist vuota, o tutti fatti: nessun passo corrente', () => {
    expect(currentStep([])).toBeNull();
    expect(currentStep([step({ id: 'a', is_done: true }), step({ id: 'b', is_done: true })])).toBeNull();
  });

  it('un passo annullato non conta mai: si salta al successivo', () => {
    // `cancelled` non è fatto e non è da fare. Se contasse come aperto, un flow
    // con un passo abbandonato in cima resterebbe fermo lì per sempre.
    const out = currentStep([
      step({ id: 'a', sort_order: 0, state: 'cancelled' }),
      step({ id: 'b', sort_order: 1 }),
    ]);
    expect(out?.id).toBe('b');
  });

  it('un passo FERMO invece è il corrente, non lo si salta', () => {
    // È semmai quello che ha più bisogno di essere guardato: saltarlo
    // nasconderebbe proprio i processi incagliati.
    const out = currentStep([
      step({ id: 'a', sort_order: 0, state: 'blocked' }),
      step({ id: 'b', sort_order: 1 }),
    ]);
    expect(out?.id).toBe('a');
  });

  it('a parità di sort_order l’esito è STABILE su input rimescolato', () => {
    // Il caso per cui l'ordinamento ha tre criteri. Con il solo `sort_order`
    // l'esito dipenderebbe dall'ordine in cui arrivano le righe, e lo stesso
    // tile mostrerebbe passi diversi a due caricamenti identici.
    const rows = [
      step({ id: 'zzz', sort_order: 3, created_at: '2026-03-01T00:00:00Z' }),
      step({ id: 'aaa', sort_order: 3, created_at: '2026-02-01T00:00:00Z' }),
      step({ id: 'mmm', sort_order: 3, created_at: '2026-02-01T00:00:00Z' }),
    ];
    const first = currentStep(rows)?.id;
    expect(first).toBe('aaa');
    expect(currentStep([...rows].reverse())?.id).toBe(first);
    expect(currentStep([rows[1], rows[2], rows[0]])?.id).toBe(first);
  });

  it('non altera l’array che riceve', () => {
    const rows = [step({ id: 'b', sort_order: 2 }), step({ id: 'a', sort_order: 1 })];
    currentStep(rows);
    expect(rows.map((r) => r.id)).toEqual(['b', 'a']);
  });
});

// ─── L'ANZIANITÀ ────────────────────────────────────────────────────────────

describe('stalenessFrom — da quando è fermo lì', () => {
  it('la data del passo se c’è, altrimenti quella di nascita', () => {
    expect(stalenessFrom({ occurred_at: '2026-05-01T00:00:00Z', created_at: '2026-01-01T00:00:00Z' }))
      .toBe('2026-05-01T00:00:00Z');
    expect(stalenessFrom({ occurred_at: null, created_at: '2026-01-01T00:00:00Z' }))
      .toBe('2026-01-01T00:00:00Z');
    expect(stalenessFrom({})).toBeNull();
  });

  it('IGNORA updated_at anche se glielo si passa', () => {
    // Il test esiste per fissare il divieto: `updated_at` si muove a ogni
    // correzione di refuso, e userebbe quella per dire da quanto una cosa è
    // ferma. È l'errore che si nota solo dopo mesi.
    const row = { created_at: '2026-01-01T00:00:00Z', updated_at: '2026-09-01T00:00:00Z' };
    expect(stalenessFrom(row)).toBe('2026-01-01T00:00:00Z');
  });
});

// ─── LE DUE LISTE ───────────────────────────────────────────────────────────

describe('cockpitLane — in quale lista finisce un flow', () => {
  const IO = 'self-id';

  it('senza passi aperti è concluso', () => {
    expect(cockpitLane({ closed: false, steps: [] }, IO)).toBe('closed');
    expect(cockpitLane({ closed: false, steps: [step({ id: 'a', is_done: true })] }, IO)).toBe('closed');
  });

  it('il TILE CHIUSO vince sui passi che restano aperti', () => {
    // Il caso anomalo che capita spesso: un processo si abbandona più di
    // quanto lo si concluda. Senza questo ramo un flow archiviato con tre passi
    // dentro continuerebbe a chiedere attenzione dopo che gli è stata tolta.
    expect(cockpitLane({ closed: true, steps: [step({ id: 'a', is_theirs: true })] }, IO)).toBe('closed');
  });

  it('la lista la decide il PASSO CORRENTE, non gli altri', () => {
    // Il secondo passo è di qualcun altro, ma non è lui il corrente: il flow
    // sta in «tocca a me» finché il primo non si chiude.
    const steps = [
      step({ id: 'a', sort_order: 0 }),
      step({ id: 'b', sort_order: 1, is_theirs: true }),
    ];
    expect(cockpitLane({ closed: false, steps }, IO)).toBe('mine');
  });

  it('marcato o assegnato ad altri: tocca a te', () => {
    expect(cockpitLane({ closed: false, steps: [step({ id: 'a', is_theirs: true })] }, IO)).toBe('theirs');
    expect(cockpitLane({ closed: false, steps: [step({ id: 'a', contact_id: 'altro' })] }, IO)).toBe('theirs');
  });

  it('assegnato a me stesso: tocca a me', () => {
    expect(cockpitLane({ closed: false, steps: [step({ id: 'a', contact_id: IO })] }, IO)).toBe('mine');
  });
});
