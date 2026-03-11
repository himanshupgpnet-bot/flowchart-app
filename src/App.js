import { useState, useRef, useCallback, useEffect, useMemo } from "react";

const COLORS = ["#6366F1","#8B5CF6","#06B6D4","#10B981","#F59E0B","#EF4444","#EC4899","#3B82F6"];

// ── STORAGE ───────────────────────────────────────────────────────────────────
const LS = {
  get: (k) => { try { const v=localStorage.getItem(k); return v?JSON.parse(v):null; } catch { return null; } },
  set: (k,v) => { try { localStorage.setItem(k,JSON.stringify(v)); } catch {} },
  del: (k) => { try { localStorage.removeItem(k); } catch {} },
};
const KEYS = { USER:"fs_user", SESSION:"fs_session", APIKEY:"fs_apikey", HISTORY:"fs_history" };
const hashPassword = (pw) => { let h=5381; for(let i=0;i<pw.length;i++) h=((h<<5)+h)^pw.charCodeAt(i); return (h>>>0).toString(36); };

const extractJSON = (text) => {
  try { const m=text.match(/```json\s*([\s\S]*?)```/)||text.match(/(\{[\s\S]*\})/); if(m) return JSON.parse(m[1]); return JSON.parse(text); } catch { return null; }
};

async function analyzeTranscript(text, apiKey) {
  const r = await fetch("https://api.anthropic.com/v1/messages", {
    method:"POST",
    headers:{"Content-Type":"application/json","x-api-key":apiKey,"anthropic-version":"2023-06-01","anthropic-dangerous-direct-browser-access":"true"},
    body: JSON.stringify({
      model:"claude-haiku-4-5-20251001", max_tokens:2000,
      messages:[{role:"user",content:`You are a business process analyst. Extract a flowchart from this transcript.\nReturn ONLY valid JSON:\n{"title":"short title","summary":"one sentence","actors":[{"id":"a1","name":"Name","emoji":"👤","color":"#6366F1"}],"nodes":[{"id":"n1","type":"start","label":"Start"},{"id":"n2","type":"process","label":"Step title","actorId":"a1","description":"what happens","steps":["step1"],"output":"result","note":""},{"id":"n3","type":"decision","label":"Decision?","question":"yes or no question","yes":"path if yes","no":"path if no"},{"id":"n4","type":"end","label":"End"}],"edges":[{"from":"n1","to":"n2","label":""},{"from":"n3","to":"n2","label":"YES"},{"from":"n3","to":"n4","label":"NO"}],"keyInsights":["insight1"]}\nRules:\n- Always start with a "start" node and end with one or more "end" nodes\n- Use "decision" nodes for yes/no branches with YES and NO edges\n- "process" nodes for regular steps\n- edges connect nodes with "from" and "to" matching node ids\n- label edges coming out of decisions as "YES" or "NO"\n- 5-12 nodes total\nTRANSCRIPT: ${text.substring(0,8000)}`}]
    })
  });
  if (!r.ok) { const e=await r.json(); throw new Error(e?.error?.message||"API Error"); }
  const data = await r.json();
  const raw = data.content?.map(c=>c.text||"").join("")||"";
  const parsed = extractJSON(raw);
  if (!parsed) throw new Error("Could not parse AI response. Please try again.");
  return parsed;
}

