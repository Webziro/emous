import { Router, Request, Response } from 'express';
import {
  createId,
  isUsingMongo,
  localStore,
  reloadLocalStoreFromDiskIfNeeded,
  saveLocalStore,
} from '../db';
import { HostSessionModel, RewardClaimModel } from '../models/Loyalty';
import {
  BRAND,
  LOYALTY_REWARD_NAIRA,
  LOYALTY_TARGET_DEVICES,
  LOYALTY_WINDOW_HOURS,
  LOYALTY_WINDOW_MS,
} from '../../../shared';
import {
  creditHostSessionForQualifiedMessage,
  getAdminSecret,
  isValidAdminSecret,
  resetExpiredActiveSessionIfNeeded,
  resolveGeoFromRequest,
} from '../telemetry';

export const loyaltyRouter = Router();

function generateSessionCode(handle: string): string {
  const prefix = handle
    .replace(/[^A-Za-z]/g, '')
    .toUpperCase()
    .slice(0, 3)
    .padEnd(3, 'X');
  const suffix = Math.random().toString(36).slice(2, 6).toUpperCase();
  return `${prefix}-${suffix}`;
}

function formatSessionDTO(doc: any, claimDoc?: any, didAutoReset = false) {
  const domain = process.env.PUBLIC_DOMAIN || BRAND.domain;
  return {
    _id: String(doc._id),
    sessionCode: doc.sessionCode,
    hostHandle: doc.hostHandle,
    groupName: doc.groupName || 'WhatsApp Group Game',
    uniqueDeviceCount: Array.isArray(doc.uniqueDevices)
      ? doc.uniqueDevices.length
      : 0,
    targetDevices: doc.targetDevices || LOYALTY_TARGET_DEVICES,
    rewardNaira: doc.rewardNaira || LOYALTY_REWARD_NAIRA,
    windowHours: LOYALTY_WINDOW_HOURS,
    didAutoReset,
    adminWhatsapp: process.env.ADMIN_WHATSAPP || BRAND.adminWhatsappNumber || '',
    status: doc.status || 'active',
    shareUrl: `https://${domain}/${doc.hostHandle}?g=${doc.sessionCode}`,
    claimStatus: claimDoc ? claimDoc.status : 'none',
    claimReference: claimDoc?.paymentReference || undefined,
    windowStartedAt: doc.windowStartedAt || doc.createdAt,
    createdAt: doc.createdAt,
    expiresAt: doc.expiresAt,
  };
}

function computeFraudRisk(params: {
  uniqueDeviceCount: number;
  uniqueIpCount: number;
  sessionMinutes: number;
}): 'low' | 'medium' | 'high' {
  const { uniqueDeviceCount, uniqueIpCount, sessionMinutes } = params;
  // If 30 devices all came from 1-2 IPs in under 2 minutes, flag for review!
  if (uniqueDeviceCount >= 20 && uniqueIpCount <= 3 && sessionMinutes < 3) {
    return 'high';
  }
  if (uniqueDeviceCount >= 25 && uniqueIpCount < Math.ceil(uniqueDeviceCount * 0.35)) {
    return 'medium';
  }
  return 'low';
}

function calcSessionMinutes(timestamps: any[]): number {
  if (!Array.isArray(timestamps) || timestamps.length < 2) return 0;
  const times = timestamps
    .map((t) => new Date(t).getTime())
    .filter((ms) => Number.isFinite(ms))
    .sort((a, b) => a - b);
  if (times.length < 2) return 0;
  return Math.max(1, Math.round((times[times.length - 1] - times[0]) / 60000));
}

/**
 * POST /api/v1/loyalty/session
 * Gets or starts the group admin's 24-hour trackable game session (₦2,000 when ≥ 30 unique devices join).
 */
