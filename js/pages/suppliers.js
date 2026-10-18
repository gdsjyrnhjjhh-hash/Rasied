(async function () {
  var page = await UI.init("suppliers");
  if (!page) return;
  var html = UI.html, money = UI.money;
  var suppliers = [];

  page.innerHTML = html`
    <div class="stack">
      <div class="page-toolbar">
        <div>
          <h2 style="margin:0">الموردين</h2>
          <p class="muted" style="margin:4px 0 0;font-size:12px">الذمم الدائنة · المشتريات</p>
        </div>
        <button type="button" class="primary" id="btn-add">+ مورد جديد</button>
      </div>
      <div class="stats" id="sup-stats"></div>
      <input id="q" placeholder="بحث بالاسم أو الهاتف...">
      <div class="card table-wrap" id="list"></div>
    </div>`;

  function render() {
    var totalBal = suppliers.reduce(function (s, c) { return s + (Number(c.balance) || 0); }, 0);
    var due = suppliers.filter(function (c) { return (c.balance || 0) > 0; }).length;
    var se = document.getElementById("sup-stats");
    if (se) se.innerHTML = html`
      <div class="stat teal"><div class="label">عدد الموردين</div><div class="value">${suppliers.length}</div></div>
      <div class="stat amber"><div class="label">إجمالي المستحق</div><div class="value">${money(totalBal)}</div></div>
      <div class="stat"><div class="label">عليهم التزام</div><div class="value">${due}</div></div>`;

    var q = (document.getElementById("q").value || "").toLowerCase();
    var rows = suppliers.filter(function (c) {
      return !q || (c.name + " " + (c.phone || "")).toLowerCase().indexOf(q) !== -1;
    });
    document.getElementById("list").innerHTML = html`
      <table>
        <thead><tr><th>الكود</th><th>الاسم</th><th>الهاتف</th><th>الرصيد الدائن</th><th>حد التعامل</th><th></th></tr></thead>
        <tbody>
          ${rows.length === 0 ? html`<tr><td colspan="6" class="empty">لا يوجد موردين</td></tr>` :
            rows.map(function (c) {
              return html`<tr>
                <td dir="ltr" class="muted">${c.code || "—"}</td>
                <td><b>${c.name}</b></td>
                <td dir="ltr">${c.phone || "—"}</td>
                <td class="${c.balance > 0 ? "accent" : ""}">${money(c.balance)}</td>
                <td>${c.credit_limit ? money(c.credit_limit) : "—"} ${c.credit_limit && c.balance > c.credit_limit ? '<span class="badge err">تجاوز</span>' : ""}</td>
                <td><div class="actions-cell">
                  <a class="small button" href="statements.html?type=supplier&id=${c.id}">كشف حساب</a>
                  <button class="small" data-id="${c.id}" data-act="edit">تعديل</button>
                  <button class="small danger" data-id="${c.id}" data-act="del">حذف</button>
                </div></td>
              </tr>`;
            }).join("")}
        </tbody>
      </table>`;
  }

  function openForm(c) {
    var isNew = !c;
    c = c || { name: "", phone: "", notes: "" };
    var ov = document.createElement("div");
    ov.className = "modal-overlay";
    ov.innerHTML = html`<div class="modal card">
      <h3 style="margin-top:0">${isNew ? "مورد جديد" : "تعديل مورد"}</h3>
      <form id="f" class="stack">
        <div class="form-grid">
          <div class="field"><label>الاسم</label><input id="name" required value="${c.name || ""}"></div>
          <div class="field"><label>الهاتف</label><input id="phone" dir="ltr" value="${c.phone || ""}"></div>
          <div class="field"><label>الكود</label><input id="code" dir="ltr" value="${c.code || ""}" placeholder="تلقائي"></div>
          <div class="field"><label>رصيد افتتاحي</label><input id="opening" type="number" step="0.01" value="${c.opening_balance || 0}"></div>
          <div class="field"><label>حد التعامل (0 = بدون)</label><input id="limit" type="number" min="0" step="0.01" value="${c.credit_limit || 0}"></div>
          <div class="field"><label>العنوان</label><input id="address" value="${c.address || ""}"></div>
          <div class="field full"><label>ملاحظات</label><input id="notes" value="${c.notes || ""}"></div>
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
      var payload = {
        name: document.getElementById("name").value.trim(),
        phone: document.getElementById("phone").value.trim(),
        notes: document.getElementById("notes").value.trim(),
        code: document.getElementById("code").value.trim() || (isNew ? "S" + String(suppliers.length + 1).padStart(4, "0") : c.code || ""),
        opening_balance: Number(document.getElementById("opening").value) || 0,
        credit_limit: Number(document.getElementById("limit").value) || 0,
        address: document.getElementById("address").value.trim(),
      };
      try {
        if (isNew) { payload.balance = payload.opening_balance; await DB.insert("suppliers", payload); }
        else { await DB.update("suppliers", c.id, payload); if ((Number(c.opening_balance) || 0) !== payload.opening_balance) await Ledger.recompute("supplier", c.id); }
        UI.toast("تم الحفظ"); ov.remove(); await load();
      } catch (err) { UI.toast(err.message, true); }
    };
  }

  async function load() {
    suppliers = await DB.list("suppliers");
    render();
  }

  document.getElementById("btn-add").onclick = function () { openForm(null); };
  document.getElementById("q").oninput = render;
  document.getElementById("list").onclick = async function (e) {
    var btn = e.target.closest("[data-act]");
    if (!btn) return;
    var id = btn.getAttribute("data-id");
    var c = suppliers.filter(function (x) { return x.id === id; })[0];
    if (btn.getAttribute("data-act") === "edit") openForm(c);
    if (btn.getAttribute("data-act") === "del") {
      if (!confirm("حذف المورد؟")) return;
      await DB.remove("suppliers", id);
      UI.toast("تم الحذف"); await load();
    }
  };
  await load();
})();
