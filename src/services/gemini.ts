import { GoogleGenerativeAI } from "@google/generative-ai";
import dotenv from "dotenv";

dotenv.config();

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || "");
const model = genAI.getGenerativeModel({ model: "gemini-3-flash-preview" });

export const generateContent = async (prompt: string, level?: string, temperature: number = 1.0): Promise<string> => {
    try {
        const levelPrompt = level ? `\n\nIMPORTANT: Generate content appropriate for ${level} grade students in terms of vocabulary, sentence complexity, and topic difficulty.` : '';
        const fullPrompt = prompt + levelPrompt;

        // Configure model with temperature for creativity control
        // Temperature range: 0.0 (deterministic) to 2.0 (very creative)
        const result = await model.generateContent({
            contents: [{ role: 'user', parts: [{ text: fullPrompt }] }],
            generationConfig: {
                temperature: temperature,
                topK: 40,
                topP: 0.95,
            }
        });

        const response = await result.response;
        return response.text();
    } catch (error) {
        console.error("Error generating content:", error);
        throw new Error("Failed to generate content");
    }
};

export const generateJSON = async (prompt: string, level?: string, temperature: number = 1.0): Promise<any> => {
    try {
        const levelPrompt = level ? `\n\nIMPORTANT: Generate content appropriate for ${level} grade students in terms of vocabulary, sentence complexity, and topic difficulty.` : '';
        const jsonPrompt = `${prompt}${levelPrompt}
    
    IMPORTANT: Return ONLY valid JSON output. Do not include markdown code blocks (like \`\`\`json).`;

        const result = await model.generateContent({
            contents: [{ role: 'user', parts: [{ text: jsonPrompt }] }],
            generationConfig: {
                temperature: temperature,
                topK: 40,
                topP: 0.95,
            }
        });

        const text = result.response.text();
        // Clean up potential markdown code blocks
        const cleanText = text.replace(/```json/g, "").replace(/```/g, "").trim();
        return JSON.parse(cleanText);
    } catch (error) {
        console.error("Error generating JSON:", error);
        throw new Error("Failed to generate JSON");
    }
}
