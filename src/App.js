import { useState, useRef, useCallback } from "react";

const COLORS = ["#2D2D2D","#6B7280","#059669","#2563EB","#D97706","#DC2626","#7C3AED","#0891B2"];

const extractJSON = (text) => {
  try {
    const m = text.match(/```json\s*([\s\S]*?)```/) || text.match(/(\{[\s\S]*\})/);
    if (m) return JSON.parse(m[1]);
    return JSON.parse(text);
  } catch { return null; }
};

async function analyzeTranscript(text, apiKey) {
  const response = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: { "Content-Type":"application/json","x-api-key":apiKey,"anthropic-version":"2023-06-01","anthropic-dangerous-direct-browser-access":"true" },
    body: JSON.stringify({
      model: "claude-haiku-4-5-20251001", max_tokens: 2000,
      messages: [{ role:"user", content:`You are a business process analyst. Read this transcript and extract a process flowchart.\nReturn ONLY JSON, no markdown:\n{"title":"short title","summary":"one sentence","actors":[{"id":"a1","name":"Name","emoji":"👤"}],"phases":[{"id":1,"title":"short title","actorId":"a1","icon":"📋","description":"what happens","steps":["step1","step2"],"output":"what produced","note":"warning or empty","isDecision":false,"decisionQuestion":"","decisionYes":"","decisionNo":""}],"keyInsights":["insight1"]}\nRules: 4-8 phases, short titles, mark decisions with isDecision:true.\nTRANSCRIPT: ${text.substring(0,8000)}` }]
    })
  });
  if (!response.ok) { const e=await response.json(); throw new Error(e?.error?.message||"API Error"); }
  const data = await response.json();
  const raw = data.content?.map(c=>c.text||"").join("")||"";
  const parsed = extractJSON(raw);
  if (!parsed) throw new Error("Could not parse response. Try again.");
  return parsed;
}

function doExportHTML(data) {
  const html = `<!DOCTYPE html><html><head><meta charset="UTF-8"/><title>${data.title}</title>
<style>*{box-sizing:border-box;margin:0;padding:0}body{background:#FAFAF9;font-family:'Georgia',serif;padding:40px 20px}
.w{max-width:720px;margin:0 auto}h1{font-size:28px;font-weight:400;color:#1C1C1C;text-align:center;margin-bottom:8px;letter-spacing:-0.5px}
.sum{text-align:center;color:#6B7280;margin-bottom:28px;font-size:14px}.acts{display:flex;gap:8px;justify-content:center;flex-wrap:wrap;margin-bottom:32px}
.act{padding:4px 14px;border-radius:4px;font-size:12px;font-weight:500;border:1px solid #E5E7EB;color:#374151}
.phase{background:#fff;border-radius:8px;padding:20px;margin-bottom:4px;border:1px solid #E5E7EB}
.grid{display:grid;grid-template-columns:1fr 1fr;gap:16px}
.lbl{font-size:10px;font-weight:600;letter-spacing:2px;margin-bottom:10px;color:#9CA3AF;text-transform:uppercase}
.step{display:flex;gap:10px;margin-bottom:8px;font-size:13px;color:#374151}
.out{border-radius:6px;padding:12px;font-size:13px;margin-bottom:8px;background:#F9FAFB;border:1px solid #E5E7EB}
.arr{text-align:center;font-size:18px;color:#D1D5DB;margin:6px 0}
.footer{text-align:center;margin-top:32px;font-size:11px;color:#9CA3AF;letter-spacing:1px}</style></head><body>
<div class="w"><h1>${data.title}</h1><p class="sum">${data.summary}</p>
<div class="acts">${(data.actors||[]).map(a=>`<div class="act">${a.emoji} ${a.name}</div>`).join("")}</div>
${(data.phases||[]).map((p,idx)=>{const actor=data.actors?.find(a=>a.id===p.actorId);return`
<div class="phase"><div style="display:flex;align-items:center;gap:12px;margin-bottom:14px">
<span style="font-size:20px">${p.icon}</span>
<div><div style="font-size:15px;font-weight:600;color:#1C1C1C">${p.title}</div><div style="font-size:11px;color:#9CA3AF">${actor?.emoji} ${actor?.name} · Step ${idx+1}</div></div></div>
<div class="grid"><div><div class="lbl">Steps</div>
${p.steps.map((s,i)=>`<div class="step"><span style="min-width:18px;color:#9CA3AF;font-size:11px">${i+1}.</span><span>${s}</span></div>`).join("")}
${p.isDecision?`<div style="background:#FFFBEB;border:1px solid #FDE68A;border-radius:6px;padding:10px;font-size:12px;margin-top:10px"><b>◆ ${p.decisionQuestion}</b><br/>✓ ${p.decisionYes}<br/>✗ ${p.decisionNo}</div>`:""}
</div><div><div class="lbl">Output</div>
<div class="out">↳ ${p.output}</div>
${p.note?`<div style="font-size:12px;color:#92400E;padding:8px;background:#FFFBEB;border-radius:6px">⚠ ${p.note}</div>`:""}</div></div></div>
${idx<data.phases.length-1?`<div class="arr">↓</div>`:""}`}).join("")}
<div style="background:#fff;border-radius:8px;padding:20px;margin-top:16px;border:1px solid #E5E7EB">
<div class="lbl">Key Insights</div>
${(data.keyInsights||[]).map(i=>`<div style="font-size:13px;color:#374151;margin-bottom:8px;padding-left:12px;border-left:2px solid #E5E7EB;line-height:1.6">${i}</div>`).join("")}</div>
<div class="footer">MINDMAP AI</div></div></body></html>`;
  const b=new Blob([html],{type:"text/html"});const u=URL.createObjectURL(b);
  const a=document.createElement("a");a.href=u;a.download=`${data.title.replace(/\s+/g,"_")}.html`;a.click();URL.revokeObjectURL(u);
}

