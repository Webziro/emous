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
  background: CardBackground;
  location?: {
    type: 'Point';
    coordinates: [number, number]; // [longitude, latitude]
    label?: string;
  };
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

const DATA_FILE = path.join(__dirname, '..', 'data', 'emous-db.json');

export const localStore: LocalDBState = {
  users: [],
  posts: [],
  inbox: [],
};

export function saveLocalStore() {
  if (isMongoConnected) return;
  try {
    const dir = path.dirname(DATA_FILE);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    fs.writeFileSync(DATA_FILE, JSON.stringify(localStore, null, 2), 'utf8');
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

export async function connectDatabase(): Promise<{
  mode: 'mongodb' | 'local-engine';
}> {
  const configuredUri = process.env.MONGODB_URI;

  if (configuredUri) {
    try {
      await mongoose.connect(configuredUri, { serverSelectionTimeoutMS: 5000 });
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
  if (fs.existsSync(DATA_FILE)) {
    try {
      const raw = JSON.parse(fs.readFileSync(DATA_FILE, 'utf8'));
      localStore.users = raw.users || [];
      localStore.posts = raw.posts || [];
      localStore.inbox = raw.inbox || [];
    } catch {
      // Re-seed if corrupted
    }
  }

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
        'Told my boss my Wi-Fi crashed during the 4PM standup when I was actually already in line for rooftop tacos & margaritas 🌮🤫',
      tag: '#WorkConfessions',
      tagLower: '#workconfessions',
      background: CURATED_GRADIENTS[0], // Neon Riot
      location: {
        type: 'Point' as const,
        coordinates: [-74.006, 40.7128] as [number, number],
        label: '0.4 mi away',
      },
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
        'Whoever was wearing the vintage neon green puffer at the 2AM warehouse set last night... we locked eyes 3 times. Drop a sign 👀⚡',
      tag: '#NightOut',
      tagLower: '#nightout',
      background: CURATED_UNSPLASH_IMAGES[2], // Warehouse Rave Lasers
      location: {
        type: 'Point' as const,
        coordinates: [-73.998, 40.7205] as [number, number],
        label: '1.1 mi away',
      },
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
        'Unpopular opinion: 3AM diner fries with the squad hit 100x harder than any $200 reservation spot in the city.',
      tag: '#UnpopularOpinion',
      tagLower: '#unpopularopinion',
      background: CURATED_GRADIENTS[1], // Acid Lime Flyer
      location: {
        type: 'Point' as const,
        coordinates: [-74.012, 40.708] as [number, number],
        label: '0.8 mi away',
      },
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
        'Our entire group project got an A+ and none of us know who actually wrote the final 6 slides on the Google Doc 💀',
      tag: '#CampusTea',
      tagLower: '#campustea',
      background: CURATED_UNSPLASH_IMAGES[0], // Neon Streetwear Alley
      location: {
        type: 'Point' as const,
        coordinates: [-73.989, 40.7308] as [number, number],
        label: '1.9 mi away',
      },
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
        'I still have a playlist secretly named after someone I talked to for literally 2 weeks back in October.',
      tag: '#CrushAlert',
      tagLower: '#crushalert',
      background: CURATED_GRADIENTS[3], // Midnight Rave
      location: {
        type: 'Point' as const,
        coordinates: [-74.001, 40.718] as [number, number],
        label: '0.6 mi away',
      },
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

  if (localStore.users.length > 0) return;
  localStore.users = demoUsers;
  localStore.posts = samplePosts;
  localStore.inbox = sampleInbox;
  saveLocalStore();
}

export async function disconnectDatabase() {
  if (isMongoConnected) {
    await mongoose.disconnect();
  }
}
