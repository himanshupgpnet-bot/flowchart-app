import { useState, useRef, useCallback } from "react";

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
      messages: [{ role:"user", content:`You are a business process analyst. Read this transcript and extract a process flowchart.
Return ONLY JSON, no markdown:
{"title":"short title","summary":"one sentence","actors":[{"id":"a1","name":"Name","emoji":"👤"}],"phases":[{"id":1,"title":"short title","actorId":"a1","icon":"📋","description":"what happens","steps":["step1","step2"],"output":"what produced","note":"warning or empty","isDecision":false,"decisionQuestion":"","decisionYes":"","decisionNo":""}],"keyInsights":["insight1"]}
Rules: 4-8 phases, short titles, mark decisions with isDecision:true.
TRANSCRIPT: ${text.substring(0,8000)}` }]
    })
  });
  if (!response.ok) { const e=await response.json(); throw new Error(e?.error?.message||"API Error"); }
  const data = await response.json();
  const raw = data.content?.map(c=>c.text||"").join("")||"";
  const parsed = extractJSON(raw);
  if (!parsed) throw new Error("Could not parse response. Try again.");
  return parsed;
}

// ── EXPORT: HTML ──────────────────────────────────────────────────────────────
function doExportHTML(data) {
  const gc = (idx) => COLORS[idx%COLORS.length];
  const html = `<!DOCTYPE html><html><head><meta charset="UTF-8"/><title>${data.title}</title>
<style>*{box-sizing:border-box;margin:0;padding:0}body{background:#F8FAFF;font-family:'Segoe UI',sans-serif;padding:40px 20px}
.w{max-width:780px;margin:0 auto}h1{font-size:26px;font-weight:900;color:#0F172A;text-align:center;margin-bottom:8px}
.sum{text-align:center;color:#64748B;margin-bottom:20px}.acts{display:flex;gap:8px;justify-content:center;flex-wrap:wrap;margin-bottom:28px}
.act{padding:4px 14px;border-radius:20px;font-size:12px;font-weight:600;border:1px solid}
.phase{background:#fff;border-radius:14px;padding:18px;margin-bottom:4px;border:1px solid #E2E8F0}
.ph{display:flex;align-items:center;gap:12px;margin-bottom:12px}
.pi{width:40px;height:40px;border-radius:10px;display:flex;align-items:center;justify-content:center;font-size:18px}
.grid{display:grid;grid-template-columns:1fr 1fr;gap:14px}
.lbl{font-size:10px;font-weight:700;letter-spacing:1px;margin-bottom:8px}
.step{display:flex;gap:8px;margin-bottom:6px;font-size:13px;color:#475569}
.sn{min-width:18px;height:18px;border-radius:4px;display:flex;align-items:center;justify-content:center;font-size:9px;font-weight:700}
.out{border-radius:8px;padding:10px;font-size:13px;margin-bottom:8px}
.note{background:#FFFBEB;border:1px solid #FDE68A;border-radius:8px;padding:8px;font-size:11px;color:#92400E}
.arr{text-align:center;font-size:20px;color:#6366F1;margin:2px 0}
.ins{background:#fff;border-radius:14px;padding:18px;margin-top:18px;border:1px solid #E2E8F0}
.footer{text-align:center;margin-top:20px;font-size:11px;color:#94A3B8}</style></head><body>
<div class="w"><h1>${data.title}</h1><p class="sum">${data.summary}</p>
<div class="acts">${(data.actors||[]).map((a,i)=>`<div class="act" style="color:${gc(i)};border-color:${gc(i)}44;background:${gc(i)}11">${a.emoji} ${a.name}</div>`).join("")}</div>
${(data.phases||[]).map((p,idx)=>{const ai=data.actors?.findIndex(a=>a.id===p.actorId)??0;const c=gc(ai);const actor=data.actors?.find(a=>a.id===p.actorId);return`
<div class="phase" style="border-color:${c}33">
<div class="ph"><div class="pi" style="background:${c}15;border:1px solid ${c}33">${p.icon}</div>
<div style="flex:1"><div style="font-size:14px;font-weight:700">${p.title}</div><div style="font-size:11px;color:${c};font-weight:600">${actor?.emoji} ${actor?.name}</div></div>
<div style="background:${c}11;border:1px solid ${c}33;border-radius:8px;padding:2px 10px;font-size:11px;color:${c};font-weight:700">STEP ${idx+1}</div></div>
<div class="grid"><div><div class="lbl" style="color:${c}">PROCESS STEPS</div>
${p.steps.map((s,i)=>`<div class="step"><span class="sn" style="background:${c}15;color:${c}">${i+1}</span><span>${s}</span></div>`).join("")}
${p.isDecision?`<div style="background:#FFFBEB;border:1px solid #FDE68A;border-radius:8px;padding:8px;font-size:11px;margin-top:8px"><b style="color:#92400E">◆ ${p.decisionQuestion}</b><br/>✅ ${p.decisionYes}<br/>❌ ${p.decisionNo}</div>`:""}
</div><div><div class="lbl" style="color:${c}">OUTPUT</div>
<div class="out" style="background:${c}11;border:1px solid ${c}33">✅ ${p.output}</div>
${p.note?`<div class="note">⚠️ ${p.note}</div>`:""}</div></div></div>
${idx<data.phases.length-1?`<div class="arr">↓</div>`:""}`}).join("")}
<div class="ins"><div style="font-size:10px;font-weight:700;color:#6366F1;letter-spacing:1px;margin-bottom:10px">✦ KEY INSIGHTS</div>
${(data.keyInsights||[]).map(i=>`<div style="font-size:13px;color:#475569;margin-bottom:8px;padding-left:12px;border-left:3px solid #6366F133;line-height:1.5">${i}</div>`).join("")}</div>
<div class="footer">Generated by MindMap AI</div></div></body></html>`;
  const b=new Blob([html],{type:"text/html"});
  const u=URL.createObjectURL(b);
  const a=document.createElement("a");a.href=u;a.download=`${data.title.replace(/\s+/g,"_")}.html`;a.click();URL.revokeObjectURL(u);
}

