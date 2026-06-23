# ============================================================
# services/dashboard_service.py — Layer 2: Dashboard Logic
#
# Thin service layer that wraps knowledge_base repository
# functions and SPARQL query building for the dashboard API.
# API endpoints MUST NOT import knowledge_base directly.
# ============================================================

import logging
import time

from knowledge_base.connection import graphdb
from knowledge_base.repository import (
    PREFIXES,
    _sanitize_uri_fragment,
    find_impacted_products_by_supplier_delay,
)
import hashlib

logger = logging.getLogger(__name__)

# ── Simple in-process TTL cache for the heavy impacted-products query ──────────
# This query takes ~7 seconds and is called 3 times per dashboard page load
# (get_risk_scores, get_compliance_alerts, get_kpis). Caching it for 30 seconds
# drops total load time from ~21s to ~7s on first load and ~0s on repeat loads.
_impacted_cache: list[dict] | None = None
_impacted_cache_ts: float = 0.0
_IMPACTED_CACHE_TTL = 30  # seconds


def _get_impacted_cached() -> list[dict]:
    """Return cached impacted-products result, refreshing if older than TTL."""
    global _impacted_cache, _impacted_cache_ts
    if _impacted_cache is None or (time.time() - _impacted_cache_ts) > _IMPACTED_CACHE_TTL:
        logger.debug("[cache MISS] Refreshing impacted products from GraphDB ...")
        _impacted_cache = find_impacted_products_by_supplier_delay()
        _impacted_cache_ts = time.time()
    else:
        logger.debug("[cache HIT]  Serving impacted products from cache.")
    return _impacted_cache


def invalidate_impacted_cache() -> None:
    """Clear the cached impacted-products query immediately."""
    global _impacted_cache
    logger.debug("[cache INVALIDATION] Clearing cached impacted products.")
    _impacted_cache = None



