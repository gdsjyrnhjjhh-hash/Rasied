(async function () {
  var page = await UI.init("reports");
  if (!page) return;
  var html = UI.html, money = UI.money;

  var accounts = await DB.list("accounts");
  var jlines = await DB.list("journal_lines");
  var sales = await DB.list("sales");
  var purchases = await DB.list("purchases");
  var products = await DB.list("products");
  var customers = await DB.list("customers");
  var suppliers = await DB.list("suppliers");
  var registers = await DB.list("cash_registers");
  var employees = await DB.list("employees");

  var bal = {};
  accounts.forEach(function (a) { bal[a.id] = { debit: 0, credit: 0, acc: a }; });
  jlines.forEach(function (l) {
    if (!bal[l.account_id]) return;
    bal[l.account_id].debit += Number(l.debit) || 0;
    bal[l.account_id].credit += Number(l.credit) || 0;
  });

  function net(b) {
    var a = b.acc;
    if (a.type === "asset" || a.type === "expense") return b.debit - b.credit;
    return b.credit - b.debit;
  }

  // ميزان المراجعة بالشجرة: الحساب الرئيسي يعرض مجموع نفسه + فروعه، والإجماليات تُحسب من الأرصدة الذاتية فقط (بلا ازدواج)
  var treeNodes = Ledger.accountTree(accounts), childrenOf = {}, rolled = {};
  accounts.forEach(function (a) { if (a.parent && bal[a.parent] && a.parent !== a.id) (childrenOf[a.parent] = childrenOf[a.parent] || []).push(a.id); });
  accounts.forEach(function (a) {
    (function roll(id, seen) {
      if (rolled[id]) return rolled[id];
      var r = { debit: bal[id].debit, credit: bal[id].credit };
      if (seen[id]) return r; seen[id] = 1;
      (childrenOf[id] || []).forEach(function (cid) { var c = roll(cid, seen); r.debit += c.debit; r.credit += c.credit; });
      return (rolled[id] = r);
    })(a.id, {});
  });
  var trialRows = treeNodes.map(function (n) {
    var r = rolled[n.a.id] || { debit: 0, credit: 0 };
    return { acc: n.a, debit: r.debit, credit: r.credit, level: n.level, group: n.hasKids };
  }).filter(function (b) { return b.debit || b.credit; });

  var totalDebit = Object.keys(bal).reduce(function (s, id) { return s + bal[id].debit; }, 0);
  var totalCredit = Object.keys(bal).reduce(function (s, id) { return s + bal[id].credit; }, 0);

  var revenue = 0, expense = 0;
  Object.keys(bal).forEach(function (id) {
    var b = bal[id];
    if (b.acc.type === "revenue") revenue += net(b);
    if (b.acc.type === "expense") expense += net(b);
  });
  var profit = revenue - expense;

  var invValue = products.reduce(function (s, p) { return s + (p.qty || 0) * (p.cost || 0); }, 0);
  var salesTotal = sales.reduce(function (s, x) { return s + (Number(x.total) || 0); }, 0);
  var purchTotal = purchases.reduce(function (s, x) { return s + (Number(x.total) || 0); }, 0);
  var ar = customers.reduce(function (s, c) { return s + (Number(c.balance) || 0); }, 0);
  var ap = suppliers.reduce(function (s, c) { return s + (Number(c.balance) || 0); }, 0);
  var cash = (registers || []).reduce(function (s, r) { return s + (Number(r.balance) || 0); }, 0);
  var payroll = (employees || []).filter(function (e) { return e.status !== "inactive"; })
    .reduce(function (s, e) { return s + (Number(e.salary) || 0); }, 0);

  var maxMoney = Math.max(salesTotal, purchTotal, invValue, cash, 1);

  function exportTrial() {
    UI.exportCSV("trial-balance.csv",
      ["الكود", "الحساب", "مدين", "دائن", "الرصيد"],
      trialRows.map(function (b) {
        return [b.acc.code, new Array(b.level + 1).join("   ") + b.acc.name + (b.group ? " (مجموع المجموعة)" : ""), b.debit, b.credit, net(b)];
      }));
    UI.toast("تم تصدير ميزان المراجعة");
  }
  function exportInventory() {
    UI.exportCSV("inventory.csv",
      ["الصنف", "الكمية", "التكلفة", "القيمة", "سعر البيع"],
      products.map(function (p) {
        return [p.name, p.qty, p.cost, (p.qty || 0) * (p.cost || 0), p.price];
      }));
    UI.toast("تم تصدير المخزون");
  }

  page.innerHTML = html`
    <div class="stack">
      <div class="page-toolbar">
        <div>
          <h2 style="margin:0">التقارير المالية</h2>
          <p class="muted" style="margin:4px 0 0;font-size:12px">نظرة تنفيذية · تصدير CSV · ميزان مراجعة</p>
        </div>
        <div class="row gap wrap">
          <button type="button" class="primary" id="ex-trial">تصدير الميزان</button>
          <button type="button" id="ex-inv">تصدير المخزون</button>
        </div>
      </div>

      <div class="kpi-grid anim-stagger">
        <div class="kpi">
          <div class="kpi-label">المبيعات</div>
          <div class="kpi-value accent">${money(salesTotal)}</div>
          <div class="meter"><i style="width:${Math.round(salesTotal / maxMoney * 100)}%"></i></div>
        </div>
        <div class="kpi">
          <div class="kpi-label">المشتريات</div>
          <div class="kpi-value">${money(purchTotal)}</div>
          <div class="meter"><i style="width:${Math.round(purchTotal / maxMoney * 100)}%"></i></div>
        </div>
        <div class="kpi">
          <div class="kpi-label">صافي الربح (من القيود)</div>
          <div class="kpi-value" style="color:${profit >= 0 ? "var(--success)" : "var(--error)"}">${money(profit)}</div>
          <div class="kpi-sub">إيراد ${money(revenue)} − مصروف ${money(expense)}</div>
        </div>
        <div class="kpi">
          <div class="kpi-label">قيمة المخزون</div>
          <div class="kpi-value">${money(invValue)}</div>
          <div class="meter"><i style="width:${Math.round(invValue / maxMoney * 100)}%"></i></div>
        </div>
        <div class="kpi">
          <div class="kpi-label">ذمم مدينة</div>
          <div class="kpi-value">${money(ar)}</div>
          <div class="kpi-sub">${customers.length} عميل</div>
        </div>
        <div class="kpi">
          <div class="kpi-label">ذمم دائنة</div>
          <div class="kpi-value">${money(ap)}</div>
          <div class="kpi-sub">${suppliers.length} مورد</div>
        </div>
        <div class="kpi">
          <div class="kpi-label">النقدية</div>
          <div class="kpi-value accent">${money(cash)}</div>
          <div class="kpi-sub">${(registers || []).length} خزينة</div>
        </div>
        <div class="kpi">
          <div class="kpi-label">رواتب شهرية</div>
          <div class="kpi-value">${money(payroll)}</div>
          <div class="kpi-sub">الموظفين النشطين</div>
        </div>
      </div>

      <div class="card">
        <div class="section-head">
          <h3>قائمة الدخل</h3>
          <span class="chip">${profit >= 0 ? "ربح" : "خسارة"}</span>
        </div>
        <div class="table-wrap">
          <table>
            <tbody>
              <tr><td>الإيرادات</td><td><b>${money(revenue)}</b></td></tr>
              <tr><td>المصروفات وتكلفة المبيعات</td><td>${money(expense)}</td></tr>
              <tr><td><b>صافي النتيجة</b></td><td><b class="accent">${money(profit)}</b></td></tr>
            </tbody>
          </table>
        </div>
      </div>

      <div class="card table-card">
        <div class="table-head">
          <h3 style="margin:0">ميزان المراجعة</h3>
          ${Math.abs(totalDebit - totalCredit) < 0.01
            ? html`<span class="badge ok">متوازن</span>`
            : html`<span class="badge err">غير متوازن</span>`}
        </div>
        <div class="table-wrap">
          <table>
            <thead><tr><th>الكود</th><th>الحساب</th><th>مدين</th><th>دائن</th><th>الرصيد</th></tr></thead>
            <tbody>
              ${trialRows.map(function (b) {
                return html`<tr>
                  <td dir="ltr">${Ledger.esc(b.acc.code)}</td>
                  <td style="padding-inline-start:${b.level * 22 + 8}px;${b.group ? "font-weight:700" : ""}">${Ledger.esc(b.acc.name)}${b.group ? ' <span class="badge">مجموع المجموعة</span>' : ""}</td>
                  <td>${b.debit ? money(b.debit) : ""}</td>
                  <td>${b.credit ? money(b.credit) : ""}</td>
                  <td>${money(net(b))}</td>
                </tr>`;
              }).join("")}
              <tr>
                <td colspan="2"><b>الإجمالي</b></td>
                <td><b>${money(totalDebit)}</b></td>
                <td><b>${money(totalCredit)}</b></td>
                <td></td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      <div class="card table-card">
        <div class="table-head">
          <h3 style="margin:0">تقرير المخزون</h3>
          <span class="chip">${products.length} صنف</span>
        </div>
        <div class="table-wrap">
          <table>
            <thead><tr><th>الصنف</th><th>الكمية</th><th>التكلفة</th><th>القيمة</th><th>سعر البيع</th></tr></thead>
            <tbody>
              ${products.map(function (p) {
                return html`<tr>
                  <td>${p.name}</td>
                  <td>${p.qty}</td>
                  <td>${money(p.cost)}</td>
                  <td>${money((p.qty || 0) * (p.cost || 0))}</td>
                  <td>${money(p.price)}</td>
                </tr>`;
              }).join("")}
            </tbody>
          </table>
        </div>
      </div>
    </div>`;

  document.getElementById("ex-trial").onclick = exportTrial;
  document.getElementById("ex-inv").onclick = exportInventory;
})();
