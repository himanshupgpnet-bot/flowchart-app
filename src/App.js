import { useState, useRef, useCallback, useEffect } from "react";

const COLORS = ["#6366F1","#8B5CF6","#06B6D4","#10B981","#F59E0B","#EF4444","#EC4899","#3B82F6"];

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
  const gc=(idx)=>COLORS[idx%COLORS.length];
  const html=`<!DOCTYPE html><html><head><meta charset="UTF-8"/><title>${data.title}</title>
<style>*{box-sizing:border-box;margin:0;padding:0}body{background:#F8F9FF;font-family:'Segoe UI',sans-serif;padding:40px 20px}
.w{max-width:780px;margin:0 auto}h1{font-size:26px;font-weight:700;color:#0F172A;text-align:center;margin-bottom:8px}
.sum{text-align:center;color:#64748B;margin-bottom:20px}.acts{display:flex;gap:8px;justify-content:center;flex-wrap:wrap;margin-bottom:28px}
.act{padding:4px 14px;border-radius:20px;font-size:12px;font-weight:600;border:1px solid}
.phase{background:#fff;border-radius:12px;padding:18px;margin-bottom:4px;border:1px solid #E2E8F0;box-shadow:0 1px 3px rgba(0,0,0,0.06)}
.grid{display:grid;grid-template-columns:1fr 1fr;gap:14px}
.lbl{font-size:10px;font-weight:700;letter-spacing:1.5px;margin-bottom:8px;color:#94A3B8;text-transform:uppercase}
.step{display:flex;gap:8px;margin-bottom:6px;font-size:13px;color:#475569}
.out{border-radius:8px;padding:10px;font-size:13px;margin-bottom:8px}
.arr{text-align:center;font-size:20px;color:#6366F1;margin:4px 0}
.footer{text-align:center;margin-top:32px;font-size:11px;color:#94A3B8;letter-spacing:1px}</style></head><body>
<div class="w"><h1>${data.title}</h1><p class="sum">${data.summary}</p>
<div class="acts">${(data.actors||[]).map((a,i)=>`<div class="act" style="color:${gc(i)};border-color:${gc(i)}33;background:${gc(i)}0D">${a.emoji} ${a.name}</div>`).join("")}</div>
${(data.phases||[]).map((p,idx)=>{const c=gc(data.actors?.findIndex(a=>a.id===p.actorId)??0);const actor=data.actors?.find(a=>a.id===p.actorId);return`
<div class="phase"><div style="display:flex;align-items:center;gap:12px;margin-bottom:12px">
<div style="width:40px;height:40px;border-radius:10px;background:${c}15;border:1px solid ${c}33;display:flex;align-items:center;justify-content:center;font-size:18px">${p.icon}</div>
<div><div style="font-size:14px;font-weight:600;color:#0F172A">${p.title}</div><div style="font-size:11px;color:${c};font-weight:600">${actor?.emoji} ${actor?.name}</div></div>
<div style="margin-left:auto;background:${c}15;color:${c};border-radius:6px;padding:2px 10px;font-size:11px;font-weight:700">STEP ${idx+1}</div></div>
<div class="grid"><div><div class="lbl">Steps</div>
${p.steps.map((s,i)=>`<div class="step"><span style="background:${c}15;color:${c};width:18px;height:18px;border-radius:4px;display:flex;align-items:center;justify-content:center;font-size:9px;font-weight:700;flex-shrink:0">${i+1}</span><span>${s}</span></div>`).join("")}
</div><div><div class="lbl">Output</div>
<div class="out" style="background:${c}0D;border:1px solid ${c}22">✓ ${p.output}</div>
${p.note?`<div style="font-size:12px;color:#92400E;padding:8px 10px;background:#FFFBEB;border-radius:6px;border:1px solid #FDE68A">⚠ ${p.note}</div>`:""}</div></div></div>
${idx<data.phases.length-1?`<div class="arr">↓</div>`:""}`}).join("")}
<div style="background:#fff;border-radius:12px;padding:20px;margin-top:16px;border:1px solid #E2E8F0">
<div class="lbl">Key Insights</div>
${(data.keyInsights||[]).map(i=>`<div style="font-size:13px;color:#475569;margin-bottom:8px;padding-left:12px;border-left:3px solid #6366F133;line-height:1.6">${i}</div>`).join("")}</div>
<div class="footer">FLOWSCRIBE AI</div></div></body></html>`;
  const b=new Blob([html],{type:"text/html"});const u=URL.createObjectURL(b);
  const a=document.createElement("a");a.href=u;a.download=`${data.title.replace(/\s+/g,"_")}.html`;a.click();URL.revokeObjectURL(u);
}

function doExportWord(data) {
  const phases=data.phases||[];const actors=data.actors||[];
  const body=`<h1 style="color:#4F46E5">${data.title}</h1><p style="color:#64748B;font-style:italic">${data.summary}</p><br/>
<h2>Participants</h2>
<table border="1" cellpadding="8" style="border-collapse:collapse;width:100%;margin-bottom:20px">
<tr style="background:#EEF2FF"><th>Actor</th><th>Name</th></tr>
${actors.map(a=>`<tr><td>${a.emoji}</td><td>${a.name}</td></tr>`).join("")}
</table>
${phases.map((p,i)=>{const actor=actors.find(a=>a.id===p.actorId);return`
<h3 style="color:#4F46E5">Step ${i+1}: ${p.title}</h3>
<p><b>Owner:</b> ${actor?.emoji} ${actor?.name}</p><p><i>${p.description}</i></p>
<ol>${p.steps.map(s=>`<li>${s}</li>`).join("")}</ol>
<p><b>Output:</b> ${p.output}</p>${p.note?`<p><b>Note:</b> ${p.note}</p>`:""}<hr/>`}).join("")}
<h2>Key Insights</h2><ul>${(data.keyInsights||[]).map(i=>`<li>${i}</li>`).join("")}</ul>`;
  const full=`<html xmlns:o='urn:schemas-microsoft-com:office:office' xmlns:w='urn:schemas-microsoft-com:office:word' xmlns='http://www.w3.org/TR/REC-html40'><head><meta charset='utf-8'><title>${data.title}</title><style>body{font-family:Calibri,sans-serif;font-size:11pt;margin:2cm}</style></head><body>${body}</body></html>`;
  const b=new Blob(['\ufeff',full],{type:"application/msword"});const u=URL.createObjectURL(b);
  const a=document.createElement("a");a.href=u;a.download=`${data.title.replace(/\s+/g,"_")}.doc`;a.click();URL.revokeObjectURL(u);
}

