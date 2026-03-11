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
// ── SVG FLOWCHART ENGINE ──────────────────────────────────════════════════════
// ══════════════════════════════════════════════════════════════════════════════

const NODE_W = 200;
const NODE_H = 56;
const DEC_W  = 180;
const DEC_H  = 64;
const PILL_W = 120;
const PILL_H = 40;
const LEVEL_GAP = 100;
const BRANCH_GAP = 260;

function layoutGraph(nodes, edges) {
  if (!nodes?.length) return { positioned: [], svgEdges: [], width: 400, height: 400 };

  // Build adjacency
  const children = {};
  const parents  = {};
  nodes.forEach(n => { children[n.id] = []; parents[n.id] = []; });
  edges.forEach(e => {
    if (children[e.from]) children[e.from].push({ to: e.to, label: e.label || "" });
    if (parents[e.to])  parents[e.to].push(e.from);
  });

  // BFS levels
  const levels = {};
  const startNode = nodes.find(n => n.type === "start") || nodes[0];
  const queue = [{ id: startNode.id, level: 0 }];
  const visited = new Set();
  while (queue.length) {
    const { id, level } = queue.shift();
    if (visited.has(id)) continue;
    visited.add(id);
    levels[id] = level;
    (children[id] || []).forEach(c => {
      if (!visited.has(c.to)) queue.push({ id: c.to, level: level + 1 });
    });
  }
  // Assign unvisited
  nodes.forEach(n => { if (levels[n.id] === undefined) levels[n.id] = 0; });

  // Group by level
  const byLevel = {};
  nodes.forEach(n => {
    const l = levels[n.id];
    if (!byLevel[l]) byLevel[l] = [];
    byLevel[l].push(n);
  });

  const maxLevel = Math.max(...Object.keys(byLevel).map(Number));
  const positions = {};
  let totalHeight = 60;

  for (let l = 0; l <= maxLevel; l++) {
    const group = byLevel[l] || [];
    const totalWidth = group.length * BRANCH_GAP;
    const startX = totalWidth / 2 - BRANCH_GAP / 2;
    group.forEach((n, i) => {
      const x = (group.length === 1) ? 0 : (i * BRANCH_GAP) - startX;
      positions[n.id] = { x, y: totalHeight };
    });
    const levelH = group.some(n => n.type === "decision") ? DEC_H : NODE_H;
    totalHeight += levelH + LEVEL_GAP;
  }

  // Normalize x to be positive
  const allX = Object.values(positions).map(p => p.x);
  const minX = Math.min(...allX);
  const maxX = Math.max(...allX);
  const offsetX = -minX + 60;
  Object.keys(positions).forEach(id => { positions[id].x += offsetX; });

  const svgWidth  = (maxX - minX) + NODE_W + 120;
  const svgHeight = totalHeight + 40;

  const positioned = nodes.map(n => ({ ...n, ...positions[n.id] }));

  // Build SVG edges
  const svgEdges = edges.map(e => {
    const from = positions[e.from];
    const to   = positions[e.to];
    const fNode = nodes.find(n => n.id === e.from);
    const tNode = nodes.find(n => n.id === e.to);
    if (!from || !to) return null;

    const fw = fNode?.type === "decision" ? DEC_W : fNode?.type === "start" || fNode?.type === "end" ? PILL_W : NODE_W;
    const fh = fNode?.type === "decision" ? DEC_H : NODE_H;
    const th = tNode?.type === "decision" ? DEC_H : NODE_H;

    // source point — from bottom of source node
    const sx = from.x + fw / 2;
    const sy = from.y + fh;
    // target point — into top of target node
    const tx = to.x + (tNode?.type === "decision" ? DEC_W : tNode?.type === "start" || tNode?.type === "end" ? PILL_W : NODE_W) / 2;
    const ty = to.y;

    // curved path
    const dy = Math.abs(ty - sy);
    const dx = Math.abs(tx - sx);
    let d;
    if (dx < 10) {
      // straight vertical
      d = `M${sx},${sy} C${sx},${sy+dy*0.4} ${tx},${ty-dy*0.4} ${tx},${ty}`;
    } else {
      // branch
      const midY = sy + LEVEL_GAP * 0.5;
      d = `M${sx},${sy} L${sx},${midY} L${tx},${midY} L${tx},${ty}`;
    }

    return { d, label: e.label, lx: (sx+tx)/2, ly: (sy+ty)/2, key:`${e.from}-${e.to}` };
  }).filter(Boolean);

  return { positioned, svgEdges, width: Math.max(svgWidth, 340), height: svgHeight };
}

function FlowchartSVG({ data, onNodeClick, activeNode }) {
  const { positioned, svgEdges, width, height } = useMemo(
    () => layoutGraph(data.nodes, data.edges),
    [data]
  );

  const actorColor = (actorId) => {
    const idx = data.actors?.findIndex(a => a.id === actorId) ?? 0;
    return COLORS[idx % COLORS.length];
  };

  return (
    <div style={{ overflowX:"auto", overflowY:"auto", maxHeight:"calc(100vh - 280px)", padding:"20px" }}>
      <svg width={width} height={height} style={{ display:"block", margin:"0 auto" }}>
        <defs>
          <marker id="arrow" markerWidth="10" markerHeight="7" refX="9" refY="3.5" orient="auto">
            <polygon points="0 0, 10 3.5, 0 7" fill="#6366F1" opacity="0.7"/>
          </marker>
          <marker id="arrow-yes" markerWidth="10" markerHeight="7" refX="9" refY="3.5" orient="auto">
            <polygon points="0 0, 10 3.5, 0 7" fill="#10B981"/>
          </marker>
          <marker id="arrow-no" markerWidth="10" markerHeight="7" refX="9" refY="3.5" orient="auto">
            <polygon points="0 0, 10 3.5, 0 7" fill="#EF4444"/>
          </marker>
          <filter id="shadow">
            <feDropShadow dx="0" dy="2" stdDeviation="3" floodColor="#6366F1" floodOpacity="0.12"/>
          </filter>
          <filter id="shadow-active">
            <feDropShadow dx="0" dy="4" stdDeviation="8" floodColor="#6366F1" floodOpacity="0.35"/>
          </filter>
        </defs>

        {/* Edges */}
        {svgEdges.map(e => {
          const isYes = e.label?.toUpperCase() === "YES";
          const isNo  = e.label?.toUpperCase() === "NO";
          const color = isYes ? "#10B981" : isNo ? "#EF4444" : "#6366F1";
          const markerId = isYes ? "arrow-yes" : isNo ? "arrow-no" : "arrow";
          return (
            <g key={e.key}>
              <path d={e.d} fill="none" stroke={color} strokeWidth={isYes||isNo?2:1.5}
                strokeDasharray={isNo?"6,3":undefined}
                markerEnd={`url(#${markerId})`} opacity={0.7}/>
              {e.label && (
                <>
                  <rect x={e.lx-24} y={e.ly-11} width={48} height={20} rx={10}
                    fill={isYes?"#ECFDF5":isNo?"#FEF2F2":"#EEF2FF"}
                    stroke={color} strokeWidth={1} opacity={0.95}/>
                  <text x={e.lx} y={e.ly+4} textAnchor="middle"
                    fill={isYes?"#065F46":isNo?"#991B1B":"#4F46E5"}
                    fontSize={10} fontWeight="700" fontFamily="system-ui">
                    {e.label}
                  </text>
                </>
              )}
            </g>
          );
        })}

        {/* Nodes */}
        {positioned.map(node => {
          const isActive = activeNode === node.id;
          const color = node.type === "decision" ? "#F59E0B"
            : node.type === "start" ? "#6366F1"
            : node.type === "end" ? "#10B981"
            : actorColor(node.actorId);

          if (node.type === "start" || node.type === "end") {
            const bg = node.type === "start" ? "#4F46E5" : "#10B981";
            return (
              <g key={node.id} style={{ cursor:"default" }}>
                <rect x={node.x} y={node.y} width={PILL_W} height={PILL_H} rx={PILL_H/2}
                  fill={bg} filter="url(#shadow)"
                  stroke="white" strokeWidth={2}/>
                <text x={node.x+PILL_W/2} y={node.y+PILL_H/2+5}
                  textAnchor="middle" fill="white" fontSize={13} fontWeight="700" fontFamily="system-ui">
                  {node.label || (node.type === "start" ? "Start" : "End")}
                </text>
              </g>
            );
          }

          if (node.type === "decision") {
            const cx = node.x + DEC_W/2;
            const cy = node.y + DEC_H/2;
            const hw = DEC_W/2 - 4;
            const hh = DEC_H/2 - 4;
            const pts = `${cx},${cy-hh} ${cx+hw},${cy} ${cx},${cy+hh} ${cx-hw},${cy}`;
            return (
              <g key={node.id} onClick={() => onNodeClick(node.id)}
                style={{ cursor:"pointer" }}>
                <polygon points={pts} fill="#FFFBEB"
                  stroke={isActive?"#F59E0B":"#FDE68A"} strokeWidth={isActive?2.5:2}
                  filter={isActive?"url(#shadow-active)":"url(#shadow)"}/>
                <text x={cx} y={cy-6} textAnchor="middle"
                  fill="#92400E" fontSize={11} fontWeight="700" fontFamily="system-ui">
                  {node.label}
                </text>
                <text x={cx} y={cy+8} textAnchor="middle"
                  fill="#B45309" fontSize={9} fontFamily="system-ui">
                  {node.question?.substring(0,28)}
                </text>
              </g>
            );
          }

          // Process node
          const actor = data.actors?.find(a => a.id === node.actorId);
          return (
            <g key={node.id} onClick={() => onNodeClick(node.id)} style={{ cursor:"pointer" }}>
              {/* Shadow rect */}
              <rect x={node.x+2} y={node.y+3} width={NODE_W} height={NODE_H} rx={10}
                fill={color} opacity={0.08}/>
              {/* Main rect */}
              <rect x={node.x} y={node.y} width={NODE_W} height={NODE_H} rx={10}
                fill="white"
                stroke={isActive ? color : `${color}55`}
                strokeWidth={isActive ? 2.5 : 1.5}
                filter={isActive?"url(#shadow-active)":"url(#shadow)"}/>
              {/* Top color bar */}
              <rect x={node.x} y={node.y} width={NODE_W} height={4} rx={2}
                fill={`url(#grad-${node.id})`}/>
              <defs>
                <linearGradient id={`grad-${node.id}`} x1="0%" y1="0%" x2="100%" y2="0%">
                  <stop offset="0%" stopColor={color}/>
                  <stop offset="100%" stopColor={`${color}55`}/>
                </linearGradient>
              </defs>
              {/* Icon circle */}
              <circle cx={node.x+26} cy={node.y+NODE_H/2} r={14}
                fill={`${color}14`} stroke={`${color}30`} strokeWidth={1}/>
              <text x={node.x+26} y={node.y+NODE_H/2+5}
                textAnchor="middle" fontSize={14}>
                {node.icon || "📋"}
              </text>
              {/* Title */}
              <text x={node.x+46} y={node.y+22}
                fill="#0F172A" fontSize={12} fontWeight="700" fontFamily="system-ui">
                {node.label?.substring(0,22)}
              </text>
              {/* Actor */}
              <text x={node.x+46} y={node.y+38}
                fill={color} fontSize={10} fontFamily="system-ui" fontWeight="600">
                {actor ? `${actor.emoji} ${actor.name}` : ""}
              </text>
              {/* Step badge */}
              <rect x={node.x+NODE_W-34} y={node.y+8} width={26} height={16} rx={4}
                fill={color}/>
              <text x={node.x+NODE_W-21} y={node.y+20}
                textAnchor="middle" fill="white" fontSize={9} fontWeight="700" fontFamily="system-ui">
                {String(positioned.filter(p=>p.type==="process").indexOf(node)+1).padStart(2,"0")}
              </text>
            </g>
          );
        })}
      </svg>
    </div>
  );
}

