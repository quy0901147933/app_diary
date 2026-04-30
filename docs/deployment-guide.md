# Deployment Guide — LuminaDiary

Hướng dẫn deploy backend FastAPI lên cloud + build EAS để cài app trên iPhone qua 4G/5G (không cần Mac chạy Metro).

## Tổng quan

```
┌─────────────────┐         ┌──────────────────────────┐
│  iPhone (4G/5G) │  HTTPS  │  Render (Singapore)      │
│  LuminaDiary.ipa├────────►│  FastAPI + uvicorn       │
└────────┬────────┘         │  scheduler + Gemini      │
         │                  └────────────┬─────────────┘
         │ JWT auth                      │ service-role
         │                               ▼
         │                  ┌──────────────────────────┐
         └─────────────────►│  Supabase (Postgres+RLS) │
                            └──────────────────────────┘
```

---

## GIAI ĐOẠN 1 — Deploy backend lên Render

Render có free tier (sleep sau 15 phút idle, cold start ~30s) và Singapore region (gần Việt Nam). Files cần thiết **đã có sẵn**:

- [`backend/Dockerfile`](../backend/Dockerfile) — image Python 3.12 slim, expose `$PORT`
- [`backend/requirements.txt`](../backend/requirements.txt) — pinned deps
- [`render.yaml`](../render.yaml) — Blueprint declarative

### Bước 1.1 — Đẩy code lên GitHub

```bash
cd /Users/huynhkhoi/quyhuynh/app_diary
git status
git add -A
git commit -m "chore: prepare deployment config"
gh repo create lumina-diary --private --source=. --push
# hoặc nếu đã có remote:
git push origin main
```

### Bước 1.2 — Tạo Render service từ Blueprint

1. Đăng nhập https://dashboard.render.com (sign up bằng GitHub)
2. **New** → **Blueprint** → connect repo `lumina-diary`
3. Render đọc `render.yaml` → tự setup service `lumina-diary-backend`
4. Bấm **Apply**

### Bước 1.3 — Điền environment variables (BẮT BUỘC)

Vào service vừa tạo → tab **Environment** → điền những biến `sync: false`:

| Key | Value | Lấy ở đâu |
|---|---|---|
| `SUPABASE_URL` | `https://nxtkdymcaiqyrjfikzzt.supabase.co` | Supabase Dashboard → Settings → API |
| `SUPABASE_SERVICE_ROLE_KEY` | `eyJhbGciOi...` | ↑ — phần `service_role` (KHÔNG phải anon) |
| `SUPABASE_JWT_SECRET` | `your-jwt-secret` | ↑ — Settings → API → JWT Secret |
| `GEMINI_API_KEY` | `AIza...` | https://aistudio.google.com/app/apikey |

Các biến khác (`SUPABASE_PHOTO_BUCKET`, `GEMINI_MODEL`, etc.) đã có default trong `render.yaml`.

→ Bấm **Save Changes** → Render tự rebuild + redeploy.

### Bước 1.4 — Verify deploy thành công

Đợi build xong (3-5 phút), URL sẽ là `https://lumina-diary-backend.onrender.com` (hoặc với suffix `-XXXX` nếu trùng tên).

```bash
curl https://lumina-diary-backend.onrender.com/health
# → {"status":"ok"}

curl https://lumina-diary-backend.onrender.com/openapi.json | grep -o '"/ai/[^"]*"' | sort -u
# → "/ai/comment", "/ai/mood-chart"
```

Nếu URL khác `lumina-diary-backend.onrender.com` → **cập nhật `eas.json`** trước khi build EAS:

```json
"env": {
  "EXPO_PUBLIC_AI_API_BASE_URL": "https://<URL-thực-tế>.onrender.com"
}
```

### Lưu ý free tier

- **Sleep sau 15 phút idle** → request đầu tiên sẽ chậm 30s (cold start). Để tránh: upgrade Starter ($7/tháng) hoặc thêm cron-job ping `/health` mỗi 10 phút.
- **Scheduler** (proactive Lumina, photo retry, daily packager) cần app alive → free tier ngủ thì miss giờ. **Strongly recommend Starter** nếu cần proactive messaging hoạt động đúng.

### Alternatives

| Platform | Free tier | Pro | Con |
|---|---|---|---|
| **Render** ✅ | Có (sleep) | Easy Blueprint, Docker, Singapore | Sleep ở free |
| **Railway** | $5 credit/tháng | Không sleep, deploy fast | Hết credit phải trả |
| **Fly.io** | Có (3 VM nhỏ) | Multi-region, không sleep | Cần CLI install |
| **Cloud Run** | 2M request/tháng free | Scale-to-zero, không sleep khi idle (luôn warm 1 instance trả phí) | Setup Docker + Artifact Registry phức tạp hơn |

Render Blueprint là path of least resistance vì đã có `render.yaml`.

---

## GIAI ĐOẠN 2 — Build EAS cho iPhone

Files đã có sẵn:
- [`eas.json`](../eas.json) — 3 profile: `development`, `preview`, `production`
- [`app.json`](../app.json) — bundleId `com.luminadiary.app`

### Bước 2.1 — Setup EAS account + project

```bash
# Cài EAS CLI nếu chưa có
npm install -g eas-cli

# Login (mở browser, sign up với email)
eas login

# Liên kết project hiện tại với Expo account
cd /Users/huynhkhoi/quyhuynh/app_diary
eas init
```

`eas init` sẽ tự cập nhật field `extra.eas.projectId` trong `app.json` (đang là placeholder `REPLACE_AFTER_eas_init`).