function doExportPDF(data) {
  const gc=(idx)=>COLORS[idx%COLORS.length];
  const phases=data.phases||[];const actors=data.actors||[];
  const html=`<!DOCTYPE html><html><head><meta charset="UTF-8"/><title>${data.title}</title>
<style>@page{margin:2cm;size:A4}body{font-family:'Segoe UI',sans-serif;font-size:10.5pt;color:#0F172A;line-height:1.6}
h1{font-size:20pt;color:#4F46E5;font-weight:700;margin-bottom:6px}
.phase{border:1px solid #E2E8F0;border-radius:8px;padding:14px;margin-bottom:8px;page-break-inside:avoid}
.footer{text-align:center;font-size:8pt;color:#94A3B8;margin-top:20px;letter-spacing:1.5px}
.print-btn{position:fixed;top:16px;right:16px;background:#4F46E5;color:white;border:none;border-radius:8px;padding:10px 20px;cursor:pointer;font-weight:600}
@media print{.print-btn{display:none}}</style></head><body>
<button class="print-btn" onclick="window.print()">Save PDF</button>
<h1>${data.title}</h1><p style="color:#64748B;margin-bottom:16px">${data.summary}</p>
${phases.map((p,idx)=>{const c=gc(data.actors?.findIndex(a=>a.id===p.actorId)??0);const actor=actors.find(a=>a.id===p.actorId);return`
<div class="phase" style="border-left:3px solid ${c}">
<b style="color:${c}">${p.icon} Step ${idx+1}: ${p.title}</b> <span style="color:#64748B;font-size:9pt">— ${actor?.name}</span><br/>
${p.steps.map((s,i)=>`${i+1}. ${s}`).join("  ·  ")}<br/>
<span style="color:${c}">✓ ${p.output}</span>
${p.note?`<br/><span style="color:#92400E">⚠ ${p.note}</span>`:""}</div>
${idx<phases.length-1?`<div style="text-align:center;color:#6366F1;margin:4px 0;font-size:14pt">↓</div>`:""}`}).join("")}
<div style="margin-top:16px;border:1px solid #E2E8F0;border-radius:8px;padding:14px">
<b style="font-size:9pt;color:#6366F1;letter-spacing:1.5px;text-transform:uppercase">Key Insights</b><br/>
${(data.keyInsights||[]).map(i=>`<div style="font-size:9.5pt;color:#475569;margin-top:6px;padding-left:12px;border-left:2px solid #6366F133">${i}</div>`).join("")}</div>
<div class="footer">FLOWSCRIBE AI</div></body></html>`;
  const w=window.open('','_blank');w.document.write(html);w.document.close();
}

function doExportPPT(data) {
  const gc=(idx)=>COLORS[idx%COLORS.length];
  const phases=data.phases||[];const actors=data.actors||[];
  const slides=[
    `<div class="slide" style="background:linear-gradient(135deg,#4F46E5 0%,#7C3AED 100%);display:flex;flex-direction:column;align-items:center;justify-content:center;text-align:center;padding:60px">
      <div style="background:rgba(255,255,255,0.15);border-radius:12px;padding:6px 16px;font-size:11pt;color:white;margin-bottom:20px;letter-spacing:1px">AI · FLOWCHART · INTELLIGENCE</div>
      <h1 style="font-size:30pt;font-weight:800;color:white;letter-spacing:-1px;margin-bottom:14px;line-height:1.15">${data.title}</h1>
      <p style="font-size:13pt;color:rgba(255,255,255,0.8);max-width:560px;line-height:1.6">${data.summary}</p>
      <div style="display:flex;gap:10px;flex-wrap:wrap;justify-content:center;margin-top:28px">
        ${actors.map(a=>`<div style="background:rgba(255,255,255,0.2);border-radius:20px;padding:5px 16px;font-size:11pt;color:white">${a.emoji} ${a.name}</div>`).join("")}
      </div></div>`,
    ...phases.map((p,idx)=>{const c=gc(data.actors?.findIndex(a=>a.id===p.actorId)??0);const actor=actors.find(a=>a.id===p.actorId);return`
    <div class="slide" style="padding:44px 52px;background:#FAFBFF">
      <div style="display:flex;align-items:center;gap:14px;margin-bottom:24px;padding-bottom:16px;border-bottom:2px solid #F1F5F9">
        <div style="width:44px;height:44px;border-radius:10px;background:${c}15;border:1px solid ${c}33;display:flex;align-items:center;justify-content:center;font-size:22px">${p.icon}</div>
        <div><div style="font-size:16pt;font-weight:700;color:#0F172A">${p.title}</div>
        <div style="font-size:10pt;color:${c};font-weight:600;margin-top:2px">${actor?.emoji} ${actor?.name} · Step ${idx+1}</div></div></div>
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:28px">
        <div><div style="font-size:9pt;font-weight:700;color:#94A3B8;letter-spacing:1.5px;text-transform:uppercase;margin-bottom:12px">Process Steps</div>
        ${p.steps.map((s,i)=>`<div style="display:flex;gap:10px;margin-bottom:9px"><div style="min-width:22px;height:22px;border-radius:6px;background:${c}15;color:${c};font-size:9pt;font-weight:700;display:flex;align-items:center;justify-content:center">${i+1}</div><div style="font-size:10pt;color:#475569;line-height:1.5">${s}</div></div>`).join("")}</div>
        <div><div style="font-size:9pt;font-weight:700;color:#94A3B8;letter-spacing:1.5px;text-transform:uppercase;margin-bottom:12px">Output</div>
        <div style="background:${c}0D;border:1px solid ${c}22;border-radius:10px;padding:14px;font-size:10pt;color:#0F172A">✓ ${p.output}</div>
        ${p.note?`<div style="margin-top:10px;background:#FFFBEB;border:1px solid #FDE68A;border-radius:8px;padding:10px;font-size:9pt;color:#92400E">⚠ ${p.note}</div>`:""}</div>
      </div></div>`}).join(""),
    `<div class="slide" style="padding:44px 52px;background:#FAFBFF">
    <div style="font-size:9pt;font-weight:700;color:#6366F1;letter-spacing:2px;text-transform:uppercase;margin-bottom:24px">Key Insights</div>
    ${(data.keyInsights||[]).map((ins,i)=>`<div style="display:flex;gap:14px;margin-bottom:16px;padding-bottom:16px;border-bottom:1px solid #F1F5F9">
    <div style="min-width:28px;height:28px;border-radius:8px;background:linear-gradient(135deg,#6366F1,#8B5CF6);color:white;font-size:10pt;font-weight:700;display:flex;align-items:center;justify-content:center">${i+1}</div>
    <span style="font-size:11pt;color:#374151;line-height:1.6">${ins}</span></div>`).join("")}</div>`
  ];
  const full=`<!DOCTYPE html><html><head><meta charset="UTF-8"/><title>${data.title}</title>
<style>*{box-sizing:border-box;margin:0;padding:0}body{background:#F1F5F9;font-family:'Segoe UI',sans-serif;padding:20px}
.slide{width:960px;min-height:540px;border-radius:12px;margin:0 auto 20px;overflow:hidden;box-shadow:0 8px 32px rgba(0,0,0,0.12)}
@media print{body{background:white;padding:0}.slide{margin:0;page-break-after:always;border-radius:0}}</style>
</head><body>${slides.join("")}</body></html>`;
  const b=new Blob([full],{type:"text/html"});const u=URL.createObjectURL(b);
  const a=document.createElement("a");a.href=u;a.download=`${data.title.replace(/\s+/g,"_")}_slides.html`;a.click();URL.revokeObjectURL(u);
}

