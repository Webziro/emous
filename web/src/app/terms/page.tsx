'use client';

import React from 'react';
import Link from 'next/link';
import { ArrowLeft, ShieldCheck, Clock, Gift, AlertTriangle } from 'lucide-react';

export default function TermsAndConditionsPage() {
  return (
    <div className="min-h-screen bg-emous-bg text-white pb-20">
      <header className="sticky top-0 z-30 bg-emous-bg/95 backdrop-blur-md border-b-4 border-black">
        <div className="max-w-3xl mx-auto px-4 py-3 flex items-center justify-between gap-3">
          <Link
            href="/"
            className="bg-emous-lime text-black font-display font-extrabold text-sm px-3.5 py-1.5 rounded-xl flyer-btn inline-flex items-center gap-1.5"
          >
            <ArrowLeft className="w-4 h-4 stroke-[2.5]" />
            <span>Back to emous</span>
          </Link>

          <span className="bg-emous-pink text-white font-display font-extrabold text-xs px-3 py-1 rounded-full border-2 border-black uppercase">
            Terms & Conditions
          </span>
        </div>
      </header>

      <main className="max-w-3xl mx-auto px-4 pt-6 space-y-5">
        <div className="bg-emous-lime text-black rounded-3xl p-5 sm:p-6 flyer-card space-y-2">
          <span className="inline-block bg-black text-emous-yellow text-[10px] font-display font-extrabold px-2.5 py-0.5 rounded-full uppercase">
            OFFICIAL PLATFORM & REWARD RULES
          </span>
          <h1 className="font-display font-extrabold text-2xl sm:text-3xl leading-tight">
            emous Terms & Conditions
          </h1>
          <p className="text-xs sm:text-sm font-bold opacity-85">
            Last Updated: November 2026 • Applicable to emous Web & Mobile Users
          </p>
        </div>

        {/* Section 1: WhatsApp Admin ₦2,000 Loyalty Program */}
        <section className="bg-emous-surface rounded-3xl p-5 flyer-card border-2 border-black space-y-3">
          <h2 className="font-display font-extrabold text-lg text-emous-yellow flex items-center gap-2">
            <Gift className="w-5 h-5 text-emous-pink" />
            <span>1. WhatsApp Group Admin ₦2,000 Reward Rules</span>
          </h2>
          <p className="text-xs sm:text-sm text-neutral-300 leading-relaxed">
            To qualify for the <strong className="text-emous-lime">₦2,000</strong>{' '}
            host reward on any session link generated from emous, all of the
            following conditions must be strictly satisfied:
          </p>
          <ul className="space-y-2 text-xs sm:text-sm text-neutral-200 list-disc pl-5">
            <li>
              <strong className="text-white">30 Unique Qualified Messages:</strong>{' '}
              Your shared link must receive at least <strong>30 unique secret messages</strong>{' '}
              within a single session.
            </li>
            <li>
              <strong className="text-white">Complete Unique Sentences Only:</strong>{' '}
              Every counted message must be unique (duplicate copy-paste text is
              rejected) and must contain at least{' '}
              <strong>one complete sentence</strong> (minimum 4 varied words and 18+
              meaningful characters). One-word replies like “hi”, “ok”, or emojis
              alone do not count.
            </li>
            <li>
              <strong className="text-emous-pink">
                Strict 2-Hour Interval (Auto-Reset to 0):
              </strong>{' '}
              All 30 qualified messages must arrive within a{' '}
              <strong>2-hour countdown window</strong> from the start of your active
              count. If 30 messages are not completed within 2 hours, the counter{' '}
              <strong>automatically resets back to 0</strong>.
            </li>
            <li>
              <strong className="text-emous-yellow">
                Different Hardware Devices & Distinct Locations:
              </strong>{' '}
              Messages must come from <strong>30 different physical devices</strong>.
              Switching between different browsers (e.g., Chrome, Safari, Firefox)
              on the same device does not create extra counts. Furthermore,{' '}
              <strong>
                if two or more devices share the exact same IP/network or physical
                location, they count strictly as one (1)
              </strong>
              .
            </li>
            <li>
              <strong className="text-white">Proof & Manual Payout:</strong> Upon
              reaching 30/30 inside the 2-hour window, submit your bank account
              details in-app and chat or call the Admin WhatsApp line with proof of
              completion. Once verified as genuine traffic, manual bank transfer of
              ₦2,000 is processed and ticked as Paid.
            </li>
          </ul>
        </section>

        {/* Section 2: Acceptable Use & Zero Tolerance */}
        <section className="bg-emous-surface rounded-3xl p-5 flyer-card border-2 border-black space-y-3">
          <h2 className="font-display font-extrabold text-lg text-emous-lime flex items-center gap-2">
            <ShieldCheck className="w-5 h-5 text-emous-lime" />
            <span>2. Acceptable Use & Zero-Tolerance Safety</span>
          </h2>
          <p className="text-xs sm:text-sm text-neutral-300 leading-relaxed">
            emous is built for fun, honest confessions and community engagement. By
            using this platform you agree NOT to post or send:
          </p>
          <ul className="space-y-1.5 text-xs sm:text-sm text-neutral-300 list-disc pl-5">
            <li>Hate speech, violent threats, self-harm encouragement, or blackmail.</li>
            <li>Doxxing (publishing private phone numbers, home addresses, or IDs).</li>
            <li>Non-consensual sexual content or harassment targeting minors.</li>
            <li>Automated bot spam, fake device farming, or location spoofing.</li>
          </ul>
          <p className="text-xs text-neutral-400">
            Posts or inbox notes flagged 3 times by users are automatically hidden,
            and abusive devices/sessions may be blocked without payout.
          </p>
        </section>

        {/* Section 3: Data, Auto-Burn & Privacy */}
        <section className="bg-emous-surface rounded-3xl p-5 flyer-card border-2 border-black space-y-3">
          <h2 className="font-display font-extrabold text-lg text-white flex items-center gap-2">
            <Clock className="w-5 h-5 text-emous-yellow" />
            <span>3. 30-Day Auto-Burn Inbox vs Permanent Feed</span>
          </h2>
          <p className="text-xs sm:text-sm text-neutral-300 leading-relaxed">
            Messages delivered to a personal inbox link are automatically purged after{' '}
            <strong>30 days</strong> (or immediately after first view when marked
            Flash Burn). Public confessions shared to the{' '}
            <strong className="text-emous-pink">Dare to Speak!</strong> community
            feed remain visible permanently unless flagged/removed.
          </p>
        </section>

        {/* Section 4: Fraud Enforcement */}
        <section className="bg-black/80 rounded-3xl p-5 border-2 border-emous-pink space-y-2">
          <h2 className="font-display font-extrabold text-base text-emous-pink flex items-center gap-2">
            <AlertTriangle className="w-4 h-4" />
            <span>4. Disqualification & Admin Discretion</span>
          </h2>
          <p className="text-xs text-neutral-300 leading-relaxed">
            emous reserves the right to audit any payout claim for bot activity,
            emulator usage, VPN/same-location clustering, or duplicate sentence
            farming, and to withhold payouts on fraudulent sessions.
          </p>
        </section>

        <div className="flex items-center justify-center gap-3 pt-2">
          <Link
            href="/"
            className="inline-flex items-center gap-2 bg-emous-yellow text-black font-display font-extrabold text-xs uppercase px-5 py-2.5 rounded-2xl flyer-btn"
          >
            <ArrowLeft className="w-4 h-4" />
            <span>Return to emous App</span>
          </Link>
          <Link
            href="/privacy"
            className="inline-flex items-center gap-2 bg-emous-surface text-white font-display font-extrabold text-xs uppercase px-5 py-2.5 rounded-2xl border-2 border-black"
          >
            <span>Privacy Policy</span>
          </Link>
        </div>
      </main>
    </div>
  );
}