// ── EXPORT: WORD ──────────────────────────────────────────────────────────────
function doExportWord(data) {
  const phases=data.phases||[];const actors=data.actors||[];
  const body=`<h1 style="color:#4F46E5">${data.title}</h1>
<p style="color:#64748B;font-style:italic;margin-bottom:16px">${data.summary}</p>
<h2>Participants</h2>
<table border="1" cellpadding="6" style="border-collapse:collapse;width:100%;margin-bottom:20px">
<tr style="background:#EEF2FF"><th>Emoji</th><th>Name</th></tr>
${actors.map(a=>`<tr><td>${a.emoji}</td><td><b>${a.name}</b></td></tr>`).join("")}
</table>
<h2>Process Steps</h2>
${phases.map((p,i)=>{const actor=actors.find(a=>a.id===p.actorId);return`
<h3 style="color:#4F46E5;margin-top:18px">Step ${i+1}: ${p.title}</h3>
<p><b>Owner:</b> ${actor?.emoji} ${actor?.name}</p>
<p><b>Description:</b> ${p.description}</p>
<p><b>Steps:</b></p><ol>${p.steps.map(s=>`<li>${s}</li>`).join("")}</ol>
<p><b>Output:</b> ✅ ${p.output}</p>
${p.note?`<p style="background:#FFFBEB;padding:8px;border-left:4px solid #F59E0B"><b>⚠️ Note:</b> ${p.note}</p>`:""}
${p.isDecision?`<p style="background:#EEF2FF;padding:8px;border-left:4px solid #6366F1"><b>◆ Decision:</b> ${p.decisionQuestion}<br/>✅ YES → ${p.decisionYes}<br/>❌ NO → ${p.decisionNo}</p>`:""}
<hr style="border:1px solid #E2E8F0;margin-top:14px"/>`}).join("")}
<h2 style="margin-top:20px">Key Insights</h2>
<ul>${(data.keyInsights||[]).map(i=>`<li>${i}</li>`).join("")}</ul>
<p style="color:#94A3B8;font-size:10pt;text-align:center;margin-top:24px">Generated by MindMap AI</p>`;

  const full=`<html xmlns:o='urn:schemas-microsoft-com:office:office' xmlns:w='urn:schemas-microsoft-com:office:word' xmlns='http://www.w3.org/TR/REC-html40'>
<head><meta charset='utf-8'><title>${data.title}</title>
<style>body{font-family:Calibri,sans-serif;font-size:11pt;margin:2cm}h1{font-size:18pt}h2{font-size:14pt}h3{font-size:12pt}table{border-collapse:collapse;width:100%}td,th{border:1px solid #CBD5E1;padding:6pt}th{background:#EEF2FF}li{margin-bottom:3pt}</style>
</head><body>${body}</body></html>`;
  const b=new Blob(['\ufeff',full],{type:"application/msword"});
  const u=URL.createObjectURL(b);
  const a=document.createElement("a");a.href=u;a.download=`${data.title.replace(/\s+/g,"_")}.doc`;a.click();URL.revokeObjectURL(u);
}

// ── EXPORT: PDF (print dialog) ────────────────────────────────────────────────
function doExportPDF(data) {
  const gc=(idx)=>COLORS[idx%COLORS.length];
  const phases=data.phases||[];const actors=data.actors||[];
  const html=`<!DOCTYPE html><html><head><meta charset="UTF-8"/><title>${data.title}</title>
<style>@page{margin:1.8cm;size:A4}*{box-sizing:border-box}body{font-family:'Segoe UI',Arial,sans-serif;font-size:10.5pt;color:#1E293B;line-height:1.5}
.hdr{text-align:center;padding-bottom:14px;border-bottom:3px solid #6366F1;margin-bottom:20px}
h1{font-size:18pt;font-weight:900;color:#0F172A;margin-bottom:6px}.sum{color:#64748B;font-style:italic}
.acts{display:flex;gap:8px;justify-content:center;flex-wrap:wrap;margin:10px 0}
.act{padding:3px 12px;border-radius:20px;font-size:9.5pt;font-weight:600;border:1px solid}
.phase{border-radius:10px;border:1px solid #E2E8F0;padding:13px;margin-bottom:6px;page-break-inside:avoid}
.phd{display:flex;align-items:center;gap:10px;margin-bottom:10px}
.phn{width:26px;height:26px;border-radius:7px;display:flex;align-items:center;justify-content:center;font-size:9.5pt;font-weight:800;color:white;flex-shrink:0}
.pht{font-size:12pt;font-weight:700}.pha{font-size:9.5pt;font-weight:600}
.desc{font-size:9.5pt;color:#64748B;font-style:italic;margin-bottom:10px;padding-left:9px;border-left:3px solid #E2E8F0}
.two{display:grid;grid-template-columns:1fr 1fr;gap:13px}
.lbl{font-size:8.5pt;font-weight:700;letter-spacing:1px;margin-bottom:6px}
.sr{display:flex;gap:6px;margin-bottom:5px;align-items:flex-start}
.sn{width:17px;height:17px;border-radius:4px;display:flex;align-items:center;justify-content:center;font-size:8.5pt;font-weight:700;flex-shrink:0}
.st{font-size:9.5pt;color:#475569}.out{border-radius:8px;padding:9px;font-size:9.5pt;line-height:1.5}
.note{background:#FFFBEB;border:1px solid #FDE68A;border-radius:7px;padding:7px 9px;font-size:8.5pt;color:#92400E;margin-top:7px}
.dec{background:#EEF2FF;border:1px solid #C7D2FE;border-radius:7px;padding:7px 9px;font-size:8.5pt;margin-top:7px}
.arr{text-align:center;color:#6366F1;font-size:16pt;margin:1px 0;line-height:1}
.ins{border-radius:10px;border:1px solid #E2E8F0;padding:13px;margin-top:14px}
.insi{font-size:9.5pt;color:#475569;margin-bottom:6px;padding-left:10px;border-left:3px solid #6366F133;line-height:1.5}
.footer{text-align:center;font-size:8.5pt;color:#94A3B8;margin-top:16px;padding-top:8px;border-top:1px solid #E2E8F0}
.print-btn{position:fixed;top:16px;right:16px;background:linear-gradient(135deg,#6366F1,#8B5CF6);color:white;border:none;border-radius:10px;padding:10px 20px;font-size:13px;font-weight:700;cursor:pointer;box-shadow:0 4px 14px rgba(99,102,241,0.4)}
@media print{.print-btn{display:none}}</style></head><body>
<button class="print-btn" onclick="window.print()">🖨️ Save as PDF</button>
<div class="hdr"><h1>${data.title}</h1><p class="sum">${data.summary}</p>
<div class="acts">${actors.map((a,i)=>`<div class="act" style="color:${gc(i)};border-color:${gc(i)}55;background:${gc(i)}15">${a.emoji} ${a.name}</div>`).join("")}</div></div>
${phases.map((p,idx)=>{const ai=actors.findIndex(a=>a.id===p.actorId);const c=gc(ai);const actor=actors.find(a=>a.id===p.actorId);return`
<div class="phase" style="border-color:${c}44">
<div class="phd"><div class="phn" style="background:${c}">${idx+1}</div>
<div style="font-size:18pt">${p.icon}</div>
<div><div class="pht">${p.title}</div><div class="pha" style="color:${c}">${actor?.emoji} ${actor?.name}</div></div></div>
<div class="desc" style="border-left-color:${c}55">${p.description}</div>
<div class="two">
<div><div class="lbl" style="color:${c}">PROCESS STEPS</div>
${p.steps.map((s,i)=>`<div class="sr"><div class="sn" style="background:${c}20;color:${c}">${i+1}</div><div class="st">${s}</div></div>`).join("")}
${p.isDecision?`<div class="dec"><b style="color:#4F46E5">◆ ${p.decisionQuestion}</b><br/>✅ YES → ${p.decisionYes}<br/>❌ NO → ${p.decisionNo}</div>`:""}</div>
<div><div class="lbl" style="color:${c}">OUTPUT</div>
<div class="out" style="background:${c}12;border:1px solid ${c}33">✅ ${p.output}</div>
${p.note?`<div class="note">⚠️ ${p.note}</div>`:""}</div></div></div>
${idx<phases.length-1?`<div class="arr">↓</div>`:""}`}).join("")}
<div class="ins"><div style="font-size:9pt;font-weight:700;color:#6366F1;letter-spacing:1px;margin-bottom:10px">✦ KEY INSIGHTS</div>
${(data.keyInsights||[]).map(i=>`<div class="insi">${i}</div>`).join("")}</div>
<div class="footer">Generated by MindMap AI · ${new Date().toLocaleDateString()}</div>
</body></html>`;
  const w=window.open('','_blank');
  w.document.write(html);w.document.close();
  w.onload=()=>{w.focus();};
}

