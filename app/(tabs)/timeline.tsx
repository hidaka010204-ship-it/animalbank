import { Ionicons } from '@expo/vector-icons';
import * as FileSystem from 'expo-file-system/legacy';
import * as ImageManipulator from 'expo-image-manipulator';
import * as ImagePicker from 'expo-image-picker';
import * as Location from 'expo-location';
import { LinearGradient } from 'expo-linear-gradient';
import { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Alert, Animated, Dimensions, Easing, FlatList, Image, Keyboard, KeyboardAvoidingView, Modal, Platform, ScrollView, Share, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { useRouter } from 'expo-router';
import { Image as ExpoImage } from 'expo-image';
import { supabase } from '../../lib/supabase';
import { useApp } from '../_appContext';

type Reply = {
  id: string;
  avatar: string;
  name: string;
  time: string;
  text: string;
  images: string[];
};

type Post = {
  id: string;
  type: string;
  avatar: string;
  name: string;
  time: string;
  text: string;
  location: string;
  location_prefecture: string;
  location_city: string;
  images: string[];
  likes: number;
  liked: boolean;
  replies: Reply[];
  user_id: string | null;
};

// Supabase は UTC タイムスタンプを返す。末尾に Z が無い場合もあるので明示的に UTC として解釈する。
function parseUTC(iso: string): Date {
  if (!iso) return new Date(0);
  // 末尾が Z / +xx:xx / -xx:xx でなければ UTC として扱う
  const hasOffset = /Z$|[+-]\d{2}:\d{2}$/.test(iso);
  return new Date(hasOffset ? iso : iso + 'Z');
}

function formatTime(iso: string): string {
  const d = parseUTC(iso);
  if (isNaN(d.getTime())) return '不明';
  const now = new Date();
  const diff = Math.floor((now.getTime() - d.getTime()) / 1000);

  // JST で日付比較（UTC+9）
  const jst = new Date(d.getTime() + 9 * 60 * 60 * 1000);
  const nowJst = new Date(now.getTime() + 9 * 60 * 60 * 1000);

  const postDay = new Date(Date.UTC(jst.getUTCFullYear(), jst.getUTCMonth(), jst.getUTCDate()));
  const todayDay = new Date(Date.UTC(nowJst.getUTCFullYear(), nowJst.getUTCMonth(), nowJst.getUTCDate()));
  const daysDiff = Math.round((todayDay.getTime() - postDay.getTime()) / 86400000);

  if (daysDiff === 0) {
    // 当日：時刻のみ（直近1分は「たった今」、1時間以内は「N分前」）
    if (diff < 60) return 'たった今';
    if (diff < 3600) return `${Math.floor(diff / 60)}分前`;
    const hh = jst.getUTCHours().toString().padStart(2, '0');
    const mm = jst.getUTCMinutes().toString().padStart(2, '0');
    return `${hh}:${mm}`;
  }
  if (daysDiff <= 6) {
    // 1〜6日前：相対表示
    return `${daysDiff}日前`;
  }
  // 7日以上前：日付表示
  const mo = jst.getUTCMonth() + 1;
  const day = jst.getUTCDate();
  if (jst.getUTCFullYear() === nowJst.getUTCFullYear()) return `${mo}/${day}`;
  return `${jst.getUTCFullYear()}/${mo}/${day}`;
}

function parseImages(raw: unknown): string[] {
  if (!raw) return [];
  // Supabase JS client が text[] / jsonb を JS 配列に変換している場合
  if (Array.isArray(raw)) {
    return (raw as unknown[]).filter((u): u is string => typeof u === 'string' && u.length > 0);
  }
  if (typeof raw === 'string') {
    const s = raw.trim();
    // JSON 配列文字列 ["url1","url2"]
    if (s.startsWith('[')) {
      try {
        const p = JSON.parse(s);
        return Array.isArray(p)
          ? p.filter((u: unknown): u is string => typeof u === 'string' && u.length > 0)
          : [];
      } catch { return []; }
    }
    // PostgreSQL ネイティブ配列形式 {url1,url2} または {"url1","url2"}
    if (s.startsWith('{') && s.endsWith('}')) {
      return s.slice(1, -1)
        .split(',')
        .map(u => u.replace(/^"|"$/g, '').trim())
        .filter(u => u.length > 0);
    }
    // 単一 URL 文字列
    if (s.length > 0) return [s];
  }
  return [];
}

function mapToPost(row: Record<string, unknown>): Post {
  const images = parseImages(row.images);
  console.log(
    `[mapToPost] id=${row.id}`,
    `parsed images(${images.length}):`, images,
  );
  return {
    id: row.id as string,
    type: (row.type as string) ?? 'other',
    avatar: (row.user_avatar as string) || '👤',
    name: (row.user_nickname as string) || '投稿者',
    time: formatTime(row.created_at as string),
    text: (row.content as string) ?? '',
    location: [row.location_prefecture as string, row.location_city as string].filter(Boolean).join(' '),
    location_prefecture: (row.location_prefecture as string) || '',
    location_city: (row.location_city as string) || '',
    images,
    likes: 0,
    liked: false,
    replies: [],
    user_id: (row.user_id as string) ?? null,
  };
}

const badges: Record<string, { label: string; bg: string; color: string; emoji: string }> = {
  lost:  { label: '迷子情報',    bg: '#FFE4E4', color: '#C05050', emoji: '🔍' },
  found: { label: '保護情報',    bg: '#D4EEE9', color: '#2D4A47', emoji: '🤝' },
  pet:   { label: 'ペットの様子', bg: '#FFF0E4', color: '#8A5030', emoji: '🐾' },
  other: { label: 'その他',      bg: '#F5EDD8', color: '#6B4A20', emoji: '📢' },
};

const filters = [
  { key: 'all',   label: 'すべて' },
  { key: 'lost',  label: '🔍 迷子情報' },
  { key: 'found', label: '🤝 保護情報' },
  { key: 'pet',   label: '🐾 ペットの様子' },
  { key: 'other', label: '📢 その他' },
];

const types = [
  { key: 'lost',  label: '🔍 迷子情報' },
  { key: 'found', label: '🤝 保護情報' },
  { key: 'pet',   label: '🐾 ペットの様子' },
  { key: 'other', label: '📢 その他' },
];

function WiggleAnimal({ emoji, style }: { emoji: string; style?: object }) {
  const rot = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    Animated.loop(
      Animated.sequence([
        Animated.timing(rot, { toValue: 1, duration: 300, useNativeDriver: true }),
        Animated.timing(rot, { toValue: -1, duration: 300, useNativeDriver: true }),
        Animated.timing(rot, { toValue: 1, duration: 300, useNativeDriver: true }),
        Animated.timing(rot, { toValue: 0, duration: 300, useNativeDriver: true }),
        Animated.delay(2200),
      ])
    ).start();
  }, []);
  const rotate = rot.interpolate({ inputRange: [-1, 1], outputRange: ['-12deg', '12deg'] });
  return <Animated.Text style={[{ transform: [{ rotate }] }, style]}>{emoji}</Animated.Text>;
}

