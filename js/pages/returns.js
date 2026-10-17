(async function () {
  var page = await UI.init("returns");
  if (!page) return;
  var html = UI.html, money = UI.money;
  var returns = [], customers = [], products = [], rlines = [];

  page.innerHTML = html`
    <div class="stack">
      <div class="row between wrap gap">
        <h2 class="page-title" style="margin:0">مردودات البيع</h2>
        <button type="button" class="primary" id="btn-add">+ مردود بيع</button>
      </div>
      <div class="card table-wrap" id="list"></div>
    </div>`;

  function custName(id) {
    var c = customers.filter(function (x) { return x.id === id; })[0];
    return c ? c.name : "—";
  }
  function prodName(id) {
    var p = products.filter(function (x) { return x.id === id; })[0];
    return p ? p.name : "—";
  }

  function render() {
    document.getElementById("list").innerHTML = html`
      <table>
        <thead><tr><th>رقم</th><th>العميل</th><th>الإجمالي</th><th>التاريخ</th><th>ملاحظات</th></tr></thead>
        <tbody>
          ${returns.length === 0 ? html`<tr><td colspan="5" class="empty">لا توجد مردودات</td></tr>` :
            returns.map(function (r) {
              return html`<tr>
                <td><b>#${r.number}</b></td>
                <td>${custName(r.customer_id)}</td>
                <td>${money(r.total)}</td>
                <td dir="ltr">${r.date || ""}</td>
                <td class="muted">${r.notes || ""}</td>
              </tr>`;
            }).join("")}
        </tbody>
      </table>`;
  }

  async function createReturn() {
    if (!customers.length || !products.length) { UI.toast("أضف بيانات أولاً", true); return; }
    var ov = document.createElement("div");
    ov.className = "modal-overlay";
    var lineRows = [{ product_id: products[0].id, qty: 1, unit_price: products[0].price }];

    function renderLines() {
      return lineRows.map(function (lr, i) {
        return html`<div class="form-grid" data-li="${i}" style="margin-bottom:8px">
          <div class="field"><label>الصنف</label>
            <select class="lp">${products.map(function (p) {
              return html`<option value="${p.id}" ${p.id === lr.product_id ? "selected" : ""}>${p.name}</option>`;
            }).join("")}</select>
          </div>
          <div class="field"><label>الكمية</label><input class="lq" type="number" min="0.01" step="0.01" value="${lr.qty}"></div>
          <div class="field"><label>السعر</label><input class="lpr" type="number" step="0.01" value="${lr.unit_price}"></div>
        </div>`;
      }).join("");
    }

    ov.innerHTML = html`<div class="modal card">
      <h3 style="margin-top:0">مردود بيع</h3>
      <form id="f" class="stack">
        <div class="form-grid">
          <div class="field"><label>العميل</label>
            <select id="cust">${customers.map(function (c) {
              return html`<option value="${c.id}">${c.name}</option>`;
            }).join("")}</select>
          </div>
          <div class="field"><label>التاريخ</label><input id="date" type="date" value="${new Date().toISOString().slice(0,10)}"></div>
          <div class="field full"><label>ملاحظات</label><input id="notes"></div>
        </div>
        <div id="lines">${renderLines()}</div>
        <button type="button" class="ghost small" id="add-line">+ بند</button>
        <div class="row gap" style="justify-content:flex-end">
          <button type="button" class="ghost" id="cancel">إلغاء</button>
          <button class="primary" type="submit">حفظ</button>
        </div>
      </form>
    </div>`;
    document.body.appendChild(ov);
    ov.querySelector("#add-line").onclick = function () {
      lineRows.push({ product_id: products[0].id, qty: 1, unit_price: products[0].price });
      ov.querySelector("#lines").innerHTML = renderLines();
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
      var total = lineRows.reduce(function (s, l) { return s + l.qty * l.unit_price; }, 0);
      var custId = document.getElementById("cust").value;
      try {
        var num = await DB.nextNumber("sale_returns");
        var ret = await DB.insert("sale_returns", {
          number: num, customer_id: custId, date: document.getElementById("date").value,
          total: total, notes: document.getElementById("notes").value.trim(), status: "posted",
        });
        for (var i = 0; i < lineRows.length; i++) {
          var lr = lineRows[i];
          await DB.insert("sale_return_lines", {
            return_id: ret.id, product_id: lr.product_id, qty: lr.qty, unit_price: lr.unit_price,
          });
          var prod = products.filter(function (x) { return x.id === lr.product_id; })[0];
          if (prod) await DB.update("products", prod.id, { qty: (prod.qty || 0) + lr.qty });
        }
        var cust = customers.filter(function (x) { return x.id === custId; })[0];
        if (cust) await DB.update("customers", cust.id, { balance: Math.max(0, (Number(cust.balance) || 0) - total) });
        var jn = await DB.nextNumber("journal_entries");
        var entry = await DB.insert("journal_entries", {
          number: jn, date: document.getElementById("date").value,
          memo: "مردود مبيعات #" + num, source: "sale_return", source_id: ret.id,
        });
        await DB.insert("journal_lines", { entry_id: entry.id, account_id: "a8", debit: total, credit: 0 });
        await DB.insert("journal_lines", { entry_id: entry.id, account_id: "a3", debit: 0, credit: total });
        UI.toast("تم تسجيل المردود #" + num);
        ov.remove(); await load();
      } catch (err) { UI.toast(err.message, true); }
    };
  }

  async function load() {
    var d = await Promise.all([
      DB.list("sale_returns"), DB.list("customers"), DB.list("products"), DB.list("sale_return_lines"),
    ]);
    returns = d[0]; customers = d[1]; products = d[2]; rlines = d[3];
    render();
  }

  document.getElementById("btn-add").onclick = createReturn;
  await load();
})();
