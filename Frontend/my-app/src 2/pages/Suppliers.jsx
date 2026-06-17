import { useState, useEffect } from "react";
import { C, S } from "../styles/theme";
import { supplierData, inventoryRisks, fallbackMap } from "../data/mockData";
import { fetchFallbackOptions } from "../services/api";

// ── Supplier Detail Modal ─────────────────────────────────────────────────────
function SupplierModal({ supplier, onClose, isLogistics }) {
  if (!supplier) return null;
  const s = supplier;
  const scoreColor = s.score > 80 ? C.green : s.score > 60 ? C.orange : C.red;
  return (
    <div style={{
      position: "fixed", inset: 0, zIndex: 1000,
      background: "rgba(0,0,0,0.65)", display: "flex", alignItems: "center", justifyContent: "center",
      padding: 20,
    }} onClick={onClose}>
      <div style={{
        background: C.surface, border: `1px solid ${C.border}`,
        borderRadius: 14, width: "100%", maxWidth: 560,
        boxShadow: "0 20px 60px rgba(0,0,0,0.5)",
        overflow: "hidden",
      }} onClick={e => e.stopPropagation()}>

        {/* Header */}
        <div style={{
          padding: "18px 22px", background: C.bg,
          borderBottom: `1px solid ${C.border}`,
          display: "flex", justifyContent: "space-between", alignItems: "flex-start",
        }}>
          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            <div style={{
              width: 46, height: 46, borderRadius: 10,
              background: scoreColor + "22", border: `2px solid ${scoreColor}`,
              display: "flex", alignItems: "center", justifyContent: "center",
              fontSize: 18, fontWeight: 700, color: scoreColor,
            }}>{s.countryCode}</div>
            <div>
              <div style={{ fontSize: 15, fontWeight: 700, color: C.text }}>{s.name}</div>
              <div style={{ fontSize: 11, color: C.muted }}>{s.country} · {s.id}</div>
              <span style={S.riskBadge(s.risk)}>{s.risk}</span>
            </div>
          </div>
          <button onClick={onClose} style={{ background: "none", border: "none", color: C.muted, cursor: "pointer", fontSize: 18 }}>✕</button>
        </div>

        {/* Stats row */}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(4,1fr)", borderBottom: `1px solid ${C.border}` }}>
          {[
            ["Score",     s.score,           scoreColor],
            ["On-Time",   `${s.onTime}%`,    s.onTime > 80 ? C.green : s.onTime > 60 ? C.orange : C.red],
            ["Lead Time", `${s.leadTime}d`,  C.text],
            ["Capacity",  `${s.capacity}%`,  s.capacity > 75 ? C.green : C.orange],
          ].map(([label, val, color], i) => (
            <div key={i} style={{ padding: "14px 0", textAlign: "center", borderRight: i < 3 ? `1px solid ${C.border}` : "none" }}>
              <div style={{ fontSize: 22, fontWeight: 700, color }}>{val}</div>
              <div style={{ fontSize: 10, color: C.muted, marginTop: 2 }}>{label}</div>
            </div>
          ))}
        </div>

        {/* Details */}
        <div style={{ padding: "16px 22px" }}>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 14 }}>
            {[
              ["Contact Person",   s.contact],
              ["Email",            s.email],
              ["Phone",            s.phone],
              ["Primary Material", s.material],
              ["Partner Since",    s.since],
              ["Emergency Cost",   `${s.emergency_cost}× standard`],
            ].map(([label, val], i) => (
              <div key={i} style={{ padding: "8px 10px", background: C.bg, borderRadius: 7, border: `1px solid ${C.border}` }}>
                <div style={{ fontSize: 9, color: C.muted, marginBottom: 3, textTransform: "uppercase", letterSpacing: "0.06em" }}>{label}</div>
                <div style={{ fontSize: 12, color: C.text, fontWeight: 500 }}>{val}</div>
              </div>
            ))}
          </div>

          {/* Address */}
          <div style={{ padding: "8px 10px", background: C.bg, borderRadius: 7, border: `1px solid ${C.border}`, marginBottom: 12 }}>
            <div style={{ fontSize: 9, color: C.muted, marginBottom: 3, textTransform: "uppercase", letterSpacing: "0.06em" }}>Address</div>
            <div style={{ fontSize: 12, color: C.text }}>{s.address}</div>
          </div>

          {/* Certifications */}
          <div style={{ marginBottom: 12 }}>
            <div style={{ fontSize: 10, color: C.muted, marginBottom: 6 }}>CERTIFICATIONS</div>
            <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
              {s.certifications.map((c, i) => (
                <span key={i} style={{ ...S.badge(C.green), fontSize: 10 }}>{c}</span>
              ))}
            </div>
          </div>

          {/* Notes */}
          <div style={{ padding: "8px 10px", background: s.risk === "CRITICAL" ? C.red + "11" : C.bg, borderRadius: 7, border: `1px solid ${s.risk === "CRITICAL" ? C.red + "33" : C.border}`, marginBottom: 14 }}>
            <div style={{ fontSize: 9, color: C.muted, marginBottom: 3, textTransform: "uppercase", letterSpacing: "0.06em" }}>Notes</div>
            <div style={{ fontSize: 12, color: s.risk === "CRITICAL" ? C.red : C.text }}>{s.notes}</div>
          </div>

          {/* Actions */}
          <div style={{ display: "flex", gap: 8 }}>
            <a href={`mailto:${s.email}`} style={{ ...S.btn(), textDecoration: "none", fontSize: 11, padding: "7px 14px" }}>
              ✉ Contact Supplier
            </a>
            {isLogistics && (
              <button style={{ ...S.btn("secondary"), fontSize: 11, padding: "7px 14px" }}>
                📋 View Performance History
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Fallback Modal ────────────────────────────────────────────────────────────
function FallbackModal({ material, currentSupplierId, onClose, onAssign }) {
  const [selected,        setSelected]        = useState(null);
  const [assignType,      setAssignType]      = useState("temp");
  const [confirming,      setConfirming]      = useState(false);
  const [ranked,          setRanked]          = useState([]);
  const [loadingSuppliers,setLoadingSuppliers]= useState(true);

  // Fetch real fallback options from backend on mount
  useEffect(() => {
    fetchFallbackOptions(material)
      .then(results => {
        const sorted = results.sort((a, b) =>
          (b.score || b.reliabilityScore || 0) - (a.score || a.reliabilityScore || 0)
        );
        setRanked(sorted.length > 0 ? sorted : getFallbackLocal());
      })
      .catch(() => setRanked(getFallbackLocal()))
      .finally(() => setLoadingSuppliers(false));
  }, [material]);

  const getFallbackLocal = () => {
    const ids = fallbackMap[material] || [];
    return supplierData.filter(s => ids.includes(s.id)).sort((a, b) => b.score - a.score);
  };

  const handleConfirm = async () => {
    if (!selected) return;
    setConfirming(true);
    await new Promise(r => setTimeout(r, 800));
    onAssign(material, selected, assignType);
    setConfirming(false);
    onClose();
  };

  return (
    <div style={{ position: "fixed", inset: 0, zIndex: 1000, background: "rgba(0,0,0,0.65)", display: "flex", alignItems: "center", justifyContent: "center", padding: 20 }} onClick={onClose}>
      <div style={{ background: C.surface, border: `1px solid ${C.border}`, borderRadius: 14, width: "100%", maxWidth: 520, boxShadow: "0 20px 60px rgba(0,0,0,0.5)", overflow: "hidden" }} onClick={e => e.stopPropagation()}>

        {/* Header */}
        <div style={{ padding: "16px 20px", background: C.bg, borderBottom: `1px solid ${C.border}`, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <div>
            <div style={{ fontSize: 14, fontWeight: 700, color: C.text }}>🔄 Fallback Supplier Options</div>
            <div style={{ fontSize: 11, color: C.muted, marginTop: 2 }}>Material: <span style={{ color: C.accent, fontWeight: 600 }}>{material}</span></div>
          </div>
          <button onClick={onClose} style={{ background: "none", border: "none", color: C.muted, cursor: "pointer", fontSize: 18 }}>✕</button>
        </div>

        <div style={{ padding: "16px 20px" }}>
          {/* Ranked suppliers */}
          <div style={{ fontSize: 12, color: C.muted, marginBottom: 12, fontWeight: 600 }}>AVAILABLE SUPPLIERS — RANKED BY RELIABILITY SCORE</div>
          {loadingSuppliers ? (
            <div style={{ textAlign: "center", padding: "20px", color: C.accent, fontSize: 13 }}>
              <span className="spin">⚙</span> Querying Knowledge Graph...
            </div>
          ) : ranked.length === 0 ? (
            <div style={{ textAlign: "center", padding: "20px", color: C.muted, fontSize: 13 }}>
              No fallback suppliers found for this material
            </div>
          ) : ranked.map((s, i) => (
            <div key={s.id} onClick={() => setSelected(s)}
              style={{
                padding: "12px 14px", marginBottom: 8, borderRadius: 8,
                border: `2px solid ${selected?.id === s.id ? C.accent : C.border}`,
                background: selected?.id === s.id ? C.accent + "08" : C.bg,
                cursor: "pointer", transition: "all 0.15s",
                display: "flex", alignItems: "center", gap: 12,
              }}>
              {/* Rank badge */}
              <div style={{
                width: 28, height: 28, borderRadius: "50%", flexShrink: 0,
                background: i === 0 ? "#ffd700" : i === 1 ? "#c0c0c0" : C.border,
                display: "flex", alignItems: "center", justifyContent: "center",
                fontSize: 12, fontWeight: 700, color: i < 2 ? "#000" : C.muted,
              }}>#{i + 1}</div>

              {/* Info */}
              <div style={{ flex: 1 }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <span style={{ fontSize: 13, fontWeight: 700, color: C.text }}>{s.name}</span>
                  <span style={S.riskBadge(s.risk)}>{s.risk}</span>
                </div>
                <div style={{ display: "flex", gap: 14, marginTop: 4 }}>
                  {[["Score", s.score, s.score > 80 ? C.green : C.orange], ["On-Time", `${s.onTime}%`, C.text], ["Lead", `${s.leadTime}d`, C.text], ["Capacity", `${s.capacity}%`, C.text]].map(([l, v, c], j) => (
                    <div key={j} style={{ fontSize: 11 }}>
                      <span style={{ color: c, fontWeight: 700 }}>{v}</span>
                      <span style={{ color: C.muted, marginLeft: 3 }}>{l}</span>
                    </div>
                  ))}
                </div>
                <div style={{ fontSize: 10, color: C.muted, marginTop: 3 }}>
                  {s.country} · Emergency cost: {s.emergency_cost}× · {s.certifications.join(", ")}
                </div>
              </div>

              {selected?.id === s.id && (
                <span style={{ color: C.accent, fontSize: 18, flexShrink: 0 }}>✓</span>
              )}
            </div>
          ))}

          {/* Assignment type */}
          {selected && (
            <div style={{ marginTop: 14, padding: "12px 14px", background: C.bg, borderRadius: 8, border: `1px solid ${C.border}` }}>
              <div style={{ fontSize: 11, color: C.muted, marginBottom: 10, fontWeight: 600 }}>ASSIGNMENT TYPE</div>
              <div style={{ display: "flex", gap: 10 }}>
                {[
                  { val: "temp",      label: "Temporary",  desc: "Emergency supply only · Original supplier stays on record" },
                  { val: "permanent", label: "Permanent",  desc: "Replace primary supplier · Update knowledge graph" },
                ].map(opt => (
                  <div key={opt.val} onClick={() => setAssignType(opt.val)}
                    style={{
                      flex: 1, padding: "10px 12px", borderRadius: 7, cursor: "pointer",
                      border: `2px solid ${assignType === opt.val ? C.accent : C.border}`,
                      background: assignType === opt.val ? C.accent + "08" : "transparent",
                      transition: "all 0.15s",
                    }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 4 }}>
                      <div style={{ width: 14, height: 14, borderRadius: "50%", border: `2px solid ${assignType === opt.val ? C.accent : C.border}`, background: assignType === opt.val ? C.accent : "transparent", flexShrink: 0 }} />
                      <span style={{ fontSize: 12, fontWeight: 700, color: assignType === opt.val ? C.accent : C.text }}>{opt.label}</span>
                    </div>
                    <div style={{ fontSize: 10, color: C.muted, paddingLeft: 20 }}>{opt.desc}</div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Confirm */}
          <div style={{ display: "flex", gap: 8, marginTop: 16 }}>
            <button style={{ ...S.btn("ghost"), flex: 1, fontSize: 12 }} onClick={onClose}>Cancel</button>
            <button
              style={{ ...S.btn(), flex: 2, fontSize: 12, opacity: selected ? 1 : 0.5 }}
              disabled={!selected || confirming}
              onClick={handleConfirm}
            >
              {confirming ? <span className="spin">⚙</span> : `Assign ${assignType === "temp" ? "Temporary" : "Permanent"} Supplier`}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Main Suppliers Page ───────────────────────────────────────────────────────
export default function Suppliers({ user }) {
  const [detailSupplier,  setDetailSupplier]  = useState(null);
  const [fallbackMaterial,setFallbackMaterial]= useState(null);
  const [assignments,     setAssignments]     = useState({}); // material → { supplier, type }
  const [riskStatuses,    setRiskStatuses]    = useState({});

  const isLogistics = user?.role === "logistics" || user?.role === "admin";

  const handleAssign = (material, supplier, type) => {
    setAssignments(prev => ({ ...prev, [material]: { supplier, type } }));
    if (type === "permanent") {
      setRiskStatuses(prev => ({ ...prev, [material]: "LOW" }));
    } else {
      setRiskStatuses(prev => ({ ...prev, [material]: "MITIGATED" }));
    }
  };

  return (
    <div>
      {/* Modals */}
      {detailSupplier && (
        <SupplierModal supplier={detailSupplier} onClose={() => setDetailSupplier(null)} isLogistics={isLogistics} />
      )}
      {fallbackMaterial && (
        <FallbackModal
          material={fallbackMaterial}
          onClose={() => setFallbackMaterial(null)}
          onAssign={handleAssign}
        />
      )}

      <div style={S.pageHeader}>
        <div style={S.pageTitle}>Supplier Network</div>
        <div style={S.pageDesc}>
          {isLogistics ? "Click any supplier to view details · Manage fallback assignments for at-risk materials" : "Click any supplier to view full details and contact information"}
        </div>
      </div>

      {/* Logistics: At-Risk Materials Panel */}
      {isLogistics && (
        <div style={{ ...S.card, marginBottom: 20, borderLeft: `3px solid ${C.orange}` }}>
          <div style={S.cardHeader}>
            <span style={S.cardTitle}>⚠ At-Risk Materials · Fallback Management</span>
            <span style={{ ...S.badge(C.blue), fontSize: 10 }}>{user?.roleLabel}</span>
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {inventoryRisks.filter(r => r.risk !== "LOW").map((r, i) => {
              const assignment = assignments[r.material];
              const status = riskStatuses[r.material] || r.risk;
              const tlColor = status === "MITIGATED" || status === "LOW" ? C.green : r.trafficLight === "RED" ? C.red : C.accent;
              return (
                <div key={i} style={{
                  padding: "12px 14px", background: C.bg, borderRadius: 8,
                  border: `1px solid ${C.border}`, display: "flex", alignItems: "center", gap: 14,
                }}>
                  <div style={{ width: 10, height: 10, borderRadius: "50%", background: tlColor, boxShadow: `0 0 8px ${tlColor}`, flexShrink: 0 }} />
                  <div style={{ flex: 1 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 2 }}>
                      <span style={{ fontSize: 13, fontWeight: 700, color: C.text }}>{r.material}</span>
                      <span style={S.riskBadge(status)}>{status}</span>
                      {assignment && (
                        <span style={{ ...S.badge(assignment.type === "permanent" ? C.green : C.blue), fontSize: 9 }}>
                          {assignment.type === "permanent" ? "PERMANENT" : "TEMP"}: {assignment.supplier.name}
                        </span>
                      )}
                    </div>
                    <div style={{ fontSize: 11, color: C.muted }}>
                      {r.impact} · Stock: {r.stock}/{r.threshold} · Delay risk: +{r.delay}d
                    </div>
                  </div>
                  <div style={{ display: "flex", gap: 8 }}>
                    {/* Risk status updater */}
                    <select value={status} onChange={e => setRiskStatuses(prev => ({ ...prev, [r.material]: e.target.value }))}
                      style={{ ...S.select, fontSize: 11, padding: "5px 8px", borderRadius: 6, height: 30 }}>
                      {["CRITICAL","HIGH","MEDIUM","LOW","MITIGATED"].map(v => <option key={v} value={v}>{v}</option>)}
                    </select>
                    <button style={{ ...S.btn(), fontSize: 11, padding: "5px 14px" }}
                      onClick={() => setFallbackMaterial(r.material)}>
                      🔄 Fallback Options
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Summary */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: 12, marginBottom: 20 }}>
        {[
          { label:"Total Suppliers", value:"8", color:C.blue   },
          { label:"High Tier",       value:"4", color:C.green  },
          { label:"Medium Tier",     value:"2", color:C.orange },
          { label:"Low / Critical",  value:"2", color:C.red    },
        ].map((k,i) => (
          <div key={i} style={{ ...S.card, borderTop:`3px solid ${k.color}`, padding:14 }}>
            <div style={{ fontSize:10, color:C.muted, marginBottom:6, textTransform:"uppercase", letterSpacing:"0.07em" }}>{k.label}</div>
            <div style={{ fontSize:24, fontWeight:700, color:k.color }}>{k.value}</div>
          </div>
        ))}
      </div>

      {/* Supplier cards */}
      <div style={{ display:"grid", gridTemplateColumns:"repeat(4,1fr)", gap:12 }}>
        {supplierData.map((s,i) => (
          <div key={i} className="card-hover"
            onClick={() => setDetailSupplier(s)}
            style={{
              ...S.card, cursor:"pointer",
              borderTop:`3px solid ${s.score>80?C.green:s.score>60?C.orange:C.red}`,
              transition:"all 0.15s",
            }}>
            <div style={{ display:"flex", justifyContent:"space-between", alignItems:"flex-start", marginBottom:10 }}>
              <div>
                <div style={{ fontSize:12, fontWeight:700, color:C.text, lineHeight:1.3 }}>{s.name}</div>
                <div style={{ fontSize:9, color:C.muted }}>{s.country} · {s.id}</div>
              </div>
              <span style={S.riskBadge(s.risk)}>{s.risk}</span>
            </div>
            <div style={{ display:"flex", gap:12, marginBottom:10 }}>
              {[["Score",s.score,s.score>80?C.green:s.score>60?C.orange:C.red],["On-time",`${s.onTime}%`,C.text],["Lead",`${s.leadTime}d`,C.text]].map(([l,v,c],j)=>(
                <div key={j}>
                  <div style={{ fontSize:16, fontWeight:700, color:c }}>{v}</div>
                  <div style={{ fontSize:9, color:C.muted }}>{l}</div>
                </div>
              ))}
            </div>
            <div style={{ height:3, background:C.border, borderRadius:2, marginBottom:8 }}>
              <div style={{ height:"100%", width:`${s.capacity}%`, background:s.capacity>75?C.green:s.capacity>50?C.orange:C.red, borderRadius:2 }} />
            </div>
            <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center" }}>
              <span style={{ ...S.badge(s.tier==="HIGH"?C.green:s.tier==="MEDIUM"?C.orange:C.red), fontSize:9 }}>TIER: {s.tier}</span>
              <span style={{ fontSize:10, color:C.muted }}>Click to view →</span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
