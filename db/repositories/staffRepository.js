const fs = require("fs");
const path = require("path");
const { supabase, isSupabaseConnected } = require("../../config/supabase");

const DATA_DIR = path.join(__dirname, "../../data");
const STAFF_FILE = path.join(DATA_DIR, "staff.json");
const DEFAULT_STAFF = ["bà chủ Tuyết Trần", "Quỳnh Anh", "Huệ", "chị Cúc"];

function ensureLocalFile() {
  if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
  if (!fs.existsSync(STAFF_FILE)) {
    fs.writeFileSync(STAFF_FILE, JSON.stringify(DEFAULT_STAFF, null, 2), "utf-8");
  }
}

async function getStaffList() {
  if (isSupabaseConnected()) {
    try {
      const { data, error } = await supabase.from("staff").select("name").eq("is_active", true);
      if (!error && data && data.length > 0) {
        return data.map(item => item.name);
      }
    } catch (err) {
      console.error("Lỗi lấy danh sách nhân viên từ Supabase:", err);
    }
  }

  // Local fallback
  ensureLocalFile();
  try {
    return JSON.parse(fs.readFileSync(STAFF_FILE, "utf-8"));
  } catch (e) {
    return DEFAULT_STAFF;
  }
}

async function saveStaffList(staffArray) {
  const cleanList = Array.from(new Set(staffArray.map(s => s.trim()).filter(Boolean)));

  if (isSupabaseConnected()) {
    try {
      // Soft delete/deactivate existing staff
      await supabase.from("staff").update({ is_active: false }).neq("id", 0);

      // Upsert new list
      const rows = cleanList.map(name => ({ name, is_active: true }));
      await supabase.from("staff").upsert(rows, { onConflict: "name" });
    } catch (err) {
      console.error("Lỗi lưu nhân viên vào Supabase:", err);
    }
  }

  // Local fallback
  ensureLocalFile();
  fs.writeFileSync(STAFF_FILE, JSON.stringify(cleanList, null, 2), "utf-8");
  return cleanList;
}

async function addStaff(names) {
  const current = await getStaffList();
  const newNames = Array.isArray(names) ? names : [names];
  newNames.forEach(n => {
    if (n && !current.includes(n.trim())) {
      current.push(n.trim());
    }
  });
  return await saveStaffList(current);
}

async function removeStaff(name) {
  const current = await getStaffList();
  const updated = current.filter(s => s.toLowerCase() !== name.trim().toLowerCase());
  return await saveStaffList(updated);
}

module.exports = {
  getStaffList,
  saveStaffList,
  addStaff,
  removeStaff
};
