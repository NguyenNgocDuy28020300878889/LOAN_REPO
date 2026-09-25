# Kế hoạch Vận hành & Backend Production (Production Operations Runbook) — LOAN

Cập nhật: 24/09/2026

Tài liệu này định nghĩa quy trình thiết lập, kiểm soát an toàn, triển khai migration, giám sát và phục hồi sự cố cho môi trường **PRODUCTION** của LOAN trước khi phát hành lên Google Play.

---

## 1. Phân tách và Cô lập môi trường (Environment Isolation)

LOAN duy trì sự cô lập tuyệt đối giữa 3 môi trường:

| Môi trường      | Profile EAS   | Định danh ứng dụng (Package ID)      | Custom Scheme  | Backend đích                                         | Dữ liệu                         |
| :-------------- | :------------ | :----------------------------------- | :------------- | :--------------------------------------------------- | :------------------------------ |
| **Development** | `development` | `com.loanappmobiles.loanapp.dev`     | `loan-dev`     | Supabase Local / Hosted DEV (`rwfmqthrpbkizcofullh`) | Dữ liệu giả lập / Test fixtures |
| **Staging**     | `preview`     | `com.loanappmobiles.loanapp.staging` | `loan-staging` | Hosted STAGING (`kircmwdkcdcozckrwfid`)              | Dữ liệu QA / Synthetic E2E      |
| **Production**  | `production`  | `com.loanappmobiles.loanapp`         | `loan`         | Hosted PRODUCTION (Project riêng biệt)               | **Chỉ dữ liệu người dùng thật** |

### Quy tắc an toàn bắt buộc:

1. **Không dùng chung Backend:** Cơ chế `build-environment.cjs` tự động kiểm tra và **chặn đứng quá trình build** nếu profile Production trỏ nhầm vào URL/Project Ref của Staging hoặc Development.
2. **Không chia sẻ thông tin định danh:** Người dùng, phiên đăng nhập (Auth Sessions), token thông báo đẩy (Push Tokens) và bản ghi tài chính của Production hoàn toàn tách rời, không bao giờ được sao chép sang Staging/DEV để debug.
3. **App Links & Deep Links:** Production sử dụng scheme độc quyền `loan://` và domain HTTPS chính thức đã xác minh qua `assetlinks.json`.

---

## 2. Danh mục & Kế hoạch triển khai Migrations lên Production

Môi trường Production phải nhận đủ toàn bộ **25 file migrations** theo đúng thứ tự thời gian:

1. `20260822053803_initial_schema.sql` — Schema khởi tạo: profiles, loans, loan_members, repayments, loan_events.
2. `20260822062823_auth_idempotency_foundation.sql` — Idempotency keys, tài khoản, profile triggers.
3. `20260822063132_loan_invite_rpcs.sql` — RPC tạo lời mời và tham gia khoản vay.
4. `20260822072000_invite_preview_rpc.sql` — RPC xem trước lời mời.
5. `20260822074000_shared_loan_room_read_rpcs.sql` — RPC đọc phòng vay chung.
6. `20260822080000_realtime_loan_room.sql` — Kích hoạt Supabase Realtime cho phòng vay.
7. `20260822083000_repayment_integrity_rpcs.sql` — RPC đề xuất, xác nhận, tranh chấp trả nợ.
8. `20260822084500_repayment_read_rpc.sql` — RPC đọc chi tiết khoản trả nợ.
9. `20260822090000_notification_preferences.sql` — Tùy chọn thông báo của người dùng.
10. `20260822092000_account_deletion_audit.sql` — Bảng audit xóa tài khoản private.
11. `20260822100000_account_deletion_history_retention.sql` — Chính sách bảo toàn lịch sử khi xóa user.
12. `20260916060000_repayment_authorization_and_dispute_audit.sql` — Ràng buộc ủy quyền trả nợ và audit tranh chấp.
13. `20260916070000_invite_crypto_schema.sql` — Mã hóa token lời mời, SHA-256 tokens.
14. `20260916080000_command_receipts_and_settlement.sql` — Command receipts, tất toán tự động và xử lý tranh chấp nguyên tử.
15. `20260916090000_invite_management.sql` — Thu hồi, cấp lại lời mời.
16. `20260921001929_schema_completeness.sql` — Hoàn thiện chỉ mục (indexes) và ràng buộc toàn vẹn.
17. `20260921010849_push_notifications.sql` — Thiết bị push, outbox, worker và deduplication.
18. `20260921011552_push_notification_guards.sql` — Rào chắn bảo vệ thông báo.
19. `20260921012021_push_delivery_retries.sql` — Cơ chế retry gửi push thông minh.
20. `20260921140000_invite_notification_hint.sql` — Thông báo trong app khi có lời mời gửi theo email.
21. `20260923090000_create_loan_contract.sql` — Chuẩn hóa contract tạo khoản vay duy nhất, fingerprint command.
22. `20260923120000_invite_lifecycle.sql` — Vòng đời lời mời, hết hạn và chống đường vòng qua `loan_id`.
23. `20260923170000_security_boundary.sql` — Thu hồi quyền thừa trên helper schema private.
24. `20260924090000_account_deletion_request_safety.sql` — Bảo vệ request xóa tài khoản với fresh sign-in 15 phút.
25. `20260924110000_account_deletion_execution.sql` — Chặn xóa khi còn nợ, claim/finish nguyên tử cho Edge Function.

