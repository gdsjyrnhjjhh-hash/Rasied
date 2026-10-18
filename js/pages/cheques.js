/* صفحة الشيكات: واردة وصادرة · حالات · تحصيل/إيداع/تظهير/ارتداد/صرف · تنبيه الاستحقاق */
(async function () {
  var page = await UI.init("cheques", { title: ["الشيكات", "واردة وصادرة · استحقاق · تحصيل وصرف"] });
  if (!page) return;
  await Cheques.ensureAccounts();
  var html = UI.html, money = UI.money, esc = Ledger.esc, val = Ledger.val, today = Ledger.today();
  var N = function (x) { return Number(x) || 0; };
  var ST = Cheques.ST;
  var list = [], customers = [], suppliers = [], banks = [], registers = [];
  var f = { dir: "in", status: "", text: "", from: "", to: "" };

  page.innerHTML = html`
    <div class="stack chq-page">
      <div class="page-toolbar">
        <div><h2 style="margin:0">الشيكات</h2><p class="muted" style="margin:4px 0 0;font-size:12px">دورة كاملة: استلام · إيداع · تحصيل · تظهير · ارتداد · وإصدار وصرف الشيكات الصادرة</p></div>
        <div class="row gap"><button type="button" id="b-csv">تصدير Excel</button><button type="button" class="primary" id="b-add">+ شيك جديد</button></div>
      </div>
      <div class="seg" id="dir"><button type="button" data-v="in" class="on">شيكات واردة (من العملاء)</button><button type="button" data-v="out">شيكات صادرة (للموردين)</button></div>
      <div class="stats" id="stats"></div>
      <div class="card"><div class="form-grid">
        <div class="field"><label>بحث (رقم / طرف / بنك / ملاحظات)</label><input id="q-text"></div>
        <div class="field"><label>الحالة</label><select id="q-st"></select></div>
        <div class="field"><label>استحقاق من</label><input type="date" id="q-from"></div>
        <div class="field"><label>استحقاق إلى</label><input type="date" id="q-to"></div>
      </div></div>
      <div class="card table-wrap" id="tbl"></div>
    </div>`;

  var pname = function (c) {
    var arr = c.dir === "in" ? customers : suppliers, p = arr.filter(function (x) { return x.id === c.party_id; })[0]; return p ? p.name : "—";
  };
  var bname = function (id) { var b = banks.filter(function (x) { return x.id === id; })[0]; return b ? b.name : ""; };
  function daysTo(d) { return Math.round((new Date(d + "T00:00:00") - new Date(today + "T00:00:00")) / 86400000); }
  var open = function (c) { return c.dir === "in" ? (c.status === "portfolio" || c.status === "deposited") : c.status === "pending"; };

  function filtered() {
    var t = f.text.toLowerCase();
    return list.filter(function (c) {
      return c.dir === f.dir && (!f.status || c.status === f.status) && (!f.from || c.due_date >= f.from) && (!f.to || c.due_date <= f.to) &&
        (!t || (String(c.number) + " " + (c.cheque_no || "") + " " + pname(c) + " " + (c.bank_name || "") + " " + (c.notes || "")).toLowerCase().indexOf(t) !== -1);
    }).sort(function (a, b) { return a.due_date < b.due_date ? -1 : 1; });
  }

  function draw() {
    document.querySelectorAll("#dir button").forEach(function (b) { b.classList.toggle("on", b.getAttribute("data-v") === f.dir); });
    var cur = ST[f.dir];
    document.getElementById("q-st").innerHTML = '<option value="">الكل</option>' + Object.keys(cur).map(function (k) { return '<option value="' + k + '"' + (f.status === k ? " selected" : "") + ">" + cur[k][0] + "</option>"; }).join("");
    var mine = list.filter(function (c) { return c.dir === f.dir; });
    var sum = function (fn) { return mine.filter(fn).reduce(function (s, c) { return s + N(c.amount); }, 0); };
    var opn = mine.filter(open), due = opn.filter(function (c) { return daysTo(c.due_date) <= 0; }), soon = opn.filter(function (c) { var d = daysTo(c.due_date); return d > 0 && d <= 7; });
    document.getElementById("stats").innerHTML = f.dir === "in" ? html`
      <div class="stat teal"><div class="label">في الحافظة / مودعة</div><div class="value">${money(sum(open))}</div></div>
      <div class="stat red"><div class="label">مستحقة الآن (${due.length})</div><div class="value">${money(due.reduce(function (s, c) { return s + N(c.amount); }, 0))}</div></div>
      <div class="stat amber"><div class="label">تستحق خلال 7 أيام (${soon.length})</div><div class="value">${money(soon.reduce(function (s, c) { return s + N(c.amount); }, 0))}</div></div>
      <div class="stat green"><div class="label">محصّلة / مظهّرة</div><div class="value">${money(sum(function (c) { return c.status === "collected" || c.status === "endorsed"; }))}</div></div>
      <div class="stat"><div class="label">مرتجعة</div><div class="value">${money(sum(function (c) { return c.status === "bounced"; }))}</div></div>` : html`
      <div class="stat teal"><div class="label">معلّقة (التزامات)</div><div class="value">${money(sum(open))}</div></div>
      <div class="stat red"><div class="label">مستحقة الصرف (${due.length})</div><div class="value">${money(due.reduce(function (s, c) { return s + N(c.amount); }, 0))}</div></div>
      <div class="stat amber"><div class="label">خلال 7 أيام (${soon.length})</div><div class="value">${money(soon.reduce(function (s, c) { return s + N(c.amount); }, 0))}</div></div>
      <div class="stat green"><div class="label">مصروفة</div><div class="value">${money(sum(function (c) { return c.status === "cleared"; }))}</div></div>`;
    var rows = filtered();
    document.getElementById("tbl").innerHTML = html`
      <table><thead><tr><th>رقم</th><th>رقم الشيك</th><th>${f.dir === "in" ? "العميل" : "المورد"}</th><th>البنك</th><th>المبلغ</th><th>الاستحقاق</th><th>الحالة</th><th></th></tr></thead><tbody>
      ${rows.map(function (c) {
        var s = cur[c.status] || ["—", ""], dd = daysTo(c.due_date), warn = open(c) ? (dd <= 0 ? '<span class="badge danger">مستحق</span>' : dd <= 7 ? '<span class="badge warn">بعد ' + dd + " يوم</span>" : "") : "";
        return html`<tr><td><b>#${c.number}</b></td><td dir="ltr">${esc(c.cheque_no) || "—"}</td><td>${esc(pname(c))}</td><td>${esc(c.bank_name || bname(c.bank_id)) || "—"}</td>
          <td><b>${money(c.amount)}</b></td><td dir="ltr">${c.due_date} ${warn}</td><td><span class="badge ${s[1]}">${s[0]}</span></td>
          <td><div class="actions-cell">${actions(c)}</div></td></tr>`;
      }).join("") || '<tr><td colspan="8" class="empty">لا توجد شيكات</td></tr>'}
      </tbody></table>`;
  }
  function actions(c) {
    var b = function (a, t, cls) { return '<button type="button" class="small ' + (cls || "") + '" data-act="' + a + '" data-id="' + c.id + '">' + t + "</button>"; }, h = "";
    if (c.dir === "in") {
      if (c.status === "portfolio") h += b("deposit", "إيداع") + b("collect", "تحصيل") + b("endorse", "تظهير");
      if (c.status === "deposited") h += b("collect", "تحصيل");
      if (open(c)) h += b("bounce", "ارتداد", "danger");
    } else if (c.status === "pending") h += b("clear", "صرف") + b("bounce", "إلغاء", "danger");
    if (c.status !== Cheques.START[c.dir]) h += b("undo", "تراجع");
    return h + b("edit", "تعديل") + b("del", "حذف", "danger");
  }

  var opts = function (arr, sel, fmt) { return arr.map(function (x) { return '<option value="' + x.id + '"' + (x.id === sel ? " selected" : "") + ">" + esc(fmt ? fmt(x) : x.name) + "</option>"; }).join(""); };
  var bankOpts = function (sel) { return opts(banks, sel); };

  /* ---------- إضافة / تعديل ---------- */
  function openForm(c) {
    var edit = !!c, dir = edit ? c.dir : f.dir, isIn = dir === "in", full = !edit || c.status === Cheques.START[c.dir];
    var parties = isIn ? customers : suppliers;
    Ledger.modal(edit ? "تعديل شيك #" + c.number : (isIn ? "استلام شيك من عميل" : "إصدار شيك لمورد"), html`
      <div class="form-grid">
        <div class="field"><label>${isIn ? "العميل" : "المورد"}</label><select id="c-party" ${full ? "" : "disabled"}>${opts(parties, edit ? c.party_id : "")}</select></div>
        <div class="field"><label>رقم الشيك</label><input id="c-no" dir="ltr" value="${edit ? esc(c.cheque_no) : ""}"></div>
        <div class="field"><label>المبلغ</label><input id="c-amt" type="number" step="0.01" min="0.01" value="${edit ? N(c.amount) : ""}" ${full ? "" : "disabled"}></div>
        <div class="field"><label>تاريخ الإصدار</label><input id="c-issue" type="date" value="${edit ? c.issue_date : today}" ${full ? "" : "disabled"}></div>
        <div class="field"><label>تاريخ الاستحقاق</label><input id="c-due" type="date" value="${edit ? c.due_date : today}"></div>
        <div class="field"><label>${isIn ? "البنك المسحوب عليه" : "البنك"}</label><input id="c-bank" value="${edit ? esc(c.bank_name) : ""}"></div>
        <div class="field full"><label>ملاحظات</label><input id="c-notes" value="${edit ? esc(c.notes) : ""}"></div>
        ${full ? "" : '<div class="muted full" style="font-size:12px">الشيك تجاوز حالته الأولى — يمكن تعديل البيانات الوصفية فقط. استخدم «تراجع» لتعديل المبلغ.</div>'}
      </div>`, async function (ov) {
      var d = { dir: dir, party_id: val("c-party"), cheque_no: val("c-no"), amount: val("c-amt"), issue_date: val("c-issue"), due_date: val("c-due"), bank_name: val("c-bank"), notes: val("c-notes") };
      if (!d.party_id) d.party_id = edit ? c.party_id : "";
      if (edit) await Cheques.edit(c, d); else await Cheques.create(d);
      UI.toast("تم الحفظ"); ov.remove(); await load();
    });
  }

  /* ---------- الإجراءات ---------- */
  function act(c, a) {
    if (a === "edit") return openForm(c);
    if (a === "del") {
      if (!confirm("حذف الشيك؟ سيتم عكس كل آثاره على الطرف والبنك والخزينة والقيود.")) return;
      return Cheques.remove(c).then(function () { UI.toast("تم الحذف"); return load(); }, err);
    }
    if (a === "undo") {
      if (!confirm("التراجع إلى الحالة الأولى وعكس آثار الحالة الحالية؟")) return;
      return Cheques.undo(c).then(function () { UI.toast("تم التراجع"); return load(); }, err);
    }
    var cfg = {
      deposit: { t: "إيداع الشيك بالبنك", to: "deposited", bank: true },
      collect: { t: "تحصيل الشيك", to: "collected", bank: true, reg: true },
      endorse: { t: "تظهير الشيك لمورد", to: "endorsed", sup: true },
      clear: { t: "صرف الشيك", to: "cleared", bank: true },
      bounce: { t: c.dir === "in" ? "ارتداد الشيك" : "إلغاء الشيك", to: "bounced" },
    }[a];
    var warn = a === "bounce" ? '<div class="muted full" style="font-size:12px">سيعود المبلغ على رصيد ' + (c.dir === "in" ? "العميل" : "المورد") + ".</div>" : "";
    Ledger.modal(cfg.t + " #" + c.number + " (" + money(c.amount) + ")", html`
      <div class="form-grid">
        <div class="field"><label>التاريخ</label><input id="a-date" type="date" value="${today}"></div>
        ${cfg.reg ? html`<div class="field"><label>التحصيل في</label><select id="a-where"><option value="bank">حساب بنكي</option><option value="reg">خزينة (نقدًا)</option></select></div>` : ""}
        ${cfg.bank ? html`<div class="field" id="a-bank-f"><label>الحساب البنكي</label><select id="a-bank">${bankOpts(c.bank_id)}</select></div>` : ""}
        ${cfg.reg ? html`<div class="field" id="a-reg-f" style="display:none"><label>الخزينة</label><select id="a-reg">${opts(registers, "")}</select></div>` : ""}
        ${cfg.sup ? html`<div class="field"><label>المورد</label><select id="a-sup">${opts(suppliers, "")}</select></div>` : ""}
        ${warn}
      </div>`, async function (ov) {
      var o = { to: cfg.to, date: val("a-date") };
      if (cfg.bank && (!cfg.reg || val("a-where") === "bank")) { if (!banks.length) throw new Error("أضف حسابًا بنكيًا أولًا"); o.bank_id = val("a-bank"); }
      if (cfg.reg && val("a-where") === "reg") o.register_id = val("a-reg");
      if (cfg.sup) o.supplier_id = val("a-sup");
      await Cheques.transition(c, o); UI.toast("تم"); ov.remove(); await load();
    });
    var w = document.getElementById("a-where");
    if (w) w.onchange = function () {
      document.getElementById("a-bank-f").style.display = w.value === "bank" ? "" : "none";
      document.getElementById("a-reg-f").style.display = w.value === "reg" ? "" : "none";
    };
  }
  function err(e) { UI.toast(e.message || "خطأ", true); }

  async function load() {
    var d = await Promise.all([DB.list("cheques"), DB.list("customers"), DB.list("suppliers"), DB.list("banks"), DB.list("cash_registers")]);
    list = d[0]; customers = d[1]; suppliers = d[2]; banks = d[3]; registers = d[4];
    draw();
  }
  document.getElementById("dir").onclick = function (e) { var b = e.target.closest("[data-v]"); if (b) { f.dir = b.getAttribute("data-v"); f.status = ""; draw(); } };
  document.getElementById("q-text").oninput = function () { f.text = val("q-text"); draw(); };
  document.getElementById("q-st").onchange = function () { f.status = val("q-st"); draw(); };
  document.getElementById("q-from").onchange = function () { f.from = val("q-from"); draw(); };
  document.getElementById("q-to").onchange = function () { f.to = val("q-to"); draw(); };
  document.getElementById("b-add").onclick = function () {
    if (!(f.dir === "in" ? customers : suppliers).length) { UI.toast("أضف " + (f.dir === "in" ? "عميلًا" : "موردًا") + " أولًا", true); return; }
    openForm(null);
  };
  document.getElementById("tbl").onclick = function (e) {
    var b = e.target.closest("[data-act]"); if (!b) return;
    var c = list.filter(function (x) { return x.id === b.getAttribute("data-id"); })[0]; if (c) act(c, b.getAttribute("data-act"));
  };
  document.getElementById("b-csv").onclick = function () {
    UI.exportCSV("شيكات.csv", ["رقم", "رقم الشيك", "الطرف", "البنك", "المبلغ", "الإصدار", "الاستحقاق", "الحالة"],
      filtered().map(function (c) { return [c.number, c.cheque_no || "", pname(c), c.bank_name || bname(c.bank_id), c.amount, c.issue_date, c.due_date, (ST[c.dir][c.status] || [""])[0]]; }));
  };
  await load();
})();
