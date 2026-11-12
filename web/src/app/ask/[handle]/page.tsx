'use client';

import React, { useState, useEffect } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import confetti from 'canvas-confetti';
import {
  Rocket,
  Sparkles,
  ShieldCheck,
  Dices,
  Send,
  Flame,
  Smartphone,
  ArrowRight,
} from 'lucide-react';
import {
  BRAND,
  STORY_COLOR_PAIRS,
  initZeroFrictionIdentity,
  sendAnonymousInboxMessage,
} from '@/lib/api-bundle';

const QUICK_PROMPTS = [
  'Be honest... what was your first impression of me? 👀',
  'Drop a secret you would never tell me to my face 🤫',
  'Lowkey had a crush on you since we met ngl 🔥',
  'What song reminds you of me on late night drives? 🎧',
  'Rate my vibe from 1-10 & don’t hold back ⚡',
];

export default function AskReceiverPage() {
  const params = useParams();
  const rawHandle = Array.isArray(params?.handle)
    ? params.handle[0]
    : params?.handle || 'GoldenWizard';
  const targetHandle = decodeURIComponent(rawHandle);

  const [question, setQuestion] = useState('');
  const [themeIndex, setThemeIndex] = useState(0);
  const [isSending, setIsSending] = useState(false);
  const [sentSuccess, setSentSuccess] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [senderHandle, setSenderHandle] = useState<string | null>(null);
  const [floatingEmojis, setFloatingEmojis] = useState<
    { id: number; emoji: string; left: number }[]
  >([]);

  const activeTheme = STORY_COLOR_PAIRS[themeIndex % STORY_COLOR_PAIRS.length];

  useEffect(() => {
    initZeroFrictionIdentity().then((id) => setSenderHandle(id.handle));
  }, []);

  const triggerCelebration = () => {
    // 1. Confetti explosion
    try {
      confetti({
        particleCount: 95,
        spread: 80,
        origin: { y: 0.6 },
        colors: ['#FF1E8E', '#CCFF00', '#FFE600', '#00F0FF', '#FFFFFF'],
      });
    } catch {
      // Fallback if canvas is unavailable
    }

    // 2. Floating emoji burst
    const emojis = ['🚀', '🤫', '🔥', '⚡', '👀', '💥', '✨'];
    const burst = Array.from({ length: 14 }).map((_, idx) => ({
      id: Date.now() + idx,
      emoji: emojis[idx % emojis.length],
      left: 10 + Math.floor(Math.random() * 80),
    }));
    setFloatingEmojis(burst);
    setTimeout(() => setFloatingEmojis([]), 2400);
  };

  const handleDicePrompt = () => {
    const nextPrompt =
      QUICK_PROMPTS[Math.floor(Math.random() * QUICK_PROMPTS.length)];
    setQuestion(nextPrompt);
    setThemeIndex((prev) => prev + 1);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg('');
    if (!question.trim()) {
      setErrorMsg('Type a secret message before hitting send! 🤫');
      return;
    }

    setIsSending(true);
    try {
      await sendAnonymousInboxMessage(
        targetHandle,
        question.trim(),
        activeTheme.id
      );
      setSentSuccess(true);
      setQuestion('');
      triggerCelebration();
    } catch (err: any) {
      setErrorMsg(err.message || 'Could not deliver message. Try again!');
    } finally {
      setIsSending(false);
    }
  };

  return (
    <div className="min-h-screen flex flex-col justify-between bg-emous-bg text-white pb-32 relative overflow-hidden">
      {/* Floating Emoji Explosion Overlay */}
      {floatingEmojis.length > 0 && (
        <div className="pointer-events-none fixed inset-0 z-50 overflow-hidden">
          {floatingEmojis.map((item) => (
            <span
              key={item.id}
              style={{ left: `${item.left}%` }}
              className="absolute bottom-24 text-4xl animate-bounce transition-all duration-1000"
            >
              {item.emoji}
            </span>
          ))}
        </div>
      )}

      {/* Top Mini Streetwear Brand Bar */}
      <header className="w-full max-w-lg mx-auto px-3 sm:px-4 pt-4 pb-2 flex items-center justify-between gap-2">
        <Link
          href="/"
          className="inline-flex items-center gap-1.5 bg-emous-lime text-black font-display font-extrabold text-base sm:text-xl px-3.5 py-1 rounded-full flyer-btn shrink-0"
        >
          <span>emous</span>
          <span className="text-[9px] bg-black text-emous-lime px-1.5 py-0.5 rounded-full uppercase tracking-wider">
            LIVE
          </span>
        </Link>

        <div className="flex items-center gap-1.5">
          <Link
            href="/"
            className="bg-emous-yellow text-black font-display font-extrabold text-[10px] sm:text-xs px-2.5 py-1 rounded-full flyer-btn uppercase"
          >
            + Drop Card
          </Link>
          <Link
            href="/?tab=inbox"
            className="bg-emous-pink text-white font-display font-extrabold text-[10px] sm:text-xs px-2.5 py-1 rounded-full flyer-btn uppercase"
          >
            🔗 My Link
          </Link>
        </div>
      </header>

      {/* Main Viral Receiver Card */}
      <main className="w-full max-w-lg mx-auto px-3 sm:px-4 my-auto py-3">
        {/* Bubble Badge Header */}
        <div className="mb-4 text-center">
          <div className="inline-block bg-emous-yellow text-black font-display font-extrabold text-[10px] sm:text-xs uppercase tracking-widest px-3 py-1 rounded-full border-2 border-black shadow-brutal mb-2.5 -rotate-1">
            🤫 SECRET CONFESSION DROPBOX
          </div>

          <div className="bg-white text-black rounded-2xl sm:rounded-3xl p-3.5 sm:p-4 flyer-card relative overflow-hidden">
            <div className="flex items-center gap-2.5 sm:gap-3 min-w-0">
              <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-xl sm:rounded-2xl bg-emous-pink border-2 border-black flex items-center justify-center text-white font-display font-extrabold text-sm sm:text-lg shadow-brutal shrink-0">
                @{targetHandle.slice(0, 2).toUpperCase()}
              </div>
              <div className="text-left min-w-0 flex-1 overflow-hidden">
                <p className="text-[10px] sm:text-xs font-bold uppercase tracking-wider text-neutral-600 truncate">
                  Zero-Download Secret Link
                </p>
                <h1 className="font-display font-extrabold text-sm sm:text-xl leading-snug text-black flex flex-wrap items-center gap-1">
                  <span>Ask</span>
                  <span className="bg-emous-lime px-1.5 py-0.5 rounded-md border-2 border-black inline-block max-w-full truncate">
                    @{targetHandle}
                  </span>
                  <span>anything!</span>
                </h1>
              </div>
            </div>
          </div>
        </div>

        {/* Success Confirmation State OR Secret Input Box */}
        {sentSuccess ? (
          <div className="bg-emous-lime text-black rounded-3xl p-6 flyer-card text-center space-y-4 animate-fadeIn">
            <div className="w-16 h-16 mx-auto rounded-2xl bg-emous-pink text-white border-3 border-black flex items-center justify-center text-3xl shadow-brutal">
              🚀
            </div>
            <h2 className="font-display font-extrabold text-2xl sm:text-3xl uppercase">
              Secret Delivered!
            </h2>
            <p className="font-semibold text-sm sm:text-base text-neutral-900 max-w-sm mx-auto">
              Your identity is locked in the vault.{' '}
              <span className="underline font-bold">@{targetHandle}</span> will
              never know who sent it!
            </p>

            <div className="pt-2 flex flex-col sm:flex-row gap-3 justify-center">
              <button
                onClick={() => setSentSuccess(false)}
                className="bg-white text-black font-display font-extrabold px-5 py-3 rounded-2xl flyer-btn text-sm uppercase"
              >
                Send Another Secret 🎲
              </button>
              <Link
                href="/?tab=inbox"
                className="bg-emous-pink text-white font-display font-extrabold px-5 py-3 rounded-2xl flyer-btn text-sm uppercase inline-flex items-center justify-center gap-2"
              >
                <span>Get My Own Link</span>
                <ArrowRight className="w-4 h-4" />
              </Link>
            </div>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4">
            {/* Vibrant Card Box */}
            <div
              style={{ backgroundColor: activeTheme.topCardBg }}
              className="rounded-3xl p-5 flyer-card transition-colors duration-200 relative"
            >
              <div className="flex items-center justify-between mb-3">
                <span className="bg-black text-emous-yellow text-xs font-extrabold uppercase tracking-wider px-3 py-1 rounded-full">
                  🔒 Anonymous Note
                </span>
                <button
                  type="button"
                  onClick={handleDicePrompt}
                  className="bg-emous-yellow text-black text-xs font-extrabold px-3 py-1.5 rounded-full border-2 border-black shadow-brutal inline-flex items-center gap-1.5 hover:bg-emous-lime transition-colors"
                  title="Shuffle random question & color"
                >
                  <Dices className="w-4 h-4" />
                  <span>🎲 Shuffle Idea</span>
                </button>
              </div>

              <textarea
                value={question}
                onChange={(e) =>
                  setQuestion(e.target.value.slice(0, BRAND.maxPostLength))
                }
                rows={4}
                placeholder="Type your deepest secret here... 👀🔥"
                style={{ color: activeTheme.topCardText }}
                className="w-full bg-black/15 placeholder:text-current/70 rounded-2xl p-4 font-sans font-bold text-lg sm:text-xl focus:outline-none focus:ring-4 focus:ring-black/40 resize-none border-2 border-black/30"
              />

              <div
                style={{ color: activeTheme.topCardText }}
                className="mt-2 flex items-center justify-between text-xs font-extrabold"
              >
                <span>🔥 Auto-burns in 30 days</span>
                <span>
                  {question.length}/{BRAND.maxPostLength}
                </span>
              </div>
            </div>

            {errorMsg && (
              <div className="bg-emous-yellow text-black font-bold text-sm px-4 py-2.5 rounded-2xl border-2 border-black shadow-brutal text-center">
                {errorMsg}
              </div>
            )}

            {/* Giant Neon CTA Button */}
            <button
              type="submit"
              disabled={isSending}
              className="w-full bg-emous-pink hover:bg-[#ff3399] text-white font-display font-extrabold text-xl sm:text-2xl py-4 px-6 rounded-2xl flyer-btn flex items-center justify-center gap-3 uppercase tracking-wide disabled:opacity-60"
            >
              <span>{isSending ? 'Encrypting & Sending...' : 'Send Anonymously 🚀'}</span>
            </button>
          </form>
        )}

        {/* Secondary link to explore live Global/Local Feed */}
        <div className="mt-6 text-center">
          <Link
            href="/"
            className="inline-flex items-center gap-2 text-xs sm:text-sm font-bold text-neutral-300 hover:text-emous-lime underline underline-offset-4"
          >
            <Flame className="w-4 h-4 text-emous-pink" />
            <span>
              Or browse live anonymous confessions happening right now →
            </span>
          </Link>
        </div>
      </main>

      {/* Screen 3 Requirement: Sticky Growth Loop Footer */}
      <footer className="fixed bottom-0 inset-x-0 z-40 bg-emous-surface/95 backdrop-blur-md border-t-4 border-black px-4 py-3">
        <div className="max-w-lg mx-auto flex flex-col sm:flex-row items-center justify-between gap-2.5">
          <div className="text-center sm:text-left">
            <p className="text-xs sm:text-sm font-extrabold text-emous-lime flex items-center justify-center sm:justify-start gap-1.5">
              <Sparkles className="w-4 h-4 text-emous-yellow shrink-0" />
              <span>{BRAND.growthFooterText}</span>
            </p>
            {senderHandle && (
              <p className="text-[11px] text-neutral-300 font-medium">
                Your instant handle{' '}
                <span className="text-emous-yellow font-bold">
                  @{senderHandle}
                </span>{' '}
                is ready!
              </p>
            )}
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <Link
              href="/?tab=inbox"
              className="bg-emous-yellow text-black font-display font-extrabold text-xs px-3.5 py-2 rounded-xl flyer-btn uppercase"
            >
              Claim My Link 🔗
            </Link>
            <Link
              href="/?tab=inbox"
              className="bg-black text-white border-2 border-white/30 hover:border-emous-pink text-[11px] font-bold px-3 py-1.5 rounded-xl inline-flex items-center gap-1.5"
            >
              <Smartphone className="w-3.5 h-3.5 text-emous-pink" />
              <span>App Store / Play</span>
            </Link>
          </div>
        </div>
      </footer>
    </div>
  );
}
