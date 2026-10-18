/* ============================================================================
   Ledger — طبقة الدفتر المشتركة (أرصدة العملاء/الموردين + حركات الخزائن)
   مستوحاة من منطق رولكس: الرصيد يُشتق من الحركات ولا يُعتمد على رقم مخزَّن.
   عميل : الرصيد = افتتاحي + مبيعات − مردودات − تحصيلات − خصومات ± تسويات
   مورد : الرصيد = افتتاحي + مشتريات − مردودات − مدفوعات − خصومات ± تسويات
   ========================================================================== */
(function () {
  var N = function (x) { return Number(x) || 0; };
  var today = function () { return new Date().toISOString().slice(0, 10); };
  var dayOf = function (r) { return String(r.date || r.created_at || "").slice(0, 10); };

  var KIND_LABEL = {
    sale: "فاتورة بيع", purchase: "فاتورة شراء", sale_return: "مردود بيع", purchase_return: "مردود شراء",
    receipt: "تحصيل", payment: "سداد", discount: "خصم", settlement: "تسوية", opening: "رصيد افتتاحي",
  };

  /* ---------- كشف حساب طرف ---------- */
  // inc = يزيد الرصيد (مدين للعميل / دائن للمورد) ، dec = ينقصه
  async function statement(type, id, from, to) {
    var isC = type === "customer";
    var d = await Promise.all([
      DB.get(isC ? "customers" : "suppliers", id),
      DB.list(isC ? "sales" : "purchases"),
      DB.list(isC ? "sale_returns" : "purchase_returns"),
      DB.list("payments"),
      DB.list("party_txns"),
    ]);
    var party = d[0] || {};
    var key = isC ? "customer_id" : "supplier_id";
    var all = [];
    d[1].filter(function (r) { return r[key] === id && r.status !== "void"; }).forEach(function (r) {
      all.push({ date: dayOf(r), at: r.created_at, kind: isC ? "sale" : "purchase", ref: r.number, desc: r.notes || "", inc: N(r.total), dec: 0 });
    });
    d[2].filter(function (r) { return r[key] === id && r.status !== "void"; }).forEach(function (r) {
      all.push({ date: dayOf(r), at: r.created_at, kind: isC ? "sale_return" : "purchase_return", ref: r.number, desc: r.notes || "", inc: 0, dec: N(r.total) });
    });
    d[3].filter(function (r) { return r.party_type === type && r.party_id === id; }).forEach(function (r) {
      all.push({ date: dayOf(r), at: r.created_at, kind: isC ? "receipt" : "payment", ref: "", desc: r.notes || "", inc: 0, dec: N(r.amount) });
    });
    d[4].filter(function (r) { return r.party_type === type && r.party_id === id; }).forEach(function (r) {
      var up = r.direction === "inc";
      all.push({ date: dayOf(r), at: r.created_at, kind: r.kind, ref: "", desc: r.notes || "", inc: up ? N(r.amount) : 0, dec: up ? 0 : N(r.amount) });
    });
    all.sort(function (a, b) {
      return a.date === b.date ? String(a.at || "").localeCompare(String(b.at || "")) : (a.date < b.date ? -1 : 1);
    });

    var opening = N(party.opening_balance);
    var run = opening, before = opening, rows = [], tin = 0, tdec = 0;
    all.forEach(function (r) {
      if (from && r.date < from) { before += r.inc - r.dec; run = before; return; }
      if (to && r.date > to) return;
      run += r.inc - r.dec; tin += r.inc; tdec += r.dec;
      r.balance = run; rows.push(r);
    });
    var full = opening + all.reduce(function (s, r) { return s + r.inc - r.dec; }, 0);
    return { party: party, opening: from ? before : opening, rows: rows, closing: run, totals: { inc: tin, dec: tdec }, full: full };
  }

  async function recompute(type, id) {
    var s = await statement(type, id);
    await DB.update(type === "customer" ? "customers" : "suppliers", id, { balance: s.full });
    return s.full;
  }
  async function recomputeAll(type) {
    var list = await DB.list(type === "customer" ? "customers" : "suppliers");
    for (var i = 0; i < list.length; i++) await recompute(type, list[i].id);
    return list.length;
  }

  async function journal(date, memo, source, dr, cr, amount) {
    var number = await DB.nextNumber("journal_entries");
    var e = await DB.insert("journal_entries", { number: number, date: date, memo: memo, source: source });
    await DB.insert("journal_lines", { entry_id: e.id, account_id: dr, debit: amount, credit: 0 });
    await DB.insert("journal_lines", { entry_id: e.id, account_id: cr, debit: 0, credit: amount });
  }

  /* ---------- حركة خزينة ---------- */
  // type: in | out | transfer_in | transfer_out | opening
  async function treasuryMove(o) {
    var reg = await DB.get("cash_registers", o.register_id);
    if (!reg) throw new Error("الخزينة غير موجودة");
    var sign = (o.type === "in" || o.type === "transfer_in" || o.type === "opening") ? 1 : -1;
    var amount = N(o.amount);
    if (amount <= 0) throw new Error("المبلغ غير صحيح");
    var rec = await DB.insert("cash_movements", {
      register_id: o.register_id, type: o.type, kind: sign > 0 ? "in" : "out", amount: amount,
      date: o.date || today(), notes: o.notes || "", tab_id: o.tab_id || "",
      party_type: o.party_type || "", party_id: o.party_id || "",
      grp: o.grp || "", counterpart: o.counterpart || "",
    });
    await DB.update("cash_registers", o.register_id, { balance: N(reg.balance) + sign * amount });
    return rec;
  }

  async function transfer(fromId, toId, amount, date, notes) {
    if (fromId === toId) throw new Error("اختر خزينتين مختلفتين");
    var a = await DB.get("cash_registers", fromId), b = await DB.get("cash_registers", toId);
    if (!a || !b) throw new Error("خزينة غير موجودة");
    if (N(amount) > N(a.balance)) throw new Error("رصيد الخزينة المحوَّل منها غير كافٍ");
    var grp = "tr" + Date.now().toString(36);
    await treasuryMove({ register_id: fromId, type: "transfer_out", amount: amount, date: date, grp: grp, counterpart: toId,
      notes: "تحويل إلى " + b.name + (notes ? " — " + notes : "") });
    await treasuryMove({ register_id: toId, type: "transfer_in", amount: amount, date: date, grp: grp, counterpart: fromId,
      notes: "تحويل من " + a.name + (notes ? " — " + notes : "") });
  }

  // رصيد سابق = الرصيد الحالي − صافي الحركات المسجلة (يحافظ على الأرصدة القديمة)
  async function treasuryStatement(regId, from, to) {
    var d = await Promise.all([DB.get("cash_registers", regId), DB.list("cash_movements")]);
    var reg = d[0] || {};
    var mv = d[1].filter(function (m) { return m.register_id === regId; });
    mv.forEach(function (m) {
      var plus = m.type ? (m.type === "in" || m.type === "transfer_in" || m.type === "opening") : m.kind === "in";
      m._s = plus ? 1 : -1; m._d = dayOf(m);
    });
    mv.sort(function (a, b) {
      return a._d === b._d ? String(a.created_at || "").localeCompare(String(b.created_at || "")) : (a._d < b._d ? -1 : 1);
    });
    var net = mv.reduce(function (s, m) { return s + m._s * N(m.amount); }, 0);
    var base = N(reg.balance) - net;
    var run = base, rows = [], tin = 0, tout = 0;
    mv.forEach(function (m) {
      var amt = N(m.amount);
      if (from && m._d < from) { run += m._s * amt; base = run; return; }
      if (to && m._d > to) return;
      run += m._s * amt;
      if (m._s > 0) tin += amt; else tout += amt;
      rows.push({ m: m, inc: m._s > 0 ? amt : 0, out: m._s < 0 ? amt : 0, balance: run });
    });
    return { reg: reg, opening: base, rows: rows, closing: run, totals: { inc: tin, out: tout } };
  }

  /* ---------- تحصيل من عميل / سداد لمورد ---------- */
  async function recordPayment(o) {
    var isC = o.party_type === "customer";
    var amount = N(o.amount);
    if (amount <= 0) throw new Error("المبلغ غير صحيح");
    var date = o.date || today();
    var party = await DB.get(isC ? "customers" : "suppliers", o.party_id);
    if (!party) throw new Error("الطرف غير موجود");
    await DB.insert("payments", {
      kind: isC ? "receipt" : "payment", party_type: o.party_type, party_id: o.party_id, amount: amount,
      method: o.register_id ? "cash" : "bank", register_id: o.register_id || "", date: date, notes: o.notes || "",
    });
    if (o.register_id) {
      await treasuryMove({
        register_id: o.register_id, type: isC ? "in" : "out", amount: amount, date: date, tab_id: o.tab_id,
        party_type: o.party_type, party_id: o.party_id,
        notes: (isC ? "تحصيل من " : "سداد إلى ") + party.name + (o.notes ? " — " + o.notes : ""),
      });
    }
    if (isC) await journal(date, "تحصيل من " + party.name, "receipt", "a1", "a3", amount);
    else await journal(date, "سداد إلى " + party.name, "payment", "a5", "a1", amount);
    return recompute(o.party_type, o.party_id);
  }

  /* ---------- خصم / تسوية ---------- */
  // kind: discount | settlement ; direction: inc | dec (الخصم دائمًا dec)
  async function recordAdjustment(o) {
    var isC = o.party_type === "customer";
    var amount = N(o.amount);
    if (amount <= 0) throw new Error("المبلغ غير صحيح");
    var dir = o.kind === "discount" ? "dec" : (o.direction === "inc" ? "inc" : "dec");
    var date = o.date || today();
    var party = await DB.get(isC ? "customers" : "suppliers", o.party_id);
    if (!party) throw new Error("الطرف غير موجود");
    await DB.insert("party_txns", {
      party_type: o.party_type, party_id: o.party_id, kind: o.kind, direction: dir, amount: amount, date: date, notes: o.notes || "",
    });
    var pa = isC ? "a3" : "a5", ctr = isC ? (o.kind === "discount" ? "a8" : "a7") : "a11";
    var label = (o.kind === "discount" ? "خصم " : "تسوية ") + party.name;
    var up = dir === "inc";
    if (isC) { if (up) await journal(date, label, o.kind, pa, ctr, amount); else await journal(date, label, o.kind, ctr, pa, amount); }
    else { if (up) await journal(date, label, o.kind, ctr, pa, amount); else await journal(date, label, o.kind, pa, ctr, amount); }
    return recompute(o.party_type, o.party_id);
  }

  /* ---------- مودال نموذج موحّد بنفس تصميم النظام ---------- */
  function modal(title, bodyHtml, onSubmit, submitLabel) {
    var ov = document.createElement("div");
    ov.className = "modal-overlay";
    ov.innerHTML = '<div class="modal card"><h3 style="margin-top:0">' + title + '</h3><form id="f" class="stack">' + bodyHtml +
      '<div class="row gap" style="justify-content:flex-end"><button type="button" class="ghost" id="cancel">إلغاء</button>' +
      '<button class="primary" type="submit">' + (submitLabel || "حفظ") + '</button></div></form></div>';
    document.body.appendChild(ov);
    ov.querySelector("#cancel").onclick = function () { ov.remove(); };
    ov.onclick = function (e) { if (e.target === ov) ov.remove(); };
    ov.querySelector("#f").onsubmit = async function (e) {
      e.preventDefault();
      var btn = ov.querySelector("button.primary"); btn.disabled = true;
      try { await onSubmit(ov); } catch (err) { UI.toast(err.message || "خطأ", true); btn.disabled = false; }
    };
    return ov;
  }
  var esc = function (s) { return String(s == null ? "" : s).replace(/[&<>"]/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]; }); };
  var val = function (id) { return document.getElementById(id).value; };

  // ميزان مراجعة الأطراف: لكل طرف رصيد أول الفترة + حركة + رصيد آخر الفترة (تحميل واحد للبيانات)
  async function trial(type, from, to) {
    var isC = type === "customer", key = isC ? "customer_id" : "supplier_id";
    var d = await Promise.all([
      DB.list(isC ? "customers" : "suppliers"), DB.list(isC ? "sales" : "purchases"),
      DB.list(isC ? "sale_returns" : "purchase_returns"), DB.list("payments"), DB.list("party_txns"),
    ]);
    var map = {};
    d[0].forEach(function (p) {
      map[p.id] = { party: p, opening: N(p.opening_balance), before: 0, docs: 0, ret: 0, pay: 0, disc: 0, setl: 0, net: 0, last: "" };
    });
    function add(id, date, field, amt, signInc) {
      var m = map[id]; if (!m) return;
      var delta = signInc ? amt : -amt;
      if (from && date < from) { m.before += delta; return; }
      if (to && date > to) return;
      m[field] += (field === "setl" ? delta : amt); m.net += delta;
      if (date > m.last) m.last = date;
    }
    d[1].forEach(function (r) { if (r.status !== "void") add(r[key], dayOf(r), "docs", N(r.total), true); });
    d[2].forEach(function (r) { if (r.status !== "void") add(r[key], dayOf(r), "ret", N(r.total), false); });
    d[3].forEach(function (r) { if (r.party_type === type) add(r.party_id, dayOf(r), "pay", N(r.amount), false); });
    d[4].forEach(function (r) {
      if (r.party_type !== type) return;
      if (r.kind === "discount") add(r.party_id, dayOf(r), "disc", N(r.amount), false);
      else add(r.party_id, dayOf(r), "setl", N(r.amount), r.direction === "inc");
    });
    return Object.keys(map).map(function (id) {
      var m = map[id];
      // التسوية: تُحتسب إشارتها (زيادة +، نقص −) في صافي الحركة
      m.start = m.opening + m.before; m.end = m.start + m.net;
      return m;
    });
  }

  window.Ledger = {
    trial: trial,
    modal: modal, esc: esc, val: val,
    KIND_LABEL: KIND_LABEL, statement: statement, recompute: recompute, recomputeAll: recomputeAll,
    treasuryMove: treasuryMove, transfer: transfer, treasuryStatement: treasuryStatement,
    recordPayment: recordPayment, recordAdjustment: recordAdjustment, today: today,
  };
})();
