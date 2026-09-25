# Kế hoạch đóng các mục chưa đạt — Google Play bước 5–8

Cập nhật: 25/09/2026  
Nguồn đầu vào: [Rà soát bước 5–8](GOOGLE_PLAY_RECHECK_5_8_2026_09_25.md)

## 1. Mục tiêu và nguyên tắc nghiệm thu

Mục tiêu là đưa bước 5–8 từ trạng thái “đã có code/tài liệu” sang trạng thái có bằng chứng chạy thực tế, đủ để phát hành closed testing và xin quyền production.

Thực hiện theo thứ tự bắt buộc:

```text
G0 Chốt phạm vi
  → G1 Xóa tài khoản an toàn
  → G2 Backend production vận hành được
  → G3 Artifact Android đạt chuẩn
  → G4 Hồ sơ Play khớp ứng dụng
  → G5 Closed testing đủ điều kiện
```

Không đóng một cổng chỉ bằng unit test, build thành công hoặc tài liệu hướng dẫn. Mỗi cổng phải có đủ code/cấu hình, kiểm thử đường thành công và đường từ chối, bằng chứng runtime, cùng tài liệu phản ánh đúng hành vi đang phát hành.

## 2. Các quyết định cần chốt trước khi sửa

| ID  | Quyết định                                      | Khuyến nghị                                                                                                                                         | Người chốt | Tác động nếu chưa chốt                                |
| --- | ----------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------- | ---------- | ----------------------------------------------------- |
| D1  | Chủ thể vận hành, email support và domain chuẩn | Dùng một danh tính và một email support hoạt động trên website, policy và Play Console; ưu tiên domain `loan.duyhaohan.id.vn`                       | Chủ dự án  | Không thể hoàn tất Privacy Policy và Store Listing    |
| D2  | Dữ liệu lịch sử giữ lại sau khi xóa             | Giữ bản ghi tài chính đã tất toán cho đối tác, xóa khóa định danh và làm sạch nội dung tự do có thể chứa PII; ghi rõ lý do và thời hạn              | Chủ dự án  | Không thể hoàn thiện migration, policy và Data Safety |
| D3  | Backup production                               | Chọn daily backup hoặc mua PITR add-on theo RPO/RTO thực tế; không mô tả Pro mặc định có PITR                                                       | Chủ dự án  | Không thể nghiệm thu khôi phục                        |
| D4  | Phạm vi release của Email OTP và push           | Bản đầu chỉ quảng bá tính năng đã bật và nghiệm thu. Nếu giữ `EMAIL_OTP_READY=false`, `PUSH_READY=false`, loại chúng khỏi listing/kịch bản reviewer | Chủ dự án  | Hồ sơ và app tiếp tục không nhất quán                 |
| D5  | Điều kiện tài khoản Play                        | Xác nhận loại tài khoản, ngày tạo và Console đang yêu cầu bao nhiêu tester; vẫn tuyển mục tiêu 20 để giữ dư địa trên mức 12                         | Chủ dự án  | Không thể xác định chính xác cổng closed testing      |

Không ghi mật khẩu, OTP, service-role key, database password hoặc credential reviewer vào repository hay tài liệu này.

## 3. G1 — Đóng bước 5: xóa tài khoản và chính sách dữ liệu

### 3.1. Sửa tính nguyên tử và cạnh tranh

- [ ] Viết **migration mới**, không sửa migration `20260924110000_account_deletion_execution.sql` đã có.
- [ ] Tạo khóa giao dịch dùng chung cho thay đổi nghĩa vụ của một tài khoản. Các RPC tài chính ghi dữ liệu và `claim_account_deletion` phải lấy cùng khóa theo UUID tài khoản, theo thứ tự ổn định nếu có hai người tham gia.
- [ ] Khi request ở `PROCESSING` hoặc `COMPLETED`, chặn tạo khoản vay, nhận lời mời, quản lý lời mời, gửi/xác nhận/tranh chấp/hủy trả nợ và đăng ký push mới cho tài khoản đó.
- [ ] Trong `claim_account_deletion`, lấy khóa trước khi tính blockers và chuyển trạng thái sang `PROCESSING`, để không có nghĩa vụ mới chen giữa hai thao tác.
- [ ] Giữ idempotency: retry cùng yêu cầu không tạo thêm xóa, audit hoặc thay đổi số dư.

RPC phải rà soát: `create_loan`, `accept_loan_invite`, `respond_to_invite`, `manage_loan_invite`, `submit_repayment`, `confirm_repayment`, `dispute_repayment`, `cancel_repayment` và các RPC ghi dữ liệu khác được phát hiện khi duyệt schema hiện hành.

### 3.2. Phục hồi audit sau khi Auth đã xóa

