import { useState, useEffect } from "react";
import { C, S } from "../styles/theme";
import { uploadSLAPdf, confirmSLA, matchAssemblyLine } from "../services/api";

// ── Field must be defined OUTSIDE the parent component so React
// does not remount it on every keystroke (which caused typing to break)
function Field({ label, field, type = "text", editedFields, setEditedFields, error, step }) {
  const value = editedFields[field];
  return (
    <div style={{ marginBottom: 12 }}>
      <label style={{ fontSize: 12, color: C.muted, display: "block", marginBottom: 5, fontWeight: 600, letterSpacing: "0.04em", textTransform: "uppercase" }}>
        {label}
      </label>
      <input
        type={type}
        step={step}
        value={value !== undefined && value !== null ? value : ""}
        onChange={e => setEditedFields(p => ({ ...p, [field]: e.target.value }))}
        style={{ ...S.input, borderColor: error ? C.red : C.border, background: error ? C.red + "0A" : C.bg }}
      />
      {error && <div style={{ color: C.red, fontSize: 11, marginTop: 4, fontWeight: 500 }}>{error}</div>}
    </div>
  );
}

const pipelineSteps = [
  "📤 File uploaded to staging",
  "🤖 LLM extracting entities...",
  "🔍 Validating contract structure...",
  "✅ Extraction complete",
];

