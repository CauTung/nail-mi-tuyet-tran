require("dotenv").config();
const { Telegraf } = require("telegraf");
const fetch = require("node-fetch");
const { extractDailyReport } = require("./services/geminiService");
const { 
  saveReportDb, 
  deleteReportDb,
  updateStaffRevenueDb,
  updateExpenseDb,
  deleteInstallmentDb,
  getStaffListDb, 
  saveStaffListDb,
  addStaffDb,
  removeStaffDb,
  getDailyReports, 
  getDailySummary,
  getMonthlySummary, 
  getDateKeys,
  isAdminUser,
  addAdminUser,
  getAdminListDb,
  getInstallmentsDb
} = require("./services/dbService");

const botToken = process.env.TELEGRAM_BOT_TOKEN;

if (!botToken || botToken === "your_telegram_bot_token_here") {
  console.warn("⚠️ [CẢNH BÁO] TELEGRAM_BOT_TOKEN chưa được cài đặt trong .env!");
}

const bot = new Telegraf(botToken || "DUMMY_TOKEN");

function parseAmountStr(str) {
  if (!str) return 0;
  let clean = String(str).toLowerCase().trim();
  clean = clean.replace(/,/g, ".").replace(/đ|vnd/g, "");
  if (clean.endsWith("k")) {
    return Math.round(parseFloat(clean.replace("k", "")) * 1000);
  }
  if (clean.endsWith("tr")) {
    return Math.round(parseFloat(clean.replace("tr", "")) * 1000000);
  }
  return parseInt(clean, 10) || 0;
}

bot.start((ctx) => {
  const userId = ctx.from ? ctx.from.id : null;
  const isAdmin = isAdminUser(userId);

  ctx.reply(
    "👋 Chào mừng bạn đến với Telegram Bot OCR & Quản lý Báo cáo Tiệm Nail Mi Tuyết Trần!\n\n" +
    "📸 Gửi **Ảnh chụp bảng viết tay**, **Ảnh chụp màn hình**, hoặc **Tin nhắn báo cáo**.\n" +
    `🆔 **Telegram ID của bạn**: \`${userId}\` ${isAdmin ? "(👑 Chủ tiệm / Admin)" : "(Nhiên viên)"}\n\n` +
    "Các lệnh tra cứu & quản lý:\n" +
    "• /staff - Danh sách nhân viên\n" +
    "• /today - Tổng hợp báo cáo hôm nay\n" +
    "• /month [YYYY-MM] - Báo cáo tổng tháng & Lợi nhuận\n" +
    "• /search YYYY-MM-DD - Tra cứu ngày bất kỳ\n" +
    "• /tragop - Danh sách hợp đồng trả góp\n\n" +
    "📅 **Nhập báo cáo ngày cũ (Khi mới dùng App):**\n" +
    "• Ghi ngày trực tiếp trong tin nhắn (Ví dụ: *\"Ngày 05/08: Quỳnh Anh gội móng 300k\"*)\n" +
    "• Hoặc gõ lệnh: `/addpast YYYY-MM-DD Nội_dung_báo_cáo`\n\n" +
    "✏️ **Sửa & Xóa (Chủ tiệm):**\n" +
    "• /editrevenue <ID> <Tên> <Gội/Móng> <Mi> <NgoàiGiờ>\n" +
    "• /editexpense <ID> <Số_tiền> <Ghi_chú>\n" +
    "• /deletereport <ID> - Xóa lượt báo cáo sai",
    { parse_mode: "Markdown" }
  );
});

bot.command("myid", (ctx) => {
  const userId = ctx.from ? ctx.from.id : null;
  const isAdmin = isAdminUser(userId);
  ctx.reply(`🆔 **Telegram ID của bạn**: \`${userId}\`\n👑 **Quyền hạn**: ${isAdmin ? "Chủ tiệm / Admin (Toàn quyền)" : "Nhân viên"}`, { parse_mode: "Markdown" });
});

