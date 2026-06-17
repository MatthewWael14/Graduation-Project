# Delay Prediction Workflow: Legacy vs. Dynamic Logistics Model

This document outlines the evolutionary transition of the delay prediction pipeline in the Semantic Digital Twin: moving from a static contract-based risk classifier to an active, real-time in-transit logistics predictor.

---

## 1. Dataset Limitations & Suitability

To predict delays in a real-time shipping environment, the system requires the correct data context. The legacy datasets had structural limitations:

### Why `Dataset_Procurement_SelectedFeatures.csv` is not suitable for transit tracking:
* **Lacks Transit Context:** It contains only static, contract-level purchase details (such as `Unit Price`, `Discount Pct`, `Savings Pct`, `Preferred Supplier`, and `Supplier Tier`). It has no columns for vehicle speed, weather severity, route risk, customs delays, or GPS coordinates.
* **No Real-Time Adaptability:** A model trained *only* on this dataset cannot adapt to road conditions. If a shipping truck is caught in a sudden storm, this model cannot update its prediction.

### Why `telemetry_stream_001.json` is not enough:
* **Log Size (Not a Training Set):** This file is a tiny log containing only **8 event rows** used to test the sandbox simulator. You cannot train a Machine Learning model (like Random Forest or XGBoost) on 8 rows of data without severe overfitting. Training requires thousands of historical rows to learn patterns.
* **Lacks Static Context:** Telemetry only tells you about the truck (e.g., speed: `0 km/h`, weather: `Storm`). To predict the *impact* of that stoppage, the model needs to know the contract details (e.g., lead time days, safety stock levels) which are missing in raw telemetry.

---

## 2. Legacy Prediction Workflow (How we did it before)

Previously, the pipeline predicted delays using a **hybrid approach (Static ML + Rule-Based Heuristics)**:

```
┌──────────────────────────┐
│ Ingest Telemetry Stream  │ (Wind, Speed, Coordinates)
└────────────┬─────────────┘
             │
             ▼
┌──────────────────────────┐      NO
│ Telemetry Anomaly?       ├───────────────► [ NOMINAL: No Action ]
└────────────┬─────────────┘
             │ YES
             ▼
┌──────────────────────────┐
│ Retrieve Context (Graph) │ (Pull static contract fields from GraphDB)
└────────────┬─────────────┘
             │
             ▼
┌──────────────────────────┐
│ Predict Risk (Static ML) │ (Classifies baseline contract delay risk)
└────────────┬─────────────┘
             │
             ▼
┌──────────────────────────┐
│ Rule-Based Heuristics    │ (Guesses delay hours & maps reason code)
└──────────────────────────┘
```

1. **Telemetry as a Gatekeeper (Rule-Based):**
   The pipeline monitored incoming telemetry events. If a truck was stopped (`speed = 0`) or in a storm, a telemetry anomaly was flagged, which acted as a trigger.
2. **Context Enrichment (GraphDB):**
   The pipeline queried GraphDB to load the contract parameters (price, quantity, supplier tier) associated with that delivery.
3. **Risk Prediction (Static ML):**
   The **Procurement ML model** (trained on static features) took those contract details and predicted the probability of the order arriving on time. If on-time confidence fell below `65%`, a delay risk was flagged.
4. **Delay Details (Rule-Based Heuristics):**
   Because the static model had no concept of transit hours or weather, we calculated the details using simple mathematical formulas:
   * **Delay Hours:** Estimated as a percentage of the contract's lead time scaled by the disruption probability:
     $$\text{Estimated Delay} = \max\left(24, \text{Disruption Prob} \times \text{Lead Time Days} \times 24 \times 0.20\right)$$
   * **Reason Code:** Mapped via string matching (if weather was Storm/Snow, reason became `"Transport/Weather"`, otherwise it defaulted to `"Carrier_Issue"`).

---

## 3. Dynamic Logistics Workflow (The New Model)

By integrating the new **`dynamic_supply_chain_logistics_dataset.xlsx`**, the model itself directly handles both static and real-time features.

### The Dataset Bridge:
The dynamic logistics dataset contains **thousands of rows** combining both worlds:
1. **Static Context:** `lead_time_days`, `supplier_reliability_score`, `historical_demand`.
2. **Live In-Transit Sensors:** `weather_condition_severity`, `traffic_congestion_level`, `port_congestion_level`, `customs_clearance_time`, `vehicle_gps_latitude/longitude`, `iot_temperature`, and `current_speed`.

### The New Inference Step:
When a telemetry event is ingested:
1. The backend automatically extracts live weather severity, speed, and congestion levels.
2. It fetches the supplier's active `hasReliabilityScore` from GraphDB.
3. It builds a combined real-time feature vector and passes it to the new **Logistics Model**.
4. The model directly outputs the predicted **delay probability** and the **exact delivery time deviation** (delay hours) based on actual physical factors.

---

## 4. Sandbox Validation & Train-Test Separation

To ensure the integrity of the system and prevent data leakage, we enforce a strict separation between the data used to train the machine learning model and the data populated in GraphDB for sandbox simulation:

1. **The 80/20 Split:** The dataset `dynamic_supply_chain_logistics_dataset.xlsx` is divided into a **Training Set (80%)** and a **Reserved Evaluation Set (20%)**.
2. **Untouched Evaluation Data:** The reserved 20% is completely excluded from the model training process. The model never "sees" these rows.
3. **GraphDB Mock Seeding:** A small number of shipments are taken from the 20% evaluation set and loaded into GraphDB as active mock deliveries (e.g., `DEL_015`, `DEL_005`).
4. **Simulator Validation:** When we feed the telemetry of these mock deliveries into the simulator, the model is evaluated on entirely new, unseen data, proving that it can successfully generalise and predict delays under realistic, live conditions.

