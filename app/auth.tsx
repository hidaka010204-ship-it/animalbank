import * as Linking from 'expo-linking';
import { LinearGradient } from 'expo-linear-gradient';
import { useRouter } from 'expo-router';
import * as WebBrowser from 'expo-web-browser';
import { useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Image,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { supabase } from '../lib/supabase';

WebBrowser.maybeCompleteAuthSession();

export default function AuthScreen() {
  const router = useRouter();

  // Google ログイン
  const [googleLoading, setGoogleLoading] = useState(false);

  // メール・パスワード
  const [mode, setMode] = useState<'signin' | 'signup'>('signin');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [emailLoading, setEmailLoading] = useState(false);
  const [error, setError] = useState('');
  const [signupDone, setSignupDone] = useState(false);

  /* ── Google OAuth ── */
  const signInWithGoogle = async () => {
    setGoogleLoading(true);
    try {
      const redirectUrl = Linking.createURL('/');
      const { data, error: oauthError } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: { redirectTo: redirectUrl, skipBrowserRedirect: true },
      });
      if (oauthError || !data.url) {
        Alert.alert('ログインエラー', oauthError?.message ?? 'URLの取得に失敗しました');
        return;
      }
      const result = await WebBrowser.openAuthSessionAsync(data.url, redirectUrl);
      if (result.type === 'success') {
        await supabase.auth.getSession();
        router.replace('/(tabs)');
      }
    } catch (e: any) {
      Alert.alert('ログインエラー', e?.message ?? 'Googleログインに失敗しました');
    } finally {
      setGoogleLoading(false);
    }
  };

  /* ── メール・パスワード ── */
  const submitEmail = async () => {
    setError('');
    if (!email.trim() || !password.trim()) {
      setError('メールアドレスとパスワードを入力してください');
      return;
    }
    if (password.length < 6) {
      setError('パスワードは6文字以上で入力してください');
      return;
    }
    setEmailLoading(true);
    if (mode === 'signin') {
      const { error: authError } = await supabase.auth.signInWithPassword({
        email: email.trim(), password,
      });
      setEmailLoading(false);
      if (authError) {
        setError('メールアドレスまたはパスワードが正しくありません');
      } else {
        router.replace('/(tabs)');
      }
    } else {
      const { error: authError } = await supabase.auth.signUp({
        email: email.trim(), password,
      });
      setEmailLoading(false);
      if (authError) {
        setError(authError.message);
      } else {
        setSignupDone(true);
      }
    }
  };

  /* ── ゲスト ── */
  const continueAsGuest = () => router.replace('/(tabs)');

  return (
    <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScrollView
        style={styles.flex}
        contentContainerStyle={styles.scrollContent}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        {/* ── ヒーロー ── */}
        <LinearGradient
          colors={['#3D8B85', '#4FA3A0', '#A8D8CF']}
          start={{ x: 0.2, y: 0 }}
          end={{ x: 0.8, y: 1 }}
          style={styles.hero}
        >
          <View style={styles.heroBgCircle1} />
          <View style={styles.heroBgCircle2} />

          <TouchableOpacity style={styles.backBtn} onPress={() => router.back()}>
            <Text style={styles.backBtnText}>← 戻る</Text>
          </TouchableOpacity>

          <View style={styles.heroInner}>
            <View style={styles.logoWrap}>
              <Image
                source={require('../assets/images/logo.png')}
                style={styles.logo}
                resizeMode="contain"
              />
            </View>
            <Text style={styles.appName}>あにまるバンク</Text>
            <View style={styles.taglineWrap}>
              <Text style={styles.tagline}>繋ぐ、守る、愛でる。</Text>
            </View>
          </View>
        </LinearGradient>

        {/* ── カード ── */}
        <View style={styles.card}>

          {/* ① Googleログイン */}
          <Text style={styles.sectionLabel}>SNSでログイン</Text>
          <TouchableOpacity
            style={styles.googleBtn}
            onPress={signInWithGoogle}
            disabled={googleLoading}
            activeOpacity={0.85}
          >
            {googleLoading ? (
              <ActivityIndicator color="#555" />
            ) : (
              <>
                <View style={styles.googleIconWrap}>
                  <Text style={styles.googleIconText}>G</Text>
                </View>
                <Text style={styles.googleBtnText}>Googleでログイン</Text>
              </>
            )}
          </TouchableOpacity>

          {/* 区切り */}
          <View style={styles.dividerRow}>
            <View style={styles.divider} />
            <Text style={styles.dividerText}>メールアドレスでログイン</Text>
            <View style={styles.divider} />
          </View>

          {/* ② メール・パスワード */}
          {signupDone ? (
            <View style={styles.signupDone}>
              <Text style={styles.signupDoneEmoji}>📧</Text>
              <Text style={styles.signupDoneText}>
                確認メールを送信しました。{'\n'}
                メール内のリンクをクリックして{'\n'}
                アカウントを有効化してください。
              </Text>
              <TouchableOpacity
                style={styles.emailBtn}
                onPress={() => { setSignupDone(false); setMode('signin'); }}
              >
                <Text style={styles.emailBtnText}>ログイン画面へ</Text>
              </TouchableOpacity>
            </View>
          ) : (
            <>
              <View style={styles.modeToggleRow}>
                {(['signin', 'signup'] as const).map(m => (
                  <TouchableOpacity
                    key={m}
                    style={[styles.modeTab, mode === m && styles.modeTabActive]}
                    onPress={() => { setMode(m); setError(''); }}
                  >
                    <Text style={[styles.modeTabText, mode === m && styles.modeTabTextActive]}>
                      {m === 'signin' ? 'ログイン' : '新規登録'}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>

              {!!error && (
                <View style={styles.errorBox}>
                  <Text style={styles.errorText}>{error}</Text>
                </View>
              )}

              <Text style={styles.inputLabel}>メールアドレス</Text>
              <TextInput
                style={styles.input}
                value={email}
                onChangeText={t => { setEmail(t); setError(''); }}
                placeholder="example@shelter.jp"
                placeholderTextColor="#bbb"
                keyboardType="email-address"
                autoCapitalize="none"
                autoCorrect={false}
              />

              <Text style={styles.inputLabel}>
                パスワード{mode === 'signup' ? '（6文字以上）' : ''}
              </Text>
              <TextInput
                style={styles.input}
                value={password}
                onChangeText={t => { setPassword(t); setError(''); }}
                placeholder="••••••••"
                placeholderTextColor="#bbb"
                secureTextEntry
              />

              <TouchableOpacity
                style={styles.emailBtn}
                onPress={submitEmail}
                disabled={emailLoading}
                activeOpacity={0.85}
              >
                {emailLoading ? (
                  <ActivityIndicator color="white" />
                ) : (
                  <Text style={styles.emailBtnText}>
                    {mode === 'signin' ? 'ログイン' : '登録する'}
                  </Text>
                )}
              </TouchableOpacity>
            </>
          )}

          {/* 区切り */}
          <View style={styles.dividerRow}>
            <View style={styles.divider} />
            <Text style={styles.dividerText}>または</Text>
            <View style={styles.divider} />
          </View>

          {/* ③ ゲストで続ける */}
          <TouchableOpacity
            style={styles.guestBtn}
            onPress={continueAsGuest}
            activeOpacity={0.85}
          >
            <Text style={styles.guestBtnText}>ゲストで続ける</Text>
          </TouchableOpacity>
          <Text style={styles.guestNote}>ゲストの場合、閲覧のみ可能です</Text>

        </View>

        <View style={{ height: 40 }} />
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1, backgroundColor: '#C8E8E3' },
  scrollContent: { flexGrow: 1 },

  // ── ヒーロー ──
  hero: {
    paddingTop: 60, paddingBottom: 40, paddingHorizontal: 24,
    overflow: 'hidden',
  },
  heroBgCircle1: {
    position: 'absolute', width: 300, height: 300, borderRadius: 150,
    backgroundColor: 'rgba(255,255,255,0.07)', top: -80, right: -70,
  },
  heroBgCircle2: {
    position: 'absolute', width: 180, height: 180, borderRadius: 90,
    backgroundColor: 'rgba(255,255,255,0.06)', bottom: -40, left: -40,
  },
  backBtn: {
    alignSelf: 'flex-start', marginBottom: 24,
    backgroundColor: 'rgba(255,255,255,0.2)',
    paddingHorizontal: 14, paddingVertical: 7, borderRadius: 999,
  },
  backBtnText: { color: 'rgba(255,255,255,0.9)', fontSize: 13, fontWeight: '600' },
  heroInner: { alignItems: 'center', gap: 12 },
  logoWrap: {
    width: 110, height: 110, borderRadius: 30,
    backgroundColor: 'white',
    alignItems: 'center', justifyContent: 'center',
    shadowColor: '#1a4a47', shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.2, shadowRadius: 20, elevation: 10,
  },
  logo: { width: 88, height: 88, borderRadius: 20 },
  appName: {
    fontSize: 28, fontWeight: '900', color: 'white', letterSpacing: 0.8,
    textShadowColor: 'rgba(0,0,0,0.12)', textShadowOffset: { width: 0, height: 2 }, textShadowRadius: 4,
  },
  taglineWrap: {
    backgroundColor: 'rgba(255,255,255,0.18)',
    paddingHorizontal: 14, paddingVertical: 5, borderRadius: 999,
  },
  tagline: { fontSize: 13, color: 'rgba(255,255,255,0.9)', fontWeight: '600' },

  // ── カード ──
  card: {
    backgroundColor: 'white',
    margin: 16, borderRadius: 28, padding: 24,
    shadowColor: '#000', shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.08, shadowRadius: 16, elevation: 4,
    gap: 14,
  },

  sectionLabel: {
    fontSize: 11, fontWeight: '800', color: '#aaa',
    letterSpacing: 1, textAlign: 'center',
  },

  // Googleボタン
  googleBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    borderRadius: 16, paddingVertical: 14, gap: 10,
    borderWidth: 1.5, borderColor: '#E5E7EB', backgroundColor: 'white',
    shadowColor: '#000', shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06, shadowRadius: 8, elevation: 2,
  },
  googleIconWrap: {
    width: 28, height: 28, borderRadius: 14,
    backgroundColor: '#EEF4FF',
    alignItems: 'center', justifyContent: 'center',
  },
  googleIconText: { fontSize: 15, fontWeight: '900', color: '#4285F4' },
  googleBtnText: { fontSize: 15, fontWeight: '700', color: '#333' },

  // 区切り線
  dividerRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  divider: { flex: 1, height: 1, backgroundColor: '#F0EDE8' },
  dividerText: { fontSize: 11, color: '#bbb', fontWeight: '500' },

  // モード切替タブ
  modeToggleRow: {
    flexDirection: 'row', backgroundColor: '#F5F5F5', borderRadius: 14,
    padding: 3, gap: 0,
  },
  modeTab: {
    flex: 1, paddingVertical: 9, borderRadius: 11, alignItems: 'center',
  },
  modeTabActive: { backgroundColor: 'white', shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.08, shadowRadius: 4, elevation: 2 },
  modeTabText: { fontSize: 13, color: '#aaa', fontWeight: '600' },
  modeTabTextActive: { color: '#1a1a1a', fontWeight: '800' },

  // エラー
  errorBox: {
    backgroundColor: '#FEF2F2', borderRadius: 10, padding: 12,
    borderWidth: 1, borderColor: '#FECACA',
  },
  errorText: { fontSize: 13, color: '#B91C1C' },

  // 入力フォーム
  inputLabel: { fontSize: 12, fontWeight: '700', color: '#555', marginBottom: -6 },
  input: {
    borderWidth: 1.5, borderColor: '#E5E7EB', borderRadius: 14,
    padding: 13, fontSize: 15, color: '#1a1a1a',
    backgroundColor: '#FAFAFA',
  },

  // メール認証ボタン（#F08080）
  emailBtn: {
    backgroundColor: '#F08080', borderRadius: 16,
    paddingVertical: 14, alignItems: 'center',
    shadowColor: '#F08080', shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25, shadowRadius: 10, elevation: 3,
  },
  emailBtnText: { color: 'white', fontSize: 15, fontWeight: '800' },

  // 登録完了
  signupDone: { alignItems: 'center', gap: 10, paddingVertical: 4 },
  signupDoneEmoji: { fontSize: 44 },
  signupDoneText: { fontSize: 14, color: '#555', textAlign: 'center', lineHeight: 22 },

  // ゲストボタン（#A8D8CF）
  guestBtn: {
    backgroundColor: '#E8F5F3', borderRadius: 16,
    paddingVertical: 13, alignItems: 'center',
    borderWidth: 1.5, borderColor: '#A8D8CF',
  },
  guestBtnText: { fontSize: 15, fontWeight: '700', color: '#4FA3A0' },
  guestNote: { fontSize: 11, color: '#bbb', textAlign: 'center', marginTop: -6 },
});
