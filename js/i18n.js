/* طبقة ترجمة خفيفة (عربي ⇄ English) — ترجمة وقت التشغيل بقاموس عبارات.
   - اللغة تُحفظ في localStorage (trading_lang). التبديل يعيد تحميل الصفحة.
   - النصوص الديناميكية والنوافذ المطبوعة تُترجم تلقائيًا (MutationObserver + window.open).
   - لإضافة ترجمة: I18n.add({ "العبارة العربية": "English" }) داخل js/i18n-en.js
   - عبارة غير موجودة في القاموس تبقى عربية (لا تتعطل الصفحة). */
(function () {
  var KEY = "trading_lang", lang = "ar";
  try { lang = localStorage.getItem(KEY) === "en" ? "en" : "ar"; } catch (e) {}
  var dict = {}, rx = null, cache = {};
  var AR = /[\u0600-\u06FF]/;
  function esc(s) { return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"); }
  function build() {
    var keys = Object.keys(dict).filter(function (k) { return k.length >= 3; }).sort(function (a, b) { return b.length - a.length; });
    rx = keys.length ? new RegExp("(^|[^\\u0600-\\u06FF])(" + keys.map(esc).join("|") + ")(?![\\u0600-\\u06FF])", "g") : null;
    cache = {};
  }
  // ترجمة مقطع: تطابق كامل، أو استبدال عبارات؛ لو بقي عربي (اسم بيانات غير معروف) يُترك المقطع كما هو بدل خليط «صندوق Purchases»
  function sub(seg) {
    if (!AR.test(seg)) return seg;
    var t = seg.trim();
    if (dict[t] != null) return seg.replace(t, dict[t]);
    if (!rx) build();
    var out = rx ? seg.replace(rx, function (m, pre, key) { return pre + dict[key]; }) : seg;
    return AR.test(out) ? null : out;
  }
  function tr(s) {
    if (lang !== "en" || !s || !AR.test(s)) return s;
    if (cache[s] != null) return cache[s];
    var out = sub(s);
    if (out == null) {
      // نص مختلط (واجهة + اسم بيانات): ترجم كل مقطع على حدة بين الفواصل
      out = s.split(/([:—–·()#\/|،,;\d]+|\s-\s)/).map(function (p, i) { if (i % 2) return p; var r = sub(p); return r == null ? p : r; }).join("");
    }
    out = out.replace(/(^|[^\u0600-\u06FF])من(?=\s+(?:\d|البداية))/g, "$1From").replace(/،/g, ",").replace(/؟/g, "?");
    if (Object.keys(cache).length > 4000) cache = {};
    return (cache[s] = out);
  }
  // مستند HTML كامل (للطباعة): ترجمة + اتجاه LTR
  function doc(h) {
    if (lang !== "en") return h;
    return tr(String(h)).replace(/lang=(["']?)ar\1/g, 'lang="en"').replace(/dir=(["']?)rtl\1/g, 'dir="ltr"').replace(/direction:\s*rtl/g, "direction:ltr");
  }
  var SKIP = { SCRIPT: 1, STYLE: 1, TEXTAREA: 1, CODE: 1 };
  var ATTRS = ["placeholder", "title", "aria-label", "alt"];
  function node(n) {
    if (n.nodeType === 3) {
      var v = n.nodeValue; if (AR.test(v)) { var t = tr(v); if (t !== v) n.nodeValue = t; }
    } else if (n.nodeType === 1 && !SKIP[n.tagName]) {
      ATTRS.forEach(function (a) { var v = n.getAttribute && n.getAttribute(a); if (v && AR.test(v)) { var t = tr(v); if (t !== v) n.setAttribute(a, t); } });
      if (n.tagName === "OPTION" || n.tagName === "BUTTON") { /* نصوصها عقد نصية عادية */ }
      for (var c = n.firstChild; c; c = c.nextSibling) node(c);
    }
  }
  function start() {
    if (lang !== "en") return;
    var de = document.documentElement;
    de.lang = "en"; de.dir = "ltr"; de.classList.add("lang-en");
    node(document.documentElement);
    new MutationObserver(function (list) {
      list.forEach(function (m) {
        if (m.type === "characterData") node(m.target);
        else if (m.type === "attributes") node(m.target);
        else m.addedNodes.forEach(node);
      });
    }).observe(document.documentElement, { childList: true, subtree: true, characterData: true, attributes: true, attributeFilter: ATTRS });
    // النوافذ المطبوعة
    var _open = window.open;
    window.open = function () {
      var w = _open.apply(window, arguments);
      try {
        if (w && w.document) { var dw = w.document.write.bind(w.document); w.document.write = function (h) { return dw(doc(h)); }; }
      } catch (e) {}
      return w;
    };
    // document.title
    document.title = tr(document.title);
  }
  if (lang === "en") { var de0 = document.documentElement; de0.lang = "en"; de0.dir = "ltr"; }
  window.I18n = {
    lang: function () { return lang; },
    isEn: function () { return lang === "en"; },
    add: function (o) { Object.keys(o).forEach(function (k) { dict[k] = o[k]; }); rx = null; cache = {}; },
    t: tr, doc: doc,
    set: function (l) { try { localStorage.setItem(KEY, l === "en" ? "en" : "ar"); } catch (e) {} location.reload(); },
    toggle: function () { window.I18n.set(lang === "en" ? "ar" : "en"); },
  };
  // يبدأ بعد تحميل القاموس (i18n-en.js) وبعد DOMContentLoaded
  var started = false;
  function go() { if (started) return; started = true; start(); }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", go); else go();
  window.addEventListener("load", function () { if (lang === "en") node(document.documentElement); });
})();
