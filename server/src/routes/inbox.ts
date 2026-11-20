import { Router, Request, Response } from 'express';
import { InboxMessageModel } from '../models/InboxMessage';
import { UserModel } from '../models/User';
import {
  createId,
  isUsingMongo,
  localStore,
  purgeExpiredInboxMessages,
  reloadLocalStoreFromDiskIfNeeded,
  saveLocalStore,
} from '../db';
import { createRateLimiter, inspectAndSanitizeText } from '../safety';
import { BRAND, STORY_COLOR_PAIRS } from '../../../shared';

export const inboxRouter = Router();

const inboxSendLimiter = createRateLimiter({
  action: 'secret message',
  maxRequests: 10,
  windowMs: 60 * 1000, // Max 10 secret messages per minute per sender
});

function formatInboxMessage(doc: any) {
  const createdMs = new Date(doc.createdAt).getTime();
  const expiresAt = new Date(createdMs + BRAND.inboxBurnSeconds * 1000).toISOString();

  return {
    _id: String(doc._id),
    recipientHandle: doc.recipientHandle,
    question: doc.question,
    reply: doc.reply,
    repliedAt: doc.repliedAt,
    themeId: doc.themeId || 'story-pink-lime',
    isRead: Boolean(doc.isRead),
    burnAfterReading: Boolean(doc.burnAfterReading),
    senderHint: doc.senderHint || 'Sent from Mobile Web • Local Vibe',
    flagsCount: doc.flagsCount || 0,
    isHidden: Boolean(doc.isHidden),
    createdAt: doc.createdAt,
    expiresAt,
  };
}

/**
 * GET /api/v1/inbox
 */
inboxRouter.get('/', async (req: Request, res: Response) => {
  try {
    const deviceId =
      (req.headers['x-device-id'] as string) ||
      (req.query.deviceId as string) ||
      '';
    const handleParam = (req.query.handle as string)?.trim();

    let targetHandleLower = handleParam ? handleParam.toLowerCase() : '';
    let canonicalHandle = handleParam || '';

    if (isUsingMongo()) {
      if (!targetHandleLower && deviceId) {
        const user = await UserModel.findOne({ deviceId }).lean();
        if (user) {
          targetHandleLower = user.handleLower;
          canonicalHandle = user.handle;
        }
      }
      if (!targetHandleLower) {
        return res.status(400).json({
          error: 'Provide x-device-id header or ?handle= parameter to fetch inbox.',
        });
      }

      const messages = await InboxMessageModel.find({
        recipientHandleLower: targetHandleLower,
        isHidden: false,
      })
        .sort({ createdAt: -1 })
        .limit(100)
        .lean();

      const domain = process.env.PUBLIC_DOMAIN || BRAND.domain;
      return res.json({
        handle: canonicalHandle,
        inboxLink: `${domain}/ask/${canonicalHandle}`,
        count: messages.length,
        unreadCount: messages.filter((m) => !m.isRead).length,
        messages: messages.map(formatInboxMessage),
      });
    }

    // Local Store Engine (runs 30-day TTL auto-burn sweep on read)
    reloadLocalStoreFromDiskIfNeeded();
    purgeExpiredInboxMessages();

    if (!targetHandleLower && deviceId) {
      const user = localStore.users.find((u) => u.deviceId === deviceId);
      if (user) {
        targetHandleLower = user.handleLower;
        canonicalHandle = user.handle;
      }
    }
    if (!targetHandleLower) {
      return res.status(400).json({
        error: 'Provide x-device-id header or ?handle= parameter to fetch inbox.',
      });
    }

    const messages = localStore.inbox
      .filter(
        (m) => m.recipientHandleLower === targetHandleLower && !m.isHidden
      )
      .sort(
        (a, b) =>
          new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
      );

    const domain = process.env.PUBLIC_DOMAIN || BRAND.domain;
    return res.json({
      handle: canonicalHandle,
      inboxLink: `${domain}/ask/${canonicalHandle}`,
      count: messages.length,
      unreadCount: messages.filter((m) => !m.isRead).length,
      messages: messages.map(formatInboxMessage),
    });
  } catch (err) {
    console.error('Error in GET /inbox:', err);
    return res.status(500).json({ error: 'Failed to fetch inbox messages.' });
  }
});

