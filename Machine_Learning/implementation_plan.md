# Implementation Plan — Machine Learning to Backend Integration

This plan outlines the steps to integrate the Machine Learning delay prediction models trained in `Graduation_Project_final.ipynb` with the FastAPI backend and Ontotext GraphDB database.

---

## Proposed Changes

### Telemetry Logs Data Modification
We will enrich the mock test dataset [telemetry_stream_001.json](file:///c:/Users/waelm/Documents/GitHub/Graduation-Project2/Data_Science/data_Lake/iot_streams/telemetry_stream_001.json) by adding more simulated shipping logs. We will ensure that all simulated deliveries match the active deliveries defined in [master_operational_data.json](file:///c:/Users/waelm/Documents/GitHub/Graduation-Project2/Data_Science/data_Lake/raw_logs/master_operational_data.json) (specifically `DEL_005` and `DEL_015`), which are populated as instances in the ontology/GraphDB. We will add a complete telemetry milestone sequence for `DEL_005`.

### Machine Learning Component

We will implement the complete ML-to-Backend pipeline directly inside [delay_predictor_integration.py](file:///c:/Users/waelm/Documents/GitHub/Graduation-Project2/Machine%20Learning/delay_predictor_integration.py).

#### [MODIFY] [delay_predictor_integration.py](file:///c:/Users/waelm/Documents/GitHub/Graduation-Project2/Machine%20Learning/delay_predictor_integration.py)
We will expand this script into a fully functioning automated training and simulation runner:
1. **Automated Training Bootstrapper:** Checks if `delay_prediction_model.pkl` and `scaler.pkl` exist. If not, it automatically loads [Dataset_Procurement_SelectedFeatures.csv](file:///c:/Users/waelm/Documents/GitHub/Graduation-Project2/Machine%20Learning/Dataset_Procurement_SelectedFeatures.csv), runs the data preprocessing (feature engineering, one-hot encoding, oversampling, scaling), trains the RandomForest model, and exports the `.pkl` assets.
2. **Real-time Telemetry Stream Simulator:**
   - Reads shipping logs from [telemetry_stream_001.json](file:///c:/Users/waelm/Documents/GitHub/Graduation-Project2/Data_Science/data_Lake/iot_streams/telemetry_stream_001.json).
   - Iterates through the streaming events. For each delivery (e.g. `DEL_015` or `DEL_005`), it maps the incoming telemetry parameters to the 109 structural model features by querying GraphDB (falling back to a local lookup replica if GraphDB is offline).
   - Processes the inputs through the `StandardScaler` and runs model inference.
   - For predicted delays, builds the payload and invokes the FastAPI endpoint `/api/sandbox/simulate-iot`.

---

## Verification Plan

### Automated Steps
1. Run `python delay_predictor_integration.py` to automatically train the model (if assets are missing), load the `.pkl` files, process the enriched mock telemetry logs, and verify that predicted delays are successfully sent to the backend endpoint.
2. Confirm the FastAPI backend is running locally on port `8001`.

### Manual Verification
- Review the backend logs and GraphDB instance to confirm that:
  - `:DelayEvent` instances are dynamically injected for delayed deliveries.
  - Manager alerts are correctly output in response to the ML events.
