/**
 * ====================================================
 * sign.js - نظام التوقيع (MD5 + RSA)
 * مطابق تماماً للكود الأصلي من full_code.js
 * ====================================================
 */
const crypto = require('crypto');
const md5 = require('md5');

// ───── RSA Private Key (مضمّنة في الكود الأصلي) ─────
const RSA_PRIVATE_KEY = `-----BEGIN PRIVATE KEY-----
MIIEvgIBADANBgkqhkiG9w0BAQEFAASCBKgwggSkAgEAAoIBAQDfF+ITlc6m9IPM
gBBp+rhkmrzPri10fzQFyJdKtfn1RfChr8wEz5x2HhNkWhgjE7F7YAuYjTXKrNBl
W7/c9vipahvZwWdkthGd3jlWkYTcPkLsOYJPMQLcig7S1VYtT2uab3VC21ZMNV5V
LZQeGnI2CtCTEJaeIdtsAc3AUjhJzNs5tRgxdmDSBI5fb3gTIecH2WLF7ixYGaFS
iQVaDWyyuUtPbIn+yVKjyi51VemFn30GaUz9NVgjepUhvM0+Rq3+3Zjl5HXQC3e+
9tQ3bEL0kzelNKFWFWHAumxI0pdG96lymCpiaIybJAJ7RGi2NWmBmjwrm461JxIY
4S/yrmmzAgMBAAECggEAJ9yemp1D5XT/L8UaKbWQyPkVD46xtIUeCIKE9eZ6GSc8
DcfZjmqCLGDHWkD22x2jssXAjKt+lw411kaEi7jdSXgaLdhu3wHhN/IDEMLDmI7P
amIENJ4vQrSwXV+dHE96jIepzh5e1xMaHeIc+xwCmEFqbzyhjPPDvxK7bsfCIv1Q
B6hgwdiILmRTqGU3ACZdPerWbfZGcYuZ0ecUERuH9fbxvOA6/t4Ivmag5K3GCG/v
8HHz1ehPwDeYMjNzzhUmyKMAWnumVqTcxOt7D9wlRiIiGv5bxgOWnB19MqLgPqFF
3ndMttFBnmKCO9KfviuM5ruNNg3nASXKtKsLJLePIQKBgQD92plfh49yesXTxswF
oV4RjBM87D3tFbnTTpAto96JCjov5ghVfnRpUmQrQWSwqeEmSFu/1Gun02vOEAha
3M3h9c1aHSRexM0SDWXOCofqyodt/vsCGRSOu9eUgUCz8J1dyShPqpgZEPtahydn
HlDyeUSwiBWGkzUahNvsJBtFWQKBgQDg+rXspVOgZ9lKKvYY6bY/z/u+u7j7n4wy
ojsViEhQGmA+s0jWTBqBa/742wnHb3w4kKB0ojRLK0z8onr+hi20hFL9NeI4T5nK
swD/+yb0NOcC28aoGyGwyktxrtIkXVvnBDmGMsPORf3LL/OnSY5DTTtxoctEL3tk
htJU0g6p6wKBgG5G5lXfl+tNdl8Xf0362diZl0nh/szdoUowWOXayDOUI87nCTvK
oVuXlThNQiaUxeBRkrn014eiirSLtnVycmX01+6Ltl8M82EiPNWTMZRHwyl/mR9C
MfIHnBFBTRBeOJ6jYkWpgEVzYR3klLNxMg0DrVla5K7/iBQrHzaoQMiRAoGBAK5n
K+hLMUzDtFoee7BMXI+TN2BgPcIxqIkH4i2K/CO8jqeMbAZT8Kgrg/h+NFJ6Rh3D
X9+KbmdnJcMiYZ41ffDWM08/GiL08g+EPF4z37qn1/0LSjC+95sI9vslvpmaFcg8
Kiux5sBc2aVNguBH0RSzJkWsWtp8xHblXN+MBvoJAoGBAJrSVgLIkyriTAi1r/7n
s8a4H/pa+GyRh3fMqeZHYKwHrfWWbNhO6te2XYmVrkEcsu7z59lt8gnMSBTsgwdZ
GClbi66qDiZ66TYq2v5NI4knON0DWLmuzWuqikcN5PGsKbllpl9/+reGHHK9cl1S
f0I9iSQe0vQLksxTBFVgevFl
-----END PRIVATE KEY-----`;

