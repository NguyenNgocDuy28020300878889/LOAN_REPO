# Triển khai thông báo Android STAGING

## Trạng thái và phạm vi

Cập nhật A11 21/09/2026 21:09: đã cài APK 7 bằng `adb install -r` (Success), Android xác nhận versionCode 7. Mở Cài đặt thành công; giao diện báo thiết bị đã đăng ký nhận thông báo, STAGING xác nhận 1 thiết bị enabled. Không có crash trong buffer lúc kiểm tra. Chưa gửi push thật: vẫn thiếu file Expo access token riêng. Cron tiếp tục trả HTTP 200 trong chế độ gửi tắt.

Kết quả kiểm tra tiếp theo: EAS build `f4439c11-2fa6-4129-8afb-be3c53f749af` FINISHED. APK đã tải về `.local/loan-staging-1.0.0-7.apk` (116422181 bytes), versionCode 7, đúng package STAGING, có POST_NOTIFICATIONS và armeabi-v7a. SHA256 `87a238250def937e169ed7bd0cb8121937fd6f28cef55c8ea90ecbcfeab679b1`. Cron active, 548 lượt succeeded; 10 HTTP response gần nhất đều 200. Chưa có thiết bị đăng ký; chưa có `.local/expo-push-token.txt`, gửi thật vẫn tắt. ADB chưa thấy A11 ở lượt kiểm tra này; chưa cài APK 7 và chưa test nhận push thật.

Cập nhật triển khai STAGING: người dùng đã cho phép triển khai Cloud, build APK và test A11. Supabase CLI đã link `kircmwdkcdcozckrwfid`, kiểm tra dry-run và áp dụng 4 migration pending (schema completeness và 3 migration push). `push-worker` đã deploy; secret được tạo trong Edge secrets và Vault; cron `loan-push-worker` chạy mỗi phút. Lần gọi kiểm tra trả HTTP 200 `enabled:false`, cron có lượt succeeded. Chưa có Expo access token riêng nên gửi thật vẫn tắt. APK bản 7 đang build: `f4439c11-2fa6-4129-8afb-be3c53f749af`. Các ghi chú local bên dưới là lịch sử trước triển khai.

Mã nguồn dùng Expo SDK 54, expo-notifications, Supabase Postgres và Edge Function `push-worker`.
Các phần đã có: đăng ký thiết bị, quyền/kênh Android, điều hướng theo tài khoản, hàng đợi sự kiện, lịch nhắc trước hạn một ngày và đúng ngày hạn, retry và receipts.

Chưa triển khai Cloud. Người dùng xác nhận ngày 21/09/2026 rằng chưa cấu hình Firebase. APK 6 trên A11 chưa có module mới. `EXPO_PUBLIC_PUSH_READY` và `PUSH_DELIVERY_ENABLED` mặc định tắt.

Kiểm chứng local: 125 assertions database, 79 unit tests, TypeScript và lint đều đạt. Web export và Android Hermes export với cờ push bật thành công. Edge Function local trả 401 khi thiếu secret và 200 `enabled:false` khi chưa bật gửi. SQL lint mức error sạch; mức warning còn cảnh báo ép kiểu enum trong `create_loan` có từ trước. Chưa chạy build native APK hoặc kiểm thử FCM/A11 cho tính năng này.

## 1. Firebase và Expo EAS

Cập nhật 21/09/2026: đã kiểm tra `app/.local/firebase/google-services.json`, project `loan-staging`, package `com.loanappmobiles.loanapp.staging`. Đã tạo biến EAS preview `GOOGLE_SERVICES_JSON` kiểu file, visibility sensitive trên `@loanappmobiles-team/loanapp`. Đã tải khóa service account của cùng Firebase project lên EAS và CLI xác nhận gắn khóa vào đúng package STAGING cho FCM V1. Chưa xác minh gửi FCM thực tế, chưa bật gửi thật hoặc deploy Supabase Cloud. Khóa riêng giữ trong `.local/firebase`, không ghi vào tài liệu hoặc mã nguồn.

