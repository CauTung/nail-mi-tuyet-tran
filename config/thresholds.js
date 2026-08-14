/**
 * Configuration for Warning & Alert Thresholds in Financial Reporting System
 */

module.exports = {
  WARNING_THRESHOLDS: {
    // Ngưỡng doanh số tổng 1 thợ trong 1 ngày >= 1 triệuđ
    STAFF_DAILY_TOTAL: 1000000,
    // Ngưỡng 1 DÒNG / 1 LƯỢT LÀM ĐƠN LẺ của thợ >= 350kđ (Ví dụ: 1 bộ móng đính đá 400k)
    STAFF_SINGLE_ENTRY: 350000,
    // Ngưỡng tổng doanh số cả tiệm trong ngày >= 15 triệuđ
    DAILY_GRAND_TOTAL: 15000000,
    // Ngưỡng 1 khoản chi tiêu đơn lẻ >= 2 triệuđ
    SINGLE_EXPENSE: 2000000
  }
};
