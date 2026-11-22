import React from 'react';
import type { Metadata } from 'next';

export async function generateMetadata({
  params,
}: {
  params: { handle: string };
}): Promise<Metadata> {
  const rawHandle = decodeURIComponent(params.handle || 'GoldenWizard').replace(
    /^@/,
    ''
  );

  const title = `🤫 Send @${rawHandle} an Anonymous Secret Message on emous!`;
  const description = `Ask or confess anything to @${rawHandle} with 100% zero-login anonymity. Auto-burns in 30 days 🔥`;
  const url = `https://emous.vercel.app/${rawHandle}`;

  return {
    title,
    description,
    openGraph: {
      title,
      description,
      url,
      siteName: 'emous — Dare to Speak!',
      type: 'website',
    },
    twitter: {
      card: 'summary_large_image',
      title,
      description,
    },
  };
}

export default function AskHandleLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <>{children}</>;
}
