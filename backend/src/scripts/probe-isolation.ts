/**
 * probe-isolation.ts — la prova che un utente non vede i dati di un altro.
 *
 * `audit-ownership.ts` legge il codice; questa sonda lo mette alla prova. Sono
 * due verifiche diverse e servono entrambe: la prima trova le query scoperte
 * anche dove nessuno ha ancora provato a passare, la seconda dimostra che il
 * comportamento reale — attraverso HTTP, middleware, validazione — è quello
 * atteso. Una lettura del codice non è mai una dimostrazione.
 *
 * ─── Come funziona ──────────────────────────────────────────────────────────
 *
 * Crea due utenti, popola A (tile, spark, tag, contatto, subtask, canvas) e poi
 * col token di B tenta su ogni rotta le operazioni che toccano la roba di A.
 *
 * Atteso: **404** ovunque. Non 403 — un 403 confermerebbe che l'id esiste, e a
 * chi sonda a tentativi anche solo quello è un'informazione. Un 200 è un buco;
 * un 500 pure, perché vuol dire che la richiesta è arrivata fino al database.
 *
 * ⚠️ Scrive sul database configurato in `.env`: crea due utenti veri e li
 * cancella alla fine (anche se la sonda fallisce). Prima di lanciarla su un
 * database che non sia di sviluppo, pensarci.
 *
 * Uso:
 *   npm run dev                          # il backend deve girare
 *   npx tsx src/scripts/probe-isolation.ts
 */
import 'dotenv/config';

const API = process.env.PROBE_API_URL || `http://localhost:${process.env.PORT || 5000}`;

interface Session { token: string; userId: string; email: string; password: string }

const results: { name: string; status: number; ok: boolean; detail?: string }[] = [];

async function call(
  method: string,
  path: string,
  opts: { token?: string; body?: unknown } = {},
): Promise<{ status: number; json: any }> {
  const res = await fetch(`${API}${path}`, {
    method,
    headers: {
      'Content-Type': 'application/json',
      ...(opts.token ? { Authorization: `Bearer ${opts.token}` } : {}),
    },
    ...(opts.body !== undefined ? { body: JSON.stringify(opts.body) } : {}),
  });
  let json: any = null;
  try { json = await res.json(); } catch { /* risposta senza corpo */ }
  return { status: res.status, json };
}

/** Registra l'esito di un tentativo di B sulle risorse di A. */
function expectDenied(name: string, status: number): void {
  // 404 è l'unica risposta giusta. 401/403 sono "meno peggio" ma raccontano
  // qualcosa; 2xx è un buco aperto.
  const ok = status === 404;
  results.push({
    name,
    status,
    ok,
    detail: ok ? undefined : status < 300 ? 'PASSATO: la risorsa altrui è stata raggiunta' : `atteso 404, ricevuto ${status}`,
  });
}

async function signup(tag: string): Promise<Session> {
  const stamp = `${Date.now()}${Math.floor(Math.random() * 1000)}`;
  const email = `probe-${tag}-${stamp}@gimmick.test`;
  const password = `Probe!${stamp}`;
  const { status, json } = await call('POST', '/api/auth/signup', { body: { email, password } });
  const token = json?.data?.session?.access_token ?? json?.data?.access_token ?? json?.session?.access_token;
  const userId = json?.data?.user?.id ?? json?.user?.id;
  if (status >= 300 || !token || !userId) {
    throw new Error(`signup ${tag} fallito (${status}): ${JSON.stringify(json).slice(0, 300)}`);
  }
  return { token, userId, email, password };
}

async function seedUserA(a: Session) {
  const tile = (await call('POST', '/api/tiles', { token: a.token, body: { title: 'Tile della vittima' } })).json?.data;
  const spark = (await call('POST', '/api/sparks', {
    token: a.token,
    body: { type: 'text', content: 'contenuto riservato di A', tile_id: tile.id },
  })).json?.data;
  const tag = (await call('POST', '/api/tags', { token: a.token, body: { name: `probe-tag-${Date.now()}` } })).json?.data;
  const contact = (await call('POST', '/api/contacts', { token: a.token, body: { name: 'Contatto di A' } })).json?.data;
  const subtask = (await call('POST', '/api/subtasks', {
    token: a.token,
    body: { tile_id: tile.id, content: 'passo riservato' },
  })).json?.data;
  return { tile, spark, tag, contact, subtask };
}

