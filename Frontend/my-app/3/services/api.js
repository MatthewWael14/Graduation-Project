// ============================================================
// services/api.js — Real Backend Integration
// All imports MUST be at the top of the file.
// Falls back to mock data if backend is unreachable.
// ============================================================

import {
  slaData,
  supplierData,
  inventoryRisks,
  fallbackMap,
} from "../data/mockData";

const BASE = "http://localhost:8001";

// ── Helpers ───────────────────────────────────────────────────────────────────

async function safeFetch(url, options = {}) {
  try {
    const res = await fetch(url, {
      ...options,
      headers: {
        "Content-Type": "application/json",
        ...(options.headers || {}),
      },
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

// ── Mock fallback data ────────────────────────────────────────────────────────

const MOCK_RISK_SCORES = inventoryRisks.map(r => ({
  product:  r.processes[0] || "Assembly Line",
  supplier: supplierData.find(s => s.id === r.supplierID)?.name || "Unknown",
  material: r.material,
  status:   r.trafficLight === "GREEN" ? "GREEN" : "RED",
}));

const MOCK_COMPLIANCE_ALERTS = slaData
  .filter(s => s.violationStatus)
  .map(s => ({
    supplier:     s.supplier,
    material:     s.material,
    leadTimeDays: s.delayDays,
    penalty:      s.penalty,
  }));

// ── Dashboard ─────────────────────────────────────────────────────────────────

// GET /api/dashboard/risk-scores
// Returns: { status, count, risk_scores: [{product, supplier, material, status}] }
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
// material_id uses underscores: "Lithium_Carbonate"
export async function fetchFallbackOptions(material) {
  const materialId = material.replace(/ /g, "_");
  try {
    const data = await safeFetch(
      `${BASE}/api/dashboard/fallback-options/${encodeURIComponent(materialId)}`
    );

    return (data.suppliers || []).map(s => {
      // Try to enrich with local supplier data
      const local = supplierData.find(loc =>
        loc.name.toLowerCase().includes(
          (s.supplierName || "").toLowerCase().split(" ")[0]
        ) ||
        (s.supplier || "").includes(loc.id)
      );
      return {
        id:              s.supplier?.replace("http://example.org/ontology#", "") || s.supplierName,
        name:            s.supplierName || s.supplier || "Unknown",
        reliabilityScore: parseFloat(s.reliabilityScore) || 0,
        score:           local?.score || Math.round(parseFloat(s.reliabilityScore) * 100) || 70,
        onTime:          local?.onTime || 80,
        leadTime:        local?.leadTime || 10,
        capacity:        local?.capacity || 70,
        country:         local?.country || "Unknown",
        countryCode:     local?.countryCode || "??",
        risk:            local?.risk || "MEDIUM",
        tier:            local?.tier || "MEDIUM",
        certifications:  local?.certifications || [],
        emergency_cost:  local?.emergency_cost || 1.5,
      };
    });
  } catch (err) {
    if (err.message === "BACKEND_OFFLINE") {
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
    if (err.message === "BACKEND_OFFLINE") return [];
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
      return (
        "I'm a Supply Chain assistant. I can only answer questions about " +
        "deliveries, suppliers, materials, SLA agreements, and logistics. " +
        "How can I help you?"
      );
    }

    return (
      data.answer ||
      "I received your question but couldn't generate an answer. Please try rephrasing."
    );
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
    return (
      "⚠ CRITICAL — Lithium Carbonate (RapidRaw LLC)\n\n" +
      "Current stock: 3 units (threshold: 10)\n" +
      "Predicted delay: +8 days\n" +
      "SLA violated: Clause 4.2 — Penalty $25,000/day\n" +
      "Total accrued: $200,000\n\n" +
      "Impacted: Assembly Line B, Quality Control\n\n" +
      "Fallback: EuroMinerals GmbH (DE) — Score: 87 — Lead time: 8 days"
    );
  }
  if (q.includes("sla") || q.includes("breach") || q.includes("violation")) {
    return (
      "Active SLA Violations:\n\n" +
      "🔴 SLA-005 — RapidRaw LLC\n" +
      "   $25,000/day × 8 days = $200,000 owed\n\n" +
      "🟠 SLA-002 — ChemSource Ltd.\n" +
      "   $12,000/day × 4 days = $48,000 owed\n\n" +
      "Total penalties owed to your company: $248,000"
    );
  }
  if (q.includes("fallback") || q.includes("alternative") || q.includes("supplier")) {
    return (
      "Fallback Supplier Analysis\n\n" +
      "For Lithium Carbonate:\n" +
      "• EuroMinerals GmbH — Score: 87 — Lead: 8d — Capacity: 75% ✅\n\n" +
      "For Polymer Resin P-9:\n" +
      "• AlphaMetal Co. — Score: 88 — Lead: 6d ✅\n\n" +
      "(Note: Connect backend for live Knowledge Graph data)"
    );
  }
  if (q.includes("delay") || q.includes("impact") || q.includes("production")) {
    return (
      "Production Impact Analysis\n\n" +
      "Critical materials causing delays:\n" +
      "• Lithium Carbonate → Assembly Line B, Quality Control (8 day halt)\n" +
      "• Polymer Resin P-9 → Casing Mold Line, Packaging (+5 days)\n\n" +
      "Recommendation: Activate fallback suppliers immediately."
    );
  }
  return (
    "⚠ Backend is offline — running in demo mode.\n\n" +
    "In production, I query the Knowledge Graph via SPARQL to answer " +
    "questions about your supply chain in real time.\n\n" +
    "Try asking about:\n" +
    "• Lithium Carbonate delays\n" +
    "• SLA violations and penalties\n" +
    "• Fallback supplier options\n" +
    "• Production impact analysis"
  );
}

// ── SLA Upload — Step 1 ───────────────────────────────────────────────────────

// POST /api/sandbox/upload-pdf (multipart/form-data, no JSON content-type header)
// Returns: { status, extraction_id, extracted_data, mapped_sla }
export async function uploadSLAPdf(file) {
  const form = new FormData();
  form.append("file", file);

  try {
    const res = await fetch(`${BASE}/api/sandbox/upload-pdf`, {
      method: "POST",
      body: form,
      // Do NOT set Content-Type header — browser sets it with boundary automatically
    });

    if (!res.ok) {
      const err = await res.json().catch(() => ({ detail: res.statusText }));
      throw new Error(err.detail || `Upload failed: HTTP ${res.status}`);
    }

    return await res.json();
  } catch (err) {
    if (err.name === "TypeError") {
      // Backend offline — return mock extraction for demo
      return {
        status: "success",
        extraction_id: "EXT-DEMO123456",
        extracted_data: {
          document_id:               "EXT-DEMO123456",
          supplier_id:               "SUP_DEMO",
          supplier_name:             "Demo Supplier Co.",
          material:                  "Demo Material",
          sla_lead_time_hours:       336,
          delay_penalty_rate:        25000,
          missed_item_penalty_rate:  500,
          minimum_quality_threshold: 0.95,
          quality_penalty_rate:      0.10,
        },
        mapped_sla: {
          supplier_name:   "Demo Supplier Co.",
          material:        "Demo Material",
          lead_time_days:  14,
          penalty_clause:  "$25,000/day delay penalty after 48h grace period",
        },
        _offline: true,
      };
    }
    throw err;
  }
}

// ── SLA Upload — Step 2 ───────────────────────────────────────────────────────

// POST /api/sandbox/confirm-sla
// Body: ConfirmedSLA { extraction_id, supplier_name, material, lead_time_days, penalty_clause, corrections? }
// Returns: { status, extraction_id, supplier, material, graph, triples_inserted }
export async function confirmSLA(confirmedData) {
  try {
    return await safeFetch(`${BASE}/api/sandbox/confirm-sla`, {
      method: "POST",
      body: JSON.stringify(confirmedData),
    });
  } catch (err) {
    if (err.message === "BACKEND_OFFLINE") {
      return {
        status:           "success",
        extraction_id:    confirmedData.extraction_id,
        supplier:         confirmedData.supplier_name,
        material:         confirmedData.material,
        graph:            "OFFLINE_DEMO",
        triples_inserted: 3,
        _offline:         true,
      };
    }
    throw err;
  }
}

// ── Penalty Calculator (local, no backend needed) ─────────────────────────────

export async function calculatePenalty(slaId, delayDays) {
  const sla = slaData.find(s => s.id === slaId);
  if (!sla) return null;
  const graceDays    = 2;
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
    const res = await fetch(`${BASE}/`, { signal: AbortSignal.timeout(3000) });
    if (res.ok) {
      const data = await res.json().catch(() => ({}));
      return { online: true, message: data.message || "OK" };
    }
    return { online: false, message: "Backend returned error" };
  } catch {
    return { online: false, message: "Backend offline" };
  }
}
