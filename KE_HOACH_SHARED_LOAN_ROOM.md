# KẾ HOẠCH PHÁT TRIỂN APP “KHÔNG GIAN KHOẢN VAY DÙNG CHUNG”

> **Ghi chú 16/09/2026:** Tài liệu này giữ tầm nhìn và thiết kế ban đầu. Phạm vi, phiên bản stack, thứ tự triển khai và cổng phát hành hiện hành theo [Kế hoạch ra mắt Android](KE_HOACH_RA_MAT_ANDROID.md). Các mục đã đánh dấu trong tài liệu này không chứng minh đã triển khai hoặc kiểm thử. Android trước, iOS sau; một người triển khai.

> **Tên làm việc:** Shared Loan Room / Who Owes?  
> **Phiên bản tài liệu:** 1.0  
> **Ngày chốt:** 22/08/2026  
> **Mục tiêu:** Xây dựng một ứng dụng toàn cầu, đơn giản, đa ngôn ngữ, nơi **người cho vay và người vay cùng tham gia một không gian khoản vay**, cùng nhìn thấy một bản ghi thống nhất về số tiền, thời hạn, lịch sử trả nợ và cùng xác nhận các sự kiện quan trọng.

---

## 1. Tóm tắt sản phẩm

### 1.1. Bài toán

Các ứng dụng ghi nợ thông thường chủ yếu hoạt động như một “sổ cá nhân”:

- A ghi “B nợ tôi 500 USD”.
- B có thể không biết A đã ghi gì.
- Khi B trả một phần, hai bên có thể ghi số khác nhau.
- Không có một bản ghi chung được hai bên xác nhận.
- Dễ xảy ra tranh cãi về số dư, ngày trả và lịch sử thanh toán.

Ứng dụng này giải quyết bằng mô hình:

> **Một khoản vay — hai người — một bản ghi chung.**

Một khoản vay chỉ có:

- 1 người cho vay;
- 1 người vay;
- 1 số tiền gốc;
- 1 loại tiền;
- 1 ngày vay;
- 1 ngày đến hạn;
- 1 timeline dùng chung;
- các lần trả nợ;
- các xác nhận của hai phía.

---

## 2. Giá trị cốt lõi

### 2.1. Value proposition

> **One loan. Two people. One shared record.**

Ứng dụng không cố trở thành:

- ngân hàng;
- ví điện tử;
- ứng dụng cho vay;
- hệ thống kế toán;
- app chia hóa đơn;
- nền tảng vay người lạ.

Ứng dụng là **shared record / shared truth** giữa hai người đã có quan hệ vay mượn ngoài đời thực.

### 2.2. Điểm khác biệt

1. Hai bên cùng tham gia Loan Room.
2. Khoản vay chỉ được xem là “đã xác nhận” khi bên còn lại chấp nhận.
3. Trả nợ một phần phải được bên đối diện xác nhận.
4. Cả hai nhìn cùng số dư và cùng timeline.
5. Thay đổi điều khoản quan trọng phải có sự đồng thuận.
6. UX icon-first, text-light, hỗ trợ đa ngôn ngữ.
7. Không xử lý dòng tiền trong MVP nên giảm đáng kể độ phức tạp pháp lý và kỹ thuật.

---

## 3. Nhóm người dùng mục tiêu

### 3.1. Tệp chính

Người dùng 18+ trên toàn thế giới có các khoản vay cá nhân nhỏ hoặc vừa với:

- bạn bè;
- người yêu;
- roommate;
- đồng nghiệp;
- người thân;
- người quen;
- khách hàng quen trong trường hợp đơn giản.

### 3.2. Không nhắm tới ở MVP

- công ty tài chính;
- ngân hàng;
- tổ chức tín dụng;
- người cho vay chuyên nghiệp;
- marketplace kết nối người vay với người lạ;
- cho vay có lãi;
- thu hồi nợ chuyên nghiệp.

---

## 4. Nguyên tắc thiết kế sản phẩm

### 4.1. Icon-first, không icon-only

Không phụ thuộc hoàn toàn vào chữ, nhưng cũng không dùng biểu tượng một cách mơ hồ.

Mỗi hành động tài chính quan trọng phải có:

- biểu tượng;
- tên/ảnh đại diện hai người;
- mũi tên dòng tiền;
- số tiền;
- text ngắn theo ngôn ngữ người dùng;
- màn hình xác nhận trước khi ghi nhận.

### 4.2. Không dùng thuật ngữ kế toán

Tránh:

- debit;
- credit;
- receivable;
- payable;
- ledger balance.

Ưu tiên các câu dễ hiểu:

- You borrowed
- You lent
- They paid
- You paid
- Remaining
- Due date
- Confirm
- Dispute

### 4.3. Không dựa riêng vào màu sắc

Màu chỉ là tín hiệu phụ. Trạng thái luôn cần:

- icon;
- nhãn;
- vị trí;
- hoặc hình dạng.

### 4.4. Một hành động — một ý nghĩa

Không gộp nhiều nghiệp vụ tài chính vào một nút.

Ví dụ:

- `Record repayment`
- `Confirm repayment`
- `Dispute repayment`

phải tách rõ.

---

# 5. Mô hình sản phẩm cốt lõi

## 5.1. Loan Room

Mỗi Loan Room là một khoản vay độc lập.

Ví dụ:

```text
LOAN ROOM

Duy                Alex
LENDER           BORROWER

        500 USD

Loan date: 22 Aug 2026
Due date:  22 Sep 2026

Paid:       150 USD
Remaining:  350 USD
```

### 5.2. Một người có thể có nhiều Loan Room

Ví dụ cùng Alex:

- Loan #1: 500 USD — hạn 22/09.
- Loan #2: 150 USD — hạn 10/10.

Không gộp hai khoản thành một khoản duy nhất vì:

- ngày vay khác nhau;
- ngày trả khác nhau;
- lịch sử thanh toán khác nhau;
- trạng thái khác nhau.

---

# 6. State machine của khoản vay

Không dùng `paid = true/false`.

Trạng thái chính:

```text
DRAFT
  ↓
PENDING
  ↓
ACTIVE
  ↓
REPAID
  ↓
CLOSED
```

Các trạng thái/nhãn phụ:

- `DECLINED`
- `DISPUTED`
- `CANCELLED`
- `OVERDUE` — có thể tính động từ due date.
- `DUE_SOON` — có thể tính động.

### 6.1. Quy tắc

- `DRAFT`: người tạo chưa gửi lời mời.
- `PENDING`: đã gửi, chờ người kia tham gia.
- `ACTIVE`: cả hai đã xác nhận khoản vay.
- `REPAID`: tổng repayment đã xác nhận bằng principal.
- `CLOSED`: khoản vay đã hoàn tất và không còn thao tác tài chính mở.
- `DISPUTED`: tồn tại sự kiện đang tranh chấp cần xử lý.