// ── NODE DETAIL PANEL ─────────────────────────────────────────────────────────
function NodeDetail({ node, actors, onClose }) {
  if (!node || node.type === "start" || node.type === "end") return null;
  const actor = actors?.find(a => a.id === node.actorId);
  const color = node.type === "decision" ? "#F59E0B" : "#6366F1";

  return (
    <div style={{ position:"fixed", bottom:24, right:24, width:320, background:"white", border:`2px solid ${color}33`, borderRadius:16, boxShadow:"0 12px 40px rgba(99,102,241,0.18)", zIndex:200, animation:"slideUp 0.25s cubic-bezier(0.34,1.3,0.64,1) both", overflow:"hidden" }}>
      <div style={{ height:3, background:`linear-gradient(90deg,${color},${color}55)` }}/>
      <div style={{ padding:"16px 18px" }}>
        <div style={{ display:"flex", alignItems:"flex-start", justifyContent:"space-between", marginBottom:"12px" }}>
          <div>
            <div style={{ fontSize:"14px", fontWeight:700, marginBottom:"3px" }}>{node.label}</div>
            {actor && <div style={{ fontSize:"11px", color, fontWeight:600 }}>{actor.emoji} {actor.name}</div>}
          </div>
          <button onClick={onClose} style={{ background:"none", border:"none", cursor:"pointer", fontSize:"18px", color:"#94A3B8", padding:"0 2px", lineHeight:1 }}>×</button>
        </div>

        {node.description && <p style={{ fontSize:"12px", color:"#475569", lineHeight:1.6, marginBottom:"12px", fontStyle:"italic", padding:"8px 10px", background:"#F8F9FF", borderRadius:"6px" }}>{node.description}</p>}

        {node.type === "decision" && (
          <div style={{ display:"flex", gap:"8px", marginBottom:"12px" }}>
            <div style={{ flex:1, background:"#ECFDF5", border:"1px solid #A7F3D0", borderRadius:"8px", padding:"8px", fontSize:"11px", color:"#065F46" }}>✅ YES<br/>{node.yes}</div>
            <div style={{ flex:1, background:"#FEF2F2", border:"1px solid #FECACA", borderRadius:"8px", padding:"8px", fontSize:"11px", color:"#991B1B" }}>❌ NO<br/>{node.no}</div>
          </div>
        )}

        {node.steps?.length > 0 && (
          <div style={{ marginBottom:"10px" }}>
            <div style={{ fontSize:"9px", fontWeight:700, letterSpacing:"1.5px", color:"#94A3B8", textTransform:"uppercase", marginBottom:"7px" }}>Steps</div>
            {node.steps.map((s,i) => (
              <div key={i} style={{ display:"flex", gap:"7px", marginBottom:"6px" }}>
                <span style={{ minWidth:"18px", height:"18px", borderRadius:"4px", background:`${color}15`, border:`1px solid ${color}28`, display:"flex", alignItems:"center", justifyContent:"center", fontSize:"8px", fontWeight:700, color, flexShrink:0 }}>{i+1}</span>
                <span style={{ fontSize:"12px", color:"#475569", lineHeight:1.5 }}>{s}</span>
              </div>
            ))}
          </div>
        )}

        {node.output && <div style={{ padding:"8px 10px", background:`${color}09`, border:`1px solid ${color}22`, borderRadius:"8px", fontSize:"12px", marginBottom:"8px" }}>✓ {node.output}</div>}
        {node.note  && <div style={{ padding:"8px 10px", background:"#FFFBEB", border:"1px solid #FDE68A", borderRadius:"8px", fontSize:"11px", color:"#92400E" }}>⚠️ {node.note}</div>}
      </div>
    </div>
  );
}

// ── GLOBAL CSS ────────────────────────────────────────────────────────────────
const GCSS = `
  @import url('https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700;800&display=swap');
  *, *::before, *::after { box-sizing:border-box; margin:0; padding:0; }
  :root { --bg:#F8F9FF; --border:#E4E7F0; --border2:#C7D2FE; --text:#0F172A; --text2:#475569; --text3:#94A3B8; --indigo:#4F46E5; --violet:#7C3AED; --surface:#F1F3FF; }
  body { background:var(--bg); font-family:'Plus Jakarta Sans',system-ui,sans-serif; color:var(--text); -webkit-font-smoothing:antialiased; overflow-x:hidden; }
  ::-webkit-scrollbar{width:5px;height:5px} ::-webkit-scrollbar-track{background:var(--bg)} ::-webkit-scrollbar-thumb{background:#C7D2FE;border-radius:3px}
  .nav { height:62px; display:flex; align-items:center; justify-content:space-between; padding:0 24px; background:rgba(255,255,255,0.92); backdrop-filter:blur(20px); border-bottom:1px solid var(--border); position:sticky; top:0; z-index:100; animation:slideDown 0.5s ease both; }
  .nav-logo { width:34px; height:34px; background:linear-gradient(135deg,var(--indigo),var(--violet)); border-radius:9px; display:flex; align-items:center; justify-content:center; font-size:17px; box-shadow:0 2px 10px rgba(99,102,241,0.4); }
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
  .card { background:white; border:1.5px solid var(--border); border-radius:16px; box-shadow:0 2px 8px rgba(99,102,241,0.06); }
  .label { font-size:10px; font-weight:700; letter-spacing:1.5px; color:var(--text3); text-transform:uppercase; margin-bottom:10px; }
  .orb { position:fixed; border-radius:50%; filter:blur(80px); pointer-events:none; z-index:0; animation:orbFloat linear infinite; }
  .drop-zone { border:2px dashed var(--border2); border-radius:14px; padding:40px 32px; text-align:center; cursor:pointer; background:white; transition:all 0.25s cubic-bezier(0.34,1.2,0.64,1); }
  .drop-zone:hover { border-color:#6366F1; transform:translateY(-2px); box-shadow:0 8px 24px rgba(99,102,241,0.1); }
  .drop-zone.over { border-color:#6366F1; background:#EEF2FF; transform:scale(1.01); }
  .exp-btn { font-family:'Plus Jakarta Sans',sans-serif; font-size:12px; font-weight:600; border-radius:8px; padding:7px 14px; cursor:pointer; border:1.5px solid var(--border); background:white; color:var(--text2); transition:all 0.2s cubic-bezier(0.34,1.3,0.64,1); display:flex; align-items:center; gap:5px; }
  .exp-btn:hover { border-color:#6366F1; color:var(--indigo); background:#EEF2FF; transform:translateY(-2px) scale(1.04); }
  .sidebar { width:260px; flex-shrink:0; border-right:1px solid var(--border); background:white; height:calc(100vh - 62px); overflow-y:auto; position:sticky; top:62px; }
  .sidebar-item { padding:12px 16px; border-bottom:1px solid #F1F5F9; cursor:pointer; transition:all 0.15s; border-left:3px solid transparent; }
  .sidebar-item:hover { background:var(--surface); border-left-color:#6366F1; }
  .sidebar-item.active { background:#EEF2FF; border-left-color:var(--indigo); }
  .login-wrap { min-height:100vh; display:flex; align-items:center; justify-content:center; background:var(--bg); padding:24px; position:relative; overflow:hidden; }
  .login-card { width:100%; max-width:420px; background:white; border:1.5px solid var(--border); border-radius:20px; padding:36px; box-shadow:0 8px 40px rgba(99,102,241,0.1); position:relative; z-index:1; animation:cardPop 0.5s cubic-bezier(0.34,1.3,0.64,1) both; }
  .input-label { font-size:12px; font-weight:700; color:var(--text2); margin-bottom:6px; display:block; }
  .input-icon-wrap { position:relative; }
  .input-icon { position:absolute; left:13px; top:50%; transform:translateY(-50%); font-size:16px; pointer-events:none; }
  .input-with-icon { padding-left:40px !important; }
  .tab { flex:1; padding:9px; font-size:13px; font-weight:600; border:none; background:transparent; cursor:pointer; border-radius:8px; transition:all 0.2s; color:var(--text3); }
  .tab.active { background:white; color:var(--indigo); box-shadow:0 2px 8px rgba(99,102,241,0.12); }
  @keyframes slideDown { from{opacity:0;transform:translateY(-20px)} to{opacity:1;transform:translateY(0)} }
  @keyframes fadeUp { from{opacity:0;transform:translateY(18px)} to{opacity:1;transform:translateY(0)} }
  @keyframes cardPop { from{opacity:0;transform:scale(0.94) translateY(16px)} to{opacity:1;transform:scale(1) translateY(0)} }
  @keyframes orbFloat { 0%{transform:translate(0,0) scale(1)} 33%{transform:translate(40px,-30px) scale(1.08)} 66%{transform:translate(-20px,20px) scale(0.95)} 100%{transform:translate(0,0) scale(1)} }
  @keyframes spinSlow { from{transform:rotate(0deg)} to{transform:rotate(360deg)} }
  @keyframes pulse { 0%,100%{opacity:1;transform:scale(1)} 50%{opacity:0.5;transform:scale(0.8)} }
  @keyframes float { 0%,100%{transform:translateY(0)} 50%{transform:translateY(-8px)} }
  @keyframes badgePop { from{opacity:0;transform:scale(0.85)} to{opacity:1;transform:scale(1)} }
  @keyframes shake { 0%,100%{transform:translateX(0)} 20%,60%{transform:translateX(-6px)} 40%,80%{transform:translateX(6px)} }
  @keyframes slideUp { from{opacity:0;transform:translateY(20px)} to{opacity:1;transform:translateY(0)} }
  @keyframes titleReveal { from{opacity:0;transform:translateY(20px)} to{opacity:1;transform:translateY(0)} }
  @keyframes dotPulse { 0%,100%{transform:scale(1)} 50%{transform:scale(1.5)} }
  .fade-up   { animation:fadeUp 0.45s ease both; }
  .fade-up-1 { animation:fadeUp 0.45s 0.07s ease both; }
  .fade-up-2 { animation:fadeUp 0.45s 0.14s ease both; }
  .fade-up-3 { animation:fadeUp 0.45s 0.21s ease both; }
  .scale-in  { animation:badgePop 0.35s ease both; }
  .shake     { animation:shake 0.4s ease both; }
`;

