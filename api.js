/**
 * ====================================================
 * api.js - جميع نقاط الـ API
 * مستخرجة من full_code.js
 * ====================================================
 *
 * الخادم: https://api.excorx.info
 *
 * كيفية الاستخدام:
 *   const api = require('./api');
 *   const res = await api.auth.login({ email: '...', password: '...' });
 */

const { request, setSession, getSession } = require('./http');

// ─────────────────────────────────────────────────────
// Helper: طلب POST بسيط
// ─────────────────────────────────────────────────────
function post(url, data = {}) {
  return request({ url, method: 'POST', data });
}

function get(url, data = {}) {
  return request({ url, method: 'GET', data });
}

// =====================================================
// ① المصادقة (Authentication)
// =====================================================
const auth = {
  /**
   * تسجيل الدخول
   * @param {Object} params
   * @param {string} params.email     - البريد الإلكتروني
   * @param {string} params.password  - كلمة المرور (مُشفَّرة أو نص)
   * @returns {Promise<{token, userId, ...}>}
   */
  async login(params) {
    const res = await post('/login/login', params);
    // حفظ الجلسة تلقائياً
    if (res && res.data) {
      const d = res.data;
      setSession({
        token:  d.token  || d.accessToken || '',
        userId: d.userId || d.id          || '',
      });
      console.log('✓ تسجيل دخول ناجح | userId:', d.userId || d.id);
    }
    return res;
  },

  /**
   * تسجيل حساب جديد
   * @param {Object} params
   * @param {string} params.email          - البريد الإلكتروني
   * @param {string} params.password       - كلمة المرور (6-16 حرف)
   * @param {string} params.paypassword    - كلمة مرور الصندوق (6-16 حرف)
   * @param {string} [params.inviteCode]   - كود الدعوة (اختياري)
   * @param {string} [params.emailCode]    - كود التحقق من البريد
   */
  register(params) {
    return post('/login/register', params);
  },

  /**
   * إرسال كود التحقق إلى البريد الإلكتروني
   * @param {Object} params
   * @param {string} params.email - البريد الإلكتروني
   * @param {number} [params.type] - نوع الكود (1=تسجيل, 2=استعادة كلمة مرور)
   */
  sendEmailVerify(params) {
    return post('/login/sendEmailVerify', params);
  },

  /**
   * استعادة كلمة المرور
   * @param {Object} params
   * @param {string} params.email     - البريد الإلكتروني
   * @param {string} params.code      - كود التحقق
   * @param {string} params.password  - كلمة المرور الجديدة
   */
  recoverPassword(params) {
    return post('/login/recoverPassword', params);
  },

  /**
   * جلب أنواع الحسابات وأسمائها
   */
  getTypeAndName() {
    return get('/login/typeAndName');
  },

  /**
   * تسجيل الخروج
   */
  logout() {
    const res = post('/app-user/user/logout');
    setSession({ token: '', userId: '' });
    return res;
  },
};

// =====================================================
// ② بيانات المستخدم الشخصية (Personal)
// =====================================================
const personal = {
  /** معلومات المستخدم الحالي */
  getUserInfo() {
    return post('/personal/userInfo', {});
  },

  /**
   * تحديث معلومات المستخدم
   * @param {Object} params  - البيانات المراد تحديثها (nickname, avatar, ...)
   */
  updateUserInfo(params) {
    return post('/Personal/upUserInfo', params);
  },

  /** رابط الدعوة الشخصي */
  getInviteLink() {
    return post('/personal/getLink', {});
  },

  /** الرسائل الشخصية */
  getMessages(params = {}) {
    return post('/personal/getMessage', params);
  },

  /** قائمة الأخبار */
  getNewsList(params = {}) {
    return post('/personal/getNewsList', params);
  },

  /**
   * تفاصيل خبر معين
   * @param {Object} params
   * @param {string|number} params.id - معرّف الخبر
   */
  getNewsDetail(params) {
    return post('/personal/getNewsDetail', params);
  },

  /**
   * تفاصيل رمز/عملة معينة
   * @param {Object} params
   * @param {string} params.symbolCode - كود العملة
   */
  getSymbolDetail(params) {
    return post('/personal/getSymbolDetail', params);
  },

  /**
   * تغيير كلمة مرور تسجيل الدخول
   * @param {Object} params
   * @param {string} params.oldPassword - القديمة
   * @param {string} params.newPassword - الجديدة
   */
  saveLoginPassword(params) {
    return post('/personal/saveLoginPwd', params);
  },

  /**
   * تغيير كلمة مرور الصندوق (Fund Password)
   * @param {Object} params
   * @param {string} params.oldPassword - القديمة
   * @param {string} params.newPassword - الجديدة
   */
  saveFundPassword(params) {
    return post('/personal/saveFundPwd', params);
  },

  /**
   * إضافة/تعديل بيانات التحقق من الهوية
   * @param {Object} params
   * @param {string} params.realName    - الاسم الحقيقي
   * @param {string} params.idCard      - رقم الهوية
   * @param {string} params.frontPhoto  - صورة الوجه الأمامية (base64 أو URL)
   * @param {string} params.backPhoto   - صورة الظهر
   * @param {string} params.handPhoto   - صورة الهوية باليد
   */
  addIdentityVerification(params) {
    return post('/personal/userCertAdd', params);
  },

  /** مركز المساعدة */
  getHelpCenter(params = {}) {
    return post('/personal/helpCenter', params);
  },

  /** بيانات الأصدقاء المدعوّين */
  getInviteFriends(params = {}) {
    return post('/personal/inviteFriends', params);
  },

  /** قائمة الدعوات حسب النوع */
  getInviteFriendsByType(params = {}) {
    return post('/personal/inviteFriendsByType', params);
  },

  /** قائمة الدعوات المستوى الثاني */
  getInviteFriendsByTypeTwo(params = {}) {
    return post('/personal/inviteFriendsByTypeTwo', params);
  },

  /** إضافة/تعديل عملة مفضّلة */
  addUpdateSymbol(params) {
    return post('/personal/addUpdateSymbol', params);
  },
};

