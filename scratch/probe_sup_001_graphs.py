import sys
sys.path.insert(0, "Backend")
from dotenv import load_dotenv
load_dotenv("Backend/.env")
from knowledge_base.connection import graphdb

PREFIXES = """
PREFIX : <http://example.org/ontology#>
PREFIX rdf: <http://www.w3.org/1999/02/22-rdf-syntax-ns#>
"""

q = """
SELECT ?delivery ?status ?material WHERE {
    ?delivery rdf:type <http://example.org/ontology#DeliveryEvent> .
    OPTIONAL { ?delivery <http://example.org/ontology#hasDeliveryStatus> ?status . }
    OPTIONAL { ?delivery <http://example.org/ontology#transports> ?material . }
}
"""
rows = graphdb.execute_sparql_select(q)
print("Delivery events in GraphDB:")
for r in rows:
    print(f"Delivery: {r.get('delivery')} | Status: {r.get('status')} | Material: {r.get('material')}")




