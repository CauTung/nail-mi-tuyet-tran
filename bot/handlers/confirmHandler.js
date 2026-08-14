const fs = require("fs");
const path = require("path");
const reportRepo = require("../../db/repositories/reportRepository");
const staffRepo = require("../../db/repositories/staffRepository");
const { getStaffTotalRevenue, getStaffRevenueBreakdown } = require("../../services/revenueService");
const { formatMoney } = require("../../utils/formatter");
const { safeEditOrReply, safeAnswerCbQuery } = require("../utils/botHelpers");
const { WARNING_THRESHOLDS } = require("../../config/thresholds");
const { TIMEOUTS } = require("../../config/constants");
const { buildPreviewKeyboards, buildEditMenuKeyboards, buildStaffListKeyboards, buildExpenseListKeyboards } = require("../utils/keyboardBuilder");

const DRAFTS_FILE_PATH = path.join(__dirname, "../../data/pending_drafts.json");

// Mảng lưu bản nháp tạm thời trong bộ nhớ server trước khi bấm nút xác nhận
const draftStore = new Map();
// Mảng lưu trạng thái chờ tin nhắn đính chính (Sửa Nhanh) từ người dùng (key: userId)
const pendingEdits = new Map();
// Mảng lưu bộ hẹn giờ nhắc nhở & tự động chốt (key: draftId)
const draftTimers = new Map();

function persistDraftsToFile() {
  try {
    const dataDir = path.dirname(DRAFTS_FILE_PATH);
    if (!fs.existsSync(dataDir)) {
      fs.mkdirSync(dataDir, { recursive: true });
    }
    const draftsArray = [];
    draftStore.forEach((value, key) => {
      const timers = draftTimers.get(key);
      draftsArray.push({
        draftId: key,
        result: value.result,
        metaInfo: value.metaInfo,
        createdAt: value.createdAt,
        chatId: timers?.chatId || null
      });
    });
    fs.writeFileSync(DRAFTS_FILE_PATH, JSON.stringify(draftsArray, null, 2), "utf8");
  } catch (err) {
    console.warn("⚠️ Không thể ghi file pending_drafts.json:", err.message);
  }
}

function loadPersistedDrafts(telegram) {
  try {
    if (!fs.existsSync(DRAFTS_FILE_PATH)) return;
    const raw = fs.readFileSync(DRAFTS_FILE_PATH, "utf8");
    const draftsArray = JSON.parse(raw);
    if (!Array.isArray(draftsArray)) return;

    const now = Date.now();
    draftsArray.forEach(d => {
      // Hết hạn theo TIMEOUTS.DRAFT_EXPIRATION_MS
      if (now - d.createdAt < TIMEOUTS.DRAFT_EXPIRATION_MS) {
        draftStore.set(d.draftId, {
          result: d.result,
          metaInfo: d.metaInfo,
          createdAt: d.createdAt
        });

        if (d.chatId && telegram) {
          scheduleDraftTimers(d.draftId, telegram, d.chatId);
        }
      }
    });
    console.log(`📦 [DRAFT PERSISTENCE] Đã khôi phục thành công ${draftStore.size} bản nháp từ bộ nhớ đệm.`);
  } catch (err) {
    console.warn("⚠️ Không thể đọc file pending_drafts.json:", err.message);
  }
}

// Thời gian mặc định: Nhắc nhở sau 3 phút, Tự động chốt lưu sau 10 phút
let REMINDER_DELAY_MS = 3 * 60 * 1000;
let AUTOSAVE_DELAY_MS = 10 * 60 * 1000;

function setTimerDurationsForTesting(reminderMs, autoSaveMs) {
  REMINDER_DELAY_MS = reminderMs;
  AUTOSAVE_DELAY_MS = autoSaveMs;
}

function clearDraftTimers(draftId) {
  const timers = draftTimers.get(draftId);
  if (timers) {
    if (timers.reminderTimeout) clearTimeout(timers.reminderTimeout);
    if (timers.autoSaveTimeout) clearTimeout(timers.autoSaveTimeout);
    draftTimers.delete(draftId);
  }
}

