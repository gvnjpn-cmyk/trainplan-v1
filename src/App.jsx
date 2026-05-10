import { useState, useEffect, useRef, useCallback, useMemo } from "react";

// ── UTILS ─────────────────────────────────────────────────────────────────────
const pad         = n => String(n).padStart(2, "0");
const todayStr    = () => { const d=new Date(); return `${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}`; };
const addDays     = (s,n) => { const d=new Date(`${s}T12:00:00`); d.setDate(d.getDate()+n); return `${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}`; };
const toMin       = t => { const [h,m]=t.split(":").map(Number); return h*60+m; };
const daysBetween = (a,b) => Math.round((new Date(`${b}T12:00:00`)-new Date(`${a}T12:00:00`))/864e5);
const fmtShort    = d => new Date(`${d}T12:00:00`).toLocaleDateString("id-ID",{day:"numeric",month:"short"});
const fmtFull     = d => new Date(`${d}T12:00:00`).toLocaleDateString("id-ID",{day:"numeric",month:"short",year:"numeric"});
const dayName     = d => ["Minggu","Senin","Selasa","Rabu","Kamis","Jumat","Sabtu"][new Date(`${d}T12:00:00`).getDay()];
const JS2DAY      = {0:"Minggu",1:"Senin",2:"Selasa",3:"Rabu",4:"Kamis",5:"Jumat",6:"Sabtu"};
const DAYS        = ["Senin","Selasa","Rabu","Kamis","Jumat","Sabtu","Minggu"];
const QUOTES      = [
  "Konsistensi mengalahkan intensitas.",
  "Satu langkah kecil setiap hari.",
  "Tubuh sehat, pikiran jernih.",
  "Progress, bukan perfeksi.",
  "Kamu lebih kuat dari yang kamu kira.",
  "Hari ini lebih baik dari kemarin.",
];

let _actx=null;
const beep=(freq=880,dur=300,vol=0.15)=>{
  try{
    if(!_actx)_actx=new(window.AudioContext||window.webkitAudioContext)();
    const go=()=>{const o=_actx.createOscillator(),g=_actx.createGain();o.connect(g);g.connect(_actx.destination);
      o.frequency.value=freq;o.type="sine";g.gain.setValueAtTime(vol,_actx.currentTime);
      g.gain.exponentialRampToValueAtTime(0.001,_actx.currentTime+dur/1000);o.start();o.stop(_actx.currentTime+dur/1000);};
    _actx.state==="suspended"?_actx.resume().then(go):go();
  }catch(_){}
};

// ── CONSTANTS ─────────────────────────────────────────────────────────────────
const CATS=[
  {id:"cardio",  label:"Cardio",  color:"#FF6230",icon:"🏃"},
  {id:"strength",label:"Strength",color:"#4D8AFF",icon:"💪"},
  {id:"yoga",    label:"Yoga",    color:"#BF7EF7",icon:"🧘"},
  {id:"hiit",    label:"HIIT",   color:"#FF3354",icon:"⚡"},
  {id:"swimming",label:"Swim",   color:"#00C8E0",icon:"🏊"},
  {id:"cycling", label:"Cycling",color:"#22D47A",icon:"🚴"},
  {id:"other",   label:"Lainnya",color:"#F0B429",icon:"🎯"},
];
const C=id=>CATS.find(c=>c.id===id)??CATS[6];

const defHarian=()=>[
  {id:1,name:"Morning Run",startDate:todayStr(),endDate:addDays(todayStr(),4),time:"06:00",duration:30,category:"cardio",note:"Lari 5 hari",completedDates:[]},
  {id:2,name:"Evening Stretch",startDate:todayStr(),endDate:addDays(todayStr(),6),time:"20:00",duration:20,category:"yoga",note:"Stretching",completedDates:[]},
];
const defMingguan=()=>[
  {id:101,name:"Strength Training",day:"Senin", time:"06:30",duration:60,category:"strength",enabled:true,completedDates:[]},
  {id:102,name:"HIIT Blast",       day:"Rabu",  time:"06:00",duration:30,category:"hiit",    enabled:true,completedDates:[]},
  {id:103,name:"Cycling",          day:"Jumat", time:"07:00",duration:60,category:"cycling", enabled:true,completedDates:[]},
  {id:104,name:"Yoga Flow",        day:"Sabtu", time:"08:00",duration:90,category:"yoga",    enabled:true,completedDates:[]},
];

// ── HOOKS ─────────────────────────────────────────────────────────────────────
function useLS(key,defFn){
  const[v,setV]=useState(()=>{
    try{const r=localStorage.getItem(key);if(r!=null){const p=JSON.parse(r);if(Array.isArray(p))return p;}}catch(_){}
    return typeof defFn==="function"?defFn():defFn;
  });
  useEffect(()=>{try{localStorage.setItem(key,JSON.stringify(v));}catch(_){};},[key,v]);
  return[v,setV];
}

// ── ATOMS ─────────────────────────────────────────────────────────────────────
function Logo({size=34}){
  return(
    <svg width={size} height={size} viewBox="0 0 40 40" fill="none">
      <rect width="40" height="40" rx="11" fill="url(#lg)"/>
      <defs><linearGradient id="lg" x1="0" y1="0" x2="40" y2="40">
        <stop offset="0%" stopColor="#FF6A30"/><stop offset="100%" stopColor="#C0300A"/>
      </linearGradient></defs>
      <rect x="13" y="18" width="14" height="4" rx="1.5" fill="white"/>
      <rect x="5"  y="13" width="4"   height="14" rx="2"   fill="white"/>
      <rect x="9"  y="15" width="3.5" height="10" rx="1.5" fill="rgba(255,255,255,.65)"/>
      <rect x="31" y="13" width="4"   height="14" rx="2"   fill="white"/>
      <rect x="27.5" y="15" width="3.5" height="10" rx="1.5" fill="rgba(255,255,255,.65)"/>
    </svg>
  );
}

function Ring({pct,color,size=80,stroke=7}){
  const r=(size-stroke)/2,circ=2*Math.PI*r,off=circ-Math.min(Math.max(pct,0),100)/100*circ;
  return(
    <svg width={size} height={size} style={{transform:"rotate(-90deg)",display:"block"}}>
      <circle cx={size/2} cy={size/2} r={r} fill="none" stroke="rgba(255,255,255,.07)" strokeWidth={stroke}/>
      <circle cx={size/2} cy={size/2} r={r} fill="none" stroke={color} strokeWidth={stroke}
        strokeDasharray={circ} strokeDashoffset={off} strokeLinecap="round"
        style={{transition:"stroke-dashoffset .8s cubic-bezier(.4,0,.2,1)",filter:`drop-shadow(0 0 8px ${color})`}}/>
    </svg>
  );
}

function Toggle({on,onChange,color="#FF6230"}){
  return(
    <div onClick={e=>{e.stopPropagation();onChange();}} style={{position:"relative",width:42,height:24,
      background:on?`${color}22`:"rgba(255,255,255,.07)",
      border:`1px solid ${on?color+"55":"rgba(255,255,255,.12)"}`,
      borderRadius:24,cursor:"pointer",transition:"all .22s",flexShrink:0}}>
      <div style={{position:"absolute",top:3,left:on?21:3,width:16,height:16,
        borderRadius:16,background:on?color:"#4A5568",
        transition:"left .22s cubic-bezier(.4,0,.2,1)",boxShadow:on?`0 0 6px ${color}`:"none"}}/>
    </div>
  );
}

function CatBadge({cat}){
  const c=C(cat);
  return <span style={{fontSize:10,fontWeight:700,color:c.color,background:`${c.color}15`,
    padding:"3px 9px",borderRadius:20,border:`1px solid ${c.color}25`,whiteSpace:"nowrap"}}>{c.label}</span>;
}

// Overflow menu for card actions
function CardMenu({onEdit,onDelete}){
  const[open,setOpen]=useState(false);
  const ref=useRef(null);
  useEffect(()=>{
    if(!open)return;
    const h=e=>{ if(!ref.current?.contains(e.target)) setOpen(false); };
    document.addEventListener("mousedown",h);
    return()=>document.removeEventListener("mousedown",h);
  },[open]);
  return(
    <div ref={ref} style={{position:"relative",flexShrink:0}}>
      <button onClick={e=>{e.stopPropagation();setOpen(o=>!o);}}
        style={{width:32,height:32,borderRadius:8,background:open?"rgba(255,255,255,.1)":"rgba(255,255,255,.05)",
          border:"1px solid rgba(255,255,255,.1)",color:"#7A8898",cursor:"pointer",
          fontSize:16,display:"flex",alignItems:"center",justifyContent:"center",transition:"all .15s",
          letterSpacing:"1px",fontFamily:"inherit"}}>⋮</button>
      {open&&(
        <div style={{position:"absolute",right:0,top:"calc(100% + 6px)",zIndex:60,
          background:"rgba(10,12,22,.97)",border:"1px solid rgba(255,255,255,.12)",
          borderRadius:12,padding:5,minWidth:130,boxShadow:"0 12px 32px rgba(0,0,0,.6)",
          animation:"cardIn .15s ease"}}>
          <button onClick={e=>{e.stopPropagation();onEdit();setOpen(false);}}
            style={{width:"100%",padding:"9px 13px",borderRadius:8,border:"none",background:"transparent",
              color:"#C0CAD8",cursor:"pointer",fontFamily:"'DM Sans',sans-serif",fontSize:13,fontWeight:600,
              textAlign:"left",display:"flex",alignItems:"center",gap:8,transition:"background .15s"}}
            onMouseEnter={e=>e.currentTarget.style.background="rgba(255,255,255,.07)"}
            onMouseLeave={e=>e.currentTarget.style.background="transparent"}>
            ✏️ Edit
          </button>
          <button onClick={e=>{e.stopPropagation();onDelete();setOpen(false);}}
            style={{width:"100%",padding:"9px 13px",borderRadius:8,border:"none",background:"transparent",
              color:"#FF3354",cursor:"pointer",fontFamily:"'DM Sans',sans-serif",fontSize:13,fontWeight:600,
              textAlign:"left",display:"flex",alignItems:"center",gap:8,transition:"background .15s"}}
            onMouseEnter={e=>e.currentTarget.style.background="rgba(255,51,84,.1)"}
            onMouseLeave={e=>e.currentTarget.style.background="transparent"}>
            🗑️ Hapus
          </button>
        </div>
      )}
    </div>
  );
}

