/**
 * Flows — l'elenco dei tile-processo.
 *
 * Questa rotta ospitava il Flow Hub: l'inbox cross-tile dei nodi di
 * `flow_nodes`, filtrata per stato (done / wait / undo / stop) e alimentata da
 * `GET /api/flows/hub`. Quel modello è stato ritirato — un flow è un TILE con
 * `action_type = 'flow'`, e i suoi passi sono la checklist del tile — e con
 * esso l'endpoint: la schermata legacy interrogava una rotta che risponde 404,
 * quindi mostrava una lista vuota sotto quattro filtri senza sorgente.
 *
 * Resta il solo host della shell Obsidian, dove il tab Flows è ora la lista dei
 * tile di quel tipo. Diversamente dalle altre rotte dei tab, qui non c'è un
 * ramo legacy: non esiste più una seconda implementazione da preservare.
 */
import React from 'react';
import { ObsidianViewsTabHost } from '@/components/obsidian/ViewsTabHost';

export default function FlowsRoute() {
  return <ObsidianViewsTabHost view="flows" />;
}
