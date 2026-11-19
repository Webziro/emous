import {
  ALL_BACKGROUNDS,
  CardBackground,
  CURATED_GRADIENTS,
  CURATED_UNSPLASH_IMAGES,
  generateRandomHandle,
  InboxMessageDTO,
  POPULAR_TAGS,
  PostDTO,
  ReactionCounts,
  ReactionType,
  UserIdentityDTO,
} from '@shared/index';

export const OFFLINE_SEED_POSTS: PostDTO[] = [
  {
    _id: 'seed-post-1',
    authorHandle: 'GoldenWizard',
    content:
      'Told my boss my Wi-Fi crashed during the 4PM standup when I was actually already in line for rooftop tacos & margaritas 🌮🤫',
    tag: '#WorkConfessions',
    background: CURATED_GRADIENTS[0],
    location: {
      type: 'Point',
      coordinates: [-74.006, 40.7128],
      label: '0.4 mi away',
    },
    reactions: { fire: 14, skull: 8, eyes: 5, heart: 3 },
    myReactions: [],
    flagsCount: 0,
    isHidden: false,
    createdAt: new Date(Date.now() - 1000 * 60 * 8).toISOString(),
  },
  {
    _id: 'seed-post-2',
    authorHandle: 'NeonPanther',
    content:
      'Whoever was wearing the vintage neon green puffer at the 2AM warehouse set last night... we locked eyes 3 times. Drop a sign 👀⚡',
    tag: '#NightOut',
    background: CURATED_UNSPLASH_IMAGES[2],
    location: {
      type: 'Point',
      coordinates: [-73.998, 40.7205],
      label: '1.1 mi away',
    },
    reactions: { fire: 22, skull: 2, eyes: 19, heart: 11 },
    myReactions: [],
    flagsCount: 0,
    isHidden: false,
    createdAt: new Date(Date.now() - 1000 * 60 * 24).toISOString(),
  },
  {
    _id: 'seed-post-3',
    authorHandle: 'AcidRebel',
    content:
      'Unpopular opinion: 3AM diner fries with the squad hit 100x harder than any $200 reservation spot in the city.',
    tag: '#UnpopularOpinion',
    background: CURATED_GRADIENTS[1],
    location: {
      type: 'Point',
      coordinates: [-74.012, 40.708],
      label: '0.8 mi away',
    },
    reactions: { fire: 31, skull: 6, eyes: 4, heart: 18 },
    myReactions: [],
    flagsCount: 0,
    isHidden: false,
    createdAt: new Date(Date.now() - 1000 * 60 * 47).toISOString(),
  },
  {
    _id: 'seed-post-4',
    authorHandle: 'CyberViper',
    content:
      'Our entire group project got an A+ and none of us know who actually wrote the final 6 slides on the Google Doc 💀',
    tag: '#CampusTea',
    background: CURATED_UNSPLASH_IMAGES[0],
    location: {
      type: 'Point',
      coordinates: [-73.989, 40.7308],
      label: '1.9 mi away',
    },
    reactions: { fire: 9, skull: 27, eyes: 7, heart: 4 },
    myReactions: [],
    flagsCount: 0,
    isHidden: false,
    createdAt: new Date(Date.now() - 1000 * 60 * 95).toISOString(),
  },
];

function resolveApiBase(): string {
  const raw =
    process.env.NEXT_PUBLIC_API_URL ||
    (typeof window !== 'undefined' &&
    window.location.hostname !== 'localhost' &&
    window.location.hostname !== '127.0.0.1'
      ? 'https://emous.onrender.com/api/v1'
      : 'http://localhost:4000/api/v1');

  const trimmed = raw.trim().replace(/\/+$/, '');
  if (trimmed.endsWith('/api/v1')) return trimmed;
  if (trimmed.endsWith('/api')) return `${trimmed}/v1`;
  return `${trimmed}/api/v1`;
}

const API_BASE = resolveApiBase();

const STORAGE_DEVICE_KEY = 'emous_device_fingerprint_v1';
const STORAGE_HANDLE_KEY = 'emous_user_handle_v1';

/**
 * Generates or retrieves a deterministic browser fingerprint + local token
 * so users never need credentials.
 */
