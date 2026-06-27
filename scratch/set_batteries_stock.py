import sys, os
sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..', 'Backend'))
from dotenv import load_dotenv
load_dotenv(os.path.join(os.path.dirname(__file__), '..', 'Backend', '.env'))
from knowledge_base.connection import graphdb

TARGET_STOCK = int(sys.argv[1]) if len(sys.argv) > 1 else 2000

# Find Batteries / battery material
find_q = """
PREFIX : <http://example.org/ontology#>
PREFIX rdfs: <http://www.w3.org/2000/01/rdf-schema#>
SELECT ?mat ?lbl ?stock WHERE {
    ?mat a :RawMaterial .
    OPTIONAL { ?mat rdfs:label ?lbl . }
    OPTIONAL { ?mat :hasInventoryStock ?stock . }
    FILTER(
        CONTAINS(LCASE(STR(COALESCE(?lbl, REPLACE(STR(?mat), "^.*#", "")))), "batter")
        || REPLACE(STR(?mat), "^.*#", "") = "Batteries"
    )
}
"""
rows = graphdb.execute_sparql_select(find_q)
if not rows:
    print("ERROR: No 'Batteries' material found in GraphDB.")
    sys.exit(1)

for r in rows:
    print(f"  Found: <{r.get('mat')}>  label={r.get('lbl','?')}  stock={r.get('stock', 'none')}")

# Prefer exact label match "Batteries" over partial matches like Lithium_Ion_Battery_Pack
exact = [r for r in rows if str(r.get('lbl', '')).lower() == 'batteries'
         or r.get('mat','').endswith('#Batteries')]
chosen = exact[0] if exact else rows[0]
mat_uri = chosen['mat']
print(f"  Targeting: <{mat_uri}>")

update_q = f"""
PREFIX : <http://example.org/ontology#>
PREFIX xsd: <http://www.w3.org/2001/XMLSchema#>
DELETE {{ GRAPH ?g {{ <{mat_uri}> :hasInventoryStock ?old . }} }}
WHERE  {{ GRAPH ?g {{ <{mat_uri}> :hasInventoryStock ?old . }} }} ;
INSERT DATA {{
    GRAPH <http://example.org/contracts/> {{
        <{mat_uri}> :hasInventoryStock {TARGET_STOCK} .
    }}
}}
"""
graphdb.execute_sparql_update(update_q)
print(f"SUCCESS: hasInventoryStock = {TARGET_STOCK} set for <{mat_uri}>")
print("Refresh the Inventory Risk page - the row should update.")
