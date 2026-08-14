const financialService = require("../../services/financialService");
const exportService = require("../../services/exportService");
const reportRepo = require("../../db/repositories/reportRepository");
const installmentRepo = require("../../db/repositories/installmentRepository");
const adminRepo = require("../../db/repositories/adminRepository");
const aiService = require("../../services/aiService");
const staffRepo = require("../../db/repositories/staffRepository");

function formatMoney(amount) {
  return new Intl.NumberFormat("vi-VN").format(amount || 0) + "đ";
}

async function handleToday(ctx) {
  const { dateStr } = reportRepo.getDateKeys();
  const summary = await financialService.getDailySummary(dateStr);

  if (!summary) {
    return ctx.reply(`📊 **BÁO CÁO HÔM NAY (${dateStr}):**\nChưa có báo cáo nào được ghi nhận trong hôm nay.`, { parse_mode: "Markdown" });
  }

  let msg = `📊 **BÁO CÁO TỔNG HỢP HÔM NAY (${dateStr})**\n`;
  msg += `📝 Số lượt báo cáo: **${summary.reportsCount}**\n\n`;

  msg += `👩‍🎨 **TỔNG DOANH SỐ THEO NHÂN VIÊN:**\n`;
  Object.keys(summary.staffStats).forEach(name => {
    const st = summary.staffStats[name];
    msg += `• **${name}**: ${formatMoney(st.total)} (Công: \`${st.score}\`)\n`;
  });

  msg += `\n💰 **TỔNG DOANH THU HÔM NAY:** ${formatMoney(summary.revenue.total)}\n`;
  msg += `📉 **TỔNG CHI TIÊU HÔM NAY:** ${formatMoney(summary.expenses.total)}\n`;
  msg += `💵 **LỢI NHUẬN RÒNG HÔM NAY:** ${formatMoney(summary.netProfit)}\n`;

  return ctx.reply(msg, { parse_mode: "Markdown" });
}

async function handleMonth(ctx) {
  const text = ctx.message.text.trim();
  const parts = text.split(" ");
  let yearMonth = parts[1];

  if (!yearMonth || !/^\d{4}-\d{2}$/.test(yearMonth)) {
    const { yearMonth: currentYM } = reportRepo.getDateKeys();
    yearMonth = currentYM;
  }

  const statusMsg = await ctx.reply(`📊 *Bot đang tổng hợp báo cáo tháng ${yearMonth}... Vui lòng đợi trong giây lát!*`, {
    parse_mode: "Markdown"
  });

  try {
    const summary = await financialService.getMonthlySummary(yearMonth);
    try { await ctx.telegram.deleteMessage(ctx.chat.id, statusMsg.message_id); } catch (e) {}

    if (!summary || summary.daysCount === 0) {
      return ctx.reply(`📅 **BÁO CÁO THÁNG ${yearMonth}:**\nChưa có dữ liệu báo cáo nào cho tháng này.`, { parse_mode: "Markdown" });
    }

    let msg = `📅 **BÁO CÁO TỔNG HỢP THÁNG ${yearMonth}**\n`;
    msg += `📆 Số ngày có báo cáo: **${summary.daysCount} ngày** (${summary.totalReportsCount} lượt)\n\n`;

    msg += `💵 **DOANH THU:**\n`;
    msg += `• Gội/Móng: ${formatMoney(summary.revenue.goi_mong)}\n`;
    msg += `• Mi/Phun xăm: ${formatMoney(summary.revenue.mi)}\n`;
    msg += `• Tăng ca: ${formatMoney(summary.revenue.ngoai_gio)}\n`;
    msg += `➔ **Tổng Doanh Thu:** **${formatMoney(summary.revenue.total)}**\n\n`;

    msg += `📉 **CHI TIẾT CHI PHÍ:**\n`;
    msg += `• Chi tiêu trực tiếp: ${formatMoney(summary.expenses.direct)}\n`;
    msg += `• Tiền trả góp tháng này: ${formatMoney(summary.expenses.installments)}\n`;
    msg += `➔ **Tổng Chi Phí:** **${formatMoney(summary.expenses.total)}**\n\n`;

    msg += `🏆 **LỢI NHUẬN RÒNG THÁNG:** **${formatMoney(summary.netProfit)}**\n`;

    return ctx.reply(msg, { parse_mode: "Markdown" });
  } catch (err) {
    try { await ctx.telegram.deleteMessage(ctx.chat.id, statusMsg.message_id); } catch (e) {}
    return ctx.reply(`❌ **Không thể tổng hợp báo cáo tháng ${yearMonth}:** ${err.message}`, { parse_mode: "Markdown" });
  }
}

