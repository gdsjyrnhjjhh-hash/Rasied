# HANDOFF — نظام الشركة التجارية (Trading ERP)
**الإصدار الحالي: v22**  
**التاريخ المرجعي: 2026-10-17**

> الصق في أي محادثة جديدة:
> «اقرأ HANDOFF لنظام التجارة (v8) في trading-system/HANDOFF.md وأكمل من آخر حالة — لا تعِد البناء من الصفر.»

---

## 1) المسارات
| العنصر | المسار |
|--------|--------|
| المشروع | `/home/workdir/artifacts/trading-system/` |
| آخر ZIP | `/home/workdir/artifacts/trading-system-v18-full.zip` |
| نسخة HANDOFF | `trading-system/HANDOFF.md` + `TRADING-SYSTEM-HANDOFF.md` |
| ورشة (منفصل) | `workshop-system/` + `workshop-system-garage-v014.zip` |

## 2) التقنيات
- Static: HTML + CSS + JS (بدون React/Vue)
- عربي RTL · خط Cairo
- `js/db.js` — Demo (`localStorage` مفتاح **`trading_demo_v3`**) أو Supabase عبر `js/config.js`
- `js/ui.js` — شيل، قائمة، ثيم داكن، Ctrl+K، انتقالات، شريط تقدّم
- Cloudflare Pages جاهز (`_headers`)

## 3) الوحدات المنفّذة (كاملة)

### مالية وتشغيل
- لوحة تحكم (عدّادات، أعمدة، نقدية، رواتب)
- بيع + ض.ق.م + طباعة + قيد + خصم مخزون
- شراء + ض.ق.م + طباعة + قيد + زيادة مخزون
- مردودات بيع / شراء
- عملاء · موردين (أرصدة)
- أصناف · مخازن · جرد · **تحويلات مخازن**
- **خزائن** + حركات + ربط اختياري مع السندات
- سندات قبض/صرف + قيود
- دليل حسابات · قيود يومية · مصروفات
- تقارير (ميزان، أرباح، مخزون، CSV)
- **موظفين (HR)** · **مسير مرتبات** + قيد
- إعدادات شركة + ضريبة + Demo reset
- ثيم فاتح/داكن محفوظ

### UX
- أنيميشن، Breadcrumb، إجراء سريع، لوحة أوامر Ctrl+K، تفاصيل فاتورة فاخرة

## 3.5) الشيل الثابت (v22) — لا تكسره
- كل صفحة: `<body data-page="المفتاح">` ثم `config.js` و`ui.js` **متزامنين** مباشرة بعد `#app`، وباقي السكربتات `defer`.
- `ui.js` يرسم القائمة + الشريط العلوي فورًا عند تحميله (`boot()`) من كاش `trading_shell_v1` (الصلاحيات/الاسم/الشركة)، قبل أي طلب Supabase.
- `UI.init(key)` لا يعيد بناء الشيل؛ يطابقه مع الجلسة (`reconcileShell`) ويحدّث الأجزاء المتغيرة فقط.
- الكاش: يُكتب في `login.js` عند الدخول وفي `UI.init` بعد كل تحقق، ويُمسح في `DB.logout`. (للعرض فقط — الحماية الفعلية RLS.)
- موضع تمرير القائمة محفوظ في `sessionStorage` (`trading_nav_scroll`).
- CSS: `@view-transition` + `view-transition-name` للسايدبار والتوب بار (آخر الملف في `style.css`).
- صفحة جديدة = أضف `data-page` بنفس مفتاح `TITLES` (أو أضفه إلى `PAGE_BOOT` إن اختلف العنوان/المفتاح).

## 4) ملفات الصفحات
كل صفحة: `*.html` + `js/pages/*.js`  
القائمة تُعرَّف في `js/ui.js` → `NAV` + `TITLES` + `NAV_ICONS`

## 5) جداول Demo في SEED
customers, suppliers, warehouses, products, accounts, sales, sale_lines, purchases, purchase_lines, payments, journal_entries, journal_lines, expenses, sale_returns*, purchase_returns*, stocktakes*, cash_registers, cash_movements, employees, payroll_runs, payroll_lines, stock_transfers*, company, settings

