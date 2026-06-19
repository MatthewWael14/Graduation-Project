"""
Probe service functions to measure how long each one takes.
Run with: Backend/venv/Scripts/python.exe scratch/probe_services.py
"""
import sys
import time

sys.path.insert(0, "Backend")

from dotenv import load_dotenv
load_dotenv("Backend/.env")

from services import dashboard_service

def probe():
    print("=========================================")
    print("PROBING DASHBOARD SERVICE FUNCTIONS")
    print("=========================================")
    
    t0 = time.time()
    try:
        res = dashboard_service.get_impacted_products()
        print(f"[OK] get_impacted_products(): {len(res)} rows in {time.time() - t0:.3f}s")
    except Exception as e:
        print(f"[ERROR] get_impacted_products(): {e} after {time.time() - t0:.3f}s")
        
    t0 = time.time()
    try:
        res = dashboard_service.get_risk_scores()
        print(f"[OK] get_risk_scores(): {len(res)} rows in {time.time() - t0:.3f}s")
    except Exception as e:
        print(f"[ERROR] get_risk_scores(): {e} after {time.time() - t0:.3f}s")
        
    t0 = time.time()
    try:
        res = dashboard_service.get_compliance_alerts()
        print(f"[OK] get_compliance_alerts(): {len(res)} rows in {time.time() - t0:.3f}s")
    except Exception as e:
        print(f"[ERROR] get_compliance_alerts(): {e} after {time.time() - t0:.3f}s")

    t0 = time.time()
    try:
        res = dashboard_service.get_kpis()
        print(f"[OK] get_kpis(): {res} in {time.time() - t0:.3f}s")
    except Exception as e:
        print(f"[ERROR] get_kpis(): {e} after {time.time() - t0:.3f}s")

    t0 = time.time()
    try:
        res = dashboard_service.get_alerts()
        print(f"[OK] get_alerts(): {len(res)} rows in {time.time() - t0:.3f}s")
    except Exception as e:
        print(f"[ERROR] get_alerts(): {e} after {time.time() - t0:.3f}s")

if __name__ == "__main__":
    probe()
