import {
  ALL_BACKGROUNDS,
  CardBackground,
  CURATED_GRADIENTS,
  generateRandomHandle,
  InboxMessageDTO,
  POPULAR_TAGS,
  PostDTO,
  ReactionCounts,
  ReactionType,
  UserIdentityDTO,
} from '@shared/index';

const API_BASE =
  process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000/api/v1';

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

  const res = await fetch(url.toString(), {
    headers: { 'x-device-id': deviceId },
    cache: 'no-store',
  });
  if (!res.ok) throw new Error('Failed to load feed');
  return res.json();
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
  const res = await fetch(`${API_BASE}/posts`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-device-id': deviceId,
    },
    body: JSON.stringify({ ...payload, deviceId }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error || 'Failed to publish post');
  }
  const data = await res.json();
  return data.post;
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
  const res = await fetch(
    `${API_BASE}/inbox?handle=${encodeURIComponent(handle)}`,
    {
      headers: { 'x-device-id': deviceId },
      cache: 'no-store',
    }
  );
  if (!res.ok) throw new Error('Failed to fetch inbox');
  return res.json();
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
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error || 'Failed to send anonymous message');
  }
  return res.json();
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
