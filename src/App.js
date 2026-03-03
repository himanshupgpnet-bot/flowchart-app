import { useState } from "react";

const AC={a1:{bg:"#EEF2FF",border:"#6366F1",text:"#6366F1",dark:"#4F46E5"},a2:{bg:"#ECFDF5",border:"#10B981",text:"#10B981",dark:"#059669"},a3:{bg:"#FFF7ED",border:"#F59E0B",text:"#F59E0B",dark:"#D97706"},a4:{bg:"#FEF2F2",border:"#EF4444",text:"#EF4444",dark:"#DC2626"}};
const ACTORS=[{id:"a1",name:"Lucas",emoji:"👨‍💼"},{id:"a2",name:"Himanshu",emoji:"👨‍💻"},{id:"a3",name:"Controlling",emoji:"🏢"},{id:"a4",name:"Alberto",emoji:"🔧"}];
const NW=148,NH=68,DW=124,DH=72;
const NODES=[
  {id:"S",type:"start",x:20,y:94,label:"START"},
  {id:1,type:"process",x:115,y:58,actorId:"a1",icon:"📅",label:"Monthly Trigger",desc:"Within first 5 working days, Lucas initiates charging via VDI.",steps:["Confirm within first 5 working days","Log into VDI via Keeper credentials","Open charging tool"],output:"VDI session ready",note:"⚠️ Must be done in first 5 working days!"},
  {id:2,type:"process",x:310,y:58,actorId:"a1",icon:"⚙️",label:"Run Manual Process",desc:"Lucas runs the monthly charging job through VDI to generate the charge file.",steps:["Access charging system via VDI","Execute monthly charging run","Generate output file","Save file locally"],output:"Raw charge file generated",note:"Credentials in Keeper — share with Himanshu"},
  {id:3,type:"decision",x:505,y:58,actorId:"a1",icon:"🔍",label:"Semicolon\nseparated?",desc:"Critical: file must use semicolons (;) not commas.",steps:["Open generated file","Check delimiter format","Verify semicolons not commas"],output:"Format validated",note:"⚠️ CRITICAL: Wrong format breaks Controlling import!",yes:"Proceed to handover",no:"Fix the file"},
  {id:"F",type:"process",x:505,y:250,actorId:"a1",icon:"🛠️",label:"Fix Delimiter",desc:"Change delimiter from comma to semicolon and re-save.",steps:["Open file in editor","Replace commas with semicolons","Re-save file","Go back to validate"],output:"Fixed semicolon file",note:""},
  {id:4,type:"process",x:690,y:58,actorId:"a3",icon:"📤",label:"Handover to Controlling",desc:"Validated file sent to Controlling who post charges to business units.",steps:["Send file to Controlling","Controlling imports file","Charges posted to BUs","Confirm charges done"],output:"Business units charged ✅",note:""},
  {id:5,type:"decision",x:895,y:58,actorId:"a2",icon:"🔐",label:"GSOP reset\nprompted?",desc:"When VDI prompts password reset, Alberto must be notified to update Cockpit.",steps:["Watch for password popup (~every 6-12 months)","Reset GSOP password","Update password in Keeper","Notify Alberto"],output:"Password updated, Alberto notified",note:"Cockpit breaks if Alberto not informed!",yes:"Notify Alberto",no:"No action"},
  {id:"G",type:"process",x:895,y:250,actorId:"a4",icon:"🔔",label:"Notify Alberto",desc:"Alberto updates Cockpit config after any GSOP password change.",steps:["Update new password in Keeper","Notify Alberto","Alberto updates Cockpit","Verify Cockpit working"],output:"Cockpit fixed ✅",note:""},
  {id:6,type:"process",x:1080,y:58,actorId:"a1",icon:"📆",label:"Schedule Follow-up",desc:"Lucas schedules follow-up sessions for Power Automate and Pricing System.",steps:["Schedule Power Automate training","Schedule Pricing System walkthrough","Share VDI credentials via Keeper"],output:"Follow-up meetings booked",note:""},
  {id:"E",type:"end",x:1285,y:94,label:"END"},
];
const ARROWS=[
  {from:"S",to:1,color:"#10B981"},
  {from:1,to:2,color:"#6366F1"},
  {from:2,to:3,color:"#6366F1"},
  {from:3,to:4,color:"#10B981",label:"YES ✓"},
  {from:3,to:"F",color:"#EF4444",label:"NO ✗",type:"down"},
  {from:"F",to:3,color:"#F59E0B",label:"retry",type:"up"},
  {from:4,to:5,color:"#F59E0B"},
  {from:5,to:6,color:"#94A3B8",label:"NO ✗"},
  {from:5,to:"G",color:"#10B981",label:"YES ✓",type:"down"},
  {from:"G",to:6,color:"#EF4444",type:"rightup"},
  {from:6,to:"E",color:"#6366F1"},
];