bot.command("setadmin", (ctx) => {
  const userId = ctx.from ? ctx.from.id : null;
  const adminList = getAdminListDb();

  if (adminList.length > 0 && !isAdminUser(userId)) {
    return ctx.reply("❌ **Từ chối**: Hệ thống đã có Admin.");
  }

  addAdminUser(userId);
  ctx.reply(`🎉 **Thành công!** Telegram ID \`${userId}\` đã được cài đặt làm Admin.`, { parse_mode: "Markdown" });
});

bot.command("staff", (ctx) => {
  const staffList = getStaffListDb();
  ctx.reply(`📋 **Danh sách nhân viên hợp lệ hiện tại (${staffList.length} người):**\n\n${staffList.map((s, i) => `${i + 1}. ${s}`).join("\n")}`);
});

bot.command("addstaff", (ctx) => {
  const userId = ctx.from ? ctx.from.id : null;
  if (!isAdminUser(userId)) {
    return ctx.reply("⛔ **Từ chối truy cập**: Chỉ có **Chủ tiệm / Admin** mới có quyền thêm nhân viên!");
  }

  const text = ctx.message.text.replace("/addstaff", "").trim();
  if (!text) {
    return ctx.reply("⚠️ **Cú pháp sai**. Vui lòng nhập: `/addstaff Tên_1, Tên_2`", { parse_mode: "Markdown" });
  }

  const namesToAdd = text.split(",").map(s => s.trim()).filter(Boolean);
  const updatedList = addStaffDb(namesToAdd);

  ctx.reply(`✅ **Đã thêm nhân viên thành công!**\n📋 Danh sách hiện tại (${updatedList.length} người):\n${updatedList.map((s, i) => `${i + 1}. ${s}`).join("\n")}`);
});

bot.command("removestaff", (ctx) => {
  const userId = ctx.from ? ctx.from.id : null;
  if (!isAdminUser(userId)) {
    return ctx.reply("⛔ **Từ chối truy cập**: Chỉ có **Chủ tiệm / Admin** mới có quyền xóa nhân viên!");
  }

  const nameToRemove = ctx.message.text.replace("/removestaff", "").trim();
  if (!nameToRemove) {
    return ctx.reply("⚠️ **Cú pháp sai**. Vui lòng nhập: `/removestaff Tên_Nhân_Viên`", { parse_mode: "Markdown" });
  }

  const updatedList = removeStaffDb(nameToRemove);

  ctx.reply(`🗑 **Đã xóa nhân viên \`${nameToRemove}\`!**\n📋 Danh sách hiện tại (${updatedList.length} người):\n${updatedList.map((s, i) => `${i + 1}. ${s}`).join("\n")}`, { parse_mode: "Markdown" });
});

bot.command("setstaff", (ctx) => {
  const userId = ctx.from ? ctx.from.id : null;
  if (!isAdminUser(userId)) {
    return ctx.reply("⛔ **Từ chối truy cập**: Chỉ có **Chủ tiệm / Admin** mới có quyền đặt lại danh sách nhân viên!");
  }

  const text = ctx.message.text.replace("/setstaff", "").trim();
  if (!text) {
    return ctx.reply("⚠️ **Cú pháp sai**. Vui lòng nhập: `/setstaff Tên_1, Tên_2, Tên_3`", { parse_mode: "Markdown" });
  }

  const newArray = text.split(",").map(s => s.trim()).filter(Boolean);
  const updatedList = saveStaffListDb(newArray);

  ctx.reply(`✅ **Đã cập nhật lại toàn bộ danh sách nhân viên!** (${updatedList.length} người):\n${updatedList.map((s, i) => `${i + 1}. ${s}`).join("\n")}`);
});

