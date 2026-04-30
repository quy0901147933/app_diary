// Preset AI avatars — emoji + background. Stored as `ai_avatar_key`.
// Add or reorder freely; keys are persisted, so don't rename existing keys.

export type AvatarPreset = {
  key: string;
  emoji: string;
  bg: string;
  label: string;
};

export const AI_AVATAR_PRESETS: AvatarPreset[] = [
  { key: 'moon', emoji: '🌙', bg: '#1F2238', label: 'Trăng đêm' },
  { key: 'sakura', emoji: '🌸', bg: '#FCE4EC', label: 'Hoa anh đào' },
  { key: 'sun', emoji: '☀️', bg: '#FFE9A8', label: 'Nắng ấm' },
  { key: 'leaf', emoji: '🍃', bg: '#D7E8C9', label: 'Lá xanh' },
  { key: 'ocean', emoji: '🌊', bg: '#CDE3F0', label: 'Đại dương' },
  { key: 'mountain', emoji: '⛰️', bg: '#E2D6C2', label: 'Núi xa' },
  { key: 'coffee', emoji: '☕', bg: '#E8D3B7', label: 'Cà phê' },
  { key: 'sparkle', emoji: '✨', bg: '#E8D9B8', label: 'Lấp lánh' },
];

export const USER_AVATAR_PRESETS: AvatarPreset[] = [
  { key: 'star', emoji: '⭐', bg: '#FFE9A8', label: 'Sao' },
  { key: 'cat', emoji: '🐱', bg: '#FCE4EC', label: 'Mèo' },
  { key: 'dog', emoji: '🐶', bg: '#E8D3B7', label: 'Chó' },
  { key: 'fox', emoji: '🦊', bg: '#FFD6BA', label: 'Cáo' },
  { key: 'panda', emoji: '🐼', bg: '#EFEFEF', label: 'Gấu trúc' },
  { key: 'bee', emoji: '🐝', bg: '#FFF3B0', label: 'Ong' },
  { key: 'flower', emoji: '🌼', bg: '#D7E8C9', label: 'Hoa' },
  { key: 'note', emoji: '📔', bg: '#E8D9B8', label: 'Sổ tay' },
];

export function findPreset(presets: AvatarPreset[], key: string | null | undefined): AvatarPreset {
  return presets.find((p) => p.key === key) ?? presets[0]!;
}
