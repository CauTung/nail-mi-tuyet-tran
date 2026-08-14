const staffRepo = require("../../db/repositories/staffRepository");
const configRepo = require("../../db/repositories/configRepository");
const reportRepo = require("../../db/repositories/reportRepository");
const installmentRepo = require("../../db/repositories/installmentRepository");
const adminRepo = require("../../db/repositories/adminRepository");

async function handleSetAdmin(ctx) {
  const userId = ctx.from.id;
  const currentAdmins = await adminRepo.getAdminList();

  if (currentAdmins.length === 0) {
    await adminRepo.addAdminUser(userId);
    return ctx.reply(`🎉 **Chúc mừng!** Bạn (ID: \`${userId}\`) đã trở thành Admin đầu tiên của tiệm!`, { parse_mode: "Markdown" });
  }

  const isAdmin = await adminRepo.isAdminUser(userId);
  if (isAdmin) {
    return ctx.reply(`👑 Bạn đã là Admin của hệ thống rồi (ID: \`${userId}\`).`, { parse_mode: "Markdown" });
  }

  return ctx.reply("❌ Hệ thống đã có Admin. Bạn cần xin phép Admin hiện tại cấp quyền!", { parse_mode: "Markdown" });
}

async function handleStaff(ctx) {
  const staffList = await staffRepo.getStaffList();
  let msg = `👩‍🎨 **DANH SÁCH NHÂN VIÊN CHUẨN HIỆN TẠI:**\n\n`;
  staffList.forEach((name, i) => {
    msg += `${i + 1}. **${name}**\n`;
  });
  return ctx.reply(msg, { parse_mode: "Markdown" });
}

async function handleAddStaff(ctx) {
  const text = ctx.message.text.trim();
  const parts = text.split(" ").slice(1);
  const rawNames = parts.join(" ");

  if (!rawNames) {
    return ctx.reply("⚠️ Cú pháp: `/addstaff Tên1, Tên2` (Ví dụ: `/addstaff Hoa, Trang`)", { parse_mode: "Markdown" });
  }

  const newNames = rawNames.split(",").map(s => s.trim()).filter(Boolean);
  const updated = await staffRepo.addStaff(newNames);

  return ctx.reply(`✅ **Đã thêm nhân viên mới thành công!**\nDanh sách hiện tại: ${updated.map(n => `\`${n}\``).join(", ")}`, { parse_mode: "Markdown" });
}

async function handleRemoveStaff(ctx) {
  const text = ctx.message.text.trim();
  const name = text.split(" ").slice(1).join(" ").trim();

  if (!name) {
    return ctx.reply("⚠️ Cú pháp: `/removestaff Tên_Nhân_Viên`", { parse_mode: "Markdown" });
  }

  const updated = await staffRepo.removeStaff(name);
  return ctx.reply(`✅ **Đã xóa nhân viên "${name}" khỏi danh sách đối chiếu.**\nDanh sách hiện tại: ${updated.map(n => `\`${n}\``).join(", ")}`, { parse_mode: "Markdown" });
}

async function handleSetStaff(ctx) {
  const text = ctx.message.text.trim();
  const rawNames = text.split(" ").slice(1).join(" ");

  if (!rawNames) {
    return ctx.reply("⚠️ Cú pháp: `/setstaff Tên1, Tên2, Tên3`", { parse_mode: "Markdown" });
  }

  const newNames = rawNames.split(",").map(s => s.trim()).filter(Boolean);
  const updated = await staffRepo.saveStaffList(newNames);

  return ctx.reply(`✅ **Đã cập nhật toàn bộ danh sách nhân viên chuẩn!**\nDanh sách: ${updated.map(n => `\`${n}\``).join(", ")}`, { parse_mode: "Markdown" });
}

async function handleCategories(ctx) {
  const config = await configRepo.getCommissionConfig();
  const categories = config.categories || [];

  let msg = `🏷️ **DANH SÁCH DANH MỤC DỊCH VỤ & HOA HỒNG:**\n\n`;
  categories.forEach((cat, idx) => {
    msg += `${idx + 1}. **${cat.label}** (Mã: \`${cat.key}\`) ➔ Hoa hồng: **${cat.percent}%**\n`;
  });

  msg += `\n💡 **Lệnh Admin quản lý:**\n`;
  msg += `• \`/addcategory <key> "<Tên hiển thị>" <%_hoa_hồng>\`\n`;
  msg += `• \`/setcommission <key> <%_mới>\`\n`;
  msg += `• \`/delcategory <key>\`\n`;

  return ctx.reply(msg, { parse_mode: "Markdown" });
}

