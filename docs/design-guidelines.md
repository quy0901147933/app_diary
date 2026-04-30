# LuminaDiary — Design Guidelines

Inspired by Diarly. Modern, minimal, warm-luxurious. Photo-first storytelling.

## 1. Color Tokens

```ts
export const colors = {
  // Surfaces
  background: '#FAF7F2',     // warm off-white (page bg)
  surface:    '#FFFFFF',      // cards
  surfaceAlt: '#F2EDE5',      // subtle differentiation
  overlay:    'rgba(255,255,255,0.55)', // glassmorphism base
  overlayDark:'rgba(20,18,15,0.35)',    // glass on dark images

  // Text
  textPrimary:   '#1A1814',
  textSecondary: '#6B6358',
  textInverse:   '#FFFFFF',
  textMuted:     '#A39A8E',

  // Accent (warm gold — sparkle / focus)
  accent:        '#C9A96E',
  accentSoft:    '#E8D9B8',
  sparkleHi:     '#FFE9A8',
  sparkleLo:     '#FFFFFF',

  // Semantic
  success: '#7DA87B',
  danger:  '#C76B5E',
  info:    '#7B9FAB',

  // Borders / dividers
  border:  'rgba(26,24,20,0.08)',
};
```

## 2. Typography

| Role | Font | Weight | Size |
|---|---|---|---|
| Display (titles, AI quotes) | **Fraunces** | 600 | 28 / 32 / 40 |
| Heading (card titles) | **Fraunces** | 500 | 20 / 22 |
| Body | **Inter** | 400 | 14 / 16 |
| Caption (hashtags, time) | **Inter** | 500 | 12 / 13 |
| Mono (debug only) | system | 400 | 13 |

Letter-spacing: -0.01em on display, 0 on body.
Line-height: 1.35 on display, 1.5 on body.

## 3. Spacing & Radius

```ts
export const spacing = { xs: 4, sm: 8, md: 12, lg: 16, xl: 24, xxl: 32, xxxl: 48 };
export const radius  = { sm: 8, md: 12, lg: 16, xl: 20, xxl: 24, full: 999 };
```

Default card radius: `xxl (24)`. Photo cards: `xl (20)`. Buttons: `full`.

## 4. Elevation / Shadow

```ts
shadow.card = { shadowColor: '#1A1814', shadowOpacity: 0.06, shadowRadius: 16, shadowOffset: { width: 0, height: 4 }, elevation: 3 };
shadow.fab  = { shadowColor: '#1A1814', shadowOpacity: 0.18, shadowRadius: 20, shadowOffset: { width: 0, height: 8 }, elevation: 8 };
```

## 5. Glassmorphism Overlay

Use on photo cards (Tab 1) for AI commentary.

- `expo-blur` with `intensity={45}` `tint="light"`
- Background: `colors.overlay` (light photos) or `colors.overlayDark` (dark photos — detect via average luminance later)
- Border: `1px solid rgba(255,255,255,0.4)` inset
- Padding: `lg (16)`
- Position: bottom of photo card, `radius.xl` bottom corners only

## 6. Sparkle Effect (Signature Animation)

- Triggered when AI commentary appears or completes.
- 6–10 particles emitting from one corner of the photo, drifting outward, fading.
- Each particle: 4-pointed star SVG, scale 0.4→1.2→0, opacity 0→1→0, duration 1.2s, stagger 80ms.
- Color blend: `sparkleHi` ↔ `sparkleLo`. Additive blending if Skia.
- Loop: only on first appearance. Subtle re-pulse every 30s while card visible.
- Implement with `react-native-reanimated` worklets; if perf issue, fall back to **Skia** `useRSXformBuffer`.

## 7. Layout Rules

- **Safe area always** (`react-native-safe-area-context`).
- Mobile-first; min width 320, max content width 720 (tablet).
- Photo card aspect ratio: original; max height = `screenHeight * 0.7`.
- Tab bar: top segmented control (pill style), padding `lg`, sticky on scroll.
- FAB: bottom-right, 56×56, `colors.accent` bg, white icon. Two FABs (Capture + Chat) — Capture is primary larger pill, Chat is smaller circular at bottom-left.

## 8. Motion Principles

| Action | Easing | Duration |
|---|---|---|
| Tab switch | `Easing.out(Easing.cubic)` | 240ms |
| Card mount (Today) | `Easing.out(Easing.exp)` | 320ms (fade + 8px slide-up) |
| AI overlay reveal | spring(damping=14, stiffness=120) | ~400ms |
| End-of-day "gói ghém" gather | `Easing.inOut(Easing.cubic)` | 900ms (cards converge to one) |
| Skeleton shimmer | linear | 1200ms loop |

## 9. States

| State | Treatment |
|---|---|
| Loading photo | Skeleton card with shimmer (`colors.surfaceAlt` → `colors.background`) |
| AI thinking | Placeholder line "AI đang ngắm bức ảnh…" + sparkle pulse |
| Empty Today | Centered illustration + CTA "Lưu khoảnh khắc đầu tiên" |
| Empty Archive | Centered text "Hành trình của bạn sẽ xuất hiện ở đây" |
| Error | Inline toast with `colors.danger`, retry CTA |

## 10. Privacy / Anti-Social Cues

Per requirements §2.2: **no social affordances** in archive cards.
- ❌ No like / heart / send / share buttons.
- ❌ No comment count, no follower display.
- ✅ Keep affordance set: read, edit, delete, export PDF.

## 11. Accessibility

- Min touch target 44×44.
- Text contrast ≥ 4.5:1 (verify `textSecondary` over `surface` and `surfaceAlt`).
- Honor system font scale; cap multiplier at 1.4 on display headings to prevent layout break.
- Add `accessibilityLabel` to all icon-only buttons (especially FABs).