1. Trong Firebase Console, tạo/chọn project thử nghiệm; đăng ký Android app có package **com.loanappmobiles.loanapp.staging**.
2. Tải file **google-services.json** của Android app về `app/.local/firebase/google-services.json`.
3. Tạo EAS environment variable kiểu **file**, tên `GOOGLE_SERVICES_JSON`, environment **preview**, trỏ tới file trên. Không dùng file service account ở đây.
4. Cấu hình khóa FCM V1 của cùng Firebase project vào EAS Credentials, đúng application identifier STAGING. Dùng `eas credentials --platform android`, chọn profile preview rồi mục FCM V1. Khóa service account chỉ lưu ngoài repository hoặc `.local`; không đưa vào APK, biến EXPO_PUBLIC hay chat.
5. Bật bảo vệ Expo Push bằng access token trong project EAS; tạo token dành cho worker. Đưa token vào Supabase secret `EXPO_ACCESS_TOKEN`, không dùng trong ứng dụng.

Chi tiết theo [Expo: FCM credentials](https://docs.expo.dev/push-notifications/fcm-credentials/) và [Expo: push setup](https://docs.expo.dev/push-notifications/push-notifications-setup/). `app.config.js` kiểm tra package trong file Firebase tại Android build worker.

## 2. Xem và phê duyệt thay đổi Cloud

Project STAGING dự kiến: `kircmwdkcdcozckrwfid`. Trước khi deploy, đọc migration history Cloud và đối chiếu schema: phiên triển khai local chưa có Supabase MCP để xác nhận Cloud.

Migration của tính năng:

- `20260921010849_push_notifications.sql`: thiết bị, hàng đợi riêng tư, RPC và trigger sự kiện.
- `20260921011552_push_notification_guards.sql`: giới hạn 10 thiết bị bật/tài khoản, hủy lịch cũ khi đổi hạn/trạng thái.
- `20260921012021_push_delivery_retries.sql`: retry biên nhận lỗi rate limit và chống trùng theo tài khoản.

Migration schema completeness trước đó cũng đang local; phải duyệt **toàn bộ** danh sách pending mà `db push --dry-run` báo, không giả định Cloud đã có nó. Không sửa lịch sử migration hoặc reset Cloud.

Sau xác nhận của chủ dự án, chạy từ thư mục `app`:

```powershell
.\node_modules\.bin\supabase.cmd link --project-ref kircmwdkcdcozckrwfid
.\node_modules\.bin\supabase.cmd migration list --linked
.\node_modules\.bin\supabase.cmd db push --dry-run
# Sau khi danh sách pending được kiểm tra/phê duyệt:
.\node_modules\.bin\supabase.cmd db push
.\node_modules\.bin\supabase.cmd functions deploy push-worker --project-ref kircmwdkcdcozckrwfid
```

Đặt secrets qua dashboard hoặc file `.local` không commit:

| Secret của Edge Function | Giá trị                                                        |
| ------------------------ | -------------------------------------------------------------- |
| PUSH_WORKER_SECRET       | Chuỗi ngẫu nhiên ít nhất 32 ký tự, dùng riêng worker           |
| PUSH_DELIVERY_ENABLED    | `false` trong lúc chuẩn bị; `true` khi bắt đầu test được duyệt |
| EXPO_ACCESS_TOKEN        | Token dùng với bảo vệ Expo Push                                |

`SUPABASE_URL` và `SUPABASE_SERVICE_ROLE_KEY` do runtime Supabase cung cấp. Worker từ chối request thiếu `x-worker-secret`; `verify_jwt=false` vì cron sử dụng secret riêng, không dùng JWT của người dùng.

## 3. Lịch chạy và giám sát

Tạo hai secrets trong Vault: `loan_push_worker_url` = URL STAGING `/functions/v1/push-worker`, `loan_push_worker_secret` = cùng secret worker.
Sau phê duyệt, chạy `supabase/ops/schedule-push.sql` để gọi worker mỗi phút. Script ở ngoài migrations để local/migration không tự gửi mạng. Hướng dẫn nền: [Supabase scheduled functions](https://supabase.com/docs/guides/functions/schedule-functions).

Worker tạo nhắc sau 09:00 theo timezone từng thiết bị, không gửi bù sang ngày khác. Mỗi lượt xử lý tối đa 20 receipts và 20 lượt gửi, giới hạn thời gian 45 giây; công việc chưa xử lý được phục hồi sau lease 5 phút. Cần tăng năng lực nếu hàng đợi tích tụ; theo dõi số lượng pending, tuổi pending cũ nhất, failed/unknown, cron HTTP status. Không log token hoặc nội dung tài chính.

- `ticketed`: Expo chấp nhận yêu cầu; chưa chứng minh thiết bị nhận.
- `delivered`: receipt xác nhận nhà cung cấp nhận; chưa chứng minh người dùng thấy/đọc.
- `unknown`: không có receipt trong 24 giờ.
- `DeviceNotRegistered`: tắt token, không ảnh hưởng binding mới của thiết bị.
- Retry tối đa 5 lần; timeout gửi có thể gây lặp vì Expo không cung cấp exactly-once. TTL nhà cung cấp 120 giây để hạn chế thông báo quá cũ.
- Kiểm tra trước gửi không thu hồi được thông báo đã chuyển cho Expo/FCM. Nội dung luôn chung; khi chạm, client kiểm tra tài khoản và RPC kiểm tra thành viên.
- Một tài khoản nhiều thiết bị nhận trên từng thiết bị, theo timezone riêng. Timezone cập nhật khi mở app; chưa có màn hình chọn timezone riêng.
- Không có chức năng dọn lịch sử tự động trong thay đổi này; chưa xóa dữ liệu hiện có. Thiết bị/hàng đợi liên quan tài khoản bị xóa sẽ cascade khi quy trình xóa tài khoản thực thi.

## 4. APK và test A11

Sau khi backend và FCM sẵn sàng, bật `EXPO_PUBLIC_PUSH_READY=true` trong EAS preview, build APK mới và cài cập nhật. Không bật cờ này trên APK 6.

1. Đăng nhập, mở Tùy chọn → Cho phép thông báo trên máy này. Phải thấy thiết bị đã đăng ký; nếu Android chặn, mở cài đặt hệ thống.
2. Dùng hai tài khoản thử và khoản vay thử. Tài khoản còn lại nhận push khi tham gia, ghi nhận trả nợ, xác nhận/tranh chấp; người thao tác không nhận lại push sự kiện của mình.
3. Thử khi mở app, chạy nền, khóa màn hình; chạm thông báo mở đúng khoản vay. Không cam kết nhận khi ứng dụng bị người dùng force-stop.
4. Tắt quyền hệ thống/kênh, tắt push, tắt riêng nhắc hạn. Mở lại app để đồng bộ quyền. Đăng xuất/đổi tài khoản không mở được khoản vay tài khoản cũ.
5. Với fixture STAGING được duyệt, kiểm tra trước 09:00 không gửi, sau 09:00 có nhắc; chạy scheduler lặp không trùng. Đổi hạn, trả hết hoặc hủy trước lượt gửi phải ngăn lịch cũ.
6. Kiểm tra receipt rồi đối chiếu trực tiếp trên A11; không coi test giả lập hoặc ticket thành công là nghiệm thu giao nhận thật.

## Local và tạm dừng

```powershell
.\node_modules\.bin\supabase.cmd migration up --local
.\node_modules\.bin\supabase.cmd test db --local
.\node_modules\.bin\supabase.cmd db lint --local
npm.cmd run typecheck
npm.cmd run test
npm.cmd run lint
```

Unit tests của worker dùng transport giả lập, không gửi push ra bên ngoài. Test DB dùng fixture trong transaction và rollback; không cần reset hoặc seed token thật.

Khi cần dừng Cloud: đặt `PUSH_DELIVERY_ENABLED=false`, rồi tắt cron `loan-push-worker`. Giữ nguyên bảng và dữ liệu. Dừng server không thu hồi thông báo đã gửi tới nhà cung cấp.
