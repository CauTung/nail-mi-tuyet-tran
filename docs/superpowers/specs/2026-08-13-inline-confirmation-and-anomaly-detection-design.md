# Design Spec: Inline Keyboard Confirmation & Anomaly Warning System

## Overview
Dự án Telegram Bot AI OCR & Quản lý Báo cáo Thu Chi cho tiệm Nail Mi Tuyết Trần cần hoàn thiện tính năng **Inline Keyboard Confirmation** và **Cảnh báo Bất thường (Anomaly Detection)**.

Hệ thống cho phép chủ tiệm hoặc thợ gửi ảnh chụp sổ tay hoặc tin nhắn báo cáo. Bot sử dụng Gemini Vision AI để bóc tách thông tin, tạo bản nháp (Draft) và gửi bản **Xem Trước (Preview)** kèm các nút thao tác nhanh trên Telegram (Xác Nhận, Cộng Dồn, Ghi Đè, Hủy Bỏ) trước khi ghi chính thức vào CSDL Supabase.

---

## 1. Mục tiêu & Yêu cầu Hệ thống

### 1.1 Sửa triệt để các lỗi Cú pháp (Syntax Errors)
- **`config/prompts.js`**: Escape toàn bộ các ký tự backtick (`` ` ``) chưa thoát trong chuỗi template string.
- **`services/aiService.js`**: Sửa đoạn mã prompt bị dán đè nhầm ở đầu file và lỗi thiếu câu lệnh đóng kiểm tra `if (!responseText)`.
- **`bot/handlers/ocrHandler.js`**: Sửa lỗi khai báo trùng lặp biến `existingReports`.

### 1.2 Luồng Inline Keyboard Confirmation
- Tách biệt giai đoạn **Bóc tách AI ➔ Xem Trước (Preview)** với giai đoạn **Ghi nhận vào CSDL (Save to DB)**.
- Quản lý bản nháp `draftStore` bằng `Map` trong bộ nhớ RAM server với `TTL` = 30 phút.
- Gửi tin nhắn xem trước cấu trúc Markdown rõ ràng, hiển thị tổng doanh thu, chi tiêu, thực nhận, danh sách thợ và các cảnh báo.
- Bàn phím nút bấm linh hoạt:
  - Nếu ngày mới chưa có báo cáo: `[✅ Xác Nhận Lưu]` | `[❌ Hủy Bỏ]`.
  - Nếu ngày đã có báo cáo cũ: `[➕ Cộng Dồn Lượt Mới]` | `[🔄 Ghi Đè Bản Cũ]` | `[❌ Hủy Bỏ]`.

### 1.3 Hệ thống Cảnh báo Bất thường (Anomaly & Safety Warning System)
- **Tên thợ lạ (`is_unknown_staff`)**: Cảnh báo `⚠️ *(Tên mới chưa có trong hệ thống)*`. Khi xác nhận lưu, tự động ghi nhận tên thợ mới vào bảng nhân viên (`staffRepository`).
- **Độ tin cậy ngày (`date_confidence`)**: Cảnh báo nếu `confidence === "low"` (không thấy ngày viết tay, dùng ngày hiện tại).
- **Doanh số 1 thợ cao bất thường**: Cảnh báo nếu doanh số 1 thợ > 5,000,000đ.
- **Tổng doanh số ngày cao bất thường**: Cảnh báo nếu tổng doanh số > 15,000,000đ.
- **Khoản chi tiêu lớn**: Cảnh báo nếu 1 khoản chi > 2,000,000đ.

---

## 2. Kiến trúc & Luồng Dữ Liệu (Data Flow)

```
[Người dùng gửi Ảnh / Tin nhắn]
             │
             ▼
   [ocrHandler.js] ──▶ Gọi aiService.extractDailyReport()
             │
             ▼
   [Hệ thống AI Gemini bóc tách JSON]
             │
             ▼
   [confirmHandler.saveDraft()] ──▶ Lưu bản nháp vào draftStore (30m TTL)
             │
             ▼
   [confirmHandler.formatPreviewResponse()] ──▶ Kiểm tra Anomaly & Tạo Markdown
             │
             ▼
   [bot.reply()] ──▶ Hiển thị Tin nhắn Preview + Inline Keyboard Buttons
             │
   ┌─────────┴─────────────────────────────┐
   ▼                                       ▼
[Người dùng chọn Xác Nhận / Cộng Dồn / Ghi Đè]   [Người dùng chọn Hủy Bỏ]
   │                                       │
   ▼                                       ▼
Lưu DB (reportRepo.saveReport)           Xóa draft khỏi RAM
Xóa draft khỏi RAM                       Cập nhật tin nhắn ❌ Đã hủy
Cập nhật tin nhắn ✅ Đã lưu
```

---

## 3. Chi Tiết Thay Đổi File (File Changes)

### 3.1 `config/prompts.js`
- Escape tất cả các ký tự backtick `` ` `` xuất hiện trong câu chữ mô tả prompt (ví dụ: `` \`date_confidence\` ``) để tránh làm vỡ chuỗi template JavaScript.

### 3.2 `services/aiService.js`
- Làm sạch đầu file: Giữ lại các lệnh import chuẩn (`GoogleGenerativeAI`, `env`, `staffRepo`, `getSystemPrompt`, `fetch`).
- Sửa lại hàm `extractDailyReport`: Đảm bảo `if (!responseText)` kiểm tra chính xác và throw error phù hợp khi không kết nối được Gemini API.

### 3.3 `bot/handlers/ocrHandler.js`
- Xóa dòng khai báo trùng lặp `const existingReports` ở dòng 109.
- Sử dụng kết quả `existingReports` đã lấy trước đó hoặc truyền đúng tham số cho `confirmHandler.formatPreviewResponse` và `confirmHandler.buildPreviewKeyboards`.

### 3.4 `bot/handlers/confirmHandler.js`
- Cập nhật hàm `formatPreviewResponse(reportData, targetDateStr, confidence, dateReasoning, existingCount)`:
  - Thêm logic kiểm tra Anomaly (Doanh số thợ > 5tr, tổng doanh số > 15tr, chi tiêu > 2tr).
  - Định dạng hiển thị warning rõ ràng bằng emoji `⚠️`, `🚨`, `💰`, `💸`.
- Cập nhật hàm `handleCallbackQuery(ctx)`:
  - Kiểm tra xem draft còn tồn tại không. Nếu hết hạn, phản hồi `ctx.answerCbQuery` và sửa tin nhắn báo hết hạn.
  - Xử lý `confirm_save` / `confirm_append`: Gọi `saveReport` với `replacement_mode: "append"`, lưu audit log `CREATE`, tự động lưu tên nhân viên mới nếu `is_unknown_staff === true`.
  - Xử lý `confirm_overwrite`: Gọi `saveReport` với `replacement_mode: "replace_all"`, lưu audit log `OVERWRITE`.
  - Xử lý `cancel_report`: Xóa draft, sửa tin nhắn báo đã hủy.

---

## 4. Kế Hoạch Kiểm Thử & Xác Minh (Verification Plan)

### 4.1 Automated Syntax Testing
- Chạy `node -c` đối với tất cả các file trong dự án để đảm bảo 100% không còn lỗi cú pháp:
```bash
for f in $(find . -name "*.js" -not -path "*/node_modules/*"); do node -c "$f"; done
```

### 4.2 Unit & Integration Verification
- Kiểm tra các hàm của `confirmHandler` (`saveDraft`, `getDraft`, `formatPreviewResponse`, `buildPreviewKeyboards`, `handleCallbackQuery`).
- Kiểm tra việc gọi `confirmHandler` từ `ocrHandler` đối với ảnh đơn, album ảnh, và tin nhắn văn bản.
