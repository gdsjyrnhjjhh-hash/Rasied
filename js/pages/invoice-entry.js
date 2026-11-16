/* شاشة إدخال الفاتورة/المرتجع — مُعاد بناؤها: مضغوطة، تتسع في الشاشة (الجدول وحده يتمرر)، وتعديل مباشر للبنود.
   تخدم: فاتورة بيع / شراء / مردود بيع / مردود شراء (Invoices.KINDS). */
(async function () {
  var q = new URLSearchParams(location.search);
  var kind = Invoices.KINDS[q.get("kind")] ? q.get("kind") : "sale";
  var K = Invoices.KINDS[kind];
  var editId = q.get("id") || "";
  var quoteId = kind === "sale" ? (q.get("quote") || "") : "", quoteRec = null;      // تحويل عرض سعر إلى فاتورة
  var page = await UI.init(K.page, { title: [editId ? "تعديل " + K.title : K.newTitle, K.plural] });
  if (!page) return;
  var html = UI.html, money = UI.money, esc = Ledger.esc;
  var N = function (x) { return Number(x) || 0; };
  var r2 = function (v) { return Math.round(v * 100) / 100; };
  var $ = function (id) { return document.getElementById(id); };
  var UNITS = ["قطعة", "كرتونة", "علبة", "كيلو", "جرام", "متر", "لتر", "شيكارة", "كيس", "جردل", "جركن", "برميل", "دستة", "طن"];

  var parties = [], products = [], reps = [], registers = [];
  var items = [], existing = null, oldLines = [], party = null, curProd = null, plist = null, noteRow = -1;
  var company = Object.assign({ name: "الشركة", phone: "", address: "", tax_id: "" }, DB.getCompany());
  var vatRate = company.vat_rate != null ? N(company.vat_rate) : 14, vatOn = company.vat_enabled !== false;
  function priceFor(p) { return K.price === "unit_cost" ? N(p.cost) : (plist ? Ledger.priceWith(plist, p) : N(p.price)); }
  function regOptions() { return '<option value="">بدون (آجل / بنك)</option>' + registers.map(function (r) { return '<option value="' + esc(r.id) + '">' + esc(r.name) + " (" + money(r.balance) + ")</option>"; }).join(""); }
  function unitOptions(sel) { return '<option value="">—</option>' + UNITS.map(function (u) { return "<option" + (u === sel ? " selected" : "") + ">" + u + "</option>"; }).join(""); }

  page.classList.remove("anim-stagger");
  page.innerHTML = html`
  <div class="iv-root inv-page" data-kind="${kind}"><div class="iv" id="iv">

    <section class="iv-card iv-head">
      <div class="iv-grid">
        <div class="f f-num"><label for="f-num">الرقم ${editId ? "" : '<span class="auto">آلي</span>'}</label><input id="f-num" disabled></div>
        <div class="f f-date"><label for="f-date">التاريخ *</label><input id="f-date" type="date"></div>
        <div class="f f-party sugg-wrap"><label for="f-party">${K.plabel} * <button type="button" class="iv-link" id="b-newparty">+ جديد</button></label>
          <input id="f-party" placeholder="ابحث بالاسم أو الهاتف أو الكود..." autocomplete="off"><div class="sugg" id="sg-party"></div></div>
        ${K.sign > 0 ? html`<div class="f f-rep"><label for="f-rep">${K.key === "sale" ? "المندوب" : "المسؤول"}</label><select id="f-rep"><option value="">— بدون —</option></select></div>` : ""}
        <div class="f f-book"><label for="f-book">رقم الدفتر / المرجع</label><input id="f-book" dir="ltr"></div>
        <button type="button" class="iv-ghost f-moreb" id="b-more" aria-expanded="false" title="موقع التسليم والملاحظات">⋯ المزيد</button>
      </div>
      <div class="iv-more" id="iv-more" hidden>
        <div class="f"><label for="f-loc">موقع التسليم</label><input id="f-loc" placeholder="اختياري"></div>
        <div class="f"><label for="f-notes">ملاحظات</label><input id="f-notes" placeholder="اختياري"></div>
      </div>
      <div class="party-note" id="party-note"></div>
    </section>

    <section class="iv-card iv-entry">
      <div class="iv-egrid">
        <div class="f f-prod sugg-wrap"><label for="p-name">المنتج * <span class="stock-pill" id="p-stock">—</span></label>
          <input id="p-name" placeholder="ابحث بالاسم أو الكود، أو امسح الباركود..." autocomplete="off"><div class="sugg" id="sg-prod"></div></div>
        <div class="f f-qty"><label for="p-qty">الكمية *</label><input id="p-qty" type="number" min="0.01" step="0.01" placeholder="0" inputmode="decimal"></div>
        <div class="f f-price"><label for="p-price">${K.priceLabel}</label><input id="p-price" type="number" min="0" step="0.01" placeholder="0" inputmode="decimal"></div>
        <div class="f f-unit"><label for="p-unit">الوحدة</label><select id="p-unit">${unitOptions("")}</select></div>
        <div class="f f-note"><label for="p-note">ملاحظة</label><input id="p-note" placeholder="لون / مقاس..."></div>
        <div class="f f-add"><label>&nbsp;</label><div class="iv-row"><button type="button" class="primary" id="b-add">+ إضافة</button><button type="button" class="iv-ghost iv-sq" id="b-clr" title="تفريغ الحقول">✕</button></div></div>
      </div>
    </section>

    <section class="iv-card iv-items">
      <div class="iv-ihead"><b>البنود</b><span class="count-badge" id="cnt">0 بند</span><span class="iv-hint">اضغط الكمية أو السعر للتعديل مباشرة</span></div>
      <div class="iv-tablewrap"><table class="iv-tbl">
        <thead><tr><th class="c-idx">#</th><th>المنتج</th><th class="c-qty">الكمية</th><th class="c-unit">الوحدة</th><th class="c-price">${K.priceLabel}</th><th class="c-tot">الإجمالي</th><th class="c-act"></th></tr></thead>
        <tbody id="items-body"></tbody>
      </table></div>
    </section>

    <section class="iv-card iv-pay">
      <div class="iv-pgrid">
        <div class="f"><label for="f-discount">الخصم <span class="opt">مبلغ أو %</span></label><input id="f-discount" inputmode="decimal" placeholder="0 أو 5%"></div>
        ${K.delivery ? html`<div class="f"><label for="f-delivery">الناولون / نقل</label><input id="f-delivery" type="number" min="0" step="0.01" placeholder="0" inputmode="decimal"></div>` : ""}
        ${K.vatable ? html`<div class="f"><label for="f-vat">ض.ق.م</label><select id="f-vat"><option value="1">مفعّلة (${vatRate}%)</option><option value="0">بدون</option></select></div>` : ""}
        ${K.paidable ? html`<div class="f"><label for="f-paid">${K.payLabel}</label><input id="f-paid" type="number" min="0" step="0.01" placeholder="0" inputmode="decimal"></div>
          <div class="f f-reg"><label for="f-reg">${K.key === "sale" ? "إلى خزينة" : "من خزينة"}</label><select id="f-reg"><option value="">بدون (آجل / بنك)</option></select></div>` : ""}
      </div>
    </section>

    <section class="iv-card iv-bar">
      <div class="iv-tots" id="totals"></div>
      <div class="iv-acts">
        <button type="button" class="primary iv-save" id="b-save">${editId ? "حفظ التعديل" : "حفظ وترحيل"}</button>
        <div class="iv-acts2" id="acts2">
          <button type="button" id="b-prev">معاينة</button>
          <button type="button" id="b-print">طباعة / PDF</button>
          <button type="button" id="b-new">جديد</button>
          <button type="button" class="danger" id="b-cancel">إلغاء</button>
        </div>
        <button type="button" class="iv-ghost iv-menu" id="b-menu" aria-label="المزيد">⋯</button>
      </div>
    </section>

  </div></div>`;

  /* ---------- ملاءمة الارتفاع: الصفحة تتسع في الشاشة والجدول وحده يتمرر ---------- */
  var iv = $("iv");
  function fit() {
    if (!document.body.contains(iv)) { window.removeEventListener("resize", fit); return; }
    var wide = iv.parentElement.clientWidth > 700 && window.innerHeight >= 560;
    iv.classList.toggle("fixed", wide);
    iv.style.height = "";
    if (!wide) return;
    var top = iv.getBoundingClientRect().top + window.scrollY, h = Math.max(500, window.innerHeight - top - 14);
    iv.style.height = h + "px";
    var over = document.documentElement.scrollHeight - window.innerHeight;
    if (over > 0) iv.style.height = Math.max(500, h - over) + "px";
  }
  window.addEventListener("resize", fit);

  /* ---------- اقتراحات (طرف/منتج) ---------- */
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
    party = p; $("f-party").value = p ? p.name : ""; plist = null;
    var note = $("party-note");
    if (!p) { note.innerHTML = ""; return; }
    var bal = N(p.balance), lim = N(p.credit_limit);
    note.innerHTML = (p.phone ? '<span dir="ltr">' + esc(p.phone) + "</span>" : "") + "<span>الرصيد: <b>" + money(bal) + "</b></span>" +
      (lim > 0 ? "<span>حد الائتمان: <b>" + money(lim) + "</b></span>" : "") + (lim > 0 && bal > lim ? '<span class="warn">تجاوز الحد</span>' : "");
    if (kind === "sale" && p.price_list_id) Ledger.loadPriceList(p.price_list_id).then(function (pl) {
      if (party !== p || !pl) return; plist = pl;
      note.innerHTML += "<span>قائمة الأسعار: <b>" + esc(pl.name) + (pl.pct ? " (" + (pl.pct > 0 ? "+" : "") + pl.pct + "%)" : "") + "</b></span>";
    }).catch(function () {});
  }
  suggest($("f-party"), $("sg-party"), function (t) {
    return parties.filter(function (p) { return !t || (p.name + " " + (p.phone || "") + " " + (p.code || "")).toLowerCase().indexOf(t) !== -1; }).slice(0, 30)
      .map(function (p) { return { id: p.id, label: p.name, small: (p.phone || "") + (p.balance ? " · " + money(p.balance) : "") }; });
  }, function (it) { selectParty(parties.filter(function (p) { return p.id === it.id; })[0]); $("p-name").focus(); });
  $("f-party").addEventListener("input", function () { if (party && $("f-party").value !== party.name) { party = null; plist = null; $("party-note").innerHTML = ""; } });

  /* ---------- إدخال المنتج ---------- */
  function stockText(p) {
    var el = $("p-stock");
    if (!p) { el.textContent = "—"; el.className = "stock-pill"; return; }
    var s = N(p.qty);
    el.textContent = "متاح " + money(s) + (p.unit ? " " + p.unit : "");
    el.className = "stock-pill" + (s <= 0 ? " zero" : (N(p.min_qty) && s <= N(p.min_qty) ? " low" : ""));
  }
  function selectProduct(p) {
    curProd = p; $("p-name").value = p ? p.name : "";
    if (p) { $("p-price").value = priceFor(p); $("p-unit").value = UNITS.indexOf(p.unit) !== -1 ? p.unit : ""; stockText(p); $("p-qty").focus(); $("p-qty").select(); }
    else stockText(null);
  }
  suggest($("p-name"), $("sg-prod"), function (t) {
    return products.filter(function (p) { return !t || (p.name + " " + (p.sku || "") + " " + (p.barcode || "")).toLowerCase().indexOf(t) !== -1; }).slice(0, 30)
      .map(function (p) { return { id: p.id, label: p.name, small: "متاح " + money(p.qty) + " · " + money(priceFor(p)) }; });
  }, function (it) { selectProduct(products.filter(function (p) { return p.id === it.id; })[0]); });
  // ماسح الباركود (يكتب الرقم ثم Enter): يضيف الصنف مباشرة بكمية 1، ولو موجود يزيد كميته
  $("p-name").addEventListener("keydown", function (e) {
    if (e.key !== "Enter") return;
    var code = $("p-name").value.trim().toLowerCase();
    if (!code) return;
    var hit = products.filter(function (p) { return (p.barcode && String(p.barcode).toLowerCase() === code) || (p.sku && String(p.sku).toLowerCase() === code); })[0];
    if (!hit) return;
    e.preventDefault(); e.stopImmediatePropagation();
    $("sg-prod").classList.remove("open");
    var at = items.findIndex(function (x) { return x.product_id === hit.id; });
    if (at >= 0) { items[at].qty = N(items[at].qty) + 1; clearEntry(); drawItems(); $("p-name").focus(); return; }
    selectProduct(hit); $("p-qty").value = 1; addItem();
  }, true);
  $("p-name").addEventListener("input", function () { if (curProd && $("p-name").value !== curProd.name) { curProd = null; stockText(null); } });

  function clearEntry() {
    curProd = null; ["p-name", "p-qty", "p-price", "p-note"].forEach(function (id) { $(id).value = ""; }); $("p-unit").value = ""; stockText(null);
  }
  function addItem() {
    if (!curProd) { UI.toast("اختر المنتج من القائمة", true); $("p-name").focus(); return; }
    var qty = N($("p-qty").value), price = N($("p-price").value);
    if (qty <= 0) { UI.toast("اكتب كمية صحيحة", true); $("p-qty").focus(); return; }
    if (price < 0) { UI.toast("السعر غير صحيح", true); return; }
    items.push({ product_id: curProd.id, name: curProd.name, qty: qty, price: price, unit: $("p-unit").value, note: $("p-note").value.trim() });
    clearEntry(); drawItems(); $("p-name").focus();
    var tw = document.querySelector(".iv-tablewrap"); if (tw) tw.scrollTop = tw.scrollHeight;     // آخر بند ظاهر
  }
  $("b-add").onclick = addItem;
  $("b-clr").onclick = function () { clearEntry(); $("p-name").focus(); };
  $("p-qty").addEventListener("keydown", function (e) { if (e.key === "Enter") { e.preventDefault(); $("p-price").focus(); $("p-price").select(); } });
  $("p-price").addEventListener("keydown", function (e) { if (e.key === "Enter") { e.preventDefault(); addItem(); } });
  $("p-note").addEventListener("keydown", function (e) { if (e.key === "Enter") { e.preventDefault(); addItem(); } });

  /* ---------- البنود (جدول بتعديل مباشر) ---------- */
  function grossNow() { return items.reduce(function (s, i) { return s + N(i.qty) * N(i.price); }, 0); }
  function parseDiscount() {
    var s = String($("f-discount").value || "").trim().replace(",", ".");
    if (/%$/.test(s)) return r2(grossNow() * N(s.slice(0, -1)) / 100);
    return N(s);
  }
  function formData() {
    return {
      party_id: party ? party.id : "", date: $("f-date").value, book_no: $("f-book").value.trim(), rep_id: $("f-rep") ? $("f-rep").value : "",
      location: $("f-loc").value.trim(), delivery: $("f-delivery") ? N($("f-delivery").value) : 0, discount: parseDiscount(),
      vat_rate: K.vatable && $("f-vat") && $("f-vat").value === "1" ? vatRate : 0,
      paid: $("f-paid") ? N($("f-paid").value) : 0, register_id: $("f-reg") ? $("f-reg").value : "", notes: $("f-notes").value.trim(),
      lines: items.map(function (i) { return { product_id: i.product_id, qty: i.qty, price: i.price, unit: i.unit, note: i.note }; }),
    };
  }
  function drawItems() {
    $("cnt").textContent = items.length + " بند";
    var rows = items.map(function (it, i) {
      var r = '<tr data-i="' + i + '"><td class="c-idx">' + (i + 1) + '</td><td class="c-name"><b>' + esc(it.name) + "</b>" + (it.note && noteRow !== i ? '<span class="note">' + esc(it.note) + "</span>" : "") + "</td>" +
        '<td class="c-qty"><input data-f="qty" type="number" min="0" step="0.01" inputmode="decimal" value="' + esc(String(it.qty)) + '" aria-label="الكمية"></td>' +
        '<td class="c-unit"><select data-f="unit" aria-label="الوحدة">' + unitOptions(it.unit) + "</select></td>" +
        '<td class="c-price"><input data-f="price" type="number" min="0" step="0.01" inputmode="decimal" value="' + esc(String(it.price)) + '" aria-label="السعر"></td>' +
        '<td class="c-tot">' + money(N(it.qty) * N(it.price)) + '</td><td class="c-act"><button type="button" class="iv-ghost iv-sq" data-act="note" title="ملاحظة">✎</button><button type="button" class="iv-ghost iv-sq danger" data-act="del" title="حذف البند">✕</button></td></tr>';
      if (noteRow === i) r += '<tr class="note-row"><td colspan="7"><input class="note-in" data-f="note" value="' + esc(it.note || "") + '" placeholder="ملاحظة على البند: لون / مقاس..."></td></tr>';
      return r;
    }).join("");
    $("items-body").innerHTML = rows || '<tr><td colspan="7"><div class="iv-empty"><b>لا توجد بنود بعد</b>اكتب اسم المنتج أو امسح الباركود في الأعلى</div></td></tr>';
    drawTotals();
    var ni = document.querySelector(".note-in"); if (ni) ni.focus();
  }
  function drawTotals() {
    var d = formData(), c = Invoices.compute(kind, d);
    var t = '<div class="iv-t opt"><span class="l">البنود</span><span class="v">' + money(c.gross) + "</span></div>";
    if (K.delivery) t += '<div class="iv-t opt"><span class="l">الناولون</span><span class="v">' + money(c.delivery) + "</span></div>";
    t += '<div class="iv-t opt red"><span class="l">الخصم</span><span class="v">' + money(c.discount) + "</span></div>";
    if (K.vatable) t += '<div class="iv-t opt"><span class="l">الضريبة</span><span class="v">' + money(c.vat) + "</span></div>";
    t += '<div class="iv-t' + (K.paidable ? "" : " net") + '"><span class="l">الإجمالي</span><span class="v">' + money(c.total) + "</span></div>";
    if (K.paidable) {
      t += '<div class="iv-t opt"><span class="l">المدفوع</span><span class="v">' + money(c.paid) + "</span></div>";
      t += '<div class="iv-t net"><span class="l">المتبقي</span><span class="v">' + money(c.remaining) + "</span></div>";
    }
    $("totals").innerHTML = t;
  }
  ["f-discount", "f-delivery", "f-vat", "f-paid"].forEach(function (id) { if ($(id)) { $(id).addEventListener("input", drawTotals); $(id).addEventListener("change", drawTotals); } });

  var tb = $("items-body");
  tb.addEventListener("input", function (e) {
    var f = e.target.getAttribute && e.target.getAttribute("data-f"), tr = e.target.closest("tr"); if (!f) return;
    var i = Number((tr.classList.contains("note-row") ? tr.previousElementSibling : tr).getAttribute("data-i")), it = items[i]; if (!it) return;
    if (f === "qty" || f === "price") it[f] = N(e.target.value); else it[f] = e.target.value;
    if (f === "qty" || f === "price") { var tot = tr.querySelector(".c-tot"); if (tot) tot.textContent = money(N(it.qty) * N(it.price)); drawTotals(); }
  });
  tb.addEventListener("keydown", function (e) {
    var f = e.target.getAttribute && e.target.getAttribute("data-f"); if (!f || e.key !== "Enter") return;
    e.preventDefault();
    if (f === "qty") { var p = e.target.closest("tr").querySelector('[data-f="price"]'); p.focus(); p.select(); }
    else if (f === "note") { noteRow = -1; drawItems(); $("p-name").focus(); }
    else $("p-name").focus();
  });
  tb.addEventListener("focusout", function (e) { if (e.target.classList && e.target.classList.contains("note-in")) { setTimeout(function () { if (noteRow >= 0 && !document.activeElement.classList.contains("note-in")) { noteRow = -1; drawItems(); } }, 120); } });
  tb.addEventListener("click", function (e) {
    var b = e.target.closest("button[data-act]"); if (!b) return;
    var i = Number(b.closest("tr").getAttribute("data-i"));
    if (b.getAttribute("data-act") === "del") { items.splice(i, 1); noteRow = -1; drawItems(); }
    else { noteRow = noteRow === i ? -1 : i; drawItems(); }
  });

  /* ---------- المزيد / القائمة المختصرة ---------- */
  $("b-more").onclick = function () { var m = $("iv-more"); m.hidden = !m.hidden; this.setAttribute("aria-expanded", String(!m.hidden)); fit(); };
  $("b-menu").onclick = function (e) { e.stopPropagation(); $("acts2").classList.toggle("open"); };
  document.addEventListener("click", function (e) { var a = $("acts2"); if (a && !e.target.closest("#acts2,#b-menu")) a.classList.remove("open"); });

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
    if (!d.lines.length) { UI.toast("أضف منتجًا واحدًا على الأقل", true); $("p-name").focus(); return; }
    var bad = d.lines.filter(function (l) { return N(l.qty) <= 0 || N(l.price) < 0; });
    if (bad.length) { UI.toast("راجع الكميات والأسعار في البنود", true); return; }
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
      if (quoteRec) {
        try { await DB.update("quotes", quoteRec.id, { status: "converted", invoice_id: res.id, invoice_number: res.number, converted_at: new Date().toISOString() }); }
        catch (e2) { UI.toast("حُفظت الفاتورة لكن تعذّر تحديث حالة العرض: " + (e2.message || ""), true); }
        quoteRec = null; location.href = "quotes.html"; return;
      }
      if (existing) { location.href = K.listHref; return; }
      await reset();
    } catch (err) { UI.toast(err.message || "خطأ", true); }
    btn.disabled = false;
  }
  $("b-save").onclick = save;
  document.addEventListener("keydown", function (e) {
    if (!document.body.contains(iv)) return;
    if ((e.ctrlKey || e.metaKey) && e.key === "Enter") { e.preventDefault(); save(); }
  });

  function previewHtml() {
    var d = formData(), c = Invoices.compute(kind, d);
    var doc = { number: $("f-num").value, date: d.date, book_no: d.book_no, location: d.location, notes: d.notes, gross: c.gross, discount: c.discount, vat_rate: c.vat_rate, vat_amount: c.vat, delivery: c.delivery, total: c.total, paid: c.paid };
    var lines = d.lines.map(function (l) { var o = { product_id: l.product_id, qty: l.qty, unit: l.unit, note: l.note }; o[K.price] = l.price; return o; });
    return Invoices.printBody(kind, doc, lines, party, products, company);
  }
  $("b-prev").onclick = function () {
    $("acts2").classList.remove("open");
    if (!items.length) { UI.toast("أضف منتجًا للمعاينة", true); return; }
    var ov = document.createElement("div"); ov.className = "preview-overlay inv-page"; ov.setAttribute("data-kind", kind);
    ov.innerHTML = '<div class="preview-sheet">' + previewHtml() + '</div><div class="preview-actions"><button type="button" class="primary" id="pv-print">طباعة / PDF</button><button type="button" id="pv-close">إغلاق</button></div>';
    document.body.appendChild(ov);
    ov.querySelector("#pv-close").onclick = function () { ov.remove(); };
    ov.querySelector("#pv-print").onclick = function () { UI.printHTML(K.title, previewHtml()); };
    ov.onclick = function (e) { if (e.target === ov) ov.remove(); };
  };
  $("b-print").onclick = function () { $("acts2").classList.remove("open"); if (!items.length) { UI.toast("أضف منتجًا أولًا", true); return; } UI.printHTML(K.title, previewHtml()); };
  $("b-cancel").onclick = function () {
    $("acts2").classList.remove("open");
    if (existing) { location.href = K.listHref; return; }
    if ((items.length || party) && !confirm("تفريغ كل البيانات؟")) return;
    reset();
  };
  $("b-new").onclick = function () { $("acts2").classList.remove("open"); if (existing) location.href = "invoice.html?kind=" + kind; else $("b-cancel").click(); };

  async function reset() {
    items = []; noteRow = -1; party = null; curProd = null; existing = null; oldLines = []; plist = null;
    ["f-party", "f-book", "f-loc", "f-notes", "f-delivery", "f-discount", "f-paid", "p-name", "p-qty", "p-price", "p-note"].forEach(function (id) { if ($(id)) $(id).value = ""; });
    ["f-rep", "f-reg", "p-unit"].forEach(function (id) { if ($(id)) $(id).value = ""; });
    if ($("f-vat")) $("f-vat").value = vatOn ? "1" : "0";
    $("f-date").value = Ledger.today(); $("party-note").innerHTML = ""; stockText(null);
    var d = await Promise.all([DB.list(K.party), DB.list("products"), DB.list("cash_registers"), DB.nextNumber(K.seq)]);
    parties = d[0]; products = d[1]; registers = d[2]; $("f-num").value = d[3];
    if ($("f-reg")) $("f-reg").innerHTML = regOptions();
    drawItems(); $("f-party").focus();
  }

  /* ---------- تحميل أولي ---------- */
  var d0 = await Promise.all([DB.list(K.party), DB.list("products"), DB.list("employees"), DB.list("cash_registers")]);
  parties = d0[0]; products = d0[1]; reps = d0[2].filter(function (e) { return e.status !== "inactive"; }); registers = d0[3];
  if ($("f-rep")) $("f-rep").innerHTML = '<option value="">— بدون —</option>' + reps.map(function (r) { return '<option value="' + esc(r.id) + '">' + esc(r.name) + "</option>"; }).join("");
  if ($("f-reg")) $("f-reg").innerHTML = regOptions();
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
    if (quoteId) {
      var qs = (await DB.list("quotes")).filter(function (x) { return x.id === quoteId; });
      quoteRec = qs[0] || null;
      if (!quoteRec) UI.toast("عرض السعر غير موجود", true);
      else if (quoteRec.status === "converted") { UI.toast("هذا العرض تم تحويله لفاتورة من قبل", true); quoteRec = null; }
      else {
        var cust = parties.filter(function (p) { return p.id === quoteRec.party_id; })[0] || parties.filter(function (p) { return p.name === quoteRec.party_name; })[0] || null;
        if (cust) selectParty(cust); else { $("f-party").value = quoteRec.party_name || ""; UI.toast("العميل غير مسجّل — اختره أو أضفه بزر «+ جديد» قبل الحفظ", true); }
        $("f-notes").value = "من عرض سعر #" + quoteRec.number + (quoteRec.notes ? " — " + quoteRec.notes : "");
        $("f-discount").value = quoteRec.discount || "";
        if ($("f-vat")) $("f-vat").value = N(quoteRec.vat_rate) > 0 ? "1" : "0";
        var skipped = [];
        (quoteRec.lines || []).forEach(function (l) {
          var p = products.filter(function (x) { return x.id === l.product_id; })[0] || products.filter(function (x) { return x.name === l.name; })[0];
          if (!p) { skipped.push(l.name); return; }
          items.push({ product_id: p.id, name: p.name, qty: N(l.qty), price: N(l.price), unit: l.unit || "", note: "" });
        });
        if (skipped.length) UI.toast("بنود غير مسجّلة كأصناف لم تُنقل: " + skipped.join("، "), true);
      }
    }
  }
  if ($("f-loc").value || $("f-notes").value) { $("iv-more").hidden = false; $("b-more").setAttribute("aria-expanded", "true"); }
  drawItems();
  fit(); setTimeout(fit, 120);
  setTimeout(function () { if (!editId) $("f-party").focus(); }, 50);
})();
