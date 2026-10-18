(async function () {
  var page = await UI.init("daily-report");
  if (!page) return;
  var html = UI.html, money = UI.money, esc = Ledger.esc, val = Ledger.val;
  var T = {};

  page.innerHTML = html`
    <div class="stack">
      <div class="page-toolbar">
        <div>
          <h2 style="margin:0">التقرير اليومي</h2>
          <p class="muted" style="margin:4px 0 0;font-size:12px">ملخص يوم واحد: مبيعات · مشتريات · تحصيلات · مدفوعات · مصروفات · حركة الخزائن</p>
        </div>
        <div class="row gap"><input type="date" id="day" value="${Ledger.today()}"><button type="button" id="prn">طباعة</button></div>
      </div>
      <div class="stats" id="stats"></div>
      <div class="card table-wrap" id="body"></div>
    </div>`;

  var day = function (r) { return String(r.date || r.created_at || "").slice(0, 10); };
  async function draw() {
    var d = val("day");
    var names = ["sales", "purchases", "sale_returns", "purchase_returns", "payments", "expenses", "cash_movements", "customers", "suppliers", "cash_registers"];
    var res = await Promise.all(names.map(function (n) { return DB.list(n); }));
    var t = {}; names.forEach(function (n, i) { t[n] = res[i]; });
    var on = function (a) { return a.filter(function (r) { return day(r) === d && r.status !== "void"; }); };
    var sum = function (a, k) { return a.reduce(function (s, r) { return s + (Number(r[k]) || 0); }, 0); };
    var sales = on(t.sales), purch = on(t.purchases), sr = on(t.sale_returns), pr = on(t.purchase_returns), pay = on(t.payments), exp = on(t.expenses);
    var rec = pay.filter(function (p) { return p.party_type === "customer"; }), out = pay.filter(function (p) { return p.party_type === "supplier"; });
    var cm = on(t.cash_movements).filter(function (m) { return m.type !== "transfer_in" && m.type !== "transfer_out"; });
    var cin = cm.filter(function (m) { return m.kind === "in"; }), cout = cm.filter(function (m) { return m.kind === "out"; });
    var name = function (list, id) { var x = list.filter(function (r) { return r.id === id; })[0]; return x ? x.name : "—"; };
    T = { d: d, sales: sales, purch: purch, rec: rec, out: out, exp: exp };

    document.getElementById("stats").innerHTML = html`
      <div class="stat teal"><div class="label">مبيعات اليوم</div><div class="value">${money(sum(sales, "total") - sum(sr, "total"))}</div></div>
      <div class="stat amber"><div class="label">مشتريات اليوم</div><div class="value">${money(sum(purch, "total") - sum(pr, "total"))}</div></div>
      <div class="stat green"><div class="label">تحصيلات اليوم</div><div class="value">${money(sum(rec, "amount"))}</div></div>
      <div class="stat red"><div class="label">مصروفات اليوم</div><div class="value">${money(sum(exp, "amount"))}</div></div>`;

    function block(title, head, rows) {
      return html`<div class="panel-title"><h3>${title}</h3></div><table><thead><tr>${head.map(function (h) { return "<th>" + h + "</th>"; }).join("")}</tr></thead><tbody>${rows || '<tr><td colspan="' + head.length + '" class="muted" style="padding:12px 16px">لا يوجد</td></tr>'}</tbody></table>`;
    }
    document.getElementById("body").innerHTML =
      block("فواتير البيع (" + sales.length + ")", ["رقم", "العميل", "الإجمالي", "المدفوع"], sales.map(function (s) { return html`<tr><td dir="ltr">${s.number}</td><td>${name(t.customers, s.customer_id)}</td><td>${money(s.total)}</td><td>${money(s.paid)}</td></tr>`; }).join("")) +
      block("فواتير الشراء (" + purch.length + ")", ["رقم", "المورد", "الإجمالي", "المدفوع"], purch.map(function (s) { return html`<tr><td dir="ltr">${s.number}</td><td>${name(t.suppliers, s.supplier_id)}</td><td>${money(s.total)}</td><td>${money(s.paid)}</td></tr>`; }).join("")) +
      block("التحصيلات والمدفوعات", ["النوع", "الطرف", "المبلغ", "ملاحظات"],
        rec.map(function (p) { return html`<tr><td><span class="badge ok">تحصيل</span></td><td>${name(t.customers, p.party_id)}</td><td>${money(p.amount)}</td><td class="muted">${p.notes || ""}</td></tr>`; }).join("") +
        out.map(function (p) { return html`<tr><td><span class="badge warn">سداد</span></td><td>${name(t.suppliers, p.party_id)}</td><td>${money(p.amount)}</td><td class="muted">${p.notes || ""}</td></tr>`; }).join("")) +
      block("المصروفات", ["البيان", "المبلغ"], exp.map(function (e) { return html`<tr><td>${e.description || ""}</td><td>${money(e.amount)}</td></tr>`; }).join("")) +
      block("حركة الخزائن (بدون التحويلات)", ["الخزينة", "النوع", "المبلغ", "البيان"],
        cin.concat(cout).map(function (m) { return html`<tr><td>${name(t.cash_registers, m.register_id)}</td><td><span class="badge ${m.kind === "in" ? "ok" : "warn"}">${m.kind === "in" ? "وارد" : "منصرف"}</span></td><td>${money(m.amount)}</td><td class="muted">${m.notes || ""}</td></tr>`; }).join("")) +
      html`<div class="panel-title"><h3>صافي الخزينة اليوم</h3></div><table><tbody><tr><td>إجمالي الوارد</td><td>${money(sum(cin, "amount"))}</td><td>إجمالي المنصرف</td><td>${money(sum(cout, "amount"))}</td><td><b>الصافي</b></td><td class="accent"><b>${money(sum(cin, "amount") - sum(cout, "amount"))}</b></td></tr></tbody></table>`;
  }
  document.getElementById("day").onchange = draw;
  document.getElementById("prn").onclick = function () {
    var co = DB.getCompany();
    UI.printHTML("التقرير اليومي", "<h1>" + esc(co.name || "") + "</h1><h2>التقرير اليومي — " + T.d + "</h2>" + document.getElementById("body").innerHTML);
  };
  await draw();
})();
