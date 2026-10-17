(async function () {
  var page = await UI.init("expenses");
  if (!page) return;
  var html = UI.html, money = UI.money;
  var expenses = [], accounts = [];

  page.innerHTML = html`
    <div class="stack">
      <div class="page-toolbar">
        <div>
          <h2 style="margin:0">المصروفات</h2>
          <p class="muted" style="margin:4px 0 0;font-size:12px">مصروفات تشغيلية</p>
        </div>
        <button type="button" class="primary" id="btn-add">+ مصروف جديد</button>
      </div>
      <div class="stats" id="exp-stats"></div>
      <div class="card table-wrap" id="list"></div>
    </div>`;

  function accName(id) {
    var a = accounts.filter(function (x) { return x.id === id; })[0];
    return a ? a.name : "—";
  }

  function render() {
    var total = expenses.reduce(function (s, x) { return s + (Number(x.amount) || 0); }, 0);
    var month = new Date().toISOString().slice(0, 7);
    var mTotal = expenses.filter(function (x) { return (x.date || "").slice(0, 7) === month; })
      .reduce(function (s, x) { return s + (Number(x.amount) || 0); }, 0);
    var se = document.getElementById("exp-stats");
    if (se) se.innerHTML = html`
      <div class="stat red"><div class="label">إجمالي المصروفات</div><div class="value">${money(total)}</div></div>
      <div class="stat amber"><div class="label">مصروفات هذا الشهر</div><div class="value">${money(mTotal)}</div></div>
      <div class="stat"><div class="label">عدد الحركات</div><div class="value">${UI.num(expenses.length)}</div></div>`;

    document.getElementById("list").innerHTML = html`
      <table>
        <thead><tr><th>التاريخ</th><th>البيان</th><th>حساب المصروف</th><th>الطريقة</th><th>المبلغ</th><th></th></tr></thead>
        <tbody>
          ${expenses.length === 0 ? html`<tr><td colspan="6" class="empty">لا توجد مصروفات</td></tr>` :
            expenses.map(function (x) {
              return html`<tr>
                <td dir="ltr" style="text-align:start">${x.date || ""}</td>
                <td><b>${x.description || "—"}</b></td>
                <td>${accName(x.account_id)}</td>
                <td><span class="badge ${x.method === "bank" ? "" : "ok"}">${x.method === "bank" ? "بنك" : "نقدي"}</span></td>
                <td><b>${money(x.amount)}</b></td>
                <td><button class="small danger" data-act="del" data-id="${x.id}">حذف</button></td>
              </tr>`;
            }).join("")}
        </tbody>
      </table>`;
  }

  function openForm() {
    var expAccounts = accounts.filter(function (a) { return a.type === "expense"; });
    var ov = document.createElement("div");
    ov.className = "modal-overlay";
    ov.innerHTML = html`<div class="modal card">
      <h3 style="margin-top:0">مصروف جديد</h3>
      <form id="f" class="stack">
        <div class="form-grid">
          <div class="field full"><label>البيان</label><input id="desc" required placeholder="مثال: إيجار، كهرباء، صيانة…"></div>
          <div class="field"><label>المبلغ</label><input id="amount" type="number" step="0.01" required min="0.01"></div>
          <div class="field"><label>حساب المصروف</label>
            <select id="acc">${expAccounts.map(function (a) {
              return html`<option value="${a.id}">${a.name}</option>`;
            }).join("")}</select>
          </div>
          <div class="field"><label>الطريقة</label>
            <select id="method"><option value="cash">نقدي</option><option value="bank">بنك</option></select>
          </div>
          <div class="field"><label>التاريخ</label><input id="date" type="date" value="${new Date().toISOString().slice(0,10)}"></div>
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
      var accId = document.getElementById("acc").value;
      var method = document.getElementById("method").value;
      var date = document.getElementById("date").value;
      try {
        await DB.insert("expenses", {
          description: document.getElementById("desc").value.trim(),
          amount: amount, account_id: accId, method: method, date: date,
        });
        var jn = await DB.nextNumber("journal_entries");
        var entry = await DB.insert("journal_entries", {
          number: jn, date: date, memo: "مصروف: " + document.getElementById("desc").value.trim(), source: "expense",
        });
        var cashAcc = method === "bank" ? "a2" : "a1";
        await DB.insert("journal_lines", { entry_id: entry.id, account_id: accId, debit: amount, credit: 0 });
        await DB.insert("journal_lines", { entry_id: entry.id, account_id: cashAcc, debit: 0, credit: amount });
        UI.toast("تم التسجيل"); ov.remove(); await load();
      } catch (err) { UI.toast(err.message, true); }
    };
  }

  async function load() {
    var d = await Promise.all([DB.list("expenses"), DB.list("accounts")]);
    expenses = d[0]; accounts = d[1];
    render();
  }

  document.getElementById("btn-add").onclick = openForm;
  document.getElementById("list").onclick = async function (e) {
    var btn = e.target.closest("[data-act=del]");
    if (!btn) return;
    if (!confirm("حذف؟")) return;
    await DB.remove("expenses", btn.getAttribute("data-id"));
    UI.toast("تم الحذف"); await load();
  };
  await load();
})();
