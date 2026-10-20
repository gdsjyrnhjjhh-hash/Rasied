(async function () {
  var page = await UI.init("stock-report");
  if (!page) return;
  var html = UI.html, money = UI.money, esc = Ledger.esc;
  var today = Ledger.today(), first = today.slice(0, 8) + "01";
  var S = { from: first, to: today, wh: "", search: "", hideIdle: true };
  var products = [], whs = [], data = null, rows = [], tot = null, company = { name: "" };
  var N = function (v) { return Number(v) || 0; };
  var dayOf = function (r) { return (r.date || String(r.created_at || "").slice(0, 10) || ""); };
  var q2 = function (v) { return Math.round(N(v) * 100) / 100; };
  var qty = function (v) { return Math.round(N(v) * 1000) / 1000; };
  var fq = function (v) { return UI.money(qty(v)); };

  page.innerHTML = html`
    <div class="stack stm-page">
      <div class="page-toolbar">
        <div><h2 style="margin:0">حركة المخزون</h2>
          <p class="muted" style="margin:4px 0 0;font-size:12px">رصيد أول المدة + المشتريات + المبيعات + المرتجعات + الجرد = رصيد آخر المدة، لكل صنف</p></div>
        <div class="row gap"><button type="button" class="small stm-xls" id="xls">Excel</button><button type="button" class="small stm-prn" id="prn">طباعة / PDF</button></div>
      </div>
      <div class="card stm-filters">
        <div class="field"><label>من تاريخ</label><input type="date" id="from" value="${S.from}"></div>
        <div class="field"><label>إلى تاريخ</label><input type="date" id="to" value="${S.to}"></div>
        <div class="field"><label>المخزن</label><select id="wh"><option value="">كل المخازن</option></select></div>
        <div class="field grow"><label>بحث بالصنف / الكود</label><input id="search" placeholder="اسم الصنف…" autocomplete="off"></div>
        <label class="row gap" style="align-items:center;font-size:13px"><input type="checkbox" id="idle" checked> إخفاء الأصناف بدون حركة ورصيد</label>
      </div>
      <div class="stm-sumbar" id="sumbar"></div>
      <div class="card table-wrap" id="list"><div class="empty">جارٍ التحميل…</div></div>
      <p class="muted" style="font-size:12px;margin:0">رصيد أول المدة = الرصيد الحالي للصنف ناقص حركات الفترة وما بعدها. أي تعديل يدوي لكمية الصنف من شاشة «الأصناف» لا يظهر كحركة هنا — استخدم «الجرد المخزني» لتسوية الكميات حتى تظهر في عمود الجرد. تحويلات المخازن لا تغيّر الكمية.</p>
    </div>`;

  async function load() {
    DB.refresh();
    var d = await Promise.all([
      DB.list("products"), DB.list("warehouses"),
      DB.list("purchases"), DB.list("purchase_lines"), DB.list("sales"), DB.list("sale_lines"),
      DB.list("sale_returns"), DB.list("sale_return_lines"), DB.list("purchase_returns"), DB.list("purchase_return_lines"),
      DB.list("stocktakes"), DB.list("stocktake_lines"),
    ]);
    products = d[0]; whs = d[1];
    var sel = document.getElementById("wh");
    sel.innerHTML = '<option value="">كل المخازن</option>' + whs.map(function (w) { return '<option value="' + esc(w.id) + '"' + (S.wh === w.id ? " selected" : "") + ">" + esc(w.name) + "</option>"; }).join("");
    // أحداث الحركة: {pid, date, type, q (موقّعة), amt}
    var ev = [];
    function addDocs(headers, lines, fk, type, sign, priceKey) {
      var h = {}; headers.forEach(function (x) { if (x.status !== "void") h[x.id] = x; });
      lines.forEach(function (l) {
        var doc = h[l[fk]]; if (!doc) return;
        ev.push({ pid: l.product_id, date: dayOf(doc), type: type, q: sign * N(l.qty), amt: N(l.qty) * N(l[priceKey]) });
      });
    }
    addDocs(d[2], d[3], "purchase_id", "purchase", 1, "unit_cost");
    addDocs(d[4], d[5], "sale_id", "sale", -1, "unit_price");
    addDocs(d[6], d[7], "return_id", "sale_return", 1, "unit_price");
    addDocs(d[8], d[9], "return_id", "purchase_return", -1, "unit_cost");
    var st = {}; d[10].forEach(function (x) { if (x.status !== "void") st[x.id] = x; });
    d[11].forEach(function (l) { var doc = st[l.stocktake_id]; if (doc) ev.push({ pid: l.product_id, date: dayOf(doc), type: "stocktake", q: N(l.diff), amt: 0 }); });
    var by = {}; ev.forEach(function (e) { (by[e.pid] = by[e.pid] || []).push(e); });
    data = by;
  }
  function compute() {
    var s = S.search.trim().toLowerCase();
    rows = []; tot = { open: 0, purchase: 0, sale_return: 0, sale: 0, purchase_return: 0, stocktake: 0, close: 0, sales_amt: 0, value: 0 };
    products.forEach(function (p) {
      if (S.wh && p.warehouse_id !== S.wh) return;
      if (s && String(p.name || "").toLowerCase().indexOf(s) < 0 && String(p.sku || "").toLowerCase().indexOf(s) < 0) return;
      var r = { p: p, purchase: 0, sale_return: 0, sale: 0, purchase_return: 0, stocktake: 0, sales_amt: 0 }, after = 0, inPeriod = 0;
      (data[p.id] || []).forEach(function (e) {
        if (S.to && e.date > S.to) { after += e.q; return; }
        if (S.from && e.date < S.from) return;
        inPeriod += e.q; r[e.type] += e.q;
        if (e.type === "sale") r.sales_amt += e.amt;
      });
      r.close = N(p.qty) - after; r.open = r.close - inPeriod;
      r.value = r.close * N(p.cost);
      var idle = !r.purchase && !r.sale_return && !r.sale && !r.purchase_return && !r.stocktake && Math.abs(r.open) < 0.0005 && Math.abs(r.close) < 0.0005;
      if (S.hideIdle && idle) return;
      rows.push(r);
      ["open", "purchase", "sale_return", "sale", "purchase_return", "stocktake", "close", "sales_amt", "value"].forEach(function (k) { tot[k] += r[k]; });
    });
    rows.sort(function (a, b) { return String(a.p.name || "").localeCompare(String(b.p.name || ""), "ar", { numeric: true }); });
  }
  function qcell(v, cls) { return '<td class="c ' + (cls || "") + '">' + (Math.abs(v) < 0.0005 ? "-" : fq(Math.abs(v))) + "</td>"; }
  function draw() {
    compute();
    document.getElementById("sumbar").innerHTML =
      '<div class="stm-chip"><span>عدد الأصناف</span><b>' + rows.length + "</b></div>" +
      '<div class="stm-chip"><span>رصيد أول المدة</span><b>' + fq(tot.open) + "</b></div>" +
      '<div class="stm-chip warn"><span>مبيعات الفترة (كمية)</span><b>' + fq(Math.abs(tot.sale)) + "</b></div>" +
      '<div class="stm-chip"><span>قيمة المبيعات</span><b>' + UI.moneyC(tot.sales_amt) + "</b></div>" +
      '<div class="stm-chip err"><span>قيمة رصيد آخر المدة (بالتكلفة)</span><b>' + UI.moneyC(tot.value) + "</b></div>";
    document.getElementById("list").innerHTML = rows.length ? '<table class="stm-list"><thead><tr><th>#</th><th>الصنف</th><th>الوحدة</th><th class="c">رصيد أول المدة</th><th class="c">مشتريات</th><th class="c">مرتجع مبيعات</th><th class="c">مبيعات</th><th class="c">مرتجع مشتريات</th><th class="c">جرد / تسوية</th><th class="c">رصيد آخر المدة</th><th class="c">قيمة المبيعات</th><th class="c">قيمة المخزون</th></tr></thead><tbody>' +
      rows.map(function (r, i) {
        return "<tr><td class=\"muted\">" + (i + 1) + "</td><td><b>" + esc(r.p.name) + "</b></td><td>" + esc(r.p.unit || "") + "</td>" +
          '<td class="c"><b>' + fq(r.open) + "</b></td>" + qcell(r.purchase, "cr") + qcell(r.sale_return, "cr") + qcell(r.sale, "dr") + qcell(r.purchase_return, "dr") +
          '<td class="c ' + (r.stocktake > 0 ? "cr" : r.stocktake < 0 ? "dr" : "") + '">' + (Math.abs(r.stocktake) < 0.0005 ? "-" : (r.stocktake > 0 ? "+" : "-") + fq(Math.abs(r.stocktake))) + "</td>" +
          '<td class="c"><b class="' + (r.close < 0 ? "dr" : "") + '">' + fq(r.close) + '</b></td><td class="c">' + (r.sales_amt ? money(r.sales_amt) : "-") + '</td><td class="c">' + money(r.value) + "</td></tr>";
      }).join("") +
      '<tr class="tot"><td colspan="3">الإجمالي</td><td class="c">' + fq(tot.open) + '</td><td class="c">' + fq(tot.purchase) + '</td><td class="c">' + fq(tot.sale_return) + '</td><td class="c">' + fq(Math.abs(tot.sale)) + '</td><td class="c">' + fq(Math.abs(tot.purchase_return)) + '</td><td class="c">' + fq(tot.stocktake) + '</td><td class="c">' + fq(tot.close) + '</td><td class="c">' + money(tot.sales_amt) + '</td><td class="c">' + money(tot.value) + "</td></tr></tbody></table>"
      : '<div class="empty">لا توجد أصناف مطابقة</div>';
  }
  async function loadCompany() { try { var c = await Promise.resolve(DB.getCompany()); if (c && c.name) company = c; } catch (e) {} }
  function period() { return "من " + (S.from || "البداية") + " إلى " + (S.to || "اليوم"); }
  async function printIt() {
    await loadCompany();
    var w = window.open("", "_blank", "width=1000,height=760");
    if (!w) { UI.toast("اسمح بالنوافذ المنبثقة للطباعة", true); return; }
    var body = rows.map(function (r, i) {
      return "<tr><td>" + (i + 1) + "</td><td>" + esc(r.p.name) + "</td><td>" + esc(r.p.unit || "") + '</td><td class="n b">' + fq(r.open) + '</td><td class="n">' + fq(r.purchase) + '</td><td class="n">' + fq(r.sale_return) + '</td><td class="n">' + fq(Math.abs(r.sale)) + '</td><td class="n">' + fq(Math.abs(r.purchase_return)) + '</td><td class="n">' + fq(r.stocktake) + '</td><td class="n b">' + fq(r.close) + '</td><td class="n">' + money(r.sales_amt) + '</td><td class="n">' + money(r.value) + "</td></tr>";
    }).join("");
    var css = "@page{size:A4 landscape;margin:12mm}*{box-sizing:border-box;-webkit-print-color-adjust:exact;print-color-adjust:exact}body{margin:0;font-family:Cairo,Tahoma,Arial,sans-serif;color:#0e1630;font-size:9pt}.head{display:flex;justify-content:space-between;border-bottom:2.5px solid #182763;padding-bottom:6px;margin-bottom:10px}.head h1{margin:0;font-size:16pt;color:#182763}.head div{font-size:9pt;color:#566382}table{width:100%;border-collapse:collapse}thead{display:table-header-group}th{background:#182763;color:#fff;padding:5px;border:1px solid #182763;font-size:8.5pt}td{padding:4px 5px;border:1px solid #d3daea}td.n,th.n{text-align:center;white-space:nowrap}td.b{font-weight:800}tr{page-break-inside:avoid}tbody tr:nth-child(even){background:#f6f8fd}tr.tot td{background:#dfe6fa;font-weight:800}.actions{margin-top:16px;text-align:center}.actions button{font:inherit;padding:8px 24px;border:0;border-radius:8px;background:#2a49d6;color:#fff;cursor:pointer}@media print{.actions{display:none}}";
    w.document.write('<!doctype html><html lang="ar" dir="rtl"><head><meta charset="utf-8"><title>حركة المخزون</title><style>' + css + '</style></head><body><div class="head"><div><h1>' + esc(company.name || "الشركة") + '</h1><div>تقرير حركة المخزون' + (UI.currency() ? " — العملة: " + esc(UI.currency()) : "") + '' + (S.wh ? " — " + esc((whs.filter(function (x) { return x.id === S.wh; })[0] || {}).name || "") : "") + '</div></div><div>' + esc(period()) + '</div></div><table><thead><tr><th>#</th><th>الصنف</th><th>الوحدة</th><th class="n">رصيد أول المدة</th><th class="n">مشتريات</th><th class="n">مرتجع مبيعات</th><th class="n">مبيعات</th><th class="n">مرتجع مشتريات</th><th class="n">جرد/تسوية</th><th class="n">رصيد آخر المدة</th><th class="n">قيمة المبيعات</th><th class="n">قيمة المخزون</th></tr></thead><tbody>' + body +
      '<tr class="tot"><td colspan="3">الإجمالي</td><td class="n">' + fq(tot.open) + '</td><td class="n">' + fq(tot.purchase) + '</td><td class="n">' + fq(tot.sale_return) + '</td><td class="n">' + fq(Math.abs(tot.sale)) + '</td><td class="n">' + fq(Math.abs(tot.purchase_return)) + '</td><td class="n">' + fq(tot.stocktake) + '</td><td class="n">' + fq(tot.close) + '</td><td class="n">' + money(tot.sales_amt) + '</td><td class="n">' + money(tot.value) + '</td></tr></tbody></table><div class="actions"><button onclick="print()">طباعة</button></div></body></html>');
    w.document.close(); setTimeout(function () { try { w.focus(); w.print(); } catch (e) {} }, 500);
  }
  async function excel() {
    await loadCompany();
    var H = ["الصنف", "الوحدة", "رصيد أول المدة", "مشتريات", "مرتجع مبيعات", "مبيعات", "مرتجع مشتريات", "جرد / تسوية", "رصيد آخر المدة", "قيمة المبيعات", "قيمة المخزون"];
    var out = [[{ v: (company.name || "الشركة") + " — حركة المخزون", s: "title" }], [{ v: period(), s: "boldtext" }],
      H.map(function (h) { return { v: h, s: "head" }; })];
    rows.forEach(function (r) {
      out.push([{ v: r.p.name, s: "text" }, { v: r.p.unit || "", s: "text" }, qty(r.open), qty(r.purchase), qty(r.sale_return), qty(Math.abs(r.sale)), qty(Math.abs(r.purchase_return)), qty(r.stocktake), qty(r.close), q2(r.sales_amt), q2(r.value)]);
    });
    out.push([{ v: "الإجمالي", s: "boldtext" }, { v: "", s: "boldtext" }, { v: qty(tot.open), s: "boldnum" }, { v: qty(tot.purchase), s: "boldnum" }, { v: qty(tot.sale_return), s: "boldnum" }, { v: qty(Math.abs(tot.sale)), s: "boldnum" }, { v: qty(Math.abs(tot.purchase_return)), s: "boldnum" }, { v: qty(tot.stocktake), s: "boldnum" }, { v: qty(tot.close), s: "boldnum" }, { v: q2(tot.sales_amt), s: "boldnum" }, { v: q2(tot.value), s: "boldnum" }]);
    Xlsx.download("حركة المخزون " + (S.from || "") + " إلى " + (S.to || "") + ".xlsx", { sheet: "حركة المخزون", cols: [34, 10, 14, 12, 14, 12, 14, 14, 14, 16, 16], merges: ["A1:K1", "A2:K2"], rows: out });
  }

  document.getElementById("from").onchange = function () { S.from = this.value; draw(); };
  document.getElementById("to").onchange = function () { S.to = this.value; draw(); };
  document.getElementById("wh").onchange = function () { S.wh = this.value; draw(); };
  document.getElementById("search").oninput = function () { S.search = this.value; draw(); };
  document.getElementById("idle").onchange = function () { S.hideIdle = this.checked; draw(); };
  document.getElementById("prn").onclick = printIt;
  document.getElementById("xls").onclick = excel;
  try { await load(); draw(); } catch (err) { document.getElementById("list").innerHTML = '<div class="empty">' + esc(err.message || "تعذّر التحميل") + "</div>"; }
})();
