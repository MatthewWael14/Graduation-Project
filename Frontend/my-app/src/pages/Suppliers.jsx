import { useState, useEffect } from "react";
import { C, S } from "../styles/theme";
import { fetchRiskScores, fetchFallbackOptions, assignFallback } from "../services/api";

// ── Supplier Detail Modal ─────────────────────────────────────────────────────
function SupplierModal({ supplier, onClose }) {
  if (!supplier) return null;
  const s = supplier;
  const score = s.reliabilityScore ? parseFloat(s.reliabilityScore) : null;
  const scoreColor = score === null ? C.muted : (score > 0.8 ? C.green : score > 0.6 ? C.orange : C.red);

  return (
    <div style={{ position: "fixed", inset: 0, zIndex: 1000, background: "rgba(0,0,0,0.65)", display: "flex", alignItems: "center", justifyContent: "center", padding: 20 }} onClick={onClose}>
      <div style={{ background: C.surface, border: `1px solid ${C.border}`, borderRadius: 14, width: "100%", maxWidth: 540, boxShadow: "0 20px 60px rgba(0,0,0,0.5)", overflow: "hidden" }} onClick={e => e.stopPropagation()}>
        <div style={{ padding: "18px 22px", background: C.bg, borderBottom: `1px solid ${C.border}`, display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
          <div>
            <div style={{ fontSize: 16, fontWeight: 700, color: C.text }}>{s.supplierName || s.supplier || s.supplierLabel || "Unknown Supplier"}</div>
            <div style={{ fontSize: 12, color: C.muted, marginTop: 2 }}>{s.material || s.materialLabel || ""}</div>
          </div>
          <button onClick={onClose} style={{ background: "none", border: "none", color: C.muted, cursor: "pointer", fontSize: 18 }}>✕</button>
        </div>

        {/* Stats row */}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", borderBottom: `1px solid ${C.border}` }}>
          {[
            ["Reliability", score !== null ? `${(score * 100).toFixed(0)}%` : "—", scoreColor],
            ["Lead Time", s.leadTime ? `${s.leadTime}d` : "—", C.text],
            ["Status", s.status || "—", s.status === "RED" ? C.red : C.green],
          ].map(([label, val, color], i) => (
            <div key={i} style={{ padding: "14px 0", textAlign: "center", borderRight: i < 2 ? `1px solid ${C.border}` : "none" }}>
              <div style={{ fontSize: 22, fontWeight: 700, color }}>{val}</div>
              <div style={{ fontSize: 11, color: C.muted, marginTop: 2 }}>{label}</div>
            </div>
          ))}
        </div>

        <div style={{ padding: "16px 22px" }}>
          {(() => {
            const seen = new Set();
            return Object.entries(s)
              .filter(([k]) => !["__type", "status"].includes(k)) // hide status too, it's in the top row
              .map(([k, v]) => {
                const formattedKey = k.replace(/([A-Z])/g, " $1").replace(/ Label| Name/gi, "").trim();
                const keyLower = formattedKey.toLowerCase();
                if (seen.has(keyLower)) return null;
                seen.add(keyLower);
                return (
                  <div key={k} style={{ display: "flex", justifyContent: "space-between", padding: "7px 0", borderBottom: `1px solid ${C.border}22`, fontSize: 13 }}>
                    <span style={{ color: C.muted, textTransform: "capitalize" }}>{formattedKey}</span>
                    <span style={{ color: C.text, fontWeight: 500, maxWidth: "60%", textAlign: "right", wordBreak: "break-word" }}>{String(v)}</span>
                  </div>
                );
              }).filter(Boolean);
          })()}
        </div>
      </div>
    </div>
  );
}

// ── Fallback Modal ────────────────────────────────────────────────────────────
function FallbackModal({ material, onClose, onAssign }) {
  const [selected, setSelected] = useState(null);
  const [assignType, setAssignType] = useState("temp");
  const [confirming, setConfirming] = useState(false);
  const [ranked, setRanked] = useState([]);
  const [loadingSuppliers, setLoadingSuppliers] = useState(true);
  const [fetchError, setFetchError] = useState("");

  useEffect(() => {
    fetchFallbackOptions(material)
      .then(results => {
        const sorted = [...results].sort((a, b) =>
          (parseFloat(b.reliabilityScore) || 0) - (parseFloat(a.reliabilityScore) || 0)
        );
        setRanked(sorted);
      })
      .catch(err => setFetchError(err.message))
      .finally(() => setLoadingSuppliers(false));
  }, [material]);

  const handleConfirm = async () => {
    if (!selected) return;
    setConfirming(true);
    await new Promise(r => setTimeout(r, 600));
    onAssign(material, selected, assignType);
    setConfirming(false);
    onClose();
  };

  return (
    <div style={{ position: "fixed", inset: 0, zIndex: 1000, background: "rgba(0,0,0,0.65)", display: "flex", alignItems: "center", justifyContent: "center", padding: 20 }} onClick={onClose}>
      <div style={{ background: C.surface, border: `1px solid ${C.border}`, borderRadius: 14, width: "100%", maxWidth: 540, boxShadow: "0 20px 60px rgba(0,0,0,0.5)", overflow: "hidden" }} onClick={e => e.stopPropagation()}>
        <div style={{ padding: "16px 20px", background: C.bg, borderBottom: `1px solid ${C.border}`, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <div>
            <div style={{ fontSize: 15, fontWeight: 700, color: C.text }}>🔄 Fallback Supplier Options</div>
            <div style={{ fontSize: 12, color: C.muted }}>Material: <span style={{ color: C.accent, fontWeight: 600 }}>{material}</span></div>
          </div>
          <button onClick={onClose} style={{ background: "none", border: "none", color: C.muted, cursor: "pointer", fontSize: 18 }}>✕</button>
        </div>

        <div style={{ padding: "16px 20px" }}>
          {loadingSuppliers && (
            <div style={{ textAlign: "center", padding: "28px", color: C.accent }}>
              <span className="spin">⚙</span> Querying Knowledge Graph...
            </div>
          )}
          {fetchError && (
            <div style={{ padding: "10px 14px", background: C.red + "15", border: `1px solid ${C.red}33`, borderRadius: 8, fontSize: 13, color: C.red, marginBottom: 12 }}>
              ⚠ {fetchError}
            </div>
          )}
          {!loadingSuppliers && ranked.length === 0 && !fetchError && (
            <div style={{ textAlign: "center", padding: "28px", color: C.muted, fontSize: 13 }}>
              <div style={{ fontSize: 32, marginBottom: 10 }}>📭</div>
              No fallback suppliers found for <strong>{material}</strong> in the Knowledge Graph
            </div>
          )}
          {!loadingSuppliers && ranked.length > 0 && (
            <>
              <div style={{ fontSize: 12, color: C.muted, marginBottom: 12, fontWeight: 600 }}>
                RANKED BY RELIABILITY SCORE — {ranked.length} FOUND
              </div>
              {ranked.map((s, i) => (
                <div key={i} onClick={() => setSelected(s)}
                  style={{ padding: "12px 14px", marginBottom: 8, borderRadius: 8, border: `2px solid ${selected === s ? C.accent : C.border}`, background: selected === s ? C.accent + "08" : C.bg, cursor: "pointer", display: "flex", alignItems: "center", gap: 12, transition: "all 0.15s" }}>
                  <div style={{ width: 28, height: 28, borderRadius: "50%", background: i === 0 ? "#ffd700" : i === 1 ? "#c0c0c0" : C.border, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 12, fontWeight: 700, color: i < 2 ? "#000" : C.muted, flexShrink: 0 }}>
                    #{i + 1}
                  </div>
                  <div style={{ flex: 1 }}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 4 }}>
                      <span style={{ fontSize: 14, fontWeight: 700, color: C.text }}>
                        {s.supplierName || s.name || s.supplier || "Unknown"}
                      </span>
                      {s.reliabilityScore && (
                        <span style={{ fontSize: 13, fontWeight: 700, color: C.green }}>
                          {(parseFloat(s.reliabilityScore) * 100).toFixed(0)}% reliable
                        </span>
                      )}
                    </div>
                    <div style={{ fontSize: 12, color: C.muted }}>
                      {s.leadTime && `Lead time: ${s.leadTime}d`}
                      {s.country && ` · ${s.country}`}
                    </div>
                  </div>
                  {selected === s && <span style={{ color: C.accent, fontSize: 18 }}>✓</span>}
                </div>
              ))}
            </>
          )}

          {/* Assignment type */}
          {selected && (
            <div style={{ marginTop: 14, padding: "12px 14px", background: C.bg, borderRadius: 8, border: `1px solid ${C.border}` }}>
              <div style={{ fontSize: 12, color: C.muted, marginBottom: 10, fontWeight: 600 }}>ASSIGNMENT TYPE</div>
              <div style={{ display: "flex", gap: 10 }}>
                {[
                  { val: "temp", label: "Temporary", desc: "Emergency supply only" },
                  { val: "permanent", label: "Permanent", desc: "Replace primary supplier" },
                ].map(opt => (
                  <div key={opt.val} onClick={() => setAssignType(opt.val)}
                    style={{ flex: 1, padding: "10px 12px", borderRadius: 7, cursor: "pointer", border: `2px solid ${assignType === opt.val ? C.accent : C.border}`, background: assignType === opt.val ? C.accent + "08" : "transparent", transition: "all 0.15s" }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 4 }}>
                      <div style={{ width: 14, height: 14, borderRadius: "50%", border: `2px solid ${assignType === opt.val ? C.accent : C.border}`, background: assignType === opt.val ? C.accent : "transparent" }} />
                      <span style={{ fontSize: 13, fontWeight: 700, color: assignType === opt.val ? C.accent : C.text }}>{opt.label}</span>
                    </div>
                    <div style={{ fontSize: 11, color: C.muted, paddingLeft: 20 }}>{opt.desc}</div>
                  </div>
                ))}
              </div>
            </div>
          )}

          <div style={{ display: "flex", gap: 8, marginTop: 16 }}>
            <button style={{ ...S.btn("ghost"), flex: 1 }} onClick={onClose}>Cancel</button>
            <button style={{ ...S.btn(), flex: 2, opacity: selected ? 1 : 0.5 }}
              disabled={!selected || confirming} onClick={handleConfirm}>
              {confirming ? <span className="spin">⚙</span> : `Assign ${assignType === "temp" ? "Temporary" : "Permanent"} Supplier`}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Main Page ─────────────────────────────────────────────────────────────────
export default function Suppliers({ user }) {
  const [suppliers, setSuppliers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [detailSupplier, setDetailSupplier] = useState(null);
  const [fallbackMaterial, setFallbackMaterial] = useState(null);

  const isLogistics = user?.role === "logistics" || user?.role === "admin";

  useEffect(() => {
    fetchRiskScores()
      .then(data => setSuppliers(data || []))
      .catch(err => setError(err.message))
      .finally(() => setLoading(false));
  }, []);

  const handleAssign = async (material, supplier, type) => {
    try {
      await assignFallback(material, supplier.supplierName || supplier.name || supplier.supplier, type);
      const newData = await fetchRiskScores();
      setSuppliers(newData || []);
    } catch (err) {
      setError(`Failed to assign fallback supplier: ${err.message}`);
    }
  };

  // At-risk items = suppliers with RED status
  const atRisk = suppliers.filter(s => s.status === "RED");

  return (
    <div>
      {detailSupplier && <SupplierModal supplier={detailSupplier} onClose={() => setDetailSupplier(null)} />}
      {fallbackMaterial && <FallbackModal material={fallbackMaterial} onClose={() => setFallbackMaterial(null)} onAssign={handleAssign} />}

      <div style={S.pageHeader}>
        <div style={S.pageTitle}>Supplier Network</div>
        <div style={S.pageDesc}>
          {isLogistics
            ? "Click any supplier to view details · Manage fallback assignments for at-risk materials"
            : "Click any supplier to view full details"}
        </div>
      </div>

      {/* Error */}
      {error && (
        <div style={{ padding: "12px 16px", background: C.red + "15", border: `1px solid ${C.red}33`, borderRadius: 8, fontSize: 13, color: C.red, marginBottom: 16 }}>
          ⚠ Backend error: {error}
        </div>
      )}

      {/* Loading */}
      {loading && (
        <div style={{ ...S.card, textAlign: "center", padding: "48px", color: C.accent, marginBottom: 16 }}>
          <div style={{ fontSize: 22, marginBottom: 10 }} className="spin">⚙</div>
          <div style={{ fontSize: 14 }}>Loading supplier data from Knowledge Graph...</div>
        </div>
      )}

      {/* Logistics: at-risk fallback panel */}
      {isLogistics && !loading && atRisk.length > 0 && (
        <div style={{ ...S.card, marginBottom: 20, borderLeft: `3px solid ${C.orange}` }}>
          <div style={S.cardHeader}>
            <span style={S.cardTitle}>⚠ At-Risk Materials · Fallback Management</span>
            <span style={{ ...S.badge(C.blue), fontSize: 11 }}>{user?.roleLabel}</span>
          </div>
          {atRisk.map((r, i) => {
            const material = r.material || r.materialLabel || "Unknown";
            return (
              <div key={i} style={{ padding: "12px 14px", background: C.bg, borderRadius: 8, border: `1px solid ${C.border}`, display: "flex", alignItems: "center", gap: 14, marginBottom: 8 }}>
                <div style={{ width: 10, height: 10, borderRadius: "50%", background: C.red, boxShadow: `0 0 8px ${C.red}`, flexShrink: 0 }} />
                <div style={{ flex: 1 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 2 }}>
                    <span style={{ fontSize: 14, fontWeight: 700, color: C.text }}>{material}</span>
                    <span style={S.riskBadge("HIGH")}>RED</span>
                  </div>
                  <div style={{ fontSize: 12, color: C.muted }}>Supplier: {r.supplier || r.supplierLabel || "—"}</div>
                </div>
                <div style={{ display: "flex", gap: 8 }}>
                  <button style={{ ...S.btn(), fontSize: 12, padding: "5px 14px" }}
                    onClick={() => setFallbackMaterial(material)}>
                    🔄 Fallback
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Empty state */}
      {!loading && !error && suppliers.length === 0 && (
        <div style={{ ...S.card, textAlign: "center", padding: "48px 24px" }}>
          <div style={{ fontSize: 40, marginBottom: 14 }}>📭</div>
          <div style={{ fontSize: 16, fontWeight: 700, color: C.text, marginBottom: 8 }}>No supplier data returned</div>
          <div style={{ fontSize: 14, color: C.muted }}>
            The Knowledge Graph returned no risk scores.<br />
            Check that GraphDB is running and the ontology namespace is correct.
          </div>
        </div>
      )}

      {/* Supplier cards from real data */}
      {!loading && suppliers.length > 0 && (
        <>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: 14, marginBottom: 8 }}>
            {[
              { label: "Total Suppliers", value: suppliers.length, color: C.blue },
              { label: "At Risk (RED)", value: atRisk.length, color: C.red },
              { label: "Stable (GREEN)", value: suppliers.filter(s => s.status === "GREEN").length, color: C.green },
              { label: "Materials", value: new Set(suppliers.map(s => s.material || s.materialLabel)).size, color: C.purple },
            ].map((k, i) => (
              <div key={i} style={{ ...S.card, borderTop: `3px solid ${k.color}`, padding: 14 }}>
                <div style={{ fontSize: 11, color: C.muted, marginBottom: 6, textTransform: "uppercase", letterSpacing: "0.07em" }}>{k.label}</div>
                <div style={{ fontSize: 24, fontWeight: 700, color: k.color }}>{k.value}</div>
              </div>
            ))}
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: 12 }}>
            {suppliers.map((s, i) => {
              const isRed = s.status === "RED";
              const color = isRed ? C.red : C.green;
              const name = s.supplier || s.supplierLabel || s.supplierName || `Supplier ${i + 1}`;
              const material = s.material || s.materialLabel || "—";
              const process = s.process || s.processLabel || "";
              const product = s.product || s.productLabel || "";
              const score = s.reliabilityScore ? `${(parseFloat(s.reliabilityScore) * 100).toFixed(0)}%` : "—";

              return (
                <div key={i} className="card-hover"
                  onClick={() => setDetailSupplier(s)}
                  style={{ ...S.card, cursor: "pointer", borderTop: `3px solid ${color}`, transition: "all 0.15s" }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 10 }}>
                    <div style={{ flex: 1, marginRight: 8 }}>
                      <div style={{ fontSize: 13, fontWeight: 700, color: C.text, lineHeight: 1.3 }}>{name}</div>
                      <div style={{ fontSize: 11, color: C.muted, marginTop: 2 }}>{material}</div>
                    </div>
                    <span style={S.riskBadge(isRed ? "HIGH" : "LOW")}>{s.status}</span>
                  </div>
                  {process && (
                    <div style={{ fontSize: 11, color: C.muted, marginBottom: product ? 2 : 8 }}>Process: {process}</div>
                  )}
                  {product && (
                    <div style={{ fontSize: 11, color: C.muted, marginBottom: 8 }}>Product: {product}</div>
                  )}
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: 8 }}>
                    <div style={{ fontSize: 11, color: C.muted }}>Reliability</div>
                    <div style={{ fontSize: 14, fontWeight: 700, color }}>{score}</div>
                  </div>
                  <div style={{ height: 3, background: C.border, borderRadius: 99, marginTop: 6 }}>
                    <div style={{ height: "100%", width: s.reliabilityScore ? `${parseFloat(s.reliabilityScore) * 100}%` : "0%", background: color, borderRadius: 99 }} />
                  </div>
                  <div style={{ fontSize: 11, color: C.muted, marginTop: 8, textAlign: "right" }}>Click to view →</div>
                </div>
              );
            })}
          </div>
        </>
      )}
    </div>
  );
}