function Field({label,children}){
  return <div><label style={{display:"block",fontSize:10,fontWeight:800,letterSpacing:".08em",
    color:"#6A7888",marginBottom:6}}>{label}</label>{children}</div>;
}
const IS={width:"100%",padding:"11px 14px",borderRadius:11,background:"rgba(255,255,255,.05)",
  border:"1px solid rgba(255,255,255,.1)",color:"#E8ECF0",fontFamily:"'DM Mono',monospace",
  fontSize:13,outline:"none",transition:"all .2s",boxSizing:"border-box"};
const onFoc=(e,col)=>{e.target.style.borderColor=col;e.target.style.boxShadow=`0 0 0 3px ${col}18`;};
const onBlr=(e)=>{e.target.style.borderColor="rgba(255,255,255,.1)";e.target.style.boxShadow="none";};

// ── TIMER ─────────────────────────────────────────────────────────────────────
function TimerModal({target,onClose}){
  const c=C(target.category),total=target.duration*60;
  const[secs,setSecs]=useState(total);
  const[run,setRun]=useState(false);
  const[done,setDone]=useState(false);
  const iRef=useRef(null);
  const stop=useCallback(()=>{clearInterval(iRef.current);iRef.current=null;},[]);
  useEffect(()=>{
    if(!run)return;
    iRef.current=setInterval(()=>setSecs(s=>{
      if(s<=1){stop();setRun(false);setDone(true);
        beep(523,200);setTimeout(()=>beep(659,200),260);setTimeout(()=>beep(784,500),520);
        try{new Notification(`✅ Selesai: ${target.name}`,{body:"Kerja bagus! 💪"});}catch(_){}return 0;}
      if((s-1)%60===0&&s-1>0)beep(440,80,.06);
      return s-1;
    }),1000);
    return stop;
  },[run,stop,target.name]);
  useEffect(()=>()=>stop(),[stop]);
  const pct=((total-secs)/total)*100,h=Math.floor(secs/3600),m=Math.floor((secs%3600)/60),s=secs%60;
  const ts=h>0?`${pad(h)}:${pad(m)}:${pad(s)}`:`${pad(m)}:${pad(s)}`;
  return(
    <div onClick={e=>e.target===e.currentTarget&&!run&&onClose()}
      style={{position:"fixed",inset:0,zIndex:300,display:"flex",flexDirection:"column",
        alignItems:"center",justifyContent:"center",background:"rgba(2,3,10,.96)",
        backdropFilter:"blur(20px)",animation:"fadeIn .2s"}}>
      <div style={{position:"absolute",top:0,left:0,right:0,padding:"20px 22px",
        display:"flex",justifyContent:"space-between",alignItems:"center"}}>
        <div style={{display:"flex",alignItems:"center",gap:10}}>
          <div style={{width:40,height:40,borderRadius:12,background:`${c.color}15`,
            border:`1px solid ${c.color}25`,display:"flex",alignItems:"center",justifyContent:"center",fontSize:22}}>{c.icon}</div>
          <div>
            <div style={{fontWeight:800,fontSize:16,color:"#F0F4FF"}}>{target.name}</div>
            <div style={{fontSize:12,color:"#7A8898",fontFamily:"'DM Mono',monospace"}}>{target.duration}m · {c.label}</div>
          </div>
        </div>
        <button onClick={onClose} style={{width:36,height:36,borderRadius:10,border:"1px solid rgba(255,255,255,.1)",
          background:"rgba(255,255,255,.05)",color:"#7A8898",cursor:"pointer",fontSize:16,
          display:"flex",alignItems:"center",justifyContent:"center"}}>✕</button>
      </div>
      <div style={{position:"relative",marginBottom:36}}>
        <Ring pct={pct} color={done?"#22D47A":c.color} size={210} stroke={13}/>
        <div style={{position:"absolute",inset:0,display:"flex",flexDirection:"column",
          alignItems:"center",justifyContent:"center",gap:6}}>
          {done?<><div style={{fontSize:52}}>🎉</div><div style={{fontSize:16,fontWeight:800,color:"#22D47A"}}>Selesai!</div></>:
          <><div style={{fontFamily:"'DM Mono',monospace",fontSize:44,fontWeight:600,color:c.color,letterSpacing:"-.02em",lineHeight:1}}>{ts}</div>
          <div style={{fontSize:12,color:"#7A8898"}}>{Math.round(pct)}%</div></>}
        </div>
      </div>
      <div style={{display:"flex",gap:14,alignItems:"center"}}>
        <button onClick={()=>{stop();setSecs(total);setDone(false);setRun(false);}}
          style={{width:52,height:52,borderRadius:16,background:"rgba(255,255,255,.07)",border:"1px solid rgba(255,255,255,.12)",
            color:"#7A8898",cursor:"pointer",fontSize:22,display:"flex",alignItems:"center",justifyContent:"center"}}>↺</button>
        <button onClick={()=>!done&&setRun(r=>!r)} disabled={done}
          style={{width:76,height:76,borderRadius:22,
            background:done?"rgba(34,212,122,.15)":`linear-gradient(135deg,${c.color},${c.color}CC)`,
            border:`2px solid ${done?"#22D47A":c.color}`,color:"#fff",cursor:done?"default":"pointer",fontSize:30,
            display:"flex",alignItems:"center",justifyContent:"center",
            boxShadow:`0 0 24px ${done?"rgba(34,212,122,.3)":`${c.color}50`}`}}>
          {done?"✓":run?"⏸":"▶"}
        </button>
        <div style={{width:52,height:52,borderRadius:16,background:"rgba(255,255,255,.04)",border:"1px solid rgba(255,255,255,.08)",
          display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",
          color:"#4A5568",fontFamily:"'DM Mono',monospace",fontSize:11,gap:2}}>
          <span style={{fontWeight:700,color:"#7A8898"}}>{target.duration}</span><span>menit</span>
        </div>
      </div>
      {run&&<div style={{marginTop:22,display:"flex",alignItems:"center",gap:6,fontSize:12,color:c.color,fontWeight:700}}>
        <span style={{width:6,height:6,borderRadius:"50%",background:c.color,display:"inline-block",animation:"pulse 1s infinite"}}/>Berjalan</div>}
      {!run&&!done&&secs===total&&<div style={{marginTop:22,fontSize:12,color:"#4A5568",fontFamily:"'DM Mono',monospace"}}>Tekan ▶ untuk mulai</div>}
    </div>
  );
}

// ── FORM MODAL ────────────────────────────────────────────────────────────────
function FormModal({mode,form,setForm,onSubmit,onClose,isEdit}){
  const c=C(form.category||"cardio");
  const sf=f=>setForm(p=>({...p,...(typeof f==="function"?f(p):f)}));
  return(
    <div onClick={e=>e.target===e.currentTarget&&onClose()}
      style={{position:"fixed",inset:0,zIndex:200,display:"flex",alignItems:"center",
        justifyContent:"center",padding:20,background:"rgba(2,4,12,.87)",backdropFilter:"blur(16px)",animation:"fadeIn .2s"}}>
      <div style={{width:"100%",maxWidth:460,borderRadius:22,background:"rgba(10,12,22,.98)",
        border:"1px solid rgba(255,255,255,.12)",boxShadow:"0 40px 80px rgba(0,0,0,.8)",
        animation:"slideUp .22s cubic-bezier(.4,0,.2,1)",overflow:"hidden",maxHeight:"92vh",overflowY:"auto"}}>
        <div style={{padding:"20px 22px 16px",background:`linear-gradient(135deg,${c.color}12,transparent)`,
          borderBottom:"1px solid rgba(255,255,255,.07)",position:"sticky",top:0,backdropFilter:"blur(20px)",zIndex:10}}>
          <div style={{display:"flex",justifyContent:"space-between",alignItems:"center"}}>
            <div>
              <div style={{fontSize:17,fontWeight:800,color:"#F0F4FF",letterSpacing:"-.02em"}}>
                {isEdit?"Edit Jadwal":`Jadwal ${mode==="harian"?"Harian":"Mingguan"} Baru`}</div>
              <div style={{fontSize:12,color:"#7A8898",marginTop:2}}>
                {mode==="harian"?"Tanggal tertentu · bisa rentang multi-hari":"Berulang setiap minggu"}</div>
            </div>
            <button onClick={onClose} style={{width:34,height:34,borderRadius:10,
              border:"1px solid rgba(255,255,255,.1)",background:"rgba(255,255,255,.05)",
              color:"#7A8898",cursor:"pointer",fontSize:16,display:"flex",alignItems:"center",justifyContent:"center"}}>✕</button>
          </div>
        </div>
        <div style={{padding:"18px 22px 22px",display:"flex",flexDirection:"column",gap:14}}>
          <Field label="NAMA LATIHAN">
            <input value={form.name||""} onChange={e=>sf({name:e.target.value})}
              placeholder="cth: Push Day, Morning Run…" style={IS}
              onFocus={e=>onFoc(e,c.color)} onBlur={onBlr}/>
          </Field>
          {mode==="harian"?(
            <>
              <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:10}}>
                <Field label="MULAI">
                  <input type="date" value={form.startDate||""} style={{...IS,colorScheme:"dark"}}
                    onChange={e=>sf(p=>({startDate:e.target.value,endDate:p.endDate&&p.endDate<e.target.value?e.target.value:p.endDate}))}
                    onFocus={e=>onFoc(e,c.color)} onBlur={onBlr}/>
                </Field>
                <Field label="SELESAI">
                  <input type="date" value={form.endDate||form.startDate||""} style={{...IS,colorScheme:"dark"}}
                    onChange={e=>sf(p=>({endDate:e.target.value>=p.startDate?e.target.value:p.startDate}))}
                    onFocus={e=>onFoc(e,c.color)} onBlur={onBlr}/>
                </Field>
              </div>
              {form.startDate&&<div style={{fontSize:11,color:"#7A8898",background:"rgba(255,255,255,.04)",
                padding:"8px 12px",borderRadius:9,border:"1px solid rgba(255,255,255,.08)"}}>
                📅 {form.endDate&&form.endDate!==form.startDate
                  ?`Program ${daysBetween(form.startDate,form.endDate)+1} hari: ${fmtFull(form.startDate)} – ${fmtFull(form.endDate)}`
                  :`Satu hari: ${fmtFull(form.startDate)}`}</div>}
            </>
          ):(
            <Field label="HARI">
              <select value={form.day||"Senin"} onChange={e=>sf({day:e.target.value})} style={{...IS,cursor:"pointer"}}>
                {DAYS.map(d=><option key={d} value={d} style={{background:"#0A0C16"}}>{d}</option>)}
              </select>
            </Field>
          )}
          <Field label="JAM MULAI">
            <input type="time" value={form.time||"07:00"} style={{...IS,colorScheme:"dark"}}
              onChange={e=>sf({time:e.target.value})} onFocus={e=>onFoc(e,c.color)} onBlur={onBlr}/>
          </Field>
          <Field label={`DURASI — ${form.duration||30} menit`}>
            <div style={{position:"relative",height:20,display:"flex",alignItems:"center"}}>
              <div style={{position:"absolute",left:0,right:0,height:4,borderRadius:4,background:"rgba(255,255,255,.08)"}}>
                <div style={{height:"100%",borderRadius:4,background:`linear-gradient(90deg,${c.color},${c.color}88)`,
                  width:`${(((form.duration||30)-5)/175)*100}%`,boxShadow:`0 0 6px ${c.color}`,transition:"width .1s"}}/>
              </div>
              <input type="range" min={5} max={180} step={5} value={form.duration||30}
                onChange={e=>sf({duration:+e.target.value})}
                style={{position:"absolute",left:0,right:0,width:"100%",opacity:0,height:20,cursor:"pointer",margin:0}}/>
            </div>
            <div style={{display:"flex",justifyContent:"space-between",fontSize:9,color:"#4A5568",marginTop:3,fontFamily:"'DM Mono',monospace"}}>
              <span>5m</span><span>1j</span><span>3j</span></div>
          </Field>
          <Field label="KATEGORI">
            <div style={{display:"flex",flexWrap:"wrap",gap:6}}>
              {CATS.map(cat=>(
                <div key={cat.id} onClick={()=>sf({category:cat.id})}
                  style={{cursor:"pointer",padding:"7px 12px",borderRadius:9,fontSize:12,fontWeight:700,transition:"all .15s",
                    background:form.category===cat.id?`${cat.color}18`:"rgba(255,255,255,.05)",
                    border:`1px solid ${form.category===cat.id?cat.color+"55":"rgba(255,255,255,.08)"}`,
                    color:form.category===cat.id?cat.color:"#8A9AAA",
                    transform:form.category===cat.id?"scale(1.04)":"scale(1)"}}>
                  {cat.icon} {cat.label}</div>
              ))}
            </div>
          </Field>
          {mode==="harian"&&(
            <Field label="CATATAN (opsional)">
              <input value={form.note||""} onChange={e=>sf({note:e.target.value})}
                placeholder="Target, tips…" style={IS} onFocus={e=>onFoc(e,c.color)} onBlur={onBlr}/>
            </Field>
          )}
          <div style={{display:"flex",gap:10,marginTop:4}}>
            <button onClick={onClose} style={{flex:1,padding:"13px",borderRadius:12,
              border:"1px solid rgba(255,255,255,.1)",background:"rgba(255,255,255,.05)",
              color:"#8A9AAA",cursor:"pointer",fontFamily:"'DM Sans',sans-serif",fontWeight:700,fontSize:14}}>Batal</button>
            <button onClick={onSubmit} style={{flex:2,padding:"13px",borderRadius:12,border:"none",
              background:`linear-gradient(135deg,${c.color},${c.color}CC)`,color:"#fff",
              cursor:"pointer",fontFamily:"'DM Sans',sans-serif",fontWeight:800,fontSize:14,
              boxShadow:`0 4px 16px ${c.color}40`}}>
              {isEdit?"Simpan":"+ Tambah"}</button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ── DATE STRIP ────────────────────────────────────────────────────────────────
