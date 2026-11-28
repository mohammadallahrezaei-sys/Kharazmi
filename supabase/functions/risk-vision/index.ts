// Supabase Edge Function: OpenRouter Free Vision برای پیشنهاد اولیه ارزیابی ریسک ایمنی
import { withSupabase } from "jsr:@supabase/server@^1";

const KEY = Deno.env.get("OPENROUTER_API_KEY") ?? "";
const GEMINI_KEY = Deno.env.get("GEMINI_API_KEY") ?? "";
const GEMINI_MODELS = ["gemini-3.8-flash", "gemini-2.5-flash", "gemini-2.5-flash-lite"];
async function geminiJson(base: any, validate?: (out: any) => boolean): Promise<any> {
  const messages = Array.isArray(base.messages) ? base.messages : [];
  const systemText = messages.filter((m: any) => m.role === "system").map((m: any) => String(m.content || "")).join("\n\n");
  const userText = messages.filter((m: any) => m.role !== "system").map((m: any) => String(m.content || "")).join("\n\n");
  const errors: string[] = [];
  for (const model of GEMINI_MODELS) {
    try {
      const response = await fetch("https://generativelanguage.googleapis.com/v1beta/models/" + model + ":generateContent", {
        method: "POST", signal: AbortSignal.timeout(18000),
        headers: { "x-goog-api-key": GEMINI_KEY, "content-type": "application/json" },
        body: JSON.stringify({
          systemInstruction: { parts: [{ text: systemText }] },
          contents: [{ role: "user", parts: [{ text: userText }] }],
          generationConfig: { temperature: base.temperature ?? 0, maxOutputTokens: Math.min(Number(base.max_tokens || 3000), 6000), responseMimeType: "application/json" }
        })
      });
      if (!response.ok) {
        const detail = (await response.text().catch(() => "")).slice(0, 220);
        errors.push(model + ": HTTP " + response.status + " " + detail);
        continue;
      }
      const payload = await response.json();
      const raw = (payload?.candidates?.[0]?.content?.parts || []).map((p: any) => typeof p.text === "string" ? p.text : "").join("\n").trim();
      let out: any = null;
      try { out = JSON.parse(raw.replace(/^\s*```(?:json)?\s*/i, "").replace(/\s*```\s*$/, "")); } catch {
        const a = raw.indexOf("{"), b = raw.lastIndexOf("}");
        if (a >= 0 && b > a) { try { out = JSON.parse(raw.slice(a, b + 1)); } catch {} }
      }
      if (out && typeof out === "object" && !Array.isArray(out) && (!validate || validate(out))) return { out, model: "Google " + model };
      errors.push(model + ": پاسخ JSON نامعتبر یا ناقص");
    } catch (e) { errors.push(model + ": " + String(e).slice(0, 150)); }
  }
  return { status: 503, detail: errors.join(" | ").slice(0, 900), model: "Gemini Free" };
}
async function runAI(base: any, validate?: (out: any) => boolean): Promise<any> {
  if (GEMINI_KEY) {
    const result = await geminiJson(base, validate);
    if (result.out) return result;
    const fallback = await orJson(base, validate);
    if (fallback.out) return fallback;
    return { ...fallback, detail: "Gemini: " + String(result.detail || "ناموفق") + " || OpenRouter: " + String(fallback.detail || "ناموفق") };
  }
  return await orJson(base, validate);
}
/* فقط مدل‌های رایگانِ دارای ورودی تصویر؛ «openrouter/free» گاهی مدل کوچک متنی (مثل liquid/lfm-3-1.7b) انتخاب می‌کرد و پاسخ ناقص می‌داد.
   می‌توان با Secret به نام RISK_VISION_MODEL فهرست دلخواه (جداشده با ویرگول) گذاشت؛ اولین مورد اصلی است و بقیه به‌ترتیب جایگزین‌اند. */
