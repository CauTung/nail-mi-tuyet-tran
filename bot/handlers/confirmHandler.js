const reportRepo = require("../../db/repositories/reportRepository");
const staffRepo = require("../../db/repositories/staffRepository");

// Mảng lưu bản nháp tạm thời trong bộ nhớ server trước khi bấm nút xác nhận
const draftStore = new Map();
// Mảng lưu trạng thái chờ tin nhắn đính chính (Sửa Nhanh) từ người dùng (key: userId)
const pendingEdits = new Map();

function saveDraft(result, metaInfo) {
  const draftId = `DRAFT_${Date.now()}_${Math.floor(Math.random() * 1000)}`;
  draftStore.set(draftId, {
    result,
    metaInfo,
    createdAt: Date.now()
  });

  // Tự động xóa draft sau 30 phút để giải phóng RAM
  setTimeout(() => {
    draftStore.delete(draftId);
  }, 30 * 60 * 1000);

  return draftId;
}

function getDraft(draftId) {
  return draftStore.get(draftId);
}

function deleteDraft(draftId) {
  draftStore.delete(draftId);
}

function setPendingEdit(userId, draftId) {
  pendingEdits.set(userId, { draftId, createdAt: Date.now() });
  setTimeout(() => {
    if (pendingEdits.get(userId)?.draftId === draftId) {
      pendingEdits.delete(userId);
    }
  }, 15 * 60 * 1000);
}

function getPendingEdit(userId) {
  const pending = pendingEdits.get(userId);
  return pending ? pending.draftId : null;
}

function clearPendingEdit(userId) {
  pendingEdits.delete(userId);
}

function formatPreviewResponse(reportData, targetDateStr, confidence, dateReasoning, existingCount = 0) {
  let msg = `📋 **XEM TRƯỚC BÁO CÁO THU CHI**\n`;
  msg += `------------------------------------\n`;
  msg += `📅 **Ngày ghi nhận**: \`${targetDateStr}\`\n`;

  if (confidence === "high") {
    msg += `🎯 *Mức độ tin cậy ngày: CAO (Đọc được ngày trên sổ)*\n`;
  } else if (confidence === "medium") {
    msg += `⚠️ *Mức độ tin cậy ngày: TRUNG BÌNH*\n`;
  } else {
    msg += `🚨 *Mức độ tin cậy ngày: THẤP (Không thấy ngày viết tay, dùng ngày hôm nay)*\n`;
  }
  if (dateReasoning) {
    msg += `💡 *Lý do AI:* ${dateReasoning}\n`;
  }
  msg += `\n`;

  const warnings = [];
  if (confidence === "low") {
    warnings.push(`🚨 AI không nhận diện được ngày viết tay rõ ràng, tạm dùng ngày hiện tại (\`${targetDateStr}\`).`);
  }

  let grandTotal = 0;
  if (Array.isArray(reportData.staff_data) && reportData.staff_data.length > 0) {
    msg += `👩‍🎨 **CHI TIẾT DOANH SỐ NHÂN VIÊN:**\n`;
    reportData.staff_data.forEach(s => {
      const gm = (typeof s.revenue === "object" ? s.revenue?.goi_mong : 0) || s.goi_mong || 0;
      const mi = (typeof s.revenue === "object" ? s.revenue?.mi : 0) || s.mi || 0;
      const ng = (typeof s.revenue === "object" ? s.revenue?.ngoai_gio : 0) || s.ngoai_gio || 0;
      const total = gm + mi + ng;
      grandTotal += total;

      const staffName = s.name || s.staff_name || "Nhân viên";
      if (s.is_unknown_staff) {
        warnings.push(`⚠️ Tên thợ **"${staffName}"** chưa có trong hệ thống (sẽ tự động thêm khi chốt lưu).`);
      }
      if (total > 5000000) {
        warnings.push(`💰 Doanh số thợ **"${staffName}"** cao bất thường (${new Intl.NumberFormat("vi-VN").format(total)}đ > 5 triệu).`);
      }

      const unknownTag = s.is_unknown_staff ? " ⚠️ *(Tên mới)*" : "";
      msg += `• **${staffName}**${unknownTag}: ${new Intl.NumberFormat("vi-VN").format(total)}đ\n`;
    });
    msg += `\n`;
  }

  if (grandTotal > 15000000) {
    warnings.push(`💰 Tổng doanh số ngày lớn (${new Intl.NumberFormat("vi-VN").format(grandTotal)}đ > 15 triệu).`);
  }

  let totalExpense = 0;
  if (Array.isArray(reportData.expenses_data) && reportData.expenses_data.length > 0) {
    msg += `💸 **CHI TIÊU:**\n`;
    reportData.expenses_data.forEach(exp => {
      const amt = exp.amount || 0;
      totalExpense += amt;
      const notes = exp.notes || exp.category || "Chi tiêu";
      if (amt > 2000000) {
        warnings.push(`💸 Khoản chi **"${notes}"** lớn bất thường (${new Intl.NumberFormat("vi-VN").format(amt)}đ > 2 triệu).`);
      }
      msg += `• ${notes}: ${new Intl.NumberFormat("vi-VN").format(amt)}đ\n`;
    });
    msg += `\n`;
  }

  if (Array.isArray(reportData.installments_data) && reportData.installments_data.length > 0) {
    msg += `💳 **MUA TRẢ GÓP MỚI:**\n`;
    reportData.installments_data.forEach(ins => {
      msg += `• ${ins.item_name}: ${new Intl.NumberFormat("vi-VN").format(ins.total_amount || 0)}đ (${ins.months} tháng - ${new Intl.NumberFormat("vi-VN").format(ins.monthly_amount || 0)}đ/tháng)\n`;
    });
    msg += `\n`;
  }

  msg += `------------------------------------\n`;
  msg += `💰 **Tổng doanh thu:** ${new Intl.NumberFormat("vi-VN").format(grandTotal)}đ\n`;
  msg += `📉 **Tổng chi tiêu:** ${new Intl.NumberFormat("vi-VN").format(totalExpense)}đ\n`;
  msg += `💵 **Thực nhận:** ${new Intl.NumberFormat("vi-VN").format(grandTotal - totalExpense)}đ\n\n`;

  if (warnings.length > 0) {
    msg += `⚠️ **CÁC CẢNH BÁO BẤT THƯỜNG DỰ BÁO:**\n`;
    warnings.forEach(w => {
      msg += `• ${w}\n`;
    });
    msg += `\n`;
  }

  if (existingCount > 0) {
    msg += `⚠️ **CẢNH BÁO TRÙNG LẶP:** Ngày \`${targetDateStr}\` **ĐÃ CÓ ${existingCount} BÁO CÁO** trước đó!\n`;
    msg += `Vui lòng chọn **[Cộng dồn]**, **[Ghi đè]** hoặc **[Sửa nhanh]** bên dưới:`;
  } else {
    msg += `❓ **Vui lòng kiểm tra lại thông tin trên và chọn thao tác:**`;
  }

  return msg;
}

