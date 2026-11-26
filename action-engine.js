/* Shared HSE action projection — read-only, source-owned records only. */
(function(){
'use strict';
const SOURCES={
 finding:{label:'عدم‌انطباق بازرسی',icon:'📋',href:id=>'checklists.html#one='+encodeURIComponent(id)},
 equipment_defect:{label:'ایراد تجهیز',icon:'🛠️',href:id=>'equipment.html?code='+encodeURIComponent(id)},
 ergo:{label:'اقدام ارگونومی',icon:'🪑',href:id=>'ergo_followup.html#action='+encodeURIComponent(id)},
 incident:{label:'اقدام اصلاحی حادثه',icon:'🚨',href:id=>'clinic.html#inc='+encodeURIComponent(id)},
 behavior:{label:'اقدام رفتار ناایمن',icon:'👷',href:id=>'behavior.html#obs='+encodeURIComponent(id)},
 clinic_followup:{label:'پیگیری عمومی بهداری',icon:'🏥',href:id=>'clinic.html#fu='+encodeURIComponent(id)}
};
const clean=v=>String(v==null?'':v).trim();
const date=v=>v?String(v).slice(0,10):'';
function row(source,id,title,fields){
 const uid=source+':'+String(id);
 return {action_uid:uid,source,source_id:String(id),source_label:SOURCES[source].label,icon:SOURCES[source].icon,href:SOURCES[source].href(id),title:clean(title)||SOURCES[source].label,unit:clean(fields.unit),owner:clean(fields.owner),due_date:date(fields.due_date),native_status:clean(fields.status),created_at:fields.created_at||null,incident_date:fields.incident_date||null,action_status:clean(fields.status),corrective_action:source==='incident'?clean(title):'',action_due_date:date(fields.due_date),id:String(id),detail:clean(fields.detail),source_data:fields.source_data||{},record_type:'source_record',writable:false};
}
async function read(name,query,map,items,errors,GET){
 try{const rows=await GET(query);(rows||[]).forEach(x=>{const y=map(x);if(y)items.push(y)})}
 catch(e){errors.push({source:name,message:String(e&&e.message||e).slice(0,180)})}
}
async function loadRiskPlans(GET){
 GET=GET||(window.HSE&&typeof HSE.getAll==='function'?HSE.getAll.bind(HSE):window.HSEDB&&typeof HSEDB.getAll==='function'?HSEDB.getAll.bind(HSEDB):null);
 if(!GET)throw new Error('هسته خواندن داده HSE بارگذاری نشده است.');
 const rows=await GET('risks?method=in.(fmea,hazop)&status=eq.approved&planned_controls=not.is.null&select=id,method,unit,hazard,planned_controls,owner,review_date,score&order=score.desc');
 return (rows||[]).filter(x=>clean(x.planned_controls)).map(x=>({risk_plan_uid:'risk-plan:'+String(x.id),risk_id:String(x.id),id:String(x.id),method:clean(x.method),unit:clean(x.unit),hazard:clean(x.hazard),planned_controls:clean(x.planned_controls),risk_owner:clean(x.owner),owner:clean(x.owner),review_date:date(x.review_date),score:x.score,href:'risks.html#risk='+encodeURIComponent(x.id),record_type:'unconverted_risk_plan',writable:false}));
}
async function load(options={}){
 const includeCompleted=options.includeCompleted===true;
 const GET=window.HSE&&typeof HSE.getAll==='function'?HSE.getAll.bind(HSE):window.HSEDB&&typeof HSEDB.getAll==='function'?HSEDB.getAll.bind(HSEDB):null;
 if(!GET)throw new Error('هسته خواندن داده HSE بارگذاری نشده است.');
 const items=[],errors=[];
 await Promise.all([
  read('findings','findings?status=eq.open&module=neq.MED&select=id,module,qid,question,note,location,severity,category,notice_code,due_date,responsible,created_at,root_cause&order=id.asc',x=>row('finding',x.id,x.question||x.note,{unit:x.location,owner:x.responsible,due_date:x.due_date,status:'open',created_at:x.created_at,detail:x.root_cause?'علت ریشه‌ای: '+x.root_cause:'',source_data:{severity:x.severity,category:x.category,qid:x.qid,notice_code:x.notice_code,root_cause:x.root_cause}}),items,errors,GET),
  read('ergonomic_actions','ergonomic_actions?status=in.(open,implemented,pending_verification)&select=id,unit,station,task,risk_factor,planned_action,initial_level,responsible,due_date,status,created_at',x=>row('ergo',x.id,[x.planned_action,x.risk_factor,x.task].filter(Boolean).join(' — '),{unit:[x.unit,x.station].filter(Boolean).join(' · '),owner:x.responsible,due_date:x.due_date,status:x.status,created_at:x.created_at,detail:'وضعیت تخصصی: '+(x.status||'—'),task:x.task,risk_factor:x.risk_factor,planned_action:x.planned_action,initial_level:x.initial_level,responsible:x.responsible}),items,errors,GET),
  read('clinic_incidents','clinic_incidents?select=id,corrective_action,action_owner,action_due_date,action_status,location,unit,incident_date,created_at',x=>x.corrective_action&&(includeCompleted||x.action_status!=='done')?row('incident',x.id,x.corrective_action,{unit:x.location||x.unit,owner:x.action_owner,due_date:x.action_due_date,status:x.action_status,created_at:x.incident_date||x.created_at,incident_date:x.incident_date||x.created_at}):null,items,errors,GET),
  read('behavior_obs','behavior_obs?result=eq.unsafe&status=neq.closed&action_status=eq.open&select=id,action,action_owner,action_due,action_status,location,unit,created_at',x=>x.action&&x.action_status!=='done'?row('behavior',x.id,x.action,{unit:x.location||x.unit,owner:x.action_owner,due_date:x.action_due,status:x.action_status,created_at:x.created_at}):null,items,errors,GET),
  read('clinic_followups','clinic_followups?kind=eq.followup&'+(includeCompleted?'status=neq.cancelled&':'status=in.(pending,overdue)&')+'select=id,title,kind,priority,due_date,status,created_at',x=>row('clinic_followup',x.id,x.title,{due_date:x.due_date,status:x.status,created_at:x.created_at,source_data:{priority:x.priority}}),items,errors,GET)
 ]);
 // Preview-only bridge: local equipment defects are projected from the browser's own
 // equipment register. They remain source-owned and read-only; no remote write occurs.
 try{
  const raw=window.localStorage&&localStorage.getItem('khz_equipment_v1');
  if(raw){
   const db=JSON.parse(raw),eqs=Array.isArray(db.eq)?db.eq:[],ins=Array.isArray(db.ins)?db.ins:[];
   const byCode=new Map();
   ins.forEach(z=>{const k=String(z.equipment_code||'');if(!byCode.has(k))byCode.set(k,[]);byCode.get(k).push(z)});
   eqs.forEach(eq=>{
    const rows=(byCode.get(String(eq.code))||[]).slice().sort((a,b)=>String(a.inspected_on||'').localeCompare(String(b.inspected_on||'')));
    const last=rows[rows.length-1];if(!last||eq.active===false||eq.requires_inspection===false)return;
    const open=last.defects==='در حال رسیدگی'||(last.result==='عدم تایید'&&last.defects!=='رفع شد');
    if(!open)return;
    const id=String(last.id||eq.code),code=String(eq.code||'');
    items.push({action_uid:'equipment_defect:'+code+':'+id,source:'equipment_defect',source_id:id,
     source_label:SOURCES.equipment_defect.label,icon:SOURCES.equipment_defect.icon,
     href:'equipment.html?code='+encodeURIComponent(code),
     title:'ایراد تجهیز: '+clean(eq.title||code)+' ('+code+')',
     unit:[clean(eq.hall),clean(eq.location)].filter(Boolean).join(' · '),
     owner:'',due_date:'',native_status:'open',action_status:'open',
     created_at:last.inspected_on||null,incident_date:null,corrective_action:'',
     action_due_date:'',id,detail:[clean(last.defects),clean(last.notes)].filter(Boolean).join(' — '),
     source_data:{equipment_code:code,inspection_id:id,result:last.result||'',defects:last.defects||''},
     record_type:'local_source_record',writable:false});
   });
  }
 }catch(e){errors.push({source:'ایرادهای تجهیزات محلی',message:'داده محلی تجهیزات قابل خواندن نیست؛ صف این منبع ناقص است.'})}
 let visible=items;
 if(window.HSEAuth&&typeof HSEAuth.visibleFollowups==='function'){
  try{const allowed=await HSEAuth.visibleFollowups(items.filter(x=>x.source==='clinic_followup').map(x=>({id:x.source_id,title:x.title,kind:'followup'})));const ids=new Set((allowed||[]).map(x=>String(x.id)));visible=items.filter(x=>x.source!=='clinic_followup'||ids.has(x.source_id))}
  catch(e){visible=items.filter(x=>x.source!=='clinic_followup');errors.push({source:'clinic_followups visibility',message:'فیلتر محرمانگی اعمال نشد؛ این ردیف‌ها پنهان شدند.'})}
 }
 let riskPlans=[];
 if(options.includeRiskPlans){try{riskPlans=await loadRiskPlans(GET)}catch(e){errors.push({source:'FMEA/HAZOP planned controls',message:String(e&&e.message||e).slice(0,180)})}}
 // Manager-only overlay: preserve source-native fields and expose effective values separately.
 let overlayApplied=false;
 visible.forEach(x=>{x.effective_owner=x.owner;x.effective_due_date=x.due_date});
 if(options.includeOverlay===true&&window.HSEAuth&&HSEAuth.role==='manager'){
  try{const overlays=await GET('action_overlay?select=key,owner,due_override');const byKey=new Map((overlays||[]).map(o=>[String(o.key),o]));
   visible.forEach(x=>{const key=x.source==='clinic_followup'?'followup:'+x.source_id:x.action_uid;const o=byKey.get(key);if(!o)return;x.effective_owner=clean(o.owner)||x.owner;x.effective_due_date=date(o.due_override)||x.due_date});overlayApplied=true;
  }catch(e){errors.push({source:'مدیریت مسئول/مهلت',message:String(e&&e.message||e).slice(0,180)})}
 }
 const unique=new Map();visible.forEach(x=>{if(!unique.has(x.action_uid))unique.set(x.action_uid,x)});
 return {items:[...unique.values()],riskPlans,errors,meta:{readOnly:true,overlayApplied,generated_at:new Date().toISOString(),source_count:5,excluded:['finding_followups','ergo_action_history','incident_capa','raw_cards','notice_wo'],separateQueues:['FMEA/HAZOP planned_controls'] }};
}
window.HSEActionEngine={load,loadRiskPlans,SOURCES};
})();