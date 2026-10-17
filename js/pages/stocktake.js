(async function () {
  var page = await UI.init("stocktake");
  if (!page) return;
  var html = UI.html, money = UI.money;
  var products = [], warehouses = [], stocktakes = [];

  page.innerHTML = html`
    <div class="stack">
      <div class="row between wrap gap">
        <h2 class="page-title" style="margin:0">الجرد المخزني</h2>
        <button type="button" class="primary" id="btn-add">+ جرد جديد</button>
      </div>
      <p class="muted" style="margin:0">سجّل الكمية الفعلية لكل صنف. الفرق يُسوّى تلقائياً في المخزون مع قيد تسوية.</p>
      <div class="card table-wrap" id="list"></div>
    </div>`;

  function render() {
    document.getElementById("list").innerHTML = html`
      <table>
        <thead><tr><th>رقم</th><th>التاريخ</th><th>ملاحظات</th><th>عدد الأصناف</th></tr></thead>
        <tbody>
          ${stocktakes.length === 0 ? html`<tr><td colspan="4" class="empty">لا توجد عمليات جرد</td></tr>` :
            stocktakes.map(function (s) {
              return html`<tr>
                <td><b>#${s.number}</b></td>
                <td dir="ltr">${s.date || ""}</td>
                <td>${s.notes || "—"}</td>
                <td>${s.lines_count || "—"}</td>
              </tr>`;
            }).join("")}
        </tbody>
      </table>`;
  }

  async function createStocktake() {
    if (!products.length) { UI.toast("لا توجد أصناف", true); return; }
    var ov = document.createElement("div");
    ov.className = "modal-overlay";
    ov.innerHTML = html`<div class="modal card" style="max-width:800px">
      <h3 style="margin-top:0">جرد مخزني</h3>
      <form id="f" class="stack">
        <div class="form-grid">
          <div class="field"><label>التاريخ</label><input id="date" type="date" value="${new Date().toISOString().slice(0,10)}"></div>
          <div class="field full"><label>ملاحظات</label><input id="notes" placeholder="جرد دوري..."></div>
        </div>
        <div class="table-wrap">
          <table>
            <thead><tr><th>الصنف</th><th>الكمية الدفترية</th><th>الكمية الفعلية</th></tr></thead>
            <tbody>
              ${products.map(function (p) {
                return html`<tr data-pid="${p.id}">
                  <td>${p.name}</td>
                  <td>${p.qty}</td>
                  <td><input class="act" type="number" step="0.01" value="${p.qty}" style="width:100px"></td>
                </tr>`;
              }).join("")}
            </tbody>
          </table>
        </div>
        <div class="row gap" style="justify-content:flex-end">
          <button type="button" class="ghost" id="cancel">إلغاء</button>
          <button class="primary" type="submit">ترحيل التسوية</button>
        </div>
      </form>
    </div>`;
    document.body.appendChild(ov);
    ov.querySelector("#cancel").onclick = function () { ov.remove(); };
    ov.onclick = function (e) { if (e.target === ov) ov.remove(); };

    ov.querySelector("#f").onsubmit = async function (e) {
      e.preventDefault();
      try {
        var num = await DB.nextNumber("stocktakes");
        var adjustments = [];
        ov.querySelectorAll("tr[data-pid]").forEach(function (tr) {
          var pid = tr.getAttribute("data-pid");
          var prod = products.filter(function (x) { return x.id === pid; })[0];
          var actual = Number(tr.querySelector(".act").value);
          if (!prod || isNaN(actual)) return;
          var diff = actual - (prod.qty || 0);
          if (diff !== 0) adjustments.push({ product: prod, actual: actual, diff: diff });
        });
        var st = await DB.insert("stocktakes", {
          number: num, date: document.getElementById("date").value,
          notes: document.getElementById("notes").value.trim(),
          lines_count: adjustments.length, status: "posted",
        });
        var totalValue = 0;
        for (var i = 0; i < adjustments.length; i++) {
          var a = adjustments[i];
          await DB.insert("stocktake_lines", {
            stocktake_id: st.id, product_id: a.product.id,
            book_qty: a.product.qty, actual_qty: a.actual, diff: a.diff,
          });
          await DB.update("products", a.product.id, { qty: a.actual });
          totalValue += a.diff * (Number(a.product.cost) || 0);
        }
        if (adjustments.length && totalValue !== 0) {
          var jn = await DB.nextNumber("journal_entries");
          var entry = await DB.insert("journal_entries", {
            number: jn, date: document.getElementById("date").value,
            memo: "تسوية جرد #" + num, source: "stocktake", source_id: st.id,
          });
          if (totalValue > 0) {
            await DB.insert("journal_lines", { entry_id: entry.id, account_id: "a4", debit: totalValue, credit: 0 });
            await DB.insert("journal_lines", { entry_id: entry.id, account_id: "a10", debit: 0, credit: totalValue });
          } else {
            var abs = Math.abs(totalValue);
            await DB.insert("journal_lines", { entry_id: entry.id, account_id: "a10", debit: abs, credit: 0 });
            await DB.insert("journal_lines", { entry_id: entry.id, account_id: "a4", debit: 0, credit: abs });
          }
        }
        UI.toast("تم ترحيل الجرد #" + num + " (" + adjustments.length + " تسوية)");
        ov.remove(); await load();
      } catch (err) { UI.toast(err.message, true); }
    };
  }

  async function load() {
    var d = await Promise.all([DB.list("products"), DB.list("warehouses"), DB.list("stocktakes")]);
    products = d[0]; warehouses = d[1]; stocktakes = d[2];
    render();
  }

  document.getElementById("btn-add").onclick = createStocktake;
  await load();
})();