---

# 7. Luồng nghiệp vụ chính

## 7.1. Tạo khoản vay

Người tạo chọn vai trò:

- Tôi cho vay.
- Tôi đi vay.

Nhập:

1. Người còn lại.
2. Số tiền.
3. Currency.
4. Ngày vay.
5. Ngày đến hạn.
6. Mục đích — optional.
7. Ghi chú — optional.

Trước khi tạo, hiện màn hình xác nhận trực quan:

```text
Duy
 │
500 USD
 ↓
Alex

22 Aug → 22 Sep
```

Sau khi tạo:

- status = `PENDING`;
- tạo Loan Room;
- tạo member của người tạo;
- tạo member lời mời cho người kia;
- tạo event `LOAN_CREATED`;
- sinh invite.

---

## 7.2. Invite / Join

Kênh mời:

- link;
- QR;
- OS Share Sheet;
- WhatsApp;
- Messenger;
- Telegram;
- Messages;
- email.

Người nhận thấy tối thiểu:

- người mời;
- vai trò của mình;
- amount;
- currency;
- loan date;
- due date.

Hành động:

- `Join`;
- `Decline`.

Khi Join:

- xác thực account;
- kiểm tra invite token;
- gắn user ID vào loan membership;
- status loan → `ACTIVE`;
- event `LOAN_ACCEPTED`;
- gửi realtime update;
- gửi notification cho người tạo.

---

## 7.3. Ghi nhận trả nợ

Ví dụ borrower trả 100 USD ngoài ứng dụng.

Borrower chọn:

`I paid 100 USD`

Hệ thống tạo:

```text
repayment:
amount = 100 USD
status = PENDING
created_by = borrower
```

Balance **chưa thay đổi**.

Lender nhận:

`Alex recorded a 100 USD repayment.`

Lender chọn:

- Confirm;
- Dispute.

Nếu Confirm:

- repayment → `CONFIRMED`;
- timeline thêm event;
- balance được tính lại từ repayments đã confirmed.

Nếu Dispute:

- repayment → `DISPUTED`;
- balance giữ nguyên;
- timeline hiển thị tranh chấp.

---

## 7.4. Lender ghi nhận đã nhận tiền

Lender cũng có thể tạo repayment.

Khi đó borrower là bên xác nhận.

Nguyên tắc chung:

> **Một bên đề xuất — bên còn lại xác nhận.**

---

## 7.5. Trả đủ

Khi:

```text
sum(CONFIRMED_REPAYMENTS) == principal
```

Loan chuyển:

`ACTIVE → REPAID`

Hai người nhận thông báo.

Sau đó một trong hai có thể đóng room.

---

## 7.6. Quá hạn

Không cần ghi thêm bản ghi chỉ để đánh dấu quá hạn.

Có thể tính:

```text
remaining > 0
AND current_date > due_date
=> OVERDUE
```

Nhờ vậy tránh state bị sai.

---

# 8. Thay đổi điều khoản

Các trường quan trọng:

- principal;
- currency;
- due date;
- repayment plan sau này.

Không cho một bên update trực tiếp khi loan đã ACTIVE.

Luồng:

```text
PROPOSE CHANGE
      ↓
OTHER PARTY REVIEW
      ↓
ACCEPT / DECLINE
      ↓
APPLY
```

Ví dụ:

```text
Due date

22 Sep
  ↓
22 Oct

[Accept] [Decline]
```

MVP có thể chỉ hỗ trợ thay đổi `due_date`.

Không cho thay principal/currency sau khi loan ACTIVE; nếu sai lớn, đóng/cancel và tạo loan mới.

---

# 9. Dispute

MVP không làm trọng tài.

Ứng dụng chỉ:

- ghi lại dispute;
- bảo toàn lịch sử;
- không thay balance nếu repayment chưa được confirm;
- cho hai bên giải quyết bằng Confirm / Cancel / Correct.

Không tuyên bố ai đúng.

Không dùng ngôn ngữ:

- “fraud”;
- “liar”;
- “legal debt proven”.

Nên dùng:

- `Needs review`;
- `Disputed`;
- `Not confirmed`.

---

# 10. Phạm vi MVP

## 10.1. P0 — phải có

### Account
- Google login.
- Apple login trên iOS khi phù hợp với policy.
- Email login.
- Profile tối thiểu.
- Delete account.

### Loan
- Create loan.
- Lender / borrower.
- Principal.
- Currency.
- Loan date.
- Due date.
- Optional note/purpose.
- Pending/active/repaid/closed.

### Invite
- Secure invite link.
- QR.
- Join.
- Decline.
- Universal/App Links.

### Shared Room
- Summary.
- Remaining balance.
- Progress.
- Due date.
- Participants.
- Timeline.

### Repayment
- Partial repayment.
- Confirm repayment.
- Dispute repayment.
- Multiple repayments.
- Full repayment detection.

### Notifications
- Invite accepted.
- Repayment submitted.
- Repayment confirmed/disputed.
- Due soon.
- Due today.
- Overdue reminder.

### Global
- Multiple currencies.
- Localization.
- RTL.
- Locale-aware date/number formatting.

### Safety/UX
- Confirmation screen.
- Undo cho thao tác local không tài chính.
- Không cho undo âm thầm đối với event đã được bên kia xác nhận.
- Accessibility labels.

---

## 10.2. P1 — sau khi MVP có retention

- Repayment schedule/installments.
- Recurring reminders.
- Attachment/evidence.
- Export PDF/CSV.
- Multi-device enhancements.
- Biometric app lock.
- Verified phone/email acknowledgement.
- Better offline mutation queue.
- Web account dashboard.
- Archive/search/filter.
- Widget.

---

## 10.3. P2 — chỉ khi dữ liệu chứng minh cần

- Object lending.
- Guarantor role.
- Multiple borrowers/lenders.
- Payment deep links.
- Voice entry.
- Smart reminder suggestions.
- Automatic currency estimation.

---

## 10.4. Không làm

- Interest.
- APR.
- Late fee.
- Wallet.
- Bank account connection.
- Payment processing.
- Loans from strangers.
- Lending marketplace.
- Credit scoring.
- Debt collection.
- Group expense splitting.
- Investment.
- Cryptocurrency.
- AI chatbot.

---

# 11. Công nghệ chốt

## 11.1. Nguyên tắc

- dễ triển khai;
- ít DevOps;
- tuyển dev dễ;
- một codebase;
- dùng công nghệ phổ biến;
- tránh experimental/canary;
- không tạo ngõ cụt khi scale.

## 11.2. Stack

