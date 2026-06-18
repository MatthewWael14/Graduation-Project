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
    PREFIXES,
    _sanitize_uri_fragment,
    find_impacted_products_by_supplier_delay,
)
import hashlib

logger = logging.getLogger(__name__)


def get_risk_scores() -> list[dict]:
    """
    Returns risk scores including reliabilityScore so Suppliers page bars render.
    """
    impacted = find_impacted_products_by_supplier_delay()
    
    # Also query all suppliers with their reliability scores, lead times, and countries
    q_all = f"""
    {PREFIXES}
    SELECT DISTINCT ?supplierName ?materialName ?productName ?reliabilityScore ?leadTimeDays ?country
    WHERE {{
        ?supplier rdf:type :Supplier ;
                  :supplies ?material .
        FILTER NOT EXISTS {{ ?supplier rdf:type :AlternativeSupplier . }}
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
        OPTIONAL {{ ?supplier :leadTimeDays ?leadTimeDays . }}
        OPTIONAL {{ ?supplier :country ?country . }}
    }}
    """
    all_rows = graphdb.execute_sparql_select(q_all)

    risk_scores = []
    seen_materials = set()
    
    # First, guarantee all RED impacted items are added
    for r in impacted:
        mat_name = r.get("materialLabel", "Unknown")
        sup_name = r.get("supplierLabel", "Unknown")
        risk_scores.append({
            "material":         mat_name,
            "materialLabel":    mat_name,
            "supplier":         sup_name,
            "supplierLabel":    sup_name,
            "product":          r.get("productLabel", ""),
            "productLabel":     r.get("productLabel", ""),
            "status":           "RED",
            "reliabilityScore": None,
            "leadTime":         None,
            "country":          None,
        })
        seen_materials.add(mat_name)

    # Then add the GREEN ones from all_rows, and enrich the RED ones if we found matching supplier data
    for row in all_rows:
        mat_name = row.get("materialName", "Unknown")
        sup_name = row.get("supplierName", "Unknown")
        
        if mat_name in seen_materials:
            # Enrich ONLY the matching supplier entry (match by both material AND supplier name)
            for rs in risk_scores:
                if rs["material"] == mat_name and rs["supplierLabel"] == sup_name:
                    if not rs["reliabilityScore"]:
                        rs["reliabilityScore"] = row.get("reliabilityScore")
                    if not rs["leadTime"]:
                        rs["leadTime"] = row.get("leadTimeDays")
                    if not rs["country"]:
                        rs["country"] = row.get("country")
            continue
            
        risk_scores.append({
            "material":         mat_name,
            "materialLabel":    mat_name,
            "supplier":         sup_name,
            "supplierLabel":    sup_name,
            "product":          row.get("productName", ""),
            "productLabel":     row.get("productName", ""),
            "status":           "GREEN",
            "reliabilityScore": row.get("reliabilityScore", None),
            "leadTime":         row.get("leadTimeDays", None),
            "country":          row.get("country", None),
        })
        seen_materials.add(mat_name)

    return risk_scores


