(async function () {
  var page = await UI.init("sales-sheet");
  if (!page) return;
  var html = UI.html, money = UI.money, esc = Ledger.esc, val = Ledger.val;
  var sales = [], lines = [], customers = [], products = [], view = "inv";
  var f = { from: "", to: "", cust: "", text: "" };

  page.innerHTML = html`
    <div class="stack">
      <div class="page-toolbar">
        <div>
          <h2 style="margin:0">كشف المبيعات</h2>
          <p class="muted" style="margin:4px 0 0;font-size:12px">فواتير الفترة · المتبقي · ملخص الأصناف المباعة والربحية</p>
        </div>
        <div class="row gap"><button type="button" id="csv">تصدير Excel</button><button type="button" id="prn">طباعة</button></div>
      </div>
      <div class="card"><div class="form-grid">
        <div class="field"><label>من تاريخ</label><input type="date" id="from"></div>
        <div class="field"><label>إلى تاريخ</label><input type="date" id="to"></div>
        <div class="field"><label>العميل</label><select id="cust"><option value="">كل العملاء</option></select></div>
        <div class="field"><label>بحث (رقم / ملاحظات)</label><input id="text"></div>
      </div></div>
      <div class="stats" id="stats"></div>
      <div class="seg" id="seg"><button type="button" class="on" data-v="inv">الفواتير</button><button type="button" data-v="items">ملخص الأصناف</button></div>
      <div class="card table-wrap" id="tbl"></div>
    </div>`;

  function cname(id) { var c = customers.filter(function (x) { return x.id === id; })[0]; return c ? c.name : "—"; }
  function pname(id) { var p = products.filter(function (x) { return x.id === id; })[0]; return p ? p.name : "—"; }
  function filtered() {
    var t = (f.text || "").toLowerCase();
    return sales.filter(function (s) {
      var d = String(s.date || s.created_at || "").slice(0, 10);
      return s.status !== "void" && (!f.from || d >= f.from) && (!f.to || d <= f.to) && (!f.cust || s.customer_id === f.cust) &&
        (!t || (String(s.number) + " " + (s.notes || "")).toLowerCase().indexOf(t) !== -1);
    }).sort(function (a, b) { return String(b.date).localeCompare(String(a.date)); });
  }
  function itemsAgg(rows) {
    var ids = {}; rows.forEach(function (s) { ids[s.id] = 1; });
    var m = {};
    lines.forEach(function (l) {
      if (!ids[l.sale_id]) return;
      var o = m[l.product_id] || (m[l.product_id] = { id: l.product_id, qty: 0, rev: 0, cost: 0 });
      var q = Number(l.qty) || 0; o.qty += q; o.rev += q * (Number(l.unit_price) || 0); o.cost += q * (Number(l.cost) || 0);
    });
    return Object.keys(m).map(function (k) { return m[k]; }).sort(function (a, b) { return b.rev - a.rev; });
  }

  function draw() {
    var rows = filtered(), sum = function (k) { return rows.reduce(function (s, r) { return s + (Number(r[k]) || 0); }, 0); };
    var total = sum("total"), paid = sum("paid");
    document.getElementById("stats").innerHTML = html`
      <div class="stat"><div class="label">عدد الفواتير</div><div class="value">${rows.length}</div></div>
      <div class="stat teal"><div class="label">إجمالي المبيعات</div><div class="value">${money(total)}</div></div>
      <div class="stat green"><div class="label">المدفوع</div><div class="value">${money(paid)}</div></div>
      <div class="stat amber"><div class="label">المتبقي</div><div class="value">${money(total - paid)}</div></div>`;
    if (view === "inv") {
      document.getElementById("tbl").innerHTML = html`
        <table><thead><tr><th>رقم</th><th>التاريخ</th><th>العميل</th><th>الإجمالي</th><th>المدفوع</th><th>المتبقي</th></tr></thead><tbody>
          ${rows.map(function (s) {
            var rem = (Number(s.total) || 0) - (Number(s.paid) || 0);
            return html`<tr><td dir="ltr"><b>${s.number}</b></td><td dir="ltr">${String(s.date || "").slice(0, 10)}</td><td>${cname(s.customer_id)}</td>
              <td>${money(s.total)}</td><td>${money(s.paid)}</td><td class="${rem > 0.004 ? "accent" : ""}">${money(rem)}</td></tr>`;
          }).join("") || html`<tr><td colspan="6" class="empty">لا توجد فواتير</td></tr>`}
          <tr style="font-weight:700;background:var(--surface-3)"><td colspan="3">الإجمالي</td><td>${money(total)}</td><td>${money(paid)}</td><td>${money(total - paid)}</td></tr>
        </tbody></table>`;
    } else {
      var it = itemsAgg(rows);
      document.getElementById("tbl").innerHTML = html`
        <table><thead><tr><th>الصنف</th><th>الكمية</th><th>المبيعات (قبل الضريبة)</th><th>التكلفة</th><th>الربح</th></tr></thead><tbody>
          ${it.map(function (o) {
            return html`<tr><td><b>${pname(o.id)}</b></td><td>${money(o.qty)}</td><td>${money(o.rev)}</td><td>${money(o.cost)}</td><td class="accent"><b>${money(o.rev - o.cost)}</b></td></tr>`;
          }).join("") || html`<tr><td colspan="5" class="empty">لا توجد بيانات</td></tr>`}
        </tbody></table>`;
    }
  }

  ["from", "to", "cust"].forEach(function (k) { document.getElementById(k).onchange = function () { f[k] = val(k); draw(); }; });
  document.getElementById("text").oninput = function () { f.text = val("text"); draw(); };
  document.getElementById("seg").onclick = function (e) {
    var b = e.target.closest("[data-v]"); if (!b) return; view = b.getAttribute("data-v");
    document.querySelectorAll("#seg button").forEach(function (x) { x.classList.toggle("on", x === b); }); draw();
  };
  document.getElementById("csv").onclick = function () {
    if (view === "inv") UI.exportCSV("كشف-المبيعات.csv", ["رقم", "التاريخ", "العميل", "الإجمالي", "المدفوع", "المتبقي"],
      filtered().map(function (s) { return [s.number, String(s.date || "").slice(0, 10), cname(s.customer_id), s.total, s.paid, (s.total || 0) - (s.paid || 0)]; }));
    else UI.exportCSV("ملخص-الأصناف.csv", ["الصنف", "الكمية", "المبيعات", "التكلفة", "الربح"],
      itemsAgg(filtered()).map(function (o) { return [pname(o.id), o.qty, o.rev, o.cost, o.rev - o.cost]; }));
  };
  document.getElementById("prn").onclick = function () {
    var co = DB.getCompany(), rows = filtered();
    UI.printHTML("كشف المبيعات", "<h1>" + esc(co.name || "") + "</h1><h2>كشف المبيعات</h2><div class=meta><div>الفترة: " + (f.from || "البداية") + " → " + (f.to || "اليوم") + "</div></div>" +
      "<table><thead><tr><th>رقم</th><th>التاريخ</th><th>العميل</th><th>الإجمالي</th><th>المدفوع</th><th>المتبقي</th></tr></thead><tbody>" +
      rows.map(function (s) { return "<tr><td>" + s.number + "</td><td>" + String(s.date || "").slice(0, 10) + "</td><td>" + esc(cname(s.customer_id)) + "</td><td>" + money(s.total) + "</td><td>" + money(s.paid) + "</td><td>" + money((s.total || 0) - (s.paid || 0)) + "</td></tr>"; }).join("") + "</tbody></table>");
  };

  var d = await Promise.all([DB.list("sales"), DB.list("sale_lines"), DB.list("customers"), DB.list("products")]);
  sales = d[0]; lines = d[1]; customers = d[2]; products = d[3];
  document.getElementById("cust").innerHTML += customers.map(function (c) { return '<option value="' + c.id + '">' + esc(c.name) + "</option>"; }).join("");
  draw();
})();
