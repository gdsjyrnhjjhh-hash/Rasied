(function () {
  "use strict";

  function html(strings) {
    var vals = Array.prototype.slice.call(arguments, 1);
    var out = "";
    strings.forEach(function (s, i) {
      var v = vals[i];
      out += s + (v == null ? "" : v);
    });
    return out;
  }

  function money(n) {
    if (n == null || isNaN(n)) return "—";
    return Number(n).toLocaleString("ar-EG", { minimumFractionDigits: 0, maximumFractionDigits: 2 });
  }

  function toast(msg, isErr) {
    var d = document.createElement("div");
    d.className = "toast " + (isErr ? "error" : "ok");
    d.textContent = msg;
    document.body.appendChild(d);
    setTimeout(function () { d.classList.add("show"); }, 10);
    setTimeout(function () {
      d.classList.remove("show");
      setTimeout(function () { d.remove(); }, 300);
    }, 2800);
  }


  var NAV_ICONS = {
    dashboard: "◈",
    sales: "◎",
    returns: "↺",
    customers: "☺",
    purchases: "▣",
    "purchase-returns": "↻",
    suppliers: "◆",
    products: "▤",
    warehouses: "⌂",
    stocktake: "☰",
    payments: "₹",
    accounts: "☰",
    journal: "≡",
    expenses: "−",
    reports: "▦",
    settings: "⚙",
    "cash-registers": "₿",
    transfers: "⇄",
    employees: "♟",
    payroll: "₪",
  };

  var NAV = [
    { group: "الرئيسية", items: [{ key: "dashboard", href: "index.html", label: "لوحة التحكم" }] },
    {
      group: "المبيعات",
      items: [
        { key: "sales", href: "sales.html", label: "فواتير البيع" },
        { key: "returns", href: "returns.html", label: "مردودات البيع" },
        { key: "customers", href: "customers.html", label: "العملاء" },
      ],
    },
    {
      group: "المشتريات",
      items: [
        { key: "purchases", href: "purchases.html", label: "فواتير الشراء" },
        { key: "purchase-returns", href: "purchase-returns.html", label: "مردودات الشراء" },
        { key: "suppliers", href: "suppliers.html", label: "الموردين" },
      ],
    },
    {
      group: "المخزون والخزائن",
      items: [
        { key: "products", href: "products.html", label: "الأصناف" },
        { key: "warehouses", href: "warehouses.html", label: "المخازن" },
        { key: "stocktake", href: "stocktake.html", label: "الجرد المخزني" },
        { key: "transfers", href: "transfers.html", label: "تحويلات المخازن" },
        { key: "cash-registers", href: "cash-registers.html", label: "الخزائن" },
      ],
    },
    {
      group: "الموارد البشرية",
      items: [
        { key: "employees", href: "employees.html", label: "الموظفين" },
        { key: "payroll", href: "payroll.html", label: "المرتبات" },
      ],
    },
    {
      group: "المحاسبة",
      items: [
        { key: "payments", href: "payments.html", label: "سندات قبض/صرف" },
        { key: "accounts", href: "accounts.html", label: "دليل الحسابات" },
        { key: "journal", href: "journal.html", label: "قيود اليومية" },
        { key: "expenses", href: "expenses.html", label: "المصروفات" },
      ],
    },
    { group: "التقارير", items: [{ key: "reports", href: "reports.html", label: "التقارير المالية" }] },
    { group: "النظام", items: [{ key: "settings", href: "settings.html", label: "الإعدادات" }] },
  ];

  var TITLES = {
    dashboard: ["لوحة التحكم", "ملخص المبيعات والمشتريات والمخزون"],
    sales: ["فواتير البيع", "إنشاء ومتابعة فواتير العملاء + ضريبة + طباعة"],
    returns: ["مردودات البيع", "إرجاع بضاعة من العملاء"],
    "purchase-returns": ["مردودات الشراء", "إرجاع بضاعة للموردين"],
    purchases: ["فواتير الشراء", "مشتريات من الموردين + ضريبة"],
    customers: ["العملاء", "حسابات العملاء والأرصدة"],
    suppliers: ["الموردين", "حسابات الموردين والأرصدة"],
    products: ["الأصناف", "المخزون والأسعار"],
    warehouses: ["المخازن", "إدارة مواقع التخزين"],
    stocktake: ["الجرد المخزني", "تسوية الكميات الفعلية"],
    transfers: ["تحويلات المخازن", "نقل أصناف بين المخازن"],
    payments: ["سندات قبض وصرف", "تحصيل من العملاء وسداد للموردين"],
    accounts: ["دليل الحسابات", "شجرة الحسابات المحاسبية"],
    journal: ["قيود اليومية", "القيود المحاسبية التلقائية واليدوية"],
    expenses: ["المصروفات", "مصروفات التشغيل"],
    reports: ["التقارير المالية", "ميزان مراجعة · أرباح وخسائر · تصدير"],
    settings: ["الإعدادات", "الشركة · الضريبة · Demo · Cloudflare"],
    "cash-registers": ["الخزائن", "أرصدة النقدية والحركة"],
    employees: ["الموظفين", "بيانات الموظفين والوظائف"],
    payroll: ["المرتبات", "مسير الرواتب والترحيل المحاسبي"],
  };

  function exportCSV(filename, headers, rows) {
    var bom = "\uFEFF";
    var lines = [headers.join(",")];
    rows.forEach(function (r) {
      lines.push(r.map(function (c) {
        var s = c == null ? "" : String(c);
        if (/[",\n]/.test(s)) s = '"' + s.replace(/"/g, '""') + '"';
        return s;
      }).join(","));
    });
    var blob = new Blob([bom + lines.join("\n")], { type: "text/csv;charset=utf-8" });
    var a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = filename;
    a.click();
    URL.revokeObjectURL(a.href);
  }

  function printHTML(title, bodyHtml) {
    var w = window.open("", "_blank", "width=900,height=700");
    if (!w) { toast("اسمح بالنوافذ المنبثقة للطباعة", true); return; }
    w.document.write("<!doctype html><html lang=ar dir=rtl><head><meta charset=utf-8><title>" + title + "</title>");
    w.document.write("<style>");
    w.document.write("body{font-family:Tahoma,Arial,sans-serif;padding:24px;color:#111;font-size:13px}");
    w.document.write("h1{font-size:18px;margin:0 0 4px} h2{font-size:15px;margin:0 0 12px;color:#333}");
    w.document.write("table{width:100%;border-collapse:collapse;margin-top:12px} th,td{border:1px solid #ccc;padding:8px;text-align:right}");
    w.document.write("th{background:#f5f5f5} .meta{display:flex;justify-content:space-between;gap:16px;flex-wrap:wrap;margin:12px 0}");
    w.document.write(".totals{margin-top:16px;width:280px;margin-right:auto} .totals td{border:none;padding:4px 8px}");
    w.document.write(".totals tr:last-child td{font-weight:bold;font-size:15px;border-top:2px solid #111}");
    w.document.write("@media print{button{display:none}}");
    w.document.write("</style></head><body>");
    w.document.write(bodyHtml);
    w.document.write("<p style='margin-top:24px'><button onclick='print()'>طباعة</button></p>");
    w.document.write("</body></html>");
    w.document.close();
  }

  var ACCOUNT_TYPES = [
    { key: "asset", label: "أصول" },
    { key: "liability", label: "خصوم" },
    { key: "equity", label: "حقوق ملكية" },
    { key: "revenue", label: "إيرادات" },
    { key: "expense", label: "مصروفات" },
  ];

  function typeLabel(k) {
    var t = ACCOUNT_TYPES.filter(function (x) { return x.key === k; })[0];
    return t ? t.label : k;
  }

  async function init(active) {
    var app = document.getElementById("app");
    if (!app) return null;
    if (DB.fatal) {
      app.innerHTML = html`<div class="login-wrap"><div class="card error">${DB.fatal}</div></div>`;
      return null;
    }

    // ثيم محفوظ
    try {
      if (localStorage.getItem("trading_theme") === "dark") document.documentElement.classList.add("dark");
      else document.documentElement.classList.remove("dark");
    } catch (e) {}

    var title = TITLES[active] || [active, ""];
    var crumbGroup = "";
    NAV.forEach(function (g) {
      g.items.forEach(function (l) {
        if (l.key === active) crumbGroup = g.group;
      });
    });

    var navHtml = NAV.map(function (g) {
      return html`<div class="nav-group">${g.group}</div>${g.items.map(function (l) {
        var ic = NAV_ICONS[l.key] || "•";
        return html`<a class="nav ${l.key === active ? "active" : ""}" href="${l.href}" data-nav="${l.key}">
          <span class="nav-ic">${ic}</span><span class="nav-label">${l.label}</span>
        </a>`;
      }).join("")}`;
    }).join("");

    var quickLinks = [
      { href: "sales.html", label: "+ فاتورة بيع" },
      { href: "purchases.html", label: "+ فاتورة شراء" },
      { href: "payments.html", label: "سند قبض/صرف" },
      { href: "reports.html", label: "التقارير" },
    ];

    document.documentElement.classList.add("motion-ready");
    app.innerHTML = html`
      <div class="nprogress" id="nprogress"></div>
      <div class="layout" id="layout">
        <aside class="sidebar">
          <div class="brand">
            <div class="brand-icon">🏢</div>
            <div>
              <b>نظام التجارة</b>
              <span>${DB.isDemo() ? "وضع تجريبي" : "متصل"}</span>
            </div>
          </div>
          <div class="sidebar-search-wrap">
            <input class="menu-search" id="menu-search" type="search" placeholder="بحث في القائمة... ⌘K" autocomplete="off" />
          </div>
          <nav class="sidebar-nav" id="sidebar-nav">${navHtml}</nav>
          <div class="sidebar-foot">
            <div class="sidebar-hint">Ctrl + K للبحث السريع</div>
          </div>
        </aside>
        <div class="main">
          <header class="topbar">
            <button class="menu-btn" data-action="toggle-nav" aria-label="القائمة">☰</button>
            <div class="topbar-title">
              <div class="breadcrumb">
                <a href="index.html" class="bc-link">الرئيسية</a>
                ${crumbGroup ? html`<span class="bc-sep">/</span><span class="bc-group">${crumbGroup}</span>` : ""}
                <span class="bc-sep">/</span>
                <span class="bc-current">${title[0]}</span>
              </div>
              <h1>${title[0]}</h1>
              <p class="sub">${title[1]}</p>
            </div>
            <div class="topbar-end">
              <button type="button" class="ghost theme-btn" data-action="toggle-theme" title="ثيم داكن/فاتح">◐</button>
              <button type="button" class="ghost top-search-btn" data-action="focus-search" title="بحث">⌕</button>
              <div class="quick-wrap">
                <button type="button" class="primary small" data-action="toggle-quick">إجراء سريع ▾</button>
                <div class="quick-menu" id="quick-menu" hidden>
                  ${quickLinks.map(function (q) {
                    return html`<a href="${q.href}" class="quick-item">${q.label}</a>`;
                  }).join("")}
                </div>
              </div>
              ${DB.isDemo() ? html`<span class="badge demo">Demo</span>` : html`<span class="badge ok">Live</span>`}
              <span class="muted clock" id="clock"></span>
            </div>
          </header>
          <main class="content anim-stagger" id="page"></main>
        </div>
      </div>
      <div class="cmd-overlay" id="cmd-overlay" hidden>
        <div class="cmd-palette card">
          <input id="cmd-input" type="search" placeholder="اذهب إلى صفحة... (اكتب للبحث)" autocomplete="off" />
          <div id="cmd-results" class="cmd-results"></div>
          <div class="cmd-foot muted">↑↓ للتنقل · Enter للفتح · Esc للإغلاق</div>
        </div>
      </div>`;

    // شريط التقدم عند مغادرة الصفحة
    function startProgress() {
      var bar = document.getElementById("nprogress");
      if (!bar) return;
      bar.classList.add("active");
      bar.style.width = "0%";
      requestAnimationFrame(function () { bar.style.width = "70%"; });
    }
    function pageLeave(href) {
      startProgress();
      var content = document.getElementById("page");
      var main = document.querySelector(".main");
      if (content) content.classList.add("page-leave");
      if (main) main.classList.add("page-leave-soft");
      setTimeout(function () { location.href = href; }, 180);
    }

    // اعتراض روابط التنقل للانتقال السلس
    app.querySelectorAll("a[href]").forEach(function (a) {
      var href = a.getAttribute("href") || "";
      if (!href || href.indexOf("#") === 0 || href.indexOf("http") === 0) return;
      if (!/\.html/.test(href)) return;
      a.addEventListener("click", function (e) {
        if (e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
        e.preventDefault();
        if (a.closest(".sidebar")) {
          document.getElementById("layout").classList.remove("nav-open");
        }
        pageLeave(href);
      });
    });

    // بحث القائمة الجانبية
    var ms = document.getElementById("menu-search");
    if (ms) {
      ms.addEventListener("input", function () {
        var q = ms.value.trim().toLowerCase();
        app.querySelectorAll(".sidebar a.nav").forEach(function (a) {
          var show = !q || a.textContent.toLowerCase().indexOf(q) !== -1;
          a.style.display = show ? "" : "none";
        });
        app.querySelectorAll(".sidebar .nav-group").forEach(function (g) {
          var next = g.nextElementSibling;
          var any = false;
          while (next && next.classList.contains("nav")) {
            if (next.style.display !== "none") any = true;
            next = next.nextElementSibling;
          }
          g.style.display = any || !q ? "" : "none";
        });
      });
    }

    // لوحة الأوامر Ctrl+K
    var allPages = [];
    NAV.forEach(function (g) {
      g.items.forEach(function (l) {
        allPages.push({ key: l.key, href: l.href, label: l.label, group: g.group, icon: NAV_ICONS[l.key] || "•" });
      });
    });

    function openCmd() {
      var ov = document.getElementById("cmd-overlay");
      var inp = document.getElementById("cmd-input");
      ov.hidden = false;
      inp.value = "";
      renderCmd("");
      setTimeout(function () { inp.focus(); }, 30);
    }
    function closeCmd() {
      document.getElementById("cmd-overlay").hidden = true;
    }
    function renderCmd(q) {
      q = (q || "").toLowerCase();
      var list = allPages.filter(function (p) {
        return !q || p.label.toLowerCase().indexOf(q) !== -1 || p.group.toLowerCase().indexOf(q) !== -1;
      });
      var box = document.getElementById("cmd-results");
      box.innerHTML = list.length === 0
        ? "<div class='empty'>لا نتائج</div>"
        : list.map(function (p, i) {
            return "<button type='button' class='cmd-row" + (i === 0 ? " on" : "") + "' data-href='" + p.href + "'>" +
              "<span class='nav-ic'>" + p.icon + "</span><span>" + p.label + "</span>" +
              "<span class='muted cmd-group'>" + p.group + "</span></button>";
          }).join("");
      box.querySelectorAll(".cmd-row").forEach(function (btn) {
        btn.addEventListener("click", function () { pageLeave(btn.getAttribute("data-href")); });
      });
    }
    document.getElementById("cmd-input").addEventListener("input", function (e) {
      renderCmd(e.target.value);
    });
    document.getElementById("cmd-input").addEventListener("keydown", function (e) {
      var rows = Array.prototype.slice.call(document.querySelectorAll(".cmd-row"));
      var idx = rows.findIndex(function (r) { return r.classList.contains("on"); });
      if (e.key === "ArrowDown") {
        e.preventDefault();
        if (idx >= 0) rows[idx].classList.remove("on");
        rows[Math.min(idx + 1, rows.length - 1)].classList.add("on");
      } else if (e.key === "ArrowUp") {
        e.preventDefault();
        if (idx >= 0) rows[idx].classList.remove("on");
        rows[Math.max(idx - 1, 0)].classList.add("on");
      } else if (e.key === "Enter") {
        e.preventDefault();
        var on = document.querySelector(".cmd-row.on");
        if (on) pageLeave(on.getAttribute("data-href"));
      } else if (e.key === "Escape") {
        closeCmd();
      }
    });
    document.getElementById("cmd-overlay").addEventListener("click", function (e) {
      if (e.target.id === "cmd-overlay") closeCmd();
    });

    document.addEventListener("keydown", function (e) {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        openCmd();
      }
      if (e.key === "Escape") {
        closeCmd();
        var qm = document.getElementById("quick-menu");
        if (qm) qm.hidden = true;
      }
    });

    document.addEventListener("click", function (e) {
      var t = e.target.closest("[data-action]");
      if (!t) {
        var qm = document.getElementById("quick-menu");
        if (qm && !e.target.closest(".quick-wrap")) qm.hidden = true;
        return;
      }
      var act = t.getAttribute("data-action");
      if (act === "toggle-nav") {
        document.getElementById("layout").classList.toggle("nav-open");
      } else if (act === "toggle-theme") {
        document.documentElement.classList.toggle("dark");
        try {
          localStorage.setItem("trading_theme", document.documentElement.classList.contains("dark") ? "dark" : "light");
        } catch (e) {}
        UI.toast(document.documentElement.classList.contains("dark") ? "الوضع الداكن" : "الوضع الفاتح");
      } else if (act === "focus-search" || act === "open-cmd") {
        openCmd();
      } else if (act === "toggle-quick") {
        var menu = document.getElementById("quick-menu");
        menu.hidden = !menu.hidden;
      }
    });

    function tick() {
      var el = document.getElementById("clock");
      if (el) el.textContent = new Date().toLocaleString("ar-EG", { dateStyle: "medium", timeStyle: "short" });
    }
    tick();
    setInterval(tick, 30000);

    var pageEl = document.getElementById("page");
    requestAnimationFrame(function () {
      if (!pageEl) return;
      pageEl.classList.remove("anim-stagger");
      void pageEl.offsetWidth;
      pageEl.classList.add("anim-stagger");
    });
    return pageEl;
  }

  window.UI = {
    init: init,
    html: html,
    money: money,
    toast: toast,
    ACCOUNT_TYPES: ACCOUNT_TYPES,
    typeLabel: typeLabel,
    exportCSV: exportCSV,
    printHTML: printHTML,
  };
})();

