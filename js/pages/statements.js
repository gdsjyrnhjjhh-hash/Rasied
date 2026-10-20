(async function () {
  var page = await UI.init("statements");
  if (!page) return;
  var html = UI.html, money = UI.money, esc = Ledger.esc, val = Ledger.val;
  var q = new URLSearchParams(location.search);
  var S = { type: q.get("type") === "supplier" ? "supplier" : "customer", search: "", status: "all" };
  var parties = [], regs = [], tabs = [], led = {};   // led[id] = { sales, paid, balance }
  var cur = null, openToken = 0, view = null, company = { name: "" };
  var today = Ledger.today();

  function isC() { return S.type === "customer"; }
  function T() {
    return isC()
      ? { who: "العميل", whoP: "العملاء", sales: "إجمالي المبيعات", paid: "إجمالي التحصيلات", rec: "تحصيل", recBtn: "تسجيل تحصيل", docKind: "كشف حساب عميل", due: "عليه", crd: "له", dueTxt: "مستحق عليه", crdTxt: "له رصيد" }
      : { who: "المورد", whoP: "الموردين", sales: "إجمالي المشتريات", paid: "إجمالي المدفوعات", rec: "سداد", recBtn: "تسجيل سداد", docKind: "كشف حساب مورد", due: "له", crd: "عليه", dueTxt: "مستحق له", crdTxt: "عليه رصيد" };
  }
  // الرصيد الموجب = مستحق (على العميل / للمورد)
  function balText(v) {
    var t = T();
    if (Math.abs(v) < 0.005) return "0";
    return money(Math.abs(v)) + " (" + (v > 0 ? t.due : t.crd) + ")";
  }
  function stateOf(v) {
    var t = T();
    if (v > 0.004) return { c: "warn", t: t.dueTxt };
    if (v < -0.004) return { c: "info", t: t.crdTxt };
    return { c: "ok", t: "مسدد" };
  }
  function natural(a, b) { return String(a || "").localeCompare(String(b || ""), "ar", { numeric: true }); }

  page.innerHTML = html`
    <div class="stack stm-page">
      <div class="page-toolbar">
        <div>
          <h2 style="margin:0">كشوف الحساب</h2>
          <p class="muted" style="margin:4px 0 0;font-size:12px">أرصدة كل الأطراف في مكان واحد · افتح الكشف التفصيلي بالفترة · تحصيل وسداد · طباعة وPDF وExcel</p>
        </div>
        <div class="row gap">
          <div class="seg" id="seg"><button type="button" data-t="customer" class="on">العملاء</button><button type="button" data-t="supplier">الموردين</button></div>
          <button type="button" class="primary" id="top-pay"></button>
          <button type="button" class="small" id="reload" title="تحديث">↻ تحديث</button>
        </div>
      </div>
      <div class="card stm-filters">
        <div class="field grow"><label id="lbl-search"></label><input id="search" placeholder="ابحث بالاسم أو الكود…" autocomplete="off"></div>
        <div class="field"><label>حالة الرصيد</label><select id="status">
          <option value="all">الكل</option><option value="due">رصيد مستحق</option><option value="clear">مسدد بالكامل</option><option value="credit">رصيد دائن</option></select></div>
        <button type="button" class="ghost" id="reset">إلغاء الفلاتر</button>
      </div>
      <div class="stm-sumbar" id="sumbar"></div>
      <div class="card table-wrap" id="list"><div class="empty">جارٍ التحميل…</div></div>
    </div>`;

  /* ---------- تحميل كل الأطراف وحساب أرصدتها مرة واحدة ---------- */
  async function loadAll() {
    DB.refresh();
    var c = isC();
    var d = await Promise.all([
      DB.list(c ? "customers" : "suppliers"), DB.list(c ? "sales" : "purchases"), DB.list(c ? "sale_returns" : "purchase_returns"),
      DB.list("payments"), DB.list("party_txns"), DB.list("cash_registers"), DB.list("treasury_tabs"),
    ]);
    var key = c ? "customer_id" : "supplier_id";
    var group = function (arr, f) { var m = {}; arr.forEach(function (r) { var k = f(r); (m[k] = m[k] || []).push(r); }); return m; };
    var docs = group(d[1], function (r) { return r[key]; }), rets = group(d[2], function (r) { return r[key]; });
    var pays = group(d[3], function (r) { return r.party_id; }), txns = group(d[4], function (r) { return r.party_id; });
    parties = d[0].slice().sort(function (a, b) { return natural(a.code, b.code) || natural(a.name, b.name); });
    regs = d[5]; tabs = d[6]; led = {};
    await Promise.all(parties.map(async function (p) {
      var st = await Ledger.statement(S.type, p.id, null, null, { party: p, docs: docs[p.id] || [], rets: rets[p.id] || [], pays: pays[p.id] || [], txns: txns[p.id] || [] });
      var sales = 0, paid = 0;
      st.rows.forEach(function (r) {
        if (r.kind === "sale" || r.kind === "purchase") sales += r.inc;
        if (r.kind === "receipt" || r.kind === "payment") paid += r.dec;
      });
      led[p.id] = { sales: sales, paid: paid, balance: Math.abs(st.full) < 0.005 ? 0 : st.full, stale: Math.abs((Number(p.balance) || 0) - st.full) > 0.004 };
    }));
  }

  /* ---------- القائمة ---------- */
  function filtered() {
    var s = S.search.trim().toLowerCase();
    return parties.filter(function (p) {
      if (s && (String(p.name || "").toLowerCase().indexOf(s) < 0 && String(p.code || "").toLowerCase().indexOf(s) < 0)) return false;
      var b = led[p.id] ? led[p.id].balance : 0;
      if (S.status === "due") return b > 0.004;
      if (S.status === "clear") return Math.abs(b) <= 0.004;
      if (S.status === "credit") return b < -0.004;
      return true;
    });
  }
  function drawList() {
    var t = T(), rows = filtered(), due = 0, dueN = 0;
    rows.forEach(function (p) { var b = led[p.id] ? led[p.id].balance : 0; if (b > 0.004) { due += b; dueN++; } });
    document.getElementById("sumbar").innerHTML =
      '<div class="stm-chip"><span>عدد ' + t.whoP + '</span><b>' + rows.length + '</b></div>' +
      '<div class="stm-chip warn"><span>' + t.whoP + ' برصيد مستحق</span><b>' + dueN + '</b></div>' +
      '<div class="stm-chip err"><span>إجمالي المستحق</span><b>' + UI.moneyC(due) + '</b></div>';
    document.getElementById("list").innerHTML = rows.length ? '<table class="stm-list"><thead><tr><th>#</th><th>الكود</th><th>اسم ' + t.who + '</th><th class="c">' + t.sales + '</th><th class="c">' + t.paid +
      '</th><th class="c">الرصيد</th><th>الحالة</th><th class="c">إجراءات</th></tr></thead><tbody>' +
      rows.map(function (p, i) {
        var l = led[p.id] || { sales: 0, paid: 0, balance: 0 }, st = stateOf(l.balance);
        return '<tr data-id="' + esc(p.id) + '"><td class="muted">' + (i + 1) + '</td><td dir="ltr">' + esc(p.code || "-") + '</td><td><b>' + esc(p.name) + '</b></td>' +
          '<td class="c">' + money(l.sales) + '</td><td class="c">' + money(l.paid) + '</td>' +
          '<td class="c"><b class="' + (l.balance > 0.004 ? "dr" : l.balance < -0.004 ? "cr" : "") + '">' + balText(l.balance) + '</b></td>' +
          '<td><span class="badge ' + st.c + '">' + st.t + '</span></td>' +
          '<td class="c"><button type="button" class="small" data-a="stmt">كشف حساب</button> <button type="button" class="small primary" data-a="pay">' + t.rec + '</button></td></tr>';
      }).join("") + '</tbody></table>' : '<div class="empty">لا توجد نتائج مطابقة</div>';
  }
  function drawHead() {
    var t = T();
    document.getElementById("top-pay").textContent = "+ " + t.recBtn;
    document.getElementById("lbl-search").textContent = "اسم / كود " + t.who;
    Array.prototype.forEach.call(document.querySelectorAll("#seg button"), function (b) { b.classList.toggle("on", b.dataset.t === S.type); });
  }

  /* ---------- الكشف التفصيلي ---------- */
  function textOf(r) {
    var t = T(), d = r.desc || "", no = r.book || r.ref || "-";
    var withDesc = function (label) { return !d ? label : (d.indexOf(label) !== -1 ? d : label + " - " + d); };
    switch (r.kind) {
      case "sale": return "فاتورة مبيعات رقم " + no;
      case "purchase": return "فاتورة مشتريات رقم " + no;
      case "sale_return": return "مرتجع مبيعات رقم " + (r.ref || "-");
      case "purchase_return": return "مرتجع مشتريات رقم " + (r.ref || "-");
      case "receipt": return withDesc("تحصيل");
      case "payment": return withDesc("سداد");
      default: return withDesc(Ledger.KIND_LABEL[r.kind] || r.kind || t.rec);
    }
  }
  function buildView(stm) {
    var c = isC(), rows = stm.rows.map(function (r) {
      return { date: r.date, text: textOf(r), debit: c ? r.inc : r.dec, credit: c ? r.dec : r.inc, running: r.balance };
    });
    var td = 0, tc = 0; rows.forEach(function (r) { td += r.debit; tc += r.credit; });
    return { party: stm.party, from: cur.from, to: cur.to, opening: stm.opening, rows: rows, totalDebit: td, totalCredit: tc,
      closing: Math.abs(stm.closing) < 0.005 ? 0 : stm.closing, full: stm.full };
  }
  function overlayHtml(p) {
    var t = T();
    return '<div class="modal stm-box"><div class="stm-head"><h3>🧾 كشف حساب: ' + esc(p.name) + '</h3><button type="button" class="ghost small" id="x">✕</button></div>' +
      '<div class="stm-toolbar"><label>من تاريخ <input type="date" id="s-from"></label><label>إلى تاريخ <input type="date" id="s-to"></label>' +
      '<button type="button" class="small" id="s-all">كل الفترة</button><span class="sp"></span>' +
      '<button type="button" class="small primary" id="s-pay">' + t.recBtn + '</button><button type="button" class="small" id="s-disc">خصم</button><button type="button" class="small" id="s-set">تسوية</button>' +
      '<button type="button" class="small stm-pdf" id="s-pdf">PDF</button><button type="button" class="small stm-xls" id="s-xls">Excel</button><button type="button" class="small stm-prn" id="s-prn">طباعة</button></div>' +
      '<div id="s-warn"></div><div class="stm-summary" id="s-sum"></div><div class="stm-tablewrap" id="s-tbl"><div class="empty">جارٍ التحميل…</div></div></div>';
  }
  async function openStatement(id) {
    var p = parties.filter(function (x) { return x.id === id; })[0];
    if (!p) return;
    closeStatement();
    var token = ++openToken;
    cur = { id: id, from: "", to: "", ov: null };
    var ov = document.createElement("div");
    ov.className = "modal-overlay stm-overlay"; ov.innerHTML = overlayHtml(p);
    document.body.appendChild(ov); cur.ov = ov;
    document.body.style.overflow = "hidden";
    ov.onclick = function (e) { if (e.target === ov) closeStatement(); };
    ov.querySelector("#x").onclick = closeStatement;
    ov.querySelector("#s-from").onchange = function () { cur.from = this.value; refresh(); };
    ov.querySelector("#s-to").onchange = function () { cur.to = this.value; refresh(); };
    ov.querySelector("#s-all").onclick = function () { cur.from = cur.to = ""; ov.querySelector("#s-from").value = ""; ov.querySelector("#s-to").value = ""; refresh(); };
    ov.querySelector("#s-pay").onclick = function () { openPay(id); };
    ov.querySelector("#s-disc").onclick = function () { openAdj("discount"); };
    ov.querySelector("#s-set").onclick = function () { openAdj("settlement"); };
    ov.querySelector("#s-prn").onclick = printStatement;
    ov.querySelector("#s-pdf").onclick = function () { UI.toast("في نافذة الطباعة اختر «حفظ كـ PDF»"); printStatement(); };
    ov.querySelector("#s-xls").onclick = exportExcel;
    DB.refresh();                                   // دائمًا بيانات طازجة عند فتح الكشف
    await refresh(token);
  }
  function closeStatement() {
    if (cur && cur.ov) cur.ov.remove();
    cur = null; view = null; openToken++;
    document.body.style.overflow = "";
  }
  async function refresh(token) {
    if (!cur) return;
    token = token || openToken; var id = cur.id;
    var stm = await Ledger.statement(S.type, id, cur.from, cur.to);
    if (!cur || token !== openToken || id !== cur.id) return;        // أُغلق أو فُتح كشف آخر أثناء التحميل
    view = buildView(stm); drawStatement(stm);
  }
  function drawStatement(stm) {
    var V = view, ov = cur.ov, t = T();
    var warn = ov.querySelector("#s-warn");
    warn.innerHTML = "";
    if (!cur.from && !cur.to && Math.abs((Number(V.party.balance) || 0) - V.full) > 0.004) {
      warn.innerHTML = '<div class="stm-warn">الرصيد المسجَّل في بطاقة ' + t.who + ' (<b>' + money(V.party.balance) + '</b>) يختلف عن رصيد الحركات (<b>' + money(V.full) + '</b>). <button type="button" class="small primary" id="fix">اعتماد رصيد الحركات</button></div>';
      warn.querySelector("#fix").onclick = async function () { await Ledger.recompute(S.type, cur.id); UI.toast("تم تحديث الرصيد"); await reloadAll(); };
    }
    ov.querySelector("#s-sum").innerHTML =
      '<div class="box"><small>' + (V.from ? "رصيد أول الفترة" : "الرصيد الافتتاحي") + '</small><b>' + balText(V.opening) + '</b></div>' +
      '<div class="box debit"><small>إجمالي المدين (عليه)</small><b>' + money(V.totalDebit) + '</b></div>' +
      '<div class="box credit"><small>إجمالي الدائن (له)</small><b>' + money(V.totalCredit) + '</b></div>' +
      '<div class="box final"><small>الرصيد الحالي</small><b>' + balText(V.closing) + '</b></div>';
    var body = '<tr class="open"><td>-</td><td>' + (V.from ? "رصيد أول الفترة" : "رصيد افتتاحي") + '</td><td class="c">-</td><td class="c">-</td><td class="c"><b>' + money(V.opening) + '</b></td></tr>';
    if (!V.rows.length && Math.abs(V.opening) < 0.005) {
      ov.querySelector("#s-tbl").innerHTML = '<div class="empty">لا توجد حركات في هذه الفترة</div>'; return;
    }
    V.rows.forEach(function (r) {
      body += '<tr><td dir="ltr" class="nw">' + esc(r.date) + '</td><td>' + esc(r.text) + '</td>' +
        '<td class="c ' + (r.debit ? "dr" : "") + '">' + (r.debit ? money(r.debit) : "-") + '</td>' +
        '<td class="c ' + (r.credit ? "cr" : "") + '">' + (r.credit ? money(r.credit) : "-") + '</td>' +
        '<td class="c"><b>' + money(r.running) + '</b></td></tr>';
    });
    body += '<tr class="tot"><td colspan="2">الإجمالي والرصيد الحالي</td><td class="c dr">' + money(V.totalDebit) + '</td><td class="c cr">' + money(V.totalCredit) + '</td><td class="c">' + balText(V.closing) + '</td></tr>';
    ov.querySelector("#s-tbl").innerHTML = '<table class="stm-table"><thead><tr><th>التاريخ</th><th>البيان</th><th class="c">مدين (عليه)</th><th class="c">دائن (له)</th><th class="c">الرصيد بعد الحركة</th></tr></thead><tbody>' + body + '</tbody></table>';
  }
  async function reloadAll() { await loadAll(); drawList(); if (cur) await refresh(); }

  /* ---------- طباعة / PDF / Excel ---------- */
  function periodText(V) { return (V.from || V.to) ? "من " + (V.from || "البداية") + " إلى " + (V.to || "اليوم") : "كل الفترة"; }
  function safeName(s) { return String(s || "").replace(/[\\\/:*?"<>|]+/g, " ").trim().slice(0, 60) || "كشف"; }
  async function loadCompany() {
    try { var c = await Promise.resolve(DB.getCompany()); if (c && c.name) company = c; } catch (e) {}
  }
  function printHtml(V) {
    var p = V.party, now = new Date(), nm = company.name || "الشركة";
    var printed = now.toISOString().slice(0, 10) + " " + String(now.getHours()).padStart(2, "0") + ":" + String(now.getMinutes()).padStart(2, "0");
    var info = [];
    if (p.code) info.push("<div><span>الكود</span><b>" + esc(p.code) + "</b></div>");
    if (p.phone) info.push('<div><span>الهاتف</span><b dir="ltr">' + esc(p.phone) + "</b></div>");
    if (p.address) info.push("<div><span>العنوان</span><b>" + esc(p.address) + "</b></div>");
    var rows = '<tr class="open"><td>-</td><td>' + (V.from ? "رصيد أول الفترة" : "رصيد افتتاحي") + '</td><td class="n">-</td><td class="n">-</td><td class="n b">' + money(V.opening) + "</td></tr>";
    V.rows.forEach(function (r) {
      rows += '<tr><td class="nw">' + esc(r.date) + "</td><td>" + esc(r.text) + '</td><td class="n' + (r.debit ? " d" : "") + '">' + (r.debit ? money(r.debit) : "-") +
        '</td><td class="n' + (r.credit ? " c" : "") + '">' + (r.credit ? money(r.credit) : "-") + '</td><td class="n b">' + money(r.running) + "</td></tr>";
    });
    rows += '<tr class="tot"><td colspan="2">الإجمالي</td><td class="n d">' + money(V.totalDebit) + '</td><td class="n c">' + money(V.totalCredit) + '</td><td class="n b">' + balText(V.closing) + "</td></tr>";
    var css = "@page{size:A4 portrait;margin:14mm 11mm 16mm}*{box-sizing:border-box;-webkit-print-color-adjust:exact;print-color-adjust:exact}" +
      "body{margin:0;font-family:Cairo,Tahoma,Arial,sans-serif;color:#0e1630;font-size:10pt;line-height:1.5}" +
      ".head{display:flex;justify-content:space-between;align-items:flex-start;border-bottom:2.5px solid #182763;padding-bottom:8px;margin-bottom:12px}" +
      ".head h1{margin:0;font-size:17pt;font-weight:800;color:#182763}.head .sub{font-size:10pt;color:#566382;font-weight:600}" +
      ".head .meta{text-align:left;font-size:8.5pt;color:#566382;line-height:1.7}.head .meta b{color:#0e1630}" +
      ".client{border:1px solid #d3daea;border-radius:8px;padding:9px 12px;margin-bottom:10px;background:#f6f8fd}.client .name{font-size:13pt;font-weight:800;margin-bottom:4px;color:#182763}" +
      ".client .grid{display:flex;flex-wrap:wrap;gap:4px 26px;font-size:9pt}.client .grid span{color:#667391;margin-left:5px}" +
      ".sum{display:grid;grid-template-columns:repeat(4,1fr);gap:8px;margin-bottom:12px}.sum div{border:1px solid #d3daea;border-radius:8px;padding:6px 10px;text-align:center}" +
      ".sum small{display:block;font-size:8pt;color:#667391;font-weight:600}.sum b{font-size:11.5pt;font-weight:800}.sum .d b{color:#b3261e}.sum .c b{color:#1b7a4b}" +
      ".sum .f{background:#182763;border-color:#182763}.sum .f small{color:#c9d3f5}.sum .f b{color:#fff}" +
      "table{width:100%;border-collapse:collapse;font-size:9pt}thead{display:table-header-group}th{background:#182763;color:#fff;font-weight:700;padding:6px 7px;text-align:right;border:1px solid #182763}" +
      "th.n,td.n{text-align:center}td{padding:5px 7px;border:1px solid #d3daea;vertical-align:top}tr{page-break-inside:avoid}tbody tr:nth-child(even){background:#f6f8fd}" +
      "td.nw{white-space:nowrap}td.n{white-space:nowrap}td.b{font-weight:800}td.d{color:#b3261e;font-weight:700}td.c{color:#1b7a4b;font-weight:700}" +
      "tr.open td{background:#e9eefb;font-weight:700}tr.tot td{background:#dfe6fa;font-weight:800;border-top:2px solid #182763}" +
      ".note{margin-top:8px;font-size:8pt;color:#667391}.sign{display:flex;justify-content:space-between;margin-top:26px;gap:30px;page-break-inside:avoid}" +
      ".sign div{flex:1;text-align:center;font-size:9pt;font-weight:700;border-top:1px solid #182763;padding-top:6px}" +
      ".actions{margin-top:20px;text-align:center}.actions button{font:inherit;padding:10px 28px;border:0;border-radius:10px;background:#2a49d6;color:#fff;font-weight:600;cursor:pointer}@media print{.actions{display:none}}";
    var t = T();
    return '<!doctype html><html lang="ar" dir="rtl"><head><meta charset="utf-8"><title>كشف حساب - ' + esc(p.name) + "</title><style>" + css + "</style></head><body>" +
      '<div class="head"><div><h1>' + esc(nm) + '</h1><div class="sub">' + t.docKind + '</div></div><div class="meta">تاريخ الطباعة: <b>' + printed + "</b><br>الفترة: <b>" + esc(periodText(V)) + "</b></div></div>" +
      '<div class="client"><div class="name">' + esc(p.name) + '</div><div class="grid">' + info.join("") + "</div></div>" +
      '<div class="sum"><div><small>' + (V.from ? "رصيد أول الفترة" : "الرصيد الافتتاحي") + "</small><b>" + balText(V.opening) + '</b></div><div class="d"><small>إجمالي المدين (عليه)</small><b>' + money(V.totalDebit) +
      '</b></div><div class="c"><small>إجمالي الدائن (له)</small><b>' + money(V.totalCredit) + '</b></div><div class="f"><small>الرصيد الحالي</small><b>' + balText(V.closing) + "</b></div></div>" +
      '<table><thead><tr><th style="width:22mm">التاريخ</th><th>البيان</th><th class="n" style="width:26mm">مدين (عليه)</th><th class="n" style="width:26mm">دائن (له)</th><th class="n" style="width:30mm">الرصيد بعد الحركة</th></tr></thead><tbody>' + rows + "</tbody></table>" +
      '<div class="note">' + (isC() ? "الرصيد = مستحق على العميل، و(له) = رصيد دائن للعميل." : "الرصيد = مستحق للمورد، و(عليه) = رصيد مدين على المورد.") + (UI.currency() ? " — جميع المبالغ بـ " + esc(UI.currency()) : "") + "</div>" +
      '<div class="sign"><div>المحاسب</div><div>مراجعة</div><div>' + (isC() ? "استلام العميل" : "استلام المورد") + '</div></div><div class="actions"><button onclick="print()">طباعة</button></div></body></html>';
  }
  async function printStatement() {
    if (!view) return;
    await loadCompany();
    var w = window.open("", "_blank", "width=920,height=760");
    if (!w) { UI.toast("اسمح بالنوافذ المنبثقة للطباعة", true); return; }
    w.document.write(printHtml(view)); w.document.close();
    setTimeout(function () { try { w.focus(); w.print(); } catch (e) {} }, 500);
  }
  async function exportExcel() {
    if (!view) return;
    await loadCompany();
    var V = view, p = V.party, t = T();
    var rows = [
      [{ v: (company.name || "الشركة") + " — " + t.docKind, s: "title" }],
      [{ v: p.name, s: "boldtext" }, { v: "الفترة: " + periodText(V) + (UI.currency() ? " — العملة: " + UI.currency() : ""), s: "boldtext" }, { v: "", s: "boldtext" }, { v: "", s: "boldtext" }, { v: "", s: "boldtext" }],
      [{ v: "التاريخ", s: "head" }, { v: "البيان", s: "head" }, { v: "مدين (عليه)", s: "head" }, { v: "دائن (له)", s: "head" }, { v: "الرصيد بعد الحركة", s: "head" }],
      [{ v: "-", s: "date" }, { v: V.from ? "رصيد أول الفترة" : "رصيد افتتاحي", s: "text" }, { v: "", s: "text" }, { v: "", s: "text" }, { v: V.opening, s: "num" }],
    ];
    V.rows.forEach(function (r) {
      rows.push([{ v: r.date, s: "date" }, { v: r.text, s: "text" }, { v: r.debit || 0, s: "num" }, { v: r.credit || 0, s: "num" }, { v: r.running, s: "num" }]);
    });
    rows.push([{ v: "الإجمالي والرصيد الحالي", s: "boldtext" }, { v: "", s: "boldtext" }, { v: V.totalDebit, s: "boldnum" }, { v: V.totalCredit, s: "boldnum" }, { v: V.closing, s: "boldnum" }]);
    Xlsx.download("كشف حساب - " + safeName(p.name) + ".xlsx", { sheet: "كشف حساب", cols: [14, 46, 18, 18, 22], merges: ["A1:E1", "B2:E2"], rows: rows });
  }

  /* ---------- تحصيل / سداد / خصم / تسوية ---------- */
  function openPay(pid) {
    var t = T(), fixed = pid && parties.filter(function (x) { return x.id === pid; })[0];
    var partyField = fixed ? "" : '<div class="field full"><label>' + t.who + '</label><select id="pid">' +
      parties.map(function (p) { return '<option value="' + esc(p.id) + '">' + esc(p.name) + "</option>"; }).join("") + "</select></div>";
    Ledger.modal(t.rec + (fixed ? " — " + esc(fixed.name) : " " + t.who), html`
      <div class="form-grid">
        ${partyField}
        <div class="field"><label>المبلغ</label><input id="amount" type="number" step="0.01" min="0.01" required></div>
        <div class="field"><label>التاريخ</label><input id="date" type="date" value="${today}"></div>
        <div class="field"><label>${isC() ? "إلى خزينة" : "من خزينة"}</label><select id="reg">
          ${regs.map(function (r) { return '<option value="' + esc(r.id) + '">' + esc(r.name) + " (" + money(r.balance) + ")</option>"; }).join("")}
          <option value="">بدون خزينة (تحويل بنكي)</option></select></div>
        <div class="field"><label>التبويب</label><select id="tab"><option value="">— بدون —</option>
          ${tabs.map(function (x) { return '<option value="' + esc(x.id) + '">' + esc(x.name) + "</option>"; }).join("")}</select></div>
        <div class="field full"><label>ملاحظات</label><input id="notes"></div>
      </div>`, async function (ov) {
      var id = fixed ? fixed.id : val("pid"), amount = Number(val("amount")) || 0, regId = val("reg");
      if (!id) throw new Error("اختر " + t.who);
      if (!isC() && regId) {
        var r = regs.filter(function (x) { return x.id === regId; })[0];
        if (r && amount > (Number(r.balance) || 0)) throw new Error("رصيد الخزينة غير كافٍ");
      }
      await Ledger.recordPayment({ party_type: S.type, party_id: id, amount: amount, date: val("date"), register_id: regId, tab_id: val("tab"), notes: val("notes").trim() });
      UI.toast("تم التسجيل"); ov.remove(); await reloadAll();
    }, "ترحيل");
  }
  function openAdj(kind) {
    var p = view && view.party, isD = kind === "discount";
    if (!p) return;
    Ledger.modal((isD ? "خصم على حساب " : "تسوية حساب ") + esc(p.name), html`
      <div class="form-grid">
        <div class="field"><label>المبلغ</label><input id="amount" type="number" step="0.01" min="0.01" required></div>
        <div class="field"><label>التاريخ</label><input id="date" type="date" value="${today}"></div>
        ${isD ? "" : html`<div class="field full"><label>اتجاه التسوية</label><select id="dir">
          <option value="dec">تخفيض الرصيد (يقلل المستحق)</option><option value="inc">زيادة الرصيد (يزيد المستحق)</option></select></div>`}
        <div class="field full"><label>السبب / ملاحظات</label><input id="notes" required></div>
      </div><p class="muted" style="font-size:12px;margin:0">لا تتأثر الخزينة — يُسجَّل قيد يومية تلقائي.</p>`, async function (ov) {
      await Ledger.recordAdjustment({ party_type: S.type, party_id: p.id, kind: kind, amount: Number(val("amount")) || 0, date: val("date"), direction: isD ? "dec" : val("dir"), notes: val("notes").trim() });
      UI.toast("تم التسجيل"); ov.remove(); await reloadAll();
    });
  }

  /* ---------- أحداث الصفحة ---------- */
  document.getElementById("seg").onclick = async function (e) {
    var b = e.target.closest("button"); if (!b || b.dataset.t === S.type) return;
    S.type = b.dataset.t; closeStatement(); drawHead();
    document.getElementById("list").innerHTML = '<div class="empty">جارٍ التحميل…</div>';
    await loadAll(); drawList();
  };
  document.getElementById("search").oninput = function () { S.search = this.value; drawList(); };
  document.getElementById("status").onchange = function () { S.status = this.value; drawList(); };
  document.getElementById("reset").onclick = function () { S.search = ""; S.status = "all"; document.getElementById("search").value = ""; document.getElementById("status").value = "all"; drawList(); };
  document.getElementById("reload").onclick = async function () { await reloadAll(); UI.toast("تم التحديث"); };
  document.getElementById("top-pay").onclick = function () { openPay(""); };
  document.getElementById("list").onclick = function (e) {
    var b = e.target.closest("button[data-a]"), tr = e.target.closest("tr[data-id]");
    if (!tr) return;
    var id = tr.dataset.id;
    if (b && b.dataset.a === "pay") return openPay(id);
    openStatement(id);
  };
  document.addEventListener("keydown", function (e) { if (e.key === "Escape" && cur && !document.querySelector(".modal-overlay:not(.stm-overlay)")) closeStatement(); });

  drawHead();
  try { await loadAll(); } catch (err) { document.getElementById("list").innerHTML = '<div class="empty">' + esc(err.message || "تعذّر التحميل") + "</div>"; return; }
  drawList();
  if (q.get("id") && parties.some(function (p) { return p.id === q.get("id"); })) openStatement(q.get("id"));
})();
