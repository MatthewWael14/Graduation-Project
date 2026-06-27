"""
Cleans up duplicate IoT POs for Delivery_VoltSupply_Main
and resets delayed quantity to exactly 1000.
"""
import sys, os
sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..', 'Backend'))
from dotenv import load_dotenv
load_dotenv(os.path.join(os.path.dirname(__file__), '..', 'Backend', '.env'))
from knowledge_base.connection import graphdb

DELIVERY = "Delivery_VoltSupply_Main"
KEEP_QTY = int(sys.argv[1]) if len(sys.argv) > 1 else 1000

# Step 1: List all POs
check_q = f"""
PREFIX : <http://example.org/ontology#>
SELECT ?po ?qty WHERE {{
    :{DELIVERY} :fulfills ?po .
    OPTIONAL {{ ?po :hasOrderedQuantity ?qty . }}
}}
"""
rows = graphdb.execute_sparql_select(check_q)
print(f"POs linked to :{DELIVERY}:")
for r in rows:
    print(f"  {r.get('po')}  qty={r.get('qty','?')}")
total_before = sum(int(float(r.get('qty', 0) or 0)) for r in rows)
print(f"  TOTAL = {total_before}")

# Step 2: Delete ALL linked POs
delete_q = f"""
PREFIX : <http://example.org/ontology#>
PREFIX rdf: <http://www.w3.org/1999/02/22-rdf-syntax-ns#>
DELETE {{
    GRAPH ?g {{
        ?po rdf:type :PurchaseOrder ;
            :hasOrderedQuantity ?qty .
        :{DELIVERY} :fulfills ?po .
    }}
}}
WHERE {{
    GRAPH ?g {{
        :{DELIVERY} :fulfills ?po .
        ?po rdf:type :PurchaseOrder .
        OPTIONAL {{ ?po :hasOrderedQuantity ?qty . }}
    }}
}}
"""
graphdb.execute_sparql_update(delete_q)
print(f"\nDeleted all POs.")

# Step 3: Insert single canonical PO
insert_q = f"""
PREFIX : <http://example.org/ontology#>
PREFIX xsd: <http://www.w3.org/2001/XMLSchema#>
INSERT DATA {{
    GRAPH <http://example.org/contracts/> {{
        :PO_IoT_{DELIVERY} rdf:type :PurchaseOrder ;
                           :hasOrderedQuantity {KEEP_QTY} .
        :{DELIVERY} :fulfills :PO_IoT_{DELIVERY} .
    }}
}}
"""
graphdb.execute_sparql_update(insert_q)

# Step 4: Verify
rows2 = graphdb.execute_sparql_select(check_q)
total = sum(int(float(r.get('qty', 0) or 0)) for r in rows2)
print(f"Re-inserted single PO with qty={KEEP_QTY}")
print(f"Verification: TOTAL delayed qty = {total}  (should be {KEEP_QTY})")
print("Refresh the dashboard to confirm.")