async function handleLuong(ctx) {
  const text = ctx.message.text.trim();
  const parts = text.split(" ");
  let yearMonth = parts[1];

  if (!yearMonth || !/^\d{4}-\d{2}$/.test(yearMonth)) {
    const { yearMonth: currentYM } = reportRepo.getDateKeys();
    yearMonth = currentYM;
  }

  const statusMsg = await ctx.reply(`👷‍♀️ *Bot đang tính toán bảng lương tháng ${yearMonth}... Vui lòng đợi trong giây lát!*`, {
    parse_mode: "Markdown"
  });

  try {
    const summary = await financialService.getMonthlySummary(yearMonth);
    try { await ctx.telegram.deleteMessage(ctx.chat.id, statusMsg.message_id); } catch (e) {}

    if (!summary || summary.daysCount === 0) {
      return ctx.reply(`👷‍♀️ **BẢNG LƯƠNG & CÔNG THÁNG ${yearMonth}:**\nChưa có dữ liệu cho tháng này.`, { parse_mode: "Markdown" });
    }

    const cfg = summary.commissionConfig;
    let msg = `👷‍♀️ **BẢNG TỔNG HỢP LƯƠNG & CÔNG THÁNG ${yearMonth}**\n`;
    msg += `⚙️ *(Tỷ lệ %: Gội/Móng ${cfg.goi_mong_percent}%, Mi ${cfg.mi_percent}%, Tăng ca ${cfg.ngoai_gio_percent}%)*\n\n`;

    Object.keys(summary.staffStats).forEach(name => {
      const st = summary.staffStats[name];
      msg += `👤 **${name}**:\n`;
      msg += `• Tong cong score: \`${st.total_score}\` (Làm ${st.days_worked} ngày, Nghỉ ${st.days_off} ngày)\n`;
      if (st.days_late > 0) msg += `• Đi muộn: ${st.days_late} lần (${st.late_minutes} phút)\n`;
      msg += `• Doanh số mang về: ${formatMoney(st.total_revenue)}\n`;
      msg += `➔ **LƯƠNG % HOA HỒNG: ${formatMoney(st.total_commission)}**\n\n`;
    });

    return ctx.reply(msg, { parse_mode: "Markdown" });
  } catch (err) {
    try { await ctx.telegram.deleteMessage(ctx.chat.id, statusMsg.message_id); } catch (e) {}
    return ctx.reply(`❌ **Không thể tính lương tháng ${yearMonth}:** ${err.message}`, { parse_mode: "Markdown" });
  }
}

async function handleExport(ctx) {
  const text = ctx.message.text.trim();
  const parts = text.split(" ");
  let yearMonth = parts[1];

  if (!yearMonth || !/^\d{4}-\d{2}$/.test(yearMonth)) {
    const { yearMonth: currentYM } = reportRepo.getDateKeys();
    yearMonth = currentYM;
  }

  const statusMsg = await ctx.reply(`📊 *Bot đang khởi tạo file báo cáo Excel tháng ${yearMonth}... Vui lòng đợi trong giây lát!*`, {
    parse_mode: "Markdown"
  });

  try {
    const exportPath = await exportService.exportMonthlyCsv(yearMonth);
    try { await ctx.telegram.deleteMessage(ctx.chat.id, statusMsg.message_id); } catch (e) {}

    if (!exportPath) {
      return ctx.reply(`❌ Không tìm thấy dữ liệu tháng \`${yearMonth}\` để xuất file!`, { parse_mode: "Markdown" });
    }

    await ctx.replyWithDocument({
      source: exportPath,
      filename: `BaoCao_NailMi_TuyetTran_${yearMonth}.csv`
    }, {
      caption: `📊 File Excel báo cáo chi tiết tháng **${yearMonth}**`
    });
  } catch (err) {
    try { await ctx.telegram.deleteMessage(ctx.chat.id, statusMsg.message_id); } catch (e) {}
    return ctx.reply(`❌ **Không thể xuất file báo cáo tháng ${yearMonth}:** ${err.message}`, { parse_mode: "Markdown" });
  }
}

