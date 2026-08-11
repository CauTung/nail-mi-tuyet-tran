const fs = require("fs");
const path = require("path");
const env = require("../../config/env");
const { supabase, isSupabaseConnected } = require("../../config/supabase");

const DATA_DIR = path.join(__dirname, "../../data");
const ADMINS_FILE = path.join(DATA_DIR, "admins.json");

function ensureLocalFile() {
  if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
  if (!fs.existsSync(ADMINS_FILE)) {
    fs.writeFileSync(ADMINS_FILE, JSON.stringify(env.adminUserIds, null, 2), "utf-8");
  }
}

async function getAdminList() {
  let dbAdmins = [];

  if (isSupabaseConnected()) {
    try {
      const { data, error } = await supabase.from("admins").select("telegram_id");
      if (!error && data) {
        dbAdmins = data.map(item => String(item.telegram_id));
      }
    } catch (err) {
      console.error("Lỗi lấy danh sách admin từ Supabase:", err);
    }
  }

  if (dbAdmins.length === 0) {
    ensureLocalFile();
    try {
      dbAdmins = JSON.parse(fs.readFileSync(ADMINS_FILE, "utf-8"));
    } catch (e) {
      dbAdmins = [];
    }
  }

  const combined = Array.from(new Set([...dbAdmins, ...env.adminUserIds]));
  return combined;
}

async function isAdminUser(userId) {
  if (!userId) return false;
  const admins = await getAdminList();
  if (admins.length === 0) return true; // Nếu chưa có Admin nào thì cấp quyền đăng ký
  return admins.includes(String(userId));
}

async function addAdminUser(userId) {
  const strId = String(userId);

  if (isSupabaseConnected()) {
    try {
      await supabase.from("admins").upsert({ telegram_id: strId }, { onConflict: "telegram_id" });
    } catch (err) {
      console.error("Lỗi thêm admin vào Supabase:", err);
    }
  }

  ensureLocalFile();
  const current = await getAdminList();
  if (!current.includes(strId)) {
    current.push(strId);
    fs.writeFileSync(ADMINS_FILE, JSON.stringify(current, null, 2), "utf-8");
  }
  return current;
}

module.exports = {
  getAdminList,
  isAdminUser,
  addAdminUser
};
