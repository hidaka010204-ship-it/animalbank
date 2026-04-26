export type Lang = 'ja' | 'en';

const T = {
  tab_home:          { ja: 'ホーム',            en: 'Home' },
  tab_timeline:      { ja: 'タイムライン',      en: 'Timeline' },
  tab_notifications: { ja: '通知',              en: 'Alerts' },
  tab_animals:       { ja: '動物情報',          en: 'Animals' },
  tab_mypage:        { ja: 'マイページ',        en: 'My Page' },
  home_badge:        { ja: '🐾 動物救助アプリ', en: '🐾 Animal Rescue' },
  home_title:        { ja: 'あにまるバンク',    en: 'Animal Bank' },
  home_tagline:      { ja: '繋ぐ、守る、愛でる。', en: 'Connect, Protect, Love.' },
  stats_heading:     { ja: '📊 全国統計',        en: '📊 National Stats' },
  stat_sheltered:    { ja: '収容中',             en: 'Sheltered' },
  stat_transferred:  { ja: '今月譲渡',           en: 'Transferred' },
  stat_disposed:     { ja: '今月処分',           en: 'Disposed' },
  urgent_title:      { ja: '緊急対象の動物',     en: 'Urgent Animals' },
  urgent_sub:        { ja: '処分期限が迫っています。今すぐ確認を', en: 'Deadline approaching. Check now' },
  nearby_heading:    { ja: '📍 近くの迷子・保護情報', en: '📍 Nearby Lost/Found' },
  loading:           { ja: '読み込み中...',       en: 'Loading...' },
  no_fav:            { ja: 'お気に入りはまだありません', en: 'No favorites yet' },
  no_results:        { ja: '該当する動物が見つかりませんでした', en: 'No animals found' },
  filter_active:     { ja: 'フィルター中',        en: 'Filtered' },
  result_all:        { ja: '🐾 全国の子たち',     en: '🐾 All Animals' },
  result_fav:        { ja: '❤️ お気に入り',        en: '❤️ Favorites' },
  theme_label:       { ja: '🎨  テーマカラー',    en: '🎨  Theme Color' },
  lang_label:        { ja: '🌐  言語',            en: '🌐  Language' },
} as const;

export function t(key: keyof typeof T, lang: Lang): string {
  return T[key][lang];
}
