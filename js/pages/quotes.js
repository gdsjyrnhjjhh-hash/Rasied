(async function () {
  var page = await UI.init("quotes");
  if (!page) return;
  var html = UI.html, money = UI.money, esc = Ledger.esc;
  var TBL = "quotes";
  var STATUS = { draft: "مسودة", sent: "مُرسل", accepted: "مقبول", rejected: "مرفوض", converted: "تحوّل لفاتورة" };
  var BADGE = { draft: "", sent: "warn", accepted: "ok", rejected: "danger", converted: "ok" };
  var UNITS = ["قطعة", "كرتونة", "علبة", "كيلو", "جرام", "متر", "لتر", "شيكارة", "كيس", "جردل", "جركن", "برميل", "دستة", "طن"];
  var quotes = [], customers = [], products = [], filter = "", stFilter = "";
  var company = Object.assign({ name: "الشركة", phone: "", address: "", tax_id: "" }, DB.getCompany());
  var vatRate = company.vat_rate != null ? Number(company.vat_rate) : 14, vatOn = company.vat_enabled !== false;
  function N(v) { return Number(v) || 0; }
  function today() { return Ledger.today(); }
  function addDays(iso, n) { var d = new Date(iso + "T12:00:00"); d.setDate(d.getDate() + n); return d.toISOString().slice(0, 10); }
  function calc(lines, discount, rate) { return Invoices.compute("sale", { lines: lines, discount: discount, vat_rate: rate }); }
  function expired(q) { return q.valid_until && q.valid_until < today() && (q.status === "draft" || q.status === "sent"); }

  page.innerHTML = html`
    <div class="stack">
      <div class="page-toolbar">
        <div>
          <h2 style="margin:0">عروض الأسعار</h2>
          <p class="muted" style="margin:4px 0 0;font-size:12px">عرض سعر للعميل · طباعة PDF · تحويل لفاتورة بيع بضغطة</p>
        </div>
        <button type="button" class="primary" id="btn-add">+ عرض سعر</button>
      </div>
      <div class="card"><div class="row gap" style="flex-wrap:wrap;align-items:flex-end">
        <div class="field" style="flex:1;min-width:160px"><label>بحث</label><input id="f-q" placeholder="رقم العرض أو اسم العميل..."></div>
        <div class="field"><label>الحالة</label><select id="f-st"><option value="">الكل</option>${Object.keys(STATUS).map(function (k) { return html`<option value="${k}">${STATUS[k]}</option>`; }).join("")}</select></div>
      </div></div>
      <div class="card table-wrap" id="list"></div>
    </div>`;

  function render() {
    var t = filter.trim().toLowerCase();
    var list = quotes.filter(function (q) {
      if (stFilter && q.status !== stFilter) return false;
      return !t || (String(q.number) + " " + String(q.party_name || "")).toLowerCase().indexOf(t) !== -1;
    }).sort(function (a, b) { return N(b.number) - N(a.number); });
    document.getElementById("list").innerHTML = html`
      <table>
        <thead><tr><th>#</th><th>التاريخ</th><th>العميل</th><th>الصلاحية</th><th>الإجمالي</th><th>الحالة</th><th></th></tr></thead>
        <tbody>${list.length === 0 ? html`<tr><td colspan="7" class="empty">لا توجد عروض أسعار</td></tr>` : list.map(function (q) {
          var locked = q.status === "converted";
          return html`<tr data-id="${q.id}">
            <td>${q.number}</td><td dir="ltr">${q.date}</td><td><b>${esc(q.party_name || "—")}</b></td>
            <td dir="ltr">${q.valid_until || "—"}${expired(q) ? html` <span class="badge danger">منتهي</span>` : ""}</td>
            <td><b>${money(q.total)}</b></td>
            <td>${locked ? html`<span class="badge ok">${STATUS.converted}${q.invoice_number ? " #" + esc(q.invoice_number) : ""}</span>` :
              html`<select data-act="status" style="min-width:110px">${["draft", "sent", "accepted", "rejected"].map(function (k) { return html`<option value="${k}" ${q.status === k ? "selected" : ""}>${STATUS[k]}</option>`; }).join("")}</select>`}</td>
            <td class="nw">
              <button type="button" class="ghost sm" data-act="print">طباعة</button>
              ${locked ? "" : html`<button type="button" class="sm primary" data-act="convert">تحويل لفاتورة</button> <button type="button" class="ghost sm" data-act="edit">تعديل</button> <button type="button" class="ghost sm danger" data-act="del">حذف</button>`}
            </td></tr>`; }).join("")}</tbody>
      </table>`;
  }

  /* ---------- المحرر ---------- */
  function openEditor(ex) {
    var q = ex || { date: today(), valid_until: addDays(today(), 7), status: "draft", lines: [], discount: 0, vat_rate: vatOn ? vatRate : 0, notes: "", terms: "الأسعار سارية حتى تاريخ انتهاء العرض." };
    var lines = (q.lines || []).map(function (l) { return Object.assign({}, l); });
    var ov = document.createElement("div");
    ov.className = "modal-overlay";
    ov.innerHTML = html`<div class="modal card" style="max-width:860px;width:96vw;max-height:92vh;overflow:auto">
      <h3 style="margin-top:0">${ex ? "تعديل عرض سعر #" + q.number : "عرض سعر جديد"}</h3>
      <form id="qf" class="stack">
        <div class="form-grid">
          <div class="field full"><label>العميل * <span class="opt">من القائمة أو اسم عميل محتمل</span></label>
            <input id="q-party" list="q-clist" value="${esc(q.party_name || "")}" required autocomplete="off" placeholder="اسم العميل...">
            <datalist id="q-clist">${customers.map(function (c) { return html`<option value="${esc(c.name)}"></option>`; }).join("")}</datalist></div>
          <div class="field"><label>التاريخ</label><input id="q-date" type="date" value="${q.date}" required></div>
          <div class="field"><label>صالح حتى</label><input id="q-valid" type="date" value="${q.valid_until || ""}"></div>
          <div class="field"><label>خصم</label><input id="q-disc" type="number" min="0" step="0.01" value="${q.discount || ""}"></div>
          <div class="field"><label>ض.ق.م</label><select id="q-vat"><option value="1" ${N(q.vat_rate) > 0 ? "selected" : ""}>مفعّلة (${vatRate}%)</option><option value="0" ${N(q.vat_rate) > 0 ? "" : "selected"}>بدون ضريبة</option></select></div>
        </div>
        <div class="table-scroll"><table><thead><tr><th style="min-width:200px">الصنف</th><th>الكمية</th><th>السعر</th><th>الوحدة</th><th>الإجمالي</th><th></th></tr></thead>
          <tbody id="q-lines"></tbody></table></div>
        <datalist id="q-plist">${products.map(function (p) { return html`<option value="${esc(p.name)}"></option>`; }).join("")}</datalist>
        <div><button type="button" class="small" id="q-addline">+ إضافة بند</button></div>
        <div id="q-tot" class="row gap" style="flex-wrap:wrap;font-weight:700"></div>
        <div class="form-grid">
          <div class="field full"><label>ملاحظات للعميل</label><input id="q-notes" value="${esc(q.notes || "")}"></div>
          <div class="field full"><label>الشروط</label><input id="q-terms" value="${esc(q.terms || "")}"></div>
        </div>
        <div class="row gap" style="justify-content:flex-end">
          <button type="button" class="ghost" id="q-cancel">إلغاء</button>
          <button class="primary" type="submit">حفظ العرض</button>
        </div>
      </form></div>`;
    document.body.appendChild(ov);
    var $ = function (id) { return ov.querySelector("#" + id); };
    ov.querySelector("#q-cancel").onclick = function () { ov.remove(); };
    ov.onclick = function (e) { if (e.target === ov) ov.remove(); };

    function currentRate() { return $("q-vat").value === "1" ? vatRate : 0; }
    function totals() {
      var c = calc(lines, N($("q-disc").value), currentRate());
      $("q-tot").innerHTML = "<span>الإجمالي: " + money(c.gross) + "</span><span>الخصم: " + money(c.discount) + "</span><span>الضريبة: " + money(c.vat) + '</span><span style="color:var(--primary,#1e3a8a)">الصافي: ' + money(c.total) + "</span>";
      return c;
    }
    function drawLines() {
      $("q-lines").innerHTML = lines.length ? lines.map(function (l, i) {
        return '<tr data-i="' + i + '"><td><input data-k="name" list="q-plist" value="' + esc(l.name || "") + '" placeholder="اسم الصنف..." autocomplete="off"></td>' +
          '<td><input data-k="qty" type="number" min="0" step="0.01" value="' + (l.qty || "") + '" style="width:80px"></td>' +
          '<td><input data-k="price" type="number" min="0" step="0.01" value="' + (l.price || "") + '" style="width:100px"></td>' +
          '<td><select data-k="unit"><option value="">—</option>' + UNITS.map(function (u) { return "<option" + (l.unit === u ? " selected" : "") + ">" + u + "</option>"; }).join("") + "</select></td>" +
          '<td data-sum>' + money(N(l.qty) * N(l.price)) + '</td><td><button type="button" class="small danger" data-rm="' + i + '">حذف</button></td></tr>';
      }).join("") : '<tr><td colspan="6" class="empty">أضف بنود العرض</td></tr>';
      totals();
    }
    $("q-lines").addEventListener("input", function (e) {
      var inp = e.target.closest("[data-k]"); if (!inp) return;
      var tr = inp.closest("tr"), l = lines[Number(tr.getAttribute("data-i"))], k = inp.getAttribute("data-k");
      if (k === "name") {
        l.name = inp.value;
        var p = products.filter(function (x) { return x.name === inp.value; })[0];
        if (p) { l.product_id = p.id; if (!N(l.price)) l.price = N(p.price); if (!l.unit && UNITS.indexOf(p.unit) !== -1) l.unit = p.unit; if (!N(l.qty)) l.qty = 1; drawLines(); return; }
        l.product_id = "";
      } else if (k === "qty" || k === "price") l[k] = N(inp.value); else l[k] = inp.value;
      tr.querySelector("[data-sum]").textContent = money(N(l.qty) * N(l.price)); totals();
    });
    $("q-lines").addEventListener("click", function (e) {
      var b = e.target.closest("[data-rm]"); if (!b) return;
      lines.splice(Number(b.getAttribute("data-rm")), 1); drawLines();
    });
    $("q-addline").onclick = function () { lines.push({ product_id: "", name: "", qty: 1, price: 0, unit: "" }); drawLines(); };
    $("q-disc").oninput = totals; $("q-vat").onchange = totals;
    if (!lines.length) lines.push({ product_id: "", name: "", qty: 1, price: 0, unit: "" });
    drawLines();

    $("qf").onsubmit = async function (e) {
      e.preventDefault();
      var btn = ov.querySelector("button.primary"); btn.disabled = true;
      try {
        var name = $("q-party").value.trim();
        if (!name) throw new Error("اكتب اسم العميل");
        var good = lines.filter(function (l) { return String(l.name || "").trim() && N(l.qty) > 0; });
        if (!good.length) throw new Error("أضف بندًا واحدًا على الأقل بكمية صحيحة");
        var cust = customers.filter(function (c) { return c.name === name; })[0];
        var c = calc(good, N($("q-disc").value), currentRate());
        var data = {
          date: $("q-date").value, valid_until: $("q-valid").value, party_id: cust ? cust.id : "", party_name: name,
          party_phone: cust ? (cust.phone || "") : (ex ? ex.party_phone || "" : ""),
          discount: c.discount, vat_rate: c.vat_rate, gross: c.gross, vat_amount: c.vat, total: c.total,
          notes: $("q-notes").value.trim(), terms: $("q-terms").value.trim(),
          lines: good.map(function (l) { return { product_id: l.product_id || "", name: l.name.trim(), qty: N(l.qty), price: N(l.price), unit: l.unit || "" }; }),
        };
        if (!data.date) throw new Error("اختر التاريخ");
        if (ex) { DB.assertCan("edit"); await DB.update(TBL, ex.id, data); }
        else { data.number = await DB.nextNumber(TBL); data.status = "draft"; await DB.insert(TBL, data); }
        UI.toast(ex ? "تم تعديل العرض" : "تم حفظ العرض");
        ov.remove(); await load();
      } catch (err) { UI.toast(err.message, true); btn.disabled = false; }
    };
  }

  /* ---------- الطباعة ---------- */
  function printQuote(q) {
    var rows = (q.lines || []).map(function (l, i) {
      return "<tr><td>" + (i + 1) + "</td><td>" + esc(l.name) + "</td><td>" + l.qty + (l.unit ? " " + esc(l.unit) : "") + "</td><td>" + money(l.price) + "</td><td>" + money(N(l.qty) * N(l.price)) + "</td></tr>";
    }).join("");
    var tot = "<tr><td>إجمالي البنود</td><td>" + money(q.gross) + "</td></tr>" + (N(q.discount) > 0 ? "<tr><td>الخصم</td><td>-" + money(q.discount) + "</td></tr>" : "") +
      (N(q.vat_amount) > 0 ? "<tr><td>ض.ق.م (" + q.vat_rate + "%)</td><td>" + money(q.vat_amount) + "</td></tr>" : "") + "<tr><td>الإجمالي</td><td>" + money(q.total) + "</td></tr>";
    var body = "<h1>" + esc(company.name || "الشركة") + "</h1><h2>عرض سعر رقم " + q.number + "</h2>" +
      "<div class=meta><div><div>العميل: <b>" + esc(q.party_name || "—") + "</b></div><div>التاريخ: " + esc(q.date || "") + "</div>" + (q.valid_until ? "<div>صالح حتى: " + esc(q.valid_until) + "</div>" : "") + "</div>" +
      "<div><div>هاتف: " + esc(company.phone || "") + "</div><div>العنوان: " + esc(company.address || "") + "</div><div>الرقم الضريبي: " + esc(company.tax_id || "") + "</div></div></div>" +
      "<table><thead><tr><th>#</th><th>الصنف</th><th>الكمية</th><th>السعر</th><th>الإجمالي</th></tr></thead><tbody>" + rows + "</tbody></table>" +
      "<table class=totals>" + tot + "</table>" +
      (q.notes ? "<p>ملاحظات: " + esc(q.notes) + "</p>" : "") + (q.terms ? '<p style="color:#667391;font-size:12px">' + esc(q.terms) + "</p>" : "");
    UI.printHTML("عرض سعر " + q.number, body);
  }

  async function load() {
    DB.refresh();
    var d = await Promise.all([DB.list(TBL), DB.list("customers"), DB.list("products")]);
    quotes = d[0] || []; customers = d[1] || []; products = d[2] || [];
    render();
  }

  document.getElementById("list").addEventListener("change", async function (e) {
    var s = e.target.closest('[data-act="status"]'); if (!s) return;
    var q = quotes.filter(function (x) { return x.id === s.closest("tr").getAttribute("data-id"); })[0]; if (!q) return;
    try { await DB.update(TBL, q.id, { status: s.value }); UI.toast("تم تحديث الحالة"); await load(); } catch (err) { UI.toast(err.message, true); }
  });
  document.getElementById("list").onclick = async function (e) {
    var b = e.target.closest("button[data-act]"); if (!b) return;
    var q = quotes.filter(function (x) { return x.id === b.closest("tr").getAttribute("data-id"); })[0]; if (!q) return;
    var act = b.getAttribute("data-act");
    try {
      if (act === "edit") { DB.assertCan("edit"); openEditor(q); }
      else if (act === "print") printQuote(q);
      else if (act === "convert") location.href = "invoice.html?kind=sale&quote=" + encodeURIComponent(q.id);
      else if (act === "del") {
        DB.assertCan("delete");
        if (!confirm("حذف عرض السعر #" + q.number + "؟")) return;
        await DB.remove(TBL, q.id); UI.toast("تم الحذف"); await load();
      }
    } catch (err) { UI.toast(err.message, true); }
  };
  document.getElementById("btn-add").onclick = function () { openEditor(); };
  document.getElementById("f-q").oninput = function () { filter = this.value; render(); };
  document.getElementById("f-st").onchange = function () { stFilter = this.value; render(); };
  await load();
})();