async function handleSearch(ctx) {
  const parts = ctx.message.text.trim().split(" ");
  const dateStr = parts[1];

  if (!dateStr || !/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) {
    return ctx.reply("⚠️ Định dạng không hợp lệ! Sử dụng: `/search YYYY-MM-DD` (Ví dụ: `/search 2026-08-01`)", { parse_mode: "Markdown" });
  }

  const summary = await financialService.getDailySummary(dateStr);
  if (!summary) {
    return ctx.reply(`🔍 **KẾT QUẢ TRA CỨU NGÀY ${dateStr}:**\nKhông có báo cáo nào trong ngày này.`, { parse_mode: "Markdown" });
  }

  let msg = `🔍 **TỔNG HỢP TRA CỨU NGÀY ${dateStr}**\n\n`;
  msg += `👩‍🎨 **DOANH SỐ THỢ:**\n`;
  Object.keys(summary.staffStats).forEach(name => {
    const st = summary.staffStats[name];
    msg += `• **${name}**: ${formatMoney(st.total)} (Công: \`${st.score}\`)\n`;
  });
  msg += `\n💰 Doanh thu: ${formatMoney(summary.revenue.total)}\n`;
  msg += `📉 Chi tiêu: ${formatMoney(summary.expenses.total)}\n`;
  msg += `💵 Lợi nhuận: ${formatMoney(summary.netProfit)}\n`;

  return ctx.reply(msg, { parse_mode: "Markdown" });
}

async function handleTragop(ctx) {
  const installments = await installmentRepo.getInstallmentsList();

  if (installments.length === 0) {
    return ctx.reply("💳 **DANH SÁCH MUA TRẢ GÓP:**\nHiện chưa có hợp đồng mua trả góp nào.", { parse_mode: "Markdown" });
  }

  let msg = `💳 **DANH SÁCH CÁC HỢP ĐỒNG TRẢ GÓP DÀI HẠN**\n\n`;
  installments.forEach((ins, idx) => {
    msg += `${idx + 1}. **${ins.item_name}** (ID: \`${ins.id}\`)\n`;
    msg += `   • Tổng tiền: ${formatMoney(ins.total_amount)}\n`;
    msg += `   • Kỳ hạn: ${ins.months} tháng (${formatMoney(ins.monthly_amount)}/tháng)\n`;
    msg += `   • Tháng mua: \`${ins.purchase_year_month}\` ➔ Bắt đầu trừ: \`${ins.start_year_month}\`\n\n`;
  });

  return ctx.reply(msg, { parse_mode: "Markdown" });
}

async function handleMyId(ctx) {
  const userId = ctx.from.id;
  const isAdmin = await adminRepo.isAdminUser(userId);

  let msg = `🆔 **THÔNG TIN TELEGRAM CỦA BẠN:**\n`;
  msg += `• User ID: \`${userId}\`\n`;
  msg += `• Quyền hạn: ${isAdmin ? "👑 **ADMIN / CHỦ TIỆM**" : "👤 **NHÂN VIÊN / THỢ**"}\n`;

  return ctx.reply(msg, { parse_mode: "Markdown" });
}

