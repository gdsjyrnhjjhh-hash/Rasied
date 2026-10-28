(async function () {
  var page = await UI.init("trial-balance");
  if (!page) return;
  var html = UI.html, esc = Ledger.esc, money = Acct.money;
  var P = Acct.presets(), S = { from: P.year[0], to: Ledger.today(), level: "0", root: "", hideZero: true };
  var D = await Acct.load(), view = null;

  page.innerHTML = html`
    <div class="stack">
      <div class="page-toolbar">
        <div><h2 style="margin:0">ميزان المراجعة</h2>
          <p class="muted" style="margin:4px 0 0;font-size:12px">رصيد أول المدة · حركة الفترة · رصيد آخر المدة — للحسابات الرئيسية أو الفرعية أو التفصيلية</p></div>
        <div class="row gap"><button type="button" class="small stm-xls" id="xls">Excel</button><button type="button" class="small stm-prn" id="prn">طباعة / PDF</button></div>
      </div>
      <style>
        .rep-bar { display: flex; gap: 12px; align-items: flex-end; flex-wrap: wrap; }
        .rep-bar .field { margin: 0; } .rep-presets { display: flex; gap: 6px; flex-wrap: wrap; }
        .rep-tbl td.n, .rep-tbl th.n { text-align: center; white-space: nowrap; }
        .rep-tbl tr.grp td { background: var(--surface-3); font-weight: 700; } .rep-tbl tr.tot td { background: var(--primary-soft); font-weight: 800; border-top: 2px solid var(--primary); }
        .rep-tbl .dr { color: var(--error); } .rep-tbl .cr { color: var(--success); }
      </style>
      <div class="card stack" id="ctl"></div>
      <div class="stm-sumbar" id="sum"></div>
      <div class="card table-wrap" id="out"></div>
    </div>`;

  function controls() {
    document.getElementById("ctl").innerHTML = Acct.periodBar(S.from, S.to,
      '<div class="field"><label>المستوى</label><select id="r-level" autocomplete="off">' + Acct.levelOptions(D, S.level) + "</select></div>" +
      '<div class="field"><label>الحساب / المجموعة</label><select id="r-root" autocomplete="off">' + Acct.accountOptions(D, S.root, "كل الحسابات") + "</select></div>" +
      '<label class="row gap" style="align-items:center;font-size:13px"><input type="checkbox" id="r-zero"' + (S.hideZero ? " checked" : "") + "> إخفاء الحسابات الصفرية</label>");
    Acct.wirePeriod(S, draw);
    document.getElementById("r-level").onchange = function () { S.level = this.value; draw(); };
    document.getElementById("r-root").onchange = function () { S.root = this.value; draw(); };
    document.getElementById("r-zero").onchange = function () { S.hideZero = this.checked; draw(); };
  }
  function split(v) { return [v > 0.004 ? v : 0, v < -0.004 ? -v : 0]; }
  function draw() {
    var B = Acct.balances(D, S.from, S.to), L = Acct.lvl(S.level), opt = { level: L.level, leaves: L.leaves, root: S.root };
    var rows = Acct.rows(D, B, opt).filter(function (r) { return !S.hideZero || r.v.open || r.v.debit || r.v.credit; });
    // الإجماليات من الأرصدة الذاتية (بلا ازدواج بين الرئيسي والفرعي)
    var sub = S.root ? Ledger.accountDescendants(D.accounts, S.root) : null, T = { od: 0, oc: 0, md: 0, mc: 0, cd: 0, cc: 0 };
    D.accounts.forEach(function (a) {
      if (sub && !sub[a.id] && a.id !== S.root) return;
      var o = B.own[a.id], os = split(o.open), cs = split(o.open + o.debit - o.credit);
      T.od += os[0]; T.oc += os[1]; T.md += o.debit; T.mc += o.credit; T.cd += cs[0]; T.cc += cs[1];
    });
    var balanced = Math.abs(T.cd - T.cc) < 0.01 && Math.abs(T.od - T.oc) < 0.01 && Math.abs(T.md - T.mc) < 0.01;
    var body = [], printRows = [];
    rows.forEach(function (r) {
      var os = split(r.v.open), cs = split(r.v.open + r.v.debit - r.v.credit), pad = r.level * 20 + 8;
      body.push('<tr class="' + (r.group ? "grp" : "") + '"><td dir="ltr">' + esc(r.a.code) + '</td><td style="padding-inline-start:' + pad + 'px">' + esc(r.a.name) + (r.group ? ' <span class="badge">مجموع</span>' : "") + "</td>" +
        [os[0], os[1], r.v.debit, r.v.credit, cs[0], cs[1]].map(function (x, i) { return '<td class="n ' + (i % 2 ? "cr" : "dr") + '">' + (x ? money(x) : "") + "</td>"; }).join("") + "</tr>");
      printRows.push({ cls: r.group ? "grp" : "", cells: [r.a.code, new Array(r.level + 1).join("   ") + r.a.name, os[0] ? money(os[0]) : "", os[1] ? money(os[1]) : "", r.v.debit ? money(r.v.debit) : "", r.v.credit ? money(r.v.credit) : "", cs[0] ? money(cs[0]) : "", cs[1] ? money(cs[1]) : ""],
        raw: [r.a.code, r.a.name, os[0], os[1], r.v.debit, r.v.credit, cs[0], cs[1]] });
    });
    var tcells = [T.od, T.oc, T.md, T.mc, T.cd, T.cc];
    body.push('<tr class="tot"><td colspan="2">الإجمالي</td>' + tcells.map(function (x) { return '<td class="n">' + money(x) + "</td>"; }).join("") + "</tr>");
    printRows.push({ cls: "tot", cells: ["", "الإجمالي"].concat(tcells.map(money)), raw: ["", "الإجمالي"].concat(tcells) });
    document.getElementById("sum").innerHTML = '<div class="stm-chip"><span>عدد الحسابات المعروضة</span><b>' + rows.length + '</b></div><div class="stm-chip ' + (balanced ? "" : "err") + '"><span>' + (balanced ? "الميزان متوازن ✓" : "الميزان غير متوازن!") + "</span><b>" + money(T.cd - T.cc) + "</b></div>";
    document.getElementById("out").innerHTML = rows.length ? '<table class="rep-tbl"><thead><tr><th>الكود</th><th>الحساب</th><th class="n">رصيد أول المدة مدين</th><th class="n">رصيد أول المدة دائن</th><th class="n">حركة مدين</th><th class="n">حركة دائن</th><th class="n">رصيد آخر المدة مدين</th><th class="n">رصيد آخر المدة دائن</th></tr></thead><tbody>' + body.join("") + "</tbody></table>" : '<div class="empty">لا توجد حسابات بحركة في هذه الفترة</div>';
    var lvlTxt = L.leaves ? "الحسابات التفصيلية" : (L.level ? "حتى المستوى " + L.level : "كل المستويات");
    view = { title: "ميزان المراجعة", sub: Acct.periodText(S.from, S.to) + " — " + lvlTxt + (S.root ? " — " + (D.accounts.filter(function (a) { return a.id === S.root; })[0] || {}).name : ""), landscape: true,
      head: [{ t: "الكود" }, { t: "الحساب", wide: true }, { t: "أول المدة مدين", n: 1 }, { t: "أول المدة دائن", n: 1 }, { t: "حركة مدين", n: 1 }, { t: "حركة دائن", n: 1 }, { t: "آخر المدة مدين", n: 1 }, { t: "آخر المدة دائن", n: 1 }],
      rows: printRows, notes: [balanced ? "الميزان متوازن." : "تنبيه: الميزان غير متوازن — راجع القيود."] };
  }
  document.getElementById("prn").onclick = function () { if (view) Acct.print(view); };
  document.getElementById("xls").onclick = function () { if (view) Acct.excel("ميزان-المراجعة.xlsx", view); };
  controls(); draw();
})();