| Layer | Công nghệ |
|---|---|
| Language | TypeScript |
| Mobile | React Native + Expo |
| Expo | SDK 57 stable |
| React Native đi kèm Expo 57 | 0.86 |
| Routing | Expo Router |
| Backend | Supabase |
| Database | PostgreSQL |
| Auth | Supabase Auth |
| Authorization | PostgreSQL Row Level Security |
| Realtime | Supabase Realtime |
| Atomic domain commands | PostgreSQL functions / Supabase RPC |
| Secret/server workflows | Supabase Edge Functions |
| Storage | Supabase Storage |
| Server state | TanStack Query |
| UI state | Zustand |
| Forms | React Hook Form |
| Validation | Zod |
| Local cache | Expo SQLite |
| Localization | i18next + expo-localization |
| Push | Expo Notifications |
| QR | Expo Camera |
| Deep links | Expo Router Universal Links / App Links |
| Crash monitoring | Sentry |
| Unit tests | Vitest |
| Component tests | React Native Testing Library |
| E2E | Maestro |
| Repository | GitHub |
| CI | GitHub Actions |
| Build/Submit | EAS Build + EAS Submit |

> **Version policy:** dùng Expo stable, không dùng Expo Canary chỉ để chạy React Native mới nhất. Tại thời điểm 22/08/2026, Expo SDK 57 dùng React Native 0.86; React Native 0.87 đã stable nhưng Expo hỗ trợ nó trước qua canary. Dự án ưu tiên Expo stable.

---

# 12. Kiến trúc tổng thể

```text
┌──────────────────────────────────────┐
│        EXPO / REACT NATIVE APP       │
│                                      │
│ Expo Router                          │
│ React Hook Form + Zod                │
│ TanStack Query                       │
│ Zustand                              │
│ i18next                              │
│ SQLite cache                         │
└──────────────────┬───────────────────┘
                   │
          HTTPS / Realtime
                   │
                   ▼
┌──────────────────────────────────────┐
│               SUPABASE               │
│                                      │
│ Auth                                 │
│ PostgreSQL                           │
│ RLS                                  │
│ RPC / Postgres functions             │
│ Realtime                             │
│ Storage                              │
│ Edge Functions                       │
└─────────┬───────────────┬────────────┘
          │               │
          ▼               ▼
   Push notifications   Invite / Web
```

---

# 13. Kiến trúc dữ liệu

## 13.1. profiles

```text
id UUID PK -> auth.users.id
display_name text
avatar_url text nullable
locale text
created_at timestamptz
updated_at timestamptz
```

Không cần:

- ngày sinh;
- địa chỉ;
- CMND/passport;
- thông tin tài chính;

trong MVP.

---

## 13.2. loans

```text
id UUID PK
principal_minor bigint
currency char(3)
loan_date date
due_date date
purpose text nullable
note text nullable
status enum
created_by UUID
created_at timestamptz
updated_at timestamptz
closed_at timestamptz nullable
```

### Money

Không dùng float.

Ví dụ:

```text
10.99 USD => 1099
```

Lưu `minor unit`.

Cần utility theo ISO 4217 vì không phải currency nào cũng có 2 chữ số thập phân.

---

## 13.3. loan_members

```text
id UUID PK
loan_id UUID FK
user_id UUID nullable
role enum: LENDER | BORROWER
membership_status enum:
  INVITED | ACCEPTED | DECLINED
invited_at timestamptz
joined_at timestamptz nullable
```

Constraint:

- một loan chỉ có một lender;
- một loan chỉ có một borrower ở MVP;
- lender != borrower.

---

## 13.4. loan_invites

```text
id UUID PK
loan_id UUID FK
target_role enum
token_hash text
expires_at timestamptz
used_at timestamptz nullable
revoked_at timestamptz nullable
created_by UUID
created_at timestamptz
```

Không lưu raw secure token nếu không cần.

Client nhận raw token một lần.

Server lưu hash.

---

## 13.5. repayments

```text
id UUID PK
loan_id UUID FK
amount_minor bigint
payment_date date
method enum nullable
note text nullable

status enum:
  PENDING
  CONFIRMED
  DISPUTED
  CANCELLED

created_by UUID
created_at timestamptz

confirmed_by UUID nullable
confirmed_at timestamptz nullable

disputed_by UUID nullable
disputed_at timestamptz nullable
```

Constraint:

```text
amount_minor > 0
```

MVP không cho confirmed repayments vượt principal còn lại nếu không có flow xử lý overpayment.

---

## 13.6. loan_events

Audit timeline.

```text
id UUID PK
loan_id UUID FK
event_type enum
actor_id UUID nullable
entity_type text nullable
entity_id UUID nullable
metadata jsonb
created_at timestamptz
```

Event types:

- LOAN_CREATED
- INVITE_CREATED
- LOAN_ACCEPTED
- LOAN_DECLINED
- REPAYMENT_SUBMITTED
- REPAYMENT_CONFIRMED
- REPAYMENT_DISPUTED
- DUE_DATE_CHANGE_PROPOSED
- DUE_DATE_CHANGE_ACCEPTED
- LOAN_REPAID
- LOAN_CLOSED

Không lưu câu đã dịch trong DB.

Client dịch `event_type` theo locale.

---

## 13.7. term_change_requests

Có thể thêm ngay nếu MVP hỗ trợ đổi due date:

```text
id UUID
loan_id UUID
field text
old_value jsonb
new_value jsonb
status PENDING | ACCEPTED | DECLINED
created_by UUID
resolved_by UUID nullable
created_at
resolved_at nullable
```

---

## 13.8. push_devices

```text
id UUID
user_id UUID
expo_push_token text
platform text
locale text
enabled boolean
last_seen_at timestamptz
```

---

# 14. Balance và source of truth

Không dùng:

```text
loans.balance = ...
```

làm nguồn sự thật.

Nguồn thật:

```text
principal
-
sum(CONFIRMED repayments)
=
remaining
```

Có thể:

- query qua view;
- computed SQL function;
- materialized/cache field sau này nếu performance cần.

Không để client tự tính và ghi balance lên server.

---

# 15. Write pipeline — thao tác tài chính

Các thao tác thay đổi shared state phải nguyên tử.

Ví dụ `create_loan`:

```text
Client
  ↓
Zod validation
  ↓
supabase.rpc("create_loan")
  ↓
PostgreSQL transaction
  ├── create loans
  ├── create loan_members
  ├── create loan_event
  └── create invite
  ↓
COMMIT
  ↓
Return result
```

Nếu bất kỳ bước nào lỗi:

```text
ROLLBACK ALL
```

Không để:

- loan đã tạo;
- nhưng member chưa tạo;
- hoặc event thiếu.

Các command nên triển khai bằng RPC/Postgres function:

