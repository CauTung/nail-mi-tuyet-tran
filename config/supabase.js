const { createClient } = require("@supabase/supabase-js");
const env = require("./env");

let supabase = null;

if (env.supabaseUrl && env.supabaseKey) {
  supabase = createClient(env.supabaseUrl, env.supabaseKey, {
    auth: { persistSession: false }
  });
  const keyLen = env.supabaseKey.length;
  console.log(`⚡ [SUPABASE] Đã khởi tạo Supabase Client (Target: ${env.supabaseUrl}, Key length: ${keyLen} chars)`);

  // Thực hiện test ping bằng raw fetch để bắt chi tiết err.cause
  fetch(`${env.supabaseUrl}/rest/v1/staff?select=id&limit=1`, {
    method: "GET",
    headers: {
      "apikey": env.supabaseKey,
      "Authorization": `Bearer ${env.supabaseKey}`
    }
  })
    .then(res => {
      if (res.ok) {
        console.log(`✅ [SUPABASE PING SUCCESS] Kết nối mạng CSDL Supabase hoàn toàn bình thường (HTTP ${res.status})!`);
      } else {
        console.warn(`⚠️ [SUPABASE PING WARN] Supabase trả về HTTP ${res.status}: ${res.statusText}`);
      }
    })
    .catch(err => {
      const causeMsg = err.cause ? (err.cause.message || JSON.stringify(err.cause)) : "Unknown cause";
      console.error(`❌ [SUPABASE NETWORK ERROR] Lỗi kết nối tới ${env.supabaseUrl}: ${err.message} | Nguyên nhân sâu: ${causeMsg}`);
    });
} else {
  console.warn("⚠️ [SUPABASE] Chưa cấu hình SUPABASE_URL hoặc SUPABASE_KEY trong file .env!");
}

/**
 * Lấy instance Supabase client hiện tại
 */
function getSupabaseClient() {
  return supabase;
}

/**
 * Kiểm tra xem Supabase đã được kết nối hay chưa
 */
function isSupabaseConnected() {
  return Boolean(supabase);
}

module.exports = {
  supabase,
  getSupabaseClient,
  isSupabaseConnected
};
