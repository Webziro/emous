import { Router, Request, Response } from 'express';
import { UserModel } from '../models/User';
import { createId, isUsingMongo, localStore, saveLocalStore } from '../db';
import { BRAND, generateRandomHandle } from '../../../shared';

export const identityRouter = Router();

async function handleExists(handleLower: string, ignoreDeviceId?: string): Promise<boolean> {
  if (isUsingMongo()) {
    const query: any = {
      $or: [{ handleLower }, { handleHistoryLower: handleLower }],
    };
    if (ignoreDeviceId) {
      query.deviceId = { $ne: ignoreDeviceId };
    }
    const found = await UserModel.findOne(query).lean();
    return Boolean(found);
  }
  return localStore.users.some(
    (u) =>
      u.deviceId !== ignoreDeviceId &&
      (u.handleLower === handleLower ||
        (u.handleHistoryLower || []).includes(handleLower))
  );
}

function normalizeHandleHistory(currentHandle: string, history?: string[]): {
  handleHistory: string[];
  handleHistoryLower: string[];
} {
  const seen = new Set<string>();
  const handles: string[] = [];
  const lower: string[] = [];
  for (const h of [currentHandle, ...(history || [])]) {
    if (!h) continue;
    const clean = h.trim();
    const l = clean.toLowerCase();
    if (!clean || seen.has(l)) continue;
    seen.add(l);
    handles.push(clean);
    lower.push(l);
  }
  return { handleHistory: handles, handleHistoryLower: lower };
}

async function createUniqueHandle(): Promise<string> {
  for (let attempt = 0; attempt < 15; attempt++) {
    const candidate = generateRandomHandle(attempt >= 5);
    const exists = await handleExists(candidate.toLowerCase());
    if (!exists) {
      return candidate;
    }
  }
  return `${generateRandomHandle(false)}${Math.floor(100 + Math.random() * 900)}`;
}

/**
 * POST /api/v1/identity/init
 * Zero-friction identity: creates or retrieves the user's AdjectiveNoun handle by deviceId/fingerprint
 */
identityRouter.post('/init', async (req: Request, res: Response) => {
  try {
    const deviceId =
      (req.body?.deviceId as string) ||
      (req.headers['x-device-id'] as string) ||
      '';

    if (!deviceId || deviceId.trim().length < 3) {
      return res.status(400).json({
        error: 'A valid deviceId or browser fingerprint is required.',
      });
    }

    const cleanDeviceId = deviceId.trim();
    const preferredHandle = (req.body?.preferredHandle as string)?.trim();
    const domain = process.env.PUBLIC_DOMAIN || BRAND.domain;

    if (isUsingMongo()) {
      let user = await UserModel.findOne({ deviceId: cleanDeviceId });
      if (!user) {
        let handleToUse = '';
        if (preferredHandle && /^[A-Za-z0-9_]{3,28}$/.test(preferredHandle)) {
          const collision = await handleExists(preferredHandle.toLowerCase(), cleanDeviceId);
          if (!collision) handleToUse = preferredHandle;
        }
        if (!handleToUse) handleToUse = await createUniqueHandle();

        const norm = normalizeHandleHistory(handleToUse, []);
        user = await UserModel.create({
          deviceId: cleanDeviceId,
          handle: handleToUse,
          handleLower: handleToUse.toLowerCase(),
          handleHistory: norm.handleHistory,
          handleHistoryLower: norm.handleHistoryLower,
        });
      } else if (!user.handleHistory || user.handleHistory.length === 0) {
        const norm = normalizeHandleHistory(user.handle, user.handleHistory);
        user.handleHistory = norm.handleHistory;
        user.handleHistoryLower = norm.handleHistoryLower;
        await user.save();
      }
      return res.json({
        deviceId: user.deviceId,
        handle: user.handle,
        handleHistory: user.handleHistory,
        inboxLink: `${domain}/${user.handle}`,
        createdAt: user.createdAt,
      });
    }

    // Local Store Engine
    let localUser = localStore.users.find((u) => u.deviceId === cleanDeviceId);
    if (!localUser) {
      let handleToUse = '';
      if (preferredHandle && /^[A-Za-z0-9_]{3,28}$/.test(preferredHandle)) {
        const collision = await handleExists(preferredHandle.toLowerCase(), cleanDeviceId);
        if (!collision) handleToUse = preferredHandle;
      }
      if (!handleToUse) handleToUse = await createUniqueHandle();

      const norm = normalizeHandleHistory(handleToUse, []);
      const now = new Date().toISOString();
      localUser = {
        _id: createId(),
        deviceId: cleanDeviceId,
        handle: handleToUse,
        handleLower: handleToUse.toLowerCase(),
        handleHistory: norm.handleHistory,
        handleHistoryLower: norm.handleHistoryLower,
        createdAt: now,
        updatedAt: now,
      };
      localStore.users.push(localUser);
      saveLocalStore();
    } else if (!localUser.handleHistory || localUser.handleHistory.length === 0) {
      const norm = normalizeHandleHistory(localUser.handle, localUser.handleHistory);
      localUser.handleHistory = norm.handleHistory;
      localUser.handleHistoryLower = norm.handleHistoryLower;
      saveLocalStore();
    }

    return res.json({
      deviceId: localUser.deviceId,
      handle: localUser.handle,
      handleHistory: localUser.handleHistory || [localUser.handle],
      inboxLink: `${domain}/${localUser.handle}`,
      createdAt: localUser.createdAt,
    });
  } catch (err: any) {
    console.error('Error in POST /identity/init:', err);
    return res.status(500).json({ error: 'Failed to initialize anonymous identity.' });
  }
});