function doExportWord(data) {
  const phases=data.phases||[];const actors=data.actors||[];
  const body=`<h1>${data.title}</h1><p style="color:#6B7280;font-style:italic">${data.summary}</p><br/>
<h2>Participants</h2>
<table border="1" cellpadding="8" style="border-collapse:collapse;width:100%;margin-bottom:20px">
<tr style="background:#F9FAFB"><th>Actor</th><th>Name</th></tr>
${actors.map(a=>`<tr><td>${a.emoji}</td><td>${a.name}</td></tr>`).join("")}
</table>
${phases.map((p,i)=>{const actor=actors.find(a=>a.id===p.actorId);return`
<h3>Step ${i+1}: ${p.title}</h3><p><b>Owner:</b> ${actor?.emoji} ${actor?.name}</p>
<p><i>${p.description}</i></p><ol>${p.steps.map(s=>`<li>${s}</li>`).join("")}</ol>
<p><b>Output:</b> ${p.output}</p>${p.note?`<p><b>Note:</b> ${p.note}</p>`:""}<hr/>`}).join("")}
<h2>Key Insights</h2><ul>${(data.keyInsights||[]).map(i=>`<li>${i}</li>`).join("")}</ul>`;
  const full=`<html xmlns:o='urn:schemas-microsoft-com:office:office' xmlns:w='urn:schemas-microsoft-com:office:word' xmlns='http://www.w3.org/TR/REC-html40'><head><meta charset='utf-8'><title>${data.title}</title><style>body{font-family:Georgia,serif;font-size:11pt;margin:2.5cm}h1{font-size:20pt;font-weight:normal}h2{font-size:14pt}h3{font-size:12pt}</style></head><body>${body}</body></html>`;
  const b=new Blob(['\ufeff',full],{type:"application/msword"});const u=URL.createObjectURL(b);
  const a=document.createElement("a");a.href=u;a.download=`${data.title.replace(/\s+/g,"_")}.doc`;a.click();URL.revokeObjectURL(u);
}

function doExportPDF(data) {
  const phases=data.phases||[];const actors=data.actors||[];
  const html=`<!DOCTYPE html><html><head><meta charset="UTF-8"/><title>${data.title}</title>
<style>@page{margin:2cm;size:A4}*{box-sizing:border-box}body{font-family:'Georgia',serif;font-size:10.5pt;color:#1C1C1C;line-height:1.6}
h1{font-size:22pt;font-weight:400;letter-spacing:-0.5px;margin-bottom:6px}.sum{color:#6B7280;font-style:italic;margin-bottom:20px}
.phase{border:1px solid #E5E7EB;border-radius:8px;padding:14px;margin-bottom:8px;page-break-inside:avoid}
.footer{text-align:center;font-size:8.5pt;color:#9CA3AF;margin-top:20px;padding-top:12px;border-top:1px solid #E5E7EB;letter-spacing:1.5px}
.print-btn{position:fixed;top:16px;right:16px;background:#1C1C1C;color:white;border:none;border-radius:6px;padding:10px 20px;font-size:13px;cursor:pointer}
@media print{.print-btn{display:none}}</style></head><body>
<button class="print-btn" onclick="window.print()">Save as PDF</button>
<h1>${data.title}</h1><p class="sum">${data.summary}</p>
<p style="margin-bottom:20px">${actors.map(a=>`${a.emoji} ${a.name}`).join(" · ")}</p>
${phases.map((p,idx)=>{const actor=actors.find(a=>a.id===p.actorId);return`
<div class="phase"><div style="display:flex;justify-content:space-between;margin-bottom:10px">
<span style="font-size:13pt;font-weight:600">${p.icon} ${p.title}</span>
<span style="font-size:9pt;color:#9CA3AF">${actor?.name} · Step ${idx+1}</span></div>
<p style="font-size:9.5pt;color:#6B7280;font-style:italic;margin-bottom:10px">${p.description}</p>
${p.steps.map((s,i)=>`<div style="font-size:9.5pt;margin-bottom:5px;padding-left:16px">${i+1}. ${s}</div>`).join("")}
<div style="margin-top:10px;padding:8px;background:#F9FAFB;border-radius:6px;font-size:9.5pt">↳ ${p.output}</div>
${p.note?`<div style="margin-top:6px;font-size:9pt;color:#92400E">⚠ ${p.note}</div>`:""}</div>
${idx<phases.length-1?`<div style="text-align:center;color:#D1D5DB;margin:4px 0;font-size:14pt">↓</div>`:""}`}).join("")}
<div style="margin-top:16px;border:1px solid #E5E7EB;border-radius:8px;padding:14px">
<div style="font-size:9pt;font-weight:600;letter-spacing:2px;color:#9CA3AF;text-transform:uppercase;margin-bottom:10px">Key Insights</div>
${(data.keyInsights||[]).map(i=>`<div style="font-size:9.5pt;color:#374151;margin-bottom:7px;padding-left:12px;border-left:2px solid #E5E7EB">${i}</div>`).join("")}</div>
<div class="footer">MINDMAP AI</div></body></html>`;
  const w=window.open('','_blank');w.document.write(html);w.document.close();
}

