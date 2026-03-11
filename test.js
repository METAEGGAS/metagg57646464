/**
 * ====================================================
 * test/test.js - اختبار شامل لجميع الوظائف
 * ====================================================
 *
 * قبل التشغيل:
 *   npm install
 *   node test/test.js
 *
 * يختبر:
 *   1. نظام التوقيع (MD5 + RSA)
 *   2. الاتصال بالخادم (ping)
 *   3. تسجيل الدخول
 *   4. جلب بيانات المستخدم
 *   5. جلب قائمة العملات
 *   6. WebSocket (هووبي + المنصة)
 */

const { sign }      = require('../src/sign');
const api           = require('../src/api');
const { wsManager } = require('../src/socket');

// ─────────────────────────────────────────────────────
// ⚙  ضع بيانات حسابك هنا للاختبار الكامل
// ─────────────────────────────────────────────────────
const TEST_EMAIL    = 'your_email@example.com';   // ← غيّر هذا
const TEST_PASSWORD = 'your_password';             // ← غيّر هذا
// ─────────────────────────────────────────────────────

function log(title, data) {
  console.log('\n' + '═'.repeat(50));
  console.log(`  ${title}`);
  console.log('═'.repeat(50));
  if (data !== undefined) {
    console.log(typeof data === 'object' ? JSON.stringify(data, null, 2) : data);
  }
}

function ok(label) {
  console.log(`  ✓ ${label}`);
}

function fail(label, err) {
  console.log(`  ✗ ${label}`);
  console.error('    ', err && (err.message || JSON.stringify(err)));
}

// ─────────────────────────────────────────────────────
// اختبار 1: نظام التوقيع
// ─────────────────────────────────────────────────────
async function testSign() {
  log('TEST 1: نظام التوقيع');

  // MD5
  const md5Sig = sign('MD5', 'test-token-123', '/login/login',
    { email: 'test@test.com', password: '123456' },
    {
      appId: 'h5_client', signType: 'MD5', clientType: 'H5',
      clientVersion: '1.0.0', token: 'test-token-123',
      userId: '999', timestamp: 1710000000000, extra: '',
    }
  );
  console.log('  MD5 signature:', md5Sig);
  ok('MD5 توليد التوقيع');

  // RSA (بدون token)
  const rsaSig = sign('RSA', '', '/login/login',
    { email: 'test@test.com', password: '123456' },
    {
      appId: 'h5_client', signType: 'RSA', clientType: 'H5',
      clientVersion: '1.0.0', token: '',
      userId: '', timestamp: 1710000000000, extra: '',
    }
  );
  console.log('  RSA signature (base64):', rsaSig.substring(0, 40) + '...');
  ok('RSA توليد التوقيع');
}

// ─────────────────────────────────────────────────────
// اختبار 2: الاتصال بالخادم (إرسال كود التحقق)
// ─────────────────────────────────────────────────────
async function testServerConnection() {
  log('TEST 2: الاتصال بـ https://api.excorx.info');

  try {
    // جلب قائمة العملات لا يتطلب تسجيل دخول
    const res = await api.trade.getCurrencies({ page: 1, size: 5 });
    log('نتيجة getCurrencies', res);
    ok('الاتصال بالخادم ناجح');
  } catch (err) {
    fail('فشل الاتصال بالخادم', err);
  }
}

// ─────────────────────────────────────────────────────
// اختبار 3: تسجيل الدخول
// ─────────────────────────────────────────────────────
async function testLogin() {
  log('TEST 3: تسجيل الدخول');

  if (TEST_EMAIL === 'your_email@example.com') {
    console.log('  ⚠ يرجى تعديل TEST_EMAIL و TEST_PASSWORD في test.js أولاً');
    return false;
  }

  try {
    const res = await api.auth.login({
      email    : TEST_EMAIL,
      password : TEST_PASSWORD,
    });
    log('نتيجة تسجيل الدخول', res);
    ok('تسجيل الدخول ناجح');
    return true;
  } catch (err) {
    fail('فشل تسجيل الدخول', err);
    return false;
  }
}

