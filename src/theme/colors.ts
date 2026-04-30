export const colors = {
  background: '#FAF7F2',
  surface: '#FFFFFF',
  surfaceAlt: '#F2EDE5',
  overlay: 'rgba(255,255,255,0.55)',
  overlayDark: 'rgba(20,18,15,0.35)',

  textPrimary: '#1A1814',
  textSecondary: '#6B6358',
  textInverse: '#FFFFFF',
  textMuted: '#A39A8E',

  accent: '#C9A96E',
  accentSoft: '#E8D9B8',
  sparkleHi: '#FFE9A8',
  sparkleLo: '#FFFFFF',

  success: '#7DA87B',
  danger: '#C76B5E',
  info: '#7B9FAB',

  border: 'rgba(26,24,20,0.08)',
} as const;

export type ColorToken = keyof typeof colors;