// LỆNH NHẬP BÁO CÁO NGÀY CŨ: /addpast 2026-08-01 Quỳnh Anh gội móng 300k
bot.command(["addpast", "nhapngaycu"], async (ctx) => {
  const text = ctx.message.text.replace(/^\/(addpast|nhapngaycu)/, "").trim();
  const parts = text.split(" ");
  const dateInput = parts[0];
  const reportText = parts.slice(1).join(" ");

  if (!dateInput || !/^\d{4}-\d{2}-\d{2}$/.test(dateInput) || !reportText) {
    return ctx.reply("⚠️ **Cú pháp nhập ngày cũ sai**. Vui lòng nhập đúng định dạng:\n`/addpast YYYY-MM-DD Nội_dung_báo_cáo`\nVí dụ: `/addpast 2026-08-01 Quỳnh Anh gội móng 300k, mi 200k. Mua đá 50k`", { parse_mode: "Markdown" });
  }

  const statusMsg = await ctx.reply(`⏳ Đang bóc tách & lưu báo cáo cho ngày cũ **${dateInput}**...`, { parse_mode: "Markdown" });

  try {
    const resultJson = await extractDailyReport({ textInput: reportText });
    
    const { record, dateStr } = saveReportDb(resultJson, {
      userInfo: ctx.from ? { id: ctx.from.id, username: ctx.from.username, first_name: ctx.from.first_name } : null,
      inputType: "past_text"
    }, dateInput);

    const jsonString = JSON.stringify(resultJson, null, 2);
    
    await ctx.telegram.deleteMessage(ctx.chat.id, statusMsg.message_id).catch(() => {});

    await ctx.reply(`✅ **Đã bổ sung báo cáo thành công cho ngày cũ \`${dateStr}\`!**\n🆔 Mã báo cáo: \`${record.id}\`\n📁 Lưu tại: \`data/reports/${dateStr.substring(0, 7)}/${dateStr}.json\`\n\n\`\`\`json\n${jsonString}\n\`\`\``, { parse_mode: "Markdown" });
  } catch (error) {
    console.error("Lỗi khi bóc tách báo cáo ngày cũ:", error);
    await ctx.telegram.deleteMessage(ctx.chat.id, statusMsg.message_id).catch(() => {});
    await ctx.reply(`❌ **Có lỗi xảy ra:** ${error.message || "Không thể phân tích dữ liệu"}`);
  }
});

bot.command(["deletereport", "xoabaocao"], (ctx) => {
  const userId = ctx.from ? ctx.from.id : null;
  if (!isAdminUser(userId)) {
    return ctx.reply("⛔ **Từ chối truy cập**: Chỉ có **Chủ tiệm / Admin** mới có quyền xóa báo cáo!");
  }

  const args = ctx.message.text.split(" ");
  const reportId = args[1];

  if (!reportId) {
    return ctx.reply("⚠️ Vui lòng nhập ID báo cáo cần xóa: `/deletereport REP_xxxxx`", { parse_mode: "Markdown" });
  }

  const success = deleteReportDb(reportId);
  if (success) {
    ctx.reply(`🗑 **Đã xóa thành công lượt báo cáo mã \`${reportId}\`!**`, { parse_mode: "Markdown" });
  } else {
    ctx.reply(`❌ **Không tìm thấy lượt báo cáo với mã \`${reportId}\`.**`, { parse_mode: "Markdown" });
  }
});

bot.command(["editrevenue", "suadoanhthu"], (ctx) => {
  const userId = ctx.from ? ctx.from.id : null;
  if (!isAdminUser(userId)) {
    return ctx.reply("⛔ **Từ chối truy cập**: Chỉ có **Chủ tiệm / Admin** mới có quyền sửa doanh số!");
  }

  const args = ctx.message.text.split(" ").filter(Boolean);
  if (args.length < 4) {
    return ctx.reply("⚠️ **Cú pháp sai**. Nhập: `/editrevenue <ID> <Tên_NV> <gội_móng> <mi> <ngoài_giờ>`\nVí dụ: `/editrevenue REP_12345 \"Quỳnh Anh\" 300k 400k 0`", { parse_mode: "Markdown" });
  }

  const reportId = args[1];
  const staffName = args[2];
  const goiMong = parseAmountStr(args[3]);
  const mi = parseAmountStr(args[4] || "0");
  const ngoaiGio = parseAmountStr(args[5] || "0");

  const updatedRecord = updateStaffRevenueDb(reportId, staffName, goiMong, mi, ngoaiGio);

  if (updatedRecord) {
    ctx.reply(`✅ **Đã cập nhật doanh thu cho nhân viên "${staffName}" trong báo cáo \`${reportId}\`!**\n\n\`\`\`json\n${JSON.stringify(updatedRecord.parsed_result, null, 2)}\n\`\`\``, { parse_mode: "Markdown" });
  } else {
    ctx.reply(`❌ **Không tìm thấy lượt báo cáo mã \`${reportId}\`.**`, { parse_mode: "Markdown" });
  }
});

