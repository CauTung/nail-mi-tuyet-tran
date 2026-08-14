/**
 * Helper utilities for Telegraf Telegram Context interactions
 */

/**
 * An toàn thử edit message text trước, nếu không sửa được (message quá cũ / đổi type), tự động reply tin nhắn mới.
 */
async function safeEditOrReply(ctx, text, extra = { parse_mode: "Markdown" }) {
  try {
    return await ctx.editMessageText(text, extra);
  } catch (e) {
    return await ctx.reply(text, extra);
  }
}

/**
 * Phản hồi callback query an toàn mà không sợ ném exception nếu callback đã hết hạn
 */
async function safeAnswerCbQuery(ctx, text, showAlert = false) {
  try {
    return await ctx.answerCbQuery(text, { show_alert: showAlert });
  } catch (e) {
    // Ignore callback query answer timeout
  }
}

module.exports = {
  safeEditOrReply,
  safeAnswerCbQuery
};