loyaltyRouter.post('/session', async (req: Request, res: Response) => {
  try {
    const deviceId =
      ((req.body?.deviceId as string) ||
        (req.headers['x-device-id'] as string) ||
        '').trim();
    const handle = ((req.body?.handle as string) || '').trim().replace(/^@/, '');
    const groupName = ((req.body?.groupName as string) || '').trim().slice(0, 80);
    const forceNew = Boolean(req.body?.forceNew);

    if (!deviceId || !handle) {
      return res
        .status(400)
        .json({ error: 'deviceId and handle are required to host a game session.' });
    }

    const now = new Date();
    const expiresAt = new Date(now.getTime() + LOYALTY_WINDOW_MS);

    if (isUsingMongo()) {
      let session = !forceNew
        ? await HostSessionModel.findOne({
            hostDeviceId: deviceId,
            status: { $in: ['active', 'qualified', 'claimed'] },
          }).sort({ createdAt: -1 })
        : null;

      let didAutoReset = false;
      if (!session) {
        session = await HostSessionModel.create({
          sessionCode: generateSessionCode(handle),
          hostDeviceId: deviceId,
          hostHandle: handle,
          hostHandleLower: handle.toLowerCase(),
          groupName: groupName || 'WhatsApp Group Game',
          uniqueDevices: [],
          uniqueIpHashes: [],
          uniqueHardwareKeys: [],
          uniqueLocationKeys: [],
          qualifiedMessageHashes: [],
          cities: [],
          eventTimestamps: [],
          targetDevices: LOYALTY_TARGET_DEVICES,
          rewardNaira: LOYALTY_REWARD_NAIRA,
          status: 'active',
          windowStartedAt: now,
          expiresAt,
        });
      } else {
        didAutoReset = resetExpiredActiveSessionIfNeeded(session);
        if (groupName && session.groupName !== groupName) {
          session.groupName = groupName;
        }
        if (didAutoReset || (groupName && session.isModified('groupName'))) {
          await session.save();
        }
      }

      const claim = await RewardClaimModel.findOne({
        sessionCode: session.sessionCode,
      }).lean();

      return res.json({ session: formatSessionDTO(session, claim, didAutoReset) });
    }

    // Local store engine
    reloadLocalStoreFromDiskIfNeeded();
    let session = !forceNew
      ? localStore.hostSessions.find(
          (s) =>
            s.hostDeviceId === deviceId &&
            ['active', 'qualified', 'claimed'].includes(s.status)
        )
      : undefined;

    let didAutoReset = false;
    if (!session) {
      const nowIso = now.toISOString();
      session = {
        _id: createId(),
        sessionCode: generateSessionCode(handle),
        hostDeviceId: deviceId,
        hostHandle: handle,
        hostHandleLower: handle.toLowerCase(),
        groupName: groupName || 'WhatsApp Group Game',
        uniqueDevices: [],
        uniqueIpHashes: [],
        uniqueHardwareKeys: [],
        uniqueLocationKeys: [],
        qualifiedMessageHashes: [],
        cities: [],
        eventTimestamps: [],
        targetDevices: LOYALTY_TARGET_DEVICES,
        rewardNaira: LOYALTY_REWARD_NAIRA,
        status: 'active',
        windowStartedAt: nowIso,
        expiresAt: expiresAt.toISOString(),
        createdAt: nowIso,
        updatedAt: nowIso,
      };
      localStore.hostSessions.unshift(session);
      saveLocalStore();
    } else {
      didAutoReset = resetExpiredActiveSessionIfNeeded(session);
      if (groupName && session.groupName !== groupName) {
        session.groupName = groupName;
        session.updatedAt = now.toISOString();
      }
      if (didAutoReset || groupName) saveLocalStore();
    }

    const claim = localStore.rewardClaims.find(
      (c) => c.sessionCode === session!.sessionCode
    );
    return res.json({ session: formatSessionDTO(session, claim, didAutoReset) });
  } catch (err) {
    console.error('Error in POST /loyalty/session:', err);
    return res.status(500).json({ error: 'Failed to create/load host session.' });
  }
});

