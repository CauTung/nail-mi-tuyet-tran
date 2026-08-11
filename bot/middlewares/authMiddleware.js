const adminRepo = require("../../db/repositories/adminRepository");

async function adminOnlyMiddleware(ctx, next) {
  const userId = ctx.from?.id;
  const isAdmin = await adminRepo.isAdminUser(userId);

  if (!isAdmin) {
    return ctx.reply("❌ **Rất tiếc!** Tính năng này chỉ dành riêng cho Admin (Chủ tiệm).", {
      parse_mode: "Markdown"
    });
  }

  return next();
}

module.exports = {
  adminOnlyMiddleware
};
