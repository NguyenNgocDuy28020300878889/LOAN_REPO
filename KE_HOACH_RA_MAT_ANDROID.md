# LOAN — Kế hoạch đưa ứng dụng vào sử dụng thực tế

**Cập nhật:** 16/09/2026. **Nguồn lực đã xác nhận:** một người triển khai. **Thứ tự đã xác nhận:** Android trước, iOS sau.

**Tiến độ thực thi mới:** [Bằng chứng sửa lỗi và kiểm thử](app/docs/IMPLEMENTATION_SECURITY_2026_09_16.md). Đã sửa core RPC, cách ly tài khoản/JWT, PKCE/lưu phiên, idempotency/settlement và thu hồi link mời trên local. Chủ dự án đã chốt: anonymous chỉ thấy lời mời chung; trả đủ tự hủy pending có audit. Các gate cloud/device/production vẫn chưa hoàn tất.

**Bản tối ưu bảo mật:** Đọc cùng [Kế hoạch bảo mật](KE_HOACH_BAO_MAT.md), gồm threat model, SEC-01–09, 20 kịch bản test và cổng S0–S5. Bảo mật được nghiệm thu trong từng mốc. Chủ dự án đã cho phép triển khai lại; capability link đã chốt, room sau account deletion còn chờ bàn thêm. Tiến độ nằm trong báo cáo, không tự đánh dấu gate hoàn thành.

**Bổ sung vận hành thực tế:** Mục 8 kế hoạch bảo mật có OPS-01–09 về account quản trị, máy cá nhân, automation/CI, signing, hóa đơn, danh tính công khai, phishing/support và recovery. S0 kiểm tra quyền/recovery; S4/S5 cần evidence vận hành trước nhận dữ liệu thật. Chủ dự án vẫn là một người, không giả định có trực sự cố 24/7.

Đây là kế hoạch thực thi hiện hành, thay thế thứ tự và điều kiện phát hành trong kế hoạch cũ. Các tài liệu `PHASE_*` và `KE_HOACH_SHARED_LOAN_ROOM.md` giữ vai trò tham khảo/lịch sử. Công việc hoãn không được tính là hoàn thành.

**Sau APK staging:** [rà soát bổ sung](app/docs/RELEASE_READINESS_REVIEW.md) đã tái hiện lỗi crypto/schema chặn tạo khoản vay trên DB sạch và các khoảng trống idempotency/pending sau trả đủ. Ưu tiên sửa luồng RPC này trong M0, rồi cách ly cache/auth ở M1; không phải chờ staging hoạt động mới chuẩn bị/sửa các phần local độc lập. APK cần kiểm thêm quyền, backup, scheme phụ và tương thích native.

## 1. Đích đến và phạm vi Android v1

Hai người tự đăng ký, tạo và tham gia đúng khoản vay, xem cùng lịch sử, ghi nhận trả nợ và xác nhận cùng số dư. Người dùng khôi phục đăng nhập, hiểu lỗi, nhận nhắc hạn và xóa tài khoản được. Chủ ứng dụng phát hiện sự cố, hỗ trợ và khôi phục dịch vụ được.

Giữ Expo/React Native + Supabase. Mã hiện tại dùng Expo 54/React Native 0.81.5; đây là hiện trạng, không phải kết luận đã đáp ứng yêu cầu store. Kiểm tra native compatibility, dependency và target API ở M0; nâng phiên bản có mục tiêu nếu cần.