/**
 * POST /api/v1/loyalty/track
 * Requires a valid complete unique sentence message; ignores bare page views.
 */
loyaltyRouter.post('/track', async (req: Request, res: Response) => {
  try {
    const playerDeviceId =
      ((req.body?.deviceId as string) ||
        (req.headers['x-device-id'] as string) ||
        '').trim();
    const sessionCode = ((req.body?.sessionCode as string) || '').trim();
    const hostHandle = ((req.body?.handle as string) || '').trim();
    const messageText = ((req.body?.messageText as string) || '').trim();

    if (!playerDeviceId || !messageText || (!sessionCode && !hostHandle)) {
      return res.json({ credited: false });
    }

    const geo = await resolveGeoFromRequest(req);
    const result = await creditHostSessionForQualifiedMessage({
      req,
      sessionCode: sessionCode || undefined,
      hostHandle: hostHandle || undefined,
      playerDeviceId,
      messageText,
      hardwareSig: (req.body?.hardwareSig as string) || undefined,
      lat:
        typeof req.body?.lat === 'number'
          ? req.body.lat
          : Number(req.body?.lat) || undefined,
      lng:
        typeof req.body?.lng === 'number'
          ? req.body.lng
          : Number(req.body?.lng) || undefined,
      ipHash: geo.ipHash,
      city: geo.city,
    });

    return res.json(result);
  } catch (err) {
    console.error('Error in POST /loyalty/track:', err);
    return res.status(500).json({ error: 'Failed to track session participant.' });
  }
});

/**
 * POST /api/v1/loyalty/claim
 * Group Admin submits their Nigerian Bank / OPay / Kuda details once >= 30 unique devices participated.
 * No payment gateway needed — creates an audited pending manual payout for founder verification.
 */