- create_loan;
- accept_loan_invite;
- decline_loan_invite;
- submit_repayment;
- confirm_repayment;
- dispute_repayment;
- propose_due_date_change;
- accept_due_date_change;
- close_loan.

---

# 16. Edge Function dùng khi nào

Không biến Edge Functions thành backend monolith.

Dùng cho nghiệp vụ cần:

- secret;
- third-party API;
- push;
- invite token validation đặc biệt;
- scheduled reminders;
- rate limiting workflow;
- email;
- anti-abuse.

Ví dụ:

```text
Scheduled job
  ↓
find due loans
  ↓
Edge Function
  ↓
Expo Push API
```

---

# 17. Read pipeline

```text
App
 ↓
TanStack Query
 ↓
Supabase Data API
 ↓
RLS
 ↓
PostgreSQL
 ↓
response
 ↓
cache
 ↓
UI
```

Các query chính:

- my active loans;
- loan detail;
- timeline;
- repayments;
- pending confirmations.

---

# 18. Realtime pipeline

Chỉ subscribe các dữ liệu người dùng cần.

Ví dụ khi đang ở Loan Room:

```text
Loan Room open
   ↓
subscribe loan_id
   ↓
repayment confirmed by other user
   ↓
Realtime event
   ↓
invalidate TanStack Query
   ↓
refetch canonical data
   ↓
UI update
```

Không dùng realtime payload làm source of truth.

Realtime chỉ là tín hiệu để refetch/invalidate.

---

# 19. Offline strategy

MVP:

> **Online-first + offline read cache.**

Cho phép offline:

- xem danh sách loan cache;
- xem loan detail cache;
- xem timeline đã cache.

Không cho offline trong MVP đối với:

- accept loan;
- confirm repayment;
- dispute;
- đổi due date;
- close loan.

Lý do: đây là shared financial state cần server xác nhận.

Sau khi có nhu cầu thực tế mới làm:

```text
Offline mutation
 ↓
local pending queue
 ↓
sync
 ↓
server validation
 ↓
other party confirmation
```

---

# 20. Authentication

## 20.1. Provider

- Email/magic link hoặc OTP.
- Google.
- Apple trên iOS theo yêu cầu/policy tương ứng.

Không cần password truyền thống nếu có thể giảm friction.

## 20.2. Guest

Có thể cho guest:

- xem demo;
- tạo draft local.

Nhưng để:

- gửi invite;
- join;
- confirm;
- dispute;

phải có identity account.

## 20.3. Account deletion

Nếu app cho tạo account, phải có chức năng xóa account trong app.

Cần thiết kế trước cách xử lý shared records:

- xóa PII/profile của user;
- không phá lịch sử đã được người còn lại xác nhận nếu pháp lý cho phép giữ bản ghi tối thiểu;
- policy retention phải được review pháp lý trước production global.

---

# 21. Row Level Security

Mặc định mọi bảng shared đều bật RLS.

## 21.1. loans

User chỉ đọc loan nếu là accepted/pending member tương ứng.

Concept:

```sql
exists (
  select 1
  from loan_members
  where loan_members.loan_id = loans.id
    and loan_members.user_id = auth.uid()
)
```

## 21.2. repayments

Chỉ loan member được đọc.

Client không được UPDATE trực tiếp các cột:

- status;
- confirmed_by;
- disputed_by.

Các thao tác này đi qua RPC.

## 21.3. events

Chỉ participant của loan đọc được.

Không cho client tùy ý insert event giả.

Event do database function/server tạo.

## 21.4. invite

Không expose toàn bộ loan bằng public token.

Invite endpoint chỉ trả dữ liệu tối thiểu cần để người nhận quyết định Join/Decline.

---

# 22. Invite security

Link ví dụ:

```text
https://app.example.com/i/<random-token>
```

Yêu cầu:

- token entropy cao;
- không tuần tự;
- có expiry;
- revoke được;
- one-time claim khi phù hợp;
- rate limit;
- server lưu hash;
- không đưa amount/name trong URL;
- `noindex` cho trang invite;
- HTTPS;
- không log raw token ở analytics.

---

# 23. Deep Link / Universal Link

Flow:

```text
Share link
   ↓
Recipient taps
   ↓
App installed?
   ├── YES -> Expo Router invite screen
   └── NO  -> Web invite preview / install path
```

QR chứa cùng universal link.

Không tạo hai loại invite khác nhau cho QR và share.

---

# 24. Push notification

## 24.1. Event-triggered

- Loan invite accepted.
- Loan declined.
- Repayment submitted.
- Repayment confirmed.
- Repayment disputed.
- Due date change request.
- Due date change accepted.

## 24.2. Scheduled

Default nhẹ:

- 3 ngày trước hạn;
- ngày đến hạn;
- 3 ngày sau hạn.

Cho user tùy chỉnh.

Không spam.

## 24.3. Tone

Neutral:

- “350 USD with Alex is due tomorrow.”

Không:

- “PAY YOUR DEBT NOW!”
- “Alex refuses to pay.”

---

# 25. Localization

## 25.1. Ngôn ngữ MVP đề xuất

- English.
- Spanish.
- Portuguese.
- Vietnamese.
- Indonesian.
- Hindi.
- Arabic.
- Japanese.

Sau beta mở rộng:

- French;
- German;
- Korean;
- Simplified Chinese;
- Thai;
- Turkish;
- Italian;
- các ngôn ngữ khác theo usage.

## 25.2. Không lưu translated text trong database

Lưu semantic event:

```text
event_type = REPAYMENT_CONFIRMED
actor_id = ...
amount_minor = ...
currency = USD
```

Mỗi device render theo locale.

## 25.3. Phải hỗ trợ

- RTL cho Arabic.
- Locale number formatting.
- Locale date formatting.
- Currency minor units.
- Pluralization.
- Dynamic font sizing.
- Screen readers.

---

# 26. Language-Blind Test

Đây là test sản phẩm bắt buộc.

Đặt app sang một ngôn ngữ tester không biết.

Cho task:

1. Bạn cho Alex 20 USD vay.
2. Hạn trả là một ngày cụ thể.
3. Alex trả 5 USD.
4. Xác định còn bao nhiêu.
5. Chấp nhận một invite.

Mục tiêu ban đầu:

- ≥90% hoàn thành core flow chính xác;
- <1% ghi sai lender/borrower direction;
- transaction đầu tiên <15 giây sau khi đã biết người cần tạo.

Nếu thất bại:

> sửa UX trước, không thêm feature.

---

# 27. Screen map MVP