| Bắt buộc trước Android công khai                                                | Hoãn khỏi bản đầu                                          |
| ------------------------------------------------------------------------------- | ---------------------------------------------------------- |
| Email/password, xác minh email, quên mật khẩu, logout, phiên đăng nhập bền vững | iOS/TestFlight                                             |
| Google OAuth hoạt động nếu còn hiển thị; loại bỏ cần ghi quyết định phạm vi     | Web dashboard đầy đủ                                       |
| Tạo/review loan, ngày vay chọn được, ngày hạn, tên hiển thị tối thiểu           | QR scanner, avatar, đính kèm                               |
| HTTPS invite, mở app/hướng dẫn cài, join/decline, revoke/reissue                | Tự động giữ deep link qua cài đặt; bản đầu mở lại link gốc |
| Home pending/active/repaid, Loan Room, timeline, hai vai trò rõ ràng            | Sửa ngày hạn sau ACTIVE, sửa principal/currency            |
| Trả một phần/toàn bộ, confirm/dispute/cancel, xử lý tranh chấp                  | Offline mutation queue và cache tài chính lưu lâu dài      |
| Push sự kiện, nhắc hạn cơ bản, opt-out                                          | Nhắc lặp tùy chỉnh, trả góp, xuất PDF/CSV                  |
| Việt/Anh, tiền/ngày đúng, accessibility cơ bản                                  | RTL và phát hành toàn cầu cùng lúc                         |
| Xóa tài khoản, privacy, support, monitoring, backup/restore                     | Thanh toán, lãi/phí, ngân hàng, marketplace, AI            |

Giả định để ước lượng: nhóm thử tiếng Việt, Android, VND; giữ tiếng Anh và chỉ mở currency đã kiểm thử. Thị trường công khai/danh sách currency cần chủ sản phẩm chốt ở M0.

## 2. Xuất phát điểm có bằng chứng

Các dòng dưới đây ghi nhận **trước khi triển khai lại** trong ngày 16/09. Tiến độ mới: đã có harness DB, replay sạch 12 migrations và 23 SQL assertions đạt; 16 unit tests đạt. Đã sửa local lỗi NULL authorization/dispute, mapping EAS và loại file môi trường khỏi archive. DEV/STAGING đang INACTIVE, nghiệm thu binary/backend chưa đạt. Xem [báo cáo thực thi](BAO_CAO_TIEN_DO.md) để biết trạng thái mới nhất.

- Lần kiểm tra trong phiên ngày 16/09/2026: `npm run validate` đạt format, lint, TypeScript, 11 unit tests và static web export 11 routes. Không suy ra native build/backend đã hoạt động từ kết quả này.
- Có 11 migrations, RPC nghiệp vụ, màn hình chính, CI và mã Edge Function xóa tài khoản.
- Báo cáo 22/08 ghi Android EAS lỗi Gradle và migrations đã lên DEV. Chưa xác minh lại cloud; không coi thông tin cũ là trạng thái hiện tại.
- RLS hiện có checklist Markdown, chưa thấy suite DB/RLS/concurrency tự động. Edge Function bị loại khỏi TypeScript app check, cần check/test riêng.

| Khoảng trống                                                                      | Bằng chứng mã nguồn                                                     | Mốc   |
| --------------------------------------------------------------------------------- | ----------------------------------------------------------------------- | ----- |
| OAuth callback đưa URL vào hàm nhận code; chưa chọn PKCE                          | `app/src/lib/auth.ts`, `app/src/lib/supabase.ts`                        | M1    |
| Chưa có native storage adapter và refresh theo vòng đời app                       | `app/src/lib/supabase.ts`                                               | M1    |
| Cache chưa cô lập user/clear khi đổi phiên; route chưa chờ auth đầy đủ            | `app/src/providers/`, `app/src/app/loan/[id].tsx`                       | M1    |
| Client tạo key mới khi retry; backend chưa ràng buộc key với payload              | `create.tsx`, `loan/[id]/repayment.tsx`, migration `20260822063132`     | M2    |
| `dispute_repayment` thiếu `disputed_at` nhưng constraint bắt buộc                 | migrations `20260822083000`, `20260822100000`                           | M2    |
| Token có hash ở invites nhưng token thô nằm trong response cache idempotency      | `create_loan` lưu toàn bộ result qua `complete_idempotent_command`      | M2    |
| Realtime chưa invalidate repayments; subscription chỉ gọi ở Home                  | `app/src/features/loans/use-loan-realtime.ts`                           | M3    |
| Request xóa tài khoản chưa nối với thực thi; audit write chưa kiểm tra lỗi đầy đủ | `app/src/lib/auth.ts`, `app/supabase/functions/delete-account/index.ts` | M4    |
| Push mới có preferences, chưa có token/scheduler/delivery                         | `app/src/features/preferences/api.ts`, `app/package.json`               | M4    |
| EAS chưa ghi mapping môi trường; chưa có bằng chứng binary trỏ đúng backend       | `app/eas.json`, `app/src/lib/env.ts`                                    | M0/M5 |