loyaltyRouter.post('/claim', async (req: Request, res: Response) => {
  try {
    const deviceId =
      ((req.body?.deviceId as string) ||
        (req.headers['x-device-id'] as string) ||
        '').trim();
    const sessionCode = ((req.body?.sessionCode as string) || '')
      .trim()
      .toUpperCase();
    const bankName = ((req.body?.bankName as string) || '').trim();
    const accountNumber = ((req.body?.accountNumber as string) || '')
      .replace(/\D/g, '')
      .trim();
    const accountName = ((req.body?.accountName as string) || '').trim();
    const whatsappNumber = ((req.body?.whatsappNumber as string) || '').trim();
    const groupName = ((req.body?.groupName as string) || 'WhatsApp Group').trim();

    if (!deviceId || !sessionCode) {
      return res
        .status(400)
        .json({ error: 'Valid sessionCode and deviceId are required.' });
    }
    if (!bankName || accountNumber.length !== 10 || !accountName || !whatsappNumber) {
      return res.status(400).json({
        error:
          'Please enter Bank Name, 10-digit Account Number, Account Name, and your WhatsApp Number.',
      });
    }

    if (isUsingMongo()) {
      const session = await HostSessionModel.findOne({ sessionCode });
      if (!session) {
        return res.status(404).json({ error: 'Host session not found.' });
      }
      if (session.hostDeviceId !== deviceId) {
        return res
          .status(403)
          .json({ error: 'Only the device that created this game session can claim the reward.' });
      }
      const uniqueDeviceCount = session.uniqueDevices.length;
      if (uniqueDeviceCount < (session.targetDevices || LOYALTY_TARGET_DEVICES)) {
        return res.status(400).json({
          error: `You currently have ${uniqueDeviceCount}/${session.targetDevices} unique devices. Reach ${session.targetDevices} to unlock ₦${session.rewardNaira}!`,
        });
      }

      const existingClaim = await RewardClaimModel.findOne({ sessionCode });
      if (existingClaim) {
        return res.json({
          message: `Your claim for ${sessionCode} is already submitted (${existingClaim.status}).`,
          claim: existingClaim,
        });
      }

      const uniqueIpCount = session.uniqueIpHashes.length;
      const sessionMinutes = calcSessionMinutes(session.eventTimestamps);
      const fraudRisk = computeFraudRisk({
        uniqueDeviceCount,
        uniqueIpCount,
        sessionMinutes,
      });

      const claim = await RewardClaimModel.create({
        sessionCode,
        hostDeviceId: deviceId,
        hostHandle: session.hostHandle,
        groupName: groupName || session.groupName,
        bankName,
        accountNumber,
        accountName,
        whatsappNumber,
        uniqueDeviceCount,
        uniqueIpCount,
        sessionMinutes,
        cities: session.cities,
        fraudRisk,
        rewardNaira: session.rewardNaira || LOYALTY_REWARD_NAIRA,
        status: 'pending',
      });

      session.status = 'claimed';
      session.groupName = groupName || session.groupName;
      await session.save();

      return res.status(201).json({
        message:
          '🎉 Payout request submitted! Founder verification & manual transfer (₦2,000) will be sent shortly.',
        claim,
        session: formatSessionDTO(session, claim),
      });
    }

    // Local store fallback
    reloadLocalStoreFromDiskIfNeeded();
    const session = localStore.hostSessions.find(
      (s) => s.sessionCode === sessionCode
    );
    if (!session) {
      return res.status(404).json({ error: 'Host session not found.' });
    }
    if (session.hostDeviceId !== deviceId) {
      return res
        .status(403)
        .json({ error: 'Only the device that created this game session can claim the reward.' });
    }
    const uniqueDeviceCount = session.uniqueDevices.length;
    if (uniqueDeviceCount < (session.targetDevices || LOYALTY_TARGET_DEVICES)) {
      return res.status(400).json({
        error: `You currently have ${uniqueDeviceCount}/${session.targetDevices} unique devices. Reach ${session.targetDevices} to unlock ₦${session.rewardNaira}!`,
      });
    }

    const existingClaim = localStore.rewardClaims.find(
      (c) => c.sessionCode === sessionCode
    );
    if (existingClaim) {
      return res.json({
        message: `Your claim is already submitted (${existingClaim.status}).`,
        claim: existingClaim,
      });
    }

    const nowIso = new Date().toISOString();
    const uniqueIpCount = session.uniqueIpHashes.length;
    const sessionMinutes = calcSessionMinutes(session.eventTimestamps);
    const fraudRisk = computeFraudRisk({
      uniqueDeviceCount,
      uniqueIpCount,
      sessionMinutes,
    });

    const claim = {
      _id: createId(),
      sessionCode,
      hostDeviceId: deviceId,
      hostHandle: session.hostHandle,
      groupName: groupName || session.groupName,
      bankName,
      accountNumber,
      accountName,
      whatsappNumber,
      uniqueDeviceCount,
      uniqueIpCount,
      sessionMinutes,
      cities: session.cities,
      fraudRisk,
      rewardNaira: session.rewardNaira || LOYALTY_REWARD_NAIRA,
      status: 'pending' as const,
      createdAt: nowIso,
      updatedAt: nowIso,
    };
    localStore.rewardClaims.unshift(claim);
    session.status = 'claimed';
    session.updatedAt = nowIso;
    saveLocalStore();

    return res.status(201).json({
      message:
        '🎉 Payout request submitted! Founder verification & manual transfer (₦2,000) will be sent shortly.',
      claim,
      session: formatSessionDTO(session, claim),
    });
  } catch (err) {
    console.error('Error in POST /loyalty/claim:', err);
    return res.status(500).json({ error: 'Failed to submit reward claim.' });
  }
});

/**
 * GET /api/v1/loyalty/admin/claims
 * Founder-only: inspect all pending/paid payout claims + live host sessions & anti-cheat metrics.
 */