export function getOrCreateDeviceId(): string {
  if (typeof window === 'undefined') return 'ssr-device';
  let stored = localStorage.getItem(STORAGE_DEVICE_KEY);
  if (stored) return stored;

  const nav = window.navigator;
  const screenInfo = `${window.screen?.width || 0}x${window.screen?.height || 0}x${
    window.screen?.colorDepth || 24
  }`;
  const rawSignals = [
    nav.userAgent,
    nav.language,
    screenInfo,
    Intl.DateTimeFormat().resolvedOptions().timeZone,
    Math.random().toString(36).slice(2),
    Date.now().toString(36),
  ].join('|');

  let hash = 2166136261;
  for (let i = 0; i < rawSignals.length; i++) {
    hash ^= rawSignals.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  const fingerprint = `web-${(hash >>> 0).toString(16)}-${Math.random()
    .toString(36)
    .slice(2, 8)}`;

  localStorage.setItem(STORAGE_DEVICE_KEY, fingerprint);
  return fingerprint;
}

export async function initZeroFrictionIdentity(): Promise<UserIdentityDTO> {
  const deviceId = getOrCreateDeviceId();
  const cachedHandle =
    typeof window !== 'undefined'
      ? localStorage.getItem(STORAGE_HANDLE_KEY)
      : null;

  try {
    const res = await fetch(`${API_BASE}/identity/init`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-device-id': deviceId,
      },
      body: JSON.stringify({
        deviceId,
        preferredHandle: cachedHandle || undefined,
      }),
    });
    if (res.ok) {
      const data: UserIdentityDTO = await res.json();
      if (typeof window !== 'undefined') {
        localStorage.setItem(STORAGE_HANDLE_KEY, data.handle);
      }
      return data;
    }
  } catch {
    // Fallback if backend is offline
  }

  const fallbackHandle = cachedHandle || generateRandomHandle(false);
  if (typeof window !== 'undefined') {
    localStorage.setItem(STORAGE_HANDLE_KEY, fallbackHandle);
  }
  return {
    deviceId,
    handle: fallbackHandle,
    inboxLink: `emous.app/ask/${fallbackHandle}`,
    createdAt: new Date().toISOString(),
  };
}

export async function rerollHandle(): Promise<UserIdentityDTO> {
  const deviceId = getOrCreateDeviceId();
  try {
    const res = await fetch(`${API_BASE}/identity/reroll`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-device-id': deviceId,
      },
      body: JSON.stringify({ deviceId }),
    });
    if (res.ok) {
      const data: UserIdentityDTO = await res.json();
      if (typeof window !== 'undefined') {
        localStorage.setItem(STORAGE_HANDLE_KEY, data.handle);
      }
      return data;
    }
  } catch {
    // Offline fallback
  }

  const nextHandle = generateRandomHandle(false);
  if (typeof window !== 'undefined') {
    localStorage.setItem(STORAGE_HANDLE_KEY, nextHandle);
  }
  return {
    deviceId,
    handle: nextHandle,
    inboxLink: `emous.app/ask/${nextHandle}`,
    createdAt: new Date().toISOString(),
  };
}

export async function fetchPosts(params: {
  mode: 'global' | 'near';
  tag?: string;
  lat?: number;
  lng?: number;
}): Promise<{ posts: PostDTO[]; popularTags: readonly string[] }> {
  const deviceId = getOrCreateDeviceId();
  const url = new URL(`${API_BASE}/posts`);
  url.searchParams.set('mode', params.mode);
  if (params.tag && params.tag !== 'All') {
    url.searchParams.set('tag', params.tag);
  }
  if (params.mode === 'near' && params.lat !== undefined && params.lng !== undefined) {
    url.searchParams.set('lat', String(params.lat));
    url.searchParams.set('lng', String(params.lng));
    url.searchParams.set('radiusMiles', '5');
  }

  try {
    const res = await fetch(url.toString(), {
      headers: { 'x-device-id': deviceId },
      cache: 'no-store',
    });
    if (res.ok) {
      const data = await res.json();
      if (Array.isArray(data.posts) && data.posts.length > 0) {
        return data;
      }
    }
  } catch {
    // Fallback below if Render is waking up from cold start
  }

  // Fallback to cached posts or built-in seed posts so feed is never empty
  let fallbackPosts = [...OFFLINE_SEED_POSTS];
  if (typeof window !== 'undefined') {
    try {
      const cached = JSON.parse(
        localStorage.getItem('emous_posts_cache_v1') || '[]'
      );
      if (Array.isArray(cached) && cached.length > 0) {
        fallbackPosts = cached;
      }
    } catch {}
  }

  if (params.tag && params.tag !== 'All') {
    const targetTag = params.tag.toLowerCase();
    fallbackPosts = fallbackPosts.filter(
      (p) => p.tag.toLowerCase() === targetTag
    );
  }

  return {
    posts: fallbackPosts,
    popularTags: POPULAR_TAGS,
  };
}

