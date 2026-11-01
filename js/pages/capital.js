(async function () {
  var page = await UI.init("capital");
  if (!page) return;
  var html = UI.html, money = UI.money, esc = Ledger.esc, val = Ledger.val;
  var N = function (v) { return Number(v) || 0; };
  var accounts = [], registers = [], banks = [], entries = [], lines = [];

  function newId() {
    if (window.crypto && crypto.randomUUID) return crypto.randomUUID();
    return "id-" + Date.now().toString(36) + Math.random().toString(36).slice(2, 10);
  }
  // حساب رأس المال: a6 الافتراضي، وإلا أول حقوق ملكية باسم «رأس المال»، وإلا أول حقوق ملكية
  function capitalAcc() {
    var byId = accounts.filter(function (a) { return a.id === "a6"; })[0];
    if (byId) return byId;
    var eq = accounts.filter(function (a) { return a.type === "equity"; });
    return eq.filter(function (a) { return /رأس\s*المال|راس\s*المال/.test(a.name || ""); })[0] || eq[0] || null;
  }
  function capEntries() { return entries.filter(function (e) { return e.source === "capital"; }); }
  function linesOf(e) { return lines.filter(function (l) { return l.entry_id === e.id; }); }

  page.innerHTML = html`
    <div class="stack">
      <div class="page-toolbar">
        <div>
          <h2 style="margin:0">رأس المال</h2>
          <p class="muted" style="margin:4px 0 0;font-size:12px">إيداع رأس المال وسحب المالك · يظهر تلقائيًا في «حقوق الملكية» بقائمة المركز المالي</p>
        </div>
        <div class="row gap">
          <button type="button" class="primary" id="btn-in">+ إيداع رأس مال</button>
          <button type="button" id="btn-out">+ سحب من رأس المال</button>
        </div>
      </div>
      <div class="stats-grid" id="stats"></div>
      <div class="card muted" style="font-size:13px;line-height:1.8">
        رصيد رأس المال الذي تراه هنا يُحسب من كل القيود على حساب «رأس المال» في دليل الحسابات.
        الإيداع يزيد الخزينة/البنك المختار ويُقيَّد دائنًا في رأس المال، والسحب العكس.
        الأرصدة الافتتاحية للخزائن والبنوك والمخزون والعملاء <b>لا</b> تُقيَّد تلقائيًا في الدفاتر؛ لإظهارها في المركز المالي سجّلها هنا أو بقيد يدوي.
      </div>
      <div class="card table-wrap" id="list"></div>
    </div>`;

  function render() {
    var cap = capitalAcc();
    var dep = 0, wd = 0, bal = 0;
    if (cap) lines.forEach(function (l) {
      if (l.account_id !== cap.id) return;
      var e = entries.filter(function (x) { return x.id === l.entry_id; })[0]; if (!e) return;
      bal += N(l.credit) - N(l.debit);
      if (e.source === "capital") { dep += N(l.credit); wd += N(l.debit); }
    });
    document.getElementById("stats").innerHTML = [["رصيد رأس المال", bal], ["إجمالي الإيداعات", dep], ["إجمالي المسحوبات", wd]]
      .map(function (s) { return '<div class="stat card"><div class="muted" style="font-size:12px">' + s[0] + '</div><div style="font-size:24px;font-weight:800">' + money(s[1]) + "</div></div>"; }).join("");
    var list = capEntries().sort(function (a, b) { return String(b.date || "").localeCompare(String(a.date || "")) || N(b.number) - N(a.number); });
    document.getElementById("list").innerHTML = html`
      <table><thead><tr><th>#</th><th>التاريخ</th><th>النوع</th><th>الجهة</th><th>المبلغ</th><th>البيان</th><th></th></tr></thead>
      <tbody>${list.length === 0 ? html`<tr><td colspan="7" class="empty">لا توجد حركات رأس مال — اضغط «+ إيداع رأس مال» لتسجيل رأس مال النشاط</td></tr>` : list.map(function (e) {
        var isIn = e.cap_dir !== "out";
        return html`<tr data-id="${e.id}"><td>${e.number}</td><td dir="ltr">${e.date}</td>
          <td><span class="badge ${isIn ? "ok" : "warn"}">${isIn ? "إيداع رأس مال" : "سحب"}</span></td>
          <td>${esc(e.cap_target_name || "—")}</td><td><b>${money(e.cap_amount)}</b></td><td class="muted">${esc(e.cap_notes || "")}</td>
          <td class="nw"><button type="button" class="ghost sm danger" data-act="del">حذف</button></td></tr>`; }).join("")}</tbody></table>`;
  }

  async function bankBal(b) {
    var mv = await DB.listWhere("bank_movements", "bank_id", b.id);
    return N(b.opening_balance) + mv.reduce(function (s, m) { return s + (m.type === "deposit" ? 1 : -1) * N(m.amount); }, 0);
  }

  function openForm(dir) {
    var cap = capitalAcc();
    if (!cap) { UI.toast("لا يوجد حساب حقوق ملكية في دليل الحسابات — أضف حساب «رأس المال» (نوع: حقوق ملكية)", true); return; }
    var isIn = dir === "in";
    var assets = accounts.filter(function (a) { return a.type === "asset" && !["a1", "a2"].includes(a.id); });
    Ledger.modal(isIn ? "إيداع رأس مال" : "سحب من رأس المال", html`
      <div class="form-grid">
        <div class="field full"><label>${isIn ? "تُودَع في" : "تُسحب من"}</label>
          <select id="c-target">
            ${registers.length ? html`<optgroup label="الخزائن">${registers.map(function (r) { return html`<option value="reg:${r.id}">${esc(r.name)} (${money(r.balance)})</option>`; }).join("")}</optgroup>` : ""}
            ${banks.length ? html`<optgroup label="البنوك">${banks.map(function (b) { return html`<option value="bank:${b.id}">${esc(b.name)}</option>`; }).join("")}</optgroup>` : ""}
            ${assets.length ? html`<optgroup label="أصل آخر (قيد محاسبي فقط، بدون حركة نقدية)">${assets.map(function (a) { return html`<option value="acct:${a.id}">${esc(a.code)} — ${esc(a.name)}</option>`; }).join("")}</optgroup>` : ""}
          </select></div>
        <div class="field"><label>المبلغ</label><input id="c-amt" type="number" step="0.01" min="0.01" required></div>
        <div class="field"><label>التاريخ</label><input id="c-date" type="date" value="${Ledger.today()}" required></div>
        <div class="field full"><label>البيان <span class="opt">اختياري</span></label><input id="c-notes" placeholder="${isIn ? "رأس مال بداية النشاط" : "مسحوبات المالك"}"></div>
      </div>`, async function (ov) {
      var amt = N(val("c-amt")), date = val("c-date"), notes = val("c-notes").trim(), t = val("c-target");
      if (!t) throw new Error("لا توجد خزينة أو بنك — أضف واحدًا أولًا");
      if (amt <= 0) throw new Error("المبلغ غير صحيح");
      if (!date) throw new Error("اختر التاريخ");
      var kind = t.split(":")[0], tid = t.slice(kind.length + 1), eid = newId(), accId, tname, moveId = "", bmoveId = "";
      if (kind === "reg") {
        var reg = registers.filter(function (r) { return r.id === tid; })[0]; tname = reg.name; accId = "a1";
        if (!isIn && amt > N(reg.balance) + 0.004) throw new Error("رصيد الخزينة غير كافٍ");
        moveId = newId();
      } else if (kind === "bank") {
        var bk = banks.filter(function (b) { return b.id === tid; })[0]; tname = bk.name; accId = "a2";
        if (!isIn && amt > (await bankBal(bk)) + 0.004) throw new Error("رصيد البنك غير كافٍ");
        bmoveId = newId();
      } else { var ac = accounts.filter(function (a) { return a.id === tid; })[0]; tname = ac.name; accId = ac.id; }
      var memo = (isIn ? "إيداع رأس مال — " : "سحب من رأس المال — ") + tname;
      var jn = await DB.nextNumber("journal_entries");
      await DB.insertRows([
        { table: "journal_entries", row: { id: eid, number: jn, date: date, memo: memo, source: "capital", cap_dir: dir, cap_amount: amt, cap_target: t, cap_target_name: tname, cap_notes: notes, move_id: moveId, bmove_id: bmoveId } },
        { table: "journal_lines", row: { entry_id: eid, account_id: isIn ? accId : cap.id, debit: amt, credit: 0 } },
        { table: "journal_lines", row: { entry_id: eid, account_id: isIn ? cap.id : accId, debit: 0, credit: amt } },
      ]);
      if (kind === "reg") await Ledger.treasuryMove({ id: moveId, register_id: tid, type: isIn ? "in" : "out", amount: amt, date: date, ref: eid, notes: memo + (notes ? " — " + notes : "") });
      if (kind === "bank") await DB.insertRows([{ table: "bank_movements", row: { id: bmoveId, bank_id: tid, type: isIn ? "deposit" : "withdraw", amount: amt, date: date, notes: memo + (notes ? " — " + notes : ""), register_id: "", cash_move_id: "", jid: eid, ref: eid } }]);
      UI.toast(isIn ? "تم تسجيل رأس المال" : "تم تسجيل السحب"); ov.remove(); await load();
    }, "ترحيل");
  }

  async function del(e) {
    DB.assertCan("delete");
    if (!confirm("حذف هذه الحركة؟ سيُعكس أثرها على الخزينة/البنك والقيود.")) return;
    var isIn = e.cap_dir !== "out", amt = N(e.cap_amount);
    if (e.move_id) {
      var reg = await DB.get("cash_registers", String(e.cap_target || "").slice(4), { fresh: true });
      if (reg) {
        var nb = N(reg.balance) - (isIn ? 1 : -1) * amt;
        if (nb < -0.004) throw new Error("الحذف يجعل رصيد الخزينة سالبًا");
        await DB.update("cash_registers", reg.id, { balance: nb });
      }
      await DB.removeMany("cash_movements", [e.move_id]);
    }
    if (e.bmove_id) {
      var bk = banks.filter(function (b) { return b.id === String(e.cap_target || "").slice(5); })[0];
      if (bk && isIn && (await bankBal(bk)) - amt < -0.004) throw new Error("الحذف يجعل رصيد البنك سالبًا");
      await DB.removeMany("bank_movements", [e.bmove_id]);
    }
    await DB.removeMany("journal_lines", linesOf(e).map(function (l) { return l.id; }));
    await DB.removeMany("journal_entries", [e.id]);
    UI.toast("تم الحذف"); await load();
  }

  async function load() {
    DB.refresh();
    var d = await Promise.all([DB.list("accounts"), DB.list("cash_registers"), DB.list("banks"), DB.list("journal_entries"), DB.list("journal_lines")]);
    accounts = d[0] || []; registers = d[1] || []; banks = d[2] || []; entries = d[3] || []; lines = d[4] || [];
    render();
  }
  document.getElementById("list").onclick = async function (ev) {
    var b = ev.target.closest('[data-act="del"]'); if (!b) return;
    var e = entries.filter(function (x) { return x.id === b.closest("tr").getAttribute("data-id"); })[0]; if (!e) return;
    try { await del(e); } catch (err) { UI.toast(err.message, true); }
  };
  document.getElementById("btn-in").onclick = function () { openForm("in"); };
  document.getElementById("btn-out").onclick = function () { openForm("out"); };
  await load();
})();
