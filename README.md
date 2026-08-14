# 💅 Nail Mi Tuyết Trần - Daily OCR & Financial Telegram Bot 💇‍♀️

Hệ thống **Telegram Bot AI OCR & Quản lý Tài chính - Thu Chi Tự Động** chuyên dụng cho tiệm **Nail Mi Tuyết Trần**. 

Bot giải quyết triệt để bài toán bóc tách dữ liệu từ sổ tay viết tay hàng ngày, tính toán hoa hồng thợ, quản lý chi tiêu và hợp đồng mua trả góp máy móc, đồng thời hỗ trợ sửa đổi trực quan và gửi cảnh báo bất thường theo thời gian thực.

---

## 🎯 Nghiệp Vụ Cốt Lõi (Business Domain & Features)

### 1. 📸 Bóc Tách Báo Cáo Viết Tay Siêu Tốc (Hybrid OCR < 1s)
- **Đọc ảnh đa dạng**: Hỗ trợ gửi 1 ảnh hoặc Album nhiều ảnh chụp sổ tay thu chi.
- **Tự động bóc tách**: Phân loại chính xác Ngày ghi nhận, Doanh số từng thợ (Gội/Móng, Mi/Xăm, Tăng ca/Ngoài giờ), Điểm chấm công (Làm cả ngày, 1/2 ngày, 3/4 ngày), các Khoản Chi và Hợp đồng Mua Trả Góp mới.
- **Xử lý dòng gạch xóa**: Tự động nhận diện và bỏ qua các số tiền/dòng chữ bị gạch xóa trên sổ.

### 2. ✏️ Hệ Thống Sửa Nhanh Tương Tác (Smart Interactive Quick Edit)
- **Menu nút bấm trực quan (Inline Keyboards)**: Sửa Ngày, Sửa Doanh số từng thợ, Sửa từng Khoản chi hoặc Thêm mới ngay trên tin nhắn Xem Trước (Preview).
- **Copyable Text Format**: Xuất bản mẫu văn bản chuẩn dạng code block cho phép copy, chỉnh sửa trực tiếp và gửi lại Bot để cập nhật bản nháp.

### 3. 🚨 Cảnh Báo Bất Thường & An Toàn (Anomaly & Safety Warnings)
- **Thợ mới (`is_unknown_staff`)**: Phát hiện tên thợ chưa có trong hệ thống và tự động lưu vào CSDL khi chốt báo cáo.
- **Doanh số bất thường**: Cảnh báo khi doanh số 1 thợ > 5,000,000đ hoặc tổng doanh thu ngày > 15,000,000đ.
- **Khoản chi lớn**: Cảnh báo khi phát sinh khoản chi tiêu > 2,000,000đ.
- **Trùng lặp báo cáo**: Cảnh báo ngày đã có dữ liệu trước đó và cung cấp nút bấm `[Cộng Dồn]` hoặc `[Ghi Đè]` (có sao lưu bản cũ).

### 4. 💰 Quản Lý Thu Chi, Lương Thợ & Trả Góp
- **Tính lương thợ tự động**: Áp dụng tỷ lệ % hoa hồng riêng biệt theo từng hạng mục (Gội/Móng, Mi/Xăm, Ngoài giờ) và số công.
- **Khấu trừ mua trả góp**: Tự động trừ chi phí mua trả góp thiết bị/máy móc tiệm vào Lợi nhuận ròng từ các tháng tiếp theo.
- **Báo cáo & Xuất file**: Tra cứu `/today`, `/month`, `/luong` và xuất báo cáo file Excel/CSV UTF-8 tải về trực tiếp trên Telegram.

---

## 🛠️ Công Nghệ Sử Dụng (Technology Stack)

