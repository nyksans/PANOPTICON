# Groq AI Integration Guide - PANOPTICON

## Overview

PANOPTICON integrates **Groq's high-performance AI models** for real-time forensic image analysis and investigative copilot support. This provides law enforcement with:

- 🚀 **Real-time Image Analysis** - Instant forensic insights
- 🤖 **AI Copilot** - Investigator decision support
- 📊 **Automated Reporting** - Professional investigation reports
- 🔍 **Evidence Analysis** - Detailed forensic investigation

---

## Setup Instructions

### 1. Get Groq API Key

1. Visit [Groq Console](https://console.groq.com)
2. Sign up for account
3. Navigate to **API Keys**
4. Click **Create API Key**
5. Copy the key (format: `gsk_...`)

⚠️ **IMPORTANT**: Never share or hardcode your API key. Always use environment variables.

Example format (NEVER use real keys):
```
gsk_XXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX
```

### 2. Configure Environment Variables

**Backend (.env)**:
```bash
# Never hardcode! Use environment variables only
GROQ_API_KEY=YOUR_GROQ_API_KEY_HERE
```

**Frontend (.env.local)**:
```bash
# Frontend can optionally access Groq (for client-side analysis)
NEXT_PUBLIC_GROQ_API_KEY=YOUR_GROQ_API_KEY_HERE
```

### 3. Install Dependencies

#### Backend
```bash
cd backend
pip install groq
pip install python-httpx
```

#### Frontend
```bash
cd frontend
npm install
# Already included in dependencies
```

### 4. Verify Setup

```bash
# Test Groq connection
python -c "from ai.services.groq_ai_service import GroqAIService; service = GroqAIService(); print('✓ Groq service initialized')"
```

---

## Available Models

### Vision Model (Image Analysis)
- **Model**: `llama-2-90b-vision`
- **Use Case**: Forensic image analysis, suspect identification
- **Capabilities**:
  - Person detection and description
  - Weapon identification
  - Scene analysis
  - Evidence assessment
  - Behavior analysis

### Reasoning Model (Investigation)
- **Model**: `llama-3.1-405b`
- **Use Case**: Complex investigative reasoning, report generation
- **Capabilities**:
  - Multi-step reasoning
  - Case analysis
  - Pattern recognition
  - Recommendation generation
  - Report composition

### Text Model (Quick Analysis)
- **Model**: `mixtral-8x7b-32768`
- **Use Case**: Fast text-based queries
- **Capabilities**:
  - Quick summaries
  - Keyword extraction
  - Context understanding

---

## API Endpoints

### 1. Analyze Image

**Endpoint**: `POST /api/copilot/analyze-image`

**Parameters**:
```python
{
    "file": File,                    # Image file
    "analysis_type": str,            # forensic|suspect|weapon|scene|evidence
    "context": Optional[str]         # Additional context
}
```

**Analysis Types**:

#### Forensic Analysis
Comprehensive forensic scene analysis including:
- All persons present and descriptions
- Weapons or dangerous items
- Evidence of crime
- Environmental context
- Timeline indicators

#### Suspect Analysis
Detailed suspect identification:
- Physical appearance
- Distinctive features
- Clothing description
- Behavioral indicators
- Identification confidence

#### Weapon Analysis
Weapon detection and assessment:
- Weapon type
- Size and appearance
- Threat level
- Concealment method
- Ammunition indicators

#### Scene Analysis
Scene reconstruction and context:
- Location identification
- Time indicators
- Evidence of disturbance
- Access points
- Collection recommendations

#### Evidence Analysis
Individual evidence item assessment:
- Physical description
- Evidence value
- Chain of custody
- Contamination risks
- Collection method

**Example**:
```bash
curl -X POST http://localhost:8000/api/copilot/analyze-image \
  -F "file=@suspect.jpg" \
  -F "analysis_type=suspect" \
  -F "context=Male suspect in red hoodie, last seen near Main St"
```

**Response**:
```json
{
  "success": true,
  "analysis_type": "suspect",
  "analysis": "The image shows a male individual, approximately 25-35 years old, with...",
  "model": "llama-2-90b-vision",
  "tokens_used": 284
}
```

### 2. Investigate Evidence

**Endpoint**: `POST /api/copilot/investigate-evidence`

**Parameters**:
```python
{
    "evidence_description": str,      # Description of evidence
    "detections": Optional[List]      # Detections from vision models
}
```

**Response**:
```json
{
  "success": true,
  "analysis": {
    "observations": ["Key observation 1", "Key observation 2"],
    "patterns": ["Pattern 1", "Pattern 2"],
    "recommendations": ["Recommended action 1"],
    "risk_level": "high",
    "next_steps": ["Step 1", "Step 2"]
  },
  "model": "llama-3.1-405b",
  "tokens_used": 512
}
```

### 3. AI Copilot Query

**Endpoint**: `POST /api/copilot/copilot-query`

**Parameters**:
```python
{
    "query": str,                     # Investigator question
    "case_context": Optional[Dict]    # Case information
}
```

**Example Queries**:
- "What are the key indicators of a planned robbery?"
- "How would you connect these two suspects?"
- "What investigative steps should we take next?"
- "Analyze the timeline of events"

**Response**:
```json
{
  "success": true,
  "query": "What are key investigative next steps?",
  "response": "Based on the evidence, the recommended next steps are...",
  "model": "llama-3.1-405b",
  "tokens_used": 456
}
```

### 4. Generate Report

**Endpoint**: `POST /api/copilot/generate-report`

**Parameters**:
```python
{
    "case_summary": str,              # Case overview
    "findings": Optional[List[str]],  # Key findings
    "suspects": Optional[List[Dict]]  # Suspect profiles
}
```

**Response**:
```json
{
  "success": true,
  "report": "INVESTIGATION REPORT\n\nCase: #2024-001\n\n...",
  "model": "llama-3.1-405b",
  "tokens_used": 1824
}
```

### 5. Batch Analyze

**Endpoint**: `POST /api/copilot/batch-analyze`

Analyze multiple images at once

**Parameters**:
```python
{
    "files": List[File],              # Multiple image files
    "analysis_type": str              # Analysis type for all
}
```

---

## Frontend Integration

### Using AI Copilot Hook

```typescript
import { useAICopilot } from '@/hooks/useAICopilot'

export function InvestigationPanel() {
  const {
    loading,
    error,
    copilotQuery,
    analyzeImage,
    investigateEvidence,
    generateReport,
  } = useAICopilot()

  // Copilot query
  const handleQuery = async () => {
    const result = await copilotQuery(
      "What evidence should we prioritize?",
      { caseId: "2024-001", suspects: 3 }
    )
    if (result) {
      console.log("Copilot response:", result.response)
    }
  }

  // Analyze suspect image
  const handleAnalyzeImage = async (file: File) => {
    const result = await analyzeImage(
      file,
      "suspect",
      "Male, wearing red jacket"
    )
    if (result) {
      console.log("Analysis:", result.analysis)
    }
  }

  return (
    <div>
      <button onClick={handleQuery} disabled={loading}>
        {loading ? "Analyzing..." : "Get Next Steps"}
      </button>
      {error && <div className="error">{error}</div>}
    </div>
  )
}
```

---

## Best Practices

### 1. API Key Security
✅ **DO**:
- Store in `.env` files (git-ignored)
- Use environment variables
- Rotate keys regularly
- Restrict key permissions

❌ **DON'T**:
- Hardcode keys in source code
- Commit keys to version control
- Share keys in messages
- Use keys in frontend code

### 2. Image Optimization
✅ **DO**:
- Compress images before sending
- Use appropriate resolution (640-1920px)
- Include context information
- Specify analysis type

❌ **DON'T**:
- Send uncompressed RAW files
- Use extremely high resolutions
- Analyze irrelevant images
- Expect text-only images to work

### 3. Query Optimization
✅ **DO**:
- Be specific in queries
- Include relevant context
- Ask clear questions
- Provide case information

❌ **DON'T**:
- Ask vague questions
- Request medical/legal advice
- Use for non-forensic purposes
- Overload with irrelevant data

### 4. Rate Limiting
- Implement request throttling
- Cache results when possible
- Batch queries where appropriate
- Monitor API usage

---

## Use Cases

### 1. Real-Time Scene Analysis
```python
# Analyze crime scene photo instantly
result = await groq_service.analyze_image(
    image_source="scene.jpg",
    analysis_type="scene",
    context="Suspected robbery at convenience store"
)
# Get immediate investigative insights
```

### 2. Suspect Identification
```python
# Identify suspect characteristics
result = await groq_service.analyze_image(
    image_source="suspect.jpg",
    analysis_type="suspect"
)
# Use for database matching
```

### 3. Weapon Detection
```python
# Identify weapons in evidence
result = await groq_service.analyze_image(
    image_source="weapon.jpg",
    analysis_type="weapon"
)
# Assess threat level and weapon type
```

### 4. Cross-Reference Analysis
```python
# Analyze multiple pieces of evidence
results = await groq_service.batch_analyze(
    files=[photo1, photo2, photo3],
    analysis_type="forensic"
)
# Connect patterns across evidence
```

### 5. Report Generation
```python
# Generate professional report
report = await groq_service.generate_report(
    case_summary="Robbery at Main St Store",
    findings=["Suspect wore mask", "Vehicle was red sedan"],
    suspects=[{"label": "Subject-1", "description": "Male, 30s"}]
)
# Export for court proceedings
```

---

## Cost Optimization

### Token Usage
- Vision model: ~1 token per image pixel (depends on complexity)
- Reasoning model: ~200-500 tokens per query
- Batch operations: More efficient than individual requests

### Cost Reduction Strategies
1. **Image Compression**: Reduce file size before sending
2. **Batch Processing**: Group similar analyses
3. **Caching**: Store results for repeated queries
4. **Model Selection**: Use appropriate model tier
5. **Context Limiting**: Provide only essential context

### Pricing Estimate
- Average image analysis: 2-3 cents
- Average query: 1-2 cents
- Average report: 5-8 cents
- Batch savings: ~20-30%

---

## Troubleshooting

### Issue: "Groq API key not found"
**Solution**: 
```bash
# Check environment variable
echo $GROQ_API_KEY

# Set if missing
export GROQ_API_KEY=your_key_here
```

### Issue: "Rate limit exceeded"
**Solution**:
- Implement exponential backoff
- Cache results
- Batch requests
- Contact Groq for higher limits

### Issue: "Invalid image format"
**Solution**:
- Ensure file is JPEG, PNG, or WebP
- Compress if too large
- Check file not corrupted
- Specify correct analysis_type

### Issue: "Analysis timeout"
**Solution**:
- Increase timeout duration
- Send smaller batches
- Use simpler analysis type
- Check internet connection

---

## Monitoring

### Key Metrics
```python
# Monitor usage
metrics = {
    "total_requests": 0,
    "total_tokens": 0,
    "avg_response_time": 0,
    "error_rate": 0,
    "cost_estimate": 0
}
```

### Logging
```python
logger.info(f"Analysis complete: {tokens_used} tokens, {response_time}ms")
logger.error(f"API error: {error_message}")
logger.warning(f"High token usage: {total_tokens}")
```

---

## Support & Resources

- [Groq Documentation](https://docs.groq.com)
- [API Reference](https://console.groq.com/docs)
- [Python SDK](https://github.com/groq/groq-python)
- [Community Discord](https://discord.gg/groq)

---

**Last Updated**: 2026-07-07  
**Version**: 1.0.0  
**Status**: Production Ready
