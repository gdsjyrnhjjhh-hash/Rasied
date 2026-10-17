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
        </div>
        <div><button type="button" class="primary" id="save-co">حفظ بيانات الشركة</button></div>
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
        <h3 style="margin-top:0">الاستضافة والربط</h3>
        <ol style="margin:0;padding-inline-start:20px;line-height:1.8" class="muted">
          <li>ارفع مجلد trading-system على Cloudflare Pages (مجاني).</li>
          <li>اربط Supabase من js/config.js (URL + anon key).</li>
          <li>شغّل SQL من supabase/migrations عند التجهيز.</li>
        </ol>
        <p style="margin:8px 0 0">الوضع الحالي: <b>${DB.isDemo() ? "Demo (متصفح)" : "Supabase متصل"}</b></p>
      </div>

      <div class="card stack">
        <h3 style="margin-top:0">وضع Demo</h3>
        <button type="button" class="danger" id="reset">إعادة ضبط بيانات Demo</button>
      </div>
    </div>`;

  function saveCompanyPatch(patch) {
    try {
      DB.saveCompany(patch);
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
    });
  };
  document.getElementById("save-vat").onclick = function () {
    saveCompanyPatch({
      vat_enabled: document.getElementById("vat-en").value === "1",
      vat_rate: Number(document.getElementById("vat-rate").value) || 0,
    });
  };
  document.getElementById("reset").onclick = function () {
    if (!confirm("مسح كل البيانات المحلية؟")) return;
    DB.resetDemo();
    UI.toast("تمت إعادة الضبط");
    setTimeout(function () { location.reload(); }, 600);
  };
})();
