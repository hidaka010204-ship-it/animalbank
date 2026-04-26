import { useRouter } from 'expo-router';
import { Image, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { Animal, NearbyPost, useApp } from '../app/_appContext';

function StatBox({ number, label, color }: { number: number; label: string; color: string }) {
  return (
    <View style={styles.statBox}>
      <Text style={[styles.statNumber, { color }]}>{number.toLocaleString()}</Text>
      <Text style={styles.statLabel}>{label}</Text>
    </View>
  );
}

function UrgentAnimalRow({ animal }: { animal: Animal }) {
  const router = useRouter();
  return (
    <TouchableOpacity
      style={styles.animalRow}
      onPress={() => router.push(`/animal/${animal.id}` as any)}
      activeOpacity={0.7}
    >
      {animal.images[0]
        ? <Image source={{ uri: animal.images[0] }} style={styles.animalImg} />
        : <View style={styles.animalImgPlaceholder}><Text style={styles.animalEmoji}>{animal.emoji}</Text></View>
      }
      <View style={{ flex: 1 }}>
        <Text style={styles.animalName} numberOfLines={1}>{animal.name}</Text>
        <Text style={styles.animalSub} numberOfLines={1}>
          {[animal.shelter, animal.prefecture].filter(Boolean).join(' · ')}
        </Text>
      </View>
      <View style={styles.urgentPill}>
        <Text style={styles.urgentPillText}>緊急</Text>
      </View>
    </TouchableOpacity>
  );
}

function LostPostRow({ post }: { post: NearbyPost }) {
  return (
    <View style={styles.postRow}>
      {post.location
        ? <Text style={styles.postLocation}>📍 {post.location}</Text>
        : post.locationPrefecture
        ? <Text style={styles.postLocation}>📍 {post.locationPrefecture}</Text>
        : null
      }
      <Text style={styles.postText} numberOfLines={2}>{post.content}</Text>
    </View>
  );
}

export function WebSidebar() {
  const { animals, nearbyPosts, nationalTotals, themeColor } = useApp();

  const urgentAnimals = animals.filter(a => a.urgent).slice(0, 4);
  const lostPosts = nearbyPosts.filter(p => p.type === 'lost').slice(0, 5);

  return (
    <View style={styles.container}>
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.content}
      >
        {/* ロゴ */}
        <View style={styles.logoWrap}>
          <Text style={[styles.logoText, { color: themeColor }]}>🐾 あにまるバンク</Text>
          <Text style={styles.logoSub}>保護動物支援プラットフォーム</Text>
        </View>

        {/* 全国統計 */}
        <View style={styles.card}>
          <Text style={styles.cardTitle}>📊 全国の保護動物</Text>
          <View style={styles.statsRow}>
            <StatBox number={nationalTotals.collected} label="登録数"   color={themeColor} />
            <StatBox number={nationalTotals.urgent}    label="緊急"     color="#E24B4A" />
            <StatBox number={nationalTotals.transferred} label="譲渡済" color="#22C55E" />
          </View>
        </View>

        {/* 緊急の保護動物 */}
        {urgentAnimals.length > 0 && (
          <View style={styles.card}>
            <Text style={styles.cardTitle}>🚨 緊急の保護動物</Text>
            {urgentAnimals.map(a => <UrgentAnimalRow key={a.id} animal={a} />)}
          </View>
        )}

        {/* 近くの迷子情報 */}
        {lostPosts.length > 0 && (
          <View style={styles.card}>
            <Text style={styles.cardTitle}>🔍 近くの迷子情報</Text>
            {lostPosts.map(p => <LostPostRow key={p.id} post={p} />)}
          </View>
        )}

        {urgentAnimals.length === 0 && lostPosts.length === 0 && (
          <View style={styles.emptyCard}>
            <Text style={styles.emptyEmoji}>🐾</Text>
            <Text style={styles.emptyText}>近くの情報はありません</Text>
          </View>
        )}

        <View style={{ height: 40 }} />
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#EEF8F6',
    borderLeftWidth: 1,
    borderLeftColor: '#D4EEE9',
    maxWidth: 360,
  },
  content: {
    padding: 18,
    paddingTop: 52,
    gap: 14,
  },

  logoWrap: { paddingBottom: 4 },
  logoText: { fontSize: 17, fontWeight: '800' },
  logoSub: { fontSize: 11, color: '#aaa', marginTop: 3 },

  card: {
    backgroundColor: 'white',
    borderRadius: 18,
    padding: 16,
    gap: 10,
    shadowColor: '#2D4A47',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 10,
    elevation: 2,
  },
  cardTitle: { fontSize: 12, fontWeight: '800', color: '#1a1a1a', letterSpacing: 0.2 },

  statsRow: { flexDirection: 'row', gap: 8 },
  statBox: {
    flex: 1,
    backgroundColor: '#F0FAF8',
    borderRadius: 12,
    paddingVertical: 10,
    alignItems: 'center',
    gap: 3,
  },
  statNumber: { fontSize: 20, fontWeight: '900' },
  statLabel: { fontSize: 10, color: '#888', fontWeight: '600' },

  animalRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingTop: 10,
    borderTopWidth: 0.5,
    borderTopColor: '#F0EDE8',
  },
  animalImg: { width: 42, height: 42, borderRadius: 10, resizeMode: 'cover' },
  animalImgPlaceholder: {
    width: 42, height: 42, borderRadius: 10,
    backgroundColor: '#D4EEE9', alignItems: 'center', justifyContent: 'center',
  },
  animalEmoji: { fontSize: 20 },
  animalName: { fontSize: 13, fontWeight: '700', color: '#1a1a1a' },
  animalSub: { fontSize: 11, color: '#aaa', marginTop: 2 },
  urgentPill: {
    backgroundColor: '#FEE2E2', paddingHorizontal: 8, paddingVertical: 3, borderRadius: 999,
  },
  urgentPillText: { fontSize: 10, color: '#B91C1C', fontWeight: '700' },

  postRow: {
    paddingTop: 10,
    borderTopWidth: 0.5,
    borderTopColor: '#F0EDE8',
    gap: 3,
  },
  postLocation: { fontSize: 11, color: '#888' },
  postText: { fontSize: 13, color: '#333', lineHeight: 19 },

  emptyCard: {
    backgroundColor: 'white', borderRadius: 18, padding: 28,
    alignItems: 'center', gap: 8,
  },
  emptyEmoji: { fontSize: 28, opacity: 0.3 },
  emptyText: { fontSize: 13, color: '#ccc' },
});
