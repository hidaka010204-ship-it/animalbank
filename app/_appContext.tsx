import { Session } from '@supabase/supabase-js';
import { createContext, ReactNode, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { Lang } from '../lib/i18n';
import { requestPermission, scheduleLocalNotification } from '../lib/notifications';
import { storage, STORAGE_KEYS } from '../lib/storage';
import { supabase } from '../lib/supabase';

export type Animal = {
  id: string;
  user_id?: string;
  emoji: string;
  name: string;
  animalKind: '犬' | '猫' | 'その他';
  breed: string;
  gender: string;
  age: string;
  weight: string;
  intakeDate: string;
  disposalDeadline: string;
  shelter: string;
  prefecture: string;
  urgent: boolean;
  deadline?: string;
  description: string;
  notes: string;
  images: string[];
  status: string;
  statusBg: string;
  statusColor: string;
  sub: string;
  source: string;
};

export type PrefectureStats = {
  prefecture: string;
  region: string;
  collected: number;
  urgent: number;
  pending: number;
  transferred: number;
  disposed: number;
};

export const PREFECTURE_STATS: PrefectureStats[] = [
  { prefecture: '北海道', region: '北海道',  collected: 48, urgent: 8,  pending: 5,  transferred: 12, disposed: 3 },
  { prefecture: '青森県', region: '東北',    collected: 23, urgent: 3,  pending: 2,  transferred: 7,  disposed: 1 },
  { prefecture: '岩手県', region: '東北',    collected: 18, urgent: 2,  pending: 1,  transferred: 5,  disposed: 0 },
  { prefecture: '宮城県', region: '東北',    collected: 35, urgent: 5,  pending: 4,  transferred: 10, disposed: 2 },
  { prefecture: '秋田県', region: '東北',    collected: 15, urgent: 2,  pending: 1,  transferred: 4,  disposed: 0 },
  { prefecture: '山形県', region: '東北',    collected: 19, urgent: 3,  pending: 2,  transferred: 6,  disposed: 1 },
  { prefecture: '福島県', region: '東北',    collected: 28, urgent: 4,  pending: 3,  transferred: 8,  disposed: 1 },
  { prefecture: '茨城県', region: '関東',    collected: 42, urgent: 6,  pending: 5,  transferred: 11, disposed: 2 },
  { prefecture: '栃木県', region: '関東',    collected: 31, urgent: 4,  pending: 3,  transferred: 9,  disposed: 1 },
  { prefecture: '群馬県', region: '関東',    collected: 33, urgent: 5,  pending: 3,  transferred: 9,  disposed: 2 },
  { prefecture: '埼玉県', region: '関東',    collected: 67, urgent: 9,  pending: 8,  transferred: 18, disposed: 4 },
  { prefecture: '千葉県', region: '関東',    collected: 72, urgent: 11, pending: 9,  transferred: 20, disposed: 5 },
  { prefecture: '東京都', region: '関東',    collected: 89, urgent: 13, pending: 12, transferred: 25, disposed: 6 },
  { prefecture: '神奈川県', region: '関東',  collected: 78, urgent: 12, pending: 10, transferred: 22, disposed: 5 },
  { prefecture: '新潟県', region: '中部',    collected: 29, urgent: 4,  pending: 3,  transferred: 8,  disposed: 1 },
  { prefecture: '富山県', region: '中部',    collected: 16, urgent: 2,  pending: 1,  transferred: 5,  disposed: 0 },
  { prefecture: '石川県', region: '中部',    collected: 20, urgent: 3,  pending: 2,  transferred: 6,  disposed: 1 },
  { prefecture: '福井県', region: '中部',    collected: 13, urgent: 1,  pending: 1,  transferred: 4,  disposed: 0 },
  { prefecture: '山梨県', region: '中部',    collected: 17, urgent: 2,  pending: 2,  transferred: 5,  disposed: 0 },
  { prefecture: '長野県', region: '中部',    collected: 32, urgent: 4,  pending: 3,  transferred: 9,  disposed: 1 },
  { prefecture: '岐阜県', region: '中部',    collected: 38, urgent: 6,  pending: 4,  transferred: 10, disposed: 2 },
  { prefecture: '静岡県', region: '中部',    collected: 55, urgent: 8,  pending: 6,  transferred: 15, disposed: 3 },
  { prefecture: '愛知県', region: '中部',    collected: 95, urgent: 14, pending: 12, transferred: 28, disposed: 7 },
  { prefecture: '三重県', region: '中部',    collected: 27, urgent: 4,  pending: 3,  transferred: 8,  disposed: 1 },
  { prefecture: '滋賀県', region: '近畿',    collected: 22, urgent: 3,  pending: 2,  transferred: 7,  disposed: 1 },
  { prefecture: '京都府', region: '近畿',    collected: 41, urgent: 6,  pending: 5,  transferred: 12, disposed: 2 },
  { prefecture: '大阪府', region: '近畿',    collected: 102,urgent: 16, pending: 14, transferred: 30, disposed: 8 },
  { prefecture: '兵庫県', region: '近畿',    collected: 71, urgent: 10, pending: 9,  transferred: 20, disposed: 4 },
  { prefecture: '奈良県', region: '近畿',    collected: 24, urgent: 3,  pending: 2,  transferred: 7,  disposed: 1 },
  { prefecture: '和歌山県', region: '近畿',  collected: 18, urgent: 2,  pending: 2,  transferred: 5,  disposed: 0 },
  { prefecture: '鳥取県', region: '中国',    collected: 11, urgent: 1,  pending: 1,  transferred: 3,  disposed: 0 },
  { prefecture: '島根県', region: '中国',    collected: 14, urgent: 2,  pending: 1,  transferred: 4,  disposed: 0 },
  { prefecture: '岡山県', region: '中国',    collected: 33, urgent: 5,  pending: 4,  transferred: 10, disposed: 2 },
  { prefecture: '広島県', region: '中国',    collected: 48, urgent: 7,  pending: 6,  transferred: 14, disposed: 3 },
  { prefecture: '山口県', region: '中国',    collected: 22, urgent: 3,  pending: 2,  transferred: 7,  disposed: 1 },
  { prefecture: '徳島県', region: '四国',    collected: 16, urgent: 2,  pending: 1,  transferred: 5,  disposed: 0 },
  { prefecture: '香川県', region: '四国',    collected: 19, urgent: 3,  pending: 2,  transferred: 6,  disposed: 1 },
  { prefecture: '愛媛県', region: '四国',    collected: 26, urgent: 4,  pending: 3,  transferred: 8,  disposed: 1 },
  { prefecture: '高知県', region: '四国',    collected: 17, urgent: 2,  pending: 2,  transferred: 5,  disposed: 0 },
  { prefecture: '福岡県', region: '九州',    collected: 84, urgent: 12, pending: 11, transferred: 24, disposed: 5 },
  { prefecture: '佐賀県', region: '九州',    collected: 16, urgent: 2,  pending: 1,  transferred: 5,  disposed: 0 },
  { prefecture: '長崎県', region: '九州',    collected: 24, urgent: 3,  pending: 2,  transferred: 7,  disposed: 1 },
  { prefecture: '熊本県', region: '九州',    collected: 35, urgent: 5,  pending: 4,  transferred: 10, disposed: 2 },
  { prefecture: '大分県', region: '九州',    collected: 22, urgent: 3,  pending: 2,  transferred: 7,  disposed: 1 },
  { prefecture: '宮崎県', region: '九州',    collected: 21, urgent: 3,  pending: 2,  transferred: 6,  disposed: 1 },
  { prefecture: '鹿児島県', region: '九州',  collected: 33, urgent: 5,  pending: 3,  transferred: 9,  disposed: 2 },
  { prefecture: '沖縄県', region: '九州',    collected: 29, urgent: 4,  pending: 3,  transferred: 8,  disposed: 1 },
];

// NATIONAL_TOTALS はコンテキストから動的に取得（prefectureStats / nationalTotals）

const initialAnimals: Animal[] = [
  {
    id: '1',
    emoji: '🐕',
    name: 'ポチ',
    animalKind: '犬',
    breed: '柴犬ミックス',
    age: '推定3歳',
    weight: '約10kg',
    intakeDate: '2026/03/28',
    disposalDeadline: '2026/04/07',
    shelter: '中津川市保健所',
    prefecture: '岐阜県',
    urgent: true,
    deadline: '⚠️ 処分期限：4/7（本日）',
    description: '人懐っこい性格で、散歩が大好きです。ワクチン接種済み。一人暮らしの方にも向いています。お外でお散歩中に迷子になったと思われます。',
    notes: '首輪あり。迷子の可能性あり。去勢未実施。',
    images: [],
    status: '緊急',
    statusBg: '#FCEBEB',
    statusColor: '#A32D2D',
    sub: '収容日：3/28 ・ 期限：4/7',
  },
  {
    id: '2',
    emoji: '🐈',
    name: 'ミケ',
    animalKind: '猫',
    breed: '三毛猫（ミックス）',
    age: '推定1歳',
    weight: '約3.2kg',
    intakeDate: '2026/03/30',
    disposalDeadline: '2026/04/20',
    shelter: '春日井市保健所',
    prefecture: '愛知県',
    urgent: false,
    description: '白黒茶模様の元気な猫です。室内飼育に適しており、他の猫とも仲良くできます。人にも慣れており、抱っこOKです。',
    notes: '避妊済み。ワクチン接種済み。',
    images: [],
    status: '申請中',
    statusBg: '#D4EEE9',
    statusColor: '#2D4A47',
    sub: '収容日：3/30 ・ 期限：4/20',
  },
  {
    id: '3',
    emoji: '🐶',
    name: 'レオ',
    animalKind: '犬',
    breed: 'ラブラドールミックス',
    age: '推定6ヶ月',
    weight: '約8kg',
    intakeDate: '2026/04/01',
    disposalDeadline: '2026/04/22',
    shelter: '飯田市保健所',
    prefecture: '長野県',
    urgent: false,
    description: '子犬でまだ訓練中ですが、学習能力が高く賢いです。子どもがいるご家庭にもおすすめです。元気いっぱいで遊ぶのが大好き。',
    notes: '去勢未実施。ワクチン接種済み。',
    images: [],
    status: '新規',
    statusBg: '#E6F1FB',
    statusColor: '#185FA5',
    sub: '収容日：4/1 ・ 期限：4/22',
  },
  {
    id: '4',
    emoji: '🐕',
    name: 'ゴン',
    animalKind: '犬',
    breed: 'トイプードル',
    age: '推定5歳',
    weight: '約4.5kg',
    intakeDate: '2026/04/02',
    disposalDeadline: '2026/04/23',
    shelter: '名古屋市動物愛護センター',
    prefecture: '愛知県',
    urgent: false,
    description: 'カットがやや伸びた状態で保護されました。おとなしく落ち着いた性格です。室内飼育向き。先住犬とも仲良くできます。',
    notes: '去勢済み。マイクロチップなし。毛並みは要トリミング。',
    images: [],
    status: '新規',
    statusBg: '#E6F1FB',
    statusColor: '#185FA5',
    sub: '収容日：4/2 ・ 期限：4/23',
  },
  {
    id: '5',
    emoji: '🐈',
    name: 'そら',
    animalKind: '猫',
    breed: 'スコティッシュフォールド',
    age: '推定2歳',
    weight: '約4.0kg',
    intakeDate: '2026/04/03',
    disposalDeadline: '2026/04/24',
    shelter: '岐阜市保健所',
    prefecture: '岐阜県',
    urgent: false,
    description: '折れ耳の静かな猫です。最初は警戒しますが、慣れると甘えてきます。一人暮らしの方でも飼いやすい子です。',
    notes: '避妊済み。元飼い猫と思われる。健康状態良好。',
    images: [],
    status: '新規',
    statusBg: '#E6F1FB',
    statusColor: '#185FA5',
    sub: '収容日：4/3 ・ 期限：4/24',
  },
  {
    id: '6',
    emoji: '🐕',
    name: 'ハナ',
    animalKind: '犬',
    breed: '柴犬',
    age: '推定7歳',
    weight: '約9kg',
    intakeDate: '2026/04/01',
    disposalDeadline: '2026/04/12',
    shelter: '岐阜市保健所',
    prefecture: '岐阜県',
    urgent: true,
    deadline: '⚠️ 処分期限：4/12（残り5日）',
    description: 'シニア犬ですが元気です。おとなしく飼いやすい子です。静かな環境を好みます。穏やかな大人のご家庭向けです。',
    notes: '避妊済み。シニア健診推奨。歯石あり。',
    images: [],
    status: '緊急',
    statusBg: '#FCEBEB',
    statusColor: '#A32D2D',
    sub: '収容日：4/1 ・ 期限：4/12',
  },
  {
    id: '7',
    emoji: '🐾',
    name: 'うさ',
    animalKind: 'その他',
    breed: 'ウサギ（ネザーランドドワーフ）',
    age: '推定1歳',
    weight: '約1.2kg',
    intakeDate: '2026/04/04',
    disposalDeadline: '2026/04/25',
    shelter: '春日井市保健所',
    prefecture: '愛知県',
    urgent: false,
    description: '小さくてかわいいウサギです。おとなしく扱いやすいです。ケージ飼育が基本です。',
    notes: 'ケージ・エサ一式あり（引き渡し可）。健康状態良好。',
    images: [],
    status: '新規',
    statusBg: '#E6F1FB',
    statusColor: '#185FA5',
    sub: '収容日：4/4 ・ 期限：4/25',
  },
  {
    id: '8',
    emoji: '🐈',
    name: 'くろ',
    animalKind: '猫',
    breed: '黒猫（ミックス）',
    age: '推定3ヶ月',
    weight: '約0.8kg',
    intakeDate: '2026/04/05',
    disposalDeadline: '2026/04/26',
    shelter: '名古屋市動物愛護センター',
    prefecture: '愛知県',
    urgent: false,
    description: '子猫で非常に活発。兄弟猫と一緒に保護されました。一匹での引き取りも可能です。',
    notes: '2匹での引き取り歓迎。ワクチン未接種（要接種）。',
    images: [],
    status: '新規',
    statusBg: '#E6F1FB',
    statusColor: '#185FA5',
    sub: '収容日：4/5 ・ 期限：4/26',
  },
];

export type UserProfile = {
  avatar: string;
  nickname: string;
  prefecture: string;
  city?: string;
  photoUri?: string;
  lat?: number;
  lng?: number;
};

export type NearbyPost = {
  id: string;
  type: 'lost' | 'found';
  content: string;
  location: string;
  locationPrefecture: string;
  images: string[];
  createdAt: string;
  lat?: number;
  lng?: number;
};

type AppContextType = {
  animals: Animal[];
  loading: boolean;
  addAnimal: (a: Animal) => void;
  refreshAnimals: () => Promise<void>;
  favorites: Set<string>;
  toggleFavorite: (id: string) => void;
  session: Session | null;
  signOut: () => Promise<void>;
  isAdminLoggedIn: boolean;
  adminLogin: (password: string) => boolean;
  adminLogout: () => void;
  userProfile: UserProfile;
  updateUserProfile: (p: Partial<UserProfile>) => void;
  nearbyPosts: NearbyPost[];
  nearbyPostsLoading: boolean;
  refreshNearbyPosts: () => Promise<void>;
  prefectureStats: PrefectureStats[];
  nationalTotals: { collected: number; urgent: number; pending: number; transferred: number; disposed: number };
  themeColor: string;
  setThemeColor: (c: string) => void;
  language: Lang;
  setLanguage: (l: Lang) => void;
};

const AppContext = createContext<AppContextType | null>(null);

function parseImages(raw: unknown): string[] {
  if (!raw) return [];
  if (Array.isArray(raw)) {
    return (raw as unknown[]).filter((u): u is string => typeof u === 'string' && u.length > 0);
  }
  if (typeof raw === 'string') {
    const s = raw.trim();
    if (s.startsWith('[')) {
      try {
        const p = JSON.parse(s);
        return Array.isArray(p) ? p.filter((u: unknown): u is string => typeof u === 'string' && u.length > 0) : [];
      } catch { return []; }
    }
    if (s.startsWith('{') && s.endsWith('}')) {
      return s.slice(1, -1).split(',').map(u => u.replace(/^"|"$/g, '').trim()).filter(u => u.length > 0);
    }
    if (s.length > 0) return [s];
  }
  return [];
}

export function mapToAnimal(row: Record<string, unknown>): Animal {
  const species = row.species as string ?? '';
  const speciesKind: Record<string, '犬' | '猫' | 'その他'> = { dog: '犬', cat: '猫' };
  const speciesEmoji: Record<string, string> = { dog: '🐕', cat: '🐈', rabbit: '🐾', bird: '🐦' };
  const animalKind = speciesKind[species] ?? 'その他';
  const statusLabel: Record<string, string> = { available: '譲渡可', fostering: '一時預かり中', adopted: '譲渡済' };
  const deadline = row.deadline as string ?? '';
  const admittedAt = row.admitted_at as string ?? '';
  const source = (row.source as string) ?? '';
  const isShelter = source === 'shelter';
  const now = new Date();
  const jstOffset = 9 * 60 * 60 * 1000;
  const jstNow = new Date(Date.now() + jstOffset);
  const today = new Date(Date.UTC(jstNow.getUTCFullYear(), jstNow.getUTCMonth(), jstNow.getUTCDate()));
  const threeDaysLater = new Date(today.getTime() + 3 * 24 * 60 * 60 * 1000);
  const dl = deadline ? deadline.replace(/\//g, '-') : '';
  const parts = dl.split('-');
  const deadlineDate = parts.length === 3 ? new Date(Date.UTC(Number(parts[0]), Number(parts[1]) - 1, Number(parts[2]))) : null;
  // 緊急・期限切迫は保健所登録（source==='shelter'）のみ判定する
  const isDeadlineSoon = isShelter && deadlineDate && !isNaN(deadlineDate.getTime())
    && deadlineDate >= today && deadlineDate <= threeDaysLater;
  const isUrgent = isShelter && ((row.is_urgent as boolean ?? false) || !!isDeadlineSoon);
  const imagesRaw = row.images;
  console.log(
    `[mapToAnimal] id=${row.id} name=${row.name} source="${source}" deadline="${deadline}"`,
    `deadlineDate=${deadlineDate?.toISOString() ?? 'null'}`,
    `today=${today.toISOString()} threeDaysLater=${threeDaysLater.toISOString()}`,
    `isDeadlineSoon=${!!isDeadlineSoon} isUrgent=${isUrgent}`,
    `images type=${Array.isArray(imagesRaw) ? 'array' : typeof imagesRaw} value=${JSON.stringify(imagesRaw)}`,
  );

  // ステータス判定（優先順位：緊急 > 申請中 > 新規 > 収容中）
  const rawStatus = row.status as string ?? '';
  let computedStatus: string;
  let computedStatusBg: string;
  let computedStatusColor: string;
  if (isUrgent) {
    computedStatus = '緊急';
    computedStatusBg = '#FCEBEB';
    computedStatusColor = '#A32D2D';
  } else if (rawStatus === 'pending' || rawStatus === '申請中') {
    computedStatus = '申請中';
    computedStatusBg = '#D4EEE9';
    computedStatusColor = '#2D4A47';
  } else {
    const admittedDate = admittedAt ? new Date(admittedAt.replace(/\//g, '-')) : null;
    const oneMonthAgo = new Date(now.getTime() - 31 * 24 * 60 * 60 * 1000);
    const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    const isNew = admittedDate && !isNaN(admittedDate.getTime()) && admittedDate >= oneMonthAgo;
    if (isNew) {
      if (isShelter && admittedDate < sevenDaysAgo) {
        // 保健所登録かつ収容7日以上経過 → 譲渡可
        computedStatus = '譲渡可';
        computedStatusBg = '#D4EEE9';
        computedStatusColor = '#2D4A47';
      } else {
        computedStatus = '新規';
        computedStatusBg = '#E6F1FB';
        computedStatusColor = '#185FA5';
      }
    } else {
      computedStatus = statusLabel[rawStatus] ?? (rawStatus || '収容中');
      computedStatusBg = '#F5F5F5';
      computedStatusColor = '#666';
    }
  }

  return {
    id: row.id as string,
    user_id: (row.user_id as string) ?? undefined,
    emoji: speciesEmoji[species] ?? '🐾',
    name: row.name as string ?? '',
    animalKind,
    breed: row.breed as string ?? '',
    gender: (row.gender as string) === 'male' ? 'オス' : (row.gender as string) === 'female' ? 'メス' : '',
    age: '',
    weight: '',
    intakeDate: admittedAt,
    disposalDeadline: deadline,
    shelter: (row.shelters as { name: string } | null)?.name ?? (row.shelter as string) ?? '',
    prefecture: (row.shelters as { prefecture: string } | null)?.prefecture ?? (row.prefecture as string) ?? '',
    urgent: isUrgent,
    deadline: isUrgent && deadline ? `⚠️ ${isShelter ? '処分期限' : '掲載期限'}：${deadline}` : undefined,
    description: row.description as string ?? '',
    notes: '',
    images: parseImages(row.images),
    status: computedStatus,
    statusBg: computedStatusBg,
    statusColor: computedStatusColor,
    sub: admittedAt ? `収容日：${admittedAt}` : '',
    source: (row.source as string) ?? '',
  };
}

export function AppProvider({ children }: { children: ReactNode }) {
  const [animals, setAnimals] = useState<Animal[]>([]);
  const [disposedThisMonth, setDisposedThisMonth] = useState(0);
  const [transferredThisMonth, setTransferredThisMonth] = useState(0);
  const [loading, setLoading] = useState(true);
  const [favorites, setFavorites] = useState<Set<string>>(new Set());
  const [session, setSession] = useState<Session | null>(null);
  const [isAdminLoggedIn, setIsAdminLoggedIn] = useState(false);
  const [userProfile, setUserProfile] = useState<UserProfile>({
    avatar: '👤',
    nickname: '',
    prefecture: '',
  });
  const [nearbyPosts, setNearbyPosts] = useState<NearbyPost[]>([]);
  const [nearbyPostsLoading, setNearbyPostsLoading] = useState(false);
  const [themeColor, setThemeColorState] = useState('#4FA3A0');
  const [language, setLanguageState] = useState<Lang>('ja');

  // Supabaseのanimalsから都道府県別統計を動的に生成（保健所登録分のみカウント）
  const prefectureStats = useMemo<PrefectureStats[]>(() => {
    const map = new Map<string, PrefectureStats>();
    for (const a of animals) {
      // source='public' の一般ユーザー登録分は全国統計に含めない
      if (a.source === 'public') continue;
      const pref = a.prefecture;
      if (!pref) continue;
      if (!map.has(pref)) {
        const region = PREFECTURE_STATS.find(p => p.prefecture === pref)?.region ?? '不明';
        map.set(pref, { prefecture: pref, region, collected: 0, urgent: 0, pending: 0, transferred: 0, disposed: 0 });
      }
      const s = map.get(pref)!;
      s.collected++;
      if (a.urgent) s.urgent++;
      if (a.status === '申請中') s.pending++;
      if (a.status === '譲渡可' || a.status === '譲渡済') s.transferred++;
    }
    return Array.from(map.values()).sort((a, b) => b.urgent - a.urgent);
  }, [animals]);

  const nationalTotals = useMemo(() => ({
    // prefecture が空の動物も含めて全 shelter 動物を直接カウント
    collected: animals.filter(a => a.source !== 'public').length,
    urgent: prefectureStats.reduce((s, p) => s + p.urgent, 0),
    pending: prefectureStats.reduce((s, p) => s + p.pending, 0),
    transferred: transferredThisMonth,
    disposed: disposedThisMonth,
  }), [animals, prefectureStats, disposedThisMonth, transferredThisMonth]);

  // 通知用 ref（レンダーを跨いで最新値を参照するため）
  const userProfileRef = useRef(userProfile);
  useEffect(() => { userProfileRef.current = userProfile; }, [userProfile]);

  const sessionRef = useRef(session);
  useEffect(() => { sessionRef.current = session; }, [session]);

  const favoritesRef = useRef(favorites);
  useEffect(() => { favoritesRef.current = favorites; }, [favorites]);

  const knownPostIdsRef = useRef<Set<string> | null>(null); // null = 初回ロード前
  const knownAnimalIdsRef = useRef<Set<string> | null>(null); // null = 初回ロード前
  const knownAnimalStatusesRef = useRef<Record<string, string> | null>(null); // null = 初回ロード前

  // notifications テーブルに INSERT するヘルパー
  const insertNotification = useCallback(async (type: string, title: string, body: string) => {
    const userId = sessionRef.current?.user?.id;
    if (!userId) return; // 未ログイン時はスキップ
    const { error } = await supabase
      .from('notifications')
      .insert({ user_id: userId, type, title, body });
    if (error) console.error('[AppContext] notification INSERT エラー:', error);
  }, []);

  // 通知許可をアプリ起動時に取得
  useEffect(() => { requestPermission(); }, []);

  // AsyncStorage から userProfile・favorites を復元
  useEffect(() => {
    const load = async () => {
      try {
        const [profileJson, favJson, themeJson, langJson] = await Promise.all([
          storage.getItem(STORAGE_KEYS.USER_PROFILE),
          storage.getItem(STORAGE_KEYS.FAVORITES),
          storage.getItem(STORAGE_KEYS.THEME_COLOR),
          storage.getItem(STORAGE_KEYS.LANGUAGE),
        ]);
        if (profileJson) {
          console.log('[AppContext] userProfile を復元');
          setUserProfile(JSON.parse(profileJson));
        }
        if (favJson) {
          console.log('[AppContext] favorites を復元');
          setFavorites(new Set(JSON.parse(favJson)));
        }
        if (themeJson) setThemeColorState(themeJson);
        if (langJson) setLanguageState(langJson as Lang);
      } catch (e) {
        console.error('[AppContext] AsyncStorage 読み込みエラー:', e);
      }
    };
    load();
  }, []);

  const fetchAnimals = useCallback(async () => {
    const { data, error } = await supabase
      .from('animals')
      .select('id, name, species, breed, gender, description, is_urgent, deadline, admitted_at, status, shelter, prefecture, source, user_id, images')
      .neq('status', 'transferred')
      .order('created_at', { ascending: false });
    if (error) {
      console.error('Supabase fetch error:', error);
      return;
    }
    const mapped = (data ?? []).map(row => mapToAnimal(row as Record<string, unknown>));

    // 期限が過ぎた動物をアプリ全体から除外（JST基準）
    const jstNowForFilter = new Date(Date.now() + 9 * 60 * 60 * 1000);
    const todayForFilter = new Date(Date.UTC(jstNowForFilter.getUTCFullYear(), jstNowForFilter.getUTCMonth(), jstNowForFilter.getUTCDate()));
    const startOfThisMonth = new Date(Date.UTC(jstNowForFilter.getUTCFullYear(), jstNowForFilter.getUTCMonth(), 1));
    const active = mapped.filter(a => {
      if (!a.disposalDeadline) return true; // 期限なし → 表示
      const d = new Date(a.disposalDeadline.replace(/\//g, '-'));
      if (isNaN(d.getTime())) return true; // パース失敗 → 表示
      return d >= todayForFilter; // 今日以降の期限のみ表示
    });
    // 今月処分済み（今月1日〜昨日の間に期限が切れた動物）
    const disposedCount = mapped.filter(a => {
      if (!a.disposalDeadline) return false;
      const d = new Date(a.disposalDeadline.replace(/\//g, '-'));
      if (isNaN(d.getTime())) return false;
      return d >= startOfThisMonth && d < todayForFilter;
    }).length;
    setDisposedThisMonth(disposedCount);
    setAnimals(active);

    // 今月譲渡された動物数をカウント（status='transferred' かつ updated_at が今月、なければ created_at）
    const startOfThisMonthISO = startOfThisMonth.toISOString();
    const { count: transferredCount, error: transferredError } = await supabase
      .from('animals')
      .select('id', { count: 'exact', head: true })
      .eq('status', 'transferred')
      .gte('updated_at', startOfThisMonthISO);
    if (!transferredError) {
      setTransferredThisMonth(transferredCount ?? 0);
    } else {
      // updated_at カラムがない場合は created_at で代用
      console.warn('[AppContext] updated_at でのカウント失敗、created_at で代用:', transferredError.message);
      const { count: transferredCountAlt } = await supabase
        .from('animals')
        .select('id', { count: 'exact', head: true })
        .eq('status', 'transferred')
        .gte('created_at', startOfThisMonthISO);
      setTransferredThisMonth(transferredCountAlt ?? 0);
    }

    // 処分期限3日以内かつお気に入り登録済みの動物を通知（通知済みIDを記録して重複通知しない）
    const notifiedJson = await storage.getItem(STORAGE_KEYS.NOTIFIED_URGENT_IDS).catch(() => null);
    const notifiedIds: string[] = notifiedJson ? JSON.parse(notifiedJson) : [];
    const notifiedSet = new Set(notifiedIds);

    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const threeDaysLater = new Date(today.getTime() + 3 * 24 * 60 * 60 * 1000);
    const currentFavorites = favoritesRef.current;
    const newlyUrgent = active.filter(a => {
      if (notifiedSet.has(a.id)) return false; // 既に通知済み
      if (!currentFavorites.has(a.id)) return false; // お気に入り登録済みのみ
      if (!a.disposalDeadline) return false;
      const d = new Date(a.disposalDeadline.replace(/\//g, '-'));
      return !isNaN(d.getTime()) && d >= today && d <= threeDaysLater;
    });
    if (newlyUrgent.length > 0) {
      // 動物ごとに個別通知（タップ時に詳細画面へ遷移できるよう animalId を data に付与）
      for (const a of newlyUrgent) {
        const title = '🚨 処分期限が迫っています';
        const body = `${a.name}の処分期限が3日以内に迫っています`;
        scheduleLocalNotification({ title, body, data: { animalId: a.id } });
        insertNotification('urgent', title, body);
      }
      const updatedIds = [...notifiedIds, ...newlyUrgent.map(a => a.id)];
      await storage.setItem(STORAGE_KEYS.NOTIFIED_URGENT_IDS, JSON.stringify(updatedIds)).catch(() => {});
      console.log('[AppContext] 処分期限通知 新規:', newlyUrgent.map(a => a.name));
    } else {
      console.log('[AppContext] 処分期限: 新規の緊急動物なし（またはお気に入り未登録）');
    }

    // 自分の県の新規登録動物を通知（初回ロード時は既知IDとして登録するだけで通知しない）
    const userPref = userProfileRef.current.prefecture;
    if (knownAnimalIdsRef.current === null) {
      knownAnimalIdsRef.current = new Set(active.map(a => a.id));
    } else if (userPref) {
      const newInPref = active.filter(a => !knownAnimalIdsRef.current!.has(a.id) && a.prefecture === userPref);
      if (newInPref.length > 0) {
        const names = newInPref.map(a => a.name).join('、');
        const title = `🐾 ${userPref}に新しい動物が登録されました`;
        const body = `${names}（${newInPref.length}件）が新たに収容されています`;
        scheduleLocalNotification({ title, body });
        insertNotification('new_animal', title, body);
        console.log('[AppContext] 新規登録通知:', newInPref.map(a => a.name));
      }
      active.forEach(a => knownAnimalIdsRef.current!.add(a.id));
    }

    // 申請状況の変化を通知（受理/却下）（初回ロード時はステータスを記録するだけ）
    if (knownAnimalStatusesRef.current === null) {
      knownAnimalStatusesRef.current = Object.fromEntries(active.map(a => [a.id, a.status]));
    } else {
      const prevStatuses = knownAnimalStatusesRef.current;
      for (const a of active) {
        const prev = prevStatuses[a.id];
        if (prev === '申請中' && a.status !== '申請中') {
          const accepted = a.status === '譲渡可' || a.status === '譲渡済' || a.status === '一時預かり中';
          const label = accepted ? '受理されました ✅' : '却下されました ❌';
          const title = '📋 申請状況が更新されました';
          const body = `${a.name}の申請が${label}`;
          scheduleLocalNotification({ title, body, data: { animalId: a.id } });
          insertNotification('application_status', title, body);
          console.log('[AppContext] 申請状況通知:', a.name, prev, '->', a.status);
        }
      }
      knownAnimalStatusesRef.current = Object.fromEntries(active.map(a => [a.id, a.status]));
    }
  }, [insertNotification]);

  const fetchNearbyPosts = useCallback(async () => {
    setNearbyPostsLoading(true);
    const { data, error } = await supabase
      .from('posts')
      .select('id, type, content, location_prefecture, location_city, images, created_at, lat, lng')
      .in('type', ['lost', 'found'])
      .order('created_at', { ascending: false })
      .limit(50);
    if (error) {
      console.error('[AppContext] nearbyPosts fetch error:', error);
      setNearbyPostsLoading(false);
      return;
    }

    const fetched: NearbyPost[] = (data ?? []).map(row => ({
      id: row.id as string,
      type: row.type as 'lost' | 'found',
      content: row.content as string ?? '',
      location: [row.location_prefecture as string, row.location_city as string].filter(Boolean).join(' '),
      locationPrefecture: row.location_prefecture as string ?? '',
      images: Array.isArray(row.images)
        ? (row.images as unknown[]).filter((u): u is string => typeof u === 'string' && u.length > 0)
        : [],
      createdAt: row.created_at as string,
      lat: typeof row.lat === 'number' ? row.lat : undefined,
      lng: typeof row.lng === 'number' ? row.lng : undefined,
    }));

    // 初回ロードは既知IDとして登録するだけで通知しない
    if (knownPostIdsRef.current === null) {
      knownPostIdsRef.current = new Set(fetched.map(p => p.id));
    } else {
      // 自分の県に一致する新着投稿を通知
      const prefecture = userProfileRef.current.prefecture;
      const newPosts = fetched.filter(p => !knownPostIdsRef.current!.has(p.id));
      const relevant = prefecture
        ? newPosts.filter(p => p.locationPrefecture === prefecture)
        : newPosts;
      for (const post of relevant) {
        const typeLabel = post.type === 'lost' ? '迷子情報' : '保護情報';
        const locationStr = post.location ? ` (${post.location})` : '';
        const title = `📍 新しい${typeLabel}${locationStr}`;
        const body = post.content || '新しい投稿があります';
        scheduleLocalNotification({ title, body });
        insertNotification('nearby_post', title, body);
      }
      newPosts.forEach(p => knownPostIdsRef.current!.add(p.id));
    }

    setNearbyPosts(fetched);
    setNearbyPostsLoading(false);
  }, []);

  useEffect(() => {
    fetchAnimals().finally(() => setLoading(false));
    fetchNearbyPosts();
  }, [fetchAnimals, fetchNearbyPosts]);

  const fetchUserLatLng = useCallback(async (userId: string) => {
    const { data } = await supabase
      .from('profiles')
      .select('lat, lng, is_admin')
      .eq('id', userId)
      .single();
    if (data) {
      setIsAdminLoggedIn(!!data.is_admin);
      setUserProfile(prev => ({
        ...prev,
        lat: typeof data.lat === 'number' ? data.lat : undefined,
        lng: typeof data.lng === 'number' ? data.lng : undefined,
      }));
    }
  }, []);

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      if (session?.user?.id) fetchUserLatLng(session.user.id);
    });
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
      if (session?.user?.id) {
        fetchUserLatLng(session.user.id);
      } else {
        setIsAdminLoggedIn(false);
      }
    });
    return () => subscription.unsubscribe();
  }, [fetchUserLatLng]);

  const signOut = async () => { await supabase.auth.signOut(); };

  const addAnimal = (a: Animal) => setAnimals(prev => [a, ...prev]);

  const toggleFavorite = (id: string) => {
    setFavorites(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      storage.setItem(STORAGE_KEYS.FAVORITES, JSON.stringify([...next])).catch(e =>
        console.error('[AppContext] favorites 保存エラー:', e)
      );
      return next;
    });
  };

  const adminLogin = (_password: string): boolean => {
    return isAdminLoggedIn;
  };

  const adminLogout = () => setIsAdminLoggedIn(false);

  const setThemeColor = (c: string) => {
    setThemeColorState(c);
    storage.setItem(STORAGE_KEYS.THEME_COLOR, c).catch(() => {});
  };

  const setLanguage = (l: Lang) => {
    setLanguageState(l);
    storage.setItem(STORAGE_KEYS.LANGUAGE, l).catch(() => {});
  };

  const updateUserProfile = (p: Partial<UserProfile>) => {
    console.log('[AppContext] updateUserProfile 呼び出し:', { avatar: p.avatar, photoUri: p.photoUri, nickname: p.nickname });
    setUserProfile(prev => {
      const next = { ...prev, ...p };
      console.log('[AppContext] userProfile 保存内容:', { avatar: next.avatar, photoUri: next.photoUri });
      storage.setItem(STORAGE_KEYS.USER_PROFILE, JSON.stringify(next)).catch(e =>
        console.error('[AppContext] userProfile 保存エラー:', e)
      );
      return next;
    });
  };

  return (
    <AppContext.Provider value={{ animals, loading, addAnimal, refreshAnimals: fetchAnimals, favorites, toggleFavorite, session, signOut, isAdminLoggedIn, adminLogin, adminLogout, userProfile, updateUserProfile, nearbyPosts, nearbyPostsLoading, refreshNearbyPosts: fetchNearbyPosts, prefectureStats, nationalTotals, themeColor, setThemeColor, language, setLanguage }}>
      {children}
    </AppContext.Provider>
  );
}

export function useApp() {
  const ctx = useContext(AppContext);
  if (!ctx) throw new Error('useApp must be used within AppProvider');
  return ctx;
}
