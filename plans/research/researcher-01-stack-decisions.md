# LuminaDiary Technical Stack Research — 9 Key Decisions
**Date:** 2026-04-27 | **Project:** LuminaDiary (AI Diary Mobile App)

---

## 1. Navigation: Top Tabs / Segmented Control for 2 Tabs

**Recommendation: Use Expo Router native tabs** (not @react-navigation/material-top-tabs for SDK 52+).

SDK 52 has known issues with material-top-tabs (missing labels, touch failures after 3–4 navigations). Expo Router's native tabs provide stable, first-class support for tab navigation in Expo SDK 52+ without bridge overhead. Use JavaScript tabs fallback if targeting older SDK versions.

```typescript
// app/(tabs)/_layout.tsx
export default function TabLayout() {
  return (
    <Tabs>
      <Tabs.Screen
        name="today"
        options={{
          title: "Hành trình hôm nay",
          tabBarLabel: "Today",
        }}
      />
      <Tabs.Screen
        name="archive"
        options={{
          title: "Ký ức đã đóng gói",
          tabBarLabel: "Archive",
        }}
      />
    </Tabs>
  );
}
```

**Trade-offs:** Native tabs slightly less customizable than material-top-tabs, but stable and performant. Invest in custom tab bar styling within TabBarButton component if design demands it.

---

## 2. Glassmorphism Overlay on Photos

**Recommendation: expo-blur + semi-transparent View overlay** (not @react-native-community/blur).

expo-blur is the official Expo solution for glassmorphism. Pair it with a semi-transparent View (backgroundColor with opacity) to achieve the frosted-glass effect required for AI commentary overlay. This approach is mature, well-supported, and has no native build requirements in Expo Go.

```typescript
import { BlurView } from 'expo-blur';

<BlurView intensity={85} style={styles.overlay}>
  <View style={{ backgroundColor: 'rgba(255,255,255,0.1)' }}>
    <Text style={styles.aiCommentary}>{comment}</Text>
  </View>
</BlurView>
```

**Trade-offs:** @react-native-community/blur offers marginally better iOS performance but requires native linking. expo-blur is sufficient for typical overlays (1–3 per screen); avoid stacking excessive blur layers.

---

## 3. Sparkle Animation with react-native-reanimated v3

**Recommendation: react-native-skia + Reanimated v3 worklets** (not Lottie or SVG).

Skia's Canvas + Reanimated 3 worklet system delivers GPU-accelerated particle animations at 60fps+ with zero JS thread overhead. Create 20–50 sparkle particles per screen without frame drops. Worklets run directly on the UI thread; use `useRSXformBuffer` for particle transforms.

```typescript
import { Canvas, Circle, useRSXformBuffer } from '@react-native-skia';
import Animated, { useSharedValue, withTiming } from 'react-native-reanimated';

export const SparkleEffect = () => {
  const opacity = useSharedValue(1);
  
  const handlePress = () => {
    opacity.value = withTiming(0, { duration: 1000 });
  };
  
  return (
    <Canvas style={{ flex: 1 }}>
      <Circle cx={100} cy={100} r={8} color="gold" opacity={opacity} />
    </Canvas>
  );
};
```

**Trade-offs:** Steeper learning curve than Lottie (which is JSON-driven). Lottie is fine for single canned animations; Skia is required for interactive, physics-driven sparkles tied to AI interactions.

---

## 4. EXIF/GPS Extraction from Photos

**Recommendation: expo-media-library.getAssetInfoAsync()** (primary) + **react-native-exif** (fallback for Android API 30 issues).

expo-media-library natively exposes GPS coordinates and EXIF data via `getAssetInfoAsync()`. Requires `ACCESS_MEDIA_LOCATION` permission on Android. Known issue on Android API 30 — handle gracefully or use react-native-exif as fallback.

```typescript
const info = await MediaLibrary.getAssetInfoAsync(asset);
const gps = info.location; // { latitude, longitude }
const timestamp = info.exif?.DateTime;
```

**Trade-offs:** EXIF availability varies by device/Android version. Plan for degraded experience (no GPS) on some devices. Always validate before displaying.

---

## 5. Firebase Auth + Firestore + Storage with Expo

**Recommendation: Start with Firebase JS SDK** (UploadFile path for MVP); **migrate to @react-native-firebase at production build** if needed.

Use Firebase JS SDK during development (works in Expo Go, zero native setup). Supports Auth, Firestore, Storage, Realtime DB. If you need FCM (push notifications), Crashlytics, or advanced analytics later, switch to @react-native-firebase using `expo prebuild` + EAS Build.

```typescript
// Development: JS SDK (Expo Go compatible)
import { initializeApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';
import { getStorage } from 'firebase/storage';

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);
const storage = getStorage(app);
```

**Trade-offs:** JS SDK lacks some native features (FCM reliability, Crashlytics). Migration to rnfirebase requires native build setup; plan for this in post-MVP.

---

## 6. State Management

**Recommendation: Zustand** (for solo dev scaling to small team).

Zustand: 1KB, hook-based, no providers, perfect for solo dev. Start here. If team grows to 5+ developers needing enforced patterns and time-travel debugging, migrate to Redux Toolkit. Jotai is atomic and bottom-up but overkill for typical diary app state (auth, photos, user prefs).

