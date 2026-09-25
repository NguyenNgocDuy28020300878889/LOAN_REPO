# Chính sách Quyền riêng tư (Privacy Policy) — LOAN

Cập nhật lần cuối: 25/09/2026

Ứng dụng **LOAN** ("chúng tôi", "ứng dụng") tôn trọng và cam kết bảo vệ quyền riêng tư của người dùng. Chính sách này giải thích cách chúng tôi thu thập, sử dụng, lưu trữ và bảo vệ thông tin khi bạn sử dụng ứng dụng di động LOAN và các dịch vụ liên quan.

---

## 1. Dữ liệu chúng tôi thu thập

Chúng tôi chỉ thu thập các dữ liệu tối thiểu cần thiết để vận hành tính năng sổ vay nợ chung giữa hai người:

### a. Thông tin tài khoản & danh tính (Personal Info)

- **Địa chỉ Email:** Thu thập khi bạn đăng nhập bằng Google. Dùng để xác thực danh tính, bảo vệ tài khoản và nhận diện lời mời tham gia khoản vay. Email OTP chưa được bật trong bản production hiện tại.
- **Tên hiển thị (Display Name) & Ảnh đại diện (Avatar):** Lấy từ hồ sơ Google hoặc do bạn thiết lập để đối tác cùng khoản vay nhận diện được người cùng ghi sổ.

### b. Thông tin giao dịch và khoản vay (Financial Information)

- **Chi tiết khoản vay:** Số tiền (principal), loại tiền tệ (currency), ngày vay, ngày đến hạn, vai trò (người cho vay/người vay), mục đích và ghi chú.
- **Lịch sử trả nợ (Repayments):** Số tiền thanh toán, ngày trả, phương thức thanh toán và trạng thái xác nhận giữa hai bên (`PENDING`, `CONFIRMED`, `DISPUTED`, `CANCELLED`).
- **Nhật ký sự kiện (Audit Events):** Thời điểm tạo khoản vay, gửi lời mời, xác nhận hoặc tranh chấp giao dịch.

### c. Dữ liệu thiết bị & Kỹ thuật (Device & App Performance)

- **Token thông báo đẩy (Push Notification Token):** Mã nguồn hỗ trợ đăng ký token khi tính năng push được bật. Bản production hiện tại tắt tính năng này và không đăng ký token thiết bị.
- **Nhật ký sự cố & Hiệu năng (Crash Logs / Diagnostics):** Chỉ được gửi tới Sentry khi production có cấu hình DSN. Sự kiện JavaScript đi qua allowlist và loại bỏ email, URL, token, số tiền và nội dung tự do; native crash collection hiện tắt.

> **Lưu ý:** Chúng tôi **KHÔNG** yêu cầu hoặc thu thập: Số thẻ ngân hàng, mã PIN/CVV, danh bạ điện thoại, vị trí GPS, micro hoặc camera.

---

## 2. Mục đích sử dụng dữ liệu

Dữ liệu của bạn chỉ được sử dụng cho các mục đích hợp pháp sau:

1. Xác thực và duy trì phiên đăng nhập bảo mật của bạn.
2. Thiết lập phòng vay chung (Shared Loan Room) đồng bộ dữ liệu thời gian thực giữa hai người tham gia.
3. Bảo đảm tính toàn vẹn và bất biến của sổ sách giao dịch (chống sửa đổi đơn phương hoặc trùng lặp giao dịch).
4. Gửi thông báo liên quan đến khoản vay khi tính năng push được bật trong một bản phát hành tương lai và người dùng cấp quyền.
5. Khắc phục sự cố kỹ thuật và nâng cao độ ổn định của ứng dụng.

Chúng tôi **tuyệt đối không** bán, cho thuê hoặc chia sẻ dữ liệu của bạn cho các bên thứ ba vì mục đích quảng cáo hay tiếp thị.

---

## 3. Lưu trữ và Bảo mật dữ liệu

