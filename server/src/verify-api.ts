import assert from 'node:assert';
import { createApp } from './index';
import {
  connectDatabase,
  disconnectDatabase,
  isUsingMongo,
  localStore,
  purgeExpiredInboxMessages,
} from './db';
import { InboxMessageModel } from './models/InboxMessage';
import { PostModel } from './models/Post';

async function runVerification() {
  console.log('🧪 Starting Phase 1 API Verification for emous...');
  const { mode } = await connectDatabase();
  const app = createApp();
  const server = app.listen(0);
  const address = server.address();
  const port = typeof address === 'object' && address ? address.port : 4099;
  const baseUrl = `http://127.0.0.1:${port}/api/v1`;

  try {
    // 1. Health Check
    const healthRes = await fetch(`${baseUrl}/health`);
    const health = await healthRes.json();
    assert.strictEqual(health.status, 'ok');
    assert.strictEqual(health.brand, 'emous');
    console.log(`✅ 1. Health check passed (${health.brand} / ${health.domain} — mode: ${mode})`);

    // 2. Zero-Friction Identity Init
    const initRes = await fetch(`${baseUrl}/identity/init`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ deviceId: 'test-fingerprint-001' }),
    });
    const identity = await initRes.json();
    assert.ok(identity.handle, 'Expected auto-generated handle');
    assert.ok(identity.inboxLink.includes(`emous.app/ask/${identity.handle}`));
    console.log(
      `✅ 2. Zero-Friction Identity assigned: @${identity.handle} (${identity.inboxLink})`
    );

    // Verify idempotency (same deviceId returns same handle)
    const initRes2 = await fetch(`${baseUrl}/identity/init`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ deviceId: 'test-fingerprint-001' }),
    });
    const identity2 = await initRes2.json();
    assert.strictEqual(identity.handle, identity2.handle);

    // 3. Card Shuffler Endpoint
    const shuffleRes = await fetch(`${baseUrl}/backgrounds/shuffle`);
    const shuffleData = await shuffleRes.json();
    assert.ok(shuffleData.background?.id);
    console.log(
      `✅ 3. 🎲 Card Shuffler returned: ${shuffleData.background.name} (${shuffleData.background.type})`
    );

    // 4. Create Visual Post with GPS coordinates + Global & Near Me ($near 5-mile radius)
    const createPostRes = await fetch(`${baseUrl}/posts`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-device-id': 'test-fingerprint-001',
      },
      body: JSON.stringify({
        content: 'Testing hyperlocal 5-mile confession from downtown! 🔥',
        tag: '#WorkConfessions',
        lat: 40.7128,
        lng: -74.006,
      }),
    });
    const createdPostData = await createPostRes.json();
    const createdPostId = createdPostData.post._id;
    assert.ok(createdPostId);

    // Query Near Me within 5 miles of (40.7128, -74.006)
    const nearRes = await fetch(
      `${baseUrl}/posts?mode=near&lat=40.7128&lng=-74.006&radiusMiles=5`
    );
    const nearData = await nearRes.json();
    assert.ok(nearData.posts.length >= 1, 'Expected nearby posts within 5 miles');
    console.log(
      `✅ 4. Geospatial Near Me (5-mile radius) returned ${nearData.posts.length} nearby posts.`
    );

    // Query Near Me from far away (Los Angeles: 34.0522, -118.2437) -> should return 0 NYC posts
    const farRes = await fetch(
      `${baseUrl}/posts?mode=near&lat=34.0522&lng=-118.2437&radiusMiles=5`
    );
    const farData = await farRes.json();
    assert.strictEqual(farData.posts.length, 0, 'Expected 0 posts 2,400 miles away');
    console.log(
      '✅ 5. Geospatial 5-mile radius filter excluded out-of-radius posts (0 posts in LA).'
    );

    // 6. Crowdsourced Moderation: 3 user flags -> Auto-Hide
    for (let i = 1; i <= 3; i++) {
      const flagRes = await fetch(`${baseUrl}/posts/${createdPostId}/flag`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ deviceId: `flagger-user-${i}` }),
      });
      const flagJson = await flagRes.json();
      if (i < 3) {
        assert.strictEqual(flagJson.isHidden, false);
      } else {
        assert.strictEqual(flagJson.isHidden, true);
      }
    }

    // Verify hidden post no longer appears in feed
    const afterFlagRes = await fetch(`${baseUrl}/posts?mode=global`);
    const afterFlagData = await afterFlagRes.json();
    const stillVisible = afterFlagData.posts.some(
      (p: any) => p._id === createdPostId
    );
    assert.strictEqual(
      stillVisible,
      false,
      'Post with 3 flags must be hidden from feed'
    );
    console.log('✅ 6. Crowdsourced Moderation: Post auto-hidden after 3 flags.');

    // 7. Viral Anonymous Inbox (Send -> Fetch -> Reply -> 30-day TTL Auto-Burn Check)
    const sendInboxRes = await fetch(`${baseUrl}/inbox/GoldenWizard`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        question: 'Who is your secret crush at the studio? 👀',
        themeId: 'story-pink-lime',
      }),
    });
    const sendInboxData = await sendInboxRes.json();
    assert.strictEqual(sendInboxData.success, true);
    const msgId = sendInboxData.item._id;

    // Reply for 9:16 Story Share
    const replyRes = await fetch(`${baseUrl}/inbox/${msgId}/reply`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        reply: 'Never telling 🤫🔥',
        themeId: 'story-yellow-pink',
      }),
    });
    const replyData = await replyRes.json();
    assert.strictEqual(replyData.message.reply, 'Never telling 🤫🔥');
    assert.strictEqual(replyData.message.isRead, true);

    // Check Mongoose Schema Indexes & 30-day Auto-Burn TTL
    const postIndexes = PostModel.schema.indexes();
    const has2dsphere = postIndexes.some(
      ([fields]) => (fields as any).location === '2dsphere'
    );
    assert.ok(has2dsphere, 'Post schema must define 2dsphere index on location');

    const inboxIndexes = InboxMessageModel.schema.indexes();
    const hasTtlIndex = inboxIndexes.some(
      ([, options]) => (options as any).expireAfterSeconds === 2592000
    );
    assert.ok(
      hasTtlIndex,
      'InboxMessage schema must define 30-day TTL index (2,592,000s)'
    );

    if (!isUsingMongo()) {
      // Also test local engine 30-day auto-burn sweep
      localStore.inbox.push({
        _id: 'expired-msg-31-days',
        recipientHandle: 'GoldenWizard',
        recipientHandleLower: 'goldenwizard',
        question: 'Expired 31 days ago',
        themeId: 'story-pink-lime',
        isRead: false,
        flagsCount: 0,
        flaggedBy: [],
        isHidden: false,
        createdAt: new Date(Date.now() - 31 * 24 * 60 * 60 * 1000).toISOString(),
        updatedAt: new Date().toISOString(),
      });
      purgeExpiredInboxMessages();
      const expiredFound = localStore.inbox.some(
        (m) => m._id === 'expired-msg-31-days'
      );
      assert.strictEqual(
        expiredFound,
        false,
        'Messages older than 30 days must be auto-burned'
      );
    }

    console.log(
      '✅ 7. Viral Inbox, 2dsphere schema index, and 30-day Auto-Burn TTL (2,592,000s) verified!'
    );

    console.log('\n🎉 ALL PHASE 1 BACKEND API CHECKS PASSED!');
  } finally {
    server.close();
    await disconnectDatabase();
  }
}

runVerification().catch((err) => {
  console.error('❌ Verification failed:', err);
  process.exit(1);
});