function DateStrip({sel,onSel,dots=[]}){
  const dates=useMemo(()=>Array.from({length:21},(_,i)=>addDays(todayStr(),i-3)),[]);
  const ref=useRef(null);
  useEffect(()=>{const el=ref.current?.querySelector("[data-today]");el?.scrollIntoView({block:"nearest",inline:"center",behavior:"smooth"});},[]);
  return(
    <div ref={ref} style={{display:"flex",gap:5,overflowX:"auto",paddingBottom:4,scrollbarWidth:"none"}}>
      {dates.map(d=>{
        const isSel=d===sel,isToday=d===todayStr(),hasDot=dots.includes(d);
        const dt=new Date(`${d}T12:00:00`);
        const dn=["Min","Sen","Sel","Rab","Kam","Jum","Sab"][dt.getDay()];
        return(
          <div key={d} data-today={isToday||undefined} onClick={()=>onSel(d)}
            style={{cursor:"pointer",flexShrink:0,width:48,borderRadius:13,padding:"9px 5px",
              textAlign:"center",transition:"all .2s",minHeight:72,display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",
              background:isSel?"linear-gradient(135deg,rgba(255,98,48,.25),rgba(255,59,26,.1))":isToday?"rgba(255,98,48,.07)":"rgba(255,255,255,.03)",
              border:`1px solid ${isSel?"rgba(255,98,48,.5)":isToday?"rgba(255,98,48,.18)":"rgba(255,255,255,.07)"}`,
              boxShadow:isSel?"0 0 14px rgba(255,98,48,.22)":"none"}}>
            <div style={{fontSize:9,fontWeight:700,color:isSel?"#FF6230":isToday?"#FF8060":"#5A6678",marginBottom:4}}>{dn}</div>
            <div style={{fontFamily:"'DM Mono',monospace",fontSize:16,fontWeight:800,
              color:isSel?"#FF6230":isToday?"#E8ECF0":"#5A6678",lineHeight:1,marginBottom:5}}>{dt.getDate()}</div>
            <div style={{width:5,height:5,borderRadius:"50%",
              background:hasDot?(isSel?"#FF6230":"rgba(255,98,48,.5)"):"transparent"}}/>
          </div>
        );
      })}
    </div>
  );
}

