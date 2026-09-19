/* ============================================================
   識人訓練站 · 客戶端加密（WebCrypto，零依賴）
   ------------------------------------------------------------
   同一份程式碼，瀏覽器與 Node 都能跑（build 工具用它產生密文）。
   演算法：PBKDF2-SHA256 派生金鑰 → AES-GCM-256 加密。
   通關語【不會】出現在任何檔案裡；密文本身解不開。
   ============================================================ */
(function (root, factory) {
  var api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  else root.SHREN_CRYPTO = api;
})(typeof globalThis !== "undefined" ? globalThis : this, function () {
  "use strict";

  var ITER = 250000;

  function subtle() {
    var c = (typeof crypto !== "undefined") ? crypto : null;
    if (!c || !c.subtle) throw new Error("NO_WEBCRYPTO");
    return c.subtle;
  }
  function available() { try { subtle(); return true; } catch (e) { return false; } }

  function b64(bytes) {
    var s = "", i;
    for (i = 0; i < bytes.length; i++) s += String.fromCharCode(bytes[i]);
    return btoa(s);
  }
  function unb64(str) {
    var bin = atob(str), out = new Uint8Array(bin.length), i;
    for (i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
    return out;
  }
  function rand(n) {
    var a = new Uint8Array(n);
    crypto.getRandomValues(a);
    return a;
  }

  function derive(pass, salt, iter) {
    var enc = new TextEncoder();
    return subtle().importKey("raw", enc.encode(pass), "PBKDF2", false, ["deriveKey"])
      .then(function (base) {
        return subtle().deriveKey(
          { name: "PBKDF2", salt: salt, iterations: iter || ITER, hash: "SHA-256" },
          base, { name: "AES-GCM", length: 256 }, false, ["encrypt", "decrypt"]
        );
      });
  }

  function encrypt(obj, pass) {
    var salt = rand(16), iv = rand(12), key;
    return derive(pass, salt).then(function (k) {
      key = k;
      return subtle().encrypt({ name: "AES-GCM", iv: iv }, key,
        new TextEncoder().encode(JSON.stringify(obj)));
    }).then(function (ct) {
      return {
        v: 1, kdf: "PBKDF2-SHA256", iter: ITER,
        salt: b64(salt), iv: b64(iv), ct: b64(new Uint8Array(ct))
      };
    });
  }

  function decrypt(vault, pass) {
    if (!vault || !vault.ct) return Promise.reject(new Error("NO_VAULT"));
    return derive(pass, unb64(vault.salt), vault.iter).then(function (key) {
      return subtle().decrypt({ name: "AES-GCM", iv: unb64(vault.iv) }, key, unb64(vault.ct));
    }).then(function (pt) {
      return JSON.parse(new TextDecoder().decode(pt));
    });
  }

  return {
    encrypt: encrypt, decrypt: decrypt, available: available,
    ITER: ITER, b64: b64, unb64: unb64
  };
});
