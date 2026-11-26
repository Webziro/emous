/**
 * emous — Shared Design System, Brand Tokens, Gradients, Unsplash Presets & Handle Wordlists
 * Used across Backend API (/server), Next.js Web (/web), and Expo Mobile (/mobile)
 */

export const BRAND = {
  name: 'emous',
  domain: 'emous.vercel.app',
  apiBaseUrl: 'https://emous.onrender.com/api/v1',
  webBaseUrl: 'https://emous.vercel.app',
  tagline: 'No Names. Just Real Talk.',
  inboxHook: '🤫 Drop your link on your socials & get anonymous confessions!',
  growthFooterText: 'Want to receive your own anonymous messages? Get emous Free',
  adminWhatsappNumber:
    process.env.NEXT_PUBLIC_ADMIN_WHATSAPP ||
    process.env.ADMIN_WHATSAPP ||
    '',
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
  '#Work',
  '#SexAndDating',
  '#Crypto',
  '#Gym',
  '#Politics',
  '#Religion',
  '#Campus',
  '#NightOut',
] as const;

export const TOPIC_DICTIONARIES: Record<string, readonly string[]> = {
  '#Work': [
    'work',
    'office',
    'boss',
    'coworker',
    'colleague',
    'hr',
    'salary',
    'job',
    'meeting',
    'standup',
    'client',
    'career',
    'promotion',
    'paycheck',
    'remote',
    'intern',
    'manager',
    'corporate',
    '9-5',
    'shift',
    'resign',
    'fired',
  ],
  '#SexAndDating': [
    'sex',
    'hookup',
    'crush',
    'dating',
    'date',
    'ex',
    'boyfriend',
    'girlfriend',
    'situationship',
    'kiss',
    'bed',
    'tinder',
    'hinge',
    'bumble',
    'sneaky',
    'partner',
    'cheating',
    'cheat',
    'virgin',
    'intimate',
    'bedroom',
    'flirt',
    'attraction',
    'love',
  ],
  '#Crypto': [
    'crypto',
    'bitcoin',
    'btc',
    'eth',
    'ethereum',
    'solana',
    'sol',
    'memecoin',
    'token',
    'wallet',
    'binance',
    'coinbase',
    'web3',
    'nft',
    'airdrop',
    'degen',
    'bull',
    'bear',
    'blockchain',
    'hodl',
    'portfolio',
    'pump',
  ],
  '#Gym': [
    'gym',
    'workout',
    'protein',
    'creatine',
    'cardio',
    'legday',
    'bench',
    'squat',
    'deadlift',
    'fitness',
    'gains',
    'muscle',
    'trainer',
    'treadmill',
    'weights',
    'bulk',
    'cut',
    'physique',
  ],
  '#Politics': [
    'politics',
    'political',
    'president',
    'election',
    'vote',
    'voting',
    'government',
    'govt',
    'senate',
    'congress',
    'minister',
    'governor',
    'mayor',
    'policy',
    'tax',
    'taxes',
    'democracy',
    'campaign',
    'parliament',
  ],
  '#Religion': [
    'religion',
    'religious',
    'church',
    'mosque',
    'temple',
    'pray',
    'prayer',
    'god',
    'allah',
    'jesus',
    'faith',
    'pastor',
    'imam',
    'priest',
    'bible',
    'quran',
    'sermon',
    'sin',
    'blessed',
    'spiritual',
    'worship',
    'sunday',
    'friday',
  ],
  '#Campus': [
    'campus',
    'college',
    'university',
    'uni',
    'lecturer',
    'professor',
    'exam',
    'exams',
    'hostel',
    'dorm',
    'semester',
    'gpa',
    'student',
    'class',
    'lecture',
    'assignment',
    'thesis',
    'project',
    'library',
    'freshman',
    'final',
  ],
  '#NightOut': [
    'nightout',
    'club',
    'party',
    'rave',
    'warehouse',
    'drinks',
    'drunk',
    'bar',
    'rooftop',
    'dj',
    'tequila',
    'margaritas',
    'tacos',
    'hangover',
    '2am',
    '3am',
    '4am',
    'diner',
    'fries',
    'vip',
    'bouncer',
    'festival',
    'concert',
  ],
};