async function main() {
  console.log(`Sonda di isolamento su ${API}\n`);

  // Il backend deve essere in ascolto: senza, ogni fetch fallisce e la sonda
  // "passerebbe" per il motivo sbagliato.
  try {
    await fetch(`${API}/api/auth/me`);
  } catch {
    console.error(`Backend non raggiungibile su ${API}. Avvia \`npm run dev\` e riprova.`);
    process.exit(2);
  }

  const a = await signup('a');
  const b = await signup('b');
  console.log(`utente A ${a.userId}\nutente B ${b.userId}\n`);

  try {
    const seed = await seedUserA(a);
    if (!seed.tile?.id || !seed.spark?.id) {
      throw new Error('seed di A incompleto: la sonda non proverebbe niente');
    }

    const T = seed.tile.id, S = seed.spark.id, G = seed.tag?.id, C = seed.contact?.id, K = seed.subtask?.id;

    // ── Lettura ──
    expectDenied('GET  /tiles/:id            (tile di A)', (await call('GET', `/api/tiles/${T}`, { token: b.token })).status);
    expectDenied('GET  /sparks/:id           (spark di A)', (await call('GET', `/api/sparks/${S}`, { token: b.token })).status);

    // ── Scrittura ──
    expectDenied('PATCH /tiles/:id           (rinomina il tile di A)', (await call('PATCH', `/api/tiles/${T}`, { token: b.token, body: { title: 'preso da B' } })).status);
    expectDenied('PATCH /sparks/:id          (riscrive lo spark di A)', (await call('PATCH', `/api/sparks/${S}`, { token: b.token, body: { content: 'preso da B' } })).status);
    if (K) expectDenied('PATCH /subtasks/:id        (passo di A)', (await call('PATCH', `/api/subtasks/${K}`, { token: b.token, body: { is_done: true } })).status);

    // ── Il caso che ha originato tutto: agganciare roba propria a un tile altrui ──
    expectDenied('POST /sparks (tile_id di A)  (spark di B dentro il tile di A)', (await call('POST', '/api/sparks', {
      token: b.token,
      body: { type: 'text', content: 'iniettato da B', tile_id: T },
    })).status);
    expectDenied('POST /subtasks (tile_id di A)', (await call('POST', '/api/subtasks', {
      token: b.token, body: { tile_id: T, content: 'passo iniettato' },
    })).status);

    // ── Tag: associare un tag altrui, o i propri tag a tile altrui ──
    if (G) {
      expectDenied('POST /tags/:id/tiles       (tag di A)', (await call('POST', `/api/tags/${G}/tiles`, { token: b.token, body: { tile_ids: [T] } })).status);
      expectDenied('PATCH /tags/:id            (rinomina il tag di A)', (await call('PATCH', `/api/tags/${G}`, { token: b.token, body: { name: 'preso' } })).status);
      expectDenied('DELETE /tags/:id/tiles/:t  (stacca il tag di A)', (await call('DELETE', `/api/tags/${G}/tiles/${T}`, { token: b.token })).status);
    }
    const bTag = (await call('POST', '/api/tags', { token: b.token, body: { name: `probe-b-${Date.now()}` } })).json?.data;
    if (bTag?.id) {
      expectDenied('POST /tags/:idB/tiles      (tag di B su tile di A)', (await call('POST', `/api/tags/${bTag.id}/tiles`, { token: b.token, body: { tile_ids: [T] } })).status);
    }

    if (C) expectDenied('PATCH /contacts/:id        (contatto di A)', (await call('PATCH', `/api/contacts/${C}`, { token: b.token, body: { name: 'preso' } })).status);

    // ── Canvas: la lavagna di un tag altrui ──
    if (G) {
      expectDenied('GET  /canvas/layout/:tagId (canvas di A)', (await call('GET', `/api/canvas/layout/${G}`, { token: b.token })).status);
      expectDenied('PUT  /canvas/groups/:tagId (sovrascrive i gruppi di A)', (await call('PUT', `/api/canvas/groups/${G}`, { token: b.token, body: { groups: [] } })).status);
    }

    // ── Cancellazioni: le più costose se passano ──
    expectDenied('DELETE /sparks/:id         (spark di A)', (await call('DELETE', `/api/sparks/${S}`, { token: b.token })).status);
    expectDenied('DELETE /tiles/:id          (tile di A)', (await call('DELETE', `/api/tiles/${T}`, { token: b.token })).status);

    // ── Controprova: dopo tutti i tentativi, la roba di A è ancora intatta? ──
    // Serve perché una rotta può rispondere 404 e aver comunque scritto: il
    // caso reale trovato in `DELETE /tiles/:id`, che falliva sul tile e nel
    // frattempo gli aveva già tolto i tag.
    const after = await call('GET', `/api/tiles/${T}`, { token: a.token });
    const intact = after.status === 200 && after.json?.data?.title === 'Tile della vittima';
    results.push({
      name: 'CONTROPROVA: il tile di A è intatto dopo i tentativi di B',
      status: after.status,
      ok: intact,
      detail: intact ? undefined : 'il tile di A risulta modificato o sparito',
    });

    const sparksAfter = await call('GET', `/api/sparks?tile_id=${T}`, { token: a.token });
    const sparkAlive = (sparksAfter.json?.data || []).some((s: { id: string }) => s.id === S);
    results.push({
      name: 'CONTROPROVA: lo spark di A è ancora al suo posto',
      status: sparksAfter.status,
      ok: sparkAlive,
      detail: sparkAlive ? undefined : 'lo spark di A è sparito',
    });
  } finally {
    // Pulizia in ogni caso: una sonda che lascia rifiuti si smette di lanciarla.
    for (const u of [a, b]) {
      const { status } = await call('DELETE', '/api/auth/account', { token: u.token, body: { password: u.password } });
      if (status >= 300) console.warn(`⚠️  utente ${u.email} NON cancellato (${status}) — rimuoverlo a mano`);
    }
  }

  console.log('─'.repeat(72));
  for (const r of results) {
    console.log(`${r.ok ? ' ok  ' : 'FALLITO'} ${String(r.status).padEnd(4)} ${r.name}${r.detail ? `\n         → ${r.detail}` : ''}`);
  }
  const failed = results.filter((r) => !r.ok);
  console.log('─'.repeat(72));
  console.log(`${results.length} prove · ${results.length - failed.length} superate · ${failed.length} fallite`);
  if (failed.length > 0) process.exit(1);
}

main().catch((err) => {
  console.error('Sonda interrotta:', err instanceof Error ? err.message : err);
  process.exit(2);
});
