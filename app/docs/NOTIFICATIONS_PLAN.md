# Kế hoạch thông báo đẩy và nhắc đến hạn

Ngày bắt đầu: 21/09/2026. Phạm vi: Android trước, backend Supabase, Expo Push Service.

## Hành vi đã thống nhất

- Push cho người còn lại khi tham gia khoản vay, ghi nhận trả nợ, xác nhận hoặc tranh chấp khoản trả; không thông báo lại cho người thực hiện.
- Nhắc khoản ACTIVE còn dư nợ trước hạn một ngày và đúng ngày hạn lúc 09:00 theo múi giờ thiết bị người nhận. Không gửi bù sang ngày khác.
- Tắt push ngừng mọi loại; tắt nhắc hạn chỉ ngừng nhắc hạn. Kiểm tra lại ngay trước gửi.
- Nội dung khóa màn hình không chứa tên, số tiền, ghi chú. Chạm thông báo chỉ điều hướng bằng ID khoản vay; RPC vẫn kiểm tra thành viên.
- Không hứa giao đúng từng giây hoặc chắc chắn đến thiết bị: hệ điều hành và nhà cung cấp có thể trì hoãn.

## Các bước

1. Lưu kế hoạch; đối chiếu tài liệu Expo SDK 54, Supabase.
2. Migration thêm thiết bị và hàng đợi riêng tư, UUID/FK/index/check/RLS, trigger sự kiện cùng transaction.
3. Worker gửi và kiểm tra receipts, retry có giới hạn, khóa công việc, vô hiệu token hỏng; lịch nhắc theo timezone và chống trùng.
4. Ứng dụng: expo-notifications, kênh Android, xin quyền do người dùng chủ động, đăng ký/thu hồi token, điều hướng an toàn, trạng thái trung thực.
5. Kiểm thử database local và worker với nhà cung cấp giả lập; TypeScript, lint, unit tests, web export.
6. Chuẩn bị hướng dẫn FCM/EAS, secrets và cron. Chỉ triển khai Supabase Cloud sau xác nhận riêng.
7. Sau triển khai STAGING và cấu hình FCM: build APK mới, cài A11, kiểm thử push thực tế khi mở/nền/khóa màn hình, hai tài khoản, đổi tài khoản, tắt quyền và nhắc hạn.

## Điều kiện nghiệm thu

- Người ngoài không đọc token/hàng đợi hoặc gọi worker RPC; đăng xuất/đổi tài khoản không nhận thông báo tài khoản cũ.
- Sự kiện rollback không để lại thông báo. Không lặp khi cron chạy lại hoặc nhiều worker tranh cùng công việc.
- Đổi ngày hạn, trả hết, hủy khoản, tắt tùy chọn hoặc yêu cầu xóa tài khoản ngăn công việc cũ chưa gửi.
- Ticket được Expo chấp nhận khác với receipt được FCM/APNs chấp nhận, và cả hai khác với xác nhận người nhận đã xem.
- Timeout mạng sau gửi có thể gây lặp ở nhà cung cấp (at-least-once); không tuyên bố exactly-once.
- Không reset database, xóa dữ liệu đang có hoặc đẩy migration lên Cloud tự động.

## Nguồn

- https://docs.expo.dev/versions/v54.0.0/sdk/notifications/
- https://docs.expo.dev/push-notifications/sending-notifications/
- https://supabase.com/docs/guides/functions/schedule-functions

Context7 và Supabase MCP không có trong công cụ phiên này; dùng tài liệu chính thức và Supabase CLI local. Bản APK 6 chưa chứa tính năng này.

## Tiến độ thực hiện ngày 21/09/2026

- Đã triển khai mã ứng dụng, hàng đợi sự kiện, scheduler nhắc hạn, worker gửi/receipts/retry và 3 migrations bổ sung; áp dụng chỉ trên local, không reset.
- Đã qua 125 kiểm tra database và 79 unit tests ứng dụng/worker, TypeScript; Edge Function local trả 401 cho request không có secret và trả `enabled:false` khi bị tắt.
- SQL lint không có lỗi; chế độ cảnh báo còn báo ép kiểu enum trong `create_loan` cũ, không thuộc chức năng push.
- TypeScript, lint, web export và Android Hermes export (với cờ push bật) đều thành công. Android export chỉ kiểm tra bundle, không thay thế build APK và test native trên máy thật.
- Người dùng xác nhận chưa có Firebase. Chưa cấu hình FCM, chưa deploy Cloud, chưa build/cài APK mới cho chức năng này, chưa test giao nhận push thật.
- Hướng dẫn cấu hình và các bước triển khai đã chuẩn bị tại [NOTIFICATIONS_SETUP.md](NOTIFICATIONS_SETUP.md). Cron là script thao tác riêng, không tự chạy trong migration.
