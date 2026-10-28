(async function () {
  var page = await UI.init("vat-report");
  if (!page) return;
  var html = UI.html, esc = Ledger.esc, money = Acct.money, N = Acct.N;
  var P = Acct.presets(), S = { from: P.month[0], to: P.month[1], mode: "summary" };
  var d = await Promise.all([DB.list("sales"), DB.list("purchases"), DB.list("sale_returns"), DB.list("purchase_returns"), DB.list("customers"), DB.list("suppliers"), Acct.load()]);
  var sales = d[0], purchases = d[1], sret = d[2], pret = d[3], D = d[6], view = null;
  var names = {}; d[4].concat(d[5]).forEach(function (p) { names[p.id] = p.name; });

  page.innerHTML = html`
    <div class="stack">
      <div class="page-toolbar">
        <div><h2 style="margin:0">تقرير الضريبة</h2>
          <p class="muted" style="margin:4px 0 0;font-size:12px">ضريبة القيمة المضافة: مخرجات المبيعات − مدخلات المشتريات = الصافي المستحق للفترة</p></div>
        <div class="row gap"><button type="button" class="small stm-xls" id="xls">Excel</button><button type="button" class="small stm-prn" id="prn">طباعة / PDF</button></div>
      </div>
      <style>
        .rep-bar { display: flex; gap: 12px; align-items: flex-end; flex-wrap: wrap; } .rep-bar .field { margin: 0; } .rep-presets { display: flex; gap: 6px; flex-wrap: wrap; }
        .vat-tbl td.n, .vat-tbl th.n { text-align: center; white-space: nowrap; } .vat-tbl tr.sec td { background: var(--primary); color: #fff; font-weight: 800; }
        .vat-tbl tr.grp td { background: var(--surface-3); font-weight: 700; } .vat-tbl tr.tot td { background: var(--primary-soft); font-weight: 800; border-top: 2px solid var(--primary); }
        .fs-seg { display: inline-flex; gap: 6px; } .fs-seg button { min-height: 30px; padding: 3px 14px; border-radius: 999px; font-size: 12.5px; font-weight: 600; background: var(--surface); border: 1px solid var(--border); color: var(--text-2); box-shadow: none; }
        .fs-seg button.on { background: var(--primary); border-color: var(--primary); color: #fff; }
      </style>
      <div class="card stack" id="ctl"></div>
      <div class="stm-sumbar" id="sum"></div>
      <div class="card table-wrap" id="out"></div>
      <p class="muted" style="font-size:12px;margin:0" id="note"></p>
    </div>`;

  function controls() {
    document.getElementById("ctl").innerHTML = Acct.periodBar(S.from, S.to,
      '<div class="field"><label>العرض</label><div class="fs-seg" id="r-mode"><button type="button" data-v="summary">ملخص حسب النسبة</button><button type="button" data-v="detail">تفصيلي بالفواتير</button></div></div>');
    Acct.wirePeriod(S, draw);
    document.getElementById("r-mode").onclick = function (e) { var b = e.target.closest("button"); if (b) { S.mode = b.getAttribute("data-v"); draw(); } };
  }
  function inRange(x) { var dt = x.date || String(x.created_at || "").slice(0, 10); return x.status !== "void" && (!S.from || dt >= S.from) && (!S.to || dt <= S.to); }
  function base(x) { return N(x.subtotal) + N(x.delivery); }                          // الوعاء الضريبي = بعد الخصم + الناولون (كما في قيد البيع)
  function party(x) { return names[x.customer_id || x.supplier_id] || "—"; }

  function draw() {
    Array.prototype.forEach.call(document.querySelectorAll("#r-mode button"), function (b) { b.classList.toggle("on", b.getAttribute("data-v") === S.mode); });
    var sets = [
      { key: "sales", title: "ضريبة المخرجات — فواتير البيع", rows: sales.filter(inRange), sign: 1, side: "out" },
      { key: "sret", title: "مردودات البيع (تخصم من المخرجات)", rows: sret.filter(inRange), sign: -1, side: "out" },
      { key: "purchases", title: "ضريبة المدخلات — فواتير الشراء", rows: purchases.filter(inRange), sign: 1, side: "in" },
      { key: "pret", title: "مردودات الشراء (تخصم من المدخلات)", rows: pret.filter(inRange), sign: -1, side: "in" },
    ];
    var out = 0, inn = 0, outBase = 0, inBase = 0, body = [], pr = [];
    var head;
    sets.forEach(function (st) {
      var tax = 0, bs = 0;
      st.rows.forEach(function (r) { tax += N(r.vat_amount); bs += base(r); });
      if (st.side === "out") { out += st.sign * tax; outBase += st.sign * bs; } else { inn += st.sign * tax; inBase += st.sign * bs; }
      st.tax = tax; st.bs = bs;
    });
    if (S.mode === "summary") {
      head = [{ t: "البند", wide: true }, { t: "نسبة الضريبة", n: 1 }, { t: "عدد المستندات", n: 1 }, { t: "الوعاء الخاضع", n: 1 }, { t: "الضريبة", n: 1 }];
      sets.forEach(function (st) {
        body.push('<tr class="sec"><td colspan="5">' + esc(st.title) + "</td></tr>"); pr.push({ sec: st.title });
        var byRate = {}; st.rows.forEach(function (r) { var k = String(N(r.vat_rate)); (byRate[k] = byRate[k] || { n: 0, b: 0, t: 0 }); byRate[k].n++; byRate[k].b += base(r); byRate[k].t += N(r.vat_amount); });
        var keys = Object.keys(byRate).sort(function (a, b) { return Number(b) - Number(a); });
        if (!keys.length) { body.push('<tr><td colspan="5" class="muted">لا توجد مستندات في الفترة</td></tr>'); pr.push({ cells: ["لا توجد مستندات في الفترة", "", "", "", ""] }); }
        keys.forEach(function (k) {
          var g = byRate[k];
          body.push("<tr><td>" + esc(st.title.split("—")[0].trim()) + '</td><td class="n">' + k + '%</td><td class="n">' + g.n + '</td><td class="n">' + money(g.b) + '</td><td class="n">' + money(g.t) + "</td></tr>");
          pr.push({ cells: [st.title.split("—")[0].trim(), k + "%", String(g.n), money(g.b), money(g.t)], raw: ["", k + "%", g.n, g.b, g.t] });
        });
        body.push('<tr class="grp"><td colspan="3">الإجمالي</td><td class="n">' + money(st.bs) + '</td><td class="n">' + money(st.tax) + "</td></tr>"); pr.push({ cls: "grp", cells: ["الإجمالي", "", "", money(st.bs), money(st.tax)], raw: ["الإجمالي", "", "", st.bs, st.tax] });
      });
    } else {
      head = [{ t: "التاريخ", n: 1 }, { t: "رقم المستند", n: 1 }, { t: "الطرف", wide: true }, { t: "الوعاء", n: 1 }, { t: "النسبة", n: 1 }, { t: "الضريبة", n: 1 }, { t: "الإجمالي", n: 1 }];
      sets.forEach(function (st) {
        body.push('<tr class="sec"><td colspan="7">' + esc(st.title) + "</td></tr>"); pr.push({ sec: st.title });
        st.rows.sort(function (a, b) { return String(a.date).localeCompare(String(b.date)) || N(a.number) - N(b.number); }).forEach(function (r) {
          body.push('<tr><td class="n" dir="ltr">' + esc(r.date) + '</td><td class="n">' + esc(r.book_no || r.number) + "</td><td>" + esc(party(r)) + '</td><td class="n">' + money(base(r)) + '</td><td class="n">' + N(r.vat_rate) + '%</td><td class="n">' + money(r.vat_amount) + '</td><td class="n">' + money(r.total) + "</td></tr>");
          pr.push({ cells: [r.date, String(r.book_no || r.number), party(r), money(base(r)), N(r.vat_rate) + "%", money(r.vat_amount), money(r.total)], raw: [r.date, String(r.book_no || r.number), party(r), base(r), N(r.vat_rate) + "%", N(r.vat_amount), N(r.total)] });
        });
        body.push('<tr class="grp"><td colspan="3">الإجمالي (' + st.rows.length + ' مستند)</td><td class="n">' + money(st.bs) + '</td><td></td><td class="n">' + money(st.tax) + '</td><td></td></tr>'); pr.push({ cls: "grp", cells: ["الإجمالي (" + st.rows.length + " مستند)", "", "", money(st.bs), "", money(st.tax), ""], raw: ["الإجمالي", "", "", st.bs, "", st.tax, ""] });
      });
    }
    var net = out - inn, cols = head.length;
    body.push('<tr class="sec"><td colspan="' + cols + '">صافي الضريبة للفترة</td></tr>'); pr.push({ sec: "صافي الضريبة للفترة" });
    [["ضريبة المخرجات (المبيعات − المردودات)", out], ["ضريبة المدخلات (المشتريات − المردودات)", inn]].forEach(function (x) {
      body.push('<tr><td colspan="' + (cols - 1) + '">' + x[0] + '</td><td class="n">' + money(x[1]) + "</td></tr>"); pr.push({ cells: [x[0]].concat(new Array(cols - 2).fill(""), [money(x[1])]), raw: [x[0]].concat(new Array(cols - 2).fill(""), [x[1]]) });
    });
    var lbl = net >= 0 ? "الصافي المستحق السداد لمصلحة الضرائب" : "الصافي المستحق الاسترداد (رصيد دائن)";
    body.push('<tr class="tot"><td colspan="' + (cols - 1) + '">' + lbl + '</td><td class="n">' + money(Math.abs(net)) + "</td></tr>"); pr.push({ cls: "tot", cells: [lbl].concat(new Array(cols - 2).fill(""), [money(Math.abs(net))]), raw: [lbl].concat(new Array(cols - 2).fill(""), [Math.abs(net)]) });
    document.getElementById("out").innerHTML = '<table class="vat-tbl"><thead><tr>' + head.map(function (h) { return "<th" + (h.n ? ' class="n"' : "") + ">" + esc(h.t) + "</th>"; }).join("") + "</tr></thead><tbody>" + body.join("") + "</tbody></table>";
    document.getElementById("sum").innerHTML = '<div class="stm-chip"><span>ضريبة المخرجات</span><b>' + money(out) + '</b></div><div class="stm-chip"><span>ضريبة المدخلات</span><b>' + money(inn) + '</b></div><div class="stm-chip ' + (net > 0 ? "err" : "") + '"><span>' + (net >= 0 ? "الصافي المستحق" : "الصافي المسترد") + "</span><b>" + money(Math.abs(net)) + "</b></div>";
    // تسوية مع دفتر الأستاذ: حركة حسابي الضريبة في الفترة
    var B = Acct.balances(D, S.from, S.to), a5 = B.own.a5b || { debit: 0, credit: 0 }, a12 = B.own.a12 || { debit: 0, credit: 0 };
    var ledOut = a5.credit - a5.debit, ledIn = a12.debit - a12.credit;
    document.getElementById("note").textContent = "تسوية مع دفتر الأستاذ: حركة «ضريبة القيمة المضافة مستحقة» = " + money(ledOut) + " (المخرجات)، وحركة «القابلة للخصم» = " + money(ledIn) + " (المدخلات)." +
      (Math.abs(ledOut - out) > 0.01 || Math.abs(ledIn - inn) > 0.01 ? " يوجد فرق عن المستندات (قد يكون من قيود يدوية أو مردودات)." : " مطابقة للمستندات ✓") +
      " ملاحظة: مردودات البيع/الشراء في النظام الحالي لا تعكس الضريبة في القيود.";
    view = { title: "تقرير ضريبة القيمة المضافة", sub: Acct.periodText(S.from, S.to) + " — " + (S.mode === "summary" ? "ملخص" : "تفصيلي"), landscape: S.mode === "detail", head: head, rows: pr,
      notes: ["الوعاء الخاضع = قيمة الفاتورة بعد الخصم + الناولون. الصافي = ضريبة المخرجات − ضريبة المدخلات."] };
  }
  document.getElementById("prn").onclick = function () { if (view) Acct.print(view); };
  document.getElementById("xls").onclick = function () { if (view) Acct.excel("تقرير-الضريبة.xlsx", view); };
  controls(); draw();
})();
