(async function () {
  var page = await UI.init("accounts");
  if (!page) return;
  var html = UI.html, esc = Ledger.esc;
  var accounts = [], collapsed = {};

  page.innerHTML = html`
    <div class="stack">
      <div class="page-toolbar">
        <div>
          <h2 style="margin:0">دليل الحسابات</h2>
          <p class="muted" style="margin:4px 0 0;font-size:12px">شجرة الحسابات المالية — حساب رئيسي وتحته حسابات فرعية</p>
        </div>
        <button type="button" class="primary" id="btn-add">+ حساب جديد</button>
      </div>
      <div class="stats" id="acc-stats"></div>
      <div class="row gap wrap">
        <input id="q" placeholder="بحث بالكود أو الاسم..." style="max-width:340px">
        <select id="ftype" style="max-width:200px"><option value="">كل الأنواع</option>${UI.ACCOUNT_TYPES.map(function (t) { return html`<option value="${t.key}">${t.label}</option>`; }).join("")}</select>
        <button type="button" class="small" id="exp-all">توسيع الكل</button>
        <button type="button" class="small" id="col-all">طي الكل</button>
      </div>
      <div class="card table-wrap" id="list"></div>
    </div>`;

  var TYPE_BADGE = { asset: "ok", liability: "warn", equity: "", revenue: "ok", expense: "err" };
  function byId(id) { return accounts.filter(function (x) { return x.id === id; })[0]; }
  function kidsOf(id) { return accounts.filter(function (x) { return x.parent === id; }); }

  function render() {
    var se = document.getElementById("acc-stats");
    if (se) se.innerHTML = UI.ACCOUNT_TYPES.map(function (t, i) {
      var n = accounts.filter(function (a) { return a.type === t.key; }).length;
      return html`<div class="stat ${["blue", "amber", "teal", "green", "red"][i]}"><div class="label">${t.label}</div><div class="value">${UI.num(n)}</div></div>`;
    }).join("");

    var q = (document.getElementById("q").value || "").trim().toLowerCase();
    var ft = document.getElementById("ftype").value;
    var filtering = !!(q || ft);
    var tree = Ledger.accountTree(accounts), parentOf = {};
    accounts.forEach(function (a) { parentOf[a.id] = a.parent; });
    var visible = {};
    if (filtering) {
      tree.forEach(function (n) {
        var a = n.a;
        if ((!ft || a.type === ft) && (!q || ((a.code || "") + " " + a.name).toLowerCase().indexOf(q) !== -1)) {
          visible[a.id] = 1;
          for (var p = parentOf[a.id], guard = 0; p && guard < 30; p = parentOf[p], guard++) visible[p] = 1;   // يظهر مسار الآباء
        }
      });
    }
    var rows = tree.filter(function (n) {
      if (filtering) return visible[n.a.id];
      for (var p = parentOf[n.a.id], guard = 0; p && guard < 30; p = parentOf[p], guard++) if (collapsed[p]) return false;
      return true;
    });

    document.getElementById("list").innerHTML = html`
      <table>
        <thead><tr><th>الكود</th><th>اسم الحساب</th><th>النوع</th><th>المستوى</th><th></th></tr></thead>
        <tbody>
          ${rows.length === 0 ? html`<tr><td colspan="5" class="empty">لا توجد حسابات</td></tr>` :
            rows.map(function (n) {
              var a = n.a, open = !collapsed[a.id];
              var toggle = n.hasKids && !filtering
                ? html`<button type="button" class="ghost small" data-act="tg" data-id="${esc(a.id)}" style="padding:0 6px;min-height:24px">${open ? "▾" : "▸"}</button>`
                : html`<span style="display:inline-block;width:30px"></span>`;
              return html`<tr>
                <td dir="ltr" style="text-align:start"><b>${esc(a.code || "—")}</b></td>
                <td style="padding-inline-start:${n.level * 22 + 8}px">${toggle}<span style="${n.hasKids ? "font-weight:700" : ""}">${esc(a.name)}</span></td>
                <td><span class="badge ${TYPE_BADGE[a.type] || ""}">${UI.typeLabel(a.type)}</span></td>
                <td>${n.hasKids ? '<span class="badge">رئيسي</span>' : (n.level ? '<span class="badge ok">فرعي</span>' : '<span class="muted">—</span>')}</td>
                <td>
                  <button class="small" data-id="${esc(a.id)}" data-act="child">+ فرعي</button>
                  <button class="small" data-id="${esc(a.id)}" data-act="edit">تعديل</button>
                  <button class="small danger" data-id="${esc(a.id)}" data-act="del">حذف</button>
                </td>
              </tr>`;
            }).join("")}
        </tbody>
      </table>`;
  }

  // الكود المقترح للحساب الفرعي: أكبر كود ابن + 1 (أو كود الأب + 1 / 01) مع ضمان عدم التكرار
  function suggestCode(parent) {
    var used = {}; accounts.forEach(function (a) { used[String(a.code)] = 1; });
    var kids = kidsOf(parent.id), pc = String(parent.code || "");
    var pad = function (n, len) { var t = String(n); while (t.length < len) t = "0" + t; return t; };
    var next;
    if (/^\d+$/.test(pc)) {
      var nums = kids.map(function (k) { return /^\d+$/.test(k.code) ? Number(k.code) : NaN; }).filter(function (x) { return !isNaN(x); });
      if (nums.length) next = Math.max.apply(null, nums) + 1;
      else next = /0$/.test(pc) ? Number(pc) + 1 : Number(pc + "01");
      var len = (nums.length || /0$/.test(pc)) ? pc.length : pc.length + 2;
      var c = pad(next, len);
      while (used[c]) { next++; c = pad(next, len); }
      return c;
    }
    var i = kids.length + 1, c2 = pc + "-" + i;
    while (used[c2]) { i++; c2 = pc + "-" + i; }
    return c2;
  }

  function openForm(a, presetParent) {
    var isNew = !a;
    a = a || { code: "", name: "", type: "asset", parent: presetParent || "" };
    var banned = isNew ? {} : Ledger.accountDescendants(accounts, a.id);
    if (!isNew) banned[a.id] = 1;
    var options = Ledger.accountTree(accounts).filter(function (n) { return !banned[n.a.id]; }).map(function (n) {
      var pad = new Array(n.level + 1).join("\u00A0\u00A0\u00A0");
      return '<option value="' + esc(n.a.id) + '"' + (n.a.id === a.parent ? " selected" : "") + ">" + pad + esc(n.a.code) + " — " + esc(n.a.name) + "</option>";
    }).join("");
    var ov = document.createElement("div");
    ov.className = "modal-overlay";
    ov.innerHTML = html`<div class="modal card">
      <h3 style="margin-top:0">${isNew ? "حساب جديد" : "تعديل حساب"}</h3>
      <form id="f" class="stack">
        <div class="form-grid">
          <div class="field full"><label>الحساب الرئيسي (يوضع هذا الحساب تحته)</label>
            <select id="parent"><option value="">— بدون (حساب رئيسي مستقل) —</option>${options}</select>
          </div>
          <div class="field"><label>الكود</label><input id="code" dir="ltr" required value="${esc(a.code || "")}"></div>
          <div class="field"><label>الاسم</label><input id="name" required value="${esc(a.name || "")}"></div>
          <div class="field"><label>النوع</label>
            <select id="type">${UI.ACCOUNT_TYPES.map(function (t) {
              return html`<option value="${t.key}" ${t.key === a.type ? "selected" : ""}>${t.label}</option>`;
            }).join("")}</select>
          </div>
        </div>
        <p class="muted" id="hint" style="margin:0;font-size:12px"></p>
        <div class="row gap" style="justify-content:flex-end">
          <button type="button" class="ghost" id="cancel">إلغاء</button>
          <button class="primary" type="submit">حفظ</button>
        </div>
      </form>
    </div>`;
    document.body.appendChild(ov);
    var elP = ov.querySelector("#parent"), elC = ov.querySelector("#code"), elT = ov.querySelector("#type"), hint = ov.querySelector("#hint");
    var codeTouched = !isNew;
    elC.oninput = function () { codeTouched = true; };
    function onParent() {
      var p = byId(elP.value);
      if (p) {
        elT.value = p.type; elT.disabled = true;                    // الفرعي يرث نوع الأب
        hint.textContent = "النوع يتبع الحساب الرئيسي (" + UI.typeLabel(p.type) + ").";
        if (!codeTouched) elC.value = suggestCode(p);
      } else { elT.disabled = false; hint.textContent = ""; }
    }
    elP.onchange = onParent; onParent();
    ov.querySelector("#cancel").onclick = function () { ov.remove(); };
    ov.onclick = function (e) { if (e.target === ov) ov.remove(); };
    ov.querySelector("#f").onsubmit = async function (e) {
      e.preventDefault();
      var payload = {
        code: elC.value.trim(), name: ov.querySelector("#name").value.trim(),
        type: elT.value, parent: elP.value || null,
      };
      try {
        if (!payload.code || !payload.name) throw new Error("أكمل الكود والاسم");
        var dup = accounts.filter(function (x) { return String(x.code) === payload.code && x.id !== a.id; })[0];
        if (dup) throw new Error("الكود مستخدم بالفعل في الحساب: " + dup.name);
        var p = byId(payload.parent);
        if (p) payload.type = p.type;
        if (isNew) await DB.insert("accounts", payload);
        else {
          if (payload.parent && (banned[payload.parent])) throw new Error("لا يمكن جعل الحساب تابعًا لنفسه أو لأحد أبنائه");
          var jobs = [DB.update("accounts", a.id, payload)];
          if (payload.type !== a.type) {                              // تغيير النوع يسري على كل الحسابات الفرعية
            var desc = Ledger.accountDescendants(accounts, a.id), ids = Object.keys(desc);
            if (ids.length && !confirm("سيتغير نوع " + ids.length + " حساب فرعي ليطابق النوع الجديد. متابعة؟")) return;
            ids.forEach(function (id) { jobs.push(DB.update("accounts", id, { type: payload.type })); });
          }
          await Promise.all(jobs);
        }
        if (payload.parent) collapsed[payload.parent] = false;
        UI.toast("تم الحفظ"); ov.remove(); await load();
      } catch (err) { UI.toast(err.message, true); }
    };
  }

  async function load() {
    DB.refresh("accounts");
    accounts = await DB.list("accounts");
    render();
  }

  document.getElementById("btn-add").onclick = function () { openForm(null); };
  document.getElementById("q").oninput = render;
  document.getElementById("ftype").onchange = render;
  document.getElementById("exp-all").onclick = function () { collapsed = {}; render(); };
  document.getElementById("col-all").onclick = function () { accounts.forEach(function (a) { if (kidsOf(a.id).length) collapsed[a.id] = true; }); render(); };
  document.getElementById("list").onclick = async function (e) {
    var btn = e.target.closest("[data-act]");
    if (!btn) return;
    var id = btn.getAttribute("data-id"), act = btn.getAttribute("data-act");
    var a = byId(id);
    if (!a) return;
    if (act === "tg") { collapsed[id] = !collapsed[id]; render(); }
    else if (act === "edit") openForm(a);
    else if (act === "child") openForm(null, id);
    else if (act === "del") {
      if (kidsOf(id).length) { UI.toast("لا يمكن حذف حساب رئيسي له حسابات فرعية — احذفها أو انقلها أولًا", true); return; }
      var used = (await DB.listWhere("journal_lines", "account_id", id)).length > 0;
      if (used) { UI.toast("لا يمكن حذف حساب عليه حركات قيود", true); return; }
      if (!confirm("حذف الحساب؟")) return;
      await DB.remove("accounts", id); UI.toast("تم الحذف"); await load();
    }
  };
  await load();
})();
