// ストア掲載用スクリーンショットを撮るための見本データ。
// EXPO_PUBLIC_DEMO_DATA=1 でビルドしたときだけ使う。実在の動物ではない。

function daysFromToday(days: number): string {
  const jst = new Date(Date.now() + 9 * 60 * 60 * 1000 + days * 24 * 60 * 60 * 1000);
  const y = jst.getUTCFullYear();
  const m = String(jst.getUTCMonth() + 1).padStart(2, '0');
  const d = String(jst.getUTCDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

export function getDemoAnimalRows(): Record<string, unknown>[] {
  return [
    { id: 'demo-1', name: 'こむぎ', species: 'dog', breed: 'ミニチュアダックスフンド', gender: 'female',
      description: '人が大好きで、なでると目を細めます。散歩も上手です。',
      is_urgent: false, deadline: daysFromToday(2), admitted_at: daysFromToday(-12), status: 'available',
      shelter: '中央動物愛護センター', prefecture: '東京都', city: '世田谷区', source: 'shelter', images: [] },
    { id: 'demo-2', name: 'ミケ', species: 'cat', breed: '三毛猫（ミックス）', gender: 'female',
      description: 'おっとりした性格。ほかの猫とも仲良くできます。',
      is_urgent: true, deadline: daysFromToday(3), admitted_at: daysFromToday(-20), status: 'available',
      shelter: '動物愛護相談センター', prefecture: '神奈川県', city: '平塚市', source: 'shelter', images: [] },
    { id: 'demo-3', name: 'レオ', species: 'dog', breed: 'ゴールデンレトリバー', gender: 'male',
      description: '穏やかで落ち着いた大型犬。子どもにもやさしい子です。',
      is_urgent: false, deadline: daysFromToday(21), admitted_at: daysFromToday(-9), status: 'available',
      shelter: '動物愛護センター', prefecture: '埼玉県', city: '熊谷市', source: 'shelter', images: [] },
    { id: 'demo-4', name: 'そら', species: 'cat', breed: 'キジトラ（ミックス）', gender: 'male',
      description: '好奇心旺盛な若い男の子。おもちゃ遊びが大好き。',
      is_urgent: false, deadline: daysFromToday(30), admitted_at: daysFromToday(-3), status: 'available',
      shelter: '動物愛護センター', prefecture: '千葉県', city: '富里市', source: 'shelter', images: [] },
    { id: 'demo-5', name: 'さくら', species: 'dog', breed: 'トイプードル', gender: 'female',
      description: '小柄で甘えん坊。抱っこされるのが好きです。',
      is_urgent: false, deadline: daysFromToday(25), admitted_at: daysFromToday(-15), status: 'fostering',
      shelter: '動物愛護管理センター', prefecture: '大阪府', city: '羽曳野市', source: 'shelter', images: [] },
    { id: 'demo-6', name: 'はな', species: 'dog', breed: 'ビーグル', gender: 'female',
      description: '食いしん坊で元気いっぱい。においをかぐのが得意です。',
      is_urgent: false, deadline: daysFromToday(1), admitted_at: daysFromToday(-25), status: 'available',
      shelter: '動物管理センター', prefecture: '愛知県', city: '名古屋市', source: 'shelter', images: [] },
    { id: 'demo-7', name: 'くろ', species: 'cat', breed: '黒猫（ミックス）', gender: 'male',
      description: '最初は慎重ですが、慣れるとひざに乗ってきます。',
      is_urgent: false, deadline: daysFromToday(18), admitted_at: daysFromToday(-40), status: 'available',
      shelter: '動物愛護センター', prefecture: '福岡県', city: '福岡市', source: 'shelter', images: [] },
    { id: 'demo-8', name: 'チョコ', species: 'rabbit', breed: 'ネザーランドドワーフ', gender: 'female',
      description: 'おとなしく、ケージにも慣れています。',
      is_urgent: false, deadline: daysFromToday(28), admitted_at: daysFromToday(-6), status: 'available',
      shelter: '動物愛護センター', prefecture: '北海道', city: '札幌市', source: 'shelter', images: [] },
  ];
}

function hoursAgo(hours: number): string {
  return new Date(Date.now() - hours * 60 * 60 * 1000).toISOString();
}

// タイムライン・近くの迷子/保護情報の見本投稿。実在の投稿ではない。
export function getDemoPostRows(): Record<string, unknown>[] {
  return [
    { id: 'demo-post-1', type: 'lost', content: '茶色の柴犬（オス・5歳）を探しています。赤い首輪をしています。見かけた方はご連絡ください。',
      location_prefecture: '東京都', location_city: '世田谷区', user_nickname: 'ゆうき', user_avatar: '🐕',
      user_id: null, images: [], created_at: hoursAgo(2), lat: null, lng: null },
    { id: 'demo-post-2', type: 'found', content: '公園の近くで白い子猫を保護しました。人なつっこい子です。飼い主さんを探しています。',
      location_prefecture: '神奈川県', location_city: '横浜市', user_nickname: 'はるか', user_avatar: '🐈',
      user_id: null, images: [], created_at: hoursAgo(5), lat: null, lng: null },
    { id: 'demo-post-3', type: 'pet', content: '保健所から迎えた子が、今日で家族になって1年です。すっかり甘えん坊になりました。',
      location_prefecture: '埼玉県', location_city: 'さいたま市', user_nickname: 'みどり', user_avatar: '🌿',
      user_id: null, images: [], created_at: hoursAgo(9), lat: null, lng: null },
    { id: 'demo-post-4', type: 'lost', content: '黒猫（メス）が家から出てしまいました。しっぽが短めです。',
      location_prefecture: '千葉県', location_city: '船橋市', user_nickname: 'けんた', user_avatar: '🏠',
      user_id: null, images: [], created_at: hoursAgo(20), lat: null, lng: null },
    { id: 'demo-post-5', type: 'other', content: '今週末、市内で譲渡会があります。気になる子がいたら会いに来てください。',
      location_prefecture: '大阪府', location_city: '大阪市', user_nickname: 'さとみ', user_avatar: '🐾',
      user_id: null, images: [], created_at: hoursAgo(30), lat: null, lng: null },
  ];
}
