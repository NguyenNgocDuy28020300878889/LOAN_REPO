# Phase 2 — Repository & Foundation: Loan

**Trạng thái:** Đang thực hiện  
**App root:** `app/`

## Đã hoàn thành

- [x] Khởi tạo Git repository cục bộ và liên kết remote `LOAN_REPO`.
- [x] Khởi tạo Expo SDK 57 default template với Expo Router và TypeScript.
- [x] Liên kết Expo project `@loanappmobiles-team/loanapp` và cấu hình EAS build profiles.
- [x] Đặt Expo `name`, `slug`, URL scheme thành `Loan` / `loanapp` / `loan`.
- [x] Chốt Android package và iOS bundle identifier: `com.loanappmobiles.loanapp`.
- [x] Bật TypeScript strict.
- [x] Tạo `.env.example` và typed public env skeleton tại `src/lib/env.ts`.
- [x] Ghi rõ ranh giới DEV/STAGING/PROD và secret handling tại `docs/ENVIRONMENTS.md`.
- [x] Tạo localization skeleton tại `src/i18n/`.
- [x] Cài và cấu hình TanStack Query, Zustand, React Hook Form + Zod, i18next và Expo Localization.
- [x] Tạo Query provider, i18n bootstrap và UI-state store rỗng.
- [x] Cài Sentry SDK và tạo monitoring skeleton không gửi PII hoặc event khi chưa có DSN.
- [x] Cấu hình ESLint/Prettier, Vitest và GitHub Actions quality workflow.
- [x] Khai báo Supabase development/staging URL trong `.env` (untracked) và Supabase client skeleton với lazy initialization.
- [x] TypeScript check pass: `node node_modules\\typescript\\bin\\tsc --noEmit`.

## Cấu hình hoãn

- Android application ID và iOS bundle identifier: chốt trước store build.
- Supabase credentials và Sentry DSN: thêm vào `.env` cục bộ, không commit.
- Supabase publishable keys: điền vào các biến `EXPO_PUBLIC_SUPABASE_*_PUBLISHABLE_KEY` tương ứng trước khi gọi client.

## Chạy cục bộ

Trong thư mục `app/`:

```powershell
cmd /c npx expo start
```

## Tiêu chí Phase 2 còn lại

- [x] Cấu trúc DEV/STAGING/PROD và biến môi trường có kiểm chứng tĩnh.
- [x] Android production build đã khởi tạo trên EAS: `ead21548-3afb-4d13-a07b-8bae56fb615c`.
- [ ] iOS production build: cần hoàn tất remote iOS credentials bằng interactive EAS command.
- [ ] Web route export: Metro bundler không hoàn tất trong giới hạn phiên chạy hiện tại; cần chạy cục bộ với `npx expo export --platform web`.
