# ============================================================
# database/repository.py — Layer 3: SPARQL Graph Repository
#
# This module contains functions that build and execute
# SPARQL queries against GraphDB.  It knows NOTHING about
# HTTP or the web framework — it only talks to the database.
#
# ╔══════════════════════════════════════════════════════════╗
# ║  GOLDEN RULE #2 — NAMESPACE CONSISTENCY                  ║
# ║  Every triple inserted by the LLM must use the SAME      ║
# ║  namespace prefix as the OWL ontology file.               ║
# ║  Our ontology defines:                                    ║
# ║    PREFIX : <http://example.org/ontology#>                ║
# ║  So ALL individuals and predicates must live under that   ║
# ║  same namespace.  If the LLM outputs "ex:Supplier",      ║
# ║  re-map it to ":Supplier" before insertion.               ║
# ╚══════════════════════════════════════════════════════════╝
# ============================================================

from datetime import datetime
from knowledge_base.connection import graphdb
from models.schemas import SLAContract

# ---- Shared Namespace Prefix Block ----
# This prefix block is prepended to every SPARQL query to
# guarantee namespace consistency across the whole system.
PREFIXES = """
PREFIX : <http://example.org/ontology#>
PREFIX rdf: <http://www.w3.org/1999/02/22-rdf-syntax-ns#>
PREFIX rdfs: <http://www.w3.org/2000/01/rdf-schema#>
PREFIX owl: <http://www.w3.org/2002/07/owl#>
PREFIX xsd: <http://www.w3.org/2001/XMLSchema#>
"""

# ---- Named Graph URIs ----
# GOLDEN RULE — Named Graph Separation:
#   Ontology rules  → loaded into  http://example.org/ontology/
#   Contract data   → inserted into http://example.org/contracts/
# This keeps your OWL axioms separate from instance data.
CONTRACT_GRAPH = "http://example.org/contracts/"


def _sanitize_uri_fragment(name: str) -> str:
    """
    Convert a human-readable name into a safe URI fragment.

    Examples
    --------
    >>> _sanitize_uri_fragment("Stark Industries")
    'Stark_Industries'
    >>> _sanitize_uri_fragment("Cold-Rolled Steel")
    'Cold-Rolled_Steel'
    """
    return name.strip().replace(" ", "_")


def create_contract_graph(contract: SLAContract) -> dict:
    """
    Persist an SLA contract as RDF triples in GraphDB.

    Graph pattern created (in Named Graph <http://example.org/contracts/>)
    -----------------------------------------------------------------------
        :Stark_Industries  rdf:type       :Supplier .
        :Cold-Rolled_Steel rdf:type       :RawMaterial .
        :Stark_Industries  :supplies      :Cold-Rolled_Steel .
        :Stark_Industries  :leadTimeDays  14 .
        :Stark_Industries  :penaltyClause "2% per day" .

    Parameters
    ----------
    contract : SLAContract
        The validated Pydantic model coming from the API layer.

    Returns
    -------
    dict
        A confirmation dict with the supplier and material names.
    """

    # ---- Build safe URI fragments ----
    supplier_uri = _sanitize_uri_fragment(contract.supplier_name)
    material_uri = _sanitize_uri_fragment(contract.material)

    # ---- Sanitize values before embedding in SPARQL ----
    # lead_time_days must be a valid integer (min 1) — empty string crashes GraphDB
    try:
        lead_days = max(1, int(contract.lead_time_days))
    except (TypeError, ValueError):
        lead_days = 1

    # penalty_clause: escape double-quotes and newlines so SPARQL string is valid
    raw_penalty = str(contract.penalty_clause or "").replace("\\", "\\\\").replace('"', '\\"').replace("\n", " ").replace("\r", "")

    # supplier/material labels: same escaping
    safe_supplier_name = str(contract.supplier_name or "").replace('"', '\\"').replace("\n", " ")
    safe_material = str(contract.material or "").replace('"', '\\"').replace("\n", " ")

    timestamp = datetime.utcnow().isoformat() + "Z"

    # ---- SPARQL UPDATE query ----
    # We use INSERT DATA to add triples into the contracts
    # Named Graph.  All URIs use the ontology namespace (:)
    # to satisfy Golden Rule #2 (Namespace Consistency).
    sparql_update = f"""
    {PREFIXES}

    INSERT DATA {{
        GRAPH <{CONTRACT_GRAPH}> {{

            # ── Supplier individual ──
            :{supplier_uri}  rdf:type       :Supplier ;
                             rdfs:label     "{safe_supplier_name}" ;
                             :hasReliabilityScore  "0.5"^^xsd:float ;
                             :createdAt     "{timestamp}"^^xsd:dateTime .

            # ── RawMaterial individual ──
            :{material_uri}  rdf:type       :RawMaterial ;
                             rdfs:label     "{safe_material}" .

            # ── Relationship: Supplier supplies RawMaterial ──
            :{supplier_uri}  :supplies      :{material_uri} .

            # ── SLA Properties on the Supplier ──
            :{supplier_uri}  :leadTimeDays  {lead_days} .
            :{supplier_uri}  :penaltyClause "{raw_penalty}" .
        }}
    }}
    """

    # Execute the update (stateless HTTP POST to GraphDB)
    graphdb.execute_sparql_update(sparql_update)

    return {
        "supplier": contract.supplier_name,
        "material": contract.material,
        "graph": CONTRACT_GRAPH,
        "message": "Triples inserted successfully into GraphDB.",
    }


