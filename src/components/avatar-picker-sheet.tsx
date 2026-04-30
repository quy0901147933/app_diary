import { Modal, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Avatar } from './avatar';
import { AI_AVATAR_PRESETS, USER_AVATAR_PRESETS } from '@/constants/avatar-presets';
import { colors, radius, spacing, typography } from '@/theme';

type Props = {
  visible: boolean;
  kind: 'ai' | 'user';
  selected: string | null | undefined;
  onClose: () => void;
  onPick: (key: string) => void;
  onPickPhoto?: () => void;
};

export function AvatarPickerSheet({
  visible,
  kind,
  selected,
  onClose,
  onPick,
  onPickPhoto,
}: Props) {
  const insets = useSafeAreaInsets();
  const presets = kind === 'ai' ? AI_AVATAR_PRESETS : USER_AVATAR_PRESETS;

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <Pressable style={styles.backdrop} onPress={onClose}>
        <Pressable
          style={[styles.sheet, { paddingBottom: insets.bottom + spacing.xl }]}
          onPress={(e) => e.stopPropagation()}
        >
          <View style={styles.handle} />
          <Text style={styles.heading}>
            {kind === 'ai' ? 'Chọn avatar cho Lumina' : 'Chọn avatar của bạn'}
          </Text>
          <Text style={styles.hint}>
            {kind === 'ai'
              ? 'Tông màu nhẹ nhàng, hợp với không khí nhật ký.'
              : 'Hoặc chụp/chọn ảnh cá nhân ở dưới.'}
          </Text>

          <ScrollView style={styles.scroll} showsVerticalScrollIndicator={false}>
            <View style={styles.grid}>
              {presets.map((p) => {
                const active = p.key === selected;
                return (
                  <Pressable
                    key={p.key}
                    onPress={() => onPick(p.key)}
                    style={[styles.cell, active && styles.cellActive]}
                  >
                    <Avatar size={64} presetKey={p.key} kind={kind} />
                    <Text style={styles.cellLabel}>{p.label}</Text>
                  </Pressable>
                );
              })}
            </View>

            {onPickPhoto ? (
              <Pressable style={styles.photoBtn} onPress={onPickPhoto}>
                <Text style={styles.photoLabel}>📷 Tải ảnh từ máy</Text>
              </Pressable>
            ) : null}
          </ScrollView>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: 'rgba(20,18,15,0.55)', justifyContent: 'flex-end' },
  sheet: {
    backgroundColor: colors.surface,
    borderTopLeftRadius: radius.xxl,
    borderTopRightRadius: radius.xxl,
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.md,
    maxHeight: '80%',
  },
  handle: {
    alignSelf: 'center',
    width: 40,
    height: 4,
    borderRadius: radius.full,
    backgroundColor: colors.border,
    marginBottom: spacing.lg,
  },
  heading: { ...typography.title, fontSize: 20, color: colors.textPrimary },
  hint: { ...typography.caption, color: colors.textSecondary, marginTop: 4, marginBottom: spacing.lg },
  scroll: { maxHeight: '90%' },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.md, justifyContent: 'space-between' },
  cell: {
    width: '23%',
    alignItems: 'center',
    paddingVertical: spacing.md,
    borderRadius: radius.lg,
  },
  cellActive: { backgroundColor: colors.accentSoft },
  cellLabel: { ...typography.caption, color: colors.textPrimary, marginTop: spacing.xs, textAlign: 'center' },
  photoBtn: {
    marginTop: spacing.lg,
    paddingVertical: spacing.md,
    backgroundColor: colors.surfaceAlt,
    borderRadius: radius.full,
    alignItems: 'center',
  },
  photoLabel: { ...typography.body, color: colors.textPrimary },
});