export default function SLAUpload({ user }) {
  const [dragging,     setDragging]     = useState(false);
  const [step,         setStep]         = useState("idle"); // idle | extracting | review | confirming | done | error
  const [extraction,   setExtraction]   = useState(null);
  const [editedFields, setEditedFields] = useState({});
  const [confirmed,    setConfirmed]    = useState(null);
  const [error,        setError]        = useState("");
  const [formErrors,   setFormErrors]   = useState({});
  const [pipelineStep, setPipelineStep] = useState(0);
  const [assemblyMatch, setAssemblyMatch] = useState(null); // { matched, process } | null

  useEffect(() => {
    const materialName = editedFields.material;
    if (!materialName || step !== "review") {
      return;
    }

    setAssemblyMatch(null); // Show checking/loading state

    const delayDebounceFn = setTimeout(() => {
      matchAssemblyLine(materialName)
        .then(match => {
          if (editedFields.material === materialName) {
            setAssemblyMatch(match);
          }
        })
        .catch(() => {
          if (editedFields.material === materialName) {
            setAssemblyMatch({ matched: false, process: null });
          }
        });
    }, 400); // 400ms debounce to avoid excessive backend requests

    return () => clearTimeout(delayDebounceFn);
  }, [editedFields.material, step]);

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
      const materialName = result.mapped_sla?.material || result.extracted_data?.material || "";
      
      const delayPenalty = result.mapped_sla?.delay_penalty_rate !== undefined && result.mapped_sla?.delay_penalty_rate !== null ? result.mapped_sla.delay_penalty_rate : result.extracted_data?.delay_penalty_rate;
      const missedItemPenalty = result.mapped_sla?.missed_item_penalty_rate !== undefined && result.mapped_sla?.missed_item_penalty_rate !== null ? result.mapped_sla.missed_item_penalty_rate : result.extracted_data?.missed_item_penalty_rate;
      const minQuality = result.mapped_sla?.min_quality_threshold !== undefined && result.mapped_sla?.min_quality_threshold !== null ? result.mapped_sla.min_quality_threshold : result.extracted_data?.minimum_quality_threshold;
      const qualityPenalty = result.mapped_sla?.quality_penalty_rate !== undefined && result.mapped_sla?.quality_penalty_rate !== null ? result.mapped_sla.quality_penalty_rate : result.extracted_data?.quality_penalty_rate;
      
      const quantityVal = result.mapped_sla?.quantity !== undefined && result.mapped_sla?.quantity !== null ? result.mapped_sla.quantity : result.extracted_data?.quantity;
      const unitCostVal = result.mapped_sla?.unit_cost !== undefined && result.mapped_sla?.unit_cost !== null ? result.mapped_sla.unit_cost : result.extracted_data?.unit_cost;

      setEditedFields({
        supplier_name:            result.mapped_sla?.supplier_name  || result.extracted_data?.supplier_name || "",
        material:                 materialName,
        lead_time_days:           result.mapped_sla?.lead_time_days || Math.ceil((result.extracted_data?.sla_lead_time_hours || 0) / 24) || "",
        penalty_clause:           result.mapped_sla?.penalty_clause || (delayPenalty > 0 ? `Delay penalty: $${delayPenalty}/day.` : "") || "",
        corrections:              "",
        quantity:                 quantityVal > 0 ? quantityVal : "",
        unit_cost:                unitCostVal > 0 ? unitCostVal : "",
        is_fallback:              false,
        delay_penalty_rate:       delayPenalty > 0 ? delayPenalty : "",
        missed_item_penalty_rate: missedItemPenalty > 0 ? missedItemPenalty : "",
        min_quality_threshold:    minQuality > 0 ? minQuality : "",
        quality_penalty_rate:     qualityPenalty > 0 ? qualityPenalty : "",
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

    if (Object.keys(newErrors).length > 0) {
      setFormErrors(newErrors);
      return;
    }
    setFormErrors({});
    
    setStep("confirming");
    try {
      const qty = parseInt(editedFields.quantity, 10) || 0;
      const cost = parseFloat(editedFields.unit_cost) || 0.0;
      const delayPen = parseFloat(editedFields.delay_penalty_rate);
      const missedPen = parseFloat(editedFields.missed_item_penalty_rate);
      const minQual = parseFloat(editedFields.min_quality_threshold);
      const qualPen = parseFloat(editedFields.quality_penalty_rate);

      const result = await confirmSLA({
        extraction_id:            extraction.extraction_id,
        supplier_name:            editedFields.supplier_name,
        material:                 editedFields.material,
        lead_time_days:           parseInt(editedFields.lead_time_days, 10) || 0,
        penalty_clause:           editedFields.penalty_clause,
        corrections:              editedFields.corrections || null,
        quantity:                 qty,
        unit_cost:                cost,
        impacted_process:         assemblyMatch?.matched ? assemblyMatch.process : null,
        is_fallback:              editedFields.is_fallback || false,
        delay_penalty_rate:       !isNaN(delayPen) ? delayPen : null,
        missed_item_penalty_rate: !isNaN(missedPen) ? missedPen : null,
        min_quality_threshold:    !isNaN(minQual) ? minQual : null,
        quality_penalty_rate:     !isNaN(qualPen) ? qualPen : null,
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
    setError(""); setEditedFields({}); setPipelineStep(0); setAssemblyMatch(null);
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

              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                <Field label="Quantity"         field="quantity"       type="number" editedFields={editedFields} setEditedFields={setEditedFields} error={formErrors.quantity} />
                <Field label="Unit Cost ($)"    field="unit_cost"      type="number" step="any" editedFields={editedFields} setEditedFields={setEditedFields} error={formErrors.unit_cost} />
              </div>
              
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                <Field label="Delay Penalty ($/day)" field="delay_penalty_rate" type="number" step="any" editedFields={editedFields} setEditedFields={setEditedFields} error={formErrors.delay_penalty_rate} />
                <Field label="Missed Item Penalty ($/unit)" field="missed_item_penalty_rate" type="number" step="any" editedFields={editedFields} setEditedFields={setEditedFields} error={formErrors.missed_item_penalty_rate} />
              </div>

              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                <Field label="Min Quality Threshold (0.0-1.0)" field="min_quality_threshold" type="number" step="0.01" editedFields={editedFields} setEditedFields={setEditedFields} error={formErrors.min_quality_threshold} />
                <Field label="Quality Penalty Rate (0.0-1.0)" field="quality_penalty_rate" type="number" step="0.01" editedFields={editedFields} setEditedFields={setEditedFields} error={formErrors.quality_penalty_rate} />
              </div>
              
              {/* Register as Fallback option */}
              <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 16, marginTop: 4 }}>
                <input
                  type="checkbox"
                  id="is_fallback"
                  checked={editedFields.is_fallback || false}
                  onChange={e => setEditedFields(p => ({ ...p, is_fallback: e.target.checked }))}
                  style={{ width: 17, height: 17, cursor: "pointer", accentColor: C.accent }}
                />
                <label htmlFor="is_fallback" style={{ fontSize: 13, fontWeight: 600, color: C.text, cursor: "pointer", userSelect: "none" }}>
                  Register as Alternative/Backup Supplier
                </label>
              </div>
              
              {/* Assembly Line: auto-matched or new-material notice */}
              <div style={{ marginBottom: 12 }}>
                <label style={{ fontSize: 12, color: C.muted, display: "block", marginBottom: 5, fontWeight: 600, letterSpacing: "0.04em", textTransform: "uppercase" }}>
                  Assembly Line
                </label>
                {assemblyMatch === null && (
                  <div style={{ fontSize: 12, color: C.muted, padding: "8px 12px", background: C.bg, borderRadius: 6, border: `1px solid ${C.border}` }}>
                    ⏳ Checking knowledge graph...
                  </div>
                )}
                {assemblyMatch?.matched && (
                  <div style={{ fontSize: 13, color: C.green, padding: "10px 14px", background: C.green + "15", borderRadius: 8, border: `1px solid ${C.green}44`, fontWeight: 600 }}>
                    ✅ Auto-matched: <span style={{ color: C.text }}>{assemblyMatch.process.replace(/_/g, " ")}</span>
                    <div style={{ fontSize: 11, color: C.muted, fontWeight: 400, marginTop: 2 }}>This material is already linked to an assembly line in the system.</div>
                  </div>
                )}
                {assemblyMatch !== null && !assemblyMatch.matched && (
                  <div style={{ fontSize: 13, color: C.orange, padding: "10px 14px", background: C.orange + "15", borderRadius: 8, border: `1px solid ${C.orange}44`, fontWeight: 600 }}>
                    ⚠ New material detected
                    <div style={{ fontSize: 11, color: C.muted, fontWeight: 400, marginTop: 2 }}>An alert will be sent to the Production Manager to manually assign this material to an assembly line.</div>
                  </div>
                )}
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