function scheduleDraftTimers(draftId, telegram, chatId) {
  clearDraftTimers(draftId);

  if (!telegram || !chatId) return;

  const reminderTimeout = setTimeout(async () => {
    const draft = draftStore.get(draftId);
    if (draft) {
      try {
        const targetDate = draft.result.report_date || new Date().toISOString().substring(0, 10);
        await telegram.sendMessage(chatId, `⏰ **NHẮC NHỞ CHỐT BÁO CÁO:**\nBạn có một bản nháp báo cáo ngày \`${targetDate}\` chưa được chốt lưu!\n\nVui lòng kiểm tra tin nhắn xem trước phía trên và bấm nút **[Xác Nhận]**, **[Cộng Dồn]** hoặc **[Ghi Đè]**.\nℹ️ *Bot sẽ tự động chốt lưu báo cáo này sau 7 phút nữa nếu bạn không thao tác.*`, { parse_mode: "Markdown" });
      } catch (err) {
        console.warn(`⚠️ Lỗi khi gửi tin nhắn nhắc nhở draft ${draftId}:`, err.message);
      }
    }
  }, REMINDER_DELAY_MS);

  const autoSaveTimeout = setTimeout(async () => {
    const draft = draftStore.get(draftId);
    if (draft) {
      try {
        const saved = await reportRepo.saveReport(draft.result, {
          userInfo: draft.metaInfo?.userInfo,
          inputType: draft.metaInfo?.inputType || "auto_confirm_timeout"
        });

        if (Array.isArray(draft.result.staff_data)) {
          for (const s of draft.result.staff_data) {
            const staffName = (s.name || s.staff_name || "").trim();
            if (staffName && s.is_unknown_staff) {
              try { await staffRepo.addStaff(staffName); } catch (e) {}
            }
          }
        }

        await telegram.sendMessage(chatId, `🤖 **TỰ ĐỘNG CHỐT LƯU BÁO CÁO:**\nDo bạn không thao tác sau 10 phút, Bot đã tự động chốt lưu báo cáo ngày \`${saved.dateStr}\` thành công!\n🆔 Mã báo cáo: \`${saved.record.id}\``, { parse_mode: "Markdown" });

        deleteDraft(draftId);
      } catch (err) {
        console.error(`❌ Lỗi khi tự động chốt lưu draft ${draftId}:`, err);
      }
    }
  }, AUTOSAVE_DELAY_MS);

  draftTimers.set(draftId, { reminderTimeout, autoSaveTimeout, telegram, chatId });
}

function saveDraft(result, metaInfo, telegramOptions = null) {
  const draftId = `DRAFT_${Date.now()}_${Math.floor(Math.random() * 1000)}`;
  draftStore.set(draftId, {
    result,
    metaInfo,
    createdAt: Date.now()
  });

  if (telegramOptions && telegramOptions.telegram && telegramOptions.chatId) {
    scheduleDraftTimers(draftId, telegramOptions.telegram, telegramOptions.chatId);
  }

  persistDraftsToFile();

  // Tự động xóa draft sau DRAFT_EXPIRATION_MS để giải phóng RAM
  setTimeout(() => {
    if (draftStore.has(draftId)) {
      clearDraftTimers(draftId);
      draftStore.delete(draftId);
      persistDraftsToFile();
    }
  }, TIMEOUTS.DRAFT_EXPIRATION_MS);

  return draftId;
}

function getDraft(draftId) {
  return draftStore.get(draftId);
}

function deleteDraft(draftId) {
  clearDraftTimers(draftId);
  draftStore.delete(draftId);
  persistDraftsToFile();
}

function setPendingEdit(userId, draftId, editType = "general", itemIndex = null) {
  pendingEdits.set(userId, { draftId, editType, itemIndex, createdAt: Date.now() });
  setTimeout(() => {
    if (pendingEdits.get(userId)?.draftId === draftId) {
      pendingEdits.delete(userId);
    }
  }, TIMEOUTS.PENDING_EDIT_TTL_MS);
}

