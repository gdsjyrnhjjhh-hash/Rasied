(async function () {
  var page = await UI.init("payroll");
  if (!page) return;
  var html = UI.html, money = UI.money;
  var runs = [], lines = [], employees = [];

  page.innerHTML = html`
    <div class="stack">
      <div class="page-toolbar">
        <div>
          <h2 style="margin:0">المرتبات</h2>
          <p class="muted" style="margin:4px 0 0;font-size:12px">مسير رواتب شهري · ترحيل محاسبي</p>
        </div>
        <button type="button" class="primary" id="btn-run">+ مسير رواتب</button>
      </div>
      <div class="card table-wrap" id="list"></div>
      <div id="detail"></div>
    </div>`;

  function empName(id) {
    var e = employees.filter(function (x) { return x.id === id; })[0];
    return e ? e.name : "—";
  }

  function render() {
    document.getElementById("list").innerHTML = html`
      <table class="clickable">
        <thead><tr><th>الشهر</th><th>الإجمالي</th><th>الحالة</th><th>ملاحظات</th></tr></thead>
        <tbody>
          ${runs.map(function (r) {
            return html`<tr data-id="${r.id}">
              <td><b>${r.month}</b></td>
              <td class="accent">${money(r.total)}</td>
              <td><span class="badge ok">${r.status === "posted" ? "مرحّل" : r.status}</span></td>
              <td class="muted">${r.notes || ""}</td>
            </tr>`;
          }).join("") || html`<tr><td colspan="4" class="empty">لا يوجد مسيرات</td></tr>`}
        </tbody>
      </table>`;
  }

  function showDetail(id) {
    var r = runs.filter(function (x) { return x.id === id; })[0];
    if (!r) { document.getElementById("detail").innerHTML = ""; return; }
    var pl = lines.filter(function (l) { return l.run_id === id; });
    document.getElementById("detail").innerHTML = html`
      <div class="card stack">
        <h3 style="margin:0">مسير ${r.month} — الإجمالي ${money(r.total)}</h3>
        <div class="table-wrap">
          <table>
            <thead><tr><th>الموظف</th><th>أساسي</th><th>بدلات</th><th>خصومات</th><th>الصافي</th></tr></thead>
            <tbody>
              ${pl.map(function (l) {
                return html`<tr>
                  <td>${empName(l.employee_id)}</td>
                  <td>${money(l.basic)}</td>
                  <td>${money(l.allowances)}</td>
                  <td>${money(l.deductions)}</td>
                  <td><b>${money(l.net)}</b></td>
                </tr>`;
              }).join("")}
            </tbody>
          </table>
        </div>
      </div>`;
  }

  async function createRun() {
    var active = employees.filter(function (e) { return e.status !== "inactive"; });
    if (!active.length) { UI.toast("لا يوجد موظفين نشطين", true); return; }
    var month = new Date().toISOString().slice(0, 7);
    var ov = document.createElement("div");
    ov.className = "modal-overlay";
    ov.innerHTML = html`<div class="modal card">
      <h3 style="margin-top:0">مسير رواتب جديد</h3>
      <form id="f" class="stack">
        <div class="form-grid">
          <div class="field"><label>الشهر</label><input id="month" type="month" value="${month}" required></div>
          <div class="field full"><label>ملاحظات</label><input id="notes"></div>
        </div>
        <p class="muted">سيتم إنشاء بنود لكل موظف نشط حسب راتبه الأساسي. يمكنك تعديل البدلات/الخصومات لاحقاً في نسخة لاحقة.</p>
        <div class="row gap" style="justify-content:flex-end">
          <button type="button" class="ghost" id="cancel">إلغاء</button>
          <button class="primary" type="submit">إنشاء وترحيل</button>
        </div>
      </form>
    </div>`;
    document.body.appendChild(ov);
    ov.querySelector("#cancel").onclick = function () { ov.remove(); };
    ov.onclick = function (e) { if (e.target === ov) ov.remove(); };
    ov.querySelector("#f").onsubmit = async function (e) {
      e.preventDefault();
      var m = document.getElementById("month").value;
      var total = active.reduce(function (s, emp) { return s + (Number(emp.salary) || 0); }, 0);
      try {
        var run = await DB.insert("payroll_runs", {
          month: m, status: "posted", total: total,
          notes: document.getElementById("notes").value.trim(),
        });
        for (var i = 0; i < active.length; i++) {
          var emp = active[i];
          var sal = Number(emp.salary) || 0;
          await DB.insert("payroll_lines", {
            run_id: run.id, employee_id: emp.id,
            basic: sal, allowances: 0, deductions: 0, net: sal,
          });
        }
        var jn = await DB.nextNumber("journal_entries");
        var entry = await DB.insert("journal_entries", {
          number: jn, date: m + "-28",
          memo: "مسير رواتب " + m, source: "payroll", source_id: run.id,
        });
        await DB.insert("journal_lines", { entry_id: entry.id, account_id: "a13", debit: total, credit: 0 });
        await DB.insert("journal_lines", { entry_id: entry.id, account_id: "a1", debit: 0, credit: total });
        UI.toast("تم ترحيل مسير " + m);
        ov.remove(); await load();
      } catch (err) { UI.toast(err.message, true); }
    };
  }

  async function load() {
    var d = await Promise.all([DB.list("payroll_runs"), DB.list("payroll_lines"), DB.list("employees")]);
    runs = d[0]; lines = d[1]; employees = d[2];
    render();
  }

  document.getElementById("btn-run").onclick = createRun;
  document.getElementById("list").onclick = function (e) {
    var tr = e.target.closest("tr[data-id]");
    if (tr) showDetail(tr.getAttribute("data-id"));
  };
  await load();
})();