async function handleAddCategory(ctx) {
  const text = ctx.message.text.trim();
  const match = text.match(/^\/addcategory\s+(\S+)\s+"([^"]+)"\s+(\d+)$/) ||
                text.match(/^\/addcategory\s+(\S+)\s+(\S+)\s+(\d+)$/);

  if (!match) {
    return ctx.reply('⚠️ Cú pháp: `/addcategory <key> "<Tên hiển thị>" <%_hoa_hồng>`\nVí dụ: `/addcategory san_pham "Bán sản phẩm" 15`', { parse_mode: "Markdown" });
  }

  const [, key, label, rawPercent] = match;
  const percent = Number(rawPercent);

  const updated = await configRepo.addCategory(key, label, percent);
  return ctx.reply(`✅ **Đã thêm/cập nhật danh mục dịch vụ!**\n🏷️ Tên: **${label}** (\`${key}\`)\n💰 Hoa hồng: **${percent}%**`, { parse_mode: "Markdown" });
}

async function handleDelCategory(ctx) {
  const parts = ctx.message.text.trim().split(" ");
  if (parts.length < 2) {
    return ctx.reply("⚠️ Cú pháp: `/delcategory <key>` (Ví dụ: `/delcategory san_pham`)", { parse_mode: "Markdown" });
  }

  const key = parts[1].trim();
  await configRepo.removeCategory(key);
  return ctx.reply(`✅ **Đã xóa danh mục dịch vụ \`${key}\` khỏi hệ thống!**`, { parse_mode: "Markdown" });
}

async function handleSetCommission(ctx) {
  const parts = ctx.message.text.trim().split(" ");
  if (parts.length === 3) {
    const key = parts[1];
    const percent = Number(parts[2]);
    if (isNaN(percent)) {
      return ctx.reply("❌ Tỷ lệ % phải là số hợp lệ!", { parse_mode: "Markdown" });
    }
    try {
      await configRepo.setCategoryPercent(key, percent);
      return ctx.reply(`✅ **Đã cập nhật tỷ lệ hoa hồng cho \`${key}\` thành ${percent}%!**`, { parse_mode: "Markdown" });
    } catch (err) {
      return ctx.reply(`❌ ${err.message}`, { parse_mode: "Markdown" });
    }
  }

  if (parts.length >= 4) {
    const gm = parseInt(parts[1], 10);
    const mi = parseInt(parts[2], 10);
    const ng = parseInt(parts[3], 10);

    if (isNaN(gm) || isNaN(mi) || isNaN(ng)) {
      return ctx.reply("❌ Tỷ lệ % phải là số nguyên hợp lệ!", { parse_mode: "Markdown" });
    }

    const updated = await configRepo.saveCommissionConfig({
      goi_mong_percent: gm,
      mi_percent: mi,
      ngoai_gio_percent: ng
    });

    return ctx.reply(`✅ **Đã cập nhật tỷ lệ % hoa hồng doanh thu:**\n• Gội/Móng: **${updated.goi_mong_percent}%**\n• Mi/Phun xăm: **${updated.mi_percent}%**\n• Ngoài giờ/Tăng ca: **${updated.ngoai_gio_percent}%**`, { parse_mode: "Markdown" });
  }

  return ctx.reply("⚠️ Cú pháp:\n• `/setcommission <key> <%_mới>` (Ví dụ: `/setcommission mi 35`)\n• `/setcommission <goimong%> <mi%> <ngoaigio%>` (Ví dụ: `/setcommission 10 30 50`)", { parse_mode: "Markdown" });
}

async function handleEditRevenue(ctx) {
  const text = ctx.message.text.trim();
  const match = text.match(/^\/editrevenue\s+(\S+)\s+"([^"]+)"\s+(\S+)\s+(\S+)\s+(\S+)$/) ||
                text.match(/^\/editrevenue\s+(\S+)\s+(\S+)\s+(\S+)\s+(\S+)\s+(\S+)$/);

  if (!match) {
    return ctx.reply('⚠️ Cú pháp: `/editrevenue <REP_ID> "Tên NV" <GộiMóng> <Mi> <NgoàiGiờ>`\nVí dụ: `/editrevenue REP_12345 "Quỳnh Anh" 300k 400k 0`', { parse_mode: "Markdown" });
  }

  const [, repId, staffName, rawGM, rawMi, rawNG] = match;

  const parseVal = (str) => {
    if (!str || str === "0") return 0;
    let s = str.toLowerCase().replace(/k/g, "000").replace(/tr/g, "000000");
    return parseInt(s, 10) || 0;
  };

  const updated = await reportRepo.updateStaffRevenue(repId, staffName, parseVal(rawGM), parseVal(rawMi), parseVal(rawNG));

  if (!updated) {
    return ctx.reply(`❌ Không tìm thấy mã báo cáo \`${repId}\` để chỉnh sửa!`, { parse_mode: "Markdown" });
  }

  return ctx.reply(`✅ **Đã chỉnh sửa doanh số nhân viên thành công!**\n🆔 Mã ID: \`${repId}\`\n👤 Thợ: **${staffName}**`, { parse_mode: "Markdown" });
}