// ── LOGIN ─────────────────────────────────────────────────────────────────────
const LOGIN_CSS = `
  @import url('https://fonts.googleapis.com/css2?family=Syne:wght@400;600;700;800&family=DM+Sans:ital,wght@0,300;0,400;0,500;0,600;1,400&display=swap');

  *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }

  .ls-root {
    min-height: 100vh;
    min-height: 100dvh;
    display: flex;
    align-items: center;
    justify-content: center;
    background: #060818;
    font-family: 'DM Sans', sans-serif;
    overflow: hidden;
    position: relative;
  }

  /* ── CANVAS ── */
  .ls-canvas {
    position: fixed; inset: 0;
    pointer-events: none; z-index: 0;
  }

  /* ── BLOBS ── */
  .ls-blob {
    position: fixed; border-radius: 50%;
    filter: blur(120px); pointer-events: none;
    z-index: 0; mix-blend-mode: screen;
  }
  .ls-blob-1 {
    width: 55vw; height: 55vw; max-width: 700px; max-height: 700px;
    background: radial-gradient(circle, rgba(79,70,229,0.28) 0%, transparent 70%);
    top: -15%; left: -10%;
    animation: blob1 14s ease-in-out infinite;
  }
  .ls-blob-2 {
    width: 45vw; height: 45vw; max-width: 600px; max-height: 600px;
    background: radial-gradient(circle, rgba(124,58,237,0.22) 0%, transparent 70%);
    bottom: -10%; right: -8%;
    animation: blob2 18s ease-in-out infinite;
  }
  .ls-blob-3 {
    width: 30vw; height: 30vw; max-width: 400px; max-height: 400px;
    background: radial-gradient(circle, rgba(6,182,212,0.14) 0%, transparent 70%);
    top: 35%; right: 15%;
    animation: blob3 11s ease-in-out infinite;
  }
  .ls-blob-4 {
    width: 25vw; height: 25vw; max-width: 320px; max-height: 320px;
    background: radial-gradient(circle, rgba(236,72,153,0.1) 0%, transparent 70%);
    bottom: 20%; left: 10%;
    animation: blob1 16s 3s ease-in-out infinite;
  }

  /* ── GRID ── */
  .ls-grid {
    position: fixed; inset: 0;
    background-image:
      linear-gradient(rgba(99,102,241,0.05) 1px, transparent 1px),
      linear-gradient(90deg, rgba(99,102,241,0.05) 1px, transparent 1px);
    background-size: 52px 52px;
    pointer-events: none; z-index: 0;
    animation: gridIn 2s ease both;
  }

  /* ── CARD ── */
  .ls-card {
    width: 100%; max-width: 460px;
    position: relative; z-index: 10;
    margin: 16px;
    animation: cardIn 0.9s cubic-bezier(0.16,1,0.3,1) both;
  }

  .ls-card-inner {
    background: rgba(10,13,30,0.82);
    border: 1px solid rgba(99,102,241,0.22);
    border-radius: 28px;
    padding: 44px 40px 36px;
    backdrop-filter: blur(48px);
    -webkit-backdrop-filter: blur(48px);
    box-shadow:
      0 0 0 1px rgba(99,102,241,0.08),
      0 32px 100px rgba(0,0,0,0.7),
      0 0 80px rgba(99,102,241,0.06) inset;
    position: relative; overflow: hidden;
  }

  /* Shimmer sweep */
  .ls-card-inner::before {
    content: '';
    position: absolute; top: 0; left: -120%; right: 0; height: 1px;
    background: linear-gradient(90deg, transparent 0%, rgba(139,92,246,0.9) 50%, transparent 100%);
    animation: shimmer 3.5s ease-in-out infinite;
  }

  /* Top glow */
  .ls-card-inner::after {
    content: '';
    position: absolute; top: -80px; left: 50%;
    transform: translateX(-50%);
    width: 260px; height: 160px;
    background: radial-gradient(ellipse, rgba(99,102,241,0.1), transparent 70%);
    pointer-events: none;
  }

  /* ── LOGO ── */
  .ls-logo-wrap {
    text-align: center; margin-bottom: 30px;
    animation: logoIn 0.7s 0.2s cubic-bezier(0.34,1.6,0.64,1) both;
  }
  .ls-logo-icon {
    width: 68px; height: 68px; margin: 0 auto 14px;
    animation: hexIn 0.8s 0.25s cubic-bezier(0.34,1.5,0.64,1) both;
  }
  .ls-logo-icon svg {
    width: 100%; height: 100%;
    filter: drop-shadow(0 0 18px rgba(99,102,241,0.7)) drop-shadow(0 0 36px rgba(139,92,246,0.35));
    animation: hexGlow 3s ease-in-out infinite;
  }
  .ls-logo-title {
    font-family: 'Syne', sans-serif;
    font-size: 28px; font-weight: 800;
    background: linear-gradient(135deg, #fff 20%, #A5B4FC 60%, #8B5CF6);
    -webkit-background-clip: text; -webkit-text-fill-color: transparent;
    letter-spacing: -0.5px; margin-bottom: 5px;
  }
  .ls-logo-sub {
    font-size: 13px; color: rgba(148,163,184,0.6); letter-spacing: 0.3px;
  }

  /* ── TABS ── */
  .ls-tabs {
    display: flex;
    background: rgba(255,255,255,0.04);
    border: 1px solid rgba(255,255,255,0.07);
    border-radius: 14px; padding: 4px;
    margin-bottom: 28px;
    animation: fadeUp 0.5s 0.3s ease both;
  }
  .ls-tab {
    flex: 1; padding: 11px;
    font-family: 'DM Sans', sans-serif;
    font-size: 13.5px; font-weight: 600;
    border: none; background: transparent;
    cursor: pointer; border-radius: 11px;
    transition: all 0.3s cubic-bezier(0.34,1.3,0.64,1);
    color: rgba(148,163,184,0.5);
  }
  .ls-tab.active {
    background: linear-gradient(135deg, rgba(99,102,241,0.3), rgba(139,92,246,0.22));
    color: #fff;
    box-shadow: 0 2px 14px rgba(99,102,241,0.3), 0 0 0 1px rgba(99,102,241,0.35);
  }
  .ls-tab:not(.active):hover { color: rgba(255,255,255,0.65); background: rgba(255,255,255,0.05); }

  /* ── FIELD ── */
  .ls-field { margin-bottom: 16px; animation: fadeUp 0.5s ease both; }
  .ls-field-label {
    display: block; font-size: 10.5px; font-weight: 700;
    letter-spacing: 1.4px; text-transform: uppercase;
    color: rgba(148,163,184,0.55); margin-bottom: 8px;
  }
  .ls-input-wrap { position: relative; }

  .ls-input {
    width: 100%;
    font-family: 'DM Sans', sans-serif;
    font-size: 14px; font-weight: 400;
    color: #fff;
    background: rgba(255,255,255,0.05);
    border: 1.5px solid rgba(255,255,255,0.1);
    border-radius: 13px;
    padding: 14px 46px 14px 46px;
    outline: none;
    transition: all 0.35s cubic-bezier(0.34,1.2,0.64,1);
    box-sizing: border-box;
  }
  .ls-input::placeholder { color: rgba(148,163,184,0.3); }
  .ls-input:focus {
    border-color: rgba(99,102,241,0.65);
    background: rgba(99,102,241,0.07);
    box-shadow: 0 0 0 4px rgba(99,102,241,0.14), 0 0 24px rgba(99,102,241,0.08);
    transform: translateY(-1px);
  }

  .ls-input-icon-left {
    position: absolute; left: 15px; top: 50%;
    transform: translateY(-50%); font-size: 15px;
    pointer-events: none; transition: all 0.3s;
    opacity: 0.45;
  }
  .ls-input-wrap:focus-within .ls-input-icon-left { opacity: 1; transform: translateY(-50%) scale(1.1); }

  .ls-pw-eye {
    position: absolute; right: 13px; top: 50%;
    transform: translateY(-50%);
    background: none; border: none; cursor: pointer;
    font-size: 14px; color: rgba(148,163,184,0.35);
    padding: 5px; border-radius: 7px; transition: all 0.2s;
  }
  .ls-pw-eye:hover { color: rgba(148,163,184,0.85); background: rgba(255,255,255,0.06); }

  /* ── STRENGTH ── */
  .ls-strength { margin-top: 9px; }
  .ls-str-bars { display: flex; gap: 5px; margin-bottom: 5px; }
  .ls-str-bar {
    flex: 1; height: 3px; border-radius: 2px;
    transition: all 0.45s cubic-bezier(0.34,1.3,0.64,1);
  }
  .ls-str-label { font-size: 11px; font-weight: 600; transition: color 0.3s; }

  /* ── ERROR ── */
  .ls-error {
    display: flex; align-items: center; gap: 9px;
    font-size: 12.5px; color: #FCA5A5;
    padding: 11px 15px;
    background: rgba(239,68,68,0.09);
    border: 1px solid rgba(239,68,68,0.25);
    border-radius: 12px; margin-bottom: 16px;
    animation: errIn 0.4s cubic-bezier(0.34,1.5,0.64,1) both;
  }

  /* ── SUBMIT BUTTON ── */
  .ls-btn {
    width: 100%;
    font-family: 'Syne', sans-serif;
    font-size: 15px; font-weight: 700;
    color: #fff; letter-spacing: 0.4px;
    background: linear-gradient(135deg, #4338CA 0%, #6366F1 40%, #8B5CF6 70%, #7C3AED 100%);
    background-size: 200% 200%;
    border: none; border-radius: 14px;
    padding: 15px;
    cursor: pointer; position: relative; overflow: hidden;
    transition: all 0.35s cubic-bezier(0.34,1.3,0.64,1);
    box-shadow:
      0 6px 28px rgba(99,102,241,0.45),
      0 1px 0 rgba(255,255,255,0.12) inset,
      0 -1px 0 rgba(0,0,0,0.3) inset;
    margin-bottom: 22px;
    animation: fadeUp 0.5s ease both;
  }
  .ls-btn::before {
    content: '';
    position: absolute; inset: 0;
    background: linear-gradient(180deg, rgba(255,255,255,0.14) 0%, transparent 55%);
    pointer-events: none;
  }
  .ls-btn:not(:disabled):hover {
    transform: translateY(-3px) scale(1.015);
    box-shadow: 0 14px 40px rgba(99,102,241,0.6), 0 1px 0 rgba(255,255,255,0.15) inset;
    background-position: right center;
  }
  .ls-btn:not(:disabled):active { transform: translateY(0) scale(0.99); }
  .ls-btn:disabled {
    background: rgba(99,102,241,0.2); box-shadow: none;
    cursor: not-allowed; transform: none; color: rgba(255,255,255,0.35);
  }

  /* ── SPINNER ── */
  .ls-spin {
    width: 16px; height: 16px;
    border: 2px solid rgba(255,255,255,0.2);
    border-top-color: white; border-radius: 50%;
    display: inline-block; animation: spin 0.7s linear infinite;
  }

  /* ── DIVIDER ── */
  .ls-div {
    display: flex; align-items: center; gap: 12px;
    margin-bottom: 18px;
  }
  .ls-div-line { flex: 1; height: 1px; background: rgba(255,255,255,0.07); }
  .ls-div-text { font-size: 12px; color: rgba(148,163,184,0.4); font-weight: 500; white-space: nowrap; }

  /* ── SWITCH LINK ── */
  .ls-switch { text-align: center; font-size: 13px; color: rgba(148,163,184,0.45); }
  .ls-switch-btn {
    background: none; border: none; cursor: pointer;
    font-family: 'DM Sans', sans-serif; font-size: 13px;
    font-weight: 700; color: #818CF8; padding: 0 2px;
    position: relative; transition: color 0.2s;
  }
  .ls-switch-btn::after {
    content: ''; position: absolute;
    bottom: -1px; left: 0; right: 0; height: 1px;
    background: #818CF8; transform: scaleX(0);
    transform-origin: left; transition: transform 0.3s;
  }
  .ls-switch-btn:hover { color: #A5B4FC; }
  .ls-switch-btn:hover::after { transform: scaleX(1); }

  /* ── FOOTER ── */
  .ls-foot {
    text-align: center; margin-top: 20px;
    padding-top: 18px; border-top: 1px solid rgba(255,255,255,0.06);
    font-size: 11px; color: rgba(148,163,184,0.28);
    letter-spacing: 0.3px;
  }

  /* ── TRUST BADGES ── */
  .ls-trust {
    display: flex; justify-content: center; gap: 16px;
    margin-top: 14px; flex-wrap: wrap;
  }
  .ls-trust-item {
    display: flex; align-items: center; gap: 5px;
    font-size: 10.5px; color: rgba(148,163,184,0.35);
    font-weight: 500;
  }
  .ls-trust-dot {
    width: 5px; height: 5px; border-radius: 50%;
    animation: dotPulse 2s ease-in-out infinite;
  }

  /* ── SHAKE ── */
  .ls-shake { animation: shakeX 0.4s cubic-bezier(0.36,0.07,0.19,0.97) both; }

  /* ── MOBILE ── */
  @media (max-width: 480px) {
    .ls-card-inner { padding: 32px 24px 28px; border-radius: 24px; }
    .ls-logo-title { font-size: 24px; }
    .ls-logo-icon { width: 56px; height: 56px; }
    .ls-btn { font-size: 14px; padding: 14px; }
  }

  /* ════ KEYFRAMES ════ */
  @keyframes blob1 {
    0%,100%{transform:translate(0,0) scale(1)} 33%{transform:translate(60px,50px) scale(1.1)} 66%{transform:translate(-30px,70px) scale(0.92)}
  }
  @keyframes blob2 {
    0%,100%{transform:translate(0,0) scale(1)} 33%{transform:translate(-50px,-60px) scale(1.12)} 66%{transform:translate(35px,-30px) scale(0.94)}
  }
  @keyframes blob3 {
    0%,100%{transform:translate(0,0)} 50%{transform:translate(-60px,50px) scale(1.18)}
  }
  @keyframes gridIn { from{opacity:0} to{opacity:1} }
  @keyframes cardIn {
    from{opacity:0;transform:translateY(36px) scale(0.95)}
    to{opacity:1;transform:translateY(0) scale(1)}
  }
  @keyframes logoIn {
    from{opacity:0;transform:translateY(-16px)}
    to{opacity:1;transform:translateY(0)}
  }
  @keyframes hexIn {
    from{opacity:0;transform:scale(0.3) rotate(-180deg)}
    to{opacity:1;transform:scale(1) rotate(0)}
  }
  @keyframes hexGlow {
    0%,100%{filter:drop-shadow(0 0 18px rgba(99,102,241,0.7)) drop-shadow(0 0 36px rgba(139,92,246,0.35))}
    50%{filter:drop-shadow(0 0 28px rgba(99,102,241,1)) drop-shadow(0 0 56px rgba(139,92,246,0.6))}
  }
  @keyframes shimmer { 0%{left:-120%} 100%{left:220%} }
  @keyframes fadeUp {
    from{opacity:0;transform:translateY(12px)}
    to{opacity:1;transform:translateY(0)}
  }
  @keyframes errIn {
    from{opacity:0;transform:scale(0.95) translateY(-4px)}
    to{opacity:1;transform:scale(1) translateY(0)}
  }
  @keyframes shakeX {
    0%,100%{transform:translateX(0)}
    15%,45%,75%{transform:translateX(-7px)}
    30%,60%,90%{transform:translateX(7px)}
  }
  @keyframes spin { from{transform:rotate(0deg)} to{transform:rotate(360deg)} }
  @keyframes dotPulse {
    0%,100%{opacity:0.4;transform:scale(1)}
    50%{opacity:1;transform:scale(1.4)}
  }

  /* Flowchart bg animations */
  @keyframes fcDrift1 {
    0%,100%{transform:translate(0,0)} 33%{transform:translate(10px,-18px)} 66%{transform:translate(-6px,12px)}
  }
  @keyframes fcDrift2 {
    0%,100%{transform:translate(0,0)} 33%{transform:translate(-12px,16px)} 66%{transform:translate(8px,-10px)}
  }
  @keyframes fcDrift3 {
    0%,100%{transform:translate(0,0)} 50%{transform:translate(6px,-14px)}
  }
  @keyframes badgeFloat {
    0%,100%{transform:translateY(0);opacity:0.65} 50%{transform:translateY(-9px);opacity:0.95}
  }
  @keyframes badgeFloat2 {
    0%,100%{transform:translateY(0);opacity:0.55} 50%{transform:translateY(9px);opacity:0.85}
  }
`;