// =====================================================
// ③ الحسابات والأموال (Account / Wallet)
// =====================================================
const account = {
  /** جلب جميع حسابات المستخدم */
  getAllAccounts() {
    return post('/account/getAllUserAccountById', {});
  },

  /** قائمة أنواع عملات السحب (UDUN) */
  getWithdrawalCoinTypes() {
    return post('/udun/getWithdrawalCoinType', {});
  },

  /** العملات المدعومة */
  getSupportedCoins() {
    return post('/udun/supportCoins', {});
  },
};

// =====================================================
// ④ التداول الفوري (Spot / newCurrency)
// =====================================================
const trade = {
  /**
   * إنشاء أمر تداول
   * @param {Object} params
   * @param {string} params.symbolCode  - كود العملة (مثال: 'btcusdt')
   * @param {number} params.type        - 1=شراء / 2=بيع
   * @param {number} params.price       - السعر
   * @param {number} params.amount      - الكمية
   * @param {string} params.fundPassword - كلمة مرور الصندوق
   */
  createOrder(params) {
    return post('/newCurrency/createOrder', params);
  },

  /**
   * قائمة أوامر التداول
   * @param {Object} params
   * @param {number} [params.page]   - رقم الصفحة
   * @param {number} [params.size]   - عدد العناصر
   * @param {number} [params.status] - حالة الأمر
   */
  getOrders(params = {}) {
    return post('/newCurrency/orders', params);
  },

  /**
   * تفاصيل أمر معين
   * @param {Object} params
   * @param {string|number} params.id - معرّف الأمر
   */
  getOrderDetail(params) {
    return post('/newCurrency/detail', params);
  },

  /** قائمة العملات المتاحة */
  getCurrencies(params = {}) {
    return post('/currency/index', params);
  },

  /** قائمة العملات للتداول */
  getTradeList(params = {}) {
    return post('/newCurrency/index', params);
  },
};

// =====================================================
// ⑤ الإعلانات والإشعارات
// =====================================================
const notifications = {
  /** قائمة الإشعارات */
  getNoticeList(params = {}) {
    return post('/Personal/getNoticeList', params);
  },

  /** قائمة البانرات (الإعلانات الرسومية) */
  getBannerList(params = {}) {
    return post('/Personal/getBannerList', params);
  },

  /** بيانات التمرير (Scroll) */
  getScrollData(params = {}) {
    return post('/Personal/getScrollData', params);
  },
};

// =====================================================
// ⑥ Google Authenticator (2FA)
// =====================================================
const twoFactor = {
  /** ربط Google Authenticator */
  bindGoogle(params) {
    return post('/Personal/googleBind', params);
  },

  /** ربط عام */
  bind(params) {
    return post('/Personal/bind', params);
  },
};

// =====================================================
// ⑦ مركز الدعم والتحميل
// =====================================================
const support = {
  /** روابط التحميل */
  getDownloadLinks() {
    return get('/service/downloads');
  },
};

// =====================================================
// تصدير كل الوحدات
// =====================================================
module.exports = {
  auth,
  personal,
  account,
  trade,
  notifications,
  twoFactor,
  support,
  // وظائف مساعدة
  setSession,
  getSession,
  request,
};
