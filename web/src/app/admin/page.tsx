'use client';

import React, { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import {
  AnalyticsSummaryDTO,
  HostSessionDTO,
  RewardClaimDTO,
  fetchAdminClaims,
  fetchAnalyticsSummary,
  updateAdminClaimStatus,
} from '@/lib/api-bundle';
import {
  ArrowLeft,
  BarChart3,
  Check,
  Clock,
  Copy,
  Download,
  Lock,
  MapPin,
  RefreshCw,
  ShieldAlert,
  ShieldCheck,
  Users,
  Wallet,
  XCircle,
} from 'lucide-react';

export default function AdminFounderDashboard() {
  const [secretInput, setSecretInput] = useState('');
  const [adminSecret, setAdminSecret] = useState<string>('');
  const [authError, setAuthError] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const [activeTab, setActiveTab] = useState<'analytics' | 'payouts'>('analytics');
  const [summary, setSummary] = useState<AnalyticsSummaryDTO | null>(null);
  const [claims, setClaims] = useState<RewardClaimDTO[]>([]);
  const [sessions, setSessions] = useState<HostSessionDTO[]>([]);
  const [payRefs, setPayRefs] = useState<Record<string, string>>({});
  const [toast, setToast] = useState<string | null>(null);

  const showToast = (msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(null), 3200);
  };

  const loadAll = useCallback(async (secret: string) => {
    setIsLoading(true);
    setAuthError('');
    try {
      const [analyticsData, loyaltyData] = await Promise.all([
        fetchAnalyticsSummary(secret, 14),
        fetchAdminClaims(secret),
      ]);
      setSummary(analyticsData);
      setClaims(loyaltyData.claims || []);
      setSessions(loyaltyData.sessions || []);
      setAdminSecret(secret);
      if (typeof window !== 'undefined') {
        sessionStorage.setItem('emous_admin_secret', secret);
      }
    } catch (err: any) {
      setAuthError(err?.message || 'Invalid Admin Passcode');
      setAdminSecret('');
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    if (typeof window !== 'undefined') {
      const saved = sessionStorage.getItem('emous_admin_secret');
      if (saved) {
        setSecretInput(saved);
        loadAll(saved);
      }
    }
  }, [loadAll]);

  const handleUnlock = (e: React.FormEvent) => {
    e.preventDefault();
    if (!secretInput.trim()) return;
    loadAll(secretInput.trim());
  };

  const handleMarkClaim = async (
    claimId: string,
    status: 'paid' | 'rejected'
  ) => {
    if (!adminSecret) return;
    try {
      const res = await updateAdminClaimStatus(adminSecret, claimId, {
        status,
        paymentReference: payRefs[claimId]?.trim() || undefined,
      });
      setClaims((prev) =>
        prev.map((c) => (c._id === claimId ? res.claim : c))
      );
      showToast(
        status === 'paid'
          ? '💸 Marked Claim as PAID (₦2,000) ✓'
          : '❌ Claim marked Rejected'
      );
      loadAll(adminSecret);
    } catch (err: any) {
      showToast(err?.message || 'Could not update claim');
    }
  };

  const handleExportPartnerCsv = () => {
    if (!summary) return;
    const rows = [
      ['Metric', 'Value'],
      ['Today Unique Devices', String(summary.overview.todayUniqueDevices)],
      ['Last 7 Days Unique Devices', String(summary.overview.last7dUniqueDevices)],
      ['All-Time Unique Devices', String(summary.overview.allTimeUniqueDevices)],
      ['Peak Activity Hour (WAT)', summary.overview.peakHourLabel],
      ['Total Feed Confessions', String(summary.overview.totalPosts)],
      ['Total Secret Inbox Notes', String(summary.overview.totalInboxNotes)],
      [],
      ['Date', 'Unique Devices', 'Total Events', 'Inbox Sends', 'Feed Posts'],
      ...summary.dailyTrend.map((d) => [
        d.dateKey,
        String(d.uniqueDevices),
        String(d.events),
        String(d.inboxSends),
        String(d.postCreates),
      ]),
      [],
      ['Location', 'Unique Devices', 'Events'],
      ...summary.topLocations.map((l) => [
        l.location,
        String(l.uniqueDevices),
        String(l.events),
      ]),
    ];

    const csv = rows.map((r) => r.map((v) => `"${v}"`).join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `emous-traffic-report-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    showToast('📊 Exported Partner Pitch CSV!');
  };

  if (!adminSecret) {
    return (
      <div className="min-h-screen bg-emous-bg text-white flex items-center justify-center p-4">
        <div className="w-full max-w-md bg-emous-surface rounded-3xl p-6 flyer-card border-2 border-black space-y-5">
          <div className="flex items-center justify-between">
            <span className="bg-emous-lime text-black font-display font-extrabold text-xs px-3 py-1 rounded-full border-2 border-black uppercase inline-flex items-center gap-1.5">
              <Lock className="w-3.5 h-3.5" />
              <span>emous Founder Portal</span>
            </span>
            <Link
              href="/"
              className="text-xs font-bold text-neutral-400 hover:text-white inline-flex items-center gap-1"
            >
              <ArrowLeft className="w-3.5 h-3.5" />
              <span>App</span>
            </Link>
          </div>

          <div className="space-y-1">
            <h1 className="font-display font-extrabold text-2xl">
              Analytics & Payout Verification
            </h1>
            <p className="text-xs text-neutral-400">
              Enter your Admin Passcode (`ADMIN_SECRET`, default{' '}
              <code className="text-emous-yellow">emous-admin-2026</code>) to
              inspect daily unique traffic & verify ₦2,000 WhatsApp group claims.
            </p>
          </div>

          <form onSubmit={handleUnlock} className="space-y-3">
            <input
              type="password"
              value={secretInput}
              onChange={(e) => setSecretInput(e.target.value)}
              placeholder="Enter Founder Passcode..."
              className="w-full bg-black text-white rounded-xl px-4 py-3 border-2 border-white/25 font-bold text-sm focus:outline-none focus:border-emous-lime"
            />
            {authError && (
              <p className="text-xs font-bold text-red-400">{authError}</p>
            )}
            <button
              type="submit"
              disabled={isLoading}
              className="w-full bg-emous-pink text-white font-display font-extrabold text-sm py-3 rounded-xl flyer-btn uppercase"
            >
              {isLoading ? 'Verifying...' : 'Unlock Founder Dashboard 🔐'}
            </button>
          </form>
        </div>
      </div>
    );
  }

  const maxDailyUsers = Math.max(
    1,
    ...(summary?.dailyTrend.map((d) => d.uniqueDevices) || [1])
  );
  const maxHourEvents = Math.max(
    1,
    ...(summary?.hourlyHeatmap.map((h) => h.uniqueDevices) || [1])
  );
  const pendingClaims = claims.filter((c) => c.status === 'pending');

  return (
    <div className="min-h-screen bg-emous-bg text-white pb-20">
      {toast && (
        <div className="fixed top-4 right-4 z-50 bg-emous-lime text-black font-display font-extrabold text-xs px-4 py-2.5 rounded-xl flyer-card">
          {toast}
        </div>
      )}

      <header className="sticky top-0 z-30 bg-emous-bg/95 backdrop-blur-md border-b-4 border-black">
        <div className="max-w-6xl mx-auto px-4 py-3 flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <Link
              href="/"
              className="bg-emous-surface text-white p-2 rounded-xl border-2 border-black hover:bg-neutral-800"
            >
              <ArrowLeft className="w-4 h-4" />
            </Link>
            <div>
              <h1 className="font-display font-extrabold text-lg sm:text-xl flex items-center gap-2">
                <span className="bg-emous-lime text-black px-2 py-0.5 rounded-lg border border-black text-sm">
                  emous
                </span>
                <span>Founder Analytics & Payouts</span>
              </h1>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => loadAll(adminSecret)}
              className="bg-emous-surface text-emous-lime font-display font-extrabold text-xs px-3 py-2 rounded-xl border-2 border-black inline-flex items-center gap-1.5"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isLoading ? 'animate-spin' : ''}`} />
              <span>Refresh</span>
            </button>
            <button
              onClick={handleExportPartnerCsv}
              className="bg-emous-yellow text-black font-display font-extrabold text-xs px-3 py-2 rounded-xl flyer-btn inline-flex items-center gap-1.5"
            >
              <Download className="w-3.5 h-3.5" />
              <span>Export Partner CSV</span>
            </button>
          </div>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-4 pt-6 space-y-6">
        {/* Top Switcher Tabs */}
        <div className="flex flex-wrap gap-2">
          <button
            onClick={() => setActiveTab('analytics')}
            className={`px-4 py-2.5 rounded-2xl font-display font-extrabold text-xs sm:text-sm uppercase flyer-btn inline-flex items-center gap-2 ${
              activeTab === 'analytics'
                ? 'bg-emous-lime text-black'
                : 'bg-emous-surface text-white'
            }`}
          >
            <BarChart3 className="w-4 h-4" />
            <span>Traffic, Location & Time Analytics</span>
          </button>

          <button
            onClick={() => setActiveTab('payouts')}
            className={`px-4 py-2.5 rounded-2xl font-display font-extrabold text-xs sm:text-sm uppercase flyer-btn inline-flex items-center gap-2 ${
              activeTab === 'payouts'
                ? 'bg-emous-pink text-white'
                : 'bg-emous-surface text-white'
            }`}
          >
            <Wallet className="w-4 h-4" />
            <span>₦2,000 WhatsApp Admin Payouts</span>
            {pendingClaims.length > 0 && (
              <span className="bg-emous-yellow text-black text-[11px] font-extrabold px-2 py-0.5 rounded-full border border-black">
                {pendingClaims.length} Pending
              </span>
            )}
          </button>
        </div>

        {/* ================================================================
            TAB 1: TRAFFIC, UNIQUE DEVICES, LOCATION & TIME ANALYTICS
           ================================================================ */}
        {activeTab === 'analytics' && summary && (
          <div className="space-y-6">
            {/* KPI Grid */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3 sm:gap-4">
              <div className="bg-emous-lime text-black rounded-2xl p-4 flyer-card">
                <p className="text-[11px] font-display font-extrabold uppercase flex items-center gap-1">
                  <Users className="w-3.5 h-3.5" />
                  <span>Today Unique Users</span>
                </p>
                <p className="font-display font-extrabold text-3xl mt-1">
                  {summary.overview.todayUniqueDevices}
                </p>
                <p className="text-[11px] font-bold opacity-80">
                  {summary.overview.todayEvents} actions today
                </p>
              </div>

              <div className="bg-emous-surface rounded-2xl p-4 flyer-card border-2 border-black">
                <p className="text-[11px] font-display font-extrabold uppercase text-emous-yellow">
                  All-Time Unique Devices
                </p>
                <p className="font-display font-extrabold text-3xl mt-1 text-white">
                  {summary.overview.allTimeUniqueDevices}
                </p>
                <p className="text-[11px] text-neutral-400 font-bold">
                  {summary.overview.last7dUniqueDevices} unique in last 7d
                </p>
              </div>

              <div className="bg-emous-surface rounded-2xl p-4 flyer-card border-2 border-black">
                <p className="text-[11px] font-display font-extrabold uppercase text-emous-pink flex items-center gap-1">
                  <Clock className="w-3.5 h-3.5" />
                  <span>Peak Active Time</span>
                </p>
                <p className="font-display font-extrabold text-2xl sm:text-3xl mt-1 text-white">
                  {summary.overview.peakHourLabel}
                </p>
                <p className="text-[11px] text-neutral-400 font-bold">
                  Nigerian / WAT Peak Window
                </p>
              </div>

              <div className="bg-emous-surface rounded-2xl p-4 flyer-card border-2 border-black">
                <p className="text-[11px] font-display font-extrabold uppercase text-emous-lime">
                  Total Content & Hosts
                </p>
                <p className="font-display font-extrabold text-3xl mt-1 text-white">
                  {summary.overview.totalPosts + summary.overview.totalInboxNotes}
                </p>
                <p className="text-[11px] text-neutral-400 font-bold">
                  {summary.overview.totalPosts} Feed • {summary.overview.totalInboxNotes} Inbox
                </p>
              </div>
            </div>

            {/* Daily Unique Devices Chart + Hourly Activity Heatmap */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
              <div className="bg-emous-surface rounded-3xl p-5 flyer-card space-y-4">
                <h2 className="font-display font-extrabold text-base sm:text-lg text-emous-yellow">
                  📈 Daily Unique Users (Last 14 Days)
                </h2>
                {summary.dailyTrend.length === 0 ? (
                  <p className="text-xs text-neutral-400 py-8 text-center">
                    Traffic data will populate immediately as visitors open emous.
                  </p>
                ) : (
                  <div className="space-y-2.5">
                    {summary.dailyTrend.map((d) => {
                      const pct = Math.max(
                        6,
                        Math.round((d.uniqueDevices / maxDailyUsers) * 100)
                      );
                      return (
                        <div key={d.dateKey} className="space-y-1">
                          <div className="flex justify-between text-xs font-bold">
                            <span className="text-neutral-300">{d.dateKey}</span>
                            <span className="text-emous-lime">
                              {d.uniqueDevices} unique devices ({d.inboxSends} secret notes • {d.postCreates} posts)
                            </span>
                          </div>
                          <div className="h-3 bg-black rounded-full overflow-hidden border border-white/10">
                            <div
                              style={{ width: `${pct}%` }}
                              className="h-full bg-emous-pink rounded-full"
                            />
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>

              <div className="bg-emous-surface rounded-3xl p-5 flyer-card space-y-4">
                <h2 className="font-display font-extrabold text-base sm:text-lg text-emous-lime">
                  🕒 Hourly Traffic Peaks (24h WAT)
                </h2>
                <div className="grid grid-cols-6 sm:grid-cols-8 gap-2">
                  {summary.hourlyHeatmap.map((h) => {
                    const intensity = h.uniqueDevices / maxHourEvents;
                    const bgClass =
                      h.uniqueDevices === 0
                        ? 'bg-black/60 text-neutral-500'
                        : intensity >= 0.7
                        ? 'bg-emous-pink text-white'
                        : intensity >= 0.35
                        ? 'bg-emous-lime text-black'
                        : 'bg-emous-yellow/90 text-black';
                    return (
                      <div
                        key={h.hour}
                        className={`${bgClass} rounded-xl p-2 border border-black text-center`}
                      >
                        <p className="text-[10px] font-display font-extrabold">
                          {h.label}
                        </p>
                        <p className="text-sm font-extrabold">{h.uniqueDevices}</p>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>

            {/* Location Breakdown + Referral Sources */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
              <div className="bg-emous-surface rounded-3xl p-5 flyer-card space-y-3">
                <h2 className="font-display font-extrabold text-base sm:text-lg flex items-center gap-2">
                  <MapPin className="w-4 h-4 text-emous-pink" />
                  <span>Top Locations (Cities & Countries)</span>
                </h2>
                {summary.topLocations.length === 0 ? (
                  <p className="text-xs text-neutral-400">No geo hits logged yet.</p>
                ) : (
                  <div className="space-y-2">
                    {summary.topLocations.map((loc, idx) => (
                      <div
                        key={loc.location}
                        className="bg-black/75 rounded-xl px-3.5 py-2.5 flex items-center justify-between text-xs font-bold border border-white/10"
                      >
                        <span>
                          <span className="text-emous-yellow mr-2">#{idx + 1}</span>
                          {loc.location}
                        </span>
                        <span className="text-emous-lime">
                          {loc.uniqueDevices} unique users • {loc.events} hits
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <div className="bg-emous-surface rounded-3xl p-5 flyer-card space-y-3">
                <h2 className="font-display font-extrabold text-base sm:text-lg text-emous-yellow">
                  📲 Traffic Channels (WhatsApp vs Social vs Direct)
                </h2>
                <div className="space-y-2">
                  {summary.sourceBreakdown.map((src) => (
                    <div
                      key={src.source}
                      className="bg-black/75 rounded-xl px-3.5 py-2.5 flex items-center justify-between text-xs font-bold border border-white/10"
                    >
                      <span className="uppercase text-white">{src.source}</span>
                      <span className="text-emous-pink">
                        {src.uniqueDevices} unique devices ({src.events} events)
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ================================================================
            TAB 2: ₦2,000 WHATSAPP ADMIN LOYALTY PAYOUT QUEUE & AUDIT
           ================================================================ */}
        {activeTab === 'payouts' && (
          <div className="space-y-6">
            <div className="space-y-3">
              <h2 className="font-display font-extrabold text-lg text-emous-yellow">
                💸 Payout Requests ({claims.length})
              </h2>

              {claims.length === 0 ? (
                <div className="bg-emous-surface rounded-3xl p-8 text-center flyer-card">
                  <p className="font-bold text-sm text-neutral-300">
                    No WhatsApp Group Admin has submitted a ₦2,000 claim yet. Once
                    a host hits 30+ unique devices, their audited claim appears here!
                  </p>
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {claims.map((claim) => (
                    <div
                      key={claim._id}
                      className="bg-emous-surface rounded-3xl p-5 flyer-card space-y-3 border-2 border-black"
                    >
                      <div className="flex items-center justify-between gap-2 flex-wrap">
                        <span className="bg-black text-emous-yellow text-xs font-display font-extrabold px-3 py-1 rounded-full border border-emous-yellow/40">
                          @{claim.hostHandle} • {claim.sessionCode}
                        </span>
                        <span
                          className={`text-[11px] font-display font-extrabold uppercase px-2.5 py-0.5 rounded-full border border-black ${
                            claim.status === 'paid'
                              ? 'bg-emous-lime text-black'
                              : claim.status === 'rejected'
                              ? 'bg-red-600 text-white'
                              : 'bg-emous-pink text-white animate-pulse'
                          }`}
                        >
                          {claim.status === 'paid'
                            ? '✓ PAID ₦2,000'
                            : claim.status === 'rejected'
                            ? 'REJECTED'
                            : 'PENDING REVIEW'}
                        </span>
                      </div>

                      {/* Anti-Cheat Qualification Audit */}
                      <div className="bg-black/80 rounded-2xl p-3 border border-white/15 space-y-1.5 text-xs">
                        <p className="font-extrabold text-white">
                          Group: {claim.groupName}
                        </p>
                        <div className="flex flex-wrap gap-2 text-[11px] font-bold">
                          <span className="text-emous-lime">
                            📱 {claim.uniqueDeviceCount}/30 Unique Devices
                          </span>
                          <span className="text-emous-yellow">
                            🌐 {claim.uniqueIpCount} Distinct IPs
                          </span>
                          <span className="text-neutral-300">
                            ⏱️ {claim.sessionMinutes} mins span
                          </span>
                        </div>
                        <div className="flex items-center gap-1.5 text-[11px] font-extrabold">
                          {claim.fraudRisk === 'low' ? (
                            <span className="text-emous-lime inline-flex items-center gap-1">
                              <ShieldCheck className="w-3.5 h-3.5" />
                              Fraud Check: LOW RISK (Real Group Activity)
                            </span>
                          ) : (
                            <span className="text-red-400 inline-flex items-center gap-1">
                              <ShieldAlert className="w-3.5 h-3.5" />
                              Fraud Check: {claim.fraudRisk.toUpperCase()} RISK — Verify Screenshot
                            </span>
                          )}
                        </div>
                      </div>

                      {/* Manual Bank Transfer Details */}
                      <div className="bg-white text-black rounded-2xl p-3.5 border-2 border-black space-y-1">
                        <p className="text-xs font-extrabold uppercase text-emous-pink">
                          Manual Transfer Details (₦2,000)
                        </p>
                        <p className="text-sm font-extrabold">
                          {claim.bankName} — {claim.accountName}
                        </p>
                        <div className="flex items-center justify-between gap-2 pt-0.5">
                          <span className="font-display font-extrabold text-lg tracking-wider">
                            {claim.accountNumber}
                          </span>
                          <button
                            type="button"
                            onClick={() => {
                              navigator.clipboard?.writeText(claim.accountNumber);
                              showToast(`📋 Copied ${claim.accountNumber}`);
                            }}
                            className="bg-black text-emous-lime text-[11px] font-extrabold px-2.5 py-1 rounded-lg inline-flex items-center gap-1"
                          >
                            <Copy className="w-3 h-3" />
                            <span>Copy Acct</span>
                          </button>
                        </div>
                        <p className="text-[11px] font-bold text-neutral-700">
                          WhatsApp: {claim.whatsappNumber}
                        </p>
                      </div>

                      {claim.status === 'pending' && (
                        <div className="space-y-2 pt-1">
                          <input
                            type="text"
                            value={payRefs[claim._id] || ''}
                            onChange={(e) =>
                              setPayRefs((prev) => ({
                                ...prev,
                                [claim._id]: e.target.value,
                              }))
                            }
                            placeholder="Optional OPay/Bank Ref (e.g. OPY-94821)"
                            className="w-full bg-black text-white text-xs font-bold px-3 py-2 rounded-xl border border-white/25"
                          />
                          <div className="flex gap-2">
                            <button
                              onClick={() => handleMarkClaim(claim._id, 'paid')}
                              className="flex-1 bg-emous-lime text-black font-display font-extrabold text-xs py-2.5 rounded-xl flyer-btn uppercase inline-flex items-center justify-center gap-1"
                            >
                              <Check className="w-4 h-4" />
                              <span>Mark Paid (₦2,000)</span>
                            </button>
                            <button
                              onClick={() =>
                                handleMarkClaim(claim._id, 'rejected')
                              }
                              className="bg-black text-red-400 font-display font-extrabold text-xs px-3 py-2.5 rounded-xl border-2 border-black uppercase inline-flex items-center gap-1"
                            >
                              <XCircle className="w-4 h-4" />
                              <span>Reject</span>
                            </button>
                          </div>
                        </div>
                      )}

                      {claim.paymentReference && (
                        <p className="text-[11px] font-bold text-emous-lime">
                          Ref: {claim.paymentReference}
                        </p>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Live Active Host Sessions Monitor */}
            <div className="space-y-3">
              <h2 className="font-display font-extrabold text-base sm:text-lg text-neutral-200">
                🔥 Live Active WhatsApp Host Sessions ({sessions.length})
              </h2>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                {sessions.map((s) => (
                  <div
                    key={s._id}
                    className="bg-emous-surface rounded-2xl p-3.5 border-2 border-black space-y-1.5 text-xs"
                  >
                    <div className="flex items-center justify-between">
                      <span className="font-extrabold text-emous-yellow">
                        @{s.hostHandle}
                      </span>
                      <span className="bg-black text-emous-lime px-2 py-0.5 rounded-full text-[10px] font-extrabold">
                        {s.sessionCode}
                      </span>
                    </div>
                    <p className="font-bold text-neutral-300 truncate">
                      {s.groupName}
                    </p>
                    <div className="flex items-center justify-between pt-1">
                      <span className="font-extrabold text-white">
                        {s.uniqueDeviceCount} / {s.targetDevices} unique players
                      </span>
                      <span className="uppercase text-[10px] font-extrabold text-emous-pink">
                        {s.status}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
