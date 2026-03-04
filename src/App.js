import { useState, useRef, useCallback, useEffect } from "react";

const COLORS = ["#00E5FF","#7C3AED","#10B981","#F59E0B","#EF4444","#EC4899","#3B82F6","#8B5CF6"];

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

// ── EXPORTS (unchanged logic) ──────────────────────────────────────────────────
function doExportHTML(data) {
  const gc=(idx)=>COLORS[idx%COLORS.length];
  const html=`<!DOCTYPE html><html><head><meta charset="UTF-8"/><title>${data.title}</title>
<style>*{box-sizing:border-box;margin:0;padding:0}body{background:#0A0E1A;font-family:'Segoe UI',sans-serif;padding:40px 20px;color:#E2E8F0}
.w{max-width:780px;margin:0 auto}h1{font-size:26px;font-weight:700;color:#00E5FF;text-align:center;margin-bottom:8px}
.sum{text-align:center;color:#94A3B8;margin-bottom:20px}.acts{display:flex;gap:8px;justify-content:center;flex-wrap:wrap;margin-bottom:28px}
.act{padding:4px 14px;border-radius:4px;font-size:12px;font-weight:600;border:1px solid #00E5FF44;color:#00E5FF;background:#00E5FF11}
.phase{background:#0F1629;border-radius:8px;padding:18px;margin-bottom:4px;border:1px solid #1E293B}
.grid{display:grid;grid-template-columns:1fr 1fr;gap:14px}
.lbl{font-size:10px;font-weight:700;letter-spacing:2px;margin-bottom:8px;color:#00E5FF;text-transform:uppercase}
.step{display:flex;gap:8px;margin-bottom:6px;font-size:13px;color:#CBD5E1}
.out{border-radius:6px;padding:10px;font-size:13px;margin-bottom:8px;background:#00E5FF0A;border:1px solid #00E5FF33}
.arr{text-align:center;font-size:20px;color:#00E5FF44;margin:4px 0}
.footer{text-align:center;margin-top:20px;font-size:11px;color:#475569;letter-spacing:2px}</style></head><body>
<div class="w"><h1>${data.title}</h1><p class="sum">${data.summary}</p>
<div class="acts">${(data.actors||[]).map(a=>`<div class="act">${a.emoji} ${a.name}</div>`).join("")}</div>
${(data.phases||[]).map((p,idx)=>{const actor=data.actors?.find(a=>a.id===p.actorId);return`
<div class="phase"><div style="display:flex;align-items:center;gap:12px;margin-bottom:12px">
<span style="font-size:20px">${p.icon}</span>
<div><div style="font-size:14px;font-weight:600;color:#E2E8F0">${p.title}</div>
<div style="font-size:11px;color:#00E5FF">${actor?.emoji} ${actor?.name} · Step ${idx+1}</div></div></div>
<div class="grid"><div><div class="lbl">Steps</div>
${p.steps.map((s,i)=>`<div class="step"><span style="color:#00E5FF;min-width:20px;font-size:11px">${i+1}.</span><span>${s}</span></div>`).join("")}
${p.isDecision?`<div style="background:#F59E0B11;border:1px solid #F59E0B44;border-radius:6px;padding:10px;font-size:12px;margin-top:10px;color:#FCD34D"><b>◆ ${p.decisionQuestion}</b><br/>✓ ${p.decisionYes}<br/>✗ ${p.decisionNo}</div>`:""}
</div><div><div class="lbl">Output</div>
<div class="out">→ ${p.output}</div>
${p.note?`<div style="font-size:12px;color:#FCD34D;padding:8px;background:#F59E0B11;border-radius:6px;border:1px solid #F59E0B33">⚠ ${p.note}</div>`:""}</div></div></div>
${idx<data.phases.length-1?`<div class="arr">↓</div>`:""}`}).join("")}
<div style="background:#0F1629;border-radius:8px;padding:20px;margin-top:16px;border:1px solid #1E293B">
<div class="lbl">Key Insights</div>
${(data.keyInsights||[]).map(i=>`<div style="font-size:13px;color:#CBD5E1;margin-bottom:8px;padding-left:12px;border-left:2px solid #00E5FF44;line-height:1.6">${i}</div>`).join("")}</div>
<div class="footer">FLOWSCRIBE AI</div></div></body></html>`;
  const b=new Blob([html],{type:"text/html"});const u=URL.createObjectURL(b);
  const a=document.createElement("a");a.href=u;a.download=`${data.title.replace(/\s+/g,"_")}.html`;a.click();URL.revokeObjectURL(u);
}

function doExportWord(data) {
  const phases=data.phases||[];const actors=data.actors||[];
  const body=`<h1 style="color:#1E40AF">${data.title}</h1><p style="color:#64748B;font-style:italic">${data.summary}</p><br/>
<h2>Participants</h2>
<table border="1" cellpadding="8" style="border-collapse:collapse;width:100%;margin-bottom:20px">
<tr style="background:#EFF6FF"><th>Actor</th><th>Name</th></tr>
${actors.map(a=>`<tr><td>${a.emoji}</td><td>${a.name}</td></tr>`).join("")}
</table>
${phases.map((p,i)=>{const actor=actors.find(a=>a.id===p.actorId);return`
<h3 style="color:#1E40AF">Step ${i+1}: ${p.title}</h3>
<p><b>Owner:</b> ${actor?.emoji} ${actor?.name}</p><p><i>${p.description}</i></p>
<ol>${p.steps.map(s=>`<li>${s}</li>`).join("")}</ol>
<p><b>Output:</b> ${p.output}</p>${p.note?`<p><b>Note:</b> ${p.note}</p>`:""}<hr/>`}).join("")}
<h2>Key Insights</h2><ul>${(data.keyInsights||[]).map(i=>`<li>${i}</li>`).join("")}</ul>`;
  const full=`<html xmlns:o='urn:schemas-microsoft-com:office:office' xmlns:w='urn:schemas-microsoft-com:office:word' xmlns='http://www.w3.org/TR/REC-html40'><head><meta charset='utf-8'><title>${data.title}</title><style>body{font-family:Calibri,sans-serif;font-size:11pt;margin:2cm}</style></head><body>${body}</body></html>`;
  const b=new Blob(['\ufeff',full],{type:"application/msword"});const u=URL.createObjectURL(b);
  const a=document.createElement("a");a.href=u;a.download=`${data.title.replace(/\s+/g,"_")}.doc`;a.click();URL.revokeObjectURL(u);
}

