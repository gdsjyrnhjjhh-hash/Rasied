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
    var t = Number(n).toLocaleString("en-US", { minimumFractionDigits: 0, maximumFractionDigits: 2 });
    return t.charAt(0) === "-" ? "\u200E" + t : t;   // LRM: يبقي علامة السالب يسار الرقم داخل RTL
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
    cheques: svg('<rect x="2" y="5" width="20" height="14" rx="2"/><path d="M6 10h8M6 14h5M16 15l2 2 3-4"/>'),
    banks: svg('<path d="M3 10l9-6 9 6"/><path d="M5 10v8M9 10v8M15 10v8M19 10v8M3 20h18"/>'),
    attendance: svg('<rect x="3" y="4" width="18" height="17" rx="2"/><path d="M3 9h18M8 2v4M16 2v4M9 15l2 2 4-4"/>'),
    "sales-sheet": svg('<path d="M4 20V10M10 20V4M16 20v-8M22 20H2"/>'),
    "daily-report": svg('<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>'),
    staff: svg('<circle cx="9" cy="8" r="3.5"/><path d="M2.5 20c.5-3.5 3.2-5.5 6.5-5.5s6 2 6.5 5.5"/><path d="M17 5.5a3 3 0 010 5.5M19 14.8c1.6.8 2.6 2.4 3 5.2"/>'),
    statements: svg('<path d="M6 2h9l5 5v15H6z"/><path d="M14 2v6h6M9 13h8M9 17h8"/>'),
    "party-trial": svg('<path d="M3 3v18h18"/><path d="M7 15l4-4 3 3 5-6"/>'),
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
        { key: "banks", href: "banks.html", label: "البنوك" },
        { key: "cheques", href: "cheques.html", label: "الشيكات" },
      ],
    },
    {
      group: "الموارد البشرية",
      items: [
        { key: "employees", href: "employees.html", label: "الموظفين" },
        { key: "attendance", href: "attendance.html", label: "الحضور والانصراف" },
        { key: "payroll", href: "payroll.html", label: "المرتبات" },
      ],
    },
    {
      group: "المحاسبة",
      items: [
        { key: "payments", href: "payments.html", label: "سندات قبض/صرف" },
        { key: "statements", href: "statements.html", label: "كشوف الحساب" },
        { key: "party-trial", href: "party-trial.html", label: "ميزان العملاء والموردين" },
        { key: "accounts", href: "accounts.html", label: "دليل الحسابات" },
        { key: "journal", href: "journal.html", label: "قيود اليومية" },
        { key: "expenses", href: "expenses.html", label: "المصروفات" },
      ],
    },
    { group: "التقارير", items: [
      { key: "reports", href: "reports.html", label: "التقارير المالية" },
      { key: "sales-sheet", href: "sales-sheet.html", label: "كشف المبيعات" },
      { key: "daily-report", href: "daily-report.html", label: "التقرير اليومي" },
    ] },
    { group: "النظام", items: [
      { key: "staff", href: "staff.html", label: "مستخدمو الشركة" },
      { key: "settings", href: "settings.html", label: "الإعدادات" },
    ] },
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
    "cash-registers": ["الخزائن", "أرصدة · فتح الخزينة · تبويبات"],
    cheques: ["الشيكات", "واردة وصادرة · استحقاق · تحصيل وصرف"],
    banks: ["البنوك", "حسابات بنكية · إيداع وسحب · كشف حساب"],
    attendance: ["الحضور والانصراف", "تسجيل يومي وملخص شهري"],
    "sales-sheet": ["كشف المبيعات", "فواتير الفترة وملخص الأصناف والربح"],
    "daily-report": ["التقرير اليومي", "ملخص حركة يوم واحد"],
    staff: ["مستخدمو الشركة", "إضافة موظفين وتحديد الصفحات المسموحة لكل واحد"],
    statements: ["كشوف الحساب", "عميل / مورد · تحصيل · خصم · تسوية"],
    "party-trial": ["ميزان العملاء والموردين", "أرصدة أول وآخر الفترة وملخص النشاط"],
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

  // ======================================================================
  // الشيل الثابت (القائمة + الشريط العلوي)
  // يُرسم فورًا عند تحميل ui.js من كاش محلي (قبل أي طلب شبكة)،
  // ثم يُطابَق بصمت مع الجلسة الفعلية دون إعادة بناء الصفحة — فلا وميض ولا اختفاء.
  // ======================================================================
  var SHELL_KEY = "trading_shell_v1";
  var NAVSCROLL_KEY = "trading_nav_scroll";
  var shell = null; // { active, title, ctx, brand, sub, demo, pages, bound }

  // صفحات لها مفتاح قائمة/عنوان مختلف عن اسم الصفحة
  var PAGE_BOOT = {
    treasury: { active: "cash-registers", title: ["الخزينة", "حركات · تحويل · جرد النقدية"] },
    banks: { title: ["البنوك", "حسابات · حركات · تحويل · ربط الشيكات"] },
    cheques: { title: ["الشيكات", "واردة وصادرة · استحقاق · تحصيل وصرف"] },
  };
  var INVOICE_KINDS = {
    sale: { page: "sales", title: ["فاتورة بيع جديدة", "فواتير البيع"] },
    purchase: { page: "purchases", title: ["فاتورة شراء جديدة", "فواتير الشراء"] },
    sale_return: { page: "returns", title: ["مرتجع بيع جديد", "مردودات البيع"] },
    purchase_return: { page: "purchase-returns", title: ["مرتجع شراء جديد", "مردودات الشراء"] },
  };

  function readShellCache() {
    try { return JSON.parse(localStorage.getItem(SHELL_KEY) || "null"); } catch (e) { return null; }
  }
  function writeShellCache(o) {
    try { localStorage.setItem(SHELL_KEY, JSON.stringify(o)); } catch (e) {}
  }
  function clearShellCache() {
    try { localStorage.removeItem(SHELL_KEY); sessionStorage.removeItem(NAVSCROLL_KEY); } catch (e) {}
  }

  function isDemoMode() {
    var cfg = window.APP_CONFIG || {};
    return !(cfg.SUPABASE_URL && cfg.SUPABASE_ANON_KEY);
  }

  // يبني سياق الصلاحيات والقائمة من الملف الشخصي (حقيقي أو من الكاش)
  function buildCtx(prof, pending) {
    var isAdmin = !!(prof && prof.role === "admin");
    var isStaff = !!(prof && prof.company_role === "staff");
    var perms = (prof && Array.isArray(prof.permissions)) ? prof.permissions : [];
    var navx = isAdmin ? NAV.concat([NAV_ADMIN]) : NAV;
    function allowed(key) {
      return !isStaff || key === "dashboard" || (key !== "settings" && key !== "staff" && perms.indexOf(key) !== -1);
    }
    if (isStaff) {
      navx = navx.map(function (g) { return { group: g.group, items: g.items.filter(function (it) { return allowed(it.key); }) }; })
        .filter(function (g) { return g.items.length; });
    }
    return { prof: prof || null, pending: !!pending, isAdmin: isAdmin, isStaff: isStaff, navx: navx, allowed: allowed };
  }

  function navHtmlFor(ctx, active) {
    if (ctx.pending) {
      var sk = "";
      for (var i = 0; i < 9; i++) sk += '<div class="skel nav-skel"></div>';
      return sk;
    }
    return ctx.navx.map(function (g) {
      return html`<div class="nav-group"><span>${g.group}</span></div>${g.items.map(function (l) {
        var ic = NAV_ICONS[l.key] || "•";
        return html`<a class="nav ${l.key === active ? "active" : ""}" href="${l.href}" data-nav="${l.key}" data-label="${l.label}"${l.key === active ? ' aria-current="page"' : ""}>
          <span class="nav-ic">${ic}</span><span class="nav-label">${l.label}</span>
        </a>`;
      }).join("")}`;
    }).join("");
  }

  function crumbHtmlFor(ctx, active, title) {
    var grp = "";
    ctx.navx.forEach(function (g) { g.items.forEach(function (l) { if (l.key === active) grp = g.group; }); });
    return html`<a href="index.html" class="bc-link">الرئيسية</a>${grp ? html`<span class="bc-sep">/</span><span class="bc-group">${grp}</span>` : ""}<span class="bc-sep">/</span><span class="bc-current">${title[0]}</span>`;
  }

  function userSlotHtml(ctx, brand, demo) {
    var prof = ctx.prof;
    var name = prof ? prof.full_name : (ctx.pending ? "" : "المدير العام");
    var role = prof ? (ctx.isAdmin ? "مدير النظام" : "مستخدم") : (ctx.pending ? "" : "وضع تجريبي");
    var letter = ((name || brand || "م") + "").trim().charAt(0);
    return html`${demo ? html`<span class="badge demo">Demo</span>` : html`<span class="badge ok">Live</span>`}
      <div class="muted clock" id="clock"></div>
      <div class="user-chip"><div class="av">${letter}</div><div class="un">${name}<small>${role}</small></div></div>
      ${prof ? html`<button type="button" class="ghost" data-action="logout" title="تسجيل الخروج">${ICON.logout}</button>` : ""}`;
  }

  function buildPages(ctx) {
    var out = [];
    ctx.navx.forEach(function (g) {
      g.items.forEach(function (l) {
        out.push({ key: l.key, href: l.href, label: l.label, group: g.group, icon: NAV_ICONS[l.key] || "•" });
      });
    });
    return out;
  }

  var QUICK_LINKS = [
    { href: "sales.html", label: "فاتورة بيع جديدة", icon: ICON.sales },
    { href: "purchases.html", label: "فاتورة شراء جديدة", icon: ICON.purchases },
    { href: "payments.html", label: "سند قبض / صرف", icon: ICON.payments },
    { href: "products.html", label: "إضافة صنف", icon: ICON.products },
    { href: "reports.html", label: "التقارير المالية", icon: ICON.reports },
  ];

  function saveNavScroll() {
    try {
      var nav = document.getElementById("sidebar-nav");
      if (nav) sessionStorage.setItem(NAVSCROLL_KEY, String(nav.scrollTop));
    } catch (e) {}
  }
  function restoreNavScroll() {
    var nav = document.getElementById("sidebar-nav");
    if (!nav) return;
    var saved = null;
    try { saved = sessionStorage.getItem(NAVSCROLL_KEY); } catch (e) {}
    if (saved != null && saved !== "") {
      nav.scrollTop = parseInt(saved, 10) || 0;
    } else {
      var act = nav.querySelector("a.nav.active");
      if (act) nav.scrollTop = Math.max(0, act.offsetTop - nav.clientHeight / 2);
    }
  }

  function applyTheme() {
    try {
      var savedTheme = localStorage.getItem("trading_theme");
      var wantDark = savedTheme ? savedTheme === "dark" : !!(window.matchMedia && matchMedia("(prefers-color-scheme: dark)").matches);
      document.documentElement.classList.toggle("dark", wantDark);
    } catch (e) {}
  }

  function renderShell(active, title, ctx, brand, sub, demo) {
    var app = document.getElementById("app");
    var startCollapsed = false;
    try { startCollapsed = localStorage.getItem("trading_nav_collapsed") === "1"; } catch (e) {}
    applyTheme();
    document.documentElement.classList.add("motion-ready");

    app.innerHTML = html`
      <div class="nprogress" id="nprogress"></div>
      <div class="layout${startCollapsed ? " collapsed" : ""}" id="layout">
        <aside class="sidebar">
          <div class="brand">
            <div class="brand-icon">${ICON.building}</div>
            <div class="brand-text" id="brand-text">
              <b>${brand}</b>
              <span>${sub}</span>
            </div>
          </div>
          <div class="sidebar-search-wrap">
            ${ICON.search}
            <input class="menu-search" id="menu-search" type="search" placeholder="بحث في القائمة…" autocomplete="off" />
          </div>
          <nav class="sidebar-nav" id="sidebar-nav">${navHtmlFor(ctx, active)}</nav>
          <div class="sidebar-foot">
            <div class="sidebar-ver"><b>نظام ERP</b>الإصدار 24</div>
            <button type="button" class="collapse-btn" data-action="toggle-collapse" title="طيّ القائمة" aria-label="طيّ القائمة">${ICON.chevron}</button>
          </div>
        </aside>
        <div class="main">
          <header class="topbar">
            <button class="menu-btn" data-action="toggle-nav" aria-label="القائمة">${ICON.menu}</button>
            <div class="topbar-title">
              <div class="breadcrumb" id="breadcrumb">${crumbHtmlFor(ctx, active, title)}</div>
              <h1 id="page-h1">${title[0]}</h1>
              <p class="sub" id="page-sub">${title[1]}</p>
            </div>
            <div class="topbar-end">
              <button type="button" class="top-search" data-action="focus-search" title="بحث (Ctrl+K)">${ICON.search}<span>ابحث أو انتقل إلى…</span><span class="kbd">Ctrl K</span></button>
              <button type="button" class="ghost install-btn" data-action="install-app" id="install-btn" title="تثبيت التطبيق على جهازك" aria-label="تثبيت التطبيق" hidden>${ICON.download}</button>
              <button type="button" class="ghost theme-btn" data-action="toggle-theme" title="ثيم داكن/فاتح" id="theme-btn">${ICON.moon}</button>
              <div class="quick-wrap">
                <button type="button" class="primary small" data-action="toggle-quick">${ICON.plus}<span>إجراء سريع</span></button>
                <div class="quick-menu" id="quick-menu" hidden>
                  ${QUICK_LINKS.map(function (q) {
                    return html`<a href="${q.href}" class="quick-item">${q.icon}${q.label}</a>`;
                  }).join("")}
                </div>
              </div>
              <div class="user-slot" id="user-slot">${userSlotHtml(ctx, brand, demo)}</div>
            </div>
          </header>
          <main class="content" id="page"><div class="page-skel" aria-hidden="true"><div class="skel" style="height:34px;width:220px"></div><div class="skel" style="height:96px;margin-top:18px"></div><div class="skel" style="height:260px;margin-top:14px"></div></div></main>
        </div>
      </div>
      <div class="cmd-overlay" id="cmd-overlay" hidden>
        <div class="cmd-palette card">
          <input id="cmd-input" type="search" placeholder="اذهب إلى صفحة... (اكتب للبحث)" autocomplete="off" />
          <div id="cmd-results" class="cmd-results"></div>
          <div class="cmd-foot muted"><span><span class="kbd">↑</span> <span class="kbd">↓</span> للتنقل</span><span><span class="kbd">Enter</span> للفتح</span><span><span class="kbd">Esc</span> للإغلاق</span></div>
        </div>
      </div>`;

    shell = { active: active, title: title, ctx: ctx, brand: brand, sub: sub, demo: demo, pages: buildPages(ctx), bound: false };
    syncThemeIcon();
    tickClock();
    restoreNavScroll();
    bindShell();
  }

  function syncThemeIcon() {
    var tb = document.getElementById("theme-btn");
    if (tb) tb.innerHTML = document.documentElement.classList.contains("dark") ? ICON.sun : ICON.moon;
  }
  function tickClock() {
    var el = document.getElementById("clock");
    if (!el) return;
    var now = new Date();
    el.innerHTML = "<b>" + now.toLocaleDateString("ar-EG-u-nu-latn", { weekday: "long", day: "numeric", month: "long" }) + "</b>" +
      now.toLocaleTimeString("ar-EG-u-nu-latn", { hour: "2-digit", minute: "2-digit" });
  }

  // مطابقة الشيل مع الجلسة الفعلية: يحدّث الأجزاء المتغيرة فقط (القائمة/الاسم/الشركة) ولا يمسّ الباقي
  function reconcileShell(ctx, brand, sub, demo) {
    if (!shell) return;
    var navSig = function (c) { return JSON.stringify([c.pending, c.navx.map(function (g) { return g.items.map(function (i) { return i.key; }); })]); };
    var nav = document.getElementById("sidebar-nav");
    if (nav && navSig(shell.ctx) !== navSig(ctx)) {
      var st = nav.scrollTop;
      nav.innerHTML = navHtmlFor(ctx, shell.active);
      nav.scrollTop = st;
      var crumb = document.getElementById("breadcrumb");
      if (crumb) crumb.innerHTML = crumbHtmlFor(ctx, shell.active, shell.title);
      var q = document.getElementById("menu-search");
      if (q && q.value) q.dispatchEvent(new Event("input"));
    }
    var bt = document.getElementById("brand-text");
    if (bt && (shell.brand !== brand || shell.sub !== sub)) bt.innerHTML = "<b>" + brand + "</b><span>" + sub + "</span>";
    var us = document.getElementById("user-slot");
    var uSig = function (c, b) { return JSON.stringify([c.pending, c.prof && c.prof.full_name, c.isAdmin, !!c.prof, b]); };
    if (us && uSig(shell.ctx, shell.brand) !== uSig(ctx, brand)) {
      us.innerHTML = userSlotHtml(ctx, brand, demo);
      tickClock();
    }
    shell.ctx = ctx; shell.brand = brand; shell.sub = sub; shell.demo = demo; shell.pages = buildPages(ctx);
  }

  function setPageTitle(title) {
    if (!shell || (shell.title[0] === title[0] && shell.title[1] === title[1])) return;
    shell.title = title;
    var h = document.getElementById("page-h1"), s = document.getElementById("page-sub"), bc = document.getElementById("breadcrumb");
    if (h) h.textContent = title[0];
    if (s) s.textContent = title[1];
    if (bc) bc.innerHTML = crumbHtmlFor(shell.ctx, shell.active, title);
  }

  // ---- ربط الأحداث (مرة واحدة فقط) ----
  function startProgress() {
    var bar = document.getElementById("nprogress");
    if (!bar) return;
    bar.classList.add("active");
    bar.style.width = "0%";
    requestAnimationFrame(function () { bar.style.width = "70%"; });
  }
  function endProgress() {
    var bar = document.getElementById("nprogress");
    if (!bar) return;
    bar.style.width = "100%";
    setTimeout(function () {
      bar.classList.remove("active");
      bar.style.width = "0%";
    }, 200);
  }

  // ======================================================================
  // تنقل SPA: القائمة الجانبية والشريط العلوي يبقيان ثابتين — لا اختفاء ولا وميض
  // ======================================================================
  var PAGE_SCRIPTS = {
    dashboard: "js/pages/dashboard.js",
    admin: "js/pages/admin.js",
    sales: "js/pages/sales.js",
    returns: "js/pages/returns.js",
    "purchase-returns": "js/pages/purchase-returns.js",
    purchases: "js/pages/purchases.js",
    customers: "js/pages/customers.js",
    suppliers: "js/pages/suppliers.js",
    products: "js/pages/products.js",
    warehouses: "js/pages/warehouses.js",
    stocktake: "js/pages/stocktake.js",
    transfers: "js/pages/transfers.js",
    payments: "js/pages/payments.js",
    accounts: "js/pages/accounts.js",
    journal: "js/pages/journal.js",
    expenses: "js/pages/expenses.js",
    reports: "js/pages/reports.js",
    settings: "js/pages/settings.js",
    "cash-registers": "js/pages/cash-registers.js",
    treasury: "js/pages/treasury.js",
    cheques: "js/pages/cheques.js",
    banks: "js/pages/banks.js",
    attendance: "js/pages/attendance.js",
    "sales-sheet": "js/pages/sales-sheet.js",
    "daily-report": "js/pages/daily-report.js",
    staff: "js/pages/staff.js",
    statements: "js/pages/statements.js",
    "party-trial": "js/pages/party-trial.js",
    employees: "js/pages/employees.js",
    payroll: "js/pages/payroll.js",
    invoice: "js/pages/invoice-entry.js",
  };
  var pageScriptCache = {};
  var spaNavigating = false;
  var spaVersion = 0;

  function hrefToPageKey(href) {
    try {
      var u = new URL(href, location.href);
      var file = (u.pathname.split("/").pop() || "index.html").replace(/\.html$/i, "");
      if (file === "index" || file === "") return "dashboard";
      return file;
    } catch (e) {
      return null;
    }
  }

  function isSpaHref(href) {
    if (!href || href.charAt(0) === "#" || href.indexOf("http") === 0) return false;
    if (!/\.html/i.test(href)) return false;
    var key = hrefToPageKey(href);
    if (!key) return false;
    // login / offline تبقى تحميلاً كاملاً
    if (key === "login" || key === "offline") return false;
    return !!PAGE_SCRIPTS[key] || key === "dashboard";
  }

  function setActiveNav(active) {
    if (!shell) return;
    shell.active = active;
    var nav = document.getElementById("sidebar-nav");
    if (nav) {
      nav.querySelectorAll("a.nav").forEach(function (a) {
        var on = a.getAttribute("data-nav") === active;
        a.classList.toggle("active", on);
        if (on) a.setAttribute("aria-current", "page");
        else a.removeAttribute("aria-current");
      });
    }
  }

  function applyPageChrome(key, search) {
    var override = PAGE_BOOT[key] || {};
    var active = override.active || key;
    var title = override.title;
    if (key === "invoice") {
      var kindParam = null;
      try { kindParam = new URLSearchParams(search || "").get("kind"); } catch (e) {}
      var k = INVOICE_KINDS[kindParam] || INVOICE_KINDS.sale;
      active = k.page;
      title = k.title;
    }
    title = title || TITLES[active] || TITLES[key] || [key, ""];
    setActiveNav(active);
    setPageTitle(title);
    if (document.body) document.body.setAttribute("data-page", key);
    document.title = title[0] + " · رصيد";
  }

  async function runPageScript(src) {
    var code = pageScriptCache[src];
    if (!code) {
      var res = await fetch(src + (src.indexOf("?") >= 0 ? "&" : "?") + "v=24");
      if (!res.ok) throw new Error("تعذّر تحميل الصفحة (" + res.status + ")");
      code = await res.text();
      pageScriptCache[src] = code;
    }
    // إعادة تنفيذ الـ IIFE في كل زيارة للصفحة
    (0, eval)(code);
  }

  async function spaLoad(href, opts) {
    opts = opts || {};
    var key = hrefToPageKey(href);
    if (!key || !PAGE_SCRIPTS[key]) {
      location.href = href;
      return;
    }
    var myVer = ++spaVersion;
    spaNavigating = true;
    saveNavScroll();
    startProgress();
    closeCmd();
    var qm = document.getElementById("quick-menu");
    if (qm) qm.hidden = true;
    var lay = document.getElementById("layout");
    if (lay) lay.classList.remove("nav-open");

    var search = "";
    try { search = new URL(href, location.href).search; } catch (e) {}

    applyPageChrome(key, search);

    var pageEl = document.getElementById("page");
    if (pageEl) {
      pageEl.innerHTML = '<div class="page-skel" aria-hidden="true"><div class="skel" style="height:34px;width:220px"></div><div class="skel" style="height:96px;margin-top:18px"></div><div class="skel" style="height:260px;margin-top:14px"></div></div>';
      pageEl.classList.remove("anim-stagger");
      void pageEl.offsetWidth;
      pageEl.classList.add("anim-stagger");
    }

    // تمرير المحتوى لأعلى عند التنقل
    var main = document.querySelector(".main");
    if (main) main.scrollTop = 0;
    window.scrollTo(0, 0);

    if (!opts.replace && !opts.pop) {
      try {
        history.pushState({ spa: true, page: key }, "", href);
      } catch (e) {}
    } else if (opts.replace) {
      try {
        history.replaceState({ spa: true, page: key }, "", href);
      } catch (e) {}
    }

    try {
      await runPageScript(PAGE_SCRIPTS[key]);
    } catch (err) {
      if (myVer !== spaVersion) return;
      if (pageEl) {
        pageEl.innerHTML = '<div class="card error" style="padding:24px">تعذّر فتح الصفحة: ' +
          (err && err.message ? err.message : String(err)) +
          ' <button type="button" class="primary small" onclick="location.reload()">إعادة المحاولة</button></div>';
      }
    }
    if (myVer === spaVersion) endProgress();
    spaNavigating = false;
  }

  function go(href) {
    if (!href) return;
    // روابط كاملة أو login → تحميل كامل
    if (!isSpaHref(href)) {
      saveNavScroll();
      startProgress();
      location.href = href;
      return;
    }
    // نفس الصفحة بدون تغيير استعلام → لا شيء
    try {
      var next = new URL(href, location.href);
      if (next.pathname === location.pathname && next.search === location.search) {
        closeCmd();
        return;
      }
    } catch (e) {}
    spaLoad(href);
  }

  function openCmd() {
    var ov = document.getElementById("cmd-overlay");
    var inp = document.getElementById("cmd-input");
    if (!ov || !inp) return;
    ov.hidden = false;
    inp.value = "";
    renderCmd("");
    setTimeout(function () { inp.focus(); }, 30);
  }
  function closeCmd() {
    var ov = document.getElementById("cmd-overlay");
    if (ov) ov.hidden = true;
  }
  function renderCmd(q) {
    q = (q || "").toLowerCase();
    var list = (shell ? shell.pages : []).filter(function (p) {
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
      btn.addEventListener("click", function () { go(btn.getAttribute("data-href")); });
    });
  }

  function bindShell() {
    if (!shell || shell.bound) return;
    shell.bound = true;

    // بحث القائمة الجانبية
    var ms = document.getElementById("menu-search");
    if (ms) {
      ms.addEventListener("input", function () {
        var q = ms.value.trim().toLowerCase();
        var app = document.getElementById("app");
        app.querySelectorAll(".sidebar a.nav").forEach(function (a) {
          a.style.display = !q || a.textContent.toLowerCase().indexOf(q) !== -1 ? "" : "none";
        });
        app.querySelectorAll(".sidebar .nav-group").forEach(function (g) {
          var next = g.nextElementSibling, any = false;
          while (next && next.classList.contains("nav")) {
            if (next.style.display !== "none") any = true;
            next = next.nextElementSibling;
          }
          g.style.display = any || !q ? "" : "none";
        });
      });
    }

    var ci = document.getElementById("cmd-input");
    ci.addEventListener("input", function (e) { renderCmd(e.target.value); });
    ci.addEventListener("keydown", function (e) {
      var rows = Array.prototype.slice.call(document.querySelectorAll(".cmd-row"));
      var idx = rows.findIndex(function (r) { return r.classList.contains("on"); });
      if (e.key === "ArrowDown") {
        e.preventDefault();
        if (!rows.length) return;
        if (idx >= 0) rows[idx].classList.remove("on");
        rows[Math.min(idx + 1, rows.length - 1)].classList.add("on");
      } else if (e.key === "ArrowUp") {
        e.preventDefault();
        if (!rows.length) return;
        if (idx >= 0) rows[idx].classList.remove("on");
        rows[Math.max(idx - 1, 0)].classList.add("on");
      } else if (e.key === "Enter") {
        e.preventDefault();
        var on = document.querySelector(".cmd-row.on");
        if (on) go(on.getAttribute("data-href"));
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
      // تنقل SPA: القائمة تبقى ثابتة، يُحدَّث محتوى الصفحة فقط
      var a = e.target.closest && e.target.closest("a[href]");
      if (a && !e.defaultPrevented && !(e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) && e.button === 0) {
        var href = a.getAttribute("href") || "";
        if (isSpaHref(href) && !a.target) {
          e.preventDefault();
          go(href);
          return;
        }
        if (href && href.charAt(0) !== "#" && href.indexOf("http") !== 0 && /\.html/.test(href) && !a.target) {
          saveNavScroll();
          startProgress();
          if (a.closest(".sidebar")) {
            var lay = document.getElementById("layout");
            if (lay) lay.classList.remove("nav-open");
          }
        }
      }

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
        var lay2 = document.getElementById("layout");
        lay2.classList.toggle("collapsed");
        try { localStorage.setItem("trading_nav_collapsed", lay2.classList.contains("collapsed") ? "1" : "0"); } catch (er) {}
      } else if (act === "toggle-theme") {
        document.documentElement.classList.toggle("dark");
        syncThemeIcon();
        try { localStorage.setItem("trading_theme", document.documentElement.classList.contains("dark") ? "dark" : "light"); } catch (er) {}
        UI.toast(document.documentElement.classList.contains("dark") ? "الوضع الداكن" : "الوضع الفاتح");
      } else if (act === "focus-search" || act === "open-cmd") {
        openCmd();
      } else if (act === "install-app") {
        if (window.PWA) PWA.install();
      } else if (act === "logout") {
        DB.logout();
      } else if (act === "toggle-quick") {
        var menu = document.getElementById("quick-menu");
        menu.hidden = !menu.hidden;
      }
    });

    setInterval(tickClock, 30000);
    window.addEventListener("pagehide", saveNavScroll);
    // العودة بزر "رجوع" (bfcache): أعد شريط التقدم لوضعه
    window.addEventListener("pageshow", function (e) {
      if (!e.persisted) return;
      var bar = document.getElementById("nprogress");
      if (bar) { bar.classList.remove("active"); bar.style.width = "0%"; }
    });

    // أزرار المتصفح رجوع/تقدم — تحميل الصفحة داخل الشيل الثابت
    window.addEventListener("popstate", function () {
      if (!shell) return;
      var href = location.pathname.split("/").pop() || "index.html";
      if (location.search) href += location.search;
      if (isSpaHref(href) || isSpaHref(location.href)) {
        spaLoad(href, { pop: true });
      }
    });

    // تعليم الحالة الحالية كـ SPA حتى يعمل الرجوع بشكل صحيح
    try {
      var curKey = (document.body && document.body.getAttribute("data-page")) || "dashboard";
      history.replaceState({ spa: true, page: curKey }, "", location.href);
    } catch (e) {}
  }

  // يُستدعى تلقائيًا فور تحميل ui.js (قبل DB وباقي السكربتات الثقيلة) لإظهار الشيل في أول رسم
  function boot() {
    var app = document.getElementById("app");
    var key = document.body && document.body.getAttribute("data-page");
    if (!app || !key || shell) return;
    var override = PAGE_BOOT[key] || {};
    var title = override.title;
    var active = override.active || key;
    if (key === "invoice") {
      var k = INVOICE_KINDS[new URLSearchParams(location.search).get("kind")] || INVOICE_KINDS.sale;
      active = k.page; title = k.title;
    }
    title = title || TITLES[active] || [active, ""];

    var demo = isDemoMode();
    var cache = demo ? null : readShellCache();
    var ctx = demo ? buildCtx(null, false) : (cache ? buildCtx(cache, false) : buildCtx(null, true));
    var brand = (cache && cache.brand) || "نظام التجارة";
    var sub = demo ? "وضع تجريبي" : "سحابة · متصل";
    renderShell(active, title, ctx, brand, sub, demo);
  }

  async function init(active, opts) {
    var app = document.getElementById("app");
    if (!app) return null;
    if (DB.fatal) {
      app.innerHTML = html`<div class="login-wrap"><div class="card error">${DB.fatal}</div></div>`;
      return null;
    }

    // الشيل يكون مرسومًا مسبقًا؛ وإلا (صفحة بلا data-page) نرسمه الآن
    if (!shell) {
      var demo0 = DB.isDemo();
      var c0 = demo0 ? null : readShellCache();
      renderShell(active, (opts && opts.title) || TITLES[active] || [active, ""],
        demo0 ? buildCtx(null, false) : (c0 ? buildCtx(c0, false) : buildCtx(null, true)),
        (c0 && c0.brand) || "نظام التجارة", demo0 ? "وضع تجريبي" : "سحابة · متصل", demo0);
    } else if (shell.active !== active) {
      shell.active = active; // مفتاح مختلف عن المتوقع: صحّح التمييز في القائمة
      var nv = document.getElementById("sidebar-nav");
      if (nv) {
        nv.querySelectorAll("a.nav").forEach(function (a) {
          var on = a.getAttribute("data-nav") === active;
          a.classList.toggle("active", on);
          if (on) a.setAttribute("aria-current", "page"); else a.removeAttribute("aria-current");
        });
      }
    }
    if (opts && opts.title) setPageTitle(opts.title);

    // السحابة: التحقق من الجلسة والملف الشخصي
    var prof = null;
    try { prof = await DB.ready(); } catch (e) {
      app.innerHTML = html`<div class="login-wrap"><div class="card error">تعذّر الاتصال بالخادم: ${e.message || e}</div></div>`;
      return null;
    }
    if (prof && prof.status === "suspended") {
      clearShellCache();
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

    var ctx = buildCtx(prof, false);
    if (active === "admin" && !ctx.isAdmin) { location.replace("index.html"); return null; }

    var companyBrand = "نظام التجارة";
    try { var co = DB.getCompany(); if (co && co.name) companyBrand = co.name; } catch (e) {}
    var companySub = DB.isDemo() ? "وضع تجريبي" : "سحابة · متصل";

    // حدّث الكاش للتحميل القادم، وطابِق الشيل بصمت
    if (prof) {
      writeShellCache({
        uid: prof.id, role: prof.role, company_role: prof.company_role,
        permissions: prof.permissions || [], status: prof.status,
        full_name: prof.full_name, brand: companyBrand,
      });
    }
    reconcileShell(ctx, companyBrand, companySub, DB.isDemo());

    var pageEl = document.getElementById("page");
    if (!ctx.allowed(active) || (active === "staff" && ctx.isStaff)) {
      pageEl.innerHTML = '<div class="card empty" style="padding:48px 20px"><h3 style="margin:0 0 8px">غير مصرّح لك بهذه الصفحة</h3><p class="muted" style="margin:0">تواصل مع مالك الشركة لإضافة الصلاحية.</p></div>';
      return null;
    }
    // الهيكل العظمي يبقى حتى تكتب الصفحة محتواها؛ ثم يظهر المحتوى بتلاشٍ هادئ
    pageEl.classList.add("anim-stagger");
    return pageEl;
  }

  // الرسم الفوري للشيل
  boot();

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
    clearShellCache: clearShellCache,
  };
})();