async function handleEditExpense(ctx) {
  const parts = ctx.message.text.trim().split(" ");
  if (parts.length < 3) {
    return ctx.reply("⚠️ Cú pháp: `/editexpense <REP_ID> <Số_tiền> <Ghi_chú>`\nVí dụ: `/editexpense REP_12345 60k Mua nước đá`", { parse_mode: "Markdown" });
  }

  const repId = parts[1];
  const rawAmt = parts[2];
  const notes = parts.slice(3).join(" ") || "Chi tiêu điều chỉnh";

  let amount = parseInt(rawAmt.toLowerCase().replace(/k/g, "000").replace(/tr/g, "000000"), 10) || 0;

  const updated = await reportRepo.updateExpense(repId, amount, notes);
  if (!updated) {
    return ctx.reply(`❌ Không tìm thấy mã báo cáo \`${repId}\` để sửa chi tiêu!`, { parse_mode: "Markdown" });
  }

  return ctx.reply(`✅ **Đã sửa khoản chi tiêu thành công!**\n🆔 Mã ID: \`${repId}\`\n💸 Số tiền mới: **${amount.toLocaleString("vi-VN")}đ** (${notes})`, { parse_mode: "Markdown" });
}

async function handleDeleteReport(ctx) {
  const parts = ctx.message.text.trim().split(" ");
  if (parts.length < 2) {
    return ctx.reply("⚠️ Cú pháp: `/deletereport <REP_ID>` (Ví dụ: `/deletereport REP_12345`)", { parse_mode: "Markdown" });
  }

  const repId = parts[1];
  const deleted = await reportRepo.deleteReport(repId);

  if (!deleted) {
    return ctx.reply(`❌ Không tìm thấy lượt báo cáo với mã \`${repId}\`!`, { parse_mode: "Markdown" });
  }

  return ctx.reply(`🗑️ **Đã xóa hoàn toàn báo cáo \`${repId}\` khỏi hệ thống!**`, { parse_mode: "Markdown" });
}

async function handleDeleteRagop(ctx) {
  const parts = ctx.message.text.trim().split(" ");
  if (parts.length < 2) {
    return ctx.reply("⚠️ Cú pháp: `/deleteragop <INS_ID>` (Ví dụ: `/deleteragop INS_12345`)", { parse_mode: "Markdown" });
  }

  const insId = parts[1];
  const deleted = await installmentRepo.deleteInstallment(insId);

  if (!deleted) {
    return ctx.reply(`❌ Không tìm thấy hợp đồng trả góp với mã \`${insId}\`!`, { parse_mode: "Markdown" });
  }

  return ctx.reply(`🗑️ **Đã xóa hợp đồng trả góp \`${insId}\` thành công!**`, { parse_mode: "Markdown" });
}

async function handleMau(ctx) {
  let msg = `📝 **CÁC MẪU BÁO CÁO CHUẨN ĐỂ AI ĐỌC CHÍNH XÁC 100%**\n\n`;
  msg += `📖 **1. CÁCH GHI SỔ TAY (Chụp ảnh gửi Bot):**\n`;
  msg += `• **Kẻ cột đứng:** Viết tên thợ ở đầu cột (\`Huệ\`, \`Cúc\`, \`QA\` / \`Quỳnh Anh\`, \`Thảo\`, \`Nhi\`).\n`;
  msg += `• **Gội/Móng (10%):** Viết số ở phần bảng trên cùng (\`50\`, \`100\`, \`250\` - AI tự nhân k).\n`;
  msg += `• **Mi/Phun xăm (30%):** Viết tiêu đề \`30%\` rồi ghi con số dưới cột thợ tương ứng.\n`;
  msg += `• **Ngoài giờ (50%):** Viết tiêu đề \`50%\` rồi ghi số tiền dưới cột thợ.\n\n`;

  msg += `📱 **2. NHẮN TIN TRỰC TIẾP (Không cần chụp ảnh):**\n`;
  msg += `\`Huệ gội 150k, mi 200k\`\n`;
  msg += `\`QA 250k móng, 300k mi\`\n`;
  msg += `\`Cúc gội móng 100k, nghỉ nửa ngày (làm 1/2)\`\n\n`;

  msg += `💸 **3. CHI TIÊU & MUA TRẢ GÓP:**\n`;
  msg += `\`Chi nước đá 20k, ship 30k\`\n`;
  msg += `\`Mua máy mi 12tr trả góp 6 tháng\`\n`;

  return ctx.reply(msg, { parse_mode: "Markdown" });
}

