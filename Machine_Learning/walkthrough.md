# Walkthrough — Supply Chain Model Integrations

We have successfully tidied the Machine Learning structure and integrated both machine learning engines into our Semantic Digital Twin framework:
1. **Dynamic Logistics Model (Real-Time Transit Delay Regressor):** Loads dynamic transit sensors (weather severity, traffic congestion, speed, GPS) and GraphDB context to predict exact delay hours.
2. **Procurement Order Planning Model (Static Purchase Order Classifier):** Evaluates proposed order parameters (quantity, unit price, month, supplier) during creation to assess delay risk before placing a Purchase Order.

---

## 1. Directory Structure

The `Machine_Learning` folder has been reorganized into clean subdirectories to isolate the dynamic logistics model from the legacy static procurement model:

```
Machine_Learning/
├── Logistics_Model/
│   ├── Delay_orediction.ipynb                # Training notebook for logistics regression
│   ├── delay_predictor_logistics.py          # Training and serialization script
│   ├── dynamic_supply_chain_logistics_dataset.xlsx # Clean logistics dataset
│   ├── training_shipments.xlsx               # 80% training partition
│   ├── evaluation_shipments.xlsx             # 20% unseen evaluation partition
│   ├── logistics_model.pkl                   # Serialized Linear Regression pipeline
│   ├── logistics_features.json               # Expected features list
│   ├── seed_evaluation_context.py            # Seeding script for evaluation data & stream
│   └── transit_delay_predictor.py            # Real-time telemetry ingestion simulator
├── Procurement_Model/
│   ├── Graduation_Project_final.ipynb        # Training notebook for procurement classifier
│   ├── Supplier_Score.ipynb                  # Supplier scoring notebook
│   ├── Dataset_Procurement_SelectedFeatures.csv # Selected features procurement dataset
│   ├── delay_prediction_model.pkl            # Serialized RandomForest classifier
│   ├── scaler.pkl                            # Serialized StandardScaler
│   ├── model_features.json                   # List of 109 expected model features
│   ├── seed_procurement_evaluation.py        # Seeding script for procurement test suppliers
│   └── procurement_delay_predictor.py        # Legacy simulation and accuracy verification script
├── Machine_Learning_Integration.md           # Integration architecture guide
├── implementation_plan.md                    # Implementation plan for Procurement Order Planning
└── walkthrough.md                            # This walkthrough guide
```

---

## 2. Dynamic Logistics Model Integration

This model processes dynamic telemetry streams, maps them to the grounded GraphDB supplier contracts, and predicts the precise delay deviation.

### Component Walkthrough
* **[seed_evaluation_context.py](file:///c:/Users/waelm/Documents/GitHub/Graduation-Project2/Machine_Learning/Logistics_Model/seed_evaluation_context.py):** Isolated the 20% unseen test partition, picked three representative shipment profiles (nominal, medium delay, severe delay), seeded their attributes into GraphDB, and exported a mock telemetry log `telemetry_stream_logistics.json`.
* **[transit_delay_predictor.py](file:///c:/Users/waelm/Documents/GitHub/Graduation-Project2/Machine_Learning/Logistics_Model/transit_delay_predictor.py):** Stream ingestion simulation script. Loads `logistics_model.pkl`, queries Ontotext GraphDB for contract parameters, compiles features, runs inference, and invokes the backend's `/simulate-iot` endpoint for flagged delays.

### Ingestion Ingest Output Logs
Running the logistics stream simulator processes the anomalies and generates alerts on the backend:
```
============================================================
  RUNNING LOGISTICS STREAM INGESTION SIMULATION
============================================================
[*] Successfully loaded Linear Regression pipeline model.
[*] Model expects 26 features.
[*] Processing 6 telemetry events...

>> Ingested Telemetry for DEL_EVAL_001 | Status: Scheduled | Weather: Clear
    [+] Telemetry is nominal. No action needed.

>> Ingested Telemetry for DEL_EVAL_001 | Status: Shipped | Weather: Clear
    [+] Telemetry is nominal. No action needed.

>> Ingested Telemetry for DEL_EVAL_002 | Status: Scheduled | Weather: Clear
    [+] Telemetry is nominal. No action needed.

>> Ingested Telemetry for DEL_EVAL_002 | Status: Shipped | Weather: Windy
    [!] Telemetry anomaly detected (Weather: Windy, Speed: 80.0 km/h). Running ML logistics evaluation...
    [DEBUG] GraphDB Context: Lead Time Days=1, Supplier Reliability=0.15
    [i] ML Model Predicted Transit Delay Deviation: 3.2251 hours
    [!] RISK FLAGGED! Predicted Delay: 3.23h. Invoking API...
    [+] API Success: Alarm generated securely.
    [+] Alert text: **Alert: Potential Assembly Line Stoppage Risk**  

Delivery DEL_EVAL_002 delays may disrupt parts inventory, risking assembly line stoppages if shortages escalate. Monitor stock levels closely and prepare contingency plans to mitigate production downtime.

>> Ingested Telemetry for DEL_EVAL_003 | Status: Scheduled | Weather: Clear
    [+] Telemetry is nominal. No action needed.

>> Ingested Telemetry for DEL_EVAL_003 | Status: Shipped | Weather: Heavy Snow
    [!] Telemetry anomaly detected (Weather: Heavy Snow, Speed: 0.0 km/h). Running ML logistics evaluation...
    [DEBUG] GraphDB Context: Lead Time Days=7, Supplier Reliability=0.06
    [i] ML Model Predicted Transit Delay Deviation: 5.2846 hours
    [!] RISK FLAGGED! Predicted Delay: 5.28h. Invoking API...
    [+] API Success: Alarm generated securely.
    [+] Alert text: **ALERT:** Delivery DEL_EVAL_003 is delayed by 5 hours due to transport/weather conditions, risking potential assembly line stoppages if inventory buffers are exhausted. Monitor stock levels closely to mitigate disruptions, as the delay carries a medium process impact and estimated financial penalties of ~$104.17.

============================================================
  SIMULATION INGESTION COMPLETE
============================================================
```

---

## 3. Procurement Order Planning Model Integration

This model runs in the order planning screen to assess risk *before* placing a Purchase Order.

### Component Walkthrough
* **[seed_procurement_evaluation.py](file:///c:/Users/waelm/Documents/GitHub/Graduation-Project2/Machine_Learning/Procurement_Model/seed_procurement_evaluation.py):** Splits the procurement dataset, extracts 15 unique suppliers present in the 20% unseen test partition, and seeds their logistics metrics (tier, region, ESG score, terms) into GraphDB.
* **[procurement_delay_predictor.py](file:///c:/Users/waelm/Documents/GitHub/Graduation-Project2/Machine_Learning/Procurement_Model/procurement_delay_predictor.py):** Legacy classifier code upgraded to use dynamic path resolution. Supports `--verify` for model validation.
* **[order_risk_service.py](file:///c:/Users/waelm/Documents/GitHub/Graduation-Project2/Backend/services/order_risk_service.py):** Full 109-feature engineering and RandomForest inference execution in the FastAPI backend, utilizing GraphDB context.

### Model Performance Verification Output
Running the accuracy verification on the isolated test partition confirms stable model outputs:
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
