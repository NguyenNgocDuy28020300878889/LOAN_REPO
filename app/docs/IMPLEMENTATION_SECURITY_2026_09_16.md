# LOAN — Kết quả sửa lỗi và kiểm chứng 16/09/2026

Phạm vi: Android trước, một người vận hành. Đây là bằng chứng triển khai trong working tree và môi trường kiểm thử; **chưa nghiệm thu dùng dữ liệu thật**. Cloud DEV/STAGING vẫn `INACTIVE` khi đọc lại bằng Supabase CLI. Chưa deploy database/Edge Function/production, chưa commit/push và chưa có kết quả CI GitHub cho bộ thay đổi này.

## Quyết định đã áp dụng

- Ai có link hợp lệ đều có thể đăng nhập để xem chi tiết/tham gia; không ràng buộc email người nhận.
- Người chưa đăng nhập chỉ thấy trang mời chung. RPC preview cũng từ chối anonymous, không chỉ ẩn ở giao diện.
- Xác nhận trả đủ tự hủy các đề xuất còn PENDING trong cùng giao dịch; mỗi đề xuất có sự kiện hủy với `reason=LOAN_REPAID` và liên kết lần xác nhận.
- Chính sách lịch sử/room khi xóa tài khoản vẫn chờ chủ dự án bàn thêm. Không bổ sung worker hoặc triển khai chính sách đó trong đợt này.

## Tiếp tục tự động hóa — hành trình thực tế trên backend local

