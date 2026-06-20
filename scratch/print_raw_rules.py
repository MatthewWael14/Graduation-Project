import os
import rdflib

ontology_path = os.path.join("Data_Science", "ontology", "Semantic Digital Twin Project.rdf")
g = rdflib.Graph()
g.parse(ontology_path, format="xml")

# Namespaces
ns_map = {
    "swrl": "http://www.w3.org/2003/11/swrl#",
    "swrlb": "http://www.w3.org/2003/11/swrlb#",
    "rdf": "http://www.w3.org/1999/02/22-rdf-syntax-ns#",
    "rdfs": "http://www.w3.org/2000/01/rdf-schema#",
    "owl": "http://www.w3.org/2002/07/owl#",
    "xsd": "http://www.w3.org/2001/XMLSchema#",
    "onto": "http://example.org/ontology#"
}

# Simple SPARQL query to get rules and their structures
q = """
PREFIX swrl: <http://www.w3.org/2003/11/swrl#>
PREFIX rdfs: <http://www.w3.org/2000/01/rdf-schema#>
PREFIX rdf: <http://www.w3.org/1999/02/22-rdf-syntax-ns#>

SELECT ?label ?body ?head WHERE {
    ?rule rdf:type swrl:Imp ;
          rdfs:label ?label .
    FILTER(contains(str(?label), "ProductionDisruption"))
    OPTIONAL { ?rule swrl:body ?body . }
    OPTIONAL { ?rule swrl:head ?head . }
}
"""

def print_list(node):
    curr = node
    idx = 1
    while curr and curr != rdflib.RDF.nil:
        atom = g.value(curr, rdflib.RDF.first)
        atom_type = g.value(atom, rdflib.RDF.type)
        print(f"    Atom {idx} (type: {atom_type.split('#')[-1] if atom_type else 'unknown'}):")
        
        # Print all triples for this atom
        for s, p, o in g.triples((atom, None, None)):
            p_label = p.split("#")[-1] if "#" in str(p) else p.split("/")[-1]
            o_label = o.split("#")[-1] if "#" in str(o) else o.split("/")[-1]
            if isinstance(o, rdflib.BNode):
                # Trace list for Builtin arguments
                if p_label == "arguments":
                    arg_list = []
                    args_curr = o
                    while args_curr and args_curr != rdflib.RDF.nil:
                        arg_first = g.value(args_curr, rdflib.RDF.first)
                        arg_list.append(str(arg_first).split("#")[-1] if "#" in str(arg_first) else str(arg_first))
                        args_curr = g.value(args_curr, rdflib.RDF.rest)
                    print(f"      {p_label} -> List({', '.join(arg_list)})")
                else:
                    print(f"      {p_label} -> [BlankNode]")
            else:
                print(f"      {p_label} -> {o_label}")
                
        curr = g.value(curr, rdflib.RDF.rest)
        idx += 1

results = g.query(q)
for row in results:
    print("\n" + "=" * 60)
    print(f"Rule Label: {row.label}")
    print("=" * 60)
    
    print("\n[BODY]")
    print_list(row.body)
    
    print("\n[HEAD]")
    print_list(row.head)