// ── EXPORT: POWERPOINT (HTML slides) ─────────────────────────────────────────
function doExportPPT(data) {
  const gc=(idx)=>COLORS[idx%COLORS.length];
  const phases=data.phases||[];const actors=data.actors||[];
  const slides=[
    // Title
    `<div class="slide title-slide">
      <div class="tc"><div style="font-size:52px;margin-bottom:16px">🧠</div>
      <h1 style="font-size:30pt;font-weight:900;color:white;line-height:1.2;margin-bottom:12px">${data.title}</h1>
      <p style="font-size:13pt;color:rgba(255,255,255,0.8);max-width:600px;line-height:1.6;margin:0 auto 24px">${data.summary}</p>
      <div style="display:flex;gap:10px;flex-wrap:wrap;justify-content:center">
        ${actors.map((a,i)=>`<div style="background:rgba(255,255,255,0.15);border:1px solid rgba(255,255,255,0.3);border-radius:20px;padding:5px 16px;font-size:12pt;color:white;font-weight:600">${a.emoji} ${a.name}</div>`).join("")}
      </div>
      <div style="margin-top:28px;font-size:10pt;color:rgba(255,255,255,0.45)">MindMap AI · ${new Date().toLocaleDateString()}</div></div>
    </div>`,
    // Overview
    `<div class="slide"><div class="sh"><h2>Process Overview — ${phases.length} Steps</h2></div>
    <div class="sc" style="padding:28px 36px">
    <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(150px,1fr));gap:14px">
    ${phases.map((p,idx)=>{const ai=actors.findIndex(a=>a.id===p.actorId);const c=gc(ai);return`
    <div style="background:white;border-radius:12px;padding:14px;text-align:center;border:2px solid ${c}33;box-shadow:0 2px 8px rgba(0,0,0,0.05)">
    <div style="font-size:26px;margin-bottom:6px">${p.icon}</div>
    <div style="width:26px;height:26px;border-radius:7px;background:${c};color:white;font-size:10pt;font-weight:800;display:flex;align-items:center;justify-content:center;margin:0 auto 6px">${idx+1}</div>
    <div style="font-size:10pt;font-weight:700;color:#0F172A;line-height:1.3">${p.title}</div>
    <div style="font-size:9pt;color:${c};font-weight:600;margin-top:3px">${actors.find(a=>a.id===p.actorId)?.emoji}</div>
    </div>`}).join("")}
    </div></div></div>`,
    // Per-phase slides
    ...phases.map((p,idx)=>{
      const ai=actors.findIndex(a=>a.id===p.actorId);const c=gc(ai);const actor=actors.find(a=>a.id===p.actorId);
      return`<div class="slide">
      <div class="sh" style="background:${c}">
        <div style="display:flex;align-items:center;gap:14px">
          <div style="width:42px;height:42px;border-radius:10px;background:rgba(255,255,255,0.2);display:flex;align-items:center;justify-content:center;font-size:20px">${p.icon}</div>
          <div><h2 style="color:white;margin:0">Step ${idx+1}: ${p.title}</h2>
          <div style="color:rgba(255,255,255,0.8);font-size:11pt">${actor?.emoji} ${actor?.name}</div></div>
        </div>
      </div>
      <div class="sc" style="padding:22px 34px;display:grid;grid-template-columns:1fr 1fr;gap:22px">
        <div>
          <div style="font-size:9pt;font-weight:700;color:${c};letter-spacing:1px;margin-bottom:10px">PROCESS STEPS</div>
          ${p.steps.map((s,i)=>`<div style="display:flex;gap:9px;margin-bottom:9px;align-items:flex-start">
          <div style="min-width:22px;height:22px;border-radius:6px;background:${c};display:flex;align-items:center;justify-content:center;font-size:9pt;font-weight:800;color:white;flex-shrink:0">${i+1}</div>
          <div style="font-size:11pt;color:#475569;line-height:1.4">${s}</div></div>`).join("")}
          ${p.isDecision?`<div style="background:#FFFBEB;border:1px solid #FDE68A;border-radius:9px;padding:11px;margin-top:10px;font-size:10pt">
          <div style="font-weight:700;color:#92400E;margin-bottom:5px">◆ ${p.decisionQuestion}</div>
          <div style="color:#065F46">✅ YES → ${p.decisionYes}</div>
          <div style="color:#DC2626">❌ NO → ${p.decisionNo}</div></div>`:""}
        </div>
        <div>
          <div style="font-size:9pt;font-weight:700;color:${c};letter-spacing:1px;margin-bottom:10px">OUTPUT</div>
          <div style="background:${c}15;border:1px solid ${c}33;border-radius:11px;padding:13px;font-size:11pt;color:#1E293B;margin-bottom:13px;line-height:1.5">✅ ${p.output}</div>
          ${p.note?`<div style="background:#FFFBEB;border:1px solid #FDE68A;border-radius:11px;padding:11px;font-size:10pt;color:#92400E;line-height:1.5">⚠️ ${p.note}</div>`:""}
          <div style="font-style:italic;color:#94A3B8;font-size:10pt;margin-top:14px;padding-top:11px;border-top:1px solid #E2E8F0">${p.description}</div>
        </div>
      </div></div>`;
    }),
    // Insights
    `<div class="slide">
    <div class="sh" style="background:linear-gradient(135deg,#6366F1,#8B5CF6)"><h2 style="color:white">✦ Key Insights & Risks</h2></div>
    <div class="sc" style="padding:28px 38px">
    ${(data.keyInsights||[]).map((ins,i)=>`<div style="display:flex;gap:13px;margin-bottom:15px;align-items:flex-start">
    <div style="min-width:28px;height:28px;border-radius:8px;background:linear-gradient(135deg,#6366F1,#8B5CF6);display:flex;align-items:center;justify-content:center;font-size:11pt;font-weight:800;color:white;flex-shrink:0">${i+1}</div>
    <div style="font-size:12pt;color:#1E293B;line-height:1.5;padding-top:3px">${ins}</div></div>`).join("")}
    </div></div>`
  ];

  const full=`<!DOCTYPE html><html><head><meta charset="UTF-8"/><title>${data.title} — Presentation</title>
<style>*{box-sizing:border-box;margin:0;padding:0}body{background:#0F172A;font-family:'Segoe UI',Arial,sans-serif;padding:20px}
.slide{width:960px;min-height:540px;background:#F8FAFF;border-radius:12px;margin:0 auto 24px;overflow:hidden;box-shadow:0 8px 40px rgba(0,0,0,0.4);display:flex;flex-direction:column;page-break-after:always}
.title-slide{background:linear-gradient(135deg,#4F46E5,#7C3AED)}.tc{display:flex;flex-direction:column;align-items:center;justify-content:center;height:100%;text-align:center;padding:40px}
.sh{background:#6366F1;padding:18px 34px;min-height:76px;display:flex;align-items:center}.sh h2{color:white;font-size:17pt;font-weight:800;margin:0}
.sc{flex:1}
.print-btn{position:fixed;top:18px;right:18px;background:linear-gradient(135deg,#6366F1,#8B5CF6);color:white;border:none;border-radius:11px;padding:11px 22px;font-size:13px;font-weight:700;cursor:pointer;box-shadow:0 4px 14px rgba(99,102,241,0.4);z-index:100}
.count{position:fixed;top:18px;left:18px;background:rgba(255,255,255,0.1);color:white;border-radius:8px;padding:7px 13px;font-size:11px;font-weight:600}
@media print{body{background:white;padding:0}.slide{box-shadow:none;border-radius:0;width:100%;margin:0;page-break-after:always}.print-btn,.count{display:none}}</style>
</head><body>
<button class="print-btn" onclick="window.print()">🖨️ Print / Save as PDF</button>
<div class="count">📊 ${slides.length} slides</div>
${slides.join("")}
</body></html>`;

  const b=new Blob([full],{type:"text/html"});
  const u=URL.createObjectURL(b);
  const a=document.createElement("a");a.href=u;a.download=`${data.title.replace(/\s+/g,"_")}_slides.html`;a.click();URL.revokeObjectURL(u);
}

