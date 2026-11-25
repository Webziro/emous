import { Router, Request, Response } from 'express';
import {
  isUsingMongo,
  localStore,
  reloadLocalStoreFromDiskIfNeeded,
} from '../db';
import { AnalyticsEventModel, AnalyticsEventType } from '../models/AnalyticsEvent';
import { HostSessionModel, RewardClaimModel } from '../models/Loyalty';
import { PostModel } from '../models/Post';
import { InboxMessageModel } from '../models/InboxMessage';
import {
  getWatDateAndHour,
  isValidAdminSecret,
  recordAnalyticsEvent,
} from '../telemetry';

export const analyticsRouter = Router();

const ALLOWED_EVENTS = new Set<AnalyticsEventType>([
  'page_view',
  'receiver_open',
  'post_create',
  'inbox_send',
  'comment_add',
  'share_click',
]);

/**
 * POST /api/v1/analytics/ping
 * Logs page views, receiver opens, shares, etc. with unique deviceId, geo (city/country), WAT date & hour.
 */
analyticsRouter.post('/ping', async (req: Request, res: Response) => {
  try {
    const deviceId =
      ((req.body?.deviceId as string) ||
        (req.headers['x-device-id'] as string) ||
        '').trim();

    if (!deviceId || deviceId === 'ssr-device') {
      return res.json({ tracked: false });
    }

    const rawType = String(req.body?.eventType || 'page_view') as AnalyticsEventType;
    const eventType: AnalyticsEventType = ALLOWED_EVENTS.has(rawType)
      ? rawType
      : 'page_view';

    const geo = await recordAnalyticsEvent({
      req,
      deviceId,
      eventType,
      route: String(req.body?.route || '/').slice(0, 120),
      handle: req.body?.handle ? String(req.body.handle).trim() : undefined,
      sessionCode: req.body?.sessionCode
        ? String(req.body.sessionCode).trim().toUpperCase()
        : undefined,
      source: req.body?.source ? String(req.body.source) : 'direct',
    });

    return res.json({
      tracked: true,
      country: geo.country,
      city: geo.city,
    });
  } catch (err) {
    console.error('Error in POST /analytics/ping:', err);
    return res.status(500).json({ error: 'Analytics ping failed.' });
  }
});

/**
 * GET /api/v1/analytics/summary
 * Founder Admin-protected summary: Daily unique devices, peak hours, top cities/countries, daily breakdown.
 */
analyticsRouter.get('/summary', async (req: Request, res: Response) => {
  try {
    if (!isValidAdminSecret(req)) {
      return res.status(401).json({ error: 'Unauthorized. Valid Admin Passcode required.' });
    }

    const daysBack = Math.min(90, Math.max(7, Number(req.query.days) || 14));
    const { dateKey: todayKey } = getWatDateAndHour();
    const cutoff = new Date(Date.now() - daysBack * 24 * 60 * 60 * 1000);
    const last7dCutoff = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);

    let events: any[] = [];
    let totalPosts = 0;
    let totalInboxNotes = 0;
    let qualifiedHostsCount = 0;
    let pendingClaimsCount = 0;

    if (isUsingMongo()) {
      const [evDocs, postsCount, inboxCount, qualCount, pendCount] =
        await Promise.all([
          AnalyticsEventModel.find({ createdAt: { $gte: cutoff } })
            .sort({ createdAt: 1 })
            .lean(),
          PostModel.countDocuments({ isHidden: false }),
          InboxMessageModel.countDocuments({ isHidden: false }),
          HostSessionModel.countDocuments({
            status: { $in: ['qualified', 'claimed', 'paid'] },
          }),
          RewardClaimModel.countDocuments({ status: 'pending' }),
        ]);

      const allDevicesAgg = await AnalyticsEventModel.distinct('deviceId');
      events = evDocs;
      totalPosts = postsCount;
      totalInboxNotes = inboxCount;
      qualifiedHostsCount = qualCount;
      pendingClaimsCount = pendCount;

      return res.json(
        buildSummaryResponse({
          events,
          todayKey,
          last7dCutoff,
          allTimeUniqueCount: allDevicesAgg.length,
          allTimeEventsCount: await AnalyticsEventModel.countDocuments(),
          totalPosts,
          totalInboxNotes,
          qualifiedHostsCount,
          pendingClaimsCount,
        })
      );
    }

    reloadLocalStoreFromDiskIfNeeded();
    events = localStore.analytics.filter(
      (e) => new Date(e.createdAt).getTime() >= cutoff.getTime()
    );
    const allTimeDevices = new Set(localStore.analytics.map((e) => e.deviceId));
    totalPosts = localStore.posts.filter((p) => !p.isHidden).length;
    totalInboxNotes = localStore.inbox.filter((m) => !m.isHidden).length;
    qualifiedHostsCount = localStore.hostSessions.filter((s) =>
      ['qualified', 'claimed', 'paid'].includes(s.status)
    ).length;
    pendingClaimsCount = localStore.rewardClaims.filter(
      (c) => c.status === 'pending'
    ).length;

    return res.json(
      buildSummaryResponse({
        events,
        todayKey,
        last7dCutoff,
        allTimeUniqueCount: allTimeDevices.size,
        allTimeEventsCount: localStore.analytics.length,
        totalPosts,
        totalInboxNotes,
        qualifiedHostsCount,
        pendingClaimsCount,
      })
    );
  } catch (err) {
    console.error('Error in GET /analytics/summary:', err);
    return res.status(500).json({ error: 'Failed to load analytics summary.' });
  }
});

