import { useState, useEffect } from "react";
import { C, S } from "../styles/theme";
import { inventoryRisks } from "../data/mockData";
import { fetchImpactedProducts } from "../services/api";

export default function InventoryRisk({ user, onNavigate }) {
  const [selected,         setSelected]         = useState(null);
  const [impactedProducts, setImpactedProducts] = useState([]);
  const [loading,          setLoading]          = useState(true);

  useEffect(() => {
    fetchImpactedProducts()
      .then(p => setImpactedProducts(p))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  return (
    <div>
      <div style={S.pageHeader}>
        <div style={S.pageTitle}>Inventory Risk · Traffic Light</div>
        <div style={S.pageDesc}>ML delay prediction · Semantic impact analysis · Real-time risk overview</div>
      </div>

      {/* Traffic Light Cards */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(5,1fr)", gap: 14, marginBottom: 22 }}>
        {inventoryRisks.map((r, i) => {
          const tlColor = r.trafficLight === "RED" ? C.red : r.trafficLight === "YELLOW" ? C.accent : C.green;
          return (
            <div key={i} className="card-hover"
              onClick={() => setSelected(selected === i ? null : i)}
              style={{
                ...S.card, cursor: "pointer",
                borderTop: `3px solid ${tlColor}`,
                outline: selected === i ? `2px solid ${tlColor}` : "none",
                outlineOffset: 2,
                transition: "all 0.15s",
              }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
                <div style={{ width: 12, height: 12, borderRadius: "50%", background: tlColor, boxShadow: `0 0 10px ${tlColor}` }} className="glow-dot" />
                <span style={S.riskBadge(r.risk)}>{r.risk}</span>
              </div>
              <div style={{ fontSize: 13, fontWeight: 700, color: C.text, marginBottom: 8, lineHeight: 1.3 }}>{r.material}</div>
              <div style={{ fontSize: 26, fontWeight: 800, color: tlColor }}>
                {r.stock}<span style={{ fontSize: 13, color: C.muted, fontWeight: 500 }}> / {r.threshold}</span>
              </div>
              <div style={{ fontSize: 12, color: C.muted, marginBottom: 8 }}>units in stock</div>
              <div style={{ height: 4, background: C.border, borderRadius: 99 }}>
                <div style={{ height: "100%", width: `${Math.min(100, (r.stock / r.threshold) * 100)}%`, background: tlColor, borderRadius: 99 }} />
              </div>
              {r.delay > 0 && (
                <div style={{ marginTop: 8, fontSize: 12, fontWeight: 700, color: tlColor }}>+{r.delay}d delay risk</div>
              )}
            </div>
          );
        })}
      </div>

      {/* Drill-down panel */}
      {selected !== null && (
        <div style={{
          ...S.card, marginBottom: 20,
          borderLeft: `4px solid ${inventoryRisks[selected].trafficLight === "RED" ? C.red : inventoryRisks[selected].trafficLight === "YELLOW" ? C.accent : C.green}`,
        }}>
          <div style={{ ...S.cardTitle, marginBottom: 14 }}>🔍 Risk Detail — {inventoryRisks[selected].material}</div>
          <div style={S.grid3}>
            <div>
              <div style={{ fontSize: 12, color: C.muted, marginBottom: 6, fontWeight: 600 }}>STOCK STATUS</div>
              <div style={{ fontSize: 15, color: C.text, fontWeight: 600 }}>{inventoryRisks[selected].stock} units remaining</div>
              <div style={{ fontSize: 13, color: C.muted }}>Threshold: {inventoryRisks[selected].threshold} units</div>
            </div>
            <div>
              <div style={{ fontSize: 12, color: C.muted, marginBottom: 6, fontWeight: 600 }}>ML DELAY PROBABILITY</div>
              <div style={{ fontSize: 28, fontWeight: 800, color: inventoryRisks[selected].delayProb > 70 ? C.red : inventoryRisks[selected].delayProb > 40 ? C.orange : C.green }}>
                {inventoryRisks[selected].delayProb}%
              </div>
              <div style={{ fontSize: 12, color: C.muted }}>Random Forest model</div>
            </div>
            <div>
              <div style={{ fontSize: 12, color: C.muted, marginBottom: 6, fontWeight: 600 }}>DOWNSTREAM IMPACT</div>
              {inventoryRisks[selected].processes.length > 0
                ? inventoryRisks[selected].processes.map((p, j) => (
                    <div key={j} style={{ fontSize: 13, color: C.orange, marginBottom: 4, display: "flex", alignItems: "center", gap: 6 }}>
                      <span>⚠</span> {p}
                    </div>
                  ))
                : <div style={{ fontSize: 13, color: C.green }}>✓ No downstream impact</div>}
            </div>
          </div>
          <div style={{ display: "flex", gap: 8, marginTop: 14 }}>
            <button style={S.btn()} className="btn-hover" onClick={() => onNavigate("suppliers")}>
              🔄 Find Fallback Supplier
            </button>
            <button style={S.btn("ghost")} className="btn-hover" onClick={() => onNavigate("ai")}>
              🤖 Ask AI for Analysis
            </button>
          </div>
        </div>
      )}

      <div style={S.grid2}>
        {/* ML Probability Table */}
        <div style={S.card}>
          <div style={S.cardHeader}>
            <span style={S.cardTitle}>📊 ML Delay Probability Matrix</span>
            <span style={S.badge(C.purple)}>Random Forest</span>
          </div>
          <table style={S.table}>
            <thead>
              <tr>{["Material","Stock","Threshold","Delay Prob","Traffic"].map(h => <th key={h} style={S.th}>{h}</th>)}</tr>
            </thead>
            <tbody>
              {inventoryRisks.map((r, i) => {
                const tlColor = r.trafficLight === "RED" ? C.red : r.trafficLight === "YELLOW" ? C.accent : C.green;
                return (
                  <tr key={i} className="data-row">
                    <td style={{ ...S.td, fontWeight: 600, color: C.text }}>{r.material}</td>
                    <td style={{ ...S.td, fontWeight: 700, color: r.stock < r.threshold ? C.red : C.green }}>{r.stock}</td>
                    <td style={{ ...S.td, color: C.muted }}>{r.threshold}</td>
                    <td style={S.td}>
                      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                        <span style={{ fontWeight: 700, color: r.delayProb > 70 ? C.red : r.delayProb > 40 ? C.orange : C.green }}>{r.delayProb}%</span>
                        <div style={{ width: 60, height: 4, background: C.border, borderRadius: 99 }}>
                          <div style={{ height: "100%", width: `${r.delayProb}%`, background: r.delayProb > 70 ? C.red : r.delayProb > 40 ? C.orange : C.green, borderRadius: 99 }} />
                        </div>
                      </div>
                    </td>
                    <td style={S.td}>
                      <div style={{ width: 12, height: 12, borderRadius: "50%", background: tlColor, boxShadow: `0 0 6px ${tlColor}` }} />
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          <div style={{ marginTop: 10, fontSize: 12, color: C.muted }}>Model accuracy: 91.3% · Last retrained: 2026-03-01</div>
        </div>

        {/* Impacted Products from backend */}
        <div style={S.card}>
          <div style={S.cardHeader}>
            <span style={S.cardTitle}>🏭 Impacted Production Processes</span>
            {loading ? <span className="spin" style={{ color: C.accent }}>⚙</span> : <span style={S.badge(C.green)}>LIVE</span>}
          </div>

          {loading && (
            <div style={{ textAlign: "center", padding: "20px", color: C.muted, fontSize: 13 }}>
              <span className="spin">⚙</span> Querying Knowledge Graph...
            </div>
          )}

          {!loading && impactedProducts.length > 0 && (
            <table style={S.table}>
              <thead>
                <tr>{["Supplier","Material","Process","Risk"].map(h => <th key={h} style={S.th}>{h}</th>)}</tr>
              </thead>
              <tbody>
                {impactedProducts.map((p, i) => (
                  <tr key={i} className="data-row">
                    <td style={{ ...S.td, fontWeight: 600 }}>{p.supplierLabel || p.supplier || "—"}</td>
                    <td style={{ ...S.td, color: C.muted }}>{p.materialLabel || p.material || "—"}</td>
                    <td style={S.td}>{p.productLabel || p.product || "—"}</td>
                    <td style={S.td}>
                      <span style={S.riskBadge(p.riskStatus === "true" || p.riskStatus === true ? "HIGH" : "LOW")}>
                        {p.riskStatus === "true" || p.riskStatus === true ? "AT RISK" : "OK"}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}

          {!loading && impactedProducts.length === 0 && (
            <div>
              {/* Fallback to local data */}
              {inventoryRisks.filter(r => r.processes.length > 0).map((r, i) => (
                <div key={i} style={{ padding: "10px 0", borderBottom: `1px solid ${C.border}22` }}>
                  <div style={{ fontSize: 14, fontWeight: 600, color: C.text, marginBottom: 4 }}>{r.material}</div>
                  {r.processes.map((p, j) => (
                    <div key={j} style={{ fontSize: 13, color: C.orange, display: "flex", alignItems: "center", gap: 6 }}>
                      <span>⚠</span> {p}
                    </div>
                  ))}
                </div>
              ))}
              <div style={{ marginTop: 10, fontSize: 12, color: C.muted }}>Showing local data — connect GraphDB for live results</div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
