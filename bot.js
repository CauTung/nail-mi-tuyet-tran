const http = require("http");
const fetch = require("node-fetch");
const { createBotApp } = require("./bot/botApp");
const env = require("./config/env");

async function start() {
  console.log("--------------------------------------------------");
  console.log("💅 Nail Mi Tuyết Trần - Telegram Bot AI OCR");
  console.log("--------------------------------------------------");

  // Khởi tạo HTTP Health-Check Server cho Render.com nhận diện Cổng (Port)
  const port = process.env.PORT || 10000;
  http.createServer((req, res) => {
    res.writeHead(200, { "Content-Type": "text/plain; charset=utf-8" });
    res.end("💅 Bot Nail Mi Tuyết Trần đang hoạt động Online 24/7 trên Render!");
  }).listen(port, () => {
    console.log(`🌐 [HTTP HEALTH-CHECK] Đã mở cổng PORT ${port} cho Render.com kiểm tra Web Service.`);
  });

  // Tự động Ping URL định kỳ 8 phút/lần chống Render ngủ ngật (Spin Down)
  const appUrl = process.env.RENDER_EXTERNAL_URL || "https://nail-mi-tuyet-tran.onrender.com";
  setInterval(async () => {
    try {
      await fetch(appUrl);
      console.log(`📡 [KEEP-ALIVE PING] Đã tự động ping ${appUrl} giữ bot luôn thức 24/7!`);
    } catch (e) {
      console.warn("⚠️ Keep-alive ping error:", e.message);
    }
  }, 8 * 60 * 1000);

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
