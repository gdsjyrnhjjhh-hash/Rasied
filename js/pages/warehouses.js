(async function () {
  var page = await UI.init("warehouses");
  if (!page) return;
  var html = UI.html, money = UI.money;
  var warehouses = [], products = [];

  page.innerHTML = html`
    <div class="stack">
      <div class="page-toolbar">
        <div>
          <h2 style="margin:0">المخازن</h2>
          <p class="muted" style="margin:4px 0 0;font-size:12px">مواقع التخزين</p>
        </div>
        <button type="button" class="primary" id="btn-add">+ مخزن جديد</button>
      </div>
      <div class="stats" id="wh-stats"></div>
      <div class="card table-wrap" id="list"></div>
    </div>`;

  function whStats(id) {
    var items = products.filter(function (p) { return p.warehouse_id === id; });
    return {
      count: items.length,
      value: items.reduce(function (s, p) { return s + (p.qty || 0) * (p.cost || 0); }, 0),
    };
  }

  function render() {
    var totalValue = products.reduce(function (s, p) { return s + (p.qty || 0) * (p.cost || 0); }, 0);
    var se = document.getElementById("wh-stats");
    if (se) se.innerHTML = html`
      <div class="stat teal"><div class="label">عدد المخازن</div><div class="value">${UI.num(warehouses.length)}</div></div>
      <div class="stat blue"><div class="label">إجمالي الأصناف</div><div class="value">${UI.num(products.length)}</div></div>
      <div class="stat green"><div class="label">قيمة المخزون</div><div class="value">${money(totalValue)}</div></div>`;

    document.getElementById("list").innerHTML = html`
      <table>
        <thead><tr><th>المخزن</th><th>الموقع</th><th>عدد الأصناف</th><th>قيمة المخزون</th><th></th></tr></thead>
        <tbody>
          ${warehouses.length === 0 ? html`<tr><td colspan="5" class="empty">لا توجد مخازن</td></tr>` :
            warehouses.map(function (w) {
              var st = whStats(w.id);
              return html`<tr>
                <td><b>${w.name}</b></td>
                <td>${w.location || "—"}</td>
                <td><span class="badge">${UI.num(st.count)} صنف</span></td>
                <td><b>${money(st.value)}</b></td>
                <td>
                  <button class="small" data-id="${w.id}" data-act="edit">تعديل</button>
                  <button class="small danger" data-id="${w.id}" data-act="del">حذف</button>
                </td>
              </tr>`;
            }).join("")}
        </tbody>
      </table>`;
  }

  function openForm(w) {
    var isNew = !w;
    w = w || { name: "", location: "" };
    var ov = document.createElement("div");
    ov.className = "modal-overlay";
    ov.innerHTML = html`<div class="modal card">
      <h3 style="margin-top:0">${isNew ? "مخزن جديد" : "تعديل مخزن"}</h3>
      <form id="f" class="stack">
        <div class="form-grid">
          <div class="field"><label>اسم المخزن</label><input id="name" required value="${w.name || ""}"></div>
          <div class="field"><label>الموقع</label><input id="loc" value="${w.location || ""}"></div>
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
      var payload = { name: document.getElementById("name").value.trim(), location: document.getElementById("loc").value.trim() };
      try {
        if (isNew) await DB.insert("warehouses", payload);
        else await DB.update("warehouses", w.id, payload);
        UI.toast("تم الحفظ"); ov.remove(); await load();
      } catch (err) { UI.toast(err.message, true); }
    };
  }

  async function load() {
    var d = await Promise.all([DB.list("warehouses"), DB.list("products")]);
    warehouses = d[0]; products = d[1];
    render();
  }

  document.getElementById("btn-add").onclick = function () { openForm(null); };
  document.getElementById("list").onclick = async function (e) {
    var btn = e.target.closest("[data-act]");
    if (!btn) return;
    var id = btn.getAttribute("data-id");
    var w = warehouses.filter(function (x) { return x.id === id; })[0];
    if (btn.getAttribute("data-act") === "edit") openForm(w);
    if (btn.getAttribute("data-act") === "del") {
      if (products.some(function (p) { return p.warehouse_id === id; })) { UI.toast("لا يمكن حذف مخزن يحتوي على أصناف", true); return; }
      if (!confirm("حذف المخزن؟")) return;
      await DB.remove("warehouses", id); UI.toast("تم الحذف"); await load();
    }
  };
  await load();
})();