bot.command(["editexpense", "suachitieu"], (ctx) => {
  const userId = ctx.from ? ctx.from.id : null;
  if (!isAdminUser(userId)) {
    return ctx.reply("⛔ **Từ chối truy cập**: Chỉ có **Chủ tiệm / Admin** mới có quyền sửa chi tiêu!");
  }

  const args = ctx.message.text.split(" ").filter(Boolean);
  if (args.length < 3) {
    return ctx.reply("⚠️ **Cú pháp sai**. Nhập: `/editexpense <ID> <Số_tiền> <Ghi_chú>`\nVí dụ: `/editexpense REP_12345 60k Mua nước đá`", { parse_mode: "Markdown" });
  }

  const reportId = args[1];
  const amount = parseAmountStr(args[2]);
  const notes = args.slice(3).join(" ") || "Đã điều chỉnh chi tiêu";

  const updatedRecord = updateExpenseDb(reportId, amount, notes);

  if (updatedRecord) {
    ctx.reply(`✅ **Đã cập nhật khoản chi tiêu trong báo cáo \`${reportId}\` thành ${amount.toLocaleString("vi-VN")} VNĐ!**\n\n\`\`\`json\n${JSON.stringify(updatedRecord.parsed_result, null, 2)}\n\`\`\``, { parse_mode: "Markdown" });
  } else {
    ctx.reply(`❌ **Không tìm thấy lượt báo cáo mã \`${reportId}\`.**`, { parse_mode: "Markdown" });
  }
});

bot.command(["deleteragop", "deleteragop"], (ctx) => {
  const userId = ctx.from ? ctx.from.id : null;
  if (!isAdminUser(userId)) {
    return ctx.reply("⛔ **Từ chối truy cập**: Chỉ có **Chủ tiệm / Admin** mới có quyền xóa gói trả góp!");
  }

  const args = ctx.message.text.split(" ");
  const insId = args[1];

  if (!insId) {
    return ctx.reply("⚠️ Vui lòng nhập ID gói trả góp cần xóa: `/deleteragop INS_xxxxx`", { parse_mode: "Markdown" });
  }

  const success = deleteInstallmentDb(insId);
  if (success) {
    ctx.reply(`🗑 **Đã xóa thành công hợp đồng trả góp mã \`${insId}\`!**`, { parse_mode: "Markdown" });
  } else {
    ctx.reply(`❌ **Không tìm thấy hợp đồng trả góp mã \`${insId}\`.**`, { parse_mode: "Markdown" });
  }
});

bot.command(["tragop", "installments"], (ctx) => {
  const plans = getInstallmentsDb();

  if (plans.length === 0) {
    return ctx.reply("💳 **Chưa có gói mua trả góp nào được ghi nhận.**");
  }

  let text = `💳 **DANH SÁCH CÁC MÓN MUA TRẢ GÓP DÀI HẠN (${plans.length} khoản):**\n\n`;
  plans.forEach((p, i) => {
    text += `${i + 1}. **${p.item_name}** (ID: \`${p.id}\`)\n`;
    text += `   • Tổng tiền: ${p.total_amount.toLocaleString("vi-VN")} VNĐ (${p.months} tháng)\n`;
    text += `   • Mỗi tháng trả: **${p.monthly_amount.toLocaleString("vi-VN")} VNĐ/tháng**\n`;
    text += `   • Tháng mua: ${p.purchase_year_month || "Đã ghi nhận"}\n`;
    text += `   • Bắt đầu tính tiền vào báo cáo từ tháng: **${p.start_year_month}** (Tháng Sau)\n\n`;
  });

  ctx.reply(text, { parse_mode: "Markdown" });
});

