(async function () {
  var page = await UI.init("warehouses");
  if (!page) return;
  var html = UI.html;
  var warehouses = [], products = [];

  page.innerHTML = html`
    <div class="stack">
      <div class="page-toolbar">
        <div>
          <h2 style="margin:0">المخازن</h2>
          <p class="muted" style="margin:4px 0 0;font-size:12px">مواقع التخزين</p>
        </div>
      </div>

          <div class="field"><label>الموقع</label><input id="loc" value="${w.location || ""}"></div>
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
      var payload = { name: document.getElementById("name").value.trim(), location: document.getElementById("loc").value.trim() };
      try {
        if (isNew) await DB.insert("warehouses", payload);
        else await DB.update("warehouses", w.id, payload);
        UI.toast("تم الحفظ"); ov.remove(); await load();
      } catch (err) { UI.toast(err.message, true); }
    };
  }

  async function load() {
    var d = await Promise.all([DB.list("warehouses"), DB.list("products")]);
    warehouses = d[0]; products = d[1];
    render();
  }

  document.getElementById("btn-add").onclick = function () { openForm(null); };
  document.getElementById("list").onclick = async function (e) {
    var btn = e.target.closest("[data-act]");
    if (!btn) return;
    var id = btn.getAttribute("data-id");
    var w = warehouses.filter(function (x) { return x.id === id; })[0];
    if (btn.getAttribute("data-act") === "edit") openForm(w);
    if (btn.getAttribute("data-act") === "del") {
      if (!confirm("حذف المخزن؟")) return;
      await DB.remove("warehouses", id); UI.toast("تم الحذف"); await load();
    }
  };
  await load();
})();