const CONFIGURED_MODELS = (Deno.env.get("RISK_VISION_MODEL") ?? "").split(",").map((x) => x.trim()).filter(Boolean);
const FALLBACK_MODELS = [
  "nvidia/nemotron-3.5-super-vl:free",
  "google/gemma-4-31b-it:free",
  "google/gemma-4-26b-a4b-it:free",
  "nvidia/nemotron-3-nano-omni-30b-a3b-reasoning:free"
];
// تنظیم اختصاصی حفظ می‌شود، اما دیگر یک مدلِ تکی نمی‌تواند کل زنجیرهٔ جایگزین را غیرفعال کند.
const MODELS = [...new Set([...CONFIGURED_MODELS.slice(0, 2), "openrouter/free", ...FALLBACK_MODELS])].slice(0, 6);
const MODEL = MODELS[0];
/* فراخوانی با جایگزینی خودکار: اگر مدل خطا بدهد یا JSON ناقص/نامعتبر بدهد، مدل بعدی امتحان می‌شود */
async function orJson(base: any, validate?: (out: any) => boolean): Promise<any> {
  let last: any = {};
  const attempts: string[] = [];
  for (const mdl of MODELS) {
    let rr: Response | null = null;
    try {
      rr = await fetch("https://openrouter.ai/api/v1/chat/completions", { method: "POST", signal: AbortSignal.timeout(8500), headers: { "Authorization": "Bearer " + KEY, "content-type": "application/json", "HTTP-Referer": "https://mohammadallahrezaei-sys.github.io/Rezaei_HSE/", "X-OpenRouter-Title": "Kharazmi HSE" }, body: JSON.stringify({ ...base, model: mdl }) });
    } catch (e) {
      last = { status: 0, detail: String(e).slice(0, 160), model: mdl };
      attempts.push(mdl + ": timeout/network");
      continue;
    }
    if (!rr.ok) {
      const detail = (await rr.text().catch(() => "")).slice(0, 260);
      last = { status: rr.status, detail, model: mdl };
      attempts.push(mdl + ": HTTP " + rr.status + " " + detail.slice(0, 110));
      // برای خطای محدودیت ارائه‌دهنده، فوراً مدل بعدی را امتحان کن؛
      // درخواست‌های تکراری بی‌فایده سهمیه رایگان روزانه را مصرف می‌کنند.
      continue;
    }
    const rd = await rr.json().catch(() => null), choice = rd?.choices?.[0], msg = choice?.message?.content;
    const raw = typeof msg === "string" ? msg : Array.isArray(msg) ? msg.filter((x: any) => typeof x?.text === "string").map((x: any) => x.text).join("\n") : "";
    const clean = raw.trim().replace(/^\s*```(?:json)?\s*/i, "").replace(/\s*```\s*$/, "");
    let out: any = null;
    try { out = JSON.parse(clean); } catch {
      const a = clean.indexOf("{"), b = clean.lastIndexOf("}");
      if (a >= 0 && b > a) { try { out = JSON.parse(clean.slice(a, b + 1)); } catch { /* ناقص */ } }
    }
    if (out && typeof out === "object" && !Array.isArray(out) && (!validate || validate(out))) return { out, model: rd?.model || mdl };
    last = { status: 200, finish: choice?.finish_reason || choice?.native_finish_reason || "نامشخص", model: rd?.model || mdl };
    attempts.push(mdl + ": پاسخ نامعتبر یا JSON ناقص");
  }
  return { ...last, detail: attempts.join(" | ").slice(0, 900), model: last.model || MODELS[MODELS.length - 1] };
}
const SAFETY_SYSTEM = `تو دستیار کمکی کارشناس HSE در یک کارخانه صنعتی هستی. تصاویر را برای پیشنهاد اولیه ارزیابی ریسک ایمنی بررسی کن.
قواعد نگارشی الزامی: تمام متن‌های قابل نمایش به کاربر (از جمله method_reason، visible_hazards، hazard، consequence، causes، verify_on_site و limitations) باید روان، دقیق و فقط به زبان فارسی باشند. از ترکیب حروف فارسی و انگلیسی در یک واژه، نویسه‌های بی‌معنا، واژه‌های ناقص و ترجمه تحت‌اللفظی خودداری کن. فقط نام اختصاری استاندارد روش‌ها مانند FMEA و HAZOP می‌تواند انگلیسی باشد؛ اصطلاحات دیگر را معادل‌سازی فارسی کن. اگر نام یک شیء در تصویر قطعی نیست، آن را با توصیف ظاهری محتاطانه بیان کن یا بنویس «نوع شیء نیازمند بررسی است»؛ هرگز واژه نامفهوم نساز.
اولویت با اطلاعات و خطرات شناسایی‌شده توسط کارشناس است. خطرات کارشناسی را حذف، بازنویسی یا به نام خودت ثبت نکن؛ فقط خطرات احتمالی جاافتاده را به‌عنوان پیشنهاد مکمل معرفی کن و موارد تکراری را پیشنهاد نده. اطلاعات تجهیزات، مواد، افراد در معرض، شرایط محیطی، کنترل‌های موجود و سوابق را در تحلیل لحاظ کن. قواعد محتوایی: فقط شواهد قابل مشاهده را گزارش کن؛ مشاهده را از احتمال و فرضیه جدا کن؛ حدس را واقعیت جلوه نده؛ از عکس به تنهایی فعال‌بودن تجهیزات، وجود ولتاژ، شدت، احتمال، سطح ریسک، کفایت کنترل‌ها یا انطباق قانونی را تعیین نکن. برای موارد نامشخص از عبارت‌هایی مانند «احتمال ...؛ نیازمند آزمون/بازدید» استفاده کن؛ افراد را شناسایی نکن؛ اگر تصویر مبهم است confidence=low و بازدید میدانی را توصیه کن.
روش فقط fmea یا hazop باشد. FMEA پیش‌فرض اغلب خطرات شغلی/تجهیزاتی است. HAZOP فقط برای انحراف واقعی متغیرهای فرایندی مانند فشار، دما، جریان، سطح، ترکیب یا توالی عملیات پیشنهاد شود.
category باید دقیقاً یکی از دسته‌های مجاز باشد. برای هر خطر مستقل، یک شیء جدا در hazards بساز و پیامد و علت همان خطر را جداگانه بنویس؛ موارد متفاوت را در یک خطر ادغام نکن. حداکثر ۶ خطر مهم را به ترتیب اولویت بیاور. hazard، consequence و causes فقط پیشنهاد اولیه‌اند.
خروجی فقط JSON معتبر باشد، بدون Markdown. ساختار:
{"method":"fmea|hazop","method_reason":"...","category":"دسته دقیق","hazards":[{"method":"fmea|hazop","category":"دسته دقیق","hazard":"خطر مستقل","consequence":"پیامد همین خطر","causes":"علت همین خطر"}],"visible_hazards":["حداکثر ۶ مورد کوتاه"],"hazard":"خلاصه کوتاه","consequence":"خلاصه پیامدها","causes":"خلاصه علل","verify_on_site":["حداکثر ۶ مورد کوتاه"],"confidence":"high|medium|low","limitations":"...","hazop":{"parameter":"...","guide_word":"..."}}
اگر خطر قابل اتکایی مشخص نیست، hazard خالی و confidence=low باشد.`;
const ERGO_SYSTEM = `تو دستیار کمکی کارشناس ارگونومی و HSE در یک کارخانه صنعتی هستی. تصاویر را فقط برای غربالگری اولیه خطرات ارگونومیک بررسی کن.
قواعد نگارشی الزامی: تمام متن‌های قابل نمایش به کاربر باید روان، دقیق و فقط به زبان فارسی باشند. از ترکیب حروف فارسی و انگلیسی در یک واژه، نویسه‌های بی‌معنا، واژه‌های ناقص و ترجمه تحت‌اللفظی خودداری کن. فقط نام اختصاری استاندارد روش‌ها مانند REBA، RULA و ROSA می‌تواند انگلیسی باشد؛ سایر اصطلاحات را فارسی بنویس. اگر نام یا وضعیت یک شیء/حرکت قطعی نیست، آن را با توصیف محتاطانه بیان کن یا نیاز به بررسی را اعلام کن؛ هرگز واژه نامفهوم نساز.
اولویت با خطرات و اطلاعات ارگونومیک ثبت‌شده توسط کارشناس است. آن‌ها را حذف، بازنویسی یا به نام خودت ثبت نکن؛ فقط وضعیت‌های احتمالی جاافتاده را به‌عنوان پیشنهاد مکمل و غیرقطعی مطرح کن و موارد تکراری را پیشنهاد نده. اطلاعات تجهیزات، ابزار، وظایف، افراد در معرض، مدت و تناوب مواجهه و کنترل‌های موجود را لحاظ کن. قواعد محتوایی: فقط وضعیت‌های قابل مشاهده را گزارش کن؛ زاویه مفصل، مدت مواجهه، نیروی واردشده، تکرار، وزن بار یا امتیاز استاندارد را از تصویر نامطمئن حدس نزن؛ از عکس به تنهایی امتیاز نهایی REBA/RULA/ROSA یا سطح ریسک را محاسبه نکن؛ افراد را شناسایی نکن؛ اگر نما یا شواهد کافی نیست، confidence=low و بررسی میدانی/مشاهده وظیفه را توصیه کن.
روش را از میان reba، rula و rosa انتخاب کن: REBA برای وضعیت کل بدن و وظایف متنوع/حمل دستی بار؛ RULA برای اندام فوقانی، گردن و تنه در کارهای دقیق یا تکراری؛ ROSA فقط برای ایستگاه کار اداری و اجزای صندلی، میز، نمایشگر، تلفن و ورودی‌های رایانه. اگر تصویر ایستگاه اداری نیست ROSA پیشنهاد نده.
category باید دقیقاً یکی از دسته‌های مجاز باشد. برای هر وضعیت ارگونومیک مستقل، یک شیء جدا در hazards بساز و پیامد و علت همان وضعیت را جداگانه بنویس؛ موارد متفاوت را در یک خطر ادغام نکن. حداکثر ۶ وضعیت مهم را به ترتیب اولویت بیاور. hazard، consequence و causes فقط پیشنهاد اولیه‌اند. مواردی مانند نمای جانبی/روبرو، هر دو سمت بدن، مدت و تناوب کار، وزن بار و نیرو را در verify_on_site برای تکمیل مشاهده میدانی ذکر کن.
خروجی فقط JSON معتبر باشد، بدون Markdown. ساختار:
{"method":"reba|rula|rosa","method_reason":"...","category":"دسته دقیق","hazards":[{"method":"reba|rula|rosa","category":"دسته دقیق","hazard":"وضعیت ارگونومیک مستقل","consequence":"پیامد همین وضعیت","causes":"علت همین وضعیت"}],"visible_hazards":["حداکثر ۶ مورد کوتاه"],"hazard":"خلاصه کوتاه وضعیت‌ها","consequence":"خلاصه پیامدها","causes":"خلاصه علل","verify_on_site":["حداکثر ۶ مورد کوتاه"],"confidence":"high|medium|low","limitations":"...","hazop":null}
اگر وضعیت ارگونومیک قابل اتکایی مشخص نیست، hazard خالی و confidence=low باشد.`;


