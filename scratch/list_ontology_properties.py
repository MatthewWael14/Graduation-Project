import rdflib

g = rdflib.Graph()
g.parse("Data_Science/ontology/Semantic Digital Twin Project.rdf")

print("=== CLASSES ===")
classes = sorted(list(g.subjects(rdflib.RDF.type, rdflib.OWL.Class)))
for c in classes:
    print(c)

print("\n=== OBJECT PROPERTIES ===")
obj_props = sorted(list(g.subjects(rdflib.RDF.type, rdflib.OWL.ObjectProperty)))
for p in obj_props:
    print(p)

print("\n=== DATATYPE PROPERTIES ===")
data_props = sorted(list(g.subjects(rdflib.RDF.type, rdflib.OWL.DatatypeProperty)))
for p in data_props:
    print(p)