async function handleMigrate(ctx) {
  const { supabase, isSupabaseConnected } = require("../../config/supabase");
  const fs = require("fs");
  const path = require("path");

  if (!isSupabaseConnected()) {
    return ctx.reply("❌ Chưa kết nối CSDL Supabase! Kiểm tra lại SUPABASE_KEY trong .env", { parse_mode: "Markdown" });
  }

  const DATA_DIR = path.join(__dirname, "../../data");
  const REPORTS_DIR = path.join(DATA_DIR, "reports");

  if (!fs.existsSync(REPORTS_DIR)) {
    return ctx.reply("ℹ️ Không tìm thấy thư mục báo cáo local nào để đồng bộ.", { parse_mode: "Markdown" });
  }

  const statusMsg = await ctx.reply("⏳ *Bot đang bắt đầu đồng bộ toàn bộ file JSON báo cáo local trên Render lên Supabase Database...*", { parse_mode: "Markdown" });

  try {
    let reportCount = 0;
    const months = fs.readdirSync(REPORTS_DIR);

    for (const ym of months) {
      const monthPath = path.join(REPORTS_DIR, ym);
      if (fs.statSync(monthPath).isDirectory()) {
        const files = fs.readdirSync(monthPath).filter(f => f.endsWith(".json"));
        for (const file of files) {
          const filePath = path.join(monthPath, file);
          try {
            const reports = JSON.parse(fs.readFileSync(filePath, "utf-8"));
            for (const r of reports) {
              reportCount++;
              const dateStr = r.date || file.replace(".json", "");

              await supabase.from("reports").upsert({
                id: r.id,
                report_date: dateStr,
                user_info: r.user_info || null,
                input_type: r.input_type || "text",
                raw_data: r.parsed_result || null,
                created_at: r.timestamp || new Date().toISOString(),
                status: "active"
              }, { onConflict: "id" });

              const parsed = r.parsed_result || {};

              if (Array.isArray(parsed.staff_data)) {
                for (const s of parsed.staff_data) {
                  await supabase.from("report_staff_revenue").insert({
                    report_id: r.id,
                    report_date: dateStr,
                    staff_name: s.name,
                    is_unknown_staff: s.is_unknown_staff || false,
                    attendance_description: s.attendance_description || "Làm cả ngày",
                    attendance_score: s.attendance_score !== undefined ? s.attendance_score : 1.0,
                    late_minutes: Number(s.late_minutes) || 0,
                    goi_mong: s.revenue?.goi_mong || 0,
                    mi: s.revenue?.mi || 0,
                    ngoai_gio: s.revenue?.ngoai_gio || 0
                  }).catch(() => {});
                }
              }

              if (Array.isArray(parsed.expenses_data)) {
                for (const exp of parsed.expenses_data) {
                  await supabase.from("report_expenses").insert({
                    report_id: r.id,
                    report_date: dateStr,
                    category: exp.category || "Chi phí",
                    amount: exp.amount || 0,
                    notes: exp.notes || ""
                  }).catch(() => {});
                }
              }
            }
          } catch (e) {}
        }
      }
    }

    try { await ctx.telegram.deleteMessage(ctx.chat.id, statusMsg.message_id); } catch(e){}
    return ctx.reply(`🎉 **ĐÃ ĐỒNG BỘ THÀNH CÔNG ${reportCount} LƯỢT BÁO CÁO TỪ JSON LÊN SUPABASE DATABASE!**\nBây giờ bạn mở Supabase ra xem sẽ thấy đầy đủ dữ liệu!`, { parse_mode: "Markdown" });
  } catch (err) {
    try { await ctx.telegram.deleteMessage(ctx.chat.id, statusMsg.message_id); } catch(e){}
    return ctx.reply(`❌ **Đồng bộ thất bại:** ${err.message}`, { parse_mode: "Markdown" });
  }
}

module.exports = {
  handleSetAdmin,
  handleStaff,
  handleAddStaff,
  handleRemoveStaff,
  handleSetStaff,
  handleCategories,
  handleAddCategory,
  handleDelCategory,
  handleSetCommission,
  handleEditRevenue,
  handleEditExpense,
  handleDeleteReport,
  handleDeleteRagop,
  handleMau,
  handleMigrate
};