export default {
  fetch: withSupabase({ auth: "user" }, async (req, _ctx) => {
 const J=(o:unknown,s=200)=>new Response(JSON.stringify(o),{status:s,headers:{"Content-Type":"application/json"}});
 if(!KEY)return J({error:"OPENROUTER_API_KEY در Supabase تنظیم نشده است."},500);
 let body:any;try{body=await req.json()}catch{return J({error:"درخواست JSON معتبر نیست."},400)}

 
  if(body?.task==="module_analysis" || body?.task==="portfolio_synthesis"){
   const task=body.task;
   const key=String(body.module_key||"");
   const allowed=["incidents","risks","inspections","actions"];
   if(task==="module_analysis"&&!allowed.includes(key))return J({error:"ماژول تحلیل معتبر نیست."},400);
   const incoming=body.data&&typeof body.data==="object"?body.data:{};
   // فشرده‌سازی محافظه‌کارانه: نگه‌داشتن آخرین رکوردها و محدودکردن متن‌های طولانی؛
   // تعداد رکوردهای حذف‌شده و سقف انتخاب به مدل اعلام می‌شود تا نتیجه ناقص وانمود نشود.
   const originalTables=incoming.tables&&typeof incoming.tables==="object"?incoming.tables:{};
   const tables:any={}, coverage:any={...(incoming.coverage||{})};
   for(const [name,value] of Object.entries(originalTables)){
     const rows=Array.isArray(value)?value:[];
     const kept=rows.slice(-40).map((row:any)=>{
       const out:any={};
       if(row&&typeof row==="object") for(const [k,v] of Object.entries(row)){
         if(typeof v==="string") out[k]=v.slice(0,500);
         else if(typeof v==="number"||typeof v==="boolean"||v===null) out[k]=v;
         else if(Array.isArray(v)) out[k]=v.slice(0,8);
       }
       return out;
     });
     tables[name]=kept;
     coverage[name]={...(coverage[name]||{}),records_sent:kept.length,records_omitted_from_received:Math.max(0,rows.length-kept.length)};
   }
   const data={...incoming,tables,coverage,selection_note:String(incoming.selection_note||"")+" حداکثر ۴۰ رکورد آخر هر جدول و متن‌های حداکثر ۵۰۰ نویسه‌ای برای تحلیل ارسال شده‌اند؛ حذف احتمالی رکوردها در پوشش مشخص شده است."};
   let serialized=JSON.stringify(data);
   if(serialized.length>65000){
     for(const name of Object.keys(tables)) tables[name]=tables[name].slice(-20);
     for(const name of Object.keys(coverage)) if(coverage[name]&&typeof coverage[name]==="object") coverage[name]={...coverage[name],records_sent:tables[name]?.length??coverage[name].records_sent,additional_reduction:true};
     serialized=JSON.stringify(data);
   }
   if(serialized.length>65000)return J({error:"حجم داده پس از فشرده‌سازی نیز بیش از حد مجاز است؛ لطفاً تعداد سوابق هر جدول را کاهش دهید.",characters:serialized.length},413);
   if(task==="module_analysis"){
    const names={incidents:"حوادث و شبه‌حوادث",risks:"ریسک‌ها و ارزیابی خطر",inspections:"بازرسی‌ها و عدم‌انطباق‌ها",actions:"اقدامات اصلاحی و پیگیری"};
    const system="تو مدیر ارشد HSE کارخانه تولید کاتالیست و جاذب هستی. اکنون فقط یک حوزه تخصصی را تحلیل می‌کنی: "+names[key]+". داده‌ها از سامانه واقعی آمده‌اند. فقط یافته‌های مستند را بیان کن؛ هیچ حادثه، علت، خطر، آمار یا اقدام را اختراع نکن. موارد ناموجود یا جدول‌های دریافت‌نشده را صریحاً اعلام کن. داده‌های پزشکی و هویتی را افشا نکن. موارد بسته را باز محسوب نکن. خروجی فارسی و اجرایی باشد. نتیجه باید برای مرحله جمع‌بندی نهایی قابل استفاده باشد. فقط JSON معتبر با ساختار: {\"summary\":\"جمع‌بندی کوتاه\",\"findings\":[{\"title\":\"یافته\",\"priority\":\"بحرانی|بالا|متوسط|پایین\",\"evidence\":\"شواهد دقیق و نام جدول/تعداد\",\"implication\":\"اهمیت برای HSE\",\"recommendation\":\"اقدام پیشنهادی\",\"urgency\":\"فوری|تا ۲۴ ساعت|تا ۷ روز|برنامه‌ای\"}],\"recurring_patterns\":[\"...\"],\"data_gaps\":[\"...\"],\"limitations\":\"...\",\"confidence\":\"بالا|متوسط|پایین\"}. حداکثر ۶ یافته. اگر شواهد کافی نیست findings را خالی کن و علت را در data_gaps بنویس.";
    const R=await runAI({max_tokens:2600,temperature:0,response_format:{type:"json_object"},messages:[{role:"system",content:system},{role:"user",content:"حوزه: "+names[key]+"\\nداده‌ها و پوشش: "+serialized}]},(x:any)=>Array.isArray(x.findings)&&typeof x.summary==="string");
    if(!R.out)return J({error:"تحلیل این ماژول انجام نشد؛ "+String(R.detail||"مدل رایگان در دسترس نیست.")+"؛ مدل: "+String(R.model||MODEL)},502);
    return J({module_key:key,result:R.out,model:R.model,coverage:data.coverage||{}});
   }
   const results=Array.isArray(data.results)?data.results.filter((x:any)=>allowed.includes(x?.module_key)&&x?.status==="completed"&&x?.result).slice(0,4):[];
   if(!results.length)return J({error:"هیچ تحلیل موفق و معتبری برای جمع‌بندی وجود ندارد."},400);
   const system="تو مدیر ارشد HSE یک کارخانه تولید کاتالیست و جاذب هستی. نتایج تحلیل‌های مستقل حوادث، ریسک‌ها، بازرسی‌ها و اقدامات اصلاحی را با هم ترکیب کن. فقط از شواهد همین نتایج استفاده کن؛ یافته‌های تکراری را ادغام کن اما منشأ هر شاهد را حفظ کن. تضادها و خلأ داده را اعلام کن. اولویت‌بندی بر اساس شدت پیامد، تکرار، مواجهه، بازبودن اقدام و ضعف کنترل باشد؛ امتیاز خام به‌تنهایی کافی نیست. اطلاعات هویتی/پزشکی را بازگو نکن. مسئول یا موعد ثبت‌نشده را واقعیت جلوه نده. خروجی فقط JSON معتبر فارسی: {\"executive_summary\":\"...\",\"top_actions\":[{\"rank\":1,\"title\":\"...\",\"priority\":\"بحرانی|بالا|متوسط\",\"urgency\":\"فوری|تا ۲۴ ساعت|تا ۷ روز|برنامه‌ای\",\"evidence\":[\"منبع و شاهد\"],\"owner_suggestion\":\"مسئول پیشنهادی یا نامشخص\",\"due_suggestion\":\"مهلت پیشنهادی\"}],\"cross_module_patterns\":[\"...\"],\"conflicts\":[\"...\"],\"data_gaps\":[\"...\"],\"limitations\":\"...\",\"confidence\":\"بالا|متوسط|پایین\"}. حداکثر ۵ اقدام؛ اگر شواهد کافی نیست، اقدام نساز.";
   const R=await runAI({max_tokens:3000,temperature:0,response_format:{type:"json_object"},messages:[{role:"system",content:system},{role:"user",content:JSON.stringify(results)}]},(x:any)=>Array.isArray(x.top_actions)&&typeof x.executive_summary==="string");
   if(!R.out)return J({error:"جمع‌بندی نهایی انجام نشد؛ "+String(R.detail||"مدل رایگان در دسترس نیست.")},502);
   return J({result:R.out,model:R.model,modules_included:results.map((x:any)=>x.module_key)});
  }

  if(body?.task==="portfolio_priorities"){
   const data=body.data&&typeof body.data==="object"?body.data:{};
   const datasets=data.tables&&typeof data.tables==="object"?data.tables:{};
   const tableNames=Array.isArray(data.table_names)?data.table_names.filter((x:any)=>typeof x==="string").slice(0,24):[];
   const unavailable=Array.isArray(data.unavailable)?data.unavailable.filter((x:any)=>typeof x==="string").slice(0,24):[];
   const totals:any={};let rows=0;
   for(const name of tableNames){const list=Array.isArray(datasets[name])?datasets[name]:[];totals[name]=list.length;rows+=list.length;}
   if(!rows)return J({error:"هیچ سابقه عملیاتی قابل استفاده‌ای از جدول‌های سامانه دریافت نشد.",unavailable},400);
   const serialized=JSON.stringify({tables:datasets,unavailable,totals});
   if(serialized.length>180000)return J({error:"حجم اطلاعات دریافتی برای یک نوبت تحلیل بیش از حد مجاز است؛ تحلیل ناقص انجام نشد.",characters:serialized.length,rows},413);
   const system="تو مدیر ارشد HSE یک کارخانه صنعتی تولیدکننده کاتالیست و جاذب هستی. همه داده‌های ارسالی را بررسی و دقیقاً ۵ اقدام با بالاترین فوریت را رتبه‌بندی کن. فقط شواهد ثبت‌شده را مبنا قرار بده؛ هیچ خطر، حادثه، نقص یا سابقه‌ای اختراع نکن. اولویت را فقط با عدد امتیاز ریسک تعیین نکن؛ شدت پیامد، احتمال و تکرار، مواجهه، ضعف کنترل‌ها، حوادث و شبه‌حوادث، عدم‌انطباق‌های باز و معوق، مهلت‌های گذشته، تجهیزات و مواد پرخطر و تکرار یافته‌ها را یکجا بسنج. موارد بسته و اثربخشی‌سنجی‌شده را اقدام باز محسوب نکن. جدول‌های ناموجود را بررسی‌شده قلمداد نکن و منبع خالی را معادل نبود خطر ندان. اطلاعات هویتی و پزشکی اشخاص را بازگو نکن. اقدام‌ها مشخص، اجرایی و قابل راستی‌آزمایی باشند؛ مسئول و موعد ثبت‌نشده را به‌عنوان واقعیت اعلام نکن و مسئول/موعد پیشنهادی را مشخص کن. اگر برای پنج خطر قطعی شواهد کافی نیست، ردیف‌های باقی‌مانده را به‌صورت راستی‌آزمایی میدانی اولویت‌دار بنویس نه خطر قطعی. خروجی فقط JSON فارسی بدون Markdown باشد و ساختار زیر را رعایت کند: {\"executive_summary\":\"حداکثر سه جمله\",\"actions\":[{\"rank\":1,\"title\":\"اقدام مشخص\",\"priority\":\"بحرانی یا خیلی بالا\",\"urgency\":\"فوری یا تا ۲۴ ساعت یا تا ۷۲ ساعت یا تا ۷ روز\",\"why_now\":\"علت فوریت\",\"evidence\":[{\"table\":\"جدول\",\"record_id\":\"شناسه\",\"detail\":\"شاهد ثبت‌شده\"}],\"risk_if_delayed\":\"پیامد تأخیر\",\"action_steps\":[\"گام اول\",\"گام دوم\"],\"responsible\":\"مسئول ثبت‌شده یا پیشنهادی\",\"verification\":\"مدرک اثربخشی\",\"confidence\":\"زیاد یا متوسط یا کم\"}],\"data_coverage\":{\"limitations\":\"محدودیت داده\"},\"management_note\":\"نکته مدیریتی مهم\"}";
   const userText="داده‌های عملیاتی HSE کارخانه را کامل بررسی کن و پنج اقدام بسیار مهم و فوری را رتبه‌بندی کن. تعداد رکوردهای هر جدول: "+JSON.stringify(totals)+"؛ جدول‌های در دسترس: "+JSON.stringify(tableNames)+"؛ جدول‌های غیرقابل دریافت: "+JSON.stringify(unavailable)+"؛ تعداد کل رکوردها: "+rows+". داده‌ها:\n"+serialized;
   const R=await runAI({max_tokens:5200,temperature:0,response_format:{type:"json_object"},messages:[{role:"system",content:system},{role:"user",content:userText}]},(candidate:any)=>Array.isArray(candidate.actions));
   if(!R.out){
    if(R.status&&R.status!==200)return J({error:"خطای سرویس تحلیل مدیریتی ("+R.status+"): "+String(R.detail||"").slice(0,260)+"؛ مدل: "+String(R.model||MODEL)},502);
    return J({error:(R.finish==="length"?"پاسخ مدل به دلیل محدودیت طول ناقص مانده است.":"هیچ‌یک از مدل‌های در دسترس پاسخ مدیریتی معتبر برنگرداندند.")+" مدل‌های امتحان‌شده: "+MODELS.join("، ")},502);
   }
   const out=R.out;
   const actions=out.actions.slice(0,5).map((x:any,i:number)=>({rank:i+1,title:String(x?.title||"اقدام نیازمند بررسی").slice(0,220),priority:["بحرانی","خیلی بالا"].includes(x?.priority)?x.priority:"خیلی بالا",urgency:["فوری","تا ۲۴ ساعت","تا ۷۲ ساعت","تا ۷ روز"].includes(x?.urgency)?x.urgency:"تا ۷۲ ساعت",why_now:String(x?.why_now||"").slice(0,700),evidence:Array.isArray(x?.evidence)?x.evidence.slice(0,5).map((e:any)=>({table:String(e?.table||"").slice(0,80),record_id:String(e?.record_id||"").slice(0,80),detail:String(e?.detail||"").slice(0,500)})):[],risk_if_delayed:String(x?.risk_if_delayed||"").slice(0,500),action_steps:Array.isArray(x?.action_steps)?x.action_steps.slice(0,5).map((v:any)=>String(v).slice(0,350)):[],responsible:String(x?.responsible||"مدیر واحد مربوطه با نظارت HSE (پیشنهادی)").slice(0,180),verification:String(x?.verification||"").slice(0,500),confidence:["زیاد","متوسط","کم"].includes(x?.confidence)?x.confidence:"کم"}));
   while(actions.length<5)actions.push({rank:actions.length+1,title:"راستی‌آزمایی میدانی اولویت‌دار",priority:"خیلی بالا",urgency:"تا ۷ روز",why_now:"داده کافی برای معرفی خطر قطعی دیگر وجود ندارد؛ برای جلوگیری از نتیجه‌گیری ناقص باید بررسی شود.",evidence:[],risk_if_delayed:"باقی‌ماندن نقاط کور اطلاعاتی و احتمال دیده‌نشدن خطر مهم.",action_steps:["بازدید مشترک مدیر واحد و HSE","ثبت نتیجه بازدید و تکمیل اطلاعات سامانه"],responsible:"مدیر واحد مربوطه با نظارت HSE (پیشنهادی)",verification:"گزارش بازدید و ثبت یافته‌ها",confidence:"کم"});
   return J({executive_summary:String(out.executive_summary||"").slice(0,1000),actions,data_coverage:{tables_read:tableNames,tables_unavailable:unavailable,records_reviewed:rows,limitations:String(out.data_coverage?.limitations||"").slice(0,900),totals},management_note:String(out.management_note||"").slice(0,700),model:R.model||MODEL,generated_at:new Date().toISOString()});
  }

  if(body?.task==="safety_review_all"){
   const raw=Array.isArray(body.assessments)?body.assessments:[];
   if(raw.length<2)return J({error:"برای بازبینی کلی حداقل دو ردیف لازم است."},400);
   if(raw.length>12)return J({error:"حداکثر ۱۲ ردیف در هر بازبینی کلی مجاز است."},413);
   const rows:any[]=[];
   for(let i=0;i<raw.length;i++){
    const a:any=raw[i]||{},method=String(a.method||"").toLowerCase();
    if(method!=="fmea"&&method!=="hazop")return J({error:"روش ردیف "+(i+1)+" معتبر نیست."},400);
    const miss=["unit","activity","category","hazard","consequence","causes","existing_controls"].filter(k=>!String(a[k]||"").trim());
    if(miss.length)return J({error:"ردیف "+(i+1)+" ناقص است: "+miss.join("، ")},400);
    const severity=Number(a.severity),likelihood=Number(a.likelihood),mx=method==="fmea"?10:5;
    if(!(severity>=1&&severity<=mx&&likelihood>=1&&likelihood<=mx))return J({error:"شدت و احتمال ردیف "+(i+1)+" باید بین ۱ تا "+mx+" باشد."},400);
    rows.push({index:i+1,method,unit:String(a.unit).slice(0,120),activity:String(a.activity).slice(0,300),category:String(a.category).slice(0,160),hazard:String(a.hazard).slice(0,500),consequence:String(a.consequence).slice(0,600),causes:String(a.causes).slice(0,600),existing_controls:String(a.existing_controls).slice(0,700),severity,likelihood,score:Number.isFinite(Number(a.score))?Number(a.score):severity*likelihood,legal_ref:String(a.legal_ref||"").slice(0,300),legal_gap:a.legal_gap===true,planned_controls:String(a.planned_controls||"").slice(0,600)});
   }
   const ALL_SYSTEM="تو منتقد فنی ارزیابی ریسک HSE هستی و به یک کارشناس باتجربه کمک می‌کنی که مهارتش را بالا ببرد؛ نویسندهٔ ارزیابی نیستی.\n- ردیف‌ها را کارشناس نوشته است. هیچ داده، شدت، احتمال یا امتیازی را تغییر نده و امتیاز جایگزین پیشنهاد نکن.\n- هر ردیف را جداگانه و با اشاره به متن همان ردیف نقد کن: ناسازگاری خطر/پیامد/علت/کنترل موجود/شدت و احتمال، کنترل‌های موجودِ کلی یا غیرواقعی، پیامد ناکافی، علت سطحی.\n- بین ردیف‌ها بررسی کن: خطرهای مشابه با شدت یا احتمال خیلی متفاوت، ردیف‌های تکراری یا هم‌پوشان، خطر مهم جاافتاده برای همین فعالیت، کنترل‌های ناسازگار. شمارهٔ ردیف‌های درگیر را در rows بنویس.\n- اگر مورد جدی نیست، فهرست خالی بده؛ برای پر کردن فهرست چیزی نساز. حداکثر ۴ مورد برای هر فهرست و ۳ سؤال راهنما.\n- guiding_questions: سؤال‌هایی که کارشناس را به فکر دربارهٔ ضعف همان ردیف وادار کند (پاسخ آماده نده).\n- شدت و احتمال FMEA شرکت ۱ تا ۱۰ و HAZOP ۱ تا ۵ است.\n- همه متن‌ها فارسی روان و کوتاه باشند. خروجی فقط JSON معتبر با ساختار:\n{\"rows\":[{\"index\":1,\"issues\":[\"...\"],\"missing_information\":[\"...\"],\"additional_hazards\":[\"...\"],\"guiding_questions\":[\"...\"],\"control_recommendations\":[{\"action\":\"...\",\"priority\":\"فوری|بالا|متوسط|پایین\",\"reason\":\"...\"}]}],\"cross_row\":[{\"rows\":[1,2],\"note\":\"...\"}],\"overall_comment\":\"...\",\"confidence\":\"high|medium|low\"}.";
   const R=await runAI({max_tokens:7000,temperature:0,response_format:{type:"json_object"},messages:[{role:"system",content:ALL_SYSTEM},{role:"user",content:"ردیف‌های ارزیابی کارشناسی این مجموعه را نقد کن: "+JSON.stringify(rows)}]});
   if(!R.out){
    if(R.status&&R.status!==200)return J({error:"خطای سرویس بازبینی کلی ("+R.status+"): "+String(R.detail||"").slice(0,260)},502);
    return J({error:(R.finish==="length"?"پاسخ مدل به دلیل محدودیت طول ناقص مانده است.":"مدل پاسخ قابل‌خواندن برنگردانده است.")+" (مدل: "+String(R.model||MODEL)+"). چند لحظه بعد دوباره تلاش کنید."},502);
   }
   const out=R.out,arr=(v:unknown,max=4)=>Array.isArray(v)?v.filter(x=>typeof x==="string"&&x.trim()).slice(0,max).map(x=>x.slice(0,500)):[];
   const outRows=(Array.isArray(out.rows)?out.rows:[]).filter((r:any)=>r&&Number.isInteger(Number(r.index))&&Number(r.index)>=1&&Number(r.index)<=rows.length).map((r:any)=>({index:Number(r.index),issues:arr(r.issues),missing_information:arr(r.missing_information),additional_hazards:arr(r.additional_hazards),guiding_questions:arr(r.guiding_questions,3),control_recommendations:(Array.isArray(r.control_recommendations)?r.control_recommendations:[]).slice(0,4).filter((x:any)=>x&&typeof x.action==="string"&&x.action.trim()).map((x:any)=>({action:String(x.action).slice(0,500),priority:["فوری","بالا","متوسط","پایین"].includes(x.priority)?x.priority:"متوسط",reason:String(x.reason||"").slice(0,300)}))}));
   const cross=(Array.isArray(out.cross_row)?out.cross_row:[]).slice(0,6).filter((c:any)=>c&&typeof c.note==="string"&&c.note.trim()).map((c:any)=>({rows:(Array.isArray(c.rows)?c.rows:[]).map(Number).filter((n:number)=>Number.isInteger(n)&&n>=1&&n<=rows.length).slice(0,6),note:String(c.note).slice(0,600)}));
   return J({rows:outRows,cross_row:cross,overall_comment:String(out.overall_comment||"").slice(0,900),confidence:["high","medium","low"].includes(out.confidence)?out.confidence:"low",model:R.model||MODEL});
  }

  if(body?.task==="safety_review"){
   const a=body.assessment&&typeof body.assessment==="object"?body.assessment:{};
   const method=String(a.method||"").toLowerCase();
   if(!["fmea","hazop"].includes(method))return J({error:"روش ارزیابی ایمنی معتبر نیست."},400);
   const required=["unit","activity","category","hazard","consequence","causes","existing_controls"];
   const missing=required.filter(k=>!String(a[k]||"").trim());
   const severity=Number(a.severity),likelihood=Number(a.likelihood);
   if(missing.length)return J({error:"برای بازبینی، این موارد را تکمیل کنید: "+missing.join("، ")},400);
   const mx=method==="fmea"?10:5; /* FMEA شرکت: شدت و احتمال ۱ تا ۱۰؛ HAZOP: ۱ تا ۵ */
   if(!Number.isFinite(severity)||severity<1||severity>mx||!Number.isFinite(likelihood)||likelihood<1||likelihood>mx)return J({error:"شدت و احتمال باید عددی بین ۱ تا "+mx+" باشد (روش "+method.toUpperCase()+")؛ مقدار ارسال‌شده: شدت "+severity+"، احتمال "+likelihood+"."},400);
   const payload={method,unit:String(a.unit).slice(0,120),activity:String(a.activity).slice(0,300),category:String(a.category).slice(0,160),hazard:String(a.hazard).slice(0,700),consequence:String(a.consequence).slice(0,900),causes:String(a.causes).slice(0,900),existing_controls:String(a.existing_controls).slice(0,1200),severity,likelihood,score:Number.isFinite(Number(a.score))?Number(a.score):null,legal_ref:String(a.legal_ref||"").slice(0,500),legal_gap:a.legal_gap===true,planned_controls:String(a.planned_controls||"").slice(0,1200),action_type:String(a.action_type||"").slice(0,160),owner:String(a.owner||"").slice(0,160),residual_severity:Number(a.residual_severity)||null,residual_likelihood:Number(a.residual_likelihood)||null};
   const images=Array.isArray(body.images)?body.images.slice(0,4):[];
   if(Array.isArray(body.images)&&body.images.length>4)return J({error:"حداکثر ۴ تصویر برای بازبینی قابل ارسال است."},413);
   let imageBytes=0;
   for(const im of images){
    if(!im||im.media_type!=="image/jpeg"||typeof im.data!=="string"||!im.data)return J({error:"قالب تصویر بازبینی معتبر نیست؛ تصویر باید JPEG فشرده‌شده باشد."},400);
    if(im.data.length>2_100_000)return J({error:"حجم یکی از تصاویر بازبینی بیش از حد مجاز است."},413);
    imageBytes+=im.data.length;
   }
   if(imageBytes>6_000_000)return J({error:"حجم مجموع تصاویر بازبینی بیش از حد مجاز است."},413);
   const REVIEW_SYSTEM="تو بازبین فنی ارزیابی ریسک HSE و دستیار کارشناس باتجربه هستی. فقط ردیف ارزیابی کارشناسی ارسال‌شده را بازبینی کن.\n- اطلاعات کارشناس، خطر، پیامد، علت، شدت، احتمال و امتیاز را تغییر نده و امتیاز جایگزین پیشنهاد نکن.\n- نقش تو کمک به کارشناس است، نه جایگزینی او. خطرات کارشناسی را حذف یا بازنویسی نکن.\n- سازگاری رابطه خطر، پیامد، علت، کنترل‌های موجود و امتیاز شدت/احتمال را بررسی کن؛ موارد ناقص، مبهم، متناقض یا کنترل‌های ناکافی را مستدل بیان کن.\n- فقط در صورت وجود دلیل، خطر جاافتاده را به‌عنوان پیشنهاد تکمیلی برای بررسی کارشناس مطرح کن؛ خودکار به ارزیابی اضافه نکن.\n- برای FMEA بر رابطه خطر/حالت خرابی، پیامد، علت و کنترل تمرکز کن. برای HAZOP فقط انحراف فرایندی و متغیر مرتبط را بررسی کن.\n- استانداردها را خودسرانه الزام قانونی معرفی نکن و ماده قانونی یا بند استاندارد نساز.\n- پیشنهادهای کنترلی را بر اساس سلسله‌مراتب کنترل خطر اولویت‌بندی کن و اقدام مشخص و اجرایی پیشنهاد بده.\n- اگر شدت یا احتمال قابل دفاع نیست، فقط دلیل نیاز به بازنگری کارشناسی را توضیح بده؛ عدد جدید نده.\n- اگر عکس پیوست شده، فقط شواهد قابل مشاهده در عکس را با اطلاعات ثبت‌شده تطبیق بده؛ از عکس به‌تنهایی شدت، احتمال یا امتیاز جدید تعیین نکن و درباره موارد پنهان حدس نزن. اگر عکس برای قضاوت کافی نیست، محدودیت را بیان کن. عکس اختیاری است و نبود آن مانع بازبینی نیست.\n- هدف آموزشی: حداکثر ۳ «سؤال راهنما» (guiding_questions) بنویس که کارشناس را به فکر کردن دربارهٔ ضعف‌های این ردیف وادار کند (به‌جای دادن پاسخ آماده). هر ایراد را با اشاره به متن دقیق همین ردیف و دلیل فنی بنویس.\n- همه متن‌ها فارسی روان باشند. خروجی فقط JSON معتبر با ساختار:\n{\"consistency_review\":\"...\",\"strengths\":[\"...\"],\"issues\":[\"...\"],\"missing_information\":[\"...\"],\"additional_hazards\":[\"...\"],\"guiding_questions\":[\"...\"],\"control_recommendations\":[{\"action\":\"...\",\"priority\":\"فوری|بالا|متوسط|پایین\",\"reason\":\"...\"}],\"score_review\":\"...\",\"overall_comment\":\"...\",\"confidence\":\"high|medium|low\"}.";
   const userText="این ردیف ارزیابی کارشناسی را بازبینی کن. فقط نظر کارشناسی و پیشنهاد مکمل بده و هیچ داده‌ای را تغییر نده. اطلاعات ردیف: "+JSON.stringify(payload)+"\\nتعداد تصاویر پیوست‌شده: "+images.length;
   const userContent:any[]=[{type:"text",text:userText}];
   images.forEach((im:any,i:number)=>{userContent.push({type:"text",text:"تصویر مستند شماره "+(i+1)+" مربوط به همین ردیف ارزیابی:"});userContent.push({type:"image_url",image_url:{url:"data:"+im.media_type+";base64,"+im.data}})});
   const R=await runAI({max_tokens:4500,temperature:0,response_format:{type:"json_object"},messages:[{role:"system",content:REVIEW_SYSTEM},{role:"user",content:userContent}]});
   if(!R.out){
    if(R.status&&R.status!==200)return J({error:"خطای سرویس بازبینی ارزیابی ریسک ("+R.status+"): "+String(R.detail||"").slice(0,260)},502);
    const detail=R.finish==="length"?"پاسخ مدل به دلیل محدودیت طول ناقص مانده است.":"مدل پاسخ ساختاریافته و قابل‌خواندن برنگردانده است.";
    console.error("Safety review JSON parse failed",JSON.stringify(R));
    return J({error:detail+" (آخرین مدل: "+String(R.model||MODEL)+"، وضعیت پایان: "+String(R.finish||"نامشخص")+"). چند لحظه بعد دوباره تلاش کنید."},502);
   }
   const out=R.out,rd={model:R.model};
   const arr=(v:unknown,max=8)=>Array.isArray(v)?v.filter(x=>typeof x==="string"&&x.trim()).slice(0,max).map(x=>x.slice(0,500)):[];
   const actions=Array.isArray(out.control_recommendations)?out.control_recommendations.slice(0,8).filter((x:any)=>x&&typeof x.action==="string"&&x.action.trim()).map((x:any)=>({action:String(x.action).slice(0,700),priority:["فوری","بالا","متوسط","پایین"].includes(x.priority)?x.priority:"متوسط",reason:String(x.reason||"").slice(0,350)})):[];
   return J({method,consistency_review:String(out.consistency_review||"").slice(0,900),strengths:arr(out.strengths),issues:arr(out.issues),missing_information:arr(out.missing_information),additional_hazards:arr(out.additional_hazards),guiding_questions:arr(out.guiding_questions,3),control_recommendations:actions,score_review:String(out.score_review||"").slice(0,700),overall_comment:String(out.overall_comment||"").slice(0,900),confidence:["high","medium","low"].includes(out.confidence)?out.confidence:"low",model:rd?.model||MODEL});
  }

  if(body?.task==="ergo_review"){
  const method=String(body.method||"").toLowerCase();
  if(!["reba","rula","rosa"].includes(method))return J({error:"روش ارزیابی ارگونومی معتبر نیست."},400);
  const assessment=body.assessment&&typeof body.assessment==="object"?body.assessment:{};
  const inputs=assessment.inputs&&typeof assessment.inputs==="object"?assessment.inputs:{};
  const result=assessment.result&&typeof assessment.result==="object"?assessment.result:{};
  const meta=body.meta&&typeof body.meta==="object"?body.meta:{};
  const score=Number(result.final);
  if(!Number.isFinite(score)||score<1||score>(method==="reba"?15:method==="rula"?7:10))return J({error:"امتیاز محاسبه‌شده برای بازبینی معتبر نیست."},400);
  const compact=(v:number)=>Number.isFinite(v)?v:null;
  const payload={
   method,score,level:String(result.level_label||result.level||""),
   breakdown:result.breakdown&&typeof result.breakdown==="object"?result.breakdown:{},
   inputs,meta:{
    unit:String(meta.unit||"").slice(0,120),job:String(meta.job||"").slice(0,160),
    station:String(meta.station||"").slice(0,180),shift:String(meta.shift||"").slice(0,80),
    exposure:String(meta.exposure||"").slice(0,300),description:String(meta.description||"").slice(0,1200)
   },
   score_integrity:body.score_integrity===true,
   existing_actions:String(body.existing_actions||"").slice(0,1800)
  };
  const REVIEW_SYSTEM=`تو بازبین ارگونومی و دستیار کارشناس HSE هستی. ارزیابی تخصصی تکمیل‌شده را بازبینی کن و پیشنهاد اقدام اصلاحی کاربردی بده.
قواعد قطعی:
- امتیاز و محاسبات روش را هرگز تغییر نده، دوباره‌سازی نکن و عدد جایگزین پیشنهاد نکن. امتیاز محاسبه‌شده توسط نرم‌افزار مرجع است.
- اگر score_integrity=false است، آن را یک ناسازگاری فنی مهم اعلام کن و پیشنهاد ثبت نهایی نده؛ اگر true است، صرفاً سازگاری ورودی‌ها و سطح اقدام را از نظر مفهومی بررسی کن.
- از داده‌های خام، نام کلیدها یا کدهای عددی که معنایشان روشن نیست، تفسیر قطعی نساز. اگر اطلاعات برای قضاوت کافی نیست، شفاف بگو چه مشاهده‌ای لازم است.
- پیشنهادها باید متناسب با روش باشند: REBA کل بدن/جابجایی دستی؛ RULA اندام فوقانی، گردن و تنه؛ ROSA ایستگاه اداری. ابتدا حذف/جایگزینی، سپس کنترل مهندسی و طراحی کار، بعد کنترل سازمانی؛ وسایل حفاظت فردی راه‌حل اصلی ارگونومی نیستند.
- اقدامات باید اجرایی و مشخص باشند؛ از توصیه‌های کلی مثل «آموزش داده شود» به‌تنهایی پرهیز کن. برای هر اقدام، اقدام، اولویت (فوری/بالا/متوسط/پایین) و دلیل کوتاه ارائه کن. از تعیین هزینه، مسئول یا مهلت ساختگی خودداری کن.
- نظرها را به تفکیک «نکته مثبت»، «نیازمند بررسی»، «ناسازگاری احتمالی» بنویس. اگر ایرادی نیست، صریحاً بگو نکته بحرانی مشاهده نشد.
- تمام متن فارسی روان باشد؛ فقط REBA/RULA/ROSA انگلیسی بمانند.
خروجی فقط JSON معتبر و بدون Markdown با ساختار:
{"score_review":"...","score_integrity_comment":"...","comments":["..."],"missing_information":["..."],"corrective_actions":[{"action":"...","priority":"فوری|بالا|متوسط|پایین","reason":"..."}],"overall_comment":"...","draft":{"hazard":"...","consequence":"...","causes":"...","existing_controls":"...","assessor_note":"..."},"confidence":"high|medium|low"}.
- draft: پیش‌نویس فیلدهای ثبت ریسک برای کارشناس (او بررسی و ویرایش می‌کند). hazard: یک جملهٔ مشخص از وضعیت پرخطر دیده‌شده؛ consequence: پیامد محتمل (اختلال اسکلتی‌عضلانی کدام ناحیه)؛ causes: علل مشاهده‌شده یا محتمل (وضعیت بدن، ارتفاع کار، تکرار، بار)؛ existing_controls: فقط کنترل‌هایی که در عکس یا داده‌ها دیده می‌شود، وگرنه دقیقاً «کنترل مشخصی در عکس/برگه مشاهده نشد»؛ assessor_note: ۲ تا ۴ جمله توضیح ارزیابی‌کننده برای گزارش چاپی (روش، امتیاز، سطح اقدام، مهم‌ترین یافته) بدون ادعای چیزی که دیده نشده. هر مقدار کوتاه و فارسی.`;
  const images=Array.isArray(body.images)?body.images:[];
  if(images.length>4)return J({error:"حداکثر ۴ تصویر از برگه ارگونومی قابل ارسال است."},400);
  let imageBytes=0;
  for(const im of images){
   if(!im||im.media_type!=="image/jpeg"||typeof im.data!=="string"||!/^[A-Za-z0-9+/=]+$/.test(im.data))return J({error:"فرمت یکی از تصاویر برگه ارگونومی معتبر نیست."},400);
   if(im.data.length>2_100_000)return J({error:"حجم یکی از تصاویر برگه ارگونومی بیش از حد مجاز است."},413);
   imageBytes+=im.data.length;
  }
  if(imageBytes>7_000_000)return J({error:"حجم مجموع تصاویر برگه ارگونومی بیش از حد مجاز است."},413);
  const userText="این اطلاعات ارزیابی را بازبینی کن. اگر تصویر(هایی) پیوست شده‌اند، آن‌ها را مستقیماً با داده‌های ثبت‌شده در برگه تطبیق بده: وضعیت بدن/ایستگاه، زاویه‌ها و اجزای ثبت‌شده، تناسب عکس با روش انتخاب‌شده، و هر ناسازگاری قابل مشاهده. فقط آنچه واقعاً در عکس دیده می‌شود بیان کن و از حدس درباره موارد پنهان خودداری کن. اگر عکس برای قضاوت کافی نیست، محدودیت و مشاهده لازم را در missing_information بنویس. امتیاز نرم‌افزار: "+JSON.stringify(payload)+"\\nتعداد عکس‌های خود برگه: "+images.length;
  const userContent:any[]=[{type:"text",text:userText}];
  images.forEach((im:any,i:number)=>{userContent.push({type:"text",text:"عکس شماره "+(i+1)+" که مستقیماً از برگه ارزیابی بارگذاری شده است:"});userContent.push({type:"image_url",image_url:{url:"data:"+im.media_type+";base64,"+im.data}})});
  const R=await runAI({max_tokens:3500,temperature:0,response_format:{type:"json_object"},messages:[{role:"system",content:REVIEW_SYSTEM},{role:"user",content:userContent}]});
  if(!R.out){if(R.status&&R.status!==200)return J({error:"خطای سرویس بازبینی ارگونومی ("+R.status+"): "+String(R.detail||"").slice(0,260)},502);return J({error:"پاسخ بازبینی ارگونومی در قالب JSON معتبر نبود (مدل: "+String(R.model||MODEL)+"). چند لحظه بعد دوباره تلاش کنید."},502)}
  {
   const out=R.out;
   const arr=(v:unknown,max=8)=>Array.isArray(v)?v.filter(x=>typeof x==="string"&&x.trim()).slice(0,max).map(x=>x.slice(0,500)):[];
   const dr:any=out.draft&&typeof out.draft==="object"?out.draft:{},ds=(v:unknown,n:number)=>typeof v==="string"?v.trim().slice(0,n):"";
   const actions=Array.isArray(out.corrective_actions)?out.corrective_actions.slice(0,8).filter((x:any)=>x&&typeof x.action==="string"&&x.action.trim()).map((x:any)=>({action:String(x.action).slice(0,700),priority:["فوری","بالا","متوسط","پایین"].includes(x.priority)?x.priority:"متوسط",reason:String(x.reason||"").slice(0,350)})):[];
   return J({method,score,score_review:String(out.score_review||"").slice(0,700),score_integrity_comment:String(out.score_integrity_comment||"").slice(0,500),comments:arr(out.comments),missing_information:arr(out.missing_information),corrective_actions:actions,draft:{hazard:ds(dr.hazard,400),consequence:ds(dr.consequence,400),causes:ds(dr.causes,500),existing_controls:ds(dr.existing_controls,500),assessor_note:ds(dr.assessor_note,800)},overall_comment:String(out.overall_comment||"").slice(0,700),confidence:["high","medium","low"].includes(out.confidence)?out.confidence:"low",model:rd?.model||MODEL});
  }
 }

 const images=body?.images,categories=body?.categories;
 const assessmentType=body?.assessment_type==="ergo"?"ergo":"safety";
 const allowedMethods=assessmentType==="ergo"?["reba","rula","rosa"]:["fmea","hazop"];
 const SYSTEM=assessmentType==="ergo"?ERGO_SYSTEM:SAFETY_SYSTEM;
 if(!Array.isArray(images)||images.length<1||images.length>6)return J({error:"باید بین ۱ تا ۶ تصویر ارسال شود."},400);
 if(!Array.isArray(categories)||!categories.length||categories.length>60)return J({error:"فهرست دسته‌های ارزیابی معتبر نیست."},400);
 const imageDescription=typeof body.image_description==="string"?body.image_description.trim():"";
 if(imageDescription.length<15||imageDescription.length>1800)return J({error:"توضیح تصویر الزامی است و باید بین ۱۵ تا ۱۸۰۰ نویسه باشد."},400);
 let total=0;
 for(const im of images){
  if(!im||im.media_type!=="image/jpeg"||typeof im.data!=="string"||!/^[A-Za-z0-9+/=]+$/.test(im.data))return J({error:"فرمت تصویر ارسالی معتبر نیست."},400);
  if(im.data.length>2_100_000)return J({error:"حجم یکی از تصاویر برای تحلیل زیاد است."},413);
  total+=im.data.length;
 }
 if(total>7_000_000)return J({error:"حجم مجموع تصاویر بیش از حد مجاز است."},413);
 const safeCats=categories.filter((x:unknown)=>typeof x==="string"&&x.length<140);
 const content:any[]=[];
 images.forEach((im:any,i:number)=>{content.push({type:"text",text:"تصویر "+(i+1)+":"});content.push({type:"image_url",image_url:{url:"data:"+im.media_type+";base64,"+im.data}})});
 content.push({type:"text",text:"واحد/سوله: "+String(body.unit||"").slice(0,180)+"\nفعالیت یا تجهیز: "+String(body.activity||"").slice(0,300)+"\nمراحل و شرح کار: "+String(body.context||"").slice(0,1200)+"\nتجهیزات و ابزار: "+String(body.equipment||"").slice(0,900)+"\nمواد و سیالات: "+String(body.materials||"").slice(0,900)+"\nافراد در معرض و میزان مواجهه: "+String(body.exposed_people||"").slice(0,700)+"\nشرایط محیطی: "+String(body.environmental_conditions||"").slice(0,700)+"\nکنترل‌های موجود و سوابق: "+String(body.existing_controls||"").slice(0,900)+"\nخطرات شناسایی‌شده توسط کارشناس (اولویت اصلی؛ آن‌ها را تکرار یا بازنویسی نکن): "+JSON.stringify(Array.isArray(body.expert_hazards)?body.expert_hazards.slice(0,30):[])+"\nتوضیح کارشناس درباره محتوای تصویر(ها): "+imageDescription.slice(0,1800)+"\nدسته‌های مجاز (یکی را دقیقاً انتخاب کن): "+JSON.stringify(safeCats)+"\nفقط خطرات احتمالی جاافتاده را به‌عنوان پیشنهاد مکمل ارائه کن؛ خطرات کارشناسی را تکرار نکن. پیشنهادها قطعی نیستند و باید توسط کارشناس بررسی شوند. از انتخاب روش خارج از فهرست مجاز خودداری کن. تمام متن‌های خروجی را فارسی روان و موجز بنویس؛ فقط شناسه روش و کلیدهای JSON انگلیسی باشند. آنچه در تصویر دیده می‌شود را از موارد احتمالی جدا کن. خروجی کوتاه باشد: hazards حداکثر ۶ ردیف مستقل با hazard و consequence و causes اختصاصی، visible_hazards حداکثر ۶ مورد، verify_on_site حداکثر ۶ مورد، hazard یک جمله، consequence و causes هرکدام حداکثر دو مورد. مقدمه، نتیجه‌گیری و تکرار ننویس. روش‌های مجاز: "+allowedMethods.join(", ")+"."});
 const r=await fetch("https://openrouter.ai/api/v1/chat/completions",{method:"POST",headers:{"Authorization":"Bearer "+KEY,"content-type":"application/json","HTTP-Referer":"https://mohammadallahrezaei-sys.github.io/Rezaei_HSE/","X-OpenRouter-Title":"Kharazmi HSE"},body:JSON.stringify({model:MODEL,max_tokens:4000,temperature:0,reasoning:{effort:"none"},response_format:{type:"json_object"},messages:[{role:"system",content:SYSTEM},{role:"user",content}]})});
 if(!r.ok){const detail=await r.text().catch(()=>"");return J({error:"خطای سرویس تحلیل تصویر ("+r.status+"): "+detail.slice(0,300)},502)}
const d=await r.json();
 const choice=d?.choices?.[0];
 const message=choice?.message ?? d?.message ?? null;
 const msgContent=message?.content ?? d?.content ?? d?.output?.find?.((x:any)=>x?.type==="message")?.content ?? d?.output?.[0]?.content;
const rawText=typeof msgContent==="string"?msgContent:Array.isArray(msgContent)?msgContent.filter((x:any)=>typeof x?.text==="string").map((x:any)=>String(x.text)).join("\n"):"";
const raw=rawText.trim().replace(/^\s*```(?:json)?\s*/i,"").replace(/\s*```\s*$/,"");
 try{
  const out=JSON.parse(raw);if(!out||!allowedMethods.includes(out.method))throw new Error("method");
  if(!safeCats.includes(out.category))out.category=safeCats[0];
  const arr=(v:unknown)=>Array.isArray(v)?v.filter(x=>typeof x==="string").slice(0,8).map(x=>x.slice(0,260)):[];
  const hazardRows=(v:unknown,fm:string,fc:string)=>{const src=Array.isArray(v)?v.slice(0,6).map((x:any)=>typeof x==="string"?{hazard:x}:x):[];const rows=src.filter((x:any)=>x&&typeof x==="object").map((x:any)=>({method:allowedMethods.includes(x.method)?x.method:fm,category:safeCats.includes(x.category)?x.category:fc,hazard:String(x.hazard||"").slice(0,500),consequence:String(x.consequence||"").slice(0,500),causes:String(x.causes||"").slice(0,500)})).filter((x:any)=>x.hazard.trim());if(rows.length)return rows;const fallback=arr(out.visible_hazards);if(!fallback.length&&String(out.hazard||"").trim())fallback.push(String(out.hazard).slice(0,500));return fallback.slice(0,6).map(hazard=>({method:fm,category:fc,hazard,consequence:String(out.consequence||"").slice(0,500),causes:String(out.causes||"").slice(0,500)}));};
  return J({method:out.method,method_reason:String(out.method_reason||"").slice(0,500),category:out.category,hazards:hazardRows(out.hazards,out.method,out.category),visible_hazards:hazardRows(out.hazards,out.method,out.category).map(x=>x.hazard),hazard:String(out.hazard||"").slice(0,700),consequence:String(out.consequence||"").slice(0,700),causes:String(out.causes||"").slice(0,700),verify_on_site:arr(out.verify_on_site),confidence:["high","medium","low"].includes(out.confidence)?out.confidence:"low",limitations:String(out.limitations||"تصویر برای تعیین قطعی سطح ریسک کافی نیست؛ بازدید میدانی الزامی است.").slice(0,600),hazop:out.method==="hazop"&&out.hazop?{parameter:String(out.hazop.parameter||"").slice(0,120),guide_word:String(out.hazop.guide_word||"").slice(0,120)}:null,model:MODEL});
 }catch{
  const candidate=raw.match(/\{[\s\S]*\}/)?.[0];
  if(candidate){try{
   const out=JSON.parse(candidate);
   if(out&&allowedMethods.includes(out.method)){
    if(!safeCats.includes(out.category))out.category=safeCats[0];
    const arr=(v:unknown)=>Array.isArray(v)?v.filter(x=>typeof x==="string").slice(0,8).map(x=>x.slice(0,260)):[];
  const hazardRows=(v:unknown,fm:string,fc:string)=>{const src=Array.isArray(v)?v.slice(0,6).map((x:any)=>typeof x==="string"?{hazard:x}:x):[];const rows=src.filter((x:any)=>x&&typeof x==="object").map((x:any)=>({method:allowedMethods.includes(x.method)?x.method:fm,category:safeCats.includes(x.category)?x.category:fc,hazard:String(x.hazard||"").slice(0,500),consequence:String(x.consequence||"").slice(0,500),causes:String(x.causes||"").slice(0,500)})).filter((x:any)=>x.hazard.trim());if(rows.length)return rows;const fallback=arr(out.visible_hazards);if(!fallback.length&&String(out.hazard||"").trim())fallback.push(String(out.hazard).slice(0,500));return fallback.slice(0,6).map(hazard=>({method:fm,category:fc,hazard,consequence:String(out.consequence||"").slice(0,500),causes:String(out.causes||"").slice(0,500)}));};
    return J({method:out.method,method_reason:String(out.method_reason||"").slice(0,500),category:out.category,hazards:hazardRows(out.hazards,out.method,out.category),visible_hazards:hazardRows(out.hazards,out.method,out.category).map(x=>x.hazard),hazard:String(out.hazard||"").slice(0,700),consequence:String(out.consequence||"").slice(0,700),causes:String(out.causes||"").slice(0,700),verify_on_site:arr(out.verify_on_site),confidence:["high","medium","low"].includes(out.confidence)?out.confidence:"low",limitations:String(out.limitations||"تصویر برای تعیین قطعی سطح ریسک کافی نیست؛ بازدید میدانی الزامی است.").slice(0,600),hazop:out.method==="hazop"&&out.hazop?{parameter:String(out.hazop.parameter||"").slice(0,120),guide_word:String(out.hazop.guide_word||"").slice(0,120)}:null,model:MODEL});
   }
  }catch{}}
  const diagnostic={model:d?.model||MODEL,finish_reason:choice?.finish_reason||null,native_finish_reason:choice?.native_finish_reason||null,content_type:typeof msgContent,content_length:raw.length,refusal:typeof message?.refusal==="string"?message.refusal.slice(0,180):null,completion_tokens:d?.usage?.completion_tokens??null,reasoning_tokens:d?.usage?.completion_tokens_details?.reasoning_tokens??null,tool_calls:Array.isArray(message?.tool_calls)?message.tool_calls.length:0,error:d?.error?.message||null};
  console.error("Risk vision response parse failed",JSON.stringify(diagnostic));
  const reason=!raw?("مدل خروجی متنی نداد؛ finish_reason="+String(diagnostic.finish_reason||"نامشخص")+", مدل="+String(diagnostic.model)+", توکن خروجی="+String(diagnostic.completion_tokens??"نامشخص")+(diagnostic.refusal?", علت رد درخواست: "+diagnostic.refusal:"")):"پاسخ مدل JSON معتبر نبود.";
  return J({error:reason,diagnostic},502)
 }
  }),
};
