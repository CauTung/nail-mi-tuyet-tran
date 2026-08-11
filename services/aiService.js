const { GoogleGenerativeAI } = require("@google/generative-ai");
const env = require("../config/env");
const staffRepo = require("../db/repositories/staffRepository");

function getSystemPrompt(staffList) {
  const staffString = staffList.join(", ");
  return `Bạn là một trợ lý AI xử lý dữ liệu (OCR chuyên sâu) cho tiệm Nail Mi Tuyết Trần.
Nhiệm vụ của bạn là phân tích hình ảnh (bảng viết tay, ảnh chụp màn hình) hoặc đoạn tin nhắn do chủ tiệm gửi lên. Bóc tách toàn bộ dữ liệu Doanh thu nhân viên, Ca làm việc, và các khoản Chi tiêu trong ngày rồi trả về định dạng JSON nghiêm ngặt.

### DANH SÁCH NHÂN VIÊN HỢP LỆ (Dữ liệu gốc để đối chiếu):
[${staffString}]

### QUY TẮC QUY ĐỔI NICKNAME & TÊN VIẾT TẮT SỔ TAY:
1. BẮT BUỘC quy đổi các tên viết tắt, tên gọi tắt hoặc biệt danh trên sổ về đúng tên nhân viên chính thức trong [${staffString}]:
   - "QA", "Q.Anh", "Quỳnh anh", "Quynh anh" ➔ quy về "Quỳnh Anh"
   - "Cúc", "cúc", "chị Cúc", "Cúc chị" ➔ quy về "chị Cúc"
   - "Tuyết", "bà chủ", "Tuyết Trần", "chị Tuyết" ➔ quy về "bà chủ Tuyết Trần"
   - "Huệ", "hue" ➔ quy về "Huệ"
   - "Thảo", "Công chúa", "thảo", "thao", "công chúa", "Thảo công chúa" ➔ quy về "Thảo"
   - "Nhi", "nhi" ➔ quy về "Nhi"
2. So sánh tên đọc được với [${staffString}]. Tự động sửa các lỗi chính tả nhỏ nếu độ tương đồng > 80%. Nếu xuất hiện tên lạ chưa có trong danh sách, đặt "is_unknown_staff": true.
3. Trong "staff_data", thuộc tính "name" là BẮT BUỘC (chứa tên nhân viên chuẩn). KHÔNG ĐƯỢC ĐỂ TRỐNG Hoặc ĐỔI THÀNH TÊN KHÁC.

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

### QUY TẮC SO SÁNH VỚI DỮ LIỆU ĐÃ CÓ TRONG NGÀY (EXISTING REPORTS):
Nếu có danh sách các lượt báo cáo đã gửi trước đó trong cùng ngày:
1. Thay thế / Cập nhật bản mới nhất (replacement_mode là replace_all): Nếu tin nhắn hoặc ảnh mới là BẢN TỔNG KẾT CUỐI NGÀY hoặc BẢN SỬA LẠI (chủ tiệm hoặc thợ chụp lại trang sổ toàn bộ ngày hay gửi bản đính chính), hãy tổng hợp số liệu chuẩn mới nhất của cả ngày và chọn replacement_mode là replace_all.
2. Cộng dồn bổ sung (replacement_mode là append): Nếu tin nhắn hoặc ảnh mới chỉ là lượt làm riêng biệt/bổ sung thêm của thợ khác gửi mà chưa có trong báo cáo trước, chọn replacement_mode là append.

### QUY TẮC PHÂN BIỆT BÁO CÁO THU CHI VS TRÒ CHUYỆN THÔNG THƯỜNG (CHAT):
1. BÁO CÁO THU CHI (is_financial_report là true): Tin nhắn hoặc hình ảnh có chứa số tiền, tên nhân viên, công xá, dịch vụ gội/móng/mi/tóc, chi tiêu, hoặc ảnh chụp trang sổ báo cáo.
2. TRÒ CHUYỆN / HỎI ĐÁP THÔNG THƯỜNG (is_financial_report là false):
   - Các câu hỏi chào hỏi, hỏi thời tiết, hỏi công thức/kinh nghiệm làm nail, mi, tóc, tư vấn khách hàng, hoặc bất kỳ thắc mắc chung nào KHÔNG nhằm mục đích ghi nhận báo cáo tài chính.
   - Khi phát hiện đây là tin nhắn trò chuyện thông thường: Đặt is_financial_report là false và sinh câu trả lời thân thiện, lịch sự, chuyên nghiệp dành riêng cho tiệm Nail Mi Tuyết Trần trong trường chat_reply.

### YÊU CẦU ĐỊNH DẠNG ĐẦU RA:
- BẮT BUỘC CHỈ TRẢ VỀ DUY NHẤT ĐỊNH DẠNG JSON KHÔNG KÈM LỜI GIẢI THÍCH, KHÔNG CHỨA MARKDOWN CODEBLOCK ĐẦU CUỐI KHI TRẢ VỀ RAW JSON.

CẤU TRÚC JSON MẪU 1 (DÀNH CHO BÁO CÁO THU CHI):
{
  "status": "success",
  "is_financial_report": true,
  "replacement_mode": "replace_all",
  "has_warning": false,
  "warning_message": "",
  "report_date": "2026-08-05",
  "staff_data": [],
  "expenses_data": [],
  "installments_data": [],
  "deleted_items": []
}

CẤU TRÚC JSON MẪU 2 (DÀNH CHO TRÒ CHUYỆN / HỎI ĐÁP CHUNG):
{
  "status": "success",
  "is_financial_report": false,
  "chat_reply": "Chào bạn! Tôi có thể giúp gì cho tiệm Nail Mi Tuyết Trần hôm nay?"
}`;
}

