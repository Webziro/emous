'use client';

import React from 'react';
import Link from 'next/link';
import {
  ArrowLeft,
  Lock,
  EyeOff,
  MapPin,
  ShieldAlert,
  Trash2,
  UserCheck,
} from 'lucide-react';

export default function PrivacyPolicyPage() {
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
            Privacy Policy
          </span>
        </div>
      </header>

      <main className="max-w-3xl mx-auto px-4 pt-6 space-y-5">
        <div className="bg-emous-pink text-white rounded-3xl p-5 sm:p-6 flyer-card space-y-2">
          <span className="inline-block bg-black text-emous-lime text-[10px] font-display font-extrabold px-2.5 py-0.5 rounded-full uppercase">
            GOOGLE PLAY & WEB DATA SAFETY
          </span>
          <h1 className="font-display font-extrabold text-2xl sm:text-3xl leading-tight">
            emous Privacy Policy
          </h1>
          <p className="text-xs sm:text-sm font-bold opacity-90">
            Last Updated: November 2026 • Applies to emous Web & Android App
          </p>
        </div>

        {/* 1. Zero-Account Anonymity */}
        <section className="bg-emous-surface rounded-3xl p-5 flyer-card border-2 border-black space-y-3">
          <h2 className="font-display font-extrabold text-lg text-emous-lime flex items-center gap-2">
            <EyeOff className="w-5 h-5 text-emous-lime" />
            <span>1. Information We Collect (No Account Required)</span>
          </h2>
          <p className="text-xs sm:text-sm text-neutral-300 leading-relaxed">
            emous is designed for anonymous confessions without requiring your
            real name, email address, phone number, or password. To operate the
            service safely, we process only limited technical data:
          </p>
          <ul className="space-y-2 text-xs sm:text-sm text-neutral-200 list-disc pl-5">
            <li>
              <strong className="text-white">Anonymous Device Identifier:</strong>{' '}
              A locally generated random device ID and non-reversible hardware
              signature used to preserve your inbox handle, prevent spam/bot
              abuse, and enforce fair reward rules.
            </li>
            <li>
              <strong className="text-white">User-Generated Content:</strong>{' '}
              Anonymous confessions, whisper replies, polls, and inbox notes you
              voluntarily submit.
            </li>
            <li>
              <strong className="text-white">Optional Payout Details:</strong>{' '}
              Only if a WhatsApp Group Admin qualifies for and submits a manual
              ₦2,000 loyalty reward claim, we collect the submitted bank account
              details and WhatsApp contact strictly for payout verification.
            </li>
          </ul>
        </section>

        {/* 2. Approximate Location */}
        <section className="bg-emous-surface rounded-3xl p-5 flyer-card border-2 border-black space-y-3">
          <h2 className="font-display font-extrabold text-lg text-emous-yellow flex items-center gap-2">
            <MapPin className="w-5 h-5 text-emous-yellow" />
            <span>2. Optional Approximate Location (&ldquo;Near Me&rdquo;)</span>
          </h2>
          <p className="text-xs sm:text-sm text-neutral-300 leading-relaxed">
            Location access is <strong>strictly optional</strong>. If you grant
            permission on Android or Web, emous uses coarse/approximate
            coordinates solely to display local confessions within a 5-mile
            radius and show a general area label (such as city/region). Exact GPS
            coordinates are never publicly displayed on any post or profile.
          </p>
        </section>

        {/* 3. Auto-Burn & Retention */}
        <section className="bg-emous-surface rounded-3xl p-5 flyer-card border-2 border-black space-y-3">
          <h2 className="font-display font-extrabold text-lg text-white flex items-center gap-2">
            <Trash2 className="w-5 h-5 text-emous-pink" />
            <span>3. 30-Day Auto-Burn & Data Retention</span>
          </h2>
          <p className="text-xs sm:text-sm text-neutral-300 leading-relaxed">
            Personal inbox messages automatically expire and are permanently
            deleted after <strong>30 days</strong> (or immediately after viewing
            when marked <strong>Flash Burn</strong>). Aggregated non-personal
            traffic statistics (daily active devices, city-level counts, and
            hourly usage) are retained solely for platform reliability and
            analytics.
          </p>
        </section>

        {/* 4. Encryption & Third-Party Sharing */}
        <section className="bg-emous-surface rounded-3xl p-5 flyer-card border-2 border-black space-y-3">
          <h2 className="font-display font-extrabold text-lg text-emous-lime flex items-center gap-2">
            <Lock className="w-5 h-5 text-emous-lime" />
            <span>4. Data Security & No Data Selling</span>
          </h2>
          <p className="text-xs sm:text-sm text-neutral-300 leading-relaxed">
            All network traffic between the emous app, website, and servers is
            encrypted in transit via <strong>HTTPS / TLS</strong>. We do{' '}
            <strong>not</strong> sell, rent, or trade your device identifiers,
            location data, or messages to third-party advertisers or data
            brokers.
          </p>
        </section>

        {/* 5. Content Moderation & Age Requirement */}
        <section className="bg-emous-surface rounded-3xl p-5 flyer-card border-2 border-black space-y-3">
          <h2 className="font-display font-extrabold text-lg text-emous-pink flex items-center gap-2">
            <ShieldAlert className="w-5 h-5 text-emous-pink" />
            <span>5. Safety Moderation & Age Policy (16+)</span>
          </h2>
          <p className="text-xs sm:text-sm text-neutral-300 leading-relaxed">
            emous is intended for users aged <strong>16 and older</strong>. We
            do not knowingly collect information from children under 13. Users
            can report/flag any abusive post or inbox message in-app; automated
            filters and community flags (3+ reports) hide harmful content
            immediately.
          </p>
        </section>

        {/* 6. User Rights & Contact */}
        <section className="bg-black/80 rounded-3xl p-5 border-2 border-emous-lime space-y-2">
          <h2 className="font-display font-extrabold text-base text-emous-lime flex items-center gap-2">
            <UserCheck className="w-4 h-4" />
            <span>6. Data Deletion & Safety Contact</span>
          </h2>
          <p className="text-xs text-neutral-300 leading-relaxed">
            You can clear your local session at any time by resetting your
            browser storage or uninstalling the mobile app. For urgent content
            removal or privacy inquiries, please contact the emous safety team
            via the official support handle or review our{' '}
            <Link
              href="/terms"
              className="underline text-emous-yellow font-bold"
            >
              Terms & Conditions
            </Link>
            .
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
            href="/terms"
            className="inline-flex items-center gap-2 bg-emous-surface text-white font-display font-extrabold text-xs uppercase px-5 py-2.5 rounded-2xl border-2 border-black"
          >
            <span>Read Terms</span>
          </Link>
        </div>
      </main>
    </div>
  );
}