def get_risk_scores() -> list[dict]:
    """
    Returns risk scores including reliabilityScore so Suppliers page bars render.
    """
    impacted = _get_impacted_cached()
    
    # Also query all suppliers with their reliability scores, lead times, and countries
    # NOTE: We omit `?material rdf:type :RawMaterial` to avoid Cartesian product explosion under OWL inference.
    q_all = f"""
    {PREFIXES}
    SELECT DISTINCT ?supplierName ?materialName ?processName ?productName ?reliabilityScore ?leadTimeDays ?country ?stock ?safetyStock
    WHERE {{
        ?supplier rdf:type :Supplier ;
                  :supplies ?material .
        FILTER NOT EXISTS {{ ?supplier rdf:type :AlternativeSupplier . }}
        OPTIONAL {{ ?supplier rdfs:label ?sLabel . }}
        OPTIONAL {{ ?supplier :hasName ?sName . }}
        BIND(COALESCE(?sLabel, ?sName, REPLACE(STR(?supplier), "^.*#", "")) AS ?supplierName)
        OPTIONAL {{ ?material rdfs:label ?mLabel . }}
        BIND(COALESCE(?mLabel, REPLACE(STR(?material), "^.*#", "")) AS ?materialName)
        OPTIONAL {{
            ?material :affectsProcess ?process .
            OPTIONAL {{ ?process rdfs:label ?pLabel . }}
            BIND(COALESCE(?pLabel, REPLACE(STR(?process), "^.*#", "")) AS ?processName)
            
            OPTIONAL {{
                ?process :producesProduct ?product .
                OPTIONAL {{ ?product rdfs:label ?prodLabel . }}
            }}
            BIND(COALESCE(?prodLabel, REPLACE(STR(?product), "^.*#", "")) AS ?productName)
        }}
        OPTIONAL {{ ?supplier :hasReliabilityScore ?reliabilityScore . }}
        OPTIONAL {{ ?supplier :leadTimeDays ?leadTimeDays . }}
        OPTIONAL {{ ?supplier :country ?country . }}
        OPTIONAL {{ ?material :hasInventoryStock ?stock . }}
        OPTIONAL {{ ?material :hasSafetyStockLevel ?safetyStock . }}
    }}
    """
    all_rows = graphdb.execute_sparql_select(q_all)

    risk_scores = []
    seen_pairs = set()
    
    # First, guarantee all RED impacted items are added
    for r in impacted:
        mat_name = r.get("materialLabel", "Unknown")
        sup_name = r.get("supplierLabel", "Unknown")
        if (sup_name, mat_name) in seen_pairs:
            continue
        risk_scores.append({
            "material":         mat_name,
            "materialLabel":    mat_name,
            "supplier":         sup_name,
            "supplierLabel":    sup_name,
            "process":          r.get("processLabel", ""),
            "processLabel":     r.get("processLabel", ""),
            "product":          r.get("productLabel", ""),
            "productLabel":     r.get("productLabel", ""),
            "status":           "RED",
            "reliabilityScore": None,
            "leadTime":         None,
            "country":          None,
            "stock":            int(float(r.get("stock"))) if r.get("stock") is not None else 0,
            "threshold":        int(float(r.get("safetyStock"))) if r.get("safetyStock") is not None else 0,
            "requiredQty":      int(float(r.get("reqQty"))) if r.get("reqQty") is not None else 100,
        })
        seen_pairs.add((sup_name, mat_name))

    # Then add the GREEN ones from all_rows, and enrich the RED ones if we found matching supplier data
    for row in all_rows:
        mat_name = row.get("materialName", "Unknown")
        sup_name = row.get("supplierName", "Unknown")
        
        if (sup_name, mat_name) in seen_pairs:
            # Enrich ONLY the matching supplier entry (match by both material AND supplier name)
            for rs in risk_scores:
                if rs["material"] == mat_name and rs["supplierLabel"] == sup_name:
                    if not rs["reliabilityScore"]:
                        rs["reliabilityScore"] = row.get("reliabilityScore")
                    if not rs["leadTime"]:
                        rs["leadTime"] = row.get("leadTimeDays")
                    if not rs["country"]:
                        rs["country"] = row.get("country")
                    if not rs.get("stock") and row.get("stock") is not None:
                        rs["stock"] = int(float(row.get("stock")))
                    if not rs.get("threshold") and row.get("safetyStock") is not None:
                        rs["threshold"] = int(float(row.get("safetyStock")))
            continue
            
        risk_scores.append({
            "material":         mat_name,
            "materialLabel":    mat_name,
            "supplier":         sup_name,
            "supplierLabel":    sup_name,
            "process":          row.get("processName", ""),
            "processLabel":     row.get("processName", ""),
            "product":          row.get("productName", ""),
            "productLabel":     row.get("productName", ""),
            "status":           "GREEN",
            "reliabilityScore": row.get("reliabilityScore", None),
            "leadTime":         row.get("leadTimeDays", None),
            "country":          row.get("country", None),
            "stock":            int(float(row.get("stock"))) if row.get("stock") is not None else 0,
            "threshold":        int(float(row.get("safetyStock"))) if row.get("safetyStock") is not None else 0,
            "requiredQty":      0,
        })
    # Post-process status purely on stock vs safety-stock threshold.
    # An active delayed delivery does NOT independently force RED —
    # only genuine low inventory (stock < safetyStock) triggers AT RISK.
    for rs in risk_scores:
        stock = rs.get("stock", 0)
        threshold = rs.get("threshold", 0)
        rs["status"] = "RED" if threshold > 0 and stock < threshold else "GREEN"

    return risk_scores




