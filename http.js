/**
 * ====================================================
 * http.js - طبقة الاتصال HTTP
 * مطابق تماماً لمنطق full_code.js
 * ====================================================
 *
 * يتصل بـ: https://api.excorx.info
 *
 * Headers المُرسَلة تلقائياً:
 *   token, userId, lang, clientType, appId,
 *   clientVersion, signType, sign, extra,
 *   userId, timestamp, Cache-Control, Content-Type
 */

const https = require('https');
const http  = require('http');
const { URL }  = require('url');
const { sign } = require('./sign');

// ─────────────────────────────────────────────────────
// إعدادات الخادم
// ─────────────────────────────────────────────────────
const BASE_URL  = 'https://api.excorx.info';
const APP_ID    = 'h5_client';
const CLIENT_TYPE    = 'H5';
const CLIENT_VERSION = '1.0.0';

// ─────────────────────────────────────────────────────
// حالة المستخدم (تُحدَّث بعد تسجيل الدخول)
// ─────────────────────────────────────────────────────
let _token  = '';
let _userId = '';
let _lang   = 'en';

function setSession({ token, userId, lang }) {
  if (token  !== undefined) _token  = token;
  if (userId !== undefined) _userId = userId;
  if (lang   !== undefined) _lang   = lang;
}

function getSession() {
  return { token: _token, userId: _userId, lang: _lang };
}

// ─────────────────────────────────────────────────────
// إرسال طلب HTTP (GET / POST / PUT / DELETE)
// 
// options:
//   url     : مسار الـ API (مثال: '/login/login')
//   method  : 'POST' (افتراضي) | 'GET' | 'PUT' | ...
//   data    : كائن البيانات المُرسَلة في body
//   header  : headers إضافية اختيارية
// ─────────────────────────────────────────────────────
function request(options = {}) {
  return new Promise((resolve, reject) => {
    const method    = (options.method || 'POST').toUpperCase();
    const urlPath   = options.url || '/';
    const data      = options.data || {};
    const timestamp = Date.now();
    const signType  = _token ? 'MD5' : 'RSA';

    // ── بناء headers الأساسية ──
    const baseHeaders = {
      appId         : APP_ID,
      sign          : '',
      signType      : signType,
      clientType    : CLIENT_TYPE,
      clientVersion : CLIENT_VERSION,
      token         : _token,
      userId        : _userId || '',
      timestamp     : timestamp,
      extra         : '',
    };

    // ── حساب التوقيع ──
    const signValue = sign(signType, _token, urlPath, data, baseHeaders);
    baseHeaders.sign = signValue;

    // ── بناء headers HTTP الكاملة ──
    const headers = {
      'token'          : _token,
      'userId'         : _userId || '',
      'lang'           : _lang || 'en',
      'clientType'     : CLIENT_TYPE,
      'appId'          : APP_ID,
      'clientVersion'  : CLIENT_VERSION,
      'signType'       : signType,
      'sign'           : signValue,
      'extra'          : '',
      'timestamp'      : String(timestamp),
      'Cache-Control'  : 'no-cache, no-store, must-revalidate',
      'Content-Type'   : 'application/json',
    };

    // ── دمج headers إضافية إذا وُجدت ──
    if (options.header) {
      Object.assign(headers, options.header);
    }

    // ── تحضير الـ body ──
    let body = '';
    if (method !== 'GET') {
      body = JSON.stringify(data);
      headers['Content-Length'] = Buffer.byteLength(body);
    }

    // ── تحليل الـ URL ──
    let fullUrl = BASE_URL + urlPath;
    if (method === 'GET' && Object.keys(data).length > 0) {
      const qs = new URLSearchParams(data).toString();
      fullUrl += '?' + qs;
    }

    const parsedUrl = new URL(fullUrl);
    const isHttps   = parsedUrl.protocol === 'https:';
    const transport = isHttps ? https : http;

    const reqOptions = {
      hostname : parsedUrl.hostname,
      port     : parsedUrl.port || (isHttps ? 443 : 80),
      path     : parsedUrl.pathname + parsedUrl.search,
      method   : method,
      headers  : headers,
      timeout  : 60000,
    };

    console.log(`\n→ ${method} ${fullUrl}`);
    if (Object.keys(data).length > 0) {
      console.log('  body:', JSON.stringify(data));
    }

    const req = transport.request(reqOptions, (res) => {
      let rawData = '';
      res.setEncoding('utf8');

      res.on('data', (chunk) => { rawData += chunk; });

      res.on('end', () => {
        console.log(`← ${res.statusCode}`);
        try {
          const parsed = JSON.parse(rawData);
          // منطق مطابق: code !== 0 => رفض
          if (parsed.code !== undefined && parsed.code !== 0) {
            // 40006 = انتهت الجلسة
            if (parsed.code === 40006) {
              console.warn('⚠ انتهت صلاحية الجلسة (40006)');
              setSession({ token: '', userId: '' });
            }
            reject(parsed);
          } else {
            resolve(parsed);
          }
        } catch (e) {
          resolve(rawData);
        }
      });
    });

    req.on('timeout', () => {
      req.destroy();
      reject(new Error('Request timeout'));
    });

    req.on('error', (err) => {
      console.error('Request error:', err.message);
      reject(err);
    });

    if (method !== 'GET' && body) {
      req.write(body);
    }

    req.end();
  });
}

// ─────────────────────────────────────────────────────
// دالة رفع ملف (upload)
// مسار الـ endpoint: /index/upload
// ─────────────────────────────────────────────────────
function upload(filePath, fileName = 'file') {
  // تتطلب مكتبة form-data
  try {
    const FormData = require('form-data');
    const fs       = require('fs');
    const form     = new FormData();
    form.append('file', fs.createReadStream(filePath), { filename: fileName });

    return new Promise((resolve, reject) => {
      const formHeaders = form.getHeaders();
      formHeaders['token']  = _token;
      formHeaders['userId'] = _userId || '';

      const parsedUrl = new URL(BASE_URL + '/index/upload');
      const options   = {
        hostname : parsedUrl.hostname,
        port     : 443,
        path     : parsedUrl.pathname,
        method   : 'POST',
        headers  : formHeaders,
      };

      const req = https.request(options, (res) => {
        let raw = '';
        res.setEncoding('utf8');
        res.on('data', (c) => { raw += c; });
        res.on('end', () => {
          try { resolve(JSON.parse(raw)); }
          catch { resolve(raw); }
        });
      });

      req.on('error', reject);
      form.pipe(req);
    });
  } catch {
    return Promise.reject(new Error('form-data package not installed. Run: npm install form-data'));
  }
}

module.exports = {
  request,
  upload,
  setSession,
  getSession,
  BASE_URL,
};