async function handleAddPast(ctx) {
  const text = ctx.message.text.trim();
  const match = text.match(/^\/addpast\s+(\d{4}-\d{2}-\d{2})\s+(.+)$/s);

  if (!match) {
    return ctx.reply("⚠️ Cú pháp chưa đúng! Sử dụng: `/addpast YYYY-MM-DD Nội_dung_báo_cáo`\nVí dụ: `/addpast 2026-08-01 Quỳnh Anh gội móng 300k`", { parse_mode: "Markdown" });
  }

  const explicitDate = match[1];
  const reportText = match[2];

  const statusMsg = await ctx.reply(`⌛ *Đang bóc tách báo cáo cho ngày cũ (${explicitDate})...*`, { parse_mode: "Markdown" });

  try {
    const currentStaff = await staffRepo.getStaffList();
    const result = await aiService.extractDailyReport({
      textInput: reportText,
      customStaffList: currentStaff
    });

    const saved = await reportRepo.saveReport(result, {
      userInfo: { id: ctx.from.id, first_name: ctx.from.first_name },
      inputType: "addpast"
    }, explicitDate);

    await ctx.telegram.deleteMessage(ctx.chat.id, statusMsg.message_id);
    return ctx.reply(`✅ **Đã bổ sung thành công báo cáo cho ngày ${explicitDate}!**\n🆔 Mã ID: \`${saved.record.id}\``, { parse_mode: "Markdown" });
  } catch (err) {
    try { await ctx.telegram.deleteMessage(ctx.chat.id, statusMsg.message_id); } catch(e){}
    return ctx.reply(`❌ Lỗi xử lý ngày cũ: ${err.message}`, { parse_mode: "Markdown" });
  }
}

async function handleHistory(ctx) {
  const text = ctx.message.text.trim();
  const parts = text.split(/\s+/);
  const targetDate = parts[1] || new Date().toISOString().substring(0, 10);

  const backups = await reportRepo.getBackupsByDate(targetDate);
  if (!backups || backups.length === 0) {
    return ctx.reply(`📦 **LỊCH SỬ BÁO CÁO NGÀY ${targetDate}:**\nChưa có bản sao lưu (backup) nào ghi nhận bị ghi đè hoặc chỉnh sửa trong ngày này.`, {
      parse_mode: "Markdown"
    });
  }

  let msg = `📦 **DANH SÁCH BẢN SAO LƯU BỊ GHI ĐÈ NGÀY ${targetDate}:**\n`;
  msg += `------------------------------------\n`;

  backups.forEach((b, idx) => {
    const createdTime = new Date(b.created_at).toLocaleTimeString("vi-VN", { hour: "2-digit", minute: "2-digit" });
    const count = Array.isArray(b.snapshot_data) ? b.snapshot_data.length : 1;
    msg += `${idx + 1}. 🆔 Backup ID: \`${b.id}\` (${createdTime})\n`;
    msg += `   • Hành động: \`${b.action_type || b.action}\` (${count} lượt báo cáo)\n`;
    msg += `   • Lệnh phục hồi: \`/restore ${b.id}\`\n\n`;
  });

  return ctx.reply(msg, { parse_mode: "Markdown" });
}

async function handleRestore(ctx) {
  const text = ctx.message.text.trim();
  const parts = text.split(/\s+/);
  const backupId = parts[1];

  if (!backupId) {
    return ctx.reply("⚠️ Cú pháp chưa đúng! Vui lòng nhập: `/restore <BACKUP_ID>`\nVí dụ: `/restore BAK_172345678_123`", {
      parse_mode: "Markdown"
    });
  }

  try {
    const result = await reportRepo.restoreReportBackup(backupId);
    const userInfo = { id: ctx.from.id, first_name: ctx.from.first_name, username: ctx.from.username };
    await reportRepo.logAuditAction("RESTORE", result.targetDate, backupId, userInfo, `Khôi phục thành công ${result.restoredCount} lượt báo cáo`);

    return ctx.reply(`🎉 **ĐÃ KHÔI PHỤC THÀNH CÔNG ${result.restoredCount} LƯỢT BÁO CÁO CỦA NGÀY ${result.targetDate}!**\nDữ liệu cũ đã được khôi phục nguyên vẹn.`, {
      parse_mode: "Markdown"
    });
  } catch (err) {
    return ctx.reply(`❌ **Khôi phục thất bại:** ${err.message}`, { parse_mode: "Markdown" });
  }
}

module.exports = {
  handleToday,
  handleMonth,
  handleLuong,
  handleExport,
  handleSearch,
  handleTragop,
  handleMyId,
  handleAddPast,
  handleHistory,
  handleRestore
};
