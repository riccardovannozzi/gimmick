import type { Metadata } from 'next';
import { Inter, Press_Start_2P, JetBrains_Mono } from 'next/font/google';
import './globals.css';
import './pixel.css';
import { Providers } from './providers';

const inter = Inter({ subsets: ['latin'] });

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
      className={`dark ${pressStart.variable} ${jetbrains.variable}`}
      style={{ colorScheme: 'dark' }}
    >
      <body className={`${inter.className} bg-zinc-950 text-white antialiased`} suppressHydrationWarning>
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
