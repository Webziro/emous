import { createHash } from 'node:crypto';
import { Request } from 'express';
import { createId, isUsingMongo, localStore, saveLocalStore } from './db';
import { AnalyticsEventModel, AnalyticsEventType } from './models/AnalyticsEvent';
import { HostSessionModel } from './models/Loyalty';
import { LOYALTY_TARGET_DEVICES } from '../../shared';

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

/**
 * Credits a unique player deviceId & ipHash to an active 24h Host Game Session
 * when a WhatsApp group member visits the host's link (?g=SESSION_CODE or @handle).
 */
export async function creditHostSessionParticipant(params: {
  sessionCode?: string;
  hostHandle?: string;
  playerDeviceId: string;
  ipHash: string;
  city: string;
}) {
  const { sessionCode, hostHandle, playerDeviceId, ipHash, city } = params;
  if (!playerDeviceId || (!sessionCode && !hostHandle)) return null;

  const cleanCode = sessionCode?.trim().toUpperCase();
  const cleanHandleLower = hostHandle?.trim().replace(/^@/, '').toLowerCase();
  const now = new Date();

  if (isUsingMongo()) {
    const query: any = {
      expiresAt: { $gt: now },
      status: { $in: ['active', 'qualified', 'claimed'] },
    };
    if (cleanCode) {
      query.sessionCode = cleanCode;
    } else if (cleanHandleLower) {
      query.hostHandleLower = cleanHandleLower;
    } else {
      return null;
    }

    const session = await HostSessionModel.findOne(query).sort({ createdAt: -1 });
    if (!session) return null;

    // Never count the group admin's own device toward their 30 unique players
    if (session.hostDeviceId === playerDeviceId) {
      return session;
    }

    let changed = false;
    if (!session.uniqueDevices.includes(playerDeviceId)) {
      session.uniqueDevices.push(playerDeviceId);
      session.eventTimestamps.push(now);
      changed = true;
    }
    if (ipHash && ipHash !== 'unknown' && !session.uniqueIpHashes.includes(ipHash)) {
      session.uniqueIpHashes.push(ipHash);
      changed = true;
    }
    if (city && city !== 'Unknown' && city !== 'Localhost' && !session.cities.includes(city)) {
      session.cities.push(city);
      changed = true;
    }
    if (
      session.uniqueDevices.length >= (session.targetDevices || LOYALTY_TARGET_DEVICES) &&
      session.status === 'active'
    ) {
      session.status = 'qualified';
      changed = true;
    }
    if (changed) {
      await session.save();
    }
    return session;
  }

  // Local store fallback
  const session = localStore.hostSessions.find((s) => {
    const validTime = new Date(s.expiresAt).getTime() > now.getTime();
    const validStatus = ['active', 'qualified', 'claimed'].includes(s.status);
    if (!validTime || !validStatus) return false;
    if (cleanCode) return s.sessionCode === cleanCode;
    if (cleanHandleLower) return s.hostHandleLower === cleanHandleLower;
    return false;
  });

  if (!session || session.hostDeviceId === playerDeviceId) return session || null;

  let changed = false;
  if (!session.uniqueDevices.includes(playerDeviceId)) {
    session.uniqueDevices.push(playerDeviceId);
    session.eventTimestamps.push(now.toISOString());
    changed = true;
  }
  if (ipHash && ipHash !== 'unknown' && !session.uniqueIpHashes.includes(ipHash)) {
    session.uniqueIpHashes.push(ipHash);
    changed = true;
  }
  if (city && city !== 'Unknown' && city !== 'Localhost' && !session.cities.includes(city)) {
    session.cities.push(city);
    changed = true;
  }
  if (
    session.uniqueDevices.length >= (session.targetDevices || LOYALTY_TARGET_DEVICES) &&
    session.status === 'active'
  ) {
    session.status = 'qualified';
    changed = true;
  }
  if (changed) {
    session.updatedAt = now.toISOString();
    saveLocalStore();
  }
  return session;
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

  // Automatically credit active host session if player came from ?g=CODE or @handle
  if (params.sessionCode || params.handle) {
    await creditHostSessionParticipant({
      sessionCode: params.sessionCode,
      hostHandle: params.handle,
      playerDeviceId: params.deviceId,
      ipHash: geo.ipHash,
      city: geo.city,
    });
  }

  return geo;
}
