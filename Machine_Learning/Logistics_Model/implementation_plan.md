# Implementation Plan — Dynamic Logistics Model Integration

We will integrate the dynamic logistics dataset `dynamic_supply_chain_logistics_dataset.xlsx` to train a real-time transit delay prediction model. Currently, the delay predictor runs on static procurement metrics (price, tier, etc.) and only uses telemetry to trigger calculations. By integrating the dynamic dataset, the model itself will directly consume live transit data (congestion levels, weather severity, speed, GPS) to predict delay probability and hours.

## User Review Required

> [!IMPORTANT]
> **Dual-Model Architecture:**
> We will keep both models:
> 1. The **Procurement Model** (already trained on procurement features) will remain as the baseline contract risk classifier when orders are created.
> 2. A new **Logistics Model** (trained on `dynamic_supply_chain_logistics_dataset.xlsx`) will be introduced to handle live telemetry events and calculate in-transit delays.

> [!WARNING]
> **Telemetry Stream Mapping:**
> The mock telemetry stream in `telemetry_stream_001.json` currently has simple keys (e.g., `weather_condition`, `current_speed_kmh`). We will map these keys to the model features:
> - `weather_condition` (e.g., "Storm", "Heavy Snow") -> `weather_condition_severity` (scalar representation, e.g. 0.8).
> - `current_speed_kmh` -> inversely proportional to `traffic_congestion_level`.
> - Query GraphDB to pull the supplier's latest calculated `hasReliabilityScore` and feed it into `supplier_reliability_score`.

## Open Questions

> [!IMPORTANT]
> **Regression vs. Classification:**
> The dynamic dataset contains both `delay_probability` (0.0 to 1.0) and `delivery_time_deviation` (actual delay hours).
> Should we train:
> 1. A **Regressor** to predict the actual delay hours (`delivery_time_deviation`) directly?
> 2. A **Classifier** to predict risk categories (`risk_classification` / `delay_probability`)?
> *(Our recommendation: Train a regressor for delay hours, as it directly updates estimated arrival times.)*

## Proposed Changes

---

### [Machine Learning Component]

#### [NEW] [delay_predictor_logistics.py](file:///c:/Users/waelm/Documents/GitHub/Graduation-Project2/Machine_Learning/delay_predictor_logistics.py)

We will create a script to train and serialize the new logistics model:
1. **Load Dataset:** Load `dynamic_supply_chain_logistics_dataset.xlsx` using pandas.
2. **Train-Test Partition (80/20 Split):**
   * Divide the dataset: **80% for Training** and **20% for Evaluation**.
   * Export the 20% Evaluation set as a standalone file `Machine_Learning/evaluation_shipments.xlsx` so that it is easily accessible for sandbox seeding and verification, while keeping it strictly hidden from training.
3. **Preprocessing & Feature Selection (Training Set Only):**
   * Select features: `traffic_congestion_level`, `weather_condition_severity`, `port_congestion_level`, `customs_clearance_time`, `supplier_reliability_score`, `lead_time_days`, `iot_temperature`, `route_risk_level`.
   * Fit `StandardScaler` only on the 80% training features.
4. **Train Model:** Train a `RandomForestRegressor` on the scaled 80% training set to predict `delivery_time_deviation` (delay hours).
5. **Export Assets:** Serialize `logistics_model.pkl` and `logistics_scaler.pkl`.

#### [MODIFY] [delay_predictor_integration.py](file:///c:/Users/waelm/Documents/GitHub/Graduation-Project2/Machine_Learning/delay_predictor_integration.py)

We will update the integration pipeline to consume the new model:
1. **Load Both Assets:** Load the static procurement model (for contract planning) and the new logistics model (for active telemetry).
2. **Telemetry Enrichment:** When a telemetry event is processed:
   * Map `weather_condition` to severity (Clear -> 0.1, Windy -> 0.3, Heavy Snow -> 0.7, Storm -> 0.9).
   * Map `current_speed_kmh` to traffic congestion (80kmh -> 1.0, 0kmh -> 8.0).
   * Query GraphDB to retrieve the active supplier's `hasReliabilityScore`.
3. **Logistics Inference:** Pass the enriched live telemetry vector into the logistics model.
4. **Payload Update:** Post the predicted delay hours and probability to `/api/sandbox/simulate-iot`.

---

## Verification Plan

### Automated Tests
1. **Train Model:** Run the training script:
   ```bash
   $env:PYTHONIOENCODING="utf-8"; .\venv\Scripts\python delay_predictor_logistics.py
   ```
2. **Verify Stream Simulation:** Run the stream simulation:
   ```bash
   $env:PYTHONIOENCODING="utf-8"; .\venv\Scripts\python delay_predictor_integration.py --debug
   ```
3. **Check Backend Alerts:** Confirm that the backend correctly receives the dynamic delay hours and routes targeted alerts.
