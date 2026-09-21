# APK Android kết nối STAGING

## Cập nhật thiết bị — 21/09/2026

- Đã cài APK 4 bằng `adb install -r` trên Samsung SM-A115F. Package Manager xác nhận versionCode 4, giữ firstInstallTime 20/09; lastUpdateTime 21/09 06:45:44. App khởi động COLD đạt, vẫn đăng nhập và hiển thị danh sách khoản vay đang chờ.
- APK 4 chưa có nút **Mở lời mời** và các thông báo sửa ngày 21/09. Build bản 5 `8718835f-d52c-4bc0-88c9-483571507430` đã gửi EAS; tại thời điểm ghi nhận chưa có APK để cài và nghiệm thu. Không coi thử link giả ở lượt trước là nghiệm thu nhận lời mời thật giữa hai tài khoản.

## Gửi lời mời không cần tên miền

Cập nhật mã nguồn 21/09/2026 (chưa có trong APK 4): trang chính có nút **Mở lời mời**. Người nhận sao chép link hoặc toàn bộ tin nhắn, dán vào đây và chọn **Xem lời mời**. Chỉ nhận một link đầy đủ đúng môi trường của app; chuyển sang màn xem thỏa thuận/đăng nhập hiện có, không tự chấp nhận khoản vay. Tin nhắn chia sẻ đã bổ sung hướng dẫn này. Chưa nghiệm thu trên hai điện thoại; không coi thay đổi mã nguồn là APK đã cập nhật.

Build STAGING gửi link dạng `loan-staging://invite/<mã>`. Không cần tên miền hay website nếu cả người gửi và người nhận đã cài đúng bản `Loan (staging)`: chọn ứng dụng chat trong bảng chia sẻ, gửi nguyên tin nhắn, rồi người nhận chạm link để mở app và đăng nhập.

Đây là custom deep link, không phải HTTPS App Link. Người nhận phải cài app. Một số ứng dụng chat không biến custom scheme thành link có thể chạm; dán vào thanh địa chỉ trình duyệt cũng không đảm bảo mở app. Luồng **Mở lời mời** trong bản mã nguồn mới xử lý trường hợp này ngay trong Loan, không cần tên miền. Cả hai người cần bản APK chứa tính năng mới để làm theo tin nhắn chia sẻ mới.

## Kiểm tra bản sửa 3 — 20/09/2026

- Truy vấn trực tiếp EAS xác nhận build `645bab4f-0087-40b1-97f3-9bb336235e1a` đã `FINISHED`, hoàn tất `2026-09-17T00:42:02.671Z`.
- APK đã có tại `app/.local/loan-staging-1.0.0-3.apk`. Đọc metadata bằng Android SDK xác nhận package `com.loanappmobiles.loanapp.staging`, phiên bản `1.0.0`, versionCode `3`, có ABI `armeabi-v7a` cho Samsung A11.
- SHA256: `29a2e72ab274bc0181d91970e8f1f2a5448bc9b24f66acea388b8e70cd7d806f`.
- Java mặc định không chạy được trình kiểm tra chữ ký độc lập. Sau đó Android Package Manager đã chấp nhận APK qua `adb install -r` (`Success`), bao gồm kiểm tra chữ ký khi cài.
- Đã cài bản 3 lên Samsung SM-A115F, Android 12, ngày 20/09/2026. Package Manager xác nhận versionCode `3`. `firstInstallTime` và `lastUpdateTime` cùng là `2026-09-20 21:18:06`; trước cài không có metadata package STAGING, nên đây là bằng chứng cài mới, **chưa chứng minh nâng cấp giữ dữ liệu từ bản 2**. Không gỡ app hoặc xóa dữ liệu trong lượt này.
- Hai lần khởi động COLD đạt `Status: ok` (3098 ms và 2060 ms); đưa xuống nền rồi mở lại HOT đạt (273 ms). Tiến trình thứ hai tiếp tục sống hơn 40 giây, MainActivity ở foreground. Đã thấy màn hình đăng nhập; không tái hiện crash `ComposeViewFunctionDefinitionBuilder`/`ExpoUIModule`, không có crash mới trong crash buffer.
- Bằng chứng local: `.local/android-v3-startup.png`, `.local/android-v3-startup.log`, `.local/android-v3-restart.png`, `.local/android-v3-restart.log`. APK không còn lớp `expo/modules/ui/ExpoUIModule` trong DEX; ZIP CRC đạt, bundle có URL STAGING và không có URL DEV đã kiểm tra.
- Giới hạn: đây là nghiệm thu lỗi khởi động trên A11, chưa nghiệm thu toàn bộ Google/luồng vay. Log còn cảnh báo WebCrypto thiếu và PKCE fallback `plain`, cùng cảnh báo `FeatureFlagsImplExport` không làm tiến trình chết; cần đánh giá riêng trước nghiệm thu xác thực.

