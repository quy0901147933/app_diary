import { StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Avatar } from '@/components/avatar';
import { useUserPersona } from '@/hooks/use-persona';
import { useAuthStore } from '@/stores/auth-store';
import { colors, radius, shadow, spacing, typography } from '@/theme';

type Props = {
  message: string;
};

export function MoodMessageCard({ message }: Props) {
  const userId = useAuthStore((s) => s.session?.user.id);
  const persona = useUserPersona(userId).data;
  const aiName = persona?.ai_name || 'Lumina';

  return (
    <View style={styles.card}>
      <View style={styles.header}>
        <Avatar
          size={40}
          url={persona?.ai_avatar_url}
          presetKey={persona?.ai_avatar_key}
          kind="ai"
        />
        <View style={styles.headerText}>
          <Text style={styles.name}>{aiName}</Text>
          <Text style={styles.role}>nhắn anh một câu</Text>
        </View>
        <Ionicons name="sparkles" size={16} color={colors.accent} />
      </View>
      <Text style={styles.message}>{message}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    marginTop: spacing.lg,
    backgroundColor: colors.accentSoft,
    borderRadius: radius.xxl,
    padding: spacing.lg,
    ...shadow.card,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
  },
  headerText: { flex: 1 },
  name: { ...typography.bodySm, fontFamily: 'Inter_600SemiBold', color: colors.textPrimary },
  role: { ...typography.caption, color: colors.textSecondary, marginTop: 2 },
  message: {
    ...typography.body,
    color: colors.textPrimary,
    lineHeight: 24,
    marginTop: spacing.md,
  },
});
