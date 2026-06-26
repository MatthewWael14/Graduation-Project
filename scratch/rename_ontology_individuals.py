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
    "PO_Test", "Del_Test", "SLA_Contract", "SLA_Gold", "SLA_101",
    "Delivery_001", "Delivery_007", "Delivery_Quality_Test", "Delivery_Shortage",
    "Shipment_001", "PO_100", "PO_200",
    "SLA_VoltSupply_Standard", "SLA_EcoLithium_Premium", "SLA_AuraSteel_Standard",
    "Delivery_VoltSupply_Main", "Delivery_AuraSteel_Delayed", "Delivery_EcoLithium_Quality",
    "Delivery_VoltSupply_Shortage", "PO_VoltSupply_001", "PO_EcoLithium_001",
    "Delivery_VoltSupply_Damaged", "Contract_Apex_Motor_Standard",
    "Delivery_Apex_Delayed"
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

        # Filter out quality-related properties from Contract_VoltSupply_Standard
        s_str = str(s_renamed)
        p_str = str(p)
        s_frag = s_str.split("#", 1)[1] if "#" in s_str else ""
        p_frag = p_str.split("#", 1)[1] if "#" in p_str else p_str.split("/")[-1]
        
        if s_frag == "Contract_VoltSupply_Standard":
            if p_frag in ("hasQualityPenaltyRate", "hasMinimumQualityThreshold"):
                ignored_count += 1
                continue
            if p_frag == "penaltyClause" and "Quality Penalty" in str(o):
                ignored_count += 1
                continue

        if s_frag == "SLA-002" and p_frag == "penaltyClause":
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
    # ----------------- CLEAN SEEDED CONTRACTS & VIOLATIONS -----------------
    v_uri = rdflib.URIRef("http://example.org/ontology#VoltSupply_Global")
    au_uri = rdflib.URIRef("http://example.org/ontology#Aura_Steel_Co")
    a_uri = rdflib.URIRef("http://example.org/ontology#Apex_Electronics")
    
    r_uri = rdflib.URIRef("http://example.org/ontology#Electric_Motor_Rotor")
    s_steel = rdflib.URIRef("http://example.org/ontology#Structural_Steel_Sheet")
    battery_pack = rdflib.URIRef("http://example.org/ontology#Lithium_Ion_Battery_Pack")
    mc_chip = rdflib.URIRef("http://example.org/ontology#Microcontroller_Chip")

    # Add supplies relationship for Apex
    g_new.add((a_uri, rdflib.URIRef("http://example.org/ontology#supplies"), r_uri))
    g_new.add((a_uri, rdflib.URIRef("http://example.org/ontology#supplies"), s_steel))

    # Supplier reliability scores
    g_new.add((v_uri, rdflib.URIRef("http://example.org/ontology#hasReliabilityScore"), rdflib.Literal(0.85, datatype=rdflib.XSD.float)))
    g_new.add((v_uri, rdflib.URIRef("http://example.org/ontology#hasReliabilityTier"), rdflib.Literal("High")))
    
    g_new.add((au_uri, rdflib.URIRef("http://example.org/ontology#hasReliabilityScore"), rdflib.Literal(0.2, datatype=rdflib.XSD.float)))
    g_new.add((au_uri, rdflib.URIRef("http://example.org/ontology#hasReliabilityTier"), rdflib.Literal("Low")))
    
    g_new.add((a_uri, rdflib.URIRef("http://example.org/ontology#hasReliabilityScore"), rdflib.Literal(0.6, datatype=rdflib.XSD.float)))
    g_new.add((a_uri, rdflib.URIRef("http://example.org/ontology#hasReliabilityTier"), rdflib.Literal("Medium")))

    # Set Lithium Ion Battery Pack stock levels (stock=2000 > safetyStock=800)
    g_new.add((battery_pack, rdflib.URIRef("http://example.org/ontology#hasInventoryStock"), rdflib.Literal(2000, datatype=rdflib.XSD.integer)))
    g_new.add((battery_pack, rdflib.URIRef("http://example.org/ontology#hasSafetyStockLevel"), rdflib.Literal(800, datatype=rdflib.XSD.integer)))

    # 1. VoltSupply Standard Contract (No Initial Violations)
    vs_contract = rdflib.URIRef("http://example.org/ontology#Contract_VoltSupply_Standard")
    g_new.add((vs_contract, rdflib.RDF.type, rdflib.URIRef("http://example.org/ontology#SLAContract")))
    g_new.add((vs_contract, rdflib.RDF.type, rdflib.OWL.NamedIndividual))
    g_new.add((vs_contract, rdflib.URIRef("http://example.org/ontology#hasSupplier"), v_uri))
    g_new.add((vs_contract, rdflib.URIRef("http://example.org/ontology#governsMaterial"), battery_pack))
    g_new.add((vs_contract, rdflib.URIRef("http://example.org/ontology#leadTimeDays"), rdflib.Literal(14, datatype=rdflib.XSD.integer)))
    g_new.add((vs_contract, rdflib.URIRef("http://example.org/ontology#hasSLALeadTime"), rdflib.Literal(336, datatype=rdflib.XSD.integer)))
    g_new.add((vs_contract, rdflib.URIRef("http://example.org/ontology#penaltyClause"), rdflib.Literal("SLA Delay Penalty: $300 per day delayed")))
    g_new.add((vs_contract, rdflib.URIRef("http://example.org/ontology#hasDelayPenaltyRate"), rdflib.Literal(300, datatype=rdflib.XSD.decimal)))
    g_new.add((vs_contract, rdflib.URIRef("http://example.org/ontology#hasOrderedQuantity"), rdflib.Literal(1000, datatype=rdflib.XSD.integer)))
    g_new.add((vs_contract, rdflib.URIRef("http://example.org/ontology#hasUnitCost"), rdflib.Literal(150.0, datatype=rdflib.XSD.float)))
    g_new.add((v_uri, rdflib.URIRef("http://example.org/ontology#hasSLA"), vs_contract))

    # 2. Aura Steel Contract (Under-Shipment / Missed Item Violation)
    as_contract = rdflib.URIRef("http://example.org/ontology#Contract_AuraSteel_Standard")
    g_new.add((as_contract, rdflib.RDF.type, rdflib.URIRef("http://example.org/ontology#SLAContract")))
    g_new.add((as_contract, rdflib.RDF.type, rdflib.OWL.NamedIndividual))
    g_new.add((as_contract, rdflib.URIRef("http://example.org/ontology#hasSupplier"), au_uri))
    g_new.add((as_contract, rdflib.URIRef("http://example.org/ontology#governsMaterial"), mc_chip))
    g_new.add((as_contract, rdflib.URIRef("http://example.org/ontology#leadTimeDays"), rdflib.Literal(7, datatype=rdflib.XSD.integer)))
    g_new.add((as_contract, rdflib.URIRef("http://example.org/ontology#hasSLALeadTime"), rdflib.Literal(168, datatype=rdflib.XSD.integer)))
    g_new.add((as_contract, rdflib.URIRef("http://example.org/ontology#penaltyClause"), rdflib.Literal("SLA Missed Item Penalty: $50 per unit missed")))
    g_new.add((as_contract, rdflib.URIRef("http://example.org/ontology#hasMissedItemPenaltyRate"), rdflib.Literal(50, datatype=rdflib.XSD.decimal)))
    g_new.add((as_contract, rdflib.URIRef("http://example.org/ontology#hasOrderedQuantity"), rdflib.Literal(2000, datatype=rdflib.XSD.integer)))
    g_new.add((as_contract, rdflib.URIRef("http://example.org/ontology#hasUnitCost"), rdflib.Literal(15.0, datatype=rdflib.XSD.float)))
    g_new.add((au_uri, rdflib.URIRef("http://example.org/ontology#hasSLA"), as_contract))
    
    # Active Under-Shipment Violation for Aura Steel
    po_aura = rdflib.URIRef("http://example.org/ontology#PO_AuraSteel_001")
    g_new.add((po_aura, rdflib.RDF.type, rdflib.URIRef("http://example.org/ontology#PurchaseOrder")))
    g_new.add((po_aura, rdflib.URIRef("http://example.org/ontology#issuedTo"), au_uri))
    g_new.add((po_aura, rdflib.URIRef("http://example.org/ontology#hasOrderedQuantity"), rdflib.Literal(2000, datatype=rdflib.XSD.integer)))

    del_aura = rdflib.URIRef("http://example.org/ontology#Delivery_AuraSteel_Shortage")
    g_new.add((del_aura, rdflib.RDF.type, rdflib.URIRef("http://example.org/ontology#DeliveryEvent")))
    g_new.add((del_aura, rdflib.RDF.type, rdflib.URIRef("http://example.org/ontology#SLAViolation")))
    g_new.add((del_aura, rdflib.RDF.type, rdflib.OWL.NamedIndividual))
    g_new.add((del_aura, rdflib.URIRef("http://example.org/ontology#transports"), mc_chip))
    g_new.add((del_aura, rdflib.URIRef("http://example.org/ontology#fulfills"), po_aura))
    g_new.add((del_aura, rdflib.URIRef("http://example.org/ontology#isPerformedBy"), au_uri))
    g_new.add((del_aura, rdflib.URIRef("http://example.org/ontology#hasViolationType"), rdflib.Literal("UnderShipment")))
    g_new.add((del_aura, rdflib.URIRef("http://example.org/ontology#hasOrderedQuantity"), rdflib.Literal(2000, datatype=rdflib.XSD.integer)))
    g_new.add((del_aura, rdflib.URIRef("http://example.org/ontology#hasDeliveredQuantity"), rdflib.Literal(1800, datatype=rdflib.XSD.integer)))

    # 3. Apex Electronics Contracts (Damaged Goods Violation on Motor Rotor - SLA-002)
    apex_contract1 = rdflib.URIRef("http://example.org/ontology#SLA-002")
    g_new.add((apex_contract1, rdflib.RDF.type, rdflib.URIRef("http://example.org/ontology#SLAContract")))
    g_new.add((apex_contract1, rdflib.RDF.type, rdflib.OWL.NamedIndividual))
    g_new.add((apex_contract1, rdflib.URIRef("http://example.org/ontology#hasSupplier"), a_uri))
    g_new.add((apex_contract1, rdflib.URIRef("http://example.org/ontology#governsMaterial"), r_uri))
    g_new.add((apex_contract1, rdflib.URIRef("http://example.org/ontology#leadTimeDays"), rdflib.Literal(10, datatype=rdflib.XSD.integer)))
    g_new.add((apex_contract1, rdflib.URIRef("http://example.org/ontology#hasSLALeadTime"), rdflib.Literal(240, datatype=rdflib.XSD.integer)))
    g_new.add((apex_contract1, rdflib.URIRef("http://example.org/ontology#penaltyClause"), rdflib.Literal("SLA Quality Penalty: 15% of PO Cost for damaged goods")))
    g_new.add((apex_contract1, rdflib.URIRef("http://example.org/ontology#hasQualityPenaltyRate"), rdflib.Literal(0.15, datatype=rdflib.XSD.decimal)))
    g_new.add((apex_contract1, rdflib.URIRef("http://example.org/ontology#hasMinimumQualityThreshold"), rdflib.Literal(0.98, datatype=rdflib.XSD.decimal)))
    g_new.add((apex_contract1, rdflib.URIRef("http://example.org/ontology#hasOrderedQuantity"), rdflib.Literal(500, datatype=rdflib.XSD.integer)))
    g_new.add((apex_contract1, rdflib.URIRef("http://example.org/ontology#hasUnitCost"), rdflib.Literal(85.0, datatype=rdflib.XSD.float)))
    g_new.add((a_uri, rdflib.URIRef("http://example.org/ontology#hasSLA"), apex_contract1))
    
    apex_contract2 = rdflib.URIRef("http://example.org/ontology#Contract_Apex_Steel_Standard")
    g_new.add((apex_contract2, rdflib.RDF.type, rdflib.URIRef("http://example.org/ontology#SLAContract")))
    g_new.add((apex_contract2, rdflib.RDF.type, rdflib.OWL.NamedIndividual))
    g_new.add((apex_contract2, rdflib.URIRef("http://example.org/ontology#hasSupplier"), a_uri))
    g_new.add((apex_contract2, rdflib.URIRef("http://example.org/ontology#governsMaterial"), s_steel))
    g_new.add((apex_contract2, rdflib.URIRef("http://example.org/ontology#leadTimeDays"), rdflib.Literal(10, datatype=rdflib.XSD.integer)))
    g_new.add((apex_contract2, rdflib.URIRef("http://example.org/ontology#hasSLALeadTime"), rdflib.Literal(240, datatype=rdflib.XSD.integer)))
    g_new.add((apex_contract2, rdflib.URIRef("http://example.org/ontology#penaltyClause"), rdflib.Literal("SLA Penalty: $400 per day after 2-day grace period")))
    g_new.add((apex_contract2, rdflib.URIRef("http://example.org/ontology#hasDelayPenaltyRate"), rdflib.Literal(400, datatype=rdflib.XSD.decimal)))
    g_new.add((apex_contract2, rdflib.URIRef("http://example.org/ontology#hasOrderedQuantity"), rdflib.Literal(800, datatype=rdflib.XSD.integer)))
    g_new.add((apex_contract2, rdflib.URIRef("http://example.org/ontology#hasUnitCost"), rdflib.Literal(45.0, datatype=rdflib.XSD.float)))
    g_new.add((a_uri, rdflib.URIRef("http://example.org/ontology#hasSLA"), apex_contract2))

    # Active Damaged Goods Violation for Apex (Electric Motor Rotor)
    po_apex = rdflib.URIRef("http://example.org/ontology#PO_Apex_001")
    g_new.add((po_apex, rdflib.RDF.type, rdflib.URIRef("http://example.org/ontology#PurchaseOrder")))
    g_new.add((po_apex, rdflib.URIRef("http://example.org/ontology#issuedTo"), a_uri))
    g_new.add((po_apex, rdflib.URIRef("http://example.org/ontology#hasOrderedQuantity"), rdflib.Literal(500, datatype=rdflib.XSD.integer)))
    g_new.add((po_apex, rdflib.URIRef("http://example.org/ontology#hasTotalOrderCost"), rdflib.Literal(42500.0, datatype=rdflib.XSD.float)))

    del_apex = rdflib.URIRef("http://example.org/ontology#Delivery_Apex_Damaged")
    g_new.add((del_apex, rdflib.RDF.type, rdflib.URIRef("http://example.org/ontology#DeliveryEvent")))
    g_new.add((del_apex, rdflib.RDF.type, rdflib.URIRef("http://example.org/ontology#SLAViolation")))
    g_new.add((del_apex, rdflib.RDF.type, rdflib.OWL.NamedIndividual))
    g_new.add((del_apex, rdflib.URIRef("http://example.org/ontology#transports"), r_uri))
    g_new.add((del_apex, rdflib.URIRef("http://example.org/ontology#fulfills"), po_apex))
    g_new.add((del_apex, rdflib.URIRef("http://example.org/ontology#isPerformedBy"), a_uri))
    g_new.add((del_apex, rdflib.URIRef("http://example.org/ontology#hasViolationType"), rdflib.Literal("DamagedGoods")))
    g_new.add((del_apex, rdflib.URIRef("http://example.org/ontology#hasTotalOrderCost"), rdflib.Literal(42500.0, datatype=rdflib.XSD.float)))

    # Add Alternative Supplier for Microcontroller_Chip (supplied by Aura_Steel_Co)
    alt_aura = rdflib.URIRef("http://example.org/ontology#Aura_Steel_Backup")
    g_new.add((alt_aura, rdflib.RDF.type, rdflib.URIRef("http://example.org/ontology#AlternativeSupplier")))
    g_new.add((alt_aura, rdflib.RDF.type, rdflib.OWL.NamedIndividual))
    g_new.add((alt_aura, rdflib.RDFS.label, rdflib.Literal("Aura Steel Backup")))
    g_new.add((alt_aura, rdflib.URIRef("http://example.org/ontology#supplies"), mc_chip))
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
        # Fetch existing triples in CONTRACT_GRAPH to preserve them
        existing_triples = []
        try:
            print(f"    -> Fetching existing triples from CONTRACT_GRAPH ({CONTRACT_GRAPH}) to preserve runtime data...")
            q_exist = f"""
            SELECT ?s ?p ?o (isURI(?o) AS ?o_uri) (datatype(?o) AS ?o_type) WHERE {{
                GRAPH <{CONTRACT_GRAPH}> {{
                    ?s ?p ?o .
                }}
            }}
            """
            rows = graphdb.execute_sparql_select(q_exist)
            for r in rows:
                s_val = r['s']
                o_val = r['o']
                p_val = r['p']
                o_uri = r.get('o_uri') == 'true' or r.get('o_uri') is True
                
                s_frag = s_val.split("#", 1)[1] if "#" in s_val else ""
                o_frag = o_val.split("#", 1)[1] if ("#" in o_val and o_uri) else ""
                p_frag = p_val.split("#", 1)[1] if "#" in p_val else ""
                
                if s_frag in REDUNDANT or o_frag in REDUNDANT:
                    continue

                # Filter out quality-related properties from Contract_VoltSupply_Standard
                if s_frag == "Contract_VoltSupply_Standard":
                    if p_frag in ("hasQualityPenaltyRate", "hasMinimumQualityThreshold"):
                        continue
                    if p_frag == "penaltyClause" and "Quality Penalty" in str(o_val):
                        continue

                # Filter out old penaltyClause from SLA-002
                if s_frag == "SLA-002" and p_frag == "penaltyClause":
                    continue

                s_str = f"<{s_val}>"
                p_str = f"<{p_val}>"
                o_type = r.get('o_type')
                if o_uri:
                    o_str = f"<{o_val}>"
                else:
                    o_escaped = o_val.replace('"', '\\"').replace('\n', '\\n').replace('\r', '\\r')
                    if o_type:
                        o_str = f'"{o_escaped}"^^<{o_type}>'
                    else:
                        o_str = f'"{o_escaped}"'
                existing_triples.append(f"{s_str} {p_str} {o_str} .")
            print(f"    -> Found {len(existing_triples)} existing triples to preserve (excluding redundant items).")
        except Exception as e_fetch:
            print(f"    [!] Failed to fetch existing triples: {e_fetch}")

        # Deduplicate supplier reliability scores (keep the runtime simulator-updated score)
        suppliers_with_existing_score = set()
        for t in existing_triples:
            if "hasReliabilityScore" in t:
                parts = t.split(None, 2)
                if len(parts) >= 3:
                    suppliers_with_existing_score.add(parts[0])

        filtered_instance_lines = []
        for line in instance_lines:
            if "hasReliabilityScore" in line:
                parts = line.split(None, 2)
                if len(parts) >= 3 and parts[0] in suppliers_with_existing_score:
                    continue
            filtered_instance_lines.append(line)

        # Combine generated instances with existing ones, removing duplicates
        combined_instances = list(set(filtered_instance_lines) | set(existing_triples))
        print(f"    -> Combined into {len(combined_instances)} total instance triples (seed + current system state).")

        # Clear only ONTOLOGY_GRAPH and CONTRACT_GRAPH instead of CLEAR ALL
        print(f"    -> Clearing ONTOLOGY_GRAPH ({ONTOLOGY_GRAPH}) and CONTRACT_GRAPH ({CONTRACT_GRAPH}) ...")
        graphdb.execute_sparql_update(f"CLEAR GRAPH <{ONTOLOGY_GRAPH}>")
        graphdb.execute_sparql_update(f"CLEAR GRAPH <{CONTRACT_GRAPH}>")

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
        for i in range(0, len(combined_instances), batch_size):
            batch = combined_instances[i : i + batch_size]
            sparql_insert = f"INSERT DATA {{ GRAPH <{CONTRACT_GRAPH}> {{ {' '.join(batch)} }} }}"
            graphdb.execute_sparql_update(sparql_insert)
            sys.stdout.write(f"\r       Loaded {min(i + batch_size, len(combined_instances))} / {len(combined_instances)} instance triples...")
            sys.stdout.flush()

        print("\n[+] SUCCESS! GraphDB re-seeded successfully with clean, renamed presentation data.")
    except Exception as e:
        print(f"\n[-] Failed to update GraphDB: {e}")
        print("[-] Please ensure that GraphDB is running on http://localhost:7200 and the repository is active.")

if __name__ == "__main__":
    run()
