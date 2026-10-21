// طبقة البيانات: Demo (localStorage) أو Supabase
(function () {
  "use strict";
  var cfg = window.APP_CONFIG || {};
  var configured = !!(cfg.SUPABASE_URL && cfg.SUPABASE_ANON_KEY);
  var demoMode = !configured;
  var fatal = "";
  var client = null;
  var LS_KEY = "trading_demo_v3";

  if (configured) {
    if (window.supabase && window.supabase.createClient) {
      client = window.supabase.createClient(cfg.SUPABASE_URL, cfg.SUPABASE_ANON_KEY);
    } else {
      fatal = "تعذّر تحميل مكتبة Supabase.";
    }
  }

  function uid() {
    if (window.crypto && crypto.randomUUID) return crypto.randomUUID();
    return "id-" + Date.now().toString(36) + Math.random().toString(36).slice(2, 10);
  }
  function ago(days) {
    return new Date(Date.now() - days * 86400000).toISOString();
  }
  function today() {
    return new Date().toISOString().slice(0, 10);
  }

  var SEED = {
    company: {
      name: "شركة النور للتجارة",
      phone: "01000000000",
      address: "القاهرة",
      tax_id: "123-456-789",
      vat_rate: 14,
      vat_enabled: true,
      currency: "ج.م",
    },
    customers: [
      { id: "c1", name: "مؤسسة الفجر", phone: "01011112222", balance: 15000, notes: "عميل جملة", created_at: ago(40) },
      { id: "c2", name: "محل الأمانة", phone: "01122223333", balance: 3200, notes: "", created_at: ago(20) },
      { id: "c3", name: "شركة البناء الحديث", phone: "01233334444", balance: 0, notes: "عميل جديد", created_at: ago(5) },
    ],
    suppliers: [
      { id: "s1", name: "مصنع الشرق", phone: "01055556666", balance: 8500, notes: "مورد أساسي", created_at: ago(50) },
      { id: "s2", name: "شركة الإمداد", phone: "01166667777", balance: 0, notes: "", created_at: ago(15) },
    ],
    warehouses: [
      { id: "w1", name: "المخزن الرئيسي", location: "المعادي", created_at: ago(60) },
      { id: "w2", name: "مخزن فرع الجيزة", location: "الجيزة", created_at: ago(30) },
    ],
    products: [
      { id: "p1", sku: "PRD-001", name: "أسمنت بورتلاند 50كج", unit: "شيكارة", cost: 180, price: 220, qty: 500, min_qty: 100, warehouse_id: "w1", created_at: ago(40) },
      { id: "p2", sku: "PRD-002", name: "حديد تسليح 12مم", unit: "طن", cost: 28000, price: 32000, qty: 25, min_qty: 5, warehouse_id: "w1", created_at: ago(40) },
      { id: "p3", sku: "PRD-003", name: "دهان بلاستيك 20 لتر", unit: "جردل", cost: 450, price: 580, qty: 80, min_qty: 20, warehouse_id: "w2", created_at: ago(25) },
      { id: "p4", sku: "PRD-004", name: "سيراميك أرضيات 60×60", unit: "متر", cost: 95, price: 140, qty: 1200, min_qty: 200, warehouse_id: "w1", created_at: ago(20) },
    ],
    // دليل الحسابات (مبسّط)
    accounts: [
      { id: "a1", code: "1100", name: "الصندوق", type: "asset", parent: null },
      { id: "a2", code: "1200", name: "البنك", type: "asset", parent: null },
      { id: "a3", code: "1300", name: "العملاء (مدينون)", type: "asset", parent: null },
      { id: "a4", code: "1400", name: "المخزون", type: "asset", parent: null },
      { id: "a5", code: "2100", name: "الموردين (دائنون)", type: "liability", parent: null },
      { id: "a5b", code: "2200", name: "ضريبة القيمة المضافة مستحقة", type: "liability", parent: null },
      { id: "a6", code: "3100", name: "رأس المال", type: "equity", parent: null },
      { id: "a7", code: "4100", name: "المبيعات", type: "revenue", parent: null },
      { id: "a8", code: "4200", name: "مردودات المبيعات", type: "revenue", parent: null },
      { id: "a9", code: "5100", name: "تكلفة البضاعة المباعة", type: "expense", parent: null },
      { id: "a10", code: "5200", name: "المصروفات العمومية", type: "expense", parent: null },
      { id: "a11", code: "5300", name: "المشتريات", type: "expense", parent: null },
      { id: "a12", code: "1500", name: "ضريبة القيمة المضافة قابلة للخصم", type: "asset", parent: null },
      { id: "a13", code: "5200-SAL", name: "مصروف الرواتب", type: "expense", parent: null },
      { id: "a14", code: "2110", name: "رواتب مستحقة", type: "liability", parent: null },
    ],
    sales: [
      {
        id: "sa1", number: 1001, customer_id: "c1", date: ago(3).slice(0, 10), status: "posted",
        subtotal: 22000, vat_rate: 14, vat_amount: 3080, total: 25080, paid: 7000,
        notes: "فاتورة جملة", created_at: ago(3),
      },
      {
        id: "sa2", number: 1002, customer_id: "c2", date: ago(1).slice(0, 10), status: "posted",
        subtotal: 5800, vat_rate: 14, vat_amount: 812, total: 6612, paid: 6612,
        notes: "", created_at: ago(1),
      },
    ],
    sale_lines: [
      { id: "sl1", sale_id: "sa1", product_id: "p1", qty: 50, unit_price: 220, cost: 180 },
      { id: "sl2", sale_id: "sa1", product_id: "p3", qty: 20, unit_price: 580, cost: 450 },
      { id: "sl3", sale_id: "sa2", product_id: "p3", qty: 10, unit_price: 580, cost: 450 },
    ],
    purchases: [
      {
        id: "pu1", number: 2001, supplier_id: "s1", date: ago(10).slice(0, 10), status: "posted",
        subtotal: 45000, vat_rate: 14, vat_amount: 6300, total: 51300, paid: 36500,
        notes: "شراء أسمنت", created_at: ago(10),
      },
    ],
    purchase_lines: [
      { id: "pl1", purchase_id: "pu1", product_id: "p1", qty: 250, unit_cost: 180 },
    ],
    sale_returns: [],
    sale_return_lines: [],
    purchase_returns: [],
    purchase_return_lines: [],
    stocktakes: [],
    stocktake_lines: [],
    stock_transfers: [],
    stock_transfer_lines: [],

    cash_registers: [
      { id: "cr1", name: "الخزينة الرئيسية", balance: 50000, location: "المكتب", created_at: ago(60) },
      { id: "cr2", name: "خزينة المعرض", balance: 12000, location: "المعادي", created_at: ago(30) },
    ],
    cash_movements: [
      { id: "cm1", register_id: "cr1", kind: "in", amount: 7000, date: ago(2).slice(0,10), notes: "تحصيل فاتورة", created_at: ago(2) },
      { id: "cm2", register_id: "cr1", kind: "out", amount: 2500, date: ago(5).slice(0,10), notes: "مصروف إيجار", created_at: ago(5) },
    ],
    employees: [
      { id: "e1", name: "أحمد حسن", job_title: "محاسب", phone: "01011110001", salary: 8000, hire_date: ago(200).slice(0,10), status: "active", created_at: ago(200) },
      { id: "e2", name: "سارة علي", job_title: "موظفة مبيعات", phone: "01022220002", salary: 6500, hire_date: ago(100).slice(0,10), status: "active", created_at: ago(100) },
      { id: "e3", name: "محمود كمال", job_title: "أمين مخزن", phone: "01033330003", salary: 5500, hire_date: ago(80).slice(0,10), status: "active", created_at: ago(80) },
    ],
    payroll_runs: [
      { id: "pr1", month: "2026-09", status: "posted", total: 20000, notes: "رواتب سبتمبر", created_at: ago(20) },
    ],
    payroll_lines: [
      { id: "prl1", run_id: "pr1", employee_id: "e1", basic: 8000, allowances: 0, deductions: 0, net: 8000 },
      { id: "prl2", run_id: "pr1", employee_id: "e2", basic: 6500, allowances: 0, deductions: 0, net: 6500 },
      { id: "prl3", run_id: "pr1", employee_id: "e3", basic: 5500, allowances: 0, deductions: 0, net: 5500 },
    ],
    settings: {
      vat_rate: 14,
      vat_enabled: true,
    },
    payments: [
      { id: "pay1", kind: "receipt", party_type: "customer", party_id: "c1", amount: 7000, method: "cash", date: ago(2).slice(0, 10), ref: "sa1", notes: "دفعة على فاتورة 1001", created_at: ago(2) },
      { id: "pay2", kind: "receipt", party_type: "customer", party_id: "c2", amount: 5800, method: "bank", date: ago(1).slice(0, 10), ref: "sa2", notes: "", created_at: ago(1) },
      { id: "pay3", kind: "payment", party_type: "supplier", party_id: "s1", amount: 36500, method: "bank", date: ago(8).slice(0, 10), ref: "pu1", notes: "سداد جزئي", created_at: ago(8) },
    ],
    journal_entries: [
      {
        id: "j1", number: 1, date: ago(3).slice(0, 10), memo: "قيد مبيعات فاتورة 1001",
        source: "sale", source_id: "sa1", created_at: ago(3),
      },
      {
        id: "j2", number: 2, date: ago(10).slice(0, 10), memo: "قيد مشتريات فاتورة 2001",
        source: "purchase", source_id: "pu1", created_at: ago(10),
      },
    ],
    journal_lines: [
      // بيع: مدين عملاء / دائن مبيعات + مدين تكلفة / دائن مخزون
      { id: "jl1", entry_id: "j1", account_id: "a3", debit: 22000, credit: 0 },
      { id: "jl2", entry_id: "j1", account_id: "a7", debit: 0, credit: 22000 },
      { id: "jl3", entry_id: "j1", account_id: "a9", debit: 18000, credit: 0 },
      { id: "jl4", entry_id: "j1", account_id: "a4", debit: 0, credit: 18000 },
      // شراء
      { id: "jl5", entry_id: "j2", account_id: "a4", debit: 45000, credit: 0 },
      { id: "jl6", entry_id: "j2", account_id: "a5", debit: 0, credit: 45000 },
    ],
    expenses: [
      { id: "e1", date: ago(5).slice(0, 10), account_id: "a10", amount: 2500, description: "إيجار المخزن", method: "cash", created_at: ago(5) },
    ],
    users: [
      { id: "u1", name: "المدير", phone: "01000000001", role: "admin" },
    ],
  };

  function loadDemo() {
    try {
      var raw = localStorage.getItem(LS_KEY);
      if (raw) return JSON.parse(raw);
    } catch (e) {}
    var data = JSON.parse(JSON.stringify(SEED));
    saveDemo(data);
    return data;
  }
  function saveDemo(data) {
    localStorage.setItem(LS_KEY, JSON.stringify(data));
  }

  // ======================================================================
  // وضع السحابة (Supabase): كل شركة معزولة عبر RLS، والبيانات في جدول records
  // ======================================================================
  var profile = null, companyRow = null, readyPromise = null;

  function goLogin() {
    var here = (location.pathname.split("/").pop() || "index.html");
    if (here !== "login.html") location.replace("login.html");
  }

  async function ensureSeed() {
    // شركة جديدة: دليل حسابات أساسي + مخزن + خزينة (مرة واحدة)
    // علامة محلية تتجاوز الفحص بعد أول نجاح، لتوفير طلب شبكة في كل تنقّل بين الصفحات
    var seedFlag = "trading_seeded_" + profile.company_id;
    try { if (localStorage.getItem(seedFlag) === "1") return; } catch (e) {}
    var c = await client.from("records").select("id", { count: "exact", head: true })
      .eq("company_id", profile.company_id).eq("tbl", "accounts");
    if (c.error) return;
    if (c.count > 0) { try { localStorage.setItem(seedFlag, "1"); } catch (e) {} return; }
    var now = new Date().toISOString();
    var rows = SEED.accounts.map(function (a) {
      return { company_id: profile.company_id, id: a.id, tbl: "accounts", data: Object.assign({}, a, { created_at: now }), created_at: now };
    });
    rows.push({ company_id: profile.company_id, id: uid(), tbl: "warehouses", data: { name: "المخزن الرئيسي", location: "", created_at: now }, created_at: now });
    rows.push({ company_id: profile.company_id, id: uid(), tbl: "cash_registers", data: { name: "الخزينة الرئيسية", balance: 0, location: "", created_at: now }, created_at: now });
    rows.forEach(function (r) { r.data.id = r.id; });
    await client.from("records").insert(rows);
    try { localStorage.setItem(seedFlag, "1"); } catch (e) {}
  }

  // يُستدعى من UI.init: يتحقق من الجلسة ويحمّل الملف الشخصي والشركة
  function ready() {
    if (demoMode) return Promise.resolve(null);
    if (readyPromise) return readyPromise;
    readyPromise = (async function () {
      var s = await client.auth.getSession();
      if (!s.data.session) { goLogin(); return new Promise(function () {}); }
      var uidv = s.data.session.user.id;
      var pr = await client.from("profiles").select("*").eq("id", uidv).maybeSingle();
      if (pr.error || !pr.data) { await client.auth.signOut(); goLogin(); return new Promise(function () {}); }
      profile = pr.data;
      var co = await client.from("companies").select("*").eq("id", profile.company_id).maybeSingle();
      companyRow = co.data || { name: "", profile: {} };
      if (profile.status === "active") {
        await ensureSeed();
        client.rpc("heartbeat");
      }
      return profile;
    })();
    return readyPromise;
  }

  async function logout() {
    try { localStorage.removeItem("trading_shell_v1"); sessionStorage.removeItem("trading_nav_scroll"); } catch (e) {}
    if (client) await client.auth.signOut();
    location.replace("login.html");
  }

  // ----------------------------------------------------------------------
  // كاش خفيف داخل الصفحة الواحدة + تقليل عدد الطلبات (الصفحات مستقلة، فالكاش يُمسح بالتنقّل)
  //  - list: يجلب الصفحات الزائدة عن 1000 بالتوازي ويمنع الطلب المكرر لنفس الجدول
  //  - get: طلب صف واحد بدل تحميل الجدول كله
  //  - listWhere/listWhereIn: فلترة على السيرفر بدل جلب الجدول ثم الفلترة
  //  - insertRows/insertMany/removeMany: طلب واحد لعدة صفوف
  // ----------------------------------------------------------------------
  var cache = {}, inflight = {}, TTL = 20000;
  function cFresh(t) { var c = cache[t]; return c && (Date.now() - c.t) < TTL ? c : null; }
  function cPut(t, rows) { cache[t] = { t: Date.now(), rows: rows }; }
  function cAdd(t, item) { var c = cache[t]; if (c) c.rows.unshift(item); }
  function cSet(t, id, row) {
    var c = cache[t]; if (!c) return;
    for (var i = 0; i < c.rows.length; i++) if (c.rows[i].id === id) { c.rows[i] = row; return; }
  }
  function cDel(t, ids) {
    var c = cache[t]; if (!c) return;
    var m = {}; ids.forEach(function (i) { m[i] = 1; });
    c.rows = c.rows.filter(function (r) { return !m[r.id]; });
  }
  function toRow(x) { return Object.assign({}, x.data, { id: x.id, created_at: x.created_at }); }
  function base(table) {
    return client.from("records").select("id,data,created_at").eq("company_id", profile.company_id).eq("tbl", table);
  }
  function quoteIn(v) { return '"' + String(v).replace(/\\/g, "\\\\").replace(/"/g, '\\"') + '"'; }

  async function cloudList(table) {
    var c = cFresh(table);
    if (c) return c.rows.slice();
    if (!inflight[table]) {
      inflight[table] = (async function () {
        var step = 1000;
        var first = await client.from("records").select("id,data,created_at", { count: "exact" })
          .eq("company_id", profile.company_id).eq("tbl", table)
          .order("created_at", { ascending: false }).range(0, step - 1);
        if (first.error) throw new Error(first.error.message);
        var out = first.data.map(toRow);
        var total = first.count || out.length;
        if (total > step) {
          var jobs = [];
          for (var from = step; from < total; from += step) {
            jobs.push(base(table).order("created_at", { ascending: false }).range(from, from + step - 1));
          }
          var rest = await Promise.all(jobs);
          rest.forEach(function (r) {
            if (r.error) throw new Error(r.error.message);
            r.data.forEach(function (x) { out.push(toRow(x)); });
          });
        }
        cPut(table, out);
        return out;
      })();
    }
    var p = inflight[table];
    try { return (await p).slice(); }
    finally { if (inflight[table] === p) delete inflight[table]; }
  }
  async function list(table) {
    if (fatal) throw new Error(fatal);
    if (demoMode) {
      var d = loadDemo();
      return (d[table] || []).slice().sort(function (a, b) {
        return (b.created_at || b.date || "").localeCompare(a.created_at || a.date || "");
      });
    }
    await ready();
    return cloudList(table);
  }
  // صف واحد. opts.fresh = تجاهل الكاش (للأرصدة)
  async function get(table, id, opts) {
    if (fatal) throw new Error(fatal);
    if (!id) return null;
    if (demoMode) {
      var rows = await list(table);
      return rows.filter(function (r) { return r.id === id; })[0] || null;
    }
    await ready();
    if (!(opts && opts.fresh)) {
      var c = cFresh(table);
      if (c) {
        for (var i = 0; i < c.rows.length; i++) if (c.rows[i].id === id) return c.rows[i];
      }
    }
    var r = await base(table).eq("id", id).maybeSingle();
    if (r.error) throw new Error(r.error.message);
    return r.data ? toRow(r.data) : null;
  }
  // فلترة على السيرفر: كل الصفوف التي data[field] == value
  async function listWhere(table, field, value) {
    if (fatal) throw new Error(fatal);
    if (demoMode) {
      return (await list(table)).filter(function (r) { return String(r[field]) === String(value); });
    }
    await ready();
    var c = cFresh(table);
    if (c) return c.rows.filter(function (r) { return String(r[field]) === String(value); });
    var out = [], from = 0, step = 1000;
    for (;;) {
      var r = await base(table).eq("data->>" + field, String(value)).range(from, from + step - 1);
      if (r.error) throw new Error(r.error.message);
      r.data.forEach(function (x) { out.push(toRow(x)); });
      if (r.data.length < step) break;
      from += step;
    }
    return out;
  }
  async function listWhereIn(table, field, values) {
    values = (values || []).filter(function (v) { return v != null && v !== ""; });
    if (!values.length) return [];
    if (demoMode) {
      var set = {}; values.forEach(function (v) { set[String(v)] = 1; });
      return (await list(table)).filter(function (r) { return set[String(r[field])]; });
    }
    await ready();
    var c = cFresh(table);
    if (c) {
      var m = {}; values.forEach(function (v) { m[String(v)] = 1; });
      return c.rows.filter(function (r) { return m[String(r[field])]; });
    }
    var chunks = [];
    for (var i = 0; i < values.length; i += 100) chunks.push(values.slice(i, i + 100));
    var res = await Promise.all(chunks.map(function (ch) {
      return base(table).in("data->>" + field, ch.map(quoteIn));
    }));
    var out = [];
    res.forEach(function (r) {
      if (r.error) throw new Error(r.error.message);
      r.data.forEach(function (x) { out.push(toRow(x)); });
    });
    return out;
  }
  // هوية المستخدم الحالي (للتدقيق والقيود): مالك الشركة أو موظف بصلاحيات
  function me() {
    if (demoMode || !profile) return { id: "demo", name: "", owner: true, perms: [] };
    return { id: profile.id, name: profile.full_name || "", owner: profile.company_role !== "staff", perms: Array.isArray(profile.permissions) ? profile.permissions : [] };
  }
  // القيود الإضافية على الموظف (deny:delete / deny:edit) — الغياب = مسموح (توافق مع الموظفين الحاليين)
  function can(action) { var m = me(); return m.owner || m.perms.indexOf("deny:" + action) === -1; }
  function assertCan(action) {
    if (!can(action)) throw new Error(action === "delete" ? "غير مصرّح لك بالحذف — تواصل مع مالك الشركة" : "غير مصرّح لك بتعديل المستندات المحفوظة — تواصل مع مالك الشركة");
  }
  var GUARDED_DELETE = ["customers", "suppliers", "products", "accounts", "employees", "cash_registers", "treasury_tabs", "banks", "expenses", "warehouses",
    "cheques", "cash_counts", "sales", "purchases", "sale_returns", "purchase_returns", "bank_movements"];
  // يُختم كل سجل رئيسي بمن أنشأه (بدون سطور البنود/القيود لتقليل الحجم)
  function mkItem(table, row) {
    var base = { id: uid(), created_at: new Date().toISOString() };
    if (!/_lines$/.test(table)) { var u = me(); base.by = u.id; if (u.name) base.by_name = u.name; }
    return Object.assign(base, row);
  }
  async function insert(table, row) {
    var out = await insertRows([{ table: table, row: row }]);
    return out[0];
  }
  // عدة صفوف (قد تكون من جداول مختلفة) في طلب واحد: [{table,row}]
  async function insertRows(items) {
    if (fatal) throw new Error(fatal);
    if (!items.length) return [];
    if (!demoMode) await ready();                       // لازم الملف الشخصي محمّل قبل ختم المستخدم
    var made = items.map(function (x) { return { table: x.table, item: mkItem(x.table, x.row) }; });
    if (demoMode) {
      var d = loadDemo();
      made.forEach(function (m) {
        if (!d[m.table]) d[m.table] = [];
        d[m.table].push(m.item);
      });
      saveDemo(d);
      return made.map(function (m) { return m.item; });
    }
    await ready();
    for (var i = 0; i < made.length; i += 500) {
      var part = made.slice(i, i + 500).map(function (m) {
        return { company_id: profile.company_id, id: m.item.id, tbl: m.table, data: m.item, created_at: m.item.created_at };
      });
      var res = await client.from("records").insert(part);
      if (res.error) throw new Error(res.error.message);
    }
    made.forEach(function (m) { cAdd(m.table, m.item); });
    return made.map(function (m) { return m.item; });
  }
  async function insertMany(table, rows) {
    return insertRows(rows.map(function (r) { return { table: table, row: r }; }));
  }
  async function update(table, id, patch) {
    if (fatal) throw new Error(fatal);
    if (demoMode) {
      var d = loadDemo();
      var arr = d[table] || [];
      var i = arr.findIndex(function (r) { return r.id === id; });
      if (i < 0) throw new Error("السجل غير موجود");
      arr[i] = Object.assign({}, arr[i], patch);
      saveDemo(d);
      return arr[i];
    }
    await ready();
    // قراءة صف واحد من السيرفر دائمًا (دمج آمن مع أي تعديل من جهاز آخر)
    var cur = await client.from("records").select("data,created_at").eq("company_id", profile.company_id).eq("id", id).maybeSingle();
    if (cur.error || !cur.data) throw new Error("السجل غير موجود");
    var merged = Object.assign({}, cur.data.data, patch);
    var res = await client.from("records").update({ data: merged }).eq("company_id", profile.company_id).eq("id", id);
    if (res.error) throw new Error(res.error.message);
    cSet(table, id, Object.assign({}, merged, { id: id, created_at: cur.data.created_at }));
    return merged;
  }
  async function remove(table, id) {
    if (GUARDED_DELETE.indexOf(table) !== -1) assertCan("delete");
    return removeMany(table, [id]);
  }
  async function removeMany(table, ids) {
    if (fatal) throw new Error(fatal);
    ids = (ids || []).filter(Boolean);
    if (!ids.length) return true;
    if (demoMode) {
      var d = loadDemo();
      var m = {}; ids.forEach(function (i) { m[i] = 1; });
      d[table] = (d[table] || []).filter(function (r) { return !m[r.id]; });
      saveDemo(d);
      return true;
    }
    await ready();
    var jobs = [];
    for (var i = 0; i < ids.length; i += 100) {
      jobs.push(client.from("records").delete().eq("company_id", profile.company_id).in("id", ids.slice(i, i + 100)));
    }
    var res = await Promise.all(jobs);
    res.forEach(function (r) { if (r.error) throw new Error(r.error.message); });
    cDel(table, ids);
    return true;
  }
  function refresh(table) { if (table) delete cache[table]; else cache = {}; }
  function resetDemo() {
    localStorage.removeItem(LS_KEY);
    return loadDemo();
  }

  function isDemo() { return demoMode; }

  // بيانات الشركة والضريبة
  function getCompany() {
    var base = Object.assign({}, SEED.company);
    if (!demoMode) {
      if (companyRow) base = Object.assign(base, companyRow.profile || {}, { name: companyRow.name });
      return base;
    }
    try {
      var raw = localStorage.getItem(LS_KEY);
      var d = raw ? JSON.parse(raw) : null;
      if (d && d.company) base = Object.assign(base, d.company);
      if (d && d.settings) {
        if (d.settings.vat_rate != null) base.vat_rate = d.settings.vat_rate;
        if (d.settings.vat_enabled != null) base.vat_enabled = d.settings.vat_enabled;
      }
    } catch (e) {}
    return base;
  }
  function saveCompany(patch) {
    if (!demoMode) {
      var merged = Object.assign({}, companyRow.profile || {}, patch);
      delete merged.name;
      var upd = { profile: merged };
      if (patch.name) upd.name = patch.name;
      return client.from("companies").update(upd).eq("id", profile.company_id).select().single().then(function (r) {
        if (r.error) throw new Error(r.error.message);
        companyRow = r.data;
        return getCompany();
      });
    }
    var d = loadDemo();
    d.company = Object.assign({}, SEED.company, d.company || {}, patch);
    d.settings = Object.assign({}, d.settings || {}, {
      vat_rate: d.company.vat_rate,
      vat_enabled: d.company.vat_enabled,
    });
    saveDemo(d);
    return Promise.resolve(d.company);
  }

  // ترقيم تلقائي: أكبر رقم + 1 (على السيرفر: صف واحد فقط بدل تحميل الجدول)
  async function nextNumber(table, field) {
    field = field || "number";
    if (!demoMode && !fatal) {
      try {
        await ready();
        var r = await client.from("records").select("data")
          .eq("company_id", profile.company_id).eq("tbl", table)
          .order("data->" + field, { ascending: false, nullsFirst: false }).limit(1);
        if (!r.error) {
          var top = r.data.length ? Number(r.data[0].data[field]) || 0 : 0;
          var c = cFresh(table), cm = 0;
          if (c) c.rows.forEach(function (x) { var n = Number(x[field]) || 0; if (n > cm) cm = n; });
          return Math.max(top, cm) + 1;
        }
      } catch (e) { /* رجوع للطريقة العامة */ }
    }
    var rows = await list(table);
    var max = 0;
    rows.forEach(function (r) {
      var n = Number(r[field]) || 0;
      if (n > max) max = n;
    });
    return max + 1;
  }
  window.DB = {
    list: list,
    get: get,
    insert: insert,
    update: update,
    remove: remove,
    uid: uid,
    isDemo: isDemo,
    ready: ready,
    logout: logout,
    profile: function () { return profile; },
    client: function () { return client; },
    getCompany: getCompany,
    saveCompany: saveCompany,
    resetDemo: resetDemo,
    nextNumber: nextNumber,
    me: me,
    can: can,
    assertCan: assertCan,
    listWhere: listWhere,
    listWhereIn: listWhereIn,
    insertRows: insertRows,
    insertMany: insertMany,
    removeMany: removeMany,
    refresh: refresh,
    fatal: fatal,
    configured: configured,
  };
})();