// ── EXPORTS ───────────────────────────────────────────────────────────────────
function doExportHTML(data) {
  const html=`<!DOCTYPE html><html><head><meta charset="UTF-8"/><title>${data.title}</title>
<style>*{box-sizing:border-box;margin:0;padding:0}body{background:#F8F9FF;font-family:'Segoe UI',sans-serif;padding:40px 20px}
.w{max-width:900px;margin:0 auto}h1{font-size:26px;font-weight:700;color:#0F172A;text-align:center;margin-bottom:8px}
.sum{text-align:center;color:#64748B;margin-bottom:28px}
svg{display:block;margin:0 auto}
.footer{text-align:center;margin-top:32px;font-size:11px;color:#94A3B8;letter-spacing:1px}</style></head><body>
<div class="w"><h1>${data.title}</h1><p class="sum">${data.summary}</p>
<p style="text-align:center;color:#6366F1;font-size:13px;margin-bottom:20px">Interactive flowchart — open in browser</p>
<div class="footer">FLOWSCRIBE AI</div></div></body></html>`;
  const b=new Blob([html],{type:"text/html"});const u=URL.createObjectURL(b);
  const a=document.createElement("a");a.href=u;a.download=`${data.title.replace(/\s+/g,"_")}.html`;a.click();URL.revokeObjectURL(u);
}
function doExportWord(data) {
  const nodes=data.nodes||[];const actors=data.actors||[];
  const processes=nodes.filter(n=>n.type==="process");
  const decisions=nodes.filter(n=>n.type==="decision");
  const body=`<h1 style="color:#4F46E5">${data.title}</h1><p style="color:#64748B;font-style:italic">${data.summary}</p><br/>
<h2>Participants</h2><table border="1" cellpadding="8" style="border-collapse:collapse;width:100%;margin-bottom:20px">
<tr style="background:#EEF2FF"><th>Actor</th><th>Name</th></tr>
${actors.map(a=>`<tr><td>${a.emoji}</td><td>${a.name}</td></tr>`).join("")}</table>
<h2>Process Steps</h2>
${processes.map((n,i)=>{const actor=actors.find(a=>a.id===n.actorId);return`
<h3 style="color:#4F46E5">Step ${i+1}: ${n.label}</h3>
${actor?`<p><b>Owner:</b> ${actor.emoji} ${actor.name}</p>`:""}
${n.description?`<p><i>${n.description}</i></p>`:""}
${n.steps?.length?`<ol>${n.steps.map(s=>`<li>${s}</li>`).join("")}</ol>`:""}
${n.output?`<p><b>Output:</b> ${n.output}</p>`:""}
${n.note?`<p><b>Note:</b> ${n.note}</p>`:""}
<hr/>`}).join("")}
${decisions.length?`<h2>Decision Points</h2>${decisions.map(n=>`<p>◆ <b>${n.label}</b>: ${n.question} → YES: ${n.yes} / NO: ${n.no}</p>`).join("")}`:""}
<h2>Key Insights</h2><ul>${(data.keyInsights||[]).map(i=>`<li>${i}</li>`).join("")}</ul>`;
  const full=`<html xmlns:o='urn:schemas-microsoft-com:office:office' xmlns:w='urn:schemas-microsoft-com:office:word' xmlns='http://www.w3.org/TR/REC-html40'><head><meta charset='utf-8'><title>${data.title}</title><style>body{font-family:Calibri,sans-serif;font-size:11pt;margin:2cm}</style></head><body>${body}</body></html>`;
  const b=new Blob(['\ufeff',full],{type:"application/msword"});const u=URL.createObjectURL(b);
  const a=document.createElement("a");a.href=u;a.download=`${data.title.replace(/\s+/g,"_")}.doc`;a.click();URL.revokeObjectURL(u);
}
function doExportPDF(data) {
  const nodes=data.nodes||[];const actors=data.actors||[];
  const html=`<!DOCTYPE html><html><head><meta charset="UTF-8"/><title>${data.title}</title>
<style>@page{margin:1.8cm;size:A4}body{font-family:'Segoe UI',sans-serif;font-size:10pt;color:#0F172A;line-height:1.6}
h1{font-size:18pt;color:#4F46E5;font-weight:700}
.node{border-radius:8px;padding:12px;margin-bottom:8px;page-break-inside:avoid}
.footer{text-align:center;font-size:8pt;color:#94A3B8;margin-top:20px}
.print-btn{position:fixed;top:16px;right:16px;background:#4F46E5;color:white;border:none;border-radius:8px;padding:10px 20px;cursor:pointer;font-weight:600}
@media print{.print-btn{display:none}}</style></head><body>
<button class="print-btn" onclick="window.print()">Save PDF</button>
<h1>${data.title}</h1><p style="color:#64748B;margin-bottom:16px">${data.summary}</p>
${nodes.filter(n=>n.type!=="start"&&n.type!=="end").map((n,i)=>{
  const c=n.type==="decision"?"#F59E0B":"#6366F1";
  const actor=actors.find(a=>a.id===n.actorId);
  return`<div class="node" style="border-left:4px solid ${c};background:${c}08">
<b style="color:${c}">${n.type==="decision"?"◆":"●"} ${n.label}</b>${actor?` <span style="color:#64748B;font-size:9pt">— ${actor.emoji} ${actor.name}</span>`:""}
${n.description?`<br/><i style="font-size:9pt">${n.description}</i>`:""}
${n.steps?.length?`<br/>${n.steps.map((s,j)=>`${j+1}. ${s}`).join(" · ")}`:""}
${n.output?`<br/><span style="color:${c}">✓ ${n.output}</span>`:""}
${n.note?`<br/><span style="color:#92400E">⚠️ ${n.note}</span>`:""}
${n.type==="decision"?`<br/><span style="color:#065F46">✅ YES → ${n.yes}</span> &nbsp; <span style="color:#991B1B">❌ NO → ${n.no}</span>`:""}
</div>`}).join("")}
<div style="margin-top:16px;border:1px solid #E2E8F0;border-radius:8px;padding:14px">
<b style="font-size:9pt;color:#6366F1;text-transform:uppercase;letter-spacing:1.5px">Key Insights</b>
${(data.keyInsights||[]).map(i=>`<div style="font-size:9pt;color:#475569;margin-top:6px;padding-left:10px;border-left:2px solid #6366F133">${i}</div>`).join("")}</div>
<div class="footer">FLOWSCRIBE AI</div></body></html>`;
  const w=window.open('','_blank');w.document.write(html);w.document.close();
}
function doExportPPT(data) {
  const nodes=data.nodes||[];const actors=data.actors||[];
  const processes=nodes.filter(n=>n.type==="process");
  const slides=[
    `<div class="slide" style="background:linear-gradient(135deg,#4F46E5,#7C3AED);display:flex;flex-direction:column;align-items:center;justify-content:center;text-align:center;padding:60px">
    <h1 style="font-size:30pt;font-weight:800;color:white;margin-bottom:14px">${data.title}</h1>
    <p style="font-size:13pt;color:rgba(255,255,255,0.8);max-width:560px;line-height:1.6">${data.summary}</p>
    <div style="display:flex;gap:10px;flex-wrap:wrap;justify-content:center;margin-top:28px">
      ${actors.map(a=>`<div style="background:rgba(255,255,255,0.2);border-radius:20px;padding:5px 16px;font-size:11pt;color:white">${a.emoji} ${a.name}</div>`).join("")}
    </div></div>`,
    ...processes.map((n,idx)=>{const c=COLORS[idx%COLORS.length];const actor=actors.find(a=>a.id===n.actorId);return`
    <div class="slide" style="padding:44px 52px;background:#FAFBFF">
      <div style="display:flex;align-items:center;gap:14px;margin-bottom:24px;padding-bottom:16px;border-bottom:2px solid #F1F5F9">
        <div style="width:44px;height:44px;border-radius:10px;background:${c}15;display:flex;align-items:center;justify-content:center;font-size:22px">●</div>
        <div><div style="font-size:16pt;font-weight:700">${n.label}</div><div style="font-size:10pt;color:${c}">${actor?.name||""}</div></div></div>
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:28px">
        <div>${(n.steps||[]).map((s,i)=>`<div style="display:flex;gap:10px;margin-bottom:9px"><div style="min-width:22px;height:22px;border-radius:6px;background:${c}15;color:${c};font-size:9pt;font-weight:700;display:flex;align-items:center;justify-content:center">${i+1}</div><div style="font-size:10pt;color:#475569">${s}</div></div>`).join("")}</div>
        <div>${n.output?`<div style="background:${c}0D;border:1px solid ${c}22;border-radius:10px;padding:14px;font-size:10pt">✓ ${n.output}</div>`:""}</div>
      </div></div>`}).join(""),
    `<div class="slide" style="padding:44px 52px;background:#FAFBFF">
    <div style="font-size:9pt;font-weight:700;color:#6366F1;letter-spacing:2px;text-transform:uppercase;margin-bottom:24px">Key Insights</div>
    ${(data.keyInsights||[]).map((ins,i)=>`<div style="display:flex;gap:14px;margin-bottom:14px"><div style="min-width:28px;height:28px;border-radius:8px;background:linear-gradient(135deg,#6366F1,#8B5CF6);color:white;font-size:10pt;font-weight:700;display:flex;align-items:center;justify-content:center">${i+1}</div><span style="font-size:11pt;color:#374151;line-height:1.6">${ins}</span></div>`).join("")}</div>`
  ];
  const full=`<!DOCTYPE html><html><head><meta charset="UTF-8"/><title>${data.title}</title>
<style>*{box-sizing:border-box;margin:0;padding:0}body{background:#F1F5F9;font-family:'Segoe UI',sans-serif;padding:20px}
.slide{width:960px;min-height:540px;border-radius:12px;margin:0 auto 20px;overflow:hidden;box-shadow:0 8px 32px rgba(0,0,0,0.12)}
@media print{body{background:white;padding:0}.slide{margin:0;page-break-after:always;border-radius:0}}</style>
</head><body>${slides.join("")}</body></html>`;
  const b=new Blob([full],{type:"text/html"});const u=URL.createObjectURL(b);
  const a=document.createElement("a");a.href=u;a.download=`${data.title.replace(/\s+/g,"_")}_slides.html`;a.click();URL.revokeObjectURL(u);
}

// ══════════════════════════════════════════════════════════════════════════════
// ── SVG FLOWCHART ENGINE  (fixed text wrap + edit mode) ───────────────────────
// ══════════════════════════════════════════════════════════════════════════════

const NODE_W    = 220;
const NODE_H    = 72;
const DEC_W     = 200;
const DEC_H     = 72;
const LEVEL_GAP = 110;
const BRANCH_GAP= 280;

// Wrap text into lines fitting maxW chars
function wrapText(text, maxChars) {
  if (!text) return [""];
  const words = text.split(" ");
  const lines = [];
  let cur = "";
  words.forEach(w => {
    if ((cur + " " + w).trim().length <= maxChars) {
      cur = (cur + " " + w).trim();
    } else {
      if (cur) lines.push(cur);
      cur = w.substring(0, maxChars);
    }
  });
  if (cur) lines.push(cur);
  return lines.slice(0, 3); // max 3 lines
}

// Render multi-line SVG text centered
function SvgText({ x, y, text, fontSize, fontWeight, fill, maxChars, lineH, fontFamily }) {
  const lines = wrapText(text, maxChars || 20);
  const totalH = lines.length * (lineH || (fontSize * 1.35));
  const startY = y - totalH / 2 + (lineH || (fontSize * 1.35)) * 0.7;
  return (
    <>
      {lines.map((l, i) => (
        <text key={i} x={x} y={startY + i * (lineH || (fontSize * 1.35))}
          textAnchor="middle" fontSize={fontSize} fontWeight={fontWeight || "600"}
          fill={fill} fontFamily={fontFamily || "Plus Jakarta Sans, sans-serif"}
          style={{ userSelect:"none" }}>
          {l}
        </text>
      ))}
    </>
  );
}

function layoutGraph(nodes, edges) {
  if (!nodes?.length) return { positioned:[], svgEdges:[], width:400, height:400 };

  const children = {}, parents = {};
  nodes.forEach(n => { children[n.id]=[]; parents[n.id]=[]; });
  edges.forEach(e => {
    if (children[e.from]) children[e.from].push({ to:e.to, label:e.label||"" });
    if (parents[e.to])    parents[e.to].push(e.from);
  });

  // BFS levels
  const levels = {};
  const startNode = nodes.find(n=>n.type==="start")||nodes[0];
  const queue = [{ id:startNode.id, level:0 }];
  const visited = new Set();
  while (queue.length) {
    const { id, level } = queue.shift();
    if (visited.has(id)) continue;
    visited.add(id);
    levels[id] = Math.max(levels[id]||0, level);
    (children[id]||[]).forEach(c => { if (!visited.has(c.to)) queue.push({ id:c.to, level:level+1 }); });
  }
  nodes.forEach(n => { if (levels[n.id]===undefined) levels[n.id]=0; });

  const byLevel = {};
  nodes.forEach(n => {
    const l = levels[n.id];
    if (!byLevel[l]) byLevel[l] = [];
    byLevel[l].push(n.id);
  });

  const maxLevel = Math.max(...Object.values(levels));
  const VGAP = LEVEL_GAP + NODE_H;
  const positions = {};

  for (let l=0; l<=maxLevel; l++) {
    const grp = byLevel[l]||[];
    grp.forEach((id,i) => {
      const totalW = grp.length * NODE_W + (grp.length-1) * BRANCH_GAP;
      positions[id] = {
        x: 400 + i*(NODE_W+BRANCH_GAP) - (grp.length-1)*(NODE_W+BRANCH_GAP)/2,
        y: 60 + l * VGAP,
      };
    });
  }

  const positioned = nodes.map(n => ({ ...n, ...positions[n.id] }));
  const maxY = Math.max(...positioned.map(n=>(n.y||0)+NODE_H));
  const maxX = Math.max(...positioned.map(n=>(n.x||0)+NODE_W));
  return { positioned, svgEdges:edges, width:Math.max(maxX+260,800), height:maxY+140 };
}

