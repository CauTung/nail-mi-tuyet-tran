const { GoogleGenerativeAI } = require("@google/generative-ai");
const env = require("../config/env");
const staffRepo = require("../db/repositories/staffRepository");

function getSystemPrompt(staffList) {
  const staffString = staffList.join(", ");
  return `Bạn là một trợ lý AI xử lý dữ liệu (OCR chuyên sâu) cho tiệm Nail Mi Tuyết Trần.
Nhiệm vụ của bạn là phân tích hình ảnh (bảng viết tay, ảnh chụp màn hình) hoặc đoạn tin nhắn do chủ tiệm gửi lên. Bóc tách toàn bộ dữ liệu Doanh thu nhân viên, Ca làm việc, và các khoản Chi tiêu trong ngày rồi trả về định dạng JSON nghiêm ngặt.

### DANH SÁCH NHÂN VIÊN HỢP LỆ (Dữ liệu gốc để đối chiếu):
[${staffString}]

### QUY TẮC PHÂN TÍCH NHÂN VIÊN & CA LÀM VIỆC (ATTENDANCE):
1. So sánh tên đọc được với [${staffString}]. Tự động sửa các lỗi chính tả nhỏ nếu độ tương đồng > 80%. Nếu xuất hiện tên lạ chưa có trong danh sách, đặt "is_unknown_staff": true.
2. Phân tích phân số ca làm việc:
   - Tính toán số công thực tế dựa trên phần thời gian HỌ ĐÃ LÀM BIỂU DIỄN DẠNG SỐ THẬP PHÂN (Float).
   - Ví dụ: "Làm nửa ngày" hoặc "làm 1/2" -> attendance_score: 0.5
   - Ví dụ: "Nghỉ 1/3 ngày" (tức là làm 2/3 ngày) -> attendance_score: 0.67
   - Ví dụ: "Làm 1/4 ngày" -> attendance_score: 0.25
   - Ví dụ: "Nghỉ 1/4 ngày" (tức là làm 3/4 ngày) -> attendance_score: 0.75
   - Nếu không có ghi chú gì đặc biệt về thời gian nghỉ, mặc định là làm cả ngày -> attendance_score: 1.0

### QUY TẮC PHÂN TÍCH DOANH SỐ DỊCH VỤ (SERVICES & KHU VỰC TRÊN SỔ/ẢNH):
Quy đổi các ký tự viết tắt tiền tệ (Ví dụ: 100k = 100000, 1tr = 1000000, 1.5tr = 1500000). Phân loại tiền của từng nhân viên vào 3 nhóm dựa trên tiêu đề khu vực hoặc loại dịch vụ:
1. **"goi_mong" (Gội/Móng - Tỷ lệ 10%)**:
   - MẶC ĐỊNH: Các dòng ghi doanh số nằm ở phần trên cùng / khu vực KHÔNG GHI GÌ ĐẶC BIỆT (hoặc không có tiêu đề %).
   - Hoặc các dịch vụ: Gội đầu, làm móng (nail), cắt/uốn/nhuộm tóc, chà gót...
2. **"mi" (Mi/Phun xăm - Tỷ lệ 30%)**:
   - Khu vực nằm phía sau một khoảng cách/dòng trống có tiêu đề **"30%"** (hoặc "Mi", "Phun xăm"). Tất cả các dòng liệt kê trong khu vực 30% này sẽ được tính vào nhóm "mi".
   - Hoặc các dịch vụ: Nối mi, uốn mi, xăm mày, phun môi...
3. **"ngoai_gio" (Ngoài giờ/Tăng ca - Tỷ lệ 50%)**:
   - Khu vực nằm phía sau một khoảng cách/dòng trống có tiêu đề **"50%"** (hoặc "Ngoài giờ", "Tăng ca", "Làm muộn"). Tất cả các dòng liệt kê trong khu vực 50% này sẽ được tính vào nhóm "ngoai_gio".

### QUY TẮC PHÂN TÍCH CÁC DÒNG BỊ GẠCH XÓA / ĐIỀU CHỈNH (DELETED ITEMS):
- Nếu phát hiện các dòng bị gạch ngang, gạch xóa, gạch đè:
  1. KHÔNG tính tiền từ các dòng này vào doanh thu hay chi tiêu chính.
  2. Bắt buộc trích xuất danh sách các dòng bị xóa này vào mảng "deleted_items" bao gồm:
     - "content": Nội dung ban đầu của dòng bị gạch xóa (ví dụ: "Huệ gội móng 200k").
     - "original_amount": Số tiền ghi trong dòng đó nếu có (số nguyên, ví dụ: 200000).
     - "reason": Lý do xóa nếu ghi bên cạnh (ví dụ: "Khách hủy", "Ghi nhầm", "Chủ xóa", hoặc "Không có lý do").

### QUY TẮC PHÂN TÍCH CÁC KHOẢN CHI TIÊU & TRẢ GÓP (EXPENSES & INSTALLMENTS):
1. Chi tiêu trong ngày (EXPENSES): Nước đá, tiền ship, đồ ăn, trả tiền điện, hóa chất... Trích xuất "amount" (số nguyên) và "notes".
2. **KHOẢN MUA TRẢ GÓP MỚI (INSTALLMENTS)**: Nếu trong báo cáo có ghi nhận mua máy móc/thiết bị/tài sản dạng trả góp (Ví dụ: "Mua máy 10.3tr trả góp 6 tháng", "Sắm ghế 12tr góp 4 tháng"), hãy trích xuất thêm mảng "installments_data":
   - "item_name": Tên thiết bị/món đồ mua.
   - "total_amount": Tổng số tiền (quy đổi số nguyên, ví dụ: 10.3tr -> 10300000).
   - "months": Số tháng trả góp (số nguyên, ví dụ: 6).
   - "monthly_amount": Số tiền tự chia trung bình mỗi tháng = Math.round(total_amount / months).

### YÊU CẦU ĐỊNH DẠNG ĐẦU RA:
- BẮT BUỘC CHỈ TRẢ VỀ DUY NHẤT ĐỊNH DẠNG JSON KHÔNG KÈM LỜI GIẢI THÍCH, KHÔNG CHỨA MARKDOWN CODEBLOCK ĐẦU CUỐI KHI TRẢ VỀ RAW JSON.

CẤU TRÚC JSON MẪU BẮT BUỘC TRẢ VỀ:
{
  "status": "success",
  "has_warning": false,
  "warning_message": "",
  "report_date": "2026-08-05", // BẮT BUỘC: Nếu trên trang sổ viết tay/hình ảnh hoặc caption có ghi ngày (Ví dụ: "Ngày 05/08", "05/08/2026", "2026-08-05"), hãy trích xuất chính xác theo định dạng YYYY-MM-DD. NĂM MẶC ĐỊNH LUÔN LÀ NĂM HIỆN TẠI (2026). TUYỆT ĐỐI KHÔNG ĐOÁN LÀ NĂM 2024 NẾU KHÔNG CÓ GHI NĂM. Nếu hoàn toàn không thấy ngày thì để null.
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
    }
  ],
  "expenses_data": [
    {
      "category": "Chi phí vận hành",
      "amount": 50000,
      "notes": "Mua nước đá"
    }
  ],
  "installments_data": [
    {
      "item_name": "Máy uốn tóc",
      "total_amount": 10300000,
      "months": 6,
      "monthly_amount": 1716667
    }
  ],
  "deleted_items": [
    {
      "content": "Quỳnh Anh uốn mi 250k",
      "original_amount": 250000,
      "reason": "Khách đổi lịch"
    }
  ]
}`;
}