const STOP_WORDS = new Set([
  'the',
  'and',
  'for',
  'that',
  'this',
  'with',
  'you',
  'not',
  'are',
  'from',
  'your',
  'all',
  'have',
  'had',
  'has',
  'was',
  'were',
  'will',
  'would',
  'could',
  'should',
  'they',
  'them',
  'their',
  'what',
  'when',
  'where',
  'who',
  'whom',
  'why',
  'how',
  'but',
  'out',
  'about',
  'into',
  'just',
  'like',
  'really',
  'still',
  'even',
  'back',
  'only',
  'know',
  'none',
  'our',
  'actually',
  'already',
  'literally',
  'someone',
  'anyone',
  'everyone',
  'been',
  'being',
  'over',
  'under',
  'more',
  'than',
  'then',
  'some',
  'such',
  'very',
  'much',
  'many',
  'any',
  'every',
  'can',
  'cannot',
  'dont',
  'didnt',
  'wasnt',
  'arent',
  'isnt',
  'ive',
  'im',
]);

/**
 * Dynamically categorizes a confession post based on:
 * 1. Explicit #hashtag inside the text (or user-provided custom tag)
 * 2. NLP keyword matching against TOPIC_DICTIONARIES (#Work, #SexAndDating, #Crypto, #Gym, #Politics, #Religion, #Campus, #NightOut)
 * 3. Extracts clean keywords/phrases for the Trending Radar tab.
 */
export function classifyPostTopics(
  content: string,
  explicitTagInput?: string
): {
  primaryTag: string;
  matchedCategories: string[];
  keywords: string[];
} {
  const textLower = (content || '').toLowerCase();

  // 1. Extract explicit #hashtags written directly inside the post content
  const inlineHashtags: string[] = [];
  const hashRegex = /#([a-zA-Z0-9_]{2,28})/g;
  let match: RegExpExecArray | null;
  while ((match = hashRegex.exec(content)) !== null) {
    const formatted = `#${match[1].charAt(0).toUpperCase()}${match[1].slice(1)}`;
    if (!inlineHashtags.includes(formatted)) {
      inlineHashtags.push(formatted);
    }
  }

  // 2. Score content against TOPIC_DICTIONARIES
  const categoryScores: { tag: string; score: number }[] = [];
  const detectedKeywords = new Set<string>();

  for (const [categoryTag, wordList] of Object.entries(TOPIC_DICTIONARIES)) {
    let score = 0;
    for (const kw of wordList) {
      const escaped = kw.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      const kwRegex = new RegExp(`\\b${escaped}\\b`, 'i');
      if (kwRegex.test(textLower)) {
        score += 2;
        detectedKeywords.add(kw.toLowerCase());
      }
    }
    if (score > 0) {
      categoryScores.push({ tag: categoryTag, score });
    }
  }

  categoryScores.sort((a, b) => b.score - a.score);
  const matchedCategories = categoryScores.map((c) => c.tag);

  // 3. Only track curated topic keywords + explicit #hashtags (no random filler words!)
  for (const h of inlineHashtags) {
    detectedKeywords.add(h);
  }

  // 4. Determine primaryTag:
  //    - If the user wrote an inline #hashtag in their post, prioritize it
  //    - Otherwise if NLP matched a topic (#Work, #SexAndDating, #Crypto, etc.) and the user left the tag on 'Auto' or default, use the NLP topic!
  //    - Otherwise use the user's explicit tag or fallback to '#Confessions'
  let cleanExplicit = (explicitTagInput || '').trim().replace(/\s+/g, '');
  if (
    cleanExplicit &&
    cleanExplicit.toLowerCase() !== 'auto' &&
    cleanExplicit.toLowerCase() !== '#auto'
  ) {
    cleanExplicit = cleanExplicit.startsWith('#')
      ? cleanExplicit
      : `#${cleanExplicit}`;
  } else {
    cleanExplicit = '';
  }

  // Map legacy tags to dynamic categories if needed
  const legacyMap: Record<string, string> = {
    '#workconfessions': '#Work',
    '#campustea': '#Campus',
    '#crushalert': '#SexAndDating',
  };
  if (cleanExplicit && legacyMap[cleanExplicit.toLowerCase()]) {
    cleanExplicit = legacyMap[cleanExplicit.toLowerCase()];
  }

  let primaryTag = '#Confessions';
  if (inlineHashtags.length > 0) {
    primaryTag = inlineHashtags[0];
  } else if (matchedCategories.length > 0) {
    primaryTag = matchedCategories[0];
  } else if (cleanExplicit) {
    primaryTag = cleanExplicit;
  }

  const allCategories = Array.from(
    new Set([primaryTag, ...inlineHashtags, ...matchedCategories])
  );

  return {
    primaryTag,
    matchedCategories: allCategories,
    keywords: Array.from(detectedKeywords),
  };
}

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

