import sys
import os

sys.path.append(os.path.join(os.getcwd(), 'Backend'))
from knowledge_base.connection import graphdb
from knowledge_base.repository import PREFIXES

query = f"""{PREFIXES}
SELECT DISTINCT ?s ?p ?o WHERE {{
    ?s ?p ?o .
    FILTER(CONTAINS(STR(?s), "VoltSupply") || CONTAINS(STR(?o), "VoltSupply") || CONTAINS(STR(?s), "Contract") || CONTAINS(STR(?o), "Contract"))
}}
"""

try:
    results = graphdb.execute_sparql_select(query)
    print("VoltSupply and Contract occurrences:")
    subjects = set()
    for row in results:
        subjects.add(row['s'])
    for s in sorted(list(subjects)):
        print(s)
except Exception as e:
    print("Error:", e)
