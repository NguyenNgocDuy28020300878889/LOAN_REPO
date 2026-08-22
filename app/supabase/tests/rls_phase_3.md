# RLS test matrix — Phase 3

Chạy các case này bằng local Supabase test environment hoặc một test project riêng; không dùng DEV có dữ liệu thật.

| Case                      | Setup                                              | Kết quả bắt buộc                                           |
| ------------------------- | -------------------------------------------------- | ---------------------------------------------------------- |
| Outsider reads loan       | A/B là members loan; C authenticated               | C không đọc loans, members, repayments hoặc events của A/B |
| Profile isolation         | A và C không share loan                            | A không đọc profile C                                      |
| Shared profile visibility | A/B accepted members                               | A và B đọc được profile của nhau                           |
| Direct loan write         | Authenticated A gọi direct insert/update           | Bị RLS/revoke từ chối; chỉ RPC Phase 4 được quyền write    |
| Direct repayment write    | Authenticated participant gọi direct insert/update | Bị từ chối                                                 |
| Account deletion request  | A gọi request function                             | Chỉ A đọc request của A; C không đọc được                  |
| Profile bootstrap         | Tạo auth user mới                                  | Trigger tạo profile an toàn, locale/default name hợp lệ    |

Lưu kết quả, role SQL và timestamp chạy test trong báo cáo tiến độ trước khi đóng Phase 3.
