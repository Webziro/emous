import mongoose from 'mongoose';
import fs from 'node:fs';
import path from 'node:path';
import { randomUUID } from 'node:crypto';
import { UserModel } from './models/User';
import { PostModel } from './models/Post';
import { InboxMessageModel } from './models/InboxMessage';
import {
  BRAND,
  CardBackground,
  classifyPostTopics,
  CURATED_GRADIENTS,
  CURATED_UNSPLASH_IMAGES,
} from '../../shared';

let isMongoConnected = false;

export function isUsingMongo(): boolean {
  return isMongoConnected;
}

// ============================================================================
// High-Speed Local Store Engine (with 2dsphere $near math & 30-day TTL burn)
// Automatically used when MONGODB_URI is not set, and syncs to data/emous-db.json
// ============================================================================
export interface LocalUserDoc {
  _id: string;
  deviceId: string;
  handle: string;
  handleLower: string;
  createdAt: string;
  updatedAt: string;
}

export interface LocalPostDoc {
  _id: string;
  authorDeviceId: string;
  authorHandle: string;
  content: string;
  tag: string;
  tagLower: string;
  categories?: string[];
  keywords?: string[];
  background: CardBackground;
  location?: {
    type: 'Point';
    coordinates: [number, number]; // [longitude, latitude]
    label?: string;
  };
  reactions?: {
    fire: number;
    skull: number;
    eyes: number;
    heart: number;
  };
  reactedBy?: {
    fire: string[];
    skull: string[];
    eyes: string[];
    heart: string[];
  };
  comments?: {
    _id: string;
    authorHandle: string;
    authorDeviceId?: string;
    text: string;
    isOp?: boolean;
    createdAt: string;
  }[];
  flagsCount: number;
  flaggedBy: string[];
  isHidden: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface LocalInboxDoc {
  _id: string;
  recipientHandle: string;
  recipientHandleLower: string;
  senderDeviceId?: string;
  question: string;
  reply?: string;
  repliedAt?: string;
  themeId: string;
  isRead: boolean;
  burnAfterReading?: boolean;
  senderHint?: string;
  flagsCount: number;
  flaggedBy: string[];
  isHidden: boolean;
  createdAt: string;
  updatedAt: string;
}

interface LocalDBState {
  users: LocalUserDoc[];
  posts: LocalPostDoc[];
  inbox: LocalInboxDoc[];
}

const DATA_FILE = fs.existsSync(path.join(process.cwd(), 'data'))
  ? path.join(process.cwd(), 'data', 'emous-db.json')
  : path.join(process.cwd(), 'data', 'emous-db.json');

export const localStore: LocalDBState = {
  users: [],
  posts: [],
  inbox: [],
};

let lastLoadedMtimeMs = 0;

export function reloadLocalStoreFromDiskIfNeeded(force = false) {
  if (isMongoConnected) return;
  try {
    if (!fs.existsSync(DATA_FILE)) return;
    const stat = fs.statSync(DATA_FILE);
    if (force || stat.mtimeMs > lastLoadedMtimeMs || localStore.users.length === 0) {
      const raw = JSON.parse(fs.readFileSync(DATA_FILE, 'utf8'));
      localStore.users = raw.users || [];
      localStore.posts = (raw.posts || []).map((p: any) => {
        const analyzed = classifyPostTopics(p.content || '', p.tag);
        return {
          ...p,
          tag: analyzed.primaryTag,
          tagLower: analyzed.primaryTag.toLowerCase(),
          categories:
            Array.isArray(p.categories) && p.categories.length > 0
              ? p.categories
              : analyzed.matchedCategories,
          keywords:
            Array.isArray(p.keywords) && p.keywords.length > 0
              ? p.keywords
              : analyzed.keywords,
          reactions: p.reactions || { fire: 0, skull: 0, eyes: 0, heart: 0 },
          reactedBy: p.reactedBy || { fire: [], skull: [], eyes: [], heart: [] },
          comments: Array.isArray(p.comments) ? p.comments : [],
        };
      });
      localStore.inbox = raw.inbox || [];
      lastLoadedMtimeMs = stat.mtimeMs;
    }
  } catch {
    // Non-fatal
  }
}

export function saveLocalStore() {
  if (isMongoConnected) return;
  try {
    const dir = path.dirname(DATA_FILE);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    fs.writeFileSync(DATA_FILE, JSON.stringify(localStore, null, 2), 'utf8');
    const stat = fs.statSync(DATA_FILE);
    lastLoadedMtimeMs = stat.mtimeMs;
  } catch (err) {
    // Non-fatal in read-only or test environments
  }
}

export function purgeExpiredInboxMessages() {
  const now = Date.now();
  const ttlMs = BRAND.inboxBurnSeconds * 1000;
  const before = localStore.inbox.length;
  localStore.inbox = localStore.inbox.filter((msg) => {
    const age = now - new Date(msg.createdAt).getTime();
    return age < ttlMs;
  });
  if (localStore.inbox.length !== before) {
    saveLocalStore();
  }
}

export function createId(): string {
  return randomUUID().replace(/-/g, '').slice(0, 24);
}

function sanitizeAndAutoEncodeMongoUri(rawUri: string): string {
  // 1. Strip accidental leading/trailing quotes or whitespace from Render env var copy-paste
  let uri = rawUri.trim().replace(/^["']+|["']+$/g, '').trim();

  // 2. If user left literal <password> angle brackets around their password, strip the < and >
  //    and URL-encode special characters (@, #, :, /, ?) inside the password portion
  const match = uri.match(/^(mongodb(?:\+srv)?:\/\/)([^:]+):(.+)@([^@]+)$/);
  if (match) {
    const [, protocol, rawUser, rawPass, hostAndRest] = match;
    const cleanUser = rawUser.replace(/^<|>$/g, '');
    const cleanPass = rawPass.replace(/^<|>$/g, '');
    // Only encode if not already percent-encoded
    const encodedUser =
      decodeURIComponent(cleanUser) === cleanUser
        ? encodeURIComponent(cleanUser)
        : cleanUser;
    const encodedPass =
      decodeURIComponent(cleanPass) === cleanPass
        ? encodeURIComponent(cleanPass)
        : cleanPass;
    uri = `${protocol}${encodedUser}:${encodedPass}@${hostAndRest}`;
  }
  return uri;
}

export async function connectDatabase(): Promise<{
  mode: 'mongodb' | 'local-engine';
}> {
  const configuredUri = process.env.MONGODB_URI;

  if (configuredUri) {
    try {
      const safeUri = sanitizeAndAutoEncodeMongoUri(configuredUri);
      await mongoose.connect(safeUri, { serverSelectionTimeoutMS: 5000 });
      await Promise.all([
        UserModel.syncIndexes(),
        PostModel.syncIndexes(),
        InboxMessageModel.syncIndexes(),
      ]);
      isMongoConnected = true;
      console.log('✅ Connected to MongoDB Atlas / URI with 2dsphere & 30-day TTL indexes');
      await seedInitialDataIfEmpty();
      return { mode: 'mongodb' };
    } catch (err: any) {
      console.warn(
        `⚠️ Could not connect to MONGODB_URI (${err.message}). Falling back to instant Local Store Engine.`
      );
    }
  }

  isMongoConnected = false;
  reloadLocalStoreFromDiskIfNeeded(true);

  await seedInitialDataIfEmpty();
  purgeExpiredInboxMessages();
  console.log(
    '⚡ Connected to emous Local Store Engine (with 2dsphere $near geospatial filter & 30-day TTL auto-burn)'
  );
  return { mode: 'local-engine' };
}

export async function seedInitialDataIfEmpty() {
  const nowIso = new Date().toISOString();

  const demoUsers = [
    {
      _id: createId(),
      deviceId: 'demo-device-goldenwizard',
      handle: 'GoldenWizard',
      handleLower: 'goldenwizard',
      createdAt: nowIso,
      updatedAt: nowIso,
    },
    {
      _id: createId(),
      deviceId: 'demo-device-neonpanther',
      handle: 'NeonPanther',
      handleLower: 'neonpanther',
      createdAt: nowIso,
      updatedAt: nowIso,
    },
    {
      _id: createId(),
      deviceId: 'demo-device-acidrebel',
      handle: 'AcidRebel',
      handleLower: 'acidrebel',
      createdAt: nowIso,
      updatedAt: nowIso,
    },
    {
      _id: createId(),
      deviceId: 'demo-device-cyberviper',
      handle: 'CyberViper',
      handleLower: 'cyberviper',
      createdAt: nowIso,
      updatedAt: nowIso,
    },
  ];

  const samplePosts = [
    {
      _id: createId(),
      authorDeviceId: 'demo-device-goldenwizard',
      authorHandle: 'GoldenWizard',
      content:
        'Told my boss at the office my Wi-Fi crashed during the 4PM work standup when I was actually already in line for rooftop tacos & margaritas 🌮🤫',
      tag: '#Work',
      tagLower: '#work',
      categories: ['#Work', '#NightOut'],
      keywords: ['boss', 'office', 'work', 'standup', 'rooftop', 'tacos', 'margaritas'],
      background: CURATED_GRADIENTS[0], // Neon Riot
      location: {
        type: 'Point' as const,
        coordinates: [-74.006, 40.7128] as [number, number],
        label: '0.4 mi away',
      },
      reactions: { fire: 14, skull: 8, eyes: 5, heart: 3 },
      reactedBy: { fire: [], skull: [], eyes: [], heart: [] },
      comments: [
        {
          _id: createId(),
          authorHandle: 'NeonPanther',
          text: 'Honestly the 4PM Friday standup deserves to be skipped every week 😂🔥',
          isOp: false,
          createdAt: new Date(Date.now() - 1000 * 60 * 4).toISOString(),
        },
      ],
      flagsCount: 0,
      flaggedBy: [],
      isHidden: false,
      createdAt: new Date(Date.now() - 1000 * 60 * 8).toISOString(),
      updatedAt: nowIso,
    },
    {
      _id: createId(),
      authorDeviceId: 'demo-device-neonpanther',
      authorHandle: 'NeonPanther',
      content:
        'Whoever was wearing the vintage neon green puffer at the 2AM warehouse rave party last night... we locked eyes 3 times. Drop a sign 👀⚡',
      tag: '#NightOut',
      tagLower: '#nightout',
      categories: ['#NightOut', '#SexAndDating'],
      keywords: ['warehouse', 'rave', 'party', '2am', 'night'],
      background: CURATED_UNSPLASH_IMAGES[2], // Warehouse Rave Lasers
      location: {
        type: 'Point' as const,
        coordinates: [-73.998, 40.7205] as [number, number],
        label: '1.1 mi away',
      },
      reactions: { fire: 22, skull: 2, eyes: 19, heart: 11 },
      reactedBy: { fire: [], skull: [], eyes: [], heart: [] },
      comments: [],
      flagsCount: 0,
      flaggedBy: [],
      isHidden: false,
      createdAt: new Date(Date.now() - 1000 * 60 * 24).toISOString(),
      updatedAt: nowIso,
    },
    {
      _id: createId(),
      authorDeviceId: 'demo-device-acidrebel',
      authorHandle: 'AcidRebel',
      content:
        'My gym crush finally asked to spot me on bench press today and I forgot how to count past 4 reps 💀🏋️‍♂️',
      tag: '#Gym',
      tagLower: '#gym',
      categories: ['#Gym', '#SexAndDating'],
      keywords: ['gym', 'crush', 'bench', 'workout'],
      background: CURATED_GRADIENTS[1], // Acid Lime Flyer
      location: {
        type: 'Point' as const,
        coordinates: [-74.012, 40.708] as [number, number],
        label: '0.8 mi away',
      },
      reactions: { fire: 31, skull: 6, eyes: 4, heart: 18 },
      reactedBy: { fire: [], skull: [], eyes: [], heart: [] },
      comments: [],
      flagsCount: 0,
      flaggedBy: [],
      isHidden: false,
      createdAt: new Date(Date.now() - 1000 * 60 * 47).toISOString(),
      updatedAt: nowIso,
    },
    {
      _id: createId(),
      authorDeviceId: 'demo-device-cyberviper',
      authorHandle: 'CyberViper',
      content:
        'Put my semester campus allowance into a Solana crypto memecoin at 3AM and woke up up 400%. Paying off the whole hostel dorm tuition 🚀💎',
      tag: '#Crypto',
      tagLower: '#crypto',
      categories: ['#Crypto', '#Campus'],
      keywords: ['crypto', 'solana', 'memecoin', 'campus', 'semester', 'hostel', 'dorm'],
      background: CURATED_UNSPLASH_IMAGES[0], // Neon Streetwear Alley
      location: {
        type: 'Point' as const,
        coordinates: [-73.989, 40.7308] as [number, number],
        label: '1.9 mi away',
      },
      reactions: { fire: 9, skull: 27, eyes: 7, heart: 4 },
      reactedBy: { fire: [], skull: [], eyes: [], heart: [] },
      comments: [],
      flagsCount: 0,
      flaggedBy: [],
      isHidden: false,
      createdAt: new Date(Date.now() - 1000 * 60 * 95).toISOString(),
      updatedAt: nowIso,
    },
    {
      _id: createId(),
      authorDeviceId: 'demo-device-goldenwizard',
      authorHandle: 'GoldenWizard',
      content:
        'Sneaky link confession: hooking up with someone from the office HR department is all fun and games until you both get invited to the same 9AM meeting 👀🔥',
      tag: '#SexAndDating',
      tagLower: '#sexanddating',
      categories: ['#SexAndDating', '#Work'],
      keywords: ['sneaky', 'sex', 'dating', 'office', 'hr', 'meeting', 'work'],
      background: CURATED_GRADIENTS[3], // Midnight Rave
      location: {
        type: 'Point' as const,
        coordinates: [-74.001, 40.718] as [number, number],
        label: '0.6 mi away',
      },
      reactions: { fire: 7, skull: 3, eyes: 15, heart: 24 },
      reactedBy: { fire: [], skull: [], eyes: [], heart: [] },
      comments: [],
      flagsCount: 0,
      flaggedBy: [],
      isHidden: false,
      createdAt: new Date(Date.now() - 1000 * 60 * 140).toISOString(),
      updatedAt: nowIso,
    },
  ];

  const sampleInbox = [
    {
      _id: createId(),
      recipientHandle: 'GoldenWizard',
      recipientHandleLower: 'goldenwizard',
      question:
        'Be honest... who at the Friday hangout were you actually hoping would show up? 👀🔥',
      reply:
        'Nice try lol, if they see this story they already know who they are 🤫✨',
      repliedAt: new Date(Date.now() - 1000 * 60 * 15).toISOString(),
      themeId: 'story-pink-lime',
      isRead: true,
      flagsCount: 0,
      flaggedBy: [],
      isHidden: false,
      createdAt: new Date(Date.now() - 1000 * 60 * 30).toISOString(),
      updatedAt: nowIso,
    },
    {
      _id: createId(),
      recipientHandle: 'GoldenWizard',
      recipientHandleLower: 'goldenwizard',
      question:
        'Your Spotify playlists are elite. Drop your top late-night drive track right now 🎧',
      themeId: 'story-yellow-pink',
      isRead: false,
      flagsCount: 0,
      flaggedBy: [],
      isHidden: false,
      createdAt: new Date(Date.now() - 1000 * 60 * 12).toISOString(),
      updatedAt: nowIso,
    },
    {
      _id: createId(),
      recipientHandle: 'GoldenWizard',
      recipientHandleLower: 'goldenwizard',
      question:
        'Lowkey had a crush on you since the studio session in September ngl 🫣',
      themeId: 'story-lime-white',
      isRead: false,
      flagsCount: 0,
      flaggedBy: [],
      isHidden: false,
      createdAt: new Date(Date.now() - 1000 * 60 * 4).toISOString(),
      updatedAt: nowIso,
    },
  ];

  if (isMongoConnected) {
    const existingUsers = await UserModel.countDocuments();
    if (existingUsers > 0) return;
    await UserModel.insertMany(demoUsers.map(({ _id, ...rest }) => rest));
    await PostModel.insertMany(samplePosts.map(({ _id, ...rest }) => rest));
    await InboxMessageModel.insertMany(
      sampleInbox.map(({ _id, ...rest }) => rest)
    );
    return;
  }

  if (localStore.users.length === 0 || localStore.posts.length === 0) {
    if (localStore.users.length === 0) localStore.users = demoUsers;
    if (localStore.posts.length === 0) localStore.posts = samplePosts;
    if (localStore.inbox.length === 0) localStore.inbox = sampleInbox;
    saveLocalStore();
  }
}

export async function disconnectDatabase() {
  if (isMongoConnected) {
    await mongoose.disconnect();
  }
}
