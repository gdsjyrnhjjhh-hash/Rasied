# HANDOFF — نظام الشركة التجارية (Trading ERP)
**الإصدار الحالي: v13**  
**التاريخ المرجعي: 2026-10-17**

> الصق في أي محادثة جديدة:
> «اقرأ HANDOFF لنظام التجارة (v8) في trading-system/HANDOFF.md وأكمل من آخر حالة — لا تعِد البناء من الصفر.»

---

## 1) المسارات
| العنصر | المسار |
|--------|--------|
| المشروع | `/home/workdir/artifacts/trading-system/` |
| آخر ZIP | `/home/workdir/artifacts/trading-system-v13-full.zip` |
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

## 11) جملة النسخ للمحادثة الجديدة
```
أكمل نظام الشركة التجارية من HANDOFF v13
المسار: /home/workdir/artifacts/trading-system/
آخر حزمة: trading-system-v13-full.zip
لا تعِد البناء من الصفر. اقرأ HANDOFF.md ونفّذ أولوية التطوير التالية التي أحددها.
```
