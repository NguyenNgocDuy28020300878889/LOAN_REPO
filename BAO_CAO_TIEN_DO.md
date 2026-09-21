 # Báo cáo tiến độ dự án — Loan

## Nghiệm thu khởi động Android bản 3 — 20/09/2026

- EAS xác nhận build `645bab4f-0087-40b1-97f3-9bb336235e1a` FINISHED. Đã cài thành công versionCode 3 trên Samsung SM-A115F / Android 12 bằng `adb install -r`.
- Hai lần khởi động COLD và một lần quay lại từ nền đều đạt; đã thấy màn hình đăng nhập. Tiến trình tiếp tục sống, không có crash mới; lỗi `ComposeViewFunctionDefinitionBuilder`/`ExpoUIModule` không tái hiện trong lượt thử.
- Android chấp nhận chữ ký khi cài; kiểm tra độc lập bằng Java chưa chạy được. Metadata cho thấy cài mới package STAGING, chưa chứng minh nâng cấp giữ dữ liệu từ bản 2. Không gỡ app hoặc xóa dữ liệu trong lượt này.
- Chưa nghiệm thu toàn bộ đăng nhập Google/luồng vay. Log có cảnh báo PKCE fallback `plain` do thiếu WebCrypto, cần đánh giá riêng. [Chi tiết và bằng chứng](app/docs/ANDROID_TEST_APK.md).

## Sửa crash khởi động Android — 17/09/2026 (lịch sử trước nghiệm thu)

