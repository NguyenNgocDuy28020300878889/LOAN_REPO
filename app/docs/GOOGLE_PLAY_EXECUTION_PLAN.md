# LOAN — Các bước chuẩn bị phát hành Google Play

Cập nhật: 23/09/2026.

## Mục tiêu và cách sử dụng

Đưa LOAN Android đến trạng thái có thể dùng dữ liệu thật, gửi xét duyệt và vận hành sau phát hành. Tài liệu này chia phần trợ lý có thể thực hiện thành các bước cụ thể; việc lưu kế hoạch chưa đồng nghĩa đã triển khai hoặc nghiệm thu.

Đọc cùng [kế hoạch ra mắt hiện hành](../../KE_HOACH_RA_MAT_ANDROID.md), [kế hoạch bảo mật](../../KE_HOACH_BAO_MAT.md), [bằng chứng sửa lỗi](IMPLEMENTATION_SECURITY_2026_09_16.md) và [tài liệu APK](ANDROID_TEST_APK.md). Không thay đổi các quyết định phạm vi đã chốt. Nếu tài liệu cũ khác mã nguồn hoặc cấu hình hiện tại, xác minh và ghi rõ bằng chứng trước khi sửa.

Các sửa lỗi RPC, cách ly tài khoản và idempotency đã có bằng chứng local trong báo cáo trước; không coi chúng là chưa làm để triển khai lại. Các bước dưới đây là danh sách cần kiểm tra và đóng điều kiện phát hành, không phải danh sách lỗi đã xác nhận.

## Bước 1 — Xác minh hiện trạng và lập danh sách việc còn thiếu

- [x] Đọc mã nguồn, migrations, scripts kiểm thử và các báo cáo mới nhất; kiểm tra thay đổi đang có để bảo toàn công việc hiện hữu.
- [x] Đối chiếu phiên bản APK đang dùng với mã nguồn, build và môi trường backend.
- [x] Phân loại từng hạng mục: đã có bằng chứng đạt / cần kiểm chứng lại / lỗi cần sửa / thiếu thông tin hoặc quyền truy cập.
- [x] Xác nhận phạm vi đăng nhập hiện hành từ tài liệu auth và quyết định mới nhất; không tự khôi phục yêu cầu đăng nhập cũ đã được thay thế.

**Đầu ra:** danh sách công việc có mức ưu tiên, nguồn bằng chứng và phụ thuộc. Chưa kết luận trạng thái cloud từ báo cáo lịch sử.

**Điều kiện hoàn thành:** biết rõ lỗi nào còn tồn tại và bài kiểm thử nào còn thiếu. Chỉ sửa phần có nhu cầu đã xác minh.

### Kết quả thực hiện bước 1 — 23/09/2026

Phạm vi được đối chiếu tại commit `87e1b8fbc607134d20eeb531b9e18ca14819c608`. Trước khi cập nhật tài liệu này, worktree không có sửa đổi tracked; tài liệu kế hoạch là file mới chưa commit. Không thay đổi mã ứng dụng, migration hoặc cloud trong bước này. Supabase local được khởi động để chẩn đoán rồi đã dừng; các cổng tạm dùng khi kiểm thử đã được trả về cấu hình ban đầu.

#### Kết luận ưu tiên

