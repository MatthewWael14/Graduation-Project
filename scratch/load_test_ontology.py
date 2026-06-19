import os
import sys
import rdflib

# Allow importing backend modules by adding the Backend folder to Python Path
SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))
PROJECT_ROOT = os.path.dirname(SCRIPT_DIR)
sys.path.insert(0, os.path.join(PROJECT_ROOT, "Backend"))

from dotenv import load_dotenv
load_dotenv(os.path.join(PROJECT_ROOT, "Backend", ".env"))
from knowledge_base.connection import graphdb

# Configuration
TEST_REPO = "SemanticDigitalTest"
ontology_path = os.path.join(PROJECT_ROOT, "Data_Science", "ontology", ".rdf")

ONTOLOGY_GRAPH = "http://example.org/ontology/"
CONTRACT_GRAPH = "http://example.org/contracts/"

# Override GraphDB connection endpoints to target the test repository explicitly
graphdb_url = os.getenv("GRAPHDB_URL", "http://localhost:7200")
graphdb._query_endpoint = f"{graphdb_url}/repositories/{TEST_REPO}"
graphdb._update_endpoint = f"{graphdb_url}/repositories/{TEST_REPO}/statements"

def run():
    print("=" * 60)
    print(f"  LOADING TEST ONTOLOGY TO REPOSITORY: {TEST_REPO}")
    print("=" * 60)

    if not os.path.exists(ontology_path):
        print(f"[-] Error: Test ontology file not found at {ontology_path}")
        sys.exit(1)

    print(f"[*] Parsing test ontology RDF file: {ontology_path}")
    g = rdflib.Graph()
    g.parse(ontology_path, format="xml")
    print(f"[+] Loaded test ontology with {len(g)} triples.")

    # Convert to N-Triples
    print("[*] Converting to N-Triples...")
    nt_data = g.serialize(format="nt")
    if isinstance(nt_data, bytes):
        nt_data = nt_data.decode("utf-8")

    lines = nt_data.splitlines()
    print(f"[+] Generated {len(lines)} N-Triples lines.")

    # Sort into Schema and Instance triples
    schema_lines = []
    instance_lines = []

    # Get a list of class/property namespace fragments or naming prefixes for instances
    # to separate schema vs contract graph instance data
    for line in lines:
        line_clean = line.strip()
        if not line_clean or line_clean.startswith("#"):
            continue

        parts = line_clean.split(None, 2)
        if len(parts) < 3:
            continue
        
        s = parts[0]
        p = parts[1]
        o = parts[2]

        is_instance = False
        # If it's a known instance pattern or explicitly typed NamedIndividual, put in contracts graph
        if s.startswith("<http://example.org/ontology#"):
            frag = s.split("#", 1)[1].rstrip(">")
            if (frag.startswith("PO_") or 
                frag.startswith("DEL_") or 
                frag.startswith("Truck_") or 
                frag.startswith("Delivery_") or
                any(prefix in frag for prefix in ["VoltSupply", "EcoLithium", "Apex", "Aura_Steel", "Steel_Supply"])):
                is_instance = True

        if p == "<http://www.w3.org/1999/02/22-rdf-syntax-ns#type>" and o.startswith("<http://www.w3.org/2002/07/owl#NamedIndividual>"):
            is_instance = True

        if is_instance:
            instance_lines.append(line_clean)
        else:
            schema_lines.append(line_clean)

    print(f"[+] Sorted: {len(schema_lines)} Schema lines and {len(instance_lines)} Instance lines.")

    print(f"[*] Clearing all graphs in {TEST_REPO}...")
    try:
        graphdb.execute_sparql_update("CLEAR ALL")
        
        # Batch load Schema lines
        print(f"[*] Loading Schema triples into {ONTOLOGY_GRAPH}...")
        batch_size = 150
        for i in range(0, len(schema_lines), batch_size):
            batch = schema_lines[i : i + batch_size]
            sparql_insert = f"INSERT DATA {{ GRAPH <{ONTOLOGY_GRAPH}> {{ {' '.join(batch)} }} }}"
            graphdb.execute_sparql_update(sparql_insert)
            sys.stdout.write(f"\r    Loaded {min(i + batch_size, len(schema_lines))} / {len(schema_lines)} schema triples...")
            sys.stdout.flush()
        
        # Batch load Instance lines
        print(f"\n[*] Loading Instance triples into {CONTRACT_GRAPH}...")
        for i in range(0, len(instance_lines), batch_size):
            batch = instance_lines[i : i + batch_size]
            sparql_insert = f"INSERT DATA {{ GRAPH <{CONTRACT_GRAPH}> {{ {' '.join(batch)} }} }}"
            graphdb.execute_sparql_update(sparql_insert)
            sys.stdout.write(f"\r    Loaded {min(i + batch_size, len(instance_lines))} / {len(instance_lines)} instance triples...")
            sys.stdout.flush()

        print(f"\n[+] SUCCESS! Test GraphDB repository {TEST_REPO} re-seeded successfully.")
    except Exception as e:
        print(f"\n[-] Failed to update GraphDB: {e}")
        print("[-] Please ensure that GraphDB is running on http://localhost:7200 and the repository exists.")

if __name__ == "__main__":
    run()