def get_compliance_alerts() -> list[dict]:
    """
    Returns enriched SLA data including compliance %, deadline, risk level,
    numeric penaltyRate and clause so the SLA Violations page renders fully.
    Also queries and matches active SLA violations (LateDelivery, UnderShipment, DamagedGoods)
    from the knowledge graph, calculating their penalties dynamically.
    """
    # 1. Query all primary supplier contracts (supplier-material pairs)
    query = f"""
    {PREFIXES}
    SELECT DISTINCT ?supplier ?supplierName ?materialName ?leadTimeDays ?penalty
                    ?reliabilityScore ?deliveryDeadline ?riskLevel ?penaltyRate ?clause
                    ?slaLeadTimeHours
    WHERE {{
        ?supplier rdf:type :Supplier ;
                  :supplies ?material .
        FILTER NOT EXISTS {{ ?supplier rdf:type :AlternativeSupplier . }}

        OPTIONAL {{ ?supplier rdfs:label ?sLabel . }}
        OPTIONAL {{ ?supplier :hasName ?sName . }}
        BIND(COALESCE(?sLabel, ?sName, REPLACE(STR(?supplier), "^.*#", "")) AS ?supplierName)

        OPTIONAL {{ ?material rdfs:label ?mLabel . }}
        BIND(COALESCE(?mLabel, REPLACE(STR(?material), "^.*#", "")) AS ?materialName)

        OPTIONAL {{ ?supplier :leadTimeDays ?leadTimeDays . }}
        OPTIONAL {{
            {{ ?supplier :hasSLA ?sla . }} UNION {{ ?sla :governs ?supplier . }}
            OPTIONAL {{ ?sla :hasSLALeadTime ?slaLeadTimeHours . }}
        }}
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
    LIMIT 500
    """
    rows = graphdb.execute_sparql_select(query)

    violations_query = f"""
    {PREFIXES}
    SELECT DISTINCT ?delivery ?violationType ?supplier ?supplierName ?materialName
                    ?orderedQty ?deliveredQty ?totalCost ?delayDuration
                    ?missedItemPenaltyRate ?qualityPenaltyRate ?delayPenaltyRate
    WHERE {{
        {{
            ?delivery rdf:type :SLAViolation .
            OPTIONAL {{ ?delivery :hasViolationType ?violationType . }}
        }}
        UNION
        {{
            ?delivery rdf:type :DeliveryEvent ;
                      :hasDeliveryStatus "Delayed" .
            BIND("LateDelivery" AS ?violationType)
        }}

        # ── Supplier resolution (three paths, most specific first) ────────────
        # Path 1: delivery transports a material → material supplied by supplier
        OPTIONAL {{
            ?delivery :transports ?material .
            {{ ?supplier :supplies ?material . }} UNION {{ ?material :isSuppliedBy ?supplier . }}
        }}
        # Path 2: delivery performed by supplier directly (covers DamagedGoods / UnderShipment)
        OPTIONAL {{
            ?delivery :isPerformedBy ?perfSupplier .
            FILTER NOT EXISTS {{ ?perfSupplier rdf:type :AlternativeSupplier . }}
        }}
        # Path 3: delivery fulfils a PO issued to the supplier
        OPTIONAL {{
            ?delivery :fulfills ?po .
            ?po :issuedTo ?poSupplier .
            FILTER NOT EXISTS {{ ?poSupplier rdf:type :AlternativeSupplier . }}
            OPTIONAL {{ ?po :hasOrderedQuantity ?orderedQty . }}
            OPTIONAL {{ ?po :hasTotalOrderCost ?totalCost . }}
        }}

        # Resolve the best available supplier
        BIND(COALESCE(?supplier, ?perfSupplier, ?poSupplier) AS ?resolvedSupplier)
        FILTER(BOUND(?resolvedSupplier))
        FILTER NOT EXISTS {{ ?resolvedSupplier rdf:type :AlternativeSupplier . }}

        # Resolve names
        OPTIONAL {{ ?material rdfs:label ?mLabel . }}
        BIND(COALESCE(?mLabel, IF(BOUND(?material), REPLACE(STR(?material), "^.*#", ""), "")) AS ?materialName)

        OPTIONAL {{ ?resolvedSupplier rdfs:label ?sLabel . }}
        OPTIONAL {{ ?resolvedSupplier :hasName ?sName . }}
        BIND(COALESCE(?sLabel, ?sName, REPLACE(STR(?resolvedSupplier), "^.*#", "")) AS ?supplierName)

        # SLA parameters from the resolved supplier
        OPTIONAL {{
            {{ ?resolvedSupplier :hasSLA ?sla . }} UNION {{ ?sla :governs ?resolvedSupplier . }}
            OPTIONAL {{ ?sla :hasMissedItemPenaltyRate ?missedItemPenaltyRate . }}
            OPTIONAL {{ ?sla :hasQualityPenaltyRate ?qualityPenaltyRate . }}
        }}
        OPTIONAL {{ ?resolvedSupplier :penaltyRatePerDay ?delayPenaltyRate . }}
        OPTIONAL {{ ?delivery :hasDelayDuration ?delayDuration . }}
        OPTIONAL {{ ?delivery :hasDeliveredQuantity ?deliveredQty . }}
    }}
    """

    violations_res = graphdb.execute_sparql_select(violations_query)

    # Deduplicate violations by delivery URI
    unique_violations = {}
    for r in violations_res:
        deliv = r.get("delivery")
        if not deliv:
            continue
        if deliv not in unique_violations:
            unique_violations[deliv] = r
        else:
            existing = unique_violations[deliv]
            if not existing.get("materialName") and r.get("materialName"):
                unique_violations[deliv] = r

    # Pre-populate delay map from cache
    impacted = _get_impacted_cached()
    supplier_delay_map = {}
    for r in impacted:
        sup = r.get("supplierLabel", "")
        delay_hrs = float(r.get("delayHours", 0) or 0)
        if sup:
            days = int(delay_hrs / 24) if delay_hrs > 0 else 1
            supplier_delay_map[sup] = max(supplier_delay_map.get(sup, 0), days)

    # 3. Match violations to contracts
    assigned_violations = set()
    alerts = []

    for row in rows:
        supplier_name = row.get("supplierName", "Unknown")
        material_name = row.get("materialName", "Unknown")
        
        # Find matching violation
        matched_violation = None
        
        # A. Match strictly by supplier AND material
        for deliv, v in unique_violations.items():
            if deliv in assigned_violations:
                continue
            if v.get("supplierName") == supplier_name and v.get("materialName") == material_name:
                matched_violation = v
                assigned_violations.add(deliv)
                break
                
        # B. Match by supplier only if no material-specific violation was found (and violation has no material link)
        if not matched_violation:
            for deliv, v in unique_violations.items():
                if deliv in assigned_violations:
                    continue
                if v.get("supplierName") == supplier_name and not v.get("materialName"):
                    matched_violation = v
                    assigned_violations.add(deliv)
                    break
                    
        # C. Match any remaining violations of this supplier
        if not matched_violation:
            for deliv, v in unique_violations.items():
                if deliv in assigned_violations:
                    continue
                if v.get("supplierName") == supplier_name:
                    matched_violation = v
                    assigned_violations.add(deliv)
                    break

        # Calculate values based on match
        violation_status = matched_violation is not None
        violation_type = None
        penalty_owed = 0.0
        actual_delay_days = 0
        ordered_qty = None
        delivered_qty = None
        total_cost = None
        missed_item_penalty_rate = None
        quality_penalty_rate = None
        
        if matched_violation:
            violation_type = matched_violation.get("violationType")
            ordered_qty = float(matched_violation.get("orderedQty", 0) or 0) if matched_violation.get("orderedQty") else None
            delivered_qty = float(matched_violation.get("deliveredQty", 0) or 0) if matched_violation.get("deliveredQty") else None
            total_cost = float(matched_violation.get("totalCost", 0) or 0) if matched_violation.get("totalCost") else None
            missed_item_penalty_rate = float(matched_violation.get("missedItemPenaltyRate", 0) or 0) if matched_violation.get("missedItemPenaltyRate") else None
            quality_penalty_rate = float(matched_violation.get("qualityPenaltyRate", 0) or 0) if matched_violation.get("qualityPenaltyRate") else None
            
            if violation_type == "LateDelivery":
                delay_hours = float(matched_violation.get("delayDuration", 0) or 0)
                actual_delay_days = int(delay_hours / 24) if delay_hours > 0 else 1
                if supplier_name in supplier_delay_map:
                    actual_delay_days = max(actual_delay_days, supplier_delay_map[supplier_name])
                
                rate = float(matched_violation.get("delayPenaltyRate", 0) or 0)
                billable_days = max(0, actual_delay_days - 2)
                penalty_owed = billable_days * rate
                
            elif violation_type == "UnderShipment":
                if ordered_qty is not None and delivered_qty is not None:
                    missed = max(0.0, ordered_qty - delivered_qty)
                    rate = missed_item_penalty_rate if missed_item_penalty_rate is not None else 50.0
                    penalty_owed = missed * rate
                    
            elif violation_type == "DamagedGoods":
                cost = total_cost if total_cost is not None else 5000.0
                rate = quality_penalty_rate if quality_penalty_rate is not None else 0.1
                penalty_owed = cost * rate
        else:
            # Check if there is a delay in the cache even if not in unique_violations
            if supplier_name in supplier_delay_map:
                violation_status = True
                violation_type = "LateDelivery"
                actual_delay_days = supplier_delay_map[supplier_name]
                rate = float(row.get("penaltyRate", 0) or 0)
                billable_days = max(0, actual_delay_days - 2)
                penalty_owed = billable_days * rate

        # leadTimeDays as int, fallback to SLA lead time (converted from hours to days)
        lead_days_val = row.get("leadTimeDays")
        if lead_days_val is not None:
            lead_days = int(float(lead_days_val))
        else:
            sla_hours = row.get("slaLeadTimeHours")
            if sla_hours is not None:
                lead_days = max(1, int(float(sla_hours) / 24.0))
            else:
                lead_days = 14  # Safe default if no lead time is configured

        # SLA Compliance strictly evaluates contract adherence based on active breaches.
        # If there is no delay/violation, the contract is 100% compliant.
        if not violation_status:
            compliance = 100
        else:
            if violation_type == "LateDelivery":
                if lead_days > 0:
                    if actual_delay_days <= 2:
                        # Slight drop for late but within grace period
                        compliance = max(90, int((1.0 - (actual_delay_days / (lead_days * 2.0))) * 100))
                    else:
                        # Breaches grace period, drops faster based on delay severity relative to lead time
                        severity = (actual_delay_days - 2) / lead_days
                        compliance = max(0, int((1.0 - severity) * 90))
                else:
                    compliance = 0
            elif violation_type == "UnderShipment":
                if ordered_qty and ordered_qty > 0:
                    deliv_q = delivered_qty if delivered_qty is not None else 0
                    compliance = max(0, int((deliv_q / ordered_qty) * 100))
                else:
                    compliance = 70
            elif violation_type == "DamagedGoods":
                # Use quality penalty rate to determine compliance (e.g. 10% penalty rate = 90% compliance)
                rate = quality_penalty_rate if quality_penalty_rate is not None else 0.10
                compliance = max(0, int((1.0 - rate) * 100))
            else:
                compliance = 0

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
                risk = "HIGH" if violation_status else "LOW"

        # clause
        clause = row.get("clause", row.get("penalty", "—")) or "—"

        # penalty display string
        penalty_display = row.get("penalty", "")
        if not penalty_display and penalty_rate > 0:
            penalty_display = f"${penalty_rate:,.0f}/day"

        alerts.append({
            "supplier":                 supplier_name,
            "supplierLabel":            supplier_name,
            "material":                 material_name,
            "materialLabel":            material_name,
            "leadTimeDays":             lead_days,
            "delayDays":                actual_delay_days,
            "penalty":                  penalty_display,
            "penaltyRate":              penalty_rate,
            "compliance":               compliance,
            "deadline":                 deadline,
            "risk":                     risk,
            "clause":                   clause,
            "violationStatus":          violation_status,
            "violationType":            violation_type,
            "penaltyOwed":              penalty_owed,
            "orderedQty":               ordered_qty,
            "deliveredQty":             delivered_qty,
            "totalCost":                total_cost,
            "missedItemPenaltyRate":    missed_item_penalty_rate,
            "qualityPenaltyRate":       quality_penalty_rate,
        })
    return alerts


