# ============================================================
# services/dashboard_service.py — Layer 2: Dashboard Logic
#
# Thin service layer that wraps knowledge_base repository
# functions and SPARQL query building for the dashboard API.
# API endpoints MUST NOT import knowledge_base directly.
# ============================================================

import logging

from knowledge_base.connection import graphdb
from knowledge_base.repository import (
    PREFIXES,
    _sanitize_uri_fragment,
    find_impacted_products_by_supplier_delay,
)

logger = logging.getLogger(__name__)


def get_risk_scores() -> list[dict]:
    """
    Returns risk scores including reliabilityScore so Suppliers page bars render.
    """
    # First get the impacted products (at-risk items)
    impacted = find_impacted_products_by_supplier_delay()
    impacted_suppliers = {r.get("supplierLabel", "") for r in impacted}

    # Also query all suppliers with their reliability scores
    q_all = f"""
    {PREFIXES}
    SELECT DISTINCT ?supplierName ?materialName ?productName ?reliabilityScore
    WHERE {{
        ?supplier rdf:type :Supplier ;
                  :supplies ?material .
        ?material rdf:type :RawMaterial .
        OPTIONAL {{ ?supplier rdfs:label ?sLabel . }}
        OPTIONAL {{ ?supplier :hasName ?sName . }}
        BIND(COALESCE(?sLabel, ?sName, REPLACE(STR(?supplier), "^.*#", "")) AS ?supplierName)
        OPTIONAL {{ ?material rdfs:label ?mLabel . }}
        BIND(COALESCE(?mLabel, REPLACE(STR(?material), "^.*#", "")) AS ?materialName)
        OPTIONAL {{
            ?material :affectsProcess ?process .
            OPTIONAL {{ ?process rdfs:label ?pLabel . }}
            BIND(COALESCE(?pLabel, REPLACE(STR(?process), "^.*#", "")) AS ?productName)
        }}
        OPTIONAL {{ ?supplier :hasReliabilityScore ?reliabilityScore . }}
    }}
    """
    all_rows = graphdb.execute_sparql_select(q_all)

    risk_scores = []
    for row in all_rows:
        supplier_name = row.get("supplierName", "Unknown")
        is_red = supplier_name in impacted_suppliers
        risk_scores.append({
            "supplier":         supplier_name,
            "supplierLabel":    supplier_name,
            "material":         row.get("materialName", "Unknown"),
            "materialLabel":    row.get("materialName", "Unknown"),
            "product":          row.get("productName", ""),
            "productLabel":     row.get("productName", ""),
            "status":           "RED" if is_red else "GREEN",
            "reliabilityScore": row.get("reliabilityScore", None),
        })
    return risk_scores