// ── PAGE: HARI INI (Dashboard) ────────────────────────────────────────────────
function PageToday({harian,mingguan,onTimer,onCheckH,onCheckM,now,onAddHarian,onAddMingguan}){
  const todayISO=todayStr(),today=JS2DAY[now.getDay()],curMin=now.getHours()*60+now.getMinutes();
  const quote=useMemo(()=>QUOTES[new Date().getDate()%QUOTES.length],[]);

  const items=useMemo(()=>{
    const h=harian.filter(s=>todayISO>=s.startDate&&todayISO<=(s.endDate||s.startDate)).map(s=>({...s,src:"H",done:s.completedDates.includes(todayISO)}));
    const m=mingguan.filter(s=>s.enabled&&s.day===today).map(s=>({...s,src:"M",done:s.completedDates.includes(todayISO)}));
    return[...h,...m].sort((a,b)=>toMin(a.time)-toMin(b.time));
  },[harian,mingguan,today,todayISO]);

  const active   = items.find(s=>curMin>=toMin(s.time)&&curMin<toMin(s.time)+s.duration);
  const remaining= items.filter(s=>!s.done&&(!active||s.id!==active.id||s.src!==active.src));
  const doneN    = items.filter(s=>s.done).length;
  const ac=active?C(active.category):null;
  const apct=active?Math.min(100,Math.round(((curMin-toMin(active.time))/active.duration)*100)):0;

  // Upcoming next 3 days
  const upcoming=useMemo(()=>
    Array.from({length:3},(_,i)=>addDays(todayISO,i+1)).map(date=>{
      const dn=dayName(date);
      const its=[
        ...harian.filter(s=>date>=s.startDate&&date<=(s.endDate||s.startDate)),
        ...mingguan.filter(s=>s.enabled&&s.day===dn),
      ].sort((a,b)=>toMin(a.time)-toMin(b.time));
      return{date,its};
    }).filter(d=>d.its.length>0)
  ,[harian,mingguan,todayISO]);

  return(
    <div>
      {/* Quote */}
      <div style={{fontSize:13,color:"#5A6678",fontStyle:"italic",marginBottom:16,
        padding:"10px 14px",borderRadius:10,background:"rgba(255,255,255,.025)",
        border:"1px solid rgba(255,255,255,.06)"}}>
        "{quote}"
      </div>

      {/* Active hero */}
      <div style={{borderRadius:20,padding:"20px",marginBottom:14,transition:"all .4s",
        background:active?`${ac.color}0C`:"rgba(255,255,255,.025)",
        border:`1px solid ${active?ac.color+"35":"rgba(255,255,255,.07)"}`,
        boxShadow:active?`0 0 40px ${ac.color}22`:"none"}}>
        <div style={{fontSize:10,fontWeight:800,letterSpacing:".1em",marginBottom:14,
          display:"flex",alignItems:"center",gap:7,color:active?ac.color:"#5A6678"}}>
          {active&&<span style={{width:7,height:7,borderRadius:"50%",background:ac.color,display:"inline-block",animation:"pulse 1.5s infinite"}}/>}
          {active?"LIVE SEKARANG":"STATUS HARI INI"}
        </div>
        {active?(
          <div style={{display:"flex",gap:14,alignItems:"center"}}>
            <div style={{position:"relative",flexShrink:0,cursor:"pointer"}} onClick={()=>onTimer(active)}>
              <Ring pct={apct} color={ac.color} size={88} stroke={7}/>
              <div style={{position:"absolute",inset:0,display:"flex",alignItems:"center",justifyContent:"center"}}>
                <span style={{fontFamily:"'DM Mono',monospace",fontSize:14,fontWeight:700,color:ac.color}}>{apct}%</span>
              </div>
            </div>
            <div style={{flex:1}}>
              <div style={{fontWeight:800,fontSize:17,color:"#F0F4FF",marginBottom:4}}>{active.name}</div>
              <div style={{fontFamily:"'DM Mono',monospace",fontSize:12,color:"#8A9AAA",marginBottom:10}}>{active.time} · {active.duration}m · sisa ≈{Math.max(0,active.duration-(curMin-toMin(active.time)))}m</div>
              <button onClick={()=>onTimer(active)} style={{padding:"8px 16px",borderRadius:9,border:"none",
                background:`${ac.color}20`,color:ac.color,cursor:"pointer",fontFamily:"'DM Sans',sans-serif",
                fontSize:13,fontWeight:700,border:`1px solid ${ac.color}35`,minHeight:36}}>▶ Buka Timer</button>
            </div>
          </div>
        ):(
          items.length===0?(
            <div style={{textAlign:"center",padding:"12px 0"}}>
              <div style={{fontSize:13,color:"#5A6678",marginBottom:12}}>Belum ada jadwal hari ini</div>
              <div style={{display:"flex",gap:8,justifyContent:"center"}}>
                <button onClick={onAddHarian} style={{padding:"9px 16px",borderRadius:10,border:"1px solid rgba(255,98,48,.25)",
                  background:"rgba(255,98,48,.1)",color:"#FF6230",cursor:"pointer",fontFamily:"'DM Sans',sans-serif",fontSize:13,fontWeight:700,minHeight:40}}>+ Harian</button>
                <button onClick={onAddMingguan} style={{padding:"9px 16px",borderRadius:10,border:"1px solid rgba(255,255,255,.1)",
                  background:"rgba(255,255,255,.05)",color:"#8A9AAA",cursor:"pointer",fontFamily:"'DM Sans',sans-serif",fontSize:13,fontWeight:700,minHeight:40}}>+ Mingguan</button>
              </div>
            </div>
          ):remaining.length>0?(
            <div style={{display:"flex",alignItems:"center",gap:14}}>
              <div style={{width:48,height:48,borderRadius:14,flexShrink:0,
                background:`${C(remaining[0].category).color}15`,border:`1px solid ${C(remaining[0].category).color}25`,
                display:"flex",alignItems:"center",justifyContent:"center",fontSize:24}}>
                {C(remaining[0].category).icon}</div>
              <div>
                <div style={{fontWeight:800,fontSize:15,color:"#F0F4FF",marginBottom:3}}>{remaining[0].name}</div>
                <div style={{fontFamily:"'DM Mono',monospace",fontSize:12,color:"#8A9AAA"}}>{remaining[0].time} · {remaining[0].duration}m</div>
                <div style={{fontSize:12,color:"rgba(240,180,41,.9)",marginTop:4,fontWeight:700}}>
                  {remaining.length===1?"1 kegiatan tersisa hari ini":`${remaining.length} kegiatan tersisa hari ini`}
                </div>
              </div>
            </div>
          ):(
            <div style={{textAlign:"center",padding:"8px 0"}}>
              <div style={{fontSize:28,marginBottom:6}}>🎉</div>
              <div style={{fontWeight:800,fontSize:15,color:"#F0F4FF",marginBottom:2}}>Semua selesai hari ini!</div>
              <div style={{fontSize:12,color:"#5A6678"}}>Istirahat & recovery yang cukup ya</div>
            </div>
          )
        )}
      </div>

      {/* Stats */}
      {items.length>0&&<div style={{display:"grid",gridTemplateColumns:"repeat(3,1fr)",gap:10,marginBottom:16}}>
        {[{l:"Total Sesi",v:items.length,c:"#FF6230"},{l:"Menit",v:`${items.reduce((a,s)=>a+s.duration,0)}m`,c:"#4D8AFF"},{l:"Selesai",v:`${doneN}/${items.length}`,c:"#22D47A"}]
          .map(s=><div key={s.l} style={{borderRadius:13,background:"rgba(255,255,255,.04)",border:"1px solid rgba(255,255,255,.07)",padding:"12px",textAlign:"center"}}>
            <div style={{fontFamily:"'DM Mono',monospace",fontSize:20,fontWeight:700,color:s.c,lineHeight:1,marginBottom:4}}>{s.v}</div>
            <div style={{fontSize:10,color:"#5A6678",fontWeight:700,letterSpacing:".04em"}}>{s.l}</div>
          </div>)}
      </div>}

      {/* Today's timeline */}
      {items.length>0&&<>
        <div style={{fontSize:11,fontWeight:800,letterSpacing:".07em",color:"#5A6678",marginBottom:10}}>
          TIMELINE — {today.toUpperCase()}</div>
        <div style={{display:"flex",flexDirection:"column",gap:8,marginBottom:24}}>
          {items.map((s,i)=>{
            const c=C(s.category),isNow=curMin>=toMin(s.time)&&curMin<toMin(s.time)+s.duration;
            return(
              <div key={`${s.src}-${s.id}`} style={{display:"flex",alignItems:"center",gap:12,
                padding:"14px 16px",minHeight:64,borderRadius:14,background:"rgba(255,255,255,.035)",
                position:"relative",overflow:"hidden",
                border:`1px solid ${isNow?c.color+"35":"rgba(255,255,255,.08)"}`,
                boxShadow:isNow?`0 0 18px ${c.color}20`:"none",
                animation:"cardIn .3s ease both",animationDelay:`${i*.04}s`}}>
                <div style={{position:"absolute",left:0,top:0,bottom:0,width:3,background:c.color,
                  boxShadow:isNow?`0 0 8px ${c.color}`:"none"}}/>
                {/* Checkbox */}
                <div onClick={()=>s.src==="H"?onCheckH(s.id,todayISO):onCheckM(s.id,todayISO)}
                  style={{cursor:"pointer",flexShrink:0,padding:4}}>
                  <div style={{width:28,height:28,borderRadius:9,transition:"all .2s",
                    background:s.done?`${c.color}22`:"rgba(255,255,255,.06)",
                    border:`2px solid ${s.done?c.color:"rgba(255,255,255,.18)"}`,
                    display:"flex",alignItems:"center",justifyContent:"center"}}>
                    {s.done&&<span style={{color:c.color,fontSize:14,fontWeight:800}}>✓</span>}
                  </div>
                </div>
                <div style={{width:38,height:38,borderRadius:10,flexShrink:0,background:`${c.color}15`,
                  border:`1px solid ${c.color}22`,display:"flex",alignItems:"center",justifyContent:"center",
                  fontSize:18,opacity:s.done?.5:1}}>{c.icon}</div>
                <div style={{flex:1,minWidth:0}}>
                  <div style={{fontWeight:700,fontSize:14,color:s.done?"#4A5568":"#E8ECF0",
                    textDecoration:s.done?"line-through":"none",overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap",marginBottom:4}}>{s.name}</div>
                  <div style={{display:"flex",alignItems:"center",gap:6,flexWrap:"wrap"}}>
                    <span style={{fontFamily:"'DM Mono',monospace",fontSize:11,color:"#8A9AAA"}}>{s.time} · {s.duration}m</span>
                    <CatBadge cat={s.category}/>
                    {isNow&&<span style={{fontSize:9,fontWeight:800,color:c.color,background:`${c.color}18`,padding:"2px 7px",borderRadius:5}}>LIVE</span>}
                  </div>
                </div>
                <button onClick={()=>onTimer(s)} title="Mulai Timer"
                  style={{width:36,height:36,borderRadius:9,border:"1px solid rgba(255,98,48,.28)",
                    background:"rgba(255,98,48,.12)",color:"#FF6230",cursor:"pointer",
                    fontSize:14,display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0}}>▶</button>
              </div>
            );
          })}
        </div>
      </>}

      {/* Upcoming reminder */}
      {upcoming.length>0&&<>
        <div style={{fontSize:11,fontWeight:800,letterSpacing:".07em",color:"#5A6678",marginBottom:10}}>PENGINGAT — 3 HARI KE DEPAN</div>
        <div style={{display:"flex",flexDirection:"column",gap:8}}>
          {upcoming.map(({date,its})=>{
            const isTmr=date===addDays(todayISO,1);
            const dn=dayName(date);
            return(
              <div key={date} style={{borderRadius:14,background:"rgba(255,255,255,.025)",
                border:"1px solid rgba(255,255,255,.07)",overflow:"hidden"}}>
                <div style={{padding:"10px 16px",borderBottom:"1px solid rgba(255,255,255,.05)",
                  display:"flex",justifyContent:"space-between",alignItems:"center"}}>
                  <div style={{display:"flex",alignItems:"center",gap:8}}>
                    <span style={{fontWeight:800,fontSize:13,color:"#C0CAD8"}}>{isTmr?"Besok":dn}</span>
                    <span style={{fontSize:11,color:"#5A6678",fontFamily:"'DM Mono',monospace"}}>{fmtShort(date)}</span>
                  </div>
                  <span style={{fontSize:11,color:"#5A6678"}}>{its.length} kegiatan</span>
                </div>
                <div style={{padding:"8px 12px",display:"flex",flexDirection:"column",gap:6}}>
                  {its.map((s,i)=>{
                    const c=C(s.category);
                    return(
                      <div key={i} style={{display:"flex",alignItems:"center",gap:10,padding:"6px 4px"}}>
                        <span style={{fontSize:16,flexShrink:0}}>{c.icon}</span>
                        <span style={{fontFamily:"'DM Mono',monospace",fontSize:12,color:"#7A8898",minWidth:44,flexShrink:0}}>{s.time}</span>
                        <span style={{fontSize:13,fontWeight:600,color:"#B0BAC8",flex:1,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{s.name}</span>
                        <span style={{fontSize:11,color:"#5A6678"}}>{s.duration}m</span>
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
      </>}
    </div>
  );
}

// ── PAGE: HARIAN ──────────────────────────────────────────────────────────────
function PageHarian({items,onAdd,onEdit,onDel,onCheck,onTimer}){
  const[sel,setSel]=useState(todayStr());
  const todayISO=todayStr();
  const dots=useMemo(()=>{const s=new Set();items.forEach(i=>{let d=i.startDate;const e=i.endDate||i.startDate;while(d<=e){s.add(d);d=addDays(d,1);}});return[...s];},[items]);
  const forDate=useMemo(()=>items.filter(s=>sel>=s.startDate&&sel<=(s.endDate||s.startDate)).sort((a,b)=>toMin(a.time)-toMin(b.time)),[items,sel]);
  const doneN=forDate.filter(s=>s.completedDates.includes(sel)).length;
  const pct=forDate.length>0?Math.round((doneN/forDate.length)*100):0;
  const lbl=sel===todayISO?"Hari Ini":sel===addDays(todayISO,1)?"Besok":fmtShort(sel);
  return(
    <div>
      <div style={{marginBottom:14}}><DateStrip sel={sel} onSel={setSel} dots={dots}/></div>
      <div style={{borderRadius:14,background:"rgba(255,255,255,.03)",border:"1px solid rgba(255,255,255,.07)",padding:"13px 16px",marginBottom:12}}>
        <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:forDate.length?8:0}}>
          <div style={{display:"flex",alignItems:"center",gap:8}}>
            <span style={{fontSize:15,fontWeight:800,color:"#F0F4FF"}}>{lbl}</span>
            {sel===todayISO&&<span style={{fontSize:9,fontWeight:800,color:"#FF6230",background:"rgba(255,98,48,.12)",padding:"2px 7px",borderRadius:5,border:"1px solid rgba(255,98,48,.22)"}}>TODAY</span>}
          </div>
          <span style={{fontSize:11,color:"#7A8898",fontFamily:"'DM Mono',monospace"}}>{forDate.length} sesi · {forDate.reduce((a,s)=>a+s.duration,0)}m</span>
        </div>
        {forDate.length>0&&<>
          <div style={{height:4,borderRadius:4,background:"rgba(255,255,255,.07)",overflow:"hidden"}}>
            <div style={{height:"100%",borderRadius:4,transition:"width .5s cubic-bezier(.4,0,.2,1)",
              background:pct===100?"linear-gradient(90deg,#22D47A,#22D47A88)":"linear-gradient(90deg,#FF6230,#FF623088)",
              width:`${pct}%`}}/>
          </div>
          {pct===100&&<div style={{fontSize:11,color:"#22D47A",marginTop:6,fontWeight:700}}>🎉 Semua selesai!</div>}
        </>}
      </div>
      {forDate.length===0?(
        <div style={{textAlign:"center",padding:"52px 20px",background:"rgba(255,255,255,.02)",borderRadius:16,border:"1px dashed rgba(255,255,255,.08)"}}>
          <div style={{fontSize:36,marginBottom:12,opacity:.3}}>📅</div>
          <div style={{fontWeight:800,fontSize:15,color:"#8A9AAA",marginBottom:6}}>Kosong untuk {lbl}</div>
          <div style={{fontSize:12,color:"#5A6678",marginBottom:16}}>Tambahkan kegiatan atau program untuk tanggal ini</div>
          <button onClick={onAdd} style={{padding:"10px 20px",borderRadius:10,minHeight:44,
            background:"rgba(255,98,48,.12)",border:"1px solid rgba(255,98,48,.25)",
            color:"#FF6230",cursor:"pointer",fontFamily:"'DM Sans',sans-serif",fontSize:13,fontWeight:700}}>
            + Tambah Jadwal</button>
        </div>
      ):<div style={{display:"flex",flexDirection:"column",gap:8,marginBottom:20}}>
        {forDate.map((s,i)=>{
          const c=C(s.category),done=s.completedDates.includes(sel);
          const total=daysBetween(s.startDate,s.endDate||s.startDate)+1,dn=daysBetween(s.startDate,sel)+1;
          return(
            <div key={s.id} style={{borderRadius:14,overflow:"hidden",position:"relative",minHeight:64,
              background:done?"rgba(34,212,122,.03)":"rgba(255,255,255,.035)",
              border:`1px solid ${done?"rgba(34,212,122,.18)":"rgba(255,255,255,.08)"}`,
              animation:"cardIn .3s ease both",animationDelay:`${i*.04}s`}}>
              <div style={{position:"absolute",left:0,top:0,bottom:0,width:3,background:done?"#22D47A":c.color}}/>
              {total>1&&<div style={{position:"absolute",bottom:0,left:0,right:0,height:2,background:"rgba(255,255,255,.05)"}}>
                <div style={{height:"100%",background:c.color,width:`${(s.completedDates.length/total)*100}%`,transition:"width .5s"}}/></div>}
              <div style={{display:"flex",alignItems:"center",gap:11,padding:"13px 13px 13px 17px"}}>
                <div onClick={()=>onCheck(s.id,sel)} style={{cursor:"pointer",flexShrink:0,padding:4}}>
                  <div style={{width:28,height:28,borderRadius:9,transition:"all .2s",
                    background:done?`${c.color}22`:"rgba(255,255,255,.06)",
                    border:`2px solid ${done?c.color:"rgba(255,255,255,.18)"}`,
                    display:"flex",alignItems:"center",justifyContent:"center"}}>
                    {done&&<span style={{color:c.color,fontSize:14,fontWeight:800}}>✓</span>}
                  </div>
                </div>
                <div style={{textAlign:"center",minWidth:46}}>
                  <div style={{fontFamily:"'DM Mono',monospace",fontSize:14,fontWeight:600,color:done?"#4A5568":"#E0E8F0",textDecoration:done?"line-through":"none",lineHeight:1}}>{s.time}</div>
                  <div style={{fontSize:10,color:"#5A6678",marginTop:2}}>{s.duration}m</div>
                </div>
                <div style={{width:40,height:40,borderRadius:11,flexShrink:0,background:`${c.color}15`,border:`1px solid ${c.color}22`,
                  display:"flex",alignItems:"center",justifyContent:"center",fontSize:19,opacity:done?.5:1}}>{c.icon}</div>
                <div style={{flex:1,minWidth:0}}>
                  <div style={{fontWeight:700,fontSize:14,color:done?"#4A5568":"#E0E8F0",textDecoration:done?"line-through":"none",
                    overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap",marginBottom:4}}>{s.name}</div>
                  <div style={{display:"flex",alignItems:"center",gap:5,flexWrap:"wrap"}}>
                    <CatBadge cat={s.category}/>
                    {total>1&&<span style={{fontSize:9,fontWeight:700,color:c.color,background:`${c.color}15`,padding:"2px 6px",borderRadius:5}}>H{dn}/{total}</span>}
                    {s.note&&<span style={{fontSize:10,color:"#5A6678",overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap",maxWidth:100}}>📝 {s.note}</span>}
                  </div>
                </div>
                <div style={{display:"flex",gap:5,flexShrink:0,alignItems:"center"}}>
                  {!done&&<button onClick={()=>onTimer(s)} title="Mulai Timer"
                    style={{width:34,height:34,borderRadius:9,border:"1px solid rgba(255,98,48,.28)",
                      background:"rgba(255,98,48,.12)",color:"#FF6230",cursor:"pointer",fontSize:13,
                      display:"flex",alignItems:"center",justifyContent:"center"}}>▶</button>}
                  <CardMenu onEdit={()=>onEdit(s)} onDelete={()=>onDel(s.id)}/>
                </div>
              </div>
            </div>
          );
        })}
      </div>}
      {/* All programs */}
      {items.length>0&&<>
        <div style={{fontSize:11,fontWeight:800,letterSpacing:".07em",color:"#5A6678",marginBottom:10}}>SEMUA PROGRAM</div>
        <div style={{display:"flex",flexDirection:"column",gap:8}}>
          {items.map(s=>{
            const c=C(s.category),total=daysBetween(s.startDate,s.endDate||s.startDate)+1;
            const done=s.completedDates.length,pct2=Math.round((done/total)*100);
            const isActive=todayISO>=s.startDate&&todayISO<=(s.endDate||s.startDate),isDone=pct2>=100;
            return(
              <div key={s.id} onClick={()=>setSel(s.startDate)}
                style={{cursor:"pointer",borderRadius:13,padding:"13px 15px",background:"rgba(255,255,255,.025)",
                  border:`1px solid ${isActive?c.color+"25":isDone?"rgba(34,212,122,.15)":"rgba(255,255,255,.07)"}`,
                  display:"flex",alignItems:"center",gap:12,transition:"background .2s",minHeight:60}}
                onMouseEnter={e=>e.currentTarget.style.background="rgba(255,255,255,.045)"}
                onMouseLeave={e=>e.currentTarget.style.background="rgba(255,255,255,.025)"}>
                <div style={{width:38,height:38,borderRadius:10,flexShrink:0,background:`${c.color}15`,border:`1px solid ${c.color}22`,
                  display:"flex",alignItems:"center",justifyContent:"center",fontSize:18}}>{c.icon}</div>
                <div style={{flex:1,minWidth:0}}>
                  <div style={{display:"flex",alignItems:"center",gap:7,marginBottom:4}}>
                    <span style={{fontWeight:700,fontSize:13,color:"#D0DAE8",overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{s.name}</span>
                    {isActive&&<span style={{fontSize:9,fontWeight:800,color:c.color,background:`${c.color}15`,padding:"2px 6px",borderRadius:4,flexShrink:0}}>AKTIF</span>}
                    {isDone&&<span style={{fontSize:9,fontWeight:800,color:"#22D47A",background:"rgba(34,212,122,.1)",padding:"2px 6px",borderRadius:4,flexShrink:0}}>✓</span>}
                  </div>
                  <div style={{fontSize:10,color:"#7A8898",fontFamily:"'DM Mono',monospace",marginBottom:5}}>
                    {fmtShort(s.startDate)}{s.endDate&&s.endDate!==s.startDate?` – ${fmtShort(s.endDate)}`:""} · {total}h</div>
                  <div style={{height:3,borderRadius:3,background:"rgba(255,255,255,.07)",overflow:"hidden"}}>
                    <div style={{height:"100%",borderRadius:3,background:isDone?"#22D47A":c.color,width:`${pct2}%`,transition:"width .5s"}}/></div>
                </div>
                <div style={{textAlign:"center",flexShrink:0,minWidth:38}}>
                  <div style={{fontFamily:"'DM Mono',monospace",fontSize:15,fontWeight:700,color:isDone?"#22D47A":c.color}}>{pct2}%</div>
                  <div style={{fontSize:9,color:"#5A6678"}}>{done}/{total}</div>
                </div>
                <CardMenu onEdit={()=>onEdit(s)} onDelete={()=>onDel(s.id)}/>
              </div>
            );
          })}
        </div>
      </>}
    </div>
  );
}

// ── PAGE: MINGGUAN ────────────────────────────────────────────────────────────
function PageMingguan({items,onAdd,onEdit,onDel,onToggle,onCheck,onTimer,now}){
  const today=JS2DAY[now.getDay()],todayISO=todayStr();
  const[selDay,setSelDay]=useState(today);
  const forDay=useMemo(()=>items.filter(s=>s.day===selDay).sort((a,b)=>toMin(a.time)-toMin(b.time)),[items,selDay]);
  const curMin=now.getHours()*60+now.getMinutes();
  return(
    <div>
      <div style={{display:"flex",gap:5,overflowX:"auto",marginBottom:16,scrollbarWidth:"none",paddingBottom:2}}>
        {DAYS.map(d=>{
          const count=items.filter(s=>s.day===d&&s.enabled).length,isSel=d===selDay,isToday=d===today;
          return(
            <div key={d} onClick={()=>setSelDay(d)} style={{cursor:"pointer",padding:"9px 15px",minHeight:44,
              borderRadius:11,whiteSpace:"nowrap",fontSize:13,fontWeight:700,transition:"all .2s",flexShrink:0,
              display:"flex",alignItems:"center",gap:5,
              background:isSel?"linear-gradient(135deg,rgba(255,98,48,.2),rgba(255,59,26,.08))":isToday?"rgba(255,98,48,.07)":"rgba(255,255,255,.03)",
              border:`1px solid ${isSel?"rgba(255,98,48,.45)":isToday?"rgba(255,98,48,.18)":"rgba(255,255,255,.07)"}`,
              color:isSel?"#FF6230":isToday?"#FF8060":"#7A8898",
              boxShadow:isSel?"0 0 14px rgba(255,98,48,.18)":"none"}}>
              {d}{count>0&&<span style={{fontSize:9,background:isSel?"rgba(255,98,48,.22)":"rgba(255,255,255,.08)",
                color:isSel?"#FF6230":"#5A6678",padding:"1px 6px",borderRadius:8}}>{count}</span>}
            </div>
          );
        })}
      </div>
      {forDay.length===0?(
        <div style={{textAlign:"center",padding:"52px 20px",background:"rgba(255,255,255,.02)",borderRadius:16,border:"1px dashed rgba(255,255,255,.08)"}}>
          <div style={{fontSize:36,marginBottom:12,opacity:.3}}>🗓️</div>
          <div style={{fontWeight:800,fontSize:15,color:"#8A9AAA",marginBottom:6}}>Kosong untuk {selDay}</div>
          <div style={{fontSize:12,color:"#5A6678",marginBottom:16}}>Jadwal ini akan berulang setiap minggu</div>
          <button onClick={onAdd} style={{padding:"10px 20px",borderRadius:10,minHeight:44,
            background:"rgba(255,98,48,.12)",border:"1px solid rgba(255,98,48,.25)",
            color:"#FF6230",cursor:"pointer",fontFamily:"'DM Sans',sans-serif",fontSize:13,fontWeight:700}}>+ Tambah</button>
        </div>
      ):<div style={{display:"flex",flexDirection:"column",gap:8,marginBottom:20}}>
        {forDay.map((s,i)=>{
          const c=C(s.category);
          const isNow=s.day===today&&s.enabled&&curMin>=toMin(s.time)&&curMin<toMin(s.time)+s.duration;
          const isPast=s.day===today&&curMin>=toMin(s.time)+s.duration;
          const doneToday=s.completedDates.includes(todayISO);
          const pct=isNow?Math.min(100,Math.round(((curMin-toMin(s.time))/s.duration)*100)):0;
          return(
            <div key={s.id} style={{borderRadius:14,overflow:"hidden",position:"relative",minHeight:64,
              background:"rgba(255,255,255,.035)",
              border:`1px solid ${isNow?c.color+"35":"rgba(255,255,255,.08)"}`,
              opacity:!s.enabled?.4:isPast?.7:1,
              boxShadow:isNow?`0 0 22px ${c.color}20`:"none",transition:"all .2s",
              animation:"cardIn .3s ease both",animationDelay:`${i*.04}s`}}>
              <div style={{position:"absolute",left:0,top:0,bottom:0,width:3,background:s.enabled?c.color:"rgba(255,255,255,.12)"}}/>
              {isNow&&<div style={{position:"absolute",bottom:0,left:0,right:0,height:2,background:"rgba(255,255,255,.06)"}}>
                <div style={{height:"100%",background:c.color,width:`${pct}%`,transition:"width 1s linear"}}/></div>}
              <div style={{display:"flex",alignItems:"center",gap:11,padding:"13px 13px 13px 17px"}}>
                {selDay===today&&(
                  <div onClick={()=>onCheck(s.id,todayISO)} style={{cursor:"pointer",flexShrink:0,padding:4}}>
                    <div style={{width:28,height:28,borderRadius:9,transition:"all .2s",
                      background:doneToday?`${c.color}22`:"rgba(255,255,255,.06)",
                      border:`2px solid ${doneToday?c.color:"rgba(255,255,255,.18)"}`,
                      display:"flex",alignItems:"center",justifyContent:"center"}}>
                      {doneToday&&<span style={{color:c.color,fontSize:14,fontWeight:800}}>✓</span>}
                    </div>
                  </div>
                )}
                <div style={{textAlign:"center",minWidth:46}}>
                  <div style={{fontFamily:"'DM Mono',monospace",fontSize:14,fontWeight:600,color:s.enabled?"#E0E8F0":"#4A5568",lineHeight:1}}>{s.time}</div>
                  <div style={{fontSize:10,color:"#5A6678",marginTop:2}}>{s.duration}m</div>
                </div>
                <div style={{width:40,height:40,borderRadius:11,flexShrink:0,background:`${c.color}15`,border:`1px solid ${c.color}22`,
                  display:"flex",alignItems:"center",justifyContent:"center",fontSize:19}}>{c.icon}</div>
                <div style={{flex:1,minWidth:0}}>
                  <div style={{display:"flex",alignItems:"center",gap:7,marginBottom:4}}>
                    <span style={{fontWeight:700,fontSize:14,color:s.enabled?"#E0E8F0":"#4A5568",overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{s.name}</span>
                    {isNow&&<span style={{fontSize:9,fontWeight:800,color:c.color,background:`${c.color}18`,padding:"2px 6px",borderRadius:5,flexShrink:0}}>LIVE</span>}
                  </div>
                  <CatBadge cat={s.category}/>
                </div>
                {/* Simplified actions: toggle + timer + overflow */}
                <div style={{display:"flex",alignItems:"center",gap:7,flexShrink:0}}>
                  <Toggle on={s.enabled} onChange={()=>onToggle(s.id)} color={c.color}/>
                  <button onClick={()=>onTimer(s)} title="Mulai Timer"
                    style={{width:34,height:34,borderRadius:9,border:"1px solid rgba(255,98,48,.28)",
                      background:"rgba(255,98,48,.12)",color:"#FF6230",cursor:"pointer",
                      fontSize:13,display:"flex",alignItems:"center",justifyContent:"center"}}>▶</button>
                  <CardMenu onEdit={()=>onEdit(s)} onDelete={()=>onDel(s.id)}/>
                </div>
              </div>
            </div>
          );
        })}
      </div>}
      {/* Weekly bar */}
      <div style={{borderRadius:16,background:"rgba(255,255,255,.025)",border:"1px solid rgba(255,255,255,.07)",padding:"16px"}}>
        <div style={{fontSize:11,fontWeight:800,letterSpacing:".07em",color:"#5A6678",marginBottom:14}}>RINGKASAN MINGGUAN</div>
        <div style={{display:"grid",gridTemplateColumns:"repeat(7,1fr)",gap:5}}>
          {DAYS.map((d,i)=>{
            const mins=items.filter(s=>s.day===d&&s.enabled).reduce((a,s)=>a+s.duration,0);
            const mx=Math.max(1,...DAYS.map(dd=>items.filter(s=>s.day===dd&&s.enabled).reduce((a,s)=>a+s.duration,0)));
            const isToday=d===today,isSel=d===selDay;
            return(
              <div key={d} onClick={()=>setSelDay(d)} style={{cursor:"pointer",textAlign:"center"}}>
                <div style={{fontSize:9,fontWeight:700,color:isToday?"#FF6230":"#4A5568",letterSpacing:".04em",marginBottom:5}}>
                  {["Sen","Sel","Rab","Kam","Jum","Sab","Min"][i]}</div>
                <div style={{height:52,borderRadius:7,background:"rgba(255,255,255,.05)",position:"relative",overflow:"hidden",
                  border:isSel?"1px solid rgba(255,98,48,.3)":"1px solid transparent"}}>
                  <div style={{position:"absolute",bottom:0,left:0,right:0,height:`${Math.max((mins/mx)*100,4)}%`,
                    borderRadius:7,transition:"height .4s",
                    background:isToday?"linear-gradient(180deg,#FF6230,#FF3B1A)":mins>0?"rgba(255,98,48,.3)":"transparent",
                    boxShadow:isToday?"0 0 8px rgba(255,98,48,.4)":"none"}}/>
                </div>
                <div style={{fontFamily:"'DM Mono',monospace",fontSize:9,color:isToday?"#FF6230":"#4A5568",marginTop:4}}>{mins>0?`${mins}m`:"–"}</div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

// ── PAGE: PROGRESS ────────────────────────────────────────────────────────────
function PageProgress({harian,mingguan,onExport,onImportClick,onInstall,canInstall,notifPerm,onNotif,now}){
  const todayISO=todayStr(),today=JS2DAY[now.getDay()];
  const streak=useMemo(()=>{
    const ds=new Set(harian.flatMap(s=>s.completedDates));
    const wd=new Set(mingguan.filter(s=>s.enabled).map(s=>s.day));
    const ok=d=>{if(ds.has(d))return true;if(d>=todayISO)return false;return wd.has(JS2DAY[new Date(`${d}T12:00:00`).getDay()]);};
    let n=0,d=todayISO;while(ok(d)){n++;d=addDays(d,-1);}return n;
  },[harian,mingguan,todayISO]);

  // Most active day
  const mostActive=useMemo(()=>{
    const counts={};
    DAYS.forEach(d=>{counts[d]=0;});
    mingguan.filter(s=>s.enabled).forEach(s=>{counts[s.day]=(counts[s.day]||0)+s.duration;});
    return Object.entries(counts).sort((a,b)=>b[1]-a[1])[0];
  },[mingguan]);

  // This week completion
  const getMonday=()=>{const d=new Date();d.setHours(12,0,0,0);const day=d.getDay();d.setDate(d.getDate()-(day===0?6:day-1));return`${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}`;};
  const weekStart=useMemo(getMonday,[]);
  const weekMins=mingguan.filter(s=>s.enabled).reduce((a,s)=>a+s.duration,0);
  const weekDone=useMemo(()=>{
    let count=0;
    for(let i=0;i<7;i++){
      const d=addDays(weekStart,i);if(d>todayISO)break;
      const dn=JS2DAY[new Date(`${d}T12:00:00`).getDay()];
      const hasWeekly=mingguan.some(s=>s.enabled&&s.day===dn&&s.completedDates.includes(d));
      const hasHarian=harian.some(s=>d>=s.startDate&&d<=(s.endDate||s.startDate)&&s.completedDates.includes(d));
      if(hasWeekly||hasHarian)count++;
    }
    return count;
  },[mingguan,harian,weekStart,todayISO]);
  const daysPassed=Math.min(7,daysBetween(weekStart,todayISO)+1);
  const weekPct=daysPassed>0?Math.round((weekDone/daysPassed)*100):0;

  const stats=[
    {l:"Program Harian",v:harian.length,       c:"#FF6230"},
    {l:"Jadwal Mingguan",v:mingguan.filter(s=>s.enabled).length,c:"#4D8AFF"},
    {l:"🔥 Hari Streak",  v:streak,             c:"#F0B429"},
    {l:"Check-in Total", v:harian.reduce((a,s)=>a+s.completedDates.length,0)+mingguan.reduce((a,s)=>a+s.completedDates.length,0),c:"#22D47A"},
    {l:"Menit/Minggu",   v:`${weekMins}m`,      c:"#BF7EF7"},
    {l:"Hari Aktif/Mgg", v:`${weekDone}/${daysPassed}`,c:"#00C8E0"},
  ];

  const rows=[
    {i:"🔔",t:"Notifikasi",d:notifPerm==="granted"?"Aktif — notif tepat saat jadwal tiba":"Aktifkan notifikasi browser",a:notifPerm==="granted"?null:onNotif,badge:notifPerm==="granted"?{l:"Aktif",c:"#22D47A"}:{l:"Off",c:"#FF3354"}},
    {i:"📤",t:"Export Data",d:"Download backup jadwal sebagai JSON",a:onExport},
    {i:"📥",t:"Import Data",d:"Restore jadwal dari file backup",a:onImportClick},
    canInstall&&{i:"📲",t:"Install App",d:"Pasang TrainPlan di homescreen",a:onInstall},
  ].filter(Boolean);

  return(
    <div>
      {/* Stats */}
      <div style={{display:"grid",gridTemplateColumns:"repeat(3,1fr)",gap:10,marginBottom:16}}>
        {stats.map(s=><div key={s.l} style={{borderRadius:13,background:"rgba(255,255,255,.035)",border:"1px solid rgba(255,255,255,.08)",padding:"14px 10px",textAlign:"center"}}>
          <div style={{fontFamily:"'DM Mono',monospace",fontSize:22,fontWeight:700,color:s.c,lineHeight:1,marginBottom:5}}>{s.v}</div>
          <div style={{fontSize:9,color:"#5A6678",fontWeight:700,letterSpacing:".04em",lineHeight:1.4}}>{s.l}</div>
        </div>)}
      </div>

      {/* Weekly progress card */}
      <div style={{borderRadius:16,background:"rgba(255,255,255,.025)",border:"1px solid rgba(255,255,255,.07)",padding:"16px",marginBottom:16}}>
        <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:10}}>
          <span style={{fontSize:13,fontWeight:800,color:"#C0CAD8"}}>Progress Minggu Ini</span>
          <span style={{fontFamily:"'DM Mono',monospace",fontSize:13,fontWeight:700,color:weekPct>=80?"#22D47A":"#FF6230"}}>{weekPct}%</span>
        </div>
        <div style={{height:6,borderRadius:6,background:"rgba(255,255,255,.07)",overflow:"hidden",marginBottom:8}}>
          <div style={{height:"100%",borderRadius:6,
            background:weekPct>=80?"linear-gradient(90deg,#22D47A,#22D47A88)":"linear-gradient(90deg,#FF6230,#FF623088)",
            width:`${weekPct}%`,transition:"width .6s cubic-bezier(.4,0,.2,1)"}}/>
        </div>
        <div style={{display:"flex",justifyContent:"space-between",fontSize:11,color:"#5A6678"}}>
          <span>{weekDone} hari aktif dari {daysPassed} hari berlalu</span>
          {mostActive[1]>0&&<span>Paling aktif: <span style={{color:"#C0CAD8",fontWeight:700}}>{mostActive[0]}</span></span>}
        </div>
      </div>

      {/* Settings */}
      <div style={{fontSize:11,fontWeight:800,letterSpacing:".07em",color:"#5A6678",marginBottom:10}}>PENGATURAN</div>
      <div style={{display:"flex",flexDirection:"column",gap:8}}>
        {rows.map((r,i)=>(
          <div key={i} onClick={r.a||undefined}
            style={{display:"flex",alignItems:"center",gap:14,padding:"16px",minHeight:70,borderRadius:14,
              background:"rgba(255,255,255,.025)",border:"1px solid rgba(255,255,255,.07)",
              cursor:r.a?"pointer":"default",transition:"background .18s"}}
            onMouseEnter={e=>r.a&&(e.currentTarget.style.background="rgba(255,255,255,.045)")}
            onMouseLeave={e=>e.currentTarget.style.background="rgba(255,255,255,.025)"}>
            <div style={{width:42,height:42,borderRadius:12,background:"rgba(255,255,255,.07)",
              display:"flex",alignItems:"center",justifyContent:"center",fontSize:20,flexShrink:0}}>{r.i}</div>
            <div style={{flex:1}}>
              <div style={{display:"flex",alignItems:"center",gap:7,marginBottom:3}}>
                <span style={{fontWeight:700,fontSize:14,color:"#D0DAE8"}}>{r.t}</span>
                {r.badge&&<span style={{fontSize:9,fontWeight:800,color:r.badge.c,background:`${r.badge.c}15`,padding:"2px 7px",borderRadius:5}}>{r.badge.l}</span>}
              </div>
              <div style={{fontSize:12,color:"#7A8898"}}>{r.d}</div>
            </div>
            {r.a&&<span style={{color:"#5A6678",fontSize:22,flexShrink:0}}>›</span>}
          </div>
        ))}
      </div>
      <div style={{marginTop:24,textAlign:"center",fontSize:11,color:"#2E3545"}}>TrainPlan v2.0 · Data tersimpan lokal di browser ini</div>
    </div>
  );
}

// ── BOTTOM NAV ────────────────────────────────────────────────────────────────
function BottomNav({tab,setTab}){
  const tabs=[
    {id:"today",l:"Hari Ini",svg:<svg width="22" height="22" viewBox="0 0 24 24" fill="none"><path d="M3 12L12 3L21 12V20C21 20.5523 20.5523 21 20 21H15V16H9V21H4C3.44772 21 3 20.5523 3 20V12Z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/></svg>},
    {id:"harian",l:"Harian",svg:<svg width="22" height="22" viewBox="0 0 24 24" fill="none"><rect x="3" y="4" width="18" height="18" rx="2" stroke="currentColor" strokeWidth="2"/><path d="M3 9H21M8 2V6M16 2V6" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/><circle cx="9" cy="14" r="1.5" fill="currentColor"/><circle cx="15" cy="14" r="1.5" fill="currentColor"/></svg>},
    {id:"mingguan",l:"Mingguan",svg:<svg width="22" height="22" viewBox="0 0 24 24" fill="none"><path d="M4 6H20M4 12H20M4 18H14" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/></svg>},
    {id:"progress",l:"Progress",svg:<svg width="22" height="22" viewBox="0 0 24 24" fill="none"><path d="M18 20V10M12 20V4M6 20V14" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"/></svg>},
  ];
  return(
    <div style={{position:"fixed",bottom:0,left:0,right:0,zIndex:100,
      background:"rgba(5,6,14,.94)",backdropFilter:"blur(20px) saturate(180%)",
      borderTop:"1px solid rgba(255,255,255,.08)",
      display:"flex",alignItems:"stretch",height:64,
      paddingBottom:"env(safe-area-inset-bottom)"}}>
      {tabs.map(t=>{
        const active=t.id===tab;
        return(
          <div key={t.id} onClick={()=>setTab(t.id)}
            style={{flex:1,display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",
              gap:3,cursor:"pointer",position:"relative",transition:"all .2s",
              color:active?"#FF6230":"#5A6678"}}>
            {active&&<div style={{position:"absolute",top:0,left:"28%",right:"28%",height:2,
              background:"#FF6230",borderRadius:"0 0 2px 2px",boxShadow:"0 0 8px #FF623070"}}/>}
            <div style={{transition:"transform .2s",transform:active?"scale(1.14)":"scale(1)"}}>{t.svg}</div>
            <span style={{fontSize:9,fontWeight:active?800:600,letterSpacing:".05em"}}>{t.l.toUpperCase()}</span>
          </div>
        );
      })}
    </div>
  );
}

// ── APP ───────────────────────────────────────────────────────────────────────
export default function App(){
  const[harian,   setHarian]  =useLS("tp_h2",defHarian);
  const[mingguan, setMingguan]=useLS("tp_m2",defMingguan);
  const[tab,      setTab]     =useState("today");
  const[now,      setNow]     =useState(new Date());
  const[notifPerm,setNotifPerm]=useState(typeof Notification!=="undefined"?Notification.permission:"default");
  const[modal,    setModal]   =useState(null);
  const[timer,    setTimer]   =useState(null);
  const[toast,    setToast]   =useState(null);
  const[install,  setInstall] =useState(null);
  const nextId=useRef(600),notified=useRef(new Set()),toastTm=useRef(null),importRef=useRef(null);

  useEffect(()=>{const t=setInterval(()=>setNow(new Date()),10000);return()=>clearInterval(t);},[]);
  useEffect(()=>{const h=e=>{e.preventDefault();setInstall(e);};window.addEventListener("beforeinstallprompt",h);return()=>window.removeEventListener("beforeinstallprompt",h);},[]);
  useEffect(()=>{if("serviceWorker"in navigator)navigator.serviceWorker.register("/sw.js").catch(()=>{});},[]);
  useEffect(()=>{
    if(notifPerm!=="granted")return;
    const today=JS2DAY[now.getDay()],todayISO=todayStr(),curM=now.getHours()*60+now.getMinutes();
    [...harian.filter(s=>todayISO>=s.startDate&&todayISO<=(s.endDate||s.startDate)),
     ...mingguan.filter(s=>s.enabled&&s.day===today)]
    .forEach(s=>{
      const key=`${s.id}-${now.toDateString()}`;
      if(Math.abs(toMin(s.time)-curM)<=2&&!notified.current.has(key)){
        notified.current.add(key);
        try{new Notification(`${C(s.category).icon} ${s.name}`,{body:`${s.time} · ${s.duration}m`});}catch(_){}
      }
    });
  },[now,harian,mingguan,notifPerm]);

  const showToast=useCallback((msg,type="ok")=>{
    if(toastTm.current)clearTimeout(toastTm.current);
    setToast({msg,type});toastTm.current=setTimeout(()=>setToast(null),2600);
  },[]);

  const chk=(setter,id,date)=>setter(p=>p.map(s=>{
    if(s.id!==id)return s;
    const done=s.completedDates.includes(date);
    showToast(done?"Dibatalkan":"Selesai! ✅");
    return{...s,completedDates:done?s.completedDates.filter(d=>d!==date):[...s.completedDates,date].sort()};
  }));

  const openAdd=mode=>{
    const today=JS2DAY[new Date().getDay()];
    setModal({mode,form:mode==="harian"
      ?{name:"",startDate:todayStr(),endDate:todayStr(),time:"07:00",duration:30,category:"cardio",note:"",completedDates:[]}
      :{name:"",day:today,time:"07:00",duration:30,category:"cardio",enabled:true,completedDates:[]},editId:null});
  };
  const openEdit=(mode,item)=>setModal({mode,form:{...item},editId:item.id});
  const closeModal=()=>setModal(null);
  const handleSubmit=()=>{
    const{mode,form,editId}=modal;
    if(!form.name?.trim())return showToast("Nama wajib diisi! ⚠️","err");
    if(mode==="harian"){
      const item={...form,endDate:form.endDate||form.startDate,completedDates:form.completedDates||[]};
      editId!=null?setHarian(p=>p.map(s=>s.id===editId?{...item,id:editId}:s)):setHarian(p=>[...p,{...item,id:nextId.current++}]);
    }else{
      const item={...form,completedDates:form.completedDates||[]};
      editId!=null?setMingguan(p=>p.map(s=>s.id===editId?{...item,id:editId}:s)):setMingguan(p=>[...p,{...item,id:nextId.current++}]);
    }
    showToast(editId!=null?"Disimpan ✅":"Ditambahkan 🎉");closeModal();
  };

  const exportData=()=>{
    const url=URL.createObjectURL(new Blob([JSON.stringify({harian,mingguan,exportedAt:new Date().toISOString(),v:3},null,2)],{type:"application/json"}));
    Object.assign(document.createElement("a"),{href:url,download:`trainplan-${todayStr()}.json`}).click();
    URL.revokeObjectURL(url);showToast("Diekspor! 📤");
  };
  const importData=e=>{
    const file=e.target.files[0];if(!file)return;
    if(!file.name.endsWith(".json"))return showToast("Harus file .json!","err");
    const r=new FileReader();
    r.onload=ev=>{
      try{
        const d=JSON.parse(ev.target.result);
        const vH=Array.isArray(d.harian)&&d.harian.every(s=>s.id&&s.name&&s.startDate&&Array.isArray(s.completedDates));
        const vM=Array.isArray(d.mingguan)&&d.mingguan.every(s=>s.id&&s.name&&s.day&&Array.isArray(s.completedDates));
        if(!vH&&!vM)return showToast("Format tidak valid!","err");
        if(vH)setHarian(d.harian);if(vM)setMingguan(d.mingguan);
        showToast("Diimport! 📥");
      }catch{showToast("File rusak!","err");}
    };
    r.readAsText(file);e.target.value="";
  };
  const doInstall=async()=>{
    if(!install)return;install.prompt();
    const{outcome}=await install.userChoice;
    if(outcome==="accepted"){setInstall(null);showToast("App terinstal! 🎉");}
  };
  const requestNotif=async()=>{
    const p=await Notification.requestPermission();setNotifPerm(p);
    showToast(p==="granted"?"Notifikasi aktif! 🔔":"Diblokir 😔",p==="granted"?"ok":"err");
  };

  const pageTitles={today:"Dashboard",harian:"Jadwal Harian",mingguan:"Jadwal Mingguan",progress:"Progress"};

  return(
    <div style={{minHeight:"100vh",background:"#04050E",fontFamily:"'DM Sans',sans-serif",color:"#E8ECF0",overflowX:"hidden"}}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;600;700;800&family=DM+Mono:wght@400;500;600&display=swap');
        *{box-sizing:border-box;margin:0;padding:0;}
        ::-webkit-scrollbar{width:3px;height:3px;}::-webkit-scrollbar-thumb{background:#1A2030;border-radius:3px;}
        input[type=date]::-webkit-calendar-picker-indicator,input[type=time]::-webkit-calendar-picker-indicator{filter:invert(.4);cursor:pointer;}
        @keyframes cardIn{from{opacity:0;transform:translateY(8px)}to{opacity:1;transform:none}}
        @keyframes fadeIn{from{opacity:0}to{opacity:1}}
        @keyframes slideUp{from{opacity:0;transform:translateY(14px)}to{opacity:1;transform:none}}
        @keyframes toastPop{from{opacity:0;transform:translateX(-50%) translateY(10px)}to{opacity:1;transform:translateX(-50%) translateY(0)}}
        @keyframes pulse{0%,100%{opacity:1;transform:scale(1)}50%{opacity:.5;transform:scale(.75)}}
        @keyframes orb{0%,100%{transform:translate(0,0)}50%{transform:translate(28px,-28px)}}
      `}</style>
      <div style={{position:"fixed",inset:0,pointerEvents:"none",zIndex:0,overflow:"hidden"}}>
        <div style={{position:"absolute",top:-150,right:-80,width:480,height:480,borderRadius:"50%",
          background:"radial-gradient(circle,rgba(255,98,48,.06),transparent 70%)",animation:"orb 14s ease-in-out infinite"}}/>
        <div style={{position:"absolute",bottom:-80,left:-100,width:380,height:380,borderRadius:"50%",
          background:"radial-gradient(circle,rgba(77,138,255,.04),transparent 70%)"}}/>
        <svg style={{position:"absolute",inset:0,width:"100%",height:"100%",opacity:.018}}>
          <filter id="n"><feTurbulence type="fractalNoise" baseFrequency=".65" numOctaves="3" stitchTiles="stitch"/></filter>
          <rect width="100%" height="100%" filter="url(#n)"/>
        </svg>
      </div>
      <div style={{maxWidth:680,margin:"0 auto",padding:"0 18px",position:"relative",zIndex:1,paddingBottom:74}}>
        {/* Header */}
        <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",
          padding:"18px 0 14px",position:"sticky",top:0,zIndex:50,
          background:"rgba(4,5,14,.92)",backdropFilter:"blur(16px)",
          borderBottom:"1px solid rgba(255,255,255,.06)",marginBottom:18}}>
          <div style={{display:"flex",alignItems:"center",gap:10}}>
            <Logo size={34}/>
            <div>
              <div style={{fontSize:19,fontWeight:800,letterSpacing:"-.04em",
                background:"linear-gradient(135deg,#F0F4FF,#8899B0)",
                WebkitBackgroundClip:"text",WebkitTextFillColor:"transparent"}}>TrainPlan</div>
              <div style={{display:"flex",alignItems:"center",gap:5,marginTop:1}}>
                <div style={{width:5,height:5,borderRadius:"50%",background:"#22D47A",animation:"pulse 1.8s infinite"}}/>
                <span style={{fontFamily:"'DM Mono',monospace",fontSize:10,color:"#4A5568"}}>
                  {pad(now.getHours())}:{pad(now.getMinutes())} · {JS2DAY[now.getDay()]}</span>
              </div>
            </div>
          </div>
          <button onClick={()=>openAdd(tab==="mingguan"?"mingguan":"harian")}
            style={{padding:"9px 18px",minHeight:40,borderRadius:10,background:"linear-gradient(135deg,#FF6230,#FF3B1A)",
              border:"none",color:"#fff",cursor:"pointer",fontFamily:"'DM Sans',sans-serif",
              fontSize:13,fontWeight:800,boxShadow:"0 4px 14px rgba(255,98,48,.3)"}}>
            + Tambah</button>
        </div>
        <div style={{fontSize:22,fontWeight:800,color:"#F0F4FF",letterSpacing:"-.03em",marginBottom:16,
          animation:"cardIn .3s ease"}}>{pageTitles[tab]}</div>
        {tab==="today"&&<PageToday harian={harian} mingguan={mingguan} now={now}
          onTimer={setTimer} onCheckH={(id,d)=>chk(setHarian,id,d)} onCheckM={(id,d)=>chk(setMingguan,id,d)}
          onAddHarian={()=>openAdd("harian")} onAddMingguan={()=>openAdd("mingguan")}/>}
        {tab==="harian"&&<PageHarian items={harian}
          onAdd={()=>openAdd("harian")} onEdit={s=>openEdit("harian",s)}
          onDel={id=>{setHarian(p=>p.filter(s=>s.id!==id));showToast("Dihapus 🗑️","err");}}
          onCheck={(id,d)=>chk(setHarian,id,d)} onTimer={setTimer}/>}
        {tab==="mingguan"&&<PageMingguan items={mingguan} now={now}
          onAdd={()=>openAdd("mingguan")} onEdit={s=>openEdit("mingguan",s)}
          onDel={id=>{setMingguan(p=>p.filter(s=>s.id!==id));showToast("Dihapus 🗑️","err");}}
          onToggle={id=>setMingguan(p=>p.map(s=>s.id===id?{...s,enabled:!s.enabled}:s))}
          onCheck={(id,d)=>chk(setMingguan,id,d)} onTimer={setTimer}/>}
        {tab==="progress"&&<PageProgress harian={harian} mingguan={mingguan} now={now}
          onExport={exportData} onImportClick={()=>importRef.current?.click()}
          onInstall={doInstall} canInstall={!!install} notifPerm={notifPerm} onNotif={requestNotif}/>}
      </div>
      <BottomNav tab={tab} setTab={setTab}/>
      <input ref={importRef} type="file" accept=".json" onChange={importData} style={{display:"none"}}/>
      {modal&&<FormModal mode={modal.mode} form={modal.form}
        setForm={f=>setModal(m=>({...m,form:typeof f==="function"?f(m.form):{...m.form,...f}}))}
        onSubmit={handleSubmit} onClose={closeModal} isEdit={modal.editId!=null}/>}
      {timer&&<TimerModal target={timer} onClose={()=>setTimer(null)}/>}
      {toast&&<div style={{position:"fixed",bottom:76,left:"50%",zIndex:500,
        animation:"toastPop .2s cubic-bezier(.4,0,.2,1)",
        background:toast.type==="err"?"rgba(255,51,84,.14)":"rgba(34,212,122,.12)",
        border:`1px solid ${toast.type==="err"?"rgba(255,51,84,.3)":"rgba(34,212,122,.28)"}`,
        color:toast.type==="err"?"#FF3354":"#22D47A",backdropFilter:"blur(12px)",
        padding:"10px 20px",borderRadius:14,fontSize:13,fontWeight:700,
        whiteSpace:"nowrap",boxShadow:"0 8px 32px rgba(0,0,0,.4)",transform:"translateX(-50%)"}}>
        {toast.msg}</div>}
    </div>
  );
}
