import pandas as pd
df = pd.read_csv("Machine_Learning/Procurement_Model/Dataset_Procurement_SelectedFeatures.csv")
print("=== Unique Supplier Names in CSV ===")
print(df["Supplier Name"].unique())
print("\n=== Unique Sub Categories (Materials) in CSV ===")
print(df["Sub Category"].unique())