/**
 * POST /api/v1/inbox/:handle
 * Includes Automated Safety / Profanity Filter + Anti-Spam Rate Limiting
 */
inboxRouter.post(
  '/:handle',
  inboxSendLimiter,
  async (req: Request, res: Response) => {
    try {
      const rawHandle = (req.params.handle || '').trim();
      const rawQuestion = (req.body?.question as string) || '';
      const trimmedQuestion = rawQuestion.trim();
      const senderDeviceId =
        (req.body?.deviceId as string) ||
        (req.headers['x-device-id'] as string) ||
        undefined;

      if (!rawHandle) {
        return res.status(400).json({ error: 'Recipient handle is required.' });
      }
      if (!trimmedQuestion) {
        return res
          .status(400)
          .json({ error: 'Please type a secret message first!' });
      }
      if (trimmedQuestion.length > BRAND.maxPostLength) {
        return res.status(400).json({
          error: `Secret message must be ${BRAND.maxPostLength} characters or less.`,
        });
      }

      // Run Automated Safety & Profanity Shield
      const safetyCheck = inspectAndSanitizeText(trimmedQuestion);
      if (!safetyCheck.allowed) {
        return res.status(400).json({ error: safetyCheck.reason });
      }
      const question = safetyCheck.sanitizedText;

    const requestedTheme = req.body?.themeId;
    const randomTheme =
      STORY_COLOR_PAIRS[Math.floor(Math.random() * STORY_COLOR_PAIRS.length)].id;
    const burnAfterReading = Boolean(req.body?.burnAfterReading);
    const ua = String(req.headers['user-agent'] || '').toLowerCase();
    const deviceHint = ua.includes('iphone')
      ? '📱 Sent from iPhone'
      : ua.includes('android')
      ? '🤖 Sent from Android'
      : '💻 Sent from Web Browser';
    const hour = new Date().getHours();
    const timeVibe =
      hour >= 22 || hour <= 4
        ? '🌙 Late Night Owl'
        : hour < 12
        ? '☀️ Morning Confessor'
        : '⚡ Daytime Lurker';
    const senderHint =
      (req.body?.senderHint as string) || `${deviceHint} • ${timeVibe}`;

    if (isUsingMongo()) {
      const existingUser = await UserModel.findOne({
        handleLower: rawHandle.toLowerCase(),
      }).lean();
      const canonicalHandle = existingUser ? existingUser.handle : rawHandle;

      const created = await InboxMessageModel.create({
        recipientHandle: canonicalHandle,
        recipientHandleLower: canonicalHandle.toLowerCase(),
        senderDeviceId,
        question,
        themeId: requestedTheme || randomTheme,
        isRead: false,
        burnAfterReading,
        senderHint,
        flagsCount: 0,
        flaggedBy: [],
        isHidden: false,
      });

      return res.status(201).json({
        success: true,
        message: `Secret message safely delivered to @${canonicalHandle}! 🚀`,
        item: formatInboxMessage(created),
      });
    }

    reloadLocalStoreFromDiskIfNeeded();
    const existingUser = localStore.users.find(
      (u) => u.handleLower === rawHandle.toLowerCase()
    );
    const canonicalHandle = existingUser ? existingUser.handle : rawHandle;
    const now = new Date().toISOString();

    const created = {
      _id: createId(),
      recipientHandle: canonicalHandle,
      recipientHandleLower: canonicalHandle.toLowerCase(),
      senderDeviceId,
      question,
      themeId: requestedTheme || randomTheme,
      isRead: false,
      burnAfterReading,
      senderHint,
      flagsCount: 0,
      flaggedBy: [] as string[],
      isHidden: false,
      createdAt: now,
      updatedAt: now,
    };

    localStore.inbox.unshift(created);
    saveLocalStore();

    return res.status(201).json({
      success: true,
      message: `Secret message safely delivered to @${canonicalHandle}! 🚀`,
      item: formatInboxMessage(created),
    });
  } catch (err) {
    console.error('Error in POST /inbox/:handle:', err);
    return res.status(500).json({ error: 'Failed to send anonymous message.' });
  }
});

