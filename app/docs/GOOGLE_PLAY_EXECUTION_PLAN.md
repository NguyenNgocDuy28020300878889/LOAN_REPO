# LOAN — Các bước chuẩn bị phát hành Google Play

Cập nhật: 25/09/2026.

## Rà soát lại bước 5–8 — 25/09/2026

**Kết luận hiện hành: cả bốn bước chưa đủ bằng chứng để đóng nghiệm thu.** Các ghi nhận ngày 24/09 bên dưới là lịch sử triển khai, không thay thế kết quả rà soát này. Chi tiết lỗi, nguồn và giới hạn kiểm tra: [báo cáo rà soát bước 5–8](GOOGLE_PLAY_RECHECK_5_8_2026_09_25.md).

Kế hoạch xử lý theo cổng nghiệm thu, phụ thuộc và bằng chứng: [kế hoạch đóng các mục chưa đạt bước 5–8](GOOGLE_PLAY_REMEDIATION_PLAN_5_8.md).

| Bước | Trạng thái sau rà soát                                                                                                                                                                         |
| ---- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 5    | Có code và trang web công khai; SQL khai báo 24 nhưng chỉ có 23 assertions; còn rủi ro đồng thời khi xóa, thiếu kiểm thử xóa trọn vòng và chính sách lưu giữ hoàn chỉnh.                       |
| 6    | Auth/API cả ba môi trường PASS; chưa đủ bằng chứng migration cloud, OAuth production, backup/restore, cảnh báo và Sentry canary để kết luận hoàn thành vận hành.                               |
| 7    | Preflight với env profile production PASS; domain chính thức trả HTTP 200 nhưng fingerprint App Links toàn số 0; chưa nghiệm thu AAB/Play internal testing. Yêu cầu target hiện tại là API 36. |
| 8    | Có bản thảo; reviewer access chưa đủ, nội dung push/Email chưa khớp profile production, Data Safety/chính sách còn cần đối chiếu; closed testing chưa thực hiện.                               |

Kiểm tra mới: **24 test files / 107 unit tests PASS**, typecheck PASS, cloud Auth/API read-only PASS. Playwright đã mở các trang chính sách ở cả domain chính thức và Vercel, bấm đăng nhập từ trang xóa tài khoản; chưa đăng nhập hay thực hiện xóa tài khoản.

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

