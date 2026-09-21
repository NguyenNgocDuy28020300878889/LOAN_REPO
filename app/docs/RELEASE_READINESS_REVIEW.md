# LOAN — Rà soát khả năng đưa vào sử dụng thực tế

> **Cập nhật sau triển khai:** xem [kết quả sửa lỗi 16/09/2026](IMPLEMENTATION_SECURITY_2026_09_16.md). RD-01–04 đã có sửa lỗi và kiểm thử local; RD-05 đã xác minh manifest/chữ ký/backup exclusions trên APK mới, còn nghiệm thu thiết bị. Phần bên dưới giữ nguyên ảnh chụp phân tích **trước khi sửa**, không mô tả toàn bộ mã hiện tại. Chưa đạt điều kiện dữ liệu thật.

Ngày 16/09/2026, sau APK staging `e9186536-9ae2-4067-9023-48775f738c29`. Nguồn lực: một người; Android trước. Đây là kết quả phân tích và chẩn đoán, không phải nghiệm thu phát hành. Phiên này không sửa logic ứng dụng, không áp dụng migration hoặc thay cấu hình cloud.

## Kết luận

LOAN đã có bản cài staging và nền tảng kiểm thử. Luồng tạo khoản vay trên database dựng mới vẫn bị chặn; cách ly phiên và tính đúng khi gửi lại giao dịch chưa đủ cho dữ liệu thật. Ưu tiên tiếp theo là làm một luồng hai người hoàn chỉnh, có kiểm thử thất bại/mất mạng/đổi tài khoản, rồi mới mở nhóm dùng thật.

Đọc cùng [kế hoạch Android](../../KE_HOACH_RA_MAT_ANDROID.md), [kế hoạch bảo mật](../../KE_HOACH_BAO_MAT.md) và [báo cáo tiến độ](../../BAO_CAO_TIEN_DO.md). Không cộng thêm toàn bộ công việc dưới đây vào ước lượng cũ: phần lớn là cụ thể hóa M0–M4.

## 1. Phát hiện mới có bằng chứng

| ID / ưu tiên                            | Kết quả và tác động                                                                                                                                                                                                                                                                                          | Cách đóng việc                                                                                                                                                                                                                                     |
| --------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| RD-01 / P1, làm ngay                    | Trên local đủ 12 migrations, `create_loan` lỗi `42883: function gen_random_bytes(integer) does not exist`; preview lỗi tương tự với `digest`. `pgcrypto` nằm trong `extensions`, còn RPC dùng `search_path=public` và gọi tên hàm không kèm schema. Tạo/join khoản vay chưa có bằng chứng chạy trên DB sạch. | Migration mới gọi đúng schema crypto, không mở rộng search path sang schema không tin cậy. Test tạo → preview → accept/decline bằng RPC thực trên DB dựng mới; giữ negative authorization tests.                                                   |
| RD-02 / P0 cần xử lý trước dữ liệu thật | QueryClient dùng chung, `staleTime=30_000`, query keys không chứa user; auth provider không clear/cancel cache. Thử riêng QueryClient với dữ liệu giả A rồi fetch cùng key của B trả cache A, không gọi fetcher B. Loan Room chỉ kiểm tra có ID, chưa chờ auth/hydration.                                    | Keys chứa user, hủy request/clear cache/unsubscribe khi đổi phiên, ngăn response cũ ghi lại cache, route guard. Test A → logout → B, response A về muộn, mở lại room/deep link. Chưa tuyên bố đã tái hiện lộ dữ liệu trên thiết bị thật.           |
| RD-03 / P0 cần xử lý trước dữ liệu thật | RPC `submit_repayment`: cùng key, đổi amount 100 → 200 vẫn trả response của lần 100. Cùng payload, key mới tạo thêm row. UI hiện sinh key mới mỗi lần submit/decision.                                                                                                                                       | Một ý định giao dịch giữ key qua retry; payload thay đổi dùng key mới. Server lưu fingerprint, reject cùng key khác payload, kiểm quyền trước trả cache. Không deduplicate chỉ theo amount/date: hai lần thanh toán giống nhau có thể hợp lệ.      |
| RD-04 / P1, cần quyết định nghiệp vụ    | Sau confirm đề xuất 1.000 trên khoản vay 1.000, loan thành REPAID nhưng vẫn còn 2 đề xuất PENDING.                                                                                                                                                                                                           | Chốt cách xử lý pending còn lại, cập nhật nguyên tử và có audit. Test confirm đồng thời, confirm-vs-cancel, hết số dư; không âm thầm coi đề xuất là đã trả.                                                                                        |
| RD-05 / P1, cấu hình native             | APK staging có `allowBackup=true`, quyền `SYSTEM_ALERT_WINDOW`, `READ_EXTERNAL_STORAGE` (max SDK 32), `WRITE_EXTERNAL_STORAGE`. Ngoài `loan-staging`, vẫn có scheme `exp+loanapp`.                                                                                                                           | Kiểm kê nhu cầu, chặn quyền thừa; tắt generated dev scheme ở bản ngoài development; cấu hình backup/device-transfer theo storage. Kiểm lại manifest của APK/AAB production. Đây chưa phải bằng chứng dữ liệu đã bị sao lưu hoặc quyền đã được cấp. |