```text
Auth
 ├── Sign in
 └── Profile setup

Home
 ├── Borrowed
 ├── Lent
 ├── Pending
 └── Due / overdue

Create Loan
 ├── Role
 ├── Person
 ├── Amount + currency
 ├── Loan date
 ├── Due date
 ├── Optional note
 └── Confirm

Invite
 ├── QR
 ├── Share
 └── Pending

Loan Room
 ├── Summary
 ├── Repayment progress
 ├── Due date
 ├── Actions
 └── Timeline

Repayment
 ├── Amount
 ├── Date
 ├── Optional note
 └── Submit

Repayment Review
 ├── Confirm
 └── Dispute

Notifications

Settings
 ├── Language
 ├── Appearance
 ├── Notifications
 ├── Privacy
 └── Delete account
```

---

# 28. Home UX

Ưu tiên status thay vì chart.

```text
MY LOANS

↓ YOU BORROWED

Duy
350 USD
Due Sep 22

────────────

↑ YOU LENT

Alex
200 USD
Due Sep 15

────────────

⏳ WAITING

Maria
100 EUR
Invite pending
```

Không cần:

- biểu đồ tròn;
- tài sản ròng;
- cash-flow;
- ngân sách.

---

# 29. Loan Room UX

```text
Alex

OWES YOU
350 USD

150 / 500 paid
██████░░░░░░░

Due Sep 22

[Record repayment]
[Reminder]
[More]

TIMELINE

Sep 10
50 USD repayment
✓ Confirmed

Sep 01
100 USD repayment
✓ Confirmed

Aug 22
500 USD loan
✓ Confirmed by both
```

Perspective của borrower tự đổi thành:

`YOU OWE ALEX`

Backend vẫn là cùng một loan.

---

# 30. Accessibility

Mỗi icon quan trọng phải có semantic label.

Ví dụ:

- `ArrowDown` không chỉ đọc “arrow”.
- Screen reader đọc “Alex owes you 50 dollars”.

Touch target:

- đủ lớn cho mobile;
- không đặt hai hành động nguy hiểm sát nhau.

Confirm/Dispute:

- khác text;
- khác icon;
- không chỉ khác màu.

---

# 31. Project structure

Feature-first:

```text
src/
  app/
    routes/
    providers/

  features/
    auth/
    loans/
      api/
      components/
      hooks/
      screens/
      schemas/
    invitations/
    repayments/
    timeline/
    notifications/
    settings/

  domain/
    loan/
    repayment/
    money/

  components/
  lib/
    supabase/
    query/
    i18n/
    analytics/
    sentry/
    sqlite/

  utils/
  types/
```

Supabase:

```text
supabase/
  migrations/
  seed.sql
  functions/
    send-push/
    process-reminders/
    invite-preview/
```

---

# 32. Environments

Bắt buộc tách:

```text
DEV
STAGING
PRODUCTION
```

Mỗi môi trường:

- Supabase project riêng;
- keys riêng;
- app config riêng;
- Sentry environment riêng.

Không test destructive migration trên production.

---

# 33. Git workflow

Giữ đơn giản:

```text
feature/*
   ↓
Pull Request
   ↓
main
```

Có thể dùng `develop` nếu team lớn hơn sau này; MVP không bắt buộc.

PR phải pass:

- format;
- lint;
- TypeScript;
- unit tests;
- component tests quan trọng;
- build validation.

---

# 34. Testing strategy

## 34.1. Unit test

Ưu tiên domain logic.

### Money
- minor unit conversion;
- formatting;
- JPY/zero-decimal;
- decimal currencies;
- max safe values.

### Balance
```text
500 principal
100 confirmed
50 pending
=> remaining 400
```

Pending không được trừ.

### State
- Pending → Active chỉ khi invite accepted.
- Active → Repaid khi confirmed payments đủ.
- Disputed repayment không làm giảm balance.
- Người tạo repayment không được tự confirm chính repayment đó.

### Date
- due today;
- due soon;
- overdue;
- timezone boundaries.

### Permissions
- lender action;
- borrower action;
- invalid third party.

---

## 34.2. React Native Testing Library

Test:

- screen render;
- role selection;
- confirmation view;
- form errors;
- pending/confirmed/disputed states;
- RTL;
- large text;
- accessibility labels.

---

## 34.3. Database/RLS tests

Cực kỳ quan trọng.

Case:

### User C cố đọc Loan A-B

Expected:

```text
NO ROW / DENIED
```

### Borrower cố tự confirm repayment mình tạo

Expected:

```text
DENIED
```

### User sửa trực tiếp `confirmed_by`

Expected:

```text
DENIED
```

### Expired invite

Expected:

```text
INVALID / EXPIRED
```

---

## 34.4. Integration tests

- create loan transaction;
- accept invite;
- submit repayment;
- confirm repayment;
- dispute repayment;
- full repayment;
- close loan;
- realtime refetch;
- push generation.

---

## 34.5. E2E — Maestro

Flow A:

```text
A logs in
→ creates loan
→ gets invite
→ B joins
→ room becomes active
```

Flow B:

```text
B records payment
→ A receives pending
→ A confirms
→ both see new balance
```

Flow C:

```text
B records payment
→ A disputes
→ balance unchanged
```

Flow D:

```text
repay remaining
→ loan becomes REPAID
```

---

## 34.6. Device testing

Tối thiểu:

- low-end Android;
- mid-range Android;
- Samsung;
- Pixel;
- small iPhone;
- regular iPhone;
- large iPhone.

Test:

- dark mode;
- light mode;
- slow network;
- loss of network;
- app background/resume;
- notification tap;
- universal link;
- QR camera permission denied.

---

# 35. Security checklist

- [ ] RLS bật trên tất cả shared tables.
- [ ] Không dùng service-role key trong mobile.
- [ ] Secrets chỉ ở server/Edge Functions.
- [ ] Raw invite token không log.
- [ ] Rate limit invite endpoints.
- [ ] Server-side validate mọi amount/currency/date.
- [ ] Không tin dữ liệu client.
- [ ] RPC kiểm tra actor là member đúng role.
- [ ] Audit event server-generated.
- [ ] Storage path có authorization.
- [ ] Sentry scrub PII.
- [ ] Analytics không gửi amount/note/name.
- [ ] TLS/HTTPS.
- [ ] Account deletion.
- [ ] Backup.
- [ ] Restore test.
- [ ] Migration rollback plan.

---

# 36. Privacy

Dữ liệu nhạy cảm:

- danh tính hai người;
- quan hệ vay mượn;
- số tiền;
- ngày đến hạn;
- lịch sử trả nợ;
- note/evidence.

Nguyên tắc:

1. Thu thập tối thiểu.
2. Không upload contact book hàng loạt.
3. Không bán dữ liệu.
4. Analytics không chứa amount/name/note.
5. Không public profile search trong MVP.
6. Không expose Loan Room bằng public URL không kiểm soát.
7. Có Privacy Policy rõ retention/deletion.
8. Có Terms of Service.
9. Có disclaimer app là công cụ ghi nhận chung, không phải tổ chức tín dụng hay đơn vị xử lý thanh toán.