function nb(n){if(n.type==="start"||n.type==="end")return{x:n.x,y:n.y,w:68,h:36};if(n.type==="decision")return{x:n.x,y:n.y,w:DW,h:DH};return{x:n.x,y:n.y,w:NW,h:NH};}
function pt(n,s){const b=nb(n),cx=b.x+b.w/2,cy=b.y+b.h/2;if(s==="r")return{x:b.x+b.w,y:cy};if(s==="l")return{x:b.x,y:cy};if(s==="b")return{x:cx,y:b.y+b.h};if(s==="t")return{x:cx,y:b.y};return{x:cx,y:cy};}

function Arr({arr,nodes}){
  const fn=nodes.find(n=>n.id===arr.from),tn=nodes.find(n=>n.id===arr.to);
  if(!fn||!tn)return null;
  const c=arr.color||"#94A3B8",mid=`mk${c.replace('#','')}`;
  let d="",lx=0,ly=0;
  if(arr.type==="down"){const f=pt(fn,"b"),t=pt(tn,"t");d=`M${f.x} ${f.y}L${f.x} ${t.y}L${t.x} ${t.y}`;lx=f.x+14;ly=f.y+24;}
  else if(arr.type==="up"){const f=pt(fn,"r"),t=pt(tn,"b"),ox=f.x+32;d=`M${f.x} ${f.y}L${ox} ${f.y}L${ox} ${t.y}L${t.x} ${t.y}`;lx=ox+10;ly=(f.y+t.y)/2;}
  else if(arr.type==="rightup"){const f=pt(fn,"r"),t=pt(tn,"b"),ox=Math.max(f.x,t.x)+48;d=`M${f.x} ${f.y}L${ox} ${f.y}L${ox} ${t.y}L${t.x} ${t.y}`;lx=ox+10;ly=(f.y+t.y)/2;}
  else{const f=pt(fn,"r"),t=pt(tn,"l");if(Math.abs(f.y-t.y)<4){d=`M${f.x} ${f.y}L${t.x} ${t.y}`;lx=(f.x+t.x)/2;ly=f.y-12;}else{const mx=(f.x+t.x)/2;d=`M${f.x} ${f.y}L${mx} ${f.y}L${mx} ${t.y}L${t.x} ${t.y}`;lx=mx+10;ly=(f.y+t.y)/2;}}
  const dash=arr.label==="NO ✗"||arr.label==="retry"?"6,3":"none";
  const lc=arr.label?.includes("YES")?"#10B981":arr.label==="retry"?"#F59E0B":arr.label==="NO ✗"?"#EF4444":null;
  return(<g><path d={d} fill="none" stroke={c} strokeWidth={2.2} strokeDasharray={dash} markerEnd={`url(#${mid})`}/>{arr.label&&lc&&(<g><rect x={lx-18} y={ly-9} width={36} height={16} rx={5} fill={lc}/><text x={lx} y={ly+3} textAnchor="middle" fontSize={8} fill="white" fontWeight="800" fontFamily="sans-serif">{arr.label}</text></g>)}</g>);
}

