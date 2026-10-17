/**
 * Motion Layer v17 — حركة هادئة واحترافية
 * (تم إلغاء الميل ثلاثي الأبعاد والأزرار المغناطيسية لصالح تجربة أنظف)
 */
(function () {
  function restagger(el) {
    if (!el) return;
    el.classList.remove("anim-stagger");
    void el.offsetWidth;
    el.classList.add("anim-stagger");
  }
  function bind() {}
  window.Motion = { bind: bind, unbind: bind, restagger: restagger };
})();