// ── STYLES ────────────────────────────────────────────────────────────────────
const GCSS = `
  @import url('https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700;800&display=swap');

  *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }

  :root {
    --bg:       #F8F9FF;
    --white:    #FFFFFF;
    --border:   #E4E7F0;
    --border2:  #D1D5E8;
    --text:     #0F172A;
    --text2:    #475569;
    --text3:    #94A3B8;
    --indigo:   #4F46E5;
    --indigo2:  #6366F1;
    --violet:   #7C3AED;
    --glow:     rgba(99,102,241,0.12);
    --surface:  #F1F3FF;
  }

  body {
    background: var(--bg);
    font-family: 'Plus Jakarta Sans', system-ui, sans-serif;
    color: var(--text);
    -webkit-font-smoothing: antialiased;
  }

  /* NAV */
  .nav {
    height: 62px;
    display: flex; align-items: center; justify-content: space-between;
    padding: 0 32px;
    background: rgba(255,255,255,0.9);
    backdrop-filter: blur(20px);
    border-bottom: 1px solid var(--border);
    position: sticky; top: 0; z-index: 100;
  }
  .nav-brand {
    display: flex; align-items: center; gap: 10px;
  }
  .nav-logo-box {
    width: 34px; height: 34px;
    background: linear-gradient(135deg, var(--indigo), var(--violet));
    border-radius: 9px;
    display: flex; align-items: center; justify-content: center;
    font-size: 17px;
    box-shadow: 0 2px 8px rgba(99,102,241,0.35);
  }
  .nav-name {
    font-size: 17px;
    font-weight: 800;
    color: var(--text);
    letter-spacing: -0.3px;
  }
  .nav-pill {
    background: linear-gradient(135deg, #EEF2FF, #F5F0FF);
    border: 1px solid #C7D2FE;
    border-radius: 20px;
    padding: 4px 12px;
    font-size: 11px;
    font-weight: 700;
    color: var(--indigo2);
    letter-spacing: 0.5px;
  }

  /* BUTTONS */
  .btn {
    font-family: 'Plus Jakarta Sans', sans-serif;
    font-size: 14px;
    font-weight: 600;
    border-radius: 10px;
    padding: 10px 22px;
    cursor: pointer;
    border: 1px solid transparent;
    transition: all 0.18s ease;
  }
  .btn-primary {
    background: linear-gradient(135deg, var(--indigo), var(--violet));
    color: white;
    box-shadow: 0 2px 12px rgba(99,102,241,0.3), 0 1px 0 rgba(255,255,255,0.1) inset;
  }
  .btn-primary:hover {
    transform: translateY(-1px);
    box-shadow: 0 6px 20px rgba(99,102,241,0.4);
  }
  .btn-primary:active { transform: translateY(0); }
  .btn-primary:disabled {
    background: #CBD5E1; box-shadow: none; cursor: not-allowed; transform: none;
  }
  .btn-secondary {
    background: white;
    color: var(--text2);
    border-color: var(--border);
    box-shadow: 0 1px 3px rgba(0,0,0,0.06);
  }
  .btn-secondary:hover { border-color: var(--border2); color: var(--text); background: #FAFBFF; }

  /* INPUT */
  .input {
    font-family: 'Plus Jakarta Sans', sans-serif;
    font-size: 14px;
    color: var(--text);
    background: white;
    border: 1.5px solid var(--border);
    border-radius: 10px;
    padding: 11px 14px;
    width: 100%;
    outline: none;
    transition: all 0.18s;
    box-shadow: 0 1px 3px rgba(0,0,0,0.05);
  }
  .input:focus {
    border-color: var(--indigo2);
    box-shadow: 0 0 0 4px rgba(99,102,241,0.1);
  }
  .input::placeholder { color: #C4C9D4; }

  /* CARD */
  .card {
    background: white;
    border: 1.5px solid var(--border);
    border-radius: 16px;
    box-shadow: 0 1px 4px rgba(0,0,0,0.05), 0 4px 16px rgba(99,102,241,0.04);
  }

  /* STEP BADGE */
  .step-badge {
    border-radius: 20px;
    font-size: 11px;
    font-weight: 700;
    padding: 3px 10px;
    letter-spacing: 0.3px;
  }

  /* PHASE ROW */
  .phase-row {
    background: white;
    border: 1.5px solid var(--border);
    border-radius: 12px;
    cursor: pointer;
    transition: all 0.18s ease;
    box-shadow: 0 1px 3px rgba(0,0,0,0.05);
  }
  .phase-row:hover {
    border-color: var(--indigo2);
    box-shadow: 0 4px 16px rgba(99,102,241,0.1);
    transform: translateY(-1px);
  }
  .phase-row.open {
    border-color: var(--indigo2);
    border-radius: 12px 12px 0 0;
    border-bottom: none;
    box-shadow: 0 4px 16px rgba(99,102,241,0.1);
    transform: translateY(-1px);
  }
  .phase-body {
    background: #FAFBFF;
    border: 1.5px solid var(--indigo2);
    border-top: none;
    border-radius: 0 0 12px 12px;
    padding: 20px 22px 24px;
    box-shadow: 0 4px 16px rgba(99,102,241,0.08);
    transform: translateY(-1px);
  }

  /* LABEL */
  .label {
    font-size: 10px;
    font-weight: 700;
    letter-spacing: 1.5px;
    color: var(--text3);
    text-transform: uppercase;
    margin-bottom: 10px;
  }

  /* EXPORT BTN */
  .exp-btn {
    font-family: 'Plus Jakarta Sans', sans-serif;
    font-size: 12px;
    font-weight: 600;
    border-radius: 8px;
    padding: 7px 14px;
    cursor: pointer;
    border: 1.5px solid var(--border);
    background: white;
    color: var(--text2);
    transition: all 0.18s;
    display: flex; align-items: center; gap: 5px;
    box-shadow: 0 1px 3px rgba(0,0,0,0.05);
  }
  .exp-btn:hover {
    border-color: var(--indigo2);
    color: var(--indigo);
    background: #EEF2FF;
    transform: translateY(-1px);
    box-shadow: 0 3px 10px rgba(99,102,241,0.12);
  }

  /* CONNECTOR */
  .connector { width: 2px; height: 28px; background: linear-gradient(180deg,#6366F1,#8B5CF6); margin: 0 auto; opacity: 0.25; border-radius: 2px; }

  /* FEATURE CHIPS */
  .feature-chip {
    display: flex; align-items: center; gap: 7px;
    padding: 7px 14px;
    background: white;
    border: 1.5px solid var(--border);
    border-radius: 20px;
    font-size: 13px;
    font-weight: 500;
    color: var(--text2);
    box-shadow: 0 1px 3px rgba(0,0,0,0.05);
  }
  .feature-chip-dot { width:7px; height:7px; border-radius:50%; background:linear-gradient(135deg,var(--indigo),var(--violet)); }

  /* ANIMATIONS */
  @keyframes fadeUp { from{opacity:0;transform:translateY(16px)} to{opacity:1;transform:translateY(0)} }
  @keyframes pulse { 0%,100%{opacity:1} 50%{opacity:0.35} }
  @keyframes shimmer { 0%{background-position:200% center} 100%{background-position:-200% center} }
  @keyframes spin { from{transform:rotate(0deg)} to{transform:rotate(360deg)} }
  @keyframes flowStep { 0%{opacity:0.3;transform:scale(0.97)} 100%{opacity:1;transform:scale(1)} }

  .fade-up   { animation: fadeUp 0.4s ease both; }
  .fade-up-1 { animation: fadeUp 0.4s 0.06s ease both; }
  .fade-up-2 { animation: fadeUp 0.4s 0.12s ease both; }
  .fade-up-3 { animation: fadeUp 0.4s 0.18s ease both; }
  .fade-up-4 { animation: fadeUp 0.4s 0.24s ease both; }
`;

