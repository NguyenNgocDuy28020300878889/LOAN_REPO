# LOAN — giao diện mobile, 16/09/2026

Áp dụng skill `ui-ux-pro-max` và `mobile-app-ui-design` trực tiếp vào React Native hiện có. Hướng thiết kế: tối giản, xanh trầm, nền dịu, chữ rõ và thao tác chính dễ tìm. Phạm vi gồm danh sách khoản vay, tạo vay, phòng khoản vay, ghi nhận trả nợ, lời mời, đăng nhập/đăng ký, khôi phục mật khẩu và tùy chọn.

## Hệ thống giao diện

Nguồn dùng chung: `src/components/loan-ui.tsx`.

| Thành phần  | Quy ước                                                                            |
| ----------- | ---------------------------------------------------------------------------------- |
| Màu sáng    | Nền `#F5F7F4`, thẻ trắng, chữ `#172E29`, màu chính `#0F6553`                       |
| Màu tối     | Nền `#101C19`, thẻ `#192A24`, chữ `#ECF4EE`, màu chính `#A9DCB7`                   |
| Chữ         | Font hệ thống; 14 / 16 / 24 / 32; thường / đậm. Số tiền dùng chữ số có độ rộng đều |
| Khoảng cách | Bội số 4/8; trang và thẻ thường 24; nội dung tối đa rộng 640                       |
| Thao tác    | Nút chính cao tối thiểu 52, nút biểu tượng 48, dòng công tắc 64                    |
| Biểu tượng  | Cùng một bộ hình dựng từ View, không tải font biểu tượng hoặc ảnh                  |
| Trạng thái  | Có chữ cho chờ / đang hoạt động / hoàn tất / tranh chấp; không chỉ dùng màu        |

Màu chữ/nền của chín cặp token chính đã được tính tương phản: thấp nhất 5,32:1 ở sáng, 7,11:1 ở tối. Đây là kiểm tra token, không phải chứng nhận toàn ứng dụng đạt WCAG. Có viền focus bàn phím, nhãn ô nhập luôn hiển thị, khai báo checked/busy/disabled và progress cho trình đọc màn hình. Không thêm chuyển động tự chạy.

## Thao tác chính

- Trang chủ: tổng quan theo **số khoản**, không cộng tiền khác loại tiền tệ; tìm theo mục đích, lọc cho vay/đi vay, thẻ khoản vay có số dư và hạn trả. Nút tạo vay ở cuối vùng thao tác.
- Tạo vay: lựa chọn vai trò, thông tin khoản vay và ngày được chia nhóm. Vẫn xác nhận chi tiết trước khi gửi.
- Phòng khoản vay: số dư, tiến độ trả đã xác nhận, thông tin thỏa thuận và người tham gia ở đầu; khoản trả nợ và lịch sử phía sau. Nút ghi nhận trả nợ hiện khi khoản vay đang hoạt động.
- Trả nợ: hiện số dư để đối chiếu, ô nhập lớn, nhắc rõ cần bên còn lại xác nhận. Form cuộn và xử lý bàn phím theo nền tảng.
- Lời mời: anonymous vẫn chỉ thấy trang chung; chi tiết chỉ xuất hiện sau đăng nhập. Không đổi điều kiện tham gia.
- Xác thực: cập nhật tiếp theo yêu cầu chủ ứng dụng sang email/Gmail + mã xác nhận 8 chữ số, không yêu cầu mật khẩu trên màn hình chính. Có gửi lại/đổi email/lỗi mã và thông báo hộp thư kiểm thử khi chạy local. Luồng phục hồi cũ giữ tương thích. Xem [Email OTP](EMAIL_OTP.md).
- Tùy chọn: ngôn ngữ, thông báo và tài khoản thành từng nhóm; cả dòng công tắc là vùng chạm. Thông báo ghi rõ mới lưu tùy chọn, chưa có dịch vụ gửi. Không triển khai thêm chính sách xóa tài khoản.

## Tài nguyên

- `FlatList` cho danh sách khoản vay, `SectionList` cho trả nợ/lịch sử; khởi tạo 8 hàng, batch 8, window 7. Thẻ khoản vay được memo hóa. Không dựng toàn bộ danh sách bằng `ScrollView.map`.
- Không thêm dependency, web font, bitmap trang trí, blur, thư viện biểu đồ hoặc animation. Thanh tiến độ chỉ là View. Không thêm polling/API thống kê.
- Số đo JavaScript web: bản export trước thiết kế **2.813.542 byte**, bản local sau thiết kế **2.845.290 byte**, tăng **1,13%** (khoảng 2,81 → 2,85 MB). Không tuyên bố giảm dung lượng bundle; tối ưu ở cách dựng danh sách và tránh thêm tài nguyên nặng. Đây là số đo artifact web, không phải RAM hay kích thước APK.
- Backend hiện vẫn trả toàn bộ list/timeline. Virtualization **không thay thế phân trang server**; phần đó còn trong kế hoạch phát hành. Chưa đo RAM/FPS/pin hoặc bàn phím/TalkBack trên Android thật.

## Kiểm chứng và tái chạy

```powershell
# Chạy từ app/, sau khi Supabase local đang hoạt động và có .local/local-status.json
npm run export:browser:local
$env:LOAN_UI_REVIEW = '1'
npm run test:browser:local
```

Chế độ UI review chụp các màn ở 320 / 412 / 768 / 1024 / 1440 px, sáng/tối, giảm chuyển động; kiểm tra không tràn ngang document. Ảnh trong `.local/ui-review/`, chỉ chứa fixture local. Lượt xem ảnh đầu đã phát hiện biểu tượng quay lại lệch tâm; đã chỉnh trước nghiệm thu cuối. Cần xem ảnh cùng kiểm thử tương tác: kiểm tra tràn ngang tự động không tự chứng minh mọi thành phần đều dễ đọc.

Bộ hành trình tiếp tục kiểm tra UI → HTTP/Postgres/Realtime local thật, mất phản hồi/retry, tự hủy pending khi trả đủ và tài khoản ngoài. Thêm kiểm tra tìm kiếm/bộ lọc, công tắc và tiếng Việt. Script từ chối export không khớp source. Không gọi cloud hoặc dùng dữ liệu thật.

**Nghiệm thu local:** hành trình cuối PASS, gồm tìm kiếm/xóa bộ lọc, chọn bộ lọc bằng Space, đổi công tắc bằng Space và click, lưu ngôn ngữ rồi mở lại trang chủ/phòng khoản vay bằng tiếng Việt. Đã tạo **100 ảnh** ở 10 trạng thái × 2 chế độ × 5 chiều rộng; kiểm tra overflow đều qua. Đã xem trực tiếp các ảnh đại diện ở mobile nhỏ, 412 px và desktop, cả sáng/tối; không coi số lượng ảnh là kiểm thử Android. Đã sửa lỗi lệch biểu tượng và thiếu Space activation của radio/switch trong React Native Web. 38 unit tests hiện có vẫn qua; TypeScript/lint và export web 12 routes qua.

Ảnh tiêu biểu (chứa dữ liệu giả): `.local/ui-review/home-vi-light-412.png`, `.local/ui-review/room-vi-dark-412.png`, `.local/ui-review/settings-vi-light-320.png`.

Chưa build APK cho đợt giao diện này. APK cũ không chứa thiết kế mới; ảnh browser không thay nghiệm thu Android native.
