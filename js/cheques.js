/* منطق الشيكات: واردة (من عملاء) وصادرة (لموردين) مع الأثر على الأطراف والبنوك والخزائن والقيود */
window.Cheques = (function () {
  var N = function (x) { return Number(x) || 0; };
  var today = function () { return Ledger.today(); };
  var ST = {
    in: { portfolio: ["في الحافظة", ""], deposited: ["مودع بالبنك", "warn"], collected: ["محصّل", "ok"], endorsed: ["مظهّر لمورد", "ok"], bounced: ["مرتجع", "danger"] },
    out: { pending: ["معلّق", "warn"], cleared: ["مصروف", "ok"], bounced: ["ملغي / مرتجع", "danger"] },
  };
  var START = { in: "portfolio", out: "pending" };

  async function ensureAccounts() {
    var accs = await DB.list("accounts");
    var need = [
      { id: "a13", code: "1350", name: "أوراق القبض (شيكات)", type: "asset", parent: null },
      { id: "a14", code: "2150", name: "أوراق الدفع (شيكات)", type: "liability", parent: null },
    ];
    for (var i = 0; i < need.length; i++) if (!accs.some(function (a) { return a.id === need[i].id; })) await DB.insert("accounts", need[i]);
  }
  Ledger.KIND_LABEL.cheque_bounce = "شيك مرتجع";

  async function post(chq, stage, date, memo, dr, cr, amount) {
    var number = await DB.nextNumber("journal_entries");
    var e = await DB.insert("journal_entries", { number: number, date: date, memo: memo, source: "cheque", source_id: chq.id, stage: stage });
    await DB.insert("journal_lines", { entry_id: e.id, account_id: dr, debit: amount, credit: 0 });
    await DB.insert("journal_lines", { entry_id: e.id, account_id: cr, debit: 0, credit: amount });
  }
  async function bumpParty(type, id, delta) {
    var t = type === "customer" ? "customers" : "suppliers", p = await DB.get(t, id);
    if (p) await DB.update(t, id, { balance: N(p.balance) + delta });
  }
  var label = function (c) { return "شيك رقم " + (c.cheque_no || c.number); };

  /* ----- التسجيل الأولي ----- */
  async function postReg(c) {
    var isIn = c.dir === "in", pt = isIn ? "customer" : "supplier", d = c.issue_date || today();
    await DB.insert("payments", { kind: isIn ? "receipt" : "payment", party_type: pt, party_id: c.party_id, amount: N(c.amount), method: "cheque", register_id: "", date: d, notes: label(c), cheque_id: c.id, stage: "reg" });
    await bumpParty(pt, c.party_id, -N(c.amount));
    if (isIn) await post(c, "reg", d, "استلام " + label(c), "a13", "a3", N(c.amount));
    else await post(c, "reg", d, "إصدار " + label(c), "a5", "a14", N(c.amount));
  }
  function validate(d) {
    if (!d.party_id) throw new Error(d.dir === "in" ? "اختر العميل" : "اختر المورد");
    if (N(d.amount) <= 0) throw new Error("المبلغ غير صحيح");
    if (!d.due_date) throw new Error("اكتب تاريخ الاستحقاق");
  }
  async function create(d) {
    validate(d);
    var number = await DB.nextNumber("cheques");
    var c = await DB.insert("cheques", {
      number: number, dir: d.dir, cheque_no: (d.cheque_no || "").trim(), party_id: d.party_id, amount: N(d.amount),
      issue_date: d.issue_date || today(), due_date: d.due_date, bank_name: (d.bank_name || "").trim(), bank_id: d.bank_id || "",
      notes: (d.notes || "").trim(), status: START[d.dir], hist: [{ date: today(), s: START[d.dir] }],
    });
    await postReg(c);
    return c;
  }

  /* ----- إزالة أثر مرحلة ----- */
  async function dropStage(c, stages) {
    var jes = (await DB.list("journal_entries")).filter(function (e) { return e.source_id === c.id && stages.indexOf(e.stage) !== -1; });
    var jl = await DB.list("journal_lines");
    for (var i = 0; i < jes.length; i++) {
      var ls = jl.filter(function (l) { return l.entry_id === jes[i].id; });
      for (var k = 0; k < ls.length; k++) await DB.remove("journal_lines", ls[k].id);
      await DB.remove("journal_entries", jes[i].id);
    }
    var pt = c.dir === "in" ? "customer" : "supplier";
    var pays = (await DB.list("payments")).filter(function (p) { return p.cheque_id === c.id && stages.indexOf(p.stage) !== -1; });
    for (i = 0; i < pays.length; i++) {
      var delta = pays[i].stage === "endorse" ? N(pays[i].amount) : N(pays[i].amount);   // استعادة رصيد الطرف
      await bumpParty(pays[i].party_type, pays[i].party_id, delta);
      await DB.remove("payments", pays[i].id);
    }
    var tx = (await DB.list("party_txns")).filter(function (p) { return p.cheque_id === c.id && stages.indexOf(p.stage) !== -1; });
    for (i = 0; i < tx.length; i++) { await bumpParty(tx[i].party_type, tx[i].party_id, -N(tx[i].amount)); await DB.remove("party_txns", tx[i].id); }
    var bm = (await DB.list("bank_movements")).filter(function (m) { return m.cheque_id === c.id && stages.indexOf(m.stage) !== -1; });
    for (i = 0; i < bm.length; i++) await DB.remove("bank_movements", bm[i].id);
    var cm = (await DB.list("cash_movements")).filter(function (m) { return m.ref === "chq:" + c.id && stages.indexOf(m.stage) !== -1; });
    for (i = 0; i < cm.length; i++) {
      var r = await DB.get("cash_registers", cm[i].register_id);
      if (r) await DB.update("cash_registers", r.id, { balance: N(r.balance) - (cm[i].kind === "in" ? 1 : -1) * N(cm[i].amount) });
      await DB.remove("cash_movements", cm[i].id);
    }
  }
  async function bankBal(id) {
    var b = await DB.get("banks", id); if (!b) throw new Error("الحساب البنكي غير موجود");
    var mv = (await DB.list("bank_movements")).filter(function (m) { return m.bank_id === id; });
    return { b: b, bal: N(b.opening_balance) + mv.reduce(function (s, m) { return s + (m.type === "deposit" ? 1 : -1) * N(m.amount); }, 0) };
  }
  function setS(c, s, extra) {
    var hist = (c.hist || []).concat([{ date: today(), s: s }]);
    return DB.update("cheques", c.id, Object.assign({ status: s, hist: hist }, extra || {}));
  }

  /* ----- انتقال الحالة ----- */
  // o: { to, date, bank_id, register_id, supplier_id }
  async function transition(c, o) {
    var d = o.date || today(), to = o.to, a = N(c.amount), lab = label(c);
    if (c.dir === "in") {
      if (to === "deposited") {
        if (!o.bank_id) throw new Error("اختر الحساب البنكي");
        return setS(c, "deposited", { bank_id: o.bank_id });
      }
      if (to === "collected") {
        if (o.register_id) {
          var rec = await Ledger.treasuryMove({ register_id: o.register_id, type: "in", amount: a, date: d, ref: "chq:" + c.id, notes: "تحصيل " + lab, tab_id: "" });
          await DB.update("cash_movements", rec.id, { stage: "collect" });
          await post(c, "collect", d, "تحصيل " + lab + " نقدًا", "a1", "a13", a);
          return setS(c, "collected", { collect_to: "reg", register_id: o.register_id });
        }
        var bid = o.bank_id || c.bank_id; if (!bid) throw new Error("اختر الحساب البنكي أو الخزينة");
        await DB.insert("bank_movements", { bank_id: bid, type: "deposit", amount: a, date: d, notes: "تحصيل " + lab, cheque_id: c.id, stage: "collect" });
        await post(c, "collect", d, "تحصيل " + lab + " بالبنك", "a2", "a13", a);
        return setS(c, "collected", { collect_to: "bank", bank_id: bid });
      }
      if (to === "endorsed") {
        if (!o.supplier_id) throw new Error("اختر المورد");
        await DB.insert("payments", { kind: "payment", party_type: "supplier", party_id: o.supplier_id, amount: a, method: "cheque", register_id: "", date: d, notes: "تظهير " + lab, cheque_id: c.id, stage: "endorse" });
        await bumpParty("supplier", o.supplier_id, -a);
        await post(c, "endorse", d, "تظهير " + lab + " لمورد", "a5", "a13", a);
        return setS(c, "endorsed", { endorsed_to: o.supplier_id });
      }
      if (to === "bounced") {
        await DB.insert("party_txns", { party_type: "customer", party_id: c.party_id, kind: "cheque_bounce", direction: "inc", amount: a, date: d, notes: "ارتداد " + lab, cheque_id: c.id, stage: "bounce" });
        await bumpParty("customer", c.party_id, a);
        await post(c, "bounce", d, "ارتداد " + lab, "a3", "a13", a);
        return setS(c, "bounced");
      }
    } else {
      if (to === "cleared") {
        var bk = o.bank_id || c.bank_id; if (!bk) throw new Error("اختر الحساب البنكي");
        var bb = await bankBal(bk); if (a > bb.bal + 0.004) throw new Error("رصيد البنك غير كافٍ لصرف الشيك");
        await DB.insert("bank_movements", { bank_id: bk, type: "withdraw", amount: a, date: d, notes: "صرف " + lab, cheque_id: c.id, stage: "clear" });
        await post(c, "clear", d, "صرف " + lab, "a14", "a2", a);
        return setS(c, "cleared", { bank_id: bk });
      }
      if (to === "bounced") {
        await DB.insert("party_txns", { party_type: "supplier", party_id: c.party_id, kind: "cheque_bounce", direction: "inc", amount: a, date: d, notes: "إلغاء " + lab, cheque_id: c.id, stage: "bounce" });
        await bumpParty("supplier", c.party_id, a);
        await post(c, "bounce", d, "إلغاء " + lab, "a14", "a5", a);
        return setS(c, "bounced");
      }
    }
    throw new Error("انتقال غير مدعوم");
  }
  // تراجع إلى الحالة الأولى
  async function undo(c) {
    if (c.status === START[c.dir]) throw new Error("الشيك في حالته الأولى");
    await dropStage(c, ["collect", "endorse", "bounce", "clear"]);
    var hist = (c.hist || []).concat([{ date: today(), s: START[c.dir], note: "تراجع" }]);
    return DB.update("cheques", c.id, { status: START[c.dir], hist: hist, endorsed_to: "", collect_to: "" });
  }
  async function remove(c) {
    await dropStage(c, ["collect", "endorse", "bounce", "clear", "reg"]);
    await DB.remove("cheques", c.id);
  }
  // تعديل: الحقول الوصفية دائمًا؛ المبلغ/الطرف/التواريخ فقط في الحالة الأولى
  async function edit(c, d) {
    var meta = { cheque_no: (d.cheque_no || "").trim(), due_date: d.due_date, bank_name: (d.bank_name || "").trim(), notes: (d.notes || "").trim() };
    if (c.status !== START[c.dir]) return DB.update("cheques", c.id, meta);
    validate(Object.assign({}, c, d));
    await dropStage(c, ["reg"]);
    var nc = Object.assign({}, c, meta, { party_id: d.party_id, amount: N(d.amount), issue_date: d.issue_date || c.issue_date });
    await DB.update("cheques", c.id, nc);
    await postReg(nc);
    return nc;
  }

  return { ST: ST, START: START, ensureAccounts: ensureAccounts, create: create, transition: transition, undo: undo, remove: remove, edit: edit, bankBal: bankBal };
})();
