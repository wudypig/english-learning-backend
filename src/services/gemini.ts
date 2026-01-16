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
    } catch (error: any) {
        console.error("Error generating content:", error);

        // Check for specific error types and provide helpful messages
        const errorMessage = error?.message || error?.toString() || "";

        // Rate limit / quota errors
        if (errorMessage.includes("RESOURCE_EXHAUSTED") ||
            errorMessage.includes("quota") ||
            errorMessage.includes("rate limit") ||
            errorMessage.toLowerCase().includes("too many requests")) {
            throw new Error("API_RATE_LIMIT: Too many content generation requests. Please try again in a few minutes.");
        }

        // Permission/auth errors
        if (errorMessage.includes("PERMISSION_DENIED") || errorMessage.includes("API key")) {
            throw new Error("API_AUTH_ERROR: There is an authentication issue with the API key.");
        }

        // Model errors
        if (errorMessage.includes("INVALID_ARGUMENT")) {
            throw new Error("API_INVALID_REQUEST: The request format was invalid.");
        }

        // Generic error with original message if available
        throw new Error(`Failed to generate content: ${errorMessage || "Unknown error"}`);
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
    } catch (error: any) {
        console.error("Error generating JSON:", error);

        // Check for specific error types and provide helpful messages
        const errorMessage = error?.message || error?.toString() || "";

        // Rate limit / quota errors
        if (errorMessage.includes("RESOURCE_EXHAUSTED") ||
            errorMessage.includes("quota") ||
            errorMessage.includes("rate limit") ||
            errorMessage.toLowerCase().includes("too many requests")) {
            throw new Error("API_RATE_LIMIT: Too many content generation requests. Please try again in a few minutes.");
        }

        // Permission/auth errors
        if (errorMessage.includes("PERMISSION_DENIED") || errorMessage.includes("API key")) {
            throw new Error("API_AUTH_ERROR: There is an authentication issue with the API key.");
        }

        // Model errors
        if (errorMessage.includes("INVALID_ARGUMENT")) {
            throw new Error("API_INVALID_REQUEST: The request format was invalid.");
        }

        // JSON parsing errors
        if (error instanceof SyntaxError) {
            throw new Error("Failed to parse JSON response from API");
        }

        // Generic error with original message if available
        throw new Error(`Failed to generate JSON: ${errorMessage || "Unknown error"}`);
    }
}