### Quy trình triển khai Migration an toàn:

```
[Tạo Project Mới] ──> [Dry-run Transaction] ──> [Áp dụng Migrations] ──> [Chạy Test pgTAP Rollback] ──> [Nghiệm thu Schema]
```

1. **Dry-run kiểm tra trước:** Áp dụng trên transaction tạm thời để phát hiện lỗi cú pháp hoặc xung đột schema mà không làm hỏng database.
2. **Áp dụng tuần tự:** Dùng `supabase db push` hoặc chạy tuần tự qua Supabase CLI kết nối trực tiếp đến production project.
3. **Kiểm thử hồi quy tự động:** Chạy toàn bộ bộ test pgTAP (`account_deletion.test.sql`, `security_boundary.test.sql`, `invite_lifecycle.test.sql`, `create_loan_contract.test.sql`,...) trong transaction tự động rollback, bảo đảm không lưu fixture rác trên production.
4. **Không sửa đổi migration lịch sử:** Mọi thay đổi tiếp theo bắt buộc viết migration bổ sung mới, tuyệt đối không sửa file cũ.

---

## 3. Kế hoạch Sao lưu và Phục hồi (Backup & Disaster Recovery)

### a. Cơ chế sao lưu

- **Sao lưu tự động hàng ngày (Automated Daily Backups):** Bật trên dự án Supabase Production. Bản sao lưu được lưu trữ độc lập trên hạ tầng đám mây an toàn.
- **Point-In-Time Recovery (PITR):** Khuyến nghị nâng cấp gói Supabase Pro cho Production để hỗ trợ khôi phục đến từng giây cụ thể khi có sự cố nghiêm trọng.

### b. Kịch bản diễn tập phục hồi (Recovery Drill Procedure)

Khi có sự cố cần khôi phục:

1. **Khôi phục vào instance cô lập (Staging/Drill Project):** Tuyệt đối không khôi phục đè trực tiếp lên production đang chạy khi chưa thẩm định tính toàn vẹn của dữ liệu sao lưu.
2. **Kiểm tra tính nhất quán tài chính:** Đối soát tổng số dư các khoản vay và lịch sử trả nợ để xác định dữ liệu không bị hỏng hóc hoặc mất mát logic.
3. **Bảo vệ quyền riêng tư sau phục hồi:** Chạy script đối chiếu các tài khoản đã bị xóa (`COMPLETED` trong `private.account_deletion_audit`) để đảm bảo không khôi phục nhầm trạng thái hoạt động của những người dùng đã thực hiện quyền xóa tài khoản.
4. **Chuyển hướng an toàn:** Sau khi xác minh thành công, mới trỏ DNS hoặc biến môi trường ứng dụng sang instance đã khôi phục.

---

## 4. Theo dõi Giám sát & Ứng phó sự cố (Monitoring & Incident Response)

### a. Lọc bỏ dữ liệu nhạy cảm (Telemetry Sanitization)

- Ứng dụng tích hợp **Sentry** với bộ lọc riêng [`telemetry-privacy.ts`](../src/lib/telemetry-privacy.ts):
  - Lọc sạch 100% email, số tiền vay, ghi chú tài chính, token lời mời và thông tin định danh cá nhân (PII).
  - Chỉ gửi các mã lỗi thuộc danh mục an toàn (`safeErrors` allowlist).
  - Tắt thu thập breadcrumbs và network request body để tránh rò rỉ dữ liệu ngoài ý muốn.

### b. Cảnh báo tự động (Alerting Thresholds)

Thiết lập cảnh báo tự động gửi về email của quản trị viên khi:

