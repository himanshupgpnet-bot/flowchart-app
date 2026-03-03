import { useState, useRef, useCallback } from "react";

const COLORS = ["#6366F1","#8B5CF6","#06B6D4","#10B981","#F59E0B","#EF4444","#EC4899","#3B82F6"];

const extractJSON = (text) => {
  try {
    const match = text.match(/```json\s*([\s\S]*?)```/) || text.match(/(\{[\s\S]*\})/);
    if (match) return JSON.parse(match[1]);
    return JSON.parse(text);
  } catch { return null; }
};

async function analyzeTranscript(text, apiKey) {
  const prompt = `You are a business process analyst. Read this transcript or document and extract a clear AS/IS process flowchart.

Return ONLY a JSON object in this exact format, no markdown, no explanation:
{
  "title": "Process title (short, clear)",
  "summary": "One sentence describing the overall process",
  "actors": [{"id": "a1", "name": "Person/System Name", "emoji": "👤"}],
  "phases": [
    {
      "id": 1,
      "title": "Phase title",
      "actorId": "a1",
      "icon": "📋",
      "description": "What happens in this phase",
      "steps": ["Step 1", "Step 2", "Step 3"],
      "output": "What is produced",
      "note": "Important note or warning if any",
      "isDecision": false,
      "decisionQuestion": "",
      "decisionYes": "",
      "decisionNo": ""
    }
  ],
  "keyInsights": ["Insight 1", "Insight 2", "Insight 3"]
}

Rules:
- Extract 4-8 phases maximum
- Keep steps concise (max 8 per phase)
- Identify real decision points and mark isDecision: true
- Pick relevant emojis for icons
- keyInsights should highlight risks, bottlenecks, or important observations

TRANSCRIPT/DOCUMENT:
${text.substring(0, 8000)}`;

  const response = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": apiKey,
      "anthropic-version": "2023-06-01",
      "anthropic-dangerous-direct-browser-access": "true"
    },
    body: JSON.stringify({
      model: "claude-haiku-4-5-20251001",
      max_tokens: 2000,
      messages: [{ role: "user", content: prompt }]
    })
  });

  if (!response.ok) {
    const err = await response.json();
    throw new Error(err?.error?.message || `API Error: ${response.status}`);
  }

  const data = await response.json();
  const rawText = data.content?.map(c => c.text || "").join("") || "";
  const parsed = extractJSON(rawText);
  if (!parsed) throw new Error("Could not parse AI response. Please try again.");
  return parsed;
}

