import { useState, useEffect } from "react";
import { C, S } from "../styles/theme";
import { fetchComplianceAlerts } from "../services/api";

// ── SLA Detail Modal ──────────────────────────────────────────────────────────
function SLAModal({ sla, onClose }) {
  if (!sla) return null;
  return (
    <div style={{ position:"fixed", inset:0, zIndex:1000, background:"rgba(0,0,0,0.65)", display:"flex", alignItems:"center", justifyContent:"center", padding:20 }} onClick={onClose}>
      <div style={{ background:C.surface, border:`1px solid ${C.border}`, borderRadius:14, width:"100%", maxWidth:500, boxShadow:"0 20px 60px rgba(0,0,0,0.5)", overflow:"hidden" }} onClick={e=>e.stopPropagation()}>
        <div style={{ padding:"16px 20px", background:C.bg, borderBottom:`1px solid ${C.border}`, display:"flex", justifyContent:"space-between", alignItems:"center" }}>
          <div>
            <div style={{ fontSize:15, fontWeight:700, color:C.text }}>SLA Contract — {sla.id}</div>
            <div style={{ fontSize:12, color:C.muted }}>{sla.supplier} · {sla.material}</div>
          </div>
          <button onClick={onClose} style={{ background:"none", border:"none", color:C.muted, cursor:"pointer", fontSize:18 }}>✕</button>
        </div>
        <div style={{ padding:"16px 20px" }}>
          {[
            ["Supplier",         sla.supplier     || "—"],
            ["Material",         sla.material     || "—"],
            ["Delivery Deadline",sla.deadline     || "—"],
            ["Compliance Rate",  sla.compliance !== undefined ? `${sla.compliance}%` : "—"],
            ["Risk Level",       sla.risk         || "—"],
            ["Penalty Rate",     sla.penalty      || "—"],
            ["Lead Time",        sla.leadTimeDays !== undefined ? `${sla.leadTimeDays} days` : "—"],
            ["Delay Days",       sla.delayDays    > 0 ? `${sla.delayDays} days overdue` : "On track"],
            ["Status",           sla.violationStatus ? "BREACHED — Penalty Active" : "COMPLIANT"],
          ].map(([k, v], i) => (
            <div key={i} style={{ display:"flex", justifyContent:"space-between", padding:"8px 0", borderBottom:`1px solid ${C.border}22`, fontSize:13 }}>
              <span style={{ color:C.muted }}>{k}</span>
              <span style={{ fontWeight:600, color: k==="Status" && sla.violationStatus ? C.green : C.text }}>{v}</span>
            </div>
          ))}
          <div style={{ marginTop:16 }}>
            <a href={`mailto:contact@${(sla.supplier||"supplier").toLowerCase().replace(/ /g,"")}.com`}
              style={{ ...S.btn(), textDecoration:"none", fontSize:12, padding:"8px 16px" }}>
              ✉ Contact Supplier
            </a>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function SLAViolations({ user }) {
  const [slaList,  setSlaList]  = useState([]);
  const [loading,  setLoading]  = useState(true);
  const [error,    setError]    = useState("");
  const [selected, setSelected] = useState(null);
  const [penalty,  setPenalty]  = useState(null);
  const [calcLoading, setCalcLoading] = useState(false);
  const [slaModal, setSlaModal] = useState(null);

  useEffect(() => {
    fetchComplianceAlerts()
      .then(alerts => {
        // Map backend response → display format
        const mapped = (alerts || []).map((a, i) => ({
          id:              a.id              || `SLA-${String(i+1).padStart(3,"0")}`,
          supplier:        a.supplier        || a.supplierLabel || "—",
          material:        a.material        || a.materialLabel || "—",
          deadline:        a.deadline        || "—",
          compliance:      a.compliance      !== undefined ? a.compliance : null,
          risk:            a.risk            || (a.delayDays > 0 ? "HIGH" : "LOW"),
          penalty:         a.penalty         || (a.penaltyRate ? `$${a.penaltyRate}/day` : "—"),
          penaltyDaily:    a.penaltyRate     || 0,
          delayDays:       a.delayDays       || a.leadTimeDays || 0,
          violationStatus: a.violationStatus || a.delayDays > 0 || false,
          gracePeriod:     a.gracePeriod     || "48h",
          clause:          a.clause          || "—",
        }));
        setSlaList(mapped);
      })
      .catch(err => setError(err.message))
      .finally(() => setLoading(false));
  }, []);

  const handleCalcPenalty = async (sla) => {
    setSelected(sla.id); setCalcLoading(true); setPenalty(null);
    // Local calculation using the fields we have
    const graceDays    = 2;
    const billableDays = Math.max(0, (sla.delayDays || 0) - graceDays);
    await new Promise(r => setTimeout(r, 300));
    setPenalty({
      slaId:          sla.id,
      delayDays:      sla.delayDays || 0,
      gracePeriodDays: graceDays,
      billableDays,
      dailyRate:      sla.penaltyDaily || 0,
      totalPenalty:   billableDays * (sla.penaltyDaily || 0),
      clause:         sla.clause,
    });
    setCalcLoading(false);
  };

  const violations   = slaList.filter(s => s.violationStatus);
  const totalOwed    = violations.reduce((acc, s) => acc + ((s.penaltyDaily || 0) * Math.max(0, (s.delayDays||0) - 2)), 0);
  const validCompliances = slaList.filter(s => s.compliance !== null);
  const avgCompliance = validCompliances.length > 0
    ? Math.round(validCompliances.reduce((a, s) => a + (s.compliance || 0), 0) / validCompliances.length)
    : null;

  return (
    <div>
      {slaModal && <SLAModal sla={slaModal} onClose={() => setSlaModal(null)} />}

      <div style={S.pageHeader}>
        <div style={S.pageTitle}>SLA Violations · Compliance Monitor</div>
        <div style={S.pageDesc}>Track supplier SLA breaches and penalties owed to your company</div>
      </div>

      {/* KPIs — only show real numbers, dash if unknown */}
      <div style={{ display:"grid", gridTemplateColumns:"repeat(4,1fr)", gap:12, marginBottom:20 }}>
        {[
          { label:"Total Contracts",      value: loading ? "—" : slaList.length.toString(),    color:C.blue   },
          { label:"Active Breaches",      value: loading ? "—" : violations.length.toString(), color:C.red    },
          { label:"Avg Compliance",       value: loading ? "—" : avgCompliance !== null ? `${avgCompliance}%` : "—", color:C.green },
          { label:"Total Penalties Owed", value: loading ? "—" : totalOwed > 0 ? `$${totalOwed.toLocaleString()}` : "$0", color:C.accent },
        ].map((k,i) => (
          <div key={i} style={{ ...S.card, borderTop:`3px solid ${k.color}`, padding:16 }}>
            <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:10 }}>
              <div style={{ fontSize:11, color:C.muted, textTransform:"uppercase", letterSpacing:"0.07em" }}>{k.label}</div>
            </div>
            <div style={{ fontSize:26, fontWeight:700, color: loading ? C.muted : k.color }}>
              {loading ? <span className="spin" style={{ fontSize:16 }}>⚙</span> : k.value}
            </div>
            {k.label === "Total Penalties Owed" && !loading && totalOwed > 0 && (
              <div style={{ fontSize:11, color:C.muted, marginTop:4 }}>Owed to your company</div>
            )}
          </div>
        ))}
      </div>

      {/* Error */}
      {error && (
        <div style={{ padding:"12px 16px", background:C.red+"15", border:`1px solid ${C.red}33`, borderRadius:8, fontSize:13, color:C.red, marginBottom:16 }}>
          ⚠ Backend error: {error}
        </div>
      )}

      {/* Loading */}
      {loading && (
        <div style={{ ...S.card, textAlign:"center", padding:"48px", color:C.accent }}>
          <div style={{ fontSize:22, marginBottom:10 }} className="spin">⚙</div>
          <div style={{ fontSize:14 }}>Loading SLA data from Knowledge Graph...</div>
        </div>
      )}

      {/* Empty state */}
      {!loading && !error && slaList.length === 0 && (
        <div style={{ ...S.card, textAlign:"center", padding:"48px 24px" }}>
          <div style={{ fontSize:40, marginBottom:14 }}>📭</div>
          <div style={{ fontSize:16, fontWeight:700, color:C.text, marginBottom:8 }}>No SLA data returned</div>
          <div style={{ fontSize:14, color:C.muted }}>
            The backend returned no compliance alerts.<br />
            Check that GraphDB is running and the ontology is loaded.
          </div>
        </div>
      )}

      {/* Data */}
      {!loading && slaList.length > 0 && (
        <div style={S.grid2}>
          {/* Contract list */}
          <div style={S.card}>
            <div style={{ ...S.cardTitle, marginBottom:16 }}>📋 SLA Contract Status</div>
            {slaList.map((s, i) => (
              <div key={i} className="data-row"
                style={{ padding:"12px 0", borderBottom:`1px solid ${C.border}22`, background:selected===s.id?"rgba(245,158,11,0.04)":"transparent", transition:"background 0.15s" }}>
                <div style={{ display:"flex", justifyContent:"space-between", alignItems:"flex-start", marginBottom:6 }}>
                  <div>
                    <div style={{ fontSize:14, fontWeight:700, color:C.text }}>{s.supplier}</div>
                    <div style={{ fontSize:12, color:C.muted, marginTop:2 }}>
                      <span style={{ fontFamily:"monospace", color:C.blue }}>{s.id}</span> · {s.material}
                    </div>
                    {s.violationStatus && s.penaltyDaily > 0 && (
                      <div style={{ fontSize:12, color:C.green, marginTop:2, fontWeight:600 }}>
                        💰 ${((s.penaltyDaily) * Math.max(0,(s.delayDays||0)-2)).toLocaleString()} owed
                      </div>
                    )}
                  </div>
                  {s.violationStatus
                    ? <span style={S.riskBadge("CRITICAL")}>BREACHED</span>
                    : <span style={S.riskBadge("LOW")}>COMPLIANT</span>}
                </div>

                {s.compliance !== null && (
                  <div style={{ height:3, background:C.border, borderRadius:2, marginBottom:10 }}>
                    <div style={{ height:"100%", width:`${s.compliance}%`, background:s.compliance>80?C.green:s.compliance>60?C.orange:C.red, borderRadius:2 }} />
                  </div>
                )}

                <div style={{ display:"flex", gap:8, flexWrap:"wrap" }}>
                  <button style={{ ...S.btn("ghost"), fontSize:11, padding:"4px 10px" }} onClick={() => setSlaModal(s)}>
                    📄 View SLA
                  </button>
                  <a href={`mailto:contact@${(s.supplier||"").toLowerCase().replace(/ /g,"")}.com`}
                    style={{ ...S.btn("secondary"), fontSize:11, padding:"4px 10px", textDecoration:"none" }}>
                    ✉ Contact
                  </a>
                  {s.delayDays > 0 && (
                    <button style={{ ...S.btn("ghost"), fontSize:11, padding:"4px 10px" }} onClick={() => handleCalcPenalty(s)}>
                      💰 Calc Penalty
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>

          {/* Right: Penalty calculator + compliance chart */}
          <div>
            <div style={{ ...S.card, marginBottom:16 }}>
              <div style={{ ...S.cardTitle, marginBottom:14 }}>💰 Penalty Calculator</div>
              {!selected && !calcLoading && (
                <div style={{ textAlign:"center", padding:"28px 20px", color:C.muted, fontSize:13 }}>
                  Click "Calc Penalty" on a breached contract to see the breakdown
                </div>
              )}
              {calcLoading && (
                <div style={{ textAlign:"center", padding:"20px", color:C.accent }}>
                  <span className="spin">⚙</span> Calculating...
                </div>
              )}
              {penalty && !calcLoading && (
                <div>
                  <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:10, marginBottom:14 }}>
                    {[
                      ["SLA ID",        penalty.slaId,                    C.blue  ],
                      ["Total Delay",   `${penalty.delayDays} days`,      C.orange],
                      ["Grace Period",  `${penalty.gracePeriodDays} days`,C.muted ],
                      ["Billable Days", `${penalty.billableDays} days`,   C.text  ],
                    ].map(([k,v,c],i) => (
                      <div key={i} style={{ padding:"8px 10px", background:C.bg, borderRadius:5, border:`1px solid ${C.border}` }}>
                        <div style={{ fontSize:10, color:C.muted, marginBottom:3 }}>{k}</div>
                        <div style={{ fontSize:13, fontWeight:700, color:c }}>{v}</div>
                      </div>
                    ))}
                  </div>
                  <div style={{ padding:"14px 16px", background:C.green+"11", border:`1px solid ${C.green}33`, borderRadius:8 }}>
                    <div style={{ fontSize:11, color:C.muted, marginBottom:4 }}>PENALTY OWED TO YOUR COMPANY</div>
                    <div style={{ fontSize:30, fontWeight:800, color:C.green }}>${penalty.totalPenalty.toLocaleString()}</div>
                    <div style={{ fontSize:12, color:C.muted, marginTop:4 }}>
                      ${penalty.dailyRate.toLocaleString()}/day × {penalty.billableDays} billable days
                    </div>
                    {penalty.clause && penalty.clause !== "—" && (
                      <div style={{ fontSize:11, color:C.muted, marginTop:2 }}>{penalty.clause}</div>
                    )}
                  </div>
                </div>
              )}
            </div>

            {/* Compliance chart */}
            {slaList.some(s => s.compliance !== null) && (
              <div style={S.card}>
                <div style={{ ...S.cardTitle, marginBottom:14 }}>📊 Compliance Overview</div>
                {slaList.map((s,i) => (
                  <div key={i} style={{ marginBottom:12 }}>
                    <div style={{ display:"flex", justifyContent:"space-between", marginBottom:4 }}>
                      <div>
                        <span style={{ fontSize:13, color:C.text, fontWeight:500 }}>{s.supplier}</span>
                        <span style={{ fontSize:11, color:C.muted, marginLeft:6 }}>{s.id}</span>
                      </div>
                      <div style={{ display:"flex", alignItems:"center", gap:8 }}>
                        {s.violationStatus && s.penaltyDaily > 0 && (
                          <span style={{ fontSize:10, color:C.green, fontWeight:600 }}>
                            +${((s.penaltyDaily)*Math.max(0,(s.delayDays||0)-2)).toLocaleString()} owed
                          </span>
                        )}
                        <span style={{ fontSize:13, fontWeight:700, color:s.compliance>80?C.green:s.compliance>60?C.orange:C.red }}>
                          {s.compliance !== null ? `${s.compliance}%` : "—"}
                        </span>
                      </div>
                    </div>
                    {s.compliance !== null && (
                      <div style={{ height:6, background:C.border, borderRadius:3 }}>
                        <div style={{ height:"100%", width:`${s.compliance}%`, background:s.compliance>80?C.green:s.compliance>60?C.orange:C.red, borderRadius:3, transition:"width 0.5s" }} />
                      </div>
                    )}
                  </div>
                ))}
                {totalOwed > 0 && (
                  <div style={{ marginTop:14, padding:"10px 14px", background:C.accent+"11", border:`1px solid ${C.accent}33`, borderRadius:8 }}>
                    <div style={{ fontSize:11, color:C.muted, marginBottom:3 }}>TOTAL PENALTIES OWED</div>
                    <div style={{ fontSize:20, fontWeight:700, color:C.accent }}>${totalOwed.toLocaleString()}</div>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
