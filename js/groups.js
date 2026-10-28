/* مجموعات شجرية للعملاء والموردين والأصناف (نفس فكرة «تحت أي حساب» في دليل الحسابات).
   الجداول: customer_groups / supplier_groups / product_groups (سجلات {name, parent}) والعنصر يحمل group_id.
   المجموعة لا تحمل حركات — هي للتنظيم والإجماليات فقط، فلا تتأثر الفواتير والتقارير. */
(function () {
  var esc = function (x) { return String(x == null ? "" : x).replace(/[&<>"']/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]; }); };
  var cmp = function (a, b) { return String(a.name || "").localeCompare(String(b.name || ""), "ar", { numeric: true }); };
  var NBSP3 = "\u00A0\u00A0\u00A0";

  function childrenMap(groups) {
    var byId = {}, kids = {};
    groups.forEach(function (g) { byId[g.id] = g; });
    groups.forEach(function (g) {
      var p = g.parent && g.parent !== g.id && byId[g.parent] ? g.parent : "";
      (kids[p] = kids[p] || []).push(g);
    });
    Object.keys(kids).forEach(function (k) { kids[k].sort(cmp); });
    return { byId: byId, kids: kids };
  }
  // ترتيب شجري مسطّح: [{g, level, hasKids}]
  function tree(groups) {
    var m = childrenMap(groups), out = [], seen = {};
    (function walk(pid, level) {
      (m.kids[pid] || []).forEach(function (g) {
        if (seen[g.id]) return; seen[g.id] = 1;
        out.push({ g: g, level: level, hasKids: !!(m.kids[g.id] && m.kids[g.id].length) });
        walk(g.id, level + 1);
      });
    })("", 0);
    groups.forEach(function (g) { if (!seen[g.id]) out.push({ g: g, level: 0, hasKids: false }); });
    return out;
  }
  function descendants(groups, id) {                 // {id:1,...} تشمل المجموعة نفسها
    var res = {}, stack = [id]; res[id] = 1;
    while (stack.length) {
      var cur = stack.pop();
      groups.forEach(function (g) { if (g.parent === cur && !res[g.id]) { res[g.id] = 1; stack.push(g.id); } });
    }
    return res;
  }
  function path(groups, id) {
    var byId = {}; groups.forEach(function (g) { byId[g.id] = g; });
    var parts = [], cur = byId[id], guard = 0;
    while (cur && guard++ < 30) { parts.unshift(cur.name); cur = cur.parent ? byId[cur.parent] : null; }
    return parts.join(" › ");
  }
  // <option> للمجموعات بإزاحة. exclude: {id:1} مستبعدة. first: نص الخيار الأول ("" = بلا خيار أول)
  function options(groups, selected, exclude, first) {
    var h = first != null ? '<option value="">' + esc(first) + "</option>" : "";
    tree(groups).forEach(function (n) {
      if (exclude && exclude[n.g.id]) return;
      h += '<option value="' + esc(n.g.id) + '"' + (n.g.id === selected ? " selected" : "") + ">" + new Array(n.level + 1).join(NBSP3) + esc(n.g.name) + "</option>";
    });
    return h;
  }
  /* تخطيط القائمة الشجرية: يعيد [{kind:"group", g, level, count, sum, open, pseudo} | {kind:"item", item, level}]
     o: { collapsed:{}, agg:fn(item)->number, root:groupId|"", noneLabel } */
  function layout(groups, items, o) {
    o = o || {}; var collapsed = o.collapsed || {}, agg = o.agg || function () { return 0; };
    var m = childrenMap(groups), by = {};
    items.forEach(function (it) { var k = it.group_id && m.byId[it.group_id] ? it.group_id : ""; (by[k] = by[k] || []).push(it); });
    Object.keys(by).forEach(function (k) { by[k].sort(cmp); });
    var memo = {};
    function totals(gid) {
      if (memo[gid]) return memo[gid];
      var t = { count: 0, sum: 0 }; memo[gid] = t;
      (by[gid] || []).forEach(function (it) { t.count++; t.sum += Number(agg(it)) || 0; });
      (m.kids[gid] || []).forEach(function (c) { var s = totals(c.id); t.count += s.count; t.sum += s.sum; });
      return t;
    }
    var out = [];
    function walk(g, level) {
      var t = totals(g.id), open = !collapsed[g.id];
      out.push({ kind: "group", g: g, level: level, count: t.count, sum: t.sum, open: open });
      if (!open) return;
      (m.kids[g.id] || []).forEach(function (c) { walk(c, level + 1); });
      (by[g.id] || []).forEach(function (it) { out.push({ kind: "item", item: it, level: level + 1 }); });
    }
    if (o.root && m.byId[o.root]) { walk(m.byId[o.root], 0); return out; }
    (m.kids[""] || []).forEach(function (g) { walk(g, 0); });
    var un = by[""] || [];
    if (groups.length && un.length) {
      var s = 0; un.forEach(function (it) { s += Number(agg(it)) || 0; });
      var open = !collapsed.__none;
      out.push({ kind: "group", g: { id: "__none", name: o.noneLabel || "بدون مجموعة" }, level: 0, count: un.length, sum: s, open: open, pseudo: true });
      if (open) un.forEach(function (it) { out.push({ kind: "item", item: it, level: 1 }); });
    } else un.forEach(function (it) { out.push({ kind: "item", item: it, level: 0 }); });
    return out;
  }
  function allIds(groups, withNone) { var r = groups.map(function (g) { return g.id; }); if (withNone) r.push("__none"); return r; }

  /* نافذة إدارة المجموعات: cfg = {table, title, items (العناصر لفحص الحذف), onChange()} */
  function manage(cfg) {
    var groups = [], editing = null;
    var ov = document.createElement("div");
    ov.className = "modal-overlay";
    ov.innerHTML = '<div class="modal card" style="max-width:640px;width:100%"><h3 style="margin-top:0">' + esc(cfg.title) + '</h3>' +
      '<p class="muted" style="margin:0 0 10px;font-size:12px">اختر «المجموعة الرئيسية» لتضع المجموعة تحتها، أو اتركها فارغة لتكون مجموعة رئيسية. المجموعات للتنظيم والإجماليات فقط ولا تحمل حركات.</p>' +
      '<form id="g-form" class="row gap wrap" style="align-items:flex-end;margin-bottom:10px">' +
      '<div class="field" style="flex:1 1 180px"><label>اسم المجموعة</label><input id="g-name" required autocomplete="off"></div>' +
      '<div class="field" style="flex:1 1 180px"><label>المجموعة الرئيسية</label><select id="g-parent" autocomplete="off"></select></div>' +
      '<button class="primary" type="submit" id="g-save">إضافة</button><button type="button" class="ghost" id="g-cancel" hidden>إلغاء التعديل</button></form>' +
      '<div class="card table-wrap" style="max-height:48vh;overflow:auto" id="g-list"></div>' +
      '<div class="row gap" style="justify-content:flex-end;margin-top:10px"><button type="button" class="ghost" id="g-close">إغلاق</button></div></div>';
    document.body.appendChild(ov);
    var $ = function (s) { return ov.querySelector(s); };
    function counts() {
      var c = {}; (cfg.items || []).forEach(function (it) { if (it.group_id) c[it.group_id] = (c[it.group_id] || 0) + 1; }); return c;
    }
    function draw() {
      var banned = editing ? descendants(groups, editing.id) : null, cnt = counts();
      $("#g-parent").innerHTML = options(groups, editing ? editing.parent || "" : $("#g-parent").value, banned, "— بدون (مجموعة رئيسية) —");
      $("#g-save").textContent = editing ? "حفظ" : "إضافة";
      $("#g-cancel").hidden = !editing;
      var nodes = tree(groups);
      $("#g-list").innerHTML = nodes.length ? "<table><thead><tr><th>المجموعة</th><th>العناصر</th><th></th></tr></thead><tbody>" + nodes.map(function (n) {
        var direct = cnt[n.g.id] || 0;
        return '<tr><td style="padding-inline-start:' + (n.level * 22 + 8) + 'px"><b>' + esc(n.g.name) + "</b></td><td>" + direct + "</td><td>" +
          '<button class="small" data-act="sub" data-id="' + esc(n.g.id) + '">+ فرعية</button> <button class="small" data-act="edit" data-id="' + esc(n.g.id) + '">تعديل</button> ' +
          '<button class="small danger" data-act="del" data-id="' + esc(n.g.id) + '">حذف</button></td></tr>';
      }).join("") + "</tbody></table>" : '<div class="empty">لا توجد مجموعات بعد — أضف أول مجموعة من الأعلى</div>';
    }
    async function reload() { DB.refresh(cfg.table); groups = await DB.list(cfg.table); draw(); }
    $("#g-close").onclick = function () { ov.remove(); };
    ov.onclick = function (e) { if (e.target === ov) ov.remove(); };
    $("#g-cancel").onclick = function () { editing = null; $("#g-name").value = ""; draw(); };
    $("#g-form").onsubmit = async function (e) {
      e.preventDefault();
      var name = $("#g-name").value.trim(), parent = $("#g-parent").value || null;
      try {
        if (!name) throw new Error("اكتب اسم المجموعة");
        var dup = groups.filter(function (g) { return g.name === name && (g.parent || null) === parent && (!editing || g.id !== editing.id); })[0];
        if (dup) throw new Error("توجد مجموعة بنفس الاسم في نفس المستوى");
        if (editing) {
          if (parent && descendants(groups, editing.id)[parent]) throw new Error("لا يمكن نقل المجموعة تحت نفسها أو تحت إحدى فروعها");
          await DB.update(cfg.table, editing.id, { name: name, parent: parent });
        } else await DB.insert(cfg.table, { name: name, parent: parent });
        editing = null; $("#g-name").value = "";
        await reload(); if (cfg.onChange) await cfg.onChange();
        UI.toast("تم الحفظ");
      } catch (err) { UI.toast(err.message, true); }
    };
    $("#g-list").onclick = async function (e) {
      var b = e.target.closest("[data-act]"); if (!b) return;
      var id = b.getAttribute("data-id"), act = b.getAttribute("data-act"), g = groups.filter(function (x) { return x.id === id; })[0];
      if (!g) return;
      try {
        if (act === "sub") { editing = null; $("#g-name").value = ""; draw(); $("#g-parent").value = id; $("#g-name").focus(); }
        else if (act === "edit") { editing = g; $("#g-name").value = g.name; draw(); $("#g-name").focus(); }
        else if (act === "del") {
          DB.assertCan("delete");
          if (groups.some(function (x) { return x.parent === id; })) throw new Error("لا يمكن حذف مجموعة لها مجموعات فرعية — احذفها أو انقلها أولًا");
          if ((cfg.items || []).some(function (it) { return it.group_id === id; })) throw new Error("لا يمكن حذف مجموعة بها عناصر — انقل العناصر لمجموعة أخرى أولًا");
          if (!confirm("حذف المجموعة؟")) return;
          await DB.remove(cfg.table, id); await reload(); if (cfg.onChange) await cfg.onChange(); UI.toast("تم الحذف");
        }
      } catch (err) { UI.toast(err.message, true); }
    };
    reload();
  }
  window.Groups = { tree: tree, descendants: descendants, path: path, options: options, layout: layout, allIds: allIds, manage: manage, esc: esc };
})();
