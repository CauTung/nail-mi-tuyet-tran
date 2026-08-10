# 💅 Spa/Salon Daily OCR & Financial Telegram Bot 💇‍♀️

Hệ thống **Telegram Bot AI OCR & Quản lý Báo cáo Thu Chi Tự động** chuyên dụng cho tiệm Spa/Salon Tóc và Móng.

Bot ứng dụng mô hình **Google Gemini 2.0 Flash Vision AI** giúp tự động đọc hiểu hình ảnh (bảng viết tay, ảnh chụp màn hình) hoặc tin nhắn báo cáo hàng ngày từ chủ tiệm/thợ, bóc tách chuẩn xác 100% doanh thu nhân viên, ca làm việc (công), chi tiêu và tự động lên lịch mua trả góp dài hạn.

---

## 🌟 Tính Năng Nổi Bật

1. **OCR & Bóc Tách Đa Định Dạng (AI Vision)**:
   - Đọc chữ viết tay, ảnh bảng báo cáo, ảnh chụp màn hình hoặc tin nhắn văn bản.
   - Nhận diện phân số ca làm việc và tính công dạng thập phân (Float: `0.5`, `0.67`, `0.25`, `0.75`, `1.0`).
   - Tự động quy đổi mệnh giá tiền tệ (`100k` -> `100000`, `1.5tr` -> `1500000`).
   - Phân loại tiền của nhân viên thành 3 nhóm dịch vụ: **Gội/Móng/Tóc**, **Mi/Nối mi/Phun xăm**, **Ngoài giờ/Tăng ca**.

2. **Lưu Trữ Cơ Sở Dữ Liệu Ngăn Nắp (Theo Ngày / Tháng)**:
   - Dữ liệu được lưu trữ tự động theo cấu trúc `data/reports/YYYY-MM/YYYY-MM-DD.json`.
   - Hỗ trợ **nhập bổ sung báo cáo cho các ngày cũ trong quá khứ** (khi mới bắt đầu dùng ứng dụng) qua lệnh `/addpast` hoặc ghi trực tiếp ngày trong tin nhắn.

3. **Tự Động Phân Bổ Mua Trả Góp Cho Tháng Tương Lai**:
   - Khi báo cáo mua sắm thiết bị trả góp (Ví dụ: *"Mua máy uốn tóc 10.3tr trả góp 6 tháng"*), AI tự động chia đều tiền trả mỗi tháng.
   - **Tự động bắt đầu trừ vào Lợi Nhuận Ròng từ THÁNG SAU** và duy trì liên tục trong suốt kỳ trả góp.

4. **Bộ Lệnh Chỉnh Sửa & Xóa Thu Chi Linh Hoạt**:
   - Mỗi lượt báo cáo đều có **Mã ID duy nhất** (Ví dụ: `REP_1770714488123_456`).
   - Chủ tiệm có thể sửa doanh thu nhân viên (`/editrevenue`), sửa chi tiêu (`/editexpense`), hoặc xóa lượt báo cáo bị trùng/nhập sai (`/deletereport`).

5. **Phân Quyền Chủ Tiệm (Admin) Bảo Mật**:
   - Chỉ người dùng có Telegram User ID được cấp quyền Admin mới được thêm/xóa nhân viên và sửa/xóa dữ liệu báo cáo.

---

## 🛠 Hướng Dẫn Cài Đặt & Chạy Bot

### 1. Yêu cầu hệ thống
- **Node.js**: v18 trở lên (Khuyên dùng Node.js v20/v24).
- **Git**: Đã cài đặt trên máy.

### 2. Khởi tạo dự án
```bash
# Clone dự án từ GitHub
git clone git@github.com:CauTung/nail-mi-tuyet-tran.git
cd nail-mi-tuyet-tran

# Cài đặt các thư viện phụ thuộc
npm install
```

### 3. Cấu hình biến môi trường (`.env`)
Tạo file `.env` tại thư mục gốc (tham khảo từ file `.env.example`):
```env
TELEGRAM_BOT_TOKEN=8769874074:AAFvOTWWCpAZ_oz6i57TxCeY5WKd7lFXIwc
GEMINI_API_KEY=AIzaSy... (Điền API Key lấy từ Google AI Studio)
ADMIN_USER_IDS=5732312905 (ID Telegram của Chủ tiệm, phân cách bởi dấu phẩy)
```