function doExportPPT(data) {
  const phases=data.phases||[];const actors=data.actors||[];
  const slides=[
    `<div class="slide" style="background:#1C1C1C;display:flex;flex-direction:column;align-items:center;justify-content:center;text-align:center;padding:60px">
      <div style="font-size:11pt;letter-spacing:3px;color:#6B7280;text-transform:uppercase;margin-bottom:20px">Process Flowchart</div>
      <h1 style="font-size:32pt;font-weight:400;color:#FAFAF9;letter-spacing:-1px;margin-bottom:16px;max-width:700px;line-height:1.15">${data.title}</h1>
      <p style="font-size:13pt;color:#9CA3AF;max-width:560px;line-height:1.6">${data.summary}</p>
      <div style="display:flex;gap:12px;flex-wrap:wrap;justify-content:center;margin-top:32px">
        ${actors.map(a=>`<div style="padding:6px 16px;border:1px solid #374151;border-radius:4px;font-size:11pt;color:#9CA3AF">${a.emoji} ${a.name}</div>`).join("")}
      </div></div>`,
    ...phases.map((p,idx)=>{const actor=actors.find(a=>a.id===p.actorId);return`
    <div class="slide" style="padding:50px 56px;display:flex;flex-direction:column">
      <div style="display:flex;align-items:center;gap:16px;margin-bottom:28px;padding-bottom:20px;border-bottom:1px solid #E5E7EB">
        <span style="font-size:28px">${p.icon}</span>
        <div><div style="font-size:18pt;font-weight:600;color:#1C1C1C;letter-spacing:-0.3px">${p.title}</div>
        <div style="font-size:11pt;color:#9CA3AF;margin-top:3px">${actor?.emoji} ${actor?.name} · Step ${idx+1}</div></div></div>
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:32px;flex:1">
        <div><div style="font-size:9pt;letter-spacing:2px;color:#9CA3AF;text-transform:uppercase;margin-bottom:14px">Steps</div>
        ${p.steps.map((s,i)=>`<div style="display:flex;gap:12px;margin-bottom:10px"><span style="color:#9CA3AF;font-size:11pt;min-width:20px">${i+1}.</span><span style="font-size:11pt;color:#374151;line-height:1.5">${s}</span></div>`).join("")}</div>
        <div><div style="font-size:9pt;letter-spacing:2px;color:#9CA3AF;text-transform:uppercase;margin-bottom:14px">Output</div>
        <div style="background:#F9FAFB;border:1px solid #E5E7EB;border-radius:8px;padding:16px;font-size:11pt;color:#1C1C1C;line-height:1.5">↳ ${p.output}</div>
        ${p.note?`<div style="margin-top:12px;font-size:10pt;color:#92400E;padding:10px;background:#FFFBEB;border-radius:6px">⚠ ${p.note}</div>`:""}</div>
      </div></div>`}).join(""),
    `<div class="slide" style="padding:50px 56px">
    <div style="font-size:9pt;letter-spacing:3px;color:#9CA3AF;text-transform:uppercase;margin-bottom:28px">Key Insights</div>
    ${(data.keyInsights||[]).map((ins,i)=>`<div style="display:flex;gap:16px;margin-bottom:18px;padding-bottom:18px;border-bottom:1px solid #F3F4F6">
    <span style="font-size:11pt;color:#D1D5DB;min-width:24px">${i+1<10?"0"+(i+1):i+1}</span>
    <span style="font-size:12pt;color:#1C1C1C;line-height:1.6">${ins}</span></div>`).join("")}</div>`
  ];
  const full=`<!DOCTYPE html><html><head><meta charset="UTF-8"/><title>${data.title}</title>
<style>*{box-sizing:border-box;margin:0;padding:0}body{background:#F3F4F6;font-family:'Georgia',serif;padding:24px}
.slide{width:960px;min-height:540px;background:#FAFAF9;border-radius:4px;margin:0 auto 20px;overflow:hidden;box-shadow:0 4px 24px rgba(0,0,0,0.1)}
@media print{body{background:white;padding:0}.slide{box-shadow:none;width:100%;margin:0;page-break-after:always}}</style>
</head><body>${slides.join("")}</body></html>`;
  const b=new Blob([full],{type:"text/html"});const u=URL.createObjectURL(b);
  const a=document.createElement("a");a.href=u;a.download=`${data.title.replace(/\s+/g,"_")}_slides.html`;a.click();URL.revokeObjectURL(u);
}

