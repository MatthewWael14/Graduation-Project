import os
import pandas as pd

# Paths
dir_path = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
dataset_path = os.path.join(dir_path, "Machine_Learning", "Procurement_Model", "Dataset_Procurement_SelectedFeatures.csv")

if not os.path.exists(dataset_path):
    print("Dataset not found!")
    exit(1)

# Banned suppliers list
BANNED_SUPPLIERS = {
    "TechPro Components",
    "Cornerstone Services",
    "Quantum Electronics",
    "Nordic Office Solutions",
    "Blue Horizon Packaging",
    "Iron Gate Steel",
    "GlobalParts Ltd",
    "Atlantic Raw Materials",
    "Meridian Tech",
    "Apex Industrial Supplies",
    "EuroBuild Materials",
    "SunRise Manufacturing",
    "FastTrack Logistics",
    "Pacific Rim Supplies",
    "Delta Engineering"
}

df = pd.read_csv(dataset_path)
initial_len = len(df)

# Filter out rows
df_cleaned = df[~df["Supplier Name"].isin(BANNED_SUPPLIERS)]
cleaned_len = len(df_cleaned)

print(f"Initial row count: {initial_len}")
print(f"Cleaned row count: {cleaned_len}")
print(f"Removed {initial_len - cleaned_len} rows.")

# Save back to CSV
df_cleaned.to_csv(dataset_path, index=False)
print("Saved cleaned CSV successfully.")
