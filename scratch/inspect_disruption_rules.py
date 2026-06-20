import os
import rdflib

ontology_path = os.path.join("Data_Science", "ontology", "Semantic Digital Twin Project.rdf")
g = rdflib.Graph()
g.parse(ontology_path, format="xml")

SWRL = rdflib.Namespace("http://www.w3.org/2003/11/swrl#")
RDFS = rdflib.RDFS
RDF = rdflib.RDF

print("=" * 80)
print("  PRODUCTION DISRUPTION LOGIC RULES (SWRL)")
print("=" * 80)

for rule in g.subjects(RDF.type, SWRL.Imp):
    label = str(g.value(rule, RDFS.label) or "")
    if "ProductionDisruption" in label:
        print(f"\nRule Name: {label}")
        
        # Display body atoms
        body = g.value(rule, SWRL.body)
        head = g.value(rule, SWRL.head)
        
        def format_atom_list(atom_list_node):
            atoms = []
            curr = atom_list_node
            while curr and curr != RDF.nil:
                atom = g.value(curr, RDF.first)
                # Query all triples for this atom
                types = list(g.objects(atom, RDF.type))
                type_name = str(types[0]).split("#")[-1] if types else "Atom"
                
                # Format based on type
                if "ClassAtom" in type_name:
                    cls = str(g.value(atom, SWRL.classPredicate)).split("#")[-1]
                    arg = str(g.value(atom, SWRL.argument1)).split("#")[-1]
                    atoms.append(f"{cls}(?{arg})")
                elif "IndividualPropertyAtom" in type_name or "DatatypePropertyAtom" in type_name:
                    prop = str(g.value(atom, SWRL.propertyPredicate)).split("#")[-1]
                    arg1 = str(g.value(atom, SWRL.argument1)).split("#")[-1]
                    arg2 = str(g.value(atom, SWRL.argument2)).split("#")[-1]
                    atoms.append(f"{prop}(?{arg1}, ?{arg2})")
                elif "BuiltinAtom" in type_name:
                    builtin = str(g.value(atom, SWRL.builtin)).split("#")[-1]
                    args_node = g.value(atom, SWRL.arguments)
                    args = []
                    while args_node and args_node != RDF.nil:
                        arg_val = g.value(args_node, RDF.first)
                        args.append(str(arg_val).split("#")[-1])
                        args_node = g.value(args_node, RDF.rest)
                    # Format as function call
                    atoms.append(f"{builtin}({', '.join(['?' + a for a in args])})")
                else:
                    # Generic format
                    pred = str(list(g.objects(atom, SWRL.classPredicate)) or list(g.objects(atom, SWRL.propertyPredicate)) or [""])[0].split("#")[-1].rstrip("']")
                    atoms.append(f"{type_name}:{pred}")
                
                curr = g.value(curr, RDF.rest)
            return " ^ ".join(atoms)
            
        print(f"  IF:   {format_atom_list(body)}")
        print(f"  THEN: {format_atom_list(head)}")
