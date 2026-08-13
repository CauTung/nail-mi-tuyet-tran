require("dotenv").config();
const { extractDailyReport } = require("./services/aiService");
const { getSystemPrompt } = require("./config/prompts");
const staffRepo = require("./db/repositories/staffRepository");

async function runTest() {
  console.log("=== KIỂM TRA HỆ THỐNG OCR & BÓC TÁCH DỮ LIỆU SPA/SALON ===");
  console.log("\n1. Danh sách nhân viên hợp lệ hiện tại:", getStaffList());
  
  console.log("\n2. System Prompt đã khởi tạo:");
  console.log("--------------------------------------------------");
  console.log(getSystemPrompt(getStaffList()));
  console.log("--------------------------------------------------");

  const sampleText = `
Báo cáo ngày 10/08:
- Quỳnh Anh: gội móng 200k, làm mi 500k. Hôm nay làm cả ngày.
- Huệ: gội móng 300k, tăng ca 100k. Làm cả ngày.
- Chi phí: Mua nước đá 50k, Trả góp máy uốn tóc 1.717k (kỳ 1/6).
  `.trim();

  console.log("\n3. Thử nghiệm bóc tách đoạn văn bản mẫu:");
  console.log(`"""\n${sampleText}\n"""`);

  if (!process.env.GEMINI_API_KEY || process.env.GEMINI_API_KEY === "your_gemini_api_key_here") {
    console.log("\n⚠️ [GHI CHÚ] Chưa cài đặt GEMINI_API_KEY thực tế trong file .env.");
    console.log("Mô phỏng JSON kết quả đầu ra theo đúng quy chuẩn khi API hoạt động:");
    const mockOutput = {
      "status": "success",
      "has_warning": false,
      "warning_message": "",
      "staff_data": [
        {
          "name": "Hoa",
          "is_unknown_staff": false,
          "attendance_description": "Nghỉ 1/4 ngày (Làm 3/4 ngày)",
          "attendance_score": 0.75,
          "revenue": {
            "goi_mong": 200000,
            "mi": 500000,
            "ngoai_gio": 0
          }
        },
        {
          "name": "Lan",
          "is_unknown_staff": false,
          "attendance_description": "Làm cả ngày",
          "attendance_score": 1.0,
          "revenue": {
            "goi_mong": 300000,
            "mi": 0,
            "ngoai_gio": 100000
          }
        },
        {
          "name": "Vy",
          "is_unknown_staff": false,
          "attendance_description": "Làm 1/2 ngày",
          "attendance_score": 0.5,
          "revenue": {
            "goi_mong": 0,
            "mi": 400000,
            "ngoai_gio": 0
          }
        }
      ],
      "expenses_data": [
        {
          "category": "Chi phí vận hành",
          "amount": 50000,
          "notes": "Mua nước đá và nước ngọt"
        },
        {
          "category": "Tiền hàng",
          "amount": 350000,
          "notes": "Trả tiền ship và keo nối mi"
        }
      ]
    };
    console.log(JSON.stringify(mockOutput, null, 2));
    return;
  }

  try {
    console.log("\n⏳ Đang gọi Gemini API...");
    const result = await extractDailyReport({ textInput: sampleText });
    console.log("\n✅ Kết quả bóc tách thực tế từ Gemini API:");
    console.log(JSON.stringify(result, null, 2));
  } catch (err) {
    console.error("\n❌ Lỗi gọi Gemini API:", err.message);
  }
}

runTest();
