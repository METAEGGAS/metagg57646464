/**
 * ====================================================
 * index.js - نقطة الدخول الرئيسية
 * ====================================================
 * يُصدِّر:
 *   - api      : جميع نقاط الـ API
 *   - wsManager: مدير WebSocket
 *   - setSession / getSession : إدارة الجلسة
 */

const api       = require('./api');
const { wsManager } = require('./socket');

module.exports = {
  ...api,
  wsManager,
};
