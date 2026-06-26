import pandas as pd
df = pd.read_csv("Machine_Learning/Procurement_Model/Dataset_Procurement_SelectedFeatures.csv")

print("=== Suppliers for Plastic Resin ===")
print(df[df["Sub Category"].str.contains("Plastic Resin", na=False)][["Supplier ID", "Supplier Name"]].drop_duplicates())

print("\n=== Suppliers for Lubricant ===")
print(df[df["Sub Category"].str.contains("Lubricant", na=False)][["Supplier ID", "Supplier Name"]].drop_duplicates())
