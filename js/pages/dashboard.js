(async function () {
  var page = await UI.init("dashboard");
  if (!page) return;
  var html = UI.html, money = UI.money, num = UI.num, compact = UI.compact;
  var I = UI.ICON;

  // هيكل تحميل أثناء جلب البيانات
  page.innerHTML = '<div class="stack"><div class="skel" style="height:64px"></div>' +
    '<div class="stats">' + [1, 2, 3, 4].map(function () { return '<div class="skel" style="height:150px"></div>'; }).join("") + '</div>' +
    '<div class="skel" style="height:360px"></div></div>';

  var data;
  try {
    data = await Promise.all([
      DB.list("sales"), DB.list("purchases"), DB.list("products"), DB.list("customers"),
      DB.list("payments"), DB.list("cash_registers"), DB.list("employees"),
    ]);
  } catch (e) {
    page.innerHTML = '<div class="card error">تعذّر تحميل البيانات: ' + (e.message || e) + '</div>';
    return;
  }
  var sales = data[0], purchases = data[1], products = data[2], customers = data[3],
    payments = data[4], registers = data[5] || [], employees = data[6] || [];

  var company = DB.getCompany();
  function sum(arr, f) { return arr.reduce(function (s, x) { return s + (Number(f(x)) || 0); }, 0); }
  function custName(id) {
    var c = customers.filter(function (x) { return x.id === id; })[0];
    return c ? c.name : "—";
  }

  var lowStock = products.filter(function (p) { return (p.qty || 0) <= (p.min_qty || 0); });
  var custBal = sum(customers, function (c) { return c.balance; });
  var debtors = customers.filter(function (c) { return (Number(c.balance) || 0) > 0; }).length;
  var invValue = sum(products, function (p) { return (p.qty || 0) * (p.cost || 0); });
  var cashTotal = sum(registers, function (r) { return r.balance; });
  var activeEmps = employees.filter(function (e) { return e.status !== "inactive"; });
  var payrollMonthly = sum(activeEmps, function (e) { return e.salary; });
  var receiptsAll = payments.filter(function (p) { return p.kind === "receipt"; });

  var DAY = 86400000;
  function dayKey(d) { return new Date(d).toISOString().slice(0, 10); }

  // تجميع يومي لفترة معيّنة (days) تنتهي اليوم، مع إزاحة للخلف offset
  function series(rows, field, days, offset) {
    var out = [], idx = {};
    for (var i = days - 1; i >= 0; i--) {
      var t = Date.now() - (i + (offset || 0)) * DAY;
      idx[dayKey(t)] = out.length;
      out.push({ key: dayKey(t), t: t, v: 0, n: 0 });
    }
    rows.forEach(function (x) {
      var k = (x.date || x.created_at || "").slice(0, 10);
      if (idx[k] != null) { out[idx[k]].v += Number(x[field]) || 0; out[idx[k]].n++; }
    });
    return out;
  }
  function total(s) { return s.reduce(function (a, b) { return a + b.v; }, 0); }
  function count(s) { return s.reduce(function (a, b) { return a + b.n; }, 0); }

  // مسار منحنٍ ناعم (Monotone cubic) بين النقاط
  function smooth(pts) {
    if (pts.length < 2) return "";
    var n = pts.length, dx = [], dy = [], m = [], t = [];
    for (var i = 0; i < n - 1; i++) {
      dx[i] = pts[i + 1][0] - pts[i][0]; dy[i] = pts[i + 1][1] - pts[i][1]; m[i] = dy[i] / (dx[i] || 1);
    }
    t[0] = m[0]; t[n - 1] = m[n - 2];
    for (i = 1; i < n - 1; i++) t[i] = m[i - 1] * m[i] <= 0 ? 0 : (m[i - 1] + m[i]) / 2;
    for (i = 0; i < n - 1; i++) {
      if (m[i] === 0) { t[i] = 0; t[i + 1] = 0; continue; }
      var a = t[i] / m[i], b = t[i + 1] / m[i], h = a * a + b * b;
      if (h > 9) { var k = 3 / Math.sqrt(h); t[i] = k * a * m[i]; t[i + 1] = k * b * m[i]; }
    }
    var d = "M" + pts[0][0].toFixed(2) + "," + pts[0][1].toFixed(2);
    for (i = 0; i < n - 1; i++) {
      var c1x = pts[i][0] + dx[i] / 3, c1y = pts[i][1] + t[i] * dx[i] / 3;
      var c2x = pts[i + 1][0] - dx[i] / 3, c2y = pts[i + 1][1] - t[i + 1] * dx[i] / 3;
      d += " C" + c1x.toFixed(2) + "," + c1y.toFixed(2) + " " + c2x.toFixed(2) + "," + c2y.toFixed(2) + " " + pts[i + 1][0].toFixed(2) + "," + pts[i + 1][1].toFixed(2);
    }
    return d;
  }

  function niceMax(v) {
    if (v <= 0) return 1;
    var p = Math.pow(10, Math.floor(Math.log10(v)));
    var n = v / p;
    return (n <= 1 ? 1 : n <= 2 ? 2 : n <= 5 ? 5 : 10) * p;
  }

  // sparkline صغير داخل بطاقة KPI
  var sid = 0;
  function spark(s) {
    var vals = s.map(function (b) { return b.v; });
    var max = Math.max.apply(null, vals), min = 0;
    if (!max) return '<svg class="spark" viewBox="0 0 100 40" preserveAspectRatio="none" aria-hidden="true"><path class="line" d="M0,34 L100,34" opacity=".35"/></svg>';
    var pts = vals.map(function (v, i) {
      return [100 - (i * 100 / (vals.length - 1)), 34 - ((v - min) / (max - min)) * 28];
    }).reverse();
    var line = smooth(pts);
    var id = "sg" + (++sid);
    return '<svg class="spark" viewBox="0 0 100 40" preserveAspectRatio="none" aria-hidden="true">' +
      '<defs><linearGradient id="' + id + '" x1="0" y1="0" x2="0" y2="1"><stop offset="0" style="stop-color:var(--kc);stop-opacity:.28"/><stop offset="1" style="stop-color:var(--kc);stop-opacity:0"/></linearGradient></defs>' +
      '<path d="' + line + ' L100,40 L0,40 Z" style="fill:url(#' + id + ')"/><path class="line" d="' + line + '"/></svg>';
  }

  function deltaBadge(cur, prev, goodWhenUp) {
    if (!cur && !prev) return '<span class="delta flat">—</span>';
    if (!prev) return '<span class="delta up">جديد</span>';
    var p = Math.round((cur - prev) / prev * 100);
    if (p === 0) return '<span class="delta flat">0%</span>';
    var up = p > 0, good = goodWhenUp ? up : !up;
    return '<span class="delta ' + (good ? "up" : "down") + '">' + (up ? I.trendUp : I.trendDown) + num(Math.abs(p)) + '%</span>';
  }

  function kpi(cls, icon, label, value, curS, prevT, sub, goodUp, extra) {
    return '<div class="kpi-card ' + cls + '">' +
      '<div class="kpi-top"><div class="kl"><span class="kpi-ic">' + icon + '</span>' + label + '</div>' + (prevT != null ? deltaBadge(total(curS), prevT, goodUp) : "") + '</div>' +
      '<div class="kv">' + value + '<small>' + (company.currency || "") + '</small></div>' +
      '<div class="kmeta">' + sub + '</div>' + (curS ? spark(curS) : extra || "") + '</div>';
  }

  // ---------- مخطط المساحة (مبيعات مقابل مشتريات) ----------
  function areaChart(S, P) {
    var W = 760, H = 300, pl = 6, pr = 54, pt = 14, pb = 32;
    var iw = W - pl - pr, ih = H - pt - pb, n = S.length;
    var max = niceMax(Math.max.apply(null, S.concat(P).map(function (b) { return b.v; })));
    function X(i) { return W - pr - (i * iw / (n - 1)); }       // الأقدم يميناً (RTL)
    function Y(v) { return pt + ih - (ih * v / max); }
    var g = "";
    for (var k = 0; k <= 4; k++) {
      var y = pt + ih - (ih * k / 4);
      g += '<line class="gridline" x1="' + pl + '" x2="' + (W - pr) + '" y1="' + y + '" y2="' + y + '"/>' +
        '<text x="' + (W - pr + 10) + '" y="' + (y + 4) + '">' + compact(max * k / 4) + '</text>';
    }
    var step = n > 20 ? 4 : n > 10 ? 2 : 1;
    S.forEach(function (b, i) {
      if (i % step === 0) g += '<text text-anchor="middle" x="' + X(i) + '" y="' + (H - 8) + '">' + UI.fmtDate(b.t) + '</text>';
    });
    var sp = S.map(function (b, i) { return [X(i), Y(b.v)]; }).reverse();
    var pp = P.map(function (b, i) { return [X(i), Y(b.v)]; }).reverse();
    var sl = smooth(sp), pl2 = smooth(pp);
    var area = sl + " L" + sp[sp.length - 1][0] + "," + (pt + ih) + " L" + sp[0][0] + "," + (pt + ih) + " Z";
    var hit = S.map(function (b, i) {
      var w = iw / (n - 1);
      return '<rect class="hit" data-i="' + i + '" x="' + (X(i) - w / 2) + '" y="' + pt + '" width="' + w + '" height="' + ih + '" fill="transparent"/>';
    }).join("");
    return '<svg viewBox="0 0 ' + W + " " + H + '" role="img" aria-label="المبيعات والمشتريات">' +
      '<defs><linearGradient id="gArea" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#3d63f0" stop-opacity=".32"/><stop offset="1" stop-color="#3d63f0" stop-opacity="0"/></linearGradient></defs>' +
      g + '<path class="area-s" d="' + area + '"/>' +
      '<path class="line-p chart-draw" style="--len:2400" pathLength="2400" d="' + pl2 + '"/>' +
      '<path class="line-s chart-draw" style="--len:2400" pathLength="2400" d="' + sl + '"/>' +
      '<line class="cross" id="cx" y1="' + pt + '" y2="' + (pt + ih) + '"/>' +
      '<circle class="dot" id="dS" r="6" fill="var(--chart-1)"/><circle class="dot" id="dP" r="5" fill="var(--chart-2)"/>' + hit + '</svg>';
  }

  // ---------- دونات المخزون ----------
  var palette = ["#2a49d6", "#6189fb", "#9aa7c4", "#f2a516", "#12b886", "#c2cbe0"];
  function donut() {
    var items = products.map(function (p) { return { n: p.name, v: (p.qty || 0) * (p.cost || 0) }; })
      .filter(function (x) { return x.v > 0; }).sort(function (a, b) { return b.v - a.v; });
    if (items.length > 5) {
      var rest = items.slice(5).reduce(function (a, x) { return a + x.v; }, 0);
      items = items.slice(0, 5); items.push({ n: "أخرى", v: rest });
    }
    var tot = items.reduce(function (a, x) { return a + x.v; }, 0);
    if (!tot) return '<div class="empty compact">لا توجد أصناف مخزنة</div>';
    var r = 66, c = 2 * Math.PI * r, off = 0, arcs = "";
    items.forEach(function (x, i) {
      var len = c * x.v / tot;
      arcs += '<circle class="seg" cx="86" cy="86" r="' + r + '" fill="none" stroke="' + palette[i % palette.length] + '" stroke-width="20" stroke-dasharray="' + Math.max(0, len - 3) + " " + (c - len + 3) + '" stroke-dashoffset="' + (-off) + '" transform="rotate(-90 86 86)"><title>' + x.n + ": " + money(x.v) + '</title></circle>';
      off += len;
    });
    return '<div class="donut-wrap"><svg viewBox="0 0 172 172" role="img" aria-label="توزيع قيمة المخزون">' +
      '<circle cx="86" cy="86" r="' + r + '" fill="none" stroke="var(--surface-3)" stroke-width="20"/>' + arcs +
      '<text class="donut-center" x="86" y="88" text-anchor="middle">' + compact(tot) + '</text>' +
      '<text class="donut-sub" x="86" y="107" text-anchor="middle">قيمة المخزون</text></svg>' +
      '<div class="legend-list">' + items.map(function (x, i) {
        return '<div class="li"><span><i style="background:' + palette[i % palette.length] + '"></i><em>' + x.n + '</em></span><b>' + num(Math.round(x.v / tot * 100)) + '%</b></div>';
      }).join("") + '</div></div>';
  }

  // ---------- آخر النشاط ----------
  var feed = [];
  sales.forEach(function (x) { feed.push({ t: x.created_at || x.date, kind: "in", title: "فاتورة بيع #" + x.number, sub: custName(x.customer_id), date: x.date, amt: x.total }); });
  purchases.forEach(function (x) { feed.push({ t: x.created_at || x.date, kind: "out", title: "فاتورة شراء #" + x.number, sub: "مشتريات", date: x.date, amt: x.total }); });
  payments.forEach(function (x) { feed.push({ t: x.created_at || x.date, kind: x.kind === "receipt" ? "in" : "out", title: x.kind === "receipt" ? "سند قبض" : "سند صرف", sub: "سندات", date: x.date, amt: x.amount }); });
  feed.sort(function (a, b) { return String(b.t || "").localeCompare(String(a.t || "")); });
  feed = feed.slice(0, 6);

  var hour = new Date().getHours();
  var greet = hour < 12 ? "صباح الخير" : hour < 18 ? "مساء الخير" : "مساء النور";
  var todayStr = new Date().toLocaleDateString("ar-EG-u-nu-latn", { weekday: "long", day: "numeric", month: "long", year: "numeric" });
  var range = 14;
  try { var sr = Number(localStorage.getItem("trading_dash_range")); if ([7, 14, 30].indexOf(sr) >= 0) range = sr; } catch (e) {}

  function render() {
    var S = series(sales, "total", range), SP = series(sales, "total", range, range);
    var P = series(purchases, "total", range), PP = series(purchases, "total", range, range);
    var R = series(receiptsAll, "amount", range), RP = series(receiptsAll, "amount", range, range);
    var cur = { s: total(S), p: total(P), r: total(R) };
    var net = cur.s - cur.p;
    var best = S.reduce(function (a, b) { return b.v > a.v ? b : a; }, S[0]);

    page.innerHTML = html`
    <div class="stack">
      <div class="dash-head">
        <div>
          <h2><span class="live-dot"></span>${greet}، ${company.name || "مرحباً"}</h2>
          <p>${todayStr} · ${lowStock.length ? '<b>' + num(lowStock.length) + ' أصناف</b> تحتاج إعادة طلب' : "المخزون ضمن الحدود الآمنة"}</p>
        </div>
        <div class="row gap wrap">
          <div class="seg" role="tablist" aria-label="الفترة">
            ${[7, 14, 30].map(function (d) { return '<button type="button" role="tab" data-range="' + d + '" class="' + (d === range ? "on" : "") + '">' + num(d) + ' يوماً</button>'; }).join("")}
          </div>
          <a href="sales.html"><button class="primary" type="button">${I.plus}فاتورة بيع</button></a>
          <a href="purchases.html"><button type="button">${I.plus}فاتورة شراء</button></a>
        </div>
      </div>

      <div class="stats">
        ${kpi("", I.trendUp, "إجمالي المبيعات", money(cur.s), S, total(SP), '<span>' + num(count(S)) + ' فاتورة</span>', true)}
        ${kpi("c-gray", I.purchases, "إجمالي المشتريات", money(cur.p), P, total(PP), '<span>' + num(count(P)) + ' فاتورة</span>', false)}
        ${kpi("c-green", I.arrowIn, "المقبوضات", money(cur.r), R, total(RP), '<span>' + num(count(R)) + ' سند قبض</span>', true)}
        ${kpi("c-amber", I.customers, "ذمم العملاء", money(custBal), null, null, '<span>' + num(debtors) + ' عميل مدين من ' + num(customers.length) + '</span>', null, '<div class="meter" style="margin:14px 0 20px"><i style="width:' + (customers.length ? Math.round(debtors / customers.length * 100) : 0) + '%;background:linear-gradient(90deg,#f6b73c,#e89a0c)"></i></div>')}
      </div>

      <div class="mini-stats">
        <div class="mini"><span class="kpi-ic">${I.products}</span><div><div class="ml">قيمة المخزون</div><div class="mv">${money(invValue)}</div></div></div>
        <div class="mini c-green"><span class="kpi-ic">${I.wallet}</span><div><div class="ml">النقدية بالخزائن</div><div class="mv">${money(cashTotal)}</div></div></div>
        <div class="mini ${lowStock.length ? "c-red" : "c-green"}"><span class="kpi-ic">${I.alert}</span><div><div class="ml">نواقص المخزون</div><div class="mv">${num(lowStock.length)} صنف</div></div></div>
        <div class="mini c-amber"><span class="kpi-ic">${I.payroll}</span><div><div class="ml">رواتب شهرية (${num(activeEmps.length)} موظف)</div><div class="mv">${money(payrollMonthly)}</div></div></div>
      </div>

      <div class="dash-grid">
        <div class="card">
          <div class="panel-title">
            <div><h3>المبيعات مقابل المشتريات</h3><div class="panel-sub">آخر ${num(range)} يوماً · الفرق <b dir="ltr" style="color:${net >= 0 ? "var(--success)" : "var(--error)"}">${net >= 0 ? "+" : "−"}${money(Math.abs(net))}</b></div></div>
            <div class="chart-legend">
              <span><i style="background:var(--chart-1)"></i>مبيعات <b>${money(cur.s)}</b></span>
              <span><i style="background:var(--chart-2)"></i>مشتريات <b>${money(cur.p)}</b></span>
            </div>
          </div>
          <div class="chart-box" id="area-chart">${areaChart(S, P)}<div class="chart-tip" id="chart-tip"></div></div>
          <div class="chart-foot">
            <div><span>أعلى يوم مبيعاً</span><b>${money(best.v)}</b><small>${best.v ? UI.fmtDate(best.t) : "—"}</small></div>
            <div><span>متوسط المبيعات اليومي</span><b>${money(Math.round(cur.s / range))}</b><small>خلال ${num(range)} يوماً</small></div>
            <div><span>متوسط الفاتورة</span><b>${count(S) ? money(Math.round(cur.s / count(S))) : "—"}</b><small>${num(count(S))} فاتورة</small></div>
          </div>
        </div>
        <div class="card">
          <div class="panel-title"><div><h3>توزيع المخزون</h3><div class="panel-sub">حسب قيمة التكلفة</div></div><a href="products.html" class="tag">الأصناف</a></div>
          ${donut()}
        </div>
      </div>

      <div class="dash-grid">
        <div class="card table-card">
          <div class="table-head"><h3>آخر فواتير البيع</h3><a href="sales.html" class="tag">عرض الكل</a></div>
          <div class="table-wrap">
            <table class="clickable" id="recent-sales">
              <thead><tr><th>رقم</th><th>العميل</th><th>الإجمالي</th><th>الحالة</th><th>التاريخ</th></tr></thead>
              <tbody>
                ${sales.slice(0, 6).map(function (s) {
                  var due = (s.total || 0) - (s.paid || 0);
                  return html`<tr data-href="sales.html">
                    <td><b>#${s.number}</b></td>
                    <td>${custName(s.customer_id)}</td>
                    <td><b>${money(s.total)}</b></td>
                    <td>${due > 0 ? html`<span class="badge warn">متبقي ${money(due)}</span>` : html`<span class="badge ok">مسدّدة</span>`}</td>
                    <td dir="ltr" class="muted" style="text-align:end">${s.date || ""}</td>
                  </tr>`;
                }).join("") || html`<tr><td colspan="5" class="empty">لا توجد فواتير بعد</td></tr>`}
              </tbody>
            </table>
          </div>
        </div>
        <div class="stack">
          <div class="card">
            <div class="panel-title"><h3>آخر النشاط</h3><span class="tag">مباشر</span></div>
            <div class="activity">
              ${feed.map(function (f) {
                return html`<div class="act-item">
                  <div class="act-ic ${f.kind}">${f.kind === "in" ? I.arrowIn : I.arrowOut}</div>
                  <div class="act-body">${f.title}<small>${f.sub} · <span dir="ltr">${f.date || ""}</span></small></div>
                  <div class="act-amt ${f.kind === "in" ? "in" : ""}" dir="ltr">${f.kind === "in" ? "+" : "−"}${money(f.amt)}</div>
                </div>`;
              }).join("") || html`<div class="empty compact">لا يوجد نشاط بعد</div>`}
            </div>
          </div>
          <div class="card">
            <div class="panel-title"><h3>تنبيهات المخزون</h3><a href="products.html" class="tag">${lowStock.length ? num(lowStock.length) + " صنف" : "سليم"}</a></div>
            ${lowStock.length === 0
              ? html`<div class="empty compact">المخزون ضمن الحدود الآمنة ✓</div>`
              : html`<div class="activity">${lowStock.map(function (p) {
                  return html`<div class="act-item"><div class="act-ic bad">${I.alert}</div>
                    <div class="act-body">${p.name}<small>الحد الأدنى ${num(p.min_qty)}</small></div><div class="act-amt bad">${num(p.qty)}</div></div>`;
                }).join("")}</div>`}
          </div>
        </div>
      </div>
    </div>`;

    bind(S, P);
  }

  function bind(S, P) {
    page.querySelectorAll("[data-range]").forEach(function (b) {
      b.addEventListener("click", function () {
        range = Number(b.getAttribute("data-range"));
        try { localStorage.setItem("trading_dash_range", String(range)); } catch (e) {}
        render();
      });
    });
    page.querySelectorAll("#recent-sales tr[data-href]").forEach(function (tr) {
      tr.addEventListener("click", function () { location.href = tr.getAttribute("data-href"); });
    });

    var box = document.getElementById("area-chart"), tip = document.getElementById("chart-tip");
    if (!box || !tip) return;
    var svgEl = box.querySelector("svg"), vb = svgEl.viewBox.baseVal;
    var cx = document.getElementById("cx"), dS = document.getElementById("dS"), dP = document.getElementById("dP");
    var pr = 54, pt = 14, pb = 32, iw = vb.width - 6 - pr, ih = vb.height - pt - pb;
    var max = niceMax(Math.max.apply(null, S.concat(P).map(function (b) { return b.v; })));
    function Y(v) { return pt + ih - (ih * v / max); }
    box.addEventListener("mousemove", function (e) {
      var hit = e.target.closest ? e.target.closest(".hit") : null;
      if (!hit) { box.classList.remove("hover"); tip.style.opacity = 0; return; }
      var i = Number(hit.getAttribute("data-i"));
      var x = vb.width - pr - (i * iw / (S.length - 1));
      cx.setAttribute("x1", x); cx.setAttribute("x2", x);
      dS.setAttribute("cx", x); dS.setAttribute("cy", Y(S[i].v));
      dP.setAttribute("cx", x); dP.setAttribute("cy", Y(P[i].v));
      box.classList.add("hover");
      var r = box.getBoundingClientRect();
      tip.innerHTML = "<b>" + UI.fmtDate(S[i].t, { weekday: "long", day: "numeric", month: "long" }) + "</b>" +
        '<i style="background:var(--chart-1)"></i>مبيعات: ' + money(S[i].v) + "<br>" +
        '<i style="background:#9aa7c4"></i>مشتريات: ' + money(P[i].v);
      tip.style.left = Math.min(Math.max(x / vb.width * r.width, 80), r.width - 80) + "px";
      tip.style.top = (Y(Math.max(S[i].v, P[i].v)) / vb.height * r.height) + "px";
      tip.style.opacity = 1;
    });
    box.addEventListener("mouseleave", function () { box.classList.remove("hover"); tip.style.opacity = 0; });
  }

  render();
})();
