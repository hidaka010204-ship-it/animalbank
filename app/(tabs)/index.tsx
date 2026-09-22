import { LinearGradient } from 'expo-linear-gradient';
import { useRouter } from 'expo-router';
import { Menu, SlidersHorizontal } from 'lucide-react-native';
import { useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator, Animated, Dimensions, Easing, Image, Modal,
  ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View,
} from 'react-native';
import { showAlert } from '../../lib/alert';
import { t } from '../../lib/i18n';
import { PREFECTURE_STATS, useApp } from '../_appContext';



const THEME_GRADIENTS: Record<string, [string, string, string]> = {
  '#4FA3A0': ['#4FA3A0', '#A8D8CF', '#C8E8E3'],
  '#A8D8CF': ['#5BB5B0', '#A8D8CF', '#D4F0EB'],
  '#F08080': ['#E05858', '#F08080', '#F5C0C0'],
  '#F97316': ['#E8620A', '#F97316', '#FDBA74'],
};

type AnimalKind = '犬' | '猫' | 'その他';
const PREFECTURES = ['全て', ...PREFECTURE_STATS.map(p => p.prefecture)];
const { width: SW } = Dimensions.get('window');

function FloatingAnimal({ emoji, style }: { emoji: string; style?: object }) {
  const anim = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    Animated.loop(
      Animated.sequence([
        Animated.timing(anim, { toValue: -10, duration: 2200, useNativeDriver: true, easing: Easing.inOut(Easing.sin) }),
        Animated.timing(anim, { toValue: 0,   duration: 2200, useNativeDriver: true, easing: Easing.inOut(Easing.sin) }),
      ])
    ).start();
  }, []);
  return <Animated.Text style={[{ transform: [{ translateY: anim }] }, style]}>{emoji}</Animated.Text>;
}

function BouncingAnimal({ emoji, style }: { emoji: string; style?: object }) {
  const anim = useRef(new Animated.Value(1)).current;
  useEffect(() => {
    Animated.loop(
      Animated.sequence([
        Animated.timing(anim, { toValue: 1.14, duration: 600, useNativeDriver: true, easing: Easing.out(Easing.quad) }),
        Animated.timing(anim, { toValue: 1,    duration: 600, useNativeDriver: true, easing: Easing.in(Easing.quad) }),
        Animated.delay(900),
      ])
    ).start();
  }, []);
  return <Animated.Text style={[{ transform: [{ scale: anim }] }, style]}>{emoji}</Animated.Text>;
}

