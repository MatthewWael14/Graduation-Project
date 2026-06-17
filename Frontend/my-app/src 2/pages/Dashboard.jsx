import { useState, useEffect } from "react";
import { C, S } from "../styles/theme";
import KPISection         from "../components/dashboard/KPISection";
import RiskPanel          from "../components/dashboard/RiskPanel";
import SLAViolationsTable from "../components/dashboard/SLAViolationsTable";
import ReliabilityChart   from "../components/dashboard/ReliabilityChart";
import { kpiData, slaData, supplierData, inventoryRisks } from "../data/mockData";
import { fetchRiskScores, fetchComplianceAlerts } from "../services/api";

const ROLE_CFG = {
  admin:       { showRisk: true,  showReliability: true,  showSla: true  },
  logistics:   { showRisk: true,  showReliability: true,  showSla: false },
  procurement: { showRisk: false, showReliability: false, showSla: true  },
  production:  { showRisk: true,  showReliability: false, showSla: false },
};

export default function Dashboard({ user }) {
  const cfg = ROLE_CFG[user?.role] || ROLE_CFG.admin;

  const [riskScores,   setRiskScores]   = useState(null);
  const [alerts,       setAlerts]       = useState(null);
  const [loading,      setLoading]      = useState(true);

  useEffect(() => {
    const load = async () => {
      try {
        const [scores, compAlerts] = await Promise.all([
          fetchRiskScores(),
          fetchComplianceAlerts(),
        ]);
        setRiskScores(scores);
        setAlerts(compAlerts);
      } catch {
        // fall through to mock
      } finally {
        setLoading(false);
      }
    };
    load();
  }, []);

  // Merge real risk scores into inventoryRisks display format
  const mergedRisks = riskScores
    ? inventoryRisks.map(r => {
        const realScore = riskScores.find(rs =>
          rs.material?.toLowerCase().includes(r.material.toLowerCase().split(" ")[0])
        );
        return realScore
          ? { ...r, trafficLight: realScore.status }
          : r;
      })
    : inventoryRisks;

  // Filter KPIs by role
  const visibleKpis = user?.role === "procurement"
    ? kpiData.filter(k => ["SLA Compliance","Alerts (48h)","Total Penalties","At-Risk Shipments"].includes(k.label))
    : user?.role === "production"
    ? kpiData.filter(k => ["At-Risk Shipments","Alerts (48h)","SLA Compliance","Avg Delay (days)"].includes(k.label))
    : user?.role === "logistics"
    ? kpiData.filter(k => ["Active Suppliers","At-Risk Shipments","Avg Delay (days)","Alerts (48h)"].includes(k.label))
    : kpiData;

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
        <div style={{
          padding: "6px 14px", borderRadius: 8,
          background: (user?.avatarColor || C.accent) + "18",
          border: `1px solid ${(user?.avatarColor || C.accent)}33`,
          fontSize: 12, color: user?.avatarColor || C.accent, fontWeight: 700,
          letterSpacing: "0.04em",
        }}>
          {user?.roleLabel?.toUpperCase()}
        </div>
      </div>

      <KPISection data={visibleKpis} />

      {cfg.showRisk && cfg.showReliability && (
        <div style={S.grid2}>
          <RiskPanel risks={mergedRisks} />
          <ReliabilityChart suppliers={supplierData} />
        </div>
      )}

      {cfg.showRisk && !cfg.showReliability && (
        <RiskPanel risks={mergedRisks} />
      )}

      {cfg.showSla && (
        <SLAViolationsTable data={slaData} />
      )}
    </div>
  );
}
