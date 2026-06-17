// ============================================================
// services/api.js — Real Backend Integration
//
// All calls point to FastAPI on http://localhost:8001
// Falls back to mock data if the backend is unreachable.
// ============================================================

const BASE = "http://localhost:8001";

// ── Helpers ───────────────────────────────────────────────────────────────────

async function safeFetch(url, options = {}) {
  try {
    const res = await fetch(url, {
      ...options,
      headers: { "Content-Type": "application/json", ...(options.headers || {}) },
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({ detail: res.statusText }));
      throw new Error(err.detail || `HTTP ${res.status}`);
    }
    return await res.json();
  } catch (err) {
    if (err.name === "TypeError") {
      // Network error — backend not running
      throw new Error("BACKEND_OFFLINE");
    }
    throw err;
  }
}

// ── Mock fallbacks (shown when backend is offline) ────────────────────────────

import {
  kpiData, slaData, supplierData, inventoryRisks,
  ingestionLogs, fallbackMap,
} from "../data/mockData";

const MOCK_RISK_SCORES = inventoryRisks.map(r => ({
  product:  r.processes[0] || "Assembly Line",
  supplier: supplierData.find(s => s.id === r.supplierID)?.name || "Unknown",
  material: r.material,
  status:   r.trafficLight === "GREEN" ? "GREEN" : "RED",
}));

const MOCK_COMPLIANCE_ALERTS = slaData.filter(s => s.violationStatus).map(s => ({
  supplier:     s.supplier,
  material:     s.material,
  leadTimeDays: s.delayDays,
  penalty:      s.penalty,
}));

// ── Dashboard ─────────────────────────────────────────────────────────────────

// GET /api/dashboard/risk-scores
// Returns: { status, count, risk_scores: [{product, supplier, material, status:"RED"|"GREEN"}] }
export async function fetchRiskScores() {
  try {
    const data = await safeFetch(`${BASE}/api/dashboard/risk-scores`);
    return data.risk_scores || [];
  } catch (err) {
    if (err.message === "BACKEND_OFFLINE") return MOCK_RISK_SCORES;
    throw err;
  }
}

// GET /api/dashboard/compliance-alerts
// Returns: { status, count, alerts: [{supplier, material, leadTimeDays, penalty}] }
export async function fetchComplianceAlerts() {
  try {
    const data = await safeFetch(`${BASE}/api/dashboard/compliance-alerts`);
    return data.alerts || [];
  } catch (err) {
    if (err.message === "BACKEND_OFFLINE") return MOCK_COMPLIANCE_ALERTS;
    throw err;
  }
}

// GET /api/dashboard/fallback-options/{material_id}
// Returns: { status, count, material, suppliers: [{supplier, supplierName, reliabilityScore}] }
// material_id must match ontology URI fragment: "Lithium_Carbonate" not "Lithium Carbonate"
export async function fetchFallbackOptions(material) {
  const materialId = material.replace(/ /g, "_");
  try {
    const data = await safeFetch(`${BASE}/api/dashboard/fallback-options/${encodeURIComponent(materialId)}`);
    // Map backend fields to frontend shape
    return (data.suppliers || []).map(s => ({
      id:             s.supplier?.replace("http://example.org/ontology#", "") || s.supplierName,
      name:           s.supplierName || s.supplier,
      reliabilityScore: parseFloat(s.reliabilityScore) || 0,
      // Enrich with local data if available
      ...(() => {
        const local = supplierData.find(loc =>
          loc.name.toLowerCase().includes((s.supplierName || "").toLowerCase()) ||
          (s.supplier || "").includes(loc.id)
        );
        return local ? {
          score: local.score, onTime: local.onTime, leadTime: local.leadTime,
          capacity: local.capacity, country: local.country, countryCode: local.countryCode,
          risk: local.risk, tier: local.tier, certifications: local.certifications,
          emergency_cost: local.emergency_cost,
        } : {};
      })(),
    }));
  } catch (err) {
    if (err.message === "BACKEND_OFFLINE") {
      // Use local fallback map
      const ids = fallbackMap[material] || [];
      return supplierData
        .filter(s => ids.includes(s.id))
        .map(s => ({ ...s, reliabilityScore: s.score }));
    }
    throw err;
  }
}

// GET /api/sandbox/impacted-products
// Returns: { status, count, impacted_products: [{supplierLabel, materialLabel, productLabel, riskStatus}] }
export async function fetchImpactedProducts() {
  try {
    const data = await safeFetch(`${BASE}/api/sandbox/impacted-products`);
    return data.impacted_products || [];
  } catch (err) {
    if (err.message === "BACKEND_OFFLINE") return MOCK_RISK_SCORES;
    throw err;
  }
}

// ── AI Chat ───────────────────────────────────────────────────────────────────

// POST /api/dashboard/chat
// Body: { question: string }
// Returns: { status, answer, sparql, results, topic_accepted }
export async function sendChatMessage(question) {
  try {
    const data = await safeFetch(`${BASE}/api/dashboard/chat`, {
      method: "POST",
      body: JSON.stringify({ question }),
    });

    if (!data.topic_accepted) {
      return "I'm a Supply Chain assistant. I can only answer questions about deliveries, suppliers, materials, SLA agreements, and logistics. How can I help you?";
    }

    return data.answer || "I received your question but couldn't generate an answer. Please try rephrasing.";
  } catch (err) {
    if (err.message === "BACKEND_OFFLINE") {
      return getMockChatResponse(question);
    }
    throw err;
  }
}

