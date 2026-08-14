# Design Spec: Hybrid OCR Architecture (Google Cloud Vision OCR + Gemini Text LLM)

## Overview
Nâng cấp hiệu năng bóc tách dữ liệu ảnh sổ tay cho Telegram Bot tiệm Nail Mi Tuyết Trần. Thay vì gửi toàn bộ file ảnh dung lượng lớn trực tiếp tới Gemini Vision API (mất 3-6s), hệ thống áp dụng **Kiến trúc Hybrid OCR 2 bước (Google Cloud Vision OCR ➔ Gemini Text LLM)** giúp rút ngắn thời gian xử lý xuống dưới **1 giây**.

---

## 1. Mục tiêu & Chỉ số Hiệu năng (Performance Metrics)

- **Tốc độ bóc tách ảnh (OCR Latency)**: Giảm từ ~4.5s xuống dưới **1.0s**.
- **Độ chính xác chữ viết tay (Handwriting Accuracy)**: Sử dụng tính năng `DOCUMENT_TEXT_DETECTION` của Google Cloud Vision API - thuật toán chuyên biệt cho văn bản viết tay mật độ cao tiếng Việt.
- **Tính sẵn sàng (High Availability & Graceful Fallback)**: Tự động dự phòng về Gemini Vision API nguyên bản nếu gặp sự cố kết nối API Vision hoặc thiếu cấu hình key.

---

## 2. Kiến trúc & Luồng Xử Lý Dữ Liệu

```
[Ảnh sổ tay Telegram]
        │
        ▼
 [ocrService.extractTextFromImage()]
        │
        ├──▶ 1. Chuyển buffer thành Base64 & gọi Google Cloud Vision REST API (DOCUMENT_TEXT_DETECTION)
        │       ⏱️ Latency: ~300ms - 500ms
        │       📄 Trả về: fullTextAnnotation.text (Chuỗi chữ thô viết tay)
        │
        ▼
 [aiService.extractDailyReport()]
        │
        ├──▶ 2. Chuyển chuỗi text thô thu được vào Gemini Text Model
        │       ⏱️ Latency: ~300ms
        │       🧠 Trả về: Object JSON bóc tách chuẩn
        │
        ▼
[Bản nháp Xem Trước Telegram (Preview)] ⚡ TỔNG THỜI GIAN: ~0.8s - 1.2s
```

---

## 3. Chi Tiết Các File Thay Đổi (File Changes)

### 3.1 `services/ocrService.js` [NEW]
Module chuyên trách giao tiếp với Google Cloud Vision REST API:
- Hàm `extractTextFromImage(imageBuffer)`:
  - Base64 encode `imageBuffer`.
  - POST request tới `https://vision.googleapis.com/v1/images:annotate?key=GOOGLE_VISION_API_KEY` (hoặc dùng `GEMINI_API_KEY` nếu key bật chung dịch vụ Google Cloud).
  - Trích xuất `fullTextAnnotation.text`.

### 3.2 `services/aiService.js` [MODIFY]
- Nâng cấp `extractDailyReport({ textInput, imageBuffer, imageBuffers, ... })`:
  - Nếu truyền `imageBuffer` hoặc `imageBuffers`:
    - Gọi `ocrService.extractTextFromImage()` lấy chuỗi văn bản bóc tách.
    - Nếu thành công:Ghép text thô thu được thành `ocrExtractedText`, chuyển sang chế độ gọi Gemini Text Model (chỉ xử lý prompt văn bản).
    - Nếu thất bại/lỗi API Vision: Tự động fallback chuyển buffer sang Gemini Vision multimodal nguyên bản.

### 3.3 `tests/ocrService.test.js` [NEW]
- Thêm unit test kiểm tra module `ocrService` bóc tách văn bản, fallback error handling.

---

## 4. Kế Hoạch Kiểm Thử & Xác Minh (Verification Plan)

### 4.1 Unit Test Execution
```bash
npm test
```
Xác minh 100% unit test suite chạy pass (bao gồm `tests/ocrService.test.js`).

### 4.2 Measure Processing Speed
- Benchmark thời gian xử lý ảnh trước và sau khi nâng cấp hybrid OCR.