- [ ] Không trả `success: true` nếu `finish_account_deletion` thất bại.
- [ ] Thêm cơ chế reconciliation có quyền `service_role`: tìm claim `PROCESSING` quá hạn, kiểm tra user còn tồn tại trong Auth, rồi hoàn tất audit nếu Auth đã xóa hoặc retry theo giới hạn nếu chưa xóa.
- [ ] Mỗi lần retry ghi lý do, số lần và thời điểm; không log email, token hoặc nội dung tài chính.
- [ ] Thêm cảnh báo khi có request `PROCESSING` quá ngưỡng hoặc `FAILED` lặp lại.

### 3.3. Hoàn thiện kiểm thử

- [ ] Sửa lệch `plan(24)`/23 assertions bằng assertion có ý nghĩa; không chỉ đổi con số plan.
- [ ] Bổ sung pgTAP cho blocker `DRAFT`, `PENDING`, `ACTIVE`, repayment `PENDING`, `DISPUTED`, quyền `service_role`, stale reclaim và idempotent retry.
- [ ] Bổ sung concurrency test: thao tác tài chính và deletion chạy đồng thời, chỉ một phía được phép commit.
- [ ] Chạy Edge Function end-to-end trên local hoặc staging bằng tài khoản tổng hợp: eligible deletion, blocked deletion, stale processing, lỗi Auth Admin và lỗi finish audit.
- [ ] Xác minh sau xóa: Auth/profile/push/preferences biến mất; lịch sử chung còn đọc được bởi đối tác; actor đã ẩn danh; dữ liệu tự do được xử lý đúng D2.

### 3.4. Đồng bộ chính sách

- [ ] Thay mọi placeholder trong `PRIVACY_POLICY.md`, `ACCOUNT_DELETION.md` và trang web bằng thông tin D1.
- [ ] Mô tả chính xác dữ liệu xóa, dữ liệu giữ, mục đích giữ, thời hạn giữ và ảnh hưởng của backup theo D2–D3.
- [ ] Thống nhất URL xóa tài khoản, email support và tên chủ thể trên website, Store Listing và Play Console.
- [ ] Kiểm tra lại trang xóa bằng Playwright ở desktop/mobile, cả chưa đăng nhập, bị blocker, fresh re-auth, thành công và lỗi.

**Cổng G1 đạt khi:** toàn bộ SQL/unit/concurrency/E2E xanh; một tài khoản staging bị xóa thật và đối tác vẫn thấy lịch sử đã ẩn danh; reconciliation được kiểm thử; policy không còn placeholder hoặc tuyên bố rộng hơn hành vi.

**Bằng chứng lưu:** migration mới, kết quả pgTAP/concurrency, log Edge Function đã lọc, ID tài khoản tổng hợp đã xóa, ảnh/chụp Playwright và checklist dữ liệu trước/sau.

## 4. G2 — Đóng bước 6: backend production và vận hành

### 4.1. Xác minh cloud có kiểm soát

- [ ] Đối chiếu `supabase migration list`/schema production với toàn bộ migration local; chỉ áp dụng migration mới sau khi dry-run trên staging.
- [ ] Chạy regression SQL trên production trong transaction rollback, không giữ fixture.
- [ ] Mở rộng cloud check cho `repayments`, các RPC nhạy cảm và RLS ba vai trò: thành viên A, thành viên B, outsider; không chỉ kiểm tra anonymous.
- [ ] Xác minh Google OAuth production: provider, redirect URI, consent audience và callback cold/warm start bằng tài khoản thử.
- [ ] Deploy `delete-account` và reconciliation sau khi G1 đạt; chạy canary bằng dữ liệu tổng hợp.

### 4.2. Backup, khôi phục và giám sát

- [ ] Ghi nhận loại backup thực tế theo D3, retention, RPO/RTO và người có quyền restore.
- [ ] Thực hiện restore drill vào project cô lập; đối soát migration, số lượng bản ghi, tổng số dư và danh sách tài khoản đã xóa trước khi kết luận đạt.
- [ ] Cấu hình cảnh báo thực cho API 5xx, Auth spike, database resource và deletion failure; gửi canary và xác nhận người trực nhận được.
- [ ] Gửi Sentry canary vô hại, xác minh release/source maps và kiểm tra payload không chứa email, URL token, số tiền hoặc nội dung ghi chú.
- [ ] Thử kill-switch trên staging, sau đó khôi phục quyền và xác minh đọc vẫn hoạt động trong thời gian chặn ghi.
- [ ] Cập nhật `PRODUCTION_OPERATIONS.md`: bỏ tuyên bố PITR mặc định, đánh dấu từng mục bằng ngày và bằng chứng thay vì mô tả dự kiến.