def get_compliance_alerts() -> list[dict]:
    """
    Returns enriched SLA data including compliance %, deadline, risk level,
    numeric penaltyRate and clause so the SLA Violations page renders fully.
    """
    query = f"""
    {PREFIXES}
    SELECT DISTINCT ?supplierName ?materialName ?leadTimeDays ?penalty
                    ?complianceRate ?deliveryDeadline ?riskLevel ?penaltyRate ?clause
    WHERE {{
        ?supplier rdf:type :Supplier ;
                  :supplies ?material .
        ?material rdf:type :RawMaterial .

        OPTIONAL {{ ?supplier rdfs:label ?sLabel . }}
        OPTIONAL {{ ?supplier :hasName ?sName . }}
        BIND(COALESCE(?sLabel, ?sName, REPLACE(STR(?supplier), "^.*#", "")) AS ?supplierName)

        OPTIONAL {{ ?material rdfs:label ?mLabel . }}
        BIND(COALESCE(?mLabel, REPLACE(STR(?material), "^.*#", "")) AS ?materialName)

        OPTIONAL {{ ?supplier :leadTimeDays ?leadTimeDays . }}
        OPTIONAL {{ ?supplier :penaltyClause ?penalty . }}
        OPTIONAL {{ ?supplier :complianceRate ?complianceRate . }}
        OPTIONAL {{ ?supplier :deliveryDeadline ?deliveryDeadline . }}
        OPTIONAL {{ ?material :deliveryDeadline ?materialDeadline . }}
        OPTIONAL {{ ?supplier :riskLevel ?riskLevel . }}
        OPTIONAL {{ ?supplier :penaltyRatePerDay ?penaltyRate . }}
        OPTIONAL {{ ?supplier :clause ?clause . }}
    }}
    ORDER BY ?supplierName
    """
    rows = graphdb.execute_sparql_select(query)

    alerts = []
    for row in rows:
        # compliance: stored as 0-1 float → convert to 0-100 int for frontend
        raw_compliance = row.get("complianceRate")
        if raw_compliance is not None:
            compliance_val = float(raw_compliance)
            compliance = int(compliance_val * 100) if compliance_val <= 1.0 else int(compliance_val)
        else:
            compliance = None

        # leadTimeDays as int
        lead_days = int(float(row.get("leadTimeDays", 0) or 0))

        # penaltyRate as numeric
        penalty_rate = float(row.get("penaltyRate", 0) or 0)

        # deadline: prefer material-level, fall back to supplier-level
        deadline = row.get("deliveryDeadline", row.get("materialDeadline", "—")) or "—"

        # risk: use stored value or derive from compliance
        risk = row.get("riskLevel")
        if not risk:
            if compliance is not None:
                risk = "CRITICAL" if compliance < 50 else "HIGH" if compliance < 70 else "MEDIUM" if compliance < 85 else "LOW"
            else:
                risk = "MEDIUM"

        # clause
        clause = row.get("clause", row.get("penalty", "—")) or "—"

        # penalty display string
        penalty_display = row.get("penalty", "")
        if not penalty_display and penalty_rate > 0:
            penalty_display = f"${penalty_rate:,.0f}/day"

        alerts.append({
            "supplier":        row.get("supplierName", "Unknown"),
            "supplierLabel":   row.get("supplierName", "Unknown"),
            "material":        row.get("materialName", "Unknown"),
            "materialLabel":   row.get("materialName", "Unknown"),
            "leadTimeDays":    lead_days,
            "delayDays":       lead_days,
            "penalty":         penalty_display,
            "penaltyRate":     penalty_rate,
            "compliance":      compliance,
            "deadline":        deadline,
            "risk":            risk,
            "clause":          clause,
            "violationStatus": lead_days > 0,
        })
    return alerts


def get_impacted_products() -> list[dict]:
    return find_impacted_products_by_supplier_delay()


def get_fallback_options(material_id: str) -> list[dict]:
    safe_material = _sanitize_uri_fragment(material_id)
    query = f"""
    {PREFIXES}
    SELECT DISTINCT ?supplier ?supplierName ?reliabilityScore
    WHERE {{
        ?supplier rdf:type :AlternativeSupplier ;
                  :supplies :{safe_material} .
        OPTIONAL {{ ?supplier rdfs:label ?label . }}
        BIND(COALESCE(?label, REPLACE(STR(?supplier), "^.*#", "")) AS ?supplierName)
        OPTIONAL {{ ?supplier :hasReliabilityScore ?reliabilityScore . }}
    }}
    ORDER BY DESC(?reliabilityScore)
    """
    return graphdb.execute_sparql_select(query)


