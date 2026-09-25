# Bảng Kê khai An toàn Dữ liệu (Google Play Data Safety Form Mapping) — LOAN

Tài liệu này cung cấp chi tiết câu trả lời cho mục **Data Safety (An toàn dữ liệu)** trong Google Play Console, được đối chiếu trực tiếp từ mã nguồn thực tế của LOAN.

---

## 1. Tổng quan (Data Collection & Sharing Overview)

| Câu hỏi trong Play Console                                                                 | Câu trả lời                                     | Ghi chú kỹ thuật                                                                   |
| :----------------------------------------------------------------------------------------- | :---------------------------------------------- | :--------------------------------------------------------------------------------- |
| **Does your app collect or share any of the required user data types?**                    | **Yes**                                         | Ứng dụng thu thập dữ liệu để vận hành sổ vay chung.                                |
| **Is all of the user data collected by your app encrypted in transit?**                    | **Yes**                                         | Mọi kết nối mạng đều bắt buộc qua HTTPS/TLS 1.2+.                                  |
| **Do you provide a way for users to request that their data be deleted?**                  | **Yes**                                         | Có cả đường xóa trong app (`/settings`) và web link độc lập (`/account-deletion`). |
| **Does your app allow users to create an account?**                                        | **Yes**                                         | Bản production hiện tại hỗ trợ Google Sign-In.                                     |
| **Add a link that users can use to request deletion of their account and associated data** | `https://loan.duyhaohan.id.vn/account-deletion` | Trang công khai cho phép đăng nhập và hoàn tất yêu cầu xóa.                        |

---

## 2. Chi tiết từng loại dữ liệu thu thập (Data Types Collected)

Phân loại “Shared” phải được đối chiếu lần cuối trong Play Console theo định nghĩa service provider và user-initiated sharing. Với kiến trúc hiện tại, Supabase/Google/Sentry là nhà cung cấp xử lý dữ liệu thay mặt ứng dụng; dữ liệu khoản vay chỉ hiển thị cho đúng người dùng mà chủ tài khoản chủ động mời. Không bán hoặc chia sẻ dữ liệu cho quảng cáo.

### A. Thông tin cá nhân (Personal Info)

#### 1. Email address

- **Collected:** Yes
- **Shared:** No
- **Ephemeral processing (chỉ xử lý tạm thời):** No (Lưu trữ trong CSDL tài khoản)
- **Is this data required or optional?** Required (Bắt buộc để định danh và bảo mật sổ vay)
- **Purposes:**
  - `App functionality` (Chức năng ứng dụng - xác thực người dùng, lời mời tham gia)
  - `Account management` (Quản lý tài khoản)

#### 2. Name (Tên hiển thị / Display Name)

- **Collected:** Yes
- **Shared:** No
- **Ephemeral:** No
- **Required/Optional:** Optional (Mặc định lấy từ Google profile hoặc người dùng chỉnh sửa)
- **Purposes:**
  - `App functionality` (Hiển thị tên cho đối tác trong phòng vay nhận diện)

---

### B. Thông tin tài chính (Financial Info)

#### 1. Other financial info (Chi tiết khoản vay & trả nợ giữa hai người)

- **Collected:** Yes
- **Shared:** No
- **Ephemeral:** No
- **Required/Optional:** Required (Cốt lõi chức năng sổ ghi nợ đôi)
- **Purposes:**
  - `App functionality` (Lưu trữ số tiền, ngày vay, lịch sử trả nợ, đối soát số dư)
- **Lưu ý:** LOAN không thu thập thông tin thẻ ngân hàng (Credit/Debit card), tài khoản ngân hàng hoặc lịch sử tín dụng ngoài phạm vi ứng dụng.

---

### C. Thông tin ứng dụng và hiệu năng (App Info and Performance)

#### 1. Crash logs (Nhật ký sự cố)

- **Collected:** Yes
- **Shared:** No
- **Ephemeral:** No
- **Required/Optional:** Optional theo cấu hình release. Chỉ khai báo Collected=Yes nếu AAB phát hành có `EXPO_PUBLIC_SENTRY_DSN` hoạt động.
- **Purposes:**
  - `Analytics`
  - `Developer communications` (Chẩn đoán và sửa lỗi crash)
- **Ghi chú bảo mật:** Module `telemetry-privacy.ts` dựng event theo allowlist, chỉ giữ mã lỗi an toàn và vị trí bundle rút gọn. Native collection hiện tắt.

---

### D. Thiết bị hoặc các mã định danh khác (Device or Other IDs)

#### 1. Device or other IDs (Push Notification Token)

- **Collected:** No trong release production hiện tại (`EXPO_PUBLIC_PUSH_READY=false`). Đổi thành Yes trước khi phát hành binary bật push.
- **Shared:** No
- **Ephemeral:** No
- **Required/Optional:** Optional (Chỉ thu thập khi người dùng bật thông báo trong Cài đặt)
- **Purposes:**
  - `App functionality` (Gửi thông báo có giao dịch mới, lời mời hoặc nhắc hạn)

---

## 3. Tóm tắt nhanh khi nhập vào Google Play Console

```
[Data Collection]
├── Personal Info
│   ├── Email address -> Collected (Required, App functionality & Account management)
│   └── Name -> Collected (Optional, App functionality)
├── Financial Info
│   └── Other financial info -> Collected (Required, App functionality)
├── App info and performance
│   └── Crash logs -> Collected chỉ khi DSN production được bật (Optional, Analytics)
└── Device or other IDs
    └── Device or other IDs -> Not collected trong release hiện tại; khai báo lại khi bật push

[Data Sharing]
└── Xác nhận lần cuối trong Console theo service-provider/user-initiated-sharing exemptions

[Security Practices]
├── Data encrypted in transit: YES
└── Account deletion mechanism provided: YES (In-app + Web link)
```
