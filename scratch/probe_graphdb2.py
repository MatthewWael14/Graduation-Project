"""Probe: test the compliance alerts supplier query timing."""
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

# The compliance alerts supplier query from get_compliance_alerts()
q_compliance = f"""
{PREFIXES}
SELECT DISTINCT ?supplierName ?materialName ?leadTimeDays ?penalty
                ?reliabilityScore ?deliveryDeadline ?riskLevel ?penaltyRate ?clause
WHERE {{
    ?supplier rdf:type :Supplier ;
              :supplies ?material .
    ?material rdf:type :RawMaterial .
    OPTIONAL {{ ?supplier rdfs:label ?sLabel . }}
    OPTIONAL {{ ?supplier :hasName ?sName . }}
    BIND(COALESCE(?sLabel, ?sName, REPLACE(STR(?supplier), "^.*#", "")) AS ?supplierName)
    OPTIONAL {{ ?material rdfs:label ?mLabel . }}
    BIND(COALESCE(?mLabel, REPLACE(STR(?material), "^.*#", "")) AS ?materialName)
    OPTIONAL {{ ?supplier :leadTimeDays ?leadTimeDays . }}
    OPTIONAL {{ ?supplier :penaltyClause ?penalty . }}
    OPTIONAL {{ ?supplier :hasReliabilityScore ?reliabilityScore . }}
    OPTIONAL {{ ?supplier :deliveryDeadline ?deliveryDeadline . }}
    OPTIONAL {{ ?material :deliveryDeadline ?materialDeadline . }}
    OPTIONAL {{ ?supplier :riskLevel ?riskLevel . }}
    OPTIONAL {{ ?supplier :penaltyRatePerDay ?penaltyRate . }}
    OPTIONAL {{ ?supplier :clause ?clause . }}
}}
ORDER BY ?supplierName
"""

# The risk scores supplier query from get_risk_scores()
q_riskscores = f"""
{PREFIXES}
SELECT DISTINCT ?supplierName ?materialName ?productName ?reliabilityScore ?leadTimeDays ?country
WHERE {{
    ?supplier rdf:type :Supplier ;
              :supplies ?material .
    ?material rdf:type :RawMaterial .
    OPTIONAL {{ ?supplier rdfs:label ?sLabel . }}
    OPTIONAL {{ ?supplier :hasName ?sName . }}
    BIND(COALESCE(?sLabel, ?sName, REPLACE(STR(?supplier), "^.*#", "")) AS ?supplierName)
    OPTIONAL {{ ?material rdfs:label ?mLabel . }}
    BIND(COALESCE(?mLabel, REPLACE(STR(?material), "^.*#", "")) AS ?materialName)
    OPTIONAL {{
        ?material :affectsProcess ?process .
        OPTIONAL {{ ?process rdfs:label ?pLabel . }}
        BIND(COALESCE(?pLabel, REPLACE(STR(?process), "^.*#", "")) AS ?productName)
    }}
    OPTIONAL {{ ?supplier :hasReliabilityScore ?reliabilityScore . }}
    OPTIONAL {{ ?supplier :leadTimeDays ?leadTimeDays . }}
    OPTIONAL {{ ?supplier :country ?country . }}
}}
"""

for label, q in [("Compliance alerts supplier query", q_compliance), ("Risk scores supplier query", q_riskscores)]:
    t0 = time.time()
    rows = graphdb.execute_sparql_select(q)
    print(f"[{time.time()-t0:.2f}s] {label}: {len(rows)} rows")