// ── PARTICLE CANVAS ───────────────────────────────────────────────────────────
function ParticleCanvas() {
  const ref = useRef(null);
  useEffect(() => {
    const c = ref.current; if (!c) return;
    const ctx = c.getContext('2d');
    let id;
    const resize = () => { c.width = window.innerWidth; c.height = window.innerHeight; };
    resize(); window.addEventListener('resize', resize);
    const pts = Array.from({length:70}, () => ({
      x: Math.random()*window.innerWidth, y: Math.random()*window.innerHeight,
      vx:(Math.random()-0.5)*0.35, vy:(Math.random()-0.5)*0.35,
      r: Math.random()*1.4+0.3, a: Math.random()*0.35+0.08
    }));
    const draw = () => {
      ctx.clearRect(0,0,c.width,c.height);
      pts.forEach(p => {
        p.x+=p.vx; p.y+=p.vy;
        if(p.x<0)p.x=c.width; if(p.x>c.width)p.x=0;
        if(p.y<0)p.y=c.height; if(p.y>c.height)p.y=0;
      });
      for(let i=0;i<pts.length;i++) for(let j=i+1;j<pts.length;j++) {
        const dx=pts[i].x-pts[j].x, dy=pts[i].y-pts[j].y;
        const d=Math.sqrt(dx*dx+dy*dy);
        if(d<130) {
          ctx.beginPath();ctx.moveTo(pts[i].x,pts[i].y);ctx.lineTo(pts[j].x,pts[j].y);
          ctx.strokeStyle=`rgba(99,102,241,${(1-d/130)*0.11})`;ctx.lineWidth=0.7;ctx.stroke();
        }
      }
      pts.forEach(p => {
        ctx.beginPath();ctx.arc(p.x,p.y,p.r,0,Math.PI*2);
        ctx.fillStyle=`rgba(139,92,246,${p.a})`;ctx.fill();
      });
      id = requestAnimationFrame(draw);
    };
    draw();
    return () => { cancelAnimationFrame(id); window.removeEventListener('resize', resize); };
  }, []);
  return <canvas ref={ref} className="ls-canvas"/>;
}

