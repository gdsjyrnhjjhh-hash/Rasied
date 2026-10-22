/* قاموس الإنجليزية — الدفعة 6: المصروفات، الموردون، التحويلات، الأصناف، المبيعات، الجرد، المخازن، التقرير اليومي، الإعدادات، الدخول، أسماء الحسابات الافتراضية */
I18n.add({
  "رصيد": "Raseed",
  /* ---- المصروفات ---- */
  "مصروفات تشغيلية": "Operating expenses", "مصروف جديد": "New expense", "إجمالي المصروفات": "Total expenses", "مصروفات هذا الشهر": "This month’s expenses", "حساب المصروف": "Expense account",
  "لا توجد مصروفات": "No expenses", "مثال: إيجار، كهرباء، صيانة…": "Example: rent, electricity, maintenance…", "مصروف:": "Expense:", "حذف؟": "Delete?",
  /* ---- الموردون ---- */
  "الذمم الدائنة · المشتريات": "Payables · purchases", "عليهم التزام": "We owe them", "الرصيد الدائن": "Credit balance", "حد التعامل": "Credit limit", "لا يوجد موردين": "No suppliers",
  "تعديل مورد": "Edit supplier", "حد التعامل (0": "Credit limit (0", "حذف المورد؟": "Delete the supplier?",
  /* ---- التحويلات المخزنية ---- */
  "نقل كميات من مخزن إلى آخر": "Move quantities from one warehouse to another", "تحويل": "Transfer", "لا توجد تحويلات": "No transfers", "يلزم مخزنان على الأقل وأصناف": "At least two warehouses and some products are required",
  "متاح:": "Available:", "تحويل مخزني": "Warehouse transfer", "من مخزن": "From warehouse", "إلى مخزن": "To warehouse", "اختر مخزنين مختلفين": "Select two different warehouses", "كمية غير كافية:": "Insufficient quantity:",
  "تم التحويل #": "Transfer done #",
  /* ---- الأصناف ---- */
  "المخزون · التكلفة · التنبيهات": "Stock · cost · alerts", "بحث بالاسم أو الكود...": "Search by name or code...", "تحت الحد الأدنى": "Below minimum", "لا توجد أصناف": "No products", "صنف جديد": "New product",
  "تعديل صنف": "Edit product", "تكلفة الشراء": "Purchase cost", "حذف الصنف؟": "Delete the product?",
  /* ---- كشف المبيعات ---- */
  "فواتير الفترة · المتبقي · ملخص الأصناف المباعة والربحية": "Period invoices · remaining · sold items summary and profitability", "كل العملاء": "All customers", "الفواتير": "Invoices", "ملخص الأصناف": "Items summary",
  "عدد الفواتير": "Invoices", "لا توجد فواتير": "No invoices", "المبيعات (قبل الضريبة": "Sales (before tax", "الربح": "Profit", "كشف-المبيعات.csv": "sales-sheet.csv", "ملخص-الأصناف.csv": "items-summary.csv",
  /* ---- الجرد ---- */
  "سجّل الكمية الفعلية لكل صنف. الفرق يُسوّى تلقائياً في المخزون مع قيد تسوية.": "Enter the actual quantity of each product. The difference is settled automatically in stock with an adjustment entry.",
  "لا توجد عمليات جرد": "No stocktakes", "جرد مخزني": "Stocktake", "جرد دوري...": "Periodic count...", "الكمية الدفترية": "Book quantity", "الكمية الفعلية": "Actual quantity", "ترحيل التسوية": "Post adjustment",
  "تسوية جرد #": "Stocktake adjustment #", "تم ترحيل الجرد #": "Stocktake posted #",
  /* ---- المخازن ---- */
  "مواقع التخزين": "Storage locations", "مخزن جديد": "New warehouse", "عدد المخازن": "Warehouses", "إجمالي الأصناف": "Total products", "لا توجد مخازن": "No warehouses", "تعديل مخزن": "Edit warehouse",
  "اسم المخزن": "Warehouse name", "لا يمكن حذف مخزن يحتوي على أصناف": "Cannot delete a warehouse that contains products", "حذف المخزن؟": "Delete the warehouse?",
  /* ---- التقرير اليومي ---- */
  "ملخص يوم واحد: مبيعات · مشتريات · تحصيلات · مدفوعات · مصروفات · حركة الخزائن": "Single-day summary: sales · purchases · collections · payments · expenses · cash movements",
  "تحصيلات اليوم": "Today’s collections", "لا يوجد": "None", "التحصيلات والمدفوعات": "Collections & payments", "حركة الخزائن (بدون التحويلات": "Cash movements (excluding transfers", "صافي الخزينة اليوم": "Net cash today",
  /* ---- الإعدادات ---- */
  "شركة النور للتجارة": "Al-Nour Trading Co.", "القاهرة": "Cairo", "تُطبَّق على فواتير البيع الجديدة. الافتراضي في مصر: 14%.": "Applied to new sales invoices. Egypt default: 14%.",
  "ارفع مجلد trading-system على Cloudflare Pages (مجاني).": "Upload the trading-system folder to Cloudflare Pages (free).", "اربط Supabase من js/config.js (URL + anon key).": "Connect Supabase from js/config.js (URL + anon key).",
  "شغّل SQL من supabase/migrations عند التجهيز.": "Run the SQL from supabase/migrations when setting up.", "Demo (متصفح": "Demo (browser", "Supabase متصل": "Supabase connected", "وضع Demo": "Demo mode",
  "المظهر وحجم العرض": "Appearance & display size", "حجم العرض": "Display size", "مدمج (موصى به)": "Compact (recommended)", "عادي (أكبر)": "Normal (larger)", "تم تغيير حجم العرض": "Display size changed",
  "الحجم المدمج يُظهر بيانات أكثر في الشاشة ويمنع خروج الجداول العريضة من الصفحة. يُحفظ الاختيار على هذا الجهاز.": "The compact size fits more data on screen and keeps wide tables inside the page. Your choice is saved on this device.",
  /* ---- الدخول ---- */
  "© نظام التجارة · الإصدار 19": "© Trading system · Version 19", "إظهار": "Show", "رقم الهاتف (يُستخدم لتسجيل الدخول": "Phone number (used to sign in", "مع كود الدولة، مثال: 966501234567": "With the country code, e.g. 966501234567",
  "كلمة المرور (6 أحرف على الأقل": "Password (at least 6 characters",
  /* ---- أخرى ---- */
  "الحساب الرئيسي (يوضع هذا الحساب تحته": "Parent account (this account goes under it", "سيتغير نوع": "The type of", "حساب فرعي ليطابق النوع الجديد. متابعة؟": "sub-accounts will change to match the new type. Continue?",
  "مدفوع الآن (تحصيل": "Paid now (collection", "مدفوع الآن (سداد": "Paid now (payment", "مرتجع بيع": "Sales return", "مرتجع شراء": "Purchase return",
  "رصيد أول المدة + المشتريات + المبيعات + المرتجعات + الجرد": "Opening balance + purchases + sales + returns + stocktake", "رصيد آخر المدة، لكل صنف": "closing balance, per product",
  "مبيعات الفترة (كمية": "Sales in period (qty", "قيمة رصيد آخر المدة (بالتكلفة": "Closing stock value (at cost", "لا يوجد اتصال — رصيد": "Offline — Raseed", "لا يوجد اتصال بالإنترنت": "No internet connection",
  "رصيد يحتاج اتصالًا لعرض بياناتك وحفظها بأمان. تأكد من الشبكة ثم أعد المحاولة.": "Raseed needs a connection to show and safely save your data. Check your network and try again.",
  "خزينة غير موجودة": "Cash register not found", "المتصفح لا يدعم قراءة xlsx — استخدم ملف CSV أو متصفحًا أحدث": "This browser cannot read xlsx — use a CSV file or a newer browser",
  "الملف ليس xlsx صالحًا": "The file is not a valid xlsx", "لا توجد ورقة بيانات في الملف": "No data sheet in the file", "عرض · تعديل · حذف مع عكس الأثر · طباعة · تصدير": "View · edit · delete with reversal · print · export",
  "تعذّر تحميل مكتبة Supabase.": "Could not load the Supabase library.", "السجل غير موجود": "Record not found",
  /* ---- الأسماء الافتراضية للحسابات والبيانات التجريبية (تظهر بالإنجليزية عند عرضها) ---- */
  "مؤسسة الفجر": "Al-Fajr Est.", "عميل جملة": "Wholesale customer", "محل الأمانة": "Al-Amana Store", "شركة البناء الحديث": "Modern Construction Co.", "مصنع الشرق": "Al-Sharq Factory",
  "مورد أساسي": "Main supplier", "شركة الإمداد": "Supply Co.", "المخزن الرئيسي": "Main warehouse", "المعادي": "Maadi", "مخزن فرع الجيزة": "Giza branch warehouse", "الجيزة": "Giza",
  "أسمنت بورتلاند 50كج": "Portland cement 50 kg", "حديد تسليح 12مم": "Reinforcing steel 12 mm", "دهان بلاستيك 20 لتر": "Plastic paint 20 L", "سيراميك أرضيات 60×60": "Floor ceramic 60×60",
  "الصندوق": "Cash on hand", "العملاء (مدينون": "Customers (receivables", "الموردين (دائنون": "Suppliers (payables", "ضريبة القيمة المضافة مستحقة": "VAT payable", "رأس المال": "Capital",
  "مردودات المبيعات": "Sales returns", "تكلفة البضاعة المباعة": "Cost of goods sold", "المصروفات العمومية": "General expenses", "ضريبة القيمة المضافة قابلة للخصم": "VAT recoverable",
  "مصروف الرواتب": "Salaries expense", "رواتب مستحقة": "Salaries payable", "فاتورة جملة": "Wholesale invoice", "شراء أسمنت": "Cement purchase", "المكتب": "Office", "خزينة المعرض": "Showroom register",
  "تحصيل فاتورة": "Invoice collection", "مصروف إيجار": "Rent expense", "أحمد حسن": "Ahmed Hassan", "سارة علي": "Sara Ali", "موظفة مبيعات": "Sales employee", "محمود كمال": "Mahmoud Kamal",
  "رواتب سبتمبر": "September salaries", "سداد جزئي": "Partial payment", "قيد مبيعات فاتورة 1001": "Sales entry, invoice 1001", "قيد مشتريات فاتورة 2001": "Purchases entry, invoice 2001",
  "إيجار المخزن": "Warehouse rent", "المدير": "Manager",
  "ابحث بالاسم أو الكود...": "Search by name or code...", "لا توجد نتائج": "No results", "ميزان مراجعة": "Trial balance",
  "": "Applied to new sales invoices. Egypt default: 14%.",
  "نسيت كلمة المرور؟": "Forgot your password?", "تواصل عبر واتساب": "Contact via WhatsApp",
  "إذا كنت موظفًا:": "If you are an employee:", "إذا كنت مالك الشركة:": "If you are the company owner:",
  "اطلب من مالك الشركة تغيير كلمة مرورك من «مستخدمو الشركة» ← «تغيير كلمة المرور»، ثم ادخل بالكلمة الجديدة.": "Ask the company owner to change your password from “Company users” → “Change password”, then sign in with the new one.",
  "تواصل مع إدارة النظام برقم هاتفك المسجّل ليتم تعيين كلمة مرور جديدة لك.": "Contact the system administration with your registered phone number to have a new password set.",
  "استيراد من Excel": "Import from Excel", "تصدير Excel": "Export Excel", "كود الحساب الرئيسي": "Parent account code", "دليل الحسابات": "Chart of accounts",
  "لم أجد عمودَي «الكود» و«اسم الحساب» — حمّل «قالب الاستيراد»": "Could not find the “Code” and “Account name” columns — download the “Import template”",
  "كل الأكواد موجودة مسبقًا — لا جديد للاستيراد": "All codes already exist — nothing new to import", "لا توجد حسابات صالحة للاستيراد": "No valid accounts to import",
  "تعذّر تحديد نوع الحسابات:": "Could not determine the type of accounts:", "أضف عمود «النوع»": "add a “Type” column", "تم استيراد": "Imported", "حساب": "accounts",
  "سيتم إضافة": "About to add", "رئيسي": "parent", "فرعي": "sub", "كود موجود مسبقًا": "codes that already exist", "كود مكرر في الملف": "duplicate codes in the file",
  "حسابات أبوها غير موجود (ستُضاف كرئيسية):": "Accounts whose parent was not found (will be added as top-level):", "قالب-استيراد-دليل-الحسابات.xlsx": "chart-of-accounts-template.xlsx",
  "نظام رصيد Rasied": "Rasied System", "نظام رصيد": "Rasied System"
});
