import { useState } from "react";
import { C, S } from "../styles/theme";
import { slaData } from "../data/mockData";
import { uploadSLAPdf, confirmSLA } from "../services/api";

export default function SLAUpload({ user }) {
  const [dragging,     setDragging]     = useState(false);
  const [step,         setStep]         = useState("idle"); // idle | extracting | review | confirming | done | error
  const [extraction,   setExtraction]   = useState(null);  // raw backend response
  const [editedFields, setEditedFields] = useState({});    // user edits
  const [confirmed,    setConfirmed]    = useState(null);  // confirmed response
  const [error,        setError]        = useState("");
  const [pipelineStep, setPipelineStep] = useState(0);

  const pipelineSteps = [
    "📤 File uploaded to staging",
    "🤖 LLM extracting entities...",
    "🔍 Validating contract structure...",
    "✅ Extraction complete",
  ];

  const handleDrop = async (e) => {
    e.preventDefault(); setDragging(false);
    const file = e.dataTransfer?.files?.[0] || e.target?.files?.[0];
    if (!file) return;

    setStep("extracting"); setError(""); setExtraction(null); setConfirmed(null);
    setPipelineStep(0);

    // Animate pipeline steps
    for (let i = 1; i <= 3; i++) {
      await new Promise(r => setTimeout(r, 700));
      setPipelineStep(i);
    }

    try {
      const result = await uploadSLAPdf(file);
      setExtraction(result);
      // Pre-fill editable fields from extracted data
      setEditedFields({
        supplier_name:  result.mapped_sla?.supplier_name  || result.extracted_data?.supplier_name || "",
        material:       result.mapped_sla?.material       || result.extracted_data?.material       || "",
        lead_time_days: result.mapped_sla?.lead_time_days || Math.ceil((result.extracted_data?.sla_lead_time_hours || 0) / 24) || "",
        penalty_clause: result.mapped_sla?.penalty_clause || `$${result.extracted_data?.delay_penalty_rate || 0}/day delay penalty` || "",
        corrections:    "",
      });
      setStep("review");
    } catch (err) {
      setError(err.message || "Extraction failed. Please try again.");
      setStep("error");
    }
  };

  const handleConfirm = async () => {
    setStep("confirming");
    try {
      const result = await confirmSLA({
        extraction_id: extraction.extraction_id,
        supplier_name: editedFields.supplier_name,
        material:      editedFields.material,
        lead_time_days: parseInt(editedFields.lead_time_days, 10),
        penalty_clause: editedFields.penalty_clause,
        corrections:   editedFields.corrections || null,
      });
      setConfirmed(result);
      setStep("done");
    } catch (err) {
      setError(err.message || "Failed to save to Knowledge Graph.");
      setStep("error");
    }
  };

  const reset = () => {
    setStep("idle"); setExtraction(null); setConfirmed(null);
    setError(""); setEditedFields({}); setPipelineStep(0);
  };

  const Field = ({ label, field, type = "text" }) => (
    <div style={{ marginBottom: 12 }}>
      <label style={{ fontSize: 11, color: C.muted, display: "block", marginBottom: 5, fontWeight: 600, letterSpacing: "0.04em" }}>
        {label}
      </label>
      <input
        type={type}
        value={editedFields[field] || ""}
        onChange={e => setEditedFields(p => ({ ...p, [field]: e.target.value }))}
        style={S.input}
      />
    </div>
  );

  return (
    <div>
      <div style={S.pageHeader}>
        <div style={S.pageTitle}>SLA Upload · LLM Parser</div>
        <div style={S.pageDesc}>Upload a PDF contract — AI extracts entities for review, then saves to Knowledge Graph</div>
      </div>

      <div style={S.grid2}>
        {/* Left: Upload + pipeline + review */}
        <div>
          {/* Drop zone — only show when idle or error */}
          {(step === "idle" || step === "error") && (
            <div
              onDragOver={e => { e.preventDefault(); setDragging(true); }}
              onDragLeave={() => setDragging(false)}
              onDrop={handleDrop}
              style={{
                ...S.card, textAlign: "center", padding: 44,
                borderStyle: "dashed", borderWidth: 2,
                borderColor: dragging ? C.accent : C.border,
                background: dragging ? "rgba(245,158,11,0.05)" : C.surface,
                cursor: "pointer", transition: "all 0.2s", marginBottom: 16,
              }}
            >
              <div style={{ fontSize: 44, marginBottom: 14 }}>📄</div>
              <div style={{ fontSize: 16, fontWeight: 700, color: C.text, marginBottom: 6 }}>
                Drop SLA Contract PDF Here
              </div>
              <div style={{ fontSize: 13, color: C.muted, marginBottom: 18 }}>
                Text-based PDF only · English language · Max 50MB
              </div>
              <label style={{ ...S.btn(), cursor: "pointer", display: "inline-block" }}>
                Browse Files
                <input type="file" accept=".pdf" style={{ display: "none" }} onChange={handleDrop} />
              </label>
              {step === "error" && (
                <div style={{ marginTop: 14, padding: "8px 14px", background: C.red + "18", border: `1px solid ${C.red}44`, borderRadius: 8, fontSize: 13, color: C.red }}>
                  ⚠ {error}
                </div>
              )}
            </div>
          )}

          {/* Pipeline steps */}
          {(step === "extracting" || step === "review" || step === "confirming" || step === "done") && (
            <div style={{ ...S.card, marginBottom: 16 }}>
              <div style={{ ...S.cardTitle, marginBottom: 14 }}>⚙ Processing Pipeline</div>
              {pipelineSteps.map((s, i) => (
                <div key={i} style={{ display: "flex", alignItems: "center", gap: 10, padding: "8px 0", borderBottom: `1px solid ${C.border}22` }}>
                  <div style={{
                    width: 22, height: 22, borderRadius: "50%", flexShrink: 0,
                    display: "flex", alignItems: "center", justifyContent: "center", fontSize: 11,
                    background: i <= pipelineStep ? C.green : C.border,
                    color: i <= pipelineStep ? "#000" : C.muted, fontWeight: 700,
                  }}>
                    {i < pipelineStep ? "✓" : i === pipelineStep && step === "extracting" ? <span className="spin" style={{ fontSize: 10 }}>⚙</span> : i + 1}
                  </div>
                  <span style={{ fontSize: 14, color: i <= pipelineStep ? C.text : C.muted }}>
                    {s}
                  </span>
                </div>
              ))}
              {extraction?._offline && (
                <div style={{ marginTop: 10, fontSize: 12, color: C.orange }}>⚠ Backend offline — showing demo extraction</div>
              )}
            </div>
          )}

          {/* Review form */}
          {(step === "review" || step === "confirming") && (
            <div style={{ ...S.card, borderLeft: `3px solid ${C.blue}` }}>
              <div style={{ ...S.cardTitle, marginBottom: 6 }}>👤 Human Review Required</div>
              <div style={{ fontSize: 13, color: C.muted, marginBottom: 16 }}>
                Review and edit the AI-extracted fields before saving to the Knowledge Graph
              </div>

              {/* Raw extracted numbers (read-only, for reference) */}
              {extraction?.extracted_data && (
                <div style={{ marginBottom: 16, padding: "10px 14px", background: C.bg, borderRadius: 8, border: `1px solid ${C.border}` }}>
                  <div style={{ fontSize: 12, color: C.muted, fontWeight: 600, marginBottom: 8 }}>RAW EXTRACTED DATA</div>
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 6, fontSize: 12 }}>
                    {[
                      ["Lead Time", `${extraction.extracted_data.sla_lead_time_hours}h (${Math.ceil(extraction.extracted_data.sla_lead_time_hours / 24)} days)`],
                      ["Delay Penalty", `$${extraction.extracted_data.delay_penalty_rate}/day`],
                      ["Quality Threshold", `${(extraction.extracted_data.minimum_quality_threshold * 100).toFixed(0)}%`],
                      ["Quality Penalty", `${(extraction.extracted_data.quality_penalty_rate * 100).toFixed(0)}%`],
                    ].map(([k, v], i) => (
                      <div key={i} style={{ display: "flex", justifyContent: "space-between" }}>
                        <span style={{ color: C.muted }}>{k}</span>
                        <span style={{ color: C.accent, fontWeight: 600 }}>{v}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              <Field label="SUPPLIER NAME"   field="supplier_name" />
              <Field label="MATERIAL"         field="material" />
              <Field label="LEAD TIME (DAYS)" field="lead_time_days" type="number" />
              <Field label="PENALTY CLAUSE"   field="penalty_clause" />

              <div style={{ marginBottom: 16 }}>
                <label style={{ fontSize: 11, color: C.muted, display: "block", marginBottom: 5, fontWeight: 600, letterSpacing: "0.04em" }}>
                  CORRECTIONS / NOTES (OPTIONAL)
                </label>
                <textarea
                  value={editedFields.corrections || ""}
                  onChange={e => setEditedFields(p => ({ ...p, corrections: e.target.value }))}
                  placeholder="Note any corrections you made..."
                  style={{ ...S.input, height: 70, resize: "vertical" }}
                />
              </div>

              <div style={{ display: "flex", gap: 8 }}>
                <button style={{ ...S.btn("ghost"), flex: 1 }} onClick={reset}>← Start Over</button>
                <button style={{ ...S.btn(), flex: 2, opacity: step === "confirming" ? 0.7 : 1 }}
                  disabled={step === "confirming"} onClick={handleConfirm}>
                  {step === "confirming" ? <><span className="spin">⚙</span> Saving...</> : "✓ Confirm & Save to Knowledge Graph"}
                </button>
              </div>
            </div>
          )}

          {/* Success */}
          {step === "done" && confirmed && (
            <div style={{ ...S.card, borderLeft: `3px solid ${C.green}` }}>
              <div style={{ fontSize: 15, fontWeight: 700, color: C.green, marginBottom: 14 }}>
                ✅ SLA Saved to Knowledge Graph
              </div>
              {[
                ["Extraction ID", confirmed.extraction_id],
                ["Supplier",      confirmed.supplier],
                ["Material",      confirmed.material],
                ["Triples Added", confirmed.triples_inserted?.toString() || "3"],
                ["Graph",         confirmed.graph || "supply-chain"],
              ].map(([k, v], i) => (
                <div key={i} style={{ display: "flex", justifyContent: "space-between", padding: "8px 0", borderBottom: `1px solid ${C.border}22`, fontSize: 13 }}>
                  <span style={{ color: C.muted }}>{k}</span>
                  <span style={{ color: C.text, fontWeight: 600 }}>{v}</span>
                </div>
              ))}
              {confirmed._offline && (
                <div style={{ marginTop: 10, fontSize: 12, color: C.orange }}>⚠ Offline demo — not actually saved</div>
              )}
              <button style={{ ...S.btn(), width: "100%", marginTop: 16 }} onClick={reset}>
                Upload Another Contract
              </button>
            </div>
          )}
        </div>

        {/* Right: Recent uploads */}
        <div style={S.card}>
          <div style={{ ...S.cardTitle, marginBottom: 16 }}>📑 Recent SLA Contracts</div>
          {slaData.map((s, i) => (
            <div key={i} style={{ padding: "12px 0", borderBottom: i < slaData.length - 1 ? `1px solid ${C.border}` : "none", display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
              <div>
                <div style={{ fontSize: 14, fontWeight: 600, color: C.text }}>{s.supplier}</div>
                <div style={{ fontSize: 12, color: C.muted, marginTop: 3 }}>
                  <span style={{ fontFamily: "monospace", color: C.blue }}>{s.id}</span> · {s.material}
                </div>
                <div style={{ fontSize: 12, color: C.muted }}>Deadline: {s.deadline} · {s.clause}</div>
                {s.violationStatus && (
                  <div style={{ fontSize: 12, color: C.green, marginTop: 3, fontWeight: 600 }}>
                    💰 Penalty owed: ${(s.penaltyDaily * Math.max(0, s.delayDays - 2)).toLocaleString()}
                  </div>
                )}
              </div>
              <span style={S.riskBadge(s.risk)}>{s.risk}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
