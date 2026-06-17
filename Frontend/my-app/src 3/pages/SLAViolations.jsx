import { useState } from "react";
import { C, S } from "../styles/theme";
import { slaData } from "../data/mockData";
import { calculatePenalty } from "../services/api";

// SLA Detail Modal
function SLAModal({ sla, onClose }) {
  if (!sla) return null;
  return (
    <div style={{ position:"fixed", inset:0, zIndex:1000, background:"rgba(0,0,0,0.65)", display:"flex", alignItems:"center", justifyContent:"center", padding:20 }} onClick={onClose}>
      <div style={{ background:C.surface, border:`1px solid ${C.border}`, borderRadius:14, width:"100%", maxWidth:500, boxShadow:"0 20px 60px rgba(0,0,0,0.5)", overflow:"hidden" }} onClick={e=>e.stopPropagation()}>
        <div style={{ padding:"16px 20px", background:C.bg, borderBottom:`1px solid ${C.border}`, display:"flex", justifyContent:"space-between", alignItems:"center" }}>
          <div>
            <div style={{ fontSize:14, fontWeight:700, color:C.text }}>SLA Contract — {sla.id}</div>
            <div style={{ fontSize:11, color:C.muted }}>{sla.supplier} · {sla.material}</div>
          </div>
          <button onClick={onClose} style={{ background:"none", border:"none", color:C.muted, cursor:"pointer", fontSize:18 }}>✕</button>
        </div>
        <div style={{ padding:"16px 20px" }}>
          {[
            ["Contract ID",      sla.id],
            ["Supplier",         sla.supplier],
            ["Material",         sla.material],
            ["Delivery Deadline",sla.deadline],
            ["Compliance Rate",  `${sla.compliance}%`],
            ["Risk Level",       sla.risk],
            ["Daily Penalty",    sla.penalty],
            ["Grace Period",     sla.gracePeriod],
            ["Penalty Clause",   sla.clause],
            ["Delay Days",       sla.delayDays > 0 ? `${sla.delayDays} days overdue` : "On track"],
            ["Violation Status", sla.violationStatus ? "BREACHED" : "COMPLIANT"],
          ].map(([k,v],i) => (
            <div key={i} style={{ display:"flex", justifyContent:"space-between", padding:"8px 0", borderBottom:`1px solid ${C.border}22`, fontSize:12 }}>
              <span style={{ color:C.muted }}>{k}</span>
              <span style={{ color: k==="Violation Status" ? (sla.violationStatus ? C.red : C.green) : C.text, fontWeight:600 }}>{v}</span>
            </div>
          ))}
          <div style={{ marginTop:16, display:"flex", gap:8 }}>
            <a href={`mailto:contact@${sla.supplier.toLowerCase().replace(/ /g,"")}.com`}
              style={{ ...S.btn(), textDecoration:"none", fontSize:11, padding:"7px 14px" }}>
              ✉ Contact Supplier
            </a>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function SLAViolations({ user }) {
  const [selected,    setSelected]    = useState(null);
  const [penalty,     setPenalty]     = useState(null);
  const [loading,     setLoading]     = useState(false);
  const [slaModal,    setSlaModal]    = useState(null);

  const calcPenalty = async (sla) => {
    setSelected(sla.id); setLoading(true); setPenalty(null);
    const result = await calculatePenalty(sla.id, sla.delayDays);
    setPenalty(result); setLoading(false);
  };

  const totalOwed = slaData.filter(s=>s.violationStatus).reduce((acc,s) => acc + (s.penaltyDaily * Math.max(0, s.delayDays - 2)), 0);

  return (
    <div>
      {slaModal && <SLAModal sla={slaModal} onClose={() => setSlaModal(null)} />}

      <div style={S.pageHeader}>
        <div style={S.pageTitle}>SLA Violations · Penalty Calculator</div>
        <div style={S.pageDesc}>
          Track SLA breaches · Calculate penalties owed to your company
        </div>
      </div>

      {/* KPIs */}
      <div style={{ display:"grid", gridTemplateColumns:"repeat(4,1fr)", gap:12, marginBottom:20 }}>
        {[
          { label:"Total Contracts",  value:slaData.length.toString(),                                                      color:C.blue   },
          { label:"Active Breaches",  value:slaData.filter(s=>s.violationStatus).length.toString(),                         color:C.red    },
          { label:"Avg Compliance",   value:Math.round(slaData.reduce((a,s)=>a+s.compliance,0)/slaData.length)+"%",         color:C.green  },
          { label:"Total Exposure",   value:"$"+totalOwed.toLocaleString(),                                              color:C.orange },
        ].map((k,i) => (
          <div key={i} style={{ ...S.card, borderTop:`3px solid ${k.color}`, padding:14 }}>
            <div style={{ fontSize:10, color:C.muted, marginBottom:6, textTransform:"uppercase", letterSpacing:"0.07em" }}>{k.label}</div>
            <div style={{ fontSize:22, fontWeight:700, color:k.color }}>{k.value}</div>
          </div>
        ))}
      </div>

      <div style={S.grid2}>
        {/* Contract list */}
        <div style={S.card}>
          <div style={{ ...S.cardTitle, marginBottom:14 }}>📋 SLA Contract Status</div>
          {slaData.map((s,i) => (
            <div key={i} className="data-row"
              style={{ padding:"12px 0", borderBottom:`1px solid ${C.border}22`, background:selected===s.id?"rgba(245,158,11,0.04)":"transparent", transition:"background 0.15s" }}>
              <div style={{ display:"flex", justifyContent:"space-between", alignItems:"flex-start", marginBottom:6 }}>
                <div>
                  <div style={{ fontSize:12, fontWeight:700, color:C.text }}>{s.supplier}</div>
                  <div style={{ fontSize:10, color:C.muted }}>{s.id} · {s.material}</div>
                </div>
                {s.violationStatus
                  ? <span style={S.riskBadge("CRITICAL")}>BREACHED</span>
                  : <span style={S.riskBadge("LOW")}>COMPLIANT</span>}
              </div>

              {/* Compliance bar */}
              <div style={{ height:3, background:C.border, borderRadius:2, marginBottom:8 }}>
                <div style={{ height:"100%", width:`${s.compliance}%`, background:s.compliance>80?C.green:s.compliance>60?C.orange:C.red, borderRadius:2 }} />
              </div>

              <div style={{ display:"flex", gap:8, flexWrap:"wrap" }}>
                {/* View SLA - all roles */}
                <button style={{ ...S.btn("ghost"), fontSize:10, padding:"4px 10px" }}
                  onClick={() => setSlaModal(s)}>
                  📄 View SLA
                </button>

                {/* Contact Supplier - all roles */}
                <a href={`mailto:contact@${s.supplier.toLowerCase().replace(/ /g,"")}.com`}
                  style={{ ...S.btn("secondary"), fontSize:10, padding:"4px 10px", textDecoration:"none" }}>
                  ✉ Contact
                </a>

                {/* Calc penalty - click on row */}
                <button style={{ ...S.btn("ghost"), fontSize:10, padding:"4px 10px" }}
                  onClick={() => calcPenalty(s)}>
                  💰 Calc Penalty
                </button>


              </div>
            </div>
          ))}
        </div>

        {/* Penalty calculator + compliance chart */}
        <div>
          <div style={{ ...S.card, marginBottom:16 }}>
            <div style={{ ...S.cardTitle, marginBottom:12 }}>💰 Penalty Calculator</div>
            {!selected && (
              <div style={{ textAlign:"center", padding:"30px 20px", color:C.muted, fontSize:12 }}>
                Click "Calc Penalty" on any contract to calculate
              </div>
            )}
            {loading && <div style={{ textAlign:"center", padding:"20px", color:C.accent }}><span className="spin">⚙</span> Calculating...</div>}
            {penalty && !loading && (
              <div>
                <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:10, marginBottom:14 }}>
                  {[
                    ["SLA ID",       penalty.slaId,                    C.blue  ],
                    ["Total Delay",  `${penalty.delayDays} days`,      C.orange],
                    ["Grace Period", `${penalty.gracePeriodDays} days`,C.muted ],
                    ["Billable",     `${penalty.billableDays} days`,   C.red   ],
                  ].map(([k,v,c],i) => (
                    <div key={i} style={{ padding:"8px 10px", background:C.bg, borderRadius:5, border:`1px solid ${C.border}` }}>
                      <div style={{ fontSize:9, color:C.muted, marginBottom:3 }}>{k}</div>
                      <div style={{ fontSize:12, fontWeight:700, color:c }}>{v}</div>
                    </div>
                  ))}
                </div>
                <div style={{ padding:"12px 14px", background:C.red+"11", border:`1px solid ${C.red}33`, borderRadius:6, marginBottom:14 }}>
                  <div style={{ fontSize:10, color:C.muted, marginBottom:4 }}>TOTAL FINANCIAL PENALTY</div>
                  <div style={{ fontSize:28, fontWeight:700, color:C.red }}>${penalty.totalPenalty.toLocaleString()}</div>
                  <div style={{ fontSize:10, color:C.muted, marginTop:2 }}>${penalty.dailyRate.toLocaleString()}/day × {penalty.billableDays} billable days · {penalty.clause}</div>
                </div>
              </div>
            )}
          </div>

          {/* Compliance chart */}
          <div style={S.card}>
            <div style={{ ...S.cardTitle, marginBottom:12 }}>📊 Compliance Overview</div>
            {slaData.map((s,i) => (
              <div key={i} style={{ marginBottom:10 }}>
                <div style={{ display:"flex", justifyContent:"space-between", marginBottom:3 }}>
                  <span style={{ fontSize:10 }}>{s.id} — {s.supplier.split(" ")[0]}</span>
                  <span style={{ fontSize:11, fontWeight:700, color:s.compliance>80?C.green:s.compliance>60?C.orange:C.red }}>{s.compliance}%</span>
                </div>
                <div style={{ height:6, background:C.border, borderRadius:3 }}>
                  <div style={{ height:"100%", width:`${s.compliance}%`, background:s.compliance>80?C.green:s.compliance>60?C.orange:C.red, borderRadius:3 }} />
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