| Mức | Trạng thái                                   | Bằng chứng và tác động                                                                                                                                                                                                                                                                                                                                                                         | Việc tiếp theo                                                                                                                                             |
| --- | -------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------- |
| P0  | **Đã sửa và kiểm chứng local**               | Migration bổ sung `20260923090000_create_loan_contract.sql` xóa hai overload cũ và tạo một function duy nhất với email tùy chọn có default. Replay sạch 21 migrations, lời gọi có/không có email, 141 SQL assertions và 4 concurrency scenarios đều đạt.                                                                                                                                       | Xác nhận GitHub CI xanh, sau đó dry-run và triển khai migration bổ sung lên STAGING trước khi build APK mới.                                               |
| P1  | **Đã sửa và kiểm chứng local**               | Email người nhận được chuẩn hóa và đưa vào fingerprint của command mới. Cùng key/cùng email chuẩn hóa trả receipt cũ; cùng key/khác email bị từ chối. Receipt hoàn tất từ fingerprint cũ vẫn replay được nhưng không tạo khoản vay mới hoặc đổi người nhận.                                                                                                                                    | Giữ regression mới trong CI và xác minh hành vi qua PostgREST/browser journey trên job database.                                                           |
| P1  | **Đã bổ sung regression SQL**                | `create_loan_contract.test.sql` kiểm tra chỉ có một function API, quyền anonymous, tương thích receipt cũ, binding email, danh sách/detail lời mời, outsider denial, accept và retry theo `loan_id`. Tổng suite tăng từ 125 lên 141 assertions.                                                                                                                                                | Bổ sung native/two-device acceptance sau khi migration có trên STAGING; SQL regression không thay thế Android E2E.                                         |
| P1  | **Artifact chưa khớp HEAD**                  | Có APK staging `1.0.0 (8)`, package `com.loanappmobiles.loanapp.staging`, min SDK 24, target/compile SDK 36. File APK có trước commit cuối sửa navigation; chưa có build ID/digest chứng minh chứa đúng HEAD. Không có thiết bị ADB kết nối trong lượt này. Script kiểm tra chữ ký bị chặn vì Java mặc định trên máy crash với exit `-1073740791`; kiểm tra metadata bằng `aapt` vẫn đọc được. | Sau khi sửa P0/P1, tạo APK/AAB gắn commit SHA và build ID; sửa Java/JDK kiểm tra chữ ký, chạy script artifact và cài từ Play/internal track trên thiết bị. |
| P1  | **Đang chờ CI của commit sửa lỗi**           | Run cũ của HEAD `35623184587` có job `quality` thành công và job `database` thất bại tại SQL regression. Local hiện đạt replay sạch, 141 SQL assertions, concurrency và `npm run validate`; chưa coi CI xanh cho tới khi commit ứng viên chạy xong trên GitHub.                                                                                                                                | Commit/push bản sửa, theo dõi cả `quality` và `database`; nếu lỗi, lấy log, sửa và chạy lại cho tới khi xanh.                                              |
| P1  | **Xóa tài khoản chưa hoàn chỉnh**            | UI chỉ gọi `request_account_deletion()` và báo đã nhận yêu cầu. Edge Function `delete-account` không được UI gọi; README yêu cầu chỉ deploy sau khi review. Chưa có fresh re-auth, worker/retry bền vững, trạng thái cho người dùng, policy room/lịch sử sau xóa hoặc URL yêu cầu xóa công khai.                                                                                               | Chốt policy nghiệp vụ trước, sau đó thực hiện bước 5; không mở dữ liệu thật khi mới chỉ ghi hàng `PENDING`.                                                |
| P1  | **Production chưa được cấu hình/kiểm chứng** | Build guard hoạt động và từ chối production khi thiếu URL/key/project ref. Lượt này chỉ xác nhận local shell chưa có cấu hình production; chưa đọc được bằng chứng EAS production, production Supabase, backup/restore, Sentry upload hoặc Play Console.                                                                                                                                       | Chuẩn bị production project và quyền truy cập ở bước 6–8; chạy preflight bằng môi trường production thực mà không in secret.                               |
| P2  | **Đăng nhập dự phòng còn chặn**              | Google là phương thức chính đã được bật trên DEV/STAGING. Auth/API của cả hai project đang truy cập được, yêu cầu xác minh email và chặn anonymous financial RPC/table. Email OTP cloud vẫn tắt do chưa có SMTP; chưa có nghiệm thu đăng nhập Google tương tác trọn vòng trên bản HEAD/Android.                                                                                                | Giữ Google là chính; cấu hình SMTP nếu vẫn phát hành OTP dự phòng và nghiệm thu callback/cold start trên Android.                                          |
| P2  | **Push mới đạt một phần**                    | STAGING đã có schema/worker/cron và từng đăng ký một thiết bị; delivery thật vẫn tắt do thiếu Expo access token riêng. Chưa có bằng chứng nhận push end-to-end trên APK phù hợp HEAD.                                                                                                                                                                                                          | Hoàn tất credential, gửi canary nội dung chung và thử foreground/background/khóa máy/đổi tài khoản trước production.                                       |
| P2  | **Chưa có HTTPS App Links**                  | Native config hiện chỉ khai báo custom scheme theo môi trường; chưa có `intentFilters`/domain association hoặc landing URL. Luồng dán lời mời trong app đã có nhưng chưa thay cho trải nghiệm cài/mở từ HTTPS khi phát hành.                                                                                                                                                                   | Thực hiện khi có tên miền và kiểm tra cold/warm/install journey ở bước 4.                                                                                  |
| P2  | **Dependency cần triage**                    | `npm audit --omit=dev` hiện báo 26 dependency nodes: 9 high, 17 moderate, 0 critical. Phần lớn đi qua Expo/Metro/build chain; lệnh đề xuất nâng Expo major 57 nên chưa được áp dụng tự động.                                                                                                                                                                                                   | Phân loại đường runtime/build, ưu tiên URL parsing và input không tin cậy; lập kế hoạch nâng Expo có kiểm thử native riêng.                                |
| P2  | **Máy local có xung đột cổng**               | Windows đang reserve dải chứa `54321–54329`, khiến cấu hình Supabase mặc định không publish được cổng. Lượt kiểm tra dùng tạm `55431–55439`, sau đó đã khôi phục file cấu hình. CI Linux không phụ thuộc hạn chế này.                                                                                                                                                                          | Chọn dải cổng local cố định ngoài excluded ranges hoặc điều chỉnh reservation của máy trước lần chạy E2E local tiếp theo.                                  |

