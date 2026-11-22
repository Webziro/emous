import { Router, Request, Response } from 'express';
import { UserModel } from '../models/User';
import { createId, isUsingMongo, localStore, saveLocalStore } from '../db';
import { BRAND, generateRandomHandle } from '../../../shared';

export const identityRouter = Router();

async function handleExists(handleLower: string): Promise<boolean> {
  if (isUsingMongo()) {
    const found = await UserModel.findOne({ handleLower }).lean();
    return Boolean(found);
  }
  return localStore.users.some((u) => u.handleLower === handleLower);
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
          const collision = await handleExists(preferredHandle.toLowerCase());
          if (!collision) handleToUse = preferredHandle;
        }
        if (!handleToUse) handleToUse = await createUniqueHandle();

        user = await UserModel.create({
          deviceId: cleanDeviceId,
          handle: handleToUse,
          handleLower: handleToUse.toLowerCase(),
        });
      }
      return res.json({
        deviceId: user.deviceId,
        handle: user.handle,
        inboxLink: `${domain}/${user.handle}`,
        createdAt: user.createdAt,
      });
    }

    // Local Store Engine
    let localUser = localStore.users.find((u) => u.deviceId === cleanDeviceId);
    if (!localUser) {
      let handleToUse = '';
      if (preferredHandle && /^[A-Za-z0-9_]{3,28}$/.test(preferredHandle)) {
        const collision = await handleExists(preferredHandle.toLowerCase());
        if (!collision) handleToUse = preferredHandle;
      }
      if (!handleToUse) handleToUse = await createUniqueHandle();

      const now = new Date().toISOString();
      localUser = {
        _id: createId(),
        deviceId: cleanDeviceId,
        handle: handleToUse,
        handleLower: handleToUse.toLowerCase(),
        createdAt: now,
        updatedAt: now,
      };
      localStore.users.push(localUser);
      saveLocalStore();
    }

    return res.json({
      deviceId: localUser.deviceId,
      handle: localUser.handle,
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

    const newHandle = await createUniqueHandle();
    const domain = process.env.PUBLIC_DOMAIN || BRAND.domain;

    if (isUsingMongo()) {
      const user = await UserModel.findOneAndUpdate(
        { deviceId: deviceId.trim() },
        { handle: newHandle, handleLower: newHandle.toLowerCase() },
        { new: true, upsert: true }
      );
      return res.json({
        deviceId: user.deviceId,
        handle: user.handle,
        inboxLink: `${domain}/ask/${user.handle}`,
        createdAt: user.createdAt,
      });
    }

    const cleanId = deviceId.trim();
    let localUser = localStore.users.find((u) => u.deviceId === cleanId);
    const now = new Date().toISOString();
    if (localUser) {
      localUser.handle = newHandle;
      localUser.handleLower = newHandle.toLowerCase();
      localUser.updatedAt = now;
    } else {
      localUser = {
        _id: createId(),
        deviceId: cleanId,
        handle: newHandle,
        handleLower: newHandle.toLowerCase(),
        createdAt: now,
        updatedAt: now,
      };
      localStore.users.push(localUser);
    }
    saveLocalStore();

    return res.json({
      deviceId: localUser.deviceId,
      handle: localUser.handle,
      inboxLink: `${domain}/ask/${localUser.handle}`,
      createdAt: localUser.createdAt,
    });
  } catch (err) {
    console.error('Error in POST /identity/reroll:', err);
    return res.status(500).json({ error: 'Failed to reroll handle.' });
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
