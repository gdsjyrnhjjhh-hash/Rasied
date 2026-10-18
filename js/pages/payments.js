(async function () {
  var page = await UI.init("payments");
  if (!page) return;
  var html = UI.html, money = UI.money;
  var payments = [], customers = [], suppliers = [], registers = [];

  page.innerHTML = html`
    <div class="stack">
      <div class="page-toolbar">
        <div>
          <h2 style="margin:0">سندات قبض وصرف</h2>
          <p class="muted" style="margin:4px 0 0;font-size:12px">تحصيل · سداد · ربط اختياري بالخزينة</p>
        </div>
        <div class="row gap">
          <button type="button" class="primary" id="btn-receipt">+ سند قبض</button>
          <button type="button" id="btn-payment">+ سند صرف</button>
        </div>
      </div>
      <div class="card table-wrap" id="list"></div>
    </div>`;

  function partyName(p) {
    if (p.party_type === "customer") {
      var c = customers.filter(function (x) { return x.id === p.party_id; })[0];
      return c ? c.name : "—";
    }
    var s = suppliers.filter(function (x) { return x.id === p.party_id; })[0];
    return s ? s.name : "—";
  }
  function regName(id) {
    if (!id) return "—";
    var r = registers.filter(function (x) { return x.id === id; })[0];
    return r ? r.name : "—";
  }

  function render() {
    document.getElementById("list").innerHTML = html`
      <table>
        <thead><tr><th>النوع</th><th>الطرف</th><th>المبلغ</th><th>الطريقة</th><th>الخزينة</th><th>التاريخ</th><th>ملاحظات</th></tr></thead>
        <tbody>
          ${payments.length === 0 ? html`<tr><td colspan="7" class="empty">لا توجد سندات</td></tr>` :
            payments.map(function (p) {
              return html`<tr>
                <td><span class="badge ${p.kind === "receipt" ? "ok" : "warn"}">${p.kind === "receipt" ? "قبض" : "صرف"}</span></td>
                <td>${partyName(p)}</td>
                <td><b>${money(p.amount)}</b></td>
                <td>${p.method === "cash" ? "نقدي" : p.method === "bank" ? "بنك" : p.method}</td>
                <td>${regName(p.register_id)}</td>
                <td dir="ltr">${p.date || ""}</td>
                <td class="muted">${p.notes || ""}</td>
              </tr>`;
            }).join("")}
        </tbody>
      </table>`;
  }

  function openForm(kind) {
    var isReceipt = kind === "receipt";
    var parties = isReceipt ? customers : suppliers;
    if (!parties.length) { UI.toast("لا يوجد أطراف", true); return; }
    var ov = document.createElement("div");
    ov.className = "modal-overlay";
    ov.innerHTML = html`<div class="modal card">
      <h3 style="margin-top:0">${isReceipt ? "سند قبض من عميل" : "سند صرف لمورد"}</h3>
      <form id="f" class="stack">
        <div class="form-grid">
          <div class="field"><label>${isReceipt ? "العميل" : "المورد"}</label>
            <select id="party">${parties.map(function (p) {
              return html`<option value="${p.id}">${p.name} (رصيد: ${money(p.balance)})</option>`;
            }).join("")}</select>
          </div>
          <div class="field"><label>المبلغ</label><input id="amount" type="number" step="0.01" required min="0.01"></div>
          <div class="field"><label>الطريقة</label>
            <select id="method">
              <option value="cash">نقدي</option>
              <option value="bank">بنك</option>
            </select>
          </div>
          <div class="field"><label>الخزينة (اختياري)</label>
            <select id="reg">
              <option value="">— بدون —</option>
              ${registers.map(function (r) {
                return html`<option value="${r.id}">${r.name} (${money(r.balance)})</option>`;
              }).join("")}
            </select>
          </div>
          <div class="field"><label>التاريخ</label><input id="date" type="date" value="${new Date().toISOString().slice(0,10)}"></div>
          <div class="field full"><label>ملاحظات</label><input id="notes"></div>
        </div>
        <div class="row gap" style="justify-content:flex-end">
          <button type="button" class="ghost" id="cancel">إلغاء</button>
          <button class="primary" type="submit">حفظ</button>
        </div>
      </form>
    </div>`;
    document.body.appendChild(ov);
    ov.querySelector("#cancel").onclick = function () { ov.remove(); };
    ov.onclick = function (e) { if (e.target === ov) ov.remove(); };
    ov.querySelector("#f").onsubmit = async function (e) {
      e.preventDefault();
      var amount = Number(document.getElementById("amount").value) || 0;
      var partyId = document.getElementById("party").value;
      var regId = document.getElementById("reg").value || null;
      var method = document.getElementById("method").value;
      var date = document.getElementById("date").value;
      try {
        // التحقق أولًا قبل أي كتابة (كان يُحفظ السند ثم يُرفض بسبب الرصيد)
        var reg = regId ? await DB.get("cash_registers", regId, { fresh: true }) : null;
        var newBal = reg ? (isReceipt ? 1 : -1) * amount + (Number(reg.balance) || 0) : 0;
        if (reg && !isReceipt && newBal < 0) { UI.toast("رصيد الخزينة غير كافٍ", true); return; }
        var ptype = isReceipt ? "customer" : "supplier";
        var party = await DB.get(isReceipt ? "customers" : "suppliers", partyId, { fresh: true });
        var jn = await DB.nextNumber("journal_entries");
        var eid = (window.crypto && crypto.randomUUID) ? crypto.randomUUID() : "id-" + Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
        var cashAcc = method === "bank" ? "a2" : "a1";
        var rows = [
          { table: "payments", row: { kind: kind, party_type: ptype, party_id: partyId, amount: amount, method: method, register_id: regId, date: date, notes: document.getElementById("notes").value.trim() } },
          { table: "journal_entries", row: { id: eid, number: jn, date: date, memo: isReceipt ? "سند قبض" : "سند صرف", source: "payment" } },
          { table: "journal_lines", row: { entry_id: eid, account_id: isReceipt ? cashAcc : "a5", debit: amount, credit: 0 } },
          { table: "journal_lines", row: { entry_id: eid, account_id: isReceipt ? "a3" : cashAcc, debit: 0, credit: amount } },
        ];
        if (reg) rows.push({ table: "cash_movements", row: {
          register_id: regId, kind: isReceipt ? "in" : "out", amount: amount, date: date,
          notes: (isReceipt ? "قبض: " : "صرف: ") + partyName({ party_type: ptype, party_id: partyId }),
        } });
        var jobs = [DB.insertRows(rows)];
        if (party) jobs.push(DB.update(isReceipt ? "customers" : "suppliers", party.id, { balance: Math.max(0, (Number(party.balance) || 0) - amount) }));
        if (reg) jobs.push(DB.update("cash_registers", regId, { balance: newBal }));
        await Promise.all(jobs);

        UI.toast("تم حفظ السند");
        ov.remove(); await load();
      } catch (err) { UI.toast(err.message, true); }
    };
  }

  async function load() {
    var d = await Promise.all([
      DB.list("payments"), DB.list("customers"), DB.list("suppliers"), DB.list("cash_registers"),
    ]);
    payments = d[0]; customers = d[1]; suppliers = d[2]; registers = d[3] || [];
    render();
  }

  document.getElementById("btn-receipt").onclick = function () { openForm("receipt"); };
  document.getElementById("btn-payment").onclick = function () { openForm("payment"); };
  await load();
})();