```typescript
import { create } from 'zustand';

const useDiaryStore = create((set) => ({
  photos: [],
  addPhoto: (photo) => set((state) => ({ photos: [...state.photos, photo] })),
  user: null,
  setUser: (user) => set({ user }),
}));
```

**Trade-offs:** Zustand has no built-in time-travel debugging (Redux advantage). For MVP, this is acceptable. Server state (photos from Firestore) should use TanStack Query, not Zustand.

---

## 7. FAB / Camera Capture Flow (Story-Style)

**Recommendation: expo-camera + custom UI** (not react-native-vision-camera).

expo-camera is built into Expo, zero native setup, and handles 95% of capture flows. Vision Camera is overkill unless you need real-time ML on camera frames (barcode scanning, object detection). For a diary app with post-capture AI analysis, expo-camera + custom UI is simpler and faster to iterate.

```typescript
import { CameraView, useCameraPermissions } from 'expo-camera';

<CameraView
  facing={facing}
  onPictureSaved={onPictureSaved}
  style={{ flex: 1 }}
/>
```

**Trade-offs:** expo-camera cannot expose raw frames to JS. If future roadmap includes real-time video filters or ML during capture, plan migration to Vision Camera.

---

## 8. Backend FastAPI Structure for AI Photo Analysis

**Recommendation:** Folder layout follows modular router → service → model pattern.

```
backend/
├── app.py                      # FastAPI app init
├── routers/
│   ├── __init__.py
│   └── photos.py              # POST /photos/analyze
├── services/
│   ├── __init__.py
│   ├── vision_service.py       # Vision API calls (Gemini, GPT, Claude)
│   └── photo_service.py        # Photo processing, metadata extraction
├── models/
│   ├── __init__.py
│   └── schemas.py              # Pydantic models (PhotoUpload, AnalysisResult)
├── config.py                   # API keys, environment vars
└── requirements.txt
```

Routers define endpoints; services handle business logic; models define request/response schemas. Multipart upload in router, vision call in service.

```python
# routers/photos.py
from fastapi import APIRouter, File, UploadFile
from services.vision_service import analyze_photo

router = APIRouter()

@router.post("/analyze")
async def analyze(file: UploadFile = File(...)):
    commentary = await analyze_photo(await file.read())
    return {"commentary": commentary}
```

---

## 9. Vision AI for Photo Commentary

**Recommendation: Gemini 2.5 Flash** (best cost/capability for MVP).

Gemini 2.5 Flash: $0.15/1M input tokens, 1M context window. Perfect for MVP. Cost is 6.7× cheaper than Claude Haiku, matches GPT-4o Mini on price but with larger context. For photo commentary (short context), Flash is sufficient. Scale to Gemini 3 Pro ($2.00/1M) or Claude Opus only if you need premium reasoning.

```python
import anthropic

client = anthropic.Anthropic(api_key=os.environ.get("ANTHROPIC_API_KEY"))

message = client.messages.create(
    model="claude-3-5-sonnet-20241022",
    max_tokens=150,
    messages=[
        {
            "role": "user",
            "content": [
                {
                    "type": "image",
                    "source": {
                        "type": "base64",
                        "media_type": "image/jpeg",
                        "data": base64_image,
                    },
                },
                {
                    "type": "text",
                    "text": "Viết một dòng bình luận ngắn, cảm xúc về ảnh này. (Keep it 1 sentence, Vietnamese)"
                }
            ],
        }
    ],
)
```

**Trade-offs:** Gemini 2.5 Flash is good; GPT-4o Mini is comparable. Claude Opus 4.6 ($5.00/1M) is premium but 33× costlier. For MVP: start Gemini 2.5 Flash, measure user satisfaction, upgrade only if needed.

---

## Summary Table

| Decision | Recommendation | Rationale |
|----------|---|---|
| Navigation | Expo Router native tabs | SDK 52 stable; no material-top-tabs issues |
| Glassmorphism | expo-blur + opacity View | Official Expo; no native build req. |
| Sparkle | Skia + Reanimated v3 worklets | 60fps GPU particles; zero JS thread |
| EXIF/GPS | expo-media-library | Native; fallback to react-native-exif on Android 30 |
| Firebase | JS SDK → rnfirebase (post-MVP) | Expo Go compatible; FCM later via prebuild |
| State Mgmt | Zustand | 1KB; solo dev friendly; scale to Redux Toolkit |
| Camera | expo-camera + custom UI | Built-in; sufficient for post-capture AI; Vision Camera if real-time ML needed |
| FastAPI | Router → Service → Model layers | Modular; reusable; scalable |
| Vision AI | Gemini 2.5 Flash | Best MVP cost; $0.15/1M tokens; 1M context |

---

## Unresolved Questions
- Will offline photo analysis be required? (affects Vision AI strategy)
- Do you need push notifications (FCM) in MVP? (affects Firebase SDK choice timing)
- Will the app support batch processing multiple photos per day? (affects FastAPI concurrency design)

---

**Status:** DONE | **Summary:** Researched 9 technical decisions across React Native Expo, FastAPI, Firebase, and Vision AI. Prioritized stability (SDK 52 compatibility), cost-efficiency (Gemini 2.5 Flash), and developer velocity (Zustand, expo-camera). | **Concerns:** Android API 30 EXIF extraction has known issues; Firebase JS SDK lacks FCM (plan post-MVP migration to rnfirebase).