### Bước 2.2 — Inject Supabase Anon Key qua EAS Secret

Anon key là public (không phải service-role) nhưng để vào git không tốt. Dùng EAS Secret để inject tại build time:

```bash
# Lấy anon key từ Supabase Dashboard → Settings → API → anon public
eas secret:create --scope project --name EXPO_PUBLIC_SUPABASE_ANON_KEY --value "eyJhbGciOi..."

# Verify
eas secret:list
```

EAS sẽ tự inject biến này vào env khi build.

### Bước 2.3 — Cập nhật backend URL trong eas.json

Mở [`eas.json`](../eas.json), sửa cả `preview` và `production`:

```json
"env": {
  "EXPO_PUBLIC_AI_API_BASE_URL": "https://<RENDER-URL>.onrender.com",
  "EXPO_PUBLIC_SUPABASE_URL": "https://nxtkdymcaiqyrjfikzzt.supabase.co"
}
```

### Bước 2.4 — Đăng ký device để Ad-Hoc

Phải đăng ký UDID iPhone vào Apple Developer Portal trước khi cài Ad-Hoc IPA:

```bash
eas device:create
```

Lệnh này:
1. Tạo URL ngắn `https://expo.dev/register-device/...`
2. Hiện QR code trên terminal
3. Mở URL trên iPhone → cài cấu hình → System Settings → General → VPN & Device Management → Allow → device đăng ký xong

→ Yêu cầu Apple ID free vẫn được (không cần Apple Developer Program $99/năm cho Ad-Hoc nếu dùng Personal Team, nhưng app sẽ expire sau 7 ngày). **Có Developer Program ($99/năm)** thì IPA chạy 1 năm và push notification mới thực sự hoạt động.

### Bước 2.5 — Build preview (Ad-Hoc IPA)

```bash
eas build --platform ios --profile preview
```

Quá trình:
1. EAS hỏi Apple ID → đăng nhập
2. Hỏi credentials → chọn **Let EAS handle** (auto generate cert + provisioning profile cho devices đã `device:create`)
3. Upload code lên EAS Build server (Singapore/US) → build trên Mac runner cloud → 10-20 phút
4. Khi xong → trả về:
   - **Build URL**: `https://expo.dev/accounts/.../builds/<id>`
   - **QR Code** trong terminal — scan bằng Camera iPhone
   - **Install link**: `https://expo.dev/accounts/.../builds/<id>` mở trên iPhone Safari → tap **Install**

### Bước 2.6 — Cài lên iPhone

Trên iPhone:
1. Mở Camera → quét QR từ terminal (hoặc mở build URL trên Safari)
2. Tap **Install** → app tải về
3. Lần đầu mở: **Settings → General → VPN & Device Management → trust certificate**
4. Mở app — chạy hoàn toàn qua 4G/5G, không cần Mac

### Bước 2.7 — Update sau này (OTA hoặc rebuild)

Có 2 lựa chọn khi cập nhật code:

| Loại thay đổi | Cách |
|---|---|
| JS/TSX/UI/logic không native | `eas update --branch preview` — push OTA, app tự pull khi mở |
| Native changes (config plugin, package mới với native code, version bump) | `eas build --profile preview` lại từ đầu |

Setup OTA:
```bash
eas update:configure
# rồi mỗi lần thay đổi:
eas update --branch preview --message "fix mood chart"
```

---

## Checklist tổng hợp

### Backend ☁️
- [ ] Push code lên GitHub
- [ ] Render → New Blueprint → chọn repo
- [ ] Điền 4 secrets (`SUPABASE_URL`, `SERVICE_ROLE_KEY`, `JWT_SECRET`, `GEMINI_API_KEY`)
- [ ] Verify `curl /health` trả `{"status":"ok"}`
- [ ] Verify `/ai/mood-chart` xuất hiện trong `/openapi.json`
- [ ] (Optional) Upgrade Starter $7/tháng nếu cần scheduler/proactive

### Frontend 📱
- [ ] `npm install -g eas-cli`
- [ ] `eas login`
- [ ] `eas init` (cập nhật projectId trong app.json)
- [ ] `eas secret:create EXPO_PUBLIC_SUPABASE_ANON_KEY`
- [ ] Cập nhật `EXPO_PUBLIC_AI_API_BASE_URL` trong eas.json (preview + production) nếu Render URL khác mặc định
- [ ] `eas device:create` → đăng ký iPhone
- [ ] `eas build --platform ios --profile preview`
- [ ] Quét QR / mở install link trên iPhone
- [ ] Trust certificate trong Settings
- [ ] Mở app, đăng nhập Google, test mood-chart

---

## Troubleshooting

| Vấn đề | Khả năng | Fix |
|---|---|---|
| Backend `Connection refused` từ iPhone | Render service đang sleep (free tier) | Đợi 30s cold start hoặc upgrade Starter |
| App build fail "Could not find provisioning profile" | iPhone chưa đăng ký device | Chạy lại `eas device:create` |
| App mở lên trắng | Anon key sai hoặc backend URL sai | Verify env: `eas build:inspect` để xem env injected |
| Mood chart "Network request failed" trên 4G | Backend URL sai trong eas.json | Update eas.json + rebuild |
| Push notification không hoạt động | Cần Apple Developer Program ($99) | Upgrade hoặc accept không có push |
| App tự thoát sau 7 ngày | Personal Team certificate expire | Rebuild & cài lại; hoặc mua Developer Program để cert 1 năm |