- Tỷ lệ lỗi 5xx trên API/REST vượt quá 2% trong vòng 5 phút.
- Có lỗi kết nối cơ sở dữ liệu (PostgreSQL connection pool exhaustion).
- Có spike bất thường về lỗi Auth hoặc thất bại trong Edge Function `delete-account`.

### c. Quy trình ngắt khẩn cấp (Emergency Kill-Switch)

Nếu phát hiện lỗ hổng logic hoặc sự cố dữ liệu:

- **Tạm khóa RPC nhạy cảm:** Thu hồi quyền `EXECUTE` tạm thời trên RPC `create_loan` hoặc `submit_repayment` từ role `authenticated` để chặn ghi nhận giao dịch mới mà không cần tắt toàn bộ database.
- **Bảo vệ người dùng:** Người dùng vẫn có thể xem lại số dư đã xác nhận mà không bị can thiệp sai lệch.

---

## 5. Quản lý Khóa ký, Secrets và Phân quyền

| Loại tài nguyên                            | Nơi lưu trữ an toàn                           | Nguyên tắc bảo mật                                                                                           |
| :----------------------------------------- | :-------------------------------------------- | :----------------------------------------------------------------------------------------------------------- |
| **Publishable Key (`sb_publishable_...`)** | EAS Environment Variables / Client            | Là key công khai, an toàn khi đóng gói trong ứng dụng. Phân quyền thực tế được kiểm soát qua RLS.            |
| **Service Role Key**                       | Supabase Dashboard Secrets / Edge Functions   | **TUYỆT ĐỐI KHÔNG** đưa vào mã nguồn, file cấu hình client hoặc repository Git. Chỉ dùng nội bộ trên server. |
| **Database Password**                      | Quản lý bảo mật cá nhân của Chủ dự án         | Không lưu vào bất kỳ file tài liệu nào.                                                                      |
| **Android Keystore (Khóa ký AAB)**         | EAS Managed Credentials (Expo)                | Được mã hóa và bảo vệ bởi dịch vụ ký của Expo, có sao lưu an toàn.                                           |
| **Google OAuth Client Secret**             | Google Cloud Console & Supabase Auth Provider | Chỉ khai báo tại Supabase Dashboard -> Authentication -> Providers.                                          |

---

## 6. Hạn mức Dịch vụ và Dự toán Chi phí (Quotas & Costs)

| Dịch vụ               | Gói khuyến nghị            | Chi phí dự kiến                                           | Lưu ý vận hành                                                                                                                                        |
| :-------------------- | :------------------------- | :-------------------------------------------------------- | :---------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Supabase**          | Pro Plan                   | ~25 USD/tháng                                             | Cần thiết cho Production để có 7 ngày PITR backup, không bị tự động tạm dừng (pause) sau 7 ngày không hoạt động, 100.000 MAU và 8GB database storage. |
| **Expo EAS**          | Free Tier / On-demand      | 0 USD (hoặc trả theo lượt build nếu cần ưu tiên hàng đợi) | Đủ cho việc build AAB chính thức và quản lý signing credentials.                                                                                      |
| **Sentry**            | Developer (Free)           | 0 USD                                                     | Hạn mức 5.000 lỗi/tháng (đủ cho giai đoạn Closed Testing và Launch đầu tiên).                                                                         |
| **Tên miền (Domain)** | Bất kỳ nhà cung cấp uy tín | ~10–15 USD/năm                                            | Dùng cho HTTPS App Links, trang Web xóa tài khoản và hosting Privacy Policy.                                                                          |

---

## 7. Checklist nghiệm thu Bước 6 trước khi phát hành

- [ ] Tạo dự án Supabase Production độc lập trên cloud.
- [ ] Áp dụng đủ 25 migration files lên Production và chạy kiểm thử hồi quy thành công.
- [ ] Cấu hình xác thực Google OAuth cho Production (Redirect URI: `https://<prod-ref>.supabase.co/auth/v1/callback`).
- [ ] Bật sao lưu tự động (Automated Backup / PITR) trên Production.
- [ ] Deploy Edge Function `delete-account` lên Production.
- [ ] Điền các biến môi trường Production vào EAS: `EXPO_PUBLIC_SUPABASE_PRODUCTION_URL`, `EXPO_PUBLIC_SUPABASE_PRODUCTION_PUBLISHABLE_KEY`, `EXPO_EXPECTED_SUPABASE_PROJECT_REF`, `EXPO_PUBLIC_APP_LINK_ORIGIN`.
- [ ] Chạy lệnh kiểm tra môi trường: `npm run check:build-env -- production` đạt kết quả hợp lệ.