Phát hiện SQL là kết quả đọc mã, cần tái hiện bằng database test. Ghi kế hoạch không đồng nghĩa đã sửa.

## 3. Các quyết định cần chốt ở M0

Ngoài Android trước/một người triển khai, các phương án dưới đây là **đề xuất**, chưa phải quyết định đã được người dùng phê duyệt. Ghi lựa chọn, ngày và tác động test trước khi làm phần phụ thuộc.

| Quyết định            | Phương án đề xuất                                                      | Điều kiện cần xử lý                                                                                   |
| --------------------- | ---------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------- |
| Ai dùng link mời? | Đã chốt: ai có link hợp lệ có thể đăng nhập và tham gia | Cảnh báo chuyển tiếp link, revoke/reissue; không thay membership sau accept |
| Lưu offline?          | Cache tài chính trong RAM; ghi yêu cầu online                          | Tách session token cần lưu an toàn; mở lại offline báo chưa tải được dữ liệu                          |
| Đóng room?            | REPAID kết thúc nghiệp vụ v1; hoãn CTA CLOSED                          | Giữ enum nếu cần tương thích; không dùng đóng room để sửa balance                                     |
| Repayment bị dispute? | Giữ bản cũ, cho tác giả rút và gửi bản mới có liên kết                 | Audit đầy đủ, không âm thầm sửa bản đã xác nhận, đối tác xác nhận bản mới                             |
| Một bên xóa account? | Chưa chốt: chủ dự án yêu cầu bàn thêm trước triển khai | Không triển khai policy room chỉ đọc tới khi có quyết định; vẫn sửa lỗi authorization NULL |
| Trả đủ còn pending?   | Vô hiệu đề xuất chưa xác nhận còn lại trong cùng transaction, có event | Không để nút confirm tồn tại nhưng luôn lỗi; test concurrent confirm/cancel                           |
| Thị trường/currency?  | Nhóm Việt Nam, VND trước; mở thêm khi có test                          | Currency allowlist, không cộng các loại tiền khác nhau                                                |
| Retention/support?    | Thời hạn theo loại dữ liệu, contact hỗ trợ/privacy                     | Chủ sản phẩm chốt sau rà soát áp dụng; không mặc định giữ mọi dữ liệu vĩnh viễn                       |

## 4. Lộ trình cho một người

Ước lượng là **ngày công tập trung**, gồm sửa và kiểm thử; không phải cam kết ngày phát hành. Làm một mốc phát triển chính tại một thời điểm. Khởi động account/domain/tuyển người thử ở M0 để giảm thời gian chờ cuối dự án.

### M0 — Phạm vi, staging và bản cài tối thiểu (4–6 ngày)

- [ ] RD-01: sửa lời gọi crypto đúng schema bằng migration mới; test create → preview → accept/decline trên DB sạch, thay vì chỉ dựng fixtures bằng INSERT. Nghiệm thu cả core flow và negative authorization.
- [ ] RD-05: kiểm kê manifest thực tế, quyền thừa/backup/dev scheme; xác minh RELRO/16 KB bằng công cụ chuẩn và thiết bị trước release candidate. Target SDK đạt không thay các kiểm tra này.

- [ ] Đạt S0: data map, trust boundaries, inventory ACL/secret/exposed APIs; quyết định recipient preview, session revocation và retention. Bật MFA tài khoản vận hành, xác định nơi lưu recovery codes.
- [x] Dựng harness DB, tái hiện SEC-01 và dispute bằng dữ liệu giả; sửa và chạy regression local. Chưa nghiệm thu remote hoặc toàn bộ ma trận bảo mật.

