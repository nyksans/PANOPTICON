import { NextResponse } from 'next/server';
import Groq from 'groq-sdk';

const groq = new Groq({
  apiKey: process.env.NEXT_PUBLIC_GROQ_API_KEY,
});

export async function POST(request: Request) {
  try {
    const { imageUrl } = await request.json();

    if (!imageUrl) {
      return NextResponse.json({ error: 'Image URL is required' }, { status: 400 });
    }

    const prompt = `
You are a highly advanced forensic AI assistant. Analyze the provided image and extract all relevant forensic data. 
Output your analysis STRICTLY in the following JSON format, with no markdown formatting, no code blocks, and no conversational text. Just the raw JSON object.

{
  "people": [
    {
      "description": "Short description of the person (e.g., 'Male, dark jacket, backpack')",
      "confidence": 85
    }
  ],
  "objects": [
    {
      "type": "vehicle | weapon | bag | electronics | other",
      "description": "Short description (e.g., 'Black sedan', 'Red backpack')",
      "confidence": 92
    }
  ],
  "locationContext": "Short description of the scene (e.g., 'Street intersection', 'Indoor hallway')"
}

If you cannot detect any people or objects, return empty arrays.
`;

    const chatCompletion = await groq.chat.completions.create({
      messages: [
        {
          role: 'user',
          content: [
            { type: 'text', text: prompt },
            { type: 'image_url', image_url: { url: imageUrl } }
          ],
        },
      ],
      model: 'llama-3.2-11b-vision-preview',
      temperature: 0.1,
      max_tokens: 1024,
      response_format: { type: "json_object" }
    });

    const responseContent = chatCompletion.choices[0]?.message?.content;
    
    if (!responseContent) {
      throw new Error("No content received from Groq.");
    }

    // Try parsing the JSON
    const parsedData = JSON.parse(responseContent);

    return NextResponse.json(parsedData);

  } catch (error: any) {
    console.error('Vision Analysis Error:', error);
    return NextResponse.json({ error: error.message || 'Failed to analyze image' }, { status: 500 });
  }
}