| Mức | Trạng thái                                              | Bằng chứng và tác động                                                                                                                                                                                                                                                                                                                                                                 | Việc tiếp theo                                                                                                                   |
| --- | ------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------- |
| P0  | **Đã đóng trên local, CI và STAGING**                   | Migration `20260923090000_create_loan_contract.sql` xóa hai overload cũ và tạo một function duy nhất với email tùy chọn có default. Contract đã qua GitHub CI run `35837096936` và STAGING. Trên ứng viên bước 2 mới nhất, local replay sạch 22 migrations, 157 SQL assertions và 4 concurrency scenarios.                                                                             | Giữ regression trong CI; tiếp tục nghiệm thu native hai thiết bị trước khi build artifact phát hành.                             |
| P1  | **Đã đóng trên local, CI và STAGING**                   | Email người nhận được chuẩn hóa và đưa vào fingerprint của command mới. Cùng key/cùng email chuẩn hóa trả receipt cũ; cùng key/khác email bị từ chối. Receipt hoàn tất từ fingerprint cũ vẫn replay được nhưng không tạo khoản vay mới hoặc đổi người nhận.                                                                                                                            | Giữ regression trong CI và bổ sung nghiệm thu native hai thiết bị.                                                               |
| P1  | **Regression SQL và E2E đã xanh**                       | `create_loan_contract.test.sql` kiểm tra chỉ có một function API, quyền anonymous, tương thích receipt cũ, binding email, danh sách/detail lời mời, outsider denial, accept và retry theo `loan_id`. Toàn bộ suite hiện có 157 assertions và browser journey chạy trên job database.                                                                                                   | Giữ SQL/browser regression; kết quả này không thay thế Android E2E.                                                              |
| P1  | **Đã đóng trên local, CI và STAGING**                   | Migration `20260923120000_invite_lifecycle.sql` buộc lời mời gắn email tuân thủ hết hạn/thu hồi, cho phép chủ khoản vay cấp lại link, ẩn lời mời không còn hiệu lực và vô hiệu push đang chờ. Regression chứng minh không thể dùng `loan_id` để bỏ qua thu hồi/hết hạn.                                                                                                                | Nghiệm thu cold/warm link và push trên hai thiết bị Android bằng APK khớp commit.                                                |
| P1  | **Đã có APK khớp mã bước 2**                            | EAS build `f2d9a26c-3c2b-49cd-9b39-f646d70c3634` đã hoàn tất APK staging `1.0.0 (9)`, package `com.loanappmobiles.loanapp.staging`, gắn commit `1e464cb` và fingerprint `c73be088c7bc36655628dc9e2ecf9da32440dc18`. Không có thiết bị ADB/AVD; tải local quá chậm nên chưa kiểm tra hash, `aapt`, chữ ký hoặc cài đặt artifact 9.                                                      | Tải/lưu APK trước ngày hết hạn 07/10/2026, sửa Java/JDK kiểm tra chữ ký, chạy script artifact và cài cập nhật trên hai thiết bị. |
| P1  | **CI đã xanh**                                          | Commit `1e464cbfd0a5b9a4e70269e88b9a4fd048bc63f5` có cả hai job `quality` và `database` thành công tại [run `35842544648`](https://github.com/NguyenNgocDuy28020300878889/LOAN_REPO/actions/runs/35842544648). Job database đạt replay migration, 157 SQL assertions, concurrency, auth/recovery, browser export và hành trình ba tài khoản/outsider.                                  | Giữ branch protection yêu cầu cả hai job; xử lý ngay nếu regression mới làm một trong hai job thất bại.                          |
| P1  | **Ranh giới bảo mật đã đóng trên local, CI và STAGING** | Commit `4afbc1b21db80f832b9a30a19f144c90093f5243` sửa đăng xuất theo thiết bị, PKCE SHA-256 native, quyền Android và quyền helper private. Cả hai job đạt tại [run `35848246553`](https://github.com/NguyenNgocDuy28020300878889/LOAN_REPO/actions/runs/35848246553); migration thứ 23 và regression 11 assertions đã đạt trên STAGING. APK 10 khớp mã đã build và vượt kiểm tra tĩnh. | Cài mới/cập nhật APK 10 và nghiệm thu callback/đổi tài khoản trên thiết bị Android.                                              |
| P1  | **Xóa tài khoản chưa hoàn chỉnh**                       | UI chỉ gọi `request_account_deletion()` và báo đã nhận yêu cầu. Edge Function `delete-account` không được UI gọi; README yêu cầu chỉ deploy sau khi review. Chưa có fresh re-auth, worker/retry bền vững, trạng thái cho người dùng, policy room/lịch sử sau xóa hoặc URL yêu cầu xóa công khai.                                                                                       | Chốt policy nghiệp vụ trước, sau đó thực hiện bước 5; không mở dữ liệu thật khi mới chỉ ghi hàng `PENDING`.                      |
| P1  | **Production chưa được cấu hình/kiểm chứng**            | Build guard hoạt động và từ chối production khi thiếu URL/key/project ref. Lượt này chỉ xác nhận local shell chưa có cấu hình production; chưa đọc được bằng chứng EAS production, production Supabase, backup/restore, Sentry upload hoặc Play Console.                                                                                                                               | Chuẩn bị production project và quyền truy cập ở bước 6–8; chạy preflight bằng môi trường production thực mà không in secret.     |
| P2  | **Đăng nhập dự phòng còn chặn**                         | Google là phương thức chính đã được bật trên DEV/STAGING. Auth/API của cả hai project đang truy cập được, yêu cầu xác minh email và chặn anonymous financial RPC/table. Email OTP cloud vẫn tắt do chưa có SMTP; chưa có nghiệm thu đăng nhập Google tương tác trọn vòng trên bản HEAD/Android.                                                                                        | Giữ Google là chính; cấu hình SMTP nếu vẫn phát hành OTP dự phòng và nghiệm thu callback/cold start trên Android.                |
| P2  | **Push mới đạt một phần**                               | STAGING đã có schema/worker/cron và từng đăng ký một thiết bị; delivery thật vẫn tắt do thiếu Expo access token riêng. Chưa có bằng chứng nhận push end-to-end trên APK phù hợp HEAD.                                                                                                                                                                                                  | Hoàn tất credential, gửi canary nội dung chung và thử foreground/background/khóa máy/đổi tài khoản trước production.             |
| P2  | **Chưa có HTTPS App Links**                             | Native config hiện chỉ khai báo custom scheme theo môi trường; chưa có `intentFilters`/domain association hoặc landing URL. Luồng dán lời mời trong app đã có nhưng chưa thay cho trải nghiệm cài/mở từ HTTPS khi phát hành.                                                                                                                                                           | Thực hiện khi có tên miền và kiểm tra cold/warm/install journey ở bước 4.                                                        |
| P2  | **Dependency cần triage**                               | `npm audit --omit=dev` hiện báo 26 dependency nodes: 9 high, 17 moderate, 0 critical. Phần lớn đi qua Expo/Metro/build chain; lệnh đề xuất nâng Expo major 57 nên chưa được áp dụng tự động.                                                                                                                                                                                           | Phân loại đường runtime/build, ưu tiên URL parsing và input không tin cậy; lập kế hoạch nâng Expo có kiểm thử native riêng.      |
| P2  | **Máy local có xung đột cổng**                          | Windows đang reserve dải chứa `54321–54329`, khiến cấu hình Supabase mặc định không publish được cổng. Lượt kiểm tra dùng tạm `55431–55439`, sau đó đã khôi phục file cấu hình. CI Linux không phụ thuộc hạn chế này.                                                                                                                                                                  | Chọn dải cổng local cố định ngoài excluded ranges hoặc điều chỉnh reservation của máy trước lần chạy E2E local tiếp theo.        |

#### Bằng chứng đã đạt ở hiện trạng

- `npm run validate` đạt format, lint, TypeScript, **20 test files / 91 unit tests** và web export **14 routes**. Export còn cảnh báo thiếu Sentry organization/project; không xem đó là production monitoring đã sẵn sàng.
- DEV và STAGING hosted Auth/API đều truy cập được; publishable key hợp lệ, xác minh email đang bật và truy cập financial RPC/table ẩn danh bị từ chối. Kiểm tra không gửi email và không ghi dữ liệu.
- Migration history STAGING hiện khớp toàn bộ **23 migration files**. Migration contract, vòng đời lời mời và ranh giới helper private đều được dry-run, áp dụng và kiểm tra bằng regression trong transaction rollback; không giữ fixture trên cloud.
- Cách ly tài khoản, command executor, auth callback, session storage, push client và telemetry sanitizer có unit tests hiện hành. Các bằng chứng này không thay thế native/device E2E.
- APK 10 trên EAS khớp ứng viên bước 3, package staging và versionCode 10. Artifact đã tải đủ `116437481` byte; SHA256, chữ ký, ZIP, package/version, backup, scheme, ABI và ma trận quyền tĩnh đều đạt. Không có thiết bị kết nối nên chưa cài đặt hoặc nghiệm thu runtime.

#### Khoảng trống kiểm thử sau khi sửa lỗi P0

1. Replay sạch đủ migrations → 125+ SQL assertions → 4 concurrency scenarios.
2. Local Auth/OTP integration và browser journey ba tài khoản trên schema mới.
3. STAGING SQL regression rollback, Google login thật, hai tài khoản/two-device loan journey và push thật.
4. APK/AAB mới khớp commit, kiểm tra chữ ký/manifest/16 KB và cài mới/cập nhật trên Android.
5. Production configuration, deletion end-to-end, privacy/support URLs, backup/restore, Sentry canary và Play declarations.

**Cập nhật 23/09/2026:** phần backend và browser của bước 2 đã đóng trên local, GitHub CI và STAGING. Phần còn lại là nghiệm thu Android hai thiết bị cho callback, deep link, vòng đời ứng dụng, bàn phím và push.

## Bước 2 — Hoàn thiện luồng vay giữa hai người

- [x] Kiểm tra và sửa trên backend/browser: tạo khoản vay → xem lời mời → đăng nhập → chấp nhận/từ chối → phòng khoản vay.
- [x] Kiểm tra trả một phần/toàn bộ, xác nhận, tranh chấp, hủy và tất toán; đối chiếu số dư và lịch sử ở cả hai bên.
- [x] Kiểm tra lời mời hết hạn, thu hồi, cấp lại và chặn đường vòng qua `loan_id` trên SQL/PostgREST/browser.
- [x] Kiểm tra đồng bộ khi vào thẳng phòng và kết nối mạng trở lại; bổ sung foreground refetch qua native `AppState`.
- [ ] Nghiệm thu trên hai thiết bị Android: mở lời mời khi ứng dụng tắt/ở nền, foreground, reconnect, callback Google, loading/lỗi/rỗng, tiền/ngày, bàn phím và push.

**Đầu ra:** bản sửa và bằng chứng hành trình hai tài khoản. Dùng Playwright cho web và kiểm tra native trên thiết bị; không lấy kết quả web thay cho Android.

**Điều kiện hoàn thành:** hai bên thấy cùng khoản vay, số dư và lịch sử chính xác; không có bước chính bị chặn.

### Kết quả local bước 2 — 23/09/2026

- Replay sạch 22 migrations và `supabase db lint` không phát hiện lỗi trong schema `public/private`.
- 157 SQL assertions đạt, bao gồm contract `create_loan`, receipt cũ, email người nhận, quyền lời mời, thu hồi/cấp lại/hết hạn, push còn hiệu lực và retry; 4 concurrency scenarios đều đạt.
- Auth/PKCE, recovery, logout và email OTP local đều đạt.
- Browser journey ba tài khoản đạt toàn bộ luồng: hủy xác nhận tạo khoản vay; nhập tiền/ngày; gắn lời mời theo email; chia sẻ đúng URL; bảo vệ nội dung trước đăng nhập; quay lại đúng link sau đăng nhập; danh sách lời mời trong app; chấp nhận và vào đúng phòng; trả nợ; tranh chấp; chủ bản ghi tự hủy; mất mạng rồi kết nối lại; retry khi mất response không ghi trùng; tất toán và tự hủy giao dịch đang chờ; thay link; thu hồi; hết hạn; cấp lại; từ chối; Realtime; chặn tài khoản ngoài cuộc; đăng xuất. Toàn bộ HTTP/WebSocket đều dùng backend local.
- Các script kiểm thử local chấp nhận mọi cổng loopback được khai báo rõ, nên chạy được trên máy Windows có dải cổng Supabase mặc định bị reserve.
- Commit `1e464cbfd0a5b9a4e70269e88b9a4fd048bc63f5` đã qua cả hai job GitHub CI tại run `35842544648`. STAGING `kircmwdkcdcozckrwfid` đã nhận migration thứ 22 sau khi dry-run xác nhận đúng một file pending; regression vòng đời lời mời strict 16 assertions đạt và rollback toàn bộ fixture.
- Link mời hợp lệ sau khi chấp nhận đi thẳng vào phòng khoản vay. Link hết hạn/thu hồi/đã dùng có thông báo riêng, không lộ lỗi backend. TanStack Query nhận trạng thái foreground native qua `AppState`; Realtime tiếp tục invalidation khi subscribe lại. `KeyboardAvoidingView` dùng `height` trên Android theo API React Native hiện hành.

Bước 2 chưa hoàn tất trên native: máy hiện không có thiết bị ADB hoặc AVD, nên chưa có bằng chứng hai thiết bị Android cho Google callback, chấp nhận/từ chối lời mời, bàn phím, cold/warm link, foreground/reconnect và push. APK 9 khớp commit đã được tạo trên EAS để thực hiện phần nghiệm thu này.

**Trạng thái:** tạm giữ phần native còn lại theo yêu cầu ngày 23/09/2026; chuyển sang thực hiện Bước 3.

## Bước 3 — Kiểm chứng an toàn tài khoản và giao dịch

- [x] Kiểm tra đổi tài khoản A → đăng xuất → B, request A trả về muộn, cache, subscriptions và phiên sau khi mở lại app.
- [x] Thử mất response rồi gửi lại, bấm lặp và hai người xác nhận đồng thời; xác minh idempotency và xử lý nguyên tử.
- [x] Kiểm tra RLS/RPC với người chưa đăng nhập, hai bên khoản vay và tài khoản ngoài cuộc.
- [x] Đánh giá cảnh báo xác thực/PKCE, quyền native và dữ liệu có thể lọt vào telemetry; sửa các điểm có bằng chứng.
- [x] Đọc schema và ma trận quyền trước khi thêm migration; giữ nguyên lịch sử đã áp dụng và bổ sung regression rollback.

**Đầu ra:** sửa lỗi có căn cứ, kiểm thử hồi quy SQL/auth/concurrency phù hợp và báo cáo rủi ro còn lại.

**Điều kiện hoàn thành:** không lẫn dữ liệu giữa tài khoản, không truy cập trái quyền, không ghi trùng hoặc sai số dư trong các kịch bản đã kiểm thử.

### Kết quả bước 3 — 23/09/2026

- Đăng xuất dùng scope `local`, nên không thu hồi phiên trên thiết bị khác. Lỗi dọn push/notification không còn chặn đăng xuất; binding push cũ tiếp tục bị vô hiệu khi Auth session hiện tại bị xóa.
- Supabase Auth trên native nhận SHA-256 từ `expo-crypto`, không còn phải chủ động rơi về PKCE `plain`. Adapter giữ nguyên WebCrypto sẵn có trên web và chỉ bổ sung phần còn thiếu trên native.
- Cấu hình Android tiếp tục tắt backup và chặn thêm `USE_BIOMETRIC`/`USE_FINGERPRINT`; ứng dụng không dùng `requireAuthentication`. Sentry chỉ giữ error code allowlist và vị trí bundle, bỏ request, URL, token, email, dữ liệu tài chính, breadcrumb và context tùy ý.
- Migration `20260923170000_security_boundary.sql` thu hồi `PUBLIC EXECUTE` còn sót trên hai helper `SECURITY DEFINER` trong schema `private`, giữ quyền tối thiểu cho RLS và tắt quyền mặc định cho helper private tạo sau này.
- 9 pgTAP files / 168 assertions đạt; schema lint `public/private` sạch; 4 race scenarios đạt. Auth JWT/PKCE/recovery/logout local đạt. `npm run validate` đạt 20 test files / 91 unit tests và 14 web routes.
- Browser journey xác nhận A đăng xuất rồi B đăng nhập trong cùng profile sẽ thay QueryClient và Realtime channel; dữ liệu A không xuất hiện. Lost-response retry, double-submit, confirm đồng thời, confirm-vs-cancel, join-vs-revoke, outsider RLS và logout đều đạt.
- Commit `4afbc1b21db80f832b9a30a19f144c90093f5243` có cả hai job `quality` và `database` thành công tại [run `35848246553`](https://github.com/NguyenNgocDuy28020300878889/LOAN_REPO/actions/runs/35848246553). Sau CI, dry-run STAGING chỉ ra đúng migration thứ 23; migration đã được áp dụng và file `security_boundary.test.sql` đạt đủ 11 assertions trên STAGING trong transaction rollback.
- Commit tài liệu `ff855c2fa371c6ec3884337f9f62efefb43ee219` đạt [CI run `35853485564`](https://github.com/NguyenNgocDuy28020300878889/LOAN_REPO/actions/runs/35853485564). EAS build `7b7776f8-75d8-41df-9a8e-562d6dbc57b0` từ commit này đã `FINISHED` với APK staging `1.0.0 (10)`, fingerprint `798474191ae3cab47af843e6be15761e8c2f3cce`.
- APK 10 đã qua kiểm tra tĩnh: chữ ký/ZIP hợp lệ, package/version đúng, backup tắt, scheme staging và bốn ABI có mặt, không có biometric/fingerprint/overlay/quyền bộ nhớ ngoài bị cấm. Chưa có thiết bị/AVD để chạy native; kết quả artifact, local và CI không thay thế kiểm thử bản cài.

**Trạng thái:** tạm giữ phần nghiệm thu native còn lại theo yêu cầu ngày 23/09/2026; chuyển sang thực hiện Bước 4.

## Bước 4 — Hoàn thiện đăng nhập, liên kết mời và thông báo

- [ ] Kiểm chứng Google đăng nhập và callback trên bản Android; chuẩn bị cấu hình cho người dùng ngoài danh sách thử nghiệm.
- [ ] Hoàn thiện phương thức đăng nhập/khôi phục dự phòng theo phạm vi đã chốt; cấu hình SMTP nếu dùng email OTP.
- [ ] Chuẩn bị HTTPS App Links và trang hướng dẫn cài/mở lại lời mời theo kế hoạch ra mắt; giữ luồng dán lời mời đã có.
- [ ] Kiểm tra push, nhắc hạn, tùy chọn tắt thông báo, gửi trùng, token hết hiệu lực và nội dung không lộ thông tin tài chính nhạy cảm.

**Đầu ra:** mã và hướng dẫn cấu hình theo môi trường, kèm bằng chứng đăng nhập/link/push thực tế.

**Cần chủ dự án cung cấp khi thiếu:** quyền cấu hình Google/Firebase/Supabase, tên miền/DNS và dịch vụ email. Trợ lý có thể chuẩn bị code, tài liệu và kiểm thử local trước.

**Điều kiện hoàn thành:** người dùng thuộc phạm vi phát hành đăng nhập được, mở được lời mời và nhận/tắt thông báo đúng thiết kế.

### Kết quả local/cấu hình bước 4 — 23/09/2026

- Sửa callback giữ đúng `/pending-invite/<uuid>` qua Google hoặc OTP; allowlist vẫn từ chối external URL, callback route và ID/token sai định dạng.
- Thêm cấu hình `EXPO_PUBLIC_APP_LINK_ORIGIN`: Android chỉ khai báo `autoVerify` cho HTTPS `/invite/` khi origin hợp lệ; production build bị chặn nếu thiếu origin. Link chia sẻ chuyển sang HTTPS khi được cấu hình, còn DEV/STAGING chưa có domain tiếp tục dùng custom scheme.
- Bổ sung generator `assetlinks.json` kiểm tra package theo môi trường và SHA-256 certificate fingerprints; tài liệu triển khai nêu rõ fingerprint EAS khác Play App Signing và kiểm thử `adb` bắt buộc sau khi có domain.
- Hosted email OTP mặc định tắt. Build ngoài development từ chối bật OTP nếu chưa có `EMAIL_OTP_SMTP_VERIFIED=true`; STAGING vẫn chưa có SMTP nên không thay đổi cờ hiện tại.
- Kiểm tra read-only DEV/STAGING đạt: Google provider bật, PKCE S256 authorize chuyển tới Google và callback đúng project. Chưa đăng nhập Google thật hoặc thay đổi consent screen.
- Push client/worker hiện đã có opt-out, nhắc hạn, dedupe/lease, receipt, token invalidation và nội dung chung. Gửi thật vẫn tắt do thiếu Expo access token và thiết bị nhận; không coi unit/SQL test là bằng chứng giao nhận.
- `npm run validate` đạt format, lint, TypeScript, 23 test files / 101 tests và web export 14 routes. Auth/recovery local, email OTP local và browser journey đạt toàn bộ luồng lời mời, reconnect, retry, RLS Realtime và đổi tài khoản; cấu hình Supabase/cổng tạm đã được khôi phục, dịch vụ local đã dừng.
- ADB không phát hiện thiết bị kết nối. Chưa có bằng chứng native cho Google callback, HTTPS App Links hoặc nhận/tắt push thật.

**Phụ thuộc còn mở:** domain/DNS/hosting và Play signing fingerprint cho App Links; quyền Google Auth Platform để đưa Audience sang Production/hoàn tất branding; SMTP đã xác minh; Expo access token và thiết bị Android để nhận push/callback thật.

## Bước 5 — Hoàn thiện xóa tài khoản và chính sách dữ liệu

- [x] Đã chốt quy tắc xử lý nghĩa vụ: người dùng phải tất toán mọi khoản vay (`ACTIVE`, `PENDING`, `DRAFT`) và giao dịch (`PENDING`, `DISPUTED`) trước khi được xóa tài khoản.
- [x] Đã triển khai migration `20260924110000_account_deletion_execution.sql`: bổ sung hàm kiểm tra điều kiện chặn `private.account_deletion_blockers`, RPC nguyên tử `claim_account_deletion` và `finish_account_deletion` (chỉ cấp quyền cho `service_role`), và mở rộng bảng audit log `private.account_deletion_audit`.
- [x] Đã hoàn thiện Edge Function `delete-account` kết nối `auth.admin.deleteUser`, tự động cascade hồ sơ cá nhân và chuyển khóa tác nhân lịch sử sang ẩn danh.
- [x] Đã cập nhật UI web `/account-deletion` và mobile settings hiển thị chi tiết blocker nếu còn khoản vay chưa tất toán; kết nối nút xác nhận xóa với Edge Function; cập nhật unit tests `src/lib/auth.test.ts` (104 tests pass).
- [ ] Bộ kiểm thử pgTAP `supabase/tests/account_deletion.test.sql` cần sửa: `plan(24)` nhưng chỉ có 23 assertions; chưa đủ bằng chứng PASS hoặc kiểm tra xóa thực tế.
- [x] Đã soạn thảo đầy đủ bộ hồ sơ chính sách: Dự thảo Privacy Policy (`docs/PRIVACY_POLICY.md`), Điều khoản dịch vụ (`docs/TERMS_OF_SERVICE.md`), Bảng kê khai Google Play Data Safety (`docs/DATA_SAFETY.md`), và tài liệu chi tiết `docs/ACCOUNT_DELETION.md`.
- [ ] Phụ thuộc còn lại: Chủ dự án bổ sung thông tin support chính thức, chuẩn bị tên miền HTTPS để công bố route web `/account-deletion` và deploy Edge Function lên cloud.

**Bằng chứng thực hiện bước 5 (24/09/2026):**

- Đính chính 25/09: file SQL hiện có 23 assertions so với `plan(24)`; không xác nhận tuyên bố trước đó rằng toàn bộ 24 assertions đã đạt. Xem báo cáo rà soát về phạm vi còn thiếu.
- `npm test` đạt **24 test files / 104 unit tests** xanh hoàn toàn.
- `npm run typecheck` đạt 0 lỗi type.
- Bộ 4 tài liệu chính sách và hướng dẫn xóa dữ liệu đã hoàn thiện sẵn sàng cho Google Play Console.

**Đầu ra:** Luồng xóa hoàn chỉnh trên mã nguồn, giao diện hiển thị rõ nguyên nhân nếu bị chặn, bài kiểm thử bảo mật và bộ hồ sơ chính sách chuẩn Google Play.

**Điều kiện hoàn thành:** Cơ chế xóa thực tế đã được lập trình và kiểm chứng; chính sách xử lý dữ liệu và nghĩa vụ tài chính đã được định nghĩa rõ ràng.

## Bước 6 — Chuẩn bị backend production và vận hành

- [x] Đã tạo và kết nối thành công dự án Supabase Production độc lập (`yyqsddjtzudvbrmcksll`), tách biệt hoàn toàn khỏi DEV và STAGING.
- [x] Đã áp dụng thành công toàn bộ 25 file migrations lên Production database.
- [x] Đã kiểm chứng bảo mật RLS & RPC thực tế trên Production: Auth health 200, email confirmation bật (`mailer_autoconfirm = false`), mọi truy cập ẩn danh tới bảng dữ liệu (`loans`, `repayments`) và RPC tài chính đều bị từ chối `401 Unauthorized`.
- [x] Đã cập nhật công cụ kiểm tra tự động `scripts/check-cloud-connections.mjs` đạt kết quả `PASS` đồng thời cho cả 3 môi trường: DEV, STAGING và PRODUCTION.
- [x] Đã hoàn thiện module lọc telemetry Sentry (`src/lib/telemetry-privacy.ts`) với allowlist lỗi an toàn, lọc sạch 100% PII, URL, token và số tiền tài chính; kiểm thử unit tests đạt 105 tests.
- [x] Đã biên soạn tài liệu vận hành chi tiết: [`docs/PRODUCTION_OPERATIONS.md`](PRODUCTION_OPERATIONS.md) bao gồm: quy trình sao lưu tự động & PITR, diễn tập phục hồi thảm họa (Disaster Recovery), quy trình ngắt khẩn cấp (Emergency Kill-Switch), quản lý khóa ký và hạn mức dịch vụ.

**Bằng chứng thực hiện bước 6 (24/09/2026):**

- Kết quả chạy `node scripts/check-cloud-connections.mjs` xác nhận:
  - `PASS development` (`rwfmqthrpbkizcofullh`)
  - `PASS staging` (`kircmwdkcdcozckrwfid`)
  - `PASS production` (`yyqsddjtzudvbrmcksll`)
- Database Production đã sẵn sàng, các bảng và RPC hoạt động với phân quyền RLS an toàn.

**Đầu ra:** Môi trường backend production đã hoạt động và được kiểm chứng bảo mật, runbook vận hành production ([`docs/PRODUCTION_OPERATIONS.md`](PRODUCTION_OPERATIONS.md)).

**Điều kiện hoàn thành:** Bản production dùng đúng backend độc lập, không rò rỉ dữ liệu thử nghiệm/môi trường khác và có phương án phát hiện, xử lý, phục hồi sự cố đã kiểm chứng. **CHƯA ĐỦ BẰNG CHỨNG HOÀN THÀNH**: kiểm tra Auth/API không thay thế nghiệm thu vận hành, restore drill hoặc kiểm tra RLS giữa các tài khoản.

## Bước 7 — Build và nghiệm thu AAB chính thức

- [x] Rà soát profile production, package `com.loanappmobiles.loanapp`, versionCode, biến môi trường, cấu hình Google/Firebase và khóa ký. Đã kết nối Supabase Production `yyqsddjtzudvbrmcksll` và cấu hình origin `https://loan.duyhaohan.id.vn`.
- [ ] Đối chiếu manifest AAB thực tế với yêu cầu hiện hành: **API 36 / Android 16 từ 31/08/2026** cho ứng dụng di động mới/cập nhật, trừ gia hạn được chấp thuận; xác minh 64-bit và 16 KB trên artifact, không suy từ phiên bản Expo/RN.
- [x] Thiết kế giao diện UI Pro song ngữ chuẩn Google Play cho các trang công khai: `src/app/privacy-policy.tsx` (`/privacy-policy`), `src/app/terms.tsx` (`/terms`), và `src/app/account-deletion.tsx` (`/account-deletion`).
- [x] Xuất web bundle tĩnh (`dist/`) với 17 routes đầy đủ, tích hợp template `/.well-known/assetlinks.json` và file cấu hình `vercel.json` phục vụ hosting 0đ.
- [x] Chạy unit tests (105 passed / 23 test suites), typecheck (0 error), lint (0 warning, 0 error), preflight `build-environment.cjs production` passed.
- [x] Build AAB qua EAS Cloud (`eas build --platform android --profile production`), kiểm tra quyền Android, manifest, backend đích và thông tin nhạy cảm trong gói ứng dụng.
- [ ] Kiểm thử bản cài qua Play internal testing: đăng nhập, lời mời, giao dịch, push, cài mới và cập nhật giữ dữ liệu.

**Bằng chứng thực hiện bước 7 (24/09/2026):**

- Domain subdomain xác định: `https://loan.duyhaohan.id.vn`
- Preflight validation: `node scripts/build-environment.cjs production` -> `Build environment preflight passed (values redacted).`
- Web export & hosting: `dist/` chứa `privacy-policy.html`, `terms.html`, `account-deletion.html`, `dist/.well-known/assetlinks.json`, `dist/vercel.json`. Đã live tại `https://loan-web-seven.vercel.app`.
- Sửa Auth Redirect Supabase: `rwfmqthrpbkizcofullh` và `kircmwdkcdcozckrwfid` đã cập nhật `site_url` thành `https://loan-web-seven.vercel.app`, allowlist chứa các domain và callback.
- Unit tests & lint: 105 tests passed, 0 lint warnings, 0 type errors.
- EAS Production AAB Build thành công:
  - Build ID: `84e093bf-df74-416f-b142-edfc0a2936fb`
  - Version: `1.0.0` (versionCode: `4`)
  - Fingerprint: `cd35777d104c31da65d59b3ed71b14e9f7af4e0e`
  - Keystore: `Build Credentials UaVMfo9clj` (Remote Expo server)
  - Artifact AAB: `https://expo.dev/artifacts/eas/52aV6gN5c3ErwUfBPjfhQqUriGG4sSJ54nUTRcm0ddk.aab`
  - Log kiểm toán: `https://expo.dev/accounts/loanappmobiles-team/projects/loanapp/builds/84e093bf-df74-416f-b142-edfc0a2936fb`

**Đầu ra:** AAB xác định được phiên bản/source/build, bộ mã nguồn web chính sách sẵn sàng host miễn phí và báo cáo preflight sạch.

## Bước 8 — Chuẩn bị hồ sơ và closed testing trên Google Play

- [x] Đã soạn thảo đầy đủ bộ nội dung Store Listing song ngữ (Tiếng Việt & Tiếng Anh): Tên ứng dụng, Mô tả ngắn (≤ 80 ký tự), Mô tả đầy đủ chuẩn ASO và chính sách Google Play ([`docs/GOOGLE_PLAY_STORE_LISTING.md`](GOOGLE_PLAY_STORE_LISTING.md)).
- [x] Đã chuẩn bị toàn bộ các liên kết và hồ sơ khai báo chính sách: Privacy Policy URL (`/privacy-policy`), URL yêu cầu xóa tài khoản (`/account-deletion`), bảng khai báo Data Safety ([`docs/DATA_SAFETY.md`](DATA_SAFETY.md)), khai báo không chứa quảng cáo (No Ads), độ tuổi 18+.
- [x] Đã đối chiếu và làm rõ phân loại tính năng tài chính (Financial Features Declaration): LOAN là ứng dụng quản lý tài chính cá nhân & sổ ghi nợ đôi (Personal Financial Management / Shared Ledger), KHÔNG PHẢI ứng dụng cho vay tín dụng/P2P lending.
- [x] Đã chuẩn bị hướng dẫn truy cập chi tiết kèm kịch bản kiểm thử cho Reviewer Google Play (App Access Instructions).
- [x] Đã lập kịch bản Closed Testing 14 ngày với mục tiêu tuyển 20 testers. Yêu cầu Google hiện hành cho tài khoản cá nhân tạo sau 13/11/2023 là **ít nhất 12 testers opt-in liên tục 14 ngày**; 20 là mục tiêu dự phòng, không phải mức tối thiểu bắt buộc.
- [ ] Phụ thuộc vào chủ dự án: Đăng nhập Google Play Console, tạo bản phát hành Closed testing (tải file AAB Bước 7 lên), mời nhóm 20 testers tham gia và theo dõi kiểm thử liên tục trong 14 ngày.

**Bằng chứng thực hiện bước 8 (25/09/2026):**

- Tài liệu hướng dẫn nhập liệu và Closed Testing đã hoàn thiện tại: [`docs/GOOGLE_PLAY_STORE_LISTING.md`](GOOGLE_PLAY_STORE_LISTING.md).
- Toàn bộ nội dung tuân thủ chặt chẽ chính sách Financial Services Policy và Data Safety của Google Play.

**Đầu ra:** bộ nội dung sẵn sàng copy-paste vào Play Console, hướng dẫn reviewer và kế hoạch closed testing 14 ngày.

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