- [ ] Chốt mục 3, thiết bị/OS và currency hỗ trợ.
- [ ] Kiểm tra quyền Supabase/EAS/Google Cloud/Play; lấy lỗi đầu tiên Run gradlew, tái hiện và sửa nếu còn lỗi.
- [x] Có local Supabase config, fixtures tổng hợp trong transaction test; replay sạch 12 migrations, 23 assertions đạt. Không cần seed dữ liệu tài chính lâu dài.
- [ ] Mapping DEV/STAGING/PRODUCTION theo [ENVIRONMENTS.md](app/docs/ENVIRONMENTS.md); kiểm tra backend/redirect không chéo môi trường.
- [ ] Android preview cài được và login email trên staging. Nếu dùng development client, bổ sung dependency/cấu hình cần thiết.
- [ ] Kiểm tra loại tài khoản Play, điều kiện testing, domain và email gửi xác thực; lập bảng chi phí thực tế.

**Nghiệm thu:** build ID/APK cài được, log migration sạch, mapping môi trường có bằng chứng và phạm vi đã ghi. Không thêm tính năng khi native build còn chặn.

### M1 — Đăng nhập và cách ly dữ liệu (5–7 ngày)

- [ ] Đạt S1: secure native storage, callback/PKCE negative tests, JWT cũ và Realtime sau thu hồi phiên, response cũ sau đổi account; không chỉ kiểm happy path login.

- [ ] Email confirmation/resend có giới hạn, reset password, logout, tên hiển thị; không coi signup chưa có session là đã login.
- [ ] Google OAuth thống nhất flow, parse callback đúng, xử lý lỗi/hủy; cold/warm start về đúng invite, return path được kiểm tra.
- [ ] Native session storage phù hợp, refresh foreground/background/relaunch; tránh chờ API trong auth callback gây chờ lẫn nhau.
- [ ] Query keys gắn user; cancel request, clear cache và unsubscribe khi logout/đổi user; protected screen chờ hydrate.
- [ ] Email gửi thật, redirect allowlist, kiểm soát abuse; lỗi Việt/Anh có hành động khắc phục.

**Nghiệm thu:** email/reset/Google/relaunch pass; A logout rồi B login cùng máy không thấy dữ liệu A, kể cả request A trả về muộn.

### M2 — Database, toàn vẹn giao dịch và lời mời (8–12 ngày)

- [ ] Đạt S2: đóng SEC-01–05 bằng evidence; NULL-safe authorization, inventory/default ACL, caller/account/session/membership check cả trước trả cached response.
- [ ] Rate limit/quota trên đường server không bypass bằng direct RPC; receipt idempotency không bị cleanup thành tạo lại giao dịch. Tối thiểu hóa thông tin preview theo policy capability link; không dùng email binding.

- [x] Test tái hiện rồi sửa `disputed_at` bằng migration mới; đạt local, còn chờ triển khai/nghiệm thu staging.
- [ ] Cùng command giữ key khi retry; thay nội dung tạo command mới. Backend fingerprint payload, từ chối cùng key khác payload.
- [ ] Bảo vệ/lifetime response cache chứa invite token; không tuyên bố chỉ lưu hash khi cache còn token thô. Revoke vô hiệu cả token trả từ cache.
- [ ] Capability link theo quyết định chủ dự án; revoke/reissue, expiry, replay, self-join/self-decline, accept/decline đồng thời; người nhận có thể là bất kỳ account giữ token hợp lệ, sau join membership cố định.
- [ ] Test grants, SECURITY DEFINER/search_path, RLS, private schema và direct writes bằng anon, A/B participants, C outsider.
- [ ] Đồng nhất client/server validation: safe integer khi qua JavaScript, allowlist currency, ngày hợp lệ, giới hạn note; gọi RPC trực tiếp để thử bypass UI.
- [ ] Test confirm đồng thời, confirm-vs-cancel, overpayment, retry sau commit mất response; mỗi command chỉ một effect/event.
- [ ] Triển khai policy dispute, trả đủ còn pending, participant bị xóa; không chỉ ẩn nút phía client.

