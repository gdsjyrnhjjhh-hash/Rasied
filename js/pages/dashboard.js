(async function () {
  var page = await UI.init("dashboard");
  if (!page) return;
  var html = UI.html, money = UI.money;

  var sales = await DB.list("sales");
  var purchases = await DB.list("purchases");
  var products = await DB.list("products");
  var customers = await DB.list("customers");
  var payments = await DB.list("payments");
  var suppliers = await DB.list("suppliers");
  var registers = await DB.list("cash_registers");
  var employees = await DB.list("employees");

  var salesTotal = sales.reduce(function (s, x) { return s + (Number(x.total) || 0); }, 0);
  var purchTotal = purchases.reduce(function (s, x) { return s + (Number(x.total) || 0); }, 0);
  var receipts = payments.filter(function (p) { return p.kind === "receipt"; })
    .reduce(function (s, x) { return s + (Number(x.amount) || 0); }, 0);
  var lowStock = products.filter(function (p) { return (p.qty || 0) <= (p.min_qty || 0); });
  var custBal = customers.reduce(function (s, c) { return s + (Number(c.balance) || 0); }, 0);
  var invValue = products.reduce(function (s, p) { return s + (p.qty || 0) * (p.cost || 0); }, 0);
  var cashTotal = (registers || []).reduce(function (s, r) { return s + (Number(r.balance) || 0); }, 0);
  var empCount = (employees || []).filter(function (e) { return e.status !== "inactive"; }).length;
  var payrollMonthly = (employees || []).filter(function (e) { return e.status !== "inactive"; })
    .reduce(function (s, e) { return s + (Number(e.salary) || 0); }, 0);

  // بيانات وهمية لأشرطة آخر 7 أيام من المبيعات
  var barVals = [0.35, 0.55, 0.4, 0.75, 0.5, 0.9, 0.65];
  if (sales.length) {
    var maxT = Math.max.apply(null, sales.map(function (s) { return Number(s.total) || 1; }));
    barVals = sales.slice(0, 7).map(function (s) {
      return Math.max(0.12, (Number(s.total) || 0) / maxT);
    });
    while (barVals.length < 7) barVals.push(0.15 + Math.random() * 0.3);
  }

  page.innerHTML = html`
    <div class="stack">
      <div class="hero-banner shine">
        <div>
          <h2><span class="live-dot"></span>مرحباً — لوحة التحكم الحية</h2>
          <p>مبيعات · مشتريات · مخزون · ذمم · تقارير في لمحة واحدة</p>
        </div>
        <div class="row gap wrap">
          <a href="sales.html"><button class="primary" type="button">+ فاتورة بيع</button></a>
          <a href="purchases.html"><button type="button" style="background:rgba(255,255,255,0.18);color:#fff;border:1px solid rgba(255,255,255,0.28);backdrop-filter:blur(8px)">+ فاتورة شراء</button></a>
          <a href="reports.html"><button type="button" style="background:rgba(255,255,255,0.1);color:#fff;border:1px solid rgba(255,255,255,0.2)">التقارير</button></a>
        </div>
      </div>

      <div class="stats anim-stagger">
        <div class="stat teal">
          <div class="label">إجمالي المبيعات</div>
          <div class="value count-up" data-to="${salesTotal}">0</div>
        </div>
        <div class="stat blue">
          <div class="label">إجمالي المشتريات</div>
          <div class="value count-up" data-to="${purchTotal}">0</div>
        </div>
        <div class="stat">
          <div class="label">المقبوضات</div>
          <div class="value count-up" data-to="${receipts}">0</div>
        </div>
        <div class="stat amber">
          <div class="label">ذمم العملاء</div>
          <div class="value count-up" data-to="${custBal}">0</div>
        </div>
        <div class="stat ${lowStock.length ? "red" : "teal"}">
          <div class="label">نواقص مخزون</div>
          <div class="value count-up" data-to="${lowStock.length}">0</div>
        </div>
        <div class="stat">
          <div class="label">قيمة المخزون</div>
          <div class="value count-up" data-to="${Math.round(invValue)}">0</div>
        </div>
        <div class="stat teal">
          <div class="label">النقدية بالخزائن</div>
          <div class="value count-up" data-to="${Math.round(cashTotal)}">0</div>
        </div>
        <div class="stat blue">
          <div class="label">رواتب شهرية (نشط)</div>
          <div class="value count-up" data-to="${Math.round(payrollMonthly)}">0</div>
        </div>
      </div>

      <div class="spark-row">
        <div class="card accent-card">
          <div class="panel-title">
            <h3>نشاط المبيعات</h3>
            <span class="tag">آخر الحركات</span>
          </div>
          <div class="mini-bars" aria-hidden="true">
            ${barVals.map(function (v, i) {
              return html`<span style="height:${Math.round(v * 100)}%" title="يوم ${i + 1}"></span>`;
            }).join("")}
          </div>
          <p class="muted" style="margin:12px 0 0;font-size:12px">الأعمدة تعكس حجم آخر الفواتير — للمعاينة البصرية</p>
        </div>
        <div class="card accent-card">
          <div class="panel-title">
            <h3>ملخص سريع</h3>
            <span class="tag">الآن</span>
          </div>
          <div class="stack" style="gap:10px">
            <div class="row between"><span class="muted">عملاء</span><b>${customers.length}</b></div>
            <div class="row between"><span class="muted">موردين</span><b>${suppliers.length}</b></div>
            <div class="row between"><span class="muted">أصناف</span><b>${products.length}</b></div>
            <div class="row between"><span class="muted">فواتير بيع</span><b>${sales.length}</b></div>
            <div class="row between"><span class="muted">فواتير شراء</span><b>${purchases.length}</b></div>
            <div class="row between"><span class="muted">موظفين نشطين</span><b>${empCount}</b></div>
            <div class="row between"><span class="muted">خزائن</span><b>${(registers || []).length}</b></div>
            <div class="row between"><span class="muted">صافي تقريبي</span><b class="accent">${money(salesTotal - purchTotal)}</b></div>
          </div>
        </div>
      </div>


      <div class="card accent-card">
        <div class="panel-title">
          <h3>آخر النشاط</h3>
          <span class="tag">Live</span>
        </div>
        <div class="stack" style="gap:8px" id="activity-feed">
          ${sales.slice(0,3).map(function(s){
            return html`<div class="row between"><span>بيع #${s.number}</span><b class="accent">${money(s.total)}</b></div>`;
          }).join("") || html`<div class="muted">لا مبيعات بعد</div>`}
          ${purchases.slice(0,2).map(function(s){
            return html`<div class="row between"><span>شراء #${s.number}</span><b>${money(s.total)}</b></div>`;
          }).join("")}
        </div>
      </div>

      <div class="row gap wrap" style="align-items:stretch">
        <div class="card" style="flex:1.4;min-width:280px">
          <div class="panel-title">
            <h3>آخر فواتير البيع</h3>
            <a href="sales.html" class="tag">عرض الكل</a>
          </div>
          <div class="table-wrap">
            <table>
              <thead><tr><th>رقم</th><th>الإجمالي</th><th>المدفوع</th><th>التاريخ</th></tr></thead>
              <tbody>
                ${sales.slice(0, 6).map(function (s) {
                  return html`<tr>
                    <td><b>#${s.number}</b></td>
                    <td>${money(s.total)}</td>
                    <td>${money(s.paid)}</td>
                    <td dir="ltr">${s.date || ""}</td>
                  </tr>`;
                }).join("") || html`<tr><td colspan="4" class="empty">لا توجد فواتير بعد</td></tr>`}
              </tbody>
            </table>
          </div>
        </div>
        <div class="card" style="flex:1;min-width:260px">
          <div class="panel-title">
            <h3>تنبيهات المخزون</h3>
            <a href="products.html" class="tag">الأصناف</a>
          </div>
          ${lowStock.length === 0
            ? html`<div class="empty" style="padding:28px">المخزون ضمن الحدود الآمنة</div>`
            : html`<div class="table-wrap"><table>
                <thead><tr><th>الصنف</th><th>الكمية</th><th>الحد</th></tr></thead>
                <tbody>${lowStock.map(function (p) {
                  return html`<tr><td>${p.name}</td><td class="accent"><b>${p.qty}</b></td><td>${p.min_qty}</td></tr>`;
                }).join("")}</tbody>
              </table></div>`}
        </div>
      </div>
    </div>`;

  // عدّادات متحركة
  function animateCount(el) {
    var to = Number(el.getAttribute("data-to")) || 0;
    var dur = 900;
    var start = performance.now();
    function frame(now) {
      var t = Math.min(1, (now - start) / dur);
      var eased = 1 - Math.pow(1 - t, 3);
      var val = Math.round(to * eased);
      el.textContent = val.toLocaleString("ar-EG");
      if (t < 1) requestAnimationFrame(frame);
      else el.textContent = to.toLocaleString("ar-EG");
    }
    requestAnimationFrame(frame);
  }
  page.querySelectorAll(".count-up").forEach(animateCount);
})();
