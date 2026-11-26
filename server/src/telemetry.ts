import { createHash } from 'node:crypto';
import { Request } from 'express';
import { createId, isUsingMongo, localStore, saveLocalStore } from './db';
import { AnalyticsEventModel, AnalyticsEventType } from './models/AnalyticsEvent';
import { HostSessionModel } from './models/Loyalty';
import {
  evaluateCompleteUniqueSentence,
  LOYALTY_TARGET_DEVICES,
  LOYALTY_WINDOW_MS,
} from '../../shared';

const geoCache = new Map<string, { country: string; region: string; city: string }>();

export function getAdminSecret(): string | null {
  const secret = (process.env.ADMIN_SECRET || '').trim();
  return secret.length > 0 ? secret : null;
}

export function isValidAdminSecret(req: Request): boolean {
  const expected = getAdminSecret();
  if (!expected) return false;
  const supplied =
    (req.headers['x-admin-secret'] as string) ||
    (req.query.secret as string) ||
    '';
  return supplied.trim() === expected;
}

export function extractClientIp(req: Request): string {
  const fwd = req.headers['x-forwarded-for'];
  const raw = Array.isArray(fwd)
    ? fwd[0]
    : typeof fwd === 'string'
    ? fwd.split(',')[0]
    : req.ip || req.socket?.remoteAddress || 'unknown';
  return raw.trim();
}

export function hashIp(ip: string): string {
  return createHash('sha256')
    .update(`emous-salt:${ip}`)
    .digest('hex')
    .slice(0, 16);
}

/**
 * Returns YYYY-MM-DD and hour (0..23) in Africa/Lagos (WAT / UTC+1)
 * so traffic heatmaps and daily metrics match West Africa peak times.
 */
export function getWatDateAndHour(date = new Date()): {
  dateKey: string;
  hourOfDay: number;
} {
  try {
    const parts = new Intl.DateTimeFormat('en-CA', {
      timeZone: 'Africa/Lagos',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      hour12: false,
    }).formatToParts(date);

    const getPart = (t: string) =>
      parts.find((p) => p.type === t)?.value || '00';
    const dateKey = `${getPart('year')}-${getPart('month')}-${getPart('day')}`;
    const rawHour = Number(getPart('hour'));
    const hourOfDay = Number.isFinite(rawHour) ? rawHour % 24 : date.getUTCHours();
    return { dateKey, hourOfDay };
  } catch {
    const watMs = date.getTime() + 3600 * 1000;
    const wat = new Date(watMs);
    return {
      dateKey: wat.toISOString().slice(0, 10),
      hourOfDay: wat.getUTCHours(),
    };
  }
}

export async function resolveGeoFromRequest(req: Request): Promise<{
  country: string;
  region: string;
  city: string;
  ipHash: string;
}> {
  const ip = extractClientIp(req);
  const ipHash = hashIp(ip);

  // 1. Prefer CDN / Proxy headers (Vercel / Cloudflare / Render)
  const headerCountry =
    (req.headers['x-vercel-ip-country'] as string) ||
    (req.headers['cf-ipcountry'] as string) ||
    '';
  const headerCity = (req.headers['x-vercel-ip-city'] as string) || '';
  const headerRegion =
    (req.headers['x-vercel-ip-country-region'] as string) || '';

  if (headerCountry || headerCity) {
    return {
      country: decodeURIComponent(headerCountry || 'NG').toUpperCase(),
      region: decodeURIComponent(headerRegion || ''),
      city: decodeURIComponent(headerCity || 'Unknown'),
      ipHash,
    };
  }

  // 2. Skip lookup for loopback / private IPs
  const isPrivateIp =
    ip === 'unknown' ||
    ip === '::1' ||
    ip.startsWith('127.') ||
    ip.startsWith('10.') ||
    ip.startsWith('192.168.') ||
    ip.startsWith('::ffff:127.');
  if (isPrivateIp) {
    return {
      country: 'NG',
      region: 'Lagos',
      city: 'Localhost',
      ipHash,
    };
  }

  // 3. Cached lightweight GeoIP lookup
  const cached = geoCache.get(ip);
  if (cached) {
    return { ...cached, ipHash };
  }

  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 1800);
    const res = await fetch(
      `https://ipapi.co/${encodeURIComponent(ip)}/json/`,
      { signal: controller.signal }
    );
    clearTimeout(timer);
    if (res.ok) {
      const data: any = await res.json();
      if (!data.error) {
        const resolved = {
          country: String(data.country_code || data.country_name || 'NG').toUpperCase(),
          region: String(data.region || ''),
          city: String(data.city || 'Unknown'),
        };
        geoCache.set(ip, resolved);
        return { ...resolved, ipHash };
      }
    }
  } catch {
    // Non-fatal geo fallback
  }

  return {
    country: 'NG',
    region: '',
    city: 'Unknown',
    ipHash,
  };
}

