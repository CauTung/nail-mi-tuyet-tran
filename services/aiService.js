const { GoogleGenerativeAI } = require("@google/generative-ai");
const env = require("../config/env");
const staffRepo = require("../db/repositories/staffRepository");
const { getSystemPrompt } = require("../config/prompts");
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
            if (name.includes("tts") || name.includes("lyria") || name.includes("gemma") || name.includes("robotics") || name.includes("computer-use") || name.includes("deep-research") || name.includes("customtools")) return false;
            if (name === "gemini-2.5-flash" || name === "gemini-1.5-flash" || name === "gemini-1.5-pro") return false;
            return true;
          });

        console.log("🤖 [AI DYNAMIC DISCOVERY] Danh sách Vision Model hợp lệ 100%:", supported);

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
  const candidateModels = await getWorkingModels(apiKey);

  let responseText = null;
  let lastError = null;

  const buffers = Array.isArray(imageBuffers) && imageBuffers.length > 0 
    ? imageBuffers 
    : (imageBuffer ? [imageBuffer] : []);

  const timeoutMs = buffers.length > 1 ? 60000 : 30000;

  const withTimeout = (promise, ms = timeoutMs) => {
    return Promise.race([
      promise,
      new Promise((_, reject) => setTimeout(() => reject(new Error(`Hết thời gian phản hồi (${ms / 1000}s Timeout)`)), ms))
    ]);
  };

  for (const modelName of candidateModels) {
    try {
      const activeStaffList = customStaffList || (await staffRepo.getStaffList());
      const systemPrompt = getSystemPrompt(activeStaffList);

      const model = genAI.getGenerativeModel({
        model: modelName,
        systemInstruction: systemPrompt,
        generationConfig: { responseMimeType: "application/json" }
      });

      const contents = [];

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
        contents.push(`Hãy phân tích và tổng hợp toàn bộ ${buffers.length} trang ảnh báo cáo trên theo đúng quy tắc systemInstruction.`);
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
