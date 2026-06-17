import { useState, useEffect } from "react";
import { C, S } from "../styles/theme";
import { supplierData, inventoryRisks, fallbackMap } from "../data/mockData";
import { fetchFallbackOptions } from "../services/api";

// ── Supplier Detail Modal ─────────────────────────────────────────────────────
function SupplierModal({ supplier, onClose }) {
  if (!supplier) return null;
  const s = supplier;
  const scoreColor = (s.score||0) > 80 ? C.green : (s.score||0) > 60 ? C.orange : C.red;
  return (
    <div style={{ position:"fixed", inset:0, zIndex:1000, background:"rgba(0,0,0,0.65)", display:"flex", alignItems:"center", justifyContent:"center", padding:20 }} onClick={onClose}>
      <div style={{ background:C.surface, border:`1px solid ${C.border}`, borderRadius:14, width:"100%", maxWidth:560, boxShadow:"0 20px 60px rgba(0,0,0,0.5)", overflow:"hidden" }} onClick={e=>e.stopPropagation()}>
        <div style={{ padding:"18px 22px", background:C.bg, borderBottom:`1px solid ${C.border}`, display:"flex", justifyContent:"space-between", alignItems:"flex-start" }}>
          <div style={{ display:"flex", alignItems:"center", gap:12 }}>
            <div style={{ width:46, height:46, borderRadius:10, background:scoreColor+"22", border:`2px solid ${scoreColor}`, display:"flex", alignItems:"center", justifyContent:"center", fontSize:16, fontWeight:700, color:scoreColor }}>
              {s.countryCode || "??"}
            </div>
            <div>
              <div style={{ fontSize:16, fontWeight:700, color:C.text }}>{s.name || s.supplierName || "Unknown"}</div>
              <div style={{ fontSize:12, color:C.muted }}>{s.country || ""} · {s.id || ""}</div>
              <span style={S.riskBadge(s.risk || "MEDIUM")}>{s.risk || "MEDIUM"}</span>
            </div>
          </div>
          <button onClick={onClose} style={{ background:"none", border:"none", color:C.muted, cursor:"pointer", fontSize:18 }}>✕</button>
        </div>

        <div style={{ display:"grid", gridTemplateColumns:"repeat(4,1fr)", borderBottom:`1px solid ${C.border}` }}>
          {[["Score",s.score||s.reliabilityScore||"—",scoreColor],["On-Time",s.onTime?`${s.onTime}%`:"—",C.text],["Lead",s.leadTime?`${s.leadTime}d`:"—",C.text],["Capacity",s.capacity?`${s.capacity}%`:"—",C.text]].map(([l,v,c],i)=>(
            <div key={i} style={{ padding:"14px 0", textAlign:"center", borderRight:i<3?`1px solid ${C.border}`:"none" }}>
              <div style={{ fontSize:22, fontWeight:700, color:c }}>{v}</div>
              <div style={{ fontSize:11, color:C.muted, marginTop:2 }}>{l}</div>
            </div>
          ))}
        </div>

        <div style={{ padding:"16px 22px" }}>
          {s.contact && (
            <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:10, marginBottom:14 }}>
              {[["Contact",s.contact],["Email",s.email],["Phone",s.phone],["Material",s.material],["Since",s.since],["Emergency Cost",s.emergency_cost?`${s.emergency_cost}×`:"—"]].map(([k,v],i)=>(
                <div key={i} style={{ padding:"8px 10px", background:C.bg, borderRadius:7, border:`1px solid ${C.border}` }}>
                  <div style={{ fontSize:10, color:C.muted, marginBottom:3, textTransform:"uppercase", letterSpacing:"0.06em" }}>{k}</div>
                  <div style={{ fontSize:13, color:C.text, fontWeight:500 }}>{v||"—"}</div>
                </div>
              ))}
            </div>
          )}
          {s.notes && (
            <div style={{ padding:"10px 12px", background:s.risk==="CRITICAL"?C.red+"11":C.bg, borderRadius:7, border:`1px solid ${s.risk==="CRITICAL"?C.red+"33":C.border}`, marginBottom:14 }}>
              <div style={{ fontSize:10, color:C.muted, marginBottom:3, textTransform:"uppercase", letterSpacing:"0.06em" }}>Notes</div>
              <div style={{ fontSize:13, color:s.risk==="CRITICAL"?C.red:C.text }}>{s.notes}</div>
            </div>
          )}
          {s.certifications && (
            <div style={{ marginBottom:14 }}>
              <div style={{ fontSize:11, color:C.muted, marginBottom:6 }}>CERTIFICATIONS</div>
              <div style={{ display:"flex", gap:6, flexWrap:"wrap" }}>{s.certifications.map((c,i)=><span key={i} style={S.badge(C.green)}>{c}</span>)}</div>
            </div>
          )}
          <a href={`mailto:${s.email||""}`} style={{ ...S.btn(), textDecoration:"none", fontSize:12 }}>✉ Contact Supplier</a>
        </div>
      </div>
    </div>
  );
}

