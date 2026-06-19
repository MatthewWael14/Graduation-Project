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

# File paths
ontology_path = os.path.join(PROJECT_ROOT, "Data_Science", "ontology", "Semantic Digital Twin Project.rdf")
inferred_path = os.path.join(PROJECT_ROOT, "Data_Science", "ontology", "Semantic Digital Twin Project Inferred.rdf")

# Named graphs
ONTOLOGY_GRAPH = "http://example.org/ontology/"
CONTRACT_GRAPH = "http://example.org/contracts/"

# Namespaces
NS = rdflib.Namespace("http://example.org/ontology#")
OWL = rdflib.OWL
RDF = rdflib.RDF
RDFS = rdflib.RDFS
XSD = rdflib.XSD

# 1. Redundant/Unnecessary individuals to delete
REDUNDANT = {
    "Supplier_LateTest", "SLA_LateTest", "PO_LateTest", "Del_LateTest",
    "PO_Test", "Del_Test"
}

# 2. Renaming Map for remaining necessary individuals
RENAMING_MAP = {
    "Supplier_Incumbent": "VoltSupply_Global",
    "Supplier_Alternative": "EcoLithium_Alternate",
    "Supplier_A": "Apex_Electronics",
    "Risky_Supplier": "Aura_Steel_Co",
    "Material_X": "Lithium_Ion_Battery_Pack",
    "Material": "Structural_Steel_Sheet",
    "Engine_Part": "Electric_Motor_Rotor",
    "Critical_Component": "Microcontroller_Chip",
    "SLA_Contract": "SLA_VoltSupply_Standard",
    "SLA_Gold": "SLA_EcoLithium_Premium",
    "SLA_101": "SLA_AuraSteel_Standard",
    "PO_100": "PO_VoltSupply_001",
    "PO_200": "PO_EcoLithium_001",
    "Truck_001": "Truck_VoltSupply_Main",
    "Truck_505": "Truck_Apex_Secondary",
    "Delivery_001": "Delivery_VoltSupply_Main",
    "Delivery_007": "Delivery_AuraSteel_Delayed",
    "Delivery_Quality_Test": "Delivery_EcoLithium_Quality",
    "Delivery_Shortage": "Delivery_VoltSupply_Shortage",
    "Main_Assembly_Line": "EV_Battery_Assembly_Line",
    "Assembly_Line_01": "Electronics_SubAssembly_Line",
    "Delay_Log_X": "Storm_Disruption_Log",
    "Log_001": "Customs_Delay_Log"
}

# 3. Literal labels renaming map
LITERAL_MAP = {
    "Supplier_Incumbent": "VoltSupply Global",
    "Supplier_Alternative": "EcoLithium Alternate",
    "Supplier_A": "Apex Electronics",
    "Risky_Supplier": "Aura Steel Co",
    "Material_X": "Lithium-Ion Battery Pack",
    "Material": "Structural Steel Sheet",
    "Engine_Part": "Electric Motor Rotor",
    "Critical_Component": "Microcontroller Chip",
    "Main_Assembly_Line": "EV Battery Assembly Line",
    "Assembly_Line_01": "Electronics Sub-Assembly Line",
    "Delay_Log_X": "Storm Disruption Log",
    "Log_001": "Customs Delay Log"
}

def rename_node(node):
    if isinstance(node, rdflib.URIRef):
        node_str = str(node)
        if "#" in node_str:
            base, fragment = node_str.split("#", 1)
            if fragment in REDUNDANT:
                return None
            if fragment in RENAMING_MAP:
                return rdflib.URIRef(f"{base}#{RENAMING_MAP[fragment]}")
    return node

def get_literal_replacement(old_frag, p_frag, current_lit):
    if old_frag in LITERAL_MAP:
        if p_frag in ("label", "hasName"):
            return rdflib.Literal(LITERAL_MAP[old_frag])
    return current_lit

