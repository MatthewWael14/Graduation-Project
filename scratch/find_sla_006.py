import sys
import os

sys.path.append(os.path.join(os.getcwd(), 'Backend'))
from knowledge_base.connection import graphdb
from knowledge_base.repository import PREFIXES

query = f"""{PREFIXES}
SELECT DISTINCT ?contract ?sLabel ?mLabel WHERE {{
    ?contract rdf:type :SLAContract .
    OPTIONAL {{ ?contract :hasSupplier ?s . ?s rdfs:label ?sLabel . }}
    OPTIONAL {{ ?contract :governsMaterial ?m . ?m rdfs:label ?mLabel . }}
}}
"""

try:
    results = graphdb.execute_sparql_select(query)
    print("SLA contracts in GraphDB:")
    for row in results:
        print(row)
except Exception as e:
    print("Error:", e)
