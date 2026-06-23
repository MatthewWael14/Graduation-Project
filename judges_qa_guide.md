# Graduation Project Presentation - Judges Q&A Revision Guide

Use this guide to revise your answers to questions the judges might ask during your presentation regarding the **Logistics ML Model**, **IoT Telemetry**, and the **SLA/Alerts Pipeline**.

---

## Q1: "Why do we pass predicted values (delay hours, disruption probability) in the sandbox payload instead of having the model predict them?"

### Answer Summary
The `/api/sandbox/simulate-iot` endpoint is not a raw sensor endpoint. It is the **SLA Sandbox for the LangGraph risk engine**. It is designed to test how our multi-agent pipeline and OWL ontologies react to different hypothetical ML model outputs.

### Detailed Breakdown
*   **In a Real Production System**:
    1. Raw vehicle GPS trackers stream basic sensor data (GPS, speed, cargo temperature, weather) to the backend.
    2. The backend runs the **Logistics Delay ML Model (`logistics_delay_model.pkl`)** on these raw sensor readings to predict `estimated_delay_hours`.
    3. The backend compiles these predictions into an `IoTTelemetryEvent` and hands it over to the LangGraph risk engine to alert managers.
*   **In the Sandbox Demo**:
    *   The Sandbox endpoint represents the *handoff* point *after* the ML model has run. It allows you to simulate different ML predictions directly to show how the LangGraph routing, contract checks, and manager alerts behave.

---

## Q2: "From where do we get the raw telemetry data like weather and disruption probability?"

### Answer Summary
In the real system, these are fetched from active hardware sensors and external web APIs. In the demo system, they are loaded from a simulated data lake dataset.

### Detailed Breakdown
*   **GPS coordinates, speed, and cargo temperature**: Sourced from the vehicle's onboard telematics unit (e.g., GPS transponder and temperature probe sensors).
*   **Weather Condition**: Sourced from a **live weather API** (like OpenWeatherMap or AccuWeather) by querying the truck's current latitude and longitude.
*   **Disruption Probability**: Sourced from **external route risk APIs** (like DHL Resilience360 or NOAA weather alerts) which compile route blockage, storm severity, and strikes into a probability score.
*   **Simulator Dataset**: In the demo, these are generated in `generate_telemetry_stream.py` to maintain statistical consistency (e.g. "Storm" weather programmatically yields a higher disruption probability).

---

## Q3: "How do we know that the delay prediction is correct?"

### Answer Summary
We verify the correctness of the ML predictions using three layers: **Statistical Evaluation Metrics (R², MAE)** during training, **Unseen Test Set Validation**, and **LangGraph Quality Guardrails**.

### Detailed Breakdown
1.  **Unseen Test Set Validation**:
    During training (in `train_logistics_model.py`), the dataset is split into a **Training Set (80%)** and an **unseen Test Set (20%)**. The metrics are evaluated only on this unseen 20% to prove the model generalizes well and doesn't just memorize the data (overfitting).
2.  **Standard Evaluation Metrics**:
    We evaluate the model using three main regression metrics:
    *   **R² (Coefficient of Determination)**: Measures how well the features explain the delay variance. Our Random Forest/Gradient Boosting models achieve an $R^2 > 0.90$ on the test set.
    *   **MAE (Mean Absolute Error)**: Indicates the average distance between predictions and actual delay hours. (e.g. *"Our model's predictions are, on average, within $\pm 1.2$ hours of the actual delay"*).
    *   **RMSE (Root Mean Squared Error)**: Measures error magnitude, penalizing larger outliers.
3.  **Ontological & Guardrail Validation**:
    *   **ML Clamping**: The model outputs raw float values which the backend clamps to non-negative ranges.
    *   **Validator Agent**: In LangGraph, the **Validator Node** reviews the final alert text to ensure the severity level and description are factually consistent with the risk context, acting as a final safeguard against hallucinated or erroneous predictions.
4.  **Honest Caveat**:
    *"For the purposes of this graduation demo, the model is trained on a simulated supply chain dataset. In a real-world production deployment, we would train this exact scikit-learn pipeline on historical ERP shipment data (SAP/Oracle) and historical 3PL transit tracking logs."*

---

## Q4: "Should the Production Manager have the SLA Compliance Monitor?"

### Answer Summary
No, the Production Manager should not have the detailed **SLA Violations Monitor (table)**, but they do benefit from seeing the high-level **SLA Compliance KPI Card (percentage)**. 

### Detailed Breakdown
*   **Detailed SLA Monitor (Table) is Hidden**:
    *   The detailed table tracks legal contract clauses, specific penalty rates (e.g., *"$150/day penalty"*), and total accrued penalties.
    *   The Production Manager does not manage carrier contract negotiations, legal SLA terms, or financial penalties. Exposing these details to them violates the principle of **Separation of Duties** and creates dashboard clutter.
*   **High-Level KPI Card is Visible**:
    *   The Production Manager is shown the high-level "SLA Compliance" percentage KPI card because supplier reliability directly impacts internal scheduling.
    *   If overall supplier SLA compliance drops, the Production Manager can anticipate raw material supply issues and proactively adjust assembly line speed or shift schedules before a critical stockout occurs.

---

## Q5: "Why does the Procurement Manager have the At-Risk Shipment KPI?"

### Answer Summary
The Procurement Manager needs the "At-Risk Shipment" KPI to manage vendor relationships, calculate financial penalties, and execute contingency sourcing strategies before production is affected.

### Detailed Breakdown
1.  **Supplier Performance Evaluation & Reviews**:
    *   Procurement owns supplier contracts. When a supplier's shipments are consistently "at risk," it directly reduces their **Supplier Reliability Score** (shown on the Procurement chart).
    *   Procurement uses these metrics during quarterly reviews and contract renegotiations to demand price adjustments or switch to more reliable vendors.
2.  **Contractual Penalty Tracking**:
    *   If an at-risk shipment breaches its SLA, Procurement is responsible for enforcing the contract's financial penalty clauses and collecting the **Total Penalties** accrued from the late vendor or carrier.
3.  **Proactive Secondary Sourcing**:
    *   If a shipment of critical raw materials is flagged as "at risk" and is highly likely to be delayed, Procurement must proactively initiate purchase orders with alternative, pre-approved backup suppliers. This prevents production shutdowns without requiring direct warehouse/factory stock intervention.
