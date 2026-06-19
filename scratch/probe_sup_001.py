import sys
sys.path.insert(0, "Backend")
from dotenv import load_dotenv
load_dotenv("Backend/.env")
from knowledge_base.connection import graphdb

PREFIXES = """
PREFIX : <http://example.org/ontology#>
PREFIX rdf: <http://www.w3.org/1999/02/22-rdf-syntax-ns#>
PREFIX rdfs: <http://www.w3.org/2000/01/rdf-schema#>
"""

q = f"""
{PREFIXES}
SELECT ?p ?o WHERE {{
    :Supplier_SUP_001 ?p ?o .
}}
"""

rows = graphdb.execute_sparql_select(q)
print(f"Supplier_SUP_001 has {len(rows)} triples:")
for r in sorted(rows, key=lambda x: x['p']):
    print(f"  {r['p']} -> {r['o']}")
