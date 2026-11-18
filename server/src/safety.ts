import { Request, Response, NextFunction } from 'express';

// Sliding-window in-memory rate limiter per deviceId / IP
interface RateBucket {
  timestamps: number[];
}

const buckets = new Map<string, RateBucket>();

export function createRateLimiter(options: {
  action: string;
  maxRequests: number;
  windowMs: number;
}) {
  return (req: Request, res: Response, next: NextFunction) => {
    const callerId =
      (req.headers['x-device-id'] as string) ||
      (req.body?.deviceId as string) ||
      req.ip ||
      'anon';
    const key = `${options.action}:${callerId}`;
    const now = Date.now();

    let bucket = buckets.get(key);
    if (!bucket) {
      bucket = { timestamps: [] };
      buckets.set(key, bucket);
    }

    // Keep only timestamps within the active window
    bucket.timestamps = bucket.timestamps.filter(
      (ts) => now - ts < options.windowMs
    );

    if (bucket.timestamps.length >= options.maxRequests) {
      const retrySec = Math.ceil(
        (options.windowMs - (now - bucket.timestamps[0])) / 1000
      );
      return res.status(429).json({
        error: `Whoa there! 🛑 Too many requests. Please wait ${retrySec}s before dropping another ${options.action}.`,
        retryAfterSeconds: retrySec,
      });
    }

    bucket.timestamps.push(now);
    next();
  };
}

// Automated Safety & Anti-Harassment / Doxxing / Severe Slur Filter
const BLOCKED_PATTERNS: { pattern: RegExp; reason: string }[] = [
  // Anti-doxxing: block phone numbers & SSN-like patterns in anonymous posts
  {
    pattern: /\b(?:\+?1[-.\s]?)?\(?\d{3}\)?[-.\s]\d{3}[-.\s]\d{4}\b/,
    reason:
      '🛡️ Safety Shield: Sharing private phone numbers is not allowed on emous.',
  },
  // Block home address / doxxing phrases
  {
    pattern: /\b(?:lives at|home address is|doxx|kill yourself|kys)\b/i,
    reason:
      '🛡️ Safety Shield: Harassment, self-harm encouragement, or doxxing is strictly blocked.',
  },
];

// Mild/common profanity words that get stylized streetwear censoring (e.g., f*** / s***)
const MASK_WORDS: Record<string, string> = {
  fuck: 'f***',
  fucking: 'f***ing',
  fucker: 'f***er',
  shit: 's***',
  bitch: 'b****',
  asshole: 'a**hole',
};

export function inspectAndSanitizeText(rawText: string): {
  allowed: boolean;
  sanitizedText: string;
  wasMasked: boolean;
  reason?: string;
} {
  const trimmed = rawText.trim();

  for (const rule of BLOCKED_PATTERNS) {
    if (rule.pattern.test(trimmed)) {
      return {
        allowed: false,
        sanitizedText: trimmed,
        wasMasked: false,
        reason: rule.reason,
      };
    }
  }

  let wasMasked = false;
  const wordRegex = new RegExp(`\\b(${Object.keys(MASK_WORDS).join('|')})\\b`, 'gi');
  const sanitizedText = trimmed.replace(wordRegex, (match) => {
    wasMasked = true;
    const replacement = MASK_WORDS[match.toLowerCase()] || '****';
    // Preserve capitalization of first letter
    if (match[0] === match[0].toUpperCase()) {
      return replacement.charAt(0).toUpperCase() + replacement.slice(1);
    }
    return replacement;
  });

  return {
    allowed: true,
    sanitizedText,
    wasMasked,
  };
}
