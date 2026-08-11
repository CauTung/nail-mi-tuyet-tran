const fetch = require("node-fetch");
const aiService = require("../../services/aiService");
const reportRepo = require("../../db/repositories/reportRepository");
const staffRepo = require("../../db/repositories/staffRepository");

function formatMoney(amount) {
  return new Intl.NumberFormat("vi-VN").format(amount || 0) + "đ";
}

function formatReportResponse(reportData, reportId, targetDateStr) {
  let msg = `✅ **BÁO CÁO NGÀY ${targetDateStr} ĐÃ ĐƯỢC GHI NHẬN!**\n`;
  msg += `🆔 Mã báo cáo: \`${reportId}\`\n\n`;

  let grandTotal = 0;
  if (Array.isArray(reportData.staff_data) && reportData.staff_data.length > 0) {
    msg += `👩‍🎨 **CHI TIẾT DOANH SỐ NHÂN VIÊN:**\n`;
    reportData.staff_data.forEach(s => {
      const gm = s.revenue?.goi_mong || 0;
      const mi = s.revenue?.mi || 0;
      const ng = s.revenue?.ngoai_gio || 0;
      const total = gm + mi + ng;
      grandTotal += total;

      const unknownTag = s.is_unknown_staff ? " ⚠️ *(Tên mới)*" : "";
      msg += `• **${s.name}**${unknownTag}:\n`;
      msg += `  - Điểm công: \`${s.attendance_score !== undefined ? s.attendance_score : 1}\` *(${s.attendance_description || "Làm cả ngày"})*\n`;
      if (gm > 0) msg += `  - Gội/Móng: ${formatMoney(gm)}\n`;
      if (mi > 0) msg += `  - Mi/Xăm: ${formatMoney(mi)}\n`;
      if (ng > 0) msg += `  - Ngoài giờ: ${formatMoney(ng)}\n`;
      msg += `  ➔ **Tổng: ${formatMoney(total)}**\n\n`;
    });
  }

  let totalExpense = 0;
  if (Array.isArray(reportData.expenses_data) && reportData.expenses_data.length > 0) {
    msg += `💸 **KHOẢN CHI TIÊU:**\n`;
    reportData.expenses_data.forEach(exp => {
      totalExpense += (exp.amount || 0);
      msg += `• ${exp.notes || exp.category}: **${formatMoney(exp.amount)}**\n`;
    });
    msg += `\n`;
  }

  if (Array.isArray(reportData.installments_data) && reportData.installments_data.length > 0) {
    msg += `💳 **MUA TRẢ GÓP MỚI KHỞI TẠO:**\n`;
    reportData.installments_data.forEach(ins => {
      msg += `• ${ins.item_name}: **${formatMoney(ins.total_amount)}** (Trả ${ins.months} tháng - **${formatMoney(ins.monthly_amount)}/tháng**)\n`;
      msg += `  *(Tự động trừ vào lợi nhuận ròng từ THÁNG SAU)*\n`;
    });
    msg += `\n`;
  }

  if (Array.isArray(reportData.deleted_items) && reportData.deleted_items.length > 0) {
    msg += `🗑️ **DÒNG BỊ GẠCH XÓA / BỎ QUA:**\n`;
    reportData.deleted_items.forEach(del => {
      msg += `• ~"${del.content}"~ (Lý do: ${del.reason})\n`;
    });
    msg += `\n`;
  }

  msg += `----------------------------\n`;
  msg += `💰 **Tổng doanh thu lượt:** ${formatMoney(grandTotal)}\n`;
  msg += `📉 **Tổng chi tiêu lượt:** ${formatMoney(totalExpense)}\n`;
  msg += `💵 **Thu thực nhận lượt:** ${formatMoney(grandTotal - totalExpense)}\n`;

  if (reportData.has_warning) {
    msg += `\n⚠️ **Cảnh báo:** ${reportData.warning_message}`;
  }

  return msg;
}

async function handleOcrMessage(ctx, next) {
  const textMsg = ctx.message.text || ctx.message.caption || "";
  const photo = ctx.message.photo;

  // Nếu là câu lệnh (bắt đầu bằng '/'), chuyển qua handler lệnh
  if (textMsg.startsWith("/")) {
    return next();
  }

  const userInfo = {
    id: ctx.from.id,
    first_name: ctx.from.first_name,
    username: ctx.from.username
  };

  const statusMsg = await ctx.reply("🔍 *Bot đang dùng Gemini Vision AI phân tích báo cáo... Vui lòng đợi trong giây lát!*", {
    parse_mode: "Markdown"
  });

  try {
    let result = null;
    let imageBuffer = null;

    const todayStr = new Date().toISOString().substring(0, 10);
    const existingReports = await reportRepo.getDailyReports(todayStr);

    if (photo && photo.length > 0) {
      const highestResPhoto = photo[photo.length - 1];
      const fileUrl = await ctx.telegram.getFileLink(highestResPhoto.file_id);
      const res = await fetch(fileUrl.href);
      imageBuffer = await res.buffer();

      const currentStaff = await staffRepo.getStaffList();
      result = await aiService.extractDailyReport({
        textInput: textMsg,
        imageBuffer,
        mimeType: "image/jpeg",
        customStaffList: currentStaff,
        existingReports
      });
      reportRepo.savePhotoLog(imageBuffer, result);
    } else if (textMsg.trim().length > 0) {
      const currentStaff = await staffRepo.getStaffList();
      result = await aiService.extractDailyReport({
        textInput: textMsg,
        customStaffList: currentStaff,
        existingReports
      });
      reportRepo.savePhotoLog(null, result);
    } else {
      await ctx.telegram.deleteMessage(ctx.chat.id, statusMsg.message_id);
      return;
    }

    if (!result || result.status !== "success") {
      await ctx.telegram.deleteMessage(ctx.chat.id, statusMsg.message_id);
      return ctx.reply("❌ **Không thể phân tích dữ liệu.** Vui lòng gửi lại tin nhắn hoặc ảnh rõ hơn!", {
        parse_mode: "Markdown"
      });
    }

    // Nếu đây là tin nhắn hỏi đáp / trò chuyện thông thường (không phải báo cáo tài chính)
    if (result.is_financial_report === false && result.chat_reply) {
      await ctx.telegram.deleteMessage(ctx.chat.id, statusMsg.message_id);
      return ctx.reply(result.chat_reply, { parse_mode: "Markdown" });
    }

    const saved = await reportRepo.saveReport(result, {
      userInfo,
      inputType: photo ? "photo" : "text"
    });

    const replyMsg = formatReportResponse(result, saved.record.id, saved.dateStr);
    await ctx.telegram.deleteMessage(ctx.chat.id, statusMsg.message_id);
    await ctx.reply(replyMsg, { parse_mode: "Markdown" });

  } catch (err) {
    console.error("Lỗi xử lý OCR message:", err);
    try {
      await ctx.telegram.deleteMessage(ctx.chat.id, statusMsg.message_id);
    } catch (e) {}
    await ctx.reply(`❌ **Đã xảy ra lỗi:** ${err.message}`, { parse_mode: "Markdown" });
  }
}

module.exports = {
  handleOcrMessage
};
