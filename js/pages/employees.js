(async function () {
  var page = await UI.init("employees");
  if (!page) return;
  var html = UI.html, money = UI.money;
  var employees = [];

  page.innerHTML = html`
    <div class="stack">
      <div class="page-toolbar">
        <div>
          <h2 style="margin:0">الموظفين</h2>
          <p class="muted" style="margin:4px 0 0;font-size:12px">الموارد البشرية · الرواتب الأساسية</p>
        </div>
        <button type="button" class="primary" id="btn-add">+ موظف</button>
      </div>
      <div class="stats" id="stats"></div>
      <div class="card table-wrap" id="list"></div>
    </div>`;

  function render() {
    var active = employees.filter(function (e) { return e.status !== "inactive"; });
    var payroll = active.reduce(function (s, e) { return s + (Number(e.salary) || 0); }, 0);
    document.getElementById("stats").innerHTML = html`
      <div class="stat teal"><div class="label">الموظفين النشطين</div><div class="value">${active.length}</div></div>
      <div class="stat"><div class="label">إجمالي الرواتب الشهرية</div><div class="value">${money(payroll)}</div></div>`;

    document.getElementById("list").innerHTML = html`
      <table>
        <thead><tr><th>الاسم</th><th>المسمى</th><th>الهاتف</th><th>الراتب</th><th>التعيين</th><th>الحالة</th><th></th></tr></thead>
        <tbody>
          ${employees.map(function (e) {
            return html`<tr>
              <td><b>${e.name}</b></td>
              <td>${e.job_title || "—"}</td>
              <td dir="ltr">${e.phone || "—"}</td>
              <td>${money(e.salary)}</td>
              <td dir="ltr">${e.hire_date || "—"}</td>
              <td><span class="badge ${e.status === "active" ? "ok" : "warn"}">${e.status === "active" ? "نشط" : "موقوف"}</span></td>
              <td>
                <button class="small" data-act="edit" data-id="${e.id}">تعديل</button>
                <button class="small danger" data-act="del" data-id="${e.id}">حذف</button>
              </td>
            </tr>`;
          }).join("") || html`<tr><td colspan="7" class="empty">لا يوجد موظفين</td></tr>`}
        </tbody>
      </table>`;
  }

  function openForm(emp) {
    var isNew = !emp;
    emp = emp || { name: "", job_title: "", phone: "", salary: 0, hire_date: new Date().toISOString().slice(0,10), status: "active" };
    var ov = document.createElement("div");
    ov.className = "modal-overlay";
    ov.innerHTML = html`<div class="modal card">
      <h3 style="margin-top:0">${isNew ? "موظف جديد" : "تعديل موظف"}</h3>
      <form id="f" class="stack">
        <div class="form-grid">
          <div class="field"><label>الاسم</label><input id="name" required value="${emp.name || ""}"></div>
          <div class="field"><label>المسمى الوظيفي</label><input id="job" value="${emp.job_title || ""}"></div>
          <div class="field"><label>الهاتف</label><input id="phone" dir="ltr" value="${emp.phone || ""}"></div>
          <div class="field"><label>الراتب الأساسي</label><input id="salary" type="number" step="0.01" value="${emp.salary || 0}"></div>
          <div class="field"><label>تاريخ التعيين</label><input id="hire" type="date" value="${emp.hire_date || ""}"></div>
          <div class="field"><label>الحالة</label>
            <select id="status">
              <option value="active" ${emp.status === "active" ? "selected" : ""}>نشط</option>
              <option value="inactive" ${emp.status === "inactive" ? "selected" : ""}>موقوف</option>
            </select>
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
        name: document.getElementById("name").value.trim(),
        job_title: document.getElementById("job").value.trim(),
        phone: document.getElementById("phone").value.trim(),
        salary: Number(document.getElementById("salary").value) || 0,
        hire_date: document.getElementById("hire").value,
        status: document.getElementById("status").value,
      };
      try {
        if (isNew) await DB.insert("employees", payload);
        else await DB.update("employees", emp.id, payload);
        UI.toast("تم الحفظ"); ov.remove(); await load();
      } catch (err) { UI.toast(err.message, true); }
    };
  }

  async function load() {
    employees = await DB.list("employees");
    render();
  }

  document.getElementById("btn-add").onclick = function () { openForm(null); };
  document.getElementById("list").onclick = async function (e) {
    var btn = e.target.closest("[data-act]");
    if (!btn) return;
    var id = btn.getAttribute("data-id");
    var emp = employees.filter(function (x) { return x.id === id; })[0];
    if (btn.getAttribute("data-act") === "edit") openForm(emp);
    if (btn.getAttribute("data-act") === "del") {
      if (!confirm("حذف الموظف؟")) return;
      await DB.remove("employees", id); UI.toast("تم"); await load();
    }
  };
  await load();
})();
