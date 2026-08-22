# Phase 1 — UX Validation: Loan

**Trạng thái:** Đang thực hiện  
**Mục tiêu:** Chứng minh người dùng hiểu đúng ai cho ai vay và hiểu hậu quả của mỗi thao tác tài chính trước khi xây app.

## 1. Hướng UI đã chọn

- **Tính cách:** bình tĩnh, trung lập, đáng tin; không mang cảm giác đòi nợ.
- **Nền:** trắng/xám rất nhạt; nhiều khoảng thở.
- **Accent:** xanh dương cho CTA và trạng thái tích cực; đỏ chỉ dùng cho cảnh báo/dispute có nhãn kèm theo.
- **Typography:** một font sans-serif hệ thống; amount là trọng tâm thị giác, dùng số tabular/monospace khi có sẵn.
- **Grid:** 8pt; padding card 24px; tap target tối thiểu 44×44pt.
- **Nguyên tắc:** icon + text, không dựa riêng vào màu; CTA tài chính luôn ở vùng đáy màn hình và luôn có màn xác nhận.

## 2. Luồng prototype cần kiểm thử

```text
Home (empty)
  → Create loan
  → Review loan
  → Invite shared
  → Recipient opens invite
  → Join / Decline
  → Loan Room ACTIVE
  → Record repayment
  → Review repayment
  → Other participant Confirm / Dispute
  → Updated Loan Room + Timeline
```

## 3. Wireframe nội dung tối thiểu

### A. Home — empty state

```text
[Loan]

No shared loans yet
Keep one clear record with the other person.

                 [+ Create a loan]
```

**Primary action:** Create a loan.  
**Kiểm tra:** người dùng hiểu đây là khoản vay chung, không phải app chuyển tiền.

### B. Create loan — role first

```text
Create a loan                                 [×]

Which describes this loan?
[↗] I lent money              [↙] I borrowed money

Person
[ Add the other person                                > ]

Amount
[ 500                                      ] [ USD v ]

Loan date       [ 22 Aug 2026                         ]
Due date        [ 22 Sep 2026                         ]

                                      [Continue]
```

**Ràng buộc:** role được chọn trước amount; biểu tượng mũi tên và câu chữ luôn cùng hướng.

### C. Review loan — confirmation bắt buộc

```text
Review before sending

You (LENDER)                         Alex (BORROWER)
              500 USD
                 →

22 Aug 2026  →  22 Sep 2026

This will invite Alex to confirm this shared record.

                                      [Send invite]
```

**Kiểm tra:** người dùng đọc đúng lender, borrower, hướng tiền và dates.

### D. Invite landing

```text
Duy invited you to a shared loan

You would be the BORROWER
500 USD
Loan date: 22 Aug 2026
Due date:  22 Sep 2026

[Decline]                              [Join loan]
```

**Ràng buộc:** Join không được che phần role/amount/date; nếu chưa sign-in, authenticate rồi quay lại đúng invite.

### E. Loan Room — active

```text
Duy                                      Alex
LENDER                                  BORROWER

Remaining
500 USD
0% repaid                                      Due 22 Sep

[ Record repayment ]

Timeline
• Loan confirmed by both                    Today
• Invite accepted                           Today
```

**Hierarchy:** Remaining lớn nhất; participants, role và due date luôn thấy được; status không chỉ thể hiện bằng màu.

### F. Record repayment and review

```text
I paid                                    [×]

[ 100                                      ] [ USD ]
Payment date [ Today                               ]
Note (optional) [                                ]

You are proposing this repayment. The other person
must confirm it before the remaining amount changes.

                                      [Review payment]
```

```text
Alex recorded a repayment

100 USD • 22 Aug 2026
Remaining stays 500 USD until you confirm.

[Dispute]                                  [Confirm]
```

### G. Confirmation result

```text
Repayment confirmed

100 USD is now part of the shared record.
Remaining: 400 USD

                                      [Back to loan]
```

**Peak/end:** feedback ngắn, rõ, không ăn mừng quá mức vì đây là thao tác tài chính.

## 4. Test protocol

### Role-direction test

Kịch bản và biểu mẫu ghi kết quả: `PHASE_1_TEST_PLAN.md`.

Mỗi người thử nhận hai biến thể ngẫu nhiên (lender tạo loan và borrower tạo loan), không được giải thích trước. Yêu cầu họ trả lời:

1. Ai cho ai vay?
2. Hướng của 500 USD là gì?
3. Sau khi Join, khoản vay có thay đổi gì?
4. Khi người kia ghi trả 100 USD, số dư có đổi ngay không?
5. Ai có quyền Confirm?

**Pass:** đúng cả 5 câu; bất kỳ nhầm lẫn vai trò/hướng tiền nào là fail UX P0.

### Language-Blind test

- Dùng prototype chỉ giữ amount, dates, avatars, role badge, arrows và CTA tối thiểu.
- Người thử làm: chọn role → kiểm tra review → join → xác định ai phải confirm repayment.
- Không cung cấp tutorial hay trợ giúp.

**Pass:** ít nhất 90% người thử hoàn thành core flow; tỷ lệ nhầm hướng lender/borrower dưới 1% khi có đủ mẫu beta.

## 5. Trạng thái cần thiết kế trước khi code

- Loading, offline read-only, expired invite, reused invite, unauthorized invite.
- Validation: amount trống/không hợp lệ/vượt remaining, due date trước loan date.
- Pending repayment, disputed repayment, repaid loan, overdue loan.
- Dynamic type, screen-reader labels và RTL mirror cho mũi tên/hierarchy.

## 6. Exit criteria

- [x] Clickable prototype cho A–G được tạo tại `prototype/index.html`.
- [ ] Có tối thiểu 5 lượt role-direction test ghi nhận kết quả.
- [ ] Có tối thiểu 5 lượt Language-Blind test ghi nhận kết quả.
- [ ] Không có lỗi P0 về nhầm vai trò/hướng tiền.
- [ ] Đã quyết định chỉnh sửa UX từ bằng chứng test.
