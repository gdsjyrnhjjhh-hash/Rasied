(async function () {
  var page = await UI.init("attendance");
  if (!page) return;
  var html = UI.html, esc = Ledger.esc, val = Ledger.val;
  var emps = [], recs = [], view = "day";
  var ST = { present: ["حاضر", "ok"], late: ["متأخر", "warn"], absent: ["غائب", "err"], leave: ["إجازة", ""] };

  page.innerHTML = html`
    <div class="stack">
      <div class="page-toolbar">
        <div>
          <h2 style="margin:0">الحضور والانصراف</h2>
          <p class="muted" style="margin:4px 0 0;font-size:12px">تسجيل يومي لحالة الموظفين · ملخص شهري</p>
        </div>
        <div class="row gap"><button type="button" id="csv">تصدير Excel</button></div>
      </div>
      <div class="seg" id="seg"><button type="button" class="on" data-v="day">تسجيل اليوم</button><button type="button" data-v="month">ملخص الشهر</button></div>
      <div class="card"><div class="form-grid">
        <div class="field" id="f-day"><label>اليوم</label><input type="date" id="day" value="${Ledger.today()}"></div>
        <div class="field" id="f-month" style="display:none"><label>الشهر</label><input type="month" id="month" value="${Ledger.today().slice(0, 7)}"></div>
      </div></div>
      <div class="stats" id="stats"></div>
      <div class="card table-wrap" id="tbl"></div>
    </div>`;

  function rec(empId, d) { return recs.filter(function (r) { return r.employee_id === empId && r.date === d; })[0]; }
  async function save(empId, d, patch) {
    var r = rec(empId, d);
    if (r) { await DB.update("attendance", r.id, patch); Object.assign(r, patch); }
    else recs.push(await DB.insert("attendance", Object.assign({ employee_id: empId, date: d, status: "present", check_in: "", check_out: "", notes: "" }, patch)));
  }

  function drawDay() {
    var d = val("day"), active = emps.filter(function (e) { return e.status !== "inactive"; });
    var cnt = { present: 0, late: 0, absent: 0, leave: 0, none: 0 };
    active.forEach(function (e) { var r = rec(e.id, d); cnt[r ? r.status : "none"]++; });
    document.getElementById("stats").innerHTML = html`
      <div class="stat green"><div class="label">حاضر</div><div class="value">${cnt.present}</div></div>
      <div class="stat amber"><div class="label">متأخر</div><div class="value">${cnt.late}</div></div>
      <div class="stat red"><div class="label">غائب</div><div class="value">${cnt.absent}</div></div>
      <div class="stat"><div class="label">لم يُسجَّل</div><div class="value">${cnt.none}</div></div>`;
    document.getElementById("tbl").innerHTML = html`
      <table><thead><tr><th>الموظف</th><th>الحالة</th><th>حضور</th><th>انصراف</th><th>ملاحظات</th></tr></thead><tbody>
        ${active.map(function (e) {
          var r = rec(e.id, d) || {};
          return html`<tr data-e="${e.id}"><td><b>${e.name}</b><div class="muted" style="font-size:11.5px">${e.job_title || ""}</div></td>
            <td><select data-k="status"><option value="">— اختر —</option>${Object.keys(ST).map(function (k) { return '<option value="' + k + '"' + (r.status === k ? " selected" : "") + ">" + ST[k][0] + "</option>"; }).join("")}</select></td>
            <td><input type="time" data-k="check_in" value="${r.check_in || ""}"></td>
            <td><input type="time" data-k="check_out" value="${r.check_out || ""}"></td>
            <td><input data-k="notes" value="${esc(r.notes || "")}" placeholder="ملاحظة"></td></tr>`;
        }).join("") || html`<tr><td colspan="5" class="empty">لا يوجد موظفون. أضفهم من صفحة الموظفين.</td></tr>`}
      </tbody></table>`;
  }

  function monthRows() {
    var m = val("month");
    return emps.map(function (e) {
      var mine = recs.filter(function (r) { return r.employee_id === e.id && String(r.date).slice(0, 7) === m; });
      var c = function (s) { return mine.filter(function (r) { return r.status === s; }).length; };
      return { e: e, present: c("present"), late: c("late"), absent: c("absent"), leave: c("leave") };
    });
  }
  function drawMonth() {
    var rows = monthRows();
    document.getElementById("stats").innerHTML = "";
    document.getElementById("tbl").innerHTML = html`
      <table><thead><tr><th>الموظف</th><th>حضور</th><th>تأخير</th><th>غياب</th><th>إجازات</th></tr></thead><tbody>
        ${rows.map(function (r) { return html`<tr><td><b>${r.e.name}</b></td><td>${r.present}</td><td>${r.late}</td><td class="${r.absent ? "accent" : ""}">${r.absent}</td><td>${r.leave}</td></tr>`; }).join("") || html`<tr><td colspan="5" class="empty">لا توجد بيانات</td></tr>`}
      </tbody></table>`;
  }
  function draw() { if (view === "day") drawDay(); else drawMonth(); }

  document.getElementById("tbl").addEventListener("change", async function (e) {
    var tr = e.target.closest("tr[data-e]"), k = e.target.getAttribute("data-k"); if (!tr || !k) return;
    var patch = {}; patch[k] = e.target.value;
    if (k !== "status" && !rec(tr.getAttribute("data-e"), val("day"))) patch.status = "present";
    try { await save(tr.getAttribute("data-e"), val("day"), patch); drawDay(); UI.toast("تم الحفظ"); } catch (err) { UI.toast(err.message, true); }
  });
  document.getElementById("seg").onclick = function (e) {
    var b = e.target.closest("[data-v]"); if (!b) return; view = b.getAttribute("data-v");
    document.querySelectorAll("#seg button").forEach(function (x) { x.classList.toggle("on", x === b); });
    document.getElementById("f-day").style.display = view === "day" ? "" : "none";
    document.getElementById("f-month").style.display = view === "month" ? "" : "none"; draw();
  };
  document.getElementById("day").onchange = draw; document.getElementById("month").onchange = draw;
  document.getElementById("csv").onclick = function () {
    var rows = monthRows();
    UI.exportCSV("حضور-" + val("month") + ".csv", ["الموظف", "حضور", "تأخير", "غياب", "إجازات"], rows.map(function (r) { return [r.e.name, r.present, r.late, r.absent, r.leave]; }));
  };
  var d = await Promise.all([DB.list("employees"), DB.list("attendance")]);
  emps = d[0].slice().reverse(); recs = d[1]; draw();
})();