// ── EDIT MODAL ────────────────────────────────────────────────────────────────
function EditModal({ node, actors, onSave, onClose }) {
  const [label, setLabel]       = useState(node.label||"");
  const [desc,  setDesc]        = useState(node.description||"");
  const [steps, setSteps]       = useState((node.steps||[]).join("\n"));
  const [output,setOutput]      = useState(node.output||"");
  const [note,  setNote]        = useState(node.note||"");
  const [actorId,setActorId]    = useState(node.actor||node.actorId||"");

  const save = () => {
    onSave({
      ...node,
      label,
      description: desc,
      steps: steps.split("\n").map(s=>s.trim()).filter(Boolean),
      output,
      note,
      actor: actorId,
      actorId,
    });
  };

  const inputStyle = {
    width:"100%", fontFamily:"Plus Jakarta Sans,sans-serif", fontSize:"13px",
    color:"#0F172A", background:"#F8F9FF", border:"1.5px solid #E4E7F0",
    borderRadius:"9px", padding:"9px 12px", outline:"none",
    transition:"border 0.2s", boxSizing:"border-box", marginBottom:"0",
  };
  const labelStyle = {
    fontSize:"10px", fontWeight:"700", letterSpacing:"1.2px",
    textTransform:"uppercase", color:"#94A3B8", marginBottom:"5px", display:"block",
  };

  return (
    <div style={{ position:"fixed", inset:0, background:"rgba(0,0,0,0.55)", zIndex:9999,
      display:"flex", alignItems:"center", justifyContent:"center", padding:"16px",
      backdropFilter:"blur(4px)", animation:"fadeIn 0.2s ease" }}>
      <div style={{ background:"white", borderRadius:"20px", padding:"28px",
        width:"100%", maxWidth:"500px", maxHeight:"90vh", overflowY:"auto",
        boxShadow:"0 24px 80px rgba(0,0,0,0.25)", animation:"cardIn 0.3s cubic-bezier(0.34,1.3,0.64,1)" }}>

        <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", marginBottom:"22px" }}>
          <div>
            <div style={{ fontSize:"16px", fontWeight:"800", color:"#0F172A" }}>Edit Node</div>
            <div style={{ fontSize:"12px", color:"#94A3B8", marginTop:"2px" }}>
              {node.type==="decision"?"Decision node":"Process node"}
            </div>
          </div>
          <button onClick={onClose} style={{ background:"#F1F5F9", border:"none", borderRadius:"10px",
            width:"36px", height:"36px", cursor:"pointer", fontSize:"18px", color:"#64748B",
            display:"flex", alignItems:"center", justifyContent:"center" }}>×</button>
        </div>

        <div style={{ marginBottom:"14px" }}>
          <label style={labelStyle}>Label</label>
          <input style={inputStyle} value={label} onChange={e=>setLabel(e.target.value)}
            onFocus={e=>e.target.style.borderColor="#6366F1"}
            onBlur={e=>e.target.style.borderColor="#E4E7F0"}
            placeholder="Node label"/>
        </div>

        {node.type==="process" && <>
          {actors?.length>0 && (
            <div style={{ marginBottom:"14px" }}>
              <label style={labelStyle}>Actor / Owner</label>
              <select style={{...inputStyle, cursor:"pointer"}} value={actorId}
                onChange={e=>setActorId(e.target.value)}>
                <option value="">— None —</option>
                {actors.map(a=><option key={a.id} value={a.id}>{a.name}</option>)}
              </select>
            </div>
          )}
          <div style={{ marginBottom:"14px" }}>
            <label style={labelStyle}>Description</label>
            <textarea style={{...inputStyle, minHeight:"64px", resize:"vertical", lineHeight:1.5}}
              value={desc} onChange={e=>setDesc(e.target.value)}
              onFocus={e=>e.target.style.borderColor="#6366F1"}
              onBlur={e=>e.target.style.borderColor="#E4E7F0"}
              placeholder="What happens in this step?"/>
          </div>
          <div style={{ marginBottom:"14px" }}>
            <label style={labelStyle}>Steps (one per line)</label>
            <textarea style={{...inputStyle, minHeight:"80px", resize:"vertical", lineHeight:1.6}}
              value={steps} onChange={e=>setSteps(e.target.value)}
              onFocus={e=>e.target.style.borderColor="#6366F1"}
              onBlur={e=>e.target.style.borderColor="#E4E7F0"}
              placeholder="Step 1&#10;Step 2&#10;Step 3"/>
          </div>
          <div style={{ marginBottom:"14px" }}>
            <label style={labelStyle}>Output</label>
            <input style={inputStyle} value={output} onChange={e=>setOutput(e.target.value)}
              onFocus={e=>e.target.style.borderColor="#6366F1"}
              onBlur={e=>e.target.style.borderColor="#E4E7F0"}
              placeholder="What does this step produce?"/>
          </div>
          <div style={{ marginBottom:"20px" }}>
            <label style={labelStyle}>Note / Warning</label>
            <input style={inputStyle} value={note} onChange={e=>setNote(e.target.value)}
              onFocus={e=>e.target.style.borderColor="#6366F1"}
              onBlur={e=>e.target.style.borderColor="#E4E7F0"}
              placeholder="Optional warning or note"/>
          </div>
        </>}

        <div style={{ display:"flex", gap:"10px" }}>
          <button onClick={onClose} style={{ flex:1, fontFamily:"Plus Jakarta Sans,sans-serif",
            fontSize:"14px", fontWeight:"600", padding:"11px", borderRadius:"10px",
            border:"1.5px solid #E4E7F0", background:"white", cursor:"pointer", color:"#64748B" }}>
            Cancel
          </button>
          <button onClick={save} style={{ flex:2, fontFamily:"Plus Jakarta Sans,sans-serif",
            fontSize:"14px", fontWeight:"700", padding:"11px", borderRadius:"10px",
            border:"none", background:"linear-gradient(135deg,#4F46E5,#7C3AED)",
            cursor:"pointer", color:"white",
            boxShadow:"0 4px 14px rgba(99,102,241,0.4)" }}>
            Save Changes ✓
          </button>
        </div>
      </div>
    </div>
  );
}