Trước global production cần review pháp lý riêng cho:

- privacy;
- consumer law;
- terminology liên quan “loan/debt”;
- data retention;
- minors;
- jurisdiction-specific requirements.

---

# 37. Analytics

Không đo kiểu finance app phức tạp.

## 37.1. Activation funnel

```text
INSTALL
 ↓
SIGN IN
 ↓
CREATE LOAN
 ↓
INVITE SENT
 ↓
INVITE OPENED
 ↓
OTHER USER JOINED
 ↓
ACTIVE LOAN
```

## 37.2. Core metrics

- Loan Creation Rate.
- Invite Send Rate.
- Invite Open Rate.
- Loan Acceptance Rate.
- Time to Acceptance.
- Confirmed Active Loans.
- Repayment Submission Rate.
- Repayment Confirmation Rate.
- Dispute Rate.
- Loan Completion Rate.
- Repeat Loan Rate.

## 37.3. North Star

> **Confirmed Active Loans**

Một loan có:

- lender;
- borrower;
- cả hai đã xác nhận;
- remaining > 0.

## 37.4. Metric quan trọng nhất về UX

> **Wrong Direction Rate**

Phải cực thấp.

---

# 38. Không gửi gì lên Analytics

Không gửi:

- 500 USD;
- tên Alex;
- note “rent”;
- số điện thoại;
- raw invite token.

Event tốt:

```text
loan_created
role=lender

repayment_submitted
creator_role=borrower

loan_invite_accepted
```

---

# 39. Monitoring

Sentry theo dõi:

- crash-free sessions;
- JS crashes;
- native crashes;
- network errors;
- RPC failures;
- deep-link errors;
- push registration errors.

Business monitoring:

- invite RPC error rate;
- repayment confirmation error;
- notification delivery attempts;
- scheduled reminder job failures.

Cần alert khi:

- auth lỗi tăng bất thường;
- RPC financial command failure tăng;
- database CPU/storage tới ngưỡng;
- scheduled reminder không chạy;
- error rate vượt threshold đã đặt.

---

# 40. Backup và recovery

Phải có:

- Supabase/Postgres backup phù hợp plan;
- migration history trong Git;
- staging restore test;
- quy trình khôi phục.

Nguyên tắc:

> **Backup chưa từng thử restore chưa được xem là backup đáng tin cậy.**

Không xóa hard-delete event tài chính quan trọng bằng thao tác thông thường.

---

# 41. Database migrations

Tất cả schema change phải nằm trong:

```text
supabase/migrations/
```

Flow:

```text
migration
 ↓
local/dev
 ↓
tests
 ↓
staging
 ↓
smoke test
 ↓
production
```

Không chỉnh DB production thủ công mà không tạo migration tương ứng.

---

# 42. CI pipeline

Mỗi PR:

```text
Checkout
 ↓
Install dependencies
 ↓
Format check
 ↓
ESLint
 ↓
TypeScript
 ↓
Unit tests
 ↓
Component tests
 ↓
Supabase schema/RLS tests
 ↓
Build check
```

Fail bất kỳ bước nào:

```text
MERGE BLOCKED
```

---

# 43. CD / Release pipeline

```text
main
 ↓
EAS Build
 ↓
Internal distribution
 ↓
QA
 ↓
Staging smoke tests
 ↓
Release candidate
 ↓
Google Play testing / TestFlight
 ↓
Production rollout
```

Không tự động đẩy production ngay khi merge `main` ở giai đoạn đầu.

Production cần approval.

---

# 44. Google Play

Flow:

1. Internal testing.
2. Closed testing.
3. Production access.
4. Staged rollout.

Lưu ý hiện tại:

> Với **personal developer account tạo sau 13/11/2023**, Google Play yêu cầu closed test với ít nhất **12 testers đã opt-in liên tục 14 ngày** trước khi có thể xin quyền production.

Đưa yêu cầu này vào kế hoạch từ đầu để không bị chặn ngày launch.

---

# 45. App Store

Trước submit:

- privacy policy;
- app metadata;
- screenshots;
- working backend;
- demo/review instructions nếu cần;
- account deletion;
- Sign in with Apple nếu policy yêu cầu cho phương thức login đang dùng;
- App Privacy declarations;
- no broken links;
- no placeholder content.

Dùng TestFlight:

```text
Internal
 ↓
External
 ↓
App Review
 ↓
Production
```

---

# 46. Roadmap từng bước

Không gắn roadmap với số tuần cố định; mỗi phase chỉ qua khi đạt exit criteria.

---

## PHASE 0 — Product Definition

### Làm

- Chốt problem statement.
- Chốt tệp người dùng.
- Chốt `1 loan = 2 people = 1 shared record`.
- Chốt P0/P1/P2.
- Chốt các thứ không làm.
- Viết user stories.
- Viết state machine.
- Viết terminology glossary.

### Deliverables

- Product brief.
- User flows.
- Loan state diagram.
- Feature backlog.
- Definition of Done.

### Exit criteria

Không còn tranh cãi về:

- lender/borrower;
- pending/active;
- repayment confirmation;
- due date;
- MVP scope.

---

## PHASE 1 — UX Prototype

### Làm

Prototype:

- Home.
- Create Loan.
- Invite.
- Join.
- Loan Room.
- Repayment.
- Confirm/Dispute.
- Timeline.

### Test

- Native-language usability.
- Language-Blind Test.
- Role-direction test.

### Exit criteria

- Core flow hiểu được.
- Wrong direction < mục tiêu.
- Không cần tutorial dài.
- Người thử nghiệm biết ai cho ai vay chỉ bằng visual + text tối thiểu.

---

## PHASE 2 — Repository & Foundation

### Làm

- GitHub repo.
- Expo SDK 57 stable.
- TypeScript strict.
- Expo Router.
- ESLint/format.
- env config.
- DEV/STAGING/PROD structure.
- TanStack Query.
- Zustand.
- React Hook Form + Zod.
- i18next.
- Sentry skeleton.
- CI.

### Exit criteria

- Android dev build chạy.
- iOS build pipeline chạy.
- Web invite route skeleton chạy.
- CI xanh.

---

## PHASE 3 — Database & Auth

### Làm

- Supabase DEV.
- migrations.
- profiles.
- loans.
- loan_members.
- invites.
- repayments.
- events.
- RLS.
- Auth providers.
- account deletion design.

### Test

- RLS attacker scenarios.
- Foreign key.
- constraints.
- invalid amounts.
- duplicate roles.

### Exit criteria

- User A không đọc được data User B/C.
- Không có client-side write bypass.
- Migrations tái tạo được DB từ đầu.

