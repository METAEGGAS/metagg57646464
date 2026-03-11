/**
 * ====================================================
 * socket.js - طبقة الاتصال WebSocket (نسخة محدّثة)
 * مطابق تماماً لكلاس Socket في full_code.js
 * ====================================================
 *
 * يدعم اتصالين:
 *   1. wss://api.huobi.pro/ws        ✅ يعمل
 *   2. wss://api.gtex888.top/ws-8881 ⚠️ يتطلب بيئة متصفح (Cloudflare محمي)
 *
 * ملاحظة عن WS المنصة:
 *   السيرفر محمي بـ Cloudflare ويمنع اتصالات الـ Bot Server-side.
 *   يعمل بشكل طبيعي من:
 *     - تطبيق الجوال (UniApp)
 *     - المتصفح (Browser WebSocket)
 *   الحل: استخدم puppeteer أو playwright إذا احتجت اتصالاً من Node.js
 */

const WebSocket = require('ws');
const zlib      = require('zlib');

// ─────────────────────────────────────────────────────
// كلاس SocketClient - مطابق لكلاس 's' في الكود الأصلي
// ─────────────────────────────────────────────────────
class SocketClient {
  /**
   * @param {string}  url              - عنوان WebSocket
   * @param {number}  heartbeatInterval - فترة نبض القلب بالثواني (افتراضي 90)
   * @param {boolean} isSystem         - true = هووبي (gzip), false = منصتنا (JSON)
   */
  constructor(url, heartbeatInterval = 90, isSystem = false) {
    this.url               = url;
    this.heartbeatInterval = heartbeatInterval;
    this.isSystem          = isSystem;

    this.ws              = null;
    this.isCreate        = false;
    this.isConnect       = false;
    this.isOnOpen        = false;
    this.isInitiative    = false;
    this.heartbeatTimer  = null;
    this.reconnectTimer  = null;
    this.againTime       = 3;
    this.numC            = 0;

    this._onOpenCallback    = null;
    this._onMessageCallback = null;
  }

  // ──────────────────────────────────────────────────
  // تهيئة الاتصال
  // ──────────────────────────────────────────────────
  initSocket(msg, type, callback) {
    console.log(`[WebSocket] initSocket → ${this.url}`);

    const options = {
      headers: {
        'content-type' : 'application/json',
        'Origin'       : 'https://api.excorx.info',
        'User-Agent'   : 'Mozilla/5.0 (Linux; Android 11) AppleWebKit/537.36',
      },
      handshakeTimeout: 15000,
      followRedirects : true,
    };

    try {
      this.ws = new WebSocket(this.url, options);
    } catch (e) {
      console.error('[WebSocket] فشل إنشاء الاتصال:', e.message);
      return;
    }

    this.isCreate = true;

    this.ws.on('open', () => {
      console.log(`[WebSocket] ✓ متصل: ${this.url}`);
      this.isOnOpen  = true;
      this.isConnect = true;
      this.numC      = 0;

      this.sendMsg(msg).catch(() => {});

      if (msg && msg.ping) this.heartbeatCheck(msg);

      if (this._onOpenCallback) this._onOpenCallback();
    });

    this.ws.on('message', (rawData) => {
      this._handleMessage(rawData, type, callback);
    });

    this.ws.on('close', (code, reason) => {
      const r = reason ? reason.toString() : '';
      console.log(`[WebSocket] ✗ أُغلق (${code}) ${r}: ${this.url}`);
      this.isConnect = false;
      this.isOnOpen  = false;
      if (!this.isInitiative) this._reconnect(msg, type, callback);
    });

    this.ws.on('error', (err) => {
      console.error(`[WebSocket] خطأ: ${err.message}`);
    });

    this.ws.on('unexpected-response', (req, res) => {
      console.warn(`[WebSocket] HTTP ${res.statusCode} - ${this.url}`);
      if (res.statusCode === 200) {
        console.warn('[WebSocket] السيرفر محمي بـ Cloudflare. يعمل فقط من المتصفح أو التطبيق.');
      }
      if (!this.isInitiative) {
        setTimeout(() => this._reconnect(msg, type, callback), this.againTime * 1000);
      }
    });
  }

