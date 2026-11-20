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
  classifyPostTopics,
  CURATED_GRADIENTS,
  POPULAR_TAGS,
  REACTION_TYPES,
  ReactionCounts,
  ReactionType,
  TOPIC_DICTIONARIES,
  TrendingPhraseItem,
  TrendingTagItem,
} from '../../../shared';

export const postsRouter = Router();

const postRateLimiter = createRateLimiter({
  action: 'confession card',
  maxRequests: 8,
  windowMs: 60 * 1000,
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
        // Enforce single reaction per user in response payload
        myReactions.push(type);
        break;
      }
    }
  }
  return { reactions: counts, myReactions };
}

function computeTrendingFromPosts(
  posts: any[],
  period: string
): {
  trendingTags: TrendingTagItem[];
  trendingPhrases: TrendingPhraseItem[];
  dynamicTags: string[];
} {
  const now = Date.now();
  let cutoffMs = 0;
  if (period === '24h') cutoffMs = now - 24 * 60 * 60 * 1000;
  else if (period === '7d') cutoffMs = now - 7 * 24 * 60 * 60 * 1000;

  let filtered = posts.filter((p) => !p.isHidden);
  if (cutoffMs > 0) {
    const windowPosts = filtered.filter(
      (p) => new Date(p.createdAt).getTime() >= cutoffMs
    );
    // Fallback to all posts if window has fewer than 2 posts in demo
    if (windowPosts.length >= 2) {
      filtered = windowPosts;
    }
  }

  const tagMap = new Map<
    string,
    { tag: string; count: number; reactionsCount: number }
  >();
  const phraseMap = new Map<
    string,
    { phrase: string; category?: string; count: number; reactionsCount: number }
  >();

  // Map keywords back to their parent category badge if applicable
  const keywordToCategory: Record<string, string> = {};
  for (const [cat, words] of Object.entries(TOPIC_DICTIONARIES)) {
    for (const w of words) {
      keywordToCategory[w.toLowerCase()] = cat;
    }
  }

  for (const post of filtered) {
    const analyzed = classifyPostTopics(post.content || '', post.tag);
    const categories =
      Array.isArray(post.categories) && post.categories.length > 0
        ? post.categories
        : analyzed.matchedCategories;
    const keywords =
      Array.isArray(post.keywords) && post.keywords.length > 0
        ? post.keywords
        : analyzed.keywords;

    const rxTotal =
      (post.reactions?.fire || 0) +
      (post.reactions?.skull || 0) +
      (post.reactions?.eyes || 0) +
      (post.reactions?.heart || 0);

    for (const rawCat of categories) {
      const key = rawCat.toLowerCase();
      const existing = tagMap.get(key) || {
        tag: rawCat,
        count: 0,
        reactionsCount: 0,
      };
      existing.count += 1;
      existing.reactionsCount += rxTotal;
      tagMap.set(key, existing);
    }

    for (const kw of keywords) {
      const cleanKw = kw.toLowerCase().trim();
      if (cleanKw.length < 2) continue;
      // Only include curated topic keywords or explicit #hashtags (no random words)
      const isCuratedKeyword = Boolean(keywordToCategory[cleanKw]);
      const isExplicitHashtag = cleanKw.startsWith('#');
      if (!isCuratedKeyword && !isExplicitHashtag) continue;

      const displayPhrase = isExplicitHashtag
        ? kw.trim()
        : cleanKw.charAt(0).toUpperCase() + cleanKw.slice(1);
      const existing = phraseMap.get(cleanKw) || {
        phrase: displayPhrase,
        category: keywordToCategory[cleanKw] || analyzed.primaryTag,
        count: 0,
        reactionsCount: 0,
      };
      existing.count += 1;
      existing.reactionsCount += rxTotal;
      phraseMap.set(cleanKw, existing);
    }
  }

  const trendingTags: TrendingTagItem[] = Array.from(tagMap.values())
    .map((item) => ({
      tag: item.tag,
      count: item.count,
      reactionsCount: item.reactionsCount,
      score: item.count * 10 + item.reactionsCount,
    }))
    .sort((a, b) => b.score - a.score);

  const trendingPhrases: TrendingPhraseItem[] = Array.from(phraseMap.values())
    .map((item) => ({
      phrase: item.phrase,
      category: item.category,
      count: item.count,
      score: item.count * 10 + item.reactionsCount,
    }))
    .sort((a, b) => b.score - a.score)
    .slice(0, 24);

  // Merge active dynamic tags with baseline topic tags so the scrolling bar is always rich
  const dynamicTagSet = new Set<string>();
  for (const t of trendingTags) {
    dynamicTagSet.add(t.tag);
  }
  for (const base of POPULAR_TAGS) {
    dynamicTagSet.add(base);
  }

  return {
    trendingTags,
    trendingPhrases,
    dynamicTags: Array.from(dynamicTagSet),
  };
}

