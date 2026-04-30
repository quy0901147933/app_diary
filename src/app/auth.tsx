import { useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Svg, { Path } from 'react-native-svg';
import { supabase } from '@/services/supabase';
import { signInWithGoogle } from '@/services/google-auth';
import { colors, radius, shadow, spacing, typography } from '@/theme';

export default function AuthScreen() {
  const insets = useSafeAreaInsets();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [mode, setMode] = useState<'signin' | 'signup'>('signin');
  const [loading, setLoading] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);

  const busy = loading || googleLoading;

  async function submit() {
    setLoading(true);
    try {
      const fn =
        mode === 'signin'
          ? supabase.auth.signInWithPassword
          : supabase.auth.signUp;
      const { error } = await fn.call(supabase.auth, { email, password });
      if (error) throw error;
    } catch (e) {
      Alert.alert('Có lỗi', e instanceof Error ? e.message : 'Vui lòng thử lại.');
    } finally {
      setLoading(false);
    }
  }

  async function handleGoogle() {
    setGoogleLoading(true);
    try {
      await signInWithGoogle();
    } catch (e) {
      const message = e instanceof Error ? e.message : 'Vui lòng thử lại.';
      if (message === 'cancelled') return;
      Alert.alert('Đăng nhập Google thất bại', message);
    } finally {
      setGoogleLoading(false);
    }
  }

  return (
    <View style={[styles.safe, { paddingTop: insets.top, paddingBottom: insets.bottom }]}>
      <View style={styles.card}>
        <Text style={styles.title}>
          {mode === 'signin' ? 'Chào mừng trở lại' : 'Tạo nhật ký mới'}
        </Text>
        <Text style={styles.subtitle}>
          Lumina sẽ ngắm cùng bạn từng khoảnh khắc.
        </Text>

        <Pressable
          style={({ pressed }) => [
            styles.googleBtn,
            pressed && !busy && styles.googleBtnPressed,
            busy && styles.googleBtnDisabled,
          ]}
          onPress={handleGoogle}
          disabled={busy}
        >
          {googleLoading ? (
            <ActivityIndicator color={colors.textPrimary} />
          ) : (
            <>
              <GoogleGlyph />
              <Text style={styles.googleLabel}>Tiếp tục với Google</Text>
            </>
          )}
        </Pressable>

        <View style={styles.dividerRow}>
          <View style={styles.dividerLine} />
          <Text style={styles.dividerText}>hoặc</Text>
          <View style={styles.dividerLine} />
        </View>

        <TextInput
          style={styles.input}
          placeholder="email@domain.com"
          placeholderTextColor={colors.textMuted}
          value={email}
          onChangeText={setEmail}
          autoCapitalize="none"
          keyboardType="email-address"
          editable={!busy}
        />
        <TextInput
          style={styles.input}
          placeholder="Mật khẩu"
          placeholderTextColor={colors.textMuted}
          value={password}
          onChangeText={setPassword}
          secureTextEntry
          editable={!busy}
        />

        <Pressable
          style={({ pressed }) => [
            styles.cta,
            pressed && !busy && styles.ctaPressed,
            busy && styles.ctaDisabled,
          ]}
          onPress={submit}
          disabled={busy}
        >
          {loading ? (
            <ActivityIndicator color={colors.textInverse} />
          ) : (
            <Text style={styles.ctaLabel}>
              {mode === 'signin' ? 'Đăng nhập' : 'Đăng ký'}
            </Text>
          )}
        </Pressable>

        <Pressable
          onPress={() => setMode((m) => (m === 'signin' ? 'signup' : 'signin'))}
          disabled={busy}
        >
          <Text style={styles.switch}>
            {mode === 'signin' ? 'Chưa có tài khoản? Đăng ký' : 'Đã có tài khoản? Đăng nhập'}
          </Text>
        </Pressable>
      </View>
    </View>
  );
}

function GoogleGlyph() {
  return (
    <Svg width={18} height={18} viewBox="0 0 18 18">
      <Path
        d="M17.64 9.2c0-.64-.06-1.25-.16-1.84H9v3.48h4.84a4.14 4.14 0 0 1-1.8 2.72v2.26h2.92c1.7-1.57 2.68-3.88 2.68-6.62z"
        fill="#4285F4"
      />
      <Path
        d="M9 18c2.43 0 4.47-.81 5.96-2.18l-2.92-2.26c-.81.54-1.85.86-3.04.86-2.34 0-4.32-1.58-5.03-3.7H.92v2.32A9 9 0 0 0 9 18z"
        fill="#34A853"
      />
      <Path
        d="M3.97 10.72A5.41 5.41 0 0 1 3.68 9c0-.6.1-1.18.29-1.72V4.96H.92A9 9 0 0 0 0 9c0 1.45.35 2.82.92 4.04l3.05-2.32z"
        fill="#FBBC05"
      />
      <Path
        d="M9 3.58c1.32 0 2.5.45 3.44 1.35l2.58-2.58C13.46.89 11.43 0 9 0A9 9 0 0 0 .92 4.96l3.05 2.32C4.68 5.16 6.66 3.58 9 3.58z"
        fill="#EA4335"
      />
    </Svg>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.background, justifyContent: 'center' },
  card: {
    margin: spacing.lg,
    padding: spacing.xl,
    backgroundColor: colors.surface,
    borderRadius: radius.xxl,
    ...shadow.card,
  },
  title: { ...typography.display, fontSize: 28, color: colors.textPrimary },
  subtitle: {
    ...typography.bodySm,
    color: colors.textSecondary,
    marginTop: spacing.sm,
    marginBottom: spacing.xl,
  },

  googleBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    minHeight: 52,
    paddingHorizontal: spacing.lg,
    backgroundColor: colors.surface,
    borderRadius: radius.full,
    borderWidth: 1,
    borderColor: colors.border,
  },
  googleBtnPressed: { backgroundColor: colors.surfaceAlt },
  googleBtnDisabled: { opacity: 0.6 },
  googleLabel: {
    ...typography.bodySm,
    fontFamily: 'Inter_600SemiBold',
    color: colors.textPrimary,
  },

  dividerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    marginVertical: spacing.lg,
  },
  dividerLine: { flex: 1, height: 1, backgroundColor: colors.border },
  dividerText: { ...typography.caption, color: colors.textMuted },

  input: {
    ...typography.body,
    color: colors.textPrimary,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.lg,
    borderRadius: radius.lg,
    backgroundColor: colors.surfaceAlt,
    marginBottom: spacing.md,
  },
  cta: {
    minHeight: 52,
    paddingVertical: spacing.md,
    backgroundColor: colors.accent,
    borderRadius: radius.full,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: spacing.sm,
  },
  ctaPressed: { backgroundColor: '#B89358' },
  ctaDisabled: { opacity: 0.7 },
  ctaLabel: { ...typography.bodySm, fontWeight: '600', color: colors.textInverse },
  switch: {
    ...typography.caption,
    color: colors.textSecondary,
    textAlign: 'center',
    marginTop: spacing.lg,
  },
});