**Nghiệm thu:** DB/RLS/concurrency suite chạy trên DB sạch trong CI; không balance âm, self-confirm, truy cập chéo hoặc event trùng trong ma trận. Có log và migration head.

### M3 — Luồng thực tế trên hai thiết bị (5–7 ngày)

- [ ] Đạt S3: kiểm tra Realtime outsiders/session cũ, HTTPS link preview bot, Play signing fingerprint, landing headers và token trong access log; không chỉ xác nhận mở đúng màn hình.

- [ ] Review có hai vai trò, amount, ngày vay chọn được, ngày hạn, người nhận; hủy share không báo đã gửi.
- [ ] Home pending/declined/active/repaid đúng hợp đồng API; tìm lại loan vừa tạo và cấp lại invite thay vì tạo trùng.
- [ ] HTTPS landing/App Links xác minh domain; đã/chưa cài đều có hướng đi; sau cài mở lại link. Token không vào analytics/log/referrer bên thứ ba.
- [ ] Room tự subscribe theo user/room; invalidate repayments/room/list/timeline; refetch reconnect/foreground để bù event bị lỡ.
- [ ] Review submit/confirm, khóa nút khi gửi; phân biệt lỗi với empty state, retry rõ; mất mạng báo dữ liệu có thể cũ.
- [ ] Việt/Anh, ngày/tiền/trạng thái/người đã xóa và screen-reader; date-only theo ngày địa phương, không lấy UTC làm hôm nay vô điều kiện.
- [ ] Thử UX ít nhất 5 người, cả lender tạo và borrower tạo; ghi từng case, không suy ra tỷ lệ thống kê từ mẫu nhỏ.

**Nghiệm thu:** A tạo → B mở link/login/join → submit/confirm/dispute → trả đủ pass hai thiết bị; mở thẳng room vẫn đồng bộ. Mục tiêu nội bộ: hội tụ trong 5 giây trên mạng ổn định, refetch khi resume. Sửa và thử lại mọi nhầm vai trò/số dư.

### M4 — Xóa tài khoản, thông báo và vận hành (8–11 ngày)

- [ ] Đạt S4: fresh re-auth server, deletion claim/lease và reconciliation sau crash, không dùng JWT refresh time thay lần xác thực; chống race deletion-vs-confirm.
- [ ] Có retention/deletion suppression sau restore; secret scan redacted, CI/release permissions, dependency triage và canary telemetry tests; diễn tập kill switch với app cũ.

- [ ] Nối UI với thực thi xóa, re-auth, trạng thái/retry; check lỗi audit/update và quyền private schema của Edge Function; check/test function riêng.
- [ ] Test xóa với mọi trạng thái loan/repayment; chặn truy cập bằng session cũ, xóa push token; kiểm tra PII trong note/metadata/cache/backup theo retention.
- [ ] Push token registry theo user/device, permission Android thật, token refresh/logout cleanup.
- [ ] Outbox/job cho accepted/submitted/confirmed/disputed; scheduler nhắc hạn theo timezone; check preference lúc gửi, dedup, retry giới hạn, receipts/token hết hiệu lực.
- [ ] Push trung lập, mặc định không hiện tiền/tên trên màn hình khóa; mở đúng room và kiểm tra quyền lại; không hứa delivery exactly-once.
- [ ] Sentry release/source map, scrub email/token/note/amount; log không chứa payload tài chính.
- [ ] Health/cảnh báo RPC/job/deletion, contact hỗ trợ và chặn financial writes từ server khi sự cố.
- [ ] Backup tự động, diễn tập restore môi trường riêng, đối chiếu balance/event. Mục tiêu đề xuất RPO ≤24 giờ, RTO ≤8 giờ; chủ sản phẩm chấp nhận hoặc chọn mức tốt hơn trước dữ liệu thật.

**Nghiệm thu:** deletion E2E; push opt-out/timezone/dedup/deep link; scrubbed Sentry event/source map và restore đều có bằng chứng. Restore DB cũ không phải rollback app thông thường vì có thể mất giao dịch mới.