def get_kpis() -> dict:
    """
    Derive KPI summary values from the Knowledge Graph.
    Returns a dict with keys expected by fetchKPIs() on the frontend:
      active_suppliers, at_risk_shipments, sla_compliance,
      avg_delay, total_penalties, alerts_48h
    """
    # Count total distinct suppliers
    q_suppliers = f"""
    {PREFIXES}
    SELECT (COUNT(DISTINCT ?supplier) AS ?count)
    WHERE {{ ?supplier rdf:type :Supplier . }}
    """
    rows_sup = graphdb.execute_sparql_select(q_suppliers)
    active_suppliers = int(rows_sup[0].get("count", 0)) if rows_sup else 0

    # Count at-risk materials (where delay flag is true)
    q_risk = f"""
    {PREFIXES}
    SELECT (COUNT(DISTINCT ?material) AS ?count)
    WHERE {{
        ?material rdf:type :RawMaterial .
        ?delivery rdf:type :Delivery ;
                  :delivers ?material ;
                  :isDelayed true .
    }}
    """
    rows_risk = graphdb.execute_sparql_select(q_risk)
    at_risk_shipments = int(rows_risk[0].get("count", 0)) if rows_risk else 0

    # Average lead time across all suppliers (proxy for avg delay)
    q_lead = f"""
    {PREFIXES}
    SELECT (AVG(?leadTimeDays) AS ?avgLead)
    WHERE {{
        ?supplier rdf:type :Supplier ;
                  :leadTimeDays ?leadTimeDays .
    }}
    """
    rows_lead = graphdb.execute_sparql_select(q_lead)
    avg_delay = round(float(rows_lead[0].get("avgLead", 0) or 0), 1) if rows_lead else 0.0

    # Count suppliers with penaltyClause defined (proxy for SLA contracts)
    q_penalty = f"""
    {PREFIXES}
    SELECT (COUNT(DISTINCT ?supplier) AS ?count)
    WHERE {{
        ?supplier rdf:type :Supplier ;
                  :penaltyClause ?penalty .
    }}
    """
    rows_pen = graphdb.execute_sparql_select(q_penalty)
    sla_contracts = int(rows_pen[0].get("count", 0)) if rows_pen else 0

    # SLA compliance = % of suppliers NOT at risk (simple heuristic)
    sla_compliance = (
        round(((active_suppliers - at_risk_shipments) / active_suppliers) * 100)
        if active_suppliers > 0 else 100
    )

    return {
        # Keys match EXACTLY what Dashboard.jsx buildKpiCards() reads:
        "active_suppliers":  active_suppliers,
        "at_risk_shipments": at_risk_shipments,
        "sla_compliance":    sla_compliance,
        "avg_lead_time":     avg_delay,       # Dashboard reads kpis.avg_lead_time
        "total_penalty":     sla_contracts,   # Dashboard reads kpis.total_penalty
        "alert_count":       at_risk_shipments,  # Dashboard reads kpis.alert_count
    }


def get_alerts() -> list[dict]:
    """
    Build alert objects from at-risk materials in the Knowledge Graph.
    Returns a list matching the shape expected by the Alerts page:
      id, icon, type, category, title, desc, time, date, unread, from, roles
    """
    results = find_impacted_products_by_supplier_delay()
    alerts = []
    for i, row in enumerate(results):
        material = row.get("materialLabel", row.get("material", "Unknown Material"))
        supplier = row.get("supplierLabel", row.get("supplier", "Unknown Supplier"))
        product  = row.get("productLabel",  row.get("product",  ""))
        is_risk  = str(row.get("riskStatus", "false")).lower() == "true"

        alert_type = "CRITICAL" if is_risk else "INFO"
        icon       = "🔴" if is_risk else "🔵"
        category   = "Inventory" if is_risk else "System"
        title      = (
            f"At-Risk Material — {material}"
            if is_risk
            else f"Monitored Material — {material}"
        )
        desc = (
            f"Supplier {supplier} has a delayed delivery for {material}."
            + (f" Impacted process: {product}." if product else "")
            + (" Immediate action recommended." if is_risk else "")
        )

        alerts.append({
            "id":       i + 1,
            "icon":     icon,
            "type":     alert_type,
            "category": category,
            "title":    title,
            "desc":     desc,
            "time":     "Live",
            "date":     "Knowledge Graph",
            "unread":   is_risk,
            "from":     None,
            "fromRole": None,
            "roles":    ["admin", "logistics", "procurement", "production"],
        })
    return alerts

