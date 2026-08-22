# Phase 0 — Product Lock: Loan

**Trạng thái:** Hoàn tất có điều kiện  
**Mục đích:** Chốt các quy tắc sản phẩm trước khi thiết kế UX hoặc triển khai mã nguồn.

## 1. Product brief

### Vấn đề

Các khoản vay cá nhân thường được hai bên ghi nhận riêng, tạo ra số dư và lịch sử không thống nhất.

### Giải pháp

Loan là một **Loan Room** chung cho đúng hai người: lender và borrower. Hai bên xem cùng điều khoản, timeline và chỉ coi một sự kiện tài chính là có hiệu lực sau khi phía còn lại xác nhận.

### Value proposition

> One loan. Two people. One shared record.

### MVP thesis

Loan là shared record, không phải ngân hàng, ví điện tử, nền tảng cho vay, marketplace hay công cụ thu hồi nợ.

### Người dùng mục tiêu

Người trưởng thành quản lý khoản vay cá nhân nhỏ hoặc vừa với bạn bè, người thân, roommate, đồng nghiệp hoặc người quen đã có quan hệ ngoài đời.

### Không thuộc MVP

- Lãi suất, APR, phí trễ hạn.
- Xử lý thanh toán, ví, kết nối ngân hàng.
- Khoản vay giữa người lạ, marketplace, credit scoring, collection.
- Nhiều borrower/lender, chia chi tiêu nhóm, crypto, AI chatbot.

## 2. Định danh sản phẩm

| Hạng mục | Giá trị | Trạng thái |
|---|---|---|
| Tên hiển thị | `Loan` | Đã chốt |
| Repository | `NguyenNgocDuy28020300878889/LOAN_REPO` | Đã chốt |
| Android application ID | `com.loanappmobiles.loanapp` | Đã cấu hình EAS/Expo; cần kiểm tra store/trademark trước public launch |
| iOS bundle identifier | `com.loanappmobiles.loanapp` | Đã cấu hình EAS/Expo; cần Apple Developer verification trước iOS release |
| URL scheme | `loan` | Đã dùng cho deep link/Auth callback; cần kiểm tra redirect production trước beta |

## 3. Terminology glossary

| Thuật ngữ | Nghĩa chuẩn | Không dùng thay thế bằng |
|---|---|---|
| Loan Room | Không gian chung cho một khoản vay | sổ nợ cá nhân |
| Lender | Người cho vay | creditor / receivable owner |
| Borrower | Người đi vay | debtor |
| Principal | Số tiền gốc của khoản vay | balance |
| Remaining | Principal trừ tổng repayment đã `CONFIRMED` | debt (trong UI trung lập) |
| Repayment | Một lần trả nợ được ghi nhận | payment đã hoàn tất khi còn pending |
| Proposal | Thao tác do một bên đề xuất, chờ bên kia xử lý | thay đổi đã áp dụng |
| Confirmed | Được phía còn lại xác nhận, có hiệu lực | merely submitted |
| Disputed | Cần hai bên rà soát; không làm đổi balance | fraud / false |
| Timeline | Audit history chung, theo thời gian | editable note |

## 4. Domain rules bất biến

1. Một loan ở MVP có đúng một `LENDER` và một `BORROWER`; hai user phải khác nhau.
2. `principal_minor` và mọi repayment amount dùng integer minor units, không dùng float.
3. Một loan chỉ có một currency; currency và principal không được sửa khi `ACTIVE`.
4. Chỉ repayment có `status = CONFIRMED` mới làm đổi Remaining.
5. Người tạo repayment không được xác nhận hoặc dispute repayment đó.
6. Tổng repayment đã confirmed không vượt principal; overpayment bị từ chối.
7. Mọi financial command phải chạy server-side, atomically, kèm `idempotency_key` duy nhất.
8. Client không optimistic-update balance cho financial command; hiển thị trạng thái đang xử lý rồi lấy canonical result từ server.
9. `loan_events` là audit timeline append-only. Không hard-delete financial event bằng thao tác thông thường.
10. Quyền đọc/ghi chỉ được cấp qua membership và RLS; không dùng client-side checks làm lớp bảo mật chính.

## 5. Loan state machine

```text
DRAFT → PENDING → ACTIVE → REPAID → CLOSED
                  ↘
                 DISPUTED (nhãn/phái sinh khi còn repayment disputed)

PENDING → DECLINED | CANCELLED
ACTIVE  → CANCELLED (chỉ theo quy tắc đóng/hủy được server cho phép)
```

