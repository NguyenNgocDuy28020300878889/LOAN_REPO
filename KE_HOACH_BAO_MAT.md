# LOAN — Kế hoạch bảo mật trước dữ liệu thật

**Phiên bản:** 3, ngày 16/09/2026. **Phạm vi:** một người triển khai, Android trước. **Trạng thái:** đã được phép triển khai; tiến độ thực tế xem `BAO_CAO_TIEN_DO.md`. Không suy ra các gate đã đạt chỉ từ checklist.

**Bổ sung sau sửa lỗi:** [Kết quả triển khai và rủi ro tồn dư](app/docs/IMPLEMENTATION_SECURITY_2026_09_16.md) cập nhật RD-01–05, 66 SQL assertions, kiểm thử đồng thời/Auth local, cách ly JWT và telemetry. Anonymous không xem chi tiết; trả đủ tự hủy pending có lý do theo quyết định chủ dự án. Các mô tả “chưa sửa” bên dưới thuộc phiên phân tích trước; không dùng chúng thay báo cáo trạng thái mới. Chưa đạt gate release dữ liệu thật.

**Quyết định mới của chủ dự án:** giữ capability link — ai có link hợp lệ đều có thể đăng nhập và tham gia; không triển khai recipient binding. Chính sách chuyển room sang chỉ đọc khi một bên xóa account còn chờ bàn thêm, chưa áp dụng. SEC-01 và lỗi timestamp dispute đã tái hiện/sửa/test trên local, chưa deploy remote.

Tài liệu này là phần bắt buộc của [kế hoạch Android](KE_HOACH_RA_MAT_ANDROID.md). Khi có mâu thuẫn về điều kiện bảo mật, dùng các cổng nghiệm thu dưới đây. Checklist chưa đánh dấu là chưa có bằng chứng đạt. Đây không phải chứng nhận bảo mật hay kết luận hệ thống cloud đang bị khai thác.

**Bằng chứng bổ sung sau APK:** [rà soát thực tế RD-01–05](app/docs/RELEASE_READINESS_REVIEW.md) tái hiện lỗi crypto/schema, key không ràng buộc payload, proposal trùng khi retry key mới và pending còn lại sau trả đủ; thử lớp cache xác nhận nguy cơ dùng dữ liệu user trước. Manifest còn backup/quyền/scheme cần siết. Các phát hiện này chưa được sửa trong phiên phân tích; bổ sung vào kiểm chứng S0–S3, không thay cổng nghiệm thu hiện có.

## 1. Mục tiêu và ranh giới tin cậy

Tài sản cần bảo vệ: danh tính/phiên đăng nhập, quan hệ vay giữa hai người, số tiền/ngày/note, tính đúng của balance, timeline, invite token, push token, credentials vận hành, bản sao lưu và khả năng khôi phục.

Luồng dữ liệu: Android hoặc invite landing → Supabase Auth/Data API/RPC/Realtime → PostgreSQL; Edge Function/worker đặc quyền → xóa account hoặc gửi push; CI/EAS → artifact ký; error/log/backup → hệ thống vận hành.

Các tác nhân phải kiểm tra: khách chưa đăng nhập; C đã đăng nhập nhưng không thuộc room; A/B là thành viên hợp lệ nhưng cố vượt quyền; người có link bị chuyển tiếp; người giữ JWT cũ; thiết bị đổi account; job gửi lặp; credentials chủ dự án bị lộ.

- Client, URL, payload và `user_metadata` do client sửa đều không phải nguồn quyết định quyền. Server xác minh caller, account/session, membership và state.
- ID khó đoán không thay authorization. Biết loan/repayment UUID vẫn không được quyền đọc/ghi.
- RPC `SECURITY DEFINER`, service-role và dashboard là ranh giới đặc quyền riêng; RLS không tự bảo vệ khỏi lỗi trong những đường này.
- Không tuyên bố mã hóa đầu-cuối. Server cần đọc dữ liệu cho shared record; quyền admin là rủi ro tồn dư cần giới hạn và ghi nhận.