def get_compliance_alerts() -> list[dict]:
    """
    Returns enriched SLA data including compliance %, deadline, risk level,
    numeric penaltyRate and clause so the SLA Violations page renders fully.
    """
    query = f"""
    {PREFIXES}
    SELECT DISTINCT ?supplierName ?materialName ?leadTimeDays ?penalty
                    ?reliabilityScore ?deliveryDeadline ?riskLevel ?penaltyRate ?clause
    WHERE {{
        ?supplier rdf:type :Supplier ;
                  :supplies ?material .
        FILTER NOT EXISTS {{ ?supplier rdf:type :AlternativeSupplier . }}
        ?material rdf:type :RawMaterial .

        OPTIONAL {{ ?supplier rdfs:label ?sLabel . }}
        OPTIONAL {{ ?supplier :hasName ?sName . }}
        BIND(COALESCE(?sLabel, ?sName, REPLACE(STR(?supplier), "^.*#", "")) AS ?supplierName)

        OPTIONAL {{ ?material rdfs:label ?mLabel . }}
        BIND(COALESCE(?mLabel, REPLACE(STR(?material), "^.*#", "")) AS ?materialName)

        OPTIONAL {{ ?supplier :leadTimeDays ?leadTimeDays . }}
        OPTIONAL {{ ?supplier :penaltyClause ?penalty . }}
        OPTIONAL {{ ?supplier :hasReliabilityScore ?reliabilityScore . }}
        OPTIONAL {{ ?supplier :deliveryDeadline ?deliveryDeadline . }}
        OPTIONAL {{ ?material :deliveryDeadline ?materialDeadline . }}
        OPTIONAL {{ ?supplier :riskLevel ?riskLevel . }}
        OPTIONAL {{ ?supplier :penaltyRatePerDay ?penaltyRate . }}
        OPTIONAL {{ ?supplier :clause ?clause . }}
        OPTIONAL {{ ?supplier :createdAt ?createdAt . }}
    }}
    ORDER BY ?createdAt ?supplierName
    """
    rows = graphdb.execute_sparql_select(query)
    
    impacted = find_impacted_products_by_supplier_delay()
    supplier_delay_map = {}
    for r in impacted:
        sup = r.get("supplierLabel", "")
        delay_hrs = float(r.get("delayHours", 0) or 0)
        if sup:
            # Convert hours to days, fallback to 1 if delayed but no hours found
            supplier_delay_map[sup] = int(delay_hrs / 24) if delay_hrs > 0 else 1

    alerts = []
    for row in rows:
        supplier_name = row.get("supplierName", "Unknown")
        is_delayed = supplier_name in supplier_delay_map
        actual_delay_days = supplier_delay_map.get(supplier_name, 0)

        # leadTimeDays as int
        lead_days = int(float(row.get("leadTimeDays", 0) or 0))

        # SLA Compliance strictly evaluates contract adherence based on active breaches.
        # If there is no delay, the contract is 100% compliant.
        # If breached, compliance drops proportionally to the severity of the delay.
        if actual_delay_days == 0:
            compliance = 100
        else:
            if lead_days > 0:
                severity = actual_delay_days / lead_days
                compliance = max(0, int((1.0 - severity) * 100))
            else:
                compliance = 0  # 0% if delayed and no baseline lead time is established

        # penaltyRate as numeric
        penalty_rate = float(row.get("penaltyRate", 0) or 0)

        # deadline: prefer material-level, fall back to supplier-level
        deadline = row.get("deliveryDeadline", row.get("materialDeadline", "—")) or "—"

        # risk: use stored value or derive from compliance, fallback to HIGH/LOW if delayed
        risk = row.get("riskLevel")
        if not risk:
            if compliance is not None:
                risk = "CRITICAL" if compliance < 50 else "HIGH" if compliance < 70 else "MEDIUM" if compliance < 85 else "LOW"
            else:
                risk = "HIGH" if is_delayed else "LOW"

        # clause
        clause = row.get("clause", row.get("penalty", "—")) or "—"

        # penalty display string
        penalty_display = row.get("penalty", "")
        if not penalty_display and penalty_rate > 0:
            penalty_display = f"${penalty_rate:,.0f}/day"
            
        supplier_name = row.get("supplierName", "Unknown")

        alerts.append({
            "supplier":        supplier_name,
            "supplierLabel":   supplier_name,
            "material":        row.get("materialName", "Unknown"),
            "materialLabel":   row.get("materialName", "Unknown"),
            "leadTimeDays":    lead_days,
            "delayDays":       actual_delay_days,
            "penalty":         penalty_display,
            "penaltyRate":     penalty_rate,
            "compliance":      compliance,
            "deadline":        deadline,
            "risk":            risk,
            "clause":          clause,
            "violationStatus": is_delayed,
        })
    return alerts


def get_impacted_products() -> list[dict]:
    return find_impacted_products_by_supplier_delay()


def get_fallback_options(material_id: str) -> list[dict]:
    safe_material = _sanitize_uri_fragment(material_id)
    material_escaped = material_id.replace('"', '\\"')
    # IMPORTANT: Only return :AlternativeSupplier nodes.
    # Filtering to this type ensures:
    #   (a) The currently-delayed primary supplier never appears in the list.
    #   (b) Suppliers promoted via previous assignments don't bleed across materials.
    query = f"""
    {PREFIXES}
    SELECT DISTINCT ?supplier ?supplierName ?reliabilityScore ?leadTimeDays ?country
    WHERE {{
        # Only genuine alternative suppliers — never the broken primary
        ?supplier rdf:type :AlternativeSupplier .

        # Find the material by exact label or sanitized URI fragment
        ?mat rdf:type :RawMaterial .
        OPTIONAL {{ ?mat rdfs:label ?matLabel . }}
        FILTER(
            STR(?matLabel) = "{material_escaped}"
            || REPLACE(STR(?mat), "^.*#", "") = "{safe_material}"
        )

        # The alternative supplier MUST be linked to this material
        {{ ?supplier :supplies ?mat . }}
        UNION
        {{ ?mat :isSuppliedBy ?supplier . }}

        OPTIONAL {{ ?supplier rdfs:label ?label . }}
        OPTIONAL {{ ?supplier :hasName ?name . }}
        BIND(COALESCE(?label, ?name, REPLACE(STR(?supplier), "^.*#", "")) AS ?supplierName)
        OPTIONAL {{ ?supplier :hasReliabilityScore ?reliabilityScore . }}
        OPTIONAL {{ ?supplier :leadTimeDays ?leadTimeDays . }}
        OPTIONAL {{ ?supplier :country ?country . }}
    }}
    ORDER BY DESC(?reliabilityScore)
    """
    rows = graphdb.execute_sparql_select(query)

    options = []
    for row in rows:
        options.append({
            "supplier":         row.get("supplier"),
            "supplierName":     row.get("supplierName"),
            "reliabilityScore": row.get("reliabilityScore"),
            "leadTime":         row.get("leadTimeDays"),
            "country":          row.get("country"),
        })
    return options