const S = {
  page: { minHeight: "100vh", background: "#F8FAFF", fontFamily: "'Segoe UI', system-ui, sans-serif", color: "#1E293B" },
  nav: { background: "rgba(255,255,255,0.9)", backdropFilter: "blur(20px)", borderBottom: "1px solid #E2E8F0", padding: "0 32px", height: "64px", display: "flex", alignItems: "center", justifyContent: "space-between", position: "sticky", top: 0, zIndex: 100 },
  logoIcon: { width: "36px", height: "36px", borderRadius: "10px", background: "linear-gradient(135deg, #6366F1, #8B5CF6)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "18px" },
  logoText: { fontSize: "20px", fontWeight: "800", background: "linear-gradient(135deg, #6366F1, #8B5CF6)", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent" },
  badge: { background: "#EEF2FF", border: "1px solid #C7D2FE", borderRadius: "20px", padding: "4px 12px", fontSize: "11px", color: "#6366F1", fontWeight: "700" },
  card: { background: "#FFFFFF", borderRadius: "20px", border: "1px solid #E2E8F0", boxShadow: "0 4px 24px rgba(99,102,241,0.06)", padding: "28px" },
  btn: { borderRadius: "12px", padding: "12px 28px", fontSize: "14px", fontWeight: "700", cursor: "pointer", border: "none", transition: "all 0.2s" },
  btnPrimary: { background: "linear-gradient(135deg, #6366F1, #8B5CF6)", color: "#fff", boxShadow: "0 4px 14px rgba(99,102,241,0.35)" },
  btnSecondary: { background: "#F1F5F9", color: "#475569", border: "1px solid #E2E8F0" },
  input: { width: "100%", background: "#F8FAFF", border: "1px solid #E2E8F0", borderRadius: "12px", padding: "13px 16px", fontSize: "14px", color: "#1E293B", outline: "none", fontFamily: "inherit", transition: "border-color 0.2s", boxSizing: "border-box" },
};

function ApiKeyScreen({ onSave }) {
  const [key, setKey] = useState("");
  const [show, setShow] = useState(false);
  const [error, setError] = useState("");
  const [testing, setTesting] = useState(false);

  const handleSave = async () => {
    if (!key.startsWith("sk-ant-")) { setError("Invalid key — must start with sk-ant-"); return; }
    setTesting(true); setError("");
    try {
      const res = await fetch("https://api.anthropic.com/v1/messages", {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-api-key": key, "anthropic-version": "2023-06-01", "anthropic-dangerous-direct-browser-access": "true" },
        body: JSON.stringify({ model: "claude-haiku-4-5-20251001", max_tokens: 10, messages: [{ role: "user", content: "hi" }] })
      });
      if (!res.ok) { const e = await res.json(); throw new Error(e?.error?.message || "Invalid API key"); }
      onSave(key);
    } catch (e) { setError(e.message || "Could not verify key."); }
    finally { setTesting(false); }
  };

  return (
    <div style={{ ...S.page, display: "flex", flexDirection: "column" }}>
      <style>{`
        @keyframes float { 0%,100%{transform:translateY(0)} 50%{transform:translateY(-10px)} }
        @keyframes fadeIn { from{opacity:0;transform:translateY(20px)} to{opacity:1;transform:translateY(0)} }
        @keyframes gradientShift { 0%{background-position:0% 50%} 50%{background-position:100% 50%} 100%{background-position:0% 50%} }
        .btn-primary:hover { transform:translateY(-2px); box-shadow:0 8px 24px rgba(99,102,241,0.45) !important; }
        input:focus { border-color:#6366F1 !important; box-shadow:0 0 0 3px rgba(99,102,241,0.1); }
      `}</style>

      <nav style={S.nav}>
        <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
          <div style={S.logoIcon}>🧠</div>
          <span style={S.logoText}>MindMap AI</span>
        </div>
        <div style={S.badge}>✦ </div>
      </nav>

      <div style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", padding: "40px 20px", background: "radial-gradient(ellipse at top, #EEF2FF 0%, #F8FAFF 60%)" }}>
        <div style={{ width: "100%", maxWidth: "460px", animation: "fadeIn 0.6s ease" }}>

          <div style={{ textAlign: "center", marginBottom: "32px" }}>
            <div style={{ fontSize: "72px", animation: "float 3s ease-in-out infinite", display: "inline-block", marginBottom: "8px" }}>🧠</div>
            <h1 style={{ fontSize: "30px", fontWeight: "900", color: "#0F172A", margin: "0 0 8px" }}>Welcome to MindMap AI</h1>
            <p style={{ color: "#64748B", fontSize: "14px", lineHeight: 1.7, margin: 0 }}>
              Your AI-powered process intelligence tool.<br/>Enter your API key to get started.
            </p>
          </div>

          <div style={{ ...S.card, animation: "fadeIn 0.7s ease" }}>
            <div style={{ fontSize: "11px", fontWeight: "700", color: "#6366F1", letterSpacing: "1.5px", marginBottom: "10px" }}>ANTHROPIC API KEY</div>
            <div style={{ display: "flex", gap: "8px", marginBottom: "10px" }}>
              <input type={show ? "text" : "password"} value={key} onChange={e => { setKey(e.target.value); setError(""); }}
                placeholder="sk-ant-api03-..." onKeyDown={e => e.key === "Enter" && handleSave()}
                style={{ ...S.input, borderColor: error ? "#FCA5A5" : key.startsWith("sk-ant-") ? "#6EE7B7" : "#E2E8F0" }}
              />
              <button onClick={() => setShow(!show)} style={{ ...S.btn, ...S.btnSecondary, padding: "12px 14px", fontSize: "16px" }}>
                {show ? "🙈" : "👁️"}
              </button>
            </div>

            {error && <div style={{ background: "#FEF2F2", border: "1px solid #FECACA", borderRadius: "10px", padding: "10px 14px", fontSize: "13px", color: "#DC2626", marginBottom: "12px" }}>⚠️ {error}</div>}

            <button className="btn-primary" onClick={handleSave} disabled={!key || testing}
              style={{ ...S.btn, ...S.btnPrimary, width: "100%", opacity: key ? 1 : 0.5, cursor: key ? "pointer" : "not-allowed" }}>
              {testing ? "⏳ Verifying..." : "✦ Launch MindMap AI →"}
            </button>

            <div style={{ marginTop: "20px", background: "#F8FAFF", borderRadius: "14px", padding: "16px", border: "1px solid #E2E8F0" }}>
              <div style={{ fontSize: "11px", fontWeight: "700", color: "#94A3B8", letterSpacing: "1px", marginBottom: "12px" }}>HOW TO GET YOUR KEY</div>
              {[["1","Visit","console.anthropic.com"],["2","Sign up or log in",""],["3","API Keys → Create Key",""],["4","Copy & paste above",""]].map(([n,t,l]) => (
                <div key={n} style={{ display: "flex", gap: "10px", marginBottom: "8px", alignItems: "center" }}>
                  <span style={{ minWidth: "22px", height: "22px", borderRadius: "6px", background: "linear-gradient(135deg,#6366F1,#8B5CF6)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "11px", color: "#fff", fontWeight: "700", flexShrink: 0 }}>{n}</span>
                  <span style={{ fontSize: "13px", color: "#64748B" }}>{t} {l && <a href={`https://${l}`} target="_blank" rel="noreferrer" style={{ color: "#6366F1", fontWeight: "600", textDecoration: "none" }}>{l}</a>}</span>
                </div>
              ))}
              <div style={{ marginTop: "10px", background: "#ECFDF5", border: "1px solid #A7F3D0", borderRadius: "8px", padding: "8px 12px", fontSize: "12px", color: "#065F46", fontWeight: "500" }}>
                💡 Cost: ~$0.001 per analysis. Very affordable!
              </div>
            </div>
          </div>

          <p style={{ textAlign: "center", fontSize: "11px", color: "#CBD5E1", marginTop: "16px" }}>
            🔒 Your key stays in your browser session only — never stored
          </p>
        </div>
      </div>
    </div>
  );
}

function FlowchartView({ data }) {
  const [active, setActive] = useState(null);
  const getActorColor = (actorId) => { const idx = data.actors?.findIndex(a => a.id === actorId) ?? 0; return COLORS[idx % COLORS.length]; };
  const getActor = (actorId) => data.actors?.find(a => a.id === actorId);

  const handleSave = () => {
    const html = `<!DOCTYPE html><html><head><meta charset="UTF-8"/><title>${data.title} — MindMap AI</title>
<style>*{box-sizing:border-box;margin:0;padding:0}body{background:#F8FAFF;font-family:'Segoe UI',sans-serif;color:#1E293B;padding:40px 20px}.wrap{max-width:760px;margin:0 auto}.hdr{text-align:center;margin-bottom:40px}.logo{display:inline-flex;align-items:center;gap:8px;margin-bottom:16px}.li{width:32px;height:32px;border-radius:8px;background:linear-gradient(135deg,#6366F1,#8B5CF6);display:flex;align-items:center;justify-content:center;font-size:16px}.lt{font-size:18px;font-weight:800;background:linear-gradient(135deg,#6366F1,#8B5CF6);-webkit-background-clip:text;-webkit-text-fill-color:transparent}h1{font-size:28px;font-weight:900;color:#0F172A;margin-bottom:8px}.sum{color:#64748B;font-size:14px}.actors{display:flex;gap:8px;justify-content:center;flex-wrap:wrap;margin:14px 0}.actor{padding:5px 14px;border-radius:20px;font-size:12px;font-weight:600;border:1px solid}.phase{background:#fff;border-radius:16px;border:1px solid #E2E8F0;padding:20px;margin-bottom:4px;box-shadow:0 2px 8px rgba(0,0,0,0.04)}.ph{display:flex;align-items:center;gap:14px;margin-bottom:14px}.pi{width:44px;height:44px;border-radius:12px;display:flex;align-items:center;justify-content:center;font-size:20px}.pt{font-size:15px;font-weight:700;color:#0F172A}.pa{font-size:11px;font-weight:600;margin-top:2px}.grid{display:grid;grid-template-columns:1fr 1fr;gap:18px}.lbl{font-size:11px;font-weight:700;letter-spacing:1px;margin-bottom:8px}.step{display:flex;gap:10px;margin-bottom:7px;font-size:13px;color:#475569;align-items:flex-start}.sn{min-width:20px;height:20px;border-radius:5px;display:flex;align-items:center;justify-content:center;font-size:10px;font-weight:700;flex-shrink:0;margin-top:1px}.out{border-radius:10px;padding:12px 14px;font-size:13px;margin-bottom:12px;line-height:1.5}.note{background:#F8FAFF;border:1px solid #E2E8F0;border-radius:10px;padding:10px 14px;font-size:12px;color:#64748B;line-height:1.5}.conn{display:flex;flex-direction:column;align-items:center;height:28px}.cl{width:2px;flex:1}.ca{width:0;height:0;border-left:5px solid transparent;border-right:5px solid transparent}.ins{background:#fff;border:1px solid #E2E8F0;border-radius:16px;padding:20px;margin-top:24px}.ins-t{font-size:11px;font-weight:700;letter-spacing:1px;color:#6366F1;margin-bottom:12px}.ins-i{font-size:13px;color:#475569;margin-bottom:10px;padding-left:12px;border-left:3px solid #6366F133;line-height:1.5}.footer{text-align:center;margin-top:24px;font-size:12px;color:#94A3B8}</style>
</head><body>
<div class="hdr"><div class="logo"><div class="li">🧠</div><div class="lt">MindMap AI</div></div>
<h1>${data.title}</h1><p class="sum">${data.summary}</p>
<div class="actors">${(data.actors||[]).map((a,i)=>`<div class="actor" style="color:${COLORS[i%COLORS.length]};border-color:${COLORS[i%COLORS.length]}44;background:${COLORS[i%COLORS.length]}11">${a.emoji} ${a.name}</div>`).join("")}</div></div>
<div class="wrap">
${(data.phases||[]).map((p,idx)=>{const c=getActorColor(p.actorId);const a=getActor(p.actorId);return`
<div class="phase" style="border-color:${c}33">
<div class="ph"><div class="pi" style="background:${c}15;border:1px solid ${c}33">${p.icon}</div>
<div><div class="pt">${p.title}</div><div class="pa" style="color:${c}">${a?.emoji||""} ${a?.name||""}</div></div>
<div style="margin-left:auto;background:${c}11;border:1px solid ${c}33;border-radius:8px;padding:3px 10px;font-size:11px;font-weight:700;color:${c}">STEP ${idx+1}</div></div>
<p style="font-size:13px;color:#64748B;font-style:italic;border-left:3px solid ${c}44;padding-left:10px;margin-bottom:14px;line-height:1.5">${p.description}</p>
<div class="grid">
<div><div class="lbl" style="color:${c}">PROCESS STEPS</div>
${p.steps.map((s,i)=>`<div class="step"><span class="sn" style="background:${c}15;color:${c}">${i+1}</span><span>${s}</span></div>`).join("")}
${p.isDecision?`<div style="background:#FFFBEB;border:1px solid #FDE68A;border-radius:8px;padding:10px 12px;font-size:12px;margin-top:8px"><b style="color:#92400E">◆ ${p.decisionQuestion}</b><br><span style="color:#065F46">✅ ${p.decisionYes}</span><br><span style="color:#DC2626">❌ ${p.decisionNo}</span></div>`:""}
</div>
<div><div class="lbl" style="color:${c}">OUTPUT</div>
<div class="out" style="background:${c}11;border:1px solid ${c}33">✅ ${p.output}</div>
${p.note?`<div class="note">💡 ${p.note}</div>`:""}
</div></div></div>
${idx<data.phases.length-1?`<div class="conn"><div class="cl" style="background:linear-gradient(180deg,${c}66,${getActorColor(data.phases[idx+1].actorId)}66)"></div><div class="ca" style="border-top:7px solid ${getActorColor(data.phases[idx+1].actorId)}99"></div></div>`:""}`}).join("")}
<div class="ins"><div class="ins-t">✦ KEY INSIGHTS</div>${(data.keyInsights||[]).map(i=>`<div class="ins-i">${i}</div>`).join("")}</div>
</div>
<div class="footer">Generated by MindMap AI</div>
</body></html>`;
    const blob = new Blob([html],{type:"text/html"});
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href=url; a.download=`${data.title.replace(/\s+/g,"_")}_mindmap.html`; a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div style={{ maxWidth: "800px", margin: "0 auto", padding: "0 20px 60px" }}>
      <div style={{ textAlign: "center", marginBottom: "32px" }}>
        <div style={{ display: "inline-flex", alignItems: "center", gap: "6px", background: "#ECFDF5", border: "1px solid #A7F3D0", borderRadius: "20px", padding: "5px 14px", fontSize: "12px", color: "#065F46", fontWeight: "600", marginBottom: "16px" }}>✅ Analysis Complete</div>
        <h2 style={{ fontSize: "clamp(22px,3vw,30px)", fontWeight: "900", color: "#0F172A", margin: "0 0 8px" }}>{data.title}</h2>
        <p style={{ color: "#64748B", fontSize: "14px", margin: "0 0 18px", lineHeight: 1.6 }}>{data.summary}</p>
        <div style={{ display: "flex", gap: "8px", justifyContent: "center", flexWrap: "wrap", marginBottom: "20px" }}>
          {(data.actors||[]).map((a,i) => (
            <div key={a.id} style={{ display: "flex", alignItems: "center", gap: "6px", background: `${COLORS[i%COLORS.length]}11`, border: `1px solid ${COLORS[i%COLORS.length]}33`, borderRadius: "20px", padding: "5px 14px", fontSize: "12px", color: COLORS[i%COLORS.length], fontWeight: "600" }}>
              {a.emoji} {a.name}
            </div>
          ))}
        </div>
        <button className="btn-primary" onClick={handleSave} style={{ ...S.btn, ...S.btnPrimary }}>💾 Save as HTML File</button>
      </div>

      <div style={{ display: "flex", flexDirection: "column" }}>
        {(data.phases||[]).map((phase, index) => {
          const color = getActorColor(phase.actorId);
          const actor = getActor(phase.actorId);
          const isActive = active === phase.id;
          return (
            <div key={phase.id} style={{ display: "flex", flexDirection: "column", alignItems: "center" }}>
              <div onClick={() => setActive(isActive ? null : phase.id)} className="hover-card"
                style={{ width: "100%", background: "#fff", border: `1px solid ${isActive ? color+"66" : "#E2E8F0"}`, borderRadius: isActive ? "16px 16px 0 0" : "16px", padding: "16px 20px", cursor: "pointer", transition: "all 0.2s", display: "flex", alignItems: "center", gap: "14px", boxShadow: isActive ? `0 4px 20px ${color}22` : "0 2px 8px rgba(0,0,0,0.04)" }}>
                <div style={{ minWidth: "48px", height: "48px", borderRadius: "12px", background: `${color}15`, border: `1px solid ${color}33`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: "22px" }}>{phase.icon}</div>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: "15px", fontWeight: "700", color: "#0F172A", marginBottom: "3px" }}>{phase.title}</div>
                  <div style={{ fontSize: "12px", color, fontWeight: "600" }}>{actor?.emoji} {actor?.name}</div>
                </div>
                <div style={{ background: `${color}11`, border: `1px solid ${color}33`, borderRadius: "8px", padding: "3px 10px", fontSize: "11px", color, fontWeight: "700" }}>STEP {index+1}</div>
                <div style={{ color, fontSize: "22px", transition: "transform 0.2s", transform: isActive ? "rotate(90deg)" : "rotate(0deg)" }}>›</div>
              </div>

              {isActive && (
                <div style={{ width: "100%", background: "#FAFBFF", border: `1px solid ${color}44`, borderTop: "none", borderRadius: "0 0 16px 16px", padding: "18px 20px 22px" }}>
                  <p style={{ fontSize: "13px", color: "#64748B", margin: "0 0 16px", lineHeight: 1.6, fontStyle: "italic", borderLeft: `3px solid ${color}44`, paddingLeft: "12px" }}>{phase.description}</p>
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "20px" }}>
                    <div>
                      <div style={{ fontSize: "11px", fontWeight: "700", color, letterSpacing: "1px", marginBottom: "10px" }}>PROCESS STEPS</div>
                      {phase.steps.map((step,i) => (
                        <div key={i} style={{ display: "flex", gap: "10px", marginBottom: "8px", alignItems: "flex-start" }}>
                          <span style={{ minWidth: "22px", height: "22px", borderRadius: "6px", background: `${color}15`, border: `1px solid ${color}33`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: "11px", color, fontWeight: "700", marginTop: "1px", flexShrink: 0 }}>{i+1}</span>
                          <span style={{ fontSize: "13px", color: "#475569", lineHeight: 1.5 }}>{step}</span>
                        </div>
                      ))}
                      {phase.isDecision && (
                        <div style={{ marginTop: "12px", background: "#FFFBEB", border: "1px solid #FDE68A", borderRadius: "10px", padding: "12px 14px", fontSize: "12px" }}>
                          <div style={{ fontWeight: "700", color: "#92400E", marginBottom: "6px" }}>◆ {phase.decisionQuestion}</div>
                          <div style={{ color: "#065F46", marginBottom: "4px" }}>✅ YES → {phase.decisionYes}</div>
                          <div style={{ color: "#DC2626" }}>❌ NO → {phase.decisionNo}</div>
                        </div>
                      )}
                    </div>
                    <div>
                      <div style={{ fontSize: "11px", fontWeight: "700", color, letterSpacing: "1px", marginBottom: "10px" }}>OUTPUT</div>
                      <div style={{ background: `${color}11`, border: `1px solid ${color}33`, borderRadius: "10px", padding: "12px 14px", fontSize: "13px", color: "#1E293B", marginBottom: "14px", lineHeight: 1.5 }}>✅ {phase.output}</div>
                      {phase.note && (<>
                        <div style={{ fontSize: "11px", fontWeight: "700", color: "#94A3B8", letterSpacing: "1px", marginBottom: "8px" }}>NOTE</div>
                        <div style={{ background: "#F8FAFF", border: "1px solid #E2E8F0", borderRadius: "10px", padding: "10px 14px", fontSize: "12px", color: "#64748B", lineHeight: 1.5 }}>💡 {phase.note}</div>
                      </>)}
                    </div>
                  </div>
                </div>
              )}

              {index < data.phases.length-1 && (
                <div style={{ display: "flex", flexDirection: "column", alignItems: "center", height: "28px" }}>
                  <div style={{ width: "2px", flex: 1, background: `linear-gradient(180deg,${color}66,${getActorColor(data.phases[index+1].actorId)}66)` }}/>
                  <div style={{ width: 0, height: 0, borderLeft: "5px solid transparent", borderRight: "5px solid transparent", borderTop: `7px solid ${getActorColor(data.phases[index+1].actorId)}99` }}/>
                </div>
              )}
            </div>
          );
        })}
      </div>

      {data.keyInsights?.length > 0 && (
        <div style={{ background: "#fff", border: "1px solid #E2E8F0", borderRadius: "16px", padding: "20px", marginTop: "24px", boxShadow: "0 2px 8px rgba(0,0,0,0.04)" }}>
          <div style={{ fontSize: "11px", fontWeight: "700", color: "#6366F1", letterSpacing: "1px", marginBottom: "14px" }}>✦ KEY INSIGHTS</div>
          {data.keyInsights.map((insight,i) => (
            <div key={i} style={{ fontSize: "13px", color: "#475569", marginBottom: "10px", paddingLeft: "14px", borderLeft: "3px solid #6366F133", lineHeight: 1.6 }}>{insight}</div>
          ))}
        </div>
      )}

      <div style={{ textAlign: "center", marginTop: "28px" }}>
        <button className="btn-primary" onClick={handleSave} style={{ ...S.btn, ...S.btnPrimary }}>💾 Save Flowchart as HTML File</button>
      </div>
    </div>
  );
}

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
  const fileInputRef = useRef(null);

  const run = useCallback(async (text, name) => {
    setFileName(name); setStage("processing"); setProgress("Reading document...");
    try {
      setProgress("Analyzing your document....");
      const result = await analyzeTranscript(text, apiKey);
      setProgress("Building your flowchart...");
      await new Promise(r => setTimeout(r, 400));
      setFlowData(result); setStage("result");
    } catch (err) { setErrorMsg(err.message || "Something went wrong."); setStage("error"); }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [apiKey]);

  const readFile = (file) => new Promise((res, rej) => {
    if (file.type === "application/pdf") { res(`[PDF: ${file.name}] Please paste the text content for best results.`); return; }
    const reader = new FileReader(); reader.onload = e => res(e.target.result); reader.onerror = rej; reader.readAsText(file);
  });

  const handleDrop = useCallback(async (e) => {
    e.preventDefault(); setDragOver(false);
    const file = e.dataTransfer.files[0];
    if (file) { const text = await readFile(file); run(text, file.name); }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [run]);

  const handleFileChange = async (e) => {
    const file = e.target.files[0];
    if (file) { const text = await readFile(file); run(text, file.name); }
  };

  const reset = () => { setStage("upload"); setFlowData(null); setFileName(""); setPasteText(""); setShowPaste(false); setErrorMsg(""); };

  if (!apiKey) return <ApiKeyScreen onSave={setApiKey} />;

  return (
    <div style={S.page}>
      <style>{`
        @keyframes fadeIn{from{opacity:0;transform:translateY(16px)}to{opacity:1;transform:translateY(0)}}
        @keyframes spin{from{transform:rotate(0deg)}to{transform:rotate(360deg)}}
        @keyframes pulse{0%,100%{opacity:1}50%{opacity:0.4}}
        .btn-primary:hover{transform:translateY(-2px);box-shadow:0 8px 24px rgba(99,102,241,0.45) !important;}
        .hover-card:hover{box-shadow:0 8px 28px rgba(99,102,241,0.12) !important;transform:translateY(-1px);}
        input:focus,textarea:focus{border-color:#6366F1 !important;box-shadow:0 0 0 3px rgba(99,102,241,0.1);outline:none;}
        .drop-zone:hover{border-color:#6366F1 !important;background:#EEF2FF !important;}
      `}</style>

      <nav style={S.nav}>
        <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
          <div style={S.logoIcon}>🧠</div>
          <span style={S.logoText}>MindMap AI</span>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
          {stage === "result" && <button onClick={reset} style={{ ...S.btn, ...S.btnSecondary, padding: "8px 18px", fontSize: "13px" }}>← New Analysis</button>}
          <button onClick={() => setApiKey("")} style={{ ...S.btn, background: "transparent", border: "none", color: "#94A3B8", fontSize: "12px", padding: "8px" }}>🔑 Change Key</button>
          <div style={S.badge}>✦ AI Ready</div>
        </div>
      </nav>

      {stage === "upload" && (
        <div style={{ maxWidth: "660px", margin: "0 auto", padding: "48px 20px", animation: "fadeIn 0.5s ease" }}>
          <div style={{ textAlign: "center", marginBottom: "40px" }}>
            <div style={{ display: "inline-flex", alignItems: "center", gap: "6px", background: "#EEF2FF", border: "1px solid #C7D2FE", borderRadius: "20px", padding: "5px 14px", fontSize: "12px", color: "#6366F1", fontWeight: "600", marginBottom: "18px" }}>
              ✦ AI-Powered Process Intelligence
            </div>
            <h1 style={{ fontSize: "clamp(28px,4vw,44px)", fontWeight: "900", color: "#0F172A", margin: "0 0 14px", lineHeight: 1.1 }}>
              Turn any transcript into a{" "}
              <span style={{ background: "linear-gradient(135deg,#6366F1,#8B5CF6)", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent" }}>smart flowchart</span>
            </h1>
            <p style={{ color: "#64748B", fontSize: "15px", lineHeight: 1.7, margin: "0 auto", maxWidth: "460px" }}>
              Upload a meeting transcript, SOP, or any document — MindMap AI extracts the process and builds an interactive flowchart instantly.
            </p>
          </div>

          <div className="drop-zone" onDragOver={e => { e.preventDefault(); setDragOver(true); }} onDragLeave={() => setDragOver(false)} onDrop={handleDrop} onClick={() => fileInputRef.current?.click()}
            style={{ ...S.card, border: `2px dashed ${dragOver ? "#6366F1" : "#C7D2FE"}`, background: dragOver ? "#EEF2FF" : "#fff", textAlign: "center", cursor: "pointer", padding: "52px 32px", marginBottom: "16px", transition: "all 0.2s" }}>
            <div style={{ fontSize: "52px", marginBottom: "14px" }}>📂</div>
            <div style={{ fontSize: "18px", fontWeight: "700", color: "#0F172A", marginBottom: "6px" }}>Drop your file here</div>
            <div style={{ fontSize: "13px", color: "#94A3B8", marginBottom: "18px" }}>or click to browse your computer</div>
            <div style={{ display: "flex", gap: "8px", justifyContent: "center", flexWrap: "wrap" }}>
              {[".TXT",".MD",".CSV",".DOCX",".PDF"].map(ext => (
                <span key={ext} style={{ display: "inline-flex", alignItems: "center", background: "#EEF2FF", borderRadius: "8px", padding: "4px 12px", fontSize: "12px", color: "#6366F1", fontWeight: "600" }}>{ext}</span>
              ))}
            </div>
          </div>
          <input ref={fileInputRef} type="file" accept=".txt,.md,.csv,.pdf,.docx,.doc" onChange={handleFileChange} style={{ display: "none" }}/>

          <div style={{ display: "flex", alignItems: "center", gap: "16px", margin: "20px 0" }}>
            <div style={{ flex: 1, height: "1px", background: "#E2E8F0" }}/>
            <span style={{ color: "#94A3B8", fontSize: "12px", fontWeight: "600" }}>OR PASTE TEXT DIRECTLY</span>
            <div style={{ flex: 1, height: "1px", background: "#E2E8F0" }}/>
          </div>

          <div style={{ ...S.card, padding: 0, overflow: "hidden", marginBottom: "24px" }}>
            <div onClick={() => setShowPaste(true)} style={{ padding: "16px 20px", display: "flex", alignItems: "center", justifyContent: "space-between", cursor: "pointer", borderBottom: showPaste ? "1px solid #E2E8F0" : "none" }}>
              <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
                <span style={{ fontSize: "22px" }}>📋</span>
                <div>
                  <div style={{ fontSize: "14px", fontWeight: "600", color: "#1E293B" }}>Paste transcript or text</div>
                  <div style={{ fontSize: "12px", color: "#94A3B8" }}>Meeting notes, SOPs, chat exports...</div>
                </div>
              </div>
              <div style={{ color: "#6366F1", fontSize: "22px", transform: showPaste ? "rotate(90deg)" : "rotate(0deg)", transition: "transform 0.2s" }}>›</div>
            </div>
            {showPaste && (
              <div style={{ padding: "16px 20px 20px" }}>
                <textarea value={pasteText} onChange={e => setPasteText(e.target.value)} autoFocus
                  placeholder={"Paste your content here...\n\nExample:\nLucas: OK so first we log into the system...\nHimanshu: What format should the file be?\nLucas: It must be semicolon separated..."}
                  style={{ ...S.input, minHeight: "180px", resize: "vertical", lineHeight: 1.6, padding: "14px" }}
                />
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: "12px" }}>
                  <span style={{ fontSize: "12px", fontWeight: "600", color: pasteText.length < 50 ? "#94A3B8" : "#10B981" }}>
                    {pasteText.length < 50 ? `${pasteText.length} chars — need 50+` : `✅ ${pasteText.length} chars — ready!`}
                  </span>
                  <div style={{ display: "flex", gap: "8px" }}>
                    <button onClick={() => { setPasteText(""); setShowPaste(false); }} style={{ ...S.btn, ...S.btnSecondary, padding: "8px 16px", fontSize: "13px" }}>Clear</button>
                    <button className="btn-primary" onClick={() => pasteText.trim().length >= 50 && run(pasteText, "Pasted text")} disabled={pasteText.trim().length < 50}
                      style={{ ...S.btn, ...S.btnPrimary, padding: "8px 20px", fontSize: "13px", opacity: pasteText.trim().length >= 50 ? 1 : 0.5, cursor: pasteText.trim().length >= 50 ? "pointer" : "not-allowed" }}>
                      ✦ Analyze Now
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>

          <div style={{ display: "flex", gap: "10px", justifyContent: "center", flexWrap: "wrap" }}>
            {[["⚡","Instant analysis"],["🎯","Extracts key steps"],["🔀","Decision points"],["💾","Save to computer"]].map(([icon,label]) => (
              <div key={label} style={{ display: "flex", alignItems: "center", gap: "6px", background: "#fff", border: "1px solid #E2E8F0", borderRadius: "20px", padding: "6px 14px", fontSize: "12px", color: "#64748B", fontWeight: "500", boxShadow: "0 1px 4px rgba(0,0,0,0.04)" }}>
                <span>{icon}</span><span>{label}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {stage === "processing" && (
        <div style={{ maxWidth: "460px", margin: "80px auto", textAlign: "center", padding: "0 20px", animation: "fadeIn 0.4s ease" }}>
          <div style={{ width: "80px", height: "80px", borderRadius: "24px", background: "linear-gradient(135deg,#6366F1,#8B5CF6)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "36px", margin: "0 auto 24px", animation: "spin 3s linear infinite", boxShadow: "0 8px 32px rgba(99,102,241,0.35)" }}>🧠</div>
          <h2 style={{ fontSize: "22px", fontWeight: "800", color: "#0F172A", margin: "0 0 8px" }}>Analyzing your document</h2>
          <p style={{ color: "#6366F1", fontSize: "14px", fontWeight: "600", margin: "0 0 8px", animation: "pulse 1.5s ease-in-out infinite" }}>{progress}</p>
          <p style={{ fontSize: "13px", color: "#94A3B8", marginBottom: "32px" }}>📄 {fileName}</p>
          <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
            {["Reading & parsing document","Identifying actors & roles","Extracting process steps","Detecting decision points","Building your flowchart"].map((step,i) => (
              <div key={step} style={{ display: "flex", alignItems: "center", gap: "12px", padding: "12px 16px", background: "#fff", borderRadius: "12px", border: "1px solid #E2E8F0", boxShadow: "0 1px 4px rgba(0,0,0,0.04)" }}>
                <div style={{ width: "8px", height: "8px", borderRadius: "50%", background: "#6366F1", boxShadow: "0 0 8px #6366F166", animation: `pulse ${1+i*0.2}s ease-in-out infinite`, flexShrink: 0 }}/>
                <span style={{ fontSize: "13px", color: "#64748B", fontWeight: "500" }}>{step}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {stage === "result" && flowData && (
        <div style={{ animation: "fadeIn 0.5s ease", paddingTop: "32px" }}>
          <FlowchartView data={flowData} />
        </div>
      )}

      {stage === "error" && (
        <div style={{ maxWidth: "440px", margin: "80px auto", textAlign: "center", padding: "0 20px", animation: "fadeIn 0.4s ease" }}>
          <div style={{ fontSize: "52px", marginBottom: "16px" }}>😕</div>
          <h2 style={{ fontSize: "22px", fontWeight: "800", color: "#0F172A", marginBottom: "8px" }}>Something went wrong</h2>
          <div style={{ background: "#FEF2F2", border: "1px solid #FECACA", borderRadius: "12px", padding: "14px 16px", fontSize: "13px", color: "#DC2626", marginBottom: "24px", lineHeight: 1.5 }}>{errorMsg}</div>
          <div style={{ display: "flex", gap: "10px", justifyContent: "center" }}>
            <button className="btn-primary" onClick={reset} style={{ ...S.btn, ...S.btnPrimary }}>Try Again</button>
            <button onClick={() => setApiKey("")} style={{ ...S.btn, ...S.btnSecondary }}>Change API Key</button>
          </div>
        </div>
      )}

      <div style={{ textAlign: "center", padding: "20px", fontSize: "12px", color: "#CBD5E1", borderTop: "1px solid #F1F5F9", marginTop: "20px" }}>
        MindMap AI · AI Powered · Built for smart teams ✦
      </div>
    </div>
  );
}