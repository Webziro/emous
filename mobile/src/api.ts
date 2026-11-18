import {
  ALL_BACKGROUNDS,
  CardBackground,
  CURATED_GRADIENTS,
  generateRandomHandle,
  InboxMessageDTO,
  PostDTO,
  ReactionCounts,
  ReactionType,
  UserIdentityDTO,
} from '../../shared';

// Automatically points to localhost:4000 (or your LAN IP / Render production API URL)
export const API_BASE_URL =
  process.env.EXPO_PUBLIC_API_URL || 'http://localhost:4000/api/v1';

let memoryDeviceId = '';
let memoryHandle = '';

export function getMobileDeviceId(): string {
  if (!memoryDeviceId) {
    memoryDeviceId = `ios-android-${Date.now().toString(36)}-${Math.random()
      .toString(36)
      .slice(2, 9)}`;
  }
  return memoryDeviceId;
}

export async function initMobileIdentity(
  savedDeviceId?: string,
  savedHandle?: string
): Promise<UserIdentityDTO> {
  const deviceId = savedDeviceId || getMobileDeviceId();
  memoryDeviceId = deviceId;

  try {
    const res = await fetch(`${API_BASE_URL}/identity/init`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-device-id': deviceId,
      },
      body: JSON.stringify({
        deviceId,
        preferredHandle: savedHandle,
      }),
    });
    if (res.ok) {
      const data: UserIdentityDTO = await res.json();
      memoryHandle = data.handle;
      return data;
    }
  } catch {
    // Offline fallback
  }

  const handle = savedHandle || memoryHandle || generateRandomHandle(false);
  memoryHandle = handle;
  return {
    deviceId,
    handle,
    inboxLink: `emous.app/ask/${handle}`,
    createdAt: new Date().toISOString(),
  };
}

export async function fetchMobilePosts(params: {
  mode: 'global' | 'near';
  tag?: string;
  lat?: number;
  lng?: number;
}): Promise<PostDTO[]> {
  const deviceId = getMobileDeviceId();
  const query = new URLSearchParams({ mode: params.mode });
  if (params.tag && params.tag !== 'All') {
    query.set('tag', params.tag);
  }
  if (params.mode === 'near' && params.lat !== undefined && params.lng !== undefined) {
    query.set('lat', String(params.lat));
    query.set('lng', String(params.lng));
    query.set('radiusMiles', '5');
  }

  const res = await fetch(`${API_BASE_URL}/posts?${query.toString()}`, {
    headers: { 'x-device-id': deviceId },
  });
  if (!res.ok) throw new Error('Failed to fetch feed');
  const data = await res.json();
  return data.posts;
}

export async function createMobilePost(payload: {
  content: string;
  tag: string;
  background: CardBackground;
  authorHandle: string;
  lat?: number;
  lng?: number;
}): Promise<PostDTO> {
  const deviceId = getMobileDeviceId();
  const res = await fetch(`${API_BASE_URL}/posts`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-device-id': deviceId,
    },
    body: JSON.stringify({ ...payload, deviceId }),
  });
  if (!res.ok) throw new Error('Failed to create post');
  const data = await res.json();
  return data.post;
}

export async function reactMobilePost(
  postId: string,
  type: ReactionType
): Promise<{
  _id: string;
  type: ReactionType;
  action: 'added' | 'removed';
  reactions: ReactionCounts;
  myReactions: ReactionType[];
}> {
  const deviceId = getMobileDeviceId();
  const res = await fetch(`${API_BASE_URL}/posts/${postId}/react`, {
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

export async function flagMobilePost(postId: string): Promise<{
  _id: string;
  flagsCount: number;
  isHidden: boolean;
}> {
  const deviceId = getMobileDeviceId();
  const res = await fetch(`${API_BASE_URL}/posts/${postId}/flag`, {
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

export async function shuffleMobileBackground(
  excludeId?: string
): Promise<CardBackground> {
  try {
    const res = await fetch(
      `${API_BASE_URL}/backgrounds/shuffle?excludeId=${encodeURIComponent(
        excludeId || ''
      )}`
    );
    if (res.ok) {
      const data = await res.json();
      return data.background;
    }
  } catch {
    // Fallback to local pool
  }
  const pool = ALL_BACKGROUNDS.filter((b) => b.id !== excludeId);
  return pool[Math.floor(Math.random() * pool.length)] || CURATED_GRADIENTS[0];
}

export async function fetchMobileInbox(handle: string): Promise<{
  messages: InboxMessageDTO[];
  unreadCount: number;
}> {
  const deviceId = getMobileDeviceId();
  const res = await fetch(
    `${API_BASE_URL}/inbox?handle=${encodeURIComponent(handle)}`,
    {
      headers: { 'x-device-id': deviceId },
    }
  );
  if (!res.ok) throw new Error('Failed to fetch inbox');
  return res.json();
}

export async function saveMobileInboxReply(
  messageId: string,
  reply: string,
  themeId: string
): Promise<InboxMessageDTO> {
  const res = await fetch(`${API_BASE_URL}/inbox/${messageId}/reply`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ reply, themeId }),
  });
  if (!res.ok) throw new Error('Failed to save reply');
  const data = await res.json();
  return data.message;
}
