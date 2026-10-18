(async function () {
  var page = await UI.init("party-trial");
  if (!page) return;
  var html = UI.html, money = UI.money, esc = Ledger.esc, val = Ledger.val;
  var q = new URLSearchParams(location.search);
  var f = { type: q.get("type") === "supplier" ? "supplier" : "customer", from: "", to: "", text: "", only: "" };
  var data = [];

  page.innerHTML = html`
    <div class="stack">
      <div class="page-toolbar">
        <div>
          <h2 style="margin:0">ميزان مراجعة الأطراف</h2>
          <p class="muted" style="margin:4px 0 0;font-size:12px">رصيد أول الفترة · الحركة · رصيد آخر الفترة · ملخص النشاط</p>
        </div>
        <div class="row gap">
          <button type="button" id="sync">إعادة احتساب الأرصدة</button>
          <button type="button" id="csv">تصدير Excel</button>
          <button type="button" id="prn">طباعة</button>
        </div>
      </div>
      <div class="card">
        <div class="form-grid">
          <div class="field"><label>النوع</label><select id="type"><option value="customer">العملاء</option><option value="supplier">الموردون</option></select></div>
          <div class="field"><label>من تاريخ</label><input type="date" id="from"></div>
          <div class="field"><label>إلى تاريخ</label><input type="date" id="to"></div>
          <div class="field"><label>عرض</label><select id="only"><option value="">كل الأطراف</option><option value="due">أرصدة مستحقة فقط</option><option value="active">لها حركة في الفترة</option></select></div>
          <div class="field full"><label>بحث</label><input id="text" placeholder="اسم الطرف..."></div>
        </div>
      </div>
      <div class="stats" id="stats"></div>
      <div class="card table-wrap" id="tbl"></div>
    </div>`;

  var isC = function () { return f.type === "customer"; };

  function rows() {
    var t = (f.text || "").toLowerCase();
    return data.filter(function (m) {
      if (t && (m.party.name || "").toLowerCase().indexOf(t) === -1) return false;
      if (f.only === "due" && !(m.end > 0.004)) return false;
      if (f.only === "active" && !(m.docs || m.ret || m.pay || m.disc || m.setl)) return false;
      return true;
    }).sort(function (a, b) { return b.end - a.end; });
  }

  function draw() {
    var r = rows(), c = isC();
    var sum = function (k) { return r.reduce(function (s, m) { return s + (m[k] || 0); }, 0); };
    document.getElementById("stats").innerHTML = html`
      <div class="stat"><div class="label">رصيد أول الفترة</div><div class="value">${money(sum("start"))}</div></div>
      <div class="stat amber"><div class="label">${c ? "المبيعات" : "المشتريات"}</div><div class="value">${money(sum("docs"))}</div></div>
      <div class="stat green"><div class="label">${c ? "التحصيلات" : "المدفوعات"}</div><div class="value">${money(sum("pay"))}</div></div>
      <div class="stat red"><div class="label">رصيد آخر الفترة</div><div class="value">${money(sum("end"))}</div></div>`;
    document.getElementById("tbl").innerHTML = html`
      <table>
        <thead><tr><th>${c ? "العميل" : "المورد"}</th><th>أول الفترة</th><th>${c ? "مبيعات" : "مشتريات"}</th><th>مردودات</th><th>${c ? "تحصيلات" : "مدفوعات"}</th><th>خصومات</th><th>تسويات</th><th>آخر الفترة</th><th>آخر حركة</th><th></th></tr></thead>
        <tbody>
          ${r.map(function (m) {
            return html`<tr>
              <td><b>${m.party.name}</b></td><td>${money(m.start)}</td><td>${money(m.docs)}</td><td>${money(m.ret)}</td>
              <td>${money(m.pay)}</td><td>${money(m.disc)}</td><td>${money(m.setl)}</td>
              <td class="${m.end > 0.004 ? "accent" : ""}"><b>${money(m.end)}</b></td>
              <td dir="ltr" class="muted">${m.last || "—"}</td>
              <td><a class="small button" href="statements.html?type=${f.type}&id=${m.party.id}">كشف</a></td>
            </tr>`;
          }).join("") || html`<tr><td colspan="10" class="empty">لا توجد بيانات</td></tr>`}
        <tr style="font-weight:700;background:var(--surface-3)"><td><b>الإجمالي</b></td><td>${money(sum("start"))}</td><td>${money(sum("docs"))}</td><td>${money(sum("ret"))}</td><td>${money(sum("pay"))}</td><td>${money(sum("disc"))}</td><td>${money(sum("setl"))}</td><td><b>${money(sum("end"))}</b></td><td colspan="2"></td></tr>
        </tbody>
      </table>`;
  }

  async function load() {
    data = await Ledger.trial(f.type, f.from, f.to);
    draw();
  }

  document.getElementById("type").value = f.type;
  document.getElementById("type").onchange = function () { f.type = val("type"); load(); };
  document.getElementById("from").onchange = function () { f.from = val("from"); load(); };
  document.getElementById("to").onchange = function () { f.to = val("to"); load(); };
  document.getElementById("only").onchange = function () { f.only = val("only"); draw(); };
  document.getElementById("text").oninput = function () { f.text = val("text"); draw(); };
  document.getElementById("sync").onclick = async function () {
    if (!confirm("سيُعاد احتساب رصيد كل الأطراف من الحركات (الفواتير والسندات والمردودات والخصومات والتسويات). متابعة؟")) return;
    var n = await Ledger.recomputeAll(f.type); UI.toast("تم تحديث " + n + " رصيد"); load();
  };
  document.getElementById("csv").onclick = function () {
    var c = isC();
    UI.exportCSV("ميزان-" + (c ? "العملاء" : "الموردين") + ".csv", ["الاسم", "أول الفترة", c ? "مبيعات" : "مشتريات", "مردودات", c ? "تحصيلات" : "مدفوعات", "خصومات", "تسويات", "آخر الفترة"],
      rows().map(function (m) { return [m.party.name, m.start, m.docs, m.ret, m.pay, m.disc, m.setl, m.end]; }));
  };
  document.getElementById("prn").onclick = function () {
    var c = isC(), co = DB.getCompany(), r = rows();
    UI.printHTML("ميزان مراجعة", "<h1>" + esc(co.name || "") + "</h1><h2>ميزان مراجعة " + (c ? "العملاء" : "الموردين") + "</h2>" +
      '<div class="meta"><div>الفترة: ' + (f.from || "البداية") + " → " + (f.to || "اليوم") + "</div></div>" +
      "<table><thead><tr><th>الاسم</th><th>أول الفترة</th><th>" + (c ? "مبيعات" : "مشتريات") + "</th><th>مردودات</th><th>" + (c ? "تحصيلات" : "مدفوعات") + "</th><th>آخر الفترة</th></tr></thead><tbody>" +
      r.map(function (m) { return "<tr><td>" + esc(m.party.name) + "</td><td>" + money(m.start) + "</td><td>" + money(m.docs) + "</td><td>" + money(m.ret) + "</td><td>" + money(m.pay) + "</td><td>" + money(m.end) + "</td></tr>"; }).join("") +
      "</tbody></table>");
  };
  await load();
})();