function formatDailySummaryMessage(summary) {
  let staffDetailText = "";
  Object.keys(summary.staffStats).forEach(name => {
    const s = summary.staffStats[name];
    staffDetailText += `  • **${name}**: ${s.score} công | Tổng: ${s.total.toLocaleString("vi-VN")} VNĐ (Gội/Móng: ${s.goi_mong.toLocaleString("vi-VN")}, Mi: ${s.mi.toLocaleString("vi-VN")}, Tăng ca: ${s.ngoai_gio.toLocaleString("vi-VN")})\n`;
  });

  let expenseDetailText = "";
  if (summary.expenses.list.length > 0) {
    expenseDetailText = "\n💸 **Chi tiết chi tiêu trong ngày:**\n";
    summary.expenses.list.forEach(e => {
      expenseDetailText += `  • ${e.notes}: **${e.amount.toLocaleString("vi-VN")} VNĐ**\n`;
    });
  }

  let reportsListText = "\n🆔 **Danh sách mã lượt báo cáo (để sửa/xóa nếu cần):**\n";
  summary.reports.forEach((r, idx) => {
    reportsListText += `  • Lượt ${summary.reports.length - idx} (lúc ${new Date(r.timestamp).toLocaleTimeString("vi-VN")}): Mã ID \`${r.id}\`\n`;
  });

  return (
    `📅 **TỔNG HỢP BÁO CÁO NGÀY ${summary.dateStr}**\n` +
    `----------------------------------------\n` +
    `🗓 Tổng số lượt gửi báo cáo: ${summary.reportsCount} lượt\n\n` +
    `💰 **Tổng Doanh Thu Ngày**: **${summary.revenue.total.toLocaleString("vi-VN")} VNĐ**\n` +
    `  • Gội/Móng/Tóc: ${summary.revenue.goi_mong.toLocaleString("vi-VN")} VNĐ\n` +
    `  • Mi/Nối mi/Phun xăm: ${summary.revenue.mi.toLocaleString("vi-VN")} VNĐ\n` +
    `  • Tăng ca/Ngoài giờ: ${summary.revenue.ngoai_gio.toLocaleString("vi-VN")} VNĐ\n\n` +
    `💸 **Tổng Chi Tiêu Ngày**: **${summary.expenses.total.toLocaleString("vi-VN")} VNĐ**\n` +
    `${expenseDetailText}\n` +
    `📈 **LỢI NHUẬN RÒNG NGÀY**: **${summary.netProfit.toLocaleString("vi-VN")} VNĐ**\n\n` +
    `👩‍Working **Chi tiết nhân viên hôm nay:**\n${staffDetailText}` +
    `${reportsListText}`
  );
}

bot.command("today", (ctx) => {
  const { dateStr } = getDateKeys();
  const summary = getDailySummary(dateStr);

  if (!summary) {
    return ctx.reply(`📅 **Hôm nay (${dateStr}) chưa có báo cáo nào được ghi nhận.**`);
  }

  const msg = formatDailySummaryMessage(summary);
  ctx.reply(msg, { parse_mode: "Markdown" });
});

