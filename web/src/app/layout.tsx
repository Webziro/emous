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
  title: 'emous — Anonymous Hyperlocal Confessions & Secret Inbox',
  description:
    'No logins. Drop hyperlocal visual cards within 5 miles or share your emous.app/ask link to receive anonymous confessions.',
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
