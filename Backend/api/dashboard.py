# ============================================================
# api/dashboard.py — Layer 1: Dashboard API Router
#
# Dashboard endpoints for NL chat, risk scores, compliance
# alerts, and fallback supplier options.
# ============================================================

import logging

from fastapi import APIRouter, HTTPException

from services.dashboard_service import (
    get_compliance_alerts,
    get_fallback_options,
    get_risk_scores,
    get_kpis,
    get_alerts,
    assign_fallback_supplier,
)
from services.chat_service import run_chat_pipeline_async
from pydantic import BaseModel

class FallbackAssignmentRequest(BaseModel):
    material: str
    supplierName: str
    assignmentType: str

class AlertStatusUpdate(BaseModel):
    alert_id: str

logger = logging.getLogger(__name__)

router = APIRouter(
    prefix="/api/dashboard",
    tags=["Dashboard"],
)


@router.get("/risk-scores")
async def handle_risk_scores():
    try:
        risk_scores = get_risk_scores()
        return {
            "status": "success",
            "count": len(risk_scores),
            "risk_scores": risk_scores,
        }
    except Exception as exc:
        logger.error("Failed to fetch risk scores: %s", exc)
        raise HTTPException(status_code=500, detail=str(exc))


@router.get("/compliance-alerts")
async def handle_compliance_alerts():
    try:
        results = get_compliance_alerts()
        return {"status": "success", "count": len(results), "alerts": results}
    except Exception as exc:
        logger.error("Failed to fetch compliance alerts: %s", exc)
        raise HTTPException(status_code=500, detail=str(exc))


@router.get("/fallback-options/{material_id}")
async def handle_fallback_options(material_id: str):
    try:
        results = get_fallback_options(material_id)
        return {
            "status": "success",
            "count": len(results),
            "material": material_id,
            "suppliers": results,
        }
    except Exception as exc:
        logger.error("Failed to fetch fallback options: %s", exc)
        raise HTTPException(status_code=500, detail=str(exc))

@router.post("/assign-fallback")
async def handle_assign_fallback(request: FallbackAssignmentRequest):
    try:
        result = assign_fallback_supplier(request.material, request.supplierName, request.assignmentType)
        return result
    except Exception as exc:
        logger.error("Failed to assign fallback supplier: %s", exc)
        raise HTTPException(status_code=500, detail=str(exc))

@router.get("/kpis")
async def handle_kpis():
    try:
        kpis = get_kpis()
        return {
            "status": "success",
            "kpis": kpis,
        }
    except Exception as exc:
        logger.error("Failed to fetch KPIs: %s", exc)
        raise HTTPException(status_code=500, detail=str(exc))

@router.get("/alerts")
async def handle_alerts():
    try:
        alerts = get_alerts()
        return {
            "status": "success",
            "count": len(alerts),
            "alerts": alerts,
        }
    except Exception as exc:
        logger.error("Failed to fetch alerts: %s", exc)
        raise HTTPException(status_code=500, detail=str(exc))

from services.dashboard_service import update_alert_status

@router.post("/alerts/mark-read")
async def mark_alert_read(req: AlertStatusUpdate):
    try:
        return update_alert_status(req.alert_id, "READ")
    except Exception as exc:
        logger.error("Failed to mark alert read: %s", exc)
        raise HTTPException(status_code=500, detail=str(exc))

@router.post("/alerts/dismiss")
async def dismiss_alert(req: AlertStatusUpdate):
    try:
        return update_alert_status(req.alert_id, "DISMISSED")
    except Exception as exc:
        logger.error("Failed to dismiss alert: %s", exc)
        raise HTTPException(status_code=500, detail=str(exc))


@router.post("/chat")
async def chat(question: dict):
    user_question = question.get("question", "").strip()
    if not user_question:
        raise HTTPException(status_code=400, detail="Question cannot be empty.")

    chat_history = question.get("chat_history", [])
    if not isinstance(chat_history, list):
        chat_history = []

    logger.info("Chat question: %.100s", user_question)

    try:
        state = await run_chat_pipeline_async(user_question, chat_history)
    except Exception as exc:
        logger.error("Chat pipeline crashed: %s", exc)
        raise HTTPException(
            status_code=500,
            detail=f"Chat pipeline error: {exc}",
        )

    return {
        "status": "success",
        "answer": state.get("final_answer", ""),
        "sparql": state.get("generated_sparql", ""),
        "results": state.get("graph_results", []),
        "topic_accepted": state.get("is_valid_topic", False),
    }
