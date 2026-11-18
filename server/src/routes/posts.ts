import { Router, Request, Response } from 'express';
import { PostModel } from '../models/Post';
import { UserModel } from '../models/User';
import {
  createId,
  isUsingMongo,
  localStore,
  reloadLocalStoreFromDiskIfNeeded,
  saveLocalStore,
} from '../db';
import { createRateLimiter, inspectAndSanitizeText } from '../safety';
import {
  ALL_BACKGROUNDS,
  BRAND,
  CURATED_GRADIENTS,
  POPULAR_TAGS,
  REACTION_TYPES,
  ReactionCounts,
  ReactionType,
} from '../../../shared';

export const postsRouter = Router();

const postRateLimiter = createRateLimiter({
  action: 'confession card',
  maxRequests: 8,
  windowMs: 60 * 1000, // Max 8 posts per minute per deviceId
});

export function haversineMiles(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number
): number {
  const toRad = (deg: number) => (deg * Math.PI) / 180;
  const R = 3958.8; // Earth radius in miles
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2;
  return 2 * R * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

function normalizeTag(rawTag?: string): string {
  if (!rawTag || !rawTag.trim()) return '#Confessions';
  const cleaned = rawTag.trim().replace(/\s+/g, '');
  return cleaned.startsWith('#') ? cleaned : `#${cleaned}`;
}

function getReactionsPayload(
  doc: any,
  callerDeviceId: string
): { reactions: ReactionCounts; myReactions: ReactionType[] } {
  const counts: ReactionCounts = {
    fire: doc.reactions?.fire ?? 0,
    skull: doc.reactions?.skull ?? 0,
    eyes: doc.reactions?.eyes ?? 0,
    heart: doc.reactions?.heart ?? 0,
  };
  const myReactions: ReactionType[] = [];
  if (callerDeviceId && doc.reactedBy) {
    for (const type of REACTION_TYPES) {
      if (
        Array.isArray(doc.reactedBy[type]) &&
        doc.reactedBy[type].includes(callerDeviceId)
      ) {
        myReactions.push(type);
      }
    }
  }
  return { reactions: counts, myReactions };
}

/**
 * GET /api/v1/posts
 */
postsRouter.get('/', async (req: Request, res: Response) => {
  try {
    const mode = (req.query.mode as string) || 'global';
    const tagFilter = (req.query.tag as string)?.trim();
    const callerDeviceId = (req.headers['x-device-id'] as string) || '';
    const limit = Math.min(Number(req.query.limit) || 40, 100);

    const normalizedTagFilter =
      tagFilter && tagFilter.toLowerCase() !== 'all'
        ? normalizeTag(tagFilter).toLowerCase()
        : null;

    const lat = parseFloat(req.query.lat as string);
    const lng = parseFloat(req.query.lng as string);
    const radiusMiles =
      parseFloat(req.query.radiusMiles as string) || BRAND.defaultRadiusMiles;
    const hasCoords = !Number.isNaN(lat) && !Number.isNaN(lng);

    if (isUsingMongo()) {
      const filter: Record<string, any> = { isHidden: false };
      if (normalizedTagFilter) {
        filter.tagLower = normalizedTagFilter;
      }

      if (mode === 'near' && hasCoords) {
        filter.location = {
          $near: {
            $geometry: {
              type: 'Point',
              coordinates: [lng, lat],
            },
            $maxDistance: BRAND.milesToMeters(radiusMiles),
          },
        };
      }

      const query = PostModel.find(filter).limit(limit);
      if (!filter.location) {
        query.sort({ createdAt: -1 });
      }
      const posts = await query.lean();

      const formatted = posts.map((post) => {
        let distanceMiles: number | undefined;
        if (hasCoords && post.location?.coordinates?.length === 2) {
          const [postLng, postLat] = post.location.coordinates;
          distanceMiles = Number(
            haversineMiles(lat, lng, postLat, postLng).toFixed(1)
          );
        }
        const { reactions, myReactions } = getReactionsPayload(
          post,
          callerDeviceId
        );
        return {
          _id: String(post._id),
          authorHandle: post.authorHandle,
          content: post.content,
          tag: post.tag,
          background: post.background,
          location: post.location,
          distanceMiles,
          reactions,
          myReactions,
          flagsCount: post.flagsCount,
          isFlaggedByMe: callerDeviceId
            ? post.flaggedBy?.includes(callerDeviceId)
            : false,
          isHidden: post.isHidden,
          createdAt: post.createdAt,
        };
      });

      return res.json({ mode, posts: formatted, popularTags: POPULAR_TAGS });
    }

    // Local Store Engine
    reloadLocalStoreFromDiskIfNeeded();
    let list = localStore.posts.filter((p) => !p.isHidden);
    if (normalizedTagFilter) {
      list = list.filter((p) => p.tagLower === normalizedTagFilter);
    }

    let formatted = list.map((post) => {
      let distanceMiles: number | undefined;
      if (hasCoords && post.location?.coordinates?.length === 2) {
        const [postLng, postLat] = post.location.coordinates;
        distanceMiles = Number(
          haversineMiles(lat, lng, postLat, postLng).toFixed(1)
        );
      }
      const { reactions, myReactions } = getReactionsPayload(
        post,
        callerDeviceId
      );
      return {
        _id: post._id,
        authorHandle: post.authorHandle,
        content: post.content,
        tag: post.tag,
        background: post.background,
        location: post.location,
        distanceMiles,
        reactions,
        myReactions,
        flagsCount: post.flagsCount,
        isFlaggedByMe: callerDeviceId
          ? post.flaggedBy.includes(callerDeviceId)
          : false,
        isHidden: post.isHidden,
        createdAt: post.createdAt,
      };
    });

    if (mode === 'near' && hasCoords) {
      formatted = formatted
        .filter(
          (p) =>
            typeof p.distanceMiles === 'number' &&
            p.distanceMiles <= radiusMiles
        )
        .sort((a, b) => (a.distanceMiles ?? 999) - (b.distanceMiles ?? 999));
    } else {
      formatted.sort(
        (a, b) =>
          new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
      );
    }

    return res.json({
      mode,
      posts: formatted.slice(0, limit),
      popularTags: POPULAR_TAGS,
    });
  } catch (err) {
    console.error('Error in GET /posts:', err);
    return res.status(500).json({ error: 'Failed to fetch feed posts.' });
  }
});

/**
 * POST /api/v1/posts
 * Includes Automated Safety / Profanity Filter + Anti-Spam Rate Limiting
 */
postsRouter.post('/', postRateLimiter, async (req: Request, res: Response) => {
  try {
    const deviceId =
      (req.body?.deviceId as string) ||
      (req.headers['x-device-id'] as string) ||
      'anon-device';
    const rawContent = (req.body?.content as string) || '';
    const content = rawContent.trim();

    if (!content) {
      return res.status(400).json({ error: 'Post content cannot be empty.' });
    }
    if (content.length > BRAND.maxPostLength) {
      return res.status(400).json({
        error: `Post content cannot exceed ${BRAND.maxPostLength} characters.`,
      });
    }

    // Run Automated Safety & Profanity Shield
    const safetyCheck = inspectAndSanitizeText(content);
    if (!safetyCheck.allowed) {
      return res.status(400).json({ error: safetyCheck.reason });
    }
    const safeContent = safetyCheck.sanitizedText;

    let authorHandle = (req.body?.authorHandle as string)?.trim();
    if (!authorHandle) {
      if (isUsingMongo()) {
        const existingUser = await UserModel.findOne({ deviceId }).lean();
        authorHandle = existingUser ? existingUser.handle : 'AnonymousRebel';
      } else {
        const existingUser = localStore.users.find(
          (u) => u.deviceId === deviceId
        );
        authorHandle = existingUser ? existingUser.handle : 'AnonymousRebel';
      }
    }

    const tag = normalizeTag(req.body?.tag);
    const backgroundInput = req.body?.background;
    const background =
      backgroundInput && backgroundInput.value
        ? backgroundInput
        : ALL_BACKGROUNDS.find((b) => b.id === req.body?.backgroundId) ||
          CURATED_GRADIENTS[0];

    let locationField:
      | { type: 'Point'; coordinates: [number, number]; label?: string }
      | undefined;

    const lat = parseFloat(req.body?.lat ?? req.body?.location?.lat);
    const lng = parseFloat(req.body?.lng ?? req.body?.location?.lng);

    if (!Number.isNaN(lat) && !Number.isNaN(lng)) {
      locationField = {
        type: 'Point',
        coordinates: [lng, lat],
        label: req.body?.locationLabel || 'Near You',
      };
    } else if (
      Array.isArray(req.body?.location?.coordinates) &&
      req.body.location.coordinates.length === 2
    ) {
      locationField = {
        type: 'Point',
        coordinates: [
          Number(req.body.location.coordinates[0]),
          Number(req.body.location.coordinates[1]),
        ],
        label: req.body.location.label || 'Near You',
      };
    }

    if (isUsingMongo()) {
      const created = await PostModel.create({
        authorDeviceId: deviceId,
        authorHandle,
        content: safeContent,
        tag,
        tagLower: tag.toLowerCase(),
        background,
        location: locationField,
        reactions: { fire: 0, skull: 0, eyes: 0, heart: 0 },
        reactedBy: { fire: [], skull: [], eyes: [], heart: [] },
        flagsCount: 0,
        flaggedBy: [],
        isHidden: false,
      });

      return res.status(201).json({
        wasMasked: safetyCheck.wasMasked,
        post: {
          _id: String(created._id),
          authorHandle: created.authorHandle,
          content: created.content,
          tag: created.tag,
          background: created.background,
          location: created.location,
          reactions: { fire: 0, skull: 0, eyes: 0, heart: 0 },
          myReactions: [],
          flagsCount: created.flagsCount,
          isFlaggedByMe: false,
          isHidden: created.isHidden,
          createdAt: created.createdAt,
        },
      });
    }

    reloadLocalStoreFromDiskIfNeeded();
    const now = new Date().toISOString();
    const localPost = {
      _id: createId(),
      authorDeviceId: deviceId,
      authorHandle,
      content: safeContent,
      tag,
      tagLower: tag.toLowerCase(),
      background,
      location: locationField,
      reactions: { fire: 0, skull: 0, eyes: 0, heart: 0 },
      reactedBy: {
        fire: [] as string[],
        skull: [] as string[],
        eyes: [] as string[],
        heart: [] as string[],
      },
      flagsCount: 0,
      flaggedBy: [] as string[],
      isHidden: false,
      createdAt: now,
      updatedAt: now,
    };
    localStore.posts.unshift(localPost);
    saveLocalStore();

    return res.status(201).json({
      wasMasked: safetyCheck.wasMasked,
      post: {
        _id: localPost._id,
        authorHandle: localPost.authorHandle,
        content: localPost.content,
        tag: localPost.tag,
        background: localPost.background,
        location: localPost.location,
        reactions: localPost.reactions,
        myReactions: [],
        flagsCount: localPost.flagsCount,
        isFlaggedByMe: false,
        isHidden: localPost.isHidden,
        createdAt: localPost.createdAt,
      },
    });
  } catch (err) {
    console.error('Error in POST /posts:', err);
    return res.status(500).json({ error: 'Failed to create post.' });
  }
});

/**
 * POST /api/v1/posts/:id/react
 * Toggles an anonymous emoji reaction (🔥 fire, 💀 skull, 👀 eyes, ❤️ heart) on a visual feed card
 */
postsRouter.post('/:id/react', async (req: Request, res: Response) => {
  try {
    const postId = req.params.id;
    const type = (req.body?.type as ReactionType) || 'fire';
    const callerId =
      (req.body?.deviceId as string) ||
      (req.headers['x-device-id'] as string) ||
      'anon-reactor';

    if (!REACTION_TYPES.includes(type)) {
      return res.status(400).json({ error: 'Invalid reaction type.' });
    }

    if (isUsingMongo()) {
      const post = await PostModel.findById(postId);
      if (!post) {
        return res.status(404).json({ error: 'Post not found.' });
      }
      if (!post.reactions) {
        post.reactions = { fire: 0, skull: 0, eyes: 0, heart: 0 };
      }
      if (!post.reactedBy) {
        post.reactedBy = { fire: [], skull: [], eyes: [], heart: [] };
      }

      const list = post.reactedBy[type] || [];
      const existingIndex = list.indexOf(callerId);
      let action: 'added' | 'removed' = 'added';

      if (existingIndex >= 0) {
        list.splice(existingIndex, 1);
        post.reactions[type] = Math.max(0, (post.reactions[type] || 1) - 1);
        action = 'removed';
      } else {
        list.push(callerId);
        post.reactions[type] = (post.reactions[type] || 0) + 1;
      }

      post.reactedBy[type] = list;
      post.markModified('reactions');
      post.markModified('reactedBy');
      await post.save();

      const { reactions, myReactions } = getReactionsPayload(post, callerId);
      return res.json({
        _id: String(post._id),
        type,
        action,
        reactions,
        myReactions,
      });
    }

    reloadLocalStoreFromDiskIfNeeded();
    const post = localStore.posts.find((p) => p._id === postId);
    if (!post) {
      return res.status(404).json({ error: 'Post not found.' });
    }
    if (!post.reactions) {
      post.reactions = { fire: 0, skull: 0, eyes: 0, heart: 0 };
    }
    if (!post.reactedBy) {
      post.reactedBy = { fire: [], skull: [], eyes: [], heart: [] };
    }

    const list = post.reactedBy[type];
    const idx = list.indexOf(callerId);
    let action: 'added' | 'removed' = 'added';

    if (idx >= 0) {
      list.splice(idx, 1);
      post.reactions[type] = Math.max(0, post.reactions[type] - 1);
      action = 'removed';
    } else {
      list.push(callerId);
      post.reactions[type] = (post.reactions[type] || 0) + 1;
    }

    post.updatedAt = new Date().toISOString();
    saveLocalStore();

    const { reactions, myReactions } = getReactionsPayload(post, callerId);
    return res.json({
      _id: post._id,
      type,
      action,
      reactions,
      myReactions,
    });
  } catch (err) {
    console.error('Error in POST /posts/:id/react:', err);
    return res.status(500).json({ error: 'Failed to react to post.' });
  }
});

/**
 * POST /api/v1/posts/:id/flag
 * Crowdsourced moderation: Any post that receives 3 user flags is automatically hidden from view.
 */
postsRouter.post('/:id/flag', async (req: Request, res: Response) => {
  try {
    const postId = req.params.id;
    const flaggerId =
      (req.body?.deviceId as string) ||
      (req.headers['x-device-id'] as string) ||
      `anon-${Date.now()}-${Math.random()}`;

    if (isUsingMongo()) {
      const post = await PostModel.findById(postId);
      if (!post) {
        return res.status(404).json({ error: 'Post not found.' });
      }
      if (!post.flaggedBy.includes(flaggerId)) {
        post.flaggedBy.push(flaggerId);
        post.flagsCount = post.flaggedBy.length;
      }
      if (post.flagsCount >= BRAND.maxFlagThreshold) {
        post.isHidden = true;
      }
      await post.save();
      return res.json({
        _id: String(post._id),
        flagsCount: post.flagsCount,
        isHidden: post.isHidden,
        message: post.isHidden
          ? 'Post reached 3 flags and has been automatically hidden.'
          : `Post reported (${post.flagsCount}/${BRAND.maxFlagThreshold} flags).`,
      });
    }

    reloadLocalStoreFromDiskIfNeeded();
    const post = localStore.posts.find((p) => p._id === postId);
    if (!post) {
      return res.status(404).json({ error: 'Post not found.' });
    }
    if (!post.flaggedBy.includes(flaggerId)) {
      post.flaggedBy.push(flaggerId);
      post.flagsCount = post.flaggedBy.length;
    }
    if (post.flagsCount >= BRAND.maxFlagThreshold) {
      post.isHidden = true;
    }
    post.updatedAt = new Date().toISOString();
    saveLocalStore();

    return res.json({
      _id: post._id,
      flagsCount: post.flagsCount,
      isHidden: post.isHidden,
      message: post.isHidden
        ? 'Post reached 3 flags and has been automatically hidden.'
        : `Post reported (${post.flagsCount}/${BRAND.maxFlagThreshold} flags).`,
    });
  } catch (err) {
    console.error('Error in POST /posts/:id/flag:', err);
    return res.status(500).json({ error: 'Failed to flag post.' });
  }
});
