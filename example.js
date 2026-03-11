/**
 * ====================================================
 * example.js - أمثلة عملية كاملة
 * ====================================================
 * 
 * تشغيل: node example.js
 */

const api           = require('./src/api');
const { wsManager } = require('./src/socket');

// ─────────────────────────────────────────────────────
// مثال 1: جلب قائمة العملات (لا يتطلب تسجيل دخول)
// ─────────────────────────────────────────────────────
async function example_getCurrencies() {
  console.log('\n══ مثال 1: جلب قائمة العملات ══');
  const res = await api.trade.getCurrencies({ page: 1, size: 10 });
  console.log('عدد العملات:', res.data?.length);
  res.data?.slice(0, 3).forEach(c => {
    console.log(`  ${c.abbrName}: $${c.market} (${c.increase}%)`);
  });
}

// ─────────────────────────────────────────────────────
// مثال 2: تسجيل الدخول
// ─────────────────────────────────────────────────────
async function example_login() {
  console.log('\n══ مثال 2: تسجيل الدخول ══');

  // ← ضع بيانات حسابك هنا
  const res = await api.auth.login({
    email    : 'your_email@example.com',
    password : 'your_password',
  });

  console.log('النتيجة:', res.msg);
  console.log('الجلسة الحالية:', api.getSession());
}

// ─────────────────────────────────────────────────────
// مثال 3: بيانات المستخدم (بعد تسجيل الدخول)
// ─────────────────────────────────────────────────────
async function example_userInfo() {
  console.log('\n══ مثال 3: بيانات المستخدم ══');

  // ملاحظة: يجب تسجيل الدخول أولاً
  // api.setSession({ token: 'YOUR_TOKEN', userId: 'YOUR_USER_ID' });

  const session = api.getSession();
  if (!session.token) {
    console.log('  ⚠ يجب تسجيل الدخول أولاً');
    return;
  }

  const res = await api.personal.getUserInfo();
  console.log('بيانات المستخدم:', JSON.stringify(res.data, null, 2));
}

// ─────────────────────────────────────────────────────
// مثال 4: جلب الإشعارات
// ─────────────────────────────────────────────────────
async function example_notifications() {
  console.log('\n══ مثال 4: الإشعارات ══');
  const res = await api.notifications.getNoticeList({ page: 1, size: 5 });
  console.log('الإشعارات:', JSON.stringify(res).substring(0, 200));
}

// ─────────────────────────────────────────────────────
// مثال 5: إرسال بريد تحقق
// ─────────────────────────────────────────────────────
async function example_sendVerification() {
  console.log('\n══ مثال 5: إرسال كود التحقق للبريد ══');
  const res = await api.auth.sendEmailVerify({
    email: 'your_email@example.com',
    type : 1,  // 1=تسجيل
  });
  console.log('النتيجة:', res);
}

// ─────────────────────────────────────────────────────
// مثال 6: WebSocket هووبي - بيانات الكاندل
// ─────────────────────────────────────────────────────
function example_huobiKline() {
  console.log('\n══ مثال 6: WebSocket هووبي (BTC/USDT كاندل 1 دقيقة) ══');

  const { SocketClient } = require('./src/socket');
  const ws = new SocketClient('wss://api.huobi.pro/ws', 90, true);

  let count = 0;
  ws.initSocket(
    { sub: 'market.btcusdt.kline.1min', id: 'btc-kline' },
    'system',
    (data, type) => {
      if (type === 'kLineData' && count < 3) {
        count++;
        const t = data.tick;
        console.log(`  [كاندل ${count}] open:${t.open} close:${t.close} high:${t.high} low:${t.low}`);
        if (count >= 3) {
          ws.closeSocket();
          console.log('  ✓ تم استلام 3 كاندلات - الاتصال مُغلق');
        }
      }
    }
  );

  return new Promise(resolve => setTimeout(resolve, 10000));
}

// ─────────────────────────────────────────────────────
// مثال 7: WebSocket هووبي - بيانات التداولات
// ─────────────────────────────────────────────────────
function example_huobiTrades() {
  console.log('\n══ مثال 7: WebSocket هووبي (صفقات BTC/USDT) ══');

  const { SocketClient } = require('./src/socket');
  const ws = new SocketClient('wss://api.huobi.pro/ws', 90, true);

  let count = 0;
  ws.initSocket(
    { sub: 'market.btcusdt.trade.detail', id: 'btc-trades' },
    'system',
    (data, type) => {
      if (type === 'newTrade' && count < 2) {
        count++;
        const trades = data.tick?.data || [];
        trades.slice(0, 2).forEach(t => {
          console.log(`  [صفقة] سعر:${t.price} كمية:${t.amount} اتجاه:${t.direction}`);
        });
        if (count >= 2) {
          ws.closeSocket();
        }
      }
    }
  );

  return new Promise(resolve => setTimeout(resolve, 10000));
}

// ─────────────────────────────────────────────────────
// مثال 8: WebSocket هووبي - بيانات العمق (Orderbook)
// ─────────────────────────────────────────────────────
function example_huobiDepth() {
  console.log('\n══ مثال 8: WebSocket هووبي (دفتر الأوامر BTC/USDT) ══');

  const { SocketClient } = require('./src/socket');
  const ws = new SocketClient('wss://api.huobi.pro/ws', 90, true);

  let received = false;
  ws.initSocket(
    { sub: 'market.btcusdt.depth.step0', id: 'btc-depth' },
    'system',
    (data, type) => {
      if (!received) {
        received = true;
        const bids = data.tick?.bids?.slice(0, 3) || [];
        const asks = data.tick?.asks?.slice(0, 3) || [];
        console.log('  أفضل 3 عروض بيع (Asks):', asks.map(a => `${a[0]}@${a[1]}`).join(', '));
        console.log('  أفضل 3 عروض شراء (Bids):', bids.map(b => `${b[0]}@${b[1]}`).join(', '));
        ws.closeSocket();
      }
    }
  );

  return new Promise(resolve => setTimeout(resolve, 10000));
}

// ─────────────────────────────────────────────────────
// تشغيل الأمثلة
// ─────────────────────────────────────────────────────
async function main() {
  console.log('🚀 بدء تشغيل الأمثلة\n');

  try {
    await example_getCurrencies();
    await example_notifications();
    await example_huobiKline();
    await example_huobiDepth();
  } catch (err) {
    console.error('خطأ:', err.message || err);
  }

  console.log('\n✅ انتهت جميع الأمثلة');
  process.exit(0);
}

main();