- **Ngôn ngữ & Runtime**: Node.js (v24+ ESM/CJS).
- **Bot Framework**: Telegraf 4.x (Telegram Bot API Framework).
- **Bóc Tách Chữ Viết Tay (Fast OCR)**: Google Cloud Vision API (`DOCUMENT_TEXT_DETECTION` - Chuyên dụng cho chữ viết tay mật độ cao tiếng Việt).
- **Trí Tuệ Nhân Tạo (AI LLM)**: Google Gemini AI (`@google/generative-ai` - Dynamic discovery model).
- **Cơ Sở Dữ Liệu (Database)**: Supabase Cloud PostgreSQL (Data Access Layer với Repositories Pattern & Audit Logs).
- **Unit Testing**: Node.js Native Test Runner (`node:test` & `node:assert` - 100% Zero Dependency).
- **Triển Khai (Deployment)**: Render.com Web Service / Background Worker (Vận hành 24/7).

---

## 📖 Bảng Tra Cứu Lệnh Telegram

### 📊 Lệnh Tra Cứu Báo Cáo & Tài Chính
| Lệnh | Mô tả |
| :--- | :--- |
| **`/today`** | Xem tổng hợp báo cáo thu chi, lợi nhuận ròng và doanh số nhân viên **hôm nay**. |
| **`/month`** hoặc **`/month YYYY-MM`** | Xem tổng hợp báo cáo **cả tháng** (tự động cộng dồn doanh thu & trừ tiền trả góp). |
| **`/luong`** hoặc **`/luong YYYY-MM`** | Xem bảng tổng hợp số công và tổng doanh số mang về của từng thợ trong tháng. |
| **`/export`** hoặc **`/export YYYY-MM`** | **Xuất file Excel/CSV báo cáo tháng** tải trực tiếp trên Telegram. |
| **`/search YYYY-MM-DD`** | Tra cứu tổng hợp thu chi của một **ngày cụ thể** bất kỳ. |
| **`/tragop`** | Xem danh sách các hợp đồng mua trả góp máy móc/thiết bị dài hạn đang chạy. |
| **`/myid`** | Xem Telegram User ID cá nhân và quyền hạn hiện tại của bạn. |
| **`/setadmin`** | Đăng ký làm Admin/Chủ tiệm (nếu hệ thống chưa có Admin). |

### 👑 Lệnh Dành Cho Admin (Quản Lý Nhân Viên & Hoa Hồng)
| Lệnh | Mô tả |
| :--- | :--- |
| **`/staff`** | Xem danh sách nhân viên hợp lệ hiện tại đang áp dụng. |
| **`/addstaff Tên1, Tên2`** | Thêm nhân viên mới vào danh sách đối chiếu. |
| **`/removestaff Tên`** | Xóa nhân viên đã nghỉ khỏi danh sách. |
| **`/setstaff Tên1, Tên2...`** | Đặt lại toàn bộ danh sách nhân viên chuẩn cho tiệm. |
| **`/setcommission <móng%> <mi%> <ngoài_giờ%>`** | Cài đặt tỷ lệ % hoa hồng doanh thu (Ví dụ: `/setcommission 10 30 50`). |

### ✏️ Lệnh Dành Cho Admin (Chỉnh Sửa & Xóa Thu Chi)
| Lệnh | Mô tả |
| :--- | :--- |
| **`/editrevenue <ID> <Tên> <Gội/Móng> <Mi> <NgoàiGiờ>`** | Sửa nhanh doanh số nhân viên (Ví dụ: `/editrevenue REP_12345 "Quỳnh Anh" 300k 400k 0`). |
| **`/editexpense <ID> <Số_tiền> <Ghi_chú>`** | Sửa khoản chi tiêu (Ví dụ: `/editexpense REP_12345 60k Mua nước đá`). |
| **`/deletereport <ID>`** | Xóa hoàn toàn 1 lượt báo cáo bị nhập sai hoặc trùng lặp. |
| **`/deleteragop <INS_ID>`** | Xóa 1 hợp đồng mua trả góp nếu nhập sai. |

---

## 🧪 Kiểm Thử Hệ Thống (Unit Testing)

Chạy bộ unit test tích hợp sẵn của Node.js:
```bash
npm test
```
- Kiểm tra quản lý bản nháp (Draft Store & Pending Edit State).
- Kiểm tra tạo bàn phím menu Sửa Nhanh & bản Copyable Text.
- Kiểm tra logic bóc tách Hybrid OCR & Google Cloud Vision API.
- Kiểm tra định dạng tin nhắn xem trước & cảnh báo an toàn.
