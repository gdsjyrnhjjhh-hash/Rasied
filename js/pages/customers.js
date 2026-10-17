(async function () {
  var page = await UI.init("customers");
  if (!page) return;
  var html = UI.html, money = UI.money;
  var customers = [];

  page.innerHTML = html`
    <div class="stack">
      <div class="page-toolbar">
        <div>
          <h2 style="margin:0">العملاء</h2>
          <p class="muted" style="margin:4px 0 0;font-size:12px">الذمم المدينة · البحث السريع</p>
        </div>
        <button type="button" class="primary" id="btn-add">+ عميل جديد</button>
      </div>
      <div class="stats" id="cust-stats"></div>
      <input id="q" placeholder="بحث بالاسم أو الهاتف...">
      <div class="card table-wrap" id="list"></div>
    </div>`;

  function render() {
    var totalBal = customers.reduce(function (s, c) { return s + (Number(c.balance) || 0); }, 0);
    var dueCount = customers.filter(function (c) { return (c.balance || 0) > 0; }).length;
    var statsEl = document.getElementById("cust-stats");
    if (statsEl) {
      statsEl.innerHTML = html`
        <div class="stat teal"><div class="label">عدد العملاء</div><div class="value">${customers.length}</div></div>
        <div class="stat amber"><div class="label">إجمالي الذمم</div><div class="value">${money(totalBal)}</div></div>
        <div class="stat"><div class="label">عليهم مبالغ</div><div class="value">${dueCount}</div></div>`;
    }

    var q = (document.getElementById("q").value || "").toLowerCase();
    var rows = customers.filter(function (c) {
      return !q || (c.name + " " + (c.phone || "")).toLowerCase().indexOf(q) !== -1;
    });
    document.getElementById("list").innerHTML = html`
      <table>
        <thead><tr><th>الاسم</th><th>الهاتف</th><th>الرصيد المدين</th><th>ملاحظات</th><th></th></tr></thead>
        <tbody>
          ${rows.length === 0 ? html`<tr><td colspan="5" class="empty">لا يوجد عملاء</td></tr>` :
            rows.map(function (c) {
              return html`<tr>
                <td><b>${c.name}</b></td>
                <td dir="ltr">${c.phone || "—"}</td>
                <td class="${c.balance > 0 ? "accent" : ""}">${money(c.balance)}</td>
                <td class="muted">${c.notes || ""}</td>
                <td>
                  <button class="small" data-id="${c.id}" data-act="edit">تعديل</button>
                  <button class="small danger" data-id="${c.id}" data-act="del">حذف</button>
                </td>
              </tr>`;
            }).join("")}
        </tbody>
      </table>`;
  }

  function openForm(c) {
    var isNew = !c;
    c = c || { name: "", phone: "", notes: "", balance: 0 };
    var ov = document.createElement("div");
    ov.className = "modal-overlay";
    ov.innerHTML = html`<div class="modal card">
      <h3 style="margin-top:0">${isNew ? "عميل جديد" : "تعديل عميل"}</h3>
      <form id="f" class="stack">
        <div class="form-grid">
          <div class="field"><label>الاسم</label><input id="name" required value="${c.name || ""}"></div>
          <div class="field"><label>الهاتف</label><input id="phone" dir="ltr" value="${c.phone || ""}"></div>
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
      };
      try {
        if (isNew) {
          payload.balance = 0;
          await DB.insert("customers", payload);
        } else {
          await DB.update("customers", c.id, payload);
        }
        UI.toast("تم الحفظ");
        ov.remove();
        await load();
      } catch (err) {
        UI.toast(err.message, true);
      }
    };
  }

  async function load() {
    customers = await DB.list("customers");
    render();
  }

  document.getElementById("btn-add").onclick = function () { openForm(null); };
  document.getElementById("q").oninput = render;
  document.getElementById("list").onclick = async function (e) {
    var btn = e.target.closest("[data-act]");
    if (!btn) return;
    var id = btn.getAttribute("data-id");
    var c = customers.filter(function (x) { return x.id === id; })[0];
    if (btn.getAttribute("data-act") === "edit") openForm(c);
    if (btn.getAttribute("data-act") === "del") {
      if (!confirm("حذف العميل؟")) return;
      await DB.remove("customers", id);
      UI.toast("تم الحذف");
      await load();
    }
  };

  await load();
})();