\* وبعضها يبدأ فارغاً في الـ seed

## 6) حسابات محاسبية مرجعية
a1 صندوق · a2 بنك · a3 عملاء · a4 مخزون · a5 موردين · a5b ضريبة مستحقة · a7 مبيعات · a8 مردودات مبيعات · a9 تكلفة · a10 مصروفات · a12 ضريبة قابلة للخصم · a13 رواتب

## 7) أولويات التطوير التالية
1. SQL Supabase كامل لكل الجداول + RLS
2. صلاحيات أدوار (admin / accountant / sales / hr)
3. كميات لكل مخزن (qty per warehouse) بدل qty مركزي
4. بدلات/خصومات تفصيلية في المسير + تأمينات
5. فروع متعددة
6. Auth Supabase حقيقي
7. تصدير PDF حقيقي (غير نافذة طباعة)
8. نظام الورشة منفصل — لا تخلطه مع التجارة إلا بطلب صريح

## 8) قواعد للمساعد في محادثة جديدة
1. اقرأ هذا الملف أولاً.
2. عدّل على `trading-system/` فقط ما لم يُطلب نظام الورشة.
3. وحدة جديدة = html + pages/js + NAV/TITLES/icons + seed إن لزم + تحديث HANDOFF + ZIP جديد.
4. حافظ على العربية وطبقة DB الموحّدة.
5. مع كل تسليم ZIP: حدّث رقم الإصدار هنا واذكر المسار الكامل للـ ZIP.
6. لا تحذف وحدات قائمة بدون سبب.

## 9) تشغيل
```bash
cd trading-system && python3 -m http.server 8000
```
إعادة ضبط Demo: الإعدادات أو مسح `trading_demo_v3`.

## 10) سجل إصدارات مختصر
- v6: خزائن + HR + مرتبات
- v7: ضريبة شراء + ربط سندات بالخزائن + SQL أولي + لوحة أغنى
- **v8: تحويلات مخازن + HANDOFF موحّد**
- **v9: تقارير KPI + أشرطة تقدم + عملاء بإحصائيات + طبقة CSS احترافية إضافية**
- **v10: طبقة Motion عالية — blur/scale دخول، spring مودال، 3D hover للكروت، أعمدة نابضة، توست/أوامر سينمائية**
- **v11: js/motion.js — ميل 3D يتبع الماوس + glare + أزرار مغناطيسية + MutationObserver لإعادة الربط**
- **v12: إحصائيات أعلى الصفحات (مبيعات/عملاء/موردين/أصناف) + توحيد page-toolbar + لمسات CSS**
- **v13: إحصائيات المشتريات + تنبيه صفوف المخزون المنخفض + شريط نشاط في لوحة التحكم**
- **v14: هوية الشركة في السايدبار من الإعدادات + نسخة ERP في التذييل + توحيد عناوين الصفحات + empty-pro**
- **v15: ثيم محاسبي — أزرق gradient · رمادي · أحمر · أبيض (بدل التركواز)**
- **v16: إصلاح السايدبار — position fixed لا تتحرك مع التمرير + تصميم داكن نظيف محاسبي**
- **v17: حركة هادئة (إلغاء الميل 3D) + نظام تصميم مبسّط**
- **v19: Supabase حقيقي — تسجيل/دخول بالهاتف، كل مستخدم شركة معزولة (RLS)، أول مسجّل = أدمن، صفحة admin.html (المسجلون، أيام الاستخدام، مرات الدخول، بيانات كل شركة، إيقاف/تفعيل)، حساب موقوف يرى شاشة تفعيل**
- **v18: نظام تصميم "Ledger" — سايدبار/شريط علوي جديد + بحث عام، لوحة تحكم بمخطط مساحي تفاعلي وSparklines وفترات 7/14/30، أرقام لاتينية موحّدة، حالات فارغة وتوست بأيقونات، قالب طباعة فواتير جديد، ثيم يتبع النظام. إصلاحات: صفحات دليل الحسابات/المصروفات/المخازن كانت ملفاتها ناقصة وأُعيد بناؤها؛ الإعدادات كانت تحفظ في مفتاح قديم (v2) فأصبحت تمر عبر DB.getCompany/saveCompany**

