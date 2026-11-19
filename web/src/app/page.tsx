'use client';

import React, { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import {
  Flame,
  MapPin,
  Globe,
  Plus,
  Dices,
  Flag,
  Hash,
  MessageCircle,
  Copy,
  Check,
  Share2,
  MessageSquareHeart,
  Sparkles,
  RefreshCw,
  Download,
  X,
  ExternalLink,
} from 'lucide-react';
import {
  ALL_BACKGROUNDS,
  BRAND,
  CardBackground,
  CURATED_GRADIENTS,
  InboxMessageDTO,
  POPULAR_TAGS,
  PostDTO,
  REACTION_META,
  REACTION_TYPES,
  ReactionType,
  STORY_COLOR_PAIRS,
  UserIdentityDTO,
  createPost,
  fetchInbox,
  fetchPosts,
  flagInboxMessage,
  flagPost,
  initZeroFrictionIdentity,
  reactToPost,
  replyToInboxMessage,
  rerollHandle,
  shuffleCardBackground,
} from '@/lib/api-bundle';

function formatRelativeTime(iso: string): string {
  const diffSec = Math.max(
    1,
    Math.floor((Date.now() - new Date(iso).getTime()) / 1000)
  );
  if (diffSec < 60) return `${diffSec}s ago`;
  const diffMin = Math.floor(diffSec / 60);
  if (diffMin < 60) return `${diffMin}m ago`;
  const diffHr = Math.floor(diffMin / 60);
  if (diffHr < 24) return `${diffHr}h ago`;
  return `${Math.floor(diffHr / 24)}d ago`;
}

/**
 * Generates a high-resolution 1080x1920 (9:16) PNG image for Instagram/Snapchat Stories
 * directly using HTML5 Canvas so users can download or share their Q&A card in 1 click.
 */
function wrapCanvasText(
  ctx: CanvasRenderingContext2D,
  text: string,
  x: number,
  y: number,
  maxWidth: number,
  lineHeight: number
): number {
  const words = text.split(' ');
  let line = '';
  let currentY = y;

  for (let n = 0; n < words.length; n++) {
    const testLine = line + words[n] + ' ';
    const metrics = ctx.measureText(testLine);
    if (metrics.width > maxWidth && n > 0) {
      ctx.fillText(line.trim(), x, currentY);
      line = words[n] + ' ';
      currentY += lineHeight;
    } else {
      line = testLine;
    }
  }
  ctx.fillText(line.trim(), x, currentY);
  return currentY + lineHeight;
}

function downloadStoryPng(params: {
  handle: string;
  question: string;
  reply: string;
  themeId: string;
}) {
  const theme =
    STORY_COLOR_PAIRS.find((t) => t.id === params.themeId) ||
    STORY_COLOR_PAIRS[0];
  const canvas = document.createElement('canvas');
  canvas.width = 1080;
  canvas.height = 1920;
  const ctx = canvas.getContext('2d');
  if (!ctx) return;

  // 1. Background
  ctx.fillStyle = theme.canvasBg;
  ctx.fillRect(0, 0, 1080, 1920);

  // Decorative neon glow circles
  ctx.fillStyle = 'rgba(255, 30, 142, 0.16)';
  ctx.beginPath();
  ctx.arc(200, 300, 320, 0, Math.PI * 2);
  ctx.fill();

  ctx.fillStyle = 'rgba(204, 255, 0, 0.14)';
  ctx.beginPath();
  ctx.arc(880, 1500, 360, 0, Math.PI * 2);
  ctx.fill();

  // Top Header Pill
  ctx.fillStyle = '#FFE600';
  ctx.fillRect(310, 120, 460, 74);
  ctx.strokeStyle = '#000000';
  ctx.lineWidth = 8;
  ctx.strokeRect(310, 120, 460, 74);
  ctx.fillStyle = '#0D0D11';
  ctx.font = '900 32px sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText(`ASK @${params.handle.toUpperCase()}`, 540, 168);

  // 2. Top Card: Anonymous Question
  const cardX = 90;
  const topCardY = 270;
  const cardW = 900;
  const topCardH = 620;

  // Hard offset shadow
  ctx.fillStyle = '#000000';
  ctx.fillRect(cardX + 18, topCardY + 18, cardW, topCardH);

  ctx.fillStyle = theme.topCardBg;
  ctx.fillRect(cardX, topCardY, cardW, topCardH);
  ctx.strokeStyle = '#000000';
  ctx.lineWidth = 10;
  ctx.strokeRect(cardX, topCardY, cardW, topCardH);

  // Question Label
  ctx.fillStyle = '#000000';
  ctx.fillRect(cardX + 45, topCardY + 45, 360, 60);
  ctx.fillStyle = '#CCFF00';
  ctx.font = '800 26px sans-serif';
  ctx.textAlign = 'left';
  ctx.fillText('🤫 ANONYMOUS CONFESSION', cardX + 68, topCardY + 84);

  // Question Text
  ctx.fillStyle = theme.topCardText;
  ctx.font = '800 48px sans-serif';
  wrapCanvasText(
    ctx,
    `"${params.question}"`,
    cardX + 55,
    topCardY + 195,
    cardW - 110,
    66
  );

  // 3. Bottom Card: User's Reply
  const bottomCardY = 960;
  const bottomCardH = 620;

  ctx.fillStyle = '#000000';
  ctx.fillRect(cardX + 18, bottomCardY + 18, cardW, bottomCardH);

  ctx.fillStyle = theme.bottomCardBg;
  ctx.fillRect(cardX, bottomCardY, cardW, bottomCardH);
  ctx.strokeStyle = '#000000';
  ctx.lineWidth = 10;
  ctx.strokeRect(cardX, bottomCardY, cardW, bottomCardH);

  // Reply Label
  ctx.fillStyle = '#000000';
  ctx.fillRect(cardX + 45, bottomCardY + 45, 340, 60);
  ctx.fillStyle = '#FFE600';
  ctx.font = '800 26px sans-serif';
  ctx.fillText(`⚡ @${params.handle.toUpperCase()} REPLIED`, cardX + 68, bottomCardY + 84);

  // Reply Text
  ctx.fillStyle = theme.bottomCardText;
  ctx.font = '800 50px sans-serif';
  wrapCanvasText(
    ctx,
    params.reply,
    cardX + 55,
    bottomCardY + 195,
    cardW - 110,
    68
  );

  // 4. Watermark Footer at Bottom
  ctx.fillStyle = '#FF1E8E';
  ctx.fillRect(220, 1690, 640, 110);
  ctx.strokeStyle = '#000000';
  ctx.lineWidth = 8;
  ctx.strokeRect(220, 1690, 640, 110);

  ctx.fillStyle = '#FFFFFF';
  ctx.font = '900 36px sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText(`emous.app/ask/${params.handle}`, 540, 1758);

  const link = document.createElement('a');
  link.download = `emous-story-${params.handle.toLowerCase()}.png`;
  link.href = canvas.toDataURL('image/png');
  link.click();
}

export default function EmousHomeApp() {
  // Active Top-Level Screen ('feed' | 'inbox')
  const [activeScreen, setActiveScreen] = useState<'feed' | 'inbox'>('feed');

  // Zero-Friction User Identity
  const [identity, setIdentity] = useState<UserIdentityDTO | null>(null);
  const [copiedLink, setCopiedLink] = useState(false);

  // Screen 1: Feed State
  const [feedMode, setFeedMode] = useState<'global' | 'near'>('global');
  const [selectedTag, setSelectedTag] = useState<string>('All');
  const [posts, setPosts] = useState<PostDTO[]>([]);
  const [isLoadingFeed, setIsLoadingFeed] = useState(true);
  const [coords, setCoords] = useState<{ lat: number; lng: number }>({
    lat: 40.7128,
    lng: -74.006, // Default Downtown seed coordinates with instant browser GPS override
  });
  const [gpsStatus, setGpsStatus] = useState<string>('5-mile radius active');
  const [toast, setToast] = useState<string | null>(null);

  // Post Composer + 🎲 Card Shuffler State
  const [isComposerOpen, setIsComposerOpen] = useState(false);
  const [draftContent, setDraftContent] = useState('');
  const [draftTag, setDraftTag] = useState<string>(POPULAR_TAGS[0]);
  const [draftBg, setDraftBg] = useState<CardBackground>(CURATED_GRADIENTS[0]);
  const [isPublishing, setIsPublishing] = useState(false);
  const [isShuffling, setIsShuffling] = useState(false);

  // Screen 2 & 4: Inbox + 9:16 Story Reply Generator State
  const [inboxMessages, setInboxMessages] = useState<InboxMessageDTO[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [demoGoldenWizardMode, setDemoGoldenWizardMode] = useState(false);
  const [activeStoryMsg, setActiveStoryMsg] = useState<InboxMessageDTO | null>(
    null
  );
  const [replyText, setReplyText] = useState('');
  const [storyThemeId, setStoryThemeId] = useState<string>('story-pink-lime');
  const [isSavingReply, setIsSavingReply] = useState(false);

  const showToast = (msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(null), 3200);
  };

  // Check URL query param `?tab=inbox`
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const params = new URLSearchParams(window.location.search);
      if (params.get('tab') === 'inbox') {
        setActiveScreen('inbox');
      }
    }
  }, []);

  // 1. Initialize Zero-Friction Identity on load
  useEffect(() => {
    initZeroFrictionIdentity().then((user) => {
      setIdentity(user);
    });
  }, []);

  const currentHandle = demoGoldenWizardMode
    ? 'GoldenWizard'
    : identity?.handle || 'GoldenWizard';

  const STORAGE_POSTS_CACHE = 'emous_posts_cache_v1';
  const STORAGE_INBOX_CACHE = 'emous_inbox_cache_v1';
  const STORAGE_REACTIONS_CACHE = 'emous_reactions_cache_v1';

  const getLocalRxCache = (): Record<
    string,
    { reactions: any; myReactions: any }
  > => {
    if (typeof window === 'undefined') return {};
    try {
      return JSON.parse(localStorage.getItem(STORAGE_REACTIONS_CACHE) || '{}');
    } catch {
      return {};
    }
  };

  // 2. Load Feed Posts (with localStorage reaction & post persistence)
  const loadFeed = useCallback(async () => {
    setIsLoadingFeed(true);
    try {
      const data = await fetchPosts({
        mode: feedMode,
        tag: selectedTag === 'All' ? undefined : selectedTag,
        lat: coords.lat,
        lng: coords.lng,
      });
      const rxCache = getLocalRxCache();
      const merged = data.posts.map((post) => {
        const entry = rxCache[post._id];
        return entry
          ? {
              ...post,
              reactions: entry.reactions || post.reactions,
              myReactions: entry.myReactions || post.myReactions,
            }
          : post;
      });
      setPosts(merged);
      if (typeof window !== 'undefined' && selectedTag === 'All') {
        localStorage.setItem(
          STORAGE_POSTS_CACHE,
          JSON.stringify(merged.slice(0, 60))
        );
      }
    } catch {
      if (typeof window !== 'undefined') {
        try {
          const cached = JSON.parse(
            localStorage.getItem(STORAGE_POSTS_CACHE) || '[]'
          );
          if (cached.length > 0) setPosts(cached);
        } catch {}
      }
    } finally {
      setIsLoadingFeed(false);
    }
  }, [feedMode, selectedTag, coords]);

  useEffect(() => {
    loadFeed();
  }, [loadFeed]);

  // 3. Load Inbox Messages (with background polling & localStorage persistence)
  const loadInbox = useCallback(async () => {
    if (!currentHandle) return;
    const inboxKey = `${STORAGE_INBOX_CACHE}_${currentHandle.toLowerCase()}`;
    try {
      const data = await fetchInbox(currentHandle);
      setInboxMessages(data.messages);
      setUnreadCount(data.unreadCount);
      if (typeof window !== 'undefined') {
        localStorage.setItem(
          inboxKey,
          JSON.stringify(data.messages.slice(0, 80))
        );
      }
    } catch {
      if (typeof window !== 'undefined') {
        try {
          const cached = JSON.parse(localStorage.getItem(inboxKey) || '[]');
          if (cached.length > 0) setInboxMessages(cached);
        } catch {}
      }
    }
  }, [currentHandle]);

  useEffect(() => {
    loadInbox();
    const timer = setInterval(() => {
      loadInbox();
    }, 8000);
    return () => clearInterval(timer);
  }, [loadInbox]);

  // Toggle Near Me (requests browser GPS or uses seed downtown coords so demo works everywhere)
  const handleSelectNearMe = () => {
    setFeedMode('near');
    if (typeof navigator !== 'undefined' && navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          setCoords({
            lat: pos.coords.latitude,
            lng: pos.coords.longitude,
          });
          setGpsStatus('Live GPS (5-mi radius)');
        },
        () => {
          setGpsStatus('Downtown Demo Hub (5-mi radius)');
        },
        { timeout: 4000 }
      );
    }
  };

  // 🎲 Card Shuffler
  const handleShuffleBackground = async () => {
    setIsShuffling(true);
    const nextBg = await shuffleCardBackground(draftBg.id);
    setDraftBg(nextBg);
    setIsShuffling(false);
  };

  // Publish Visual Post
  const handlePublishPost = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!draftContent.trim()) return;
    setIsPublishing(true);
    try {
      const created = await createPost({
        content: draftContent.trim(),
        tag: draftTag,
        background: draftBg,
        authorHandle: currentHandle,
        lat: coords.lat,
        lng: coords.lng,
      });
      setPosts((prev) => [created, ...prev]);
      setDraftContent('');
      setIsComposerOpen(false);
      showToast('🔥 Visual card dropped to the feed!');
    } catch (err: any) {
      showToast(err.message || 'Could not post');
    } finally {
      setIsPublishing(false);
    }
  };

  // Crowdsourced Moderation: Flag Post (Auto-hides at 3 flags)
  const handleFlagPost = async (postId: string) => {
    try {
      const res = await flagPost(postId);
      if (res.isHidden) {
        setPosts((prev) => prev.filter((p) => p._id !== postId));
        showToast('🛡️ Post reached 3 flags and was auto-hidden!');
      } else {
        setPosts((prev) =>
          prev.map((p) =>
            p._id === postId
              ? { ...p, flagsCount: res.flagsCount, isFlaggedByMe: true }
              : p
          )
        );
        showToast(`🚩 Reported (${res.flagsCount}/3 flags to auto-hide)`);
      }
    } catch {
      showToast('Failed to report post');
    }
  };

  // Copy Shareable Inbox Link
  const handleCopyInboxLink = () => {
    const origin =
      typeof window !== 'undefined'
        ? window.location.origin
        : 'https://emous.vercel.app';
    const fullUrl = `${origin}/ask/${currentHandle}`;
    navigator.clipboard?.writeText(fullUrl);
    setCopiedLink(true);
    showToast(`🔗 Copied: ${BRAND.domain}/ask/${currentHandle}`);
    setTimeout(() => setCopiedLink(false), 2500);
  };

  // Open 9:16 Story Share Generator Modal
  const handleOpenStoryGenerator = (msg: InboxMessageDTO) => {
    setActiveStoryMsg(msg);
    setReplyText(msg.reply || '');
    setStoryThemeId(msg.themeId || 'story-pink-lime');
  };

  const handleSaveReplyAndShare = async (downloadPngAfter = false) => {
    if (!activeStoryMsg) return;
    const cleanReply = replyText.trim() || '🤫🔥';
    setIsSavingReply(true);
    try {
      const updated = await replyToInboxMessage(
        activeStoryMsg._id,
        cleanReply,
        storyThemeId
      );
      setActiveStoryMsg(updated);
      setInboxMessages((prev) =>
        prev.map((m) => (m._id === updated._id ? updated : m))
      );
      if (downloadPngAfter) {
        downloadStoryPng({
          handle: currentHandle,
          question: updated.question,
          reply: cleanReply,
          themeId: storyThemeId,
        });
        showToast('📸 Downloaded 9:16 Story Image for IG/Snapchat!');
      } else {
        showToast('✨ Reply saved to your 9:16 Story Card!');
      }
    } catch {
      showToast('Could not save reply');
    } finally {
      setIsSavingReply(false);
    }
  };

  const handleFlagInboxItem = async (msgId: string) => {
    try {
      const res = await flagInboxMessage(msgId, true);
      if (res.isHidden) {
        setInboxMessages((prev) => prev.filter((m) => m._id !== msgId));
        showToast('🛡️ Message hidden from your inbox.');
      }
    } catch {
      showToast('Could not flag message');
    }
  };

  const activeStoryTheme =
    STORY_COLOR_PAIRS.find((t) => t.id === storyThemeId) ||
    STORY_COLOR_PAIRS[0];

  return (
    <div className="min-h-screen pb-28">
      {/* Toast Notification */}
      {toast && (
        <div className="fixed top-4 right-4 z-50 bg-emous-lime text-black font-display font-extrabold text-sm px-5 py-3 rounded-2xl flyer-card animate-bounce">
          {toast}
        </div>
      )}

      {/* Top Streetwear Navigation Header */}
      <header className="sticky top-0 z-30 bg-emous-bg/95 backdrop-blur-md border-b-4 border-black">
        <div className="max-w-5xl mx-auto px-3 sm:px-4 py-2.5 sm:py-3.5 space-y-2 sm:space-y-0 sm:flex sm:items-center sm:justify-between gap-2">
          {/* Top Row on Mobile: Brand Logo + Zero-Friction Handle Pill */}
          <div className="flex items-center justify-between gap-2">
            <button
              onClick={() => setActiveScreen('feed')}
              className="bg-emous-lime text-black font-display font-extrabold text-lg sm:text-2xl px-3 sm:px-4 py-1 rounded-xl sm:rounded-2xl flyer-btn tracking-tight inline-flex items-center gap-1.5 shrink-0"
            >
              <span>emous</span>
              <span className="text-[9px] sm:text-[10px] bg-black text-emous-yellow px-1.5 sm:px-2 py-0.5 rounded-full uppercase">
                MVP
              </span>
            </button>

            <div className="flex items-center gap-1.5 bg-emous-surface border-2 border-black rounded-full px-2.5 sm:px-3 py-1 min-w-0">
              <span className="w-2 h-2 rounded-full bg-emous-lime animate-pulse shrink-0" />
              <span className="text-[11px] sm:text-xs font-extrabold text-emous-yellow truncate max-w-[115px] sm:max-w-[160px]">
                @{currentHandle}
              </span>
              <button
                onClick={async () => {
                  setDemoGoldenWizardMode(false);
                  const next = await rerollHandle();
                  setIdentity(next);
                  showToast(`🎲 Switched handle to @${next.handle}`);
                }}
                title="Roll a new random handle"
                className="ml-0.5 text-neutral-400 hover:text-emous-pink shrink-0"
              >
                <RefreshCw className="w-3 h-3 sm:w-3.5 sm:h-3.5" />
              </button>
            </div>
          </div>

          {/* Primary Screen Switcher: Equal 3-column grid on mobile, inline flex on desktop */}
          <div className="grid grid-cols-3 sm:flex items-center gap-1.5 sm:gap-2.5">
            <button
              onClick={() => setActiveScreen('feed')}
              className={`px-2.5 sm:px-4 py-2 rounded-xl font-display font-extrabold text-[11px] sm:text-sm uppercase flyer-btn flex items-center justify-center gap-1 truncate ${
                activeScreen === 'feed'
                  ? 'bg-emous-pink text-white'
                  : 'bg-emous-surface text-white'
              }`}
            >
              <Flame className="w-3.5 h-3.5 sm:w-4 sm:h-4 shrink-0" />
              <span className="truncate">Feed</span>
            </button>

            <button
              onClick={() => setActiveScreen('inbox')}
              className={`px-2.5 sm:px-4 py-2 rounded-xl font-display font-extrabold text-[11px] sm:text-sm uppercase flyer-btn flex items-center justify-center gap-1 relative truncate ${
                activeScreen === 'inbox'
                  ? 'bg-emous-lime text-black'
                  : 'bg-emous-surface text-white'
              }`}
            >
              <MessageSquareHeart className="w-3.5 h-3.5 sm:w-4 sm:h-4 shrink-0" />
              <span className="truncate">Inbox</span>
              {unreadCount > 0 && (
                <span className="bg-emous-pink text-white border border-black text-[9px] sm:text-[10px] font-extrabold px-1.5 rounded-full shrink-0">
                  {unreadCount}
                </span>
              )}
            </button>

            <button
              onClick={() => setIsComposerOpen(true)}
              className="bg-emous-yellow text-black font-display font-extrabold text-[11px] sm:text-sm px-2.5 sm:px-3.5 py-2 rounded-xl flyer-btn uppercase flex items-center justify-center gap-1 truncate"
            >
              <Plus className="w-3.5 h-3.5 sm:w-4 sm:h-4 stroke-[3] shrink-0" />
              <span className="truncate">Card</span>
            </button>
          </div>
        </div>
      </header>

      {/* =====================================================================
          SCREEN 1: THE VISUAL FEED (Global Tags & 5-Mile Near Me Toggle)
         ===================================================================== */}
      {activeScreen === 'feed' && (
        <main className="max-w-5xl mx-auto px-3 sm:px-4 pt-4 sm:pt-6 space-y-4 sm:space-y-6">
          {/* Feed Mode Toggle Switch + Active GPS / Filter Bar */}
          <div className="bg-emous-surface rounded-2xl sm:rounded-3xl p-3.5 sm:p-5 flyer-card flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 sm:gap-4">
            <div className="min-w-0">
              <span className="inline-block bg-emous-yellow text-black font-display font-extrabold text-[9px] sm:text-[11px] uppercase px-2 py-0.5 rounded border border-black mb-1">
                ZERO-LOGIN COMMUNITY FEED
              </span>
              <h1 className="font-display font-extrabold text-lg sm:text-3xl text-white leading-tight">
                {feedMode === 'global'
                  ? '🌐 Global Tags Feed'
                  : '📍 Near Me (5-Mile Radius)'}
              </h1>
              {feedMode === 'near' && (
                <p className="text-[11px] sm:text-xs font-bold text-emous-lime mt-0.5 flex items-center gap-1 truncate">
                  <MapPin className="w-3.5 h-3.5 shrink-0" />
                  <span className="truncate">MongoDB $near • {gpsStatus}</span>
                </p>
              )}
            </div>

            {/* Dual-Feed Toggle Switch */}
            <div className="bg-black p-1 sm:p-1.5 rounded-xl sm:rounded-2xl border-2 border-white/15 grid grid-cols-2 w-full sm:w-auto sm:inline-flex shrink-0">
              <button
                onClick={() => setFeedMode('global')}
                className={`px-3 sm:px-4 py-1.5 sm:py-2 rounded-lg sm:rounded-xl font-display font-extrabold text-[11px] sm:text-sm uppercase transition-all flex items-center justify-center gap-1.5 truncate ${
                  feedMode === 'global'
                    ? 'bg-emous-lime text-black shadow-brutal'
                    : 'text-neutral-400 hover:text-white'
                }`}
              >
                <Globe className="w-3.5 h-3.5 sm:w-4 sm:h-4 shrink-0" />
                <span className="truncate">Global Tags</span>
              </button>
              <button
                onClick={handleSelectNearMe}
                className={`px-3 sm:px-4 py-1.5 sm:py-2 rounded-lg sm:rounded-xl font-display font-extrabold text-[11px] sm:text-sm uppercase transition-all flex items-center justify-center gap-1.5 truncate ${
                  feedMode === 'near'
                    ? 'bg-emous-pink text-white shadow-brutal'
                    : 'text-neutral-400 hover:text-white'
                }`}
              >
                <MapPin className="w-3.5 h-3.5 sm:w-4 sm:h-4 shrink-0" />
                <span className="truncate">Near Me (5mi)</span>
              </button>
            </div>
          </div>

          {/* Auto-Scrolling Streetwear Hashtag Color-Blocked Pills (pauses on hover) */}
          <div
            className="tag-marquee-viewport no-scrollbar"
            title="Hover to pause scrolling tags"
          >
            <div className="tag-marquee-track">
              {[...['All', ...POPULAR_TAGS], ...['All', ...POPULAR_TAGS]].map(
                (tag, idx) => {
                  const active = selectedTag === tag;
                  return (
                    <button
                      key={`${tag}-${idx}`}
                      onClick={() => setSelectedTag(tag)}
                      className={`shrink-0 px-4 py-2 rounded-full font-display font-extrabold text-xs uppercase flyer-btn ${
                        active
                          ? 'bg-emous-yellow text-black'
                          : 'bg-emous-surface text-white hover:bg-neutral-800'
                      }`}
                    >
                      {tag}
                    </button>
                  );
                }
              )}
            </div>
          </div>

          {/* Visual Content Cards Grid */}
          {isLoadingFeed ? (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {[1, 2, 3, 4].map((n) => (
                <div
                  key={n}
                  className="h-72 rounded-3xl bg-emous-surface animate-pulse flyer-card"
                />
              ))}
            </div>
          ) : posts.length === 0 ? (
            <div className="bg-emous-surface rounded-3xl p-10 text-center flyer-card space-y-4">
              <p className="font-display font-extrabold text-2xl text-emous-yellow">
                No confessions in this filter yet 👀
              </p>
              <button
                onClick={() => setIsComposerOpen(true)}
                className="bg-emous-pink text-white font-display font-extrabold px-6 py-3 rounded-2xl flyer-btn uppercase text-sm"
              >
                Be the First to Drop One 🚀
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {posts.map((post) => {
                const isImage = post.background?.type === 'image';
                const cardStyle: React.CSSProperties = isImage
                  ? {
                      backgroundImage: `linear-gradient(to bottom, rgba(13,13,17,0.35), rgba(13,13,17,0.78)), url(${post.background.value})`,
                      backgroundSize: 'cover',
                      backgroundPosition: 'center',
                    }
                  : {
                      background:
                        post.background?.value || CURATED_GRADIENTS[0].value,
                    };

                const textColor = isImage
                  ? '#FFFFFF'
                  : post.background?.textColor || '#FFFFFF';

                return (
                  <article
                    key={post._id}
                    style={cardStyle}
                    className="rounded-2xl sm:rounded-3xl p-4 sm:p-6 flyer-card flex flex-col justify-between min-h-[205px] sm:min-h-[250px] relative overflow-hidden group transition-transform hover:-translate-y-1"
                  >
                    {/* Top Row: Anonymous Handle Pill + Electric Yellow Timestamp */}
                    <div className="flex items-center justify-between gap-1.5 min-w-0 z-10">
                      <Link
                        href={`/ask/${post.authorHandle}`}
                        className="bg-black/85 text-white text-[11px] sm:text-xs font-extrabold px-2.5 sm:px-3 py-1 rounded-full border-2 border-black inline-flex items-center gap-1 hover:bg-emous-pink transition-colors truncate max-w-[55%]"
                      >
                        <span className="truncate">🎭 @{post.authorHandle}</span>
                      </Link>

                      <div className="flex items-center gap-1 shrink-0">
                        {(post.distanceMiles !== undefined ||
                          post.location?.label) && (
                          <span className="bg-black/80 text-emous-lime text-[10px] sm:text-[11px] font-extrabold px-2 py-0.5 rounded-full border border-black">
                            📍{' '}
                            {post.distanceMiles !== undefined
                              ? `${post.distanceMiles}mi`
                              : post.location?.label}
                          </span>
                        )}
                        <span className="bg-emous-yellow text-black text-[10px] sm:text-[11px] font-extrabold px-2 py-0.5 rounded-full border-2 border-black">
                          {formatRelativeTime(post.createdAt)}
                        </span>
                      </div>
                    </div>

                    {/* Center: Bold 300-Char Confession Copy (Responsive font size on mobile) */}
                    <p
                      style={{ color: textColor }}
                      className="my-4 sm:my-5 font-sans font-extrabold text-[15px] sm:text-lg md:text-xl leading-relaxed tracking-tight break-words z-10 drop-shadow-sm"
                    >
                      “{post.content}”
                    </p>

                    {/* Phase 4: Emoji Reactions Row (🔥, 💀, 👀, ❤️) */}
                    <div className="flex items-center gap-1.5 flex-wrap pb-2 z-10">
                      {REACTION_TYPES.map((type) => {
                        const meta = REACTION_META[type];
                        const count = post.reactions?.[type] ?? 0;
                        const active = post.myReactions?.includes(type);
                        return (
                          <button
                            key={type}
                            onClick={async () => {
                              // 1. Optimistic instant update + localStorage persistence
                              setPosts((prev) =>
                                prev.map((p) => {
                                  if (p._id !== post._id) return p;
                                  const nextRx = {
                                    ...(p.reactions || {
                                      fire: 0,
                                      skull: 0,
                                      eyes: 0,
                                      heart: 0,
                                    }),
                                  };
                                  const nextMy = Array.isArray(p.myReactions)
                                    ? [...p.myReactions]
                                    : [];
                                  const idx = nextMy.indexOf(type);
                                  if (idx >= 0) {
                                    nextMy.splice(idx, 1);
                                    nextRx[type] = Math.max(
                                      0,
                                      (nextRx[type] || 1) - 1
                                    );
                                  } else {
                                    nextMy.push(type);
                                    nextRx[type] = (nextRx[type] || 0) + 1;
                                  }
                                  try {
                                    const cache = getLocalRxCache();
                                    cache[post._id] = {
                                      reactions: nextRx,
                                      myReactions: nextMy,
                                    };
                                    localStorage.setItem(
                                      STORAGE_REACTIONS_CACHE,
                                      JSON.stringify(cache)
                                    );
                                  } catch {}
                                  return {
                                    ...p,
                                    reactions: nextRx,
                                    myReactions: nextMy,
                                  };
                                })
                              );
                              // 2. Sync to Backend API
                              try {
                                const res = await reactToPost(post._id, type);
                                try {
                                  const cache = getLocalRxCache();
                                  cache[post._id] = {
                                    reactions: res.reactions,
                                    myReactions: res.myReactions,
                                  };
                                  localStorage.setItem(
                                    STORAGE_REACTIONS_CACHE,
                                    JSON.stringify(cache)
                                  );
                                } catch {}
                                setPosts((prev) =>
                                  prev.map((p) =>
                                    p._id === post._id
                                      ? {
                                          ...p,
                                          reactions: res.reactions,
                                          myReactions: res.myReactions,
                                        }
                                      : p
                                  )
                                );
                              } catch {}
                            }}
                            className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-extrabold border-2 border-black shadow-brutal transition-transform active:scale-95 ${
                              active
                                ? 'bg-emous-yellow text-black'
                                : 'bg-black/80 text-white hover:bg-black'
                            }`}
                          >
                            <span>{meta.emoji}</span>
                            <span>{count}</span>
                          </button>
                        );
                      })}
                    </div>

                    {/* Bottom Row: Icon-Only Action Pills that reveal labels on hover */}
                    <div className="flex items-center justify-between gap-2 pt-2 z-10">
                      <button
                        onClick={() => setSelectedTag(post.tag)}
                        style={{
                          backgroundColor:
                            post.background?.badgeBg || '#CCFF00',
                          color: post.background?.badgeText || '#0D0D11',
                        }}
                        className="card-action-pill"
                        aria-label={`Filter by ${post.tag}`}
                      >
                        <Hash className="w-4 h-4 shrink-0 stroke-[2.8]" />
                        <span className="card-action-label">
                          {post.tag.replace(/^#/, '')}
                        </span>
                      </button>

                      <div className="flex items-center gap-2">
                        <Link
                          href={`/ask/${post.authorHandle}`}
                          className="card-action-pill bg-white text-black hover:bg-emous-lime"
                          aria-label="Ask Secret"
                        >
                          <MessageCircle className="w-4 h-4 shrink-0 stroke-[2.5]" />
                          <span className="card-action-label">Ask Secret</span>
                        </Link>

                        <button
                          onClick={() => handleFlagPost(post._id)}
                          aria-label="Report post (Auto-hides at 3 flags)"
                          className={`card-action-pill transition-colors ${
                            post.isFlaggedByMe
                              ? 'bg-emous-pink text-white'
                              : 'bg-black/85 text-white hover:bg-red-600'
                          }`}
                        >
                          <Flag className="w-4 h-4 shrink-0 text-emous-pink fill-current" />
                          <span className="card-action-label">
                            {post.flagsCount > 0
                              ? `Report (${post.flagsCount}/3)`
                              : 'Report'}
                          </span>
                        </button>
                      </div>
                    </div>
                  </article>
                );
              })}
            </div>
          )}
        </main>
      )}

      {/* =====================================================================
          SCREEN 2: "GET YOUR LINK" INBOX DASHBOARD
         ===================================================================== */}
      {activeScreen === 'inbox' && (
        <main className="max-w-4xl mx-auto px-4 pt-6 space-y-6">
          {/* Bright Hook Banner */}
          <div className="bg-emous-lime text-black rounded-3xl p-6 sm:p-8 flyer-card relative overflow-hidden">
            <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-6">
              <div className="space-y-2 max-w-xl">
                <div className="inline-flex items-center gap-2 bg-black text-emous-yellow text-xs font-display font-extrabold px-3 py-1 rounded-full uppercase">
                  <Sparkles className="w-3.5 h-3.5" />
                  <span>VIRAL ANONYMOUS INBOX</span>
                </div>
                <h1 className="font-display font-extrabold text-2xl sm:text-4xl leading-tight">
                  {BRAND.inboxHook}
                </h1>
                <p className="text-sm font-bold text-neutral-800">
                  Anyone with your link can drop anonymous confessions from the
                  web with zero login. All messages auto-burn in 30 days! 🔥
                </p>
              </div>

              {/* Switch between your handle & @GoldenWizard demo inbox */}
              <button
                onClick={() => setDemoGoldenWizardMode((prev) => !prev)}
                className="bg-white text-black text-xs font-extrabold px-3.5 py-2 rounded-xl border-2 border-black shadow-brutal self-start md:self-center shrink-0"
              >
                {demoGoldenWizardMode
                  ? '👤 Switch to My Handle'
                  : '🧙‍♂️ Preview @GoldenWizard Demo Inbox'}
              </button>
            </div>

            {/* Unmissable Link Copy Box */}
            <div className="mt-6 bg-white rounded-2xl p-3 sm:p-4 border-3 border-black shadow-brutal flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
              <div className="flex items-center gap-3 px-2 overflow-hidden">
                <span className="bg-emous-pink text-white font-display font-extrabold text-xs px-2.5 py-1 rounded-lg border-2 border-black shrink-0">
                  LINK
                </span>
                <span className="font-display font-extrabold text-base sm:text-xl text-black truncate">
                  emous.app/ask/{currentHandle}
                </span>
              </div>

              <div className="flex items-center gap-2 shrink-0">
                <button
                  onClick={handleCopyInboxLink}
                  className="flex-1 sm:flex-initial bg-emous-pink text-white font-display font-extrabold text-sm sm:text-base px-5 py-3 rounded-xl flyer-btn uppercase inline-flex items-center justify-center gap-2"
                >
                  {copiedLink ? (
                    <>
                      <Check className="w-5 h-5" />
                      <span>Copied!</span>
                    </>
                  ) : (
                    <>
                      <Copy className="w-5 h-5" />
                      <span>Copy My Link 🔗</span>
                    </>
                  )}
                </button>

                <Link
                  href={`/ask/${currentHandle}`}
                  target="_blank"
                  className="bg-emous-yellow text-black font-display font-extrabold text-sm px-4 py-3 rounded-xl flyer-btn inline-flex items-center gap-1.5"
                  title="Open your public web receiver landing page"
                >
                  <ExternalLink className="w-4 h-4" />
                  <span className="hidden md:inline">Test Receiver</span>
                </Link>
              </div>
            </div>
          </div>

          {/* Inbox Secret Notes Grid */}
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="font-display font-extrabold text-xl sm:text-2xl flex items-center gap-2">
                <span>🕵️ Secret Notes for @{currentHandle}</span>
                <span className="bg-emous-yellow text-black text-xs px-2.5 py-0.5 rounded-full border-2 border-black">
                  {inboxMessages.length}
                </span>
              </h2>
              <button
                onClick={loadInbox}
                className="text-xs font-bold text-emous-lime hover:underline inline-flex items-center gap-1"
              >
                <RefreshCw className="w-3.5 h-3.5" />
                <span>Refresh Inbox</span>
              </button>
            </div>

            {inboxMessages.length === 0 ? (
              <div className="bg-emous-surface rounded-3xl p-10 text-center flyer-card space-y-4">
                <p className="font-display font-extrabold text-xl text-emous-yellow">
                  Your secret inbox is waiting for its first confession! 🤫
                </p>
                <p className="text-sm text-neutral-300 max-w-md mx-auto">
                  Tap <strong>Test Receiver</strong> above to send yourself a
                  test anonymous message, or switch to{' '}
                  <strong>@GoldenWizard Demo Inbox</strong> to inspect pre-loaded
                  confessions.
                </p>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                {inboxMessages.map((msg) => {
                  const pair =
                    STORY_COLOR_PAIRS.find((t) => t.id === msg.themeId) ||
                    STORY_COLOR_PAIRS[0];
                  return (
                    <div
                      key={msg._id}
                      className="bg-emous-surface rounded-3xl p-5 flyer-card flex flex-col justify-between gap-4 border-3 border-black relative"
                    >
                      <div className="flex items-center justify-between gap-2">
                        <span
                          style={{
                            backgroundColor: msg.isRead ? '#FFE600' : '#FF1E8E',
                            color: msg.isRead ? '#0D0D11' : '#FFFFFF',
                          }}
                          className="text-[11px] font-display font-extrabold uppercase px-3 py-1 rounded-full border-2 border-black"
                        >
                          {msg.isRead ? '✉️ Opened Note' : '🔥 New Secret Note'}
                        </span>

                        <span className="text-xs font-bold text-neutral-400">
                          {formatRelativeTime(msg.createdAt)} • Burns in 30d
                        </span>
                      </div>

                      {/* Question Bubble */}
                      <div
                        style={{
                          backgroundColor: pair.topCardBg,
                          color: pair.topCardText,
                        }}
                        className="rounded-2xl p-4 border-2 border-black shadow-brutal font-sans font-extrabold text-lg"
                      >
                        “{msg.question}”
                      </div>

                      {/* Existing Reply Preview if answered */}
                      {msg.reply && (
                        <div
                          style={{
                            backgroundColor: pair.bottomCardBg,
                            color: pair.bottomCardText,
                          }}
                          className="rounded-2xl p-3.5 border-2 border-black text-sm font-bold"
                        >
                          <span className="block text-[10px] uppercase font-extrabold opacity-75 mb-0.5">
                            Your Story Reply:
                          </span>
                          {msg.reply}
                        </div>
                      )}

                      <div className="flex items-center justify-between gap-2 pt-1">
                        <button
                          onClick={() => handleOpenStoryGenerator(msg)}
                          className="flex-1 bg-emous-lime text-black font-display font-extrabold text-xs sm:text-sm py-2.5 px-4 rounded-xl flyer-btn uppercase inline-flex items-center justify-center gap-2"
                        >
                          <Share2 className="w-4 h-4" />
                          <span>
                            {msg.reply
                              ? 'Share 9:16 Story Card'
                              : 'Reply & Share Story 📸'}
                          </span>
                        </button>

                        <button
                          onClick={() => handleFlagInboxItem(msg._id)}
                          title="Hide / Report message"
                          className="bg-black text-neutral-300 hover:text-white hover:bg-red-600 p-2.5 rounded-xl border-2 border-black"
                        >
                          <Flag className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </main>
      )}

      {/* =====================================================================
          MODAL 1: CREATE VISUAL CARD POST + 🎲 CARD SHUFFLER
         ===================================================================== */}
      {isComposerOpen && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-emous-surface w-full max-w-lg rounded-3xl p-6 flyer-card space-y-4 animate-fadeIn">
            <div className="flex items-center justify-between">
              <span className="bg-emous-lime text-black font-display font-extrabold text-xs uppercase px-3 py-1 rounded-full border-2 border-black">
                NEW VISUAL CONFESSION
              </span>
              <button
                onClick={() => setIsComposerOpen(false)}
                className="bg-black text-white p-1.5 rounded-xl border-2 border-white/20"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handlePublishPost} className="space-y-4">
              {/* Live Visual Card Preview with 🎲 Shuffler */}
              <div
                style={
                  draftBg.type === 'image'
                    ? {
                        backgroundImage: `linear-gradient(to bottom, rgba(13,13,17,0.35), rgba(13,13,17,0.8)), url(${draftBg.value})`,
                        backgroundSize: 'cover',
                        backgroundPosition: 'center',
                      }
                    : { background: draftBg.value }
                }
                className="rounded-3xl p-5 flyer-card min-h-[220px] flex flex-col justify-between"
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="bg-black/80 text-white text-xs font-extrabold px-3 py-1 rounded-full">
                    🎭 @{currentHandle}
                  </span>

                  <button
                    type="button"
                    onClick={handleShuffleBackground}
                    disabled={isShuffling}
                    className="bg-emous-yellow text-black font-display font-extrabold text-xs px-3.5 py-1.5 rounded-full border-2 border-black shadow-brutal inline-flex items-center gap-1.5 hover:bg-emous-lime transition-transform active:scale-95"
                  >
                    <Dices className="w-4 h-4" />
                    <span>🎲 Shuffle BG ({draftBg.name})</span>
                  </button>
                </div>

                <textarea
                  value={draftContent}
                  onChange={(e) =>
                    setDraftContent(e.target.value.slice(0, BRAND.maxPostLength))
                  }
                  rows={3}
                  placeholder="Drop an anonymous confession, unpopular opinion, or local sighting..."
                  style={{
                    color:
                      draftBg.type === 'image' ? '#FFFFFF' : draftBg.textColor,
                  }}
                  className="w-full bg-transparent placeholder:text-current/65 font-sans font-extrabold text-xl focus:outline-none resize-none my-3"
                />

                <div className="flex items-center justify-between text-xs font-extrabold">
                  <span
                    style={{
                      backgroundColor: draftBg.badgeBg,
                      color: draftBg.badgeText,
                    }}
                    className="px-3 py-1 rounded-lg border-2 border-black"
                  >
                    {draftTag}
                  </span>
                  <span className="bg-black/75 text-white px-2.5 py-1 rounded-full">
                    {draftContent.length}/{BRAND.maxPostLength}
                  </span>
                </div>
              </div>

              {/* Select Hashtag Pill */}
              <div>
                <label className="block text-xs font-extrabold uppercase text-neutral-400 mb-2">
                  Pick a Feed Tag:
                </label>
                <div className="flex flex-wrap gap-1.5">
                  {POPULAR_TAGS.map((t) => (
                    <button
                      type="button"
                      key={t}
                      onClick={() => setDraftTag(t)}
                      className={`text-xs font-display font-extrabold px-3 py-1.5 rounded-xl border-2 border-black ${
                        draftTag === t
                          ? 'bg-emous-pink text-white'
                          : 'bg-black text-neutral-300'
                      }`}
                    >
                      {t}
                    </button>
                  ))}
                </div>
              </div>

              <button
                type="submit"
                disabled={isPublishing || !draftContent.trim()}
                className="w-full bg-emous-lime text-black font-display font-extrabold text-lg py-3.5 rounded-2xl flyer-btn uppercase disabled:opacity-50"
              >
                {isPublishing ? 'Posting...' : 'Drop Anonymous Card 🚀'}
              </button>
            </form>
          </div>
        </div>
      )}

      {/* =====================================================================
          SCREEN 4: 9:16 INSTAGRAM / SNAPCHAT STORY SHARE GENERATOR
         ===================================================================== */}
      {activeStoryMsg && (
        <div className="fixed inset-0 z-50 bg-black/85 backdrop-blur-md flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-emous-surface w-full max-w-3xl rounded-3xl p-5 sm:p-6 flyer-card grid grid-cols-1 md:grid-cols-2 gap-6 items-center my-auto">
            {/* Left Column: Perfectly Proportioned 9:16 Vertical Story Card Preview */}
            <div className="flex justify-center">
              <div
                style={{ backgroundColor: activeStoryTheme.canvasBg }}
                className="w-[270px] h-[480px] rounded-3xl p-4 flyer-card flex flex-col justify-between relative overflow-hidden select-none"
              >
                {/* Header Badge */}
                <div className="text-center">
                  <span className="inline-block bg-emous-yellow text-black font-display font-extrabold text-[10px] uppercase px-3 py-1 rounded-md border-2 border-black shadow-brutal">
                    ASK @{currentHandle}
                  </span>
                </div>

                {/* Top Card: Vibrant Question Box */}
                <div
                  style={{
                    backgroundColor: activeStoryTheme.topCardBg,
                    color: activeStoryTheme.topCardText,
                  }}
                  className="rounded-2xl p-3.5 border-2 border-black shadow-brutal space-y-1.5"
                >
                  <span className="inline-block bg-black text-emous-lime text-[9px] font-extrabold uppercase px-2 py-0.5 rounded">
                    🤫 ANONYMOUS CONFESSION
                  </span>
                  <p className="font-sans font-extrabold text-sm leading-snug line-clamp-4">
                    “{activeStoryMsg.question}”
                  </p>
                </div>

                {/* Bottom Card: Contrasting Response Box */}
                <div
                  style={{
                    backgroundColor: activeStoryTheme.bottomCardBg,
                    color: activeStoryTheme.bottomCardText,
                  }}
                  className="rounded-2xl p-3.5 border-2 border-black shadow-brutal space-y-1.5"
                >
                  <span className="inline-block bg-black text-emous-yellow text-[9px] font-extrabold uppercase px-2 py-0.5 rounded">
                    ⚡ @{currentHandle} REPLIED
                  </span>
                  <p className="font-sans font-extrabold text-sm leading-snug line-clamp-4">
                    {replyText.trim() || 'Type your reply on the right... 👀'}
                  </p>
                </div>

                {/* Subtle but Clear Watermark at Bottom */}
                <div className="text-center">
                  <span className="inline-block bg-emous-pink text-white font-display font-extrabold text-[10px] px-3 py-1 rounded-full border-2 border-black">
                    emous.app/ask/{currentHandle}
                  </span>
                </div>
              </div>
            </div>

            {/* Right Column: Controls, Color Combos & 1-Tap PNG Download */}
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <span className="text-xs font-extrabold uppercase text-emous-lime">
                    9:16 STORY GENERATOR
                  </span>
                  <h3 className="font-display font-extrabold text-2xl">
                    Reply & Share to Story
                  </h3>
                </div>
                <button
                  onClick={() => setActiveStoryMsg(null)}
                  className="bg-black text-white p-2 rounded-xl border-2 border-white/20"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <div>
                <label className="block text-xs font-extrabold uppercase text-neutral-300 mb-1.5">
                  Your Comeback / Reply:
                </label>
                <textarea
                  value={replyText}
                  onChange={(e) =>
                    setReplyText(e.target.value.slice(0, BRAND.maxPostLength))
                  }
                  rows={3}
                  placeholder="Type your response for the bottom card..."
                  className="w-full bg-black text-white rounded-2xl p-3.5 border-2 border-white/25 font-sans font-bold text-base focus:outline-none focus:border-emous-lime resize-none"
                />
              </div>

              <div>
                <label className="block text-xs font-extrabold uppercase text-neutral-300 mb-1.5">
                  Color Combo Contrast:
                </label>
                <div className="flex flex-wrap gap-2">
                  {STORY_COLOR_PAIRS.map((pair) => (
                    <button
                      key={pair.id}
                      type="button"
                      onClick={() => setStoryThemeId(pair.id)}
                      className={`px-3 py-1.5 rounded-xl text-xs font-extrabold border-2 border-black ${
                        storyThemeId === pair.id
                          ? 'bg-emous-yellow text-black shadow-brutal'
                          : 'bg-black text-neutral-300'
                      }`}
                    >
                      {pair.name}
                    </button>
                  ))}
                </div>
              </div>

              <div className="pt-2 space-y-2.5">
                <button
                  type="button"
                  disabled={isSavingReply}
                  onClick={() => handleSaveReplyAndShare(true)}
                  className="w-full bg-emous-pink text-white font-display font-extrabold text-base py-3.5 px-5 rounded-2xl flyer-btn uppercase flex items-center justify-center gap-2"
                >
                  <Download className="w-5 h-5" />
                  <span>Download 9:16 Story Image (PNG)</span>
                </button>

                <button
                  type="button"
                  disabled={isSavingReply}
                  onClick={() => handleSaveReplyAndShare(false)}
                  className="w-full bg-emous-lime text-black font-display font-extrabold text-xs py-2.5 px-4 rounded-xl flyer-btn uppercase"
                >
                  Save Reply Only
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
