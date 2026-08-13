const fetch = require("node-fetch");
const aiService = require("../../services/aiService");
const reportRepo = require("../../db/repositories/reportRepository");
const staffRepo = require("../../db/repositories/staffRepository");
const confirmHandler = require("./confirmHandler");

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
      const gm = (typeof s.revenue === "object" ? s.revenue?.goi_mong : 0) || s.goi_mong || s.goi || 0;
      const mi = (typeof s.revenue === "object" ? s.revenue?.mi : 0) || s.mi || s.xam || 0;
      const ng = (typeof s.revenue === "object" ? s.revenue?.ngoai_gio : 0) || s.ngoai_gio || s.tang_ca || 0;
      const total = gm + mi + ng;
      grandTotal += total;

      const staffName = s.name || s.staff_name || s.ten_nhan_vien || "Nhân viên";
      const unknownTag = s.is_unknown_staff ? " ⚠️ *(Tên mới)*" : "";
      msg += `• **${staffName}**${unknownTag}:\n`;
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
      const delContent = del.content || del.item || del.notes || (del.original_amount ? formatMoney(del.original_amount) : "Dòng bị gạch xóa");
      msg += `• ~"${delContent}"~ (Lý do: ${del.reason || "Số bị gạch xóa"})\n`;
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

// Bộ nhớ gom album ảnh gửi cùng lúc (MediaGroup Batch Store)
const albumStore = new Map();

async function processMediaBatch(mediaGroupId, statusMsg, batchData) {
  if (!batchData) return;
  const { ctx, photosData, textMsg, userInfo } = batchData;

  try {
    const imageBuffers = await Promise.all(
      photosData.map(async (p) => {
        // Chọn độ phân giải cao nhất (p.length - 1) để chữ viết tay luôn sắc nét 100%
        const targetPhoto = p[p.length - 1];
        const fileUrl = await ctx.telegram.getFileLink(targetPhoto.file_id);
        const res = await fetch(fileUrl.href);
        return await res.buffer();
      })
    );

    const todayStr = new Date().toISOString().substring(0, 10);
    const existingReports = await reportRepo.getDailyReports(todayStr);
    const currentStaff = await staffRepo.getStaffList();

    const result = await aiService.extractDailyReport({
      textInput: textMsg,
      imageBuffers,
      mimeType: "image/jpeg",
      customStaffList: currentStaff,
      existingReports
    });

    imageBuffers.forEach(buf => reportRepo.savePhotoLog(buf, result));

    const targetDateStr = result.report_date || todayStr;
    const existingReportsForDate = await reportRepo.getDailyReports(targetDateStr);
    const existingCount = existingReportsForDate ? existingReportsForDate.length : 0;

    const draftId = confirmHandler.saveDraft(result, {
      userInfo,
      inputType: `photo_album (${imageBuffers.length} ảnh)`
    });

    const previewMsg = confirmHandler.formatPreviewResponse(
      result,
      targetDateStr,
      result.date_confidence || "medium",
      result.date_reasoning || "",
      existingCount
    );
    const replyMarkup = confirmHandler.buildPreviewKeyboards(draftId, existingCount);

    await ctx.telegram.deleteMessage(ctx.chat.id, statusMsg.message_id);
    await ctx.reply(previewMsg, {
      parse_mode: "Markdown",
      reply_markup: replyMarkup
    });

  } catch (err) {
    console.error("Lỗi xử lý OCR album ảnh:", err);
    try { await ctx.telegram.deleteMessage(ctx.chat.id, statusMsg.message_id); } catch (e) {}
    await ctx.reply(`❌ **Đã xảy ra lỗi khi đọc album ảnh:** ${err.message}`, { parse_mode: "Markdown" });
  }
}

