/* PWA: تسجيل الـ Service Worker + عرض رسالة "تثبيت التطبيق" تلقائيًا على الموبايل
   - أندرويد/كروم: لافتة تظهر تلقائيًا → الضغط على «تثبيت» يفتح مربع التثبيت الأصلي.
   - آيفون (Safari): لا توجد رسالة تلقائية في النظام، فتظهر نفس اللافتة بإرشاد «إضافة إلى الشاشة الرئيسية».
   - ديسكتوب: نترك مربع المتصفح الأصلي (أيقونة شريط العنوان) + زر التثبيت في الشريط العلوي. */
(function () {
  "use strict";
  var deferred = null;
  var ua = navigator.userAgent || "";
  var isStandalone = (window.matchMedia && matchMedia("(display-mode: standalone)").matches) || navigator.standalone === true;
  var isIOS = (/iphone|ipad|ipod/i.test(ua) || (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1)) && !window.MSStream;
  var isAndroid = /android/i.test(ua);
  var isMobile = isIOS || isAndroid;
  var DISMISS_KEY = "pwa_banner_dismissed_at";
  var SNOOZE_MS = 7 * 24 * 3600 * 1000;   // بعد «لاحقًا» لا نزعجه أسبوعًا

  if ("serviceWorker" in navigator && (location.protocol === "https:" || location.hostname === "localhost" || location.hostname === "127.0.0.1")) {
    window.addEventListener("load", function () {
      navigator.serviceWorker.register("sw.js").catch(function () {});
    });
  }

  function btn() { return document.getElementById("install-btn"); }
  function showBtn(on) { var b = btn(); if (b) b.hidden = !on; }
  function snoozed() {
    try { return Date.now() - (+localStorage.getItem(DISMISS_KEY) || 0) < SNOOZE_MS; } catch (e) { return false; }
  }
  function removeBanner() { var b = document.getElementById("pwa-banner"); if (b) b.remove(); }

  function showBanner() {
    if (isStandalone || snoozed() || document.getElementById("pwa-banner") || !document.body) return;
    var d = document.createElement("div");
    d.id = "pwa-banner"; d.className = "pwa-banner"; d.setAttribute("role", "dialog"); d.setAttribute("aria-label", "تثبيت التطبيق");
    d.innerHTML =
      '<img src="assets/img/icon-192.png" alt="" width="46" height="46" />' +
      '<div class="pwa-banner-text"><b>تثبيت تطبيق رصيد</b><span>افتحه من الشاشة الرئيسية مثل أي تطبيق</span></div>' +
      '<div class="pwa-banner-actions"><button type="button" class="pwa-yes">تثبيت</button><button type="button" class="pwa-no">لاحقًا</button></div>';
    d.querySelector(".pwa-yes").onclick = function () { window.PWA.install(); };
    d.querySelector(".pwa-no").onclick = function () {
      try { localStorage.setItem(DISMISS_KEY, String(Date.now())); } catch (e) {}
      removeBanner();
    };
    document.body.appendChild(d);
  }

  window.addEventListener("beforeinstallprompt", function (e) {
    deferred = e;
    showBtn(true);
    if (isMobile) {              // موبايل: نعرض لافتتنا تلقائيًا (بديل مربع المتصفح) ونمنع التكرار
      e.preventDefault();
      setTimeout(showBanner, 1200);
    }                            // ديسكتوب: لا نمنع، يظهر مربع المتصفح الأصلي
  });
  window.addEventListener("appinstalled", function () {
    deferred = null; showBtn(false); removeBanner();
    if (window.UI && UI.toast) UI.toast("تم تثبيت التطبيق ✓");
  });

  function iosTip() {
    removeBanner();
    if (document.getElementById("pwa-tip")) return;
    var d = document.createElement("div");
    d.id = "pwa-tip"; d.className = "pwa-tip"; d.setAttribute("role", "dialog");
    d.innerHTML = "<b>تثبيت رصيد على الآيفون</b><p>اضغط زر <span class=\"pwa-share\">المشاركة</span> في أسفل Safari، ثم اختر <b>«إضافة إلى الشاشة الرئيسية»</b>.</p><button type=\"button\">حسنًا</button>";
    d.querySelector("button").onclick = function () { d.remove(); };
    document.body.appendChild(d);
  }

  window.PWA = {
    isStandalone: function () { return isStandalone; },
    install: function () {
      if (deferred) {
        var p = deferred; deferred = null;
        removeBanner();
        p.prompt();
        return p.userChoice.then(function () { showBtn(false); }).catch(function () {});
      }
      if (isIOS) iosTip();
    },
  };

  document.addEventListener("DOMContentLoaded", function () {
    if (isStandalone) { showBtn(false); return; }
    if (isIOS) { showBtn(true); setTimeout(showBanner, 2500); }   // آيفون: لا يوجد حدث تثبيت
  });
})();
