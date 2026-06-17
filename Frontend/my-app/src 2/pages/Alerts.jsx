import { useState } from "react";
import { C, S } from "../styles/theme";
import { getAlertsForRole } from "../data/mockData";

const TYPE_COLOR = {
  CRITICAL:   C.red,
  HIGH:       C.orange,
  INFO:       C.blue,
  LOW:        C.green,
  ESCALATION: C.purple,
};

const CATEGORIES = ["All","SLA Breach","Supplier Risk","Inventory","System","SLA","Escalation"];

export default function Alerts({ user }) {
  const [alerts,     setAlerts]     = useState(() => getAlertsForRole(user?.role || "admin"));
  const [filter,     setFilter]     = useState("All");
  const [typeFilter, setTypeFilter] = useState("All");
  const [expanded,   setExpanded]   = useState(null);

  const markRead    = (id) => setAlerts(p => p.map(a => a.id === id ? { ...a, unread: false } : a));
  const markAllRead = ()   => setAlerts(p => p.map(a => ({ ...a, unread: false })));
  const dismiss     = (id) => setAlerts(p => p.filter(a => a.id !== id));

  const filtered = alerts.filter(a => {
    const catMatch  = filter    === "All" || a.category === filter;
    const typeMatch = typeFilter === "All" || a.type     === typeFilter;
    return catMatch && typeMatch;
  });

  const unreadCount = alerts.filter(a => a.unread).length;
  const escalations = alerts.filter(a => a.type === "ESCALATION");

  return (
    <div>
      <div style={{ ...S.pageHeader, display:"flex", justifyContent:"space-between", alignItems:"flex-start" }}>
        <div>
          <div style={{ display:"flex", alignItems:"center", gap:12 }}>
            <div style={S.pageTitle}>Alerts · Notifications Center</div>
            {unreadCount > 0 && (
              <span style={{ padding:"3px 10px", borderRadius:20, background:C.red+"22", color:C.red, fontSize:12, fontWeight:700 }}>
                {unreadCount} unread
              </span>
            )}
          </div>
          <div style={S.pageDesc}>
            {user?.role === "procurement" ? "Your SLA alerts, breach notifications and escalations from Logistics" :
             user?.role === "logistics"   ? "Inventory risk alerts, supplier issues and escalations from Procurement" :
             user?.role === "production"  ? "Production-affecting alerts and escalations from Procurement" :
             "All system alerts, SLA breaches, and supply chain notifications"}
          </div>
        </div>
        {unreadCount > 0 && (
          <button style={S.btn("ghost")} className="btn-hover" onClick={markAllRead}>✓ Mark all read</button>
        )}
      </div>

      {/* Escalation banner if any */}
      {escalations.filter(e => e.unread).length > 0 && (
        <div style={{
          ...S.card, marginBottom:16,
          borderLeft:`4px solid ${C.purple}`,
          background: C.purple + "08",
          padding:"14px 18px",
        }}>
          <div style={{ display:"flex", alignItems:"center", gap:10 }}>
            <span style={{ fontSize:20 }}>📩</span>
            <div style={{ flex:1 }}>
              <div style={{ fontSize:13, fontWeight:700, color:C.purple }}>
                {escalations.filter(e=>e.unread).length} Escalation{escalations.filter(e=>e.unread).length>1?"s":""} Require Your Attention
              </div>
              {escalations.filter(e=>e.unread).map(e => (
                <div key={e.id} style={{ fontSize:11, color:C.muted, marginTop:3 }}>
                  From <span style={{ color:C.purple, fontWeight:700 }}>{e.from}</span> ({e.fromRole}): {e.title}
                </div>
              ))}
            </div>
            <span style={{ ...S.badge(C.purple) }}>ACTION REQUIRED</span>
          </div>
        </div>
      )}

      {/* Summary KPIs */}
      <div style={{ display:"grid", gridTemplateColumns:"repeat(4,1fr)", gap:12, marginBottom:20 }}>
        {[
          { label:"Total Alerts",     value:alerts.length,                                                                      color:C.blue   },
          { label:"Unread",           value:unreadCount,                                                                        color:C.red    },
          { label:"Critical / High",  value:alerts.filter(a=>a.type==="CRITICAL"||a.type==="HIGH").length,                      color:C.orange },
          { label:"Escalations",      value:escalations.length,                                                                  color:C.purple },
        ].map((k,i) => (
          <div key={i} style={{ ...S.card, borderTop:`3px solid ${k.color}`, padding:14 }}>
            <div style={{ fontSize:10, color:C.muted, marginBottom:6, textTransform:"uppercase", letterSpacing:"0.07em" }}>{k.label}</div>
            <div style={{ fontSize:26, fontWeight:700, color:k.color }}>{k.value}</div>
          </div>
        ))}
      </div>

      {/* Filters */}
      <div style={{ display:"flex", gap:8, marginBottom:16, flexWrap:"wrap" }}>
        <div style={{ display:"flex", gap:6, flexWrap:"wrap" }}>
          {CATEGORIES.map(cat => (
            <button key={cat} className="tab-btn" onClick={() => setFilter(cat)} style={{
              padding:"5px 12px", borderRadius:5,
              background:filter===cat ? C.accent : "transparent",
              border:`1px solid ${filter===cat ? C.accent : C.border}`,
              cursor:"pointer", fontSize:11, fontFamily:"inherit",
              color:filter===cat ? "#000" : C.muted,
              fontWeight:filter===cat ? 700 : 400,
            }}>{cat}</button>
          ))}
        </div>
        <div style={{ width:1, background:C.border }} />
        <div style={{ display:"flex", gap:6 }}>
          {["All","CRITICAL","HIGH","ESCALATION","INFO","LOW"].map(type => (
            <button key={type} className="tab-btn" onClick={() => setTypeFilter(type)} style={{
              padding:"5px 12px", borderRadius:5,
              background:typeFilter===type ? (TYPE_COLOR[type]||C.accent)+"22" : "transparent",
              border:`1px solid ${typeFilter===type ? (TYPE_COLOR[type]||C.accent) : C.border}`,
              cursor:"pointer", fontSize:11, fontFamily:"inherit",
              color:typeFilter===type ? (TYPE_COLOR[type]||C.accent) : C.muted,
              fontWeight:typeFilter===type ? 700 : 400,
            }}>{type}</button>
          ))}
        </div>
      </div>

      {/* Alerts list */}
      <div style={{ display:"flex", flexDirection:"column", gap:10 }}>
        {filtered.length === 0 && (
          <div style={{ ...S.card, textAlign:"center", padding:"40px 20px", color:C.muted, fontSize:13 }}>
            No alerts match the current filters
          </div>
        )}

        {filtered.map(a => {
          const typeColor  = TYPE_COLOR[a.type] || C.muted;
          const isExpanded = expanded === a.id;
          return (
            <div key={a.id} style={{
              ...S.card,
              borderLeft:`4px solid ${typeColor}`,
              padding:0, overflow:"hidden",
              opacity: a.unread ? 1 : 0.75,
              transition:"all 0.15s",
            }}>
              <div style={{ display:"flex", alignItems:"flex-start", gap:14, padding:"14px 18px", cursor:"pointer" }}
                onClick={() => { setExpanded(isExpanded ? null : a.id); markRead(a.id); }}>
                <div style={{
                  width:40, height:40, borderRadius:10, flexShrink:0,
                  background:typeColor+"18",
                  display:"flex", alignItems:"center", justifyContent:"center", fontSize:20,
                }}>{a.icon}</div>

                <div style={{ flex:1, minWidth:0 }}>
                  <div style={{ display:"flex", justifyContent:"space-between", alignItems:"flex-start", marginBottom:4 }}>
                    <div style={{ display:"flex", alignItems:"center", gap:8 }}>
                      <span style={{ fontSize:13, fontWeight:a.unread?700:600, color:C.text }}>{a.title}</span>
                      {a.unread && <div style={{ width:7, height:7, borderRadius:"50%", background:typeColor, boxShadow:`0 0 5px ${typeColor}` }} />}
                    </div>
                    <div style={{ display:"flex", alignItems:"center", gap:8, flexShrink:0 }}>
                      <span style={{ ...S.badge(typeColor), fontSize:10 }}>{a.type}</span>
                      <span style={{ fontSize:11, color:C.muted }}>{a.time}</span>
                    </div>
                  </div>

                  {/* From (escalations) */}
                  {a.from && (
                    <div style={{ fontSize:11, color:C.purple, marginBottom:4, display:"flex", alignItems:"center", gap:5 }}>
                      📩 From: <span style={{ fontWeight:700 }}>{a.from}</span> · {a.fromRole}
                    </div>
                  )}

                  <div style={{ fontSize:11, color:C.muted, marginBottom:4 }}>
                    <span style={{ ...S.badge(C.blue), fontSize:9, marginRight:6 }}>{a.category}</span>
                    {a.date}
                  </div>
                  <div style={{ fontSize:12, color:C.text, lineHeight:1.5 }}>
                    {isExpanded ? a.desc : a.desc.slice(0, 100) + (a.desc.length > 100 ? "..." : "")}
                  </div>
                </div>

                <span style={{ color:C.muted, fontSize:12, flexShrink:0, marginTop:2 }}>
                  {isExpanded ? "▲" : "▼"}
                </span>
              </div>

              {isExpanded && (
                <div style={{ padding:"0 18px 14px 72px", display:"flex", gap:8, alignItems:"center" }}>
                  {a.type === "ESCALATION" && (
                    <button style={{ ...S.btn(), fontSize:11, padding:"6px 14px" }}>
                      ✓ Acknowledge
                    </button>
                  )}
                  <button style={{ ...S.btn("secondary"), fontSize:11, padding:"6px 14px" }}>
                    View Details
                  </button>
                  <button onClick={e => { e.stopPropagation(); dismiss(a.id); }}
                    style={{ ...S.btn("ghost"), fontSize:11, padding:"6px 14px", marginLeft:"auto", color:C.red }}>
                    Dismiss
                  </button>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
