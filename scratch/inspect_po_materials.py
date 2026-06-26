import sys
sys.path.insert(0, "Backend")
from dotenv import load_dotenv
load_dotenv("Backend/.env")
from knowledge_base.connection import graphdb

PREFIXES = """
PREFIX : <http://example.org/ontology#>
PREFIX rdf: <http://www.w3.org/1999/02/22-rdf-syntax-ns#>
"""

query = f"""
{PREFIXES}
SELECT ?g ?s ?p ?o
WHERE {{
    GRAPH ?g {{
        ?s ?p ?o .
        FILTER(?s IN (:PO_VoltSupply_001, :PO_EcoLithium_001))
    }}
}}
"""

rows = graphdb.execute_sparql_select(query)
print(f"Found {len(rows)} PO triples:")
for row in rows:
    print(f"Graph: {row['g']} | {row['s']} {row['p']} {row['o']}")
