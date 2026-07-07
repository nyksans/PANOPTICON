"""
Groq AI Service for Image Inference and Investigative Copilot
Provides real-time AI analysis of forensic evidence
"""

import os
import base64
import logging
from typing import Optional, Dict, Any, List
import httpx
import json

logger = logging.getLogger("panopticon.services.groq_ai")


class GroqAIService:
    """
    Groq AI Service for forensic image analysis and investigation assistance
    """

    BASE_URL = "https://api.groq.com/openai/v1"
    
    # Models available
    MODELS = {
        "vision": "llama-2-90b-vision",  # For image analysis
        "text": "mixtral-8x7b-32768",     # For text analysis
        "reasoning": "llama-3.1-405b",   # For complex reasoning
    }

    def __init__(self, api_key: Optional[str] = None):
        """
        Initialize Groq AI Service

        Args:
            api_key: Groq API key (uses GROQ_API_KEY env var if not provided)
        """
        self.api_key = api_key or os.getenv("GROQ_API_KEY")
        
        if not self.api_key:
            raise ValueError(
                "Groq API key not found. Set GROQ_API_KEY environment variable."
            )

        self.client = httpx.Client(
            headers={
                "Authorization": f"Bearer {self.api_key}",
                "Content-Type": "application/json",
            },
            timeout=30.0,
        )
        self.logger = logging.getLogger("panopticon.groq_ai")

    async def analyze_image(
        self,
        image_source: str,
        analysis_type: str = "forensic",
        context: Optional[str] = None,
    ) -> Dict[str, Any]:
        """
        Analyze image using Groq Vision model

        Args:
            image_source: URL or base64-encoded image
            analysis_type: Type of analysis (forensic, suspect, weapon, scene)
            context: Additional context about the image

        Returns:
            Analysis results from Groq
        """
        try:
            # Prepare image data
            if image_source.startswith("http"):
                image_data = {"type": "image_url", "image_url": {"url": image_source}}
            else:
                # Assume base64-encoded
                image_data = {
                    "type": "image_url",
                    "image_url": {"url": f"data:image/jpeg;base64,{image_source}"},
                }

            # Build prompt based on analysis type
            prompts = {
                "forensic": self._get_forensic_prompt(),
                "suspect": self._get_suspect_prompt(),
                "weapon": self._get_weapon_prompt(),
                "scene": self._get_scene_prompt(),
                "evidence": self._get_evidence_prompt(),
            }

            prompt = prompts.get(analysis_type, self._get_forensic_prompt())
            if context:
                prompt += f"\n\nAdditional context: {context}"

            # Call Groq API
            payload = {
                "model": self.MODELS["vision"],
                "messages": [
                    {
                        "role": "user",
                        "content": [
                            image_data,
                            {"type": "text", "text": prompt},
                        ],
                    }
                ],
                "temperature": 0.7,
                "max_tokens": 1024,
            }

            response = httpx.post(
                f"{self.BASE_URL}/chat/completions",
                json=payload,
                headers=self.client.headers,
                timeout=30.0,
            )

            if response.status_code != 200:
                self.logger.error(f"Groq API error: {response.text}")
                return {"error": response.text}

            result = response.json()
            analysis_text = result["choices"][0]["message"]["content"]

            return {
                "success": True,
                "analysis_type": analysis_type,
                "analysis": analysis_text,
                "model": self.MODELS["vision"],
                "tokens_used": result.get("usage", {}).get("total_tokens", 0),
            }

        except Exception as e:
            self.logger.error(f"Image analysis error: {e}")
            return {"error": str(e)}

    async def investigate_evidence(
        self,
        evidence_description: str,
        detections: List[Dict[str, Any]],
    ) -> Dict[str, Any]:
        """
        Generate investigative insights from evidence

        Args:
            evidence_description: Description of evidence
            detections: List of detections from vision models

        Returns:
            Investigative analysis
        """
        try:
            detections_text = "\n".join(
                [
                    f"- {d.get('label')}: confidence {d.get('confidence'):.2f}"
                    for d in detections
                ]
            )

            prompt = f"""Analyze the following forensic evidence for investigative insights:

Evidence: {evidence_description}

Detected Objects:
{detections_text}

Please provide:
1. Key observations
2. Suspicious patterns or anomalies
3. Investigative recommendations
4. Risk assessment (low/medium/high/critical)
5. Potential next steps

Format as JSON with these keys: observations, patterns, recommendations, risk_level, next_steps"""

            payload = {
                "model": self.MODELS["reasoning"],
                "messages": [
                    {
                        "role": "user",
                        "content": prompt,
                    }
                ],
                "temperature": 0.5,
                "max_tokens": 1500,
            }

            response = httpx.post(
                f"{self.BASE_URL}/chat/completions",
                json=payload,
                headers=self.client.headers,
                timeout=30.0,
            )

            if response.status_code != 200:
                self.logger.error(f"Groq API error: {response.text}")
                return {"error": response.text}

            result = response.json()
            analysis_text = result["choices"][0]["message"]["content"]

            # Parse JSON response
            try:
                analysis_json = json.loads(analysis_text)
            except json.JSONDecodeError:
                analysis_json = {"raw_analysis": analysis_text}

            return {
                "success": True,
                "analysis": analysis_json,
                "model": self.MODELS["reasoning"],
                "tokens_used": result.get("usage", {}).get("total_tokens", 0),
            }

        except Exception as e:
            self.logger.error(f"Evidence investigation error: {e}")
            return {"error": str(e)}

    async def copilot_query(
        self,
        query: str,
        case_context: Optional[Dict[str, Any]] = None,
    ) -> Dict[str, Any]:
        """
        AI Copilot for investigator queries

        Args:
            query: Investigator question
            case_context: Optional case information

        Returns:
            Copilot response
        """
        try:
            context_text = ""
            if case_context:
                context_text = f"\n\nCase Context:\n{json.dumps(case_context, indent=2)}"

            prompt = f"""You are an expert forensic investigation AI copilot. 
Provide concise, actionable guidance for law enforcement investigations.

Investigator Query: {query}{context_text}

Please provide:
1. Direct answer to the query
2. Key considerations
3. Recommended investigative steps
4. Potential leads or patterns to explore
5. Risk factors to monitor"""

            payload = {
                "model": self.MODELS["reasoning"],
                "messages": [
                    {
                        "role": "user",
                        "content": prompt,
                    }
                ],
                "temperature": 0.6,
                "max_tokens": 1200,
            }

            response = httpx.post(
                f"{self.BASE_URL}/chat/completions",
                json=payload,
                headers=self.client.headers,
                timeout=30.0,
            )

            if response.status_code != 200:
                self.logger.error(f"Groq API error: {response.text}")
                return {"error": response.text}

            result = response.json()
            response_text = result["choices"][0]["message"]["content"]

            return {
                "success": True,
                "query": query,
                "response": response_text,
                "model": self.MODELS["reasoning"],
                "tokens_used": result.get("usage", {}).get("total_tokens", 0),
            }

        except Exception as e:
            self.logger.error(f"Copilot query error: {e}")
            return {"error": str(e)}

    async def generate_report(
        self,
        case_summary: str,
        findings: List[str],
        suspects: List[Dict[str, Any]],
    ) -> Dict[str, Any]:
        """
        Generate comprehensive investigation report

        Args:
            case_summary: Summary of the case
            findings: List of key findings
            suspects: List of suspect information

        Returns:
            Generated report
        """
        try:
            findings_text = "\n".join([f"- {f}" for f in findings])
            suspects_text = "\n".join(
                [f"- {s.get('label')}: {s.get('description', 'No description')}" 
                 for s in suspects]
            )

            prompt = f"""Generate a professional forensic investigation report:

Case Summary:
{case_summary}

Key Findings:
{findings_text}

Suspects of Interest:
{suspects_text}

Please format the report with:
1. Executive Summary
2. Investigation Timeline
3. Key Evidence
4. Suspects Profile
5. Investigative Conclusions
6. Recommended Actions
7. Risk Assessment

Make it professional, concise, and suitable for law enforcement use."""

            payload = {
                "model": self.MODELS["reasoning"],
                "messages": [
                    {
                        "role": "user",
                        "content": prompt,
                    }
                ],
                "temperature": 0.5,
                "max_tokens": 2000,
            }

            response = httpx.post(
                f"{self.BASE_URL}/chat/completions",
                json=payload,
                headers=self.client.headers,
                timeout=30.0,
            )

            if response.status_code != 200:
                self.logger.error(f"Groq API error: {response.text}")
                return {"error": response.text}

            result = response.json()
            report_text = result["choices"][0]["message"]["content"]

            return {
                "success": True,
                "report": report_text,
                "model": self.MODELS["reasoning"],
                "tokens_used": result.get("usage", {}).get("total_tokens", 0),
            }

        except Exception as e:
            self.logger.error(f"Report generation error: {e}")
            return {"error": str(e)}

    # Private prompt methods
    def _get_forensic_prompt(self) -> str:
        return """Analyze this forensic image for investigative purposes. Identify:
1. All persons present and their descriptions
2. Weapons or dangerous items
3. Evidence of crime (damage, theft, etc.)
4. Environmental context and location clues
5. Suspicious behavior or interactions
6. Timeline indicators
7. Potential witnesses or bystanders

Provide detailed observations suitable for law enforcement investigation."""

    def _get_suspect_prompt(self) -> str:
        return """Analyze this image for suspect identification. Focus on:
1. Physical appearance and distinctive features
2. Clothing and accessories
3. Gait and posture
4. Behavioral indicators
5. Tattoos or identifying marks
6. Age estimation
7. Confidence level for identification

Provide data suitable for suspect database matching."""

    def _get_weapon_prompt(self) -> str:
        return """Analyze this image for weapon detection and characterization:
1. Type of weapon (if present)
2. Size and appearance
3. How it's being held/used
4. Threat level assessment
5. Concealment method (if any)
6. Ammunition indicators (if applicable)
7. Comparative analysis to known weapons

Prioritize public safety considerations."""

    def _get_scene_prompt(self) -> str:
        return """Analyze this scene for investigative context:
1. Location type and identifying features
2. Time indicators (lighting, shadows)
3. Evidence of disturbance or forced entry
4. Item placement and arrangement
5. Access points and escape routes
6. Environmental hazards or concerns
7. Potential fingerprint or DNA locations

Provide scene reconstruction insights."""

    def _get_evidence_prompt(self) -> str:
        return """Analyze this evidence item/location:
1. Physical description and condition
2. Potential evidence value for investigation
3. Chain of custody considerations
4. Contamination risks
5. Collection method recommendations
6. Comparison potential to known evidence
7. Evidentiary timeline indicators

Prioritize evidence preservation protocols."""

    def __del__(self):
        """Cleanup HTTP client"""
        if hasattr(self, "client"):
            self.client.close()