function doExportPDF(data) {
  const phases=data.phases||[];const actors=data.actors||[];
  const html=`<!DOCTYPE html><html><head><meta charset="UTF-8"/><title>${data.title}</title>
<style>@page{margin:2cm;size:A4}body{font-family:'Segoe UI',sans-serif;font-size:10.5pt;color:#1E293B;line-height:1.6}
h1{font-size:20pt;color:#1E40AF;margin-bottom:6px}.phase{border:1px solid #E2E8F0;border-radius:8px;padding:14px;margin-bottom:8px;page-break-inside:avoid}
.footer{text-align:center;font-size:8pt;color:#94A3B8;margin-top:20px;letter-spacing:2px}
.print-btn{position:fixed;top:16px;right:16px;background:#1E40AF;color:white;border:none;border-radius:6px;padding:10px 20px;cursor:pointer}
@media print{.print-btn{display:none}}</style></head><body>
<button class="print-btn" onclick="window.print()">Save PDF</button>
<h1>${data.title}</h1><p style="color:#64748B;font-style:italic;margin-bottom:16px">${data.summary}</p>
${phases.map((p,idx)=>{const actor=actors.find(a=>a.id===p.actorId);return`
<div class="phase"><b>${p.icon} Step ${idx+1}: ${p.title}</b> <span style="color:#64748B;font-size:9pt">— ${actor?.name}</span><br/>
<i style="color:#64748B;font-size:9pt">${p.description}</i><br/>
${p.steps.map((s,i)=>`${i+1}. ${s}`).join(" · ")}<br/>
<span style="color:#1E40AF">→ ${p.output}</span>
${p.note?`<br/><span style="color:#92400E">⚠ ${p.note}</span>`:""}</div>
${idx<phases.length-1?`<div style="text-align:center;color:#CBD5E1;margin:4px 0">↓</div>`:""}`}).join("")}
<div style="margin-top:16px;border:1px solid #E2E8F0;border-radius:8px;padding:14px">
<b style="font-size:9pt;color:#64748B;letter-spacing:2px;text-transform:uppercase">Key Insights</b><br/>
${(data.keyInsights||[]).map(i=>`<div style="font-size:9.5pt;color:#374151;margin-top:6px;padding-left:12px;border-left:2px solid #CBD5E1">${i}</div>`).join("")}</div>
<div class="footer">FLOWSCRIBE AI</div></body></html>`;
  const w=window.open('','_blank');w.document.write(html);w.document.close();
}

function doExportPPT(data) {
  const phases=data.phases||[];const actors=data.actors||[];
  const slides=[
    `<div class="slide" style="background:linear-gradient(135deg,#0A0E1A 0%,#0F1629 100%);display:flex;flex-direction:column;align-items:center;justify-content:center;text-align:center;padding:60px">
      <div style="font-size:10pt;letter-spacing:4px;color:#00E5FF;text-transform:uppercase;margin-bottom:16px;font-family:monospace">AI · Flowchart · Intelligence</div>
      <h1 style="font-size:30pt;font-weight:700;color:#F8FAFC;letter-spacing:-1px;margin-bottom:14px;max-width:700px;line-height:1.15">${data.title}</h1>
      <p style="font-size:13pt;color:#94A3B8;max-width:560px;line-height:1.6">${data.summary}</p>
      <div style="display:flex;gap:10px;flex-wrap:wrap;justify-content:center;margin-top:28px">
        ${actors.map(a=>`<div style="padding:6px 16px;border:1px solid #00E5FF44;border-radius:4px;font-size:11pt;color:#00E5FF;background:#00E5FF0A">${a.emoji} ${a.name}</div>`).join("")}
      </div></div>`,
    ...phases.map((p,idx)=>{const actor=actors.find(a=>a.id===p.actorId);return`
    <div class="slide" style="background:#0A0E1A;padding:44px 52px;display:flex;flex-direction:column">
      <div style="display:flex;align-items:center;gap:14px;margin-bottom:24px;padding-bottom:16px;border-bottom:1px solid #1E293B">
        <span style="font-size:26px">${p.icon}</span>
        <div><div style="font-size:16pt;font-weight:700;color:#F8FAFC">${p.title}</div>
        <div style="font-size:10pt;color:#00E5FF;margin-top:2px;font-family:monospace">${actor?.emoji} ${actor?.name} · STEP ${String(idx+1).padStart(2,"0")}</div></div></div>
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:28px;flex:1">
        <div><div style="font-size:8pt;letter-spacing:2px;color:#00E5FF;text-transform:uppercase;margin-bottom:12px;font-family:monospace">Process Steps</div>
        ${p.steps.map((s,i)=>`<div style="display:flex;gap:10px;margin-bottom:9px"><span style="color:#00E5FF;font-size:10pt;min-width:20px;font-family:monospace">${i+1}.</span><span style="font-size:10pt;color:#CBD5E1;line-height:1.5">${s}</span></div>`).join("")}</div>
        <div><div style="font-size:8pt;letter-spacing:2px;color:#00E5FF;text-transform:uppercase;margin-bottom:12px;font-family:monospace">Output</div>
        <div style="background:#00E5FF0A;border:1px solid #00E5FF33;border-radius:6px;padding:14px;font-size:10pt;color:#E2E8F0;line-height:1.5">→ ${p.output}</div>
        ${p.note?`<div style="margin-top:10px;font-size:9pt;color:#FCD34D;padding:10px;background:#F59E0B0A;border:1px solid #F59E0B33;border-radius:6px">⚠ ${p.note}</div>`:""}</div>
      </div></div>`}).join(""),
    `<div class="slide" style="background:#0A0E1A;padding:44px 52px">
    <div style="font-size:8pt;letter-spacing:3px;color:#00E5FF;text-transform:uppercase;margin-bottom:24px;font-family:monospace">Key Insights</div>
    ${(data.keyInsights||[]).map((ins,i)=>`<div style="display:flex;gap:14px;margin-bottom:16px;padding-bottom:16px;border-bottom:1px solid #1E293B">
    <span style="font-size:10pt;color:#00E5FF44;min-width:24px;font-family:monospace">${i+1<10?"0"+(i+1):i+1}</span>
    <span style="font-size:11pt;color:#CBD5E1;line-height:1.6">${ins}</span></div>`).join("")}</div>`
  ];
  const full=`<!DOCTYPE html><html><head><meta charset="UTF-8"/><title>${data.title}</title>
<style>*{box-sizing:border-box;margin:0;padding:0}body{background:#000;font-family:'Segoe UI',sans-serif;padding:20px}
.slide{width:960px;min-height:540px;border-radius:8px;margin:0 auto 20px;overflow:hidden;box-shadow:0 0 40px rgba(0,229,255,0.1)}
@media print{body{background:black;padding:0}.slide{margin:0;page-break-after:always;border-radius:0}}</style>
</head><body>${slides.join("")}</body></html>`;
  const b=new Blob([full],{type:"text/html"});const u=URL.createObjectURL(b);
  const a=document.createElement("a");a.href=u;a.download=`${data.title.replace(/\s+/g,"_")}_slides.html`;a.click();URL.revokeObjectURL(u);
}

