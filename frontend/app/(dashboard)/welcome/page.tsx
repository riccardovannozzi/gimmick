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
import { settingsApi } from '@/lib/api';
import { Beniamino } from '@/components/mascot';
import { Button } from '@/components/primitives';

interface CaptureBadge {
  icon: typeof IconCamera;
  label: string;
  /** Token della scala colori-tipo Obsidian (`--ob-type-<color>`). */
  color: 'photo' | 'video' | 'gallery' | 'text' | 'voice' | 'file';
}

const CAPTURES: CaptureBadge[] = [
  { icon: IconCamera,     label: 'Foto',  color: 'photo' },
  { icon: IconVideo,      label: 'Video', color: 'video' },
  { icon: IconMicrophone, label: 'Voce',  color: 'voice' },
  { icon: IconNote,       label: 'Testo', color: 'text' },
  { icon: IconPaperclip,  label: 'File',  color: 'file' },
  { icon: IconPhoto,      label: 'Image', color: 'gallery' },
];

const STEPS = ['Benvenuto', 'Cattura', 'Organizza', 'Pronti'] as const;

/**
 * Welcome wizard — versione Obsidian (la variante arcade pixel è stata rimossa
 * nel cleanup della migrazione). 4 step: Benvenuto / Cattura / Organizza / Pronti.
 */
export default function WelcomePage() {
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
        background: 'var(--ob-canvas)',
        padding: 16,
        zIndex: 100,
        fontFamily: 'var(--ob-font-sans)',
      }}
    >
      <div
        style={{
          width: '100%',
          maxWidth: 520,
          background: 'var(--ob-surface)',
          border: '1px solid var(--ob-line-2)',
          borderRadius: 'var(--ob-radius-card)',
          boxShadow: 'var(--ob-shadow-card)',
          overflow: 'hidden',
        }}
      >
        {/* Step progress */}
        <div style={{ display: 'flex', gap: 6, padding: '14px 18px', borderBottom: '1px solid var(--ob-line)' }}>
          {STEPS.map((label, i) => (
            <div
              key={label}
              title={label}
              style={{
                flex: 1,
                height: 4,
                borderRadius: 'var(--ob-radius-pill)',
                background: i <= step ? 'var(--ob-accent)' : 'var(--ob-surface-2)',
                transition: 'background 160ms ease',
              }}
            />
          ))}
        </div>

        {/* Body */}
        <div
          style={{
            padding: 32,
            minHeight: 340,
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 18,
            textAlign: 'center',
          }}
        >
          {step === 0 && <ObStepWelcome />}
          {step === 1 && <ObStepCapture />}
          {step === 2 && <ObStepOrganize />}
          {step === 3 && <ObStepFinish />}
        </div>

        {/* Nav */}
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            gap: 8,
            padding: 16,
            borderTop: '1px solid var(--ob-line)',
          }}
        >
          <Button variant="ghost" onClick={() => setStep((s) => Math.max(0, s - 1))} disabled={step === 0}>
            <IconArrowLeft size={15} />
            Indietro
          </Button>
          <Button
            variant="primary"
            disabled={completing}
            onClick={() => {
              if (step === STEPS.length - 1) finish();
              else setStep((s) => s + 1);
            }}
          >
            {step === STEPS.length - 1 ? (
              <>
                <IconCheck size={15} />
                Inizia
              </>
            ) : (
              <>
                Avanti
                <IconArrowRight size={15} />
              </>
            )}
          </Button>
        </div>
      </div>
    </div>
  );
}

const obTitle: React.CSSProperties = {
  fontSize: 18,
  fontWeight: 600,
  letterSpacing: '-0.015em',
  color: 'var(--ob-text)',
  margin: 0,
};
const obBody: React.CSSProperties = {
  fontSize: 14,
  color: 'var(--ob-muted)',
  margin: 0,
  lineHeight: 1.55,
  maxWidth: 400,
};
const obEyebrow: React.CSSProperties = {
  fontFamily: 'var(--ob-font-mono)',
  fontSize: 11,
  letterSpacing: '0.08em',
  textTransform: 'uppercase',
  color: 'var(--ob-subtle)',
  margin: 0,
};