---

## PHASE 4 — Loan Creation & Invitation

### Làm

- create_loan RPC.
- Create Loan screens.
- QR.
- secure invite.
- Universal/App Links.
- accept/decline RPC.
- pending status.
- shared room activation.

### Test

- expired token.
- reused token.
- wrong account.
- user joins own loan.
- forwarded invite.
- concurrent accept.

### Exit criteria

A và B có thể:

```text
A create
→ B join
→ both see same ACTIVE loan
```

ổn định.

---

## PHASE 5 — Shared Loan Room

### Làm

- Home list.
- Loan detail.
- balance.
- timeline.
- TanStack Query cache.
- Realtime invalidation.
- offline read cache.

### Exit criteria

Hai thiết bị luôn hội tụ về cùng:

- principal;
- due date;
- status;
- balance;
- timeline.

---

## PHASE 6 — Repayment

### Làm

- submit_repayment RPC.
- confirm_repayment RPC.
- dispute_repayment RPC.
- partial payment.
- full repayment.
- REPAID state.
- timeline events.

### Test bắt buộc

- creator không tự confirm.
- duplicate request idempotency.
- simultaneous confirmation.
- amount > remaining.
- dispute.
- retry after timeout.

### Exit criteria

Không có trường hợp confirmed balance khác nhau giữa hai user.

---

## PHASE 7 — Notifications & Due Date

### Làm

- register push device.
- due reminder scheduler.
- event push.
- neutral copy.
- notification deep links.
- user preferences.

### Exit criteria

- notification dẫn đúng Loan Room.
- timezone đúng.
- không gửi trùng.
- opt-out hoạt động.

---

## PHASE 8 — Localization & Accessibility

### Làm

- 8 ngôn ngữ MVP.
- RTL.
- locale currency.
- locale dates.
- screen-reader semantics.
- dynamic text.
- contrast.
- icon labels.

### Test

Chạy lại Language-Blind Test.

### Exit criteria

- core flow không phụ thuộc tutorial.
- Arabic RTL không vỡ layout.
- amount/date không hiểu nhầm.

---

## PHASE 9 — Hardening

### Làm

- Sentry.
- performance.
- rate limit.
- token hardening.
- backup.
- restore drill.
- migration staging.
- privacy scrub.
- delete-account implementation.
- Terms/Privacy.

### Exit criteria

- security checklist pass.
- recovery procedure đã test.
- không log PII tài chính.
- crash-free đạt ngưỡng beta.

---

## PHASE 10 — Beta

### Android

- Internal.
- Closed test.
- 12 testers / 14 ngày nếu account thuộc diện Google yêu cầu.

### iOS

- TestFlight internal.
- External.

### Beta goals

Đo:

- create → invite;
- invite → join;
- dual confirmation;
- repayment confirmation;
- wrong direction;
- dispute rate;
- crashes.

### Exit criteria

Không launch chỉ vì “đã hết sprint”.

Launch khi:

- core flow ổn định;
- bug tài chính P0 = 0;
- RLS pass;
- invite loop usable;
- crash-free đạt target;
- feedback không cho thấy core concept bị hiểu sai.

---

## PHASE 11 — Production

### Làm

- store listing.
- localization listing.
- privacy disclosures.
- staged rollout.
- monitoring.

Rollout Android nên tăng dần thay vì 100% ngay.

### Sau launch

Không vội thêm feature.

Ưu tiên:

1. crash;
2. security;
3. sync/data consistency;
4. invite conversion;
5. retention;
6. usability;
7. feature mới.

---

# 47. Quality gates

## Gate A — UX

Không code backend lớn nếu người dùng vẫn nhầm ai nợ ai.

## Gate B — Data integrity

Không beta nếu có thể tạo balance khác nhau ở hai thiết bị.

## Gate C — Security

Không beta public nếu RLS chưa được kiểm thử chủ động.

## Gate D — Viral loop

Nếu invite acceptance quá thấp, cải thiện invite/onboarding trước.

## Gate E — Retention

Chỉ phát triển P1 khi người dùng thật quay lại và quản lý khoản vay.

---

# 48. Definition of Done cho một financial event

Ví dụ `Confirm repayment` chỉ Done khi:

- [ ] UI hoàn chỉnh.
- [ ] validation client.
- [ ] validation server.
- [ ] authorization.
- [ ] atomic transaction.
- [ ] audit event.
- [ ] RLS test.
- [ ] unit test.
- [ ] integration test.
- [ ] E2E path.
- [ ] error state.
- [ ] retry/idempotency.
- [ ] localization.
- [ ] accessibility.
- [ ] analytics event không PII.
- [ ] Sentry error context an toàn.
- [ ] documentation.

---

# 49. Idempotency

Rất quan trọng với app mobile.

Tình huống:

```text
User taps Confirm
 ↓
server success
 ↓
network timeout
 ↓
client retries
```

Không được confirm hai lần/tạo event hai lần.

Core commands nên nhận:

```text
idempotency_key UUID
```

Server bảo đảm một key chỉ áp dụng một lần.

Áp dụng cho:

- create loan;
- accept invite;
- submit repayment;
- confirm repayment;
- close loan.

---

# 50. Concurrency

Ví dụ A và B cùng thao tác.

Server là canonical authority.

Không dùng optimistic update để tự đổi balance với financial command trước khi server xác nhận.

Có thể hiển thị:

```text
Confirming...
```

sau đó lấy canonical result.

Ưu tiên chính xác hơn “cảm giác siêu tức thì”.

---

# 51. Failure handling

Mỗi command cần các error code semantic:

```text
INVITE_EXPIRED
INVITE_ALREADY_USED
NOT_A_PARTICIPANT
INVALID_ROLE
REPAYMENT_ALREADY_CONFIRMED
REPAYMENT_DISPUTED
AMOUNT_EXCEEDS_REMAINING
LOAN_NOT_ACTIVE
LOAN_ALREADY_REPAID
```

Client dịch error code theo locale.

Không trả raw database error cho user.

---

# 52. Vận hành production

## Daily/ongoing dashboard

Theo dõi:

- auth error;
- RPC error;
- DB health;
- Realtime connection;
- push errors;
- crash-free;
- invite conversion;
- repayment confirmation;
- dispute spikes.

## Incident priority

### P0
- lộ data giữa users;
- sai balance;
- mất data;
- confirm nhầm;
- unauthorized write.

### P1
- login diện rộng lỗi;
- invite không dùng được;
- push sai người;
- room không sync.

### P2
- layout;
- translation;
- minor UI.

P0 phải có rollback/disable feature path.

---

# 53. Cost-control

MVP tránh:

