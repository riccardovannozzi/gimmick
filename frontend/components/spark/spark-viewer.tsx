'use client';

import { useState, useEffect } from 'react';
import {
  Dialog,
  DialogContent,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { IconMicrophone, IconFile, IconDownload, IconLoader2, IconAlertCircle } from '@tabler/icons-react';
import { uploadApi } from '@/lib/api';
import { typeLabels, formatDuration, formatFileSize } from '@/lib/spark-utils';
import { usePixelTheme } from '@/components/pixel';
import type { Spark } from '@/types';

interface SparkViewerProps {
  spark: Spark | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function SparkViewer({ spark, open, onOpenChange }: SparkViewerProps) {
  const theme = usePixelTheme();
  const bW = 1;
  const [signedUrl, setSignedUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open || !spark) {
      setSignedUrl(null);
      setError(null);
      return;
    }

    if (spark.type === 'text') return;

    if (!spark.storage_path) {
      setError('Percorso file mancante');
      return;
    }

    setLoading(true);
    setError(null);

    uploadApi
      .getSignedUrl(spark.storage_path)
      .then((result) => {
        if (result.success && result.data) {
          setSignedUrl(result.data.url);
        } else {
          setError(result.error || 'Impossibile ottenere il link al file');
        }
      })
      .catch(() => {
        setError('Errore di rete');
      })
      .finally(() => {
        setLoading(false);
      });
  }, [open, spark]);

  function renderContent() {
    if (loading) {
      return (
        <div className="flex flex-col items-center justify-center py-12" style={{ color: theme.ink3 }}>
          <IconLoader2 className="h-8 w-8 animate-spin mb-3" />
          <p style={{ fontFamily: 'var(--ob-font-sans)', fontSize: 12 }}>Caricamento...</p>
        </div>
      );
    }

    if (error) {
      return (
        <div className="flex flex-col items-center justify-center py-12" style={{ color: '#E24B4A' }}>
          <IconAlertCircle className="h-8 w-8 mb-3" />
          <p style={{ fontFamily: 'var(--ob-font-sans)', fontSize: 12 }}>{error}</p>
        </div>
      );
    }

    if (!spark) return null;

    switch (spark.type) {
      case 'photo':
      case 'image':
        return (
          <div className="flex items-center justify-center">
            <img
              src={signedUrl!}
              alt={spark.file_name || 'Immagine'}
              className="max-h-[70vh] max-w-full object-contain"
              style={{ border: `${bW}px solid ${theme.border}`, borderRadius: 12 }}
            />
          </div>
        );

      case 'video':
        return (
          <video
            src={signedUrl!}
            controls
            className="max-h-[70vh] w-full"
            style={{ border: `${bW}px solid ${theme.border}`, borderRadius: 12, background: '#000' }}
          >
            Il tuo browser non supporta il tag video.
          </video>
        );

      case 'audio_recording':
        return (
          <div className="flex flex-col items-center gap-4 py-6">
            <div
              style={{
                width: 64, height: 64,
                background: theme.surfaceVariant,
                border: `${bW}px solid ${theme.border}`,
                borderRadius: 14,
                display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
              }}
            >
              <IconMicrophone size={32} style={{ color: theme.ink2 }} />
            </div>
            <audio src={signedUrl!} controls className="w-full" />
            {spark.duration != null && (
              <p style={{ fontFamily: 'var(--ob-font-sans)', fontSize: 11, color: theme.ink3 }}>
                Durata: {formatDuration(spark.duration)}
              </p>
            )}
          </div>
        );

      case 'text':
        return (
          <div
            className="max-h-[60vh] overflow-auto whitespace-pre-wrap"
            style={{
              padding: 14,
              background: theme.surfaceVariant,
              border: `${bW}px solid ${theme.border}`,
              borderRadius: 10,
              color: theme.ink,
              fontFamily: 'var(--ob-font-sans)',
              fontSize: 13.5,
              lineHeight: 1.55,
            }}
          >
            {spark.content || 'Nessun contenuto'}
          </div>
        );

      case 'file':
        return (
          <div className="flex flex-col items-center gap-4 py-6">
            <div
              style={{
                width: 64, height: 64,
                background: theme.surfaceVariant,
                border: `${bW}px solid ${theme.border}`,
                borderRadius: 14,
                display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
              }}
            >
              <IconFile size={32} style={{ color: theme.ink2 }} />
            </div>
            <div className="text-center" style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
              <p style={{ fontFamily: 'var(--ob-font-sans)', fontSize: 13, fontWeight: 600, color: theme.ink, wordBreak: 'break-all' }}>
                {spark.file_name || 'File'}
              </p>
              {spark.mime_type && (
                <p style={{ fontFamily: 'var(--ob-font-sans)', fontSize: 11, color: theme.ink3 }}>{spark.mime_type}</p>
              )}
              {spark.file_size != null && (
                <p style={{ fontFamily: 'var(--ob-font-sans)', fontSize: 11, color: theme.ink3 }}>{formatFileSize(spark.file_size)}</p>
              )}
            </div>
            {signedUrl && (
              <a
                href={signedUrl}
                download={spark.file_name}
                target="_blank"
                rel="noopener noreferrer"
                className="px-press"
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 6,
                  padding: '9px 16px',
                  background: theme.accent,
                  color: theme.onAccent,
                  border: `${bW}px solid transparent`,
                  borderRadius: 10,
                  fontFamily: 'var(--ob-font-sans)',
                  fontSize: 13,
                  fontWeight: 600,
                  letterSpacing: 0,
                  textTransform: 'none',
                  cursor: 'pointer',
                  textDecoration: 'none',
                  boxShadow: 'none',
                }}
              >
                <IconDownload size={12} />
                Scarica
              </a>
            )}
          </div>
        );

      default:
        return (
          <p style={{ textAlign: 'center', padding: '32px 0', color: theme.ink3, fontFamily: 'var(--ob-font-sans)', fontSize: 12 }}>
            Tipo non supportato
          </p>
        );
    }
  }

  const isMediaType = spark && ['photo', 'image', 'video'].includes(spark.type);

  const dialogStyle: React.CSSProperties = {
    maxWidth: isMediaType ? 'min(90vw, 900px)' : 'min(90vw, 520px)',
    width: '100%',
    background: theme.surface,
    border: `${bW}px solid ${theme.border}`,
    borderRadius: 14,
    color: theme.ink,
    boxShadow: 'var(--ob-shadow-card)',
    padding: 0,
    gap: 0,
    display: 'block',
    overflow: 'hidden',
  };

  const headerStyle: React.CSSProperties = {
    padding: '14px 16px',
    background: theme.bg2,
    borderBottom: `${bW}px solid ${theme.border}`,
  };

  const titleText = spark?.file_name || spark?.content?.substring(0, 60) || (spark ? typeLabels[spark.type] : 'Spark');
  const dateText = spark
    ? new Date(spark.created_at).toLocaleDateString('it-IT', {
        day: 'numeric',
        month: 'long',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      })
    : '';

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent showCloseButton={false} style={dialogStyle} className={'!gap-0 !p-0'}>
        <div style={headerStyle}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <DialogTitle
              style={{
                flex: 1,
                fontFamily: 'var(--ob-font-mono)',
                fontSize: 11,
                letterSpacing: '0.08em',
                textTransform: 'uppercase',
                color: theme.ink,
                margin: 0,
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                whiteSpace: 'nowrap',
              }}
            >
              {titleText}
            </DialogTitle>
            <button
              type="button"
              onClick={() => onOpenChange(false)}
              aria-label="Chiudi"
              style={{
                width: 22, height: 22,
                background: theme.surface,
                border: `${bW}px solid ${theme.border}`,
                borderRadius: 6,
                color: theme.ink2,
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
                cursor: 'pointer',
                fontFamily: 'var(--ob-font-mono)',
                fontSize: 11,
                lineHeight: 1,
                flexShrink: 0,
              }}
            >
              ×
            </button>
          </div>
          <DialogDescription asChild>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 6 }}>
              {spark && (
                <span
                  style={{
                    padding: '2px 7px',
                    background: theme.surface,
                    color: theme.ink2,
                    border: `${bW}px solid ${theme.border}`,
                    borderRadius: 6,
                    fontFamily: 'var(--ob-font-mono)',
                    fontSize: 9.5,
                    letterSpacing: '0.08em',
                    textTransform: 'uppercase',
                  }}
                >
                  {typeLabels[spark.type]}
                </span>
              )}
              <span style={{ color: theme.ink3, fontFamily: 'var(--ob-font-sans)', fontSize: 11 }}>
                {dateText}
              </span>
            </div>
          </DialogDescription>
        </div>
        <div style={{ padding: 14 }}>
          {renderContent()}
        </div>
      </DialogContent>
    </Dialog>
  );
}