// ── BACKGROUND FLOWCHARTS (full screen, both sides + center) ─────────────────
function FloatingNodes() {
  const [active, setActive] = useState(0);
  useEffect(() => {
    const t = setInterval(() => setActive(v => (v+1)%6), 1300);
    return () => clearInterval(t);
  }, []);

  const NW=110, NH=40, DH=48;

  const renderChart = (nodes, edges, ox, oy, activeIdx, opacity, drift) => {
    const cx=n=>ox+n.x, cy=n=>oy+n.y;
    const bot=n=>n.type==="diamond"?cy(n)+DH/2:cy(n)+NH;
    const top=n=>n.type==="diamond"?cy(n)-DH/2:cy(n);
    return (
      <g opacity={opacity} style={{animation:`${drift} ease-in-out infinite`}}>
        {edges.map((e,i)=>{
          const fn=nodes[e.f],tn=nodes[e.t];
          const x1=cx(fn),y1=bot(fn),x2=cx(tn),y2=top(tn);
          const isAct=i===activeIdx, col=isAct?fn.color:"rgba(99,102,241,0.12)";
          const straight=Math.abs(x1-x2)<8;
          const path=straight
            ?`M${x1},${y1} C${x1},${(y1+y2)/2} ${x2},${(y1+y2)/2} ${x2},${y2}`
            :`M${x1},${y1} V${(y1+y2)/2} H${x2} V${y2}`;
          return (
            <g key={i}>
              <path d={path} fill="none" stroke={col}
                strokeWidth={isAct?1.8:0.8} strokeDasharray={isAct?"none":"3 5"}
                style={{transition:"all 0.5s",filter:isAct?`drop-shadow(0 0 4px ${fn.color})`:"none"}}/>
              {isAct&&<circle r="3.5" fill={fn.color} opacity="0.95"
                style={{filter:`drop-shadow(0 0 6px ${fn.color})`}}>
                <animateMotion dur="1.3s" repeatCount="indefinite" path={path}/>
              </circle>}
              {e.label&&<text x={(x1+x2)/2+(x2>x1?9:-9)} y={(y1+y2)/2-2}
                fill={isAct?fn.color:"rgba(148,163,184,0.2)"} fontSize="7" fontWeight="800"
                fontFamily="DM Sans,sans-serif" style={{transition:"all 0.5s"}}>{e.label}</text>}
            </g>
          );
        })}
        {nodes.map((n,i)=>{
          const isAct=edges.some((e,ei)=>ei===activeIdx&&(e.f===i||e.t===i));
          const x=cx(n),y=cy(n),col=n.color;
          const glow=isAct?`drop-shadow(0 0 9px ${col}77)`:"none";
          if(n.type==="oval") return (
            <g key={i}>
              <ellipse cx={x} cy={y+NH/2} rx={NW/2} ry={NH/2-2}
                fill={isAct?`${col}1E`:"rgba(255,255,255,0.022)"}
                stroke={isAct?col:`${col}33`} strokeWidth={isAct?1.5:0.7}
                style={{filter:glow,transition:"all 0.5s"}}/>
              <text x={x} y={y+NH/2+4} textAnchor="middle" fontSize="8" fontWeight="700"
                fill={isAct?col:`${col}50`} fontFamily="DM Sans,sans-serif"
                style={{transition:"all 0.5s"}}>{n.label}</text>
            </g>
          );
          if(n.type==="diamond"){const hw=NW/2-12,hh=DH/2; return (
            <g key={i}>
              <polygon points={`${x},${y-hh} ${x+hw},${y} ${x},${y+hh} ${x-hw},${y}`}
                fill={isAct?`${col}1E`:"rgba(255,255,255,0.022)"}
                stroke={isAct?col:`${col}33`} strokeWidth={isAct?1.5:0.7}
                style={{filter:glow,transition:"all 0.5s"}}/>
              <text x={x} y={y+4} textAnchor="middle" fontSize="7.5" fontWeight="700"
                fill={isAct?col:`${col}50`} fontFamily="DM Sans,sans-serif"
                style={{transition:"all 0.5s"}}>{n.label}</text>
            </g>
          );}
          return (
            <g key={i}>
              <rect x={x-NW/2} y={y} width={NW} height={NH} rx="7"
                fill={isAct?`${col}18`:"rgba(255,255,255,0.022)"}
                stroke={isAct?col:`${col}28`} strokeWidth={isAct?1.5:0.7}
                style={{filter:glow,transition:"all 0.5s"}}/>
              <rect x={x-NW/2} y={y} width={NW} height={isAct?3:2} rx="7"
                fill={isAct?col:`${col}28`} style={{transition:"all 0.5s"}}/>
              <rect x={x-NW/2} y={y+1} width={NW} height={isAct?2:1}
                fill={isAct?col:`${col}28`} style={{transition:"all 0.5s"}}/>
              <text x={x} y={y+NH/2+4} textAnchor="middle" fontSize="8" fontWeight="600"
                fill={isAct?"rgba(255,255,255,0.82)":`rgba(148,163,184,0.25)`}
                fontFamily="DM Sans,sans-serif" style={{transition:"all 0.5s"}}>{n.label}</text>
            </g>
          );
        })}
      </g>
    );
  };

  // LEFT chart — vertical document pipeline
  const LN=[
    {x:70,y:30, type:"oval",    label:"📄 Upload",    color:"#10B981"},
    {x:70,y:118,type:"rect",    label:"🤖 AI Reads",  color:"#6366F1"},
    {x:70,y:206,type:"diamond", label:"Valid?",        color:"#F59E0B"},
    {x:70,y:304,type:"rect",    label:"🔀 Map Steps", color:"#8B5CF6"},
    {x:70,y:392,type:"rect",    label:"👥 Actors",    color:"#6366F1"},
    {x:70,y:480,type:"oval",    label:"📊 Export",    color:"#EF4444"},
  ];
  const LE=[{f:0,t:1},{f:1,t:2},{f:2,t:3,label:"YES"},{f:2,t:5,label:"NO"},{f:3,t:4},{f:4,t:5}];

  // RIGHT chart — branching decision flow
  const RN=[
    {x:60,y:40, type:"oval",    label:"▶ Start",    color:"#10B981"},
    {x:60,y:128,type:"rect",    label:"🔍 Analyze", color:"#6366F1"},
    {x:60,y:216,type:"diamond", label:"Decision?",  color:"#F59E0B"},
    {x:-35,y:314,type:"rect",   label:"📋 Path A",  color:"#8B5CF6"},
    {x:155,y:314,type:"rect",   label:"📝 Path B",  color:"#06B6D4"},
    {x:60,y:412,type:"oval",    label:"✓ Done",     color:"#EF4444"},
  ];
  const RE=[{f:0,t:1},{f:1,t:2},{f:2,t:3,label:"YES"},{f:2,t:4,label:"NO"},{f:3,t:5},{f:4,t:5}];

  // TOP chart — horizontal process strip across the top
  const TN=[
    {x:0,  y:30, type:"oval",    label:"Start",      color:"#10B981"},
    {x:140,y:30, type:"rect",    label:"📥 Input",   color:"#6366F1"},
    {x:280,y:30, type:"diamond", label:"Check?",     color:"#F59E0B"},
    {x:420,y:30, type:"rect",    label:"⚙️ Process", color:"#8B5CF6"},
    {x:560,y:30, type:"rect",    label:"✅ Validate", color:"#06B6D4"},
    {x:700,y:30, type:"oval",    label:"End",        color:"#EF4444"},
  ];
  const TE=[{f:0,t:1},{f:1,t:2},{f:2,t:3,label:"YES"},{f:2,t:5,label:"NO"},{f:3,t:4},{f:4,t:5}];

  // BOTTOM chart — horizontal process strip across the bottom
  const BN=[
    {x:0,  y:30, type:"oval",    label:"📄 Doc",     color:"#10B981"},
    {x:140,y:30, type:"rect",    label:"🤖 Extract", color:"#6366F1"},
    {x:280,y:30, type:"rect",    label:"🗺 Map",     color:"#8B5CF6"},
    {x:420,y:30, type:"diamond", label:"Review?",    color:"#F59E0B"},
    {x:560,y:30, type:"rect",    label:"📊 Chart",   color:"#06B6D4"},
    {x:700,y:30, type:"oval",    label:"🚀 Export",  color:"#EF4444"},
  ];
  const BE=[{f:0,t:1},{f:1,t:2},{f:2,t:3},{f:3,t:4,label:"YES"},{f:3,t:5,label:"NO"},{f:4,t:5}];

  // horizontal edge renderer for top/bottom strips
  const renderHorizChart = (nodes, edges, svgW, svgH, activeIdx, opacity, drift) => {
    const cy=n=>svgH/2, cx=n=>n.x+NW/2;
    const right=n=>n.type==="diamond"?cx(n)+DH/2:cx(n)+NW/2;
    const left=n=>n.type==="diamond"?cx(n)-DH/2:cx(n)-NW/2;
    return (
      <g opacity={opacity} style={{animation:`${drift} ease-in-out infinite`}}>
        {edges.map((e,i)=>{
          const fn=nodes[e.f],tn=nodes[e.t];
          const x1=right(fn),y1=cy(fn),x2=left(tn),y2=cy(tn);
          const isAct=i===activeIdx, col=isAct?fn.color:"rgba(99,102,241,0.1)";
          const path=`M${x1},${y1} C${(x1+x2)/2},${y1} ${(x1+x2)/2},${y2} ${x2},${y2}`;
          return (
            <g key={i}>
              <path d={path} fill="none" stroke={col}
                strokeWidth={isAct?1.8:0.7} strokeDasharray={isAct?"none":"3 5"}
                style={{transition:"all 0.5s",filter:isAct?`drop-shadow(0 0 4px ${fn.color})`:"none"}}/>
              {isAct&&<circle r="3" fill={fn.color} opacity="0.9"
                style={{filter:`drop-shadow(0 0 5px ${fn.color})`}}>
                <animateMotion dur="1.3s" repeatCount="indefinite" path={path}/>
              </circle>}
              {e.label&&<text x={(x1+x2)/2} y={y1-6}
                fill={isAct?fn.color:"rgba(148,163,184,0.2)"} fontSize="7" fontWeight="800"
                textAnchor="middle" fontFamily="DM Sans,sans-serif">{e.label}</text>}
            </g>
          );
        })}
        {nodes.map((n,i)=>{
          const isAct=edges.some((e,ei)=>ei===activeIdx&&(e.f===i||e.t===i));
          const x=cx(n),y=svgH/2,col=n.color;
          const glow=isAct?`drop-shadow(0 0 8px ${col}77)`:"none";
          if(n.type==="oval") return (
            <g key={i}>
              <ellipse cx={x} cy={y} rx={NW/2} ry={NH/2-2}
                fill={isAct?`${col}1E`:"rgba(255,255,255,0.02)"}
                stroke={isAct?col:`${col}30`} strokeWidth={isAct?1.5:0.7}
                style={{filter:glow,transition:"all 0.5s"}}/>
              <text x={x} y={y+4} textAnchor="middle" fontSize="8" fontWeight="700"
                fill={isAct?col:`${col}50`} fontFamily="DM Sans,sans-serif">{n.label}</text>
            </g>
          );
          if(n.type==="diamond"){const hw=NW/2-10,hh=NH/2; return (
            <g key={i}>
              <polygon points={`${x},${y-hh} ${x+hw},${y} ${x},${y+hh} ${x-hw},${y}`}
                fill={isAct?`${col}1E`:"rgba(255,255,255,0.02)"}
                stroke={isAct?col:`${col}30`} strokeWidth={isAct?1.5:0.7}
                style={{filter:glow,transition:"all 0.5s"}}/>
              <text x={x} y={y+4} textAnchor="middle" fontSize="7.5" fontWeight="700"
                fill={isAct?col:`${col}50`} fontFamily="DM Sans,sans-serif">{n.label}</text>
            </g>
          );}
          return (
            <g key={i}>
              <rect x={x-NW/2} y={y-NH/2} width={NW} height={NH} rx="7"
                fill={isAct?`${col}18`:"rgba(255,255,255,0.02)"}
                stroke={isAct?col:`${col}25`} strokeWidth={isAct?1.5:0.7}
                style={{filter:glow,transition:"all 0.5s"}}/>
              <rect x={x-NW/2} y={y-NH/2} width={NW} height={isAct?3:2} rx="7"
                fill={isAct?col:`${col}25`} style={{transition:"all 0.5s"}}/>
              <text x={x} y={y+4} textAnchor="middle" fontSize="8" fontWeight="600"
                fill={isAct?"rgba(255,255,255,0.8)":`rgba(148,163,184,0.22)`}
                fontFamily="DM Sans,sans-serif">{n.label}</text>
            </g>
          );
        })}
      </g>
    );
  };

  return (
    <svg style={{position:"fixed",inset:0,width:"100%",height:"100%",pointerEvents:"none",zIndex:1,overflow:"visible"}}>

      {/* TOP horizontal strip */}
      <svg x="0" y="0" width="100%" height="80" overflow="visible">
        {renderHorizChart(TN, TE, 800, 80, active%TE.length, 0.45, "fcDrift3 18s ease-in-out infinite")}
      </svg>

      {/* BOTTOM horizontal strip */}
      <svg x="0" y="calc(100% - 80px)" width="100%" height="80" overflow="visible">
        {renderHorizChart(BN, BE, 800, 80, active%BE.length, 0.4, "fcDrift3 22s 2s ease-in-out infinite")}
      </svg>

      {/* LEFT vertical chart */}
      <svg x="0" y="0" width="160" height="100%" overflow="visible">
        {renderChart(LN, LE, 25, 60, active%LE.length, 0.52, "fcDrift1 20s ease-in-out infinite")}
      </svg>

      {/* RIGHT vertical chart — use a foreignObject trick: translate to right edge */}
      <g transform="translate(-160,0)" style={{transform:"translateX(calc(100vw - 160px))"}}>
        <svg x="0" y="0" width="160" height="100%" overflow="visible">
          {renderChart(RN, RE, 25, 80, active%RE.length, 0.44, "fcDrift2 24s ease-in-out infinite")}
        </svg>
      </g>

      {/* Purpose badges */}
      {[
        {x:"50%",y:90,  text:"📄 → 🔀  Document to Flowchart",  color:"#6366F1", anim:"badgeFloat  7s ease-in-out infinite",    tx:"-50%"},
        {x:"50%",y:-14, text:"🤖  AI-Powered Extraction",        color:"#8B5CF6", anim:"badgeFloat2 8s 0.7s ease-in-out infinite",tx:"-50%"},
        {x:4,    y:"50%",text:"👥 Actor Mapping",                 color:"#10B981", anim:"badgeFloat  9s 1s ease-in-out infinite",  tx:"0",   vert:true},
      ].map((b,i)=>{
        const bw=200, bh=22;
        return (
          <g key={i} style={{animation:b.anim}}>
            {!b.vert ? (
              <>
                <rect x={`calc(${b.x} - ${bw/2}px)`} y={b.y} width={bw} height={bh} rx={11}
                  fill="rgba(8,10,24,0.75)" stroke={`${b.color}40`} strokeWidth="1"/>
                <text x={b.x} y={b.y+15} textAnchor="middle" fontSize="9" fontWeight="700"
                  fill={b.color} fontFamily="DM Sans,sans-serif">{b.text}</text>
              </>
            ) : (
              <>
                <rect x={b.x} y={`calc(${b.y} - 11px)`} width={bw} height={bh} rx={11}
                  fill="rgba(8,10,24,0.75)" stroke={`${b.color}40`} strokeWidth="1"/>
                <text x={b.x+bw/2} y={`calc(${b.y} + 4px)`} textAnchor="middle" fontSize="9"
                  fontWeight="700" fill={b.color} fontFamily="DM Sans,sans-serif">{b.text}</text>
              </>
            )}
          </g>
        );
      })}
    </svg>
  );
}

