/* مركز التنبيهات — رصيد
   - يحسب التنبيهات المنطقية من بيانات الشركة (شيكات، أقساط، مخزون، عروض، متابعات، ائتمان، نسخ احتياطي)
   - جرس في الشريط العلوي + عدّاد + شارة على أيقونة التطبيق (حيث يدعمها الجهاز)
   - إشعارات نظام التشغيل (على الهاتف عبر الـService Worker) عند فتح التطبيق/العودة إليه
   - Web Push: تسجيل جهاز المستخدم عند الخادم (push_subscribe) فيصله إشعار صباحي حتى والتطبيق مغلق (دالة send-push + pg_cron) */
window.Alerts = (function () {
  var started = false, ctx = null, items = [], uid = "demo", store = null, lastRun = 0, running = false;
  var TYPES = {
    cheque: ["الشيكات", "cheques"], installment: ["الأقساط", "installments"], stock: ["المخزون", "products"], debt: ["ديون العملاء المتأخرة", "aging"],
    quote: ["عروض الأسعار", "quotes"], followup: ["متابعات الزيارات والمكالمات", "field-reports"], credit: ["حد الائتمان", "customers"], backup: ["النسخ الاحتياطي", null],
  };
  var SEV = { danger: 0, warn: 1, info: 2 };
  var N = function (v) { return Number(v) || 0; };
  function esc(s) { return String(s == null ? "" : s).replace(/[&<>"']/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]; }); }
  function money(n) { return window.UI ? UI.money(n) : String(n); }
  function today() { return new Date().toISOString().slice(0, 10); }
  function addDays(iso, n) { var d = new Date(iso + "T12:00:00"); d.setDate(d.getDate() + n); return d.toISOString().slice(0, 10); }
  function daysTo(iso) { return Math.round((new Date(iso + "T12:00:00") - new Date(today() + "T12:00:00")) / 86400000); }

  /* ---------- التخزين المحلي (لكل مستخدم على الجهاز) ---------- */
  function load() {
    try { store = JSON.parse(localStorage.getItem("rasied_alerts_" + uid) || "null"); } catch (e) { store = null; }
    store = store || {};
    store.prefs = store.prefs || {}; store.read = store.read || {}; store.pushed = store.pushed || {};
  }
  function save() {
    var cut = addDays(today(), -10);
    Object.keys(store.read).forEach(function (k) { if (store.read[k] < cut) delete store.read[k]; });
    Object.keys(store.pushed).forEach(function (k) { if (store.pushed[k] < cut) delete store.pushed[k]; });
    try { localStorage.setItem("rasied_alerts_" + uid, JSON.stringify(store)); } catch (e) {}
  }
  function enabled(type) { return store.prefs[type] !== false; }

  /* ---------- حساب التنبيهات ---------- */
  async function list(t) { try { return (await DB.list(t)) || []; } catch (e) { return []; } }
  function can(type) { var k = TYPES[type][1]; return !k || ctx.allowed(k); }

  async function compute() {
    var out = [], t = today(), owner = !ctx.isStaff;
    function add(a) { if (enabled(a.type)) out.push(a); }

    if (can("cheque") && enabled("cheque")) {
      var chq = await list("cheques"), cust = await list("customers"), sup = await list("suppliers");
      var nm = function (c) { var arr = c.dir === "in" ? cust : sup, p = arr.filter(function (x) { return x.id === c.party_id; })[0]; return p ? p.name : ""; };
      chq.filter(function (c) { return c.due_date && (c.dir === "in" ? (c.status === "portfolio" || c.status === "deposited") : c.status === "pending"); }).forEach(function (c) {
        var d = daysTo(c.due_date), bucket = d < 0 ? "late" : d === 0 ? "today" : d <= 3 ? "soon" : "";
        if (!bucket) return;
        var inc = c.dir === "in";
        add({ key: "chq:" + c.id + ":" + bucket, type: "cheque", sev: d < 0 ? "danger" : d === 0 ? "warn" : "info", href: "cheques.html",
          title: (inc ? "شيك وارد " : "شيك صادر ") + (d < 0 ? "متأخر " + (-d) + " يوم" : d === 0 ? "يستحق اليوم" : "يستحق بعد " + d + " يوم"),
          body: (nm(c) || "—") + " — " + money(c.amount) + (c.cheque_no ? " — رقم " + c.cheque_no : "") });
      });
    }

    if (can("installment") && enabled("installment")) {
      var ins = await list("installments"), plans = await list("installment_plans"), pays = await list("payments"), cu = await list("customers");
      var paid = {}; pays.forEach(function (p) { if (p.installment_id) paid[p.installment_id] = (paid[p.installment_id] || 0) + N(p.amount); });
      ins.forEach(function (i) {
        var rem = N(i.amount) - (paid[i.id] || 0);
        if (rem <= 0.004 || !i.due_date) return;
        var d = daysTo(i.due_date), bucket = d < 0 ? "late" : d === 0 ? "today" : d === 1 ? "tomorrow" : "";
        if (!bucket) return;
        var p = plans.filter(function (x) { return x.id === i.plan_id; })[0] || {};
        add({ key: "ins:" + i.id + ":" + bucket, type: "installment", sev: d < 0 ? "danger" : d === 0 ? "warn" : "info", href: "installments.html",
          title: "قسط " + (d < 0 ? "متأخر " + (-d) + " يوم" : d === 0 ? "يستحق اليوم" : "يستحق غدًا"),
          body: (p.party_name || (cu.filter(function (c) { return c.id === i.party_id; })[0] || {}).name || "—") + " — القسط " + i.no + " — " + money(rem) });
      });
    }

    if (can("stock") && enabled("stock")) {
      var pr = await list("products");
      var low = pr.filter(function (p) { return N(p.min_qty) > 0 && N(p.qty) <= N(p.min_qty); });
      if (low.length) {
        var zero = low.filter(function (p) { return N(p.qty) <= 0; }).length;
        add({ key: "stock:" + low.length + ":" + zero, type: "stock", sev: zero ? "danger" : "warn", href: "products.html",
          title: low.length + " صنف وصل لحد الطلب" + (zero ? " (" + zero + " نفد)" : ""),
          body: low.slice(0, 3).map(function (p) { return p.name; }).join("، ") + (low.length > 3 ? " وغيرها" : "") });
      }
    }

    if (can("quote") && enabled("quote")) {
      var qs = (await list("quotes")).filter(function (q) { return (q.status === "draft" || q.status === "sent") && q.valid_until && daysTo(q.valid_until) >= 0 && daysTo(q.valid_until) <= 2; });
      if (qs.length) add({ key: "quote:" + qs.map(function (q) { return q.id; }).sort().join(","), type: "quote", sev: "info", href: "quotes.html",
        title: qs.length + " عرض سعر ينتهي خلال يومين", body: qs.slice(0, 3).map(function (q) { return "#" + q.number + " " + (q.party_name || ""); }).join("، ") });
    }

    if (can("followup") && enabled("followup")) {
      var me = DB.me(), fr = (await list("visit_reports")).filter(function (r) { return r.follow_date && !r.follow_done && r.follow_date <= t && (me.owner || r.by === me.id); });
      if (fr.length) add({ key: "follow:" + fr.length + ":" + t, type: "followup", sev: fr.some(function (r) { return r.follow_date < t; }) ? "warn" : "info", href: "field-reports.html",
        title: fr.length + " متابعة مستحقة", body: fr.slice(0, 3).map(function (r) { return r.party_name || ""; }).join("، ") + (fr.length > 3 ? " وغيرهم" : "") });
    }

    if (can("credit") && enabled("credit")) {
      var over = (await list("customers")).filter(function (c) { return N(c.credit_limit) > 0 && N(c.balance) > N(c.credit_limit); });
      if (over.length) add({ key: "credit:" + over.map(function (c) { return c.id; }).sort().join(","), type: "credit", sev: "warn", href: "customers.html",
        title: over.length + " عميل تجاوز حد الائتمان", body: over.slice(0, 3).map(function (c) { return c.name; }).join("، ") + (over.length > 3 ? " وغيرهم" : "") });
    }

    if (can("debt") && enabled("debt")) {
      try {
        var custs = (await list("customers")).filter(function (c) { return N(c.balance) > 0; });
        if (custs.length && custs.length <= 400 && window.Ledger) {
          var docs = await list("sales"), rets = await list("sale_returns"), pays2 = await list("payments"), txns = await list("party_txns"), lateN = 0, lateSum = 0;
          for (var i = 0; i < custs.length; i++) {
            var st = await Ledger.statement("customer", custs[i].id, null, null, { party: custs[i], docs: docs, rets: rets, pays: pays2, txns: txns });
            var remaining = N(st.closing), old = 0;
            if (remaining <= 0.004) continue;
            var debits = st.rows.filter(function (r) { return r.inc > 0; }).sort(function (a, b) { return a.date < b.date ? 1 : a.date > b.date ? -1 : 0; });
            for (var j = 0; j < debits.length && remaining > 0.004; j++) {
              var take = Math.min(N(debits[j].inc), remaining);
              if (-daysTo(debits[j].date) > 60) old += take;
              remaining -= take;
            }
            if (remaining > 0.004) old += remaining;       // رصيد أقدم من كل الفواتير
            if (old > 0.004) { lateN++; lateSum += old; }
          }
          if (lateN) add({ key: "debt:" + lateN + ":" + Math.round(lateSum), type: "debt", sev: "warn", href: "aging.html", title: lateN + " عميل متأخرون أكثر من 60 يومًا", body: "إجمالي المتأخر " + money(lateSum) });
        }
      } catch (e) {}
    }

    if (owner && enabled("backup")) {
      var last = ""; try { last = localStorage.getItem("rasied_last_backup_" + uid) || ""; } catch (e) {}
      var hasData = (await list("sales")).length + (await list("customers")).length > 5;
      if (hasData && (!last || -daysTo(last) > 30)) add({ key: "backup:" + t.slice(0, 7), type: "backup", sev: "info", href: "settings.html",
        title: "خذ نسخة احتياطية من بياناتك", body: last ? "آخر نسخة منذ " + (-daysTo(last)) + " يوم" : "لم تأخذ نسخة احتياطية من قبل" });
    }

    out.sort(function (a, b) { return SEV[a.sev] - SEV[b.sev]; });
    return out;
  }

  /* ---------- الجرس واللوحة ---------- */
  function unread() { return items.filter(function (a) { return !store.read[a.key]; }); }
  function renderBadge() {
    var n = unread().length, b = document.getElementById("bell-badge"), btn = document.getElementById("bell-btn");
    if (btn) btn.hidden = false;
    if (b) { b.hidden = n === 0; b.textContent = n > 9 ? "9+" : String(n); }
    try { if (navigator.setAppBadge) { if (n) navigator.setAppBadge(n); else navigator.clearAppBadge(); } } catch (e) {}
  }
  function osState() {
    if (!("Notification" in window)) return "unsupported";
    return Notification.permission;      // default | granted | denied
  }
  function renderPanel() {
    var p = document.getElementById("alerts-panel"); if (!p) return;
    var os = osState(), sevCls = { danger: "al-danger", warn: "al-warn", info: "al-info" };
    var settings = p.getAttribute("data-mode") === "settings";
    var head = '<div class="al-head"><b>التنبيهات</b><span class="al-tools">' +
      (items.length ? '<button type="button" class="ghost sm" data-al="readall">تعليم الكل كمقروء</button>' : "") +
      '<button type="button" class="ghost sm" data-al="' + (settings ? "back" : "settings") + '">' + (settings ? "رجوع" : "الإعدادات") + "</button></span></div>";
    var body = "";
    if (settings) {
      body = '<div class="al-set"><p class="muted" style="margin:0 0 8px;font-size:12px">اختر ما تريد أن يُنبّهك التطبيق به:</p>' +
        Object.keys(TYPES).filter(function (k) { return can(k); }).map(function (k) { return '<label class="al-opt"><input type="checkbox" data-pref="' + k + '"' + (enabled(k) ? " checked" : "") + "> " + TYPES[k][0] + "</label>"; }).join("") +
        '<hr style="border:0;border-top:1px solid var(--border);margin:10px 0">' +
        '<label class="al-opt"><input type="checkbox" data-pref="os"' + (store.prefs.os === false ? "" : " checked") + "> إشعارات على الجهاز</label>" + osBlock(os) + "</div>";
    } else {
      body = (os === "default" || os === "unsupported" ? osBlock(os, true) : "") +
        (items.length ? '<div class="al-list">' + items.map(function (a) {
          return '<a class="al-item ' + sevCls[a.sev] + (store.read[a.key] ? " read" : "") + '" href="' + esc(a.href) + '" data-key="' + esc(a.key) + '"><span class="al-dot"></span><span class="al-txt"><b>' + esc(a.title) + "</b><span>" + esc(a.body) + "</span></span></a>";
        }).join("") + "</div>" : '<div class="al-empty">لا توجد تنبيهات الآن 🎉<br><span class="muted" style="font-size:12px">سنُنبّهك بالشيكات والأقساط والمخزون وغيرها عند الحاجة</span></div>');
    }
    p.innerHTML = head + body;
  }
  function osBlock(os, compact) {
    if (os === "granted") {
      var bg = pushSupported() ? (store.push ? "✓ مفعّلة حتى والتطبيق مغلق." : "") : "";
      if (compact) return pushSupported() && !store.push ? '<div class="al-os"><span>فعّل الإشعار والتطبيق مغلق (زي واتساب).</span><button type="button" class="primary sm" data-al="enablepush">تفعيل</button></div>' : "";
      return '<p class="muted" style="margin:6px 0 0;font-size:12px">إشعارات الجهاز مُفعّلة. ' + bg + "</p>" + (pushSupported() && !store.push ? '<button type="button" class="primary sm" data-al="enablepush" style="margin-top:6px">تفعيل الإشعار والتطبيق مغلق</button>' : "");
    }
    if (os === "denied") return '<p class="muted" style="margin:6px 0 0;font-size:12px">الإشعارات محظورة من إعدادات المتصفح/الهاتف لهذا الموقع؛ فعّلها من هناك.</p>';
    if (os === "unsupported") return '<p class="muted al-hint">لتلقّي إشعارات على الآيفون: ثبّت التطبيق أولًا (مشاركة ← إضافة إلى الشاشة الرئيسية) ثم افتحه من الأيقونة.</p>';
    return '<div class="al-os"><span>فعّل الإشعارات على جهازك لتصلك التنبيهات المهمة حتى والتطبيق مغلق.</span><button type="button" class="primary sm" data-al="enable">تفعيل</button></div>';
  }

  /* ---------- Web Push (الإشعار والتطبيق مغلق) ---------- */
  function pushSupported() { return !!(window.DB && !DB.isDemo() && "serviceWorker" in navigator && "PushManager" in window && "Notification" in window); }
  function b64urlToU8(s) {
    var pad = "=".repeat((4 - (s.length % 4)) % 4), raw = atob((s + pad).replace(/-/g, "+").replace(/_/g, "/")), out = new Uint8Array(raw.length);
    for (var i = 0; i < raw.length; i++) out[i] = raw.charCodeAt(i);
    return out;
  }
  function u8ToB64url(buf) {
    var u = new Uint8Array(buf), s = "";
    for (var i = 0; i < u.length; i++) s += String.fromCharCode(u[i]);
    return btoa(s).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
  }
  function prefsForServer() {
    var o = {};
    Object.keys(TYPES).forEach(function (k) { if (store.prefs[k] === false) o[k] = false; });
    if (store.prefs.os === false) o.os = false;
    return o;
  }
  async function pushSubscribe() {
    var kr = await DB.client().rpc("push_public_key");
    if (kr.error || !kr.data) throw new Error("خدمة الإشعارات في الخلفية غير مفعّلة على الخادم");
    var reg = await navigator.serviceWorker.ready, sub = await reg.pushManager.getSubscription();
    if (sub && sub.options && sub.options.applicationServerKey && u8ToB64url(sub.options.applicationServerKey) !== kr.data) { await sub.unsubscribe(); sub = null; }
    if (!sub) sub = await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: b64urlToU8(kr.data) });
    var j = sub.toJSON();
    var r = await DB.client().rpc("push_subscribe", { p_endpoint: j.endpoint, p_p256dh: j.keys.p256dh, p_auth: j.keys.auth, p_ua: navigator.userAgent, p_prefs: prefsForServer() });
    if (r.error) throw new Error(r.error.message);
    store.push = true; store.pushAt = today(); save();
    return sub;
  }
  // مزامنة صامتة: تجدد الاشتراك (قد يتغير عنوانه) وتُحدّث التفضيلات عند الخادم
  async function pushSync(force) {
    if (!pushSupported() || osState() !== "granted") return;
    if (!force && store.pushAt === today()) return;
    try { await pushSubscribe(); } catch (e) { /* يُعاد المحاولة لاحقًا */ }
  }

  /* ---------- إشعارات النظام ---------- */
  async function osNotify(list) {
    if (osState() !== "granted" || store.prefs.os === false) return;
    var t = today(), fresh = list.filter(function (a) { return !store.read[a.key] && store.pushed[a.key] !== t && (a.sev !== "info" || true); });
    if (!fresh.length) return;
    var reg = null;
    try { reg = navigator.serviceWorker && (await navigator.serviceWorker.ready); } catch (e) {}
    var show = function (title, opts) {
      try { if (reg && reg.showNotification) return reg.showNotification(title, opts); new Notification(title, opts); } catch (e) {}
    };
    var base = { icon: "assets/img/icon-192.png", badge: "assets/img/icon-192.png", dir: "rtl", lang: "ar" };
    if (fresh.length <= 3) {
      fresh.forEach(function (a) { show(a.title, Object.assign({ body: a.body, tag: a.key, data: { url: a.href } }, base)); });
    } else {
      show("لديك " + fresh.length + " تنبيهات في رصيد", Object.assign({ body: fresh.slice(0, 3).map(function (a) { return a.title; }).join(" • "), tag: "rasied-summary", data: { url: "index.html" } }, base));
    }
    fresh.forEach(function (a) { store.pushed[a.key] = t; });
    save();
  }

  async function refresh(force) {
    if (!ctx || running) return;
    if (!force && Date.now() - lastRun < 5 * 60 * 1000) return;
    running = true;
    try {
      lastRun = Date.now();
      items = await compute();
      renderBadge();
      var p = document.getElementById("alerts-panel"); if (p && !p.hidden) renderPanel();
      await osNotify(items);
    } catch (e) { /* التنبيهات اختيارية: لا تُظهر أخطاء */ }
    running = false;
  }

  function toggle() {
    var p = document.getElementById("alerts-panel"); if (!p) return;
    p.hidden = !p.hidden;
    if (!p.hidden) { p.removeAttribute("data-mode"); renderPanel(); refresh(true); }
  }

  function onClick(e) {
    var p = document.getElementById("alerts-panel"); if (!p) return;
    var inside = e.target.closest && e.target.closest(".alerts-wrap");
    if (!inside) { p.hidden = true; return; }
    var b = e.target.closest("[data-al]"), a = e.target.closest(".al-item"), pref = e.target.closest("[data-pref]");
    if (b) {
      var act = b.getAttribute("data-al");
      if (act === "settings") { p.setAttribute("data-mode", "settings"); renderPanel(); }
      else if (act === "back") { p.removeAttribute("data-mode"); renderPanel(); }
      else if (act === "readall") { items.forEach(function (x) { store.read[x.key] = today(); }); save(); renderBadge(); renderPanel(); }
      else if (act === "enable" || act === "enablepush") {
        if (!("Notification" in window)) return;
        Promise.resolve(Notification.permission === "granted" ? "granted" : Notification.requestPermission()).then(async function () {
          var granted = Notification.permission === "granted", note = granted ? "تم تفعيل الإشعارات" : "لم يتم تفعيل الإشعارات";
          if (granted && pushSupported()) {
            try { await pushSubscribe(); note = "تم تفعيل الإشعارات — ستصلك حتى والتطبيق مغلق"; }
            catch (e) { note = "الإشعارات تعمل أثناء فتح التطبيق فقط (" + (e.message || "تعذّر التفعيل في الخلفية") + ")"; }
          }
          renderPanel(); osNotify(items);
          if (window.UI) UI.toast(note, !granted);
        });
      }
    } else if (a) {
      store.read[a.getAttribute("data-key")] = today(); save(); renderBadge(); p.hidden = true;
    } else if (pref) {
      var k = pref.getAttribute("data-pref"); store.prefs[k] = pref.checked; save();
      pushSync(true);
      if (k !== "os") refresh(true);
    }
  }

  function init(c) {
    if (started) return;
    started = true; ctx = c;
    try { uid = (c.prof && c.prof.id) || "demo"; } catch (e) {}
    load();
    document.addEventListener("click", onClick);
    document.addEventListener("visibilitychange", function () { if (!document.hidden) refresh(false); });
    window.addEventListener("focus", function () { refresh(false); });
    setInterval(function () { if (!document.hidden) refresh(false); }, 15 * 60 * 1000);
    refresh(true);
    pushSync(false);
  }

  return { init: init, toggle: toggle, refresh: refresh, compute: function () { return compute(); }, _items: function () { return items; } };
})();
