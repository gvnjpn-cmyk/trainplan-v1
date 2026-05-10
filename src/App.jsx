import { useState, useEffect, useRef, useCallback, useMemo } from "react";

// ── CONSTANTS ─────────────────────────────────────────────────────────────────
const DAYS_FULL = ["Senin","Selasa","Rabu","Kamis","Jumat","Sabtu","Minggu"];
const JS_TO_DAY = {1:"Senin",2:"Selasa",3:"Rabu",4:"Kamis",5:"Jumat",6:"Sabtu",0:"Minggu"};
const CATS = [
  {id:"cardio",   label:"Cardio",   color:"#FF6230", shadow:"rgba(255,98,48,.35)",   icon:"🏃"},
  {id:"strength", label:"Strength", color:"#4D8AFF", shadow:"rgba(77,138,255,.35)",  icon:"💪"},
  {id:"yoga",     label:"Yoga",     color:"#BF7EF7", shadow:"rgba(191,126,247,.35)", icon:"🧘"},
  {id:"hiit",     label:"HIIT",     color:"#FF3354", shadow:"rgba(255,51,84,.35)",   icon:"⚡"},
  {id:"swimming", label:"Swimming", color:"#00C8E0", shadow:"rgba(0,200,224,.35)",   icon:"🏊"},
  {id:"cycling",  label:"Cycling",  color:"#22D47A", shadow:"rgba(34,212,122,.35)",  icon:"🚴"},
  {id:"other",    label:"Lainnya",  color:"#F0B429", shadow:"rgba(240,180,41,.35)",  icon:"🎯"},
];
const DEF_WEEKLY = [
  {id:1,day:"Senin", time:"06:30",duration:45,name:"Morning Run",      category:"cardio",   enabled:true},
  {id:2,day:"Selasa",time:"19:00",duration:60,name:"Strength Training",category:"strength", enabled:true},
  {id:3,day:"Rabu",  time:"06:00",duration:30,name:"HIIT Blast",       category:"hiit",     enabled:true},
  {id:4,day:"Kamis", time:"20:00",duration:45,name:"Evening Swim",     category:"swimming", enabled:true},
  {id:5,day:"Jumat", time:"07:00",duration:60,name:"Cycling",          category:"cycling",  enabled:true},
  {id:6,day:"Sabtu", time:"08:00",duration:90,name:"Yoga Flow",        category:"yoga",     enabled:true},
];
const pad = n => String(n).padStart(2,"0");
const todayStr = () => { const d=new Date(); return `${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}`; };
const addDays  = (d,n) => { const dt=new Date(d+"T12:00:00"); dt.setDate(dt.getDate()+n); return `${dt.getFullYear()}-${pad(dt.getMonth()+1)}-${pad(dt.getDate())}`; };
const makeCPDefs = () => [
  {id:201,name:"5K Morning Run",startDate:todayStr(),endDate:addDays(todayStr(),4),time:"06:00",duration:30,category:"cardio",note:"Program lari 5 hari",completedDates:[]},
  {id:202,name:"Push-Pull-Legs",startDate:todayStr(),endDate:addDays(todayStr(),2),time:"19:00",duration:75,category:"strength",note:"PPL split 3 hari",completedDates:[]},
];

// ── HELPERS ───────────────────────────────────────────────────────────────────
const toMin      = t => { const [h,m]=t.split(":").map(Number); return h*60+m; };
const getCat     = id => CATS.find(c=>c.id===id)??CATS[6];
const fmtDate    = d => new Date(d+"T12:00:00").toLocaleDateString("id-ID",{day:"numeric",month:"short",year:"numeric"});
const daysBetween= (a,b) => Math.round((new Date(b+"T12:00:00")-new Date(a+"T12:00:00"))/(864e5));

let _audioCtx = null;
const getAudioCtx = () => {
  if (!_audioCtx) _audioCtx = new (window.AudioContext || window.webkitAudioContext)();
  return _audioCtx;
};
const playBeep = (freq=880, dur=300, vol=0.2) => {
  try {
    const ctx = getAudioCtx();
    const resume = ctx.state === "suspended" ? ctx.resume() : Promise.resolve();
    resume.then(() => {
      const osc = ctx.createOscillator(), g = ctx.createGain();
      osc.connect(g); g.connect(ctx.destination);
      osc.frequency.value = freq; osc.type = "sine";
      g.gain.setValueAtTime(vol, ctx.currentTime);
      g.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + dur / 1000);
      osc.start(); osc.stop(ctx.currentTime + dur / 1000);
    });
  } catch(_) {}
};

// ── LOCAL STORAGE HOOK ────────────────────────────────────────────────────────
function useLS(key,initial) {
  const [val,setVal]=useState(()=>{
    try{
      const s=localStorage.getItem(key);
      if(s){ const p=JSON.parse(s); if(Array.isArray(p)&&p.length>0) return p; }
    }catch{}
    return typeof initial==="function"?initial():initial;
  });
  useEffect(()=>{ try{localStorage.setItem(key,JSON.stringify(val));}catch{} },[key,val]);
  return [val,setVal];
}

// ── RING PROGRESS ─────────────────────────────────────────────────────────────
function Ring({pct,color,size=80,stroke=6}) {
  const r=(size-stroke)/2,circ=2*Math.PI*r,off=circ-Math.min(pct,100)/100*circ;
  return (
    <svg width={size} height={size} style={{transform:"rotate(-90deg)",display:"block"}}>
      <circle cx={size/2} cy={size/2} r={r} fill="none" stroke="rgba(255,255,255,.05)" strokeWidth={stroke}/>
      <circle cx={size/2} cy={size/2} r={r} fill="none" stroke={color} strokeWidth={stroke}
        strokeDasharray={circ} strokeDashoffset={off} strokeLinecap="round"
        style={{transition:"stroke-dashoffset .8s cubic-bezier(.4,0,.2,1)",filter:`drop-shadow(0 0 10px ${color})`}}/>
    </svg>
  );
}

// ── TOGGLE ────────────────────────────────────────────────────────────────────
function Toggle({checked,onChange,color="#FF6230"}) {
  return (
    <div onClick={onChange} style={{position:"relative",width:42,height:24,
      background:checked?`${color}20`:"rgba(255,255,255,.06)",
      border:`1px solid ${checked?color+"40":"rgba(255,255,255,.08)"}`,
      borderRadius:24,cursor:"pointer",transition:"all .25s",flexShrink:0}}>
      <div style={{position:"absolute",top:3,left:checked?"calc(100% - 21px)":3,
        width:16,height:16,borderRadius:16,background:checked?color:"#3A4050",
        transition:"left .25s cubic-bezier(.4,0,.2,1)",boxShadow:checked?`0 0 8px ${color}`:"none"}}/>
    </div>
  );
}

// ── BTN ───────────────────────────────────────────────────────────────────────
function Btn({icon,onClick,danger,accent,title}) {
  const [hov,setHov]=useState(false);
  const bg = danger?(hov?"rgba(255,51,84,.18)":"rgba(255,51,84,.08)")
           : accent?(hov?"rgba(255,98,48,.2)":"rgba(255,98,48,.1)")
           : (hov?"rgba(255,255,255,.1)":"rgba(255,255,255,.05)");
  const col = danger?"#FF3354":accent?"#FF6230":(hov?"#E8ECF0":"#6A7585");
  const bdr = danger?"rgba(255,51,84,.2)":accent?"rgba(255,98,48,.3)":"rgba(255,255,255,.08)";
  return (
    <button onClick={onClick} title={title} onMouseEnter={()=>setHov(true)} onMouseLeave={()=>setHov(false)}
      style={{background:bg,border:`1px solid ${bdr}`,borderRadius:9,color:col,
        padding:"7px 10px",cursor:"pointer",fontSize:13,transition:"all .15s",fontFamily:"inherit"}}>
      {icon}
    </button>
  );
}

