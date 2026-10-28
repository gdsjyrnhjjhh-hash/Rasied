(async function () {
  var page = await UI.init("financials");
  if (!page) return;
  var html = UI.html, esc = Ledger.esc, money = Acct.money;
  var P = Acct.presets(), S = { from: P.year[0], to: Ledger.today(), level: "0", stmt: "both", hideZero: true };
  var D = await Acct.load(), view = [];

  page.innerHTML = html`
    <div class="stack">
      <div class="page-toolbar">
        <div><h2 style="margin:0">القوائم المالية</h2>
          <p class="muted" style="margin:4px 0 0;font-size:12px">قائمة الدخل (أرباح وخسائر) والمركز المالي (الميزانية) — بحسابات رئيسية أو فرعية أو تفصيلية</p></div>
        <div class="row gap"><button type="button" class="small stm-xls" id="xls">Excel</button><button type="button" class="small stm-prn" id="prn">طباعة / PDF</button></div>
      </div>
      <style>
        .rep-bar { display: flex; gap: 12px; align-items: flex-end; flex-wrap: wrap; } .rep-bar .field { margin: 0; } .rep-presets { display: flex; gap: 6px; flex-wrap: wrap; }
        .fs-tbl td.n, .fs-tbl th.n { text-align: center; white-space: nowrap; width: 150px; } .fs-tbl tr.sec td { background: var(--primary); color: #fff; font-weight: 800; }
        .fs-tbl tr.grp td { background: var(--surface-3); font-weight: 700; } .fs-tbl tr.tot td { background: var(--primary-soft); font-weight: 800; border-top: 2px solid var(--primary); }
        .fs-tbl .neg { color: var(--error); } .fs-seg { display: inline-flex; gap: 6px; }
        .fs-seg button { min-height: 30px; padding: 3px 14px; border-radius: 999px; font-size: 12.5px; font-weight: 600; background: var(--surface); border: 1px solid var(--border); color: var(--text-2); box-shadow: none; }
        .fs-seg button.on { background: var(--primary); border-color: var(--primary); color: #fff; }
      </style>
      <div class="card stack" id="ctl"></div>
      <div class="stm-sumbar" id="sum"></div>
      <div id="out"></div>
    </div>`;

  function controls() {
    document.getElementById("ctl").innerHTML = Acct.periodBar(S.from, S.to,
      '<div class="field"><label>المستوى</label><select id="r-level" autocomplete="off">' + Acct.levelOptions(D, S.level) + "</select></div>" +
      '<div class="field"><label>القائمة</label><div class="fs-seg" id="r-stmt"><button type="button" data-v="both">الاثنتان</button><button type="button" data-v="is">قائمة الدخل</button><button type="button" data-v="bs">المركز المالي</button></div></div>' +
      '<label class="row gap" style="align-items:center;font-size:13px"><input type="checkbox" id="r-zero"' + (S.hideZero ? " checked" : "") + "> إخفاء الصفري</label>");
    Acct.wirePeriod(S, draw);
    document.getElementById("r-level").onchange = function () { S.level = this.value; draw(); };
    document.getElementById("r-zero").onchange = function () { S.hideZero = this.checked; draw(); };
    document.getElementById("r-stmt").onclick = function (e) { var b = e.target.closest("button"); if (b) { S.stmt = b.getAttribute("data-v"); draw(); } };
  }
  // قيمة الصف بطبيعة الحساب: دخل = حركة الفترة، مركز مالي = رصيد تراكمي حتى تاريخ النهاية
  function amount(r, mode) {
    var v = r.v, signed = mode === "is" ? (v.debit - v.credit) : (v.open + v.debit - v.credit);
    return Acct.nature(r.a.type, signed);
  }
  function isCost(a) { return a.id === "a9" || String(a.code) === "5100" || /تكلفة (البضاعة|المبيعات)/.test(a.name || ""); }
  function fmt(v) { return v < -0.004 ? "(" + money(-v) + ")" : money(v); }

  function build(mode, B, L) {
    var opt = { level: L.level, leaves: L.leaves };
    function group(types, filterFn) {
      var rows = Acct.rows(D, B, Object.assign({ types: types }, opt)).filter(function (r) { return !filterFn || filterFn(r.a); });
      rows = rows.filter(function (r) { return !S.hideZero || Math.abs(amount(r, mode)) > 0.004; });
      // المجموع من الأرصدة الذاتية (بلا ازدواج)
      var total = 0;
      D.accounts.forEach(function (a) { if (types.indexOf(a.type) !== -1 && (!filterFn || filterFn(a))) { var o = B.own[a.id]; total += Acct.nature(a.type, mode === "is" ? o.debit - o.credit : o.open + o.debit - o.credit); } });
      return { rows: rows, total: total };
    }
    return group;
  }
  function lines(sec, g, mode, out, print) {
    out.push('<tr class="sec"><td colspan="2">' + esc(sec) + "</td></tr>"); print.push({ sec: sec });
    g.rows.forEach(function (r) {
      var v = amount(r, mode), pad = r.level * 20 + 8;
      out.push('<tr class="' + (r.group ? "grp" : "") + '"><td style="padding-inline-start:' + pad + 'px"><span class="muted" dir="ltr">' + esc(r.a.code) + "</span> " + esc(r.a.name) + "</td><td class=\"n " + (v < 0 ? "neg" : "") + '">' + fmt(v) + "</td></tr>");
      print.push({ cls: r.group ? "grp" : "", cells: [new Array(r.level + 1).join("   ") + r.a.code + " " + r.a.name, fmt(v)], raw: [r.a.name, v] });
    });
    out.push('<tr class="tot"><td>إجمالي ' + esc(sec) + '</td><td class="n">' + fmt(g.total) + "</td></tr>"); print.push({ cls: "tot", cells: ["إجمالي " + sec, fmt(g.total)], raw: ["إجمالي " + sec, g.total] });
  }
  function drawIs(L) {
    var B = Acct.balances(D, S.from, S.to), G = build("is", B, L), out = [], pr = [];
    var rev = G(["revenue"]), cost = G(["expense"], isCost), exp = G(["expense"], function (a) { return !isCost(a); });
    lines("الإيرادات", rev, "is", out, pr);
    lines("تكلفة المبيعات", cost, "is", out, pr);
    var gross = rev.total - cost.total;
    out.push('<tr class="tot"><td>مجمل الربح</td><td class="n">' + fmt(gross) + "</td></tr>"); pr.push({ cls: "tot", cells: ["مجمل الربح", fmt(gross)], raw: ["مجمل الربح", gross] });
    lines("المصروفات", exp, "is", out, pr);
    var net = gross - exp.total;
    out.push('<tr class="tot"><td>' + (net >= 0 ? "صافي الربح" : "صافي الخسارة") + '</td><td class="n ' + (net < 0 ? "neg" : "") + '">' + fmt(net) + "</td></tr>"); pr.push({ cls: "tot", cells: [net >= 0 ? "صافي الربح" : "صافي الخسارة", fmt(net)], raw: ["صافي", net] });
    return { html: '<div class="card table-wrap"><div class="led-head" style="padding:10px 14px;font-weight:800">قائمة الدخل — ' + esc(Acct.periodText(S.from, S.to)) + '</div><table class="fs-tbl"><tbody>' + out.join("") + "</tbody></table></div>",
      spec: { title: "قائمة الدخل", sub: Acct.periodText(S.from, S.to), head: [{ t: "البند", wide: true }, { t: "المبلغ", n: 1 }], rows: pr }, net: net, rev: rev.total };
  }
  function drawBs(L) {
    var B = Acct.balances(D, "", S.to), G = build("bs", B, L), out = [], pr = [];
    var as = G(["asset"]), li = G(["liability"]), eq = G(["equity"]);
    // أرباح/خسائر متراكمة حتى تاريخ النهاية (لا توجد قيود إقفال في النظام)
    var rv = G(["revenue"]).total, ex = G(["expense"]).total, profit = rv - ex;
    lines("الأصول", as, "bs", out, pr);
    lines("الخصوم", li, "bs", out, pr);
    lines("حقوق الملكية", eq, "bs", out, pr);
    out.push("<tr><td>أرباح / (خسائر) متراكمة حتى " + esc(S.to || "اليوم") + '</td><td class="n ' + (profit < 0 ? "neg" : "") + '">' + fmt(profit) + "</td></tr>");
    pr.push({ cells: ["أرباح / (خسائر) متراكمة", fmt(profit)], raw: ["أرباح متراكمة", profit] });
    var right = li.total + eq.total + profit, diff = as.total - right;
    out.push('<tr class="tot"><td>إجمالي الخصوم وحقوق الملكية والأرباح</td><td class="n">' + fmt(right) + "</td></tr>"); pr.push({ cls: "tot", cells: ["إجمالي الخصوم وحقوق الملكية والأرباح", fmt(right)], raw: ["إجمالي الخصوم وحقوق الملكية", right] });
    out.push('<tr class="' + (Math.abs(diff) < 0.01 ? "" : "grp") + '"><td>' + (Math.abs(diff) < 0.01 ? "الميزانية متوازنة ✓ (الأصول = الخصوم + حقوق الملكية + الأرباح)" : "فرق الميزانية (الأصول − الخصوم − حقوق الملكية − الأرباح)") + '</td><td class="n">' + (Math.abs(diff) < 0.01 ? "" : fmt(diff)) + "</td></tr>");
    return { html: '<div class="card table-wrap"><div class="led-head" style="padding:10px 14px;font-weight:800">المركز المالي (الميزانية) — حتى ' + esc(S.to || "اليوم") + '</div><table class="fs-tbl"><tbody>' + out.join("") + "</tbody></table></div>",
      spec: { title: "المركز المالي (الميزانية)", sub: "حتى " + (S.to || "اليوم"), head: [{ t: "البند", wide: true }, { t: "المبلغ", n: 1 }], rows: pr, notes: [Math.abs(diff) < 0.01 ? "الميزانية متوازنة." : "تنبيه: فرق في الميزانية " + fmt(diff)] }, diff: diff, assets: as.total, profit: profit };
  }
  function draw() {
    Array.prototype.forEach.call(document.querySelectorAll("#r-stmt button"), function (b) { b.classList.toggle("on", b.getAttribute("data-v") === S.stmt); });
    var L = Acct.lvl(S.level), html = "", specs = [], chips = "";
    if (S.stmt !== "bs") { var a = drawIs(L); html += a.html; specs.push(a.spec); chips += '<div class="stm-chip"><span>الإيرادات</span><b>' + money(a.rev) + '</b></div><div class="stm-chip ' + (a.net < 0 ? "err" : "") + '"><span>' + (a.net >= 0 ? "صافي الربح" : "صافي الخسارة") + "</span><b>" + fmt(a.net) + "</b></div>"; }
    if (S.stmt !== "is") { var b = drawBs(L); html += '<div style="height:12px"></div>' + b.html; specs.push(b.spec); chips += '<div class="stm-chip"><span>إجمالي الأصول</span><b>' + money(b.assets) + '</b></div><div class="stm-chip ' + (Math.abs(b.diff) < 0.01 ? "" : "err") + '"><span>' + (Math.abs(b.diff) < 0.01 ? "الميزانية متوازنة ✓" : "فرق الميزانية") + "</span><b>" + (Math.abs(b.diff) < 0.01 ? "" : fmt(b.diff)) + "</b></div>"; }
    document.getElementById("out").innerHTML = html; document.getElementById("sum").innerHTML = chips; view = specs;
  }
  document.getElementById("prn").onclick = function () { if (view.length) Acct.print(view); };
  document.getElementById("xls").onclick = function () { if (view.length) Acct.excel("القوائم-المالية.xlsx", view); };
  controls(); draw();
})();