  // ──────────────────────────────────────────────────
  // معالجة الرسائل الواردة
  // ──────────────────────────────────────────────────
  _handleMessage(rawData, type, callback) {
    try {
      if (type === 'system') {
        // هووبي: بيانات مضغوطة بـ gzip
        const buf = Buffer.isBuffer(rawData) ? rawData : Buffer.from(rawData);
        zlib.gunzip(buf, (err, decompressed) => {
          if (err) return;
          let json;
          try { json = JSON.parse(decompressed.toString('utf8')); }
          catch { return; }

          if (json.ping) {
            this.sendMsg({ pong: json.ping }).catch(() => {});
            callback && callback(json, 'systemPing');
          }
          if (json.ch) {
            let evt = null;
            if (json.ch.includes('kline'))        evt = 'kLineData';
            if (json.ch.includes('trade.detail')) evt = 'newTrade';
            if (evt) callback && callback(json, evt);
          }
        });

      } else {
        // منصتنا: JSON عادي
        let json;
        const str = typeof rawData === 'string' ? rawData : rawData.toString();
        try { json = JSON.parse(str); } catch { return; }

        if (json.ping) {
          this.sendMsg({ pong: json.ping }).catch(() => {});
          callback && callback(json, 'platformPing');
        }
        if (json.ch) {
          let evt = null;
          if (json.ch.includes('kline'))        evt = 'kLineData';
          if (json.ch.includes('trade.detail')) evt = 'newTrade';
          if (json.ch.includes('depth'))        evt = 'trading';
          if (evt) callback && callback(json, evt);
        }
        if (Array.isArray(json.data)) {
          callback && callback(json, 'curr');
        }
      }
    } catch (err) {
      console.error('[WebSocket] خطأ في المعالجة:', err.message);
    }
  }

  // ──────────────────────────────────────────────────
  // إرسال رسالة
  // ──────────────────────────────────────────────────
  sendMsg(msg) {
    return new Promise((resolve, reject) => {
      if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
        reject(new Error('WebSocket غير متصل'));
        return;
      }
      const data = typeof msg === 'string' ? msg : JSON.stringify(msg);
      this.ws.send(data, (err) => {
        if (err) reject(err);
        else resolve(true);
      });
    });
  }

  // ──────────────────────────────────────────────────
  // نبض القلب (heartbeat) - كل heartbeatInterval ثانية
  // ──────────────────────────────────────────────────
  heartbeatCheck(msg) {
    clearInterval(this.heartbeatTimer);
    this.heartbeatTimer = setInterval(() => {
      if (this.isConnect) {
        this.sendMsg(msg).catch(() => {});
      }
    }, this.heartbeatInterval * 1000);
  }

  // ──────────────────────────────────────────────────
  // إعادة الاتصال التلقائية
  // ──────────────────────────────────────────────────
  _reconnect(msg, type, callback) {
    clearInterval(this.heartbeatTimer);
    clearTimeout(this.reconnectTimer);

    if (this.numC < 5) {  // محاولة بحد أقصى 5 مرات
      this.numC++;
      console.log(`[WebSocket] إعادة الاتصال (${this.numC}/5) بعد ${this.againTime}ث...`);
      this.reconnectTimer = setTimeout(() => {
        this.isCreate  = false;
        this.isOnOpen  = false;
        this.isConnect = false;
        if (this.ws) {
          try { this.ws.terminate(); } catch {}
          this.ws = null;
        }
        this.initSocket(msg, type, callback);
      }, this.againTime * 1000);
    } else {
      console.warn(`[WebSocket] تجاوز الحد الأقصى لمحاولات الاتصال: ${this.url}`);
    }
  }

  // ──────────────────────────────────────────────────
  // إغلاق الاتصال يدوياً
  // ──────────────────────────────────────────────────
  closeSocket(reason = 'إغلاق يدوي') {
    this.isInitiative = true;
    clearInterval(this.heartbeatTimer);
    clearTimeout(this.reconnectTimer);

    if (this.ws) {
      try {
        if (this.ws.readyState === WebSocket.OPEN) this.ws.close();
        else this.ws.terminate();
      } catch {}
      this.ws        = null;
      this.isCreate  = false;
      this.isConnect = false;
      this.isOnOpen  = false;
      console.log(`[WebSocket] ✓ أُغلق يدوياً: ${this.url}`);
    }
  }
}

