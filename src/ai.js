export async function identifyLegoParts(base64Image, mimeType, partsData) {
  const apiKey = import.meta.env.VITE_GEMINI_API_KEY;
  if (!apiKey) {
    throw new Error("Missing VITE_GEMINI_API_KEY in .env");
  }

  const catalogContext = partsData.map(p =>
    `ID:${p.part_id}|Part:${p.part_number}|Color:${p.color}|Desc:${p.description}`
  ).join('\n');

  const prompt = `You are a master LEGO builder and sorter. Your job is to analyze the provided image (which could be a real photo or a crop of a LEGO instruction manual).
Identify the LEGO parts present in the image based on shape and color.
You MUST strictly match the parts you see to the provided inventory catalog below. Do not hallucinate parts or colors that don't exist in the catalog.

Here is the exact available inventory catalog:
${catalogContext}

Return your result ONLY as a raw, valid JSON array of objects. Do not include markdown formatting like \`\`\`json. Every object must contain the exact 'ID' matching an item in the catalog.
Example output format:
[
  {"id": "uid_of_matched_part", "qty": 2, "confidence": "high", "reasoning": "Identified by the 2x4 stud shape and bright blue color matching catalog ID xyz."}
]`;

  const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-3.1-pro-preview:generateContent?key=${apiKey}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      contents: [
        {
          role: 'user',
          parts: [
            { text: prompt },
            { inlineData: { data: base64Image, mimeType: mimeType } }
          ]
        }
      ],
      generationConfig: {
        temperature: 0.2, // Low temperature for factual matching
      }
    })
  });

  if (!response.ok) {
    const err = await response.json();
    throw new Error(err.error?.message || 'Failed to fetch from Gemini API');
  }

  const data = await response.json();
  const textResponse = data.candidates?.[0]?.content?.parts?.[0]?.text;
  if (!textResponse) throw new Error('Invalid response from Gemini');
  
  const cleanJson = textResponse.replace(/```json/gi, '').replace(/```/g, '').trim();
  
  try {
    return JSON.parse(cleanJson);
  } catch (e) {
    console.error("Failed to parse Gemini JSON:", cleanJson);
    throw new Error('Gemini returned an invalid JSON block.');
  }
}
