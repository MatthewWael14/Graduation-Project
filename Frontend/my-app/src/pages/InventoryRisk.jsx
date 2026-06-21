import { useState, useEffect } from "react";
import { C, S } from "../styles/theme";
import { fetchRiskScores } from "../services/api";

const COLUMN_HEADERS = {
  material: "Material",
  supplier: "Supplier",
  process: "Impacted Process",
  status: "Status",
  reliabilityScore: "Reliability",
  leadTime: "Lead Time",
  stock: "Current Stock",
  threshold: "Safety Stock Level",
  requiredQty: "Delayed Quantity"
};

export default function InventoryRisk({ onNavigate }) {
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [selected, setSelected] = useState(null);

  useEffect(() => {
    fetchRiskScores()
      .then(p => setProducts(p))
      .catch(err => setError(err.message))
      .finally(() => setLoading(false));
  }, []);

  return (
    <div>
      <div style={S.pageHeader}>
        <div style={S.pageTitle}>Inventory Risk · Traffic Light</div>
        <div style={S.pageDesc}>Live data from Knowledge Graph · OWL reasoning · SPARQL</div>
      </div>

      {loading && (
        <div style={{ ...S.card, textAlign: "center", padding: "40px", color: C.accent }}>
          <div style={{ fontSize: 24, marginBottom: 10 }} className="spin">⚙</div>
          Querying Knowledge Graph via SPARQL...
        </div>
      )}

      {error && (
        <div style={{ padding: "14px 18px", background: C.red + "15", border: `1px solid ${C.red}33`, borderRadius: 8, fontSize: 14, color: C.red, marginBottom: 16 }}>
          ⚠ Backend error: {error}
        </div>
      )}

      {!loading && !error && products.length === 0 && (
        <div style={{ ...S.card, textAlign: "center", padding: "48px 24px" }}>
          <div style={{ fontSize: 40, marginBottom: 14 }}>📭</div>
          <div style={{ fontSize: 16, fontWeight: 700, color: C.text, marginBottom: 8 }}>No impacted products found</div>
          <div style={{ fontSize: 14, color: C.muted, maxWidth: 420, margin: "0 auto" }}>
            The Knowledge Graph returned no results for the impacted products query.<br /><br />
            This likely means the SPARQL query namespace doesn't match the ontology. Check that the backend prefix matches:
            <code style={{ display: "block", marginTop: 10, padding: "8px 12px", background: C.bg, borderRadius: 6, fontSize: 12, color: C.accent }}>
              http://www.semanticweb.org/youssef/ontologies/2026/1/trail1#
            </code>
          </div>
        </div>
      )}

      {!loading && products.length > 0 && (
        <>
          {/* Traffic light cards */}
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(200px, 1fr))", gap: 14, marginBottom: 22 }}>
            {products.map((p, i) => {
              const isAtRisk = p.status === "RED";
              const color = isAtRisk ? C.red : C.green;
              return (
                <div key={i} className="card-hover"
                  onClick={() => setSelected(selected === i ? null : i)}
                  style={{ ...S.card, cursor: "pointer", borderTop: `3px solid ${color}`, outline: selected === i ? `2px solid ${color}` : "none", outlineOffset: 2 }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
                    <div style={{ width: 12, height: 12, borderRadius: "50%", background: color, boxShadow: `0 0 10px ${color}` }} className="glow-dot" />
                    <span style={S.riskBadge(isAtRisk ? "HIGH" : "LOW")}>{isAtRisk ? "AT RISK" : "OK"}</span>
                  </div>
                  <div style={{ fontSize: 13, fontWeight: 700, color: C.text, marginBottom: 6 }}>{p.materialLabel || p.material || "—"}</div>
                  <div style={{ fontSize: 12, color: C.muted }}>{p.supplierLabel || p.supplier || "—"}</div>
                  {(p.processLabel || p.process) && (
                    <div style={{ fontSize: 11, color: C.muted, marginTop: 4 }}>Process: {p.processLabel || p.process}</div>
                  )}
                </div>
              );
            })}
          </div>

          {/* Detail table */}
          <div style={S.card}>
            <div style={S.cardHeader}>
              <span style={S.cardTitle}>📊 Full Results from Knowledge Graph</span>
              <span style={S.badge(C.green)}>{products.length} rows</span>
            </div>
            <table style={S.table}>
              <thead>
                <tr>
                  {Object.keys(products[0] || {})
                    .filter(k => k in COLUMN_HEADERS)
                    .map(k => (
                      <th key={k} style={S.th}>{COLUMN_HEADERS[k]}</th>
                    ))}
                </tr>
              </thead>
              <tbody>
                {products.map((p, i) => (
                  <tr key={i} className="data-row">
                    {Object.keys(p)
                      .filter(k => k in COLUMN_HEADERS)
                      .map(k => {
                        let val = p[k];
                        if (k === "reliabilityScore" && val !== null) {
                          val = `${(parseFloat(val) * 100).toFixed(0)}%`;
                        } else if (k === "leadTime" && val !== null) {
                          val = `${val}d`;
                        }
                        return (
                          <td key={k} style={{ ...S.td, fontSize: 13 }}>{String(val ?? "—")}</td>
                        );
                      })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}

      {selected !== null && products[selected] && (
        <div style={{ ...S.card, marginTop: 16, borderLeft: `4px solid ${C.blue}` }}>
          <div style={{ ...S.cardTitle, marginBottom: 12 }}>🔍 Detail — {products[selected].materialLabel || products[selected].material}</div>
          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            <div style={{ display: "flex", gap: 8 }}>
              <button style={S.btn()} onClick={() => onNavigate("suppliers")}>🔄 Find Fallback Supplier</button>
            </div>
            
            <div style={{ borderTop: `1px solid ${C.border}`, paddingTop: 12 }}>
              <div style={{ fontSize: 12, fontWeight: 600, color: C.muted, marginBottom: 8 }}>🤖 Ask AI Assistant:</div>
              <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                <button style={{ ...S.btn("ghost"), fontSize: 12 }} onClick={() => {
                  const mat = products[selected].materialLabel || products[selected].material || "";
                  onNavigate("ai", `Are there any alternative suppliers for ${mat}?`);
                }}>🔍 Alternative Suppliers</button>
                
                <button style={{ ...S.btn("ghost"), fontSize: 12 }} onClick={() => {
                  const mat = products[selected].materialLabel || products[selected].material || "";
                  onNavigate("ai", `Which production lines are affected by ${mat}?`);
                }}>🏭 Impacted Production Lines</button>
                
                <button style={{ ...S.btn("ghost"), fontSize: 12 }} onClick={() => {
                  const mat = products[selected].materialLabel || products[selected].material || "";
                  onNavigate("ai", `What is the inventory stock and safety stock level of ${mat}?`);
                }}>📦 Stock Levels</button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