Nguồn mã để sửa:

- RD-01: `supabase/migrations/20260822063132_loan_invite_rpcs.sql`, `20260822072000_invite_preview_rpc.sql`; giữ nguyên migration lịch sử.
- RD-02: `src/providers/app-providers.tsx`, `auth-provider.tsx`, `src/app/index.tsx`, `loan/[id].tsx`, `settings.tsx`.
- RD-03/RD-04: `src/app/create.tsx`, `loan/[id]/repayment.tsx`, `loan/[id].tsx`; các RPC idempotency/repayment và migration bổ sung sau này.
- RD-05: `app.config.js`, `app.json`, cấu hình plugin và dependency native. `expo-dev-client` hiện có `addGeneratedScheme` mặc định true trong mã plugin đã cài.

Chẩn đoán SQL lưu tại [release-readiness.sql](../supabase/diagnostics/release-readiness.sql). Chỉ chạy local với dữ liệu tổng hợp, kết thúc bằng ROLLBACK:

```powershell
Get-Content -Raw -Encoding UTF8 supabase/diagnostics/release-readiness.sql | docker exec -i supabase_db_loan-local psql -U postgres -d postgres -v ON_ERROR_STOP=1 -P pager=off
```

Lệnh trên chạy từ `app/`. Năm dòng kết quả là quan sát lỗi/hành vi hiện tại, **không phải năm acceptance tests đã đạt**. Suite 23 SQL assertions trước đây không gọi luồng `create_loan`; vì vậy nó không phát hiện RD-01. Sau khi sửa phải thêm regression thật vào suite CI.

## 2. Khoảng trống luồng người dùng cần đóng