> 💡 **Cách lấy GEMINI_API_KEY miễn phí**: Truy cập [https://aistudio.google.com/](https://aistudio.google.com/) -> Đăng nhập Gmail -> Bấm **"Get API Key"** -> Tạo Key mới và paste vào `.env`.

### 4. Khởi chạy Bot
```bash
npm start
```
Bot sẽ khởi chạy với thông báo: `🚀 Telegram Spa/Salon OCR Bot đã khởi chạy thành công!`.

---

## 📖 Bảng Tra Cứu Lệnh Telegram

### 📊 Lệnh Tra Cứu Báo Cáo & Tài Chính
| Lệnh | Mô tả |
| :--- | :--- |
| **`/today`** | Xem tổng hợp báo cáo thu chi, lợi nhuận ròng và doanh số nhân viên **hôm nay**. |
| **`/month`** hoặc **`/month YYYY-MM`** | Xem tổng hợp báo cáo **cả tháng** (tự động cộng dồn doanh thu & trừ tiền trả góp). |
| **`/search YYYY-MM-DD`** | Tra cứu tổng hợp thu chi của một **ngày cụ thể** bất kỳ. |
| **`/tragop`** | Xem danh sách các hợp đồng mua trả góp máy móc/thiết bị dài hạn đang chạy. |
| **`/myid`** | Xem Telegram User ID cá nhân và quyền hạn hiện tại của bạn. |
| **`/setadmin`** | Đăng ký làm Admin/Chủ tiệm (nếu hệ thống chưa có Admin). |

### 📅 Lệnh Nhập Báo Cáo Ngày Cũ
| Lệnh | Mô tả |
| :--- | :--- |
| **`/addpast YYYY-MM-DD Nội_dung`** | Nhập bổ sung báo cáo cho một ngày trong quá khứ (Ví dụ: `/addpast 2026-08-01 Quỳnh Anh gội móng 300k`). |

### 👑 Lệnh Dành Cho Admin (Quản Lý Nhân Viên)
| Lệnh | Mô tả |
| :--- | :--- |
| **`/staff`** | Xem danh sách nhân viên hợp lệ hiện tại đang áp dụng. |
| **`/addstaff Tên1, Tên2`** | Thêm nhân viên mới vào danh sách đối chiếu. |
| **`/removestaff Tên`** | Xóa nhân viên đã nghỉ khỏi danh sách. |
| **`/setstaff Tên1, Tên2...`** | Đặt lại toàn bộ danh sách nhân viên chuẩn cho tiệm. |

### ✏️ Lệnh Dành Cho Admin (Chỉnh Sửa & Xóa Thu Chi)
| Lệnh | Mô tả |
| :--- | :--- |
| **`/editrevenue <ID> <Tên> <Gội/Móng> <Mi> <NgoàiGiờ>`** | Sửa nhanh doanh số nhân viên (Ví dụ: `/editrevenue REP_12345 "Quỳnh Anh" 300k 400k 0`). |
| **`/editexpense <ID> <Số_tiền> <Ghi_chú>`** | Sửa khoản chi tiêu (Ví dụ: `/editexpense REP_12345 60k Mua nước đá`). |
| **`/deletereport <ID>`** | Xóa hoàn toàn 1 lượt báo cáo bị nhập sai hoặc trùng lặp. |
| **`/deleteragop <INS_ID>`** | Xóa 1 hợp đồng mua trả góp nếu nhập sai. |

---

## 📂 Cấu Trúc Thư Mục Dự Án

```text
nail-mi-tuyet-tran/
├── config/
│   └── staff.js                 # Module quản lý danh sách nhân viên
├── data/
│   ├── staff.json               # File lưu danh sách nhân viên
│   ├── admins.json              # File lưu Telegram User ID của Admin
│   ├── installments.json        # File lưu danh sách mua trả góp
│   └── reports/                 # Thư mục lưu báo cáo thu chi hàng ngày
│       └── YYYY-MM/
│           └── YYYY-MM-DD.json  # Chi tiết báo cáo từng ngày
├── services/
│   ├── geminiService.js         # Tích hợp Google Gemini Vision API
│   └── dbService.js             # Xử lý lưu trữ & tính toán lợi nhuận
├── .env.example                 # Mẫu file cấu hình môi trường
├── .gitignore                   # Ngăn đẩy secret key lên git
├── bot.js                       # Entrypoint khởi chạy Telegram Bot
├── package.json                 # Khai báo thư viện dự án
└── README.md                    # Tài liệu hướng dẫn sử dụng
```

---

## 📝 Giấy Phép & Đóng Góp
Dự án được xây dựng dành riêng cho tiệm Spa/Salon Tóc & Móng Tuyết Trần.
