import { GoogleGenAI, Type } from "@google/genai";
import { BoundingBox } from '../types';

// Initialize Gemini Client
const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

/**
 * Detects cookies in a tray image and returns bounding boxes.
 * Uses gemini-3-flash-preview for fast multimodal analysis.
 */
export const detectCookies = async (base64Image: string): Promise<BoundingBox[]> => {
  try {
    // Remove data URL prefix if present for the API call
    const cleanBase64 = base64Image.replace(/^data:image\/(png|jpeg|jpg|webp);base64,/, '');

    const response = await ai.models.generateContent({
      model: 'gemini-3-flash-preview',
      contents: {
        parts: [
          {
            inlineData: {
              mimeType: 'image/jpeg',
              data: cleanBase64
            }
          },
          {
            text: "Detect all individual cookies in this image. Return a list of bounding boxes for each distinct cookie. Each bounding box must be normalized coordinates (0-1000) in the format [ymin, xmin, ymax, xmax]. Do not miss any cookies."
          }
        ]
      },
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            boxes: {
              type: Type.ARRAY,
              items: {
                type: Type.ARRAY,
                items: { type: Type.NUMBER }, // [ymin, xmin, ymax, xmax]
                minItems: 4,
                maxItems: 4
              }
            }
          }
        }
      }
    });

    const json = JSON.parse(response.text || '{"boxes": []}');
    
    // Map the raw array to our BoundingBox interface
    // API returns [ymin, xmin, ymax, xmax]
    return json.boxes.map((box: number[]) => ({
      ymin: box[0],
      xmin: box[1],
      ymax: box[2],
      xmax: box[3]
    }));

  } catch (error) {
    console.error("Error detecting cookies:", error);
    return [];
  }
};