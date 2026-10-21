(async function () {
  var page = await UI.init("accounts");
  if (!page) return;
  var html = UI.html, esc = Ledger.esc;
  var accounts = [], collapsed = {};

  page.innerHTML = html`
    <div class="stack">
      <div class="page-toolbar">
        <div>
          <h2 style="margin:0">دليل الحسابات</h2>
          <p class="muted" style="margin:4px 0 0;font-size:12px">شجرة الحسابات المالية — حساب رئيسي وتحته حسابات فرعية</p>
        </div>
        <div class="row gap wrap">
          <button type="button" class="small" id="btn-imp">استيراد من Excel</button>
          <button type="button" class="small" id="btn-tpl">قالب الاستيراد</button>
          <button type="button" class="small" id="btn-exp">تصدير Excel</button>
          <button type="button" class="primary" id="btn-add">+ حساب جديد</button>
          <input type="file" id="imp-file" accept=".xlsx,.csv,text/csv" style="display:none">
        </div>
      </div>
      <div class="stats" id="acc-stats"></div>
      <div class="row gap wrap">
        <input id="q" placeholder="بحث بالكود أو الاسم..." style="max-width:340px">
        <select id="ftype" style="max-width:200px"><option value="">كل الأنواع</option>${UI.ACCOUNT_TYPES.map(function (t) { return html`<option value="${t.key}">${t.label}</option>`; }).join("")}</select>
        <button type="button" class="small" id="exp-all">توسيع الكل</button>
        <button type="button" class="small" id="col-all">طي الكل</button>
      </div>
      <div class="card table-wrap" id="list"></div>
    </div>`;

  var TYPE_BADGE = { asset: "ok", liability: "warn", equity: "", revenue: "ok", expense: "err" };
  function byId(id) { return accounts.filter(function (x) { return x.id === id; })[0]; }
  function kidsOf(id) { return accounts.filter(function (x) { return x.parent === id; }); }

  function render() {
    var se = document.getElementById("acc-stats");
    if (se) se.innerHTML = UI.ACCOUNT_TYPES.map(function (t, i) {
      var n = accounts.filter(function (a) { return a.type === t.key; }).length;
      return html`<div class="stat ${["blue", "amber", "teal", "green", "red"][i]}"><div class="label">${t.label}</div><div class="value">${UI.num(n)}</div></div>`;
    }).join("");

    var q = (document.getElementById("q").value || "").trim().toLowerCase();
    var ft = document.getElementById("ftype").value;
    var filtering = !!(q || ft);
    var tree = Ledger.accountTree(accounts), parentOf = {};
    accounts.forEach(function (a) { parentOf[a.id] = a.parent; });
    var visible = {};
    if (filtering) {
      tree.forEach(function (n) {
        var a = n.a;
        if ((!ft || a.type === ft) && (!q || ((a.code || "") + " " + a.name).toLowerCase().indexOf(q) !== -1)) {
          visible[a.id] = 1;
          for (var p = parentOf[a.id], guard = 0; p && guard < 30; p = parentOf[p], guard++) visible[p] = 1;   // يظهر مسار الآباء
        }
      });
    }
    var rows = tree.filter(function (n) {
      if (filtering) return visible[n.a.id];
      for (var p = parentOf[n.a.id], guard = 0; p && guard < 30; p = parentOf[p], guard++) if (collapsed[p]) return false;
      return true;
    });

    document.getElementById("list").innerHTML = html`
      <table>
        <thead><tr><th>الكود</th><th>اسم الحساب</th><th>النوع</th><th>المستوى</th><th></th></tr></thead>
        <tbody>
          ${rows.length === 0 ? html`<tr><td colspan="5" class="empty">لا توجد حسابات</td></tr>` :
            rows.map(function (n) {
              var a = n.a, open = !collapsed[a.id];
              var toggle = n.hasKids && !filtering
                ? html`<button type="button" class="ghost small" data-act="tg" data-id="${esc(a.id)}" style="padding:0 6px;min-height:24px">${open ? "▾" : "▸"}</button>`
                : html`<span style="display:inline-block;width:30px"></span>`;
              return html`<tr>
                <td dir="ltr" style="text-align:start"><b>${esc(a.code || "—")}</b></td>
                <td style="padding-inline-start:${n.level * 22 + 8}px">${toggle}<span style="${n.hasKids ? "font-weight:700" : ""}">${esc(a.name)}</span></td>
                <td><span class="badge ${TYPE_BADGE[a.type] || ""}">${UI.typeLabel(a.type)}</span></td>
                <td>${n.hasKids ? '<span class="badge">رئيسي</span>' : (n.level ? '<span class="badge ok">فرعي</span>' : '<span class="muted">—</span>')}</td>
                <td>
                  <button class="small" data-id="${esc(a.id)}" data-act="child">+ فرعي</button>
                  <button class="small" data-id="${esc(a.id)}" data-act="edit">تعديل</button>
                  <button class="small danger" data-id="${esc(a.id)}" data-act="del">حذف</button>
                </td>
              </tr>`;
            }).join("")}
        </tbody>
      </table>`;
  }

  // الكود المقترح للحساب الفرعي: أكبر كود ابن + 1 (أو كود الأب + 1 / 01) مع ضمان عدم التكرار
  function suggestCode(parent) {
    var used = {}; accounts.forEach(function (a) { used[String(a.code)] = 1; });
    var kids = kidsOf(parent.id), pc = String(parent.code || "");
    var pad = function (n, len) { var t = String(n); while (t.length < len) t = "0" + t; return t; };
    var next;
    if (/^\d+$/.test(pc)) {
      var nums = kids.map(function (k) { return /^\d+$/.test(k.code) ? Number(k.code) : NaN; }).filter(function (x) { return !isNaN(x); });
      if (nums.length) next = Math.max.apply(null, nums) + 1;
      else next = /0$/.test(pc) ? Number(pc) + 1 : Number(pc + "01");
      var len = (nums.length || /0$/.test(pc)) ? pc.length : pc.length + 2;
      var c = pad(next, len);
      while (used[c]) { next++; c = pad(next, len); }
      return c;
    }
    var i = kids.length + 1, c2 = pc + "-" + i;
    while (used[c2]) { i++; c2 = pc + "-" + i; }
    return c2;
  }

  function openForm(a, presetParent) {
    var isNew = !a;
    a = a || { code: "", name: "", type: "asset", parent: presetParent || "" };
    var banned = isNew ? {} : Ledger.accountDescendants(accounts, a.id);
    if (!isNew) banned[a.id] = 1;
    var options = Ledger.accountTree(accounts).filter(function (n) { return !banned[n.a.id]; }).map(function (n) {
      var pad = new Array(n.level + 1).join("\u00A0\u00A0\u00A0");
      return '<option value="' + esc(n.a.id) + '"' + (n.a.id === a.parent ? " selected" : "") + ">" + pad + esc(n.a.code) + " — " + esc(n.a.name) + "</option>";
    }).join("");
    var ov = document.createElement("div");
    ov.className = "modal-overlay";
    ov.innerHTML = html`<div class="modal card">
      <h3 style="margin-top:0">${isNew ? "حساب جديد" : "تعديل حساب"}</h3>
      <form id="f" class="stack">
        <div class="form-grid">
          <div class="field full"><label>الحساب الرئيسي (يوضع هذا الحساب تحته)</label>
            <select id="parent"><option value="">— بدون (حساب رئيسي مستقل) —</option>${options}</select>
          </div>
          <div class="field"><label>الكود</label><input id="code" dir="ltr" required value="${esc(a.code || "")}"></div>
          <div class="field"><label>الاسم</label><input id="name" required value="${esc(a.name || "")}"></div>
          <div class="field"><label>النوع</label>
            <select id="type">${UI.ACCOUNT_TYPES.map(function (t) {
              return html`<option value="${t.key}" ${t.key === a.type ? "selected" : ""}>${t.label}</option>`;
            }).join("")}</select>
          </div>
        </div>
        <p class="muted" id="hint" style="margin:0;font-size:12px"></p>
        <div class="row gap" style="justify-content:flex-end">
          <button type="button" class="ghost" id="cancel">إلغاء</button>
          <button class="primary" type="submit">حفظ</button>
        </div>
      </form>
    </div>`;
    document.body.appendChild(ov);
    var elP = ov.querySelector("#parent"), elC = ov.querySelector("#code"), elT = ov.querySelector("#type"), hint = ov.querySelector("#hint");
    var codeTouched = !isNew;
    elC.oninput = function () { codeTouched = true; };
    function onParent() {
      var p = byId(elP.value);
      if (p) {
        elT.value = p.type; elT.disabled = true;                    // الفرعي يرث نوع الأب
        hint.textContent = "النوع يتبع الحساب الرئيسي (" + UI.typeLabel(p.type) + ").";
        if (!codeTouched) elC.value = suggestCode(p);
      } else { elT.disabled = false; hint.textContent = ""; }
    }
    elP.onchange = onParent; onParent();
    ov.querySelector("#cancel").onclick = function () { ov.remove(); };
    ov.onclick = function (e) { if (e.target === ov) ov.remove(); };
    ov.querySelector("#f").onsubmit = async function (e) {
      e.preventDefault();
      var payload = {
        code: elC.value.trim(), name: ov.querySelector("#name").value.trim(),
        type: elT.value, parent: elP.value || null,
      };
      try {
        if (!payload.code || !payload.name) throw new Error("أكمل الكود والاسم");
        var dup = accounts.filter(function (x) { return String(x.code) === payload.code && x.id !== a.id; })[0];
        if (dup) throw new Error("الكود مستخدم بالفعل في الحساب: " + dup.name);
        var p = byId(payload.parent);
        if (p) payload.type = p.type;
        if (isNew) await DB.insert("accounts", payload);
        else {
          if (payload.parent && (banned[payload.parent])) throw new Error("لا يمكن جعل الحساب تابعًا لنفسه أو لأحد أبنائه");
          var jobs = [DB.update("accounts", a.id, payload)];
          if (payload.type !== a.type) {                              // تغيير النوع يسري على كل الحسابات الفرعية
            var desc = Ledger.accountDescendants(accounts, a.id), ids = Object.keys(desc);
            if (ids.length && !confirm("سيتغير نوع " + ids.length + " حساب فرعي ليطابق النوع الجديد. متابعة؟")) return;
            ids.forEach(function (id) { jobs.push(DB.update("accounts", id, { type: payload.type })); });
          }
          await Promise.all(jobs);
        }
        if (payload.parent) collapsed[payload.parent] = false;
        UI.toast("تم الحفظ"); ov.remove(); await load();
      } catch (err) { UI.toast(err.message, true); }
    };
  }

  /* ---------- استيراد / تصدير دليل الحسابات (Excel أو CSV) ---------- */
  var TYPE_NAME = { asset: "أصول", liability: "خصوم", equity: "حقوق ملكية", revenue: "إيرادات", expense: "مصروفات" };
  function nk(v) {
    return String(v == null ? "" : v).replace(/[٠-٩]/g, function (c) { return String(c.charCodeAt(0) - 0x660); })
      .replace(/[\u064B-\u0652\u0640]/g, "").replace(/[أإآٱ]/g, "ا").replace(/ى/g, "ي").replace(/ة/g, "ه").replace(/\s+/g, " ").trim().toLowerCase();
  }
  function latin(v) { return String(v == null ? "" : v).replace(/[٠-٩]/g, function (c) { return String(c.charCodeAt(0) - 0x660); }).trim().replace(/\.0+$/, ""); }
  function typeFromText(t) {
    t = nk(t); if (!t) return "";
    if (/^(اصول|اصل|موجودات|اصول ثابته|اصول متداوله|asset|assets)/.test(t)) return "asset";
    if (/^(خصوم|التزامات|خصم|خصوم متداوله|liabilit)/.test(t)) return "liability";
    if (/(حقوق|راس المال|equity|capital)/.test(t)) return "equity";
    if (/^(ايراد|ايرادات|دخل|مبيعات|revenue|income|sales)/.test(t)) return "revenue";
    if (/^(مصروف|مصروفات|مصاريف|تكاليف|تكلفه|expense|cost)/.test(t)) return "expense";
    return "";
  }
  function typeFromCode(code) { return { "1": "asset", "2": "liability", "3": "equity", "4": "revenue", "5": "expense" }[String(code).charAt(0)] || ""; }
  function exportXlsx() {
    var co = DB.getCompany(), tree = Ledger.accountTree(accounts), byId = {};
    accounts.forEach(function (a) { byId[a.id] = a; });
    var rows = [[{ v: (co.name || "") + " — دليل الحسابات", s: "title" }],
      ["الكود", "اسم الحساب", "النوع", "كود الحساب الرئيسي", "المستوى"].map(function (h) { return { v: h, s: "head" }; })];
    tree.forEach(function (n) {
      var p = n.a.parent && byId[n.a.parent];
      rows.push([{ v: String(n.a.code || ""), s: "text" }, { v: n.a.name, s: "text" }, { v: UI.typeLabel(n.a.type), s: "text" }, { v: p ? String(p.code || "") : "", s: "text" }, { v: n.level + 1, s: "date" }]);
    });
    Xlsx.download("دليل-الحسابات.xlsx", { sheet: "دليل الحسابات", cols: [14, 40, 16, 22, 10], merges: ["A1:E1"], rows: rows });
  }
  function downloadTemplate() {
    var H = ["الكود", "اسم الحساب", "النوع", "كود الحساب الرئيسي"];
    var ex = [["1000", "الأصول", "أصول", ""], ["1100", "النقدية", "أصول", "1000"], ["1101", "الصندوق الرئيسي", "أصول", "1100"], ["1102", "صندوق الفرع", "أصول", "1100"],
      ["2000", "الخصوم", "خصوم", ""], ["2100", "الموردين", "خصوم", "2000"], ["4000", "الإيرادات", "إيرادات", ""], ["5000", "المصروفات", "مصروفات", ""]];
    var rows = [H.map(function (h) { return { v: h, s: "head" }; })].concat(ex.map(function (r) { return r.map(function (v) { return { v: v, s: "text" }; }); }));
    rows.push([{ v: "ملاحظات: الكود والاسم إلزاميان. النوع (أصول/خصوم/حقوق ملكية/إيرادات/مصروفات) اختياري للفرعي (يرث من الأب) وإن تُرك لحساب رئيسي يُستنتج من أول رقم في الكود (1 أصول، 2 خصوم، 3 حقوق ملكية، 4 إيرادات، 5 مصروفات). «كود الحساب الرئيسي» اختياري: إن تُرك يُستنتج الأب من بادئة الكود (1101 تحت 1100). الأكواد الموجودة مسبقًا تُتخطّى.", s: "boldtext" }]);
    Xlsx.download("قالب-استيراد-دليل-الحسابات.xlsx", { sheet: "الحسابات", cols: [14, 40, 16, 22], merges: ["A" + rows.length + ":D" + rows.length], rows: rows });
  }
  async function importFile(e) {
    var file = e.target.files[0]; if (!file) return;
    e.target.value = "";
    try {
      var table = /\.xlsx$/i.test(file.name) ? await Xlsx.read(file) : Xlsx.parseCsv(String(await file.text()).replace(/^\uFEFF/, ""));
      var hi = -1, i;
      for (i = 0; i < Math.min(table.length, 15) && hi < 0; i++) if ((table[i] || []).some(function (c) { return /^(الكود|رقم الحساب|كود الحساب|code|account code)$/.test(nk(c)); })) hi = i;
      var col = { code: 0, name: 1, type: 2, parent: 3 };
      if (hi >= 0) {
        col = { code: -1, name: -1, type: -1, parent: -1 };
        table[hi].forEach(function (c, j) {
          var h = nk(c);
          if (/^(الكود|رقم الحساب|كود الحساب|code|account code)$/.test(h)) col.code = j;
          else if (/^(اسم الحساب|الاسم|الحساب|اسم|name|account name|account)$/.test(h)) col.name = j;
          else if (/^(النوع|نوع الحساب|التصنيف|type)$/.test(h)) col.type = j;
          else if (/^(كود الحساب الرئيسي|الحساب الرئيسي|الحساب الاب|الاب|الرئيسي|رقم الحساب الرئيسي|parent|parent code)$/.test(h)) col.parent = j;
        });
        if (col.code < 0 || col.name < 0) throw new Error("لم أجد عمودَي «الكود» و«اسم الحساب» — حمّل «قالب الاستيراد»");
      }
      var existing = {}, existingName = {};
      accounts.forEach(function (a) { existing[nk(a.code)] = a; existingName[nk(a.name)] = a; });
      var sheet = [], byCode = {}, bad = 0, dupSheet = 0, dupExisting = 0;
      for (i = hi >= 0 ? hi + 1 : 0; i < table.length; i++) {
        var r = table[i] || [];
        if (!r.some(function (c) { return c !== "" && c != null; })) continue;
        var code = latin(r[col.code]), name = String(r[col.name] == null ? "" : r[col.name]).trim();
        if (!code || !name || /^ملاحظات/.test(code) || /^ملاحظات/.test(name)) { if (code || name) bad++; continue; }
        if (existing[nk(code)]) { dupExisting++; continue; }
        if (byCode[nk(code)]) { dupSheet++; continue; }
        var it = { code: code, name: name, typeTxt: col.type >= 0 ? r[col.type] : "", parentTxt: col.parent >= 0 ? latin(r[col.parent]) : "", id: newId(), isNew: true };
        sheet.push(it); byCode[nk(code)] = it;
      }
      if (!sheet.length) throw new Error(dupExisting ? "كل الأكواد موجودة مسبقًا — لا جديد للاستيراد" : "لا توجد حسابات صالحة للاستيراد");
      // تحديد الأب: عمود صريح (كود ثم اسم) وإلا بادئة الكود الأطول (في الشيت ثم الموجود)
      var allCodes = sheet.map(function (x) { return x.code; }).concat(accounts.map(function (a) { return String(a.code); }));
      var inferred = 0, unresolved = 0;
      sheet.forEach(function (it) {
        var p = null, pk = nk(it.parentTxt);
        if (pk) {
          p = byCode[pk] || existing[pk] || null;
          if (!p) { var byName = sheet.filter(function (x) { return nk(x.name) === pk; })[0] || existingName[pk]; p = byName || null; }
          if (!p) unresolved++;
        } else {
          var best = "";
          allCodes.forEach(function (c) { if (c !== it.code && it.code.indexOf(c) === 0 && c.length > best.length) best = c; });
          if (best) { p = byCode[nk(best)] || existing[nk(best)]; if (p) inferred++; }
          if (!p && /^\d{3,}$/.test(it.code)) {                    // 1102 → 1100 → 1000
            var c2 = it.code;
            for (var g = 0; g < 8 && !p; g++) {
              var m = /^(\d*?)([1-9])(0*)$/.exec(c2); if (!m) break;
              c2 = m[1] + "0" + m[3];
              if (c2 !== it.code && (byCode[nk(c2)] || existing[nk(c2)])) { p = byCode[nk(c2)] || existing[nk(c2)]; inferred++; }
            }
          }
        }
        it.parent = p && p !== it ? p : null;
      });
      // كسر الدوران (بين حسابات الملف فقط)
      sheet.forEach(function (it) {
        var seen = {}, cur = it;
        while (cur && cur.isNew && cur.parent) {
          if (seen[cur.id]) { it.parent = null; break; }
          seen[cur.id] = 1; cur = cur.parent;
        }
      });
      // النوع: يرث من الأب، وإلا من نص الملف، وإلا من أول رقم في الكود
      var typeInferred = 0, typeConflict = 0, noType = [];
      var typeOf = function (it, depth) {
        if (it.type) return it.type;                                  // حساب موجود أو محسوم
        var own = typeFromText(it.typeTxt);
        if (it.parent && depth < 30) {
          var pt = typeOf(it.parent, depth + 1);
          if (pt) { if (own && own !== pt) typeConflict++; it.type = pt; return pt; }
        }
        var t = own;
        if (!t) { t = typeFromCode(it.code); if (t) typeInferred++; }
        it.type = t; return t;
      };
      sheet.forEach(function (it) { typeOf(it, 0); if (!it.type) noType.push(it.code); });
      if (noType.length) throw new Error("تعذّر تحديد نوع الحسابات: " + noType.slice(0, 6).join("، ") + (noType.length > 6 ? "…" : "") + " — أضف عمود «النوع»");
      var roots = sheet.filter(function (x) { return !x.parent; }).length;
      var sample = sheet.slice(0, 8).map(function (x) { return x.code + " — " + x.name + " (" + TYPE_NAME[x.type] + ")" + (x.parent ? " ← " + x.parent.code : ""); }).join("\n");
      if (!confirm("سيتم إضافة " + sheet.length + " حساب (" + roots + " رئيسي، " + (sheet.length - roots) + " فرعي)\n\n" + sample + (sheet.length > 8 ? "\n…" : "") +
        (inferred ? "\n\nاستُنتج الأب من بادئة الكود لـ " + inferred + " حساب" : "") + (typeInferred ? "\nاستُنتج النوع من أول رقم في الكود لـ " + typeInferred + " حساب" : "") +
        (typeConflict ? "\nتعارض نوع الفرعي مع أبيه في " + typeConflict + " حساب — اعتُمد نوع الأب" : "") +
        (dupExisting ? "\nتخطّي " + dupExisting + " كود موجود مسبقًا" : "") + (dupSheet ? "\nتخطّي " + dupSheet + " كود مكرر في الملف" : "") +
        (bad ? "\nتخطّي " + bad + " صف ناقص" : "") + (unresolved ? "\nحسابات أبوها غير موجود (ستُضاف كرئيسية): " + unresolved : "") + "\n\nمتابعة؟")) return;
      await DB.insertRows(sheet.map(function (x) { return { table: "accounts", row: { id: x.id, code: x.code, name: x.name, type: x.type, parent: x.parent ? x.parent.id : null } }; }));
      UI.toast("تم استيراد " + sheet.length + " حساب"); await load();
    } catch (err) { UI.toast(err.message || "تعذّر الاستيراد", true); }
  }
  function newId() { return (window.crypto && crypto.randomUUID) ? crypto.randomUUID() : "id-" + Date.now().toString(36) + Math.random().toString(36).slice(2, 10); }

  async function load() {
    DB.refresh("accounts");
    accounts = await DB.list("accounts");
    render();
  }

  document.getElementById("btn-add").onclick = function () { openForm(null); };
  document.getElementById("btn-imp").onclick = function () { document.getElementById("imp-file").click(); };
  document.getElementById("imp-file").onchange = importFile;
  document.getElementById("btn-tpl").onclick = downloadTemplate;
  document.getElementById("btn-exp").onclick = exportXlsx;
  document.getElementById("q").oninput = render;
  document.getElementById("ftype").onchange = render;
  document.getElementById("exp-all").onclick = function () { collapsed = {}; render(); };
  document.getElementById("col-all").onclick = function () { accounts.forEach(function (a) { if (kidsOf(a.id).length) collapsed[a.id] = true; }); render(); };
  document.getElementById("list").onclick = async function (e) {
    var btn = e.target.closest("[data-act]");
    if (!btn) return;
    var id = btn.getAttribute("data-id"), act = btn.getAttribute("data-act");
    var a = byId(id);
    if (!a) return;
    if (act === "tg") { collapsed[id] = !collapsed[id]; render(); }
    else if (act === "edit") openForm(a);
    else if (act === "child") openForm(null, id);
    else if (act === "del") {
      if (kidsOf(id).length) { UI.toast("لا يمكن حذف حساب رئيسي له حسابات فرعية — احذفها أو انقلها أولًا", true); return; }
      var used = (await DB.listWhere("journal_lines", "account_id", id)).length > 0;
      if (used) { UI.toast("لا يمكن حذف حساب عليه حركات قيود", true); return; }
      if (!confirm("حذف الحساب؟")) return;
      await DB.remove("accounts", id); UI.toast("تم الحذف"); await load();
    }
  };
  await load();
})();
