# Xóa tài khoản (Account Deletion) — LOAN

Cập nhật: 25/09/2026

Tài liệu này mô tả chi tiết cơ chế xóa tài khoản và bảo vệ dữ liệu đã được triển khai trong dự án LOAN.

---

## 1. Cơ chế và luồng hoạt động

### a. Điểm truy cập của người dùng

- **Trong ứng dụng di động:** `Cài đặt (Settings)` → `Xóa tài khoản`.
- **Trên trình duyệt web:** Đường dẫn `/account-deletion`. Người dùng đã gỡ ứng dụng có thể đăng nhập trên web để gửi và theo dõi yêu cầu xóa mà không bắt buộc phải cài đặt lại ứng dụng (tuân thủ yêu cầu bắt buộc của Google Play: <https://support.google.com/googleplay/android-developer/answer/13327111?hl=en>).

### b. Kiểm soát an toàn & Quy tắc nghiệp vụ

1. **Xác thực phiên mới (Fresh Re-authentication):** Yêu cầu xóa chỉ được chấp thuận nếu phiên đăng nhập (`auth.sessions`) được tạo trong vòng 15 phút gần nhất. Phiên cũ phải đăng nhập lại để đảm bảo an toàn chính chủ.
2. **Quy tắc chặn xóa (Deletion Blockers):** Người dùng **không thể xóa tài khoản** nếu vẫn còn:
   - Khoản vay đang trong trạng thái `DRAFT`, `PENDING` hoặc `ACTIVE`.
   - Giao dịch trả nợ (`repayments`) đang trong trạng thái `PENDING` hoặc `DISPUTED`.
   - Hệ thống hiển thị rõ số lượng khoản vay và giao dịch đang chặn xóa để người dùng tất toán trước khi xóa.
3. **Thao tác xóa có khóa cạnh tranh và khả năng phục hồi:**
   - Client gọi `request_account_deletion()` để ghi nhận trạng thái `PENDING`.
   - Client gọi Edge Function `delete-account` được bảo vệ bằng JWT.
   - Edge Function gọi RPC quản trị `claim_account_deletion` (chỉ cấp quyền cho `service_role`) để lấy cùng advisory lock với các thay đổi tài chính, kiểm tra lại blocker và chuyển sang `PROCESSING`.
   - Trigger database từ chối tạo/sửa khoản vay, thành viên, lời mời, trả nợ hoặc thiết bị push liên quan sau khi deletion đã ở `PROCESSING`.
   - Edge Function thực thi lệnh xóa người dùng trên Supabase Auth Admin (`auth.admin.deleteUser`).
   - Postgres tự động kích hoạt `CASCADE` dọn sạch hồ sơ cá nhân (`profiles`), thiết bị push (`push_devices`), tùy chọn (`notification_preferences`) và idempotency keys.
   - RPC `finish_account_deletion` xóa trường văn bản tự do có thể chứa PII và ghi trạng thái hoàn tất vào `private.account_deletion_audit`.
   - Edge Function `reconcile-account-deletions` xử lý claim bị gián đoạn; tối đa 5 lần tự động trước khi cần can thiệp vận hành.
4. **Bảo toàn tính toàn vẹn sổ sách tài chính:**
   - Trong các phòng vay đã tất toán, người đối tác còn lại vẫn thấy lịch sử giao dịch để bảo toàn sổ sách của họ.
   - Các khóa ngoại trỏ tới tài khoản đã xóa chuyển thành `NULL` hoặc nhãn vô danh (`Former participant`).
   - Số tiền, ngày và trạng thái được giữ cho đối tác; `purpose`, `note` và `method` dạng văn bản tự do được xóa.
   - Audit kỹ thuật được giữ tối đa 180 ngày và chỉ `service_role` có thể chạy tác vụ dọn định kỳ.
5. **Dọn sạch phía Client:**
   - Client tự động xóa local auth session, hủy token push trên thiết bị và chuyển hướng về màn hình chào.

---

## 2. Kiểm thử và Xác minh

- **Kiểm thử SQL (pgTAP):** `supabase/tests/account_deletion.test.sql` (42 assertions) kiểm tra:
  - Phân quyền RLS (chặn gọi trái phép từ anonymous/authenticated đối với RPC quản trị).
  - Kiểm tra điều kiện chặn: người còn nợ/khoản vay active bị từ chối xóa; người đủ điều kiện được xóa.
  - Tính idempotent của request, fresh re-authentication và ghi nhận audit log.
- **Kiểm thử cạnh tranh:** `scripts/test-db-concurrency.mjs` kiểm tra tạo khoản vay và claim xóa chạy đồng thời chỉ có một phía được commit.
- **Kiểm thử Edge Function local:** `scripts/test-account-deletion-local.mjs` xóa Auth user thật trên Supabase local, kiểm tra lịch sử đã ẩn danh/làm sạch và phục hồi claim stale qua reconciliation.
- **Kiểm thử Unit Test (Vitest):** `src/lib/auth.test.ts` kiểm tra trạng thái xóa tài khoản, gọi Edge Function và xử lý dọn dẹp local session.
- **Kiểm thử Web (Playwright):** Màn hình web `/account-deletion` tải được độc lập, hiển thị cảnh báo và kết nối đúng luồng đăng nhập.

---

## 3. Các mục còn lại trước khi phát hành Google Play

1. **Cloud:** Áp dụng các migration ngày 25/09 lên STAGING rồi PRODUCTION sau khi dry-run.
2. **Deploy:** Deploy `delete-account` và `reconcile-account-deletions`, cấu hình secret reconciliation qua Supabase Secrets/Vault.
3. **Lịch vận hành:** Chạy reconciliation mỗi 5 phút và `purge_account_deletion_audit(180)` hằng ngày; xác minh cảnh báo khi retry chạm ngưỡng.
4. **Nghiệm thu STAGING:** Xóa một tài khoản tổng hợp có lịch sử đã tất toán và kiểm tra đối tác vẫn đọc được phần lịch sử đã ẩn danh.
