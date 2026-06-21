import { useState, useEffect } from "react";
import { C, S } from "../styles/theme";
import { fetchRiskScores } from "../services/api";

// ── Material Detail Modal ─────────────────────────────────────────────────────
function MaterialModal({ product, onClose, onNavigate }) {
  if (!product) return null;
  const p = product;
  const isRed = p.status === "RED";
  const score = p.reliabilityScore ? parseFloat(p.reliabilityScore) : null;
  const scoreColor = score === null ? C.muted : score > 0.8 ? C.green : score > 0.6 ? C.orange : C.red;

  return (
    <div
      style={{ position: "fixed", inset: 0, zIndex: 1000, background: "rgba(0,0,0,0.65)", display: "flex", alignItems: "center", justifyContent: "center", padding: 20 }}
      onClick={onClose}
    >
      <div
        style={{ background: C.surface, border: `1px solid ${C.border}`, borderRadius: 14, width: "100%", maxWidth: 560, boxShadow: "0 20px 60px rgba(0,0,0,0.5)", overflow: "hidden" }}
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div style={{ padding: "18px 22px", background: C.bg, borderBottom: `1px solid ${C.border}`, display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
          <div>
            <div style={{ fontSize: 16, fontWeight: 700, color: C.text }}>{p.materialLabel || p.material || "Unknown Material"}</div>
            <div style={{ fontSize: 12, color: C.muted, marginTop: 3 }}>Supplied by: {p.supplierLabel || p.supplier || "—"}</div>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <span style={S.riskBadge(isRed ? "HIGH" : "LOW")}>{isRed ? "⚠ AT RISK" : "✓ STABLE"}</span>
            <button onClick={onClose} style={{ background: "none", border: "none", color: C.muted, cursor: "pointer", fontSize: 20, lineHeight: 1 }}>✕</button>
          </div>
        </div>

        {/* Stats row */}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", borderBottom: `1px solid ${C.border}` }}>
          {[
            ["Reliability", score !== null ? `${(score * 100).toFixed(0)}%` : "—", scoreColor],
            ["Lead Time", p.leadTime ? `${p.leadTime}d` : "—", C.text],
            ["Status", p.status || "—", isRed ? C.red : C.green],
          ].map(([label, val, color], i) => (
            <div key={i} style={{ padding: "14px 0", textAlign: "center", borderRight: i < 2 ? `1px solid ${C.border}` : "none" }}>
              <div style={{ fontSize: 22, fontWeight: 700, color }}>{val}</div>
              <div style={{ fontSize: 11, color: C.muted, marginTop: 2 }}>{label}</div>
            </div>
          ))}
        </div>

        {/* Detail rows */}
        <div style={{ padding: "16px 22px", maxHeight: "40vh", overflowY: "auto" }}>
          {[
            ["Material", p.materialLabel || p.material],
            ["Supplier", p.supplierLabel || p.supplier],
            ["Impacted Process", p.processLabel || p.process],
            ["Final Product", p.productLabel || p.product],
            ["Reliability Score", score !== null ? `${(score * 100).toFixed(0)}%` : null],
            ["Lead Time", p.leadTime ? `${p.leadTime}d` : null],
            ["Country", p.country],
          ].filter(([, v]) => v).map(([k, v], i) => (
            <div key={i} style={{ display: "flex", justifyContent: "space-between", padding: "8px 0", borderBottom: `1px solid ${C.border}22`, fontSize: 13 }}>
              <span style={{ color: C.muted }}>{k}</span>
              <span style={{ color: C.text, fontWeight: 500, maxWidth: "60%", textAlign: "right", wordBreak: "break-word" }}>{v}</span>
            </div>
          ))}
        </div>

        {/* Footer actions */}
        <div style={{ padding: "14px 22px", background: C.bg, borderTop: `1px solid ${C.border}`, display: "flex", gap: 10 }}>
          {isRed && (
            <button style={S.btn()} onClick={() => { onClose(); onNavigate("suppliers"); }}>
              🔄 Find Fallback Supplier
            </button>
          )}
          <button style={S.btn("ghost")} onClick={() => { onClose(); onNavigate("ai"); }}>
            🤖 Ask AI
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Main Page ─────────────────────────────────────────────────────────────────
export default function InventoryRisk({ onNavigate }) {
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [selectedProduct, setSelectedProduct] = useState(null);
  const [searchQuery, setSearchQuery] = useState("");

  useEffect(() => {
    fetchRiskScores()
      .then(p => setProducts(p || []))
      .catch(err => setError(err.message))
      .finally(() => setLoading(false));
  }, []);

  const filtered = products.filter(p => {
    if (!searchQuery) return true;
    const q = searchQuery.toLowerCase();
    return (
      (p.material || p.materialLabel || "").toLowerCase().includes(q) ||
      (p.supplier || p.supplierLabel || "").toLowerCase().includes(q) ||
      (p.process || p.processLabel || "").toLowerCase().includes(q) ||
      (p.status || "").toLowerCase().includes(q)
    );
  });

  const atRisk = products.filter(p => p.status === "RED");
  const stable = products.filter(p => p.status !== "RED");

  return (
    <div>
      {selectedProduct && (
        <MaterialModal
          product={selectedProduct}
          onClose={() => setSelectedProduct(null)}
          onNavigate={onNavigate}
        />
      )}

      {/* Header */}
      <div style={{ ...S.pageHeader, display: "flex", justifyContent: "space-between", alignItems: "flex-end" }}>
        <div>
          <div style={S.pageTitle}>Inventory Risk · Traffic Light</div>
          <div style={S.pageDesc}>Live data from Knowledge Graph · OWL reasoning · SPARQL · Click any card to view details</div>
        </div>

        {/* Search bar — same style as Suppliers */}
        <div style={{ display: "flex", alignItems: "center", gap: 8, background: C.card, padding: "8px 16px", borderRadius: 8, border: `1px solid ${C.border}44` }}>
          <span style={{ fontSize: 13, color: C.muted, fontWeight: 500 }}>🔍 Search:</span>
          <input
            type="text"
            placeholder="material, supplier..."
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            style={{ padding: "6px 12px", borderRadius: 4, border: `1px solid ${C.border}`, background: C.bg, color: C.text, fontSize: 13, outline: "none", width: 180, transition: "all 0.15s" }}
          />
        </div>
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
          <div style={{ fontSize: 14, color: C.muted }}>The Knowledge Graph returned no results. Check that GraphDB is running.</div>
        </div>
      )}

      {!loading && products.length > 0 && (
        <>
          {/* KPI cards */}
          <div style={{ display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: 12, marginBottom: 20 }}>
            {[
              { label: "Total Materials", value: products.length, color: C.blue },
              { label: "At Risk (RED)", value: atRisk.length, color: C.red },
              { label: "Stable (GREEN)", value: stable.length, color: C.green },
              { label: "Unique Suppliers", value: new Set(products.map(p => p.supplier || p.supplierLabel)).size, color: C.purple },
            ].map((k, i) => (
              <div key={i} style={{ ...S.card, borderTop: `3px solid ${k.color}`, padding: 16 }}>
                <div style={{ fontSize: 11, color: C.muted, textTransform: "uppercase", letterSpacing: "0.07em", marginBottom: 8 }}>{k.label}</div>
                <div style={{ fontSize: 26, fontWeight: 700, color: k.color }}>{k.value}</div>
              </div>
            ))}
          </div>

          {/* Traffic light cards */}
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(210px, 1fr))", gap: 14, marginBottom: 22 }}>
            {filtered.map((p, i) => {
              const isAtRisk = p.status === "RED";
              const color = isAtRisk ? C.red : C.green;
              const score = p.reliabilityScore ? parseFloat(p.reliabilityScore) : null;
              return (
                <div
                  key={i}
                  className="card-hover"
                  onClick={() => setSelectedProduct(p)}
                  style={{ ...S.card, cursor: "pointer", borderTop: `3px solid ${color}`, transition: "all 0.15s" }}
                >
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
                    <div style={{ width: 10, height: 10, borderRadius: "50%", background: color, boxShadow: `0 0 8px ${color}` }} />
                    <span style={S.riskBadge(isAtRisk ? "HIGH" : "LOW")}>{isAtRisk ? "AT RISK" : "OK"}</span>
                  </div>
                  <div style={{ fontSize: 13, fontWeight: 700, color: C.text, marginBottom: 4 }}>{p.materialLabel || p.material || "—"}</div>
                  <div style={{ fontSize: 12, color: C.muted, marginBottom: 4 }}>{p.supplierLabel || p.supplier || "—"}</div>
                  {(p.processLabel || p.process) && (
                    <div style={{ fontSize: 11, color: C.muted, marginBottom: 2 }}>Process: {p.processLabel || p.process}</div>
                  )}
                  {score !== null && (
                    <>
                      <div style={{ display: "flex", justifyContent: "space-between", marginTop: 8, fontSize: 11 }}>
                        <span style={{ color: C.muted }}>Reliability</span>
                        <span style={{ color, fontWeight: 700 }}>{(score * 100).toFixed(0)}%</span>
                      </div>
                      <div style={{ height: 3, background: C.border, borderRadius: 99, marginTop: 4 }}>
                        <div style={{ height: "100%", width: `${score * 100}%`, background: color, borderRadius: 99 }} />
                      </div>
                    </>
                  )}
                  <div style={{ fontSize: 11, color: C.muted, marginTop: 8, textAlign: "right" }}>Click to view →</div>
                </div>
              );
            })}
          </div>

          {/* Full data table */}
          <div style={S.card}>
            <div style={S.cardHeader}>
              <span style={S.cardTitle}>📊 Full Results from Knowledge Graph</span>
              <span style={S.badge(C.green)}>{filtered.length} rows</span>
            </div>
            <table style={S.table}>
              <thead>
                <tr>
                  {["Material", "Supplier", "Process", "Status", "Reliability", "Lead Time"].map(h => (
                    <th key={h} style={S.th}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filtered.map((p, i) => {
                  const isRed = p.status === "RED";
                  const score = p.reliabilityScore ? `${(parseFloat(p.reliabilityScore) * 100).toFixed(0)}%` : "—";
                  return (
                    <tr key={i} className="data-row" style={{ cursor: "pointer" }} onClick={() => setSelectedProduct(p)}>
                      <td style={S.td}>{p.materialLabel || p.material || "—"}</td>
                      <td style={S.td}>{p.supplierLabel || p.supplier || "—"}</td>
                      <td style={S.td}>{p.processLabel || p.process || "—"}</td>
                      <td style={S.td}>
                        <span style={S.riskBadge(isRed ? "HIGH" : "LOW")}>{p.status}</span>
                      </td>
                      <td style={{ ...S.td, color: isRed ? C.red : C.green, fontWeight: 700 }}>{score}</td>
                      <td style={S.td}>{p.leadTime ? `${p.leadTime}d` : "—"}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  );
}
