# Hồ sơ Đăng ký và Closed Testing Google Play (Store Listing & Policy Guide) — LOAN

Tài liệu này cung cấp toàn bộ nội dung, câu từ (copy-paste), và hướng dẫn trả lời các bảng khai báo trên **Google Play Console** cho ứng dụng LOAN, phục vụ **Bước 8** trong kế hoạch phát hành.

---

## 1. Thông tin ứng dụng trên Google Play (Main Store Listing)

### A. Tiếng Việt (Ngôn ngữ mặc định)

- **Tên ứng dụng (Tối đa 30 ký tự):**

  ```text
  Loan: Sổ ghi nợ chung
  ```

  _(Số ký tự: 21/30)_

- **Mô tả ngắn (Tối đa 80 ký tự):**

  ```text
  Sổ theo dõi khoản vay chung hai chiều, đối soát số dư và lịch sử minh bạch.
  ```

  _(Số ký tự: 75/80)_

- **Mô tả đầy đủ (Tối đa 4000 ký tự):**
  ```text
  Loan là ứng dụng sổ ghi chép và theo dõi khoản vay chung hai chiều minh bạch giữa hai người (bạn bè, người thân, đồng nghiệp, đối tác).

  KHÔNG CÒN HIỂU LẦM VỀ SỐ TIỀN VÀ THỜI HẠN
  Khi vay mượn cá nhân không lãi suất giữa người quen, việc chỉ ghi chép một phía rất dễ dẫn đến tranh cãi hoặc quên sót số dư. Với Loan, mọi khoản vay đều là một "phòng thỏa thuận chung" mà cả người cho vay và người đi vay cùng quản lý.

  CÁC TÍNH NĂNG CHÍNH:
  1. Thỏa thuận hai chiều minh bạch:
  • Một bên tạo khoản vay (số tiền, ngày vay, hạn trả, mục đích).
  • Người nhận chỉ cần mở ứng dụng là thấy ngay lời mời đang chờ, hoặc tham gia qua liên kết bảo mật.
  • Khoản vay chỉ chính thức hoạt động khi cả hai bên cùng xác nhận tham gia.

  2. Ghi nhận và đối soát lịch sử trả nợ:
  • Ghi nhận trả nợ từng phần hoặc toàn bộ.
  • Số dư chỉ được cập nhật sau khi bên còn lại xác nhận đã nhận tiền thực tế.
  • Hỗ trợ khiếu nại hoặc hủy yêu cầu trả nợ nếu có sai sót.
  • Dòng thời gian hiển thị rõ ràng từng sự kiện giao dịch.

  3. Bảo mật và quyền riêng tư:
  • Xác thực bảo mật qua Google Sign-In.
  • Phân quyền độc lập, không ai có thể tự ý sửa đổi số dư mà không có sự đồng thuận của bên kia.
  • Hỗ trợ quyền yêu cầu xóa tài khoản và dữ liệu cá nhân theo tiêu chuẩn quốc tế.

  LƯU Ý QUAN TRỌNG:
  • Loan là công cụ ghi chép, quản lý tài chính cá nhân và đối soát số dư giữa hai bên.
  • Ứng dụng KHÔNG cung cấp dịch vụ cho vay tín dụng, KHÔNG giải ngân tiền mặt, KHÔNG thu lãi suất hay bất kỳ khoản phí vay nào.
  • Mọi giao dịch tiền mặt hoặc chuyển khoản do người dùng tự thực hiện ngoài ứng dụng; Loan không đóng vai trò trung gian thanh toán hay tổ chức tín dụng.
  ```

---

### B. Tiếng Anh (English - United States)

- **App name (Max 30 characters):**

  ```text
  Loan: Shared Debt Tracker
  ```

  _(Characters: 25/30)_

- **Short description (Max 80 characters):**

  ```text
  Shared personal loan tracker with two-party verification and transparent history.
  ```

  _(Characters: 80/80)_

- **Full description (Max 4000 characters):**
  ```text
  Loan is a two-party shared record-keeping app for personal loans and borrowing between friends, family, and peers.

  TRANSPARENT TWO-WAY FINANCIAL TRACKING
  Personal lending often suffers from forgotten balances and one-sided notes. Loan eliminates ambiguity by providing a shared agreement room where both parties stay on the exact same page.

  KEY FEATURES:
  1. Bilateral Loan Agreement:
  • One person creates the agreement (principal amount, currency, due date, purpose).
  • The recipient receives a direct in-app invite or a secure link to review and accept.
  • The record only activates once both parties agree.

  2. Verified Repayment Ledger:
  • Record partial or full repayments anytime.
  • Balances update only after the other party confirms receipt of funds.
  • Dispute or cancel unconfirmed repayment proposals easily.
  • Complete audit timeline of every event.

  3. Privacy & Account Control:
  • Secure authentication with Google Sign-In.
  • Strict account boundary: no one can alter financial figures unilaterally.
  • Full support for user account and data deletion requests.

  IMPORTANT NOTICE:
  • Loan is strictly a personal financial management and ledger tool for mutual record-keeping.
  • This app DOES NOT provide loan origination, cash disbursement, credit facilities, or interest calculations.
  • Users exchange money independently outside the app; Loan does not process payments or operate as a financial institution.
  ```

