// Supabase Edge Function: بهبود جمله‌بندی متن‌های صورتجلسه با Claude
// استقرار و تنظیم کلید: به فایل supabase/functions/polish-text/README.md مراجعه کنید.
const KEY = Deno.env.get("ANTHROPIC_API_KEY") ?? "";
const MODEL = Deno.env.get("POLISH_MODEL") ?? "claude-sonnet-5-5";
const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};
const SYSTEM = `تو ویراستار صورتجلسه‌های رسمی کمیته حفاظت فنی و بهداشت کار در یک کارخانه صنعتی ایرانی هستی.
هر متن ورودی یک بند از صورتجلسه است. جمله‌بندی را رسمی، روان، کوتاه و مناسب صورتجلسه کن.
قواعد: فقط جمله‌بندی را بهتر کن. هیچ اطلاعات، عدد، نام، تاریخ، محل یا ادعای جدیدی اضافه نکن و چیزی را حذف نکن.
متن داخل «» (شرح عدم‌انطباق) را بدون تغییر نگه دار. زمان فعل گذشته (مثلاً «برطرف شد») یا مناسب بند را حفظ کن.
کد تجهیز و کد اعلان اضافه نکن. فقط یک آرایهٔ JSON از رشته‌ها به همان ترتیب و همان تعداد برگردان، بدون هیچ توضیح دیگر.`;
Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });
  const J = (o: unknown, s = 200) => new Response(JSON.stringify(o), { status: s, headers: { ...CORS, "Content-Type": "application/json" } });
  if (!KEY) return J({ error: "ANTHROPIC_API_KEY تنظیم نشده است" }, 500);
  let texts: string[];
  try { texts = (await req.json()).texts; } catch { return J({ error: "ورودی نامعتبر" }, 400); }
  if (!Array.isArray(texts) || !texts.length || texts.length > 30 || texts.some((t) => typeof t !== "string" || t.length > 900)) return J({ error: "ورودی نامعتبر یا بیش از حد" }, 400);
  const r = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: { "x-api-key": KEY, "anthropic-version": "2023-06-01", "content-type": "application/json" },
    body: JSON.stringify({ model: MODEL, max_tokens: 4000, system: SYSTEM, messages: [{ role: "user", content: JSON.stringify(texts) }] }),
  });
  if (!r.ok) return J({ error: "خطای سرویس هوش مصنوعی (" + r.status + ")" }, 502);
  const d = await r.json();
  const raw = (d.content?.[0]?.text ?? "").trim().replace(/^```(?:json)?|```$/g, "").trim();
  try {
    const out = JSON.parse(raw);
    if (!Array.isArray(out) || out.length !== texts.length) throw new Error("count");
    return J({ texts: out.map((x: unknown, i: number) => (typeof x === "string" && x.trim() ? x.trim() : texts[i])) });
  } catch { return J({ error: "پاسخ هوش مصنوعی قابل خواندن نبود" }, 502); }
});
