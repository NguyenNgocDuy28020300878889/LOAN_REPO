# Kế hoạch test UX — Phase 1: Loan

**Mục tiêu:** Phát hiện nhầm lẫn về lender/borrower, hướng tiền và dual confirmation trước khi triển khai domain logic.

**Prototype:** `prototype/index.html`  
**Người điều phối:** Không giải thích trước về khái niệm Loan Room hoặc cách dùng app.  
**Mẫu tối thiểu:** 5 người; ưu tiên người có mức độ quen thuộc ứng dụng tài chính khác nhau.

## Chuẩn bị

1. Mở `prototype/index.html` bằng trình duyệt trên màn hình rộng tối đa 390px hoặc thiết bị mobile.
2. Mỗi người thử thao tác độc lập, không gợi ý trừ khi họ dừng hẳn.
3. Ghi nguyên văn điểm họ ngập ngừng hoặc nói nhầm; không chỉ ghi pass/fail.

## Test A — Role-direction

Thực hiện cả hai biến thể theo thứ tự ngẫu nhiên:

- Biến thể L: chọn `I lent money`.
- Biến thể B: chọn `I borrowed money`.

Người thử tạo khoản `500 USD` với Alex, tiếp tục tới Invite và Join. Sau đó hỏi:

1. Ai cho ai vay?
2. 500 USD di chuyển theo hướng nào?
3. Khi Alex Join, trạng thái của khoản vay là gì?
4. Nếu Alex ghi đã trả 100 USD, số dư có đổi ngay không?
5. Ai có quyền Confirm repayment?

**Pass:** trả lời đúng cả năm câu, không cần trợ giúp.  
**Fail P0:** nhầm lender/borrower, mũi tên tiền, hoặc nghĩ repayment pending đã làm đổi balance.

## Test B — Language-Blind

Ẩn hoặc hạn chế phần hướng dẫn bằng lời nếu có thể. Giao nhiệm vụ duy nhất:

> “Hãy tạo khoản vay, xác định ai cho ai vay, tham gia khoản vay, ghi nhận trả nợ và chỉ ra ai phải xác nhận.”

Không cho tutorial. Quan sát:

- Có chọn đúng role không?
- Có đọc đúng review screen không?
- Có tìm được CTA repayment không?
- Có hiểu dual confirmation không?

**Pass:** hoàn thành core flow không trợ giúp.  
**Mục tiêu:** ít nhất 90% completion; tỷ lệ nhầm hướng tiền tiến tới dưới 1% khi beta có đủ mẫu.

## Bảng ghi kết quả

| Người thử | Test/biến thể | Hoàn thành | Nhầm vai trò/hướng tiền | Cần trợ giúp | Điểm vướng/nguyên văn | Thay đổi đề xuất |
|---|---|---|---|---|---|---|
| P1 | A-L |  |  |  |  |  |
| P1 | A-B |  |  |  |  |  |
| P1 | B |  |  |  |  |  |

Sao chép ba dòng cho từng người thử còn lại.

## Quy tắc quyết định sau test

- Một fail P0: sửa prototype trước khi đưa flow tương ứng vào code domain.
- Một điểm vướng lặp lại từ hai người trở lên: ưu tiên sửa UX/copy/icon/layout.
- Không có fail P0 và đạt completion target: ghi kết quả vào `PHASE_1_UX_VALIDATION.md`, rồi kết thúc Phase 1.