// ── PASSWORD STRENGTH ─────────────────────────────────────────────────────────
function PwStrength({ password }) {
  const score = [password.length>=6, /[A-Z]/.test(password), /[0-9]/.test(password)].filter(Boolean).length;
  const cols = ["#EF4444","#F59E0B","#10B981"];
  const labs = ["Weak","Fair","Strong"];
  if (!password) return null;
  return (
    <div className="ls-strength">
      <div className="ls-str-bars">
        {[0,1,2].map(i=>(
          <div key={i} className="ls-str-bar"
            style={{background:i<score?cols[score-1]:"rgba(255,255,255,0.07)",boxShadow:i<score?`0 0 7px ${cols[score-1]}66`:"none"}}/>
        ))}
      </div>
      <span className="ls-str-label" style={{color:score>0?cols[score-1]:"rgba(148,163,184,0.4)"}}>
        {score>0?labs[score-1]:""}{score===3?" ✓":""}
      </span>
    </div>
  );
}

// ── LOGIN SCREEN ──────────────────────────────────────────────────────────────
function LoginScreen({ onLogin }) {
  const existingUser = LS.get(KEYS.USER);
  const [tab, setTab]       = useState(existingUser ? "login" : "register");
  const [username, setUser] = useState("");
  const [password, setPw]   = useState("");
  const [showPw, setShowPw] = useState(false);
  const [error, setError]   = useState("");
  const [loading, setLoad]  = useState(false);
  const [shake, setShake]   = useState(false);
  const [focused, setFocus] = useState(null);

  const doShake = () => { setShake(true); setTimeout(()=>setShake(false), 450); };
  const switchTab = (t) => { setTab(t); setError(""); setUser(""); setPw(""); };

  const handleRegister = () => {
    if (!username.trim()||username.trim().length<3) { setError("Username must be at least 3 characters."); doShake(); return; }
    if (!password||password.length<6)               { setError("Password must be at least 6 characters."); doShake(); return; }
    if (LS.get(KEYS.USER))                           { setError("Account exists. Please sign in."); switchTab("login"); return; }
    const user = { username:username.trim(), passwordHash:hashPassword(password) };
    LS.set(KEYS.USER, user);
    LS.set(KEYS.SESSION, { username:user.username, loggedInAt:new Date().toISOString() });
    onLogin(user.username, false);
  };

  const handleLogin = async () => {
    if (!username.trim()||!password) { setError("Please fill in all fields."); doShake(); return; }
    setLoad(true); setError("");
    await new Promise(r=>setTimeout(r,700));
    const user = LS.get(KEYS.USER);
    if (!user)                                                            { setError("No account found. Create one first."); switchTab("register"); setLoad(false); return; }
    if (user.username.toLowerCase()!==username.trim().toLowerCase())      { setError("Incorrect username."); doShake(); setLoad(false); return; }
    if (user.passwordHash!==hashPassword(password))                       { setError("Incorrect password."); doShake(); setLoad(false); return; }
    LS.set(KEYS.SESSION, { username:user.username, loggedInAt:new Date().toISOString() });
    setLoad(false);
    onLogin(user.username, !!LS.get(KEYS.APIKEY));
  };

  const fd = (i) => ({ animationDelay:`${0.32+i*0.07}s` });

  return (
    <div className="ls-root">
      <style>{LOGIN_CSS}</style>
      <ParticleCanvas/>
      <div className="ls-grid"/>
      <div className="ls-blob ls-blob-1"/>
      <div className="ls-blob ls-blob-2"/>
      <div className="ls-blob ls-blob-3"/>
      <div className="ls-blob ls-blob-4"/>
      <FloatingNodes/>

      <div className="ls-card">
        <div className="ls-card-inner">

          {/* Logo */}
          <div className="ls-logo-wrap">
            <div className="ls-logo-icon">
              <svg viewBox="0 0 64 64" fill="none" xmlns="http://www.w3.org/2000/svg">
                <defs>
                  <linearGradient id="hg1" x1="0%" y1="0%" x2="100%" y2="100%">
                    <stop offset="0%" stopColor="#6366F1"/>
                    <stop offset="50%" stopColor="#8B5CF6"/>
                    <stop offset="100%" stopColor="#06B6D4"/>
                  </linearGradient>
                  <linearGradient id="hg2" x1="0%" y1="0%" x2="100%" y2="100%">
                    <stop offset="0%" stopColor="rgba(255,255,255,0.28)"/>
                    <stop offset="100%" stopColor="rgba(255,255,255,0)"/>
                  </linearGradient>
                </defs>
                <polygon points="32,3 57,17.5 57,46.5 32,61 7,46.5 7,17.5" fill="url(#hg1)" stroke="rgba(139,92,246,0.5)" strokeWidth="1"/>
                <polygon points="32,3 57,17.5 57,46.5 32,61 7,46.5 7,17.5" fill="url(#hg2)"/>
                <circle cx="32" cy="32" r="10" fill="rgba(255,255,255,0.15)" stroke="rgba(255,255,255,0.3)" strokeWidth="1"/>
                <circle cx="32" cy="32" r="4" fill="white" opacity="0.9"/>
              </svg>
            </div>
            <div className="ls-logo-title">FlowScribe</div>
            <div className="ls-logo-sub">AI-powered flowchart generator</div>
          </div>

          {/* Tabs */}
          <div className="ls-tabs">
            <button className={`ls-tab${tab==="login"?" active":""}`} onClick={()=>switchTab("login")}>Sign In</button>
            <button className={`ls-tab${tab==="register"?" active":""}`} onClick={()=>switchTab("register")}>Create Account</button>
          </div>

          {/* Form */}
          <div className={shake?"ls-shake":""}>

            {/* Username */}
            <div className="ls-field" style={fd(0)}>
              <label className="ls-field-label">Username</label>
              <div className="ls-input-wrap">
                <span className="ls-input-icon-left">{focused==="u"?"✨":"👤"}</span>
                <input className="ls-input" type="text" value={username}
                  onChange={e=>{setUser(e.target.value);setError("");}}
                  placeholder="Enter your username"
                  onFocus={()=>setFocus("u")} onBlur={()=>setFocus(null)}
                  onKeyDown={e=>e.key==="Enter"&&(tab==="login"?handleLogin():handleRegister())}
                  autoFocus/>
              </div>
            </div>

            {/* Password */}
            <div className="ls-field" style={fd(1)}>
              <label className="ls-field-label">Password</label>
              <div className="ls-input-wrap">
                <span className="ls-input-icon-left">{focused==="p"?"✨":"🔒"}</span>
                <input className="ls-input" type={showPw?"text":"password"} value={password}
                  onChange={e=>{setPw(e.target.value);setError("");}}
                  placeholder={tab==="register"?"Min 6 characters":"Your password"}
                  onFocus={()=>setFocus("p")} onBlur={()=>setFocus(null)}
                  onKeyDown={e=>e.key==="Enter"&&(tab==="login"?handleLogin():handleRegister())}
                  style={{paddingRight:"46px"}}/>
                <button className="ls-pw-eye" onClick={()=>setShowPw(v=>!v)}>{showPw?"🙈":"👁️"}</button>
              </div>
              {tab==="register"&&<PwStrength password={password}/>}
            </div>

            {/* Error */}
            {error&&(
              <div className="ls-error">
                <span style={{fontSize:"16px"}}>⚠️</span>
                <span>{error}</span>
              </div>
            )}

            {/* Button */}
            <button className="ls-btn" onClick={tab==="login"?handleLogin:handleRegister}
              disabled={loading} style={fd(2)}>
              {loading
                ? <span style={{display:"flex",alignItems:"center",justifyContent:"center",gap:"10px"}}>
                    <span className="ls-spin"/>Authenticating…
                  </span>
                : tab==="login" ? "Sign In →" : "Create Account →"}
            </button>
          </div>

          {/* Switch */}
          <div className="ls-div">
            <div className="ls-div-line"/>
            <span className="ls-div-text">{tab==="login"?"New here?":"Have an account?"}</span>
            <div className="ls-div-line"/>
          </div>
          <div className="ls-switch">
            <button className="ls-switch-btn" onClick={()=>switchTab(tab==="login"?"register":"login")}>
              {tab==="login"?"Create a free account":"Sign in instead"}
            </button>
          </div>

          {/* Trust badges */}
          <div className="ls-trust" style={{marginTop:"18px"}}>
            <div className="ls-trust-item">
              <div className="ls-trust-dot" style={{background:"#10B981",animationDelay:"0s"}}/>
              Local storage only
            </div>
            <div className="ls-trust-item">
              <div className="ls-trust-dot" style={{background:"#6366F1",animationDelay:"0.6s"}}/>
              Never shared
            </div>
            <div className="ls-trust-item">
              <div className="ls-trust-dot" style={{background:"#8B5CF6",animationDelay:"1.2s"}}/>
              Free to use
            </div>
          </div>

          <div className="ls-foot">🔒 Credentials stored locally · Never shared with anyone</div>
        </div>
      </div>
    </div>
  );
}



