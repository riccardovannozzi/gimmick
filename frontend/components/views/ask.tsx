'use client';

/**
 * Gimmick · Obsidian — Ask Gimmick (chat).
 *
 * Bito-led assistant chat: user/bot bubbles, suggestion chips and a composer.
 * Reference: GimmickAsk.dc.html. Reuses the Button primitive; colors from
 * tokens / the type scale.
 *
 * Data-driven: passa `messages`/`input`/`onSend`/… per collegarla a `chatApi`
 * (vedi `ask-live.tsx`). Senza props rende il thread di design (anteprima).
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

// ─── Static demo blocks (preview route, no props) ─────────────────────────────
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

const DEFAULT_SUGGESTIONS = ['Riepilogo di oggi', 'Cosa scade?', 'Spark non smistati', 'Crea evento'];

export interface AskMessage {
  role: 'user' | 'assistant';
  content: string;
  foundSparkIds?: string[];
  foundTileIds?: string[];
}

export interface AskViewProps {
  /** Quando presente, rende il thread reale; altrimenti il demo di design. */
  messages?: AskMessage[];
  input?: string;
  onInput?: (v: string) => void;
  onSend?: () => void;
  isLoading?: boolean;
  suggestions?: string[];
  onSuggestion?: (s: string) => void;
  onSparkFilter?: (ids: string[]) => void;
  onTileFilter?: (ids: string[]) => void;
  onNewChat?: () => void;
  onClose?: () => void;
}

export function AskView({
  messages, input, onInput, onSend, isLoading, suggestions = DEFAULT_SUGGESTIONS,
  onSuggestion, onSparkFilter, onTileFilter, onNewChat, onClose,
}: AskViewProps = {}) {
  const live = messages !== undefined;

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
        <Button variant="secondary" size="sm" icon={<Icon name="plus" size={14} />} onClick={onNewChat}>Nuova chat</Button>
        {onClose && (
          <Button variant="ghost" size="sm" icon={<Icon name="chevR" size={15} />} onClick={onClose} aria-label="Chiudi" />
        )}
      </div>

      {/* Thread */}
      <div className="ob-ask__thread ob-scroll">
        <div className="ob-ask__thread-inner">
          {live ? (
            <>
              {messages!.length === 0 && (
                <BotMsg><Bubble>Ciao! Chiedimi qualcosa sui tuoi tile e spark.</Bubble></BotMsg>
              )}
              {messages!.map((m, i) =>
                m.role === 'user' ? (
                  <UserMsg key={i}>{m.content}</UserMsg>
                ) : (
                  <BotMsg key={i}>
                    <Bubble>{m.content}</Bubble>
                    {(m.foundSparkIds?.length || m.foundTileIds?.length) ? (
                      <div className="ob-ask__confirm">
                        {m.foundSparkIds?.length ? (
                          <Button variant="secondary" size="sm" icon={<Icon name="sparkles" size={13} />} onClick={() => onSparkFilter?.(m.foundSparkIds!)}>
                            Spark ({m.foundSparkIds.length})
                          </Button>
                        ) : null}
                        {m.foundTileIds?.length ? (
                          <Button variant="secondary" size="sm" icon={<Icon name="tiles" size={13} />} onClick={() => onTileFilter?.(m.foundTileIds!)}>
                            Tile ({m.foundTileIds.length})
                          </Button>
                        ) : null}
                      </div>
                    ) : null}
                  </BotMsg>
                ),
              )}
              {isLoading && <BotMsg><Bubble>…</Bubble></BotMsg>}
            </>
          ) : (
            <>
              <BotMsg><Bubble>Ciao Ruslan. Hai 5 tile per oggi e 4 spark nel buffer. Da dove partiamo?</Bubble></BotMsg>
              <UserMsg>Trasforma la nota vocale di stamattina in un evento per la call con Marco alle 16.</UserMsg>
              <BotMsg>
                <Bubble>Fatto. Ho letto il memo e creato questo evento — lo confermi?</Bubble>
                <TileResult />
                <ConfirmRow />
              </BotMsg>
              <UserMsg>Perfetto. E cosa scade questa settimana?</UserMsg>
              <BotMsg><Bubble>Una sola scadenza: il certificato Aruba, lunedì 30/06. Vuoi che ti ricordi domenica sera?</Bubble></BotMsg>
            </>
          )}
        </div>
      </div>

      {/* Suggestions */}
      <div className="ob-ask__suggestions">
        {suggestions.map((s) => (
          <button key={s} type="button" className="ob-ask__sugg" onClick={() => onSuggestion?.(s)}>
            <span className="ob-ask__sugg-icon"><Icon name="sparkles" size={12} /></span>{s}
          </button>
        ))}
      </div>

      {/* Composer */}
      <div className="ob-ask__input">
        <div className="ob-ask__input-bar">
          <button type="button" className="ob-ask__input-icon" aria-label="Allega"><Icon name="file" size={16} /></button>
          <input
            className="ob-ask__input-field"
            placeholder="Chiedi a Gimmick, o incolla qualcosa…"
            value={input ?? ''}
            onChange={(e) => onInput?.(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); onSend?.(); } }}
            disabled={!live}
          />
          <button type="button" className="ob-ask__input-icon" aria-label="Dettatura"><Icon name="voice" size={16} /></button>
          <button type="button" className="ob-ask__send" aria-label="Invia" onClick={onSend}><Icon name="send" size={17} /></button>
        </div>
      </div>
    </div>
  );
}