def find_impacted_products_by_supplier_delay() -> list[dict]:
    """
    SPARQL SELECT that demonstrates OWL Inference.

    This query finds all ProductionProcesses (representing products/lines) 
    that are "At Risk" (inferred as ProductionDisruption) because of a delay.
    
    Returns
    -------
    list[dict]
        Each dict contains productLabel, supplierLabel, materialLabel, and riskStatus.
    """

    sparql_query = f"""
    {PREFIXES}

    SELECT DISTINCT ?supplierLabel ?materialLabel ?productLabel ?riskStatus ?delayHours
    WHERE {{
        # ── Find delayed deliveries and their transported material ──
        ?delivery  rdf:type     :DeliveryEvent ;
                   :hasDeliveryStatus ?status ;
                   :transports  ?material .
        FILTER(STR(?status) = "Delayed")
        
        OPTIONAL {{ ?delivery :hasDelayDuration ?delayHours . }}
        
        # ── Find what PRIMARY supplier provides that material (exclude alternatives) ──
        OPTIONAL {{
            {{ ?supplier :supplies ?material . }}
            UNION
            {{ ?material :isSuppliedBy ?supplier . }}
            # Only primary suppliers, not alternatives
            FILTER NOT EXISTS {{ ?supplier rdf:type :AlternativeSupplier . }}
            OPTIONAL {{
                ?supplier rdfs:label ?sLabel .
            }}
            OPTIONAL {{
                ?supplier :hasName ?sName .
            }}
        }}
        BIND(COALESCE(?sLabel, ?sName, REPLACE(STR(?supplier), "^.*#", "")) AS ?supplierLabel)

        # ── Find the label of the material ──
        OPTIONAL {{
            ?material rdfs:label ?mLabel .
        }}
        BIND(COALESCE(?mLabel, REPLACE(STR(?material), "^.*#", "")) AS ?materialLabel)

        # ── Find the process affected by the material ──
        ?material  :affectsProcess ?process .
        OPTIONAL {{
            ?process rdfs:label ?pLabel .
        }}
        BIND(COALESCE(?pLabel, REPLACE(STR(?process), "^.*#", "")) AS ?productLabel)

        # ── Check if the process is inferred as a ProductionDisruption (at risk) ──
        ?process   rdf:type     :ProductionDisruption .
        BIND("true" AS ?riskStatus)
    }}
    ORDER BY ?productLabel
    """

    return graphdb.execute_sparql_select(sparql_query)


