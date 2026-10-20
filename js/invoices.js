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

  function uid() {
    if (window.crypto && crypto.randomUUID) return crypto.randomUUID();
    return "id-" + Date.now().toString(36) + Math.random().toString(36).slice(2, 10);
  }
  // يبني قيدًا (رأس + سطور) كصفوف جاهزة؛ number = رقم القيد. يُرجع [] لو لا مبالغ.
  function buildJournal(number, date, memo, source, docId, rows) {
    rows = rows.filter(function (r) { return N(r[1]) > 0.004 || N(r[2]) > 0.004; });
    if (!rows.length) return [];
    var eid = uid();
    var out = [{ table: "journal_entries", row: { id: eid, number: number, date: date, memo: memo, source: source, source_id: docId } }];
    rows.forEach(function (r) {
      out.push({ table: "journal_lines", row: { entry_id: eid, account_id: r[0], debit: r2(N(r[1])), credit: r2(N(r[2])) } });
    });
    return out;
  }

  // عكس كل أثر المستند (مخزون، قيود، دفعات، حركة خزينة، رصيد الطرف) ثم حذف بنوده
  // القراءات بالتوازي بفلترة على السيرفر، والكتابات بالتوازي على صفوف مختلفة (لا تعارض بينها)
  async function reverse(kind, doc) {
    var K = KINDS[kind];
    var r = await Promise.all([
      DB.listWhere(K.lines, K.fk, doc.id),
      DB.listWhere("journal_entries", "source_id", doc.id),
      DB.listWhere("payments", "ref", doc.id),
      doc.pay_move_id ? DB.get("cash_movements", doc.pay_move_id, { fresh: true }) : null,
      DB.get(K.party, doc[K.pkey], { fresh: true }),
    ]);
    var old = r[0], entries = r[1], pays = r[2], mv = r[3], party = r[4];

    var byProd = {};
    old.forEach(function (l) { byProd[l.product_id] = (byProd[l.product_id] || 0) + N(l.qty); });
    var pids = Object.keys(byProd);
    var r2s = await Promise.all([
      Promise.all(pids.map(function (id) { return DB.get("products", id, { fresh: true }); })),
      entries.length ? DB.listWhereIn("journal_lines", "entry_id", entries.map(function (e) { return e.id; })) : [],
      mv ? DB.get("cash_registers", mv.register_id, { fresh: true }) : null,
    ]);
    var prods = r2s[0], jl = r2s[1], reg = r2s[2];
    var ids = function (arr) { return arr.map(function (x) { return x.id; }); };

    var jobs = [];
    prods.forEach(function (p, i) {
      if (p) jobs.push(DB.update("products", p.id, { qty: N(p.qty) - K.stock * byProd[pids[i]] }));
    });
    if (mv && reg) jobs.push(DB.update("cash_registers", reg.id, { balance: N(reg.balance) - (mv.kind === "in" ? 1 : -1) * N(mv.amount) }));
    if (party) jobs.push(DB.update(K.party, party.id, { balance: N(party.balance) - effect(kind, doc) }));
    jobs.push(DB.removeMany(K.lines, ids(old)));
    jobs.push(DB.removeMany("journal_lines", ids(jl)));
    jobs.push(DB.removeMany("journal_entries", ids(entries)));
    jobs.push(DB.removeMany("payments", ids(pays)));
    if (mv) jobs.push(DB.removeMany("cash_movements", [mv.id]));
    await Promise.all(jobs);
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
      var rg = await DB.get("cash_registers", d.register_id, { fresh: true });
      var avail = rg ? N(rg.balance) : 0;
      if (existing && existing.pay_move_id && existing.register_id === d.register_id) avail += N(existing.paid);
      if (c.paid > avail + 0.004) throw new Error("رصيد الخزينة غير كافٍ للسداد");
    }

    if (existing) await reverse(kind, existing);

    // بعد العكس: قراءة طازجة (بالتوازي) للأصناف والطرف ورقم المستند ورقم القيد
    var pids = []; d.lines.forEach(function (l) { if (pids.indexOf(l.product_id) < 0) pids.push(l.product_id); });
    var pre = await Promise.all([
      Promise.all(pids.map(function (id) { return DB.get("products", id, { fresh: true }); })),
      DB.get(K.party, d.party_id, { fresh: true }),
      existing ? existing.number : DB.nextNumber(K.seq),
      DB.nextNumber("journal_entries"),
    ]);
    var prodMap = {}; pre[0].forEach(function (p, i) { if (p) prodMap[pids[i]] = p; });
    var party = pre[1], number = pre[2], jn = pre[3];

    var docId = existing ? existing.id : uid();
    var payMoveId = (K.paidable && c.paid > 0 && d.register_id) ? uid() : "";
    var header = {
      number: number, date: d.date, status: "posted",
      gross: c.gross, discount: c.discount, subtotal: c.subtotal, vat_rate: c.vat_rate, vat_amount: c.vat, delivery: c.delivery, total: c.total, paid: c.paid,
      book_no: d.book_no || "", rep_id: d.rep_id || "", location: d.location || "", notes: d.notes || "", register_id: d.register_id || "", pay_move_id: payMoveId,
    };
    header[K.pkey] = d.party_id;

    // بنود المستند + تجميع تغيّر المخزون لكل صنف + التكلفة
    var rows = [], cogs = 0, qtyDelta = {}, lastCost = {};
    d.lines.forEach(function (l) {
      var prod = prodMap[l.product_id];
      var cost = prod ? N(prod.cost) : 0;
      var rec = { product_id: l.product_id, qty: N(l.qty), unit: l.unit || "", note: l.note || "" };
      rec[K.fk] = docId; rec[K.price] = N(l.price);
      if (kind === "sale") rec.cost = cost;
      rows.push({ table: K.lines, row: rec });
      if (prod) {
        qtyDelta[l.product_id] = (qtyDelta[l.product_id] || 0) + K.stock * N(l.qty);
        if (kind === "purchase") lastCost[l.product_id] = N(l.price);
      }
      cogs += cost * N(l.qty);
    });
    cogs = r2(cogs);
    if (!existing) rows.unshift({ table: K.table, row: Object.assign({ id: docId }, header) });

    var label = K.title + " #" + number;
    var j1;
    if (kind === "sale") j1 = [["a3", c.total, 0], ["a7", 0, c.subtotal + c.delivery], ["a5b", 0, c.vat], ["a9", cogs, 0], ["a4", 0, cogs]];
    else if (kind === "purchase") j1 = [["a4", c.subtotal + c.delivery, 0], ["a12", c.vat, 0], ["a5", 0, c.total]];
    else if (kind === "sale_return") j1 = [["a8", c.total, 0], ["a3", 0, c.total], ["a4", cogs, 0], ["a9", 0, cogs]];
    else j1 = [["a5", c.total, 0], ["a4", 0, c.total]];
    var jr = buildJournal(jn, d.date, "قيد " + label, kind, docId, j1);
    rows = rows.concat(jr);
    if (jr.length) jn++;

    var isSale = kind === "sale";
    if (K.paidable && c.paid > 0) {
      rows.push({ table: "payments", row: {
        kind: isSale ? "receipt" : "payment", party_type: K.ptype, party_id: d.party_id, amount: c.paid, method: d.register_id ? "cash" : "bank",
        register_id: d.register_id || "", date: d.date, ref: docId, notes: (isSale ? "دفعة على فاتورة " : "سداد فاتورة ") + number,
      } });
      rows = rows.concat(buildJournal(jn, d.date, (isSale ? "تحصيل " : "سداد ") + label, isSale ? "receipt" : "payment", docId,
        isSale ? [["a1", c.paid, 0], ["a3", 0, c.paid]] : [["a5", c.paid, 0], ["a1", 0, c.paid]]));
    }

    // كل الإدخالات في طلب واحد، والتحديثات على صفوف مختلفة بالتوازي
    var jobs = [DB.insertRows(rows)];
    if (existing) jobs.push(DB.update(K.table, docId, header));
    Object.keys(qtyDelta).forEach(function (pid) {
      var patch = { qty: N(prodMap[pid].qty) + qtyDelta[pid] };
      if (pid in lastCost) patch.cost = lastCost[pid];
      jobs.push(DB.update("products", pid, patch));
    });
    if (payMoveId) {
      jobs.push(Ledger.treasuryMove({
        id: payMoveId, register_id: d.register_id, type: isSale ? "in" : "out", amount: c.paid, date: d.date, ref: docId,
        party_type: K.ptype, party_id: d.party_id, notes: (isSale ? "تحصيل فاتورة بيع " : "سداد فاتورة شراء ") + number + " — " + (party ? party.name : ""),
      }));
    }
    if (party) jobs.push(DB.update(K.party, party.id, { balance: N(party.balance) + effect(kind, { total: c.total, paid: c.paid }) }));
    await Promise.all(jobs);
    return { id: docId, number: number, total: c.total };
  }

  async function remove(kind, id) {
    var K = KINDS[kind];
    var doc = await DB.get(K.table, id, { fresh: true });
    if (!doc) throw new Error("المستند غير موجود");
    await reverse(kind, doc);
    await DB.remove(K.table, id);
  }

  async function load(kind, id) {
    var K = KINDS[kind];
    var r = await Promise.all([DB.get(K.table, id), DB.listWhere(K.lines, K.fk, id)]);
    if (!r[0]) return null;
    return { doc: r[0], lines: r[1] };
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
      "<div><div>هاتف: " + esc(company.phone || "") + "</div><div>العنوان: " + esc(company.address || "") + "</div><div>الرقم الضريبي: " + esc(company.tax_id || "") + "</div>" + (company.currency ? "<div>العملة: " + esc(company.currency) + "</div>" : "") + "</div></div>" +
      "<table><thead><tr><th>#</th><th>الصنف</th><th>الكمية</th><th>السعر</th><th>الإجمالي</th></tr></thead><tbody>" + rows + "</tbody></table>" +
      "<table class=totals>" + tot + "</table>";
  }

  window.Invoices = { KINDS: KINDS, compute: compute, effect: effect, save: save, remove: remove, load: load, printBody: printBody };
})();
