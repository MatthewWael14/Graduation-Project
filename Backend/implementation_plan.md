# Implementation Plan - Telemetry Delay Risk & Compliance Sync Fixes

We are resolving the bug where supplier compliance and status do not update in the UI after simulating a delay risk event. We will also clean up the appended telemetry rows from the procurement CSV dataset.

## User Review Required

> [!IMPORTANT]
> - We will run the score-updating logic **synchronously** during the `/simulate-iot` telemetry request. This ensures that the UI gets updated data on the immediate subsequent refresh, avoiding a race condition.
> - Please ensure that **`Dataset_Procurement_SelectedFeatures.csv` is closed in Excel or other editors** so that the cleanup script can modify it without encountering a `PermissionDenied` error.

---

## Proposed Changes

### Backend Services

#### [MODIFY] [dashboard_service.py](file:///c:/Users/waelm/Documents/GitHub/Graduation-Project2/Backend/services/dashboard_service.py)
- Update `get_risk_scores` post-processing loop to prevent overriding an already-flagged `RED` status to `GREEN`.

#### [MODIFY] [risk_engine_service.py](file:///c:/Users/waelm/Documents/GitHub/Graduation-Project2/Backend/services/risk_engine_service.py)
- Change background thread spawning to await the `record_telemetry_transaction_and_update_score` execution synchronously in the loop executor.

#### [MODIFY] [supplier_evaluator_service.py](file:///c:/Users/waelm/Documents/GitHub/Graduation-Project2/Backend/services/supplier_evaluator_service.py)
- Import and call `invalidate_impacted_cache()` at the end of `record_telemetry_transaction_and_update_score()` to clear the cache when a telemetry update happens.

---

### Machine Learning Dataset

#### [MODIFY] [Dataset_Procurement_SelectedFeatures.csv](file:///c:/Users/waelm/Documents/GitHub/Graduation-Project2/Machine_Learning/Procurement_Model/Dataset_Procurement_SelectedFeatures.csv)
- Revert the file to its original 5200 rows and remove the added `Delivery ID` column.

---

## Verification Plan

### Automated/Manual Verification
1. **Cleanup Validation:** Check that `Dataset_Procurement_SelectedFeatures.csv` is restored to 5200 rows with no `Delivery ID` column.
2. **Telemetry Test:** Run the telemetry simulation for Aura Steel Co. Verify that:
   - Aura Steel Co appears as **RED** on the Suppliers/Network page.
   - Aura Steel Co SLA compliance drops to **0%** on the SLA Violations page.
   - Aura Steel Co reliability score is updated to **0.5000** in GraphDB.