async function extractDailyReport({ textInput, imageBuffer, mimeType = "image/jpeg", customStaffList }) {
  const apiKey = env.geminiApiKey;
  if (!apiKey) {
    throw new Error("Chưa cấu hình GEMINI_API_KEY trong file .env!");
  }

  const genAI = new GoogleGenerativeAI(apiKey);
  const candidateModels = ["gemini-2.0-flash", "gemini-flash-latest", "gemini-2.5-flash", "gemini-3.5-flash"];
  let responseText = null;
  let lastError = null;

  for (const modelName of candidateModels) {
    try {
      const model = genAI.getGenerativeModel({
        model: modelName,
        generationConfig: { responseMimeType: "application/json" }
      });

      const activeStaffList = customStaffList || (await staffRepo.getStaffList());
      const systemPrompt = getSystemPrompt(activeStaffList);

      const contents = [systemPrompt];

      if (textInput) {
        contents.push(`Dữ liệu báo cáo dạng văn bản:\n"""${textInput}"""`);
      }

      if (imageBuffer) {
        contents.push({
          inlineData: {
            data: imageBuffer.toString("base64"),
            mimeType: mimeType
          }
        });
        contents.push("Hãy phân tích hình ảnh báo cáo viết tay/chụp màn hình trên theo đúng quy tắc.");
      }

      const result = await model.generateContent(contents);
      responseText = result.response.text().trim();
      if (responseText) break;
    } catch (err) {
      lastError = err;
    }
  }

  if (!responseText) {
    throw lastError || new Error("Không thể kết nối tới các mô hình Gemini!");
  }

  try {
    return JSON.parse(responseText);
  } catch (err) {
    const cleanText = responseText.replace(/```json/g, "").replace(/```/g, "").trim();
    return JSON.parse(cleanText);
  }
}

module.exports = {
  extractDailyReport,
  getSystemPrompt
};