def get_active_suppliers() -> list[dict]:
    """
    Queries GraphDB to fetch all suppliers with their URIs and their hasName, 
    rdfs:label, and hasReliabilityScore values.
    """
    query = f"""
    {PREFIXES}
    SELECT DISTINCT ?supplier ?name ?label ?oldScore
    WHERE {{
        ?supplier rdf:type :Supplier .
        OPTIONAL {{ ?supplier :hasName ?name . }}
        OPTIONAL {{ ?supplier rdfs:label ?label . }}
        OPTIONAL {{ ?supplier :hasReliabilityScore ?oldScore . }}
    }}
    """
    return graphdb.execute_sparql_select(query)


def update_supplier_reliability_score(supplier_id: str, new_score: float) -> bool:
    """
    Executes a SPARQL UPDATE statement using the GraphDB connection broker to update
    :hasReliabilityScore under the contracts named graph.
    """
    if supplier_id.startswith("http://") or supplier_id.startswith("https://"):
        supplier_ref = f"<{supplier_id}>"
    elif supplier_id.startswith(":"):
        supplier_ref = supplier_id
    else:
        supplier_ref = f":{supplier_id}"

    update_query = f"""
    {PREFIXES}
    
    DELETE {{
        GRAPH <{CONTRACT_GRAPH}> {{
            {supplier_ref} :hasReliabilityScore ?oldScoreContracts .
        }}
        {supplier_ref} :hasReliabilityScore ?oldScoreDefault .
    }}
    INSERT {{
        GRAPH <{CONTRACT_GRAPH}> {{
            {supplier_ref} :hasReliabilityScore "{new_score}"^^xsd:float .
        }}
    }}
    WHERE {{
        OPTIONAL {{
            GRAPH <{CONTRACT_GRAPH}> {{
                {supplier_ref} :hasReliabilityScore ?oldScoreContracts .
            }}
        }}
        OPTIONAL {{
            {supplier_ref} :hasReliabilityScore ?oldScoreDefault .
        }}
    }}
    """
    return graphdb.execute_sparql_update(update_query)


def initialize_missing_supplier_scores() -> dict:
    """
    Find all suppliers in GraphDB that don't have a hasReliabilityScore
    and assign them a default score of 0.5.
    
    This is a migration function for existing suppliers that were created
    without a reliability score.
    """
    # First, find all suppliers without a score
    query_find = f"""
    {PREFIXES}
    SELECT DISTINCT ?supplier
    WHERE {{
        ?supplier rdf:type :Supplier .
        FILTER NOT EXISTS {{ ?supplier :hasReliabilityScore ?score . }}
    }}
    """
    
    suppliers_without_score = graphdb.execute_sparql_select(query_find)
    
    if not suppliers_without_score:
        return {"status": "success", "message": "All suppliers already have reliability scores.", "updated_count": 0}
    
    # Update each supplier with default score
    updated_count = 0
    for result in suppliers_without_score:
        supplier_uri = result.get("supplier")
        if supplier_uri:
            # Extract the fragment identifier
            if "#" in supplier_uri:
                supplier_id = supplier_uri.split("#")[-1]
                supplier_ref = f":{supplier_id}"
            else:
                supplier_ref = f"<{supplier_uri}>"
            
            # Insert the default score
            update_query = f"""
            {PREFIXES}
            INSERT DATA {{
                GRAPH <{CONTRACT_GRAPH}> {{
                    {supplier_ref} :hasReliabilityScore "0.5"^^xsd:float .
                }}
            }}
            """
            try:
                graphdb.execute_sparql_update(update_query)
                updated_count += 1
            except Exception as e:
                logger.error(f"Failed to update supplier {supplier_id}: {e}")
    
    return {
        "status": "success",
        "message": f"Initialized reliability scores for {updated_count} suppliers.",
        "updated_count": updated_count
    }
