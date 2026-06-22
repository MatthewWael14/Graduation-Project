import { useState, useEffect } from "react";
import { C, S } from "../styles/theme";
import { fetchRiskScores, predictOrderRisk, placeOrder, fetchOrderContext } from "../services/api";

export default function OrderPlanning({ user }) {
  const [supplierMaterials, setSupplierMaterials] = useState([]);
  const [suppliers, setSuppliers] = useState([]);
  const [materials, setMaterials] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [successMessage, setSuccessMessage] = useState("");

  // Form states
  const [selectedSupplier, setSelectedSupplier] = useState("");
  const [selectedMaterial, setSelectedMaterial] = useState("");
  const [quantity, setQuantity] = useState("");
  const [unitPrice, setUnitPrice] = useState("");
  const [poDate, setPoDate] = useState(new Date().toISOString().split("T")[0]);
  const [poType, setPoType] = useState("Standard");
  const [department, setDepartment] = useState("Operations");

  // SLA Context state
  const [slaContext, setSlaContext] = useState(null);
  const [loadingContext, setLoadingContext] = useState(false);

  // Prediction/Action states
  const [evaluating, setEvaluating] = useState(false);
  const [placing, setPlacing] = useState(false);
  const [predictionResult, setPredictionResult] = useState(null);

  useEffect(() => {
    fetchRiskScores()
      .then(data => {
        setSupplierMaterials(data || []);
        // Get unique supplier labels/names
        const uniqueSups = Array.from(new Set(data.map(item => item.supplier || item.supplierLabel))).filter(Boolean).sort();
        setSuppliers(uniqueSups);
      })
      .catch(err => setError(err.message))
      .finally(() => setLoading(false));
  }, []);

  // Update materials list when supplier changes
  useEffect(() => {
    if (selectedSupplier) {
      const filtered = supplierMaterials
        .filter(item => (item.supplier || item.supplierLabel) === selectedSupplier)
        .map(item => item.material || item.materialLabel)
        .filter(Boolean);
      setMaterials(Array.from(new Set(filtered)).sort());
      setSelectedMaterial("");
    } else {
      setMaterials([]);
      setSelectedMaterial("");
    }
    setSlaContext(null);
    setPredictionResult(null);
    setSuccessMessage("");
  }, [selectedSupplier, supplierMaterials]);

  // Fetch SLA context from GraphDB when supplier and material are both selected
  useEffect(() => {
    if (selectedSupplier && selectedMaterial) {
      setLoadingContext(true);
      setError("");
      setSlaContext(null);
      
      fetchOrderContext(selectedSupplier, selectedMaterial)
        .then(res => {
          if (res.status === "success" && res.context) {
            setSlaContext(res.context);
            // Autofill the input fields with contract-grade pre-negotiated defaults
            setQuantity(res.context.quantity || 500);
            setUnitPrice(res.context.unit_cost || 15.0);
          }
        })
        .catch(err => {
          console.error("Failed to load SLA context:", err);
          setError(`Failed to retrieve contract terms from GraphDB: ${err.message}`);
        })
        .finally(() => setLoadingContext(false));
    } else {
      setSlaContext(null);
    }
    setPredictionResult(null);
    setSuccessMessage("");
  }, [selectedSupplier, selectedMaterial]);

  // Reset prediction result/success message when values change
  useEffect(() => {
    setPredictionResult(null);
    setSuccessMessage("");
  }, [poDate, poType, department]);

  const handleEvaluateRisk = async (e) => {
    e.preventDefault();
    if (!selectedSupplier || !selectedMaterial) return;

    setEvaluating(true);
    setError("");
    setSuccessMessage("");
    setPredictionResult(null);

    const payload = {
      supplier_id: selectedSupplier,
      material_id: selectedMaterial,
      quantity: quantity ? parseInt(quantity, 10) : null,
      unit_price: unitPrice ? parseFloat(unitPrice) : null,
      po_date: poDate,
      po_type: poType,
      department: department
    };

    try {
      const res = await predictOrderRisk(payload);
      setPredictionResult(res);
    } catch (err) {
      setError(`Evaluation failed: ${err.message}`);
    } finally {
      setEvaluating(false);
    }
  };

  const handlePlaceOrder = async () => {
    if (!selectedSupplier || !selectedMaterial) return;

    setPlacing(true);
    setError("");
    setSuccessMessage("");

    const payload = {
      supplier_id: selectedSupplier,
      material_id: selectedMaterial,
      quantity: quantity ? parseInt(quantity, 10) : 500,
      unit_price: unitPrice ? parseFloat(unitPrice) : 15.0,
      po_date: poDate,
      po_type: poType,
      department: department
    };

    try {
      const res = await placeOrder(payload);
      if (res.status === "success") {
        setSuccessMessage(`Order placed successfully! Generated Delivery ID: ${res.delivery_id}`);
        // Reset inputs and context states to force fresh flow
        setPredictionResult(null);
        setSelectedSupplier("");
        setSelectedMaterial("");
        setQuantity("");
        setUnitPrice("");
      } else {
        setError(`Failed to place order: ${res.message || "Unknown error"}`);
      }
    } catch (err) {
      setError(`Failed to place order: ${err.message}`);
    } finally {
      setPlacing(false);
    }
  };

  // Determine if the proposed form inputs deviate from SLA baseline
  const isDeviating = slaContext && (
    (quantity && parseInt(quantity, 10) !== slaContext.quantity) ||
    (unitPrice && parseFloat(unitPrice) !== slaContext.unit_cost)
  );

  return (
    <div>
      <div style={{ ...S.pageHeader, display: "flex", justifyContent: "space-between", alignItems: "flex-end" }}>
        <div>
          <div style={S.pageTitle}>Order Planning & Risk Predictor</div>
          <div style={S.pageDesc}>Evaluate procurement delay risks with ML before placing orders, using the SLA as a live operational constraint</div>
        </div>
      </div>

      {error && (
        <div style={{ padding: "12px 16px", background: C.red + "15", border: `1px solid ${C.red}33`, borderRadius: 8, fontSize: 13, color: C.red, marginBottom: 16 }}>
          ⚠ {error}
        </div>
      )}

      {successMessage && (
        <div style={{ padding: "12px 16px", background: C.green + "15", border: `1px solid ${C.green}33`, borderRadius: 8, fontSize: 13, color: C.green, marginBottom: 16 }}>
          ✓ {successMessage}
        </div>
      )}

      {loading ? (
        <div style={{ ...S.card, textAlign: "center", padding: "48px", color: C.accent }}>
          <div style={{ fontSize: 22, marginBottom: 10 }} className="spin">⚙</div>
          <div style={{ fontSize: 14 }}>Loading active supplier directory from twin...</div>
        </div>
      ) : (
        <div style={S.grid2}>
          {/* Left: Input Form */}
          <div style={S.card}>
            <div style={{ ...S.cardHeader, marginBottom: 18 }}>
              <span style={S.cardTitle}>📋 Proposed Order Form</span>
              {slaContext && (
                <span style={S.badge(C.green)}>🔗 SLA Active Constraint</span>
              )}
            </div>
            
            <form onSubmit={handleEvaluateRisk}>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14, marginBottom: 14 }}>
                <div>
                  <label style={{ display: "block", fontSize: 12, color: C.muted, marginBottom: 6, fontWeight: 600 }}>Supplier</label>
                  <select
                    value={selectedSupplier}
                    onChange={(e) => setSelectedSupplier(e.target.value)}
                    required
                    style={{ ...S.select, width: "100%", height: 42 }}
                  >
                    <option value="">-- Select Supplier --</option>
                    {suppliers.map(sup => (
                      <option key={sup} value={sup}>{sup}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label style={{ display: "block", fontSize: 12, color: C.muted, marginBottom: 6, fontWeight: 600 }}>Material</label>
                  <select
                    value={selectedMaterial}
                    onChange={(e) => setSelectedMaterial(e.target.value)}
                    required
                    disabled={!selectedSupplier}
                    style={{ ...S.select, width: "100%", height: 42, opacity: selectedSupplier ? 1 : 0.5 }}
                  >
                    <option value="">-- Select Material --</option>
                    {materials.map(mat => (
                      <option key={mat} value={mat}>{mat}</option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Maverick Spend Warning Banner */}
              {isDeviating && (
                <div style={{
                  padding: "10px 14px",
                  background: C.orange + "15",
                  border: `1px solid ${C.orange}44`,
                  borderRadius: 8,
                  fontSize: 12,
                  color: C.orange,
                  marginBottom: 14,
                  lineHeight: 1.4,
                  fontWeight: 500
                }}>
                  ⚠ <strong>Maverick Spend Alert (Deviation):</strong> Proposed values do not match contract terms (Pre-negotiated Price: <strong>${slaContext.unit_cost}</strong>, Quantity: <strong>{slaContext.quantity}</strong>). Diverging from contract-grade pricing violates policy and alters ML prediction context.
                </div>
              )}

              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14, marginBottom: 14 }}>
                <div>
                  <label style={{ display: "block", fontSize: 12, color: C.muted, marginBottom: 6, fontWeight: 600 }}>Quantity</label>
                  <input
                    type="number"
                    value={quantity}
                    onChange={(e) => setQuantity(e.target.value ? parseInt(e.target.value, 10) : "")}
                    placeholder="SLA Default Template"
                    min="1"
                    required
                    disabled={loadingContext || !selectedMaterial}
                    style={{ ...S.input, opacity: selectedMaterial ? 1 : 0.5 }}
                  />
                  {slaContext && (
                    <div style={{ fontSize: 10, color: C.muted, marginTop: 4 }}>
                      SLA Contracted: <strong>{slaContext.quantity}</strong> units
                    </div>
                  )}
                </div>

                <div>
                  <label style={{ display: "block", fontSize: 12, color: C.muted, marginBottom: 6, fontWeight: 600 }}>Unit Price ($)</label>
                  <input
                    type="number"
                    step="0.01"
                    value={unitPrice}
                    onChange={(e) => setUnitPrice(e.target.value ? parseFloat(e.target.value) : "")}
                    placeholder="SLA Default Template"
                    min="0"
                    required
                    disabled={loadingContext || !selectedMaterial}
                    style={{ ...S.input, opacity: selectedMaterial ? 1 : 0.5 }}
                  />
                  {slaContext && (
                    <div style={{ fontSize: 10, color: C.muted, marginTop: 4 }}>
                      SLA Contracted: <strong>${slaContext.unit_cost.toFixed(2)}</strong>
                    </div>
                  )}
                </div>
              </div>

              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14, marginBottom: 18 }}>
                <div>
                  <label style={{ display: "block", fontSize: 12, color: C.muted, marginBottom: 6, fontWeight: 600 }}>PO Date</label>
                  <input
                    type="date"
                    value={poDate}
                    onChange={(e) => setPoDate(e.target.value)}
                    required
                    style={S.input}
                  />
                </div>

                <div>
                  <label style={{ display: "block", fontSize: 12, color: C.muted, marginBottom: 6, fontWeight: 600 }}>Order Type</label>
                  <select
                    value={poType}
                    onChange={(e) => setPoType(e.target.value)}
                    style={{ ...S.select, width: "100%", height: 42 }}
                  >
                    <option value="Standard">Standard</option>
                    <option value="Emergency">Emergency</option>
                  </select>
                </div>
              </div>

              <div style={{ marginBottom: 20 }}>
                <label style={{ display: "block", fontSize: 12, color: C.muted, marginBottom: 6, fontWeight: 600 }}>Department</label>
                <select
                  value={department}
                  onChange={(e) => setDepartment(e.target.value)}
                  style={{ ...S.select, width: "100%", height: 42 }}
                >
                  <option value="Operations">Operations</option>
                  <option value="Procurement">Procurement</option>
                  <option value="Logistics">Logistics</option>
                  <option value="IT">IT</option>
                </select>
              </div>

              <button
                type="submit"
                disabled={evaluating || !selectedSupplier || !selectedMaterial}
                style={{ ...S.btn(), width: "100%", height: 44, opacity: (selectedSupplier && selectedMaterial) ? 1 : 0.5 }}
              >
                {evaluating ? (
                  <>
                    <span className="spin" style={{ display: "inline-block", marginRight: 6 }}>⚙</span> Running ML Features...
                  </>
                ) : (
                  "🔍 Evaluate Proposed Order Risk"
                )}
              </button>
            </form>
          </div>

          {/* Right: Contract Baseline & ML Prediction Report */}
          <div style={S.card}>
            <div style={{ ...S.cardTitle, marginBottom: 18 }}>📊 Prediction Report & Contract Baseline</div>

            {loadingContext && (
              <div style={{ textAlign: "center", padding: "80px 20px", color: C.accent, fontSize: 14 }}>
                <div style={{ fontSize: 24, marginBottom: 12 }} className="spin">⚙</div>
                <div>Fetching pre-negotiated terms from GraphDB...</div>
              </div>
            )}

            {!predictionResult && !evaluating && !loadingContext && !slaContext && (
              <div style={{ textAlign: "center", padding: "80px 20px", color: C.muted, fontSize: 14 }}>
                Select a Supplier and Material to load their pre-negotiated SLA constraints and execute risk predictions.
              </div>
            )}

            {/* Display SLA Baseline when loaded */}
            {slaContext && !loadingContext && !evaluating && !predictionResult && (
              <div>
                <div style={{ padding: "16px 20px", background: C.bg, borderRadius: 10, border: `1px solid ${C.border}`, marginBottom: 20 }}>
                  <h3 style={{ fontSize: 14, color: C.accent, fontWeight: 700, marginTop: 0, marginBottom: 12 }}>🛡 Active SLA Contract Baseline</h3>
                  <div style={{ display: "grid", gridTemplateColumns: "1.2fr 1fr", gap: "10px 20px", fontSize: 13 }}>
                    <div><span style={{ color: C.muted }}>Supplier:</span></div>
                    <div><strong style={{ color: C.text }}>{slaContext.supplierName || selectedSupplier}</strong></div>

                    <div><span style={{ color: C.muted }}>Material:</span></div>
                    <div><strong style={{ color: C.text }}>{slaContext.materialLabel || selectedMaterial}</strong></div>

                    <div><span style={{ color: C.muted }}>Contract Lead Time:</span></div>
                    <div><strong style={{ color: C.text }}>{slaContext.leadTimeDays} days</strong></div>

                    <div><span style={{ color: C.muted }}>Pre-Negotiated Quantity:</span></div>
                    <div><strong style={{ color: C.text }}>{slaContext.quantity} units</strong></div>

                    <div><span style={{ color: C.muted }}>Contracted Unit Cost:</span></div>
                    <div><strong style={{ color: C.text }}>${slaContext.unit_cost.toFixed(2)}</strong></div>

                    <div><span style={{ color: C.muted }}>Supplier Reliability score:</span></div>
                    <div>
                      <strong style={{ color: slaContext.esgScore >= 70 ? C.green : C.orange }}>
                        {(slaContext.esgScore).toFixed(0)}/100
                      </strong>
                    </div>
                  </div>
                </div>

                <div style={{ textAlign: "center", color: C.muted, fontSize: 12, padding: "10px" }}>
                  Form fields pre-filled from this SLA contract. Adjust inputs if needed, then click "Evaluate Proposed Order Risk" to assess disruption risks.
                </div>
              </div>
            )}

            {evaluating && (
              <div style={{ textAlign: "center", padding: "80px 20px", color: C.accent, fontSize: 14 }}>
                <div style={{ fontSize: 24, marginBottom: 12 }} className="spin">⚙</div>
                <div>Fetching GraphDB SLA rules...</div>
                <div style={{ fontSize: 12, color: C.muted, marginTop: 4 }}>Calculating 109 interactive ML features</div>
              </div>
            )}

            {predictionResult && !evaluating && !loadingContext && (
              <div>
                {/* Reliability gauge */}
                <div style={{ padding: "16px 20px", background: C.bg, borderRadius: 10, border: `1px solid ${C.border}`, marginBottom: 16 }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
                    <span style={{ fontSize: 13, color: C.muted, fontWeight: 600 }}>On-Time Probability</span>
                    <span style={{ fontSize: 18, fontWeight: 800, color: predictionResult.risk_level === "High" ? C.red : C.green }}>
                      {(predictionResult.on_time_probability * 100).toFixed(1)}%
                    </span>
                  </div>
                  <div style={{ height: 8, background: C.border, borderRadius: 4, overflow: "hidden" }}>
                    <div style={{
                      height: "100%",
                      width: `${predictionResult.on_time_probability * 100}%`,
                      background: predictionResult.risk_level === "High" ? C.red : C.green,
                      borderRadius: 4
                    }} />
                  </div>
                </div>

                {/* Risk details */}
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 16 }}>
                  <div style={{ padding: "12px 14px", background: C.bg, borderRadius: 8, border: `1px solid ${C.border}` }}>
                    <div style={{ fontSize: 10, color: C.muted, marginBottom: 4, textTransform: "uppercase" }}>Risk Assessment</div>
                    <span style={S.riskBadge(predictionResult.risk_level === "High" ? "HIGH" : "LOW")}>
                      {predictionResult.risk_level === "High" ? "⚠️ HIGH RISK" : "✅ LOW RISK"}
                    </span>
                  </div>

                  <div style={{ padding: "12px 14px", background: C.bg, borderRadius: 8, border: `1px solid ${C.border}` }}>
                    <div style={{ fontSize: 10, color: C.muted, marginBottom: 4, textTransform: "uppercase" }}>Estimated Delay</div>
                    <span style={{ fontSize: 14, fontWeight: 700, color: predictionResult.risk_level === "High" ? C.red : C.textSoft }}>
                      {predictionResult.estimated_delay_hours > 0 ? `${predictionResult.estimated_delay_hours} hours` : "No Delay Predicted"}
                    </span>
                  </div>
                </div>

                {/* Explainability Features */}
                <div style={{ padding: "14px 16px", background: C.bg, borderRadius: 8, border: `1px solid ${C.border}`, marginBottom: 20 }}>
                  <div style={{ fontSize: 11, color: C.muted, fontWeight: 700, letterSpacing: "0.06em", textTransform: "uppercase", marginBottom: 10 }}>
                    🔍 Behind-the-Scenes SLA Rules & Context
                  </div>
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "8px 16px", fontSize: 12 }}>
                    {[
                      ["Contracted Lead Time", `${predictionResult.features_used.lead_time_days} days`],
                      ["Supplier ESG score", `${(predictionResult.features_used.supplier_esg_score).toFixed(0)}/100`],
                      ["Region & Terms", `${predictionResult.features_used.supplier_region} · ${predictionResult.features_used.payment_terms}`],
                      ["Order Line Value", `$${predictionResult.features_used.line_net.toLocaleString()}`],
                      ["Single Source?", predictionResult.features_used.single_source_flag || "No"],
                      ["Preferred Vendor?", predictionResult.features_used.preferred_supplier || "Yes"],
                    ].map(([label, val], idx) => (
                      <div key={idx} style={{ display: "flex", justifyContent: "space-between", borderBottom: `1px solid ${C.border}33`, paddingBottom: 4 }}>
                        <span style={{ color: C.muted }}>{label}</span>
                        <span style={{ color: C.text, fontWeight: 600 }}>{val}</span>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Place Order Trigger */}
                <button
                  onClick={handlePlaceOrder}
                  disabled={placing}
                  style={{
                    ...S.btn(predictionResult.risk_level === "High" ? "ghost" : "primary"),
                    width: "100%",
                    height: 44,
                    background: predictionResult.risk_level === "High" ? "rgba(239, 68, 68, 0.15)" : "#f59e0b",
                    color: predictionResult.risk_level === "High" ? C.red : "#000",
                    border: predictionResult.risk_level === "High" ? `1px solid ${C.red}44` : "none",
                  }}
                >
                  {placing ? (
                    <>
                      <span className="spin" style={{ display: "inline-block", marginRight: 6 }}>⚙</span> Placing Order...
                    </>
                  ) : predictionResult.risk_level === "High" ? (
                    "⚠ Force Place Order (High Risk)"
                  ) : (
                    "🛒 Confirm & Place Purchase Order"
                  )}
                </button>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