OWASP MASVS được dùng làm danh mục kiểm tra storage/auth/network/platform/privacy/code, không tuyên bố đạt MASVS chỉ nhờ hoàn thành tài liệu. [OWASP MASVS](https://mas.owasp.org/MASVS/)

## 2. Sổ rủi ro từ mã nguồn

Mức P0 ở đây là **ưu tiên xử lý/điều tra trước beta**, không phải điểm CVSS đã đo. “Quan sát” nghĩa là thấy trong mã; “suy luận” cần test tái hiện; “chưa rõ” cần xem cấu hình thực tế.

| ID     | Phát hiện và điều kiện                                                                                                                                                            | Mức/bằng chứng                                                            | Hành động và mốc                                                                                           |
| ------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------- |
| SEC-01 | `cancel_repayment` thiếu membership và so sánh creator không an toàn khi NULL | P0 đã tái hiện trên local; migration mới chặn outsider/NULL creator, regression đạt; chưa deploy remote | Tiếp tục kiểm tra lifecycle/concurrency và nghiệm thu staging; chưa áp dụng chính sách room chỉ đọc sau deletion; M2 |
| SEC-02 | Sau replay local, 15/17 functions public vẫn có quyền EXECUTE cho anon (gồm preview và trigger functions); cancel/dispute mới đã thu hồi | P0 đã kiểm kê local, chưa kiểm kê remote. EXECUTE không tự chứng minh bypass auth trong thân hàm; trigger functions không phải RPC thông thường | Chốt allowlist/default privileges, kiểm tra schema usage/API exposure và auth trong thân hàm, giữ helper cần cho RLS; M0/M2 |
| SEC-03 | Idempotency response lưu invite token thô dù invites chỉ giữ hash                                                                                                                 | P0 privacy; quan sát `create_loan`/`complete_idempotent_command`          | Thiết kế lại secret trong cache, quyền đọc, retention và replay sau revoke; M2                             |
| SEC-04 | Anonymous preview trả amount/currency/dates/purpose cho bearer token | Chủ dự án đã chọn capability link; không recipient binding. Mức chi tiết trước auth còn cần chốt | Đề xuất generic landing trước auth; người giữ link hợp lệ đăng nhập để xem/tham gia, revoke/reissue, hết hạn và chống replay; M2/M3 |
| SEC-05 | Key mới khi retry, chưa bind payload; `dispute_repayment` không ghi timestamp bắt buộc                                                                                            | P0 integrity/P1 chức năng; quan sát                                       | Regression SQL, key ổn định + fingerprint, race tests; M2                                                  |
| SEC-06 | OAuth flow/callback chưa nhất quán; session adapter/cache theo account còn thiếu                                                                                                  | P0 session/privacy; quan sát                                              | PKCE, secure native session storage, cache isolation và callback tests; M1                                 |
| SEC-07 | Xóa account chỉ kiểm tra có request; chưa kiểm status/fresh re-auth; PROCESSING có thể bị request RPC đưa về PENDING, audit errors bị bỏ qua                                      | P0 deletion; quan sát                                                     | State machine có claim/lock, chống replay, durable audit/reconcile và fresh re-auth; M4                    |
| SEC-08 | `sendDefaultPii:false` nhưng error/context được gửi nguyên; chưa thấy allowlist scrub cho URLs/breadcrumbs/extra                                                                  | P0 trước dữ liệu thật; chưa chứng minh đã rò rỉ                           | Canary test trên payload log/crash thực, redact trước gửi; M0/M4                                           |
| SEC-09 | Chưa có evidence rate limit RPC, quota, CI secret boundary, restore, server write-disable                                                                                         | P1 readiness; chưa rõ cloud                                               | Bổ sung kiểm soát và diễn tập S0/S4/S5                                                                     |

Nguồn mã chính: migrations `20260822063132`, `20260822072000`, `20260822083000`, `20260822100000`; `app/src/lib/auth.ts`, `supabase.ts`, `monitoring.ts`; `app/supabase/functions/delete-account/index.ts`.

## 3. Kiểm soát cần triển khai

### A. Quyền database/RPC

- Lập danh sách từng table/view/function với caller được phép, dữ liệu trả và lý do đặc quyền; kiểm tra grants lẫn RLS. Không dùng service-role để chạy negative authorization tests.
- Deny-by-default cho EXECUTE của chức năng ứng dụng; xác minh cả PUBLIC, anon, authenticated, quyền USAGE/schema và role tạo migration. Không revoke hàng loạt làm hỏng extension/auth hệ thống.
- `SECURITY DEFINER` chỉ khi cần, owner ít quyền phù hợp, `search_path` an toàn và schema-qualified references, kể cả crypto helpers. Không cho client CREATE trong schema được dùng để resolve function.
- Mọi command kiểm tra live caller, account/session hợp lệ, membership accepted, actor/counterparty khác nhau và loan/repayment state. Kiểm tra NULL tường minh hoặc toán tử NULL-safe; không xem `NULL <> user` là TRUE.
- Permission check vẫn thực hiện trước trả idempotency cache khi quyền/account thay đổi. Authorization trước trả thông tin đủ để người ngoài dò trạng thái một UUID.
- RLS áp dụng cho read trực tiếp lẫn Realtime; test view/RPC không vô tình mở rộng dữ liệu. Private helper không phải RPC công khai; không expose schema private chỉ để function xóa ghi audit.
- Financial writes và sửa/xóa audit bị chặn từ client. Admin vẫn có thể sửa DB: coi đây là giới hạn của kiến trúc, bảo vệ admin riêng.

RLS và grants là hai lớp cần kiểm chứng; function có đặc quyền cần kiểm tra riêng. [Supabase RLS](https://supabase.com/docs/guides/database/postgres/row-level-security) [Supabase database functions](https://supabase.com/docs/guides/database/functions)

### B. Đăng nhập, phiên và thiết bị

- Native OAuth dùng flow thống nhất với SDK, PKCE code/verifier, exact redirect allowlist; xử lý callback lỗi, code dùng lại/sai verifier, cold start và thiếu state/context. Không tự viết thuật toán OAuth.
- Session lưu bằng adapter dựa trên Android Keystore/secure storage phù hợp; không lưu refresh token bằng plaintext AsyncStorage. Test độ dài token, reinstall/backup/restore và lỗi storage; không fallback plaintext im lặng. [Expo SecureStore](https://docs.expo.dev/versions/latest/sdk/securestore/)
- Không dùng account metadata do người dùng chỉnh để xác định role/membership/email đã xác minh. Không tự gộp account chỉ vì text email trùng.
- Logout: clear query cache/store, cancel pending requests, unsubscribe Realtime, xóa session và push association của thiết bị. Response A trả muộn không được ghi vào cache B.
- Chọn chính sách logout thiết bị hiện tại/toàn bộ và lost-device recovery. Mục tiêu: RPC ghi và read nhạy cảm từ phiên đã thu hồi bị từ chối server-side, không chỉ client đóng màn hình.
- JWT còn hạn có thể tồn tại sau signout/deletion; bổ sung kiểm tra account/session thực sự còn hiệu lực trên các đường dữ liệu bảo vệ. Kiểm chứng behavior của Realtime riêng, kể cả socket đã mở. Nếu không đạt chặn ngay, ghi rõ cửa sổ phơi lộ và điều chỉnh thiết kế trước beta.
- Re-auth cho xóa account dựa trên bằng chứng server của lần xác thực mới, mục tiêu đề xuất ≤5 phút; timestamp do client gửi hoặc JWT vừa refresh không chứng minh người dùng vừa nhập lại credentials. Chọn cách làm tương thích email/OAuth trước code.
- Chủ dự án bật MFA cho GitHub/Supabase/Expo/Google, lưu recovery codes ngoài máy phát triển; MFA cho mọi end user có thể để sau nếu threat review cho phép.

Việc session bị thu hồi không tự đồng nghĩa mọi JWT cũ hết hiệu lực ngay; cần quyết định chính sách và test ở API. [Supabase sessions](https://supabase.com/docs/guides/auth/sessions) [Supabase user management](https://supabase.com/docs/guides/auth/managing-user-data)

### C. Lời mời và deep link

- Đã chốt capability link: caller có token hợp lệ có thể đăng nhập và accept/decline; không giới hạn theo email. Sau accept, room chỉ dành cho hai account đã ghi nhận. Link bị chuyển tiếp trước accept có thể bị người khác dùng: phải giải thích rõ lúc share, có revoke/reissue và không tự chuyển membership sau join.
- Token hiện cho phép anonymous preview chứa dữ liệu tài chính; vẫn cần chốt mức thông tin trước auth. Đề xuất generic landing cho bot/người chưa login, chi tiết cho người giữ token đã login; đây là giảm lộ preview, không phải recipient binding. Mọi GET chỉ đọc, không tự accept/decline.
- Token entropy từ CSPRNG, TTL giới hạn (đề xuất 72 giờ, cần chốt), một lần sử dụng; rate limit preview/accept/decline, generic errors cho người không được quyền.
- Tránh token thô trong idempotency response lưu lâu dài: đề xuất tách loan creation khỏi invite issuance. Retry tạo loan trả ID; mất token thì explicit reissue xoay token và revoke bản trước, không tạo loan mới. Nếu chọn encrypted recovery cache thì cần review key/lifetime/replay riêng.
- Revoke/reissue/accept/decline cùng khóa loan/invite theo thứ tự ổn định; token cũ không hoạt động qua cached response hoặc race. Người tạo không được giả làm người nhận.
- HTTPS verified App Links cho production, test fingerprint của Play App Signing ngoài bản EAS; custom scheme auth cần PKCE để hạn chế nguy cơ bị app khác nhận callback.
- Landing không bên thứ ba/analytics bắt URL có token; đặt no-store, no-referrer, noindex và CSP phù hợp; scrub cả access log phía host. Không giả định header xóa được token khỏi clipboard/lịch sử/message người dùng đã chia sẻ.

### D. Integrity, giao dịch và chống abuse

- Số tiền integer minor units, cùng currency và giới hạn an toàn end-to-end; chặn âm/zero/overflow/precision/date bất hợp lệ ở DB/RPC.
- Key gắn user + command + canonical payload fingerprint. Retry cùng payload trả cùng effect; khác payload cùng key bị từ chối. Random key client dùng CSPRNG; key không phải secret/authorization.
- Idempotency record có chính sách giữ đủ vòng đời retry; xóa cache không được làm command cũ tạo repayment lần hai. Đề xuất giữ receipt không chứa secret theo lifetime record, tách TTL secret khỏi receipt.
- Lock loan/repayment theo thứ tự nhất quán. Mỗi confirm tính remaining từ canonical confirmed rows trong transaction, ghi event và đổi state atomically.
- Test hai confirmation vượt tổng, confirm-vs-cancel, accept-vs-decline/revoke, xóa account-vs-confirm; assert balance, row count và event count, không chỉ HTTP status.
- Khi participant deletion bắt đầu, phối hợp locking với financial RPC để không phát sinh write chen giữa freeze và xóa. Policy disputed/repaid/read-only phải có state machine server.
- Giới hạn auth/email/invite/financial commands theo account, burst và IP nơi xác định IP đáng tin; quota rows và pagination cho list/timeline; bounded worker retries và query timeout. Không khóa vĩnh viễn account chỉ vì người khác spam email của họ.
- Chống abuse phải nằm trên đường không thể bypass: limiter ở Edge Function không đủ nếu public RPC tương đương vẫn gọi trực tiếp được. Chọn DB quota hoặc đóng đường bypass, test cả hai.

### E. Xóa tài khoản, retention và audit

- Request → claimed/processing → completed/failed có transition hợp lệ, one-time re-auth proof và lease/retry; cancelled request không chạy, request lặp không reset processing.
- Function chỉ lấy user từ token đã xác minh, không nhận user ID tùy ý làm mục tiêu. Credential admin tách khỏi client, kiểm tra mọi response/error và giới hạn thao tác đặc quyền.
- Xóa auth và ghi audit là quy trình nhiều bước, không giả định một transaction xuyên Admin API. Lưu job/audit tối thiểu bền vững không cascade mất theo user; test crash trước/sau delete và reconciliation. Không báo xong khi mới tạo request.
- Xóa profile/auth/push/invite và dữ liệu cá nhân không cần giữ; retained shared history còn chịu quyền read. UUID hoặc actor NULL không tự bảo đảm vô danh nếu note/metadata còn tên/email.
- Không sửa sự kiện tài chính đã xác nhận để “ẩn danh”; tách PII khỏi facts, định nghĩa redaction có kiểm soát với audit phù hợp. Rà soát policy hiện hành đang cấm mọi sửa event để không cản xóa PII hợp lệ.
- Trước beta phải chốt retention cho profile, invite cache, audit, security log, support và backup; công bố đúng khả năng hệ thống, không hứa xóa ngay mọi backup.
- Restore vào môi trường cách ly; áp lại deletion/suppression records trước reconnect người dùng hoặc gửi thông báo. Không phục hồi account đã xóa/push token cũ vào production vô tình.

### F. Log, push, CI và sự cố

- Error telemetry dùng allowlist fields, redact headers/body/query/URL/breadcrumbs/context trước gửi; disable screenshot/session replay trong v1 nếu chưa review. `sendDefaultPii:false` không phải bộ lọc toàn bộ dữ liệu do app tự gửi.
- Test bằng canary email/token/note/amount giả: không xuất hiện trong app logs, Sentry, HTTP logs, CI artifact. Raw log tài chính không phải evidence được phép chia sẻ.
- Push payload trung lập; không gửi số tiền/tên/note; worker xác minh membership/preference/account còn sống lúc dispatch. Kiểm tra token chuyển account/thiết bị cũ, logout/deletion và thông báo đã xếp hàng.
- Không có service-role/OAuth secret/signing key trong source, git history, JS bundle/APK/source maps. Secret scan redacted; nếu phát hiện secret thật thì rotate, không chỉ xóa file.
- CI permissions tối thiểu, không cấp production secrets cho PR không tin cậy; pin action commit sau xác minh, lockfile, dependency audit có triage, Edge Function dependency version cố định. Tài khoản một người vẫn dùng branch/release checks và nhật ký deploy.
- Dev/staging/prod tách account data, redirect, domain/app identifier và push registry. Fail build nếu production config thiếu/trỏ sai; không đưa dữ liệu thật vào staging.
- Bản Android release không debuggable/cleartext, HTTPS validation chuẩn; không tự bỏ certificate checks. Pinning/root detection/obfuscation không thay quyền server, hoãn nếu chưa có kế hoạch vận hành phù hợp.
- Feature kill switch **server-side** cho financial writes, tách khỏi deletion/support nếu có thể; test app phiên bản cũ gọi RPC vẫn bị chặn. Theo dõi queue/error/cost, alarm có đường tới chủ dự án.
- Incident playbook: cô lập/dừng ghi → giữ bằng chứng đã scrub → thu hồi/rotate credential liên quan → xác minh tính đúng → forward-fix → regression → mở lại. Không hứa giám sát 24/7 khi chỉ một người; chốt thời gian trực và cách tạm ngừng khi không xử lý kịp.
- Backup mã hóa/quyền truy cập tối thiểu, restore định kỳ; RPO/RTO được đo, không đánh dấu đạt chỉ vì nhà cung cấp có nút backup. Restore không thay rollback an toàn của app.

## 4. Ma trận kiểm thử bắt buộc

Mỗi case ghi commit, migration head, actor, môi trường, hành động, expected/actual và artifact đã scrub. Test tự động trên dữ liệu giả/local/staging trước; không dùng production để thử abuse.

| Case | Kịch bản                                                                           | Điều kiện pass                                                      |
| ---- | ---------------------------------------------------------------------------------- | ------------------------------------------------------------------- |
| T01  | Anon/C gọi read table, RPC room/list/repayments, join Realtime A/B                 | Không rows/events/chi tiết tài chính trái quyền                     |
| T02  | A/B/C direct insert/update/delete financial rows và audit                          | Đều bị từ chối; chỉ command được cấp quyền hoạt động                |
| T03  | Caller truy cập helper/private schema, hàm mới mặc định, NULL/malformed JWT claims | Không escalation; ACL đúng inventory                                |
| T04  | A submit; A confirm/dispute, B cancel                                              | Bị chặn; đúng người vẫn làm được                                    |
| T05  | Delete creator làm `created_by=NULL`; C biết repayment UUID gọi cancel             | Bị chặn; không đổi repayment/event/balance                          |
| T06  | Account bị xóa/thu hồi session gọi RPC/read/Realtime bằng JWT cũ                   | Bị chặn theo chính sách; không tự tạo lại profile                   |
| T07  | Hai confirm đủ để vượt principal, confirm-vs-cancel                                | Không âm/vượt principal; event đúng một lần cho mỗi effect          |
| T08  | Commit thành công nhưng mất response; retry và reopen app                          | Không duplicate loan/repayment/event                                |
| T09  | Cùng key khác payload, user khác cùng key, replay khi quyền đổi                    | Reject mismatch; không trả data trái quyền                          |
| T10  | Token forwarded/expired/revoked/reissued, self-join/decline, bot preview           | Không dữ liệu/decision trái quyền; GET không mutate                 |
| T11  | Accept/decline/revoke song song                                                    | Một kết quả hợp lệ; đúng hai participant, không state mâu thuẫn     |
| T12  | Sai callback host/path, code replay/sai verifier, reset link đã dùng               | Không session/redirect ngoài allowlist; lỗi an toàn                 |
| T13  | A logout/B login khi request A đang bay, socket A còn mở                           | UI/cache/subscription B không lộ A                                  |
| T14  | Inspect native storage/log/backup sau logout/reinstall                             | Không plaintext token hoặc financial cache ngoài policy             |
| T15  | Deletion cancelled/processing/retry, re-auth giả/cũ, crash sau auth delete         | Không xóa sai/lặp, job/audit recover được, không báo thành công giả |
| T16  | Delete participant đồng thời confirm, còn pending/disputed                         | Không write trái lifecycle; retained history đúng quyền             |
| T17  | Canary PII/secret trong error/context/URL/push                                     | Không xuất hiện trong các kênh không được phép                      |
| T18  | Burst request, tạo nhiều row, pagination, direct-RPC bypass limiter                | Quota/timeout có hiệu lực, không tạo side effect ngoài giới hạn     |
| T19  | Restore backup chứa account đã xóa và job push cũ                                  | Áp suppression trước mở dịch vụ; không sống lại account/job         |
| T20  | APK config/signature/bundle và production kill switch                              | Đúng backend, không secret; old app không bypass chặn ghi           |

Automation đề xuất: pgTAP cho constraints/grants/RLS; API integration bằng session thật A/B/C cho auth/RPC/Edge Function; concurrency runner dùng nhiều connection và barrier, không test nối tiếp giả concurrency; Maestro/device tests cho Android auth/deep links/cache; artifact/log inspection có redaction. CI không dùng service-role để giả làm user trong authorization assertions.

## 5. Cổng nghiệm thu gắn với lộ trình

| Cổng             | Đạt khi                                                                                       | Bằng chứng bắt buộc                                              |
| ---------------- | --------------------------------------------------------------------------------------------- | ---------------------------------------------------------------- |
| S0 — M0          | Data map/threat model, inventory credentials/ACL, môi trường cô lập, quyết định mục 6         | Checklist owner, sơ đồ trust boundary, mapping không chứa secret |
| S1 — M1          | Auth/session/cache đúng; private data không chảy qua landing/log                              | T12–T14, policy JWT/re-auth, storage evidence                    |
| S2 — M2          | SEC-01–05 được giải quyết, quyền/NULL/races được test                                         | T01–T11, migration replay sạch, CI log                           |
| S3 — M3          | Hai thiết bị, deep links và Realtime không vượt quyền                                         | T01/T10–T14 trên release candidate                               |
| S4 — M4          | Deletion/push/log/abuse/backup có bằng chứng                                                  | T15–T19, canary results, restore và incident drill               |
| S5 — trước M5/M6 | Binary/cloud config thật khớp policy, không P0/P1 và không rủi ro nghiêm trọng chưa phân loại | T20, risk register đã đóng, checklist release có commit/build    |

**Không dùng dữ liệu người dùng thật trước S0–S5 cho bản beta.** Có thể internal alpha bằng dữ liệu giả sau M1 để lấy phản hồi; không gọi đó là beta đã qua bảo mật. Trước public release lặp các checks bị ảnh hưởng từ thay đổi beta, không lặp vô ích toàn bộ test khi không thay đổi.

Một người tự review vẫn có điểm mù: nên có review độc lập phạm vi nhỏ cho SQL authorization, deletion và token trước public. Nếu chưa có người review, ghi rõ chưa làm; không đánh dấu kiểm chứng độc lập hoặc đổi tên tự review thành pentest. Không có review ngoài không cho phép bỏ các test/cổng bắt buộc.

## 6. Quyết định sản phẩm và rủi ro tồn dư cần chốt

1. Capability invite đã được chủ dự án chọn; generic preview trước auth và TTL đề xuất 72 giờ/reissue còn cần chốt.
2. Session revocation cho read/write/Realtime; re-auth deletion với bằng chứng server, không dùng JWT refresh time.
3. Room chỉ đọc khi participant rời do deletion: chủ dự án yêu cầu bàn thêm trước triển khai; transaction freeze và pending/disputed handling chưa chốt.
4. Retention thực tế từng loại dữ liệu, backup window và suppression sau restore; PII trong note xử lý thế nào.
5. Quota theo account/command, thời gian xử lý incident, ngân sách backup/monitoring; không tự lấy một ngưỡng chưa đo làm production default.

Các mục này là đề xuất chờ chốt; không được diễn giải quyền tự động hóa trước đây thành đồng ý mọi chính sách mới. Cổng không đạt thì dùng synthetic alpha hoặc hoãn, không tự hạ tiêu chuẩn.

**Giới hạn v1:** không bảo vệ tuyệt đối trước thiết bị bị kiểm soát hoàn toàn, người tham gia tự chụp/chia sẻ dữ liệu được phép xem, hoặc admin có đặc quyền cao bị chiếm. Giảm rủi ro bằng data minimization, session control, MFA admin và vận hành; không tuyên bố “an toàn tuyệt đối”. Không có E2EE, certificate pinning hoặc root detection không tự động là blocker nếu threat model và các kiểm soát cốt lõi đã đạt.

## 7. Bằng chứng và phạm vi lần rà soát này

Đã đọc mã và tài liệu chính thức Supabase/Expo/OWASP ngày 16/09/2026 để lập kế hoạch. Chưa xác minh quyền cloud, chạy pentest, test SQL exploit, deploy hoặc sửa các phát hiện. Các tiêu chí là yêu cầu nghiệm thu tương lai, không phải kết quả đã pass.

## 8. Rủi ro trực tiếp với chủ dự án khi vận hành production

Phần này bổ sung rủi ro ngoài mã nguồn: tài khoản quản trị, thiết bị cá nhân, tiền vận hành, danh tính công khai và khả năng duy trì dịch vụ khi chỉ một người quản lý. Chưa kiểm tra tài khoản/thiết bị/billing thực tế của chủ dự án; các mục là nguy cơ cần phòng ngừa, không phải kết luận đã bị xâm nhập.

| ID     | Tình huống thực tế và tác động tới chủ dự án                                                                                                         | Kiểm soát cần có                                                                                                                                                                                             | Bằng chứng trước production                                                                                                                                 |
| ------ | ---------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------- |
| OPS-01 | Email/GitHub/Google chính bị chiếm, kéo theo reset quyền Supabase/EAS/Play; mất DB, source hoặc quyền phát hành                                      | Password manager, mật khẩu riêng, MFA chống phishing/passkey/security key nơi hỗ trợ, recovery độc lập; tài khoản/browse profile công việc tách khỏi sinh hoạt; inventory các liên kết SSO/OAuth             | Danh sách quyền admin và recovery đã thử, không ghi secret/recovery code vào repo                                                                           |
| OPS-02 | Mất máy/điện thoại hoặc malware lấy browser session, CLI token, `.env`, keystore; MFA không ngăn mọi session theft                                   | OS/browser/extension cập nhật, disk encryption, khóa màn hình, phần mềm tin cậy; token scope ngắn/hẹp nếu provider hỗ trợ; không sync secret qua thư mục chia sẻ tự động                                     | Có thủ tục thu hồi session/PAT từ thiết bị sạch và khôi phục truy cập khi mất máy chính                                                                     |
| OPS-03 | CI/dependency/plugin hoặc công cụ tự động hóa chạy mã không tin cậy với production credential                                                        | PR jobs không có production secret; release riêng, quyền tối thiểu, kiểm tra artifact/target; automation thường ngày dùng local/staging; cấp quyền production theo tác vụ cần thiết                          | Test PR không đọc được secret, log có actor/commit/target; không đưa database dump/user data thật vào công cụ hỗ trợ                                        |
| OPS-04 | Mất/lộ khóa ký hoặc tài khoản Play/EAS khiến không cập nhật được app, hoặc đối tượng khác có đủ quyền phát hành bản độc hại                          | Play App Signing, phân biệt upload key với app signing key, khóa upload riêng và quản lý quyền phát hành; kiểm kê Expo/Play/API credential và fingerprint                                                    | Biết quy trình reset upload key, quyền nào có thể publish và fingerprint thực của bản Play; không coi reset upload key là reset mọi signing risk            |
| OPS-05 | Bot spam signup/email/invite/RPC/Realtime hoặc bug retry sinh hóa đơn, đầy DB, nghẽn email                                                           | Quota/rate limit không bypass, bounded retries, giới hạn concurrency, quan sát usage từng nhà cung cấp và cơ chế giảm tải; chốt ngân sách và xử lý khi vượt ngưỡng                                           | Bảng khoản phí cố định/usage/add-on, phạm vi spend cap thực tế, cảnh báo đã nhận thử, diễn tập dừng tác nhân tốn phí                                        |
| OPS-06 | Tên thật/email/địa chỉ liên hệ xuất hiện trên store/domain khiến bị spam, phishing hoặc quấy rối                                                     | Kiểm tra public developer profile trước submit; email support riêng, bảo vệ domain registrar, privacy WHOIS nếu có; thông tin khai báo phải đúng                                                             | Biết chính xác trường nào công khai theo loại account/thị trường/monetization; không nhầm brand name là ẩn danh chủ tài khoản                               |
| OPS-07 | Email giả từ Play/Supabase, báo lỗi bảo mật giả hoặc support lừa gửi OTP/service-role/backup, chạy script hoặc chuyển quyền account                  | Vào dashboard bằng địa chỉ tự mở; không gửi password/OTP/recovery/secret; kênh security/support riêng; bản tái hiện chỉ dùng dữ liệu giả; không chạy attachment/script của người báo lỗi trên máy có secrets | Mẫu tiếp nhận báo lỗi, quy tắc xác minh danh tính và quyền; không sửa số dư theo ảnh chụp/tin nhắn support                                                  |
| OPS-08 | Nhầm project khi migration, hết hạn domain/email/thẻ hoặc provider gián đoạn làm app ngừng; backup cùng account bị mất luôn khi admin bị chiếm       | Release ghi target/commit, additive migration; registrar lock/renewal reminders; backup/export mã hóa phù hợp phạm vi, recovery độc lập khỏi điểm mất account chính                                          | Restore vào môi trường riêng; inventory DB/Auth/config/functions/signing và những gì backup không bao gồm; không coi DB backup là backup toàn hệ thống      |
| OPS-09 | Một mình không phản hồi kịp, người dùng tranh chấp số dư hoặc gửi dữ liệu người khác; ảnh hưởng uy tín, hỗ trợ và nghĩa vụ xử lý dữ liệu cần rà soát | Beta giới hạn, service hours/contact rõ, kill switch và maintenance mode; quy trình report/block invite/reminder; không dùng support để quyết định bên nào đúng                                              | Runbook sự cố, retention/contact công khai, kênh phản hồi; rà soát privacy/store theo thị trường trước public, không giả định Terms tự loại hết trách nhiệm |

OPS-01/02/03 là nhóm có phạm vi ảnh hưởng lớn nhất: chiếm quyền chủ dự án có thể vượt qua những kiểm soát dành cho end user. Bảo vệ tài khoản quản trị và recovery thuộc S0; OPS-04–09 phải có evidence trong S4/S5. Không cần thêm admin không tin cậy để đạt redundancy: nếu vẫn một người, dùng recovery chính thống đã thử và bản hướng dẫn khôi phục giữ ngoài repo.

### Những điểm cần hiểu chính xác

- Supabase khuyến nghị bảo vệ account quản trị bằng MFA, kể cả GitHub SSO; cấu hình SSL/network restrictions cho đường database phù hợp. Network restriction của DB không được mặc định coi là chặn toàn bộ public Auth/REST/Realtime API. [Supabase production checklist](https://supabase.com/docs/guides/deployment/going-into-prod)
- Supabase Spend Cap chỉ bao phủ một số loại usage; compute và một số add-on nằm ngoài. Nó không phải giới hạn tuyệt đối mọi hóa đơn, cũng không cung cấp mọi dạng ngân sách/cảnh báo tùy chỉnh. Phải kiểm tra thêm email/EAS/Sentry và hành vi giảm dịch vụ khi hết quota. [Supabase cost control](https://supabase.com/docs/guides/platform/cost-control)
- Play App Signing có upload key và app signing key với vai trò khác nhau. Mất upload key có quy trình reset; giữ key an toàn vẫn chưa đủ nếu account hoặc pipeline phát hành bị chiếm. [Google Play App Signing](https://support.google.com/googleplay/android-developer/answer/9842756)
- Theo tài liệu Play hiện tại, account cá nhân hiển thị tên pháp lý, quốc gia và developer email; monetization có thể đưa đầy đủ địa chỉ lên store, một số khu vực có thêm yêu cầu. Cần kiểm tra account/thị trường thực tế, không đưa thông tin giả để tránh công khai. [Thông tin tài khoản Play](https://support.google.com/googleplay/android-developer/answer/13628312?hl=en)
- Secret masking không đảm bảo script độc hại không lấy được secret; ranh giới PR/build/release và quyền của workflow mới là kiểm soát chính. [GitHub Actions secure use](https://docs.github.com/en/actions/reference/security/secure-use)

### Giới hạn quyền khi tự động hóa sau này

Chủ dự án đã yêu cầu triển khai lại. Công việc phát triển mặc định dùng dữ liệu giả và quyền local/staging. Production release cần artifact, test và target reviewable; quyền tự động hóa không phải lý do cấp mọi secret cho mọi process.

Không ghi production secrets trong prompt/ticket/source, không đưa recovery codes cho agent và không gửi dữ liệu người dùng thật để debug. Nếu cần read-only production, chọn dữ liệu tối thiểu đã scrub và quyền thực sự cần. Nếu provider chỉ cấp token rộng, ghi phạm vi rủi ro và thu hồi sau tác vụ; không mô tả đó là token read-only.

### Lịch vận hành phù hợp một người — đề xuất cần chốt

- Mỗi ngày khi beta/public hoạt động: kiểm tra cảnh báo auth/RPC/queue, usage bất thường và support. Cảnh báo khẩn cần push/email ngoài app LOAN.
- Mỗi tuần và sau thay đổi nhạy cảm: xem audit đăng nhập/admin, membership tổ chức, API tokens/OAuth apps, dependency/security advisories, email deliverability và ngân sách.
- Mỗi tháng: kiểm tra recovery/restore theo vòng luân phiên, domain/billing/contact; không rotate mọi key tùy tiện nếu không có kế hoạch rollout. Khi nghi lộ credential thì rotate/thu hồi ngay theo incident runbook.
- Trước khi không thể theo dõi dài ngày: dừng onboarding hoặc thu hẹp beta, có hướng dẫn tạm ngừng an toàn. Không hứa SLA 24/7 một người không thực hiện được.

Lịch cụ thể, ngân sách, thời gian phản hồi và ngưỡng cảnh báo chưa được chủ dự án xác nhận. Phần này chi tiết hóa thời gian vận hành trong ước lượng hiện có, chưa cộng thêm nhân sự hoặc cam kết ngày ra mắt.

### Điều kiện tối thiểu bảo vệ chủ dự án trước người dùng thật

- [ ] Recovery account hoạt động khi mất máy/điện thoại chính; MFA và session/PAT inventory đã kiểm tra.
- [ ] Biết chính xác ai/công cụ nào có thể đọc database, đổi DNS và phát hành app.
- [ ] Biết thông tin cá nhân nào sẽ công khai; support dùng địa chỉ riêng và không làm lộ secret.
- [ ] Ngân sách/usage cap từng provider được hiểu, cảnh báo đã thử, có cách dừng abuse phía server.
- [ ] Backup/restore/recovery không phụ thuộc hoàn toàn vào cùng một thiết bị hoặc account đã bị mất.
- [ ] Có quy trình mất secret, sai balance, lộ dữ liệu, người dùng báo quấy rối và yêu cầu xóa.
- [ ] Có khả năng tạm ngừng nhận người dùng mới khi vượt khả năng hỗ trợ.

Các mục này bổ sung cho T01–T20; test ứng dụng pass không thay thế kiểm tra tài khoản quản trị và vận hành.
