import { useState, useEffect } from "react";
import { C, S } from "../styles/theme";
import KPISection         from "../components/dashboard/KPISection";
import RiskPanel          from "../components/dashboard/RiskPanel";
import SLAViolationsTable from "../components/dashboard/SLAViolationsTable";
import ReliabilityChart   from "../components/dashboard/ReliabilityChart";
import { kpiData } from "../data/mockData";
import { fetchRiskScores, fetchComplianceAlerts } from "../services/api";

const ROLE_CFG = {
  admin:       { showRisk: true,  showReliability: false, showSla: true  },
  logistics:   { showRisk: true,  showReliability: false, showSla: false },
  procurement: { showRisk: false, showReliability: false, showSla: true  },
  production:  { showRisk: true,  showReliability: false, showSla: false },
};

function EmptyState({ message }) {
  return (
    <div style={{ textAlign: "center", padding: "32px 20px", color: C.muted, fontSize: 14 }}>
      <div style={{ fontSize: 32, marginBottom: 10 }}>📭</div>
      {message}
    </div>
  );
}

function ErrorState({ message }) {
  return (
    <div style={{ padding: "12px 16px", background: C.red + "15", border: `1px solid ${C.red}33`, borderRadius: 8, fontSize: 13, color: C.red }}>
      ⚠ {message}
    </div>
  );
}

export default function Dashboard({ user }) {
  const cfg = ROLE_CFG[user?.role] || ROLE_CFG.admin;

  const [riskScores,   setRiskScores]   = useState([]);
  const [slaAlerts,    setSlaAlerts]    = useState([]);
  const [loading,      setLoading]      = useState(true);
  const [error,        setError]        = useState("");

  useEffect(() => {
    const load = async () => {
      try {
        const [scores, alerts] = await Promise.all([
          fetchRiskScores(),
          fetchComplianceAlerts(),
        ]);
        setRiskScores(scores);
        setSlaAlerts(alerts);
      } catch (err) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    };
    load();
  }, []);

  const visibleKpis = user?.role === "procurement"
    ? kpiData.filter(k => ["SLA Compliance","Alerts (48h)","Total Penalties","At-Risk Shipments"].includes(k.label))
    : user?.role === "production"
    ? kpiData.filter(k => ["At-Risk Shipments","Alerts (48h)","SLA Compliance","Avg Delay (days)"].includes(k.label))
    : user?.role === "logistics"
    ? kpiData.filter(k => ["Active Suppliers","At-Risk Shipments","Avg Delay (days)","Alerts (48h)"].includes(k.label))
    : kpiData;

  // Map risk scores to RiskPanel format
  const riskPanelData = riskScores.map(r => ({
    material:    r.material   || r.materialLabel   || "Unknown Material",
    supplier:    r.supplier   || r.supplierLabel   || "Unknown Supplier",
    impact:      r.product    || r.productLabel    || "",
    trafficLight: r.status === "RED" ? "RED" : "GREEN",
    risk:        r.status === "RED" ? "HIGH" : "LOW",
    stock:       r.stock      || 0,
    threshold:   r.threshold  || 0,
    delay:       r.delayDuration || 0,
    delayProb:   r.status === "RED" ? 80 : 10,
    processes:   r.product ? [r.product] : [],
  }));

  // Map compliance alerts to SLA table format
  const slaTableData = slaAlerts.map((a, i) => ({
    id:              `SLA-${String(i + 1).padStart(3, "0")}`,
    supplier:        a.supplier      || a.supplierLabel || "Unknown",
    material:        a.material      || a.materialLabel || "Unknown",
    deadline:        a.deadline      || "—",
    compliance:      a.compliance    || 0,
    risk:            a.risk          || "MEDIUM",
    penalty:         a.penalty       || a.penaltyRate ? `$${a.penaltyRate}/day` : "—",
    penaltyDaily:    a.penaltyRate   || 0,
    delayDays:       a.leadTimeDays  || 0,
    violationStatus: (a.leadTimeDays || 0) > 0,
    gracePeriod:     "48h",
    clause:          a.clause        || "—",
  }));

  return (
    <div>
      <div style={{ ...S.pageHeader, display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
        <div>
          <div style={S.pageTitle}>Welcome back, {user?.name?.split(" ")[0]} 👋</div>
          <div style={S.pageDesc}>
            {user?.roleLabel} · Supply Chain Intelligence Platform
            {loading && <span style={{ color: C.accent, marginLeft: 10 }}><span className="spin">⚙</span> Loading live data...</span>}
          </div>
        </div>
        <div style={{ padding: "6px 14px", borderRadius: 8, background: (user?.avatarColor || C.accent) + "18", border: `1px solid ${(user?.avatarColor || C.accent)}33`, fontSize: 12, color: user?.avatarColor || C.accent, fontWeight: 700 }}>
          {user?.roleLabel?.toUpperCase()}
        </div>
      </div>

      <KPISection data={visibleKpis} />

      {error && <div style={{ marginBottom: 16 }}><ErrorState message={`Failed to load data: ${error}`} /></div>}

      {cfg.showRisk && (
        <div style={{ ...S.card, marginBottom: 18 }}>
          <div style={S.cardHeader}>
            <span style={S.cardTitle}>⚠ Risk Overview</span>
            {!loading && <span style={{ fontSize: 12, color: C.muted }}>{riskPanelData.length} items</span>}
          </div>
          {loading ? (
            <div style={{ textAlign: "center", padding: "24px", color: C.accent }}><span className="spin">⚙</span> Loading...</div>
          ) : riskPanelData.length === 0 ? (
            <EmptyState message="No risk data returned from Knowledge Graph" />
          ) : (
            <RiskPanel risks={riskPanelData} />
          )}
        </div>
      )}

      {cfg.showSla && (
        <div>
          {loading ? (
            <div style={{ ...S.card, textAlign: "center", padding: "24px", color: C.accent }}><span className="spin">⚙</span> Loading SLA data...</div>
          ) : slaTableData.length === 0 ? (
            <div style={S.card}><EmptyState message="No SLA data returned from Knowledge Graph" /></div>
          ) : (
            <SLAViolationsTable data={slaTableData} />
          )}
        </div>
      )}
    </div>
  );
}