// ── GLOBAL STYLES ─────────────────────────────────────────────────────────────
const GCSS = `
  @import url('https://fonts.googleapis.com/css2?family=Fraunces:ital,wght@0,300;0,400;0,600;1,300;1,400&family=Geist:wght@300;400;500;600&display=swap');
  *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
  :root {
    --ink: #1C1C1C; --ink2: #374151; --muted: #6B7280; --faint: #9CA3AF;
    --line: #E5E7EB; --surface: #FAFAF9; --white: #FFFFFF; --warm: #F9FAFB;
  }
  body { background: var(--surface); font-family: 'Geist', system-ui, sans-serif; color: var(--ink); -webkit-font-smoothing: antialiased; }

  .nav { height:56px; display:flex; align-items:center; justify-content:space-between; padding:0 32px; border-bottom:1px solid var(--line); background:rgba(250,250,249,0.92); backdrop-filter:blur(16px); position:sticky; top:0; z-index:100; }
  .nav-logo { font-family:'Fraunces',serif; font-size:18px; font-weight:400; color:var(--ink); letter-spacing:-0.3px; display:flex; align-items:center; gap:10px; }
  .nav-dot { width:7px; height:7px; border-radius:50%; background:var(--ink); }

  .btn { font-family:'Geist',sans-serif; font-size:13px; font-weight:500; border-radius:6px; padding:9px 20px; cursor:pointer; border:1px solid transparent; transition:all 0.15s; }
  .btn-primary { background:var(--ink); color:#fff; border-color:var(--ink); }
  .btn-primary:hover { background:#333; }
  .btn-primary:disabled { background:#9CA3AF; border-color:#9CA3AF; cursor:not-allowed; }
  .btn-ghost { background:transparent; color:var(--muted); border-color:var(--line); }
  .btn-ghost:hover { background:var(--warm); color:var(--ink); border-color:#D1D5DB; }

  .input { font-family:'Geist',sans-serif; font-size:14px; color:var(--ink); background:var(--white); border:1px solid var(--line); border-radius:6px; padding:10px 14px; width:100%; outline:none; transition:border-color 0.15s; }
  .input:focus { border-color:var(--ink); }
  .input::placeholder { color:#C4C9D4; }

  .card { background:var(--white); border:1px solid var(--line); border-radius:10px; }

  .phase-row { background:var(--white); border:1px solid var(--line); border-radius:8px; cursor:pointer; transition:border-color 0.15s, box-shadow 0.15s; }
  .phase-row:hover { border-color:#9CA3AF; box-shadow:0 2px 8px rgba(0,0,0,0.05); }
  .phase-row.open { border-color:var(--ink); border-radius:8px 8px 0 0; border-bottom-color:transparent; }
  .phase-body { background:var(--warm); border:1px solid var(--ink); border-top:none; border-radius:0 0 8px 8px; padding:20px 22px 24px; }

  .label { font-size:10px; font-weight:600; letter-spacing:1.8px; color:var(--faint); text-transform:uppercase; margin-bottom:10px; }

  .exp-btn { font-family:'Geist',sans-serif; font-size:12px; font-weight:500; border-radius:5px; padding:7px 14px; cursor:pointer; border:1px solid var(--line); background:var(--white); color:var(--ink2); transition:all 0.15s; display:flex; align-items:center; gap:5px; }
  .exp-btn:hover { background:var(--ink); color:#fff; border-color:var(--ink); }

  .connector { width:1px; height:24px; background:var(--line); margin:0 auto; }

  @keyframes fadeUp { from{opacity:0;transform:translateY(14px)} to{opacity:1;transform:translateY(0)} }
  @keyframes spin { from{transform:rotate(0deg)} to{transform:rotate(360deg)} }
  @keyframes pulse { 0%,100%{opacity:1} 50%{opacity:0.3} }
  .fade-up { animation: fadeUp 0.4s ease both; }
`;