- Đã kết nối Samsung SM-A115F qua ADB: Android 12, ABI hệ điều hành `armeabi-v7a,armeabi`.
- Log của LOAN xác định `NoClassDefFoundError: expo.modules.kotlin.views.ComposeViewFunctionDefinitionBuilder` trong `expo.modules.ui.ExpoUIModule.definition`. Đây là lỗi nạp module native; không có căn cứ quy lỗi cho tuổi điện thoại.
- Gỡ dependency `@expo/ui` không được mã nguồn sử dụng và cập nhật lockfile. Android autolinking xác nhận không còn `ExpoUIModule`; TypeScript và 59 tests đạt.
- Đã gửi [bản sửa EAS 645bab4f](https://expo.dev/accounts/loanappmobiles-team/projects/loanapp/builds/645bab4f-0087-40b1-97f3-9bb336235e1a) lên preview/STAGING, tăng versionCode 2 → 3, dùng khóa ký cũ để cài cập nhật giữ dữ liệu. Chưa xác nhận hết crash cho đến khi APK mới được cài và mở trên điện thoại.
- APK versionCode 2 đã bàn giao có lỗi khởi động được xác nhận; kiểm tra chữ ký/backend trước đây không thay thế thử chạy trên thiết bị.

## APK trực tuyến sẵn sàng kiểm thử — 17/09/2026 (mới nhất)

- EAS build `d934d9ba-c2fb-41cb-b821-522b446eeb7a` đã FINISHED, phiên bản `1.0.0 (2)`, package `com.loanappmobiles.loanapp.staging`.
- [Tải APK](https://expo.dev/artifacts/eas/UDBpAOHEo9Y5uyurcoPSWCBcN_kbBGosS-v-jpj02fI.apk); [hướng dẫn cài, kiểm thử và SHA256](app/docs/ANDROID_TEST_APK.md). Dùng backend STAGING trực tuyến, cùng dữ liệu web 8083; không cần Metro hoặc máy tính chạy liên tục.
- Đã xác minh chữ ký, package/version, tắt backup/debug, không có quyền overlay/bộ nhớ ngoài; bundle đúng URL STAGING, không có URL DEV/local, Google client secret hoặc file cấu hình bí mật được kiểm tra. File runtime khớp snapshot lúc gửi build; build gồm thay đổi chưa commit, không chỉ nội dung commit hiển thị trên EAS.
- Kiểm tra lại DEV/STAGING Auth/API và chặn truy cập tài chính ẩn danh đều đạt. Google bật; OTP email tắt vì chưa có SMTP.
- Cần nghiệm thu trên điện thoại thật: Google quay lại app, nhập tiền/ngày, tạo vay, đồng bộ, lời mời và trả nợ. Kiểm tra tĩnh APK không thay thế nghiệm thu thiết bị; chưa phát hành production/Google Play.

## Sửa nhập ngày và định dạng tiền khi kết thúc bộ gõ — 16/09/2026 (đợt trước)

- Tái hiện số tiền `100000` không có dấu chấm sau chuỗi sự kiện IME chỉ có `compositionend`, không có lần `input` cuối. Bản sửa trước chỉ bỏ qua ký tự đang composing nên chưa định dạng lại khi kết thúc.
- Thêm xử lý `compositionstart`, `compositionend` và `blur`; giữ nguyên bộ đệm khi đang composing, định dạng và đồng bộ trạng thái form khi kết thúc/rời ô. Dùng chung cho số tiền tạo vay/trả nợ và hai ô ngày, tránh React khôi phục giá trị cũ giữa các lần gõ ngày.
- Phiên bản cuối trên web dùng ô HTML `input` chuẩn trong component dùng chung, giữ nhãn truy cập, màu nền/chữ, viền focus và kích thước. Đồng bộ trạng thái ngay trong sự kiện nhập; không đưa bộ đệm IME qua cơ chế khôi phục text/selection của RN Web. DEV đã đạt ba lượt hồi quy liên tiếp sau thay đổi này.
- Bộ kiểm thử trình duyệt mở rộng: tiền/ngày gõ nhanh/chậm, xóa, sửa tháng ở giữa, dán ISO, phần lẻ, mô phỏng kết thúc IME không có input cuối và rời ô khi đang composing. DEV đã đạt; chưa kiểm thử trực tiếp mọi bộ gõ tiếng Việt/thiết bị Android.
- TypeScript, 59 unit tests, lint các file thay đổi và format đạt. Browser journey local đạt đầy đủ, bổ sung kiểm tra ngày kết thúc IME thực sự vào payload tạo khoản vay; database vẫn lưu đúng ngày ISO và minor units. Các thao tác trả nợ/retry/tất toán và đặt lại form không bị ảnh hưởng.
- Đã build bản cuối local/DEV/STAGING. Trên phiên bản HTML input cuối, browser journey local đạt lại; STAGING cổng 8083 đạt ba lượt kiểm thử nhập liệu liên tiếp (DEV cũng ba lượt). Đã kiểm tra giao diện mobile không tràn ngang. Tab cũ cần tải lại để nhận JavaScript mới.

## Sửa mất chữ số khi gõ số tiền trên web — 16/09/2026 (đợt trước)

- Tái hiện bằng gõ từng phím `10000000`: phiên bản trước có thể mất chữ số khi định dạng hàng nghìn cập nhật giá trị điều khiển. Kiểm thử cũ dùng `fill()` toàn chuỗi nên không phát hiện.
- Tách ô số tiền dùng chung cho tạo vay/trả nợ. Trên web, trình duyệt giữ nội dung đang gõ; định dạng và vị trí con trỏ được cập nhật đồng bộ trong sự kiện nhập. Vẫn nhận lệnh xóa từ trạng thái form sau khi hoàn tất giao dịch. Không thay parser minor units hoặc quy tắc kiểm tra số tiền.
- Đã kiểm tra DEV: `10000000` → `10.000.000` khi gõ nhanh/chậm; chèn/xóa giữa chuỗi, thay vùng chọn, dán, số lẻ và xóa toàn bộ đều đạt. Bổ sung script `app/scripts/test-amount-entry.mjs` và hồi quy gõ từng phím trong browser journey. Sửa này dành cho web; chưa nghiệm thu bàn phím Android thật.
- Kiểm tra TypeScript, lint, format và 59 unit tests đạt. Browser journey trên bản local mới đạt toàn bộ; tạo vay và trả nợ dùng gõ từng phím, dữ liệu lưu đúng minor units, form đặt lại sau hoàn tất, retry/tất toán không bị ảnh hưởng.
- Đã build và kiểm tra STAGING: gõ nhanh/chậm `10000000` ra `10.000.000`; vị trí con trỏ, xóa, chèn giữa chuỗi, thay vùng chọn, dán, số lẻ và xóa toàn bộ đều đạt. DEV và STAGING đã có bản sửa; cần tải lại tab cũ để nhận JavaScript mới.

## Sửa cấu hình đăng nhập DEV và nhập tiền/ngày — 16/09/2026 (đợt trước)

- Chủ ứng dụng báo nút Google DEV không bấm được. Kiểm tra bản cloud 8082 vẫn chuyển Google đúng; phát hiện `.env` chạy DEV từ mã nguồn thiếu `EXPO_PUBLIC_GOOGLE_AUTH_READY`. Đã đặt `true` cho backend DEV đã cấu hình, giữ email OTP `false` do chưa có SMTP. Cổng 8081 vẫn là local chưa cấu hình Google; DEV trực tuyến dùng 8082. Cần khởi động lại Expo nếu chạy từ mã nguồn sau đổi biến môi trường.
- Ô số tiền tạo vay và trả nợ tự nhóm hàng nghìn bằng dấu chấm: `1000000` → `1.000.000`. VND chỉ nhận số nguyên; tiền tệ có phần lẻ dùng dấu phẩy, ví dụ `1.000,50`. Parser chuyển về minor units trước gọi API, chặn số không hợp lệ, sai độ chính xác và vượt số nguyên an toàn.
- Ô ngày dùng **DD/MM/YYYY**, tự thêm dấu `/` từ 8 chữ số. Kiểm tra ngày thực tế, năm nhuận và thứ tự ngày vay/đến hạn; gửi database dạng ISO `YYYY-MM-DD`.
- Đã đạt TypeScript, lint, format và **58 unit tests**. Browser journey local đạt: tạo vay, hủy xác nhận, lời mời, trả nợ, retry, tất toán, đăng xuất; kiểm tra trực tiếp database xác nhận `123.456` = 123456 đồng, `16/09/2026` = `2026-09-16`. Giao diện mobile DEV không tràn ngang.
- Chưa nghiệm thu tài khoản Google thật quay về có phiên hoặc thiết bị Android trong đợt sửa này.

## Đã bật Google trên DEV/STAGING — 16/09/2026 (đợt trước)

- Đã nhận file OAuth do chủ dự án lưu tại `app/.local/google-oauth.json`, kiểm tra đúng Google project `loan-test-508813`, loại Web và đủ hai callback. File được Git/EAS bỏ qua; không in hoặc đưa Client Secret vào frontend.
- Đã bật Google provider trên cả DEV/STAGING, cập nhật Site URL/allow list chính xác theo cổng và scheme của từng môi trường. Đọc lại cấu hình đạt; giữ nguyên OTP 8 số, thời hạn OTP, xác minh email và chính sách mật khẩu.
- Đã build lại web DEV (8082), STAGING (8083). Kiểm tra endpoint OAuth thật và thao tác nút Google bằng Chrome đều đạt: app gửi PKCE đúng backend, chuyển tới Google với callback Supabase tương ứng. Kiểm tra không có Client Secret trong JavaScript export đạt cả hai bản.
- Đã mở DEV trong Chrome thường cho chủ tài khoản đăng nhập. **Chờ xác nhận đăng nhập Google tương tác hoàn tất và quay về danh sách khoản vay**; chưa coi kiểm tra redirect là nghiệm thu phiên hoặc dữ liệu tài khoản Google thật. Android/EAS chưa build lại trong đợt này.
- Email dự phòng vẫn chờ SMTP; nút gửi mã cloud vẫn khóa. [Cấu hình và giới hạn còn lại](app/docs/GOOGLE_SIGN_IN.md).

## Google là đăng nhập chính, email 8 số dự phòng — 16/09/2026 (đợt trước)

- Đã nối nút **Tiếp tục với Google** vào OAuth PKCE: web chuyển cùng tab, native mở trình duyệt hệ thống với callback theo môi trường. Giữ lời mời sau đăng nhập, kiểm tra callback đúng nguồn/đường dẫn, chống đổi mã lấy phiên hai lần. Không thêm thư viện.
- Email OTP **8 số** giữ làm phương án dự phòng, hướng dẫn dùng cùng email để truy cập dữ liệu cũ. Thêm liên kết khôi phục Google; LOAN không giữ hoặc đổi mật khẩu Google. Nếu mất quyền vào hộp thư, OTP gửi vào hộp thư đó không thể khôi phục tài khoản.
- Đã đọc cấu hình cloud: Google **đang tắt cả hai dự án**; Client ID cũ DEV không đúng định dạng, STAGING chưa có client. Chưa sửa provider hoặc Auth policy cloud. Các nút chưa sẵn sàng có thông báo rõ, không báo đăng nhập/gửi mã thành công giả.
- **Đã kiểm chứng:** TypeScript, 54 unit tests (thêm 11 trường hợp Google/PKCE), hành trình trình duyệt với Auth/Postgres local: OTP → tạo vay → lời mời → trả nợ → tất toán → đăng xuất đều đạt. Chưa đăng nhập Google thật và chưa thử trên Android thật.
- Đã build lại local/DEV/STAGING; kiểm thử Chrome cả hai cloud preview đạt: trạng thái Google đúng cấu hình, không có ô mật khẩu, có mục khôi phục, email chưa sẵn sàng không phát request OTP, bundle không trộn backend, mobile không tràn ngang. Lint/format và diff check đạt.
- Đã chuẩn bị script kiểm tra/áp dụng OAuth giới hạn đúng DEV/STAGING, không log bí mật, giữ chính sách OTP. Đã mở Google Console. Cần chủ dự án tạo Web OAuth client và lưu JSON trong `app/.local/google-oauth.json` để cấu hình tiếp; không cần mua tên miền cho đợt thử này. [Hướng dẫn từng bước](app/docs/GOOGLE_SIGN_IN.md).

## Kết nối DEV/STAGING trực tuyến, giữ OTP 8 số — 16/09/2026 (đợt trước)

- Đã khôi phục **cả DEV và STAGING**, hiện `ACTIVE_HEALTHY`. DEV bổ sung 4 migration, STAGING áp dụng đủ 15; dry-run ROLLBACK thành công trước triển khai, lịch sử đọc lại đúng phiên bản. Không reset hoặc thay database.
- 4 SQL regression suites / 66 assertions đạt trên **mỗi môi trường cloud**, dữ liệu kiểm thử được rollback. HTTPS Auth/API và publishable key hoạt động; anonymous không đọc được RPC danh sách vay hoặc bảng loans.
- Chủ ứng dụng chọn **giữ mã 8 số**; đã sửa UI, validation, bộ đọc mã kiểm thử và cấu hình local cho khớp. Local integration kiểm tra OTP đăng ký/đăng nhập, sai mã/sai người nhận/replay và phục hồi cũ đều đạt; TypeScript/lint và 43 unit tests đạt.
- Hai bản web tách biệt: DEV cổng **8082**, STAGING cổng **8083**, frontend chạy trên máy với backend cloud tương ứng. Mã nguồn không trộn URL dự án; không dùng service-role trong client.
- **Email còn chặn:** chưa có SMTP/địa chỉ gửi. API Supabase từ chối sửa template trên gói miễn phí dùng email provider mặc định. Không thay Auth policy cloud; vẫn 8 số/60 phút, xác minh email bắt buộc, gửi lại 60 giây. Bản cloud ghi rõ email đang thiết lập và khóa gửi mã. Chưa gửi Gmail thật hoặc nghiệm thu đăng nhập cloud/Android thật.
- Còn cần tên miền và cấu hình dịch vụ gửi email. [Trạng thái và hướng dẫn SMTP](app/docs/CLOUD_CONNECTION.md). Không nâng gói, mua tên miền hoặc phát sinh phí mới.

## Đăng nhập bằng mã email và sửa cửa sổ dùng thử — 16/09/2026 (đợt trước)

- Đã thay màn hình đăng nhập chính bằng email/Gmail + mã 6 chữ số, dùng chung đăng ký/đăng nhập, không đặt mật khẩu. Có xác minh mã, gửi lại sau 60 giây, đổi email, thông báo lỗi rõ và quay lại lời mời sau login. Không tạo tài khoản Google mới.
- Local dùng Auth/Postgres/Mailpit thật, mã dùng một lần và hết hạn 10 phút. **Email local không đến Gmail thật**; màn hình ghi rõ hộp thư kiểm thử. Chưa thay cấu hình Auth cloud.
- **Kiểm chứng:** 43 unit tests, TypeScript, lint, format, export local; integration Auth/OTP qua GoTrue/Mailpit; browser journey gồm mã sai/cooldown, tạo vay, lời mời, trả nợ, retry mất phản hồi, tất toán và chặn người ngoài đều đạt. Chưa kiểm thử OTP trên Android thật.
- Lỗi bấm tạo vay không phản hồi đã tái hiện: cửa sổ do Playwright giữ kết nối tự hủy hộp xác nhận. Đã mở lại bằng Chrome thường, không giữ automation pipe và không có `--no-sandbox`; xác nhận hợp lệ tạo đúng một khoản vay. Không bỏ bước xác nhận giao dịch.
- **Cloud còn chặn:** inventory đọc lại cho thấy DEV và STAGING đều `INACTIVE`. Đang chờ chủ ứng dụng chọn dự án và xác nhận dịch vụ SMTP; chưa đổi app sang cloud, chưa gửi email Gmail thật hoặc nhập dữ liệu tài chính thật. [Chi tiết và cấu hình cần hoàn tất](app/docs/EMAIL_OTP.md).

## Thiết kế lại giao diện với UI/UX Pro Max — 16/09/2026 (đợt trước)

**Đã triển khai giao diện mới vào mã ứng dụng**, theo skill `ui-ux-pro-max` và `mobile-app-ui-design`. [Thiết kế và bằng chứng kiểm tra](app/docs/UI_REDESIGN.md).

- Hệ thống màu xanh trầm, hỗ trợ sáng/tối theo thiết bị; font hệ thống, số tiền rõ, nút bấm lớn, biểu tượng và khoảng cách nhất quán. Các màn danh sách/tạo vay/phòng khoản vay/trả nợ/lời mời/xác thực/tùy chọn dùng chung thành phần.
- Thêm tìm theo mục đích và lọc cho vay/đi vay; đưa thao tác chính xuống cuối màn; nhóm form, hiện/ẩn mật khẩu, sửa tiếng Việt bị mất dấu. Công tắc dùng cả dòng làm vùng chạm; radio/switch hoạt động với phím Space trên web.
- Tối ưu danh sách bằng `FlatList` / `SectionList`, memo thẻ khoản vay; không thêm thư viện, ảnh/font tải ngoài, blur hay animation. JS web tăng khoảng **1,13%**; chưa đo RAM/FPS/pin native và vẫn còn việc phân trang server.
- **Kiểm chứng:** 38 unit tests, TypeScript/lint/export; hành trình hai tài khoản với backend local thật đã qua, gồm mất phản hồi/retry, tất toán và chặn người ngoài. Tìm kiếm/bộ lọc/công tắc/ngôn ngữ đã thử từ UI. 100 ảnh sáng/tối ở 320/412/768/1024/1440 px không tràn ngang document; đã xem ảnh đại diện để sửa bố cục/biểu tượng.
- **Chưa có APK cho thiết kế mới.** APK trước đó không chứa giao diện này; thử bàn phím, font lớn, TalkBack và hiệu năng trên Android thật vẫn cần thực hiện. Không đổi database/Edge Function hoặc triển khai thêm chính sách xóa tài khoản trong lượt thiết kế.

## Tự động hóa theo hành trình sử dụng — 16/09/2026 (đợt trước)

**Đã chạy trọn luồng bằng giao diện với backend local thật; chưa phát hành dùng dữ liệu thật.** [Chi tiết kiểm chứng](app/docs/IMPLEMENTATION_SECURITY_2026_09_16.md).

- Chrome tự thao tác tạo khoản vay → đăng nhập/nhận lời mời → gửi trả nợ → cố ý mất phản hồi sau khi server đã lưu → tải lại/thử lại → xác nhận trả đủ. Database xác nhận không ghi trùng; pending còn lại tự hủy và hiện lý do trong lịch sử.
- Đã kiểm tra hủy hộp xác nhận không thay đổi dữ liệu, anonymous không gọi RPC tài chính, logout ẩn chi tiết. Tài khoản thứ ba không nhận dữ liệu Realtime và không mở được phòng của người khác.
- Sửa Realtime còn một kênh mỗi phiên ứng dụng, nhận khoản vay mới ngay khi danh sách đang rỗng; kiểm chứng qua WebSocket local thật. Sửa hộp thoại web, lấy link khi không mở được chia sẻ, quay về đúng phòng sau trả nợ và xóa form sau khi xác nhận thành công.
- Tự động hóa được lưu vào `npm run export:browser:local` / `npm run test:browser:local` và CI. Bản browser kiểm thử tách riêng, chặn HTTP/WebSocket ngoài local; không giả lập kết quả tài chính. CI GitHub chưa chạy.
- `npm run validate` đã qua format/lint/TypeScript, **38 unit tests / 12 files**, export web 12 routes. Bộ kiểm thử browser đối chiếu dấu vân tay mã nguồn để không dùng nhầm bản export cũ. Các kiểm thử SQL/concurrency/Auth của đợt trước vẫn là bằng chứng riêng, không tính là chạy lại trong lượt này.
- **Giới hạn:** DEV/STAGING kiểm tra lại vẫn `INACTIVE`; chưa có Android kết nối, chưa deploy cloud. APK `b9e038df...` ở mục trước **chưa chứa sửa đổi lượt này**. Chưa triển khai thêm chính sách xóa tài khoản đang chờ bàn.

**Bước thực tế kế tiếp:** khôi phục STAGING, đối chiếu target/migration history bằng preflight rồi triển khai dữ liệu giả; tạo APK cập nhật và thử Android thật. Song song còn quota/phân trang, dependency runtime, app links và các điều kiện vận hành/phát hành trong kế hoạch. Chưa coi kiểm thử trình duyệt là nghiệm thu native.

## Triển khai sửa lỗi theo kế hoạch — 16/09/2026 (đợt trước)

**Đã sửa mã và kiểm chứng local; chưa hoàn thành phát hành thực tế.** Chi tiết, phạm vi kiểm thử và rủi ro còn lại: [báo cáo triển khai bảo mật](app/docs/IMPLEMENTATION_SECURITY_2026_09_16.md). Các mục phân tích/bản APK cũ bên dưới là lịch sử trước đợt sửa này.

- Sửa crypto/schema chặn tạo khoản vay; giới hạn quyền RPC; replay sạch 15 migrations. Chưa áp dụng cloud.
- Cách ly cache/route/response theo tài khoản, cố định JWT cho từng RPC để yêu cầu của A không dùng phiên của B; thêm SecureStore native và refresh theo vòng đời app.
- Hoàn thiện xử lý PKCE callback, chờ xác minh email, gửi lại email, đặt lại mật khẩu và đăng xuất. Auth local bắt buộc xác minh email/mật khẩu từ 12 ký tự; chưa thay Auth cloud.
- Giữ idempotency key khi mất phản hồi, ràng buộc payload ở server; trả đủ tự hủy pending có lý do; khóa giao dịch theo loan để tránh ghi nhận kép.
- Anonymous chỉ thấy trang mời chung; đã có thu hồi/tạo link mời thay thế và kiểm tra quyền phía server. Ai giữ link hợp lệ có thể đăng nhập tham gia theo quyết định đã chốt.
- Siết cấu hình Android backup/quyền/scheme; lọc telemetry; sửa refetch/lỗi tải ở các màn core. Nâng js-yaml bản vá tương thích, audit production dependencies còn 25 mục (9 high/16 moderate).
- Đã chạy Chrome với tài khoản giả/backend local: mở link mời không lộ chi tiết trước login, login quay về đúng link, logout giấu thông tin. Sửa lỗi tab web chặn các route Auth/invite; dùng chung khai báo route Android/web. Bài kiểm thử đã lưu và thêm vào CI, chưa thay thử thiết bị Android.
- **Bằng chứng:** 66 SQL assertions; 4 kịch bản kết nối database đồng thời; Auth GoTrue/Mailpit thật local; 32 unit tests; Chrome kiểm tra lời mời/login/logout đã qua cả cấu hình giả giống CI. `npm run validate` cuối đã qua format/lint/types/tests/export web 12 routes. CI đã thêm lệnh kiểm thử nhưng chưa chạy trên GitHub.
- **APK mới đã FINISHED:** [b9e038df-f1d8-492b-bb56-e8635da14ab5](https://expo.dev/accounts/loanappmobiles-team/projects/loanapp/builds/b9e038df-f1d8-492b-bb56-e8635da14ab5), [tải APK staging](https://expo.dev/artifacts/eas/_VV2dFJ0zh6wgUd8phL9ByEzYjpt_eZCpWwkc04vy38.apk). Đã tải về và xác minh chữ ký, package staging, `allowBackup=false`, không còn overlay/storage/`exp+loanapp`; SecureStore bị loại khỏi cloud backup và device transfer trong XML đóng gói. Bundle có URL STAGING, không có URL DEV/`.env`; marker `sb_secret_` đã đối chiếu bytecode là tiền tố kiểm tra của SDK. Chưa chạy điện thoại thật.

**Điểm chưa đóng:** DEV/STAGING vẫn `INACTIVE`; cần khôi phục staging để dry-run/deploy và thử hai thiết bị. Chính sách xóa tài khoản vẫn chờ bạn quyết định, chưa triển khai thêm. HTTPS App Links, push/outbox, quota/phân trang, dependency runtime, privacy/support/Play, backup restore và nghiệm thu Android/16 KB còn trong kế hoạch. Chưa đưa dữ liệu thật vào app.

## Phân tích tiếp sau APK staging — 16/09/2026

**Kết luận mới:** đã có APK nhưng chưa đủ điều kiện dùng dữ liệu thật. [Rà soát đưa vào sử dụng thực tế](app/docs/RELEASE_READINESS_REVIEW.md) ghi bằng chứng, điểm chặn RD-01–05 và thứ tự xử lý. Phiên này chỉ phân tích, chạy chẩn đoán local rồi rollback và cập nhật tài liệu; không sửa logic app hoặc cấu hình/database cloud.

- **P1 đã tái hiện:** trên local đủ 12 migrations, `create_loan` lỗi `gen_random_bytes(integer) does not exist`; preview lỗi `digest(text, unknown) does not exist`. Extension crypto nằm trong `extensions` trong khi RPC chỉ resolve `public`. Suite 23 SQL assertions cũ chưa gọi luồng tạo khoản vay nên chưa bắt được lỗi này.
- **Tính đúng giao dịch đã tái hiện:** cùng idempotency key nhưng đổi số tiền vẫn trả kết quả cũ; cùng payload với key mới tạo thêm proposal; trả đủ vẫn còn 2 proposal PENDING. Kịch bản chẩn đoán lưu trong `app/supabase/diagnostics/release-readiness.sql`, dùng dữ liệu giả và ROLLBACK; không tính 5 quan sát này là 5 test đã đạt.
- **Cache cần ưu tiên:** thử QueryClient cùng cấu hình/key với dữ liệu giả cho thấy fetch của B nhận cache A khi còn fresh. Đây là tái hiện ở lớp cache và đối chiếu mã, chưa phải E2E lộ dữ liệu trên điện thoại. Cần keys theo user, clear/cancel/subscription cleanup, chặn response cũ và route guard.
- **APK cần siết trước production:** `allowBackup=true`, có quyền overlay/storage và scheme phụ `exp+loanapp`. LOAD/ZIP alignment của 50 thư viện 64-bit đạt kiểm tra cấu trúc 16 KB, nhưng 41 thư viện bị gắn cờ ở phép kiểm RELRO bổ sung; cần đối chiếu NDK tools và thử thiết bị 16 KB. Chưa công nhận tương thích native đầy đủ hoặc suy ra đã rò dữ liệu qua backup.
- Đọc lại cloud trong phiên này: DEV và STAGING vẫn `INACTIVE`. Chưa áp dụng các sửa local lên cloud. Cần trang privacy/support/xóa tài khoản, hồ sơ Play và bằng chứng vận hành theo bản rà soát.

**Ưu tiên mới:** sửa crypto/schema và thêm test toàn luồng RPC → cách ly tài khoản/auth → idempotency/ACL/invite → hai thiết bị/vận hành → production beta. Có thể xử lý ba nhóm đầu trên local khi staging còn dừng; policy room sau xóa tài khoản vẫn chờ chủ dự án quyết định.

## Thực thi trở lại — 16/09/2026

**Phạm vi:** chủ dự án đã cho phép tự động hóa; Android trước, một người phát triển. Người giữ link hợp lệ có thể đăng nhập để tham gia, không ràng buộc email người nhận. Chính sách giữ lịch sử/chuyển room sang chỉ đọc khi xóa account còn chờ bàn thêm, chưa triển khai.

### Đã thực hiện và kiểm chứng

- Tách DEV/STAGING/PRODUCTION trong EAS và native package/scheme; bổ sung build preflight chặn thiếu/sai môi trường, nhầm project và server key. Production identity giữ nguyên. Node build được cố định ở 24.16.0.
- EAS preview ban đầu không có biến môi trường. Đã upload bốn giá trị cấu hình public đã kiểm tra cho staging; EAS tạo keystore riêng cho package staging. Chưa sửa cấu hình production hoặc database remote.
- Truy nguyên build preview cũ `2516cb39-4b1e-4716-8a7b-c9f4c9991f05`: Sentry upload thiếu organization. Tạm tắt upload source map ở DEV/preview; production vẫn cần cấu hình Sentry.
- Build `0cfe5d8b-fc10-4a6a-9a35-7a74c936c441` bị build guard chặn do môi trường không khớp. Kiểm tra archive thấy `.env` local lọt vào gói trên Windows. Đã bổ sung `.easignore` ở gốc repo; kiểm tra archive mới không còn `.env`, `.local`, Git metadata, CLI link metadata hay khóa ký và vẫn có source/config cần thiết.
- Thêm Supabase local config, fixtures tổng hợp và job CI database. Replay sạch **12 migrations** trên local thành công; fixtures test nằm trong transaction được rollback.
- Tái hiện lỗi hủy repayment có creator NULL bởi outsider, sửa bằng membership/NULL-safe authorization; sửa dispute thiếu `disputed_at`. Bản trước sửa thất bại 8/19 assertions; suite mở rộng sau sửa đạt **23/23**. Migration mới chỉ áp dụng local, không thay lịch sử migrations.
- `npm run validate` đạt format, lint, TypeScript, **16 tests**, export web **11 routes**. Kiểm tra lại format/tests sau chỉnh cấu hình đạt. CI mới chưa được chạy trên GitHub.

### Chưa đạt và phụ thuộc bên ngoài

- **M0 chưa nghiệm thu đầy đủ.** Android preview `e9186536-9ae2-4067-9023-48775f738c29` đã **FINISHED** trên EAS. [Trang build](https://expo.dev/accounts/loanappmobiles-team/projects/loanapp/builds/e9186536-9ae2-4067-9023-48775f738c29), [APK staging](https://expo.dev/artifacts/eas/L0I-Ba5Oas6ksZcv3n1k65ErvC1smhg2xv3euWMYJEQ.apk). Máy hiện không có thiết bị Android kết nối/AVD đã cấu hình; chưa cài và thử đăng nhập.
- Kiểm tra APK tải về: package `com.loanappmobiles.loanapp.staging`, tên `Loan (staging)`, version `1.0.0`/code `1`, min SDK 24, target SDK 36, chữ ký v2 hợp lệ/một signer. SHA-256 `67967E1FA9E7D91F78C992A0B10E8697242F21720FCE996308EBD329E33B9D99`. Bundle có đúng một Supabase origin là staging, không có URL DEV đã cấu hình và không đóng gói `.env`. Chuỗi `sb_secret_` được đối chiếu bảng chuỗi Hermes: chỉ là prefix detector của SDK, không phải giá trị key. Đây là kiểm tra artifact có phạm vi, chưa thay cho secret scan đầy đủ hoặc kiểm thử mạng trên thiết bị.
- Inventory Supabase qua CLI đã xác thực cho thấy DEV và STAGING đều **INACTIVE**; DNS staging không phân giải. Cần khôi phục project staging hiện có qua dashboard, rồi kiểm tra migration diff/Auth redirects trước mọi remote write. Chưa có phiên điều khiển trình duyệt được kết nối trong bộ công cụ hiện tại.
- `npm audit --omit=dev` báo **26 mục** (16 moderate, 10 high, 0 critical), gồm nhiều dependency bắc cầu. Chưa triage khả năng tác động hoặc sửa các advisory; không coi tất cả là 26 lỗ hổng runtime riêng biệt. Không chạy `audit fix --force` để nâng Expo major ngoài kiểm soát.
- Chưa kiểm tra APK trên thiết bị, đăng nhập/OAuth hai tài khoản, toàn bộ ACL/default grants, concurrent mutations, JWT/Realtime sau logout, scrub log, backup/restore, MFA/recovery, billing hoặc Play Console. 23 assertions SQL chỉ bao phủ các regression đã nêu.
- Inventory function EXECUTE local: 15/17 functions trong public vẫn cho anon EXECUTE, gồm preview có chủ đích và trigger functions; hai hàm cancel/dispute mới đã chặn. Đây là quyền rộng cần thu hẹp và kiểm tra thân hàm trong M2, chưa đủ kết luận anonymous đọc/ghi được dữ liệu. Chưa kiểm kê quyền remote/default ACL/schema usage đầy đủ.
- Schema usage local: anon/authenticated có USAGE trên public, không có trên private; API local chỉ expose public. Đã đọc default ACL của postgres/supabase_admin, còn cần kiểm thử allowlist cho object mới và toàn bộ quyền table/sequence trước khi đóng SEC-02. Không suy diễn helper private gọi được qua API chỉ từ function EXECUTE.
- Chưa triển khai recipient binding hoặc policy room sau deletion. Các quyết định phạm vi khác trong kế hoạch vẫn cần chốt trước phần phụ thuộc.

### Thứ tự tiếp theo

1. Cài APK staging trên Android, khôi phục STAGING và xác minh target/migration diff/redirect; dùng dữ liệu giả để nghiệm thu M0.
2. M1: session storage, callback và cách ly cache theo user; test đổi account/response về muộn.
3. M2: ACL đầy đủ, payload-bound idempotency, invite capability/revoke/expiry và concurrency. Xử lý dependency theo kết quả triage trước dữ liệu thật.
4. Chỉ triển khai hành vi xóa tài khoản sau khi thống nhất policy; tiếp tục M3–M6 theo cổng nghiệm thu trong kế hoạch.

## Lịch sử rà soát và lập kế hoạch — trước khi thực thi ngày 16/09/2026

Các ghi nhận trong mục này là trạng thái trước khi chủ dự án cho phép triển khai lại; xem mục thực thi ở trên để biết kết quả hiện tại.

- **Rủi ro với chủ dự án:** bổ sung OPS-01–09 và checklist trước production tại mục 8 kế hoạch bảo mật. Chưa kiểm tra tài khoản quản trị, máy cá nhân, public store profile hoặc billing thực tế; chưa thay đổi cloud. Bao gồm recovery, signing, phạm vi automation, cost abuse và thông tin cá nhân công khai.

- **Bổ sung bảo mật v2:** [Kế hoạch bảo mật](KE_HOACH_BAO_MAT.md), 20 case và S0–S5; cập nhật ước lượng solo 12–18 tuần. Theo yêu cầu mới đang dừng triển khai, chỉ chỉnh tài liệu.
- **Phát hiện ưu tiên:** `cancel_repayment` thiếu membership check, dùng `created_by <> auth.uid()` trong khi deletion đặt creator NULL. Có đường bypass suy luận từ mã với pending repayment có creator NULL; cần tái hiện bằng DB test trước kết luận môi trường thực tế. Chưa sửa/chưa thử khai thác.
- **Cần kiểm chứng thêm:** function EXECUTE/default ACL/PUBLIC, preview tài chính trước auth, JWT cũ sau logout/deletion, deletion state/re-auth/audit, log/backup retention và limiter không bypass. Không coi các checklist bảo mật mới là kết quả đã pass.

- **Kế hoạch hiện hành:** [Kế hoạch ra mắt Android](KE_HOACH_RA_MAT_ANDROID.md). Chủ dự án xác nhận một người triển khai, Android trước/iOS sau.
- Trong phiên kiểm tra ngày 16/09, `npm run validate` đạt format, lint, TypeScript, 11 unit tests và web export 11 routes. Sentry vẫn cảnh báo thiếu organization/project.
- Chưa xác minh cloud/native build, migrations remote hay test database/RLS/concurrency. Các kết quả DEV/EAS ngày 22/08 bên dưới là lịch sử.
- Qua đọc mã có khoảng trống OAuth, cache theo user, retry/idempotency, Realtime repayments, xóa tài khoản và push. Phát hiện thêm `dispute_repayment` không ghi `disputed_at` dù constraint yêu cầu; response cache idempotency giữ token invite thô dù bảng invites dùng hash. Cần tái hiện/test và sửa theo M1–M4; chưa đánh dấu hoàn thành.
- **Trạng thái hiện tại:** MVP có mã nguồn, chưa đủ bằng chứng sẵn sàng beta dùng dữ liệu thật. Các dòng “hoàn tất trong mã nguồn” bên dưới không phải nghiệm thu sản phẩm.
- Thay đổi đợt lập kế hoạch này chỉ ở tài liệu; cấu hình EAS, database và ứng dụng chưa được sửa/deploy.

### Nhật ký nghiệm thu kế hoạch mới

| Task/mốc | Trạng thái | Commit/build | Môi trường | Test/kết quả | Ngày |
| --- | --- | --- | --- | --- | --- |
| M0 — bản cài, staging, quyết định phạm vi | Chưa nghiệm thu | Chưa có bằng chứng mới | Chưa xác minh | Xem checklist M0 | — |

## Báo cáo lịch sử — 22/08/2026

**Cập nhật:** 22/08/2026  
**Mục đích:** Theo dõi phần đã hoàn thành, bằng chứng kiểm tra và các việc cần người phụ trách thực hiện sau. Việc hoãn không được tính là hoàn thành.

**Hướng dẫn thao tác cần con người:** `HUMAN_IMPLEMENTATION_RUNBOOK.md`

## Tổng quan

| Phase | Trạng thái | Kết quả chính | Việc còn lại |
|---|---|---|---|
| 0 — Chốt sản phẩm | Hoàn tất có điều kiện | MVP, thuật ngữ, quy tắc miền | Kiểm tra tên Loan và khai báo mã hóa iOS |
| 1 — Kiểm chứng UX | Chờ người dùng thử | Prototype, kịch bản test | 5 role-direction test, 5 Language-Blind test |
| 2 — Nền tảng | Hoàn tất trong mã nguồn, build Android lỗi | Expo, CI, EAS, cấu hình môi trường | Lỗi Gradle EAS, iOS credentials, Sentry production |
| 3 — Dữ liệu & xác thực | Hoàn tất trong mã nguồn/DEV | Schema, RPC, RLS foundation, Auth | Google OAuth, RLS test, deletion worker |
| 4 — Tạo khoản vay & lời mời | Hoàn tất trong mã nguồn/DEV | Create, review, share, preview, accept/decline | E2E hai tài khoản, recipient-binding decision |
| 5 — Loan Room chung | Hoàn tất trong mã nguồn/DEV | Home, Room, Realtime, canonical reads | Chính sách offline cache, E2E hai thiết bị |
| 6 — Toàn vẹn trả nợ | Hoàn tất trong mã nguồn/DEV | RPC trả nợ, kiểm soát quyền, UI | E2E/concurrency, quy tắc đóng room |
| 7 — Sẵn sàng sản phẩm | Hoàn tất trong mã nguồn | Song ngữ, accessibility, privacy foundation | Push, Sentry, legal/privacy, E2E thật |
| 8 — Phát hành | Chuẩn bị phát hành | CI, README, beta checklist | Artifact cài được, store/legal/monitoring |

## Bằng chứng gần nhất

- `npm run validate` đã đạt: Prettier, ESLint, TypeScript, unit test và static web export.
- Có 11 unit tests đang pass; `app/dist/index.html` và 11 routes đã được tạo.
- Supabase DEV: local/remote khớp 11 migrations, gồm `20260822100000_account_deletion_history_retention.sql`.
- Android production build `ead21548-3afb-4d13-a07b-8bae56fb615c` và preview build nội bộ `2516cb39-4b1e-4716-8a7b-c9f4c9991f05` đều lỗi `EAS_BUILD_UNKNOWN_GRADLE_ERROR`; lỗi đã tái lập ở cả hai profile.
- Kiểm tra Expo Go trên Android cho thấy lỗi `Incompatible SDK version` với SDK 57. Dự án đã được hạ về Expo SDK 54 để kiểm thử bằng Expo Go; `expo-doctor` đạt 18/18, lint và TypeScript sạch, Vitest đạt 11/11. Cần quét QR lại sau khi khởi động Metro.

---

## Phase 0 — Chốt sản phẩm

### Đã hoàn thành

- Tên hiển thị: **Loan**.
- MVP là sổ ghi nhận chung cho một lender và một borrower; không xử lý thanh toán, không cho vay, không marketplace.
- Quy tắc minor-unit, idempotency, RLS, audit timeline và state machine đã được tài liệu hóa.
- Android/iOS application ID: `com.loanappmobiles.loanapp`; URL scheme: `loan`.

### Cần xác nhận

| Việc | Điều kiện hoàn tất |
|---|---|
| Tên/trademark/store availability | Đánh giá tên Loan tại thị trường phát hành |
| Mã hóa iOS | Xác nhận `ITSAppUsesNonExemptEncryption` đúng với chức năng app |

## Phase 1 — Kiểm chứng UX

### Đã hoàn thành

- Prototype: `prototype/index.html`.
- Kịch bản test: `PHASE_1_TEST_PLAN.md`.
- Luồng Create → Invite/Join → Loan Room → Repayment → Confirm đã có.

### Cần thực hiện với người dùng

| Việc | Điều kiện hoàn tất |
|---|---|
| 5 lượt role-direction test | Không có lỗi P0 về lender/borrower hoặc hướng tiền |
| 5 lượt Language-Blind test | Ít nhất 90% hoàn thành luồng chính không trợ giúp |
| Cập nhật UX theo bằng chứng | Xử lý các lỗi lặp lại từ ít nhất 2 người thử |

## Phase 2 — Nền tảng

### Đã hoàn thành

- Expo SDK 54, Expo Router, TypeScript strict, ESLint, Prettier, Vitest, GitHub Actions CI.
- TanStack Query, Zustand, validation, i18n, Supabase client theo môi trường và Sentry skeleton.
- EAS liên kết `@loanappmobiles-team/loanapp`; static web export đã kiểm tra.

### Cần người phụ trách

| Việc | Điều kiện hoàn tất |
|---|---|
| Android build | Mở EAS dashboard của preview build `2516cb39-4b1e-4716-8a7b-c9f4c9991f05` hoặc production build cũ, lấy lỗi đầu tiên ở **Run gradlew** để sửa; hiện chưa có APK |
| iOS build | Có Apple Developer credentials, signing và EAS build `finished` |
| Sentry production | DSN/org/project/token, scrubbed event và source map hoạt động |
| Dependency audit | Theo dõi 12 moderate advisory Expo/xcode → uuid; chỉ nâng cấp khi có bản Expo tương thích |

## Phase 3 — Dữ liệu & xác thực

### Đã hoàn thành trên DEV

- Schema profiles, loans, members, invites, repayments, events, idempotency và notification preferences.
- RPC atomic/idempotent và RLS foundation cho dữ liệu tài chính.
- Email/mật khẩu và Google OAuth flow đã có trong app; Apple Sign In hoãn đến iOS release.
- Migration retention bảo toàn lịch sử chung, đồng thời ẩn danh actor/creator khi auth user bị xóa.
- Edge Function `supabase/functions/delete-account` đã có mã nguồn.

### Cần người phụ trách

| Việc | Điều kiện hoàn tất |
|---|---|
| Google OAuth | Bật provider, tạo Google client, cấu hình callback/redirect và thử trên thiết bị thật |
| Ma trận RLS | Docker/local Supabase hoặc test project; chạy `supabase/tests/rls_phase_3.md` |
| Worker xóa tài khoản | Legal/privacy review, deploy Edge Function, test profile bị xóa và lịch sử chung vô danh còn lại |
| Staging | Replay migration từ đầu không drift |

## Phase 4 — Tạo khoản vay & lời mời

### Đã hoàn thành

- Token lời mời chỉ trả một lần, lưu SHA-256 hash, chặn hết hạn/đã dùng/thu hồi.
- Create screen Việt/Anh, validation, deep link `loan://invite/<token>`, preview và accept/decline.
- Người chưa đăng nhập quay lại đúng invite sau auth.
- Confirmation trước khi tạo invite hiển thị vai trò, số tiền, ngày vay và ngày đến hạn; người dùng có thể hủy.

### Cần người phụ trách

| Việc | Điều kiện hoàn tất |
|---|---|
| E2E hai tài khoản | A tạo → B nhận link → B chấp nhận → cả hai thấy loan `ACTIVE` |
| Test token abuse | Token hết hạn, dùng lại, thu hồi đều bị chặn |
| Chính sách lời mời | Chốt capability link hiện tại hoặc recipient-binding qua email/tài khoản |

## Phase 5 — Loan Room chung

### Đã hoàn thành

- Canonical Home/Loan Room chỉ trả dữ liệu cho accepted members.
- Balance chỉ tính repayment `CONFIRMED`; Home, Room, timeline và realtime cache invalidation đã có.

### Cần người phụ trách

| Việc | Điều kiện hoàn tất |
|---|---|
| Chính sách offline cache | Chốt có được lưu dữ liệu tài chính không mã hóa hay bắt buộc encrypted storage |
| E2E hai thiết bị | Hai thiết bị hội tụ canonical data sau create/join/repayment |

## Phase 6 — Toàn vẹn trả nợ

### Đã hoàn thành

- Submit/confirm/dispute/cancel là RPC server-side atomic và idempotent.
- Chặn self-confirm, overpayment; balance chỉ đổi khi `CONFIRMED`; trả đủ chuyển `ACTIVE` sang `REPAID`.
- UI chỉ hiện Cancel cho người tạo, Confirm/Dispute cho người còn lại; không optimistic update balance.
- Form báo lỗi số tiền, tiền tệ và ngày trước RPC; server vẫn là lớp quyết định cuối.

### Cần người phụ trách

| Việc | Điều kiện hoàn tất |
|---|---|
| E2E/concurrency | Xác minh self-confirm, duplicate key, retry, timeout, overpayment, concurrent confirm, dispute/cancel |
| Đóng room | Chốt `REPAID → CLOSED`: một bên hay cả hai xác nhận |

## Phase 7 — Sẵn sàng sản phẩm

### Đã hoàn thành

- UI Việt/Anh; theo locale thiết bị, đổi thủ công trong Preferences và lưu `profiles.locale` sau đăng nhập.
- Tiền/ngày/giờ, trạng thái loan/repayment và timeline event được dịch.
- Accessibility labels, trạng thái không chỉ dựa vào màu, deep links, error/retry states.
- Notification preferences server-side; Settings không gọi RPC dữ liệu cá nhân khi chưa đăng nhập.
- Delete-account request, audit migration, privacy policy nội bộ và retention/anonymization foundation.

### Cần người phụ trách

| Việc | Điều kiện hoàn tất |
|---|---|
| Push/reminder | Credentials, token backend, scheduler, timezone/dedup/opt-out test thật |
| Privacy/Terms | Legal review, URL công khai, retention/contact/re-auth trước xóa đã chốt |
| Sentry | Scrubbed event và source map pass |
| Security E2E | Ma trận RLS, two-device và concurrency có bằng chứng |

## Phase 8 — Phát hành

### Đã hoàn thành

- CI chạy `npm ci` và `npm run validate`.
- README, EAS profiles, beta checklist, báo cáo và runbook đã có.

### Cổng bắt buộc trước beta công khai

1. Android và iOS preview artifact cài được.
2. Invite/join, repayment integrity/concurrency và RLS E2E pass.
3. Worker xóa tài khoản deploy/test; privacy review pass.
4. Push opt-out, dedup, timezone và deep link pass.
5. Sentry có scrubbed test event.
6. Privacy Policy, Terms, App Store Privacy và Google Play Data Safety hoàn chỉnh.

### Các quyết định còn chờ

- Offline cache: không mã hóa hay encrypted storage?
- Invitation forwarding: capability link hay recipient-bound?
- Loan closure: một participant hay cả hai đóng room sau `REPAID`?
- Tên Loan có thể dùng ở thị trường phát hành không?
- Lỗi đầu tiên trong EAS **Run gradlew** là gì?
