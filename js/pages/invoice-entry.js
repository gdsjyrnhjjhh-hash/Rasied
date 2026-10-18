(async function () {
  var q = new URLSearchParams(location.search);
  var kind = Invoices.KINDS[q.get("kind")] ? q.get("kind") : "sale";
  var K = Invoices.KINDS[kind];
  var editId = q.get("id") || "";
  var page = await UI.init(K.page, { title: [editId ? "تعديل " + K.title : K.newTitle, K.plural] });
  if (!page) return;
  var html = UI.html, money = UI.money, esc = Ledger.esc;
  var N = function (x) { return Number(x) || 0; };
  var $ = function (id) { return document.getElementById(id); };
  var UNITS = ["قطعة", "كرتونة", "علبة", "كيلو", "جرام", "متر", "لتر", "شيكارة", "كيس", "جردل", "جركن", "برميل", "دستة", "طن"];

  var parties = [], products = [], reps = [], registers = [];
  var items = [], editIdx = -1, existing = null, oldLines = [], party = null, curProd = null;
  var company = Object.assign({ name: "الشركة", phone: "", address: "", tax_id: "" }, DB.getCompany());
  var vatRate = company.vat_rate != null ? N(company.vat_rate) : 14, vatOn = company.vat_enabled !== false;

  page.classList.remove("anim-stagger");
  page.innerHTML = html`
  <div class="inv-page stack" data-kind="${kind}">
    <div class="inv-head">
      <h2>${editId ? "تعديل " + K.title : K.newTitle} <span class="kind-chip">${K.sign < 0 ? "مرتجع" : K.title}</span></h2>
      <div class="row gap">
        <a class="button small" href="${K.listHref}">← ${K.plural}</a>
        <button type="button" class="small" id="b-new">جديد</button>
      </div>
    </div>
    <div class="inv-layout">
      <div class="inv-panel">
        <div class="card inv-card">
          <div class="inv-sec">بيانات ${K.sign < 0 ? "المرتجع" : "الفاتورة"}</div>
          <div class="form-grid">
            <div class="field"><label>الرقم <span class="auto-badge">${editId ? "ثابت" : "آلي"}</span></label><input id="f-num" disabled></div>
            <div class="field"><label>التاريخ *</label><input id="f-date" type="date"></div>
            <div class="field full sugg-wrap"><label>${K.plabel} * <button type="button" class="small ghost" id="b-newparty" style="margin-inline-start:6px;padding:0 8px;min-height:22px">+ جديد</button></label>
              <input id="f-party" placeholder="ابحث بالاسم أو الهاتف أو الكود..." autocomplete="off">
              <div class="sugg" id="sg-party"></div>
              <div class="party-note" id="party-note"></div>
            </div>
            <div class="field"><label>رقم الدفتر / المرجع <span class="opt">اختياري</span></label><input id="f-book" dir="ltr"></div>
            ${K.sign > 0 ? html`<div class="field"><label>${K.key === "sale" ? "المندوب" : "المسؤول"} <span class="opt">اختياري</span></label>
              <select id="f-rep"><option value="">— بدون —</option>${reps.map(function (r) { return html`<option value="${r.id}">${esc(r.name)}</option>`; }).join("")}</select></div>` : '<div class="field"><label>المسؤول <span class="opt">اختياري</span></label><select id="f-rep"><option value="">— بدون —</option></select></div>'}
            ${K.delivery ? html`<div class="field"><label>الناولون / مصاريف نقل <span class="opt">اختياري</span></label><input id="f-delivery" type="number" min="0" step="0.01" placeholder="0"></div>` : ""}
            <div class="field"><label>الخصم على ${K.sign < 0 ? "المرتجع" : "الفاتورة"} <span class="opt">اختياري</span></label><input id="f-discount" type="number" min="0" step="0.01" placeholder="0"></div>
            ${K.vatable ? html`<div class="field"><label>ض.ق.م</label><select id="f-vat"><option value="1">مفعّلة (${vatRate}%)</option><option value="0">بدون ضريبة</option></select></div>` : ""}
            <div class="field"><label>الموقع <span class="opt">اختياري</span></label><input id="f-loc" placeholder="موقع التسليم"></div>
            ${K.paidable ? html`<div class="field"><label>${K.payLabel}</label><input id="f-paid" type="number" min="0" step="0.01" placeholder="0"></div>
              <div class="field"><label>${K.key === "sale" ? "إلى خزينة" : "من خزينة"}</label><select id="f-reg"><option value="">بدون (آجل / بنك)</option>${registers.map(function (r) { return html`<option value="${r.id}">${esc(r.name)} (${money(r.balance)})</option>`; }).join("")}</select></div>` : ""}
            <div class="field full"><label>ملاحظات</label><input id="f-notes"></div>
          </div>

          <div class="inv-sec alt">إضافة منتج</div>
          <div class="form-grid">
            <div class="field full sugg-wrap"><label>المنتج *</label>
              <input id="p-name" placeholder="ابحث بالاسم أو الكود..." autocomplete="off">
              <div class="sugg" id="sg-prod"></div>
            </div>
            <div class="field"><label>الكمية *</label><input id="p-qty" type="number" min="0.01" step="0.01" placeholder="0"></div>
            <div class="field"><label>${K.priceLabel} <span class="opt">0 للهدايا</span></label><input id="p-price" type="number" min="0" step="0.01" placeholder="0"></div>
            <div class="field"><label>الوحدة</label><select id="p-unit"><option value="">—</option>${UNITS.map(function (u) { return "<option>" + u + "</option>"; }).join("")}</select></div>
            <div class="field"><label>المخزون المتاح</label><div style="padding-top:6px"><span class="stock-pill" id="p-stock">—</span></div></div>
            <div class="field full"><label>ملاحظة على البند <span class="opt">اختياري</span></label><input id="p-note" placeholder="لون / مقاس / ..."></div>
          </div>
          <div class="inv-actions-row">
            <button type="button" class="primary" id="b-add">+ إضافة المنتج</button>
            <button type="button" id="b-clr">تفريغ</button>
          </div>
        </div>
      </div>

      <div class="inv-panel">
        <div class="card inv-items">
          <div class="panel-title"><h3>المنتجات المضافة <span class="count-badge" id="cnt">0 منتج</span></h3></div>
          <div class="table-scroll"><table>
            <thead><tr><th>#</th><th>المنتج</th><th>الكمية</th><th>${K.priceLabel}</th><th>الإجمالي</th><th></th></tr></thead>
            <tbody id="items-body"></tbody>
          </table></div>
        </div>
        <div class="inv-bar">
          <div class="inv-totals" id="totals"></div>
          <div class="inv-btns">
            <button type="button" class="primary" id="b-save">${editId ? "حفظ التعديل" : "حفظ وترحيل"}</button>
            <button type="button" id="b-prev">معاينة</button>
            <button type="button" id="b-print">طباعة / PDF</button>
            <button type="button" class="danger" id="b-cancel">إلغاء</button>
          </div>
        </div>
      </div>
    </div>
  </div>`;

  /* ---------- اقتراحات ---------- */
  function suggest(input, box, getItems, onPick) {
    var hl = -1, cur = [];
    function draw() {
      cur = getItems((input.value || "").trim().toLowerCase());
      box.innerHTML = cur.length ? cur.map(function (it, i) {
        return '<div class="it' + (i === hl ? " hl" : "") + '" data-i="' + i + '"><span>' + esc(it.label) + "</span><small>" + esc(it.small || "") + "</small></div>";
      }).join("") : '<div class="none">لا توجد نتائج</div>';
      box.classList.add("open");
    }
    function pick(i) { if (cur[i]) { box.classList.remove("open"); onPick(cur[i]); } }
    input.addEventListener("input", function () { hl = -1; draw(); });
    input.addEventListener("focus", function () { hl = -1; draw(); });
    input.addEventListener("blur", function () { setTimeout(function () { box.classList.remove("open"); }, 150); });
    input.addEventListener("keydown", function (e) {
      if (!box.classList.contains("open")) return;
      if (e.key === "ArrowDown") { e.preventDefault(); hl = Math.min(hl + 1, cur.length - 1); draw(); }
      else if (e.key === "ArrowUp") { e.preventDefault(); hl = Math.max(hl - 1, 0); draw(); }
      else if (e.key === "Enter" && cur.length) { e.preventDefault(); pick(hl >= 0 ? hl : 0); }
      else if (e.key === "Escape") box.classList.remove("open");
    });
    box.addEventListener("mousedown", function (e) { var it = e.target.closest("[data-i]"); if (it) { e.preventDefault(); pick(Number(it.getAttribute("data-i"))); } });
  }

  function selectParty(p) {
    party = p; $("f-party").value = p ? p.name : "";
    var note = $("party-note");
    if (!p) { note.innerHTML = ""; return; }
    var bal = N(p.balance), lim = N(p.credit_limit);
    note.innerHTML = (p.phone ? '<span dir="ltr">' + esc(p.phone) + "</span>" : "") + "<span>الرصيد: <b>" + money(bal) + "</b></span>" +
      (lim > 0 ? "<span>حد الائتمان: <b>" + money(lim) + "</b></span>" : "") + (lim > 0 && bal > lim ? '<span class="warn">تجاوز الحد</span>' : "");
  }
  suggest($("f-party"), $("sg-party"), function (t) {
    return parties.filter(function (p) { return !t || (p.name + " " + (p.phone || "") + " " + (p.code || "")).toLowerCase().indexOf(t) !== -1; }).slice(0, 30)
      .map(function (p) { return { id: p.id, label: p.name, small: (p.phone || "") + (p.balance ? " · " + money(p.balance) : "") }; });
  }, function (it) { selectParty(parties.filter(function (p) { return p.id === it.id; })[0]); });
  $("f-party").addEventListener("input", function () { if (party && $("f-party").value !== party.name) { party = null; $("party-note").innerHTML = ""; } });

  function stockText(p) {
    var el = $("p-stock");
    if (!p) { el.textContent = "—"; el.className = "stock-pill"; return; }
    var s = N(p.qty);
    el.textContent = money(s) + (p.unit ? " " + p.unit : "");
    el.className = "stock-pill" + (s <= 0 ? " zero" : (N(p.min_qty) && s <= N(p.min_qty) ? " low" : ""));
  }
  function selectProduct(p) {
    curProd = p; $("p-name").value = p ? p.name : "";
    if (p) {
      $("p-price").value = K.price === "unit_cost" ? N(p.cost) : N(p.price);
      $("p-unit").value = UNITS.indexOf(p.unit) !== -1 ? p.unit : "";
      stockText(p); $("p-qty").focus(); $("p-qty").select();
    } else stockText(null);
  }
  suggest($("p-name"), $("sg-prod"), function (t) {
    return products.filter(function (p) { return !t || (p.name + " " + (p.sku || "")).toLowerCase().indexOf(t) !== -1; }).slice(0, 30)
      .map(function (p) { return { id: p.id, label: p.name, small: "متاح " + money(p.qty) + " · " + money(K.price === "unit_cost" ? p.cost : p.price) }; });
  }, function (it) { selectProduct(products.filter(function (p) { return p.id === it.id; })[0]); });
  $("p-name").addEventListener("input", function () { if (curProd && $("p-name").value !== curProd.name) { curProd = null; stockText(null); } });

  /* ---------- البنود والإجماليات ---------- */
  function formData() {
    return {
      party_id: party ? party.id : "", date: $("f-date").value, book_no: $("f-book").value.trim(), rep_id: $("f-rep") ? $("f-rep").value : "",
      location: $("f-loc").value.trim(), delivery: $("f-delivery") ? N($("f-delivery").value) : 0, discount: N($("f-discount").value),
      vat_rate: K.vatable && $("f-vat") && $("f-vat").value === "1" ? vatRate : 0,
      paid: $("f-paid") ? N($("f-paid").value) : 0, register_id: $("f-reg") ? $("f-reg").value : "", notes: $("f-notes").value.trim(),
      lines: items.map(function (i) { return { product_id: i.product_id, qty: i.qty, price: i.price, unit: i.unit, note: i.note }; }),
    };
  }
  function drawItems() {
    $("cnt").textContent = items.length + " منتج";
    $("items-body").innerHTML = items.length ? items.map(function (it, i) {
      return html`<tr class="${i === editIdx ? "editing" : ""}"><td>${i + 1}</td>
        <td><b>${it.name}</b>${it.note ? '<span class="note">' + esc(it.note) + "</span>" : ""}</td>
        <td>${money(it.qty)}${it.unit ? " " + it.unit : ""}</td><td>${money(it.price)}</td><td><b>${money(it.qty * it.price)}</b></td>
        <td><div class="actions-cell"><button type="button" class="small" data-edit="${i}">تعديل</button><button type="button" class="small danger" data-del="${i}">حذف</button></div></td></tr>`;
    }).join("") : '<tr><td colspan="6"><div class="inv-empty"><b>لا توجد منتجات مضافة</b>أضف منتجًا من النموذج</div></td></tr>';
    drawTotals();
  }
  function drawTotals() {
    var d = formData(), c = Invoices.compute(kind, d);
    var t = '<div class="inv-tot"><div class="l">إجمالي البنود</div><div class="v">' + money(c.gross) + "</div></div>";
    if (K.delivery) t += '<div class="inv-tot"><div class="l">الناولون</div><div class="v">' + money(c.delivery) + "</div></div>";
    t += '<div class="inv-tot red"><div class="l">الخصم</div><div class="v">' + money(c.discount) + "</div></div>";
    if (K.vatable) t += '<div class="inv-tot"><div class="l">الضريبة</div><div class="v">' + money(c.vat) + "</div></div>";
    t += '<div class="inv-tot' + (K.paidable ? "" : " net") + '"><div class="l">الإجمالي</div><div class="v">' + money(c.total) + "</div></div>";
    if (K.paidable) {
      t += '<div class="inv-tot"><div class="l">المدفوع</div><div class="v">' + money(c.paid) + "</div></div>";
      t += '<div class="inv-tot net"><div class="l">المتبقي</div><div class="v">' + money(c.remaining) + "</div></div>";
    }
    $("totals").innerHTML = t;
  }
  ["f-discount", "f-delivery", "f-vat", "f-paid"].forEach(function (id) { if ($(id)) { $(id).addEventListener("input", drawTotals); $(id).addEventListener("change", drawTotals); } });

  function clearProduct() {
    curProd = null; editIdx = -1; ["p-name", "p-qty", "p-price", "p-note"].forEach(function (id) { $(id).value = ""; }); $("p-unit").value = ""; stockText(null);
    $("b-add").textContent = "+ إضافة المنتج"; drawItems();
  }
  function addItem() {
    if (!curProd) { UI.toast("اختر المنتج من القائمة", true); $("p-name").focus(); return; }
    var qty = N($("p-qty").value), price = N($("p-price").value);
    if (qty <= 0) { UI.toast("اكتب كمية صحيحة", true); $("p-qty").focus(); return; }
    if (price < 0) { UI.toast("السعر غير صحيح", true); return; }
    var it = { product_id: curProd.id, name: curProd.name, qty: qty, price: price, unit: $("p-unit").value, note: $("p-note").value.trim() };
    if (editIdx >= 0) items[editIdx] = it; else items.push(it);
    clearProduct(); $("p-name").focus();
  }
  $("b-add").onclick = addItem;
  $("b-clr").onclick = clearProduct;
  $("p-qty").addEventListener("keydown", function (e) { if (e.key === "Enter") { e.preventDefault(); $("p-price").focus(); $("p-price").select(); } });
  $("p-price").addEventListener("keydown", function (e) { if (e.key === "Enter") { e.preventDefault(); addItem(); } });
  $("items-body").onclick = function (e) {
    var b = e.target.closest("button"); if (!b) return;
    if (b.hasAttribute("data-del")) { items.splice(Number(b.getAttribute("data-del")), 1); if (editIdx >= 0) clearProduct(); else drawItems(); }
    if (b.hasAttribute("data-edit")) {
      editIdx = Number(b.getAttribute("data-edit")); var it = items[editIdx];
      curProd = products.filter(function (p) { return p.id === it.product_id; })[0] || { id: it.product_id, name: it.name };
      $("p-name").value = it.name; $("p-qty").value = it.qty; $("p-price").value = it.price; $("p-unit").value = it.unit || ""; $("p-note").value = it.note || "";
      stockText(curProd); $("b-add").textContent = "حفظ تعديل البند"; drawItems(); $("p-qty").focus();
    }
  };

  /* ---------- طرف جديد سريع ---------- */
  $("b-newparty").onclick = function () {
    Ledger.modal((K.ptype === "customer" ? "عميل جديد" : "مورد جديد"), html`
      <div class="form-grid"><div class="field"><label>الاسم</label><input id="np-n" required></div>
      <div class="field"><label>الهاتف</label><input id="np-p" dir="ltr"></div>
      <div class="field"><label>رصيد افتتاحي</label><input id="np-o" type="number" step="0.01" value="0"></div></div>`, async function (ov) {
      var ob = N(Ledger.val("np-o"));
      var rec = await DB.insert(K.party, { name: Ledger.val("np-n").trim(), phone: Ledger.val("np-p").trim(), notes: "", opening_balance: ob, balance: ob, credit_limit: 0 });
      parties.unshift(rec); selectParty(rec); ov.remove(); UI.toast("تمت الإضافة");
    });
  };

  /* ---------- حفظ / معاينة / إلغاء ---------- */
  function stockWarnings(d) {
    if (K.stock >= 0) return [];
    var need = {}, out = [];
    d.lines.forEach(function (l) { need[l.product_id] = (need[l.product_id] || 0) + N(l.qty); });
    oldLines.forEach(function (l) { /* الكمية المحجوزة سابقًا تعود للمخزون عند التعديل */ if (need[l.product_id] != null) need[l.product_id] -= 0; });
    Object.keys(need).forEach(function (pid) {
      var p = products.filter(function (x) { return x.id === pid; })[0]; if (!p) return;
      var back = oldLines.filter(function (l) { return l.product_id === pid; }).reduce(function (s, l) { return s + N(l.qty); }, 0);
      if (need[pid] > N(p.qty) + back + 0.0001) out.push(p.name + " (متاح " + money(N(p.qty) + back) + " والمطلوب " + money(need[pid]) + ")");
    });
    return out;
  }
  async function save() {
    var d = formData();
    if (!d.party_id) { UI.toast("اختر " + K.plabel, true); $("f-party").focus(); return; }
    if (!d.lines.length) { UI.toast("أضف منتجًا واحدًا على الأقل", true); return; }
    var warn = stockWarnings(d);
    if (warn.length && !confirm("الكمية المطلوبة أكبر من المخزون:\n- " + warn.join("\n- ") + "\n\nمتابعة؟")) return;
    var c = Invoices.compute(kind, d);
    if (K.key === "sale" && N(party.credit_limit) > 0) {
      var cur = N(party.balance) - (existing ? Invoices.effect(kind, existing) : 0);
      if (cur + c.remaining > N(party.credit_limit) && !confirm("هذه الفاتورة تتجاوز حد ائتمان العميل (" + money(party.credit_limit) + "). متابعة؟")) return;
    }
    var btn = $("b-save"); btn.disabled = true;
    try {
      var res = await Invoices.save(kind, d, existing);
      UI.toast("تم حفظ " + K.title + " #" + res.number);
      if (existing) { location.href = K.listHref; return; }
      await reset();
    } catch (err) { UI.toast(err.message || "خطأ", true); }
    btn.disabled = false;
  }
  $("b-save").onclick = save;

  function previewHtml() {
    var d = formData(), c = Invoices.compute(kind, d);
    var doc = { number: $("f-num").value, date: d.date, book_no: d.book_no, location: d.location, notes: d.notes, gross: c.gross, discount: c.discount, vat_rate: c.vat_rate, vat_amount: c.vat, delivery: c.delivery, total: c.total, paid: c.paid };
    var lines = d.lines.map(function (l) { var o = { product_id: l.product_id, qty: l.qty, unit: l.unit, note: l.note }; o[K.price] = l.price; return o; });
    return Invoices.printBody(kind, doc, lines, party, products, company);
  }
  $("b-prev").onclick = function () {
    if (!items.length) { UI.toast("أضف منتجًا للمعاينة", true); return; }
    var ov = document.createElement("div"); ov.className = "preview-overlay inv-page"; ov.setAttribute("data-kind", kind);
    ov.innerHTML = '<div class="preview-sheet">' + previewHtml() + '</div><div class="preview-actions"><button type="button" class="primary" id="pv-print">طباعة / PDF</button><button type="button" id="pv-close">إغلاق</button></div>';
    document.body.appendChild(ov);
    ov.querySelector("#pv-close").onclick = function () { ov.remove(); };
    ov.querySelector("#pv-print").onclick = function () { UI.printHTML(K.title, previewHtml()); };
    ov.onclick = function (e) { if (e.target === ov) ov.remove(); };
  };
  $("b-print").onclick = function () { if (!items.length) { UI.toast("أضف منتجًا أولًا", true); return; } UI.printHTML(K.title, previewHtml()); };
  $("b-cancel").onclick = function () {
    if (existing) { location.href = K.listHref; return; }
    if ((items.length || party) && !confirm("تفريغ كل البيانات؟")) return;
    reset();
  };
  $("b-new").onclick = function () { if (existing) location.href = "invoice.html?kind=" + kind; else $("b-cancel").click(); };

  async function reset() {
    items = []; editIdx = -1; party = null; curProd = null; existing = null; oldLines = [];
    ["f-party", "f-book", "f-loc", "f-notes", "f-delivery", "f-discount", "f-paid", "p-name", "p-qty", "p-price", "p-note"].forEach(function (id) { if ($(id)) $(id).value = ""; });
    ["f-rep", "f-reg", "p-unit"].forEach(function (id) { if ($(id)) $(id).value = ""; });
    if ($("f-vat")) $("f-vat").value = vatOn ? "1" : "0";
    $("f-date").value = Ledger.today(); $("party-note").innerHTML = ""; stockText(null);
    var d = await Promise.all([DB.list(K.party), DB.list("products"), DB.list("cash_registers"), DB.nextNumber(K.seq)]);
    parties = d[0]; products = d[1]; registers = d[2]; $("f-num").value = d[3];
    if ($("f-reg")) $("f-reg").innerHTML = '<option value="">بدون (آجل / بنك)</option>' + registers.map(function (r) { return '<option value="' + r.id + '">' + esc(r.name) + " (" + money(r.balance) + ")</option>"; }).join("");
    $("b-add").textContent = "+ إضافة المنتج"; drawItems(); $("f-party").focus();
  }

  /* ---------- تحميل أولي ---------- */
  var d0 = await Promise.all([DB.list(K.party), DB.list("products"), DB.list("employees"), DB.list("cash_registers")]);
  parties = d0[0]; products = d0[1]; reps = d0[2].filter(function (e) { return e.status !== "inactive"; }); registers = d0[3];
  if ($("f-rep") && K.sign > 0) $("f-rep").innerHTML = '<option value="">— بدون —</option>' + reps.map(function (r) { return '<option value="' + r.id + '">' + esc(r.name) + "</option>"; }).join("");
  if ($("f-reg")) $("f-reg").innerHTML = '<option value="">بدون (آجل / بنك)</option>' + registers.map(function (r) { return '<option value="' + r.id + '">' + esc(r.name) + " (" + money(r.balance) + ")</option>"; }).join("");
  $("f-date").value = Ledger.today();
  if ($("f-vat")) $("f-vat").value = vatOn ? "1" : "0";

  if (editId) {
    var ld = await Invoices.load(kind, editId);
    if (!ld) { UI.toast("المستند غير موجود", true); setTimeout(function () { location.href = K.listHref; }, 800); return; }
    existing = ld.doc; oldLines = ld.lines;
    $("f-num").value = existing.number; $("f-date").value = existing.date || Ledger.today();
    selectParty(parties.filter(function (p) { return p.id === existing[K.pkey]; })[0] || null);
    $("f-book").value = existing.book_no || ""; $("f-loc").value = existing.location || ""; $("f-notes").value = existing.notes || "";
    if ($("f-rep")) $("f-rep").value = existing.rep_id || "";
    if ($("f-delivery")) $("f-delivery").value = existing.delivery || "";
    $("f-discount").value = existing.discount || "";
    if ($("f-vat")) $("f-vat").value = N(existing.vat_rate) > 0 ? "1" : "0";
    if ($("f-paid")) $("f-paid").value = existing.paid || "";
    if ($("f-reg")) $("f-reg").value = existing.register_id || "";
    items = ld.lines.map(function (l) {
      var p = products.filter(function (x) { return x.id === l.product_id; })[0];
      return { product_id: l.product_id, name: p ? p.name : "—", qty: N(l.qty), price: N(l[K.price]), unit: l.unit || "", note: l.note || "" };
    });
  } else {
    $("f-num").value = await DB.nextNumber(K.seq);
  }
  drawItems();
  setTimeout(function () { if (!editId) $("f-party").focus(); }, 50);
})();
