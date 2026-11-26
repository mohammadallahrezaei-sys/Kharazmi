/* Shared HSE action projection — read-only, source-owned records only. */
(function(){
'use strict';
const SOURCES={
 finding:{label:'عدم‌انطباق بازرسی',icon:'📋',href:id=>'checklists.html#one='+encodeURIComponent(id)},
 ergo:{label:'اقدام ارگونومی',icon:'🪑',href:id=>'ergo_followup.html'},
 incident:{label:'اقدام اصلاحی حادثه',icon:'🚨',href:id=>'clinic.html#inc='+encodeURIComponent(id)},
 behavior:{label:'اقدام رفتار ناایمن',icon:'👷',href:id=>'behavior.html'},
 clinic_followup:{label:'پیگیری عمومی بهداری',icon:'🏥',href:id=>'clinic.html#fu='+encodeURIComponent(id)}
};
const clean=v=>String(v==null?'':v).trim();
const date=v=>v?String(v).slice(0,10):'';
function row(source,id,title,fields){
 const uid=source+':'+String(id);
 return {action_uid:uid,source,source_id:String(id),source_label:SOURCES[source].label,icon:SOURCES[source].icon,href:SOURCES[source].href(id),title:clean(title)||SOURCES[source].label,unit:clean(fields.unit),owner:clean(fields.owner),due_date:date(fields.due_date),native_status:clean(fields.status),created_at:fields.created_at||null,incident_date:fields.incident_date||null,action_status:clean(fields.status),corrective_action:source==='incident'?clean(title):'',action_due_date:date(fields.due_date),id:String(id),detail:clean(fields.detail),record_type:'source_record',writable:false};
}
async function read(name,query,map,items,errors,GET){
 try{const rows=await GET(query);(rows||[]).forEach(x=>{const y=map(x);if(y)items.push(y)})}
 catch(e){errors.push({source:name,message:String(e&&e.message||e).slice(0,180)})}
}
async function load(){
 const GET=window.HSE&&typeof HSE.getAll==='function'?HSE.getAll.bind(HSE):window.HSEDB&&typeof HSEDB.getAll==='function'?HSEDB.getAll.bind(HSEDB):null;
 if(!GET)throw new Error('هسته خواندن داده HSE بارگذاری نشده است.');
 const items=[],errors=[];
 await Promise.all([
  read('findings','findings?status=eq.open&module=neq.MED&select=id,module,question,note,location,due_date,responsible,created_at,root_cause&order=id.asc',x=>row('finding',x.id,x.question||x.note,{unit:x.location,owner:x.responsible,due_date:x.due_date,status:'open',created_at:x.created_at,detail:x.root_cause?'علت ریشه‌ای: '+x.root_cause:''}),items,errors,GET),
  read('ergonomic_actions','ergonomic_actions?status=in.(open,implemented,pending_verification)&select=id,unit,station,task,risk_factor,planned_action,responsible,due_date,status,created_at',x=>row('ergo',x.id,[x.planned_action,x.risk_factor,x.task].filter(Boolean).join(' — '),{unit:[x.unit,x.station].filter(Boolean).join(' · '),owner:x.responsible,due_date:x.due_date,status:x.status,created_at:x.created_at,detail:'وضعیت تخصصی: '+(x.status||'—'),task:x.task,risk_factor:x.risk_factor,planned_action:x.planned_action,responsible:x.responsible}),items,errors),
  read('clinic_incidents','clinic_incidents?select=id,corrective_action,action_owner,action_due_date,action_status,location,unit,incident_date,created_at',x=>x.corrective_action&&x.action_status!=='done'?row('incident',x.id,x.corrective_action,{unit:x.location||x.unit,owner:x.action_owner,due_date:x.action_due_date,status:x.action_status,created_at:x.incident_date||x.created_at,incident_date:x.incident_date||x.created_at}):null,items,errors),
  read('behavior_obs','behavior_obs?result=eq.unsafe&status=neq.closed&action_status=eq.open&select=id,action,action_owner,action_due,action_status,location,unit,created_at',x=>x.action&&x.action_status!=='done'?row('behavior',x.id,x.action,{unit:x.location||x.unit,owner:x.action_owner,due_date:x.action_due,status:x.action_status,created_at:x.created_at}):null,items,errors),
  read('clinic_followups','clinic_followups?kind=eq.followup&status=in.(pending,overdue)&select=id,title,kind,due_date,status,created_at',x=>row('clinic_followup',x.id,x.title,{due_date:x.due_date,status:x.status,created_at:x.created_at}),items,errors)
 ]);
 let visible=items;
 if(window.HSEAuth&&typeof HSEAuth.visibleFollowups==='function'){
  try{const allowed=await HSEAuth.visibleFollowups(items.filter(x=>x.source==='clinic_followup').map(x=>({id:x.source_id,title:x.title,kind:'followup'})));const ids=new Set((allowed||[]).map(x=>String(x.id)));visible=items.filter(x=>x.source!=='clinic_followup'||ids.has(x.source_id))}
  catch(e){visible=items.filter(x=>x.source!=='clinic_followup');errors.push({source:'clinic_followups visibility',message:'فیلتر محرمانگی اعمال نشد؛ این ردیف‌ها پنهان شدند.'})}
 }
 const unique=new Map();visible.forEach(x=>{if(!unique.has(x.action_uid))unique.set(x.action_uid,x)});
 return {items:[...unique.values()],errors,meta:{readOnly:true,generated_at:new Date().toISOString(),source_count:5,excluded:['finding_followups','ergo_action_history','incident_capa','raw_cards','FMEA/HAZOP planned_controls','notice_wo'] }};
}
window.HSEActionEngine={load,SOURCES};
})();