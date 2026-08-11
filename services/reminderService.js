const cron = require("node-cron");
const env = require("../config/env");
const adminRepo = require("../db/repositories/adminRepository");

function initDailyReminder(bot) {
  // Lên lịch chạy vào 20:00 (8h tối) hàng ngày theo giờ Việt Nam (Asia/Ho_Chi_Minh)
  cron.schedule("0 20 * * *", async () => {
    console.log("⏰ [CRON REMINDER] Đang gửi thông báo nhắc nhở báo cáo thu chi 20:00...");

    let msg = `⏰ **NHẮC NHỞ TỔNG KẾT DOANH THU CUỐI NGÀY (20:00)**\n\n`;
    msg += `📢 **Ghi chú dành cho Chủ tiệm & Nhân viên:**\n`;
    msg += `1. 📝 Hãy tổng kết và ghi lại **toàn bộ doanh thu các ca làm** trong ngày vào sổ.\n`;
    msg += `2. 📸 **Chụp ảnh trang sổ** hoặc nhập tin nhắn báo cáo rồi gửi trực tiếp lên đây để AI Gemini lưu trữ!\n`;
    msg += `3. 💸 **Kiểm tra chi tiêu:** Hôm nay có phát sinh khoản chi tiêu nào (tiền nước đá, tiền ship, vật tư...) chưa gửi báo cáo không?\n\n`;
    msg += `👉 *Hãy chụp ảnh sổ hoặc gửi tin nhắn báo cáo ngay bên dưới nhé!*`;

    try {
      // Lấy danh sách Telegram Admin IDs từ DB và file .env
      const dbAdmins = await adminRepo.getAdminList();
      const envAdmins = env.adminUserIds;

      // Hợp nhất danh sách Telegram User ID nhận thông báo
      const targetIds = Array.from(new Set([...dbAdmins, ...envAdmins]));

      if (targetIds.length === 0) {
        console.warn("⚠️ [CRON REMINDER] Chưa có Telegram Admin ID nào để gửi nhắc nhở.");
        return;
      }

      for (const chatId of targetIds) {
        try {
          await bot.telegram.sendMessage(chatId, msg, { parse_mode: "Markdown" });
          console.log(`✅ [CRON REMINDER] Đã gửi thông báo tới Chat ID: ${chatId}`);
        } catch (err) {
          console.error(`❌ Lỗi gửi nhắc nhở tới Chat ID ${chatId}:`, err.message);
        }
      }
    } catch (err) {
      console.error("❌ Lỗi trong tiến trình Cron Reminder:", err.message);
    }
  }, {
    timezone: "Asia/Ho_Chi_Minh"
  });

  console.log("⏰ [REMINDER SERVICE] Đã kích hoạt lịch nhắc nhở tổng kết doanh thu tự động 20:00 hàng ngày (Giờ Việt Nam).");
}

module.exports = {
  initDailyReminder
};
