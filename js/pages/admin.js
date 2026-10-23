(async function () {
  var page = await UI.init("admin");
  if (!page) return;
  var html = UI.html, num = UI.num, money = UI.money, I = UI.ICON;
  var client = DB.client();
  var me = DB.profile();

  if (DB.isDemo() || !client) {
    page.innerHTML = '<div class="card empty">صفحة الإدارة متاحة فقط عند الربط بـ Supabase.</div>';
    return;
  }

  var users = [], compCount = {};
  // حالة الفلاتر (تُبنى على حقول بيانات المستخدم: الحالة، الدور، تاريخ التسجيل، آخر ظهور، حجم البيانات، أيام الاستخدام، عدد مستخدمي الشركة)
  var F = { q: "", status: "", role: "", reg: "", from: "", to: "", act: "", data: "", days: "", comp: "", sort: "created_desc" };

  var TBL = {
    customers: "العملاء", suppliers: "الموردين", warehouses: "المخازن", products: "الأصناف",
    sales: "فواتير البيع", sale_lines: "بنود البيع", sale_returns: "مردودات البيع", sale_return_lines: "بنود مردودات البيع",
    purchases: "فواتير الشراء", purchase_lines: "بنود الشراء", purchase_returns: "مردودات الشراء",
    payments: "السندات", accounts: "دليل الحسابات", journal_entries: "قيود اليومية", journal_lines: "بنود القيود",
    expenses: "المصروفات", cash_registers: "الخزائن", cash_movements: "حركات الخزائن", employees: "الموظفين",
    payroll_runs: "مسيرات الرواتب", payroll_lines: "بنود المرتبات", stocktakes: "الجرد", stock_transfers: "تحويلات المخازن",
  };
  function tblName(t) { return TBL[t] || t; }

  function ago(d) {
    if (!d) return "لم يدخل بعد";
    var s = Math.max(0, (Date.now() - new Date(d).getTime()) / 1000);
    if (s < 90) return "الآن";
    if (s < 3600) return "قبل " + num(Math.floor(s / 60)) + " دقيقة";
    if (s < 86400) return "قبل " + num(Math.floor(s / 3600)) + " ساعة";
    return "قبل " + num(Math.floor(s / 86400)) + " يوم";
  }
  function dateTime(d) {
    return d ? new Date(d).toLocaleString("ar-EG-u-nu-latn", { day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" }) : "—";
  }
  function dateOnly(d) {
    return d ? new Date(d).toLocaleDateString("ar-EG-u-nu-latn", { day: "numeric", month: "short", year: "numeric" }) : "—";
  }
  function sinceDays(d) { return Math.max(1, Math.ceil((Date.now() - new Date(d).getTime()) / 86400000)); }
  function online(u) { return u.last_seen_at && Date.now() - new Date(u.last_seen_at).getTime() < 5 * 60000; }
  function esc(s) { return String(s == null ? "" : s).replace(/[&<>"]/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]; }); }

  page.innerHTML = '<div class="stack"><div class="skel" style="height:110px"></div><div class="skel" style="height:360px"></div></div>';

  async function load() {
    var r = await client.rpc("admin_users");
    if (r.error) { page.innerHTML = '<div class="card error">تعذّر تحميل المستخدمين: ' + esc(r.error.message) + "</div>"; return false; }
    users = r.data || [];
    compCount = {};
    users.forEach(function (u) { compCount[u.company_id] = (compCount[u.company_id] || 0) + 1; });
    return true;
  }

  function stats() {
    var active = users.filter(function (u) { return u.status === "active"; }).length;
    var susp = users.length - active;
    var week = users.filter(function (u) { return Date.now() - new Date(u.created_at).getTime() < 7 * 86400000; }).length;
    var onl = users.filter(online).length;
    var day = users.filter(function (u) { return u.last_seen_at && Date.now() - new Date(u.last_seen_at).getTime() < 86400000; }).length;
    return html`
      <div class="stat blue" data-quick="clear" style="cursor:pointer" title="عرض الكل"><div class="label">إجمالي المسجلين</div><div class="value">${num(users.length)}</div></div>
      <div class="stat green" data-quick="status:active" style="cursor:pointer"><div class="label">حسابات نشطة</div><div class="value">${num(active)}</div></div>
      <div class="stat red" data-quick="status:suspended" style="cursor:pointer"><div class="label">حسابات موقوفة</div><div class="value">${num(susp)}</div></div>
      <div class="stat amber" data-quick="reg:7" style="cursor:pointer"><div class="label">انضموا آخر 7 أيام</div><div class="value">${num(week)}</div></div>
      <div class="stat teal" data-quick="act:day" style="cursor:pointer"><div class="label">نشطون آخر 24 ساعة</div><div class="value">${num(day)}</div><div class="muted" style="font-size:12px;margin-top:2px">${num(onl)} متصل الآن</div></div>`;
  }

  function ms(d) { return d ? new Date(d).getTime() : 0; }
  function dayStart(v) { return v ? new Date(v + "T00:00:00").getTime() : 0; }
  function dayEnd(v) { return v ? new Date(v + "T23:59:59.999").getTime() : 0; }
  function matches(u) {
    var now = Date.now(), q = F.q.trim().toLowerCase();
    if (q && (u.full_name + " " + u.phone + " " + u.company_name).toLowerCase().indexOf(q) === -1) return false;
    if (F.status && u.status !== F.status) return false;
    if (F.role && (u.role === "admin" ? "admin" : "user") !== F.role) return false;
    var created = ms(u.created_at);
    if (F.reg && F.reg !== "older" && now - created > Number(F.reg) * 86400000) return false;
    if (F.reg === "older" && now - created <= 90 * 86400000) return false;
    if (F.from && created < dayStart(F.from)) return false;
    if (F.to && created > dayEnd(F.to)) return false;
    var seen = ms(u.last_seen_at), never = !u.login_count && !u.last_login_at && !u.last_seen_at;
    if (F.act === "online" && !online(u)) return false;
    if (F.act === "day" && !(seen && now - seen < 86400000)) return false;
    if (F.act === "week" && !(seen && now - seen < 7 * 86400000)) return false;
    if (F.act === "month" && !(seen && now - seen < 30 * 86400000)) return false;
    if (F.act === "idle" && !(seen && now - seen >= 30 * 86400000)) return false;
    if (F.act === "never" && !never) return false;
    var rc = Number(u.records_count) || 0;
    if (F.data === "none" && rc !== 0) return false;
    if (F.data === "low" && !(rc >= 1 && rc <= 50)) return false;
    if (F.data === "mid" && !(rc >= 51 && rc <= 500)) return false;
    if (F.data === "high" && rc <= 500) return false;
    var du = Number(u.days_used) || 0;
    if (F.days === "0" && du !== 0) return false;
    if (F.days === "1" && du !== 1) return false;
    if (F.days === "2-7" && !(du >= 2 && du <= 7)) return false;
    if (F.days === "8+" && du < 8) return false;
    if (F.comp === "single" && (compCount[u.company_id] || 1) !== 1) return false;
    if (F.comp === "multi" && (compCount[u.company_id] || 1) < 2) return false;
    return true;
  }
  var SORTS = {
    created_desc: function (a, b) { return ms(b.created_at) - ms(a.created_at); },
    created_asc: function (a, b) { return ms(a.created_at) - ms(b.created_at); },
    seen_desc: function (a, b) { return ms(b.last_seen_at) - ms(a.last_seen_at); },
    records_desc: function (a, b) { return (Number(b.records_count) || 0) - (Number(a.records_count) || 0); },
    logins_desc: function (a, b) { return (Number(b.login_count) || 0) - (Number(a.login_count) || 0); },
    days_desc: function (a, b) { return (Number(b.days_used) || 0) - (Number(a.days_used) || 0); },
    name_asc: function (a, b) { return String(a.full_name || "").localeCompare(String(b.full_name || ""), "ar"); },
  };
  function filtered() { return users.filter(matches).sort(SORTS[F.sort] || SORTS.created_desc); }
  function activeCount() {
    var n = 0; ["q", "status", "role", "reg", "from", "to", "act", "data", "days", "comp"].forEach(function (k) { if (F[k]) n++; });
    return n;
  }
  function rowsHtml() {
    var list = filtered();
    if (!list.length) return '<tr><td colspan="9" class="empty">لا يوجد مستخدمون مطابقون</td></tr>';
    return list.map(function (u) {
      var isMe = u.id === me.id;
      return html`<tr data-id="${u.id}">
        <td><div class="u-cell"><span class="u-av">${esc((u.full_name || "?").charAt(0))}</span>
          <div><b>${esc(u.full_name)}</b> ${u.role === "admin" ? '<span class="tag">مدير</span>' : ""}
          <div class="muted ltr" style="font-size:12px;text-align:start">${esc(u.phone)}</div></div></div></td>
        <td>${esc(u.company_name)}</td>
        <td><span class="muted">${dateOnly(u.created_at)}</span><div class="muted" style="font-size:11.5px">منذ ${num(sinceDays(u.created_at))} يوم</div></td>
        <td><b>${num(u.days_used)}</b> <span class="muted">يوم</span></td>
        <td><b>${num(u.login_count)}</b> <span class="muted">مرة</span></td>
        <td>${online(u) ? '<span class="badge ok">متصل الآن</span>' : '<span class="muted">' + ago(u.last_seen_at) + "</span>"}</td>
        <td><b>${num(u.records_count)}</b> <span class="muted">سجل</span></td>
        <td>${u.status === "active" ? '<span class="badge ok">نشط</span>' : '<span class="badge err">موقوف</span>'}</td>
        <td><div class="actions-cell">
          <button class="small" data-act="view" data-id="${u.id}">التفاصيل</button>
          ${isMe ? "" : u.status === "active"
            ? '<button class="small danger" data-act="suspend" data-id="' + u.id + '">إيقاف</button>'
            : '<button class="small primary" data-act="activate" data-id="' + u.id + '">تفعيل</button>'}
        </div></td>
      </tr>`;
    }).join("");
  }

  function opts(list, sel) {
    return list.map(function (o) { return '<option value="' + esc(o[0]) + '"' + (String(o[0]) === String(sel) ? " selected" : "") + ">" + esc(o[1]) + "</option>"; }).join("");
  }
  function exportXlsx() {
    var list = filtered();
    var rows = [[{ v: "المستخدمون — " + list.length + " من " + users.length, s: "title" }],
      ["الاسم", "الهاتف", "الشركة", "تاريخ التسجيل", "أيام الاستخدام", "مرات الدخول", "آخر ظهور", "عدد السجلات", "الحالة", "النوع"].map(function (h) { return { v: h, s: "head" }; })];
    list.forEach(function (u) {
      rows.push([{ v: u.full_name || "", s: "text" }, { v: String(u.phone || ""), s: "text" }, { v: u.company_name || "", s: "text" },
        { v: u.created_at ? String(u.created_at).slice(0, 10) : "", s: "date" }, Number(u.days_used) || 0, Number(u.login_count) || 0,
        { v: u.last_seen_at ? String(u.last_seen_at).slice(0, 16).replace("T", " ") : "", s: "date" }, Number(u.records_count) || 0,
        { v: u.status === "active" ? "نشط" : "موقوف", s: "text" }, { v: u.role === "admin" ? "مدير النظام" : "مستخدم", s: "text" }]);
    });
    Xlsx.download("المستخدمون.xlsx", { sheet: "المستخدمون", cols: [24, 16, 26, 14, 12, 12, 18, 12, 10, 14], merges: ["A1:J1"], rows: rows });
  }

  function render() {
    page.innerHTML = html`
      <div class="stack">
        <div class="page-toolbar">
          <div><p class="muted">كل مستخدم له شركة مستقلة · الأدمن فقط يرى هذه الصفحة</p></div>
          <button type="button" id="refresh">${I.trendUp}تحديث</button>
        </div>
        <div class="stats" id="adm-stats">${stats()}</div>
        <div class="card adm-filters">
          <div class="adm-fgrid">
            <div class="field fq"><label>بحث</label><input id="aq" placeholder="الاسم أو الهاتف أو الشركة…" value="${esc(F.q)}" autocomplete="off"></div>
            <div class="field"><label>الحالة</label><select id="f-status" autocomplete="off">${opts([["", "كل الحالات"], ["active", "نشط"], ["suspended", "موقوف"]], F.status)}</select></div>
            <div class="field"><label>نوع الحساب</label><select id="f-role" autocomplete="off">${opts([["", "الكل"], ["user", "مستخدم عادي"], ["admin", "مدير النظام"]], F.role)}</select></div>
            <div class="field"><label>تاريخ التسجيل</label><select id="f-reg" autocomplete="off">${opts([["", "كل الفترات"], ["1", "آخر 24 ساعة"], ["7", "آخر 7 أيام"], ["30", "آخر 30 يوم"], ["90", "آخر 90 يوم"], ["older", "أقدم من 90 يوم"]], F.reg)}</select></div>
            <div class="field"><label>سُجّل من</label><input type="date" id="f-from" value="${esc(F.from)}"></div>
            <div class="field"><label>سُجّل إلى</label><input type="date" id="f-to" value="${esc(F.to)}"></div>
            <div class="field"><label>آخر ظهور</label><select id="f-act" autocomplete="off">${opts([["", "الكل"], ["online", "متصل الآن"], ["day", "آخر 24 ساعة"], ["week", "آخر 7 أيام"], ["month", "آخر 30 يوم"], ["idle", "غير نشط أكثر من 30 يوم"], ["never", "لم يدخل بعد"]], F.act)}</select></div>
            <div class="field"><label>حجم البيانات</label><select id="f-data" autocomplete="off">${opts([["", "الكل"], ["none", "بدون بيانات (0)"], ["low", "قليل (1 – 50)"], ["mid", "متوسط (51 – 500)"], ["high", "كبير (أكثر من 500)"]], F.data)}</select></div>
            <div class="field"><label>أيام الاستخدام</label><select id="f-days" autocomplete="off">${opts([["", "الكل"], ["0", "لم يستخدم"], ["1", "يوم واحد"], ["2-7", "من 2 إلى 7 أيام"], ["8+", "8 أيام فأكثر"]], F.days)}</select></div>
            <div class="field"><label>مستخدمو الشركة</label><select id="f-comp" autocomplete="off">${opts([["", "الكل"], ["single", "شركة بمستخدم واحد"], ["multi", "شركة بأكثر من مستخدم"]], F.comp)}</select></div>
            <div class="field"><label>الترتيب</label><select id="f-sort" autocomplete="off">${opts([["created_desc", "الأحدث تسجيلًا"], ["created_asc", "الأقدم تسجيلًا"], ["seen_desc", "آخر ظهور"], ["records_desc", "الأكثر بيانات"], ["logins_desc", "الأكثر دخولًا"], ["days_desc", "الأكثر أيام استخدام"], ["name_asc", "الاسم"]], F.sort)}</select></div>
          </div>
          <div class="row gap wrap adm-fbar">
            <span class="muted" id="adm-count"></span>
            <span class="sp"></span>
            <button type="button" class="small" id="f-clear">مسح الفلاتر</button>
            <button type="button" class="small stm-xls" id="f-xls">تصدير Excel</button>
          </div>
        </div>
        <div class="card table-wrap">
          <table class="adm-table">
            <thead><tr><th>المستخدم</th><th>الشركة</th><th>التسجيل</th><th>أيام الاستخدام</th><th>مرات الدخول</th><th>آخر ظهور</th><th>البيانات</th><th>الحالة</th><th></th></tr></thead>
            <tbody id="adm-rows">${rowsHtml()}</tbody>
          </table>
        </div>
      </div>`;
    document.getElementById("refresh").onclick = refresh;
    function upd() {
      document.getElementById("adm-rows").innerHTML = rowsHtml();
      var n = filtered().length, ac = activeCount();
      document.getElementById("adm-count").textContent = "عرض " + num(n) + " من " + num(users.length) + (ac ? " — " + num(ac) + " فلتر مفعّل" : "");
      document.getElementById("f-clear").disabled = !ac;
    }
    var map = { "f-status": "status", "f-role": "role", "f-reg": "reg", "f-from": "from", "f-to": "to", "f-act": "act", "f-data": "data", "f-days": "days", "f-comp": "comp", "f-sort": "sort" };
    Object.keys(map).forEach(function (id) { document.getElementById(id).onchange = function (e) { F[map[id]] = e.target.value; if (id === "f-reg" && e.target.value) { F.from = F.to = ""; document.getElementById("f-from").value = ""; document.getElementById("f-to").value = ""; } if ((id === "f-from" || id === "f-to") && e.target.value) { F.reg = ""; document.getElementById("f-reg").value = ""; } upd(); }; });
    document.getElementById("aq").oninput = function (e) { F.q = e.target.value; upd(); };
    document.getElementById("f-clear").onclick = function () { var sort = F.sort; F = { q: "", status: "", role: "", reg: "", from: "", to: "", act: "", data: "", days: "", comp: "", sort: sort }; render(); };
    document.getElementById("f-xls").onclick = exportXlsx;
    document.getElementById("adm-stats").onclick = function (e) {
      var c = e.target.closest("[data-quick]"); if (!c) return;
      var v = c.getAttribute("data-quick"), sort = F.sort;
      F = { q: "", status: "", role: "", reg: "", from: "", to: "", act: "", data: "", days: "", comp: "", sort: sort };
      if (v !== "clear") { var kv = v.split(":"); F[kv[0]] = kv[1]; }
      render();
    };
    upd();
    document.getElementById("adm-rows").onclick = function (e) {
      var b = e.target.closest("[data-act]"); if (!b) return;
      var id = b.getAttribute("data-id"), act = b.getAttribute("data-act");
      var u = users.filter(function (x) { return x.id === id; })[0];
      if (act === "view") openDetail(u);
      if (act === "suspend") openSuspend(u);
      if (act === "activate") setStatus(u, "active", null);
    };
  }

  async function refresh() {
    if (await load()) { render(); UI.toast("تم التحديث"); }
  }

  async function setStatus(u, status, note) {
    var r = await client.rpc("admin_set_status", { p_user: u.id, p_status: status, p_note: note });
    if (r.error) { UI.toast(r.error.message, true); return; }
    UI.toast(status === "active" ? "تم تفعيل الحساب" : "تم إيقاف الحساب");
    await load(); render();
  }

  function modal(inner, wide) {
    var ov = document.createElement("div");
    ov.className = "modal-overlay";
    ov.innerHTML = '<div class="modal card' + (wide ? " wide" : "") + '">' + inner + "</div>";
    document.body.appendChild(ov);
    ov.onclick = function (e) { if (e.target === ov) ov.remove(); };
    ov.querySelectorAll("[data-close]").forEach(function (b) { b.onclick = function () { ov.remove(); }; });
    return ov;
  }

  function openSuspend(u) {
    var ov = modal(html`
      <h3 style="margin-top:0">إيقاف حساب: ${esc(u.full_name)}</h3>
      <p class="muted" style="margin:0 0 14px">سيفقد المستخدم الوصول لبياناته فوراً حتى تُعيد تفعيله. بياناته تبقى محفوظة.</p>
      <div class="field"><label>رسالة تظهر للمستخدم (اختياري)</label>
        <textarea id="s-note" placeholder="مثال: انتهت الفترة التجريبية، تواصل معنا لتفعيل النظام"></textarea></div>
      <div class="row gap" style="justify-content:flex-end;margin-top:16px">
        <button type="button" class="ghost" data-close>إلغاء</button>
        <button type="button" class="danger" id="s-ok">تأكيد الإيقاف</button>
      </div>`);
    ov.querySelector("#s-ok").onclick = async function () {
      var note = ov.querySelector("#s-note").value.trim() || null;
      ov.remove(); await setStatus(u, "suspended", note);
    };
  }

  async function openDetail(u) {
    var ov = modal(html`
      <div class="det-head">
        <div class="u-cell"><span class="u-av lg">${esc((u.full_name || "?").charAt(0))}</span>
          <div><h3 style="margin:0;padding:0;border:0">${esc(u.full_name)}</h3>
          <div class="muted">${esc(u.company_name)} · <span class="ltr">${esc(u.phone)}</span></div></div></div>
        <button type="button" class="ghost" data-close aria-label="إغلاق">${I.close}</button>
      </div>
      <div class="det-kpis">
        <div class="box"><span>مدة التسجيل</span><b>${num(sinceDays(u.created_at))} يوم</b></div>
        <div class="box"><span>أيام الاستخدام الفعلي</span><b>${num(u.days_used)} يوم</b></div>
        <div class="box"><span>مرات الدخول</span><b>${num(u.login_count)}</b></div>
        <div class="box"><span>آخر دخول</span><b style="font-size:14px">${ago(u.last_login_at)}</b></div>
        <div class="box"><span>إجمالي السجلات</span><b>${num(u.records_count)}</b></div>
      </div>
      ${u.status === "suspended" ? html`<div class="susp-note" style="margin:0 0 14px">الحساب موقوف${u.status_note ? " — " + esc(u.status_note) : ""}</div>` : ""}
      <div class="seg" style="margin-bottom:14px"><button type="button" class="on" data-tab="act">النشاط</button><button type="button" data-tab="data">بيانات الشركة</button></div>
      <div id="det-body"><div class="skel" style="height:140px"></div></div>`, true);

    var body = ov.querySelector("#det-body");
    var tabs = ov.querySelectorAll("[data-tab]");
    tabs.forEach(function (t) {
      t.onclick = function () {
        tabs.forEach(function (x) { x.classList.toggle("on", x === t); });
        if (t.getAttribute("data-tab") === "act") showActivity(u, body); else showData(u, body);
      };
    });
    showActivity(u, body);
  }

  async function showActivity(u, body) {
    body.innerHTML = '<div class="skel" style="height:140px"></div>';
    var since = new Date(Date.now() - 29 * 86400000).toISOString().slice(0, 10);
    var a = await client.from("activity_days").select("day,hits").eq("user_id", u.id).gte("day", since);
    var l = await client.from("login_events").select("at,user_agent").eq("user_id", u.id).order("at", { ascending: false }).limit(15);
    var map = {};
    (a.data || []).forEach(function (x) { map[x.day] = x.hits; });
    var cells = "";
    for (var i = 29; i >= 0; i--) {
      var d = new Date(Date.now() + 3 * 3600000 - i * 86400000).toISOString().slice(0, 10);
      var h = map[d] || 0;
      cells += '<i class="day ' + (h ? (h > 10 ? "h3" : h > 3 ? "h2" : "h1") : "") + '" title="' + d + (h ? " · " + h + " زيارة" : " · لا نشاط") + '"></i>';
    }
    function dev(ua) {
      ua = ua || "";
      var os = /Android/i.test(ua) ? "Android" : /iPhone|iPad/i.test(ua) ? "iOS" : /Windows/i.test(ua) ? "Windows" : /Mac/i.test(ua) ? "Mac" : /Linux/i.test(ua) ? "Linux" : "—";
      var br = /Edg\//.test(ua) ? "Edge" : /Chrome\//.test(ua) ? "Chrome" : /Firefox\//.test(ua) ? "Firefox" : /Safari\//.test(ua) ? "Safari" : "";
      return os + (br ? " · " + br : "");
    }
    body.innerHTML = html`
      <div class="panel-sub" style="margin-bottom:8px">آخر 30 يوماً (كل مربع = يوم، الأغمق = نشاط أكثر)</div>
      <div class="day-grid">${cells}</div>
      <h4 style="margin:20px 0 8px">آخر عمليات الدخول</h4>
      <div class="card table-wrap" style="box-shadow:none"><table>
        <thead><tr><th>الوقت</th><th>الجهاز</th></tr></thead>
        <tbody>${(l.data || []).map(function (x) { return "<tr><td>" + dateTime(x.at) + "</td><td class='muted'>" + esc(dev(x.user_agent)) + "</td></tr>"; }).join("") || '<tr><td colspan="2" class="empty compact">لا توجد عمليات دخول</td></tr>'}</tbody>
      </table></div>`;
  }

  async function showData(u, body) {
    body.innerHTML = '<div class="skel" style="height:140px"></div>';
    var t = await client.rpc("admin_company_tables", { p_company: u.company_id });
    if (t.error) { body.innerHTML = '<div class="card error">' + esc(t.error.message) + "</div>"; return; }
    var tabs = (t.data || []).filter(function (x) { return x.n > 0; });
    // ملخص مالي سريع
    var tot = {};
    await Promise.all(["sales", "purchases"].map(async function (tb) {
      var r = await client.from("records").select("data").eq("company_id", u.company_id).eq("tbl", tb).limit(1000);
      tot[tb] = (r.data || []).reduce(function (s, x) { return s + (Number(x.data.total) || 0); }, 0);
    }));
    body.innerHTML = html`
      <div class="det-kpis" style="margin-bottom:14px">
        <div class="box"><span>إجمالي المبيعات</span><b>${money(tot.sales)}</b></div>
        <div class="box"><span>إجمالي المشتريات</span><b>${money(tot.purchases)}</b></div>
      </div>
      <div class="tbl-chips">${tabs.map(function (x) { return '<button type="button" class="chip-btn" data-t="' + x.tbl + '">' + tblName(x.tbl) + ' <b>' + num(x.n) + "</b></button>"; }).join("") || '<span class="muted">لم يُدخل هذا المستخدم أي بيانات بعد</span>'}</div>
      <div id="tbl-view" style="margin-top:12px"></div>`;
    var view = body.querySelector("#tbl-view");
    body.querySelectorAll("[data-t]").forEach(function (b) {
      b.onclick = async function () {
        body.querySelectorAll("[data-t]").forEach(function (x) { x.classList.toggle("on", x === b); });
        view.innerHTML = '<div class="skel" style="height:100px"></div>';
        var tb = b.getAttribute("data-t");
        var r = await client.from("records").select("id,data,created_at").eq("company_id", u.company_id).eq("tbl", tb).order("created_at", { ascending: false }).limit(100);
        var rows = r.data || [];
        var keys = [];
        rows.slice(0, 30).forEach(function (x) { Object.keys(x.data).forEach(function (k) { if (keys.indexOf(k) < 0 && k !== "id" && k !== "created_at" && !/_id$/.test(k)) keys.push(k); }); });
        keys = keys.slice(0, 8);
        view.innerHTML = '<div class="card table-wrap" style="box-shadow:none;max-height:340px;overflow:auto"><table><thead><tr>' +
          keys.map(function (k) { return "<th>" + esc(k) + "</th>"; }).join("") + "<th>التاريخ</th></tr></thead><tbody>" +
          rows.map(function (x) {
            return "<tr>" + keys.map(function (k) { var v = x.data[k]; return "<td>" + esc(typeof v === "object" ? JSON.stringify(v) : v) + "</td>"; }).join("") +
              "<td class='muted'>" + dateOnly(x.created_at) + "</td></tr>";
          }).join("") + "</tbody></table></div>" + (rows.length === 100 ? '<div class="muted" style="margin-top:6px;font-size:12px">يُعرض آخر 100 سجل</div>' : "");
      };
    });
    var first = body.querySelector("[data-t]"); if (first) first.click();
  }

  if (await load()) render();
})();
