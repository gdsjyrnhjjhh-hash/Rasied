(async function () {
  var page = await UI.init("accounts");
  if (!page) return;
  var html = UI.html;
  var accounts = [];

  page.innerHTML = html`
    <div class="stack">
      <div class="page-toolbar">
        <div>
          <h2 style="margin:0">دليل الحسابات</h2>
          <p class="muted" style="margin:4px 0 0;font-size:12px">شجرة الحسابات المالية</p>
        </div>
      </div>

          <div class="field"><label>الاسم</label><input id="name" required value="${a.name || ""}"></div>
          <div class="field"><label>النوع</label>
            <select id="type">${UI.ACCOUNT_TYPES.map(function (t) {
              return html`<option value="${t.key}" ${t.key === a.type ? "selected" : ""}>${t.label}</option>`;
            }).join("")}</select>
          </div>
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
      var payload = {
        code: document.getElementById("code").value.trim(),
        name: document.getElementById("name").value.trim(),
        type: document.getElementById("type").value,
      };
      try {
        if (isNew) await DB.insert("accounts", payload);
        else await DB.update("accounts", a.id, payload);
        UI.toast("تم الحفظ"); ov.remove(); await load();
      } catch (err) { UI.toast(err.message, true); }
    };
  }

  async function load() {
    accounts = await DB.list("accounts");
    render();
  }

  document.getElementById("btn-add").onclick = function () { openForm(null); };
  document.getElementById("list").onclick = async function (e) {
    var btn = e.target.closest("[data-act]");
    if (!btn) return;
    var id = btn.getAttribute("data-id");
    var a = accounts.filter(function (x) { return x.id === id; })[0];
    if (btn.getAttribute("data-act") === "edit") openForm(a);
    if (btn.getAttribute("data-act") === "del") {
      if (!confirm("حذف الحساب؟")) return;
      await DB.remove("accounts", id); UI.toast("تم الحذف"); await load();
    }
  };
  await load();
})();
