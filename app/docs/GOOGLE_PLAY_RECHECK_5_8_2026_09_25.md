# Rà soát bước 5–8 — 25/09/2026

Phạm vi: mã nguồn và tài liệu trong worktree hiện tại (có thay đổi chưa commit), kiểm thử unit/typecheck, kiểm tra Auth/API cloud chỉ đọc, Playwright trên website công khai và đối chiếu tài liệu chính thức. Không deploy, sửa database hoặc gửi Play Console trong lượt rà soát này.

## Bước 5 — Chưa đạt nghiệm thu

1. **P1 — Bằng chứng pgTAP không khớp file.** `supabase/tests/account_deletion.test.sql:4` khai báo `plan(24)` nhưng file chỉ có 23 lệnh assertion. Khối `DO` cuối file không phải assertion và không gọi Auth Admin để xóa user. Sau `reset role`, khối này cũng không chuyển sang `service_role` dù comment ghi như vậy. Chưa có kiểm thử thực tế cho toàn bộ Edge Function, cascade/retention, blocker giao dịch DISPUTED hoặc retry sau khi user đã bị xóa. Không được coi đây là 24 assertions đã xanh.
2. **P1 — Khoảng hở đồng thời giữa kiểm tra nghĩa vụ và xóa Auth.** `claim_account_deletion` chỉ khóa hàng request; việc kiểm tra blocker và `auth.admin.deleteUser` diễn ra ở các giao dịch khác nhau. Chưa thấy rào chắn trạng thái deletion trong các RPC tạo/tham gia khoản vay để loại trừ nghĩa vụ mới phát sinh trong khoảng này. Cần khóa/guard thống nhất và kiểm thử cạnh tranh trước khi đóng nghiệm thu; đây là rủi ro phát hiện từ code, chưa tái hiện runtime.
3. **P1 — Audit có thể mắc ở PROCESSING.** Edge Function vẫn trả success nếu `finish_account_deletion` lỗi sau khi Auth đã xóa user. User không còn đăng nhập để retry và chưa có worker reconciliation bền vững. Cần kiểm chứng phục hồi khi process chết sau deleteUser hoặc khi ghi audit thất bại.
4. **Chính sách chưa hoàn thiện.** `PRIVACY_POLICY.md` còn placeholder tên chủ thể/email/domain; email trên web là `support@duyhaohan.id.vn`, khác email trong store listing. Cần xác nhận kênh hỗ trợ hoạt động, thống nhất nội dung và quy định thời hạn/lý do giữ lịch sử, audit, backup. Đổi foreign key sang NULL không tự xóa thông tin cá nhân người dùng có thể ghi trong purpose/note.

Đã xác nhận UI gọi request rồi invoke Edge Function, có blocker/fresh sign-in và trang web công khai. Chưa xác nhận deployment Edge Function hoặc xóa end-to-end trên cloud. Docker local không chạy nên chưa chạy lại pgTAP; lỗi đếm assertions là đối chiếu tĩnh, không phải kết quả chạy SQL.

