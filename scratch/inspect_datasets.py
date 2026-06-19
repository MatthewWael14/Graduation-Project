import pandas as pd
import os

proc_path = "Machine_Learning/Procurement_Model/Dataset_Procurement_SelectedFeatures.csv"
log_path = "Machine_Learning/Logistics_Model/dynamic_supply_chain_logistics_dataset.xlsx"

print("=== PROCUREMENT DATASET ===")
if os.path.exists(proc_path):
    df_p = pd.read_csv(proc_path)
    print(f"Shape: {df_p.shape}")
    print("Columns:", list(df_p.columns))
    print("Sample Row 1:")
    print(df_p.iloc[0].to_dict())
else:
    print("Procurement dataset NOT found!")

print("\n=== LOGISTICS DATASET ===")
if os.path.exists(log_path):
    df_l = pd.read_excel(log_path)
    print(f"Shape: {df_l.shape}")
    print("Columns:", list(df_l.columns))
    print("Sample Row 1:")
    print(df_l.iloc[0].to_dict())
else:
    print("Logistics dataset NOT found!")