### M5 — Closed beta với người dùng thật (4–6 ngày chuẩn bị + 2–3 tuần quan sát)

- [ ] Production từ migration đã test; monitoring/backup/email/push hoạt động. Dữ liệu giả ở staging; người dùng thật dùng production kể cả app closed testing.
- [ ] APK/internal build cho QA; AAB signed cho Play closed track. Icon/splash riêng, screenshots, mô tả shared record, support/reviewer access.
- [ ] Privacy/Terms công khai, hướng dẫn/yêu cầu xóa dữ liệu; Data Safety/audience/content và biểu mẫu Play áp dụng theo chức năng/SDK thực tế.
- [ ] Tuyển 10–15 cặp là mục tiêu nghiên cứu, chưa phải nguồn lực đã có. Tester không được giả định là nhân sự QA chuyên trách.
- [ ] Thu phản hồi có cấu trúc; đo join, lỗi auth/repayment/sync/crash và support; analytics không chứa email, amount hoặc invite token.
- [ ] Hoàn tất closed testing/production access theo loại tài khoản; không đồng nhất yêu cầu store với số người thử sản phẩm.

**Cổng vào dữ liệu thật:** M0–M4 và S0–S5 đạt cho release candidate, không P0/P1 hoặc rủi ro nghiêm trọng chưa phân loại; evidence cho 20 kịch bản bảo mật, privacy/deletion/backup và binary/cloud config thực tế. Pilot không thay security test. Có thể internal alpha bằng dữ liệu giả trước đó. Review độc lập SQL/deletion/token được khuyến nghị trước public; nếu chưa có thì ghi rõ giới hạn, không nhận là đã pentest.

**Cổng ra:** ít nhất 10 cặp hoàn thành core flow; ghi số thành công/tổng lượt, không P0/P1 mở; lỗi balance/privacy có root cause và regression test; đã thử cập nhật beta. Quan sát quay lại cập nhật loan 2–3 tuần. Chưa đủ mẫu/ít phát sinh repayment thì kéo dài, không suy retention từ lượt cài.

### M6 — Android công khai (2–3 ngày chuẩn bị + ít nhất 1 tuần theo dõi)

- [ ] Kiểm tra lại S5 và các security tests bị ảnh hưởng bởi thay đổi trong beta; kiểm soát phiên bản/migrations và incident contact thực tế cho mô hình một người.

- [ ] Build đã qua beta, production access và hồ sơ hoàn chỉnh; reviewer có tài khoản/hướng dẫn thử hai bên.
- [ ] Kiểm tra store/target API lại lúc submit. Release record có build ID, commit SHA, migration head, môi trường và kết quả test.
- [ ] Nếu Play hỗ trợ staged rollout cho loại release đó thì tăng từng bước; nếu không giới hạn phạm vi ban đầu. Không giả định first release có cùng cơ chế rollout như update.
- [ ] Sai balance/lộ dữ liệu: dừng mở rộng, chặn ghi server, giữ log đã scrub, điều tra/forward-fix; không âm thầm sửa audit.
- [ ] Theo dõi support, chi phí và sự cố; mở kế hoạch iOS sau khi Android ổn định và có bằng chứng sử dụng.

**Hoàn thành Android v1:** bản công khai cài được, core E2E pass trên bản phát hành, không lỗi chặn và đã theo dõi ít nhất một tuần. Chủ dự án chịu trách nhiệm xử lý sự cố.

## 5. Thời gian và nguồn lực

| Hạng mục                                      | Ước lượng                                    |
| --------------------------------------------- | -------------------------------------------- |
| M0–M4: chức năng và cổng bảo mật              | 30–43 ngày công                              |
| M5–M6: chuẩn bị beta/phát hành                | 6–9 ngày công                                |
| Tổng trước dự phòng                           | 36–52 ngày công                              |
| Dự phòng build/auth/migration/sửa beta 25–30% | Khoảng 9–16 ngày công                        |
| Khoảng lập kế hoạch tổng                      | 45–68 ngày công, cộng quan sát/chờ xét duyệt |

