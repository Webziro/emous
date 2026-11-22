'use client';

import React, { useState, useEffect, useCallback, useRef } from 'react';
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
  Bell,
  TrendingUp,
  Volume2,
  VolumeX,
  Send,
  Clock,
  Eye,
} from 'lucide-react';
import {
  ALL_BACKGROUNDS,
  BRAND,
  calculateStreetCred,
  CardBackground,
  classifyPostTopics,
  CURATED_GRADIENTS,
  InboxMessageDTO,
  POPULAR_TAGS,
  PostDTO,
  REACTION_META,
  REACTION_TYPES,
  ReactionType,
  STORY_COLOR_PAIRS,
  TrendingPhraseItem,
  TrendingTagItem,
  UserIdentityDTO,
  addPostComment,
  createPost,
  fetchInbox,
  fetchPosts,
  fetchTrendingData,
  flagInboxMessage,
  flagPost,
  initZeroFrictionIdentity,
  reactToPost,
  replyToInboxMessage,
  rerollHandle,
  shuffleCardBackground,
  voteOnPostPoll,
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

function formatBurnCountdown(createdAtIso: string): string {
  const createdMs = new Date(createdAtIso).getTime();
  const expiresMs = createdMs + BRAND.inboxBurnSeconds * 1000;
  const remainingMs = Math.max(0, expiresMs - Date.now());
  const days = Math.floor(remainingMs / (1000 * 60 * 60 * 24));
  const hours = Math.floor(
    (remainingMs % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60)
  );
  return `${days}d ${hours}h left`;
}

let sharedAudioCtx: AudioContext | null = null;

function getUnlockedAudioContext(): AudioContext | null {
  if (typeof window === 'undefined') return null;
  try {
    const AudioCtx =
      window.AudioContext || (window as any).webkitAudioContext;
    if (!AudioCtx) return null;
    if (!sharedAudioCtx) {
      sharedAudioCtx = new AudioCtx();
    }
    if (sharedAudioCtx.state === 'suspended') {
      sharedAudioCtx.resume().catch(() => {});
    }
    return sharedAudioCtx;
  } catch {
    return null;
  }
}

/**
 * Rings a bright, unmistakable multi-pulse bell chime + triggers mobile haptic vibration
 * when a new message or feed post arrives and sound is turned ON.
 */
function triggerBellRingAndVibrate(enabled = true) {
  if (!enabled || typeof window === 'undefined') return;

  // 1. Trigger Native Device Vibration (Android & supported mobile browsers)
  try {
    if (typeof navigator !== 'undefined' && typeof navigator.vibrate === 'function') {
      navigator.vibrate([180, 90, 220, 90, 260]);
    }
  } catch {}

  // 2. Play Rich Metallic Bell Ring via Web Audio API
  try {
    const ctx = getUnlockedAudioContext();
    if (!ctx) return;
    const now = ctx.currentTime;

    const strikeBell = (freq: number, startTime: number, duration: number, vol = 0.28) => {
      // Fundamental tone
      const osc1 = ctx.createOscillator();
      // Metallic overtone
      const osc2 = ctx.createOscillator();
      const gain = ctx.createGain();

      osc1.type = 'sine';
      osc2.type = 'triangle';
      osc1.frequency.setValueAtTime(freq, startTime);
      osc2.frequency.setValueAtTime(freq * 2.0, startTime);

      gain.gain.setValueAtTime(0.001, startTime);
      gain.gain.linearRampToValueAtTime(vol, startTime + 0.015);
      gain.gain.exponentialRampToValueAtTime(0.0008, startTime + duration);

      osc1.connect(gain);
      osc2.connect(gain);
      gain.connect(ctx.destination);

      osc1.start(startTime);
      osc2.start(startTime);
      osc1.stop(startTime + duration);
      osc2.stop(startTime + duration);
    };

    // Double bell ring ("Ding-Dong-Ding!")
    strikeBell(880.0, now, 0.22, 0.3);          // A5
    strikeBell(1174.66, now + 0.14, 0.26, 0.32); // D6
    strikeBell(1318.51, now + 0.30, 0.45, 0.35); // E6
  } catch {}
}

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

  ctx.fillStyle = theme.canvasBg;
  ctx.fillRect(0, 0, 1080, 1920);

  ctx.fillStyle = '#FFE600';
  ctx.fillRect(290, 120, 500, 76);
  ctx.strokeStyle = '#000000';
  ctx.lineWidth = 8;
  ctx.strokeRect(290, 120, 500, 76);
  ctx.fillStyle = '#0D0D11';
  ctx.font = '900 32px sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText(`ASK @${params.handle.toUpperCase()}`, 540, 170);

  const cardX = 90;
  const topCardY = 270;
  const cardW = 900;
  const topCardH = 620;

  ctx.fillStyle = '#000000';
  ctx.fillRect(cardX + 18, topCardY + 18, cardW, topCardH);
  ctx.fillStyle = theme.topCardBg;
  ctx.fillRect(cardX, topCardY, cardW, topCardH);
  ctx.strokeStyle = '#000000';
  ctx.lineWidth = 10;
  ctx.strokeRect(cardX, topCardY, cardW, topCardH);

  ctx.fillStyle = '#000000';
  ctx.fillRect(cardX + 45, topCardY + 45, 360, 60);
  ctx.fillStyle = '#CCFF00';
  ctx.font = '800 26px sans-serif';
  ctx.textAlign = 'left';
  ctx.fillText('🤫 ANONYMOUS CONFESSION', cardX + 68, topCardY + 84);

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

  const bottomCardY = 960;
  const bottomCardH = 620;

  ctx.fillStyle = '#000000';
  ctx.fillRect(cardX + 18, bottomCardY + 18, cardW, bottomCardH);
  ctx.fillStyle = theme.bottomCardBg;
  ctx.fillRect(cardX, bottomCardY, cardW, bottomCardH);
  ctx.strokeStyle = '#000000';
  ctx.lineWidth = 10;
  ctx.strokeRect(cardX, bottomCardY, cardW, bottomCardH);

  ctx.fillStyle = '#000000';
  ctx.fillRect(cardX + 45, bottomCardY + 45, 340, 60);
  ctx.fillStyle = '#FFE600';
  ctx.font = '800 26px sans-serif';
  ctx.fillText(
    `⚡ @${params.handle.toUpperCase()} REPLIED`,
    cardX + 68,
    bottomCardY + 84
  );

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

  ctx.fillStyle = '#FF1E8E';
  ctx.fillRect(220, 1690, 640, 110);
  ctx.strokeStyle = '#000000';
  ctx.lineWidth = 8;
  ctx.strokeRect(220, 1690, 640, 110);

  ctx.fillStyle = '#FFFFFF';
  ctx.font = '900 36px sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText(`${BRAND.domain}/${params.handle}`, 540, 1758);

  const link = document.createElement('a');
  link.download = `emous-story-${params.handle.toLowerCase()}.png`;
  link.href = canvas.toDataURL('image/png');
  link.click();
}

function downloadFeedCardStoryPng(post: PostDTO) {
  const canvas = document.createElement('canvas');
  canvas.width = 1080;
  canvas.height = 1920;
  const ctx = canvas.getContext('2d');
  if (!ctx) return;

  ctx.fillStyle = '#0D0D11';
  ctx.fillRect(0, 0, 1080, 1920);

  ctx.fillStyle = '#CCFF00';
  ctx.fillRect(260, 130, 560, 82);
  ctx.strokeStyle = '#000000';
  ctx.lineWidth = 8;
  ctx.strokeRect(260, 130, 560, 82);
  ctx.fillStyle = '#0D0D11';
  ctx.font = '900 34px sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText('🔥 EMOUS COMMUNITY FEED', 540, 184);

  const cardX = 85;
  const cardY = 290;
  const cardW = 910;
  const cardH = 1180;

  ctx.fillStyle = '#000000';
  ctx.fillRect(cardX + 20, cardY + 20, cardW, cardH);

  const colors = post.background?.colors || ['#FF1E8E', '#7928CA'];
  const grad = ctx.createLinearGradient(
    cardX,
    cardY,
    cardX + cardW,
    cardY + cardH
  );
  grad.addColorStop(0, colors[0] || '#FF1E8E');
  grad.addColorStop(1, colors[1] || '#7928CA');
  ctx.fillStyle = grad;
  ctx.fillRect(cardX, cardY, cardW, cardH);
  ctx.lineWidth = 10;
  ctx.strokeRect(cardX, cardY, cardW, cardH);

  ctx.fillStyle = '#000000';
  ctx.fillRect(cardX + 55, cardY + 55, 420, 68);
  ctx.fillStyle = '#FFFFFF';
  ctx.font = '800 28px sans-serif';
  ctx.textAlign = 'left';
  ctx.fillText(`🎭 @${post.authorHandle}`, cardX + 80, cardY + 99);

  ctx.fillStyle = post.background?.textColor || '#FFFFFF';
  ctx.font = '900 52px sans-serif';
  wrapCanvasText(
    ctx,
    `“${post.content}”`,
    cardX + 60,
    cardY + 240,
    cardW - 120,
    72
  );

  ctx.fillStyle = post.background?.badgeBg || '#CCFF00';
  ctx.fillRect(cardX + 55, cardY + cardH - 135, 390, 74);
  ctx.strokeRect(cardX + 55, cardY + cardH - 135, 390, 74);
  ctx.fillStyle = post.background?.badgeText || '#0D0D11';
  ctx.font = '900 28px sans-serif';
  ctx.fillText(post.tag, cardX + 80, cardY + cardH - 88);

  const rx = post.reactions || { fire: 0, skull: 0, eyes: 0, heart: 0 };
  ctx.fillStyle = '#000000';
  ctx.fillRect(cardX + 475, cardY + cardH - 135, 380, 74);
  ctx.fillStyle = '#FFE600';
  ctx.font = '800 26px sans-serif';
  ctx.fillText(
    `🔥 ${rx.fire}  💀 ${rx.skull}  👀 ${rx.eyes}  ❤️ ${rx.heart}`,
    cardX + 500,
    cardY + cardH - 88
  );

  ctx.fillStyle = '#FF1E8E';
  ctx.fillRect(200, 1620, 680, 112);
  ctx.strokeRect(200, 1620, 680, 112);
  ctx.fillStyle = '#FFFFFF';
  ctx.font = '900 34px sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText(`${BRAND.domain}/${post.authorHandle}`, 540, 1688);

  const a = document.createElement('a');
  a.download = `emous-card-${post.authorHandle.toLowerCase()}.png`;
  a.href = canvas.toDataURL('image/png');
  a.click();
}

export interface ActivityNotification {
  id: string;
  type: 'inbox' | 'reaction' | 'comment' | 'system';
  title: string;
  subtitle: string;
  targetScreen: 'feed' | 'inbox' | 'trending';
  createdAt: string;
  isRead: boolean;
}