// ── SVG FLOWCHART ─────────────────────────────────────────────────────────────
function SvgFlowchart({ data, onDataChange }) {
  const [zoom,    setZoom]    = useState(1);
  const [editing, setEditing] = useState(null);
  const [selected,setSelected]= useState(null);

  const { positioned, svgEdges, width, height } = useMemo(
    () => layoutGraph(data.nodes, data.edges),
    [data.nodes, data.edges]
  );

  const getColor = useCallback((node) => {
    if (node.type==="start") return "#10B981";
    if (node.type==="end")   return "#EF4444";
    if (node.type==="decision") return "#F59E0B";
    const actor = data.actors?.find(a=>a.id===node.actor||a.id===node.actorId);
    return actor?.color||"#6366F1";
  }, [data.actors]);

  const handleEdit = (node) => {
    if (node.type==="start"||node.type==="end") return;
    setEditing(node);
  };

  const handleSave = (updatedNode) => {
    const newNodes = data.nodes.map(n => n.id===updatedNode.id ? updatedNode : n);
    onDataChange({ ...data, nodes:newNodes });
    setEditing(null);
  };

  const selectedNode = positioned.find(n=>n.id===selected);
  const selActor = selectedNode ? data.actors?.find(a=>a.id===(selectedNode.actor||selectedNode.actorId)) : null;

  // Draw edge path
  const getPath = (edge) => {
    const fn = positioned.find(n=>n.id===edge.from);
    const tn = positioned.find(n=>n.id===edge.to);
    if (!fn||!tn) return null;

    let x1=fn.x, y1=fn.type==="decision"?fn.y+DEC_H/2:fn.y+NODE_H;
    let x2=tn.x, y2=tn.type==="decision"?tn.y-DEC_H/2:tn.y;

    const isBranch = Math.abs(x1-x2) > 30;
    if (fn.type==="decision" && isBranch) {
      const side = x2>x1 ? 1 : -1;
      x1 = fn.x + side*(DEC_W/2);
      y1 = fn.y;
      return `M${x1},${y1} H${x2} V${y2}`;
    }
    const my = (y1+y2)/2;
    return `M${x1},${y1} C${x1},${my} ${x2},${my} ${x2},${y2}`;
  };

  const getEdgeLabelPos = (edge) => {
    const fn = positioned.find(n=>n.id===edge.from);
    const tn = positioned.find(n=>n.id===edge.to);
    if (!fn||!tn||!edge.label) return null;
    if (fn.type==="decision" && Math.abs(fn.x-tn.x)>30) {
      const side = tn.x>fn.x ? 1 : -1;
      return { x: fn.x + side*(DEC_W/2+28), y: fn.y };
    }
    const y1 = fn.type==="decision"?fn.y+DEC_H/2:fn.y+NODE_H;
    const y2 = tn.type==="decision"?tn.y-DEC_H/2:tn.y;
    return { x: fn.x+18, y: (y1+y2)/2 };
  };

  return (
    <div style={{ display:"flex", flexDirection:"column", height:"100%" }}>

      {/* Toolbar */}
      <div style={{ display:"flex", alignItems:"center", gap:"8px", padding:"10px 18px",
        borderBottom:"1px solid var(--border)", background:"white", flexShrink:0, flexWrap:"wrap" }}>
        <div style={{ display:"flex", alignItems:"center", gap:"6px" }}>
          <button onClick={()=>setZoom(z=>Math.max(0.3,z-0.1))}
            style={{ width:"30px",height:"30px",border:"1.5px solid var(--border)",borderRadius:"7px",
              background:"white",cursor:"pointer",fontSize:"17px",color:"var(--text2)",display:"flex",alignItems:"center",justifyContent:"center" }}>−</button>
          <span style={{ fontSize:"12px",fontWeight:700,color:"var(--indigo)",minWidth:"38px",textAlign:"center" }}>{Math.round(zoom*100)}%</span>
          <button onClick={()=>setZoom(z=>Math.min(2.5,z+0.1))}
            style={{ width:"30px",height:"30px",border:"1.5px solid var(--border)",borderRadius:"7px",
              background:"white",cursor:"pointer",fontSize:"17px",color:"var(--text2)",display:"flex",alignItems:"center",justifyContent:"center" }}>+</button>
          <button onClick={()=>setZoom(1)}
            style={{ fontSize:"11px",fontWeight:600,padding:"5px 10px",border:"1.5px solid var(--border)",
              borderRadius:"7px",background:"white",cursor:"pointer",color:"var(--text2)" }}>Reset</button>
        </div>
        <div style={{ flex:1 }}/>
        <div style={{ display:"flex", gap:"10px", fontSize:"11.5px", color:"var(--text3)", flexWrap:"wrap", alignItems:"center" }}>
          <span>🟢 Start/End</span><span>🟡 Decision</span><span>🟣 Process</span>
          <span style={{ fontStyle:"italic" }}>✏️ Double-click to edit</span>
        </div>
      </div>

      {/* Canvas */}
      <div style={{ flex:1, overflow:"auto", background:"#F8F9FF" }}>
        <div style={{ transform:`scale(${zoom})`, transformOrigin:"top center",
          transition:"transform 0.2s", padding:"24px", minWidth:"fit-content" }}>
          <svg width={width} height={height} style={{ display:"block", margin:"0 auto", overflow:"visible" }}>
            <defs>
              <marker id="arr-default" markerWidth="9" markerHeight="9" refX="7" refY="3.5" orient="auto">
                <path d="M0,0 L0,7 L9,3.5 z" fill="#6366F1" opacity="0.7"/>
              </marker>
              <marker id="arr-yes" markerWidth="9" markerHeight="9" refX="7" refY="3.5" orient="auto">
                <path d="M0,0 L0,7 L9,3.5 z" fill="#10B981"/>
              </marker>
              <marker id="arr-no" markerWidth="9" markerHeight="9" refX="7" refY="3.5" orient="auto">
                <path d="M0,0 L0,7 L9,3.5 z" fill="#EF4444"/>
              </marker>
              <filter id="node-shadow">
                <feDropShadow dx="0" dy="3" stdDeviation="7" floodColor="rgba(99,102,241,0.13)"/>
              </filter>
              <filter id="node-shadow-sel">
                <feDropShadow dx="0" dy="6" stdDeviation="14" floodColor="rgba(99,102,241,0.38)"/>
              </filter>
              {/* Grid dots */}
              <pattern id="dots" x="0" y="0" width="40" height="40" patternUnits="userSpaceOnUse">
                <circle cx="20" cy="20" r="1" fill="#DDE1F0"/>
              </pattern>
            </defs>

            {/* Background dots */}
            <rect width={width} height={height} fill="url(#dots)"/>

            {/* ── EDGES ── */}
            {svgEdges.map((edge,i) => {
              const path = getPath(edge);
              if (!path) return null;
              const isYes = edge.label==="YES";
              const isNo  = edge.label==="NO";
              const color = isYes?"#10B981":isNo?"#EF4444":"#6366F1";
              const marker= isYes?"arr-yes":isNo?"arr-no":"arr-default";
              const lp    = getEdgeLabelPos(edge);
              return (
                <g key={i}>
                  <path d={path} fill="none" stroke={color} strokeWidth="2"
                    strokeOpacity="0.65" markerEnd={`url(#${marker})`}/>
                  {lp && (
                    <g>
                      <rect x={lp.x-18} y={lp.y-11} width="36" height="20" rx="10"
                        fill={isYes?"#ECFDF5":isNo?"#FEF2F2":"#EEF2FF"}
                        stroke={isYes?"#6EE7B7":isNo?"#FCA5A5":"#C7D2FE"} strokeWidth="1.2"/>
                      <text x={lp.x} y={lp.y+4} textAnchor="middle"
                        fontSize="9.5" fontWeight="800"
                        fill={isYes?"#059669":isNo?"#DC2626":"#4F46E5"}
                        fontFamily="Plus Jakarta Sans,sans-serif">
                        {edge.label}
                      </text>
                    </g>
                  )}
                </g>
              );
            })}

            {/* ── NODES ── */}
            {positioned.map(node => {
              const color = getColor(node);
              const isSel = selected===node.id;
              const filt  = isSel?"url(#node-shadow-sel)":"url(#node-shadow)";
              const canEdit = node.type!=="start"&&node.type!=="end";
              const processIdx = positioned.filter(n=>n.type==="process").indexOf(node);

              // ── START / END oval ──
              if (node.type==="start"||node.type==="end") return (
                <g key={node.id} style={{cursor:"default"}}>
                  <ellipse cx={node.x} cy={node.y+NODE_H/2}
                    rx={NODE_W/2} ry={NODE_H/2-4}
                    fill={color} filter={filt}/>
                  <text x={node.x} y={node.y+NODE_H/2+5}
                    textAnchor="middle" fontSize="13" fontWeight="700"
                    fill="white" fontFamily="Plus Jakarta Sans,sans-serif">
                    {node.label||(node.type==="end"?"End":"Start")}
                  </text>
                </g>
              );

              // ── DECISION diamond ──
              if (node.type==="decision") {
                const hw=DEC_W/2, hh=DEC_H/2;
                const pts=`${node.x},${node.y-hh} ${node.x+hw},${node.y} ${node.x},${node.y+hh} ${node.x-hw},${node.y}`;
                const labelLines = wrapText(node.label||"", 16);
                const lineH = 14;
                const totalH = labelLines.length * lineH;
                return (
                  <g key={node.id} style={{cursor:canEdit?"pointer":"default"}}
                    onClick={()=>setSelected(isSel?null:node.id)}
                    onDoubleClick={()=>handleEdit(node)}>
                    <polygon points={pts} fill={color} filter={filt}
                      stroke={isSel?"white":"none"} strokeWidth="2.5"/>
                    {/* Edit icon */}
                    {canEdit && <text x={node.x+hw-10} y={node.y-hh+14} fontSize="10" fill="rgba(255,255,255,0.7)">✏️</text>}
                    {labelLines.map((l,li)=>(
                      <text key={li} x={node.x} y={node.y - totalH/2 + li*lineH + lineH*0.75}
                        textAnchor="middle" fontSize="11" fontWeight="700"
                        fill="white" fontFamily="Plus Jakarta Sans,sans-serif">
                        {l}
                      </text>
                    ))}
                  </g>
                );
              }

              // ── PROCESS rect ──
              const actor = data.actors?.find(a=>a.id===(node.actor||node.actorId));
              const labelLines = wrapText(node.label||"", 18);
              const actorName  = actor?.name||"";
              const actorLines = wrapText(actorName, 22);

              return (
                <g key={node.id} style={{cursor:"pointer"}}
                  onClick={()=>setSelected(isSel?null:node.id)}
                  onDoubleClick={()=>handleEdit(node)}>
                  {/* Card shadow */}
                  <rect x={node.x-NODE_W/2+3} y={node.y+5} width={NODE_W} height={NODE_H}
                    rx="14" fill="rgba(99,102,241,0.07)"/>
                  {/* Card body */}
                  <rect x={node.x-NODE_W/2} y={node.y} width={NODE_W} height={NODE_H}
                    rx="14" fill="white" filter={filt}
                    stroke={isSel?color:"#E4E7F0"} strokeWidth={isSel?2:1.5}/>
                  {/* Top accent bar */}
                  <rect x={node.x-NODE_W/2} y={node.y} width={NODE_W} height="4" rx="14" fill={color}/>
                  <rect x={node.x-NODE_W/2} y={node.y+2} width={NODE_W} height="2" fill={color}/>
                  {/* Icon circle */}
                  <circle cx={node.x-NODE_W/2+28} cy={node.y+NODE_H/2}
                    r="17" fill={`${color}14`} stroke={`${color}30`} strokeWidth="1.2"/>
                  <text x={node.x-NODE_W/2+28} y={node.y+NODE_H/2+5}
                    textAnchor="middle" fontSize="14" fontFamily="sans-serif">
                    {node.icon||"📋"}
                  </text>
                  {/* Edit icon top-right */}
                  <text x={node.x+NODE_W/2-22} y={node.y+18}
                    textAnchor="middle" fontSize="11" opacity="0.45">✏️</text>
                  {/* Step badge */}
                  {processIdx>=0 && (
                    <g>
                      <rect x={node.x+NODE_W/2-34} y={node.y+8} width="28" height="17" rx="5" fill={color}/>
                      <text x={node.x+NODE_W/2-20} y={node.y+20}
                        textAnchor="middle" fontSize="9" fontWeight="800"
                        fill="white" fontFamily="Plus Jakarta Sans,sans-serif">
                        {String(processIdx+1).padStart(2,"0")}
                      </text>
                    </g>
                  )}
                  {/* Label — wrapped, max 2 lines */}
                  {labelLines.map((l,li)=>(
                    <text key={li}
                      x={node.x-NODE_W/2+54}
                      y={actor ? node.y+22+li*16 : node.y+NODE_H/2-4+li*16}
                      fontSize="12" fontWeight="700" fill="#0F172A"
                      fontFamily="Plus Jakarta Sans,sans-serif">
                      {l}
                    </text>
                  ))}
                  {/* Actor name — wrapped */}
                  {actor && actorLines.map((l,li)=>(
                    <text key={li}
                      x={node.x-NODE_W/2+54}
                      y={node.y+22+labelLines.length*16+li*13+4}
                      fontSize="10" fontWeight="600" fill={color}
                      fontFamily="Plus Jakarta Sans,sans-serif">
                      {li===0?"💼 ":""}{l}
                    </text>
                  ))}
                </g>
              );
            })}
          </svg>
        </div>
      </div>

      {/* ── DETAIL PANEL ── */}
      {selectedNode && selectedNode.type==="process" && (
        <div style={{ background:"white", borderTop:"1.5px solid var(--border)",
          padding:"16px 22px", flexShrink:0, maxHeight:"210px", overflowY:"auto",
          animation:"slideUp 0.22s ease both" }}>
          <div style={{ display:"flex", alignItems:"center", gap:"12px", marginBottom:"12px" }}>
            <div style={{ width:"38px",height:"38px",borderRadius:"9px",
              background:`${getColor(selectedNode)}12`,border:`1.5px solid ${getColor(selectedNode)}28`,
              display:"flex",alignItems:"center",justifyContent:"center",fontSize:"19px" }}>
              {selectedNode.icon||"📋"}
            </div>
            <div style={{ flex:1 }}>
              <div style={{ fontSize:"14px",fontWeight:700 }}>{selectedNode.label}</div>
              {selActor&&<div style={{ fontSize:"11px",color:getColor(selectedNode),fontWeight:600 }}>💼 {selActor.name}</div>}
            </div>
            <button onClick={()=>handleEdit(selectedNode)}
              style={{ padding:"6px 14px",borderRadius:"8px",border:"1.5px solid #6366F1",
                background:"#EEF2FF",color:"#4F46E5",fontSize:"12px",fontWeight:700,cursor:"pointer" }}>
              ✏️ Edit
            </button>
            <button onClick={()=>setSelected(null)}
              style={{ background:"#F1F5F9",border:"none",cursor:"pointer",
                borderRadius:"8px",width:"32px",height:"32px",fontSize:"18px",color:"#64748B" }}>×</button>
          </div>
          {selectedNode.description&&<p style={{ fontSize:"12px",color:"var(--text2)",fontStyle:"italic",marginBottom:"10px",lineHeight:1.6 }}>{selectedNode.description}</p>}
          <div style={{ display:"grid",gridTemplateColumns:"1fr 1fr",gap:"16px" }}>
            {selectedNode.steps?.length>0&&(
              <div>
                <div style={{ fontSize:"10px",fontWeight:700,letterSpacing:"1.3px",color:"var(--text3)",textTransform:"uppercase",marginBottom:"7px" }}>Steps</div>
                {selectedNode.steps.map((s,i)=>(
                  <div key={i} style={{ display:"flex",gap:"7px",marginBottom:"5px",alignItems:"flex-start" }}>
                    <span style={{ minWidth:"18px",height:"18px",borderRadius:"4px",
                      background:`${getColor(selectedNode)}14`,border:`1px solid ${getColor(selectedNode)}28`,
                      display:"flex",alignItems:"center",justifyContent:"center",
                      fontSize:"9px",fontWeight:700,color:getColor(selectedNode),flexShrink:0 }}>{i+1}</span>
                    <span style={{ fontSize:"12px",color:"var(--text2)",lineHeight:1.4 }}>{s}</span>
                  </div>
                ))}
              </div>
            )}
            {selectedNode.output&&(
              <div>
                <div style={{ fontSize:"10px",fontWeight:700,letterSpacing:"1.3px",color:"var(--text3)",textTransform:"uppercase",marginBottom:"7px" }}>Output</div>
                <div style={{ padding:"8px 12px",background:`${getColor(selectedNode)}09`,
                  border:`1.5px solid ${getColor(selectedNode)}20`,borderRadius:"8px",
                  fontSize:"12px",lineHeight:1.5 }}>✓ {selectedNode.output}</div>
                {selectedNode.note&&<div style={{ marginTop:"7px",padding:"7px 10px",
                  background:"#FFFBEB",border:"1px solid #FDE68A",borderRadius:"7px",
                  fontSize:"11px",color:"#92400E" }}>⚠️ {selectedNode.note}</div>}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Edit Modal */}
      {editing && (
        <EditModal
          node={editing}
          actors={data.actors}
          onSave={handleSave}
          onClose={()=>setEditing(null)}
        />
      )}
    </div>
  );
}



// ── HISTORY SIDEBAR ───────────────────────────────────────────────────────────
function HistorySidebar({ history, currentId, onSelect, onDelete, onNew }) {
  return (
    <div className="sidebar">
      <div style={{padding:"14px 16px",borderBottom:"1px solid var(--border)",display:"flex",alignItems:"center",justifyContent:"space-between"}}>
        <div><div style={{fontSize:"12px",fontWeight:700}}>History</div><div style={{fontSize:"11px",color:"var(--text3)"}}>{history.length} flowchart{history.length!==1?"s":""}</div></div>
        <button className="btn btn-primary" onClick={onNew} style={{padding:"6px 12px",fontSize:"12px"}}>+ New</button>
      </div>
      {history.length===0?(
        <div style={{padding:"32px 16px",textAlign:"center"}}><div style={{fontSize:"28px",marginBottom:"8px"}}>📋</div><div style={{fontSize:"12px",color:"var(--text3)",lineHeight:1.5}}>Your flowcharts will appear here</div></div>
      ):history.map((item,i)=>(
        <div key={item.id} className={`sidebar-item${item.id===currentId?" active":""}`} onClick={()=>onSelect(item)} style={{animation:`fadeUp 0.3s ${i*0.05}s ease both`}}>
          <div style={{display:"flex",alignItems:"flex-start",justifyContent:"space-between",gap:"8px"}}>
            <div style={{flex:1,minWidth:0}}>
              <div style={{fontSize:"13px",fontWeight:600,marginBottom:"3px",whiteSpace:"nowrap",overflow:"hidden",textOverflow:"ellipsis"}}>{item.data.title}</div>
              <div style={{fontSize:"11px",color:"var(--text3)",marginBottom:"4px"}}>{new Date(item.createdAt).toLocaleDateString()} · {item.data.nodes?.filter(n=>n.type==="process").length||0} steps</div>
              <div style={{display:"flex",gap:"4px",flexWrap:"wrap"}}>
                {(item.data.actors||[]).slice(0,2).map((a,idx)=>(
                  <span key={idx} style={{fontSize:"10px",padding:"1px 7px",borderRadius:"10px",background:`${COLORS[idx%COLORS.length]}12`,color:COLORS[idx%COLORS.length],border:`1px solid ${COLORS[idx%COLORS.length]}25`,fontWeight:600}}>{a.emoji} {a.name}</span>
                ))}
              </div>
            </div>
            <button onClick={e=>{e.stopPropagation();onDelete(item.id);}} style={{background:"none",border:"none",cursor:"pointer",color:"var(--text3)",fontSize:"16px",padding:"0 2px",flexShrink:0,transition:"color 0.15s"}} onMouseEnter={e=>e.currentTarget.style.color="#EF4444"} onMouseLeave={e=>e.currentTarget.style.color="var(--text3)"}>×</button>
          </div>
        </div>
      ))}
    </div>
  );
}

// ── EXPORT BAR ────────────────────────────────────────────────────────────────
function ExportBar({ data }) {
  const [busy, setBusy] = useState(null);
  const go = (type,fn) => { setBusy(type); setTimeout(()=>{fn(data);setBusy(null);},200); };
  return (
    <div style={{display:"flex",gap:"8px",flexWrap:"wrap"}}>
      {[{type:"html",icon:"🌐",label:"HTML",fn:doExportHTML},{type:"word",icon:"📝",label:"Word",fn:doExportWord},{type:"pdf",icon:"📄",label:"PDF",fn:doExportPDF},{type:"ppt",icon:"📊",label:"Slides",fn:doExportPPT}].map(({type,icon,label,fn})=>(
        <button key={type} className="exp-btn" onClick={()=>go(type,fn)} disabled={!!busy}>
          {busy===type?<span style={{width:"12px",height:"12px",border:"2px solid #6366F144",borderTopColor:"#6366F1",borderRadius:"50%",display:"inline-block",animation:"spinSlow 0.7s linear infinite"}}/>:icon} {label}
        </button>
      ))}
    </div>
  );
}

// ── RESULT VIEW ───────────────────────────────────────────────────────────────
function ResultView({ data, onDataChange }) {
  return (
    <div style={{flex:1,display:"flex",flexDirection:"column",overflow:"hidden"}}>
      {/* Header */}
      <div style={{padding:"14px 22px",borderBottom:"1px solid var(--border)",background:"white",flexShrink:0}}>
        <div style={{display:"flex",alignItems:"center",gap:"14px",flexWrap:"wrap"}}>
          <div style={{flex:1,minWidth:0}}>
            <div style={{display:"inline-flex",alignItems:"center",gap:"6px",background:"#ECFDF5",border:"1px solid #A7F3D0",borderRadius:"20px",padding:"3px 12px",fontSize:"11px",fontWeight:700,color:"#065F46",marginBottom:"6px"}}>✅ Generated</div>
            <h1 style={{fontSize:"clamp(15px,2vw,20px)",fontWeight:800,letterSpacing:"-0.3px",marginBottom:"3px",whiteSpace:"nowrap",overflow:"hidden",textOverflow:"ellipsis"}}>{data.title}</h1>
            <p style={{fontSize:"12px",color:"var(--text2)",lineHeight:1.5,display:"-webkit-box",WebkitLineClamp:2,WebkitBoxOrient:"vertical",overflow:"hidden"}}>{data.summary}</p>
          </div>
          <div style={{display:"flex",gap:"6px",flexWrap:"wrap",alignItems:"center"}}>
            {(data.actors||[]).map((a,i)=>(
              <div key={a.id} style={{padding:"3px 10px",borderRadius:"20px",fontSize:"11px",fontWeight:600,border:`1.5px solid ${COLORS[i%COLORS.length]}33`,background:`${COLORS[i%COLORS.length]}0D`,color:COLORS[i%COLORS.length]}}>{a.name}</div>
            ))}
          </div>
        </div>
        <div style={{marginTop:"10px",display:"flex",alignItems:"center",gap:"10px",flexWrap:"wrap"}}>
          <div style={{display:"flex",gap:"14px",background:"var(--surface)",borderRadius:"10px",padding:"7px 14px",border:"1px solid var(--border)"}}>
            {[
              {n:data.nodes?.filter(n=>n.type==="process").length||0,l:"Steps",c:"#6366F1"},
              {n:data.nodes?.filter(n=>n.type==="decision").length||0,l:"Decisions",c:"#F59E0B"},
              {n:data.actors?.length||0,l:"Actors",c:"#8B5CF6"},
              {n:data.keyInsights?.length||0,l:"Insights",c:"#06B6D4"},
            ].map(({n,l,c})=>(
              <div key={l} style={{textAlign:"center"}}>
                <div style={{fontSize:"17px",fontWeight:800,color:c,lineHeight:1}}>{n}</div>
                <div style={{fontSize:"10px",color:"var(--text3)",fontWeight:600,marginTop:"2px"}}>{l}</div>
              </div>
            ))}
          </div>
          <ExportBar data={data}/>
        </div>
      </div>

      {/* SVG Canvas — fills remaining space */}
      <div style={{flex:1,overflow:"hidden",display:"flex",flexDirection:"column"}}>
        <SvgFlowchart data={data} onDataChange={onDataChange}/>
      </div>

      {/* Insights strip */}
      {data.keyInsights?.length>0&&(
        <div style={{padding:"10px 20px",borderTop:"1px solid var(--border)",background:"white",flexShrink:0}}>
          <div style={{display:"flex",gap:"8px",flexWrap:"wrap",alignItems:"center"}}>
            <span style={{fontSize:"11px",fontWeight:700,color:"var(--text3)",letterSpacing:"1px"}}>💡 INSIGHTS:</span>
            {data.keyInsights.map((ins,i)=>(
              <div key={i} style={{fontSize:"12px",color:"var(--text2)",padding:"4px 10px",background:`${COLORS[i%COLORS.length]}07`,borderLeft:`2px solid ${COLORS[i%COLORS.length]}44`,borderRadius:"0 6px 6px 0"}}>{ins}</div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// ── UPLOAD PANEL ──────────────────────────────────────────────────────────────
function UploadPanel({ onRun }) {
  const [dragOver, setDragOver] = useState(false);
  const [pasteText, setPasteText] = useState("");
  const [showPaste, setShowPaste] = useState(false);
  const fileRef = useRef(null);
  const readFile = (file) => new Promise((res,rej)=>{
    if(file.type==="application/pdf"){res(`[PDF: ${file.name}] Please paste text.`);return;}
    const r=new FileReader();r.onload=e=>res(e.target.result);r.onerror=rej;r.readAsText(file);
  });
  const handleDrop = async (e) => { e.preventDefault();setDragOver(false);const f=e.dataTransfer.files[0];if(f){const t=await readFile(f);onRun(t,f.name);} };
  const handleFile = async (e) => { const f=e.target.files[0];if(f){const t=await readFile(f);onRun(t,f.name);} };
  return (
    <div style={{flex:1,display:"flex",alignItems:"center",justifyContent:"center",padding:"40px 24px",overflowY:"auto"}}>
      <div style={{width:"100%",maxWidth:"520px"}}>
        <div style={{marginBottom:"32px",textAlign:"center"}}>
          <div style={{display:"inline-flex",alignItems:"center",gap:"6px",background:"#EEF2FF",border:"1px solid var(--border2)",borderRadius:"20px",padding:"5px 14px",fontSize:"12px",fontWeight:700,color:"#6366F1",marginBottom:"16px"}}>
            <span style={{width:"7px",height:"7px",borderRadius:"50%",background:"#6366F1",display:"inline-block",animation:"dotPulse 1.5s ease-in-out infinite"}}/>
            AI-Powered Flowchart Generator
          </div>
          <h1 style={{fontSize:"clamp(22px,3.5vw,34px)",fontWeight:800,lineHeight:1.1,letterSpacing:"-1px",marginBottom:"10px",animation:"titleReveal 0.6s 0.1s ease both",opacity:0,animationFillMode:"forwards"}}>
            Upload a document.<br/>
            <span style={{background:"linear-gradient(135deg,#4F46E5,#7C3AED)",WebkitBackgroundClip:"text",WebkitTextFillColor:"transparent"}}>Get a real flowchart.</span>
          </h1>
          <p style={{fontSize:"14px",color:"var(--text2)",lineHeight:1.7,animation:"fadeUp 0.5s 0.2s ease both",opacity:0,animationFillMode:"forwards"}}>
            With branching paths, decision diamonds, and YES/NO flows — just like a real process diagram.
          </p>
        </div>

        {/* Mini preview of what it produces */}
        <div className="card" style={{padding:"14px 18px",marginBottom:"20px",display:"flex",alignItems:"center",gap:"12px",animation:"fadeUp 0.5s 0.3s ease both",opacity:0,animationFillMode:"forwards"}}>
          <div style={{display:"flex",alignItems:"center",gap:"6px",fontSize:"12px",flexWrap:"wrap"}}>
            <div style={{padding:"4px 10px",background:"#4F46E5",borderRadius:"10px",color:"white",fontWeight:700,fontSize:"11px"}}>● Start</div>
            <span style={{color:"#6366F1",fontWeight:700}}>→</span>
            <div style={{padding:"4px 10px",background:"white",border:"2px solid #6366F1",borderRadius:"6px",fontWeight:600,fontSize:"11px"}}>Process</div>
            <span style={{color:"#6366F1",fontWeight:700}}>→</span>
            <div style={{padding:"4px 10px",background:"#FFFBEB",border:"2px solid #FDE68A",borderRadius:"4px",fontWeight:600,fontSize:"11px",color:"#92400E"}}>◆ Decision</div>
            <span style={{color:"#10B981",fontWeight:700}}>→YES</span>
            <div style={{padding:"4px 10px",background:"#10B981",borderRadius:"10px",color:"white",fontWeight:700,fontSize:"11px"}}>● End</div>
          </div>
        </div>

        <div className={`drop-zone${dragOver?" over":""}`} style={{marginBottom:"12px"}}
          onDragOver={e=>{e.preventDefault();setDragOver(true);}} onDragLeave={()=>setDragOver(false)}
          onDrop={handleDrop} onClick={()=>fileRef.current?.click()}>
          <div style={{fontSize:"36px",marginBottom:"10px",display:"inline-block",animation:"float 3s ease-in-out infinite"}}>{dragOver?"📂":"📁"}</div>
          <div style={{fontSize:"15px",fontWeight:700,marginBottom:"4px"}}>{dragOver?"Drop to analyze!":"Drop your document here"}</div>
          <div style={{fontSize:"13px",color:"var(--text3)",marginBottom:"14px"}}>or click to browse</div>
          <div style={{display:"flex",gap:"6px",justifyContent:"center",flexWrap:"wrap"}}>
            {[".TXT",".MD",".CSV",".DOCX",".PDF"].map(e=><span key={e} style={{fontSize:"11px",fontWeight:600,color:"#6366F1",padding:"3px 10px",background:"#EEF2FF",borderRadius:"5px",border:"1px solid #C7D2FE"}}>{e}</span>)}
          </div>
        </div>
        <input ref={fileRef} type="file" accept=".txt,.md,.csv,.pdf,.docx,.doc" onChange={handleFile} style={{display:"none"}}/>

        <div style={{display:"flex",alignItems:"center",gap:"14px",margin:"14px 0"}}>
          <div style={{flex:1,height:"1px",background:"linear-gradient(90deg,transparent,var(--border))"}}/>
          <span style={{fontSize:"12px",fontWeight:600,color:"var(--text3)"}}>or paste text</span>
          <div style={{flex:1,height:"1px",background:"linear-gradient(90deg,var(--border),transparent)"}}/>
        </div>

        <div className="card" style={{overflow:"hidden"}}>
          <div onClick={()=>setShowPaste(v=>!v)} style={{padding:"13px 18px",display:"flex",alignItems:"center",justifyContent:"space-between",cursor:"pointer",borderBottom:showPaste?"1.5px solid var(--border)":"none"}}>
            <div style={{display:"flex",alignItems:"center",gap:"10px"}}>
              <span style={{fontSize:"18px"}}>✏️</span>
              <div><div style={{fontSize:"14px",fontWeight:600}}>Paste transcript or text</div><div style={{fontSize:"12px",color:"var(--text3)"}}>Meeting notes, SOPs, process docs...</div></div>
            </div>
            <div style={{color:"var(--text3)",fontSize:"20px",fontWeight:700,transition:"transform 0.25s",transform:showPaste?"rotate(90deg)":"rotate(0)"}}>›</div>
          </div>
          {showPaste&&(
            <div style={{padding:"14px 18px 18px"}}>
              <textarea className="input" value={pasteText} onChange={e=>setPasteText(e.target.value)} autoFocus placeholder="Paste your document here..." style={{minHeight:"130px",resize:"vertical",lineHeight:1.65}}/>
              <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginTop:"10px"}}>
                <span style={{fontSize:"12px",color:pasteText.length<50?"var(--text3)":"#059669",fontWeight:500}}>{pasteText.length<50?`${pasteText.length}/50 min`:`✓ ${pasteText.length} chars`}</span>
                <div style={{display:"flex",gap:"8px"}}>
                  <button className="btn btn-secondary" onClick={()=>{setPasteText("");setShowPaste(false);}} style={{padding:"7px 14px",fontSize:"13px"}}>Clear</button>
                  <button className="btn btn-primary" onClick={()=>pasteText.trim().length>=50&&onRun(pasteText,"Pasted text")} disabled={pasteText.trim().length<50} style={{padding:"7px 18px",fontSize:"13px",opacity:pasteText.trim().length>=50?1:0.5}}>Analyze →</button>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ── MAIN APP ──────────────────────────────────────────────────────────────────
export default function App() {
  const getInitialScreen = () => {
    const session=LS.get(KEYS.SESSION); const user=LS.get(KEYS.USER); const apiKey=LS.get(KEYS.APIKEY);
    if(session&&user&&apiKey) return "app";
    if(session&&user&&!apiKey) return "apisetup";
    return "login";
  };
  const [screen, setScreen] = useState(getInitialScreen);
  // Safely extract username string (guards against old object accidentally stored)
  const [username, setUsername] = useState(() => {
    const session = LS.get(KEYS.SESSION);
    const raw = session?.username;
    if (raw && typeof raw === "object") return raw.username || "";
    return typeof raw === "string" ? raw : "";
  });
  const [apiKey, setApiKey] = useState(()=>LS.get(KEYS.APIKEY)||"");
  const [history, setHistory] = useState(()=>LS.get(KEYS.HISTORY)||[]);
  const [currentData, setCurrentData] = useState(null);
  const [currentId, setCurrentId] = useState(null);
  const [stage, setStage] = useState("upload");
  const [progress, setProgress] = useState("");
  const [progressPct, setProgressPct] = useState(0);
  const [errorMsg, setErrorMsg] = useState("");
  const [showHistory, setShowHistory] = useState(true);

  // ── Sanitize localStorage on mount ──────────────────────────────────────────
  useEffect(() => {
    // Fix session if username was accidentally stored as an object
    const session = LS.get(KEYS.SESSION);
    if (session && typeof session.username === "object") {
      const fixed = { ...session, username: session.username?.username || "" };
      LS.set(KEYS.SESSION, fixed);
      setUsername(fixed.username);
    }
    // Fix user record if it somehow got double-wrapped
    const user = LS.get(KEYS.USER);
    if (user && typeof user.username === "object") {
      LS.set(KEYS.USER, { username: user.username?.username || "", passwordHash: user.passwordHash });
    }
  }, []);

  const handleLogin = (uname, hasKey) => { setUsername(uname); if(hasKey){setApiKey(LS.get(KEYS.APIKEY));setScreen("app");}else setScreen("apisetup"); };
  const handleApiDone = (key) => { setApiKey(key); setScreen("app"); };

  const run = useCallback(async (text, name) => {
    setStage("processing"); setProgress("Reading document…"); setProgressPct(15);
    try {
      setProgress("AI analyzing & building flowchart…"); setProgressPct(45);
      const result = await analyzeTranscript(text, apiKey);
      setProgress("Laying out flowchart…"); setProgressPct(88);
      await new Promise(r=>setTimeout(r,300));
      setProgressPct(100); await new Promise(r=>setTimeout(r,200));
      const id=Date.now().toString();
      const item={id,createdAt:new Date().toISOString(),fileName:name,data:result};
      const newH=[item,...history]; setHistory(newH); LS.set(KEYS.HISTORY,newH);
      setCurrentData(result); setCurrentId(id); setStage("result");
    } catch(err) { setErrorMsg(err.message||"Something went wrong."); setStage("error"); }
  }, [apiKey,history]);

  const handleSelect = (item) => { setCurrentData(item.data); setCurrentId(item.id); setStage("result"); };
  const handleDelete = (id) => {
    const newH=history.filter(h=>h.id!==id); setHistory(newH); LS.set(KEYS.HISTORY,newH);
    if(currentId===id){setStage("upload");setCurrentData(null);setCurrentId(null);}
  };
  const handleNew = () => { setStage("upload");setCurrentData(null);setCurrentId(null);setErrorMsg("");setProgressPct(0); };
  const handleLogout = () => { LS.del(KEYS.SESSION); setScreen("login");setUsername("");setCurrentData(null);setStage("upload"); };

  if(screen==="login") return <LoginScreen onLogin={handleLogin}/>;
  if(screen==="apisetup") return <ApiKeySetup username={username} onDone={handleApiDone}/>;

  return (
    <div style={{minHeight:"100vh",background:"var(--bg)",display:"flex",flexDirection:"column",overflow:"hidden"}}>
      <style>{GCSS}</style>
      <nav className="nav">
        <div style={{display:"flex",alignItems:"center",gap:"10px"}}>
          <div className="nav-logo">⬡</div>
          <span className="nav-name">FlowScribe</span>
        </div>
        <div style={{display:"flex",alignItems:"center",gap:"8px"}}>
          <div style={{fontSize:"13px",color:"var(--text3)",fontWeight:500}}>👤 {typeof username === "string" ? username : ""}</div>
          <button className="btn btn-secondary" onClick={()=>setShowHistory(v=>!v)} style={{padding:"7px 12px",fontSize:"12px"}}>{showHistory?"Hide":"Show"} History</button>
          {stage==="result"&&<button className="btn btn-secondary" onClick={handleNew} style={{padding:"7px 14px",fontSize:"12px"}}>+ New</button>}
          <button className="btn btn-secondary" onClick={handleLogout} style={{padding:"7px 14px",fontSize:"12px"}}>Sign Out</button>
          <div className="nav-pill">AI READY</div>
        </div>
      </nav>

      <div style={{flex:1,display:"flex",overflow:"hidden"}}>
        {showHistory&&<HistorySidebar history={history} currentId={currentId} onSelect={handleSelect} onDelete={handleDelete} onNew={handleNew}/>}
        <div style={{flex:1,display:"flex",flexDirection:"column",overflow:"hidden",position:"relative"}}>

          {stage==="upload"&&<UploadPanel onRun={run}/>}

          {stage==="processing"&&(
            <div style={{flex:1,display:"flex",alignItems:"center",justifyContent:"center",padding:"40px 24px"}}>
              <div className="card scale-in" style={{padding:"36px 32px",width:"100%",maxWidth:"420px",textAlign:"center"}}>
                <div style={{width:"64px",height:"64px",background:"linear-gradient(135deg,var(--indigo),var(--violet))",borderRadius:"16px",display:"flex",alignItems:"center",justifyContent:"center",fontSize:"28px",margin:"0 auto 20px",boxShadow:"0 8px 24px rgba(99,102,241,0.4)",animation:"spinSlow 3s linear infinite"}}>⬡</div>
                <h2 style={{fontSize:"19px",fontWeight:800,marginBottom:"7px"}}>Building your flowchart</h2>
                <p style={{fontSize:"13px",color:"#6366F1",fontWeight:600,marginBottom:"16px"}}>{progress}</p>
                <div style={{height:"5px",background:"#EEF2FF",borderRadius:"3px",marginBottom:"22px",overflow:"hidden"}}>
                  <div style={{height:"100%",width:`${progressPct}%`,background:"linear-gradient(90deg,#6366F1,#8B5CF6,#06B6D4)",borderRadius:"3px",transition:"width 0.6s ease",boxShadow:"0 0 8px rgba(99,102,241,0.5)"}}/>
                </div>
                <div style={{display:"flex",flexDirection:"column",gap:"7px",textAlign:"left"}}>
                  {["Reading document","Extracting nodes & decisions","Mapping connections","Calculating layout","Rendering flowchart"].map((s,i)=>(
                    <div key={s} style={{display:"flex",alignItems:"center",gap:"10px",padding:"9px 12px",background:"var(--surface)",borderRadius:"8px",animation:`fadeUp 0.4s ${i*0.07}s ease both`,opacity:0,animationFillMode:"forwards"}}>
                      <div style={{width:"7px",height:"7px",borderRadius:"50%",background:"linear-gradient(135deg,#6366F1,#8B5CF6)",flexShrink:0,animation:`pulse ${1+i*0.18}s ease-in-out infinite`}}/>
                      <span style={{fontSize:"12px",color:"var(--text2)",fontWeight:500}}>{s}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {stage==="result"&&currentData&&<div style={{flex:1,overflow:"hidden",display:"flex",flexDirection:"column"}}><ResultView data={currentData} onDataChange={(updated)=>{setCurrentData(updated);const newH=history.map(h=>h.id===currentId?{...h,data:updated}:h);setHistory(newH);LS.set(KEYS.HISTORY,newH);}}/></div>}

          {stage==="error"&&(
            <div style={{flex:1,display:"flex",alignItems:"center",justifyContent:"center",padding:"40px 24px"}}>
              <div className="card scale-in" style={{padding:"32px",maxWidth:"380px",textAlign:"center"}}>
                <div style={{fontSize:"40px",marginBottom:"14px"}}>😕</div>
                <h2 style={{fontSize:"18px",fontWeight:800,marginBottom:"8px"}}>Something went wrong</h2>
                <div style={{fontSize:"13px",color:"#DC2626",padding:"10px 14px",background:"#FEF2F2",border:"1px solid #FECACA",borderRadius:"8px",marginBottom:"20px",lineHeight:1.5}}>{errorMsg}</div>
                <div style={{display:"flex",gap:"8px",justifyContent:"center"}}>
                  <button className="btn btn-primary" onClick={handleNew}>Try Again</button>
                  <button className="btn btn-secondary" onClick={handleLogout}>Sign Out</button>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}