/**
 * emous — Shared Design System, Brand Tokens, Gradients, Unsplash Presets & Handle Wordlists
 * Used across Backend API (/server), Next.js Web (/web), and Expo Mobile (/mobile)
 */

export const BRAND = {
  name: 'emous',
  domain: 'emous.app',
  tagline: 'No Names. Just Real Talk.',
  inboxHook: '🤫 Drop your link on your socials & get anonymous confessions!',
  growthFooterText: 'Want to receive your own anonymous messages? Get emous Free',
  maxPostLength: 300,
  maxFlagThreshold: 3,
  inboxBurnDays: 30,
  inboxBurnSeconds: 30 * 24 * 60 * 60, // 2,592,000 seconds
  defaultRadiusMiles: 5,
  milesToMeters: (miles: number) => Math.round(miles * 1609.344),
} as const;

export const COLORS = {
  bgPrimary: '#0D0D11',     // Deep off-black / dark charcoal
  bgSurface: '#181820',     // Elevated dark card surface
  bgLight: '#FFFFFF',       // Stark white for high-contrast light components
  textPrimary: '#FFFFFF',
  textDark: '#0D0D11',
  textMuted: '#9CA3AF',
  accentPink: '#FF1E8E',    // Accent 1: Neon Pink / Magenta (primary CTAs, active states)
  accentLime: '#CCFF00',    // Accent 2: Vibrant Lime Green (headers, positive notifications, active filters)
  accentYellow: '#FFE600',  // Accent 3: Electric Yellow (timestamps, highlight blocks, callouts)
  accentCyan: '#00F0FF',    // Secondary streetwear highlight
  accentPurple: '#7B2CBF',  // Secondary gradient stop
  borderBrutal: '#000000',  // Chunky flyer border
} as const;

export interface CardBackground {
  id: string;
  type: 'gradient' | 'image';
  name: string;
  /** CSS gradient string or image URL */
  value: string;
  /** Array of hex colors for React Native LinearGradient fallback */
  colors: [string, string, ...string[]];
  textColor: '#FFFFFF' | '#0D0D11';
  badgeBg: string;
  badgeText: string;
  attribution?: string;
}

export const CURATED_GRADIENTS: CardBackground[] = [
  {
    id: 'grad-neon-riot',
    type: 'gradient',
    name: 'Neon Riot',
    value: 'linear-gradient(135deg, #FF1E8E 0%, #7928CA 100%)',
    colors: ['#FF1E8E', '#7928CA'],
    textColor: '#FFFFFF',
    badgeBg: '#CCFF00',
    badgeText: '#0D0D11',
  },
  {
    id: 'grad-acid-lime',
    type: 'gradient',
    name: 'Acid Lime Flyer',
    value: 'linear-gradient(135deg, #CCFF00 0%, #00E5A3 100%)',
    colors: ['#CCFF00', '#00E5A3'],
    textColor: '#0D0D11',
    badgeBg: '#FF1E8E',
    badgeText: '#FFFFFF',
  },
  {
    id: 'grad-cyber-sunset',
    type: 'gradient',
    name: 'Cyber Sunset',
    value: 'linear-gradient(135deg, #FF0055 0%, #FFE600 100%)',
    colors: ['#FF0055', '#FFE600'],
    textColor: '#0D0D11',
    badgeBg: '#0D0D11',
    badgeText: '#CCFF00',
  },
  {
    id: 'grad-midnight-rave',
    type: 'gradient',
    name: 'Midnight Rave',
    value: 'linear-gradient(135deg, #120458 0%, #FF1E8E 100%)',
    colors: ['#120458', '#FF1E8E'],
    textColor: '#FFFFFF',
    badgeBg: '#FFE600',
    badgeText: '#0D0D11',
  },
  {
    id: 'grad-electric-voltage',
    type: 'gradient',
    name: 'Electric Voltage',
    value: 'linear-gradient(135deg, #FFE600 0%, #FF6B00 100%)',
    colors: ['#FFE600', '#FF6B00'],
    textColor: '#0D0D11',
    badgeBg: '#0D0D11',
    badgeText: '#FFFFFF',
  },
  {
    id: 'grad-tokyo-drift',
    type: 'gradient',
    name: 'Tokyo Drift',
    value: 'linear-gradient(135deg, #00F0FF 0%, #7000FF 100%)',
    colors: ['#00F0FF', '#7000FF'],
    textColor: '#FFFFFF',
    badgeBg: '#FF1E8E',
    badgeText: '#FFFFFF',
  },
  {
    id: 'grad-concrete-jungle',
    type: 'gradient',
    name: 'Concrete Jungle',
    value: 'linear-gradient(135deg, #1F1C2C 0%, #928DAB 100%)',
    colors: ['#1F1C2C', '#3A3552'],
    textColor: '#FFFFFF',
    badgeBg: '#CCFF00',
    badgeText: '#0D0D11',
  },
];

