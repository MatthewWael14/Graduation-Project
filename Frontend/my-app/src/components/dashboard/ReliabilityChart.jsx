import { C, S } from "../../styles/theme";

export default function ReliabilityChart({ suppliers }) {
  return (
    <div style={S.card}>
      <div style={S.cardHeader}>
        <span style={S.cardTitle}>🏭 Supplier Reliability</span>
        <span style={{ fontSize: 13, color: C.muted }}>Score / 100</span>
      </div>
      {suppliers.map((s, i) => {
        const barColor = s.score >= 80 ? C.green : s.score >= 50 ? C.orange : C.red;
        return (
          <div key={i} style={{ marginBottom: 13 }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 5 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <div style={{
                  width: 30, height: 30, borderRadius: 8,
                  background: barColor + "20",
                  display: "flex", alignItems: "center", justifyContent: "center",
                  fontSize: 11, fontWeight: 700,
                  color: barColor,
                }}>{s.countryCode}</div>
                <span style={{ fontSize: 14, fontWeight: 500, color: C.text }}>{s.name}</span>
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <span style={S.riskBadge(s.risk)}>{s.risk}</span>
                <span style={{ fontSize: 15, fontWeight: 700, color: barColor }}>{s.score}</span>
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
