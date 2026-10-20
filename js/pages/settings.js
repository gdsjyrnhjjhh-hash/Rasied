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
})();
