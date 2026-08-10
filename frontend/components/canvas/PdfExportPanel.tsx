'use client';

/**
 * Gimmick · Obsidian — Il pannello del foglio.
 *
 * Compare quando hai cerchiato un'area sul canvas e dice tre cose: che formato è
 * uscito, quanto grande sarà sulla carta, e se a quella misura i tile si leggono
 * ancora. Non è un modale: l'anteprima del foglio è disegnata sul canvas dietro
 * di lui, e oscurarla per mostrare un pannello che parla di lei sarebbe assurdo.
 *
 * Il formato è già scelto quando il pannello si apre (vedi lib/paper.ts). I
 * segmenti servono a smentirlo, non a compilarlo: «Auto» è il primo, ed è dove
 * si torna.
 */
import * as React from 'react';
import { IconPrinter, IconX, IconAlertTriangle } from '@tabler/icons-react';
import { Button, SegmentedControl } from '@/components/primitives';
import { PAPER_ORDER, paperLabel, type PaperFormat, type PaperOrientation, type PaperPlan } from '@/lib/paper';

interface PdfExportPanelProps {
  plan: PaperPlan;
  /** Formato imposto dall'utente; null = quello automatico. */
  format: PaperFormat | null;
  onFormat: (f: PaperFormat | null) => void;
  orientation: PaperOrientation;
  onOrientation: (o: PaperOrientation) => void;
  /** Quanti tile cadono dentro l'area: è il motivo per cui si stampa. */
  tileCount: number;
  busy?: boolean;
  onPrint: () => void;
  onClose: () => void;
}

const FORMAT_ITEMS = [
  { value: 'auto', label: 'Auto' },
  ...PAPER_ORDER.map((f) => ({ value: f, label: f })),
];

const ORIENT_ITEMS: { value: PaperOrientation; label: string }[] = [
  { value: 'landscape', label: 'Orizzontale' },
  { value: 'portrait', label: 'Verticale' },
];

export function PdfExportPanel({
  plan, format, onFormat, orientation, onOrientation, tileCount, busy, onPrint, onClose,
}: PdfExportPanelProps) {
  const pct = Math.round(plan.scale * 100);

  return (
    <div className="ob-pdfbar" role="dialog" aria-label="Esporta in PDF" onMouseDown={(e) => e.stopPropagation()}>
      <div className="ob-pdfbar__head">
        <span className="ob-pdfbar__eyebrow">Foglio</span>
        <button type="button" className="ob-pdfbar__close" onClick={onClose} aria-label="Chiudi" title="Chiudi (Esc)">
          <IconX size={14} stroke={1.8} />
        </button>
      </div>

      {/* A stampa avviata il piano è già stato tradotto in un foglio montato nel
          DOM: cambiarlo adesso lo smonterebbe sotto al dialogo aperto. */}
      <div className="ob-pdfbar__row">
        <SegmentedControl
          items={FORMAT_ITEMS}
          value={format ?? 'auto'}
          onChange={(v) => { if (!busy) onFormat(v === 'auto' ? null : (v as PaperFormat)); }}
          aria-label="Formato del foglio"
        />
        <SegmentedControl
          items={ORIENT_ITEMS}
          value={orientation}
          onChange={(v) => { if (!busy) onOrientation(v as PaperOrientation); }}
          aria-label="Orientamento del foglio"
        />
      </div>

      <div className="ob-pdfbar__info">
        <strong>{paperLabel(plan)}</strong>
        <span className="ob-pdfbar__sep">·</span>
        {plan.pageMm.w} × {plan.pageMm.h} mm
        <span className="ob-pdfbar__sep">·</span>
        scala {pct}%
        <span className="ob-pdfbar__sep">·</span>
        {tileCount === 1 ? '1 tile' : `${tileCount} tile`}
        {format === null && (
          <span className="ob-pdfbar__auto" title="Il formato più piccolo che contiene l'area a grandezza naturale">
            automatico
          </span>
        )}
      </div>

      {/* Due avvisi diversi, non due gradi dello stesso: il primo dice che la
          carta è finita, il secondo che la lettura è a rischio. */}
      {plan.overflow && (
        <div className="ob-pdfbar__warn">
          <IconAlertTriangle size={14} stroke={1.7} />
          <span>L’area supera l’A0 a grandezza naturale: viene ridotta al {pct}%.</span>
        </div>
      )}
      {plan.cramped && !plan.overflow && (
        <div className="ob-pdfbar__warn">
          <IconAlertTriangle size={14} stroke={1.7} />
          <span>A questa scala i titoli dei tile diventano difficili da leggere.</span>
        </div>
      )}

      <div className="ob-pdfbar__actions">
        <span className="ob-pdfbar__hint">
          Nel dialogo scegli “Salva come PDF”.
        </span>
        <Button variant="ghost" size="sm" onClick={onClose}>Annulla</Button>
        <Button variant="primary" size="sm" onClick={onPrint} disabled={busy}>
          <IconPrinter size={14} stroke={1.7} />
          {busy ? 'Preparo…' : 'Crea PDF'}
        </Button>
      </div>
    </div>
  );
}