### Quy tắc trạng thái

| Trạng thái | Điều kiện vào | Hành động cho phép |
|---|---|---|
| `DRAFT` | Creator chưa gửi invite | Sửa term, gửi invite, hủy |
| `PENDING` | Invite hợp lệ đã phát hành | Recipient join/decline; creator revoke/cancel |
| `ACTIVE` | Recipient hợp lệ chấp nhận invite | Submit/confirm/dispute repayment; đề xuất đổi due date |
| `REPAID` | Confirmed repayment tổng bằng principal | Đóng room; xem timeline |
| `CLOSED` | Một participant đóng sau khi repaid | Chỉ đọc |
| `DECLINED` | Recipient từ chối invite | Chỉ đọc/audit |
| `CANCELLED` | Loan bị hủy theo policy trước khi repaid | Chỉ đọc/audit |

`OVERDUE` và `DUE_SOON` là nhãn tính từ due date và Remaining, không phải trạng thái lưu độc lập.

## 6. User stories P0

### Account

- Là người dùng, tôi có thể đăng nhập bằng email hoặc provider phù hợp để tham gia Loan Room.
- Là người dùng, tôi có thể xóa tài khoản theo quy trình bảo vệ audit history và quyền riêng tư.

### Create and join

- Là lender hoặc borrower, tôi có thể tạo loan với người còn lại, principal, currency, loan date, due date và ghi chú tùy chọn.
- Trước khi gửi, tôi nhìn thấy màn xác nhận thể hiện rõ ai cho ai vay, amount và dates.
- Là người nhận invite, tôi có thể xem người mời, vai trò, amount, currency và dates trước khi Join hoặc Decline.
- Khi Join thành công, cả hai cùng thấy cùng một loan `ACTIVE`.

### Shared room

- Là participant, tôi thấy principal, Remaining, due date, participants và timeline chung.
- Là participant, tôi có thể có nhiều Loan Room với cùng một người nhưng mỗi loan vẫn độc lập.

### Repayment

- Là borrower hoặc lender, tôi có thể đề xuất một partial repayment.
- Là participant còn lại, tôi có thể Confirm hoặc Dispute repayment được đề xuất.
- Khi Confirm, cả hai cùng thấy Remaining mới và event audit tương ứng.
- Khi Dispute, Remaining giữ nguyên và timeline thể hiện “Needs review”.
- Khi tổng repayment confirmed bằng principal, loan chuyển `REPAID`.

### Reminders and safety

- Là participant, tôi có thể nhận thông báo trung lập cho invite, repayment, due-soon và overdue, sau đó được deep-link đến đúng Loan Room.
- Là người dùng, tôi luôn nhận được nhãn text, icon và confirmation cho hành động tài chính; màu sắc không là tín hiệu duy nhất.

## 7. Definition of Done — Financial event

Một financial event (ví dụ: Confirm repayment) chỉ hoàn tất khi có tất cả điều sau:

- [ ] UX và confirmation screen rõ vai trò, amount và tác động.
- [ ] Client validation và server validation nhất quán.
- [ ] Authorization/RLS và negative authorization test.
- [ ] RPC/transaction atomic với locking cần thiết.
- [ ] Idempotency key, retry-safe và semantic error code đã dịch được.
- [ ] Balance và loan status được tính/cập nhật theo canonical server result.
- [ ] `loan_events` audit record append-only được tạo đúng một lần.
- [ ] Unit, integration, RLS và E2E happy/negative paths pass.
- [ ] Xử lý lỗi, timeout, retry và concurrent action có kiểm chứng.
- [ ] Localization, RTL, accessibility labels và analytics không chứa PII.
- [ ] Sentry/error context không lộ financial PII; tài liệu cập nhật.

## 8. Phase 0 exit checklist

- [x] Tên sản phẩm: Loan.
- [x] Product thesis, MVP boundaries, user stories và glossary.
- [x] State machine, domain invariants và DoD.
- [x] Package IDs và URL scheme đã cấu hình: `com.loanappmobiles.loanapp` / `loan`.
- [ ] UX prototype và Language-Blind Test được Phase 1 thực hiện.

## 9. Quyết định còn cần chốt

1. Android application ID và iOS bundle identifier phải dùng reverse-domain mà chủ sở hữu kiểm soát.
2. Tên hiển thị `Loan` khá phổ biến; cần kiểm tra store availability/trademark trước khi public launch, nhưng không chặn prototype hoặc development.