// ─────────────────────────────────────────────────────
// اختبار 4: بيانات المستخدم (يتطلب تسجيل دخول)
// ─────────────────────────────────────────────────────
async function testUserInfo() {
  log('TEST 4: بيانات المستخدم (getUserInfo)');

  const session = api.getSession();
  if (!session.token) {
    console.log('  ⚠ لا توجد جلسة - تخطي هذا الاختبار');
    return;
  }

  try {
    const res = await api.personal.getUserInfo();
    log('بيانات المستخدم', res);
    ok('جلب بيانات المستخدم ناجح');
  } catch (err) {
    fail('فشل جلب بيانات المستخدم', err);
  }
}

// ─────────────────────────────────────────────────────
// اختبار 5: جلب الإشعارات
// ─────────────────────────────────────────────────────
async function testNotifications() {
  log('TEST 5: الإشعارات (getNoticeList)');
  try {
    const res = await api.notifications.getNoticeList({ page: 1, size: 5 });
    log('الإشعارات', res);
    ok('جلب الإشعارات ناجح');
  } catch (err) {
    fail('فشل جلب الإشعارات', err);
  }
}

// ─────────────────────────────────────────────────────
// اختبار 6: WebSocket (هووبي)
// ─────────────────────────────────────────────────────
function testHuobiWebSocket() {
  return new Promise((resolve) => {
    log('TEST 6: WebSocket هووبي (wss://api.huobi.pro/ws)');

    const { SocketClient } = require('../src/socket');
    const ws = new SocketClient('wss://api.huobi.pro/ws', 90, true);

    let received = false;
    const timeout = setTimeout(() => {
      ws.closeSocket();
      if (!received) fail('لم تصل بيانات من هووبي في 15 ثانية');
      resolve();
    }, 15000);

    ws.initSocket(
      { sub: 'market.btcusdt.kline.1min', id: 'test-huobi' },
      'system',
      (data, type) => {
        if (!received) {
          received = true;
          console.log(`  ✓ استُقبلت رسالة من هووبي | type: ${type}`);
          console.log('  data.ch:', data.ch);
          clearTimeout(timeout);
          ws.closeSocket();
          resolve();
        }
      }
    );
  });
}

// ─────────────────────────────────────────────────────
// اختبار 7: WebSocket (منصتنا)
// ─────────────────────────────────────────────────────
function testPlatformWebSocket() {
  return new Promise((resolve) => {
    log('TEST 7: WebSocket المنصة (wss://api.gtex888.top/ws-8881)');

    const { SocketClient } = require('../src/socket');
    const ws = new SocketClient('wss://api.gtex888.top/ws-8881', 90, false);

    let connected = false;
    const timeout = setTimeout(() => {
      ws.closeSocket();
      if (!connected) fail('فشل الاتصال بـ WebSocket المنصة في 10 ثوانٍ');
      resolve();
    }, 10000);

    ws.initSocket(
      { sub: 'market.btcusdt.kline.1min', id: 'test-platform' },
      'platform',
      (data, type) => {
        if (!connected) {
          connected = true;
          console.log(`  ✓ استُقبلت رسالة من المنصة | type: ${type}`);
          clearTimeout(timeout);
          ws.closeSocket();
          resolve();
        }
      }
    );

    // عند فتح الاتصال فقط
    ws._onOpenCallback = () => {
      if (!connected) {
        connected = true;
        ok('اتصال WebSocket المنصة ناجح');
        clearTimeout(timeout);
        setTimeout(() => { ws.closeSocket(); resolve(); }, 2000);
      }
    };
  });
}

// ─────────────────────────────────────────────────────
// تشغيل جميع الاختبارات
// ─────────────────────────────────────────────────────
async function runAll() {
  console.log('\n' + '█'.repeat(60));
  console.log('  🔬 بدء الاختبارات الشاملة');
  console.log('█'.repeat(60));

  await testSign();
  await testServerConnection();
  const loggedIn = await testLogin();
  if (loggedIn) await testUserInfo();
  await testNotifications();
  await testHuobiWebSocket();
  await testPlatformWebSocket();

  console.log('\n' + '█'.repeat(60));
  console.log('  ✅ انتهت الاختبارات');
  console.log('█'.repeat(60) + '\n');

  process.exit(0);
}

runAll().catch((err) => {
  console.error('خطأ غير متوقع:', err);
  process.exit(1);
});
