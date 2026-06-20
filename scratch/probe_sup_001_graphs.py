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
PREFIX owl: <http://www.w3.org/2002/07/owl#>
SELECT ?class WHERE {
    ?class a owl:Class .
    FILTER(
        contains(str(?class), "LiquidMaterial") ||
        contains(str(?class), "SolidMaterial") ||
        contains(str(?class), "CoatingProcess") ||
        contains(str(?class), "FinalAssembly")
    )
}
"""
rows = graphdb.execute_sparql_select(q)
print("Remaining target classes in GraphDB:", len(rows))
for r in rows:
    print(r.get("class"))