// ── GLOBAL STYLES ─────────────────────────────────────────────────────────────
const GCSS = `
  @import url('https://fonts.googleapis.com/css2?family=Space+Mono:wght@400;700&family=Outfit:wght@300;400;500;600;700;800&display=swap');

  *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }

  :root {
    --bg:      #080C18;
    --bg2:     #0D1225;
    --bg3:     #111827;
    --panel:   #0F1629;
    --border:  #1E2D45;
    --border2: #243352;
    --cyan:    #00E5FF;
    --cyan2:   #00B8D9;
    --glow:    rgba(0,229,255,0.15);
    --text:    #E2E8F0;
    --text2:   #94A3B8;
    --text3:   #475569;
    --green:   #10B981;
    --amber:   #F59E0B;
    --red:     #EF4444;
  }

  body {
    background: var(--bg);
    font-family: 'Outfit', sans-serif;
    color: var(--text);
    -webkit-font-smoothing: antialiased;
    min-height: 100vh;
  }

  /* Scrollbar */
  ::-webkit-scrollbar { width: 6px; }
  ::-webkit-scrollbar-track { background: var(--bg); }
  ::-webkit-scrollbar-thumb { background: var(--border2); border-radius: 3px; }

  /* ── NAV ── */
  .nav {
    height: 60px;
    display: flex; align-items: center; justify-content: space-between;
    padding: 0 28px;
    border-bottom: 1px solid var(--border);
    background: rgba(8,12,24,0.95);
    backdrop-filter: blur(20px);
    position: sticky; top: 0; z-index: 100;
  }
  .nav-logo {
    display: flex; align-items: center; gap: 10px;
    font-family: 'Space Mono', monospace;
    font-size: 15px;
    font-weight: 700;
    color: var(--cyan);
    letter-spacing: 1px;
  }
  .logo-icon {
    width: 32px; height: 32px;
    border: 1.5px solid var(--cyan);
    border-radius: 6px;
    display: flex; align-items: center; justify-content: center;
    font-size: 16px;
    box-shadow: 0 0 12px var(--glow);
    position: relative;
    overflow: hidden;
  }
  .logo-icon::after {
    content: '';
    position: absolute; inset: 0;
    background: linear-gradient(135deg, var(--glow) 0%, transparent 60%);
  }
  .nav-tag {
    font-family: 'Space Mono', monospace;
    font-size: 10px;
    color: var(--cyan);
    border: 1px solid var(--cyan);
    padding: 3px 10px;
    border-radius: 3px;
    letter-spacing: 1.5px;
    background: var(--glow);
  }

  /* ── BUTTONS ── */
  .btn {
    font-family: 'Outfit', sans-serif;
    font-size: 13px;
    font-weight: 600;
    border-radius: 6px;
    padding: 9px 22px;
    cursor: pointer;
    border: 1px solid transparent;
    transition: all 0.2s;
    letter-spacing: 0.3px;
  }
  .btn-primary {
    background: var(--cyan);
    color: var(--bg);
    border-color: var(--cyan);
    font-weight: 700;
    box-shadow: 0 0 20px rgba(0,229,255,0.25);
  }
  .btn-primary:hover {
    background: #33EEFF;
    box-shadow: 0 0 30px rgba(0,229,255,0.4);
    transform: translateY(-1px);
  }
  .btn-primary:disabled { background: var(--text3); border-color: var(--text3); box-shadow: none; cursor: not-allowed; transform: none; color: var(--bg2); }
  .btn-ghost {
    background: transparent;
    color: var(--text2);
    border-color: var(--border2);
  }
  .btn-ghost:hover { border-color: var(--cyan); color: var(--cyan); background: var(--glow); }

  /* ── INPUT ── */
  .input {
    font-family: 'Outfit', sans-serif;
    font-size: 14px;
    color: var(--text);
    background: var(--bg2);
    border: 1px solid var(--border2);
    border-radius: 6px;
    padding: 11px 14px;
    width: 100%;
    outline: none;
    transition: all 0.2s;
  }
  .input:focus {
    border-color: var(--cyan);
    box-shadow: 0 0 0 3px var(--glow);
  }
  .input::placeholder { color: var(--text3); }

  /* ── PANEL ── */
  .panel {
    background: var(--panel);
    border: 1px solid var(--border);
    border-radius: 10px;
    position: relative;
    overflow: hidden;
  }
  .panel::before {
    content: '';
    position: absolute; top: 0; left: 0; right: 0; height: 1px;
    background: linear-gradient(90deg, transparent, var(--cyan), transparent);
    opacity: 0.4;
  }

  /* ── PHASE CARD ── */
  .phase-card {
    background: var(--panel);
    border: 1px solid var(--border);
    border-radius: 8px;
    cursor: pointer;
    transition: all 0.2s;
    position: relative;
    overflow: hidden;
  }
  .phase-card:hover { border-color: var(--cyan); box-shadow: 0 0 20px rgba(0,229,255,0.08); }
  .phase-card.open {
    border-color: var(--cyan);
    border-radius: 8px 8px 0 0;
    border-bottom-color: transparent;
    box-shadow: 0 0 24px rgba(0,229,255,0.1);
  }
  .phase-body {
    background: var(--bg2);
    border: 1px solid var(--cyan);
    border-top: none;
    border-radius: 0 0 8px 8px;
    padding: 20px 22px 24px;
  }

  /* ── LABEL ── */
  .label {
    font-family: 'Space Mono', monospace;
    font-size: 10px;
    color: var(--cyan);
    letter-spacing: 2px;
    text-transform: uppercase;
    margin-bottom: 10px;
  }

  /* ── EXPORT BTN ── */
  .exp-btn {
    font-family: 'Outfit', sans-serif;
    font-size: 12px;
    font-weight: 600;
    border-radius: 5px;
    padding: 7px 14px;
    cursor: pointer;
    border: 1px solid var(--border2);
    background: var(--panel);
    color: var(--text2);
    transition: all 0.2s;
    display: flex; align-items: center; gap: 5px;
    letter-spacing: 0.3px;
  }
  .exp-btn:hover { border-color: var(--cyan); color: var(--cyan); background: var(--glow); box-shadow: 0 0 12px rgba(0,229,255,0.1); }

  /* ── CONNECTOR ── */
  .connector {
    display: flex; flex-direction: column; align-items: center;
    height: 28px; gap: 0;
  }
  .connector-line { width: 1px; flex: 1; background: linear-gradient(180deg, var(--cyan), transparent); opacity: 0.4; }
  .connector-arrow { font-size: 12px; color: var(--cyan); opacity: 0.5; line-height: 1; }

  /* ── GRID LINES BG ── */
  .grid-bg {
    background-image:
      linear-gradient(rgba(0,229,255,0.03) 1px, transparent 1px),
      linear-gradient(90deg, rgba(0,229,255,0.03) 1px, transparent 1px);
    background-size: 40px 40px;
  }

  /* ── SCAN LINE ANIMATION ── */
  .scanline {
    position: fixed; top: 0; left: 0; right: 0; bottom: 0;
    background: repeating-linear-gradient(0deg, transparent, transparent 2px, rgba(0,229,255,0.01) 2px, rgba(0,229,255,0.01) 4px);
    pointer-events: none; z-index: 0;
  }

  /* ── CORNER DECORATION ── */
  .corner-tl, .corner-tr, .corner-bl, .corner-br {
    position: absolute; width: 12px; height: 12px;
    border-color: var(--cyan); border-style: solid; opacity: 0.5;
  }
  .corner-tl { top: 0; left: 0; border-width: 1.5px 0 0 1.5px; border-radius: 3px 0 0 0; }
  .corner-tr { top: 0; right: 0; border-width: 1.5px 1.5px 0 0; border-radius: 0 3px 0 0; }
  .corner-bl { bottom: 0; left: 0; border-width: 0 0 1.5px 1.5px; border-radius: 0 0 0 3px; }
  .corner-br { bottom: 0; right: 0; border-width: 0 1.5px 1.5px 0; border-radius: 0 0 3px 0; }

  /* ── BADGE ── */
  .badge {
    font-family: 'Space Mono', monospace;
    font-size: 10px;
    letter-spacing: 1px;
    padding: 3px 10px;
    border-radius: 3px;
    border: 1px solid;
  }

  /* ── FLOW DIAGRAM (hero visual) ── */
  .flow-vis {
    display: flex; align-items: center; gap: 8px;
    padding: 14px 18px;
    background: var(--bg2);
    border: 1px solid var(--border);
    border-radius: 8px;
    overflow: hidden;
  }
  .flow-node {
    padding: 6px 12px;
    border-radius: 4px;
    font-family: 'Space Mono', monospace;
    font-size: 10px;
    letter-spacing: 0.5px;
    white-space: nowrap;
    flex-shrink: 0;
  }
  .flow-arrow { color: var(--cyan); opacity: 0.6; font-size: 14px; flex-shrink: 0; }

  /* ── ANIMATIONS ── */
  @keyframes fadeUp { from{opacity:0;transform:translateY(16px)} to{opacity:1;transform:translateY(0)} }
  @keyframes blink { 0%,100%{opacity:1} 50%{opacity:0} }
  @keyframes pulse { 0%,100%{opacity:1} 50%{opacity:0.3} }
  @keyframes glowPulse { 0%,100%{box-shadow:0 0 12px var(--glow)} 50%{box-shadow:0 0 28px rgba(0,229,255,0.3)} }
  @keyframes scanMove { from{transform:translateY(-100%)} to{transform:translateY(100vh)} }
  @keyframes spin { from{transform:rotate(0deg)} to{transform:rotate(360deg)} }
  @keyframes typeIn { from{width:0} to{width:100%} }
  @keyframes flowPulse { 0%,100%{opacity:0.5;transform:scaleX(1)} 50%{opacity:1;transform:scaleX(1.02)} }

  .fade-up { animation: fadeUp 0.45s ease both; }
  .fade-up-1 { animation: fadeUp 0.45s 0.06s ease both; }
  .fade-up-2 { animation: fadeUp 0.45s 0.12s ease both; }
  .fade-up-3 { animation: fadeUp 0.45s 0.18s ease both; }
  .fade-up-4 { animation: fadeUp 0.45s 0.24s ease both; }
  .fade-up-5 { animation: fadeUp 0.45s 0.30s ease both; }
`;

