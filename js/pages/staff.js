(async function () {
  var page = await UI.init("staff");
  if (!page) return;
  var html = UI.html, esc = Ledger.esc, val = Ledger.val;
  var staff = [];

  var GROUPS = [
    ["المبيعات", [["sales", "فواتير البيع"], ["returns", "مردودات البيع"], ["customers", "العملاء"], ["sales-sheet", "كشف المبيعات"]]],
    ["المشتريات", [["purchases", "فواتير الشراء"], ["purchase-returns", "مردودات الشراء"], ["suppliers", "الموردين"]]],
    ["المخزون", [["products", "الأصناف"], ["warehouses", "المخازن"], ["stocktake", "الجرد"], ["transfers", "تحويلات المخازن"]]],
    ["الخزائن والبنوك", [["cash-registers", "الخزائن"], ["banks", "البنوك"], ["cheques", "الشيكات"], ["payments", "سندات قبض/صرف"]]],
    ["الحسابات", [["statements", "كشوف الحساب"], ["party-trial", "ميزان العملاء والموردين"], ["accounts", "دليل الحسابات"], ["journal", "قيود اليومية"], ["expenses", "المصروفات"], ["reports", "التقارير المالية"], ["daily-report", "التقرير اليومي"]]],
    ["الموارد البشرية", [["employees", "الموظفين"], ["attendance", "الحضور والانصراف"], ["payroll", "المرتبات"]]],
  ];
  var PRESETS = {
    "مبيعات": ["sales", "returns", "customers", "products", "statements"],
    "أمين مخزن": ["products", "warehouses", "stocktake", "transfers", "purchases", "suppliers"],
    "محاسب": ["sales", "returns", "customers", "purchases", "purchase-returns", "suppliers", "cash-registers", "banks", "cheques", "payments", "statements", "party-trial", "accounts", "journal", "expenses", "reports", "sales-sheet", "daily-report"],
  };

  page.innerHTML = html`
    <div class="stack">
      <div class="page-toolbar">
        <div>
          <h2 style="margin:0">مستخدمو الشركة</h2>
          <p class="muted" style="margin:4px 0 0;font-size:12px">أضف موظفيك بأرقام تليفوناتهم وحدّد الصفحات المسموحة لكل واحد · الإعدادات وهذه الصفحة للمالك فقط</p>
        </div>
        <button type="button" class="primary" id="b-add">+ موظف جديد</button>
      </div>
      <div class="card table-wrap" id="tbl"></div>
    </div>`;

  var fmt = function (d) { return d ? String(d).slice(0, 10) : "—"; };
  var client = function () { return DB.client(); };

  function draw() {
    document.getElementById("tbl").innerHTML = html`
      <table><thead><tr><th>الموظف</th><th>الهاتف</th><th>الحالة</th><th>الصفحات</th><th>أيام الاستخدام</th><th>مرات الدخول</th><th>آخر دخول</th><th></th></tr></thead><tbody>
        ${staff.map(function (m) {
          return html`<tr><td><b>${m.full_name}</b></td><td dir="ltr">${m.phone}</td>
            <td><span class="badge ${m.status === "active" ? "ok" : "err"}">${m.status === "active" ? "نشط" : "موقوف"}</span></td>
            <td>${(m.permissions || []).filter(function (x) { return x.indexOf("deny:") !== 0; }).length}${(m.permissions || []).some(function (x) { return x.indexOf("deny:") === 0; }) ? ' <span class="badge warn">مقيَّد</span>' : ""}</td><td>${m.days_used}</td><td>${m.login_count}</td><td dir="ltr" class="muted">${fmt(m.last_login_at)}</td>
            <td><button class="small" data-id="${m.id}">إدارة</button></td></tr>`;
        }).join("") || html`<tr><td colspan="8" class="empty">لم تضف موظفين بعد</td></tr>`}
      </tbody></table>`;
  }

  var DENY = [["deny:delete", "منع الحذف (المستندات والحسابات والأصناف وغيرها)"], ["deny:edit", "منع تعديل المستندات المحفوظة (فواتير ومرتجعات وحركات الخزينة)"]];
  function denyBoxes(sel) {
    return '<div class="field full"><label>قيود إضافية <span class="muted" style="font-weight:400">(تُطبَّق على هذا الموظف فقط)</span></label><div class="row gap" style="flex-direction:column;align-items:flex-start">' +
      DENY.map(function (d) { return '<label style="display:inline-flex;gap:6px;align-items:center;font-weight:500"><input type="checkbox" data-d="' + d[0] + '"' + (sel.indexOf(d[0]) !== -1 ? " checked" : "") + ">" + d[1] + "</label>"; }).join("") + "</div></div>";
  }
  function permBoxes(sel) {
    return '<div class="field full"><label>الصفحات المسموحة <span class="muted" style="font-weight:400">(الرئيسية متاحة دائمًا)</span></label>' +
      '<div class="row gap" style="flex-wrap:wrap;margin-bottom:8px">' + Object.keys(PRESETS).map(function (k) { return '<button type="button" class="small ghost" data-preset="' + k + '">' + k + "</button>"; }).join("") +
      '<button type="button" class="small ghost" data-preset="__all">الكل</button><button type="button" class="small ghost" data-preset="__none">لا شيء</button></div>' +
      GROUPS.map(function (g) {
        return '<div style="margin:8px 0"><div class="muted" style="font-size:12px;margin-bottom:4px">' + g[0] + '</div><div class="row gap" style="flex-wrap:wrap">' +
          g[1].map(function (p) { return '<label style="display:inline-flex;gap:6px;align-items:center;font-weight:500"><input type="checkbox" data-p="' + p[0] + '"' + (sel.indexOf(p[0]) !== -1 ? " checked" : "") + ">" + p[1] + "</label>"; }).join("") + "</div></div>";
      }).join("") + "</div>";
  }
  function bindPresets(ov) {
    ov.querySelectorAll("[data-preset]").forEach(function (b) {
      b.onclick = function () {
        var k = b.getAttribute("data-preset"), list = k === "__all" ? [].concat.apply([], GROUPS.map(function (g) { return g[1].map(function (p) { return p[0]; }); })) : (k === "__none" ? [] : PRESETS[k]);
        ov.querySelectorAll("[data-p]").forEach(function (c) { c.checked = list.indexOf(c.getAttribute("data-p")) !== -1; });
      };
    });
  }
  var picked = function (ov) {
    return Array.prototype.map.call(ov.querySelectorAll("[data-p]:checked"), function (c) { return c.getAttribute("data-p"); })
      .concat(Array.prototype.map.call(ov.querySelectorAll("[data-d]:checked"), function (c) { return c.getAttribute("data-d"); }));
  };

  async function call(body) {
    var r = await client().functions.invoke("staff", { body: body });
    if (r.error) {
      var msg = "تعذّر تنفيذ العملية";
      try { var j = await r.error.context.json(); if (j && j.message) msg = j.message; } catch (e) {}
      throw new Error(msg);
    }
    return r.data;
  }

  function openAdd() {
    var ov = Ledger.modal("موظف جديد", html`
      <div class="form-grid">
        <div class="field"><label>الاسم</label><input id="n" required></div>
        <div class="field"><label>رقم التليفون (يسجّل به الدخول)</label><input id="ph" dir="ltr" inputmode="tel" required></div>
        <div class="field"><label>كلمة المرور (6 أحرف على الأقل)</label><input id="pw" dir="ltr" required minlength="6"></div>
        ${permBoxes(["sales", "customers"])}
        ${denyBoxes([])}
      </div>`, async function (o) {
      await call({ action: "create", full_name: val("n").trim(), phone: val("ph"), password: val("pw"), permissions: picked(o) });
      UI.toast("تمت إضافة الموظف"); o.remove(); await load();
    }, "إضافة");
    bindPresets(ov);
  }

  function openEdit(m) {
    var ov = Ledger.modal("إدارة: " + esc(m.full_name), html`
      <div class="form-grid">
        <div class="field"><label>الاسم</label><input id="n" value="${esc(m.full_name)}" required></div>
        <div class="field"><label>الحالة</label><select id="st"><option value="active" ${m.status === "active" ? "selected" : ""}>نشط</option><option value="suspended" ${m.status === "suspended" ? "selected" : ""}>موقوف</option></select></div>
        ${permBoxes(m.permissions || [])}
        ${denyBoxes(m.permissions || [])}
        <div class="field full"><div class="row gap">
          <button type="button" class="small" id="rp">تغيير كلمة المرور</button>
          <button type="button" class="small danger" id="dl">حذف الموظف</button>
        </div></div>
      </div>`, async function (o) {
      var r = await client().rpc("staff_update", { p_user: m.id, p_name: val("n").trim(), p_permissions: picked(o), p_status: val("st"), p_note: null });
      if (r.error) throw new Error(r.error.message);
      UI.toast("تم الحفظ"); o.remove(); await load();
    });
    bindPresets(ov);
    ov.querySelector("#rp").onclick = async function () {
      var pw = prompt("كلمة المرور الجديدة (6 أحرف على الأقل):");
      if (!pw) return;
      try { await call({ action: "reset_password", user_id: m.id, password: pw }); UI.toast("تم تغيير كلمة المرور"); } catch (e) { UI.toast(e.message, true); }
    };
    ov.querySelector("#dl").onclick = async function () {
      if (!confirm("حذف الموظف نهائيًا؟ لن يستطيع الدخول مرة أخرى (بيانات الشركة تبقى كما هي).")) return;
      try { await call({ action: "delete", user_id: m.id }); UI.toast("تم الحذف"); ov.remove(); await load(); } catch (e) { UI.toast(e.message, true); }
    };
  }

  async function load() {
    var r = await client().rpc("company_staff");
    if (r.error) { document.getElementById("tbl").innerHTML = '<div class="empty">' + esc(r.error.message) + "</div>"; return; }
    staff = r.data || []; draw();
  }

  if (DB.isDemo()) {
    document.getElementById("tbl").innerHTML = '<div class="empty">إدارة المستخدمين متاحة في النسخة السحابية (بعد تسجيل الدخول).</div>';
    document.getElementById("b-add").disabled = true;
    return;
  }
  document.getElementById("b-add").onclick = openAdd;
  document.getElementById("tbl").onclick = function (e) {
    var b = e.target.closest("[data-id]"); if (!b) return;
    openEdit(staff.filter(function (x) { return x.id === b.getAttribute("data-id"); })[0]);
  };
  await load();
})();