function buildSummaryResponse(params: {
  events: any[];
  todayKey: string;
  last7dCutoff: Date;
  allTimeUniqueCount: number;
  allTimeEventsCount: number;
  totalPosts: number;
  totalInboxNotes: number;
  qualifiedHostsCount: number;
  pendingClaimsCount: number;
}) {
  const {
    events,
    todayKey,
    last7dCutoff,
    allTimeUniqueCount,
    allTimeEventsCount,
    totalPosts,
    totalInboxNotes,
    qualifiedHostsCount,
    pendingClaimsCount,
  } = params;

  const todayDevices = new Set<string>();
  const last7dDevices = new Set<string>();
  let todayEvents = 0;

  const dailyMap = new Map<
    string,
    { devices: Set<string>; events: number; inboxSends: number; postCreates: number }
  >();
  const hourlyMap = new Map<number, { events: number; devices: Set<string> }>();
  for (let h = 0; h < 24; h++) {
    hourlyMap.set(h, { events: 0, devices: new Set() });
  }
  const locMap = new Map<
    string,
    { country: string; city: string; devices: Set<string>; events: number }
  >();
  const sourceMap = new Map<string, { events: number; devices: Set<string> }>();

  for (const ev of events) {
    const dev = ev.deviceId || 'anon';
    const dKey = ev.dateKey || todayKey;
    const hr = typeof ev.hourOfDay === 'number' ? ev.hourOfDay % 24 : 12;
    const createdMs = new Date(ev.createdAt).getTime();

    if (dKey === todayKey) {
      todayDevices.add(dev);
      todayEvents += 1;
    }
    if (createdMs >= last7dCutoff.getTime()) {
      last7dDevices.add(dev);
    }

    if (!dailyMap.has(dKey)) {
      dailyMap.set(dKey, {
        devices: new Set(),
        events: 0,
        inboxSends: 0,
        postCreates: 0,
      });
    }
    const dayEntry = dailyMap.get(dKey)!;
    dayEntry.devices.add(dev);
    dayEntry.events += 1;
    if (ev.eventType === 'inbox_send') dayEntry.inboxSends += 1;
    if (ev.eventType === 'post_create') dayEntry.postCreates += 1;

    const hrEntry = hourlyMap.get(hr)!;
    hrEntry.events += 1;
    hrEntry.devices.add(dev);

    const country = ev.country || 'NG';
    const city = ev.city && ev.city !== 'Localhost' ? ev.city : 'Lagos / Local';
    const locKey = `${city}, ${country}`;
    if (!locMap.has(locKey)) {
      locMap.set(locKey, { country, city, devices: new Set(), events: 0 });
    }
    const lEntry = locMap.get(locKey)!;
    lEntry.devices.add(dev);
    lEntry.events += 1;

    const src = ev.source || 'direct';
    if (!sourceMap.has(src)) {
      sourceMap.set(src, { events: 0, devices: new Set() });
    }
    const sEntry = sourceMap.get(src)!;
    sEntry.events += 1;
    sEntry.devices.add(dev);
  }

  const hourlyHeatmap = Array.from(hourlyMap.entries()).map(([hour, info]) => {
    const hr12 = hour === 0 ? 12 : hour > 12 ? hour - 12 : hour;
    const suffix = hour >= 12 ? 'PM' : 'AM';
    return {
      hour,
      label: `${hr12} ${suffix}`,
      events: info.events,
      uniqueDevices: info.devices.size,
    };
  });

  const peakEntry = [...hourlyHeatmap].sort(
    (a, b) => b.uniqueDevices - a.uniqueDevices || b.events - a.events
  )[0] || { hour: 21, label: '9 PM' };

  const dailyTrend = Array.from(dailyMap.entries())
    .sort((a, b) => a[0].localeCompare(b[0]))
    .map(([dateKey, d]) => ({
      dateKey,
      uniqueDevices: d.devices.size,
      events: d.events,
      inboxSends: d.inboxSends,
      postCreates: d.postCreates,
    }));

  const topLocations = Array.from(locMap.entries())
    .map(([location, l]) => ({
      location,
      country: l.country,
      city: l.city,
      uniqueDevices: l.devices.size,
      events: l.events,
    }))
    .sort((a, b) => b.uniqueDevices - a.uniqueDevices || b.events - a.events)
    .slice(0, 15);

  const sourceBreakdown = Array.from(sourceMap.entries())
    .map(([source, s]) => ({
      source,
      events: s.events,
      uniqueDevices: s.devices.size,
    }))
    .sort((a, b) => b.uniqueDevices - a.uniqueDevices);

  return {
    overview: {
      todayUniqueDevices: todayDevices.size,
      last7dUniqueDevices: last7dDevices.size,
      allTimeUniqueDevices: Math.max(allTimeUniqueCount, last7dDevices.size),
      todayEvents,
      allTimeEvents: Math.max(allTimeEventsCount, events.length),
      peakHour: peakEntry.hour,
      peakHourLabel: `${peakEntry.label} WAT`,
      totalPosts,
      totalInboxNotes,
      qualifiedHostsCount,
      pendingClaimsCount,
    },
    dailyTrend,
    hourlyHeatmap,
    topLocations,
    sourceBreakdown,
  };
}