// ── ANIMATED FLOW DIAGRAM ─────────────────────────────────────────────────────
function FlowDiagramVis() {
  const [step, setStep] = useState(0);
  useEffect(() => {
    const t = setInterval(() => setStep(s => (s + 1) % 4), 1200);
    return () => clearInterval(t);
  }, []);
  const nodes = [
    { label: "TRANSCRIPT", color: "#00E5FF" },
    { label: "AI ANALYSIS", color: "#7C3AED" },
    { label: "FLOWCHART", color: "#10B981" },
    { label: "EXPORT", color: "#F59E0B" },
  ];
  return (
    <div className="flow-vis">
      {nodes.map((n, i) => (
        <div key={i} style={{ display: "flex", alignItems: "center", gap: "8px" }}>
          <div className="flow-node" style={{
            border: `1px solid ${n.color}${step >= i ? "99" : "33"}`,
            color: step >= i ? n.color : "#475569",
            background: step >= i ? `${n.color}11` : "transparent",
            transition: "all 0.4s",
            boxShadow: step >= i ? `0 0 12px ${n.color}22` : "none",
          }}>{n.label}</div>
          {i < nodes.length - 1 && (
            <div className="flow-arrow" style={{ opacity: step > i ? 0.9 : 0.2, transition: "opacity 0.4s" }}>→</div>
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
        method: "POST",
        headers: { "Content-Type":"application/json","x-api-key":key,"anthropic-version":"2023-06-01","anthropic-dangerous-direct-browser-access":"true" },
        body: JSON.stringify({ model:"claude-haiku-4-5-20251001", max_tokens:10, messages:[{role:"user",content:"hi"}] })
      });
      if (!r.ok) { const e=await r.json(); throw new Error(e?.error?.message||"Invalid key"); }
      onSave(key);
    } catch(e) { setError(e.message||"Could not verify."); } finally { setTesting(false); }
  };

  return (
    <div style={{ minHeight:"100vh", background:"var(--bg)" }} className="grid-bg">
      <style>{GCSS}</style>
      <div className="scanline"/>

      <nav className="nav">
        <div className="nav-logo">
          <div className="logo-icon">⬡</div>
          FLOWSCRIBE
        </div>
        <div className="nav-tag">AI POWERED</div>
      </nav>

      <div style={{ maxWidth:"480px", margin:"0 auto", padding:"60px 24px" }}>

        {/* Hero text */}
        <div className="fade-up" style={{ marginBottom:"40px" }}>
          <div style={{ fontFamily:"'Space Mono',monospace", fontSize:"11px", color:"var(--cyan)", letterSpacing:"3px", marginBottom:"16px", opacity:0.8 }}>
            TRANSCRIPT → FLOWCHART ENGINE
          </div>
          <h1 style={{ fontFamily:"'Outfit',sans-serif", fontSize:"clamp(28px,4vw,40px)", fontWeight:800, lineHeight:1.1, letterSpacing:"-0.5px", marginBottom:"14px", color:"var(--text)" }}>
            Transform documents<br/>
            <span style={{ color:"var(--cyan)", textShadow:"0 0 30px rgba(0,229,255,0.4)" }}>into visual flowcharts</span>
          </h1>
          <p style={{ fontSize:"15px", color:"var(--text2)", lineHeight:1.7, marginBottom:"20px" }}>
            Paste any meeting transcript, SOP, or document. Our AI extracts the process, maps the actors, and builds an interactive flowchart — ready to export in seconds.
          </p>
          <FlowDiagramVis/>
        </div>

        {/* Key card */}
        <div className="panel fade-up-1" style={{ padding:"24px" }}>
          <div className="corner-tl"/><div className="corner-tr"/><div className="corner-bl"/><div className="corner-br"/>
          <div className="label" style={{ marginBottom:"14px" }}>// API KEY REQUIRED</div>
          <div style={{ display:"flex", gap:"8px", marginBottom:"12px" }}>
            <input className="input" type={show?"text":"password"} value={key}
              onChange={e=>{setKey(e.target.value);setError("");}}
              placeholder="sk-ant-api03-…"
              onKeyDown={e=>e.key==="Enter"&&handleSave()}
              style={{ flex:1, fontFamily:"'Space Mono',monospace", fontSize:"13px" }}
            />
            <button className="btn btn-ghost" onClick={()=>setShow(!show)} style={{padding:"9px 12px",flexShrink:0,fontSize:"12px"}}>{show?"HIDE":"SHOW"}</button>
          </div>
          {error && <div style={{fontSize:"13px",color:"var(--red)",marginBottom:"12px",padding:"8px 12px",background:"rgba(239,68,68,0.1)",borderRadius:"6px",border:"1px solid rgba(239,68,68,0.3)",fontFamily:"'Space Mono',monospace",fontSize:"12px"}}>⚠ {error}</div>}
          <button className="btn btn-primary" onClick={handleSave} disabled={!key||testing} style={{width:"100%",fontSize:"14px",letterSpacing:"1px"}}>
            {testing ? "VERIFYING..." : "INITIALIZE →"}
          </button>

          <div style={{marginTop:"20px",paddingTop:"20px",borderTop:"1px solid var(--border)"}}>
            <div className="label" style={{marginBottom:"12px"}}>// GET YOUR KEY</div>
            {[["01","Visit console.anthropic.com"],["02","Create account or sign in"],["03","API Keys → Create New Key"],["04","Paste above and initialize"]].map(([n,t])=>(
              <div key={n} style={{display:"flex",gap:"14px",marginBottom:"9px",alignItems:"flex-start"}}>
                <span style={{fontFamily:"'Space Mono',monospace",fontSize:"10px",color:"var(--cyan)",opacity:0.5,minWidth:"22px",paddingTop:"2px"}}>{n}</span>
                <span style={{fontSize:"13px",color:"var(--text2)"}}>{t}</span>
              </div>
            ))}
            <div style={{marginTop:"14px",fontSize:"12px",color:"var(--green)",fontFamily:"'Space Mono',monospace",display:"flex",alignItems:"center",gap:"8px"}}>
              <span style={{animation:"pulse 2s infinite",display:"inline-block",width:"6px",height:"6px",borderRadius:"50%",background:"var(--green)"}}/>
              ~$0.001 per analysis
            </div>
          </div>
        </div>

        <p style={{textAlign:"center",fontSize:"11px",color:"var(--text3)",marginTop:"16px",fontFamily:"'Space Mono',monospace",letterSpacing:"0.5px"}}>
          KEY STORED IN SESSION ONLY · NO DATA RETAINED
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
    {type:"html",label:"HTML",fn:doExportHTML},
    {type:"word",label:"WORD",fn:doExportWord},
    {type:"pdf", label:"PDF", fn:doExportPDF},
    {type:"ppt", label:"SLIDES",fn:doExportPPT},
  ];
  return (
    <div style={{display:"flex",gap:"6px",flexWrap:"wrap"}}>
      {exports.map(({type,label,fn})=>(
        <button key={type} className="exp-btn" onClick={()=>go(type,fn)} disabled={!!busy}>
          {busy===type?"...":"↗"} {label}
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
      <div style={{ paddingTop:"48px", paddingBottom:"32px", borderBottom:"1px solid var(--border)", marginBottom:"32px" }}>
        <div style={{ fontFamily:"'Space Mono',monospace", fontSize:"10px", color:"var(--cyan)", letterSpacing:"3px", marginBottom:"14px", opacity:0.8 }}>
          // FLOWCHART GENERATED
        </div>
        <h1 className="fade-up" style={{ fontFamily:"'Outfit',sans-serif", fontSize:"clamp(22px,3vw,32px)", fontWeight:800, letterSpacing:"-0.5px", marginBottom:"10px", color:"var(--text)" }}>
          {data.title}
        </h1>
        <p className="fade-up-1" style={{ fontSize:"15px", color:"var(--text2)", lineHeight:1.65, marginBottom:"20px", maxWidth:"580px" }}>
          {data.summary}
        </p>

        {/* Actors */}
        <div className="fade-up-2" style={{ display:"flex", gap:"8px", flexWrap:"wrap", marginBottom:"24px" }}>
          {(data.actors||[]).map((a, i) => (
            <div key={a.id} className="badge" style={{ color:COLORS[i%COLORS.length], borderColor:`${COLORS[i%COLORS.length]}44`, background:`${COLORS[i%COLORS.length]}0D` }}>
              {a.emoji} {a.name}
            </div>
          ))}
        </div>

        <div className="fade-up-3">
          <div className="label" style={{marginBottom:"10px"}}>// EXPORT</div>
          <ExportBar data={data}/>
        </div>
      </div>

      {/* Stats bar */}
      <div className="fade-up-3" style={{ display:"flex", gap:"24px", marginBottom:"32px", paddingBottom:"24px", borderBottom:"1px solid var(--border)" }}>
        {[
          {label:"PHASES", value:data.phases?.length||0},
          {label:"ACTORS", value:data.actors?.length||0},
          {label:"INSIGHTS", value:data.keyInsights?.length||0},
          {label:"DECISIONS", value:data.phases?.filter(p=>p.isDecision).length||0},
        ].map(({label,value})=>(
          <div key={label}>
            <div style={{fontFamily:"'Space Mono',monospace",fontSize:"22px",fontWeight:700,color:"var(--cyan)"}}>{String(value).padStart(2,"0")}</div>
            <div style={{fontFamily:"'Space Mono',monospace",fontSize:"9px",color:"var(--text3)",letterSpacing:"1.5px",marginTop:"2px"}}>{label}</div>
          </div>
        ))}
      </div>

      {/* Phases */}
      <div className="label" style={{marginBottom:"16px"}}>// PROCESS FLOW</div>
      <div>
        {(data.phases||[]).map((phase, index) => {
          const actor = ga(phase.actorId);
          const color = gc(phase.actorId);
          const isOpen = active === phase.id;
          return (
            <div key={phase.id} className={`fade-up`} style={{ animationDelay:`${index*0.05}s` }}>
              <div className={`phase-card${isOpen?" open":""}`} onClick={()=>setActive(isOpen?null:phase.id)}
                style={{ borderColor: isOpen ? color : "var(--border)" }}>
                {isOpen && <div style={{position:"absolute",top:0,left:0,right:0,height:"1px",background:`linear-gradient(90deg,transparent,${color},transparent)`}}/>}
                <div style={{ padding:"15px 18px", display:"flex", alignItems:"center", gap:"14px" }}>
                  <div style={{ width:"36px",height:"36px",borderRadius:"6px",border:`1px solid ${color}44`,background:`${color}0D`,display:"flex",alignItems:"center",justifyContent:"center",fontSize:"18px",flexShrink:0 }}>{phase.icon}</div>
                  <div style={{ flex:1, minWidth:0 }}>
                    <div style={{ fontSize:"14px", fontWeight:600, color:"var(--text)", marginBottom:"3px" }}>{phase.title}</div>
                    <div style={{ fontFamily:"'Space Mono',monospace", fontSize:"10px", color, letterSpacing:"0.5px" }}>{actor?.emoji} {actor?.name}</div>
                  </div>
                  <div style={{ fontFamily:"'Space Mono',monospace", fontSize:"11px", color:"var(--text3)", flexShrink:0 }}>
                    {String(index+1).padStart(2,"0")}
                  </div>
                  <div style={{ width:"20px",height:"20px",border:`1px solid ${isOpen?color:"var(--border2)"}`,borderRadius:"4px",display:"flex",alignItems:"center",justifyContent:"center",fontSize:"14px",color:isOpen?color:"var(--text3)",transition:"all 0.2s",background:isOpen?`${color}11`:"transparent" }}>
                    {isOpen?"−":"+"}
                  </div>
                </div>
              </div>

              {isOpen && (
                <div className="phase-body" style={{borderColor:color}}>
                  <p style={{ fontSize:"13px",color:"var(--text2)",lineHeight:1.65,marginBottom:"20px",padding:"10px 14px",background:`${color}08`,borderLeft:`2px solid ${color}55`,borderRadius:"0 6px 6px 0" }}>
                    {phase.description}
                  </p>
                  <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:"24px" }}>
                    <div>
                      <div className="label">// STEPS</div>
                      {phase.steps.map((step,i)=>(
                        <div key={i} style={{ display:"flex",gap:"12px",marginBottom:"10px",alignItems:"flex-start" }}>
                          <span style={{ fontFamily:"'Space Mono',monospace",fontSize:"10px",color,opacity:0.7,minWidth:"22px",paddingTop:"3px",flexShrink:0 }}>{String(i+1).padStart(2,"0")}</span>
                          <span style={{ fontSize:"13px",color:"var(--text2)",lineHeight:1.55 }}>{step}</span>
                        </div>
                      ))}
                      {phase.isDecision && (
                        <div style={{ marginTop:"14px",padding:"12px 14px",background:"rgba(245,158,11,0.08)",border:"1px solid rgba(245,158,11,0.3)",borderRadius:"6px",fontSize:"12px" }}>
                          <div style={{ fontFamily:"'Space Mono',monospace",fontWeight:700,color:"#F59E0B",marginBottom:"7px",fontSize:"11px" }}>◆ DECISION POINT</div>
                          <div style={{ color:"var(--text2)",marginBottom:"4px" }}>{phase.decisionQuestion}</div>
                          <div style={{ color:"var(--green)",marginBottom:"3px",fontSize:"12px" }}>→ YES: {phase.decisionYes}</div>
                          <div style={{ color:"var(--red)",fontSize:"12px" }}>→ NO: {phase.decisionNo}</div>
                        </div>
                      )}
                    </div>
                    <div>
                      <div className="label">// OUTPUT</div>
                      <div style={{ padding:"12px 14px",background:`${color}0D`,border:`1px solid ${color}33`,borderRadius:"6px",fontSize:"13px",color:"var(--text)",lineHeight:1.55,marginBottom:"12px" }}>
                        → {phase.output}
                      </div>
                      {phase.note && (
                        <div style={{ padding:"10px 12px",background:"rgba(245,158,11,0.08)",border:"1px solid rgba(245,158,11,0.3)",borderRadius:"6px",fontSize:"12px",color:"#FCD34D",lineHeight:1.5 }}>
                          ⚠ {phase.note}
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              )}

              {index < data.phases.length-1 && (
                <div className="connector">
                  <div className="connector-line" style={{background:`linear-gradient(180deg,${color}66,${gc(data.phases[index+1].actorId)}66)`}}/>
                  <div className="connector-arrow">▼</div>
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Insights */}
      {data.keyInsights?.length > 0 && (
        <div className="panel" style={{ padding:"22px 24px", marginTop:"32px" }}>
          <div className="label">// KEY INSIGHTS</div>
          {data.keyInsights.map((ins,i)=>(
            <div key={i} style={{ fontSize:"13px",color:"var(--text2)",marginBottom:"12px",paddingLeft:"14px",borderLeft:`2px solid ${COLORS[i%COLORS.length]}44`,lineHeight:1.65,padding:"8px 14px",background:`${COLORS[i%COLORS.length]}06`,borderRadius:"0 6px 6px 0" }}>
              {ins}
            </div>
          ))}
        </div>
      )}

      <div style={{ marginTop:"36px",paddingTop:"24px",borderTop:"1px solid var(--border)" }}>
        <div className="label" style={{marginBottom:"12px"}}>// EXPORT DOCUMENT</div>
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
    setFileName(name); setStage("processing"); setProgress("Reading document...");
    try {
      setProgress("AI analyzing structure...");
      const result = await analyzeTranscript(text, apiKey);
      setProgress("Rendering flowchart...");
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
    <div style={{ minHeight:"100vh", background:"var(--bg)" }} className="grid-bg">
      <style>{GCSS}</style>
      <div className="scanline"/>

      <nav className="nav">
        <div className="nav-logo">
          <div className="logo-icon">⬡</div>
          FLOWSCRIBE
        </div>
        <div style={{ display:"flex", alignItems:"center", gap:"10px" }}>
          {stage==="result" && <button className="btn btn-ghost" onClick={reset} style={{padding:"7px 14px",fontSize:"12px",letterSpacing:"0.5px"}}>← NEW</button>}
          <button onClick={()=>setApiKey("")} className="btn btn-ghost" style={{padding:"7px 14px",fontSize:"12px",letterSpacing:"0.5px"}}>API KEY</button>
          <div className="nav-tag">ONLINE</div>
        </div>
      </nav>

      {/* Upload */}
      {stage==="upload" && (
        <div style={{ maxWidth:"640px", margin:"0 auto", padding:"56px 24px" }}>

          {/* Hero */}
          <div className="fade-up" style={{ marginBottom:"44px" }}>
            <div style={{ fontFamily:"'Space Mono',monospace", fontSize:"11px", color:"var(--cyan)", letterSpacing:"3px", marginBottom:"16px", opacity:0.8 }}>
              TRANSCRIPT → FLOWCHART ENGINE
            </div>
            <h1 style={{ fontFamily:"'Outfit',sans-serif", fontSize:"clamp(28px,4vw,44px)", fontWeight:800, lineHeight:1.08, letterSpacing:"-1px", marginBottom:"14px", color:"var(--text)" }}>
              Turn meetings &amp; docs<br/>
              <span style={{ color:"var(--cyan)", textShadow:"0 0 40px rgba(0,229,255,0.35)" }}>into smart flowcharts</span>
            </h1>
            <p style={{ fontSize:"15px", color:"var(--text2)", lineHeight:1.7, maxWidth:"500px", marginBottom:"20px" }}>
              Upload any transcript, SOP, or process document. The AI reads it, maps every actor, step, and decision — then builds an interactive flowchart you can export instantly.
            </p>
            <FlowDiagramVis/>
          </div>

          {/* Drop zone */}
          <div className="fade-up-1" style={{ position:"relative", marginBottom:"14px" }}>
            <div
              onDragOver={e=>{e.preventDefault();setDragOver(true);}}
              onDragLeave={()=>setDragOver(false)}
              onDrop={handleDrop}
              onClick={()=>fileRef.current?.click()}
              style={{
                border:`1px dashed ${dragOver?"var(--cyan)":"var(--border2)"}`,
                borderRadius:"10px", padding:"44px 32px", textAlign:"center", cursor:"pointer",
                background: dragOver ? "rgba(0,229,255,0.05)" : "var(--panel)",
                transition:"all 0.2s",
                boxShadow: dragOver ? "0 0 30px rgba(0,229,255,0.1), inset 0 0 30px rgba(0,229,255,0.03)" : "none",
                position:"relative", overflow:"hidden",
              }}
            >
              {dragOver && <div style={{position:"absolute",top:0,left:0,right:0,height:"1px",background:"linear-gradient(90deg,transparent,var(--cyan),transparent)"}}/>}
              <div style={{ fontSize:"32px", marginBottom:"12px", opacity: dragOver ? 1 : 0.5 }}>⬆</div>
              <div style={{ fontFamily:"'Outfit',sans-serif", fontSize:"16px", fontWeight:600, color:"var(--text)", marginBottom:"5px" }}>
                Drop your document here
              </div>
              <div style={{ fontSize:"13px", color:"var(--text3)", marginBottom:"16px" }}>or click to browse files</div>
              <div style={{ display:"flex", gap:"6px", justifyContent:"center", flexWrap:"wrap" }}>
                {[".TXT",".MD",".CSV",".DOCX",".PDF"].map(e=>(
                  <span key={e} className="badge" style={{color:"var(--cyan)",borderColor:"var(--border2)",background:"transparent",fontSize:"10px"}}>{e}</span>
                ))}
              </div>
            </div>
          </div>
          <input ref={fileRef} type="file" accept=".txt,.md,.csv,.pdf,.docx,.doc" onChange={handleFile} style={{display:"none"}}/>

          <div className="fade-up-2" style={{ display:"flex", alignItems:"center", gap:"14px", margin:"18px 0" }}>
            <div style={{flex:1,height:"1px",background:"var(--border)"}}/>
            <span style={{fontFamily:"'Space Mono',monospace",fontSize:"10px",color:"var(--text3)",letterSpacing:"2px"}}>OR</span>
            <div style={{flex:1,height:"1px",background:"var(--border)"}}/>
          </div>

          {/* Paste */}
          <div className="panel fade-up-3" style={{ overflow:"hidden", marginBottom:"28px" }}>
            <div onClick={()=>setShowPaste(v=>!v)} style={{padding:"14px 18px",display:"flex",alignItems:"center",justifyContent:"space-between",cursor:"pointer",borderBottom:showPaste?"1px solid var(--border)":"none"}}>
              <div style={{display:"flex",alignItems:"center",gap:"10px"}}>
                <span style={{fontFamily:"'Space Mono',monospace",fontSize:"12px",color:"var(--cyan)"}}>{'>'}_</span>
                <span style={{fontSize:"14px",fontWeight:500,color:"var(--text)"}}>Paste transcript or text</span>
              </div>
              <span style={{color:"var(--text3)",fontFamily:"'Space Mono',monospace",transition:"transform 0.2s",display:"inline-block",transform:showPaste?"rotate(90deg)":"rotate(0)"}}>›</span>
            </div>
            {showPaste && (
              <div style={{padding:"14px 18px 18px"}}>
                <textarea className="input" value={pasteText} onChange={e=>setPasteText(e.target.value)} autoFocus
                  placeholder="// Paste meeting notes, transcript, SOPs, process docs..."
                  style={{minHeight:"140px",resize:"vertical",lineHeight:1.65,fontFamily:"'Space Mono',monospace",fontSize:"12px"}}/>
                <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginTop:"10px"}}>
                  <span style={{fontFamily:"'Space Mono',monospace",fontSize:"10px",color:pasteText.length<50?"var(--text3)":"var(--green)"}}>
                    {pasteText.length<50?`${pasteText.length}/50_MIN`:`${pasteText.length}_CHARS ✓`}
                  </span>
                  <div style={{display:"flex",gap:"8px"}}>
                    <button className="btn btn-ghost" onClick={()=>{setPasteText("");setShowPaste(false);}} style={{padding:"7px 14px",fontSize:"12px",letterSpacing:"0.5px"}}>CLEAR</button>
                    <button className="btn btn-primary" onClick={()=>pasteText.trim().length>=50&&run(pasteText,"Pasted text")} disabled={pasteText.trim().length<50}
                      style={{padding:"7px 20px",fontSize:"12px",letterSpacing:"1px",opacity:pasteText.trim().length>=50?1:0.4}}>ANALYZE →</button>
                  </div>
                </div>
              </div>
            )}
          </div>

          <div className="fade-up-4" style={{display:"flex",gap:"6px",flexWrap:"wrap"}}>
            {["AI ANALYSIS","WORD EXPORT","PDF","POWERPOINT","HTML"].map(l=>(
              <div key={l} className="badge" style={{color:"var(--text3)",borderColor:"var(--border)",fontSize:"10px",letterSpacing:"1px"}}>{l}</div>
            ))}
          </div>
        </div>
      )}

      {/* Processing */}
      {stage==="processing" && (
        <div style={{maxWidth:"440px",margin:"80px auto",textAlign:"center",padding:"0 24px"}}>
          <div className="panel" style={{padding:"40px",display:"inline-block",width:"100%"}}>
            <div className="corner-tl"/><div className="corner-tr"/><div className="corner-bl"/><div className="corner-br"/>
            <div style={{width:"56px",height:"56px",border:"2px solid var(--cyan)",borderRadius:"8px",display:"flex",alignItems:"center",justifyContent:"center",fontSize:"24px",margin:"0 auto 20px",animation:"glowPulse 2s infinite",boxShadow:"0 0 24px rgba(0,229,255,0.2)"}}>⬡</div>
            <h2 style={{fontFamily:"'Outfit',sans-serif",fontSize:"20px",fontWeight:700,marginBottom:"8px",color:"var(--text)"}}>Processing Document</h2>
            <p style={{fontFamily:"'Space Mono',monospace",fontSize:"11px",color:"var(--cyan)",marginBottom:"6px",letterSpacing:"1px"}}>{progress}</p>
            <p style={{fontSize:"12px",color:"var(--text3)",marginBottom:"28px",fontFamily:"'Space Mono',monospace"}}>// {fileName}</p>
            <div style={{display:"flex",flexDirection:"column",gap:"8px",textAlign:"left"}}>
              {["READING DOCUMENT","IDENTIFYING ACTORS","EXTRACTING STEPS","DETECTING DECISIONS","RENDERING FLOWCHART"].map((s,i)=>(
                <div key={s} style={{display:"flex",alignItems:"center",gap:"12px",padding:"9px 14px",background:"var(--bg2)",border:"1px solid var(--border)",borderRadius:"5px"}}>
                  <div style={{width:"6px",height:"6px",borderRadius:"50%",background:"var(--cyan)",animation:`pulse ${1+i*0.2}s ease-in-out infinite`,flexShrink:0,boxShadow:"0 0 6px var(--cyan)"}}/>
                  <span style={{fontFamily:"'Space Mono',monospace",fontSize:"10px",color:"var(--text2)",letterSpacing:"0.5px"}}>{s}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Result */}
      {stage==="result" && flowData && <ResultView data={flowData}/>}

      {/* Error */}
      {stage==="error" && (
        <div style={{maxWidth:"400px",margin:"80px auto",textAlign:"center",padding:"0 24px"}}>
          <div className="panel" style={{padding:"32px"}}>
            <div className="corner-tl"/><div className="corner-tr"/><div className="corner-bl"/><div className="corner-br"/>
            <div style={{fontSize:"32px",marginBottom:"16px",color:"var(--red)"}}>✕</div>
            <h2 style={{fontFamily:"'Outfit',sans-serif",fontSize:"20px",fontWeight:700,marginBottom:"10px",color:"var(--text)"}}>Error Occurred</h2>
            <div style={{fontFamily:"'Space Mono',monospace",fontSize:"12px",color:"var(--red)",padding:"10px 14px",background:"rgba(239,68,68,0.08)",border:"1px solid rgba(239,68,68,0.3)",borderRadius:"6px",marginBottom:"24px",lineHeight:1.6}}>{errorMsg}</div>
            <div style={{display:"flex",gap:"8px",justifyContent:"center"}}>
              <button className="btn btn-primary" onClick={reset} style={{letterSpacing:"1px"}}>RETRY</button>
              <button className="btn btn-ghost" onClick={()=>setApiKey("")} style={{letterSpacing:"0.5px"}}>CHANGE KEY</button>
            </div>
          </div>
        </div>
      )}

      <div style={{textAlign:"center",padding:"24px",borderTop:"1px solid var(--border)",marginTop:"20px"}}>
        <span style={{fontFamily:"'Space Mono',monospace",fontSize:"10px",color:"var(--text3)",letterSpacing:"2px"}}>FLOWSCRIBE AI · TRANSCRIPT INTELLIGENCE</span>
      </div>
    </div>
  );
}