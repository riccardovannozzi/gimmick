'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  IconCamera,
  IconVideo,
  IconMicrophone,
  IconNote,
  IconPaperclip,
  IconPhoto,
  IconArrowLeft,
  IconArrowRight,
  IconBolt,
  IconLayoutGrid,
  IconCheck,
} from '@tabler/icons-react';
import { usePixelTheme } from '@/components/pixel';
import { MascotSprite } from '@/components/cards/mascot-sprite';
import { MASCOTS } from '@/lib/mascots';
import { settingsApi } from '@/lib/api';

const GIMMICK = MASCOTS.find((m) => m.id === 'gimmick')!;

interface CaptureBadge {
  icon: typeof IconCamera;
  label: string;
  /** Token path verso PixelTheme (es. `theme.cap.photo`). */
  color: 'photo' | 'video' | 'gallery' | 'text' | 'voice' | 'file';
}

const CAPTURES: CaptureBadge[] = [
  { icon: IconCamera,     label: 'Foto',  color: 'photo' },
  { icon: IconVideo,      label: 'Video', color: 'video' },
  { icon: IconMicrophone, label: 'Voce',  color: 'voice' },
  { icon: IconNote,       label: 'Testo', color: 'text' },
  { icon: IconPaperclip,  label: 'File',  color: 'file' },
  { icon: IconPhoto,      label: 'Gallery', color: 'gallery' },
];

const STEPS = ['Benvenuto', 'Cattura', 'Organizza', 'Pronti'] as const;

