/* قائمة موحّدة للفواتير والمرتجعات: عرض · بحث · فلترة · تعديل · حذف (بعكس الأثر) · طباعة · تصدير */
window.InvoiceList = {
  run: async function (kind) {
    var K = Invoices.KINDS[kind];
    var page = await UI.init(K.page);
    if (!page) return;
    var html = UI.html, money = UI.money, esc = Ledger.esc, val = Ledger.val;
    var N = function (x) { return Number(x) || 0; };
    var docs = [], parties = [], products = [], lines = [], reps = [];
    var company = Object.assign({ name: "الشركة", phone: "", address: "", tax_id: "" }, DB.getCompany());
    var f = { text: "", from: "", to: "", party: "" }, openId = "";

    page.innerHTML = html`
      <div class="inv-page stack" data-kind="${kind}">
        <div class="page-toolbar">
          <div>
            <h2 style="margin:0">${K.plural} ${K.sign < 0 ? '<span class="kind-chip">مرتجع</span>' : ""}</h2>
            <p class="muted" style="margin:4px 0 0;font-size:12px">عرض · تعديل · حذف مع عكس الأثر · طباعة · تصدير</p>
          </div>
          <div class="row gap">
            <button type="button" id="b-csv">تصدير Excel</button>
            <a class="button primary" href="invoice.html?kind=${kind}">+ ${K.newTitle}</a>
          </div>
        </div>
        <div class="card"><div class="form-grid">
          <div class="field"><label>بحث (رقم / دفتر / ملاحظات)</label><input id="q-text"></div>
          <div class="field"><label>${K.plabel}</label><select id="q-party"><option value="">الكل</option></select></div>
          <div class="field"><label>من تاريخ</label><input type="date" id="q-from"></div>
          <div class="field"><label>إلى تاريخ</label><input type="date" id="q-to"></div>
        </div></div>
        <div class="stats" id="stats"></div>
        <div class="card table-wrap" id="list"></div>
        <div id="detail"></div>
      </div>`;

    var pname = function (id) { var p = parties.filter(function (x) { return x.id === id; })[0]; return p ? p.name : "—"; };
    var prodName = function (id) { var p = products.filter(function (x) { return x.id === id; })[0]; return p ? p.name : "—"; };
    var day = function (d) { return String(d.date || d.created_at || "").slice(0, 10); };

    function filtered() {
      var t = (f.text || "").toLowerCase();
      return docs.filter(function (d) {
        var dd = day(d);
        return (!f.from || dd >= f.from) && (!f.to || dd <= f.to) && (!f.party || d[K.pkey] === f.party) &&
          (!t || (String(d.number) + " " + (d.book_no || "") + " " + (d.notes || "") + " " + pname(d[K.pkey])).toLowerCase().indexOf(t) !== -1);
      }).sort(function (a, b) { return a.date === b.date ? N(b.number) - N(a.number) : (a.date < b.date ? 1 : -1); });
    }

    function draw() {
      var rows = filtered(), sum = function (k) { return rows.reduce(function (s, r) { return s + N(r[k]); }, 0); };
      var total = sum("total"), paid = sum("paid");
      document.getElementById("stats").innerHTML = K.paidable ? html`
        <div class="stat teal"><div class="label">عدد المستندات</div><div class="value">${rows.length}</div></div>
        <div class="stat"><div class="label">الإجمالي</div><div class="value">${money(total)}</div></div>
        <div class="stat green"><div class="label">${K.key === "sale" ? "المحصّل" : "المدفوع"}</div><div class="value">${money(paid)}</div></div>
        <div class="stat amber"><div class="label">المتبقي</div><div class="value">${money(total - paid)}</div></div>` : html`
        <div class="stat teal"><div class="label">عدد المرتجعات</div><div class="value">${rows.length}</div></div>
        <div class="stat red"><div class="label">إجمالي المرتجعات</div><div class="value">${money(total)}</div></div>`;
      document.getElementById("list").innerHTML = html`
        <table class="clickable"><thead><tr><th>رقم</th><th>دفتر</th><th>${K.plabel}</th><th>التاريخ</th><th>الإجمالي</th>${K.paidable ? "<th>المدفوع</th><th>المتبقي</th>" : ""}<th></th></tr></thead><tbody>
          ${rows.map(function (d) {
            var due = N(d.total) - N(d.paid);
            return html`<tr data-id="${d.id}" class="${d.id === openId ? "editing" : ""}">
              <td><b>#${d.number}</b></td><td dir="ltr" class="muted">${d.book_no || "—"}</td><td>${pname(d[K.pkey])}</td><td dir="ltr">${day(d)}${d.by_name ? '<div class="muted" style="font-size:11px;direction:rtl">' + Ledger.esc(d.by_name) + "</div>" : ""}</td>
              <td><b>${money(d.total)}</b>${N(d.discount) > 0 ? ' <span class="badge">خصم ' + money(d.discount) + "</span>" : ""}</td>
              ${K.paidable ? html`<td>${money(d.paid)}</td><td class="${due > 0.004 ? "accent" : ""}">${money(due)}</td>` : ""}
              <td><div class="actions-cell">
                <a class="small button" href="invoice.html?kind=${kind}&id=${d.id}">تعديل</a>
                <button type="button" class="small" data-act="print" data-id="${d.id}">طباعة</button>
                <button type="button" class="small danger" data-act="del" data-id="${d.id}">${K.sign < 0 ? "إلغاء" : "حذف"}</button>
              </div></td></tr>`;
          }).join("") || html`<tr><td colspan="${K.paidable ? 8 : 6}" class="empty">لا توجد مستندات</td></tr>`}
        </tbody></table>`;
    }

    function docLines(id) { return lines.filter(function (l) { return l[K.fk] === id; }); }
    function printDoc(d) {
      var party = parties.filter(function (p) { return p.id === d[K.pkey]; })[0];
      UI.printHTML(K.title + " " + d.number, Invoices.printBody(kind, d, docLines(d.id), party, products, company));
    }

    function showDetail(id) {
      openId = id; draw();
      var d = docs.filter(function (x) { return x.id === id; })[0], box = document.getElementById("detail");
      if (!d) { box.innerHTML = ""; return; }
      var ls = docLines(id);
      box.innerHTML = html`
        <div class="card stack">
          <div class="invoice-hero">
            <div><div class="muted" style="font-size:12px;margin-bottom:4px">${K.title}</div><div class="big-num">#${d.number}</div>
              <div style="margin-top:8px"><b>${pname(d[K.pkey])}</b></div>
              <div class="muted" style="font-size:12px;margin-top:4px" dir="ltr">${day(d)}${d.book_no ? " · دفتر " + d.book_no : ""}</div></div>
            <div class="row gap wrap"><button type="button" class="primary" id="d-print">طباعة</button><a class="button" href="invoice.html?kind=${kind}&id=${id}">تعديل</a></div>
          </div>
          <div class="table-wrap"><table><thead><tr><th>الصنف</th><th>الكمية</th><th>السعر</th><th>الإجمالي</th></tr></thead><tbody>
            ${ls.map(function (l) { return html`<tr><td>${prodName(l.product_id)}${l.note ? ' <span class="muted">(' + esc(l.note) + ")</span>" : ""}</td><td>${l.qty}${l.unit ? " " + l.unit : ""}</td><td>${money(l[K.price])}</td><td>${money(N(l.qty) * N(l[K.price]))}</td></tr>`; }).join("")}
          </tbody></table></div>
          <div class="invoice-totals">
            ${N(d.discount) > 0 ? html`<div class="box"><span>الخصم</span><b>${money(d.discount)}</b></div>` : ""}
            ${K.vatable ? html`<div class="box"><span>ض.ق.م (${d.vat_rate || 0}%)</span><b>${money(d.vat_amount || 0)}</b></div>` : ""}
            ${N(d.delivery) > 0 ? html`<div class="box"><span>الناولون</span><b>${money(d.delivery)}</b></div>` : ""}
            <div class="box"><span>الإجمالي</span><b class="accent">${money(d.total)}</b></div>
            ${K.paidable ? html`<div class="box"><span>المدفوع</span><b>${money(d.paid)}</b></div><div class="box"><span>المتبقي</span><b>${money(N(d.total) - N(d.paid))}</b></div>` : ""}
          </div>
        </div>`;
      document.getElementById("d-print").onclick = function () { printDoc(d); };
    }

    async function load() {
      var d = await Promise.all([DB.list(K.table), DB.list(K.party), DB.list("products"), DB.list(K.lines), DB.list("employees")]);
      docs = d[0]; parties = d[1]; products = d[2]; lines = d[3]; reps = d[4];
      var sel = document.getElementById("q-party");
      sel.innerHTML = '<option value="">الكل</option>' + parties.map(function (p) { return '<option value="' + p.id + '">' + esc(p.name) + "</option>"; }).join("");
      sel.value = f.party; draw();
      if (openId) showDetail(openId);
    }

    document.getElementById("q-text").oninput = function () { f.text = val("q-text"); draw(); };
    ["q-party", "q-from", "q-to"].forEach(function (id) {
      document.getElementById(id).onchange = function () { f[id === "q-party" ? "party" : id === "q-from" ? "from" : "to"] = val(id); draw(); };
    });
    document.getElementById("list").onclick = async function (e) {
      var b = e.target.closest("[data-act]");
      if (b) {
        var id = b.getAttribute("data-id"), d = docs.filter(function (x) { return x.id === id; })[0];
        if (b.getAttribute("data-act") === "print") { printDoc(d); return; }
        var msg = K.sign < 0 ? "إلغاء هذا المرتجع؟ سيتم عكس أثره على المخزون والحساب والقيود." : "حذف هذا المستند؟ سيتم عكس أثره على المخزون والحساب والقيود وحركة الخزينة المرتبطة.";
        if (!confirm(msg)) return;
        try { await Invoices.remove(kind, id); if (openId === id) { openId = ""; document.getElementById("detail").innerHTML = ""; } UI.toast("تم"); await load(); }
        catch (err) { UI.toast(err.message || "خطأ", true); }
        return;
      }
      if (e.target.closest("a")) return;
      var tr = e.target.closest("tr[data-id]"); if (tr) showDetail(tr.getAttribute("data-id"));
    };
    document.getElementById("b-csv").onclick = function () {
      var rows = filtered();
      UI.exportCSV(K.plural + ".csv", ["رقم", "دفتر", K.plabel, "التاريخ", "الخصم", "الناولون", "الإجمالي", "المدفوع", "المتبقي"],
        rows.map(function (d) { return [d.number, d.book_no || "", pname(d[K.pkey]), day(d), d.discount || 0, d.delivery || 0, d.total, d.paid || 0, N(d.total) - N(d.paid)]; }));
    };
    await load();
  },
};