// ── TIMER MODAL ───────────────────────────────────────────────────────────────
function TimerModal({target,onClose}) {
  const c=getCat(target.category);
  const total=target.duration*60;
  const [secs,setSecs]=useState(total);
  const [running,setRunning]=useState(false);
  const [done,setDone]=useState(false);
  const iRef=useRef(null);

  const start=()=>{
    if(done)return;
    setRunning(true);
  };
  const pause=()=>setRunning(false);
  const reset=()=>{ setRunning(false); setSecs(total); setDone(false); };

  useEffect(()=>{
    if(!running)return;
    iRef.current=setInterval(()=>{
      setSecs(s=>{
        if(s<=1){
          setRunning(false); setDone(true);
          playBeep(523,200); setTimeout(()=>playBeep(659,200),250); setTimeout(()=>playBeep(784,400),500);
          try{ new Notification(`✅ Selesai: ${target.name}`,{body:"Kerja bagus! 💪"}); }catch(_){}
          return 0;
        }
        if((s-1)%60===0&&s-1>0) playBeep(440,100,0.1);
        return s-1;
      });
    },1000);
    return()=>clearInterval(iRef.current);
  },[running,target.name]);

  useEffect(()=>()=>clearInterval(iRef.current),[]);

  const pct=((total-secs)/total)*100;
  const h=Math.floor(secs/3600),m=Math.floor((secs%3600)/60),s=secs%60;
  const timeStr=h>0?`${pad(h)}:${pad(m)}:${pad(s)}`:`${pad(m)}:${pad(s)}`;
  const ringSize=220,ringStroke=14;

  return (
    <div style={{position:"fixed",inset:0,zIndex:200,display:"flex",flexDirection:"column",
      alignItems:"center",justifyContent:"center",
      background:"rgba(2,3,10,.95)",backdropFilter:"blur(24px)",
      animation:"fadeIn .25s ease"}} onClick={e=>e.target===e.currentTarget&&!running&&onClose()}>
      {/* Header */}
      <div style={{position:"absolute",top:0,left:0,right:0,padding:"24px",
        display:"flex",justifyContent:"space-between",alignItems:"center"}}>
        <div style={{display:"flex",alignItems:"center",gap:12}}>
          <div style={{width:40,height:40,borderRadius:12,background:`${c.color}15`,
            border:`1px solid ${c.color}25`,display:"flex",alignItems:"center",
            justifyContent:"center",fontSize:22}}>{c.icon}</div>
          <div>
            <div style={{fontWeight:800,fontSize:17,color:"#F0F4FF",letterSpacing:"-.02em"}}>{target.name}</div>
            <div style={{fontSize:12,color:"#3A4558",fontFamily:"'DM Mono',monospace"}}>
              {target.duration} menit · {c.label}
            </div>
          </div>
        </div>
        <button onClick={onClose} style={{width:36,height:36,borderRadius:10,
          border:"1px solid rgba(255,255,255,.08)",background:"rgba(255,255,255,.04)",
          color:"#6A7585",cursor:"pointer",fontSize:16,display:"flex",
          alignItems:"center",justifyContent:"center"}}>✕</button>
      </div>

      {/* Ring */}
      <div style={{position:"relative",marginBottom:40}}>
        <div style={{position:"absolute",inset:0,borderRadius:"50%",
          background:`radial-gradient(circle at 50% 50%,${c.color}08,transparent 70%)`}}/>
        <Ring pct={pct} color={done?"#22D47A":c.color} size={ringSize} stroke={ringStroke}/>
        <div style={{position:"absolute",inset:0,display:"flex",flexDirection:"column",
          alignItems:"center",justifyContent:"center",gap:4}}>
          {done?(
            <>
              <div style={{fontSize:48}}>🎉</div>
              <div style={{fontSize:15,fontWeight:800,color:"#22D47A"}}>Selesai!</div>
            </>
          ):(
            <>
              <div style={{fontFamily:"'DM Mono',monospace",fontSize:42,fontWeight:600,
                color:c.color,letterSpacing:"-.02em",lineHeight:1}}>{timeStr}</div>
              <div style={{fontSize:13,color:"#3A4558",fontFamily:"'DM Mono',monospace"}}>
                {Math.round(pct)}%
              </div>
            </>
          )}
        </div>
      </div>

      {/* Controls */}
      <div style={{display:"flex",gap:14,alignItems:"center"}}>
        <button onClick={reset} style={{width:54,height:54,borderRadius:17,
          background:"rgba(255,255,255,.06)",border:"1px solid rgba(255,255,255,.1)",
          color:"#6A7585",cursor:"pointer",fontSize:20,display:"flex",
          alignItems:"center",justifyContent:"center",transition:"all .2s"}}
          onMouseEnter={e=>{e.currentTarget.style.background="rgba(255,255,255,.12)";e.currentTarget.style.color="#E8ECF0"}}
          onMouseLeave={e=>{e.currentTarget.style.background="rgba(255,255,255,.06)";e.currentTarget.style.color="#6A7585"}}>
          ↺
        </button>
        <button onClick={running?pause:start} disabled={done}
          style={{width:78,height:78,borderRadius:24,
            background:done?"rgba(34,212,122,.15)":`linear-gradient(135deg,${c.color},${c.color}BB)`,
            border:`2px solid ${done?"#22D47A":c.color}`,
            color:"#fff",cursor:done?"default":"pointer",fontSize:30,
            display:"flex",alignItems:"center",justifyContent:"center",
            boxShadow:`0 0 30px ${done?"rgba(34,212,122,.3)":c.shadow}`,transition:"all .2s"}}>
          {done?"✓":running?"⏸":"▶"}
        </button>
        <div style={{width:54,height:54,borderRadius:17,
          background:"rgba(255,255,255,.03)",border:"1px solid rgba(255,255,255,.06)",
          display:"flex",alignItems:"center",justifyContent:"center",
          color:"#2E3545",fontSize:13,fontFamily:"'DM Mono',monospace",fontWeight:600}}>
          {target.duration}m
        </div>
      </div>

      {/* Hint */}
      {!running&&!done&&secs===total&&(
        <div style={{marginTop:24,fontSize:12,color:"#2E3545",fontFamily:"'DM Mono',monospace"}}>
          Tekan ▶ untuk mulai
        </div>
      )}
      {running&&(
        <div style={{marginTop:24,display:"flex",alignItems:"center",gap:6,
          fontSize:12,color:c.color,fontWeight:700}}>
          <span style={{width:6,height:6,borderRadius:"50%",background:c.color,
            display:"inline-block",animation:"pulse 1s infinite"}}/>
          Sedang berjalan
        </div>
      )}
    </div>
  );
}

