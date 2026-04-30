import { Image } from 'expo-image';
import { StyleProp, StyleSheet, Text, View, ViewStyle } from 'react-native';
import { AI_AVATAR_PRESETS, USER_AVATAR_PRESETS, findPreset } from '@/constants/avatar-presets';
import { colors, radius } from '@/theme';

type Props = {
  size?: number;
  url?: string | null;
  presetKey?: string | null;
  kind?: 'ai' | 'user';
  style?: StyleProp<ViewStyle>;
};

export function Avatar({ size = 40, url, presetKey, kind = 'user', style }: Props) {
  if (url) {
    return (
      <View
        style={[
          styles.host,
          { width: size, height: size, borderRadius: size / 2, overflow: 'hidden' },
          style,
        ]}
      >
        <Image
          source={{ uri: url }}
          style={{ width: '100%', height: '100%', backgroundColor: colors.surfaceAlt }}
          contentFit="cover"
        />
      </View>
    );
  }
  const presets = kind === 'ai' ? AI_AVATAR_PRESETS : USER_AVATAR_PRESETS;
  const preset = findPreset(presets, presetKey);
  return (
    <View
      style={[
        styles.host,
        styles.center,
        {
          width: size,
          height: size,
          borderRadius: size / 2,
          backgroundColor: preset.bg,
        },
        style,
      ]}
    >
      <Text style={{ fontSize: size * 0.55 }}>{preset.emoji}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  host: { borderRadius: radius.full },
  center: { alignItems: 'center', justifyContent: 'center' },
});