function Nd({node,active,onClick}){
  const c=AC[node.actorId]||{bg:"#F1F5F9",border:"#94A3B8",text:"#64748B",dark:"#64748B"};
  const b=nb(node),cx=b.x+b.w/2,cy=b.y+b.h/2;
  if(node.type==="start")return(<g><ellipse cx={cx} cy={cy} rx={36} ry={20} fill="#d1fae5"/><ellipse cx={cx} cy={cy} rx={34} ry={18} fill="#10B981"/><text x={cx} y={cy+5} textAnchor="middle" fontSize={11} fontWeight="800" fill="white" fontFamily="sans-serif">START</text></g>);
  if(node.type==="end")return(<g><ellipse cx={cx} cy={cy} rx={36} ry={20} fill="#fee2e2"/><ellipse cx={cx} cy={cy} rx={34} ry={18} fill="#EF4444"/><text x={cx} y={cy+5} textAnchor="middle" fontSize={11} fontWeight="800" fill="white" fontFamily="sans-serif">END</text></g>);
  if(node.type==="decision"){const hw=DW/2,hh=DH/2,pts=`${cx},${cy-hh} ${cx+hw},${cy} ${cx},${cy+hh} ${cx-hw},${cy}`;
    return(<g style={{cursor:"pointer"}} onClick={onClick}><polygon points={pts.split(" ").map(p=>{const[x,y]=p.split(",");return`${+x+3},${+y+3}`;}).join(" ")} fill="rgba(0,0,0,0.06)"/><polygon points={pts} fill={active?"#fef9c3":"white"} stroke={active?c.dark:c.border} strokeWidth={active?2.5:2}/><text x={cx} y={cy-6} textAnchor="middle" fontSize={15}>{node.icon}</text><text x={cx} y={cy+8} textAnchor="middle" fontSize={9} fontWeight="700" fill="#92400E" fontFamily="sans-serif">{node.label.split("\n")[0]}</text><text x={cx} y={cy+20} textAnchor="middle" fontSize={9} fontWeight="700" fill="#92400E" fontFamily="sans-serif">{node.label.split("\n")[1]||""}</text>{typeof node.id==="number"&&<g><circle cx={b.x+10} cy={b.y+10} r={11} fill={c.dark}/><text x={b.x+10} y={b.y+15} textAnchor="middle" fontSize={9} fontWeight="800" fill="white">{node.id}</text></g>}</g>);}
  return(<g style={{cursor:"pointer"}} onClick={onClick}><rect x={b.x+3} y={b.y+3} width={NW} height={NH} rx={12} fill="rgba(0,0,0,0.06)"/><rect x={b.x} y={b.y} width={NW} height={NH} rx={12} fill={active?c.bg:"white"} stroke={active?c.dark:c.border} strokeWidth={active?2.5:1.8}/><rect x={b.x} y={b.y} width={NW} height={10} rx={12} fill={c.dark}/><rect x={b.x} y={b.y+6} width={NW} height={4} fill={c.dark}/><text x={b.x+18} y={b.y+NH/2+6} textAnchor="middle" fontSize={16}>{node.icon}</text><foreignObject x={b.x+32} y={b.y+14} width={NW-40} height={NH-18}><div xmlns="http://www.w3.org/1999/xhtml" style={{fontSize:"11px",fontWeight:"700",color:"#0F172A",lineHeight:"1.3",fontFamily:"sans-serif"}}>{node.label}</div></foreignObject>{typeof node.id==="number"&&<g><circle cx={b.x+10} cy={b.y-6} r={11} fill={c.dark}/><text x={b.x+10} y={b.y-2} textAnchor="middle" fontSize={9} fontWeight="800" fill="white">{node.id}</text></g>}{node.note&&<g><circle cx={b.x+NW-10} cy={b.y+16} r={8} fill="#F59E0B"/><text x={b.x+NW-10} y={b.y+20} textAnchor="middle" fontSize={9} fontWeight="800" fill="white">!</text></g>}<text x={b.x+NW-8} y={b.y+NH-6} textAnchor="end" fontSize={12}>{ACTORS.find(a=>a.id===node.actorId)?.emoji}</text></g>);
}

