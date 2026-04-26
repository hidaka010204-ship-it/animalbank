import { supabase } from '../lib/supabase';
import { useEffect, useState } from 'react';
import { ActivityIndicator, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';

type FetchState = 'idle' | 'loading' | 'success' | 'error';

export default function SupabaseTestScreen() {
  const [state, setState] = useState<FetchState>('idle');
  const [data, setData] = useState<any[]>([]);
  const [error, setError] = useState<string>('');
  const [count, setCount] = useState<number | null>(null);

  const fetchAnimals = async () => {
    setState('loading');
    setError('');
    setData([]);

    const { data: rows, error: err, count: total } = await supabase
      .from('animals')
      .select('*', { count: 'exact' })
      .limit(5);

    if (err) {
      setError(err.message);
      setState('error');
    } else {
      setData(rows ?? []);
      setCount(total ?? 0);
      setState('success');
    }
  };

  useEffect(() => {
    fetchAnimals();
  }, []);

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <Text style={styles.title}>Supabase 接続テスト</Text>
      <Text style={styles.subtitle}>テーブル: animals</Text>

      {state === 'loading' && (
        <View style={styles.center}>
          <ActivityIndicator size="large" color="#22B484" />
          <Text style={styles.loadingText}>取得中...</Text>
        </View>
      )}

      {state === 'error' && (
        <View style={styles.errorBox}>
          <Text style={styles.errorTitle}>エラー</Text>
          <Text style={styles.errorMsg}>{error}</Text>
          <TouchableOpacity style={styles.retryBtn} onPress={fetchAnimals}>
            <Text style={styles.retryTxt}>再試行</Text>
          </TouchableOpacity>
        </View>
      )}

      {state === 'success' && (
        <>
          <View style={styles.successBox}>
            <Text style={styles.successText}>接続成功</Text>
            <Text style={styles.countText}>総件数: {count} 件 / 先頭5件を表示</Text>
          </View>

          {data.length === 0 ? (
            <Text style={styles.emptyText}>テーブルにデータがありません</Text>
          ) : (
            data.map((row, i) => (
              <View key={row.id ?? i} style={styles.row}>
                <Text style={styles.rowId}>ID: {row.id}</Text>
                {Object.entries(row).filter(([k]) => k !== 'id').map(([key, val]) => (
                  <Text key={key} style={styles.rowField}>
                    <Text style={styles.rowKey}>{key}: </Text>
                    {String(val ?? '—')}
                  </Text>
                ))}
              </View>
            ))
          )}

          <TouchableOpacity style={styles.retryBtn} onPress={fetchAnimals}>
            <Text style={styles.retryTxt}>再取得</Text>
          </TouchableOpacity>
        </>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F4FAF7' },
  content: { padding: 20, paddingTop: 60 },
  title: { fontSize: 22, fontWeight: '800', color: '#1a1a1a', marginBottom: 4 },
  subtitle: { fontSize: 14, color: '#888', marginBottom: 24 },
  center: { alignItems: 'center', marginTop: 40, gap: 12 },
  loadingText: { fontSize: 14, color: '#888' },
  errorBox: { backgroundColor: '#FCEBEB', borderRadius: 14, padding: 16, gap: 8 },
  errorTitle: { fontSize: 16, fontWeight: '700', color: '#A32D2D' },
  errorMsg: { fontSize: 13, color: '#7a2020', fontFamily: 'monospace' },
  successBox: { backgroundColor: '#E6F9F2', borderRadius: 14, padding: 14, marginBottom: 16 },
  successText: { fontSize: 16, fontWeight: '700', color: '#0F6E56' },
  countText: { fontSize: 13, color: '#0F6E56', marginTop: 4 },
  emptyText: { fontSize: 14, color: '#aaa', textAlign: 'center', marginTop: 20 },
  row: { backgroundColor: 'white', borderRadius: 12, padding: 14, marginBottom: 10, shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.06, shadowRadius: 4, elevation: 1 },
  rowId: { fontSize: 12, fontWeight: '700', color: '#22B484', marginBottom: 6 },
  rowField: { fontSize: 12, color: '#444', lineHeight: 18 },
  rowKey: { fontWeight: '600', color: '#888' },
  retryBtn: { marginTop: 16, backgroundColor: '#22B484', borderRadius: 12, padding: 12, alignItems: 'center' },
  retryTxt: { color: 'white', fontWeight: '700', fontSize: 14 },
});
