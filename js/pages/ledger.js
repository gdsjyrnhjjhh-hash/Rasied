(async function () {
  var page = await UI.init("ledger");
  if (!page) return;
  var html = UI.html, esc = Ledger.esc, money = Acct.money;
  var P = Acct.presets(), S = { from: P.year[0], to: Ledger.today(), acc: "", kids: true, zero: false };
  var D = await Acct.load(), sections = [];

  page.innerHTML = html`
    <div class="stack">
      <div class="page-toolbar">
        <div><h2 style="margin:0">دفتر الأستاذ</h2>
          <p class="muted" style="margin:4px 0 0;font-size:12px">حركة حساب واحد (رئيسي أو فرعي أو تفصيلي) أو كل الحسابات بالرصيد الجاري</p></div>
        <div class="row gap"><button type="button" class="small stm-xls" id="xls">Excel</button><button type="button" class="small stm-prn" id="prn">طباعة / PDF</button></div>
      </div>
      <style>
        .rep-bar { display: flex; gap: 12px; align-items: flex-end; flex-wrap: wrap; } .rep-bar .field { margin: 0; } .rep-presets { display: flex; gap: 6px; flex-wrap: wrap; }
        .led-sec { margin-bottom: 14px; } .led-head { display: flex; justify-content: space-between; gap: 10px; flex-wrap: wrap; padding: 10px 14px; background: var(--surface-3); font-weight: 700; }
        .led-tbl td.n, .led-tbl th.n { text-align: center; white-space: nowrap; } .led-tbl tr.tot td { background: var(--primary-soft); font-weight: 800; border-top: 2px solid var(--primary); }
        .led-tbl tr.open td { background: var(--surface-2); font-weight: 700; } .led-tbl .dr { color: var(--error); } .led-tbl .cr { color: var(--success); }
      </style>
      <div class="card stack" id="ctl"></div>
      <div class="stm-sumbar" id="sum"></div>
      <div id="out"></div>
    </div>`;

  function controls() {
    document.getElementById("ctl").innerHTML = Acct.periodBar(S.from, S.to,
      '<div class="field" style="min-width:260px"><label>الحساب</label><select id="r-acc" autocomplete="off">' + Acct.accountOptions(D, S.acc, "كل الحسابات (دفتر الأستاذ العام)") + "</select></div>" +
      '<label class="row gap" style="align-items:center;font-size:13px" id="kids-l"><input type="checkbox" id="r-kids"' + (S.kids ? " checked" : "") + "> تضمين الحسابات الفرعية</label>" +
      '<label class="row gap" style="align-items:center;font-size:13px"><input type="checkbox" id="r-zero"' + (S.zero ? " checked" : "") + "> إظهار الحسابات بدون حركة</label>");
    Acct.wirePeriod(S, draw);
    document.getElementById("r-acc").onchange = function () { S.acc = this.value; draw(); };
    document.getElementById("r-kids").onchange = function () { S.kids = this.checked; draw(); };
    document.getElementById("r-zero").onchange = function () { S.zero = this.checked; draw(); };
  }
  function nameOf(id) { var a = D.accounts.filter(function (x) { return x.id === id; })[0]; return a ? a.code + " — " + a.name : ""; }
  // قسم واحد: الحساب (مع فروعه إن طُلب)
  function section(accId, include) {
    var set = {}; set[accId] = 1; if (include) { var d = Ledger.accountDescendants(D.accounts, accId); Object.keys(d).forEach(function (k) { set[k] = 1; }); }
    var multi = Object.keys(set).length > 1, opening = 0, list = [];
    D.lines.forEach(function (l) {
      if (!set[l.account_id]) return; var e = D.entries[l.entry_id]; if (!e) return;
      var date = Acct.dateOf(e), dr = Acct.N(l.debit), cr = Acct.N(l.credit);
      if (S.from && date < S.from) { opening += dr - cr; return; }
      if (S.to && date > S.to) return;
      list.push({ date: date, no: Acct.N(e.number), memo: e.memo || "", acc: l.account_id, dr: dr, cr: cr, at: String(e.created_at || "") });
    });
    list.sort(function (a, b) { return a.date < b.date ? -1 : a.date > b.date ? 1 : (a.no - b.no) || a.at.localeCompare(b.at); });
    var run = opening, td = 0, tc = 0;
    list.forEach(function (r) { run += r.dr - r.cr; r.run = run; td += r.dr; tc += r.cr; });
    return { id: accId, title: nameOf(accId) + (include && multi ? " (مع الفروع)" : ""), multi: multi, opening: opening, rows: list, td: td, tc: tc, close: run };
  }
  function bal(v) { return Math.abs(v) < 0.005 ? "0" : money(Math.abs(v)) + " " + Acct.side(v); }
  function draw() {
    var ids = [];
    if (S.acc) ids = [{ id: S.acc, inc: S.kids }];
    else D.tree.forEach(function (n) { ids.push({ id: n.a.id, inc: false, own: n.hasKids }); });   // كل حساب بحركته المباشرة (الرئيسي أيضًا إن عليه قيود مباشرة)
    document.getElementById("kids-l").style.display = S.acc ? "" : "none";
    sections = ids.map(function (x) { var sc = section(x.id, x.inc); if (x.own && !S.acc) sc.title += " — الحركة المباشرة"; return sc; }).filter(function (sc) { return S.acc || S.zero || sc.rows.length || Math.abs(sc.opening) > 0.004; });
    var out = "", specs = [];
    sections.forEach(function (sc) {
      var body = '<tr class="open"><td colspan="' + (sc.multi ? 4 : 3) + '">رصيد أول المدة</td><td class="n"></td><td class="n"></td><td class="n">' + bal(sc.opening) + "</td></tr>";
      var prow = [{ cls: "grp", cells: ["", "", "رصيد أول المدة"].concat(sc.multi ? [""] : [], ["", "", bal(sc.opening)]), raw: ["", "", "رصيد أول المدة"].concat(sc.multi ? [""] : [], ["", "", sc.opening]) }];
      sc.rows.forEach(function (r) {
        body += "<tr><td dir=\"ltr\" class=\"n\">" + esc(r.date) + "</td><td class=\"n\">" + (r.no || "") + "</td><td>" + esc(r.memo) + "</td>" + (sc.multi ? "<td>" + esc(nameOf(r.acc)) + "</td>" : "") +
          '<td class="n dr">' + (r.dr ? money(r.dr) : "") + '</td><td class="n cr">' + (r.cr ? money(r.cr) : "") + '</td><td class="n"><b>' + bal(r.run) + "</b></td></tr>";
        prow.push({ cells: [r.date, r.no || "", r.memo].concat(sc.multi ? [nameOf(r.acc)] : [], [r.dr ? money(r.dr) : "", r.cr ? money(r.cr) : "", bal(r.run)]), raw: [r.date, r.no || "", r.memo].concat(sc.multi ? [nameOf(r.acc)] : [], [r.dr || "", r.cr || "", r.run]) });
      });
      body += '<tr class="tot"><td colspan="' + (sc.multi ? 4 : 3) + '">إجمالي حركة الفترة / الرصيد الختامي</td><td class="n">' + money(sc.td) + '</td><td class="n">' + money(sc.tc) + '</td><td class="n">' + bal(sc.close) + "</td></tr>";
      prow.push({ cls: "tot", cells: ["", "", "الإجمالي / الرصيد الختامي"].concat(sc.multi ? [""] : [], [money(sc.td), money(sc.tc), bal(sc.close)]), raw: ["", "", "الإجمالي"].concat(sc.multi ? [""] : [], [sc.td, sc.tc, sc.close]) });
      out += '<div class="card table-wrap led-sec"><div class="led-head"><span>' + esc(sc.title) + '</span><span class="muted">' + sc.rows.length + ' حركة</span></div><table class="led-tbl"><thead><tr><th class="n">التاريخ</th><th class="n">رقم القيد</th><th>البيان</th>' + (sc.multi ? "<th>الحساب</th>" : "") +
        '<th class="n">مدين</th><th class="n">دائن</th><th class="n">الرصيد</th></tr></thead><tbody>' + body + "</tbody></table></div>";
      specs.push({ title: "دفتر الأستاذ — " + sc.title, sub: Acct.periodText(S.from, S.to), landscape: false,
        head: [{ t: "التاريخ", n: 1 }, { t: "رقم القيد", n: 1 }, { t: "البيان", wide: true }].concat(sc.multi ? [{ t: "الحساب" }] : [], [{ t: "مدين", n: 1 }, { t: "دائن", n: 1 }, { t: "الرصيد", n: 1 }]), rows: prow });
    });
    document.getElementById("out").innerHTML = out || '<div class="card"><div class="empty">لا توجد حركات في هذه الفترة</div></div>';
    var td = 0, tc = 0; sections.forEach(function (s) { td += s.td; tc += s.tc; });
    document.getElementById("sum").innerHTML = '<div class="stm-chip"><span>عدد الحسابات</span><b>' + sections.length + '</b></div><div class="stm-chip"><span>إجمالي المدين</span><b>' + money(td) + '</b></div><div class="stm-chip"><span>إجمالي الدائن</span><b>' + money(tc) + "</b></div>";
    draw.specs = specs;
  }
  document.getElementById("prn").onclick = function () { if (draw.specs && draw.specs.length) Acct.print(draw.specs); else UI.toast("لا توجد بيانات للطباعة", true); };
  document.getElementById("xls").onclick = function () { if (draw.specs && draw.specs.length) Acct.excel("دفتر-الأستاذ.xlsx", draw.specs); else UI.toast("لا توجد بيانات للتصدير", true); };
  controls(); draw();
})();
