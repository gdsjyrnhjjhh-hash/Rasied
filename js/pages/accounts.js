(async function () {
  var page = await UI.init("accounts");
  if (!page) return;
  var html = UI.html;
  var accounts = [];

  page.innerHTML = html`
    <div class="stack">
      <div class="page-toolbar">
        <div>
          <h2 style="margin:0">دليل الحسابات</h2>
          <p class="muted" style="margin:4px 0 0;font-size:12px">شجرة الحسابات المالية</p>
        </div>
        <button type="button" class="primary" id="btn-add">+ حساب جديد</button>
      </div>
      <div class="stats" id="acc-stats"></div>
      <div class="row gap wrap">
        <input id="q" placeholder="بحث بالكود أو الاسم..." style="max-width:340px">
        <select id="ftype" style="max-width:200px"><option value="">كل الأنواع</option>${UI.ACCOUNT_TYPES.map(function (t) { return html`<option value="${t.key}">${t.label}</option>`; }).join("")}</select>
      </div>
      <div class="card table-wrap" id="list"></div>
    </div>`;

  var TYPE_BADGE = { asset: "ok", liability: "warn", equity: "", revenue: "ok", expense: "err" };

  function render() {
    var se = document.getElementById("acc-stats");
    if (se) se.innerHTML = UI.ACCOUNT_TYPES.map(function (t, i) {
      var n = accounts.filter(function (a) { return a.type === t.key; }).length;
      return html`<div class="stat ${["blue", "amber", "teal", "green", "red"][i]}"><div class="label">${t.label}</div><div class="value">${UI.num(n)}</div></div>`;
    }).join("");

    var q = (document.getElementById("q").value || "").trim().toLowerCase();
    var ft = document.getElementById("ftype").value;
    var rows = accounts.filter(function (a) {
      return (!ft || a.type === ft) && (!q || ((a.code || "") + " " + a.name).toLowerCase().indexOf(q) !== -1);
    }).sort(function (a, b) { return String(a.code || "").localeCompare(String(b.code || ""), "en", { numeric: true }); });

    document.getElementById("list").innerHTML = html`
      <table>
        <thead><tr><th>الكود</th><th>اسم الحساب</th><th>النوع</th><th></th></tr></thead>
        <tbody>
          ${rows.length === 0 ? html`<tr><td colspan="4" class="empty">لا توجد حسابات</td></tr>` :
            rows.map(function (a) {
              return html`<tr>
                <td dir="ltr" style="text-align:start"><b>${a.code || "—"}</b></td>
                <td>${a.name}</td>
                <td><span class="badge ${TYPE_BADGE[a.type] || ""}">${UI.typeLabel(a.type)}</span></td>
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
          <div class="field"><label>الكود</label><input id="code" dir="ltr" required value="${a.code || ""}"></div>
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
  document.getElementById("q").oninput = render;
  document.getElementById("ftype").onchange = render;
  document.getElementById("list").onclick = async function (e) {
    var btn = e.target.closest("[data-act]");
    if (!btn) return;
    var id = btn.getAttribute("data-id");
    var a = accounts.filter(function (x) { return x.id === id; })[0];
    if (btn.getAttribute("data-act") === "edit") openForm(a);
    if (btn.getAttribute("data-act") === "del") {
      var used = (await DB.list("journal_lines")).some(function (l) { return l.account_id === id; });
      if (used) { UI.toast("لا يمكن حذف حساب عليه حركات قيود", true); return; }
      if (!confirm("حذف الحساب؟")) return;
      await DB.remove("accounts", id); UI.toast("تم الحذف"); await load();
    }
  };
  await load();
})();