export function buildIpSubnetPrefix(ip: string): string {
  const clean = ip.replace(/^::ffff:/, '');
  if (clean.includes('.')) {
    const parts = clean.split('.');
    return parts.slice(0, 3).join('.');
  }
  return clean.split(':').slice(0, 4).join(':');
}

export function resetExpiredActiveSessionIfNeeded(session: any): boolean {
  if (!session || session.status !== 'active') return false;
  const now = new Date();
  const expiresMs = new Date(session.expiresAt).getTime();
  if (Number.isFinite(expiresMs) && now.getTime() <= expiresMs) {
    return false;
  }

  // Strictly reset progress back to zero after the 2-hour interval expires incomplete
  session.uniqueDevices = [];
  session.uniqueIpHashes = [];
  session.uniqueHardwareKeys = [];
  session.uniqueLocationKeys = [];
  session.qualifiedMessageHashes = [];
  session.cities = [];
  session.eventTimestamps = [];
  if (isUsingMongo()) {
    session.windowStartedAt = now;
    session.expiresAt = new Date(now.getTime() + LOYALTY_WINDOW_MS);
  } else {
    session.windowStartedAt = now.toISOString();
    session.expiresAt = new Date(now.getTime() + LOYALTY_WINDOW_MS).toISOString();
    session.updatedAt = now.toISOString();
  }
  return true;
}

/**
 * Credits a qualified message toward a Host Game Session ONLY when ALL strict rules pass:
 * 1. Sent within the active 2-hour window (auto-resets to 0 if 2 hours elapsed without hitting 30).
 * 2. Message contains at least one complete sentence (>= 4 words, >= 18 chars) & is unique (not duplicated).
 * 3. Distinct physical device (hardware signature + subnet hash catches Chrome/Safari/Firefox on same phone!).
 * 4. Distinct location (same IP or same GPS coordinate box counts strictly as ONE!).
 */
