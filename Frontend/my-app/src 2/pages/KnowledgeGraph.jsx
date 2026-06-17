import { useState } from "react";
import { C, S } from "../styles/theme";
import { kgTriples } from "../data/mockData";

const SPARQL_EXAMPLES = [
  { label:"All CRITICAL suppliers",  query:`SELECT ?s WHERE {\n  ?s rdf:type :Supplier ;\n     :hasRiskLevel :CRITICAL .\n}` },
  { label:"Lithium Carbonate impact", query:`SELECT ?process WHERE {\n  :Lithium_Carbonate :usedInProcess ?process .\n}` },
  { label:"All SLA violations",       query:`SELECT ?sla ?penalty WHERE {\n  ?sla rdf:type :SLA_Agreement ;\n       :violationStatus true ;\n       :hasPenaltyPerDay ?penalty .\n}` },
  { label:"Fallback suppliers",        query:`SELECT ?alt WHERE {\n  ?alt :canSupply :Lithium_Carbonate ;\n       :hasLeadTime ?lt .\n  FILTER(?lt <= 10)\n}` },
];

const SPARQL_RESULTS = {
  0: [{ s:"RapidRaw_LLC", risk:"CRITICAL", onTime:"42%", score:31 }],
  1: [{ process:"Assembly_Line_B" }, { process:"Quality_Control" }],
  2: [{ sla:"SLA-005", penalty:"$25,000/day" }, { sla:"SLA-002", penalty:"$12,000/day" }],
  3: [{ alt:"EuroMinerals_GmbH", leadTime:"8 days", capacity:"75%" }],
};

export default function KnowledgeGraph() {
  const [query,      setQuery]      = useState(SPARQL_EXAMPLES[0].query);
  const [results,    setResults]    = useState(null);
  const [running,    setRunning]    = useState(false);
  const [selectedEx, setSelectedEx] = useState(null);
  const [activeTab,  setActiveTab]  = useState("explorer");

  const runQuery = async () => {
    setRunning(true); setResults(null);
    await new Promise(r => setTimeout(r, 900));
    setResults(SPARQL_RESULTS[selectedEx ?? 0]);
    setRunning(false);
  };

  const loadExample = (i) => { setSelectedEx(i); setQuery(SPARQL_EXAMPLES[i].query); setResults(null); };

  const Tab = ({ id, label }) => (
    <button className="tab-btn" onClick={() => setActiveTab(id)} style={{
      padding: "7px 16px", background: activeTab === id ? C.accent : "transparent",
      border: `1px solid ${activeTab === id ? C.accent : C.border}`,
      borderRadius: 5, cursor: "pointer", fontSize: 11,
      color: activeTab === id ? "#000" : C.muted,
      fontFamily: "inherit", fontWeight: activeTab === id ? 700 : 400,
    }}>{label}</button>
  );

  return (
    <div>
      <div style={S.pageHeader}>
        <div style={S.pageTitle}>Knowledge Graph · Semantic Query</div>
        <div style={S.pageDesc}>Semantic Triple Store · SPARQL Query Engine</div>
      </div>

      <div style={{ display: "flex", gap: 8, marginBottom: 20 }}>
        <Tab id="explorer" label="🔍 SPARQL Explorer" />
        <Tab id="triples"  label="🔗 Triple Browser"  />
      </div>

      {/* SPARQL Explorer */}
      {activeTab === "explorer" && (
        <div style={S.grid2}>
          <div>
            <div style={{ ...S.card, marginBottom: 16 }}>
              <div style={{ ...S.cardTitle, marginBottom: 12 }}>💡 Example Queries</div>
              {SPARQL_EXAMPLES.map((e, i) => (
                <div key={i} className="suggestion-item" onClick={() => loadExample(i)}
                  style={{ padding: "8px 10px", marginBottom: 6, background: selectedEx === i ? C.accent + "11" : C.bg, border: `1px solid ${selectedEx === i ? C.accent + "55" : C.border}`, borderRadius: 5, cursor: "pointer", fontSize: 11, color: C.muted, transition: "all 0.15s" }}>
                  {e.label}
                </div>
              ))}
            </div>
            <div style={S.card}>
              <div style={{ ...S.cardTitle, marginBottom: 12 }}>📊 Graph Statistics</div>
              {[["Nodes (Entities)","47"],["Edges (Triples)","312"],["Classes","14"],["Object Properties","23"],["Data Properties","41"],["SWRL Rules","12"]].map(([l, v], i) => (
                <div key={i} style={{ display: "flex", justifyContent: "space-between", padding: "6px 0", borderBottom: `1px solid ${C.border}22`, fontSize: 11 }}>
                  <span style={{ color: C.muted }}>{l}</span>
                  <span style={{ color: C.text, fontWeight: 700 }}>{v}</span>
                </div>
              ))}
            </div>
          </div>

          <div>
            <div style={{ ...S.card, marginBottom: 14 }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
                <span style={S.cardTitle}>SPARQL Query Editor</span>
                <button style={S.btn()} className="btn-hover" onClick={runQuery}>▶ Execute</button>
              </div>
              <textarea value={query} onChange={e => setQuery(e.target.value)}
                style={{ ...S.input, height: 140, resize: "vertical", fontFamily: "monospace", fontSize: 11, lineHeight: 1.6 }} />
            </div>
            <div style={S.card}>
              <div style={{ ...S.cardTitle, marginBottom: 12 }}>
                Query Results {results && <span style={{ ...S.badge(C.green), marginLeft: 8 }}>{results.length} rows</span>}
              </div>
              {running && <div style={{ textAlign: "center", padding: "20px", color: C.accent }}><span className="spin">⚙</span> Querying graph...</div>}
              {!running && !results && <div style={{ textAlign: "center", padding: "20px", color: C.muted, fontSize: 12 }}>Select a query and click Execute</div>}
              {results && !running && (
                <table style={S.table}>
                  <thead><tr>{Object.keys(results[0]).map(k => <th key={k} style={S.th}>{k}</th>)}</tr></thead>
                  <tbody>
                    {results.map((row, i) => (
                      <tr key={i} className="data-row">
                        {Object.values(row).map((v, j) => (
                          <td key={j} style={{ ...S.td, fontFamily: "monospace", fontSize: 11, color: C.blue }}>{String(v)}</td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Triple Browser */}
      {activeTab === "triples" && (
        <div style={S.card}>
          <div style={S.cardHeader}>
            <span style={S.cardTitle}>🔗 RDF Triple Store · {kgTriples.length} triples shown</span>
            <span style={S.badge(C.blue)}>Triple Store</span>
          </div>
          <table style={S.table}>
            <thead>
              <tr><th style={S.th}>Subject</th><th style={S.th}>Predicate</th><th style={S.th}>Object</th></tr>
            </thead>
            <tbody>
              {kgTriples.map((t, i) => (
                <tr key={i} className="data-row">
                  <td style={{ ...S.td, color: C.accent,  fontFamily: "monospace", fontSize: 11 }}>{t.subject}</td>
                  <td style={{ ...S.td, color: C.purple,  fontFamily: "monospace", fontSize: 11 }}>{t.predicate}</td>
                  <td style={{ ...S.td, color: C.blue,    fontFamily: "monospace", fontSize: 11 }}>{t.object}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
