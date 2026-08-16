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
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { IconCheck } from '@tabler/icons-react';
import { Button } from '@/components/primitives';
import { Beniamino } from '@/components/mascot';
import { Icon } from '@/components/shell';
import type { AskMessage } from '@/store/chat-store';

export type { AskMessage };

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

/**
 * Le risposte di Claude arrivano in Markdown: elenchi, grassetti e tabelle
 * restavano a vista come asterischi e trattini. Reso con le stesse librerie del
 * MarkdownPreview (già in dipendenza), stilato stretto dentro la bolla — vedi
 * `.ob-ask__md` in obsidian-ask.css.
 */
function BotMarkdown({ children }: { children: string }) {
  return (
    <div className="ob-ask__md">
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        components={{
          // Il pannello è un overlay: un link che ci naviga dentro lo farebbe
          // sparire insieme alla conversazione.
          a: ({ ...props }) => <a {...props} target="_blank" rel="noopener noreferrer" />,
        }}
      >
        {children}
      </ReactMarkdown>
    </div>
  );
}

/** Secondi → m:ss, per il contatore della registrazione. */
function fmtElapsed(s: number) {
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
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

  /** Allegato in attesa: parte col prossimo messaggio, uno per turno. */
  attachmentName?: string | null;
  onAttach?: (file: File) => void;
  onRemoveAttachment?: () => void;

  /** Registrazione vocale (→ `/api/chat/voice`). */
  recording?: boolean;
  recordingElapsed?: number;
  voiceError?: string;
  onStartRecording?: () => void;
  onStopRecording?: () => void;
  onCancelRecording?: () => void;

  /** Lettura ad alta voce di una risposta (→ `/api/chat/tts`). */
  onSpeak?: (index: number) => void;
  speakingIndex?: number | null;

  onClear?: () => void;
}