const fetch = require("node-fetch");

async function getWorkingModels(apiKey) {
  try {
    const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models?key=${apiKey}`);
    if (res.ok) {
      const data = await res.json();
      if (data && Array.isArray(data.models)) {
        const supported = data.models
          .filter(m => m.supportedGenerationMethods && m.supportedGenerationMethods.includes("generateContent"))
          .map(m => m.name.replace("models/", ""))
          .filter(name => {
            // Loại bỏ các model không hỗ trợ Vision/ảnh hoặc bị deprecated
            if (name.includes("tts") || name.includes("lyria") || name.includes("gemma") || name.includes("robotics") || name.includes("computer-use") || name.includes("deep-research") || name.includes("customtools")) return false;
            if (name === "gemini-2.5-flash" || name === "gemini-1.5-flash" || name === "gemini-1.5-pro") return false;
            return true;
          });

        console.log("🤖 [AI DYNAMIC DISCOVERY] Danh sách Vision Model hợp lệ 100%:", supported);

        // Danh sách ưu tiên các model xử lý Vision tốt nhất và ổn định nhất
        const priorityList = ["gemini-flash-latest", "gemini-2.5-flash-image", "gemini-3-flash-preview", "gemini-flash-lite-latest", "gemini-pro-latest"];

        const sorted = supported.sort((a, b) => {
          const idxA = priorityList.indexOf(a);
          const idxB = priorityList.indexOf(b);
          if (idxA !== -1 && idxB !== -1) return idxA - idxB;
          if (idxA !== -1) return -1;
          if (idxB !== -1) return 1;
          return 0;
        });

        if (sorted.length > 0) return sorted;
      }
    }
  } catch (e) {
    console.warn("⚠️ Không thể quét danh sách model từ Google API:", e.message);
  }

  return ["gemini-flash-latest"];
}

async function extractDailyReport({ textInput, imageBuffer, imageBuffers, mimeType = "image/jpeg", customStaffList, existingReports }) {
  const apiKey = env.geminiApiKey;
  if (!apiKey) {
    throw new Error("Chưa cấu hình GEMINI_API_KEY trong file .env!");
  }

  const genAI = new GoogleGenerativeAI(apiKey);
  
  // Tự động sử dụng danh sách model thực tế do Google cấp cho API Key của bạn
  const candidateModels = await getWorkingModels(apiKey);

  let responseText = null;
  let lastError = null;

  const buffers = Array.isArray(imageBuffers) && imageBuffers.length > 0 
    ? imageBuffers 
    : (imageBuffer ? [imageBuffer] : []);

  // Tự động tăng thời gian chờ nếu gửi album nhiều ảnh (60s cho album, 30s cho đơn ảnh)
  const timeoutMs = buffers.length > 1 ? 60000 : 30000;

  const withTimeout = (promise, ms = timeoutMs) => {
    return Promise.race([
      promise,
      new Promise((_, reject) => setTimeout(() => reject(new Error(`Hết thời gian phản hồi (${ms / 1000}s Timeout)`)), ms))
    ]);
  };

  for (const modelName of candidateModels) {
    try {
      const model = genAI.getGenerativeModel({
        model: modelName,
        generationConfig: { responseMimeType: "application/json" }
      });

      const activeStaffList = customStaffList || (await staffRepo.getStaffList());
      const systemPrompt = getSystemPrompt(activeStaffList);

      const contents = [systemPrompt];

      if (existingReports && existingReports.length > 0) {
        contents.push(`DANH SÁCH BÁO CÁO ĐÃ GHI NHẬN TRƯỚC ĐÓ TRONG NGÀY HÔM NAY:\n${JSON.stringify(existingReports, null, 2)}`);
      }

      if (textInput) {
        contents.push(`Dữ liệu báo cáo dạng văn bản:\n"""${textInput}"""`);
      }

      if (buffers.length > 0) {
        buffers.forEach((buf, idx) => {
          contents.push({
            inlineData: {
              data: buf.toString("base64"),
              mimeType: mimeType
            }
          });
          if (buffers.length > 1) {
            contents.push(`[Trang ảnh số ${idx + 1}/${buffers.length}]`);
          }
        });
        contents.push(`Hãy phân tích và tổng hợp toàn bộ ${buffers.length} trang ảnh báo cáo trên theo đúng quy tắc.`);
      }

      const result = await withTimeout(model.generateContent(contents), timeoutMs);
      responseText = result.response.text().trim();
      if (responseText) break;
    } catch (err) {
      console.warn(`⚠️ Model ${modelName} gặp sự cố hoặc timeout: ${err.message}, thử model tiếp theo...`);
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