// ── API KEY SCREEN ─────────────────────────────────────────────────────────────
function ApiKeyScreen({ onSave }) {
  const [key, setKey] = useState("");
  const [show, setShow] = useState(false);
  const [error, setError] = useState("");
  const [testing, setTesting] = useState(false);

  const handleSave = async () => {
    if (!key.startsWith("sk-ant-")) { setError("Key must start with sk-ant-"); return; }
    setTesting(true); setError("");
    try {
      const r = await fetch("https://api.anthropic.com/v1/messages", {
        method:"POST", headers:{"Content-Type":"application/json","x-api-key":key,"anthropic-version":"2023-06-01","anthropic-dangerous-direct-browser-access":"true"},
        body: JSON.stringify({ model:"claude-haiku-4-5-20251001", max_tokens:10, messages:[{role:"user",content:"hi"}] })
      });
      if (!r.ok) { const e=await r.json(); throw new Error(e?.error?.message||"Invalid key"); }
      onSave(key);
    } catch(e) { setError(e.message||"Could not verify."); } finally { setTesting(false); }
  };

  return (
    <div style={{ minHeight:"100vh", background:"var(--surface)", display:"flex", flexDirection:"column" }}>
      <style>{GCSS}</style>
      <nav className="nav">
        <div className="nav-logo"><div className="nav-dot"/> MindMap AI</div>
      </nav>
      <div style={{ flex:1, display:"flex", alignItems:"center", justifyContent:"center", padding:"40px 20px" }}>
        <div style={{ width:"100%", maxWidth:"380px" }} className="fade-up">
          <div style={{ textAlign:"center", marginBottom:"40px" }}>
            <div style={{ fontSize:"40px", marginBottom:"16px", lineHeight:1 }}>◈</div>
            <h1 style={{ fontFamily:"'Fraunces',serif", fontSize:"26px", fontWeight:300, letterSpacing:"-0.5px", marginBottom:"8px" }}>MindMap AI</h1>
            <p style={{ fontSize:"14px", color:"var(--muted)", lineHeight:1.65 }}>Turn any transcript into a clean, exportable flowchart.</p>
          </div>
          <div className="card" style={{ padding:"24px" }}>
            <div className="label">API Key</div>
            <div style={{ display:"flex", gap:"8px", marginBottom:"12px" }}>
              <input className="input" type={show?"text":"password"} value={key} onChange={e=>{setKey(e.target.value);setError("");}} placeholder="sk-ant-api03-…" onKeyDown={e=>e.key==="Enter"&&handleSave()} style={{flex:1}}/>
              <button className="btn btn-ghost" onClick={()=>setShow(!show)} style={{padding:"9px 12px",flexShrink:0}}>{show?"Hide":"Show"}</button>
            </div>
            {error && <div style={{fontSize:"13px",color:"#DC2626",marginBottom:"12px",padding:"8px 12px",background:"#FEF2F2",borderRadius:"6px",border:"1px solid #FECACA"}}>{error}</div>}
            <button className="btn btn-primary" onClick={handleSave} disabled={!key||testing} style={{width:"100%"}}>{testing?"Verifying…":"Continue →"}</button>
            <div style={{marginTop:"20px",paddingTop:"20px",borderTop:"1px solid var(--line)"}}>
              <div className="label">How to get your key</div>
              {[["1","Go to console.anthropic.com"],["2","Sign up or log in"],["3","API Keys → Create Key"],["4","Paste it above"]].map(([n,t])=>(
                <div key={n} style={{display:"flex",gap:"12px",marginBottom:"8px"}}>
                  <span style={{fontSize:"11px",color:"var(--faint)",minWidth:"16px",paddingTop:"1px"}}>{n}.</span>
                  <span style={{fontSize:"13px",color:"var(--muted)"}}>{t}</span>
                </div>
              ))}
              <div style={{marginTop:"12px",fontSize:"12px",color:"#059669"}}>～ $0.001 per analysis</div>
            </div>
          </div>
          <p style={{textAlign:"center",fontSize:"11px",color:"var(--faint)",marginTop:"14px"}}>Key stored in browser session only.</p>
        </div>
      </div>
    </div>
  );
}

// ── EXPORT BAR ─────────────────────────────────────────────────────────────────
function ExportBar({ data }) {
  const [busy, setBusy] = useState(null);
  const go = (type, fn) => { setBusy(type); setTimeout(()=>{fn(data);setBusy(null);},200); };
  const exports = [
    {type:"html",icon:"↗",label:"HTML",fn:doExportHTML},
    {type:"word",icon:"↗",label:"Word",fn:doExportWord},
    {type:"pdf", icon:"↗",label:"PDF", fn:doExportPDF},
    {type:"ppt", icon:"↗",label:"Slides",fn:doExportPPT},
  ];
  return (
    <div style={{display:"flex",gap:"6px",flexWrap:"wrap"}}>
      {exports.map(({type,icon,label,fn})=>(
        <button key={type} className="exp-btn" onClick={()=>go(type,fn)} disabled={!!busy}>
          {busy===type?"…":icon} {label}
        </button>
      ))}
    </div>
  );
}