/**
 * PATCH /api/v1/inbox/:id/reply
 */
inboxRouter.patch('/:id/reply', async (req: Request, res: Response) => {
  try {
    const messageId = req.params.id;
    const reply = ((req.body?.reply as string) || '').trim();
    const themeId = (req.body?.themeId as string) || undefined;

    if (!reply) {
      return res.status(400).json({ error: 'Reply text cannot be empty.' });
    }
    if (reply.length > BRAND.maxPostLength) {
      return res.status(400).json({
        error: `Reply cannot exceed ${BRAND.maxPostLength} characters.`,
      });
    }

    if (isUsingMongo()) {
      const update: Record<string, any> = {
        reply,
        repliedAt: new Date(),
        isRead: true,
      };
      if (themeId) update.themeId = themeId;

      const updated = await InboxMessageModel.findByIdAndUpdate(
        messageId,
        update,
        { new: true }
      ).lean();

      if (!updated) {
        return res.status(404).json({ error: 'Inbox message not found.' });
      }
      return res.json({ message: formatInboxMessage(updated) });
    }

    reloadLocalStoreFromDiskIfNeeded();
    const msg = localStore.inbox.find((m) => m._id === messageId);
    if (!msg) {
      return res.status(404).json({ error: 'Inbox message not found.' });
    }
    msg.reply = reply;
    msg.repliedAt = new Date().toISOString();
    msg.isRead = true;
    if (themeId) msg.themeId = themeId;
    msg.updatedAt = new Date().toISOString();
    saveLocalStore();

    return res.json({ message: formatInboxMessage(msg) });
  } catch (err) {
    console.error('Error in PATCH /inbox/:id/reply:', err);
    return res.status(500).json({ error: 'Failed to save reply.' });
  }
});

/**
 * POST /api/v1/inbox/:id/flag
 */
inboxRouter.post('/:id/flag', async (req: Request, res: Response) => {
  try {
    const messageId = req.params.id;
    const flaggerId =
      (req.body?.deviceId as string) ||
      (req.headers['x-device-id'] as string) ||
      `anon-${Date.now()}-${Math.random()}`;
    const instantHide = Boolean(req.body?.instantHide);

    if (isUsingMongo()) {
      const msg = await InboxMessageModel.findById(messageId);
      if (!msg) {
        return res.status(404).json({ error: 'Inbox message not found.' });
      }
      if (!msg.flaggedBy.includes(flaggerId)) {
        msg.flaggedBy.push(flaggerId);
        msg.flagsCount = msg.flaggedBy.length;
      }
      if (msg.flagsCount >= BRAND.maxFlagThreshold || instantHide) {
        msg.isHidden = true;
      }
      await msg.save();
      return res.json({
        _id: String(msg._id),
        flagsCount: msg.flagsCount,
        isHidden: msg.isHidden,
        message: msg.isHidden
          ? 'Message has been hidden from inbox.'
          : `Message flagged (${msg.flagsCount}/${BRAND.maxFlagThreshold}).`,
      });
    }

    reloadLocalStoreFromDiskIfNeeded();
    const msg = localStore.inbox.find((m) => m._id === messageId);
    if (!msg) {
      return res.status(404).json({ error: 'Inbox message not found.' });
    }
    if (!msg.flaggedBy.includes(flaggerId)) {
      msg.flaggedBy.push(flaggerId);
      msg.flagsCount = msg.flaggedBy.length;
    }
    if (msg.flagsCount >= BRAND.maxFlagThreshold || instantHide) {
      msg.isHidden = true;
    }
    msg.updatedAt = new Date().toISOString();
    saveLocalStore();

    return res.json({
      _id: msg._id,
      flagsCount: msg.flagsCount,
      isHidden: msg.isHidden,
      message: msg.isHidden
        ? 'Message has been hidden from inbox.'
        : `Message flagged (${msg.flagsCount}/${BRAND.maxFlagThreshold}).`,
    });
  } catch (err) {
    console.error('Error in POST /inbox/:id/flag:', err);
    return res.status(500).json({ error: 'Failed to flag inbox message.' });
  }
});
