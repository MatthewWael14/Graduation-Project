from knowledge_base.connection import graphdb
from knowledge_base.repository import PREFIXES

query = f"""
{PREFIXES}
SELECT DISTINCT ?process ?label
WHERE {{
    ?process rdf:type :ProductionProcess .
    OPTIONAL {{ ?process rdfs:label ?label . }}
}}
"""
results = graphdb.execute_sparql_select(query)
for r in results:
    print(r)
