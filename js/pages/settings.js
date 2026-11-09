(async function () {
  var page = await UI.init("settings");
  if (!page) return;
  var html = UI.html;

  var company = {
    name: "شركة النور للتجارة",
    phone: "01000000000",
    address: "القاهرة",
    tax_id: "123-456-789",
    vat_rate: 14,
    vat_enabled: true,
  };

  company = Object.assign(company, DB.getCompany());
  var CURS = [["ج.م", "جنيه مصري"], ["ر.س", "ريال سعودي"], ["د.إ", "درهم إماراتي"], ["د.ك", "دينار كويتي"], ["ر.ق", "ريال قطري"], ["د.ب", "دينار بحريني"],
    ["ر.ع", "ريال عماني"], ["د.أ", "دينار أردني"], ["ل.ل", "ليرة لبنانية"], ["ل.س", "ليرة سورية"], ["د.ع", "دينار عراقي"], ["د.ل", "دينار ليبي"],
    ["د.ت", "دينار تونسي"], ["د.ج", "دينار جزائري"], ["د.م", "درهم مغربي"], ["ر.ي", "ريال يمني"], ["ج.س", "جنيه سوداني"], ["$", "دولار أمريكي"], ["€", "يورو"], ["£", "جنيه إسترليني"], ["ر.ت", "ليرة تركية"]];
  var curKnown = CURS.some(function (c) { return c[0] === company.currency; });
  var curOptions = CURS.map(function (c) { return '<option value="' + c[0] + '"' + (c[0] === (company.currency || "ج.م") ? " selected" : "") + ">" + c[1] + " (" + c[0] + ")</option>"; }).join("") +
    '<option value="__other"' + (company.currency && !curKnown ? " selected" : "") + ">عملة أخرى…</option>";

  page.innerHTML = html`
    <div class="stack">
      <div class="page-toolbar">
        <div>
          <h2 style="margin:0">الإعدادات</h2>
          <p class="muted" style="margin:4px 0 0;font-size:12px">الشركة · الضريبة · الوضع التجريبي</p>
        </div>
      </div>
      <div class="card stack">
        <h3 style="margin-top:0">بيانات الشركة</h3>
        <div class="form-grid">
          <div class="field"><label>اسم الشركة</label><input id="co-name" value="${company.name || ""}"></div>
          <div class="field"><label>الهاتف</label><input id="co-phone" value="${company.phone || ""}" dir="ltr"></div>
          <div class="field"><label>العنوان</label><input id="co-addr" value="${company.address || ""}"></div>
          <div class="field"><label>الرقم الضريبي</label><input id="co-tax" value="${company.tax_id || ""}" dir="ltr"></div>
          <div class="field"><label>العملة</label><select id="co-cur">${curOptions}</select></div>
          <div class="field" id="co-cur-wrap" style="${company.currency && !curKnown ? "" : "display:none"}"><label>رمز العملة</label><input id="co-cur-custom" value="${company.currency && !curKnown ? company.currency : ""}" maxlength="8"></div>
        </div>
        <p class="muted" style="margin:0;font-size:12px">تظهر العملة في الفواتير المطبوعة وكشوف الحساب وملفات Excel وتقارير المخزون.</p>
        <div><button type="button" class="primary" id="save-co">حفظ بيانات الشركة</button></div>
      </div>

      <div class="card stack">
        <h3 style="margin-top:0">المظهر وحجم العرض</h3>
        <p class="muted" style="margin:0;font-size:13px">الحجم المدمج يُظهر بيانات أكثر في الشاشة ويمنع خروج الجداول العريضة من الصفحة. يُحفظ الاختيار على هذا الجهاز.</p>
        <div class="field" style="max-width:260px"><label>حجم العرض</label><select id="density"><option value="compact">مدمج (موصى به)</option><option value="normal">عادي (أكبر)</option></select></div>
      </div>
      <div class="card stack">
        <h3 style="margin-top:0">مستخدمو الشركة</h3>
        <p class="muted" style="margin:0;font-size:13px">أضف أكثر من مستخدم لنفس الشركة (محاسب، أمين مخزن، مبيعات…) لكل واحد رقم هاتفه وكلمة مروره، وحدّد له الصفحات المسموحة، ويمكنك منعه من الحذف أو تعديل المستندات. يظهر اسم من أنشأ كل فاتورة وحركة خزينة.</p>
        <div><a class="button primary" href="staff.html">إدارة مستخدمي الشركة</a></div>
      </div>
      <div class="card stack">
        <h3 style="margin-top:0">ضريبة القيمة المضافة</h3>
        <div class="form-grid">
          <div class="field"><label>تفعيل الضريبة</label>
            <select id="vat-en">
              <option value="1" ${company.vat_enabled !== false ? "selected" : ""}>مفعّلة</option>
              <option value="0" ${company.vat_enabled === false ? "selected" : ""}>معطّلة</option>
            </select>
          </div>
          <div class="field"><label>نسبة الضريبة %</label>
            <input id="vat-rate" type="number" step="0.01" value="${company.vat_rate != null ? company.vat_rate : 14}">
          </div>
        </div>
        <p class="muted" style="margin:0">تُطبَّق على فواتير البيع الجديدة. الافتراضي في مصر: 14%.</p>
        <div><button type="button" class="primary" id="save-vat">حفظ إعدادات الضريبة</button></div>
      </div>

      <div class="card stack">
        <h3 style="margin-top:0">نسخة احتياطية</h3>
        <p class="muted" style="margin:0;font-size:13px;line-height:1.8">تنزيل كل بيانات شركتك (العملاء، الموردين، الأصناف، الفواتير، السندات، القيود...) في ملف واحد تحتفظ به عندك. ننصح بأخذ نسخة أسبوعيًا.</p>
        <div><button type="button" class="primary" id="backup-btn">تنزيل نسخة احتياطية كاملة</button> <span class="muted" id="backup-msg" style="font-size:12px"></span></div>
      </div>

      <div class="card stack">
        <h3 style="margin-top:0">استعادة نسخة احتياطية</h3>
        <p class="muted" style="margin:0;font-size:13px;line-height:1.8">
          <b>شركة جديدة أو فارغة (بدون أي مستندات):</b> استرجاع كامل لكل البيانات والأرصدة كما كانت وقت النسخة.<br>
          <b>شركة تعمل بالفعل:</b> يُسترجع فقط ما حُذف من العملاء والموردين والأصناف والمجموعات والمخازن ودليل الحسابات، ولا يُمَس أي مستند أو رصيد موجود.
          يُنزَّل تلقائيًا نسخة من وضعك الحالي قبل أي استعادة.
        </p>
        <div><button type="button" id="restore-btn">اختيار ملف نسخة احتياطية...</button> <span class="muted" id="restore-msg" style="font-size:12px"></span>
          <input type="file" id="restore-file" accept=".json,application/json" style="display:none"></div>
      </div>

      <div class="card stack">
        <h3 style="margin-top:0">الاستضافة والربط</h3>
        <ol style="margin:0;padding-inline-start:20px;line-height:1.8" class="muted">
          <li>ارفع مجلد trading-system على Cloudflare Pages (مجاني).</li>
          <li>اربط Supabase من js/config.js (URL + anon key).</li>
          <li>شغّل SQL من supabase/migrations عند التجهيز.</li>
        </ol>
        <p style="margin:8px 0 0">الوضع الحالي: <b>${DB.isDemo() ? "Demo (متصفح)" : "Supabase متصل"}</b></p>
      </div>

      ${DB.isDemo() ? html`<div class="card stack">
        <h3 style="margin-top:0">وضع Demo</h3>
        <button type="button" class="danger" id="reset">إعادة ضبط بيانات Demo</button>
      </div>` : ""}
    </div>`;

  async function saveCompanyPatch(patch) {
    try {
      await DB.saveCompany(patch);
      UI.toast("تم الحفظ");
    } catch (e) {
      UI.toast("تعذّر الحفظ", true);
    }
  }

  document.getElementById("save-co").onclick = function () {
    saveCompanyPatch({
      name: document.getElementById("co-name").value.trim(),
      phone: document.getElementById("co-phone").value.trim(),
      address: document.getElementById("co-addr").value.trim(),
      tax_id: document.getElementById("co-tax").value.trim(),
      currency: (function () {
        var v = document.getElementById("co-cur").value;
        return v === "__other" ? (document.getElementById("co-cur-custom").value.trim() || "ج.م") : v;
      })(),
    });
  };
  document.getElementById("co-cur").onchange = function () {
    document.getElementById("co-cur-wrap").style.display = this.value === "__other" ? "" : "none";
  };
  document.getElementById("save-vat").onclick = function () {
    saveCompanyPatch({
      vat_enabled: document.getElementById("vat-en").value === "1",
      vat_rate: Number(document.getElementById("vat-rate").value) || 0,
    });
  };
  var resetBtn = document.getElementById("reset");
  if (resetBtn) resetBtn.onclick = function () {
    if (!confirm("مسح كل البيانات المحلية؟")) return;
    DB.resetDemo();
    UI.toast("تمت إعادة الضبط");
    setTimeout(function () { location.reload(); }, 600);
  };
  var BK_TABLES = ["accounts", "attendance", "bank_movements", "banks", "cash_counts", "cash_movements", "cash_registers", "cheques", "customers", "customer_groups",
    "employees", "expenses", "journal_entries", "journal_lines", "party_txns", "payments", "payroll_lines", "payroll_runs", "products", "product_groups",
    "purchase_lines", "purchase_return_lines", "purchase_returns", "purchases", "quotes", "visit_reports", "sale_lines", "sale_return_lines", "sale_returns", "sales",
    "activity_log", "price_lists", "price_list_items", "installment_plans", "installments", "stock_transfer_lines", "stock_transfers", "stocktake_lines", "stocktakes", "suppliers", "supplier_groups", "treasury_tabs", "warehouses"];
  // مستندات/حركات: وجود أي منها يعني أن الشركة تعمل (فلا استرجاع كامل)
  var BK_DOCS = ["sales", "purchases", "sale_returns", "purchase_returns", "payments", "journal_entries", "cash_movements", "bank_movements", "cheques", "expenses", "party_txns", "stock_transfers", "stocktakes", "installment_plans", "installments"];
  // بيانات أساسية لا تحمل أرصدة مستقلة عن المستندات (تُسترجع في الشركة العاملة)
  var BK_MASTERS = ["customers", "suppliers", "products", "warehouses", "accounts", "customer_groups", "supplier_groups", "product_groups", "price_lists", "price_list_items"];

  async function exportBackup(download) {
    DB.refresh();
    var out = { app: "rasied", version: 1, exported_at: new Date().toISOString(), company: DB.getCompany(), tables: {} }, total = 0;
    for (var i = 0; i < BK_TABLES.length; i++) {
      var rows = [];
      try { rows = (await DB.list(BK_TABLES[i])) || []; } catch (e) { rows = []; }
      if (rows.length) { out.tables[BK_TABLES[i]] = rows; total += rows.length; }
    }
    if (download) {
      var blob = new Blob([JSON.stringify(out)], { type: "application/json" });
      var a = document.createElement("a");
      a.href = URL.createObjectURL(blob);
      a.download = (download === "pre" ? "rasied-before-restore-" : "rasied-backup-") + new Date().toISOString().slice(0, 10) + ".json";
      document.body.appendChild(a); a.click(); a.remove();
      setTimeout(function () { URL.revokeObjectURL(a.href); }, 2000);
    }
    return { out: out, total: total };
  }

  var bkBtn = document.getElementById("backup-btn");
  if (bkBtn) bkBtn.onclick = async function () {
    var msg = document.getElementById("backup-msg");
    bkBtn.disabled = true; msg.textContent = "جارٍ التجهيز...";
    try {
      var r = await exportBackup(true);
      msg.textContent = "تم تنزيل " + r.total + " سجل";
      UI.toast("تم تنزيل النسخة الاحتياطية");
    } catch (err) { UI.toast(err.message, true); msg.textContent = ""; }
    bkBtn.disabled = false;
  };

  /* ---------- الاستعادة ---------- */
  function readFileText(file) {
    if (file.text) return file.text();
    return new Promise(function (res, rej) { var fr = new FileReader(); fr.onload = function () { res(fr.result); }; fr.onerror = function () { rej(new Error("تعذّرت قراءة الملف")); }; fr.readAsText(file); });
  }
  function validate(j) {
    if (!j || j.app !== "rasied" || !j.tables || typeof j.tables !== "object") throw new Error("هذا ليس ملف نسخة احتياطية من رصيد");
    var tabs = {}, total = 0;
    Object.keys(j.tables).forEach(function (t) {
      if (BK_TABLES.indexOf(t) === -1) return;                       // جداول غير معروفة تُتجاهل
      var rows = j.tables[t];
      if (!Array.isArray(rows)) return;
      rows = rows.filter(function (r) { return r && typeof r === "object" && !Array.isArray(r) && typeof r.id === "string" && r.id && r.id.length <= 100; });
      if (rows.length) { tabs[t] = rows; total += rows.length; }
    });
    if (!total) throw new Error("الملف لا يحتوي بيانات صالحة");
    return { tabs: tabs, total: total };
  }

  var rsBtn = document.getElementById("restore-btn"), rsFile = document.getElementById("restore-file"), rsMsg = document.getElementById("restore-msg");
  if (rsBtn) rsBtn.onclick = function () { if (DB.me().owner) rsFile.click(); else UI.toast("الاستعادة لمالك الشركة فقط", true); };
  if (rsFile) rsFile.onchange = async function () {
    var file = rsFile.files && rsFile.files[0]; rsFile.value = "";
    if (!file) return;
    try {
      if (file.size > 60 * 1024 * 1024) throw new Error("الملف كبير جدًا");
      var j = JSON.parse(await readFileText(file)), v = validate(j);
      DB.refresh();
      // حالة الشركة الحالية
      var cur = {}, hasDocs = false;
      for (var i = 0; i < BK_TABLES.length; i++) { var t = BK_TABLES[i]; try { cur[t] = (await DB.list(t)) || []; } catch (e) { cur[t] = []; } }
      BK_DOCS.forEach(function (t) { if (cur[t].length) hasDocs = true; });
      var resume = false; try { resume = localStorage.getItem("rasied_restore_inprogress") === String(j.exported_at); } catch (e) {}
      var full = !hasDocs || resume;
      var tables = full ? Object.keys(v.tabs) : Object.keys(v.tabs).filter(function (t) { return BK_MASTERS.indexOf(t) !== -1; });
      var plan = {}, planTotal = 0;
      tables.forEach(function (t) {
        var have = {}; cur[t].forEach(function (r) { have[r.id] = 1; });
        var miss = v.tabs[t].filter(function (r) { return !have[r.id]; });
        if (miss.length) { plan[t] = miss; planTotal += miss.length; }
      });
      if (!planTotal) { UI.toast(full ? "لا يوجد جديد للاستعادة — كل بيانات الملف موجودة بالفعل" : "لا توجد بيانات أساسية محذوفة لاستعادتها", true); return; }
      var curName = (DB.getCompany() || {}).name || "", fileName = (j.company && j.company.name) || "";
      var other = fileName && curName && fileName !== curName;
      var ov = document.createElement("div"); ov.className = "modal-overlay";
      ov.innerHTML = '<div class="modal card" style="max-width:560px"><h3 style="margin-top:0">' + (full ? "استرجاع كامل" : "استرجاع البيانات الأساسية المحذوفة") + '</h3>' +
        '<div class="stack" style="gap:8px;font-size:14px"><div>النسخة بتاريخ <b dir="ltr">' + Ledger.esc(String(j.exported_at || "").slice(0, 16).replace("T", " ")) + "</b>" + (fileName ? " — شركة: <b>" + Ledger.esc(fileName) + "</b>" : "") + "</div>" +
        (other ? '<div class="card error" style="padding:8px">تنبيه: اسم الشركة في الملف مختلف عن شركتك الحالية (' + Ledger.esc(curName) + ").</div>" : "") +
        "<div>سيُضاف <b>" + planTotal + "</b> سجل غير موجود حاليًا:</div><div class=\"muted\" style=\"font-size:13px\">" + Object.keys(plan).map(function (t) { return Ledger.esc(t) + ": " + plan[t].length; }).join(" · ") + "</div>" +
        (full ? "<div class=\"muted\" style=\"font-size:13px\">الشركة بلا مستندات حاليًا، فسيُسترجع كل شيء بأرصدته كما في النسخة.</div>"
              : "<div class=\"muted\" style=\"font-size:13px\">الشركة تعمل بالفعل: لن تُسترجع المستندات ولا الخزائن ولا البنوك. أرصدة العملاء/الموردين المسترجعين تُعاد من حركاتهم الحالية، وراجع كميات الأصناف المسترجعة.</div>") +
        '<div class="muted" style="font-size:13px">سيُنزَّل تلقائيًا نسخة من وضعك الحالي أولًا.</div></div>' +
        '<div class="row gap" style="justify-content:flex-end;margin-top:12px"><button type="button" class="ghost" id="rs-cancel">إلغاء</button><button type="button" class="primary" id="rs-go">ابدأ الاستعادة</button></div></div>';
      document.body.appendChild(ov);
      ov.querySelector("#rs-cancel").onclick = function () { ov.remove(); };
      ov.querySelector("#rs-go").onclick = async function () {
        var go = ov.querySelector("#rs-go"); go.disabled = true;
        try {
          go.textContent = "جارٍ حفظ نسخة من وضعك الحالي...";
          await exportBackup("pre");
          if (full) { try { localStorage.setItem("rasied_restore_inprogress", String(j.exported_at)); } catch (e) {} }
          var done = 0;
          for (var ti = 0; ti < Object.keys(plan).length; ti++) {
            var tb = Object.keys(plan)[ti], rows = plan[tb];
            for (var k = 0; k < rows.length; k += 200) {
              await DB.insertRows(rows.slice(k, k + 200).map(function (r) { return { table: tb, row: r }; }));
              done += Math.min(200, rows.length - k); go.textContent = "جارٍ الاستعادة... " + done + " / " + planTotal;
            }
          }
          if (!full) {
            // أرصدة الأطراف المسترجعة تُشتق من حركاتها الحالية
            var kinds = [["customers", "customer"], ["suppliers", "supplier"]];
            for (var ki = 0; ki < kinds.length; ki++) { var list = plan[kinds[ki][0]] || []; for (var q = 0; q < list.length; q++) { try { await Ledger.recompute(kinds[ki][1], list[q].id); } catch (e) {} } }
          }
          try { localStorage.removeItem("rasied_restore_inprogress"); } catch (e) {}
          DB.refresh(); ov.remove();
          UI.toast("تمت الاستعادة: " + planTotal + " سجل"); rsMsg.textContent = "تمت استعادة " + planTotal + " سجل";
        } catch (err) { UI.toast("توقفت الاستعادة: " + err.message + " — أعد المحاولة بنفس الملف لإكمالها", true); go.disabled = false; go.textContent = "ابدأ الاستعادة"; }
      };
    } catch (err) { UI.toast(err.message, true); }
  };
  (function () {
    var el = document.getElementById("density"); if (!el) return;
    var cur = "compact"; try { cur = localStorage.getItem("trading_density") === "normal" ? "normal" : "compact"; } catch (e) {}
    el.value = cur;
    el.onchange = function () {
      try { localStorage.setItem("trading_density", el.value); } catch (e) {}
      if (el.value === "normal") document.documentElement.setAttribute("data-density", "normal"); else document.documentElement.removeAttribute("data-density");
      UI.toast("تم تغيير حجم العرض");
    };
  })();
})();
