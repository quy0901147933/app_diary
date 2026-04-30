import { useEffect, useState } from 'react';
import {
  Alert,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useRouter } from 'expo-router';
import * as ImagePicker from 'expo-image-picker';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Avatar } from '@/components/avatar';
import { AvatarPickerSheet } from '@/components/avatar-picker-sheet';
import { useProfile, useSaveProfile } from '@/hooks/use-profile';
import { useUserPersona, useSavePersona } from '@/hooks/use-persona';
import { useAuthStore } from '@/stores/auth-store';
import { supabase } from '@/services/supabase';
import { colors, radius, spacing, typography } from '@/theme';

const AVATARS_BUCKET = 'avatars';

export default function SettingsScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const userId = useAuthStore((s) => s.session?.user.id);
  const profile = useProfile(userId).data;
  const persona = useUserPersona(userId).data;
  const saveProfile = useSaveProfile(userId);
  const savePersona = useSavePersona(userId);

  const [displayName, setDisplayName] = useState<string | null>(null);
  const [aiName, setAiName] = useState<string | null>(null);
  const [pickerOpen, setPickerOpen] = useState<null | 'ai' | 'user'>(null);

  useEffect(() => {
    if (displayName === null && profile?.display_name != null) {
      setDisplayName(profile.display_name);
    }
  }, [displayName, profile?.display_name]);
  useEffect(() => {
    if (aiName === null && persona?.ai_name != null) {
      setAiName(persona.ai_name);
    }
  }, [aiName, persona?.ai_name]);

  async function pickPhotoFromLibrary(): Promise<{ uri: string; mime: string } | null> {
    const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!perm.granted) {
      Alert.alert('Cần quyền truy cập thư viện ảnh');
      return null;
    }
    const r = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.8,
    });
    if (r.canceled) return null;
    const asset = r.assets[0]!;
    return { uri: asset.uri, mime: asset.mimeType ?? 'image/jpeg' };
  }

  async function uploadAvatar(uri: string, mime: string, prefix: 'user' | 'ai'): Promise<string> {
    if (!userId) throw new Error('Chưa đăng nhập.');
    const path = `${userId}/${prefix}-avatar-${Date.now()}.jpg`;
    const arrayBuffer = await fetch(uri).then((res) => res.arrayBuffer());
    const { error: upErr } = await supabase.storage
      .from(AVATARS_BUCKET)
      .upload(path, arrayBuffer, { contentType: mime, upsert: true });
    if (upErr) throw upErr;
    const { data: pub } = supabase.storage.from(AVATARS_BUCKET).getPublicUrl(path);
    return pub.publicUrl;
  }

  async function pickUserPhoto() {
    const file = await pickPhotoFromLibrary();
    if (!file) return;
    try {
      const url = await uploadAvatar(file.uri, file.mime, 'user');
      await saveProfile.mutateAsync({ avatar_url: url, avatar_key: null });
      setPickerOpen(null);
    } catch (e) {
      Alert.alert('Không tải lên được', e instanceof Error ? e.message : 'Thử lại nhé.');
    }
  }

  async function pickAiPhoto() {
    const file = await pickPhotoFromLibrary();
    if (!file) return;
    try {
      const url = await uploadAvatar(file.uri, file.mime, 'ai');
      await savePersona.mutateAsync({ ai_avatar_url: url, ai_avatar_key: null });
      setPickerOpen(null);
    } catch (e) {
      Alert.alert('Không tải lên được', e instanceof Error ? e.message : 'Thử lại nhé.');
    }
  }

  async function pickUserPreset(key: string) {
    await saveProfile.mutateAsync({ avatar_key: key, avatar_url: null });
    setPickerOpen(null);
  }

  async function pickAiPreset(key: string) {
    await savePersona.mutateAsync({ ai_avatar_key: key, ai_avatar_url: null });
    setPickerOpen(null);
  }

  async function saveNames() {
    try {
      const tasks: Promise<unknown>[] = [];
      const displayValue = (displayName ?? '').trim();
      const aiValue = (aiName ?? '').trim();
      if (displayName !== null && displayValue !== (profile?.display_name ?? '')) {
        tasks.push(saveProfile.mutateAsync({ display_name: displayValue || null }));
      }
      if (aiName !== null && aiValue !== (persona?.ai_name ?? '')) {
        tasks.push(savePersona.mutateAsync({ ai_name: aiValue || null }));
      }
      await Promise.all(tasks);
      Alert.alert('Đã lưu', 'Cài đặt đã được cập nhật.');
    } catch (e) {
      Alert.alert('Lỗi', e instanceof Error ? e.message : 'Thử lại nhé.');
    }
  }

  async function logout() {
    Alert.alert('Đăng xuất?', 'Bạn sẽ cần đăng nhập lại.', [
      { text: 'Huỷ', style: 'cancel' },
      {
        text: 'Đăng xuất',
        style: 'destructive',
        onPress: async () => {
          await supabase.auth.signOut();
          router.replace('/auth');
        },
      },
    ]);
  }

  return (
    <View style={[styles.safe, { paddingTop: insets.top }]}>
      <View style={styles.header}>
        <Pressable onPress={() => router.back()} hitSlop={12} accessibilityLabel="Quay lại">
          <Ionicons name="chevron-back" size={26} color={colors.textPrimary} />
        </Pressable>
        <Text style={styles.headerTitle}>Cài đặt</Text>
        <Pressable
          onPress={saveNames}
          disabled={saveProfile.isPending || savePersona.isPending}
          style={styles.saveBtn}
        >
          <Text style={styles.saveLabel}>LƯU</Text>
        </Pressable>
      </View>

      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      >
        <ScrollView
          contentContainerStyle={styles.scroll}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          {/* User */}
          <Text style={styles.sectionTitle}>Hồ sơ của bạn</Text>
          <Pressable style={styles.avatarRow} onPress={() => setPickerOpen('user')}>
            <Avatar
              size={72}
              url={profile?.avatar_url}
              presetKey={profile?.avatar_key}
              kind="user"
            />
            <View style={{ flex: 1 }}>
              <Text style={styles.avatarLabel}>Avatar của bạn</Text>
              <Text style={styles.avatarHint}>Tap để đổi</Text>
            </View>
            <Ionicons name="pencil" size={18} color={colors.textMuted} />
          </Pressable>
          <Text style={styles.fieldLabel}>Tên hiển thị</Text>
          <TextInput
            value={displayName ?? ''}
            onChangeText={setDisplayName}
            style={styles.input}
            placeholder="Tên của bạn"
            placeholderTextColor={colors.textMuted}
            autoCapitalize="words"
          />

          {/* AI */}
          <Text style={[styles.sectionTitle, { marginTop: spacing.xl }]}>Lumina của bạn</Text>
          <Pressable style={styles.avatarRow} onPress={() => setPickerOpen('ai')}>
            <Avatar
              size={72}
              url={persona?.ai_avatar_url}
              presetKey={persona?.ai_avatar_key}
              kind="ai"
            />
            <View style={{ flex: 1 }}>
              <Text style={styles.avatarLabel}>Avatar AI</Text>
              <Text style={styles.avatarHint}>Tap để chọn preset hoặc tải ảnh</Text>
            </View>
            <Ionicons name="pencil" size={18} color={colors.textMuted} />
          </Pressable>
          <Text style={styles.fieldLabel}>Tên gọi cho AI</Text>
          <TextInput
            value={aiName ?? ''}
            onChangeText={setAiName}
            style={styles.input}
            placeholder="Lumina, Mio, An…"
            placeholderTextColor={colors.textMuted}
            autoCapitalize="words"
          />

          <Text style={[styles.sectionTitle, { marginTop: spacing.xl }]}>Bộ gen</Text>
          <Pressable style={styles.linkRow} onPress={() => router.push('/onboarding')}>
            <Ionicons name="sparkles-outline" size={20} color={colors.textPrimary} />
            <Text style={styles.linkText}>Thiết lập lại tính cách AI</Text>
            <Ionicons name="chevron-forward" size={18} color={colors.textMuted} />
          </Pressable>

          <Text style={[styles.sectionTitle, { marginTop: spacing.xl }]}>Tài khoản</Text>
          <Pressable style={styles.linkRow} onPress={logout}>
            <Ionicons name="log-out-outline" size={20} color={colors.danger} />
            <Text style={[styles.linkText, { color: colors.danger }]}>Đăng xuất</Text>
            <View />
          </Pressable>
        </ScrollView>
      </KeyboardAvoidingView>

      <AvatarPickerSheet
        visible={pickerOpen === 'ai'}
        kind="ai"
        selected={persona?.ai_avatar_key}
        onClose={() => setPickerOpen(null)}
        onPick={pickAiPreset}
        onPickPhoto={pickAiPhoto}
      />
      <AvatarPickerSheet
        visible={pickerOpen === 'user'}
        kind="user"
        selected={profile?.avatar_key}
        onClose={() => setPickerOpen(null)}
        onPick={pickUserPreset}
        onPickPhoto={pickUserPhoto}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.background },
  flex: { flex: 1 },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
  },
  headerTitle: { ...typography.title, fontSize: 18, color: colors.textPrimary },
  saveBtn: {
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
    backgroundColor: colors.accent,
    borderRadius: radius.full,
  },
  saveLabel: {
    ...typography.caption,
    fontSize: 13,
    fontWeight: '700',
    color: colors.textInverse,
    letterSpacing: 1,
  },
  scroll: { padding: spacing.lg, paddingBottom: spacing.xxxl },
  sectionTitle: {
    ...typography.caption,
    color: colors.textMuted,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: spacing.sm,
  },
  avatarRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.lg,
    backgroundColor: colors.surface,
    padding: spacing.lg,
    borderRadius: radius.xl,
    marginBottom: spacing.md,
  },
  avatarLabel: { ...typography.body, color: colors.textPrimary, fontWeight: '600' },
  avatarHint: { ...typography.caption, color: colors.textMuted, marginTop: 2 },
  fieldLabel: {
    ...typography.caption,
    color: colors.textSecondary,
    marginTop: spacing.sm,
    marginBottom: 6,
  },
  input: {
    ...typography.body,
    color: colors.textPrimary,
    backgroundColor: colors.surface,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    borderRadius: radius.lg,
  },
  linkRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    backgroundColor: colors.surface,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md + 2,
    borderRadius: radius.lg,
    marginBottom: spacing.sm,
  },
  linkText: { ...typography.body, color: colors.textPrimary, flex: 1 },
});
