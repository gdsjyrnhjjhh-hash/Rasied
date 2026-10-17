(async function () {
  var page = await UI.init("products");
  if (!page) return;
  var html = UI.html, money = UI.money;
  var products = [], warehouses = [];

  page.innerHTML = html`
    <div class="stack">
      <div class="page-toolbar">
        <div>
          <h2 style="margin:0">الأصناف</h2>
          <p class="muted" style="margin:4px 0 0;font-size:12px">المخزون · التكلفة · التنبيهات</p>
        </div>
        <button type="button" class="primary" id="btn-add">+ صنف</button>
      </div>
      <div class="stats" id="prod-stats"></div>
      <input id="q" placeholder="بحث بالاسم أو الكود...">
      <div class="card table-wrap" id="list"></div>
    </div>`;

  function whName(id) {
    var w = warehouses.filter(function (x) { return x.id === id; })[0];
    return w ? w.name : "—";
  }

  function render() {
    var val = products.reduce(function (s, p) { return s + (p.qty || 0) * (p.cost || 0); }, 0);
    var low = products.filter(function (p) { return (p.qty || 0) <= (p.min_qty || 0); }).length;
    var pe = document.getElementById("prod-stats");
    if (pe) pe.innerHTML = html`
      <div class="stat teal"><div class="label">الأصناف</div><div class="value">${products.length}</div></div>
      <div class="stat"><div class="label">قيمة المخزون</div><div class="value">${money(val)}</div></div>
      <div class="stat ${low ? "red" : "teal"}"><div class="label">تحت الحد الأدنى</div><div class="value">${low}</div></div>`;

    var q = (document.getElementById("q").value || "").toLowerCase();
    var rows = products.filter(function (p) {
      return !q || (p.name + " " + (p.sku || "")).toLowerCase().indexOf(q) !== -1;
    });
    document.getElementById("list").innerHTML = html`
      <table>
        <thead><tr><th>الكود</th><th>الصنف</th><th>الوحدة</th><th>التكلفة</th><th>سعر البيع</th><th>الكمية</th><th>الحد الأدنى</th><th>المخزن</th><th></th></tr></thead>
        <tbody>
          ${rows.length === 0 ? html`<tr><td colspan="9" class="empty">لا توجد أصناف</td></tr>` :
            rows.map(function (p) {
              var low = (p.qty || 0) <= (p.min_qty || 0);
              return html`<tr class="${low ? "row-danger" : ""}">
                <td dir="ltr">${p.sku || "—"}</td>
                <td><b>${p.name}</b></td>
                <td>${p.unit || "—"}</td>
                <td>${money(p.cost)}</td>
                <td>${money(p.price)}</td>
                <td class="${low ? "accent" : ""}">${p.qty}${low ? " ⚠" : ""}</td>
                <td>${p.min_qty}</td>
                <td>${whName(p.warehouse_id)}</td>
                <td>
                  <button class="small" data-id="${p.id}" data-act="edit">تعديل</button>
                  <button class="small danger" data-id="${p.id}" data-act="del">حذف</button>
                </td>
              </tr>`;
            }).join("")}
        </tbody>
      </table>`;
  }

  function openForm(p) {
    var isNew = !p;
    p = p || { sku: "", name: "", unit: "قطعة", cost: 0, price: 0, qty: 0, min_qty: 0, warehouse_id: warehouses[0] ? warehouses[0].id : "" };
    var ov = document.createElement("div");
    ov.className = "modal-overlay";
    ov.innerHTML = html`<div class="modal card">
      <h3 style="margin-top:0">${isNew ? "صنف جديد" : "تعديل صنف"}</h3>
      <form id="f" class="stack">
        <div class="form-grid">
          <div class="field"><label>الكود</label><input id="sku" value="${p.sku || ""}"></div>
          <div class="field"><label>الاسم</label><input id="name" required value="${p.name || ""}"></div>
          <div class="field"><label>الوحدة</label><input id="unit" value="${p.unit || "قطعة"}"></div>
          <div class="field"><label>تكلفة الشراء</label><input id="cost" type="number" step="0.01" value="${p.cost || 0}"></div>
          <div class="field"><label>سعر البيع</label><input id="price" type="number" step="0.01" value="${p.price || 0}"></div>
          <div class="field"><label>الكمية</label><input id="qty" type="number" step="0.01" value="${p.qty || 0}"></div>
          <div class="field"><label>الحد الأدنى</label><input id="min_qty" type="number" value="${p.min_qty || 0}"></div>
          <div class="field"><label>المخزن</label>
            <select id="wh">${warehouses.map(function (w) {
              return html`<option value="${w.id}" ${w.id === p.warehouse_id ? "selected" : ""}>${w.name}</option>`;
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
        sku: document.getElementById("sku").value.trim(),
        name: document.getElementById("name").value.trim(),
        unit: document.getElementById("unit").value.trim(),
        cost: Number(document.getElementById("cost").value) || 0,
        price: Number(document.getElementById("price").value) || 0,
        qty: Number(document.getElementById("qty").value) || 0,
        min_qty: Number(document.getElementById("min_qty").value) || 0,
        warehouse_id: document.getElementById("wh").value,
      };
      try {
        if (isNew) await DB.insert("products", payload);
        else await DB.update("products", p.id, payload);
        UI.toast("تم الحفظ"); ov.remove(); await load();
      } catch (err) { UI.toast(err.message, true); }
    };
  }

  async function load() {
    var d = await Promise.all([DB.list("products"), DB.list("warehouses")]);
    products = d[0]; warehouses = d[1];
    render();
  }

  document.getElementById("btn-add").onclick = function () { openForm(null); };
  document.getElementById("q").oninput = render;
  document.getElementById("list").onclick = async function (e) {
    var btn = e.target.closest("[data-act]");
    if (!btn) return;
    var id = btn.getAttribute("data-id");
    var p = products.filter(function (x) { return x.id === id; })[0];
    if (btn.getAttribute("data-act") === "edit") openForm(p);
    if (btn.getAttribute("data-act") === "del") {
      if (!confirm("حذف الصنف؟")) return;
      await DB.remove("products", id); UI.toast("تم الحذف"); await load();
    }
  };
  await load();
})();