// ── WEEKLY CARD ───────────────────────────────────────────────────────────────
function WeeklyCard({s,onEdit,onDelete,onToggle,onTimer,today,curMin,idx}) {
  const c=getCat(s.category);
  const start=toMin(s.time);
  const isNow=s.day===today&&curMin>=start&&curMin<start+s.duration;
  const isPast=s.day===today&&curMin>=start+s.duration;
  const pct=isNow?Math.min(100,Math.round(((curMin-start)/s.duration)*100)):0;
  const [hov,setHov]=useState(false);
  return (
    <div onMouseEnter={()=>setHov(true)} onMouseLeave={()=>setHov(false)}
      style={{position:"relative",borderRadius:16,overflow:"hidden",
        background:hov?"rgba(255,255,255,.055)":"rgba(255,255,255,.03)",
        border:isNow?`1px solid ${c.color}30`:hov?"1px solid rgba(255,255,255,.12)":"1px solid rgba(255,255,255,.06)",
        transition:"all .2s",transform:hov?"translateY(-2px)":"none",
        boxShadow:isNow?`0 0 30px ${c.shadow}`:hov?"0 8px 32px rgba(0,0,0,.4)":"none",
        opacity:!s.enabled?.4:isPast?.6:1,
        animation:"cardIn .35s cubic-bezier(.4,0,.2,1) both",animationDelay:`${idx*.06}s`}}>
      <div style={{position:"absolute",left:0,top:0,bottom:0,width:3,
        background:s.enabled?c.color:"rgba(255,255,255,.1)",
        boxShadow:s.enabled&&isNow?`0 0 12px ${c.color}`:"none"}}/>
      {isNow&&<div style={{position:"absolute",bottom:0,left:0,right:0,height:2,background:"rgba(255,255,255,.06)"}}>
        <div style={{height:"100%",background:`linear-gradient(90deg,${c.color},${c.color}88)`,
          width:`${pct}%`,transition:"width 1s linear",boxShadow:`0 0 8px ${c.color}`}}/>
      </div>}
      <div style={{display:"flex",alignItems:"center",gap:12,padding:"15px 15px 15px 20px"}}>
        <div style={{textAlign:"center",minWidth:50}}>
          <div style={{fontFamily:"'DM Mono',monospace",fontSize:15,fontWeight:600,
            color:s.enabled?(isNow?c.color:"#E8ECF0"):"#3A4050",lineHeight:1}}>{s.time}</div>
          <div style={{fontSize:10,color:"#3A4050",marginTop:2}}>{s.duration}m</div>
        </div>
        <div style={{width:42,height:42,borderRadius:13,flexShrink:0,background:`${c.color}15`,
          border:`1px solid ${c.color}25`,display:"flex",alignItems:"center",justifyContent:"center",
          fontSize:20,boxShadow:isNow?`0 0 16px ${c.shadow}`:"none"}}>{c.icon}</div>
        <div style={{flex:1,minWidth:0}}>
          <div style={{display:"flex",alignItems:"center",gap:7,marginBottom:4}}>
            <span style={{fontWeight:700,fontSize:14,color:"#E8ECF0",overflow:"hidden",
              textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{s.name}</span>
            {isNow&&<span style={{fontSize:9,fontWeight:800,letterSpacing:".08em",
              background:`${c.color}20`,color:c.color,padding:"3px 7px",borderRadius:6,
              flexShrink:0,boxShadow:`0 0 12px ${c.shadow}`}}>LIVE</span>}
          </div>
          <span style={{display:"inline-flex",alignItems:"center",gap:4,fontSize:10,fontWeight:600,
            color:c.color,background:`${c.color}12`,padding:"2px 9px",borderRadius:20,
            border:`1px solid ${c.color}20`}}>{c.label}</span>
        </div>
        <div style={{display:"flex",alignItems:"center",gap:6,flexShrink:0}}>
          <Toggle checked={s.enabled} onChange={()=>onToggle(s.id)} color={c.color}/>
          <Btn icon="▶" onClick={()=>onTimer(s)} accent title="Mulai Timer"/>
          <Btn icon="✏️" onClick={()=>onEdit(s)}/>
          <Btn icon="🗑️" onClick={()=>onDelete(s.id)} danger/>
        </div>
      </div>
    </div>
  );
}

// ── CHECKPOINT CARD ───────────────────────────────────────────────────────────
function CheckpointCard({cp,date,onToggleDone,onEdit,onDelete,onTimer,idx}) {
  const c=getCat(cp.category);
  const done=cp.completedDates.includes(date);
  const totalDays=daysBetween(cp.startDate,cp.endDate||cp.startDate)+1;
  const dayNum=daysBetween(cp.startDate,date)+1;
  const completedCount=cp.completedDates.filter(d=>d>=cp.startDate&&d<=(cp.endDate||cp.startDate)).length;
  const isMulti=totalDays>1;
  const [hov,setHov]=useState(false);
  return (
    <div onMouseEnter={()=>setHov(true)} onMouseLeave={()=>setHov(false)}
      style={{position:"relative",borderRadius:16,overflow:"hidden",
        background:done?"rgba(34,212,122,.03)":hov?"rgba(255,255,255,.055)":"rgba(255,255,255,.03)",
        border:done?"1px solid rgba(34,212,122,.18)":hov?"1px solid rgba(255,255,255,.12)":"1px solid rgba(255,255,255,.06)",
        transition:"all .2s",transform:hov?"translateY(-2px)":"none",
        boxShadow:hov?"0 8px 32px rgba(0,0,0,.4)":"none",
        animation:"cardIn .35s cubic-bezier(.4,0,.2,1) both",animationDelay:`${idx*.06}s`}}>
      <div style={{position:"absolute",left:0,top:0,bottom:0,width:3,
        background:done?"#22D47A":c.color}}/>
      {isMulti&&<div style={{position:"absolute",bottom:0,left:0,right:0,height:2,background:"rgba(255,255,255,.04)"}}>
        <div style={{height:"100%",width:`${(completedCount/totalDays)*100}%`,
          background:c.color,transition:"width .5s"}}/>
      </div>}
      <div style={{display:"flex",alignItems:"center",gap:12,padding:"15px 15px 15px 20px"}}>
        <div onClick={()=>onToggleDone(cp.id,date)} style={{cursor:"pointer",flexShrink:0}}>
          <div style={{width:28,height:28,borderRadius:8,
            background:done?`${c.color}20`:"rgba(255,255,255,.05)",
            border:`2px solid ${done?c.color:"rgba(255,255,255,.15)"}`,
            display:"flex",alignItems:"center",justifyContent:"center",
            transition:"all .2s",boxShadow:done?`0 0 12px ${c.shadow}`:"none"}}>
            {done&&<span style={{fontSize:14,color:c.color}}>✓</span>}
          </div>
        </div>
        <div style={{textAlign:"center",minWidth:50}}>
          <div style={{fontFamily:"'DM Mono',monospace",fontSize:15,fontWeight:600,
            color:done?"#3A4050":"#E8ECF0",textDecoration:done?"line-through":"none",lineHeight:1}}>{cp.time}</div>
          <div style={{fontSize:10,color:"#3A4050",marginTop:2}}>{cp.duration}m</div>
        </div>
        <div style={{width:42,height:42,borderRadius:13,flexShrink:0,background:`${c.color}15`,
          border:`1px solid ${c.color}25`,display:"flex",alignItems:"center",justifyContent:"center",
          fontSize:20,opacity:done?.5:1}}>{c.icon}</div>
        <div style={{flex:1,minWidth:0}}>
          <div style={{display:"flex",alignItems:"center",gap:7,marginBottom:4,flexWrap:"wrap"}}>
            <span style={{fontWeight:700,fontSize:14,color:done?"#3A4050":"#E8ECF0",
              textDecoration:done?"line-through":"none",overflow:"hidden",
              textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{cp.name}</span>
            {isMulti&&<span style={{fontSize:10,fontWeight:700,letterSpacing:".04em",
              background:`${c.color}15`,color:c.color,padding:"2px 7px",borderRadius:6,flexShrink:0}}>
              H{dayNum}/{totalDays}</span>}
          </div>
          <div style={{display:"flex",gap:6,alignItems:"center",flexWrap:"wrap"}}>
            <span style={{display:"inline-flex",alignItems:"center",fontSize:10,fontWeight:600,
              color:c.color,background:`${c.color}12`,padding:"2px 9px",borderRadius:20,
              border:`1px solid ${c.color}20`}}>{c.label}</span>
            {isMulti&&<span style={{fontSize:10,color:"#2E3545",fontFamily:"'DM Mono',monospace"}}>
              {completedCount}/{totalDays} selesai</span>}
            {cp.note&&<span style={{fontSize:10,color:"#2E3545",overflow:"hidden",
              textOverflow:"ellipsis",whiteSpace:"nowrap",maxWidth:110}}>📝 {cp.note}</span>}
          </div>
        </div>
        <div style={{display:"flex",alignItems:"center",gap:6,flexShrink:0}}>
          {!done&&<Btn icon="▶" onClick={()=>onTimer(cp)} accent title="Mulai Timer"/>}
          <Btn icon="✏️" onClick={()=>onEdit(cp)}/>
          <Btn icon="🗑️" onClick={()=>onDelete(cp.id)} danger/>
        </div>
      </div>
    </div>
  );
}

// ── DATE STRIP ────────────────────────────────────────────────────────────────
function DateStrip({selected,onSelect,checkpoints}) {
  const todayKey=todayStr();
  const dates=useMemo(()=>Array.from({length:21},(_,i)=>addDays(todayKey,i-2)),[todayKey]);
  const ref=useRef(null);
  useEffect(()=>{ const el=ref.current?.querySelector('[data-today]'); el?.scrollIntoView({block:"nearest",inline:"center"}); },[]);
  return (
    <div ref={ref} style={{display:"flex",gap:6,overflowX:"auto",paddingBottom:6,scrollbarWidth:"none"}}>
      {dates.map(d=>{
        const isToday=d===todayStr(),isSel=d===selected;
        const count=checkpoints.filter(cp=>d>=(cp.startDate)&&d<=(cp.endDate||cp.startDate)).length;
        const dt=new Date(d+"T12:00:00");
        const dayN=["Min","Sen","Sel","Rab","Kam","Jum","Sab"][dt.getDay()];
        return (
          <div key={d} data-today={isToday||undefined} onClick={()=>onSelect(d)}
            style={{cursor:"pointer",flexShrink:0,width:52,borderRadius:14,padding:"10px 6px",
              textAlign:"center",transition:"all .2s",
              background:isSel?"linear-gradient(135deg,rgba(255,98,48,.22),rgba(255,59,26,.08))":isToday?"rgba(255,98,48,.06)":"rgba(255,255,255,.025)",
              border:`1px solid ${isSel?"rgba(255,98,48,.5)":isToday?"rgba(255,98,48,.15)":"rgba(255,255,255,.06)"}`,
              boxShadow:isSel?"0 0 20px rgba(255,98,48,.2)":"none"}}>
            <div style={{fontSize:10,fontWeight:700,color:isSel?"#FF6230":isToday?"#FF8560":"#3A4050",marginBottom:6}}>{dayN}</div>
            <div style={{fontSize:17,fontWeight:800,fontFamily:"'DM Mono',monospace",
              color:isSel?"#FF6230":isToday?"#E8ECF0":"#4A5568",lineHeight:1,marginBottom:6}}>{dt.getDate()}</div>
            {count>0
              ?<div style={{width:6,height:6,borderRadius:"50%",background:isSel?"#FF6230":"rgba(255,98,48,.4)",margin:"0 auto"}}/>
              :<div style={{width:6,height:6}}/>}
          </div>
        );
      })}
    </div>
  );
}

// ── FORM MODAL ────────────────────────────────────────────────────────────────
function Modal({form,setForm,onSubmit,onClose,isEdit,mode}) {
  const c=getCat(form.category);
  const isCP=mode==="checkpoint";
  return (
    <div style={{position:"fixed",inset:0,zIndex:150,display:"flex",alignItems:"center",
      justifyContent:"center",padding:20,background:"rgba(2,4,12,.82)",backdropFilter:"blur(16px)",
      animation:"fadeIn .2s ease"}} onClick={e=>e.target===e.currentTarget&&onClose()}>
      <div style={{width:"100%",maxWidth:480,borderRadius:24,background:"rgba(10,12,22,.97)",
        border:"1px solid rgba(255,255,255,.1)",boxShadow:"0 40px 80px rgba(0,0,0,.8)",
        animation:"slideUp .25s cubic-bezier(.4,0,.2,1)",overflow:"hidden",maxHeight:"90vh",overflowY:"auto"}}>
        <div style={{padding:"22px 24px 18px",background:`linear-gradient(135deg,${c.color}10,transparent)`,
          borderBottom:"1px solid rgba(255,255,255,.06)",position:"sticky",top:0,
          backdropFilter:"blur(20px)",zIndex:10}}>
          <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start"}}>
            <div>
              <div style={{display:"flex",alignItems:"center",gap:8,marginBottom:3}}>
                <span style={{fontSize:16}}>{isCP?"📅":"🏋️"}</span>
                <div style={{fontSize:18,fontWeight:800,color:"#F0F4FF",letterSpacing:"-.03em"}}>
                  {isEdit?(isCP?"Edit Checkpoint":"Edit Jadwal"):(isCP?"Checkpoint Baru":"Jadwal Mingguan")}
                </div>
              </div>
              <div style={{fontSize:12,color:"#3A4558"}}>{isCP?"Tanggal tertentu / rentang":"Berulang setiap minggu"}</div>
            </div>
            <button onClick={onClose} style={{width:34,height:34,borderRadius:10,
              border:"1px solid rgba(255,255,255,.08)",background:"rgba(255,255,255,.04)",
              color:"#6A7585",cursor:"pointer",fontSize:16,display:"flex",alignItems:"center",justifyContent:"center"}}>✕</button>
          </div>
        </div>
        <div style={{padding:"20px 24px 24px",display:"flex",flexDirection:"column",gap:14}}>
          <Inp label="NAMA LATIHAN" value={form.name} onChange={v=>setForm(f=>({...f,name:v}))} placeholder="cth: Push Day, Yoga Pagi…"/>
          {isCP?(
            <>
              <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:12}}>
                <Inp label="TANGGAL MULAI" type="date" value={form.startDate}
                  onChange={v=>setForm(f=>({...f,startDate:v,endDate:f.endDate&&f.endDate<v?v:f.endDate}))}/>
                <Inp label="TANGGAL SELESAI" type="date" value={form.endDate||form.startDate}
                  onChange={v=>setForm(f=>({...f,endDate:v>=f.startDate?v:f.startDate}))}/>
              </div>
              <div style={{fontSize:11,color:"#3A4558",background:"rgba(255,255,255,.03)",
                padding:"9px 13px",borderRadius:10,border:"1px solid rgba(255,255,255,.06)"}}>
                {form.endDate&&form.endDate!==form.startDate
                  ?`📅 Program ${daysBetween(form.startDate,form.endDate)+1} hari: ${fmtDate(form.startDate)} – ${fmtDate(form.endDate)}`
                  :`📅 Satu hari: ${fmtDate(form.startDate||todayStr())}`}
              </div>
            </>
          ):(
            <div>
              <label style={lblStyle}>HARI</label>
              <select value={form.day} onChange={e=>setForm(f=>({...f,day:e.target.value}))} style={inpStyle}>
                {DAYS_FULL.map(d=><option key={d} value={d} style={{background:"#0A0C16"}}>{d}</option>)}
              </select>
            </div>
          )}
          <Inp label="JAM MULAI" type="time" value={form.time} onChange={v=>setForm(f=>({...f,time:v}))}/>
          <div>
            <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:8}}>
              <label style={{...lblStyle,marginBottom:0}}>DURASI</label>
              <span style={{fontFamily:"'DM Mono',monospace",fontSize:12,fontWeight:600,color:c.color}}>
                {form.duration} menit
              </span>
            </div>
            <div style={{position:"relative",height:20,display:"flex",alignItems:"center"}}>
              <div style={{position:"absolute",left:0,right:0,height:4,borderRadius:4,background:"rgba(255,255,255,.06)"}}>
                <div style={{height:"100%",borderRadius:4,background:`linear-gradient(90deg,${c.color},${c.color}88)`,
                  width:`${((form.duration-5)/175)*100}%`,boxShadow:`0 0 8px ${c.color}`,transition:"width .15s"}}/>
              </div>
              <input type="range" min={5} max={180} step={5} value={form.duration}
                onChange={e=>setForm(f=>({...f,duration:+e.target.value}))}
                style={{position:"absolute",left:0,right:0,width:"100%",opacity:0,height:20,cursor:"pointer",margin:0}}/>
            </div>
            <div style={{display:"flex",justifyContent:"space-between",fontSize:10,
              color:"#2E3545",marginTop:3,fontFamily:"'DM Mono',monospace"}}>
              <span>5m</span><span>1j</span><span>3j</span>
            </div>
          </div>
          <div>
            <label style={lblStyle}>KATEGORI</label>
            <div style={{display:"flex",flexWrap:"wrap",gap:6}}>
              {CATS.map(cat=>(
                <div key={cat.id} onClick={()=>setForm(f=>({...f,category:cat.id}))}
                  style={{cursor:"pointer",padding:"7px 12px",borderRadius:10,fontSize:12,fontWeight:700,transition:"all .15s",
                    background:form.category===cat.id?`${cat.color}18`:"rgba(255,255,255,.04)",
                    border:`1px solid ${form.category===cat.id?cat.color+"50":"rgba(255,255,255,.07)"}`,
                    color:form.category===cat.id?cat.color:"#4A5568",
                    boxShadow:form.category===cat.id?`0 0 16px ${cat.shadow}`:"none",
                    transform:form.category===cat.id?"scale(1.04)":"scale(1)"}}>
                  {cat.icon} {cat.label}
                </div>
              ))}
            </div>
          </div>
          {isCP&&<Inp label="CATATAN (opsional)" value={form.note||""} onChange={v=>setForm(f=>({...f,note:v}))} placeholder="Target, tips, detail program…"/>}
          <div style={{display:"flex",gap:10,marginTop:4}}>
            <button onClick={onClose} style={{flex:1,padding:"12px",borderRadius:12,
              border:"1px solid rgba(255,255,255,.08)",background:"rgba(255,255,255,.04)",
              color:"#6A7585",cursor:"pointer",fontFamily:"'DM Sans',sans-serif",fontWeight:700,fontSize:14}}>Batal</button>
            <button onClick={onSubmit} style={{flex:2,padding:"12px",borderRadius:12,border:"none",
              background:`linear-gradient(135deg,${c.color},${c.color}CC)`,
              color:"#fff",cursor:"pointer",fontFamily:"'DM Sans',sans-serif",
              fontWeight:800,fontSize:14,boxShadow:`0 4px 20px ${c.shadow}`}}>
              {isEdit?"Simpan Perubahan":"+ Tambah"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

function Inp({label,value,onChange,type="text",placeholder}) {
  const [foc,setFoc]=useState(false);
  return (
    <div>
      {label&&<label style={lblStyle}>{label}</label>}
      <input type={type} value={value||""} placeholder={placeholder}
        onChange={e=>onChange(e.target.value)} onFocus={()=>setFoc(true)} onBlur={()=>setFoc(false)}
        style={{...inpStyle,borderColor:foc?"#FF6230":"rgba(255,255,255,.08)",
          boxShadow:foc?"0 0 0 3px rgba(255,98,48,.1)":"none",colorScheme:"dark"}}/>
    </div>
  );
}

const lblStyle={display:"block",fontSize:10,fontWeight:800,letterSpacing:".08em",color:"#3A4558",marginBottom:7};
const inpStyle={width:"100%",padding:"11px 14px",borderRadius:11,background:"rgba(255,255,255,.04)",
  border:"1px solid rgba(255,255,255,.08)",color:"#E8ECF0",fontFamily:"'DM Mono',monospace",
  fontSize:13,outline:"none",transition:"all .2s",boxSizing:"border-box"};

function Empty({type,onAdd}) {
  return (
    <div style={{textAlign:"center",padding:"70px 0",animation:"cardIn .4s ease both"}}>
      <div style={{fontSize:48,marginBottom:14,filter:"grayscale(1)",opacity:.25}}>{type==="checkpoint"?"📅":"🗓️"}</div>
      <div style={{fontWeight:800,fontSize:15,color:"#2E3545",marginBottom:8}}>
        {type==="checkpoint"?"Belum ada checkpoint di tanggal ini":"Belum ada jadwal di hari ini"}
      </div>
      <button onClick={onAdd} style={{marginTop:8,padding:"10px 20px",borderRadius:10,
        background:"rgba(255,98,48,.1)",border:"1px solid rgba(255,98,48,.2)",
        color:"#FF6230",cursor:"pointer",fontFamily:"'DM Sans',sans-serif",fontSize:13,fontWeight:700}}>
        + Tambah {type==="checkpoint"?"Checkpoint":"Jadwal"}
      </button>
    </div>
  );
}

// ══ MAIN APP ══════════════════════════════════════════════════════════════════
export default function App() {
  const [weekly,setWeekly]     = useLS("tp_weekly",DEF_WEEKLY);
  const [checkpts,setCheckpts] = useLS("tp_checkpts",makeCPDefs);
  const [now,setNow]           = useState(new Date());
  const [tab,setTab]           = useState("weekly");
  const [weekDay,setWeekDay]   = useState(JS_TO_DAY[new Date().getDay()]);
  const [cpDate,setCpDate]     = useState(todayStr());
  const [notifPerm,setNotifPerm]=useState(typeof Notification!=="undefined"?Notification.permission:"default");
  const [modal,setModal]       = useState(null);
  const [timerTarget,setTimerTarget]=useState(null);
  const [toast,setToast]       = useState(null);
  const [installPrompt,setInstallPrompt]=useState(null);
  const [showSettings,setShowSettings]=useState(false);
  const nextId=useRef(300);
  const notified=useRef(new Set());
  const toastTm=useRef(null);
  const importRef=useRef(null);

  // ── clock
  useEffect(()=>{ const t=setInterval(()=>setNow(new Date()),5000); return()=>clearInterval(t); },[]);

  // ── PWA install prompt
  useEffect(()=>{
    const handler=e=>{ e.preventDefault(); setInstallPrompt(e); };
    window.addEventListener("beforeinstallprompt",handler);
    return()=>window.removeEventListener("beforeinstallprompt",handler);
  },[]);

  // ── Service Worker registration
  useEffect(()=>{
    if("serviceWorker" in navigator){
      navigator.serviceWorker.register("/sw.js").catch(()=>{});
    }
  },[]);

  // ── notifications
  useEffect(()=>{
    if(notifPerm!=="granted")return;
    const today=JS_TO_DAY[now.getDay()],todayISO=todayStr();
    const curM=now.getHours()*60+now.getMinutes();
    weekly.forEach(s=>{
      if(!s.enabled||s.day!==today)return;
      const key=`w${s.id}-${now.toDateString()}`;
      if(Math.abs(toMin(s.time)-curM)<=2&&!notified.current.has(key)){
        notified.current.add(key);
        try{new Notification(`${getCat(s.category).icon} Waktunya: ${s.name}`,{body:`${s.time} · ${s.duration} menit`});}catch(_){}
      }
    });
    checkpts.forEach(cp=>{
      const end=cp.endDate||cp.startDate;
      if(todayISO<cp.startDate||todayISO>end)return;
      const key=`c${cp.id}-${now.toDateString()}`;
      if(Math.abs(toMin(cp.time)-curM)<=2&&!notified.current.has(key)){
        notified.current.add(key);
        const dn=daysBetween(cp.startDate,todayISO)+1,total=daysBetween(cp.startDate,end)+1;
        try{new Notification(`📅 Checkpoint: ${cp.name}`,{body:`${cp.time} · Hari ${dn}/${total}`});}catch(_){}
      }
    });
  },[now,weekly,checkpts,notifPerm]);

  useEffect(()=>()=>{ if(toastTm.current) clearTimeout(toastTm.current); },[]);
  const showToast=useCallback((msg,type="ok")=>{
    if(toastTm.current)clearTimeout(toastTm.current);
    setToast({msg,type});
    toastTm.current=setTimeout(()=>setToast(null),2800);
  },[]);

  // ── derived
  const today=JS_TO_DAY[now.getDay()],todayISO=todayStr();
  const curMin=now.getHours()*60+now.getMinutes();

  const activeWorkout=useMemo(()=>weekly.find(s=>s.enabled&&s.day===today&&curMin>=toMin(s.time)&&curMin<toMin(s.time)+s.duration),[weekly,today,curMin]);
  const upcomingWeekly=useMemo(()=>weekly.filter(s=>s.enabled&&s.day===today&&toMin(s.time)>curMin).sort((a,b)=>toMin(a.time)-toMin(b.time))[0],[weekly,today,curMin]);
  const todayCheckpoints=useMemo(()=>checkpts.filter(cp=>todayISO>=(cp.startDate)&&todayISO<=(cp.endDate||cp.startDate)).sort((a,b)=>toMin(a.time)-toMin(b.time)),[checkpts,todayISO]);
  const activeCPNow=useMemo(()=>todayCheckpoints.find(cp=>curMin>=toMin(cp.time)&&curMin<toMin(cp.time)+cp.duration),[todayCheckpoints,curMin]);
  const cpForDate=useMemo(()=>checkpts.filter(cp=>cpDate>=(cp.startDate)&&cpDate<=(cp.endDate||cp.startDate)).sort((a,b)=>toMin(a.time)-toMin(b.time)),[checkpts,cpDate]);
  const filteredWeekly=useMemo(()=>weekly.filter(s=>s.day===weekDay).sort((a,b)=>toMin(a.time)-toMin(b.time)),[weekly,weekDay]);

  // ── streak: consecutive days with ≥1 checkpoint done OR past day with weekly workout
  const streak=useMemo(()=>{
    const cpDoneSet=new Set(checkpts.flatMap(cp=>cp.completedDates));
    const weeklyDays=new Set(weekly.filter(s=>s.enabled).map(s=>s.day));
    const isStreakDay=d=>{
      if(cpDoneSet.has(d)) return true;
      if(d>=todayISO) return false; // only count past days for weekly
      const dayName=JS_TO_DAY[new Date(d+"T12:00:00").getDay()];
      return weeklyDays.has(dayName);
    };
    let count=0, d=todayISO;
    while(isStreakDay(d)){ count++; d=addDays(d,-1); }
    return count;
  },[checkpts,weekly,todayISO]);

  const weekStats=useMemo(()=>({
    sessions:weekly.filter(s=>s.enabled).length,
    minutes:weekly.filter(s=>s.enabled).reduce((a,s)=>a+s.duration,0),
    todayMin:weekly.filter(s=>s.enabled&&s.day===today).reduce((a,s)=>a+s.duration,0),
    cpTotal:checkpts.length,
    cpDone:checkpts.reduce((a,cp)=>a+cp.completedDates.length,0),
  }),[weekly,checkpts,today]);

  // ── export / import
  const exportData=()=>{
    const data={weekly,checkpts,exportedAt:new Date().toISOString(),version:2};
    const blob=new Blob([JSON.stringify(data,null,2)],{type:"application/json"});
    const url=URL.createObjectURL(blob);
    const a=document.createElement("a");
    a.href=url; a.download=`trainplan-backup-${todayISO}.json`; a.click();
    URL.revokeObjectURL(url);
    showToast("Data diekspor! 📤");
  };
  const importData=e=>{
    const file=e.target.files[0]; if(!file)return;
    if(!file.name.endsWith(".json"))return showToast("Harus file .json!","err");
    const reader=new FileReader();
    reader.onload=ev=>{
      try{
        const data=JSON.parse(ev.target.result);
        // validate schema
        const validWeekly = Array.isArray(data.weekly) &&
          data.weekly.every(s=>s.id&&s.day&&s.time&&s.name&&typeof s.duration==="number");
        const validCP = Array.isArray(data.checkpts) &&
          data.checkpts.every(c=>c.id&&c.startDate&&c.time&&c.name&&Array.isArray(c.completedDates));
        if(!validWeekly&&!validCP) return showToast("Format file tidak valid!","err");
        if(validWeekly) setWeekly(data.weekly);
        if(validCP) setCheckpts(data.checkpts);
        showToast(`Import berhasil! ${validWeekly?data.weekly.length+" jadwal":""}${validWeekly&&validCP?", ":""}${validCP?data.checkpts.length+" checkpoint":""} 📥`);
      }catch{ showToast("File rusak atau tidak valid!","err"); }
    };
    reader.readAsText(file);
    e.target.value="";
  };
  const installPWA=async()=>{
    if(!installPrompt)return;
    installPrompt.prompt();
    const{outcome}=await installPrompt.userChoice;
    if(outcome==="accepted"){ setInstallPrompt(null); showToast("TrainPlan terinstal! 🎉"); }
  };

  // ── modal helpers
  const openAdd=mode=>{
    const base=mode==="checkpoint"
      ?{name:"",startDate:cpDate,endDate:cpDate,time:"07:00",duration:30,category:"cardio",note:"",completedDates:[]}
      :{name:"",day:weekDay,time:"07:00",duration:30,category:"cardio",enabled:true};
    setModal({mode,form:base,editId:null});
  };
  const openEdit=(mode,item)=>setModal({mode,form:{...item},editId:item.id});
  const closeModal=()=>setModal(null);
  const handleSubmit=()=>{
    const{mode,form,editId}=modal;
    if(!form.name.trim())return showToast("Nama wajib diisi! ⚠️","err");
    if(mode==="weekly"){
      editId!=null?setWeekly(p=>p.map(s=>s.id===editId?{...form,id:editId}:s)):setWeekly(p=>[...p,{...form,id:nextId.current++}]);
      showToast(editId!=null?"Jadwal diperbarui ✅":"Jadwal ditambahkan 🎉");
    }else{
      const cp={...form,endDate:form.endDate||form.startDate,completedDates:form.completedDates||[]};
      editId!=null?setCheckpts(p=>p.map(c=>c.id===editId?{...cp,id:editId}:c)):setCheckpts(p=>[...p,{...cp,id:nextId.current++}]);
      showToast(editId!=null?"Checkpoint diperbarui ✅":"Checkpoint ditambahkan 📅");
    }
    closeModal();
  };
  const toggleDone=(id,date)=>setCheckpts(p=>p.map(cp=>{
    if(cp.id!==id)return cp;
    const done=cp.completedDates.includes(date);
    const next=done?cp.completedDates.filter(d=>d!==date):[...cp.completedDates,date].sort();
    if(!done) showToast("Checkpoint selesai! ✅");
    return {...cp,completedDates:next};
  }));
  const deleteWeekly=id=>{setWeekly(p=>p.filter(s=>s.id!==id));showToast("Dihapus 🗑️","err");};
  const deleteCP=id=>{setCheckpts(p=>p.filter(c=>c.id!==id));showToast("Dihapus 🗑️","err");};
  const requestNotif=async()=>{
    const p=await Notification.requestPermission();
    setNotifPerm(p);
    showToast(p==="granted"?"Notifikasi aktif! 🔔":"Diblokir 😔",p==="granted"?"ok":"err");
  };

  const activeCat=activeWorkout?getCat(activeWorkout.category):null;
  const activeCPCat=activeCPNow?getCat(activeCPNow.category):null;
  const activePct=activeWorkout?Math.min(100,Math.round(((curMin-toMin(activeWorkout.time))/activeWorkout.duration)*100)):0;
  const activeCPPct=activeCPNow?Math.min(100,Math.round(((curMin-toMin(activeCPNow.time))/activeCPNow.duration)*100)):0;
  const cpDateLabel=cpDate===todayISO?"Hari Ini":cpDate===addDays(todayISO,1)?"Besok":fmtDate(cpDate);

  return (
    <div style={{minHeight:"100vh",background:"#04050E",fontFamily:"'DM Sans',sans-serif",
      color:"#E8ECF0",position:"relative",overflowX:"hidden"}}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;600;700;800&family=DM+Mono:wght@400;500;600&display=swap');
        *{box-sizing:border-box;margin:0;padding:0;}
        ::-webkit-scrollbar{width:4px;height:4px;}::-webkit-scrollbar-thumb{background:#1A2030;border-radius:4px;}
        input[type=date]::-webkit-calendar-picker-indicator,input[type=time]::-webkit-calendar-picker-indicator{filter:invert(.4);cursor:pointer;}
        @keyframes cardIn{from{opacity:0;transform:translateY(12px)}to{opacity:1;transform:none}}
        @keyframes fadeIn{from{opacity:0}to{opacity:1}}
        @keyframes slideUp{from{opacity:0;transform:translateY(20px)}to{opacity:1;transform:none}}
        @keyframes toastPop{from{opacity:0;transform:translateX(-50%) translateY(12px)}to{opacity:1;transform:translateX(-50%) translateY(0)}}
        @keyframes pulse{0%,100%{opacity:1;transform:scale(1)}50%{opacity:.5;transform:scale(.8)}}
        @keyframes orb1{0%,100%{transform:translate(0,0)}50%{transform:translate(50px,-40px)}}
        @keyframes orb2{0%,100%{transform:translate(0,0)}50%{transform:translate(-40px,50px)}}
        @keyframes settingsIn{from{opacity:0;transform:translateY(-8px)}to{opacity:1;transform:none}}
      `}</style>

      {/* BG */}
      <div style={{position:"fixed",inset:0,pointerEvents:"none",overflow:"hidden",zIndex:0}}>
        <div style={{position:"absolute",top:-200,right:-100,width:600,height:600,borderRadius:"50%",
          background:"radial-gradient(circle,rgba(255,98,48,.07),transparent 70%)",animation:"orb1 14s ease-in-out infinite"}}/>
        <div style={{position:"absolute",bottom:-100,left:-150,width:500,height:500,borderRadius:"50%",
          background:"radial-gradient(circle,rgba(77,138,255,.05),transparent 70%)",animation:"orb2 18s ease-in-out infinite"}}/>
        <svg style={{position:"absolute",inset:0,width:"100%",height:"100%",opacity:.025}}>
          <filter id="n"><feTurbulence type="fractalNoise" baseFrequency=".65" numOctaves="4" stitchTiles="stitch"/></filter>
          <rect width="100%" height="100%" filter="url(#n)"/>
        </svg>
        <svg style={{position:"absolute",inset:0,width:"100%",height:"100%",opacity:.02}}>
          <defs><pattern id="g" width="40" height="40" patternUnits="userSpaceOnUse">
            <path d="M40 0L0 0 0 40" fill="none" stroke="white" strokeWidth="1"/></pattern></defs>
          <rect width="100%" height="100%" fill="url(#g)"/>
        </svg>
      </div>

      <div style={{maxWidth:740,margin:"0 auto",padding:"0 20px 80px",position:"relative",zIndex:1}}>

        {/* ── HEADER */}
        <div style={{padding:"28px 0 22px",animation:"cardIn .4s ease both"}}>
          <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start"}}>
            <div>
              <div style={{display:"flex",alignItems:"center",gap:10,marginBottom:6}}>
                <div style={{width:38,height:38,borderRadius:12,
                  background:"linear-gradient(135deg,#FF6230,#FF3B1A)",
                  display:"flex",alignItems:"center",justifyContent:"center",
                  fontSize:20,boxShadow:"0 0 20px rgba(255,98,48,.4)"}}>🏋️</div>
                <span style={{fontSize:26,fontWeight:800,letterSpacing:"-.04em",
                  background:"linear-gradient(135deg,#F0F4FF,#8899B0)",
                  WebkitBackgroundClip:"text",WebkitTextFillColor:"transparent"}}>TrainPlan</span>
              </div>
              <div style={{display:"flex",alignItems:"center",gap:8,marginLeft:2}}>
                <div style={{width:6,height:6,borderRadius:"50%",background:"#22D47A",animation:"pulse 1.8s infinite"}}/>
                <span style={{fontFamily:"'DM Mono',monospace",fontSize:12,color:"#3A4558"}}>
                  {pad(now.getHours())}:{pad(now.getMinutes())} · {today}
                </span>
              </div>
            </div>
            <div style={{display:"flex",gap:6,alignItems:"center",position:"relative"}}>
              {/* Settings */}
              <div style={{position:"relative"}}>
                <button onClick={()=>setShowSettings(s=>!s)}
                  style={{padding:"9px 11px",borderRadius:10,background:showSettings?"rgba(255,255,255,.1)":"rgba(255,255,255,.04)",
                    border:"1px solid rgba(255,255,255,.08)",color:"#6A7585",cursor:"pointer",fontSize:16,
                    transition:"all .15s"}}>⚙️</button>
                {showSettings&&(
                  <div style={{position:"absolute",top:"calc(100% + 8px)",right:0,width:220,
                    background:"rgba(10,12,22,.98)",border:"1px solid rgba(255,255,255,.1)",
                    borderRadius:16,padding:8,zIndex:50,boxShadow:"0 16px 48px rgba(0,0,0,.6)",
                    animation:"settingsIn .2s ease"}}>
                    {[
                      notifPerm==="granted"
                        ?{label:"🔔 Notif Aktif",action:null,dim:true}
                        :{label:"🔔 Aktifkan Notif",action:requestNotif},
                      {label:"📤 Export Data",action:exportData},
                      {label:"📥 Import Data",action:()=>importRef.current?.click()},
                      installPrompt&&{label:"📲 Install App",action:installPWA},
                    ].filter(Boolean).map((item,i)=>(
                      <button key={i} onClick={()=>{if(item.action){item.action();setShowSettings(false);}}}
                        style={{width:"100%",padding:"11px 14px",borderRadius:10,border:"none",
                          background:"transparent",color:item.dim?"#3A4558":"#B0BAC8",cursor:item.action?"pointer":"default",
                          fontFamily:"'DM Sans',sans-serif",fontSize:13,fontWeight:600,
                          textAlign:"left",transition:"background .15s"}}
                        onMouseEnter={e=>item.action&&(e.currentTarget.style.background="rgba(255,255,255,.06)")}
                        onMouseLeave={e=>e.currentTarget.style.background="transparent"}>
                        {item.label}
                      </button>
                    ))}
                  </div>
                )}
              </div>
              <input ref={importRef} type="file" accept=".json" onChange={importData} style={{display:"none"}}/>
              <button onClick={()=>openAdd(tab==="checkpoint"?"checkpoint":"weekly")}
                style={{padding:"9px 18px",borderRadius:10,
                  background:"linear-gradient(135deg,#FF6230,#FF3B1A)",border:"none",
                  color:"#fff",cursor:"pointer",fontFamily:"'DM Sans',sans-serif",
                  fontSize:13,fontWeight:800,boxShadow:"0 4px 16px rgba(255,98,48,.35)"}}>
                + Tambah
              </button>
            </div>
          </div>
        </div>
        {showSettings&&<div style={{position:"fixed",inset:0,zIndex:40}} onClick={()=>setShowSettings(false)}/>}

        {/* ── HERO */}
        <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:14,marginBottom:18,
          animation:"cardIn .4s ease both",animationDelay:".05s"}}>
          <div style={{borderRadius:20,padding:"20px",position:"relative",overflow:"hidden",
            background:activeWorkout?`${activeCat.color}0A`:"rgba(255,255,255,.025)",
            border:`1px solid ${activeWorkout?activeCat.color+"30":"rgba(255,255,255,.06)"}`,
            boxShadow:activeWorkout?`0 0 40px ${activeCat.shadow}`:"none",transition:"all .4s"}}>
            <div style={{fontSize:10,fontWeight:800,letterSpacing:".1em",
              color:activeWorkout?activeCat.color:"#2E3545",marginBottom:12,
              display:"flex",alignItems:"center",gap:6}}>
              {activeWorkout&&<span style={{width:6,height:6,borderRadius:"50%",display:"inline-block",
                background:activeCat.color,animation:"pulse 1.5s infinite"}}/>}
              {activeWorkout?"LIVE SEKARANG":"JADWAL HARIAN"}
            </div>
            {activeWorkout?(
              <div style={{display:"flex",gap:12,alignItems:"center"}}>
                <div style={{position:"relative",flexShrink:0,cursor:"pointer"}}
                  onClick={()=>setTimerTarget({...activeWorkout})}>
                  <Ring pct={activePct} color={activeCat.color} size={76} stroke={6}/>
                  <div style={{position:"absolute",inset:0,display:"flex",alignItems:"center",justifyContent:"center"}}>
                    <span style={{fontFamily:"'DM Mono',monospace",fontSize:13,fontWeight:700,color:activeCat.color}}>
                      {activePct}%
                    </span>
                  </div>
                </div>
                <div>
                  <div style={{fontWeight:800,fontSize:15,color:"#F0F4FF",marginBottom:3}}>{activeWorkout.name}</div>
                  <div style={{fontFamily:"'DM Mono',monospace",fontSize:11,color:"#4A5568"}}>{activeWorkout.time} · {activeWorkout.duration}m</div>
                  <div style={{fontSize:11,color:"#3A4558",marginTop:3}}>
                    Sisa ≈{Math.max(0,activeWorkout.duration-(curMin-toMin(activeWorkout.time)))}m
                  </div>
                </div>
              </div>
            ):(
              <div>
                {upcomingWeekly?(
                  <>
                    <div style={{fontWeight:800,fontSize:14,color:"#F0F4FF",marginBottom:3}}>{upcomingWeekly.name}</div>
                    <div style={{fontFamily:"'DM Mono',monospace",fontSize:11,color:"#4A5568"}}>{upcomingWeekly.time}</div>
                    <div style={{fontSize:11,color:"#F0B42988",marginTop:5,fontWeight:600}}>
                      ⏱ {toMin(upcomingWeekly.time)-curMin}m lagi
                    </div>
                  </>
                ):(
                  <div style={{fontFamily:"'DM Mono',monospace",fontSize:22,color:"#1A2030",fontWeight:600}}>
                    {pad(now.getHours())}:{pad(now.getMinutes())}
                    <div style={{fontSize:12,fontFamily:"'DM Sans',sans-serif",color:"#1E2535",marginTop:6}}>Selesai hari ini 🎉</div>
                  </div>
                )}
              </div>
            )}
          </div>

          <div style={{borderRadius:20,padding:"20px",position:"relative",overflow:"hidden",
            background:activeCPNow?`${activeCPCat.color}0A`:"rgba(255,255,255,.025)",
            border:`1px solid ${activeCPNow?activeCPCat.color+"30":"rgba(255,255,255,.06)"}`,
            boxShadow:activeCPNow?`0 0 40px ${activeCPCat.shadow}`:"none",transition:"all .4s"}}>
            <div style={{fontSize:10,fontWeight:800,letterSpacing:".1em",
              color:activeCPNow?activeCPCat.color:"#2E3545",marginBottom:12,
              display:"flex",alignItems:"center",gap:6}}>
              {activeCPNow&&<span style={{width:6,height:6,borderRadius:"50%",display:"inline-block",
                background:activeCPCat.color,animation:"pulse 1.5s infinite"}}/>}
              {activeCPNow?"CHECKPOINT LIVE":"CHECKPOINT HARI INI"}
            </div>
            {activeCPNow?(
              <div style={{display:"flex",gap:12,alignItems:"center"}}>
                <div style={{position:"relative",flexShrink:0,cursor:"pointer"}}
                  onClick={()=>setTimerTarget({...activeCPNow})}>
                  <Ring pct={activeCPPct} color={activeCPCat.color} size={76} stroke={6}/>
                  <div style={{position:"absolute",inset:0,display:"flex",alignItems:"center",justifyContent:"center"}}>
                    <span style={{fontFamily:"'DM Mono',monospace",fontSize:13,fontWeight:700,color:activeCPCat.color}}>
                      {activeCPPct}%
                    </span>
                  </div>
                </div>
                <div>
                  <div style={{fontWeight:800,fontSize:15,color:"#F0F4FF",marginBottom:3}}>{activeCPNow.name}</div>
                  <div style={{fontFamily:"'DM Mono',monospace",fontSize:11,color:"#4A5568"}}>{activeCPNow.time}</div>
                </div>
              </div>
            ):(
              <div>
                {todayCheckpoints.length>0?(
                  <>
                    <div style={{fontSize:12,fontWeight:700,color:"#4A5568",marginBottom:8}}>
                      {todayCheckpoints.length} sesi terjadwal
                    </div>
                    {todayCheckpoints.slice(0,2).map(cp=>(
                      <div key={cp.id} style={{display:"flex",alignItems:"center",gap:7,marginBottom:4}}>
                        <span style={{fontSize:13}}>{getCat(cp.category).icon}</span>
                        <span style={{fontSize:12,color:"#3A4558",fontWeight:600,
                          textDecoration:cp.completedDates.includes(todayISO)?"line-through":"none"}}>
                          {cp.time} {cp.name}
                        </span>
                        {cp.completedDates.includes(todayISO)&&<span style={{fontSize:12,color:"#22D47A"}}>✓</span>}
                      </div>
                    ))}
                  </>
                ):(
                  <div style={{fontSize:14,color:"#1E2535",fontWeight:600}}>📅 Tidak ada checkpoint</div>
                )}
              </div>
            )}
          </div>
        </div>

        {/* ── STATS */}
        <div style={{display:"grid",gridTemplateColumns:"repeat(5,1fr)",gap:8,marginBottom:22,
          animation:"cardIn .45s ease both",animationDelay:".08s"}}>
          {[
            {label:"Jadwal",     value:weekStats.sessions,  color:"#FF6230", icon:"📋"},
            {label:"Mnt/Minggu", value:weekStats.minutes,   color:"#4D8AFF", icon:"⏱"},
            {label:"Hari Ini",   value:weekStats.todayMin+"m",color:"#22D47A",icon:"🗓"},
            {label:"Checkpoint", value:weekStats.cpTotal,   color:"#BF7EF7", icon:"📅"},
            {label:"🔥 Streak (hari)", value:streak||"-",   color:"#F0B429", icon:""},
          ].map(s=>(
            <div key={s.label} style={{borderRadius:14,background:"rgba(255,255,255,.025)",
              border:"1px solid rgba(255,255,255,.06)",padding:"14px 8px",textAlign:"center"}}>
              <div style={{fontFamily:"'DM Mono',monospace",fontSize:20,fontWeight:700,
                color:s.color,lineHeight:1,marginBottom:4}}>{s.value}</div>
              <div style={{fontSize:9,color:"#2E3545",fontWeight:700,letterSpacing:".04em"}}>{s.label}</div>
            </div>
          ))}
        </div>

        {/* ── TABS */}
        <div style={{display:"flex",gap:4,background:"rgba(255,255,255,.03)",
          border:"1px solid rgba(255,255,255,.06)",borderRadius:14,
          padding:4,marginBottom:20,animation:"cardIn .5s ease both",animationDelay:".1s"}}>
          {[["weekly","🔄 Jadwal Mingguan"],["checkpoint","📅 Checkpoint"]].map(([v,lbl])=>(
            <button key={v} onClick={()=>setTab(v)} style={{flex:1,padding:"10px",borderRadius:10,
              border:"none",cursor:"pointer",fontFamily:"'DM Sans',sans-serif",fontSize:13,fontWeight:700,
              background:tab===v?"rgba(255,255,255,.1)":"transparent",
              color:tab===v?"#E8ECF0":"#3A4558",transition:"all .2s"}}>
              {lbl}
            </button>
          ))}
        </div>

        {/* ═══ WEEKLY TAB ═══ */}
        {tab==="weekly"&&(
          <div style={{animation:"cardIn .3s ease both"}}>
            <div style={{display:"flex",gap:6,overflowX:"auto",paddingBottom:4,marginBottom:16,scrollbarWidth:"none"}}>
              {DAYS_FULL.map(d=>{
                const count=weekly.filter(s=>s.day===d&&s.enabled).length;
                const isSel=d===weekDay,isToday=d===today;
                return (
                  <div key={d} onClick={()=>setWeekDay(d)} style={{cursor:"pointer",padding:"9px 16px",
                    borderRadius:11,whiteSpace:"nowrap",fontSize:13,fontWeight:700,transition:"all .2s",
                    background:isSel?"linear-gradient(135deg,rgba(255,98,48,.2),rgba(255,59,26,.1))":isToday?"rgba(255,98,48,.06)":"rgba(255,255,255,.03)",
                    border:`1px solid ${isSel?"rgba(255,98,48,.4)":isToday?"rgba(255,98,48,.15)":"rgba(255,255,255,.06)"}`,
                    color:isSel?"#FF6230":isToday?"#FF8560":"#3A4558",
                    boxShadow:isSel?"0 0 20px rgba(255,98,48,.2)":"none",flexShrink:0}}>
                    {d}{count>0&&<span style={{marginLeft:6,fontSize:10,
                      background:isSel?"rgba(255,98,48,.2)":"rgba(255,255,255,.06)",
                      color:isSel?"#FF6230":"#2E3545",padding:"1px 7px",borderRadius:10}}>{count}</span>}
                  </div>
                );
              })}
            </div>
            {filteredWeekly.length===0
              ?<Empty type="weekly" onAdd={()=>openAdd("weekly")}/>
              :<div style={{display:"flex",flexDirection:"column",gap:10}}>
                {filteredWeekly.map((s,i)=>(
                  <WeeklyCard key={s.id} s={s} idx={i}
                    onEdit={s=>openEdit("weekly",s)} onDelete={deleteWeekly}
                    onToggle={id=>setWeekly(p=>p.map(x=>x.id===id?{...x,enabled:!x.enabled}:x))}
                    onTimer={s=>setTimerTarget({...s})} today={today} curMin={curMin}/>
                ))}
              </div>}
          </div>
        )}

        {/* ═══ CHECKPOINT TAB ═══ */}
        {tab==="checkpoint"&&(
          <div style={{animation:"cardIn .3s ease both"}}>
            <div style={{marginBottom:20}}><DateStrip selected={cpDate} onSelect={setCpDate} checkpoints={checkpts}/></div>
            <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:14}}>
              <div>
                <span style={{fontSize:16,fontWeight:800,color:"#F0F4FF",letterSpacing:"-.02em"}}>{cpDateLabel}</span>
                {cpDate===todayISO&&<span style={{marginLeft:8,fontSize:10,fontWeight:800,
                  color:"#FF6230",background:"rgba(255,98,48,.1)",padding:"2px 8px",
                  borderRadius:6,border:"1px solid rgba(255,98,48,.2)",letterSpacing:".06em"}}>TODAY</span>}
              </div>
              <div style={{fontSize:12,color:"#2E3545",fontFamily:"'DM Mono',monospace"}}>
                {cpForDate.length} sesi · {cpForDate.reduce((a,c)=>a+c.duration,0)}m
              </div>
            </div>
            {cpForDate.length>0&&(()=>{
              const done=cpForDate.filter(c=>c.completedDates.includes(cpDate)).length;
              const pct=Math.round((done/cpForDate.length)*100);
              return (
                <div style={{borderRadius:14,background:"rgba(255,255,255,.025)",
                  border:"1px solid rgba(255,255,255,.06)",padding:"14px 18px",marginBottom:14}}>
                  <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:8}}>
                    <span style={{fontSize:12,fontWeight:700,color:"#4A5568"}}>Progress {cpDateLabel}</span>
                    <span style={{fontFamily:"'DM Mono',monospace",fontSize:13,fontWeight:700,
                      color:pct===100?"#22D47A":"#FF6230"}}>{done}/{cpForDate.length} · {pct}%</span>
                  </div>
                  <div style={{height:6,borderRadius:6,background:"rgba(255,255,255,.06)",overflow:"hidden"}}>
                    <div style={{height:"100%",borderRadius:6,
                      background:pct===100?"linear-gradient(90deg,#22D47A,#22D47A88)":"linear-gradient(90deg,#FF6230,#FF6230AA)",
                      width:`${pct}%`,transition:"width .5s cubic-bezier(.4,0,.2,1)",
                      boxShadow:pct===100?"0 0 12px rgba(34,212,122,.4)":"0 0 12px rgba(255,98,48,.4)"}}/>
                  </div>
                  {pct===100&&<div style={{fontSize:12,color:"#22D47A",marginTop:8,fontWeight:700}}>🎉 Semua selesai! Mantap!</div>}
                </div>
              );
            })()}
            {cpForDate.length===0
              ?<Empty type="checkpoint" onAdd={()=>openAdd("checkpoint")}/>
              :<div style={{display:"flex",flexDirection:"column",gap:10}}>
                {cpForDate.map((cp,i)=>(
                  <CheckpointCard key={cp.id} cp={cp} date={cpDate} idx={i}
                    onToggleDone={toggleDone} onEdit={cp=>openEdit("checkpoint",cp)}
                    onDelete={deleteCP} onTimer={cp=>setTimerTarget({...cp})}/>
                ))}
              </div>}

            {checkpts.length>0&&(
              <div style={{marginTop:28}}>
                <div style={{fontSize:11,fontWeight:800,letterSpacing:".08em",color:"#2E3545",marginBottom:12}}>SEMUA PROGRAM</div>
                <div style={{display:"flex",flexDirection:"column",gap:8}}>
                  {checkpts.map(cp=>{
                    const c=getCat(cp.category);
                    const total=daysBetween(cp.startDate,cp.endDate||cp.startDate)+1;
                    const done=cp.completedDates.length;
                    const pct=Math.round((done/total)*100);
                    const isActive=todayISO>=cp.startDate&&todayISO<=(cp.endDate||cp.startDate);
                    const isDone=pct>=100;
                    return (
                      <div key={cp.id} onClick={()=>{setCpDate(cp.startDate);}}
                        style={{cursor:"pointer",borderRadius:14,padding:"14px 16px",
                          background:"rgba(255,255,255,.025)",
                          border:`1px solid ${isActive?c.color+"25":isDone?"rgba(34,212,122,.15)":"rgba(255,255,255,.06)"}`,
                          display:"flex",alignItems:"center",gap:14,transition:"all .2s"}}
                        onMouseEnter={e=>e.currentTarget.style.background="rgba(255,255,255,.04)"}
                        onMouseLeave={e=>e.currentTarget.style.background="rgba(255,255,255,.025)"}>
                        <div style={{width:38,height:38,borderRadius:11,flexShrink:0,
                          background:`${c.color}15`,border:`1px solid ${c.color}25`,
                          display:"flex",alignItems:"center",justifyContent:"center",fontSize:20}}>{c.icon}</div>
                        <div style={{flex:1,minWidth:0}}>
                          <div style={{display:"flex",alignItems:"center",gap:8,marginBottom:4}}>
                            <span style={{fontWeight:700,fontSize:14,color:"#E8ECF0",
                              overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{cp.name}</span>
                            {isActive&&<span style={{fontSize:9,fontWeight:800,letterSpacing:".06em",
                              color:c.color,background:`${c.color}15`,padding:"2px 6px",borderRadius:5,flexShrink:0}}>AKTIF</span>}
                            {isDone&&<span style={{fontSize:9,fontWeight:800,color:"#22D47A",
                              background:"rgba(34,212,122,.12)",padding:"2px 6px",borderRadius:5,flexShrink:0}}>SELESAI ✓</span>}
                          </div>
                          <div style={{fontSize:11,color:"#3A4558",fontFamily:"'DM Mono',monospace",marginBottom:6}}>
                            {fmtDate(cp.startDate)}{cp.endDate&&cp.endDate!==cp.startDate?` – ${fmtDate(cp.endDate)}`:""} · {total}h
                          </div>
                          <div style={{height:3,borderRadius:3,background:"rgba(255,255,255,.06)",overflow:"hidden"}}>
                            <div style={{height:"100%",borderRadius:3,
                              background:isDone?"#22D47A":c.color,width:`${pct}%`,transition:"width .5s"}}/>
                          </div>
                        </div>
                        <div style={{textAlign:"center",flexShrink:0}}>
                          <div style={{fontFamily:"'DM Mono',monospace",fontSize:16,fontWeight:700,
                            color:isDone?"#22D47A":c.color}}>{pct}%</div>
                          <div style={{fontSize:10,color:"#2E3545"}}>{done}/{total}</div>
                        </div>
                        <div style={{display:"flex",gap:6,flexShrink:0}}>
                          <Btn icon="✏️" onClick={e=>{e.stopPropagation();openEdit("checkpoint",cp)}}/>
                          <Btn icon="🗑️" onClick={e=>{e.stopPropagation();deleteCP(cp.id)}} danger/>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {modal&&<Modal form={modal.form} setForm={f=>setModal(m=>({...m,form:typeof f==="function"?f(m.form):f}))}
        onSubmit={handleSubmit} onClose={closeModal} isEdit={modal.editId!=null} mode={modal.mode}/>}
      {timerTarget&&<TimerModal target={timerTarget} onClose={()=>setTimerTarget(null)}/>}
      {toast&&(
        <div style={{position:"fixed",bottom:28,left:"50%",animation:"toastPop .25s cubic-bezier(.4,0,.2,1)",zIndex:300,
          background:toast.type==="err"?"rgba(255,51,84,.12)":"rgba(34,212,122,.1)",
          border:`1px solid ${toast.type==="err"?"rgba(255,51,84,.3)":"rgba(34,212,122,.25)"}`,
          color:toast.type==="err"?"#FF3354":"#22D47A",backdropFilter:"blur(16px)",
          padding:"12px 22px",borderRadius:14,fontSize:13,fontWeight:700,
          whiteSpace:"nowrap",boxShadow:"0 8px 32px rgba(0,0,0,.5)"}}>
          {toast.msg}
        </div>
      )}
    </div>
  );
}
