'use client';

/**
 * Gimmick · Obsidian — Ask Gimmick (chat).
 *
 * Bito-led assistant chat: user/bot bubbles, an inline tile-result card with a
 * confirm row, suggestion chips and a composer. Reference: GimmickAsk.dc.html.
 * Reuses the Button primitive; colors from tokens / the type scale.
 */
import * as React from 'react';
import { IconCheck } from '@tabler/icons-react';
import { Button } from '@/components/primitives';
import { Beniamino } from '@/components/mascot';
import { Icon } from '@/components/shell';

function UserMsg({ children }: { children: React.ReactNode }) {
  return <div className="ob-ask__user">{children}</div>;
}

function BotMsg({ children }: { children: React.ReactNode }) {
  return (
    <div className="ob-ask__bot">
      <span className="ob-ask__bot-avatar"><Beniamino name="bito" size={24} title="" /></span>
      <div className="ob-ask__bot-col">{children}</div>
    </div>
  );
}

function Bubble({ children }: { children: React.ReactNode }) {
  return <div className="ob-ask__bubble">{children}</div>;
}

function TileResult() {
  return (
    <div className="ob-ask__result">
      <div className="ob-ask__result-top">
        <span className="ob-ask__result-time">Oggi · 16:00</span>
        <span className="ob-ask__result-title">Call Marco</span>
      </div>
      <div className="ob-ask__result-desc">Brief Teleport · evento creato dalla nota vocale di stamattina.</div>
      <div className="ob-ask__result-foot">
        <div className="ob-ask__result-caps">
          <span className="ob-ask__cap" style={{ ['--cap-c' as string]: 'var(--ob-type-voice)' }}><Icon name="voice" size={11} /></span>
          <span className="ob-ask__cap" style={{ ['--cap-c' as string]: 'var(--ob-type-text)' }}><Icon name="text" size={11} /></span>
        </div>
        <div style={{ flex: 1 }} />
        <span className="ob-ask__result-tag">
          <span className="ob-ask__result-tag-icon"><Icon name="tags" size={12} /></span>GDS
        </span>
      </div>
    </div>
  );
}

function ConfirmRow() {
  return (
    <div className="ob-ask__confirm">
      <Button variant="primary" size="sm" icon={<IconCheck size={13} stroke={2} />}>Conferma</Button>
      <Button variant="secondary" size="sm">Modifica</Button>
    </div>
  );
}

const SUGGESTIONS = ['Riepilogo di oggi', 'Cosa scade?', 'Spark non smistati', 'Crea evento'];

export function AskView() {
  return (
    <div className="ob-ask">
      {/* Header */}
      <div className="ob-ask__header">
        <span className="ob-ask__header-mascot"><Beniamino name="bito" size={28} title="" /></span>
        <div>
          <div className="ob-ask__header-title">Ask Gimmick</div>
          <div className="ob-ask__header-sub">Bito conosce tutti i tuoi tile e spark</div>
        </div>
        <div style={{ flex: 1 }} />
        <Button variant="secondary" size="sm" icon={<Icon name="plus" size={14} />}>Nuova chat</Button>
      </div>

      {/* Thread */}
      <div className="ob-ask__thread ob-scroll">
        <div className="ob-ask__thread-inner">
          <BotMsg><Bubble>Ciao Ruslan. Hai 5 tile per oggi e 4 spark nel buffer. Da dove partiamo?</Bubble></BotMsg>
          <UserMsg>Trasforma la nota vocale di stamattina in un evento per la call con Marco alle 16.</UserMsg>
          <BotMsg>
            <Bubble>Fatto. Ho letto il memo e creato questo evento — lo confermi?</Bubble>
            <TileResult />
            <ConfirmRow />
          </BotMsg>
          <UserMsg>Perfetto. E cosa scade questa settimana?</UserMsg>
          <BotMsg><Bubble>Una sola scadenza: il certificato Aruba, lunedì 30/06. Vuoi che ti ricordi domenica sera?</Bubble></BotMsg>
        </div>
      </div>

      {/* Suggestions */}
      <div className="ob-ask__suggestions">
        {SUGGESTIONS.map((s) => (
          <button key={s} type="button" className="ob-ask__sugg">
            <span className="ob-ask__sugg-icon"><Icon name="sparkles" size={12} /></span>{s}
          </button>
        ))}
      </div>

      {/* Composer */}
      <div className="ob-ask__input">
        <div className="ob-ask__input-bar">
          <button type="button" className="ob-ask__input-icon" aria-label="Allega"><Icon name="file" size={16} /></button>
          <input className="ob-ask__input-field" placeholder="Chiedi a Gimmick, o incolla qualcosa…" />
          <button type="button" className="ob-ask__input-icon" aria-label="Dettatura"><Icon name="voice" size={16} /></button>
          <button type="button" className="ob-ask__send" aria-label="Invia"><Icon name="send" size={17} /></button>
        </div>
      </div>
    </div>
  );
}