// ── STYLES ────────────────────────────────────────────────────────────────────
const S={
  page:{minHeight:"100vh",background:"#F8FAFF",fontFamily:"'Segoe UI',system-ui,sans-serif",color:"#1E293B"},
  nav:{background:"rgba(255,255,255,0.92)",backdropFilter:"blur(20px)",borderBottom:"1px solid #E2E8F0",padding:"0 32px",height:"62px",display:"flex",alignItems:"center",justifyContent:"space-between",position:"sticky",top:0,zIndex:100},
  logoIcon:{width:"34px",height:"34px",borderRadius:"9px",background:"linear-gradient(135deg,#6366F1,#8B5CF6)",display:"flex",alignItems:"center",justifyContent:"center",fontSize:"17px"},
  logoText:{fontSize:"19px",fontWeight:"800",background:"linear-gradient(135deg,#6366F1,#8B5CF6)",WebkitBackgroundClip:"text",WebkitTextFillColor:"transparent"},
  badge:{background:"#EEF2FF",border:"1px solid #C7D2FE",borderRadius:"20px",padding:"4px 12px",fontSize:"11px",color:"#6366F1",fontWeight:"700"},
  card:{background:"#FFFFFF",borderRadius:"20px",border:"1px solid #E2E8F0",boxShadow:"0 4px 24px rgba(99,102,241,0.06)",padding:"26px"},
  btn:{borderRadius:"12px",padding:"11px 26px",fontSize:"14px",fontWeight:"700",cursor:"pointer",border:"none",transition:"all 0.2s"},
  btnP:{background:"linear-gradient(135deg,#6366F1,#8B5CF6)",color:"#fff",boxShadow:"0 4px 14px rgba(99,102,241,0.35)"},
  btnS:{background:"#F1F5F9",color:"#475569",border:"1px solid #E2E8F0"},
  input:{width:"100%",background:"#F8FAFF",border:"1px solid #E2E8F0",borderRadius:"12px",padding:"13px 16px",fontSize:"14px",color:"#1E293B",outline:"none",fontFamily:"inherit",transition:"border-color 0.2s",boxSizing:"border-box"},
};