---

## 2. Danh mục và Thông tin liên hệ (Categorization & Contact Details)

- **Loại ứng dụng (App category):** `Apps`
- **Danh mục (Category):** `Finance` (Tài chính)
- **Thẻ (Tags):** `Personal finance`, `Debt tracking`, `Budgeting`
- **Email liên hệ hỗ trợ (Developer email):** `duynguyenpc.280203@gmail.com`
- **Website:** `https://loan.duyhaohan.id.vn` (hoặc `https://loan-web-seven.vercel.app`)
- **Số điện thoại hỗ trợ (tùy chọn):** Bổ sung nếu Play Console yêu cầu xác minh.

---

## 3. Khai báo Nội dung ứng dụng (App Content Declarations)

### 3.1. Chính sách quyền riêng tư (Privacy Policy)

- **URL chính sách:** `https://loan-web-seven.vercel.app/privacy-policy`

### 3.2. Quyền truy cập ứng dụng (App Access)

- **Lựa chọn:** `All or some functionality is restricted` (Có chức năng cần đăng nhập).
- **Hướng dẫn cho người duyệt (Reviewer instructions):**
  ```text
  Tên hướng dẫn: Google Reviewer Access
  Tài khoản kiểm thử 1 (Người cho vay):
  - Phương thức: Google Sign-In
  - Email test: reviewer.loan.test1@gmail.com

  Tài khoản kiểm thử 2 (Người đi vay):
  - Email test: reviewer.loan.test2@gmail.com

  Hướng dẫn thao tác:
  1. Đăng nhập bằng tài khoản Google reviewer do nhà phát triển cung cấp an toàn trong Play Console. Không dùng OTP hết hạn và không yêu cầu reviewer dùng tài khoản cá nhân.
  2. Tạo khoản vay mẫu bằng nút "+" ở màn hình chính, nhập số tiền (ví dụ: 100000 VND), chọn ngày đến hạn, và nhập email người nhận hoặc để trống để lấy liên kết mời.
  3. Mở liên kết hoặc vào mục "Lời mời đang chờ" trên tài khoản thứ hai để duyệt chấp nhận.
  4. Tạo một giao dịch trả nợ và xác nhận để thấy số dư được cập nhật nguyên tử.
  5. Vào Cài đặt -> Xóa tài khoản để kiểm tra tính năng xóa dữ liệu an toàn.
  ```

### 3.3. Quảng cáo (Ads)

- **Câu hỏi:** Does your app contain ads?
- **Lựa chọn:** **No, my app does not contain ads** (Ứng dụng không có quảng cáo).

### 3.4. Đối tượng người dùng và Nội dung (Target Audience and Content)

- **Độ tuổi mục tiêu (Target age):** **18 and over** (Từ 18 tuổi trở lên).
- **Kháng cáo với trẻ em (Appeal to children):** **No**.

### 3.5. Xóa tài khoản và dữ liệu (Account Deletion Badge)

- **App URL for account deletion:** `https://loan-web-seven.vercel.app/account-deletion`
- **Quy trình:**
  - Người dùng có thể xóa tài khoản ngay trong ứng dụng (`Settings` -> `Delete Account`).
  - Hoặc gửi yêu cầu qua trang web công khai kể cả khi đã gỡ cài đặt app.
  - Điều kiện: Phải tất toán các khoản vay và giao dịch đang hoạt động trước khi xóa.

### 3.6. Khai báo tính năng tài chính (Financial Features Declaration)

Đây là mục **bắt buộc** đối với tất cả ứng dụng trong danh mục Finance có từ khóa "Loan":

- **Phân loại ứng dụng:** Chọn **"Personal financial management (PFM)"** hoặc **"Accounting / Bookkeeping"**.
- **Khẳng định loại trừ:**
  - ❌ **NOT a Personal Loan Provider** (Không cung cấp khoản vay tài chính cá nhân).
  - ❌ **NOT a Peer-to-Peer (P2P) Lending Platform** (Không phải sàn giao dịch kết nối vay mượn lấy lãi).
  - ❌ **NOT an Open Banking / Credit Broker** (Không môi giới tín dụng).
