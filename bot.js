const { createBotApp } = require("./bot/botApp");
const env = require("./config/env");

async function start() {
  console.log("--------------------------------------------------");
  console.log("💅 Nail Mi Tuyết Trần - Telegram Bot AI OCR");
  console.log("--------------------------------------------------");

  try {
    const bot = createBotApp();

    await bot.launch();
    console.log("🚀 Telegram Bot đã khởi chạy thành công và đang lắng nghe tin nhắn!");

    // Graceful shutdown handling
    process.once("SIGINT", () => bot.stop("SIGINT"));
    process.once("SIGTERM", () => bot.stop("SIGTERM"));
  } catch (err) {
    console.error("❌ Lỗi không thể khởi chạy Bot:", err.message);
    process.exit(1);
  }
}

start();
