import os
import rdflib

# Load base ontology
ontology_path = os.path.join("Data_Science", "ontology", "Semantic Digital Twin Project.rdf")
g = rdflib.Graph()
g.parse(ontology_path, format="xml")

# Namespaces
SWRL = rdflib.Namespace("http://www.w3.org/2003/11/swrl#")
RDFS = rdflib.RDFS
RDF = rdflib.RDF

print("=" * 70)
print("  SWRL RULES IN ONTOLOGY")
print("=" * 70)

# SWRL rules are instances of swrl:Imp
rules = list(g.subjects(RDF.type, SWRL.Imp))
for idx, rule in enumerate(rules):
    label = g.value(rule, RDFS.label)
    print(f"\nRule #{idx+1}: {label or 'Unnamed'}")
    
    # Print body and head
    body = g.value(rule, SWRL.body)
    head = g.value(rule, SWRL.head)
    
    def parse_atom_list(atom_list):
        atoms = []
        curr = atom_list
        while curr and curr != RDF.nil:
            atom = g.value(curr, RDF.first)
            # Find the type of atom
            atom_type = g.value(atom, RDF.type)
            
            if atom_type == SWRL.ClassAtom:
                class_pred = g.value(atom, SWRL.classPredicate)
                arg1 = g.value(atom, SWRL.argument1)
                atoms.append(f"{class_pred.split('#')[-1]}({arg1.split('#')[-1] if '#' in str(arg1) else str(arg1)})")
            elif atom_type == SWRL.IndividualPropertyAtom:
                prop_pred = g.value(atom, SWRL.propertyPredicate)
                arg1 = g.value(atom, SWRL.argument1)
                arg2 = g.value(atom, SWRL.argument2)
                atoms.append(f"{prop_pred.split('#')[-1]}({arg1.split('#')[-1] if '#' in str(arg1) else str(arg1)}, {arg2.split('#')[-1] if '#' in str(arg2) else str(arg2)})")
            elif atom_type == SWRL.DatatypePropertyAtom:
                prop_pred = g.value(atom, SWRL.propertyPredicate)
                arg1 = g.value(atom, SWRL.argument1)
                arg2 = g.value(atom, SWRL.argument2)
                atoms.append(f"{prop_pred.split('#')[-1]}({arg1.split('#')[-1] if '#' in str(arg1) else str(arg1)}, {arg2.split('#')[-1] if '#' in str(arg2) else str(arg2)})")
            elif atom_type == SWRL.BuiltinAtom:
                builtin = g.value(atom, SWRL.builtin)
                args = g.value(atom, SWRL.arguments)
                arg_list = []
                while args and args != RDF.nil:
                    item = g.value(args, RDF.first)
                    arg_list.append(item.split('#')[-1] if '#' in str(item) else str(item))
                    args = g.value(args, RDF.rest)
                atoms.append(f"{builtin.split('#')[-1]}({', '.join(arg_list)})")
            else:
                atoms.append(f"UnknownAtomType({atom})")
                
            curr = g.value(curr, RDF.rest)
        return " ^ ".join(atoms)

    if body:
        print("  BODY:", parse_atom_list(body))
    if head:
        print("  HEAD:", parse_atom_list(head))