**Cổng G2 đạt khi:** migration cloud khớp, regression rollback và RLS đa tài khoản đạt, OAuth/deletion canary đạt, restore drill thành công, alert/Sentry canary được nhận, runbook phản ánh cấu hình thật.

**Bằng chứng lưu:** migration list đã che secret, kết quả SQL rollback, ma trận RLS, OAuth/deletion test log, restore drill report, alert/Sentry event IDs và checklist runbook.

## 5. G3 — Đóng bước 7: AAB và nghiệm thu Android

### 5.1. Tạo release candidate mới

- [ ] Sau G1–G2, khóa commit ứng viên và chạy `npm run validate` cùng toàn bộ SQL/concurrency/browser tests.
- [ ] Dùng Context7/tài liệu Expo chính thức để kiểm tra khả năng target API 36 của phiên bản đang dùng. Nếu SDK 54 không tạo `targetSdkVersion=36`, lập nhánh nâng Expo/RN riêng và kiểm thử native đầy đủ.
- [ ] Tạo AAB production mới từ commit đã khóa; ghi build ID, commit SHA, versionCode, artifact hash và cấu hình môi trường đã che secret.
- [ ] Tải artifact và đọc manifest thực tế để xác minh package, versionCode, target SDK 36, `allowBackup=false`, permissions, intent filter và không có dev scheme/config.
- [ ] Kiểm tra ABI 64-bit và 16 KB page-size trên thư viện native trong artifact bằng công cụ Android chính thức hoặc Play Console pre-launch report.

### 5.2. Sửa App Links và thử bản Play ký

- [ ] Lấy SHA-256 **Play App Signing certificate** từ Play Console, không dùng upload-key fingerprint.
- [ ] Sinh lại `assetlinks.json`, deploy lên domain chuẩn và xác minh HTTP 200, JSON content type, không redirect, không còn fingerprint số 0.
- [ ] Sau khi upload AAB vào Internal testing, cài đúng bản Play ký và kiểm tra `pm verify-app-links`, cold start, warm start, app chưa cài, link hết hạn/thu hồi/đã dùng.

### 5.3. Ma trận nghiệm thu thiết bị

- [ ] Tối thiểu hai thiết bị/phiên bản Android: cài mới, đăng nhập Google, hai tài khoản tạo–nhận lời mời, repayment, tranh chấp, tất toán, xóa tài khoản và đổi tài khoản.
- [ ] Kiểm tra nâng cấp từ versionCode cũ sang release candidate: phiên hợp lệ, SecureStore, dữ liệu local, notification preference và deep link.
- [ ] Chỉ kiểm thử push/Email OTP nếu D4 chọn bật và credential production đã cấu hình. Nếu tắt, xác minh UI và Store Listing không quảng bá chúng.
- [ ] Kiểm tra crash/ANR, console/network và pre-launch report; không còn lỗi chặn.

**Cổng G3 đạt khi:** AAB khớp commit và backend production, target API/64-bit/16 KB đạt trên artifact, App Links được Android xác minh bằng bản Play ký, ma trận cài mới/cập nhật và hành trình hai tài khoản đạt.

**Bằng chứng lưu:** AAB hash/manifest report, Play signing fingerprint đã công khai, kết quả App Links/ADB, ma trận thiết bị, pre-launch report và internal-testing release ID.

## 6. G4 — Đóng phần chuẩn bị của bước 8: hồ sơ Play

- [ ] Sửa `GOOGLE_PLAY_STORE_LISTING.md`: yêu cầu tối thiểu 12 tester liên tục 14 ngày cho tài khoản thuộc diện áp dụng; giữ mục tiêu tuyển 20.
- [ ] Chỉnh Store Listing theo D4; không quảng bá Email OTP/push nếu release production tắt chúng.
- [ ] Đối chiếu Data Safety từ data inventory thực tế: email, tên/avatar, user IDs, financial data, free-text, push token, crash data và các bên xử lý Supabase/Google/Expo/Sentry.
- [ ] Thay `[DOMAIN]`, email khác nhau và placeholder trong mọi policy; ưu tiên URL domain chính thức.
- [ ] Chuẩn bị App Access bằng hai tài khoản reviewer hoạt động, không phụ thuộc OTP hết hạn hoặc 2FA tương tác. Credential chỉ nhập vào Play Console; kiểm thử lại từ thiết bị sạch.
- [ ] Chuẩn bị icon, feature graphic, phone screenshots cho cả ngôn ngữ; ảnh phải đúng UI của release candidate.
- [ ] Hoàn tất Ads, Target audience, Content rating, Financial features, Account deletion và Data Safety trong Console; lưu bản xuất/ảnh chụp để đối chiếu.
- [ ] Một người độc lập chạy đúng reviewer instructions từ đầu đến cuối trước khi gửi closed testing.

