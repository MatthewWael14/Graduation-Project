import { useState, useRef, useEffect } from "react";
import { C, S } from "../styles/theme";
import { chatHistory } from "../data/mockData";
import { sendChatMessage, checkBackendHealth } from "../services/api";

const SUGGESTIONS = [
  "What deliveries are currently delayed?",
  "Which suppliers have SLA violations?",
  "What production lines are impacted by delays?",
  "Show me fallback suppliers for Lithium Carbonate",
  "What is the penalty for RapidRaw LLC breach?",
];

export default function ChatAssistant({ user }) {
  const [messages,       setMessages]       = useState(chatHistory);
  const [input,          setInput]          = useState("");
  const [loading,        setLoading]        = useState(false);
  const [backendStatus,  setBackendStatus]  = useState(null); // null=checking, true=online, false=offline
  const bottomRef = useRef(null);

  // Check backend health on mount
  useEffect(() => {
    checkBackendHealth().then(h => setBackendStatus(h.online));
  }, []);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const send = async (text) => {
    if (!text.trim() || loading) return;
    setMessages(p => [...p, { role: "user", text }]);
    setInput(""); setLoading(true);

    try {
      const reply = await sendChatMessage(text);
      setMessages(p => [...p, { role: "assistant", text: reply }]);
    } catch (err) {
      setMessages(p => [...p, {
        role: "assistant",
        text: `Error: ${err.message}\n\nPlease ensure the backend is running at http://localhost:8001`,
      }]);
    }
    setLoading(false);
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "calc(100vh - 118px)" }}>
      <div style={{ ...S.pageHeader, display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
        <div>
          <div style={S.pageTitle}>AI Supply Chain Assistant</div>
          <div style={S.pageDesc}>Natural language queries powered by DeepSeek LLM + SPARQL Knowledge Graph</div>
        </div>
        {/* Backend status indicator */}
        <div style={{
          display: "flex", alignItems: "center", gap: 8,
          padding: "6px 14px", borderRadius: 8,
          background: backendStatus === null ? C.border : backendStatus ? C.green + "18" : C.orange + "18",
          border: `1px solid ${backendStatus === null ? C.border : backendStatus ? C.green + "44" : C.orange + "44"}`,
        }}>
          <div style={{
            width: 7, height: 7, borderRadius: "50%",
            background: backendStatus === null ? C.muted : backendStatus ? C.green : C.orange,
            boxShadow: backendStatus ? `0 0 6px ${C.green}` : "none",
          }} className={backendStatus ? "live-pulse" : ""} />
          <span style={{ fontSize: 12, fontWeight: 600, color: backendStatus === null ? C.muted : backendStatus ? C.green : C.orange }}>
            {backendStatus === null ? "Connecting..." : backendStatus ? "AI Connected" : "Demo Mode"}
          </span>
        </div>
      </div>

      {/* Offline warning */}
      {backendStatus === false && (
        <div style={{
          marginBottom: 16, padding: "10px 16px",
          background: C.orange + "15", border: `1px solid ${C.orange}44`,
          borderRadius: 8, fontSize: 13, color: C.orange,
        }}>
          ⚠ Backend offline — AI running in demo mode with mock responses. Start the backend to enable real Knowledge Graph queries.
        </div>
      )}

      <div style={{ display: "flex", gap: 16, flex: 1, minHeight: 0 }}>
        {/* Chat window */}
        <div style={{ flex: 1, display: "flex", flexDirection: "column", ...S.card }}>
          <div style={{ flex: 1, overflowY: "auto", display: "flex", flexDirection: "column", gap: 14, paddingBottom: 8 }}>
            {messages.map((m, i) => (
              <div key={i} style={{ display: "flex", flexDirection: "column", alignItems: m.role === "user" ? "flex-end" : "flex-start" }}>
                <div style={{ fontSize: 10, color: C.muted, marginBottom: 5, fontWeight: 600, letterSpacing: "0.04em" }}>
                  {m.role === "user" ? user?.name?.toUpperCase() || "YOU" : "🤖 AI ASSISTANT"}
                </div>
                <div style={S.chatBubble(m.role)}>
                  {m.text.split("\n").map((line, j) => <div key={j}>{line || "\u00a0"}</div>)}
                </div>
              </div>
            ))}
            {loading && (
              <div style={{ alignSelf: "flex-start" }}>
                <div style={{ fontSize: 10, color: C.muted, marginBottom: 5, fontWeight: 600 }}>🤖 AI ASSISTANT</div>
                <div style={{ ...S.chatBubble("assistant"), color: C.accent, display: "flex", alignItems: "center", gap: 8 }}>
                  <span className="spin">⚙</span> Querying Knowledge Graph via SPARQL...
                </div>
              </div>
            )}
            <div ref={bottomRef} />
          </div>

          <div style={{ marginTop: 12, display: "flex", gap: 8, paddingTop: 12, borderTop: `1px solid ${C.border}` }}>
            <input
              style={S.input}
              value={input}
              onChange={e => setInput(e.target.value)}
              onKeyDown={e => e.key === "Enter" && !e.shiftKey && send(input)}
              placeholder="Ask about suppliers, SLA violations, delivery delays..."
            />
            <button style={{ ...S.btn(), minWidth: 70 }} className="btn-hover" onClick={() => send(input)} disabled={loading}>
              {loading ? <span className="spin">⚙</span> : "Send"}
            </button>
          </div>
        </div>

        {/* Right panel — suggestions only */}
        <div style={{ width: 230 }}>
          <div style={S.card}>
            <div style={{ ...S.cardTitle, marginBottom: 14 }}>💡 Try Asking</div>
            {SUGGESTIONS.map((s, i) => (
              <div key={i} className="suggestion-item" onClick={() => send(s)}
                style={{
                  fontSize: 13, padding: "10px 12px", marginBottom: 8,
                  background: C.bg, border: `1px solid ${C.border}`,
                  borderRadius: 8, cursor: "pointer", color: C.muted,
                  lineHeight: 1.4, transition: "all 0.15s",
                }}>
                {s}
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
