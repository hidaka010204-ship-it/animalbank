import DateTimePicker from '@react-native-community/datetimepicker';
import * as ImageManipulator from 'expo-image-manipulator';
import * as ImagePicker from 'expo-image-picker';
import { LinearGradient } from 'expo-linear-gradient';
import { useEffect, useState } from 'react';
import { ActivityIndicator, FlatList, Image, Modal, Platform, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { showAlert } from '../../lib/alert';
import { uploadImageToStorage } from '../../lib/uploadImage';

const IS_WEB = Platform.OS === 'web';
import { useRouter } from 'expo-router';
import { supabase } from '../../lib/supabase';
import { PREFECTURE_STATS, useApp } from '../_appContext';

type AnimalKind = '犬' | '猫' | 'その他';
type StatusFilter = '全て' | '緊急' | '申請中' | '新規';

type AdoptionItem = {
  id: string;
  animal_id: string;
  user_id: string | null;
  application_number: string | null;
  applicant_name: string | null;
  applicant_email: string | null;
  applicant_phone: string | null;
  applicant_address: string | null;
  housing_type: string | null;
  reason: string | null;
  status: 'interest' | 'pending' | 'accepted' | 'rejected' | 'completed';
  created_at: string;
  animalName: string;
  animalImages: string[];
  animalEmoji: string;
};


const ALL_PREFECTURES = ['全て', ...PREFECTURE_STATS.map(p => p.prefecture)];

const SHELTERS = [
  { name: '中津川市保健所', prefecture: '岐阜県' },
  { name: '春日井市保健所', prefecture: '愛知県' },
  { name: '飯田市保健所', prefecture: '長野県' },
  { name: '名古屋市動物愛護センター', prefecture: '愛知県' },
  { name: '岐阜市保健所', prefecture: '岐阜県' },
  { name: '豊橋市保健所', prefecture: '愛知県' },
  { name: '松本市保健所', prefecture: '長野県' },
  { name: 'その他', prefecture: '' },
];

export default function AdminScreen() {
  const router = useRouter();
  const { animals, refreshAnimals, session } = useApp();

  const [showCompose, setShowCompose] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [registered, setRegistered] = useState(false);

  // 登録タイプ選択
  const [showRegisterTypeSheet, setShowRegisterTypeSheet] = useState(false);

  // 一般ユーザー登録フォーム（animals テーブルに source='public' で保存）
  const [showUserPost, setShowUserPost] = useState(false);
  const [userPostKind, setUserPostKind] = useState<AnimalKind>('犬');
  const [userPostName, setUserPostName] = useState('');
  const [userPostBreed, setUserPostBreed] = useState('');
  const [userPostShelter, setUserPostShelter] = useState('');
  const [userPostPrefecture, setUserPostPrefecture] = useState('');
  const [userPostDeadlineObj, setUserPostDeadlineObj] = useState<Date | null>(null);
  const [showUserDeadlinePicker, setShowUserDeadlinePicker] = useState(false);
  const [userPostAge, setUserPostAge] = useState('');
  const [userPostWeight, setUserPostWeight] = useState('');
  const [showUserAgePicker, setShowUserAgePicker] = useState(false);
  const [showUserWeightPicker, setShowUserWeightPicker] = useState(false);
  const [userPostText, setUserPostText] = useState('');
  const [userPostImages, setUserPostImages] = useState<string[]>([]);
  const [userPostSubmitting, setUserPostSubmitting] = useState(false);
  const [userPostDone, setUserPostDone] = useState(false);

  // タブ
  const [activeTab, setActiveTab] = useState<'animals' | 'adoptions'>('animals');

  // 申請管理
  const [adoptionItems, setAdoptionItems] = useState<AdoptionItem[]>([]);
  const [adoptionsLoading, setAdoptionsLoading] = useState(false);
  const [processingId, setProcessingId] = useState<string | null>(null);
  // 自分が登録した動物が1件以上ある場合のみ申請管理タブを表示
  const [hasMyAnimals, setHasMyAnimals] = useState(false);

  // フィルター
  const [prefFilter, setPrefFilter] = useState('全て');
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('全て');

  // フォーム
  const [animalKind, setAnimalKind] = useState<AnimalKind>('犬');
  const [animalName, setAnimalName] = useState('');
  const [breed, setBreed] = useState('');
  const [age, setAge] = useState('');
  const [weight, setWeight] = useState('');
  const [deadlineDateObj, setDeadlineDateObj] = useState<Date | null>(null);
  const [shelterIndex, setShelterIndex] = useState(0);
  const [shelterCustom, setShelterCustom] = useState('');
  const [prefectureCustom, setPrefectureCustom] = useState('');
  const [notes, setNotes] = useState('');
  const [formImages, setFormImages] = useState<string[]>([]);
  const [showShelterPicker, setShowShelterPicker] = useState(false);
  const [showAgePicker, setShowAgePicker] = useState(false);
  const [showWeightPicker, setShowWeightPicker] = useState(false);
  const [showDeadlineDatePicker, setShowDeadlineDatePicker] = useState(false);

  // ピッカー選択肢
  const AGE_OPTIONS = ['不明', ...Array.from({ length: 16 }, (_, i) => `${i}歳`)];
  const WEIGHT_OPTIONS = ['不明', ...Array.from({ length: 100 }, (_, i) => `${((i + 1) * 0.5).toFixed(1)}kg`)];

  const formatDate = (d: Date) =>
    `${d.getFullYear()}/${String(d.getMonth() + 1).padStart(2, '0')}/${String(d.getDate()).padStart(2, '0')}`;

  const prefectures = ALL_PREFECTURES;

  const filtered = animals.filter(a => {
    const matchPref = prefFilter === '全て' || a.prefecture === prefFilter;
    const matchStatus =
      statusFilter === '全て' ||
      (statusFilter === '緊急' && a.urgent) ||
      (statusFilter === '申請中' && a.status === '申請中') ||
      (statusFilter === '新規' && a.status === '新規');
    return matchPref && matchStatus;
  });

  const urgentCount = animals.filter(a => a.urgent).length;
  const pendingCount = animals.filter(a => a.status === '申請中').length;
  const newCount = animals.filter(a => a.status === '新規').length;

  // 期限まであと何日か（負 = 超過）
  const getDaysUntil = (deadlineStr: string): number | null => {
    if (!deadlineStr) return null;
    const d = new Date(deadlineStr.replace(/\//g, '-'));
    if (isNaN(d.getTime())) return null;
    const now = new Date();
    now.setHours(0, 0, 0, 0);
    return Math.ceil((d.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
  };

  const nearDeadlineAnimals = filtered.filter(a => {
    const days = getDaysUntil(a.disposalDeadline);
    return days !== null && days <= 3;
  });
  const normalAnimals = filtered.filter(a => {
    const days = getDaysUntil(a.disposalDeadline);
    return days === null || days > 3;
  });

  // 自分が申請中の動物IDセット
  const [myPendingAnimalIds, setMyPendingAnimalIds] = useState<Set<string>>(new Set());
  useEffect(() => {
    if (!session?.user?.id) { setMyPendingAnimalIds(new Set()); return; }
    supabase
      .from('adoptions')
      .select('animal_id')
      .eq('user_id', session.user.id)
      .eq('status', 'pending')
      .then(({ data }) => {
        setMyPendingAnimalIds(new Set(((data ?? []) as { animal_id: string }[]).map(r => r.animal_id)));
      });
  }, [session?.user?.id]);

  const pickImages = async () => {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsMultipleSelection: true,
      quality: 0.8,
    });
    if (!result.canceled) {
      const converted: string[] = [];
      for (const a of result.assets) {
        try {
          const res = await ImageManipulator.manipulateAsync(
            a.uri, [], { compress: 0.85, format: ImageManipulator.SaveFormat.JPEG }
          );
          converted.push(res.uri);
        } catch (e) {
          console.warn('[pickImages] 変換失敗:', e);
        }
      }
      setFormImages(prev => [...prev, ...converted]);
    }
  };

  const uploadImages = async (uris: string[], animalId: string): Promise<string[]> => {
    const urls: string[] = [];
    for (let i = 0; i < uris.length; i++) {
      const uri = uris[i];
      if (!uri) continue;
      const path = `${animalId}/${i}.jpg`;
      const publicUrl = await uploadImageToStorage(uri, 'animal-images', path);
      if (publicUrl) {
        urls.push(publicUrl);
        console.log(`[uploadImages] 成功 i=${i} url=${publicUrl}`);
      } else {
        console.warn(`[uploadImages] 失敗 i=${i}`);
      }
    }
    return urls;
  };

  const register = async () => {
    if (!animalName.trim()) { showAlert('名前を入力してください'); return; }
    setSubmitting(true);
    try {
      const speciesMap: Record<AnimalKind, string> = { '犬': 'dog', '猫': 'cat', 'その他': 'other' };

      const { data: inserted, error } = await supabase
        .from('animals')
        .insert({
          name: animalName.trim(),
          species: speciesMap[animalKind],
          breed: breed.trim() || null,
          description: notes.trim() || null,
          is_urgent: false,
          deadline: deadlineDateObj ? deadlineDateObj.toISOString().slice(0, 10) : null,
          admitted_at: (() => { const t = new Date(Date.now() + 9 * 60 * 60 * 1000); return `${t.getUTCFullYear()}-${String(t.getUTCMonth() + 1).padStart(2, '0')}-${String(t.getUTCDate()).padStart(2, '0')}`; })(),
          status: 'available',
          shelter: selectedShelter.name === 'その他' ? shelterCustom.trim() || null : selectedShelter.name,
          prefecture: selectedShelter.name === 'その他' ? prefectureCustom.trim() || null : selectedShelter.prefecture,
          source: 'shelter',
          user_id: session?.user?.id ?? null,
        })
        .select('id')
        .single();

      if (error) {
        console.error('[register] Supabase INSERT エラー:', JSON.stringify(error));
        showAlert('登録エラー', `${error.message}\n\ncode: ${error.code}`);
        return;
      }

      if (formImages.length > 0 && inserted?.id) {
        const imageUrls = await uploadImages(formImages, inserted.id);
        console.log('[register] imageUrls:', imageUrls);
        if (imageUrls.length > 0) {
          const { data: updateData, error: updateError } = await supabase
            .from('animals')
            .update({ images: imageUrls })
            .eq('id', inserted.id);
          console.log('[register] animals.update data:', updateData, 'error:', updateError);
        }
      }

      await refreshAnimals();
      setRegistered(true);
    } catch (e) {
      console.error('[register] 予期しないエラー:', e);
      showAlert('エラーが発生しました', '時間をおいて再度お試しください。');
    } finally {
      setSubmitting(false);
    }
  };

  const resetForm = () => {
    setAnimalName(''); setAnimalKind('犬'); setBreed(''); setAge(''); setWeight('');
    setDeadlineDateObj(null); setShelterIndex(0); setShelterCustom('');
    setPrefectureCustom(''); setNotes(''); setFormImages([]); setRegistered(false);
  };

  const closeCompose = () => {
    setShowCompose(false); resetForm();
  };

  // 里親募集フォーム用画像ピッカー（JPEG 変換のみ、getInfoAsync なし）
  const pickUserPostImages = async () => {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsMultipleSelection: true,
      quality: 0.8,
    });
    if (!result.canceled) {
      const converted: string[] = [];
      for (const a of result.assets) {
        try {
          const res = await ImageManipulator.manipulateAsync(
            a.uri, [], { compress: 0.85, format: ImageManipulator.SaveFormat.JPEG }
          );
          converted.push(res.uri);
        } catch (e) {
          console.warn('[pickUserPostImages] 変換失敗:', e);
        }
      }
      setUserPostImages(prev => [...prev, ...converted]);
    }
  };

  // 里親募集投稿の画像は animal-images バケットへアップロード（uploadImages を再利用）

  // 一般ユーザー登録（animals テーブルに source='public' で保存）
  const submitUserPost = async () => {
    if (!userPostName.trim()) { showAlert('名前を入力してください'); return; }
    setUserPostSubmitting(true);
    try {
      const speciesMap: Record<AnimalKind, string> = { '犬': 'dog', '猫': 'cat', 'その他': 'other' };
      // 登録日を JST で今日の日付に自動セット
      const t = new Date(Date.now() + 9 * 60 * 60 * 1000);
      const todayStr = `${t.getUTCFullYear()}-${String(t.getUTCMonth() + 1).padStart(2, '0')}-${String(t.getUTCDate()).padStart(2, '0')}`;

      const { data: inserted, error } = await supabase
        .from('animals')
        .insert({
          name: userPostName.trim(),
          species: speciesMap[userPostKind],
          breed: userPostBreed.trim() || null,
          description: userPostText.trim() || null,
          is_urgent: false,
          deadline: userPostDeadlineObj ? userPostDeadlineObj.toISOString().slice(0, 10) : null,
          admitted_at: todayStr,
          status: 'available',
          shelter: userPostShelter.trim() || null,
          prefecture: userPostPrefecture.trim() || null,
          source: 'public',
          user_id: session?.user?.id ?? null,
        })
        .select('id')
        .single();
      if (error) {
        console.error('[submitUserPost] Supabase INSERT エラー:', JSON.stringify(error));
        showAlert('登録エラー', `${error.message}\n\ncode: ${error.code}`);
        return;
      }

      if (userPostImages.length > 0 && inserted?.id) {
        const imageUrls = await uploadImages(userPostImages, inserted.id);
        if (imageUrls.length > 0) {
          const { error: imgError } = await supabase
            .from('animals')
            .update({ images: imageUrls })
            .eq('id', inserted.id);
          if (imgError) console.error('[submitUserPost] 画像URL UPDATE エラー:', imgError);
        }
      }
      await refreshAnimals();
      setUserPostDone(true);
    } catch (e) {
      showAlert('エラー', '登録に失敗しました。時間をおいて再度お試しください。');
    } finally {
      setUserPostSubmitting(false);
    }
  };

  const resetUserPost = () => {
    setUserPostKind('犬'); setUserPostName(''); setUserPostBreed('');
    setUserPostShelter(''); setUserPostPrefecture('');
    setUserPostDeadlineObj(null); setShowUserDeadlinePicker(false);
    setUserPostAge(''); setUserPostWeight('');
    setShowUserAgePicker(false); setShowUserWeightPicker(false);
    setUserPostText(''); setUserPostImages([]); setUserPostDone(false);
  };

  const selectedShelter = SHELTERS[shelterIndex];

  // ---------- 申請管理 ----------
  const fetchAdoptions = async () => {
    if (!session?.user?.id) return;
    setAdoptionsLoading(true);
    try {
      const { data: myAnimals } = await supabase
        .from('animals')
        .select('id, name, images, species')
        .eq('user_id', session.user.id);

      setHasMyAnimals((myAnimals?.length ?? 0) > 0);
      if (!myAnimals || myAnimals.length === 0) { setAdoptionItems([]); setActiveTab('animals'); return; }

      const animalMap: Record<string, { name: string; images: unknown; species: string }> = {};
      (myAnimals as { id: string; name: string; images: unknown; species: string }[])
        .forEach(a => { animalMap[a.id] = a; });

      const { data: adoptions } = await supabase
        .from('adoptions')
        .select('id, animal_id, user_id, application_number, applicant_name, applicant_email, applicant_phone, applicant_address, housing_type, reason, status, created_at')
        .in('animal_id', myAnimals.map((a: { id: string }) => a.id))
        .order('created_at', { ascending: false });

      const mapped = (adoptions ?? []).map((ad: Record<string, unknown>) => {
          const a = animalMap[ad.animal_id as string];
          const emoji = a?.species === 'dog' ? '🐕' : a?.species === 'cat' ? '🐈' : '🐾';
          const imgs = Array.isArray(a?.images) ? (a.images as string[]) : [];
          return {
            id: ad.id as string,
            animal_id: ad.animal_id as string,
            user_id: ad.user_id as string | null,
            application_number: ad.application_number as string | null,
            applicant_name: ad.applicant_name as string | null,
            applicant_email: ad.applicant_email as string | null,
            applicant_phone: ad.applicant_phone as string | null,
            applicant_address: ad.applicant_address as string | null,
            housing_type: ad.housing_type as string | null,
            reason: ad.reason as string | null,
            status: ad.status as AdoptionItem['status'],
            created_at: ad.created_at as string,
            animalName: a?.name ?? '動物',
            animalImages: imgs,
            animalEmoji: emoji,
          };
        });
      console.log('[fetchAdoptions] 取得件数:', mapped.length);
      mapped.forEach(ad => console.log(`  id=${ad.id} status=${ad.status} name=${ad.animalName}`));
      setAdoptionItems(mapped);
    } finally {
      setAdoptionsLoading(false);
    }
  };

  // 初回マウント時のみ呼ぶ（フォーカス時・タブ切り替え時は呼ばない）
  useEffect(() => { fetchAdoptions(); }, []);

  const processAdoption = async (
    adoptionId: string,
    adoptionUserId: string | null,
    animalId: string,
    animalName: string,
    action: 'accepted' | 'rejected',
  ) => {
    setProcessingId(adoptionId);
    // 即座にUIを更新してボタンを消す
    setAdoptionItems(prev => prev.map(ad =>
      ad.id === adoptionId ? { ...ad, status: action } : ad
    ));
    try {
      console.log('[processAdoption] UPDATE 開始 id=', adoptionId, 'action=', action);
      const { data: updateData, error: updateError } = await supabase
        .from('adoptions')
        .update({ status: action })
        .eq('id', adoptionId)
        .select('id, status');
      console.log('[processAdoption] UPDATE 結果 data=', JSON.stringify(updateData), 'error=', JSON.stringify(updateError));
      if (updateError) {
        // 失敗したら元に戻す
        setAdoptionItems(prev => prev.map(ad =>
          ad.id === adoptionId ? { ...ad, status: 'pending' } : ad
        ));
        showAlert('エラー', updateError.message);
        return;
      }

      if (adoptionUserId) {
        await supabase.from('notifications').insert({
          user_id: adoptionUserId,
          type: 'adoption',
          title: action === 'accepted' ? '申請が受理されました' : '申請が受理されませんでした',
          body: action === 'accepted' ? '登録者から直接ご連絡いたします' : 'またの機会にお申し込みください',
          is_read: false,
        });
      }

      showAlert(action === 'accepted' ? '受理しました' : '拒否しました');
    } catch (e) {
      // 失敗したら元に戻す
      setAdoptionItems(prev => prev.map(ad =>
        ad.id === adoptionId ? { ...ad, status: 'pending' } : ad
      ));
      showAlert('エラー', '処理に失敗しました');
    } finally {
      setProcessingId(null);
    }
  };

  const pendingAdoptionsCount = adoptionItems.filter(a => a.status !== 'completed').length;

  const markAsTransferred = (animalId: string, animalName: string) => {
    showAlert(
      '譲渡済みにする',
      `「${animalName}」を譲渡済みにしますか？\n一覧から削除されます。`,
      [
        { text: 'キャンセル', style: 'cancel' },
        {
          text: '譲渡済みにする',
          style: 'destructive',
          onPress: async () => {
            const { error } = await supabase
              .from('animals')
              .update({ status: 'transferred' })
              .eq('id', animalId);
            if (error) {
              showAlert('エラー', error.message);
              return;
            }
            await refreshAnimals();
          },
        },
      ]
    );
  };

  const markContacted = async (adoptionId: string, animalName: string) => {
    setProcessingId(adoptionId);
    try {
      const { error } = await supabase
        .from('adoptions')
        .update({ status: 'completed' })
        .eq('id', adoptionId);
      if (error) { showAlert('エラー', error.message); return; }
      setAdoptionItems(prev => prev.map(ad =>
        ad.id === adoptionId ? { ...ad, status: 'completed' } : ad
      ));
    } catch (e) {
      console.error('[markContacted] エラー:', e);
      showAlert('エラー', '処理に失敗しました');
    } finally {
      setProcessingId(null);
    }
  };

  // カード内コンテンツの共通レンダラー
const renderAnimalCard = (animal: typeof animals[0], daysLabel: string | null, daysColor: string | null) => (
    <>
      <View style={styles.cardTop}>
        {animal.images.length > 0 ? (
          <Image source={{ uri: animal.images[0] }} style={styles.cardThumb} resizeMode="cover" />
        ) : (
          <View style={[styles.cardBubble, {
            backgroundColor: animal.animalKind === '猫' ? '#F0EEFF' : animal.animalKind === '犬' ? '#D4EEE9' : '#F5C9A0'
          }]}>
            <Text style={styles.cardEmoji}>{animal.emoji}</Text>
          </View>
        )}

        <View style={styles.cardInfo}>
          <View style={styles.cardNameRow}>
            <Text style={styles.cardName}>{animal.name}</Text>
            <View style={styles.cardBadgeRow}>
              {myPendingAnimalIds.has(animal.id) && (
                <View style={styles.applyingBadge}>
                  <Text style={styles.applyingBadgeText}>申請中</Text>
                </View>
              )}
              <View style={[styles.statusPill, { backgroundColor: animal.statusBg }]}>
                <Text style={[styles.statusText, { color: animal.statusColor }]}>{animal.status}</Text>
              </View>
            </View>
          </View>
          <Text style={styles.cardBreed}>{animal.breed}</Text>
          <View style={styles.cardMetaRow}>
            <Text style={styles.cardMeta}>{animal.age}</Text>
            <Text style={styles.cardMetaDot}>·</Text>
            <Text style={styles.cardMeta}>{animal.weight}</Text>
          </View>
          <Text style={styles.cardShelter}>📍 {animal.shelter}</Text>
        </View>
      </View>

      <View style={styles.cardBottom}>
        <View style={styles.cardDates}>
          <Text style={styles.cardDateLabel}>収容日</Text>
          <Text style={styles.cardDateValue}>{animal.intakeDate}</Text>
          <Text style={[styles.cardDateLabel, { marginLeft: 14 }]}>{animal.source === 'shelter' ? '処分期限' : '掲載期限'}</Text>
          <Text style={[styles.cardDateValue, animal.urgent && styles.cardDateUrgent]}>{animal.disposalDeadline}</Text>
          {daysLabel ? (
            <View style={[styles.daysLeftPill, { backgroundColor: daysColor === '#991B1B' ? '#FEE2E2' : '#FEF3C7' }]}>
              <Text style={[styles.daysLeftText, { color: daysColor ?? '#DC2626' }]}>{daysLabel}</Text>
            </View>
          ) : null}
        </View>
        <Text style={styles.cardArrow}>›</Text>
      </View>

      {animal.notes ? (
        <View style={styles.cardNotes}>
          <Text style={styles.cardNotesText} numberOfLines={1}>📋 {animal.notes}</Text>
        </View>
      ) : null}

      {session?.user?.id && animal.user_id === session.user.id && (
        <View style={styles.transferredBtnRow}>
          <TouchableOpacity
            style={styles.transferredBtn}
            onPress={e => { e.stopPropagation?.(); markAsTransferred(animal.id, animal.name); }}
            activeOpacity={0.8}
          >
            <Text style={styles.transferredBtnText}>譲渡済みにする</Text>
          </TouchableOpacity>
        </View>
      )}
    </>
  );

  return (
    <View style={styles.outer}>
      <LinearGradient colors={['#4FA3A0', '#A8D8CF']} style={styles.header}>
        <View>
          <Text style={styles.headerTitle}>動物情報</Text>
          <Text style={styles.headerSub}>
            {session ? session.user.email : '収容中の動物一覧'}
          </Text>
        </View>
        <View style={styles.headerActions}>
          <TouchableOpacity style={styles.postBtn} onPress={() => setShowRegisterTypeSheet(true)}>
            <Text style={styles.postBtnText}>＋ 登録</Text>
          </TouchableOpacity>
        </View>
      </LinearGradient>

      {/* サマリー */}
      <View style={styles.summaryRow}>
        <TouchableOpacity style={[styles.summaryItem, statusFilter === '全て' && styles.summaryItemActive]}
          onPress={() => setStatusFilter('全て')}>
          <Text style={[styles.summaryNum, { color: '#A8D8CF' }, statusFilter === '全て' && styles.summaryNumActive]}>{animals.length}</Text>
          <Text style={styles.summaryLabel}>収容中</Text>
        </TouchableOpacity>
        <TouchableOpacity style={[styles.summaryItem, statusFilter === '緊急' && styles.summaryItemActiveRed]}
          onPress={() => setStatusFilter(statusFilter === '緊急' ? '全て' : '緊急')}>
          <Text style={[styles.summaryNum, { color: '#A32D2D' }]}>{urgentCount}</Text>
          <Text style={styles.summaryLabel}>🚨 緊急</Text>
        </TouchableOpacity>
        <TouchableOpacity style={[styles.summaryItem, statusFilter === '申請中' && styles.summaryItemActiveBlue]}
          onPress={() => setStatusFilter(statusFilter === '申請中' ? '全て' : '申請中')}>
          <Text style={[styles.summaryNum, { color: '#185FA5' }]}>{pendingCount}</Text>
          <Text style={styles.summaryLabel}>申請中</Text>
        </TouchableOpacity>
        <TouchableOpacity style={[styles.summaryItem, statusFilter === '新規' && styles.summaryItemActiveGreen]}
          onPress={() => setStatusFilter(statusFilter === '新規' ? '全て' : '新規')}>
          <Text style={[styles.summaryNum, { color: '#555' }]}>{newCount}</Text>
          <Text style={styles.summaryLabel}>新規</Text>
        </TouchableOpacity>
      </View>

      {/* タブバー */}
      <View style={styles.tabRow}>
        <TouchableOpacity
          style={[styles.tabBtn, activeTab === 'animals' && styles.tabBtnActive]}
          onPress={() => setActiveTab('animals')}>
          <Text style={[styles.tabBtnText, activeTab === 'animals' && styles.tabBtnTextActive]}>動物一覧</Text>
        </TouchableOpacity>
        {hasMyAnimals && (
          <TouchableOpacity
            style={[styles.tabBtn, activeTab === 'adoptions' && styles.tabBtnActive]}
            onPress={() => setActiveTab('adoptions')}>
            <Text style={[styles.tabBtnText, activeTab === 'adoptions' && styles.tabBtnTextActive]}>
              申請管理{pendingAdoptionsCount > 0 ? `（${pendingAdoptionsCount}）` : ''}
            </Text>
          </TouchableOpacity>
        )}
      </View>

      {activeTab === 'animals' ? (
        <>
          {/* 都道府県フィルター */}
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.prefBar}
            contentContainerStyle={styles.prefBarContent}>
            {prefectures.map(p => (
              <TouchableOpacity key={p} style={[styles.prefChip, prefFilter === p && styles.prefChipActive]}
                onPress={() => setPrefFilter(p)}>
                <Text style={[styles.prefChipText, prefFilter === p && styles.prefChipTextActive]}>{p}</Text>
              </TouchableOpacity>
            ))}
          </ScrollView>

          <ScrollView style={styles.list}>
            <Text style={styles.listLabel}>
              {prefFilter !== '全て' ? prefFilter : '全国'}
              {statusFilter !== '全て' ? ` ・ ${statusFilter}` : ''}
              　{filtered.length}件
            </Text>

            {filtered.length === 0 && (
              <View style={styles.empty}>
                <Text style={styles.emptyEmoji}>🐾</Text>
                <Text style={styles.emptyText}>該当する動物はいません</Text>
              </View>
            )}

            {/* ── ⚠️ 期限間近セクション ── */}
            {nearDeadlineAnimals.length > 0 && (
              <>
                <View style={styles.nearDeadlineHeader}>
                  <Text style={styles.nearDeadlineHeaderText}>⚠️ 期限間近（{nearDeadlineAnimals.length}件）</Text>
                  <Text style={styles.nearDeadlineHeaderSub}>掲載期限・処分期限が3日以内</Text>
                </View>
                {nearDeadlineAnimals.map(animal => {
                  const days = getDaysUntil(animal.disposalDeadline);
                  const daysLabel = days === null ? '' : days < 0 ? `${Math.abs(days)}日超過` : days === 0 ? '本日期限' : `あと${days}日`;
                  const daysColor = days !== null && days <= 0 ? '#991B1B' : '#DC2626';
                  return (
                    <TouchableOpacity key={animal.id} style={[styles.card, styles.nearDeadlineCard]}
                      onPress={() => router.push(`/animal/${animal.id}` as any)}
                      activeOpacity={0.78}>
                      <View style={styles.nearDeadlineBar} />
                      {renderAnimalCard(animal, daysLabel, daysColor)}
                    </TouchableOpacity>
                  );
                })}
                <View style={styles.sectionDivider} />
              </>
            )}

            {/* ── 通常リスト ── */}
            {normalAnimals.map(animal => (
              <TouchableOpacity key={animal.id} style={[styles.card, animal.urgent && styles.cardUrgentBorder]}
                onPress={() => router.push(`/animal/${animal.id}` as any)}
                activeOpacity={0.78}>
                {animal.urgent && <View style={styles.urgentBar} />}
                {renderAnimalCard(animal, null, null)}
              </TouchableOpacity>
            ))}

            <View style={{ height: 30 }} />
          </ScrollView>
        </>
      ) : (
        /* ===== 申請管理タブ ===== */
        <ScrollView style={styles.list}>
          {!session ? (
            <View style={styles.empty}>
              <Text style={styles.emptyEmoji}>🔒</Text>
              <Text style={styles.emptyText}>ログインして申請を管理できます</Text>
            </View>
          ) : adoptionsLoading ? (
            <View style={styles.empty}>
              <ActivityIndicator color="#A8D8CF" style={{ paddingVertical: 20 }} />
            </View>
          ) : adoptionItems.length === 0 ? (
            <View style={styles.empty}>
              <Text style={styles.emptyEmoji}>📋</Text>
              <Text style={styles.emptyText}>まだ申請はありません</Text>
            </View>
          ) : (
            adoptionItems.map(adoption => {
              const statusMap: Record<string, { label: string; bg: string; color: string }> = {
                interest:  { label: '興味あり', bg: '#FEF3E0', color: '#8A4800' },
                pending:   { label: '審査中',   bg: '#F5F5F5', color: '#888' },
                accepted:  { label: '受理済み', bg: '#E6F1FB', color: '#185FA5' },
                rejected:  { label: '拒否済み', bg: '#FCEBEB', color: '#A32D2D' },
                completed: { label: '完了',     bg: '#D4EEE9', color: '#2D4A47' },
              };
              const s = statusMap[adoption.status] ?? statusMap.pending;
              const isProcessing = processingId === adoption.id;
              return (
                <View key={adoption.id} style={styles.adoptionCard}>
                  {/* ヘッダー行 */}
                  <View style={styles.adoptionHead}>
                    {adoption.animalImages[0] ? (
                      <Image source={{ uri: adoption.animalImages[0] }} style={styles.adoptionAnimalImg} />
                    ) : (
                      <View style={[styles.cardBubble, { width: 44, height: 44, borderRadius: 12 }]}>
                        <Text style={{ fontSize: 24 }}>{adoption.animalEmoji}</Text>
                      </View>
                    )}
                    <View style={{ flex: 1 }}>
                      <Text style={styles.adoptionAnimal}>{adoption.animalName}</Text>
                      {adoption.application_number
                        ? <Text style={styles.adoptionNo}>{adoption.application_number}</Text>
                        : null}
                    </View>
                    <View style={[styles.statusPill, { backgroundColor: s.bg }]}>
                      <Text style={[styles.statusText, { color: s.color }]}>{s.label}</Text>
                    </View>
                  </View>

                  {/* 申請者情報 */}
                  <View style={styles.adoptionInfo}>
                    {adoption.applicant_name
                      ? <Text style={styles.adoptionInfoRow}>申請者: {adoption.applicant_name}</Text>
                      : null}
                    {adoption.applicant_email
                      ? <Text style={styles.adoptionInfoRow}>メール: {adoption.applicant_email}</Text>
                      : null}
                    {adoption.applicant_phone
                      ? <Text style={styles.adoptionInfoRow}>電話: {adoption.applicant_phone}</Text>
                      : null}
                    {adoption.applicant_address
                      ? <Text style={styles.adoptionInfoRow}>住所: {adoption.applicant_address}</Text>
                      : null}
                    {adoption.housing_type
                      ? <Text style={styles.adoptionInfoRow}>住居: {adoption.housing_type}</Text>
                      : null}
                    {adoption.reason
                      ? <Text style={styles.adoptionInfoRow}>申請理由: {adoption.reason}</Text>
                      : null}
                    <Text style={styles.adoptionDate}>
                      {new Date(adoption.created_at).toLocaleDateString('ja-JP')} 申請
                    </Text>
                  </View>

                  {/* 受理・拒否ボタン（pending のときだけ表示） */}
                  {adoption.status === 'pending' ? (
                    <View style={styles.adoptionActions}>
                      <TouchableOpacity
                        style={styles.approveBtn}
                        onPress={() => processAdoption(adoption.id, adoption.user_id, adoption.animal_id, adoption.animalName, 'accepted')}
                        disabled={isProcessing}>
                        {isProcessing
                          ? <ActivityIndicator color="#2D4A47" size="small" />
                          : <Text style={styles.approveBtnText}>受理</Text>}
                      </TouchableOpacity>
                      <TouchableOpacity
                        style={styles.rejectBtn}
                        onPress={() => processAdoption(adoption.id, adoption.user_id, adoption.animal_id, adoption.animalName, 'rejected')}
                        disabled={isProcessing}>
                        {isProcessing
                          ? <ActivityIndicator color="#A32D2D" size="small" />
                          : <Text style={styles.rejectBtnText}>拒否</Text>}
                      </TouchableOpacity>
                    </View>
                  ) : adoption.status === 'accepted' || adoption.status === 'rejected' ? (
                    <View style={[styles.adoptionActions, { justifyContent: 'center', paddingVertical: 10 }]}>
                      <Text style={{ fontSize: 13, fontWeight: '700', color: adoption.status === 'accepted' ? '#185FA5' : '#A32D2D' }}>
                        {adoption.status === 'accepted' ? '受理済み' : '拒否済み'}
                      </Text>
                    </View>
                  ) : null}
                </View>
              );
            })
          )}
          <View style={{ height: 30 }} />
        </ScrollView>
      )}

      {/* 登録タイプ選択シート */}
      <Modal visible={showRegisterTypeSheet} transparent animationType="slide" onRequestClose={() => setShowRegisterTypeSheet(false)}>
        <TouchableOpacity style={styles.pickerOverlay} activeOpacity={1} onPress={() => setShowRegisterTypeSheet(false)}>
          <View style={styles.typeSelectSheet}>
            <View style={styles.typeSelectHandle} />
            <Text style={styles.typeSelectTitle}>登録タイプを選択</Text>

            <TouchableOpacity style={styles.typeSelectItem} onPress={() => {
              setShowRegisterTypeSheet(false);
              setShowCompose(true);
            }}>
              <View style={styles.typeSelectItemIcon}>
                <Text style={styles.typeSelectItemEmoji}>🏥</Text>
              </View>
              <View style={styles.typeSelectItemBody}>
                <Text style={styles.typeSelectItemTitle}>保健所として登録</Text>
                <Text style={styles.typeSelectItemSub}>収容動物を保健所データとして登録する</Text>
              </View>
              <Text style={styles.typeSelectArrow}>›</Text>
            </TouchableOpacity>

            <TouchableOpacity style={styles.typeSelectItem} onPress={() => {
              setShowRegisterTypeSheet(false);
              setShowUserPost(true);
            }}>
              <View style={[styles.typeSelectItemIcon, { backgroundColor: '#FFF3E0' }]}>
                <Text style={styles.typeSelectItemEmoji}>👤</Text>
              </View>
              <View style={styles.typeSelectItemBody}>
                <Text style={styles.typeSelectItemTitle}>一般ユーザーとして登録</Text>
                <Text style={styles.typeSelectItemSub}>保護した動物を一般ユーザーとして登録する</Text>
              </View>
              <Text style={styles.typeSelectArrow}>›</Text>
            </TouchableOpacity>

            <View style={{ height: 20 }} />
          </View>
        </TouchableOpacity>
      </Modal>

      {/* 一般ユーザー登録モーダル */}
      <Modal visible={showUserPost} animationType="slide" presentationStyle="pageSheet" onRequestClose={() => { setShowUserPost(false); resetUserPost(); }}>
        <View style={styles.composeModal}>
          <View style={styles.composeModalHeader}>
            <Text style={styles.composeModalTitle}>👤 一般ユーザーとして登録</Text>
            <TouchableOpacity onPress={() => { setShowUserPost(false); resetUserPost(); }} style={styles.modalCloseBtn}>
              <Text style={styles.modalCloseTxt}>✕</Text>
            </TouchableOpacity>
          </View>
          <ScrollView style={styles.composeModalBody} keyboardShouldPersistTaps="handled">
            {userPostDone ? (
              <View style={styles.successNote}>
                <Text style={styles.successText}>✅ 登録が完了しました！</Text>
                <Text style={styles.successSub}>動物一覧に公開されました。</Text>
                <TouchableOpacity style={styles.addMoreBtn} onPress={resetUserPost}>
                  <Text style={styles.addMoreBtnText}>続けて登録する</Text>
                </TouchableOpacity>
              </View>
            ) : (
              <View>
                <Text style={styles.fieldLabel}>種類 *</Text>
                <View style={styles.typeRow}>
                  {(['犬', '猫', 'その他'] as AnimalKind[]).map(t => (
                    <TouchableOpacity key={t} onPress={() => setUserPostKind(t)}
                      style={[styles.typeBtn, userPostKind === t && styles.typeBtnActive]}>
                      <Text style={[styles.typeBtnText, userPostKind === t && styles.typeBtnTextActive]}>
                        {t === '犬' ? '🐕 犬' : t === '猫' ? '🐈 猫' : '🐾 その他'}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>

                <Text style={styles.fieldLabel}>名前 *</Text>
                <TextInput style={styles.input} value={userPostName} onChangeText={setUserPostName}
                  placeholder="例：ポチ、ミケ" placeholderTextColor="#999" />

                <Text style={styles.fieldLabel}>{userPostKind === '犬' ? '犬種' : userPostKind === '猫' ? '猫種' : '種別'}</Text>
                <TextInput style={styles.input} value={userPostBreed} onChangeText={setUserPostBreed}
                  placeholder={userPostKind === '犬' ? '例：柴犬、トイプードル' : userPostKind === '猫' ? '例：三毛猫、スコティッシュ' : '例：ウサギ'}
                  placeholderTextColor="#999" />

                {/* 年齢・体重 */}
                <View style={styles.rowInputs}>
                  <View style={styles.rowInputItem}>
                    <Text style={styles.fieldLabel}>年齢</Text>
                    <TouchableOpacity style={styles.pickerBtn} onPress={() => setShowUserAgePicker(true)}>
                      <Text style={[styles.pickerBtnText, !userPostAge && styles.pickerBtnPlaceholder]}>
                        {userPostAge || '選択'}
                      </Text>
                      <Text style={styles.pickerArrow}>▼</Text>
                    </TouchableOpacity>
                  </View>
                  <View style={styles.rowInputItem}>
                    <Text style={styles.fieldLabel}>体重</Text>
                    <TouchableOpacity style={styles.pickerBtn} onPress={() => setShowUserWeightPicker(true)}>
                      <Text style={[styles.pickerBtnText, !userPostWeight && styles.pickerBtnPlaceholder]}>
                        {userPostWeight || '選択'}
                      </Text>
                      <Text style={styles.pickerArrow}>▼</Text>
                    </TouchableOpacity>
                  </View>
                </View>

                <Text style={styles.fieldLabel}>掲載期限</Text>
                {IS_WEB ? (
                  <TextInput
                    style={styles.input}
                    value={userPostDeadlineObj ? `${userPostDeadlineObj.getFullYear()}-${String(userPostDeadlineObj.getMonth() + 1).padStart(2, '0')}-${String(userPostDeadlineObj.getDate()).padStart(2, '0')}` : ''}
                    onChangeText={(text) => {
                      if (!text) { setUserPostDeadlineObj(null); return; }
                      const d = new Date(text);
                      if (!isNaN(d.getTime())) setUserPostDeadlineObj(d);
                    }}
                    placeholder="YYYY-MM-DD（任意）"
                    placeholderTextColor="#aaa"
                    keyboardType="numeric"
                    maxLength={10}
                  />
                ) : (
                  <TouchableOpacity style={styles.pickerBtn} onPress={() => setShowUserDeadlinePicker(true)}>
                    <Text style={[styles.pickerBtnText, !userPostDeadlineObj && styles.pickerBtnPlaceholder]}>
                      {userPostDeadlineObj ? formatDate(userPostDeadlineObj) : '選択（任意）'}
                    </Text>
                    <Text style={styles.pickerArrow}>📅</Text>
                  </TouchableOpacity>
                )}

                <Text style={styles.fieldLabel}>都道府県</Text>
                <TextInput style={styles.input} value={userPostPrefecture} onChangeText={setUserPostPrefecture}
                  placeholder="例：愛知県" placeholderTextColor="#999" />

                <Text style={styles.fieldLabel}>保護場所</Text>
                <TextInput style={styles.input} value={userPostShelter} onChangeText={setUserPostShelter}
                  placeholder="例：自宅、〇〇公園近くなど" placeholderTextColor="#999" />

                <Text style={styles.fieldLabel}>説明・特記事項</Text>
                <TextInput
                  style={[styles.input, styles.textArea, { minHeight: 90 }]}
                  value={userPostText} onChangeText={setUserPostText}
                  placeholder="健康状態、性格、譲渡条件など..."
                  placeholderTextColor="#999" multiline numberOfLines={4} textAlignVertical="top"
                />

                <Text style={styles.fieldLabel}>写真</Text>
                <TouchableOpacity style={styles.photoBtn} onPress={pickUserPostImages}>
                  <Text style={styles.photoBtnText}>📷 写真を追加（複数可）</Text>
                </TouchableOpacity>
                {userPostImages.length > 0 && (
                  <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.previewScroll}>
                    {userPostImages.map((uri, i) => (
                      <View key={i} style={styles.previewWrap}>
                        <Image source={{ uri }} style={styles.previewImg} />
                        <TouchableOpacity style={styles.removeBtn} onPress={() => setUserPostImages(prev => prev.filter((_, j) => j !== i))}>
                          <Text style={styles.removeBtnText}>✕</Text>
                        </TouchableOpacity>
                      </View>
                    ))}
                  </ScrollView>
                )}

                <TouchableOpacity
                  style={[styles.submitBtn, (!userPostName.trim() || userPostSubmitting) ? styles.submitBtnDisabled : null]}
                  onPress={submitUserPost}
                  disabled={userPostSubmitting}
                >
                  {userPostSubmitting ? <ActivityIndicator color="white" /> : <Text style={styles.submitBtnText}>登録して公開する</Text>}
                </TouchableOpacity>
                <View style={{ height: 40 }} />
              </View>
            )}
          </ScrollView>

          {/* 掲載期限 DatePicker（ネイティブのみ） */}
          {!IS_WEB && (
            <Modal visible={showUserDeadlinePicker} transparent animationType="slide" onRequestClose={() => setShowUserDeadlinePicker(false)}>
              <TouchableOpacity style={styles.pickerOverlay} activeOpacity={1} onPress={() => setShowUserDeadlinePicker(false)}>
                <View style={styles.pickerSheet}>
                  <View style={styles.pickerSheetHeader}>
                    <Text style={styles.pickerSheetTitle}>掲載期限を選択</Text>
                    <TouchableOpacity onPress={() => setShowUserDeadlinePicker(false)}>
                      <Text style={styles.pickerSheetDone}>完了</Text>
                    </TouchableOpacity>
                  </View>
                  <View style={styles.datePickerContainer}>
                    <DateTimePicker
                      value={userPostDeadlineObj ?? new Date()}
                      mode="date"
                      display={Platform.OS === 'ios' ? 'spinner' : 'default'}
                      locale="ja-JP"
                      onChange={(_, date) => {
                        if (Platform.OS !== 'ios') setShowUserDeadlinePicker(false);
                        if (date) setUserPostDeadlineObj(date);
                      }}
                      style={styles.datePicker}
                      themeVariant="light"
                    />
                  </View>
                </View>
              </TouchableOpacity>
            </Modal>
          )}

          {/* 年齢ピッカーモーダル（一般ユーザー） */}
          <Modal visible={showUserAgePicker} transparent animationType="slide" onRequestClose={() => setShowUserAgePicker(false)}>
            <TouchableOpacity style={styles.pickerOverlay} activeOpacity={1} onPress={() => setShowUserAgePicker(false)}>
              <View style={styles.pickerSheet}>
                <View style={styles.pickerSheetHeader}>
                  <Text style={styles.pickerSheetTitle}>年齢を選択</Text>
                  <TouchableOpacity onPress={() => setShowUserAgePicker(false)}>
                    <Text style={styles.pickerSheetDone}>完了</Text>
                  </TouchableOpacity>
                </View>
                <FlatList
                  data={AGE_OPTIONS}
                  keyExtractor={item => item}
                  renderItem={({ item }) => (
                    <TouchableOpacity
                      style={[styles.pickerOption, userPostAge === item && styles.pickerOptionActive]}
                      onPress={() => { setUserPostAge(item); setShowUserAgePicker(false); }}
                    >
                      <Text style={[styles.pickerOptionText, userPostAge === item && styles.pickerOptionTextActive]}>{item}</Text>
                    </TouchableOpacity>
                  )}
                />
              </View>
            </TouchableOpacity>
          </Modal>

          {/* 体重ピッカーモーダル（一般ユーザー） */}
          <Modal visible={showUserWeightPicker} transparent animationType="slide" onRequestClose={() => setShowUserWeightPicker(false)}>
            <TouchableOpacity style={styles.pickerOverlay} activeOpacity={1} onPress={() => setShowUserWeightPicker(false)}>
              <View style={styles.pickerSheet}>
                <View style={styles.pickerSheetHeader}>
                  <Text style={styles.pickerSheetTitle}>体重を選択</Text>
                  <TouchableOpacity onPress={() => setShowUserWeightPicker(false)}>
                    <Text style={styles.pickerSheetDone}>完了</Text>
                  </TouchableOpacity>
                </View>
                <FlatList
                  data={WEIGHT_OPTIONS}
                  keyExtractor={item => item}
                  renderItem={({ item }) => (
                    <TouchableOpacity
                      style={[styles.pickerOption, userPostWeight === item && styles.pickerOptionActive]}
                      onPress={() => { setUserPostWeight(item); setShowUserWeightPicker(false); }}
                    >
                      <Text style={[styles.pickerOptionText, userPostWeight === item && styles.pickerOptionTextActive]}>{item}</Text>
                    </TouchableOpacity>
                  )}
                />
              </View>
            </TouchableOpacity>
          </Modal>
        </View>
      </Modal>

      {/* 動物登録モーダル（保健所スタッフ専用） */}
      <Modal visible={showCompose} animationType="slide" presentationStyle="pageSheet" onRequestClose={closeCompose}>
        <View style={styles.composeModal}>
          <View style={styles.composeModalHeader}>
            <Text style={styles.composeModalTitle}>🏥 保健所スタッフ登録</Text>
            <TouchableOpacity onPress={closeCompose} style={styles.modalCloseBtn}>
              <Text style={styles.modalCloseTxt}>✕</Text>
            </TouchableOpacity>
          </View>

          <ScrollView style={styles.composeModalBody} keyboardShouldPersistTaps="handled">
            {registered ? (
              <View style={styles.successNote}>
                <Text style={styles.successText}>✅ 登録が完了しました！</Text>
                <Text style={styles.successSub}>近隣ユーザーへ通知が送信されました。</Text>
                <TouchableOpacity style={styles.addMoreBtn} onPress={resetForm}>
                  <Text style={styles.addMoreBtnText}>続けて登録する</Text>
                </TouchableOpacity>
              </View>
            ) : (
              <View>
                <Text style={styles.fieldLabel}>種類 *</Text>
                <View style={styles.typeRow}>
                  {(['犬', '猫', 'その他'] as AnimalKind[]).map(t => (
                    <TouchableOpacity key={t} onPress={() => setAnimalKind(t)}
                      style={[styles.typeBtn, animalKind === t && styles.typeBtnActive]}>
                      <Text style={[styles.typeBtnText, animalKind === t && styles.typeBtnTextActive]}>
                        {t === '犬' ? '🐕 犬' : t === '猫' ? '🐈 猫' : '🐾 その他'}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>

                <Text style={styles.fieldLabel}>名前 *</Text>
                <TextInput style={styles.input} value={animalName} onChangeText={setAnimalName}
                  placeholder="例：ポチ、ミケ" placeholderTextColor="#999" />

                <Text style={styles.fieldLabel}>{animalKind === '犬' ? '犬種' : animalKind === '猫' ? '猫種' : '種別'}</Text>
                <TextInput style={styles.input} value={breed} onChangeText={setBreed}
                  placeholder={animalKind === '犬' ? '例：柴犬、トイプードル' : animalKind === '猫' ? '例：三毛猫、スコティッシュ' : '例：ウサギ'}
                  placeholderTextColor="#999" />

                {/* 年齢・体重 */}
                <View style={styles.rowInputs}>
                  <View style={styles.rowInputItem}>
                    <Text style={styles.fieldLabel}>年齢</Text>
                    <TouchableOpacity style={styles.pickerBtn} onPress={() => setShowAgePicker(true)}>
                      <Text style={[styles.pickerBtnText, !age && styles.pickerBtnPlaceholder]}>
                        {age || '選択'}
                      </Text>
                      <Text style={styles.pickerArrow}>▼</Text>
                    </TouchableOpacity>
                  </View>
                  <View style={styles.rowInputItem}>
                    <Text style={styles.fieldLabel}>体重</Text>
                    <TouchableOpacity style={styles.pickerBtn} onPress={() => setShowWeightPicker(true)}>
                      <Text style={[styles.pickerBtnText, !weight && styles.pickerBtnPlaceholder]}>
                        {weight || '選択'}
                      </Text>
                      <Text style={styles.pickerArrow}>▼</Text>
                    </TouchableOpacity>
                  </View>
                </View>

                {/* 処分期限（登録日は自動で今日の日付がセットされます） */}
                <Text style={styles.fieldLabel}>処分期限</Text>
                {IS_WEB ? (
                  <TextInput
                    style={styles.input}
                    value={deadlineDateObj ? `${deadlineDateObj.getFullYear()}-${String(deadlineDateObj.getMonth() + 1).padStart(2, '0')}-${String(deadlineDateObj.getDate()).padStart(2, '0')}` : ''}
                    onChangeText={(text) => {
                      if (!text) { setDeadlineDateObj(null); return; }
                      const d = new Date(text);
                      if (!isNaN(d.getTime())) setDeadlineDateObj(d);
                    }}
                    placeholder="YYYY-MM-DD"
                    placeholderTextColor="#aaa"
                    keyboardType="numeric"
                    maxLength={10}
                  />
                ) : (
                  <TouchableOpacity style={styles.pickerBtn} onPress={() => setShowDeadlineDatePicker(true)}>
                    <Text style={[styles.pickerBtnText, !deadlineDateObj && styles.pickerBtnPlaceholder]}>
                      {deadlineDateObj ? formatDate(deadlineDateObj) : '選択'}
                    </Text>
                    <Text style={styles.pickerArrow}>📅</Text>
                  </TouchableOpacity>
                )}

                <Text style={styles.fieldLabel}>保健所</Text>
                <TouchableOpacity style={styles.shelterSelector} onPress={() => setShowShelterPicker(!showShelterPicker)}>
                  <Text style={styles.shelterSelectorText}>
                    {selectedShelter.name === 'その他' ? (shelterCustom || 'その他（入力）') : selectedShelter.name}
                  </Text>
                  <Text style={styles.shelterArrow}>{showShelterPicker ? '▲' : '▼'}</Text>
                </TouchableOpacity>
                {showShelterPicker && (
                  <View style={styles.shelterList}>
                    {SHELTERS.map((s, i) => (
                      <TouchableOpacity key={i} style={[styles.shelterItem, shelterIndex === i && styles.shelterItemActive]}
                        onPress={() => { setShelterIndex(i); setShowShelterPicker(false); }}>
                        <Text style={[styles.shelterItemText, shelterIndex === i && styles.shelterItemTextActive]}>
                          {s.name}{s.prefecture ? `（${s.prefecture}）` : ''}
                        </Text>
                      </TouchableOpacity>
                    ))}
                  </View>
                )}
                {selectedShelter.name === 'その他' && (
                  <>
                    <TextInput style={styles.input} value={shelterCustom} onChangeText={setShelterCustom} placeholder="保健所名を入力" placeholderTextColor="#999" />
                    <TextInput style={styles.input} value={prefectureCustom} onChangeText={setPrefectureCustom} placeholder="都道府県を入力（例：愛知県）" placeholderTextColor="#999" />
                  </>
                )}

                <Text style={styles.fieldLabel}>写真</Text>
                <TouchableOpacity style={styles.photoBtn} onPress={pickImages}>
                  <Text style={styles.photoBtnText}>📷 写真を追加（複数可）</Text>
                </TouchableOpacity>
                {formImages.length > 0 && (
                  <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.previewScroll}>
                    {formImages.map((uri, i) => (
                      <View key={i} style={styles.previewWrap}>
                        <Image source={{ uri }} style={styles.previewImg} />
                        <TouchableOpacity style={styles.removeBtn} onPress={() => setFormImages(prev => prev.filter((_, j) => j !== i))}>
                          <Text style={styles.removeBtnText}>✕</Text>
                        </TouchableOpacity>
                      </View>
                    ))}
                  </ScrollView>
                )}

                <Text style={styles.fieldLabel}>特記事項</Text>
                <TextInput
                  style={[styles.input, styles.textArea]}
                  value={notes} onChangeText={setNotes}
                  placeholder="例：去勢済み、ワクチン接種済み、首輪あり など"
                  placeholderTextColor="#999" multiline numberOfLines={3}
                />

                <TouchableOpacity style={[styles.submitBtn, (!animalName.trim() || submitting) && styles.submitBtnDisabled]}
                  onPress={register} disabled={submitting}>
                  {submitting
                    ? <ActivityIndicator color="white" />
                    : <Text style={styles.submitBtnText}>登録して公開する</Text>
                  }
                </TouchableOpacity>
                <View style={{ height: 40 }} />
              </View>
            )}
          </ScrollView>

          {/* 年齢ピッカーモーダル */}
          <Modal visible={showAgePicker} transparent animationType="slide" onRequestClose={() => setShowAgePicker(false)}>
            <TouchableOpacity style={styles.pickerOverlay} activeOpacity={1} onPress={() => setShowAgePicker(false)}>
              <View style={styles.pickerSheet}>
                <View style={styles.pickerSheetHeader}>
                  <Text style={styles.pickerSheetTitle}>年齢を選択</Text>
                  <TouchableOpacity onPress={() => setShowAgePicker(false)}>
                    <Text style={styles.pickerSheetDone}>完了</Text>
                  </TouchableOpacity>
                </View>
                <FlatList
                  data={AGE_OPTIONS}
                  keyExtractor={item => item}
                  renderItem={({ item }) => (
                    <TouchableOpacity
                      style={[styles.pickerOption, age === item && styles.pickerOptionActive]}
                      onPress={() => { setAge(item); setShowAgePicker(false); }}
                    >
                      <Text style={[styles.pickerOptionText, age === item && styles.pickerOptionTextActive]}>{item}</Text>
                    </TouchableOpacity>
                  )}
                />
              </View>
            </TouchableOpacity>
          </Modal>

          {/* 体重ピッカーモーダル */}
          <Modal visible={showWeightPicker} transparent animationType="slide" onRequestClose={() => setShowWeightPicker(false)}>
            <TouchableOpacity style={styles.pickerOverlay} activeOpacity={1} onPress={() => setShowWeightPicker(false)}>
              <View style={styles.pickerSheet}>
                <View style={styles.pickerSheetHeader}>
                  <Text style={styles.pickerSheetTitle}>体重を選択</Text>
                  <TouchableOpacity onPress={() => setShowWeightPicker(false)}>
                    <Text style={styles.pickerSheetDone}>完了</Text>
                  </TouchableOpacity>
                </View>
                <FlatList
                  data={WEIGHT_OPTIONS}
                  keyExtractor={item => item}
                  renderItem={({ item }) => (
                    <TouchableOpacity
                      style={[styles.pickerOption, weight === item && styles.pickerOptionActive]}
                      onPress={() => { setWeight(item); setShowWeightPicker(false); }}
                    >
                      <Text style={[styles.pickerOptionText, weight === item && styles.pickerOptionTextActive]}>{item}</Text>
                    </TouchableOpacity>
                  )}
                />
              </View>
            </TouchableOpacity>
          </Modal>

          {/* 処分期限 DatePickerモーダル（ネイティブのみ） */}
          {!IS_WEB && (
            <Modal visible={showDeadlineDatePicker} transparent animationType="slide" onRequestClose={() => setShowDeadlineDatePicker(false)}>
              <TouchableOpacity style={styles.pickerOverlay} activeOpacity={1} onPress={() => setShowDeadlineDatePicker(false)}>
                <View style={styles.pickerSheet}>
                  <View style={styles.pickerSheetHeader}>
                    <Text style={styles.pickerSheetTitle}>処分期限を選択</Text>
                    <TouchableOpacity onPress={() => setShowDeadlineDatePicker(false)}>
                      <Text style={styles.pickerSheetDone}>完了</Text>
                    </TouchableOpacity>
                  </View>
                  <View style={styles.datePickerContainer}>
                    <DateTimePicker
                      value={deadlineDateObj ?? new Date()}
                      mode="date"
                      display={Platform.OS === 'ios' ? 'spinner' : 'default'}
                      locale="ja-JP"
                      onChange={(_, date) => {
                        if (Platform.OS !== 'ios') setShowDeadlineDatePicker(false);
                        if (date) setDeadlineDateObj(date);
                      }}
                      style={styles.datePicker}
                      themeVariant="light"
                    />
                  </View>
                </View>
              </TouchableOpacity>
            </Modal>
          )}
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  outer: { flex: 1, backgroundColor: '#C8E8E3' },

  // ヘッダー
  header: { paddingTop: 60, paddingBottom: 16, paddingHorizontal: 20, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  headerTitle: { fontSize: 22, fontWeight: '800', color: 'white' },
  headerSub: { fontSize: 11, color: 'rgba(255,255,255,0.75)', marginTop: 2, maxWidth: 180 },
  headerActions: { flexDirection: 'row', gap: 8, alignItems: 'center' },
  postBtn: { backgroundColor: 'rgba(255,255,255,0.25)', paddingHorizontal: 16, paddingVertical: 8, borderRadius: 999, borderWidth: 1, borderColor: 'rgba(255,255,255,0.5)' },
  postBtnText: { color: 'white', fontSize: 13, fontWeight: '700' },
  adminKeyBtn: { width: 36, height: 36, borderRadius: 18, backgroundColor: 'rgba(255,255,255,0.15)', alignItems: 'center', justifyContent: 'center' },
  adminKeyBtnText: { fontSize: 17 },
  logoutBtn: { paddingHorizontal: 12, paddingVertical: 8 },
  logoutBtnText: { color: 'rgba(255,255,255,0.75)', fontSize: 12 },

  // サマリー
  summaryRow: { flexDirection: 'row', backgroundColor: 'white', borderBottomWidth: 0.5, borderBottomColor: '#EDE8E0' },
  summaryItem: { flex: 1, alignItems: 'center', paddingVertical: 12, borderBottomWidth: 2, borderBottomColor: 'transparent' },
  summaryItemActive: { borderBottomColor: '#F08080' },
  summaryItemActiveRed: { borderBottomColor: '#A32D2D', backgroundColor: '#FFF8F8' },
  summaryItemActiveBlue: { borderBottomColor: '#185FA5', backgroundColor: '#F5F8FF' },
  summaryItemActiveGreen: { borderBottomColor: '#555' },
  summaryNum: { fontSize: 20, fontWeight: '800' },
  summaryNumActive: { color: '#F08080' },
  summaryLabel: { fontSize: 10, color: '#999', marginTop: 2 },

  // 都道府県フィルター
  prefBar: { flexGrow: 0, backgroundColor: '#C8E8E3', borderBottomWidth: 0.5, borderBottomColor: '#B0D4CF' },
  prefBarContent: { paddingHorizontal: 12, paddingVertical: 9, gap: 7 },
  prefChip: { paddingHorizontal: 13, paddingVertical: 6, borderRadius: 999, backgroundColor: 'white', borderWidth: 1, borderColor: '#EDE8E0' },
  prefChipActive: { backgroundColor: '#F08080', borderColor: '#F08080' },
  prefChipText: { fontSize: 12, color: '#777', fontWeight: '500' },
  prefChipTextActive: { color: 'white', fontWeight: '700' },

  list: { flex: 1 },
  listLabel: { fontSize: 11, fontWeight: '700', color: '#aaa', paddingHorizontal: 16, paddingTop: 12, paddingBottom: 6, letterSpacing: 0.5 },
  empty: { alignItems: 'center', padding: 44, gap: 10 },
  emptyEmoji: { fontSize: 44 },
  emptyText: { fontSize: 14, color: '#bbb' },

  // 動物カード
  card: { backgroundColor: 'white', marginHorizontal: 12, marginBottom: 10, borderRadius: 18, overflow: 'hidden', shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.07, shadowRadius: 8, elevation: 2 },
  urgentBar: { height: 4, backgroundColor: '#A32D2D' },
  cardTop: { flexDirection: 'row', gap: 12, padding: 14, paddingBottom: 10 },
  cardThumb: { width: 72, height: 96, borderRadius: 14, flexShrink: 0 },
  cardBubble: { width: 72, height: 72, borderRadius: 14, alignItems: 'center', justifyContent: 'center', flexShrink: 0 },
  cardEmoji: { fontSize: 36 },
  cardInfo: { flex: 1 },
  cardNameRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 3 },
  cardName: { fontSize: 16, fontWeight: '700', color: '#1a1a1a' },
  statusPill: { paddingHorizontal: 9, paddingVertical: 3, borderRadius: 999 },
  statusText: { fontSize: 10, fontWeight: '700' },
  cardBreed: { fontSize: 12, color: '#555', marginBottom: 3 },
  cardMetaRow: { flexDirection: 'row', alignItems: 'center', gap: 4, marginBottom: 3 },
  cardMeta: { fontSize: 12, color: '#888' },
  cardMetaDot: { fontSize: 12, color: '#ccc' },
  cardShelter: { fontSize: 11, color: '#aaa' },
  cardBottom: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 14, paddingBottom: 10 },
  cardDates: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  cardDateLabel: { fontSize: 10, color: '#bbb', fontWeight: '600' },
  cardDateValue: { fontSize: 12, color: '#555', fontWeight: '500' },
  cardDateUrgent: { color: '#A32D2D', fontWeight: '700' },
  cardArrow: { fontSize: 24, color: '#ccc' },
  cardNotes: { backgroundColor: '#F8FAF8', paddingHorizontal: 14, paddingVertical: 8, borderTopWidth: 0.5, borderTopColor: '#EDE8E0' },
  cardNotesText: { fontSize: 11, color: '#888' },
  transferredBtnRow: { borderTopWidth: 0.5, borderTopColor: '#EDE8E0', paddingHorizontal: 14, paddingVertical: 8 },
  transferredBtn: { backgroundColor: '#FFF3E0', borderWidth: 1, borderColor: '#E8A857', borderRadius: 10, paddingVertical: 8, alignItems: 'center' },
  transferredBtnText: { fontSize: 13, fontWeight: '700', color: '#B45309' },

  // 期限間近セクション
  nearDeadlineHeader: {
    marginHorizontal: 12, marginTop: 8, marginBottom: 6,
    backgroundColor: '#FEF3C7', borderRadius: 14, padding: 12,
    borderLeftWidth: 4, borderLeftColor: '#F59E0B',
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
  },
  nearDeadlineHeaderText: { fontSize: 13, fontWeight: '800', color: '#92400E' },
  nearDeadlineHeaderSub: { fontSize: 11, color: '#B45309' },
  nearDeadlineCard: { borderColor: '#FCA5A5', borderWidth: 1 },
  nearDeadlineBar: { height: 3, backgroundColor: '#DC2626' },
  sectionDivider: { height: 1, backgroundColor: '#E5E7EB', marginHorizontal: 12, marginTop: 6, marginBottom: 10 },
  cardUrgentBorder: {},

  // 申請中バッジ
  cardBadgeRow: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  applyingBadge: { backgroundColor: '#DBEAFE', paddingHorizontal: 7, paddingVertical: 2, borderRadius: 999 },
  applyingBadgeText: { fontSize: 9, fontWeight: '800', color: '#1D4ED8' },

  // 残り日数ピル
  daysLeftPill: { paddingHorizontal: 7, paddingVertical: 2, borderRadius: 999, marginLeft: 6 },
  daysLeftText: { fontSize: 9, fontWeight: '800' },

  // 登録モーダル
  composeModal: { flex: 1, backgroundColor: '#C8E8E3' },
  composeModalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 20, paddingTop: 56, paddingBottom: 16, backgroundColor: 'white', borderBottomWidth: 0.5, borderBottomColor: '#EDE8E0' },
  composeModalTitle: { fontSize: 16, fontWeight: '800', color: '#1a1a1a' },
  composeModalBody: { flex: 1, padding: 16 },
  modalCloseBtn: { width: 36, height: 36, borderRadius: 18, backgroundColor: '#EDE8E0', alignItems: 'center', justifyContent: 'center' },
  modalCloseTxt: { fontSize: 15, color: '#555', fontWeight: '700' },

  pickerBtn: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', borderWidth: 1, borderColor: '#EDE8E0', borderRadius: 12, padding: 11, marginBottom: 10, backgroundColor: '#FAFAF8' },
  pickerBtnText: { fontSize: 14, color: '#222' },
  pickerBtnPlaceholder: { color: '#aaa' },
  pickerArrow: { fontSize: 11, color: '#888' },
  pickerOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.4)', justifyContent: 'flex-end' },
  pickerSheet: { backgroundColor: 'white', borderTopLeftRadius: 20, borderTopRightRadius: 20, maxHeight: '60%' },
  datePickerContainer: { backgroundColor: 'white', paddingBottom: 16 },
  datePicker: { height: 216, backgroundColor: 'white' },
  pickerSheetHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 16, borderBottomWidth: 0.5, borderBottomColor: '#EDE8E0' },
  pickerSheetTitle: { fontSize: 14, fontWeight: '700', color: '#1a1a1a' },
  pickerSheetDone: { fontSize: 14, color: '#F08080', fontWeight: '700' },
  pickerOption: { paddingVertical: 13, paddingHorizontal: 20, borderBottomWidth: 0.5, borderBottomColor: '#f0f0f0' },
  pickerOptionActive: { backgroundColor: '#FFE4E4' },
  pickerOptionText: { fontSize: 15, color: '#333' },
  pickerOptionTextActive: { color: '#2D4A47', fontWeight: '700' },
  authPrompt: { alignItems: 'center', paddingVertical: 32, gap: 14 },
  authPromptEmoji: { fontSize: 48 },
  authPromptText: { fontSize: 14, color: '#555', textAlign: 'center' },
  authLabel: { fontSize: 13, color: '#555', marginBottom: 10 },
  fieldLabel: { fontSize: 12, fontWeight: '700', color: '#444', marginBottom: 5, marginTop: 6 },
  input: { borderWidth: 1, borderColor: '#EDE8E0', borderRadius: 12, padding: 11, fontSize: 14, color: '#222', marginBottom: 10, backgroundColor: '#FAFAF8' },
  textArea: { height: 70, textAlignVertical: 'top' },
  inputError: { borderColor: '#E24B4A' },
  errorText: { fontSize: 12, color: '#E24B4A', marginBottom: 8 },
  authBtn: { backgroundColor: '#A8D8CF', padding: 13, borderRadius: 12, alignItems: 'center' },
  authBtnText: { color: 'white', fontSize: 14, fontWeight: '700' },
  typeRow: { flexDirection: 'row', gap: 8, marginBottom: 12 },
  typeBtn: { flex: 1, paddingVertical: 9, borderRadius: 12, backgroundColor: '#f5f5f5', alignItems: 'center' },
  typeBtnActive: { backgroundColor: '#FFE4E4' },
  typeBtnText: { fontSize: 13, color: '#888', fontWeight: '500' },
  typeBtnTextActive: { color: '#2D4A47', fontWeight: '700' },
  rowInputs: { flexDirection: 'row', gap: 8 },
  rowInputItem: { flex: 1 },
  shelterSelector: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', borderWidth: 1, borderColor: '#EDE8E0', borderRadius: 12, padding: 11, marginBottom: 8, backgroundColor: '#FAFAF8' },
  shelterSelectorText: { fontSize: 14, color: '#333' },
  shelterArrow: { fontSize: 11, color: '#888' },
  shelterList: { borderWidth: 1, borderColor: '#EDE8E0', borderRadius: 12, marginBottom: 10, overflow: 'hidden' },
  shelterItem: { padding: 12, borderBottomWidth: 0.5, borderBottomColor: '#eee' },
  shelterItemActive: { backgroundColor: '#FFE4E4' },
  shelterItemText: { fontSize: 14, color: '#444' },
  shelterItemTextActive: { color: '#2D4A47', fontWeight: '700' },
  photoBtn: { paddingVertical: 11, borderRadius: 12, borderWidth: 1, borderColor: '#EDE8E0', alignItems: 'center', marginBottom: 10, borderStyle: 'dashed', backgroundColor: '#FAFAF8' },
  photoBtnText: { fontSize: 13, color: '#555' },
  previewScroll: { marginBottom: 10 },
  previewWrap: { position: 'relative', marginRight: 8 },
  previewImg: { width: 80, height: 80, borderRadius: 10 },
  removeBtn: { position: 'absolute', top: 3, right: 3, backgroundColor: 'rgba(0,0,0,0.55)', borderRadius: 999, width: 20, height: 20, alignItems: 'center', justifyContent: 'center' },
  removeBtnText: { color: 'white', fontSize: 9, fontWeight: '700' },
  submitBtn: { backgroundColor: '#F08080', padding: 14, borderRadius: 14, alignItems: 'center', marginTop: 6 },
  submitBtnDisabled: { backgroundColor: '#c0c0c0' },
  submitBtnText: { color: 'white', fontSize: 15, fontWeight: '700' },
  // タブ
  tabRow: { flexDirection: 'row', backgroundColor: 'white', borderBottomWidth: 0.5, borderBottomColor: '#EDE8E0' },
  tabBtn: { flex: 1, paddingVertical: 11, alignItems: 'center', borderBottomWidth: 2, borderBottomColor: 'transparent' },
  tabBtnActive: { borderBottomColor: '#F08080' },
  tabBtnText: { fontSize: 13, color: '#aaa', fontWeight: '500' },
  tabBtnTextActive: { color: '#F08080', fontWeight: '700' },

  // 申請カード
  adoptionAnimalImg: { width: 44, height: 44, borderRadius: 10, resizeMode: 'cover', marginRight: 10, flexShrink: 0 },
  adoptionCard: { backgroundColor: 'white', marginHorizontal: 12, marginTop: 10, borderRadius: 16, overflow: 'hidden', shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.06, shadowRadius: 6, elevation: 2 },
  adoptionHead: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 14, paddingTop: 12, paddingBottom: 6 },
  adoptionAnimal: { fontSize: 14, fontWeight: '700', color: '#1a1a1a' },
  adoptionNo: { fontSize: 11, color: '#aaa', marginTop: 2 },
  adoptionInfo: { paddingHorizontal: 14, paddingBottom: 10, gap: 3 },
  adoptionInfoRow: { fontSize: 13, color: '#444', lineHeight: 20 },
  adoptionDate: { fontSize: 11, color: '#bbb', marginTop: 4 },
  adoptionActions: { flexDirection: 'row', borderTopWidth: 0.5, borderTopColor: '#EDE8E0' },
  approveBtn: { flex: 1, paddingVertical: 12, alignItems: 'center', backgroundColor: '#D4EEE9' },
  approveBtnText: { fontSize: 14, fontWeight: '700', color: '#2D4A47' },
  rejectBtn: { flex: 1, paddingVertical: 12, alignItems: 'center', backgroundColor: '#FCEBEB', borderLeftWidth: 0.5, borderLeftColor: '#EDE8E0' },
  rejectBtnText: { fontSize: 14, fontWeight: '700', color: '#A32D2D' },

  successNote: { backgroundColor: '#D4EEE9', borderRadius: 16, padding: 22, alignItems: 'center' },
  successText: { fontSize: 16, fontWeight: '800', color: '#2D4A47', marginBottom: 6 },
  successSub: { fontSize: 13, color: '#2D4A47', marginBottom: 16 },
  addMoreBtn: { borderWidth: 1.5, borderColor: '#F08080', paddingHorizontal: 20, paddingVertical: 9, borderRadius: 999 },
  addMoreBtnText: { fontSize: 13, color: '#F08080', fontWeight: '700' },

  // 登録タイプ選択シート
  typeSelectSheet: { backgroundColor: 'white', borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 20, paddingBottom: 40 },
  typeSelectHandle: { width: 36, height: 4, backgroundColor: '#DDD', borderRadius: 2, alignSelf: 'center', marginBottom: 18 },
  typeSelectTitle: { fontSize: 15, fontWeight: '800', color: '#1a1a1a', marginBottom: 16, textAlign: 'center' },
  typeSelectItem: { flexDirection: 'row', alignItems: 'center', gap: 14, backgroundColor: '#F8FAF8', borderRadius: 16, padding: 14, marginBottom: 10 },
  typeSelectItemIcon: { width: 46, height: 46, borderRadius: 14, backgroundColor: '#D4EEE9', alignItems: 'center', justifyContent: 'center', flexShrink: 0 },
  typeSelectItemEmoji: { fontSize: 22 },
  typeSelectItemBody: { flex: 1 },
  typeSelectItemTitle: { fontSize: 14, fontWeight: '700', color: '#1a1a1a', marginBottom: 3 },
  typeSelectItemSub: { fontSize: 12, color: '#888' },
  typeSelectArrow: { fontSize: 22, color: '#ccc' },
});