export default function WelcomePage() {
  const theme = usePixelTheme();
  const router = useRouter();
  const [step, setStep] = useState<number>(0);
  const [completing, setCompleting] = useState(false);

  const finish = async () => {
    setCompleting(true);
    // Best-effort: anche se il save fallisce, l'utente vede comunque la dashboard.
    // Il gating in dashboard layout legge questo flag al prossimo refresh.
    await settingsApi.set('onboarding_v1', { completed_at: new Date().toISOString() }).catch(() => null);
    router.replace('/');
  };

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: theme.bg1,
        padding: 16,
        zIndex: 100,
      }}
    >
      <div
        style={{
          width: '100%',
          maxWidth: 520,
          background: theme.surface,
          border: `2px solid ${theme.border}`,
          boxShadow: `${theme.shadowOffset}px ${theme.shadowOffset}px 0 ${theme.shadowColor}`,
        }}
      >
        {/* Step pills */}
        <div
          style={{
            display: 'flex',
            gap: 4,
            padding: 12,
            background: theme.surfaceVariant,
            borderBottom: `2px solid ${theme.border}`,
          }}
        >
          {STEPS.map((label, i) => (
            <div
              key={label}
              style={{
                flex: 1,
                height: 6,
                background: i <= step ? theme.accent : theme.surface,
                border: `2px solid ${theme.border}`,
              }}
              title={label}
            />
          ))}
        </div>

        {/* Body */}
        <div style={{ padding: 24, minHeight: 320, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 16 }}>
          {step === 0 && <StepWelcome theme={theme} />}
          {step === 1 && <StepCapture theme={theme} />}
          {step === 2 && <StepOrganize theme={theme} />}
          {step === 3 && <StepFinish theme={theme} />}
        </div>

        {/* Nav */}
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            gap: 8,
            padding: 14,
            background: theme.surfaceVariant,
            borderTop: `2px solid ${theme.border}`,
          }}
        >
          <button
            type="button"
            onClick={() => setStep((s) => Math.max(0, s - 1))}
            disabled={step === 0}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 6,
              padding: '8px 12px',
              background: theme.surface,
              color: theme.ink2,
              border: `2px solid ${theme.border}`,
              fontFamily: 'var(--font-pixel-head)',
              fontSize: 10,
              letterSpacing: '0.08em',
              textTransform: 'uppercase',
              cursor: step === 0 ? 'not-allowed' : 'pointer',
              opacity: step === 0 ? 0.4 : 1,
            }}
          >
            <IconArrowLeft size={12} />
            Indietro
          </button>

          <button
            type="button"
            onClick={() => {
              if (step === STEPS.length - 1) finish();
              else setStep((s) => s + 1);
            }}
            disabled={completing}
            className="px-press"
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 6,
              padding: '8px 14px',
              background: theme.accent,
              color: theme.onAccent,
              border: `2px solid ${theme.border}`,
              fontFamily: 'var(--font-pixel-head)',
              fontSize: 10,
              letterSpacing: '0.08em',
              textTransform: 'uppercase',
              cursor: completing ? 'not-allowed' : 'pointer',
              opacity: completing ? 0.6 : 1,
              boxShadow: `${theme.shadowOffset}px ${theme.shadowOffset}px 0 ${theme.shadowColor}`,
            }}
          >
            {step === STEPS.length - 1 ? (
              <>
                <IconCheck size={12} />
                Inizia
              </>
            ) : (
              <>
                Avanti
                <IconArrowRight size={12} />
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Step components ─────────────────────────────────────────────────────

function StepWelcome({ theme }: { theme: ReturnType<typeof usePixelTheme> }) {
  return (
    <>
      <div
        style={{
          width: 160, height: 160,
          background: theme.surfaceVariant,
          border: `2px solid ${theme.border}`,
          display: 'inline-flex',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <MascotSprite mascot={GIMMICK} cell={8} />
      </div>
      <h2
        style={{
          fontFamily: 'var(--font-pixel-head)',
          fontSize: 14,
          letterSpacing: '0.1em',
          textTransform: 'uppercase',
          color: theme.ink,
          margin: 0,
          textAlign: 'center',
        }}
      >
        Bip! Benvenuto in Gimmick
      </h2>
      <p style={{ fontFamily: 'var(--font-pixel-body)', fontSize: 13, color: theme.ink2, textAlign: 'center', margin: 0, lineHeight: 1.55, maxWidth: 380 }}>
        Io sono il tuo beniamino. In 30 secondi ti mostro come funziona l&apos;app.
      </p>
    </>
  );
}

function StepCapture({ theme }: { theme: ReturnType<typeof usePixelTheme> }) {
  return (
    <>
      <h2
        style={{
          fontFamily: 'var(--font-pixel-head)',
          fontSize: 12,
          letterSpacing: '0.1em',
          textTransform: 'uppercase',
          color: theme.ink,
          margin: 0,
          textAlign: 'center',
        }}
      >
        Cattura idee in qualunque formato
      </h2>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 10, width: '100%' }}>
        {CAPTURES.map(({ icon: Icon, label, color }) => {
          const bg = theme.cap[color];
          return (
            <div
              key={label}
              style={{
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                gap: 6,
                padding: 12,
                background: theme.surfaceVariant,
                border: `2px solid ${theme.border}`,
              }}
            >
              <div
                style={{
                  width: 36, height: 36,
                  background: bg,
                  border: `2px solid ${theme.border}`,
                  display: 'inline-flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <Icon size={18} style={{ color: theme.onAccent }} />
              </div>
              <span
                style={{
                  fontFamily: 'var(--font-pixel-head)',
                  fontSize: 9,
                  letterSpacing: '0.06em',
                  textTransform: 'uppercase',
                  color: theme.ink2,
                }}
              >
                {label}
              </span>
            </div>
          );
        })}
      </div>
      <p style={{ fontFamily: 'var(--font-pixel-body)', fontSize: 12, color: theme.ink3, textAlign: 'center', margin: 0, lineHeight: 1.55 }}>
        Foto, audio, testo, file. Tutto diventa uno <strong>Spark</strong>.
      </p>
    </>
  );
}

function StepOrganize({ theme }: { theme: ReturnType<typeof usePixelTheme> }) {
  return (
    <>
      <h2
        style={{
          fontFamily: 'var(--font-pixel-head)',
          fontSize: 12,
          letterSpacing: '0.1em',
          textTransform: 'uppercase',
          color: theme.ink,
          margin: 0,
          textAlign: 'center',
        }}
      >
        Si organizzano da soli
      </h2>
      <div
        style={{
          display: 'flex',
          gap: 12,
          alignItems: 'center',
          width: '100%',
          padding: 16,
          background: theme.surfaceVariant,
          border: `2px solid ${theme.border}`,
        }}
      >
        <div
          style={{
            flexShrink: 0,
            width: 64, height: 64,
            background: theme.cap.text,
            border: `2px solid ${theme.border}`,
            display: 'inline-flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <IconBolt size={28} style={{ color: theme.onAccent }} />
        </div>
        <div style={{ flex: 1 }}>
          <div style={{ fontFamily: 'var(--font-pixel-head)', fontSize: 10, letterSpacing: '0.08em', textTransform: 'uppercase', color: theme.ink, marginBottom: 4 }}>
            Tile = contenitore
          </div>
          <p style={{ fontFamily: 'var(--font-pixel-body)', fontSize: 12, color: theme.ink2, margin: 0, lineHeight: 1.5 }}>
            Ogni Spark vive dentro un Tile. Più Spark che parlano della stessa cosa formano una Tile, che puoi schedulare, taggare, condividere.
          </p>
        </div>
      </div>
      <p style={{ fontFamily: 'var(--font-pixel-body)', fontSize: 11, color: theme.ink3, textAlign: 'center', margin: 0, lineHeight: 1.55 }}>
        L&apos;AI suggerisce titolo, tag e date. Tu cambi quello che vuoi.
      </p>
    </>
  );
}

function StepFinish({ theme }: { theme: ReturnType<typeof usePixelTheme> }) {
  return (
    <>
      <div
        style={{
          width: 96, height: 96,
          background: theme.accent,
          border: `2px solid ${theme.border}`,
          display: 'inline-flex',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <IconLayoutGrid size={48} style={{ color: theme.onAccent }} />
      </div>
      <h2
        style={{
          fontFamily: 'var(--font-pixel-head)',
          fontSize: 14,
          letterSpacing: '0.1em',
          textTransform: 'uppercase',
          color: theme.ink,
          margin: 0,
          textAlign: 'center',
        }}
      >
        Tutto pronto
      </h2>
      <p style={{ fontFamily: 'var(--font-pixel-body)', fontSize: 13, color: theme.ink2, textAlign: 'center', margin: 0, lineHeight: 1.55, maxWidth: 380 }}>
        Il tuo workspace è già impostato: tag <strong>GIMMICK</strong> come inbox e 5 status pronti. Personalizza tutto da <strong>Settings</strong>.
      </p>
    </>
  );
}
