(async function () {
  var page = await UI.init("cash-registers");
  if (!page) return;
  var html = UI.html, money = UI.money;
  var registers = [], movements = [];

  page.innerHTML = html`
    <div class="stack">
      <div class="page-toolbar">
        <div>
          <h2 style="margin:0">الخزائن</h2>
          <p class="muted" style="margin:4px 0 0;font-size:12px">أرصدة نقدية · إيداع · صرف</p>
        </div>
        <div class="row gap">
          <button type="button" class="primary" id="btn-add">+ خزينة</button>
          <button type="button" id="btn-move">+ حركة</button>
        </div>
      </div>
      <div class="stats" id="stats"></div>
      <div class="card table-wrap" id="list"></div>
      <div class="card table-wrap">
        <div class="panel-title"><h3>آخر الحركات</h3></div>
        <div id="moves"></div>
      </div>
    </div>`;

  function render() {
    var total = registers.reduce(function (s, r) { return s + (Number(r.balance) || 0); }, 0);
    document.getElementById("stats").innerHTML = html`
      <div class="stat teal"><div class="label">إجمالي النقدية</div><div class="value">${money(total)}</div></div>
      <div class="stat"><div class="label">عدد الخزائن</div><div class="value">${registers.length}</div></div>`;

    document.getElementById("list").innerHTML = html`
      <table>
        <thead><tr><th>الخزينة</th><th>الموقع</th><th>الرصيد</th><th></th></tr></thead>
        <tbody>
          ${registers.map(function (r) {
            return html`<tr>
              <td><b>${r.name}</b></td>
              <td>${r.location || "—"}</td>
              <td class="accent"><b>${money(r.balance)}</b></td>
              <td>
                <button class="small" data-act="edit" data-id="${r.id}">تعديل</button>
                <button class="small danger" data-act="del" data-id="${r.id}">حذف</button>
              </td>
            </tr>`;
          }).join("") || html`<tr><td colspan="4" class="empty">لا توجد خزائن</td></tr>`}
        </tbody>
      </table>`;

    document.getElementById("moves").innerHTML = html`
      <table>
        <thead><tr><th>النوع</th><th>الخزينة</th><th>المبلغ</th><th>التاريخ</th><th>ملاحظات</th></tr></thead>
        <tbody>
          ${movements.slice(0, 30).map(function (m) {
            var reg = registers.filter(function (r) { return r.id === m.register_id; })[0];
            return html`<tr>
              <td><span class="badge ${m.kind === "in" ? "ok" : "warn"}">${m.kind === "in" ? "إيداع" : "صرف"}</span></td>
              <td>${reg ? reg.name : "—"}</td>
              <td><b>${money(m.amount)}</b></td>
              <td dir="ltr">${m.date || ""}</td>
              <td class="muted">${m.notes || ""}</td>
            </tr>`;
          }).join("") || html`<tr><td colspan="5" class="empty">لا حركات</td></tr>`}
        </tbody>
      </table>`;
  }

  function openReg(r) {
    var isNew = !r;
    r = r || { name: "", location: "", balance: 0 };
    var ov = document.createElement("div");
    ov.className = "modal-overlay";
    ov.innerHTML = html`<div class="modal card">
      <h3 style="margin-top:0">${isNew ? "خزينة جديدة" : "تعديل خزينة"}</h3>
      <form id="f" class="stack">
        <div class="form-grid">
          <div class="field"><label>الاسم</label><input id="name" required value="${r.name || ""}"></div>
          <div class="field"><label>الموقع</label><input id="loc" value="${r.location || ""}"></div>
          ${isNew ? html`<div class="field"><label>رصيد افتتاحي</label><input id="bal" type="number" step="0.01" value="0"></div>` : ""}
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
      try {
        if (isNew) {
          await DB.insert("cash_registers", {
            name: document.getElementById("name").value.trim(),
            location: document.getElementById("loc").value.trim(),
            balance: Number(document.getElementById("bal").value) || 0,
          });
        } else {
          await DB.update("cash_registers", r.id, {
            name: document.getElementById("name").value.trim(),
            location: document.getElementById("loc").value.trim(),
          });
        }
        UI.toast("تم الحفظ"); ov.remove(); await load();
      } catch (err) { UI.toast(err.message, true); }
    };
  }

  function openMove() {
    if (!registers.length) { UI.toast("أضف خزينة أولاً", true); return; }
    var ov = document.createElement("div");
    ov.className = "modal-overlay";
    ov.innerHTML = html`<div class="modal card">
      <h3 style="margin-top:0">حركة خزينة</h3>
      <form id="f" class="stack">
        <div class="form-grid">
          <div class="field"><label>الخزينة</label>
            <select id="reg">${registers.map(function (r) {
              return html`<option value="${r.id}">${r.name} (${money(r.balance)})</option>`;
            }).join("")}</select>
          </div>
          <div class="field"><label>النوع</label>
            <select id="kind"><option value="in">إيداع</option><option value="out">صرف</option></select>
          </div>
          <div class="field"><label>المبلغ</label><input id="amount" type="number" step="0.01" required min="0.01"></div>
          <div class="field"><label>التاريخ</label><input id="date" type="date" value="${new Date().toISOString().slice(0,10)}"></div>
          <div class="field full"><label>ملاحظات</label><input id="notes"></div>
        </div>
        <div class="row gap" style="justify-content:flex-end">
          <button type="button" class="ghost" id="cancel">إلغاء</button>
          <button class="primary" type="submit">ترحيل</button>
        </div>
      </form>
    </div>`;
    document.body.appendChild(ov);
    ov.querySelector("#cancel").onclick = function () { ov.remove(); };
    ov.onclick = function (e) { if (e.target === ov) ov.remove(); };
    ov.querySelector("#f").onsubmit = async function (e) {
      e.preventDefault();
      var id = document.getElementById("reg").value;
      var kind = document.getElementById("kind").value;
      var amount = Number(document.getElementById("amount").value) || 0;
      var reg = registers.filter(function (r) { return r.id === id; })[0];
      if (!reg) return;
      var bal = Number(reg.balance) || 0;
      if (kind === "out" && amount > bal) { UI.toast("الرصيد غير كافٍ", true); return; }
      try {
        await DB.insert("cash_movements", {
          register_id: id, kind: kind, amount: amount,
          date: document.getElementById("date").value,
          notes: document.getElementById("notes").value.trim(),
        });
        await DB.update("cash_registers", id, {
          balance: kind === "in" ? bal + amount : bal - amount,
        });
        // قيد مبسط على الصندوق
        var jn = await DB.nextNumber("journal_entries");
        var entry = await DB.insert("journal_entries", {
          number: jn, date: document.getElementById("date").value,
          memo: (kind === "in" ? "إيداع خزينة: " : "صرف خزينة: ") + reg.name,
          source: "cash",
        });
        if (kind === "in") {
          await DB.insert("journal_lines", { entry_id: entry.id, account_id: "a1", debit: amount, credit: 0 });
          await DB.insert("journal_lines", { entry_id: entry.id, account_id: "a7", debit: 0, credit: amount });
        } else {
          await DB.insert("journal_lines", { entry_id: entry.id, account_id: "a10", debit: amount, credit: 0 });
          await DB.insert("journal_lines", { entry_id: entry.id, account_id: "a1", debit: 0, credit: amount });
        }
        UI.toast("تم ترحيل الحركة"); ov.remove(); await load();
      } catch (err) { UI.toast(err.message, true); }
    };
  }

  async function load() {
    var d = await Promise.all([DB.list("cash_registers"), DB.list("cash_movements")]);
    registers = d[0]; movements = d[1];
    render();
  }

  document.getElementById("btn-add").onclick = function () { openReg(null); };
  document.getElementById("btn-move").onclick = openMove;
  document.getElementById("list").onclick = async function (e) {
    var btn = e.target.closest("[data-act]");
    if (!btn) return;
    var id = btn.getAttribute("data-id");
    var r = registers.filter(function (x) { return x.id === id; })[0];
    if (btn.getAttribute("data-act") === "edit") openReg(r);
    if (btn.getAttribute("data-act") === "del") {
      if (!confirm("حذف الخزينة؟")) return;
      await DB.remove("cash_registers", id); UI.toast("تم الحذف"); await load();
    }
  };
  await load();
})();
