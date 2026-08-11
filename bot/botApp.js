const { Telegraf } = require("telegraf");
const env = require("../config/env");
const { adminOnlyMiddleware } = require("./middlewares/authMiddleware");
const ocrHandler = require("./handlers/ocrHandler");
const queryHandler = require("./handlers/queryHandler");
const adminHandler = require("./handlers/adminHandler");
const reminderService = require("../services/reminderService");

function createBotApp() {
  if (!env.telegramToken) {
    throw new Error("Chưa cấu hình TELEGRAM_BOT_TOKEN trong file .env!");
  }

  const bot = new Telegraf(env.telegramToken);

  // Kích hoạt lịch nhắc nhở 20:00 hàng ngày
  reminderService.initDailyReminder(bot);

  // Command: /start & /help
  bot.start(ctx => {
    let msg = `👋 **Cháo mừng bạn đến với Bot Quản Lý Nail Mi Tuyết Trần!**\n\n`;
    msg += `📸 **Báo cáo hàng ngày:** Hãy chụp ảnh sổ/ảnh màn hình hoặc gửi tin nhắn báo cáo thu chi lên đây, AI Gemini sẽ tự động bóc tách số liệu!\n\n`;
    msg += `📊 **Các câu lệnh tra cứu phổ biến:**\n`;
    msg += `• \`/today\`: Xem báo cáo tổng hợp hôm nay\n`;
    msg += `• \`/month\`: Xem tổng hợp doanh thu & lợi nhuận ròng cả tháng\n`;
    msg += `• \`/luong\`: Xem bảng tính công & lương % hoa hồng nhân viên\n`;
    msg += `• \`/export\`: Xuất file Excel/CSV báo cáo tháng tải về\n`;
    msg += `• \`/tragop\`: Xem danh sách máy móc trả góp dài hạn\n`;
    msg += `• \`/myid\`: Kiểm tra Telegram User ID và quyền hạn của bạn\n`;
    msg += `• \`/setadmin\`: Đăng ký làm Admin chủ tiệm (nếu hệ thống chưa có Admin)\n`;
    ctx.reply(msg, { parse_mode: "Markdown" });
  });

  // Public Query Commands
  bot.command("today", queryHandler.handleToday);
  bot.command("month", queryHandler.handleMonth);
  bot.command("luong", queryHandler.handleLuong);
  bot.command("export", queryHandler.handleExport);
  bot.command("search", queryHandler.handleSearch);
  bot.command("tragop", queryHandler.handleTragop);
  bot.command("myid", queryHandler.handleMyId);
  bot.command("addpast", queryHandler.handleAddPast);
  bot.command(["mau", "template"], adminHandler.handleMau);

  // Registration for Admin
  bot.command("setadmin", adminHandler.handleSetAdmin);

  // Admin-Only Commands (Protected via Middleware)
  bot.command("staff", adminOnlyMiddleware, adminHandler.handleStaff);
  bot.command("addstaff", adminOnlyMiddleware, adminHandler.handleAddStaff);
  bot.command("removestaff", adminOnlyMiddleware, adminHandler.handleRemoveStaff);
  bot.command("setstaff", adminOnlyMiddleware, adminHandler.handleSetStaff);
  bot.command("setcommission", adminOnlyMiddleware, adminHandler.handleSetCommission);
  bot.command("editrevenue", adminOnlyMiddleware, adminHandler.handleEditRevenue);
  bot.command("editexpense", adminOnlyMiddleware, adminHandler.handleEditExpense);
  bot.command("deletereport", adminOnlyMiddleware, adminHandler.handleDeleteReport);
  bot.command("deleteragop", adminOnlyMiddleware, adminHandler.handleDeleteRagop);

  // OCR Listeners for text and photo reports
  bot.on("text", ocrHandler.handleOcrMessage);
  bot.on("photo", ocrHandler.handleOcrMessage);

  return bot;
}

module.exports = {
  createBotApp
};
