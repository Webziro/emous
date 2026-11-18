import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  SafeAreaView,
  StyleSheet,
  Text,
  View,
  TouchableOpacity,
  ScrollView,
  TextInput,
  Modal,
  ImageBackground,
  Share,
  Alert,
  ActivityIndicator,
  Platform,
  Animated,
  Easing,
} from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { LinearGradient } from 'expo-linear-gradient';
import * as Clipboard from 'expo-clipboard';
import * as Location from 'expo-location';
import * as Sharing from 'expo-sharing';
import ViewShot, { captureRef } from 'react-native-view-shot';
import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  BRAND,
  COLORS,
  CardBackground,
  CURATED_GRADIENTS,
  InboxMessageDTO,
  POPULAR_TAGS,
  PostDTO,
  REACTION_META,
  REACTION_TYPES,
  ReactionType,
  STORY_COLOR_PAIRS,
  UserIdentityDTO,
} from '../shared';
import {
  createMobilePost,
  fetchMobileInbox,
  fetchMobilePosts,
  flagMobilePost,
  initMobileIdentity,
  reactMobilePost,
  saveMobileInboxReply,
  shuffleMobileBackground,
} from './src/api';

const DEVICE_ID_STORAGE_KEY = '@emous_device_id_v1';
const HANDLE_STORAGE_KEY = '@emous_handle_v1';