- **Mô tả ngắn cho Google Compliance:**
  ```text
  LOAN is a utility app for two individuals to mutually record and track offline personal agreements (such as split expenses or mutual non-commercial debts between friends/family). The app does not facilitate money transfers, does not disburse funds, does not charge fees or interest, and is not a financial services provider.
  ```

### 3.7. An toàn dữ liệu (Data Safety Form)

Nhập theo bảng ánh xạ chi tiết tại tài liệu [`docs/DATA_SAFETY.md`](DATA_SAFETY.md):

- Mã hóa khi truyền (Encrypted in transit): **Yes** (HTTPS TLS 1.2+).
- Cơ chế xóa tài khoản (Deletion request): **Yes**.
- Dữ liệu thu thập:
  1. Personal Info: `Email address` (Required) & `Name` (Optional).
  2. Financial Info: `Other financial info` (Chi tiết số nợ & lịch sử trả nợ giữa hai bên).
  3. App info: `Crash logs` (Sentry - lọc bỏ PII).
  4. Device IDs: Không thu thập trong release production hiện tại vì push đang tắt. Cập nhật Data Safety trước khi bật tính năng này.
- Chia sẻ dữ liệu với bên thứ ba (Data shared): **NO** (Không chia sẻ bất kỳ dữ liệu nào).

---

## 4. Kế hoạch Closed Testing (mục tiêu 20 Testers / 14 Ngày)

### 4.1. Điều kiện áp dụng

- Đối với tài khoản Google Play Developer cá nhân tạo sau ngày 13/11/2023 thuộc diện áp dụng: yêu cầu công khai hiện hành là **tối thiểu 12 testers opt-in liên tục trong 14 ngày** trước khi xin quyền Production. Tuyển mục tiêu 20 người để dự phòng; luôn kiểm tra con số hiển thị trong chính Play Console của tài khoản.

### 4.2. Danh sách chuẩn bị

1. **Tạo Google Group cho Testers:**
   - Tạo một nhóm: `loan-app-testers@googlegroups.com`.
   - Mời mục tiêu 20 email của bạn bè, đồng nghiệp hoặc nhóm thử nghiệm vào group này; duy trì ít nhất mức Play Console yêu cầu liên tục đủ 14 ngày.
2. **Cấu hình trên Google Play Console:**
   - Vào `Release` -> `Testing` -> `Closed testing`.
   - Tạo một track mới (hoặc dùng track mặc định).
   - Trong mục **Testers**, chọn **Google Groups** và nhập email của Google Group vừa tạo.
   - Sao chép liên kết tham gia thử nghiệm (Opt-in URL dạng: `https://play.google.com/apps/testing/com.loanappmobiles.loanapp`).

### 4.3. Kịch bản kiểm thử cho Testers (Testing Scenarios)

| Ngày           | Kịch bản kiểm thử                                   | Mục tiêu xác minh                                                                                                       |
| :------------- | :-------------------------------------------------- | :---------------------------------------------------------------------------------------------------------------------- |
| **Ngày 1–2**   | Cài đặt ứng dụng qua Google Play & Đăng nhập        | Đăng nhập Google thành công, kiểm tra giao diện ban đầu và chuyển đổi ngôn ngữ.                                         |
| **Ngày 3–5**   | Tạo khoản vay & Gửi lời mời hai chiều               | User A tạo khoản vay nhập email User B; User B thấy lời mời xuất hiện trên trang chủ và bấm Chấp nhận.                  |
| **Ngày 6–8**   | Ghi nhận trả nợ & Đối soát số dư                    | User B gửi đề xuất trả nợ; User A mở lại ứng dụng, kiểm tra và bấm Xác nhận. Số dư giảm đúng kỳ vọng.                   |
| **Ngày 9–11**  | Thử nghiệm xử lý tranh chấp & Lời mời bằng liên kết | Thử khiếu nại khoản trả nợ; thử tạo lời mời không nhập email rồi gửi link qua chat để đối tác mở bằng nút "Mở lời mời". |
| **Ngày 12–14** | Kiểm tra ổn định, đổi ngôn ngữ & Xem chính sách     | Thử chuyển đổi Tiếng Việt / Tiếng Anh, mở xem Điều khoản & Chính sách quyền riêng tư, kiểm tra không bị crash/ANR.      |

### 4.4. Thu thập phản hồi (Feedback Mechanism)

- Testers gửi phản hồi trực tiếp qua tính năng phản hồi trên Google Play Store hoặc biểu mẫu Google Form.
- Theo dõi bảng điều khiển **Crashes and ANRs** trên Play Console để đảm bảo tỷ lệ lỗi = 0.
