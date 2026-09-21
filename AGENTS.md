# Quy tắc phát triển dự án (Project Development Rules) — LOAN

Tài liệu này định nghĩa quy tắc làm việc, công cụ bắt buộc và quy trình ưu tiên mà AI Assistant phải tự giác tuân thủ trong toàn bộ quá trình phát triển dự án LOAN.

---

## 1. Các công cụ chủ động sử dụng

### 1. Context7
* **Mục đích:** Tra cứu documentation mới nhất của framework, library và API (Expo SDK, React Native, Supabase JS, TanStack Query, Vitest, v.v.).
* **Nguyên tắc:**
  * Không dựa vào kiến thức cũ hay phỏng đoán khi có thể kiểm tra tài liệu chính xác qua Context7 (hoặc `search_web`/`read_url_content` làm fallback nếu môi trường chưa nạp MCP).
  * Trước khi triển khai thư viện mới hoặc tính năng có khả năng thay đổi giữa các phiên bản (breaking changes), bắt buộc kiểm tra tài liệu chính thức mới nhất.

### 2. Supabase MCP & CLI
* **Mục đích:** Làm việc trực tiếp với backend Supabase (PostgreSQL database, tables, enums, schemas, migrations, Auth, RLS, Storage và Edge Functions).
* **Nguyên tắc:**
  * **Kiểm tra trước khi sửa:** Phải kiểm tra cấu trúc schema hiện tại trước khi thay đổi, tuyệt đối tránh tạo bảng, cột hoặc ràng buộc trùng lặp.
  * **Tuân thủ Migration:** Ưu tiên 100% viết migration có thể theo dõi (trackable) và có khả năng rollback. Không chỉnh sửa database tùy tiện hay can thiệp trực tiếp làm lệch drift schema.
  * **Bảo mật RLS & Atomic RPC:** Mọi bảng tài chính phải có RLS; mọi thay đổi số dư/trạng thái phải qua RPC atomic & idempotent.

### 3. Playwright MCP & Browser Automation
* **Mục đích:** Kiểm tra ứng dụng trực tiếp trên trình duyệt hoặc môi trường mô phỏng.
* **Nguyên tắc:**
  * Thao tác thực tế: Mở trang, click, nhập dữ liệu, kiểm tra luồng người dùng (user journey), kiểm tra hiển thị responsive và bắt lỗi console/network/UI.
  * Sau khi hoàn thành một tính năng quan trọng, **bắt buộc sử dụng Playwright / browser testing** để kiểm tra luồng thực tế thay vì chỉ nhìn code hoặc dựa vào build tĩnh.

### 4. Frontend Design Skill
* **Mục đích:** Xây dựng và cải thiện giao diện người dùng.
* **Nguyên tắc:**
  * Giao diện phải hiện đại, trực quan, sắc nét, responsive và có tính nhất quán cao.
  * Chú trọng chi tiết: Typography, spacing, color tokens, layout hierarchy, và xử lý trọn vẹn các trạng thái: `default`, `active/focus`, `loading`, `empty state`, và `error state`.
  * Tránh xa các giao diện generic, nghèo nàn hoặc mang cảm giác "AI-generated".

### 5. Figma MCP
* **Mục đích:** Đối soát và hiện thực hóa thiết kế từ Figma.
* **Nguyên tắc:**
  * Khi dự án có thiết kế Figma, hãy đọc trực tiếp thông tin/tokens/styles từ Figma thay vì đoán giao diện.
  * Chuyển đổi design thành các component có cấu trúc tốt, module hóa và tái sử dụng cao.
  * Giữ đúng layout, spacing, typography và design system của bản thiết kế gốc.

---

## 2. Quy trình ưu tiên khi thực hiện tính năng mới

Mọi tính năng mới cần đi qua chuỗi quy trình chuẩn sau:

$$\text{Context7} \longrightarrow \text{Figma / Frontend Design} \longrightarrow \text{Code} \longrightarrow \text{Supabase} \longrightarrow \text{Playwright} \longrightarrow \text{Fix \& Verify}$$

1. **Context7:** Nghiên cứu & đối chiếu tài liệu mới nhất về API/thư viện sẽ dùng.
2. **Figma / Frontend Design:** Định hình giao diện, cấu trúc component, tokens và trải nghiệm người dùng.
3. **Code:** Viết mã nguồn sạch, phân tầng rõ ràng (API, store, component, screen), tuân thủ TypeScript strict.
4. **Supabase:** Viết migration, cập nhật RPC, RLS, chạy kiểm thử SQL và đối chiếu schema.
5. **Playwright:** Khởi chạy kiểm thử hành trình người dùng thực tế trên trình duyệt/thiết bị.
6. **Fix & Verify:** Phát hiện lỗi hồi quy (regression), sửa lỗi, chạy trọn bộ unit tests (`npm test`) và typecheck trước khi nghiệm thu.

> **Yêu cầu hành vi của AI:** Chủ động lựa chọn và kích hoạt công cụ phù hợp trong chuỗi trên, **không thụ động chờ người dùng nhắc nhở từng bước**.

---

## 3. Các nguyên tắc cốt lõi không được vi phạm

1. **Tuyệt đối không bịa đặt (No Hallucination):** Không tự tạo API, package, database field hoặc functionality không tồn tại.
2. **Không sử dụng API deprecated:** Luôn ưu tiên giải pháp mới nhất và ổn định của framework hiện hành.
3. **Không sửa database mù:** Luôn đọc và kiểm tra schema hiện tại trước khi tạo bất kỳ migration hay lệnh SQL nào.
4. **Không kết luận vội vàng:** Không bao giờ kết luận tính năng đã hoàn thành chỉ vì code không báo lỗi cú pháp hoặc build thành công. Tính năng chỉ xong khi đã qua kiểm chứng luồng hoạt động thực tế.
5. **Kiểm thử thực tế bắt buộc:** Phải kiểm tra luồng sử dụng thực tế bằng Playwright / E2E test khi có thể.
6. **Bảo toàn kiến trúc:** Code viết ra phải dễ bảo trì, có cấu trúc mạch lạc, bảo vệ ranh giới tài khoản (account boundary) và khớp với kiến trúc hiện hữu của dự án.
