// ============================================================
// services/api.js — Live Backend Only (no mock fallbacks)
// All data comes from FastAPI at http://localhost:8001
// ============================================================

import { slaData } from "../data/mockData";

const BASE = "http://localhost:8001";

async function safeFetch(url, options = {}) {
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
  return res.json();
}

// ── Dashboard ─────────────────────────────────────────────────────────────────

// GET /api/dashboard/risk-scores
export async function fetchRiskScores() {
  const data = await safeFetch(`${BASE}/api/dashboard/risk-scores`);
  return data.risk_scores || [];
}

// GET /api/dashboard/compliance-alerts
export async function fetchComplianceAlerts() {
  const data = await safeFetch(`${BASE}/api/dashboard/compliance-alerts`);
  return data.alerts || [];
}

// GET /api/dashboard/fallback-options/{material_id}
export async function fetchFallbackOptions(material) {
  const materialId = material.replace(/ /g, "_");
  const data = await safeFetch(
    `${BASE}/api/dashboard/fallback-options/${encodeURIComponent(materialId)}`
  );
  return data.suppliers || [];
}

// GET /api/sandbox/impacted-products
export async function fetchImpactedProducts() {
  const data = await safeFetch(`${BASE}/api/sandbox/impacted-products`);
  return data.impacted_products || [];
}

// ── AI Chat ───────────────────────────────────────────────────────────────────

// POST /api/dashboard/chat
export async function sendChatMessage(question) {
  const data = await safeFetch(`${BASE}/api/dashboard/chat`, {
    method: "POST",
    body: JSON.stringify({ question }),
  });
  if (!data.topic_accepted) {
    return "I'm a Supply Chain assistant. I can only answer questions about deliveries, suppliers, materials, SLA agreements, and logistics.";
  }
  return data.answer || "No answer returned from the model.";
}

// ── SLA Upload — Step 1 ───────────────────────────────────────────────────────

// POST /api/sandbox/upload-pdf
export async function uploadSLAPdf(file) {
  const form = new FormData();
  form.append("file", file);
  const res = await fetch(`${BASE}/api/sandbox/upload-pdf`, {
    method: "POST",
    body: form,
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: res.statusText }));
    throw new Error(err.detail || `Upload failed: HTTP ${res.status}`);
  }
  return res.json();
}

// ── SLA Upload — Step 2 ───────────────────────────────────────────────────────

// POST /api/sandbox/confirm-sla
export async function confirmSLA(confirmedData) {
  return safeFetch(`${BASE}/api/sandbox/confirm-sla`, {
    method: "POST",
    body: JSON.stringify(confirmedData),
  });
}

// ── Penalty Calculator (local calculation, no backend needed) ─────────────────

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
    const res = await fetch(`${BASE}/`, {
      signal: AbortSignal.timeout(3000),
    });
    if (res.ok) {
      const data = await res.json().catch(() => ({}));
      return { online: true, message: data.message || "OK" };
    }
    return { online: false, message: "Backend error" };
  } catch {
    return { online: false, message: "Backend offline" };
  }
}
