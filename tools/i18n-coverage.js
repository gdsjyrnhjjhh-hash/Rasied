// قياس تغطية الترجمة الإنجليزية: node tools/i18n-coverage.js  (من مجلد trading-system)
// يستخرج العبارات العربية من كل js/html ويمرّرها على المترجم ويطبع ما بقي عربيًا لكل ملف.
// أضف الناقص في js/i18n-en*.js بـ I18n.add({"عربي":"English"}). (أجزاء الكود/regex وأسماء بيانات المستخدم تظهر كباقٍ وهذا طبيعي)
const fs = require("fs"), vm = require("vm"), path = require("path");
const J = path.join(__dirname, "..", "js") + path.sep;
const ctx = { console, setTimeout, Promise, Date, Math, JSON, Object, Array, RegExp, String, Number,
  localStorage: { getItem: () => "en", setItem() {} }, location: { reload() {} }, addEventListener() {}, open() {},
  document: { readyState: "complete", documentElement: { classList: { add() {} } }, addEventListener() {}, title: "" }, MutationObserver: class { observe() {} } };
ctx.window = ctx; vm.createContext(ctx);
vm.runInContext(fs.readFileSync(J + "i18n.js", "utf8"), ctx);
fs.readdirSync(J).filter(f => /^i18n-en\d*\.js$/.test(f)).sort().forEach(f => vm.runInContext(fs.readFileSync(J + f, "utf8"), ctx));
const AR = /[\u0600-\u06FF]/;
function files(d, out = []) { for (const f of fs.readdirSync(d)) { const p = path.join(d, f), st = fs.statSync(p);
  if (st.isDirectory() && !["node_modules", "tools", "supabase"].includes(f)) files(p, out); else if (/\.(js|html)$/.test(f) && !/i18n/.test(f)) out.push(p); } return out; }
let tot = 0, left = 0;
for (const f of files(path.join(__dirname, ".."))) {
  let s = fs.readFileSync(f, "utf8").replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");
  const un = [];
  for (let seg of s.split(/[<>"`${}\\\n;=\[\]]+/)) { seg = seg.trim().replace(/^['+,()\s]+|['+,()\s]+$/g, "");
    if (!AR.test(seg) || seg.length > 140 || /=>|\.test\(|\.replace/.test(seg)) continue; tot++;
    if (AR.test(ctx.I18n.t(seg))) { left++; un.push(seg); } }
  if (un.length) { console.log("##", path.relative(path.join(__dirname, ".."), f), un.length); [...new Set(un)].slice(0, 15).forEach(x => console.log("   ", x)); }
}
console.log("\nالتغطية:", (100 - 100 * left / tot).toFixed(1) + "%", "(" + left + " من " + tot + " عبارة بقيت عربية)");