def assign_fallback_supplier(material_name: str, supplier_name: str, assignment_type: str) -> dict:
    """
    Persist a fallback assignment in the Knowledge Graph by inserting
    an RDF triple linking the alternate supplier to the material.
    Uses label-based lookup to avoid SPARQL syntax errors from special chars in names.
    """
    from knowledge_base.repository import CONTRACT_GRAPH

    mat_esc = material_name.replace('"', '\\"')
    sup_esc = supplier_name.replace('"', '\\"')
    safe_mat = _sanitize_uri_fragment(material_name)
    safe_sup = _sanitize_uri_fragment(supplier_name)

    # Step 1: look up the actual material + supplier + delivery URIs by label
    lookup_q = f"""
    {PREFIXES}
    SELECT ?mat ?sup ?delivery WHERE {{
        OPTIONAL {{
            ?mat rdf:type :RawMaterial .
            OPTIONAL {{ ?mat rdfs:label ?ml . }}
            FILTER(STR(?ml) = "{mat_esc}" || REPLACE(STR(?mat), "^.*#", "") = "{safe_mat}")
        }}
        OPTIONAL {{
            ?sup rdf:type ?st .
            FILTER(?st IN (:Supplier, :AlternativeSupplier))
            OPTIONAL {{ ?sup rdfs:label ?sl . }}
            FILTER(STR(?sl) = "{sup_esc}" || REPLACE(STR(?sup), "^.*#", "") = "{safe_sup}")
        }}
        OPTIONAL {{
            ?delivery rdf:type :DeliveryEvent ;
                      :hasDeliveryStatus "Delayed" .
            OPTIONAL {{ ?mat rdf:type :RawMaterial . }}
            ?delivery :transports ?mat .
            OPTIONAL {{ ?mat rdfs:label ?ml2 . }}
            FILTER(STR(?ml2) = "{mat_esc}" || REPLACE(STR(?mat), "^.*#", "") = "{safe_mat}")
        }}
    }} LIMIT 1
    """
    rows = graphdb.execute_sparql_select(lookup_q)
    mat_uri_full = rows[0].get("mat") if rows else None
    sup_uri_full = rows[0].get("sup") if rows else None
    delivery_uri_full = rows[0].get("delivery") if rows else None

    mat_ref = f"<{mat_uri_full}>" if mat_uri_full else f":{safe_mat}"
    sup_ref = f"<{sup_uri_full}>" if sup_uri_full else f":{safe_sup}"

    # Step 2: Record the assignment — deliberately do NOT add rdf:type :Supplier.
    # Adding :Supplier to an AlternativeSupplier node pollutes the primary-supplier
    # queries (get_risk_scores, get_compliance_alerts) and causes alternatives to
    # appear as primary suppliers with a GREEN status, hiding the real delayed ones.
    insert_q = f"""
    {PREFIXES}
    INSERT DATA {{
        GRAPH <{CONTRACT_GRAPH}> {{
            {sup_ref} :supplies {mat_ref} ;
                      :hasAssignmentType "{assignment_type}" .
        }}
    }}
    """
    graphdb.execute_sparql_update(insert_q)

    # Step 3: Update the delivery status in whatever graph it lives in
    if delivery_uri_full:
        # Use the exact delivery URI for a graph-agnostic update
        status_q = f"""
    {PREFIXES}
    DELETE {{
        GRAPH ?g {{ <{delivery_uri_full}> :hasDeliveryStatus "Delayed" . }}
    }}
    INSERT {{
        GRAPH ?g {{ <{delivery_uri_full}> :hasDeliveryStatus "Resolved" . }}
    }}
    WHERE {{
        GRAPH ?g {{
            <{delivery_uri_full}> :hasDeliveryStatus "Delayed" .
        }}
    }}
        """
        graphdb.execute_sparql_update(status_q)

    return {
        "status": "success",
        "material": material_name,
        "assigned_supplier": supplier_name,
        "type": assignment_type
    }


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

    # Count at-risk materials based on actual delayed deliveries
    impacted = find_impacted_products_by_supplier_delay()
    at_risk_shipments = len(set(r.get("materialLabel") for r in impacted if r.get("materialLabel")))

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

    # Calculate total SLA penalties owed from actual violations
    alerts = get_compliance_alerts()
    total_penalty_owed = 0
    for a in alerts:
        if a["violationStatus"] and a["penaltyRate"] > 0 and a["delayDays"] > 2:
            billable_days = a["delayDays"] - 2
            total_penalty_owed += billable_days * a["penaltyRate"]

    # SLA compliance = % of suppliers NOT at risk (simple heuristic)
    unique_delayed_suppliers = len(set(r.get("supplierLabel") for r in impacted if r.get("supplierLabel") and r.get("supplierLabel") != "Unknown"))
    sla_compliance = (
        max(0, round(((active_suppliers - unique_delayed_suppliers) / active_suppliers) * 100))
        if active_suppliers > 0 else 100
    )

    # Count live ML SystemAlerts
    q_alerts = f"""
    {PREFIXES}
    SELECT (COUNT(DISTINCT ?alert) AS ?count)
    WHERE {{
        ?alert rdf:type :SystemAlert ;
               :hasStatus ?status .
        FILTER(?status != "DISMISSED")
    }}
    """
    rows_alerts = graphdb.execute_sparql_select(q_alerts)
    live_alerts_count = int(rows_alerts[0].get("count", 0)) if rows_alerts else 0

    return {
        # Keys match EXACTLY what Dashboard.jsx buildKpiCards() reads:
        "active_suppliers":  active_suppliers,
        "at_risk_shipments": at_risk_shipments,
        "sla_compliance":    sla_compliance,
        "avg_lead_time":     avg_delay,       
        "total_penalty":     total_penalty_owed,  # Real calculated dollar amount
        "alert_count":       live_alerts_count,  

    }


