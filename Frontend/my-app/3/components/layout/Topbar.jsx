import { useState, useRef, useEffect } from "react";
import { C, S } from "../../styles/theme";
import { PAGE_TITLES, getAlertsForRole } from "../../data/mockData";

function useOutsideClick(ref, handler) {
  useEffect(() => {
    const fn = (e) => { if (ref.current && !ref.current.contains(e.target)) handler(); };
    document.addEventListener("mousedown", fn);
    return () => document.removeEventListener("mousedown", fn);
  }, [ref, handler]);
}

export default function Topbar({ activePage, onNavigate, user, onLogout }) {
  const [notifOpen,     setNotifOpen]     = useState(false);
  const [profileOpen,   setProfileOpen]   = useState(false);
  const [notifications, setNotifications] = useState(() => getAlertsForRole(user?.role || 'admin'));
  const notifRef   = useRef(null);
  const profileRef = useRef(null);
  useOutsideClick(notifRef,   () => setNotifOpen(false));
  useOutsideClick(profileRef, () => setProfileOpen(false));
  const unread = notifications.filter(n => n.unread).length;

  return (
    <div style={{
      height: 54, minHeight: 54, background: C.surface,
      borderBottom: `1px solid ${C.border}`,
      display: "flex", alignItems: "center",
      padding: "0 20px", gap: 12, position: "relative", zIndex: 200,
    }}>
      {/* Page title */}
      <div>
        <div style={{ fontSize: 13, fontWeight: 600, color: C.text, letterSpacing: "0.04em" }}>
          {PAGE_TITLES[activePage]}
        </div>
      </div>

      {/* Status badges */}
      <div style={{ display: "flex", alignItems: "center", gap: 6, marginLeft: 16 }}>
        <span style={{ ...S.badge(C.green), fontSize: 10 }} className="live-pulse">● REASONER ACTIVE</span>
        <span style={{ ...S.badge(C.orange), fontSize: 10 }}>⚠ 12 RISKS</span>
      </div>

      {/* Right */}
      <div style={{ marginLeft: "auto", display: "flex", alignItems: "center", gap: 6 }}>

        {/* Bell */}
        <div ref={notifRef} style={{ position: "relative" }}>
          <button onClick={() => { setNotifOpen(o => !o); setProfileOpen(false); }}
            style={{
              position: "relative", background: notifOpen ? C.border : "transparent",
              border: `1px solid ${notifOpen ? C.borderHi : "transparent"}`,
              borderRadius: 7, width: 34, height: 34, cursor: "pointer",
              display: "flex", alignItems: "center", justifyContent: "center", fontSize: 15,
            }}>
            🔔
            {unread > 0 && (
              <div style={{
                position: "absolute", top: 3, right: 3,
                width: 15, height: 15, borderRadius: "50%",
                background: C.red, color: "#fff", fontSize: 8, fontWeight: 700,
                display: "flex", alignItems: "center", justifyContent: "center",
                border: `2px solid ${C.surface}`,
              }}>{unread}</div>
            )}
          </button>

          {notifOpen && (
            <div style={{
              position: "absolute", top: "calc(100% + 6px)", right: 0,
              width: 340, background: C.surface,
              border: `1px solid ${C.border}`, borderRadius: 10,
              boxShadow: "0 8px 32px rgba(0,0,0,0.5)", overflow: "hidden",
            }}>
              <div style={{ padding: "10px 14px", borderBottom: `1px solid ${C.border}`, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <span style={{ fontSize: 12, fontWeight: 700, color: C.text }}>
                  Notifications {unread > 0 && <span style={{ ...S.badge(C.red), marginLeft: 6, fontSize: 10 }}>{unread} new</span>}
                </span>
                {unread > 0 && (
                  <button onClick={() => setNotifications(p => p.map(n => ({ ...n, unread: false })))}
                    style={{ background: "none", border: "none", color: C.accent, fontSize: 10, cursor: "pointer", fontFamily: "inherit" }}>
                    Mark all read
                  </button>
                )}
              </div>
              <div style={{ maxHeight: 300, overflowY: "auto" }}>
                {notifications.slice(0, 5).map(n => (
                  <div key={n.id}
                    onClick={() => setNotifications(p => p.map(x => x.id === n.id ? { ...x, unread: false } : x))}
                    style={{ padding: "10px 14px", cursor: "pointer", background: n.unread ? "rgba(245,158,11,0.04)" : "transparent", borderBottom: `1px solid ${C.border}22`, display: "flex", gap: 10 }}>
                    <span style={{ fontSize: 13 }}>{n.icon}</span>
                    <div style={{ flex: 1 }}>
                      <div style={{ display: "flex", justifyContent: "space-between" }}>
                        <span style={{ fontSize: 11, fontWeight: n.unread ? 700 : 400, color: C.text }}>{n.title}</span>
                        {n.unread && <div style={{ width: 5, height: 5, borderRadius: "50%", background: C.accent, marginTop: 4 }} />}
                      </div>
                      <div style={{ fontSize: 10, color: C.muted, marginTop: 2, lineHeight: 1.4 }}>{n.desc.slice(0, 70)}...</div>
                      <div style={{ fontSize: 9, color: C.muted, marginTop: 3 }}>{n.time}</div>
                    </div>
                  </div>
                ))}
              </div>
              <div
                onClick={() => { setNotifOpen(false); onNavigate("alerts"); }}
                style={{ padding: "8px 14px", borderTop: `1px solid ${C.border}`, textAlign: "center", fontSize: 11, color: C.accent, cursor: "pointer", fontWeight: 600 }}>
                View all notifications →
              </div>
            </div>
          )}
        </div>

        <div style={{ width: 1, height: 22, background: C.border }} />

        {/* Profile */}
        <div ref={profileRef} style={{ position: "relative" }}>
          <button onClick={() => { setProfileOpen(o => !o); setNotifOpen(false); }}
            style={{
              display: "flex", alignItems: "center", gap: 7,
              background: profileOpen ? C.border : "transparent",
              border: `1px solid ${profileOpen ? C.borderHi : "transparent"}`,
              borderRadius: 7, padding: "3px 8px 3px 3px",
              cursor: "pointer", transition: "all 0.15s", height: 34,
            }}>
            <div style={{
              width: 26, height: 26, borderRadius: "50%",
              background: user?.avatarColor ? user.avatarColor + "33" : C.accent + "33",
              border: `2px solid ${user?.avatarColor || C.accent}`,
              display: "flex", alignItems: "center", justifyContent: "center",
              fontSize: 10, fontWeight: 700, color: user?.avatarColor || C.accent,
            }}>{user?.avatar || "U"}</div>
            <div style={{ textAlign: "left" }}>
              <div style={{ fontSize: 11, fontWeight: 600, color: C.text, lineHeight: 1.2 }}>{user?.name || "User"}</div>
              <div style={{ fontSize: 9, color: C.muted }}>{user?.roleLabel || "Role"}</div>
            </div>
            <span style={{ fontSize: 8, color: C.muted }}>▼</span>
          </button>

          {profileOpen && (
            <div style={{
              position: "absolute", top: "calc(100% + 6px)", right: 0,
              width: 220, background: C.surface,
              border: `1px solid ${C.border}`, borderRadius: 10,
              boxShadow: "0 8px 32px rgba(0,0,0,0.5)", overflow: "hidden",
            }}>
              {/* Profile card */}
              <div style={{ padding: "12px 14px", borderBottom: `1px solid ${C.border}`, display: "flex", gap: 9, alignItems: "center" }}>
                <div style={{
                  width: 38, height: 38, borderRadius: "50%",
                  background: user?.avatarColor ? user.avatarColor + "33" : C.accent + "33",
                  border: `2px solid ${user?.avatarColor || C.accent}`,
                  display: "flex", alignItems: "center", justifyContent: "center",
                  fontSize: 14, fontWeight: 700, color: user?.avatarColor || C.accent,
                }}>{user?.avatar}</div>
                <div>
                  <div style={{ fontSize: 12, fontWeight: 700, color: C.text }}>{user?.name}</div>
                  <div style={{ fontSize: 10, color: C.muted }}>{user?.email}</div>
                  <span style={{
                    display: "inline-block", marginTop: 4, padding: "1px 6px", borderRadius: 3,
                    background: (user?.avatarColor || C.accent) + "22",
                    color: user?.avatarColor || C.accent,
                    fontSize: 9, fontWeight: 700, letterSpacing: "0.06em",
                  }}>{user?.roleLabel?.toUpperCase()}</span>
                </div>
              </div>

              {/* Menu items */}
              {[["👤", "My Profile"], ["⚙", "Settings"]].map(([icon, label], i) => (
                <div key={i} className="nav-item" style={{
                  display: "flex", alignItems: "center", gap: 8,
                  padding: "9px 14px", cursor: "pointer",
                  fontSize: 12, color: C.muted, borderBottom: `1px solid ${C.border}22`,
                }}>
                  <span>{icon}</span>{label}
                </div>
              ))}

              {/* Sign out */}
              <div onClick={onLogout} style={{
                display: "flex", alignItems: "center", gap: 8,
                padding: "9px 14px", cursor: "pointer",
                fontSize: 12, color: C.red,
              }}>
                <span>↩</span> Sign Out
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
