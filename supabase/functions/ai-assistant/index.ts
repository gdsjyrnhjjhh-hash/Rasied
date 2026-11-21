// دالة Edge: مساعد رصيد الذكي (Gemini + بحث Tavily اختياري). المفاتيح secrets على Supabase ومش في الكود:
//   GEMINI_API_KEY (مطلوب) · TAVILY_API_KEY (اختياري: بحث إنترنت مع مصادر) · GEMINI_MODEL · AI_DAILY_LIMIT
// الخصوصية: بيتبعت لـ Gemini ملخص أرقام الشركة فقط (ai_business_summary) — من غير أسماء عملاء/موردين/تليفونات.
// الصلاحية: لمالك الشركة بس (الموظف بيتم رفضه من قاعدة البيانات).
import { createClient } from "npm:@supabase/supabase-js@2";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};
const json = (b: unknown, s = 200) =>
  new Response(JSON.stringify(b), { status: s, headers: { ...cors, "Content-Type": "application/json" } });

const DAILY_LIMIT = Number(Deno.env.get("AI_DAILY_LIMIT") ?? "40"); // رسائل/يوم لكل شركة
const MODEL = Deno.env.get("GEMINI_MODEL") ?? "gemini-flash-latest";

type Turn = { role: "user" | "model"; parts: { text: string }[] };
type Src = { title: string; uri: string };

async function callGemini(system: string, contents: Turn[]): Promise<string> {
  const key = Deno.env.get("GEMINI_API_KEY");
  if (!key) throw { code: "not_configured" };
  try {
    const r = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:generateContent`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-goog-api-key": key },
      signal: AbortSignal.timeout(25000),
      body: JSON.stringify({
        systemInstruction: { parts: [{ text: system }] },
        contents,
        generationConfig: { temperature: 0.4, maxOutputTokens: 1200 },
      }),
    });
    if (r.status === 429) throw { code: "quota" };
    if (!r.ok) {
      let msg = "";
      try { msg = String((await r.json())?.error?.message ?? "").slice(0, 160); } catch (_) { /* ignore */ }
      console.error("Gemini error:", r.status, msg);
      throw { code: "provider", status: r.status, msg };
    }
    const d = await r.json();
    const t = d?.candidates?.[0]?.content?.parts?.map((p: { text?: string }) => p.text ?? "").join("") ?? "";
    if (!t) throw { code: "empty" };
    return t.trim();
  } catch (e) {
    const n = (e as Error)?.name;
    if (n === "TimeoutError" || n === "AbortError") { console.error("Gemini timeout"); throw { code: "timeout" }; }
    throw e;
  }
}

async function searchTavily(query: string): Promise<{ text: string; sources: Src[] }> {
  const key = Deno.env.get("TAVILY_API_KEY");
  if (!key) return { text: "", sources: [] };
  try {
    const r = await fetch("https://api.tavily.com/search", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${key}` },
      signal: AbortSignal.timeout(15000),
      body: JSON.stringify({
        query: query.slice(0, 300), search_depth: "basic", topic: "general", max_results: 5,
        include_answer: false, include_raw_content: false,
      }),
    });
    if (!r.ok) { console.error("Tavily error:", r.status, (await r.text()).slice(0, 300)); return { text: "", sources: [] }; }
    const data = await r.json();
    const sources: Src[] = [];
    let summary = "";
    for (const item of (data?.results ?? []).slice(0, 5)) {
      const title = String(item.title || "").slice(0, 80);
      const url = String(item.url || "");
      const content = String(item.content || "");
      if (url.startsWith("https://")) sources.push({ title: title || url, uri: url });
      if (content) summary += `• ${title}\n${content.slice(0, 350)}\n\n`;
    }
    return { text: summary.trim(), sources };
  } catch (e) {
    console.error("Tavily exception:", e);
    return { text: "", sources: [] };
  }
}