def get_impacted_products() -> list[dict]:
    return _get_impacted_cached()


def get_fallback_options(material_id: str) -> list[dict]:
    safe_material = _sanitize_uri_fragment(material_id)
    material_escaped = material_id.replace('"', '\\"')
    # IMPORTANT: Only return :AlternativeSupplier nodes.
    # Filtering to this type ensures:
    #   (a) The currently-delayed primary supplier never appears in the list.
    #   (b) Suppliers promoted via previous assignments don't bleed across materials.
    # Grouping by ?supplier and using aggregates (MAX, MIN, SAMPLE) resolves Cartesian
    # product duplication caused by multi-valued properties under OWL inference.
    query = f"""
    {PREFIXES}
    SELECT ?supplier 
           (MAX(?supplierName) AS ?sName) 
           (MAX(?reliabilityScore) AS ?rScore) 
           (MIN(?leadTimeDays) AS ?lTime) 
           (SAMPLE(?country) AS ?cCode) 
           (MAX(?quantity) AS ?qty)
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
        
        # Get capacity from SLAContract governing the material
        OPTIONAL {{
            ?contract rdf:type :SLAContract ;
                      :hasSupplier ?supplier ;
                      :governsMaterial ?mat .
            OPTIONAL {{ ?contract :hasOrderedQuantity ?quantity . }}
        }}
    }}
    GROUP BY ?supplier
    ORDER BY DESC(?rScore)
    """
    rows = graphdb.execute_sparql_select(query)

    options = []
    for row in rows:
        options.append({
            "supplier":         row.get("supplier"),
            "supplierName":     row.get("sName"),
            "reliabilityScore": row.get("rScore"),
            "leadTime":         row.get("lTime"),
            "country":          row.get("cCode"),
            "quantity":         int(float(row.get("qty"))) if row.get("qty") is not None else 0,
        })
    return options

