(async function () {
  var page = await UI.init("purchases");
  if (!page) return;
  var html = UI.html, money = UI.money;
  var purchases = [], suppliers = [], products = [], lines = [];
  var vatRate = 14, vatEnabled = true, company = { name: "شركة النور للتجارة", phone: "", address: "", tax_id: "" };

  function loadCompany() {
    try {
      var demo = localStorage.getItem("trading_demo_v3") || localStorage.getItem("trading_demo_v2");
      if (demo) {
        var parsed = JSON.parse(demo);
        if (parsed.company) {
          company = Object.assign(company, parsed.company);
          if (parsed.company.vat_rate != null) vatRate = Number(parsed.company.vat_rate) || 14;
          if (parsed.company.vat_enabled != null) vatEnabled = !!parsed.company.vat_enabled;
        }
      }
    } catch (e) {}
  }

  page.innerHTML = html`
    <div class="stack">
      <div class="page-toolbar">
        <div>
          <h2 style="margin:0">فواتير الشراء</h2>
          <p class="muted" style="margin:4px 0 0;font-size:12px">ضريبة · طباعة · زيادة مخزون · ترحيل محاسبي</p>
        </div>
        <button type="button" class="primary" id="btn-add">+ فاتورة شراء</button>
      </div>
      <div class="stats" id="purch-stats"></div>
      <div class="card table-wrap" id="list"></div>
      <div id="detail"></div>
    </div>`;

  function supName(id) {
    var s = suppliers.filter(function (x) { return x.id === id; })[0];
    return s ? s.name : "—";
  }
  function prodName(id) {
    var p = products.filter(function (x) { return x.id === id; })[0];
    return p ? p.name : "—";
  }

  function renderList() {
    var total = purchases.reduce(function (s, x) { return s + (Number(x.total) || 0); }, 0);
    var paid = purchases.reduce(function (s, x) { return s + (Number(x.paid) || 0); }, 0);
    var se = document.getElementById("purch-stats");
    if (se) se.innerHTML = html`
      <div class="stat teal"><div class="label">عدد الفواتير</div><div class="value">${purchases.length}</div></div>
      <div class="stat"><div class="label">إجمالي المشتريات</div><div class="value">${money(total)}</div></div>
      <div class="stat blue"><div class="label">المدفوع</div><div class="value">${money(paid)}</div></div>
      <div class="stat amber"><div class="label">المتبقي</div><div class="value">${money(total - paid)}</div></div>`;

    document.getElementById("list").innerHTML = html`
      <table class="clickable">
        <thead><tr><th>رقم</th><th>المورد</th><th>قبل الضريبة</th><th>ض.ق.م</th><th>الإجمالي</th><th>المدفوع</th><th>المتبقي</th><th>التاريخ</th></tr></thead>
        <tbody>
          ${purchases.length === 0 ? html`<tr><td colspan="8" class="empty">لا توجد فواتير</td></tr>` :
            purchases.map(function (s) {
              var due = (s.total || 0) - (s.paid || 0);
              return html`<tr data-id="${s.id}">
                <td><b>#${s.number}</b></td>
                <td>${supName(s.supplier_id)}</td>
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

  function printPurchase(s) {
    var pl = lines.filter(function (l) { return l.purchase_id === s.id; });
    var rows = pl.map(function (l) {
      return "<tr><td>" + prodName(l.product_id) + "</td><td>" + l.qty + "</td><td>" + money(l.unit_cost) + "</td><td>" + money(l.qty * l.unit_cost) + "</td></tr>";
    }).join("");
    var sub = s.subtotal != null ? s.subtotal : s.total;
    var body =
      "<h1>" + (company.name || "الشركة") + "</h1>" +
      "<h2>فاتورة مشتريات رقم " + s.number + "</h2>" +
      "<div class=meta><div><div>المورد: <b>" + supName(s.supplier_id) + "</b></div><div>التاريخ: " + (s.date || "") + "</div></div>" +
      "<div><div>الرقم الضريبي: " + (company.tax_id || "") + "</div></div></div>" +
      "<table><thead><tr><th>الصنف</th><th>الكمية</th><th>التكلفة</th><th>الإجمالي</th></tr></thead><tbody>" + rows + "</tbody></table>" +
      "<table class=totals>" +
      "<tr><td>قبل الضريبة</td><td>" + money(sub) + "</td></tr>" +
      "<tr><td>ض.ق.م (" + (s.vat_rate || 0) + "%)</td><td>" + money(s.vat_amount || 0) + "</td></tr>" +
      "<tr><td>الإجمالي</td><td>" + money(s.total) + "</td></tr>" +
      "<tr><td>المدفوع</td><td>" + money(s.paid) + "</td></tr></table>";
    UI.printHTML("مشتريات " + s.number, body);
  }

  function showDetail(id) {
    var s = purchases.filter(function (x) { return x.id === id; })[0];
    if (!s) { document.getElementById("detail").innerHTML = ""; return; }
    var pl = lines.filter(function (l) { return l.purchase_id === id; });
    document.getElementById("detail").innerHTML = html`
      <div class="card stack">
        <div class="invoice-hero">
          <div>
            <div class="muted" style="font-size:12px;margin-bottom:4px">فاتورة مشتريات</div>
            <div class="big-num">#${s.number}</div>
            <div style="margin-top:8px"><b>${supName(s.supplier_id)}</b></div>
            <div class="muted" style="font-size:12px;margin-top:4px" dir="ltr">${s.date || ""}</div>
          </div>
          <div class="row gap wrap">
            <button type="button" class="primary" id="btn-print">طباعة</button>
            <span class="badge ok">مرحّلة</span>
          </div>
        </div>
        <div class="table-wrap">
          <table>
            <thead><tr><th>الصنف</th><th>الكمية</th><th>التكلفة</th><th>الإجمالي</th></tr></thead>
            <tbody>
              ${pl.map(function (l) {
                return html`<tr>
                  <td>${prodName(l.product_id)}</td>
                  <td>${l.qty}</td>
                  <td>${money(l.unit_cost)}</td>
                  <td>${money(l.qty * l.unit_cost)}</td>
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
      </div>`;
    var bp = document.getElementById("btn-print");
    if (bp) bp.onclick = function () { printPurchase(s); };
  }

  async function createPurchase() {
    if (!suppliers.length || !products.length) {
      UI.toast("أضف موردين وأصناف أولاً", true); return;
    }
    var ov = document.createElement("div");
    ov.className = "modal-overlay";
    var lineRows = [{ product_id: products[0].id, qty: 1, unit_cost: products[0].cost }];

    function renderLines() {
      return lineRows.map(function (lr, i) {
        return html`<div class="form-grid" data-li="${i}" style="margin-bottom:8px;padding-bottom:8px;border-bottom:1px solid var(--border)">
          <div class="field"><label>الصنف</label>
            <select class="lp">${products.map(function (p) {
              return html`<option value="${p.id}" ${p.id === lr.product_id ? "selected" : ""}>${p.name}</option>`;
            }).join("")}</select>
          </div>
          <div class="field"><label>الكمية</label><input class="lq" type="number" min="0.01" step="0.01" value="${lr.qty}"></div>
          <div class="field"><label>التكلفة</label><input class="lc" type="number" step="0.01" value="${lr.unit_cost}"></div>
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
          lineRows[i].unit_cost = p ? p.cost : 0;
          ov.querySelectorAll(".lc")[i].value = lineRows[i].unit_cost;
        };
      });
      ov.querySelectorAll(".ldel").forEach(function (btn) {
        btn.onclick = function () {
          lineRows.splice(Number(btn.getAttribute("data-i")), 1);
          if (!lineRows.length) lineRows.push({ product_id: products[0].id, qty: 1, unit_cost: products[0].cost });
          rebuild();
        };
      });
    }

    ov.innerHTML = html`<div class="modal card">
      <h3 style="margin-top:0">فاتورة شراء جديدة</h3>
      <form id="f" class="stack">
        <div class="form-grid">
          <div class="field"><label>المورد</label>
            <select id="sup">${suppliers.map(function (s) {
              return html`<option value="${s.id}">${s.name}</option>`;
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
      lineRows.push({ product_id: products[0].id, qty: 1, unit_cost: products[0].cost });
      rebuild();
    };
    ov.querySelector("#cancel").onclick = function () { ov.remove(); };
    ov.onclick = function (e) { if (e.target === ov) ov.remove(); };

    ov.querySelector("#f").onsubmit = async function (e) {
      e.preventDefault();
      ov.querySelectorAll("[data-li]").forEach(function (row, i) {
        lineRows[i].product_id = row.querySelector(".lp").value;
        lineRows[i].qty = Number(row.querySelector(".lq").value) || 0;
        lineRows[i].unit_cost = Number(row.querySelector(".lc").value) || 0;
      });
      var subtotal = lineRows.reduce(function (s, l) { return s + l.qty * l.unit_cost; }, 0);
      var onVat = document.getElementById("vat-on").value === "1";
      var rate = onVat ? vatRate : 0;
      var vatAmount = Math.round(subtotal * rate) / 100;
      var total = subtotal + vatAmount;
      var paid = Number(document.getElementById("paid").value) || 0;
      var supId = document.getElementById("sup").value;
      try {
        var num = await DB.nextNumber("purchases");
        var purch = await DB.insert("purchases", {
          number: num, supplier_id: supId,
          date: document.getElementById("date").value, status: "posted",
          subtotal: subtotal, vat_rate: rate, vat_amount: vatAmount, total: total, paid: paid,
          notes: document.getElementById("notes").value.trim(),
        });
        for (var i = 0; i < lineRows.length; i++) {
          var lr = lineRows[i];
          await DB.insert("purchase_lines", {
            purchase_id: purch.id, product_id: lr.product_id, qty: lr.qty, unit_cost: lr.unit_cost,
          });
          var prod = products.filter(function (x) { return x.id === lr.product_id; })[0];
          if (prod) {
            await DB.update("products", prod.id, {
              qty: (prod.qty || 0) + lr.qty,
              cost: lr.unit_cost,
            });
          }
        }
        var sup = suppliers.filter(function (x) { return x.id === supId; })[0];
        if (sup) {
          await DB.update("suppliers", sup.id, { balance: (Number(sup.balance) || 0) + (total - paid) });
        }
        var jn = await DB.nextNumber("journal_entries");
        var entry = await DB.insert("journal_entries", {
          number: jn, date: document.getElementById("date").value,
          memo: "قيد مشتريات فاتورة " + num, source: "purchase", source_id: purch.id,
        });
        await DB.insert("journal_lines", { entry_id: entry.id, account_id: "a4", debit: subtotal, credit: 0 });
        if (vatAmount > 0) {
          await DB.insert("journal_lines", { entry_id: entry.id, account_id: "a12", debit: vatAmount, credit: 0 });
        }
        await DB.insert("journal_lines", { entry_id: entry.id, account_id: "a5", debit: 0, credit: total });
        if (paid > 0) {
          await DB.insert("payments", {
            kind: "payment", party_type: "supplier", party_id: supId,
            amount: paid, method: "cash", date: document.getElementById("date").value,
            ref: purch.id, notes: "سداد فاتورة " + num,
          });
        }
        UI.toast("تم ترحيل فاتورة الشراء #" + num);
        ov.remove(); await load();
      } catch (err) { UI.toast(err.message || "خطأ", true); }
    };
  }

  async function load() {
    loadCompany();
    var d = await Promise.all([
      DB.list("purchases"), DB.list("suppliers"), DB.list("products"), DB.list("purchase_lines"),
    ]);
    purchases = d[0]; suppliers = d[1]; products = d[2]; lines = d[3];
    renderList();
  }

  document.getElementById("btn-add").onclick = createPurchase;
  document.getElementById("list").onclick = function (e) {
    var tr = e.target.closest("tr[data-id]");
    if (tr) showDetail(tr.getAttribute("data-id"));
  };
  await load();
})();