function getPendingEdit(userId) {
  return pendingEdits.get(userId) || null;
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
      const total = getStaffTotalRevenue(s);
      grandTotal += total;

      const staffName = s.name || s.staff_name || "Nhân viên";
      if (s.is_unknown_staff) {
        warnings.push(`⚠️ Tên thợ **"${staffName}"** chưa có trong hệ thống (sẽ tự động thêm khi chốt lưu).`);
      }
      if (total >= WARNING_THRESHOLDS.STAFF_DAILY_TOTAL) {
        warnings.push(`💰 Doanh số thợ **"${staffName}"** trong ngày lớn (**${formatMoney(total)}** ≥ ${formatMoney(WARNING_THRESHOLDS.STAFF_DAILY_TOTAL)}).`);
      }

      const itemsArray = Array.isArray(s.items) ? s.items : (Array.isArray(s.single_items) ? s.single_items : []);
      itemsArray.forEach(itemVal => {
        const num = Number(typeof itemVal === "object" ? itemVal.amount : itemVal) || 0;
        if (num >= WARNING_THRESHOLDS.STAFF_SINGLE_ENTRY) {
          warnings.push(`⚠️ Thợ **"${staffName}"** có 1 lượt làm / 1 dòng đơn lẻ lớn bất thường (**${formatMoney(num)}** ≥ ${formatMoney(WARNING_THRESHOLDS.STAFF_SINGLE_ENTRY)}).`);
        }
      });

      const breakdownParts = getStaffRevenueBreakdown(s);
      const breakdownStr = breakdownParts.length > 0 ? ` *(${breakdownParts.join(", ")})*` : "";
      const unknownTag = s.is_unknown_staff ? " ⚠️ *(Tên mới)*" : "";
      msg += `• **${staffName}**${unknownTag}: **${formatMoney(total)}**${breakdownStr}\n`;
    });
    msg += `\n`;
  }

  if (grandTotal >= WARNING_THRESHOLDS.DAILY_GRAND_TOTAL) {
    warnings.push(`💰 Tổng doanh số ngày lớn (**${formatMoney(grandTotal)}** ≥ ${formatMoney(WARNING_THRESHOLDS.DAILY_GRAND_TOTAL)}).`);
  }

  let totalExpense = 0;
  if (Array.isArray(reportData.expenses_data) && reportData.expenses_data.length > 0) {
    msg += `💸 **CHI TIÊU:**\n`;
    reportData.expenses_data.forEach(exp => {
      const amt = exp.amount || 0;
      totalExpense += amt;
      const notes = exp.notes || exp.category || "Chi tiêu";
      if (amt >= WARNING_THRESHOLDS.SINGLE_EXPENSE) {
        warnings.push(`💸 Khoản chi **"${notes}"** lớn bất thường (**${formatMoney(amt)}** ≥ ${formatMoney(WARNING_THRESHOLDS.SINGLE_EXPENSE)}).`);
      }
      msg += `• ${notes}: ${formatMoney(amt)}\n`;
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



function formatCopyableText(reportData, targetDateStr) {
  let text = `📝 **SỬA BÁO CÁO THU CHI**\n*(Sao chép đoạn dưới, sửa thông tin và gửi lại Bot)*\n\n`;
  text += `\`\`\`text\n`;
  text += `Ngày: ${targetDateStr}\n`;
  text += `------------------------------------\n`;
  text += `Thợ:\n`;
  if (Array.isArray(reportData.staff_data) && reportData.staff_data.length > 0) {
    reportData.staff_data.forEach(s => {
      const name = s.name || s.staff_name || "Nhân viên";
      let parts = [];

      if (s.revenue && typeof s.revenue === "object") {
        Object.entries(s.revenue).forEach(([k, val]) => {
          const num = Number(val) || 0;
          if (num > 0) {
            parts.push(`${k} ${new Intl.NumberFormat("vi-VN").format(num)}đ`);
          }
        });
      } else {
        const gm = s.goi_mong || 0;
        const mi = s.mi || 0;
        const ng = s.ngoai_gio || 0;
        if (gm > 0) parts.push(`Gội/Móng ${new Intl.NumberFormat("vi-VN").format(gm)}đ`);
        if (mi > 0) parts.push(`Mi/Xăm ${new Intl.NumberFormat("vi-VN").format(mi)}đ`);
        if (ng > 0) parts.push(`Ngoài giờ ${new Intl.NumberFormat("vi-VN").format(ng)}đ`);
      }

      if (parts.length === 0) {
        parts.push(`${new Intl.NumberFormat("vi-VN").format(getStaffTotalRevenue(s))}đ`);
      }
      text += `- ${name}: ${parts.join(", ")}\n`;
    });
  } else {
    text += `- (Chưa có thông tin thợ)\n`;
  }
  text += `------------------------------------\n`;
  text += `Chi tiêu:\n`;
  if (Array.isArray(reportData.expenses_data) && reportData.expenses_data.length > 0) {
    reportData.expenses_data.forEach(exp => {
      text += `- ${exp.notes || exp.category}: ${new Intl.NumberFormat("vi-VN").format(exp.amount || 0)}đ\n`;
    });
  } else {
    text += `- (Không có chi tiêu)\n`;
  }
  text += `\`\`\``;
  return text;
}

async function handleCallbackQuery(ctx) {
  const data = ctx.callbackQuery.data || "";
  const parts = data.split(":");
  const action = parts[0];
  const draftId = parts[1];
  const itemIndex = parts[2] !== undefined ? parseInt(parts[2], 10) : null;

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
    try {
      draft.result.replacement_mode = "append";
      const saved = await reportRepo.saveReport(draft.result, {
        userInfo: draft.metaInfo.userInfo,
        inputType: draft.metaInfo.inputType
      });

      await reportRepo.logAuditAction("CREATE", saved.dateStr, saved.record.id, userInfo, "Lưu báo cáo mới thành công");
      await autoSaveNewStaff(draft.result.staff_data);

      deleteDraft(draftId);
      clearPendingEdit(ctx.from.id);

      const calcTotal = (draft.result?.staff_data || []).reduce((acc, s) => acc + getStaffTotalRevenue(s), 0);
      const successMsg = `✅ **ĐÃ LƯU THÀNH CÔNG BÁO CÁO NGÀY ${saved.dateStr}!**\n🆔 Mã báo cáo: \`${saved.record.id}\`\n💰 Tổng doanh thu: **${new Intl.NumberFormat("vi-VN").format(calcTotal)}đ**`;
      try {
        await ctx.editMessageText(successMsg, { parse_mode: "Markdown" });
      } catch (e) {
        await ctx.reply(successMsg, { parse_mode: "Markdown" });
      }
    } catch (err) {
      console.error("❌ Lỗi chốt lưu báo cáo:", err);
      await ctx.reply(`❌ ** KHÔNG THỂ LƯU BÁO CÁO!**\nChi tiết lỗi: \`${err.message}\``, { parse_mode: "Markdown" });
    }

  } else if (action === "confirm_overwrite") {
    await ctx.answerCbQuery("⏳ Đang sao lưu bản cũ & ghi đè báo cáo mới...");
    try {
      draft.result.replacement_mode = "replace_all";
      const saved = await reportRepo.saveReport(draft.result, {
        userInfo: draft.metaInfo.userInfo,
        inputType: draft.metaInfo.inputType
      });

      await reportRepo.logAuditAction("OVERWRITE", saved.dateStr, saved.record.id, userInfo, "Ghi đè báo cáo thành công (Đã sao lưu bản cũ)");
      await autoSaveNewStaff(draft.result.staff_data);

      deleteDraft(draftId);
      clearPendingEdit(ctx.from.id);

      const successMsg = `🔄 **ĐÃ GHI ĐÈ THÀNH CÔNG BÁO CÁO NGÀY ${saved.dateStr}!**\n📦 Bản cũ đã được sao lưu an toàn.\n🆔 Mã báo cáo mới: \`${saved.record.id}\``;
      try {
        await ctx.editMessageText(successMsg, { parse_mode: "Markdown" });
      } catch (e) {
        await ctx.reply(successMsg, { parse_mode: "Markdown" });
      }
    } catch (err) {
      console.error("❌ Lỗi ghi đè báo cáo:", err);
      await ctx.reply(`❌ **KHÔNG THỂ GHI ĐÈ BÁO CÁO!**\nChi tiết lỗi: \`${err.message}\``, { parse_mode: "Markdown" });
    }

  } else if (action === "edit_draft") {
    await ctx.answerCbQuery("✏️ Menu Sửa Nhanh");
    const editMenuText = `✏️ **MENU SỬA NHANH BÁO CÁO**\n------------------------------------\nVui lòng chọn thông tin bạn muốn chỉnh sửa bên dưới:`;
    const keyboard = buildEditMenuKeyboards(draftId);
    await safeEditOrReply(ctx, editMenuText, { parse_mode: "Markdown", reply_markup: keyboard });

  } else if (action === "edit_date") {
    setPendingEdit(ctx.from.id, draftId, "date");
    await ctx.answerCbQuery("📅 Nhập ngày mới");
    await ctx.reply(`📅 **SỬA NGÀY GHI NHẬN**\nVui lòng nhập ngày mới bên dưới (Ví dụ: \`14/08\` hoặc \`2026-08-14\`):`, { parse_mode: "Markdown" });

  } else if (action === "edit_staff_menu") {
    await ctx.answerCbQuery("👩‍🎨 Danh sách thợ");
    const staffText = `👩‍🎨 **CHỌN THỢ CẦN CHỈNH SỬA DOANH SỐ:**\nBấm vào tên thợ bên dưới để cập nhật số tiền:`;
    const keyboard = buildStaffListKeyboards(draftId, draft.result.staff_data);
    await safeEditOrReply(ctx, staffText, { parse_mode: "Markdown", reply_markup: keyboard });

  } else if (action === "edit_staff_item") {
    setPendingEdit(ctx.from.id, draftId, "staff_item", itemIndex);
    await ctx.answerCbQuery("👩‍🎨 Nhập doanh số thợ");
    const staffObj = draft.result.staff_data?.[itemIndex];
    const sName = staffObj?.name || staffObj?.staff_name || "Nhân viên";
    await ctx.reply(`👩‍🎨 **SỬA DOANH SỐ THỢ "${sName}"**\nVui lòng nhập số tiền mới (Ví dụ: \`300k\` hoặc \`Gội 200k mi 100k\`):`, { parse_mode: "Markdown" });

  } else if (action === "add_staff_item") {
    setPendingEdit(ctx.from.id, draftId, "add_staff");
    await ctx.answerCbQuery("➕ Thêm thợ mới");
    await ctx.reply(`➕ **THÊM THỢ MỚI VÀO BÁO CÁO**\nVui lòng nhập tên thợ và doanh số (Ví dụ: \`Trang móng 200k\` hoặc \`Hoa 300k\`):`, { parse_mode: "Markdown" });

  } else if (action === "edit_expense_menu") {
    await ctx.answerCbQuery("💸 Danh sách chi tiêu");
    const expText = `💸 **CHỌN KHOẢN CHI CẦN CHỈNH SỬA:**\nBấm vào mục chi bên dưới để cập nhật số tiền:`;
    const keyboard = buildExpenseListKeyboards(draftId, draft.result.expenses_data);
    await safeEditOrReply(ctx, expText, { parse_mode: "Markdown", reply_markup: keyboard });

  } else if (action === "edit_expense_item") {
    setPendingEdit(ctx.from.id, draftId, "expense_item", itemIndex);
    await ctx.answerCbQuery("💸 Nhập số tiền chi");
    const expObj = draft.result.expenses_data?.[itemIndex];
    const expNote = expObj?.notes || expObj?.category || "Khoản chi";
    await ctx.reply(`💸 **SỬA KHOẢN CHI "${expNote}"**\nVui lòng nhập số tiền mới hoặc tên khoản chi (Ví dụ: \`100k\` hoặc \`Mua chổi 120k\`):`, { parse_mode: "Markdown" });

  } else if (action === "add_expense_item") {
    setPendingEdit(ctx.from.id, draftId, "add_expense");
    await ctx.answerCbQuery("➕ Thêm khoản chi mới");
    await ctx.reply(`➕ **THÊM KHOẢN CHI MỚI**\nVui lòng nhập nội dung và số tiền (Ví dụ: \`50k mua nước đá\` hoặc \`Ăn trưa 80k\`):`, { parse_mode: "Markdown" });

  } else if (action === "copy_text_format") {
    setPendingEdit(ctx.from.id, draftId, "copy_text");
    await ctx.answerCbQuery("📋 Bán text mẫu");
    const copyText = formatCopyableText(draft.result, draft.result.report_date || new Date().toISOString().substring(0, 10));
    await ctx.reply(copyText, { parse_mode: "Markdown" });

  } else if (action === "back_to_preview") {
    await ctx.answerCbQuery("📋 Quay lại xem trước");
    const targetDateStr = draft.result.report_date || new Date().toISOString().substring(0, 10);
    const existingReportsForDate = await reportRepo.getDailyReports(targetDateStr);
    const existingCount = existingReportsForDate ? existingReportsForDate.length : 0;
    const previewMsg = formatPreviewResponse(
      draft.result,
      targetDateStr,
      draft.result.date_confidence || "medium",
      draft.result.date_reasoning || "",
      existingCount
    );
    const replyMarkup = buildPreviewKeyboards(draftId, existingCount);
    await safeEditOrReply(ctx, previewMsg, { parse_mode: "Markdown", reply_markup: replyMarkup });

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
  loadPersistedDrafts,
  persistDraftsToFile,
  scheduleDraftTimers,
  clearDraftTimers,
  setTimerDurationsForTesting,
  setPendingEdit,
  getPendingEdit,
  clearPendingEdit,
  formatPreviewResponse,
  buildPreviewKeyboards,
  buildEditMenuKeyboards,
  buildStaffListKeyboards,
  buildExpenseListKeyboards,
  formatCopyableText,
  handleCallbackQuery
};
