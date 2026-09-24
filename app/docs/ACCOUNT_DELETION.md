# Xóa tài khoản

Tài liệu này mô tả đúng trạng thái triển khai hiện tại. Không dùng nội dung này làm Privacy Policy đã công bố.

## Luồng đã có

- Trong ứng dụng: `Tùy chọn` → `Xóa tài khoản`.
- Trên web: `/account-deletion`. Trang này cho phép người đã gỡ ứng dụng đăng nhập và gửi yêu cầu mà không phải cài lại ứng dụng.
- Người dùng xem được trạng thái `PENDING`, `PROCESSING`, `COMPLETED`, `CANCELLED` hoặc `FAILED` của chính họ.
- RPC chỉ nhận yêu cầu từ phiên được tạo trong 15 phút gần nhất. Phiên cũ phải đăng xuất và đăng nhập lại.
- Gửi lặp lại là idempotent. Yêu cầu đang `PROCESSING` không bị đưa ngược về `PENDING`; yêu cầu `FAILED` có thể được gửi lại.
- RLS và RPC không cho người dùng xem hoặc thay đổi yêu cầu của tài khoản khác.

Trang web cần được phát hành trên domain HTTPS chính thức rồi điền URL đầy đủ vào Play Console. Google Play yêu cầu cả đường xóa trong ứng dụng và tài nguyên web hoạt động; tài nguyên web phải cho phép gửi yêu cầu mà không buộc cài lại ứng dụng: <https://support.google.com/googleplay/android-developer/answer/13327111?hl=en>.

## Phần đang giữ tắt

Edge Function `delete-account` chưa được UI gọi và chưa được coi là sẵn sàng production. Việc ghi một hàng `PENDING` không đồng nghĩa tài khoản đã bị xóa.

Trước khi bật worker/xóa thật, chủ dự án cần chốt:

1. Khoản vay đang hoạt động và các bản ghi trả nợ đang chờ sẽ được xử lý thế nào.
2. Loại lịch sử chung nào được giữ ở dạng ẩn danh, căn cứ và thời hạn giữ.
3. Người còn lại được xem và thao tác gì sau khi một thành viên bị xóa.
4. Tên đơn vị vận hành, email hỗ trợ và thời gian xử lý cam kết để đưa vào trang công khai.

Schema hiện xóa cascade hồ sơ cá nhân, tùy chọn, thiết bị push và idempotency data khi `auth.users` bị xóa; các khóa tác nhân của lịch sử tài chính chuyển thành `NULL`. Đây là cơ chế kỹ thuật hiện có, chưa thay thế quyết định retention và thẩm định pháp lý.

## Kiểm thử

- `supabase/tests/account_deletion.test.sql` kiểm tra fresh session, quyền đọc, idempotency, retry và bảo toàn `PROCESSING`.
- `npm run db:test` chạy toàn bộ regression database.
- Browser journey kiểm tra trang web công khai tải được, mô tả đúng mục đích và có đường đăng nhập.
