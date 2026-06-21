import { C, S } from "../../styles/theme";

export default function ReliabilityChart({ suppliers, onNavigate }) {
  return (
    <div style={S.card}>
      <div style={S.cardHeader}>
        <span style={S.cardTitle}>🏭 Supplier Reliability</span>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <span style={{ fontSize: 12, color: C.muted }}>{suppliers.length} suppliers · Score / 100</span>
          {onNavigate && (
            <button
              onClick={() => onNavigate("suppliers")}
              style={{ background: "none", border: "none", color: C.blue, fontSize: 12, cursor: "pointer", fontWeight: 600, padding: 0 }}
            >
              View All →
            </button>
          )}
        </div>
      </div>
      {suppliers.length === 0 && (
        <div style={{ textAlign: "center", padding: "28px 16px", color: C.muted, fontSize: 13 }}>No suppliers to chart</div>
      )}
      {suppliers.map((s, i) => {
        const barColor = s.score >= 80 ? C.green : s.score >= 50 ? C.orange : C.red;
        const riskLabel = s.score >= 80 ? "HIGH" : s.score >= 50 ? "MEDIUM" : "LOW";
        return (
          <div key={i} style={{ marginBottom: 14 }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 5 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <div style={{
                  width: 30, height: 30, borderRadius: 8,
                  background: barColor + "20",
                  display: "flex", alignItems: "center", justifyContent: "center",
                  fontSize: 11, fontWeight: 700, color: barColor,
                  flexShrink: 0,
                }}>
                  {s.countryCode || "GL"}
                </div>
                <div>
                  <div style={{ fontSize: 13, fontWeight: 600, color: C.text, lineHeight: 1.2 }}>{s.name}</div>
                  {s.material && <div style={{ fontSize: 11, color: C.muted, marginTop: 1 }}>{s.material}</div>}
                </div>
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <span style={S.riskBadge(riskLabel)}>
                  {riskLabel === "HIGH" ? "Reliable" : riskLabel === "MEDIUM" ? "Moderate" : "At Risk"}
                </span>
                <span style={{ fontSize: 16, fontWeight: 800, color: barColor }}>{s.score}</span>
              </div>
            </div>
            <div style={{ height: 6, background: C.border, borderRadius: 99 }}>
              <div style={{ height: "100%", borderRadius: 99, width: `${s.score}%`, background: barColor, transition: "width 0.5s" }} />
            </div>
          </div>
        );
      })}
    </div>
  );
}
