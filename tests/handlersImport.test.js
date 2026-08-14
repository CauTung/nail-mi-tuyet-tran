const test = require("node:test");
const assert = require("node:assert");

test("Verify all Handler files import successfully without undefined dependencies", () => {
  const ocrHandler = require("../bot/handlers/ocrHandler");
  const queryHandler = require("../bot/handlers/queryHandler");
  const adminHandler = require("../bot/handlers/adminHandler");
  const confirmHandler = require("../bot/handlers/confirmHandler");

  assert.strictEqual(typeof ocrHandler.handleOcrMessage, "function");
  assert.strictEqual(typeof queryHandler.handleMonth, "function");
  assert.strictEqual(typeof queryHandler.handleToday, "function");
  assert.strictEqual(typeof adminHandler.handleSetAdmin, "function");
  assert.strictEqual(typeof confirmHandler.handleCallbackQuery, "function");
});

test("Verify createBotApp initializes cleanly", () => {
  process.env.TELEGRAM_BOT_TOKEN = "123456789:TestDummyTokenForUnitTestingOnly";
  delete require.cache[require.resolve("../config/env")];
  delete require.cache[require.resolve("../bot/botApp")];
  const { createBotApp } = require("../bot/botApp");
  const bot = createBotApp();
  assert.ok(bot, "Bot instance should be created");
});
