(async function () {
  var page = await UI.init("installments");
  if (!page) return;
  var html = UI.html, money = UI.money, esc = Ledger.esc, val = Ledger.val;
  var N = function (v) { return Number(v) || 0; };
  var r2 = function (v) { return Math.round(v * 100) / 100; };
  var plans = [], insts = [], customers = [], registers = [], banks = [], payments = [], sales = [];
  var view = "inst", flt = "open", q = "";
  var company = DB.getCompany() || {}, cur = company.currency || "";
  var FREQ = { monthly: "شهري", biweekly: "كل أسبوعين", weekly: "أسبوعي" };

  page.innerHTML = html`
    <div class="stack">
      <div class="page-toolbar">
        <div>
          <h2 style="margin:0">أقساط العملاء</h2>
          <p class="muted" style="margin:4px 0 0;font-size:12px">جدولة سداد مديونية العميل · تحصيل كل قسط كسند قبض يدخل الخزينة · تذكير واتساب</p>
        </div>
        <div class="row gap">
          <div class="seg" id="seg"><button type="button" data-v="inst" class="on">الأقساط</button><button type="button" data-v="plans">الخطط</button></div>
          <button type="button" class="primary" id="btn-add">+ خطة تقسيط</button>
        </div>
      </div>
      <div class="stats-grid" id="stats"></div>
      <div class="card" id="filters"><div class="row gap" style="flex-wrap:wrap;align-items:flex-end">
        <div class="field" style="flex:1;min-width:160px"><label>بحث</label><input id="f-q" placeholder="اسم العميل..."></div>
        <div class="field" id="flt-wrap"><label>عرض</label><select id="f-flt">
          <option value="open">غير المسددة</option><option value="late">متأخرة</option><option value="week">تستحق خلال 7 أيام</option><option value="up">القادمة</option><option value="paid">المسددة</option><option value="all">الكل</option></select></div>
      </div></div>
      <div class="card table-wrap" id="list"></div>
    </div>`;

  function today() { return Ledger.today(); }
  function newId() { return (window.crypto && crypto.randomUUID) ? crypto.randomUUID() : "id-" + Date.now().toString(36) + Math.random().toString(36).slice(2, 10); }
  function addDays(iso, n) { var d = new Date(iso + "T12:00:00"); d.setDate(d.getDate() + n); return d.toISOString().slice(0, 10); }
  function addMonths(iso, n) {
    var d = new Date(iso + "T12:00:00"), day = d.getDate();
    var t = new Date(d.getFullYear(), d.getMonth() + n, 1, 12); var last = new Date(t.getFullYear(), t.getMonth() + 1, 0, 12).getDate();
    t.setDate(Math.min(day, last)); return t.toISOString().slice(0, 10);
  }
  function schedule(total, n, freq, start) {
    var base = Math.floor(total / n * 100) / 100, out = [];
    for (var i = 0; i < n; i++) {
      var due = freq === "weekly" ? addDays(start, 7 * i) : freq === "biweekly" ? addDays(start, 14 * i) : addMonths(start, i);
      out.push({ no: i + 1, due_date: due, amount: i === n - 1 ? r2(total - base * (n - 1)) : base });
    }
    return out;
  }
  function paidOf(i) { return payments.filter(function (p) { return p.installment_id === i.id; }).reduce(function (s, p) { return s + N(p.amount); }, 0); }
  function stOf(i) {
    var rem = N(i.amount) - paidOf(i), t = today();
    if (rem <= 0.004) return "paid";
    if (i.due_date < t) return "late";
    return i.due_date <= addDays(t, 7) ? "week" : "up";
  }
  var ST = { paid: ["مسدد", "ok"], late: ["متأخر", "danger"], week: ["هذا الأسبوع", "warn"], up: ["قادم", ""] };
  function cust(id) { return customers.filter(function (c) { return c.id === id; })[0] || {}; }
  function planOf(i) { return plans.filter(function (p) { return p.id === i.plan_id; })[0] || {}; }
  function ofPlan(p) { return insts.filter(function (i) { return i.plan_id === p.id; }).sort(function (a, b) { return N(a.no) - N(b.no); }); }

  function render() {
    var t = today(), open = insts.filter(function (i) { return stOf(i) !== "paid"; });
    var rem = function (i) { return N(i.amount) - paidOf(i); };
    var sum = function (a) { return a.reduce(function (s, i) { return s + rem(i); }, 0); };
    var late = open.filter(function (i) { return stOf(i) === "late"; }), week = open.filter(function (i) { return stOf(i) === "week"; });
    var activePlans = plans.filter(function (p) { return ofPlan(p).some(function (i) { return stOf(i) !== "paid"; }); }).length;
    document.getElementById("stats").innerHTML = [["أقساط متأخرة", sum(late), late.length], ["تستحق خلال 7 أيام", sum(week), week.length], ["إجمالي المتبقي", sum(open)], ["خطط نشطة", activePlans, null, true]]
      .map(function (s) { return '<div class="stat card"><div class="muted" style="font-size:12px">' + s[0] + (s[2] != null ? " (" + s[2] + ")" : "") + '</div><div style="font-size:22px;font-weight:800">' + (s[3] ? s[1] : money(s[1])) + "</div></div>"; }).join("");
    document.getElementById("flt-wrap").style.display = view === "inst" ? "" : "none";
    var term = q.trim().toLowerCase();
    if (view === "inst") {
      var list = insts.filter(function (i) {
        var s = stOf(i);
        if (flt === "open" && s === "paid") return false;
        if ((flt === "late" || flt === "week" || flt === "up" || flt === "paid") && s !== flt) return false;
        return !term || (planOf(i).party_name || cust(i.party_id).name || "").toLowerCase().indexOf(term) !== -1;
      }).sort(function (a, b) { return a.due_date < b.due_date ? -1 : a.due_date > b.due_date ? 1 : 0; });
      document.getElementById("list").innerHTML = html`
        <table><thead><tr><th>العميل</th><th>الخطة</th><th>القسط</th><th>الاستحقاق</th><th>المبلغ</th><th>المسدد</th><th>المتبقي</th><th>الحالة</th><th></th></tr></thead>
        <tbody>${list.length === 0 ? html`<tr><td colspan="9" class="empty">لا توجد أقساط${insts.length ? "" : " — أنشئ خطة تقسيط من «+ خطة تقسيط»"}</td></tr>` : list.map(function (i) {
          var p = planOf(i), s = stOf(i), paid = paidOf(i), cnt = ofPlan(p).length;
          return html`<tr data-id="${i.id}"><td><b>${esc(p.party_name || cust(i.party_id).name || "—")}</b></td><td>#${p.number}</td><td>${i.no} / ${cnt}</td><td dir="ltr">${i.due_date}</td>
            <td>${money(i.amount)}</td><td>${paid > 0 ? money(paid) : "—"}</td><td><b>${s === "paid" ? "—" : money(rem(i))}</b></td>
            <td><span class="badge ${ST[s][1]}">${ST[s][0]}${s !== "paid" && paid > 0 ? " (جزئي)" : ""}</span></td>
            <td class="nw">${s === "paid" ? "" : html`<button type="button" class="sm primary" data-act="collect">تحصيل</button> <button type="button" class="ghost sm" data-act="wa">واتساب</button>`} <button type="button" class="ghost sm" data-act="plan">الجدول</button></td></tr>`; }).join("")}</tbody></table>`;
    } else {
      var pl = plans.filter(function (p) { return !term || (p.party_name || "").toLowerCase().indexOf(term) !== -1; }).sort(function (a, b) { return N(b.number) - N(a.number); });
      document.getElementById("list").innerHTML = html`
        <table><thead><tr><th>#</th><th>العميل</th><th>إجمالي الخطة</th><th>التقدم</th><th>المتبقي</th><th>القسط القادم</th><th></th></tr></thead>
        <tbody>${pl.length === 0 ? html`<tr><td colspan="7" class="empty">لا توجد خطط تقسيط</td></tr>` : pl.map(function (p) {
          var xs = ofPlan(p), paidN = xs.filter(function (i) { return stOf(i) === "paid"; }).length, remain = xs.reduce(function (s, i) { return s + Math.max(0, N(i.amount) - paidOf(i)); }, 0);
          var nxt = xs.filter(function (i) { return stOf(i) !== "paid"; })[0];
          return html`<tr data-plan="${p.id}"><td>${p.number}</td><td><b>${esc(p.party_name || "—")}</b>${p.invoice_number ? html`<div class="muted" style="font-size:12px">فاتورة #${esc(p.invoice_number)}</div>` : ""}</td>
            <td>${money(p.total)}<div class="muted" style="font-size:12px">${p.count} قسط ${FREQ[p.freq] || ""}</div></td><td>${paidN} / ${xs.length}</td><td><b>${money(remain)}</b></td>
            <td dir="ltr">${nxt ? nxt.due_date : "—"}</td><td class="nw"><button type="button" class="sm" data-act="plan">الجدول</button> <button type="button" class="ghost sm danger" data-act="delplan">حذف</button></td></tr>`; }).join("")}</tbody></table>`;
    }
  }

  /* ---------- خطة جديدة ---------- */
  function openNew() {
    if (!customers.length) { UI.toast("أضف عميلًا أولًا", true); return; }
    var debtors = customers.slice().sort(function (a, b) { return N(b.balance) - N(a.balance); });
    Ledger.modal("خطة تقسيط جديدة", html`
      <div class="form-grid">
        <div class="field full"><label>العميل</label><select id="ip-cust">${debtors.map(function (c) { return html`<option value="${c.id}">${esc(c.name)}${N(c.balance) > 0 ? " — عليه " + money(c.balance) : ""}</option>`; }).join("")}</select></div>
        <div class="field full"><label>فاتورة بيع مرتبطة <span class="opt">اختياري</span></label><select id="ip-inv"><option value="">— بدون —</option></select></div>
        <div class="field"><label>المبلغ المراد تقسيطه</label><input id="ip-total" type="number" step="0.01" min="0.01" required></div>
        <div class="field"><label>عدد الأقساط</label><input id="ip-n" type="number" min="2" max="60" value="6" required></div>
        <div class="field"><label>الدورية</label><select id="ip-freq"><option value="monthly">شهري</option><option value="biweekly">كل أسبوعين</option><option value="weekly">أسبوعي</option></select></div>
        <div class="field"><label>تاريخ القسط الأول</label><input id="ip-start" type="date" value="${addMonths(today(), 1)}" required></div>
        <div class="field full"><label>ملاحظات <span class="opt">اختياري</span></label><input id="ip-notes"></div>
        <div class="field full"><label>معاينة الجدول</label><div id="ip-prev" class="muted" style="font-size:13px;line-height:1.9"></div></div>
      </div>
      <p class="muted" style="margin:0;font-size:12px">الجدولة لا تغيّر رصيد العميل؛ الرصيد قائم بالفعل، والتحصيل الفعلي لكل قسط يسجَّل كسند قبض. المقدّم يُسجَّل بسند قبض منفصل قبل الخطة.</p>`,
      async function (ov) {
        var custId = val("ip-cust"), total = r2(N(val("ip-total"))), n = Math.round(N(val("ip-n"))), freq = val("ip-freq"), start = val("ip-start");
        if (total <= 0) throw new Error("اكتب المبلغ المراد تقسيطه");
        if (n < 2 || n > 60) throw new Error("عدد الأقساط من 2 إلى 60");
        if (!start) throw new Error("حدّد تاريخ القسط الأول");
        var c = cust(custId), invId = val("ip-inv"), inv = sales.filter(function (s) { return s.id === invId; })[0];
        var planId = newId(), number = await DB.nextNumber("installment_plans");
        var rows = [{ table: "installment_plans", row: { id: planId, number: number, party_id: custId, party_name: c.name || "", invoice_id: invId, invoice_number: inv ? inv.number : "", total: total, count: n, freq: freq, start_date: start, notes: val("ip-notes").trim() } }];
        schedule(total, n, freq, start).forEach(function (s) { rows.push({ table: "installments", row: { plan_id: planId, party_id: custId, no: s.no, due_date: s.due_date, amount: s.amount } }); });
        await DB.insertRows(rows);
        UI.toast("تم إنشاء خطة التقسيط"); ov.remove(); await load();
      }, "إنشاء الخطة");
    var ovs = document.querySelectorAll(".modal-overlay"), ov = ovs[ovs.length - 1];
    var $ = function (id) { return ov.querySelector("#" + id); };
    function prev() {
      var total = r2(N($("ip-total").value)), n = Math.round(N($("ip-n").value));
      if (total <= 0 || n < 2 || n > 60 || !$("ip-start").value) { $("ip-prev").textContent = "—"; return; }
      var sc = schedule(total, n, $("ip-freq").value, $("ip-start").value);
      $("ip-prev").innerHTML = n + " قسط: " + money(sc[0].amount) + (sc[n - 1].amount !== sc[0].amount ? " (والأخير " + money(sc[n - 1].amount) + ")" : "") + " — من " + sc[0].due_date + " إلى " + sc[n - 1].due_date;
    }
    function fillInv() {
      var id = $("ip-cust").value, mine = sales.filter(function (s) { return s.customer_id === id; }).sort(function (a, b) { return String(b.date || b.created_at).localeCompare(String(a.date || a.created_at)); }).slice(0, 30);
      $("ip-inv").innerHTML = '<option value="">— بدون —</option>' + mine.map(function (s) {
        var due = Math.max(0, N(s.total) - N(s.paid));
        return '<option value="' + esc(s.id) + '" data-due="' + due + '">#' + esc(s.number) + " — " + esc(String(s.date || s.created_at || "").slice(0, 10)) + " — " + money(s.total) + (due > 0 ? " (متبقي " + money(due) + ")" : "") + "</option>";
      }).join("");
      var c = cust(id); if (!N($("ip-total").value) && N(c.balance) > 0) $("ip-total").value = N(c.balance);
      prev();
    }
    $("ip-cust").onchange = function () { $("ip-total").value = ""; fillInv(); };
    $("ip-inv").onchange = function () { var o = $("ip-inv").selectedOptions[0]; if (o && N(o.getAttribute("data-due")) > 0) $("ip-total").value = N(o.getAttribute("data-due")); prev(); };
    ["ip-total", "ip-n", "ip-freq", "ip-start"].forEach(function (id) { $(id).oninput = prev; $(id).onchange = prev; });
    fillInv();
  }

  /* ---------- جدول الخطة ---------- */
  function openPlan(p) {
    var xs = ofPlan(p);
    var ov = document.createElement("div"); ov.className = "modal-overlay";
    ov.innerHTML = '<div class="modal card" style="max-width:760px;width:96vw;max-height:92vh;overflow:auto"><h3 style="margin-top:0">خطة #' + p.number + " — " + esc(p.party_name || "") + '</h3>' +
      '<p class="muted" style="margin:0 0 8px;font-size:13px">إجمالي ' + money(p.total) + " · " + p.count + " قسط " + (FREQ[p.freq] || "") + (p.invoice_number ? " · فاتورة #" + esc(p.invoice_number) : "") + (p.notes ? " · " + esc(p.notes) : "") + "</p>" +
      '<table><thead><tr><th>#</th><th>الاستحقاق</th><th>المبلغ</th><th>المسدد</th><th>الحالة</th><th>التحصيلات</th></tr></thead><tbody>' + xs.map(function (i) {
        var s = stOf(i), pays = payments.filter(function (x) { return x.installment_id === i.id; });
        return '<tr data-i="' + i.id + '"><td>' + i.no + '</td><td dir="ltr">' + i.due_date + "</td><td>" + money(i.amount) + "</td><td>" + (paidOf(i) > 0 ? money(paidOf(i)) : "—") + '</td><td><span class="badge ' + ST[s][1] + '">' + ST[s][0] + "</span></td><td>" +
          pays.map(function (x) { return '<div class="nw">' + money(x.amount) + ' <span class="muted" dir="ltr">' + esc(x.date || "") + '</span> <button type="button" class="ghost sm danger" data-undo="' + esc(x.id) + '">إلغاء</button></div>'; }).join("") +
          (s === "paid" ? "" : '<button type="button" class="sm primary" data-collect="' + esc(i.id) + '">تحصيل</button>') + "</td></tr>";
      }).join("") + '</tbody></table><div class="row gap" style="justify-content:flex-end;margin-top:12px"><button type="button" class="ghost" id="pl-close">إغلاق</button></div></div>';
    document.body.appendChild(ov);
    ov.querySelector("#pl-close").onclick = function () { ov.remove(); };
    ov.onclick = async function (e) {
      if (e.target === ov) { ov.remove(); return; }
      var c = e.target.closest("[data-collect]"), u = e.target.closest("[data-undo]");
      try {
        if (c) { var i = insts.filter(function (x) { return x.id === c.getAttribute("data-collect"); })[0]; ov.remove(); openCollect(i); }
        else if (u) { await undoCollect(payments.filter(function (x) { return x.id === u.getAttribute("data-undo"); })[0]); ov.remove(); }
      } catch (err) { UI.toast(err.message, true); }
    };
  }

  /* ---------- تحصيل قسط ---------- */
  function openCollect(i) {
    var p = planOf(i), remain = r2(N(i.amount) - paidOf(i));
    if (!registers.length && !banks.length) { UI.toast("أنشئ خزينة أو حسابًا بنكيًا أولًا", true); return; }
    Ledger.modal("تحصيل القسط " + i.no + " — " + (p.party_name || ""), html`
      <div class="form-grid">
        <div class="field"><label>المبلغ <span class="opt">المتبقي ${money(remain)}</span></label><input id="ic-amt" type="number" step="0.01" min="0.01" max="${remain}" value="${remain}" required></div>
        <div class="field"><label>التاريخ</label><input id="ic-date" type="date" value="${today()}" required></div>
        <div class="field full"><label>يُودَع في</label><select id="ic-target">
          ${registers.length ? html`<optgroup label="الخزائن">${registers.map(function (r) { return html`<option value="reg:${r.id}">${esc(r.name)}</option>`; }).join("")}</optgroup>` : ""}
          ${banks.length ? html`<optgroup label="البنوك">${banks.map(function (b) { return html`<option value="bank:${b.id}">${esc(b.name)}</option>`; }).join("")}</optgroup>` : ""}</select></div>
        <div class="field full"><label>ملاحظات <span class="opt">اختياري</span></label><input id="ic-notes"></div>
      </div>`, async function (ov) {
      var amt = r2(N(val("ic-amt"))), date = val("ic-date"), t = val("ic-target"), notes = val("ic-notes").trim();
      var fresh = r2(N(i.amount) - paidOf(i));
      if (amt <= 0) throw new Error("المبلغ غير صحيح");
      if (amt > fresh + 0.004) throw new Error("المبلغ أكبر من المتبقي من القسط");
      if (!date || !t) throw new Error("أكمل البيانات");
      var kind = t.split(":")[0], tid = t.slice(kind.length + 1), payId = newId(), jid = newId(), moveId = kind === "reg" ? newId() : "", bmoveId = kind === "bank" ? newId() : "";
      var memo = "تحصيل قسط " + i.no + " من " + p.count + " — خطة #" + p.number + " — " + (p.party_name || "");
      var jn = await DB.nextNumber("journal_entries"), cashAcc = kind === "bank" ? "a2" : "a1";
      await DB.insertRows([
        { table: "payments", row: { id: payId, kind: "receipt", party_type: "customer", party_id: i.party_id, amount: amt, method: kind === "bank" ? "bank" : "cash", register_id: kind === "reg" ? tid : "", bank_id: kind === "bank" ? tid : "", date: date, notes: memo + (notes ? " — " + notes : ""), move_id: moveId, bmove_id: bmoveId, jid: jid, installment_id: i.id, plan_id: p.id } },
        { table: "journal_entries", row: { id: jid, number: jn, date: date, memo: memo, source: "receipt", source_id: payId } },
        { table: "journal_lines", row: { entry_id: jid, account_id: cashAcc, debit: amt, credit: 0 } },
        { table: "journal_lines", row: { entry_id: jid, account_id: "a3", debit: 0, credit: amt } },
      ]);
      if (kind === "reg") await Ledger.treasuryMove({ id: moveId, register_id: tid, type: "in", amount: amt, date: date, ref: payId, party_type: "customer", party_id: i.party_id, notes: "قبض: " + memo });
      else await DB.insertRows([{ table: "bank_movements", row: { id: bmoveId, bank_id: tid, type: "deposit", amount: amt, date: date, notes: memo, register_id: "", cash_move_id: "", jid: jid, ref: payId } }]);
      await Ledger.recompute("customer", i.party_id);
      UI.toast("تم تحصيل القسط"); ov.remove(); await load();
    }, "تحصيل");
  }

  async function undoCollect(pay) {
    if (!pay) return;
    DB.assertCan("delete");
    if (!confirm("إلغاء تحصيل " + money(pay.amount) + "؟ سيُعكس أثره على الخزينة/البنك والقيد ورصيد العميل.")) return;
    if (pay.move_id) {
      var reg = await DB.get("cash_registers", pay.register_id, { fresh: true });
      if (reg) {
        var nb = N(reg.balance) - N(pay.amount);
        if (nb < -0.004) throw new Error("الإلغاء يجعل رصيد الخزينة سالبًا");
        await DB.update("cash_registers", reg.id, { balance: nb });
      }
      await DB.removeMany("cash_movements", [pay.move_id]);
    }
    if (pay.bmove_id) await DB.removeMany("bank_movements", [pay.bmove_id]);
    if (pay.jid) {
      var ls = await DB.listWhere("journal_lines", "entry_id", pay.jid);
      await DB.removeMany("journal_lines", ls.map(function (l) { return l.id; }));
      await DB.removeMany("journal_entries", [pay.jid]);
    }
    await DB.removeMany("payments", [pay.id]);
    await Ledger.recompute("customer", pay.party_id);
    UI.toast("تم إلغاء التحصيل"); await load();
  }

  async function delPlan(p) {
    DB.assertCan("delete");
    var xs = ofPlan(p);
    if (xs.some(function (i) { return paidOf(i) > 0; })) throw new Error("لا يمكن حذف خطة بها تحصيلات — ألغِ التحصيلات أولًا");
    if (!confirm("حذف خطة التقسيط #" + p.number + "؟ (لا يتغير رصيد العميل)")) return;
    await DB.removeMany("installments", xs.map(function (i) { return i.id; }));
    await DB.removeMany("installment_plans", [p.id]);
    UI.toast("تم حذف الخطة"); await load();
  }

  async function load() {
    DB.refresh();
    var d = await Promise.all([DB.list("installment_plans"), DB.list("installments"), DB.list("customers"), DB.list("cash_registers"), DB.list("banks"), DB.list("payments"), DB.list("sales")]);
    plans = d[0] || []; insts = d[1] || []; customers = d[2] || []; registers = d[3] || []; banks = d[4] || []; payments = d[5] || []; sales = d[6] || [];
    render();
  }

  document.getElementById("seg").onclick = function (e) {
    var b = e.target.closest("[data-v]"); if (!b) return;
    this.querySelectorAll("button").forEach(function (x) { x.classList.toggle("on", x === b); });
    view = b.getAttribute("data-v"); render();
  };
  document.getElementById("f-q").oninput = function () { q = this.value; render(); };
  document.getElementById("f-flt").onchange = function () { flt = this.value; render(); };
  document.getElementById("btn-add").onclick = openNew;
  document.getElementById("list").onclick = async function (e) {
    var b = e.target.closest("[data-act]"); if (!b) return;
    var tr = b.closest("tr"), act = b.getAttribute("data-act");
    try {
      if (tr.getAttribute("data-plan")) {
        var p = plans.filter(function (x) { return x.id === tr.getAttribute("data-plan"); })[0];
        if (act === "plan") openPlan(p); else if (act === "delplan") await delPlan(p);
      } else {
        var i = insts.filter(function (x) { return x.id === tr.getAttribute("data-id"); })[0]; if (!i) return;
        if (act === "collect") openCollect(i);
        else if (act === "plan") openPlan(planOf(i));
        else if (act === "wa") {
          var c = cust(i.party_id), pl = planOf(i), rem = r2(N(i.amount) - paidOf(i));
          UI.whatsapp(c.phone, "السلام عليكم " + (pl.party_name || c.name || "") + "،\nتحية طيبة" + (company.name ? " من " + company.name : "") + ".\nنذكّركم بقسط رقم " + i.no + " من " + pl.count + " المستحق بتاريخ " + i.due_date + " بقيمة " + money(rem) + (cur ? " " + cur : "") + ".\nبرجاء السداد في الموعد، وشكرًا لتعاملكم معنا.");
        }
      }
    } catch (err) { UI.toast(err.message, true); }
  };
  try { await load(); } catch (err) { document.getElementById("list").innerHTML = '<div class="empty">تعذّر التحميل: ' + esc(err.message) + "</div>"; }
})();
