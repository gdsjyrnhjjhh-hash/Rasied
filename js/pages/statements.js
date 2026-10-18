(async function () {
  var page = await UI.init("statements");
  if (!page) return;
  var html = UI.html, money = UI.money, esc = Ledger.esc, val = Ledger.val;
  var q = new URLSearchParams(location.search);
  var f = { type: q.get("type") === "supplier" ? "supplier" : "customer", id: q.get("id") || "", from: "", to: "" };
  var parties = [], registers = [], tabs = [], stm = null;
  var today = Ledger.today();

  page.innerHTML = html`
    <div class="stack">
      <div class="page-toolbar">
        <div>
          <h2 style="margin:0">كشف الحساب</h2>
          <p class="muted" style="margin:4px 0 0;font-size:12px">حركة العميل أو المورد بالرصيد الجاري · تحصيل وسداد · خصم وتسوية</p>
        </div>
        <div class="row gap" id="actions"></div>
      </div>
      <div class="card">
        <div class="form-grid">
          <div class="field"><label>النوع</label><select id="type"><option value="customer">عميل</option><option value="supplier">مورد</option></select></div>
          <div class="field"><label>الطرف</label><select id="party"></select></div>
          <div class="field"><label>من تاريخ</label><input type="date" id="from"></div>
          <div class="field"><label>إلى تاريخ</label><input type="date" id="to"></div>
        </div>
      </div>
      <div class="stats" id="stats"></div>
      <div class="card table-wrap"><div class="panel-title"><h3 id="ttl">كشف الحساب</h3>
        <div class="row gap"><button type="button" class="small" id="csv">تصدير Excel</button><button type="button" class="small" id="prn">طباعة</button></div></div>
        <div id="tbl"></div></div>
    </div>`;

  function isC() { return f.type === "customer"; }
  var L = function () { return isC() ? { inc: "مدين", dec: "دائن", who: "العميل", rec: "تحصيل", recBtn: "+ تحصيل من العميل" } : { inc: "دائن", dec: "مدين", who: "المورد", rec: "سداد", recBtn: "+ سداد للمورد" }; };

  async function loadParties() {
    var d = await Promise.all([DB.list(isC() ? "customers" : "suppliers"), DB.list("cash_registers"), DB.list("treasury_tabs")]);
    parties = d[0].slice().sort(function (a, b) { return (a.name || "").localeCompare(b.name || "", "ar"); });
    registers = d[1]; tabs = d[2];
    if (!parties.some(function (p) { return p.id === f.id; })) f.id = parties[0] ? parties[0].id : "";
    document.getElementById("type").value = f.type;
    document.getElementById("party").innerHTML = parties.map(function (p) {
      return '<option value="' + p.id + '"' + (p.id === f.id ? " selected" : "") + ">" + esc(p.name) + "</option>";
    }).join("") || "<option value=''>— لا يوجد —</option>";
  }

  async function draw() {
    var lb = L();
    document.getElementById("actions").innerHTML = f.id ? html`
      <button type="button" class="primary" id="b-pay">${lb.recBtn}</button>
      <button type="button" id="b-disc">خصم</button>
      <button type="button" id="b-set">تسوية</button>` : "";
    if (!f.id) {
      document.getElementById("stats").innerHTML = "";
      document.getElementById("tbl").innerHTML = '<div class="empty">لا يوجد ' + (isC() ? "عملاء" : "موردون") + " بعد</div>";
      return;
    }
    stm = await Ledger.statement(f.type, f.id, f.from, f.to);
    var p = stm.party;
    var warn = document.getElementById("warn");
    if (warn) warn.remove();
    if (!f.from && !f.to && Math.abs((Number(p.balance) || 0) - stm.full) > 0.004) {
      var w = document.createElement("div");
      w.id = "warn"; w.className = "card";
      w.innerHTML = '<div class="row gap" style="justify-content:space-between;align-items:center"><span>الرصيد المسجَّل في بطاقة الطرف (<b>' + money(p.balance) + '</b>) يختلف عن رصيد الحركات (<b>' + money(stm.full) + '</b>).</span><button type="button" class="small primary" id="fix">اعتماد رصيد الحركات</button></div>';
      document.getElementById("stats").before(w);
      document.getElementById("fix").onclick = async function () { await Ledger.recompute(f.type, f.id); UI.toast("تم تحديث الرصيد"); draw(); };
    }
    document.getElementById("ttl").textContent = "كشف حساب: " + (p.name || "");
    document.getElementById("stats").innerHTML = html`
      <div class="stat"><div class="label">رصيد سابق</div><div class="value">${money(stm.opening)}</div></div>
      <div class="stat amber"><div class="label">إجمالي ${lb.inc}</div><div class="value">${money(stm.totals.inc)}</div></div>
      <div class="stat green"><div class="label">إجمالي ${lb.dec}</div><div class="value">${money(stm.totals.dec)}</div></div>
      <div class="stat ${stm.closing > 0 ? "red" : "teal"}"><div class="label">الرصيد الحالي</div><div class="value">${money(stm.closing)}</div></div>`;
    document.getElementById("tbl").innerHTML = html`
      <table>
        <thead><tr><th>التاريخ</th><th>البيان</th><th>رقم</th><th>${lb.inc}</th><th>${lb.dec}</th><th>الرصيد</th></tr></thead>
        <tbody>
          <tr><td colspan="5" class="muted">رصيد سابق / افتتاحي</td><td><b>${money(stm.opening)}</b></td></tr>
          ${stm.rows.map(function (r) {
            return html`<tr>
              <td dir="ltr">${r.date}</td>
              <td><span class="badge ${r.dec ? "ok" : "warn"}">${Ledger.KIND_LABEL[r.kind] || r.kind}</span> <span class="muted">${r.desc}</span></td>
              <td dir="ltr">${r.ref || ""}</td>
              <td>${r.inc ? money(r.inc) : ""}</td><td>${r.dec ? money(r.dec) : ""}</td>
              <td class="accent"><b>${money(r.balance)}</b></td></tr>`;
          }).join("") || html`<tr><td colspan="6" class="empty">لا توجد حركات في هذه الفترة</td></tr>`}
        </tbody>
      </table>`;
    document.getElementById("b-pay").onclick = openPay;
    document.getElementById("b-disc").onclick = function () { openAdj("discount"); };
    document.getElementById("b-set").onclick = function () { openAdj("settlement"); };
  }

  function openPay() {
    var lb = L(), p = stm.party;
    Ledger.modal(lb.rec + " — " + esc(p.name), html`
      <div class="form-grid">
        <div class="field"><label>المبلغ</label><input id="amount" type="number" step="0.01" min="0.01" required></div>
        <div class="field"><label>التاريخ</label><input id="date" type="date" value="${today}"></div>
        <div class="field"><label>${isC() ? "إلى خزينة" : "من خزينة"}</label><select id="reg">
          ${registers.map(function (r) { return '<option value="' + r.id + '">' + esc(r.name) + "</option>"; }).join("")}
          <option value="">بدون خزينة (تحويل بنكي)</option></select></div>
        <div class="field"><label>التبويب</label><select id="tab"><option value="">— بدون —</option>
          ${tabs.map(function (t) { return '<option value="' + t.id + '">' + esc(t.name) + "</option>"; }).join("")}</select></div>
        <div class="field full"><label>ملاحظات</label><input id="notes"></div>
      </div>`, async function (ov) {
      var amount = Number(val("amount")) || 0, regId = val("reg");
      if (!isC() && regId) {
        var r = registers.filter(function (x) { return x.id === regId; })[0];
        if (amount > (Number(r.balance) || 0)) throw new Error("رصيد الخزينة غير كافٍ");
      }
      await Ledger.recordPayment({ party_type: f.type, party_id: f.id, amount: amount, date: val("date"), register_id: regId, tab_id: val("tab"), notes: val("notes").trim() });
      UI.toast("تم التسجيل"); ov.remove(); await reload();
    }, "ترحيل");
  }

  function openAdj(kind) {
    var p = stm.party, isD = kind === "discount";
    Ledger.modal((isD ? "خصم على حساب " : "تسوية حساب ") + esc(p.name), html`
      <div class="form-grid">
        <div class="field"><label>المبلغ</label><input id="amount" type="number" step="0.01" min="0.01" required></div>
        <div class="field"><label>التاريخ</label><input id="date" type="date" value="${today}"></div>
        ${isD ? "" : html`<div class="field full"><label>اتجاه التسوية</label><select id="dir">
          <option value="dec">تخفيض الرصيد (يقلل المستحق)</option>
          <option value="inc">زيادة الرصيد (يزيد المستحق)</option></select></div>`}
        <div class="field full"><label>السبب / ملاحظات</label><input id="notes" required></div>
      </div>
      <p class="muted" style="font-size:12px;margin:0">لا تتأثر الخزينة — يُسجَّل قيد يومية تلقائي.</p>`, async function (ov) {
      await Ledger.recordAdjustment({
        party_type: f.type, party_id: f.id, kind: kind, amount: Number(val("amount")) || 0, date: val("date"),
        direction: isD ? "dec" : val("dir"), notes: val("notes").trim(),
      });
      UI.toast("تم التسجيل"); ov.remove(); await reload();
    });
  }

  async function reload() { await draw(); }

  document.getElementById("type").onchange = async function () { f.type = val("type"); f.id = ""; await loadParties(); await draw(); };
  document.getElementById("party").onchange = function () { f.id = val("party"); draw(); };
  document.getElementById("from").onchange = function () { f.from = val("from"); draw(); };
  document.getElementById("to").onchange = function () { f.to = val("to"); draw(); };

  document.getElementById("csv").onclick = function () {
    if (!stm) return;
    var lb = L();
    UI.exportCSV("كشف-" + (stm.party.name || "") + ".csv", ["التاريخ", "البيان", "رقم", lb.inc, lb.dec, "الرصيد"],
      [["", "رصيد سابق", "", "", "", stm.opening]].concat(stm.rows.map(function (r) {
        return [r.date, (Ledger.KIND_LABEL[r.kind] || r.kind) + (r.desc ? " — " + r.desc : ""), r.ref || "", r.inc || "", r.dec || "", r.balance];
      })));
  };
  document.getElementById("prn").onclick = function () {
    if (!stm) return;
    var lb = L(), co = DB.getCompany(), p = stm.party;
    UI.printHTML("كشف حساب", "<h1>" + esc(co.name || "") + "</h1><h2>كشف حساب " + lb.who + "</h2>" +
      '<div class="meta"><div><div><b>' + esc(p.name) + "</b></div><div>" + esc(p.phone || "") + "</div></div><div><div>الفترة: " + (f.from || "البداية") + " → " + (f.to || "اليوم") +
      "</div><div>الرصيد الحالي: <b>" + money(stm.closing) + "</b></div></div></div>" +
      "<table><thead><tr><th>التاريخ</th><th>البيان</th><th>رقم</th><th>" + lb.inc + "</th><th>" + lb.dec + "</th><th>الرصيد</th></tr></thead><tbody>" +
      '<tr><td colspan="5">رصيد سابق</td><td>' + money(stm.opening) + "</td></tr>" +
      stm.rows.map(function (r) {
        return "<tr><td>" + r.date + "</td><td>" + (Ledger.KIND_LABEL[r.kind] || r.kind) + (r.desc ? " — " + esc(r.desc) : "") + "</td><td>" + (r.ref || "") + "</td><td>" +
          (r.inc ? money(r.inc) : "") + "</td><td>" + (r.dec ? money(r.dec) : "") + "</td><td>" + money(r.balance) + "</td></tr>";
      }).join("") + "</tbody></table>");
  };

  await loadParties();
  await draw();
})();
