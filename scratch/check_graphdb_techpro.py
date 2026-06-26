import sys
import os

sys.path.append(os.path.join(os.getcwd(), 'Backend'))
from knowledge_base.connection import graphdb

query = """
SELECT ?s ?p ?o 
WHERE { 
    ?s ?p ?o . 
    FILTER(contains(str(?s), 'TechPro') || contains(str(?o), 'TechPro')) 
}
"""

try:
    results = graphdb.execute_sparql_select(query)
    print("Found triples:", len(results))
    for r in results[:10]:
        print(f"s: {r['s']}, p: {r['p']}, o: {r['o']}")
except Exception as e:
    print("Error:", e)
