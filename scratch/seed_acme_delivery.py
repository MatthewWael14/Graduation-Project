import sys, os
sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..', 'Backend'))
from dotenv import load_dotenv
load_dotenv(os.path.join(os.path.dirname(__file__), '..', 'Backend', '.env'))
from knowledge_base.connection import graphdb

# ── Step 1: Find Acme supplier + Batteries material URIs ─────────
find_q = """
PREFIX : <http://example.org/ontology#>
PREFIX rdfs: <http://www.w3.org/2000/01/rdf-schema#>
SELECT DISTINCT ?sup ?mat WHERE {
    ?sup a :Supplier .
    FILTER NOT EXISTS { ?sup a :AlternativeSupplier . }
    OPTIONAL { ?sup rdfs:label ?sLbl . }
    FILTER(CONTAINS(LCASE(STR(COALESCE(?sLbl, REPLACE(STR(?sup), "^.*#", "")))), "acme"))
    ?sup :supplies ?mat .
    OPTIONAL { ?mat rdfs:label ?mLbl . }
    FILTER(CONTAINS(LCASE(STR(COALESCE(?mLbl, REPLACE(STR(?mat), "^.*#", "")))), "batter"))
}
"""
rows = graphdb.execute_sparql_select(find_q)
print("Acme + Batteries rows:", rows)

if not rows:
    print("ERROR: Could not find Acme supplier with Batteries material.")
    sys.exit(1)

sup_uri = rows[0]['sup']
mat_uri = rows[0]['mat']
print(f"Supplier: <{sup_uri}>")
print(f"Material: <{mat_uri}>")

DELIVERY_ID = "Delivery_Acme_Batteries_Main"
delivery_uri = f"http://example.org/ontology#{DELIVERY_ID}"
PO_ID = "PO_Acme_Batteries_001"
po_uri = f"http://example.org/ontology#{PO_ID}"

# ── Step 2: Create the delivery individual in GraphDB ─────────────
insert_q = f"""
PREFIX : <http://example.org/ontology#>
PREFIX rdf: <http://www.w3.org/1999/02/22-rdf-syntax-ns#>
PREFIX xsd: <http://www.w3.org/2001/XMLSchema#>
INSERT DATA {{
    GRAPH <http://example.org/contracts/> {{
        <{delivery_uri}> rdf:type :DeliveryEvent ;
                         :transports <{mat_uri}> ;
                         :isPerformedBy <{sup_uri}> ;
                         :hasDeliveryStatus "In_Transit"^^xsd:string ;
                         :hasDelayDuration 0 .
        <{po_uri}> rdf:type :PurchaseOrder ;
                   :issuedTo <{sup_uri}> ;
                   :hasOrderedQuantity 1500 .
        <{delivery_uri}> :fulfills <{po_uri}> .
    }}
}}
"""
graphdb.execute_sparql_update(insert_q)
print(f"\nSUCCESS: Created delivery individual:")
print(f"  delivery_id = \"{DELIVERY_ID}\"")
print(f"  transports  = <{mat_uri}>")
print(f"  PO quantity = 1500 units")
print(f"\nJSON for simulate-iot endpoint:")
print("""
{
  "delivery_id": "Delivery_Acme_Batteries_Main",
  "estimated_delay_hours": 120,
  "reason_code": "Supplier_Logistics_Delay",
  "disruption_probability": 0.85,
  "timestamp": "2026-06-27T13:00:00Z",
  "quantity": 1500
}
""")
