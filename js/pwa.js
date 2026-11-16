/* PWA: تسجيل الـ Service Worker + نافذة منبثقة لتثبيت التطبيق
   تظهر عند فتح أي صفحة (بما فيها الدخول) طالما التطبيق غير مثبَّت:
   - أندرويد وكروم/إيدج (موبايل وكمبيوتر): نافذتنا ← «تثبيت الآن» يفتح مربع التثبيت الأصلي.
   - آيفون (Safari/Chrome): لا يوجد حدث تثبيت، فتظهر النافذة ← إرشاد «إضافة إلى الشاشة الرئيسية».
   - «لاحقًا» تؤجّلها يومًا، و«لا تذكرني» تؤجّلها 30 يومًا (زر التثبيت في الشريط العلوي يظل متاحًا). */
(function () {
  "use strict";
  var deferred = null;
  var ua = navigator.userAgent || "";
  var isStandalone = (window.matchMedia && matchMedia("(display-mode: standalone)").matches) || navigator.standalone === true;
  var isIOS = (/iphone|ipad|ipod/i.test(ua) || (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1)) && !window.MSStream;
  var UNTIL_KEY = "rsi_hide_until";
  var DAY = 24 * 3600 * 1000;

  if ("serviceWorker" in navigator && (location.protocol === "https:" || location.hostname === "localhost" || location.hostname === "127.0.0.1")) {
    window.addEventListener("load", function () {
      navigator.serviceWorker.register("sw.js").catch(function () {});
    });
  }

  function topBtn() { return document.getElementById("install-btn"); }
  function showTopBtn(on) { var b = topBtn(); if (b) b.hidden = !on; }
  function hidden() { try { return Date.now() < (+localStorage.getItem(UNTIL_KEY) || 0); } catch (e) { return false; } }
  function hideFor(ms) { try { localStorage.setItem(UNTIL_KEY, String(Date.now() + ms)); } catch (e) {} }
  function remove(id) { var n = document.getElementById(id); if (n) n.remove(); }

  function addStyle() {
    if (document.getElementById("rsi-style")) return;
    var st = document.createElement("style");
    st.id = "rsi-style";
    st.textContent =
      ".rsi{position:fixed;inset-inline:14px;bottom:calc(env(safe-area-inset-bottom,0px) + 16px);z-index:10000;max-width:480px;margin-inline:auto;padding:16px 16px 12px;border-radius:22px;direction:rtl;" +
      "font-family:Cairo,Tahoma,Arial,sans-serif;color:#0f172a;background:linear-gradient(135deg,rgba(255,255,255,.93),rgba(226,234,255,.90));" +
      "-webkit-backdrop-filter:blur(18px) saturate(160%);backdrop-filter:blur(18px) saturate(160%);border:1.5px solid rgba(255,255,255,.8);" +
      "box-shadow:0 20px 50px rgba(30,58,138,.35),0 2px 0 rgba(255,255,255,.7) inset;animation:rsiIn .55s cubic-bezier(.2,.9,.3,1.15) both,rsiGlow 2.8s ease-in-out 1s infinite}" +
      "html.dark .rsi{color:#e8eefc;background:linear-gradient(135deg,rgba(24,32,58,.94),rgba(17,24,45,.92));border-color:rgba(120,150,255,.28)}" +
      "@keyframes rsiIn{from{opacity:0;transform:translateY(46px) scale(.96)}to{opacity:1;transform:none}}" +
      "@keyframes rsiGlow{0%,100%{box-shadow:0 20px 50px rgba(30,58,138,.35),0 2px 0 rgba(255,255,255,.7) inset}50%{box-shadow:0 20px 58px rgba(59,91,219,.55),0 2px 0 rgba(255,255,255,.7) inset}}" +
      ".rsi-row{display:flex;align-items:center;gap:12px}" +
      ".rsi img{flex:none;width:54px;height:54px;border-radius:14px;object-fit:contain;box-shadow:0 4px 12px rgba(15,23,42,.2)}" +
      ".rsi-txt{flex:1;min-width:0;line-height:1.55}.rsi-txt b{display:block;font-size:16.5px;font-weight:900}" +
      ".rsi-txt span{display:block;font-size:13px;font-weight:700;opacity:.78}" +
      ".rsi-act{display:flex;gap:8px;margin-top:12px;align-items:center}" +
      ".rsi-act button{font:inherit;font-size:14.5px;font-weight:800;border:0;border-radius:12px;padding:10px 14px;cursor:pointer}" +
      ".rsi-yes{flex:1;background:linear-gradient(135deg,#1e3a8a,#3b5bdb);color:#fff;box-shadow:0 8px 18px rgba(30,58,138,.4)}" +
      ".rsi-later{background:rgba(15,23,42,.07);color:inherit}html.dark .rsi-later{background:rgba(255,255,255,.1)}" +
      ".rsi-never{background:transparent!important;font-size:12px!important;font-weight:700!important;opacity:.6;padding:4px 6px!important}" +
      ".rsi-steps{margin:10px 0 0;padding:10px 12px;border-radius:14px;background:rgba(30,58,138,.08);font-size:13.5px;line-height:1.9;font-weight:700}" +
      ".rsi-steps svg{vertical-align:-4px;width:20px;height:20px;margin-inline:2px;color:#1e3a8a}html.dark .rsi-steps svg{color:#9db4ff}" +
      "@media (min-width:900px){.rsi{inset-inline:auto;inset-inline-end:24px;margin-inline:0;width:420px}}" +
      "@media (prefers-reduced-motion:reduce){.rsi{animation:none!important}}" +
      "@media (display-mode:standalone){.rsi{display:none!important}}";
    document.head.appendChild(st);
  }

  var SHARE_ICON = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 3v12M8 7l4-4 4 4"/><path d="M5 12v7a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-7"/></svg>';

  function showPopup() {
    if (isStandalone || hidden() || !document.body || document.getElementById("rsi")) return;
    addStyle();
    var d = document.createElement("div");
    d.id = "rsi"; d.className = "rsi"; d.setAttribute("role", "dialog"); d.setAttribute("aria-label", "تثبيت التطبيق");
    d.innerHTML =
      '<div class="rsi-row"><img src="assets/img/icon-192.png" alt="" width="54" height="54">' +
      '<div class="rsi-txt"><b>ثبّت تطبيق رصيد</b><span>افتحه من الشاشة الرئيسية بسرعة، وتصلك تنبيهات الشيكات والأقساط حتى والتطبيق مغلق</span></div></div>' +
      '<div class="rsi-act"><button type="button" class="rsi-yes">تثبيت الآن</button><button type="button" class="rsi-later">لاحقًا</button><button type="button" class="rsi-never">لا تذكرني</button></div>';
    d.querySelector(".rsi-yes").onclick = function () { window.PWA.install(); };
    d.querySelector(".rsi-later").onclick = function () { hideFor(DAY); remove("rsi"); };
    d.querySelector(".rsi-never").onclick = function () { hideFor(30 * DAY); remove("rsi"); };
    document.body.appendChild(d);
  }

  // آيفون: الإرشاد داخل نفس النافذة (لا يوجد مربع تثبيت من النظام)
  function iosSteps() {
    var d = document.getElementById("rsi");
    if (!d) { showPopup(); d = document.getElementById("rsi"); if (!d) return; }
    if (d.querySelector(".rsi-steps")) return;
    var s = document.createElement("div");
    s.className = "rsi-steps";
    s.innerHTML = "١) اضغط زر المشاركة " + SHARE_ICON + " في أسفل Safari.<br>٢) اختر <b>«إضافة إلى الشاشة الرئيسية»</b>.<br>٣) افتح رصيد من الأيقونة الجديدة.";
    d.querySelector(".rsi-row").after(s);
    var yes = d.querySelector(".rsi-yes"); yes.textContent = "حسنًا، فهمت";
    yes.onclick = function () { hideFor(DAY); remove("rsi"); };
  }

  window.addEventListener("beforeinstallprompt", function (e) {
    e.preventDefault();                 // نعرض نافذتنا بدل مربع المتصفح المتكرر
    deferred = e;
    showTopBtn(true);
    setTimeout(showPopup, 1200);
  });
  window.addEventListener("appinstalled", function () {
    deferred = null; showTopBtn(false); remove("rsi");
    try { localStorage.removeItem(UNTIL_KEY); } catch (e) {}
    if (window.UI && UI.toast) UI.toast("تم تثبيت التطبيق ✓");
  });

  window.PWA = {
    isStandalone: function () { return isStandalone; },
    install: function () {
      if (deferred) {
        var p = deferred; deferred = null;
        remove("rsi");
        p.prompt();
        return p.userChoice.then(function (c) { if (!c || c.outcome !== "accepted") hideFor(DAY); showTopBtn(false); }).catch(function () {});
      }
      if (isIOS) iosSteps();
    },
  };

  function onReady() {
    if (isStandalone) { showTopBtn(false); return; }
    if (isIOS) { showTopBtn(true); setTimeout(showPopup, 2200); }   // آيفون: لا يوجد حدث تثبيت
  }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", onReady); else onReady();
})();
