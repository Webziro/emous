import type { Metadata } from 'next';
import { Syne, Space_Grotesk } from 'next/font/google';
import './globals.css';

const syne = Syne({
  subsets: ['latin'],
  weight: ['700', '800'],
  variable: '--font-display',
});

const spaceGrotesk = Space_Grotesk({
  subsets: ['latin'],
  weight: ['400', '500', '600', '700'],
  variable: '--font-sans',
});

export const metadata: Metadata = {
  metadataBase: new URL('https://emous.vercel.app'),
  title: 'emous — Dare to Speak! Anonymous Confessions & Secret Inbox',
  description:
    'Drop anonymous confessions, vote on hot takes, or send a secret message with zero login.',
  openGraph: {
    title: 'emous — Dare to Speak! 🤫🔥',
    description:
      'Tap to drop an anonymous confession or read live community secrets. 100% zero-login anonymity.',
    url: 'https://emous.vercel.app',
    siteName: 'emous',
    type: 'website',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'emous — Dare to Speak! 🤫🔥',
    description:
      'Tap to drop an anonymous confession or read live community secrets.',
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className={`${syne.variable} ${spaceGrotesk.variable}`}>
      <body className="min-h-screen bg-emous-bg text-white antialiased selection:bg-emous-pink selection:text-white">
        {children}
      </body>
    </html>
  );
}
