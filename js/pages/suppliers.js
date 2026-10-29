(async function () {
  var page = await UI.init("suppliers");
  if (!page) return;
  try { await UI.need("js/groups.js", "Groups"); } catch (e) { UI.toast(e.message, true); }
  var html = UI.html, money = UI.money, esc = Ledger.esc;
  var items = [], groups = [], collapsed = {};
  var GT = "supplier_groups";

  page.innerHTML = html`
    <div class="stack">
      <div class="page-toolbar">
        <div>
          <h2 style="margin:0">الموردين</h2>
          <p class="muted" style="margin:4px 0 0;font-size:12px">الذمم الدائنة · مجموعات شجرية · المشتريات</p>
        </div>
        <div class="row gap wrap">
          <button type="button" class="small" id="btn-groups">المجموعات</button>
          <button type="button" class="primary" id="btn-add">+ مورد جديد</button>
        </div>
      </div>
      <div class="stats" id="stats"></div>
      <div class="row gap wrap" style="align-items:center">
        <input id="q" placeholder="بحث بالاسم أو الهاتف..." autocomplete="off" style="flex:1 1 240px;max-width:380px">
        <select id="gsel" autocomplete="off" style="max-width:240px"></select>
        <button type="button" class="small" id="g-exp">توسيع الكل</button>
        <button type="button" class="small" id="g-col">طي الكل</button>
      </div>
      <div class="card table-wrap" id="list"></div>
    </div>`;

  function groupName(it) { return it.group_id ? Groups.path(groups, it.group_id) : ""; }
  function fillGsel() {
    var sel = document.getElementById("gsel"), cur = sel.value;
    sel.innerHTML = Groups.options(groups, cur, null, groups.length ? "كل المجموعات" : "لا توجد مجموعات");
    sel.disabled = !groups.length;
    if (cur && !groups.some(function (g) { return g.id === cur; })) sel.value = "";
  }
  function render() {
    var q = (document.getElementById("q").value || "").toLowerCase(), root = document.getElementById("gsel").value || "";
    var inScope = root ? Groups.descendants(groups, root) : null;
    var scope = items.filter(function (c) { return !inScope || inScope[c.group_id]; });
    var totalBal = scope.reduce(function (s, c) { return s + (Number(c.balance) || 0); }, 0);
    var dueCount = scope.filter(function (c) { return (c.balance || 0) > 0; }).length;
    document.getElementById("stats").innerHTML = html`
      <div class="stat teal"><div class="label">عدد الموردين${root ? " (المجموعة)" : ""}</div><div class="value">${scope.length}</div></div>
      <div class="stat amber"><div class="label">إجمالي المستحق${root ? " (المجموعة)" : ""}</div><div class="value">${money(totalBal)}</div></div>
      <div class="stat"><div class="label">عليهم التزام</div><div class="value">${dueCount}</div></div>`;

    var row = function (c, level) {
      var over = c.credit_limit && c.balance > c.credit_limit;
      return '<tr><td dir="ltr" class="muted">' + esc(c.code || "—") + '</td>' +
        '<td style="padding-inline-start:' + (level * 20 + 8) + 'px"><b>' + esc(c.name) + '</b></td>' +
        '<td class="muted" style="font-size:11.5px">' + esc(groupName(c) || "—") + '</td>' +
        '<td dir="ltr">' + esc(c.phone || "—") + '</td>' +
        '<td class="' + (c.balance > 0 ? "accent" : "") + '">' + money(c.balance) + '</td>' +
        '<td>' + (c.credit_limit ? money(c.credit_limit) : "—") + " " + (over ? '<span class="badge err">تجاوز</span>' : "") + '</td>' +
        '<td><div class="actions-cell"><a class="small button" href="statements.html?type=supplier&id=' + esc(c.id) + '">كشف حساب</a> ' +
        '<button class="small" data-id="' + esc(c.id) + '" data-act="edit">تعديل</button> <button class="small danger" data-id="' + esc(c.id) + '" data-act="del">حذف</button></div></td></tr>';
    };
    var body = "", flat = !!q || !groups.length;
    if (flat) {
      var rows = scope.filter(function (c) { return !q || (c.name + " " + (c.phone || "") + " " + (c.code || "")).toLowerCase().indexOf(q) !== -1; });
      body = rows.length ? rows.map(function (c) { return row(c, 0); }).join("") : '<tr><td colspan="7" class="empty">لا يوجد موردين</td></tr>';
    } else {
      var nodes = Groups.layout(groups, scope, { collapsed: collapsed, agg: function (c) { return c.balance; }, root: root });
      body = nodes.length ? nodes.map(function (n) {
        if (n.kind === "item") return row(n.item, n.level);
        return '<tr class="grp-row" data-grp="' + esc(n.g.id) + '" style="cursor:pointer;background:var(--surface-3)"><td colspan="7" style="padding-inline-start:' + (n.level * 20 + 10) + 'px">' +
          '<span style="display:inline-block;width:18px">' + (n.open ? "▾" : "▸") + '</span><b>' + esc(n.g.name) + '</b> <span class="badge">' + n.count + '</span> ' +
          '<span class="muted" style="font-size:12px">إجمالي الرصيد: <b>' + money(n.sum) + '</b></span></td></tr>';
      }).join("") : '<tr><td colspan="7" class="empty">لا يوجد موردين</td></tr>';
    }
    document.getElementById("list").innerHTML = '<table><thead><tr><th>الكود</th><th>الاسم</th><th>المجموعة</th><th>الهاتف</th><th>الرصيد الدائن</th><th>حد التعامل</th><th></th></tr></thead><tbody>' + body + '</tbody></table>';
    document.getElementById("g-exp").disabled = document.getElementById("g-col").disabled = !groups.length || !!q;
  }

  function openForm(c) {
    var isNew = !c;
    c = c || { name: "", phone: "", notes: "", balance: 0, group_id: document.getElementById("gsel").value || "" };
    var ov = document.createElement("div");
    ov.className = "modal-overlay";
    ov.innerHTML = html`<div class="modal card">
      <h3 style="margin-top:0">${isNew ? "مورد جديد" : "تعديل مورد"}</h3>
      <form id="f" class="stack">
        <div class="form-grid">
          <div class="field full"><label>المجموعة (تحت أي مجموعة يوضع)</label><select id="group" autocomplete="off">${Groups.options(groups, c.group_id || "", null, "— بدون مجموعة —")}</select></div>
          <div class="field"><label>الاسم</label><input id="name" required value="${esc(c.name || "")}"></div>
          <div class="field"><label>الهاتف</label><input id="phone" dir="ltr" value="${esc(c.phone || "")}"></div>
          <div class="field"><label>الكود</label><input id="code" dir="ltr" value="${esc(c.code || "")}" placeholder="تلقائي"></div>
          <div class="field"><label>رصيد افتتاحي</label><input id="opening" type="number" step="0.01" value="${c.opening_balance || 0}"></div>
          <div class="field"><label>حد التعامل (0 = بدون)</label><input id="limit" type="number" min="0" step="0.01" value="${c.credit_limit || 0}"></div>
          <div class="field"><label>العنوان</label><input id="address" value="${esc(c.address || "")}"></div>
          <div class="field full"><label>ملاحظات</label><input id="notes" value="${esc(c.notes || "")}"></div>
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
        code: document.getElementById("code").value.trim() || (isNew ? "S" + String(items.length + 1).padStart(4, "0") : c.code || ""),
        opening_balance: Number(document.getElementById("opening").value) || 0,
        credit_limit: Number(document.getElementById("limit").value) || 0,
        address: document.getElementById("address").value.trim(),
        group_id: document.getElementById("group").value || "",
      };
      try {
        if (isNew) { payload.balance = payload.opening_balance; await DB.insert("suppliers", payload); }
        else {
          await DB.update("suppliers", c.id, payload);
          if ((Number(c.opening_balance) || 0) !== payload.opening_balance) await Ledger.recompute("supplier", c.id);
        }
        UI.toast("تم الحفظ"); ov.remove(); await load();
      } catch (err) { UI.toast(err.message, true); }
    };
  }

  async function load() {
    try {
      var d = await Promise.all([DB.list("suppliers"), DB.list(GT).catch(function () { return []; })]);
      items = d[0] || []; groups = d[1] || [];
      fillGsel(); render();
    } catch (err) {
      document.getElementById("list").innerHTML = '<div class="empty">تعذّر تحميل الموردين: ' + esc(err.message) + '</div>';
      UI.toast(err.message, true);
    }
  }

  document.getElementById("btn-add").onclick = function () { openForm(null); };
  document.getElementById("btn-groups").onclick = function () {
    Groups.manage({ table: GT, title: "مجموعات الموردين", items: items, onChange: load });
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
    var c = items.filter(function (x) { return x.id === id; })[0];
    if (btn.getAttribute("data-act") === "edit") openForm(c);
    if (btn.getAttribute("data-act") === "del") {
      if (!confirm("حذف المورد؟")) return;
      await DB.remove("suppliers", id);
      UI.toast("تم الحذف");
      await load();
    }
  };

  await load();
})();
