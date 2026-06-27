import type { Metadata } from 'next';
import { Inter, Press_Start_2P, JetBrains_Mono, Geist, Geist_Mono } from 'next/font/google';
import './globals.css';
import './pixel.css';
import './obsidian.css';
import './obsidian-primitives.css';
import './obsidian-mascot.css';
import './obsidian-shell.css';
import './obsidian-tiles.css';
import './obsidian-sparks.css';
import './obsidian-canvas.css';
import './obsidian-kanban.css';
import './obsidian-chrono.css';
import './obsidian-panopticon.css';
import './obsidian-flows.css';
import './obsidian-settings.css';
import './obsidian-ask.css';
import './obsidian-modals.css';
import './obsidian-states.css';
import { Providers } from './providers';

const inter = Inter({ subsets: ['latin'] });

// Obsidian design system fonts. CSS vars exposed via `variable:` so the
// Obsidian tokens (lib/theme/obsidian.ts, app/obsidian.css) can read them
// through `var(--font-geist-sans)` / `var(--font-geist-mono)`.
const geistSans = Geist({
  subsets: ['latin'],
  variable: '--font-geist-sans',
  display: 'swap',
});
const geistMono = Geist_Mono({
  subsets: ['latin'],
  variable: '--font-geist-mono',
  display: 'swap',
});

// Pixel Arcade design system fonts. CSS vars exposed via `variable:` so
// pixel-theme.ts can pick them up via `var(--font-pixel-head)` /
// `var(--font-pixel-body)`.
const pressStart = Press_Start_2P({
  subsets: ['latin'],
  weight: '400',
  variable: '--font-pixel-head',
  display: 'swap',
});
const jetbrains = JetBrains_Mono({
  subsets: ['latin'],
  variable: '--font-pixel-body',
  display: 'swap',
});

export const metadata: Metadata = {
  title: 'Gimmick',
  description: 'App per cattura e gestione informazioni multi-formato',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html
      lang="it"
      className={`dark ${pressStart.variable} ${jetbrains.variable} ${geistSans.variable} ${geistMono.variable}`}
      style={{ colorScheme: 'dark' }}
    >
      <body className={`${inter.className} bg-zinc-950 text-white antialiased`} suppressHydrationWarning>
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