def get_alerts() -> list[dict]:
    """
    Fetch ML-generated ManagerAlerts directly from the Knowledge Graph.
    Routes them to the specific managers intended by the AI Risk Engine.
    """
    query = f"""
    {PREFIXES}
    SELECT ?alertId ?title ?desc ?intendedFor ?status
    WHERE {{
        ?alert rdf:type :SystemAlert ;
               :hasTitle ?title ;
               :hasDesc ?desc ;
               :intendedFor ?intendedFor ;
               :hasStatus ?status .
        BIND(REPLACE(STR(?alert), "^.*#", "") AS ?alertId)
    }}
    ORDER BY DESC(?alertId)
    """
    rows = graphdb.execute_sparql_select(query)

    alerts = []
    for r in rows:
        alert_id = r.get("alertId")
        title = r.get("title")
        desc = r.get("desc")
        status = r.get("status")
        intended_for = r.get("intendedFor", "")

        if status == "DISMISSED":
            continue

        # Map the specific ML manager title to the frontend user roles
        roles = ["admin"]
        if "Production" in intended_for:
            roles.append("production")
        if "Logistics" in intended_for:
            roles.append("logistics")
        if "Procurement" in intended_for:
            roles.append("procurement")

        icon = "🚨" if "Production" in intended_for else "🚚" if "Logistics" in intended_for else "📝"
        category = "Inventory" if "Production" in intended_for else "SLA Breach"

        alerts.append({
            "id":       alert_id,
            "icon":     icon,
            "type":     "CRITICAL",
            "category": category,
            "title":    title,
            "desc":     desc,
            "time":     "Live ML Alert",
            "date":     "Knowledge Graph",
            "unread":   (status == "UNREAD"),
            "from":     "Risk Engine",
            "fromRole": "AI",
            "roles":    roles,
        })
        
    return alerts

def update_alert_status(alert_id: str, status: str) -> dict:
    safe_id = _sanitize_uri_fragment(alert_id)
    sparql_update = f"""
    {PREFIXES}
    DELETE {{ :{safe_id} :hasStatus ?oldStatus }}
    INSERT {{
        :{safe_id} rdf:type :SystemAlert ;
                   :hasStatus "{status}" .
    }}
    WHERE {{
        OPTIONAL {{ :{safe_id} :hasStatus ?oldStatus }}
    }}
    """
    graphdb.execute_sparql_update(sparql_update)
    return {{"status": "success", "alert_id": alert_id, "new_status": status}}