function Detail({node,onClose}){
  if(!node||node.type==="start"||node.type==="end")return null;
  const c=AC[node.actorId]||{bg:"#F1F5F9",border:"#94A3B8",text:"#64748B"};
  const actor=ACTORS.find(a=>a.id===node.actorId);
  return(
    <div style={{background:"#fff",border:`2px solid ${c.border}55`,borderRadius:"16px",padding:"20px",boxShadow:`0 4px 24px ${c.border}22`,marginTop:"16px"}}>
      <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:"14px"}}>
        <div style={{display:"flex",gap:"12px",alignItems:"center"}}>
          <div style={{width:"44px",height:"44px",borderRadius:"12px",background:c.bg,border:`1px solid ${c.border}44`,display:"flex",alignItems:"center",justifyContent:"center",fontSize:"20px"}}>{node.icon}</div>
          <div><div style={{fontSize:"15px",fontWeight:"800",color:"#0F172A"}}>{node.label.replace("\n"," ")}</div><div style={{fontSize:"12px",color:c.text,fontWeight:"600"}}>{actor?.emoji} {actor?.name}</div></div>
        </div>
        <button onClick={onClose} style={{background:"#F1F5F9",border:"none",borderRadius:"8px",padding:"6px 14px",cursor:"pointer",fontSize:"13px",color:"#64748B",fontWeight:"600"}}>✕ Close</button>
      </div>
      <p style={{fontSize:"13px",color:"#64748B",lineHeight:1.6,fontStyle:"italic",borderLeft:`3px solid ${c.border}55`,paddingLeft:"12px",marginBottom:"16px"}}>{node.desc}</p>
      <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:"16px"}}>
        <div>
          <div style={{fontSize:"11px",fontWeight:"700",color:c.text,letterSpacing:"1px",marginBottom:"10px"}}>PROCESS STEPS</div>
          {node.steps?.map((s,i)=>(
            <div key={i} style={{display:"flex",gap:"8px",marginBottom:"7px",alignItems:"flex-start"}}>
              <span style={{minWidth:"20px",height:"20px",borderRadius:"5px",background:c.bg,display:"flex",alignItems:"center",justifyContent:"center",fontSize:"10px",color:c.text,fontWeight:"700",flexShrink:0,marginTop:"1px"}}>{i+1}</span>
              <span style={{fontSize:"13px",color:"#475569",lineHeight:1.5}}>{s}</span>
            </div>
          ))}
          {node.yes&&<div style={{marginTop:"10px",background:"#FFFBEB",border:"1px solid #FDE68A",borderRadius:"10px",padding:"10px 14px",fontSize:"12px"}}><div style={{fontWeight:"700",color:"#92400E",marginBottom:"6px"}}>◆ Decision Point</div><div style={{color:"#065F46",marginBottom:"3px"}}>✅ YES → {node.yes}</div><div style={{color:"#DC2626"}}>❌ NO → {node.no}</div></div>}
        </div>
        <div>
          <div style={{fontSize:"11px",fontWeight:"700",color:c.text,letterSpacing:"1px",marginBottom:"10px"}}>OUTPUT</div>
          <div style={{background:c.bg,border:`1px solid ${c.border}44`,borderRadius:"10px",padding:"12px 14px",fontSize:"13px",color:"#1E293B",marginBottom:"12px",lineHeight:1.5}}>✅ {node.output}</div>
          {node.note&&<div style={{background:"#FFFBEB",border:"1px solid #FDE68A",borderRadius:"10px",padding:"10px 14px",fontSize:"12px",color:"#92400E",lineHeight:1.5}}>⚠️ {node.note}</div>}
        </div>
      </div>
    </div>
  );
}