#### Bằng chứng đã đạt ở hiện trạng

- `npm run validate` đạt format, lint, TypeScript, **19 test files / 86 unit tests** và web export **14 routes**. Export còn cảnh báo thiếu Sentry organization/project; không xem đó là production monitoring đã sẵn sàng.
- DEV và STAGING hosted Auth/API đều truy cập được; publishable key hợp lệ, xác minh email đang bật và truy cập financial RPC/table ẩn danh bị từ chối. Kiểm tra không gửi email và không ghi dữ liệu.
- Migration history STAGING khớp toàn bộ **20 migration files** tại thời điểm kiểm tra. Điều này đồng thời xác nhận lỗi overload đã nằm trong schema STAGING, dù client hiện tại gửi đủ 9 named arguments.
- Cách ly tài khoản, command executor, auth callback, session storage, push client và telemetry sanitizer có unit tests hiện hành. Các bằng chứng này không thay thế native/device E2E.
- APK 8 có package staging, target SDK 36 và quyền push cần thiết; không có thiết bị kết nối để nghiệm thu. Kiểm tra chữ ký độc lập chưa đạt do Java local hỏng, không phải vì đã chứng minh chữ ký APK sai.

#### Khoảng trống kiểm thử sau khi sửa lỗi P0

1. Replay sạch đủ migrations → 125+ SQL assertions → 4 concurrency scenarios.
2. Local Auth/OTP integration và browser journey ba tài khoản trên schema mới.
3. STAGING SQL regression rollback, Google login thật, hai tài khoản/two-device loan journey và push thật.
4. APK/AAB mới khớp commit, kiểm tra chữ ký/manifest/16 KB và cài mới/cập nhật trên Android.
5. Production configuration, deletion end-to-end, privacy/support URLs, backup/restore, Sentry canary và Play declarations.

**Cập nhật sau sửa contract:** lỗi P0 và hai khoảng trống P1 liên quan đã đóng ở local. Chỉ chuyển sang nghiệm thu bước 2 sau khi commit ứng viên có cả hai job GitHub CI xanh; sau đó dùng kết quả luồng hai người làm bằng chứng phát hành.

## Bước 2 — Hoàn thiện luồng vay giữa hai người

- [ ] Kiểm tra và sửa nếu cần: tạo khoản vay → xem lời mời → đăng nhập → chấp nhận/từ chối → phòng khoản vay.
- [ ] Kiểm tra trả một phần/toàn bộ, xác nhận, tranh chấp, hủy và tất toán; đối chiếu số dư và lịch sử ở cả hai bên.
- [ ] Kiểm tra lời mời hết hạn, thu hồi, cấp lại và mở lời mời khi ứng dụng đang tắt hoặc ở nền.
- [ ] Kiểm tra đồng bộ khi vào thẳng phòng, quay lại ứng dụng và kết nối mạng trở lại.
- [ ] Hoàn thiện thông báo loading, lỗi, trạng thái rỗng, tiền/ngày và thao tác bàn phím Android.

**Đầu ra:** bản sửa và bằng chứng hành trình hai tài khoản. Dùng Playwright cho web và kiểm tra native trên thiết bị; không lấy kết quả web thay cho Android.

**Điều kiện hoàn thành:** hai bên thấy cùng khoản vay, số dư và lịch sử chính xác; không có bước chính bị chặn.

### Kết quả local bước 2 — 23/09/2026

