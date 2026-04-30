import { Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { colors, radius, spacing, typography } from '@/theme';

type Props = {
  visible: boolean;
  onClose: () => void;
  onPickAi: () => void;
  onPickWrite: () => void;
};

export function NewEntrySheet({ visible, onClose, onPickAi, onPickWrite }: Props) {
  const insets = useSafeAreaInsets();
  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <Pressable style={styles.backdrop} onPress={onClose}>
        <Pressable
          style={[styles.sheet, { paddingBottom: insets.bottom + spacing.xl }]}
          onPress={(e) => e.stopPropagation()}
        >
          <View style={styles.handle} />
          <Text style={styles.heading}>Bạn muốn lưu lại điều gì?</Text>

          <Pressable style={[styles.option, styles.optionPrimary]} onPress={onPickAi}>
            <View style={styles.iconCircle}>
              <Ionicons name="camera" size={22} color={colors.textInverse} />
            </View>
            <View style={styles.optionTextHost}>
              <Text style={styles.optionTitleInverse}>Khoảnh khắc với AI</Text>
              <Text style={styles.optionHintInverse}>
                Chụp/chọn ảnh — Lumina sẽ ngắm và viết một câu cảm thán nhỏ.
              </Text>
            </View>
          </Pressable>

          <Pressable style={[styles.option, styles.optionSecondary]} onPress={onPickWrite}>
            <View style={[styles.iconCircle, styles.iconCircleAlt]}>
              <Ionicons name="create-outline" size={22} color={colors.accent} />
            </View>
            <View style={styles.optionTextHost}>
              <Text style={styles.optionTitle}>Tự viết nhật ký</Text>
              <Text style={styles.optionHint}>
                Trang giấy trống cho bạn — tiêu đề, tâm trạng, suy nghĩ tự do.
              </Text>
            </View>
          </Pressable>

          <Pressable style={styles.cancel} onPress={onClose}>
            <Text style={styles.cancelLabel}>Để sau</Text>
          </Pressable>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(20,18,15,0.55)',
    justifyContent: 'flex-end',
  },
  sheet: {
    backgroundColor: colors.surface,
    borderTopLeftRadius: radius.xxl,
    borderTopRightRadius: radius.xxl,
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.md,
  },
  handle: {
    alignSelf: 'center',
    width: 40,
    height: 4,
    borderRadius: radius.full,
    backgroundColor: colors.border,
    marginBottom: spacing.lg,
  },
  heading: {
    ...typography.title,
    fontSize: 20,
    color: colors.textPrimary,
    marginBottom: spacing.lg,
  },
  option: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    padding: spacing.lg,
    borderRadius: radius.xl,
    marginBottom: spacing.md,
  },
  optionPrimary: { backgroundColor: colors.accent },
  optionSecondary: { backgroundColor: colors.surfaceAlt },
  iconCircle: {
    width: 44,
    height: 44,
    borderRadius: radius.full,
    backgroundColor: 'rgba(255,255,255,0.2)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  iconCircleAlt: { backgroundColor: colors.accentSoft },
  optionTextHost: { flex: 1 },
  optionTitle: { ...typography.title, fontSize: 16, color: colors.textPrimary },
  optionHint: { ...typography.caption, color: colors.textSecondary, marginTop: 2 },
  optionTitleInverse: { ...typography.title, fontSize: 16, color: colors.textInverse },
  optionHintInverse: {
    ...typography.caption,
    color: 'rgba(255,255,255,0.85)',
    marginTop: 2,
  },
  cancel: {
    paddingVertical: spacing.md,
    alignItems: 'center',
    marginTop: spacing.sm,
  },
  cancelLabel: { ...typography.bodySm, color: colors.textMuted },
});