- **Mã hóa khi truyền tải:** Mọi giao tiếp giữa ứng dụng di động và hệ thống máy chủ đều được mã hóa bằng giao thức HTTPS/TLS tiêu chuẩn cao.
- **Kiểm soát phân quyền (Row Level Security - RLS):** Dữ liệu tài chính chỉ có thể được truy cập bởi đúng 2 người tham gia trong cùng một khoản vay. Người ngoài cuộc hoặc người chưa đăng nhập không có quyền xem hay chỉnh sửa.
- **Xác thực an toàn:** Hỗ trợ Google OAuth với chuẩn PKCE SHA-256 native.
- **Thời hạn lưu giữ:** Dữ liệu tài khoản tồn tại trong thời gian tài khoản hoạt động. Audit kỹ thuật của yêu cầu xóa được giữ tối đa 180 ngày để phát hiện lỗi, chống lạm dụng và đối soát việc xóa, sau đó được xóa khỏi cơ sở dữ liệu hoạt động.

---

## 4. Quyền của người dùng & Cơ chế Xóa tài khoản

Bạn có toàn quyền kiểm soát dữ liệu cá nhân của mình:

- **Xem và sửa đổi:** Bạn có thể xem toàn bộ lịch sử khoản vay và tùy chỉnh thông tin tài khoản, tùy chọn nhận thông báo bất kỳ lúc nào trong ứng dụng.
- **Xóa tài khoản (Account Deletion):**
  - **Trong ứng dụng:** Vào `Cài đặt (Settings)` → `Xóa tài khoản (Delete Account)`.
  - **Trên trang Web chính thức:** Bạn có thể gửi yêu cầu xóa tài khoản tại `https://loan.duyhaohan.id.vn/account-deletion` mà không cần phải cài đặt lại ứng dụng.
  - **Điều kiện an toàn:** Để bảo vệ quyền lợi giữa hai bên, tài khoản chỉ có thể xóa khi **tất cả khoản vay đã được tất toán hoặc đóng** và không còn giao dịch trả nợ nào đang chờ duyệt hay tranh chấp.
  - **Sau khi xóa:**
    - Tài khoản đăng nhập (`auth.users`), hồ sơ cá nhân (`profiles`), thiết bị nhận push và các tùy chọn cá nhân sẽ bị xóa vĩnh viễn.
    - Trong các phòng vay đã tất toán, đối tác còn lại vẫn thấy số tiền, ngày và trạng thái để bảo toàn sổ đối soát; danh tính chuyển thành vô danh (`Former participant`). Mục đích, ghi chú và phương thức thanh toán dạng văn bản tự do trong các phòng liên quan được xóa.
    - Bản sao lưu tuân theo cửa sổ lưu giữ của nhà cung cấp và chỉ dùng để phục hồi sự cố. Quy trình phục hồi phải áp dụng lại danh sách tài khoản đã xóa trước khi đưa dữ liệu trở lại phục vụ người dùng.

---

## 5. Dịch vụ của bên thứ ba (Third-party Services)

Ứng dụng sử dụng các dịch vụ nền tảng đáng tin cậy:

- **Supabase:** Dịch vụ cơ sở dữ liệu và xác thực người dùng (tuân thủ SOC2, GDPR).
- **Google Identity Services:** Xác thực đăng nhập qua tài khoản Google.
- **Expo (Expo Notifications):** Chỉ định tuyến thông báo khi tính năng push được bật; bản production hiện tại tắt gửi push.
- **Sentry:** Chỉ nhận sự kiện khi DSN production được cấu hình; native collection hiện tắt.

---

## 6. Thông tin liên hệ

Nếu bạn có bất kỳ câu hỏi hoặc yêu cầu nào liên quan đến quyền riêng tư và dữ liệu cá nhân, vui lòng liên hệ với chúng tôi qua:

- **Đơn vị vận hành:** Nhóm phát triển LOAN
- **Email hỗ trợ:** `duynguyenpc.280203@gmail.com`
- **Website:** `https://loan.duyhaohan.id.vn`
- **Địa chỉ trang yêu cầu xóa tài khoản:** `https://loan.duyhaohan.id.vn/account-deletion`
