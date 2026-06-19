import sys
sys.path.insert(0, "Backend")
from dotenv import load_dotenv
load_dotenv("Backend/.env")
from knowledge_base.connection import graphdb

PREFIXES = """
PREFIX : <http://example.org/ontology#>
PREFIX rdf: <http://www.w3.org/1999/02/22-rdf-syntax-ns#>
PREFIX rdfs: <http://www.w3.org/2000/01/rdf-schema#>
PREFIX owl: <http://www.w3.org/2002/07/owl#>
PREFIX xsd: <http://www.w3.org/2001/XMLSchema#>
"""

# Query fields for Apex
q = f"""
{PREFIXES}
SELECT DISTINCT ?supplier ?supplierName ?material ?materialName ?leadTimeDays ?penalty
                ?reliabilityScore ?deliveryDeadline ?riskLevel ?penaltyRate ?clause ?createdAt
WHERE {{
    ?supplier rdf:type :Supplier ;
              :supplies ?material .
    OPTIONAL {{ ?supplier rdfs:label ?sLabel . }}
    OPTIONAL {{ ?supplier :hasName ?sName . }}
    BIND(COALESCE(?sLabel, ?sName, REPLACE(STR(?supplier), "^.*#", "")) AS ?supplierName)
    FILTER(CONTAINS(LCASE(?supplierName), "apex"))
    OPTIONAL {{ ?material rdfs:label ?mLabel . }}
    BIND(COALESCE(?mLabel, REPLACE(STR(?material), "^.*#", "")) AS ?materialName)
    OPTIONAL {{ ?supplier :leadTimeDays ?leadTimeDays . }}
    OPTIONAL {{ ?supplier :penaltyClause ?penalty . }}
    OPTIONAL {{ ?supplier :hasReliabilityScore ?reliabilityScore . }}
    OPTIONAL {{ ?supplier :deliveryDeadline ?deliveryDeadline . }}
    OPTIONAL {{ ?supplier :riskLevel ?riskLevel . }}
    OPTIONAL {{ ?supplier :penaltyRatePerDay ?penaltyRate . }}
    OPTIONAL {{ ?supplier :clause ?clause . }}
    OPTIONAL {{ ?supplier :createdAt ?createdAt . }}
}}
"""

rows = graphdb.execute_sparql_select(q)
print(f"Found {len(rows)} Apex rows. Showing first 20:")
for i, r in enumerate(rows[:20]):
    print(f"Row {i+1}:")
    for k, v in r.items():
        print(f"  {k}: {v}")