function ObStepWelcome() {
  return (
    <>
      <Beniamino name="gimmick" size={132} title="" />
      <h2 style={obTitle}>Bip! Benvenuto in Gimmick</h2>
      <p style={obBody}>
        Io sono il tuo beniamino. In 30 secondi ti mostro come funziona l&apos;app.
      </p>
    </>
  );
}

function ObStepCapture() {
  return (
    <>
      <p style={obEyebrow}>Passo 1</p>
      <h2 style={obTitle}>Cattura idee in qualunque formato</h2>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12, width: '100%' }}>
        {CAPTURES.map(({ icon: Icon, label, color }) => (
          <div
            key={label}
            style={{
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              gap: 8,
              padding: 14,
              background: 'var(--ob-surface-2)',
              border: '1px solid var(--ob-line)',
              borderRadius: 'var(--ob-radius-control)',
            }}
          >
            <div
              style={{
                width: 38,
                height: 38,
                borderRadius: 'var(--ob-radius-icon)',
                background: `var(--ob-type-${color})`,
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <Icon size={19} style={{ color: 'var(--ob-accent-ink)' }} />
            </div>
            <span style={{ fontSize: 12, fontWeight: 500, color: 'var(--ob-muted)' }}>{label}</span>
          </div>
        ))}
      </div>
      <p style={obBody}>
        Foto, audio, testo, file. Tutto diventa uno <strong style={{ color: 'var(--ob-text)' }}>Spark</strong>.
      </p>
    </>
  );
}

function ObStepOrganize() {
  return (
    <>
      <p style={obEyebrow}>Passo 2</p>
      <h2 style={obTitle}>Si organizzano da soli</h2>
      <div
        style={{
          display: 'flex',
          gap: 14,
          alignItems: 'center',
          width: '100%',
          padding: 18,
          textAlign: 'left',
          background: 'var(--ob-surface-2)',
          border: '1px solid var(--ob-line)',
          borderRadius: 'var(--ob-radius-control)',
        }}
      >
        <div
          style={{
            flexShrink: 0,
            width: 60,
            height: 60,
            borderRadius: 'var(--ob-radius-icon)',
            background: 'var(--ob-accent-soft)',
            display: 'inline-flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <IconBolt size={28} style={{ color: 'var(--ob-accent-text)' }} />
        </div>
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--ob-text)', marginBottom: 4 }}>
            Tile = contenitore
          </div>
          <p style={{ fontSize: 13, color: 'var(--ob-muted)', margin: 0, lineHeight: 1.5 }}>
            Ogni Spark vive dentro un Tile. Più Spark che parlano della stessa cosa formano una Tile, che puoi schedulare, taggare, condividere.
          </p>
        </div>
      </div>
      <p style={obBody}>L&apos;AI suggerisce titolo, tag e date. Tu cambi quello che vuoi.</p>
    </>
  );
}

function ObStepFinish() {
  return (
    <>
      <div
        style={{
          width: 88,
          height: 88,
          borderRadius: 'var(--ob-radius-card)',
          background: 'var(--ob-accent)',
          display: 'inline-flex',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <IconLayoutGrid size={42} style={{ color: 'var(--ob-accent-ink)' }} />
      </div>
      <h2 style={obTitle}>Tutto pronto</h2>
      <p style={obBody}>
        Il tuo workspace è già impostato: tag <strong style={{ color: 'var(--ob-text)' }}>GIMMICK</strong> come inbox e 5 status pronti. Personalizza tutto da <strong style={{ color: 'var(--ob-text)' }}>Settings</strong>.
      </p>
    </>
  );
}
