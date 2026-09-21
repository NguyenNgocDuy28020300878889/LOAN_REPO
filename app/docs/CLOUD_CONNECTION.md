# DEV và STAGING trực tuyến

Cập nhật 16/09/2026 theo lựa chọn chủ ứng dụng: dùng cả hai dự án, giữ OTP **8 số**, chưa có SMTP hoặc địa chỉ gửi.

Hướng mới nhất: **Google là đăng nhập chính, email OTP dự phòng**. Đã bật Google cả DEV/STAGING bằng OAuth client chủ dự án cung cấp, xác minh callback và đường chuyển OAuth thật tới Google. Chờ kiểm tra đăng nhập tương tác để xác nhận phiên/dữ liệu sau đăng nhập. Email dự phòng vẫn chờ SMTP. Xem [thiết lập Google Console và trạng thái nghiệm thu](GOOGLE_SIGN_IN.md).

| Môi trường | Supabase project       | Trạng thái       | Migration | Bản web trên máy        |
| ---------- | ---------------------- | ---------------- | --------- | ----------------------- |
| DEV        | `rwfmqthrpbkizcofullh` | `ACTIVE_HEALTHY` | 15/15     | `http://127.0.0.1:8082` |
| STAGING    | `kircmwdkcdcozckrwfid` | `ACTIVE_HEALTHY` | 15/15     | `http://127.0.0.1:8083` |

Đây là frontend chạy trên máy kết nối backend cloud, chưa phải website đã xuất bản. Hai tài khoản/dữ liệu/phiên được tách theo dự án và origin trình duyệt. Không sao chép dữ liệu giữa DEV/STAGING, không đổi production. Cả hai môi trường phục vụ phát triển/kiểm thử, chưa nghiệm thu phát hành với dữ liệu tài chính thật.

## Đã hoàn tất

- Khôi phục đúng hai dự án hiện có qua Supabase Management API. Dùng credential CLI hiện có trong bộ nhớ, không xuất token vào log hoặc bundle.
- Đối chiếu lịch sử migration: DEV có 11 bản, STAGING rỗng. Chạy DDL trong transaction rồi ROLLBACK thành công; sau đó áp dụng lần lượt 4 và 15 migration. Mỗi đợt ghi schema và lịch sử phiên bản trong cùng transaction; đọc lại đủ 15 phiên bản gốc.
- Chạy 4 SQL regression suites trên **mỗi** backend cloud, gồm 66 assertions về quyền truy cập, lời mời, idempotency và trả nợ. Dùng `finish(true)` để lỗi assertion trở thành lỗi API, rollback toàn bộ fixtures. Không thêm worker/chính sách xóa tài khoản mới.
- Kiểm tra HTTP thật: Auth health, public key/settings hoạt động; bắt buộc xác minh email; anonymous bị từ chối ở RPC danh sách khoản vay và bảng `loans`.
- Build riêng từng môi trường, không nạp lẫn `.env`. Có kiểm tra project ref, tình trạng migration, Auth health và source digest. Web server chỉ lắng nghe loopback.

## Email còn bị chặn

Supabase Management API trả HTTP 400 khi thử cập nhật **chỉ nội dung/tiêu đề email**: gói miễn phí dùng email provider mặc định không hỗ trợ sửa template; cần custom SMTP hoặc nâng gói. Không có template cloud nào được cập nhật. Không tự nâng gói hoặc đăng ký dịch vụ trả phí.

Thiết lập Auth hosted vẫn giữ nguyên: 8 số, hết hạn 60 phút, khoảng cách gửi 60 giây, xác minh email bật; giới hạn gửi mặc định đọc được là 2 email/giờ. Password policy và redirect hiện có chưa đổi. Mẫu email local dùng mã 8 số/10 phút, nên khi áp dụng mẫu vào hosted cần ghi đúng thời hạn thực tế hoặc chốt lại policy trước.

Bản web cloud đặt `EXPO_PUBLIC_EMAIL_OTP_READY=false`, hiển thị đang thiết lập email và khóa nút gửi mã. Không coi database/API hoạt động là đã đăng nhập Gmail thành công. Chưa gửi thử Gmail, chưa xác minh nhận mã/đăng nhập/Realtime trên Android thật.

## Cấu hình email đề xuất: Resend

Chủ ứng dụng đã xác nhận chưa có tên miền. Phương án Resend bên dưới dành cho khi đã sở hữu domain; chưa đăng ký/mua domain hoặc tài khoản dịch vụ thay chủ ứng dụng. Có thể thử phương án Gmail SMTP ở mục kế tiếp để kiểm thử trước.