export default function TimelineScreen() {
  const router = useRouter();
  const { userProfile, session } = useApp();

  const requireLogin = (action: string) => {
    if (!session) {
      Alert.alert(
        'ログインが必要です',
        `${action}にはログインが必要です`,
        [
          { text: 'キャンセル', style: 'cancel' },
          { text: 'ログイン', onPress: () => router.push('/auth' as any) },
        ]
      );
      return false;
    }
    return true;
  };
  const [posts, setPosts] = useState<Post[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  const offsetRef = useRef(0);
  const [submitting, setSubmitting] = useState(false);
  const [activeFilter, setActiveFilter] = useState('all');

  // 投稿フォーム
  const [showCompose, setShowCompose] = useState(false);
  const [composeType, setComposeType] = useState('lost');
  const [composeText, setComposeText] = useState('');
  const [composePrefecture, setComposePrefecture] = useState('');
  const [composeCity, setComposeCity] = useState('');
  const [composeImages, setComposeImages] = useState<string[]>([]);

  // 画像フルスクリーン
  const [lightboxUri, setLightboxUri] = useState<string | null>(null);

  // 投稿編集
  const [editingPost, setEditingPost] = useState<Post | null>(null);
  const [editType, setEditType] = useState('lost');
  const [editText, setEditText] = useState('');
  const [editPrefecture, setEditPrefecture] = useState('');
  const [editCity, setEditCity] = useState('');
  const [editImages, setEditImages] = useState<string[]>([]);
  const [editSubmitting, setEditSubmitting] = useState(false);

  // 返信
  const [expandedReplies, setExpandedReplies] = useState<Set<string>>(new Set());
  const [replyInputs, setReplyInputs] = useState<Record<string, string>>({});
  const [replyImages, setReplyImages] = useState<Record<string, string[]>>({});

  const filtered = activeFilter === 'all' ? posts : posts.filter(p => p.type === activeFilter);

  const PAGE_SIZE = 20;

  const fetchPosts = async (reset = true) => {
    if (reset) {
      setLoading(true);
      offsetRef.current = 0;
    } else {
      setLoadingMore(true);
    }
    const from = offsetRef.current;
    const to = from + PAGE_SIZE - 1;

    const { data, error } = await supabase
      .from('posts')
      .select('id, type, content, location_prefecture, location_city, user_nickname, user_avatar, user_id, images, created_at')
      .order('created_at', { ascending: false })
      .range(from, to);

    if (error) {
      console.error('[fetchPosts] エラー:', error);
    } else {
      const newPosts = (data ?? []).map(row => mapToPost(row as Record<string, unknown>));
      if (reset) {
        setPosts(newPosts);
      } else {
        setPosts(prev => [...prev, ...newPosts]);
      }
      offsetRef.current = from + newPosts.length;
      setHasMore(newPosts.length === PAGE_SIZE);
    }

    if (reset) setLoading(false);
    else setLoadingMore(false);
  };

  const loadMore = () => {
    if (!hasMore || loadingMore || loading) return;
    fetchPosts(false);
  };

  useEffect(() => { fetchPosts(true); }, []);

  const uploadPostImages = async (uris: string[], postId: string): Promise<string[]> => {
    const urls: string[] = [];
    for (let i = 0; i < uris.length; i++) {
      try {
        const uri = uris[i];
        if (!uri) continue;

        // 1. ImageManipulator で JPEG に変換（変換失敗は catch で捕捉）
        const converted = await ImageManipulator.manipulateAsync(
          uri,
          [],
          { compress: 0.85, format: ImageManipulator.SaveFormat.JPEG },
        );
        console.log(`[uploadPostImages] JPEG変換完了 i=${i} uri=${converted.uri}`);

        // 2. FileSystem で Base64 読み込み → Uint8Array に変換
        const base64 = await FileSystem.readAsStringAsync(converted.uri, {
          encoding: FileSystem.EncodingType.Base64,
        });
        if (!base64 || base64.length === 0) {
          console.warn(`[uploadPostImages] base64 が空 i=${i}`);
          continue;
        }
        const binaryStr = atob(base64);
        const bytes = new Uint8Array(binaryStr.length);
        for (let j = 0; j < binaryStr.length; j++) {
          bytes[j] = binaryStr.charCodeAt(j);
        }
        console.log(`[uploadPostImages] ArrayBuffer 作成 i=${i} byteLength=${bytes.byteLength}`);

        // 3. Supabase Storage にアップロード
        const path = `${postId}/${i}.jpg`;
        const { data, error } = await supabase.storage
          .from('post-images')
          .upload(path, bytes, { contentType: 'image/jpeg', upsert: true });

        if (!error && data) {
          const { data: { publicUrl } } = supabase.storage.from('post-images').getPublicUrl(data.path);
          if (publicUrl) urls.push(publicUrl);
          console.log(`[uploadPostImages] アップロード成功 i=${i} url=${publicUrl}`);
        } else if (error) {
          console.warn(`[uploadPostImages] アップロードエラー i=${i}:`, error.message);
        }
      } catch (e) {
        console.warn(`[uploadPostImages] 例外 i=${i}:`, e);
      }
    }
    return urls;
  };

  // ピック時に JPEG 変換のみ行う（getInfoAsync なし）
  const convertToJpeg = async (uris: string[]): Promise<string[]> => {
    const results: string[] = [];
    for (const uri of uris) {
      try {
        const result = await ImageManipulator.manipulateAsync(
          uri, [], { compress: 0.85, format: ImageManipulator.SaveFormat.JPEG }
        );
        results.push(result.uri);
      } catch (e) {
        console.warn('[convertToJpeg] 変換失敗:', e);
      }
    }
    return results;
  };

  const pickComposeImages = async () => {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsMultipleSelection: true,
      quality: 0.8,
    });
    if (!result.canceled) {
      const uris = await convertToJpeg(result.assets.map(a => a.uri));
      setComposeImages(prev => [...prev, ...uris]);
    }
  };

  const pickReplyImages = async (postId: string) => {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsMultipleSelection: true,
      quality: 0.8,
    });
    if (!result.canceled) {
      const uris = await convertToJpeg(result.assets.map(a => a.uri));
      setReplyImages(prev => ({
        ...prev,
        [postId]: [...(prev[postId] || []), ...uris],
      }));
    }
  };

  const removeReplyImage = (postId: string, index: number) => {
    setReplyImages(prev => ({
      ...prev,
      [postId]: (prev[postId] || []).filter((_, i) => i !== index),
    }));
  };

  const handleReportPost = (postId: string) => {
    if (!requireLogin('通報')) return;
    const submit = async (reason: string) => {
      const { error } = await supabase.from('reports').insert({
        target_type: 'post',
        target_id: postId,
        reason,
        reporter_id: session!.user.id,
      });
      if (error) {
        Alert.alert('エラー', 'もう一度お試しください');
      } else {
        Alert.alert('通報しました', '確認後対応いたします');
      }
    };
    Alert.alert(
      '通報',
      '通報の理由を選択してください',
      [
        { text: '不適切なコンテンツ', onPress: () => submit('不適切なコンテンツ') },
        { text: '虚偽情報',           onPress: () => submit('虚偽情報') },
        { text: '迷惑行為',           onPress: () => submit('迷惑行為') },
        { text: 'その他',             onPress: () => submit('その他') },
        { text: 'キャンセル', style: 'cancel' },
      ]
    );
  };

  const handleSharePost = async (post: Post) => {
    const badge = badges[post.type];
    const lines = [
      `【あにまるバンク】${badge ? badge.emoji + ' ' + badge.label : '投稿'}`,
      post.location ? `📍 ${post.location}` : '',
      post.text,
      '#あにまるバンク',
    ].filter(Boolean);
    try {
      await Share.share({ message: lines.join('\n') });
    } catch {
      // キャンセルまたはエラー
    }
  };

  const submitPost = async () => {
    console.log('[submitPost] 開始', { nickname: userProfile.nickname });
    if (!composeText.trim()) {
      Alert.alert('コメントを入力してください');
      return;
    }
    console.log('[submitPost] 開始', { type: composeType, textLen: composeText.trim().length, imageCount: composeImages.length });
    setSubmitting(true);
    try {
      const locationPrefecture = composePrefecture.trim() || null;
      const locationCity = composeCity.trim() || null;
      console.log('[submitPost] INSERT posts', { type: composeType, location_prefecture: locationPrefecture, location_city: locationCity });
      console.log('[submitPost] avatar', { avatar: userProfile.avatar, photoUri: userProfile.photoUri });
      const userId = session?.user?.id ?? null;
      console.log('[submitPost] user_id:', userId);

      let postLat: number | null = null;
      let postLng: number | null = null;
      try {
        const { status } = await Location.requestForegroundPermissionsAsync();
        if (status === 'granted') {
          const pos = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
          postLat = pos.coords.latitude;
          postLng = pos.coords.longitude;
          console.log('[submitPost] 位置情報取得:', { lat: postLat, lng: postLng });
        } else {
          console.log('[submitPost] 位置情報の権限が拒否されました');
        }
      } catch (locErr) {
        console.warn('[submitPost] 位置情報取得エラー（無視して続行）:', locErr);
      }

      const { data: inserted, error: insertError } = await supabase
        .from('posts')
        .insert({
          type: composeType,
          content: composeText.trim() || null,
          location_prefecture: locationPrefecture,
          location_city: locationCity,
          user_nickname: userProfile.nickname || null,
          user_avatar: userProfile.avatar || null,
          user_id: userId,
          lat: postLat,
          lng: postLng,
        })
        .select('id')
        .single();
      if (insertError) {
        console.error('[submitPost] INSERT エラー:', insertError);
        Alert.alert('投稿エラー', insertError.message);
        return;
      }
      console.log('[submitPost] INSERT 成功 id:', inserted?.id);

      let imageUrls: string[] = [];
      if (composeImages.length > 0 && inserted?.id) {
        console.log('[submitPost] 画像アップロード開始', { count: composeImages.length, postId: inserted.id, type: composeType });
        imageUrls = await uploadPostImages(composeImages, inserted.id);
        console.log('[submitPost] 画像アップロード完了', { uploaded: imageUrls.length, failed: composeImages.length - imageUrls.length, urls: imageUrls });
        if (imageUrls.length > 0) {
          console.log('[submitPost] 画像URL UPDATE', { postId: inserted.id, user_id: userId, count: imageUrls.length });
          // user_id でも絞り込み（RLS対策：自分の投稿のみ更新できる場合に備えて）
          const updateQuery = userId
            ? supabase.from('posts').update({ images: imageUrls }).eq('id', inserted.id).eq('user_id', userId)
            : supabase.from('posts').update({ images: imageUrls }).eq('id', inserted.id);
          const { data: updateData, error: updateError } = await updateQuery.select('id, images');
          if (updateError) {
            console.error('[submitPost] 画像URL UPDATE エラー:', updateError);
            Alert.alert('画像の保存に失敗しました', updateError.message);
          } else if (!updateData || updateData.length === 0) {
            console.warn('[submitPost] 画像URL UPDATE が 0 件（RLSまたは条件不一致）');
            Alert.alert('画像の保存に失敗しました', 'ログイン状態を確認してください。ログインしてから投稿すると画像が保存されます。');
          } else {
            console.log('[submitPost] 画像URL UPDATE 成功', updateData);
          }
        } else {
          console.warn('[submitPost] 全画像のアップロードに失敗しました');
          Alert.alert('画像のアップロードに失敗しました', '投稿は保存されましたが、画像の添付に失敗しました。');
        }
      }

      setComposeText('');
      setComposePrefecture('');
      setComposeCity('');
      setComposeImages([]);
      setShowCompose(false);
      console.log('[submitPost] 完了、フィード再取得');
      await fetchPosts();
    } catch (e) {
      console.error('[submitPost] 予期しないエラー:', e);
      Alert.alert('エラーが発生しました', '時間をおいて再度お試しください。');
    } finally {
      setSubmitting(false);
    }
  };

  const toggleLike = (id: string) => {
    setPosts(prev => prev.map(p =>
      p.id === id ? { ...p, liked: !p.liked, likes: p.liked ? p.likes - 1 : p.likes + 1 } : p
    ));
  };

  const toggleReplies = (id: string) => {
    setExpandedReplies(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const openEdit = (post: Post) => {
    setEditingPost(post);
    setEditType(post.type);
    setEditText(post.text);
    setEditPrefecture(post.location_prefecture);
    setEditCity(post.location_city);
    setEditImages([...post.images]);
  };

  const pickEditImages = async () => {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsMultipleSelection: true,
      quality: 0.8,
    });
    if (!result.canceled) {
      const uris = await convertToJpeg(result.assets.map(a => a.uri));
      setEditImages(prev => [...prev, ...uris]);
    }
  };

  const saveEdit = async () => {
    if (!editingPost) return;
    setEditSubmitting(true);
    try {
      const userId = session?.user?.id ?? null;

      // 既存URLとローカル新規画像を分離
      const existingUrls = editImages.filter(uri => uri.startsWith('http'));
      const newLocalUris = editImages.filter(uri => !uri.startsWith('http'));

      // 新規画像をアップロード
      let newUrls: string[] = [];
      if (newLocalUris.length > 0) {
        newUrls = await uploadPostImages(newLocalUris, editingPost.id);
      }

      const finalImages = [...existingUrls, ...newUrls];

      const { error } = await supabase
        .from('posts')
        .update({
          type: editType,
          content: editText.trim() || null,
          location_prefecture: editPrefecture.trim() || null,
          location_city: editCity.trim() || null,
          images: finalImages.length > 0 ? finalImages : null,
        })
        .eq('id', editingPost.id)
        .eq('user_id', userId!);

      if (error) {
        Alert.alert('更新エラー', error.message);
      } else {
        setEditingPost(null);
        await fetchPosts();
      }
    } catch (e) {
      console.error('[saveEdit] エラー:', e);
      Alert.alert('エラーが発生しました', '時間をおいて再度お試しください。');
    } finally {
      setEditSubmitting(false);
    }
  };

  const deletePost = async (postId: string) => {
    Alert.alert('投稿を削除', 'この投稿を削除しますか？', [
      { text: 'キャンセル', style: 'cancel' },
      {
        text: '削除', style: 'destructive', onPress: async () => {
          const { error } = await supabase.from('posts').delete().eq('id', postId);
          if (error) {
            Alert.alert('削除エラー', error.message);
          } else {
            setPosts(prev => prev.filter(p => p.id !== postId));
          }
        },
      },
    ]);
  };

  const submitReply = (postId: string) => {
    const text = replyInputs[postId]?.trim() || '';
    const images = replyImages[postId] || [];
    if (!text && images.length === 0) return;
    const reply: Reply = {
      id: Date.now().toString(),
      avatar: '👤',
      name: 'あなた',
      time: 'たった今',
      text,
      images,
    };
    setPosts(prev => prev.map(p =>
      p.id === postId ? { ...p, replies: [...p.replies, reply] } : p
    ));
    setReplyInputs(prev => ({ ...prev, [postId]: '' }));
    setReplyImages(prev => ({ ...prev, [postId]: [] }));
  };

  const renderItem = ({ item: post }: { item: Post }) => {
    const badge = badges[post.type];
    const repliesOpen = expandedReplies.has(post.id);
    const pendingReplyImages = replyImages[post.id] || [];

    return (
      <View style={styles.item}>
        <View style={styles.itemMain}>
          <View style={styles.avatar}>
            {post.avatar.startsWith('http') ? (
              <Image source={{ uri: post.avatar }} style={styles.avatarImg} />
            ) : (
              <Text style={styles.avatarText}>{post.avatar}</Text>
            )}
          </View>
          <View style={styles.body}>
            <View style={styles.itemHead}>
              <Text style={styles.itemName}>{post.name}</Text>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                <Text style={styles.itemTime}>{post.time}</Text>
                {session?.user?.id && post.user_id !== session.user.id && (
                  <TouchableOpacity onPress={() => handleReportPost(post.id)} hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}>
                    <Text style={styles.reportBtnText}>通報</Text>
                  </TouchableOpacity>
                )}
              </View>
            </View>
            {post.location ? <Text style={styles.itemLocation}>📍 {post.location}</Text> : null}
            {post.text ? <Text style={styles.itemText}>{post.text}</Text> : null}

            {post.images.length > 0 && (
              <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.imageScroll}>
                {post.images.map((uri, i) => (
                  <TouchableOpacity key={i} onPress={() => setLightboxUri(uri)} activeOpacity={0.85}>
                    <ExpoImage
                      source={{ uri }}
                      style={styles.postImg}
                      contentFit="cover"
                      priority="high"
                      cachePolicy="memory-disk"
                    />
                  </TouchableOpacity>
                ))}
              </ScrollView>
            )}

            {badge && (
              <View style={[styles.badge, { backgroundColor: badge.bg }]}>
                <Text style={[styles.badgeText, { color: badge.color }]}>{badge.emoji} {badge.label}</Text>
              </View>
            )}

            <View style={styles.actions}>
              <TouchableOpacity style={styles.actionBtn} onPress={() => toggleLike(post.id)}>
                <Text style={styles.actionIcon}>{post.liked ? '❤️' : '🤍'}</Text>
                <Text style={[styles.actionCount, post.liked && styles.actionCountLiked]}>{post.likes}</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.actionBtn} onPress={() => toggleReplies(post.id)}>
                <Text style={styles.actionIcon}>💬</Text>
                <Text style={styles.actionCount}>{post.replies.length}</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.actionBtn} onPress={() => handleSharePost(post)}>
                <Ionicons name="paper-plane-outline" size={17} color="#aaa" />
              </TouchableOpacity>
              {session?.user?.id && post.user_id === session.user.id && (
                <>
                  <TouchableOpacity style={styles.actionBtn} onPress={() => openEdit(post)}>
                    <Text style={styles.actionIcon}>✏️</Text>
                  </TouchableOpacity>
                  <TouchableOpacity style={styles.actionBtn} onPress={() => deletePost(post.id)}>
                    <Text style={styles.actionIcon}>🗑️</Text>
                  </TouchableOpacity>
                </>
              )}
            </View>
          </View>
        </View>

        {repliesOpen && (
          <View style={styles.replySection}>
            {post.replies.map(r => (
              <View key={r.id} style={styles.replyItem}>
                <View style={styles.replyAvatar}><Text style={styles.replyAvatarText}>{r.avatar}</Text></View>
                <View style={styles.replyBody}>
                  <View style={styles.replyHead}>
                    <Text style={styles.replyName}>{r.name}</Text>
                    <Text style={styles.replyTime}>{r.time}</Text>
                  </View>
                  {r.text ? <Text style={styles.replyText}>{r.text}</Text> : null}
                  {r.images.length > 0 && (
                    <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginTop: 5 }}>
                      {r.images.map((uri, i) => (
                        <TouchableOpacity key={i} onPress={() => setLightboxUri(uri)} activeOpacity={0.85}>
                          <Image source={{ uri }} style={styles.replyImg} />
                        </TouchableOpacity>
                      ))}
                    </ScrollView>
                  )}
                </View>
              </View>
            ))}

            {pendingReplyImages.length > 0 && (
              <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.replyImgPreview}>
                {pendingReplyImages.map((uri, i) => (
                  <View key={i} style={styles.replyPreviewWrap}>
                    <Image source={{ uri }} style={styles.replyPreviewImg} />
                    <TouchableOpacity style={styles.removeSmallBtn} onPress={() => removeReplyImage(post.id, i)}>
                      <Text style={styles.removeBtnText}>✕</Text>
                    </TouchableOpacity>
                  </View>
                ))}
              </ScrollView>
            )}

            <View style={styles.replyInputRow}>
              <TouchableOpacity style={styles.replyPhotoBtn} onPress={() => pickReplyImages(post.id)}>
                <Text style={styles.replyPhotoBtnText}>📷</Text>
              </TouchableOpacity>
              <TextInput
                style={styles.replyInput}
                placeholder="返信を入力..."
                placeholderTextColor="#aaa"
                value={replyInputs[post.id] || ''}
                onChangeText={t => setReplyInputs(prev => ({ ...prev, [post.id]: t }))}
              />
              <TouchableOpacity
                style={[styles.replySendBtn, !replyInputs[post.id]?.trim() && pendingReplyImages.length === 0 && styles.replySendDisabled]}
                onPress={() => submitReply(post.id)}
              >
                <Text style={styles.replySendText}>送信</Text>
              </TouchableOpacity>
            </View>
          </View>
        )}
      </View>
    );
  };

  return (
    <View style={styles.outer}>
      {/* ヘッダー */}
      <LinearGradient colors={['#4FA3A0', '#A8D8CF']} style={styles.header}>
        <Text style={styles.headerTitle}>タイムライン</Text>
        <TouchableOpacity style={styles.composeBtn} onPress={() => { if (requireLogin('投稿')) setShowCompose(true); }}>
          <Text style={styles.composeBtnText}>＋ 投稿</Text>
        </TouchableOpacity>
      </LinearGradient>

      {/* フィルタータブ */}
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.filterBar} contentContainerStyle={styles.filterContent}>
        {filters.map(f => (
          <TouchableOpacity key={f.key} onPress={() => setActiveFilter(f.key)}
            style={[styles.filterTab, activeFilter === f.key && styles.filterTabActive]}>
            <Text style={[styles.filterTabText, activeFilter === f.key && styles.filterTabTextActive]}>{f.label}</Text>
          </TouchableOpacity>
        ))}
      </ScrollView>

      <FlatList
        data={filtered}
        keyExtractor={item => item.id}
        style={styles.list}
        keyboardShouldPersistTaps="handled"
        initialNumToRender={10}
        maxToRenderPerBatch={5}
        windowSize={5}
        removeClippedSubviews
        onEndReached={loadMore}
        onEndReachedThreshold={0.3}
        renderItem={renderItem}
        ListHeaderComponent={
          <>
            {showCompose && (
              <View style={styles.composeBox}>
                <View style={styles.composeHeader}>
                  <Text style={styles.composeTitle}>📝 新規投稿</Text>
                  <TouchableOpacity onPress={() => setShowCompose(false)}>
                    <Text style={styles.composeClose}>✕</Text>
                  </TouchableOpacity>
                </View>

                <View style={styles.typeRow}>
                  {types.map(t => (
                    <TouchableOpacity key={t.key} onPress={() => setComposeType(t.key)}
                      style={[styles.typeBtn, composeType === t.key && styles.typeBtnActive]}>
                      <Text style={[styles.typeBtnText, composeType === t.key && styles.typeBtnTextActive]}>{t.label}</Text>
                    </TouchableOpacity>
                  ))}
                </View>

                <View style={styles.locationRow}>
                  <TextInput
                    style={[styles.locationInput, { flex: 1 }]}
                    value={composePrefecture}
                    onChangeText={setComposePrefecture}
                    placeholder="都道府県（例：岐阜県）"
                    placeholderTextColor="#aaa"
                  />
                  <TextInput
                    style={[styles.locationInput, { flex: 1.4 }]}
                    value={composeCity}
                    onChangeText={setComposeCity}
                    placeholder="市区町村（例：中津川市）"
                    placeholderTextColor="#aaa"
                  />
                </View>

                <TextInput
                  style={styles.composeInput}
                  value={composeText}
                  onChangeText={setComposeText}
                  placeholder="内容を入力してください..."
                  placeholderTextColor="#999"
                  multiline
                  numberOfLines={4}
                  textAlignVertical="top"
                />

                {composeImages.length > 0 && (
                  <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.previewScroll}>
                    {composeImages.map((uri, i) => (
                      <View key={i} style={styles.previewWrap}>
                        <Image source={{ uri }} style={styles.previewImg} />
                        <TouchableOpacity style={styles.removeBtn} onPress={() => setComposeImages(prev => prev.filter((_, j) => j !== i))}>
                          <Text style={styles.removeBtnText}>✕</Text>
                        </TouchableOpacity>
                      </View>
                    ))}
                  </ScrollView>
                )}

                <View style={styles.composeActions}>
                  <TouchableOpacity style={styles.photoBtn} onPress={pickComposeImages}>
                    <Text style={styles.photoBtnText}>📷 写真</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[styles.submitBtn, (!composeText.trim() || submitting) ? styles.submitBtnDisabled : null]}
                    onPress={submitPost}
                    disabled={submitting || !composeText.trim()}
                  >
                    {submitting ? <ActivityIndicator color="white" /> : <Text style={styles.submitBtnText}>投稿する</Text>}
                  </TouchableOpacity>
                </View>
              </View>
            )}
            {loading && (
              <View style={styles.loadingBox}>
                <ActivityIndicator color="#A8D8CF" />
              </View>
            )}
          </>
        }
        ListEmptyComponent={!loading ? (
          <View style={styles.empty}>
            <Text style={styles.emptyEmoji}>🐾</Text>
            <Text style={styles.emptyText}>投稿がありません</Text>
          </View>
        ) : null}
        ListFooterComponent={
          <>
            {loadingMore && (
              <View style={styles.loadingBox}>
                <ActivityIndicator color="#A8D8CF" />
              </View>
            )}
            {!hasMore && posts.length > 0 && (
              <View style={styles.footerDeco}>
                <Text style={styles.footerDecoText}>🐕　🐈　🐾　🐶　🐱</Text>
              </View>
            )}
            <View style={{ height: 30 }} />
          </>
        }
      />

      {/* 投稿編集モーダル */}
      <Modal visible={!!editingPost} animationType="slide" transparent onRequestClose={() => setEditingPost(null)}>
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          style={styles.editOverlay}
        >
          <View style={styles.editSheet}>
            {/* ヘッダー */}
            <View style={styles.composeHeader}>
              <Text style={styles.composeTitle}>✏️ 投稿を編集</Text>
              <View style={{ flexDirection: 'row', gap: 10, alignItems: 'center' }}>
                <TouchableOpacity onPress={() => Keyboard.dismiss()} style={styles.kbDoneBtn}>
                  <Text style={styles.kbDoneBtnText}>完了</Text>
                </TouchableOpacity>
                <TouchableOpacity onPress={() => setEditingPost(null)}>
                  <Text style={styles.composeClose}>✕</Text>
                </TouchableOpacity>
              </View>
            </View>

            {/* スクロール可能エリア */}
            <ScrollView style={{ flex: 1 }} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
              {/* 種別 */}
              <View style={styles.typeRow}>
                {types.map(t => (
                  <TouchableOpacity key={t.key} onPress={() => setEditType(t.key)}
                    style={[styles.typeBtn, editType === t.key && styles.typeBtnActive]}>
                    <Text style={[styles.typeBtnText, editType === t.key && styles.typeBtnTextActive]}>{t.label}</Text>
                  </TouchableOpacity>
                ))}
              </View>

              {/* 場所 */}
              <View style={styles.locationRow}>
                <TextInput
                  style={[styles.locationInput, { flex: 1 }]}
                  value={editPrefecture}
                  onChangeText={setEditPrefecture}
                  placeholder="都道府県（例：岐阜県）"
                  placeholderTextColor="#aaa"
                />
                <TextInput
                  style={[styles.locationInput, { flex: 1.4 }]}
                  value={editCity}
                  onChangeText={setEditCity}
                  placeholder="市区町村（例：中津川市）"
                  placeholderTextColor="#aaa"
                />
              </View>

              {/* テキスト */}
              <TextInput
                style={styles.composeInput}
                value={editText}
                onChangeText={setEditText}
                placeholder="内容を入力してください..."
                placeholderTextColor="#999"
                multiline
                numberOfLines={4}
                textAlignVertical="top"
              />

              {/* 画像プレビュー */}
              {editImages.length > 0 && (
                <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.previewScroll}>
                  {editImages.map((uri, i) => (
                    <View key={i} style={styles.previewWrap}>
                      <Image source={{ uri }} style={styles.previewImg} />
                      <TouchableOpacity style={styles.removeBtn} onPress={() => setEditImages(prev => prev.filter((_, j) => j !== i))}>
                        <Text style={styles.removeBtnText}>✕</Text>
                      </TouchableOpacity>
                    </View>
                  ))}
                </ScrollView>
              )}
              <View style={{ height: 8 }} />
            </ScrollView>

            {/* 保存ボタン（キーボードの上に常に固定） */}
            <View style={styles.editBottomActions}>
              <TouchableOpacity style={styles.photoBtn} onPress={pickEditImages}>
                <Text style={styles.photoBtnText}>📷 写真を追加</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.submitBtn, editSubmitting && styles.submitBtnDisabled]}
                onPress={saveEdit}
                disabled={editSubmitting}
              >
                {editSubmitting
                  ? <ActivityIndicator color="white" />
                  : <Text style={styles.submitBtnText}>保存する</Text>
                }
              </TouchableOpacity>
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>

      {/* フルスクリーン画像モーダル */}
      {!!lightboxUri && (
      <Modal visible transparent animationType="fade" onRequestClose={() => setLightboxUri(null)}>
        <TouchableOpacity style={styles.lightboxOverlay} activeOpacity={1} onPress={() => setLightboxUri(null)}>
          <Image
            source={{ uri: lightboxUri }}
            style={styles.lightboxImage}
            resizeMode="contain"
          />
          <View style={styles.lightboxClose}>
            <Text style={styles.lightboxCloseText}>✕</Text>
          </View>
        </TouchableOpacity>
      </Modal>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  outer: { flex: 1, backgroundColor: '#C8E8E3' },

  // ヘッダー
  header: { paddingHorizontal: 18, paddingTop: 60, paddingBottom: 16, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  headerTitle: { fontSize: 22, fontWeight: '800', color: 'white' },
  headerSub: { fontSize: 12, color: 'rgba(255,255,255,0.78)', marginTop: 2 },
  headerRight: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  headerDog: { fontSize: 30 },
  composeBtn: { backgroundColor: 'rgba(255,255,255,0.25)', paddingHorizontal: 14, paddingVertical: 7, borderRadius: 999, borderWidth: 1, borderColor: 'rgba(255,255,255,0.5)' },
  composeBtnText: { color: 'white', fontSize: 13, fontWeight: '700' },

  // フィルター
  filterBar: { backgroundColor: '#C8E8E3', flexGrow: 0 },
  filterContent: { paddingHorizontal: 12, paddingVertical: 10, gap: 7 },
  filterTab: { paddingHorizontal: 14, paddingVertical: 7, borderRadius: 999, backgroundColor: 'white', shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.05, shadowRadius: 4, elevation: 1 },
  filterTabActive: { backgroundColor: '#F08080' },
  filterTabText: { fontSize: 12, color: '#888', fontWeight: '500' },
  filterTabTextActive: { color: 'white', fontWeight: '700' },

  list: { flex: 1 },

  // 投稿フォーム
  composeBox: { backgroundColor: 'white', margin: 12, borderRadius: 20, padding: 16, shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.08, shadowRadius: 10, elevation: 3 },
  composeHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 },
  composeTitle: { fontSize: 14, fontWeight: '700', color: '#1a1a1a' },
  composeClose: { fontSize: 17, color: '#bbb', padding: 2 },
  typeRow: { flexDirection: 'row', gap: 6, flexWrap: 'wrap', marginBottom: 10 },
  typeBtn: { paddingHorizontal: 11, paddingVertical: 6, borderRadius: 999, backgroundColor: '#F5F5F2' },
  typeBtnActive: { backgroundColor: '#FFE4E4' },
  typeBtnText: { fontSize: 12, color: '#888', fontWeight: '500' },
  typeBtnTextActive: { color: '#2D4A47', fontWeight: '700' },
  composeInput: { borderWidth: 1, borderColor: '#EDE8E0', borderRadius: 12, padding: 12, fontSize: 14, color: '#222', backgroundColor: '#FAFAF8', minHeight: 90, marginBottom: 10 },
  previewScroll: { marginBottom: 10 },
  previewWrap: { position: 'relative', marginRight: 8 },
  previewImg: { width: 72, height: 72, borderRadius: 10 },
  removeBtn: { position: 'absolute', top: 3, right: 3, backgroundColor: 'rgba(0,0,0,0.55)', borderRadius: 999, width: 20, height: 20, alignItems: 'center', justifyContent: 'center' },
  removeBtnText: { color: 'white', fontSize: 9, fontWeight: '700' },
  composeActions: { flexDirection: 'row', gap: 8 },
  photoBtn: { flex: 1, paddingVertical: 9, borderRadius: 10, borderWidth: 1, borderColor: '#EDE8E0', alignItems: 'center', backgroundColor: '#FAFAF8' },
  photoBtnText: { fontSize: 13, color: '#555', fontWeight: '600' },
  submitBtn: { flex: 2, backgroundColor: '#F08080', paddingVertical: 10, borderRadius: 10, alignItems: 'center' },
  submitBtnDisabled: { backgroundColor: '#c0c0c0' },
  submitBtnText: { color: 'white', fontSize: 13, fontWeight: '700' },

  loadingBox: { paddingVertical: 40, alignItems: 'center' },
  empty: { alignItems: 'center', padding: 44, gap: 10 },
  emptyEmoji: { fontSize: 46 },
  emptyText: { fontSize: 13, color: '#bbb' },
  locationRow: { flexDirection: 'row', gap: 7, marginBottom: 8 },
  locationInput: { borderWidth: 1, borderColor: '#EDE8E0', borderRadius: 10, padding: 9, fontSize: 13, color: '#222', backgroundColor: '#FAFAF8' },
  itemLocation: { fontSize: 12, color: '#888', marginBottom: 3 },

  // 投稿アイテム
  item: { backgroundColor: 'white', borderBottomWidth: 0.5, borderBottomColor: '#EDE8E0', marginTop: 1 },
  itemMain: { flexDirection: 'row', gap: 10, paddingHorizontal: 14, paddingTop: 14, paddingBottom: 8 },
  avatar: { width: 36, height: 36, borderRadius: 18, backgroundColor: '#D4EEE9', alignItems: 'center', justifyContent: 'center', flexShrink: 0 },
  avatarText: { fontSize: 18 },
  avatarImg: { width: 36, height: 36, borderRadius: 18 },
  body: { flex: 1 },
  itemHead: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 4 },
  itemName: { fontSize: 13, fontWeight: '700', color: '#1a1a1a' },
  itemTime: { fontSize: 11, color: '#bbb' },
  itemText: { fontSize: 14, color: '#333', lineHeight: 21 },
  imageScroll: { marginTop: 8 },
  postImg: { width: 120, height: 120, borderRadius: 12, marginRight: 7 },
  badge: { alignSelf: 'flex-start', paddingHorizontal: 10, paddingVertical: 4, borderRadius: 999, marginTop: 8 },
  badgeText: { fontSize: 11, fontWeight: '600' },
  actions: { flexDirection: 'row', gap: 18, marginTop: 10, paddingBottom: 4 },
  actionBtn: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  actionIcon: { fontSize: 17 },
  actionCount: { fontSize: 13, color: '#aaa' },
  actionCountLiked: { color: '#E24B4A' },
  reportBtnText: { fontSize: 11, color: '#aaa', fontWeight: '500' },

  // 返信セクション
  replySection: { backgroundColor: '#F8FAF8', borderTopWidth: 0.5, borderTopColor: '#EDE8E0', paddingHorizontal: 14, paddingTop: 10, paddingBottom: 10 },
  replyItem: { flexDirection: 'row', gap: 8, marginBottom: 10 },
  replyAvatar: { width: 28, height: 28, borderRadius: 14, backgroundColor: '#EDE8E0', alignItems: 'center', justifyContent: 'center', flexShrink: 0 },
  replyAvatarText: { fontSize: 14 },
  replyBody: { flex: 1 },
  replyHead: { flexDirection: 'row', gap: 8, alignItems: 'center', marginBottom: 3 },
  replyName: { fontSize: 12, fontWeight: '700', color: '#1a1a1a' },
  replyTime: { fontSize: 10, color: '#bbb' },
  replyText: { fontSize: 13, color: '#444', lineHeight: 19 },
  replyImg: { width: 80, height: 80, borderRadius: 10, marginRight: 6 },
  replyImgPreview: { marginBottom: 8 },
  replyPreviewWrap: { position: 'relative', marginRight: 7 },
  replyPreviewImg: { width: 60, height: 60, borderRadius: 8 },
  removeSmallBtn: { position: 'absolute', top: 2, right: 2, backgroundColor: 'rgba(0,0,0,0.5)', borderRadius: 999, width: 17, height: 17, alignItems: 'center', justifyContent: 'center' },
  replyInputRow: { flexDirection: 'row', gap: 7, alignItems: 'center' },
  replyPhotoBtn: { width: 36, height: 36, backgroundColor: '#D4EEE9', borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  replyPhotoBtnText: { fontSize: 18 },
  replyInput: { flex: 1, fontSize: 13, padding: 9, borderWidth: 1, borderColor: '#EDE8E0', borderRadius: 12, backgroundColor: 'white', color: '#222' },
  replySendBtn: { backgroundColor: '#F08080', paddingHorizontal: 13, paddingVertical: 9, borderRadius: 12 },
  replySendDisabled: { backgroundColor: '#c0c0c0' },
  replySendText: { color: 'white', fontSize: 12, fontWeight: '700' },

  // フッターデコ
  footerDeco: { alignItems: 'center', paddingVertical: 16 },
  footerDecoText: { fontSize: 22, opacity: 0.2, letterSpacing: 7 },

  // 編集モーダル
  editOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.45)', justifyContent: 'flex-end' },
  editSheet: { backgroundColor: 'white', borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 20, paddingBottom: 0, height: Dimensions.get('window').height * 0.82, flexShrink: 1 },
  editBottomActions: { flexDirection: 'row', gap: 8, paddingTop: 10, paddingBottom: 20, borderTopWidth: 0.5, borderTopColor: '#EDE8E0' },
  kbDoneBtn: { backgroundColor: '#D4EEE9', paddingHorizontal: 10, paddingVertical: 5, borderRadius: 8 },
  kbDoneBtnText: { fontSize: 12, color: '#2D4A47', fontWeight: '700' },

  // フルスクリーン画像モーダル
  lightboxOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.92)', alignItems: 'center', justifyContent: 'center' },
  lightboxImage: { width: Dimensions.get('window').width, height: Dimensions.get('window').height * 0.82 },
  lightboxClose: { position: 'absolute', top: 52, right: 18, backgroundColor: 'rgba(255,255,255,0.15)', borderRadius: 999, width: 38, height: 38, alignItems: 'center', justifyContent: 'center' },
  lightboxCloseText: { color: 'white', fontSize: 16, fontWeight: '700' },
});
