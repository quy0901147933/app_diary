# Google Sign-In setup (Expo Go phase)

Tài liệu hướng dẫn cấu hình **Đăng nhập với Google** cho LuminaDiary trong giai đoạn dev/test trên Expo Go (chưa publish App Store / Play Store).

## Kiến trúc

```
App (Expo Go)
   │ tap "Tiếp tục với Google"
   ▼
supabase.auth.signInWithOAuth({ provider: 'google' })
   │ trả về URL Google OAuth
   ▼
WebBrowser.openAuthSessionAsync(url, redirectTo)
   │ user xác thực ở Google
   ▼
Google → Supabase callback (verify ID token)
   │
   ▼
Supabase redirect → luminadiary://auth-callback#access_token=...
   │
   ▼
App parse URL → supabase.auth.setSession(...)
   │
   ▼
onAuthStateChange → useAuthStore.setSession → AuthGate routes vào app
```

Không cần Apple Developer Account, không cần native code, không prebuild.

## Bước 1 — Google Cloud Console

1. Vào https://console.cloud.google.com → tạo project (hoặc dùng project có sẵn).
2. Bật **Google Identity Platform** (mặc định đã có).
3. **APIs & Services → OAuth consent screen**:
   - User Type: External
   - App name: LuminaDiary
   - User support email + Developer email: email của bạn
   - Scopes: thêm `openid`, `email`, `profile`
   - Test users: thêm Gmail bạn dùng để test
4. **APIs & Services → Credentials → + Create credentials → OAuth client ID**:
   - Application type: **Web application**
   - Name: `LuminaDiary Web (Supabase)`
   - **Authorized redirect URIs**:
     ```
     https://<your-project-ref>.supabase.co/auth/v1/callback
     ```
     (Lấy URL chính xác từ Supabase Dashboard → Authentication → Providers → Google.)
5. Lưu lại **Client ID** và **Client Secret**.

## Bước 2 — Supabase Dashboard

1. Vào https://supabase.com/dashboard → project của bạn.
2. **Authentication → Providers → Google**: bật toggle.
3. Paste **Client ID** và **Client Secret** từ bước 1.
4. **Redirect URLs** (Authentication → URL Configuration → Redirect URLs): thêm
   ```
   luminadiary://auth-callback
   exp://*
   ```
   - `luminadiary://auth-callback` — scheme khi chạy production / dev client
   - `exp://*` — wildcard cho Expo Go (URL có dạng `exp://192.168.x.x:8081/--/auth-callback`)
5. Lưu.

## Bước 3 — Test

```bash
npm start
```

- Mở Expo Go → quét QR
- Tap **Tiếp tục với Google**
- Browser mở → đăng nhập Gmail (phải là test user đã thêm ở bước 1.3)
- Browser đóng, app nhận session, AuthGate route vào màn home/onboarding

## Troubleshooting

| Lỗi | Nguyên nhân | Fix |
|---|---|---|
| `redirect_uri_mismatch` | Redirect URI ở Google Console không khớp Supabase callback | Copy chính xác URL từ Supabase, paste vào Google Console |
| Browser đóng nhưng app không nhận session | Redirect URL chưa thêm vào Supabase | Thêm `exp://*` và `luminadiary://auth-callback` vào Supabase |
| `access_denied` ở Google | Chưa thêm Gmail vào Test users (consent screen còn ở chế độ Testing) | Thêm Gmail vào Test users hoặc publish consent screen |
| `Invalid login credentials` từ Supabase | Client ID/Secret nhập sai | Kiểm tra lại ở Google Console + Supabase Provider page |

## Khi chuẩn bị publish App Store / Play Store

Sẽ phải migrate sang **`@react-native-google-signin/google-signin`** (native flow) + **Sign in with Apple** (`expo-apple-authentication`) để pass App Review Guideline 4.8. Lúc đó:
- Cần Apple Developer Program ($99/năm)
- Cần EAS Build / dev client (không chạy được trong Expo Go nữa)
- Tạo thêm iOS + Android OAuth client trong Google Console
- Lấy SHA-1 fingerprint từ EAS keystore cho Android client

Phase đó nằm ngoài scope hiện tại.
