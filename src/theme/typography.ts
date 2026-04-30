import { TextStyle } from 'react-native';

export const fontFamily = {
  display: 'Fraunces_600SemiBold',
  displayMedium: 'Fraunces_500Medium',
  body: 'Inter_400Regular',
  bodyMedium: 'Inter_500Medium',
  bodySemiBold: 'Inter_600SemiBold',
} as const;

export const typography = {
  display: {
    fontFamily: fontFamily.display,
    fontSize: 32,
    lineHeight: 40,
    letterSpacing: -0.4,
  } satisfies TextStyle,
  title: {
    fontFamily: fontFamily.displayMedium,
    fontSize: 22,
    lineHeight: 28,
  } satisfies TextStyle,
  body: {
    fontFamily: fontFamily.body,
    fontSize: 16,
    lineHeight: 24,
  } satisfies TextStyle,
  bodySm: {
    fontFamily: fontFamily.body,
    fontSize: 14,
    lineHeight: 20,
  } satisfies TextStyle,
  caption: {
    fontFamily: fontFamily.bodyMedium,
    fontSize: 12,
    lineHeight: 16,
    letterSpacing: 0.2,
  } satisfies TextStyle,
} as const;

export type TypographyToken = keyof typeof typography;