// ─────────────────────────────────────────────────────
// مدير الاتصالات (WebSocketManager)
// يُدير اتصالَي هووبي والمنصة
// ─────────────────────────────────────────────────────
class WebSocketManager {
  constructor() {
    this.huobiSocket    = null;
    this.platformSocket = null;
    this._platformQueue = [];
    this._systemQueue   = [];

    // Callbacks للبيانات الواردة
    this.onKline    = null;  // function(data) - بيانات الكاندل
    this.onDepth    = null;  // function(data) - بيانات العمق (orderbook)
    this.onTrade    = null;  // function(data) - صفقات جديدة
    this.onCurr     = null;  // function(data) - أسعار العملات
  }

  // ──────────────────────────────────────────────────
  // تهيئة الاتصالين (initWebsocket)
  // ──────────────────────────────────────────────────
  initWebsocket() {
    if (this.huobiSocket)    this.huobiSocket.closeSocket();
    if (this.platformSocket) this.platformSocket.closeSocket();

    this.huobiSocket    = new SocketClient('wss://api.huobi.pro/ws', 90, true);
    this.platformSocket = new SocketClient('wss://api.gtex888.top/ws-8881', 90, false);

    console.log('[WSManager] تم إنشاء اتصالَي WebSocket');
  }

  // ──────────────────────────────────────────────────
  // الاشتراك في بيانات السوق عبر هووبي
  // subMsg مثال: { sub: 'market.btcusdt.kline.1min', id: 'req1' }
  // ──────────────────────────────────────────────────
  subscribeHuobi(subMsg) {
    if (!this.huobiSocket) this.initWebsocket();

    const callback = (data, type) => {
      if (type === 'kLineData') this.onKline && this.onKline(data);
      if (type === 'newTrade')  this.onTrade && this.onTrade(data);
    };

    if (this.huobiSocket.isCreate && this.huobiSocket.isOnOpen) {
      this.huobiSocket.sendMsg(subMsg).catch(() => {});
    } else {
      this.huobiSocket.initSocket(subMsg, 'system', callback);
    }
  }

  // ──────────────────────────────────────────────────
  // الاشتراك في بيانات المنصة
  // ──────────────────────────────────────────────────
  subscribePlatform(subMsg) {
    if (!this.platformSocket) this.initWebsocket();

    const callback = (data, type) => {
      if (type === 'kLineData') this.onKline && this.onKline(data);
      if (type === 'newTrade')  this.onTrade && this.onTrade(data);
      if (type === 'trading')   this.onDepth && this.onDepth(data);
      if (type === 'curr')      this.onCurr  && this.onCurr(data);
    };

    if (this.platformSocket.isCreate && this.platformSocket.isOnOpen) {
      this.platformSocket.sendMsg(subMsg).catch(() => {});
    } else {
      this.platformSocket.initSocket(subMsg, 'platform', callback);
    }
  }

  // ──────────────────────────────────────────────────
  // إعادة تهيئة جميع الاتصالات
  // ──────────────────────────────────────────────────
  resetConnect() {
    this.initWebsocket();
  }

  // ──────────────────────────────────────────────────
  // إغلاق جميع الاتصالات
  // ──────────────────────────────────────────────────
  closeAll() {
    if (this.huobiSocket)    this.huobiSocket.closeSocket();
    if (this.platformSocket) this.platformSocket.closeSocket();
  }
}

const wsManager = new WebSocketManager();
module.exports = { SocketClient, WebSocketManager, wsManager };