- AI API;
- SMS OTP đại trà nếu chưa cần;
- video;
- heavy image storage;
- server riêng;
- Redis;
- Kubernetes;
- data warehouse.

Chi phí chính:

- Supabase.
- EAS/build.
- Sentry theo usage.
- store developer accounts.
- domain.
- optional translation/proofreading.

Theo dõi:

```text
cost / active confirmed loan
```

thay vì chỉ cost/user.

---

# 54. Scalability

Stack hiện tại đủ để đi xa trước khi cần đổi kiến trúc.

Scale theo thứ tự:

1. index Postgres.
2. optimize queries.
3. connection/pooling/config.
4. archive old events nếu cần.
5. background queues khi notification workload lớn.
6. dedicated backend/service chỉ khi có lý do đo được.

Không đưa:

- Kafka;
- Kubernetes;
- microservices;

vào MVP.

---

# 55. Chỉ số thành công ban đầu

Các con số dưới đây là **mục tiêu nội bộ để kiểm chứng**, không phải benchmark thị trường:

| Metric | Mục tiêu ban đầu |
|---|---:|
| Wrong lender/borrower direction | <1% |
| Core create flow success | >95% |
| Language-Blind core success | ≥90% |
| Invite open → join | theo dõi và tối ưu liên tục |
| Repayment confirm success | >98% về mặt kỹ thuật |
| Crash-free sessions | >99.8% |
| Unauthorized data access | 0 |
| Balance inconsistency | 0 |
| P0 financial bugs | 0 trước production |

---

# 56. Decision log đã chốt

### Product

- [x] Một loan chỉ có 2 người ở MVP.
- [x] Hai người phải vào cùng Loan Room.
- [x] Một shared record.
- [x] Khoản vay cần amount + currency + loan date + due date.
- [x] Invite/Join là core.
- [x] Repayment hỗ trợ partial.
- [x] Repayment cần dual confirmation.
- [x] Timeline chung.
- [x] Reminder.
- [x] Dispute đơn giản.
- [x] Không lãi.
- [x] Không payment processing.
- [x] Không vay người lạ.
- [x] Không group expense.
- [x] Không AI trong core.

### UX

- [x] Icon-first.
- [x] Text-light.
- [x] Không icon-only.
- [x] Multi-language.
- [x] Language-Blind Test.
- [x] Confirmation trước các thao tác quan trọng.

### Tech

- [x] TypeScript.
- [x] React Native + Expo.
- [x] Expo Router.
- [x] Supabase/PostgreSQL.
- [x] RLS.
- [x] RPC cho atomic financial commands.
- [x] Edge Functions cho server workflows cần secret.
- [x] TanStack Query.
- [x] Zustand cho UI state.
- [x] Zod.
- [x] Expo SQLite làm cache.
- [x] Online-first shared mutations.
- [x] Expo Notifications.
- [x] GitHub Actions + EAS.
- [x] Sentry.
- [x] Vitest + RNTL + Maestro.

---

# 57. Việc cần làm đầu tiên khi bắt đầu code

Theo đúng thứ tự:

```text
1. Chốt tên repo + package ID
2. Tạo Figma low-fi prototype
3. Chạy Language-Blind Test
4. Chốt user flows
5. Tạo Expo SDK 57 project
6. Bật TypeScript strict
7. Tạo GitHub + CI
8. Tạo Supabase DEV
9. Viết migrations
10. Viết RLS tests
11. Viết domain state machine
12. Xây Create Loan
13. Xây Invite / Join
14. Xây Shared Loan Room
15. Xây Repayment + Confirm
16. Xây Timeline
17. Xây Reminder
18. Localization/RTL
19. Security hardening
20. E2E
21. Beta
22. Production
```

Không đảo thứ tự để làm AI, payment hoặc dashboard đẹp trước core.

---

# 58. Kiến trúc sản phẩm cuối cùng

```text
                         LOAN
                          │
        ┌─────────────────┼─────────────────┐
        │                 │                 │
      TERMS             PEOPLE           TIMELINE
        │                 │                 │
   Principal           Lender            Created
   Currency            Borrower          Joined
   Loan date                              Repayment
   Due date                               Confirmed
                                          Disputed
                                          Repaid
                          │
                          ▼
                     SHARED STATE
                  ┌───────┴────────┐
                  │                │
               LENDER          BORROWER
                  │                │
                  └──── SERVER ────┘
                          │
                 PostgreSQL + RLS
                          │
             RPC + Realtime + Push
```

---

# 59. Kết luận

Sản phẩm nên được giữ ở một thesis rất rõ:

> **Một không gian khoản vay dùng chung, nơi người cho vay và người vay cùng nhìn một số tiền, cùng một hạn trả, cùng lịch sử và cùng xác nhận các sự kiện quan trọng.**

Điểm mạnh không nằm ở việc có nhiều tính năng tài chính.

Điểm mạnh nằm ở:

1. **Shared truth** — hai người cùng một bản ghi.
2. **Dual confirmation** — không một bên tự sửa “sự thật”.
3. **Language-light UX** — dùng được toàn cầu.
4. **Simple workflow** — không biến thành ngân hàng.
5. **Trustworthy history** — timeline có audit.
6. **Low operational complexity** — Expo + Supabase, ít DevOps.
7. **Long-term foundation** — TypeScript + React Native + PostgreSQL là stack phổ biến và có đường scale rõ.

Nếu phải bảo vệ chỉ bốn trụ cột của sản phẩm, đó là:

> **Loan Room + Dual Confirmation + Repayment Timeline + Due Date.**

Mọi feature tương lai chỉ nên được thêm khi nó làm một trong bốn trụ này tốt hơn.

---

# 60. Nguồn kỹ thuật kiểm chứng tại ngày 22/08/2026

Ưu tiên tài liệu chính thức:

1. Expo SDK reference — SDK 57 / React Native 0.86  
   https://docs.expo.dev/versions/latest/

2. Expo create project — SDK 57  
   https://docs.expo.dev/get-started/create-a-project/

3. React Native 0.87 release — 11/08/2026  
   https://reactnative.dev/blog/2026/08/11/react-native-0.87

4. Supabase + Expo React Native quickstart  
   https://supabase.com/docs/guides/getting-started/quickstarts/expo-react-native

5. Supabase React Native Auth  
   https://supabase.com/docs/guides/auth/quickstarts/react-native

6. Google Play — testing requirements for new personal developer accounts  
   https://support.google.com/googleplay/android-developer/answer/14151465

7. Apple App Review Guidelines  
   https://developer.apple.com/app-store/review/guidelines/

8. Apple — account deletion  
   https://developer.apple.com/support/offering-account-deletion-in-your-app/

---

**Trạng thái tài liệu:** Baseline kế hoạch chính thức để tiếp tục thiết kế và triển khai MVP.