// أسئلة محتاجة معلومة من برّه البرنامج (مش أرقام الشركة) — عشان "كام" و"سعر" لوحدهم ممكن يبقوا سؤال عن أرقامها
const NEEDS_SEARCH = /دولار|يورو|ذهب|بورصة|أخبار|قانون|ضريبة|ضرائب|جمارك|فايدة|فوائد|تضخم|سعر السوق|أسعار السوق|سعر الجملة|طقس/i;

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  if (req.method !== "POST") return json({ error: "method_not_allowed" }, 405);
  try {
    const url = Deno.env.get("SUPABASE_URL"), anon = Deno.env.get("SUPABASE_ANON_KEY");
    if (!url || !anon) { console.error("Supabase configuration missing"); return json({ error: "not_configured" }, 503); }
    const sb = createClient(url, anon, { global: { headers: { Authorization: req.headers.get("Authorization") ?? "" } } });
    const b = await req.json();
    const clip = (s: unknown, n: number) => String(s ?? "").slice(0, n);
    const msg = clip(b.message, 600);
    if (!msg) return json({ error: "bad_request" }, 400);

    // الحد اليومي + التأكد إنه مالك الشركة (بصلاحية المستخدم — بيحدد الشركة تلقائيًا)
    const ok = await sb.rpc("ai_bump_usage", { p_limit: DAILY_LIMIT });
    if (ok.error) { console.error("Usage error:", ok.error); return json({ error: "auth" }, 401); }
    if (ok.data !== true) {
      const own = await sb.rpc("ai_is_owner");
      return own.data === true ? json({ error: "limit" }, 429) : json({ error: "forbidden" }, 403);
    }

    const today = /^\d{4}-\d{2}-\d{2}$/.test(b.today) ? b.today : new Date().toISOString().slice(0, 10);
    const d = new Date(today + "T00:00:00Z");
    const Y = d.getUTCFullYear(), M = d.getUTCMonth();
    const iso = (x: Date) => x.toISOString().slice(0, 10);
    const rng = (a: Date, e: Date) => sb.rpc("ai_business_summary", { p_from: iso(a), p_to: iso(e) });
    const [cur, prev, yr] = await Promise.all([
      rng(new Date(Date.UTC(Y, M, 1)), d),
      rng(new Date(Date.UTC(Y, M - 1, 1)), new Date(Date.UTC(Y, M, 0))),
      rng(new Date(Date.UTC(Y, 0, 1)), d),
    ]);
    if (cur.error || !cur.data) { console.error("Summary error:", cur.error); return json({ error: "summary" }, 500); }
    // الشهر الماضي والسنة: أرقام الحركة فقط (من غير أرصدة لحظية ولا قوائم) عشان الرسالة تفضل صغيرة
    const flow = (x: Record<string, unknown> | null) => x && ({
      from: x.from, to: x.to, sales_net: x.sales_net, sales_count: x.sales_count, sales_returns: x.sales_returns,
      purchases_total: x.purchases_total, receipts_from_customers: x.receipts_from_customers,
      payments_to_suppliers: x.payments_to_suppliers, expenses_total: x.expenses_total, payroll_posted: x.payroll_posted,
      gross_profit_est: x.gross_profit_est, top_expense_categories: x.top_expense_categories,
    });
    const ctx = { today, this_month: cur.data, last_month: flow(prev.data), this_year: flow(yr.data) };

    const hist: Turn[] = (Array.isArray(b.history) ? b.history : []).slice(-8)
      .filter((h: { role?: string; text?: string }) => (h?.role === "user" || h?.role === "model") && h?.text)
      .map((h: { role: "user" | "model"; text: string }) => ({ role: h.role, parts: [{ text: clip(h.text, 800) }] }));
    while (hist.length && hist[0].role !== "user") hist.shift();

    // بحث الإنترنت (لو TAVILY_API_KEY متضاف والسؤال عن حاجة من برّه الشركة)
    let sources: Src[] = [];
    let searchContext = "";
    if (NEEDS_SEARCH.test(msg)) {
      const s = await searchTavily(msg);
      if (s.text) { searchContext = `\n\nنتائج البحث من الإنترنت:\n${s.text}`; sources = s.sources; }
    }

    const system =
      "اتكلم بالعامية المصرية بأسلوب مهذب ومختصر. إنت 'مساعد رصيد' جوه برنامج محاسبة وإدارة شركة تجارية (مبيعات، مشتريات، مخازن، خزينة، عملاء وموردين). " +
      "بتجاوب على أرقام الشركة (من الملخص تحت)، ونصايح الإدارة والمحاسبة والتجارة، وأي معلومة عامة. " +
      "لما تتكلم عن أرقام الشركة استخدم الملخص بس ولا تخترع أرقام. gross_profit_est تقدير مجمل ربح (صافي المبيعات − المرتجعات − تكلفة البضاعة) مش ربح محاسبي نهائي، ولا يشمل المصروفات والمرتبات. " +
      "إنت مش بتشوف أسماء العملاء ولا الموردين ولا تليفوناتهم ولا أي بيانات مش في الملخص — لو اتسألت عنها قول كده ووجّه المستخدم للصفحة المناسبة (العملاء، الموردين، كشف الحساب، أعمار الديون). " +
      "لو فيه نتائج بحث من الإنترنت تحت، استخدمها وقول إن المعلومة من الإنترنت وإنها ممكن تتغيّر. لو مفيش نتائج بحث والسؤال محتاج معلومة حديثة، قول بصراحة إنك مش قادر تتأكد دلوقتي. " +
      "خلّي الرد قصير (غالباً مش أكتر من 8 سطور) وممكن تستخدم **غامق** وقوائم بنقط. المبالغ بعملة الشركة.\n" +
      "ملخص الشركة:\n" + JSON.stringify(ctx) + searchContext;

    const text = await callGemini(system, [...hist, { role: "user", parts: [{ text: msg }] }]);
    return json({ text, sources });
  } catch (e) {
    const c = (e as { code?: string })?.code;
    console.error("AI Assistant error:", e);
    if (c === "quota") return json({ error: "quota" }, 429);
    if (c === "not_configured") return json({ error: "not_configured" }, 503);
    if (c === "timeout") return json({ error: "timeout" }, 504);
    if (c === "empty") return json({ error: "empty" }, 502);
    return json({ error: "provider" }, 502);
  }
});
