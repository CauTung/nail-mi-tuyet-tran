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

### 5. ⏰ Nhắc Nhở & Tự Động Chốt Bản Nháp (Safe Guard Timers & Persistence)
- **Nhắc nhở sau 3 phút**: Bot chủ động gửi tin nhắn cảnh báo nếu người dùng quên nhấn nút Xác Nhận/Ghi Đè báo cáo.
- **Tự động chốt lưu sau 10 phút**: Tự động lưu bản nháp vào hệ thống và CSDL Supabase nếu sau 10 phút không có tương tác, đảm bảo số liệu không bao giờ bị thất thoát.
- **Bảo toàn dữ liệu khi Server Restart**: Lưu đệm bản nháp vào `data/pending_drafts.json`, tự động khôi phục bản nháp và bộ đếm giờ khi Bot khởi động lại.

### 6. 📊 Đồ Họa Biểu Đồ Doanh Thu Trực Quan (Visual QuickChart)
- **Hình ảnh biểu đồ `/month`**: Tự động sinh bức ảnh Infographic biểu đồ doanh số từng thợ sắc nét gửi trực tiếp qua Telegram cùng báo cáo tổng kết tháng.
- **Danh mục dịch vụ động (Dynamic Categories)**: Cho phép Admin thêm/xóa/sửa các hạng mục dịch vụ salon (`/categories`, `/addcategory`, `/delcategory`) tùy ý mà không cần sửa code.

---

## 🛠️ Công Nghệ Sử Dụng (Technology Stack)

- **Ngôn ngữ & Runtime**: Node.js (v24+ ESM/CJS).
- **Bot Framework**: Telegraf 4.x (Telegram Bot API Framework).
- **Bóc Tách Chữ Viết Tay (Fast OCR)**: Google Cloud Vision API (`DOCUMENT_TEXT_DETECTION` - Chuyên dụng cho chữ viết tay mật độ cao tiếng Việt).
- **Trí Tuệ Nhân Tạo (AI LLM)**: Google Gemini AI (`@google/generative-ai` - Dynamic discovery model).
- **Đồ Họa Biểu Đồ**: QuickChart API Serverless rendering.
- **Cơ Sở Dữ Liệu (Database)**: Supabase Cloud PostgreSQL (Data Access Layer với Repositories Pattern & Audit Logs).
- **Unit Testing**: Node.js Native Test Runner (`node:test` & `node:assert` - 100% Zero Dependency).
- **Triển Khai (Deployment)**: Render.com Web Service / Background Worker (Vận hành 24/7).

---

## 🔑 Hướng Dẫn Lấy Các API Key & Cấu Hình Môi Trường (.env)

Tạo file `.env` từ file mẫu `.env.example` và điền các thông số sau:

### 1. `TELEGRAM_BOT_TOKEN` (Token Bot Telegram)
1. Mở ứng dụng Telegram, tìm kiếm bot **`@BotFather`**.
2. Gõ lệnh `/newbot` và làm theo hướng dẫn (đặt tên cho Bot và chọn username kết thúc bằng `_bot`).
3. Sao chép chuỗi **HTTP API Token** nhận được (Ví dụ: `8769874074:AAFvOTWWCpAZ...`).

