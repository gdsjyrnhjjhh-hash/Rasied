(async function () {
  var page = await UI.init("accounts");
  if (!page) return;
  var html = UI.html;
  var accounts = [];

  page.innerHTML = html`
    <div class="stack">
      <div class="row between wrap gap">
        <h2 class="page-title" style="margin:0">دليل الحسابات</h2>
        <button type="button" class="primary" id="btn-add">+ حساب</button>
      </div>
      <div class="card table-wrap" id="list"></div>
    </div>`;

  function render() {
    var order = ["asset", "liability", "equity", "revenue", "expense"];
    var sorted = accounts.slice().sort(function (a, b) {
      var ia = order.indexOf(a.type), ib = order.indexOf(b.type);
      if (ia !== ib) return ia - ib;
      return (a.code || "").localeCompare(b.code || "");
    });
    document.getElementById("list").innerHTML = html`
      <table>
        <thead><tr><th>الكود</th><th>اسم الحساب</th><th>النوع</th><th></th></tr></thead>
        <tbody>
          ${sorted.map(function (a) {
            return html`<tr>
              <td dir="ltr"><b>${a.code}</b></td>
              <td>${a.name}</td>
              <td><span class="badge">${UI.typeLabel(a.type)}</span></td>
              <td>
                <button class="small" data-id="${a.id}" data-act="edit">تعديل</button>
                <button class="small danger" data-id="${a.id}" data-act="del">حذف</button>
              </td>
            </tr>`;
          }).join("")}
        </tbody>
      </table>`;
  }

  function openForm(a) {
    var isNew = !a;
    a = a || { code: "", name: "", type: "asset" };
    var ov = document.createElement("div");
    ov.className = "modal-overlay";
    ov.innerHTML = html`<div class="modal card">
      <h3 style="margin-top:0">${isNew ? "حساب جديد" : "تعديل حساب"}</h3>
      <form id="f" class="stack">
        <div class="form-grid">
          <div class="field"><label>الكود</label><input id="code" required value="${a.code || ""}" dir="ltr"></div>
          <div class="field"><label>الاسم</label><input id="name" required value="${a.name || ""}"></div>
          <div class="field"><label>النوع</label>
            <select id="type">${UI.ACCOUNT_TYPES.map(function (t) {
              return html`<option value="${t.key}" ${t.key === a.type ? "selected" : ""}>${t.label}</option>`;
            }).join("")}</select>
          </div>
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
        code: document.getElementById("code").value.trim(),
        name: document.getElementById("name").value.trim(),
        type: document.getElementById("type").value,
      };
      try {
        if (isNew) await DB.insert("accounts", payload);
        else await DB.update("accounts", a.id, payload);
        UI.toast("تم الحفظ"); ov.remove(); await load();
      } catch (err) { UI.toast(err.message, true); }
    };
  }

  async function load() {
    accounts = await DB.list("accounts");
    render();
  }

  document.getElementById("btn-add").onclick = function () { openForm(null); };
  document.getElementById("list").onclick = async function (e) {
    var btn = e.target.closest("[data-act]");
    if (!btn) return;
    var id = btn.getAttribute("data-id");
    var a = accounts.filter(function (x) { return x.id === id; })[0];
    if (btn.getAttribute("data-act") === "edit") openForm(a);
    if (btn.getAttribute("data-act") === "del") {
      if (!confirm("حذف الحساب؟")) return;
      await DB.remove("accounts", id); UI.toast("تم الحذف"); await load();
    }
  };
  await load();
})();