export const REACTION_TYPES = ['fire', 'skull', 'eyes', 'heart'] as const;
export type ReactionType = (typeof REACTION_TYPES)[number];

export const REACTION_META: Record<
  ReactionType,
  { emoji: string; label: string }
> = {
  fire: { emoji: '🔥', label: 'Fire' },
  skull: { emoji: '💀', label: 'Dead' },
  eyes: { emoji: '👀', label: 'Tea' },
  heart: { emoji: '❤️', label: 'Real' },
};

export interface ReactionCounts {
  fire: number;
  skull: number;
  eyes: number;
  heart: number;
}

export interface UserIdentityDTO {
  deviceId: string;
  handle: string;
  handleHistory?: string[];
  inboxLink: string;
  createdAt: string;
}

export interface PostCommentDTO {
  _id: string;
  authorHandle: string;
  text: string;
  isOp?: boolean;
  createdAt: string;
}

export interface TrendingTagItem {
  tag: string;
  count: number;
  reactionsCount: number;
  score: number;
}

export interface TrendingPhraseItem {
  phrase: string;
  category?: string;
  count: number;
  score: number;
}

export interface PostPollOptionDTO {
  id: 'A' | 'B';
  text: string;
  votes: number;
}

export interface PostPollDTO {
  optionA: PostPollOptionDTO;
  optionB: PostPollOptionDTO;
  totalVotes: number;
  myVote?: 'A' | 'B' | null;
}

export interface StreetCredDTO {
  score: number;
  tier: string;
  emoji: string;
  nextTierScore: number;
}

export function calculateStreetCred(params: {
  postsCount?: number;
  reactionsReceived?: number;
  commentsReceived?: number;
  inboxReceived?: number;
}): StreetCredDTO {
  const score =
    25 +
    (params.postsCount || 0) * 15 +
    (params.reactionsReceived || 0) * 10 +
    (params.commentsReceived || 0) * 8 +
    (params.inboxReceived || 0) * 12;

  if (score >= 300) {
    return {
      score,
      tier: 'Emous Legend',
      emoji: '👑',
      nextTierScore: 500,
    };
  }
  if (score >= 120) {
    return {
      score,
      tier: 'Neon Phantom',
      emoji: '⚡',
      nextTierScore: 300,
    };
  }
  if (score >= 50) {
    return {
      score,
      tier: 'Street Confessor',
      emoji: '🔥',
      nextTierScore: 120,
    };
  }
  return {
    score,
    tier: 'Shadow Rookie',
    emoji: '🎭',
    nextTierScore: 50,
  };
}

export interface PostDTO {
  _id: string;
  authorHandle: string;
  content: string;
  tag: string;
  categories?: string[];
  keywords?: string[];
  background: CardBackground;
  location?: {
    type: 'Point';
    coordinates: [number, number]; // [longitude, latitude]
    label?: string;
  };
  distanceMiles?: number;
  reactions: ReactionCounts;
  myReactions: ReactionType[];
  comments?: PostCommentDTO[];
  commentsCount?: number;
  poll?: PostPollDTO;
  qaCard?: {
    question: string;
    reply: string;
  };
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
  burnAfterReading?: boolean;
  senderHint?: string;
  flagsCount: number;
  isHidden: boolean;
  createdAt: string;
  expiresAt: string;
}

export const LOYALTY_TARGET_DEVICES = 30;
export const LOYALTY_REWARD_NAIRA = 2000;
export const LOYALTY_WINDOW_HOURS = 3;
export const LOYALTY_WINDOW_MS = LOYALTY_WINDOW_HOURS * 60 * 60 * 1000; // 3-hour reset interval

/**
 * Validates that an anonymous message is BOTH unique and contains at least one complete meaningful sentence
 * (minimum 4 words with >= 2 alphabetic letters each, >= 3 distinct words, and >= 18 characters).
 */