- Thay nhiều kênh theo từng khoản vay/màn hình bằng **một kênh cho mỗi phiên ứng dụng**, bắt đầu ngay cả khi danh sách rỗng; gom các sự kiện cùng đợt trước khi refetch, dọn kênh khi đổi tài khoản. Chỉ đăng ký INSERT/UPDATE, dựa trên RLS để lọc hàng được phép đọc. Không đăng ký DELETE vì Postgres Changes không áp dụng RLS cho sự kiện đó ([tài liệu Supabase](https://supabase.com/docs/guides/realtime/postgres-changes)). Vẫn cần đo tải/quota trước mở rộng.
- Sửa `Alert` trên web vốn không thực hiện xác nhận; native tiếp tục dùng hộp thoại React Native. Thêm đường lấy link thủ công khi Web Share không có hoặc bị từ chối. Tạo khoản vay đã thành công không bị báo nhầm thất bại khi chia sẻ không mở được.
- Sửa quay về phòng khoản vay sau khi gửi trả nợ, kể cả mở form từ link trực tiếp. Xóa form và receipt trong bộ nhớ sau khi người dùng xác nhận thành công để lần nhập tiếp theo là một thao tác mới; giữ journal cho trường hợp mất phản hồi.
- `scripts/test-browser-journey.mjs` đã PASS bằng Chrome 412×915 với HTTP và WebSocket thật local: tạo khoản vay từ UI; hủy xác nhận không tạo dữ liệu; phiên khác đang ở danh sách rỗng tự cập nhật; anonymous không đọc chi tiết/gọi RPC tài chính; login quay về link; nhận lời mời; gửi hai đề xuất; cố ý mất phản hồi sau commit rồi reload/thử lại cùng key, không ghi trùng; xác nhận trả đủ, tự hủy pending có lý do; người ngoài không nhận hàng qua Realtime và không mở được room; logout ẩn chi tiết.
- Export browser tách vào `.local/browser-dist`, không nạp `.env`, không dùng URL cloud; HTTP/WebSocket ngoài local bị chặn. Manifest SHA-256 của source/assets/config/package phải khớp trước khi chạy; export cũng từ chối nếu mã đổi trong lúc bundle. Test dùng ba người dùng giả, bốn trang trình duyệt; không phải bốn thiết bị. Dọn fixture theo UUID sau test. Ảnh kiểm chứng: `.local/invite-anonymous.png`, `.local/loan-settled.png`.
- CI đã chuyển sang hành trình trên. Không có thay đổi migration/Edge Function/cloud trong lượt này. DEV và STAGING được kiểm tra lại vẫn `INACTIVE`; chưa có Android kết nối. APK `b9e038df...` bên dưới **chưa chứa các sửa đổi của lượt này**, không được xem là artifact của mã hiện tại.

## Mã đã thay đổi

| Nhóm                      | Thay đổi                                                                                                                                                                                  | Giới hạn kiểm chứng                                                         |
| ------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------- |
| RD-01 / crypto            | RPC gọi rõ `extensions.gen_random_bytes`/`extensions.digest`; kiểm tra schema extension trước migration                                                                                   | Database local; remote chưa áp dụng                                         |
| RD-02 / cách ly tài khoản | QueryClient mới theo phiên tài khoản, keys theo user, hủy/clear cache; bỏ response cũ; RPC cố định JWT của tài khoản khởi tạo                                                             | Unit tests và đọc mã SDK; chưa Android A→B E2E                              |
| RD-03 / gửi lại yêu cầu   | UUID từ Expo Crypto, journal mã hóa chỉ lưu key/digest, giữ key khi mất phản hồi; server ràng buộc key với payload; cached response vẫn kiểm tra quyền                                    | Có SQL và kiểm thử hai kết nối đồng thời; không tự gửi hàng đợi khi có mạng |
| RD-04 / trả đủ            | Khóa loan trước repayment, tính số dư trong transaction, hủy pending còn lại có lý do; hỏi xác nhận và khóa nút khi đang xử lý                                                            | SQL và bốn kịch bản tranh chấp khóa                                         |
| Lời mời                   | Chủ khoản vay có thể thu hồi/tạo link thay thế; link cũ bị vô hiệu; retry không trả token đã dùng/thu hồi; audit; serialize join/revoke theo loan                                         | 15 kiểm thử quản lý lời mời và cuộc đua join/revoke                         |
| Auth                      | PKCE chỉ nhận code đúng callback, allowlist return path; xử lý signup chờ email, gửi lại xác nhận, reset mật khẩu, logout; refresh theo AppState                                          | GoTrue/Mailpit thật ở local; Google/cloud/cold start trên Android chưa thử  |
| Lưu phiên                 | SecureStore native chia chunk nhỏ, ghi manifest sau cùng, giữ phiên cũ nếu ghi thất bại; khóa WHEN_UNLOCKED_THIS_DEVICE_ONLY                                                              | Unit tests Unicode/kích thước/lỗi ghi; chưa thử backup/thiết bị thật        |
| RD-05 / Android           | `allowBackup=false`, backup exclusions SecureStore; loại overlay/read-write external storage; staging bỏ scheme dev                                                                       | Manifest/chữ ký/backup XML của APK mới đã qua; còn thử thiết bị             |
| Đồng bộ/UI                | Một kênh theo phiên tài khoản, gom refetch, nhận dữ liệu khi danh sách ban đầu rỗng; xác nhận web và điều hướng/form trả nợ đã sửa                                                        | Hành trình Chrome với Realtime local thật đã qua; chưa hai thiết bị Android |
| Telemetry                 | Chỉ cho phép mã lỗi đã duyệt và vị trí bundle; bỏ nội dung lỗi tự do, URL, headers, user, breadcrumbs, context và extra; tắt tracing/native crash cho tới khi có kiểm chứng privacy riêng | Hai canary unit tests; chưa chứng minh dữ liệu nhận tại Sentry cloud        |

Migration mới của đợt thực thi: `20260916070000_invite_crypto_schema.sql`, `20260916080000_command_receipts_and_settlement.sql`, `20260916090000_invite_management.sql`; cùng migration `20260916060000` sửa authorization/dispute đã có trong đợt trước. Không sửa lịch sử migration cũ.

## Bằng chứng kiểm thử

- `npm run test:browser:local`: hành trình mở rộng mô tả ở trên đã PASS lại trên bản export cuối khớp dấu vân tay source, bằng Chrome headless 412×915 và GoTrue/Postgres/Realtime local thật. Bài smoke của đợt trước từng phát hiện tab web chỉ nhận Home/Settings; Android/web giờ dùng chung khai báo đủ routes, các route Auth/invite/loan được ẩn khỏi thanh tab. Có ảnh local để đối chiếu; không phải Android native E2E.

- Replay sạch **15 migrations** bằng `supabase db reset --local --no-seed`: thành công.
- `npm run db:test`: **66 assertions / 4 files**, PASS sau replay sạch. Bao gồm RLS, RPC definer, anonymous/private helper ACL, người ngoài, retry/payload mismatch, audit và luồng create/invite thật.
- `npm run db:test:concurrency`: **4 kịch bản**, PASS sau replay sạch. Hai kết nối độc lập thực sự chờ lock trước khi được thả: hai full confirmations; cùng key; confirm/cancel; join/revoke. Kiểm tra số dư, số event và membership sau race.
- `npm run test:auth:local`: PASS với GoTrue + Mailpit local. Password ngắn bị server từ chối; email chưa xác minh không login; PKCE/persistence/normal client JWT/RPC/logout hoạt động; code không dùng lại được; recovery đổi mật khẩu và mật khẩu cũ bị từ chối. Dữ liệu giả được dọn sau test.
- `npm run validate` lượt tiếp tục: format, lint không lỗi/cảnh báo lint, TypeScript, **38 unit tests / 12 files**, export web **12 routes** đã qua. Bao gồm kiểm thử xác nhận/hủy, chia sẻ web và phân biệt retry với thao tác mới đã được người dùng xác nhận. Cảnh báo Sentry organization/project khi export còn cần cấu hình trước production. SQL/concurrency/Auth nêu trên là kết quả đợt trước; lượt này không đổi database và không ghi nhận chúng là được chạy lại.
- CI được bổ sung SQL, concurrency, local Auth và Chrome; **chưa chạy trên GitHub**, không đánh dấu CI xanh từ kết quả local.

Các bài kiểm thử dùng dữ liệu giả. SQL kiểm tra vai trò database; không tự chứng minh JWT revocation. Auth integration kiểm tra JWT qua local HTTP; không tự chứng minh Google, app links hoặc giao diện điện thoại.

## Dependency và rủi ro tồn dư

Đã nâng riêng các bản vá tương thích `js-yaml` lên **4.3.2 / 3.15.2**, theo [advisory của dự án](https://github.com/advisories/GHSA-2883-xcg3-v3hh). Audit `--omit=dev` sau cập nhật còn **25 mục: 9 high, 16 moderate, 0 critical**. Con số bao gồm chuỗi phụ thuộc bị ảnh hưởng, không phải 25 đường khai thác độc lập.

| Nhóm còn lại                                                | Đánh giá đường sử dụng từ cây dependency                                                                        | Việc còn phải làm                                                                                                                                                                                                                          |
| ----------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `decode-uri-component@0.2.2` qua Expo Router → query-string | Có liên quan xử lý URL runtime; kiểm tra token trong screen diễn ra sau router nên chưa đủ để kết luận chặn DoS | Chọn bản vá/đường nâng tương thích Router và kiểm thử malformed/deep links. Bản sửa được advisory nêu là 0.5.0; không ép override khi chưa kiểm chứng API/module compatibility. [Nguồn](https://github.com/advisories/GHSA-vcc3-ghjq-m6fr) |
| `image-size@1.2.1` qua Metro                                | Nhận asset lúc build; chưa thấy tính năng app nhận ảnh người dùng đưa vào Metro                                 | Cô lập build, không xử lý asset không tin cậy; theo dõi bản vá/nâng toolchain. Không coi việc nâng major tự động là đã an toàn. [Nguồn](https://github.com/advisories/GHSA-w3rx-r6r6-pgpr)                                                 |
| `postcss@8.4.49` qua Expo Metro                             | Đường xử lý CSS/source map lúc build/web; cần xét nội dung đầu vào và file quyền đọc của runner                 | Nâng tương thích, kiểm thử export, không chạy PR không tin cậy với production secrets                                                                                                                                                      |
| `uuid@7.0.3` qua xcode                                      | Công cụ build iOS; app command mới dùng Expo Crypto                                                             | Xác minh usage/bản nâng upstream trước mở iOS; không suy ra mọi API uuid đều bị tác động                                                                                                                                                   |

Các đánh giá đường sử dụng trên là phân loại từ mã/cây dependency hiện tại, chưa phải chứng minh không thể khai thác. Không chạy `npm audit fix --force` để đổi Expo major ngoài kiểm soát.

Những giới hạn bảo mật khác chưa đóng:

- Token mời được hash trong `loan_invites`, nhưng raw token vẫn có trong receipt server phục vụ retry; table receipt không cấp đọc client. Cần retention/cleanup được kiểm thử, gồm backup. Không được tuyên bố “không có raw token trong DB”.
- Journal command không lưu payload tài chính; SecureStore có thể còn chunk mồ côi nếu tiến trình bị kill trước commit manifest. Chưa có bằng chứng xóa vật lý/backup trên mọi thiết bị.
- Chưa có quota theo user cho create/submit/preview hoặc phân trang list/timeline. Đã giới hạn một kênh Realtime mỗi phiên ứng dụng, nhưng chưa đo chi phí RLS/fan-out/tải lớn.
- Logout không đồng nghĩa mọi access JWT cũ hết hiệu lực ngay; cần ma trận thu hồi quyền/session thật trước dữ liệu nhạy cảm.
- SecureStore không bảo vệ dữ liệu khi thiết bị/OS bị chiếm quyền. Bản web dùng localStorage nên có ranh giới XSS riêng.

## Điều kiện tiếp tục để phát hành

1. Khôi phục STAGING, xác minh backup/target/schema và migration history, dry-run rồi áp dụng migration; cấu hình email/Google redirects cho `loan-staging://auth/callback`. Local `config.toml` không tự thay Auth cloud.

   [deployment-preflight.sql](../supabase/diagnostics/deployment-preflight.sql) cung cấp inventory chỉ đọc về schema crypto, ACL và số bản ghi vi phạm invariant. Nếu có principal/repayment quá JS safe integer, tổng confirmed vượt principal, hoặc REPAID còn pending từ lịch sử, dừng để đánh giá dữ liệu trước migration; không tự xóa/chỉnh số tiền để làm migration qua.

2. Thử Android thực: cài/khởi động lại/đổi account, OAuth/email link khi app đóng, lost response/offline, hai tài khoản/thiết bị, backup/restore, thư viện native 16 KB và kiểm tra APK cuối.
3. Chốt chính sách xóa tài khoản; hoàn thiện quy trình xóa/re-auth/audit/retention và trang yêu cầu xóa bên ngoài app.
4. Hoàn thiện phần M3–M5 còn thiếu: HTTPS App Links/domain, notifications/outbox, quota/phân trang, privacy/support/Play disclosures, owner MFA/recovery, backup restore drill, production Sentry và dependency release gates.
5. Build production AAB từ commit đã nghiệm thu; chỉ mở beta dữ liệu thật sau khi các điều kiện trên có bằng chứng. APK staging chỉ dùng dữ liệu giả.

## Artifact

Bản preview của đợt bảo mật trước lượt kiểm thử hành trình: [EAS build b9e038df-f1d8-492b-bb56-e8635da14ab5](https://expo.dev/accounts/loanappmobiles-team/projects/loanapp/builds/b9e038df-f1d8-492b-bb56-e8635da14ab5), **FINISHED** lúc 15:07:44 giờ Việt Nam, 16/09/2026. [Tải APK staging](https://expo.dev/artifacts/eas/_VV2dFJ0zh6wgUd8phL9ByEzYjpt_eZCpWwkc04vy38.apk). Bản đã tải ở `.local/loan-staging-security.apk`; chưa chứa thay đổi Realtime/form của lượt tiếp theo ở trên. APK cũ `e9186536-9ae2-4067-9023-48775f738c29` cũng không chứa đợt sửa bảo mật.

- SHA-256: `30022ebd16bfcd88762d0d436b661211a4f74c10006d09634bd9e1645c6d4730`.
- Chữ ký APK được `apksigner verify` xác minh; package `com.loanappmobiles.loanapp.staging`, version 1.0.0/code 1, min SDK 24/target SDK 36.
- Script `scripts/check-android-apk.ps1` PASS trên APK mới và từ chối APK cũ vì backup. Manifest mới: `allowBackup=false`, không debuggable, không SYSTEM_ALERT_WINDOW/READ_EXTERNAL_STORAGE/WRITE_EXTERNAL_STORAGE, application scheme `loan-staging`, không `exp+loanapp`. `https` xuất hiện trong phần package queries, không phải bằng chứng đã có verified App Links.
- Đối chiếu resource table với XML thực sự đóng gói: `secure_store_backup_rules` và `secure_store_data_extraction_rules` đều exclude shared preferences `SecureStore`; phần data extraction có cả cloud-backup và device-transfer. Chưa có thử backup/restore thực tế trên OEM/device.
- Scan bundle tìm thấy duy nhất project origin STAGING `kircmwdkcdcozckrwfid`, không URL DEV, không file `.env` và không marker PEM private key. Hai dòng `sb_secret_` trong disassembly Hermes đều là tiền tố kiểm tra key của SDK, không phải giá trị server key. Đây là kiểm tra có phạm vi, không thay secret audit toàn lịch sử repo.
- Kiểm tra cấu trúc trên APK mới: 50 thư viện ELF 64-bit, 0 lỗi LOAD alignment 16 KB, 0 lỗi ZIP alignment, 41 mục cần đối chiếu phép kiểm RELRO với NDK/runtime như đã nêu ở rà soát ban đầu. Không suy ra 41 mục sẽ crash hoặc đã đạt tương thích 16 KB.
- Máy không có Android kết nối qua ADB. Chưa cài/chạy APK, chưa kiểm tra hai thiết bị, chưa deploy migration lên STAGING đang `INACTIVE`. Artifact dùng dữ liệu giả; không phải nghiệm thu production/AAB/Play.
