// رصيد — إرسال إشعارات الهاتف (Web Push)
// تُستدعى من pg_cron يوميًا (ومن الصيانة يدويًا) بهيدر x-cron-secret؛ لا تتطلب JWT (verify_jwt=false) وتتحقق بنفسها.
// الجسم (اختياري): { "dry_run": true } يعرض ما سيُرسَل دون إرسال، { "only_user": "<uuid>" }، { "init_only": true } لتوليد المفاتيح فقط.
import { createClient } from "npm:@supabase/supabase-js@2";
import webpush from "npm:web-push@3.6.7";

const db = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!, { auth: { persistSession: false } });

const json = (o: unknown, status = 200) => new Response(JSON.stringify(o), { status, headers: { "Content-Type": "application/json" } });
const b64url = (u8: Uint8Array) => btoa(String.fromCharCode(...u8)).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
const SEV: Record<string, number> = { danger: 0, warn: 1, info: 2 };

type Cfg = { id: number; vapid_public: string | null; vapid_private: string | null; subject: string; cron_secret: string };

// مفاتيح VAPID تُولَّد مرة واحدة داخل الخادم وتُحفَظ في push_config (لا تظهر لأي عميل)
async function ensureVapid(cfg: Cfg): Promise<Cfg> {
  if (cfg.vapid_public && cfg.vapid_private) return cfg;
  const kp = await crypto.subtle.generateKey({ name: "ECDSA", namedCurve: "P-256" }, true, ["sign", "verify"]) as CryptoKeyPair;
  const pub = new Uint8Array(await crypto.subtle.exportKey("raw", kp.publicKey));
  const jwk = await crypto.subtle.exportKey("jwk", kp.privateKey);
  await db.from("push_config").update({ vapid_public: b64url(pub), vapid_private: jwk.d }).eq("id", 1).is("vapid_public", null);
  const { data } = await db.from("push_config").select("*").eq("id", 1).single();   // نقرأ المخزَّن (قد يكون سباقًا مع استدعاء آخر)
  return data as Cfg;
}

async function allSubs(only?: string) {
  const out: any[] = [];
  for (let from = 0; ; from += 1000) {
    let q = db.from("push_subscriptions").select("id,user_id,endpoint,p256dh,auth,fail_count").order("id").range(from, from + 999);
    if (only) q = q.eq("user_id", only);
    const { data, error } = await q;
    if (error) throw new Error(error.message);
    out.push(...(data || []));
    if (!data || data.length < 1000) break;
  }
  return out;
}

// يجمّع العناوين المتشابهة: "شيك وارد متأخر 24 يوم ×4 • قسط متأخر ..." (أهم 3 مجموعات)
function summarize(alerts: any[]): string {
  const g = new Map<string, number>();
  alerts.forEach((a) => g.set(a.atitle, (g.get(a.atitle) || 0) + 1));
  return [...g.entries()].slice(0, 3).map(([t, n]) => (n > 1 ? `${t} ×${n}` : t)).join(" • ");
}

Deno.serve(async (req) => {
  if (req.method !== "POST") return json({ error: "method not allowed" }, 405);
  const { data: cfg0 } = await db.from("push_config").select("*").eq("id", 1).single();
  const secret = req.headers.get("x-cron-secret");
  if (!cfg0 || !secret || secret !== (cfg0 as Cfg).cron_secret) return json({ error: "unauthorized" }, 401);

  const body = await req.json().catch(() => ({}));
  const cfg = await ensureVapid(cfg0 as Cfg);
  if (body.init_only) return json({ ok: true, public_key: cfg.vapid_public });
  webpush.setVapidDetails(cfg.subject, cfg.vapid_public!, cfg.vapid_private!);

  // اختبار ذاتي: يرسل رسالة عامة (بلا أي بيانات شركة) إلى اشتراك يُمرَّر في الطلب — لفحص التشفير/التوقيع فقط
  if (body.selftest) {
    const t = body.selftest;
    try {
      const r = await webpush.sendNotification({ endpoint: t.endpoint, keys: { p256dh: t.p256dh, auth: t.auth } },
        JSON.stringify({ title: "اختبار رصيد", body: "إشعار تجريبي", url: "index.html", tag: "selftest" }), { TTL: 60 });
      return json({ ok: true, status: r.statusCode });
    } catch (e: any) { return json({ ok: false, status: e?.statusCode, err: String(e?.body || e?.message || e).slice(0, 300) }); }
  }

  const subs = await allSubs(body.only_user);
  const byUser = new Map<string, any[]>();
  subs.forEach((s) => byUser.set(s.user_id, [...(byUser.get(s.user_id) || []), s]));

  const report: any = { users: byUser.size, subscriptions: subs.length, notified_users: 0, sent: 0, failed: 0, removed: 0, dry_run: !!body.dry_run, details: [] as any[] };
  const users = [...byUser.keys()];

  async function handleUser(uid: string) {
    const { data: alerts, error } = await db.rpc("push_user_alerts", { p_user: uid });
    if (error) { report.details.push({ user: uid, error: error.message }); return; }
    if (!alerts || !alerts.length) return;
    const sorted = [...alerts].sort((a: any, b: any) => SEV[a.asev] - SEV[b.asev]);
    const msgs = sorted.length <= 3
      ? sorted.map((a: any) => ({ title: a.atitle, body: a.abody, url: a.ahref, tag: a.akey }))
      : [{ title: `لديك ${sorted.length} تنبيهات في رصيد`, body: summarize(sorted), url: "index.html", tag: "rasied-summary" }];
    if (body.dry_run) { report.details.push({ user: uid, would_send: msgs, alerts: sorted.length }); return; }

    let delivered = false;
    for (const sub of byUser.get(uid)!) {
      for (const m of msgs) {
        try {
          await webpush.sendNotification({ endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } }, JSON.stringify(m), { TTL: 43200, urgency: "normal" });
          report.sent++; delivered = true;
        } catch (e: any) {
          report.failed++;
          const code = e?.statusCode;
          if (code === 404 || code === 410) {              // الاشتراك انتهى (ألغى المستخدم الإذن أو أُزيل التطبيق)
            await db.from("push_subscriptions").delete().eq("id", sub.id); report.removed++; break;
          }
          const fc = (sub.fail_count || 0) + 1;
          if (fc >= 5) { await db.from("push_subscriptions").delete().eq("id", sub.id); report.removed++; break; }
          await db.from("push_subscriptions").update({ fail_count: fc }).eq("id", sub.id);
          report.details.push({ user: uid, status: code, err: String(e?.body || e?.message || e).slice(0, 160) });
          break;
        }
      }
    }
    if (delivered) { await db.rpc("push_mark_sent", { p_user: uid, p_keys: sorted.map((a: any) => a.akey) }); report.notified_users++; }
  }

  for (let i = 0; i < users.length; i += 8) await Promise.all(users.slice(i, i + 8).map(handleUser));
  return json(report);
});
