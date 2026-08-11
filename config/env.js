require("dotenv").config();

const config = {
  telegramToken: process.env.TELEGRAM_BOT_TOKEN || "",
  geminiApiKey: process.env.GEMINI_API_KEY || "",
  supabaseUrl: process.env.SUPABASE_URL || "",
  supabaseKey: process.env.SUPABASE_KEY || process.env.SUPABASE_ANON_KEY || "",
  adminUserIds: (process.env.ADMIN_USER_IDS || "")
    .split(",")
    .map(id => id.trim())
    .filter(Boolean)
};

function validateEnv() {
  const missing = [];
  if (!config.telegramToken) missing.push("TELEGRAM_BOT_TOKEN");
  if (!config.geminiApiKey) missing.push("GEMINI_API_KEY");

  if (missing.length > 0) {
    console.warn(`⚠️ [CẢNH BÁO] Thiếu biến môi trường: ${missing.join(", ")}`);
  }
}

validateEnv();

module.exports = config;