export const CURATED_UNSPLASH_IMAGES: CardBackground[] = [
  {
    id: 'img-neon-alley',
    type: 'image',
    name: 'Neon Streetwear Alley',
    value: 'https://images.unsplash.com/photo-1509198397868-475647b2a1e5?auto=format&fit=crop&w=900&q=80',
    colors: ['#120458', '#FF1E8E'],
    textColor: '#FFFFFF',
    badgeBg: '#CCFF00',
    badgeText: '#0D0D11',
    attribution: 'Unsplash / Urban Night',
  },
  {
    id: 'img-abstract-wave',
    type: 'image',
    name: 'Chromatic Liquid',
    value: 'https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?auto=format&fit=crop&w=900&q=80',
    colors: ['#FF1E8E', '#7928CA'],
    textColor: '#FFFFFF',
    badgeBg: '#FFE600',
    badgeText: '#0D0D11',
    attribution: 'Unsplash / Milad Fakurian',
  },
  {
    id: 'img-concert-laser',
    type: 'image',
    name: 'Warehouse Rave Lasers',
    value: 'https://images.unsplash.com/photo-1514525253161-7a46d19cd819?auto=format&fit=crop&w=900&q=80',
    colors: ['#1F1C2C', '#FF0055'],
    textColor: '#FFFFFF',
    badgeBg: '#FF1E8E',
    badgeText: '#FFFFFF',
    attribution: 'Unsplash / Aditya Chinchure',
  },
  {
    id: 'img-cyber-lights',
    type: 'image',
    name: 'Shibuya After Hours',
    value: 'https://images.unsplash.com/photo-1508739773434-c26b3d09e071?auto=format&fit=crop&w=900&q=80',
    colors: ['#0D0D11', '#00F0FF'],
    textColor: '#FFFFFF',
    badgeBg: '#FFE600',
    badgeText: '#0D0D11',
    attribution: 'Unsplash / Night City',
  },
  {
    id: 'img-holo-foil',
    type: 'image',
    name: 'Holographic Foil',
    value: 'https://images.unsplash.com/photo-1579783900882-c0d3dad7b119?auto=format&fit=crop&w=900&q=80',
    colors: ['#7000FF', '#FF1E8E'],
    textColor: '#FFFFFF',
    badgeBg: '#CCFF00',
    badgeText: '#0D0D11',
    attribution: 'Unsplash / Abstract Foil',
  },
];

export const ALL_BACKGROUNDS: CardBackground[] = [
  ...CURATED_GRADIENTS,
  ...CURATED_UNSPLASH_IMAGES,
];

export const STORY_COLOR_PAIRS = [
  {
    id: 'story-pink-lime',
    name: 'Pink x Acid Lime',
    canvasBg: '#0D0D11',
    topCardBg: '#FF1E8E',
    topCardText: '#FFFFFF',
    bottomCardBg: '#CCFF00',
    bottomCardText: '#0D0D11',
    accentColor: '#FFE600',
  },
  {
    id: 'story-yellow-pink',
    name: 'Electric Yellow x Magenta',
    canvasBg: '#0D0D11',
    topCardBg: '#FFE600',
    topCardText: '#0D0D11',
    bottomCardBg: '#FF1E8E',
    bottomCardText: '#FFFFFF',
    accentColor: '#CCFF00',
  },
  {
    id: 'story-lime-white',
    name: 'Lime x Crisp White',
    canvasBg: '#120458',
    topCardBg: '#CCFF00',
    topCardText: '#0D0D11',
    bottomCardBg: '#FFFFFF',
    bottomCardText: '#0D0D11',
    accentColor: '#FF1E8E',
  },
] as const;

export const POPULAR_TAGS = [
  '#WorkConfessions',
  '#CampusTea',
  '#NightOut',
  '#CrushAlert',
  '#UnpopularOpinion',
  '#LateNightThoughts',
  '#Streetalk',
] as const;

export const HANDLE_ADJECTIVES = [
  'Golden',
  'Neon',
  'Electric',
  'Cosmic',
  'Midnight',
  'Velvet',
  'Cyber',
  'Hyper',
  'Shadow',
  'Crimson',
  'Acid',
  'Phantom',
  'Solar',
  'Turbo',
  'Glitch',
  'Wild',
  'Atomic',
  'rogue',
  'Stealth',
  'Toxic',
  'Vibrant',
  'Sonic',
  'Lunar',
  'Blazing',
] as const;

export const HANDLE_NOUNS = [
  'Wizard',
  'Maverick',
  'Panther',
  'Viper',
  'Phoenix',
  'Samurai',
  'Ghost',
  'Rebel',
  'Voyager',
  'Falcon',
  'Cipher',
  'Nomad',
  'Knight',
  'Sphinx',
  'Drifter',
  'Raven',
  'Oracle',
  'Bandit',
  'Wolf',
  'Titan',
  'Fox',
  'Ninja',
  'Comet',
  'Djinn',
] as const;

export function generateRandomHandle(withNumber = false): string {
  const adjRaw = HANDLE_ADJECTIVES[Math.floor(Math.random() * HANDLE_ADJECTIVES.length)];
  const adj = adjRaw.charAt(0).toUpperCase() + adjRaw.slice(1);
  const noun = HANDLE_NOUNS[Math.floor(Math.random() * HANDLE_NOUNS.length)];
  if (withNumber) {
    const num = Math.floor(10 + Math.random() * 89);
    return `${adj}${noun}${num}`;
  }
  return `${adj}${noun}`;
}

export interface UserIdentityDTO {
  deviceId: string;
  handle: string;
  inboxLink: string;
  createdAt: string;
}

export interface PostDTO {
  _id: string;
  authorHandle: string;
  content: string;
  tag: string;
  background: CardBackground;
  location?: {
    type: 'Point';
    coordinates: [number, number]; // [longitude, latitude]
    label?: string;
  };
  distanceMiles?: number;
  flagsCount: number;
  isFlaggedByMe?: boolean;
  isHidden: boolean;
  createdAt: string;
}

export interface InboxMessageDTO {
  _id: string;
  recipientHandle: string;
  question: string;
  reply?: string;
  repliedAt?: string;
  themeId: string;
  isRead: boolean;
  flagsCount: number;
  isHidden: boolean;
  createdAt: string;
  expiresAt: string;
}