// ── API KEY SCREEN ─────────────────────────────────────────────────────────────
function ApiKeyScreen({onSave}){
  const [key,setKey]=useState("");const [show,setShow]=useState(false);
  const [error,setError]=useState("");const [testing,setTesting]=useState(false);
  const handleSave=async()=>{
    if(!key.startsWith("sk-ant-")){setError("Must start with sk-ant-");return;}
    setTesting(true);setError("");
    try{
      const r=await fetch("https://api.anthropic.com/v1/messages",{method:"POST",headers:{"Content-Type":"application/json","x-api-key":key,"anthropic-version":"2023-06-01","anthropic-dangerous-direct-browser-access":"true"},body:JSON.stringify({model:"claude-haiku-4-5-20251001",max_tokens:10,messages:[{role:"user",content:"hi"}]})});
      if(!r.ok){const e=await r.json();throw new Error(e?.error?.message||"Invalid key");}
      onSave(key);
    }catch(e){setError(e.message||"Could not verify.");}finally{setTesting(false);}
  };
  return(
    <div style={{...S.page,display:"flex",flexDirection:"column"}}>
      <style>{`@keyframes float{0%,100%{transform:translateY(0)}50%{transform:translateY(-10px)}}@keyframes fadeIn{from{opacity:0;transform:translateY(20px)}to{opacity:1;transform:translateY(0)}}.bpH:hover{transform:translateY(-2px)!important}input:focus{border-color:#6366F1!important;box-shadow:0 0 0 3px rgba(99,102,241,0.1)}`}</style>
      <nav style={S.nav}>
        <div style={{display:"flex",alignItems:"center",gap:"10px"}}><div style={S.logoIcon}>🧠</div><span style={S.logoText}>MindMap AI</span></div>
        <div style={S.badge}>✦ AI Powered</div>
      </nav>
      <div style={{flex:1,display:"flex",alignItems:"center",justifyContent:"center",padding:"40px 20px",background:"radial-gradient(ellipse at top,#EEF2FF 0%,#F8FAFF 60%)"}}>
        <div style={{width:"100%",maxWidth:"458px",animation:"fadeIn 0.6s ease"}}>
          <div style={{textAlign:"center",marginBottom:"30px"}}>
            <div style={{fontSize:"68px",animation:"float 3s ease-in-out infinite",display:"inline-block",marginBottom:"8px"}}>🧠</div>
            <h1 style={{fontSize:"28px",fontWeight:"900",color:"#0F172A",margin:"0 0 8px"}}>Welcome to MindMap AI</h1>
            <p style={{color:"#64748B",fontSize:"14px",lineHeight:1.7,margin:0}}>Enter your AI Engine key to get started.</p>
          </div>
          <div style={S.card}>
            <div style={{fontSize:"11px",fontWeight:"700",color:"#6366F1",letterSpacing:"1.5px",marginBottom:"10px"}}>AI ENGINE KEY</div>
            <div style={{display:"flex",gap:"8px",marginBottom:"10px"}}>
              <input type={show?"text":"password"} value={key} onChange={e=>{setKey(e.target.value);setError("");}} placeholder="sk-ant-api03-..." onKeyDown={e=>e.key==="Enter"&&handleSave()} style={{...S.input,borderColor:error?"#FCA5A5":key.startsWith("sk-ant-")?"#6EE7B7":"#E2E8F0"}}/>
              <button onClick={()=>setShow(!show)} style={{...S.btn,...S.btnS,padding:"12px 14px",fontSize:"16px"}}>{show?"🙈":"👁️"}</button>
            </div>
            {error&&<div style={{background:"#FEF2F2",border:"1px solid #FECACA",borderRadius:"10px",padding:"10px 14px",fontSize:"13px",color:"#DC2626",marginBottom:"12px"}}>⚠️ {error}</div>}
            <button className="bpH" onClick={handleSave} disabled={!key||testing} style={{...S.btn,...S.btnP,width:"100%",opacity:key?1:0.5,cursor:key?"pointer":"not-allowed"}}>{testing?"⏳ Verifying...":"✦ Launch MindMap AI →"}</button>
            <div style={{marginTop:"18px",background:"#F8FAFF",borderRadius:"13px",padding:"14px",border:"1px solid #E2E8F0"}}>
              <div style={{fontSize:"11px",fontWeight:"700",color:"#94A3B8",letterSpacing:"1px",marginBottom:"10px"}}>HOW TO GET YOUR KEY</div>
              {[["1","Visit","console.anthropic.com"],["2","Sign up or log in",""],["3","API Keys → Create Key",""],["4","Copy & paste above",""]].map(([n,t,l])=>(
                <div key={n} style={{display:"flex",gap:"10px",marginBottom:"7px",alignItems:"center"}}>
                  <span style={{minWidth:"22px",height:"22px",borderRadius:"6px",background:"linear-gradient(135deg,#6366F1,#8B5CF6)",display:"flex",alignItems:"center",justifyContent:"center",fontSize:"11px",color:"#fff",fontWeight:"700",flexShrink:0}}>{n}</span>
                  <span style={{fontSize:"13px",color:"#64748B"}}>{t} {l&&<a href={`https://${l}`} target="_blank" rel="noreferrer" style={{color:"#6366F1",fontWeight:"600",textDecoration:"none"}}>{l}</a>}</span>
                </div>
              ))}
              <div style={{marginTop:"8px",background:"#ECFDF5",border:"1px solid #A7F3D0",borderRadius:"8px",padding:"7px 12px",fontSize:"12px",color:"#065F46"}}>💡 ~$0.001 per analysis. Very affordable!</div>
            </div>
          </div>
          <p style={{textAlign:"center",fontSize:"11px",color:"#CBD5E1",marginTop:"14px"}}>🔒 Key stays in your browser session only</p>
        </div>
      </div>
    </div>
  );
}

// ── EXPORT BUTTON BAR ─────────────────────────────────────────────────────────
function ExportBar({data}){
  const [busy,setBusy]=useState(null);
  const go=(type,fn)=>{setBusy(type);setTimeout(()=>{fn(data);setBusy(null);},200);};
  const exports=[
    {type:"html",icon:"🌐",label:"HTML",color:"#6366F1",fn:doExportHTML},
    {type:"word",icon:"📝",label:"Word",color:"#2563EB",fn:doExportWord},
    {type:"pdf", icon:"📄",label:"PDF", color:"#DC2626",fn:doExportPDF},
    {type:"ppt", icon:"📊",label:"PowerPoint",color:"#D97706",fn:doExportPPT},
  ];
  return(
    <div style={{background:"white",border:"1px solid #E2E8F0",borderRadius:"16px",padding:"16px 20px",display:"inline-block",textAlign:"center"}}>
      <div style={{fontSize:"11px",fontWeight:"700",color:"#94A3B8",letterSpacing:"1px",marginBottom:"12px"}}>📥 EXPORT AS</div>
      <div style={{display:"flex",gap:"8px",flexWrap:"wrap",justifyContent:"center"}}>
        {exports.map(({type,icon,label,color,fn})=>(
          <button key={type} onClick={()=>go(type,fn)} disabled={!!busy}
            style={{display:"flex",alignItems:"center",gap:"6px",background:busy===type?color:"white",color:busy===type?"white":color,border:`2px solid ${color}55`,borderRadius:"10px",padding:"9px 18px",fontSize:"13px",fontWeight:"700",cursor:"pointer",transition:"all 0.2s"}}>
            {busy===type?"⏳":icon} {label}
          </button>
        ))}
      </div>
    </div>
  );
}