- Replay sạch 21 migrations và `supabase db lint` không phát hiện lỗi schema.
- 141 SQL assertions đạt, bao gồm contract `create_loan`, receipt cũ, email người nhận, quyền lời mời và retry; 4 concurrency scenarios đều đạt.
- Auth/PKCE, recovery, logout và email OTP local đều đạt.
- Browser journey ba tài khoản đạt toàn bộ luồng: hủy xác nhận tạo khoản vay; nhập tiền/ngày; gắn lời mời theo email; chia sẻ đúng URL; bảo vệ nội dung trước đăng nhập; quay lại đúng link sau đăng nhập; danh sách lời mời trong app; chấp nhận và vào đúng phòng; hai lần trả nợ; retry khi mất response không ghi trùng; tất toán và hủy giao dịch đang chờ; Realtime; từ chối tài khoản ngoài cuộc; đăng xuất. Toàn bộ HTTP/WebSocket đều dùng backend local.
- Các script kiểm thử local chấp nhận mọi cổng loopback được khai báo rõ, nên chạy được trên máy Windows có dải cổng Supabase mặc định bị reserve.

Bước 2 chưa hoàn tất trên native: migration chưa có trên STAGING, CI của commit ứng viên chưa xanh, và chưa có bằng chứng hai thiết bị Android cho Google callback, bàn phím, cold/warm link, foreground/reconnect và push.

## Bước 3 — Kiểm chứng an toàn tài khoản và giao dịch

- [ ] Kiểm tra đổi tài khoản A → đăng xuất → B, request A trả về muộn, cache, subscriptions và phiên sau khi mở lại app.
- [ ] Thử mất response rồi gửi lại, bấm lặp và hai người xác nhận đồng thời; xác minh idempotency và xử lý nguyên tử.
- [ ] Kiểm tra RLS/RPC với người chưa đăng nhập, hai bên khoản vay và tài khoản ngoài cuộc.
- [ ] Đánh giá cảnh báo xác thực/PKCE trên Android đã ghi trong tài liệu APK, quyền native và dữ liệu có thể lọt vào log.
- [ ] Nếu cần thay database: đọc schema và migration history trước; viết migration mới có phương án khôi phục, không sửa mù hoặc sửa lịch sử đã áp dụng.

**Đầu ra:** sửa lỗi có căn cứ, kiểm thử hồi quy SQL/auth/concurrency phù hợp và báo cáo rủi ro còn lại.

**Điều kiện hoàn thành:** không lẫn dữ liệu giữa tài khoản, không truy cập trái quyền, không ghi trùng hoặc sai số dư trong các kịch bản đã kiểm thử.

## Bước 4 — Hoàn thiện đăng nhập, liên kết mời và thông báo

- [ ] Kiểm chứng Google đăng nhập và callback trên bản Android; chuẩn bị cấu hình cho người dùng ngoài danh sách thử nghiệm.
- [ ] Hoàn thiện phương thức đăng nhập/khôi phục dự phòng theo phạm vi đã chốt; cấu hình SMTP nếu dùng email OTP.
- [ ] Chuẩn bị HTTPS App Links và trang hướng dẫn cài/mở lại lời mời theo kế hoạch ra mắt; giữ luồng dán lời mời đã có.
- [ ] Kiểm tra push, nhắc hạn, tùy chọn tắt thông báo, gửi trùng, token hết hiệu lực và nội dung không lộ thông tin tài chính nhạy cảm.

**Đầu ra:** mã và hướng dẫn cấu hình theo môi trường, kèm bằng chứng đăng nhập/link/push thực tế.

**Cần chủ dự án cung cấp khi thiếu:** quyền cấu hình Google/Firebase/Supabase, tên miền/DNS và dịch vụ email. Trợ lý có thể chuẩn bị code, tài liệu và kiểm thử local trước.

**Điều kiện hoàn thành:** người dùng thuộc phạm vi phát hành đăng nhập được, mở được lời mời và nhận/tắt thông báo đúng thiết kế.

## Bước 5 — Hoàn thiện xóa tài khoản và chính sách dữ liệu

- [ ] Rà soát luồng xóa hiện tại; nối giao diện với quy trình thực thi, xác thực lại, trạng thái xử lý, retry và audit.
- [ ] Chốt trước cách xử lý khoản vay còn hoạt động, lịch sử chung, thông tin cá nhân và quyền xem phòng sau xóa; không tự quyết định vấn đề nghiệp vụ còn mở.
- [ ] Thực hiện xóa/ẩn danh theo quyết định đã chốt, kiểm thử cả tài khoản bị xóa và người còn lại.
- [ ] Tạo trang web để người dùng gửi yêu cầu xóa tài khoản bên ngoài ứng dụng.
- [ ] Soạn dự thảo Privacy Policy, điều khoản và bảng kiểm kê dữ liệu phục vụ Data Safety, bao gồm SDK bên thứ ba.

