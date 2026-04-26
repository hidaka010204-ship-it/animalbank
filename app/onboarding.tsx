import { LinearGradient } from 'expo-linear-gradient';
import { useRouter } from 'expo-router';
import { useState } from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { storage, STORAGE_KEYS } from '../lib/storage';

const SLIDES = [
  {
    emoji: '🐾',
    gradColors: ['#2D7A77', '#4FA3A0', '#A8D8CF'] as [string, string, string],
    accentColor: '#A8D8CF',
    tag: 'DISCOVER',
    title: '保護動物を\n見つけよう',
    desc: '全国の保護動物・迷子情報を一覧で確認できます。あなたの近くで待っている子を探してみましょう。',
    features: ['📋 全国の動物情報を一覧表示', '🔍 種類・地域で絞り込み検索', '❤️ お気に入りに保存'],
  },
  {
    emoji: '🏠',
    gradColors: ['#3D8B85', '#5BB5B0', '#B8E2DC'] as [string, string, string],
    accentColor: '#5BB5B0',
    tag: 'ADOPT',
    title: '里親に\nなろう',
    desc: '気になった動物に里親申請ができます。登録者と直接つながり、新しい家族を迎えませんか？',
    features: ['📝 かんたん里親申請', '💬 登録者と直接連絡', '🔔 申請状況をプッシュ通知'],
  },
  {
    emoji: '📢',
    gradColors: ['#C05050', '#F08080', '#F5A8A8'] as [string, string, string],
    accentColor: '#F08080',
    tag: 'SHARE',
    title: '情報を\nシェアしよう',
    desc: '迷子・保護情報をタイムラインに投稿して共有。地域のみんなで力を合わせて動物を守りましょう。',
    features: ['📸 写真付きで投稿', '📍 位置情報でお知らせ', '🤝 地域コミュニティと連携'],
  },
];

