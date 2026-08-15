'use client';

/**
 * Gimmick · Obsidian — L'interruttore dei pallini degli spark.
 *
 * Un componente e non tre copie della stessa `ToolWord`: l'interruttore è UNO
 * (vedi `store/spark-icons-store.ts`), e tre copie sarebbero tre occasioni di
 * scrivere tre parole diverse per la stessa cosa.
 *
 * Va nel gruppo dei MODI DI GUARDARE — accanto a «Done», dopo il filo che lo
 * separa dai comandi. Non crea niente e non tocca i dati: cambia cosa la card
 * mostra di sé.
 */
import * as React from 'react';
import { ToolWord } from '@/components/primitives';
import { useSparkIcons } from '@/store/spark-icons-store';

export function SparkIconsToggle() {
  const on = useSparkIcons((s) => s.on);
  const toggle = useSparkIcons((s) => s.toggle);

  return (
    <ToolWord
      on={on}
      onClick={toggle}
      title={on
        ? 'Nascondi le icone degli spark allegati'
        : 'Mostra sui tile le icone degli spark allegati'}
    >
      Spark
    </ToolWord>
  );
}