def assign_fallback_supplier(material_name: str, supplier_name: str, assignment_type: str) -> dict:
    """
    Persist a fallback assignment in the Knowledge Graph by inserting
    an RDF triple linking the alternate supplier to the material.
    Uses label-based lookup to avoid SPARQL syntax errors from special chars in names.
    Also assumes the emergency shipment has been received, adding the alternative
    supplier's capacity to the material's current stock level.
    """
    from knowledge_base.repository import CONTRACT_GRAPH

    mat_esc = material_name.replace('"', '\\"')
    sup_esc = supplier_name.replace('"', '\\"')
    safe_mat = _sanitize_uri_fragment(material_name)
    safe_sup = _sanitize_uri_fragment(supplier_name)

    # Step 1: look up the actual material + supplier + delivery URIs by label,
    # plus the current stock of the material and the fallback capacity/delayed quantity.
    lookup_q = f"""
    {PREFIXES}
    SELECT ?mat ?sup ?delivery ?stock ?capacity ?delayedQty WHERE {{
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
            ?delivery :transports ?mat .
            OPTIONAL {{ ?mat rdfs:label ?ml2 . }}
            FILTER(STR(?ml2) = "{mat_esc}" || REPLACE(STR(?mat), "^.*#", "") = "{safe_mat}")
        }}
        OPTIONAL {{
            ?mat :hasInventoryStock ?stock .
        }}
        OPTIONAL {{
            ?contract rdf:type :SLAContract ;
                      :hasSupplier ?sup ;
                      :governsMaterial ?mat .
            ?contract :hasOrderedQuantity ?capacity .
        }}
        OPTIONAL {{
            ?delivery :fulfills ?po .
            ?po :hasOrderedQuantity ?delayedQty .
        }}
    }} LIMIT 1
    """
    rows = graphdb.execute_sparql_select(lookup_q)
    mat_uri_full = rows[0].get("mat") if rows else None
    sup_uri_full = rows[0].get("sup") if rows else None
    delivery_uri_full = rows[0].get("delivery") if rows else None

    # Get stock and quantity values from query results
    stock_val = int(float(rows[0].get("stock"))) if rows and rows[0].get("stock") is not None else 0
    capacity_val = int(float(rows[0].get("capacity"))) if rows and rows[0].get("capacity") is not None else 0
    delayed_val = int(float(rows[0].get("delayedQty"))) if rows and rows[0].get("delayedQty") is not None else 100

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

    # Step 3: Update inventory stock level in GraphDB: add the alternative supplier capacity to the current stock
    if mat_uri_full:
        added_qty = capacity_val if capacity_val > 0 else delayed_val
        new_stock = stock_val + added_qty
        stock_update_q = f"""
        {PREFIXES}
        DELETE {{
            GRAPH ?g {{ <{mat_uri_full}> :hasInventoryStock ?oldStock . }}
        }}
        WHERE {{
            GRAPH ?g {{ <{mat_uri_full}> :hasInventoryStock ?oldStock . }}
        }} ;
        INSERT DATA {{
            GRAPH <{CONTRACT_GRAPH}> {{
                <{mat_uri_full}> :hasInventoryStock {new_stock} .
            }}
        }}
        """
        graphdb.execute_sparql_update(stock_update_q)

    # Step 4: Update the delivery status in whatever graph it lives in
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

    # Invalidate dashboard cache to reflect new stock levels immediately
    invalidate_impacted_cache()

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
    impacted = _get_impacted_cached()
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
    total_penalty_owed = sum(a.get("penaltyOwed", 0.0) for a in alerts if a.get("violationStatus"))

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
    SELECT ?alertId ?title ?desc ?intendedFor ?status ?severity
    WHERE {{
        ?alert rdf:type :SystemAlert ;
               :hasTitle ?title ;
               :hasDesc ?desc ;
               :intendedFor ?intendedFor ;
               :hasStatus ?status .
        OPTIONAL {{ ?alert :hasSeverity ?severity . }}
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
        severity = r.get("severity", "LOW")

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

        # Map BNode / GraphDB severity values to frontend alert types (CRITICAL, HIGH, INFO, LOW)
        alert_type = str(severity).upper()
        if alert_type not in ("CRITICAL", "HIGH", "INFO", "LOW", "ESCALATION"):
            if alert_type == "MEDIUM":
                alert_type = "HIGH"
            else:
                alert_type = "LOW"

        alerts.append({
            "id":       alert_id,
            "icon":     icon,
            "type":     alert_type,
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
    return {"status": "success", "alert_id": alert_id, "new_status": status}


def run_semantic_enrichment() -> None:
    """
    Run SPARQL INSERT queries on startup to materialize semantic shortcuts
    and missing rdfs:labels in GraphDB, making queries robust to different 
    translation styles and label lookups.
    """
    enrichment_query = f"""
    {PREFIXES}
    INSERT {{
        # 1. Direct delivery to supplier relation
        ?delivery :isPerformedBy ?supplier .
        # 2. Direct alternate supplier to material relation
        ?alt :supplies ?material .
    }}
    WHERE {{
        # Match delivery supplier via PO or transports
        {{
            ?delivery rdf:type :DeliveryEvent .
            {{
                ?delivery :fulfills ?po .
                ?po :issuedTo ?supplier .
                FILTER NOT EXISTS {{ ?supplier rdf:type :AlternativeSupplier . }}
            }} UNION {{
                ?delivery :transports ?material .
                ?supplier :supplies ?material .
                FILTER NOT EXISTS {{ ?supplier rdf:type :AlternativeSupplier . }}
            }}
            FILTER NOT EXISTS {{ ?delivery :isPerformedBy ?supplier . }}
        }}
        UNION
        # Match alternate supplier supplies via similarity
        {{
            ?alt rdf:type :AlternativeSupplier .
            ?incumbent rdf:type :Supplier ;
                       :supplies ?material .
            ?alt :suppliesSameMaterialAs ?incumbent .
            FILTER NOT EXISTS {{ ?alt :supplies ?material . }}
        }}
    }}
    """
    label_enrichment = f"""
    {PREFIXES}
    INSERT {{
        GRAPH <{CONTRACT_GRAPH}> {{
            ?x rdfs:label ?label .
        }}
    }}
    WHERE {{
        ?x rdf:type ?type .
        FILTER(STRSTARTS(STR(?x), "http://example.org/ontology#"))
        FILTER NOT EXISTS {{ ?x rdfs:label ?anyLabel . }}
        
        # Generate friendly label by replacing underscores with spaces
        BIND(REPLACE(REPLACE(STR(?x), "^.*#", ""), "_", " ") AS ?label)
    }}
    """
    try:
        graphdb.execute_sparql_update(enrichment_query)
        logger.info("[Enrichment] Materialized semantic shortcuts successfully.")
        graphdb.execute_sparql_update(label_enrichment)
        logger.info("[Enrichment] Materialized missing entity labels successfully.")
    except Exception as exc:
        logger.error("[Enrichment] Failed to materialize semantic enrichment: %s", exc)