// ── Fallback Modal ────────────────────────────────────────────────────────────
function FallbackModal({ material, onClose, onAssign }) {
  const [selected,         setSelected]         = useState(null);
  const [assignType,       setAssignType]        = useState("temp");
  const [confirming,       setConfirming]        = useState(false);
  const [ranked,           setRanked]            = useState([]);
  const [loadingSuppliers, setLoadingSuppliers]  = useState(true);
  const [fetchError,       setFetchError]        = useState("");

  useEffect(() => {
    fetchFallbackOptions(material)
      .then(results => {
        setRanked(results.sort((a,b) => (parseFloat(b.reliabilityScore)||b.score||0) - (parseFloat(a.reliabilityScore)||a.score||0)));
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
    <div style={{ position:"fixed", inset:0, zIndex:1000, background:"rgba(0,0,0,0.65)", display:"flex", alignItems:"center", justifyContent:"center", padding:20 }} onClick={onClose}>
      <div style={{ background:C.surface, border:`1px solid ${C.border}`, borderRadius:14, width:"100%", maxWidth:540, boxShadow:"0 20px 60px rgba(0,0,0,0.5)", overflow:"hidden" }} onClick={e=>e.stopPropagation()}>
        <div style={{ padding:"16px 20px", background:C.bg, borderBottom:`1px solid ${C.border}`, display:"flex", justifyContent:"space-between", alignItems:"center" }}>
          <div>
            <div style={{ fontSize:15, fontWeight:700, color:C.text }}>🔄 Fallback Supplier Options</div>
            <div style={{ fontSize:12, color:C.muted }}>Material: <span style={{ color:C.accent, fontWeight:600 }}>{material}</span></div>
          </div>
          <button onClick={onClose} style={{ background:"none", border:"none", color:C.muted, cursor:"pointer", fontSize:18 }}>✕</button>
        </div>

        <div style={{ padding:"16px 20px" }}>
          <div style={{ fontSize:12, color:C.muted, marginBottom:12, fontWeight:600 }}>AVAILABLE SUPPLIERS — RANKED BY RELIABILITY SCORE</div>

          {loadingSuppliers && (
            <div style={{ textAlign:"center", padding:"24px", color:C.accent }}><span className="spin">⚙</span> Querying Knowledge Graph...</div>
          )}

          {fetchError && (
            <div style={{ padding:"10px 14px", background:C.red+"15", border:`1px solid ${C.red}33`, borderRadius:8, fontSize:13, color:C.red, marginBottom:12 }}>
              ⚠ {fetchError}
            </div>
          )}

          {!loadingSuppliers && ranked.length === 0 && !fetchError && (
            <div style={{ textAlign:"center", padding:"24px", color:C.muted, fontSize:13 }}>
              No fallback suppliers returned from Knowledge Graph for this material
            </div>
          )}

          {ranked.map((s, i) => (
            <div key={i} onClick={() => setSelected(s)}
              style={{ padding:"12px 14px", marginBottom:8, borderRadius:8, border:`2px solid ${selected===s?C.accent:C.border}`, background:selected===s?C.accent+"08":C.bg, cursor:"pointer", display:"flex", alignItems:"center", gap:12 }}>
              <div style={{ width:28, height:28, borderRadius:"50%", background:i===0?"#ffd700":i===1?"#c0c0c0":C.border, display:"flex", alignItems:"center", justifyContent:"center", fontSize:12, fontWeight:700, color:i<2?"#000":C.muted, flexShrink:0 }}>#{i+1}</div>
              <div style={{ flex:1 }}>
                <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:4 }}>
                  <span style={{ fontSize:14, fontWeight:700, color:C.text }}>{s.supplierName || s.name || s.supplier || "Unknown"}</span>
                  <span style={{ fontSize:13, fontWeight:700, color:C.green }}>{s.reliabilityScore ? `Score: ${(parseFloat(s.reliabilityScore)*100).toFixed(0)}` : s.score ? `Score: ${s.score}` : "—"}</span>
                </div>
                <div style={{ fontSize:12, color:C.muted }}>
                  {s.country && `${s.country} · `}{s.leadTime && `Lead: ${s.leadTime}d · `}{s.certifications?.join(", ")}
                </div>
              </div>
              {selected===s && <span style={{ color:C.accent, fontSize:18 }}>✓</span>}
            </div>
          ))}

          {selected && (
            <div style={{ marginTop:14, padding:"12px 14px", background:C.bg, borderRadius:8, border:`1px solid ${C.border}` }}>
              <div style={{ fontSize:12, color:C.muted, marginBottom:10, fontWeight:600 }}>ASSIGNMENT TYPE</div>
              <div style={{ display:"flex", gap:10 }}>
                {[{val:"temp",label:"Temporary",desc:"Emergency supply only"},{val:"permanent",label:"Permanent",desc:"Replace primary supplier"}].map(opt=>(
                  <div key={opt.val} onClick={()=>setAssignType(opt.val)}
                    style={{ flex:1, padding:"10px 12px", borderRadius:7, cursor:"pointer", border:`2px solid ${assignType===opt.val?C.accent:C.border}`, background:assignType===opt.val?C.accent+"08":"transparent" }}>
                    <div style={{ display:"flex", alignItems:"center", gap:6, marginBottom:4 }}>
                      <div style={{ width:14, height:14, borderRadius:"50%", border:`2px solid ${assignType===opt.val?C.accent:C.border}`, background:assignType===opt.val?C.accent:"transparent" }} />
                      <span style={{ fontSize:13, fontWeight:700, color:assignType===opt.val?C.accent:C.text }}>{opt.label}</span>
                    </div>
                    <div style={{ fontSize:11, color:C.muted, paddingLeft:20 }}>{opt.desc}</div>
                  </div>
                ))}
              </div>
            </div>
          )}

          <div style={{ display:"flex", gap:8, marginTop:16 }}>
            <button style={{ ...S.btn("ghost"), flex:1 }} onClick={onClose}>Cancel</button>
            <button style={{ ...S.btn(), flex:2, opacity:selected?1:0.5 }} disabled={!selected||confirming} onClick={handleConfirm}>
              {confirming ? <span className="spin">⚙</span> : `Assign ${assignType==="temp"?"Temporary":"Permanent"} Supplier`}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Main Suppliers Page ───────────────────────────────────────────────────────
export default function Suppliers({ user }) {
  const [detailSupplier,   setDetailSupplier]   = useState(null);
  const [fallbackMaterial, setFallbackMaterial] = useState(null);
  const [assignments,      setAssignments]      = useState({});
  const [riskStatuses,     setRiskStatuses]     = useState({});

  const isLogistics = user?.role === "logistics" || user?.role === "admin";

  const handleAssign = (material, supplier, type) => {
    setAssignments(prev => ({ ...prev, [material]: { supplier, type } }));
    setRiskStatuses(prev => ({ ...prev, [material]: type === "permanent" ? "LOW" : "MITIGATED" }));
  };

  return (
    <div>
      {detailSupplier   && <SupplierModal supplier={detailSupplier} onClose={()=>setDetailSupplier(null)} />}
      {fallbackMaterial && <FallbackModal material={fallbackMaterial} onClose={()=>setFallbackMaterial(null)} onAssign={handleAssign} />}

      <div style={S.pageHeader}>
        <div style={S.pageTitle}>Supplier Network</div>
        <div style={S.pageDesc}>Click any card to view full details · {isLogistics ? "Manage fallback assignments for at-risk materials" : "Contact suppliers and view SLA information"}</div>
      </div>

      {/* Logistics: at-risk panel */}
      {isLogistics && (
        <div style={{ ...S.card, marginBottom:20, borderLeft:`3px solid ${C.orange}` }}>
          <div style={S.cardHeader}>
            <span style={S.cardTitle}>⚠ At-Risk Materials · Fallback Management</span>
            <span style={{ ...S.badge(C.blue), fontSize:11 }}>{user?.roleLabel}</span>
          </div>
          {inventoryRisks.filter(r=>r.risk!=="LOW").map((r,i)=>{
            const assignment = assignments[r.material];
            const status = riskStatuses[r.material] || r.risk;
            const tlColor = status==="MITIGATED"||status==="LOW" ? C.green : r.trafficLight==="RED" ? C.red : C.accent;
            return (
              <div key={i} style={{ padding:"12px 14px", background:C.bg, borderRadius:8, border:`1px solid ${C.border}`, display:"flex", alignItems:"center", gap:14, marginBottom:8 }}>
                <div style={{ width:10, height:10, borderRadius:"50%", background:tlColor, boxShadow:`0 0 8px ${tlColor}`, flexShrink:0 }} />
                <div style={{ flex:1 }}>
                  <div style={{ display:"flex", alignItems:"center", gap:8, marginBottom:2 }}>
                    <span style={{ fontSize:14, fontWeight:700, color:C.text }}>{r.material}</span>
                    <span style={S.riskBadge(status)}>{status}</span>
                    {assignment && <span style={{ ...S.badge(assignment.type==="permanent"?C.green:C.blue), fontSize:10 }}>{assignment.type==="permanent"?"PERMANENT":"TEMP"}: {assignment.supplier.supplierName||assignment.supplier.name||"Assigned"}</span>}
                  </div>
                  <div style={{ fontSize:12, color:C.muted }}>{r.impact} · Stock: {r.stock}/{r.threshold}</div>
                </div>
                <div style={{ display:"flex", gap:8 }}>
                  <select value={status} onChange={e=>setRiskStatuses(prev=>({...prev,[r.material]:e.target.value}))} style={{ ...S.select, fontSize:12, padding:"5px 8px", height:32 }}>
                    {["CRITICAL","HIGH","MEDIUM","LOW","MITIGATED"].map(v=><option key={v} value={v}>{v}</option>)}
                  </select>
                  <button style={{ ...S.btn(), fontSize:12, padding:"5px 14px" }} onClick={()=>setFallbackMaterial(r.material)}>🔄 Fallback</button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Supplier cards — using local data for display */}
      <div style={{ display:"grid", gridTemplateColumns:"repeat(4,1fr)", gap:14 }}>
        {supplierData.map((s,i)=>(
          <div key={i} className="card-hover" onClick={()=>setDetailSupplier(s)}
            style={{ ...S.card, cursor:"pointer", borderTop:`3px solid ${s.score>80?C.green:s.score>60?C.orange:C.red}`, transition:"all 0.15s" }}>
            <div style={{ display:"flex", justifyContent:"space-between", alignItems:"flex-start", marginBottom:10 }}>
              <div>
                <div style={{ fontSize:13, fontWeight:700, color:C.text }}>{s.name}</div>
                <div style={{ fontSize:11, color:C.muted }}>{s.country} · {s.id}</div>
              </div>
              <span style={S.riskBadge(s.risk)}>{s.risk}</span>
            </div>
            <div style={{ display:"flex", gap:12, marginBottom:10 }}>
              {[["Score",s.score,s.score>80?C.green:s.score>60?C.orange:C.red],["On-time",`${s.onTime}%`,C.text],["Lead",`${s.leadTime}d`,C.text]].map(([l,v,c],j)=>(
                <div key={j}><div style={{ fontSize:18, fontWeight:700, color:c }}>{v}</div><div style={{ fontSize:11, color:C.muted }}>{l}</div></div>
              ))}
            </div>
            <div style={{ height:3, background:C.border, borderRadius:2, marginBottom:8 }}>
              <div style={{ height:"100%", width:`${s.capacity}%`, background:s.capacity>75?C.green:s.capacity>50?C.orange:C.red, borderRadius:2 }} />
            </div>
            <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center" }}>
              <span style={{ ...S.badge(s.tier==="HIGH"?C.green:s.tier==="MEDIUM"?C.orange:C.red), fontSize:10 }}>TIER: {s.tier}</span>
              <span style={{ fontSize:11, color:C.muted }}>Click to view →</span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