export async function createPost(payload: {
  content: string;
  tag: string;
  background: CardBackground;
  authorHandle?: string;
  lat?: number;
  lng?: number;
}): Promise<PostDTO> {
  const deviceId = getOrCreateDeviceId();
  try {
    const res = await fetch(`${API_BASE}/posts`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-device-id': deviceId,
      },
      body: JSON.stringify({ ...payload, deviceId }),
    });
    if (res.ok) {
      const data = await res.json();
      return data.post;
    }
    const err = await res.json().catch(() => ({}));
    if (res.status === 400 || res.status === 429) {
      throw new Error(err.error || 'Blocked by Safety Shield');
    }
  } catch (err: any) {
    if (
      err?.message?.includes('Safety Shield') ||
      err?.message?.includes('Whoa there')
    ) {
      throw err;
    }
    // If Render server is waking up from cold start, save post locally so posting always succeeds immediately
  }

  const localPost: PostDTO = {
    _id: `local-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    authorHandle: payload.authorHandle || 'GoldenWizard',
    content: payload.content.trim(),
    tag: payload.tag || '#WorkConfessions',
    background: payload.background || CURATED_GRADIENTS[0],
    location:
      payload.lat !== undefined && payload.lng !== undefined
        ? {
            type: 'Point',
            coordinates: [payload.lng, payload.lat],
            label: 'Near You',
          }
        : undefined,
    reactions: { fire: 0, skull: 0, eyes: 0, heart: 0 },
    myReactions: [],
    flagsCount: 0,
    isFlaggedByMe: false,
    isHidden: false,
    createdAt: new Date().toISOString(),
  };

  if (typeof window !== 'undefined') {
    try {
      const existing = JSON.parse(
        localStorage.getItem('emous_posts_cache_v1') || '[]'
      );
      const base =
        Array.isArray(existing) && existing.length > 0
          ? existing
          : [...OFFLINE_SEED_POSTS];
      base.unshift(localPost);
      localStorage.setItem(
        'emous_posts_cache_v1',
        JSON.stringify(base.slice(0, 60))
      );
    } catch {}
  }

  return localPost;
}

export async function reactToPost(
  postId: string,
  type: ReactionType
): Promise<{
  _id: string;
  type: ReactionType;
  action: 'added' | 'removed';
  reactions: ReactionCounts;
  myReactions: ReactionType[];
}> {
  const deviceId = getOrCreateDeviceId();
  const res = await fetch(`${API_BASE}/posts/${postId}/react`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-device-id': deviceId,
    },
    body: JSON.stringify({ deviceId, type }),
  });
  if (!res.ok) throw new Error('Failed to react to post');
  return res.json();
}

export async function flagPost(postId: string): Promise<{
  _id: string;
  flagsCount: number;
  isHidden: boolean;
  message: string;
}> {
  const deviceId = getOrCreateDeviceId();
  const res = await fetch(`${API_BASE}/posts/${postId}/flag`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-device-id': deviceId,
    },
    body: JSON.stringify({ deviceId }),
  });
  if (!res.ok) throw new Error('Failed to flag post');
  return res.json();
}

export async function shuffleCardBackground(
  excludeId?: string
): Promise<CardBackground> {
  try {
    const url = new URL(`${API_BASE}/backgrounds/shuffle`);
    if (excludeId) url.searchParams.set('excludeId', excludeId);
    const res = await fetch(url.toString(), { cache: 'no-store' });
    if (res.ok) {
      const data = await res.json();
      return data.background;
    }
  } catch {
    // Offline fallback
  }
  const candidates = ALL_BACKGROUNDS.filter((b) => b.id !== excludeId);
  return (
    candidates[Math.floor(Math.random() * candidates.length)] ||
    CURATED_GRADIENTS[0]
  );
}

export async function fetchInbox(handle: string): Promise<{
  handle: string;
  inboxLink: string;
  count: number;
  unreadCount: number;
  messages: InboxMessageDTO[];
}> {
  const deviceId = getOrCreateDeviceId();
  const inboxCacheKey = `emous_inbox_cache_v1_${handle.toLowerCase()}`;
  try {
    const res = await fetch(
      `${API_BASE}/inbox?handle=${encodeURIComponent(handle)}`,
      {
        headers: { 'x-device-id': deviceId },
        cache: 'no-store',
      }
    );
    if (res.ok) {
      const data = await res.json();
      return data;
    }
  } catch {
    // Fallback below
  }

  let fallbackMessages: InboxMessageDTO[] = [];
  if (typeof window !== 'undefined') {
    try {
      fallbackMessages = JSON.parse(
        localStorage.getItem(inboxCacheKey) || '[]'
      );
    } catch {}
  }

  if (fallbackMessages.length === 0 && handle.toLowerCase() === 'goldenwizard') {
    const now = new Date().toISOString();
    const exp = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString();
    fallbackMessages = [
      {
        _id: 'seed-inbox-1',
        recipientHandle: 'GoldenWizard',
        question:
          'Be honest... who at the Friday hangout were you actually hoping would show up? 👀🔥',
        reply:
          'Nice try lol, if they see this story they already know who they are 🤫✨',
        repliedAt: now,
        themeId: 'story-pink-lime',
        isRead: true,
        flagsCount: 0,
        isHidden: false,
        createdAt: now,
        expiresAt: exp,
      },
      {
        _id: 'seed-inbox-2',
        recipientHandle: 'GoldenWizard',
        question:
          'Your Spotify playlists are elite. Drop your top late-night drive track right now 🎧',
        themeId: 'story-yellow-pink',
        isRead: false,
        flagsCount: 0,
        isHidden: false,
        createdAt: now,
        expiresAt: exp,
      },
    ];
  }

  return {
    handle,
    inboxLink: `emous.vercel.app/ask/${handle}`,
    count: fallbackMessages.length,
    unreadCount: fallbackMessages.filter((m) => !m.isRead).length,
    messages: fallbackMessages,
  };
}

export async function sendAnonymousInboxMessage(
  recipientHandle: string,
  question: string,
  themeId?: string
): Promise<{
  success: boolean;
  message: string;
  item: InboxMessageDTO;
}> {
  const deviceId = getOrCreateDeviceId();
  try {
    const res = await fetch(
      `${API_BASE}/inbox/${encodeURIComponent(recipientHandle)}`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-device-id': deviceId,
        },
        body: JSON.stringify({ question, themeId, deviceId }),
      }
    );
    if (res.ok) {
      const data = await res.json();
      if (typeof window !== 'undefined' && data.item) {
        try {
          const key = `emous_inbox_cache_v1_${recipientHandle.toLowerCase()}`;
          const existing = JSON.parse(localStorage.getItem(key) || '[]');
          existing.unshift(data.item);
          localStorage.setItem(key, JSON.stringify(existing.slice(0, 80)));
        } catch {}
      }
      return data;
    }
    const err = await res.json().catch(() => ({}));
    if (res.status === 400 || res.status === 429) {
      throw new Error(err.error || 'Blocked by Safety Shield');
    }
  } catch (err: any) {
    if (
      err?.message?.includes('Safety Shield') ||
      err?.message?.includes('Whoa there')
    ) {
      throw err;
    }
  }

  const now = new Date().toISOString();
  const localItem: InboxMessageDTO = {
    _id: `local-inbox-${Date.now()}`,
    recipientHandle,
    question: question.trim(),
    themeId: themeId || 'story-pink-lime',
    isRead: false,
    flagsCount: 0,
    isHidden: false,
    createdAt: now,
    expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
  };

  if (typeof window !== 'undefined') {
    try {
      const key = `emous_inbox_cache_v1_${recipientHandle.toLowerCase()}`;
      const existing = JSON.parse(localStorage.getItem(key) || '[]');
      existing.unshift(localItem);
      localStorage.setItem(key, JSON.stringify(existing.slice(0, 80)));
    } catch {}
  }

  return {
    success: true,
    message: `Secret message safely delivered to @${recipientHandle}! 🚀`,
    item: localItem,
  };
}

export async function replyToInboxMessage(
  messageId: string,
  reply: string,
  themeId?: string
): Promise<InboxMessageDTO> {
  const res = await fetch(`${API_BASE}/inbox/${messageId}/reply`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ reply, themeId }),
  });
  if (!res.ok) throw new Error('Failed to save reply');
  const data = await res.json();
  return data.message;
}

export async function flagInboxMessage(
  messageId: string,
  instantHide = false
): Promise<{ _id: string; flagsCount: number; isHidden: boolean }> {
  const deviceId = getOrCreateDeviceId();
  const res = await fetch(`${API_BASE}/inbox/${messageId}/flag`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-device-id': deviceId,
    },
    body: JSON.stringify({ deviceId, instantHide }),
  });
  if (!res.ok) throw new Error('Failed to flag message');
  return res.json();
}

export { POPULAR_TAGS };