// ── RESULT VIEW ───────────────────────────────────────────────────────────────
function ResultView({data}){
  const [active,setActive]=useState(null);
  const gc=(actorId)=>{const i=data.actors?.findIndex(a=>a.id===actorId)??0;return COLORS[i%COLORS.length];};
  const ga=(actorId)=>data.actors?.find(a=>a.id===actorId);
  return(
    <div style={{maxWidth:"860px",margin:"0 auto",padding:"0 20px 60px"}}>
      <div style={{textAlign:"center",marginBottom:"26px"}}>
        <div style={{display:"inline-flex",alignItems:"center",gap:"6px",background:"#ECFDF5",border:"1px solid #A7F3D0",borderRadius:"20px",padding:"5px 14px",fontSize:"12px",color:"#065F46",fontWeight:"600",marginBottom:"14px"}}>✅ Analysis Complete</div>
        <h2 style={{fontSize:"clamp(20px,3vw,28px)",fontWeight:"900",color:"#0F172A",margin:"0 0 8px"}}>{data.title}</h2>
        <p style={{color:"#64748B",fontSize:"14px",margin:"0 0 16px",lineHeight:1.6}}>{data.summary}</p>
        <div style={{display:"flex",gap:"8px",justifyContent:"center",flexWrap:"wrap",marginBottom:"20px"}}>
          {(data.actors||[]).map((a,i)=>(
            <div key={a.id} style={{display:"flex",alignItems:"center",gap:"6px",background:`${COLORS[i%COLORS.length]}11`,border:`1px solid ${COLORS[i%COLORS.length]}33`,borderRadius:"20px",padding:"5px 14px",fontSize:"12px",color:COLORS[i%COLORS.length],fontWeight:"600"}}>{a.emoji} {a.name}</div>
          ))}
        </div>
        <ExportBar data={data}/>
      </div>

      <div style={{display:"flex",flexDirection:"column"}}>
        {(data.phases||[]).map((phase,index)=>{
          const color=gc(phase.actorId);const actor=ga(phase.actorId);const isA=active===phase.id;
          return(
            <div key={phase.id} style={{display:"flex",flexDirection:"column",alignItems:"center"}}>
              <div onClick={()=>setActive(isA?null:phase.id)}
                style={{width:"100%",background:"#fff",border:`1px solid ${isA?color+"66":"#E2E8F0"}`,borderRadius:isA?"16px 16px 0 0":"16px",padding:"15px 20px",cursor:"pointer",display:"flex",alignItems:"center",gap:"14px",boxShadow:isA?`0 4px 20px ${color}22`:"0 2px 8px rgba(0,0,0,0.04)",transition:"all 0.2s"}}>
                <div style={{minWidth:"46px",height:"46px",borderRadius:"12px",background:`${color}15`,border:`1px solid ${color}33`,display:"flex",alignItems:"center",justifyContent:"center",fontSize:"22px"}}>{phase.icon}</div>
                <div style={{flex:1}}>
                  <div style={{fontSize:"15px",fontWeight:"700",color:"#0F172A",marginBottom:"3px"}}>{phase.title}</div>
                  <div style={{fontSize:"12px",color,fontWeight:"600"}}>{actor?.emoji} {actor?.name}</div>
                </div>
                <div style={{background:`${color}11`,border:`1px solid ${color}33`,borderRadius:"8px",padding:"3px 10px",fontSize:"11px",color,fontWeight:"700"}}>STEP {index+1}</div>
                <div style={{color,fontSize:"22px",transition:"transform 0.2s",transform:isA?"rotate(90deg)":"rotate(0deg)"}}>›</div>
              </div>
              {isA&&(
                <div style={{width:"100%",background:"#FAFBFF",border:`1px solid ${color}44`,borderTop:"none",borderRadius:"0 0 16px 16px",padding:"18px 20px 22px"}}>
                  <p style={{fontSize:"13px",color:"#64748B",margin:"0 0 16px",lineHeight:1.6,fontStyle:"italic",borderLeft:`3px solid ${color}44`,paddingLeft:"12px"}}>{phase.description}</p>
                  <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:"20px"}}>
                    <div>
                      <div style={{fontSize:"11px",fontWeight:"700",color,letterSpacing:"1px",marginBottom:"10px"}}>PROCESS STEPS</div>
                      {phase.steps.map((step,i)=>(
                        <div key={i} style={{display:"flex",gap:"10px",marginBottom:"8px",alignItems:"flex-start"}}>
                          <span style={{minWidth:"22px",height:"22px",borderRadius:"6px",background:`${color}15`,border:`1px solid ${color}33`,display:"flex",alignItems:"center",justifyContent:"center",fontSize:"11px",color,fontWeight:"700",marginTop:"1px",flexShrink:0}}>{i+1}</span>
                          <span style={{fontSize:"13px",color:"#475569",lineHeight:1.5}}>{step}</span>
                        </div>
                      ))}
                      {phase.isDecision&&(
                        <div style={{marginTop:"12px",background:"#FFFBEB",border:"1px solid #FDE68A",borderRadius:"10px",padding:"12px 14px",fontSize:"12px"}}>
                          <div style={{fontWeight:"700",color:"#92400E",marginBottom:"6px"}}>◆ {phase.decisionQuestion}</div>
                          <div style={{color:"#065F46",marginBottom:"4px"}}>✅ YES → {phase.decisionYes}</div>
                          <div style={{color:"#DC2626"}}>❌ NO → {phase.decisionNo}</div>
                        </div>
                      )}
                    </div>
                    <div>
                      <div style={{fontSize:"11px",fontWeight:"700",color,letterSpacing:"1px",marginBottom:"10px"}}>OUTPUT</div>
                      <div style={{background:`${color}11`,border:`1px solid ${color}33`,borderRadius:"10px",padding:"12px 14px",fontSize:"13px",color:"#1E293B",marginBottom:"14px",lineHeight:1.5}}>✅ {phase.output}</div>
                      {phase.note&&<div style={{background:"#FFFBEB",border:"1px solid #FDE68A",borderRadius:"10px",padding:"10px 14px",fontSize:"12px",color:"#92400E",lineHeight:1.5}}>⚠️ {phase.note}</div>}
                    </div>
                  </div>
                </div>
              )}
              {index<data.phases.length-1&&(
                <div style={{display:"flex",flexDirection:"column",alignItems:"center",height:"28px"}}>
                  <div style={{width:"2px",flex:1,background:`linear-gradient(180deg,${color}66,${gc(data.phases[index+1].actorId)}66)`}}/>
                  <div style={{width:0,height:0,borderLeft:"5px solid transparent",borderRight:"5px solid transparent",borderTop:`7px solid ${gc(data.phases[index+1].actorId)}99`}}/>
                </div>
              )}
            </div>
          );
        })}
      </div>

      {data.keyInsights?.length>0&&(
        <div style={{background:"#fff",border:"1px solid #E2E8F0",borderRadius:"16px",padding:"20px",marginTop:"24px"}}>
          <div style={{fontSize:"11px",fontWeight:"700",color:"#6366F1",letterSpacing:"1px",marginBottom:"14px"}}>✦ KEY INSIGHTS</div>
          {data.keyInsights.map((ins,i)=>(
            <div key={i} style={{fontSize:"13px",color:"#475569",marginBottom:"10px",paddingLeft:"14px",borderLeft:"3px solid #6366F133",lineHeight:1.6}}>{ins}</div>
          ))}
        </div>
      )}
      <div style={{textAlign:"center",marginTop:"28px"}}><ExportBar data={data}/></div>
    </div>
  );
}

