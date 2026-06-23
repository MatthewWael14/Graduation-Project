import { useState, useEffect } from "react";
import { C, S } from "../styles/theme";
import { fetchAlerts, markAlertRead, dismissAlert } from "../services/api";

const TYPE_COLOR = {
  CRITICAL: C.red,
  HIGH: C.orange,
  INFO: C.blue,
  LOW: C.green,
  ESCALATION: C.purple,
};

const CATEGORIES = ["All", "SLA Breach", "Supplier Risk", "Inventory", "System", "SLA", "Escalation"];

export default function Alerts({ user }) {
  const [alerts, setAlerts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [fetchError, setFetchError] = useState("");
  const [filter, setFilter] = useState("All");
  const [typeFilter, setTypeFilter] = useState("All");
  const [expanded, setExpanded] = useState(null);

  useEffect(() => {
    let cancelled = false;

    const load = (isFirstLoad) => {
      fetchAlerts()
        .then(data => {
          if (cancelled) return;
          setAlerts(data);
          setFetchError("");
        })
        .catch(err => {
          if (cancelled) return;
          // Don't blank the list on a transient poll failure — only
          // surface the error banner, keep showing the last good data.
          setFetchError(err.message);
        })
        .finally(() => {
          if (!cancelled && isFirstLoad) setLoading(false);
        });
    };

    load(true);

    // Poll for new real-time alerts (production disruptions, SLA
    // violations, etc.) every 5s so managers see them without a
    // manual page refresh.
    const intervalId = setInterval(() => load(false), 5000);

    return () => {
      cancelled = true;
      clearInterval(intervalId);
    };
  }, []);

  const markRead = async (id) => {
    setAlerts(p => p.map(a => a.id === id ? { ...a, unread: false } : a));
    try { await markAlertRead(id); } catch (e) { console.error("Failed to mark read:", e); }
  };

  const markAllRead = async () => {
    const unreadIds = alerts.filter(a => a.unread).map(a => a.id);
    setAlerts(p => p.map(a => ({ ...a, unread: false })));
    for (const id of unreadIds) {
      try { await markAlertRead(id); } catch (e) { console.error("Failed to mark read:", e); }
    }
  };

  const dismiss = async (id) => {
    setAlerts(p => p.filter(a => a.id !== id));
    try { await dismissAlert(id); } catch (e) { console.error("Failed to dismiss:", e); }
  };

  const filtered = alerts.filter(a => {
    const roleMatch = !user || user.role === "admin" || !a.roles || a.roles.includes(user.role);
    const catMatch = filter === "All" || a.category === filter;
    const typeMatch = typeFilter === "All" || a.type === typeFilter;
    return roleMatch && catMatch && typeMatch;
  });

  const unreadCount = alerts.filter(a => a.unread).length;
  const escalations = alerts.filter(a => a.type === "ESCALATION");

  return (
    <div>
      <div style={{ ...S.pageHeader, display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
        <div>
          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            <div style={S.pageTitle}>Alerts · Notifications Center</div>
            {unreadCount > 0 && (
              <span style={{ padding: "3px 10px", borderRadius: 20, background: C.red + "22", color: C.red, fontSize: 13, fontWeight: 700 }}>
                {unreadCount} unread
              </span>
            )}
          </div>
          <div style={S.pageDesc}>System alerts, SLA breaches and supply chain notifications</div>
        </div>
        {unreadCount > 0 && (
          <button style={S.btn("ghost")} className="btn-hover" onClick={markAllRead}>✓ Mark all read</button>
        )}
      </div>

      {/* Escalation banner */}
      {escalations.filter(e => e.unread).length > 0 && (
        <div style={{ ...S.card, marginBottom: 16, borderLeft: `4px solid ${C.purple}`, background: C.purple + "08", padding: "14px 18px" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <span style={{ fontSize: 20 }}>📩</span>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 14, fontWeight: 700, color: C.purple }}>
                {escalations.filter(e => e.unread).length} Escalation{escalations.filter(e => e.unread).length > 1 ? "s" : ""} Require Your Attention
              </div>
              {escalations.filter(e => e.unread).map(e => (
                <div key={e.id} style={{ fontSize: 12, color: C.muted, marginTop: 3 }}>
                  From <span style={{ color: C.purple, fontWeight: 700 }}>{e.from}</span> ({e.fromRole}): {e.title}
                </div>
              ))}
            </div>
            <span style={S.badge(C.purple)}>ACTION REQUIRED</span>
          </div>
        </div>
      )}

      {/* Loading state */}
      {loading && (
        <div style={{ ...S.card, textAlign: "center", padding: "40px", color: C.accent, marginBottom: 16 }}>
          <div style={{ fontSize: 24, marginBottom: 10 }} className="spin">⚙</div>
          Loading live alerts from Knowledge Graph...
        </div>
      )}

      {/* Backend error */}
      {fetchError && (
        <div style={{ padding: "12px 16px", background: C.red + "15", border: `1px solid ${C.red}33`, borderRadius: 8, fontSize: 13, color: C.red, marginBottom: 16 }}>
          ⚠ Backend error: {fetchError} — Check that the server is running at <strong>http://localhost:8001</strong>
        </div>
      )}

      {/* Summary KPIs */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: 12, marginBottom: 20 }}>
        {[
          { label: "Total Alerts", value: alerts.length, color: C.blue },
          { label: "Unread", value: unreadCount, color: C.red },
          { label: "Critical / High", value: alerts.filter(a => a.type === "CRITICAL" || a.type === "HIGH").length, color: C.orange },
          { label: "Escalations", value: escalations.length, color: C.purple },
        ].map((k, i) => (
          <div key={i} style={{ ...S.card, borderTop: `3px solid ${k.color}`, padding: 16 }}>
            <div style={{ fontSize: 11, color: C.muted, marginBottom: 6, textTransform: "uppercase", letterSpacing: "0.07em" }}>{k.label}</div>
            <div style={{ fontSize: 26, fontWeight: 700, color: k.color }}>{k.value}</div>
          </div>
        ))}
      </div>

      {/* Filters */}
      <div style={{ display: "flex", gap: 8, marginBottom: 16, flexWrap: "wrap" }}>
        <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
          {CATEGORIES.map(cat => (
            <button key={cat} className="tab-btn" onClick={() => setFilter(cat)} style={{
              padding: "5px 12px", borderRadius: 6,
              background: filter === cat ? C.accent : "transparent",
              border: `1px solid ${filter === cat ? C.accent : C.border}`,
              cursor: "pointer", fontSize: 12, fontFamily: "inherit",
              color: filter === cat ? "#000" : C.muted,
              fontWeight: filter === cat ? 700 : 400,
            }}>{cat}</button>
          ))}
        </div>
        <div style={{ width: 1, background: C.border }} />
        <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
          {["All", "CRITICAL", "HIGH", "ESCALATION", "INFO", "LOW"].map(type => (
            <button key={type} className="tab-btn" onClick={() => setTypeFilter(type)} style={{
              padding: "5px 12px", borderRadius: 6,
              background: typeFilter === type ? (TYPE_COLOR[type] || C.accent) + "22" : "transparent",
              border: `1px solid ${typeFilter === type ? (TYPE_COLOR[type] || C.accent) : C.border}`,
              cursor: "pointer", fontSize: 12, fontFamily: "inherit",
              color: typeFilter === type ? (TYPE_COLOR[type] || C.accent) : C.muted,
              fontWeight: typeFilter === type ? 700 : 400,
            }}>{type}</button>
          ))}
        </div>
      </div>

      {/* Empty state — shown until backend alerts are connected */}
      {filtered.length === 0 && (
        <div style={{ ...S.card, textAlign: "center", padding: "56px 24px" }}>
          <div style={{ fontSize: 44, marginBottom: 14 }}>🔔</div>
          <div style={{ fontSize: 16, fontWeight: 700, color: C.text, marginBottom: 8 }}>No alerts yet</div>
          <div style={{ fontSize: 14, color: C.muted, maxWidth: 400, margin: "0 auto", lineHeight: 1.6 }}>
            Alerts will appear here when the backend generates them — SLA breaches, inventory risks, supplier delays and escalations.
          </div>
        </div>
      )}

      {/* Alert cards — rendered when real alerts come in */}
      <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
        {filtered.map(a => {
          const typeColor = TYPE_COLOR[a.type] || C.muted;
          const isExpanded = expanded === a.id;
          return (
            <div key={a.id} style={{ ...S.card, borderLeft: `4px solid ${typeColor}`, padding: 0, overflow: "hidden", opacity: a.unread ? 1 : 0.75, transition: "all 0.15s" }}>
              <div style={{ display: "flex", alignItems: "flex-start", gap: 14, padding: "14px 18px", cursor: "pointer" }}
                onClick={() => { setExpanded(isExpanded ? null : a.id); markRead(a.id); }}>
                <div style={{ width: 42, height: 42, borderRadius: 10, flexShrink: 0, background: typeColor + "18", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 20 }}>
                  {a.icon}
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 4 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                      <span style={{ fontSize: 14, fontWeight: a.unread ? 700 : 600, color: C.text }}>{a.title}</span>
                      {a.unread && <div style={{ width: 7, height: 7, borderRadius: "50%", background: typeColor, boxShadow: `0 0 5px ${typeColor}` }} />}
                    </div>
                    <div style={{ display: "flex", alignItems: "center", gap: 8, flexShrink: 0 }}>
                      <span style={{ ...S.badge(typeColor), fontSize: 11 }}>{a.type}</span>
                      <span style={{ fontSize: 12, color: C.muted }}>{a.time}</span>
                    </div>
                  </div>
                  {a.from && (
                    <div style={{ fontSize: 12, color: C.purple, marginBottom: 4 }}>
                      📩 From: <span style={{ fontWeight: 700 }}>{a.from}</span> · {a.fromRole}
                    </div>
                  )}
                  <div style={{ fontSize: 12, color: C.muted, marginBottom: 4 }}>
                    <span style={{ ...S.badge(C.blue), fontSize: 10, marginRight: 6 }}>{a.category}</span>
                    {a.date}
                  </div>
                  <div style={{ fontSize: 13, color: C.text, lineHeight: 1.5 }}>
                    {isExpanded ? a.desc : (a.desc || "").slice(0, 100) + (a.desc?.length > 100 ? "..." : "")}
                  </div>
                </div>
                <span style={{ color: C.muted, fontSize: 12, flexShrink: 0 }}>{isExpanded ? "▲" : "▼"}</span>
              </div>

              {isExpanded && (
                <div style={{ padding: "0 18px 14px 74px", display: "flex", gap: 8 }}>
                  {a.type === "ESCALATION" && (
                    <button style={{ ...S.btn(), fontSize: 12, padding: "6px 14px" }}>✓ Acknowledge</button>
                  )}
                  <button style={{ ...S.btn("secondary"), fontSize: 12, padding: "6px 14px" }}>View Details</button>
                  <button onClick={e => { e.stopPropagation(); dismiss(a.id); }}
                    style={{ ...S.btn("ghost"), fontSize: 12, padding: "6px 14px", marginLeft: "auto", color: C.red }}>
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
