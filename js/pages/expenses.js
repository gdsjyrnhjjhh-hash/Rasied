(async function () {
  var page = await UI.init("expenses");
  if (!page) return;
  var html = UI.html, money = UI.money;
  var expenses = [], accounts = [];

  page.innerHTML = html`
    <div class="stack">
      <div class="page-toolbar">
        <div>
          <h2 style="margin:0">المصروفات</h2>
          <p class="muted" style="margin:4px 0 0;font-size:12px">مصروفات تشغيلية</p>
        </div>
      </div>

          <div class="field"><label>المبلغ</label><input id="amount" type="number" step="0.01" required min="0.01"></div>
          <div class="field"><label>حساب المصروف</label>
            <select id="acc">${expAccounts.map(function (a) {
              return html`<option value="${a.id}">${a.name}</option>`;
            }).join("")}</select>
          </div>
          <div class="field"><label>الطريقة</label>
            <select id="method"><option value="cash">نقدي</option><option value="bank">بنك</option></select>
          </div>
          <div class="field"><label>التاريخ</label><input id="date" type="date" value="${new Date().toISOString().slice(0,10)}"></div>
        </div>
        <div class="row gap" style="justify-content:flex-end">
          <button type="button" class="ghost" id="cancel">إلغاء</button>
          <button class="primary" type="submit">حفظ</button>
        </div>
      </form>
    </div>`;
    document.body.appendChild(ov);
    ov.querySelector("#cancel").onclick = function () { ov.remove(); };
    ov.onclick = function (e) { if (e.target === ov) ov.remove(); };
    ov.querySelector("#f").onsubmit = async function (e) {
      e.preventDefault();
      var amount = Number(document.getElementById("amount").value) || 0;
      var accId = document.getElementById("acc").value;
      var method = document.getElementById("method").value;
      var date = document.getElementById("date").value;
      try {
        await DB.insert("expenses", {
          description: document.getElementById("desc").value.trim(),
          amount: amount, account_id: accId, method: method, date: date,
        });
        var jn = await DB.nextNumber("journal_entries");
        var entry = await DB.insert("journal_entries", {
          number: jn, date: date, memo: "مصروف: " + document.getElementById("desc").value.trim(), source: "expense",
        });
        var cashAcc = method === "bank" ? "a2" : "a1";
        await DB.insert("journal_lines", { entry_id: entry.id, account_id: accId, debit: amount, credit: 0 });
        await DB.insert("journal_lines", { entry_id: entry.id, account_id: cashAcc, debit: 0, credit: amount });
        UI.toast("تم التسجيل"); ov.remove(); await load();
      } catch (err) { UI.toast(err.message, true); }
    };
  }

  async function load() {
    var d = await Promise.all([DB.list("expenses"), DB.list("accounts")]);
    expenses = d[0]; accounts = d[1];
    render();
  }

  document.getElementById("btn-add").onclick = openForm;
  document.getElementById("list").onclick = async function (e) {
    var btn = e.target.closest("[data-act=del]");
    if (!btn) return;
    if (!confirm("حذف؟")) return;
    await DB.remove("expenses", btn.getAttribute("data-id"));
    UI.toast("تم الحذف"); await load();
  };
  await load();
})();
