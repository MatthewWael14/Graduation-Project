import { C, S } from "../../styles/theme";

export default function SLAViolationsTable({ data, onNavigate }) {
  const violated = data.filter(d => d.violationStatus);
  const totalOwed = data.reduce((acc, s) => acc + (s.penaltyOwed || 0), 0);

  return (
    <div style={S.card}>
      <div style={S.cardHeader}>
        <span style={S.cardTitle}>📋 SLA Compliance Monitor</span>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <span style={{ fontSize: 12, color: C.muted }}>
            {data.length} contracts
            {violated.length > 0 && (
              <span style={{ color: C.red, marginLeft: 6, fontWeight: 700 }}>· {violated.length} breached</span>
            )}
          </span>
          {onNavigate && (
            <button
              onClick={() => onNavigate("violations")}
              style={{ background: "none", border: "none", color: C.blue, fontSize: 12, cursor: "pointer", fontWeight: 600, padding: 0 }}
            >
              View All →
            </button>
          )}
        </div>
      </div>

      {totalOwed > 0 && (
        <div style={{ padding: "10px 14px", background: C.accent + "11", border: `1px solid ${C.accent}33`, borderRadius: 8, marginBottom: 14, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <span style={{ fontSize: 12, color: C.muted }}>Total Penalties Owed</span>
          <span style={{ fontSize: 16, fontWeight: 800, color: C.accent }}>${totalOwed.toLocaleString()}</span>
        </div>
      )}

      <div style={{ overflowX: "auto" }}>
        <table style={S.table}>
          <thead>
            <tr>
              {["Supplier", "Material", "Violation Type", "Compliance", "Penalty Owed", "Status"].map(h => (
                <th key={h} style={S.th}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {data.map((s, i) => {
              const violationLabel = s.violationType === "UnderShipment" ? "⚠️ Under-Shipment"
                : s.violationType === "DamagedGoods" ? "❌ Damaged Goods"
                : s.violationStatus ? "⏳ Late Delivery"
                : "—";
              return (
                <tr key={i} className="data-row" style={{ background: s.violationStatus ? "rgba(239,68,68,0.04)" : "transparent" }}>
                  <td style={{ ...S.td, fontWeight: 600, color: C.text }}>{s.supplier}</td>
                  <td style={{ ...S.td, color: C.muted, fontSize: 12 }}>{s.material}</td>
                  <td style={{ ...S.td, fontSize: 12 }}>
                    {s.violationStatus
                      ? <span style={{ color: C.red, fontWeight: 600 }}>{violationLabel}</span>
                      : <span style={{ color: C.muted }}>—</span>}
                  </td>
                  <td style={S.td}>
                    {s.compliance !== null ? (
                      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                        <span style={{ fontWeight: 700, fontSize: 13, color: s.compliance > 80 ? C.green : s.compliance > 60 ? C.orange : C.red }}>{s.compliance}%</span>
                        <div style={{ flex: 1, height: 5, background: C.border + "55", borderRadius: 99, overflow: "hidden", minWidth: 40 }}>
                          <div style={{ height: "100%", width: `${s.compliance}%`, background: s.compliance > 80 ? C.green : s.compliance > 60 ? C.orange : C.red, borderRadius: 99 }} />
                        </div>
                      </div>
                    ) : <span style={{ color: C.muted }}>—</span>}
                  </td>
                  <td style={{ ...S.td, fontWeight: 700, color: s.penaltyOwed > 0 ? C.green : C.muted }}>
                    {s.penaltyOwed > 0 ? `$${s.penaltyOwed.toLocaleString()}` : "—"}
                  </td>
                  <td style={S.td}>
                    {s.violationStatus
                      ? <span style={S.riskBadge("CRITICAL")}>BREACHED</span>
                      : <span style={S.riskBadge("LOW")}>COMPLIANT</span>}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
