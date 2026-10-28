/* مكتبة التقارير المحاسبية المشتركة (ميزان المراجعة، دفتر الأستاذ، القوائم المالية، تقرير الضريبة).
   - الأرصدة من journal_lines مع تاريخ القيد (journal_entries.date)
   - الإشارة: الرصيد المُوقَّع = مدين − دائن (موجب = مدين)
   - المستويات: 1 = رئيسية، 2 = فرعية، 3+ = تفصيلية (حسب شجرة accounts.parent) */
(function () {
  var N = function (v) { return Number(v) || 0; };
  var r2 = function (v) { return Math.round(N(v) * 100) / 100; };
  var esc = function (x) { return Ledger.esc(x); };
  var TYPE_AR = { asset: "أصول", liability: "خصوم", equity: "حقوق ملكية", revenue: "إيرادات", expense: "مصروفات" };
  var DEBIT_NATURE = { asset: 1, expense: 1 };

  async function load() {
    DB.refresh();
    var d = await Promise.all([DB.list("accounts"), DB.list("journal_entries"), DB.list("journal_lines")]);
    var entries = {}; d[1].forEach(function (e) { entries[e.id] = e; });
    return { accounts: d[0], entries: entries, lines: d[2], tree: Ledger.accountTree(d[0]) };
  }
  function dateOf(e) { return (e && (e.date || String(e.created_at || "").slice(0, 10))) || ""; }

  // أرصدة كل حساب: ذاتي ومُجمَّع (مع الفروع). from فارغ = من البداية، to فارغ = بلا حد أعلى
  function balances(D, from, to) {
    var own = {}, rolled = {}, kids = {};
    D.accounts.forEach(function (a) { own[a.id] = { open: 0, debit: 0, credit: 0 }; });
    D.lines.forEach(function (l) {
      var o = own[l.account_id], e = D.entries[l.entry_id]; if (!o || !e) return;
      var date = dateOf(e), dr = N(l.debit), cr = N(l.credit);
      if (from && date < from) o.open += dr - cr;
      else if (!to || date <= to) { o.debit += dr; o.credit += cr; }
    });
    D.accounts.forEach(function (a) { if (a.parent && own[a.parent] && a.parent !== a.id) (kids[a.parent] = kids[a.parent] || []).push(a.id); });
    function roll(id, seen) {
      if (rolled[id]) return rolled[id];
      var o = own[id], r = { open: o.open, debit: o.debit, credit: o.credit };
      if (seen[id]) return r; seen[id] = 1;
      (kids[id] || []).forEach(function (c) { var s = roll(c, seen); r.open += s.open; r.debit += s.debit; r.credit += s.credit; });
      return (rolled[id] = r);
    }
    D.accounts.forEach(function (a) { roll(a.id, {}); });
    return { own: own, rolled: rolled };
  }
  function maxLevel(D) { var m = 1; D.tree.forEach(function (n) { if (n.level + 1 > m) m = n.level + 1; }); return m; }
  function inSubtree(D, root) { return root ? Ledger.accountDescendants(D.accounts, root) : null; }

  /* صفوف العرض: opts = {level: 0(الكل)|n, leaves: bool, root: id, types:[...]}
     كل صف: {a, level, group (له فروع مخفية أو ظاهرة), v:{open,debit,credit}} حيث v مُجمَّع للحسابات الرئيسية */
  function rows(D, B, opts) {
    opts = opts || {};
    var sub = inSubtree(D, opts.root), out = [], rootLevel = 0;
    if (opts.root) D.tree.forEach(function (n) { if (n.a.id === opts.root) rootLevel = n.level; });
    D.tree.forEach(function (n) {
      var a = n.a;
      if (sub && a.id !== opts.root && !sub[a.id]) return;
      if (opts.types && opts.types.indexOf(a.type) === -1) return;
      if (opts.leaves) { if (n.hasKids) return; }
      else if (opts.level && (n.level - rootLevel + 1) > opts.level) return;
      out.push({ a: a, level: n.level - rootLevel, group: n.hasKids, v: opts.leaves ? B.own[a.id] : B.rolled[a.id] });
    });
    return out;
  }
  // إجمالي الأرصدة الذاتية داخل النطاق (بلا ازدواج) — يطابق مجموع الصفوف الورقية
  function totals(D, B, opts) {
    opts = opts || {}; var sub = inSubtree(D, opts.root), t = { open: 0, debit: 0, credit: 0 };
    D.accounts.forEach(function (a) {
      if (sub && !sub[a.id] && a.id !== opts.root) return;
      if (opts.types && opts.types.indexOf(a.type) === -1) return;
      var o = B.own[a.id]; t.open += o.open; t.debit += o.debit; t.credit += o.credit;
    });
    return t;
  }
  function nature(type, signed) { return DEBIT_NATURE[type] ? signed : -signed; }       // قيمة بطبيعة الحساب (موجبة عادةً)
  function side(signed) { return Math.abs(signed) < 0.005 ? "" : (signed > 0 ? "مدين" : "دائن"); }
  function money(v) { return UI.money(v); }

  /* ---------- أدوات واجهة مشتركة ---------- */
  function iso(d) { return d.toISOString().slice(0, 10); }
  function presets() {
    var t = new Date(), y = t.getFullYear(), m = t.getMonth();
    var q = Math.floor(m / 3) * 3;
    return {
      month: [iso(new Date(y, m, 1)), iso(new Date(y, m + 1, 0))], lastmonth: [iso(new Date(y, m - 1, 1)), iso(new Date(y, m, 0))],
      quarter: [iso(new Date(y, q, 1)), iso(new Date(y, q + 3, 0))], year: [iso(new Date(y, 0, 1)), iso(new Date(y, 11, 31))], all: ["", ""],
    };
  }
  function periodBar(from, to, extra) {
    return '<div class="rep-bar"><div class="field"><label>من تاريخ</label><input type="date" id="r-from" value="' + esc(from) + '"></div>' +
      '<div class="field"><label>إلى تاريخ</label><input type="date" id="r-to" value="' + esc(to) + '"></div>' +
      '<div class="rep-presets"><button type="button" class="small" data-p="month">هذا الشهر</button><button type="button" class="small" data-p="lastmonth">الشهر الماضي</button>' +
      '<button type="button" class="small" data-p="quarter">هذا الربع</button><button type="button" class="small" data-p="year">هذه السنة</button><button type="button" class="small" data-p="all">كل الفترة</button></div>' + (extra || "") + "</div>";
  }
  function wirePeriod(S, onChange) {
    var f = document.getElementById("r-from"), t = document.getElementById("r-to"), P = presets();
    f.onchange = function () { S.from = f.value; onChange(); };
    t.onchange = function () { S.to = t.value; onChange(); };
    Array.prototype.forEach.call(document.querySelectorAll(".rep-presets [data-p]"), function (b) {
      b.onclick = function () { var p = P[b.getAttribute("data-p")]; S.from = p[0]; S.to = p[1]; f.value = S.from; t.value = S.to; onChange(); };
    });
  }
  function levelOptions(D, sel) {
    var m = maxLevel(D), h = '<option value="1"' + (sel === "1" ? " selected" : "") + ">الحسابات الرئيسية فقط (المستوى 1)</option>";
    for (var i = 2; i <= m; i++) h += '<option value="' + i + '"' + (sel === String(i) ? " selected" : "") + ">حتى المستوى " + i + (i === 2 ? " (فرعية)" : "") + "</option>";
    h += '<option value="0"' + (sel === "0" ? " selected" : "") + ">كل المستويات (تفصيلي مع المجاميع)</option>";
    h += '<option value="leaves"' + (sel === "leaves" ? " selected" : "") + ">الحسابات التفصيلية فقط (بلا مجاميع)</option>";
    return h;
  }
  function accountOptions(D, sel, first) {
    var h = first != null ? '<option value="">' + esc(first) + "</option>" : "";
    D.tree.forEach(function (n) {
      h += '<option value="' + esc(n.a.id) + '"' + (n.a.id === sel ? " selected" : "") + ">" + new Array(n.level + 1).join("\u00A0\u00A0\u00A0") + esc(n.a.code) + " — " + esc(n.a.name) + (n.hasKids ? " (رئيسي)" : "") + "</option>";
    });
    return h;
  }
  function lvl(sel) { return sel === "leaves" ? { leaves: true, level: 0 } : { leaves: false, level: Number(sel) || 0 }; }
  function periodText(from, to) { return (from || to) ? "من " + (from || "البداية") + " إلى " + (to || "اليوم") : "كل الفترة"; }
  async function company() { try { var c = await Promise.resolve(DB.getCompany()); return c || {}; } catch (e) { return {}; } }

  /* ---------- طباعة PDF / Excel عامة ----------
     spec = {title, sub, head:[{t, n:true(رقم)}], rows:[{cells:[...], cls:"grp|tot|sec|"}], landscape, notes[]} */
  var CSS = "*{box-sizing:border-box;-webkit-print-color-adjust:exact;print-color-adjust:exact}body{margin:0;font-family:Cairo,Tahoma,Arial,sans-serif;color:#0e1630;font-size:9.5pt;line-height:1.5}" +
    ".head{display:flex;justify-content:space-between;align-items:flex-start;border-bottom:2.5px solid #182763;padding-bottom:8px;margin-bottom:12px}.head h1{margin:0;font-size:16pt;color:#182763}.head .sub{font-size:10pt;color:#566382;font-weight:600}" +
    ".head .meta{text-align:left;font-size:8.5pt;color:#566382;line-height:1.7}.head .meta b{color:#0e1630}" +
    "table{width:100%;border-collapse:collapse;font-size:9pt}thead{display:table-header-group}th{background:#182763;color:#fff;font-weight:700;padding:6px 7px;border:1px solid #182763;text-align:right}th.n,td.n{text-align:center;white-space:nowrap}" +
    "td{padding:4.5px 7px;border:1px solid #d3daea;vertical-align:top}tr{page-break-inside:avoid}tbody tr:nth-child(even){background:#f6f8fd}tr.grp td{background:#e9eefb;font-weight:700}tr.sec td{background:#182763;color:#fff;font-weight:800}" +
    "tr.tot td{background:#dfe6fa;font-weight:800;border-top:2px solid #182763}.note{margin-top:8px;font-size:8pt;color:#667391}.pg{page-break-before:always}" +
    ".actions{margin-top:18px;text-align:center}.actions button{font:inherit;padding:9px 26px;border:0;border-radius:9px;background:#2a49d6;color:#fff;font-weight:600;cursor:pointer}@media print{.actions{display:none}}";
  function docHtml(specs, co) {
    specs = [].concat(specs);
    var now = new Date(), printed = iso(now) + " " + String(now.getHours()).padStart(2, "0") + ":" + String(now.getMinutes()).padStart(2, "0");
    var cur = UI.currency();
    var body = specs.map(function (sp, i) {
      return '<section class="' + (i ? "pg" : "") + '"><div class="head"><div><h1>' + esc(co.name || "الشركة") + '</h1><div class="sub">' + esc(sp.title) + '</div></div><div class="meta">' + esc(sp.sub || "") +
        '<br>تاريخ الطباعة: <b>' + printed + "</b>" + (cur ? "<br>العملة: <b>" + esc(cur) + "</b>" : "") + "</div></div>" +
        "<table><thead><tr>" + sp.head.map(function (h) { return "<th" + (h.n ? ' class="n"' : "") + (h.w ? ' style="width:' + h.w + '"' : "") + ">" + esc(h.t) + "</th>"; }).join("") + "</tr></thead><tbody>" +
        sp.rows.map(function (r) {
          if (r.sec) return '<tr class="sec"><td colspan="' + sp.head.length + '">' + esc(r.sec) + "</td></tr>";
          return '<tr class="' + (r.cls || "") + '">' + r.cells.map(function (c, j) { return "<td" + (sp.head[j] && sp.head[j].n ? ' class="n"' : "") + ">" + esc(c) + "</td>"; }).join("") + "</tr>";
        }).join("") + "</tbody></table>" + (sp.notes || []).map(function (n) { return '<div class="note">' + esc(n) + "</div>"; }).join("") + "</section>";
    }).join("");
    var land = specs[0].landscape ? "A4 landscape" : "A4 portrait";
    return '<!doctype html><html lang="ar" dir="rtl"><head><meta charset="utf-8"><title>' + esc(specs[0].title) + "</title><style>@page{size:" + land + ";margin:12mm}" + CSS + "</style></head><body>" + body + '<div class="actions"><button onclick="print()">طباعة</button></div></body></html>';
  }
  async function print(specs) {
    var co = await company(), w = window.open("", "_blank", "width=1000,height=760");
    if (!w) { UI.toast("اسمح بالنوافذ المنبثقة للطباعة", true); return; }
    w.document.write(docHtml(specs, co)); w.document.close();
    setTimeout(function () { try { w.focus(); w.print(); } catch (e) {} }, 500);
  }
  async function excel(filename, specs) {
    var co = await company(); specs = [].concat(specs); var cur = UI.currency();
    var out = [[{ v: (co.name || "") + " — " + specs[0].title, s: "title" }], [{ v: (specs[0].sub || "") + (cur ? " — العملة: " + cur : ""), s: "boldtext" }]];
    specs.forEach(function (sp, i) {
      if (i) out.push([], [{ v: sp.title + (sp.sub ? " — " + sp.sub : ""), s: "boldtext" }]);
      out.push(sp.head.map(function (h) { return { v: h.t, s: "head" }; }));
      sp.rows.forEach(function (r) {
        if (r.sec) { out.push([{ v: r.sec, s: "boldtext" }]); return; }
        var bold = r.cls === "tot" || r.cls === "grp";
        out.push(r.cells.map(function (c, j) {
          var isNum = sp.head[j] && sp.head[j].n && r.raw && typeof r.raw[j] === "number";
          if (isNum) return { v: r.raw[j], s: bold ? "boldnum" : "num" };
          return { v: c == null ? "" : String(c), s: bold ? "boldtext" : "text" };
        }));
      });
    });
    var cols = specs[0].head.map(function (h, j) { return j === 1 || h.wide ? 40 : 16; });
    Xlsx.download(filename, { sheet: specs[0].title.slice(0, 30), cols: cols, merges: ["A1:" + String.fromCharCode(64 + Math.min(specs[0].head.length, 26)) + "1"], rows: out });
  }

  window.Acct = { load: load, balances: balances, rows: rows, totals: totals, maxLevel: maxLevel, nature: nature, side: side, money: money, r2: r2, N: N, dateOf: dateOf,
    periodBar: periodBar, wirePeriod: wirePeriod, levelOptions: levelOptions, accountOptions: accountOptions, lvl: lvl, periodText: periodText, presets: presets,
    print: print, excel: excel, docHtml: docHtml, company: company, TYPE_AR: TYPE_AR, esc: esc, inSubtree: inSubtree };
})();