loyaltyRouter.get('/admin/claims', async (req: Request, res: Response) => {
  try {
    if (!getAdminSecret()) {
      return res.status(503).json({
        error:
          'ADMIN_SECRET environment variable is not set on the server yet. Add ADMIN_SECRET in Render Environment Variables.',
      });
    }
    if (!isValidAdminSecret(req)) {
      return res
        .status(401)
        .json({ error: 'Unauthorized. Valid Admin Passcode required.' });
    }

    if (isUsingMongo()) {
      const [claims, activeSessions] = await Promise.all([
        RewardClaimModel.find({}).sort({ createdAt: -1 }).limit(100).lean(),
        HostSessionModel.find({}).sort({ createdAt: -1 }).limit(50).lean(),
      ]);

      return res.json({
        claims,
        sessions: activeSessions.map((s) => formatSessionDTO(s)),
      });
    }

    reloadLocalStoreFromDiskIfNeeded();
    return res.json({
      claims: localStore.rewardClaims,
      sessions: localStore.hostSessions.map((s) => formatSessionDTO(s)),
    });
  } catch (err) {
    console.error('Error in GET /loyalty/admin/claims:', err);
    return res.status(500).json({ error: 'Failed to load admin claims.' });
  }
});

/**
 * PATCH /api/v1/loyalty/admin/claims/:id
 * Founder marks a payout claim as Paid (after sending ₦2,000 manually) or Rejected.
 */
loyaltyRouter.patch('/admin/claims/:id', async (req: Request, res: Response) => {
  try {
    if (!getAdminSecret()) {
      return res.status(503).json({
        error:
          'ADMIN_SECRET environment variable is not set on the server yet. Add ADMIN_SECRET in Render Environment Variables.',
      });
    }
    if (!isValidAdminSecret(req)) {
      return res
        .status(401)
        .json({ error: 'Unauthorized. Valid Admin Passcode required.' });
    }

    const { id } = req.params;
    const rawStatus = req.body?.status;
    const status: 'pending' | 'paid' | 'rejected' =
      rawStatus === 'rejected'
        ? 'rejected'
        : rawStatus === 'pending'
        ? 'pending'
        : 'paid';
    const paymentReference = ((req.body?.paymentReference as string) || '').trim();
    const adminNote = ((req.body?.adminNote as string) || '').trim();
    const sessionStatus = status === 'pending' ? 'claimed' : status;

    if (isUsingMongo()) {
      const claim = await RewardClaimModel.findByIdAndUpdate(
        id,
        {
          status,
          paymentReference: paymentReference || undefined,
          adminNote: adminNote || undefined,
          paidAt: status === 'paid' ? new Date() : undefined,
        },
        { new: true }
      );
      if (!claim) {
        return res.status(404).json({ error: 'Claim not found.' });
      }
      await HostSessionModel.findOneAndUpdate(
        { sessionCode: claim.sessionCode },
        { status: sessionStatus }
      );
      return res.json({ claim });
    }

    reloadLocalStoreFromDiskIfNeeded();
    const claim = localStore.rewardClaims.find((c) => c._id === id);
    if (!claim) {
      return res.status(404).json({ error: 'Claim not found.' });
    }
    const nowIso = new Date().toISOString();
    claim.status = status;
    claim.paymentReference = paymentReference || undefined;
    claim.adminNote = adminNote || undefined;
    claim.paidAt = status === 'paid' ? nowIso : undefined;
    claim.updatedAt = nowIso;

    const session = localStore.hostSessions.find(
      (s) => s.sessionCode === claim.sessionCode
    );
    if (session) {
      session.status = sessionStatus;
      session.updatedAt = nowIso;
    }
    saveLocalStore();
    return res.json({ claim });
  } catch (err) {
    console.error('Error in PATCH /loyalty/admin/claims/:id:', err);
    return res.status(500).json({ error: 'Failed to update claim status.' });
  }
});
