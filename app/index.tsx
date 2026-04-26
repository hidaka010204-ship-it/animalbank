import { Redirect } from 'expo-router';

// アプリ起動の初期ルートをスプラッシュ画面に向ける
export default function Index() {
  return <Redirect href="/splash" />;
}