function ApiKeySetup({ username, onDone }) {
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
        body: JSON.stringify({model:"claude-haiku-4-5-20251001",max_tokens:10,messages:[{role:"user",content:"hi"}]})
      });
      if (!r.ok) { const e=await r.json(); throw new Error(e?.error?.message||"Invalid key"); }
      LS.set(KEYS.APIKEY, key); onDone(key);
    } catch(e) { setError(e.message||"Could not verify."); } finally { setTesting(false); }
  };
  return (
    <div className="login-wrap">
      <style>{GCSS}</style>
      <div className="orb" style={{width:500,height:500,background:"radial-gradient(circle,rgba(99,102,241,0.12),transparent)",top:"-100px",right:"-100px",animationDuration:"18s"}}/>
      <div className="login-card">
        <div style={{textAlign:"center",marginBottom:"24px"}}>
          <div style={{fontSize:"40px",marginBottom:"12px",animation:"float 3s ease-in-out infinite"}}>🔑</div>
          <h2 style={{fontSize:"22px",fontWeight:800,marginBottom:"6px"}}>Welcome, {username}! 👋</h2>
          <p style={{fontSize:"13px",color:"var(--text3)",lineHeight:1.6}}>Connect your Anthropic API key.<br/><b style={{color:"var(--text2)"}}>You only need to do this once.</b></p>
        </div>
        <div className="label" style={{marginBottom:"8px"}}>Anthropic API Key</div>
        <div style={{display:"flex",gap:"8px",marginBottom:"14px"}}>
          <input className="input" type={show?"text":"password"} value={key} onChange={e=>{setKey(e.target.value);setError("");}} placeholder="sk-ant-api03-…" onKeyDown={e=>e.key==="Enter"&&handleSave()} style={{flex:1}}/>
          <button className="btn btn-secondary" onClick={()=>setShow(v=>!v)} style={{padding:"10px 14px",flexShrink:0,fontSize:"13px"}}>{show?"Hide":"Show"}</button>
        </div>
        {error&&<div style={{fontSize:"13px",color:"#DC2626",marginBottom:"14px",padding:"10px 14px",background:"#FEF2F2",borderRadius:"8px",border:"1px solid #FECACA"}}>⚠️ {error}</div>}
        <button className="btn btn-primary" onClick={handleSave} disabled={!key||testing} style={{width:"100%",fontSize:"15px",padding:"13px",marginBottom:"20px"}}>
          {testing?<span style={{display:"flex",alignItems:"center",justifyContent:"center",gap:"8px"}}><span style={{width:"14px",height:"14px",border:"2px solid rgba(255,255,255,0.3)",borderTopColor:"white",borderRadius:"50%",display:"inline-block",animation:"spinSlow 0.7s linear infinite"}}/>Verifying…</span>:"Save & Continue →"}
        </button>
        <div style={{padding:"14px",background:"var(--surface)",borderRadius:"10px",border:"1px solid var(--border)"}}>
          <div className="label" style={{marginBottom:"10px"}}>How to get your key</div>
          <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:"8px"}}>
            {[["1","console.anthropic.com","🌐"],["2","Sign up / Log in","👤"],["3","API Keys → Create","🔐"],["4","Paste above","✅"]].map(([n,t,ic])=>(
              <div key={n} style={{padding:"8px 10px",background:"white",borderRadius:"8px",border:"1px solid var(--border)"}}>
                <div style={{fontSize:"10px",fontWeight:700,color:"#6366F1",marginBottom:"2px"}}>STEP {n}</div>
                <div style={{fontSize:"12px",color:"var(--text2)"}}>{ic} {t}</div>
              </div>
            ))}
          </div>
          <div style={{marginTop:"10px",padding:"8px 12px",background:"#ECFDF5",border:"1px solid #A7F3D0",borderRadius:"8px",fontSize:"12px",color:"#065F46",fontWeight:500}}>💚 ~$0.001 per analysis</div>
        </div>
      </div>
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
function ResultView({ data }) {
  const [activeNode, setActiveNode] = useState(null);
  const activeNodeData = data.nodes?.find(n => n.id === activeNode);
  const processCount = data.nodes?.filter(n=>n.type==="process").length||0;
  const decisionCount = data.nodes?.filter(n=>n.type==="decision").length||0;

  return (
    <div style={{flex:1,overflowY:"auto",padding:"24px 24px 80px",position:"relative"}}>
      {/* Header */}
      <div style={{marginBottom:"20px"}}>
        <div style={{display:"inline-flex",alignItems:"center",gap:"6px",background:"#ECFDF5",border:"1px solid #A7F3D0",borderRadius:"20px",padding:"5px 14px",fontSize:"12px",fontWeight:700,color:"#065F46",marginBottom:"12px",animation:"badgePop 0.4s ease both"}}>✅ Flowchart Generated</div>
        <h1 className="fade-up-1" style={{fontSize:"clamp(18px,2.5vw,26px)",fontWeight:800,letterSpacing:"-0.5px",marginBottom:"8px"}}>{data.title}</h1>
        <p className="fade-up-2" style={{fontSize:"14px",color:"var(--text2)",lineHeight:1.65,marginBottom:"14px",maxWidth:"680px"}}>{data.summary}</p>

        {/* Actors */}
        <div className="fade-up-2" style={{display:"flex",gap:"7px",flexWrap:"wrap",marginBottom:"14px"}}>
          {(data.actors||[]).map((a,i)=>(
            <div key={a.id} style={{padding:"4px 12px",borderRadius:"20px",fontSize:"12px",fontWeight:600,border:`1.5px solid ${COLORS[i%COLORS.length]}33`,background:`${COLORS[i%COLORS.length]}0D`,color:COLORS[i%COLORS.length]}}>{a.emoji} {a.name}</div>
          ))}
        </div>

        {/* Stats */}
        <div className="fade-up-3" style={{display:"inline-flex",gap:"20px",background:"white",border:"1.5px solid var(--border)",borderRadius:"12px",padding:"10px 18px",marginBottom:"16px"}}>
          {[{n:processCount,l:"Steps",c:"#6366F1"},{n:decisionCount,l:"Decisions",c:"#F59E0B"},{n:data.actors?.length||0,l:"Actors",c:"#8B5CF6"},{n:data.keyInsights?.length||0,l:"Insights",c:"#06B6D4"}].map(({n,l,c})=>(
            <div key={l} style={{textAlign:"center"}}>
              <div style={{fontSize:"20px",fontWeight:800,color:c,lineHeight:1}}>{n}</div>
              <div style={{fontSize:"10px",color:"var(--text3)",fontWeight:600,marginTop:"3px"}}>{l}</div>
            </div>
          ))}
        </div>

        <div className="fade-up-3"><div className="label" style={{marginBottom:"8px"}}>Export</div><ExportBar data={data}/></div>
      </div>

      {/* Legend */}
      <div style={{display:"flex",alignItems:"center",gap:"16px",marginBottom:"16px",flexWrap:"wrap"}}>
        <div style={{display:"flex",alignItems:"center",gap:"6px",fontSize:"11px",color:"var(--text3)",fontWeight:600}}>
          <div style={{width:"28px",height:"16px",background:"#4F46E5",borderRadius:"8px"}}/>START / END
        </div>
        <div style={{display:"flex",alignItems:"center",gap:"6px",fontSize:"11px",color:"var(--text3)",fontWeight:600}}>
          <div style={{width:"24px",height:"16px",background:"white",border:"2px solid #6366F1",borderRadius:"4px"}}/>PROCESS
        </div>
        <div style={{display:"flex",alignItems:"center",gap:"6px",fontSize:"11px",color:"var(--text3)",fontWeight:600}}>
          <div style={{width:"20px",height:"16px",background:"#FFFBEB",border:"2px solid #FDE68A",transform:"rotate(45deg)",flexShrink:0}}/>DECISION
        </div>
        <div style={{display:"flex",alignItems:"center",gap:"6px",fontSize:"11px",color:"var(--text3)",fontWeight:600}}>
          <div style={{width:"24px",height:"2px",background:"#10B981"}}/>YES
        </div>
        <div style={{display:"flex",alignItems:"center",gap:"6px",fontSize:"11px",color:"var(--text3)",fontWeight:600}}>
          <div style={{width:"24px",height:"2px",background:"#EF4444",borderTop:"2px dashed #EF4444"}}/>NO
        </div>
        <div style={{marginLeft:"auto",fontSize:"11px",color:"var(--text3)"}}>👆 Click any node for details</div>
      </div>

      {/* THE REAL FLOWCHART */}
      <div className="card" style={{padding:"8px",marginBottom:"24px",overflow:"hidden",animation:"badgePop 0.5s ease both"}}>
        <FlowchartSVG data={data} onNodeClick={setActiveNode} activeNode={activeNode}/>
      </div>

      {/* Insights */}
      {data.keyInsights?.length>0&&(
        <div className="card" style={{padding:"18px 20px",maxWidth:"680px"}}>
          <div style={{display:"flex",alignItems:"center",gap:"8px",marginBottom:"12px"}}>
            <span style={{fontSize:"16px"}}>💡</span>
            <div className="label" style={{margin:0}}>Key Insights</div>
          </div>
          {data.keyInsights.map((ins,i)=>(
            <div key={i} style={{fontSize:"13px",color:"var(--text2)",marginBottom:"8px",padding:"8px 12px",background:`${COLORS[i%COLORS.length]}05`,borderLeft:`3px solid ${COLORS[i%COLORS.length]}44`,borderRadius:"0 6px 6px 0",lineHeight:1.6,transition:"transform 0.15s",cursor:"default"}} onMouseEnter={e=>e.currentTarget.style.transform="translateX(4px)"} onMouseLeave={e=>e.currentTarget.style.transform=""}>{ins}</div>
          ))}
        </div>
      )}

      {/* Node detail popup */}
      {activeNode && <NodeDetail node={activeNodeData} actors={data.actors} onClose={()=>setActiveNode(null)}/>}
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
  const [username, setUsername] = useState(()=>LS.get(KEYS.SESSION)?.username||"");
  const [apiKey, setApiKey] = useState(()=>LS.get(KEYS.APIKEY)||"");
  const [history, setHistory] = useState(()=>LS.get(KEYS.HISTORY)||[]);
  const [currentData, setCurrentData] = useState(null);
  const [currentId, setCurrentId] = useState(null);
  const [stage, setStage] = useState("upload");
  const [progress, setProgress] = useState("");
  const [progressPct, setProgressPct] = useState(0);
  const [errorMsg, setErrorMsg] = useState("");
  const [showHistory, setShowHistory] = useState(true);

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
          <div style={{fontSize:"13px",color:"var(--text3)",fontWeight:500}}>👤 {username}</div>
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

          {stage==="result"&&currentData&&<div style={{flex:1,overflow:"hidden",display:"flex",flexDirection:"column"}}><ResultView data={currentData}/></div>}

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