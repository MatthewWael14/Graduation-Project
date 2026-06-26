import rdflib
import os

g = rdflib.Graph()
ontology_path = os.path.join("Data_Science", "ontology", "Semantic Digital Twin Project.rdf")
g.parse(ontology_path, format="xml")

rule = next(g.triples((None, rdflib.RDFS.label, rdflib.Literal("PenaltyDelay"))))[0]
nodes = {rule}
to_visit = [rule]
sub = rdflib.Graph()

while to_visit:
    n = to_visit.pop()
    for s, p, o in g.triples((n, None, None)):
        sub.add((s, p, o))
        if isinstance(o, rdflib.BNode) and o not in nodes:
            nodes.add(o)
            to_visit.append(o)
    for s, p, o in g.triples((None, None, n)):
        sub.add((s, p, o))
        if isinstance(s, rdflib.BNode) and s not in nodes:
            nodes.add(s)
            to_visit.append(s)

print(sub.serialize(format="turtle"))