/**
 * POST /api/v1/identity/reroll
 * Creates a new unique handle while keeping all previous handles permanently attached to this deviceId's handleHistory!
 */
identityRouter.post('/reroll', async (req: Request, res: Response) => {
  try {
    const deviceId =
      (req.body?.deviceId as string) ||
      (req.headers['x-device-id'] as string) ||
      '';
    if (!deviceId) {
      return res.status(400).json({ error: 'deviceId is required' });
    }

    const cleanId = deviceId.trim();
    const newHandle = await createUniqueHandle();
    const domain = process.env.PUBLIC_DOMAIN || BRAND.domain;

    if (isUsingMongo()) {
      const existing = await UserModel.findOne({ deviceId: cleanId });
      const prevHistory = existing
        ? [existing.handle, ...(existing.handleHistory || [])]
        : [];
      const norm = normalizeHandleHistory(newHandle, prevHistory);

      const user = await UserModel.findOneAndUpdate(
        { deviceId: cleanId },
        {
          handle: newHandle,
          handleLower: newHandle.toLowerCase(),
          handleHistory: norm.handleHistory,
          handleHistoryLower: norm.handleHistoryLower,
        },
        { new: true, upsert: true }
      );
      return res.json({
        deviceId: user.deviceId,
        handle: user.handle,
        handleHistory: user.handleHistory,
        inboxLink: `${domain}/${user.handle}`,
        createdAt: user.createdAt,
      });
    }

    let localUser = localStore.users.find((u) => u.deviceId === cleanId);
    const now = new Date().toISOString();
    if (localUser) {
      const norm = normalizeHandleHistory(newHandle, [
        localUser.handle,
        ...(localUser.handleHistory || []),
      ]);
      localUser.handle = newHandle;
      localUser.handleLower = newHandle.toLowerCase();
      localUser.handleHistory = norm.handleHistory;
      localUser.handleHistoryLower = norm.handleHistoryLower;
      localUser.updatedAt = now;
    } else {
      const norm = normalizeHandleHistory(newHandle, []);
      localUser = {
        _id: createId(),
        deviceId: cleanId,
        handle: newHandle,
        handleLower: newHandle.toLowerCase(),
        handleHistory: norm.handleHistory,
        handleHistoryLower: norm.handleHistoryLower,
        createdAt: now,
        updatedAt: now,
      };
      localStore.users.push(localUser);
    }
    saveLocalStore();

    return res.json({
      deviceId: localUser.deviceId,
      handle: localUser.handle,
      handleHistory: localUser.handleHistory,
      inboxLink: `${domain}/${localUser.handle}`,
      createdAt: localUser.createdAt,
    });
  } catch (err) {
    console.error('Error in POST /identity/reroll:', err);
    return res.status(500).json({ error: 'Failed to reroll handle.' });
  }
});

/**
 * POST /api/v1/identity/switch
 * Allows a user to switch back to any of their previous handles in their handleHistory
 */
