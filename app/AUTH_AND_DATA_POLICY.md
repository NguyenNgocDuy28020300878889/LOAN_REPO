# Authentication & Data Protection Policy — Loan MVP

## Auth scope

- **MVP:** Email/Password và Google OAuth.
- **Apple Sign In:** Hoãn đến Phase iOS release; không hiển thị như một lựa chọn đăng nhập hiện tại.
- Không có guest account cho financial actions.

## Supported locales

- English (`en`) và Vietnamese (`vi`); fallback là English.
- App chọn theo ngôn ngữ thiết bị khi khởi động; người dùng có thể đổi Việt/Anh tại Preferences. Với tài khoản đăng nhập, lựa chọn được lưu trong profile và khôi phục ở lần mở sau. Tiền, ngày và thời gian dùng locale đang chọn.
- Không lưu text timeline đã dịch trong database.

## Account deletion and data protection

1. Chỉ người dùng đã đăng nhập mới có thể tạo yêu cầu xóa tài khoản; trước khi phát hành, cần xác thực lại người dùng trong luồng xóa.
2. Xóa hoặc ẩn danh PII profile (display name, avatar URL và metadata OAuth không cần thiết); các `created_by`/`actor_id` trong lịch sử tài chính chung trở thành `NULL` khi tài khoản bị xóa.
3. Không xóa hoặc sửa audit event/timeline financial đã được participant khác nhìn thấy.
4. Event còn lại hiển thị actor trung lập, ví dụ “Former participant”, thay vì PII đã bị xóa.
5. Chỉ Edge Function có service-role key được phép xóa `auth.users`; key này không xuất hiện trong app.

## Data minimization and release controls

- Chỉ lưu dữ liệu cần cho sổ vay chung: định danh tài khoản, participant, khoản vay, khoản trả nợ, audit event và lựa chọn thông báo.
- Không đưa service-role key, OAuth client secret hay dữ liệu tài chính vào client, log analytics hoặc crash report.
- Quyền đọc/ghi dữ liệu tài chính phải đi qua RLS/RPC đã kiểm thử bằng tối thiểu hai tài khoản.
- Trước beta công khai, công bố Privacy Policy và Terms phiên bản được legal review; hoàn tất App Store Privacy và Google Play Data Safety theo dữ liệu thực tế thu thập.

## External setup required

- Bật Google tại Supabase Authentication → Providers.
- Tạo Google OAuth client và cấu hình redirect URL Supabase/Expo trước khi test login.
- Apple provider chỉ cấu hình khi chuẩn bị iOS release.
- Xác nhận retention period, địa chỉ liên hệ privacy và quy trình xử lý yêu cầu xóa dữ liệu với chủ sản phẩm/legal trước khi công bố policy.