| Luồng                  | Hiện trạng đọc mã                                                                                                                                                                                                                                                          | Điều kiện nghiệm thu                                                                                                                                                                                               |
| ---------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Đăng nhập và khôi phục | Chưa cấu hình storage native/refresh theo vòng đời; Google callback truyền cả URL vào `exchangeCodeForSession`; callback route chỉ hiện spinner. Có hàm signOut nhưng chưa thấy UI gọi; chưa thấy resend/reset password. Signup luôn điều hướng dù có thể chưa có session. | Đăng ký/xác minh email/reset/logout, mở lại app, OAuth thành công/hủy/lỗi/cold start; callback chỉ nhận đường dẫn/đích hợp lệ.                                                                                     |
| Chia sẻ lời mời        | Hiện share custom scheme, chưa có HTTPS App Links/landing xác minh domain. Có cột revoked_at và kiểm tra revoke, chưa có RPC/UI revoke/reissue.                                                                                                                            | Người có link hợp lệ đăng nhập để join; cảnh báo chuyển tiếp, thu hồi/cấp lại, expiry/single use; chưa cài app có hướng dẫn và mở lại link sau cài.                                                                |
| Preview riêng tư       | RPC được thiết kế trả số tiền/ngày/purpose cho bearer token chưa login; hiện bị lỗi crypto RD-01 trên local.                                                                                                                                                               | Chốt mức thông tin trước auth. Đề xuất landing chung, chi tiết sau login. Giữ nguyên quyết định ai có link được tham gia; không tự thêm email binding.                                                             |
| Đồng bộ hai người      | Hook ở Home nhận thay đổi repayments nhưng chỉ invalidate list/room; chưa invalidate query repayments. Room mở thẳng chưa tự subscribe. List/timeline chưa phân trang.                                                                                                     | A/B mở trực tiếp room vẫn cập nhật; refetch khi reconnect/foreground; lỗi hiển thị rõ, không báo empty sai. Phân trang/giới hạn tải trước tăng số khoản vay.                                                       |
| Xóa tài khoản          | UI chỉ tạo request; Edge Function chưa được gọi từ UI. Không có fresh re-auth; job/audit chưa bảo đảm khi crash; ghi audit qua private API cần kiểm chứng và kiểm tra error.                                                                                               | Chốt policy trước; sau đó xây quy trình bền vững, thu hồi truy cập, status/retry, audit, xử lý PII và backup. Không triển khai room chỉ đọc khi quyết định còn mở.                                                 |
| Thông báo              | Có preferences nhưng chưa có token registry, delivery/outbox/scheduler.                                                                                                                                                                                                    | Bản alpha dữ liệu giả không cần chờ push để thử core flow; trước beta theo phạm vi hiện hành vẫn cần delivery, opt-out, dedup, nhắc theo múi giờ và nội dung trung lập. Muốn hoãn khỏi v1 cần đổi phạm vi rõ ràng. |

## 3. Hạ tầng và artifact: điều đã biết, điều chưa biết

