/* صفحة الخزينة (نمط ROLLEX): لوحة علوية · حركات مرقّمة · تبويب عام/خاص · تحويل · جرد نقدية · بحث ذكي */
(async function () {
  var page = await UI.init("cash-registers", { title: ["الخزينة", "حركات · تحويل · جرد النقدية"] });
  if (!page) return;
  var html = UI.html, money = UI.money, esc = Ledger.esc, val = Ledger.val, today = Ledger.today();
  var N = function (x) { return Number(x) || 0; };
  var qs = new URLSearchParams(location.search);
  var registers = [], tabs = [], moves = [], counts = [], reg = null;
  var f = { text: "", from: "", to: "", type: "", sortSeq: false };
  var TYPE = { in: ["وارد", "ok"], out: ["منصرف", "warn"], transfer_in: ["تحويل وارد", "ok"], transfer_out: ["تحويل صادر", "warn"], opening: ["رصيد افتتاحي", ""] };
  var DENOMS = [200, 100, 50, 20, 10, 5, 1, 0.5, 0.25];

  /* تطبيع عربي للبحث */
  function norm(s) {
    return String(s || "").toLowerCase().replace(/[ً-ْـ]/g, "").replace(/[أإآ]/g, "ا").replace(/ى/g, "ي").replace(/ة/g, "ه")
      .replace(/[٠-٩]/g, function (c) { return String(c.charCodeAt(0) - 0x660); });
  }
  function hl(text, term) {
    var t = String(text || ""); if (!term) return esc(t);
    var nq = norm(term); if (!nq) return esc(t);
    var chars = [], map = [], i;
    for (i = 0; i < t.length; i++) { var c = norm(t.charAt(i)); for (var k = 0; k < c.length; k++) { chars.push(c.charAt(k)); map.push(i); } }
    var nt = chars.join(""), out = "", pos = 0, from = 0, idx;
    while ((idx = nt.indexOf(nq, from)) !== -1) {
      var s0 = map[idx], e0 = map[idx + nq.length - 1] + 1;
      while (e0 < t.length && /[\u064B-\u0652]/.test(t.charAt(e0))) e0++;
      out += esc(t.slice(pos, s0)) + "<mark>" + esc(t.slice(s0, e0)) + "</mark>"; pos = e0; from = idx + nq.length;
    }
    return out + esc(t.slice(pos));
  }
  var dayOf = function (m) { return String(m.date || m.created_at || "").slice(0, 10); };
  var isPlus = function (m) { return m.type ? (m.type === "in" || m.type === "transfer_in" || m.type === "opening") : m.kind === "in"; };
  var tabName = function (id) { var t = tabs.filter(function (x) { return x.id === id; })[0]; return t ? t.name : ""; };
  var locked = function (m) { return !!(m.ref || m.party_id); };           // مرتبطة بفاتورة/تحصيل: لا تُحذف من هنا
  var isTransfer = function (m) { return m.type === "transfer_in" || m.type === "transfer_out"; };

  page.innerHTML = html`
    <div class="stack tre-page">
      <div class="card top-panel" id="top"></div>
      <div class="card" id="tr-box" style="display:none"></div>
      <div class="card"><div class="form-grid tre-filters">
        <div class="field full"><label>بحث في البيان</label><input id="f-text" placeholder="اكتب جزءًا من البيان…" autocomplete="off"></div>
        <div class="field"><label>من تاريخ</label><input type="date" id="f-from"></div>
        <div class="field"><label>إلى تاريخ</label><input type="date" id="f-to"></div>
        <div class="field"><label>النوع</label><select id="f-type"><option value="">الكل</option>${Object.keys(TYPE).map(function (k) { return '<option value="' + k + '">' + TYPE[k][0] + "</option>"; }).join("")}</select></div>
        <div class="field" style="align-self:end"><label class="check"><input type="checkbox" id="f-seq"> ترتيب حسب رقم الحركة</label></div>
      </div>
      <div class="tre-info" id="info"></div></div>
      <div class="card table-wrap" id="tbl"></div>
    </div>`;

  async function load() {
    var d = await Promise.all([DB.list("cash_registers"), DB.list("treasury_tabs"), DB.list("cash_movements"), DB.list("cash_counts")]);
    registers = d[0].slice().sort(function (a, b) { return (a.created_at || "").localeCompare(b.created_at || ""); });
    tabs = d[1]; 
    var id = qs.get("id") || (reg && reg.id) || (registers[0] && registers[0].id);
    reg = registers.filter(function (r) { return r.id === id; })[0] || registers[0] || null;
    moves = reg ? d[2].filter(function (m) { return m.register_id === reg.id; }) : [];
    counts = reg ? d[3].filter(function (c) { return c.register_id === reg.id; }) : [];
    draw();
  }

  /* ترتيب + رصيد جارٍ */
  function ordered() {
    var list = moves.slice();
    // الحركات القديمة بلا seq تأخذ رقمًا حسب ترتيب الإنشاء
    var byCreated = moves.slice().sort(function (a, b) { return String(a.created_at || "").localeCompare(String(b.created_at || "")); });
    var n = 0; byCreated.forEach(function (m) { n++; m._n = N(m.seq) || n; m._d = dayOf(m); });
    list.sort(function (a, b) {
      if (f.sortSeq) return a._n - b._n;
      return a._d === b._d ? a._n - b._n : (a._d < b._d ? -1 : 1);
    });
    var net = moves.reduce(function (s, m) { return s + (isPlus(m) ? 1 : -1) * N(m.amount); }, 0);
    var run = N(reg.balance) - net;
    list.forEach(function (m) { run += (isPlus(m) ? 1 : -1) * N(m.amount); m._bal = run; });
    return list;
  }

  function drawTop() {
    var tin = 0, tout = 0;
    moves.forEach(function (m) { if (m.type === "opening") return; if (isPlus(m)) tin += N(m.amount); else tout += N(m.amount); });
    document.getElementById("top").innerHTML = html`
      <div class="top-row">
        <a class="button small" href="cash-registers.html">← الخزائن</a>
        <select id="reg-sel" class="reg-sel">${registers.map(function (r) { return '<option value="' + r.id + '"' + (r.id === reg.id ? " selected" : "") + ">" + esc(r.name) + "</option>"; }).join("")}</select>
        <div class="chips">
          <div class="chip big"><span>الرصيد</span><b>${money(reg.balance)}</b></div>
          <div class="chip ok"><span>إجمالي الوارد</span><b>${money(tin)}</b></div>
          <div class="chip warn"><span>إجمالي المنصرف</span><b>${money(tout)}</b></div>
          <div class="chip"><span>عدد الحركات</span><b>${moves.length}</b></div>
        </div>
      </div>
      <div class="top-actions">
        <button type="button" class="primary" id="b-count">جرد النقدية</button>
        <button type="button" class="primary" id="b-add">+ إضافة حركة</button>
        <button type="button" id="b-open">رصيد افتتاحي</button>
        <button type="button" id="b-tr">تحويل بين الخزائن</button>
        <button type="button" id="b-csv">تصدير Excel</button>
        <button type="button" id="b-print">طباعة PDF</button>
        <button type="button" id="b-imp">استيراد Excel</button>
        <button type="button" id="b-ref">تحديث</button>
        <input type="file" id="imp-file" accept=".csv,text/csv" style="display:none">
      </div>`;
    document.getElementById("reg-sel").onchange = function () { qs.set("id", val("reg-sel")); history.replaceState(null, "", "?id=" + val("reg-sel")); load(); };
    document.getElementById("b-count").onclick = openCount;
    document.getElementById("b-add").onclick = function () { openMove(null); };
    document.getElementById("b-open").onclick = openOpening;
    document.getElementById("b-tr").onclick = toggleTransfer;
    document.getElementById("b-csv").onclick = exportCsv;
    document.getElementById("b-print").onclick = printIt;
    document.getElementById("b-ref").onclick = function () { load(); UI.toast("تم التحديث"); };
    document.getElementById("b-imp").onclick = function () { document.getElementById("imp-file").click(); };
    document.getElementById("imp-file").onchange = importCsv;
  }

  var view = [];
  function draw() {
    if (!reg) { page.innerHTML = '<div class="card empty">لا توجد خزائن. أضف خزينة من صفحة الخزائن.</div>'; return; }
    drawTop();
    var all = ordered(), nq = norm(f.text.trim());
    view = all.filter(function (m) {
      var ty = m.type || (m.kind === "in" ? "in" : "out");
      return (!f.from || m._d >= f.from) && (!f.to || m._d <= f.to) && (!f.type || ty === f.type) &&
        (!nq || norm(m.notes).indexOf(nq) !== -1);
    });
    var tin = view.reduce(function (s, m) { return s + (isPlus(m) ? N(m.amount) : 0); }, 0), tout = view.reduce(function (s, m) { return s + (isPlus(m) ? 0 : N(m.amount)); }, 0);
    document.getElementById("info").innerHTML = (nq || f.from || f.to || f.type)
      ? html`<span>النتائج: <b>${view.length}</b> من ${moves.length}</span><span>وارد: <b>${money(tin)}</b></span><span>صادر: <b>${money(tout)}</b></span><span>الصافي: <b>${money(tin - tout)}</b></span>
          <button type="button" class="small" id="b-copy">نسخ النتائج</button>`
      : html`<span class="muted">${moves.length} حركة</span>`;
    var cp = document.getElementById("b-copy");
    if (cp) cp.onclick = function () {
      var txt = view.map(function (m) { return [m._n, m._d, m.notes || "", isPlus(m) ? N(m.amount) : "", isPlus(m) ? "" : N(m.amount)].join("\t"); }).join("\n");
      (navigator.clipboard ? navigator.clipboard.writeText(txt) : Promise.reject()).then(function () { UI.toast("تم نسخ النتائج"); }, function () { UI.toast("تعذّر النسخ", true); });
    };
    document.getElementById("tbl").innerHTML = html`
      <table class="tre-table"><thead><tr><th>رقم الحركة</th><th>التاريخ</th><th>البيان</th><th>النوع</th><th>وارد</th><th>صادر</th><th>التبويب العام</th><th>التبويب الخاص</th><th>الرصيد</th><th>إجراءات</th></tr></thead><tbody>
      ${view.map(function (m) {
        var ty = TYPE[m.type || (m.kind === "in" ? "in" : "out")] || ["—", ""], plus = isPlus(m);
        return html`<tr data-id="${m.id}"><td dir="ltr"><b>${m._n}</b></td><td dir="ltr">${m._d}</td>
          <td class="desc">${hl(m.notes, f.text.trim())}${locked(m) ? ' <span class="badge">مرتبطة</span>' : ""}</td>
          <td><span class="badge ${ty[1]}">${ty[0]}</span></td>
          <td class="in-c">${plus ? money(m.amount) : ""}</td><td class="out-c">${plus ? "" : money(m.amount)}</td>
          <td>${esc(tabName(m.tab_id)) || "—"}</td><td>${esc(tabName(m.ptab_id)) || "—"}</td>
          <td class="accent"><b>${money(m._bal)}</b></td>
          <td><div class="actions-cell"><button class="small" data-act="edit">تعديل</button>${locked(m) ? "" : '<button class="small danger" data-act="del">حذف</button>'}</div></td></tr>`;
      }).join("") || '<tr><td colspan="10" class="empty">لا توجد حركات</td></tr>'}
      </tbody></table>`;
  }

  /* ---------- حركة (إضافة/تعديل) ---------- */
  function tabOpts(kind, sel) {
    return '<option value="">— بدون —</option>' + tabs.filter(function (t) { return (t.kind === "private") === (kind === "private"); })
      .map(function (t) { return '<option value="' + t.id + '"' + (t.id === sel ? " selected" : "") + ">" + esc(t.name) + "</option>"; }).join("");
  }
  function newId() {
    if (window.crypto && crypto.randomUUID) return crypto.randomUUID();
    return "id-" + Date.now().toString(36) + Math.random().toString(36).slice(2, 10);
  }
  // يبني قيد الحركة (3 صفوف) جاهزًا للإدخال الجماعي؛ يُرجع {id, rows}
  function moveJournalRows(jn, kind, amount, date, regName) {
    var id = newId();
    return { id: id, rows: [
      { table: "journal_entries", row: { id: id, number: jn, date: date, memo: (kind === "in" ? "وارد خزينة: " : "منصرف خزينة: ") + regName, source: "cash" } },
      { table: "journal_lines", row: { entry_id: id, account_id: kind === "in" ? "a1" : "a10", debit: amount, credit: 0 } },
      { table: "journal_lines", row: { entry_id: id, account_id: kind === "in" ? "a7" : "a1", debit: 0, credit: amount } },
    ] };
  }
  async function postMoveJournal(kind, amount, date, regName) {
    var jn = await DB.nextNumber("journal_entries");
    var j = moveJournalRows(jn, kind, amount, date, regName);
    await DB.insertRows(j.rows);
    return j.id;
  }
  async function dropJournal(id) {
    if (!id) return;
    var ls = await DB.listWhere("journal_lines", "entry_id", id);
    await Promise.all([DB.removeMany("journal_lines", ls.map(function (l) { return l.id; })), DB.remove("journal_entries", id)]);
  }

  function openMove(m) {
    var edit = !!m, lk = edit && (locked(m) || isTransfer(m) || m.type === "opening");
    var kind = edit ? (isPlus(m) ? "in" : "out") : "in";
    Ledger.modal(edit ? "تعديل الحركة #" + m._n : "إضافة حركة", html`
      <div class="form-grid">
        <div class="field"><label>النوع</label><select id="m-kind" ${lk ? "disabled" : ""}><option value="in"${kind === "in" ? " selected" : ""}>وارد (إيداع)</option><option value="out"${kind === "out" ? " selected" : ""}>منصرف (صرف)</option></select></div>
        <div class="field"><label>المبلغ</label><input id="m-amount" type="number" step="0.01" min="0.01" required value="${edit ? N(m.amount) : ""}" ${lk ? "disabled" : ""}></div>
        <div class="field"><label>التاريخ</label><input id="m-date" type="date" value="${edit ? m._d : today}" ${lk ? "disabled" : ""}></div>
        <div class="field"><label>التبويب العام</label><select id="m-tab">${tabOpts("general", edit ? m.tab_id : "")}</select></div>
        <div class="field"><label>التبويب الخاص</label><select id="m-ptab">${tabOpts("private", edit ? m.ptab_id : "")}</select></div>
        <div class="field full"><label>البيان</label><input id="m-notes" value="${edit ? esc(m.notes) : ""}"></div>
        ${lk ? '<div class="muted full" style="font-size:12px">هذه حركة مرتبطة بمستند آخر — يمكن تعديل البيان والتبويبات فقط.</div>' : ""}
      </div>`, async function (ov) {
      var notes = val("m-notes").trim(), tab = val("m-tab"), ptab = val("m-ptab");
      if (edit && lk) { await DB.update("cash_movements", m.id, { notes: notes, tab_id: tab, ptab_id: ptab }); }
      else {
        var k = val("m-kind"), amt = N(val("m-amount")), date = val("m-date");
        if (amt <= 0) throw new Error("المبلغ غير صحيح");
        var r = await DB.get("cash_registers", reg.id, { fresh: true });
        if (edit) {
          var base = N(r.balance) - (isPlus(m) ? 1 : -1) * N(m.amount), nb = base + (k === "in" ? 1 : -1) * amt;
          if (nb < -0.004) throw new Error("الرصيد غير كافٍ لهذا التعديل");
          await DB.update("cash_registers", reg.id, { balance: nb });
          await dropJournal(m.jid);
          var jid = await postMoveJournal(k, amt, date, reg.name);
          await DB.update("cash_movements", m.id, { type: k, kind: k, amount: amt, date: date, notes: notes, tab_id: tab, ptab_id: ptab, jid: jid });
        } else {
          if (k === "out" && amt > N(r.balance)) throw new Error("الرصيد غير كافٍ");
          var rec = await Ledger.treasuryMove({ register_id: reg.id, type: k, amount: amt, date: date, notes: notes, tab_id: tab, ptab_id: ptab });
          var j = await postMoveJournal(k, amt, date, reg.name);
          await DB.update("cash_movements", rec.id, { jid: j });
        }
      }
      UI.toast("تم الحفظ"); ov.remove(); await load();
    });
  }

  async function delMove(m) {
    if (locked(m)) { UI.toast("حركة مرتبطة بمستند — احذف المستند الأصلي", true); return; }
    var msg = isTransfer(m) ? "حذف التحويل سيحذف الحركتين في الخزينتين. متابعة؟" : "حذف الحركة #" + m._n + "؟";
    if (!confirm(msg)) return;
    var targets = isTransfer(m) && m.grp ? await DB.listWhere("cash_movements", "grp", m.grp) : [m];
    // التحقق من عدم سالب الرصيد (قراءة الخزائن المعنية بالتوازي)
    var rids = [];
    targets.forEach(function (t) { if (rids.indexOf(t.register_id) < 0) rids.push(t.register_id); });
    var got = await Promise.all(rids.map(function (id) { return DB.get("cash_registers", id, { fresh: true }); }));
    var regs = {};
    rids.forEach(function (id, i) { if (got[i]) regs[id] = got[i]; });
    for (var i = 0; i < targets.length; i++) {
      var t = targets[i], r = regs[t.register_id];
      if (!r) continue;
      r.balance = N(r.balance) - (isPlus(t) ? 1 : -1) * N(t.amount);
      if (r.balance < -0.004) { UI.toast("الحذف يجعل رصيد الخزينة سالبًا", true); return; }
    }
    var jobs = [];
    Object.keys(regs).forEach(function (k) { jobs.push(DB.update("cash_registers", k, { balance: regs[k].balance })); });
    targets.forEach(function (t) { jobs.push(dropJournal(t.jid)); });
    jobs.push(DB.removeMany("cash_movements", targets.map(function (t) { return t.id; })));
    await Promise.all(jobs);
    UI.toast("تم الحذف"); await load();
  }

  document.getElementById("tbl").onclick = function (e) {
    var b = e.target.closest("[data-act]"); if (!b) return;
    var m = moves.filter(function (x) { return x.id === b.closest("tr").getAttribute("data-id"); })[0]; if (!m) return;
    if (b.getAttribute("data-act") === "edit") openMove(m); else delMove(m);
  };

  /* ---------- رصيد افتتاحي ---------- */
  function openOpening() {
    Ledger.modal("رصيد افتتاحي", html`
      <div class="form-grid"><div class="field"><label>المبلغ</label><input id="o-amt" type="number" step="0.01" min="0.01" required></div>
      <div class="field"><label>التاريخ</label><input id="o-date" type="date" value="${today}"></div></div>`, async function (ov) {
      await Ledger.treasuryMove({ register_id: reg.id, type: "opening", amount: N(val("o-amt")), date: val("o-date"), notes: "رصيد افتتاحي" });
      UI.toast("تمت الإضافة"); ov.remove(); await load();
    });
  }

  /* ---------- تحويل داخل الصفحة ---------- */
  function toggleTransfer() {
    var box = document.getElementById("tr-box");
    if (box.style.display !== "none") { box.style.display = "none"; return; }
    var others = registers.filter(function (r) { return r.id !== reg.id; });
    if (!others.length) { UI.toast("تحتاج خزينتين على الأقل", true); return; }
    box.style.display = "";
    box.innerHTML = html`<div class="panel-title"><h3>تحويل من ${esc(reg.name)}</h3><button type="button" class="small" id="tr-close">إغلاق</button></div>
      <div class="form-grid">
        <div class="field"><label>إلى خزينة</label><select id="tr-to">${others.map(function (r) { return '<option value="' + r.id + '">' + esc(r.name) + " (" + money(r.balance) + ")</option>"; }).join("")}</select></div>
        <div class="field"><label>المبلغ</label><input id="tr-amt" type="number" step="0.01" min="0.01"></div>
        <div class="field"><label>التاريخ</label><input id="tr-date" type="date" value="${today}"></div>
        <div class="field"><label>ملاحظات</label><input id="tr-notes"></div>
        <div class="field" style="align-self:end"><button type="button" class="primary" id="tr-go">تنفيذ التحويل</button></div>
      </div>`;
    document.getElementById("tr-close").onclick = function () { box.style.display = "none"; };
    document.getElementById("tr-go").onclick = async function () {
      try {
        await Ledger.transfer(reg.id, val("tr-to"), N(val("tr-amt")), val("tr-date"), val("tr-notes").trim());
        UI.toast("تم التحويل"); box.style.display = "none"; await load();
      } catch (err) { UI.toast(err.message || "خطأ", true); }
    };
  }

  /* ---------- جرد النقدية ---------- */
  function openCount() {
    var ov = Ledger.modal("جرد النقدية — " + esc(reg.name), "", async function () {}, "حفظ الجرد");
    var body = ov.querySelector("form"), mode = "new";
    var sys = N(reg.balance);
    function shell() {
      body.innerHTML = html`<div class="seg" id="c-seg"><button type="button" data-v="new" class="${mode === "new" ? "on" : ""}">جرد جديد</button><button type="button" data-v="hist" class="${mode === "hist" ? "on" : ""}">سجل الجرد (${counts.length})</button><button type="button" id="c-close" style="margin-inline-start:auto">إغلاق</button></div><div id="c-body" class="stack"></div>`;
      body.querySelector("#c-seg").onclick = function (e) { if (e.target.id === "c-close") { ov.remove(); return; } var b = e.target.closest("[data-v]"); if (b) { mode = b.getAttribute("data-v"); shell(); } };
      if (mode === "new") newCount(); else history();
    }
    function newCount() {
      document.getElementById("c-body") && 0;
      var cb = body.querySelector("#c-body");
      cb.innerHTML = html`<div class="denoms">${DENOMS.map(function (d, i) {
        return html`<div class="den"><span>${d}</span><input type="number" min="0" step="1" data-d="${d}" placeholder="0"><em id="dt${i}">0</em></div>`;
      }).join("")}<div class="den"><span>مبلغ آخر</span><input type="number" min="0" step="0.01" id="c-other" placeholder="0"><em></em></div></div>
        <div class="cnt-sum"><div><span>إجمالي الجرد</span><b id="c-tot">0</b></div><div><span>رصيد النظام</span><b>${money(sys)}</b></div></div>
        <div class="diff-box" id="c-diff"></div>
        <div class="field"><label>ملاحظات</label><input id="c-notes"></div>
        <div class="row gap" style="justify-content:flex-end"><button type="button" class="primary" id="c-save">حفظ الجرد</button></div>`;
      function calc() {
        var tot = 0;
        cb.querySelectorAll("[data-d]").forEach(function (i, idx) { var s = N(i.value) * N(i.getAttribute("data-d")); tot += s; var e = cb.querySelector("#dt" + idx); if (e) e.textContent = money(s); });
        tot += N(cb.querySelector("#c-other").value);
        var diff = Math.round((tot - sys) * 100) / 100, box = cb.querySelector("#c-diff");
        cb.querySelector("#c-tot").textContent = money(tot);
        box.className = "diff-box " + (Math.abs(diff) < 0.005 ? "match" : diff > 0 ? "over" : "short");
        box.textContent = Math.abs(diff) < 0.005 ? "الجرد مطابق لرصيد النظام" : diff > 0 ? "زيادة في الخزينة: " + money(diff) : "عجز في الخزينة: " + money(-diff);
        return { tot: tot, diff: diff };
      }
      cb.oninput = calc; calc();
      cb.querySelector("#c-save").onclick = async function () {
        var c = calc(); if (c.tot <= 0) { UI.toast("أدخل الفئات أولًا", true); return; }
        var det = {}; cb.querySelectorAll("[data-d]").forEach(function (i) { if (N(i.value)) det[i.getAttribute("data-d")] = N(i.value); });
        await DB.insert("cash_counts", { register_id: reg.id, date: today, counts: det, other: N(cb.querySelector("#c-other").value), total: c.tot, system_balance: sys, diff: c.diff, notes: cb.querySelector("#c-notes").value.trim() });
        UI.toast("تم حفظ الجرد"); counts = (await DB.list("cash_counts")).filter(function (x) { return x.register_id === reg.id; }); mode = "hist"; shell();
      };
    }
    function history() {
      var cb = body.querySelector("#c-body");
      var list = counts.slice().sort(function (a, b) { return String(b.created_at || "").localeCompare(String(a.created_at || "")); });
      cb.innerHTML = list.length ? html`<table><thead><tr><th>التاريخ</th><th>الجرد</th><th>النظام</th><th>الفرق</th><th></th></tr></thead><tbody>${list.map(function (c) {
        return html`<tr><td dir="ltr">${esc(c.date)}</td><td>${money(c.total)}</td><td>${money(c.system_balance)}</td>
          <td class="${Math.abs(N(c.diff)) < 0.005 ? "" : N(c.diff) > 0 ? "in-c" : "out-c"}"><b>${money(c.diff)}</b></td>
          <td><div class="actions-cell"><button type="button" class="small" data-v="${c.id}">عرض</button><button type="button" class="small danger" data-x="${c.id}">حذف</button></div></td></tr>`;
      }).join("")}</tbody></table>` : '<div class="empty">لا يوجد جرد محفوظ</div>';
      cb.onclick = async function (e) {
        var v = e.target.closest("[data-v]"), x = e.target.closest("[data-x]");
        if (v) {
          var c = counts.filter(function (z) { return z.id === v.getAttribute("data-v"); })[0];
          cb.innerHTML = html`<div class="muted">جرد بتاريخ ${esc(c.date)} (للعرض فقط)</div><table><thead><tr><th>الفئة</th><th>العدد</th><th>القيمة</th></tr></thead><tbody>
            ${Object.keys(c.counts || {}).map(function (d) { return "<tr><td>" + d + "</td><td>" + c.counts[d] + "</td><td>" + money(N(d) * N(c.counts[d])) + "</td></tr>"; }).join("")}
            ${N(c.other) ? "<tr><td>مبلغ آخر</td><td></td><td>" + money(c.other) + "</td></tr>" : ""}</tbody></table>
            <div class="cnt-sum"><div><span>الإجمالي</span><b>${money(c.total)}</b></div><div><span>رصيد النظام وقتها</span><b>${money(c.system_balance)}</b></div><div><span>الفرق</span><b>${money(c.diff)}</b></div></div>
            ${c.notes ? "<div class='muted'>" + esc(c.notes) + "</div>" : ""}<button type="button" class="small" id="c-back">رجوع</button>`;
          cb.onclick = function (ev) { if (ev.target.id === "c-back") history(); };
        } else if (x) {
          if (!confirm("حذف سجل الجرد؟")) return;
          await DB.remove("cash_counts", x.getAttribute("data-x"));
          counts = counts.filter(function (z) { return z.id !== x.getAttribute("data-x"); }); history();
        }
      };
    }
    shell();
  }

  /* ---------- تصدير / طباعة / استيراد ---------- */
  function exportCsv() {
    UI.exportCSV("خزينة-" + reg.name + ".csv", ["رقم الحركة", "التاريخ", "البيان", "النوع", "وارد", "صادر", "التبويب العام", "التبويب الخاص", "الرصيد"],
      view.map(function (m) { return [m._n, m._d, m.notes || "", (TYPE[m.type || m.kind] || [""])[0], isPlus(m) ? N(m.amount) : "", isPlus(m) ? "" : N(m.amount), tabName(m.tab_id), tabName(m.ptab_id), m._bal]; }));
  }
  function printIt() {
    var co = DB.getCompany();
    UI.printHTML("كشف خزينة", "<h1>" + esc(co.name || "") + "</h1><h2>خزينة: " + esc(reg.name) + "</h2>" +
      '<div class="meta"><div><div>الرصيد الحالي: <b>' + money(reg.balance) + "</b></div></div><div><div>عدد الحركات: " + view.length + "</div></div></div>" +
      "<table><thead><tr><th>#</th><th>التاريخ</th><th>البيان</th><th>وارد</th><th>صادر</th><th>الرصيد</th></tr></thead><tbody>" +
      view.map(function (m) { return "<tr><td>" + m._n + "</td><td>" + m._d + "</td><td>" + esc(m.notes || "") + "</td><td>" + (isPlus(m) ? money(m.amount) : "") + "</td><td>" + (isPlus(m) ? "" : money(m.amount)) + "</td><td>" + money(m._bal) + "</td></tr>"; }).join("") + "</tbody></table>");
  }
  function importCsv(e) {
    var file = e.target.files[0]; if (!file) return;
    var rd = new FileReader();
    rd.onload = async function () {
      try {
        var lines = String(rd.result).replace(/^﻿/, "").split(/\r?\n/).filter(function (l) { return l.trim(); }).slice(1);
        // الأعمدة: التاريخ، البيان، وارد، صادر — كل الحركات في طلب واحد ورصيد الخزينة يُحدَّث مرة واحدة
        var cur = await Promise.all([DB.get("cash_registers", reg.id, { fresh: true }), DB.listWhere("cash_movements", "register_id", reg.id)]);
        var r0 = cur[0]; if (!r0) throw new Error("الخزينة غير موجودة");
        var seq = 0;
        cur[1].forEach(function (m) { if (N(m.seq) > seq) seq = N(m.seq); });
        if (!seq) seq = cur[1].length;
        var rows = [], delta = 0;
        lines.forEach(function (ln) {
          var c = ln.split(","), date = (c[0] || "").trim() || today, notes = (c[1] || "").trim(), inc = N(c[2]), out = N(c[3]);
          var k = inc > 0 ? "in" : (out > 0 ? "out" : ""); if (!k) return;
          var amt = k === "in" ? inc : out;
          seq++; delta += k === "in" ? amt : -amt;
          rows.push({ table: "cash_movements", row: {
            seq: seq, ref: "", ptab_id: "", register_id: reg.id, type: k, kind: k, amount: amt, date: date, notes: notes, tab_id: "",
            party_type: "", party_id: "", grp: "", counterpart: "" } });
        });
        if (rows.length) {
          await DB.insertRows(rows);
          await DB.update("cash_registers", reg.id, { balance: N(r0.balance) + delta });
        }
        UI.toast("تم استيراد " + rows.length + " حركة"); await load();
      } catch (err) { UI.toast(err.message || "تعذّر الاستيراد", true); }
    };
    rd.readAsText(file); e.target.value = "";
  }

  document.getElementById("f-text").oninput = function () { f.text = val("f-text"); draw(); };
  ["f-from", "f-to", "f-type"].forEach(function (id) { document.getElementById(id).onchange = function () { f[id === "f-from" ? "from" : id === "f-to" ? "to" : "type"] = val(id); draw(); }; });
  document.getElementById("f-seq").onchange = function () { f.sortSeq = this.checked; draw(); };
  await load();
})();