export async function creditHostSessionForQualifiedMessage(params: {
  req: Request;
  sessionCode?: string;
  hostHandle?: string;
  playerDeviceId: string;
  messageText: string;
  hardwareSig?: string;
  lat?: number;
  lng?: number;
  ipHash?: string;
  city?: string;
}): Promise<{
  credited: boolean;
  reason?: string;
  didAutoReset?: boolean;
  uniqueDeviceCount?: number;
}> {
  const {
    req,
    sessionCode,
    hostHandle,
    playerDeviceId,
    messageText,
    hardwareSig,
    lat,
    lng,
  } = params;
  if (!playerDeviceId || (!sessionCode && !hostHandle)) {
    return { credited: false, reason: 'No active game session' };
  }

  const cleanCode = sessionCode?.trim().toUpperCase();
  const cleanHandleLower = hostHandle?.trim().replace(/^@/, '').toLowerCase();
  const now = new Date();
  const rawIp = extractClientIp(req);
  const ipHash = params.ipHash || hashIp(rawIp);
  const subnetHash = hashIp(buildIpSubnetPrefix(rawIp));
  const city = params.city || 'Unknown';

  // Build hardware key so multiple browsers on the same device share the same key
  const cleanHw = (hardwareSig || '').trim().toLowerCase().slice(0, 140);
  const hardwareKey = cleanHw
    ? createHash('sha256')
        .update(`${cleanHw}|${subnetHash}`)
        .digest('hex')
        .slice(0, 20)
    : `dev:${playerDeviceId}`;

  // Build location key: exact GPS cell (~100m) if provided, plus strict IP hash fallback
  const hasGps =
    typeof lat === 'number' &&
    typeof lng === 'number' &&
    Number.isFinite(lat) &&
    Number.isFinite(lng) &&
    Math.abs(lat) > 0.001;
  const locationKey = hasGps
    ? `gps:${lat!.toFixed(3)},${lng!.toFixed(3)}`
    : `ip:${ipHash}`;

  if (isUsingMongo()) {
    const query: any = {
      status: { $in: ['active', 'qualified', 'claimed'] },
    };
    if (cleanCode) {
      query.sessionCode = cleanCode;
    } else if (cleanHandleLower) {
      query.hostHandleLower = cleanHandleLower;
    } else {
      return { credited: false };
    }

    const session = await HostSessionModel.findOne(query).sort({ createdAt: -1 });
    if (!session) return { credited: false };

    const didAutoReset = resetExpiredActiveSessionIfNeeded(session);

    // Host cannot count their own messages
    if (session.hostDeviceId === playerDeviceId) {
      if (didAutoReset) await session.save();
      return {
        credited: false,
        didAutoReset,
        reason: 'Host self-message ignored',
        uniqueDeviceCount: session.uniqueDevices.length,
      };
    }

    // Already reached 30
    if (session.status !== 'active') {
      return {
        credited: false,
        didAutoReset,
        uniqueDeviceCount: session.uniqueDevices.length,
      };
    }

    // Rule: Message must be unique & at least one complete sentence
    const sentenceEval = evaluateCompleteUniqueSentence(
      messageText,
      session.qualifiedMessageHashes || []
    );
    if (!sentenceEval.qualified) {
      if (didAutoReset) await session.save();
      return {
        credited: false,
        didAutoReset,
        reason: sentenceEval.reason,
        uniqueDeviceCount: session.uniqueDevices.length,
      };
    }

    // Rule: Different physical device (not different browser on same phone)
    if (
      session.uniqueDevices.includes(playerDeviceId) ||
      (session.uniqueHardwareKeys || []).includes(hardwareKey)
    ) {
      if (didAutoReset) await session.save();
      return {
        credited: false,
        didAutoReset,
        reason: 'Same device or another browser on the same device counts as one.',
        uniqueDeviceCount: session.uniqueDevices.length,
      };
    }

    // Rule: Same location / IP counts strictly as ONE
    if (
      session.uniqueIpHashes.includes(ipHash) ||
      (session.uniqueLocationKeys || []).includes(locationKey)
    ) {
      if (didAutoReset) await session.save();
      return {
        credited: false,
        didAutoReset,
        reason: 'Devices from the same location count as one.',
        uniqueDeviceCount: session.uniqueDevices.length,
      };
    }

    // Passes all rules! Start timer window on very first qualified message if empty
    if (session.uniqueDevices.length === 0) {
      session.windowStartedAt = now;
      session.expiresAt = new Date(now.getTime() + LOYALTY_WINDOW_MS);
    }

    session.uniqueDevices.push(playerDeviceId);
    session.uniqueIpHashes.push(ipHash);
    session.uniqueHardwareKeys = session.uniqueHardwareKeys || [];
    session.uniqueHardwareKeys.push(hardwareKey);
    session.uniqueLocationKeys = session.uniqueLocationKeys || [];
    session.uniqueLocationKeys.push(locationKey);
    session.qualifiedMessageHashes = session.qualifiedMessageHashes || [];
    session.qualifiedMessageHashes.push(sentenceEval.normalized);
    session.eventTimestamps.push(now);
    if (city && city !== 'Unknown' && city !== 'Localhost' && !session.cities.includes(city)) {
      session.cities.push(city);
    }
    if (session.uniqueDevices.length >= (session.targetDevices || LOYALTY_TARGET_DEVICES)) {
      session.status = 'qualified';
    }
    await session.save();
    return {
      credited: true,
      didAutoReset,
      uniqueDeviceCount: session.uniqueDevices.length,
    };
  }

  // Local store engine fallback
  const session = localStore.hostSessions.find((s) => {
    if (!['active', 'qualified', 'claimed'].includes(s.status)) return false;
    if (cleanCode) return s.sessionCode === cleanCode;
    if (cleanHandleLower) return s.hostHandleLower === cleanHandleLower;
    return false;
  });

  if (!session) return { credited: false };
  const didAutoReset = resetExpiredActiveSessionIfNeeded(session);

  if (session.hostDeviceId === playerDeviceId || session.status !== 'active') {
    if (didAutoReset) saveLocalStore();
    return {
      credited: false,
      didAutoReset,
      uniqueDeviceCount: session.uniqueDevices.length,
    };
  }

  const sentenceEval = evaluateCompleteUniqueSentence(
    messageText,
    session.qualifiedMessageHashes || []
  );
  if (!sentenceEval.qualified) {
    if (didAutoReset) saveLocalStore();
    return {
      credited: false,
      didAutoReset,
      reason: sentenceEval.reason,
      uniqueDeviceCount: session.uniqueDevices.length,
    };
  }

  if (
    session.uniqueDevices.includes(playerDeviceId) ||
    (session.uniqueHardwareKeys || []).includes(hardwareKey)
  ) {
    if (didAutoReset) saveLocalStore();
    return {
      credited: false,
      didAutoReset,
      reason: 'Same device or different browser on same device counts as one.',
      uniqueDeviceCount: session.uniqueDevices.length,
    };
  }

  if (
    session.uniqueIpHashes.includes(ipHash) ||
    (session.uniqueLocationKeys || []).includes(locationKey)
  ) {
    if (didAutoReset) saveLocalStore();
    return {
      credited: false,
      didAutoReset,
      reason: 'Devices from the same location count as one.',
      uniqueDeviceCount: session.uniqueDevices.length,
    };
  }

  if (session.uniqueDevices.length === 0) {
    session.windowStartedAt = now.toISOString();
    session.expiresAt = new Date(now.getTime() + LOYALTY_WINDOW_MS).toISOString();
  }

  session.uniqueDevices.push(playerDeviceId);
  session.uniqueIpHashes.push(ipHash);
  session.uniqueHardwareKeys = [...(session.uniqueHardwareKeys || []), hardwareKey];
  session.uniqueLocationKeys = [...(session.uniqueLocationKeys || []), locationKey];
  session.qualifiedMessageHashes = [
    ...(session.qualifiedMessageHashes || []),
    sentenceEval.normalized,
  ];
  session.eventTimestamps.push(now.toISOString());
  if (city && city !== 'Unknown' && city !== 'Localhost' && !session.cities.includes(city)) {
    session.cities.push(city);
  }
  if (session.uniqueDevices.length >= (session.targetDevices || LOYALTY_TARGET_DEVICES)) {
    session.status = 'qualified';
  }
  session.updatedAt = now.toISOString();
  saveLocalStore();

  return {
    credited: true,
    didAutoReset,
    uniqueDeviceCount: session.uniqueDevices.length,
  };
}

