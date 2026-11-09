(async function () {
  var page = await UI.init("aging");
  if (!page) return;
  var html = UI.html, money = UI.money, esc = Ledger.esc;
  var N = function (v) { return Number(v) || 0; };
  var type = "customer", rows = [], q = "", flt = "all", loaded = false;
  var company = DB.getCompany() || {};
  var cur = company.currency || "";
  var BK = ["0–30 يوم", "31–60 يوم", "61–90 يوم", "أكثر من 90"];

  page.innerHTML = html`
    <div class="stack">
      <div class="page-toolbar">
        <div>
          <h2 style="margin:0">أعمار الديون والتحصيل</h2>
          <p class="muted" style="margin:4px 0 0;font-size:12px">اعرف مين متأخر وبقاله قد إيه · تذكير واتساب بضغطة · الأقدم يُسدَّد أولًا</p>
        </div>
        <div class="row gap">
          <div class="seg" id="seg"><button type="button" data-t="customer" class="on">العملاء</button><button type="button" data-t="supplier">الموردين</button></div>
          <button type="button" id="btn-exp">تصدير Excel</button>
        </div>
      </div>
      <div class="stats-grid" id="stats"></div>
      <div class="card"><div class="row gap" style="flex-wrap:wrap;align-items:flex-end">
        <div class="field" style="flex:1;min-width:160px"><label>بحث</label><input id="f-q" placeholder="اسم أو هاتف..."></div>
        <div class="field"><label>عرض</label><select id="f-flt"><option value="all">كل المدينين</option><option value="30">متأخر أكثر من 30 يوم</option><option value="60">متأخر أكثر من 60 يوم</option><option value="90">متأخر أكثر من 90 يوم</option></select></div>
      </div></div>
      <div class="card table-wrap" id="list"><div class="empty">جارٍ التحميل...</div></div>
    </div>`;

  function today() { return Ledger.today(); }
  function daysBetween(a, b) { return Math.max(0, Math.round((new Date(b + "T12:00:00") - new Date(a + "T12:00:00")) / 86400000)); }
  function bucketOf(days) { return days <= 30 ? 0 : days <= 60 ? 1 : days <= 90 ? 2 : 3; }

  async function build() {
    var isC = type === "customer", t = today();
    var d = await Promise.all([
      DB.list(isC ? "customers" : "suppliers"), DB.list(isC ? "sales" : "purchases"), DB.list(isC ? "sale_returns" : "purchase_returns"),
      DB.list("payments"), DB.list("party_txns"),
    ]);
    var parties = d[0] || [], out = [];
    for (var i = 0; i < parties.length; i++) {
      var p = parties[i];
      var st = await Ledger.statement(type, p.id, null, null, { party: p, docs: d[1] || [], rets: d[2] || [], pays: d[3] || [], txns: d[4] || [] });
      var total = N(st.closing);
      if (total <= 0.004) continue;
      var b = [0, 0, 0, 0], remaining = total, oldest = "", lastPay = "";
      st.rows.forEach(function (r) { if ((r.kind === "receipt" || r.kind === "payment") && (!lastPay || r.date > lastPay)) lastPay = r.date; });
      var debits = st.rows.filter(function (r) { return r.inc > 0; }).sort(function (a, c) { return a.date < c.date ? 1 : a.date > c.date ? -1 : 0; });
      for (var j = 0; j < debits.length && remaining > 0.004; j++) {
        var take = Math.min(N(debits[j].inc), remaining);
        b[bucketOf(daysBetween(debits[j].date, t))] += take; remaining -= take; oldest = debits[j].date;
      }
      if (remaining > 0.004) { b[3] += remaining; oldest = "قبل ذلك"; }
      out.push({ id: p.id, name: p.name || "—", phone: p.phone || "", total: total, b: b, oldest: oldest, lastPay: lastPay, late: b[1] + b[2] + b[3] });
    }
    return out.sort(function (a, c) { return c.total - a.total; });
  }

  function view() {
    var t = q.trim().toLowerCase(), min = flt === "all" ? 0 : Number(flt);
    return rows.filter(function (r) {
      if (t && (r.name + " " + r.phone).toLowerCase().indexOf(t) === -1) return false;
      if (min === 30) return r.late > 0.004;
      if (min === 60) return r.b[2] + r.b[3] > 0.004;
      if (min === 90) return r.b[3] > 0.004;
      return true;
    });
  }

  function render() {
    var list = view(), sum = function (f) { return rows.reduce(function (s, r) { return s + f(r); }, 0); };
    var isC = type === "customer";
    document.getElementById("stats").innerHTML = [
      [isC ? "إجمالي المستحق لك" : "إجمالي المستحق عليك", sum(function (r) { return r.total; })],
      ["متأخر أكثر من 30 يوم", sum(function (r) { return r.late; })],
      ["متأخر أكثر من 90 يوم", sum(function (r) { return r.b[3]; })],
      [isC ? "عدد العملاء المدينين" : "عدد الموردين الدائنين", rows.length, true],
    ].map(function (s) { return '<div class="stat card"><div class="muted" style="font-size:12px">' + s[0] + '</div><div style="font-size:22px;font-weight:800">' + (s[2] ? s[1] : money(s[1])) + "</div></div>"; }).join("");
    document.getElementById("list").innerHTML = html`
      <table><thead><tr><th>${isC ? "العميل" : "المورد"}</th><th>الهاتف</th>${BK.map(function (x) { return html`<th>${x}</th>`; }).join("")}<th>الإجمالي</th><th>آخر ${isC ? "تحصيل" : "سداد"}</th><th></th></tr></thead>
      <tbody>${!loaded ? html`<tr><td colspan="9" class="empty">جارٍ التحميل...</td></tr>` : list.length === 0 ? html`<tr><td colspan="9" class="empty">${rows.length ? "لا توجد نتائج" : (isC ? "لا توجد ديون على العملاء 🎉" : "لا توجد مستحقات للموردين")}</td></tr>` : list.map(function (r) {
        return html`<tr data-id="${r.id}">
          <td><b>${esc(r.name)}</b></td><td dir="ltr">${esc(r.phone) || "—"}</td>
          ${r.b.map(function (v, i) { return html`<td class="${v > 0.004 && i >= 2 ? "accent" : ""}">${v > 0.004 ? money(v) : "—"}</td>`; }).join("")}
          <td><b>${money(r.total)}</b></td><td dir="ltr">${r.lastPay || "—"}</td>
          <td class="nw">${isC ? html`<button type="button" class="sm primary" data-act="wa">تذكير واتساب</button>` : ""}</td></tr>`; }).join("")}</tbody></table>`;
  }

  async function load(t) {
    type = t; loaded = false; render();
    try { DB.refresh(); rows = await build(); } catch (err) { rows = []; UI.toast(err.message, true); }
    loaded = true; render();
  }

  document.getElementById("seg").onclick = function (e) {
    var b = e.target.closest("[data-t]"); if (!b) return;
    this.querySelectorAll("button").forEach(function (x) { x.classList.toggle("on", x === b); });
    load(b.getAttribute("data-t"));
  };
  document.getElementById("f-q").oninput = function () { q = this.value; render(); };
  document.getElementById("f-flt").onchange = function () { flt = this.value; render(); };
  document.getElementById("list").onclick = function (e) {
    var b = e.target.closest('[data-act="wa"]'); if (!b) return;
    var r = rows.filter(function (x) { return x.id === b.closest("tr").getAttribute("data-id"); })[0]; if (!r) return;
    var msg = "السلام عليكم " + r.name + "،\nتحية طيبة" + (company.name ? " من " + company.name : "") + ".\nنود تذكير حضرتك بأن رصيد حسابكم المستحق حاليًا " + money(r.total) + (cur ? " " + cur : "") +
      (r.late > 0.004 ? "، منها " + money(r.late) + (cur ? " " + cur : "") + " مضى عليها أكثر من 30 يومًا" : "") + ".\nبرجاء التكرم بالسداد في أقرب وقت، وشكرًا لتعاملكم معنا.";
    UI.whatsapp(r.phone, msg);
  };
  document.getElementById("btn-exp").onclick = async function () {
    try { await UI.need("js/xlsx-lite.js", "Xlsx"); } catch (e) { UI.toast(e.message, true); return; }
    var list = view(); if (!list.length) { UI.toast("لا توجد بيانات للتصدير", true); return; }
    var head = [type === "customer" ? "العميل" : "المورد", "الهاتف"].concat(BK, ["الإجمالي", "آخر دفعة"]).map(function (h) { return { v: h, s: "head" }; });
    var body = list.map(function (r) { return [r.name, r.phone].concat(r.b, [r.total, r.lastPay]); });
    Xlsx.download("اعمار-الديون-" + today() + ".xlsx", { sheet: "أعمار الديون", rows: [head].concat(body), cols: [26, 14, 14, 14, 14, 14, 16, 14] });
  };
  await load("customer");
})();