**Đầu ra:** luồng xóa có kiểm thử, trang yêu cầu xóa và bộ dự thảo chính sách khớp hành vi ứng dụng.

**Cần chủ dự án chốt:** danh tính đơn vị vận hành, email hỗ trợ, thời hạn lưu dữ liệu, cách xử lý nghĩa vụ đang tồn tại và nội dung pháp lý để công bố. Trợ lý không thay thế việc thẩm định pháp lý.

**Điều kiện hoàn thành:** yêu cầu xóa được xử lý thực tế; dữ liệu giữ lại và lý do giữ được giải thích rõ, không chỉ hiện thông báo đã nhận yêu cầu.

## Bước 6 — Chuẩn bị backend production và vận hành

- [ ] Kiểm tra môi trường production tách dữ liệu thử nghiệm, schema, migrations, RLS, secrets và cấu hình Auth/Storage/Functions liên quan.
- [ ] Chuẩn bị kế hoạch triển khai migration và khôi phục; kiểm thử trước trên môi trường phù hợp.
- [ ] Thiết lập theo dõi lỗi có lọc dữ liệu nhạy cảm, kiểm tra cảnh báo và đầu mối hỗ trợ.
- [ ] Xác minh backup; diễn tập khôi phục trên môi trường cô lập.
- [ ] Ghi tài liệu xử lý sự cố, quản lý khóa ký, quyền quản trị, hạn mức dịch vụ và chi phí dự kiến.

**Đầu ra:** cấu hình triển khai, checklist vận hành và bằng chứng phục hồi. Không ghi secrets vào tài liệu hoặc repository.

**Cần chủ dự án cung cấp khi thiếu:** quyền dịch vụ, lựa chọn gói trả phí/ngân sách và người nhận cảnh báo. Thay đổi cloud được thực hiện trong phạm vi quyền đã cấp; không reset dữ liệu thật.

**Điều kiện hoàn thành:** bản production dùng đúng backend và có phương án phát hiện, xử lý, phục hồi sự cố đã kiểm chứng.

## Bước 7 — Build và nghiệm thu AAB chính thức

- [ ] Rà soát profile production, package `com.loanappmobiles.loanapp`, versionCode, biến môi trường, cấu hình Google/Firebase và khóa ký.
- [ ] Đối chiếu yêu cầu Google Play tại thời điểm nộp về target API, kiến trúc và hỗ trợ trang nhớ 16 KB; kiểm tra artifact cuối.
- [ ] Build AAB, kiểm tra quyền Android, manifest, backend đích và thông tin nhạy cảm trong gói ứng dụng.
- [ ] Chạy unit tests, typecheck, kiểm thử SQL/auth liên quan và Playwright; kiểm tra native trên thiết bị phù hợp.
- [ ] Kiểm thử bản cài qua Play internal testing: đăng nhập, lời mời, giao dịch, push, cài mới và cập nhật giữ dữ liệu.

**Đầu ra:** AAB xác định được phiên bản/source/build, báo cáo kiểm thử và danh sách giới hạn còn lại.

**Điều kiện hoàn thành:** bản cài từ Play vượt các luồng bắt buộc; không dùng kết quả của APK staging để nghiệm thu AAB production.

## Bước 8 — Chuẩn bị hồ sơ và closed testing trên Google Play

- [ ] Soạn tên, mô tả ngắn/dài, ảnh chụp, icon/ảnh giới thiệu và thông tin hỗ trợ theo chức năng thực tế.
- [ ] Chuẩn bị Privacy Policy URL, URL yêu cầu xóa, Data Safety, phân loại nội dung, đối tượng người dùng, khai báo quảng cáo và Financial features declaration.
- [ ] Đối chiếu cách phân loại LOAN theo chức năng thực tế; không mặc định ứng dụng là dịch vụ cho vay hoặc không có tính năng tài chính chỉ dựa trên tên gọi.
- [ ] Chuẩn bị hướng dẫn và phương án truy cập để người duyệt kiểm tra đầy đủ ứng dụng.
- [ ] Lập kịch bản cho người thử, bảng nhận phản hồi và sửa lỗi phát sinh; lưu bằng chứng thử nghiệm.

