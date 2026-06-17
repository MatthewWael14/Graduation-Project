import { C, S } from "../../styles/theme";

export default function RiskPanel({ risks, onDrillDown }) {
  return (
    <div style={S.card}>
      <div style={S.cardHeader}>
        <span style={S.cardTitle}>⚠ Inventory Risk Overview</span>
        <span style={{ fontSize: 12, fontWeight: 600, padding: "3px 10px", borderRadius: 20, background: C.orange + "20", color: C.orange }} className="live-pulse">● Live</span>
      </div>
      {risks.map((r, i) => {
        const pct   = Math.min(100, (r.stock / r.threshold) * 100);
        const color = r.risk === "CRITICAL" ? C.red : r.risk === "HIGH" ? C.orange : r.risk === "MEDIUM" ? C.accent : C.green;
        const pb    = S.progressBar(pct, color);
        return (
          <div key={i} style={{ marginBottom: 16, paddingBottom: 16, borderBottom: i < risks.length - 1 ? `1px solid ${C.border}` : "none" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 5 }}>
              <span style={{ fontSize: 14, fontWeight: 600, color: C.text, cursor: onDrillDown ? "pointer" : "default" }}
                onClick={() => onDrillDown && onDrillDown(r)}>{r.material}</span>
              <span style={S.riskBadge(r.risk)}>{r.risk}</span>
            </div>
            <div style={{ fontSize: 13, color: C.muted, marginBottom: 6 }}>{r.impact}{r.delay > 0 ? ` · +${r.delay}d delay` : ""}</div>
            <div style={pb.outer}><div style={pb.inner} /></div>
            <div style={{ display: "flex", justifyContent: "space-between", marginTop: 5 }}>
              <span style={{ fontSize: 12, color: C.muted }}>{r.stock} / {r.threshold} units</span>
              <span style={{ fontSize: 12, color, fontWeight: 600 }}>{Math.round(pct)}%</span>
            </div>
          </div>
        );
      })}
    </div>
  );
}
