import sys
import os

sys.path.append(os.path.join(os.getcwd(), 'Backend'))
from knowledge_base.connection import graphdb
from knowledge_base.repository import PREFIXES

delivery_id = "DEL_PO_1782482045"

query = f"""{PREFIXES}
SELECT ?supplierId ?supplierName ?poType ?supplierRegion ?supplierTier ?paymentTerms 
       ?material ?materialLabel ?unitOfMeasure ?hasUnitCost ?discountPct ?taxPct ?savingsPct 
       ?leadTimeDays ?department ?contractType ?maverickSpend ?singleSourceFlag 
       ?preferredSupplier ?localInternational ?esgScore ?hasCurrency ?lineNet ?slaLeadTimeHours
WHERE {{
    GRAPH <http://example.org/contracts/> {{
        BIND(:{delivery_id} AS ?delivery)
        ?delivery a :DeliveryEvent ;
                  :transports ?material .
        
        OPTIONAL {{ ?delivery :poType ?poType . }}
        OPTIONAL {{ ?delivery :supplierRegion ?supplierRegion . }}
        OPTIONAL {{ ?delivery :paymentTerms ?paymentTerms . }}
        OPTIONAL {{ ?delivery :unitOfMeasure ?unitOfMeasure . }}
        OPTIONAL {{ ?delivery :hasUnitCost ?hasUnitCost . }}
        OPTIONAL {{ ?delivery :discountPct ?discountPct . }}
        OPTIONAL {{ ?delivery :taxPct ?taxPct . }}
        OPTIONAL {{ ?delivery :lineNet ?lineNet . }}
        OPTIONAL {{ ?delivery :hasCurrency ?hasCurrency . }}
        OPTIONAL {{ ?delivery :savingsPct ?savingsPct . }}
        OPTIONAL {{ ?delivery :department ?department . }}
        OPTIONAL {{ ?delivery :contractType ?contractType . }}
        OPTIONAL {{ ?delivery :maverickSpend ?maverickSpend . }}
    }}
    
    # Link supplier (graph-agnostic ontology lookup)
    {{ ?supplier :supplies ?material . }} UNION {{ ?material :isSuppliedBy ?supplier . }}
    OPTIONAL {{ ?supplier rdfs:label ?sLabel . }}
    OPTIONAL {{ ?supplier :hasName ?sName . }}
    BIND(COALESCE(?sLabel, ?sName) AS ?supplierName)
    BIND(REPLACE(STR(?supplier), "^.*#", "") AS ?supplierId)
    
    OPTIONAL {{ ?supplier :hasReliabilityTier ?supplierTier . }}
    OPTIONAL {{ ?supplier :hasReliabilityScore ?esgScore . }}
    OPTIONAL {{ 
        ?contract rdf:type :SLAContract ;
                  :hasSupplier ?supplier ;
                  :governsMaterial ?material ;
                  :leadTimeDays ?leadTimeDays .
    }}
    OPTIONAL {{
        {{ ?supplier :hasSLA ?sla . }} UNION {{ ?sla :governs ?supplier . }}
        OPTIONAL {{ ?sla :hasSLALeadTime ?slaLeadTimeHours . }}
        OPTIONAL {{ ?sla :singleSourceFlag ?singleSourceFlag . }}
        OPTIONAL {{ ?sla :preferredSupplier ?preferredSupplier . }}
        OPTIONAL {{ ?sla :localInternational ?localInternational . }}
    }}
    OPTIONAL {{ ?material rdfs:label ?materialLabel . }}
}}
LIMIT 1
"""

try:
    results = graphdb.execute_sparql_select(query)
    print("Query results:")
    print(results)
except Exception as e:
    print("Error:", e)
