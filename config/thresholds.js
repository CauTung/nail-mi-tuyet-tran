/**
 * Configuration for Warning & Alert Thresholds in Financial Reporting System
 */

module.exports = {
  WARNING_THRESHOLDS: {
    // Ngưỡng doanh số 1 thợ trong ngày >= 1 triệuđ
    STAFF_DAILY_TOTAL: 1000000,
    // Ngưỡng 1 mục dịch vụ lẻ của thợ >= 350kđ
    STAFF_SINGLE_ITEM: 350000,
    // Ngưỡng tổng doanh số cả tiệm trong ngày >= 15 triệuđ
    DAILY_GRAND_TOTAL: 15000000,
    // Ngưỡng 1 khoản chi tiêu đơn lẻ >= 2 triệuđ
    SINGLE_EXPENSE: 2000000
  }
};