## 11) جملة النسخ للمحادثة الجديدة
```
أكمل نظام الشركة التجارية من HANDOFF v18
المسار: /home/workdir/artifacts/trading-system/
آخر حزمة: trading-system-v18-full.zip
لا تعِد البناء من الصفر. اقرأ HANDOFF.md ونفّذ أولوية التطوير التالية التي أحددها.
```


## 12) السحابة (v19)
- المشروع: `cunfabvfjkiijycnxwxx` (eu-west-1). الإعدادات في `js/config.js` (اتركها فارغة لوضع Demo).
- الجداول: companies · profiles · activity_days · login_events · records (كل بيانات النظام: company_id + tbl + data jsonb) — الملف `supabase/migrations/20261017000002_multitenant_auth_admin.sql`.
- الدخول: الهاتف → إيميل داخلي `p<phone>@phone.tradingerp.app` + كلمة مرور. التسجيل عبر Edge Function `register` (بدون SMS).
- الأدمن: أول حساب يُسجَّل. دوال: admin_users · admin_company_tables · admin_set_status. الإيقاف عبر RLS (is_active).
- التتبع: record_login عند الدخول + heartbeat عند كل تحميل صفحة → أيام الاستخدام (بتوقيت الرياض) وعدد الدخول وآخر ظهور.
- أولويات لاحقة: جداول typed بدل records، تفعيل SMS OTP، مدة تجربة تلقائية/اشتراكات، استعادة كلمة المرور.

## 13. v20 — مزايا رولكس التجارية (بدون التصنيع)
- `js/ledger.js` (global `Ledger`): الرصيد يُشتق من الحركات. عميل = افتتاحي + مبيعات − مردودات − تحصيلات − خصومات ± تسويات (والمورد بنفس المنطق). دوال: `statement, trial, recompute(All), treasuryMove, transfer, treasuryStatement, recordPayment, recordAdjustment, modal`.
- جداول جديدة داخل `records`: `party_txns` (خصم/تسوية: party_type, party_id, kind, direction inc|dec, amount) و`treasury_tabs` (name, kind general|private). حقول جديدة: `cash_movements.type/tab_id/party_*/grp`، و`customers|suppliers.code/opening_balance/credit_limit/address`. لا تغيير في مخطط Supabase.
- صفحات: الخزائن (قائمة + كشف حساب برصيد جارٍ + تحويل بين خزائن + تبويبات عامة/خاصة وتقريرها)، `statements.html` كشف حساب عميل/مورد مع تحصيل/سداد/خصم/تسوية وتصدير وطباعة، `party-trial.html` ميزان مراجعة الأطراف.
- الرصيد السابق للخزينة = الرصيد المخزَّن − صافي الحركات (يحفظ بيانات الإصدارات السابقة). أرصدة الأطراف القديمة قد تختلف عن الحركات: يظهر تنبيه "اعتماد رصيد الحركات" أو زر "إعادة احتساب الأرصدة".
- تم استبعاد كل ما يخص التصنيع (تركيبات، أوامر إنتاج/تعبئة، مواد، تعبئة وتغليف، نصف مصنع/تام).

### v20 — المرحلة الثانية
- البنوك (`banks`, `bank_movements`): إيداع/سحب مع ربط اختياري بخزينة + كشف برصيد جارٍ + قيد يومية (a2).
- كشف المبيعات (فواتير + ملخص الأصناف والربح)، التقرير اليومي، الحضور والانصراف (`attendance`) مع ملخص شهري.

### v20 — فاتورة البيع
- خصم على الفاتورة (`discount`, `gross`; و`subtotal` = بعد الخصم وقبل الضريبة)، رقم الدفتر `book_no`، المندوب `rep_id` (من الموظفين)، منع المدفوع الأكبر من الإجمالي، وتنبيه تجاوز حد ائتمان العميل. الخصم يظهر في العرض والطباعة.

