(async function () {
  var page = await UI.init("journal");
  if (!page) return;
  var html = UI.html, money = UI.money;
  var entries = [], lines = [], accounts = [];

  page.innerHTML = html`
    <div class="stack">
      <div class="page-toolbar">
        <div>
          <h2 style="margin:0">القيود اليومية</h2>
          <p class="muted" style="margin:4px 0 0;font-size:12px">دفتر اليومية · الترحيل المحاسبي</p>
        </div>
        <button type="button" class="primary" id="btn-add">+ قيد يدوي</button>
      </div>
      <div class="stats" id="je-stats"></div>
      <div class="card table-wrap" id="list"></div>
      <div id="detail"></div>
    </div>`;

  function acctName(id) {
    var a = accounts.filter(function (x) { return x.id === id; })[0];
    return a ? a.code + " — " + a.name : "—";
  }
  function entryTotals(id) {
    var ls = lines.filter(function (l) { return l.entry_id === id; });
    return {
      lines: ls,
      d: ls.reduce(function (s, l) { return s + (Number(l.debit) || 0); }, 0),
      c: ls.reduce(function (s, l) { return s + (Number(l.credit) || 0); }, 0),
    };
  }
  var SRC = { sale: "مبيعات", purchase: "مشتريات", manual: "يدوي", payment: "سند", expense: "مصروف", payroll: "مرتبات", sale_return: "مردود بيع", purchase_return: "مردود شراء" };

  function renderList() {
    var totalD = lines.reduce(function (s, l) { return s + (Number(l.debit) || 0); }, 0);
    var totalC = lines.reduce(function (s, l) { return s + (Number(l.credit) || 0); }, 0);
    var st = document.getElementById("je-stats");
    if (st) st.innerHTML = html`
      <div class="stat"><div class="label">عدد القيود</div><div class="value">${entries.length}</div></div>
      <div class="stat blue"><div class="label">إجمالي المدين</div><div class="value">${money(totalD)}</div></div>
      <div class="stat blue"><div class="label">إجمالي الدائن</div><div class="value">${money(totalC)}</div></div>
      <div class="stat ${Math.abs(totalD - totalC) > 0.01 ? "red" : "green"}"><div class="label">الفرق</div><div class="value">${money(totalD - totalC)}</div></div>`;
    document.getElementById("list").innerHTML = html`
      <table class="clickable">
        <thead><tr><th>رقم</th><th>التاريخ</th><th>البيان</th><th>المصدر</th><th>مدين</th><th>دائن</th></tr></thead>
        <tbody>
          ${entries.length === 0 ? html`<tr><td colspan="6" class="empty">لا توجد قيود</td></tr>` :
            entries.map(function (e) {
              var t = entryTotals(e.id);
              return html`<tr data-id="${e.id}">
                <td><b>#${e.number}</b></td>
                <td dir="ltr">${e.date || ""}</td>
                <td>${e.memo || ""}</td>
                <td><span class="tag">${SRC[e.source] || e.source || "—"}</span></td>
                <td>${money(t.d)}</td>
                <td>${money(t.c)}</td>
              </tr>`;
            }).join("")}
        </tbody>
      </table>`;
  }

  function showDetail(id) {
    var e = entries.filter(function (x) { return x.id === id; })[0];
    if (!e) { document.getElementById("detail").innerHTML = ""; return; }
    var t = entryTotals(id);
    var td = t.d, tc = t.c;
    document.getElementById("detail").innerHTML = html`
      <div class="card stack">
        <div class="row between wrap">
          <div><h3>قيد #${e.number}</h3><div class="muted" style="font-size:12px">${e.memo || ""} · <span dir="ltr">${e.date || ""}</span></div></div>
          ${Math.abs(td - tc) > 0.01 ? html`<p class="badge err" style="margin:0">القيد غير متوازن!</p>` : html`<p class="badge ok" style="margin:0">القيد متوازن</p>`}
        </div>
        <div class="table-wrap"><table>
          <thead><tr><th>الحساب</th><th>مدين</th><th>دائن</th></tr></thead>
          <tbody>${t.lines.map(function (l) {
            return html`<tr><td>${acctName(l.account_id)}</td><td>${l.debit ? money(l.debit) : "—"}</td><td>${l.credit ? money(l.credit) : "—"}</td></tr>`;
          }).join("")}
          <tr><td><b>الإجمالي</b></td><td><b>${money(td)}</b></td><td><b>${money(tc)}</b></td></tr></tbody>
        </table></div>
      </div>`;
    document.getElementById("detail").scrollIntoView({ behavior: "smooth", block: "nearest" });
  }

  async function createManual() {
    var ov = document.createElement("div");
    ov.className = "modal-overlay";
    var rows = [
      { account_id: accounts[0] ? accounts[0].id : "", debit: 0, credit: 0 },
      { account_id: accounts[1] ? accounts[1].id : "", debit: 0, credit: 0 },
    ];
    function renderRows() {
      return rows.map(function (r, i) {
        return html`<div class="form-grid" data-ri="${i}" style="margin-bottom:6px">
          <div class="field"><label>الحساب</label>
            <select class="acc">${accounts.map(function (a) {
              return html`<option value="${a.id}" ${a.id === r.account_id ? "selected" : ""}>${a.code} — ${a.name}</option>`;
            }).join("")}</select>
          </div>
          <div class="field"><label>مدين</label><input class="db" type="number" step="0.01" value="${r.debit || ""}"></div>
          <div class="field"><label>دائن</label><input class="cr" type="number" step="0.01" value="${r.credit || ""}"></div>
        </div>`;
      }).join("");
    }
    ov.innerHTML = html`<div class="modal card">
      <h3 style="margin-top:0">قيد يومية يدوي</h3>
      <form id="f" class="stack">
        <div class="form-grid">
          <div class="field"><label>التاريخ</label><input id="date" type="date" value="${new Date().toISOString().slice(0,10)}"></div>
          <div class="field full"><label>البيان</label><input id="memo" required></div>
        </div>
        <div id="rows">${renderRows()}</div>
        <button type="button" class="ghost small" id="add-row">+ سطر</button>
        <div class="row gap" style="justify-content:flex-end">
          <button type="button" class="ghost" id="cancel">إلغاء</button>
          <button class="primary" type="submit">حفظ</button>
        </div>
      </form>
    </div>`;
    document.body.appendChild(ov);
    ov.querySelector("#add-row").onclick = function () {
      rows.push({ account_id: accounts[0].id, debit: 0, credit: 0 });
      ov.querySelector("#rows").innerHTML = renderRows();
    };
    ov.querySelector("#cancel").onclick = function () { ov.remove(); };
    ov.onclick = function (e) { if (e.target === ov) ov.remove(); };
    ov.querySelector("#f").onsubmit = async function (e) {
      e.preventDefault();
      var collected = [];
      ov.querySelectorAll("[data-ri]").forEach(function (row) {
        collected.push({
          account_id: row.querySelector(".acc").value,
          debit: Number(row.querySelector(".db").value) || 0,
          credit: Number(row.querySelector(".cr").value) || 0,
        });
      });
      var td = collected.reduce(function (s, r) { return s + r.debit; }, 0);
      var tc = collected.reduce(function (s, r) { return s + r.credit; }, 0);
      if (Math.abs(td - tc) > 0.01) {
        UI.toast("القيد غير متوازن: مدين " + td + " ≠ دائن " + tc, true);
        return;
      }
      try {
        var num = await DB.nextNumber("journal_entries");
        var entry = await DB.insert("journal_entries", {
          number: num, date: document.getElementById("date").value,
          memo: document.getElementById("memo").value.trim(), source: "manual",
        });
        for (var i = 0; i < collected.length; i++) {
          await DB.insert("journal_lines", Object.assign({ entry_id: entry.id }, collected[i]));
        }
        UI.toast("تم حفظ القيد #" + num);
        ov.remove(); await load();
      } catch (err) { UI.toast(err.message, true); }
    };
  }

  async function load() {
    var d = await Promise.all([DB.list("journal_entries"), DB.list("journal_lines"), DB.list("accounts")]);
    entries = d[0]; lines = d[1]; accounts = d[2];
    renderList();
  }

  document.getElementById("btn-add").onclick = createManual;
  document.getElementById("list").onclick = function (e) {
    var tr = e.target.closest("tr[data-id]");
    if (tr) showDetail(tr.getAttribute("data-id"));
  };
  await load();
})();
