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
    var c = await client.from("records").select("id", { count: "exact", head: true })
      .eq("company_id", profile.company_id).eq("tbl", "accounts");
    if (c.error || c.count > 0) return;
    var now = new Date().toISOString();
    var rows = SEED.accounts.map(function (a) {
      return { company_id: profile.company_id, id: a.id, tbl: "accounts", data: Object.assign({}, a, { created_at: now }), created_at: now };
    });
    rows.push({ company_id: profile.company_id, id: uid(), tbl: "warehouses", data: { name: "المخزن الرئيسي", location: "", created_at: now }, created_at: now });
    rows.push({ company_id: profile.company_id, id: uid(), tbl: "cash_registers", data: { name: "الخزينة الرئيسية", balance: 0, location: "", created_at: now }, created_at: now });
    rows.forEach(function (r) { r.data.id = r.id; });
    await client.from("records").insert(rows);
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
    if (client) await client.auth.signOut();
    location.replace("login.html");
  }

  async function cloudList(table) {
    var out = [], from = 0, step = 1000;
    for (;;) {
      var r = await client.from("records").select("id,data,created_at")
        .eq("company_id", profile.company_id).eq("tbl", table)
        .order("created_at", { ascending: false }).range(from, from + step - 1);
      if (r.error) throw new Error(r.error.message);
      r.data.forEach(function (x) { out.push(Object.assign({}, x.data, { id: x.id, created_at: x.created_at })); });
      if (r.data.length < step) break;
      from += step;
    }
    return out;
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

  async function get(table, id) {
    var rows = await list(table);
    return rows.filter(function (r) { return r.id === id; })[0] || null;
  }

  async function insert(table, row) {
    if (fatal) throw new Error(fatal);
    var item = Object.assign({ id: uid(), created_at: new Date().toISOString() }, row);
    if (demoMode) {
      var d = loadDemo();
      if (!d[table]) d[table] = [];
      d[table].push(item);
      saveDemo(d);
      return item;
    }
    await ready();
    var res = await client.from("records").insert({
      company_id: profile.company_id, id: item.id, tbl: table, data: item, created_at: item.created_at,
    });
    if (res.error) throw new Error(res.error.message);
    return item;
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
    var cur = await client.from("records").select("data").eq("company_id", profile.company_id).eq("id", id).maybeSingle();
    if (cur.error || !cur.data) throw new Error("السجل غير موجود");
    var merged = Object.assign({}, cur.data.data, patch);
    var res = await client.from("records").update({ data: merged }).eq("company_id", profile.company_id).eq("id", id);
    if (res.error) throw new Error(res.error.message);
    return merged;
  }

  async function remove(table, id) {
    if (fatal) throw new Error(fatal);
    if (demoMode) {
      var d = loadDemo();
      d[table] = (d[table] || []).filter(function (r) { return r.id !== id; });
      saveDemo(d);
      return true;
    }
    await ready();
    var res = await client.from("records").delete().eq("company_id", profile.company_id).eq("id", id);
    if (res.error) throw new Error(res.error.message);
    return true;
  }

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

  // ترقيم تلقائي
  async function nextNumber(table, field) {
    field = field || "number";
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
    fatal: fatal,
    configured: configured,
  };
})();
