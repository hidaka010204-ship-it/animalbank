import { LinearGradient } from 'expo-linear-gradient';
import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { supabase } from '../../lib/supabase';
import { useApp } from '../_appContext';

type Notif = {
  id: string;
  type: string;
  title: string;
  body: string;
  is_read: boolean;
  created_at: string;
};

const TYPE_BADGE: Record<string, { label: string; bg: string; color: string; icon: string }> = {
  urgent:      { label: '緊急',   bg: '#FFE4E4', color: '#C05050', icon: '⚠️' },
  nearby_post: { label: '新着',   bg: '#FFF0E4', color: '#8A5030', icon: '📍' },
  adoption:    { label: '申請',   bg: '#D4EEE9', color: '#2D4A47', icon: '🐾' },
};
const FALLBACK_BADGE = { label: '通知', bg: '#EDF6F4', color: '#4A7A74', icon: '🔔' };

function formatTime(iso: string): string {
  const d = new Date(iso);
  const diff = Math.floor((Date.now() - d.getTime()) / 1000);
  if (diff < 60) return 'たった今';
  if (diff < 3600) return `${Math.floor(diff / 60)}分前`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}時間前`;
  if (diff < 86400 * 2) return '昨日';
  return `${d.getMonth() + 1}/${d.getDate()}`;
}

export default function NotificationsScreen() {
  const { session } = useApp();
  const [notifs, setNotifs] = useState<Notif[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchNotifs = useCallback(async () => {
    if (!session?.user?.id) {
      setLoading(false);
      return;
    }
    setLoading(true);
    const { data, error } = await supabase
      .from('notifications')
      .select('id, type, title, body, is_read, created_at')
      .eq('user_id', session.user.id)
      .order('created_at', { ascending: false })
      .limit(50);
    if (error) {
      console.error('[Notifications] fetch エラー:', error);
    } else {
      setNotifs(data ?? []);
    }
    setLoading(false);
  }, [session?.user?.id]);

  useEffect(() => { fetchNotifs(); }, [fetchNotifs]);

  const markAllRead = async () => {
    if (!session?.user?.id) return;
    const unreadIds = notifs.filter(n => !n.is_read).map(n => n.id);
    if (unreadIds.length === 0) return;
    const { error } = await supabase
      .from('notifications')
      .update({ is_read: true })
      .in('id', unreadIds);
    if (error) {
      console.error('[Notifications] 既読更新エラー:', error);
    } else {
      setNotifs(prev => prev.map(n => ({ ...n, is_read: true })));
    }
  };

  const unreadCount = notifs.filter(n => !n.is_read).length;

  return (
    <View style={styles.outer}>
      <LinearGradient colors={['#4FA3A0', '#A8D8CF']} style={styles.header}>
        {/* 背景装飾 */}
        <View style={styles.headerDecor1} />
        <View style={styles.headerDecor2} />

        <View style={styles.headerLeft}>
          <Text style={styles.headerTitle}>通知</Text>
          {unreadCount > 0 && (
            <View style={styles.unreadBadge}>
              <Text style={styles.unreadBadgeText}>{unreadCount}</Text>
            </View>
          )}
        </View>
        <TouchableOpacity
          style={[styles.readAllBtn, unreadCount === 0 && styles.readAllBtnDisabled]}
          onPress={markAllRead}
          disabled={unreadCount === 0}
        >
          <Text style={[styles.readAllTxt, unreadCount === 0 && styles.readAllTxtDisabled]}>
            ✓ すべて既読
          </Text>
        </TouchableOpacity>
      </LinearGradient>

      <ScrollView style={styles.container} showsVerticalScrollIndicator={false}>
        {loading ? (
          <View style={styles.center}>
            <ActivityIndicator color="#A8D8CF" size="large" />
            <Text style={styles.loadingText}>読み込み中...</Text>
          </View>
        ) : !session ? (
          <View style={styles.center}>
            <Text style={styles.emptyEmoji}>🔒</Text>
            <Text style={styles.emptyTitle}>ログインが必要です</Text>
            <Text style={styles.emptyText}>ログインすると通知が表示されます</Text>
          </View>
        ) : notifs.length === 0 ? (
          <View style={styles.center}>
            <Text style={styles.emptyEmoji}>🔔</Text>
            <Text style={styles.emptyTitle}>通知はありません</Text>
            <Text style={styles.emptyText}>新しい通知が届くとここに表示されます</Text>
          </View>
        ) : (
          <>
            <View style={styles.topBar}>
              <Text style={styles.topLabel}>
                {unreadCount > 0 ? `🐾 未読 ${unreadCount} 件` : '✓ すべて既読'}
              </Text>
            </View>

            {notifs.map(n => {
              const badge = TYPE_BADGE[n.type] ?? FALLBACK_BADGE;
              return (
                <View key={n.id} style={[styles.item, !n.is_read && styles.itemUnread]}>
                  <View style={[styles.iconWrap, { backgroundColor: badge.bg }]}>
                    <Text style={styles.icon}>{badge.icon}</Text>
                  </View>
                  <View style={styles.body}>
                    <View style={styles.itemHead}>
                      <Text style={styles.itemTitle} numberOfLines={2}>{n.title}</Text>
                      <View style={[styles.badge, { backgroundColor: badge.bg }]}>
                        <Text style={[styles.badgeText, { color: badge.color }]}>{badge.label}</Text>
                      </View>
                    </View>
                    {!!n.body && <Text style={styles.itemDesc}>{n.body}</Text>}
                    <Text style={styles.itemTime}>{formatTime(n.created_at)}</Text>
                  </View>
                  {!n.is_read && <View style={styles.unreadDot} />}
                </View>
              );
            })}
          </>
        )}
        <View style={{ height: 36 }} />
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  outer: { flex: 1, backgroundColor: '#C8E8E3' },

  // ヘッダー
  header: {
    paddingTop: 60, paddingBottom: 18, paddingHorizontal: 22,
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    overflow: 'hidden',
  },
  headerDecor1: {
    position: 'absolute', width: 160, height: 160, borderRadius: 80,
    backgroundColor: 'rgba(255,255,255,0.08)', top: -50, right: -30,
  },
  headerDecor2: {
    position: 'absolute', width: 100, height: 100, borderRadius: 50,
    backgroundColor: 'rgba(255,255,255,0.06)', bottom: -30, right: 80,
  },
  headerLeft: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  headerTitle: { fontSize: 22, fontWeight: '800', color: 'white' },
  unreadBadge: {
    backgroundColor: '#F08080', borderRadius: 999,
    minWidth: 22, height: 22, alignItems: 'center', justifyContent: 'center',
    paddingHorizontal: 6,
  },
  unreadBadgeText: { color: 'white', fontSize: 11, fontWeight: '800' },
  readAllBtn: {
    backgroundColor: 'rgba(255,255,255,0.25)',
    paddingHorizontal: 13, paddingVertical: 7,
    borderRadius: 999, borderWidth: 1, borderColor: 'rgba(255,255,255,0.45)',
  },
  readAllBtnDisabled: { opacity: 0.45 },
  readAllTxt: { fontSize: 12, color: 'white', fontWeight: '700' },
  readAllTxtDisabled: { opacity: 0.6 },

  container: { flex: 1 },

  // 未読バー
  topBar: {
    paddingHorizontal: 18, paddingTop: 14, paddingBottom: 6,
  },
  topLabel: { fontSize: 12, fontWeight: '700', color: '#2D4A47', letterSpacing: 0.3 },

  // 空状態 / ローディング
  center: { alignItems: 'center', paddingTop: 72, gap: 10 },
  emptyEmoji: { fontSize: 52 },
  emptyTitle: { fontSize: 16, fontWeight: '800', color: '#2D4A47' },
  emptyText: { fontSize: 13, color: '#7BA8A2' },
  loadingText: { fontSize: 13, color: '#7BA8A2', marginTop: 4 },

  // 通知アイテム
  item: {
    flexDirection: 'row', gap: 12, padding: 14,
    backgroundColor: 'white', borderRadius: 18,
    marginHorizontal: 14, marginBottom: 9,
    shadowColor: '#2D4A47', shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06, shadowRadius: 8, elevation: 2,
    position: 'relative',
  },
  itemUnread: {
    borderLeftWidth: 3.5, borderLeftColor: '#F08080',
    backgroundColor: '#FFFAFA',
  },
  iconWrap: {
    width: 40, height: 40, borderRadius: 14,
    alignItems: 'center', justifyContent: 'center', flexShrink: 0,
  },
  icon: { fontSize: 20 },
  body: { flex: 1 },
  itemHead: {
    flexDirection: 'row', justifyContent: 'space-between',
    alignItems: 'flex-start', marginBottom: 4, gap: 6,
  },
  itemTitle: { fontSize: 13, fontWeight: '700', color: '#2D4A47', flex: 1, lineHeight: 18 },
  badge: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 999, flexShrink: 0 },
  badgeText: { fontSize: 10, fontWeight: '700' },
  itemDesc: { fontSize: 12, color: '#5A7A76', lineHeight: 18, marginBottom: 3 },
  itemTime: { fontSize: 11, color: '#A8C8C3', marginTop: 2, fontWeight: '500' },
  unreadDot: {
    position: 'absolute', top: 12, right: 12,
    width: 8, height: 8, borderRadius: 4,
    backgroundColor: '#F08080',
  },
});
