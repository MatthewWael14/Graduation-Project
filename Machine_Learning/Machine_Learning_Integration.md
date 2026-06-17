# Machine Learning Integration Guide: Delay Prediction & Supplier Scores

This document provides a comprehensive overview of how to integrate the Machine Learning components in your Jupyter Notebook (`Graduation_Project_final.ipynb`) with the FastAPI Backend and the Ontotext GraphDB Knowledge Graph.

---

## 1. Overview of the Integration Architecture

The Machine Learning models serve as the **Predictive Layer** of the Semantic Digital Twin. Once they detect anomalies or calculate metrics, they push updates to the backend:

```
┌────────────────────────────────┐
│  Machine Learning Pipeline     │ (Runs Random Forest / XGBoost)
└──────────────┬─────────────────┘
               │
               │ (Triggers updates)
               ▼
┌────────────────────────────────┐
│   FastAPI Integration Layer    │ (sandbox.py & Connection classes)
└──────────────┬─────────────────┘
               │
               │ (Executes SPARQL)
               ▼
┌────────────────────────────────┐
│   GraphDB Semantic Layer       │ (OWL Axioms & Inferred Risks)
└──────────────┬─────────────────┘
               │
               │ (Reads Graph Context)
               ▼
┌────────────────────────────────┐
│   LangGraph Risk Engine / Chat │ (Targeted alerts for managers)
└────────────────────────────────┘
```

---

## 2. Delay Prediction: End-to-End Flow

### Step A: Model & Scaler Serialization (Notebook)
Add this cell to the end of your training process in `Graduation_Project_final.ipynb` to save your trained model and preprocessing scaler:

```python
import pickle

# Save the trained Random Forest / XGBoost model
with open('delay_prediction_model.pkl', 'wb') as model_file:
    pickle.dump(rf_model_risk, model_file)

# Save the StandardScaler object
with open('scaler.pkl', 'wb') as scaler_file:
    pickle.dump(scaler, scaler_file)

print("[+] Model and Scaler successfully saved.")
```

### Step B: Load Assets and Predict (Inference Script)
During inference, load the saved assets, scale your active features, and run prediction using a strict **risk-averse threshold**:

```python
import pickle
import numpy as np

def load_ml_assets():
    with open('delay_prediction_model.pkl', 'rb') as model_file:
        model = pickle.load(model_file)
    with open('scaler.pkl', 'rb') as scaler_file:
        scaler = pickle.load(scaler_file)
    return model, scaler

# Load assets
model, scaler = load_ml_assets()

# Predict probability of being On-Time (Class 1)
on_time_prob = model.predict_proba(scaled_new_data)[:, 1]

# If the probability is below our risk-averse threshold, we flag it as Delayed (0)
# (e.g. threshold = 0.65 or 0.85 depending on model metrics)
if on_time_prob < 0.65:
    estimated_delay = 48  # Calculated based on lead time / route averages
    disruption_prob = 1.0 - float(on_time_prob)
    
    # Send to the backend
    send_delay_to_backend("DEL_015", estimated_delay, "Transport/Weather", disruption_prob)
```

### Step C: Post Prediction to Backend API
Your script must send the formatted payload using the `requests` library to the `/api/sandbox/simulate-iot` endpoint:

```python
import requests
import datetime

def send_delay_to_backend(delivery_id: str, delay_hours: int, reason_code: str, disruption_probability: float):
    url = "http://127.0.0.1:8001/api/sandbox/simulate-iot"
    
    # Payload structured exactly as the IoTTelemetryEvent schema expects
    payload = {
        "delivery_id": delivery_id,
        "estimated_delay_hours": int(delay_hours),
        "reason_code": reason_code,
        "disruption_probability": float(disruption_probability),
        "timestamp": datetime.datetime.utcnow().isoformat() + "Z"
    }
    
    try:
        response = requests.post(url, json=payload, timeout=5)
        if response.status_code == 200:
            print("[+] Success: Delay prediction processed by risk engine.")
            print("Alert Generated:", response.json())
        else:
            print(f"[-] Error: Backend returned code {response.status_code}")
    except Exception as e:
        print(f"[-] Connection Error: Could not reach backend: {e}")
```