// ── FLOW PREVIEW (animated) ───────────────────────────────────────────────────
function FlowPreview() {
  const [active, setActive] = useState(0);
  useEffect(() => {
    const t = setInterval(() => setActive(a => (a + 1) % 4), 1100);
    return () => clearInterval(t);
  }, []);
  const steps = [
    { icon:"📄", label:"Upload doc", color:"#6366F1" },
    { icon:"🤖", label:"AI reads it", color:"#8B5CF6" },
    { icon:"🔀", label:"Maps process", color:"#06B6D4" },
    { icon:"📊", label:"Export ready", color:"#10B981" },
  ];
  return (
    <div style={{ display:"flex", alignItems:"center", gap:"6px", padding:"14px 18px", background:"white", border:"1.5px solid var(--border)", borderRadius:"12px", boxShadow:"0 2px 8px rgba(99,102,241,0.06)", flexWrap:"wrap" }}>
      {steps.map((s, i) => (
        <div key={i} style={{ display:"flex", alignItems:"center", gap:"6px" }}>
          <div style={{
            display:"flex", alignItems:"center", gap:"7px",
            padding:"6px 12px", borderRadius:"8px",
            border:`1.5px solid ${active >= i ? s.color+"44" : "var(--border)"}`,
            background: active >= i ? `${s.color}0D` : "transparent",
            transition:"all 0.35s ease",
            fontSize:"13px", fontWeight:600,
            color: active >= i ? s.color : "var(--text3)",
          }}>
            <span>{s.icon}</span>
            <span>{s.label}</span>
          </div>
          {i < steps.length - 1 && (
            <div style={{ color: active > i ? "#6366F1" : "#D1D5DB", fontSize:"16px", fontWeight:700, transition:"color 0.35s", margin:"0 2px" }}>→</div>
          )}
        </div>
      ))}
    </div>
  );
}

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
    <div style={{ minHeight:"100vh", background:"var(--bg)" }}>
      <style>{GCSS}</style>

      <nav className="nav">
        <div className="nav-brand">
          <div className="nav-logo-box">⬡</div>
          <span className="nav-name">FlowScribe</span>
        </div>
        <div className="nav-pill">AI POWERED</div>
      </nav>

      <div style={{ maxWidth:"520px", margin:"0 auto", padding:"64px 24px 80px" }}>

        {/* Hero */}
        <div className="fade-up" style={{ marginBottom:"44px" }}>
          <div style={{ display:"inline-flex", alignItems:"center", gap:"6px", background:"#EEF2FF", border:"1px solid #C7D2FE", borderRadius:"20px", padding:"5px 14px", fontSize:"12px", fontWeight:700, color:"var(--indigo2)", marginBottom:"20px" }}>
            ✦ Transcript to Flowchart — AI Powered
          </div>
          <h1 style={{ fontSize:"clamp(28px,4vw,42px)", fontWeight:800, lineHeight:1.1, letterSpacing:"-1px", marginBottom:"14px", color:"var(--text)" }}>
            Turn any meeting into a{" "}
            <span style={{ background:"linear-gradient(135deg,#4F46E5,#7C3AED)", WebkitBackgroundClip:"text", WebkitTextFillColor:"transparent" }}>
              visual flowchart
            </span>
          </h1>
          <p style={{ fontSize:"15px", color:"var(--text2)", lineHeight:1.75, marginBottom:"22px" }}>
            Upload a transcript, SOP, or meeting doc. Our AI instantly extracts every actor, step, and decision — building you a clean, interactive flowchart ready to export.
          </p>
          <FlowPreview />
        </div>

        {/* Card */}
        <div className="card fade-up-1" style={{ padding:"28px" }}>
          <div style={{ display:"flex", alignItems:"center", gap:"10px", marginBottom:"20px" }}>
            <div style={{ width:"36px", height:"36px", background:"linear-gradient(135deg,#EEF2FF,#F5F0FF)", border:"1px solid #C7D2FE", borderRadius:"10px", display:"flex", alignItems:"center", justifyContent:"center", fontSize:"17px" }}>🔑</div>
            <div>
              <div style={{ fontWeight:700, fontSize:"15px", color:"var(--text)" }}>Connect your AI Engine</div>
              <div style={{ fontSize:"12px", color:"var(--text3)", marginTop:"1px" }}>Anthropic API key required</div>
            </div>
          </div>

          <div className="label">Your API Key</div>
          <div style={{ display:"flex", gap:"8px", marginBottom:"14px" }}>
            <input className="input" type={show?"text":"password"} value={key}
              onChange={e=>{setKey(e.target.value);setError("");}}
              placeholder="sk-ant-api03-…"
              onKeyDown={e=>e.key==="Enter"&&handleSave()}
              style={{ flex:1 }}
            />
            <button className="btn btn-secondary" onClick={()=>setShow(!show)} style={{padding:"10px 14px",flexShrink:0,fontSize:"13px"}}>{show?"Hide":"Show"}</button>
          </div>

          {error && (
            <div style={{ fontSize:"13px", color:"#DC2626", marginBottom:"14px", padding:"10px 14px", background:"#FEF2F2", borderRadius:"8px", border:"1px solid #FECACA", display:"flex", gap:"8px", alignItems:"flex-start" }}>
              <span>⚠️</span> {error}
            </div>
          )}

          <button className="btn btn-primary" onClick={handleSave} disabled={!key||testing} style={{ width:"100%", fontSize:"15px", padding:"12px" }}>
            {testing ? "Verifying key…" : "Get Started →"}
          </button>

          <div style={{ marginTop:"22px", paddingTop:"20px", borderTop:"1px solid var(--border)" }}>
            <div className="label" style={{ marginBottom:"14px" }}>How to get your key</div>
            <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:"10px" }}>
              {[["1","Visit console.anthropic.com","🌐"],["2","Sign up or log in","👤"],["3","API Keys → Create Key","🔐"],["4","Paste above & go","✅"]].map(([n,t,ic])=>(
                <div key={n} style={{ display:"flex", gap:"10px", padding:"10px 12px", background:"var(--surface)", borderRadius:"8px", border:"1px solid var(--border)", alignItems:"flex-start" }}>
                  <span style={{ fontSize:"15px" }}>{ic}</span>
                  <div>
                    <div style={{ fontSize:"10px", fontWeight:700, color:"var(--indigo2)", marginBottom:"2px" }}>STEP {n}</div>
                    <div style={{ fontSize:"12px", color:"var(--text2)", lineHeight:1.4 }}>{t}</div>
                  </div>
                </div>
              ))}
            </div>
            <div style={{ marginTop:"14px", display:"flex", alignItems:"center", gap:"8px", padding:"10px 14px", background:"#ECFDF5", border:"1px solid #A7F3D0", borderRadius:"8px" }}>
              <span style={{ fontSize:"15px" }}>💚</span>
              <span style={{ fontSize:"13px", color:"#065F46", fontWeight:500 }}>Extremely affordable — approximately $0.001 per analysis</span>
            </div>
          </div>
        </div>

        <p style={{ textAlign:"center", fontSize:"11px", color:"var(--text3)", marginTop:"18px" }}>
          🔒 Your API key is stored in your browser session only. Never shared.
        </p>
      </div>
    </div>
  );
}