## 14. مستخدمو الشركة والصلاحيات (مطبّق على Supabase ومنشور)
> تم تشغيل الـmigration ونشر الدالة `staff` (verify_jwt=true) على المشروع cunfabvfjkiijycnxwxx، واختُبرت الصلاحيات داخل معاملة تُلغى: المالك يدير موظفيه فقط، ومالك شركة أخرى والموظف محجوبان، والموظف لا يعدّل بيانات الشركة.
1. شغّل `supabase/migrations/20261018000001_company_staff.sql` في SQL Editor (يضيف `company_role/permissions/created_by` وكل الحسابات الحالية تصبح owner، ودوال `company_staff` و`staff_update` و`create_staff`، ويحصر تعديل بيانات الشركة بالمالك).
2. انشر الدالة `supabase/functions/staff/index.ts` باسم `staff` مع verify_jwt=true.
3. الواجهة: صفحة `staff.html` (للمالك فقط) تضيف موظفًا برقم تليفون وكلمة مرور وصفحات مسموحة (قوالب: مبيعات/أمين مخزن/محاسب)، وتوقفه أو تحذفه أو تغيّر كلمة مروره.
4. التنفيذ: القائمة والصفحات تُحجب في الواجهة (`UI.init`)، أما العزل بين الشركات فمطبّق في قاعدة البيانات. صلاحيات الصفحات ليست مفروضة على مستوى الجدول داخل Supabase (كل البيانات في `records`)، فهي لتنظيم العمل لا لمنع موظف تقني من الوصول لبيانات شركته عبر أدوات المتصفح.

## 15) v21 — الفواتير والمرتجعات والخزينة بنمط ROLLEX
- `js/invoices.js` (Invoices): منطق موحّد للبيع/الشراء/مرتجع البيع/مرتجع الشراء: compute / save / reverse / remove / printBody. التعديل والحذف يعكسان الأثر كاملًا (مخزون، رصيد الطرف، قيود، دفعة، حركة خزينة).
- `invoice.html` + `js/pages/invoice-entry.js`: صفحة إدخال (?kind=sale|purchase|sale_return|purchase_return&id=). الخصم، الناولون، رقم الدفتر، المندوب، الموقع، شريط الإجماليات.
- `js/invoice-list.js`: قائمة موحّدة (sales/purchases/returns/purchase-returns.js سطر واحد).
- الخزينة: `cash-registers.html` بطاقات الخزائن + التبويبات، و`treasury.html?id=` (js/pages/treasury.js): لوحة علوية، رقم حركة `seq`، تبويب عام `tab_id` وخاص `ptab_id`، إضافة/تعديل/حذف (حركات المستندات `ref`/`party_id` محمية، حذف التحويل يحذف الطرفين بـ `grp`)، رصيد افتتاحي، تحويل داخل الصفحة، بحث عربي مطبّع مع تظليل ونسخ النتائج، ترتيب برقم الحركة، تصدير CSV، طباعة، استيراد CSV (تاريخ,بيان,وارد,صادر)، جرد نقدية محفوظ في الجدول `cash_counts` (غير قابل للتعديل).
- لا تغييرات في قاعدة البيانات (جدول records العام يستوعب الجداول الجديدة).

## 16) الشيكات والبنوك (v21)
- `js/cheques.js` (Cheques) + `cheques.html` + `js/pages/cheques.js`: جدول `cheques` (dir in|out، status، due_date، hist). واردة من عملاء: portfolio → deposited → collected (بنك/خزينة) | endorsed (تظهير لمورد) | bounced. صادرة لموردين: pending → cleared | bounced. «تراجع» يعكس آثار المرحلة، والحذف يعكس كل شيء.
- حسابات جديدة تُنشأ تلقائيًا: a13 أوراق القبض، a14 أوراق الدفع. السجلات المرتبطة تحمل `cheque_id` + `stage` (reg/collect/endorse/bounce/clear) في payments/party_txns/bank_movements/journal_entries(source_id).
- `banks.js` أُعيد بناؤه: بطاقات حسابات، كشف برصيد جارٍ، فلترة، إيداع/سحب (مع الخزينة cash_move_id)، تحويل بين البنوك (grp)، حذف حركات (حركات الشيكات مقفلة)، تصدير وطباعة.
- لا تغييرات في قاعدة البيانات.
