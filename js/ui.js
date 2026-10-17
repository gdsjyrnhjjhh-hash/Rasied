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

  // أرقام لاتينية موحّدة في كل النظام (مناسبة للمحاسبة)
  function money(n) {
    if (n == null || isNaN(n)) return "—";
    return Number(n).toLocaleString("en-US", { minimumFractionDigits: 0, maximumFractionDigits: 2 });
  }
  function num(n) {
    return Number(n || 0).toLocaleString("en-US");
  }
  function compact(n) {
    n = Number(n) || 0;
    var a = Math.abs(n);
    if (a >= 1e6) return (n / 1e6).toLocaleString("en-US", { maximumFractionDigits: 1 }) + "M";
    if (a >= 1e3) return (n / 1e3).toLocaleString("en-US", { maximumFractionDigits: 1 }) + "K";
    return n.toLocaleString("en-US", { maximumFractionDigits: 0 });
  }
  function fmtDate(d, opts) {
    return new Date(d).toLocaleDateString("ar-EG-u-nu-latn", opts || { day: "numeric", month: "short" });
  }

  function toast(msg, isErr) {
    var d = document.createElement("div");
    d.className = "toast " + (isErr ? "error" : "ok");
    d.textContent = msg;
    d.setAttribute("role", "status");
    document.body.appendChild(d);
    setTimeout(function () { d.classList.add("show"); }, 10);
    setTimeout(function () {
      d.classList.remove("show");
      setTimeout(function () { d.remove(); }, 300);
    }, 2800);
  }


  function svg(d) {
    return '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' + d + "</svg>";
  }
  var ICON = {
    dashboard: svg('<rect x="3" y="3" width="7" height="9" rx="1.5"/><rect x="14" y="3" width="7" height="5" rx="1.5"/><rect x="14" y="12" width="7" height="9" rx="1.5"/><rect x="3" y="16" width="7" height="5" rx="1.5"/>'),
    sales: svg('<path d="M6 2h12l2 4v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6z"/><path d="M4 6h16"/><path d="M9 10a3 3 0 0 0 6 0"/>'),
    returns: svg('<path d="M3 12a9 9 0 1 0 3-6.7L3 8"/><path d="M3 3v5h5"/>'),
    customers: svg('<path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M22 21v-2a4 4 0 0 0-3-3.9"/><path d="M16 3.1a4 4 0 0 1 0 7.8"/>'),
    purchases: svg('<circle cx="9" cy="21" r="1"/><circle cx="20" cy="21" r="1"/><path d="M1 1h4l2.7 13.4a2 2 0 0 0 2 1.6h9.7a2 2 0 0 0 2-1.6L23 6H6"/>'),
    "purchase-returns": svg('<path d="M21 12a9 9 0 1 1-3-6.7L21 8"/><path d="M21 3v5h-5"/>'),
    suppliers: svg('<path d="M3 21h18"/><path d="M5 21V7l8-4v18"/><path d="M19 21V11l-6-4"/><path d="M9 9v.01M9 12v.01M9 15v.01"/>'),
    products: svg('<path d="M21 16V8a2 2 0 0 0-1-1.7l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.7l7 4a2 2 0 0 0 2 0l7-4a2 2 0 0 0 1-1.7z"/><path d="M3.3 7 12 12l8.7-5"/><path d="M12 22V12"/>'),
    warehouses: svg('<path d="M3 9.5 12 3l9 6.5V21H3z"/><path d="M9 21v-7h6v7"/>'),
    stocktake: svg('<path d="M9 11l3 3 8-8"/><path d="M20 12v7a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V7a2 2 0 0 1 2-2h9"/>'),
    transfers: svg('<path d="M17 3l4 4-4 4"/><path d="M3 7h18"/><path d="M7 21l-4-4 4-4"/><path d="M21 17H3"/>'),
    "cash-registers": svg('<rect x="2" y="6" width="20" height="14" rx="2"/><path d="M2 10h20"/><circle cx="12" cy="15" r="2"/><path d="M6 3h12l1 3H5z"/>'),
    employees: svg('<circle cx="12" cy="8" r="4"/><path d="M4 21a8 8 0 0 1 16 0"/>'),
    payroll: svg('<rect x="2" y="5" width="20" height="14" rx="2"/><circle cx="12" cy="12" r="3"/><path d="M6 9v.01M18 15v.01"/>'),
    payments: svg('<path d="M12 2v20"/><path d="M17 6H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/>'),
    accounts: svg('<path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"/><path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"/><path d="M9 7h7M9 11h7"/>'),
    journal: svg('<path d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8z"/><path d="M14 3v5h5"/><path d="M9 13h6M9 17h6"/>'),
    expenses: svg('<path d="M3 7h18v12a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><path d="M16 3H8L3 7"/><path d="M9 14h6"/>'),
    reports: svg('<path d="M3 3v18h18"/><path d="M7 15l4-4 3 3 5-6"/>'),
    settings: svg('<circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z"/>'),
    building: svg('<rect x="4" y="2" width="16" height="20" rx="2"/><path d="M9 22v-4h6v4"/><path d="M8 6h.01M12 6h.01M16 6h.01M8 10h.01M12 10h.01M16 10h.01M8 14h.01M12 14h.01M16 14h.01"/>'),
    search: svg('<circle cx="11" cy="11" r="7"/><path d="m21 21-4.3-4.3"/>'),
    moon: svg('<path d="M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8z"/>'),
    sun: svg('<circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4"/>'),
    menu: svg('<path d="M3 6h18M3 12h18M3 18h18"/>'),
    chevron: svg('<path d="m15 18-6-6 6-6"/>'),
    plus: svg('<path d="M12 5v14M5 12h14"/>'),
    down: svg('<path d="m6 9 6 6 6-6"/>'),
    trendUp: svg('<path d="m3 17 6-6 4 4 8-8"/><path d="M14 7h7v7"/>'),
    trendDown: svg('<path d="m3 7 6 6 4-4 8 8"/><path d="M14 17h7v-7"/>'),
    wallet: svg('<path d="M20 12V8H6a2 2 0 0 1 0-4h12v4"/><path d="M4 6v12a2 2 0 0 0 2 2h14v-4"/><path d="M18 12a2 2 0 0 0 0 4h4v-4z"/>'),
    alert: svg('<path d="m10.3 3.9-8.5 14.7A2 2 0 0 0 3.5 21.6h17a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0z"/><path d="M12 9v4M12 17h.01"/>'),
    arrowIn: svg('<path d="M12 5v14M5 12l7 7 7-7"/>'),
    arrowOut: svg('<path d="M12 19V5M5 12l7-7 7 7"/>'),
    close: svg('<path d="M18 6 6 18M6 6l12 12"/>'),
    calendar: svg('<rect x="3" y="4" width="18" height="18" rx="2"/><path d="M16 2v4M8 2v4M3 10h18"/>'),
    download: svg('<path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><path d="m7 10 5 5 5-5M12 15V3"/>'),
    admin: svg('<path d="M12 2 4 5v6c0 5 3.4 9.3 8 11 4.6-1.7 8-6 8-11V5z"/><path d="m9 12 2 2 4-4"/>'),
    logout: svg('<path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><path d="m16 17 5-5-5-5M21 12H9"/>'),
    receipt: svg('<path d="M4 2v20l3-2 3 2 3-2 3 2 3-2V2l-3 2-3-2-3 2-3-2z"/><path d="M8 8h8M8 12h8"/>'),
  };
  var NAV_ICONS = ICON;

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
  var NAV_ADMIN = { group: "الإدارة", items: [{ key: "admin", href: "admin.html", label: "إدارة المستخدمين" }] };

  var TITLES = {
    dashboard: ["لوحة التحكم", "ملخص المبيعات والمشتريات والمخزون"],
    admin: ["إدارة المستخدمين", "المسجّلون · الاستخدام · بيانات الشركات · الإيقاف والتفعيل"],
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
    var w = window.open("", "_blank", "width=920,height=760");
    if (!w) { toast("اسمح بالنوافذ المنبثقة للطباعة", true); return; }
    var css = [
      "@page{size:A4;margin:14mm}",
      "*{box-sizing:border-box}",
      "body{font-family:Cairo,Tahoma,Arial,sans-serif;padding:36px;color:#0e1630;font-size:13px;max-width:820px;margin:auto;line-height:1.7;-webkit-print-color-adjust:exact;print-color-adjust:exact}",
      "h1{font-size:22px;margin:0;color:#182763;letter-spacing:-.01em}",
      "h2{font-size:14px;margin:6px 0 16px;color:#fff;background:linear-gradient(135deg,#182763,#2a49d6);display:inline-block;padding:4px 16px;border-radius:999px;font-weight:600}",
      ".meta{display:flex;justify-content:space-between;gap:16px;flex-wrap:wrap;margin:6px 0 18px;padding:14px 18px;background:#f3f5fa;border-radius:12px;border:1px solid #e4e8f0}",
      ".meta>div>div{margin:2px 0;color:#36425f}",
      "table{width:100%;border-collapse:collapse;margin-top:6px}",
      "th{background:#182763;color:#fff;font-weight:600;font-size:12px;padding:10px 12px;text-align:right}",
      "th:first-child{border-radius:0 10px 0 0}th:last-child{border-radius:10px 0 0 0}",
      "td{padding:10px 12px;border-bottom:1px solid #e4e8f0;text-align:right}",
      "tbody tr:nth-child(even) td{background:#f8f9fc}",
      "table.totals{width:300px;margin-right:auto;margin-top:18px;border:1px solid #e4e8f0;border-radius:12px;overflow:hidden}",
      ".totals td{border-bottom:1px solid #eef1f7;background:#fff!important;padding:7px 14px}",
      ".totals td:last-child{font-weight:700}",
      ".totals tr:nth-last-child(3) td{background:#eef3ff!important;color:#182763;font-size:15px;font-weight:700}",
      ".foot{margin-top:34px;padding-top:12px;border-top:1px dashed #cbd3e4;color:#667391;font-size:11.5px;text-align:center}",
      ".actions{margin-top:24px;text-align:center}.actions button{font:inherit;padding:10px 28px;border:0;border-radius:10px;background:#2a49d6;color:#fff;font-weight:600;cursor:pointer}",
      "@media print{.actions{display:none}body{padding:0}}"
    ].join("");
    w.document.write("<!doctype html><html lang=ar dir=rtl><head><meta charset=utf-8><title>" + title + "</title><style>" + css + "</style></head><body>");
    w.document.write(bodyHtml);
    w.document.write("<div class=foot>شكراً لتعاملكم معنا</div>");
    w.document.write("<div class=actions><button onclick='print()'>طباعة</button></div>");
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

    // السحابة: التحقق من الجلسة والملف الشخصي
    var prof = null;
    try { prof = await DB.ready(); } catch (e) {
      app.innerHTML = html`<div class="login-wrap"><div class="card error">تعذّر الاتصال بالخادم: ${e.message || e}</div></div>`;
      return null;
    }
    if (prof && prof.status === "suspended") {
      app.innerHTML = html`<div class="login-wrap"><div class="card suspended-card">
        <div class="susp-ic">${ICON.alert}</div>
        <h2>الحساب موقوف</h2>
        <p class="muted">تم إيقاف هذا الحساب مؤقتاً. لتفعيل النظام تواصل مع الإدارة.</p>
        ${prof.status_note ? html`<div class="susp-note">${prof.status_note}</div>` : ""}
        <button type="button" class="primary" id="susp-out">${ICON.logout}تسجيل الخروج</button>
      </div></div>`;
      document.getElementById("susp-out").onclick = function () { DB.logout(); };
      return null;
    }
    var isAdmin = !!(prof && prof.role === "admin");
    var NAVX = isAdmin ? NAV.concat([NAV_ADMIN]) : NAV;
    if (active === "admin" && !isAdmin) { location.replace("index.html"); return null; }

    // ثيم محفوظ
    try {
      var savedTheme = localStorage.getItem("trading_theme");
      var wantDark = savedTheme ? savedTheme === "dark" : !!(window.matchMedia && matchMedia("(prefers-color-scheme: dark)").matches);
      document.documentElement.classList.toggle("dark", wantDark);
    } catch (e) {}

    var companyBrand = "نظام التجارة";
    var companySub = DB.isDemo() ? "وضع تجريبي" : "متصل";
    try { var co = DB.getCompany(); if (co && co.name) companyBrand = co.name; } catch (e) {}
    if (!DB.isDemo()) companySub = "سحابة · متصل";

    var title = TITLES[active] || [active, ""];
    var crumbGroup = "";
    NAVX.forEach(function (g) {
      g.items.forEach(function (l) {
        if (l.key === active) crumbGroup = g.group;
      });
    });

    var navHtml = NAVX.map(function (g) {
      return html`<div class="nav-group"><span>${g.group}</span></div>${g.items.map(function (l) {
        var ic = NAV_ICONS[l.key] || "•";
        return html`<a class="nav ${l.key === active ? "active" : ""}" href="${l.href}" data-nav="${l.key}" data-label="${l.label}"${l.key === active ? ' aria-current="page"' : ""}>
          <span class="nav-ic">${ic}</span><span class="nav-label">${l.label}</span>
        </a>`;
      }).join("")}`;
    }).join("");

    var quickLinks = [
      { href: "sales.html", label: "فاتورة بيع جديدة", icon: ICON.sales },
      { href: "purchases.html", label: "فاتورة شراء جديدة", icon: ICON.purchases },
      { href: "payments.html", label: "سند قبض / صرف", icon: ICON.payments },
      { href: "products.html", label: "إضافة صنف", icon: ICON.products },
      { href: "reports.html", label: "التقارير المالية", icon: ICON.reports },
    ];

    document.documentElement.classList.add("motion-ready");
    var startCollapsed = false;
    try { startCollapsed = localStorage.getItem("trading_nav_collapsed") === "1"; } catch (e) {}
    app.innerHTML = html`
      <div class="nprogress" id="nprogress"></div>
      <div class="layout${startCollapsed ? " collapsed" : ""}" id="layout">
        <aside class="sidebar">
          <div class="brand">
            <div class="brand-icon">${ICON.building}</div>
            <div class="brand-text">
              <b>${companyBrand}</b>
              <span>${companySub}</span>
            </div>
          </div>
          <div class="sidebar-search-wrap">
            ${ICON.search}
            <input class="menu-search" id="menu-search" type="search" placeholder="بحث في القائمة…" autocomplete="off" />
          </div>
          <nav class="sidebar-nav" id="sidebar-nav">${navHtml}</nav>
          <div class="sidebar-foot">
            <div class="sidebar-ver"><b>نظام ERP</b>الإصدار 19</div>
            <button type="button" class="collapse-btn" data-action="toggle-collapse" title="طيّ القائمة" aria-label="طيّ القائمة">${ICON.chevron}</button>
          </div>
        </aside>
        <div class="main">
          <header class="topbar">
            <button class="menu-btn" data-action="toggle-nav" aria-label="القائمة">${ICON.menu}</button>
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
              <button type="button" class="top-search" data-action="focus-search" title="بحث (Ctrl+K)">${ICON.search}<span>ابحث أو انتقل إلى…</span><span class="kbd">Ctrl K</span></button>
              <button type="button" class="ghost theme-btn" data-action="toggle-theme" title="ثيم داكن/فاتح" id="theme-btn">${ICON.moon}</button>
              <div class="quick-wrap">
                <button type="button" class="primary small" data-action="toggle-quick">${ICON.plus}<span>إجراء سريع</span></button>
                <div class="quick-menu" id="quick-menu" hidden>
                  ${quickLinks.map(function (q) {
                    return html`<a href="${q.href}" class="quick-item">${q.icon}${q.label}</a>`;
                  }).join("")}
                </div>
              </div>
              ${DB.isDemo() ? html`<span class="badge demo">Demo</span>` : html`<span class="badge ok">Live</span>`}
              <div class="muted clock" id="clock"></div>
              <div class="user-chip"><div class="av">${((prof && prof.full_name) || companyBrand || "م").trim().charAt(0)}</div><div class="un">${prof ? prof.full_name : "المدير العام"}<small>${prof ? (isAdmin ? "مدير النظام" : "مستخدم") : "وضع تجريبي"}</small></div></div>
              ${prof ? html`<button type="button" class="ghost" data-action="logout" title="تسجيل الخروج">${ICON.logout}</button>` : ""}
            </div>
          </header>
          <main class="content anim-stagger" id="page"></main>
        </div>
      </div>
      <div class="cmd-overlay" id="cmd-overlay" hidden>
        <div class="cmd-palette card">
          <input id="cmd-input" type="search" placeholder="اذهب إلى صفحة... (اكتب للبحث)" autocomplete="off" />
          <div id="cmd-results" class="cmd-results"></div>
          <div class="cmd-foot muted"><span><span class="kbd">↑</span> <span class="kbd">↓</span> للتنقل</span><span><span class="kbd">Enter</span> للفتح</span><span><span class="kbd">Esc</span> للإغلاق</span></div>
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
    NAVX.forEach(function (g) {
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
      } else if (act === "toggle-collapse") {
        var lay = document.getElementById("layout");
        lay.classList.toggle("collapsed");
        try { localStorage.setItem("trading_nav_collapsed", lay.classList.contains("collapsed") ? "1" : "0"); } catch (e) {}
      } else if (act === "toggle-theme") {
        document.documentElement.classList.toggle("dark");
        syncThemeIcon();
        try {
          localStorage.setItem("trading_theme", document.documentElement.classList.contains("dark") ? "dark" : "light");
        } catch (e) {}
        UI.toast(document.documentElement.classList.contains("dark") ? "الوضع الداكن" : "الوضع الفاتح");
      } else if (act === "focus-search" || act === "open-cmd") {
        openCmd();
      } else if (act === "logout") {
        DB.logout();
      } else if (act === "toggle-quick") {
        var menu = document.getElementById("quick-menu");
        menu.hidden = !menu.hidden;
      }
    });

    function syncThemeIcon() {
      var tb = document.getElementById("theme-btn");
      if (tb) tb.innerHTML = document.documentElement.classList.contains("dark") ? ICON.sun : ICON.moon;
    }
    syncThemeIcon();

    function tick() {
      var el = document.getElementById("clock");
      if (!el) return;
      var now = new Date();
      el.innerHTML = "<b>" + now.toLocaleDateString("ar-EG-u-nu-latn", { weekday: "long", day: "numeric", month: "long" }) + "</b>" +
        now.toLocaleTimeString("ar-EG-u-nu-latn", { hour: "2-digit", minute: "2-digit" });
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
    num: num,
    compact: compact,
    fmtDate: fmtDate,
    toast: toast,
    ACCOUNT_TYPES: ACCOUNT_TYPES,
    typeLabel: typeLabel,
    exportCSV: exportCSV,
    printHTML: printHTML,
    ICON: ICON,
    svg: svg,
  };
})();