export default function HomeScreen() {
  const router = useRouter();
  const {
    animals, loading, favorites, toggleFavorite, userProfile, session,
    nearbyPosts, nearbyPostsLoading, prefectureStats, nationalTotals,
    themeColor, language,
  } = useApp();
  const headerGrad = THEME_GRADIENTS[themeColor] ?? THEME_GRADIENTS['#4FA3A0'];

  const requireLogin = () => {
    if (!session) {
      showAlert(
        'ログインが必要です',
        'お気に入り登録にはログインが必要です',
        [
          { text: 'キャンセル', style: 'cancel' },
          { text: 'ログイン', onPress: () => router.push('/auth' as any) },
        ]
      );
      return false;
    }
    return true;
  };

  const [search, setSearch] = useState('');
  const [showFavOnly, setShowFavOnly] = useState(false);
  const [showFilter, setShowFilter] = useState(false);
  const [filterKind, setFilterKind] = useState<AnimalKind | ''>('');
  const [filterBreed, setFilterBreed] = useState('');
  const [filterShelter, setFilterShelter] = useState('');
  const [filterPrefecture, setFilterPrefecture] = useState('');
  const [showUrgentModal, setShowUrgentModal] = useState(false);
  const [selectedPost, setSelectedPost] = useState<typeof nearbyPosts[0] | null>(null);
  const [lightboxUri, setLightboxUri] = useState<string | null>(null);

  const nearbyPostsList = nearbyPosts.filter(p => {
    if (!userProfile.prefecture) return true;
    return p.locationPrefecture === userProfile.prefecture;
  });
  const showNearbySection = nearbyPostsLoading || nearbyPostsList.length > 0;

  const [selectedUrgentPref, setSelectedUrgentPref] = useState<string | null>(null);

  const nationalUrgent = nationalTotals.urgent;
  const hasFilter = filterKind || filterBreed || filterShelter || filterPrefecture;

  const resetFilters = () => { setFilterKind(''); setFilterBreed(''); setFilterShelter(''); setFilterPrefecture(''); };

  const filtered = animals.filter(a => {
    const q = search.toLowerCase();
    const matchSearch = !q || a.name.toLowerCase().includes(q) || a.breed.toLowerCase().includes(q) || a.shelter.toLowerCase().includes(q) || a.prefecture.toLowerCase().includes(q);
    const matchFav = !showFavOnly || favorites.has(a.id);
    const matchKind = !filterKind || a.animalKind === filterKind;
    const matchBreed = !filterBreed || a.breed.toLowerCase().includes(filterBreed.toLowerCase());
    const matchShelter = !filterShelter || a.shelter.toLowerCase().includes(filterShelter.toLowerCase());
    const matchPrefecture = !filterPrefecture || a.prefecture === filterPrefecture;
    return matchSearch && matchFav && matchKind && matchBreed && matchShelter && matchPrefecture;
  });

  const urgentAnimals = animals.filter(a => a.urgent);

  return (
    <View style={styles.rootView}>
      <ScrollView style={styles.container} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">

        {/* ── ヘッダー ── */}
        <LinearGradient
          colors={headerGrad}
          start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}
          style={styles.header}
        >
          {/* 背景装飾 */}
          <View style={styles.headerDecorCircle1} />
          <View style={styles.headerDecorCircle2} />

          <View style={styles.headerContent}>
            <View style={styles.headerLeft}>
              <View style={styles.headerBadge}>
                <Text style={styles.headerBadgeTxt}>{t('home_badge', language)}</Text>
              </View>
              <View style={styles.headerTitleRow}>
                <View style={styles.headerLogoWrap}>
                  <Image
                    source={require('../../assets/images/logo.png')}
                    style={styles.headerLogoImg}
                    resizeMode="contain"
                  />
                </View>
                <View>
                  <Text style={styles.headerTitle}>{t('home_title', language)}</Text>
                  <Text style={styles.headerSub}>{t('home_tagline', language)}</Text>
                </View>
              </View>
            </View>
          </View>
        </LinearGradient>

        {/* ── 全国統計 ── */}
        <View style={styles.statsSection}>
          <Text style={styles.statsHeading}>{t('stats_heading', language)}</Text>
          <View style={styles.statsRow}>
            <View style={styles.statCard}>
              <Text style={[styles.statNum, { color: '#EA580C' }]}>{animals.length.toLocaleString()}</Text>
              <Text style={styles.statLbl}>{t('stat_sheltered', language)}</Text>
            </View>
            <View style={styles.statCard}>
              <Text style={[styles.statNum, { color: '#059669' }]}>{nationalTotals.transferred.toLocaleString()}</Text>
              <Text style={styles.statLbl}>{t('stat_transferred', language)}</Text>
            </View>
            <View style={styles.statCard}>
              <Text style={[styles.statNum, { color: '#DC2626' }]}>{nationalTotals.disposed.toLocaleString()}</Text>
              <Text style={styles.statLbl}>{t('stat_disposed', language)}</Text>
            </View>
          </View>
        </View>

        {/* ── 緊急バナー ── */}
        <TouchableOpacity onPress={() => setShowUrgentModal(true)} activeOpacity={0.88} style={styles.urgentWrap}>
          <LinearGradient
            colors={['#991B1B', '#DC2626', '#F87171']}
            start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}
            style={styles.urgentBanner}
          >
            <View style={styles.urgentDecorDot} />
            <View style={styles.urgentLeft}>
              <View style={styles.urgentIconCircle}>
                <Text style={styles.urgentIconText}>🚨</Text>
              </View>
              <View>
                <Text style={styles.urgentTitle}>{t('urgent_title', language)}</Text>
                <Text style={styles.urgentSub}>{t('urgent_sub', language)}</Text>
              </View>
            </View>
            <View style={styles.urgentRight}>
              <Text style={styles.urgentCount}>{nationalUrgent}</Text>
              <Text style={styles.urgentUnit}>件</Text>
              <Text style={styles.urgentChevron}>›</Text>
            </View>
          </LinearGradient>
        </TouchableOpacity>

        {/* ── 近くの迷子・保護情報 ── */}
        {showNearbySection && (
          <View style={styles.nearbySection}>
            <Text style={styles.sectionHeading}>
              {t('nearby_heading', language)}
              {!!userProfile.prefecture && (
                <Text style={styles.nearbyAreaHint}>　{userProfile.prefecture}</Text>
              )}
            </Text>
            {nearbyPostsLoading ? (
              <ActivityIndicator color="#A8D8CF" style={{ marginVertical: 16 }} />
            ) : (
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.nearbyScroll}>
                {nearbyPostsList.map(post => (
                  <View key={post.id} style={styles.nearbyCard}>
                    {post.images && post.images.length > 0 ? (
                      <TouchableOpacity onPress={() => setLightboxUri(post.images[0])} activeOpacity={0.88}>
                        <Image source={{ uri: post.images[0] }} style={styles.nearbyImg} />
                        <View style={styles.nearbyImgOverlay}>
                          <View style={[styles.nearbyTypePill, { backgroundColor: post.type === 'lost' ? '#F08080' : '#A8D8CF' }]}>
                            <Text style={styles.nearbyTypeTxt}>{post.type === 'lost' ? '🔍 迷子' : '🤝 保護'}</Text>
                          </View>
                        </View>
                      </TouchableOpacity>
                    ) : (
                      <View style={styles.nearbyNoImg}>
                        <View style={[styles.nearbyTypePill, { backgroundColor: post.type === 'lost' ? '#F08080' : '#A8D8CF' }]}>
                          <Text style={styles.nearbyTypeTxt}>{post.type === 'lost' ? '🔍 迷子' : '🤝 保護'}</Text>
                        </View>
                      </View>
                    )}
                    <TouchableOpacity onPress={() => setSelectedPost(post)} activeOpacity={0.85} style={styles.nearbyCardBody}>
                      {!!post.location && <Text style={styles.nearbyLoc} numberOfLines={1}>📍 {post.location}</Text>}
                      {!!post.content && <Text style={styles.nearbyContent} numberOfLines={2}>{post.content}</Text>}
                    </TouchableOpacity>
                  </View>
                ))}
              </ScrollView>
            )}
          </View>
        )}

        {/* ── 検索バー ── */}
        <View style={styles.searchRow}>
          <View style={styles.searchInputWrap}>
            <Text style={styles.searchMagIcon}>🔍</Text>
            <TextInput
              style={styles.searchInput}
              placeholder="名前・犬種・保健所・地域で検索..."
              placeholderTextColor="#aaa"
              value={search}
              onChangeText={setSearch}
              clearButtonMode="while-editing"
            />
          </View>
          <TouchableOpacity style={[styles.sqBtn, showFilter && styles.sqBtnGreen]} onPress={() => setShowFilter(!showFilter)}>
            {hasFilter
              ? <SlidersHorizontal size={20} color="#2D4A47" />
              : <Menu size={20} color="#666" />}
          </TouchableOpacity>
          <TouchableOpacity style={[styles.sqBtn, showFavOnly && styles.sqBtnRed]} onPress={() => setShowFavOnly(!showFavOnly)}>
            <Text style={styles.sqBtnTxt}>{showFavOnly ? '❤️' : '🤍'}</Text>
          </TouchableOpacity>
        </View>

        {/* ── フィルターパネル ── */}
        {showFilter && (
          <View style={styles.filterPanel}>
            <View style={styles.filterPanelHead}>
              <Text style={styles.filterPanelTitle}>🔎 絞り込み検索</Text>
              {hasFilter && (
                <TouchableOpacity onPress={resetFilters}>
                  <Text style={styles.filterResetTxt}>リセット</Text>
                </TouchableOpacity>
              )}
            </View>

            <Text style={styles.filterLbl}>種類</Text>
            <View style={styles.kindRow}>
              {(['', '犬', '猫', 'その他'] as (AnimalKind | '')[]).map(k => (
                <TouchableOpacity key={k} style={[styles.kindChip, filterKind === k && styles.kindChipActive]} onPress={() => setFilterKind(k)}>
                  <Text style={[styles.kindChipTxt, filterKind === k && styles.kindChipTxtActive]}>
                    {k === '' ? 'すべて' : k === '犬' ? '🐕 犬' : k === '猫' ? '🐈 猫' : '🐾 その他'}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            <Text style={styles.filterLbl}>犬種・猫種</Text>
            <TextInput style={styles.filterInput} placeholder="例：柴犬、トイプードル..." placeholderTextColor="#bbb" value={filterBreed} onChangeText={setFilterBreed} clearButtonMode="while-editing" />

            <Text style={styles.filterLbl}>保健所名</Text>
            <TextInput style={styles.filterInput} placeholder="例：中津川市、春日井市..." placeholderTextColor="#bbb" value={filterShelter} onChangeText={setFilterShelter} clearButtonMode="while-editing" />

            <Text style={styles.filterLbl}>都道府県</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.prefScroll}>
              {PREFECTURES.map(p => (
                <TouchableOpacity key={p}
                  style={[styles.prefChip, filterPrefecture === (p === '全て' ? '' : p) && styles.prefChipActive]}
                  onPress={() => setFilterPrefecture(p === '全て' ? '' : p)}>
                  <Text style={[styles.prefChipTxt, filterPrefecture === (p === '全て' ? '' : p) && styles.prefChipTxtActive]}>{p}</Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
          </View>
        )}

        {/* ── 結果ヘッダー ── */}
        <View style={styles.resultRow}>
          <Text style={styles.resultTitle}>
            {showFavOnly ? t('result_fav', language) : filterPrefecture ? `🐾 ${filterPrefecture}${language === 'ja' ? 'の子たち' : ' Animals'}` : t('result_all', language)}
          </Text>
          <View style={styles.resultCountPill}>
            <Text style={styles.resultCountTxt}>{filtered.length}件</Text>
          </View>
          {hasFilter && <View style={styles.filterActivePill}><Text style={styles.filterActiveTxt}>{t('filter_active', language)}</Text></View>}
        </View>

        {/* ── ロード/空状態 ── */}
        {loading ? (
          <View style={styles.empty}>
            <ActivityIndicator size="large" color="#A8D8CF" />
            <Text style={[styles.emptyTxt, { marginTop: 14 }]}>{t('loading', language)}</Text>
          </View>
        ) : filtered.length === 0 && (
          <View style={styles.empty}>
            <BouncingAnimal emoji="🐾" style={styles.emptyEmoji} />
            <Text style={styles.emptyTxt}>
              {showFavOnly ? t('no_fav', language) : t('no_results', language)}
            </Text>
          </View>
        )}

        {/* ── 動物カード ── */}
        {filtered.map(animal => (
          <TouchableOpacity
            key={animal.id}
            style={[styles.card, animal.urgent && styles.cardUrgent]}
            onPress={() => router.push(`/animal/${animal.id}` as any)}
            activeOpacity={0.76}
          >
            {animal.urgent && <View style={styles.urgentBar} />}
            <View style={styles.cardPhotoCol}>
              {animal.images[0] ? (
                <Image source={{ uri: animal.images[0] }} style={styles.cardPhoto} />
              ) : (
                <View style={[styles.cardPhotoEmpty, {
                  backgroundColor: animal.animalKind === '猫' ? '#EDE9FE' : animal.animalKind === '犬' ? '#D4EEE9' : '#F5EDD8',
                }]}>
                  <Text style={styles.cardEmoji}>{animal.emoji}</Text>
                </View>
              )}
              <View style={[styles.statusBadge, { backgroundColor: animal.statusBg }]}>
                <Text style={[styles.statusBadgeTxt, { color: animal.statusColor }]}>{animal.status}</Text>
              </View>
            </View>

            <View style={styles.cardBody}>
              <Text style={styles.cardName}>{animal.name}</Text>
              {!!animal.breed && <Text style={styles.cardBreed}>{animal.breed}</Text>}
              {!!(animal.age || animal.weight) && (
                <Text style={styles.cardMeta}>{[animal.age, animal.weight].filter(Boolean).join(' · ')}</Text>
              )}
              {!!(animal.prefecture || animal.shelter) && (
                <Text style={styles.cardLocation} numberOfLines={1}>
                  📍 {[animal.prefecture, animal.shelter].filter(Boolean).join('  ')}
                </Text>
              )}
              <View style={styles.pillRow}>
                {animal.urgent && <View style={styles.pillRed}><Text style={styles.pillRedTxt}>🚨 緊急</Text></View>}
                {animal.animalKind !== 'その他' && (
                  <View style={styles.pillGray}>
                    <Text style={styles.pillGrayTxt}>{animal.animalKind === '犬' ? '🐕 犬' : '🐈 猫'}</Text>
                  </View>
                )}
              </View>
              {!!animal.deadline && <Text style={styles.deadlineTxt}>{animal.deadline}</Text>}
            </View>

            <View style={styles.cardRight}>
              <TouchableOpacity
                style={styles.heartBtn}
                onPress={e => { e.stopPropagation?.(); if (requireLogin()) toggleFavorite(animal.id); }}
                hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
              >
                <Text style={styles.heartTxt}>{favorites.has(animal.id) ? '❤️' : '🤍'}</Text>
              </TouchableOpacity>
              <Text style={styles.cardArrow}>›</Text>
            </View>
          </TouchableOpacity>
        ))}

        <View style={{ height: 36 }} />
      </ScrollView>

      {/* ── 近くの投稿詳細モーダル ── */}
      <Modal visible={!!selectedPost} animationType="slide" presentationStyle="pageSheet" onRequestClose={() => setSelectedPost(null)}>
        <View style={styles.modalWrap}>
          <LinearGradient
            colors={selectedPost?.type === 'lost' ? ['#E05858', '#F08080'] : ['#3D8B85', '#A8D8CF']}
            style={styles.modalHeader}
          >
            <Text style={styles.modalTitle}>{selectedPost?.type === 'lost' ? '🔍 迷子情報' : '🤝 保護情報'}</Text>
            <TouchableOpacity onPress={() => setSelectedPost(null)} style={styles.modalCloseBtn}>
              <Text style={styles.modalCloseTxt}>✕</Text>
            </TouchableOpacity>
          </LinearGradient>
          <ScrollView style={styles.modalBody} contentContainerStyle={{ paddingBottom: 48 }}>
            {selectedPost?.images && selectedPost.images.length > 0 && (
              <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 18 }}>
                {selectedPost.images.map((uri, i) => (
                  <TouchableOpacity key={i} onPress={() => setLightboxUri(uri)} activeOpacity={0.88}>
                    <Image source={{ uri }} style={styles.modalPostImg} />
                  </TouchableOpacity>
                ))}
              </ScrollView>
            )}
            {!!selectedPost?.location && <Text style={styles.modalLocTxt}>📍 {selectedPost.location}</Text>}
            {!!selectedPost?.content && <Text style={styles.modalContentTxt}>{selectedPost.content}</Text>}
          </ScrollView>
        </View>
      </Modal>

      {/* ── 全国緊急対象モーダル ── */}
      <Modal
        visible={showUrgentModal}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => { setShowUrgentModal(false); setSelectedUrgentPref(null); }}
      >
        <View style={styles.modalWrap}>
          <LinearGradient colors={['#7F1D1D', '#B91C1C', '#DC2626']} style={styles.modalHeader}>
            <View style={{ flex: 1 }}>
              <Text style={styles.modalTitle}>🚨 緊急対象の動物</Text>
              <Text style={styles.modalSub}>
                {selectedUrgentPref ? `${selectedUrgentPref} の緊急対象` : '処分期限が迫っています。引き取りをご検討ください'}
              </Text>
            </View>
            <TouchableOpacity style={styles.modalCloseBtn} onPress={() => { setShowUrgentModal(false); setSelectedUrgentPref(null); }}>
              <Text style={styles.modalCloseTxt}>✕</Text>
            </TouchableOpacity>
          </LinearGradient>

          <View style={styles.urgentPrefRow}>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: 14, paddingVertical: 12, gap: 8 }}>
              <TouchableOpacity
                style={[styles.urgentPrefChip, selectedUrgentPref === null && styles.urgentPrefChipSel]}
                onPress={() => setSelectedUrgentPref(null)}
              >
                <Text style={[styles.urgentPrefName, selectedUrgentPref === null && styles.urgentPrefNameSel]}>全て</Text>
                <Text style={[styles.urgentPrefCnt, selectedUrgentPref === null && styles.urgentPrefCntSel]}>{nationalTotals.urgent}件</Text>
              </TouchableOpacity>
              {prefectureStats.filter(p => p.urgent > 0).map(p => {
                const isSel = selectedUrgentPref === p.prefecture;
                return (
                  <TouchableOpacity key={p.prefecture}
                    style={[styles.urgentPrefChip, isSel && styles.urgentPrefChipSel]}
                    onPress={() => setSelectedUrgentPref(isSel ? null : p.prefecture)}
                  >
                    <Text style={[styles.urgentPrefName, isSel && styles.urgentPrefNameSel]}>{p.prefecture}</Text>
                    <Text style={[styles.urgentPrefCnt, isSel && styles.urgentPrefCntSel]}>{p.urgent}件</Text>
                  </TouchableOpacity>
                );
              })}
            </ScrollView>
          </View>

          <ScrollView style={styles.modalList}>
            {(() => {
              const prefStat = selectedUrgentPref ? prefectureStats.find(p => p.prefecture === selectedUrgentPref) : null;
              const displayAnimals = selectedUrgentPref ? urgentAnimals.filter(a => a.prefecture === selectedUrgentPref) : urgentAnimals;
              return (
                <>
                  {prefStat && (
                    <View style={styles.prefStatBar}>
                      {[
                        { num: prefStat.urgent,      lbl: '緊急件数',  color: '#DC2626' },
                        { num: prefStat.collected,   lbl: '収容中',    color: '#4FA3A0' },
                        { num: prefStat.pending,     lbl: '申請中',    color: '#185FA5' },
                        { num: prefStat.transferred, lbl: '譲渡済み',  color: '#7C3AED' },
                      ].map((item, i, arr) => (
                        <View key={item.lbl} style={{ flex: 1, flexDirection: 'row' }}>
                          <View style={styles.prefStatItem}>
                            <Text style={[styles.prefStatNum, { color: item.color }]}>{item.num}</Text>
                            <Text style={styles.prefStatLbl}>{item.lbl}</Text>
                          </View>
                          {i < arr.length - 1 && <View style={styles.prefStatDiv} />}
                        </View>
                      ))}
                    </View>
                  )}

                  <Text style={styles.modalListLbl}>
                    {selectedUrgentPref ? `${selectedUrgentPref}の登録動物` : '登録中の緊急動物'}（{displayAnimals.length}件）
                  </Text>

                  {displayAnimals.length === 0 ? (
                    <View style={styles.modalEmpty}>
                      <Text style={styles.modalEmptyEmoji}>🐾</Text>
                      <Text style={styles.modalEmptyTxt}>
                        {selectedUrgentPref
                          ? `${selectedUrgentPref}の登録動物はまだありません\n（全体で${prefStat?.urgent ?? 0}件の緊急対象が確認されています）`
                          : '現在登録中の緊急動物はいません'}
                      </Text>
                    </View>
                  ) : displayAnimals.map(animal => (
                    <TouchableOpacity
                      key={animal.id}
                      style={styles.urgentCard}
                      onPress={() => { setShowUrgentModal(false); setSelectedUrgentPref(null); router.push(`/animal/${animal.id}` as any); }}
                      activeOpacity={0.8}
                    >
                      <View style={styles.urgentCardLeft}>
                        <View style={styles.urgentAnimalBubble}>
                          {animal.images[0]
                            ? <Image source={{ uri: animal.images[0] }} style={styles.urgentAnimalImg} />
                            : <Text style={styles.urgentAnimalEmoji}>{animal.emoji}</Text>}
                        </View>
                        <View style={{ flex: 1 }}>
                          <Text style={styles.urgentCardName}>{animal.name}</Text>
                          <Text style={styles.urgentCardBreed}>{animal.breed} · {animal.age}</Text>
                          <Text style={styles.urgentCardShelter} numberOfLines={1}>
                            📍 {[animal.prefecture, animal.shelter].filter(Boolean).join('  ')}
                          </Text>
                          {!!animal.deadline && <Text style={styles.urgentCardDeadline}>{animal.deadline}</Text>}
                        </View>
                      </View>
                      <Text style={styles.urgentCardArrow}>›</Text>
                    </TouchableOpacity>
                  ))}

                  <View style={styles.urgentInfoBox}>
                    <Text style={styles.urgentInfoTitle}>📊 全国の緊急対象</Text>
                    <Text style={styles.urgentInfoBody}>
                      全国 {nationalTotals.urgent} 件の動物が処分期限を迫られています。{'\n'}
                      引き取り・一時預かり・里親のご協力をお願いします。
                    </Text>
                  </View>
                  <View style={{ height: 48 }} />
                </>
              );
            })()}
          </ScrollView>
        </View>
      </Modal>

      {/* ── フルスクリーン lightbox ── */}
      <Modal visible={!!lightboxUri} transparent animationType="fade" onRequestClose={() => setLightboxUri(null)}>
        <TouchableOpacity style={styles.lightboxOverlay} activeOpacity={1} onPress={() => setLightboxUri(null)}>
          <Image source={{ uri: lightboxUri ?? '' }} style={styles.lightboxImg} resizeMode="contain" />
          <View style={styles.lightboxCloseBtn}>
            <Text style={styles.lightboxCloseTxt}>✕</Text>
          </View>
        </TouchableOpacity>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  rootView: { flex: 1 },
  container: { flex: 1, backgroundColor: '#F2F5F4' },

  // ── ヘッダー ──
  header: {
    paddingTop: 60, paddingBottom: 28, paddingHorizontal: 22,
    overflow: 'hidden',
  },
  headerDecorCircle1: {
    position: 'absolute', width: 200, height: 200, borderRadius: 100,
    backgroundColor: 'rgba(255,255,255,0.06)', top: -60, right: -40,
  },
  headerDecorCircle2: {
    position: 'absolute', width: 130, height: 130, borderRadius: 65,
    backgroundColor: 'rgba(255,255,255,0.08)', bottom: -30, right: 100,
  },
  headerContent: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  headerLeft: { flex: 1 },
  headerBadge: {
    alignSelf: 'flex-start', backgroundColor: 'rgba(255,255,255,0.2)',
    paddingHorizontal: 10, paddingVertical: 4, borderRadius: 999, marginBottom: 8,
  },
  headerBadgeTxt: { fontSize: 11, color: 'rgba(255,255,255,0.9)', fontWeight: '600' },
  headerTitleRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  headerLogoWrap: { width: 50, height: 50, borderRadius: 12, overflow: 'hidden', alignItems: 'center', justifyContent: 'center' },
  headerLogoImg: { width: 50, height: 50 },
  headerLogoEmoji: { fontSize: 34 },
  headerTitle: { fontSize: 32, fontWeight: '900', color: 'white', letterSpacing: 0.5 },
  headerSub: { fontSize: 13, color: 'rgba(255,255,255,0.78)', fontWeight: '500', textAlign: 'right', marginTop: 2 },

  // ── 全国統計 ──
  statsSection: { paddingHorizontal: 16, paddingTop: 18, paddingBottom: 4 },
  statsHeading: { fontSize: 12, fontWeight: '800', color: '#666', marginBottom: 10, letterSpacing: 0.8 },
  statsRow: { flexDirection: 'row', gap: 10 },
  statCard: {
    flex: 1, borderRadius: 20, paddingVertical: 16, paddingHorizontal: 8, alignItems: 'center',
    backgroundColor: 'white',
    shadowColor: '#000', shadowOffset: { width: 0, height: 3 }, shadowOpacity: 0.08, shadowRadius: 10, elevation: 3,
  },
  statNum: { fontSize: 28, fontWeight: '900' },
  statLbl: { fontSize: 10, color: '#999', marginTop: 4, fontWeight: '600' },

  // ── 緊急バナー ──
  urgentWrap: { marginHorizontal: 16, marginTop: 14 },
  urgentBanner: {
    borderRadius: 22, paddingVertical: 18, paddingHorizontal: 20,
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    overflow: 'hidden',
    shadowColor: '#DC2626', shadowOffset: { width: 0, height: 6 }, shadowOpacity: 0.25, shadowRadius: 14, elevation: 6,
  },
  urgentDecorDot: {
    position: 'absolute', width: 160, height: 160, borderRadius: 80,
    backgroundColor: 'rgba(255,255,255,0.06)', right: -40, top: -50,
  },
  urgentLeft: { flexDirection: 'row', alignItems: 'center', gap: 14, flex: 1 },
  urgentIconCircle: { width: 44, height: 44, borderRadius: 22, backgroundColor: 'rgba(255,255,255,0.22)', alignItems: 'center', justifyContent: 'center' },
  urgentIconText: { fontSize: 22 },
  urgentTitle: { fontSize: 15, fontWeight: '800', color: 'white' },
  urgentSub: { fontSize: 11, color: 'rgba(255,255,255,0.8)', marginTop: 2 },
  urgentRight: { flexDirection: 'row', alignItems: 'baseline', gap: 2 },
  urgentCount: { fontSize: 40, fontWeight: '900', color: 'white' },
  urgentUnit: { fontSize: 13, fontWeight: '700', color: 'rgba(255,255,255,0.85)' },
  urgentChevron: { fontSize: 28, color: 'rgba(255,255,255,0.7)', marginLeft: 4 },

  // ── 近くの迷子・保護情報 ──
  nearbySection: { marginTop: 20, paddingLeft: 16 },
  sectionHeading: { fontSize: 14, fontWeight: '800', color: '#333', marginBottom: 12 },
  nearbyAreaHint: { fontSize: 11, fontWeight: '500', color: '#A8D8CF' },
  nearbyScroll: { gap: 12, paddingRight: 16 },
  nearbyCard: {
    width: 210, backgroundColor: 'white', borderRadius: 20, overflow: 'hidden',
    shadowColor: '#000', shadowOffset: { width: 0, height: 3 }, shadowOpacity: 0.08, shadowRadius: 10, elevation: 3,
  },
  nearbyImg: { width: '100%', height: 126, resizeMode: 'cover' },
  nearbyImgOverlay: { position: 'absolute', top: 8, left: 8 },
  nearbyTypePill: { paddingHorizontal: 10, paddingVertical: 5, borderRadius: 999 },
  nearbyTypeTxt: { fontSize: 11, fontWeight: '700', color: 'white' },
  nearbyNoImg: { height: 52, backgroundColor: '#E8F5F3', alignItems: 'flex-start', justifyContent: 'center', paddingHorizontal: 10 },
  nearbyCardBody: { padding: 10 },
  nearbyLoc: { fontSize: 11, color: '#888', marginBottom: 5 },
  nearbyContent: { fontSize: 13, color: '#333', lineHeight: 18 },

  // ── 検索バー ──
  searchRow: { flexDirection: 'row', gap: 8, paddingHorizontal: 16, marginTop: 20, marginBottom: 12 },
  searchInputWrap: {
    flex: 1, flexDirection: 'row', alignItems: 'center', backgroundColor: 'white',
    borderRadius: 16, paddingHorizontal: 12, gap: 6,
    shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.06, shadowRadius: 8, elevation: 2,
  },
  searchMagIcon: { fontSize: 16 },
  searchInput: { flex: 1, paddingVertical: 12, fontSize: 14, color: '#222' },
  sqBtn: {
    width: 46, height: 46, backgroundColor: 'white', borderRadius: 14,
    alignItems: 'center', justifyContent: 'center',
    shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.06, shadowRadius: 8, elevation: 2,
  },
  sqBtnGreen: { backgroundColor: '#D4EEE9' },
  sqBtnRed: { backgroundColor: '#FEE2E2' },
  sqBtnTxt: { fontSize: 18 },

  // ── フィルターパネル ──
  filterPanel: {
    backgroundColor: 'white', marginHorizontal: 16, marginBottom: 14, borderRadius: 22, padding: 18,
    shadowColor: '#000', shadowOffset: { width: 0, height: 3 }, shadowOpacity: 0.08, shadowRadius: 12, elevation: 4,
  },
  filterPanelHead: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 },
  filterPanelTitle: { fontSize: 14, fontWeight: '800', color: '#1a1a1a' },
  filterResetTxt: { fontSize: 12, color: '#F08080', fontWeight: '700' },
  filterLbl: { fontSize: 11, fontWeight: '700', color: '#999', marginBottom: 8, marginTop: 10, letterSpacing: 0.5 },
  filterInput: { borderWidth: 1, borderColor: '#E5E7EB', borderRadius: 12, paddingHorizontal: 13, paddingVertical: 10, fontSize: 14, color: '#333', marginBottom: 4, backgroundColor: '#FAFAF8' },
  kindRow: { flexDirection: 'row', gap: 8, marginBottom: 4, flexWrap: 'wrap' },
  kindChip: { paddingHorizontal: 14, paddingVertical: 8, borderRadius: 999, borderWidth: 1, borderColor: '#E5E7EB', backgroundColor: '#F9FAFB' },
  kindChipActive: { backgroundColor: '#FFE4E4', borderColor: '#F08080' },
  kindChipTxt: { fontSize: 12, color: '#888' },
  kindChipTxtActive: { color: '#2D4A47', fontWeight: '700' },
  prefScroll: { marginBottom: 4 },
  prefChip: { paddingHorizontal: 14, paddingVertical: 8, borderRadius: 999, borderWidth: 1, borderColor: '#E5E7EB', backgroundColor: '#F9FAFB', marginRight: 8 },
  prefChipActive: { backgroundColor: '#FFE4E4', borderColor: '#F08080' },
  prefChipTxt: { fontSize: 12, color: '#888' },
  prefChipTxtActive: { color: '#2D4A47', fontWeight: '700' },

  // ── 結果ヘッダー ──
  resultRow: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 16, marginBottom: 12 },
  resultTitle: { fontSize: 14, fontWeight: '800', color: '#333' },
  resultCountPill: { backgroundColor: '#D4EEE9', paddingHorizontal: 9, paddingVertical: 4, borderRadius: 999 },
  resultCountTxt: { fontSize: 11, color: '#2D4A47', fontWeight: '700' },
  filterActivePill: { backgroundColor: '#FEF3C7', paddingHorizontal: 9, paddingVertical: 4, borderRadius: 999 },
  filterActiveTxt: { fontSize: 10, color: '#92400E', fontWeight: '700' },

  // ── 空状態 ──
  empty: { alignItems: 'center', padding: 52, gap: 14 },
  emptyEmoji: { fontSize: 56 },
  emptyTxt: { fontSize: 14, color: '#bbb', fontWeight: '500' },

  // ── 動物カード ──
  card: {
    backgroundColor: 'white', marginHorizontal: 16, marginBottom: 12, borderRadius: 24,
    flexDirection: 'row', alignItems: 'flex-start', overflow: 'hidden',
    shadowColor: '#000', shadowOffset: { width: 0, height: 3 }, shadowOpacity: 0.08, shadowRadius: 14, elevation: 4,
  },
  cardUrgent: { shadowColor: '#DC2626', shadowOpacity: 0.15 },
  urgentBar: { position: 'absolute', top: 0, left: 0, right: 0, height: 3, backgroundColor: '#DC2626', zIndex: 1 },
  cardPhotoCol: { position: 'relative', flexShrink: 0 },
  cardPhoto: { width: 86, height: 112, borderTopLeftRadius: 24, borderBottomLeftRadius: 24, resizeMode: 'cover' },
  cardPhotoEmpty: {
    width: 86, height: 112, borderTopLeftRadius: 24, borderBottomLeftRadius: 24,
    alignItems: 'center', justifyContent: 'center',
  },
  cardEmoji: { fontSize: 38 },
  statusBadge: {
    position: 'absolute', bottom: 8, left: 6,
    paddingHorizontal: 7, paddingVertical: 3, borderRadius: 999,
  },
  statusBadgeTxt: { fontSize: 9, fontWeight: '800' },
  cardBody: { flex: 1, paddingTop: 14, paddingBottom: 12, paddingHorizontal: 12 },
  cardName: { fontSize: 17, fontWeight: '800', color: '#111', marginBottom: 2 },
  cardBreed: { fontSize: 12, color: '#666', marginBottom: 2 },
  cardMeta: { fontSize: 12, color: '#999', marginBottom: 4 },
  cardShelter: { fontSize: 11, color: '#bbb', marginBottom: 8 },
  cardLocation: { fontSize: 12, color: '#555', marginBottom: 7, fontWeight: '500' },
  pillRow: { flexDirection: 'row', gap: 5, flexWrap: 'wrap' },
  pillRed: { backgroundColor: '#FEE2E2', paddingHorizontal: 8, paddingVertical: 3, borderRadius: 999 },
  pillRedTxt: { fontSize: 10, color: '#DC2626', fontWeight: '700' },
  pillBlue: { backgroundColor: '#DBEAFE', paddingHorizontal: 8, paddingVertical: 3, borderRadius: 999 },
  pillBlueTxt: { fontSize: 10, color: '#1D4ED8' },
  pillGray: { backgroundColor: '#F3F4F6', paddingHorizontal: 8, paddingVertical: 3, borderRadius: 999 },
  pillGrayTxt: { fontSize: 10, color: '#6B7280' },
  deadlineTxt: { fontSize: 11, color: '#DC2626', marginTop: 6, fontWeight: '700' },
  cardRight: { paddingTop: 12, paddingRight: 12, alignItems: 'center', gap: 12 },
  heartBtn: { padding: 2 },
  heartTxt: { fontSize: 24 },
  cardArrow: { fontSize: 22, color: '#D1D5DB', fontWeight: '300' },

  // ── モーダル共通 ──
  modalWrap: { flex: 1, backgroundColor: '#C8E8E3' },
  modalHeader: { paddingTop: 58, paddingBottom: 20, paddingHorizontal: 22, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' },
  modalTitle: { fontSize: 20, fontWeight: '900', color: 'white' },
  modalSub: { fontSize: 12, color: 'rgba(255,255,255,0.8)', marginTop: 4, maxWidth: 260 },
  modalCloseBtn: { backgroundColor: 'rgba(255,255,255,0.22)', width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center' },
  modalCloseTxt: { color: 'white', fontSize: 16, fontWeight: '700' },
  modalBody: { flex: 1, padding: 20 },
  modalPostImg: { width: 280, height: 210, borderRadius: 16, marginRight: 12, resizeMode: 'cover' },
  modalLocTxt: { fontSize: 13, color: '#888', marginBottom: 12 },
  modalContentTxt: { fontSize: 15, color: '#333', lineHeight: 24 },

  // ── 緊急モーダル内 ──
  urgentPrefRow: { backgroundColor: 'white', borderBottomWidth: 0.5, borderBottomColor: '#E5E7EB' },
  urgentPrefChip: { backgroundColor: '#FEE2E2', borderRadius: 14, paddingHorizontal: 14, paddingVertical: 9, alignItems: 'center', borderWidth: 1.5, borderColor: '#FECACA' },
  urgentPrefChipSel: { backgroundColor: '#DC2626', borderColor: '#DC2626' },
  urgentPrefName: { fontSize: 11, color: '#DC2626', fontWeight: '600' },
  urgentPrefNameSel: { color: 'white' },
  urgentPrefCnt: { fontSize: 15, color: '#DC2626', fontWeight: '900', marginTop: 1 },
  urgentPrefCntSel: { color: 'white' },
  prefStatBar: { flexDirection: 'row', backgroundColor: 'white', paddingVertical: 14, borderBottomWidth: 0.5, borderBottomColor: '#E5E7EB' },
  prefStatItem: { flex: 1, alignItems: 'center' },
  prefStatNum: { fontSize: 20, fontWeight: '900' },
  prefStatLbl: { fontSize: 10, color: '#aaa', marginTop: 3 },
  prefStatDiv: { width: 0.5, backgroundColor: '#E5E7EB' },
  modalList: { flex: 1 },
  modalListLbl: { fontSize: 11, fontWeight: '700', color: '#999', paddingHorizontal: 16, paddingTop: 16, paddingBottom: 10, letterSpacing: 0.8 },
  modalEmpty: { padding: 44, alignItems: 'center', gap: 10 },
  modalEmptyEmoji: { fontSize: 48 },
  modalEmptyTxt: { fontSize: 13, color: '#bbb', textAlign: 'center', lineHeight: 21 },
  urgentCard: {
    backgroundColor: 'white', marginHorizontal: 14, marginBottom: 10, borderRadius: 20,
    padding: 14, flexDirection: 'row', alignItems: 'center',
    borderLeftWidth: 4, borderLeftColor: '#DC2626',
    shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.07, shadowRadius: 8, elevation: 2,
  },
  urgentCardLeft: { flex: 1, flexDirection: 'row', gap: 12, alignItems: 'center' },
  urgentAnimalBubble: { width: 56, height: 56, borderRadius: 18, backgroundColor: '#FFE4E4', alignItems: 'center', justifyContent: 'center', overflow: 'hidden' },
  urgentAnimalEmoji: { fontSize: 28 },
  urgentAnimalImg: { width: 56, height: 56, borderRadius: 18 },
  urgentCardName: { fontSize: 15, fontWeight: '800', color: '#111' },
  urgentCardBreed: { fontSize: 12, color: '#666', marginTop: 1 },
  urgentCardShelter: { fontSize: 11, color: '#bbb', marginTop: 2 },
  urgentCardDeadline: { fontSize: 11, color: '#DC2626', fontWeight: '700', marginTop: 4 },
  urgentCardArrow: { fontSize: 26, color: '#D1D5DB' },
  urgentInfoBox: { margin: 16, backgroundColor: 'white', borderRadius: 18, padding: 16, borderLeftWidth: 3, borderLeftColor: '#DC2626' },
  urgentInfoTitle: { fontSize: 13, fontWeight: '800', color: '#1a1a1a', marginBottom: 8 },
  urgentInfoBody: { fontSize: 13, color: '#555', lineHeight: 22 },

  // ── lightbox ──
  lightboxOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.94)', alignItems: 'center', justifyContent: 'center' },
  lightboxImg: { width: SW, height: Dimensions.get('window').height * 0.82 },
  lightboxCloseBtn: { position: 'absolute', top: 54, right: 18, backgroundColor: 'rgba(255,255,255,0.15)', borderRadius: 999, width: 40, height: 40, alignItems: 'center', justifyContent: 'center' },
  lightboxCloseTxt: { color: 'white', fontSize: 16, fontWeight: '700' },
});
