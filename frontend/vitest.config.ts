import { defineConfig } from 'vitest/config';
import path from 'node:path';

/**
 * Il primo test runner del progetto. Fino a qui non ce n'era nessuno: né qui né
 * nel backend, e non esisteva un solo file di test in tutto il repository.
 *
 * Serve alle REGOLE DI LETTURA — le funzioni pure che traducono i campi grezzi di
 * un passo in qualcosa di leggibile (`subtaskToStep`, `subtaskBall`). Sono poche
 * righe ciascuna, e proprio per questo si "semplificano" con leggerezza: un
 * `??` che diventa `||`, due rami invertiti. I test sono lì per far fallire
 * quella semplificazione, non per coprire la resa.
 *
 * ⚠️ `vitest` è fissato alla 3: la 5 esige `@types/node` ≥ 22 e il progetto sta
 * sul 20. Prima di salire, si sale con i tipi di Node.
 *
 * Niente `environment: 'jsdom'`: qui non si monta nessun componente. Il giorno
 * in cui servisse, va aggiunto insieme alla sua dipendenza.
 */
export default defineConfig({
  resolve: {
    // Lo stesso alias del `tsconfig.json`, altrimenti un import `@/...` non
    // risolve fuori da Next.
    alias: { '@': path.resolve(__dirname, '.') },
  },
  test: {
    include: ['**/__tests__/**/*.test.ts'],
    // `.next` contiene copie generate dei sorgenti: senza questa riga i test
    // verrebbero raccolti due volte.
    exclude: ['**/node_modules/**', '**/.next/**'],
  },
});
