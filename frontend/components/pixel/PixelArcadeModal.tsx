'use client';

import { Dialog, DialogContent, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { usePixelTheme } from '@/components/pixel';
import { PixelSettingsPanel } from './PixelSettingsPanel';

interface PixelArcadeModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

/**
 * Pixel Arcade settings hosted in a Dialog so the Settings page mirrors the
 * "manage button → modal" pattern used by Actions / Statuses / Type Icons.
 * Content is the existing PixelSettingsPanel — no behavioural change.
 */
export function PixelArcadeModal({ open, onOpenChange }: PixelArcadeModalProps) {
  const theme = usePixelTheme();

  const dialogStyle: React.CSSProperties = {
    maxWidth: 560,
    width: 'min(90vw, 560px)',
    background: theme.surface,
    border: `2px solid ${theme.border}`,
    borderRadius: 0,
    color: theme.ink,
    boxShadow: `${theme.shadowOffset}px ${theme.shadowOffset}px 0 ${theme.shadowColor}`,
    padding: 0,
    gap: 0,
    display: 'block',
  };
  const headerStyle: React.CSSProperties = {
    padding: '10px 14px',
    background: theme.surfaceVariant,
    borderBottom: `2px solid ${theme.border}`,
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent showCloseButton={false} style={dialogStyle}>
        <DialogTitle className="sr-only">Pixel Arcade</DialogTitle>
        <DialogDescription className="sr-only">
          Personalizza palette, modalità, ombre e sfondo del design system 16-bit
        </DialogDescription>
        <div style={headerStyle}>
          <h2
            style={{
              fontFamily: 'var(--font-pixel-head)',
              fontSize: 11,
              letterSpacing: '0.1em',
              textTransform: 'uppercase',
              color: theme.ink,
              margin: 0,
            }}
          >
            Pixel Arcade
          </h2>
          <p style={{ fontFamily: 'var(--font-pixel-body)', fontSize: 11, color: theme.ink3, margin: '4px 0 0' }}>
            Palette, modalità, ombre e sfondo del design system 16-bit.
          </p>
        </div>
        <div style={{ padding: 14, maxHeight: '70vh', overflowY: 'auto' }}>
          <PixelSettingsPanel />
        </div>
      </DialogContent>
    </Dialog>
  );
}