export function AskView({
  messages, input, onInput, onSend, isLoading, suggestions = DEFAULT_SUGGESTIONS,
  onSuggestion, onSparkFilter, onTileFilter,
  attachmentName, onAttach, onRemoveAttachment,
  recording, recordingElapsed = 0, voiceError, onStartRecording, onStopRecording, onCancelRecording,
  onSpeak, speakingIndex,
  onClear,
}: AskViewProps = {}) {
  const live = messages !== undefined;
  const fileRef = React.useRef<HTMLInputElement>(null);
  const threadRef = React.useRef<HTMLDivElement>(null);

  // Il thread cresce dal basso: senza questo, ogni risposta lunga finisce fuori
  // schermo e va inseguita a mano.
  React.useEffect(() => {
    if (!live) return;
    const el = threadRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [live, messages, isLoading]);

  const busy = !!isLoading || !!recording;

  // Niente header: c'era una fascia con mascotte, titolo, sottotitolo e "Nuova
  // chat", ma il pannello è già identificato dal pulsante che lo apre. La
  // chiusura vive in `AskPanel` (ask-live.tsx) come controllo flottante; lo
  // svuota-chat è nel compositore, accanto alle altre azioni del turno, come sul
  // mobile.
  return (
    <div className="ob-ask">
      {/* Thread */}
      <div className="ob-ask__thread ob-scroll" ref={threadRef}>
        <div className="ob-ask__thread-inner">
          {live ? (
            <>
              {messages!.length === 0 && (
                <BotMsg><Bubble>Ciao! Chiedimi qualcosa sui tuoi tile e spark.</Bubble></BotMsg>
              )}
              {messages!.map((m, i) =>
                m.role === 'user' ? (
                  <UserMsg key={i}>
                    {m.attachmentName && (
                      <span className="ob-ask__user-attach">
                        <Icon name="file" size={12} />{m.attachmentName}
                      </span>
                    )}
                    {m.content}
                  </UserMsg>
                ) : (
                  <BotMsg key={i}>
                    <Bubble><BotMarkdown>{m.content}</BotMarkdown></Bubble>
                    {/* Senza azioni la riga resterebbe un vuoto sotto la bolla:
                        `.ob-ask__bot-col` ha un gap fisso. */}
                    {(m.foundSparkIds?.length || m.foundTileIds?.length || onSpeak) ? (
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
                        {onSpeak && (
                          <button
                            type="button"
                            className="ob-ask__act"
                            onClick={() => onSpeak(i)}
                            aria-label={speakingIndex === i ? 'Interrompi la lettura' : 'Leggi ad alta voce'}
                            title={speakingIndex === i ? 'Interrompi' : 'Leggi ad alta voce'}
                          >
                            <Icon name={speakingIndex === i ? 'speakerOff' : 'speaker'} size={14} />
                          </button>
                        )}
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
          <button key={s} type="button" className="ob-ask__sugg" onClick={() => onSuggestion?.(s)} disabled={busy}>
            <span className="ob-ask__sugg-icon"><Icon name="sparkles" size={12} /></span>{s}
          </button>
        ))}
      </div>

      {/* Composer */}
      <div className="ob-ask__input">
        {attachmentName && (
          <div className="ob-ask__attach">
            <span className="ob-ask__attach-icon"><Icon name="file" size={13} /></span>
            <span className="ob-ask__attach-name" title={attachmentName}>{attachmentName}</span>
            <button type="button" className="ob-ask__attach-x" onClick={onRemoveAttachment} aria-label="Togli l'allegato">
              <Icon name="x" size={12} />
            </button>
          </div>
        )}
        {voiceError && <div className="ob-ask__voice-error">{voiceError}</div>}

        <div className="ob-ask__input-bar">
          {recording ? (
            <>
              <button type="button" className="ob-ask__input-icon" onClick={onCancelRecording} aria-label="Annulla la registrazione">
                <Icon name="x" size={16} />
              </button>
              <div className="ob-ask__rec">
                <span className="ob-ask__rec-dot" aria-hidden />
                Registrazione… {fmtElapsed(recordingElapsed)}
              </div>
              <button type="button" className="ob-ask__send" onClick={onStopRecording} aria-label="Invia il messaggio vocale" title="Invia">
                <Icon name="stop" size={15} />
              </button>
            </>
          ) : (
            <>
              <input
                ref={fileRef}
                type="file"
                hidden
                accept="image/jpeg,image/png,image/gif,image/webp,application/pdf,.docx,.txt,.md,.csv,.json,.log,.yml,.yaml,.xml,.html"
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  if (f) onAttach?.(f);
                  // Azzerato subito: senza, riselezionare lo STESSO file non
                  // scatenerebbe il change e l'allegato non tornerebbe.
                  e.target.value = '';
                }}
              />
              <button
                type="button"
                className="ob-ask__input-icon"
                aria-label="Allega un file"
                title="Allega un file"
                onClick={() => fileRef.current?.click()}
                disabled={!live || busy}
              >
                <Icon name="file" size={16} />
              </button>
              <input
                className="ob-ask__input-field"
                placeholder="Chiedi a Gimmick, o incolla qualcosa…"
                value={input ?? ''}
                onChange={(e) => onInput?.(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); onSend?.(); } }}
                disabled={!live}
              />
              {live && messages!.length > 0 && onClear && (
                <button
                  type="button"
                  className="ob-ask__input-icon"
                  aria-label="Svuota la conversazione"
                  title="Svuota la conversazione"
                  onClick={onClear}
                  disabled={busy}
                >
                  <Icon name="trash" size={16} />
                </button>
              )}
              <button
                type="button"
                className="ob-ask__input-icon"
                aria-label="Registra un messaggio vocale"
                title="Registra un messaggio vocale"
                onClick={onStartRecording}
                disabled={!live || busy}
              >
                <Icon name="voice" size={16} />
              </button>
              <button type="button" className="ob-ask__send" aria-label="Invia" onClick={onSend} disabled={busy}>
                <Icon name="send" size={17} />
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