// ── RESULT VIEW ───────────────────────────────────────────────────────────────
function ResultView({ data }) {
  const [active, setActive] = useState(null);
  const gc = (actorId) => { const i=data.actors?.findIndex(a=>a.id===actorId)??0; return COLORS[i%COLORS.length]; };
  const ga = (actorId) => data.actors?.find(a=>a.id===actorId);

  return (
    <div style={{maxWidth:"720px",margin:"0 auto",padding:"0 24px 80px"}}>
      {/* Header */}
      <div style={{paddingTop:"52px",paddingBottom:"36px",borderBottom:"1px solid var(--line)",marginBottom:"36px"}}>
        <div style={{fontSize:"11px",letterSpacing:"2px",color:"var(--faint)",textTransform:"uppercase",marginBottom:"14px"}}>Analysis complete</div>
        <h1 style={{fontFamily:"'Fraunces',serif",fontSize:"clamp(22px,3.5vw,32px)",fontWeight:300,letterSpacing:"-0.5px",marginBottom:"10px",lineHeight:1.2}}>{data.title}</h1>
        <p style={{fontSize:"15px",color:"var(--muted)",lineHeight:1.65,marginBottom:"20px",maxWidth:"520px"}}>{data.summary}</p>
        <div style={{display:"flex",gap:"8px",flexWrap:"wrap",marginBottom:"24px"}}>
          {(data.actors||[]).map(a=>(
            <div key={a.id} style={{padding:"4px 12px",border:"1px solid var(--line)",borderRadius:"4px",fontSize:"13px",color:"var(--ink2)",background:"var(--white)"}}>{a.emoji} {a.name}</div>
          ))}
        </div>
        <ExportBar data={data}/>
      </div>

      {/* Phases */}
      <div>
        {(data.phases||[]).map((phase, index) => {
          const actor = ga(phase.actorId);
          const isOpen = active === phase.id;
          return (
            <div key={phase.id} className="fade-up" style={{animationDelay:`${index*0.04}s`}}>
              <div className={`phase-row${isOpen?" open":""}`} onClick={()=>setActive(isOpen?null:phase.id)}>
                <div style={{padding:"14px 18px",display:"flex",alignItems:"center",gap:"14px"}}>
                  <span style={{fontSize:"20px",lineHeight:1,flexShrink:0}}>{phase.icon}</span>
                  <div style={{flex:1,minWidth:0}}>
                    <div style={{fontSize:"14px",fontWeight:500,color:"var(--ink)",marginBottom:"2px"}}>{phase.title}</div>
                    <div style={{fontSize:"12px",color:"var(--faint)"}}>{actor?.emoji} {actor?.name}</div>
                  </div>
                  <div style={{fontSize:"11px",color:"var(--faint)",letterSpacing:"1px",flexShrink:0}}>{String(index+1).padStart(2,"0")}</div>
                  <div style={{color:"var(--faint)",fontSize:"18px",transition:"transform 0.2s",transform:isOpen?"rotate(90deg)":"rotate(0deg)",marginLeft:"4px"}}>›</div>
                </div>
              </div>
              {isOpen && (
                <div className="phase-body">
                  <p style={{fontSize:"13px",color:"var(--muted)",lineHeight:1.65,marginBottom:"20px",fontStyle:"italic"}}>{phase.description}</p>
                  <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:"24px"}}>
                    <div>
                      <div className="label">Steps</div>
                      {phase.steps.map((step,i)=>(
                        <div key={i} style={{display:"flex",gap:"12px",marginBottom:"10px",alignItems:"flex-start"}}>
                          <span style={{fontSize:"11px",color:"var(--faint)",minWidth:"20px",paddingTop:"2px",flexShrink:0}}>{i+1}.</span>
                          <span style={{fontSize:"13px",color:"var(--ink2)",lineHeight:1.55}}>{step}</span>
                        </div>
                      ))}
                      {phase.isDecision && (
                        <div style={{marginTop:"14px",padding:"12px 14px",background:"#FFFBEB",border:"1px solid #FDE68A",borderRadius:"6px",fontSize:"12px"}}>
                          <div style={{fontWeight:500,color:"var(--ink)",marginBottom:"6px"}}>◆ {phase.decisionQuestion}</div>
                          <div style={{color:"#065F46",marginBottom:"3px"}}>Yes → {phase.decisionYes}</div>
                          <div style={{color:"#991B1B"}}>No → {phase.decisionNo}</div>
                        </div>
                      )}
                    </div>
                    <div>
                      <div className="label">Output</div>
                      <div style={{padding:"12px 14px",background:"var(--white)",border:"1px solid var(--line)",borderRadius:"6px",fontSize:"13px",color:"var(--ink2)",lineHeight:1.55,marginBottom:"12px"}}>↳ {phase.output}</div>
                      {phase.note && <div style={{padding:"10px 12px",background:"#FFFBEB",border:"1px solid #FDE68A",borderRadius:"6px",fontSize:"12px",color:"#92400E",lineHeight:1.5}}>⚠ {phase.note}</div>}
                    </div>
                  </div>
                </div>
              )}
              {index < data.phases.length-1 && <div className="connector"/>}
            </div>
          );
        })}
      </div>

      {/* Insights */}
      {data.keyInsights?.length > 0 && (
        <div className="card" style={{padding:"22px 24px",marginTop:"32px"}}>
          <div className="label">Key Insights</div>
          {data.keyInsights.map((ins,i)=>(
            <div key={i} style={{fontSize:"13px",color:"var(--ink2)",marginBottom:"10px",paddingLeft:"14px",borderLeft:"2px solid var(--line)",lineHeight:1.65}}>{ins}</div>
          ))}
        </div>
      )}

      <div style={{marginTop:"36px",paddingTop:"24px",borderTop:"1px solid var(--line)"}}>
        <div className="label">Export</div>
        <ExportBar data={data}/>
      </div>
    </div>
  );
}

