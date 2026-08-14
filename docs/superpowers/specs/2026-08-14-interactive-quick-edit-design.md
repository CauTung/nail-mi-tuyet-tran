# Design Spec: Interactive Quick Edit System for Daily Reports

## Overview
Dự án Telegram Bot AI OCR & Quản lý Báo cáo Thu Chi cho tiệm Nail Mi Tuyết Trần nâng cấp tính năng **Sửa Nhanh (Quick Edit)** từ dạng đính chính tự do thông thường thành **Hệ thống Sửa Nhanh Tương Tác (Smart Interactive Quick Edit)**.

Thay vì người dùng phải tự gõ câu văn đính chính không rõ cấu trúc, hệ thống cung cấp 2 phương thức linh hoạt:
1. **Interactive Menu (Nút bấm chọn mục cụ thể)**: Cho phép sửa Ngày, chỉnh từng Thợ/Doanh số, hoặc từng Khoản Chi trực tiếp bằng bàn phím Inline Keyboard.
2. **Copyable Text Format (Sao chép bản text mẫu & gửi lại)**: Xuất toàn bộ dữ liệu báo cáo dạng văn bản chuẩn cho phép người dùng copy, sửa lại nội dung và gửi lại bot để cập nhật.

---

## 1. Mục tiêu & Yêu cầu Kỹ thuật

### 1.1 Quản lý Trạng thái Bản Nháp (Draft State Management)
- Giữ vững cấu trúc `draftStore` (TTL 30 phút) và `pendingEdits` (TTL 15 phút) trong `confirmHandler.js`.
- Mở rộng lưu trữ trạng thái chỉnh sửa theo từng bước (Step-by-step Edit Session) khi người dùng đang trong luồng chọn nút sửa ngày, sửa thợ, sửa chi tiêu.

### 1.2 Interactive Edit Menu (`buildEditMenuKeyboards`)
Khi bấm `[✏️ Sửa Nhanh]`, bot gửi/cập nhật tin nhắn kèm Inline Keyboard:
- `[📅 Sửa Ngày Ghi Nhận]`
- `[👩‍🎨 Sửa Doanh Số Thợ]` | `[💸 Sửa Chi Tiêu]`
- `[➕ Thêm Thợ/Chi Mới]` | `[📋 Copy Text Để Sửa]`
- `[🔙 Quay Lại Xem Trước]`

### 1.3 Sub-menu & Trực tiếp Cập nhật Dữ liệu (Direct Data Editing)
- **Sửa Ngày (`edit_date`)**: Bot nhắc người dùng nhập chuỗi ngày mới. Khi nhận tin nhắn text chứa ngày (VD: `14/08` hoặc `2026-08-14`), bot parse ngày, cập nhật `draft.result.report_date` và tự động hiển thị lại Preview.
- **Sửa Thợ (`edit_staff_menu`)**: Bot liệt kê danh sách các thợ trong `draft.result.staff_data` dưới dạng nút bấm (kèm tổng tiền hiện tại). Khi bấm thợ cụ thể, bot lưu trạng thái `pending_edit_staff_<index>` và chờ người dùng nhập doanh số mới.
- **Sửa Chi Tiêu (`edit_expense_menu`)**: Liệt kê các khoản chi trong `draft.result.expenses_data`. Bấm vào mục để sửa số tiền hoặc xóa mục chi.
- **Copy Text (`copy_text_format`)**: Bot gửi 1 tin nhắn định dạng code block `📝 SỬA BÁO CÁO...` dễ sao chép. Khi người dùng copy và gửi lại bản text đã chỉnh sửa, bot dùng AI/Parser cập nhật `draft.result` và hiển thị lại Preview.

---

## 2. Luồng Dữ Liệu & Xử Lý Sự Kiện (Data & Event Flow)

```
[Bấm Sửa Nhanh]
      │
      ▼
[Hiển thị Interactive Edit Menu]
      │
      ├───────────────────────┬────────────────────────┬──────────────────────┐
      ▼                       ▼                        ▼                      ▼
[📅 Sửa Ngày]           [👩‍🎨 Sửa Thợ]           [💸 Sửa Chi Tiêu]      [📋 Copy Text Sửa]
      │                       │                        │                      │
Gửi nhắc nhập Ngày     Hiển thị list Thợ        Hiển thị list Chi      Gửi tin nhắn mẫu code block
      │                       │                        │                      │
Người dùng nhập Text   Chọn Thợ ➔ Nhập Tiền    Chọn Chi ➔ Nhập Tiền   Copy text & Gửi lại
      │                       │                        │                      │
      └───────────────────────┴────────────────────────┴──────────────────────┘
                                      │
                                      ▼
                        [Cập nhật draft.result]
                                      │
                                      ▼
                        [Cập nhật lại tin nhắn Preview]
```

---

## 3. Danh sách File và Thay Đổi Triển Khai (File Changes)

### 3.1 `bot/handlers/confirmHandler.js`
- Bổ sung các hàm helper tạo bàn phím menu sửa nhanh:
  - `buildEditMenuKeyboards(draftId)`
  - `buildStaffListKeyboards(draftId, staffData)`
  - `buildExpenseListKeyboards(draftId, expensesData)`
  - `formatCopyableText(reportData, targetDateStr)`
- Cập nhật `handleCallbackQuery(ctx)` xử lý các callback action mới:
  - `edit_date:<draftId>`
  - `edit_staff_menu:<draftId>`
  - `edit_staff_item:<draftId>:<index>`
  - `edit_expense_menu:<draftId>`
  - `edit_expense_item:<draftId>:<index>`
  - `copy_text_format:<draftId>`
  - `back_to_preview:<draftId>`

### 3.2 `bot/handlers/ocrHandler.js`
- Cập nhật hàm `handleOcrMessage`:
  - Phân loại tin nhắn phản hồi dựa vào `pendingEdit` state (nhập ngày, nhập tiền thợ, nhập khoản chi, hoặc gửi bản copy text).
  - Cập nhật chính xác thuộc tính trong `draft.result` và gửi lại bản tin nhắn Preview kèm bàn phím xác nhận.

---

## 4. Kế Hoạch Kiểm Thử (Verification Plan)

### 4.1 Check Cú Pháp Node.js
```bash
for f in $(find . -name "*.js" -not -path "*/node_modules/*"); do node -c "$f"; done
```

### 4.2 Kiểm thử chức năng
- Test nút bấm `[✏️ Sửa Nhanh]` ra menu tùy chọn.
- Test sửa ngày qua tin nhắn ngắn.
- Test sửa doanh số thợ trực tiếp.
- Test copy text và gửi lại bản text đã chỉnh sửa.