function buildPreviewKeyboards(draftId, existingCount = 0) {
  if (existingCount > 0) {
    return {
      inline_keyboard: [
        [
          { text: "➕ Cộng Dồn Lượt Mới", callback_data: `confirm_append:${draftId}` },
          { text: "🔄 Ghi Đè Bản Cũ", callback_data: `confirm_overwrite:${draftId}` }
        ],
        [
          { text: "✏️ Sửa Nhanh", callback_data: `edit_draft:${draftId}` },
          { text: "❌ Hủy Bỏ", callback_data: `cancel_report:${draftId}` }
        ]
      ]
    };
  }

  return {
    inline_keyboard: [
      [
        { text: "✅ Xác Nhận Lưu", callback_data: `confirm_save:${draftId}` },
        { text: "✏️ Sửa Nhanh", callback_data: `edit_draft:${draftId}` }
      ],
      [
        { text: "❌ Hủy Bỏ", callback_data: `cancel_report:${draftId}` }
      ]
    ]
  };
}

async function handleCallbackQuery(ctx) {
  const data = ctx.callbackQuery.data || "";
  const [action, draftId] = data.split(":");

  if (!action || !draftId) return ctx.answerCbQuery("❌ Yêu cầu không hợp lệ!");

  const draft = getDraft(draftId);
  if (!draft && action !== "cancel_report") {
    await ctx.answerCbQuery("⚠️ Bản nháp báo cáo đã hết hạn. Vui lòng gửi lại ảnh!");
    return ctx.editMessageText("⚠️ *Bản nháp báo cáo đã hết hạn hoặc đã được xử lý trước đó.*", { parse_mode: "Markdown" });
  }

  const userInfo = {
    id: ctx.from.id,
    first_name: ctx.from.first_name,
    username: ctx.from.username
  };

  const autoSaveNewStaff = async (staffData) => {
    if (Array.isArray(staffData)) {
      for (const s of staffData) {
        const staffName = (s.name || s.staff_name || "").trim();
        if (staffName && s.is_unknown_staff) {
          try {
            await staffRepo.addStaff(staffName);
          } catch (e) {
            console.warn(`⚠️ Lỗi khi thêm thợ mới ${staffName}:`, e.message);
          }
        }
      }
    }
  };

  if (action === "confirm_save" || action === "confirm_append") {
    await ctx.answerCbQuery("⏳ Đang lưu báo cáo...");
    draft.result.replacement_mode = "append";
    const saved = await reportRepo.saveReport(draft.result, {
      userInfo: draft.metaInfo.userInfo,
      inputType: draft.metaInfo.inputType
    });

    await reportRepo.logAuditAction("CREATE", saved.dateStr, saved.record.id, userInfo, "Lưu báo cáo mới thành công");
    await autoSaveNewStaff(draft.result.staff_data);

    deleteDraft(draftId);
    clearPendingEdit(ctx.from.id);
    await ctx.editMessageText(`✅ **ĐÃ LƯU THÀNH CÔNG BÁO CÁO NGÀY ${saved.dateStr}!**\n🆔 Mã báo cáo: \`${saved.record.id}\``, {
      parse_mode: "Markdown"
    });

  } else if (action === "confirm_overwrite") {
    await ctx.answerCbQuery("⏳ Đang sao lưu bản cũ & ghi đè báo cáo mới...");
    draft.result.replacement_mode = "replace_all";
    const saved = await reportRepo.saveReport(draft.result, {
      userInfo: draft.metaInfo.userInfo,
      inputType: draft.metaInfo.inputType
    });

    await reportRepo.logAuditAction("OVERWRITE", saved.dateStr, saved.record.id, userInfo, "Ghi đè báo cáo thành công (Đã sao lưu bản cũ)");
    await autoSaveNewStaff(draft.result.staff_data);

    deleteDraft(draftId);
    clearPendingEdit(ctx.from.id);
    await ctx.editMessageText(`🔄 **ĐÃ GHI ĐÈ THÀNH CÔNG BÁO CÁO NGÀY ${saved.dateStr}!**\n📦 Bản cũ đã được sao lưu an toàn.\n🆔 Mã báo cáo mới: \`${saved.record.id}\``, {
      parse_mode: "Markdown"
    });

  } else if (action === "edit_draft") {
    setPendingEdit(ctx.from.id, draftId);
    await ctx.answerCbQuery("✏️ Vui lòng gõ tin nhắn đính chính số liệu!");
    let editPromptMsg = `✏️ **BẠN ĐANG CHỌN SỬA NHANH BÁO CÁO**\n`;
    editPromptMsg += `------------------------------------\n`;
    editPromptMsg += `Vui lòng nhập tin nhắn đính chính ngay bên dưới.\n\n`;
    editPromptMsg += `💡 *Ví dụ:* \n`;
    editPromptMsg += `• \`Sửa ngày thành 12/08/2026\`\n`;
    editPromptMsg += `• \`Quỳnh Anh móng 300k, mi 200k\`\n`;
    editPromptMsg += `• \`Chi 50k mua nước đá\`\n`;
    editPromptMsg += `• \`Đổi tên Ngọc Mới thành Nhi\`\n\n`;
    editPromptMsg += `👉 *Sau khi bạn gửi tin nhắn đính chính, Bot sẽ cập nhật lại bản Xem Trước cho bạn!*`;

    await ctx.reply(editPromptMsg, { parse_mode: "Markdown" });

  } else if (action === "cancel_report") {
    await ctx.answerCbQuery("Đã hủy bỏ báo cáo.");
    deleteDraft(draftId);
    clearPendingEdit(ctx.from.id);
    await ctx.editMessageText("❌ **Đã hủy bỏ lượt ghi nhận báo cáo.**", { parse_mode: "Markdown" });
  }
}

module.exports = {
  saveDraft,
  getDraft,
  deleteDraft,
  setPendingEdit,
  getPendingEdit,
  clearPendingEdit,
  formatPreviewResponse,
  buildPreviewKeyboards,
  handleCallbackQuery
};