// ── MAIN APP ──────────────────────────────────────────────────────────────────
export default function App() {
  const [apiKey, setApiKey] = useState("");
  const [stage, setStage] = useState("upload");
  const [dragOver, setDragOver] = useState(false);
  const [fileName, setFileName] = useState("");
  const [progress, setProgress] = useState("");
  const [flowData, setFlowData] = useState(null);
  const [errorMsg, setErrorMsg] = useState("");
  const [pasteText, setPasteText] = useState("");
  const [showPaste, setShowPaste] = useState(false);
  const fileRef = useRef(null);

  const run = useCallback(async (text, name) => {
    setFileName(name); setStage("processing"); setProgress("Reading document…");
    try {
      setProgress("Analyzing with AI…");
      const result = await analyzeTranscript(text, apiKey);
      setProgress("Building flowchart…");
      await new Promise(r => setTimeout(r, 300));
      setFlowData(result); setStage("result");
    } catch(err) { setErrorMsg(err.message||"Something went wrong."); setStage("error"); }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [apiKey]);

  const readFile = (file) => new Promise((res,rej) => {
    if (file.type==="application/pdf") { res(`[PDF: ${file.name}] Please paste the text content.`); return; }
    const r=new FileReader(); r.onload=e=>res(e.target.result); r.onerror=rej; r.readAsText(file);
  });

  const handleDrop = useCallback(async (e) => {
    e.preventDefault(); setDragOver(false);
    const f=e.dataTransfer.files[0]; if(f){const t=await readFile(f);run(t,f.name);}
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [run]);

  const handleFile = async (e) => { const f=e.target.files[0]; if(f){const t=await readFile(f);run(t,f.name);} };
  const reset = () => { setStage("upload"); setFlowData(null); setFileName(""); setPasteText(""); setShowPaste(false); setErrorMsg(""); };

  if (!apiKey) return <ApiKeyScreen onSave={setApiKey}/>;

  return (
    <div style={{minHeight:"100vh",background:"var(--surface)"}}>
      <style>{GCSS}</style>

      <nav className="nav">
        <div className="nav-logo"><div className="nav-dot"/> MindMap AI</div>
        <div style={{display:"flex",alignItems:"center",gap:"8px"}}>
          {stage==="result" && <button className="btn btn-ghost" onClick={reset} style={{padding:"7px 14px",fontSize:"12px"}}>← New analysis</button>}
          <button onClick={()=>setApiKey("")} className="btn btn-ghost" style={{padding:"7px 14px",fontSize:"12px"}}>API Key</button>
        </div>
      </nav>

      {/* Upload */}
      {stage==="upload" && (
        <div style={{maxWidth:"560px",margin:"0 auto",padding:"64px 24px"}} className="fade-up">
          <div style={{marginBottom:"48px"}}>
            <div style={{fontSize:"11px",letterSpacing:"2px",color:"var(--faint)",textTransform:"uppercase",marginBottom:"16px"}}>Transcript → Flowchart</div>
            <h1 style={{fontFamily:"'Fraunces',serif",fontSize:"clamp(26px,4vw,40px)",fontWeight:300,letterSpacing:"-1px",lineHeight:1.1,marginBottom:"14px",color:"var(--ink)"}}>
              Turn any meeting into<br/>a structured document.
            </h1>
            <p style={{fontSize:"14px",color:"var(--muted)",lineHeight:1.7,maxWidth:"400px"}}>
              Upload a transcript or paste text — get a clean flowchart you can export to Word, PDF, or PowerPoint.
            </p>
          </div>

          {/* Drop zone */}
          <div
            onDragOver={e=>{e.preventDefault();setDragOver(true);}}
            onDragLeave={()=>setDragOver(false)}
            onDrop={handleDrop}
            onClick={()=>fileRef.current?.click()}
            style={{
              border:`1px dashed ${dragOver?"var(--ink)":"#D1D5DB"}`,
              borderRadius:"8px", padding:"40px 32px", textAlign:"center", cursor:"pointer",
              background:dragOver?"#F3F4F6":"var(--white)", transition:"all 0.15s", marginBottom:"12px",
            }}
          >
            <div style={{fontSize:"26px",marginBottom:"10px",opacity:dragOver?1:0.4}}>↑</div>
            <div style={{fontSize:"14px",fontWeight:500,color:"var(--ink)",marginBottom:"4px"}}>Drop a file here</div>
            <div style={{fontSize:"13px",color:"var(--faint)",marginBottom:"14px"}}>or click to browse</div>
            <div style={{display:"flex",gap:"6px",justifyContent:"center",flexWrap:"wrap"}}>
              {[".TXT",".MD",".CSV",".DOCX",".PDF"].map(e=>(
                <span key={e} style={{fontSize:"11px",color:"var(--faint)",padding:"2px 8px",border:"1px solid var(--line)",borderRadius:"3px",letterSpacing:"0.5px"}}>{e}</span>
              ))}
            </div>
          </div>
          <input ref={fileRef} type="file" accept=".txt,.md,.csv,.pdf,.docx,.doc" onChange={handleFile} style={{display:"none"}}/>

          <div style={{display:"flex",alignItems:"center",gap:"14px",margin:"20px 0"}}>
            <div style={{flex:1,height:"1px",background:"var(--line)"}}/>
            <span style={{fontSize:"11px",color:"var(--faint)",letterSpacing:"1px"}}>OR</span>
            <div style={{flex:1,height:"1px",background:"var(--line)"}}/>
          </div>

          <div className="card" style={{overflow:"hidden",marginBottom:"28px"}}>
            <div onClick={()=>setShowPaste(v=>!v)} style={{padding:"14px 18px",display:"flex",alignItems:"center",justifyContent:"space-between",cursor:"pointer",borderBottom:showPaste?"1px solid var(--line)":"none"}}>
              <span style={{fontSize:"14px",fontWeight:500,color:"var(--ink)"}}>Paste text</span>
              <span style={{color:"var(--faint)",transition:"transform 0.2s",display:"inline-block",transform:showPaste?"rotate(90deg)":"rotate(0)"}}>›</span>
            </div>
            {showPaste && (
              <div style={{padding:"14px 18px 18px"}}>
                <textarea className="input" value={pasteText} onChange={e=>setPasteText(e.target.value)} autoFocus placeholder="Paste meeting notes, transcript, SOP…" style={{minHeight:"130px",resize:"vertical",lineHeight:1.6}}/>
                <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginTop:"10px"}}>
                  <span style={{fontSize:"12px",color:pasteText.length<50?"var(--faint)":"#059669"}}>{pasteText.length<50?`${pasteText.length} / 50 min`:`${pasteText.length} chars ✓`}</span>
                  <div style={{display:"flex",gap:"8px"}}>
                    <button className="btn btn-ghost" onClick={()=>{setPasteText("");setShowPaste(false);}} style={{padding:"7px 14px",fontSize:"12px"}}>Clear</button>
                    <button className="btn btn-primary" onClick={()=>pasteText.trim().length>=50&&run(pasteText,"Pasted text")} disabled={pasteText.trim().length<50} style={{padding:"7px 18px",fontSize:"12px",opacity:pasteText.trim().length>=50?1:0.4}}>Analyze →</button>
                  </div>
                </div>
              </div>
            )}
          </div>

          <div style={{display:"flex",gap:"6px",flexWrap:"wrap"}}>
            {["AI Analysis","Word Export","PDF","PowerPoint","HTML"].map(l=>(
              <div key={l} style={{fontSize:"12px",color:"var(--faint)",padding:"4px 10px",border:"1px solid var(--line)",borderRadius:"4px"}}>{l}</div>
            ))}
          </div>
        </div>
      )}

      {/* Processing */}
      {stage==="processing" && (
        <div style={{maxWidth:"400px",margin:"100px auto",textAlign:"center",padding:"0 24px"}} className="fade-up">
          <div style={{fontSize:"30px",marginBottom:"20px",animation:"spin 3s linear infinite",display:"inline-block"}}>◈</div>
          <h2 style={{fontFamily:"'Fraunces',serif",fontSize:"22px",fontWeight:300,marginBottom:"8px",letterSpacing:"-0.3px"}}>Analyzing document</h2>
          <p style={{fontSize:"13px",color:"var(--muted)",marginBottom:"6px"}}>{progress}</p>
          <p style={{fontSize:"12px",color:"var(--faint)",marginBottom:"32px"}}>{fileName}</p>
          <div style={{display:"flex",flexDirection:"column",gap:"8px",textAlign:"left"}}>
            {["Reading & parsing","Identifying actors","Extracting steps","Detecting decisions","Building flowchart"].map((s,i)=>(
              <div key={s} style={{display:"flex",alignItems:"center",gap:"12px",padding:"10px 14px",background:"var(--white)",border:"1px solid var(--line)",borderRadius:"6px"}}>
                <div style={{width:"6px",height:"6px",borderRadius:"50%",background:"var(--ink)",animation:`pulse ${1+i*0.15}s ease-in-out infinite`,flexShrink:0}}/>
                <span style={{fontSize:"13px",color:"var(--muted)"}}>{s}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Result */}
      {stage==="result" && flowData && <div className="fade-up"><ResultView data={flowData}/></div>}

      {/* Error */}
      {stage==="error" && (
        <div style={{maxWidth:"380px",margin:"100px auto",textAlign:"center",padding:"0 24px"}} className="fade-up">
          <div style={{fontSize:"30px",marginBottom:"16px"}}>✕</div>
          <h2 style={{fontFamily:"'Fraunces',serif",fontSize:"22px",fontWeight:300,marginBottom:"10px"}}>Something went wrong</h2>
          <div style={{fontSize:"13px",color:"#DC2626",padding:"10px 14px",background:"#FEF2F2",border:"1px solid #FECACA",borderRadius:"6px",marginBottom:"24px",lineHeight:1.5}}>{errorMsg}</div>
          <div style={{display:"flex",gap:"8px",justifyContent:"center"}}>
            <button className="btn btn-primary" onClick={reset}>Try again</button>
            <button className="btn btn-ghost" onClick={()=>setApiKey("")}>Change key</button>
          </div>
        </div>
      )}

      <div style={{textAlign:"center",padding:"24px",borderTop:"1px solid var(--line)",marginTop:"20px"}}>
        <span style={{fontSize:"11px",color:"var(--faint)",letterSpacing:"1.5px",textTransform:"uppercase"}}>MindMap AI</span>
      </div>
    </div>
  );
}