def run():
    print("=" * 60)
    print("  RENAMING ONTOLOGY INDIVIDUALS & CLEANING REDUNDANCIES")
    print("=" * 60)

    # Load base ontology
    print(f"[*] Parsing ontology RDF file: {ontology_path}")
    g_old = rdflib.Graph()
    g_old.parse(ontology_path)
    print(f"[+] Loaded ontology with {len(g_old)} triples.")

    # Create new graph for renamed triples
    g_new = rdflib.Graph()
    for prefix, namespace in g_old.namespaces():
        g_new.bind(prefix, namespace)
    g_new.bind("", NS)

    # Process all triples
    print("[*] Processing triples...")
    ignored_count = 0
    renamed_s_count = 0
    renamed_o_count = 0
    renamed_lit_count = 0

    for s, p, o in g_old:
        s_renamed = rename_node(s)
        if s_renamed is None:
            ignored_count += 1
            continue

        o_renamed = rename_node(o)
        if o_renamed is None:
            ignored_count += 1
            continue

        if s_renamed != s:
            renamed_s_count += 1

        if isinstance(o, rdflib.URIRef):
            if o_renamed != o:
                renamed_o_count += 1
        elif isinstance(o, rdflib.Literal):
            s_str = str(s)
            if "#" in s_str:
                s_frag = s_str.split("#", 1)[1]
                p_str = str(p)
                p_frag = p_str.split("#", 1)[1] if "#" in p_str else p_str.split("/")[-1]
                new_lit = get_literal_replacement(s_frag, p_frag, o)
                if new_lit != o:
                    o_renamed = new_lit
                    renamed_lit_count += 1

        g_new.add((s_renamed, p, o_renamed))

    print(f"[+] Renaming complete.")
    print(f"    - Ignored {ignored_count} triples related to redundant individuals.")
    print(f"    - Renamed {renamed_s_count} subject URIs.")
    print(f"    - Renamed {renamed_o_count} object URIs.")
    print(f"    - Renamed {renamed_lit_count} literal values.")
    # Ensure VoltSupply_Global has a reliability score of 0.85 and lead time of 14 days
    v_uri = rdflib.URIRef("http://example.org/ontology#VoltSupply_Global")
    g_new.add((v_uri, rdflib.URIRef("http://example.org/ontology#hasReliabilityScore"), rdflib.Literal(0.85, datatype=rdflib.XSD.float)))
    g_new.add((v_uri, rdflib.URIRef("http://example.org/ontology#leadTimeDays"), rdflib.Literal(14, datatype=rdflib.XSD.integer)))
    # Ensure Apex_Electronics has supplies, lead time of 10 days, and penalty rate of $400/day
    a_uri = rdflib.URIRef("http://example.org/ontology#Apex_Electronics")
    r_uri = rdflib.URIRef("http://example.org/ontology#Electric_Motor_Rotor")
    g_new.add((a_uri, rdflib.URIRef("http://example.org/ontology#supplies"), r_uri))
    g_new.add((a_uri, rdflib.URIRef("http://example.org/ontology#leadTimeDays"), rdflib.Literal(10, datatype=rdflib.XSD.integer)))
    g_new.add((a_uri, rdflib.URIRef("http://example.org/ontology#penaltyRatePerDay"), rdflib.Literal(400, datatype=rdflib.XSD.integer)))
    g_new.add((a_uri, rdflib.URIRef("http://example.org/ontology#penaltyClause"), rdflib.Literal("SLA Penalty: $400 per day after 2-day grace period")))

    # Ensure Apex_Electronics also supplies Structural_Steel_Sheet to resolve Unknown supplier
    s_steel = rdflib.URIRef("http://example.org/ontology#Structural_Steel_Sheet")
    g_new.add((a_uri, rdflib.URIRef("http://example.org/ontology#supplies"), s_steel))

    # Create Delivery_Apex_Delayed to represent an active 5-day delay for Apex_Electronics
    del_apex = rdflib.URIRef("http://example.org/ontology#Delivery_Apex_Delayed")
    g_new.add((del_apex, rdflib.RDF.type, rdflib.URIRef("http://example.org/ontology#DeliveryEvent")))
    g_new.add((del_apex, rdflib.RDF.type, rdflib.OWL.NamedIndividual))
    g_new.add((del_apex, rdflib.URIRef("http://example.org/ontology#transports"), r_uri))
    g_new.add((del_apex, rdflib.URIRef("http://example.org/ontology#hasDeliveryStatus"), rdflib.Literal("Delayed")))
    g_new.add((del_apex, rdflib.URIRef("http://example.org/ontology#hasDelayDuration"), rdflib.Literal(120, datatype=rdflib.XSD.integer))) # 120 hours = 5 days delay

    # Add Alternative Supplier for Microcontroller_Chip (supplied by Aura_Steel_Co)
    alt_aura = rdflib.URIRef("http://example.org/ontology#Aura_Steel_Backup")
    g_new.add((alt_aura, rdflib.RDF.type, rdflib.URIRef("http://example.org/ontology#AlternativeSupplier")))
    g_new.add((alt_aura, rdflib.RDF.type, rdflib.OWL.NamedIndividual))
    g_new.add((alt_aura, rdflib.RDFS.label, rdflib.Literal("Aura Steel Backup")))
    g_new.add((alt_aura, rdflib.URIRef("http://example.org/ontology#supplies"), rdflib.URIRef("http://example.org/ontology#Microcontroller_Chip")))
    g_new.add((alt_aura, rdflib.URIRef("http://example.org/ontology#hasReliabilityScore"), rdflib.Literal(0.88, datatype=rdflib.XSD.float)))
    g_new.add((alt_aura, rdflib.URIRef("http://example.org/ontology#leadTimeDays"), rdflib.Literal(4, datatype=rdflib.XSD.integer)))
    g_new.add((alt_aura, rdflib.URIRef("http://example.org/ontology#country"), rdflib.Literal("DE")))

    # Add Alternative Supplier for Electric_Motor_Rotor (supplied by Apex_Electronics)
    alt_apex = rdflib.URIRef("http://example.org/ontology#Apex_Motor_Backup")
    g_new.add((alt_apex, rdflib.RDF.type, rdflib.URIRef("http://example.org/ontology#AlternativeSupplier")))
    g_new.add((alt_apex, rdflib.RDF.type, rdflib.OWL.NamedIndividual))
    g_new.add((alt_apex, rdflib.RDFS.label, rdflib.Literal("Apex Motor Backup")))
    g_new.add((alt_apex, rdflib.URIRef("http://example.org/ontology#supplies"), r_uri))
    g_new.add((alt_apex, rdflib.URIRef("http://example.org/ontology#hasReliabilityScore"), rdflib.Literal(0.91, datatype=rdflib.XSD.float)))
    g_new.add((alt_apex, rdflib.URIRef("http://example.org/ontology#leadTimeDays"), rdflib.Literal(5, datatype=rdflib.XSD.integer)))
    g_new.add((alt_apex, rdflib.URIRef("http://example.org/ontology#country"), rdflib.Literal("JP")))

    # Add Alternative Supplier for Structural_Steel_Sheet (supplied by Apex_Electronics)
    alt_steel = rdflib.URIRef("http://example.org/ontology#Steel_Supply_Backup")
    g_new.add((alt_steel, rdflib.RDF.type, rdflib.URIRef("http://example.org/ontology#AlternativeSupplier")))
    g_new.add((alt_steel, rdflib.RDF.type, rdflib.OWL.NamedIndividual))
    g_new.add((alt_steel, rdflib.RDFS.label, rdflib.Literal("Steel Supply Backup")))
    g_new.add((alt_steel, rdflib.URIRef("http://example.org/ontology#supplies"), s_steel))
    g_new.add((alt_steel, rdflib.URIRef("http://example.org/ontology#hasReliabilityScore"), rdflib.Literal(0.85, datatype=rdflib.XSD.float)))
    g_new.add((alt_steel, rdflib.URIRef("http://example.org/ontology#leadTimeDays"), rdflib.Literal(6, datatype=rdflib.XSD.integer)))
    g_new.add((alt_steel, rdflib.URIRef("http://example.org/ontology#country"), rdflib.Literal("US")))

    print(f"    - New ontology has {len(g_new)} triples.")

    # Serialize renamed graph back to files
    print(f"[*] Serializing updated ontology back to: {ontology_path}")
    g_new.serialize(destination=ontology_path, format="xml")
    print(f"[*] Serializing updated ontology back to: {inferred_path}")
    g_new.serialize(destination=inferred_path, format="xml")
    print("[+] RDF files updated successfully.")

    # Serialize renamed graph as N-Triples for syntax-safe SPARQL queries
    print("[*] Serializing to N-Triples format...")
    nt_data = g_new.serialize(format="nt")
    if isinstance(nt_data, bytes):
        nt_data = nt_data.decode("utf-8")

    lines = nt_data.splitlines()
    print(f"[+] Generated {len(lines)} N-Triples lines.")

    # Sort lines into Schema and Instance sets
    schema_lines = []
    instance_lines = []

    instance_keys = set(RENAMING_MAP.values())

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
        if s.startswith("<http://example.org/ontology#"):
            frag = s.split("#", 1)[1].rstrip(">")
            if frag in instance_keys or frag.startswith("PO_") or frag.startswith("DEL_") or frag.startswith("Truck_") or frag.startswith("Delivery_"):
                is_instance = True

        if p == "<http://www.w3.org/1999/02/22-rdf-syntax-ns#type>" and o.startswith("<http://www.w3.org/2002/07/owl#NamedIndividual>"):
            is_instance = True

        if is_instance:
            instance_lines.append(line_clean)
        else:
            schema_lines.append(line_clean)

    print(f"[+] Sorted: {len(schema_lines)} Schema lines and {len(instance_lines)} Instance lines.")

    # 4. Clear and populate GraphDB
    print("[*] Connecting to GraphDB to reload database...")
    try:
        # Clear all graphs (including default/unnamed graph)
        print("    -> Clearing all graphs (CLEAR ALL) ...")
        graphdb.execute_sparql_update("CLEAR ALL")

        # Batch load Schema lines into ONTOLOGY_GRAPH
        print(f"    -> Loading Schema triples into {ONTOLOGY_GRAPH}...")
        batch_size = 150
        for i in range(0, len(schema_lines), batch_size):
            batch = schema_lines[i : i + batch_size]
            sparql_insert = f"INSERT DATA {{ GRAPH <{ONTOLOGY_GRAPH}> {{ {' '.join(batch)} }} }}"
            graphdb.execute_sparql_update(sparql_insert)
            sys.stdout.write(f"\r       Loaded {min(i + batch_size, len(schema_lines))} / {len(schema_lines)} schema triples...")
            sys.stdout.flush()
        
        # Batch load Instance lines into CONTRACT_GRAPH
        print(f"\n    -> Loading Instance triples into {CONTRACT_GRAPH}...")
        for i in range(0, len(instance_lines), batch_size):
            batch = instance_lines[i : i + batch_size]
            sparql_insert = f"INSERT DATA {{ GRAPH <{CONTRACT_GRAPH}> {{ {' '.join(batch)} }} }}"
            graphdb.execute_sparql_update(sparql_insert)
            sys.stdout.write(f"\r       Loaded {min(i + batch_size, len(instance_lines))} / {len(instance_lines)} instance triples...")
            sys.stdout.flush()

        print("\n[+] SUCCESS! GraphDB re-seeded successfully with clean, renamed presentation data.")
    except Exception as e:
        print(f"\n[-] Failed to update GraphDB: {e}")
        print("[-] Please ensure that GraphDB is running on http://localhost:7200 and the repository is active.")

if __name__ == "__main__":
    run()
