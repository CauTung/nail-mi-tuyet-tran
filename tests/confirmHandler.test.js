const test = require("node:test");
const assert = require("node:assert");
const confirmHandler = require("../bot/handlers/confirmHandler");

test("Draft Management - save, get, delete draft", () => {
  const sampleResult = { status: "success", report_date: "2026-08-14" };
  const metaInfo = { userInfo: { id: 123 }, inputType: "text" };

  const draftId = confirmHandler.saveDraft(sampleResult, metaInfo);
  assert.ok(draftId.startsWith("DRAFT_"));

  const retrieved = confirmHandler.getDraft(draftId);
  assert.strictEqual(retrieved.result.report_date, "2026-08-14");
  assert.strictEqual(retrieved.metaInfo.userInfo.id, 123);

  confirmHandler.deleteDraft(draftId);
  assert.strictEqual(confirmHandler.getDraft(draftId), undefined);
});

test("Pending Edit State Management - set, get, clear pending edit", () => {
  const userId = 88888;
  const draftId = "DRAFT_TEST_888";

  confirmHandler.setPendingEdit(userId, draftId, "staff_item", 2);
  const pending = confirmHandler.getPendingEdit(userId);

  assert.ok(pending);
  assert.strictEqual(pending.draftId, draftId);
  assert.strictEqual(pending.editType, "staff_item");
  assert.strictEqual(pending.itemIndex, 2);

  confirmHandler.clearPendingEdit(userId);
  assert.strictEqual(confirmHandler.getPendingEdit(userId), null);
});

test("Preview Formatting & Anomaly Warnings", () => {
  const reportData = {
    staff_data: [
      { name: "Quỳnh Anh", goi_mong: 6000000, is_unknown_staff: true }
    ],
    expenses_data: [
      { notes: "Mua máy uốn", amount: 3000000 }
    ]
  };

  const previewMsg = confirmHandler.formatPreviewResponse(reportData, "2026-08-14", "low", "AI không tìm thấy ngày");

  assert.match(previewMsg, /BÁO CÁO THU CHI/);
  assert.match(previewMsg, /Quỳnh Anh/);
  assert.match(previewMsg, /Tên mới/);
  assert.match(previewMsg, /Doanh số thợ.*cao bất thường/);
  assert.match(previewMsg, /Khoản chi.*lớn bất thường/);
});

test("Keyboard Builders", () => {
  const draftId = "DRAFT_TEST_KEYBOARD";
  const staffData = [
    { name: "Hoa", goi_mong: 200000 },
    { name: "Lan", mi: 300000 }
  ];
  const expensesData = [
    { notes: "Trà sữa", amount: 50000 }
  ];

  const editMenu = confirmHandler.buildEditMenuKeyboards(draftId);
  assert.strictEqual(editMenu.inline_keyboard[0][0].callback_data, `edit_date:${draftId}`);
  assert.strictEqual(editMenu.inline_keyboard[2][0].callback_data, `copy_text_format:${draftId}`);

  const staffMenu = confirmHandler.buildStaffListKeyboards(draftId, staffData);
  assert.strictEqual(staffMenu.inline_keyboard[0][0].callback_data, `edit_staff_item:${draftId}:0`);
  assert.strictEqual(staffMenu.inline_keyboard[1][0].callback_data, `edit_staff_item:${draftId}:1`);
  assert.strictEqual(staffMenu.inline_keyboard[2][0].callback_data, `add_staff_item:${draftId}`);

  const expMenu = confirmHandler.buildExpenseListKeyboards(draftId, expensesData);
  assert.strictEqual(expMenu.inline_keyboard[0][0].callback_data, `edit_expense_item:${draftId}:0`);
  assert.strictEqual(expMenu.inline_keyboard[1][0].callback_data, `add_expense_item:${draftId}`);
});

test("Format Copyable Text", () => {
  const reportData = {
    staff_data: [{ name: "Trang", goi_mong: 200000, mi: 150000 }],
    expenses_data: [{ notes: "Đá lạnh", amount: 30000 }]
  };

  const copyText = confirmHandler.formatCopyableText(reportData, "2026-08-14");
  assert.match(copyText, /Trang/);
  assert.match(copyText, /Gội\/Móng 200\.000đ/);
  assert.match(copyText, /Đá lạnh: 30\.000đ/);
});

test("Draft Timers - Reminder & Auto Confirm Flow", async () => {
  confirmHandler.setTimerDurationsForTesting(50, 150);

  let sentMessages = [];
  const fakeTelegram = {
    sendMessage: async (chatId, text) => {
      sentMessages.push({ chatId, text });
    }
  };

  const sampleResult = { status: "success", report_date: "2026-09-02", staff_data: [] };
  const draftId = confirmHandler.saveDraft(sampleResult, { inputType: "text" }, { telegram: fakeTelegram, chatId: 12345 });

  // Wait 80ms for reminder to trigger
  await new Promise(r => setTimeout(r, 80));
  assert.strictEqual(sentMessages.length, 1);
  assert.match(sentMessages[0].text, /NHẮC NHỞ CHỐT BÁO CÁO/);

  // Wait 100ms more for auto confirm to trigger
  await new Promise(r => setTimeout(r, 100));
  assert.strictEqual(sentMessages.length, 2);
  assert.match(sentMessages[1].text, /TỰ ĐỘNG CHỐT LƯU BÁO CÁO/);

  // Draft should be cleaned up after auto-save
  assert.strictEqual(confirmHandler.getDraft(draftId), undefined);
});