/**
 * GET /api/v1/posts/trending
 * Dedicated Trending Radar endpoint returning top dynamic hashtags and frequently used phrases ("work", "office", "crypto", "sex", "gym", "politics", "religion", etc.)
 */
postsRouter.get('/trending', async (req: Request, res: Response) => {
  try {
    const period = (req.query.period as string) || 'all';
    if (isUsingMongo()) {
      const allPosts = await PostModel.find({ isHidden: false })
        .sort({ createdAt: -1 })
        .limit(250)
        .lean();
      const stats = computeTrendingFromPosts(allPosts, period);
      return res.json({ period, ...stats });
    }

    reloadLocalStoreFromDiskIfNeeded();
    const stats = computeTrendingFromPosts(localStore.posts, period);
    return res.json({ period, ...stats });
  } catch (err) {
    console.error('Error in GET /posts/trending:', err);
    return res.status(500).json({ error: 'Failed to compute trending topics.' });
  }
});

/**
 * GET /api/v1/posts
 * Supports:
 * - mode=global | near
 * - ?tag=#Work (matches primaryTag OR any NLP-inferred category in post.categories!)
 * - ?phrase=office (matches post.keywords or post.content text search!)
 */
postsRouter.get('/', async (req: Request, res: Response) => {
  try {
    const mode = (req.query.mode as string) || 'global';
    const tagFilter = (req.query.tag as string)?.trim();
    const phraseFilter = (req.query.phrase as string)?.trim().toLowerCase();
    const callerDeviceId = (req.headers['x-device-id'] as string) || '';
    const limit = Math.min(Number(req.query.limit) || 40, 100);

    const normalizedTagFilter =
      tagFilter && tagFilter.toLowerCase() !== 'all'
        ? (tagFilter.startsWith('#') ? tagFilter : `#${tagFilter}`).toLowerCase()
        : null;

    const lat = parseFloat(req.query.lat as string);
    const lng = parseFloat(req.query.lng as string);
    const radiusMiles =
      parseFloat(req.query.radiusMiles as string) || BRAND.defaultRadiusMiles;
    const hasCoords = !Number.isNaN(lat) && !Number.isNaN(lng);

    if (isUsingMongo()) {
      const filter: Record<string, any> = { isHidden: false };

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

      const query = PostModel.find(filter).limit(120);
      if (!filter.location) {
        query.sort({ createdAt: -1 });
      }
      const rawPosts = await query.lean();
      const trendingSummary = computeTrendingFromPosts(rawPosts, 'all');

      const filteredPosts = rawPosts.filter((post) => {
        const analyzed = classifyPostTopics(post.content || '', post.tag);
        const cats = (
          Array.isArray(post.categories) && post.categories.length > 0
            ? post.categories
            : analyzed.matchedCategories
        ).map((c) => c.toLowerCase());

        if (normalizedTagFilter) {
          if (
            post.tagLower !== normalizedTagFilter &&
            !cats.includes(normalizedTagFilter)
          ) {
            return false;
          }
        }

        if (phraseFilter) {
          const kws = (
            Array.isArray(post.keywords) && post.keywords.length > 0
              ? post.keywords
              : analyzed.keywords
          ).map((k) => k.toLowerCase());
          const inText = (post.content || '')
            .toLowerCase()
            .includes(phraseFilter);
          if (!inText && !kws.includes(phraseFilter)) {
            return false;
          }
        }
        return true;
      });

      const formatted = filteredPosts.slice(0, limit).map((post) => {
        let distanceMiles: number | undefined;
        if (hasCoords && post.location?.coordinates?.length === 2) {
          const [postLng, postLat] = post.location.coordinates;
          distanceMiles = Number(
            haversineMiles(lat, lng, postLat, postLng).toFixed(1)
          );
        }
        const analyzed = classifyPostTopics(post.content || '', post.tag);
        const { reactions, myReactions } = getReactionsPayload(
          post,
          callerDeviceId
        );
        const comments = Array.isArray(post.comments) ? post.comments : [];
        return {
          _id: String(post._id),
          authorHandle: post.authorHandle,
          content: post.content,
          tag: analyzed.primaryTag,
          categories:
            Array.isArray(post.categories) && post.categories.length > 0
              ? post.categories
              : analyzed.matchedCategories,
          keywords:
            Array.isArray(post.keywords) && post.keywords.length > 0
              ? post.keywords
              : analyzed.keywords,
          background: post.background,
          location: post.location,
          distanceMiles,
          reactions,
          myReactions,
          comments,
          commentsCount: comments.length,
          flagsCount: post.flagsCount,
          isFlaggedByMe: callerDeviceId
            ? post.flaggedBy?.includes(callerDeviceId)
            : false,
          isHidden: post.isHidden,
          createdAt: post.createdAt,
        };
      });

      return res.json({
        mode,
        posts: formatted,
        popularTags: trendingSummary.dynamicTags,
        trendingTags: trendingSummary.trendingTags,
        trendingPhrases: trendingSummary.trendingPhrases,
      });
    }

    // Local Store Engine
    reloadLocalStoreFromDiskIfNeeded();
    const activeLocalPosts = localStore.posts.filter((p) => !p.isHidden);
    const trendingSummary = computeTrendingFromPosts(activeLocalPosts, 'all');

    let list = activeLocalPosts.filter((post) => {
      const analyzed = classifyPostTopics(post.content || '', post.tag);
      const cats = (
        Array.isArray(post.categories) && post.categories.length > 0
          ? post.categories
          : analyzed.matchedCategories
      ).map((c) => c.toLowerCase());

      if (normalizedTagFilter) {
        if (
          post.tagLower !== normalizedTagFilter &&
          !cats.includes(normalizedTagFilter)
        ) {
          return false;
        }
      }

      if (phraseFilter) {
        const kws = (
          Array.isArray(post.keywords) && post.keywords.length > 0
            ? post.keywords
            : analyzed.keywords
        ).map((k) => k.toLowerCase());
        const inText = (post.content || '')
          .toLowerCase()
          .includes(phraseFilter);
        if (!inText && !kws.includes(phraseFilter)) {
          return false;
        }
      }
      return true;
    });

    let formatted = list.map((post) => {
      let distanceMiles: number | undefined;
      if (hasCoords && post.location?.coordinates?.length === 2) {
        const [postLng, postLat] = post.location.coordinates;
        distanceMiles = Number(
          haversineMiles(lat, lng, postLat, postLng).toFixed(1)
        );
      }
      const analyzed = classifyPostTopics(post.content || '', post.tag);
      const { reactions, myReactions } = getReactionsPayload(
        post,
        callerDeviceId
      );
      const comments = Array.isArray(post.comments) ? post.comments : [];
      return {
        _id: post._id,
        authorHandle: post.authorHandle,
        content: post.content,
        tag: analyzed.primaryTag,
        categories:
          Array.isArray(post.categories) && post.categories.length > 0
            ? post.categories
            : analyzed.matchedCategories,
        keywords:
          Array.isArray(post.keywords) && post.keywords.length > 0
            ? post.keywords
            : analyzed.keywords,
        background: post.background,
        location: post.location,
        distanceMiles,
        reactions,
        myReactions,
        comments,
        commentsCount: comments.length,
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
      popularTags: trendingSummary.dynamicTags,
      trendingTags: trendingSummary.trendingTags,
      trendingPhrases: trendingSummary.trendingPhrases,
    });
  } catch (err) {
    console.error('Error in GET /posts:', err);
    return res.status(500).json({ error: 'Failed to fetch feed posts.' });
  }
});

/**
 * POST /api/v1/posts
 * Automatically classifies post into dynamic #Tag and extracts keywords/phrases!
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

    // Dynamic NLP Topic & Hashtag Classification
    const analyzed = classifyPostTopics(safeContent, req.body?.tag);
    const tag = analyzed.primaryTag;

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
        categories: analyzed.matchedCategories,
        keywords: analyzed.keywords,
        background,
        location: locationField,
        reactions: { fire: 0, skull: 0, eyes: 0, heart: 0 },
        reactedBy: { fire: [], skull: [], eyes: [], heart: [] },
        comments: [],
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
          categories: created.categories,
          keywords: created.keywords,
          background: created.background,
          location: created.location,
          reactions: { fire: 0, skull: 0, eyes: 0, heart: 0 },
          myReactions: [],
          comments: [],
          commentsCount: 0,
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
      categories: analyzed.matchedCategories,
      keywords: analyzed.keywords,
      background,
      location: locationField,
      reactions: { fire: 0, skull: 0, eyes: 0, heart: 0 },
      reactedBy: {
        fire: [] as string[],
        skull: [] as string[],
        eyes: [] as string[],
        heart: [] as string[],
      },
      comments: [],
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
        categories: localPost.categories,
        keywords: localPost.keywords,
        background: localPost.background,
        location: localPost.location,
        reactions: localPost.reactions,
        myReactions: [],
        comments: [],
        commentsCount: 0,
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
 * EXCLUSIVE SINGLE REACTION PER USER PER POST:
 * A user can only have ONE active reaction per post. Clicking a different reaction
 * automatically removes their previous reaction on that post before adding the new one.
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

      const alreadyHadThisType = (post.reactedBy[type] || []).includes(callerId);
      let action: 'added' | 'removed' | 'switched' = 'added';

      // Step 1: Remove callerId from ALL reaction buckets on this post first (enforces max 1 reaction per post!)
      let removedPreviousOther = false;
      for (const rType of REACTION_TYPES) {
        const bucket = post.reactedBy[rType] || [];
        const idx = bucket.indexOf(callerId);
        if (idx >= 0) {
          bucket.splice(idx, 1);
          post.reactedBy[rType] = bucket;
          post.reactions[rType] = Math.max(0, (post.reactions[rType] || 1) - 1);
          if (rType !== type) {
            removedPreviousOther = true;
          }
        }
      }

      // Step 2: If they clicked a new reaction (not toggling off the same one), add it
      if (alreadyHadThisType) {
        action = 'removed';
      } else {
        post.reactedBy[type].push(callerId);
        post.reactions[type] = (post.reactions[type] || 0) + 1;
        action = removedPreviousOther ? 'switched' : 'added';
      }

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

    const alreadyHadThisType = (post.reactedBy[type] || []).includes(callerId);
    let action: 'added' | 'removed' | 'switched' = 'added';
    let removedPreviousOther = false;

    // Remove callerId from all reaction types on this post first
    for (const rType of REACTION_TYPES) {
      const bucket = post.reactedBy[rType] || [];
      const idx = bucket.indexOf(callerId);
      if (idx >= 0) {
        bucket.splice(idx, 1);
        post.reactedBy[rType] = bucket;
        post.reactions[rType] = Math.max(0, (post.reactions[rType] || 1) - 1);
        if (rType !== type) {
          removedPreviousOther = true;
        }
      }
    }

    if (alreadyHadThisType) {
      action = 'removed';
    } else {
      post.reactedBy[type].push(callerId);
      post.reactions[type] = (post.reactions[type] || 0) + 1;
      action = removedPreviousOther ? 'switched' : 'added';
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
 * POST /api/v1/posts/:id/comments
 * Wow Feature #2: Anonymous Whisper Threads (Micro-Comments under any visual confession card)
 */
postsRouter.post('/:id/comments', async (req: Request, res: Response) => {
  try {
    const postId = req.params.id;
    const rawText = (req.body?.text as string) || '';
    const text = rawText.trim();
    const callerId =
      (req.body?.deviceId as string) ||
      (req.headers['x-device-id'] as string) ||
      'anon-commenter';
    const authorHandle =
      (req.body?.authorHandle as string)?.trim() || 'AnonymousRebel';

    if (!text) {
      return res.status(400).json({ error: 'Whisper reply cannot be empty.' });
    }
    if (text.length > 180) {
      return res
        .status(400)
        .json({ error: 'Whisper reply must be 180 characters or less.' });
    }

    const safety = inspectAndSanitizeText(text);
    if (!safety.allowed) {
      return res.status(400).json({ error: safety.reason });
    }

    if (isUsingMongo()) {
      const post = await PostModel.findById(postId);
      if (!post) {
        return res.status(404).json({ error: 'Post not found.' });
      }
      const newComment = {
        _id: createId(),
        authorHandle,
        authorDeviceId: callerId,
        text: safety.sanitizedText,
        isOp:
          post.authorDeviceId === callerId ||
          post.authorHandle.toLowerCase() === authorHandle.toLowerCase(),
        createdAt: new Date(),
      };
      if (!Array.isArray(post.comments)) {
        post.comments = [];
      }
      post.comments.push(newComment);
      post.markModified('comments');
      await post.save();

      return res.status(201).json({
        _id: String(post._id),
        comment: newComment,
        comments: post.comments,
        commentsCount: post.comments.length,
      });
    }

    reloadLocalStoreFromDiskIfNeeded();
    const post = localStore.posts.find((p) => p._id === postId);
    if (!post) {
      return res.status(404).json({ error: 'Post not found.' });
    }
    const newComment = {
      _id: createId(),
      authorHandle,
      authorDeviceId: callerId,
      text: safety.sanitizedText,
      isOp:
        post.authorDeviceId === callerId ||
        post.authorHandle.toLowerCase() === authorHandle.toLowerCase(),
      createdAt: new Date().toISOString(),
    };
    if (!Array.isArray(post.comments)) {
      post.comments = [];
    }
    post.comments.push(newComment);
    post.updatedAt = new Date().toISOString();
    saveLocalStore();

    return res.status(201).json({
      _id: post._id,
      comment: newComment,
      comments: post.comments,
      commentsCount: post.comments.length,
    });
  } catch (err) {
    console.error('Error in POST /posts/:id/comments:', err);
    return res.status(500).json({ error: 'Failed to post comment.' });
  }
});

/**
 * POST /api/v1/posts/:id/flag
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