// ── MAIN APP ──────────────────────────────────────────────────────────────────
export default function App(){
  const [apiKey,setApiKey]=useState("");
  const [stage,setStage]=useState("upload");
  const [dragOver,setDragOver]=useState(false);
  const [fileName,setFileName]=useState("");
  const [progress,setProgress]=useState("");
  const [flowData,setFlowData]=useState(null);
  const [errorMsg,setErrorMsg]=useState("");
  const [pasteText,setPasteText]=useState("");
  const [showPaste,setShowPaste]=useState(false);
  const fileRef=useRef(null);

  const run=useCallback(async(text,name)=>{
    setFileName(name);setStage("processing");setProgress("Reading document...");
    try{
      setProgress("Analyzing your document...");
      const result=await analyzeTranscript(text,apiKey);
      setProgress("Building flowchart...");
      await new Promise(r=>setTimeout(r,400));
      setFlowData(result);setStage("result");
    }catch(err){setErrorMsg(err.message||"Something went wrong.");setStage("error");}
  // eslint-disable-next-line react-hooks/exhaustive-deps
  },[apiKey]);

  const readFile=(file)=>new Promise((res,rej)=>{
    if(file.type==="application/pdf"){res(`[PDF: ${file.name}] Please paste the text content.`);return;}
    const r=new FileReader();r.onload=e=>res(e.target.result);r.onerror=rej;r.readAsText(file);
  });

  const handleDrop=useCallback(async(e)=>{
    e.preventDefault();setDragOver(false);
    const f=e.dataTransfer.files[0];if(f){const t=await readFile(f);run(t,f.name);}
  // eslint-disable-next-line react-hooks/exhaustive-deps
  },[run]);

  const handleFile=async(e)=>{const f=e.target.files[0];if(f){const t=await readFile(f);run(t,f.name);}};
  const reset=()=>{setStage("upload");setFlowData(null);setFileName("");setPasteText("");setShowPaste(false);setErrorMsg("");};

  if(!apiKey)return <ApiKeyScreen onSave={setApiKey}/>;

  return(
    <div style={S.page}>
      <style>{`
        @keyframes fadeIn{from{opacity:0;transform:translateY(16px)}to{opacity:1;transform:translateY(0)}}
        @keyframes spin{from{transform:rotate(0deg)}to{transform:rotate(360deg)}}
        @keyframes pulse{0%,100%{opacity:1}50%{opacity:0.4}}
        .bpH:hover{transform:translateY(-2px);box-shadow:0 8px 24px rgba(99,102,241,0.45)!important}
        .dropZ:hover{border-color:#6366F1!important;background:#EEF2FF!important}
        input:focus,textarea:focus{border-color:#6366F1!important;box-shadow:0 0 0 3px rgba(99,102,241,0.1);outline:none}
      `}</style>
      <nav style={S.nav}>
        <div style={{display:"flex",alignItems:"center",gap:"10px"}}><div style={S.logoIcon}>🧠</div><span style={S.logoText}>MindMap AI</span></div>
        <div style={{display:"flex",alignItems:"center",gap:"10px"}}>
          {stage==="result"&&<button onClick={reset} style={{...S.btn,...S.btnS,padding:"8px 16px",fontSize:"13px"}}>← New</button>}
          <button onClick={()=>setApiKey("")} style={{background:"transparent",border:"none",color:"#94A3B8",fontSize:"12px",cursor:"pointer",padding:"8px"}}>🔑 Key</button>
          <div style={S.badge}>✦ AI Ready</div>
        </div>
      </nav>

      {stage==="upload"&&(
        <div style={{maxWidth:"640px",margin:"0 auto",padding:"44px 20px",animation:"fadeIn 0.5s ease"}}>
          <div style={{textAlign:"center",marginBottom:"32px"}}>
            <div style={{display:"inline-flex",alignItems:"center",gap:"6px",background:"#EEF2FF",border:"1px solid #C7D2FE",borderRadius:"20px",padding:"5px 14px",fontSize:"12px",color:"#6366F1",fontWeight:"600",marginBottom:"14px"}}>✦ Export to Word · PDF · PowerPoint</div>
            <h1 style={{fontSize:"clamp(26px,4vw,40px)",fontWeight:"900",color:"#0F172A",margin:"0 0 12px",lineHeight:1.1}}>Turn transcripts into{" "}
              <span style={{background:"linear-gradient(135deg,#6366F1,#8B5CF6)",WebkitBackgroundClip:"text",WebkitTextFillColor:"transparent"}}>professional documents</span>
            </h1>
            <p style={{color:"#64748B",fontSize:"14px",lineHeight:1.7,margin:"0 auto",maxWidth:"440px"}}>Upload any meeting transcript or SOP — get an interactive flowchart you can export to Word, PDF, or PowerPoint.</p>
          </div>
          <div className="dropZ" onDragOver={e=>{e.preventDefault();setDragOver(true);}} onDragLeave={()=>setDragOver(false)} onDrop={handleDrop} onClick={()=>fileRef.current?.click()}
            style={{...S.card,border:`2px dashed ${dragOver?"#6366F1":"#C7D2FE"}`,background:dragOver?"#EEF2FF":"#fff",textAlign:"center",cursor:"pointer",padding:"46px 32px",marginBottom:"14px",transition:"all 0.2s"}}>
            <div style={{fontSize:"46px",marginBottom:"12px"}}>📂</div>
            <div style={{fontSize:"17px",fontWeight:"700",color:"#0F172A",marginBottom:"5px"}}>Drop your file here</div>
            <div style={{fontSize:"13px",color:"#94A3B8",marginBottom:"14px"}}>or click to browse</div>
            <div style={{display:"flex",gap:"8px",justifyContent:"center",flexWrap:"wrap"}}>
              {[".TXT",".MD",".CSV",".DOCX",".PDF"].map(e=><span key={e} style={{background:"#EEF2FF",borderRadius:"8px",padding:"3px 11px",fontSize:"11px",color:"#6366F1",fontWeight:"600"}}>{e}</span>)}
            </div>
          </div>
          <input ref={fileRef} type="file" accept=".txt,.md,.csv,.pdf,.docx,.doc" onChange={handleFile} style={{display:"none"}}/>
          <div style={{display:"flex",alignItems:"center",gap:"14px",margin:"18px 0"}}>
            <div style={{flex:1,height:"1px",background:"#E2E8F0"}}/><span style={{color:"#94A3B8",fontSize:"12px",fontWeight:"600"}}>OR PASTE TEXT</span><div style={{flex:1,height:"1px",background:"#E2E8F0"}}/>
          </div>
          <div style={{...S.card,padding:0,overflow:"hidden",marginBottom:"22px"}}>
            <div onClick={()=>setShowPaste(true)} style={{padding:"15px 20px",display:"flex",alignItems:"center",justifyContent:"space-between",cursor:"pointer",borderBottom:showPaste?"1px solid #E2E8F0":"none"}}>
              <div style={{display:"flex",alignItems:"center",gap:"12px"}}><span style={{fontSize:"20px"}}>📋</span>
                <div><div style={{fontSize:"14px",fontWeight:"600",color:"#1E293B"}}>Paste transcript or text</div><div style={{fontSize:"12px",color:"#94A3B8"}}>Meeting notes, SOPs, chat exports...</div></div>
              </div>
              <div style={{color:"#6366F1",fontSize:"22px",transform:showPaste?"rotate(90deg)":"rotate(0deg)",transition:"transform 0.2s"}}>›</div>
            </div>
            {showPaste&&(
              <div style={{padding:"14px 20px 18px"}}>
                <textarea value={pasteText} onChange={e=>setPasteText(e.target.value)} autoFocus placeholder="Paste your content here..." style={{...S.input,minHeight:"150px",resize:"vertical",lineHeight:1.6,padding:"12px"}}/>
                <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginTop:"10px"}}>
                  <span style={{fontSize:"12px",fontWeight:"600",color:pasteText.length<50?"#94A3B8":"#10B981"}}>{pasteText.length<50?`${pasteText.length}/50 chars min`:`✅ ${pasteText.length} chars`}</span>
                  <div style={{display:"flex",gap:"8px"}}>
                    <button onClick={()=>{setPasteText("");setShowPaste(false);}} style={{...S.btn,...S.btnS,padding:"7px 14px",fontSize:"13px"}}>Clear</button>
                    <button className="bpH" onClick={()=>pasteText.trim().length>=50&&run(pasteText,"Pasted text")} disabled={pasteText.trim().length<50}
                      style={{...S.btn,...S.btnP,padding:"7px 18px",fontSize:"13px",opacity:pasteText.trim().length>=50?1:0.5,cursor:pasteText.trim().length>=50?"pointer":"not-allowed"}}>✦ Analyze</button>
                  </div>
                </div>
              </div>
            )}
          </div>
          <div style={{display:"flex",gap:"8px",justifyContent:"center",flexWrap:"wrap"}}>
            {[["⚡","AI Analysis"],["📝","Word Doc"],["📄","PDF"],["📊","PowerPoint"],["🌐","HTML"]].map(([i,l])=>(
              <div key={l} style={{display:"flex",alignItems:"center",gap:"5px",background:"#fff",border:"1px solid #E2E8F0",borderRadius:"20px",padding:"5px 13px",fontSize:"12px",color:"#64748B",fontWeight:"500"}}><span>{i}</span><span>{l}</span></div>
            ))}
          </div>
        </div>
      )}

      {stage==="processing"&&(
        <div style={{maxWidth:"440px",margin:"80px auto",textAlign:"center",padding:"0 20px",animation:"fadeIn 0.4s ease"}}>
          <div style={{width:"76px",height:"76px",borderRadius:"22px",background:"linear-gradient(135deg,#6366F1,#8B5CF6)",display:"flex",alignItems:"center",justifyContent:"center",fontSize:"34px",margin:"0 auto 22px",animation:"spin 3s linear infinite",boxShadow:"0 8px 32px rgba(99,102,241,0.35)"}}>🧠</div>
          <h2 style={{fontSize:"21px",fontWeight:"800",color:"#0F172A",margin:"0 0 8px"}}>Analyzing your document</h2>
          <p style={{color:"#6366F1",fontSize:"14px",fontWeight:"600",margin:"0 0 6px",animation:"pulse 1.5s ease-in-out infinite"}}>{progress}</p>
          <p style={{fontSize:"13px",color:"#94A3B8",marginBottom:"28px"}}>📄 {fileName}</p>
          <div style={{display:"flex",flexDirection:"column",gap:"7px"}}>
            {["Reading & parsing document","Identifying actors & roles","Extracting process steps","Detecting decision points","Building your flowchart"].map((s,i)=>(
              <div key={s} style={{display:"flex",alignItems:"center",gap:"12px",padding:"11px 16px",background:"#fff",borderRadius:"11px",border:"1px solid #E2E8F0"}}>
                <div style={{width:"8px",height:"8px",borderRadius:"50%",background:"#6366F1",animation:`pulse ${1+i*0.2}s ease-in-out infinite`,flexShrink:0}}/>
                <span style={{fontSize:"13px",color:"#64748B",fontWeight:"500"}}>{s}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {stage==="result"&&flowData&&<div style={{animation:"fadeIn 0.5s ease",paddingTop:"30px"}}><ResultView data={flowData}/></div>}

      {stage==="error"&&(
        <div style={{maxWidth:"420px",margin:"80px auto",textAlign:"center",padding:"0 20px"}}>
          <div style={{fontSize:"48px",marginBottom:"14px"}}>😕</div>
          <h2 style={{fontSize:"21px",fontWeight:"800",color:"#0F172A",marginBottom:"8px"}}>Something went wrong</h2>
          <div style={{background:"#FEF2F2",border:"1px solid #FECACA",borderRadius:"12px",padding:"13px 16px",fontSize:"13px",color:"#DC2626",marginBottom:"22px"}}>{errorMsg}</div>
          <div style={{display:"flex",gap:"10px",justifyContent:"center"}}>
            <button className="bpH" onClick={reset} style={{...S.btn,...S.btnP}}>Try Again</button>
            <button onClick={()=>setApiKey("")} style={{...S.btn,...S.btnS}}>Change Key</button>
          </div>
        </div>
      )}

      <div style={{textAlign:"center",padding:"18px",fontSize:"12px",color:"#CBD5E1",borderTop:"1px solid #F1F5F9",marginTop:"20px"}}>MindMap AI · Built for smart teams ✦</div>
    </div>
  );
}