identityRouter.post('/switch', async (req: Request, res: Response) => {
  try {
    const deviceId =
      (req.body?.deviceId as string) ||
      (req.headers['x-device-id'] as string) ||
      '';
    const targetHandle = ((req.body?.handle as string) || '').trim();
    if (!deviceId || !targetHandle) {
      return res.status(400).json({ error: 'deviceId and handle are required.' });
    }

    const cleanId = deviceId.trim();
    const targetLower = targetHandle.toLowerCase();
    const domain = process.env.PUBLIC_DOMAIN || BRAND.domain;

    // Make sure no OTHER device owns this handle
    const takenByOther = await handleExists(targetLower, cleanId);
    if (takenByOther) {
      return res.status(409).json({
        error: 'That handle belongs to another device.',
      });
    }

    if (isUsingMongo()) {
      const existing = await UserModel.findOne({ deviceId: cleanId });
      const prevHistory = existing
        ? [existing.handle, ...(existing.handleHistory || [])]
        : [];
      const canonical =
        prevHistory.find((h) => h.toLowerCase() === targetLower) || targetHandle;
      const norm = normalizeHandleHistory(canonical, prevHistory);

      const user = await UserModel.findOneAndUpdate(
        { deviceId: cleanId },
        {
          handle: canonical,
          handleLower: canonical.toLowerCase(),
          handleHistory: norm.handleHistory,
          handleHistoryLower: norm.handleHistoryLower,
        },
        { new: true, upsert: true }
      );
      return res.json({
        deviceId: user.deviceId,
        handle: user.handle,
        handleHistory: user.handleHistory,
        inboxLink: `${domain}/${user.handle}`,
        createdAt: user.createdAt,
      });
    }

    let localUser = localStore.users.find((u) => u.deviceId === cleanId);
    const now = new Date().toISOString();
    const prevHistory = localUser
      ? [localUser.handle, ...(localUser.handleHistory || [])]
      : [];
    const canonical =
      prevHistory.find((h) => h.toLowerCase() === targetLower) || targetHandle;
    const norm = normalizeHandleHistory(canonical, prevHistory);

    if (localUser) {
      localUser.handle = canonical;
      localUser.handleLower = canonical.toLowerCase();
      localUser.handleHistory = norm.handleHistory;
      localUser.handleHistoryLower = norm.handleHistoryLower;
      localUser.updatedAt = now;
    } else {
      localUser = {
        _id: createId(),
        deviceId: cleanId,
        handle: canonical,
        handleLower: canonical.toLowerCase(),
        handleHistory: norm.handleHistory,
        handleHistoryLower: norm.handleHistoryLower,
        createdAt: now,
        updatedAt: now,
      };
      localStore.users.push(localUser);
    }
    saveLocalStore();

    return res.json({
      deviceId: localUser.deviceId,
      handle: localUser.handle,
      handleHistory: localUser.handleHistory,
      inboxLink: `${domain}/${localUser.handle}`,
      createdAt: localUser.createdAt,
    });
  } catch (err) {
    console.error('Error in POST /identity/switch:', err);
    return res.status(500).json({ error: 'Failed to switch handle.' });
  }
});

/**
 * GET /api/v1/identity/handle/:handle
 */
identityRouter.get('/handle/:handle', async (req: Request, res: Response) => {
  try {
    const rawHandle = (req.params.handle || '').trim();
    if (!rawHandle) {
      return res.status(400).json({ error: 'Handle is required.' });
    }

    const domain = process.env.PUBLIC_DOMAIN || BRAND.domain;

    if (isUsingMongo()) {
      const existing = await UserModel.findOne({
        handleLower: rawHandle.toLowerCase(),
      }).lean();
      const canonicalHandle = existing ? existing.handle : rawHandle;
      return res.json({
        handle: canonicalHandle,
        exists: Boolean(existing),
        inboxLink: `${domain}/ask/${canonicalHandle}`,
        prompt: `Ask @${canonicalHandle} anything anonymously!`,
      });
    }

    const existing = localStore.users.find(
      (u) => u.handleLower === rawHandle.toLowerCase()
    );
    const canonicalHandle = existing ? existing.handle : rawHandle;

    return res.json({
      handle: canonicalHandle,
      exists: Boolean(existing),
      inboxLink: `${domain}/ask/${canonicalHandle}`,
      prompt: `Ask @${canonicalHandle} anything anonymously!`,
    });
  } catch (err) {
    console.error('Error in GET /identity/handle/:handle:', err);
    return res.status(500).json({ error: 'Failed to resolve handle.' });
  }
});