### 2. `GEMINI_API_KEY` & `GOOGLE_VISION_API_KEY` (Google AI & Vision OCR Key)
1. Truy cập **Google AI Studio**: [https://aistudio.google.com/app/apikey](https://aistudio.google.com/app/apikey).
2. Đăng nhập tài khoản Google ➔ Nhấn **Create API key** ➔ Sao chép mã API Key được cấp.
3. *(Tùy chọn cho Hybrid OCR)*: Trong [Google Cloud Console](https://console.cloud.google.com/apis/library/vision.googleapis.com), tìm kiếm **Cloud Vision API** và nhấn **Enable** cho dự án tương ứng. (Mã API Key từ Google AI Studio có thể dùng chung cho cả Gemini LLM và Google Cloud Vision OCR).

### 3. `ADMIN_USER_IDS` (ID Telegram Chủ Tiệm / Admin)
1. Mở Telegram, tìm kiếm bot **`@userinfobot`** ➔ Gõ `/start`.
2. Sao chép dãy số `Id` cá nhân của bạn (Ví dụ: `5732312905`).
3. Nếu tiệm có nhiều Admin/Chủ tiệm, điền các ID phân cách bởi dấu phẩy: `5732312905,987654321`.

### 4. `SUPABASE_URL` & `SUPABASE_KEY` (Cơ Sở Dữ Liệu Cloud)
1. Truy cập [https://supabase.com/](https://supabase.com/) ➔ Đăng ký/Đăng nhập ➔ Chọn **New Project**.
2. Sau khi khởi tạo dự án, vào menu **Project Settings** bên dưới góc trái ➔ chọn mục **API**.
3. Sao chép 2 thông số:
   - **Project URL**: Gán cho `SUPABASE_URL`
   - **anon public key**: Gán cho `SUPABASE_KEY`
4. Vào mục **SQL Editor** trên Supabase ➔ Mở file [`db/schema.sql`](file:///var/www/html/tuyet-tran/db/schema.sql) trong dự án ➔ Copy toàn bộ mã SQL dán vào và nhấn **RUN** để khởi tạo các bảng dữ liệu.

---

## 📖 Bảng Tra Cứu Lệnh Telegram

### 📊 Lệnh Tra Cứu Báo Cáo & Tài Chính
| Lệnh | Mô tả |
| :--- | :--- |
| **`/today`** | Xem tổng hợp báo cáo thu chi, lợi nhuận ròng và doanh số nhân viên **hôm nay**. |
| **`/month`** hoặc **`/month YYYY-MM`** | Xem tổng hợp báo cáo **cả tháng** kèm **ảnh biểu đồ trực quan** (tự động cộng dồn doanh thu & trừ tiền trả góp). |
| **`/luong`** hoặc **`/luong YYYY-MM`** | Xem bảng tổng hợp số công và tổng doanh số mang về của từng thợ trong tháng. |
| **`/export`** hoặc **`/export YYYY-MM`** | **Xuất file Excel/CSV báo cáo tháng** tải trực tiếp trên Telegram. |
| **`/search YYYY-MM-DD`** | Tra cứu tổng hợp thu chi của một **ngày cụ thể** bất kỳ. |
| **`/tragop`** | Xem danh sách các hợp đồng mua trả góp máy móc/thiết bị dài hạn đang chạy. |
| **`/myid`** | Xem Telegram User ID cá nhân và quyền hạn hiện tại của bạn. |
| **`/setadmin`** | Đăng ký làm Admin/Chủ tiệm (nếu hệ thống chưa có Admin). |

### 👑 Lệnh Dành Cho Admin (Quản Lý Nhân Viên & Danh Mục Dịch Vụ)
| Lệnh | Mô tả |
| :--- | :--- |
| **`/categories`** | Xem danh sách các danh mục dịch vụ và tỷ lệ hoa hồng hiện tại. |
| **`/addcategory <mã> <Tên> <hoa_hồng%>`** | Thêm danh mục dịch vụ mới (Ví dụ: `/addcategory goi_duong_sinh "Gội dưỡng sinh" 20`). |
| **`/delcategory <mã>`** | Xóa danh mục dịch vụ khỏi hệ thống. |
| **`/setcommission <mã_dịch_vụ> <hoa_hồng%>`** | Cài đặt tỷ lệ % hoa hồng cho dịch vụ (Ví dụ: `/setcommission mi 35`). |
| **`/staff`** | Xem danh sách nhân viên hợp lệ hiện tại đang áp dụng. |
| **`/addstaff Tên1, Tên2`** | Thêm nhân viên mới vào danh sách đối chiếu. |
| **`/removestaff Tên`** | Xóa nhân viên đã nghỉ khỏi danh sách. |
| **`/setstaff Tên1, Tên2...`** | Đặt lại toàn bộ danh sách nhân viên chuẩn cho tiệm. |

### ✏️ Lệnh Dành Cho Admin (Chỉnh Sửa & Xóa Thu Chi)
| Lệnh | Mô tả |
| :--- | :--- |
| **`/editrevenue <ID> <Tên> <DoanhSố>`** | Sửa nhanh doanh số nhân viên (Ví dụ: `/editrevenue REP_12345 "Quỳnh Anh" 300k`). |
| **`/editexpense <ID> <Số_tiền> <Ghi_chú>`** | Sửa khoản chi tiêu (Ví dụ: `/editexpense REP_12345 60k Mua nước đá`). |
| **`/deletereport <ID>`** | Xóa hoàn toàn 1 lượt báo cáo bị nhập sai hoặc trùng lặp. |
| **`/deleteragop <INS_ID>`** | Xóa 1 hợp đồng mua trả góp nếu nhập sai. |

---

## 🧪 Kiểm Thử Hệ Thống (Unit Testing)

Chạy bộ unit test tích hợp sẵn của Node.js:
```bash
npm test
```
- Kiểm tra quản lý bản nháp & đếm giờ tự động chốt lưu (Draft Store, Safe Guard Timers & File Persistence).
- Kiểm tra tạo bàn phím menu Sửa Nhanh & bản Copyable Text.
- Kiểm tra logic bóc tách Hybrid OCR & Google Cloud Vision API.
- Kiểm tra tạo hình ảnh biểu đồ QuickChart (`chartService.test.js`).
- Kiểm tra quản lý danh mục dịch vụ động (`dynamicCategories.test.js`).

