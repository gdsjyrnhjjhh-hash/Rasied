/* البنوك: حسابات · إيداع/سحب · تحويل بين البنوك · كشف بالرصيد الجاري · ربط الشيكات */
(async function () {
  var page = await UI.init("banks", { title: ["البنوك", "حسابات · حركات · تحويل · ربط الشيكات"] });
  if (!page) return;
  var html = UI.html, money = UI.money, esc = Ledger.esc, val = Ledger.val, today = Ledger.today();
  var N = function (x) { return Number(x) || 0; };
  var banks = [], moves = [], registers = [], cheques = [], sel = "";
  var f = { text: "", from: "", to: "", type: "" };

  page.innerHTML = html`
    <div class="stack">
      <div class="page-toolbar">
        <div><h2 style="margin:0">البنوك</h2><p class="muted" style="margin:4px 0 0;font-size:12px">حسابات بنكية · إيداع وسحب · تحويل بين البنوك · كشف الحساب · الشيكات المرتبطة</p></div>
        <div class="row gap"><a class="button" href="cheques.html">الشيكات</a><button type="button" class="primary" id="b-add">+ حساب بنكي</button></div>
      </div>
      <div class="stats" id="stats"></div>
      <div class="reg-grid" id="list"></div>
      <div id="detail" class="stack"></div>
    </div>`;

  var mine = function (id) { return moves.filter(function (m) { return m.bank_id === id; }); };
  var plus = function (m) { return m.type === "deposit"; };
  function bal(b) { return N(b.opening_balance) + mine(b.id).reduce(function (s, m) { return s + (plus(m) ? 1 : -1) * N(m.amount); }, 0); }
  var locked = function (m) { return !!m.cheque_id; };

  function rowsFor(id) {
    var list = mine(id).slice().sort(function (a, c) { return a.date === c.date ? String(a.created_at).localeCompare(String(c.created_at)) : (a.date < c.date ? -1 : 1); });
    var b = banks.filter(function (x) { return x.id === id; })[0], run = N(b.opening_balance), n = 0;
    return list.map(function (m) { run += (plus(m) ? 1 : -1) * N(m.amount); n++; return { m: m, n: n, balance: run }; });
  }

  function render() {
    var total = banks.reduce(function (s, b) { return s + bal(b); }, 0);
    var outCh = cheques.filter(function (c) { return c.dir === "out" && c.status === "pending"; }).reduce(function (s, c) { return s + N(c.amount); }, 0);
    var inCh = cheques.filter(function (c) { return c.dir === "in" && c.status === "deposited"; }).reduce(function (s, c) { return s + N(c.amount); }, 0);
    document.getElementById("stats").innerHTML = html`
      <div class="stat teal"><div class="label">إجمالي أرصدة البنوك</div><div class="value">${money(total)}</div></div>
      <div class="stat"><div class="label">عدد الحسابات</div><div class="value">${banks.length}</div></div>
      <div class="stat amber"><div class="label">شيكات صادرة معلّقة</div><div class="value">${money(outCh)}</div></div>
      <div class="stat green"><div class="label">شيكات واردة مودعة (تحت التحصيل)</div><div class="value">${money(inCh)}</div></div>`;
    if (!sel || !banks.some(function (b) { return b.id === sel; })) sel = banks[0] ? banks[0].id : "";
    document.getElementById("list").innerHTML = banks.map(function (b) {
      return html`<div class="card reg-card${b.id === sel ? " sel" : ""}"><div class="reg-head"><b>${esc(b.name)}</b><span class="muted" dir="ltr">${esc(b.account_no || "")}</span></div>
        <div class="reg-bal">${money(bal(b))}</div>
        <div class="actions-cell"><button class="small primary" data-act="open" data-id="${b.id}">كشف الحساب</button><button class="small" data-act="edit" data-id="${b.id}">تعديل</button><button class="small danger" data-act="del" data-id="${b.id}">حذف</button></div></div>`;
    }).join("") || '<div class="card empty">لا توجد حسابات بنكية</div>';
    detail();
  }

  function detail() {
    var box = document.getElementById("detail"), b = banks.filter(function (x) { return x.id === sel; })[0];
    if (!b) { box.innerHTML = ""; return; }
    var all = rowsFor(sel), t = f.text.trim().toLowerCase();
    var rows = all.filter(function (r) {
      return (!f.from || r.m.date >= f.from) && (!f.to || r.m.date <= f.to) && (!f.type || (f.type === "d") === plus(r.m)) && (!t || String(r.m.notes || "").toLowerCase().indexOf(t) !== -1);
    });
    var dep = rows.reduce(function (s, r) { return s + (plus(r.m) ? N(r.m.amount) : 0); }, 0), wd = rows.reduce(function (s, r) { return s + (plus(r.m) ? 0 : N(r.m.amount)); }, 0);
    box.innerHTML = html`
      <div class="card top-panel"><div class="top-row"><b style="font-size:16px">${esc(b.name)}</b>
        <div class="chips"><div class="chip big"><span>الرصيد</span><b>${money(bal(b))}</b></div><div class="chip ok"><span>إيداعات</span><b>${money(dep)}</b></div><div class="chip warn"><span>سحوبات</span><b>${money(wd)}</b></div><div class="chip"><span>الحركات</span><b>${rows.length}</b></div></div></div>
        <div class="top-actions"><button type="button" class="primary" id="d-dep">+ إيداع</button><button type="button" class="primary" id="d-wd">+ سحب</button><button type="button" id="d-tr">تحويل لبنك آخر</button><button type="button" id="d-csv">تصدير Excel</button><button type="button" id="d-print">طباعة PDF</button></div></div>
      <div class="card"><div class="form-grid">
        <div class="field"><label>بحث في البيان</label><input id="q-t" value="${esc(f.text)}"></div>
        <div class="field"><label>من تاريخ</label><input type="date" id="q-f" value="${f.from}"></div>
        <div class="field"><label>إلى تاريخ</label><input type="date" id="q-to" value="${f.to}"></div>
        <div class="field"><label>النوع</label><select id="q-ty"><option value="">الكل</option><option value="d"${f.type === "d" ? " selected" : ""}>إيداع</option><option value="w"${f.type === "w" ? " selected" : ""}>سحب</option></select></div></div></div>
      <div class="card table-wrap"><table><thead><tr><th>#</th><th>التاريخ</th><th>البيان</th><th>النوع</th><th>إيداع</th><th>سحب</th><th>الرصيد</th><th></th></tr></thead><tbody>
        <tr><td colspan="6" class="muted">رصيد افتتاحي</td><td><b>${money(b.opening_balance)}</b></td><td></td></tr>
        ${rows.map(function (r) {
          var m = r.m;
          return html`<tr data-id="${m.id}"><td dir="ltr">${r.n}</td><td dir="ltr">${m.date}</td><td class="muted">${esc(m.notes || "")}${m.cheque_id ? ' <span class="badge">شيك</span>' : ""}</td>
            <td><span class="badge ${plus(m) ? "ok" : "warn"}">${plus(m) ? "إيداع" : "سحب"}</span></td><td class="in-c">${plus(m) ? money(m.amount) : ""}</td><td class="out-c">${plus(m) ? "" : money(m.amount)}</td>
            <td class="accent"><b>${money(r.balance)}</b></td>
            <td><div class="actions-cell">${locked(m) ? '<a class="small button" href="cheques.html">الشيكات</a>' : '<button class="small danger" data-del="' + m.id + '">حذف</button>'}</div></td></tr>`;
        }).join("") || '<tr><td colspan="8" class="empty">لا توجد حركات</td></tr>'}
      </tbody></table></div>`;
    document.getElementById("d-dep").onclick = function () { openMove("deposit"); };
    document.getElementById("d-wd").onclick = function () { openMove("withdraw"); };
    document.getElementById("d-tr").onclick = openTransfer;
    var upd = function () { f.text = val("q-t"); f.from = val("q-f"); f.to = val("q-to"); f.type = val("q-ty"); detail(); var i = document.getElementById("q-t"); i.focus(); i.setSelectionRange(i.value.length, i.value.length); };
    document.getElementById("q-t").oninput = upd;
    ["q-f", "q-to", "q-ty"].forEach(function (id) { document.getElementById(id).onchange = upd; });
    document.getElementById("d-csv").onclick = function () {
      UI.exportCSV("كشف-" + b.name + ".csv", ["#", "التاريخ", "البيان", "إيداع", "سحب", "الرصيد"], rows.map(function (r) { return [r.n, r.m.date, r.m.notes || "", plus(r.m) ? r.m.amount : "", plus(r.m) ? "" : r.m.amount, r.balance]; }));
    };
    document.getElementById("d-print").onclick = function () {
      var co = DB.getCompany();
      UI.printHTML("كشف بنك", "<h1>" + esc(co.name || "") + "</h1><h2>كشف حساب: " + esc(b.name) + "</h2>" +
        '<div class="meta"><div><div>رقم الحساب: ' + esc(b.account_no || "—") + "</div></div><div><div>الرصيد الحالي: <b>" + money(bal(b)) + "</b></div></div></div>" +
        "<table><thead><tr><th>#</th><th>التاريخ</th><th>البيان</th><th>إيداع</th><th>سحب</th><th>الرصيد</th></tr></thead><tbody>" +
        rows.map(function (r) { return "<tr><td>" + r.n + "</td><td>" + r.m.date + "</td><td>" + esc(r.m.notes || "") + "</td><td>" + (plus(r.m) ? money(r.m.amount) : "") + "</td><td>" + (plus(r.m) ? "" : money(r.m.amount)) + "</td><td>" + money(r.balance) + "</td></tr>"; }).join("") + "</tbody></table>");
    };
    box.querySelector("tbody").onclick = async function (e) {
      var d = e.target.closest("[data-del]"); if (!d) return;
      var m = moves.filter(function (x) { return x.id === d.getAttribute("data-del"); })[0];
      if (m.register_id && !m.cash_move_id) { UI.toast("حركة قديمة مرتبطة بخزينة — لا يمكن حذفها من هنا", true); return; }
      if (!confirm("حذف الحركة؟ سيتم عكس أثرها على الخزينة والقيود.")) return;
      try { await removeMove(m); UI.toast("تم الحذف"); await load(); } catch (err) { UI.toast(err.message || "خطأ", true); }
    };
  }

  async function removeMove(m) {
    var all = m.grp ? moves.filter(function (x) { return x.grp === m.grp; }) : [m];
    // لا يجوز أن يصبح رصيد البنك سالبًا بعد حذف إيداع
    for (var i = 0; i < all.length; i++) {
      var b = banks.filter(function (x) { return x.id === all[i].bank_id; })[0];
      var after = bal(b) - (plus(all[i]) ? 1 : -1) * N(all[i].amount);
      if (plus(all[i]) && after < -0.004) throw new Error("الحذف يجعل رصيد البنك سالبًا");
    }
    for (i = 0; i < all.length; i++) {
      var x = all[i];
      if (x.cash_move_id) {
        var cm = await DB.get("cash_movements", x.cash_move_id);
        if (cm) {
          var r = await DB.get("cash_registers", cm.register_id);
          if (r) await DB.update("cash_registers", r.id, { balance: N(r.balance) - (cm.kind === "in" ? 1 : -1) * N(cm.amount) });
          await DB.remove("cash_movements", cm.id);
        }
      }
      if (x.jid) {
        var ls = (await DB.list("journal_lines")).filter(function (l) { return l.entry_id === x.jid; });
        for (var k = 0; k < ls.length; k++) await DB.remove("journal_lines", ls[k].id);
        await DB.remove("journal_entries", x.jid);
      }
      await DB.remove("bank_movements", x.id);
    }
  }

  function openBank(b) {
    var edit = !!b; b = b || { name: "", account_no: "", opening_balance: 0 };
    Ledger.modal(edit ? "تعديل حساب بنكي" : "حساب بنكي جديد", html`
      <div class="form-grid">
        <div class="field"><label>اسم البنك</label><input id="n" required value="${esc(b.name)}"></div>
        <div class="field"><label>رقم الحساب</label><input id="a" dir="ltr" value="${esc(b.account_no)}"></div>
        <div class="field"><label>رصيد افتتاحي</label><input id="o" type="number" step="0.01" value="${N(b.opening_balance)}"></div>
      </div>`, async function (ov) {
      var d = { name: val("n").trim(), account_no: val("a").trim(), opening_balance: N(val("o")) };
      if (!d.name) throw new Error("اكتب اسم البنك");
      if (edit) await DB.update("banks", b.id, d); else sel = (await DB.insert("banks", d)).id;
      UI.toast("تم الحفظ"); ov.remove(); await load();
    });
  }

  function openMove(type) {
    var dep = type === "deposit";
    Ledger.modal(dep ? "إيداع في " + esc(banks.filter(function (x) { return x.id === sel; })[0].name) : "سحب من البنك", html`
      <div class="form-grid">
        <div class="field"><label>المبلغ</label><input id="amt" type="number" step="0.01" min="0.01" required></div>
        <div class="field"><label>التاريخ</label><input id="dt" type="date" value="${today}"></div>
        <div class="field full"><label>${dep ? "من خزينة" : "إلى خزينة"}</label><select id="reg"><option value="">بدون (تحويل / جهة خارجية)</option>
          ${registers.map(function (r) { return '<option value="' + r.id + '">' + esc(r.name) + " (" + money(r.balance) + ")</option>"; }).join("")}</select></div>
        <div class="field full"><label>البيان</label><input id="nt"></div>
      </div>`, async function (ov) {
      var amt = N(val("amt")), reg = val("reg"), date = val("dt"), notes = val("nt").trim();
      var b = banks.filter(function (x) { return x.id === sel; })[0];
      if (amt <= 0) throw new Error("المبلغ غير صحيح");
      if (!dep && amt > bal(b) + 0.004) throw new Error("رصيد البنك غير كافٍ");
      var cmId = "";
      if (reg) {
        var r = registers.filter(function (x) { return x.id === reg; })[0];
        if (dep && amt > N(r.balance)) throw new Error("رصيد الخزينة غير كافٍ");
        var cm = await Ledger.treasuryMove({ register_id: reg, type: dep ? "out" : "in", amount: amt, date: date, notes: (dep ? "إيداع في " : "سحب من ") + b.name + (notes ? " — " + notes : "") });
        cmId = cm.id;
      }
      var cp = reg ? "a1" : (dep ? "a7" : "a10");
      var jn = await DB.nextNumber("journal_entries");
      var e = await DB.insert("journal_entries", { number: jn, date: date, memo: (dep ? "إيداع بنكي: " : "سحب بنكي: ") + b.name, source: "bank" });
      await DB.insert("journal_lines", { entry_id: e.id, account_id: dep ? "a2" : cp, debit: amt, credit: 0 });
      await DB.insert("journal_lines", { entry_id: e.id, account_id: dep ? cp : "a2", debit: 0, credit: amt });
      await DB.insert("bank_movements", { bank_id: sel, type: dep ? "deposit" : "withdraw", amount: amt, date: date, notes: notes, register_id: reg, cash_move_id: cmId, jid: e.id });
      UI.toast("تم التسجيل"); ov.remove(); await load();
    }, "ترحيل");
  }

  function openTransfer() {
    var others = banks.filter(function (b) { return b.id !== sel; });
    if (!others.length) { UI.toast("تحتاج حسابين بنكيين على الأقل", true); return; }
    Ledger.modal("تحويل بين البنوك", html`
      <div class="form-grid">
        <div class="field"><label>إلى حساب</label><select id="to">${others.map(function (b) { return '<option value="' + b.id + '">' + esc(b.name) + "</option>"; }).join("")}</select></div>
        <div class="field"><label>المبلغ</label><input id="amt" type="number" step="0.01" min="0.01" required></div>
        <div class="field"><label>التاريخ</label><input id="dt" type="date" value="${today}"></div>
        <div class="field full"><label>البيان</label><input id="nt"></div></div>`, async function (ov) {
      var amt = N(val("amt")), b = banks.filter(function (x) { return x.id === sel; })[0], to = banks.filter(function (x) { return x.id === val("to"); })[0];
      if (amt <= 0) throw new Error("المبلغ غير صحيح");
      if (amt > bal(b) + 0.004) throw new Error("رصيد البنك غير كافٍ");
      var grp = "bt" + Date.now().toString(36), nt = val("nt").trim();
      await DB.insert("bank_movements", { bank_id: sel, type: "withdraw", amount: amt, date: val("dt"), notes: "تحويل إلى " + to.name + (nt ? " — " + nt : ""), grp: grp });
      await DB.insert("bank_movements", { bank_id: to.id, type: "deposit", amount: amt, date: val("dt"), notes: "تحويل من " + b.name + (nt ? " — " + nt : ""), grp: grp });
      UI.toast("تم التحويل"); ov.remove(); await load();
    }, "تنفيذ التحويل");
  }

  async function load() {
    var d = await Promise.all([DB.list("banks"), DB.list("bank_movements"), DB.list("cash_registers"), DB.list("cheques")]);
    banks = d[0].slice().sort(function (a, b) { return String(a.created_at).localeCompare(String(b.created_at)); });
    moves = d[1]; registers = d[2]; cheques = d[3];
    render();
  }
  document.getElementById("b-add").onclick = function () { openBank(null); };
  document.getElementById("list").onclick = async function (e) {
    var btn = e.target.closest("[data-act]"); if (!btn) return;
    var id = btn.getAttribute("data-id"), a = btn.getAttribute("data-act"), b = banks.filter(function (x) { return x.id === id; })[0];
    if (a === "open") { sel = id; render(); }
    else if (a === "edit") openBank(b);
    else if (mine(id).length) UI.toast("لا يمكن حذف حساب له حركات", true);
    else if (confirm("حذف الحساب البنكي؟")) { await DB.remove("banks", id); UI.toast("تم الحذف"); await load(); }
  };
  await load();
})();
