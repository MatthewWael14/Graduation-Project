import os
import sys
import rdflib

# Allow importing backend modules by adding the Backend folder to Python Path
SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))
PROJECT_ROOT = os.path.dirname(SCRIPT_DIR)
sys.path.insert(0, os.path.join(PROJECT_ROOT, "Backend"))
sys.path.insert(0, SCRIPT_DIR)

ontology_path = os.path.join(PROJECT_ROOT, "Data_Science", "ontology", "Semantic Digital Twin Project.rdf")
inferred_path = os.path.join(PROJECT_ROOT, "Data_Science", "ontology", "Semantic Digital Twin Project Inferred.rdf")

print("=" * 60)
# 1. Parse and delete classes from disk files
print(f"[*] Parsing ontology file: {ontology_path}")
g = rdflib.Graph()
g.parse(ontology_path, format="xml")
initial_count = len(g)
print(f"[+] Loaded {initial_count} triples.")

TARGET_CLASSES = {
    rdflib.URIRef("http://example.org/ontology#LiquidMaterial"),
    rdflib.URIRef("http://example.org/ontology#SolidMaterial"),
    rdflib.URIRef("http://example.org/ontology#CoatingProcess"),
    rdflib.URIRef("http://example.org/ontology#FinalAssembly")
}

# Gather triples to remove
to_remove = []
for s, p, o in g:
    if s in TARGET_CLASSES or p in TARGET_CLASSES or o in TARGET_CLASSES:
        to_remove.append((s, p, o))

print(f"[*] Found {len(to_remove)} triples referencing target classes.")
for triple in to_remove:
    g.remove(triple)

# Save updated files back to disk
print(f"[*] Saving updated ontology with {len(g)} triples back to disk...")
g.serialize(destination=ontology_path, format="xml")
g.serialize(destination=inferred_path, format="xml")
print("[+] Ontology files updated on disk.")

# 2. Re-run individuals rename & seed script to reload GraphDB
print("\n[*] Triggering GraphDB re-seeding...")
import rename_ontology_individuals
rename_ontology_individuals.run()
