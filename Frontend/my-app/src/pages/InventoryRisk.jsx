import { useState, useEffect } from "react";
import { C, S } from "../styles/theme";
import { fetchRiskScores, simulateIoTEvent } from "../services/api";

function SimulateModal({ product, onClose }) {
  const [delay, setDelay] = useState(48);
  const [reason, setReason] = useState("Customs Hold");
  const [loading, setLoading] = useState(false);
  const [alertResult, setAlertResult] = useState(null);
  const [error, setError] = useState("");

  const handleSimulate = async () => {
    setLoading(true);
    setError("");
    try {
      // Create a dummy delivery ID based on supplier
      const deliveryId = "DELIV_" + (product.supplierLabel || product.supplier || "001").toUpperCase().replace(/\s+/g, "_");
      const res = await simulateIoTEvent({
        delivery_id: deliveryId,
        estimated_delay_hours: parseInt(delay, 10),
        reason_code: reason
      });
      setAlertResult(res);
    } catch (err) {
      setError(err.message || "Failed to simulate IoT event.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ position:"fixed", inset:0, zIndex:1000, background:"rgba(0,0,0,0.65)", display:"flex", alignItems:"center", justifyContent:"center", padding:20 }} onClick={onClose}>
      <div style={{ background:C.surface, border:`1px solid ${C.border}`, borderRadius:14, width:"100%", maxWidth:500, boxShadow:"0 20px 60px rgba(0,0,0,0.5)", overflow:"hidden" }} onClick={e=>e.stopPropagation()}>
        <div style={{ padding:"16px 20px", background:C.bg, borderBottom:`1px solid ${C.border}`, display:"flex", justifyContent:"space-between", alignItems:"center" }}>
          <div style={{ fontSize:15, fontWeight:700, color:C.text }}>🚧 Simulate IoT Delay</div>
          <button onClick={onClose} style={{ background:"none", border:"none", color:C.muted, cursor:"pointer", fontSize:18 }}>✕</button>
        </div>

        <div style={{ padding:"16px 20px" }}>
          {!alertResult ? (
            <>
              <div style={{ fontSize:13, color:C.muted, marginBottom:16 }}>
                Simulate a real-time IoT telemetry event from a delivery truck to test the AI Risk Engine.
              </div>
              <div style={{ marginBottom:12 }}>
                <label style={{ fontSize:12, fontWeight:700, color:C.text, display:"block", marginBottom:6 }}>Supplier</label>
                <div style={{ padding:"8px 12px", background:C.bg, border:`1px solid ${C.border}`, borderRadius:6, fontSize:13, color:C.muted }}>
                  {product.supplierLabel || product.supplier || "Unknown"}
                </div>
              </div>
              <div style={{ display:"flex", gap:12, marginBottom:16 }}>
                <div style={{ flex:1 }}>
                  <label style={{ fontSize:12, fontWeight:700, color:C.text, display:"block", marginBottom:6 }}>Delay (Hours)</label>
                  <input type="number" value={delay} onChange={e=>setDelay(e.target.value)} style={{ ...S.input }} />
                </div>
                <div style={{ flex:2 }}>
                  <label style={{ fontSize:12, fontWeight:700, color:C.text, display:"block", marginBottom:6 }}>Reason Code</label>
                  <select value={reason} onChange={e=>setReason(e.target.value)} style={{ ...S.select }}>
                    <option value="Customs Hold">Customs Hold</option>
                    <option value="Traffic Accident">Traffic Accident</option>
                    <option value="Weather Delay">Weather Delay</option>
                    <option value="Equipment Failure">Equipment Failure</option>
                  </select>
                </div>
              </div>

              {error && <div style={{ color:C.red, fontSize:13, marginBottom:12 }}>⚠ {error}</div>}

              <button style={{ ...S.btn(), width:"100%" }} onClick={handleSimulate} disabled={loading}>
                {loading ? <span className="spin">⚙</span> : "Simulate IoT Event"}
              </button>
            </>
          ) : (
            <>
              <div style={{ textAlign:"center", marginBottom:16 }}>
                <div style={{ fontSize:40, marginBottom:10 }}>🚨</div>
                <div style={{ fontSize:16, fontWeight:700, color:C.red }}>Manager Alert Generated!</div>
              </div>
              <div style={{ padding:"14px", background:C.bg, border:`1px solid ${C.border}`, borderRadius:8, fontSize:13, marginBottom:16 }}>
                <div style={{ fontWeight:700, color:C.text, marginBottom:6 }}>{alertResult.alert_title}</div>
                <div style={{ color:C.muted, lineHeight:1.5 }}>{alertResult.alert_description}</div>
                <div style={{ display:"flex", justifyContent:"space-between", marginTop:12, paddingTop:12, borderTop:`1px solid ${C.border}` }}>
                  <span><span style={{ color:C.muted }}>Risk:</span> <span style={S.riskBadge("HIGH")}>{alertResult.risk_level}</span></span>
                  <span><span style={{ color:C.muted }}>Delay:</span> {alertResult.estimated_delay_hours} hrs</span>
                </div>
              </div>
              <button style={{ ...S.btn(), width:"100%" }} onClick={onClose}>Close Simulation</button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

export default function InventoryRisk({ onNavigate }) {
  const [products, setProducts] = useState([]);
  const [loading,  setLoading]  = useState(true);
  const [error,    setError]    = useState("");
  const [selected, setSelected] = useState(null);
  const [simulating, setSimulating] = useState(null);

  useEffect(() => {
    fetchRiskScores()
      .then(p => setProducts(p))
      .catch(err => setError(err.message))
      .finally(() => setLoading(false));
  }, []);

  return (
    <div>
      {simulating && <SimulateModal product={simulating} onClose={() => setSimulating(null)} />}
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
                  {(p.productLabel || p.product) && (
                    <div style={{ fontSize: 11, color: C.muted, marginTop: 4 }}>Process: {p.productLabel || p.product}</div>
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
                    .filter(k => !k.endsWith("Label"))
                    .map(k => (
                      <th key={k} style={S.th}>{k}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {products.map((p, i) => (
                  <tr key={i} className="data-row">
                    {Object.keys(p)
                      .filter(k => !k.endsWith("Label"))
                      .map(k => (
                        <td key={k} style={{ ...S.td, fontSize: 13 }}>{String(p[k] ?? "—")}</td>
                    ))}
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
          <div style={{ display: "flex", gap: 8 }}>
            <button style={S.btn()} onClick={() => onNavigate("suppliers")}>🔄 Find Fallback Supplier</button>
            <button style={S.btn("secondary")} onClick={() => setSimulating(products[selected])}>🚧 Simulate Delay</button>
            <button style={S.btn("ghost")} onClick={() => onNavigate("ai")}>🤖 Ask AI</button>
          </div>
        </div>
      )}
    </div>
  );
}
