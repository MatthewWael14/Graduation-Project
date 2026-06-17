import { useState } from "react";
import { C, S } from "../styles/theme";
import { ingestionLogs } from "../data/mockData";

const STATUS_COLOR = { SUCCESS: C.green, WARNING: C.orange, FAILED: C.red };

export default function DataLake() {
  const [uploading, setUploading] = useState(false);
  const [uploaded,  setUploaded]  = useState(false);

  const triggerUpload = () => {
    setUploading(true);
    setTimeout(() => { setUploading(false); setUploaded(true); }, 1500);
  };

  return (
    <div>
      <div style={S.pageHeader}>
        <div style={S.pageTitle}>Data Lake · Ingestion Pipeline</div>
        <div style={S.pageDesc}>Monitor and manage all data ingestion sources</div>
      </div>

      {/* Summary KPIs */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: 12, marginBottom: 20 }}>
        {[
          { label: "Total Records Today", value: "2,273", color: C.blue   },
          { label: "Sources Active",       value: "4 / 5", color: C.green  },
          { label: "Standardized",         value: "87%",   color: C.accent },
          { label: "Failed Ingestions",    value: "1",     color: C.red    },
        ].map((k, i) => (
          <div key={i} style={{ ...S.card, borderTop: `3px solid ${k.color}`, padding: 14 }}>
            <div style={{ fontSize: 10, color: C.muted, marginBottom: 6, textTransform: "uppercase", letterSpacing: "0.07em" }}>{k.label}</div>
            <div style={{ fontSize: 22, fontWeight: 700, color: k.color }}>{k.value}</div>
          </div>
        ))}
      </div>

      {/* Ingestion Logs */}
      <div style={S.card}>
        <div style={S.cardHeader}>
          <span style={S.cardTitle}>📋 Ingestion Log</span>
          <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
            {uploaded && <span style={S.badge(C.green)}>✓ Upload Successful</span>}
            <button style={S.btn()} className="btn-hover" onClick={triggerUpload} disabled={uploading}>
              {uploading ? <span className="spin">⚙</span> : "+ Upload Data"}
            </button>
          </div>
        </div>
        <table style={S.table}>
          <thead>
            <tr>{["Job ID","Source","Type","Records","Standardized","Status","Time"].map(h => <th key={h} style={S.th}>{h}</th>)}</tr>
          </thead>
          <tbody>
            {ingestionLogs.map((l, i) => (
              <tr key={i} className="data-row">
                <td style={{ ...S.td, color: C.blue, fontFamily: "monospace", fontSize: 11 }}>{l.id}</td>
                <td style={S.td}>{l.source}</td>
                <td style={S.td}><span style={S.badge(C.blue)}>{l.type}</span></td>
                <td style={{ ...S.td, fontWeight: 600 }}>{l.records.toLocaleString()}</td>
                <td style={S.td}>
                  {l.standardized
                    ? <span style={S.riskBadge("LOW")}>YES</span>
                    : <span style={S.riskBadge("HIGH")}>PENDING</span>}
                </td>
                <td style={S.td}><span style={S.badge(STATUS_COLOR[l.status])}>{l.status}</span></td>
                <td style={{ ...S.td, color: C.muted, fontSize: 11 }}>{l.date} {l.time}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
