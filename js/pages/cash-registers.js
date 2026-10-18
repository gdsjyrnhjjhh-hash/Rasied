(async function () {
  var page = await UI.init("cash-registers");
  if (!page) return;
  var html = UI.html, money = UI.money, esc = Ledger.esc, val = Ledger.val;
  var registers = [], tabs = [], view = "regs", st = null;
  var TYPE = { in: ["وارد", "ok"], out: ["منصرف", "warn"], transfer_in: ["تحويل وارد", "ok"], transfer_out: ["تحويل صادر", "warn"], opening: ["رصيد افتتاحي", ""] };
  var q = new URLSearchParams(location.search);
  var f = { reg: q.get("reg") || "", from: "", to: "", type: "", tab: "", text: "" };

  page.innerHTML = html`
    <div class="stack">
      <div class="page-toolbar">
        <div>
          <h2 style="margin:0">الخزائن</h2>
          <p class="muted" style="margin:4px 0 0;font-size:12px">أرصدة · كشف حساب بالرصيد الجاري · تحويلات · تبويبات</p>
        </div>
        <div class="row gap">
          <button type="button" class="primary" id="btn-add">+ خزينة</button>
          <button type="button" id="btn-move">+ وارد / منصرف</button>
          <button type="button" id="btn-transfer">⇄ تحويل بين خزينتين</button>
        </div>
      </div>
      <div class="seg" id="seg">
        <button type="button" class="on" data-v="regs">الخزائن</button>
        <button type="button" data-v="stmt">كشف الحساب</button>
        <button type="button" data-v="tabs">التبويبات</button>
      </div>
      <div id="view" class="stack"></div>
    </div>`;

  var today = Ledger.today();
  function opts(list, sel, blank) {
    return (blank ? '<option value="">' + blank + "</option>" : "") + list.map(function (r) {
      return '<option value="' + r.id + '"' + (r.id === sel ? " selected" : "") + ">" + esc(r.name) + "</option>";
    }).join("");
  }
  function regName(id) { var r = registers.filter(function (x) { return x.id === id; })[0]; return r ? r.name : "—"; }
  function tabName(id) { var t = tabs.filter(function (x) { return x.id === id; })[0]; return t ? t.name : ""; }

  /* ---------- 1) قائمة الخزائن ---------- */
  function renderRegs() {
    var total = registers.reduce(function (s, r) { return s + (Number(r.balance) || 0); }, 0);
    var v = document.getElementById("view");
    v.innerHTML = html`
      <div class="stats">
        <div class="stat teal"><div class="label">إجمالي النقدية</div><div class="value">${money(total)}</div></div>
        <div class="stat"><div class="label">عدد الخزائن</div><div class="value">${registers.length}</div></div>
      </div>
      <div class="card table-wrap" id="list">
        <table>
          <thead><tr><th>الخزينة</th><th>الموقع</th><th>الرصيد</th><th></th></tr></thead>
          <tbody>
            ${registers.map(function (r) {
              return html`<tr>
                <td><b>${r.name}</b></td>
                <td>${r.location || "—"}</td>
                <td class="accent"><b>${money(r.balance)}</b></td>
                <td><div class="actions-cell">
                  <button class="small" data-act="stmt" data-id="${r.id}">كشف حساب</button>
                  <button class="small" data-act="edit" data-id="${r.id}">تعديل</button>
                  <button class="small danger" data-act="del" data-id="${r.id}">حذف</button>
                </div></td>
              </tr>`;
            }).join("") || html`<tr><td colspan="4" class="empty">لا توجد خزائن</td></tr>`}
          </tbody>
        </table>
      </div>`;
    document.getElementById("list").onclick = async function (e) {
      var btn = e.target.closest("[data-act]"); if (!btn) return;
      var id = btn.getAttribute("data-id"), act = btn.getAttribute("data-act");
      var r = registers.filter(function (x) { return x.id === id; })[0];
      if (act === "stmt") { f.reg = id; setView("stmt"); }
      if (act === "edit") openReg(r);
      if (act === "del") {
        if (!confirm("حذف الخزينة؟ ستبقى حركاتها السابقة في السجل.")) return;
        await DB.remove("cash_registers", id); UI.toast("تم الحذف"); await load();
      }
    };
  }

  function openReg(r) {
    var isNew = !r; r = r || { name: "", location: "" };
    Ledger.modal(isNew ? "خزينة جديدة" : "تعديل خزينة", html`
      <div class="form-grid">
        <div class="field"><label>الاسم</label><input id="name" required value="${r.name || ""}"></div>
        <div class="field"><label>الموقع</label><input id="loc" value="${r.location || ""}"></div>
        ${isNew ? html`<div class="field"><label>رصيد افتتاحي</label><input id="bal" type="number" step="0.01" min="0" value="0"></div>` : ""}
      </div>`, async function (ov) {
      var name = val("name").trim(), loc = val("loc").trim();
      if (isNew) {
        var reg = await DB.insert("cash_registers", { name: name, location: loc, balance: 0 });
        var b = Number(val("bal")) || 0;
        if (b > 0) await Ledger.treasuryMove({ register_id: reg.id, type: "opening", amount: b, date: today, notes: "رصيد افتتاحي" });
      } else await DB.update("cash_registers", r.id, { name: name, location: loc });
      UI.toast("تم الحفظ"); ov.remove(); await load();
    });
  }

  /* ---------- حركة وارد/منصرف ---------- */
  function openMove() {
    if (!registers.length) { UI.toast("أضف خزينة أولاً", true); return; }
    Ledger.modal("حركة خزينة", html`
      <div class="form-grid">
        <div class="field"><label>الخزينة</label><select id="reg">${registers.map(function (r) {
          return html`<option value="${r.id}" ${r.id === f.reg ? "selected" : ""}>${r.name} (${money(r.balance)})</option>`;
        }).join("")}</select></div>
        <div class="field"><label>النوع</label><select id="kind"><option value="in">وارد (إيداع)</option><option value="out">منصرف (صرف)</option></select></div>
        <div class="field"><label>المبلغ</label><input id="amount" type="number" step="0.01" required min="0.01"></div>
        <div class="field"><label>التاريخ</label><input id="date" type="date" value="${today}"></div>
        <div class="field"><label>التبويب</label><select id="tab" dir="auto">${opts(tabs, "", "— بدون تبويب —")}</select></div>
        <div class="field full"><label>البيان</label><input id="notes"></div>
      </div>`, async function (ov) {
      var id = val("reg"), kind = val("kind"), amount = Number(val("amount")) || 0;
      var reg = registers.filter(function (r) { return r.id === id; })[0];
      if (kind === "out" && amount > (Number(reg.balance) || 0)) throw new Error("الرصيد غير كافٍ");
      var notes = val("notes").trim(), date = val("date");
      await Ledger.treasuryMove({ register_id: id, type: kind, amount: amount, date: date, notes: notes, tab_id: val("tab") });
      // قيد مبسط على الصندوق
      var jn = await DB.nextNumber("journal_entries");
      var entry = await DB.insert("journal_entries", { number: jn, date: date, memo: (kind === "in" ? "وارد خزينة: " : "منصرف خزينة: ") + reg.name, source: "cash" });
      await DB.insert("journal_lines", { entry_id: entry.id, account_id: kind === "in" ? "a1" : "a10", debit: amount, credit: 0 });
      await DB.insert("journal_lines", { entry_id: entry.id, account_id: kind === "in" ? "a7" : "a1", debit: 0, credit: amount });
      UI.toast("تم ترحيل الحركة"); ov.remove(); await load();
    }, "ترحيل");
  }

  function openTransfer() {
    if (registers.length < 2) { UI.toast("تحتاج خزينتين على الأقل", true); return; }
    Ledger.modal("تحويل بين خزينتين", html`
      <div class="form-grid">
        <div class="field"><label>من خزينة</label><select id="a">${opts(registers, f.reg)}</select></div>
        <div class="field"><label>إلى خزينة</label><select id="b">${opts(registers.slice().reverse(), "")}</select></div>
        <div class="field"><label>المبلغ</label><input id="amount" type="number" step="0.01" min="0.01" required></div>
        <div class="field"><label>التاريخ</label><input id="date" type="date" value="${today}"></div>
        <div class="field full"><label>ملاحظات</label><input id="notes"></div>
      </div>`, async function (ov) {
      await Ledger.transfer(val("a"), val("b"), Number(val("amount")) || 0, val("date"), val("notes").trim());
      UI.toast("تم التحويل"); ov.remove(); await load();
    }, "تنفيذ التحويل");
  }

  /* ---------- 2) كشف الحساب ---------- */
  async function renderStmt() {
    var v = document.getElementById("view");
    if (!f.reg && registers.length) f.reg = registers[0].id;
    v.innerHTML = html`
      <div class="card">
        <div class="form-grid">
          <div class="field"><label>الخزينة</label><select id="s-reg">${opts(registers, f.reg)}</select></div>
          <div class="field"><label>من تاريخ</label><input type="date" id="s-from" value="${f.from}"></div>
          <div class="field"><label>إلى تاريخ</label><input type="date" id="s-to" value="${f.to}"></div>
          <div class="field"><label>نوع الحركة</label><select id="s-type"><option value="">الكل</option>
            ${Object.keys(TYPE).map(function (k) { return '<option value="' + k + '"' + (f.type === k ? " selected" : "") + ">" + TYPE[k][0] + "</option>"; }).join("")}</select></div>
          <div class="field"><label>التبويب</label><select id="s-tab">${opts(tabs, f.tab, "الكل")}</select></div>
          <div class="field"><label>بحث في البيان</label><input id="s-text" value="${f.text}" placeholder="كلمة من البيان..."></div>
        </div>
      </div>
      <div class="stats" id="s-stats"></div>
      <div class="card table-wrap"><div class="panel-title"><h3>كشف حساب الخزينة</h3>
        <div class="row gap"><button type="button" class="small" id="s-csv">تصدير Excel</button><button type="button" class="small" id="s-print">طباعة</button></div></div>
        <div id="s-table"></div></div>`;
    ["s-reg", "s-from", "s-to", "s-type", "s-tab"].forEach(function (id) { document.getElementById(id).onchange = readF; });
    document.getElementById("s-text").oninput = readF;
    await drawStmt();
  }
  function readF() {
    f.reg = val("s-reg"); f.from = val("s-from"); f.to = val("s-to"); f.type = val("s-type"); f.tab = val("s-tab"); f.text = val("s-text");
    drawStmt();
  }
  async function drawStmt() {
    if (!f.reg) { document.getElementById("s-table").innerHTML = '<div class="empty">لا توجد خزائن</div>'; return; }
    st = await Ledger.treasuryStatement(f.reg, f.from, f.to);
    var t = (f.text || "").toLowerCase();
    var rows = st.rows.filter(function (r) {
      var m = r.m, ty = m.type || (m.kind === "in" ? "in" : "out");
      return (!f.type || ty === f.type) && (!f.tab || m.tab_id === f.tab) && (!t || (m.notes || "").toLowerCase().indexOf(t) !== -1);
    });
    st.view = rows;
    var tin = rows.reduce(function (s, r) { return s + r.inc; }, 0), tout = rows.reduce(function (s, r) { return s + r.out; }, 0);
    document.getElementById("s-stats").innerHTML = html`
      <div class="stat"><div class="label">رصيد سابق</div><div class="value">${money(st.opening)}</div></div>
      <div class="stat green"><div class="label">إجمالي الوارد</div><div class="value">${money(tin)}</div></div>
      <div class="stat red"><div class="label">إجمالي المنصرف</div><div class="value">${money(tout)}</div></div>
      <div class="stat teal"><div class="label">الرصيد الحالي</div><div class="value">${money(st.closing)}</div></div>`;
    document.getElementById("s-table").innerHTML = html`
      <table>
        <thead><tr><th>التاريخ</th><th>النوع</th><th>البيان</th><th>التبويب</th><th>وارد</th><th>منصرف</th><th>الرصيد</th></tr></thead>
        <tbody>
          <tr><td colspan="6" class="muted">رصيد سابق</td><td><b>${money(st.opening)}</b></td></tr>
          ${rows.map(function (r) {
            var m = r.m, ty = TYPE[m.type || (m.kind === "in" ? "in" : "out")] || ["—", ""];
            return html`<tr>
              <td dir="ltr">${m._d}</td>
              <td><span class="badge ${ty[1]}">${ty[0]}</span></td>
              <td class="muted">${m.notes || ""}</td>
              <td>${tabName(m.tab_id) || "—"}</td>
              <td>${r.inc ? money(r.inc) : ""}</td>
              <td>${r.out ? money(r.out) : ""}</td>
              <td class="accent"><b>${money(r.balance)}</b></td>
            </tr>`;
          }).join("") || html`<tr><td colspan="7" class="empty">لا توجد حركات في هذه الفترة</td></tr>`}
        </tbody>
      </table>`;
    document.getElementById("s-csv").onclick = function () {
      UI.exportCSV("كشف-" + st.reg.name + ".csv", ["التاريخ", "النوع", "البيان", "التبويب", "وارد", "منصرف", "الرصيد"],
        [["", "", "رصيد سابق", "", "", "", st.opening]].concat(rows.map(function (r) {
          var ty = TYPE[r.m.type || (r.m.kind === "in" ? "in" : "out")] || ["", ""];
          return [r.m._d, ty[0], r.m.notes || "", tabName(r.m.tab_id), r.inc || "", r.out || "", r.balance];
        })));
    };
    document.getElementById("s-print").onclick = function () {
      var co = DB.getCompany();
      UI.printHTML("كشف خزينة", "<h1>" + esc(co.name || "") + "</h1><h2>كشف حساب خزينة: " + esc(st.reg.name) + "</h2>" +
        '<div class="meta"><div><div>الفترة: ' + (f.from || "البداية") + " → " + (f.to || "اليوم") + "</div></div><div><div>الرصيد الحالي: <b>" + money(st.closing) + "</b></div></div></div>" +
        "<table><thead><tr><th>التاريخ</th><th>النوع</th><th>البيان</th><th>وارد</th><th>منصرف</th><th>الرصيد</th></tr></thead><tbody>" +
        '<tr><td colspan="5">رصيد سابق</td><td>' + money(st.opening) + "</td></tr>" +
        rows.map(function (r) {
          var ty = TYPE[r.m.type || (r.m.kind === "in" ? "in" : "out")] || ["", ""];
          return "<tr><td>" + r.m._d + "</td><td>" + ty[0] + "</td><td>" + esc(r.m.notes || "") + "</td><td>" + (r.inc ? money(r.inc) : "") + "</td><td>" + (r.out ? money(r.out) : "") + "</td><td>" + money(r.balance) + "</td></tr>";
        }).join("") + "</tbody></table>");
    };
  }

  /* ---------- 3) التبويبات (عامة / خاصة) + تقرير ---------- */
  async function renderTabs() {
    var v = document.getElementById("view");
    var mv = await DB.list("cash_movements");
    var from = f.from, to = f.to;
    v.innerHTML = html`
      <div class="card">
        <div class="form-grid">
          <div class="field"><label>من تاريخ</label><input type="date" id="t-from" value="${from}"></div>
          <div class="field"><label>إلى تاريخ</label><input type="date" id="t-to" value="${to}"></div>
          <div class="field" style="align-self:end"><button type="button" class="primary" id="t-add">+ تبويب جديد</button></div>
        </div>
        <p class="muted" style="margin:10px 0 0;font-size:12px">التبويب العام يظهر في كل التقارير، والخاص للحركات الداخلية الحساسة. اختر التبويب عند تسجيل أي حركة.</p>
      </div>
      <div class="card table-wrap">
        <table>
          <thead><tr><th>التبويب</th><th>النوع</th><th>وارد</th><th>منصرف</th><th>الصافي</th><th></th></tr></thead>
          <tbody id="t-body"></tbody>
        </table>
      </div>`;
    function calc() {
      var rows = tabs.map(function (t) {
        var i = 0, o = 0;
        mv.forEach(function (m) {
          var d = String(m.date || m.created_at || "").slice(0, 10);
          if (m.tab_id !== t.id || (f.from && d < f.from) || (f.to && d > f.to)) return;
          if (m.type === "transfer_in" || m.type === "transfer_out") return;
          if (m.kind === "in") i += Number(m.amount) || 0; else o += Number(m.amount) || 0;
        });
        return { t: t, i: i, o: o };
      });
      document.getElementById("t-body").innerHTML = html`${rows.map(function (r) {
        return html`<tr><td><b>${r.t.name}</b></td>
          <td><span class="badge ${r.t.kind === "private" ? "warn" : "ok"}">${r.t.kind === "private" ? "خاص" : "عام"}</span></td>
          <td>${money(r.i)}</td><td>${money(r.o)}</td><td class="accent"><b>${money(r.i - r.o)}</b></td>
          <td><button class="small danger" data-del="${r.t.id}">حذف</button></td></tr>`;
      }).join("") || html`<tr><td colspan="6" class="empty">لا توجد تبويبات. أضف تبويباً لتصنيف حركات الخزينة (مثل: مصروفات إدارية، إيرادات أخرى).</td></tr>`}`;
    }
    calc();
    document.getElementById("t-from").onchange = function () { f.from = val("t-from"); calc(); };
    document.getElementById("t-to").onchange = function () { f.to = val("t-to"); calc(); };
    document.getElementById("t-add").onclick = function () {
      Ledger.modal("تبويب جديد", html`
        <div class="form-grid">
          <div class="field"><label>اسم التبويب</label><input id="tn" required></div>
          <div class="field"><label>النوع</label><select id="tk"><option value="general">عام</option><option value="private">خاص</option></select></div>
        </div>`, async function (ov) {
        await DB.insert("treasury_tabs", { name: val("tn").trim(), kind: val("tk") });
        UI.toast("تمت الإضافة"); ov.remove(); await load();
      });
    };
    document.getElementById("t-body").onclick = async function (e) {
      var b = e.target.closest("[data-del]"); if (!b) return;
      if (!confirm("حذف التبويب؟ الحركات المرتبطة ستبقى بدون تبويب.")) return;
      await DB.remove("treasury_tabs", b.getAttribute("data-del")); UI.toast("تم الحذف"); await load();
    };
  }

  function setView(v) {
    view = v;
    document.querySelectorAll("#seg button").forEach(function (b) { b.classList.toggle("on", b.getAttribute("data-v") === v); });
    draw();
  }
  function draw() { if (view === "regs") renderRegs(); else if (view === "stmt") renderStmt(); else renderTabs(); }

  async function load() {
    var d = await Promise.all([DB.list("cash_registers"), DB.list("treasury_tabs")]);
    registers = d[0].slice().sort(function (a, b) { return (a.created_at || "").localeCompare(b.created_at || ""); });
    tabs = d[1].slice().sort(function (a, b) { return (a.created_at || "").localeCompare(b.created_at || ""); });
    draw();
  }

  document.getElementById("seg").onclick = function (e) { var b = e.target.closest("[data-v]"); if (b) setView(b.getAttribute("data-v")); };
  document.getElementById("btn-add").onclick = function () { openReg(null); };
  document.getElementById("btn-move").onclick = openMove;
  document.getElementById("btn-transfer").onclick = openTransfer;
  if (f.reg) view = "stmt";
  await load();
  if (view === "stmt") setView("stmt");
})();
