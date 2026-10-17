/**
 * Motion Layer v11 — تفاعلات حركية احترافية
 */
(function () {
  if (window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
    window.Motion = { bind: function () {}, unbind: function () {} };
    return;
  }

  var tiltBound = false;

  function onMove(e) {
    var card = e.currentTarget;
    var r = card.getBoundingClientRect();
    var x = (e.clientX - r.left) / r.width;
    var y = (e.clientY - r.top) / r.height;
    var rx = (0.5 - y) * 8;
    var ry = (x - 0.5) * 10;
    card.style.transform =
      "perspective(900px) rotateX(" + rx + "deg) rotateY(" + ry + "deg) translateY(-4px) scale(1.015)";
    var glare = card.querySelector(".motion-glare");
    if (glare) {
      glare.style.opacity = "0.35";
      glare.style.background =
        "radial-gradient(circle at " + (x * 100) + "% " + (y * 100) + "%, rgba(255,255,255,0.55), transparent 55%)";
    }
  }

  function onLeave(e) {
    var card = e.currentTarget;
    card.style.transform = "";
    var glare = card.querySelector(".motion-glare");
    if (glare) glare.style.opacity = "0";
  }

  function ensureGlare(el) {
    if (el.querySelector(".motion-glare")) return;
    var g = document.createElement("div");
    g.className = "motion-glare";
    el.appendChild(g);
  }

  function bindTilt(root) {
    root = root || document;
    var nodes = root.querySelectorAll(".stat, .kpi, .hero-banner, .invoice-hero");
    nodes.forEach(function (el) {
      if (el.dataset.motionTilt) return;
      el.dataset.motionTilt = "1";
      ensureGlare(el);
      el.addEventListener("mousemove", onMove);
      el.addEventListener("mouseleave", onLeave);
    });
  }

  // أزرار مغناطيسية خفيفة
  function bindMagnetic(root) {
    root = root || document;
    root.querySelectorAll("button.primary").forEach(function (btn) {
      if (btn.dataset.motionMag) return;
      btn.dataset.motionMag = "1";
      btn.addEventListener("mousemove", function (e) {
        var r = btn.getBoundingClientRect();
        var x = e.clientX - r.left - r.width / 2;
        var y = e.clientY - r.top - r.height / 2;
        btn.style.transform = "translate(" + (x * 0.12) + "px, " + (y * 0.12) + "px) scale(1.03)";
      });
      btn.addEventListener("mouseleave", function () {
        btn.style.transform = "";
      });
    });
  }

  // إعادة تشغيل stagger عند تحديث المحتوى
  function restagger(el) {
    if (!el) return;
    el.classList.remove("anim-stagger");
    void el.offsetWidth;
    el.classList.add("anim-stagger");
  }

  // ظهور صفوف الجدول عند الإدراج
  function observeTables(root) {
    root = root || document;
    root.querySelectorAll("table tbody").forEach(function (tb) {
      if (tb.dataset.motionObs) return;
      tb.dataset.motionObs = "1";
      var rows = tb.querySelectorAll("tr");
      rows.forEach(function (tr, i) {
        tr.style.animationDelay = Math.min(i * 0.04, 0.4) + "s";
      });
    });
  }

  function bind(root) {
    bindTilt(root);
    bindMagnetic(root);
    observeTables(root);
  }

  // بعد تحميل الصفحة
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", function () { bind(document); });
  } else {
    setTimeout(function () { bind(document); }, 50);
  }

  // راقب تغييرات DOM للصفحات الديناميكية
  var mo = new MutationObserver(function () {
    bind(document.getElementById("page") || document);
  });
  setTimeout(function () {
    var page = document.getElementById("page") || document.body;
    if (page) mo.observe(page, { childList: true, subtree: true });
  }, 100);

  window.Motion = { bind: bind, restagger: restagger };
})();
