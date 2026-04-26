import * as ImagePicker from 'expo-image-picker';
import * as Location from 'expo-location';
import { LinearGradient } from 'expo-linear-gradient';
import { useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import {
  ActivityIndicator, Alert, Image, Modal, ScrollView, StyleSheet,
  Switch, Text, TextInput, TouchableOpacity, View,
} from 'react-native';
import { t } from '../../lib/i18n';
import { storage, STORAGE_KEYS } from '../../lib/storage';
import { supabase } from '../../lib/supabase';
import { PREFECTURE_STATS, useApp } from '../_appContext';

const THEME_COLORS = [
  { label: 'グリーン', value: '#4FA3A0' },
  { label: 'ミント',   value: '#A8D8CF' },
  { label: 'コーラル', value: '#F08080' },
  { label: 'オレンジ', value: '#F97316' },
];

const ALL_PREFECTURES = PREFECTURE_STATS.map(p => p.prefecture);
const AVATARS = ['👤', '🐕', '🐈', '🐾', '🌿', '🏠'];

type NotifSettings = {
  urgent: boolean;
  application: boolean;
  newAnimal: boolean;
  timeline: boolean;
};

type Adoption = {
  id: string;
  animal_id: string;
  application_number: string | null;
  status: 'pending' | 'accepted' | 'completed' | 'rejected';
  created_at: string;
};

const STATUS_CONFIG = {
  pending:   { label: '審査中',       bg: '#FFF3E0', color: '#B45309', dot: '#F59E0B' },
  accepted:  { label: '受理',         bg: '#EFF6FF', color: '#1D4ED8', dot: '#3B82F6' },
  rejected:  { label: '拒否',         bg: '#FEF2F2', color: '#B91C1C', dot: '#EF4444' },
  completed: { label: '引き渡し完了', bg: '#F0FDF4', color: '#166534', dot: '#22C55E' },
} as const;

export default function MypageScreen() {
  const router = useRouter();
  const { userProfile, updateUserProfile, animals, favorites, session, themeColor, setThemeColor, language, setLanguage } = useApp();

  // プロフィール編集
  const [editing, setEditing] = useState(false);
  const [draftNickname, setDraftNickname] = useState('');
  const [draftPrefecture, setDraftPrefecture] = useState('');
  const [draftCity, setDraftCity] = useState('');
  const [draftAvatar, setDraftAvatar] = useState('👤');
  const [draftPhotoUri, setDraftPhotoUri] = useState<string | undefined>(undefined);

  // モーダル
  const [showPrefModal, setShowPrefModal] = useState(false);
  const [showAvatarModal, setShowAvatarModal] = useState(false);
  const [showNotifModal, setShowNotifModal] = useState(false);
  const [showPrivacyModal, setShowPrivacyModal] = useState(false);
  const [showTermsModal, setShowTermsModal] = useState(false);
  const [showContactModal, setShowContactModal] = useState(false);

  // 申請状況
  const [myAdoptions, setMyAdoptions] = useState<Adoption[]>([]);
  const [adoptionsLoading, setAdoptionsLoading] = useState(false);
  const [adoptionAnimalData, setAdoptionAnimalData] = useState<Record<string, { name: string; images: string[] }>>({});

  // 通知設定
  const [notif, setNotif] = useState<NotifSettings>({
    urgent: true, application: true, newAnimal: false, timeline: true,
  });

  // 位置情報
  const [userLocation, setUserLocation] = useState<{ lat: number; lng: number } | null>(null);
  const [locationLoading, setLocationLoading] = useState(false);

  // お問い合わせ
  const [contactName, setContactName] = useState('');
  const [contactEmail, setContactEmail] = useState('');
  const [contactCategory, setContactCategory] = useState('');
  const [contactBody, setContactBody] = useState('');
  const [contactSent, setContactSent] = useState(false);

  useEffect(() => {
    if (!session?.user?.id) return;
    const userId = session.user.id;
    setAdoptionsLoading(true);
    supabase
      .from('adoptions')
      .select('id, animal_id, application_number, status, created_at')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .then(async ({ data, error }) => {
        if (!error && data) {
          setMyAdoptions(data as Adoption[]);
          // コンテキストに含まれない動物（譲渡済みなど）の名前・画像を別途取得
          const ids = [...new Set(data.map(ad => ad.animal_id).filter(Boolean))];
          if (ids.length > 0) {
            const { data: animalRows } = await supabase
              .from('animals')
              .select('id, name, images')
              .in('id', ids);
            if (animalRows) {
              const dataMap: Record<string, { name: string; images: string[] }> = {};
              for (const a of animalRows) {
                const imgs = Array.isArray(a.images)
                  ? (a.images as unknown[]).filter((u): u is string => typeof u === 'string')
                  : [];
                dataMap[a.id] = { name: a.name, images: imgs };
              }
              setAdoptionAnimalData(dataMap);
            }
          }
        }
        setAdoptionsLoading(false);
      });

    const channel = supabase
      .channel(`adoptions-mypage-${userId}`)
      .on('postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'adoptions', filter: `user_id=eq.${userId}` },
        (payload) => {
          setMyAdoptions(prev =>
            prev.map(ad => ad.id === payload.new.id ? { ...ad, ...(payload.new as Adoption) } : ad)
          );
        }
      )
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [session?.user?.id]);

  useEffect(() => {
    storage.getItem(STORAGE_KEYS.NOTIF).then(json => {
      if (json) setNotif(JSON.parse(json));
    }).catch(() => {});
  }, []);

  const updateNotif = (key: keyof NotifSettings, value: boolean) => {
    setNotif(prev => {
      const next = { ...prev, [key]: value };
      storage.setItem(STORAGE_KEYS.NOTIF, JSON.stringify(next)).catch(() => {});
      return next;
    });
  };

  const openEdit = () => {
    setDraftNickname(userProfile.nickname);
    setDraftPrefecture(userProfile.prefecture);
    setDraftCity(userProfile.city ?? '');
    setDraftAvatar(userProfile.avatar);
    setDraftPhotoUri(userProfile.photoUri);
    setEditing(true);
  };

  const saveEdit = () => {
    updateUserProfile({
      nickname: draftNickname,
      prefecture: draftPrefecture,
      city: draftCity,
      avatar: draftAvatar,
      photoUri: draftPhotoUri,
    });
    setEditing(false);
  };

  const pickPhoto = async () => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') return;
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'], allowsEditing: true, aspect: [1, 1], quality: 0.8,
    });
    if (!result.canceled && result.assets[0]) {
      const uri = result.assets[0].uri;
      setDraftPhotoUri(uri);
      setShowAvatarModal(false);
      try {
        const ext = (uri.split('.').pop()?.split('?')[0] || 'jpg').toLowerCase();
        const mimeType = ext === 'jpg' ? 'image/jpeg' : `image/${ext}`;
        const path = `profile-${Date.now()}.${ext}`;
        const formData = new FormData();
        formData.append('file', { uri, name: path, type: mimeType } as any);
        const { data, error } = await supabase.storage
          .from('profile-images')
          .upload(path, formData, { contentType: mimeType, upsert: true });
        if (error) { Alert.alert('アップロード失敗', error.message); return; }
        const { data: { publicUrl } } = supabase.storage.from('profile-images').getPublicUrl(data.path);
        setDraftAvatar(publicUrl);
        setDraftPhotoUri(publicUrl);
        updateUserProfile({ avatar: publicUrl, photoUri: publicUrl });
      } catch {
        Alert.alert('エラー', '写真のアップロードに失敗しました');
      }
    }
  };

  const getLocation = async () => {
    if (!session?.user?.id) return;
    setLocationLoading(true);
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('位置情報の許可が必要です', '設定から位置情報へのアクセスを許可してください');
        return;
      }
      const loc = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
      const { latitude: lat, longitude: lng } = loc.coords;
      console.log('[getLocation] 取得座標:', { lat, lng, userId: session.user.id });

      // レコード存在確認
      const { data: existing, error: selectError } = await supabase
        .from('profiles')
        .select('id')
        .eq('id', session.user.id)
        .maybeSingle();
      console.log('[getLocation] profiles SELECT:', { existing, selectError });

      let dbError: { message: string } | null = null;
      if (existing) {
        // レコードあり → UPDATE
        const { data, error } = await supabase
          .from('profiles')
          .update({ lat, lng })
          .eq('id', session.user.id)
          .select();
        console.log('[getLocation] profiles UPDATE:', { data, error });
        dbError = error;
      } else {
        // レコードなし → INSERT
        const { data, error } = await supabase
          .from('profiles')
          .insert({ id: session.user.id, lat, lng })
          .select();
        console.log('[getLocation] profiles INSERT:', { data, error });
        dbError = error;
      }

      if (dbError) {
        Alert.alert('保存エラー', dbError.message);
        return;
      }
      setUserLocation({ lat, lng });
      Alert.alert('現在地を更新しました', `緯度 ${lat.toFixed(4)} / 経度 ${lng.toFixed(4)}`);
    } catch (e) {
      console.error('[getLocation] 例外:', e);
      Alert.alert('エラー', '位置情報の取得に失敗しました');
    } finally {
      setLocationLoading(false);
    }
  };

  const favAnimals = animals.filter(a => favorites.has(a.id));
  const displayAvatar = userProfile.photoUri ?? userProfile.avatar;
  const isPhotoUrl = displayAvatar?.startsWith('http');

  // ── 未ログイン時 ──
  if (!session) {
    return (
      <View style={styles.outer}>
        <LinearGradient colors={[themeColor, '#A8D8CF']} style={styles.header}>
          <Text style={styles.headerTitle}>マイページ</Text>
        </LinearGradient>

        <ScrollView style={styles.container} showsVerticalScrollIndicator={false}>
          {/* ログイン促進バナー */}
          <View style={styles.guestBanner}>
            <View style={styles.guestAvatarWrap}>
              <Text style={styles.guestAvatarText}>👤</Text>
            </View>
            <Text style={styles.guestTitle}>ログインしていません</Text>
            <Text style={styles.guestDesc}>
              ログインするとすべての機能が使えます
            </Text>
            <TouchableOpacity
              style={styles.loginBtn}
              onPress={() => router.push('/auth' as any)}
              activeOpacity={0.85}
            >
              <Text style={styles.loginBtnTxt}>ログイン / 新規登録</Text>
            </TouchableOpacity>
          </View>

          {/* お気に入り（未ログインでも表示） */}
          <Text style={styles.sectionTitle}>お気に入り（{favAnimals.length}件）</Text>
          {favAnimals.length === 0 ? (
            <View style={styles.emptyCard}>
              <Text style={styles.emptyIcon}>♡</Text>
              <Text style={styles.emptyText}>まだお気に入りはありません</Text>
            </View>
          ) : (
            <View style={styles.card}>
              {favAnimals.map((a, i) => (
                <TouchableOpacity
                  key={a.id}
                  style={[styles.favRow, i > 0 && styles.rowDivider]}
                  onPress={() => router.push(`/animal/${a.id}` as any)}
                  activeOpacity={0.7}
                >
                  {a.images[0]
                    ? <Image source={{ uri: a.images[0] }} style={styles.favImg} />
                    : <View style={styles.favEmojiWrap}><Text style={styles.favEmoji}>{a.emoji}</Text></View>
                  }
                  <View style={styles.favInfo}>
                    <Text style={styles.favName}>{a.name}</Text>
                    <Text style={styles.favSub} numberOfLines={1}>📍 {a.shelter}</Text>
                  </View>
                  <Text style={styles.heart}>♥</Text>
                </TouchableOpacity>
              ))}
            </View>
          )}

          {/* 設定（ログインなしでも使えるもの） */}
          <Text style={styles.sectionTitle}>設定</Text>
          <View style={styles.card}>
            {[
              { label: '📄  利用規約',             onPress: () => setShowTermsModal(true) },
              { label: '🔒  プライバシーポリシー', onPress: () => setShowPrivacyModal(true) },
              { label: '🔔  通知設定',            onPress: () => setShowNotifModal(true) },
              { label: '✉️  お問い合わせ',         onPress: () => { setContactSent(false); setShowContactModal(true); } },
            ].map((item, i) => (
              <TouchableOpacity
                key={item.label}
                style={[styles.menuRow, i < 3 && styles.rowDivider]}
                onPress={item.onPress}
              >
                <Text style={styles.menuText}>{item.label}</Text>
                <Text style={styles.menuArrow}>›</Text>
              </TouchableOpacity>
            ))}
          </View>

          <View style={{ height: 48 }} />
        </ScrollView>

        {/* モーダル群 */}
        {renderNotifModal(showNotifModal, () => setShowNotifModal(false), notif, updateNotif)}
        {renderPrivacyModal(showPrivacyModal, () => setShowPrivacyModal(false))}
        {renderTermsModal(showTermsModal, () => setShowTermsModal(false))}
        {renderContactModal(showContactModal, () => setShowContactModal(false), contactSent, setContactSent, contactName, setContactName, contactEmail, setContactEmail, contactCategory, setContactCategory, contactBody, setContactBody)}
      </View>
    );
  }

  // ── ログイン時 ──
  return (
    <View style={styles.outer}>
      <LinearGradient colors={[themeColor, '#A8D8CF']} style={styles.header}>
        <Text style={styles.headerTitle}>マイページ</Text>
      </LinearGradient>

      <ScrollView style={styles.container} showsVerticalScrollIndicator={false}>

        {/* ── プロフィールカード ── */}
        <View style={styles.profileCard}>
          <TouchableOpacity
            style={styles.avatarWrap}
            onPress={editing ? () => setShowAvatarModal(true) : undefined}
            activeOpacity={editing ? 0.7 : 1}
          >
            {isPhotoUrl
              ? <Image source={{ uri: displayAvatar }} style={styles.avatarPhoto} />
              : <Text style={styles.avatarText}>{displayAvatar || '👤'}</Text>
            }
            {editing && (
              <View style={styles.avatarEditBadge}>
                <Text style={styles.avatarEditBadgeTxt}>✎</Text>
              </View>
            )}
          </TouchableOpacity>

          <View style={styles.profileInfo}>
            {editing ? (
              <>
                <TextInput
                  style={styles.nicknameInput}
                  value={draftNickname}
                  onChangeText={setDraftNickname}
                  placeholder="ニックネーム"
                  placeholderTextColor="#bbb"
                  autoFocus
                />
                <TouchableOpacity style={styles.prefSelector} onPress={() => setShowPrefModal(true)}>
                  <Text style={[styles.prefSelectorText, !draftPrefecture && { color: '#bbb' }]}>
                    📍 {draftPrefecture || '都道府県を選択'}
                  </Text>
                  <Text style={styles.prefArrow}>›</Text>
                </TouchableOpacity>
                <TextInput
                  style={styles.cityInput}
                  value={draftCity}
                  onChangeText={setDraftCity}
                  placeholder="市町村（例：中津川市）"
                  placeholderTextColor="#bbb"
                />
                <View style={styles.editBtnsRow}>
                  <TouchableOpacity style={styles.cancelBtn} onPress={() => setEditing(false)}>
                    <Text style={styles.cancelBtnTxt}>取消</Text>
                  </TouchableOpacity>
                  <TouchableOpacity style={styles.saveBtn} onPress={saveEdit}>
                    <Text style={styles.saveBtnTxt}>保存</Text>
                  </TouchableOpacity>
                </View>
              </>
            ) : (
              <>
                <View style={styles.nicknameRow}>
                  <Text style={styles.nickname} numberOfLines={1}>
                    {userProfile.nickname || 'ニックネーム未設定'}
                  </Text>
                  <TouchableOpacity style={styles.editChip} onPress={openEdit}>
                    <Text style={styles.editChipTxt}>編集</Text>
                  </TouchableOpacity>
                </View>
                <Text style={styles.emailText} numberOfLines={1}>
                  ✉ {session.user.email}
                </Text>
                <Text style={styles.prefText}>
                  📍 {[userProfile.prefecture, userProfile.city].filter(Boolean).join(' ') || '都道府県未設定'}
                </Text>
              </>
            )}
          </View>
        </View>

        {/* ── 申請状況 ── */}
        <Text style={styles.sectionTitle}>申請状況</Text>
        {adoptionsLoading ? (
          <View style={styles.emptyCard}>
            <ActivityIndicator color="#A8D8CF" style={{ paddingVertical: 20 }} />
          </View>
        ) : myAdoptions.length === 0 ? (
          <View style={styles.emptyCard}>
            <Text style={styles.emptyIcon}>📋</Text>
            <Text style={styles.emptyText}>申請履歴はありません</Text>
          </View>
        ) : (
          <View style={styles.card}>
            {myAdoptions.map((ad, i) => {
              const animal = animals.find(a => a.id === ad.animal_id);
              const fallback = adoptionAnimalData[ad.animal_id];
              const imgUri = animal?.images[0] ?? fallback?.images[0];
              const animalName = animal?.name ?? fallback?.name ?? '動物';
              const cfg = STATUS_CONFIG[ad.status] ?? STATUS_CONFIG.pending;
              return (
                <TouchableOpacity
                  key={ad.id}
                  style={[styles.adoptionRow, i > 0 && styles.rowDivider]}
                  onPress={() => router.push(`/animal/${ad.animal_id}` as any)}
                  activeOpacity={0.7}
                >
                  {imgUri
                    ? <Image source={{ uri: imgUri }} style={styles.favImg} />
                    : <View style={styles.favEmojiWrap}><Text style={styles.favEmoji}>{animal?.emoji ?? '🐾'}</Text></View>
                  }
                  <View style={styles.adoptionInfo}>
                    <Text style={styles.adoptionAnimalName} numberOfLines={1}>
                      {animalName}
                      {ad.application_number ? `（${ad.application_number}）` : ''}
                    </Text>
                    <Text style={styles.adoptionDate}>
                      {new Date(ad.created_at).toLocaleDateString('ja-JP')} 申請
                    </Text>
                  </View>
                  <View style={[styles.statusBadge, { backgroundColor: cfg.bg }]}>
                    <View style={[styles.statusDot, { backgroundColor: cfg.dot }]} />
                    <Text style={[styles.statusLabel, { color: cfg.color }]}>{cfg.label}</Text>
                  </View>
                </TouchableOpacity>
              );
            })}
          </View>
        )}

        {/* ── お気に入り ── */}
        <Text style={styles.sectionTitle}>お気に入り（{favAnimals.length}件）</Text>
        {favAnimals.length === 0 ? (
          <View style={styles.emptyCard}>
            <Text style={styles.emptyIcon}>♡</Text>
            <Text style={styles.emptyText}>まだお気に入りはありません</Text>
          </View>
        ) : (
          <View style={styles.card}>
            {favAnimals.map((a, i) => (
              <TouchableOpacity
                key={a.id}
                style={[styles.favRow, i > 0 && styles.rowDivider]}
                onPress={() => router.push(`/animal/${a.id}` as any)}
                activeOpacity={0.7}
              >
                {a.images[0]
                  ? <Image source={{ uri: a.images[0] }} style={styles.favImg} />
                  : <View style={styles.favEmojiWrap}><Text style={styles.favEmoji}>{a.emoji}</Text></View>
                }
                <View style={styles.favInfo}>
                  <Text style={styles.favName}>{a.name}</Text>
                  <Text style={styles.favSub} numberOfLines={1}>📍 {a.shelter}</Text>
                </View>
                <Text style={styles.heart}>♥</Text>
              </TouchableOpacity>
            ))}
          </View>
        )}

        {/* ── 設定 ── */}
        <Text style={styles.sectionTitle}>設定</Text>
        <View style={styles.card}>
          {([
            { label: '📄  利用規約',             onPress: () => setShowTermsModal(true) },
            { label: '🔒  プライバシーポリシー', onPress: () => setShowPrivacyModal(true) },
            { label: '🔔  通知設定',            onPress: () => setShowNotifModal(true) },
            { label: '✉️  お問い合わせ',         onPress: () => { setContactSent(false); setShowContactModal(true); } },
          ] as { label: string; onPress: () => void; loading?: boolean }[]).map((item, i) => (
            <TouchableOpacity
              key={item.label}
              style={[styles.menuRow, i > 0 && styles.rowDivider]}
              onPress={item.onPress}
              disabled={item.loading}
            >
              <Text style={[styles.menuText, item.loading && { color: '#A8D8CF' }]}>{item.label}</Text>
              {item.loading
                ? <ActivityIndicator size="small" color="#A8D8CF" />
                : <Text style={styles.menuArrow}>›</Text>
              }
            </TouchableOpacity>
          ))}
        </View>

        <View style={{ height: 48 }} />
      </ScrollView>

      {/* ── アバター選択 ── */}
      <Modal visible={!!showAvatarModal} transparent animationType="fade" onRequestClose={() => setShowAvatarModal(false)}>
        <TouchableOpacity style={styles.modalOverlay} activeOpacity={1} onPress={() => setShowAvatarModal(false)}>
          <View style={styles.avatarPicker}>
            <Text style={styles.avatarPickerTitle}>アイコンを選択</Text>
            <TouchableOpacity style={styles.photoPickerBtn} onPress={pickPhoto}>
              <Text style={styles.photoPickerBtnTxt}>📷　写真を選ぶ</Text>
            </TouchableOpacity>
            {draftPhotoUri && (
              <TouchableOpacity style={styles.photoRemoveBtn} onPress={() => setDraftPhotoUri(undefined)}>
                <Text style={styles.photoRemoveBtnTxt}>写真を削除</Text>
              </TouchableOpacity>
            )}
            <Text style={styles.avatarPickerSub}>または絵文字を選択</Text>
            <View style={styles.avatarGrid}>
              {AVATARS.map(av => (
                <TouchableOpacity
                  key={av}
                  style={[styles.avatarOption, !draftPhotoUri && draftAvatar === av && styles.avatarOptionSelected]}
                  onPress={() => { setDraftAvatar(av); setDraftPhotoUri(undefined); setShowAvatarModal(false); }}
                >
                  <Text style={styles.avatarOptionText}>{av}</Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>
        </TouchableOpacity>
      </Modal>

      {/* ── 都道府県選択 ── */}
      <Modal visible={!!showPrefModal} animationType="slide" presentationStyle="pageSheet" onRequestClose={() => setShowPrefModal(false)}>
        <View style={styles.sheetContainer}>
          <View style={styles.sheetHeader}>
            <Text style={styles.sheetTitle}>都道府県を選択</Text>
            <TouchableOpacity style={styles.sheetClose} onPress={() => setShowPrefModal(false)}>
              <Text style={styles.sheetCloseTxt}>✕</Text>
            </TouchableOpacity>
          </View>
          <ScrollView>
            {ALL_PREFECTURES.map(p => (
              <TouchableOpacity key={p} style={styles.sheetItem}
                onPress={() => { setDraftPrefecture(p); setShowPrefModal(false); }}>
                <Text style={styles.sheetItemText}>{p}</Text>
                {draftPrefecture === p && <Text style={styles.sheetCheck}>✓</Text>}
              </TouchableOpacity>
            ))}
            <View style={{ height: 40 }} />
          </ScrollView>
        </View>
      </Modal>

      {/* モーダル群 */}
      {renderNotifModal(showNotifModal, () => setShowNotifModal(false), notif, updateNotif)}
      {renderPrivacyModal(showPrivacyModal, () => setShowPrivacyModal(false))}
      {renderTermsModal(showTermsModal, () => setShowTermsModal(false))}
      {renderContactModal(showContactModal, () => setShowContactModal(false), contactSent, setContactSent, contactName, setContactName, contactEmail, setContactEmail, contactCategory, setContactCategory, contactBody, setContactBody)}
    </View>
  );
}

// ── 通知設定モーダル ──
function renderNotifModal(
  visible: boolean,
  onClose: () => void,
  notif: NotifSettings,
  updateNotif: (key: keyof NotifSettings, value: boolean) => void,
) {
  return (
    <Modal visible={!!visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
      <View style={styles.sheetContainer}>
        <View style={styles.sheetHeader}>
          <Text style={styles.sheetTitle}>通知設定</Text>
          <TouchableOpacity style={styles.sheetClose} onPress={onClose}>
            <Text style={styles.sheetCloseTxt}>✕</Text>
          </TouchableOpacity>
        </View>
        <ScrollView>
          <Text style={styles.notifDesc}>受け取りたい通知をON/OFFで設定できます</Text>
          {([
            { key: 'urgent'      as const, label: '緊急対象の通知',    desc: '掲載期限が迫る動物が登録されたとき' },
            { key: 'application' as const, label: '申請状況の更新',    desc: '引き取り申請のステータスが変わったとき' },
            { key: 'newAnimal'   as const, label: '新着動物の通知',    desc: '近くの保健所に新しい動物が登録されたとき' },
            { key: 'timeline'    as const, label: 'タイムラインの返信', desc: '自分の投稿にコメントや返信があったとき' },
          ] as const).map((item, i, arr) => (
            <View key={item.key} style={[styles.notifRow, i < arr.length - 1 && styles.rowDivider]}>
              <View style={styles.notifInfo}>
                <Text style={styles.notifLabel}>{item.label}</Text>
                <Text style={styles.notifSubLabel}>{item.desc}</Text>
              </View>
              <Switch
                value={notif[item.key]}
                onValueChange={v => updateNotif(item.key, v)}
                trackColor={{ true: '#F08080' }}
                thumbColor="white"
              />
            </View>
          ))}
          <View style={{ height: 40 }} />
        </ScrollView>
      </View>
    </Modal>
  );
}

// ── プライバシーポリシーモーダル ──
function renderPrivacyModal(visible: boolean, onClose: () => void) {
  return (
    <Modal visible={!!visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
      <View style={styles.sheetContainer}>
        <View style={styles.sheetHeader}>
          <Text style={styles.sheetTitle}>プライバシーポリシー</Text>
          <TouchableOpacity style={styles.sheetClose} onPress={onClose}>
            <Text style={styles.sheetCloseTxt}>✕</Text>
          </TouchableOpacity>
        </View>
        <ScrollView contentContainerStyle={styles.privacyContent}>
          <Text style={styles.privacyUpdated}>最終更新：2026年4月</Text>
          {[
            ['1. 収集する情報', '本アプリは、サービス提供のために以下の情報を収集します。\n・ニックネームおよび居住都道府県\n・メールアドレス\n・タイムラインへの投稿内容\n・位置情報（任意）'],
            ['2. 利用目的', '収集した情報は以下の目的にのみ使用します。\n・サービスの提供および機能改善\n・法令に基づく対応'],
            ['3. 第三者提供', '法令に基づく場合を除き、収集した情報を第三者に提供しません。'],
            ['4. 情報の管理', '収集した情報は適切なセキュリティ対策を講じて管理します。不要になった情報は速やかに削除します。'],
            ['5. 位置情報について', '位置情報は、近くの保護動物・迷子情報の表示のために使用します。提供は任意であり、許可しない場合でもサービスの基本機能はご利用いただけます。'],
            ['6. お問い合わせ', 'プライバシーに関するご質問は、アプリ内の「お問い合わせ」フォームよりご連絡ください。'],
          ].map(([title, body]) => (
            <View key={title} style={styles.privacySection}>
              <Text style={styles.privacySectionTitle}>{title}</Text>
              <Text style={styles.privacySectionBody}>{body}</Text>
            </View>
          ))}
          <View style={{ height: 40 }} />
        </ScrollView>
      </View>
    </Modal>
  );
}

// ── 利用規約モーダル ──
function renderTermsModal(visible: boolean, onClose: () => void) {
  return (
    <Modal visible={!!visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
      <View style={styles.sheetContainer}>
        <View style={styles.sheetHeader}>
          <Text style={styles.sheetTitle}>利用規約</Text>
          <TouchableOpacity style={styles.sheetClose} onPress={onClose}>
            <Text style={styles.sheetCloseTxt}>✕</Text>
          </TouchableOpacity>
        </View>
        <ScrollView contentContainerStyle={styles.privacyContent}>
          <Text style={styles.privacyUpdated}>最終更新：2026年4月</Text>
          {[
            ['1. サービスの目的', '本アプリ「あにまるバンク」は、保護動物の情報を広く発信し、里親希望者と保健所・保護団体をつなぐことで、動物の保護・譲渡を支援するプラットフォームです。'],
            ['2. 利用資格', '本サービスは日本国内在住の方を対象としています。'],
            ['3. 禁止事項', '以下の行為を禁止します。\n・虚偽の情報の投稿\n・他のユーザーや第三者への誹謗中傷\n・本アプリを通じた金銭のやり取り\n・アフィリエイトリンクや商品紹介など、利益を目的とした投稿\n・不正アクセスやシステムへの干渉\n・動物虐待に関する投稿'],
            ['4. 免責事項', '当アプリおよび運営は、ユーザー間のトラブルや金銭的損害について一切の責任を負いません。禁止事項への違反によって生じた損害についても同様です。'],
            ['5. アカウント管理', 'アカウントの管理はユーザー自身の責任で行ってください。不正利用が発覚した場合、予告なくアカウントを停止することがあります。'],
            ['6. サービスの変更・終了', '当アプリは、予告なくサービスの内容を変更または終了する場合があります。'],
            ['7. 準拠法', '本規約は日本法に準拠します。'],
          ].map(([title, body]) => (
            <View key={title} style={styles.privacySection}>
              <Text style={styles.privacySectionTitle}>{title}</Text>
              <Text style={styles.privacySectionBody}>{body}</Text>
            </View>
          ))}
          <View style={{ height: 40 }} />
        </ScrollView>
      </View>
    </Modal>
  );
}

// ── お問い合わせモーダル ──
function renderContactModal(
  visible: boolean,
  onClose: () => void,
  contactSent: boolean,
  setContactSent: (v: boolean) => void,
  contactName: string,
  setContactName: (v: string) => void,
  contactEmail: string,
  setContactEmail: (v: string) => void,
  contactCategory: string,
  setContactCategory: (v: string) => void,
  contactBody: string,
  setContactBody: (v: string) => void,
) {
  return (
    <Modal visible={!!visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
      <View style={styles.sheetContainer}>
        <View style={styles.sheetHeader}>
          <Text style={styles.sheetTitle}>お問い合わせ</Text>
          <TouchableOpacity style={styles.sheetClose} onPress={onClose}>
            <Text style={styles.sheetCloseTxt}>✕</Text>
          </TouchableOpacity>
        </View>
        {contactSent ? (
          <View style={styles.contactSent}>
            <Text style={styles.contactSentEmoji}>✅</Text>
            <Text style={styles.contactSentTitle}>送信しました</Text>
            <Text style={styles.contactSentSub}>通常2〜3営業日以内にご登録のメールアドレスへご返信いたします。</Text>
            <TouchableOpacity style={styles.contactSentBtn} onPress={onClose}>
              <Text style={styles.contactSentBtnTxt}>閉じる</Text>
            </TouchableOpacity>
          </View>
        ) : (
          <ScrollView style={{ padding: 16 }} keyboardShouldPersistTaps="handled">
            <Text style={styles.contactNote}>お気軽にご連絡ください。通常2〜3営業日以内にご返信いたします。</Text>
            <Text style={styles.contactLabel}>お名前 *</Text>
            <TextInput style={styles.contactInput} value={contactName} onChangeText={setContactName}
              placeholder="例：山田 太郎" placeholderTextColor="#bbb" />
            <Text style={styles.contactLabel}>メールアドレス *</Text>
            <TextInput style={styles.contactInput} value={contactEmail} onChangeText={setContactEmail}
              placeholder="例：taro@example.com" placeholderTextColor="#bbb"
              keyboardType="email-address" autoCapitalize="none" />
            <Text style={styles.contactLabel}>お問い合わせ種別</Text>
            <View style={styles.categoryRow}>
              {['引き取り申請について', 'アプリの不具合', '掲載内容の誤り', 'その他'].map(c => (
                <TouchableOpacity key={c}
                  style={[styles.categoryChip, contactCategory === c && styles.categoryChipActive]}
                  onPress={() => setContactCategory(c)}>
                  <Text style={[styles.categoryChipText, contactCategory === c && styles.categoryChipTextActive]}>{c}</Text>
                </TouchableOpacity>
              ))}
            </View>
            <Text style={styles.contactLabel}>お問い合わせ内容 *</Text>
            <TextInput
              style={[styles.contactInput, styles.contactTextArea]}
              value={contactBody} onChangeText={setContactBody}
              placeholder="ご質問・ご要望をお書きください"
              placeholderTextColor="#bbb" multiline numberOfLines={5} textAlignVertical="top"
            />
            <TouchableOpacity
              style={[styles.contactSendBtn, (!contactName || !contactEmail || !contactBody) && styles.contactSendBtnDisabled]}
              onPress={async () => {
                if (!contactName || !contactEmail || !contactBody) return;
                const { error } = await supabase.from('contacts').insert({
                  name: contactName,
                  email: contactEmail,
                  category: contactCategory || null,
                  body: contactBody,
                });
                if (error) {
                  Alert.alert('送信失敗', 'もう一度お試しください');
                } else {
                  setContactSent(true);
                }
              }}
              disabled={!contactName || !contactEmail || !contactBody}
            >
              <Text style={styles.contactSendBtnTxt}>送信する</Text>
            </TouchableOpacity>
            <View style={{ height: 40 }} />
          </ScrollView>
        )}
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  outer: { flex: 1, backgroundColor: '#EEF8F6' },

  header: {
    paddingTop: 60, paddingBottom: 16, paddingHorizontal: 20,
    flexDirection: 'row', alignItems: 'center',
  },
  headerTitle: { fontSize: 22, fontWeight: '800', color: 'white' },

  container: { flex: 1 },

  // ── 未ログインバナー ──
  guestBanner: {
    margin: 14, borderRadius: 22, backgroundColor: 'white',
    padding: 32, alignItems: 'center', gap: 12,
    shadowColor: '#4FA3A0', shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1, shadowRadius: 12, elevation: 4,
  },
  guestAvatarWrap: {
    width: 80, height: 80, borderRadius: 40,
    backgroundColor: '#D4EEE9', alignItems: 'center', justifyContent: 'center',
    borderWidth: 3, borderColor: '#A8D8CF',
  },
  guestAvatarText: { fontSize: 38 },
  guestTitle: { fontSize: 17, fontWeight: '800', color: '#1a1a1a' },
  guestDesc: { fontSize: 14, color: '#888', textAlign: 'center', lineHeight: 22 },
  loginBtn: {
    marginTop: 8, backgroundColor: '#A8D8CF',
    paddingHorizontal: 40, paddingVertical: 14,
    borderRadius: 999,
    shadowColor: '#4FA3A0', shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25, shadowRadius: 8, elevation: 4,
  },
  loginBtnTxt: { color: 'white', fontSize: 15, fontWeight: '800' },

  // ── プロフィールカード ──
  profileCard: {
    flexDirection: 'row', alignItems: 'flex-start', gap: 16,
    backgroundColor: 'white', margin: 14, borderRadius: 22, padding: 20,
    shadowColor: '#4FA3A0', shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1, shadowRadius: 12, elevation: 4,
  },
  avatarWrap: {
    width: 72, height: 72, borderRadius: 36,
    backgroundColor: '#D4EEE9', alignItems: 'center', justifyContent: 'center',
    borderWidth: 3, borderColor: '#A8D8CF',
  },
  avatarPhoto: { width: 72, height: 72, borderRadius: 36 },
  avatarText: { fontSize: 36 },
  avatarEditBadge: {
    position: 'absolute', bottom: 0, right: 0,
    backgroundColor: '#F08080', width: 22, height: 22, borderRadius: 11,
    alignItems: 'center', justifyContent: 'center',
    borderWidth: 2, borderColor: 'white',
  },
  avatarEditBadgeTxt: { fontSize: 10, color: 'white', fontWeight: '700' },

  profileInfo: { flex: 1, gap: 6 },
  nicknameRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  nickname: { fontSize: 18, fontWeight: '800', color: '#1a1a1a', flex: 1 },
  editChip: {
    backgroundColor: '#FFF0F0', paddingHorizontal: 10, paddingVertical: 4,
    borderRadius: 999, borderWidth: 1, borderColor: '#F08080',
  },
  editChipTxt: { fontSize: 11, color: '#F08080', fontWeight: '700' },
  emailText: { fontSize: 12, color: '#888' },
  prefText: { fontSize: 13, color: '#aaa' },

  nicknameInput: {
    fontSize: 15, fontWeight: '700', color: '#1a1a1a',
    borderWidth: 1.5, borderColor: '#A8D8CF', borderRadius: 10,
    paddingHorizontal: 10, paddingVertical: 8, backgroundColor: '#F8FFFE',
  },
  prefSelector: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    borderWidth: 1, borderColor: '#D4EEE9', borderRadius: 10,
    paddingHorizontal: 10, paddingVertical: 8, backgroundColor: '#F8FFFE',
  },
  prefSelectorText: { fontSize: 13, color: '#4FA3A0', fontWeight: '600' },
  prefArrow: { fontSize: 16, color: '#A8D8CF' },
  cityInput: {
    fontSize: 13, color: '#333',
    borderWidth: 1, borderColor: '#D4EEE9', borderRadius: 10,
    paddingHorizontal: 10, paddingVertical: 8, backgroundColor: '#F8FFFE',
  },
  editBtnsRow: { flexDirection: 'row', gap: 8, marginTop: 2 },
  cancelBtn: { flex: 1, paddingVertical: 8, borderRadius: 10, backgroundColor: '#f0f0f0', alignItems: 'center' },
  cancelBtnTxt: { fontSize: 13, color: '#888', fontWeight: '600' },
  saveBtn: { flex: 2, paddingVertical: 8, borderRadius: 10, backgroundColor: '#F08080', alignItems: 'center' },
  saveBtnTxt: { fontSize: 13, color: 'white', fontWeight: '700' },

  // セクション共通
  sectionTitle: {
    fontSize: 11, fontWeight: '700', color: '#999',
    paddingHorizontal: 18, paddingTop: 20, paddingBottom: 8,
    letterSpacing: 1, textTransform: 'uppercase',
  },
  card: {
    backgroundColor: 'white', marginHorizontal: 14, borderRadius: 18,
    shadowColor: '#000', shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05, shadowRadius: 8, elevation: 2, overflow: 'hidden',
  },
  rowDivider: { borderTopWidth: 0.5, borderTopColor: '#F0EDE8' },
  emptyCard: {
    backgroundColor: 'white', marginHorizontal: 14, borderRadius: 18,
    paddingVertical: 28, alignItems: 'center', gap: 8,
    shadowColor: '#000', shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04, shadowRadius: 6, elevation: 1,
  },
  emptyIcon: { fontSize: 32 },
  emptyText: { fontSize: 13, color: '#ccc' },

  // ── 申請状況 ──
  adoptionRow: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 14 },
  adoptionImg: { width: 52, height: 52, borderRadius: 12, resizeMode: 'cover', flexShrink: 0 },
  adoptionEmojiWrap: {
    width: 52, height: 52, borderRadius: 12, backgroundColor: '#D4EEE9',
    alignItems: 'center', justifyContent: 'center', flexShrink: 0,
  },
  adoptionEmoji: { fontSize: 26 },
  adoptionInfo: { flex: 1 },
  adoptionAnimalName: { fontSize: 14, fontWeight: '700', color: '#1a1a1a' },
  adoptionDate: { fontSize: 11, color: '#aaa', marginTop: 2 },
  statusBadge: {
    flexDirection: 'row', alignItems: 'center', gap: 5,
    paddingHorizontal: 10, paddingVertical: 6, borderRadius: 999, flexShrink: 0,
  },
  statusDot: { width: 7, height: 7, borderRadius: 4 },
  statusLabel: { fontSize: 11, fontWeight: '700' },

  // ── お気に入り ──
  favRow: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 14 },
  favImg: { width: 48, height: 48, borderRadius: 12, resizeMode: 'cover', flexShrink: 0 },
  favEmojiWrap: {
    width: 48, height: 48, borderRadius: 12, backgroundColor: '#D4EEE9',
    alignItems: 'center', justifyContent: 'center', flexShrink: 0,
  },
  favEmoji: { fontSize: 24 },
  favInfo: { flex: 1 },
  favName: { fontSize: 14, fontWeight: '600', color: '#1a1a1a' },
  favSub: { fontSize: 12, color: '#aaa', marginTop: 2 },
  heart: { fontSize: 20, color: '#F08080' },

  // ── 設定メニュー ──
  menuRow: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    paddingVertical: 14, paddingHorizontal: 18,
  },
  menuText: { fontSize: 14, color: '#1a1a1a' },
  menuArrow: { fontSize: 20, color: '#ccc' },

  // テーマカラー
  colorSwatchRow: { flexDirection: 'row', gap: 8, alignItems: 'center' },
  colorSwatch: { width: 24, height: 24, borderRadius: 12 },
  colorSwatchActive: { borderWidth: 2.5, borderColor: '#333', transform: [{ scale: 1.15 }] },

  // 言語トグル
  langToggle: { flexDirection: 'row', borderRadius: 10, overflow: 'hidden', borderWidth: 1, borderColor: '#E5E7EB' },
  langBtn: { paddingHorizontal: 12, paddingVertical: 6, backgroundColor: '#F9FAFB' },
  langBtnTxt: { fontSize: 12, color: '#888', fontWeight: '600' },
  langBtnTxtActive: { color: 'white', fontWeight: '700' },

  // ── モーダル共通 ──
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.4)', justifyContent: 'center', alignItems: 'center' },
  sheetContainer: { flex: 1, backgroundColor: '#EEF8F6' },
  sheetHeader: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    paddingHorizontal: 20, paddingTop: 56, paddingBottom: 16,
    backgroundColor: 'white', borderBottomWidth: 0.5, borderBottomColor: '#EDE8E0',
  },
  sheetTitle: { fontSize: 17, fontWeight: '800', color: '#1a1a1a' },
  sheetClose: {
    width: 36, height: 36, borderRadius: 18, backgroundColor: '#EDE8E0',
    alignItems: 'center', justifyContent: 'center',
  },
  sheetCloseTxt: { fontSize: 15, color: '#555', fontWeight: '700' },
  sheetItem: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    paddingHorizontal: 20, paddingVertical: 15,
    backgroundColor: 'white', borderBottomWidth: 0.5, borderBottomColor: '#F0EDE8',
  },
  sheetItemText: { fontSize: 15, color: '#1a1a1a' },
  sheetCheck: { fontSize: 16, color: '#F08080', fontWeight: '700' },

  // アバター選択
  avatarPicker: { backgroundColor: 'white', borderRadius: 20, padding: 20, width: 280 },
  avatarPickerTitle: { fontSize: 15, fontWeight: '700', color: '#1a1a1a', textAlign: 'center', marginBottom: 12 },
  avatarPickerSub: { fontSize: 11, color: '#aaa', textAlign: 'center', marginTop: 12, marginBottom: 10 },
  photoPickerBtn: { backgroundColor: '#D4EEE9', borderRadius: 12, paddingVertical: 11, alignItems: 'center' },
  photoPickerBtnTxt: { fontSize: 14, fontWeight: '700', color: '#2D4A47' },
  photoRemoveBtn: { marginTop: 8, alignItems: 'center' },
  photoRemoveBtnTxt: { fontSize: 12, color: '#E24B4A' },
  avatarGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, justifyContent: 'center' },
  avatarOption: { width: 60, height: 60, borderRadius: 16, backgroundColor: '#E8F5F3', alignItems: 'center', justifyContent: 'center' },
  avatarOptionSelected: { backgroundColor: '#FFE4E4', borderWidth: 2, borderColor: '#F08080' },
  avatarOptionText: { fontSize: 28 },

  // 通知設定
  notifDesc: { fontSize: 13, color: '#aaa', padding: 16 },
  notifRow: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 18, paddingVertical: 14, backgroundColor: 'white' },
  notifInfo: { flex: 1 },
  notifLabel: { fontSize: 14, color: '#1a1a1a', fontWeight: '600' },
  notifSubLabel: { fontSize: 12, color: '#aaa', marginTop: 2 },

  // プライバシーポリシー
  privacyContent: { padding: 20 },
  privacyUpdated: { fontSize: 12, color: '#aaa', marginBottom: 20 },
  privacySection: { marginBottom: 22 },
  privacySectionTitle: { fontSize: 14, fontWeight: '800', color: '#1a1a1a', marginBottom: 8 },
  privacySectionBody: { fontSize: 14, color: '#555', lineHeight: 22 },

  // お問い合わせ
  contactNote: { fontSize: 13, color: '#aaa', marginBottom: 20 },
  contactLabel: { fontSize: 12, fontWeight: '700', color: '#555', marginBottom: 6, marginTop: 4 },
  contactInput: {
    borderWidth: 1, borderColor: '#EDE8E0', borderRadius: 12,
    padding: 11, fontSize: 14, color: '#222', marginBottom: 14, backgroundColor: 'white',
  },
  contactTextArea: { height: 110, textAlignVertical: 'top' },
  categoryRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 14 },
  categoryChip: { paddingHorizontal: 12, paddingVertical: 7, borderRadius: 999, backgroundColor: '#f0f0f0' },
  categoryChipActive: { backgroundColor: '#FFE4E4' },
  categoryChipText: { fontSize: 12, color: '#888' },
  categoryChipTextActive: { color: '#2D4A47', fontWeight: '700' },
  contactSendBtn: { backgroundColor: '#F08080', padding: 14, borderRadius: 14, alignItems: 'center' },
  contactSendBtnDisabled: { backgroundColor: '#c0c0c0' },
  contactSendBtnTxt: { color: 'white', fontSize: 15, fontWeight: '700' },
  contactSent: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 40, gap: 12 },
  contactSentEmoji: { fontSize: 56 },
  contactSentTitle: { fontSize: 20, fontWeight: '800', color: '#1a1a1a' },
  contactSentSub: { fontSize: 14, color: '#888', textAlign: 'center', lineHeight: 22 },
  contactSentBtn: { marginTop: 8, backgroundColor: '#F08080', paddingHorizontal: 32, paddingVertical: 12, borderRadius: 999 },
  contactSentBtnTxt: { color: 'white', fontSize: 14, fontWeight: '700' },
});