**Cổng G4 đạt khi:** nội dung repo, website, binary và các khai báo Console nhất quán; reviewer đăng nhập và hoàn tất hành trình; không còn placeholder; toàn bộ asset được Console chấp nhận.

## 7. G5 — Thực hiện closed testing và xin quyền production

- [ ] Xác nhận yêu cầu hiển thị trên chính Play Console theo D5.
- [ ] Tạo Closed testing release từ đúng AAB đã nghiệm thu ở G3; không thay binary giữa chừng nếu không cần sửa lỗi.
- [ ] Mời mục tiêu 20 testers và theo dõi để luôn có ít nhất mức Console yêu cầu opt-in liên tục đủ 14 ngày.
- [ ] Giao kịch bản theo nhóm ngày nhưng yêu cầu tester dùng tính năng thực, không chỉ giữ trạng thái opt-in.
- [ ] Ghi phản hồi, thiết bị/Android version, crash/ANR và lỗi chức năng; phân loại P0/P1/P2 và liên kết bản sửa.
- [ ] Với mỗi build thay thế, chạy lại smoke test đăng nhập, lời mời, repayment, App Links và deletion; cập nhật release notes.
- [ ] Khi đủ điều kiện, chuẩn bị câu trả lời xin production dựa trên dữ liệu thật: cách tuyển tester, mức sử dụng, phản hồi, thay đổi đã làm và lý do sẵn sàng.

**Cổng G5 đạt khi:** Console xác nhận đủ tester/thời gian, không còn P0/P1, crash/ANR nằm trong ngưỡng đã chốt, phản hồi đã được xử lý và bộ câu trả lời production access có bằng chứng.

## 8. Thứ tự triển khai theo work package

| Thứ tự | Work package                                               | Phụ thuộc                      | Ai thực hiện chính                                     | Kết quả                   |
| ------ | ---------------------------------------------------------- | ------------------------------ | ------------------------------------------------------ | ------------------------- |
| 1      | WP-0 chốt D1–D5 và tạo bảng bằng chứng                     | Không                          | Chủ dự án + trợ lý                                     | Phạm vi release cố định   |
| 2      | WP-1 migration khóa/guard deletion                         | D2                             | Trợ lý                                                 | Loại khoảng hở cạnh tranh |
| 3      | WP-2 reconciliation và test deletion E2E                   | WP-1                           | Trợ lý; cần quyền staging để deploy                    | G1 kỹ thuật đạt           |
| 4      | WP-3 policy deletion/retention                             | D1–D3, WP-2                    | Trợ lý + chủ dự án duyệt                               | G1 tài liệu đạt           |
| 5      | WP-4 cloud schema/RLS/OAuth/deletion verification          | G1                             | Trợ lý; cần quyền cloud và thiết bị                    | Phần backend G2 đạt       |
| 6      | WP-5 backup restore/alert/Sentry drill                     | D3, WP-4                       | Chủ dự án cấp dịch vụ; trợ lý thực thi/ghi bằng chứng  | G2 đạt                    |
| 7      | WP-6 target API 36 và release candidate AAB                | G2                             | Trợ lý; cần EAS/Play credentials đã cấu hình           | Artifact ứng viên         |
| 8      | WP-7 App Links + internal/device testing                   | WP-6, Play signing fingerprint | Trợ lý + chủ dự án cung cấp thiết bị/Console           | G3 đạt                    |
| 9      | WP-8 policy, Data Safety, listing, assets, reviewer access | D1/D4/D5, G3                   | Trợ lý + chủ dự án nhập credential/Console             | G4 đạt                    |
| 10     | WP-9 closed testing và production-access dossier           | G4, testers                    | Chủ dự án quản lý tester; trợ lý theo dõi lỗi/tài liệu | G5 đạt                    |

## 9. Definition of Done chung

Một mục chỉ chuyển sang `[x]` khi có:

1. Thay đổi hoặc cấu hình cụ thể, có thể truy vết.
2. Kiểm thử phù hợp với rủi ro, gồm ít nhất một đường từ chối/bảo mật.
3. Bằng chứng runtime trên đúng môi trường/binary mục tiêu.
4. Tài liệu và khai báo Play khớp hành vi thực tế.
5. Không còn secret trong log, tài liệu hoặc artifact kiểm thử.

Nếu một cổng thất bại, sửa tại cổng đó rồi chạy lại kiểm tra chịu ảnh hưởng. Không tiếp tục đánh dấu cổng sau là hoàn thành dựa trên bằng chứng của binary hoặc cấu hình cũ.
