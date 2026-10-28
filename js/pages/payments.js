(async function () {
  var page = await UI.init("payments");
  if (!page) return;
  var html = UI.html, money = UI.money;
  var N = function (v) { return Number(v) || 0; };
  var payments = [], customers = [], suppliers = [], registers = [];

  page.innerHTML = html`
    <div class="stack">
      <div class="page-toolbar">
        <div>
          <h2 style="margin:0">سندات قبض وصرف</h2>
          <p class="muted" style="margin:4px 0 0;font-size:12px">تحصيل · سداد · ربط بالخزينة · تعديل وحذف</p>
        </div>
        <div class="row gap">
          <button type="button" class="primary" id="btn-receipt">+ سند قبض</button>
          <button type="button" id="btn-payment">+ سند صرف</button>
        </div>
      </div>
      <div class="card table-wrap" id="list"></div>
    </div>`;

  function newId() {
    if (window.crypto && crypto.randomUUID) return crypto.randomUUID();
    return "id-" + Date.now().toString(36) + Math.random().toString(36).slice(2, 10);
  }
  function partyName(p) {
    if (p.party_type === "customer") {
      var c = customers.filter(function (x) { return x.id === p.party_id; })[0];
      return c ? c.name : "—";
    }
    var s = suppliers.filter(function (x) { return x.id === p.party_id; })[0];
    return s ? s.name : "—";
  }
  function regName(id) {
    if (!id) return "—";
    var r = registers.filter(function (x) { return x.id === id; })[0];
    return r ? r.name : "—";
  }
  // سندات ناتجة عن فاتورة أو شيك تُدار من مصدرها حتى لا يختل ربطها
  function lockReason(p) {
    if (p.cheque_id) return "هذا السند ناتج عن شيك — عدّله من صفحة الشيكات";
    if (p.ref) return "هذا السند مرتبط بفاتورة — عدّله أو احذفه من الفاتورة نفسها";
    return "";
  }

  function render() {
    document.getElementById("list").innerHTML = html`
      <table>
        <thead><tr><th>النوع</th><th>الطرف</th><th>المبلغ</th><th>الطريقة</th><th>الخزينة</th><th>التاريخ</th><th>ملاحظات</th><th></th></tr></thead>
        <tbody>
          ${payments.length === 0 ? html`<tr><td colspan="8" class="empty">لا توجد سندات</td></tr>` :
            payments.map(function (p) {
              var noReg = p.method === "cash" && !p.register_id;
              var locked = !!lockReason(p);
              return html`<tr data-id="${p.id}">
                <td><span class="badge ${p.kind === "receipt" ? "ok" : "warn"}">${p.kind === "receipt" ? "قبض" : "صرف"}</span></td>
                <td>${partyName(p)}</td>
                <td><b>${money(p.amount)}</b></td>
                <td>${p.method === "cash" ? "نقدي" : p.method === "bank" ? "بنك" : p.method === "cheque" ? "شيك" : p.method}</td>
                <td>${regName(p.register_id)}${noReg && !locked ? html` <span class="badge warn" title="سند نقدي غير مسجَّل في أي خزينة — اضغط تعديل واختر الخزينة">غير مسجَّل بالخزينة</span>` : ""}</td>
                <td dir="ltr">${p.date || ""}</td>
                <td class="muted">${p.notes || ""}</td>
                <td class="nw">${locked ? html`<span class="muted" title="${lockReason(p)}">🔒</span>` :
                  html`<button type="button" class="ghost sm" data-act="edit">تعديل</button> <button type="button" class="ghost sm danger" data-act="del">حذف</button>`}</td>
              </tr>`;
            }).join("")}
        </tbody>
      </table>`;
  }

  /* ---------- الروابط المحاسبية للسند (خزينة + قيد) ---------- */
  // السندات الجديدة تحمل move_id/jid؛ القديمة تُطابَق بالتاريخ والمبلغ
  async function findLinks(p) {
    var kind = p.kind === "receipt" ? "in" : "out", nm = partyName(p);
    var mv = null, je = null;
    if (p.move_id) mv = await DB.get("cash_movements", p.move_id, { fresh: true });
    if (!mv && p.register_id) {
      var mine = await DB.listWhere("cash_movements", "register_id", p.register_id);
      var cands = mine.filter(function (m) {
        return m.kind === kind && !m.grp && m.date === p.date && Math.abs(N(m.amount) - N(p.amount)) < 0.005 && (!m.ref || m.ref === p.id);
      });
      mv = cands.filter(function (m) { return String(m.notes || "").indexOf(nm) >= 0; })[0] || cands[0] || null;
    }
    if (p.jid) je = await DB.get("journal_entries", p.jid, { fresh: true });
    if (!je) je = (await DB.listWhere("journal_entries", "source_id", p.id))[0] || null;
    if (!je) {
      var same = (await DB.listWhere("journal_entries", "date", p.date)).filter(function (e) {
        return (e.source === "payment" || e.source === "receipt") && !e.source_id;
      });
      if (same.length) {
        var ls = await DB.listWhereIn("journal_lines", "entry_id", same.map(function (e) { return e.id; }));
        var want = p.kind === "receipt" ? "a3" : "a5";
        var ok = same.filter(function (e) {
          return ls.some(function (l) { return l.entry_id === e.id && l.account_id === want && Math.abs(N(l.debit) + N(l.credit) - N(p.amount)) < 0.005; });
        });
        je = ok.filter(function (e) { return String(e.memo || "").indexOf(nm) >= 0; })[0] || ok[0] || null;
      }
    }
    return { mv: mv, je: je };
  }

  // عكس أثر السند القديم: رصيد الخزينة + حذف الحركة + حذف القيد
  async function undoLinks(L) {
    var jobs = [];
    if (L.mv) {
      var reg = await DB.get("cash_registers", L.mv.register_id, { fresh: true });
      if (reg) jobs.push(DB.update("cash_registers", reg.id, { balance: N(reg.balance) - (L.mv.kind === "in" ? 1 : -1) * N(L.mv.amount) }));
      jobs.push(DB.removeMany("cash_movements", [L.mv.id]));
    }
    if (L.je) {
      var ls = await DB.listWhere("journal_lines", "entry_id", L.je.id);
      jobs.push(DB.removeMany("journal_lines", ls.map(function (l) { return l.id; })));
      jobs.push(DB.removeMany("journal_entries", [L.je.id]));
    }
    await Promise.all(jobs);
  }

  // يتحقق أن أي خزينة لن تصير سالبة بعد (عكس القديم + تطبيق الجديد)
  async function balancesOk(L, newRegId, newSign, newAmount) {
    var ids = [];
    if (L && L.mv) ids.push(L.mv.register_id);
    if (newRegId && ids.indexOf(newRegId) < 0) ids.push(newRegId);
    var got = await Promise.all(ids.map(function (id) { return DB.get("cash_registers", id, { fresh: true }); }));
    var bal = {};
    ids.forEach(function (id, i) { if (got[i]) bal[id] = N(got[i].balance); });
    if (L && L.mv && bal[L.mv.register_id] != null) bal[L.mv.register_id] -= (L.mv.kind === "in" ? 1 : -1) * N(L.mv.amount);
    if (newRegId && bal[newRegId] != null) bal[newRegId] += newSign * newAmount;
    return Object.keys(bal).every(function (k) { return bal[k] >= -0.004; });
  }

  function journalRows(jid, jn, kind, method, date, amount, partyNm, payId) {
    var isReceipt = kind === "receipt", cashAcc = method === "bank" ? "a2" : "a1";
    return [
      { table: "journal_entries", row: { id: jid, number: jn, date: date, memo: (isReceipt ? "سند قبض" : "سند صرف") + (partyNm && partyNm !== "—" ? " — " + partyNm : ""), source: isReceipt ? "receipt" : "payment", source_id: payId } },
      { table: "journal_lines", row: { entry_id: jid, account_id: isReceipt ? cashAcc : "a5", debit: amount, credit: 0 } },
      { table: "journal_lines", row: { entry_id: jid, account_id: isReceipt ? "a3" : cashAcc, debit: 0, credit: amount } },
    ];
  }

  /* ---------- النموذج (إضافة / تعديل) ---------- */
  function openForm(kind, ex) {
    var isReceipt = kind === "receipt", edit = !!ex;
    var parties = isReceipt ? customers : suppliers;
    if (!parties.length) { UI.toast("لا يوجد أطراف", true); return; }
    var ov = document.createElement("div");
    ov.className = "modal-overlay";
    ov.innerHTML = html`<div class="modal card">
      <h3 style="margin-top:0">${edit ? (isReceipt ? "تعديل سند قبض" : "تعديل سند صرف") : (isReceipt ? "سند قبض من عميل" : "سند صرف لمورد")}</h3>
      <form id="f" class="stack">
        <div class="form-grid">
          <div class="field"><label>${isReceipt ? "العميل" : "المورد"}</label>
            <select id="party">${parties.map(function (p) {
              return html`<option value="${p.id}" ${edit && ex.party_id === p.id ? "selected" : ""}>${p.name} (رصيد: ${money(p.balance)})</option>`;
            }).join("")}</select>
          </div>
          <div class="field"><label>المبلغ</label><input id="amount" type="number" step="0.01" required min="0.01" value="${edit ? N(ex.amount) : ""}"></div>
          <div class="field"><label>الطريقة</label>
            <select id="method">
              <option value="cash" ${edit && ex.method === "cash" ? "selected" : ""}>نقدي</option>
              <option value="bank" ${edit && ex.method === "bank" ? "selected" : ""}>بنك</option>
            </select>
          </div>
          <div class="field"><label>الخزينة ${edit ? "" : "(اختياري)"}</label>
            <select id="reg">
              <option value="">— بدون —</option>
              ${registers.map(function (r) {
                return html`<option value="${r.id}" ${edit && ex.register_id === r.id ? "selected" : ""}>${r.name} (${money(r.balance)})</option>`;
              }).join("")}
            </select>
          </div>
          <div class="field"><label>التاريخ</label><input id="date" type="date" value="${edit ? (ex.date || "") : new Date().toISOString().slice(0,10)}"></div>
          <div class="field full"><label>ملاحظات</label><input id="notes" value="${edit ? (ex.notes || "") : ""}"></div>
        </div>
        ${edit && ex.method === "cash" && !ex.register_id ? html`<p class="muted" style="margin:0;font-size:12px">هذا السند غير مسجَّل في أي خزينة. اختر الخزينة ثم احفظ ليُسجَّل في حركاتها.</p>` : ""}
        <div class="row gap" style="justify-content:flex-end">
          <button type="button" class="ghost" id="cancel">إلغاء</button>
          <button class="primary" type="submit">${edit ? "حفظ التعديل" : "حفظ"}</button>
        </div>
      </form>
    </div>`;
    document.body.appendChild(ov);
    ov.querySelector("#cancel").onclick = function () { ov.remove(); };
    ov.onclick = function (e) { if (e.target === ov) ov.remove(); };
    ov.querySelector("#f").onsubmit = async function (e) {
      e.preventDefault();
      var amount = Number(document.getElementById("amount").value) || 0;
      var partyId = document.getElementById("party").value;
      var regId = document.getElementById("reg").value || null;
      var method = document.getElementById("method").value;
      var date = document.getElementById("date").value;
      var notes = document.getElementById("notes").value.trim();
      var sign = isReceipt ? 1 : -1, ptype = isReceipt ? "customer" : "supplier";
      var btn = ov.querySelector("button.primary"); btn.disabled = true;
      try {
        if (amount <= 0) throw new Error("المبلغ غير صحيح");
        if (edit) DB.assertCan("edit");
        var L = edit ? await findLinks(ex) : null;
        // التحقق أولًا قبل أي كتابة
        if (!(await balancesOk(L, regId, sign, amount))) { UI.toast("رصيد الخزينة غير كافٍ", true); btn.disabled = false; return; }

        var payId = edit ? ex.id : newId(), jid = newId(), moveId = regId ? newId() : "";
        var party = await DB.get(isReceipt ? "customers" : "suppliers", partyId, { fresh: true });
        var pnm = party ? party.name : partyName({ party_type: ptype, party_id: partyId });
        var jn = await DB.nextNumber("journal_entries");

        if (edit) await undoLinks(L);

        var rows = journalRows(jid, jn, kind, method, date, amount, pnm, payId);
        if (!edit) rows.unshift({ table: "payments", row: { id: payId, kind: kind, party_type: ptype, party_id: partyId, amount: amount, method: method, register_id: regId || "", date: date, notes: notes, move_id: moveId, jid: jid } });
        await DB.insertRows(rows);
        if (regId) {
          await Ledger.treasuryMove({
            id: moveId, register_id: regId, type: isReceipt ? "in" : "out", amount: amount, date: date, ref: payId,
            party_type: ptype, party_id: partyId, notes: (isReceipt ? "قبض: " : "صرف: ") + pnm + (notes ? " — " + notes : ""),
          });
        }
        if (edit) {
          var me = (DB.me && DB.me()) || {};
          await DB.update("payments", payId, {
            party_id: partyId, amount: amount, method: method, register_id: regId || "", date: date, notes: notes,
            move_id: moveId, jid: jid, edited_at: new Date().toISOString(), edited_by: me.id || "", edited_by_name: me.name || "",
          });
          // رصيد الطرف مشتق من الحركات (الطرف القديم والجديد إن تغيّر)
          var touched = [ex.party_id]; if (partyId !== ex.party_id) touched.push(partyId);
          await Promise.all(touched.map(function (id) { return Ledger.recompute(ptype, id); }));
        } else if (party) {
          await DB.update(isReceipt ? "customers" : "suppliers", party.id, { balance: Math.max(0, N(party.balance) - amount) });
        }
        UI.toast(edit ? "تم تعديل السند" : "تم حفظ السند");
        ov.remove(); await load();
      } catch (err) { UI.toast(err.message, true); btn.disabled = false; }
    };
  }

  /* ---------- الحذف ---------- */
  async function delPayment(p) {
    try { DB.assertCan("delete"); } catch (e) { UI.toast(e.message, true); return; }
    var why = lockReason(p);
    if (why) { UI.toast(why, true); return; }
    if (!confirm("حذف سند " + (p.kind === "receipt" ? "القبض" : "الصرف") + " بمبلغ " + money(p.amount) + " (" + partyName(p) + ")؟\nسيُعكس أثره على رصيد الطرف والخزينة والقيود.")) return;
    try {
      var L = await findLinks(p);
      if (L.mv) {
        // حذف قبض يخصم من الخزينة: لا يجوز أن يجعلها سالبة
        var okBal = await balancesOk(L, null, 0, 0);
        if (!okBal) { UI.toast("الحذف يجعل رصيد الخزينة سالبًا", true); return; }
      }
      await undoLinks(L);
      await DB.removeMany("payments", [p.id]);
      await Ledger.recompute(p.party_type, p.party_id);
      UI.toast("تم حذف السند");
      await load();
    } catch (err) { UI.toast(err.message, true); }
  }

  async function load() {
    DB.refresh();
    var d = await Promise.all([
      DB.list("payments"), DB.list("customers"), DB.list("suppliers"), DB.list("cash_registers"),
    ]);
    payments = d[0]; customers = d[1]; suppliers = d[2]; registers = d[3] || [];
    payments.sort(function (a, b) { return String(b.date || "").localeCompare(String(a.date || "")) || String(b.created_at || "").localeCompare(String(a.created_at || "")); });
    render();
  }

  document.getElementById("list").onclick = function (e) {
    var b = e.target.closest("[data-act]"); if (!b) return;
    var p = payments.filter(function (x) { return x.id === b.closest("tr").getAttribute("data-id"); })[0]; if (!p) return;
    var why = lockReason(p);
    if (why) { UI.toast(why, true); return; }
    if (b.getAttribute("data-act") === "edit") {
      try { DB.assertCan("edit"); } catch (er) { UI.toast(er.message, true); return; }
      openForm(p.kind, p);
    } else delPayment(p);
  };
  document.getElementById("btn-receipt").onclick = function () { openForm("receipt"); };
  document.getElementById("btn-payment").onclick = function () { openForm("payment"); };
  await load();
})();
