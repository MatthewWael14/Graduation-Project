import { useState } from "react";
import { C, S } from "../styles/theme";
import { uploadSLAPdf, confirmSLA } from "../services/api";

// ── Field must be defined OUTSIDE the parent component so React
// does not remount it on every keystroke (which caused typing to break)
function Field({ label, field, type = "text", editedFields, setEditedFields, error }) {
  return (
    <div style={{ marginBottom: 12 }}>
      <label style={{ fontSize: 12, color: C.muted, display: "block", marginBottom: 5, fontWeight: 600, letterSpacing: "0.04em", textTransform: "uppercase" }}>
        {label}
      </label>
      <input
        type={type}
        value={editedFields[field] || ""}
        onChange={e => setEditedFields(p => ({ ...p, [field]: e.target.value }))}
        style={{ ...S.input, borderColor: error ? C.red : C.border, background: error ? C.red + "0A" : C.bg }}
      />
      {error && <div style={{ color: C.red, fontSize: 11, marginTop: 4, fontWeight: 500 }}>{error}</div>}
    </div>
  );
}

export default function SLAUpload({ user }) {
  const [dragging,     setDragging]     = useState(false);
  const [step,         setStep]         = useState("idle"); // idle | extracting | review | confirming | done | error
  const [extraction,   setExtraction]   = useState(null);
  const [editedFields, setEditedFields] = useState({});
  const [confirmed,    setConfirmed]    = useState(null);
  const [error,        setError]        = useState("");
  const [formErrors,   setFormErrors]   = useState({});
  const [pipelineStep, setPipelineStep] = useState(0);

  const pipelineSteps = [
    "📤 File uploaded to staging",
    "🤖 LLM extracting entities...",
    "🔍 Validating contract structure...",
    "✅ Extraction complete",
  ];

  const handleFile = async (file) => {
    if (!file) return;
    setStep("extracting"); setError(""); setFormErrors({}); setExtraction(null); setConfirmed(null); setPipelineStep(0);

    // Animate pipeline steps while uploading
    const stepTimer = setInterval(() => {
      setPipelineStep(p => (p < 2 ? p + 1 : p));
    }, 700);

    try {
      const result = await uploadSLAPdf(file);
      clearInterval(stepTimer);
      setPipelineStep(3);
      setExtraction(result);
      setEditedFields({
        supplier_name:  result.mapped_sla?.supplier_name  || result.extracted_data?.supplier_name || "",
        material:       result.mapped_sla?.material       || result.extracted_data?.material       || "",
        lead_time_days: result.mapped_sla?.lead_time_days || Math.ceil((result.extracted_data?.sla_lead_time_hours || 0) / 24) || "",
        penalty_clause: result.mapped_sla?.penalty_clause || `$${result.extracted_data?.delay_penalty_rate || 0}/day` || "",
        corrections:    "",
        quantity:       result.mapped_sla?.quantity       || result.extracted_data?.quantity       || "",
        unit_cost:      result.mapped_sla?.unit_cost      || result.extracted_data?.unit_cost      || "",
        impacted_process: result.mapped_sla?.impacted_process || "",
      });
      setStep("review");
    } catch (err) {
      clearInterval(stepTimer);
      setError(err.message || "Extraction failed.");
      setStep("error");
    }
  };

  const handleDrop = (e) => {
    e.preventDefault(); setDragging(false);
    handleFile(e.dataTransfer?.files?.[0]);
  };

  const handleBrowse = (e) => handleFile(e.target?.files?.[0]);

  const handleConfirm = async () => {
    // Validate required fields
    const newErrors = {};
    if (!editedFields.supplier_name) newErrors.supplier_name = "Supplier Name is required";
    if (!editedFields.material) newErrors.material = "Material is required";
    if (!editedFields.lead_time_days) newErrors.lead_time_days = "Lead Time is required";
    if (!editedFields.penalty_clause) newErrors.penalty_clause = "Penalty Clause is required";
    if (!editedFields.quantity) newErrors.quantity = "Quantity is required";
    if (!editedFields.unit_cost) newErrors.unit_cost = "Unit Cost is required";
    if (!editedFields.impacted_process) newErrors.impacted_process = "Impacted Process is required";

    if (Object.keys(newErrors).length > 0) {
      setFormErrors(newErrors);
      return;
    }
    setFormErrors({});
    
    setStep("confirming");
    try {
      const result = await confirmSLA({
        extraction_id:  extraction.extraction_id,
        supplier_name:  editedFields.supplier_name,
        material:       editedFields.material,
        lead_time_days: parseInt(editedFields.lead_time_days, 10) || 0,
        penalty_clause: editedFields.penalty_clause,
        corrections:    editedFields.corrections || null,
        quantity:       parseInt(editedFields.quantity, 10) || 0,
        unit_cost:      parseFloat(editedFields.unit_cost) || 0.0,
        impacted_process: editedFields.impacted_process || null,
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

  return (
    <div>
      <div style={S.pageHeader}>
        <div style={S.pageTitle}>SLA Upload · LLM Parser</div>
        <div style={S.pageDesc}>Upload a PDF contract — AI extracts entities · Review · Save to Knowledge Graph</div>
      </div>

      <div style={S.grid2}>
        {/* Left: Upload flow */}
        <div>
          {/* Step: idle or error — show drop zone */}
          {(step === "idle" || step === "error") && (
            <div
              onDragOver={e => { e.preventDefault(); setDragging(true); }}
              onDragLeave={() => setDragging(false)}
              onDrop={handleDrop}
              style={{
                ...S.card, textAlign: "center", padding: 48,
                borderStyle: "dashed", borderWidth: 2,
                borderColor: dragging ? C.accent : C.border,
                background: dragging ? "rgba(245,158,11,0.05)" : C.surface,
                cursor: "pointer", transition: "all 0.2s", marginBottom: 16,
              }}
            >
              <div style={{ fontSize: 48, marginBottom: 14 }}>📄</div>
              <div style={{ fontSize: 16, fontWeight: 700, color: C.text, marginBottom: 6 }}>Drop SLA Contract Here</div>
              <div style={{ fontSize: 13, color: C.muted, marginBottom: 20 }}>PDF · TXT · DOC · DOCX · Max 50MB</div>
              <label style={{ ...S.btn(), cursor: "pointer", display: "inline-block" }}>
                Browse Files
                <input type="file" accept=".pdf,.txt,.doc,.docx,application/pdf,text/plain,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document" style={{ display: "none" }} onChange={handleBrowse} />
              </label>

              {step === "error" && (
                <div style={{ marginTop: 16, padding: "10px 14px", background: C.red + "18", border: `1px solid ${C.red}44`, borderRadius: 8, fontSize: 13, color: C.red }}>
                  ⚠ {error}
                </div>
              )}
            </div>
          )}

          {/* Step: extracting / review / confirming / done — show pipeline */}
          {step !== "idle" && step !== "error" && (
            <div style={{ ...S.card, marginBottom: 16 }}>
              <div style={{ ...S.cardTitle, marginBottom: 14 }}>⚙ Processing Pipeline</div>
              {pipelineSteps.map((s, i) => (
                <div key={i} style={{ display: "flex", alignItems: "center", gap: 10, padding: "8px 0", borderBottom: `1px solid ${C.border}22` }}>
                  <div style={{
                    width: 24, height: 24, borderRadius: "50%", flexShrink: 0,
                    display: "flex", alignItems: "center", justifyContent: "center",
                    fontSize: 11, fontWeight: 700,
                    background: i < pipelineStep ? C.green : i === pipelineStep && step === "extracting" ? C.accent : i <= pipelineStep ? C.green : C.border,
                    color: i <= pipelineStep ? "#000" : C.muted,
                  }}>
                    {i < pipelineStep ? "✓" : i === pipelineStep && step === "extracting" ? <span className="spin" style={{ fontSize: 10 }}>⚙</span> : i + 1}
                  </div>
                  <span style={{ fontSize: 14, color: i <= pipelineStep ? C.text : C.muted }}>{s}</span>
                </div>
              ))}
            </div>
          )}

          {/* Step: review — show editable extracted fields */}
          {(step === "review" || step === "confirming") && (
            <div style={{ ...S.card, borderLeft: `3px solid ${C.blue}` }}>
              <div style={{ fontSize: 15, fontWeight: 700, color: C.text, marginBottom: 4 }}>👤 Review Extracted Data</div>
              <div style={{ fontSize: 13, color: C.muted, marginBottom: 16 }}>
                Review and correct before saving to Knowledge Graph
              </div>

              {/* Raw numbers */}
              {extraction?.extracted_data && (
                <div style={{ marginBottom: 16, padding: "10px 14px", background: C.bg, borderRadius: 8, border: `1px solid ${C.border}` }}>
                  <div style={{ fontSize: 12, color: C.muted, fontWeight: 600, marginBottom: 8 }}>RAW EXTRACTED VALUES</div>
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 6 }}>
                    {[
                      ["Lead Time", `${extraction.extracted_data.sla_lead_time_hours}h`],
                      ["Delay Penalty", `$${extraction.extracted_data.delay_penalty_rate}/day`],
                      ["Quality Threshold", `${(extraction.extracted_data.minimum_quality_threshold * 100).toFixed(0)}%`],
                      ["Quality Penalty", `${(extraction.extracted_data.quality_penalty_rate * 100).toFixed(0)}%`],
                      ["Quantity", `${extraction.extracted_data.quantity || 0}`],
                      ["Unit Cost", `$${extraction.extracted_data.unit_cost || 0.0}`],
                    ].map(([k, v], i) => (
                      <div key={i} style={{ fontSize: 12, display: "flex", justifyContent: "space-between" }}>
                        <span style={{ color: C.muted }}>{k}</span>
                        <span style={{ color: C.accent, fontWeight: 600 }}>{v}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              <Field label="Supplier Name"   field="supplier_name"  editedFields={editedFields} setEditedFields={setEditedFields} error={formErrors.supplier_name} />
              <Field label="Material"         field="material"       editedFields={editedFields} setEditedFields={setEditedFields} error={formErrors.material} />
              <Field label="Lead Time (Days)" field="lead_time_days" type="number" editedFields={editedFields} setEditedFields={setEditedFields} error={formErrors.lead_time_days} />
              <Field label="Penalty Clause"   field="penalty_clause" editedFields={editedFields} setEditedFields={setEditedFields} error={formErrors.penalty_clause} />
              <Field label="Quantity"         field="quantity"       type="number" editedFields={editedFields} setEditedFields={setEditedFields} error={formErrors.quantity} />
              <Field label="Unit Cost ($)"    field="unit_cost"      type="number" editedFields={editedFields} setEditedFields={setEditedFields} error={formErrors.unit_cost} />
              
              <div style={{ marginBottom: 12 }}>
                <label style={{ fontSize: 12, color: C.muted, display: "block", marginBottom: 5, fontWeight: 600, letterSpacing: "0.04em", textTransform: "uppercase" }}>
                  Impacted Assembly Line
                </label>
                <select
                  value={editedFields.impacted_process || ""}
                  onChange={e => setEditedFields(p => ({ ...p, impacted_process: e.target.value }))}
                  style={{ ...S.input, borderColor: formErrors.impacted_process ? C.red : C.border, background: formErrors.impacted_process ? C.red + "0A" : C.bg }}
                >
                  <option value="" style={{ background: C.bg, color: C.text }}>-- Select Assembly Line --</option>
                  <option value="EV_Battery_Assembly_Line" style={{ background: C.bg, color: C.text }}>EV Battery Assembly Line</option>
                  <option value="Electronics_SubAssembly_Line" style={{ background: C.bg, color: C.text }}>Electronics SubAssembly Line</option>
                  <option value="Main_Assembly_Line" style={{ background: C.bg, color: C.text }}>Main Assembly Line</option>
                  <option value="Chemical_Mixing_Phase" style={{ background: C.bg, color: C.text }}>Chemical Mixing Phase</option>
                  <option value="Coating_Process" style={{ background: C.bg, color: C.text }}>Coating Process</option>
                </select>
                {formErrors.impacted_process && <div style={{ color: C.red, fontSize: 11, marginTop: 4, fontWeight: 500 }}>{formErrors.impacted_process}</div>}
              </div>

              <div style={{ marginBottom: 16 }}>
                <label style={{ fontSize: 12, color: C.muted, display: "block", marginBottom: 5, fontWeight: 600, letterSpacing: "0.04em", textTransform: "uppercase" }}>
                  Corrections / Notes (Optional)
                </label>
                <textarea
                  value={editedFields.corrections || ""}
                  onChange={e => setEditedFields(p => ({ ...p, corrections: e.target.value }))}
                  placeholder="Note any corrections made..."
                  style={{ ...S.input, height: 70, resize: "vertical" }}
                />
              </div>

              <div style={{ display: "flex", gap: 8 }}>
                <button style={{ ...S.btn("ghost"), flex: 1 }} onClick={reset}>← Start Over</button>
                <button
                  style={{ ...S.btn(), flex: 2, opacity: step === "confirming" ? 0.7 : 1 }}
                  disabled={step === "confirming"}
                  onClick={handleConfirm}
                >
                  {step === "confirming"
                    ? <><span className="spin">⚙</span> Saving to Knowledge Graph...</>
                    : "✓ Confirm & Save"}
                </button>
              </div>
            </div>
          )}

          {/* Step: done */}
          {step === "done" && confirmed && (
            <div style={{ ...S.card, borderLeft: `3px solid ${C.green}` }}>
              <div style={{ fontSize: 15, fontWeight: 700, color: C.green, marginBottom: 14 }}>✅ Saved to Knowledge Graph</div>
              {[
                ["Extraction ID", confirmed.extraction_id],
                ["Supplier",      confirmed.supplier],
                ["Material",      confirmed.material],
                ["Triples Added", confirmed.triples_inserted?.toString() || "—"],
                ["Repository",    confirmed.graph || "supply-chain"],
              ].map(([k, v], i) => (
                <div key={i} style={{ display: "flex", justifyContent: "space-between", padding: "8px 0", borderBottom: `1px solid ${C.border}22`, fontSize: 13 }}>
                  <span style={{ color: C.muted }}>{k}</span>
                  <span style={{ color: C.text, fontWeight: 600 }}>{v}</span>
                </div>
              ))}
              <button style={{ ...S.btn(), width: "100%", marginTop: 16 }} onClick={reset}>Upload Another Contract</button>
            </div>
          )}
        </div>

        {/* Right: How it works panel */}
        <div style={S.card}>
          <div style={{ ...S.cardTitle, marginBottom: 16 }}>ℹ How It Works</div>
          {[
            { step: "1", title: "Upload PDF", desc: "Drop your SLA contract PDF. The LLM reads the document and extracts key terms automatically." },
            { step: "2", title: "Review Extraction", desc: "Check the extracted supplier name, material, lead time, and penalty clause. Correct any errors." },
            { step: "3", title: "Confirm & Save", desc: "Once confirmed, the data is converted to RDF triples and stored in the Knowledge Graph for reasoning." },
          ].map((item, i) => (
            <div key={i} style={{ display: "flex", gap: 14, marginBottom: 20 }}>
              <div style={{ width: 32, height: 32, borderRadius: "50%", background: C.accent + "22", border: `2px solid ${C.accent}44`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 14, fontWeight: 700, color: C.accent, flexShrink: 0 }}>
                {item.step}
              </div>
              <div>
                <div style={{ fontSize: 14, fontWeight: 700, color: C.text, marginBottom: 4 }}>{item.title}</div>
                <div style={{ fontSize: 13, color: C.muted, lineHeight: 1.5 }}>{item.desc}</div>
              </div>
            </div>
          ))}

          <div style={{ padding: "12px 14px", background: C.bg, borderRadius: 8, border: `1px solid ${C.border}`, marginTop: 8 }}>
            <div style={{ fontSize: 12, color: C.muted, marginBottom: 4, fontWeight: 600 }}>SUPPORTED FORMATS</div>
            <div style={{ fontSize: 13, color: C.text }}>PDF · TXT · DOC · DOCX · English language contracts only</div>
          </div>
        </div>
      </div>
    </div>
  );
}
