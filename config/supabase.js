const { createClient } = require("@supabase/supabase-js");
const env = require("./env");

let supabase = null;

if (env.supabaseUrl && env.supabaseKey) {
  supabase = createClient(env.supabaseUrl, env.supabaseKey);
  const keyLen = env.supabaseKey.length;
  console.log(`⚡ [SUPABASE] Đã khởi tạo Supabase Client (Target: ${env.supabaseUrl}, Key length: ${keyLen} chars)`);

  // Thực hiện test ping thực tế qua HTTP
  supabase.from("staff").select("id", { count: "exact", head: true })
    .then(({ error }) => {
      if (error) {
        console.warn(`⚠️ [SUPABASE PING FAILED] Không thể truy vấn tới '${env.supabaseUrl}'. Chi tiết: ${error.message}`);
        if (error.message.includes("fetch failed")) {
          console.warn(`💡 [GỢI Ý] Lỗi 'fetch failed' xảy ra khi API Key chưa đúng hoặc kết nối HTTPS từ Render bị chặn. Hãy kiểm tra SUPABASE_KEY (anon key).`);
        }
      } else {
        console.log("✅ [SUPABASE PING SUCCESS] Kết nối mạng và truy vấn CSDL Supabase hoàn toàn bình thường!");
      }
    })
    .catch(err => {
      console.error(`❌ [SUPABASE NETWORK ERROR] Lỗi kết nối mạng tới '${env.supabaseUrl}': ${err.message}`);
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
