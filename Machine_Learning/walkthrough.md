# Walkthrough — Multi-Agent Risk Engine & ML Integration

We have successfully integrated the Machine Learning delay prediction pipeline with the FastAPI backend and Ontotext GraphDB.

---

## 1. Summary of Changes

### Telemetry Logs
* **Enriched [telemetry_stream_001.json](file:///c:/Users/waelm/Documents/GitHub/Graduation-Project2/Data_Science/data_Lake/iot_streams/telemetry_stream_001.json):** Added a full milestone shipping log sequence for delivery `DEL_005` (representing the critical component shipment) to test multiple delivery profiles alongside `DEL_015`.

### GraphDB Seeding
* **Seeded Delivery Properties directly in GraphDB:** Removed all mock BIND statements from the SPARQL query and instead inserted all the required ERP properties directly as triples for `:DEL_005` and `:DEL_015` in the active GraphDB instance.

### Machine Learning Component
* **Completed [delay_predictor_integration.py](file:///c:/Users/waelm/Documents/GitHub/Graduation-Project2/Machine%20Learning/delay_predictor_integration.py):**
  * **Direct GraphDB Querying:** Replaced the hardcoded SPARQL BIND defaults with active triple lookups (e.g. `:{delivery_id} :poType ?poType`).
  * **Removed Static Fallback:** Disabled the local Python dictionary fallback. The system now operates strictly on properties retrieved from GraphDB.
  * **Automated Trainer:** Scans for missing model serialization assets. If not found, it automatically preprocesses the historical procurement logs, trains a Random Forest Classifier, and exports the model assets.
  * **Resilient Requests:** Enhanced request timeout parameter to 60 seconds.

---

## 2. Verification Results

### 1. Ingestion and Classification Log
Running the simulation script triggers the training process first and then processes the mock stream, pulling properties directly from GraphDB:
```
============================================================
  SIMULATING TELEMETRY STREAM INGESTION
============================================================
[*] Successfully loaded model, scaler, and 114 features.
[*] Processing 8 telemetry events...

>> Ingested Telemetry for DEL_015 | Status: Scheduled | Weather: Clear
    [+] Telemetry is nominal. No action needed.

>> Ingested Telemetry for DEL_015 | Status: Shipped | Weather: Light Rain
    [+] Telemetry is nominal. No action needed.

>> Ingested Telemetry for DEL_015 | Status: Shipped | Weather: Storm
    [!] Telemetry anomaly detected (Weather: Storm, Speed: 0.0 km/h, Telemetry Disruption Prob: 0.65). Running ML risk evaluation...
[+] Loaded context for DEL_015 from live GraphDB.
    [i] ML Model On-Time Confidence: 68.67%
    [+] Delivery predicted to arrive on time. No alert triggered.

>> Ingested Telemetry for DEL_015 | Status: Shipped | Weather: Storm
    [!] Telemetry anomaly detected (Weather: Storm, Speed: 0.0 km/h, Telemetry Disruption Prob: 0.98). Running ML risk evaluation...
[+] Loaded context for DEL_015 from live GraphDB.
    [i] ML Model On-Time Confidence: 68.67%
    [+] Delivery predicted to arrive on time. No alert triggered.

>> Ingested Telemetry for DEL_005 | Status: Scheduled | Weather: Clear
    [+] Telemetry is nominal. No action needed.

>> Ingested Telemetry for DEL_005 | Status: Shipped | Weather: Windy
    [+] Telemetry is nominal. No action needed.

>> Ingested Telemetry for DEL_005 | Status: Shipped | Weather: Heavy Snow
    [!] Telemetry anomaly detected (Weather: Heavy Snow, Speed: 0.0 km/h, Telemetry Disruption Prob: 0.7). Running ML risk evaluation...
[+] Loaded context for DEL_005 from live GraphDB.
    [i] ML Model On-Time Confidence: 59.33%
    [!] RISK FLAGGED! Delay predicted (Disruption Prob: 0.41). Invoking API...
    [+] API Success: Alarm generated securely.
```

### 2. Generated Manager Alert Output
When `DEL_005` was flagged (On-Time confidence: `59.33%` < `65%` threshold), the backend's LangGraph risk engine ran to completion and generated the following validated manager alert:

> **Urgent Alert: Delivery DEL_005 Delay Risk**  
> The 72-hour Carrier_Issue delay risks assembly line stoppages due to depleted stock below safety levels, with a high disruption probability (0.41). Immediate action is required to mitigate inventory shortages and avoid additional penalties of $1,500. (Note: This assumes the SLA penalty is capped at 3 days—verify contract terms if delay extends further.)

### 3. Model Accuracy & Feature Importance Verification
You can verify the classification accuracy and feature importances by running the following command:
```powershell
python delay_predictor_integration.py --verify
```

**Verification Results Output:**
```
============================================================
  MODEL ACCURACY & PERFORMANCE VERIFICATION
============================================================

[+] Classification Report (1 = On-Time, 0 = Delayed):
              precision    recall  f1-score   support

     Delayed       0.56      0.64      0.59       373
     On-Time       0.78      0.72      0.75       667

    accuracy                           0.69      1040
   macro avg       0.67      0.68      0.67      1040
weighted avg       0.70      0.69      0.69      1040

[+] ROC-AUC Score: 0.7591

[+] Top 10 Most Important Features:
    1. Lead Time Days: 0.1093
    2. Tier_LeadTime_Interaction: 0.0841
    3. Qty_per_Day: 0.0769
    4. Cost_per_Day: 0.0533
    5. Quantity: 0.0501
    6. Savings Pct: 0.0478
    7. Unit Price: 0.0472
    8. Line Net: 0.0471
    9. Extreme_Lead_Time_Flag: 0.0338
    10. PO_Month_Num: 0.0327
============================================================
```
This confirms the model performs with a strong `0.7591` ROC-AUC score. The feature importance shows that `Lead Time Days`, `Tier_LeadTime_Interaction`, and `Qty_per_Day` are the primary predictive drivers.