export default function App(){
  const [active,setActive]=useState(null);
  const allC=["#10B981","#EF4444","#6366F1","#F59E0B","#94A3B8","#4F46E5","#D97706","#059669","#DC2626","#8B5CF6"];
  const maxX=Math.max(...NODES.map(n=>nb(n).x+nb(n).w))+80;
  const maxY=Math.max(...NODES.map(n=>nb(n).y+nb(n).h))+60;
  return(
    <div style={{minHeight:"100vh",background:"#F8FAFF",fontFamily:"'Segoe UI',sans-serif"}}>
      <div style={{background:"white",borderBottom:"1px solid #E2E8F0",padding:"0 24px",height:"52px",display:"flex",alignItems:"center",justifyContent:"space-between",position:"sticky",top:0,zIndex:10}}>
        <div style={{display:"flex",alignItems:"center",gap:"8px"}}>
          <div style={{width:"30px",height:"30px",borderRadius:"8px",background:"linear-gradient(135deg,#6366F1,#8B5CF6)",display:"flex",alignItems:"center",justifyContent:"center",fontSize:"14px"}}>🧠</div>
          <span style={{fontSize:"16px",fontWeight:"800",background:"linear-gradient(135deg,#6366F1,#8B5CF6)",WebkitBackgroundClip:"text",WebkitTextFillColor:"transparent"}}>MindMap AI</span>
        </div>
        <div style={{background:"#EEF2FF",border:"1px solid #C7D2FE",borderRadius:"20px",padding:"3px 10px",fontSize:"11px",color:"#6366F1",fontWeight:"700"}}>✦ Visio-Style Preview</div>
      </div>
      <div style={{padding:"20px",maxWidth:"1500px",margin:"0 auto"}}>
        <div style={{textAlign:"center",marginBottom:"16px"}}>
          <h2 style={{fontSize:"20px",fontWeight:"900",color:"#0F172A",margin:"0 0 6px"}}>Monthly Business Unit Charging Process</h2>
          <p style={{color:"#64748B",fontSize:"12px",margin:"0 0 12px"}}>Generated from Lucas & Himanshu transcript · Click any shape for details</p>
          <div style={{display:"flex",gap:"8px",justifyContent:"center",flexWrap:"wrap"}}>
            {Object.entries(AC).map(([id,c])=>{const a=ACTORS.find(x=>x.id===id);return a?(<div key={id} style={{display:"flex",alignItems:"center",gap:"5px",background:c.bg,border:`1px solid ${c.border}55`,borderRadius:"20px",padding:"3px 10px",fontSize:"11px",color:c.text,fontWeight:"600"}}>{a.emoji} {a.name}</div>):null;})}
          </div>
        </div>
        <div style={{background:"#fff",borderRadius:"16px",border:"1px solid #E2E8F0",boxShadow:"0 2px 16px rgba(99,102,241,0.06)",overflowX:"auto",padding:"16px"}}>
          <svg width={maxX} height={maxY} style={{display:"block",minWidth:maxX}}>
            <defs>
              <pattern id="dots" width="20" height="20" patternUnits="userSpaceOnUse"><circle cx="2" cy="2" r="1" fill="#E2E8F0"/></pattern>
              {allC.map(c=><marker key={c} id={`mk${c.replace('#','')}`} viewBox="0 0 10 10" refX="9" refY="5" markerWidth="6" markerHeight="6" orient="auto"><path d="M 0 0 L 10 5 L 0 10 z" fill={c}/></marker>)}
            </defs>
            <rect width={maxX} height={maxY} fill="#F8FAFF"/>
            <rect width={maxX} height={maxY} fill="url(#dots)"/>
            {ARROWS.map((a,i)=><Arr key={i} arr={a} nodes={NODES}/>)}
            {NODES.map(n=><Nd key={n.id} node={n} active={active?.id===n.id} onClick={()=>setActive(active?.id===n.id?null:n)}/>)}
          </svg>
        </div>
        {active&&<Detail node={active} onClose={()=>setActive(null)}/>}
        <div style={{background:"#fff",border:"1px solid #E2E8F0",borderRadius:"14px",padding:"16px 18px",marginTop:"12px"}}>
          <div style={{fontSize:"11px",fontWeight:"700",color:"#6366F1",letterSpacing:"1px",marginBottom:"10px"}}>✦ KEY INSIGHTS</div>
          {["⚠️ CRITICAL: File must be semicolon-separated — comma format breaks Controlling's import","🔐 GSOP password resets affect Cockpit — Alberto must ALWAYS be notified","📅 Hard deadline: Charging must complete within first 5 working days","🔑 VDI credentials in Keeper — to be shared with Himanshu","🏢 VDI access: Lucas, Himanshu, Alberto, Dominic (admin) only"].map((ins,i)=>(
            <div key={i} style={{fontSize:"12px",color:"#475569",marginBottom:"7px",paddingLeft:"12px",borderLeft:"3px solid #6366F133",lineHeight:1.5}}>{ins}</div>
          ))}
        </div>
      </div>
    </div>
  );
}