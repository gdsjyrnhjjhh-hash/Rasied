(async function () {
  var page = await UI.init("price-lists");
  if (!page) return;
  var html = UI.html, money = UI.money, esc = Ledger.esc, val = Ledger.val;
  var N = function (v) { return Number(v) || 0; };
  var lists = [], items = [], products = [], customers = [];

  page.innerHTML = html`
    <div class="stack">
      <div class="page-toolbar">
        <div>
          <h2 style="margin:0">قوائم الأسعار</h2>
          <p class="muted" style="margin:4px 0 0;font-size:12px">جملة · نصف جملة · قطاعي · أسعار خاصة — تُربط بالعميل وتُطبَّق تلقائيًا في فاتورة البيع وعرض السعر</p>
        </div>
        <button type="button" class="primary" id="btn-add">+ قائمة أسعار</button>
      </div>
      <div class="card muted" style="font-size:13px;line-height:1.8">
        لكل قائمة <b>نسبة تعديل</b> على السعر الأساسي للصنف (مثلًا -10% للجملة)، ويمكنك تحديد <b>سعر خاص</b> لأصناف بعينها يتغلب على النسبة.
        بعد إنشاء القائمة اختَرها من بيانات العميل (العملاء ← تعديل ← «قائمة الأسعار»).
      </div>
      <div class="card table-wrap" id="list"></div>
    </div>`;

  function render() {
    document.getElementById("list").innerHTML = html`
      <table><thead><tr><th>القائمة</th><th>التعديل على الأساسي</th><th>أسعار خاصة</th><th>العملاء</th><th>الحالة</th><th></th></tr></thead>
      <tbody>${lists.length === 0 ? html`<tr><td colspan="6" class="empty">لا توجد قوائم — اضغط «+ قائمة أسعار» (مثال: جملة -10%)</td></tr>` : lists.map(function (l) {
        var pct = N(l.adjust_pct);
        var cnt = items.filter(function (i) { return i.price_list_id === l.id; }).length;
        var cc = customers.filter(function (c) { return c.price_list_id === l.id; }).length;
        return html`<tr data-id="${l.id}"><td><b>${esc(l.name)}</b>${l.notes ? html`<div class="muted" style="font-size:12px">${esc(l.notes)}</div>` : ""}</td>
          <td dir="ltr">${pct === 0 ? "0%" : (pct > 0 ? "+" : "") + pct + "%"}</td><td>${cnt}</td><td>${cc}</td>
          <td><span class="badge ${l.active === false ? "" : "ok"}">${l.active === false ? "موقوفة" : "نشطة"}</span></td>
          <td class="nw"><button type="button" class="sm primary" data-act="prices">أسعار الأصناف</button> <button type="button" class="ghost sm" data-act="edit">تعديل</button> <button type="button" class="ghost sm danger" data-act="del">حذف</button></td></tr>`; }).join("")}</tbody></table>`;
  }

  function openForm(ex) {
    var l = ex || { name: "", adjust_pct: 0, notes: "", active: true };
    Ledger.modal(ex ? "تعديل قائمة أسعار" : "قائمة أسعار جديدة", html`
      <div class="form-grid">
        <div class="field full"><label>اسم القائمة</label><input id="pl-name" required value="${esc(l.name)}" placeholder="مثال: جملة"></div>
        <div class="field"><label>نسبة التعديل % <span class="opt">سالب = خصم، موجب = زيادة</span></label><input id="pl-pct" type="number" step="0.01" value="${N(l.adjust_pct)}"></div>
        <div class="field"><label>الحالة</label><select id="pl-active"><option value="1" ${l.active === false ? "" : "selected"}>نشطة</option><option value="0" ${l.active === false ? "selected" : ""}>موقوفة</option></select></div>
        <div class="field full"><label>ملاحظات <span class="opt">اختياري</span></label><input id="pl-notes" value="${esc(l.notes || "")}"></div>
      </div>`, async function (ov) {
      var name = val("pl-name").trim(); if (!name) throw new Error("اكتب اسم القائمة");
      if (lists.some(function (x) { return x.name === name && (!ex || x.id !== ex.id); })) throw new Error("يوجد قائمة بنفس الاسم");
      var pct = N(val("pl-pct")); if (pct <= -100 || pct > 1000) throw new Error("نسبة التعديل غير منطقية");
      var data = { name: name, adjust_pct: pct, notes: val("pl-notes").trim(), active: val("pl-active") === "1" };
      if (ex) { DB.assertCan("edit"); await DB.update("price_lists", ex.id, data); } else await DB.insert("price_lists", data);
      UI.toast("تم الحفظ"); ov.remove(); await load();
    });
  }

  // سعر كل صنف في القائمة: الخاص إن وُجد وإلا الأساسي بعد النسبة
  function openPrices(l) {
    var pct = N(l.adjust_pct), mine = items.filter(function (i) { return i.price_list_id === l.id; }), over = {};
    mine.forEach(function (i) { over[i.product_id] = i; });
    var ov = document.createElement("div"); ov.className = "modal-overlay";
    ov.innerHTML = '<div class="modal card" style="max-width:820px;width:96vw;max-height:92vh;overflow:auto"><h3 style="margin-top:0">أسعار الأصناف — ' + esc(l.name) + ' (' + (pct > 0 ? "+" : "") + pct + '%)</h3>' +
      '<p class="muted" style="margin:0 0 8px;font-size:12px">اترك «السعر الخاص» فارغًا لتطبيق النسبة تلقائيًا.</p>' +
      '<div class="field"><input id="pp-q" placeholder="بحث عن صنف..."></div>' +
      '<div class="table-scroll" style="max-height:55vh;overflow:auto"><table><thead><tr><th>الصنف</th><th>السعر الأساسي</th><th>سعر القائمة</th><th>سعر خاص</th></tr></thead><tbody id="pp-body"></tbody></table></div>' +
      '<div class="row gap" style="justify-content:flex-end;margin-top:12px"><button type="button" class="ghost" id="pp-cancel">إلغاء</button><button type="button" class="primary" id="pp-save">حفظ الأسعار</button></div></div>';
    document.body.appendChild(ov);
    var edits = {}; // product_id -> raw string typed
    function draw() {
      var q = ov.querySelector("#pp-q").value.trim().toLowerCase();
      var rows = products.filter(function (p) { return !q || (p.name + " " + (p.sku || "") + " " + (p.barcode || "")).toLowerCase().indexOf(q) !== -1; }).slice(0, 300);
      ov.querySelector("#pp-body").innerHTML = rows.map(function (p) {
        var cur = edits[p.id] != null ? edits[p.id] : (over[p.id] ? String(over[p.id].price) : "");
        return '<tr data-p="' + esc(p.id) + '"><td>' + esc(p.name) + '</td><td>' + money(p.price) + "</td><td>" + money(Ledger.priceWith({ pct: pct, over: {} }, p)) +
          '</td><td><input type="number" min="0" step="0.01" style="width:110px" value="' + esc(cur) + '"></td></tr>';
      }).join("") || '<tr><td colspan="4" class="empty">لا توجد أصناف</td></tr>';
    }
    draw();
    ov.querySelector("#pp-q").oninput = draw;
    ov.querySelector("#pp-body").addEventListener("input", function (e) { var tr = e.target.closest("tr[data-p]"); if (tr) edits[tr.getAttribute("data-p")] = e.target.value; });
    ov.querySelector("#pp-cancel").onclick = function () { ov.remove(); };
    ov.querySelector("#pp-save").onclick = async function () {
      var btn = this; btn.disabled = true;
      try {
        var add = [], upd = [], del = [];
        Object.keys(edits).forEach(function (pid) {
          var raw = String(edits[pid]).trim(), had = over[pid];
          if (raw === "") { if (had) del.push(had.id); return; }
          var price = N(raw); if (price < 0) throw new Error("سعر غير صحيح");
          if (had) { if (N(had.price) !== price) upd.push({ id: had.id, price: price }); }
          else add.push({ table: "price_list_items", row: { price_list_id: l.id, product_id: pid, price: price } });
        });
        if (add.length) await DB.insertRows(add);
        for (var i = 0; i < upd.length; i++) await DB.update("price_list_items", upd[i].id, { price: upd[i].price });
        if (del.length) await DB.removeMany("price_list_items", del);
        UI.toast("تم حفظ الأسعار (" + (add.length + upd.length) + " تعديل" + (del.length ? "، " + del.length + " حذف" : "") + ")");
        ov.remove(); await load();
      } catch (err) { UI.toast(err.message, true); btn.disabled = false; }
    };
  }

  async function del(l) {
    DB.assertCan("delete");
    var cc = customers.filter(function (c) { return c.price_list_id === l.id; });
    if (!confirm("حذف قائمة «" + l.name + "»؟" + (cc.length ? "\nسيعود " + cc.length + " عميل للأسعار الأساسية." : ""))) return;
    for (var i = 0; i < cc.length; i++) await DB.update("customers", cc[i].id, { price_list_id: "" });
    await DB.removeMany("price_list_items", items.filter(function (it) { return it.price_list_id === l.id; }).map(function (it) { return it.id; }));
    await DB.remove("price_lists", l.id);
    UI.toast("تم الحذف"); await load();
  }

  async function load() {
    DB.refresh();
    var d = await Promise.all([DB.list("price_lists"), DB.list("price_list_items"), DB.list("products"), DB.list("customers")]);
    lists = d[0] || []; items = d[1] || []; products = d[2] || []; customers = d[3] || [];
    render();
  }
  document.getElementById("list").onclick = async function (e) {
    var b = e.target.closest("[data-act]"); if (!b) return;
    var l = lists.filter(function (x) { return x.id === b.closest("tr").getAttribute("data-id"); })[0]; if (!l) return;
    var act = b.getAttribute("data-act");
    try {
      if (act === "prices") openPrices(l); else if (act === "edit") openForm(l); else if (act === "del") await del(l);
    } catch (err) { UI.toast(err.message, true); }
  };
  document.getElementById("btn-add").onclick = function () { openForm(); };
  try { await load(); } catch (err) { document.getElementById("list").innerHTML = '<div class="empty">تعذّر التحميل: ' + esc(err.message) + "</div>"; }
})();