export default function OnboardingScreen() {
  const router = useRouter();
  const [currentPage, setCurrentPage] = useState(0);

  const slide = SLIDES[currentPage];
  const isLast = currentPage === SLIDES.length - 1;

  const goNext = () => setCurrentPage(p => p + 1);

  const finish = async () => {
    try { await storage.setItem(STORAGE_KEYS.ONBOARDED, 'true'); } catch {}
    router.replace('/(tabs)');
  };

  const skip = async () => {
    try { await storage.setItem(STORAGE_KEYS.ONBOARDED, 'true'); } catch {}
    router.replace('/(tabs)');
  };

  return (
    <LinearGradient
      colors={slide.gradColors}
      start={{ x: 0.1, y: 0 }}
      end={{ x: 0.9, y: 1 }}
      style={styles.container}
    >
      {/* 背景デコ */}
      <View style={styles.circle1} />
      <View style={styles.circle2} />

      {/* スキップ */}
      {!isLast && (
        <TouchableOpacity style={styles.skipBtn} onPress={skip}>
          <Text style={styles.skipText}>スキップ</Text>
        </TouchableOpacity>
      )}

      {/* コンテンツ */}
      <View style={styles.content}>
        <View style={styles.tagWrap}>
          <Text style={styles.tagText}>{slide.tag}</Text>
        </View>

        <View style={styles.emojiBubble}>
          <Text style={styles.emoji}>{slide.emoji}</Text>
        </View>

        <Text style={styles.title}>{slide.title}</Text>
        <Text style={styles.desc}>{slide.desc}</Text>

        <View style={styles.featureList}>
          {slide.features.map((f, i) => (
            <View key={i} style={styles.featureItem}>
              <Text style={styles.featureText}>{f}</Text>
            </View>
          ))}
        </View>
      </View>

      {/* フッター */}
      <View style={styles.footer}>
        {/* ドットインジケーター */}
        <View style={styles.dotsRow}>
          {SLIDES.map((_, i) => (
            <View
              key={i}
              style={[
                styles.dot,
                i === currentPage && styles.dotActive,
                i === currentPage && { backgroundColor: slide.accentColor },
              ]}
            />
          ))}
        </View>

        {isLast ? (
          <TouchableOpacity style={styles.primaryBtn} onPress={finish} activeOpacity={0.85}>
            <Text style={styles.primaryBtnText}>はじめる →</Text>
          </TouchableOpacity>
        ) : (
          <TouchableOpacity style={styles.primaryBtn} onPress={goNext} activeOpacity={0.85}>
            <Text style={styles.primaryBtnText}>次へ</Text>
          </TouchableOpacity>
        )}
      </View>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },

  circle1: {
    position: 'absolute', width: 400, height: 400, borderRadius: 200,
    backgroundColor: 'rgba(255,255,255,0.07)', top: -100, right: -80,
  },
  circle2: {
    position: 'absolute', width: 280, height: 280, borderRadius: 140,
    backgroundColor: 'rgba(255,255,255,0.06)', bottom: 80, left: -60,
  },

  skipBtn: {
    position: 'absolute', top: 58, right: 22, zIndex: 10,
    paddingHorizontal: 14, paddingVertical: 7,
    backgroundColor: 'rgba(255,255,255,0.2)', borderRadius: 999,
  },
  skipText: { color: 'rgba(255,255,255,0.85)', fontSize: 13, fontWeight: '600' },

  content: {
    flex: 1, alignItems: 'center', justifyContent: 'center',
    paddingHorizontal: 32, paddingTop: 80, gap: 16,
  },

  tagWrap: {
    backgroundColor: 'rgba(255,255,255,0.22)',
    paddingHorizontal: 14, paddingVertical: 5, borderRadius: 999,
  },
  tagText: { fontSize: 11, color: 'rgba(255,255,255,0.9)', fontWeight: '800', letterSpacing: 1.5 },

  emojiBubble: {
    width: 120, height: 120, borderRadius: 40,
    backgroundColor: 'rgba(255,255,255,0.22)',
    alignItems: 'center', justifyContent: 'center',
    borderWidth: 2, borderColor: 'rgba(255,255,255,0.35)',
    shadowColor: '#000', shadowOffset: { width: 0, height: 8 }, shadowOpacity: 0.15, shadowRadius: 16, elevation: 8,
  },
  emoji: { fontSize: 60 },

  title: {
    fontSize: 34, fontWeight: '900', color: 'white', textAlign: 'center', lineHeight: 42,
    textShadowColor: 'rgba(0,0,0,0.12)', textShadowOffset: { width: 0, height: 2 }, textShadowRadius: 4,
  },
  desc: {
    fontSize: 14, color: 'rgba(255,255,255,0.88)', textAlign: 'center', lineHeight: 23, maxWidth: 300,
  },

  featureList: { gap: 8, alignSelf: 'stretch' },
  featureItem: {
    backgroundColor: 'rgba(255,255,255,0.18)',
    borderRadius: 14, paddingVertical: 10, paddingHorizontal: 16,
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.25)',
  },
  featureText: { fontSize: 13, color: 'white', fontWeight: '600' },

  footer: {
    paddingHorizontal: 28, paddingBottom: 52, paddingTop: 20,
    gap: 16, alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.12)',
  },

  dotsRow: { flexDirection: 'row', gap: 8, alignItems: 'center' },
  dot: { width: 8, height: 8, borderRadius: 4, backgroundColor: 'rgba(255,255,255,0.4)' },
  dotActive: { width: 24, borderRadius: 4 },

  primaryBtn: {
    width: '100%', paddingVertical: 16, borderRadius: 18,
    backgroundColor: 'rgba(255,255,255,0.25)',
    alignItems: 'center',
    borderWidth: 1.5, borderColor: 'rgba(255,255,255,0.5)',
  },
  primaryBtnText: { color: 'white', fontSize: 16, fontWeight: '800', letterSpacing: 0.3 },
});
