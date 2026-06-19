"""
Quick probe: test each dashboard SPARQL query directly against GraphDB.
Run with: Backend/venv/Scripts/python.exe scratch/probe_graphdb.py
"""
import sys, time
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

queries = {
    "1. Count suppliers": f"{PREFIXES} SELECT (COUNT(DISTINCT ?supplier) AS ?count) WHERE {{ ?supplier rdf:type :Supplier . }}",
    "2. Avg lead time":   f"{PREFIXES} SELECT (AVG(?lt) AS ?avg) WHERE {{ ?s rdf:type :Supplier ; :leadTimeDays ?lt . }}",
    "3. SLA contracts":   f"{PREFIXES} SELECT (COUNT(DISTINCT ?s) AS ?count) WHERE {{ ?s rdf:type :Supplier ; :penaltyClause ?p . }}",
    "4. SystemAlerts":    f"{PREFIXES} SELECT (COUNT(DISTINCT ?a) AS ?count) WHERE {{ ?a rdf:type :SystemAlert ; :hasStatus ?st . FILTER(?st != 'DISMISSED') }}",
    "5. Impacted products (heavy)": f"""
{PREFIXES}
SELECT DISTINCT ?supplierLabel ?materialLabel ?productLabel ?riskStatus ?delayHours
WHERE {{
    ?delivery rdf:type :DeliveryEvent ;
               :hasDeliveryStatus ?status ;
               :transports ?material .
    FILTER(STR(?status) = "Delayed")
    OPTIONAL {{ ?delivery :hasDelayDuration ?delayHours . }}
    OPTIONAL {{
        {{ ?supplier :supplies ?material . }}
        UNION {{ ?material :isSuppliedBy ?supplier . }}
        OPTIONAL {{ ?supplier rdfs:label ?sLabel . }}
        OPTIONAL {{ ?supplier :hasName ?sName . }}
    }}
    BIND(COALESCE(?sLabel, ?sName, REPLACE(STR(?supplier), "^.*#", "")) AS ?supplierLabel)
    OPTIONAL {{ ?material rdfs:label ?mLabel . }}
    BIND(COALESCE(?mLabel, REPLACE(STR(?material), "^.*#", "")) AS ?materialLabel)
    ?material :affectsProcess ?process .
    OPTIONAL {{ ?process rdfs:label ?pLabel . }}
    BIND(COALESCE(?pLabel, REPLACE(STR(?process), "^.*#", "")) AS ?productLabel)
    ?process rdf:type :ProductionDisruption .
    BIND("true" AS ?riskStatus)
}}
ORDER BY ?productLabel
""",
}

for name, q in queries.items():
    t0 = time.time()
    try:
        rows = graphdb.execute_sparql_select(q)
        elapsed = time.time() - t0
        print(f"[OK  {elapsed:.2f}s] {name} -> {rows}")
    except Exception as e:
        elapsed = time.time() - t0
        print(f"[ERR {elapsed:.2f}s] {name} -> {e}")
