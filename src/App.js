import { useState, useRef, useCallback } from "react";

const COLORS = ["#00C9FF","#A78BFA","#34D399","#F472B6","#FB923C","#FBBF24","#60A5FA","#F87171"];

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
- Identify real decision points (yes/no branches) and mark isDecision: true
- Pick relevant emojis for icons
- keyInsights should highlight risks, bottlenecks, or important observations
- Assign actors correctly to phases

TRANSCRIPT/DOCUMENT:
${text.substring(0, 8000)}`;

  const response = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: { "Content-Type": "application/json", "x-api-key": apiKey, "anthropic-version": "2023-06-01", "anthropic-dangerous-direct-browser-access": "true" },
    body: JSON.stringify({ model: "claude-haiku-4-5-20251001", max_tokens: 2000, messages: [{ role: "user", content: prompt }] })
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

// ─── API KEY SCREEN ────────────────────────────────────────────────────────────
function ApiKeyScreen({ onSave }) {
  const [key, setKey] = useState("");
  const [show, setShow] = useState(false);
  const [error, setError] = useState("");
  const [testing, setTesting] = useState(false);

  const handleSave = async () => {
    if (!key.startsWith("sk-ant-")) {
      setError("Invalid key — Anthropic API keys start with sk-ant-");
      return;
    }
    setTesting(true);
    setError("");
    try {
      const res = await fetch("https://api.anthropic.com/v1/messages", {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-api-key": key, "anthropic-version": "2023-06-01", "anthropic-dangerous-direct-browser-access": "true" },
        body: JSON.stringify({ model: "claude-haiku-4-5-20251001", max_tokens: 10, messages: [{ role: "user", content: "hi" }] })
      });
      if (!res.ok) {
        const e = await res.json();
        throw new Error(e?.error?.message || "Invalid API key");
      }
      onSave(key);
    } catch (e) {
      setError(e.message || "Could not verify key. Check and try again.");
    } finally {
      setTesting(false);
    }
  };

  return (
    <div style={{ minHeight: "100vh", background: "#06070E", fontFamily: "'Courier New', monospace", color: "#E2E8F0", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: "40px 20px" }}>
      <style>{`@keyframes glow { 0%,100%{box-shadow:0 0 20px #00C9FF33} 50%{box-shadow:0 0 40px #00C9FF66} }`}</style>

      <div style={{ width: "100%", maxWidth: "480px" }}>
        {/* Logo */}
        <div style={{ textAlign: "center", marginBottom: "48px" }}>
          <div style={{ fontSize: "48px", marginBottom: "16px" }}>🔑</div>
          <div style={{ display: "inline-block", border: "1px solid #00C9FF44", borderRadius: "3px", padding: "3px 14px", fontSize: "10px", letterSpacing: "4px", color: "#00C9FF", marginBottom: "14px" }}>
            SETUP REQUIRED
          </div>
          <h1 style={{ fontSize: "28px", fontWeight: "900", margin: "0 0 8px", background: "linear-gradient(120deg, #00C9FF, #A78BFA)", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent" }}>
            Enter API Key
          </h1>
          <p style={{ color: "#475569", fontSize: "12px", margin: 0, lineHeight: "1.7" }}>
            This app uses Claude AI to analyze your documents.<br/>You need an Anthropic API key to continue.
          </p>
        </div>

        {/* Input Card */}
        <div style={{ background: "#0D0E1A", border: "1px solid #1E293B", borderRadius: "12px", padding: "28px", marginBottom: "20px", animation: "glow 3s ease-in-out infinite" }}>
          <div style={{ fontSize: "10px", color: "#64748B", letterSpacing: "3px", marginBottom: "10px" }}>ANTHROPIC API KEY</div>
          <div style={{ display: "flex", gap: "8px", marginBottom: "8px" }}>
            <input
              type={show ? "text" : "password"}
              value={key}
              onChange={e => { setKey(e.target.value); setError(""); }}
              placeholder="sk-ant-api03-..."
              onKeyDown={e => e.key === "Enter" && handleSave()}
              style={{ flex: 1, background: "#06070E", border: `1px solid ${error ? "#FF4D4D55" : key.startsWith("sk-ant-") ? "#34D39955" : "#1E293B"}`, borderRadius: "8px", padding: "12px 14px", color: "#E2E8F0", fontSize: "13px", fontFamily: "'Courier New', monospace", outline: "none", transition: "border-color 0.2s" }}
            />
            <button onClick={() => setShow(!show)} style={{ background: "#1E293B", border: "1px solid #334155", borderRadius: "8px", padding: "12px 14px", color: "#64748B", fontSize: "13px", cursor: "pointer" }}>
              {show ? "🙈" : "👁️"}
            </button>
          </div>

          {error && <div style={{ fontSize: "12px", color: "#FF4D4D", marginBottom: "12px", padding: "8px 12px", background: "#FF4D4D15", borderRadius: "6px", border: "1px solid #FF4D4D33" }}>⚠️ {error}</div>}

          <button
            onClick={handleSave}
            disabled={!key || testing}
            style={{ width: "100%", background: key ? "linear-gradient(135deg, #00C9FF22, #A78BFA22)" : "#0D0E1A", border: `1px solid ${key ? "#00C9FF55" : "#1E293B"}`, borderRadius: "8px", padding: "14px", color: key ? "#00C9FF" : "#334155", fontSize: "13px", cursor: key ? "pointer" : "not-allowed", letterSpacing: "2px", fontFamily: "'Courier New', monospace", transition: "all 0.2s", marginTop: "4px" }}
          >
            {testing ? "⏳ VERIFYING KEY..." : "⚡ SAVE & CONTINUE"}
          </button>
        </div>

        {/* How to get key */}
        <div style={{ background: "#0D0E1A", border: "1px solid #1E293B", borderRadius: "10px", padding: "18px 20px" }}>
          <div style={{ fontSize: "10px", color: "#A78BFA", letterSpacing: "3px", marginBottom: "14px" }}>HOW TO GET YOUR API KEY</div>
          {[
            ["1", "Go to", "console.anthropic.com"],
            ["2", "Sign up or log in", ""],
            ["3", "Click API Keys → Create Key", ""],
            ["4", "Copy and paste it above", ""],
          ].map(([num, text, link]) => (
            <div key={num} style={{ display: "flex", gap: "12px", marginBottom: "10px", alignItems: "flex-start" }}>
              <span style={{ minWidth: "22px", height: "22px", borderRadius: "4px", background: "#A78BFA22", border: "1px solid #A78BFA44", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "10px", color: "#A78BFA", fontWeight: "700" }}>{num}</span>
              <span style={{ fontSize: "13px", color: "#94A3B8" }}>
                {text} {link && <a href={`https://${link}`} target="_blank" rel="noreferrer" style={{ color: "#00C9FF", textDecoration: "none" }}>{link}</a>}
              </span>
            </div>
          ))}
          <div style={{ marginTop: "12px", padding: "10px 12px", background: "#34D39915", border: "1px solid #34D39933", borderRadius: "6px", fontSize: "11px", color: "#34D399" }}>
            💡 Cost: ~$0.001 per analysis. Very cheap!
          </div>
        </div>

        <div style={{ textAlign: "center", marginTop: "20px", fontSize: "10px", color: "#1E293B", letterSpacing: "2px" }}>
          YOUR KEY IS NEVER STORED — ONLY USED IN YOUR BROWSER SESSION
        </div>
      </div>
    </div>
  );
}

// ─── FLOWCHART VIEW ────────────────────────────────────────────────────────────
function FlowchartView({ data }) {
  const [active, setActive] = useState(null);

  const getActorColor = (actorId) => {
    const idx = data.actors?.findIndex(a => a.id === actorId) ?? 0;
    return COLORS[idx % COLORS.length];
  };
  const getActor = (actorId) => data.actors?.find(a => a.id === actorId);

  const handleSave = () => {
    const html = `<!DOCTYPE html><html lang="en"><head><meta charset="UTF-8"/><title>${data.title}</title>
<style>*{box-sizing:border-box;margin:0;padding:0}body{background:#06070E;color:#E2E8F0;font-family:'Courier New',monospace;padding:40px 20px}.wrap{max-width:820px;margin:0 auto}.badge{display:inline-block;border:1px solid #00C9FF44;border-radius:3px;padding:3px 14px;font-size:10px;letter-spacing:4px;color:#00C9FF;margin-bottom:14px}h1{font-size:32px;font-weight:900;margin:0 0 8px;background:linear-gradient(120deg,#00C9FF,#A78BFA,#34D399);-webkit-background-clip:text;-webkit-text-fill-color:transparent}.summary{color:#64748B;font-size:13px;margin-bottom:20px}.actors{display:flex;gap:10px;flex-wrap:wrap;margin-bottom:32px;justify-content:center}.actor{padding:4px 14px;border-radius:20px;font-size:11px;border:1px solid}.phase{background:#0D0E1A;border-radius:10px;padding:20px;margin-bottom:4px}.ph{display:flex;align-items:center;gap:16px;margin-bottom:14px}.pi{width:44px;height:44px;border-radius:8px;display:flex;align-items:center;justify-content:center;font-size:20px}.pt{font-size:15px;font-weight:700;color:#F1F5F9}.pa{font-size:11px;letter-spacing:1px}.desc{font-size:13px;color:#94A3B8;font-style:italic;border-left:3px solid;padding-left:10px;margin-bottom:12px}.grid{display:grid;grid-template-columns:1fr 1fr;gap:20px}.label{font-size:10px;letter-spacing:3px;margin-bottom:10px}.step{display:flex;gap:10px;margin-bottom:8px;font-size:13px;color:#CBD5E1}.sn{min-width:20px;height:20px;border-radius:3px;display:flex;align-items:center;justify-content:center;font-size:10px;font-weight:700}.out{border-radius:6px;padding:12px 14px;font-size:13px;margin-bottom:14px;line-height:1.5}.note{background:#1E293B;border:1px solid #334155;border-radius:6px;padding:10px 14px;font-size:12px;color:#94A3B8}.dec{border-radius:6px;padding:10px 14px;font-size:12px;margin-top:10px}.conn{display:flex;flex-direction:column;align-items:center;height:28px}.cl{width:2px;flex:1}.ca{width:0;height:0;border-left:5px solid transparent;border-right:5px solid transparent}.ins{background:#0D0E1A;border:1px solid #FBBF2433;border-radius:10px;padding:18px 20px;margin-top:28px}.ins-title{font-size:10px;color:#FBBF24;letter-spacing:3px;margin-bottom:14px}.ins-item{font-size:13px;color:#CBD5E1;margin-bottom:8px;padding-left:12px;border-left:2px solid #FBBF2466;line-height:1.5}.footer{text-align:center;margin-top:28px;font-size:10px;color:#1E293B;letter-spacing:2px}</style>
</head><body>
<div style="text-align:center;margin-bottom:40px"><div class="badge">AS/IS PROCESS FLOWCHART</div><h1>${data.title}</h1><p class="summary">${data.summary}</p>
<div class="actors">${(data.actors||[]).map((a,i)=>`<div class="actor" style="color:${COLORS[i%COLORS.length]};border-color:${COLORS[i%COLORS.length]}44;background:${COLORS[i%COLORS.length]}15">${a.emoji} ${a.name}</div>`).join("")}</div></div>
<div class="wrap">
${(data.phases||[]).map((p,idx)=>{
  const c=getActorColor(p.actorId);const a=getActor(p.actorId);
  return `<div class="phase" style="border:1px solid ${c}55">
<div class="ph"><div class="pi" style="background:${c}20;border:1px solid ${c}44">${p.icon}</div>
<div><div class="pt">${p.title}</div><div class="pa" style="color:${c}">${a?.emoji||"👤"} ${a?.name||""}</div></div>
<div style="margin-left:auto;background:${c}20;border:1px solid ${c}44;border-radius:4px;padding:3px 10px;font-size:10px;color:${c}">STEP ${idx+1}</div></div>
<p class="desc" style="border-color:${c}55">${p.description}</p>
<div class="grid">
<div><div class="label" style="color:${c}">PROCESS STEPS</div>
${p.steps.map((s,i)=>`<div class="step"><span class="sn" style="background:${c}22;border:1px solid ${c}55;color:${c}">${i+1}</span><span>${s}</span></div>`).join("")}
${p.isDecision?`<div class="dec" style="background:#FBBF2415;border:1px solid #FBBF2444;color:#FDE68A">◆ ${p.decisionQuestion}<br>✅ YES → ${p.decisionYes}<br>❌ NO → ${p.decisionNo}</div>`:""}
</div>
<div><div class="label" style="color:${c}">OUTPUT</div>
<div class="out" style="background:${c}15;border:1px solid ${c}44;color:#E2E8F0">✅ ${p.output}</div>
${p.note?`<div class="note">💡 ${p.note}</div>`:""}
</div></div></div>
${idx<data.phases.length-1?`<div class="conn"><div class="cl" style="background:linear-gradient(180deg,${c}77,${getActorColor(data.phases[idx+1].actorId)}77)"></div><div class="ca" style="border-top:7px solid ${getActorColor(data.phases[idx+1].actorId)}99"></div></div>`:""}`}).join("")}
<div class="ins"><div class="ins-title">⚡ KEY INSIGHTS</div>${(data.keyInsights||[]).map(i=>`<div class="ins-item">${i}</div>`).join("")}</div>
</div>
<div class="footer">GENERATED BY AI TRANSCRIPT ANALYZER</div>
</body></html>`;
    const blob = new Blob([html], { type: "text/html" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${data.title.replace(/\s+/g,"_")}_flowchart.html`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div>
      <div style={{ textAlign: "center", marginBottom: "28px" }}>
        <div style={{ display: "inline-block", border: "1px solid #00C9FF44", borderRadius: "3px", padding: "3px 14px", fontSize: "10px", letterSpacing: "4px", color: "#00C9FF", marginBottom: "12px" }}>AS/IS PROCESS FLOWCHART</div>
        <h2 style={{ fontSize: "clamp(20px,3vw,32px)", fontWeight: "900", margin: "0 0 8px", background: "linear-gradient(120deg,#00C9FF,#A78BFA,#34D399)", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent" }}>{data.title}</h2>
        <p style={{ color: "#64748B", fontSize: "13px", margin: "0 0 18px" }}>{data.summary}</p>
        <div style={{ display: "flex", gap: "10px", justifyContent: "center", flexWrap: "wrap", marginBottom: "18px" }}>
          {(data.actors||[]).map((a,i) => (
            <div key={a.id} style={{ display: "flex", alignItems: "center", gap: "6px", background: `${COLORS[i%COLORS.length]}15`, border: `1px solid ${COLORS[i%COLORS.length]}44`, borderRadius: "20px", padding: "4px 12px", fontSize: "11px", color: COLORS[i%COLORS.length] }}>
              {a.emoji} {a.name}
            </div>
          ))}
        </div>
        <button onClick={handleSave} style={{ background: "linear-gradient(135deg,#00C9FF22,#A78BFA22)", border: "1px solid #00C9FF55", borderRadius: "8px", padding: "11px 28px", color: "#00C9FF", fontSize: "13px", cursor: "pointer", letterSpacing: "1px", fontFamily: "'Courier New',monospace" }}>
          💾 Save as HTML File
        </button>
      </div>

      <div style={{ maxWidth: "820px", margin: "0 auto", display: "flex", flexDirection: "column" }}>
        {(data.phases||[]).map((phase, index) => {
          const color = getActorColor(phase.actorId);
          const actor = getActor(phase.actorId);
          const isActive = active === phase.id;
          return (
            <div key={phase.id} style={{ display: "flex", flexDirection: "column", alignItems: "center" }}>
              <div onClick={() => setActive(isActive ? null : phase.id)} style={{ width: "100%", background: isActive ? `linear-gradient(135deg,${color}15,#0D0E1A)` : "#0D0E1A", border: `1px solid ${isActive ? color+"99" : "#1E293B"}`, borderRadius: isActive ? "10px 10px 0 0" : "10px", padding: "16px 20px", cursor: "pointer", transition: "all 0.2s", display: "flex", alignItems: "center", gap: "16px" }}>
                <div style={{ minWidth: "44px", height: "44px", borderRadius: "8px", background: `${color}20`, border: `1px solid ${color}55`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: "20px" }}>{phase.icon}</div>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: "15px", fontWeight: "700", color: "#F1F5F9", marginBottom: "3px" }}>{phase.title}</div>
                  <div style={{ fontSize: "11px", color, letterSpacing: "1px" }}>{actor?.emoji} {actor?.name}</div>
                </div>
                <div style={{ background: `${color}20`, border: `1px solid ${color}44`, borderRadius: "4px", padding: "3px 10px", fontSize: "10px", color }}>STEP {index+1}</div>
                <div style={{ color, fontSize: "20px", transition: "transform 0.2s", transform: isActive ? "rotate(90deg)" : "rotate(0deg)" }}>›</div>
              </div>

              {isActive && (
                <div style={{ width: "100%", background: `linear-gradient(180deg,${color}08,#06070E)`, border: `1px solid ${color}55`, borderTop: "none", borderRadius: "0 0 10px 10px", padding: "18px 20px 22px" }}>
                  <p style={{ fontSize: "13px", color: "#94A3B8", margin: "0 0 16px", lineHeight: "1.6", fontStyle: "italic", borderLeft: `3px solid ${color}55`, paddingLeft: "12px" }}>{phase.description}</p>
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "20px" }}>
                    <div>
                      <div style={{ fontSize: "10px", color, letterSpacing: "3px", marginBottom: "10px" }}>PROCESS STEPS</div>
                      {phase.steps.map((step,i) => (
                        <div key={i} style={{ display: "flex", gap: "10px", marginBottom: "8px", alignItems: "flex-start" }}>
                          <span style={{ minWidth: "20px", height: "20px", borderRadius: "3px", background: `${color}22`, border: `1px solid ${color}55`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: "10px", color, fontWeight: "700", marginTop: "2px" }}>{i+1}</span>
                          <span style={{ fontSize: "13px", color: "#CBD5E1", lineHeight: "1.5" }}>{step}</span>
                        </div>
                      ))}
                      {phase.isDecision && (
                        <div style={{ marginTop: "12px", background: "#FBBF2415", border: "1px solid #FBBF2444", borderRadius: "6px", padding: "10px 14px", fontSize: "12px", color: "#FDE68A" }}>
                          ◆ {phase.decisionQuestion}<br/>
                          <span style={{ color: "#34D399" }}>✅ YES → {phase.decisionYes}</span><br/>
                          <span style={{ color: "#FF4D4D" }}>❌ NO → {phase.decisionNo}</span>
                        </div>
                      )}
                    </div>
                    <div>
                      <div style={{ fontSize: "10px", color, letterSpacing: "3px", marginBottom: "10px" }}>OUTPUT</div>
                      <div style={{ background: `${color}15`, border: `1px solid ${color}44`, borderRadius: "6px", padding: "12px 14px", fontSize: "13px", color: "#E2E8F0", marginBottom: "14px", lineHeight: "1.5" }}>✅ {phase.output}</div>
                      {phase.note && (<><div style={{ fontSize: "10px", color: "#64748B", letterSpacing: "3px", marginBottom: "8px" }}>NOTE</div><div style={{ background: "#1E293B", border: "1px solid #334155", borderRadius: "6px", padding: "10px 14px", fontSize: "12px", color: "#94A3B8", lineHeight: "1.5" }}>💡 {phase.note}</div></>)}
                    </div>
                  </div>
                </div>
              )}

              {index < data.phases.length-1 && (
                <div style={{ display: "flex", flexDirection: "column", alignItems: "center", height: "28px" }}>
                  <div style={{ width: "2px", flex: 1, background: `linear-gradient(180deg,${color}77,${getActorColor(data.phases[index+1].actorId)}77)` }}/>
                  <div style={{ width: 0, height: 0, borderLeft: "5px solid transparent", borderRight: "5px solid transparent", borderTop: `7px solid ${getActorColor(data.phases[index+1].actorId)}99` }}/>
                </div>
              )}
            </div>
          );
        })}
      </div>

      {data.keyInsights?.length > 0 && (
        <div style={{ maxWidth: "820px", margin: "28px auto 0", background: "#0D0E1A", border: "1px solid #FBBF2433", borderRadius: "10px", padding: "18px 20px" }}>
          <div style={{ fontSize: "10px", color: "#FBBF24", letterSpacing: "3px", marginBottom: "14px" }}>⚡ KEY INSIGHTS</div>
          {data.keyInsights.map((insight,i) => (
            <div key={i} style={{ fontSize: "13px", color: "#CBD5E1", marginBottom: "8px", paddingLeft: "12px", borderLeft: "2px solid #FBBF2466", lineHeight: "1.5" }}>{insight}</div>
          ))}
        </div>
      )}

      <div style={{ textAlign: "center", marginTop: "24px" }}>
        <button onClick={handleSave} style={{ background: "linear-gradient(135deg,#00C9FF22,#A78BFA22)", border: "1px solid #00C9FF55", borderRadius: "8px", padding: "12px 32px", color: "#00C9FF", fontSize: "13px", cursor: "pointer", letterSpacing: "1px", fontFamily: "'Courier New',monospace" }}>
          💾 Save Flowchart as HTML File
        </button>
      </div>
    </div>
  );
}