export async function recordAnalyticsEvent(params: {
  req: Request;
  deviceId: string;
  eventType: AnalyticsEventType;
  route?: string;
  handle?: string;
  sessionCode?: string;
  source?: string;
}) {
  const geo = await resolveGeoFromRequest(params.req);
  const { dateKey, hourOfDay } = getWatDateAndHour();
  const cleanSource = (params.source || 'direct').toLowerCase().slice(0, 32);

  if (isUsingMongo()) {
    await AnalyticsEventModel.create({
      deviceId: params.deviceId,
      eventType: params.eventType,
      route: params.route || '/',
      handle: params.handle,
      sessionCode: params.sessionCode,
      country: geo.country,
      region: geo.region,
      city: geo.city,
      ipHash: geo.ipHash,
      dateKey,
      hourOfDay,
      source: cleanSource,
    });
  } else {
    localStore.analytics.push({
      _id: createId(),
      deviceId: params.deviceId,
      eventType: params.eventType,
      route: params.route || '/',
      handle: params.handle,
      sessionCode: params.sessionCode,
      country: geo.country,
      region: geo.region,
      city: geo.city,
      ipHash: geo.ipHash,
      dateKey,
      hourOfDay,
      source: cleanSource,
      createdAt: new Date().toISOString(),
    });
    if (localStore.analytics.length > 5000) {
      localStore.analytics = localStore.analytics.slice(-5000);
    }
    saveLocalStore();
  }

  return geo;
}