Một người gần toàn thời gian: dự trù **12–18 tuần**, điều chỉnh sau M0/M2; xét duyệt, thay đổi thiết kế session hoặc lỗi lớn có thể kéo dài. Nếu 15–20 giờ/tuần: khoảng **5–8 tháng**. Đây là ước lượng đã tăng cho security tests/incident/restore, không cộng thêm lần nữa toàn bộ tài liệu bảo mật. Chưa có cam kết giờ làm/ngày bắt đầu nên không đặt deadline lịch cứng.

Chủ dự án giữ vai trò sản phẩm/phát triển/vận hành. Người dùng thử, rà soát privacy/store hoặc đánh giá bảo mật độc lập là nguồn lực cần tìm khi cần, không giả định đã có đội QA/DevOps.

Trước trả phí, lấy báo giá thực tế cho Supabase/backup, EAS, Sentry, email, domain, Play và thiết bị; chốt ngân sách tháng/cảnh báo usage. Chưa đưa giá chưa kiểm chứng vào kế hoạch; Apple Developer để mốc iOS.

## 6. Theo dõi và nghiệm thu

- Trạng thái: chưa làm / đang làm / chờ bên ngoài / đã kiểm chứng. “Có code” không bằng “đã kiểm chứng”.
- Mỗi việc xong ghi task, commit, môi trường, test command/case, ngày và artifact/log đã scrub vào `BAO_CAO_TIEN_DO.md`.
- P0: lộ dữ liệu, sai balance, bypass quyền, ghi trùng. P1: chặn login/join/repayment/deletion/sync. P2: lỗi nhỏ không làm sai dữ liệu/chặn luồng. P0/P1 đóng trước release.
- CI: format/lint/types/unit; DB migrations/RLS/RPC regression bổ sung M2; Edge Function check/test riêng. Native E2E theo build ứng viên/trước release.
- Mốc tiếp theo chỉ mở khi phụ thuộc đạt; chuẩn bị account/domain/tester khi chờ, không thêm feature để né blocker.

**Ưu tiên hiện tại:** APK staging đã build được; sửa RD-01/core RPC smoke, RD-02/cách ly cache và M1, rồi RD-03/idempotency cùng inventory ACL. Khôi phục staging để nghiệm thu đăng nhập và hai thiết bị. Những chính sách sản phẩm chưa chốt vẫn để mở; phát hiện chẩn đoán chưa được coi là đã sửa.

## 7. iOS sau Android

Mốc riêng sau M6: native compatibility, storage, Apple/Google login, Universal Links, APNs/push, deletion, accessibility và máy thật; Apple Developer/signing/TestFlight/privacy/reviewer access. Đánh giá Login Services mục 4.8 trước giữ Google login; Apple Sign In là phương án cần xem xét, không mặc định được miễn vì có email/password. [Apple App Review Guidelines](https://developer.apple.com/app-store/review/guidelines/)

## 8. Ràng buộc bên ngoài đã đối chiếu

- EAS dùng `development`, `preview`, `production`; mapping `preview` sang app `staging`. Giá trị nhúng client luôn công khai dù biến có visibility secret. [Expo EAS environment variables](https://docs.expo.dev/eas/environment-variables/)
- Native auth cần storage và refresh theo vòng đời; hướng dẫn chính thức để đối chiếu, test thật quyết định nghiệm thu. [Supabase React Native Auth](https://supabase.com/docs/guides/auth/quickstarts/react-native)
- Play cá nhân tạo sau 13/11/2023 hiện cần ít nhất 12 tester opted-in liên tục 14 ngày trước xin production access. Không áp dụng cho mọi loại account; kiểm tra lại dashboard/quy định lúc release. [Google Play testing requirements](https://support.google.com/googleplay/android-developer/answer/14151465)

Nguồn mở kiểm tra trong phiên 16/09/2026; không xác nhận cấu hình cloud hay trạng thái tài khoản LOAN.
