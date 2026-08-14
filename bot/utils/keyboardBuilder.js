/**
 * Helper module for building Telegram Inline Keyboards
 */

const { getStaffTotalRevenue } = require("../../services/revenueService");
const { formatMoney } = require("../../utils/formatter");

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

function buildEditMenuKeyboards(draftId) {
  return {
    inline_keyboard: [
      [
        { text: "📅 Sửa Ngày Ghi Nhận", callback_data: `edit_date:${draftId}` }
      ],
      [
        { text: "👩‍🎨 Sửa Doanh Số Thợ", callback_data: `edit_staff_menu:${draftId}` },
        { text: "💸 Sửa Chi Tiêu", callback_data: `edit_expense_menu:${draftId}` }
      ],
      [
        { text: "📋 Copy Text Để Sửa", callback_data: `copy_text_format:${draftId}` }
      ],
      [
        { text: "🔙 Quay Lại Xem Trước", callback_data: `back_to_preview:${draftId}` }
      ]
    ]
  };
}

function buildStaffListKeyboards(draftId, staffData = []) {
  const keyboard = [];
  if (Array.isArray(staffData) && staffData.length > 0) {
    staffData.forEach((s, idx) => {
      const total = getStaffTotalRevenue(s);
      const staffName = s.name || s.staff_name || `Thợ ${idx + 1}`;
      keyboard.push([
        { text: `👩‍🎨 ${staffName}: ${formatMoney(total)}`, callback_data: `edit_staff_item:${draftId}:${idx}` }
      ]);
    });
  }
  keyboard.push([
    { text: "➕ Thêm Thợ Mới", callback_data: `add_staff_item:${draftId}` }
  ]);
  keyboard.push([
    { text: "🔙 Quay Lại Menu Sửa", callback_data: `edit_draft:${draftId}` }
  ]);
  return { inline_keyboard: keyboard };
}

function buildExpenseListKeyboards(draftId, expensesData = []) {
  const keyboard = [];
  if (Array.isArray(expensesData) && expensesData.length > 0) {
    expensesData.forEach((exp, idx) => {
      const amt = exp.amount || 0;
      const notes = exp.notes || exp.category || `Chi tiêu ${idx + 1}`;
      keyboard.push([
        { text: `💸 ${notes}: ${formatMoney(amt)}`, callback_data: `edit_expense_item:${draftId}:${idx}` }
      ]);
    });
  }
  keyboard.push([
    { text: "➕ Thêm Khoản Chi Mới", callback_data: `add_expense_item:${draftId}` }
  ]);
  keyboard.push([
    { text: "🔙 Quay Lại Menu Sửa", callback_data: `edit_draft:${draftId}` }
  ]);
  return { inline_keyboard: keyboard };
}

module.exports = {
  buildPreviewKeyboards,
  buildEditMenuKeyboards,
  buildStaffListKeyboards,
  buildExpenseListKeyboards
};
