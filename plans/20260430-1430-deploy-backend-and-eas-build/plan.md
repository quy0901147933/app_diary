# Plan: Deploy Backend & Build iOS với EAS

**Mục tiêu:** LuminaDiary chạy độc lập trên iPhone qua 4G/5G, không phụ thuộc Mac dev server.

## Phase 1 — Deploy Backend (FastAPI) lên Render
- [x] Tạo `backend/Dockerfile` (Python 3.12-slim, uvicorn, bind `$PORT`)
- [x] Tạo `backend/.dockerignore`
- [x] Tạo `render.yaml` (Infrastructure-as-Code, declarative)
- [x] Cập nhật `backend/.env.example` mô tả biến cần set trên Render
- [ ] **User action (awaiting user):** Push code lên GitHub
- [ ] **User action (awaiting user):** Connect repo vào Render, set env vars (Supabase keys, Gemini key)
- [ ] **User action (awaiting user):** Verify backend URL `/health` returns 200 OK

## Phase 2 — EAS Build cho iOS Internal Distribution
- [x] Tạo `eas.json` với 3 profiles: `development`, `preview` (Internal Distribution), `production`
- [x] Cập nhật `app.json` thêm `extra.eas.projectId` placeholder
- [x] Cập nhật `.env.example` ghi chú backend URL
- [ ] **User action (awaiting user):** Cập nhật `.env` với URL backend live
- [ ] **User action (awaiting user):** `npm install -g eas-cli && eas login`
- [ ] **User action (awaiting user):** `eas build:configure` (link project) → cập nhật `extra.eas.projectId`
- [ ] **User action (awaiting user):** `eas device:create` (đăng ký iPhone — Ad-Hoc cần UDID)
- [ ] **User action (awaiting user):** `eas build -p ios --profile preview` → nhận QR + Expo Install link

## Quan trọng cần biết trước
1. **Scheduler in-process (APScheduler):** Render Free SLEEP sau 15p inactivity → scheduler tasks (daily blog 22:00, photo-retry mỗi 2 phút, proactive AI mỗi 2h) sẽ KHÔNG chạy trong giờ ngủ. Nếu cần đáng tin cậy → upgrade Render Starter ($7/tháng) hoặc dùng Fly.io free always-on.
2. **`EXPO_PUBLIC_*` được bake vào bundle tại build time:** Mỗi lần đổi backend URL phải build lại app.
3. **iOS Internal Distribution `--profile preview`:** Yêu cầu Apple Developer account ($99/year) để register device UDID. Nếu không có, dùng EAS "Ad-hoc with Free Apple ID" hoặc TestFlight.
4. **CORS:** Backend phải allow origin của app build production — set `CORS_ORIGINS=*` cho personal use đơn giản (vì JWT đã bảo vệ mọi route).