export default function App() {
  // Navigation Tab ('feed' | 'inbox')
  const [activeTab, setActiveTab] = useState<'feed' | 'inbox'>('feed');

  // Zero-Friction Identity
  const [identity, setIdentity] = useState<UserIdentityDTO | null>(null);
  const [useDemoGoldenWizard, setUseDemoGoldenWizard] = useState(false);

  // Screen 1: Feed State
  const [feedMode, setFeedMode] = useState<'global' | 'near'>('global');
  const [selectedTag, setSelectedTag] = useState<string>('All');
  const [posts, setPosts] = useState<PostDTO[]>([]);
  const [loadingFeed, setLoadingFeed] = useState(true);
  const [coords, setCoords] = useState<{ lat: number; lng: number }>({
    lat: 40.7128,
    lng: -74.006,
  });

  // Composer Modal + 🎲 Card Shuffler
  const [composerVisible, setComposerVisible] = useState(false);
  const [draftText, setDraftText] = useState('');
  const [draftTag, setDraftTag] = useState<string>(POPULAR_TAGS[0]);
  const [draftBg, setDraftBg] = useState<CardBackground>(CURATED_GRADIENTS[0]);

  // Screen 2 & 4: Inbox + 9:16 Story Share Generator
  const [inboxMessages, setInboxMessages] = useState<InboxMessageDTO[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [copiedBanner, setCopiedBanner] = useState(false);
  const [activeStoryItem, setActiveStoryItem] =
    useState<InboxMessageDTO | null>(null);
  const [replyDraft, setReplyDraft] = useState('');
  const [storyThemeId, setStoryThemeId] = useState<string>('story-pink-lime');
  const storyViewShotRef = useRef<View>(null);

  // Continuous Tag Ticker Animation & Expanded Action Pill state for Mobile
  const marqueeAnim = useRef(new Animated.Value(0)).current;
  const [activeActionKey, setActiveActionKey] = useState<string | null>(null);

  useEffect(() => {
    const loop = Animated.loop(
      Animated.timing(marqueeAnim, {
        toValue: -680,
        duration: 18000,
        easing: Easing.linear,
        useNativeDriver: true,
      })
    );
    loop.start();
    return () => loop.stop();
  }, [marqueeAnim]);

  const currentHandle = useDemoGoldenWizard
    ? 'GoldenWizard'
    : identity?.handle || 'GoldenWizard';

  // Initialize Zero-Friction Identity from AsyncStorage + Unified API
  useEffect(() => {
    (async () => {
      const savedDeviceId =
        (await AsyncStorage.getItem(DEVICE_ID_STORAGE_KEY)) || undefined;
      const savedHandle =
        (await AsyncStorage.getItem(HANDLE_STORAGE_KEY)) || undefined;
      const user = await initMobileIdentity(savedDeviceId, savedHandle);
      await AsyncStorage.setItem(DEVICE_ID_STORAGE_KEY, user.deviceId);
      await AsyncStorage.setItem(HANDLE_STORAGE_KEY, user.handle);
      setIdentity(user);
    })();
  }, []);

  // Load Feed
  const loadFeed = useCallback(async () => {
    setLoadingFeed(true);
    try {
      const list = await fetchMobilePosts({
        mode: feedMode,
        tag: selectedTag,
        lat: coords.lat,
        lng: coords.lng,
      });
      setPosts(list);
    } catch {
      // Keep existing state if offline
    } finally {
      setLoadingFeed(false);
    }
  }, [feedMode, selectedTag, coords]);

  useEffect(() => {
    loadFeed();
  }, [loadFeed]);

  // Load Inbox
  const loadInbox = useCallback(async () => {
    try {
      const res = await fetchMobileInbox(currentHandle);
      setInboxMessages(res.messages);
      setUnreadCount(res.unreadCount);
    } catch {
      // Offline fallback
    }
  }, [currentHandle]);

  useEffect(() => {
    loadInbox();
  }, [loadInbox]);

  // Toggle "Near Me" (requests 5-mile radius GPS via expo-location)
  const handleToggleNearMe = async () => {
    setFeedMode('near');
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status === 'granted') {
        const loc = await Location.getCurrentPositionAsync({});
        setCoords({
          lat: loc.coords.latitude,
          lng: loc.coords.longitude,
        });
      }
    } catch {
      // Uses default downtown coordinates if simulator doesn't provide GPS
    }
  };

  // 🎲 Card Shuffler
  const handleDiceShuffle = async () => {
    const nextBg = await shuffleMobileBackground(draftBg.id);
    setDraftBg(nextBg);
  };

  // Publish Visual Card Post
  const handlePublishPost = async () => {
    if (!draftText.trim()) return;
    try {
      const created = await createMobilePost({
        content: draftText.trim(),
        tag: draftTag,
        background: draftBg,
        authorHandle: currentHandle,
        lat: coords.lat,
        lng: coords.lng,
      });
      setPosts((prev) => [created, ...prev]);
      setDraftText('');
      setComposerVisible(false);
    } catch {
      Alert.alert('Error', 'Could not publish confession card.');
    }
  };

  // Flag / Report Post (3 flags = Auto-Hide)
  const handleReportPost = async (postId: string) => {
    try {
      const res = await flagMobilePost(postId);
      if (res.isHidden) {
        setPosts((prev) => prev.filter((p) => p._id !== postId));
        Alert.alert(
          'Auto-Hidden 🛡️',
          'This post reached 3 community flags and has been removed from view.'
        );
      } else {
        setPosts((prev) =>
          prev.map((p) =>
            p._id === postId ? { ...p, flagsCount: res.flagsCount } : p
          )
        );
        Alert.alert(
          'Reported 🚩',
          `Flag recorded (${res.flagsCount}/3 flags to auto-hide).`
        );
      }
    } catch {
      Alert.alert('Error', 'Failed to report post.');
    }
  };

  // Screen 2: Copy Inbox Link with 1 tap
  const handleCopyInboxLink = async () => {
    const url = `https://${BRAND.domain}/ask/${currentHandle}`;
    await Clipboard.setStringAsync(url);
    setCopiedBanner(true);
    setTimeout(() => setCopiedBanner(false), 2500);
  };

  // Screen 4: Capture 9:16 Story Card & Share to IG/Snapchat Stories
  const handleExportAndShareStory = async () => {
    if (!activeStoryItem) return;
    const finalReply = replyDraft.trim() || '🤫🔥';

    try {
      const updated = await saveMobileInboxReply(
        activeStoryItem._id,
        finalReply,
        storyThemeId
      );
      setInboxMessages((prev) =>
        prev.map((m) => (m._id === updated._id ? updated : m))
      );

      if (storyViewShotRef.current) {
        const uri = await captureRef(storyViewShotRef, {
          format: 'png',
          quality: 1,
          width: 1080,
          height: 1920,
        });
        const canShare = await Sharing.isAvailableAsync();
        if (canShare) {
          await Sharing.shareAsync(uri, {
            mimeType: 'image/png',
            dialogTitle: 'Share 9:16 Story Reply to Instagram or Snapchat',
          });
          return;
        }
      }

      await Share.share({
        message: `Q: "${activeStoryItem.question}"\nA: "${finalReply}"\nAsk me anonymously: https://${BRAND.domain}/ask/${currentHandle}`,
      });
    } catch {
      Alert.alert('Saved!', 'Reply saved to your 9:16 Story Card.');
    }
  };

  const activeStoryPair =
    STORY_COLOR_PAIRS.find((t) => t.id === storyThemeId) ||
    STORY_COLOR_PAIRS[0];

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar style="light" />

      {/* ===================================================================
          TOP STREETWEAR BRAND HEADER & DUAL SCREEN NAVIGATION
         =================================================================== */}
      <View style={styles.header}>
        <View style={styles.brandBadge}>
          <Text style={styles.brandLogoText}>emous</Text>
          <View style={styles.handlePill}>
            <Text style={styles.handlePillText}>@{currentHandle}</Text>
          </View>
        </View>

        <View style={styles.navTabs}>
          <TouchableOpacity
            onPress={() => setActiveTab('feed')}
            style={[
              styles.navTabBtn,
              activeTab === 'feed' && styles.navTabActivePink,
            ]}
          >
            <Text
              style={[
                styles.navTabText,
                activeTab === 'feed' && { color: '#FFFFFF' },
              ]}
            >
              🔥 Feed
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            onPress={() => setActiveTab('inbox')}
            style={[
              styles.navTabBtn,
              activeTab === 'inbox' && styles.navTabActiveLime,
            ]}
          >
            <Text
              style={[
                styles.navTabText,
                activeTab === 'inbox' && { color: COLORS.textDark },
              ]}
            >
              🤫 Inbox {unreadCount > 0 ? `(${unreadCount})` : ''}
            </Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* ===================================================================
          SCREEN 1: THE APP HOME FEED (GLOBAL TAGS & 5-MILE NEAR ME)
         =================================================================== */}
      {activeTab === 'feed' && (
        <View style={{ flex: 1 }}>
          {/* Dual-Feed Toggle Switch ("Global Tags" vs "Near Me") */}
          <View style={styles.feedToggleContainer}>
            <TouchableOpacity
              onPress={() => setFeedMode('global')}
              style={[
                styles.feedToggleBtn,
                feedMode === 'global' && styles.feedToggleActiveLime,
              ]}
            >
              <Text
                style={[
                  styles.feedToggleText,
                  feedMode === 'global' && { color: COLORS.textDark },
                ]}
              >
                🌐 GLOBAL TAGS
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              onPress={handleToggleNearMe}
              style={[
                styles.feedToggleBtn,
                feedMode === 'near' && styles.feedToggleActivePink,
              ]}
            >
              <Text
                style={[
                  styles.feedToggleText,
                  feedMode === 'near' && { color: '#FFFFFF' },
                ]}
              >
                📍 NEAR ME (5 MI)
              </Text>
            </TouchableOpacity>
          </View>

          {/* Auto-Scrolling Streetwear Hashtag Filter Ticker */}
          <View style={{ height: 48, marginBottom: 8, overflow: 'hidden' }}>
            <Animated.View
              style={[
                styles.tagScroll,
                { transform: [{ translateX: marqueeAnim }] },
              ]}
            >
              {[...['All', ...POPULAR_TAGS], ...['All', ...POPULAR_TAGS]].map(
                (tag, idx) => {
                  const isSelected = selectedTag === tag;
                  return (
                    <TouchableOpacity
                      key={`${tag}-${idx}`}
                      onPress={() => setSelectedTag(tag)}
                      style={[
                        styles.tagFilterPill,
                        isSelected && { backgroundColor: COLORS.accentYellow },
                      ]}
                    >
                      <Text
                        style={[
                          styles.tagFilterText,
                          isSelected && { color: COLORS.textDark },
                        ]}
                      >
                        {tag}
                      </Text>
                    </TouchableOpacity>
                  );
                }
              )}
            </Animated.View>
          </View>

          {/* Scrollable Visual Feed Cards */}
          {loadingFeed ? (
            <View style={styles.centerBox}>
              <ActivityIndicator size="large" color={COLORS.accentLime} />
            </View>
          ) : (
            <ScrollView contentContainerStyle={styles.feedList}>
              {posts.map((post) => {
                const isImg = post.background?.type === 'image';
                const colors = (post.background?.colors || [
                  '#FF1E8E',
                  '#7928CA',
                ]) as [string, string, ...string[]];

                const CardInner = (
                  <View style={styles.visualCardContent}>
                    <View style={styles.cardTopRow}>
                      <View style={styles.authorBadge}>
                        <Text style={styles.authorBadgeText}>
                          🎭 @{post.authorHandle}
                        </Text>
                      </View>
                      <View style={styles.timestampBadge}>
                        <Text style={styles.timestampText}>
                          {post.distanceMiles !== undefined
                            ? `📍 ${post.distanceMiles} mi`
                            : post.location?.label || 'LIVE'}
                        </Text>
                      </View>
                    </View>

                    <Text
                      style={[
                        styles.postBodyText,
                        {
                          color: isImg
                            ? '#FFFFFF'
                            : post.background?.textColor || '#FFFFFF',
                        },
                      ]}
                    >
                      “{post.content}”
                    </Text>

                    {/* Phase 4: Emoji Reactions Row (🔥, 💀, 👀, ❤️) */}
                    <View
                      style={{
                        flexDirection: 'row',
                        gap: 6,
                        marginBottom: 10,
                        flexWrap: 'wrap',
                      }}
                    >
                      {REACTION_TYPES.map((type: ReactionType) => {
                        const meta = REACTION_META[type];
                        const count = post.reactions?.[type] ?? 0;
                        const active = post.myReactions?.includes(type);
                        return (
                          <TouchableOpacity
                            key={type}
                            onPress={async () => {
                              try {
                                const res = await reactMobilePost(
                                  post._id,
                                  type
                                );
                                setPosts((prev) =>
                                  prev.map((p) =>
                                    p._id === post._id
                                      ? {
                                          ...p,
                                          reactions: res.reactions,
                                          myReactions: res.myReactions,
                                        }
                                      : p
                                  )
                                );
                              } catch {}
                            }}
                            style={[
                              styles.reportFlagBtn,
                              {
                                backgroundColor: active
                                  ? COLORS.accentYellow
                                  : 'rgba(0,0,0,0.8)',
                                paddingHorizontal: 9,
                                paddingVertical: 4,
                              },
                            ]}
                          >
                            <Text
                              style={[
                                styles.reportFlagText,
                                { color: active ? '#0D0D11' : '#FFFFFF' },
                              ]}
                            >
                              {meta.emoji} {count}
                            </Text>
                          </TouchableOpacity>
                        );
                      })}
                    </View>

                    <View style={styles.cardBottomRow}>
                      {/* Icon-only Tag Pill (expands label on press/hover) */}
                      <TouchableOpacity
                        onPress={() => {
                          const key = `tag-${post._id}`;
                          setActiveActionKey((prev) =>
                            prev === key ? null : key
                          );
                          setSelectedTag(post.tag);
                        }}
                        style={[
                          styles.solidTagBadge,
                          {
                            backgroundColor:
                              post.background?.badgeBg || COLORS.accentLime,
                          },
                        ]}
                      >
                        <Text
                          style={[
                            styles.solidTagText,
                            {
                              color:
                                post.background?.badgeText || COLORS.textDark,
                            },
                          ]}
                        >
                          #
                          {activeActionKey === `tag-${post._id}`
                            ? ` ${post.tag.replace(/^#/, '')}`
                            : ''}
                        </Text>
                      </TouchableOpacity>

                      <View style={{ flexDirection: 'row', gap: 8 }}>
                        {/* Icon-only Ask Secret Pill */}
                        <TouchableOpacity
                          onPress={() => {
                            const key = `ask-${post._id}`;
                            if (activeActionKey !== key) {
                              setActiveActionKey(key);
                            } else {
                              setActiveTab('inbox');
                            }
                          }}
                          style={[
                            styles.reportFlagBtn,
                            { backgroundColor: '#FFFFFF' },
                          ]}
                        >
                          <Text
                            style={[styles.reportFlagText, { color: '#0D0D11' }]}
                          >
                            💬
                            {activeActionKey === `ask-${post._id}`
                              ? ' Ask Secret'
                              : ''}
                          </Text>
                        </TouchableOpacity>

                        {/* Icon-only Report Flag Pill */}
                        <TouchableOpacity
                          onPress={() => {
                            const key = `flag-${post._id}`;
                            setActiveActionKey(key);
                            handleReportPost(post._id);
                          }}
                          style={styles.reportFlagBtn}
                        >
                          <Text style={styles.reportFlagText}>
                            🚩
                            {activeActionKey === `flag-${post._id}` ||
                            post.flagsCount > 0
                              ? ` ${
                                  post.flagsCount > 0
                                    ? `Report (${post.flagsCount}/3)`
                                    : 'Report'
                                }`
                              : ''}
                          </Text>
                        </TouchableOpacity>
                      </View>
                    </View>
                  </View>
                );

                return (
                  <View key={post._id} style={styles.visualCardWrapper}>
                    {isImg ? (
                      <ImageBackground
                        source={{ uri: post.background.value }}
                        style={styles.visualCardBg}
                        imageStyle={{ borderRadius: 22 }}
                      >
                        <View style={styles.imageDarkOverlay}>{CardInner}</View>
                      </ImageBackground>
                    ) : (
                      <LinearGradient
                        colors={colors}
                        start={{ x: 0, y: 0 }}
                        end={{ x: 1, y: 1 }}
                        style={styles.visualCardBg}
                      >
                        {CardInner}
                      </LinearGradient>
                    )}
                  </View>
                );
              })}
            </ScrollView>
          )}

          {/* Floating Neon Pink '+' Post Composer CTA */}
          <TouchableOpacity
            onPress={() => setComposerVisible(true)}
            style={styles.fabButton}
          >
            <Text style={styles.fabButtonText}>+ DROP CARD</Text>
          </TouchableOpacity>
        </View>
      )}

      {/* ===================================================================
          SCREEN 2: "GET YOUR LINK" DASHBOARD & SECRET NOTES INBOX
         =================================================================== */}
      {activeTab === 'inbox' && (
        <ScrollView contentContainerStyle={styles.inboxContainer}>
          {/* Bright Streetwear Hook Banner */}
          <View style={styles.inboxHookBanner}>
            <Text style={styles.inboxHookKicker}>
              VIRAL WEB-TO-MOBILE LOOP • AUTO-BURNS IN 30 DAYS
            </Text>
            <Text style={styles.inboxHookTitle}>{BRAND.inboxHook}</Text>

            <View style={styles.linkDisplayBox}>
              <Text style={styles.linkDisplayText} numberOfLines={1}>
                {BRAND.domain}/ask/{currentHandle}
              </Text>
            </View>

            <TouchableOpacity
              onPress={handleCopyInboxLink}
              style={styles.copyGiantButton}
            >
              <Text style={styles.copyGiantButtonText}>
                {copiedBanner
                  ? '✅ LINK COPIED TO CLIPBOARD!'
                  : '🔗 COPY MY INBOX LINK'}
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              onPress={() => setUseDemoGoldenWizard((prev) => !prev)}
              style={styles.switchDemoBtn}
            >
              <Text style={styles.switchDemoBtnText}>
                {useDemoGoldenWizard
                  ? 'Switch Back to My Auto-Handle'
                  : '🧙‍♂️ Preview @GoldenWizard Demo Inbox'}
              </Text>
            </TouchableOpacity>
          </View>

          <Text style={styles.sectionHeaderTitle}>
            🕵️ SECRET NOTES ({inboxMessages.length})
          </Text>

          {inboxMessages.map((msg) => {
            const pair =
              STORY_COLOR_PAIRS.find((t) => t.id === msg.themeId) ||
              STORY_COLOR_PAIRS[0];
            return (
              <View key={msg._id} style={styles.secretNoteCard}>
                <View style={styles.secretNoteHeader}>
                  <View
                    style={[
                      styles.unreadBadge,
                      {
                        backgroundColor: msg.isRead
                          ? COLORS.accentYellow
                          : COLORS.accentPink,
                      },
                    ]}
                  >
                    <Text
                      style={[
                        styles.unreadBadgeText,
                        { color: msg.isRead ? '#0D0D11' : '#FFFFFF' },
                      ]}
                    >
                      {msg.isRead ? 'OPENED NOTE' : '🔥 NEW SECRET'}
                    </Text>
                  </View>
                  <Text style={styles.burnTimerText}>🔥 30d Auto-Burn</Text>
                </View>

                <View
                  style={[
                    styles.questionHighlightBox,
                    { backgroundColor: pair.topCardBg },
                  ]}
                >
                  <Text
                    style={[
                      styles.questionHighlightText,
                      { color: pair.topCardText },
                    ]}
                  >
                    “{msg.question}”
                  </Text>
                </View>

                {msg.reply ? (
                  <View
                    style={[
                      styles.replyPreviewBox,
                      { backgroundColor: pair.bottomCardBg },
                    ]}
                  >
                    <Text
                      style={[
                        styles.replyPreviewText,
                        { color: pair.bottomCardText },
                      ]}
                    >
                      Reply: {msg.reply}
                    </Text>
                  </View>
                ) : null}

                <TouchableOpacity
                  onPress={() => {
                    setActiveStoryItem(msg);
                    setReplyDraft(msg.reply || '');
                    setStoryThemeId(msg.themeId || 'story-pink-lime');
                  }}
                  style={styles.shareReplyBtn}
                >
                  <Text style={styles.shareReplyBtnText}>
                    📸 {msg.reply ? 'SHARE 9:16 STORY CARD' : 'REPLY & SHARE STORY'}
                  </Text>
                </TouchableOpacity>
              </View>
            );
          })}
        </ScrollView>
      )}

      {/* ===================================================================
          MODAL: VISUAL POST COMPOSER WITH 🎲 CARD SHUFFLER
         =================================================================== */}
      <Modal visible={composerVisible} animationType="slide" transparent>
        <View style={styles.modalBackdrop}>
          <View style={styles.modalSheet}>
            <View style={styles.modalTopRow}>
              <Text style={styles.modalHeaderTitle}>NEW CONFESSION CARD</Text>
              <TouchableOpacity onPress={() => setComposerVisible(false)}>
                <Text style={styles.closeBtnText}>✕</Text>
              </TouchableOpacity>
            </View>

            <LinearGradient
              colors={
                (draftBg.colors || ['#FF1E8E', '#7928CA']) as [
                  string,
                  string,
                  ...string[]
                ]
              }
              style={styles.composerPreviewCard}
            >
              <View style={styles.cardTopRow}>
                <Text style={styles.authorBadgeText}>🎭 @{currentHandle}</Text>
                <TouchableOpacity
                  onPress={handleDiceShuffle}
                  style={styles.diceShufflerBtn}
                >
                  <Text style={styles.diceShufflerText}>
                    🎲 Shuffle ({draftBg.name})
                  </Text>
                </TouchableOpacity>
              </View>

              <TextInput
                value={draftText}
                onChangeText={(t) => setDraftText(t.slice(0, 300))}
                placeholder="Type your 300-char confession..."
                placeholderTextColor="rgba(255,255,255,0.65)"
                multiline
                style={[
                  styles.composerInput,
                  { color: draftBg.textColor || '#FFFFFF' },
                ]}
              />

              <Text style={styles.charCountText}>{draftText.length}/300</Text>
            </LinearGradient>

            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              style={{ marginVertical: 12 }}
            >
              {POPULAR_TAGS.map((tag) => (
                <TouchableOpacity
                  key={tag}
                  onPress={() => setDraftTag(tag)}
                  style={[
                    styles.tagFilterPill,
                    draftTag === tag && { backgroundColor: COLORS.accentPink },
                  ]}
                >
                  <Text style={styles.tagFilterText}>{tag}</Text>
                </TouchableOpacity>
              ))}
            </ScrollView>

            <TouchableOpacity
              onPress={handlePublishPost}
              style={styles.publishCtaBtn}
            >
              <Text style={styles.publishCtaText}>DROP VISUAL CARD 🚀</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* ===================================================================
          SCREEN 4: 9:16 INSTAGRAM / SNAPCHAT STORY SHARE GENERATOR MODAL
         =================================================================== */}
      <Modal
        visible={Boolean(activeStoryItem)}
        animationType="slide"
        transparent
      >
        <View style={styles.modalBackdrop}>
          <View style={styles.modalSheet}>
            <View style={styles.modalTopRow}>
              <Text style={styles.modalHeaderTitle}>
                9:16 STORY SHARE GENERATOR
              </Text>
              <TouchableOpacity onPress={() => setActiveStoryItem(null)}>
                <Text style={styles.closeBtnText}>✕</Text>
              </TouchableOpacity>
            </View>

            {/* 9:16 Proportioned Vertical Story Canvas */}
            <ViewShot
              ref={storyViewShotRef}
              options={{ format: 'png', quality: 1 }}
              style={[
                styles.storyCanvas9x16,
                { backgroundColor: activeStoryPair.canvasBg },
              ]}
            >
              <View style={styles.storyTopHandleBadge}>
                <Text style={styles.storyTopHandleText}>
                  ASK @{currentHandle.toUpperCase()}
                </Text>
              </View>

              {/* Top Card: Vibrant Box with Anonymous Question */}
              <View
                style={[
                  styles.storyQuestionBox,
                  { backgroundColor: activeStoryPair.topCardBg },
                ]}
              >
                <Text style={styles.storyBoxKicker}>
                  🤫 ANONYMOUS CONFESSION
                </Text>
                <Text
                  style={[
                    styles.storyBoxMainText,
                    { color: activeStoryPair.topCardText },
                  ]}
                >
                  “{activeStoryItem?.question}”
                </Text>
              </View>

              {/* Bottom Card: Contrasting Box with User's Typed Response */}
              <View
                style={[
                  styles.storyReplyBox,
                  { backgroundColor: activeStoryPair.bottomCardBg },
                ]}
              >
                <Text style={styles.storyBoxKicker}>
                  ⚡ @{currentHandle.toUpperCase()} REPLIED
                </Text>
                <Text
                  style={[
                    styles.storyBoxMainText,
                    { color: activeStoryPair.bottomCardText },
                  ]}
                >
                  {replyDraft.trim() || 'Type your comeback below... 👀'}
                </Text>
              </View>

              {/* Subtle but Clear Watermark at Bottom */}
              <View style={styles.storyWatermarkPill}>
                <Text style={styles.storyWatermarkText}>
                  {BRAND.domain}/ask/{currentHandle}
                </Text>
              </View>
            </ViewShot>

            <TextInput
              value={replyDraft}
              onChangeText={(t) => setReplyDraft(t.slice(0, 300))}
              placeholder="Type your response for the bottom card..."
              placeholderTextColor="#9CA3AF"
              style={styles.storyReplyInput}
            />

            <TouchableOpacity
              onPress={handleExportAndShareStory}
              style={styles.storyShareActionBtn}
            >
              <Text style={styles.storyShareActionText}>
                📸 SHARE TO IG / SNAPCHAT STORY
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.bgPrimary,
    paddingTop: Platform.OS === 'android' ? 28 : 0,
  },
  header: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 3,
    borderBottomColor: '#000',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: COLORS.bgSurface,
  },
  brandBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  brandLogoText: {
    backgroundColor: COLORS.accentLime,
    color: COLORS.textDark,
    fontWeight: '900',
    fontSize: 22,
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: '#000',
    overflow: 'hidden',
  },
  handlePill: {
    backgroundColor: '#000',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
  },
  handlePillText: {
    color: COLORS.accentYellow,
    fontSize: 11,
    fontWeight: '800',
  },
  navTabs: {
    flexDirection: 'row',
    gap: 8,
  },
  navTabBtn: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: '#000',
    backgroundColor: '#0D0D11',
  },
  navTabActivePink: {
    backgroundColor: COLORS.accentPink,
  },
  navTabActiveLime: {
    backgroundColor: COLORS.accentLime,
  },
  navTabText: {
    color: '#D1D5DB',
    fontWeight: '900',
    fontSize: 12,
  },
  feedToggleContainer: {
    flexDirection: 'row',
    margin: 14,
    backgroundColor: COLORS.bgSurface,
    borderRadius: 16,
    padding: 4,
    borderWidth: 2,
    borderColor: '#000',
  },
  feedToggleBtn: {
    flex: 1,
    paddingVertical: 10,
    alignItems: 'center',
    borderRadius: 12,
  },
  feedToggleActiveLime: {
    backgroundColor: COLORS.accentLime,
  },
  feedToggleActivePink: {
    backgroundColor: COLORS.accentPink,
  },
  feedToggleText: {
    color: '#9CA3AF',
    fontWeight: '900',
    fontSize: 12,
  },
  tagScroll: {
    paddingHorizontal: 14,
    gap: 8,
    alignItems: 'center',
  },
  tagFilterPill: {
    backgroundColor: COLORS.bgSurface,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 999,
    borderWidth: 2,
    borderColor: '#000',
    marginRight: 8,
  },
  tagFilterText: {
    color: '#FFFFFF',
    fontWeight: '800',
    fontSize: 12,
  },
  centerBox: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  feedList: {
    paddingHorizontal: 14,
    paddingBottom: 100,
    gap: 16,
  },
  visualCardWrapper: {
    borderRadius: 24,
    borderWidth: 3,
    borderColor: '#000',
    overflow: 'hidden',
    marginBottom: 16,
  },
  visualCardBg: {
    minHeight: 230,
    borderRadius: 22,
  },
  imageDarkOverlay: {
    flex: 1,
    backgroundColor: 'rgba(13,13,17,0.52)',
  },
  visualCardContent: {
    flex: 1,
    padding: 18,
    justifyContent: 'space-between',
    minHeight: 230,
  },
  cardTopRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  authorBadge: {
    backgroundColor: 'rgba(0,0,0,0.8)',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 999,
  },
  authorBadgeText: {
    color: '#FFF',
    fontWeight: '800',
    fontSize: 12,
  },
  timestampBadge: {
    backgroundColor: COLORS.accentYellow,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 999,
    borderWidth: 2,
    borderColor: '#000',
  },
  timestampText: {
    color: '#0D0D11',
    fontWeight: '900',
    fontSize: 11,
  },
  postBodyText: {
    fontSize: 16,
    fontWeight: '800',
    lineHeight: 23,
    marginVertical: 14,
  },
  cardBottomRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  solidTagBadge: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 10,
    borderWidth: 2,
    borderColor: '#000',
  },
  solidTagText: {
    fontWeight: '900',
    fontSize: 12,
  },
  reportFlagBtn: {
    backgroundColor: 'rgba(0,0,0,0.82)',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 10,
    borderWidth: 2,
    borderColor: '#000',
  },
  reportFlagText: {
    color: '#FFF',
    fontWeight: '800',
    fontSize: 12,
  },
  fabButton: {
    position: 'absolute',
    bottom: 22,
    right: 18,
    backgroundColor: COLORS.accentPink,
    paddingHorizontal: 20,
    paddingVertical: 14,
    borderRadius: 999,
    borderWidth: 3,
    borderColor: '#000',
    elevation: 6,
  },
  fabButtonText: {
    color: '#FFF',
    fontWeight: '900',
    fontSize: 14,
  },
  inboxContainer: {
    padding: 16,
    paddingBottom: 80,
  },
  inboxHookBanner: {
    backgroundColor: COLORS.accentLime,
    borderRadius: 24,
    padding: 18,
    borderWidth: 3,
    borderColor: '#000',
    marginBottom: 20,
  },
  inboxHookKicker: {
    color: '#0D0D11',
    fontWeight: '900',
    fontSize: 10,
    marginBottom: 4,
  },
  inboxHookTitle: {
    color: '#0D0D11',
    fontWeight: '900',
    fontSize: 22,
    lineHeight: 28,
    marginBottom: 14,
  },
  linkDisplayBox: {
    backgroundColor: '#FFF',
    padding: 12,
    borderRadius: 14,
    borderWidth: 2,
    borderColor: '#000',
    marginBottom: 10,
  },
  linkDisplayText: {
    color: '#0D0D11',
    fontWeight: '900',
    fontSize: 16,
    textAlign: 'center',
  },
  copyGiantButton: {
    backgroundColor: COLORS.accentPink,
    paddingVertical: 14,
    borderRadius: 14,
    borderWidth: 3,
    borderColor: '#000',
    alignItems: 'center',
  },
  copyGiantButtonText: {
    color: '#FFF',
    fontWeight: '900',
    fontSize: 15,
  },
  switchDemoBtn: {
    marginTop: 10,
    alignItems: 'center',
  },
  switchDemoBtnText: {
    color: '#0D0D11',
    fontWeight: '800',
    fontSize: 12,
    textDecorationLine: 'underline',
  },
  sectionHeaderTitle: {
    color: '#FFF',
    fontWeight: '900',
    fontSize: 18,
    marginBottom: 12,
  },
  secretNoteCard: {
    backgroundColor: COLORS.bgSurface,
    borderRadius: 22,
    padding: 16,
    borderWidth: 3,
    borderColor: '#000',
    marginBottom: 14,
  },
  secretNoteHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
  },
  unreadBadge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 999,
    borderWidth: 2,
    borderColor: '#000',
  },
  unreadBadgeText: {
    fontWeight: '900',
    fontSize: 10,
  },
  burnTimerText: {
    color: '#9CA3AF',
    fontSize: 11,
    fontWeight: '700',
  },
  questionHighlightBox: {
    padding: 14,
    borderRadius: 16,
    borderWidth: 2,
    borderColor: '#000',
    marginBottom: 10,
  },
  questionHighlightText: {
    fontWeight: '900',
    fontSize: 17,
  },
  replyPreviewBox: {
    padding: 10,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: '#000',
    marginBottom: 10,
  },
  replyPreviewText: {
    fontWeight: '800',
    fontSize: 13,
  },
  shareReplyBtn: {
    backgroundColor: COLORS.accentLime,
    paddingVertical: 12,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: '#000',
    alignItems: 'center',
  },
  shareReplyBtnText: {
    color: '#0D0D11',
    fontWeight: '900',
    fontSize: 13,
  },
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.85)',
    justifyContent: 'center',
    padding: 16,
  },
  modalSheet: {
    backgroundColor: COLORS.bgSurface,
    borderRadius: 26,
    padding: 18,
    borderWidth: 3,
    borderColor: '#000',
  },
  modalTopRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  modalHeaderTitle: {
    color: COLORS.accentLime,
    fontWeight: '900',
    fontSize: 15,
  },
  closeBtnText: {
    color: '#FFF',
    fontSize: 20,
    fontWeight: '900',
  },
  composerPreviewCard: {
    borderRadius: 20,
    padding: 16,
    minHeight: 190,
    justifyContent: 'space-between',
    borderWidth: 2,
    borderColor: '#000',
  },
  diceShufflerBtn: {
    backgroundColor: COLORS.accentYellow,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 999,
    borderWidth: 2,
    borderColor: '#000',
  },
  diceShufflerText: {
    color: '#0D0D11',
    fontWeight: '900',
    fontSize: 11,
  },
  composerInput: {
    fontSize: 19,
    fontWeight: '800',
    marginVertical: 12,
  },
  charCountText: {
    color: '#FFF',
    fontSize: 11,
    fontWeight: '800',
    alignSelf: 'flex-end',
  },
  publishCtaBtn: {
    backgroundColor: COLORS.accentLime,
    paddingVertical: 14,
    borderRadius: 16,
    borderWidth: 3,
    borderColor: '#000',
    alignItems: 'center',
  },
  publishCtaText: {
    color: '#0D0D11',
    fontWeight: '900',
    fontSize: 16,
  },
  storyCanvas9x16: {
    width: 240,
    height: 426,
    alignSelf: 'center',
    borderRadius: 24,
    padding: 14,
    borderWidth: 3,
    borderColor: '#000',
    justifyContent: 'space-between',
    marginBottom: 14,
  },
  storyTopHandleBadge: {
    backgroundColor: COLORS.accentYellow,
    alignSelf: 'center',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 8,
    borderWidth: 2,
    borderColor: '#000',
  },
  storyTopHandleText: {
    color: '#0D0D11',
    fontWeight: '900',
    fontSize: 10,
  },
  storyQuestionBox: {
    padding: 12,
    borderRadius: 16,
    borderWidth: 2,
    borderColor: '#000',
  },
  storyReplyBox: {
    padding: 12,
    borderRadius: 16,
    borderWidth: 2,
    borderColor: '#000',
  },
  storyBoxKicker: {
    backgroundColor: '#000',
    color: COLORS.accentLime,
    alignSelf: 'flex-start',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
    fontSize: 8,
    fontWeight: '900',
    marginBottom: 6,
  },
  storyBoxMainText: {
    fontWeight: '900',
    fontSize: 14,
    lineHeight: 19,
  },
  storyWatermarkPill: {
    backgroundColor: COLORS.accentPink,
    alignSelf: 'center',
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 999,
    borderWidth: 2,
    borderColor: '#000',
  },
  storyWatermarkText: {
    color: '#FFF',
    fontWeight: '900',
    fontSize: 10,
  },
  storyReplyInput: {
    backgroundColor: '#0D0D11',
    color: '#FFF',
    borderRadius: 14,
    padding: 12,
    borderWidth: 2,
    borderColor: '#374151',
    fontWeight: '700',
    marginBottom: 12,
  },
  storyShareActionBtn: {
    backgroundColor: COLORS.accentPink,
    paddingVertical: 14,
    borderRadius: 16,
    borderWidth: 3,
    borderColor: '#000',
    alignItems: 'center',
  },
  storyShareActionText: {
    color: '#FFF',
    fontWeight: '900',
    fontSize: 14,
  },
});
