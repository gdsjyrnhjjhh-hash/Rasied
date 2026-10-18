/* ============================================================================
   Invoices — حفظ/تعديل/حذف الفواتير والمرتجعات (بيع · شراء · مرتجع بيع · مرتجع شراء)
   كل عملية حفظ تُحدّث: المخزون، قيود اليومية، دفعة الخزينة (اختياري)، رصيد العميل/المورد.
   التعديل والحذف يعكسان الأثر القديم بالكامل ثم يُطبّقان الجديد (نمط رولكس).
   ========================================================================== */
(function () {
  var N = function (x) { return Number(x) || 0; };
  var r2 = function (x) { return Math.round(x * 100) / 100; };

  var KINDS = {
    sale: {
      key: "sale", page: "sales", table: "sales", lines: "sale_lines", fk: "sale_id", party: "customers", pkey: "customer_id", ptype: "customer",
      plabel: "العميل", seq: "sales", title: "فاتورة بيع", plural: "فواتير البيع", newTitle: "فاتورة بيع جديدة", price: "unit_price", priceLabel: "سعر البيع",
      stock: -1, sign: 1, paidable: true, vatable: true, delivery: true, listHref: "sales.html", payLabel: "مدفوع الآن (تحصيل)",
    },
    purchase: {
      key: "purchase", page: "purchases", table: "purchases", lines: "purchase_lines", fk: "purchase_id", party: "suppliers", pkey: "supplier_id", ptype: "supplier",
      plabel: "المورد", seq: "purchases", title: "فاتورة شراء", plural: "فواتير الشراء", newTitle: "فاتورة شراء جديدة", price: "unit_cost", priceLabel: "سعر الشراء",
      stock: 1, sign: 1, paidable: true, vatable: true, delivery: true, listHref: "purchases.html", payLabel: "مدفوع الآن (سداد)",
    },
    sale_return: {
      key: "sale_return", page: "returns", table: "sale_returns", lines: "sale_return_lines", fk: "return_id", party: "customers", pkey: "customer_id", ptype: "customer",
      plabel: "العميل", seq: "sale_returns", title: "مرتجع بيع", plural: "مردودات البيع", newTitle: "مرتجع بيع جديد", price: "unit_price", priceLabel: "سعر الإرجاع",
      stock: 1, sign: -1, paidable: false, vatable: false, delivery: false, listHref: "returns.html",
    },
    purchase_return: {
      key: "purchase_return", page: "purchase-returns", table: "purchase_returns", lines: "purchase_return_lines", fk: "return_id", party: "suppliers", pkey: "supplier_id", ptype: "supplier",
      plabel: "المورد", seq: "purchase_returns", title: "مرتجع شراء", plural: "مردودات الشراء", newTitle: "مرتجع شراء جديد", price: "unit_cost", priceLabel: "سعر الإرجاع",
      stock: -1, sign: -1, paidable: false, vatable: false, delivery: false, listHref: "purchase-returns.html",
    },
  };

  // الإجماليات: إجمالي البنود − الخصم = قبل الضريبة ؛ + ضريبة + ناولون = الإجمالي
  function compute(kind, d) {
    var K = KINDS[kind];
    var gross = r2((d.lines || []).reduce(function (s, l) { return s + N(l.qty) * N(l.price); }, 0));
    var discount = Math.min(Math.max(0, N(d.discount)), gross);
    var subtotal = r2(gross - discount);
    var rate = K.vatable ? N(d.vat_rate) : 0;
    var vat = Math.round(subtotal * rate) / 100;
    var delivery = K.delivery ? Math.max(0, N(d.delivery)) : 0;
    var total = r2(subtotal + vat + delivery);
    var paid = K.paidable ? Math.max(0, N(d.paid)) : 0;
    return { gross: gross, discount: discount, subtotal: subtotal, vat_rate: rate, vat: vat, delivery: delivery, total: total, paid: paid, remaining: r2(total - paid) };
  }

  // الأثر على رصيد الطرف (موجب = يزيد المستحق)
  function effect(kind, doc) {
    var K = KINDS[kind];
    return K.sign > 0 ? N(doc.total) - N(doc.paid) : -N(doc.total);
  }

  async function postJournal(date, memo, source, docId, rows) {
    rows = rows.filter(function (r) { return N(r[1]) > 0.004 || N(r[2]) > 0.004; });
    if (!rows.length) return;
    var number = await DB.nextNumber("journal_entries");
    var e = await DB.insert("journal_entries", { number: number, date: date, memo: memo, source: source, source_id: docId });
    for (var i = 0; i < rows.length; i++) {
      await DB.insert("journal_lines", { entry_id: e.id, account_id: rows[i][0], debit: r2(N(rows[i][1])), credit: r2(N(rows[i][2])) });
    }
  }

  // عكس كل أثر المستند (مخزون، قيود، دفعات، حركة خزينة، رصيد الطرف) ثم حذف بنوده
  async function reverse(kind, doc) {
    var K = KINDS[kind];
    var old = (await DB.list(K.lines)).filter(function (l) { return l[K.fk] === doc.id; });
    for (var i = 0; i < old.length; i++) {
      var p = await DB.get("products", old[i].product_id);
      if (p) await DB.update("products", p.id, { qty: N(p.qty) - K.stock * N(old[i].qty) });
      await DB.remove(K.lines, old[i].id);
    }
    var entries = (await DB.list("journal_entries")).filter(function (e) { return e.source_id === doc.id; });
    if (entries.length) {
      var ids = {}; entries.forEach(function (e) { ids[e.id] = 1; });
      var jl = (await DB.list("journal_lines")).filter(function (l) { return ids[l.entry_id]; });
      for (var j = 0; j < jl.length; j++) await DB.remove("journal_lines", jl[j].id);
      for (var k = 0; k < entries.length; k++) await DB.remove("journal_entries", entries[k].id);
    }
    var pays = (await DB.list("payments")).filter(function (p) { return p.ref === doc.id; });
    for (var m = 0; m < pays.length; m++) await DB.remove("payments", pays[m].id);
    if (doc.pay_move_id) {
      var mv = await DB.get("cash_movements", doc.pay_move_id);
      if (mv) {
        var reg = await DB.get("cash_registers", mv.register_id);
        if (reg) await DB.update("cash_registers", reg.id, { balance: N(reg.balance) - (mv.kind === "in" ? 1 : -1) * N(mv.amount) });
        await DB.remove("cash_movements", mv.id);
      }
    }
    var party = await DB.get(K.party, doc[K.pkey]);
    if (party) await DB.update(K.party, party.id, { balance: N(party.balance) - effect(kind, doc) });
  }

  // d: {party_id, date, book_no, rep_id, location, delivery, discount, paid, register_id, notes, vat_rate, lines:[{product_id, qty, price, unit, note}]}
  async function save(kind, d, existing) {
    var K = KINDS[kind];
    if (!d.party_id) throw new Error("اختر " + K.plabel);
    if (!d.lines || !d.lines.length) throw new Error("أضف منتجًا واحدًا على الأقل");
    if (!d.date) throw new Error("اختر التاريخ");
    var c = compute(kind, d);
    if (c.paid > c.total + 0.004) throw new Error("المدفوع أكبر من إجمالي الفاتورة");

    // التحقق من رصيد الخزينة (سداد مورد) قبل أي تغيير
    if (kind === "purchase" && c.paid > 0 && d.register_id) {
      var rg = await DB.get("cash_registers", d.register_id);
      var avail = rg ? N(rg.balance) : 0;
      if (existing && existing.pay_move_id && existing.register_id === d.register_id) avail += N(existing.paid);
      if (c.paid > avail + 0.004) throw new Error("رصيد الخزينة غير كافٍ للسداد");
    }

    if (existing) await reverse(kind, existing);
    var number = existing ? existing.number : await DB.nextNumber(K.seq);
    var header = {
      number: number, date: d.date, status: "posted",
      gross: c.gross, discount: c.discount, subtotal: c.subtotal, vat_rate: c.vat_rate, vat_amount: c.vat, delivery: c.delivery, total: c.total, paid: c.paid,
      book_no: d.book_no || "", rep_id: d.rep_id || "", location: d.location || "", notes: d.notes || "", register_id: d.register_id || "", pay_move_id: "",
    };
    header[K.pkey] = d.party_id;
    var docId;
    if (existing) { await DB.update(K.table, existing.id, header); docId = existing.id; }
    else { docId = (await DB.insert(K.table, header)).id; }

    var cogs = 0;
    for (var i = 0; i < d.lines.length; i++) {
      var l = d.lines[i];
      var prod = await DB.get("products", l.product_id);
      var cost = prod ? N(prod.cost) : 0;
      var rec = { product_id: l.product_id, qty: N(l.qty), unit: l.unit || "", note: l.note || "" };
      rec[K.fk] = docId; rec[K.price] = N(l.price);
      if (kind === "sale") rec.cost = cost;
      await DB.insert(K.lines, rec);
      if (prod) {
        var patch = { qty: N(prod.qty) + K.stock * N(l.qty) };
        if (kind === "purchase") patch.cost = N(l.price);
        await DB.update("products", prod.id, patch);
      }
      cogs += cost * N(l.qty);
    }
    cogs = r2(cogs);

    var party = await DB.get(K.party, d.party_id);
    var label = K.title + " #" + number;
    if (kind === "sale") {
      await postJournal(d.date, "قيد " + label, "sale", docId, [["a3", c.total, 0], ["a7", 0, c.subtotal + c.delivery], ["a5b", 0, c.vat], ["a9", cogs, 0], ["a4", 0, cogs]]);
    } else if (kind === "purchase") {
      await postJournal(d.date, "قيد " + label, "purchase", docId, [["a4", c.subtotal + c.delivery, 0], ["a12", c.vat, 0], ["a5", 0, c.total]]);
    } else if (kind === "sale_return") {
      await postJournal(d.date, "قيد " + label, "sale_return", docId, [["a8", c.total, 0], ["a3", 0, c.total], ["a4", cogs, 0], ["a9", 0, cogs]]);
    } else {
      await postJournal(d.date, "قيد " + label, "purchase_return", docId, [["a5", c.total, 0], ["a4", 0, c.total]]);
    }

    var payMoveId = "";
    if (K.paidable && c.paid > 0) {
      var isSale = kind === "sale";
      await DB.insert("payments", {
        kind: isSale ? "receipt" : "payment", party_type: K.ptype, party_id: d.party_id, amount: c.paid, method: d.register_id ? "cash" : "bank",
        register_id: d.register_id || "", date: d.date, ref: docId, notes: (isSale ? "دفعة على فاتورة " : "سداد فاتورة ") + number,
      });
      if (d.register_id) {
        var mv = await Ledger.treasuryMove({
          register_id: d.register_id, type: isSale ? "in" : "out", amount: c.paid, date: d.date, ref: docId,
          party_type: K.ptype, party_id: d.party_id, notes: (isSale ? "تحصيل فاتورة بيع " : "سداد فاتورة شراء ") + number + " — " + (party ? party.name : ""),
        });
        payMoveId = mv.id;
      }
      await postJournal(d.date, (isSale ? "تحصيل " : "سداد ") + label, isSale ? "receipt" : "payment", docId,
        isSale ? [["a1", c.paid, 0], ["a3", 0, c.paid]] : [["a5", c.paid, 0], ["a1", 0, c.paid]]);
    }
    if (payMoveId) await DB.update(K.table, docId, { pay_move_id: payMoveId });

    if (party) {
      var fresh = await DB.get(K.party, party.id);
      var tmp = { total: c.total, paid: c.paid };
      await DB.update(K.party, party.id, { balance: N(fresh.balance) + effect(kind, tmp) });
    }
    return { id: docId, number: number, total: c.total };
  }

  async function remove(kind, id) {
    var K = KINDS[kind];
    var doc = await DB.get(K.table, id);
    if (!doc) throw new Error("المستند غير موجود");
    await reverse(kind, doc);
    await DB.remove(K.table, id);
  }

  async function load(kind, id) {
    var K = KINDS[kind];
    var doc = await DB.get(K.table, id);
    if (!doc) return null;
    var lines = (await DB.list(K.lines)).filter(function (l) { return l[K.fk] === id; });
    return { doc: doc, lines: lines };
  }

  /* ---------- نص الطباعة ---------- */
  function printBody(kind, doc, lines, party, products, company) {
    var K = KINDS[kind], esc = Ledger.esc, money = UI.money;
    var pn = function (id) { var p = products.filter(function (x) { return x.id === id; })[0]; return p ? p.name : "—"; };
    var rows = lines.map(function (l, i) {
      return "<tr><td>" + (i + 1) + "</td><td>" + esc(pn(l.product_id)) + (l.note ? '<div style="color:#667391;font-size:11px">' + esc(l.note) + "</div>" : "") + "</td><td>" + l.qty + (l.unit ? " " + esc(l.unit) : "") +
        "</td><td>" + money(l[K.price]) + "</td><td>" + money(N(l.qty) * N(l[K.price])) + "</td></tr>";
    }).join("");
    var tot = "";
    var add = function (a, b) { tot += "<tr><td>" + a + "</td><td>" + b + "</td></tr>"; };
    add("إجمالي البنود", money(doc.gross != null ? doc.gross : doc.subtotal));
    if (N(doc.discount) > 0) add("الخصم", "-" + money(doc.discount));
    if (K.vatable && N(doc.vat_amount) > 0) add("ض.ق.م (" + (doc.vat_rate || 0) + "%)", money(doc.vat_amount));
    if (N(doc.delivery) > 0) add("الناولون", money(doc.delivery));
    add("الإجمالي", money(doc.total));
    if (K.paidable) { add("المدفوع", money(doc.paid)); add("المتبقي", money(N(doc.total) - N(doc.paid))); }
    return "<h1>" + esc(company.name || "الشركة") + "</h1><h2>" + K.title + " رقم " + doc.number + "</h2>" +
      "<div class=meta><div><div>" + K.plabel + ": <b>" + esc(party ? party.name : "—") + "</b></div><div>التاريخ: " + esc(doc.date || "") + "</div>" +
      (doc.book_no ? "<div>رقم الدفتر: " + esc(doc.book_no) + "</div>" : "") + (doc.location ? "<div>الموقع: " + esc(doc.location) + "</div>" : "") + (doc.notes ? "<div>ملاحظات: " + esc(doc.notes) + "</div>" : "") + "</div>" +
      "<div><div>هاتف: " + esc(company.phone || "") + "</div><div>العنوان: " + esc(company.address || "") + "</div><div>الرقم الضريبي: " + esc(company.tax_id || "") + "</div></div></div>" +
      "<table><thead><tr><th>#</th><th>الصنف</th><th>الكمية</th><th>السعر</th><th>الإجمالي</th></tr></thead><tbody>" + rows + "</tbody></table>" +
      "<table class=totals>" + tot + "</table>";
  }

  window.Invoices = { KINDS: KINDS, compute: compute, effect: effect, save: save, remove: remove, load: load, printBody: printBody };
})();
