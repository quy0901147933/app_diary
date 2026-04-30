import { useState } from 'react';
import {
  Alert,
  Keyboard,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableWithoutFeedback,
  View,
} from 'react-native';
import { Image } from 'expo-image';
import * as ImagePicker from 'expo-image-picker';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useQueryClient } from '@tanstack/react-query';
import { PHOTO_BUCKET, supabase } from '@/services/supabase';
import { aiApi } from '@/services/ai-api';
import { readExifFromAssetId } from '@/services/exif';
import { useAuthStore } from '@/stores/auth-store';
import { colors, radius, spacing, typography } from '@/theme';

export default function CaptureScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const queryClient = useQueryClient();
  const userId = useAuthStore((s) => s.session?.user.id);
  const [asset, setAsset] = useState<ImagePicker.ImagePickerAsset | null>(null);
  const [note, setNote] = useState('');
  const [saving, setSaving] = useState(false);

  async function ensure(perm: 'camera' | 'media'): Promise<boolean> {
    const req =
      perm === 'camera'
        ? await ImagePicker.requestCameraPermissionsAsync()
        : await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!req.granted) {
      Alert.alert(
        'Cần quyền truy cập',
        perm === 'camera'
          ? 'Hãy cho phép Lumina dùng camera trong cài đặt.'
          : 'Hãy cho phép Lumina truy cập thư viện ảnh trong cài đặt.',
      );
      return false;
    }
    return true;
  }

  async function pickFromCamera() {
    if (!(await ensure('camera'))) return;
    const result = await ImagePicker.launchCameraAsync({ exif: true, quality: 0.85 });
    const first = !result.canceled ? result.assets[0] : null;
    if (first) setAsset(first);
  }

  async function pickFromGallery() {
    if (!(await ensure('media'))) return;
    const result = await ImagePicker.launchImageLibraryAsync({ exif: true, quality: 0.85 });
    const first = !result.canceled ? result.assets[0] : null;
    if (first) setAsset(first);
  }

  async function save() {
    if (!asset || !userId) return;
    setSaving(true);
    try {
      const exif = asset.assetId ? await readExifFromAssetId(asset.assetId) : {};
      const filename = `${userId}/${Date.now()}.jpg`;

      const arrayBuffer = await fetch(asset.uri).then((r) => r.arrayBuffer());
      if (arrayBuffer.byteLength === 0) {
        throw new Error('Ảnh rỗng — không thể đọc dữ liệu từ asset URI');
      }
      const { error: uploadError } = await supabase.storage
        .from(PHOTO_BUCKET)
        .upload(filename, arrayBuffer, {
          contentType: asset.mimeType ?? 'image/jpeg',
          upsert: false,
        });
      if (uploadError) throw uploadError;

      const {
        data: { publicUrl },
      } = supabase.storage.from(PHOTO_BUCKET).getPublicUrl(filename);

      const { data: row, error: insertError } = await supabase
        .from('photos')
        .insert({
          user_id: userId,
          storage_path: publicUrl,
          taken_at: exif.takenAt ?? new Date().toISOString(),
          location_text: exif.locationText ?? null,
          exif,
          note: note.trim() || null,
          status: 'pending_ai',
        })
        .select('id')
        .single();
      if (insertError) throw insertError;

      void aiApi.requestPhotoComment(row.id).catch(() => null);
      await queryClient.invalidateQueries({ queryKey: ['photos', 'today', userId] });
      router.back();
    } catch (e) {
      Alert.alert('Không lưu được', e instanceof Error ? e.message : 'Thử lại sau.');
    } finally {
      setSaving(false);
    }
  }

  return (
    <View style={[styles.safe, { paddingTop: insets.top, paddingBottom: insets.bottom }]}>
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        keyboardVerticalOffset={0}
      >
        <View style={styles.headerRow}>
          <Pressable onPress={() => router.back()} accessibilityLabel="Đóng">
            <Ionicons name="close" size={26} color={colors.textPrimary} />
          </Pressable>
          <Text style={styles.headerTitle}>Khoảnh khắc mới</Text>
          <Pressable onPress={() => Keyboard.dismiss()} accessibilityLabel="Đóng bàn phím">
            <Ionicons name="chevron-down" size={22} color={colors.textMuted} />
          </Pressable>
        </View>

        <ScrollView
          contentContainerStyle={styles.scroll}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          <TouchableWithoutFeedback onPress={Keyboard.dismiss} accessible={false}>
            <View>
              <View style={styles.preview}>
                {asset ? (
                  <Image source={{ uri: asset.uri }} style={styles.image} contentFit="cover" />
                ) : (
                  <View style={styles.placeholder}>
                    <Ionicons name="image-outline" size={48} color={colors.textMuted} />
                    <Text style={styles.placeholderText}>Chọn hoặc chụp một khoảnh khắc</Text>
                  </View>
                )}
              </View>

              <View style={styles.actions}>
                <Pressable onPress={pickFromCamera} style={styles.actionBtn}>
                  <Ionicons name="camera-outline" size={20} color={colors.textPrimary} />
                  <Text style={styles.actionLabel}>Chụp</Text>
                </Pressable>
                <Pressable onPress={pickFromGallery} style={styles.actionBtn}>
                  <Ionicons name="images-outline" size={20} color={colors.textPrimary} />
                  <Text style={styles.actionLabel}>Thư viện</Text>
                </Pressable>
              </View>
            </View>
          </TouchableWithoutFeedback>

          <TextInput
            style={styles.note}
            placeholder="Aa  Thêm ghi chú nhỏ…"
            placeholderTextColor={colors.textMuted}
            value={note}
            onChangeText={setNote}
            multiline
            submitBehavior="blurAndSubmit"
            returnKeyType="done"
            onSubmitEditing={() => Keyboard.dismiss()}
          />
        </ScrollView>

        <Pressable
          style={[styles.save, !asset && styles.saveDisabled]}
          onPress={save}
          disabled={!asset || saving}
        >
          <Text style={styles.saveLabel}>{saving ? 'Đang lưu…' : 'Lưu vào hôm nay'}</Text>
        </Pressable>
      </KeyboardAvoidingView>
    </View>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.background },
  flex: { flex: 1, paddingHorizontal: spacing.lg },
  scroll: { paddingBottom: spacing.lg },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: spacing.md,
  },
  headerTitle: { ...typography.title, fontSize: 18, color: colors.textPrimary },
  preview: {
    aspectRatio: 4 / 5,
    borderRadius: radius.xl,
    overflow: 'hidden',
    backgroundColor: colors.surfaceAlt,
    marginBottom: spacing.lg,
  },
  image: { width: '100%', height: '100%' },
  placeholder: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
  },
  placeholderText: { ...typography.bodySm, color: colors.textMuted },
  actions: {
    flexDirection: 'row',
    gap: spacing.md,
    marginBottom: spacing.lg,
  },
  actionBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    paddingVertical: spacing.md,
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
  },
  actionLabel: { ...typography.bodySm, color: colors.textPrimary },
  note: {
    ...typography.body,
    minHeight: 80,
    color: colors.textPrimary,
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    padding: spacing.lg,
    marginBottom: spacing.lg,
    textAlignVertical: 'top',
  },
  save: {
    paddingVertical: spacing.md,
    backgroundColor: colors.accent,
    borderRadius: radius.full,
    alignItems: 'center',
    marginBottom: spacing.lg,
  },
  saveDisabled: { backgroundColor: colors.accentSoft },
  saveLabel: { ...typography.bodySm, fontWeight: '600', color: colors.textInverse },
});
