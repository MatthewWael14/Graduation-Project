import asyncio
import os
import sys

sys.path.append(os.path.dirname(os.path.abspath(__file__)))

from services.dashboard_service import get_alerts, assign_material_to_process, update_alert_status

def handle_assign_material_process(material, process, alert_id=None):
    result = assign_material_to_process(material, process)
    if alert_id:
        update_alert_status(alert_id, "READ")
    return result

alerts = get_alerts()
new_mat_alerts = [a for a in alerts if a['category'] == "New Material"]
print(f"Found {len(new_mat_alerts)} new material alerts.")

for a in new_mat_alerts:
    print(f"Trying to assign material {a['materialName']} (alert {a['id']}) to Test Process...")
    try:
        res = handle_assign_material_process(a['materialName'] or a['desc'], "Test Process", a['id'])
        print("SUCCESS", res)
    except Exception as e:
        import traceback
        traceback.print_exc()
