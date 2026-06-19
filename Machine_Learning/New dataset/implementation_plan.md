# Implementation Plan — Dynamic Logistics Model Integration

We will integrate the dynamic logistics dataset `dynamic_supply_chain_logistics_dataset.xlsx` to train a real-time transit delay prediction model. Currently, the delay predictor runs on static procurement metrics (price, tier, etc.) and only uses telemetry to trigger calculations. By integrating the dynamic dataset, the model itself will directly consume live transit data (congestion levels, weather severity, speed, GPS) to predict delay probability and hours.

## User Review Required

> [!IMPORTANT]
> **Dual-Model Architecture (Separation of Scripts):**
> Instead of cluttering the legacy `delay_predictor_integration.py` file, we will separate the models:
> 1. The **Procurement Model** (legacy classifier) will remain in `delay_predictor_integration.py` to evaluate static contract risk.
> 2. A new script **[transit_delay_predictor.py](file:///c:/Users/waelm/Documents/GitHub/Graduation-Project2/Machine_Learning/transit_delay_predictor.py)** will be created to run the **Logistics Model** regressor for dynamic in-transit monitoring.
> 3. We will keep **[delay_predictor_logistics.py](file:///c:/Users/waelm/Documents/GitHub/Graduation-Project2/Machine_Learning/New%20dataset/delay_predictor_logistics.py)** strictly as the offline training script to serialize model assets.

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

#### [KEEP] [delay_predictor_logistics.py](file:///c:/Users/waelm/Documents/GitHub/Graduation-Project2/Machine_Learning/New%20dataset/delay_predictor_logistics.py)
This script remains as the offline model trainer. It trains the Linear Regression pipeline on the rebuilt target and serializes `logistics_model.pkl` and `logistics_features.json`.

#### [NEW] [transit_delay_predictor.py](file:///c:/Users/waelm/Documents/GitHub/Graduation-Project2/Machine_Learning/transit_delay_predictor.py)
We will create this new script to handle real-time stream simulation using the logistics regressor:
1. **Load Assets:** Load `New dataset/logistics_model.pkl` and `New dataset/logistics_features.json`.
2. **Telemetry Ingestion:** Iterate through a mock telemetry stream (containing evaluation shipments).
3. **GraphDB Querying:** Fetch supplier context (`hasReliabilityScore` as `supplier_reliability_score` and `leadTimeDays` as `lead_time_days`) from GraphDB.
4. **Build Feature Vector:** Map dynamic telemetry sensors (speed, temperature, coordinates, disruption probability) and GraphDB context to the 26-column format. Set unprovided features (e.g. `fuel_consumption_rate`) to `NaN` to leverage the pipeline imputer.
5. **Predict & Alert:** Predict delay hours directly. If the predicted delay is $> 0.5$ hours, POST an alert payload (including predicted hours, mapped reason code, and disruption probability) to the FastAPI server `/api/sandbox/simulate-iot`.

#### [NEW] [seed_evaluation_context.py](file:///c:/Users/waelm/Documents/GitHub/Graduation-Project2/Machine_Learning/New%20dataset/seed_evaluation_context.py)
We will create a seeding script to populate GraphDB with real supplier and logistics context from the 20% evaluation set:
1. Load a few test shipments from `evaluation_shipments.xlsx`.
2. Generate corresponding mock `delivery_id`s (e.g. `DEL_EVAL_001`) and mock suppliers.
3. Construct SPARQL INSERT queries to seed their properties (e.g. `:leadTimeDays`, `:hasReliabilityScore`) in GraphDB.
4. Generate a matching mock telemetry JSON file `telemetry_stream_logistics.json` to feed into `transit_delay_predictor.py`.

---

## Verification Plan

### Automated Tests
1. **Seed GraphDB:** Run the seeding script to insert evaluation shipments into GraphDB:
   ```bash
   $env:PYTHONIOENCODING="utf-8"; .\Backend\venv\Scripts\python "New dataset/seed_evaluation_context.py"
   ```
2. **Verify Stream Simulation:** Run the new stream simulation script using the logistics model:
   ```bash
   $env:PYTHONIOENCODING="utf-8"; .\Backend\venv\Scripts\python transit_delay_predictor.py
   ```
3. **Check Backend Alerts:** Confirm that the backend correctly receives the dynamic delay hours and routes targeted alerts.
