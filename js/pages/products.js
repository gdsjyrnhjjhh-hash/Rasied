(async function () {
  var page = await UI.init("products");
  if (!page) return;
  var html = UI.html, money = UI.money, esc = Ledger.esc;
  var products = [], warehouses = [], groups = [], collapsed = {};
  var GT = "product_groups";

  page.innerHTML = html`
    <div class="stack">
      <div class="page-toolbar">
        <div>
          <h2 style="margin:0">الأصناف</h2>
          <p class="muted" style="margin:4px 0 0;font-size:12px">المخزون · التكلفة · التنبيهات · مجموعات شجرية</p>
        </div>
        <div class="row gap wrap">
          <button type="button" class="small" id="btn-groups">المجموعات</button>
          <button type="button" class="primary" id="btn-add">+ صنف</button>
        </div>
      </div>
      <div class="stats" id="prod-stats"></div>
      <div class="row gap wrap" style="align-items:center">
        <input id="q" placeholder="بحث بالاسم أو الكود..." autocomplete="off" style="flex:1 1 240px;max-width:380px">
        <select id="gsel" autocomplete="off" style="max-width:240px"></select>
        <button type="button" class="small" id="g-exp">توسيع الكل</button>
        <button type="button" class="small" id="g-col">طي الكل</button>
      </div>
      <div class="card table-wrap" id="list"></div>
    </div>`;

  function whName(id) {
    var w = warehouses.filter(function (x) { return x.id === id; })[0];
    return w ? w.name : "—";
  }
  function fillGsel() {
    var sel = document.getElementById("gsel"), cur = sel.value;
    sel.innerHTML = Groups.options(groups, cur, null, groups.length ? "كل المجموعات" : "لا توجد مجموعات");
    sel.disabled = !groups.length;
    if (cur && !groups.some(function (g) { return g.id === cur; })) sel.value = "";
  }
  function render() {
    var q = (document.getElementById("q").value || "").toLowerCase(), root = document.getElementById("gsel").value || "";
    var inScope = root ? Groups.descendants(groups, root) : null;
    var scope = products.filter(function (p) { return !inScope || inScope[p.group_id]; });
    var val = scope.reduce(function (s, p) { return s + (p.qty || 0) * (p.cost || 0); }, 0);
    var low = scope.filter(function (p) { return (p.qty || 0) <= (p.min_qty || 0); }).length;
    document.getElementById("prod-stats").innerHTML = html`
      <div class="stat teal"><div class="label">الأصناف${root ? " (المجموعة)" : ""}</div><div class="value">${scope.length}</div></div>
      <div class="stat"><div class="label">قيمة المخزون${root ? " (المجموعة)" : ""}</div><div class="value">${money(val)}</div></div>
      <div class="stat ${low ? "red" : "teal"}"><div class="label">تحت الحد الأدنى</div><div class="value">${low}</div></div>`;

    var row = function (p, level) {
      var isLow = (p.qty || 0) <= (p.min_qty || 0);
      return '<tr class="' + (isLow ? "row-danger" : "") + '"><td dir="ltr">' + esc(p.sku || "—") + '</td>' +
        '<td style="padding-inline-start:' + (level * 20 + 8) + 'px"><b>' + esc(p.name) + '</b></td>' +
        '<td class="muted" style="font-size:11.5px">' + esc(p.group_id ? Groups.path(groups, p.group_id) : "—") + '</td>' +
        '<td>' + esc(p.unit || "—") + '</td><td>' + money(p.cost) + '</td><td>' + money(p.price) + '</td>' +
        '<td class="' + (isLow ? "accent" : "") + '">' + p.qty + (isLow ? " ⚠" : "") + '</td><td>' + p.min_qty + '</td><td>' + esc(whName(p.warehouse_id)) + '</td>' +
        '<td><button class="small" data-id="' + esc(p.id) + '" data-act="edit">تعديل</button> <button class="small danger" data-id="' + esc(p.id) + '" data-act="del">حذف</button></td></tr>';
    };
    var body = "", flat = !!q || !groups.length;
    if (flat) {
      var rows = scope.filter(function (p) { return !q || (p.name + " " + (p.sku || "")).toLowerCase().indexOf(q) !== -1; });
      body = rows.length ? rows.map(function (p) { return row(p, 0); }).join("") : '<tr><td colspan="10" class="empty">لا توجد أصناف</td></tr>';
    } else {
      var nodes = Groups.layout(groups, scope, { collapsed: collapsed, agg: function (p) { return (p.qty || 0) * (p.cost || 0); }, root: root });
      body = nodes.length ? nodes.map(function (n) {
        if (n.kind === "item") return row(n.item, n.level);
        return '<tr class="grp-row" data-grp="' + esc(n.g.id) + '" style="cursor:pointer;background:var(--surface-3)"><td colspan="10" style="padding-inline-start:' + (n.level * 20 + 10) + 'px">' +
          '<span style="display:inline-block;width:18px">' + (n.open ? "▾" : "▸") + '</span><b>' + esc(n.g.name) + '</b> <span class="badge">' + n.count + '</span> ' +
          '<span class="muted" style="font-size:12px">قيمة المخزون: <b>' + money(n.sum) + '</b></span></td></tr>';
      }).join("") : '<tr><td colspan="10" class="empty">لا توجد أصناف</td></tr>';
    }
    document.getElementById("list").innerHTML = '<table><thead><tr><th>الكود</th><th>الصنف</th><th>المجموعة</th><th>الوحدة</th><th>التكلفة</th><th>سعر البيع</th><th>الكمية</th><th>الحد الأدنى</th><th>المخزن</th><th></th></tr></thead><tbody>' + body + '</tbody></table>';
    document.getElementById("g-exp").disabled = document.getElementById("g-col").disabled = !groups.length || !!q;
  }

  function openForm(p) {
    var isNew = !p;
    p = p || { sku: "", name: "", unit: "قطعة", cost: 0, price: 0, qty: 0, min_qty: 0, warehouse_id: warehouses[0] ? warehouses[0].id : "", group_id: document.getElementById("gsel").value || "" };
    var ov = document.createElement("div");
    ov.className = "modal-overlay";
    ov.innerHTML = html`<div class="modal card">
      <h3 style="margin-top:0">${isNew ? "صنف جديد" : "تعديل صنف"}</h3>
      <form id="f" class="stack">
        <div class="form-grid">
          <div class="field full"><label>المجموعة (تحت أي مجموعة يوضع الصنف)</label><select id="group" autocomplete="off">${Groups.options(groups, p.group_id || "", null, "— بدون مجموعة —")}</select></div>
          <div class="field"><label>الكود</label><input id="sku" value="${esc(p.sku || "")}"></div>
          <div class="field"><label>الاسم</label><input id="name" required value="${esc(p.name || "")}"></div>
          <div class="field"><label>الوحدة</label><input id="unit" value="${esc(p.unit || "قطعة")}"></div>
          <div class="field"><label>تكلفة الشراء</label><input id="cost" type="number" step="0.01" value="${p.cost || 0}"></div>
          <div class="field"><label>سعر البيع</label><input id="price" type="number" step="0.01" value="${p.price || 0}"></div>
          <div class="field"><label>الكمية</label><input id="qty" type="number" step="0.01" value="${p.qty || 0}"></div>
          <div class="field"><label>الحد الأدنى</label><input id="min_qty" type="number" value="${p.min_qty || 0}"></div>
          <div class="field"><label>المخزن</label>
            <select id="wh">${warehouses.map(function (w) {
              return '<option value="' + esc(w.id) + '"' + (w.id === p.warehouse_id ? " selected" : "") + ">" + esc(w.name) + "</option>";
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
        group_id: document.getElementById("group").value || "",
      };
      try {
        if (isNew) await DB.insert("products", payload);
        else await DB.update("products", p.id, payload);
        UI.toast("تم الحفظ"); ov.remove(); await load();
      } catch (err) { UI.toast(err.message, true); }
    };
  }

  async function load() {
    var d = await Promise.all([DB.list("products"), DB.list("warehouses"), DB.list(GT)]);
    products = d[0]; warehouses = d[1]; groups = d[2];
    fillGsel(); render();
  }

  document.getElementById("btn-add").onclick = function () { openForm(null); };
  document.getElementById("btn-groups").onclick = function () {
    Groups.manage({ table: GT, title: "مجموعات الأصناف", items: products, onChange: load });
  };
  document.getElementById("q").oninput = render;
  document.getElementById("gsel").onchange = render;
  document.getElementById("g-exp").onclick = function () { collapsed = {}; render(); };
  document.getElementById("g-col").onclick = function () { Groups.allIds(groups, true).forEach(function (id) { collapsed[id] = true; }); render(); };
  document.getElementById("list").onclick = async function (e) {
    var btn = e.target.closest("[data-act]");
    if (!btn) {
      var gr = e.target.closest("[data-grp]");
      if (gr) { var id0 = gr.getAttribute("data-grp"); collapsed[id0] = !collapsed[id0]; render(); }
      return;
    }
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