bot.command(["month", "thang"], (ctx) => {
  const args = ctx.message.text.split(" ");
  const { yearMonth: currentYM } = getDateKeys();
  const targetYM = args[1] || currentYM;

  const summary = getMonthlySummary(targetYM);

  if (!summary) {
    return ctx.reply(`📅 **Chưa có dữ liệu báo cáo nào cho tháng \`${targetYM}\`.**`);
  }

  let staffDetailText = "";
  Object.keys(summary.staffStats).forEach(name => {
    const s = summary.staffStats[name];
    staffDetailText += `  • **${name}**: ${s.total_score} công | Doanh thu: ${s.total_revenue.toLocaleString("vi-VN")} VNĐ\n`;
  });

  let installmentDetailText = "";
  if (summary.activeInstallments.length > 0) {
    installmentDetailText = "\n💳 **Các khoản Trả góp trong tháng này:**\n";
    summary.activeInstallments.forEach(ins => {
      installmentDetailText += `  • **${ins.item_name}** (Tháng ${ins.current_month_index}/${ins.months}): ${ins.monthly_amount.toLocaleString("vi-VN")} VNĐ\n`;
    });
  }

  const msg = 
    `📊 **BÁO CÁO TỔNG HỢP THÁNG ${summary.yearMonth}**\n` +
    `----------------------------------------\n` +
    `🗓 Số ngày có báo cáo: ${summary.daysCount} ngày (${summary.totalReportsCount} lượt gửi)\n\n` +
    `💰 **Tổng Doanh Thu**: **${summary.revenue.total.toLocaleString("vi-VN")} VNĐ**\n` +
    `  • Gội/Móng/Tóc: ${summary.revenue.goi_mong.toLocaleString("vi-VN")} VNĐ\n` +
    `  • Mi/Nối mi/Phun xăm: ${summary.revenue.mi.toLocaleString("vi-VN")} VNĐ\n` +
    `  • Tăng ca/Ngoài giờ: ${summary.revenue.ngoai_gio.toLocaleString("vi-VN")} VNĐ\n\n` +
    `💸 **Tổng Chi Tiêu**: **${summary.expenses.total.toLocaleString("vi-VN")} VNĐ**\n` +
    `  • Chi tiêu trực tiếp trong ngày: ${summary.expenses.direct.toLocaleString("vi-VN")} VNĐ\n` +
    `  • Chi phí Trả góp thiết bị/tài sản: ${summary.expenses.installments.toLocaleString("vi-VN")} VNĐ\n` +
    `${installmentDetailText}\n` +
    `📈 **LỢI NHUẬN RÒNG THÁNG**: **${summary.netProfit.toLocaleString("vi-VN")} VNĐ**\n\n` +
    `👩‍Working **Thống kê nhân viên:**\n${staffDetailText}`;

  ctx.reply(msg, { parse_mode: "Markdown" });
});

bot.command("search", (ctx) => {
  const args = ctx.message.text.split(" ");
  const targetDate = args[1];

  if (!targetDate || !/^\d{4}-\d{2}-\d{2}$/.test(targetDate)) {
    return ctx.reply("⚠️ Vui lòng nhập đúng định dạng: `/search YYYY-MM-DD` (Ví dụ: `/search 2026-08-10`)", { parse_mode: "Markdown" });
  }

  const summary = getDailySummary(targetDate);
  if (!summary) {
    return ctx.reply(`📅 Không tìm thấy báo cáo nào cho ngày \`${targetDate}\`.`, { parse_mode: "Markdown" });
  }

  const msg = formatDailySummaryMessage(summary);
  ctx.reply(msg, { parse_mode: "Markdown" });
});