Phần dưới là thông tin bàn giao bản 2 và lịch sử ngày 17/09; không dùng bản 2 để nghiệm thu bản sửa.

> Cập nhật 17/09/2026: APK versionCode 2 bên dưới đã được xác nhận crash khi khởi động trên Samsung A11. Đã gỡ module `@expo/ui` gây lỗi nạp lớp native; bản sửa versionCode 3 đang build, chưa nghiệm thu trên điện thoại.

Bản này dùng backend Supabase STAGING trực tuyến, cùng dữ liệu với web cổng 8083. Không cần máy tính chạy Metro hoặc cùng mạng Wi-Fi; điện thoại cần Internet. Đây là bản thử nghiệm, chưa phát hành Google Play.

- App: **Loan (staging)**, package `com.loanappmobiles.loanapp.staging`.
- Phiên bản: `1.0.0`, versionCode `2`.
- Google được bật; callback Android: `loan-staging://auth/callback`.
- Email OTP dự phòng chưa bật vì chưa có SMTP.
- Dữ liệu DEV ở cổng 8082 không xuất hiện trong app này. Đăng nhập cùng Gmail ở web STAGING và APK để dùng cùng tài khoản STAGING.

## Cài và thử

1. Mở liên kết APK bằng Chrome trên điện thoại, tải xuống và mở file. Nếu Android hỏi, cho phép trình duyệt cài ứng dụng từ nguồn này để cài APK.
2. Nếu đã cài **Loan (staging)** bản cũ, cài cập nhật bằng APK mới. Không gỡ ứng dụng trước khi thử cập nhật.
3. Mở app, chọn **Tiếp tục với Google**, chọn Gmail thuộc danh sách người dùng thử của Google project LOAN-Test. Sau xác nhận, trình duyệt phải quay về app.
4. Tạo khoản vay thử, nhập `10000000` và ngày theo `DD/MM/YYYY`. Kiểm tra lại số tiền/ngày ở bước xác nhận và phòng khoản vay.
5. Mở web STAGING bằng cùng Gmail và kiểm tra khoản vay xuất hiện. Tài khoản Google thứ hai có thể tham gia bằng liên kết mời khi đã cài app và được phép đăng nhập Google project thử nghiệm.
6. Thử ghi nhận trả nợ, xác nhận từ tài khoản bên kia, đóng/mở lại app và đăng xuất/đăng nhập lại.

Kiểm tra riêng trên điện thoại: bàn phím tiếng Việt, thêm/xóa chữ số, ngày, nút quay lại và Google quay về app khi app đang ở nền. Kiểm thử trình duyệt không thay thế các bước Android này. Khi báo lỗi, ghi bước thao tác, tên bản **staging** và ảnh thông báo; không gửi OTP hoặc token.

Theo [hướng dẫn Expo về APK](https://docs.expo.dev/build-reference/apk/), APK có thể tải và cài trực tiếp trên thiết bị Android. Theo dõi build tại [EAS build d934d9ba](https://expo.dev/accounts/loanappmobiles-team/projects/loanapp/builds/d934d9ba-c2fb-41cb-b821-522b446eeb7a). Build đã hoàn tất. [Tải APK 1.0.0 (2)](https://expo.dev/artifacts/eas/UDBpAOHEo9Y5uyurcoPSWCBcN_kbBGosS-v-jpj02fI.apk). Artifact trên EAS hết hạn ngày 30/09/2026; nên lưu file APK sau khi tải.

## Kết quả kiểm tra APK — 17/09/2026

- Đã tải và kiểm tra artifact: 118.214.834 byte, chữ ký hợp lệ, versionCode `2`, đúng package STAGING.
- Backup tắt, không debuggable, không có quyền overlay/đọc ghi bộ nhớ ngoài; scheme `loan-staging` có mặt.
- Bundle chứa URL STAGING, không chứa URL DEV/local hoặc Google client secret đã cấu hình; không có file `.env`, OAuth JSON hay keystore trong APK. Các file runtime hiện tại khớp SHA256 lúc gửi build.
- Auth/API DEV và STAGING hoạt động; truy cập tài chính ẩn danh bị từ chối. Chưa xác nhận đăng nhập Google, bàn phím và toàn bộ luồng vay trên điện thoại thật.

SHA256: `b012716f1043e1f39f9b31acc87b2c43e79f32b42dba6a76ef18bb595df25956`.
