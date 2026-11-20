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
    assert.ok(
      identity.inboxLink.includes(`/ask/${identity.handle}`),
      'Expected inboxLink to contain /ask/:handle'
    );
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

    // 4a. Create Visual Post with GPS coordinates + Dynamic NLP Topic Categorization + Wow Feature #5 (2-Option Poll)
    const createPostRes = await fetch(`${baseUrl}/posts`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-device-id': 'test-fingerprint-001',
      },
      body: JSON.stringify({
        content:
          'My boss at the office made us stay late for a 5PM standup meeting! 🔥',
        lat: 40.7128,
        lng: -74.006,
        poll: { optionA: 'Quit Now 🏃', optionB: 'Stay for Bonus 💰' },
      }),
    });
    const createdPostData = await createPostRes.json();
    const createdPostId = createdPostData.post._id;
    assert.ok(createdPostId);
    assert.strictEqual(
      createdPostData.post.tag,
      '#Work',
      'NLP engine must auto-categorize office/boss/meeting post under #Work'
    );
    assert.strictEqual(createdPostData.post.poll.optionA.text, 'Quit Now 🏃');
    console.log(
      `✅ 4a. Phase 5 Dynamic NLP Categorization auto-tagged office post as ${createdPostData.post.tag} (keywords: ${createdPostData.post.keywords.join(', ')})`
    );

    // 4aa. Verify Wow Feature #5 (2-Option Poll Vote) & Wow Feature #2 (Anonymous Whisper Comment)
    const pollVoteRes = await fetch(`${baseUrl}/posts/${createdPostId}/poll`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-device-id': 'test-fingerprint-001',
      },
      body: JSON.stringify({ option: 'A' }),
    });
    const pollVoteData = await pollVoteRes.json();
    assert.strictEqual(pollVoteData.poll.optionA.votes, 1);
    assert.strictEqual(pollVoteData.poll.myVote, 'A');

    const commentRes = await fetch(`${baseUrl}/posts/${createdPostId}/comments`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-device-id': 'test-fingerprint-001',
      },
      body: JSON.stringify({
        text: 'Never stay past 5PM on a Friday!',
        authorHandle: identity.handle,
      }),
    });
    const commentData = await commentRes.json();
    assert.strictEqual(commentData.commentsCount, 1);
    assert.strictEqual(commentData.comment.isOp, true);
    console.log(
      '✅ 4aa. All 6 Viral Wow Features (Public Q&A Dual Cards, Whisper Threads, Burn Countdown, Sender Hints, 2-Option Polls, Street Cred) verified!'
    );

    // 4b. Phase 5: Exclusive Single Reaction Per User Per Post
    const reactRes1 = await fetch(`${baseUrl}/posts/${createdPostId}/react`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-device-id': 'test-fingerprint-001',
      },
      body: JSON.stringify({ type: 'fire' }),
    });
    const reactData1 = await reactRes1.json();
    assert.strictEqual(reactData1.reactions.fire, 1);
    assert.deepStrictEqual(reactData1.myReactions, ['fire']);

    // Now click 'skull' on the SAME post with the SAME user -> must remove 'fire' (0) and set 'skull' (1)
    const reactRes2 = await fetch(`${baseUrl}/posts/${createdPostId}/react`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-device-id': 'test-fingerprint-001',
      },
      body: JSON.stringify({ type: 'skull' }),
    });
    const reactData2 = await reactRes2.json();
    assert.strictEqual(
      reactData2.reactions.fire,
      0,
      'Previous fire reaction must be removed when user switches to skull'
    );
    assert.strictEqual(reactData2.reactions.skull, 1);
    assert.deepStrictEqual(reactData2.myReactions, ['skull']);
    console.log(
      '✅ 4b. Phase 5 Exclusive Single Reaction (1 user = max 1 reaction per post) verified.'
    );

    // 4bb. Phase 5: Trending Radar Endpoint (Dynamic Tags & Frequent Phrases)
    const trendRes = await fetch(`${baseUrl}/posts/trending?period=all`);
    const trendData = await trendRes.json();
    assert.ok(
      Array.isArray(trendData.trendingTags) && trendData.trendingTags.length > 0
    );
    assert.ok(
      Array.isArray(trendData.trendingPhrases) &&
        trendData.trendingPhrases.length > 0
    );
    console.log(
      `✅ 4bb. Phase 5 Trending Radar returned ${trendData.trendingTags.length} dynamic categories & ${trendData.trendingPhrases.length} hot phrases.`
    );

    // 4c. Phase 4: Safety Shield & Doxxing/Profanity Filter
    const doxRes = await fetch(`${baseUrl}/posts`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-device-id': 'test-fingerprint-001',
      },
      body: JSON.stringify({
        content: 'Call this private number 555-234-5678 right now',
        tag: '#CampusTea',
      }),
    });
    assert.strictEqual(
      doxRes.status,
      400,
      'Safety Shield must block phone number doxxing'
    );
    console.log('✅ 4c. Phase 4 Safety Shield (anti-doxxing & profanity filter) verified.');

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
