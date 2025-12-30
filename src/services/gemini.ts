import { GoogleGenerativeAI } from "@google/generative-ai";
import dotenv from "dotenv";

dotenv.config();

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || "");
const model = genAI.getGenerativeModel({ model: "gemini-3-flash-preview" });

export const generateContent = async (prompt: string, level?: string): Promise<string> => {
    try {
        const levelPrompt = level ? `\n\nIMPORTANT: Generate content appropriate for ${level} grade students in terms of vocabulary, sentence complexity, and topic difficulty.` : '';
        const fullPrompt = prompt + levelPrompt;

        const result = await model.generateContent(fullPrompt);
        const response = await result.response;
        return response.text();
    } catch (error) {
        console.error("Error generating content:", error);
        throw new Error("Failed to generate content");
    }
};

export const generateJSON = async (prompt: string, level?: string): Promise<any> => {
    try {
        const levelPrompt = level ? `\n\nIMPORTANT: Generate content appropriate for ${level} grade students in terms of vocabulary, sentence complexity, and topic difficulty.` : '';
        const jsonPrompt = `${prompt}${levelPrompt}
    
    IMPORTANT: Return ONLY valid JSON output. Do not include markdown code blocks (like \`\`\`json).`;

        const result = await model.generateContent(jsonPrompt);
        const text = result.response.text();
        // Clean up potential markdown code blocks
        const cleanText = text.replace(/```json/g, "").replace(/```/g, "").trim();
        return JSON.parse(cleanText);
    } catch (error) {
        console.error("Error generating JSON:", error);
        throw new Error("Failed to generate JSON");
    }
}