// ── EXPORT BAR ─────────────────────────────────────────────────────────────────
function ExportBar({ data }) {
  const [busy, setBusy] = useState(null);
  const go = (type, fn) => { setBusy(type); setTimeout(()=>{fn(data);setBusy(null);},200); };
  const exports = [
    {type:"html", icon:"🌐", label:"HTML",   fn:doExportHTML},
    {type:"word", icon:"📝", label:"Word",   fn:doExportWord},
    {type:"pdf",  icon:"📄", label:"PDF",    fn:doExportPDF},
    {type:"ppt",  icon:"📊", label:"Slides", fn:doExportPPT},
  ];
  return (
    <div style={{ display:"flex", gap:"8px", flexWrap:"wrap" }}>
      {exports.map(({type,icon,label,fn})=>(
        <button key={type} className="exp-btn" onClick={()=>go(type,fn)} disabled={!!busy}>
          {busy===type?"⏳":icon} {label}
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
    <div style={{ maxWidth:"800px", margin:"0 auto", padding:"0 24px 80px" }}>

      {/* Header */}
      <div style={{ paddingTop:"52px", marginBottom:"36px" }}>
        <div style={{ display:"inline-flex", alignItems:"center", gap:"6px", background:"#ECFDF5", border:"1px solid #A7F3D0", borderRadius:"20px", padding:"5px 14px", fontSize:"12px", fontWeight:700, color:"#065F46", marginBottom:"16px" }}>
          ✅ Flowchart Generated
        </div>
        <h1 className="fade-up" style={{ fontSize:"clamp(22px,3vw,32px)", fontWeight:800, letterSpacing:"-0.5px", marginBottom:"10px", color:"var(--text)" }}>
          {data.title}
        </h1>
        <p className="fade-up-1" style={{ fontSize:"15px", color:"var(--text2)", lineHeight:1.65, marginBottom:"20px", maxWidth:"580px" }}>
          {data.summary}
        </p>
        <div className="fade-up-2" style={{ display:"flex", gap:"8px", flexWrap:"wrap", marginBottom:"24px" }}>
          {(data.actors||[]).map((a,i) => (
            <div key={a.id} className="step-badge" style={{ background:`${COLORS[i%COLORS.length]}0D`, border:`1.5px solid ${COLORS[i%COLORS.length]}33`, color:COLORS[i%COLORS.length] }}>
              {a.emoji} {a.name}
            </div>
          ))}
        </div>

        {/* Stats */}
        <div className="fade-up-2" style={{ display:"flex", gap:"16px", marginBottom:"24px", padding:"16px 20px", background:"white", border:"1.5px solid var(--border)", borderRadius:"12px", boxShadow:"0 1px 4px rgba(0,0,0,0.05)" }}>
          {[
            {n:data.phases?.length||0, label:"Phases", icon:"🔀"},
            {n:data.actors?.length||0, label:"Actors", icon:"👥"},
            {n:data.keyInsights?.length||0, label:"Insights", icon:"💡"},
            {n:data.phases?.filter(p=>p.isDecision).length||0, label:"Decisions", icon:"◆"},
          ].map(({n,label,icon})=>(
            <div key={label} style={{ textAlign:"center", flex:1 }}>
              <div style={{ fontSize:"11px", marginBottom:"4px" }}>{icon}</div>
              <div style={{ fontSize:"20px", fontWeight:800, color:"var(--indigo)", lineHeight:1 }}>{n}</div>
              <div style={{ fontSize:"11px", color:"var(--text3)", fontWeight:500, marginTop:"3px" }}>{label}</div>
            </div>
          ))}
        </div>

        <div className="fade-up-3">
          <div className="label" style={{marginBottom:"10px"}}>Export Document</div>
          <ExportBar data={data}/>
        </div>
      </div>

      {/* Divider */}
      <div style={{ display:"flex", alignItems:"center", gap:"14px", marginBottom:"28px" }}>
        <div style={{ flex:1, height:"1px", background:"var(--border)" }}/>
        <span style={{ fontSize:"11px", fontWeight:700, color:"var(--text3)", letterSpacing:"1px" }}>PROCESS FLOW</span>
        <div style={{ flex:1, height:"1px", background:"var(--border)" }}/>
      </div>

      {/* Phases */}
      <div>
        {(data.phases||[]).map((phase, index) => {
          const color = gc(phase.actorId);
          const actor = ga(phase.actorId);
          const isOpen = active === phase.id;
          return (
            <div key={phase.id} className="fade-up" style={{ animationDelay:`${index*0.05}s` }}>
              <div className={`phase-row${isOpen?" open":""}`} onClick={()=>setActive(isOpen?null:phase.id)}
                style={{ borderColor: isOpen ? color : undefined }}>
                <div style={{ padding:"15px 18px", display:"flex", alignItems:"center", gap:"14px" }}>
                  <div style={{ width:"44px", height:"44px", borderRadius:"10px", background:`${color}12`, border:`1.5px solid ${color}30`, display:"flex", alignItems:"center", justifyContent:"center", fontSize:"20px", flexShrink:0 }}>
                    {phase.icon}
                  </div>
                  <div style={{ flex:1, minWidth:0 }}>
                    <div style={{ fontSize:"14px", fontWeight:700, color:"var(--text)", marginBottom:"3px" }}>{phase.title}</div>
                    <div style={{ fontSize:"12px", color, fontWeight:600 }}>{actor?.emoji} {actor?.name}</div>
                  </div>
                  <div className="step-badge" style={{ background:`${color}0D`, border:`1px solid ${color}30`, color, flexShrink:0 }}>
                    Step {index+1}
                  </div>
                  <div style={{ width:"28px", height:"28px", borderRadius:"7px", background: isOpen?`${color}12`:"var(--surface)", border:`1.5px solid ${isOpen?color:"var(--border)"}`, display:"flex", alignItems:"center", justifyContent:"center", fontSize:"16px", color: isOpen?color:"var(--text3)", transition:"all 0.2s", flexShrink:0, fontWeight:700 }}>
                    {isOpen ? "−" : "+"}
                  </div>
                </div>
              </div>

              {isOpen && (
                <div className="phase-body">
                  <p style={{ fontSize:"13px", color:"var(--text2)", lineHeight:1.65, marginBottom:"20px", padding:"10px 14px", background:`${color}08`, borderLeft:`3px solid ${color}55`, borderRadius:"0 8px 8px 0" }}>
                    {phase.description}
                  </p>
                  <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:"24px" }}>
                    <div>
                      <div className="label">Process Steps</div>
                      {phase.steps.map((step,i)=>(
                        <div key={i} style={{ display:"flex", gap:"10px", marginBottom:"10px", alignItems:"flex-start" }}>
                          <span style={{ minWidth:"22px", height:"22px", borderRadius:"6px", background:`${color}14`, border:`1px solid ${color}28`, display:"flex", alignItems:"center", justifyContent:"center", fontSize:"10px", color, fontWeight:700, flexShrink:0, marginTop:"1px" }}>{i+1}</span>
                          <span style={{ fontSize:"13px", color:"var(--text2)", lineHeight:1.55 }}>{step}</span>
                        </div>
                      ))}
                      {phase.isDecision && (
                        <div style={{ marginTop:"14px", padding:"12px 14px", background:"#FFFBEB", border:"1.5px solid #FDE68A", borderRadius:"10px", fontSize:"12px" }}>
                          <div style={{ fontWeight:700, color:"#92400E", marginBottom:"6px" }}>◆ {phase.decisionQuestion}</div>
                          <div style={{ color:"#065F46", marginBottom:"3px" }}>✅ Yes → {phase.decisionYes}</div>
                          <div style={{ color:"#991B1B" }}>❌ No → {phase.decisionNo}</div>
                        </div>
                      )}
                    </div>
                    <div>
                      <div className="label">Output</div>
                      <div style={{ padding:"12px 14px", background:`${color}0A`, border:`1.5px solid ${color}25`, borderRadius:"10px", fontSize:"13px", color:"var(--text)", lineHeight:1.55, marginBottom:"12px" }}>
                        ✓ {phase.output}
                      </div>
                      {phase.note && (
                        <div style={{ padding:"10px 12px", background:"#FFFBEB", border:"1.5px solid #FDE68A", borderRadius:"10px", fontSize:"12px", color:"#92400E", lineHeight:1.5 }}>
                          ⚠️ {phase.note}
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              )}

              {index < data.phases.length-1 && <div className="connector" style={{ margin:"6px auto" }}/>}
            </div>
          );
        })}
      </div>

      {/* Insights */}
      {data.keyInsights?.length > 0 && (
        <div className="card" style={{ padding:"22px 24px", marginTop:"32px" }}>
          <div style={{ display:"flex", alignItems:"center", gap:"8px", marginBottom:"16px" }}>
            <span style={{ fontSize:"18px" }}>💡</span>
            <div className="label" style={{ margin:0 }}>Key Insights</div>
          </div>
          {data.keyInsights.map((ins,i)=>(
            <div key={i} style={{ fontSize:"13px", color:"var(--text2)", marginBottom:"10px", paddingLeft:"14px", borderLeft:`3px solid ${COLORS[i%COLORS.length]}55`, lineHeight:1.65, padding:"8px 14px", background:`${COLORS[i%COLORS.length]}05`, borderRadius:"0 8px 8px 0" }}>
              {ins}
            </div>
          ))}
        </div>
      )}

      <div style={{ marginTop:"36px", paddingTop:"24px", borderTop:"1px solid var(--border)" }}>
        <div className="label" style={{ marginBottom:"12px" }}>Export Your Flowchart</div>
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
      setProgress("AI is analyzing your document…");
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
    <div style={{ minHeight:"100vh", background:"var(--bg)" }}>
      <style>{GCSS}</style>

      <nav className="nav">
        <div className="nav-brand">
          <div className="nav-logo-box">⬡</div>
          <span className="nav-name">FlowScribe</span>
        </div>
        <div style={{ display:"flex", alignItems:"center", gap:"10px" }}>
          {stage==="result" && <button className="btn btn-secondary" onClick={reset} style={{padding:"8px 16px",fontSize:"13px"}}>← New Analysis</button>}
          <button onClick={()=>setApiKey("")} className="btn btn-secondary" style={{padding:"8px 16px",fontSize:"13px"}}>API Key</button>
          <div className="nav-pill">AI READY</div>
        </div>
      </nav>

      {/* Upload */}
      {stage==="upload" && (
        <div style={{ maxWidth:"640px", margin:"0 auto", padding:"64px 24px 80px" }}>

          {/* Hero */}
          <div className="fade-up" style={{ marginBottom:"44px" }}>
            <div style={{ display:"inline-flex", alignItems:"center", gap:"6px", background:"#EEF2FF", border:"1px solid #C7D2FE", borderRadius:"20px", padding:"5px 14px", fontSize:"12px", fontWeight:700, color:"var(--indigo2)", marginBottom:"20px" }}>
              ✦ AI-Powered Flowchart Generator
            </div>
            <h1 style={{ fontSize:"clamp(28px,4vw,46px)", fontWeight:800, lineHeight:1.08, letterSpacing:"-1.2px", marginBottom:"16px", color:"var(--text)" }}>
              Transcripts in.{" "}
              <span style={{ background:"linear-gradient(135deg,#4F46E5,#7C3AED)", WebkitBackgroundClip:"text", WebkitTextFillColor:"transparent" }}>
                Flowcharts out.
              </span>
            </h1>
            <p style={{ fontSize:"16px", color:"var(--text2)", lineHeight:1.75, maxWidth:"520px", marginBottom:"24px" }}>
              Upload any meeting transcript, SOP, or process document. Our AI extracts every actor, step, and decision — building a clean interactive flowchart you can export in one click.
            </p>
            <FlowPreview/>
          </div>

          {/* Feature chips */}
          <div className="fade-up-1" style={{ display:"flex", gap:"8px", flexWrap:"wrap", marginBottom:"28px" }}>
            {[["🤖","AI Extraction"],["👥","Actor Mapping"],["🔀","Decision Trees"],["📊","PowerPoint"],["📄","PDF Export"]].map(([ic,l])=>(
              <div key={l} className="feature-chip"><div className="feature-chip-dot"/>{ic} {l}</div>
            ))}
          </div>

          {/* Drop zone */}
          <div className="fade-up-2" style={{ marginBottom:"14px" }}>
            <div
              onDragOver={e=>{e.preventDefault();setDragOver(true);}}
              onDragLeave={()=>setDragOver(false)}
              onDrop={handleDrop}
              onClick={()=>fileRef.current?.click()}
              style={{
                border:`2px dashed ${dragOver?"var(--indigo2)":"var(--border2)"}`,
                borderRadius:"14px", padding:"44px 32px", textAlign:"center", cursor:"pointer",
                background: dragOver ? "#EEF2FF" : "white",
                transition:"all 0.2s",
                boxShadow: dragOver ? "0 0 0 4px rgba(99,102,241,0.1)" : "0 1px 4px rgba(0,0,0,0.05)",
              }}
            >
              <div style={{ fontSize:"36px", marginBottom:"12px" }}>{dragOver?"📂":"📁"}</div>
              <div style={{ fontSize:"16px", fontWeight:700, color:"var(--text)", marginBottom:"5px" }}>
                {dragOver ? "Drop to analyze!" : "Drop your document here"}
              </div>
              <div style={{ fontSize:"13px", color:"var(--text3)", marginBottom:"16px" }}>or click to browse your files</div>
              <div style={{ display:"flex", gap:"6px", justifyContent:"center", flexWrap:"wrap" }}>
                {[".TXT",".MD",".CSV",".DOCX",".PDF"].map(e=>(
                  <span key={e} style={{ fontSize:"11px", fontWeight:600, color:"var(--indigo2)", padding:"3px 10px", background:"#EEF2FF", borderRadius:"5px", border:"1px solid #C7D2FE" }}>{e}</span>
                ))}
              </div>
            </div>
          </div>
          <input ref={fileRef} type="file" accept=".txt,.md,.csv,.pdf,.docx,.doc" onChange={handleFile} style={{display:"none"}}/>

          <div className="fade-up-2" style={{ display:"flex", alignItems:"center", gap:"14px", margin:"20px 0" }}>
            <div style={{flex:1,height:"1px",background:"var(--border)"}}/>
            <span style={{fontSize:"12px",fontWeight:600,color:"var(--text3)"}}>or paste text directly</span>
            <div style={{flex:1,height:"1px",background:"var(--border)"}}/>
          </div>

          {/* Paste */}
          <div className="card fade-up-3" style={{ overflow:"hidden", marginBottom:"28px" }}>
            <div onClick={()=>setShowPaste(v=>!v)} style={{ padding:"15px 20px", display:"flex", alignItems:"center", justifyContent:"space-between", cursor:"pointer", borderBottom:showPaste?"1.5px solid var(--border)":"none" }}>
              <div style={{ display:"flex", alignItems:"center", gap:"12px" }}>
                <span style={{ fontSize:"20px" }}>✏️</span>
                <div>
                  <div style={{ fontSize:"14px", fontWeight:600, color:"var(--text)" }}>Paste transcript or text</div>
                  <div style={{ fontSize:"12px", color:"var(--text3)" }}>Meeting notes, SOPs, chat exports...</div>
                </div>
              </div>
              <div style={{ color:"var(--text3)", fontSize:"20px", transition:"transform 0.2s", transform:showPaste?"rotate(90deg)":"rotate(0)", fontWeight:700 }}>›</div>
            </div>
            {showPaste && (
              <div style={{ padding:"16px 20px 20px" }}>
                <textarea className="input" value={pasteText} onChange={e=>setPasteText(e.target.value)} autoFocus
                  placeholder="Paste your meeting transcript, SOP, or process document here..."
                  style={{minHeight:"140px",resize:"vertical",lineHeight:1.65}}/>
                <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginTop:"12px" }}>
                  <span style={{ fontSize:"12px", fontWeight:500, color:pasteText.length<50?"var(--text3)":"#059669" }}>
                    {pasteText.length<50?`${pasteText.length} / 50 chars minimum`:`✓ ${pasteText.length} characters`}
                  </span>
                  <div style={{ display:"flex", gap:"8px" }}>
                    <button className="btn btn-secondary" onClick={()=>{setPasteText("");setShowPaste(false);}} style={{padding:"8px 16px",fontSize:"13px"}}>Clear</button>
                    <button className="btn btn-primary" onClick={()=>pasteText.trim().length>=50&&run(pasteText,"Pasted text")} disabled={pasteText.trim().length<50}
                      style={{padding:"8px 20px",fontSize:"13px",opacity:pasteText.trim().length>=50?1:0.5}}>
                      Analyze →
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Processing */}
      {stage==="processing" && (
        <div style={{ maxWidth:"460px", margin:"80px auto", padding:"0 24px", textAlign:"center" }}>
          <div className="card" style={{ padding:"40px 32px" }}>
            <div style={{ width:"64px", height:"64px", background:"linear-gradient(135deg,var(--indigo),var(--violet))", borderRadius:"16px", display:"flex", alignItems:"center", justifyContent:"center", fontSize:"28px", margin:"0 auto 22px", boxShadow:"0 6px 20px rgba(99,102,241,0.35)", animation:"spin 3s linear infinite" }}>⬡</div>
            <h2 style={{ fontSize:"20px", fontWeight:800, marginBottom:"8px", color:"var(--text)" }}>Analyzing your document</h2>
            <p style={{ fontSize:"13px", color:"var(--indigo2)", fontWeight:600, marginBottom:"5px" }}>{progress}</p>
            <p style={{ fontSize:"12px", color:"var(--text3)", marginBottom:"28px" }}>📄 {fileName}</p>
            <div style={{ display:"flex", flexDirection:"column", gap:"8px", textAlign:"left" }}>
              {["Reading & parsing document","Identifying actors & roles","Extracting process steps","Detecting decision points","Building your flowchart"].map((s,i)=>(
                <div key={s} style={{ display:"flex", alignItems:"center", gap:"12px", padding:"10px 14px", background:"var(--surface)", border:"1px solid var(--border)", borderRadius:"8px" }}>
                  <div style={{ width:"7px", height:"7px", borderRadius:"50%", background:"linear-gradient(135deg,var(--indigo),var(--violet))", animation:`pulse ${1+i*0.15}s ease-in-out infinite`, flexShrink:0 }}/>
                  <span style={{ fontSize:"13px", color:"var(--text2)", fontWeight:500 }}>{s}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {stage==="result" && flowData && <div className="fade-up"><ResultView data={flowData}/></div>}

      {stage==="error" && (
        <div style={{ maxWidth:"420px", margin:"80px auto", padding:"0 24px", textAlign:"center" }}>
          <div className="card" style={{ padding:"36px 32px" }}>
            <div style={{ fontSize:"42px", marginBottom:"16px" }}>😕</div>
            <h2 style={{ fontSize:"20px", fontWeight:800, marginBottom:"10px", color:"var(--text)" }}>Something went wrong</h2>
            <div style={{ fontSize:"13px", color:"#DC2626", padding:"12px 14px", background:"#FEF2F2", border:"1px solid #FECACA", borderRadius:"10px", marginBottom:"24px", lineHeight:1.55 }}>{errorMsg}</div>
            <div style={{ display:"flex", gap:"8px", justifyContent:"center" }}>
              <button className="btn btn-primary" onClick={reset}>Try Again</button>
              <button className="btn btn-secondary" onClick={()=>setApiKey("")}>Change Key</button>
            </div>
          </div>
        </div>
      )}

      <div style={{ textAlign:"center", padding:"24px", borderTop:"1px solid var(--border)", marginTop:"20px" }}>
        <span style={{ fontSize:"12px", color:"var(--text3)", fontWeight:500 }}>FlowScribe AI · Turn transcripts into visual flowcharts</span>
      </div>
    </div>
  );
}