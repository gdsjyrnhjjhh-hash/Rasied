(function () {
  "use strict";
  var cfg = window.APP_CONFIG || {};
  var $ = function (id) { return document.getElementById(id); };

  try { if (localStorage.getItem("trading_theme") === "dark") document.documentElement.classList.add("dark"); } catch (e) {}

  if (!cfg.SUPABASE_URL) { location.replace("index.html"); return; }
  var client = window.supabase.createClient(cfg.SUPABASE_URL, cfg.SUPABASE_ANON_KEY);

  // نفس تطبيع الخادم: أرقام لاتينية فقط، بدون 00 أو +
  function normPhone(v) {
    var d = String(v || "").replace(/[٠-٩]/g, function (c) { return String(c.charCodeAt(0) - 0x660); }).replace(/\D/g, "");
    if (d.indexOf("00") === 0) d = d.slice(2);
    return d;
  }
  function emailOf(phone) { return "p" + phone + "@phone.tradingerp.app"; }

  function showErr(id, msg) { var e = $(id); e.textContent = msg; e.hidden = !msg; }
  function busy(btn, on, label) { btn.disabled = on; btn.textContent = on ? "جارٍ المعالجة…" : label; }

  // تبديل التبويبات
  function tab(reg) {
    $("form-login").hidden = reg; $("form-reg").hidden = !reg;
    $("tab-login").classList.toggle("on", !reg); $("tab-reg").classList.toggle("on", reg);
    showErr("err-login", ""); showErr("err-reg", "");
  }
  $("tab-login").onclick = function () { tab(false); };
  $("tab-reg").onclick = function () { tab(true); };
  document.querySelectorAll("[data-eye]").forEach(function (b) {
    b.onclick = function () { var i = $(b.getAttribute("data-eye")); i.type = i.type === "password" ? "text" : "password"; };
  });

  async function doLogin(phone, pass) {
    var r = await client.auth.signInWithPassword({ email: emailOf(phone), password: pass });
    if (r.error) throw new Error("رقم الهاتف أو كلمة المرور غير صحيحة");
    try { await client.rpc("record_login", { p_ua: navigator.userAgent }); } catch (e) {}
    // جهّز كاش الشيل (القائمة/الاسم/الشركة) ليظهر الشيل كاملًا فور فتح أول صفحة
    try {
      var uid = r.data.user.id;
      var pr = await client.from("profiles").select("*").eq("id", uid).maybeSingle();
      if (pr.data && pr.data.status === "active") {
        var co = await client.from("companies").select("name").eq("id", pr.data.company_id).maybeSingle();
        localStorage.setItem("trading_shell_v1", JSON.stringify({
          uid: uid, role: pr.data.role, company_role: pr.data.company_role,
          permissions: pr.data.permissions || [], status: pr.data.status,
          full_name: pr.data.full_name, brand: (co.data && co.data.name) || "نظام التجارة"
        }));
      }
    } catch (e) {}
    location.replace("index.html");
  }

  $("form-login").addEventListener("submit", async function (e) {
    e.preventDefault();
    var phone = normPhone($("l-phone").value), pass = $("l-pass").value;
    if (phone.length < 8) return showErr("err-login", "اكتب رقم هاتف صحيح");
    if (!pass) return showErr("err-login", "اكتب كلمة المرور");
    showErr("err-login", ""); busy($("btn-login"), true);
    try { await doLogin(phone, pass); }
    catch (err) { showErr("err-login", err.message); busy($("btn-login"), false, "دخول"); }
  });

  $("form-reg").addEventListener("submit", async function (e) {
    e.preventDefault();
    var phone = normPhone($("r-phone").value), pass = $("r-pass").value;
    var name = $("r-name").value.trim(), co = $("r-co").value.trim();
    if (name.length < 2) return showErr("err-reg", "اكتب اسمك");
    if (co.length < 2) return showErr("err-reg", "اكتب اسم الشركة");
    if (phone.length < 8 || phone.length > 15) return showErr("err-reg", "اكتب رقم هاتف صحيح مع كود الدولة");
    if (pass.length < 6) return showErr("err-reg", "كلمة المرور 6 أحرف على الأقل");
    showErr("err-reg", ""); busy($("btn-reg"), true);
    try {
      var res = await fetch(cfg.SUPABASE_URL + "/functions/v1/register", {
        method: "POST",
        headers: { "Content-Type": "application/json", apikey: cfg.SUPABASE_ANON_KEY, Authorization: "Bearer " + cfg.SUPABASE_ANON_KEY },
        body: JSON.stringify({ phone: phone, password: pass, full_name: name, company_name: co }),
      });
      var j = await res.json().catch(function () { return {}; });
      if (!res.ok) throw new Error(j.message || "تعذّر إنشاء الحساب");
      await doLogin(phone, pass);
    } catch (err) { showErr("err-reg", err.message); busy($("btn-reg"), false, "إنشاء الحساب"); }
  });

  // لو الجلسة موجودة ادخل مباشرة
  client.auth.getSession().then(function (s) { if (s.data.session) location.replace("index.html"); });
  // نسيت كلمة المرور: الحسابات تُنشأ بالهاتف (بلا بريد حقيقي) فلا يوجد رابط استرجاع تلقائي بعد — الإرشاد حسب نوع الحساب
  var forgot = document.getElementById("forgot");
  if (forgot) forgot.onclick = function () {
    var wa = String((window.APP_CONFIG && window.APP_CONFIG.SUPPORT_WHATSAPP) || "").replace(/\D/g, "");
    var ov = document.createElement("div");
    ov.className = "modal-overlay";
    ov.innerHTML = '<div class="modal card"><h3 style="margin-top:0">نسيت كلمة المرور؟</h3>' +
      '<p><b>إذا كنت موظفًا:</b> اطلب من مالك الشركة تغيير كلمة مرورك من «مستخدمو الشركة» ← «تغيير كلمة المرور»، ثم ادخل بالكلمة الجديدة.</p>' +
      '<p><b>إذا كنت مالك الشركة:</b> تواصل مع إدارة النظام برقم هاتفك المسجّل ليتم تعيين كلمة مرور جديدة لك.</p>' +
      (wa ? '<p><a class="button primary" target="_blank" rel="noopener" href="https://wa.me/' + wa + '">تواصل عبر واتساب</a></p>' : "") +
      '<div class="row gap" style="justify-content:flex-end"><button type="button" class="ghost" id="fg-close">إغلاق</button></div></div>';
    document.body.appendChild(ov);
    ov.querySelector("#fg-close").onclick = function () { ov.remove(); };
    ov.onclick = function (e) { if (e.target === ov) ov.remove(); };
  };
})();
