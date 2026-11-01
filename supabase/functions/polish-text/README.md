# تابع polish-text (بهبود جمله‌بندی صورتجلسه)

یک‌بار انجام می‌شود:

1. کلید API را از console.anthropic.com بگیرید (بخش API Keys).
2. در Supabase: Project Settings ← Edge Functions ← Secrets ← افزودن `ANTHROPIC_API_KEY` با مقدار کلید.
3. در Supabase: Edge Functions ← Deploy a new function (Via Editor) ← نام `polish-text` ← محتوای `index.ts` را پیست و Deploy کنید.
   (گزینهٔ «Verify JWT» روشن بماند؛ فقط کاربر واردشده می‌تواند فراخوانی کند.)
4. اختیاری: برای مدل ارزان‌تر، Secret با نام `POLISH_MODEL` و مقدار `claude-haiku-5-5` بگذارید.

هزینه: هر دکمهٔ «بهبود جمله‌بندی» چند ده توکن تا چند هزار توکن مصرف می‌کند (چند ده تومان تا چند صد تومان).
