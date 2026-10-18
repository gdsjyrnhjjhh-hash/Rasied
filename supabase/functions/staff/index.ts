import { createClient } from "npm:@supabase/supabase-js@2";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};
const json = (b: unknown, s = 200) => new Response(JSON.stringify(b), { status: s, headers: { ...cors, "Content-Type": "application/json" } });

function normPhone(v: string) {
  let d = String(v || "").replace(/[٠-٩]/g, (c) => String(c.charCodeAt(0) - 0x660)).replace(/\D/g, "");
  if (d.startsWith("00")) d = d.slice(2);
  return d;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: cors });
  if (req.method !== "POST") return json({ error: "method_not_allowed" }, 405);

  const admin = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  // هوية المتصل من الـJWT، ثم التحقق أنه مالك نشط لشركته
  const token = (req.headers.get("Authorization") || "").replace(/^Bearer\s+/i, "");
  const { data: u } = await admin.auth.getUser(token);
  if (!u?.user) return json({ error: "unauthorized" }, 401);
  const { data: me } = await admin.from("profiles").select("id,company_id,company_role,status").eq("id", u.user.id).maybeSingle();
  if (!me || me.company_role !== "owner" || me.status !== "active") return json({ error: "forbidden", message: "هذه العملية لمالك الشركة فقط" }, 403);

  let body: any;
  try { body = await req.json(); } catch { return json({ error: "bad_json" }, 400); }
  const action = String(body.action || "");

  // تأكيد أن الموظف المستهدف تابع لنفس الشركة
  async function targetStaff(id: string) {
    const { data } = await admin.from("profiles").select("id,company_id,company_role").eq("id", id).maybeSingle();
    return data && data.company_id === me!.company_id && data.company_role === "staff" ? data : null;
  }

  if (action === "create") {
    const phone = normPhone(body.phone);
    const password = String(body.password || "");
    const name = String(body.full_name || "").trim();
    const perms = Array.isArray(body.permissions) ? body.permissions.filter((x: unknown) => typeof x === "string").slice(0, 60) : [];
    if (phone.length < 8 || phone.length > 15) return json({ error: "invalid_phone", message: "رقم الهاتف غير صحيح" }, 400);
    if (password.length < 6) return json({ error: "weak_password", message: "كلمة المرور 6 أحرف على الأقل" }, 400);
    if (name.length < 2) return json({ error: "invalid_name", message: "اكتب اسم الموظف" }, 400);

    const { data: c, error: cErr } = await admin.auth.admin.createUser({
      email: `p${phone}@phone.tradingerp.app`, password, email_confirm: true, user_metadata: { phone, full_name: name },
    });
    if (cErr || !c?.user) {
      const dup = /already|registered|exists/i.test(cErr?.message || "");
      return json({ error: dup ? "phone_exists" : "create_failed", message: dup ? "هذا الرقم مسجّل بالفعل" : "تعذّر إنشاء الحساب" }, dup ? 409 : 400);
    }
    const { error: rErr } = await admin.rpc("create_staff", {
      p_uid: c.user.id, p_company: me.company_id, p_phone: phone, p_name: name, p_permissions: perms, p_by: me.id,
    });
    if (rErr) { await admin.auth.admin.deleteUser(c.user.id); return json({ error: "create_failed", message: "تعذّر إنشاء الحساب" }, 400); }
    return json({ ok: true });
  }

  if (action === "reset_password" || action === "delete") {
    const id = String(body.user_id || "");
    if (!(await targetStaff(id))) return json({ error: "not_found", message: "الموظف غير موجود" }, 404);
    if (action === "delete") {
      const { error } = await admin.auth.admin.deleteUser(id);
      return error ? json({ error: "failed" }, 400) : json({ ok: true });
    }
    const password = String(body.password || "");
    if (password.length < 6) return json({ error: "weak_password", message: "كلمة المرور 6 أحرف على الأقل" }, 400);
    const { error } = await admin.auth.admin.updateUserById(id, { password });
    return error ? json({ error: "failed" }, 400) : json({ ok: true });
  }

  return json({ error: "unknown_action" }, 400);
});