function getMockChatResponse(question) {
  const q = question.toLowerCase();
  if (q.includes("lithium") || q.includes("rapidraw")) {
    return "⚠ CRITICAL — Lithium Carbonate (RapidRaw LLC)\n\nCurrent stock: 3 units (threshold: 10)\nPredicted delay: +8 days\nSLA violated: Clause 4.2 — Penalty $25,000/day\nTotal accrued: $200,000\n\nImpacted: Assembly Line B, Quality Control\n\nFallback: EuroMinerals GmbH (DE) — Score: 87 — Lead time: 8 days";
  }
  if (q.includes("sla") || q.includes("breach") || q.includes("violation")) {
    return "Active SLA Violations:\n\n🔴 SLA-005 — RapidRaw LLC\n   $25,000/day × 8 days = $200,000 owed\n\n🟠 SLA-002 — ChemSource Ltd.\n   $12,000/day × 4 days = $48,000 owed\n\nTotal penalties owed to your company: $248,000";
  }
  if (q.includes("fallback") || q.includes("alternative") || q.includes("supplier")) {
    return "Fallback Supplier Analysis\n\nFor Lithium Carbonate:\n• EuroMinerals GmbH — Score: 87 — Lead: 8d — Capacity: 75% ✅\n\nFor Polymer Resin P-9:\n• AlphaMetal Co. — Score: 88 — Lead: 6d ✅\n\n(Note: Connect backend for live Knowledge Graph data)";
  }
  return "⚠ Backend is offline — running in demo mode.\n\nIn production, I query the Knowledge Graph via SPARQL to answer questions about your supply chain in real time.\n\nTry asking about: suppliers, SLA violations, Lithium Carbonate, or delivery risks.";
}

// ── SLA Upload (2-step flow) ──────────────────────────────────────────────────

// Step 1: POST /api/sandbox/upload-pdf (multipart/form-data)
// Returns: { status, extraction_id, extracted_data: ExtractedSLAData, mapped_sla: SLAContract }
export async function uploadSLAPdf(file) {
  const form = new FormData();
  form.append("file", file);
  try {
    const res = await fetch(`${BASE}/api/sandbox/upload-pdf`, { method: "POST", body: form });
    if (!res.ok) {
      const err = await res.json().catch(() => ({ detail: res.statusText }));
      throw new Error(err.detail || `HTTP ${res.status}`);
    }
    return await res.json();
    // Returns:
    // {
    //   status: "success",
    //   extraction_id: "EXT-XXXXXXXXXXXX",
    //   extracted_data: {
    //     document_id, supplier_id, supplier_name, material,
    //     sla_lead_time_hours, delay_penalty_rate,
    //     missed_item_penalty_rate, minimum_quality_threshold, quality_penalty_rate
    //   },
    //   mapped_sla: { supplier_name, material, lead_time_days, penalty_clause }
    // }
  } catch (err) {
    if (err.name === "TypeError") {
      // Backend offline — return mock extraction
      return {
        status: "success",
        extraction_id: "EXT-DEMO123456",
        extracted_data: {
          document_id: "EXT-DEMO123456",
          supplier_id: "SUP_DEMO",
          supplier_name: "Demo Supplier Co.",
          material: "Demo Material",
          sla_lead_time_hours: 336,
          delay_penalty_rate: 25000,
          missed_item_penalty_rate: 500,
          minimum_quality_threshold: 0.95,
          quality_penalty_rate: 0.10,
        },
        mapped_sla: {
          supplier_name: "Demo Supplier Co.",
          material: "Demo Material",
          lead_time_days: 14,
          penalty_clause: "$25,000/day delay penalty after 48h grace period",
        },
        _offline: true,
      };
    }
    throw err;
  }
}

// Step 2: POST /api/sandbox/confirm-sla
// Body: ConfirmedSLA { extraction_id, supplier_name, material, lead_time_days, penalty_clause, corrections? }
// Returns: { status, extraction_id, supplier, material, graph, triples_inserted }
export async function confirmSLA(confirmedData) {
  try {
    const data = await safeFetch(`${BASE}/api/sandbox/confirm-sla`, {
      method: "POST",
      body: JSON.stringify(confirmedData),
    });
    return data;
  } catch (err) {
    if (err.message === "BACKEND_OFFLINE") {
      return {
        status: "success",
        extraction_id: confirmedData.extraction_id,
        supplier: confirmedData.supplier_name,
        material: confirmedData.material,
        graph: "OFFLINE_DEMO",
        triples_inserted: 3,
        _offline: true,
      };
    }
    throw err;
  }
}

// Direct SLA upload (no PDF): POST /api/sandbox/upload-sla
// Body: SLAContract { supplier_name, material, lead_time_days, penalty_clause }
export async function uploadSLADirect(contract) {
  try {
    return await safeFetch(`${BASE}/api/sandbox/upload-sla`, {
      method: "POST",
      body: JSON.stringify(contract),
    });
  } catch (err) {
    if (err.message === "BACKEND_OFFLINE") {
      return { status: "success", message: "Offline demo — contract not saved.", _offline: true };
    }
    throw err;
  }
}

// ── SLA Violations penalty helper (local, no backend needed) ─────────────────

export async function calculatePenalty(slaId, delayDays) {
  const sla = slaData.find(s => s.id === slaId);
  if (!sla) return null;
  const graceDays = 2;
  const billableDays = Math.max(0, delayDays - graceDays);
  return {
    slaId,
    delayDays,
    gracePeriodDays: graceDays,
    billableDays,
    dailyRate:    sla.penaltyDaily,
    totalPenalty: billableDays * sla.penaltyDaily,
    clause:       sla.clause,
  };
}

// ── Backend health check ──────────────────────────────────────────────────────

export async function checkBackendHealth() {
  try {
    const data = await safeFetch(`${BASE}/`);
    return { online: true, message: data.message };
  } catch {
    return { online: false, message: "Backend offline" };
  }
}