**Đầu ra:** bộ nội dung sẵn để nhập Play Console và báo cáo closed testing.

**Chủ dự án thực hiện/cung cấp:** đăng ký, thanh toán, xác minh tài khoản Google Play; thông tin chủ thể phát hành; người thử thật và quyền truy cập Console nếu muốn trợ lý thao tác. Kiểm tra điều kiện closed testing áp dụng cho chính tài khoản đó.

**Điều kiện hoàn thành:** hồ sơ chính xác, reviewer truy cập được, hoàn tất điều kiện thử nghiệm và đủ cơ sở xin quyền production. Thời gian xét duyệt do Google quyết định.

## Bước 9 — Gửi xét duyệt và theo dõi phát hành

- [ ] Tổng hợp checklist phát hành: lỗi chặn, kết quả kiểm thử, cấu hình production, backup, privacy và hỗ trợ.
- [ ] Chuẩn bị release notes, kế hoạch phát hành phù hợp với tùy chọn Play Console và phương án xử lý khi có lỗi nghiêm trọng.
- [ ] Gửi xét duyệt/phát hành khi chủ dự án yêu cầu và có đủ quyền truy cập; theo dõi phản hồi Google, chuẩn bị sửa lỗi hoặc bổ sung hồ sơ.
- [ ] Sau phát hành, theo dõi crash/ANR, đăng nhập, lỗi giao dịch, thông báo và phản hồi người dùng; xác minh bản vá khi cần.

**Đầu ra:** bản phát hành được theo dõi và tài liệu bàn giao vận hành.

**Điều kiện hoàn thành:** Google chấp thuận, bản chính thức có thể cài và dùng đúng phạm vi, có người chịu trách nhiệm hỗ trợ. Không cam kết trước kết quả hoặc thời gian Google duyệt.

## Quy tắc thực hiện và cập nhật tiến độ

1. Làm bước 1 trước, sau đó ưu tiên bước 2–3. Có thể chuẩn bị nội dung cửa hàng và tài khoản dịch vụ trong khi hoàn thiện kỹ thuật.
2. Trước khi dùng API/thư viện mới hoặc thay đổi phụ thuộc phiên bản, tra Context7 hoặc tài liệu chính thức. Khi sửa giao diện, áp dụng skill thiết kế phù hợp và giữ kiến trúc hiện hữu.
3. Sau thay đổi quan trọng, kiểm thử luồng thực tế; chạy `npm test` và typecheck trước nghiệm thu cùng các kiểm thử chuyên biệt phù hợp. Không đánh dấu hoàn thành chỉ vì build thành công.
4. Mỗi bước ghi: việc đã làm, file/migration/build liên quan, cách kiểm thử, kết quả, giới hạn và phụ thuộc còn thiếu. Chỉ tích ô khi có bằng chứng.
5. Khi thiếu quyền hoặc quyết định nghiệp vụ, ghi chính xác phần bị phụ thuộc và tiếp tục các phần độc lập. Không yêu cầu người dùng cung cấp mật khẩu, OTP hoặc secret trong hội thoại.
6. Kế hoạch này chưa xác nhận cloud, thiết bị hoặc Play Console đã sẵn sàng; cần xác minh khi thực hiện. Không ước lượng ngày phát hành trước khi xong bước 1 và biết điều kiện tài khoản Play.

## Nguồn đối chiếu khi chuẩn bị hồ sơ

- [Tạo tài khoản Play Console](https://support.google.com/googleplay/android-developer/answer/6112435?hl=en)
- [Yêu cầu thử nghiệm với tài khoản cá nhân mới](https://support.google.com/googleplay/android-developer/answer/14151465?hl=en)
- [Target API](https://support.google.com/googleplay/android-developer/answer/11926878?hl=en)
- [Hỗ trợ trang nhớ 16 KB](https://developer.android.com/guide/practices/page-sizes)
- [Chuẩn bị ứng dụng để duyệt](https://support.google.com/googleplay/android-developer/answer/9859455?hl=en)
- [Yêu cầu xóa tài khoản](https://support.google.com/googleplay/android-developer/answer/13327111?hl=en)
- [Khai báo tính năng tài chính](https://support.google.com/googleplay/android-developer/answer/13849271?hl=en)
- [Chính sách dịch vụ tài chính](https://support.google.com/googleplay/android-developer/answer/9876821?hl=en)
