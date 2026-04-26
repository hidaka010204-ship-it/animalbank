import { LinearGradient } from 'expo-linear-gradient';
import { useRouter } from 'expo-router';
import { useEffect, useRef } from 'react';
import { Animated, Dimensions, Easing, Image, PanResponder, StyleSheet, Text, View } from 'react-native';
import { storage, STORAGE_KEYS } from '../lib/storage';

const { width: SW, height: SH } = Dimensions.get('window');

export default function SplashScreen() {
  const router = useRouter();

  // 入場アニメーション値
  const logoOpacity = useRef(new Animated.Value(0)).current;
  const logoScale   = useRef(new Animated.Value(0.82)).current;
  const textOpacity = useRef(new Animated.Value(0)).current;
  const textSlide   = useRef(new Animated.Value(18)).current;
  const dotsOpacity = useRef(new Animated.Value(0)).current;

  // 退場アニメーション値（画面全体を上へスライドアウト）
  const screenY      = useRef(new Animated.Value(0)).current;
  const hasNavigated = useRef(false);

  // PanResponder のクロージャから最新の navigate を参照するための ref
  const doNavigateRef = useRef<() => void>();

  // PanResponder：上スワイプ＋タップを検知
  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder:  (_, gs) => gs.dy < -5,
      onPanResponderMove: (_, gs) => {
        // 上方向にのみ指に追従させる
        if (gs.dy < 0) screenY.setValue(gs.dy);
      },
      onPanResponderRelease: (_, gs) => {
        const isSwipeUp = gs.dy < -60 || gs.vy < -0.4;
        const isTap     = Math.abs(gs.dy) < 10 && Math.abs(gs.dx) < 10;
        if (isSwipeUp || isTap) {
          doNavigateRef.current?.();
        } else {
          // 途中でやめたら元の位置に戻す
          Animated.spring(screenY, { toValue: 0, friction: 8, useNativeDriver: true }).start();
        }
      },
    })
  ).current;

  useEffect(() => {
    // 退場アニメーション＋ルーティング
    doNavigateRef.current = () => {
      if (hasNavigated.current) return;
      hasNavigated.current = true;

      Animated.timing(screenY, {
        toValue: -SH,
        duration: 420,
        easing: Easing.in(Easing.quad),
        useNativeDriver: true,
      }).start(async () => {
        try {
          const onboarded = await storage.getItem(STORAGE_KEYS.ONBOARDED);
          router.replace(onboarded ? '/(tabs)' : '/onboarding');
        } catch {
          router.replace('/(tabs)');
        }
      });
    };

    // 入場アニメーション
    Animated.sequence([
      Animated.parallel([
        Animated.timing(logoOpacity, { toValue: 1, duration: 700, useNativeDriver: true }),
        Animated.spring(logoScale,   { toValue: 1, friction: 6, tension: 60, useNativeDriver: true }),
      ]),
      Animated.parallel([
        Animated.timing(textOpacity, { toValue: 1, duration: 500, useNativeDriver: true }),
        Animated.timing(textSlide,   { toValue: 0, duration: 500, useNativeDriver: true }),
        Animated.timing(dotsOpacity, { toValue: 1, duration: 600, useNativeDriver: true }),
      ]),
    ]).start();

    // 自動遷移（2.4 秒後）
    const timer = setTimeout(() => doNavigateRef.current?.(), 2400);
    return () => clearTimeout(timer);
  }, []);

  return (
    <Animated.View
      style={[styles.wrapper, { transform: [{ translateY: screenY }] }]}
      {...panResponder.panHandlers}
    >
      <LinearGradient
        colors={['#3D8B85', '#4FA3A0', '#A8D8CF', '#C8E8E3']}
        start={{ x: 0.2, y: 0 }}
        end={{ x: 0.8, y: 1 }}
        style={styles.container}
      >
        {/* 背景デコ：大きな半透明サークル */}
        <View style={styles.bgCircle1} />
        <View style={styles.bgCircle2} />

        {/* ── メインコンテンツ ── */}
        <View style={styles.center}>
          {/* ロゴ */}
          <Animated.View style={{ opacity: logoOpacity, transform: [{ scale: logoScale }] }}>
            <View style={styles.logoWrap}>
              <Image
                source={require('../assets/images/logo.png')}
                style={styles.logo}
                resizeMode="contain"
              />
            </View>
          </Animated.View>

          {/* テキスト */}
          <Animated.View
            style={{
              opacity: textOpacity,
              transform: [{ translateY: textSlide }],
              alignItems: 'center',
            }}
          >
            <Text style={styles.appName}>あにまるバンク</Text>
            <View style={styles.taglineWrap}>
              <Text style={styles.tagline}>繋ぐ、守る、愛でる。</Text>
            </View>
          </Animated.View>
        </View>

        {/* ローディングドット */}
        <Animated.View style={[styles.loadingRow, { opacity: dotsOpacity }]}>
          {[0, 1, 2].map(i => (
            <View key={i} style={[styles.loadingDot, i === 1 && styles.loadingDotMid]} />
          ))}
        </Animated.View>
      </LinearGradient>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  wrapper:    { flex: 1 },
  container:  { flex: 1, alignItems: 'center', justifyContent: 'center' },

  // 背景デコ
  bgCircle1: {
    position: 'absolute', width: SW * 1.2, height: SW * 1.2, borderRadius: SW * 0.6,
    backgroundColor: 'rgba(255,255,255,0.07)', top: -SW * 0.4, right: -SW * 0.3,
  },
  bgCircle2: {
    position: 'absolute', width: SW * 0.8, height: SW * 0.8, borderRadius: SW * 0.4,
    backgroundColor: 'rgba(255,255,255,0.06)', bottom: -SW * 0.2, left: -SW * 0.2,
  },

  // メインコンテンツ
  center: { alignItems: 'center', gap: 28 },

  logoWrap: {
    width: 140, height: 140, borderRadius: 36,
    backgroundColor: 'white',
    alignItems: 'center', justifyContent: 'center',
    shadowColor: '#1a4a47', shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 0.22, shadowRadius: 24, elevation: 12,
  },
  logo: { width: 110, height: 110, borderRadius: 24 },

  appName: {
    fontSize: 36, fontWeight: '900', color: 'white',
    letterSpacing: 1,
    textShadowColor: 'rgba(0,0,0,0.15)',
    textShadowOffset: { width: 0, height: 2 },
    textShadowRadius: 6,
  },
  taglineWrap: {
    marginTop: 8,
    backgroundColor: 'rgba(255,255,255,0.18)',
    paddingHorizontal: 18, paddingVertical: 6, borderRadius: 999,
  },
  tagline: { fontSize: 15, color: 'rgba(255,255,255,0.92)', fontWeight: '600', letterSpacing: 0.5 },

  // ローディングドット
  loadingRow: { position: 'absolute', bottom: 60, flexDirection: 'row', gap: 8, alignItems: 'center' },
  loadingDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: 'rgba(255,255,255,0.5)' },
  loadingDotMid: { width: 10, height: 10, borderRadius: 5, backgroundColor: 'rgba(255,255,255,0.85)' },
});