---

## 3. How the Backend Processes the Prediction

Once the backend receives the payload at `/api/sandbox/simulate-iot`, the **`services/risk_engine_service.py`** processes it via a 7-node LangGraph pipeline:

1. **GraphDB Injection:** The event is written into GraphDB as a `:DelayEvent` (using namespace `<http://example.org/ontology#>`), linking it to the specified delivery ID.
2. **OWL Reasoning:** GraphDB's inference rules dynamically derive downstream effects (e.g., if delivery transports a critical material that is needed by a production line, GraphDB infers `ProductionProcess :isAtRisk true`).
3. **Contextual Evaluation:** The risk analyst node queries GraphDB to pull the supplier's SLA agreement (lead times, delay penalty clauses) and current inventory levels.
4. **Targeted Alerting:** The LLM evaluates the business risk (SLA breaches, penalty fees, and stoppage risks) and writes targeted alert notifications for the **Production**, **Procurement**, and **Logistics** managers.

---

## 4. Dataset Comparison & Compatibility

### Dataset Comparison Matrix

| Dimension | `Dataset_Procurement_SelectedFeatures.csv` (Training) | `historical_shipments_messy.csv` (Telemetry Logs) |
| :--- | :--- | :--- |
| **Primary Focus** | Procurement details (used to train the delay prediction model). | Shipment arrival/departure times (used for initial seed data). |
| **Row Count** | **5,200 rows** | **13 rows** |
| **Key Columns** | `PO Type`, `Supplier Tier`, `Category`, `Unit Price`, `Quantity`, `Line Net`, `Lead Time Days`, `Supplier ESG Score` | `Delivery_ID`, `PO_Number`, `Planned_Departure`, `Actual_Departure`, `Planned_Arrival`, `Actual_Arrival` |
| **Target Variable** | `Target_OnTimeDelivery` (Binary `0` / `1`) | Calculated by subtracting actual arrival from planned arrival times. |

### Compatibility & Mapping
Because the raw shipment logs do not contain the structural features the model was trained on (like `Supplier ESG Score` or `Category`), your inference pipeline must **map** the records:

1. Retrieve the active shipment's `Supplier_ID` and `Material_ID`.
2. Query your GraphDB / ERP database to fetch their details (Supplier ESG score, Region, Material Unit Price, Category).
3. Construct the 109 scaled feature columns.
4. Run predictions and translate the output back into the API payload format.

---

## 5. Live Production vs. Sandbox Data Flow

### Production Flow
In a live production system, the data flows dynamically:
* **IoT Stream:** GPS tracking sensors send coordinates and speed data. When a truck goes offline or slows down in a storm, a telemetry event is emitted.
* **ERP Database:** The ML pipeline pulls the contract/material details for that shipment's PO from the ERP database.
* **API Trigger:** The ML pipeline computes the delay and calls the FastAPI endpoints.

### Sandbox Simulation Flow
During local testing:
* **Simulated Telemetry:** The stream is read from the static JSON log: **`Data_Science/data_Lake/iot_streams/telemetry_stream_001.json`**.
* **Simulated ERP Database:** The supplier and material details are fetched directly from your local GraphDB repository (populated by `data_loader.py`).
* **Connection:** The requests are posted to `http://127.0.0.1:8001` running on your local machine.

---

## 6. Supplier Reliability Score Integration

**Objective:** Run periodically to calculate how well your suppliers are performing based on historical metrics and upload the scores to GraphDB.

### Part A: Calculate Supplier Scores (Notebook)
Add this cell to calculate a weighted rating (e.g. 80% on-time rate, 20% ESG score):

