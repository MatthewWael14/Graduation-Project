import { C, S } from "../../styles/theme";

export default function RiskPanel({ risks, onNavigate }) {
  return (
    <div style={S.card}>
      <div style={S.cardHeader}>
        <span style={S.cardTitle}>⚠ Inventory Risk Overview</span>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <span style={{ fontSize: 12, fontWeight: 600, padding: "3px 10px", borderRadius: 20, background: C.orange + "20", color: C.orange }} className="live-pulse">● Live</span>
          {onNavigate && (
            <button
              onClick={() => onNavigate("inventory")}
              style={{ background: "none", border: "none", color: C.blue, fontSize: 12, cursor: "pointer", fontWeight: 600, padding: 0 }}
            >
              View All →
            </button>
          )}
        </div>
      </div>
      {risks.length === 0 && (
        <div style={{ textAlign: "center", padding: "28px 16px", color: C.muted, fontSize: 13 }}>No risk items to display</div>
      )}
      {risks.map((r, i) => {
        const hasStockData = r.threshold > 0;
        const pct = hasStockData
          ? (r.stock >= r.threshold ? 0 : Math.round(100 - (r.stock / r.threshold) * 100))
          : r.trafficLight === "RED" ? 80 : 15;
        const derivedRisk = pct >= 80 ? "CRITICAL" : pct >= 50 ? "HIGH" : pct >= 20 ? "MEDIUM" : "LOW";
        const color = derivedRisk === "CRITICAL" ? C.red
                    : derivedRisk === "HIGH" ? C.orange
                    : derivedRisk === "MEDIUM" ? C.accent
                    : C.green;
        const pb = S.progressBar(pct, color);
        return (
          <div key={i} style={{ marginBottom: 14, paddingBottom: 14, borderBottom: i < risks.length - 1 ? `1px solid ${C.border}` : "none" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 4 }}>
              <div>
                <div style={{ fontSize: 14, fontWeight: 700, color: C.text }}>{r.material}</div>
                <div style={{ fontSize: 12, color: C.muted, marginTop: 2 }}>
                  {r.supplier}
                  {r.delay > 0 && <span style={{ color: C.orange, marginLeft: 6 }}>+{r.delay}d delay</span>}
                </div>
              </div>
              <span style={S.riskBadge(derivedRisk)}>{derivedRisk}</span>
            </div>

            {r.impact && (
              <div style={{ fontSize: 11, color: C.muted, marginBottom: 6 }}>
                📦 Process: <span style={{ color: C.textSoft }}>{r.impact}</span>
              </div>
            )}

            <div style={pb.outer}><div style={pb.inner} /></div>

            <div style={{ display: "flex", justifyContent: "space-between", marginTop: 5, fontSize: 11 }}>
              <span style={{ color: C.muted }}>
                {r.reliabilityScore !== undefined && r.reliabilityScore !== null
                  ? `Reliability: ${Math.round(parseFloat(r.reliabilityScore) * 100)}%`
                  : r.countryCode ? `Country: ${r.countryCode}` : ""}
              </span>
              <span style={{ color, fontWeight: 700 }}>{Math.round(pct)}% Risk</span>
            </div>
          </div>
        );
      })}
    </div>
  );
}
