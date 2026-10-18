(async function () {
  var page = await UI.init("banks");
  if (!page) return;
  var html = UI.html, money = UI.money, esc = Ledger.esc, val = Ledger.val;
  var banks = [], moves = [], registers = [], sel = "";
  var today = Ledger.today();

  page.innerHTML = html`
    <div class="stack">
      <div class="page-toolbar">
        <div>
          <h2 style="margin:0">البنوك</h2>
          <p class="muted" style="margin:4px 0 0;font-size:12px">حسابات بنكية · إيداع وسحب · كشف حساب بالرصيد الجاري</p>
        </div>
        <div class="row gap">
          <button type="button" class="primary" id="b-add">+ حساب بنكي</button>
          <button type="button" id="b-dep">+ إيداع</button>
          <button type="button" id="b-wd">+ سحب</button>
        </div>
      </div>
      <div class="stats" id="stats"></div>
      <div class="card table-wrap" id="list"></div>
      <div class="card table-wrap"><div class="panel-title"><h3 id="ttl">كشف الحساب</h3>
        <div class="row gap"><select id="pick" style="min-width:180px"></select><button type="button" class="small" id="csv">تصدير Excel</button></div></div>
        <div id="tbl"></div></div>
    </div>`;

  function bal(b) {
    return (Number(b.opening_balance) || 0) + moves.filter(function (m) { return m.bank_id === b.id; })
      .reduce(function (s, m) { return s + (m.type === "deposit" ? 1 : -1) * (Number(m.amount) || 0); }, 0);
  }
  function stmt(id) {
    var b = banks.filter(function (x) { return x.id === id; })[0]; if (!b) return null;
    var rows = moves.filter(function (m) { return m.bank_id === id; }).sort(function (a, c) {
      return a.date === c.date ? String(a.created_at).localeCompare(String(c.created_at)) : (a.date < c.date ? -1 : 1);
    });
    var run = Number(b.opening_balance) || 0;
    return { b: b, opening: run, rows: rows.map(function (m) { run += (m.type === "deposit" ? 1 : -1) * (Number(m.amount) || 0); return { m: m, balance: run }; }), closing: run };
  }

  function render() {
    var total = banks.reduce(function (s, b) { return s + bal(b); }, 0);
    document.getElementById("stats").innerHTML = html`
      <div class="stat teal"><div class="label">إجمالي أرصدة البنوك</div><div class="value">${money(total)}</div></div>
      <div class="stat"><div class="label">عدد الحسابات</div><div class="value">${banks.length}</div></div>`;
    document.getElementById("list").innerHTML = html`
      <table><thead><tr><th>البنك</th><th>رقم الحساب</th><th>الرصيد</th><th></th></tr></thead><tbody>
        ${banks.map(function (b) {
          return html`<tr><td><b>${b.name}</b></td><td dir="ltr">${b.account_no || "—"}</td><td class="accent"><b>${money(bal(b))}</b></td>
            <td><div class="actions-cell"><button class="small" data-act="st" data-id="${b.id}">كشف</button><button class="small danger" data-act="del" data-id="${b.id}">حذف</button></div></td></tr>`;
        }).join("") || html`<tr><td colspan="4" class="empty">لا توجد حسابات بنكية</td></tr>`}
      </tbody></table>`;
    if (!sel || !banks.some(function (b) { return b.id === sel; })) sel = banks[0] ? banks[0].id : "";
    document.getElementById("pick").innerHTML = banks.map(function (b) { return '<option value="' + b.id + '"' + (b.id === sel ? " selected" : "") + ">" + esc(b.name) + "</option>"; }).join("");
    var s = stmt(sel);
    document.getElementById("tbl").innerHTML = !s ? '<div class="empty">أضف حسابًا بنكيًا لعرض الكشف</div>' : html`
      <table><thead><tr><th>التاريخ</th><th>النوع</th><th>البيان</th><th>إيداع</th><th>سحب</th><th>الرصيد</th></tr></thead><tbody>
        <tr><td colspan="5" class="muted">رصيد افتتاحي</td><td><b>${money(s.opening)}</b></td></tr>
        ${s.rows.map(function (r) {
          var d = r.m.type === "deposit";
          return html`<tr><td dir="ltr">${r.m.date}</td><td><span class="badge ${d ? "ok" : "warn"}">${d ? "إيداع" : "سحب"}</span></td><td class="muted">${r.m.notes || ""}</td>
            <td>${d ? money(r.m.amount) : ""}</td><td>${d ? "" : money(r.m.amount)}</td><td class="accent"><b>${money(r.balance)}</b></td></tr>`;
        }).join("") || html`<tr><td colspan="6" class="empty">لا توجد حركات</td></tr>`}
      </tbody></table>`;
  }

  function openBank() {
    Ledger.modal("حساب بنكي جديد", html`
      <div class="form-grid">
        <div class="field"><label>اسم البنك</label><input id="n" required></div>
        <div class="field"><label>رقم الحساب</label><input id="a" dir="ltr"></div>
        <div class="field"><label>رصيد افتتاحي</label><input id="o" type="number" step="0.01" value="0"></div>
      </div>`, async function (ov) {
      var b = await DB.insert("banks", { name: val("n").trim(), account_no: val("a").trim(), opening_balance: Number(val("o")) || 0 });
      sel = b.id; UI.toast("تم الحفظ"); ov.remove(); await load();
    });
  }

  function openMove(type) {
    if (!banks.length) { UI.toast("أضف حسابًا بنكيًا أولًا", true); return; }
    var dep = type === "deposit";
    Ledger.modal(dep ? "إيداع في البنك" : "سحب من البنك", html`
      <div class="form-grid">
        <div class="field"><label>الحساب البنكي</label><select id="bk">${banks.map(function (b) { return '<option value="' + b.id + '"' + (b.id === sel ? " selected" : "") + ">" + esc(b.name) + " (" + money(bal(b)) + ")</option>"; }).join("")}</select></div>
        <div class="field"><label>المبلغ</label><input id="amt" type="number" step="0.01" min="0.01" required></div>
        <div class="field"><label>التاريخ</label><input id="dt" type="date" value="${today}"></div>
        <div class="field"><label>${dep ? "من خزينة" : "إلى خزينة"}</label><select id="reg"><option value="">بدون (تحويل/شيك خارجي)</option>
          ${registers.map(function (r) { return '<option value="' + r.id + '">' + esc(r.name) + "</option>"; }).join("")}</select></div>
        <div class="field full"><label>البيان</label><input id="nt"></div>
      </div>`, async function (ov) {
      var id = val("bk"), amt = Number(val("amt")) || 0, reg = val("reg"), date = val("dt"), notes = val("nt").trim();
      var b = banks.filter(function (x) { return x.id === id; })[0];
      if (!dep && amt > bal(b)) throw new Error("رصيد البنك غير كافٍ");
      if (reg) {
        // إيداع من الخزينة = خروج نقدية؛ سحب إلى الخزينة = دخول نقدية
        var r = registers.filter(function (x) { return x.id === reg; })[0];
        if (dep && amt > (Number(r.balance) || 0)) throw new Error("رصيد الخزينة غير كافٍ");
        await Ledger.treasuryMove({ register_id: reg, type: dep ? "out" : "in", amount: amt, date: date, notes: (dep ? "إيداع في " : "سحب من ") + b.name + (notes ? " — " + notes : "") });
      }
      await DB.insert("bank_movements", { bank_id: id, type: dep ? "deposit" : "withdraw", amount: amt, date: date, notes: notes, register_id: reg });
      var cp = reg ? "a1" : (dep ? "a7" : "a10");
      var jn = await DB.nextNumber("journal_entries");
      var e = await DB.insert("journal_entries", { number: jn, date: date, memo: (dep ? "إيداع بنكي: " : "سحب بنكي: ") + b.name, source: "bank" });
      await DB.insert("journal_lines", { entry_id: e.id, account_id: dep ? "a2" : cp, debit: amt, credit: 0 });
      await DB.insert("journal_lines", { entry_id: e.id, account_id: dep ? cp : "a2", debit: 0, credit: amt });
      sel = id; UI.toast("تم التسجيل"); ov.remove(); await load();
    }, "ترحيل");
  }

  async function load() {
    var d = await Promise.all([DB.list("banks"), DB.list("bank_movements"), DB.list("cash_registers")]);
    banks = d[0].slice().sort(function (a, b) { return String(a.created_at).localeCompare(String(b.created_at)); });
    moves = d[1]; registers = d[2];
    render();
  }

  document.getElementById("b-add").onclick = openBank;
  document.getElementById("b-dep").onclick = function () { openMove("deposit"); };
  document.getElementById("b-wd").onclick = function () { openMove("withdraw"); };
  document.getElementById("pick").onchange = function () { sel = val("pick"); render(); };
  document.getElementById("list").onclick = async function (e) {
    var btn = e.target.closest("[data-act]"); if (!btn) return;
    var id = btn.getAttribute("data-id");
    if (btn.getAttribute("data-act") === "st") { sel = id; render(); }
    else if (confirm("حذف الحساب البنكي؟")) { await DB.remove("banks", id); UI.toast("تم الحذف"); await load(); }
  };
  document.getElementById("csv").onclick = function () {
    var s = stmt(sel); if (!s) return;
    UI.exportCSV("كشف-" + s.b.name + ".csv", ["التاريخ", "النوع", "البيان", "إيداع", "سحب", "الرصيد"],
      [["", "رصيد افتتاحي", "", "", "", s.opening]].concat(s.rows.map(function (r) {
        var d = r.m.type === "deposit"; return [r.m.date, d ? "إيداع" : "سحب", r.m.notes || "", d ? r.m.amount : "", d ? "" : r.m.amount, r.balance];
      })));
  };
  await load();
})();
