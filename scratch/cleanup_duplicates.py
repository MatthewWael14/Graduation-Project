import sys
sys.path.insert(0, "Backend")
from dotenv import load_dotenv
load_dotenv("Backend/.env")
from knowledge_base.connection import graphdb

PREFIXES = """
PREFIX : <http://example.org/ontology#>
PREFIX rdf: <http://www.w3.org/1999/02/22-rdf-syntax-ns#>
"""

def cleanup():
    # Find all suppliers
    q_sups = f"""
    {PREFIXES}
    SELECT DISTINCT ?supplier WHERE {{
        ?supplier rdf:type :Supplier .
    }}
    """
    suppliers = [r['supplier'] for r in graphdb.execute_sparql_select(q_sups)]
    print(f"Found {len(suppliers)} suppliers. Cleaning up duplicate properties...")

    for supplier_uri in suppliers:
        supplier_ref = f"<{supplier_uri}>"
        
        # 1. Cleanup leadTimeDays
        q_lead = f"""
        {PREFIXES}
        SELECT ?val WHERE {{
            GRAPH <http://example.org/contracts/> {{
                {supplier_ref} :leadTimeDays ?val .
            }}
        }}
        """
        leads = [r['val'] for r in graphdb.execute_sparql_select(q_lead)]
        if len(leads) > 1:
            print(f"Supplier {supplier_uri} has duplicate leadTimeDays: {leads}")
            keep_val = leads[0]
            # Delete all
            del_q = f"""
            {PREFIXES}
            DELETE WHERE {{
                GRAPH <http://example.org/contracts/> {{
                    {supplier_ref} :leadTimeDays ?val .
                }}
            }}
            """
            graphdb.execute_sparql_update(del_q)
            # Reinsert one
            ins_q = f"""
            {PREFIXES}
            INSERT DATA {{
                GRAPH <http://example.org/contracts/> {{
                    {supplier_ref} :leadTimeDays {keep_val} .
                }}
            }}
            """
            graphdb.execute_sparql_update(ins_q)
            print(f"  -> Kept {keep_val}")

        # 2. Cleanup penaltyClause
        q_pen = f"""
        {PREFIXES}
        SELECT ?val WHERE {{
            GRAPH <http://example.org/contracts/> {{
                {supplier_ref} :penaltyClause ?val .
            }}
        }}
        """
        pens = [r['val'] for r in graphdb.execute_sparql_select(q_pen)]
        if len(pens) > 1:
            print(f"Supplier {supplier_uri} has duplicate penaltyClause: {pens}")
            keep_val = pens[0].replace('"', '\\"')
            # Delete all
            del_q = f"""
            {PREFIXES}
            DELETE WHERE {{
                GRAPH <http://example.org/contracts/> {{
                    {supplier_ref} :penaltyClause ?val .
                }}
            }}
            """
            graphdb.execute_sparql_update(del_q)
            # Reinsert one
            ins_q = f"""
            {PREFIXES}
            INSERT DATA {{
                GRAPH <http://example.org/contracts/> {{
                    {supplier_ref} :penaltyClause "{keep_val}" .
                }}
            }}
            """
            graphdb.execute_sparql_update(ins_q)
            print(f"  -> Kept {keep_val}")

        # 3. Cleanup hasReliabilityScore
        q_score = f"""
        {PREFIXES}
        SELECT ?val WHERE {{
            GRAPH <http://example.org/contracts/> {{
                {supplier_ref} :hasReliabilityScore ?val .
            }}
        }}
        """
        scores = [r['val'] for r in graphdb.execute_sparql_select(q_score)]
        if len(scores) > 1:
            print(f"Supplier {supplier_uri} has duplicate reliability scores: {scores}")
            keep_val = scores[0]
            # Delete all
            del_q = f"""
            {PREFIXES}
            DELETE WHERE {{
                GRAPH <http://example.org/contracts/> {{
                    {supplier_ref} :hasReliabilityScore ?val .
                }}
            }}
            """
            graphdb.execute_sparql_update(del_q)
            # Reinsert one
            ins_q = f"""
            {PREFIXES}
            INSERT DATA {{
                GRAPH <http://example.org/contracts/> {{
                    {supplier_ref} :hasReliabilityScore "{keep_val}"^^xsd:float .
                }}
            }}
            """
            graphdb.execute_sparql_update(ins_q)
            print(f"  -> Kept {keep_val}")

if __name__ == "__main__":
    cleanup()