export function evaluateCompleteUniqueSentence(
  rawText: string,
  existingHashes: string[] = []
): { qualified: boolean; normalized: string; reason?: string } {
  const cleaned = (rawText || '')
    .trim()
    .replace(/\s+/g, ' ');
  const normalized = cleaned
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, '')
    .replace(/\s+/g, ' ')
    .trim();

  if (cleaned.length < 18) {
    return {
      qualified: false,
      normalized,
      reason: 'Message too short to count as a complete sentence (min 18 characters).',
    };
  }

  const words = normalized
    .split(' ')
    .filter((w) => /[a-z]{2,}/.test(w));

  if (words.length < 4) {
    return {
      qualified: false,
      normalized,
      reason: 'Message must contain a complete sentence (at least 4 words).',
    };
  }

  const distinctWords = new Set(words);
  if (distinctWords.size < 3) {
    return {
      qualified: false,
      normalized,
      reason: 'Message must contain varied words rather than repeated word spam.',
    };
  }

  if (existingHashes.includes(normalized)) {
    return {
      qualified: false,
      normalized,
      reason: 'Duplicate message already counted in this session.',
    };
  }

  return { qualified: true, normalized };
}

export const NIGERIAN_BANKS = [
  'OPay',
  'PalmPay',
  'Kuda Bank',
  'Moniepoint MFB',
  'GTBank',
  'Access Bank',
  'Zenith Bank',
  'First Bank',
  'UBA',
  'Fidelity Bank',
  'Wema Bank',
  'Sterling Bank',
  'Union Bank',
  'Stanbic IBTC',
  'FCMB',
  'Other Bank',
] as const;

export const WHATSAPP_GAME_SCRIPTS = [
  {
    id: 'midnight-confession',
    title: 'Midnight Confession Night',
    buildText: (handle: string, shareUrl: string) =>
      `🔥 TONIGHT'S GROUP GAME ON EMOUS! 🔥\nDrop one anonymous confession, crush, or honest truth about this group — nobody knows who sent it!\n\n👇 Drop yours in @${handle}'s box:\n${shareUrl}`,
  },
  {
    id: 'unpopular-roast',
    title: 'Group Truth or Roast',
    buildText: (handle: string, shareUrl: string) =>
      `👀 ZERO-FILTER ANONYMOUS ROAST SESSION!\nSay what you’ve been holding back in this group chat. 100% anonymous, auto-burns in 30 days 🔥\n\n👉 Send secretly to @${handle}:\n${shareUrl}`,
  },
  {
    id: 'campus-tea',
    title: 'Campus & Hostel Tea',
    buildText: (handle: string, shareUrl: string) =>
      `🎓 CAMPUS / SQUAD SECRETS ROOM IS LIVE!\nGist, crushes, or unpopular opinions — zero login needed.\n\n👇 Drop your tea here:\n${shareUrl}`,
  },
] as const;

export interface HostSessionDTO {
  _id: string;
  sessionCode: string;
  hostHandle: string;
  groupName?: string;
  uniqueDeviceCount: number;
  targetDevices: number;
  rewardNaira: number;
  windowHours?: number;
  didAutoReset?: boolean;
  adminWhatsapp?: string;
  status: 'active' | 'qualified' | 'claimed' | 'paid' | 'rejected';
  shareUrl: string;
  claimStatus?: 'none' | 'pending' | 'paid' | 'rejected';
  claimReference?: string;
  windowStartedAt?: string;
  createdAt: string;
  expiresAt: string;
}

export interface RewardClaimDTO {
  _id: string;
  sessionCode: string;
  hostDeviceId: string;
  hostHandle: string;
  groupName: string;
  bankName: string;
  accountNumber: string;
  accountName: string;
  whatsappNumber: string;
  uniqueDeviceCount: number;
  uniqueIpCount: number;
  sessionMinutes: number;
  cities: string[];
  fraudRisk: 'low' | 'medium' | 'high';
  rewardNaira: number;
  status: 'pending' | 'paid' | 'rejected';
  paymentReference?: string;
  adminNote?: string;
  paidAt?: string;
  createdAt: string;
}

export interface AnalyticsSummaryDTO {
  overview: {
    todayUniqueDevices: number;
    last7dUniqueDevices: number;
    allTimeUniqueDevices: number;
    todayEvents: number;
    allTimeEvents: number;
    peakHour: number;
    peakHourLabel: string;
    totalPosts: number;
    totalInboxNotes: number;
    qualifiedHostsCount: number;
    pendingClaimsCount: number;
  };
  dailyTrend: {
    dateKey: string;
    uniqueDevices: number;
    events: number;
    inboxSends: number;
    postCreates: number;
  }[];
  hourlyHeatmap: {
    hour: number;
    label: string;
    events: number;
    uniqueDevices: number;
  }[];
  topLocations: {
    location: string;
    country: string;
    city: string;
    uniqueDevices: number;
    events: number;
  }[];
  sourceBreakdown: {
    source: string;
    events: number;
    uniqueDevices: number;
  }[];
}
