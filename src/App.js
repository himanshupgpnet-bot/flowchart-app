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
.footer{text-align:center;font-size:8.5pt;color:#94A3B8;margin-top:16px;padding-top:8px;border-top:1px solid #E2E8F0}
.print-btn{position:fixed;top:16px;right:16px;background:linear-gradient(135deg,#6366F1,#8B5CF6);color:white;border:none;border-radius:10px;padding:10px 20px;font-size:13px;font-weight:700;cursor:pointer}
@media print{.print-btn{display:none}}</style></head><body>
<button class="print-btn" onclick="window.print()">🖨️ Save as PDF</button>
<div class="hdr"><h1>${data.title}</h1><p class="sum">${data.summary}</p>
<div class="acts">${actors.map((a,i)=>`<div class="act" style="color:${gc(i)};border-color:${gc(i)}55;background:${gc(i)}15">${a.emoji} ${a.name}</div>`).join("")}</div></div>
${phases.map((p,idx)=>{const ai=actors.findIndex(a=>a.id===p.actorId);const c=gc(ai);const actor=actors.find(a=>a.id===p.actorId);return`
<div class="phase" style="border-color:${c}44"><b>Step ${idx+1}: ${p.title}</b> — ${actor?.emoji} ${actor?.name}<br/>
${p.steps.map((s,i)=>`${i+1}. ${s}`).join(" | ")}<br/>✅ ${p.output}
${p.note?`<br/>⚠️ ${p.note}`:""}
${p.isDecision?`<br/>◆ ${p.decisionQuestion} → YES: ${p.decisionYes} | NO: ${p.decisionNo}`:""}</div>
${idx<phases.length-1?`<div style="text-align:center;color:#6366F1;font-size:16pt">↓</div>`:""}`}).join("")}
<div style="margin-top:14px;border:1px solid #E2E8F0;border-radius:10px;padding:13px"><b style="color:#6366F1">✦ KEY INSIGHTS</b><br/>${(data.keyInsights||[]).map(i=>`• ${i}`).join("<br/>")}</div>
<div class="footer">Generated by MindMap AI · ${new Date().toLocaleDateString()}</div>
</body></html>`;
  const w=window.open('','_blank');
  w.document.write(html);w.document.close();
  w.onload=()=>{w.focus();};
}

function doExportPPT(data) {
  const gc=(idx)=>COLORS[idx%COLORS.length];
  const phases=data.phases||[];const actors=data.actors||[];
  const slides=[
    `<div class="slide title-slide">
      <div class="tc"><div style="font-size:52px;margin-bottom:16px">🧠</div>
      <h1 style="font-size:30pt;font-weight:900;color:white;line-height:1.2;margin-bottom:12px">${data.title}</h1>
      <p style="font-size:13pt;color:rgba(255,255,255,0.8);max-width:600px;line-height:1.6;margin:0 auto 24px">${data.summary}</p>
      <div style="display:flex;gap:10px;flex-wrap:wrap;justify-content:center">
        ${actors.map((a,i)=>`<div style="background:rgba(255,255,255,0.15);border:1px solid rgba(255,255,255,0.3);border-radius:20px;padding:5px 16px;font-size:12pt;color:white;font-weight:600">${a.emoji} ${a.name}</div>`).join("")}
      </div></div>
    </div>`,
    ...phases.map((p,idx)=>{
      const ai=actors.findIndex(a=>a.id===p.actorId);const c=gc(ai);const actor=actors.find(a=>a.id===p.actorId);
      return`<div class="slide">
      <div class="sh" style="background:${c}"><h2 style="color:white">Step ${idx+1}: ${p.title}</h2></div>
      <div class="sc" style="padding:22px 34px;display:grid;grid-template-columns:1fr 1fr;gap:22px">
        <div><div style="font-size:9pt;font-weight:700;color:${c};letter-spacing:1px;margin-bottom:10px">PROCESS STEPS</div>
        ${p.steps.map((s,i)=>`<div style="display:flex;gap:9px;margin-bottom:9px"><div style="min-width:22px;height:22px;border-radius:6px;background:${c};color:white;font-size:9pt;font-weight:800;display:flex;align-items:center;justify-content:center">${i+1}</div><div style="font-size:11pt;color:#475569">${s}</div></div>`).join("")}</div>
        <div><div style="font-size:9pt;font-weight:700;color:${c};letter-spacing:1px;margin-bottom:10px">OUTPUT</div>
        <div style="background:${c}15;border:1px solid ${c}33;border-radius:11px;padding:13px;font-size:11pt">✅ ${p.output}</div>
        ${p.note?`<div style="background:#FFFBEB;border:1px solid #FDE68A;border-radius:11px;padding:11px;font-size:10pt;color:#92400E;margin-top:10px">⚠️ ${p.note}</div>`:""}</div>
      </div></div>`;
    }),
    `<div class="slide">
    <div class="sh" style="background:linear-gradient(135deg,#6366F1,#8B5CF6)"><h2 style="color:white">✦ Key Insights</h2></div>
    <div class="sc" style="padding:28px 38px">
    ${(data.keyInsights||[]).map((ins,i)=>`<div style="display:flex;gap:13px;margin-bottom:15px">
    <div style="min-width:28px;height:28px;border-radius:8px;background:linear-gradient(135deg,#6366F1,#8B5CF6);display:flex;align-items:center;justify-content:center;font-size:11pt;font-weight:800;color:white">${i+1}</div>
    <div style="font-size:12pt;color:#1E293B;line-height:1.5">${ins}</div></div>`).join("")}
    </div></div>`
  ];
  const full=`<!DOCTYPE html><html><head><meta charset="UTF-8"/><title>${data.title}</title>
<style>*{box-sizing:border-box;margin:0;padding:0}body{background:#0F172A;font-family:'Segoe UI',Arial,sans-serif;padding:20px}
.slide{width:960px;min-height:540px;background:#F8FAFF;border-radius:12px;margin:0 auto 24px;overflow:hidden;box-shadow:0 8px 40px rgba(0,0,0,0.4);display:flex;flex-direction:column;page-break-after:always}
.title-slide{background:linear-gradient(135deg,#4F46E5,#7C3AED)}.tc{display:flex;flex-direction:column;align-items:center;justify-content:center;height:100%;text-align:center;padding:40px}
.sh{background:#6366F1;padding:18px 34px;min-height:76px;display:flex;align-items:center}.sh h2{color:white;font-size:17pt;font-weight:800;margin:0}
.sc{flex:1}
@media print{body{background:white;padding:0}.slide{box-shadow:none;border-radius:0;width:100%;margin:0;page-break-after:always}}</style>
</head><body>${slides.join("")}</body></html>`;
  const b=new Blob([full],{type:"text/html"});
  const u=URL.createObjectURL(b);
  const a=document.createElement("a");a.href=u;a.download=`${data.title.replace(/\s+/g,"_")}_slides.html`;a.click();URL.revokeObjectURL(u);
}

// ── 3D GLOBAL STYLES ──────────────────────────────────────────────────────────
const CSS3D = `
  @import url('https://fonts.googleapis.com/css2?family=Syne:wght@700;800;900&family=DM+Sans:ital,wght@0,400;0,500;0,600;1,400&display=swap');

  *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }

  body { background: #ECEFFE; font-family: 'DM Sans', sans-serif; }

  .card-3d {
    background: #FFFFFF;
    border: 1.5px solid #D4D8F5;
    border-radius: 18px;
    box-shadow:
      0 1px 0 rgba(255,255,255,0.9) inset,
      0 -1px 0 rgba(79,70,229,0.06) inset,
      0 4px 0 rgba(79,70,229,0.10),
      0 8px 0 rgba(79,70,229,0.05),
      0 12px 0 rgba(79,70,229,0.02),
      0 4px 20px rgba(79,70,229,0.09),
      0 12px 40px rgba(13,15,26,0.08);
    transform: perspective(900px) rotateX(0.8deg);
    transition: transform 0.25s cubic-bezier(0.34,1.4,0.64,1), box-shadow 0.25s ease;
    position: relative;
  }
  .card-3d::before {
    content: '';
    position: absolute;
    top: 0; left: 0; right: 0;
    height: 50%;
    border-radius: 18px 18px 0 0;
    background: linear-gradient(180deg, rgba(255,255,255,0.45) 0%, transparent 100%);
    pointer-events: none;
    z-index: 1;
  }
  .card-3d:hover {
    transform: perspective(900px) rotateX(0deg) translateY(-5px);
    box-shadow:
      0 1px 0 rgba(255,255,255,0.9) inset,
      0 6px 0 rgba(79,70,229,0.14),
      0 12px 0 rgba(79,70,229,0.07),
      0 18px 0 rgba(79,70,229,0.03),
      0 8px 28px rgba(79,70,229,0.14),
      0 20px 60px rgba(13,15,26,0.12);
  }

  .btn-3d {
    position: relative;
    border: none;
    border-radius: 13px;
    font-family: 'Syne', sans-serif;
    font-weight: 800;
    font-size: 14px;
    cursor: pointer;
    transition: all 0.14s cubic-bezier(0.34,1.3,0.64,1);
    outline: none;
    letter-spacing: 0.2px;
    user-select: none;
  }
  .btn-3d-primary {
    background: linear-gradient(170deg, #7C72F5 0%, #5B52E8 40%, #3D35C0 100%);
    color: white;
    padding: 13px 28px;
    box-shadow:
      0 1px 0 rgba(255,255,255,0.22) inset,
      0 -2px 0 rgba(0,0,0,0.25) inset,
      0 4px 0 #2E28A0,
      0 7px 0 #1D1970,
      0 9px 20px rgba(79,70,229,0.45),
      0 2px 6px rgba(0,0,0,0.2);
    transform: translateY(0px);
  }
  .btn-3d-primary:hover {
    background: linear-gradient(170deg, #8B82FF 0%, #6B62F5 40%, #4D45D0 100%);
    transform: translateY(-3px);
    box-shadow:
      0 1px 0 rgba(255,255,255,0.22) inset,
      0 -2px 0 rgba(0,0,0,0.25) inset,
      0 7px 0 #2E28A0,
      0 10px 0 #1D1970,
      0 16px 32px rgba(79,70,229,0.5),
      0 4px 10px rgba(0,0,0,0.2);
  }
  .btn-3d-primary:active {
    transform: translateY(4px);
    box-shadow:
      0 1px 0 rgba(255,255,255,0.15) inset,
      0 1px 0 #2E28A0,
      0 3px 10px rgba(79,70,229,0.3);
  }
  .btn-3d-secondary {
    background: linear-gradient(170deg, #FFFFFF 0%, #F0F3FF 100%);
    color: #4B5563;
    padding: 11px 20px;
    border: 1.5px solid #C8CDF0;
    box-shadow:
      0 1px 0 rgba(255,255,255,0.95) inset,
      0 3px 0 #BFC5E8,
      0 6px 0 #A8B0D8,
      0 8px 16px rgba(13,15,26,0.10);
    transform: translateY(0px);
  }
  .btn-3d-secondary:hover {
    transform: translateY(-3px);
    box-shadow:
      0 1px 0 rgba(255,255,255,0.95) inset,
      0 6px 0 #BFC5E8,
      0 9px 0 #A8B0D8,
      0 14px 24px rgba(13,15,26,0.13);
  }
  .btn-3d-secondary:active {
    transform: translateY(3px);
    box-shadow:
      0 1px 0 rgba(255,255,255,0.9) inset,
      0 1px 0 #BFC5E8,
      0 3px 8px rgba(13,15,26,0.07);
  }

  .nav-3d {
    background: rgba(248,249,255,0.92);
    backdrop-filter: blur(28px) saturate(1.8);
    -webkit-backdrop-filter: blur(28px) saturate(1.8);
    border-bottom: 1.5px solid rgba(200,205,240,0.7);
    box-shadow:
      0 4px 24px rgba(79,70,229,0.07),
      0 1px 0 rgba(255,255,255,0.7) inset;
  }

  .phase-card {
    background: #fff;
    border-radius: 16px;
    border: 1.5px solid #E0E4F8;
    transition: all 0.22s cubic-bezier(0.34,1.3,0.64,1);
    position: relative;
    overflow: hidden;
  }
  .phase-card::before {
    content: '';
    position: absolute;
    top: 0; left: 0; right: 0; height: 1px;
    background: linear-gradient(90deg, transparent 0%, rgba(255,255,255,0.85) 50%, transparent 100%);
    pointer-events: none;
  }
  .phase-card-inactive {
    box-shadow:
      0 2px 0 rgba(79,70,229,0.07),
      0 5px 0 rgba(79,70,229,0.03),
      0 3px 14px rgba(13,15,26,0.06);
    cursor: pointer;
  }
  .phase-card-inactive:hover {
    transform: translateY(-4px) perspective(700px) rotateX(2deg);
    border-color: #B0B8F0;
    box-shadow:
      0 5px 0 rgba(79,70,229,0.11),
      0 10px 0 rgba(79,70,229,0.05),
      0 12px 32px rgba(13,15,26,0.10);
  }
  .phase-card-active {
    box-shadow:
      0 3px 0 rgba(79,70,229,0.13),
      0 6px 0 rgba(79,70,229,0.06),
      0 14px 44px rgba(79,70,229,0.11);
    border-radius: 16px 16px 0 0;
    border-bottom-color: transparent;
    cursor: pointer;
  }

  .icon-cube {
    border-radius: 13px;
    display: flex; align-items: center; justify-content: center;
    font-size: 22px;
    position: relative;
    box-shadow:
      0 1px 0 rgba(255,255,255,0.5) inset,
      0 3px 0 rgba(0,0,0,0.12),
      0 5px 10px rgba(0,0,0,0.08);
  }
  .icon-cube::after {
    content: '';
    position: absolute; inset: 0;
    border-radius: 13px;
    background: linear-gradient(135deg, rgba(255,255,255,0.35) 0%, transparent 55%);
    pointer-events: none;
  }

  .step-num {
    border-radius: 9px;
    box-shadow:
      0 1px 0 rgba(255,255,255,0.4) inset,
      0 2px 0 rgba(0,0,0,0.14),
      0 4px 8px rgba(0,0,0,0.07);
    display: flex; align-items: center; justify-content: center;
  }

  .badge-3d {
    border-radius: 20px;
    font-family: 'Syne', sans-serif;
    font-weight: 800;
    font-size: 11px;
    letter-spacing: 0.4px;
    box-shadow:
      0 1px 0 rgba(255,255,255,0.5) inset,
      0 2px 5px rgba(79,70,229,0.12);
  }

  .ground-shadow { position: relative; }
  .ground-shadow::after {
    content: '';
    position: absolute;
    bottom: -10px; left: 8%; right: 8%;
    height: 18px;
    background: radial-gradient(ellipse, rgba(79,70,229,0.13) 0%, transparent 70%);
    pointer-events: none; border-radius: 50%;
  }

  .logo-gem {
    background: linear-gradient(140deg, #818CF8 0%, #6366F1 40%, #4F46E5 70%, #3730A3 100%);
    border-radius: 12px;
    box-shadow:
      0 1px 0 rgba(255,255,255,0.3) inset,
      0 -1px 0 rgba(0,0,0,0.2) inset,
      0 3px 0 #2E28A0,
      0 6px 0 #1D1970,
      0 8px 20px rgba(79,70,229,0.5);
  }

  .input-3d {
    background: #F5F6FF;
    border: 1.5px solid #D0D5F0;
    border-radius: 12px;
    box-shadow:
      0 2px 6px rgba(13,15,26,0.07) inset,
      0 1px 0 rgba(255,255,255,0.9);
    transition: all 0.2s ease;
    font-family: 'DM Sans', sans-serif;
    color: #0D0F1A;
  }
  .input-3d:focus {
    border-color: #6366F1;
    background: #F8F9FF;
    box-shadow:
      0 2px 6px rgba(79,70,229,0.09) inset,
      0 0 0 3.5px rgba(99,102,241,0.18),
      0 1px 0 rgba(255,255,255,0.9);
    outline: none;
  }

  .export-btn {
    border-radius: 12px;
    font-family: 'Syne', sans-serif;
    font-weight: 700;
    font-size: 12px;
    cursor: pointer;
    transition: all 0.14s cubic-bezier(0.34,1.3,0.64,1);
    border: 2px solid;
    background: white;
    display: flex; align-items: center; gap: 6px;
    padding: 9px 16px;
    user-select: none;
  }
  .export-btn:hover { transform: translateY(-4px); }
  .export-btn:active { transform: translateY(2px); }

  .insight-item {
    padding: 10px 14px;
    margin-bottom: 10px;
    background: #F8F9FF;
    border-radius: 0 10px 10px 0;
    box-shadow: 0 2px 10px rgba(13,15,26,0.04), 2px 0 0 rgba(255,255,255,0.7) inset;
    transition: transform 0.2s ease;
    border-left: 3px solid;
  }
  .insight-item:hover { transform: translateX(4px); }

  @keyframes floatBob {
    0%,100% { transform: translateY(0px) rotate(-1deg); }
    50% { transform: translateY(-14px) rotate(1deg); }
  }
  @keyframes fadeSlideUp {
    from { opacity: 0; transform: translateY(22px); }
    to { opacity: 1; transform: translateY(0); }
  }
  @keyframes pulseGlow {
    0%,100% { box-shadow: 0 0 0 0 rgba(99,102,241,0.5); }
    50% { box-shadow: 0 0 0 10px rgba(99,102,241,0); }
  }
  @keyframes processingBar {
    0% { width: 5%; }
    80% { width: 85%; }
    100% { width: 95%; }
  }
`;

const S = {
  page: { minHeight:"100vh", background:"#ECEFFE", fontFamily:"'DM Sans',sans-serif", color:"#0D0F1A" },
  nav: { height:"64px", display:"flex", alignItems:"center", justifyContent:"space-between", padding:"0 32px", position:"sticky", top:0, zIndex:100 },
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
      <style>{CSS3D}</style>
      <nav className="nav-3d" style={S.nav}>
        <div style={{display:"flex",alignItems:"center",gap:"11px"}}>
          <div className="logo-gem" style={{width:"36px",height:"36px",display:"flex",alignItems:"center",justifyContent:"center",fontSize:"18px"}}>🧠</div>
          <span style={{fontFamily:"'Syne',sans-serif",fontWeight:900,fontSize:"20px",background:"linear-gradient(135deg,#4F46E5,#7C3AED)",WebkitBackgroundClip:"text",WebkitTextFillColor:"transparent"}}>MindMap AI</span>
        </div>
        <div className="badge-3d" style={{background:"#EEF2FF",border:"1px solid #C7D2FE",color:"#4F46E5",padding:"5px 14px"}}>✦ AI Powered</div>
      </nav>
      <div style={{flex:1,display:"flex",alignItems:"center",justifyContent:"center",padding:"40px 20px",background:"radial-gradient(ellipse at 35% 25%, #DDE3FF 0%, #ECEFFE 55%, #E4E8FF 100%)"}}>
        <div style={{width:"100%",maxWidth:"462px",animation:"fadeSlideUp 0.6s ease"}}>
          <div style={{textAlign:"center",marginBottom:"34px"}}>
            <div style={{fontSize:"74px",animation:"floatBob 3.5s ease-in-out infinite",display:"inline-block",marginBottom:"10px",filter:"drop-shadow(0 14px 28px rgba(79,70,229,0.32))"}}>🧠</div>
            <h1 style={{fontFamily:"'Syne',sans-serif",fontSize:"30px",fontWeight:900,color:"#0D0F1A",margin:"0 0 10px",letterSpacing:"-0.8px"}}>Welcome to MindMap AI</h1>
            <p style={{color:"#6B7280",fontSize:"14px",lineHeight:1.75,margin:0}}>Enter your AI Engine key to get started.</p>
          </div>
          <div className="card-3d" style={{padding:"28px 30px"}}>
            <div style={{fontFamily:"'Syne',sans-serif",fontSize:"10px",fontWeight:800,color:"#4F46E5",letterSpacing:"2px",marginBottom:"12px"}}>AI ENGINE KEY</div>
            <div style={{display:"flex",gap:"8px",marginBottom:"12px"}}>
              <input className="input-3d" type={show?"text":"password"} value={key} onChange={e=>{setKey(e.target.value);setError("");}} placeholder="sk-ant-api03-..." onKeyDown={e=>e.key==="Enter"&&handleSave()} style={{flex:1,padding:"12px 16px",fontSize:"14px"}}/>
              <button className="btn-3d btn-3d-secondary" onClick={()=>setShow(!show)} style={{padding:"12px 14px",fontSize:"16px"}}>{show?"🙈":"👁️"}</button>
            </div>
            {error&&<div style={{background:"#FEF2F2",border:"1.5px solid #FECACA",borderRadius:"12px",padding:"10px 14px",fontSize:"13px",color:"#DC2626",marginBottom:"14px",boxShadow:"0 3px 0 #FECACA88, 0 6px 14px rgba(220,38,38,0.1)"}}>⚠️ {error}</div>}
            <button className="btn-3d btn-3d-primary" onClick={handleSave} disabled={!key||testing} style={{width:"100%",opacity:key?1:0.5,cursor:key?"pointer":"not-allowed"}}>{testing?"⏳ Verifying...":"✦ Launch MindMap AI →"}</button>
            <div style={{marginTop:"20px",background:"#F5F6FF",borderRadius:"14px",padding:"16px",border:"1.5px solid #E0E4F8",boxShadow:"0 2px 8px rgba(13,15,26,0.04) inset"}}>
              <div style={{fontFamily:"'Syne',sans-serif",fontSize:"10px",fontWeight:800,color:"#94A3B8",letterSpacing:"1.5px",marginBottom:"12px"}}>HOW TO GET YOUR KEY</div>
              {[["1","Visit","console.anthropic.com"],["2","Sign up or log in",""],["3","API Keys → Create Key",""],["4","Copy & paste above",""]].map(([n,t,l])=>(
                <div key={n} style={{display:"flex",gap:"10px",marginBottom:"8px",alignItems:"center"}}>
                  <span className="step-num" style={{minWidth:"22px",height:"22px",background:"linear-gradient(135deg,#6366F1,#8B5CF6)",fontSize:"11px",color:"#fff",fontWeight:"700",flexShrink:0}}>{n}</span>
                  <span style={{fontSize:"13px",color:"#64748B"}}>{t} {l&&<a href={`https://${l}`} target="_blank" rel="noreferrer" style={{color:"#4F46E5",fontWeight:"600",textDecoration:"none"}}>{l}</a>}</span>
                </div>
              ))}
              <div style={{marginTop:"10px",background:"#ECFDF5",border:"1.5px solid #A7F3D0",borderRadius:"10px",padding:"8px 13px",fontSize:"12px",color:"#065F46",boxShadow:"0 2px 6px rgba(16,185,129,0.1)"}}>💡 ~$0.001 per analysis. Very affordable!</div>
            </div>
          </div>
          <p style={{textAlign:"center",fontSize:"11px",color:"#B8C0D8",marginTop:"16px",fontFamily:"'DM Sans',sans-serif"}}>🔒 Key stays in your browser session only</p>
        </div>
      </div>
    </div>
  );
}

// ── EXPORT BAR ─────────────────────────────────────────────────────────────────
function ExportBar({data}){
  const [busy,setBusy]=useState(null);
  const go=(type,fn)=>{setBusy(type);setTimeout(()=>{fn(data);setBusy(null);},200);};
  const exports=[
    {type:"html",icon:"🌐",label:"HTML",color:"#6366F1",shadow:"#312E81",fn:doExportHTML},
    {type:"word",icon:"📝",label:"Word",color:"#2563EB",shadow:"#1E40AF",fn:doExportWord},
    {type:"pdf", icon:"📄",label:"PDF", color:"#DC2626",shadow:"#991B1B",fn:doExportPDF},
    {type:"ppt", icon:"📊",label:"PPT", color:"#D97706",shadow:"#92400E",fn:doExportPPT},
  ];
  return(
    <div className="card-3d" style={{display:"inline-block",padding:"18px 24px",textAlign:"center"}}>
      <div style={{fontFamily:"'Syne',sans-serif",fontSize:"10px",fontWeight:800,color:"#94A3B8",letterSpacing:"1.5px",marginBottom:"14px"}}>📥 EXPORT AS</div>
      <div style={{display:"flex",gap:"8px",flexWrap:"wrap",justifyContent:"center"}}>
        {exports.map(({type,icon,label,color,shadow,fn})=>(
          <button key={type} className="export-btn" onClick={()=>go(type,fn)} disabled={!!busy}
            style={{color:busy===type?"white":color,borderColor:`${color}55`,background:busy===type?color:"white",
              boxShadow:`0 3px 0 ${shadow}55, 0 6px 14px ${color}22`}}>
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
    <div style={{maxWidth:"880px",margin:"0 auto",padding:"0 20px 80px"}}>
      <div style={{textAlign:"center",marginBottom:"32px"}}>
        <div style={{display:"inline-flex",alignItems:"center",gap:"6px",background:"#ECFDF5",border:"1.5px solid #A7F3D0",borderRadius:"20px",padding:"5px 16px",fontSize:"12px",color:"#065F46",fontWeight:"600",marginBottom:"16px",boxShadow:"0 3px 0 #A7F3D088, 0 5px 14px rgba(16,185,129,0.14)"}}>✅ Analysis Complete</div>
        <h2 style={{fontFamily:"'Syne',sans-serif",fontSize:"clamp(22px,3vw,30px)",fontWeight:900,color:"#0D0F1A",margin:"0 0 10px",letterSpacing:"-0.6px"}}>{data.title}</h2>
        <p style={{color:"#6B7280",fontSize:"14px",margin:"0 0 20px",lineHeight:1.65}}>{data.summary}</p>
        <div style={{display:"flex",gap:"8px",justifyContent:"center",flexWrap:"wrap",marginBottom:"24px"}}>
          {(data.actors||[]).map((a,i)=>(
            <div key={a.id} className="badge-3d" style={{display:"flex",alignItems:"center",gap:"6px",background:`${COLORS[i%COLORS.length]}12`,border:`1.5px solid ${COLORS[i%COLORS.length]}33`,color:COLORS[i%COLORS.length],padding:"6px 15px"}}>{a.emoji} {a.name}</div>
          ))}
        </div>
        <ExportBar data={data}/>
      </div>

      <div style={{display:"flex",flexDirection:"column"}}>
        {(data.phases||[]).map((phase,index)=>{
          const color=gc(phase.actorId);const actor=ga(phase.actorId);const isA=active===phase.id;
          return(
            <div key={phase.id} style={{display:"flex",flexDirection:"column",alignItems:"center"}}>
              <div
                className={`phase-card ${isA?"phase-card-active":"phase-card-inactive ground-shadow"}`}
                style={{width:"100%",borderColor:isA?`${color}66`:"#E0E4F8",
                  boxShadow:isA
                    ?`0 3px 0 ${color}22, 0 7px 0 ${color}10, 0 14px 44px ${color}14`
                    :`0 3px 0 ${color}14, 0 6px 0 ${color}08, 0 4px 18px rgba(13,15,26,0.07)`}}
                onClick={()=>setActive(isA?null:phase.id)}>
                <div style={{padding:"17px 22px",display:"flex",alignItems:"center",gap:"15px"}}>
                  <div className="icon-cube" style={{minWidth:"50px",height:"50px",background:`linear-gradient(140deg, ${color}1A, ${color}3A)`,border:`1.5px solid ${color}2E`}}>{phase.icon}</div>
                  <div style={{flex:1}}>
                    <div style={{fontFamily:"'Syne',sans-serif",fontSize:"15px",fontWeight:800,color:"#0D0F1A",marginBottom:"3px",letterSpacing:"-0.2px"}}>{phase.title}</div>
                    <div style={{fontSize:"12px",color,fontWeight:"600"}}>{actor?.emoji} {actor?.name}</div>
                  </div>
                  <div className="step-num badge-3d" style={{background:`${color}14`,border:`1.5px solid ${color}30`,color,padding:"4px 12px",fontSize:"10px",letterSpacing:"1px"}}>STEP {index+1}</div>
                  <div style={{color,fontSize:"24px",fontWeight:"bold",transition:"transform 0.25s cubic-bezier(0.34,1.3,0.64,1)",transform:isA?"rotate(90deg)":"rotate(0deg)"}}>›</div>
                </div>
              </div>

              {isA&&(
                <div style={{width:"100%",background:"linear-gradient(180deg,#FAFBFF 0%,#F2F4FF 100%)",border:`1.5px solid ${color}44`,borderTop:"none",borderRadius:"0 0 16px 16px",padding:"20px 24px 26px",
                  boxShadow:`0 6px 0 ${color}14, 0 12px 0 ${color}08, 0 14px 40px ${color}10`}}>
                  <p style={{fontSize:"13px",color:"#64748B",margin:"0 0 20px",lineHeight:1.65,fontStyle:"italic",borderLeft:`3px solid ${color}55`,paddingLeft:"14px",background:`${color}07`,borderRadius:"0 9px 9px 0",padding:"11px 15px"}}>{phase.description}</p>
                  <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:"24px"}}>
                    <div>
                      <div style={{fontFamily:"'Syne',sans-serif",fontSize:"10px",fontWeight:800,color,letterSpacing:"1.5px",marginBottom:"12px"}}>PROCESS STEPS</div>
                      {phase.steps.map((step,i)=>(
                        <div key={i} style={{display:"flex",gap:"10px",marginBottom:"10px",alignItems:"flex-start"}}>
                          <span className="step-num" style={{minWidth:"22px",height:"22px",background:`linear-gradient(135deg,${color}1E,${color}38)`,border:`1.5px solid ${color}2E`,fontSize:"11px",color,fontWeight:"800",marginTop:"1px",flexShrink:0}}>{i+1}</span>
                          <span style={{fontSize:"13px",color:"#4B5563",lineHeight:1.55}}>{step}</span>
                        </div>
                      ))}
                      {phase.isDecision&&(
                        <div style={{marginTop:"14px",background:"#FFFBEB",border:"1.5px solid #FDE68A",borderRadius:"12px",padding:"13px 15px",fontSize:"12px",boxShadow:"0 3px 0 #FDE68A99, 0 6px 14px rgba(245,158,11,0.1)"}}>
                          <div style={{fontFamily:"'Syne',sans-serif",fontWeight:800,color:"#92400E",marginBottom:"7px"}}>◆ {phase.decisionQuestion}</div>
                          <div style={{color:"#065F46",marginBottom:"4px"}}>✅ YES → {phase.decisionYes}</div>
                          <div style={{color:"#DC2626"}}>❌ NO → {phase.decisionNo}</div>
                        </div>
                      )}
                    </div>
                    <div>
                      <div style={{fontFamily:"'Syne',sans-serif",fontSize:"10px",fontWeight:800,color,letterSpacing:"1.5px",marginBottom:"12px"}}>OUTPUT</div>
                      <div style={{background:`${color}10`,border:`1.5px solid ${color}2E`,borderRadius:"13px",padding:"13px 16px",fontSize:"13px",color:"#1E293B",marginBottom:"14px",lineHeight:1.55,
                        boxShadow:`0 3px 0 ${color}1E, 0 6px 16px ${color}0c`}}>✅ {phase.output}</div>
                      {phase.note&&<div style={{background:"#FFFBEB",border:"1.5px solid #FDE68A",borderRadius:"13px",padding:"11px 14px",fontSize:"12px",color:"#92400E",lineHeight:1.5,boxShadow:"0 3px 0 #FDE68A88"}}>⚠️ {phase.note}</div>}
                    </div>
                  </div>
                </div>
              )}

              {index<data.phases.length-1&&(
                <div style={{display:"flex",flexDirection:"column",alignItems:"center",height:"34px",margin:"2px 0"}}>
                  <div style={{width:"2px",flex:1,background:`linear-gradient(180deg, ${color}99, ${gc(data.phases[index+1].actorId)}99)`}}/>
                  <div style={{width:0,height:0,borderLeft:"6px solid transparent",borderRight:"6px solid transparent",borderTop:`8px solid ${gc(data.phases[index+1].actorId)}cc`,filter:`drop-shadow(0 2px 3px ${gc(data.phases[index+1].actorId)}44)`}}/>
                </div>
              )}
            </div>
          );
        })}
      </div>

      {data.keyInsights?.length>0&&(
        <div className="card-3d" style={{padding:"22px 24px",marginTop:"30px"}}>
          <div style={{fontFamily:"'Syne',sans-serif",fontSize:"10px",fontWeight:800,color:"#4F46E5",letterSpacing:"1.5px",marginBottom:"18px"}}>✦ KEY INSIGHTS</div>
          {data.keyInsights.map((ins,i)=>(
            <div key={i} className="insight-item" style={{borderLeftColor:COLORS[i%COLORS.length]}}>
              <span style={{fontSize:"13px",color:"#4B5563",lineHeight:1.65}}>{ins}</span>
            </div>
          ))}
        </div>
      )}
      <div style={{textAlign:"center",marginTop:"32px"}}><ExportBar data={data}/></div>
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
      <style>{CSS3D}</style>
      <nav className="nav-3d" style={S.nav}>
        <div style={{display:"flex",alignItems:"center",gap:"11px"}}>
          <div className="logo-gem" style={{width:"36px",height:"36px",display:"flex",alignItems:"center",justifyContent:"center",fontSize:"18px"}}>🧠</div>
          <span style={{fontFamily:"'Syne',sans-serif",fontWeight:900,fontSize:"20px",background:"linear-gradient(135deg,#4F46E5,#7C3AED)",WebkitBackgroundClip:"text",WebkitTextFillColor:"transparent"}}>MindMap AI</span>
        </div>
        <div style={{display:"flex",alignItems:"center",gap:"10px"}}>
          {stage==="result"&&<button className="btn-3d btn-3d-secondary" onClick={reset} style={{padding:"8px 18px",fontSize:"13px"}}>← New</button>}
          <button onClick={()=>setApiKey("")} style={{background:"transparent",border:"none",color:"#94A3B8",fontSize:"12px",cursor:"pointer",padding:"8px",fontFamily:"'DM Sans',sans-serif"}}>🔑 Key</button>
          <div className="badge-3d" style={{background:"#EEF2FF",border:"1px solid #C7D2FE",color:"#4F46E5",padding:"5px 14px"}}>✦ AI Ready</div>
        </div>
      </nav>

      {stage==="upload"&&(
        <div style={{maxWidth:"660px",margin:"0 auto",padding:"48px 20px",animation:"fadeSlideUp 0.5s ease"}}>
          <div style={{textAlign:"center",marginBottom:"38px"}}>
            <div className="badge-3d" style={{display:"inline-flex",alignItems:"center",gap:"6px",background:"#EEF2FF",border:"1px solid #C7D2FE",color:"#4F46E5",padding:"5px 16px",marginBottom:"18px"}}>✦ Export to Word · PDF · PowerPoint</div>
            <h1 style={{fontFamily:"'Syne',sans-serif",fontSize:"clamp(27px,4vw,44px)",fontWeight:900,color:"#0D0F1A",margin:"0 0 14px",lineHeight:1.06,letterSpacing:"-1.2px"}}>
              Turn transcripts into{" "}
              <span style={{background:"linear-gradient(135deg,#4F46E5,#7C3AED)",WebkitBackgroundClip:"text",WebkitTextFillColor:"transparent"}}>professional docs</span>
            </h1>
            <p style={{color:"#6B7280",fontSize:"14px",lineHeight:1.75,margin:"0 auto",maxWidth:"440px"}}>Upload any meeting transcript or SOP — get an interactive flowchart you can export to Word, PDF, or PowerPoint.</p>
          </div>

          <div className="ground-shadow" style={{marginBottom:"14px"}}>
            <div
              onDragOver={e=>{e.preventDefault();setDragOver(true);}}
              onDragLeave={()=>setDragOver(false)}
              onDrop={handleDrop}
              onClick={()=>fileRef.current?.click()}
              style={{
                background:dragOver?"#EEF2FF":"#FFFFFF",
                border:`2.5px dashed ${dragOver?"#4F46E5":"#C0C6F0"}`,
                borderRadius:"22px",textAlign:"center",cursor:"pointer",padding:"52px 32px",
                transition:"all 0.2s cubic-bezier(0.34,1.3,0.64,1)",
                boxShadow:dragOver
                  ?"0 6px 0 #2E28A0, 0 10px 0 #1D1970, 0 16px 48px rgba(79,70,229,0.28), 0 0 0 4px rgba(99,102,241,0.18)"
                  :"0 3px 0 rgba(79,70,229,0.10), 0 7px 0 rgba(79,70,229,0.05), 0 4px 22px rgba(13,15,26,0.07)",
                transform:dragOver?"translateY(-5px) perspective(800px) rotateX(2deg)":"translateY(0) perspective(800px) rotateX(0.5deg)",
                position:"relative",overflow:"hidden",
              }}>
              <div style={{position:"absolute",top:0,left:0,right:0,height:"50%",background:"linear-gradient(180deg,rgba(255,255,255,0.5) 0%,transparent 100%)",pointerEvents:"none",borderRadius:"22px 22px 0 0"}}/>
              <div style={{fontSize:"50px",marginBottom:"15px",filter:"drop-shadow(0 8px 16px rgba(79,70,229,0.22))"}}>📂</div>
              <div style={{fontFamily:"'Syne',sans-serif",fontSize:"18px",fontWeight:800,color:"#0D0F1A",marginBottom:"6px",letterSpacing:"-0.3px"}}>Drop your file here</div>
              <div style={{fontSize:"13px",color:"#94A3B8",marginBottom:"18px",fontFamily:"'DM Sans',sans-serif"}}>or click to browse</div>
              <div style={{display:"flex",gap:"8px",justifyContent:"center",flexWrap:"wrap"}}>
                {[".TXT",".MD",".CSV",".DOCX",".PDF"].map(e=>(
                  <span key={e} className="badge-3d" style={{background:"#EEF2FF",color:"#4F46E5",padding:"4px 12px"}}>{e}</span>
                ))}
              </div>
            </div>
          </div>
          <input ref={fileRef} type="file" accept=".txt,.md,.csv,.pdf,.docx,.doc" onChange={handleFile} style={{display:"none"}}/>

          <div style={{display:"flex",alignItems:"center",gap:"14px",margin:"22px 0"}}>
            <div style={{flex:1,height:"1px",background:"linear-gradient(90deg,transparent,#C8CDF0)"}}/>
            <span style={{fontFamily:"'Syne',sans-serif",color:"#94A3B8",fontSize:"10px",fontWeight:800,letterSpacing:"2px"}}>OR PASTE TEXT</span>
            <div style={{flex:1,height:"1px",background:"linear-gradient(90deg,#C8CDF0,transparent)"}}/>
          </div>

          <div className="card-3d" style={{padding:0,overflow:"hidden",marginBottom:"26px"}}>
            <div onClick={()=>setShowPaste(true)} style={{padding:"17px 24px",display:"flex",alignItems:"center",justifyContent:"space-between",cursor:"pointer",borderBottom:showPaste?"1.5px solid #E0E4F8":"none"}}>
              <div style={{display:"flex",alignItems:"center",gap:"14px"}}>
                <span style={{fontSize:"24px",filter:"drop-shadow(0 4px 8px rgba(79,70,229,0.18))"}}>📋</span>
                <div>
                  <div style={{fontFamily:"'Syne',sans-serif",fontSize:"14px",fontWeight:700,color:"#0D0F1A",letterSpacing:"-0.2px"}}>Paste transcript or text</div>
                  <div style={{fontSize:"12px",color:"#94A3B8",fontFamily:"'DM Sans',sans-serif"}}>Meeting notes, SOPs, chat exports...</div>
                </div>
              </div>
              <div style={{color:"#4F46E5",fontSize:"24px",fontWeight:"bold",transform:showPaste?"rotate(90deg)":"rotate(0deg)",transition:"transform 0.22s cubic-bezier(0.34,1.3,0.64,1)"}}>›</div>
            </div>
            {showPaste&&(
              <div style={{padding:"16px 24px 22px"}}>
                <textarea className="input-3d" value={pasteText} onChange={e=>setPasteText(e.target.value)} autoFocus placeholder="Paste your content here..." style={{width:"100%",minHeight:"150px",resize:"vertical",lineHeight:1.65,padding:"13px 15px",fontSize:"14px"}}/>
                <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginTop:"13px"}}>
                  <span style={{fontFamily:"'Syne',sans-serif",fontSize:"11px",fontWeight:700,color:pasteText.length<50?"#94A3B8":"#10B981"}}>{pasteText.length<50?`${pasteText.length}/50 min`:`✅ ${pasteText.length} chars`}</span>
                  <div style={{display:"flex",gap:"8px"}}>
                    <button className="btn-3d btn-3d-secondary" onClick={()=>{setPasteText("");setShowPaste(false);}} style={{padding:"8px 16px",fontSize:"13px"}}>Clear</button>
                    <button className="btn-3d btn-3d-primary" onClick={()=>pasteText.trim().length>=50&&run(pasteText,"Pasted text")} disabled={pasteText.trim().length<50} style={{padding:"8px 20px",fontSize:"13px",opacity:pasteText.trim().length>=50?1:0.5,cursor:pasteText.trim().length>=50?"pointer":"not-allowed"}}>✦ Analyze</button>
                  </div>
                </div>
              </div>
            )}
          </div>

          <div style={{display:"flex",gap:"8px",justifyContent:"center",flexWrap:"wrap"}}>
            {[["⚡","AI Analysis"],["📝","Word Doc"],["📄","PDF"],["📊","PowerPoint"],["🌐","HTML"]].map(([icon,label])=>(
              <div key={label} className="badge-3d" style={{display:"flex",alignItems:"center",gap:"5px",background:"#fff",border:"1.5px solid #E0E4F8",color:"#64748B",padding:"6px 14px",fontSize:"12px"}}><span>{icon}</span><span style={{fontFamily:"'DM Sans',sans-serif"}}>{label}</span></div>
            ))}
          </div>
        </div>
      )}

      {stage==="processing"&&(
        <div style={{maxWidth:"480px",margin:"80px auto",textAlign:"center",padding:"0 20px",animation:"fadeSlideUp 0.4s ease"}}>
          <div style={{
            width:"88px",height:"88px",borderRadius:"26px",
            background:"linear-gradient(140deg,#818CF8 0%,#6366F1 40%,#4338CA 80%,#3730A3 100%)",
            display:"flex",alignItems:"center",justifyContent:"center",
            fontSize:"40px",margin:"0 auto 26px",
            animation:"floatBob 2s ease-in-out infinite",
            boxShadow:"0 4px 0 #2E28A0, 0 8px 0 #1D1970, 0 12px 0 #12115088, 0 16px 44px rgba(79,70,229,0.55)",
          }}>🧠</div>
          <h2 style={{fontFamily:"'Syne',sans-serif",fontSize:"23px",fontWeight:900,color:"#0D0F1A",margin:"0 0 8px",letterSpacing:"-0.4px"}}>Analyzing your document</h2>
          <p style={{color:"#4F46E5",fontFamily:"'Syne',sans-serif",fontSize:"13px",fontWeight:700,margin:"0 0 6px",letterSpacing:"0.3px"}}>{progress}</p>
          <p style={{fontSize:"13px",color:"#94A3B8",marginBottom:"32px",fontFamily:"'DM Sans',sans-serif"}}>📄 {fileName}</p>
          <div style={{display:"flex",flexDirection:"column",gap:"9px"}}>
            {["Reading & parsing document","Identifying actors & roles","Extracting process steps","Detecting decision points","Building your flowchart"].map((s,i)=>(
              <div key={s} className="card-3d" style={{display:"flex",alignItems:"center",gap:"14px",padding:"13px 20px"}}>
                <div style={{width:"9px",height:"9px",borderRadius:"50%",background:"linear-gradient(135deg,#6366F1,#8B5CF6)",animation:`pulseGlow ${1+i*0.15}s ease-in-out infinite`,flexShrink:0,boxShadow:"0 2px 6px rgba(99,102,241,0.4)"}}/>
                <span style={{fontSize:"13px",color:"#4B5563",fontFamily:"'DM Sans',sans-serif"}}>{s}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {stage==="result"&&flowData&&<div style={{animation:"fadeSlideUp 0.5s ease",paddingTop:"34px"}}><ResultView data={flowData}/></div>}

      {stage==="error"&&(
        <div style={{maxWidth:"440px",margin:"80px auto",textAlign:"center",padding:"0 20px",animation:"fadeSlideUp 0.4s ease"}}>
          <div style={{fontSize:"54px",marginBottom:"18px",filter:"drop-shadow(0 8px 16px rgba(220,38,38,0.22))"}}>😕</div>
          <h2 style={{fontFamily:"'Syne',sans-serif",fontSize:"23px",fontWeight:900,color:"#0D0F1A",marginBottom:"12px",letterSpacing:"-0.4px"}}>Something went wrong</h2>
          <div className="card-3d" style={{background:"#FEF2F2",border:"1.5px solid #FECACA",padding:"15px 20px",fontSize:"13px",color:"#DC2626",marginBottom:"26px",boxShadow:"0 4px 0 #FECACA99, 0 8px 20px rgba(220,38,38,0.12)"}}>{errorMsg}</div>
          <div style={{display:"flex",gap:"10px",justifyContent:"center"}}>
            <button className="btn-3d btn-3d-primary" onClick={reset}>Try Again</button>
            <button className="btn-3d btn-3d-secondary" onClick={()=>setApiKey("")}>Change Key</button>
          </div>
        </div>
      )}

      <div style={{textAlign:"center",padding:"22px",fontFamily:"'DM Sans',sans-serif",fontSize:"12px",color:"#B0B8D8",borderTop:"1px solid #E0E4F8",marginTop:"20px"}}>MindMap AI · Built for smart teams ✦</div>
    </div>
  );
}