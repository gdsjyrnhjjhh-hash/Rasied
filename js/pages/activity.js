(async function () {
  var page = await UI.init("activity");
  if (!page) return;
  var html = UI.html, money = UI.money, esc = Ledger.esc;
  var N = function (v) { return Number(v) || 0; };
  var events = [], f = { period: "7", who: "", action: "", grp: "", q: "" }, limit = 300;

  // الجداول المراقَبة: التسمية + المجموعة + كيف نصف السجل
  var SRC = {
    sales: ["فاتورة بيع", "مبيعات"], purchases: ["فاتورة شراء", "مشتريات"], sale_returns: ["مردود بيع", "مرتجعات"], purchase_returns: ["مردود شراء", "مرتجعات"],
    payments: ["سند", "سندات"], expenses: ["مصروف", "مصروفات"], customers: ["عميل", "أطراف وأصناف"], suppliers: ["مورد", "أطراف وأصناف"], products: ["صنف", "أطراف وأصناف"],
    quotes: ["عرض سعر", "عروض وتقارير"], visit_reports: ["تقرير زيارة/مكالمة", "عروض وتقارير"], cheques: ["شيك", "سندات"], cash_registers: ["خزينة", "أخرى"], banks: ["بنك", "أخرى"], employees: ["موظف", "أخرى"],
    journal_entries: ["قيد", "أخرى"],
  };
  var ACT = { add: ["إضافة", "ok"], edit: ["تعديل", "warn"], del: ["حذف", "danger"] };

  page.innerHTML = html`
    <div class="stack">
      <div class="page-toolbar">
        <div>
          <h2 style="margin:0">سجل النشاط</h2>
          <p class="muted" style="margin:4px 0 0;font-size:12px">من أضاف أو حذف أو عدّل ماذا ومتى · للمالك فقط</p>
        </div>
        <button type="button" id="btn-exp">تصدير Excel</button>
      </div>
      <div class="card muted" style="font-size:12px;line-height:1.8">
        يُسجَّل هنا كل ما يُضاف، وكل ما يُحذف من المستندات والأطراف، وتعديل السندات. تعديلات الفواتير العادية لا تُسجَّل بعد.
        السجلات القديمة قبل تفعيل السجل تظهر كإضافات فقط ولا يظهر ما حُذف منها.
      </div>
      <div class="card"><div class="row gap" style="flex-wrap:wrap;align-items:flex-end">
        <div class="field"><label>الفترة</label><select id="f-period"><option value="1">اليوم</option><option value="7" selected>آخر 7 أيام</option><option value="30">آخر 30 يومًا</option><option value="all">الكل</option></select></div>
        <div class="field"><label>المستخدم</label><select id="f-who"><option value="">الكل</option></select></div>
        <div class="field"><label>العملية</label><select id="f-action"><option value="">الكل</option>${Object.keys(ACT).map(function (k) { return html`<option value="${k}">${ACT[k][0]}</option>`; }).join("")}</select></div>
        <div class="field"><label>النوع</label><select id="f-grp"><option value="">الكل</option></select></div>
        <div class="field" style="flex:1;min-width:150px"><label>بحث</label><input id="f-q" placeholder="رقم أو اسم..."></div>
      </div></div>
      <div class="stats-grid" id="stats"></div>
      <div class="card table-wrap" id="list"><div class="empty">جارٍ التحميل...</div></div>
    </div>`;

  function fmt(at) {
    try { return new Date(at).toLocaleString("en-GB", { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" }); } catch (e) { return String(at || "").slice(0, 16); }
  }

  async function load() {
    DB.refresh();
    var tables = Object.keys(SRC).concat(["activity_log"]);
    var got = await Promise.all(tables.map(function (t) { return DB.list(t).catch(function () { return []; }); }));
    var data = {}; tables.forEach(function (t, i) { data[t] = got[i] || []; });
    var cust = {}, sup = {};
    data.customers.forEach(function (c) { cust[c.id] = c.name; }); data.suppliers.forEach(function (c) { sup[c.id] = c.name; });
    var pname = function (id) { return cust[id] || sup[id] || ""; };
    var ev = [];
    function describe(t, r) {
      var lab = SRC[t][0], num = r.number != null && r.number !== "" ? " #" + r.number : "";
      if (t === "payments") return (r.kind === "receipt" ? "سند قبض" : "سند صرف") + (pname(r.party_id) ? " — " + pname(r.party_id) : "");
      if (t === "sales" || t === "sale_returns") return lab + num + (pname(r.customer_id) ? " — " + pname(r.customer_id) : "");
      if (t === "purchases" || t === "purchase_returns") return lab + num + (pname(r.supplier_id) ? " — " + pname(r.supplier_id) : "");
      if (t === "customers" || t === "suppliers" || t === "products" || t === "cash_registers" || t === "banks" || t === "employees") return lab + ": " + (r.name || "—");
      if (t === "quotes") return lab + num + (r.party_name ? " — " + r.party_name : "");
      if (t === "visit_reports") return lab + (r.party_name ? ": " + r.party_name : "");
      if (t === "expenses") return lab + (r.title || r.category || r.notes ? ": " + (r.title || r.category || r.notes) : "");
      if (t === "journal_entries") return (r.source === "capital" ? "قيد رأس مال" : "قيد يومية") + num + (r.memo ? " — " + r.memo : "");
      return lab + num;
    }
    Object.keys(SRC).forEach(function (t) {
      data[t].forEach(function (r) {
        if (t === "journal_entries" && r.source && r.source !== "manual" && r.source !== "capital") return; // القيود التلقائية تتبع مستنداتها
        if (r.created_at) ev.push({ at: r.created_at, who: r.by_name || "", whoId: r.by || "", act: "add", grp: SRC[t][1], text: describe(t, r), amount: N(r.total != null ? r.total : r.amount != null ? r.amount : r.cap_amount) });
        if (r.edited_at) ev.push({ at: r.edited_at, who: r.edited_by_name || "", whoId: r.edited_by || "", act: "edit", grp: SRC[t][1], text: describe(t, r), amount: N(r.total != null ? r.total : r.amount) });
      });
    });
    data.activity_log.forEach(function (l) {
      var t = SRC[l.tbl] ? l.tbl : null, lab = t ? SRC[t][0] : (l.tbl || "سجل");
      var txt = (l.tbl === "payments" ? (l.kind === "receipt" ? "سند قبض" : "سند صرف") : lab) + (l.ref_number !== "" && l.ref_number != null ? " #" + l.ref_number : "") + (l.ref_name ? ": " + l.ref_name : "") + (pname(l.party_id) ? " — " + pname(l.party_id) : "");
      ev.push({ at: l.created_at, who: l.by_name || "", whoId: l.by || "", act: "del", grp: t ? SRC[t][1] : "أخرى", text: txt, amount: N(l.amount) });
    });
    ev.sort(function (a, b) { return String(b.at).localeCompare(String(a.at)); });
    events = ev;
    var users = {}; ev.forEach(function (e) { var k = e.who || "—"; users[k] = 1; });
    var sel = document.getElementById("f-who"); sel.innerHTML = '<option value="">الكل</option>' + Object.keys(users).map(function (u) { return "<option>" + esc(u) + "</option>"; }).join("");
    var groups = {}; ev.forEach(function (e) { groups[e.grp] = 1; });
    document.getElementById("f-grp").innerHTML = '<option value="">الكل</option>' + Object.keys(groups).map(function (g) { return "<option>" + esc(g) + "</option>"; }).join("");
    render();
  }

  function filtered() {
    var cut = f.period === "all" ? "" : new Date(Date.now() - (Number(f.period) - (f.period === "1" ? 1 : 0)) * 86400000).toISOString();
    if (f.period === "1") cut = new Date().toISOString().slice(0, 10);
    var q = f.q.trim().toLowerCase();
    return events.filter(function (e) {
      if (cut && String(e.at) < cut) return false;
      if (f.who && (e.who || "—") !== f.who) return false;
      if (f.action && e.act !== f.action) return false;
      if (f.grp && e.grp !== f.grp) return false;
      return !q || (e.text + " " + (e.who || "")).toLowerCase().indexOf(q) !== -1;
    });
  }

  function render() {
    var list = filtered(), shown = list.slice(0, limit);
    var cnt = function (a) { return list.filter(function (e) { return e.act === a; }).length; };
    document.getElementById("stats").innerHTML = [["إضافات", cnt("add")], ["تعديلات", cnt("edit")], ["حذف", cnt("del")]]
      .map(function (s) { return '<div class="stat card"><div class="muted" style="font-size:12px">' + s[0] + '</div><div style="font-size:22px;font-weight:800">' + s[1] + "</div></div>"; }).join("");
    document.getElementById("list").innerHTML = html`
      <table><thead><tr><th>الوقت</th><th>المستخدم</th><th>العملية</th><th>التفاصيل</th><th>المبلغ</th></tr></thead>
      <tbody>${shown.length === 0 ? html`<tr><td colspan="5" class="empty">لا توجد أنشطة في هذه الفترة</td></tr>` : shown.map(function (e) {
        return html`<tr><td dir="ltr" class="nw">${fmt(e.at)}</td><td>${esc(e.who || "—")}</td>
          <td><span class="badge ${ACT[e.act][1]}">${ACT[e.act][0]}</span></td><td>${esc(e.text)}</td><td>${e.amount ? money(e.amount) : "—"}</td></tr>`; }).join("")}
      ${list.length > shown.length ? html`<tr><td colspan="5" style="text-align:center"><button type="button" id="more">عرض المزيد (${list.length - shown.length})</button></td></tr>` : ""}
      </tbody></table>`;
    var m = document.getElementById("more"); if (m) m.onclick = function () { limit += 300; render(); };
  }

  [["f-period", "period"], ["f-who", "who"], ["f-action", "action"], ["f-grp", "grp"]].forEach(function (p) {
    document.getElementById(p[0]).onchange = function () { f[p[1]] = this.value; limit = 300; render(); };
  });
  document.getElementById("f-q").oninput = function () { f.q = this.value; limit = 300; render(); };
  document.getElementById("btn-exp").onclick = async function () {
    try { await UI.need("js/xlsx-lite.js", "Xlsx"); } catch (e) { UI.toast(e.message, true); return; }
    var list = filtered(); if (!list.length) { UI.toast("لا توجد بيانات للتصدير", true); return; }
    var head = ["الوقت", "المستخدم", "العملية", "التفاصيل", "المبلغ"].map(function (h) { return { v: h, s: "head" }; });
    Xlsx.download("سجل-النشاط-" + new Date().toISOString().slice(0, 10) + ".xlsx", { sheet: "سجل النشاط", rows: [head].concat(list.map(function (e) { return [fmt(e.at), e.who || "", ACT[e.act][0], e.text, e.amount || 0]; })), cols: [18, 18, 10, 50, 14] });
  };
  try { await load(); } catch (err) { document.getElementById("list").innerHTML = '<div class="empty">تعذّر تحميل السجل: ' + esc(err.message) + "</div>"; }
})();
