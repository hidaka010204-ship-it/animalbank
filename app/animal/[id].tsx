import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { goBack } from '../../lib/navigation';
import { useEffect, useState } from 'react';
import {
  ActivityIndicator, Dimensions, Image, Modal,
  ScrollView, Share, StyleSheet, Text, TextInput, TouchableOpacity, View,
} from 'react-native';
import { showAlert } from '../../lib/alert';
import { supabase } from '../../lib/supabase';
import { mapToAnimal, useApp } from '../_appContext';

const { width: SW, height: SH } = Dimensions.get('window');
const HERO_H = Math.round(SW * 0.9);

export default function AnimalDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const { animals, loading, favorites, toggleFavorite, userProfile, session, refreshAnimals, themeColor } = useApp();
  const contextAnimal = animals.find(a => a.id === id);
  const [localAnimal, setLocalAnimal] = useState<ReturnType<typeof mapToAnimal> | null>(null);
  const [localLoading, setLocalLoading] = useState(false);

  // コンテキストに存在しない場合（譲渡済みなど）は Supabase から直接取得
  useEffect(() => {
    if (!loading && !contextAnimal && id) {
      setLocalLoading(true);
      supabase
        .from('animals')
        .select('id, name, species, breed, gender, description, is_urgent, deadline, admitted_at, status, shelter, prefecture, source, user_id, images')
        .eq('id', id)
        .single()
        .then(({ data, error }) => {
          if (!error && data) setLocalAnimal(mapToAnimal(data as Record<string, unknown>));
          setLocalLoading(false);
        });
    }
  }, [loading, contextAnimal, id]);

  const animal = contextAnimal ?? localAnimal;

  const [hasApplied, setHasApplied] = useState(false);

  useEffect(() => {
    if (!session?.user?.id || !id) return;
    supabase
      .from('adoptions')
      .select('id')
      .eq('user_id', session.user.id)
      .eq('animal_id', id)
      .maybeSingle()
      .then(({ data }) => setHasApplied(!!data));
  }, [session?.user?.id, id]);

  const [showForm, setShowForm] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [applicantName, setApplicantName] = useState(userProfile.nickname);
  const [applicantPhone, setApplicantPhone] = useState('');
  const [applicantEmail, setApplicantEmail] = useState('');
  const [applicantAddress, setApplicantAddress] = useState('');
  const [housingType, setHousingType] = useState('');
  const [reason, setReason] = useState('');
  const [currentPhotoIndex, setCurrentPhotoIndex] = useState(0);
  const [imgLoading, setImgLoading] = useState<Record<number, boolean>>({});
  const [lightboxUri, setLightboxUri] = useState<string | null>(null);

  if (loading || localLoading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color="#4FA3A0" />
      </View>
    );
  }

  if (!animal) {
    return (
      <View style={styles.center}>
        <Text style={styles.notFoundEmoji}>🐾</Text>
        <Text style={styles.notFoundText}>動物が見つかりません</Text>
        <TouchableOpacity style={styles.notFoundBtn} onPress={() => goBack(router)}>
          <Text style={styles.notFoundBtnText}>← 一覧に戻る</Text>
        </TouchableOpacity>
      </View>
    );
  }

  const isFav = favorites.has(animal.id);

  const requireLogin = (action: string) => {
    if (!session) {
      showAlert(
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

  const submit = async () => {
    if (!applicantName.trim() || !applicantEmail.trim() || !applicantPhone.trim() || !applicantAddress.trim()) {
      showAlert('入力不足', 'お名前・メールアドレス・電話番号・住所は必須です');
      return;
    }
    setSubmitting(true);
    try {
      const { error } = await supabase.from('adoptions').insert({
        animal_id: animal.id,
        user_id: session?.user?.id ?? null,
        applicant_name: applicantName.trim(),
        applicant_phone: applicantPhone.trim(),
        applicant_email: applicantEmail.trim(),
        applicant_address: applicantAddress.trim(),
        housing_type: housingType || null,
        reason: reason.trim() || null,
        status: 'pending',
      });
      if (error) { showAlert('送信エラー', error.message); return; }
      const { error: animalUpdateError } = animal.status === 'available' ? await supabase
        .from('animals').update({ status: 'pending' }).eq('id', animal.id) : { error: null };
      if (animalUpdateError) {
        console.error('[submit] animals UPDATE エラー:', animalUpdateError);
      } else {
        refreshAnimals();
      }
      setSubmitted(true);
      setShowForm(false);
    } catch {
      showAlert('エラーが発生しました', '時間をおいて再度お試しください。');
    } finally {
      setSubmitting(false);
    }
  };

  const handleReport = () => {
    if (!requireLogin('通報')) return;
    const uid = session?.user?.id;
    if (!uid) return;
    const submit = async (reason: string) => {
      const { error } = await supabase.from('reports').insert({
        target_type: 'animal',
        target_id: animal!.id,
        reason,
        reporter_id: uid,
      });
      if (error) {
        showAlert('エラー', 'もう一度お試しください');
      } else {
        showAlert('通報しました', '確認後対応いたします');
      }
    };
    showAlert(
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

  const handleShare = async () => {
    const deepLink = `https://animalbank.expo.dev/animal/${animal.id}`;
    const kindGender = [animal.animalKind, animal.gender].filter(Boolean).join('/');
    const shelterLine = [animal.shelter, animal.prefecture ? `#${animal.prefecture}` : ''].filter(Boolean).join(' ');
    const message = [
      `【あにまるバンク】${animal.name}を保護中！`,
      kindGender,
      shelterLine,
      '#保護動物 #里親募集',
      '',
      deepLink,
    ].filter((line, i) => i === 4 || Boolean(line)).join('\n');
    try {
      await Share.share({ message });
    } catch {
      // キャンセルまたはエラー
    }
  };

  const kindColor = animal.animalKind === '犬'
    ? { bg: '#D4EEE9', text: '#2D4A47', label: '🐕 犬' }
    : animal.animalKind === '猫'
    ? { bg: '#EEEDFE', text: '#5B4FCF', label: '🐈 猫' }
    : { bg: '#F5EDD8', text: '#8A5030', label: '🐾 その他' };

  const deadlineLabel = animal.source === 'shelter' ? '処分期限' : '掲載期限';
  const hasGrid = !!animal.gender || !!animal.age || !!animal.weight || !!animal.intakeDate;

  return (
    <>
      <ScrollView style={styles.container} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>

        {/* ── ヒーロー写真エリア ── */}
        <View style={{ height: HERO_H, backgroundColor: '#111' }}>
          {animal.images.length > 0 ? (
            <>
              <ScrollView
                horizontal pagingEnabled
                showsHorizontalScrollIndicator={false}
                onScroll={e => setCurrentPhotoIndex(Math.round(e.nativeEvent.contentOffset.x / SW))}
                scrollEventThrottle={16}
                style={{ height: HERO_H }}
              >
                {animal.images.map((uri, i) => (
                  <TouchableOpacity
                    key={i} style={{ width: SW, height: HERO_H }}
                    onPress={() => setLightboxUri(uri)} activeOpacity={0.95}
                  >
                    <Image
                      source={{ uri }}
                      style={{ width: SW, height: HERO_H }}
                      resizeMode="cover"
                      onLoadStart={() => setImgLoading(p => ({ ...p, [i]: true }))}
                      onLoadEnd={() => setImgLoading(p => ({ ...p, [i]: false }))}
                    />
                    {imgLoading[i] && (
                      <ActivityIndicator style={StyleSheet.absoluteFill} color="#A8D8CF" size="large" />
                    )}
                  </TouchableOpacity>
                ))}
              </ScrollView>

              {/* 下グラデーション + 名前 */}
              <LinearGradient
                colors={['transparent', 'rgba(0,0,0,0.78)']}
                style={styles.heroGradient}
                pointerEvents="none"
              >
                <Text style={styles.heroName}>{animal.name}</Text>
                {!!animal.breed && <Text style={styles.heroBreed}>{animal.breed}</Text>}
              </LinearGradient>

              {/* ページドット */}
              {animal.images.length > 1 && (
                <View style={styles.dotsWrap}>
                  {animal.images.map((_, i) => (
                    <View key={i} style={[styles.dot, i === currentPhotoIndex && styles.dotActive]} />
                  ))}
                </View>
              )}
            </>
          ) : (
            /* 写真なしプレースホルダー */
            <LinearGradient
              colors={[themeColor, '#A8D8CF', '#C8E8E3']}
              start={{ x: 0.1, y: 0 }} end={{ x: 0.9, y: 1 }}
              style={[StyleSheet.absoluteFill, styles.heroPlaceholder]}
            >
              <View style={styles.heroEmojiWrap}>
                <Text style={styles.heroEmoji}>{animal.emoji}</Text>
              </View>
              <Text style={styles.heroName}>{animal.name}</Text>
              {!!animal.breed && <Text style={styles.heroBreed}>{animal.breed}</Text>}
            </LinearGradient>
          )}

          {/* 戻るボタン */}
          <TouchableOpacity style={styles.backBtn} onPress={() => goBack(router)}>
            <Text style={styles.backBtnText}>‹</Text>
          </TouchableOpacity>

          {/* ♥ お気に入りボタン */}
          <TouchableOpacity
            style={[styles.favBtn, isFav && styles.favBtnActive]}
            onPress={() => { if (requireLogin('お気に入り登録')) toggleFavorite(animal.id); }}
            activeOpacity={0.8}
          >
            <Text style={[styles.favBtnText, isFav && styles.favBtnTextActive]}>
              {isFav ? '♥' : '♡'}
            </Text>
          </TouchableOpacity>

          {/* シェアボタン */}
          <TouchableOpacity style={styles.shareBtn} onPress={handleShare} activeOpacity={0.8}>
            <Ionicons name="paper-plane-outline" size={22} color="rgba(255,255,255,0.9)" />
          </TouchableOpacity>

          {/* 通報ボタン */}
          {!!session && (
            <TouchableOpacity style={styles.reportBtn} onPress={handleReport} activeOpacity={0.8}>
              <Text style={styles.reportBtnText}>通報</Text>
            </TouchableOpacity>
          )}
        </View>

        {/* ── 名前 + バッジカード（ヒーローに重ねる） ── */}
        <View style={styles.nameCard}>
          <Text style={styles.animalName}>{animal.name}</Text>

          <View style={styles.badgeRow}>
            <View style={[styles.badge, { backgroundColor: kindColor.bg }]}>
              <Text style={[styles.badgeText, { color: kindColor.text }]}>{kindColor.label}</Text>
            </View>
            <View style={[styles.badge, { backgroundColor: animal.statusBg }]}>
              <Text style={[styles.badgeText, { color: animal.statusColor }]}>{animal.status}</Text>
            </View>
            {animal.urgent && (
              <View style={[styles.badge, { backgroundColor: '#FFE4E4' }]}>
                <Text style={[styles.badgeText, { color: '#C0392B' }]}>🚨 緊急</Text>
              </View>
            )}
          </View>

          {/* 処分/掲載期限バッジ */}
          {!!animal.disposalDeadline && (
            <View style={[styles.deadlineBadge, animal.urgent && styles.deadlineBadgeUrgent]}>
              <Text style={styles.deadlineBadgeIcon}>⏰</Text>
              <View style={{ flex: 1 }}>
                <Text style={[styles.deadlineBadgeLabel, animal.urgent && { color: '#B91C1C' }]}>
                  {deadlineLabel}
                </Text>
                <Text style={[styles.deadlineBadgeDate, animal.urgent && { color: '#B91C1C', fontWeight: '800' as const }]}>
                  {animal.disposalDeadline}
                </Text>
              </View>
              {animal.urgent && (
                <View style={styles.deadlineUrgentPill}>
                  <Text style={styles.deadlineUrgentPillTxt}>期限迫る</Text>
                </View>
              )}
            </View>
          )}
        </View>

        {/* ── 基本情報グリッド ── */}
        {hasGrid && (
          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <View style={[styles.sectionAccent, { backgroundColor: themeColor }]} />
              <Text style={styles.sectionTitle}>基本情報</Text>
            </View>
            <View style={styles.grid}>
              {!!animal.gender && (
                <View style={styles.gridItem}>
                  <Text style={styles.gridIcon}>⚧</Text>
                  <Text style={styles.gridLabel}>性別</Text>
                  <Text style={styles.gridValue}>{animal.gender}</Text>
                </View>
              )}
              {!!animal.age && (
                <View style={styles.gridItem}>
                  <Text style={styles.gridIcon}>🎂</Text>
                  <Text style={styles.gridLabel}>年齢</Text>
                  <Text style={styles.gridValue}>{animal.age}</Text>
                </View>
              )}
              {!!animal.weight && (
                <View style={styles.gridItem}>
                  <Text style={styles.gridIcon}>⚖️</Text>
                  <Text style={styles.gridLabel}>体重</Text>
                  <Text style={styles.gridValue}>{animal.weight}</Text>
                </View>
              )}
              {!!animal.intakeDate && (
                <View style={styles.gridItem}>
                  <Text style={styles.gridIcon}>📅</Text>
                  <Text style={styles.gridLabel}>収容日</Text>
                  <Text style={styles.gridValue}>{animal.intakeDate}</Text>
                </View>
              )}
            </View>
          </View>
        )}

        {/* ── 保健所カード ── */}
        {(!!animal.shelter || !!animal.prefecture) && (
          <View style={styles.shelterCard}>
            <LinearGradient
              colors={['#EAF6F4', '#D4EEE9']}
              start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}
              style={styles.shelterCardInner}
            >
              <View style={[styles.shelterIconWrap, { backgroundColor: themeColor + '28' }]}>
                <Text style={styles.shelterIcon}>🏛️</Text>
              </View>
              <View style={{ flex: 1 }}>
                <Text style={[styles.shelterLabel, { color: themeColor }]}>
                  {animal.source === 'shelter' ? '保健所・収容施設' : '掲載者情報'}
                </Text>
                {!!animal.shelter && <Text style={styles.shelterName}>{animal.shelter}</Text>}
                {!!animal.prefecture && <Text style={styles.shelterPref}>📍 {animal.prefecture}</Text>}
              </View>
            </LinearGradient>
          </View>
        )}

        {/* ── 説明文 ── */}
        {!!animal.description && (
          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <View style={[styles.sectionAccent, { backgroundColor: themeColor }]} />
              <Text style={styles.sectionTitle}>詳細情報</Text>
            </View>
            <Text style={styles.descText}>{animal.description}</Text>
          </View>
        )}

        {/* ── 特記事項 ── */}
        {!!animal.notes && (
          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <View style={[styles.sectionAccent, { backgroundColor: '#F59E0B' }]} />
              <Text style={styles.sectionTitle}>特記事項</Text>
            </View>
            <View style={styles.notesBox}>
              <Text style={styles.notesText}>{animal.notes}</Text>
            </View>
          </View>
        )}

        {/* ── 申請エリア ── */}
        <View style={styles.applyArea}>
          {!session ? (
            <View style={styles.loginPrompt}>
              <View style={[styles.loginPromptIconWrap, { backgroundColor: themeColor + '22' }]}>
                <Text style={styles.loginPromptEmoji}>🔐</Text>
              </View>
              <Text style={styles.loginPromptTitle}>ログインが必要です</Text>
              <Text style={styles.loginPromptSub}>里親申請にはアカウントが必要です</Text>
              <TouchableOpacity
                style={[styles.loginPromptBtn, { backgroundColor: themeColor }]}
                onPress={() => router.push('/auth' as any)}
              >
                <Text style={styles.loginPromptBtnTxt}>ログイン / 新規登録</Text>
              </TouchableOpacity>
            </View>
          ) : submitted ? (
            <View style={styles.successBox}>
              <View style={[styles.successIconWrap, { backgroundColor: themeColor + '22' }]}>
                <Text style={styles.successEmoji}>🐾</Text>
              </View>
              <Text style={[styles.successTitle, { color: themeColor }]}>申請を送信しました！</Text>
              <Text style={styles.successNote}>
                登録者からの返答をお待ちください。{'\n'}マイページで申請状況をご確認いただけます。
              </Text>
            </View>
          ) : hasApplied ? (
            <View style={styles.successBox}>
              <View style={[styles.successIconWrap, { backgroundColor: themeColor + '22' }]}>
                <Text style={styles.successEmoji}>✅</Text>
              </View>
              <Text style={[styles.successTitle, { color: themeColor }]}>申請済みです</Text>
              <Text style={styles.successNote}>
                この動物への申請はすでに送信されています。{'\n'}マイページで申請状況をご確認ください。
              </Text>
            </View>
          ) : (
            <>
              {/* 申請ボタン（ミントグリーン） */}
              <TouchableOpacity
                style={styles.applyBtn}
                onPress={() => { if (!showForm && !requireLogin('里親申請')) return; setShowForm(!showForm); }}
                activeOpacity={0.85}
              >
                <LinearGradient
                  colors={showForm ? ['#3D8B85', '#2D7A77'] : [themeColor, '#3D8B85']}
                  start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}
                  style={styles.applyBtnGrad}
                >
                  <Text style={styles.applyBtnText}>
                    {showForm ? '▲ フォームを閉じる' : '🐾 里親申請をする'}
                  </Text>
                </LinearGradient>
              </TouchableOpacity>

              {showForm && (
                <View style={styles.form}>
                  <Text style={styles.formTitle}>里親申請フォーム</Text>
                  <Text style={styles.formNote}>※ は必須項目です</Text>

                  <Text style={styles.fieldLabel}>申請者名 ※</Text>
                  <TextInput
                    style={styles.input}
                    placeholder="例：山田 太郎" placeholderTextColor="#bbb"
                    value={applicantName} onChangeText={setApplicantName}
                  />

                  <Text style={styles.fieldLabel}>メールアドレス ※</Text>
                  <TextInput
                    style={styles.input}
                    placeholder="例：taro@example.com" placeholderTextColor="#bbb"
                    value={applicantEmail} onChangeText={setApplicantEmail}
                    keyboardType="email-address" autoCapitalize="none"
                  />

                  <Text style={styles.fieldLabel}>電話番号 ※</Text>
                  <TextInput
                    style={styles.input}
                    placeholder="例：090-1234-5678" placeholderTextColor="#bbb"
                    value={applicantPhone} onChangeText={setApplicantPhone}
                    keyboardType="phone-pad"
                  />

                  <Text style={styles.fieldLabel}>住所 ※</Text>
                  <TextInput
                    style={styles.input}
                    placeholder="例：愛知県名古屋市中区..." placeholderTextColor="#bbb"
                    value={applicantAddress} onChangeText={setApplicantAddress}
                  />

                  <Text style={styles.fieldLabel}>住居タイプ</Text>
                  <View style={styles.housingRow}>
                    {['一戸建て', 'マンション', 'アパート', 'その他'].map(ht => (
                      <TouchableOpacity
                        key={ht}
                        style={[
                          styles.housingChip,
                          housingType === ht && { backgroundColor: themeColor + '20', borderColor: themeColor },
                        ]}
                        onPress={() => setHousingType(housingType === ht ? '' : ht)}
                      >
                        <Text style={[
                          styles.housingChipText,
                          housingType === ht && { color: themeColor, fontWeight: '700' as const },
                        ]}>
                          {ht}
                        </Text>
                      </TouchableOpacity>
                    ))}
                  </View>

                  <Text style={styles.fieldLabel}>申請理由・飼育環境</Text>
                  <TextInput
                    style={[styles.input, styles.textArea]}
                    placeholder="動物を迎える理由や生活環境についてご記入ください"
                    placeholderTextColor="#bbb"
                    value={reason} onChangeText={setReason}
                    multiline numberOfLines={4} textAlignVertical="top"
                  />

                  <TouchableOpacity
                    style={[
                      styles.submitBtn, { backgroundColor: themeColor },
                      (!applicantName.trim() || !applicantEmail.trim() || !applicantPhone.trim() || !applicantAddress.trim() || submitting)
                        && styles.submitBtnDisabled,
                    ]}
                    onPress={submit}
                    disabled={submitting || !applicantName.trim() || !applicantEmail.trim() || !applicantPhone.trim() || !applicantAddress.trim()}
                  >
                    {submitting
                      ? <ActivityIndicator color="white" />
                      : <Text style={styles.submitBtnText}>申請を送信する →</Text>
                    }
                  </TouchableOpacity>
                </View>
              )}
            </>
          )}
        </View>

        <View style={{ height: 56 }} />
      </ScrollView>

      {/* フルスクリーン lightbox */}
      {!!lightboxUri && (
        <Modal visible transparent animationType="fade" onRequestClose={() => setLightboxUri(null)}>
          <TouchableOpacity
            style={styles.lightboxOverlay} activeOpacity={1}
            onPress={() => setLightboxUri(null)}
          >
            <Image source={{ uri: lightboxUri }} style={styles.lightboxImg} resizeMode="contain" />
            <View style={styles.lightboxClose}>
              <Text style={styles.lightboxCloseTxt}>✕</Text>
            </View>
          </TouchableOpacity>
        </Modal>
      )}
    </>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F2F5F4' },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 14, backgroundColor: '#F2F5F4' },
  notFoundEmoji: { fontSize: 56 },
  notFoundText: { fontSize: 15, color: '#2D4A47', fontWeight: '600' },
  notFoundBtn: { backgroundColor: '#4FA3A0', paddingHorizontal: 20, paddingVertical: 10, borderRadius: 999 },
  notFoundBtnText: { color: 'white', fontWeight: '700', fontSize: 14 },

  // ── ヒーロー ──
  heroGradient: {
    position: 'absolute', bottom: 0, left: 0, right: 0,
    paddingHorizontal: 20, paddingTop: 70, paddingBottom: 44,
  },
  heroPlaceholder: { alignItems: 'center', justifyContent: 'center', gap: 14 },
  heroEmojiWrap: {
    width: 104, height: 104, borderRadius: 34,
    backgroundColor: 'rgba(255,255,255,0.25)',
    alignItems: 'center', justifyContent: 'center',
    borderWidth: 2, borderColor: 'rgba(255,255,255,0.4)',
  },
  heroEmoji: { fontSize: 58 },
  heroName: {
    fontSize: 30, fontWeight: '900', color: 'white',
    textShadowColor: 'rgba(0,0,0,0.55)', textShadowOffset: { width: 0, height: 1 }, textShadowRadius: 6,
  },
  heroBreed: { fontSize: 14, color: 'rgba(255,255,255,0.85)', marginTop: 3, fontWeight: '500' },
  dotsWrap: {
    position: 'absolute', bottom: 14, left: 0, right: 0,
    flexDirection: 'row', justifyContent: 'center', gap: 5,
  },
  dot: { width: 6, height: 6, borderRadius: 3, backgroundColor: 'rgba(255,255,255,0.45)' },
  dotActive: { backgroundColor: 'white', width: 22, borderRadius: 3 },

  // 戻るボタン
  backBtn: {
    position: 'absolute', top: 52, left: 16, zIndex: 20,
    width: 42, height: 42, borderRadius: 21,
    backgroundColor: 'rgba(0,0,0,0.35)',
    alignItems: 'center', justifyContent: 'center',
  },
  backBtnText: { color: 'white', fontSize: 30, fontWeight: '300', lineHeight: 36, marginLeft: -2 },

  // お気に入りボタン（ハート）
  favBtn: {
    position: 'absolute', top: 52, right: 16, zIndex: 20,
    width: 48, height: 48, borderRadius: 24,
    backgroundColor: 'rgba(255,255,255,0.22)',
    alignItems: 'center', justifyContent: 'center',
    borderWidth: 1.5, borderColor: 'rgba(255,255,255,0.45)',
    shadowColor: '#000', shadowOffset: { width: 0, height: 3 }, shadowOpacity: 0.22, shadowRadius: 8, elevation: 5,
  },
  favBtnActive: { backgroundColor: '#F08080', borderColor: '#F08080' },
  favBtnText: { fontSize: 24, color: 'rgba(255,255,255,0.85)' },
  favBtnTextActive: { color: 'white' },

  // シェアボタン
  shareBtn: {
    position: 'absolute', top: 108, right: 16, zIndex: 20,
    width: 48, height: 48, borderRadius: 24,
    backgroundColor: 'rgba(255,255,255,0.22)',
    alignItems: 'center', justifyContent: 'center',
    borderWidth: 1.5, borderColor: 'rgba(255,255,255,0.45)',
    shadowColor: '#000', shadowOffset: { width: 0, height: 3 }, shadowOpacity: 0.22, shadowRadius: 8, elevation: 5,
  },

  // 通報ボタン
  reportBtn: {
    position: 'absolute', top: 164, right: 16, zIndex: 20,
    height: 30, paddingHorizontal: 10, borderRadius: 15,
    backgroundColor: 'rgba(255,255,255,0.18)',
    alignItems: 'center', justifyContent: 'center',
    borderWidth: 1.5, borderColor: 'rgba(255,255,255,0.35)',
  },
  reportBtnText: { fontSize: 11, color: 'rgba(255,255,255,0.8)', fontWeight: '600' },

  // ── 名前カード（ヒーローに重ねて浮かせる） ──
  nameCard: {
    backgroundColor: 'white',
    marginHorizontal: 14, marginTop: -22,
    borderRadius: 26, padding: 20,
    shadowColor: '#2D4A47', shadowOffset: { width: 0, height: 6 }, shadowOpacity: 0.12, shadowRadius: 16, elevation: 6,
    zIndex: 10,
  },
  animalName: { fontSize: 28, fontWeight: '900', color: '#111', marginBottom: 10 },
  badgeRow: { flexDirection: 'row', gap: 6, flexWrap: 'wrap', marginBottom: 12 },
  badge: { paddingHorizontal: 12, paddingVertical: 5, borderRadius: 999 },
  badgeText: { fontSize: 12, fontWeight: '700' },

  // 処分/掲載期限バッジ
  deadlineBadge: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    backgroundColor: '#F0FAF8', borderRadius: 16, padding: 12,
    borderWidth: 1, borderColor: '#A8D8CF',
  },
  deadlineBadgeUrgent: { backgroundColor: '#FFF1F1', borderColor: '#FECACA' },
  deadlineBadgeIcon: { fontSize: 22 },
  deadlineBadgeLabel: {
    fontSize: 10, fontWeight: '700', color: '#4FA3A0', letterSpacing: 0.3, marginBottom: 2,
  },
  deadlineBadgeDate: { fontSize: 15, fontWeight: '700', color: '#1a1a1a' },
  deadlineUrgentPill: {
    backgroundColor: '#FEE2E2', paddingHorizontal: 9, paddingVertical: 5,
    borderRadius: 999, alignSelf: 'center',
  },
  deadlineUrgentPillTxt: { fontSize: 10, color: '#B91C1C', fontWeight: '700' },

  // ── セクション共通 ──
  section: {
    backgroundColor: 'white', marginHorizontal: 14, marginTop: 14,
    borderRadius: 22, padding: 18,
    shadowColor: '#2D4A47', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.06, shadowRadius: 10, elevation: 2,
  },
  sectionHeader: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 14 },
  sectionAccent: { width: 4, height: 18, borderRadius: 2 },
  sectionTitle: { fontSize: 13, fontWeight: '800', color: '#1a1a1a', letterSpacing: 0.3 },

  // 基本情報グリッド
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  gridItem: {
    flex: 1, minWidth: '44%', backgroundColor: '#F0FAF8',
    borderRadius: 14, padding: 12, alignItems: 'center', gap: 4,
  },
  gridIcon: { fontSize: 22 },
  gridLabel: { fontSize: 10, color: '#999', fontWeight: '600', letterSpacing: 0.3 },
  gridValue: { fontSize: 14, color: '#1a1a1a', fontWeight: '700', textAlign: 'center' },

  // ── 保健所カード ──
  shelterCard: {
    marginHorizontal: 14, marginTop: 14,
    borderRadius: 22, overflow: 'hidden',
    shadowColor: '#2D4A47', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.08, shadowRadius: 10, elevation: 2,
  },
  shelterCardInner: { flexDirection: 'row', alignItems: 'center', gap: 14, padding: 18 },
  shelterIconWrap: { width: 54, height: 54, borderRadius: 27, alignItems: 'center', justifyContent: 'center' },
  shelterIcon: { fontSize: 26 },
  shelterLabel: { fontSize: 10, fontWeight: '700', letterSpacing: 0.5, marginBottom: 3 },
  shelterName: { fontSize: 16, fontWeight: '800', color: '#1a1a1a', marginBottom: 2 },
  shelterPref: { fontSize: 12, color: '#666', fontWeight: '500' },

  // ── 説明文 ──
  descText: { fontSize: 14, color: '#444', lineHeight: 24 },

  // ── 特記事項 ──
  notesBox: {
    backgroundColor: '#FFFBF0', borderRadius: 14, padding: 14,
    borderLeftWidth: 3, borderLeftColor: '#F59E0B',
  },
  notesText: { fontSize: 13, color: '#555', lineHeight: 22 },

  // ── 申請エリア ──
  applyArea: { marginHorizontal: 14, marginTop: 20 },

  // 申請ボタン（ミントグリーン）
  applyBtn: {
    borderRadius: 20, overflow: 'hidden',
    shadowColor: '#4FA3A0', shadowOffset: { width: 0, height: 6 }, shadowOpacity: 0.38, shadowRadius: 14, elevation: 6,
  },
  applyBtnGrad: { paddingVertical: 18, alignItems: 'center', justifyContent: 'center' },
  applyBtnText: { color: 'white', fontSize: 17, fontWeight: '900', letterSpacing: 0.5 },

  // 申請フォーム
  form: {
    backgroundColor: 'white', borderRadius: 22, padding: 20, marginTop: 12,
    shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.06, shadowRadius: 10, elevation: 2,
  },
  formTitle: { fontSize: 16, fontWeight: '800', color: '#1a1a1a', marginBottom: 4 },
  formNote: { fontSize: 11, color: '#bbb', marginBottom: 16 },
  fieldLabel: { fontSize: 12, fontWeight: '700', color: '#555', marginBottom: 6, marginTop: 10 },
  input: {
    borderWidth: 1.5, borderColor: '#E5EDE8', borderRadius: 14,
    padding: 13, fontSize: 14, color: '#222', backgroundColor: '#FAFCFA',
  },
  housingRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 6 },
  housingChip: {
    paddingHorizontal: 14, paddingVertical: 8, borderRadius: 999,
    backgroundColor: '#F5F5F2', borderWidth: 1.5, borderColor: '#E5E5E0',
  },
  housingChipText: { fontSize: 13, color: '#888', fontWeight: '500' },
  textArea: { height: 96, textAlignVertical: 'top' },
  submitBtn: {
    padding: 16, borderRadius: 14,
    alignItems: 'center', marginTop: 16,
    shadowColor: '#4FA3A0', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.25, shadowRadius: 8, elevation: 3,
  },
  submitBtnDisabled: { backgroundColor: '#B0C4BE', shadowOpacity: 0 },
  submitBtnText: { color: 'white', fontSize: 15, fontWeight: '700' },

  // 送信完了
  successBox: {
    backgroundColor: 'white', borderRadius: 22, padding: 32, alignItems: 'center', gap: 8,
    shadowColor: '#2D4A47', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.07, shadowRadius: 12, elevation: 3,
  },
  successIconWrap: { width: 80, height: 80, borderRadius: 40, alignItems: 'center', justifyContent: 'center', marginBottom: 6 },
  successEmoji: { fontSize: 40 },
  successTitle: { fontSize: 19, fontWeight: '900', marginBottom: 6 },
  successNote: { fontSize: 13, color: '#888', textAlign: 'center', lineHeight: 21 },

  // ログインプロンプト
  loginPrompt: {
    backgroundColor: 'white', borderRadius: 22, padding: 28, alignItems: 'center', gap: 8,
    borderWidth: 1.5, borderColor: '#D4EEE9',
  },
  loginPromptIconWrap: { width: 66, height: 66, borderRadius: 33, alignItems: 'center', justifyContent: 'center', marginBottom: 2 },
  loginPromptEmoji: { fontSize: 30 },
  loginPromptTitle: { fontSize: 15, fontWeight: '800', color: '#2D4A47' },
  loginPromptSub: { fontSize: 13, color: '#999' },
  loginPromptBtn: {
    marginTop: 8, paddingHorizontal: 36, paddingVertical: 13, borderRadius: 999,
    shadowColor: '#4FA3A0', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.25, shadowRadius: 8, elevation: 3,
  },
  loginPromptBtnTxt: { color: 'white', fontSize: 14, fontWeight: '800' },

  // lightbox
  lightboxOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.93)', alignItems: 'center', justifyContent: 'center' },
  lightboxImg: { width: SW, height: SH * 0.82 },
  lightboxClose: {
    position: 'absolute', top: 52, right: 18,
    backgroundColor: 'rgba(255,255,255,0.15)', borderRadius: 999,
    width: 40, height: 40, alignItems: 'center', justifyContent: 'center',
  },
  lightboxCloseTxt: { color: 'white', fontSize: 16, fontWeight: '700' },
});
