"""
AI Copilot API Routes
Integrate Groq AI for investigative analysis
"""

from fastapi import APIRouter, HTTPException, File, UploadFile, Form
from typing import Optional, List, Dict, Any
import logging
import base64
import io
from PIL import Image

from ai.services.groq_ai_service import GroqAIService
from ai.services.forensic_analyzer import ForensicAnalyzer

logger = logging.getLogger("panopticon.api.ai_copilot")

router = APIRouter(prefix="/copilot", tags=["ai-copilot"])

# Initialize services
groq_service = GroqAIService()
forensic_analyzer = ForensicAnalyzer()


@router.post("/analyze-image")
async def analyze_image(
    file: UploadFile = File(...),
    analysis_type: str = "forensic",
    context: Optional[str] = None,
):
    """
    Analyze image using Groq Vision model

    Args:
        file: Image file to analyze
        analysis_type: Type of analysis (forensic, suspect, weapon, scene, evidence)
        context: Additional context

    Returns:
        Analysis results from Groq AI
    """
    try:
        # Read image
        contents = await file.read()
        
        # Encode to base64
        image_base64 = base64.b64encode(contents).decode("utf-8")

        # Analyze with Groq
        result = await groq_service.analyze_image(
            image_source=image_base64,
            analysis_type=analysis_type,
            context=context,
        )

        return result

    except Exception as e:
        logger.error(f"Image analysis error: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/investigate-evidence")
async def investigate_evidence(
    evidence_description: str = Form(...),
    detections: Optional[str] = Form(None),
):
    """
    Generate investigative insights from evidence

    Args:
        evidence_description: Description of the evidence
        detections: JSON string of detections from vision models

    Returns:
        Investigative analysis
    """
    try:
        import json

        # Parse detections if provided
        detections_list = []
        if detections:
            try:
                detections_list = json.loads(detections)
            except json.JSONDecodeError:
                detections_list = []

        # Get investigative analysis
        result = await groq_service.investigate_evidence(
            evidence_description=evidence_description,
            detections=detections_list,
        )

        return result

    except Exception as e:
        logger.error(f"Evidence investigation error: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/copilot-query")
async def copilot_query(
    query: str = Form(...),
    case_context: Optional[str] = Form(None),
):
    """
    AI Copilot for investigator queries

    Args:
        query: Investigator question
        case_context: Optional JSON context about the case

    Returns:
        Copilot response
    """
    try:
        import json

        # Parse case context if provided
        case_data = None
        if case_context:
            try:
                case_data = json.loads(case_context)
            except json.JSONDecodeError:
                case_data = None

        # Get copilot response
        result = await groq_service.copilot_query(
            query=query,
            case_context=case_data,
        )

        return result

    except Exception as e:
        logger.error(f"Copilot query error: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/generate-report")
async def generate_report(
    case_summary: str = Form(...),
    findings: Optional[str] = Form(None),
    suspects: Optional[str] = Form(None),
):
    """
    Generate comprehensive investigation report

    Args:
        case_summary: Summary of the case
        findings: JSON array of findings
        suspects: JSON array of suspect information

    Returns:
        Generated report
    """
    try:
        import json

        # Parse findings and suspects
        findings_list = []
        suspects_list = []

        if findings:
            try:
                findings_list = json.loads(findings)
            except json.JSONDecodeError:
                findings_list = []

        if suspects:
            try:
                suspects_list = json.loads(suspects)
            except json.JSONDecodeError:
                suspects_list = []

        # Generate report
        result = await groq_service.generate_report(
            case_summary=case_summary,
            findings=findings_list,
            suspects=suspects_list,
        )

        return result

    except Exception as e:
        logger.error(f"Report generation error: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/batch-analyze")
async def batch_analyze(
    files: List[UploadFile] = File(...),
    analysis_type: str = "forensic",
):
    """
    Analyze multiple images

    Args:
        files: List of image files
        analysis_type: Type of analysis for all images

    Returns:
        Analysis results for each image
    """
    try:
        results = []

        for file in files:
            contents = await file.read()
            image_base64 = base64.b64encode(contents).decode("utf-8")

            result = await groq_service.analyze_image(
                image_source=image_base64,
                analysis_type=analysis_type,
                context=f"Image: {file.filename}",
            )

            results.append(
                {
                    "filename": file.filename,
                    "analysis": result,
                }
            )

        return {"status": "success", "results": results, "total_images": len(results)}

    except Exception as e:
        logger.error(f"Batch analysis error: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/health")
async def health_check():
    """Check if AI Copilot service is available"""
    try:
        return {
            "status": "operational",
            "service": "AI Copilot",
            "models": {
                "vision": "llama-2-90b-vision",
                "reasoning": "llama-3.1-405b",
            },
        }
    except Exception as e:
        logger.error(f"Health check error: {e}")
        raise HTTPException(status_code=503, detail="Service unavailable")