1. Chủ ứng dụng tạo tài khoản Resend bằng email quản trị do mình kiểm soát.
2. Dùng tên miền sở hữu, ví dụ subdomain `auth.example.com` (thay bằng tên miền thật). Thêm đúng bản ghi DNS do Resend cung cấp và chờ xác minh. Không dùng `gmail.com` làm domain gửi vì không sở hữu DNS.
3. Chọn địa chỉ gửi riêng như `loan-dev@auth.example.com` và `loan-staging@auth.example.com`. Khi domain đã xác minh, Resend cho phép gửi từ địa chỉ thuộc domain mà không cần mua riêng hộp thư cho từng địa chỉ gửi.
4. Tạo API key giới hạn gửi email theo domain, tách key DEV/STAGING. Nhập trực tiếp trong Supabase Dashboard hoặc secret store; không gửi vào chat/Git/biến `EXPO_PUBLIC_*`.
5. Cấu hình từng dự án: SMTP host `smtp.resend.com`, port `465` hoặc `587`, username `resend`, password là API key tương ứng, sender đúng địa chỉ đã chọn. Có thể dùng tích hợp Resend–Supabase để cấu hình.
6. Sau khi SMTP hoạt động, áp dụng template có `{{ .Token }}` cho **Confirm signup** và **Magic Link**, giữ mã 8 số. Đọc lại thiết lập, thử nhận mã tại Gmail do chủ ứng dụng kiểm soát, thử sai mã/đã dùng/gửi lại và kiểm tra tài khoản mới/cũ.
7. Chỉ khi hoàn tất mới đặt `emailOtpReady: true` cho đúng môi trường trong `.local/cloud-public.json`; script export chuyển giá trị này thành `EXPO_PUBLIC_EMAIL_OTP_READY=true`. Với build native/EAS, đặt trực tiếp biến public tương ứng. Export/build lại và nghiệm thu luồng qua UI. Đây là trạng thái UI, không thay thế giới hạn server. Giới hạn gửi phải phù hợp quota dịch vụ, chưa mở đăng ký công khai trước kiểm tra chống abuse.

Thông tin còn cần chủ ứng dụng cung cấp: **đã có tên miền hay chưa; nếu có, tên miền và nơi quản lý DNS**. Không cần mật khẩu Gmail. Chưa có tên miền thì việc chọn/mua tên miền vẫn thuộc chủ ứng dụng; không tự phát sinh chi phí.

Tài liệu chính thức: [SMTP Resend](https://resend.com/docs/send-with-smtp), [Resend với Supabase](https://resend.com/docs/knowledge-base/getting-started-with-resend-and-supabase), [Địa chỉ gửi theo domain](https://resend.com/docs/knowledge-base/how-do-I-create-an-email-address-or-sender-in-resend).

## Lệnh vận hành

### Phương án thử khi chưa có tên miền: Gmail SMTP

Có thể thử dùng một Gmail riêng của LOAN làm địa chỉ gửi qua `smtp.gmail.com`, nếu tài khoản được Google cho phép tạo App Password. Đây là phương án kiểm thử nhóm nhỏ được đề xuất từ tài liệu Gmail SMTP và App Password; chưa kiểm chứng gửi thành công với tài khoản của chủ ứng dụng. Hướng dẫn Google SMTP của Supabase đã thử trên Workspace, không phải bằng chứng tài khoản Gmail cá nhân cụ thể chắc chắn hoạt động.

1. Chủ ứng dụng tạo hoặc chọn Gmail riêng, tự hoàn tất xác minh tài khoản và bật Xác minh 2 bước. Không dùng hộp thư cá nhân chứa dữ liệu quan trọng làm tài khoản gửi của app.
2. Mở trang [Mật khẩu ứng dụng](https://myaccount.google.com/apppasswords), tạo riêng `LOAN DEV SMTP` và `LOAN STAGING SMTP`. Nếu Google không cung cấp tính năng này, không tắt bảo vệ tài khoản để vượt qua; chọn SMTP khác hoặc quay lại phương án domain.
3. Trong Custom SMTP của từng dự án Supabase, điền cấu hình sau. Chủ ứng dụng nhập App Password trực tiếp trong Dashboard; không gửi vào chat, Git hoặc biến public.

| Trường       | Giá trị                                                                 |
| ------------ | ----------------------------------------------------------------------- |
| SMTP host    | `smtp.gmail.com`                                                        |
| Port         | `587` (STARTTLS); có thể kiểm tra `465` (SSL/TLS) nếu cần               |
| Username     | Địa chỉ Gmail gửi đầy đủ                                                |
| Password     | App Password dành riêng cho môi trường, không phải mật khẩu Gmail chính |
| Sender email | Cùng địa chỉ Gmail trên                                                 |
| Sender name  | `LOAN DEV` hoặc `LOAN STAGING`                                          |

Hai App Password giúp thu hồi từng môi trường riêng nhưng **không** chia tách quota của cùng một Gmail. Không có domain/DNS riêng để cấu hình ở phương án này. Người dùng LOAN vẫn đăng nhập bằng mã **8 số**; App Password chỉ dành cho máy chủ gửi email.

Sau khi cấu hình SMTP: cập nhật template, kiểm tra email thật đến hộp thư do chủ ứng dụng kiểm soát, thử OTP mới/cũ/sai/đã dùng và chỉ sau đó mở lại nút gửi mã trên bản cloud. Trước phát hành công khai cần đánh giá dịch vụ email giao dịch với domain riêng.

Nguồn: [Gmail SMTP](https://support.google.com/mail/answer/7104828?hl=en), [App Password và điều kiện tài khoản](https://support.google.com/accounts/answer/185833?hl=vi), [Google SMTP với Supabase](https://supabase.com/docs/guides/troubleshooting/using-google-smtp-with-supabase-custom-smtp-ZZzU4Y).

### Chạy bản web

Chạy trong `app`, với file cấu hình public `.local/cloud-public.json` đã được tạo từ hai dự án:

```text
node scripts/check-cloud-connections.mjs
node scripts/export-browser-cloud.mjs development
node scripts/export-browser-cloud.mjs staging
node scripts/serve-browser-preview.mjs development
node scripts/serve-browser-preview.mjs staging
```

Hai lệnh serve chạy ở hai tiến trình riêng. Mở URL bằng Chrome thông thường để người dùng tự bấm hộp xác nhận; không để Playwright tự dismiss dialog trong cửa sổ tương tác. Các file `.local` và profile thử không đưa lên Git/EAS.