Google yêu cầu xóa dữ liệu liên quan, công khai lý do giữ dữ liệu hợp lệ và cung cấp đường hỗ trợ khi cần thêm bước trước khi xóa: [Account deletion requirements](https://support.google.com/googleplay/android-developer/answer/13327111?hl=en).

## Bước 6 — Đạt kiểm tra kết nối, chưa đạt vận hành

- Chạy lại `node scripts/check-cloud-connections.mjs`: DEV, STAGING, PRODUCTION đều PASS. Script kiểm tra Auth health, publishable key, email confirmation, chặn anonymous ở `get_my_loans` và bảng `loans`. Script không kiểm tra `repayments`, toàn bộ RPC, RLS giữa hai tài khoản, migration history, Google login, backup hoặc Edge Functions. Không mở rộng kết luận vượt phạm vi này.
- Có 25 migration files trong nguồn không tự chứng minh cloud đã áp dụng đủ. Chưa xác minh migration history production trong lượt này.
- `PRODUCTION_OPERATIONS.md` còn checklist trống cho OAuth, backup, deletion deployment; phần restore/alert/kill-switch là hướng dẫn, chưa có log diễn tập, người nhận alert hoặc Sentry canary/source maps chứng minh vận hành.
- Runbook ghi Pro có 7 ngày PITR là không chính xác: PITR là add-on, khác daily backup. Xem [Supabase Database Backups](https://supabase.com/docs/guides/platform/backups).
- Unit tests của sanitizer chứng minh các tình huống được kiểm thử; không chứng minh tuyên bố “lọc sạch 100% PII” cho toàn bộ SDK/native telemetry.

## Bước 7 — Chưa đạt nghiệm thu artifact

- Env trong `eas.json` profile production vượt `assertBuildEnvironment`; chạy CLI trực tiếp trong shell local lại bị từ chối vì app env không phải production. Đây là khác biệt nguồn env, không phải bằng chứng EAS build hỏng.
- **API trong kế hoạch đã lỗi thời:** Google hiện yêu cầu API 36 từ 31/08/2026 cho app mobile mới/cập nhật; kiểm tra gia hạn trong Console nếu có. Chưa đọc manifest AAB nên chưa kết luận artifact hiện tại sai target. [Target API requirements](https://support.google.com/googleplay/android-developer/answer/11926878?hl=en).
- Playwright mở `/privacy-policy`, `/terms`, `/account-deletion` và `/.well-known/assetlinks.json` trên cả `https://loan.duyhaohan.id.vn` và `https://loan-web-seven.vercel.app`: tất cả HTTP 200, không thấy tràn ngang ở viewport 390 × 844. Bấm Sign in từ trang deletion chuyển đúng `/auth?returnTo=%2Faccount-deletion` trên cả hai host. Không thực hiện Google sign-in hoặc xóa thật.
- **P1 — App Links chưa hợp lệ:** cả file nguồn lẫn JSON live trên hai host có SHA-256 toàn số 0. Cần fingerprint Play App Signing thực và kiểm tra link bằng bản cài từ Play.
- Production profile đặt `EXPO_PUBLIC_EMAIL_OTP_READY=false` và `EXPO_PUBLIC_PUSH_READY=false`; trang auth web cũng báo email delivery chưa sẵn sàng. Hồ sơ phải khớp phạm vi thực tế.
- Build ID/versionCode/link AAB hiện là bằng chứng được ghi lại trong kế hoạch. Lượt này chưa xác minh EAS metadata, tải/kiểm tra AAB, hash, manifest, chữ ký, ABI/16 KB, source commit khớp worktree hoặc native internal-testing journey. Không đánh đồng EAS build thành công với nghiệm thu artifact.

## Bước 8 — Có bản thảo, chưa sẵn sàng nộp

- **P1 — Reviewer access chưa đủ:** listing chỉ ghi hai email mẫu và đề nghị reviewer dùng Google cá nhân/OTP, chưa có bằng chứng tài khoản truy cập được hoặc thông tin đăng nhập đầy đủ. Google yêu cầu thông tin đăng nhập hoạt động, tái sử dụng được và chỉ dẫn đủ cho social login/OTP: [Sign-in details for review](https://support.google.com/googleplay/android-developer/answer/15748846?hl=en). Cần kiểm thử cả hai vai trò trước khi nộp.
- Closed testing áp dụng cho tài khoản cá nhân tạo sau 13/11/2023: ít nhất **12 testers opt-in liên tục 14 ngày**, không phải 20. Có thể tuyển 20 để dự phòng. Chưa có bằng chứng track, opt-in, phản hồi hoặc đủ điều kiện production. [Testing requirements](https://support.google.com/googleplay/android-developer/answer/14151465?hl=en).
- Listing quảng bá Email và nhắc hạn push trong khi profile production tắt cả hai. Cần sửa nội dung hoặc triển khai/nghiệm thu các tính năng trước khi quảng bá.
- Data Safety còn URL `[DOMAIN]`, cần đối chiếu user IDs/avatar/dữ liệu SDK và căn cứ ngoại lệ service-provider hoặc chia sẻ do người dùng chủ động trước khi khẳng định “không chia sẻ bất kỳ dữ liệu nào”. Có dịch vụ bên thứ ba không tự động đồng nghĩa phải chọn Shared=Yes; cần phân loại theo thực tế.
- Chưa có bằng chứng hoàn tất ảnh chụp/feature graphic, khai báo trong Console, rating questionnaire hoặc reviewer thử thành công. “18+” là target audience, không thay thế content rating. Phân loại tài chính trong tài liệu là đề xuất cần khớp chức năng và lựa chọn Console; không phải xác nhận Google đã chấp thuận.

## Kết quả kiểm tra mới và thứ tự xử lý

- `npm test`: **24 test files, 107 tests PASS**.
- `npm run typecheck`: PASS.
- Cloud read-only: 3 môi trường PASS trong phạm vi script nêu trên.
- Preflight từ env production profile: PASS.
- Playwright: trang công khai và chuyển sang auth PASS trong phạm vi nêu trên; fingerprint App Links FAIL.

Ưu tiên: sửa/kiểm thử deletion và bằng chứng SQL → xác minh cloud migrations/OAuth/Edge Function/backup-monitoring → sửa App Links và nghiệm thu AAB target/16 KB/internal testing → thống nhất policy/listing/reviewer access → chạy closed testing. Các bước 5–8 đều còn điều kiện mở; chưa đủ cơ sở nghiệm thu phát hành.