- Đọc lại Supabase projects bằng CLI trong phiên này: `shared-loan-staging` và `shared-loan-dev` vẫn **INACTIVE**. Khôi phục staging hiện có, xác minh backup/target/schema/migration history rồi mới lập migration dry-run. Không reset database cloud để làm giống local.
- APK đã ký và target SDK 36 là bằng chứng build; chưa chứng minh đăng nhập, deep link, hiển thị bàn phím, mất mạng hoặc cập nhật app trên điện thoại.
- Quét cấu trúc ELF/ZIP bằng script local: 50 thư viện 64-bit có LOAD alignment và ZIP offset phù hợp 16 KB. Kiểm tra bổ sung `(RELRO VirtAddr + MemSize) % 16384` gắn cờ 41 thư viện. Cần đối chiếu bằng Android NDK tools và chạy thiết bị/emulator 16 KB; **chưa kết luận 41 thư viện sẽ crash**, cũng chưa công nhận tương thích 16 KB. AAB cuối cần kiểm riêng. [Hướng dẫn Android 16 KB](https://developer.android.com/guide/practices/page-sizes)
- APK hiện không đủ cơ sở để kết luận backup an toàn. Cần kiểm tra dữ liệu thật sự lưu trên máy và quy tắc loại trừ cho cả cloud backup/device transfer; `allowBackup=false` riêng lẻ không giải quyết mọi thiết bị Android 12+. [Android Auto Backup](https://developer.android.com/identity/data/autobackup)
- Scheme phụ có thể tắt qua `expo-dev-client.addGeneratedScheme`; cần kiểm chứng lại artifact và việc cài song song các môi trường. [Expo DevClient](https://docs.expo.dev/versions/latest/sdk/dev-client/)
- Audit dependency trước đó còn 26 mục; phiên phân tích này chưa chạy lại audit hoặc nâng version. Triage theo đường sử dụng runtime/build/server, khả năng nhận đầu vào không tin cậy và phiên bản sửa; không dùng số đếm thay đánh giá rủi ro.

## 4. Thứ tự triển khai tối ưu cho một người

| Đợt                                | Công việc chính                                                                                                   | Bằng chứng để chuyển tiếp                                                                                                       |
| ---------------------------------- | ----------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------- |
| A — Làm ngay trên local            | RD-01 và test đầy đủ tạo/join; đồng thời kiểm kê quyền RPC, kiểm thử đường từ anon/A/B/C.                         | DB sạch chạy được toàn core RPC flow; cả allow/deny đúng. Có thể làm khi staging còn dừng.                                      |
| B — M1, cách ly tài khoản          | RD-02, storage/callback/logout/reset và kiểm soát phiên.                                                          | Cùng máy đổi A/B không lẫn cache; session/callback negative tests; đăng nhập staging trên điện thoại sau khi backend hoạt động. |
| C — M2, tính đúng giao dịch        | RD-03, quyết định RD-04, ACL/default privileges, quota, revoke/reissue và token cache.                            | Test mất response rồi retry, key conflict, concurrent confirm; số dư/event đúng và lời mời bị thu hồi không dùng được.          |
| D — M3/M4, trải nghiệm và vận hành | Realtime/HTTPS links, RD-05, deletion theo policy được chốt, thông báo, privacy/scrub/backup/restore/kill switch. | Hai thiết bị hoàn thành luồng; restore được; cảnh báo đến chủ dự án; thử dừng ghi từ server với app cũ.                         |
| E — M5/M6, dữ liệu thật và Play    | Production riêng, AAB, hồ sơ store, beta có theo dõi và hỗ trợ.                                                   | Đạt cổng bảo mật cũ, xử lý hết lỗi chặn và rủi ro nghiêm trọng chưa phân loại; không suy ra điều này từ APK build xanh.         |

Tiếp tục kiến trúc Expo + Supabase. Giữ một đợt sửa chính tại một thời điểm, mỗi đợt có migration/test/evidence rõ ràng. Dùng 5 cặp người thử **dữ liệu giả** để kiểm tra họ có hiểu vai trò và xác nhận trả nợ hay không trước khi tuyển beta dùng thật; đây là đề xuất tuyển tester, không giả định đã có người.

Giữ ước lượng tổng 12–18 tuần như một khoảng lập kế hoạch chưa cam kết. Sau đợt A–C mới ước lượng lại theo thời gian thực tế và các quyết định deletion/push/currency. Tự động hóa giảm thao tác lặp; không thay trải nghiệm trên thiết bị, quyết định sản phẩm hoặc trách nhiệm vận hành của chủ dự án.

## 5. Hồ sơ Play và vận hành tối thiểu

- Điền Financial features declaration theo chức năng thực tế; Google yêu cầu declaration cho app ở closed/open/production tracks. LOAN hiện là sổ ghi nhận chung theo phạm vi mã nguồn; tên LOAN không tự quyết định app có phải dịch vụ cho vay. Chưa đủ thông tin để tự chọn mọi mục khai báo hoặc kết luận nghĩa vụ pháp lý. [Financial features declaration](https://support.google.com/googleplay/android-developer/answer/13849271?hl=en)
- Có trang công khai cho privacy/support/yêu cầu xóa tài khoản, gắn đúng tên app/chủ phát hành; flow xóa trong app và đường yêu cầu ngoài app phải hoạt động. Retention ngoại lệ cần giải thích theo policy đã chốt. [Yêu cầu xóa tài khoản của Play](https://support.google.com/googleplay/android-developer/answer/13327111?hl=en)
- Kiểm lại điều kiện tester/production access trên chính Play account; tài khoản và ngân sách thực tế chưa được xác minh. Có reviewer instructions để thử vai trò hai người.
- Chủ dự án cần MFA/recovery, nơi giữ signing/recovery độc lập, email hỗ trợ, mức ngân sách tháng, giờ xử lý sự cố và cách ngừng ghi khi không thể xử lý. Mục tiêu backup/restore cũ cần thử thực tế; chưa có evidence thì chưa nhận dữ liệu thật.

## 6. Các quyết định còn mở

1. Khi một bên xóa tài khoản: dữ liệu nào bên kia tiếp tục đọc được, pending xử lý ra sao, có chặn ghi hay không, retention theo loại dữ liệu. Giữ trạng thái chờ bàn thêm.
2. Trả đủ nhưng còn pending và quy trình giải quyết dispute. Không coi các đề xuất trong kế hoạch là quyết định đã duyệt.
3. Preview trước login; VND/nhóm thị trường đầu; người thử, email/domain/support và ngân sách vận hành.

Các điểm này chặn phần việc phụ thuộc tương ứng; không chặn sửa RD-01, cách ly cache, kiểm kê quyền hoặc xây test idempotency.
