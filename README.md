# 💅 Nail Mi Tuyết Trần - Daily OCR & Financial Telegram Bot 💇‍♀️

Hệ thống **Telegram Bot AI OCR & Quản lý Báo cáo Thu Chi Tự động** chuyên dụng cho tiệm **Nail Mi Tuyết Trần**.
Dự án được xây dựng chuẩn **Clean Architecture**, tích hợp **Google Gemini 2.0 Flash Vision AI** và **Supabase PostgreSQL Cloud Database** để vận hành 24/7 bền vững trên **Render.com**.

---

## 🏗️ Cấu Trúc Hệ Thống (Clean Architecture)

```text
nail-mi-tuyet-tran/
├── config/
│   ├── env.js                      # Đọc & kiểm tra biến môi trường (.env)
│   └── supabase.js                 # Khởi tạo kết nối Supabase Client
├── db/
│   ├── schema.sql                  # Script tạo 6 bảng dữ liệu trên Supabase
│   ├── migrateFromJson.js          # Script tự động đẩy file JSON cũ lên Supabase
│   └── repositories/               # Tầng tương tác Cơ sở dữ liệu (Data Access Layer)
│       ├── staffRepository.js      # CRUD danh sách nhân viên
│       ├── adminRepository.js      # Quản lý phân quyền Admin
│       ├── configRepository.js     # Cấu hình hoa hồng %
│       ├── reportRepository.js     # Lưu/Sửa/Xóa báo cáo thu chi
│       └── installmentRepository.js# Quản lý hợp đồng mua trả góp
├── services/
│   ├── aiService.js                # Xử lý OCR hình ảnh & tin nhắn bằng Gemini Vision AI
│   ├── financialService.js         # Logic tính toán tổng hợp thu chi, % lương thợ, lợi nhuận
│   └── exportService.js            # Xuất file báo cáo Excel/CSV UTF-8
├── bot/
│   ├── middlewares/
│   │   └── authMiddleware.js       # Phân quyền Admin Telegram
│   ├── handlers/
│   │   ├── ocrHandler.js           # Xử lý tin nhắn & hình ảnh báo cáo OCR
│   │   ├── queryHandler.js         # Các lệnh tra cứu: /today, /month, /luong, /export, /search, /tragop...
│   │   └── adminHandler.js         # Các lệnh Admin: /staff, /setcommission, /editrevenue, /deletereport...
│   └── botApp.js                   # Đăng ký Router & Handler cho Telegraf Bot
├── bot.js                          # Entrypoint khởi chạy ứng dụng chính
├── package.json                    # Thư viện phụ thuộc & script
└── README.md                       # Tài liệu hướng dẫn hệ thống
```

---

## ⚡ Hướng Dẫn Cấu Hình Supabase (Cloud Database)

1. Truy cập [https://supabase.com/](https://supabase.com/) ➔ Đăng ký/Đăng nhập tài khoản miễn phí.
2. Tạo một **New Project** mới.
3. Vào mục **SQL Editor** trong thanh menu bên trái ➔ Mở file [`db/schema.sql`](file:///c:/Users/laptop/Documents/nail-mi-tuyet-tran/db/schema.sql) trong dự án ➔ Copy toàn bộ nội dung dán vào và nhấn **RUN**.
4. Vào mục **Project Settings** ➔ **API** ➔ Copy 2 thông số:
   * **Project URL**: `SUPABASE_URL`
   * **anon public key**: `SUPABASE_KEY`

---

## 🚀 Đẩy Dữ Liệu Cũ Lên Supabase (Migration)

Nếu bạn đã dùng bot trước đây và có các file báo cáo JSON trong thư mục `data/`:
1. Điền `SUPABASE_URL` và `SUPABASE_KEY` vào file `.env`.
2. Chạy lệnh migration:
```bash
npm run migrate
```
Toàn bộ nhân viên, admin, hợp đồng trả góp và các bài báo cáo cũ sẽ được tự động đồng bộ lên Supabase!

---

## 🌐 Cấu Hình Chạy 24/7 Trên Render.com

1. Đăng nhập vào [Render.com](https://render.com/).
2. Chọn **New +** ➔ **Web Service** (hoặc Background Worker).
3. Kết nối với Repository GitHub dự án này.
4. Cấu hình các thông số:
   * **Runtime**: `Node`
   * **Build Command**: `npm install`
   * **Start Command**: `npm start`
5. Trong mục **Environment Variables**, thêm các biến sau:
   * `TELEGRAM_BOT_TOKEN`: Token bot lấy từ BotFather.
   * `GEMINI_API_KEY`: API Key lấy từ Google AI Studio.
   * `ADMIN_USER_IDS`: Telegram User ID của chủ tiệm.
   * `SUPABASE_URL`: URL project Supabase.
   * `SUPABASE_KEY`: Anon Key của Supabase.
6. Nhấn **Create Web Service**. Bot sẽ chạy online 24/7 và lưu trữ dữ liệu an toàn trên Supabase mà không sợ mất file!

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