// ─────────────────────────────────────────────────────
// دالة مساعدة: هل القيمة كائن (Object)؟
// ─────────────────────────────────────────────────────
function isObject(val) {
  return Object.prototype.toString.call(val) === '[object Object]';
}

// ─────────────────────────────────────────────────────
// دالة مساعدة: هل القيمة مصفوفة (Array)؟
// ─────────────────────────────────────────────────────
function isArray(val) {
  return Object.prototype.toString.call(val) === '[object Array]';
}

// ─────────────────────────────────────────────────────
// إزالة حقول المصفوفات من الكائن (مطابق للكود الأصلي)
// ─────────────────────────────────────────────────────
function removeArrayFields(obj) {
  for (const key in obj) {
    const val = obj[key];
    if (isArray(val)) delete obj[key];
    else if (isObject(val)) removeArrayFields(val);
  }
}

// ─────────────────────────────────────────────────────
// بناء سلسلة المعاملات المرتّبة (مطابق للكود الأصلي)
// المنطق: 
//   1. نسخ الكائن، حذف المصفوفات
//   2. ترتيب المفاتيح أبجدياً (localeCompare)
//   3. بناء: key1value1key2value2...
// ─────────────────────────────────────────────────────
function buildSortedParamsString(params) {
  const map = {};
  const keys = [];

  if (params && isObject(params)) {
    const copy = {};
    Object.assign(copy, params);
    removeArrayFields(copy);

    for (const k in copy) {
      let v = copy[k];
      if (isObject(v)) v = JSON.stringify(v);
      if (v !== undefined && v !== null && v !== '' && v !== 'null') {
        keys.push(k);
        map[k] = k + v;
      }
    }
  }

  keys.sort((a, b) => a.localeCompare(b));
  return keys.reduce((acc, k) => acc + map[k], '');
}

// ─────────────────────────────────────────────────────
// توقيع RSA-SHA256 (للمستخدم غير المسجّل)
// المدخل: النص الكامل للتوقيع
// المخرج: base64 signature
// ─────────────────────────────────────────────────────
function signRSA(text) {
  const sign = crypto.createSign('SHA256');
  sign.update(text);
  sign.end();
  return sign.sign(RSA_PRIVATE_KEY, 'base64');
}

// ─────────────────────────────────────────────────────
// توقيع MD5 (للمستخدم المسجّل)
// المدخل: النص الكامل للتوقيع
// المخرج: MD5 hash string
// ─────────────────────────────────────────────────────
function signMD5(text) {
  return md5(text);
}

// ─────────────────────────────────────────────────────
// الدالة الرئيسية للتوقيع (مطابق للكود الأصلي)
// 
// signType: 'RSA' | 'MD5'
// token:    رمز الجلسة (فارغ إذا لم يكن مسجّلاً)
// urlPath:  مسار الطلب (بدون query string)
// data:     بيانات الطلب (body)
// headers:  كائن الـ headers الأساسية
// ─────────────────────────────────────────────────────
function sign(signType, token, urlPath, data, headers) {
  // إزالة query string من المسار
  const cleanPath = urlPath.split('?')[0];
  const sortedData = buildSortedParamsString(data);
  const sortedHeaders = buildSortedParamsString(headers);

  if (signType === 'RSA') {
    const text = cleanPath + sortedData + sortedHeaders;
    return signRSA(text);
  } else if (signType === 'MD5') {
    const text = cleanPath + sortedData + token + sortedHeaders;
    return signMD5(text);
  }
  return '';
}

module.exports = { sign, buildSortedParamsString, RSA_PRIVATE_KEY };