// ─── MAIN APP ──────────────────────────────────────────────────────────────────
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

  const run = async (text, name) => {
    setFileName(name);
    setStage("processing");
    setProgress("Reading document...");
    try {
      setProgress("Analyzing with Claude AI...");
      const result = await analyzeTranscript(text, apiKey);
      setProgress("Building flowchart...");
      await new Promise(r => setTimeout(r, 400));
      setFlowData(result);
      setStage("result");
    } catch (err) {
      setErrorMsg(err.message || "Something went wrong.");
      setStage("error");
    }
  };

  const readFile = (file) => new Promise((res, rej) => {
    if (file.type === "application/pdf") { res(`[PDF: ${file.name}] Please paste the text content instead for best results.`); return; }
    const reader = new FileReader();
    reader.onload = e => res(e.target.result);
    reader.onerror = rej;
    reader.readAsText(file);
  });

  const handleDrop = useCallback(async (e) => {
    e.preventDefault(); setDragOver(false);
    const file = e.dataTransfer.files[0];
    if (file) { const text = await readFile(file); run(text, file.name); }
  }, [apiKey]);

  const handleFileChange = async (e) => {
    const file = e.target.files[0];
    if (file) { const text = await readFile(file); run(text, file.name); }
  };

  const handlePasteSubmit = () => {
    if (pasteText.trim().length >= 50) run(pasteText, "Pasted text");
  };

  const reset = () => { setStage("upload"); setFlowData(null); setFileName(""); setPasteText(""); setShowPaste(false); setErrorMsg(""); };

  if (!apiKey) return <ApiKeyScreen onSave={setApiKey} />;

  return (
    <div style={{ minHeight: "100vh", background: "#06070E", fontFamily: "'Courier New',monospace", color: "#E2E8F0", padding: "40px 20px" }}>
      <style>{`@keyframes spin{from{transform:rotate(0deg)}to{transform:rotate(360deg)}} @keyframes pulse{0%,100%{opacity:1}50%{opacity:0.4}}`}</style>

      {/* Header */}
      <div style={{ textAlign: "center", marginBottom: "40px" }}>
        <div style={{ display: "inline-flex", alignItems: "center", gap: "8px", marginBottom: "12px" }}>
          <div style={{ width: "7px", height: "7px", borderRadius: "50%", background: "#34D399", boxShadow: "0 0 8px #34D399" }}/>
          <span style={{ fontSize: "10px", letterSpacing: "4px", color: "#34D399" }}>API KEY CONNECTED</span>
          <button onClick={() => setApiKey("")} style={{ background: "transparent", border: "none", color: "#475569", fontSize: "10px", cursor: "pointer", letterSpacing: "1px", textDecoration: "underline" }}>change</button>
        </div>
        <h1 style={{ fontSize: "clamp(22px,4vw,40px)", fontWeight: "900", margin: "0 0 8px", background: "linear-gradient(120deg,#00C9FF,#A78BFA,#34D399)", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent", letterSpacing: "-1px" }}>
          TRANSCRIPT → FLOWCHART
        </h1>
        <p style={{ color: "#475569", fontSize: "12px", letterSpacing: "2px", margin: 0 }}>
          UPLOAD · PASTE · AI ANALYZES · SAVE TO COMPUTER
        </p>
      </div>

      {/* UPLOAD */}
      {stage === "upload" && (
        <div style={{ maxWidth: "640px", margin: "0 auto" }}>

          {/* Drop Zone */}
          <div onDragOver={e => { e.preventDefault(); setDragOver(true); }} onDragLeave={() => setDragOver(false)} onDrop={handleDrop} onClick={() => fileInputRef.current?.click()}
            style={{ border: `2px dashed ${dragOver ? "#00C9FF" : "#1E293B"}`, borderRadius: "14px", padding: "52px 40px", textAlign: "center", cursor: "pointer", background: dragOver ? "#00C9FF08" : "#0D0E1A", transition: "all 0.2s", marginBottom: "16px" }}>
            <div style={{ fontSize: "44px", marginBottom: "14px" }}>📂</div>
            <div style={{ fontSize: "17px", fontWeight: "700", color: "#F1F5F9", marginBottom: "6px" }}>Drop your file here</div>
            <div style={{ fontSize: "13px", color: "#475569", marginBottom: "18px" }}>or click to browse</div>
            <div style={{ display: "flex", gap: "8px", justifyContent: "center", flexWrap: "wrap" }}>
              {[".TXT", ".MD", ".CSV", ".DOCX", ".PDF"].map(ext => (
                <span key={ext} style={{ background: "#1E293B", border: "1px solid #334155", borderRadius: "4px", padding: "3px 10px", fontSize: "11px", color: "#64748B" }}>{ext}</span>
              ))}
            </div>
          </div>
          <input ref={fileInputRef} type="file" accept=".txt,.md,.csv,.pdf,.docx,.doc" onChange={handleFileChange} style={{ display: "none" }}/>

          {/* Divider */}
          <div style={{ display: "flex", alignItems: "center", gap: "16px", margin: "20px 0" }}>
            <div style={{ flex: 1, height: "1px", background: "#1E293B" }}/>
            <span style={{ color: "#334155", fontSize: "11px", letterSpacing: "2px" }}>OR PASTE TEXT DIRECTLY</span>
            <div style={{ flex: 1, height: "1px", background: "#1E293B" }}/>
          </div>

          {/* Paste Area */}
          <div style={{ background: "#0D0E1A", border: `1px solid ${showPaste ? "#00C9FF55" : "#1E293B"}`, borderRadius: "10px", overflow: "hidden", transition: "border-color 0.2s", marginBottom: "20px" }}>
            <div onClick={() => setShowPaste(true)} style={{ padding: "14px 18px", display: "flex", alignItems: "center", justifyContent: "space-between", cursor: "pointer", borderBottom: showPaste ? "1px solid #1E293B" : "none" }}>
              <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                <span style={{ fontSize: "18px" }}>📋</span>
                <span style={{ fontSize: "13px", color: "#94A3B8", letterSpacing: "1px" }}>Paste transcript or text here</span>
              </div>
              <div style={{ fontSize: "16px", color: "#334155", transform: showPaste ? "rotate(90deg)" : "rotate(0deg)", transition: "transform 0.2s" }}>›</div>
            </div>

            {showPaste && (
              <div style={{ padding: "0 16px 16px" }}>
                <textarea
                  autoFocus
                  value={pasteText}
                  onChange={e => setPasteText(e.target.value)}
                  placeholder={`Paste your meeting transcript, process notes, SOP, or any text here...\n\nExample:\nLucas: OK so first we log into the VDI system...\nThen we export the monthly report...\nHimanshu: What format should the file be in?`}
                  style={{ width: "100%", minHeight: "200px", background: "#06070E", border: "1px solid #1E293B", borderRadius: "8px", padding: "14px", color: "#E2E8F0", fontSize: "13px", fontFamily: "'Courier New',monospace", resize: "vertical", outline: "none", lineHeight: "1.6", marginTop: "12px", boxSizing: "border-box" }}
                />
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: "10px" }}>
                  <span style={{ fontSize: "11px", color: pasteText.length < 50 ? "#475569" : "#34D399" }}>
                    {pasteText.length < 50 ? `${pasteText.length} chars — need at least 50` : `✅ ${pasteText.length} chars — ready`}
                  </span>
                  <div style={{ display: "flex", gap: "8px" }}>
                    <button onClick={() => { setPasteText(""); setShowPaste(false); }} style={{ background: "transparent", border: "1px solid #1E293B", borderRadius: "6px", padding: "8px 16px", color: "#475569", fontSize: "12px", cursor: "pointer" }}>Clear</button>
                    <button onClick={handlePasteSubmit} disabled={pasteText.trim().length < 50}
                      style={{ background: pasteText.trim().length >= 50 ? "linear-gradient(135deg,#00C9FF22,#A78BFA22)" : "#0D0E1A", border: `1px solid ${pasteText.trim().length >= 50 ? "#00C9FF55" : "#1E293B"}`, borderRadius: "6px", padding: "8px 20px", color: pasteText.trim().length >= 50 ? "#00C9FF" : "#334155", fontSize: "12px", cursor: pasteText.trim().length >= 50 ? "pointer" : "not-allowed", letterSpacing: "1px", transition: "all 0.2s", fontFamily: "'Courier New',monospace" }}>
                      ⚡ Analyze Text
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Tips */}
          <div style={{ background: "#0D0E1A", border: "1px solid #1E293B", borderRadius: "10px", padding: "18px 20px" }}>
            <div style={{ fontSize: "10px", color: "#A78BFA", letterSpacing: "3px", marginBottom: "12px" }}>WHAT WORKS BEST</div>
            {[["📝","Meeting transcripts","Teams, Zoom, Google Meet exports"],["📄","Process documents","SOPs, runbooks, procedure guides"],["💬","Chat exports","WhatsApp, Slack, Teams conversations"],["📋","Handover notes","Knowledge transfer documents"]].map(([icon,title,desc]) => (
              <div key={title} style={{ display: "flex", gap: "12px", marginBottom: "10px", alignItems: "flex-start" }}>
                <span style={{ fontSize: "16px" }}>{icon}</span>
                <div>
                  <div style={{ fontSize: "13px", color: "#E2E8F0", marginBottom: "2px" }}>{title}</div>
                  <div style={{ fontSize: "11px", color: "#475569" }}>{desc}</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* PROCESSING */}
      {stage === "processing" && (
        <div style={{ maxWidth: "480px", margin: "60px auto", textAlign: "center" }}>
          <div style={{ fontSize: "48px", marginBottom: "24px", display: "inline-block", animation: "spin 2s linear infinite" }}>⚙️</div>
          <div style={{ fontSize: "16px", color: "#F1F5F9", marginBottom: "8px", fontWeight: "700" }}>Analyzing Document</div>
          <div style={{ fontSize: "13px", color: "#00C9FF", marginBottom: "32px", animation: "pulse 1.5s ease-in-out infinite" }}>{progress}</div>
          <div style={{ fontSize: "12px", color: "#334155", marginBottom: "28px" }}>📄 {fileName}</div>
          <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
            {["Reading & parsing document","Identifying actors & roles","Extracting process steps","Detecting decision points","Building flowchart"].map((step,i) => (
              <div key={step} style={{ display: "flex", alignItems: "center", gap: "12px", padding: "10px 16px", background: "#0D0E1A", borderRadius: "6px", border: "1px solid #1E293B" }}>
                <div style={{ width: "7px", height: "7px", borderRadius: "50%", background: "#00C9FF", boxShadow: "0 0 6px #00C9FF", animation: `pulse ${1+i*0.2}s ease-in-out infinite` }}/>
                <span style={{ fontSize: "12px", color: "#64748B" }}>{step}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* RESULT */}
      {stage === "result" && flowData && (
        <div>
          <div style={{ textAlign: "center", marginBottom: "24px" }}>
            <button onClick={reset} style={{ background: "transparent", border: "1px solid #1E293B", borderRadius: "6px", padding: "8px 20px", color: "#64748B", fontSize: "12px", cursor: "pointer", letterSpacing: "1px" }}>← Analyze New Document</button>
          </div>
          <FlowchartView data={flowData} />
        </div>
      )}

      {/* ERROR */}
      {stage === "error" && (
        <div style={{ maxWidth: "480px", margin: "60px auto", textAlign: "center" }}>
          <div style={{ fontSize: "48px", marginBottom: "16px" }}>⚠️</div>
          <div style={{ fontSize: "16px", color: "#FF4D4D", marginBottom: "8px" }}>Something went wrong</div>
          <div style={{ fontSize: "13px", color: "#64748B", marginBottom: "28px", padding: "12px 16px", background: "#FF4D4D15", border: "1px solid #FF4D4D33", borderRadius: "8px" }}>{errorMsg}</div>
          <div style={{ display: "flex", gap: "10px", justifyContent: "center" }}>
            <button onClick={reset} style={{ background: "#0D0E1A", border: "1px solid #00C9FF44", borderRadius: "6px", padding: "10px 24px", color: "#00C9FF", fontSize: "13px", cursor: "pointer" }}>Try Again</button>
            <button onClick={() => setApiKey("")} style={{ background: "#0D0E1A", border: "1px solid #1E293B", borderRadius: "6px", padding: "10px 24px", color: "#64748B", fontSize: "13px", cursor: "pointer" }}>Change API Key</button>
          </div>
        </div>
      )}

      <div style={{ textAlign: "center", marginTop: "40px", fontSize: "10px", color: "#1E293B", letterSpacing: "2px" }}>
        POWERED BY CLAUDE AI · TRANSCRIPT → FLOWCHART
      </div>
    </div>
  );
}
