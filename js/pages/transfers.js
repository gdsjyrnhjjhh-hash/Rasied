(async function () {
  var page = await UI.init("transfers");
  if (!page) return;
  var html = UI.html;
  var transfers = [], products = [], warehouses = [];

  page.innerHTML = html`
    <div class="stack">
      <div class="page-toolbar">
        <div>
          <h2 style="margin:0">تحويلات المخازن</h2>
          <p class="muted" style="margin:4px 0 0;font-size:12px">نقل كميات من مخزن إلى آخر</p>
        </div>
        <button type="button" class="primary" id="btn-add">+ تحويل</button>
      </div>
      <div class="card table-wrap" id="list"></div>
    </div>`;

  function whName(id) {
    var w = warehouses.filter(function (x) { return x.id === id; })[0];
    return w ? w.name : "—";
  }
  function prodName(id) {
    var p = products.filter(function (x) { return x.id === id; })[0];
    return p ? p.name : "—";
  }

  function render() {
    document.getElementById("list").innerHTML = html`
      <table>
        <thead><tr><th>رقم</th><th>من</th><th>إلى</th><th>التاريخ</th><th>ملاحظات</th></tr></thead>
        <tbody>
          ${transfers.map(function (t) {
            return html`<tr>
              <td><b>#${t.number}</b></td>
              <td>${whName(t.from_warehouse_id)}</td>
              <td>${whName(t.to_warehouse_id)}</td>
              <td dir="ltr">${t.date || ""}</td>
              <td class="muted">${t.notes || ""}</td>
            </tr>`;
          }).join("") || html`<tr><td colspan="5" class="empty">لا توجد تحويلات</td></tr>`}
        </tbody>
      </table>`;
  }

  async function createTransfer() {
    if (warehouses.length < 2 || !products.length) {
      UI.toast("يلزم مخزنان على الأقل وأصناف", true); return;
    }
    var ov = document.createElement("div");
    ov.className = "modal-overlay";
    var lineRows = [{ product_id: products[0].id, qty: 1 }];

    function renderLines() {
      return lineRows.map(function (lr, i) {
        return html`<div class="form-grid" data-li="${i}" style="margin-bottom:8px">
          <div class="field"><label>الصنف</label>
            <select class="lp">${products.map(function (p) {
              return html`<option value="${p.id}" ${p.id === lr.product_id ? "selected" : ""}>${p.name} (متاح: ${p.qty})</option>`;
            }).join("")}</select>
          </div>
          <div class="field"><label>الكمية</label><input class="lq" type="number" min="0.01" step="0.01" value="${lr.qty}"></div>
        </div>`;
      }).join("");
    }

    ov.innerHTML = html`<div class="modal card">
      <h3 style="margin-top:0">تحويل مخزني</h3>
      <form id="f" class="stack">
        <div class="form-grid">
          <div class="field"><label>من مخزن</label>
            <select id="from">${warehouses.map(function (w, i) {
              return html`<option value="${w.id}" ${i === 0 ? "selected" : ""}>${w.name}</option>`;
            }).join("")}</select>
          </div>
          <div class="field"><label>إلى مخزن</label>
            <select id="to">${warehouses.map(function (w, i) {
              return html`<option value="${w.id}" ${i === 1 ? "selected" : ""}>${w.name}</option>`;
            }).join("")}</select>
          </div>
          <div class="field"><label>التاريخ</label><input id="date" type="date" value="${new Date().toISOString().slice(0,10)}"></div>
          <div class="field full"><label>ملاحظات</label><input id="notes"></div>
        </div>
        <div id="lines">${renderLines()}</div>
        <button type="button" class="ghost small" id="add-line">+ صنف</button>
        <div class="row gap" style="justify-content:flex-end">
          <button type="button" class="ghost" id="cancel">إلغاء</button>
          <button class="primary" type="submit">تنفيذ التحويل</button>
        </div>
      </form>
    </div>`;
    document.body.appendChild(ov);
    ov.querySelector("#add-line").onclick = function () {
      lineRows.push({ product_id: products[0].id, qty: 1 });
      ov.querySelector("#lines").innerHTML = renderLines();
    };
    ov.querySelector("#cancel").onclick = function () { ov.remove(); };
    ov.onclick = function (e) { if (e.target === ov) ov.remove(); };

    ov.querySelector("#f").onsubmit = async function (e) {
      e.preventDefault();
      var fromId = document.getElementById("from").value;
      var toId = document.getElementById("to").value;
      if (fromId === toId) { UI.toast("اختر مخزنين مختلفين", true); return; }
      ov.querySelectorAll("[data-li]").forEach(function (row, i) {
        lineRows[i].product_id = row.querySelector(".lp").value;
        lineRows[i].qty = Number(row.querySelector(".lq").value) || 0;
      });
      try {
        // تحقق الكميات — نموذج مبسط: الكمية على مستوى الصنف الإجمالي
        for (var i = 0; i < lineRows.length; i++) {
          var lr = lineRows[i];
          var prod = products.filter(function (x) { return x.id === lr.product_id; })[0];
          if (!prod || (prod.qty || 0) < lr.qty) {
            UI.toast("كمية غير كافية: " + (prod ? prod.name : ""), true);
            return;
          }
        }
        var num = await DB.nextNumber("stock_transfers");
        var tr = await DB.insert("stock_transfers", {
          number: num, from_warehouse_id: fromId, to_warehouse_id: toId,
          date: document.getElementById("date").value,
          notes: document.getElementById("notes").value.trim(), status: "posted",
        });
        for (var j = 0; j < lineRows.length; j++) {
          var L = lineRows[j];
          await DB.insert("stock_transfer_lines", {
            transfer_id: tr.id, product_id: L.product_id, qty: L.qty,
          });
          // في النموذج الحالي الكمية مركزية على الصنف؛ نحدّث warehouse_id للوجهة عند النقل الكامل المبسط
          var p = products.filter(function (x) { return x.id === L.product_id; })[0];
          if (p) {
            // لا نخصم من الإجمالي لأن النقل داخلي — فقط ننقل ارتباط المخزن إذا الكمية كاملة
            if (L.qty >= (p.qty || 0)) {
              await DB.update("products", p.id, { warehouse_id: toId });
            }
          }
        }
        UI.toast("تم التحويل #" + num);
        ov.remove(); await load();
      } catch (err) { UI.toast(err.message, true); }
    };
  }

  async function load() {
    var d = await Promise.all([
      DB.list("stock_transfers"), DB.list("products"), DB.list("warehouses"),
    ]);
    transfers = d[0]; products = d[1]; warehouses = d[2];
    render();
  }

  document.getElementById("btn-add").onclick = createTransfer;
  await load();
})();
