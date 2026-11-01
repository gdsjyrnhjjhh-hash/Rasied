(async function () {
  var page = await UI.init("field-reports");
  if (!page) return;
  var html = UI.html, money = UI.money, esc = Ledger.esc, val = Ledger.val;
  var TBL = "visit_reports";
  var TYPES = { visit: "زيارة", call: "مكالمة", whatsapp: "واتساب", meeting: "اجتماع" };
  var OUTCOMES = { agreed: "تم الاتفاق", interested: "مهتم", follow: "يحتاج متابعة", no_answer: "لم يرد", rejected: "رفض" };
  var OUT_BADGE = { agreed: "ok", interested: "ok", follow: "warn", no_answer: "", rejected: "danger" };
  var rows = [], customers = [];
  var me = DB.me();
  var f = { period: "today", type: "", who: "", q: "" };

  function today() { return Ledger.today(); }
  function addDays(iso, n) { var d = new Date(iso + "T12:00:00"); d.setDate(d.getDate() + n); return d.toISOString().slice(0, 10); }
  function range() {
    var t = today();
    if (f.period === "today") return [t, t];
    if (f.period === "yesterday") { var y = addDays(t, -1); return [y, y]; }
    if (f.period === "week") return [addDays(t, -6), t];
    if (f.period === "month") return [t.slice(0, 8) + "01", t];
    return ["", ""];
  }
  function canTouch(r) { return me.owner || r.by === me.id; }
  function partyLabel(r) { return esc(r.party_name || "—"); }

  page.innerHTML = html`
    <div class="stack">
      <div class="page-toolbar">
        <div>
          <h2 style="margin:0">تقارير الزيارات والمكالمات</h2>
          <p class="muted" style="margin:4px 0 0;font-size:12px">سجّل نشاطك اليومي مع العملاء · نتيجة · موعد متابعة</p>
        </div>
        <div class="row gap">
          <button type="button" class="primary" id="btn-add">+ تقرير جديد</button>
          <button type="button" id="btn-exp">تصدير Excel</button>
        </div>
      </div>
      <div class="stats-grid" id="stats"></div>
      <div id="due"></div>
      <div class="card">
        <div class="row gap" style="flex-wrap:wrap;align-items:flex-end">
          <div class="field"><label>الفترة</label>
            <select id="f-period"><option value="today">اليوم</option><option value="yesterday">أمس</option><option value="week">آخر 7 أيام</option><option value="month">هذا الشهر</option><option value="all">الكل</option></select></div>
          <div class="field"><label>النشاط</label>
            <select id="f-type"><option value="">الكل</option>${Object.keys(TYPES).map(function (k) { return html`<option value="${k}">${TYPES[k]}</option>`; }).join("")}</select></div>
          <div class="field" id="who-wrap" style="display:none"><label>الموظف</label><select id="f-who"><option value="">الكل</option></select></div>
          <div class="field" style="flex:1;min-width:160px"><label>بحث</label><input id="f-q" placeholder="اسم العميل أو ملاحظة..."></div>
        </div>
      </div>
      <div class="card table-wrap" id="list"></div>
    </div>`;

  function mine() { return rows.filter(function (r) { return me.owner || r.by === me.id; }); }
  function filtered() {
    var rg = range(), q = f.q.trim().toLowerCase();
    return mine().filter(function (r) {
      if (rg[0] && (r.date < rg[0] || r.date > rg[1])) return false;
      if (f.type && r.type !== f.type) return false;
      if (f.who && r.by !== f.who) return false;
      if (q && (String(r.party_name || "") + " " + String(r.notes || "")).toLowerCase().indexOf(q) === -1) return false;
      return true;
    }).sort(function (a, b) { return String(b.date + (b.time || "")).localeCompare(String(a.date + (a.time || ""))) || String(b.created_at || "").localeCompare(String(a.created_at || "")); });
  }

  function render() {
    var list = filtered(), t = today();
    var visits = list.filter(function (r) { return r.type === "visit"; }).length;
    var calls = list.filter(function (r) { return r.type === "call"; }).length;
    var agreed = list.filter(function (r) { return r.outcome === "agreed"; }).length;
    var dueList = mine().filter(function (r) { return r.follow_date && !r.follow_done && r.follow_date <= t; });
    document.getElementById("stats").innerHTML = [
      ["زيارات", visits], ["مكالمات", calls], ["تم الاتفاق", agreed], ["متابعات مستحقة", dueList.length],
    ].map(function (s) { return '<div class="stat card"><div class="muted" style="font-size:12px">' + s[0] + '</div><div style="font-size:24px;font-weight:800">' + s[1] + "</div></div>"; }).join("");

    document.getElementById("due").innerHTML = dueList.length ? html`
      <div class="card" style="border-inline-start:4px solid var(--warn, #f59e0b)">
        <h3 style="margin:0 0 8px">متابعات مستحقة (${dueList.length})</h3>
        <div class="stack" style="gap:6px">${dueList.sort(function (a, b) { return a.follow_date.localeCompare(b.follow_date); }).map(function (r) {
          return html`<div class="row gap" style="justify-content:space-between;align-items:center;flex-wrap:wrap" data-id="${r.id}">
            <div><b>${partyLabel(r)}</b> <span class="muted">· ${TYPES[r.type] || ""} · موعد المتابعة <span dir="ltr">${r.follow_date}</span>${r.follow_date < t ? " (متأخرة)" : ""}</span>
              ${r.notes ? html`<div class="muted" style="font-size:12px">${esc(r.notes)}</div>` : ""}</div>
            <div class="row gap">${r.party_phone ? html`<a class="button small" href="tel:${esc(r.party_phone)}">اتصال</a>` : ""}<button type="button" class="small" data-act="done">تمت المتابعة</button><button type="button" class="small ghost" data-act="new-follow">تقرير جديد</button></div>
          </div>`; }).join("")}</div>
      </div>` : "";

    document.getElementById("list").innerHTML = html`
      <table>
        <thead><tr><th>التاريخ</th><th>الموظف</th><th>النشاط</th><th>العميل</th><th>النتيجة</th><th>ملاحظات</th><th>المتابعة</th><th></th></tr></thead>
        <tbody>${list.length === 0 ? html`<tr><td colspan="8" class="empty">لا توجد تقارير في هذه الفترة</td></tr>` : list.map(function (r) {
          return html`<tr data-id="${r.id}">
            <td dir="ltr">${r.date}${r.time ? " " + r.time : ""}</td>
            <td>${esc(r.by_name || "—")}</td>
            <td>${TYPES[r.type] || r.type}</td>
            <td><b>${partyLabel(r)}</b>${r.party_phone ? html`<div class="muted" dir="ltr" style="font-size:12px">${esc(r.party_phone)}</div>` : ""}</td>
            <td><span class="badge ${OUT_BADGE[r.outcome] || ""}">${OUTCOMES[r.outcome] || "—"}</span></td>
            <td class="muted">${esc(r.notes || "")}${N(r.expected) > 0 ? html`<div>متوقع: <b>${money(r.expected)}</b></div>` : ""}</td>
            <td>${r.follow_date ? html`<span dir="ltr">${r.follow_date}</span>${r.follow_done ? " ✓" : ""}` : "—"}</td>
            <td class="nw">${canTouch(r) ? html`<button type="button" class="ghost sm" data-act="edit">تعديل</button> <button type="button" class="ghost sm danger" data-act="del">حذف</button>` : ""}</td>
          </tr>`; }).join("")}</tbody>
      </table>`;
  }
  function N(v) { return Number(v) || 0; }

  function openForm(ex, pre) {
    var r = ex || pre || {};
    var now = new Date(), hh = String(now.getHours()).padStart(2, "0") + ":" + String(now.getMinutes()).padStart(2, "0");
    Ledger.modal(ex ? "تعديل تقرير" : "تقرير جديد", html`
      <div class="form-grid">
        <div class="field"><label>النشاط</label><select id="r-type">${Object.keys(TYPES).map(function (k) { return html`<option value="${k}" ${(r.type || "visit") === k ? "selected" : ""}>${TYPES[k]}</option>`; }).join("")}</select></div>
        <div class="field"><label>التاريخ</label><input id="r-date" type="date" value="${r.date || today()}" required></div>
        <div class="field"><label>الوقت</label><input id="r-time" type="time" value="${r.time || (ex ? "" : hh)}"></div>
        <div class="field full"><label>العميل (اختر من القائمة أو اكتب اسم عميل جديد)</label>
          <input id="r-party" list="r-clist" value="${esc(r.party_name || "")}" placeholder="اسم العميل..." required autocomplete="off">
          <datalist id="r-clist">${customers.map(function (c) { return html`<option value="${esc(c.name)}"></option>`; }).join("")}</datalist></div>
        <div class="field"><label>هاتف <span class="opt">اختياري</span></label><input id="r-phone" dir="ltr" value="${esc(r.party_phone || "")}"></div>
        <div class="field"><label>النتيجة</label><select id="r-out">${Object.keys(OUTCOMES).map(function (k) { return html`<option value="${k}" ${(r.outcome || "follow") === k ? "selected" : ""}>${OUTCOMES[k]}</option>`; }).join("")}</select></div>
        <div class="field"><label>قيمة متوقعة <span class="opt">اختياري</span></label><input id="r-exp" type="number" min="0" step="0.01" value="${r.expected || ""}"></div>
        <div class="field"><label>موعد المتابعة <span class="opt">اختياري</span></label><input id="r-follow" type="date" value="${r.follow_date || ""}"></div>
        <div class="field full"><label>ما تم / ملاحظات</label><textarea id="r-notes" rows="3" style="width:100%">${esc(r.notes || "")}</textarea></div>
      </div>`, async function (ov) {
      var name = val("r-party").trim();
      if (!name) throw new Error("اكتب اسم العميل");
      var cust = customers.filter(function (c) { return c.name === name; })[0];
      var data = {
        type: val("r-type"), date: val("r-date"), time: val("r-time"), party_id: cust ? cust.id : "", party_name: name,
        party_phone: val("r-phone").trim() || (cust && cust.phone) || "", outcome: val("r-out"), expected: N(val("r-exp")),
        follow_date: val("r-follow"), notes: val("r-notes").trim(),
      };
      if (!data.date) throw new Error("اختر التاريخ");
      if (ex) {
        if (!canTouch(ex)) throw new Error("لا يمكنك تعديل تقرير زميلك");
        if (data.follow_date !== ex.follow_date) data.follow_done = false;
        await DB.update(TBL, ex.id, data);
      } else { data.follow_done = false; await DB.insert(TBL, data); }
      UI.toast(ex ? "تم تعديل التقرير" : "تم حفظ التقرير");
      ov.remove(); await load();
    });
  }

  async function load() {
    DB.refresh();
    var d = await Promise.all([DB.list(TBL), DB.list("customers")]);
    rows = d[0] || []; customers = d[1] || [];
    if (me.owner) {
      var seen = {}, opts = '<option value="">الكل</option>';
      rows.forEach(function (r) { if (r.by && !seen[r.by]) { seen[r.by] = 1; opts += '<option value="' + esc(r.by) + '"' + (f.who === r.by ? " selected" : "") + ">" + esc(r.by_name || "موظف") + "</option>"; } });
      document.getElementById("f-who").innerHTML = opts;
      document.getElementById("who-wrap").style.display = "";
    }
    render();
  }

  function rowOf(e) { var tr = e.target.closest("[data-id]"); return tr ? rows.filter(function (x) { return x.id === tr.getAttribute("data-id"); })[0] : null; }
  async function onAct(e) {
    var b = e.target.closest("[data-act]"); if (!b) return;
    var r = rowOf(e); if (!r) return;
    var act = b.getAttribute("data-act");
    try {
      if (act === "edit") openForm(r);
      else if (act === "new-follow") openForm(null, { party_name: r.party_name, party_phone: r.party_phone, type: r.type });
      else if (act === "done") { await DB.update(TBL, r.id, { follow_done: true }); UI.toast("تم تسجيل المتابعة"); await load(); }
      else if (act === "del") {
        if (!canTouch(r)) throw new Error("لا يمكنك حذف تقرير زميلك");
        if (!confirm("حذف هذا التقرير؟")) return;
        await DB.remove(TBL, r.id); UI.toast("تم الحذف"); await load();
      }
    } catch (err) { UI.toast(err.message, true); }
  }
  document.getElementById("list").onclick = onAct;
  document.getElementById("due").onclick = onAct;
  document.getElementById("btn-add").onclick = function () { openForm(); };
  ["f-period", "f-type", "f-who"].forEach(function (id) {
    document.getElementById(id).onchange = function () { f[id === "f-period" ? "period" : id === "f-type" ? "type" : "who"] = this.value; render(); };
  });
  document.getElementById("f-q").oninput = function () { f.q = this.value; render(); };
  document.getElementById("f-period").value = f.period;

  document.getElementById("btn-exp").onclick = async function () {
    try { await UI.need("js/xlsx-lite.js", "Xlsx"); } catch (e) { UI.toast(e.message, true); return; }
    var list = filtered();
    if (!list.length) { UI.toast("لا توجد بيانات للتصدير", true); return; }
    var head = ["التاريخ", "الوقت", "الموظف", "النشاط", "العميل", "الهاتف", "النتيجة", "القيمة المتوقعة", "موعد المتابعة", "تمت المتابعة", "ملاحظات"].map(function (h) { return { v: h, s: "head" }; });
    var body = list.map(function (r) {
      return [r.date, r.time || "", r.by_name || "", TYPES[r.type] || "", r.party_name || "", r.party_phone || "", OUTCOMES[r.outcome] || "", N(r.expected), r.follow_date || "", r.follow_done ? "نعم" : "", r.notes || ""];
    });
    Xlsx.download("تقارير-الزيارات-" + today() + ".xlsx", { sheet: "التقارير", rows: [head].concat(body), cols: [12, 8, 16, 10, 22, 14, 14, 14, 14, 10, 40] });
  };
  await load();
})();