```python
# Group by supplier and aggregate historical data
supplier_stats = df.groupby(['Supplier ID', 'Supplier Name']).agg(
    on_time_rate=('On Time Delivery', 'mean'),
    avg_esg=('Supplier ESG Score', 'mean')
).reset_index()

# Calculate custom score
supplier_stats['normalized_esg'] = supplier_stats['avg_esg'] / 100.0
supplier_stats['reliability_score'] = (supplier_stats['on_time_rate'] * 0.8) + (supplier_stats['normalized_esg'] * 0.2)
supplier_stats['reliability_score'] = supplier_stats['reliability_score'].round(4)
```

### Part B: Update GraphDB using SPARQL Update
Add this cell to write the scores into GraphDB:

```python
from SPARQLWrapper import SPARQLWrapper, POST

GRAPHDB_UPDATE_ENDPOINT = "http://localhost:7200/repositories/SemanticDigitalTwin/statements"

def update_supplier_reliability_score(supplier_id: str, new_score: float):
    query = f"""
    PREFIX : <http://example.org/ontology#>
    PREFIX xsd: <http://www.w3.org/2001/XMLSchema#>
    
    DELETE {{
        GRAPH <http://example.org/contracts/> {{
            :{supplier_id} :hasReliabilityScore ?oldScore .
        }}
    }}
    INSERT {{
        GRAPH <http://example.org/contracts/> {{
            :{supplier_id} :hasReliabilityScore "{new_score}"^^xsd:float .
        }}
    }}
    WHERE {{
        OPTIONAL {{
            GRAPH <http://example.org/contracts/> {{
                :{supplier_id} :hasReliabilityScore ?oldScore .
            }}
        }}
    }}
    """
    
    sparql = SPARQLWrapper(GRAPHDB_UPDATE_ENDPOINT)
    sparql.setQuery(query)
    sparql.setMethod(POST)
    try:
        sparql.query()
        print(f"[+] Success: Updated score for {supplier_id} to {new_score}.")
    except Exception as e:
        print(f"[-] Error: {e}")

# Run update loop
for _, row in supplier_stats.iterrows():
    supplier_uri = f"Supplier_{str(row['Supplier ID']).replace('-', '_')}"
    update_supplier_reliability_score(supplier_uri, float(row['reliability_score']))
```

---

## 7. Dual-Model Architecture: Procurement vs. Logistics Delay Prediction

To construct a complete end-to-end supply chain risk management system, the Semantic Digital Twin employs two distinct ML models operating at different stages of the purchase order lifecycle:

### Phase 1: Contract Planning (Before Shipment Starts)
* **When:** You are placing a new purchase order with a supplier. The goods are not yet manufactured, and the shipping truck is not moving.
* **The Problem:** You have no live IoT data (no GPS, no vehicle speed, no current weather for next week).
* **The Model:** You run the **Procurement Model (Static)**.
* **The Purpose:** It looks at contract details (price, order quantity, payment terms, supplier tier, ESG score) and predicts: *"Historically, orders structured like this with this type of supplier have a 30% risk of delay."*
* **The Benefit:** It acts as a preventative decision-support tool. It informs the user if a proposed contract is high-risk and helps managers decide whether to allocate a backup supplier before any money or time is spent.

### Phase 2: In-Transit Tracking (Active Delivery)
* **When:** The goods are shipped, and a truck is driving on the highway.
* **The Problem:** The contract terms no longer matter—what matters is the physical road.
* **The Model:** You run the **Logistics Model (Dynamic)**.
* **The Purpose:** It looks at live IoT sensor streams (GPS coordinates, vehicle speed, current traffic congestion, weather severity) and predicts: *"The truck has stopped (speed = 0) in a heavy storm. Based on this, there is a 90% probability of a 24-hour delay."*
* **The Benefit:** It triggers real-time alerts to the production line so they can prepare for an immediate disruption.

### Summary
* **Without the Procurement Model:** You cannot predict risks when planning or placing orders.
* **Without the Logistics Model:** You cannot predict delays caused by real-world events while goods are moving.
* **Together:** They form a complete end-to-end risk management system: **Planning Risk Assessment $\rightarrow$ Live In-Transit Tracking**.

