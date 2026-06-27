"""
Cleans up duplicate IoT-generated POs for a delivery.
Keeps only one PO_IoT_<delivery> with the correct quantity.
"""
import sys, os
sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..', 'Backend'))
from dotenv import load_dotenv
load_dotenv(os.path.join(os.path.dirname(__file__), '..', 'Backend', '.env'))
from knowledge_base.connection import graphdb

DELIVERY = "Delivery_Acme_Batteries_Main"
KEEP_QTY = 1500  # the correct quantity

# Delete ALL IoT POs linked to this delivery
delete_q = f"""
PREFIX : <http://example.org/ontology#>
DELETE {{
    GRAPH ?g {{
        ?po :hasOrderedQuantity ?qty .
        ?po rdf:type :PurchaseOrder .
        :{DELIVERY} :fulfills ?po .
    }}
}}
WHERE {{
    GRAPH ?g {{
        :{DELIVERY} :fulfills ?po .
        ?po rdf:type :PurchaseOrder .
        OPTIONAL {{ ?po :hasOrderedQuantity ?qty . }}
        FILTER(CONTAINS(STR(?po), "PO_IoT_"))
    }}
}}
"""
graphdb.execute_sparql_update(delete_q)
print("Deleted old IoT POs.")

# Re-insert exactly one clean PO
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
print(f"Re-inserted single PO with quantity = {KEEP_QTY}")
print("Refresh the dashboard to confirm Delayed Quantity = 1500.")