// Xử lý khi nhận Tin nhắn Văn bản (Text)
bot.on("text", async (ctx) => {
  const textMessage = ctx.message.text;

  if (textMessage.startsWith("/")) return;

  const statusMsg = await ctx.reply("⏳ Đang phân tích dữ liệu báo cáo bằng Gemini AI...");

  try {
    const resultJson = await extractDailyReport({ textInput: textMessage });
    
    // Tự động sử dụng ngày từ Gemini nếu phát hiện ngày cũ, hoặc ngày hôm nay
    const { record, dateStr } = saveReportDb(resultJson, {
      userInfo: ctx.from ? { id: ctx.from.id, username: ctx.from.username, first_name: ctx.from.first_name } : null,
      inputType: "text"
    });

    const jsonString = JSON.stringify(resultJson, null, 2);
    
    await ctx.telegram.deleteMessage(ctx.chat.id, statusMsg.message_id).catch(() => {});

    let noteText = "";
    if (Array.isArray(resultJson.installments_data) && resultJson.installments_data.length > 0) {
      noteText = `\n💳 **Hệ thống đã tự động lên lịch trả góp cho các tháng tới!** (Gõ \`/tragop\` để xem)`;
    }

    await ctx.reply(`✅ **Đã phân tích & lưu thành công vào ngày \`${dateStr}\`**\n🆔 Mã báo cáo: \`${record.id}\`${noteText}\n\n\`\`\`json\n${jsonString}\n\`\`\``, { parse_mode: "Markdown" });
  } catch (error) {
    console.error("Lỗi khi bóc tách báo cáo text:", error);
    await ctx.telegram.deleteMessage(ctx.chat.id, statusMsg.message_id).catch(() => {});
    await ctx.reply(`❌ **Có lỗi xảy ra:** ${error.message || "Không thể phân tích dữ liệu"}`);
  }
});

// Xử lý khi nhận Hình ảnh (Photo)
bot.on("photo", async (ctx) => {
  const caption = ctx.message.caption || "";
  const statusMsg = await ctx.reply("⏳ Đang tải và phân tích hình ảnh bảng báo cáo (OCR)...");

  try {
    const photoArray = ctx.message.photo;
    const highestResPhoto = photoArray[photoArray.length - 1];
    
    const fileUrl = await ctx.telegram.getFileLink(highestResPhoto.file_id);
    
    const response = await fetch(fileUrl.href);
    const imageBuffer = await response.buffer();

    const resultJson = await extractDailyReport({
      textInput: caption || undefined,
      imageBuffer: imageBuffer,
      mimeType: "image/jpeg"
    });

    const { record, dateStr } = saveReportDb(resultJson, {
      userInfo: ctx.from ? { id: ctx.from.id, username: ctx.from.username, first_name: ctx.from.first_name } : null,
      inputType: "photo"
    });

    const jsonString = JSON.stringify(resultJson, null, 2);

    await ctx.telegram.deleteMessage(ctx.chat.id, statusMsg.message_id).catch(() => {});

    let noteText = "";
    if (Array.isArray(resultJson.installments_data) && resultJson.installments_data.length > 0) {
      noteText = `\n💳 **Hệ thống đã tự động lên lịch trả góp cho các tháng tới!** (Gõ \`/tragop\` để xem)`;
    }

    await ctx.reply(`✅ **Đã OCR phân tích & lưu thành công vào ngày \`${dateStr}\`**\n🆔 Mã báo cáo: \`${record.id}\`${noteText}\n\n\`\`\`json\n${jsonString}\n\`\`\``, { parse_mode: "Markdown" });
  } catch (error) {
    console.error("Lỗi khi bóc tách hình ảnh OCR:", error);
    await ctx.telegram.deleteMessage(ctx.chat.id, statusMsg.message_id).catch(() => {});
    await ctx.reply(`❌ **Có lỗi xảy ra khi đọc ảnh:** ${error.message || "Lỗi xử lý OCR"}`);
  }
});

if (botToken && botToken !== "your_telegram_bot_token_here") {
  bot.launch()
    .then(() => console.log("🚀 Telegram Spa/Salon OCR Bot đã khởi chạy thành công!"))
    .catch((err) => console.error("Lỗi khởi chạy Telegram Bot:", err));

  process.once("SIGINT", () => bot.stop("SIGINT"));
  process.once("SIGTERM", () => bot.stop("SIGTERM"));
} else {
  console.log("ℹ️ Để chạy bot Telegram thực tế, hãy cấu hình TELEGRAM_BOT_TOKEN trong .env và chạy `npm start`");
}

module.exports = bot;