export default function EmousHomeApp() {
  // Active Top-Level Screen ('feed' | 'trending' | 'inbox')
  const [activeScreen, setActiveScreen] = useState<
    'feed' | 'trending' | 'inbox'
  >('feed');

  // Zero-Friction User Identity
  const [identity, setIdentity] = useState<UserIdentityDTO | null>(null);
  const [copiedLink, setCopiedLink] = useState(false);

  // Screen 1: Feed State + Dynamic Categorization
  const [feedMode, setFeedMode] = useState<'global' | 'near'>('global');
  const [selectedTag, setSelectedTag] = useState<string>('All');
  const [selectedPhrase, setSelectedPhrase] = useState<string>('');
  const [dynamicTags, setDynamicTags] = useState<string[]>([...POPULAR_TAGS]);
  const [posts, setPosts] = useState<PostDTO[]>([]);
  const [isLoadingFeed, setIsLoadingFeed] = useState(true);
  const [coords, setCoords] = useState<{ lat: number; lng: number }>({
    lat: 40.7128,
    lng: -74.006,
  });
  const [gpsStatus, setGpsStatus] = useState<string>('5-mile radius active');
  const [toast, setToast] = useState<string | null>(null);

  // Trending Radar Tab State
  const [trendingPeriod, setTrendingPeriod] = useState<'24h' | '7d' | 'all'>(
    'all'
  );
  const [trendingTags, setTrendingTags] = useState<TrendingTagItem[]>([]);
  const [trendingPhrases, setTrendingPhrases] = useState<TrendingPhraseItem[]>(
    []
  );

  // Active Notification Bell & Auto-Refresh State
  const [isNotifOpen, setIsNotifOpen] = useState(false);
  const [soundEnabled, setSoundEnabled] = useState(true);
  const [isBellRinging, setIsBellRinging] = useState(false);
  const [notifications, setNotifications] = useState<ActivityNotification[]>(
    []
  );
  const [lastUpdatedLabel, setLastUpdatedLabel] = useState<string>('Live');
  const prevInboxCountRef = useRef<number | null>(null);
  const prevFeedTopIdRef = useRef<string | null>(null);

  // Share Options Modal State for Feed Posts (Copy Link, WhatsApp, X/Twitter, Native Share, or Download 9:16 PNG)
  const [activeSharePost, setActiveSharePost] = useState<PostDTO | null>(null);
  const [dbMode, setDbMode] = useState<'mongodb' | 'local-engine'>('mongodb');
  // Anonymous Whisper Comments Drawer State
  const [activeCommentPost, setActiveCommentPost] = useState<PostDTO | null>(
    null
  );
  const [commentText, setCommentText] = useState('');

  // Auto-detect accurate user GPS or IP-based coordinates on mount
  useEffect(() => {
    const fetchIpFallbackLocation = async () => {
      try {
        const res = await fetch('https://ipapi.co/json/');
        if (res.ok) {
          const data = await res.json();
          if (data.latitude && data.longitude) {
            setCoords({
              lat: Number(data.latitude),
              lng: Number(data.longitude),
            });
            const locName = [data.city, data.country_code]
              .filter(Boolean)
              .join(', ');
            setGpsStatus(
              locName
                ? `📍 ${locName} (${Number(data.latitude).toFixed(3)}, ${Number(
                    data.longitude
                  ).toFixed(3)}) • 5-mi radius`
                : `📍 (${Number(data.latitude).toFixed(3)}, ${Number(
                    data.longitude
                  ).toFixed(3)}) • 5-mi radius`
            );
          }
        }
      } catch {
        setGpsStatus('📍 5-mile local radius active');
      }
    };

    if (typeof navigator !== 'undefined' && navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          const lat = pos.coords.latitude;
          const lng = pos.coords.longitude;
          setCoords({ lat, lng });
          setGpsStatus(
            `📍 Exact GPS (${lat.toFixed(4)}, ${lng.toFixed(4)}) • 5-mi radius`
          );
        },
        () => {
          fetchIpFallbackLocation();
        },
        { enableHighAccuracy: true, timeout: 6000 }
      );
    } else {
      fetchIpFallbackLocation();
    }
  }, []);

  // Post Composer + 🎲 Card Shuffler + Live Dynamic Tag Preview + Wow Feature #5 (2-Option Polls)
  const [isComposerOpen, setIsComposerOpen] = useState(false);
  const [draftContent, setDraftContent] = useState('');
  const [draftTagMode, setDraftTagMode] = useState<string>('AUTO');
  const [draftBg, setDraftBg] = useState<CardBackground>(CURATED_GRADIENTS[0]);
  const [enablePollDraft, setEnablePollDraft] = useState(false);
  const [pollOptionA, setPollOptionA] = useState('');
  const [pollOptionB, setPollOptionB] = useState('');
  const [isPublishing, setIsPublishing] = useState(false);
  const [isShuffling, setIsShuffling] = useState(false);

  // Screen 2 & 4: Inbox + 9:16 Story Reply Generator + Hint Peek
  const [inboxMessages, setInboxMessages] = useState<InboxMessageDTO[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [demoGoldenWizardMode, setDemoGoldenWizardMode] = useState(false);
  const [revealedHints, setRevealedHints] = useState<Record<string, boolean>>(
    {}
  );
  const [activeStoryMsg, setActiveStoryMsg] = useState<InboxMessageDTO | null>(
    null
  );
  const [replyText, setReplyText] = useState('');
  const [storyThemeId, setStoryThemeId] = useState<string>('story-pink-lime');
  const [isSavingReply, setIsSavingReply] = useState(false);

  const STORAGE_POSTS_CACHE = 'emous_permanent_feed_posts_v3';
  const STORAGE_INBOX_CACHE = 'emous_inbox_cache_v2';
  const STORAGE_REACTIONS_CACHE = 'emous_reactions_cache_v2';

  const fireBellAlert = useCallback(
    (toastMsg: string) => {
      triggerBellRingAndVibrate(soundEnabled);
      setIsBellRinging(true);
      setTimeout(() => setIsBellRinging(false), 2000);
      setToast(toastMsg);
      setTimeout(() => setToast(null), 3500);
    },
    [soundEnabled]
  );

  // Unlock Web Audio Context on user's first tap/click anywhere on the page
  useEffect(() => {
    const unlock = () => {
      getUnlockedAudioContext();
    };
    window.addEventListener('pointerdown', unlock, { passive: true });
    window.addEventListener('keydown', unlock, { passive: true });
    return () => {
      window.removeEventListener('pointerdown', unlock);
      window.removeEventListener('keydown', unlock);
    };
  }, []);

  const showToast = useCallback((msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(null), 3400);
  }, []);

  const getLocalRxCache = (): Record<
    string,
    { reactions: any; myReactions: ReactionType[] }
  > => {
    if (typeof window === 'undefined') return {};
    try {
      return JSON.parse(localStorage.getItem(STORAGE_REACTIONS_CACHE) || '{}');
    } catch {
      return {};
    }
  };

  useEffect(() => {
    if (typeof window !== 'undefined') {
      const params = new URLSearchParams(window.location.search);
      const tab = params.get('tab');
      if (tab === 'inbox') setActiveScreen('inbox');
      if (tab === 'trending') setActiveScreen('trending');
    }
  }, []);

  useEffect(() => {
    initZeroFrictionIdentity().then((user) => {
      setIdentity(user);
    });
  }, []);

  const currentHandle = demoGoldenWizardMode
    ? 'GoldenWizard'
    : identity?.handle || 'GoldenWizard';

  // Wow Feature #6: Street Cred & Karma Score calculated from user's activity
  const myPosts = posts.filter(
    (p) => p.authorHandle.toLowerCase() === currentHandle.toLowerCase()
  );
  const myReactionsReceived = myPosts.reduce(
    (sum, p) =>
      sum +
      (p.reactions?.fire || 0) +
      (p.reactions?.skull || 0) +
      (p.reactions?.eyes || 0) +
      (p.reactions?.heart || 0),
    0
  );
  const myCommentsReceived = myPosts.reduce(
    (sum, p) => sum + (p.commentsCount ?? p.comments?.length ?? 0),
    0
  );
  const streetCred = calculateStreetCred({
    postsCount: myPosts.length,
    reactionsReceived: myReactionsReceived,
    commentsReceived: myCommentsReceived,
    inboxReceived: inboxMessages.length,
  });

  // Live NLP preview for the Post Composer
  const liveComposerClassification = classifyPostTopics(
    draftContent,
    draftTagMode === 'AUTO' ? undefined : draftTagMode
  );

  // Load Feed Posts (Supports dynamic tag or trending phrase filtering + background silent refresh)
  const loadFeed = useCallback(
    async (silent = false) => {
      if (!silent) setIsLoadingFeed(true);
      try {
        const data = await fetchPosts({
          mode: feedMode,
          tag: selectedTag === 'All' ? undefined : selectedTag,
          phrase: selectedPhrase || undefined,
          lat: coords.lat,
          lng: coords.lng,
        });
        if (Array.isArray(data.popularTags) && data.popularTags.length > 0) {
          setDynamicTags(Array.from(new Set(data.popularTags)));
        }
        if (Array.isArray(data.trendingTags)) {
          setTrendingTags(data.trendingTags);
        }
        if (Array.isArray(data.trendingPhrases)) {
          setTrendingPhrases(data.trendingPhrases);
        }

        // Merge any locally created posts that aren't in the server list yet so user's posts never vanish,
        // and automatically sync any offline/pre-MongoDB local posts up to the permanent MongoDB Atlas cloud!
        let localCreatedPosts: PostDTO[] = [];
        if (typeof window !== 'undefined') {
          try {
            localCreatedPosts = JSON.parse(
              localStorage.getItem(STORAGE_POSTS_CACHE) || '[]'
            );
          } catch {}
        }
        const serverIds = new Set(data.posts.map((p) => p._id));
        const serverContents = new Set(
          data.posts.map((p) => p.content.trim().toLowerCase())
        );
        const combinedPosts = [...data.posts];
        for (const lp of localCreatedPosts) {
          if (!lp || !lp._id || lp.isHidden) continue;
          const normalizedContent = (lp.content || '').trim().toLowerCase();
          if (serverIds.has(lp._id) || serverContents.has(normalizedContent)) {
            continue;
          }
          // If this post was created while offline or before MongoDB Atlas was connected, push it to the cloud once
          if (
            selectedTag === 'All' &&
            !selectedPhrase &&
            lp.content &&
            lp.content.trim().length >= 2
          ) {
            serverContents.add(normalizedContent);
            createPost({
              content: lp.content,
              tag: lp.tag || 'AUTO',
              backgroundId: lp.background?.id || 'grad-neon-riot',
              authorHandle: lp.authorHandle,
              locationLabel: lp.location?.label || 'Near You',
              pollOptions: lp.poll?.options?.map((o) => o.text),
            }).catch(() => {});
          }
          if (
            selectedTag === 'All' ||
            lp.tag?.toLowerCase() === selectedTag.toLowerCase() ||
            lp.categories?.some(
              (c) => c.toLowerCase() === selectedTag.toLowerCase()
            )
          ) {
            combinedPosts.unshift(lp);
          }
        }

        const rxCache = getLocalRxCache();
        const merged = combinedPosts.map((post) => {
          const entry = rxCache[post._id];
          return entry
            ? {
                ...post,
                reactions: entry.reactions || post.reactions,
                // Strictly max 1 reaction per user per post
                myReactions: Array.isArray(entry.myReactions)
                  ? entry.myReactions.slice(0, 1)
                  : post.myReactions?.slice(0, 1) || [],
              }
            : post;
        });

        // Ring & vibrate if a new post arrived in the feed during background auto-refresh
        const newestId = merged[0]?._id || null;
        if (
          silent &&
          prevFeedTopIdRef.current &&
          newestId &&
          newestId !== prevFeedTopIdRef.current
        ) {
          fireBellAlert('🔔 New anonymous confession just dropped on the feed!');
        }
        if (newestId) {
          prevFeedTopIdRef.current = newestId;
        }

        setPosts(merged);
        setLastUpdatedLabel('Synced just now');

        // Feed items NEVER burn — store permanently without slicing
        if (
          typeof window !== 'undefined' &&
          selectedTag === 'All' &&
          !selectedPhrase
        ) {
          localStorage.setItem(STORAGE_POSTS_CACHE, JSON.stringify(merged));
        }
      } catch {
        if (typeof window !== 'undefined' && !silent) {
          try {
            const cached = JSON.parse(
              localStorage.getItem(STORAGE_POSTS_CACHE) || '[]'
            );
            if (cached.length > 0) setPosts(cached);
          } catch {}
        }
      } finally {
        if (!silent) setIsLoadingFeed(false);
      }
    },
    [feedMode, selectedTag, selectedPhrase, coords]
  );

  useEffect(() => {
    loadFeed(false);
  }, [loadFeed]);

  // Load Trending Radar Data
  const loadTrending = useCallback(async () => {
    const stats = await fetchTrendingData(trendingPeriod);
    setTrendingTags(stats.trendingTags);
    setTrendingPhrases(stats.trendingPhrases);
    if (stats.dynamicTags?.length > 0) {
      setDynamicTags(stats.dynamicTags);
    }
  }, [trendingPeriod]);

  useEffect(() => {
    loadTrending();
  }, [loadTrending]);

  // Load Inbox Messages + Build Live Notifications
  const loadInbox = useCallback(
    async (isPoll = false) => {
      if (!currentHandle) return;
      const inboxKey = `${STORAGE_INBOX_CACHE}_${currentHandle.toLowerCase()}`;
      try {
        const data = await fetchInbox(currentHandle);
        const nextCount = data.messages.length;

        if (
          isPoll &&
          prevInboxCountRef.current !== null &&
          nextCount > prevInboxCountRef.current
        ) {
          fireBellAlert(
            `🔔 New secret confession just arrived for @${currentHandle}!`
          );
        }
        prevInboxCountRef.current = nextCount;

        setInboxMessages(data.messages);
        setUnreadCount(data.unreadCount);

        // Build Notification Bell Feed from Inbox notes & trending velocity
        const inboxNotifs: ActivityNotification[] = data.messages
          .slice(0, 6)
          .map((m) => ({
            id: `notif-inbox-${m._id}`,
            type: 'inbox',
            title: m.isRead
              ? `✉️ Secret note for @${currentHandle}`
              : `🔥 New Unread Secret for @${currentHandle}`,
            subtitle: `“${m.question.slice(0, 75)}${
              m.question.length > 75 ? '...' : ''
            }”`,
            targetScreen: 'inbox',
            createdAt: m.createdAt,
            isRead: m.isRead,
          }));

        setNotifications(inboxNotifs);

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
    },
    [currentHandle, soundEnabled, showToast]
  );

  // Automatic Background Refresh for BOTH Feed (10s) and Inbox (6s)
  useEffect(() => {
    loadInbox(false);
    const inboxInterval = setInterval(() => {
      loadInbox(true);
    }, 6000);
    const feedInterval = setInterval(() => {
      if (!isComposerOpen && !activeStoryMsg && !activeCommentPost) {
        loadFeed(true);
        loadTrending();
      }
    }, 10000);

    return () => {
      clearInterval(inboxInterval);
      clearInterval(feedInterval);
    };
  }, [loadInbox, loadFeed, loadTrending, isComposerOpen, activeStoryMsg, activeCommentPost]);

  // EXCLUSIVE SINGLE REACTION HANDLER (1 User = Max 1 Reaction Per Post)
  const handleSingleReaction = async (post: PostDTO, type: ReactionType) => {
    // 1. Optimistic Update: Remove any previous reaction on this post before toggling the new one
    setPosts((prev) =>
      prev.map((p) => {
        if (p._id !== post._id) return p;
        const nextRx = {
          ...(p.reactions || { fire: 0, skull: 0, eyes: 0, heart: 0 }),
        };
        const currentMy = Array.isArray(p.myReactions) ? p.myReactions : [];
        const alreadyHadThis = currentMy.includes(type);

        // Decrement any previously active reaction on this post
        for (const prevType of currentMy) {
          nextRx[prevType] = Math.max(0, (nextRx[prevType] || 1) - 1);
        }

        let nextMy: ReactionType[] = [];
        if (!alreadyHadThis) {
          nextRx[type] = (nextRx[type] || 0) + 1;
          nextMy = [type];
        }

        try {
          const cache = getLocalRxCache();
          cache[post._id] = { reactions: nextRx, myReactions: nextMy };
          localStorage.setItem(STORAGE_REACTIONS_CACHE, JSON.stringify(cache));
        } catch {}

        return {
          ...p,
          reactions: nextRx,
          myReactions: nextMy,
        };
      })
    );

    // 2. Sync with Backend API (which also enforces 1 reaction per deviceId per post)
    try {
      const res = await reactToPost(post._id, type);
      const singleMy = Array.isArray(res.myReactions)
        ? res.myReactions.slice(0, 1)
        : [];
      try {
        const cache = getLocalRxCache();
        cache[post._id] = {
          reactions: res.reactions,
          myReactions: singleMy,
        };
        localStorage.setItem(STORAGE_REACTIONS_CACHE, JSON.stringify(cache));
      } catch {}

      setPosts((prev) =>
        prev.map((p) =>
          p._id === post._id
            ? {
                ...p,
                reactions: res.reactions,
                myReactions: singleMy,
              }
            : p
        )
      );
    } catch {}
  };

  const handleSelectNearMe = () => {
    setFeedMode('near');
    if (typeof navigator !== 'undefined' && navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          const lat = pos.coords.latitude;
          const lng = pos.coords.longitude;
          setCoords({ lat, lng });
          setGpsStatus(
            `📍 Exact GPS (${lat.toFixed(4)}, ${lng.toFixed(4)}) • 5-mi radius`
          );
        },
        async () => {
          try {
            const res = await fetch('https://ipapi.co/json/');
            if (res.ok) {
              const data = await res.json();
              if (data.latitude && data.longitude) {
                setCoords({
                  lat: Number(data.latitude),
                  lng: Number(data.longitude),
                });
                const locName = [data.city, data.country_code]
                  .filter(Boolean)
                  .join(', ');
                setGpsStatus(
                  `📍 ${locName || 'Detected Location'} (${Number(
                    data.latitude
                  ).toFixed(3)}, ${Number(data.longitude).toFixed(
                    3
                  )}) • 5-mi radius`
                );
              }
            }
          } catch {}
        },
        { enableHighAccuracy: true, timeout: 6000 }
      );
    }
  };

  const handleShuffleBackground = async () => {
    setIsShuffling(true);
    const nextBg = await shuffleCardBackground(draftBg.id);
    setDraftBg(nextBg);
    setIsShuffling(false);
  };

  const handlePublishPost = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!draftContent.trim()) return;
    setIsPublishing(true);
    try {
      const hasValidPoll =
        enablePollDraft && pollOptionA.trim() && pollOptionB.trim();
      const created = await createPost({
        content: draftContent.trim(),
        tag:
          draftTagMode === 'AUTO'
            ? liveComposerClassification.primaryTag
            : draftTagMode,
        background: draftBg,
        authorHandle: currentHandle,
        lat: coords.lat,
        lng: coords.lng,
        poll: hasValidPoll
          ? { optionA: pollOptionA.trim(), optionB: pollOptionB.trim() }
          : undefined,
      });
      setPosts((prev) => {
        const next = [created, ...prev];
        prevFeedTopIdRef.current = created._id;
        if (typeof window !== 'undefined') {
          try {
            // Permanent feed storage — never burns or truncates
            localStorage.setItem(STORAGE_POSTS_CACHE, JSON.stringify(next));
          } catch {}
        }
        return next;
      });
      if (!dynamicTags.includes(created.tag)) {
        setDynamicTags((prev) => [created.tag, ...prev]);
      }
      setDraftContent('');
      setDraftTagMode('AUTO');
      setEnablePollDraft(false);
      setPollOptionA('');
      setPollOptionB('');
      setIsComposerOpen(false);
      loadTrending();
      showToast(
        `🔥 Auto-categorized under ${created.tag} & dropped to the feed!`
      );
    } catch (err: any) {
      showToast(err.message || 'Could not post');
    } finally {
      setIsPublishing(false);
    }
  };

  // Wow Feature #1: Drop an Anonymous Inbox Q&A Directly to the Public Visual Feed as a Dual Q&A Card!
  const handleDropQaToPublicFeed = async () => {
    if (!activeStoryMsg) return;
    const cleanReply = replyText.trim() || '🤫🔥';
    const combinedContent = `🤫 Q: "${activeStoryMsg.question}" — ⚡ A: ${cleanReply}`.slice(
      0,
      300
    );

    setIsSavingReply(true);
    try {
      await replyToInboxMessage(activeStoryMsg._id, cleanReply, storyThemeId);
      const created = await createPost({
        content: combinedContent,
        background: CURATED_GRADIENTS[0],
        authorHandle: currentHandle,
        lat: coords.lat,
        lng: coords.lng,
        qaCard: {
          question: activeStoryMsg.question,
          reply: cleanReply,
        },
      });
      setPosts((prev) => [created, ...prev]);
      setActiveStoryMsg(null);
      setActiveScreen('feed');
      showToast('🚀 Q&A published to the Public Feed for everyone to read!');
    } catch {
      showToast('Could not publish Q&A to feed');
    } finally {
      setIsSavingReply(false);
    }
  };

  // Wow Feature #5: Vote on a 2-Option Poll on a Feed Card
  const handleVotePoll = async (post: PostDTO, option: 'A' | 'B') => {
    if (!post.poll) return;
    // 1. Optimistic update
    setPosts((prev) =>
      prev.map((p) => {
        if (p._id !== post._id || !p.poll) return p;
        const prevVote = p.poll.myVote;
        let votesA = p.poll.optionA.votes;
        let votesB = p.poll.optionB.votes;
        if (prevVote === 'A') votesA = Math.max(0, votesA - 1);
        if (prevVote === 'B') votesB = Math.max(0, votesB - 1);
        if (option === 'A') votesA += 1;
        if (option === 'B') votesB += 1;
        return {
          ...p,
          poll: {
            optionA: { ...p.poll.optionA, votes: votesA },
            optionB: { ...p.poll.optionB, votes: votesB },
            totalVotes: votesA + votesB,
            myVote: option,
          },
        };
      })
    );

    try {
      const res = await voteOnPostPoll(post._id, option);
      setPosts((prev) =>
        prev.map((p) => (p._id === post._id ? { ...p, poll: res.poll } : p))
      );
    } catch {}
  };

  // Wow Feature #2: Submit an Anonymous Whisper Comment under a post
  const handleAddWhisperComment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeCommentPost || !commentText.trim()) return;
    try {
      const res = await addPostComment(
        activeCommentPost._id,
        commentText.trim(),
        currentHandle
      );
      setPosts((prev) =>
        prev.map((p) =>
          p._id === activeCommentPost._id
            ? {
                ...p,
                comments: res.comments,
                commentsCount: res.commentsCount,
              }
            : p
        )
      );
      setActiveCommentPost((prev) =>
        prev
          ? {
              ...prev,
              comments: res.comments,
              commentsCount: res.commentsCount,
            }
          : null
      );
      setCommentText('');
      showToast('💬 Anonymous whisper reply added!');
    } catch {
      showToast('Could not add whisper reply');
    }
  };

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

  const handleCopyInboxLink = () => {
    const origin =
      typeof window !== 'undefined'
        ? window.location.origin
        : 'https://emous.vercel.app';
    const fullUrl = `${origin}/${currentHandle}`;
    navigator.clipboard?.writeText(fullUrl);
    setCopiedLink(true);
    showToast(`🔗 Copied: ${BRAND.domain}/${currentHandle}`);
    setTimeout(() => setCopiedLink(false), 2500);
  };

  const handleOpenStoryGenerator = (msg: InboxMessageDTO) => {
    setActiveStoryMsg(msg);
    setReplyText(msg.reply || '');
    setStoryThemeId(msg.themeId || 'story-pink-lime');

    // Wow Feature #3: If message is marked "Burn After Reading" and was already read once, warn user
    if (msg.burnAfterReading && msg.isRead) {
      showToast('💣 Flash Burn Note: Self-destructs when closed!');
    }
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

  const totalUnreadNotifications =
    unreadCount + notifications.filter((n) => !n.isRead).length;

  return (
    <div className="min-h-screen pb-28">
      {/* Toast Notification */}
      {toast && (
        <div className="fixed top-4 right-4 left-4 sm:left-auto z-50 bg-emous-lime text-black font-display font-extrabold text-xs sm:text-sm px-5 py-3 rounded-2xl flyer-card text-center animate-bounce">
          {toast}
        </div>
      )}

      {/* Top Streetwear Navigation Header with Mobile-Responsive Bell Icon */}
      <header className="sticky top-0 z-30 bg-emous-bg/95 backdrop-blur-md border-b-4 border-black">
        <div className="max-w-5xl mx-auto px-2.5 sm:px-4 py-2 sm:py-3.5 space-y-2 sm:space-y-0 sm:flex sm:items-center sm:justify-between gap-2">
          {/* Top Row on Mobile: Compact Logo + Handle + Bell Icon (fits 320px-375px without horizontal scroll) */}
          <div className="flex items-center justify-between gap-1.5 min-w-0">
            <div className="flex items-center gap-1.5 min-w-0 flex-1">
              <button
                onClick={() => {
                  setActiveScreen('feed');
                  setSelectedTag('All');
                  setSelectedPhrase('');
                }}
                className="bg-emous-lime text-black font-display font-extrabold text-base sm:text-2xl px-2.5 sm:px-4 py-0.5 sm:py-1 rounded-xl sm:rounded-2xl flyer-btn tracking-tight inline-flex items-center gap-1 shrink-0"
              >
                <span>emous</span>
              </button>

              <div className="flex items-center gap-1 bg-emous-surface border-2 border-black rounded-full px-2 py-0.5 min-w-0 max-w-full overflow-hidden">
                <span className="w-1.5 h-1.5 rounded-full bg-emous-lime animate-pulse shrink-0" />
                <span className="text-[10px] sm:text-xs font-extrabold text-emous-yellow truncate max-w-[78px] sm:max-w-[135px]">
                  @{currentHandle}
                </span>
                <span
                  title={`${streetCred.tier} • ${streetCred.score} Street Cred`}
                  className="bg-black text-emous-lime text-[9px] sm:text-[10px] font-extrabold px-1.5 py-0.2 rounded-full border border-emous-lime/40 shrink-0"
                >
                  {streetCred.emoji} {streetCred.score}
                </span>
                <button
                  onClick={async () => {
                    setDemoGoldenWizardMode(false);
                    const next = await rerollHandle();
                    setIdentity(next);
                    showToast(`🎲 Switched handle to @${next.handle}`);
                  }}
                  title="Roll a new random handle"
                  className="text-neutral-400 hover:text-emous-pink shrink-0"
                >
                  <RefreshCw className="w-2.5 h-2.5 sm:w-3.5 sm:h-3.5" />
                </button>
              </div>
            </div>

            {/* Active Notification Bell Icon Button (Rings & Vibrates on new message) */}
            <div className="relative shrink-0">
              <button
                onClick={() => {
                  getUnlockedAudioContext();
                  setIsNotifOpen((prev) => !prev);
                }}
                className={`p-1.5 sm:p-2 rounded-xl flyer-btn relative inline-flex items-center justify-center ${
                  isBellRinging ? 'bell-ringing bg-emous-pink text-white' : ''
                } ${
                  isNotifOpen
                    ? 'bg-emous-yellow text-black'
                    : 'bg-emous-surface text-white hover:bg-neutral-800'
                }`}
                title="Live Notifications (Rings & Vibrates when ON)"
              >
                <Bell
                  className={`w-4 h-4 sm:w-5 sm:h-5 ${
                    isBellRinging ? 'bell-ringing' : ''
                  }`}
                />
                {unreadCount > 0 && (
                  <span className="absolute -top-1.5 -right-1.5 bg-emous-pink text-white border-2 border-black text-[9px] font-extrabold px-1.5 rounded-full animate-pulse">
                    {unreadCount}
                  </span>
                )}
              </button>
            </div>
          </div>

          {/* Primary Screen Switcher: 4 Tabs (Feed | Trending | Inbox | + Card) */}
          <div className="grid grid-cols-4 sm:flex items-center gap-1.5 sm:gap-2">
            <button
              onClick={() => setActiveScreen('feed')}
              className={`px-2 sm:px-3.5 py-2 rounded-xl font-display font-extrabold text-[10px] sm:text-xs uppercase flyer-btn flex items-center justify-center gap-1 truncate ${
                activeScreen === 'feed'
                  ? 'bg-emous-pink text-white'
                  : 'bg-emous-surface text-white'
              }`}
            >
              <Flame className="w-3.5 h-3.5 shrink-0" />
              <span className="truncate">Feed</span>
            </button>

            <button
              onClick={() => {
                setActiveScreen('trending');
                loadTrending();
              }}
              className={`px-2 sm:px-3.5 py-2 rounded-xl font-display font-extrabold text-[10px] sm:text-xs uppercase flyer-btn flex items-center justify-center gap-1 truncate ${
                activeScreen === 'trending'
                  ? 'bg-emous-yellow text-black'
                  : 'bg-emous-surface text-white'
              }`}
            >
              <TrendingUp className="w-3.5 h-3.5 shrink-0" />
              <span className="truncate">Trending</span>
            </button>

            <button
              onClick={() => setActiveScreen('inbox')}
              className={`px-2 sm:px-3.5 py-2 rounded-xl font-display font-extrabold text-[10px] sm:text-xs uppercase flyer-btn flex items-center justify-center gap-1 relative truncate ${
                activeScreen === 'inbox'
                  ? 'bg-emous-lime text-black'
                  : 'bg-emous-surface text-white'
              }`}
            >
              <MessageSquareHeart className="w-3.5 h-3.5 shrink-0" />
              <span className="truncate">Inbox</span>
              {inboxMessages.length > 0 && (
                <span className="bg-emous-pink text-white border border-black text-[9px] font-extrabold px-1 rounded-full shrink-0">
                  {inboxMessages.length}
                </span>
              )}
            </button>

            <button
              onClick={() => setIsComposerOpen(true)}
              className="bg-emous-yellow text-black font-display font-extrabold text-[10px] sm:text-xs px-2 sm:px-3.5 py-2 rounded-xl flyer-btn uppercase flex items-center justify-center gap-1 truncate"
            >
              <Plus className="w-3.5 h-3.5 stroke-[3] shrink-0" />
              <span className="truncate">Card</span>
            </button>
          </div>
        </div>

        {/* Active Notification Bell Drawer Dropdown */}
        {isNotifOpen && (
          <div className="max-w-md ml-auto mr-3 sm:mr-6 mb-3 bg-emous-surface rounded-2xl p-4 flyer-card space-y-3 border-2 border-black z-50">
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <span className="bg-emous-lime text-black font-display font-extrabold text-[10px] px-2.5 py-0.5 rounded-full border border-black uppercase">
                  🔔 LIVE ACTIVITY
                </span>
              </div>

              <div className="flex items-center gap-1.5">
                <button
                  onClick={() => {
                    const nextState = !soundEnabled;
                    setSoundEnabled(nextState);
                    if (nextState) {
                      triggerBellRingAndVibrate(true);
                    }
                  }}
                  className="bg-black text-xs px-2.5 py-1 rounded-lg border border-white/20 inline-flex items-center gap-1 font-bold"
                  title="Toggle notification ring & vibration"
                >
                  {soundEnabled ? (
                    <>
                      <Volume2 className="w-3.5 h-3.5 text-emous-lime" />
                      <span className="text-[10px]">On</span>
                    </>
                  ) : (
                    <>
                      <VolumeX className="w-3.5 h-3.5 text-neutral-400" />
                      <span className="text-[10px]">Off</span>
                    </>
                  )}
                </button>
                <button
                  onClick={() => fireBellAlert('🔔 Testing Bell Ring & Vibration!')}
                  className="bg-emous-yellow text-black text-[10px] font-display font-extrabold px-2 py-1 rounded-lg border border-black uppercase"
                  title="Test Ring & Vibration"
                >
                  🔔 Test Ring
                </button>
                <button
                  onClick={() => setIsNotifOpen(false)}
                  className="bg-black text-white px-2 py-0.5 rounded-lg text-xs font-bold"
                >
                  ✕
                </button>
              </div>
            </div>

            {notifications.length === 0 ? (
              <p className="text-xs text-neutral-400 py-3 text-center">
                No notifications yet. Drop your inbox link or post a card!
              </p>
            ) : (
              <div className="space-y-2 max-h-60 overflow-y-auto pr-1">
                {notifications.map((n) => (
                  <button
                    key={n.id}
                    onClick={() => {
                      setActiveScreen(n.targetScreen);
                      setIsNotifOpen(false);
                    }}
                    className="w-full text-left bg-black/75 hover:bg-black p-2.5 rounded-xl border border-white/15 flex items-start justify-between gap-2 transition-colors"
                  >
                    <div className="min-w-0">
                      <p className="text-xs font-extrabold text-emous-yellow truncate">
                        {n.title}
                      </p>
                      <p className="text-[11px] text-neutral-300 truncate">
                        {n.subtitle}
                      </p>
                    </div>
                    <span className="text-[10px] text-neutral-400 font-bold shrink-0">
                      {formatRelativeTime(n.createdAt)}
                    </span>
                  </button>
                ))}
              </div>
            )}

            <div className="flex items-center justify-between pt-1">
              <button
                onClick={() => {
                  loadFeed(false);
                  loadInbox(false);
                  loadTrending();
                  showToast('⚡ Live Feed & Inbox synced!');
                }}
                className="text-[11px] font-extrabold text-emous-lime hover:underline inline-flex items-center gap-1"
              >
                <RefreshCw className="w-3 h-3" />
                <span>Sync Now</span>
              </button>

              <button
                onClick={() => {
                  setActiveScreen('inbox');
                  setIsNotifOpen(false);
                }}
                className="bg-emous-pink text-white font-display font-extrabold text-[10px] px-3 py-1 rounded-lg border border-black uppercase"
              >
                Open Secret Inbox →
              </button>
            </div>
          </div>
        )}
      </header>

      {/* =====================================================================
          SCREEN 1: THE VISUAL FEED ("Dare to Speak!" & 5-Mile Near Me Toggle)
         ===================================================================== */}
      {activeScreen === 'feed' && (
        <main className="max-w-5xl mx-auto px-3 sm:px-4 pt-4 sm:pt-6 space-y-4 sm:space-y-5">
          {/* Feed Mode Toggle Switch + Active GPS / Filter Bar */}
          <div className="bg-emous-surface rounded-2xl sm:rounded-3xl p-3.5 sm:p-5 flyer-card flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 sm:gap-4">
            <div className="min-w-0">
              <h1 className="font-display font-extrabold text-xl sm:text-3xl text-white leading-tight">
                {feedMode === 'global'
                  ? 'Dare to Speak!'
                  : '📍 Near Me (5-Mile Radius)'}
              </h1>
              {(selectedPhrase || selectedTag !== 'All') && (
                <div className="mt-1.5 inline-flex items-center gap-2 bg-emous-pink text-white text-xs font-extrabold px-3 py-1 rounded-full border-2 border-black">
                  <span>
                    🔍 Filtering by:{' '}
                    {selectedPhrase ? selectedPhrase : selectedTag}
                  </span>
                  <button
                    onClick={() => {
                      setSelectedPhrase('');
                      setSelectedTag('All');
                    }}
                    className="bg-black text-white px-1.5 rounded-full text-[10px]"
                  >
                    ✕
                  </button>
                </div>
              )}
              {feedMode === 'near' && (
                <p className="text-[11px] sm:text-xs font-bold text-emous-lime mt-0.5 flex items-center gap-1 truncate">
                  <MapPin className="w-3.5 h-3.5 shrink-0" />
                  <span className="truncate">{gpsStatus}</span>
                </p>
              )}
            </div>

            {/* Dual-Feed Toggle Switch */}
            <div className="bg-black p-1 sm:p-1.5 rounded-xl sm:rounded-2xl border-2 border-white/15 grid grid-cols-2 w-full sm:w-auto sm:inline-flex shrink-0">
              <button
                onClick={() => setFeedMode('global')}
                className={`px-3 sm:px-4 py-1.5 sm:py-2 rounded-lg sm:rounded-xl font-display font-extrabold text-[11px] sm:text-xs uppercase transition-all flex items-center justify-center gap-1.5 truncate ${
                  feedMode === 'global'
                    ? 'bg-emous-lime text-black shadow-brutal'
                    : 'text-neutral-400 hover:text-white'
                }`}
              >
                <Globe className="w-3.5 h-3.5 shrink-0" />
                <span className="truncate">Global Feed</span>
              </button>
              <button
                onClick={handleSelectNearMe}
                className={`px-3 sm:px-4 py-1.5 sm:py-2 rounded-lg sm:rounded-xl font-display font-extrabold text-[11px] sm:text-xs uppercase transition-all flex items-center justify-center gap-1.5 truncate ${
                  feedMode === 'near'
                    ? 'bg-emous-pink text-white shadow-brutal'
                    : 'text-neutral-400 hover:text-white'
                }`}
              >
                <MapPin className="w-3.5 h-3.5 shrink-0" />
                <span className="truncate">Near Me (5mi)</span>
              </button>
            </div>
          </div>

          {/* Visual Content Cards Grid */}
          {isLoadingFeed ? (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
              {[1, 2, 3, 4].map((n) => (
                <div
                  key={n}
                  className="h-64 rounded-3xl bg-emous-surface animate-pulse flyer-card"
                />
              ))}
            </div>
          ) : posts.length === 0 ? (
            <div className="bg-emous-surface rounded-3xl p-8 text-center flyer-card space-y-4">
              <p className="font-display font-extrabold text-xl text-emous-yellow">
                No confessions matched{' '}
                {selectedPhrase ? `“${selectedPhrase}”` : selectedTag} yet 👀
              </p>
              <div className="flex justify-center gap-3">
                <button
                  onClick={() => {
                    setSelectedTag('All');
                    setSelectedPhrase('');
                  }}
                  className="bg-white text-black font-display font-extrabold px-5 py-2.5 rounded-2xl flyer-btn uppercase text-xs"
                >
                  Reset Filter
                </button>
                <button
                  onClick={() => setIsComposerOpen(true)}
                  className="bg-emous-pink text-white font-display font-extrabold px-5 py-2.5 rounded-2xl flyer-btn uppercase text-xs"
                >
                  Drop First Confession 🚀
                </button>
              </div>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
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

                // Active single reaction for this user on this post
                const activeUserReaction = post.myReactions?.[0] || null;
                const commentsCount =
                  post.commentsCount ?? post.comments?.length ?? 0;

                return (
                  <article
                    key={post._id}
                    style={cardStyle}
                    className="rounded-2xl sm:rounded-3xl p-4 sm:p-6 flyer-card flex flex-col justify-between min-h-[215px] sm:min-h-[250px] relative overflow-hidden group transition-transform hover:-translate-y-0.5"
                  >
                    {/* Top Row: Anonymous Handle Pill + Electric Yellow Timestamp */}
                    <div className="flex items-center justify-between gap-1.5 min-w-0 z-10">
                      <Link
                        href={`/ask/${post.authorHandle}`}
                        className="bg-black/85 text-white text-[11px] sm:text-xs font-extrabold px-2.5 sm:px-3 py-1 rounded-full border-2 border-black inline-flex items-center gap-1 hover:bg-emous-pink transition-colors truncate max-w-[55%]"
                      >
                        <span className="truncate">
                          🎭 @{post.authorHandle}
                        </span>
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

                    {/* Center: Wow Feature #1 Split Q&A Card OR Bold 300-Char Confession Copy */}
                    {post.qaCard?.question ? (
                      <div className="my-3.5 space-y-2 z-10">
                        <div className="bg-black/80 text-white rounded-2xl p-3 border-2 border-black">
                          <span className="inline-block bg-emous-pink text-white text-[9px] font-display font-extrabold uppercase px-2 py-0.5 rounded mb-1">
                            🤫 ANONYMOUS ASKED
                          </span>
                          <p className="font-sans font-bold text-xs sm:text-sm">
                            “{post.qaCard.question}”
                          </p>
                        </div>
                        <div className="bg-emous-lime text-black rounded-2xl p-3 border-2 border-black shadow-brutal">
                          <span className="inline-block bg-black text-emous-yellow text-[9px] font-display font-extrabold uppercase px-2 py-0.5 rounded mb-1">
                            ⚡ @{post.authorHandle} REPLIED
                          </span>
                          <p className="font-sans font-extrabold text-sm sm:text-base">
                            {post.qaCard.reply}
                          </p>
                        </div>
                      </div>
                    ) : (
                      <p
                        style={{ color: textColor }}
                        className="my-4 sm:my-5 font-sans font-extrabold text-[15px] sm:text-lg md:text-xl leading-relaxed tracking-tight break-words z-10 drop-shadow-sm"
                      >
                        “{post.content}”
                      </p>
                    )}

                    {/* Wow Feature #5: Interactive 2-Option Anonymous Hot-Take Poll */}
                    {post.poll?.optionA?.text && post.poll?.optionB?.text && (
                      <div className="mb-3 space-y-1.5 z-10 bg-black/55 p-2.5 rounded-2xl border-2 border-black">
                        {(['A', 'B'] as const).map((optKey) => {
                          const opt =
                            optKey === 'A'
                              ? post.poll!.optionA
                              : post.poll!.optionB;
                          const total = post.poll!.totalVotes || 0;
                          const pct =
                            total > 0
                              ? Math.round((opt.votes / total) * 100)
                              : 50;
                          const isVoted = post.poll!.myVote === optKey;
                          return (
                            <button
                              key={optKey}
                              onClick={() => handleVotePoll(post, optKey)}
                              className={`w-full relative overflow-hidden rounded-xl border-2 border-black px-3 py-2 text-left font-sans font-extrabold text-xs flex items-center justify-between transition-transform active:scale-98 ${
                                isVoted
                                  ? 'bg-emous-yellow text-black'
                                  : 'bg-white/95 text-black hover:bg-emous-lime'
                              }`}
                            >
                              <div
                                style={{ width: `${pct}%` }}
                                className={`absolute inset-y-0 left-0 opacity-25 pointer-events-none ${
                                  isVoted ? 'bg-emous-pink' : 'bg-black'
                                }`}
                              />
                              <span className="relative z-10 truncate pr-2">
                                {isVoted ? '⚡ ' : ''}
                                {opt.text}
                              </span>
                              <span className="relative z-10 text-[11px] font-display shrink-0">
                                {pct}% ({opt.votes})
                              </span>
                            </button>
                          );
                        })}
                      </div>
                    )}

                    {/* Exclusive Single Reaction Row (1 User = Max 1 Reaction Per Post) + Whisper Thread Count */}
                    <div className="flex items-center justify-between gap-2 flex-wrap pb-2.5 z-10">
                      <div className="flex items-center gap-1.5 flex-wrap">
                        {REACTION_TYPES.map((type) => {
                          const meta = REACTION_META[type];
                          const count = post.reactions?.[type] ?? 0;
                          const isSelected = activeUserReaction === type;
                          return (
                            <button
                              key={type}
                              onClick={() => handleSingleReaction(post, type)}
                              title={`React with ${meta.label} (1 reaction allowed per post)`}
                              className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-extrabold border-2 border-black shadow-brutal transition-transform active:scale-95 ${
                                isSelected
                                  ? 'bg-emous-yellow text-black scale-105'
                                  : 'bg-black/80 text-white hover:bg-black'
                              }`}
                            >
                              <span>{meta.emoji}</span>
                              <span>{count}</span>
                            </button>
                          );
                        })}
                      </div>

                      {/* Wow Feature #2: Anonymous Whisper Thread Trigger */}
                      <button
                        onClick={() => setActiveCommentPost(post)}
                        className="bg-black/85 hover:bg-emous-lime hover:text-black text-emous-lime text-[11px] font-extrabold px-2.5 py-1 rounded-full border-2 border-black shadow-brutal inline-flex items-center gap-1 transition-colors"
                      >
                        <span>💬 {commentsCount}</span>
                        <span className="hidden sm:inline">Whispers</span>
                      </button>
                    </div>

                    {/* Bottom Row: Icon-Only Action Pills that reveal labels on hover */}
                    <div className="flex items-center justify-between gap-2 pt-1 z-10">
                      <button
                        onClick={() => {
                          setSelectedTag(post.tag);
                          setSelectedPhrase('');
                        }}
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

                      <div className="flex items-center gap-1.5">
                        <button
                          onClick={() => setActiveSharePost(post)}
                          className="card-action-pill bg-emous-yellow text-black hover:bg-emous-lime"
                          aria-label="Share Post"
                        >
                          <Share2 className="w-4 h-4 shrink-0 stroke-[2.5]" />
                          <span className="card-action-label">Share</span>
                        </button>

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
          NEW TAB: TWITTER (X) STYLE 📈 TRENDING LIST WITH EMOUS NEON BRAND PALETTE
         ===================================================================== */}
      {activeScreen === 'trending' && (
        <main className="max-w-2xl mx-auto px-3 sm:px-4 pt-4 sm:pt-6">
          <div className="bg-emous-surface rounded-2xl sm:rounded-3xl flyer-card overflow-hidden border-3 border-black">
            {/* Emous Streetwear Brand Header on Twitter (X) Layout */}
            <div className="bg-emous-lime text-black px-4 sm:px-5 py-3.5 border-b-3 border-black flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
              <div>
                <span className="inline-block bg-black text-emous-yellow font-display font-extrabold text-[9px] uppercase px-2 py-0.5 rounded-full mb-0.5">
                  🔥 EMOUS PULSE
                </span>
                <h1 className="font-display font-extrabold text-lg sm:text-xl text-black leading-tight">
                  Trends for you
                </h1>
              </div>

              <div className="inline-flex bg-black p-1 rounded-xl border-2 border-black self-start sm:self-auto">
                {(
                  [
                    { id: '24h', label: '24h' },
                    { id: '7d', label: '7d' },
                    { id: 'all', label: 'All Time' },
                  ] as const
                ).map((p) => (
                  <button
                    key={p.id}
                    onClick={() => setTrendingPeriod(p.id)}
                    className={`px-3 py-1 rounded-lg font-display font-extrabold text-[11px] transition-colors ${
                      trendingPeriod === p.id
                        ? 'bg-emous-pink text-white'
                        : 'text-neutral-300 hover:text-emous-yellow'
                    }`}
                  >
                    {p.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Twitter (X) Style Clean Vertical Trend Rows (1 Keyword per row, no box around keyword, Emous neon accents) */}
            <div className="divide-y-2 divide-black">
              {(trendingPhrases.length > 0
                ? trendingPhrases
                : trendingTags.map((t) => ({
                    phrase: t.tag,
                    category: `${t.tag.replace(/^#/, '')} • Topic`,
                    count: t.count,
                    score: t.score,
                  }))
              ).map((item, idx) => {
                const categoryName = (item.category || '#Confessions').replace(
                  /^#/,
                  ''
                );
                const keywordDisplay = item.phrase.startsWith('#')
                  ? item.phrase
                  : item.phrase.charAt(0).toUpperCase() + item.phrase.slice(1);
                const rankAccent =
                  idx === 0
                    ? 'text-emous-pink'
                    : idx === 1
                    ? 'text-emous-lime'
                    : idx === 2
                    ? 'text-emous-yellow'
                    : 'text-neutral-400';

                return (
                  <button
                    key={`${item.phrase}-${idx}`}
                    onClick={() => {
                      if (item.phrase.startsWith('#')) {
                        setSelectedTag(item.phrase);
                        setSelectedPhrase('');
                      } else {
                        setSelectedTag('All');
                        setSelectedPhrase(item.phrase.toLowerCase());
                      }
                      setActiveScreen('feed');
                    }}
                    className="w-full text-left px-4 sm:px-5 py-3.5 hover:bg-black/60 transition-colors flex items-start justify-between gap-3 group"
                  >
                    <div className="min-w-0 space-y-0.5">
                      <p className="text-[11px] sm:text-xs font-extrabold flex items-center gap-1.5">
                        <span className={rankAccent}>#{idx + 1}</span>
                        <span className="text-neutral-500">·</span>
                        <span className="text-emous-yellow uppercase tracking-wider">
                          {categoryName}
                        </span>
                        <span className="text-neutral-500">·</span>
                        <span className="text-emous-lime">Trending</span>
                      </p>
                      <p className="font-display font-extrabold text-base sm:text-lg text-white group-hover:text-emous-pink transition-colors truncate">
                        {keywordDisplay}
                      </p>
                      <p className="text-[11px] sm:text-xs text-neutral-300 font-bold">
                        <span className="text-emous-lime font-extrabold">
                          {item.count}
                        </span>{' '}
                        {item.count === 1 ? 'confession' : 'confessions'}
                      </p>
                    </div>

                    <span className="text-emous-pink group-hover:text-emous-lime text-sm font-extrabold px-1.5 py-0.5">
                      •••
                    </span>
                  </button>
                );
              })}
            </div>
          </div>
        </main>
      )}

      {/* =====================================================================
          SCREEN 2: "GET YOUR LINK" INBOX DASHBOARD (with 30d Countdown & Hints)
         ===================================================================== */}
      {activeScreen === 'inbox' && (
        <main className="max-w-4xl mx-auto px-3 sm:px-4 pt-4 sm:pt-6 space-y-6">
          <div className="bg-emous-lime text-black rounded-2xl sm:rounded-3xl p-4 sm:p-5 flyer-card relative overflow-hidden">
            <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-2.5">
              <div className="space-y-1 min-w-0 flex-1">
                <div className="inline-flex items-center gap-1.5 bg-black text-emous-yellow text-[10px] font-display font-extrabold px-2.5 py-0.5 rounded-full uppercase">
                  <Sparkles className="w-3 h-3" />
                  <span>30-DAY AUTO-BURN SECRET INBOX</span>
                </div>
                <h1 className="font-display font-extrabold text-xs sm:text-base md:text-lg leading-snug truncate">
                  {BRAND.inboxHook}
                </h1>
              </div>

              <button
                onClick={() => setDemoGoldenWizardMode((prev) => !prev)}
                className="bg-white text-black text-[11px] font-extrabold px-3 py-1.5 rounded-xl border-2 border-black shadow-brutal self-start md:self-center shrink-0"
              >
                {demoGoldenWizardMode
                  ? '👤 Switch to My Handle'
                  : '🧙‍♂️ Preview @GoldenWizard Demo Inbox'}
              </button>
            </div>

            <div className="mt-3 bg-white rounded-xl p-2.5 sm:p-3 border-2 border-black shadow-brutal flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-2.5">
              <div className="flex items-center gap-2.5 px-2 overflow-hidden">
                <span className="bg-emous-pink text-white font-display font-extrabold text-xs px-2.5 py-1 rounded-lg border-2 border-black shrink-0">
                  LINK
                </span>
                <span className="font-display font-extrabold text-sm sm:text-xl text-black truncate">
                  {BRAND.domain}/{currentHandle}
                </span>
              </div>

              <div className="flex items-center gap-2 shrink-0">
                <button
                  onClick={handleCopyInboxLink}
                  className="flex-1 sm:flex-initial bg-emous-pink text-white font-display font-extrabold text-xs sm:text-sm px-4 py-2.5 rounded-xl flyer-btn uppercase inline-flex items-center justify-center gap-1.5"
                >
                  {copiedLink ? (
                    <>
                      <Check className="w-4 h-4" />
                      <span>Copied!</span>
                    </>
                  ) : (
                    <>
                      <Copy className="w-4 h-4" />
                      <span>Copy My Link 🔗</span>
                    </>
                  )}
                </button>

                <Link
                  href={`/${currentHandle}`}
                  className="bg-emous-yellow text-black font-display font-extrabold text-xs sm:text-sm px-3.5 py-2.5 rounded-xl flyer-btn inline-flex items-center gap-1.5"
                >
                  <ExternalLink className="w-4 h-4" />
                  <span>Open Receiver</span>
                </Link>
              </div>
            </div>
          </div>

          {/* Inbox Secret Notes Grid */}
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="font-display font-extrabold text-lg sm:text-2xl flex items-center gap-2">
                <span>🕵️ Secret Notes for @{currentHandle}</span>
                <span className="bg-emous-yellow text-black text-xs px-2.5 py-0.5 rounded-full border-2 border-black">
                  {inboxMessages.length}
                </span>
              </h2>
              <button
                onClick={() => loadInbox(false)}
                className="text-xs font-bold text-emous-lime hover:underline inline-flex items-center gap-1"
              >
                <RefreshCw className="w-3.5 h-3.5" />
                <span>Refresh</span>
              </button>
            </div>

            {inboxMessages.length === 0 ? (
              <div className="bg-emous-surface rounded-3xl p-8 text-center flyer-card space-y-4">
                <p className="font-display font-extrabold text-xl text-emous-yellow">
                  Your secret inbox is waiting for its first confession! 🤫
                </p>
                <p className="text-xs sm:text-sm text-neutral-300 max-w-md mx-auto">
                  Tap <strong>Open Receiver</strong> above to send yourself a
                  test anonymous message, or switch to{' '}
                  <strong>@GoldenWizard Demo Inbox</strong>.
                </p>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                {inboxMessages.map((msg) => {
                  const pair =
                    STORY_COLOR_PAIRS.find((t) => t.id === msg.themeId) ||
                    STORY_COLOR_PAIRS[0];
                  const showHint = Boolean(revealedHints[msg._id]);
                  return (
                    <div
                      key={msg._id}
                      className="bg-emous-surface rounded-3xl p-5 flyer-card flex flex-col justify-between gap-3.5 border-2 border-black relative"
                    >
                      <div className="flex items-center justify-between gap-2 flex-wrap">
                        <span
                          style={{
                            backgroundColor: msg.isRead ? '#FFE600' : '#FF1E8E',
                            color: msg.isRead ? '#0D0D11' : '#FFFFFF',
                          }}
                          className="text-[10px] font-display font-extrabold uppercase px-2.5 py-0.5 rounded-full border-2 border-black"
                        >
                          {msg.burnAfterReading
                            ? '💣 Flash Burn Note'
                            : msg.isRead
                            ? '✉️ Opened Note'
                            : '🔥 New Secret Note'}
                        </span>

                        {/* Wow Feature #3: Live Ticking 30-Day Burn Countdown */}
                        <span className="bg-black text-emous-yellow text-[10px] font-extrabold px-2.5 py-0.5 rounded-full border border-white/15 inline-flex items-center gap-1">
                          <Clock className="w-3 h-3 text-emous-pink" />
                          <span>🔥 {formatBurnCountdown(msg.createdAt)}</span>
                        </span>
                      </div>

                      <div
                        style={{
                          backgroundColor: pair.topCardBg,
                          color: pair.topCardText,
                        }}
                        className="rounded-2xl p-4 border-2 border-black shadow-brutal font-sans font-extrabold text-base sm:text-lg"
                      >
                        “{msg.question}”
                      </div>

                      {/* Wow Feature #4: Anonymous Sender Hint Peek */}
                      <div>
                        {showHint ? (
                          <div className="bg-black/80 text-emous-lime text-[11px] font-bold px-3 py-1.5 rounded-xl border border-emous-lime/40 flex items-center justify-between">
                            <span>
                              🔍 Clue:{' '}
                              {msg.senderHint ||
                                '📱 Sent from Mobile Web • Night Owl'}
                            </span>
                            <button
                              onClick={() =>
                                setRevealedHints((prev) => ({
                                  ...prev,
                                  [msg._id]: false,
                                }))
                              }
                              className="text-neutral-400 text-[10px]"
                            >
                              Hide
                            </button>
                          </div>
                        ) : (
                          <button
                            onClick={() =>
                              setRevealedHints((prev) => ({
                                ...prev,
                                [msg._id]: true,
                              }))
                            }
                            className="text-[11px] font-extrabold text-emous-yellow hover:underline inline-flex items-center gap-1"
                          >
                            <Eye className="w-3.5 h-3.5" />
                            <span>🔍 Peek Anonymous Sender Clue</span>
                          </button>
                        )}
                      </div>

                      {msg.reply && (
                        <div
                          style={{
                            backgroundColor: pair.bottomCardBg,
                            color: pair.bottomCardText,
                          }}
                          className="rounded-2xl p-3 border-2 border-black text-xs sm:text-sm font-bold"
                        >
                          <span className="block text-[9px] uppercase font-extrabold opacity-75 mb-0.5">
                            Your Story Reply:
                          </span>
                          {msg.reply}
                        </div>
                      )}

                      <div className="flex items-center justify-between gap-2 pt-1">
                        <button
                          onClick={() => handleOpenStoryGenerator(msg)}
                          className="flex-1 bg-emous-lime text-black font-display font-extrabold text-xs py-2.5 px-3 rounded-xl flyer-btn uppercase inline-flex items-center justify-center gap-1.5"
                        >
                          <Share2 className="w-4 h-4" />
                          <span>
                            {msg.reply
                              ? 'Share 9:16 / Public Feed'
                              : 'Reply & Share 📸'}
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
          MODAL 1: CREATE VISUAL CARD POST + DYNAMIC NLP AUTO-CATEGORIZATION
         ===================================================================== */}
      {isComposerOpen && (
        <div className="fixed inset-0 z-50 bg-black/85 backdrop-blur-sm flex items-center justify-center p-3 overflow-y-auto">
          <div className="bg-emous-surface w-full max-w-lg rounded-3xl p-5 flyer-card space-y-4 my-auto">
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
                className="rounded-3xl p-4 sm:p-5 flyer-card min-h-[200px] flex flex-col justify-between"
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="bg-black/80 text-white text-xs font-extrabold px-3 py-1 rounded-full">
                    🎭 @{currentHandle}
                  </span>

                  <button
                    type="button"
                    onClick={handleShuffleBackground}
                    disabled={isShuffling}
                    className="bg-emous-yellow text-black font-display font-extrabold text-xs px-3 py-1 rounded-full border-2 border-black shadow-brutal inline-flex items-center gap-1 hover:bg-emous-lime"
                  >
                    <Dices className="w-4 h-4" />
                    <span>🎲 Shuffle BG</span>
                  </button>
                </div>

                <textarea
                  value={draftContent}
                  onChange={(e) =>
                    setDraftContent(e.target.value.slice(0, BRAND.maxPostLength))
                  }
                  rows={3}
                  placeholder="Type your confession (use a #hashtag or mention work, office, sex, crypto, gym, politics, religion — we auto-categorize it!)"
                  style={{
                    color:
                      draftBg.type === 'image' ? '#FFFFFF' : draftBg.textColor,
                  }}
                  className="w-full bg-transparent placeholder:text-current/65 font-sans font-extrabold text-base sm:text-xl focus:outline-none resize-none my-3"
                />

                <div className="flex items-center justify-between text-xs font-extrabold flex-wrap gap-2">
                  <span
                    style={{
                      backgroundColor: draftBg.badgeBg,
                      color: draftBg.badgeText,
                    }}
                    className="px-3 py-1 rounded-lg border-2 border-black"
                  >
                    ✨ Auto-Tag: {liveComposerClassification.primaryTag}
                  </span>
                  <span className="bg-black/75 text-white px-2.5 py-1 rounded-full">
                    {draftContent.length}/{BRAND.maxPostLength}
                  </span>
                </div>
              </div>

              {/* Dynamic Auto-Detect or Manual Override Pill Picker */}
              <div>
                <label className="block text-[11px] font-extrabold uppercase text-neutral-400 mb-1.5">
                  Category Mode (Auto-Detects from your words or pick one):
                </label>
                <div className="flex flex-wrap gap-1.5">
                  <button
                    type="button"
                    onClick={() => setDraftTagMode('AUTO')}
                    className={`text-xs font-display font-extrabold px-3 py-1 rounded-xl border-2 border-black ${
                      draftTagMode === 'AUTO'
                        ? 'bg-emous-lime text-black'
                        : 'bg-black text-neutral-300'
                    }`}
                  >
                    ⚡ Auto-Detect ({liveComposerClassification.primaryTag})
                  </button>
                  {POPULAR_TAGS.map((t) => (
                    <button
                      type="button"
                      key={t}
                      onClick={() => setDraftTagMode(t)}
                      className={`text-xs font-display font-extrabold px-2.5 py-1 rounded-xl border-2 border-black ${
                        draftTagMode === t
                          ? 'bg-emous-pink text-white'
                          : 'bg-black text-neutral-300'
                      }`}
                    >
                      {t}
                    </button>
                  ))}
                </div>
              </div>

              {/* Wow Feature #5: Optional 2-Option Poll Builder in Composer */}
              <div className="bg-black/60 rounded-2xl p-3 border-2 border-black space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-[11px] font-extrabold uppercase text-emous-yellow">
                    📊 Add 2-Option Hot-Take Poll (Optional)
                  </span>
                  <button
                    type="button"
                    onClick={() => setEnablePollDraft((prev) => !prev)}
                    className={`text-[10px] font-display font-extrabold px-2.5 py-1 rounded-lg border border-black uppercase ${
                      enablePollDraft
                        ? 'bg-emous-pink text-white'
                        : 'bg-emous-surface text-neutral-300'
                    }`}
                  >
                    {enablePollDraft ? '✕ Remove Poll' : '+ Attach Poll'}
                  </button>
                </div>

                {enablePollDraft && (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-1">
                    <input
                      type="text"
                      maxLength={40}
                      value={pollOptionA}
                      onChange={(e) => setPollOptionA(e.target.value)}
                      placeholder="Option A (e.g. Quit Job 🏃)"
                      className="bg-black text-white text-xs font-bold px-3 py-2 rounded-xl border border-white/25 focus:outline-none focus:border-emous-lime"
                    />
                    <input
                      type="text"
                      maxLength={40}
                      value={pollOptionB}
                      onChange={(e) => setPollOptionB(e.target.value)}
                      placeholder="Option B (e.g. Stay for Pay 💰)"
                      className="bg-black text-white text-xs font-bold px-3 py-2 rounded-xl border border-white/25 focus:outline-none focus:border-emous-lime"
                    />
                  </div>
                )}
              </div>

              <button
                type="submit"
                disabled={isPublishing || !draftContent.trim()}
                className="w-full bg-emous-lime text-black font-display font-extrabold text-base py-3.5 rounded-2xl flyer-btn uppercase disabled:opacity-50"
              >
                {isPublishing ? 'Posting...' : 'Drop Anonymous Card 🚀'}
              </button>
            </form>
          </div>
        </div>
      )}

      {/* =====================================================================
          MODAL 2: WOW FEATURE #2 — ANONYMOUS WHISPER COMMENTS THREAD
         ===================================================================== */}
      {activeCommentPost && (
        <div className="fixed inset-0 z-50 bg-black/85 backdrop-blur-sm flex items-center justify-center p-3 overflow-y-auto">
          <div className="bg-emous-surface w-full max-w-lg rounded-3xl p-5 flyer-card space-y-4 my-auto">
            <div className="flex items-center justify-between">
              <span className="bg-emous-yellow text-black font-display font-extrabold text-xs uppercase px-3 py-1 rounded-full border-2 border-black">
                💬 ANONYMOUS WHISPER THREAD ({activeCommentPost.tag})
              </span>
              <button
                onClick={() => setActiveCommentPost(null)}
                className="bg-black text-white p-1.5 rounded-xl border-2 border-white/20"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="bg-black/75 rounded-2xl p-3.5 border-2 border-black">
              <p className="text-xs font-extrabold text-emous-lime mb-1">
                🎭 @{activeCommentPost.authorHandle} (OP)
              </p>
              <p className="font-sans font-bold text-sm text-white">
                “{activeCommentPost.content}”
              </p>
            </div>

            <div className="space-y-2 max-h-60 overflow-y-auto pr-1">
              {(!activeCommentPost.comments ||
                activeCommentPost.comments.length === 0) && (
                <p className="text-xs text-neutral-400 text-center py-4">
                  No whisper replies yet. Drop the first anonymous reply!
                </p>
              )}
              {(activeCommentPost.comments || []).map((c) => (
                <div
                  key={c._id}
                  className="bg-black/60 rounded-xl p-3 border border-white/15 flex items-start justify-between gap-2"
                >
                  <div>
                    <span className="text-[11px] font-extrabold text-emous-yellow">
                      🎭 @{c.authorHandle}{' '}
                      {c.isOp && (
                        <span className="bg-emous-pink text-white text-[9px] px-1.5 py-0.2 rounded-full ml-1">
                          👑 OP
                        </span>
                      )}
                    </span>
                    <p className="text-xs sm:text-sm font-bold text-white mt-0.5">
                      {c.text}
                    </p>
                  </div>
                  <span className="text-[10px] text-neutral-400 font-bold shrink-0">
                    {formatRelativeTime(c.createdAt)}
                  </span>
                </div>
              ))}
            </div>

            <form onSubmit={handleAddWhisperComment} className="flex gap-2">
              <input
                type="text"
                maxLength={180}
                value={commentText}
                onChange={(e) => setCommentText(e.target.value)}
                placeholder="Whisper an anonymous reply..."
                className="flex-1 bg-black text-white rounded-xl px-3.5 py-2.5 border-2 border-white/25 text-xs sm:text-sm font-bold focus:outline-none focus:border-emous-lime"
              />
              <button
                type="submit"
                className="bg-emous-lime text-black font-display font-extrabold text-xs px-4 py-2.5 rounded-xl flyer-btn uppercase inline-flex items-center gap-1"
              >
                <Send className="w-3.5 h-3.5" />
                <span>Reply</span>
              </button>
            </form>
          </div>
        </div>
      )}

      {/* =====================================================================
          MODAL 3: SHARE POST OPTIONS (COPY LINK, WHATSAPP, X/TWITTER, NATIVE SHARE, OR 9:16 PNG)
         ===================================================================== */}
      {activeSharePost && (
        <div className="fixed inset-0 z-50 bg-black/85 backdrop-blur-sm flex items-center justify-center p-3 overflow-y-auto">
          <div className="bg-emous-surface w-full max-w-md rounded-3xl p-5 flyer-card space-y-4 my-auto">
            <div className="flex items-center justify-between">
              <span className="bg-emous-lime text-black font-display font-extrabold text-xs uppercase px-3 py-1 rounded-full border-2 border-black">
                🚀 SHARE CONFESSION
              </span>
              <button
                onClick={() => setActiveSharePost(null)}
                className="bg-black text-white p-1.5 rounded-xl border-2 border-white/20"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="bg-black/75 rounded-2xl p-3.5 border-2 border-black space-y-1">
              <span className="text-[11px] font-extrabold text-emous-yellow">
                🎭 @{activeSharePost.authorHandle} • {activeSharePost.tag}
              </span>
              <p className="font-sans font-bold text-xs sm:text-sm text-white line-clamp-3">
                “{activeSharePost.content}”
              </p>
            </div>

            <div className="grid grid-cols-1 gap-2.5">
              {/* 1. Copy Clean Short Link Only */}
              <button
                onClick={() => {
                  const cleanLink = `https://${BRAND.domain}/${activeSharePost.authorHandle}`;
                  navigator.clipboard?.writeText(cleanLink);
                  showToast(`🔗 Copied clean link: ${BRAND.domain}/${activeSharePost.authorHandle}`);
                  setActiveSharePost(null);
                }}
                className="w-full bg-emous-yellow text-black font-display font-extrabold text-xs sm:text-sm py-3 px-4 rounded-xl flyer-btn uppercase flex items-center justify-center gap-2"
              >
                <Copy className="w-4 h-4" />
                <span>Copy Clean Link ({BRAND.domain}/{activeSharePost.authorHandle})</span>
              </button>

              {/* 2. Share to Social Media Row (WhatsApp & X/Twitter) */}
              <div className="grid grid-cols-2 gap-2.5">
                <a
                  href={`https://api.whatsapp.com/send?text=${encodeURIComponent(
                    `“${activeSharePost.content}”\n\nhttps://${BRAND.domain}/${activeSharePost.authorHandle}`
                  )}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  onClick={() => setActiveSharePost(null)}
                  className="bg-emous-lime text-black font-display font-extrabold text-xs py-3 px-3 rounded-xl flyer-btn uppercase flex items-center justify-center gap-1.5 text-center"
                >
                  <span>💬 WhatsApp</span>
                </a>

                <a
                  href={`https://twitter.com/intent/tweet?text=${encodeURIComponent(
                    `“${activeSharePost.content.slice(0, 180)}” ${activeSharePost.tag}`
                  )}&url=${encodeURIComponent(
                    `https://${BRAND.domain}/${activeSharePost.authorHandle}`
                  )}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  onClick={() => setActiveSharePost(null)}
                  className="bg-black text-white font-display font-extrabold text-xs py-3 px-3 rounded-xl flyer-btn uppercase flex items-center justify-center gap-1.5 text-center border-2 border-white/25"
                >
                  <span>𝕏 Share on X</span>
                </a>
              </div>

              {/* 3. Native Mobile / OS Share Sheet (Instagram, Snapchat, Telegram, Messages) */}
              {typeof navigator !== 'undefined' &&
                typeof navigator.share === 'function' && (
                  <button
                    onClick={async () => {
                      try {
                        await navigator.share({
                          title: 'emous — Dare to Speak!',
                          text: `“${activeSharePost.content}”`,
                          url: `https://${BRAND.domain}/${activeSharePost.authorHandle}`,
                        });
                        setActiveSharePost(null);
                      } catch {}
                    }}
                    className="w-full bg-emous-pink text-white font-display font-extrabold text-xs sm:text-sm py-3 px-4 rounded-xl flyer-btn uppercase flex items-center justify-center gap-2"
                  >
                    <Share2 className="w-4 h-4" />
                    <span>More Apps (IG / Snapchat / Telegram) 📱</span>
                  </button>
                )}

              {/* 4. Secondary Option: Download 9:16 Story Image PNG */}
              <button
                onClick={() => {
                  downloadFeedCardStoryPng(activeSharePost);
                  showToast('📸 Downloaded 9:16 Story Image (PNG)!');
                  setActiveSharePost(null);
                }}
                className="w-full bg-black text-neutral-300 hover:text-white font-display font-extrabold text-xs py-2.5 px-4 rounded-xl border-2 border-black uppercase flex items-center justify-center gap-2"
              >
                <Download className="w-3.5 h-3.5" />
                <span>Download 9:16 Story Image (PNG)</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* =====================================================================
          SCREEN 4: 9:16 STORY GENERATOR + WOW FEATURE #1 (DROP Q&A TO PUBLIC FEED)
         ===================================================================== */}
      {activeStoryMsg && (
        <div className="fixed inset-0 z-50 bg-black/85 backdrop-blur-md flex items-center justify-center p-3 overflow-y-auto">
          <div className="bg-emous-surface w-full max-w-3xl rounded-3xl p-5 sm:p-6 flyer-card grid grid-cols-1 md:grid-cols-2 gap-6 items-center my-auto">
            <div className="flex justify-center">
              <div
                style={{ backgroundColor: activeStoryTheme.canvasBg }}
                className="w-[250px] h-[444px] rounded-3xl p-4 flyer-card flex flex-col justify-between relative overflow-hidden select-none"
              >
                <div className="text-center">
                  <span className="inline-block bg-emous-yellow text-black font-display font-extrabold text-[10px] uppercase px-3 py-1 rounded-md border-2 border-black shadow-brutal">
                    ASK @{currentHandle}
                  </span>
                </div>

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
                  <p className="font-sans font-extrabold text-xs sm:text-sm leading-snug line-clamp-4">
                    “{activeStoryMsg.question}”
                  </p>
                </div>

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
                  <p className="font-sans font-extrabold text-xs sm:text-sm leading-snug line-clamp-4">
                    {replyText.trim() || 'Type your reply on the right... 👀'}
                  </p>
                </div>

                <div className="text-center">
                  <span className="inline-block bg-emous-pink text-white font-display font-extrabold text-[10px] px-3 py-1 rounded-full border-2 border-black">
                    {BRAND.domain}/{currentHandle}
                  </span>
                </div>
              </div>
            </div>

            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <span className="text-xs font-extrabold uppercase text-emous-lime">
                    9:16 STORY & PUBLIC FEED GENERATOR
                  </span>
                  <h3 className="font-display font-extrabold text-xl sm:text-2xl">
                    Reply & Share Confession
                  </h3>
                </div>
                <button
                  onClick={() => {
                    if (
                      activeStoryMsg.burnAfterReading &&
                      !activeStoryMsg.isRead
                    ) {
                      flagInboxMessage(activeStoryMsg._id, true).catch(
                        () => {}
                      );
                      setInboxMessages((prev) =>
                        prev.filter((m) => m._id !== activeStoryMsg._id)
                      );
                      showToast(
                        '💣 Flash Burn Note self-destructed after reading!'
                      );
                    }
                    setActiveStoryMsg(null);
                  }}
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
                  className="w-full bg-black text-white rounded-2xl p-3.5 border-2 border-white/25 font-sans font-bold text-sm sm:text-base focus:outline-none focus:border-emous-lime resize-none"
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

              <div className="pt-1 space-y-2">
                <button
                  type="button"
                  disabled={isSavingReply}
                  onClick={() => handleSaveReplyAndShare(true)}
                  className="w-full bg-emous-pink text-white font-display font-extrabold text-sm py-3 px-5 rounded-2xl flyer-btn uppercase flex items-center justify-center gap-2"
                >
                  <Download className="w-4 h-4" />
                  <span>Download 9:16 Story Image (PNG)</span>
                </button>

                {/* Wow Feature #1: Publish Q&A directly to the Public Visual Feed */}
                <button
                  type="button"
                  disabled={isSavingReply}
                  onClick={handleDropQaToPublicFeed}
                  className="w-full bg-emous-yellow text-black font-display font-extrabold text-xs sm:text-sm py-3 px-5 rounded-2xl flyer-btn uppercase flex items-center justify-center gap-2"
                >
                  <Flame className="w-4 h-4" />
                  <span>Publish Q&A to Public Feed 🔥</span>
                </button>

                <button
                  type="button"
                  disabled={isSavingReply}
                  onClick={() => handleSaveReplyAndShare(false)}
                  className="w-full bg-emous-lime text-black font-display font-extrabold text-xs py-2 px-4 rounded-xl flyer-btn uppercase"
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
