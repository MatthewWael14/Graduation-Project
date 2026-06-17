# Implementation Plan — Procurement Order Planning Integration

We will integrate the static procurement classification model (trained on historical contract features) into the FastAPI backend. This will enable the frontend to assess the delay risk of a proposed Purchase Order *before* it is submitted, displaying the risk metrics alongside a detailed "Explainability Panel" of queried and derived features.

## User Review Required

> [!IMPORTANT]
> **API Interface & Payload:**
> We will add the endpoint `POST /api/sandbox/predict-order-risk` accepting a subset of primary inputs:
> - `supplier_id` (e.g. `Supplier_ACME`)
> - `material_id` (e.g. `Material_Steel_Sheet`)
> - `quantity` (e.g. 500)
> - `unit_price` (e.g. 6.55)
> - `po_date` (e.g. `2026-03-05`)
>
> All other required features (ESG score, supplier tier, region, lead time days, etc.) will be automatically resolved by querying Ontotext GraphDB.

> [!NOTE]
> **Explainability:**
> The API response will return not just the `on_time_probability` but also a detailed `features_used` dictionary. This enables the frontend to show judges a "Behind the Scenes" breakdown of what variables influenced the model's decision.

## Proposed Changes

---

### [Backend Component]

#### [NEW] ML Assets Directory
Copy the serialized model files from the `Machine_Learning/` directory to the backend so the service can load them reliably:
* Source: `Machine_Learning/delay_prediction_model.pkl` $\rightarrow$ Dest: `Backend/models/ml_assets/delay_prediction_model.pkl`
* Source: `Machine_Learning/scaler.pkl` $\rightarrow$ Dest: `Backend/models/ml_assets/scaler.pkl`
* Source: `Machine_Learning/model_features.json` $\rightarrow$ Dest: `Backend/models/ml_assets/model_features.json`

#### [MODIFY] [Backend/models/schemas.py](file:///c:/Users/waelm/Documents/GitHub/Graduation-Project2/Backend/models/schemas.py)
We will add the following Pydantic schemas:
* `OrderRiskPredictionRequest`: Accepts the primary user inputs.
* `OrderRiskPredictionResponse`: Returns the risk evaluation probability, estimated delay hours, classification risk level (`Low` vs `High`), and a dictionary of used context features.

#### [NEW] [Backend/services/order_risk_service.py](file:///c:/Users/waelm/Documents/GitHub/Graduation-Project2/Backend/services/order_risk_service.py)
Implement the business and inference logic:
1. **Lazy Asset Loader:** Load `delay_prediction_model.pkl`, `scaler.pkl`, and `model_features.json` on the first prediction call and cache them in memory.
2. **GraphDB Context Query:** Fetch the static supplier & material properties (ESG score, tier, region, category, subcategory, lead time days, payment terms, contract type, local international status) using a SPARQL query.
3. **Feature Engineering:**
   * Parse `po_date` to extract month and day-of-week.
   * Derive calculated interaction terms matching training logic: `Cost_per_Day`, `Qty_per_Day`, `Line Net`, `Tier_LeadTime_Interaction`, `High_Value_Order`, and `Extreme_Lead_Time_Flag`.
4. **Encoding & Scaling:** Build the 109-column feature vector in a pandas DataFrame. Apply the fitted `scaler.pkl` to the numerical columns. Set categorical one-hot fields to `1` or `0`.
5. **Inference:** Predict the on-time probability using the classifier. If on-time confidence is $<65\%$, classify risk as `High` and estimate delay hours as $20\%$ of the contract's lead time (min 24h), else classify as `Low` and 0h delay.

#### [MODIFY] [Backend/api/sandbox.py](file:///c:/Users/waelm/Documents/GitHub/Graduation-Project2/Backend/api/sandbox.py)
* Register the new endpoint: `POST /api/sandbox/predict-order-risk`.
* Map it to call `order_risk_service.predict_order_risk`.

---

## Verification Plan

### Automated Tests
1. **Verification Test:** Create a test script `Backend/tests/test_order_risk.py` that sends a mock request (e.g. using `DEL_015` or custom supplier context) and validates that:
   * The API returns a successful status code.
   * The returned payload contains the expected probability, risk classification, and explainability features.
2. **Run Backend Test suite:** Run `pytest Backend/tests/test_order_risk.py` to confirm all validation cases pass.
