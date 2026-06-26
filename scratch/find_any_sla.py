import sys
import os

sys.path.append(os.path.join(os.getcwd(), 'Backend'))
from knowledge_base.connection import graphdb
from knowledge_base.repository import PREFIXES

query = f"""{PREFIXES}
SELECT DISTINCT ?s ?p ?o WHERE {{
    ?s ?p ?o .
    FILTER(CONTAINS(LCASE(STR(?s)), "006") || CONTAINS(LCASE(STR(?o)), "006") || CONTAINS(LCASE(STR(?s)), "sla-") || CONTAINS(LCASE(STR(?o)), "sla-"))
}}
"""

try:
    results = graphdb.execute_sparql_select(query)
    print("Matches for '006' or 'sla-':")
    for row in results:
        print(row)
except Exception as e:
    print("Error:", e)
