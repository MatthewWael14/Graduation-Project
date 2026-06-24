import asyncio
from Backend.services.dashboard_service import assign_material_to_process

try:
    res = assign_material_to_process("Test Material", "Test Process")
    print("SUCCESS", res)
except Exception as e:
    import traceback
    traceback.print_exc()
