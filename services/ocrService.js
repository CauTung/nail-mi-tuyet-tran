const fetch = require("node-fetch");

async function extractTextFromImage(imageBuffer) {
  if (!imageBuffer || !Buffer.isBuffer(imageBuffer)) {
    return null;
  }

  const apiKey = process.env.GOOGLE_VISION_API_KEY || process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY;
  if (!apiKey || apiKey === "your_gemini_api_key_here") {
    console.warn("⚠️ [OCR] Chưa cài đặt API Key Google Cloud Vision / Gemini!");
    return null;
  }

  try {
    const base64Image = imageBuffer.toString("base64");
    const requestBody = {
      requests: [
        {
          image: {
            content: base64Image
          },
          features: [
            {
              type: "DOCUMENT_TEXT_DETECTION"
            }
          ]
        }
      ]
    };

    const endpoint = `https://vision.googleapis.com/v1/images:annotate?key=${apiKey}`;
    const res = await fetch(endpoint, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(requestBody)
    });

    if (!res.ok) {
      console.warn(`⚠️ [OCR] Google Cloud Vision API trả về HTTP error: ${res.status} ${res.statusText}`);
      return null;
    }

    const data = await res.json();
    const responses = data.responses || [];
    if (responses.length > 0 && responses[0].fullTextAnnotation?.text) {
      return responses[0].fullTextAnnotation.text.trim();
    }

    return null;
  } catch (err) {
    console.warn("⚠️ [OCR] Lỗi kết nối Google Cloud Vision OCR:", err.message);
    return null;
  }
}

module.exports = {
  extractTextFromImage
};
