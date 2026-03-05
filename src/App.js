import { useState, useRef, useCallback, useEffect } from "react";

const COLORS = ["#6366F1","#8B5CF6","#06B6D4","#10B981","#F59E0B","#EF4444","#EC4899","#3B82F6"];

// ── PERSISTENCE ───────────────────────────────────────────────────────────────
const LS_KEY = "flowscribe_api_key";
const LS_HISTORY = "flowscribe_history";
const saveKey = (k) => { try { localStorage.setItem(LS_KEY, k); } catch {} };
const loadKey = () => { try { return localStorage.getItem(LS_KEY)||""; } catch { return ""; } };
const saveHistory = (h) => { try { localStorage.setItem(LS_HISTORY, JSON.stringify(h)); } catch {} };
const loadHistory = () => { try { const r=localStorage.getItem(LS_HISTORY); return r?JSON.parse(r):[]; } catch { return []; } };

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

// ── EXPORTS ───────────────────────────────────────────────────────────────────
function doExportHTML(data) {
  const gc=(idx)=>COLORS[idx%COLORS.length];
  const html=`<!DOCTYPE html><html><head><meta charset="UTF-8"/><title>${data.title}</title>
<style>*{box-sizing:border-box;margin:0;padding:0}body{background:#F8F9FF;font-family:'Segoe UI',sans-serif;padding:40px 20px}
.w{max-width:780px;margin:0 auto}h1{font-size:26px;font-weight:700;color:#0F172A;text-align:center;margin-bottom:8px}
.sum{text-align:center;color:#64748B;margin-bottom:20px}.acts{display:flex;gap:8px;justify-content:center;flex-wrap:wrap;margin-bottom:28px}
.act{padding:4px 14px;border-radius:20px;font-size:12px;font-weight:600;border:1px solid}
.node{background:#fff;border-radius:12px;padding:18px;margin-bottom:0;border:1px solid #E2E8F0;box-shadow:0 2px 8px rgba(99,102,241,0.08)}
.arrow{text-align:center;font-size:24px;color:#6366F1;margin:4px 0;line-height:1}
.decision{background:#FFFBEB;border:2px solid #FDE68A;border-radius:12px;padding:14px;margin:4px 0}
.grid{display:grid;grid-template-columns:1fr 1fr;gap:14px}
.lbl{font-size:10px;font-weight:700;letter-spacing:1.5px;margin-bottom:8px;color:#94A3B8;text-transform:uppercase}
.step{display:flex;gap:8px;margin-bottom:6px;font-size:13px;color:#475569}
.out{border-radius:8px;padding:10px;font-size:13px}
.footer{text-align:center;margin-top:32px;font-size:11px;color:#94A3B8;letter-spacing:1px}</style></head><body>
<div class="w"><h1>${data.title}</h1><p class="sum">${data.summary}</p>
<div class="acts">${(data.actors||[]).map((a,i)=>`<div class="act" style="color:${gc(i)};border-color:${gc(i)}33;background:${gc(i)}0D">${a.emoji} ${a.name}</div>`).join("")}</div>
${(data.phases||[]).map((p,idx)=>{const c=gc(data.actors?.findIndex(a=>a.id===p.actorId)??0);const actor=data.actors?.find(a=>a.id===p.actorId);return`
${p.isDecision?`<div class="decision"><div style="text-align:center;font-size:13px;font-weight:700;color:#92400E;margin-bottom:8px">◆ DECISION: ${p.decisionQuestion}</div>
<div style="display:flex;gap:12px;justify-content:center"><div style="flex:1;background:#ECFDF5;border-radius:8px;padding:8px;text-align:center;font-size:12px;color:#065F46">✅ YES<br/>${p.decisionYes}</div>
<div style="flex:1;background:#FEF2F2;border-radius:8px;padding:8px;text-align:center;font-size:12px;color:#991B1B">❌ NO<br/>${p.decisionNo}</div></div></div>`
:`<div class="node" style="border-left:4px solid ${c}"><div style="display:flex;align-items:center;gap:12px;margin-bottom:12px">
<div style="width:40px;height:40px;border-radius:10px;background:${c}15;display:flex;align-items:center;justify-content:center;font-size:20px">${p.icon}</div>
<div><div style="font-size:14px;font-weight:700;color:#0F172A">${p.title}</div><div style="font-size:11px;color:${c};font-weight:600">${actor?.emoji} ${actor?.name} · Step ${idx+1}</div></div></div>
<div class="grid"><div><div class="lbl">Steps</div>${p.steps.map((s,i)=>`<div class="step"><span style="min-width:20px;height:20px;border-radius:4px;background:${c}15;color:${c};font-size:9px;font-weight:700;display:flex;align-items:center;justify-content:center;flex-shrink:0">${i+1}</span><span>${s}</span></div>`).join("")}</div>
<div><div class="lbl">Output</div><div class="out" style="background:${c}0D;border:1px solid ${c}22">✓ ${p.output}</div>
${p.note?`<div style="font-size:11px;color:#92400E;padding:8px;background:#FFFBEB;border-radius:6px;margin-top:6px">⚠️ ${p.note}</div>`:""}</div></div></div>`}
${idx<data.phases.length-1?`<div class="arrow">↓</div>`:""}`}).join("")}
<div style="background:#fff;border-radius:12px;padding:20px;margin-top:20px;border:1px solid #E2E8F0">
<div class="lbl">Key Insights</div>
${(data.keyInsights||[]).map((i,idx)=>`<div style="font-size:13px;color:#475569;margin-bottom:8px;padding:8px 14px;background:${COLORS[idx%COLORS.length]}06;border-left:3px solid ${COLORS[idx%COLORS.length]}44;border-radius:0 6px 6px 0;line-height:1.6">${i}</div>`).join("")}</div>
<div class="footer">FLOWSCRIBE AI</div></div></body></html>`;
  const b=new Blob([html],{type:"text/html"});const u=URL.createObjectURL(b);
  const a=document.createElement("a");a.href=u;a.download=`${data.title.replace(/\s+/g,"_")}.html`;a.click();URL.revokeObjectURL(u);
}
function doExportWord(data) {
  const phases=data.phases||[];const actors=data.actors||[];
  const body=`<h1 style="color:#4F46E5">${data.title}</h1><p style="color:#64748B;font-style:italic">${data.summary}</p><br/>
<h2>Participants</h2><table border="1" cellpadding="8" style="border-collapse:collapse;width:100%;margin-bottom:20px">
<tr style="background:#EEF2FF"><th>Actor</th><th>Name</th></tr>
${actors.map(a=>`<tr><td>${a.emoji}</td><td>${a.name}</td></tr>`).join("")}</table>
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
<style>@page{margin:1.8cm;size:A4}body{font-family:'Segoe UI',sans-serif;font-size:10pt;color:#0F172A;line-height:1.6}
h1{font-size:18pt;color:#4F46E5;font-weight:700;margin-bottom:6px}
.node{border-radius:8px;padding:12px;margin-bottom:4px;page-break-inside:avoid;border-left:4px solid}
.arrow{text-align:center;color:#6366F1;font-size:16pt;margin:2px 0;line-height:1}
.decision{background:#FFFBEB;border:2px solid #FDE68A;border-radius:8px;padding:12px;margin:4px 0}
.footer{text-align:center;font-size:8pt;color:#94A3B8;margin-top:20px;letter-spacing:1.5px}
.print-btn{position:fixed;top:16px;right:16px;background:#4F46E5;color:white;border:none;border-radius:8px;padding:10px 20px;cursor:pointer;font-weight:600}
@media print{.print-btn{display:none}}</style></head><body>
<button class="print-btn" onclick="window.print()">Save PDF</button>
<h1>${data.title}</h1><p style="color:#64748B;margin-bottom:16px">${data.summary}</p>
<p style="margin-bottom:16px">${actors.map(a=>`${a.emoji} ${a.name}`).join(" · ")}</p>
${phases.map((p,idx)=>{const c=gc(data.actors?.findIndex(a=>a.id===p.actorId)??0);const actor=actors.find(a=>a.id===p.actorId);return`
${p.isDecision
  ?`<div class="decision"><b style="color:#92400E">◆ DECISION: ${p.decisionQuestion}</b><br/>✅ YES → ${p.decisionYes} &nbsp;&nbsp; ❌ NO → ${p.decisionNo}</div>`
  :`<div class="node" style="border-color:${c};background:${c}06">
<b style="color:${c}">${p.icon} Step ${idx+1}: ${p.title}</b> <span style="color:#64748B;font-size:9pt">— ${actor?.name}</span><br/>
${p.steps.map((s,i)=>`${i+1}. ${s}`).join("  ·  ")}<br/>
<span style="color:${c}">✓ ${p.output}</span>${p.note?`<br/><span style="color:#92400E;font-size:9pt">⚠️ ${p.note}</span>`:""}</div>`}
${idx<phases.length-1?`<div class="arrow">↓</div>`:""}`}).join("")}
<div style="margin-top:16px;border:1px solid #E2E8F0;border-radius:8px;padding:14px">
<b style="font-size:9pt;color:#6366F1;letter-spacing:1.5px;text-transform:uppercase">Key Insights</b><br/>
${(data.keyInsights||[]).map(i=>`<div style="font-size:9pt;color:#475569;margin-top:6px;padding-left:10px;border-left:2px solid #6366F133">${i}</div>`).join("")}</div>
<div class="footer">FLOWSCRIBE AI</div></body></html>`;
  const w=window.open('','_blank');w.document.write(html);w.document.close();
}
function doExportPPT(data) {
  const gc=(idx)=>COLORS[idx%COLORS.length];
  const phases=data.phases||[];const actors=data.actors||[];
  const slides=[
    `<div class="slide" style="background:linear-gradient(135deg,#4F46E5,#7C3AED);display:flex;flex-direction:column;align-items:center;justify-content:center;text-align:center;padding:60px">
      <h1 style="font-size:30pt;font-weight:800;color:white;margin-bottom:14px">${data.title}</h1>
      <p style="font-size:13pt;color:rgba(255,255,255,0.8);max-width:560px;line-height:1.6">${data.summary}</p>
      <div style="display:flex;gap:10px;flex-wrap:wrap;justify-content:center;margin-top:28px">
        ${actors.map(a=>`<div style="background:rgba(255,255,255,0.2);border-radius:20px;padding:5px 16px;font-size:11pt;color:white">${a.emoji} ${a.name}</div>`).join("")}
      </div></div>`,
    ...phases.map((p,idx)=>{const c=gc(data.actors?.findIndex(a=>a.id===p.actorId)??0);const actor=actors.find(a=>a.id===p.actorId);return`
    <div class="slide" style="padding:44px 52px;background:#FAFBFF">
      <div style="display:flex;align-items:center;gap:14px;margin-bottom:24px;padding-bottom:16px;border-bottom:2px solid #F1F5F9">
        <div style="width:44px;height:44px;border-radius:10px;background:${c}15;display:flex;align-items:center;justify-content:center;font-size:22px">${p.icon}</div>
        <div><div style="font-size:16pt;font-weight:700">${p.title}</div><div style="font-size:10pt;color:${c}">${actor?.name} · Step ${idx+1}</div></div></div>
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:28px">
        <div>${p.steps.map((s,i)=>`<div style="display:flex;gap:10px;margin-bottom:9px"><div style="min-width:22px;height:22px;border-radius:6px;background:${c}15;color:${c};font-size:9pt;font-weight:700;display:flex;align-items:center;justify-content:center">${i+1}</div><div style="font-size:10pt;color:#475569">${s}</div></div>`).join("")}</div>
        <div><div style="background:${c}0D;border:1px solid ${c}22;border-radius:10px;padding:14px;font-size:10pt">✓ ${p.output}</div></div>
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

// ── GLOBAL CSS ────────────────────────────────────────────────────────────────
const GCSS = `
  @import url('https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700;800&display=swap');
  *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
  :root {
    --bg: #F8F9FF; --white: #FFFFFF; --border: #E4E7F0; --border2: #C7D2FE;
    --text: #0F172A; --text2: #475569; --text3: #94A3B8;
    --indigo: #4F46E5; --violet: #7C3AED; --surface: #F1F3FF;
  }
  body { background: var(--bg); font-family: 'Plus Jakarta Sans', system-ui, sans-serif; color: var(--text); -webkit-font-smoothing: antialiased; overflow-x: hidden; }
  ::-webkit-scrollbar { width: 5px; } ::-webkit-scrollbar-track { background: var(--bg); } ::-webkit-scrollbar-thumb { background: #C7D2FE; border-radius: 3px; }

  .nav { height:62px; display:flex; align-items:center; justify-content:space-between; padding:0 24px; background:rgba(255,255,255,0.9); backdrop-filter:blur(20px); border-bottom:1px solid var(--border); position:sticky; top:0; z-index:100; animation:slideDown 0.5s ease both; }
  .nav-brand { display:flex; align-items:center; gap:10px; }
  .nav-logo { width:34px; height:34px; background:linear-gradient(135deg,var(--indigo),var(--violet)); border-radius:9px; display:flex; align-items:center; justify-content:center; font-size:17px; box-shadow:0 2px 10px rgba(99,102,241,0.4); animation:logoPop 0.6s 0.2s cubic-bezier(0.34,1.6,0.64,1) both; }
  .nav-name { font-size:17px; font-weight:800; letter-spacing:-0.3px; }
  .nav-pill { background:linear-gradient(135deg,#EEF2FF,#F5F0FF); border:1px solid var(--border2); border-radius:20px; padding:4px 12px; font-size:11px; font-weight:700; color:#6366F1; }

  .btn { font-family:'Plus Jakarta Sans',sans-serif; font-size:14px; font-weight:600; border-radius:10px; padding:10px 22px; cursor:pointer; border:1px solid transparent; transition:all 0.2s cubic-bezier(0.34,1.3,0.64,1); }
  .btn-primary { background:linear-gradient(135deg,var(--indigo),var(--violet)); color:white; box-shadow:0 2px 14px rgba(99,102,241,0.35); }
  .btn-primary:hover { transform:translateY(-2px) scale(1.02); box-shadow:0 8px 24px rgba(99,102,241,0.45); }
  .btn-primary:active { transform:translateY(0) scale(0.99); }
  .btn-primary:disabled { background:#CBD5E1; box-shadow:none; cursor:not-allowed; transform:none; }
  .btn-secondary { background:white; color:var(--text2); border-color:var(--border); box-shadow:0 1px 3px rgba(0,0,0,0.06); }
  .btn-secondary:hover { border-color:#6366F1; color:var(--indigo); transform:translateY(-1px); }

  .input { font-family:'Plus Jakarta Sans',sans-serif; font-size:14px; color:var(--text); background:white; border:1.5px solid var(--border); border-radius:10px; padding:11px 14px; width:100%; outline:none; transition:all 0.2s; }
  .input:focus { border-color:#6366F1; box-shadow:0 0 0 4px rgba(99,102,241,0.1); }
  .input::placeholder { color:#C4C9D4; }

  .card { background:white; border:1.5px solid var(--border); border-radius:16px; box-shadow:0 2px 8px rgba(99,102,241,0.06); transition:box-shadow 0.2s; }

  /* ── FLOWCHART NODES ── */
  .fc-node {
    background: white; border-radius: 12px; border: 2px solid;
    padding: 14px 18px; position: relative;
    transition: all 0.22s cubic-bezier(0.34,1.2,0.64,1);
    box-shadow: 0 2px 8px rgba(0,0,0,0.06);
    cursor: pointer;
  }
  .fc-node:hover { transform: translateY(-3px) scale(1.01); box-shadow: 0 8px 24px rgba(99,102,241,0.15); }
  .fc-node.active { box-shadow: 0 8px 28px rgba(99,102,241,0.2); transform: translateY(-3px); }

  .fc-decision {
    background: #FFFBEB; border: 2px solid #FDE68A; border-radius: 12px;
    padding: 14px 18px; text-align: center;
    box-shadow: 0 2px 8px rgba(245,158,11,0.12);
    transition: all 0.2s;
  }
  .fc-decision:hover { transform: translateY(-2px); box-shadow: 0 6px 20px rgba(245,158,11,0.2); }

  .fc-arrow {
    display: flex; flex-direction: column; align-items: center; gap: 0;
    margin: 2px 0;
  }
  .fc-arrow-line { width: 2px; height: 20px; background: linear-gradient(180deg,#6366F1,#8B5CF6); opacity: 0.4; }
  .fc-arrow-head { color: #6366F1; font-size: 14px; opacity: 0.6; line-height: 1; margin-top: -2px; }

  .fc-detail {
    border-top: 1.5px dashed;
    margin-top: 12px; padding-top: 12px;
    animation: expandDown 0.25s ease both;
  }

  /* ── HISTORY SIDEBAR ── */
  .sidebar { width: 280px; flex-shrink: 0; border-right: 1px solid var(--border); background: white; height: calc(100vh - 62px); overflow-y: auto; position: sticky; top: 62px; }
  .sidebar-item { padding: 12px 16px; border-bottom: 1px solid #F1F5F9; cursor: pointer; transition: all 0.15s; border-left: 3px solid transparent; }
  .sidebar-item:hover { background: var(--surface); border-left-color: #6366F1; }
  .sidebar-item.active { background: #EEF2FF; border-left-color: var(--indigo); }

  /* ── EXPORT BTN ── */
  .exp-btn { font-family:'Plus Jakarta Sans',sans-serif; font-size:12px; font-weight:600; border-radius:8px; padding:7px 14px; cursor:pointer; border:1.5px solid var(--border); background:white; color:var(--text2); transition:all 0.2s cubic-bezier(0.34,1.3,0.64,1); display:flex; align-items:center; gap:5px; }
  .exp-btn:hover { border-color:#6366F1; color:var(--indigo); background:#EEF2FF; transform:translateY(-2px) scale(1.04); box-shadow:0 4px 14px rgba(99,102,241,0.15); }

  .label { font-size:10px; font-weight:700; letter-spacing:1.5px; color:var(--text3); text-transform:uppercase; margin-bottom:10px; }

  .orb { position:fixed; border-radius:50%; filter:blur(80px); pointer-events:none; z-index:0; animation:orbFloat linear infinite; }

  .drop-zone { border:2px dashed var(--border2); border-radius:14px; padding:40px 32px; text-align:center; cursor:pointer; background:white; transition:all 0.25s cubic-bezier(0.34,1.2,0.64,1); }
  .drop-zone:hover { border-color:#6366F1; transform:translateY(-2px); box-shadow:0 8px 24px rgba(99,102,241,0.1); }
  .drop-zone.over { border-color:#6366F1; background:#EEF2FF; transform:scale(1.01); }

  /* ── ANIMATIONS ── */
  @keyframes slideDown { from{opacity:0;transform:translateY(-20px)} to{opacity:1;transform:translateY(0)} }
  @keyframes fadeUp { from{opacity:0;transform:translateY(20px)} to{opacity:1;transform:translateY(0)} }
  @keyframes fadeIn { from{opacity:0} to{opacity:1} }
  @keyframes logoPop { from{opacity:0;transform:scale(0.5) rotate(-15deg)} to{opacity:1;transform:scale(1) rotate(0deg)} }
  @keyframes badgePop { from{opacity:0;transform:scale(0.8) translateY(8px)} to{opacity:1;transform:scale(1) translateY(0)} }
  @keyframes orbFloat { 0%{transform:translate(0,0) scale(1)} 33%{transform:translate(40px,-30px) scale(1.08)} 66%{transform:translate(-20px,20px) scale(0.95)} 100%{transform:translate(0,0) scale(1)} }
  @keyframes expandDown { from{opacity:0;transform:translateY(-8px)} to{opacity:1;transform:translateY(0)} }
  @keyframes spinSlow { from{transform:rotate(0deg)} to{transform:rotate(360deg)} }
  @keyframes pulse { 0%,100%{opacity:1;transform:scale(1)} 50%{opacity:0.5;transform:scale(0.8)} }
  @keyframes float { 0%,100%{transform:translateY(0)} 50%{transform:translateY(-8px)} }
  @keyframes titleReveal { from{opacity:0;transform:translateY(24px)} to{opacity:1;transform:translateY(0)} }
  @keyframes blink { 0%,100%{opacity:1} 50%{opacity:0} }
  @keyframes dotPulse { 0%,100%{transform:scale(1)} 50%{transform:scale(1.5)} }

  .fade-up   { animation: fadeUp 0.45s ease both; }
  .fade-up-1 { animation: fadeUp 0.45s 0.07s ease both; }
  .fade-up-2 { animation: fadeUp 0.45s 0.14s ease both; }
  .fade-up-3 { animation: fadeUp 0.45s 0.21s ease both; }
  .fade-up-4 { animation: fadeUp 0.45s 0.28s ease both; }
  .scale-in  { animation: badgePop 0.35s ease both; }
  .cursor    { display:inline-block; width:2px; height:1em; background:#6366F1; margin-left:2px; animation:blink 1s step-end infinite; vertical-align:text-bottom; }
`;

// ── VISUAL FLOWCHART ──────────────────────────────────────────────────────────
function VisualFlowchart({ data }) {
  const [active, setActive] = useState(null);
  const gc = (actorId) => { const i = data.actors?.findIndex(a => a.id === actorId) ?? 0; return COLORS[i % COLORS.length]; };
  const ga = (actorId) => data.actors?.find(a => a.id === actorId);

  return (
    <div style={{ display:"flex", flexDirection:"column", alignItems:"center", width:"100%", padding:"8px 0" }}>
      {(data.phases||[]).map((phase, index) => {
        const color = gc(phase.actorId);
        const actor = ga(phase.actorId);
        const isActive = active === phase.id;
        const isLast = index === data.phases.length - 1;

        return (
          <div key={phase.id} style={{ width:"100%", maxWidth:"560px", animation:`fadeUp 0.4s ${index*0.07}s ease both`, opacity:0, animationFillMode:"forwards" }}>

            {/* Node */}
            {phase.isDecision ? (
              <div className="fc-decision" onClick={() => setActive(isActive ? null : phase.id)}>
                <div style={{ fontSize:"22px", marginBottom:"6px" }}>◆</div>
                <div style={{ fontSize:"14px", fontWeight:700, color:"#92400E", marginBottom:"4px" }}>{phase.title}</div>
                <div style={{ fontSize:"12px", color:"#B45309" }}>{phase.decisionQuestion}</div>
                {isActive && (
                  <div style={{ display:"flex", gap:"10px", marginTop:"12px" }}>
                    <div style={{ flex:1, background:"#ECFDF5", border:"1px solid #A7F3D0", borderRadius:"8px", padding:"8px", fontSize:"12px", color:"#065F46", animation:"expandDown 0.2s ease both" }}>
                      ✅ YES<br/><span style={{ fontSize:"11px", opacity:0.8 }}>{phase.decisionYes}</span>
                    </div>
                    <div style={{ flex:1, background:"#FEF2F2", border:"1px solid #FECACA", borderRadius:"8px", padding:"8px", fontSize:"12px", color:"#991B1B", animation:"expandDown 0.2s ease both" }}>
                      ❌ NO<br/><span style={{ fontSize:"11px", opacity:0.8 }}>{phase.decisionNo}</span>
                    </div>
                  </div>
                )}
              </div>
            ) : (
              <div className={`fc-node${isActive?" active":""}`}
                style={{ borderColor: color }}
                onClick={() => setActive(isActive ? null : phase.id)}>

                {/* Top accent bar */}
                <div style={{ position:"absolute", top:0, left:0, right:0, height:"3px", background:`linear-gradient(90deg,${color},${color}66)`, borderRadius:"10px 10px 0 0" }}/>

                <div style={{ display:"flex", alignItems:"center", gap:"12px" }}>
                  <div style={{ width:"44px", height:"44px", borderRadius:"10px", background:`${color}12`, border:`1.5px solid ${color}30`, display:"flex", alignItems:"center", justifyContent:"center", fontSize:"22px", flexShrink:0, transition:"transform 0.2s", transform: isActive ? "scale(1.1) rotate(-5deg)" : "scale(1)" }}>
                    {phase.icon}
                  </div>
                  <div style={{ flex:1, minWidth:0 }}>
                    <div style={{ fontSize:"14px", fontWeight:700, marginBottom:"2px" }}>{phase.title}</div>
                    <div style={{ fontSize:"11px", color, fontWeight:600 }}>{actor?.emoji} {actor?.name}</div>
                  </div>
                  <div style={{ display:"flex", flexDirection:"column", alignItems:"flex-end", gap:"4px", flexShrink:0 }}>
                    <div style={{ fontSize:"10px", fontWeight:700, color:"white", background:`linear-gradient(135deg,${color},${color}cc)`, borderRadius:"6px", padding:"2px 8px" }}>
                      {String(index+1).padStart(2,"0")}
                    </div>
                    <div style={{ fontSize:"18px", fontWeight:700, color, transition:"transform 0.25s", transform: isActive ? "rotate(180deg)" : "rotate(0)" }}>⌄</div>
                  </div>
                </div>

                {/* Expanded detail */}
                {isActive && (
                  <div className="fc-detail" style={{ borderColor:`${color}33` }}>
                    <p style={{ fontSize:"12px", color:"var(--text2)", lineHeight:1.6, marginBottom:"14px", fontStyle:"italic" }}>
                      {phase.description}
                    </p>
                    <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:"16px" }}>
                      <div>
                        <div className="label">Steps</div>
                        {phase.steps.map((s,i) => (
                          <div key={i} style={{ display:"flex", gap:"8px", marginBottom:"8px", alignItems:"flex-start", animation:`fadeUp 0.3s ${i*0.05}s ease both`, opacity:0, animationFillMode:"forwards" }}>
                            <span style={{ minWidth:"20px", height:"20px", borderRadius:"5px", background:`${color}14`, border:`1px solid ${color}28`, display:"flex", alignItems:"center", justifyContent:"center", fontSize:"9px", fontWeight:700, color, flexShrink:0, marginTop:"2px" }}>{i+1}</span>
                            <span style={{ fontSize:"12px", color:"var(--text2)", lineHeight:1.5 }}>{s}</span>
                          </div>
                        ))}
                      </div>
                      <div>
                        <div className="label">Output</div>
                        <div style={{ padding:"10px 12px", background:`${color}0A`, border:`1.5px solid ${color}22`, borderRadius:"8px", fontSize:"12px", color:"var(--text)", lineHeight:1.5, marginBottom:"10px" }}>
                          ✓ {phase.output}
                        </div>
                        {phase.note && (
                          <div style={{ padding:"8px 10px", background:"#FFFBEB", border:"1px solid #FDE68A", borderRadius:"8px", fontSize:"11px", color:"#92400E" }}>
                            ⚠️ {phase.note}
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Connector arrow */}
            {!isLast && (
              <div className="fc-arrow">
                <div className="fc-arrow-line"/>
                <div className="fc-arrow-head">▼</div>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

// ── HISTORY SIDEBAR ───────────────────────────────────────────────────────────
function HistorySidebar({ history, currentId, onSelect, onDelete, onNew }) {
  return (
    <div className="sidebar">
      <div style={{ padding:"14px 16px", borderBottom:"1px solid var(--border)", display:"flex", alignItems:"center", justifyContent:"space-between" }}>
        <div>
          <div style={{ fontSize:"12px", fontWeight:700, color:"var(--text)", marginBottom:"1px" }}>History</div>
          <div style={{ fontSize:"11px", color:"var(--text3)" }}>{history.length} flowchart{history.length!==1?"s":""}</div>
        </div>
        <button className="btn btn-primary" onClick={onNew} style={{ padding:"6px 14px", fontSize:"12px" }}>+ New</button>
      </div>

      {history.length === 0 ? (
        <div style={{ padding:"32px 16px", textAlign:"center" }}>
          <div style={{ fontSize:"28px", marginBottom:"8px" }}>📋</div>
          <div style={{ fontSize:"12px", color:"var(--text3)", lineHeight:1.5 }}>Your generated flowcharts will appear here</div>
        </div>
      ) : (
        history.map((item, i) => (
          <div key={item.id} className={`sidebar-item${item.id===currentId?" active":""}`}
            onClick={() => onSelect(item)}
            style={{ animation:`fadeUp 0.3s ${i*0.05}s ease both` }}>
            <div style={{ display:"flex", alignItems:"flex-start", justifyContent:"space-between", gap:"8px" }}>
              <div style={{ flex:1, minWidth:0 }}>
                <div style={{ fontSize:"13px", fontWeight:600, color:"var(--text)", marginBottom:"3px", whiteSpace:"nowrap", overflow:"hidden", textOverflow:"ellipsis" }}>
                  {item.data.title}
                </div>
                <div style={{ fontSize:"11px", color:"var(--text3)", marginBottom:"4px" }}>
                  {new Date(item.createdAt).toLocaleDateString()} · {item.data.phases?.length||0} phases
                </div>
                <div style={{ display:"flex", gap:"4px", flexWrap:"wrap" }}>
                  {(item.data.actors||[]).slice(0,2).map((a,idx) => (
                    <span key={idx} style={{ fontSize:"10px", padding:"1px 7px", borderRadius:"10px", background:`${COLORS[idx%COLORS.length]}12`, color:COLORS[idx%COLORS.length], border:`1px solid ${COLORS[idx%COLORS.length]}25`, fontWeight:600 }}>
                      {a.emoji} {a.name}
                    </span>
                  ))}
                  {(item.data.actors||[]).length > 2 && <span style={{ fontSize:"10px", color:"var(--text3)" }}>+{item.data.actors.length-2}</span>}
                </div>
              </div>
              <button onClick={e => { e.stopPropagation(); onDelete(item.id); }}
                style={{ background:"none", border:"none", cursor:"pointer", color:"var(--text3)", fontSize:"16px", padding:"0 2px", flexShrink:0, lineHeight:1, transition:"color 0.15s" }}
                onMouseEnter={e => e.currentTarget.style.color="#EF4444"}
                onMouseLeave={e => e.currentTarget.style.color="var(--text3)"}>×</button>
            </div>
          </div>
        ))
      )}
    </div>
  );
}

// ── EXPORT BAR ────────────────────────────────────────────────────────────────
function ExportBar({ data }) {
  const [busy, setBusy] = useState(null);
  const go = (type, fn) => { setBusy(type); setTimeout(() => { fn(data); setBusy(null); }, 200); };
  const exports = [
    {type:"html",icon:"🌐",label:"HTML",fn:doExportHTML},
    {type:"word",icon:"📝",label:"Word",fn:doExportWord},
    {type:"pdf", icon:"📄",label:"PDF", fn:doExportPDF},
    {type:"ppt", icon:"📊",label:"Slides",fn:doExportPPT},
  ];
  return (
    <div style={{ display:"flex", gap:"8px", flexWrap:"wrap" }}>
      {exports.map(({type,icon,label,fn}) => (
        <button key={type} className="exp-btn" onClick={() => go(type,fn)} disabled={!!busy}>
          {busy===type ? <span style={{width:"12px",height:"12px",border:"2px solid #6366F144",borderTopColor:"#6366F1",borderRadius:"50%",display:"inline-block",animation:"spinSlow 0.7s linear infinite"}}/> : icon} {label}
        </button>
      ))}
    </div>
  );
}

// ── RESULT VIEW ───────────────────────────────────────────────────────────────
function ResultView({ data }) {
  const gc = (i) => COLORS[i % COLORS.length];

  return (
    <div style={{ flex:1, overflowY:"auto", padding:"32px 32px 60px" }}>
      {/* Header */}
      <div style={{ marginBottom:"24px" }}>
        <div style={{ display:"inline-flex", alignItems:"center", gap:"6px", background:"#ECFDF5", border:"1px solid #A7F3D0", borderRadius:"20px", padding:"5px 14px", fontSize:"12px", fontWeight:700, color:"#065F46", marginBottom:"14px", animation:"badgePop 0.4s ease both" }}>
          ✅ Flowchart Generated
        </div>
        <h1 className="fade-up-1" style={{ fontSize:"clamp(18px,2.5vw,26px)", fontWeight:800, letterSpacing:"-0.5px", marginBottom:"8px" }}>{data.title}</h1>
        <p className="fade-up-2" style={{ fontSize:"14px", color:"var(--text2)", lineHeight:1.65, marginBottom:"16px", maxWidth:"580px" }}>{data.summary}</p>

        {/* Actors */}
        <div className="fade-up-2" style={{ display:"flex", gap:"7px", flexWrap:"wrap", marginBottom:"16px" }}>
          {(data.actors||[]).map((a,i) => (
            <div key={a.id} style={{ padding:"4px 12px", borderRadius:"20px", fontSize:"12px", fontWeight:600, border:`1.5px solid ${gc(i)}33`, background:`${gc(i)}0D`, color:gc(i), transition:"all 0.2s", cursor:"default" }}
              onMouseEnter={e=>{e.currentTarget.style.transform="translateY(-2px) scale(1.05)";}}
              onMouseLeave={e=>{e.currentTarget.style.transform="";}}>
              {a.emoji} {a.name}
            </div>
          ))}
        </div>

        {/* Stats */}
        <div className="fade-up-3" style={{ display:"inline-flex", gap:"20px", background:"white", border:"1.5px solid var(--border)", borderRadius:"12px", padding:"10px 20px", marginBottom:"20px", boxShadow:"0 1px 4px rgba(0,0,0,0.05)" }}>
          {[{n:data.phases?.length||0,l:"Phases",c:"#6366F1"},{n:data.actors?.length||0,l:"Actors",c:"#8B5CF6"},{n:data.keyInsights?.length||0,l:"Insights",c:"#06B6D4"},{n:data.phases?.filter(p=>p.isDecision).length||0,l:"Decisions",c:"#F59E0B"}].map(({n,l,c})=>(
            <div key={l} style={{ textAlign:"center" }}>
              <div style={{ fontSize:"20px", fontWeight:800, color:c, lineHeight:1 }}>{n}</div>
              <div style={{ fontSize:"10px", color:"var(--text3)", fontWeight:600, marginTop:"3px" }}>{l}</div>
            </div>
          ))}
        </div>

        <div className="fade-up-3">
          <div className="label" style={{marginBottom:"10px"}}>Export</div>
          <ExportBar data={data}/>
        </div>
      </div>

      {/* Divider */}
      <div style={{ display:"flex", alignItems:"center", gap:"14px", margin:"28px 0 20px" }}>
        <div style={{ flex:1, height:"1px", background:"linear-gradient(90deg,transparent,var(--border))" }}/>
        <span style={{ fontSize:"10px", fontWeight:700, color:"var(--text3)", letterSpacing:"1.5px" }}>PROCESS FLOW — CLICK ANY NODE TO EXPAND</span>
        <div style={{ flex:1, height:"1px", background:"linear-gradient(90deg,var(--border),transparent)" }}/>
      </div>

      {/* Visual Flowchart */}
      <VisualFlowchart data={data}/>

      {/* Insights */}
      {data.keyInsights?.length > 0 && (
        <div className="card" style={{ padding:"20px 22px", marginTop:"28px", maxWidth:"560px", marginLeft:"auto", marginRight:"auto" }}>
          <div style={{ display:"flex", alignItems:"center", gap:"8px", marginBottom:"14px" }}>
            <span style={{ fontSize:"18px", animation:"float 2s ease-in-out infinite" }}>💡</span>
            <div className="label" style={{ margin:0 }}>Key Insights</div>
          </div>
          {data.keyInsights.map((ins,i) => (
            <div key={i} style={{ fontSize:"13px", color:"var(--text2)", marginBottom:"8px", padding:"8px 12px", background:`${COLORS[i%COLORS.length]}05`, borderLeft:`3px solid ${COLORS[i%COLORS.length]}44`, borderRadius:"0 6px 6px 0", lineHeight:1.6, transition:"transform 0.15s", cursor:"default" }}
              onMouseEnter={e=>e.currentTarget.style.transform="translateX(4px)"}
              onMouseLeave={e=>e.currentTarget.style.transform=""}>
              {ins}
            </div>
          ))}
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

  const readFile = (file) => new Promise((res,rej) => {
    if (file.type==="application/pdf") { res(`[PDF: ${file.name}] Please paste the text content instead.`); return; }
    const r=new FileReader(); r.onload=e=>res(e.target.result); r.onerror=rej; r.readAsText(file);
  });

  const handleDrop = async (e) => {
    e.preventDefault(); setDragOver(false);
    const f=e.dataTransfer.files[0]; if(f){const t=await readFile(f);onRun(t,f.name);}
  };
  const handleFile = async (e) => { const f=e.target.files[0]; if(f){const t=await readFile(f);onRun(t,f.name);} };

  return (
    <div style={{ flex:1, display:"flex", alignItems:"center", justifyContent:"center", padding:"40px 24px", overflowY:"auto" }}>
      <div style={{ width:"100%", maxWidth:"540px" }}>
        <div className="fade-up" style={{ marginBottom:"36px", textAlign:"center" }}>
          <div style={{ display:"inline-flex", alignItems:"center", gap:"6px", background:"#EEF2FF", border:"1px solid var(--border2)", borderRadius:"20px", padding:"5px 14px", fontSize:"12px", fontWeight:700, color:"#6366F1", marginBottom:"18px" }}>
            <span style={{ width:"7px", height:"7px", borderRadius:"50%", background:"#6366F1", display:"inline-block", animation:"dotPulse 1.5s ease-in-out infinite" }}/>
            AI-Powered Flowchart Generator
          </div>
          <h1 style={{ fontSize:"clamp(24px,3.5vw,36px)", fontWeight:800, lineHeight:1.1, letterSpacing:"-1px", marginBottom:"12px", animation:"titleReveal 0.6s 0.2s ease both", opacity:0, animationFillMode:"forwards" }}>
            Upload a document.<br/>
            <span style={{ background:"linear-gradient(135deg,#4F46E5,#7C3AED)", WebkitBackgroundClip:"text", WebkitTextFillColor:"transparent" }}>Get a flowchart.</span>
          </h1>
          <p style={{ fontSize:"15px", color:"var(--text2)", lineHeight:1.7, animation:"fadeUp 0.5s 0.4s ease both", opacity:0, animationFillMode:"forwards" }}>
            Any transcript, SOP, or meeting doc — the AI extracts every step, actor, and decision.
          </p>
        </div>

        {/* Drop zone */}
        <div className="fade-up-2" style={{ marginBottom:"14px" }}>
          <div className={`drop-zone${dragOver?" over":""}`}
            onDragOver={e=>{e.preventDefault();setDragOver(true);}}
            onDragLeave={()=>setDragOver(false)}
            onDrop={handleDrop}
            onClick={()=>fileRef.current?.click()}>
            <div style={{ fontSize:"36px", marginBottom:"12px", display:"inline-block", animation:"float 3s ease-in-out infinite" }}>{dragOver?"📂":"📁"}</div>
            <div style={{ fontSize:"16px", fontWeight:700, marginBottom:"5px" }}>{dragOver?"Drop to analyze!":"Drop your document here"}</div>
            <div style={{ fontSize:"13px", color:"var(--text3)", marginBottom:"16px" }}>or click to browse files</div>
            <div style={{ display:"flex", gap:"6px", justifyContent:"center", flexWrap:"wrap" }}>
              {[".TXT",".MD",".CSV",".DOCX",".PDF"].map(e=>(
                <span key={e} style={{ fontSize:"11px", fontWeight:600, color:"#6366F1", padding:"3px 10px", background:"#EEF2FF", borderRadius:"5px", border:"1px solid #C7D2FE" }}>{e}</span>
              ))}
            </div>
          </div>
          <input ref={fileRef} type="file" accept=".txt,.md,.csv,.pdf,.docx,.doc" onChange={handleFile} style={{display:"none"}}/>
        </div>

        <div className="fade-up-3" style={{ display:"flex", alignItems:"center", gap:"14px", margin:"16px 0" }}>
          <div style={{flex:1,height:"1px",background:"linear-gradient(90deg,transparent,var(--border))"}}/>
          <span style={{fontSize:"12px",fontWeight:600,color:"var(--text3)"}}>or paste text</span>
          <div style={{flex:1,height:"1px",background:"linear-gradient(90deg,var(--border),transparent)"}}/>
        </div>

        <div className="card fade-up-4" style={{ overflow:"hidden" }}>
          <div onClick={()=>setShowPaste(v=>!v)} style={{ padding:"14px 18px", display:"flex", alignItems:"center", justifyContent:"space-between", cursor:"pointer", borderBottom:showPaste?"1.5px solid var(--border)":"none" }}>
            <div style={{ display:"flex", alignItems:"center", gap:"10px" }}>
              <span style={{ fontSize:"18px" }}>✏️</span>
              <div>
                <div style={{ fontSize:"14px", fontWeight:600 }}>Paste transcript or text</div>
                <div style={{ fontSize:"12px", color:"var(--text3)" }}>Meeting notes, SOPs, process docs...</div>
              </div>
            </div>
            <div style={{ color:"var(--text3)", fontSize:"20px", fontWeight:700, transition:"transform 0.25s", transform:showPaste?"rotate(90deg)":"rotate(0)" }}>›</div>
          </div>
          {showPaste && (
            <div style={{ padding:"14px 18px 18px", animation:"expandDown 0.2s ease both" }}>
              <textarea className="input" value={pasteText} onChange={e=>setPasteText(e.target.value)} autoFocus
                placeholder="Paste your document here..." style={{minHeight:"130px",resize:"vertical",lineHeight:1.65}}/>
              <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginTop:"10px" }}>
                <span style={{ fontSize:"12px", color:pasteText.length<50?"var(--text3)":"#059669", fontWeight:500 }}>
                  {pasteText.length<50?`${pasteText.length}/50 min`:`✓ ${pasteText.length} chars`}
                </span>
                <div style={{ display:"flex", gap:"8px" }}>
                  <button className="btn btn-secondary" onClick={()=>{setPasteText("");setShowPaste(false);}} style={{padding:"7px 14px",fontSize:"13px"}}>Clear</button>
                  <button className="btn btn-primary" onClick={()=>pasteText.trim().length>=50&&onRun(pasteText,"Pasted text")} disabled={pasteText.trim().length<50}
                    style={{padding:"7px 18px",fontSize:"13px",opacity:pasteText.trim().length>=50?1:0.5}}>Analyze →</button>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
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
      saveKey(key);
      onSave(key);
    } catch(e) { setError(e.message||"Could not verify."); } finally { setTesting(false); }
  };

  return (
    <div style={{ minHeight:"100vh", background:"var(--bg)", overflow:"hidden", position:"relative" }}>
      <style>{GCSS}</style>
      <div className="orb" style={{width:500,height:500,background:"radial-gradient(circle,rgba(99,102,241,0.12),transparent)",top:"-100px",right:"-100px",animationDuration:"18s"}}/>
      <div className="orb" style={{width:400,height:400,background:"radial-gradient(circle,rgba(124,58,237,0.1),transparent)",bottom:"5%",left:"-80px",animationDuration:"22s"}}/>

      <nav className="nav">
        <div className="nav-brand">
          <div className="nav-logo">⬡</div>
          <span className="nav-name">FlowScribe</span>
        </div>
        <div className="nav-pill">AI POWERED</div>
      </nav>

      <div style={{ maxWidth:"480px", margin:"0 auto", padding:"56px 24px 80px", position:"relative", zIndex:1 }}>
        <div className="fade-up" style={{ marginBottom:"36px", textAlign:"center" }}>
          <div style={{ fontSize:"44px", marginBottom:"14px", animation:"float 3s ease-in-out infinite" }}>⬡</div>
          <h1 style={{ fontSize:"clamp(26px,4vw,38px)", fontWeight:800, lineHeight:1.1, letterSpacing:"-1px", marginBottom:"12px", animation:"titleReveal 0.6s 0.2s ease both", opacity:0, animationFillMode:"forwards" }}>
            Welcome to<br/>
            <span style={{ background:"linear-gradient(135deg,#4F46E5,#7C3AED)", WebkitBackgroundClip:"text", WebkitTextFillColor:"transparent" }}>FlowScribe AI</span>
          </h1>
          <p style={{ fontSize:"15px", color:"var(--text2)", lineHeight:1.7, animation:"fadeUp 0.5s 0.3s ease both", opacity:0, animationFillMode:"forwards" }}>
            Turn any transcript or document into a visual, interactive flowchart — exportable to Word, PDF, and PowerPoint.
          </p>
        </div>

        <div className="card fade-up-3" style={{ padding:"28px" }}>
          <div style={{ display:"flex", alignItems:"center", gap:"10px", marginBottom:"20px" }}>
            <div style={{ width:"36px", height:"36px", background:"linear-gradient(135deg,#EEF2FF,#F5F0FF)", border:"1px solid var(--border2)", borderRadius:"10px", display:"flex", alignItems:"center", justifyContent:"center", fontSize:"18px", animation:"float 3s ease-in-out infinite" }}>🔑</div>
            <div>
              <div style={{ fontWeight:700, fontSize:"15px" }}>Enter your API Key</div>
              <div style={{ fontSize:"12px", color:"var(--text3)" }}>Anthropic API key — saved in your browser</div>
            </div>
          </div>

          <div style={{ display:"flex", gap:"8px", marginBottom:"14px" }}>
            <input className="input" type={show?"text":"password"} value={key}
              onChange={e=>{setKey(e.target.value);setError("");}}
              placeholder="sk-ant-api03-…"
              onKeyDown={e=>e.key==="Enter"&&handleSave()}
              style={{ flex:1 }}/>
            <button className="btn btn-secondary" onClick={()=>setShow(!show)} style={{padding:"10px 14px",flexShrink:0,fontSize:"13px"}}>{show?"Hide":"Show"}</button>
          </div>

          {error && <div style={{fontSize:"13px",color:"#DC2626",marginBottom:"14px",padding:"10px 14px",background:"#FEF2F2",borderRadius:"8px",border:"1px solid #FECACA",animation:"badgePop 0.3s ease both"}}>⚠️ {error}</div>}

          <button className="btn btn-primary" onClick={handleSave} disabled={!key||testing} style={{width:"100%",fontSize:"15px",padding:"13px"}}>
            {testing?(
              <span style={{display:"flex",alignItems:"center",justifyContent:"center",gap:"8px"}}>
                <span style={{width:"14px",height:"14px",border:"2px solid rgba(255,255,255,0.3)",borderTopColor:"white",borderRadius:"50%",display:"inline-block",animation:"spinSlow 0.7s linear infinite"}}/>
                Verifying…
              </span>
            ):"Get Started →"}
          </button>

          <div style={{marginTop:"20px",paddingTop:"18px",borderTop:"1px solid var(--border)"}}>
            <div className="label" style={{marginBottom:"12px"}}>How to get a key</div>
            <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:"8px"}}>
              {[["1","console.anthropic.com","🌐"],["2","Sign up / Log in","👤"],["3","API Keys → Create","🔐"],["4","Paste above","✅"]].map(([n,t,ic],i)=>(
                <div key={n} style={{padding:"9px 12px",background:"var(--surface)",borderRadius:"8px",border:"1px solid var(--border)",animation:`fadeUp 0.4s ${0.4+i*0.08}s ease both`,opacity:0,animationFillMode:"forwards",transition:"transform 0.2s"}}
                  onMouseEnter={e=>e.currentTarget.style.transform="translateY(-2px)"}
                  onMouseLeave={e=>e.currentTarget.style.transform=""}>
                  <div style={{fontSize:"10px",fontWeight:700,color:"#6366F1",marginBottom:"2px"}}>STEP {n}</div>
                  <div style={{fontSize:"12px",color:"var(--text2)"}}>{ic} {t}</div>
                </div>
              ))}
            </div>
            <div style={{marginTop:"12px",padding:"10px 14px",background:"#ECFDF5",border:"1px solid #A7F3D0",borderRadius:"8px",display:"flex",alignItems:"center",gap:"8px"}}>
              <span style={{animation:"float 2s ease-in-out infinite",fontSize:"14px"}}>💚</span>
              <span style={{fontSize:"12px",color:"#065F46",fontWeight:500}}>~$0.001 per analysis — very affordable</span>
            </div>
          </div>
        </div>
        <p style={{textAlign:"center",fontSize:"11px",color:"var(--text3)",marginTop:"16px",animation:"fadeIn 1s 1s ease both",opacity:0,animationFillMode:"forwards"}}>
          🔒 Key saved in your browser. Never sent to any server except Anthropic.
        </p>
      </div>
    </div>
  );
}

// ── MAIN APP ──────────────────────────────────────────────────────────────────
export default function App() {
  const [apiKey, setApiKey] = useState(() => loadKey());
  const [history, setHistory] = useState(() => loadHistory());
  const [currentData, setCurrentData] = useState(null);
  const [currentId, setCurrentId] = useState(null);
  const [stage, setStage] = useState("upload");
  const [progress, setProgress] = useState("");
  const [progressPct, setProgressPct] = useState(0);
  const [errorMsg, setErrorMsg] = useState("");
  const [showHistory, setShowHistory] = useState(true);

  const run = useCallback(async (text, name) => {
    setStage("processing"); setProgress("Reading document…"); setProgressPct(15);
    try {
      setProgress("AI analyzing your document…"); setProgressPct(40);
      const result = await analyzeTranscript(text, apiKey);
      setProgress("Building flowchart…"); setProgressPct(85);
      await new Promise(r => setTimeout(r, 300));
      setProgressPct(100);
      await new Promise(r => setTimeout(r, 200));

      const id = Date.now().toString();
      const item = { id, createdAt: new Date().toISOString(), fileName: name, data: result };
      const newHistory = [item, ...history];
      setHistory(newHistory);
      saveHistory(newHistory);
      setCurrentData(result);
      setCurrentId(id);
      setStage("result");
    } catch(err) { setErrorMsg(err.message||"Something went wrong."); setStage("error"); }
  }, [apiKey, history]);

  const handleSelect = (item) => { setCurrentData(item.data); setCurrentId(item.id); setStage("result"); };
  const handleDelete = (id) => {
    const newH = history.filter(h => h.id !== id);
    setHistory(newH); saveHistory(newH);
    if (currentId === id) { setStage("upload"); setCurrentData(null); setCurrentId(null); }
  };
  const handleNew = () => { setStage("upload"); setCurrentData(null); setCurrentId(null); setErrorMsg(""); setProgressPct(0); };
  const handleLogout = () => { saveKey(""); setApiKey(""); };

  if (!apiKey) return <ApiKeyScreen onSave={setApiKey}/>;

  return (
    <div style={{ minHeight:"100vh", background:"var(--bg)", display:"flex", flexDirection:"column", overflow:"hidden" }}>
      <style>{GCSS}</style>
      <div className="orb" style={{width:500,height:500,background:"radial-gradient(circle,rgba(99,102,241,0.07),transparent)",top:"-150px",right:"-100px",animationDuration:"20s",zIndex:0}}/>

      {/* Nav */}
      <nav className="nav">
        <div className="nav-brand">
          <div className="nav-logo">⬡</div>
          <span className="nav-name">FlowScribe</span>
        </div>
        <div style={{ display:"flex", alignItems:"center", gap:"8px" }}>
          <button className="btn btn-secondary" onClick={() => setShowHistory(v=>!v)} style={{padding:"7px 12px",fontSize:"12px"}}>
            {showHistory ? "Hide" : "Show"} History
          </button>
          {stage==="result" && <button className="btn btn-secondary" onClick={handleNew} style={{padding:"7px 14px",fontSize:"12px"}}>+ New</button>}
          <button className="btn btn-secondary" onClick={handleLogout} style={{padding:"7px 14px",fontSize:"12px"}}>🔑 Key</button>
          <div className="nav-pill">AI READY</div>
        </div>
      </nav>

      {/* Body */}
      <div style={{ flex:1, display:"flex", overflow:"hidden" }}>

        {/* Sidebar */}
        {showHistory && (
          <HistorySidebar
            history={history}
            currentId={currentId}
            onSelect={handleSelect}
            onDelete={handleDelete}
            onNew={handleNew}
          />
        )}

        {/* Main */}
        <div style={{ flex:1, display:"flex", flexDirection:"column", overflow:"hidden", position:"relative", zIndex:1 }}>

          {stage==="upload" && <UploadPanel onRun={run}/>}

          {stage==="processing" && (
            <div style={{ flex:1, display:"flex", alignItems:"center", justifyContent:"center", padding:"40px 24px" }}>
              <div className="card scale-in" style={{ padding:"36px 32px", width:"100%", maxWidth:"420px", textAlign:"center" }}>
                <div style={{ width:"64px", height:"64px", background:"linear-gradient(135deg,var(--indigo),var(--violet))", borderRadius:"16px", display:"flex", alignItems:"center", justifyContent:"center", fontSize:"28px", margin:"0 auto 20px", boxShadow:"0 8px 24px rgba(99,102,241,0.4)", animation:"spinSlow 3s linear infinite" }}>⬡</div>
                <h2 style={{ fontSize:"19px", fontWeight:800, marginBottom:"7px" }}>Analyzing document</h2>
                <p style={{ fontSize:"13px", color:"#6366F1", fontWeight:600, marginBottom:"16px" }}>{progress}</p>
                <div style={{ height:"5px", background:"#EEF2FF", borderRadius:"3px", marginBottom:"22px", overflow:"hidden" }}>
                  <div style={{ height:"100%", width:`${progressPct}%`, background:"linear-gradient(90deg,#6366F1,#8B5CF6,#06B6D4)", borderRadius:"3px", transition:"width 0.6s ease", boxShadow:"0 0 8px rgba(99,102,241,0.5)" }}/>
                </div>
                <div style={{ display:"flex", flexDirection:"column", gap:"7px", textAlign:"left" }}>
                  {["Reading & parsing","Identifying actors","Extracting steps","Detecting decisions","Building flowchart"].map((s,i)=>(
                    <div key={s} style={{ display:"flex", alignItems:"center", gap:"10px", padding:"9px 12px", background:"var(--surface)", borderRadius:"8px", animation:`fadeUp 0.4s ${i*0.07}s ease both`, opacity:0, animationFillMode:"forwards" }}>
                      <div style={{ width:"7px", height:"7px", borderRadius:"50%", background:"linear-gradient(135deg,#6366F1,#8B5CF6)", flexShrink:0, animation:`pulse ${1+i*0.18}s ease-in-out infinite`, boxShadow:"0 0 5px rgba(99,102,241,0.5)" }}/>
                      <span style={{ fontSize:"12px", color:"var(--text2)", fontWeight:500 }}>{s}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {stage==="result" && currentData && (
            <div style={{ flex:1, overflowY:"auto" }}>
              <ResultView data={currentData}/>
            </div>
          )}

          {stage==="error" && (
            <div style={{ flex:1, display:"flex", alignItems:"center", justifyContent:"center", padding:"40px 24px" }}>
              <div className="card scale-in" style={{ padding:"32px", maxWidth:"380px", textAlign:"center" }}>
                <div style={{ fontSize:"40px", marginBottom:"14px" }}>😕</div>
                <h2 style={{ fontSize:"18px", fontWeight:800, marginBottom:"8px" }}>Something went wrong</h2>
                <div style={{ fontSize:"13px", color:"#DC2626", padding:"10px 14px", background:"#FEF2F2", border:"1px solid #FECACA", borderRadius:"8px", marginBottom:"20px", lineHeight:1.5 }}>{errorMsg}</div>
                <div style={{ display:"flex", gap:"8px", justifyContent:"center" }}>
                  <button className="btn btn-primary" onClick={handleNew}>Try Again</button>
                  <button className="btn btn-secondary" onClick={handleLogout}>Change Key</button>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}