async function handleOcrMessage(ctx, next) {
  const textMsg = ctx.message.text || ctx.message.caption || "";
  const photo = ctx.message.photo;
  const mediaGroupId = ctx.message.media_group_id;

  // Nếu là câu lệnh (bắt đầu bằng '/'), chuyển qua handler lệnh
  if (textMsg.startsWith("/")) {
    return next();
  }

  const userInfo = {
    id: ctx.from.id,
    first_name: ctx.from.first_name,
    username: ctx.from.username
  };

  // Xử lý đính chính Quick Edit (Sửa Nhanh)
  const pendingDraftId = confirmHandler.getPendingEdit(ctx.from.id);
  if (pendingDraftId && textMsg.trim().length > 0 && !photo) {
    const draft = confirmHandler.getDraft(pendingDraftId);
    if (!draft) {
      confirmHandler.clearPendingEdit(ctx.from.id);
      return ctx.reply("⚠️ *Bản nháp báo cáo đã hết hạn hoặc đã được xử lý. Vui lòng gửi lại ảnh!*", { parse_mode: "Markdown" });
    }

    const statusMsg = await ctx.reply("🔄 *Bot đang điều chỉnh số liệu báo cáo theo đính chính của bạn... Vui lòng đợi trong giây lát!*", {
      parse_mode: "Markdown"
    });

    try {
      const currentStaff = await staffRepo.getStaffList();
      const promptContext = `BẢN BÁO CÁO HIỆN TẠI:\n${JSON.stringify(draft.result, null, 2)}\n\nYÊU CẦU ĐÍNH CHÍNH / SỬA ĐỔI CỦA NGƯỜI DÙNG:\n"""${textMsg}"""\n\nHãy điều chỉnh toàn bộ JSON báo cáo trên theo đúng yêu cầu đính chính của người dùng. Giữ nguyên các thông tin đúng và chỉ sửa đổi/bổ sung các thông tin được yêu cầu.`;

      const updatedResult = await aiService.extractDailyReport({
        textInput: promptContext,
        customStaffList: currentStaff,
        existingReports: []
      });

      if (updatedResult && updatedResult.status === "success" && updatedResult.is_financial_report !== false) {
        draft.result = updatedResult;
        confirmHandler.clearPendingEdit(ctx.from.id);

        const targetDateStr = updatedResult.report_date || draft.result.report_date || new Date().toISOString().substring(0, 10);
        const existingReportsForDate = await reportRepo.getDailyReports(targetDateStr);
        const existingCount = existingReportsForDate ? existingReportsForDate.length : 0;

        const previewMsg = confirmHandler.formatPreviewResponse(
          updatedResult,
          targetDateStr,
          updatedResult.date_confidence || "high",
          updatedResult.date_reasoning || "Đã cập nhật theo tin nhắn đính chính",
          existingCount
        );
        const replyMarkup = confirmHandler.buildPreviewKeyboards(pendingDraftId, existingCount);

        try { await ctx.telegram.deleteMessage(ctx.chat.id, statusMsg.message_id); } catch (e) {}
        await ctx.reply(`✨ **ĐÃ CẬP NHẬT ĐÍNH CHÍNH BÁO CÁO!**\n\n${previewMsg}`, {
          parse_mode: "Markdown",
          reply_markup: replyMarkup
        });
        return;
      }
    } catch (err) {
      console.error("Lỗi khi đính chính báo cáo:", err);
      try { await ctx.telegram.deleteMessage(ctx.chat.id, statusMsg.message_id); } catch (e) {}
      await ctx.reply(`❌ **Không thể cập nhật đính chính:** ${err.message}`, { parse_mode: "Markdown" });
      return;
    }
  }

  // Xử lý gửi Album nhiều ảnh cùng lúc
  if (mediaGroupId && photo) {
    if (!albumStore.has(mediaGroupId)) {
      // Đặt ngay trạng thái đồng bộ vào Map trước để chặn các ảnh 2, 3, 4 gửi tin nhắn lặp
      albumStore.set(mediaGroupId, {
        ctx,
        photosData: [photo],
        textMsg: textMsg || "",
        userInfo,
        statusMsgPromise: ctx.reply(`🔍 *Bot đã nhận album ảnh. Đang bóc tách dữ liệu từ các trang ảnh... Vui lòng đợi trong giây lát!*`, {
          parse_mode: "Markdown"
        }),
        timer: null
      });

      const entry = albumStore.get(mediaGroupId);
      entry.timer = setTimeout(async () => {
        const batchData = albumStore.get(mediaGroupId);
        if (!batchData) return;
        albumStore.delete(mediaGroupId);

        const statusMsg = await batchData.statusMsgPromise;
        processMediaBatch(mediaGroupId, statusMsg, batchData);
      }, 1500);

    } else {
      const entry = albumStore.get(mediaGroupId);
      entry.photosData.push(photo);
      if (textMsg && !entry.textMsg) entry.textMsg = textMsg;

      clearTimeout(entry.timer);
      entry.timer = setTimeout(async () => {
        const batchData = albumStore.get(mediaGroupId);
        if (!batchData) return;
        albumStore.delete(mediaGroupId);

        const statusMsg = await batchData.statusMsgPromise;
        processMediaBatch(mediaGroupId, statusMsg, batchData);
      }, 1500);
    }
    return;
  }

  // Xử lý đơn lẻ 1 ảnh hoặc 1 tin nhắn văn bản
  const statusMsg = await ctx.reply("🔍 *Bot đang dùng Gemini Vision AI phân tích báo cáo... Vui lòng đợi trong giây lát!*", {
    parse_mode: "Markdown"
  });

  try {
    let result = null;
    let imageBuffer = null;

    const todayStr = new Date().toISOString().substring(0, 10);
    const existingReports = await reportRepo.getDailyReports(todayStr);

    if (photo && photo.length > 0) {
      const targetPhoto = photo[photo.length - 1];
      const fileUrl = await ctx.telegram.getFileLink(targetPhoto.file_id);
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

    if (result.is_financial_report === false && result.chat_reply) {
      await ctx.telegram.deleteMessage(ctx.chat.id, statusMsg.message_id);
      return ctx.reply(result.chat_reply, { parse_mode: "Markdown" });
    }

    const targetDateStr = result.report_date || todayStr;
    const existingReportsForDate = await reportRepo.getDailyReports(targetDateStr);
    const existingCount = existingReportsForDate ? existingReportsForDate.length : 0;

    const draftId = confirmHandler.saveDraft(result, {
      userInfo,
      inputType: photo ? "photo" : "text"
    });

    const previewMsg = confirmHandler.formatPreviewResponse(
      result,
      targetDateStr,
      result.date_confidence || "medium",
      result.date_reasoning || "",
      existingCount
    );
    const replyMarkup = confirmHandler.buildPreviewKeyboards(draftId, existingCount);

    await ctx.telegram.deleteMessage(ctx.chat.id, statusMsg.message_id);
    await ctx.reply(previewMsg, {
      parse_mode: "Markdown",
      reply_markup: replyMarkup
    });

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
