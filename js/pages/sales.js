(async function () {
  var page = await UI.init("sales");
  if (!page) return;
  var html = UI.html, money = UI.money;
  var sales = [], customers = [], products = [], lines = [];
  var vatRate = 14, vatEnabled = true, company = { name: "شركة النور للتجارة", phone: "", address: "", tax_id: "" };

  page.innerHTML = html`
    <div class="stack">
      <div class="page-toolbar">
        <div>
          <h2 style="margin:0">فواتير البيع</h2>
          <p class="muted" style="margin:4px 0 0;font-size:12px">ضريبة · طباعة · ترحيل محاسبي · <span class="kbd">Ctrl+K</span></p>
        </div>
        <button type="button" class="primary" id="btn-add">+ فاتورة بيع</button>
      </div>
      <div class="stats" id="sale-stats"></div>
      <div class="card table-wrap" id="list"></div>
      <div id="detail"></div>
    </div>`;

  function custName(id) {
    var c = customers.filter(function (x) { return x.id === id; })[0];
    return c ? c.name : "—";
  }
  function prodName(id) {
    var p = products.filter(function (x) { return x.id === id; })[0];
    return p ? p.name : "—";
  }

  function loadCompany() {
    var c = DB.getCompany();
    company = Object.assign(company, c);
    if (c.vat_rate != null) vatRate = Number(c.vat_rate) || 0;
    if (c.vat_enabled != null) vatEnabled = c.vat_enabled !== false;
  }

  function renderList() {
    var total = sales.reduce(function (s, x) { return s + (Number(x.total) || 0); }, 0);
    var paid = sales.reduce(function (s, x) { return s + (Number(x.paid) || 0); }, 0);
    var due = total - paid;
    var se = document.getElementById("sale-stats");
    if (se) se.innerHTML = html`
      <div class="stat teal"><div class="label">عدد الفواتير</div><div class="value">${sales.length}</div></div>
      <div class="stat"><div class="label">إجمالي المبيعات</div><div class="value">${money(total)}</div></div>
      <div class="stat blue"><div class="label">المحصل</div><div class="value">${money(paid)}</div></div>
      <div class="stat amber"><div class="label">المتبقي</div><div class="value">${money(due)}</div></div>`;

    document.getElementById("list").innerHTML = html`
      <table class="clickable">
        <thead><tr><th>رقم</th><th>العميل</th><th>قبل الضريبة</th><th>ض.ق.م</th><th>الإجمالي</th><th>المدفوع</th><th>المتبقي</th><th>التاريخ</th></tr></thead>
        <tbody>
          ${sales.length === 0 ? html`<tr><td colspan="8" class="empty">لا توجد فواتير</td></tr>` :
            sales.map(function (s) {
              var due = (s.total || 0) - (s.paid || 0);
              return html`<tr data-id="${s.id}">
                <td><b>#${s.number}</b></td>
                <td>${custName(s.customer_id)}</td>
                <td>${money(s.subtotal != null ? s.subtotal : s.total)}</td>
                <td>${money(s.vat_amount || 0)}</td>
                <td><b>${money(s.total)}</b></td>
                <td>${money(s.paid)}</td>
                <td class="${due > 0 ? "accent" : ""}">${money(due)}</td>
                <td dir="ltr">${s.date || ""}</td>
              </tr>`;
            }).join("")}
        </tbody>
      </table>`;
  }

  function printSale(s) {
    var sl = lines.filter(function (l) { return l.sale_id === s.id; });
    var rows = sl.map(function (l) {
      return "<tr><td>" + prodName(l.product_id) + "</td><td>" + l.qty + "</td><td>" + money(l.unit_price) + "</td><td>" + money(l.qty * l.unit_price) + "</td></tr>";
    }).join("");
    var sub = s.subtotal != null ? s.subtotal : s.total;
    var vat = s.vat_amount || 0;
    var body =
      "<h1>" + (company.name || "الشركة") + "</h1>" +
      "<h2>فاتورة مبيعات رقم " + s.number + "</h2>" +
      "<div class=meta><div><div>العميل: <b>" + custName(s.customer_id) + "</b></div><div>التاريخ: " + (s.date || "") + "</div><div>ملاحظات: " + (s.notes || "—") + "</div></div>" +
      "<div><div>هاتف: " + (company.phone || "") + "</div><div>العنوان: " + (company.address || "") + "</div><div>الرقم الضريبي: " + (company.tax_id || "") + "</div></div></div>" +
      "<table><thead><tr><th>الصنف</th><th>الكمية</th><th>السعر</th><th>الإجمالي</th></tr></thead><tbody>" + rows + "</tbody></table>" +
      "<table class=totals>" +
      "<tr><td>قبل الضريبة</td><td>" + money(sub) + "</td></tr>" +
      "<tr><td>ض.ق.م (" + (s.vat_rate || 0) + "%)</td><td>" + money(vat) + "</td></tr>" +
      "<tr><td>الإجمالي</td><td>" + money(s.total) + "</td></tr>" +
      "<tr><td>المدفوع</td><td>" + money(s.paid) + "</td></tr>" +
      "<tr><td>المتبقي</td><td>" + money((s.total || 0) - (s.paid || 0)) + "</td></tr></table>";
    UI.printHTML("فاتورة " + s.number, body);
  }

  function showDetail(id) {
    var s = sales.filter(function (x) { return x.id === id; })[0];
    if (!s) { document.getElementById("detail").innerHTML = ""; return; }
    var sl = lines.filter(function (l) { return l.sale_id === id; });
    document.getElementById("detail").innerHTML = html`
      <div class="card stack">
        <div class="invoice-hero">
          <div>
            <div class="muted" style="font-size:12px;margin-bottom:4px">فاتورة مبيعات</div>
            <div class="big-num">#${s.number}</div>
            <div style="margin-top:8px"><b>${custName(s.customer_id)}</b></div>
            <div class="muted" style="font-size:12px;margin-top:4px" dir="ltr">${s.date || ""}</div>
          </div>
          <div class="row gap wrap">
            <button type="button" class="primary" id="btn-print">طباعة الفاتورة</button>
            <span class="badge ok">مرحّلة</span>
          </div>
        </div>
        <div class="table-wrap">
          <table>
            <thead><tr><th>الصنف</th><th>الكمية</th><th>السعر</th><th>الإجمالي</th></tr></thead>
            <tbody>
              ${sl.map(function (l) {
                return html`<tr>
                  <td>${prodName(l.product_id)}</td>
                  <td>${l.qty}</td>
                  <td>${money(l.unit_price)}</td>
                  <td>${money(l.qty * l.unit_price)}</td>
                </tr>`;
              }).join("")}
            </tbody>
          </table>
        </div>
        <div class="invoice-totals">
          <div class="box"><span>قبل الضريبة</span><b>${money(s.subtotal != null ? s.subtotal : s.total)}</b></div>
          <div class="box"><span>ض.ق.م (${s.vat_rate || 0}%)</span><b>${money(s.vat_amount || 0)}</b></div>
          <div class="box"><span>الإجمالي</span><b class="accent">${money(s.total)}</b></div>
          <div class="box"><span>المدفوع</span><b>${money(s.paid)}</b></div>
          <div class="box"><span>المتبقي</span><b>${money((s.total || 0) - (s.paid || 0))}</b></div>
        </div>
        ${s.notes ? html`<p class="muted" style="margin:0">ملاحظات: ${s.notes}</p>` : ""}
      </div>`;
    var bp = document.getElementById("btn-print");
    if (bp) bp.onclick = function () { printSale(s); };
  }

  async function createSale() {
    if (!customers.length || !products.length) { UI.toast("أضف عملاء وأصناف أولاً", true); return; }
    var ov = document.createElement("div");
    ov.className = "modal-overlay";
    var lineRows = [{ product_id: products[0].id, qty: 1, unit_price: products[0].price }];

    function renderLines() {
      return lineRows.map(function (lr, i) {
        return html`<div class="form-grid" data-li="${i}" style="margin-bottom:8px;padding-bottom:8px;border-bottom:1px solid var(--border)">
          <div class="field"><label>الصنف</label>
            <select class="lp">${products.map(function (p) {
              return html`<option value="${p.id}" ${p.id === lr.product_id ? "selected" : ""}>${p.name} (${money(p.price)})</option>`;
            }).join("")}</select>
          </div>
          <div class="field"><label>الكمية</label><input class="lq" type="number" min="0.01" step="0.01" value="${lr.qty}"></div>
          <div class="field"><label>السعر</label><input class="lpr" type="number" step="0.01" value="${lr.unit_price}"></div>
          <div class="field" style="justify-content:flex-end"><label>&nbsp;</label>
            <button type="button" class="danger small ldel" data-i="${i}">حذف</button>
          </div>
        </div>`;
      }).join("");
    }

    function rebuild() {
      ov.querySelector("#lines").innerHTML = renderLines();
      ov.querySelectorAll(".lp").forEach(function (sel, i) {
        sel.onchange = function () {
          var p = products.filter(function (x) { return x.id === sel.value; })[0];
          lineRows[i].product_id = sel.value;
          lineRows[i].unit_price = p ? p.price : 0;
          ov.querySelectorAll(".lpr")[i].value = lineRows[i].unit_price;
        };
      });
      ov.querySelectorAll(".ldel").forEach(function (btn) {
        btn.onclick = function () {
          lineRows.splice(Number(btn.getAttribute("data-i")), 1);
          if (!lineRows.length) lineRows.push({ product_id: products[0].id, qty: 1, unit_price: products[0].price });
          rebuild();
        };
      });
    }

    ov.innerHTML = html`<div class="modal card">
      <h3 style="margin-top:0">فاتورة بيع جديدة</h3>
      <form id="f" class="stack">
        <div class="form-grid">
          <div class="field"><label>العميل</label>
            <select id="cust">${customers.map(function (c) {
              return html`<option value="${c.id}">${c.name}</option>`;
            }).join("")}</select>
          </div>
          <div class="field"><label>التاريخ</label><input id="date" type="date" value="${new Date().toISOString().slice(0,10)}"></div>
          <div class="field"><label>مدفوع الآن</label><input id="paid" type="number" step="0.01" value="0"></div>
          <div class="field"><label>ض.ق.م</label>
            <select id="vat-on">
              <option value="1" ${vatEnabled ? "selected" : ""}>مفعّلة (${vatRate}%)</option>
              <option value="0">بدون ضريبة</option>
            </select>
          </div>
          <div class="field full"><label>ملاحظات</label><input id="notes"></div>
        </div>
        <h4 style="margin:8px 0 0">البنود</h4>
        <div id="lines"></div>
        <button type="button" class="ghost small" id="add-line">+ بند</button>
        <div class="row gap" style="justify-content:flex-end">
          <button type="button" class="ghost" id="cancel">إلغاء</button>
          <button class="primary" type="submit">حفظ وترحيل</button>
        </div>
      </form>
    </div>`;
    document.body.appendChild(ov);
    rebuild();
    ov.querySelector("#add-line").onclick = function () {
      lineRows.push({ product_id: products[0].id, qty: 1, unit_price: products[0].price });
      rebuild();
    };
    ov.querySelector("#cancel").onclick = function () { ov.remove(); };
    ov.onclick = function (e) { if (e.target === ov) ov.remove(); };

    ov.querySelector("#f").onsubmit = async function (e) {
      e.preventDefault();
      ov.querySelectorAll("[data-li]").forEach(function (row, i) {
        lineRows[i].product_id = row.querySelector(".lp").value;
        lineRows[i].qty = Number(row.querySelector(".lq").value) || 0;
        lineRows[i].unit_price = Number(row.querySelector(".lpr").value) || 0;
      });
      var subtotal = lineRows.reduce(function (s, l) { return s + l.qty * l.unit_price; }, 0);
      var onVat = document.getElementById("vat-on").value === "1";
      var rate = onVat ? vatRate : 0;
      var vatAmount = Math.round(subtotal * rate) / 100;
      var total = subtotal + vatAmount;
      var paid = Number(document.getElementById("paid").value) || 0;
      var custId = document.getElementById("cust").value;
      try {
        var num = await DB.nextNumber("sales");
        var sale = await DB.insert("sales", {
          number: num, customer_id: custId, date: document.getElementById("date").value, status: "posted",
          subtotal: subtotal, vat_rate: rate, vat_amount: vatAmount, total: total, paid: paid,
          notes: document.getElementById("notes").value.trim(),
        });
        var cogs = 0;
        for (var i = 0; i < lineRows.length; i++) {
          var lr = lineRows[i];
          var prod = products.filter(function (x) { return x.id === lr.product_id; })[0];
          var cost = prod ? Number(prod.cost) || 0 : 0;
          cogs += cost * lr.qty;
          await DB.insert("sale_lines", { sale_id: sale.id, product_id: lr.product_id, qty: lr.qty, unit_price: lr.unit_price, cost: cost });
          if (prod) await DB.update("products", prod.id, { qty: Math.max(0, (prod.qty || 0) - lr.qty) });
        }
        var cust = customers.filter(function (x) { return x.id === custId; })[0];
        if (cust) await DB.update("customers", cust.id, { balance: (Number(cust.balance) || 0) + (total - paid) });
        var jn = await DB.nextNumber("journal_entries");
        var entry = await DB.insert("journal_entries", {
          number: jn, date: document.getElementById("date").value,
          memo: "قيد مبيعات فاتورة " + num, source: "sale", source_id: sale.id,
        });
        await DB.insert("journal_lines", { entry_id: entry.id, account_id: "a3", debit: total, credit: 0 });
        await DB.insert("journal_lines", { entry_id: entry.id, account_id: "a7", debit: 0, credit: subtotal });
        if (vatAmount > 0) await DB.insert("journal_lines", { entry_id: entry.id, account_id: "a5b", debit: 0, credit: vatAmount });
        if (cogs > 0) {
          await DB.insert("journal_lines", { entry_id: entry.id, account_id: "a9", debit: cogs, credit: 0 });
          await DB.insert("journal_lines", { entry_id: entry.id, account_id: "a4", debit: 0, credit: cogs });
        }
        if (paid > 0) {
          await DB.insert("payments", {
            kind: "receipt", party_type: "customer", party_id: custId, amount: paid, method: "cash",
            date: document.getElementById("date").value, ref: sale.id, notes: "دفعة على فاتورة " + num,
          });
        }
        UI.toast("تم ترحيل الفاتورة #" + num);
        ov.remove(); await load();
      } catch (err) { UI.toast(err.message || "خطأ", true); }
    };
  }

  async function load() {
    loadCompany();
    var d = await Promise.all([DB.list("sales"), DB.list("customers"), DB.list("products"), DB.list("sale_lines")]);
    sales = d[0]; customers = d[1]; products = d[2]; lines = d[3];
    renderList();
  }

  document.getElementById("btn-add").onclick = createSale;
  document.getElementById("list").onclick = function (e) {
    var tr = e.target.closest("tr[data-id]");
    if (tr) showDetail(tr.getAttribute("data-id"));
  };
  await load();
})();
