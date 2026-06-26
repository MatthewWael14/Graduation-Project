import sys
import docx
import pdfplumber

def read_docx(path):
    doc = docx.Document(path)
    return "\n".join(p.text for p in doc.paragraphs)

def read_pdf(path):
    with pdfplumber.open(path) as pdf:
        return "\n".join(page.extract_text() or "" for page in pdf.pages)

print("=== Acme_Doc.docx ===")
try:
    print(read_docx("Data_Science/contracts/Acme_Doc.docx"))
except Exception as e:
    print(f"Error: {e}")

print("\n=== Acme_Test.pdf ===")
try:
    print(read_pdf("Data_Science/contracts/Acme_Test.pdf"))
except Exception as e:
    print(f"Error: {e}")
