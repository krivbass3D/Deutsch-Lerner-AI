
import { GoogleGenAI } from "@google/genai";
import { Lesson, Message } from "../types";

export class TutorAIService {
  private ai: GoogleGenAI;

  constructor() {
    this.ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
  }

  async getFeedback(
    userInput: string, 
    expectedAnswer: string, 
    context: string,
    history: Message[]
  ) {
    const chatHistory = history.map(m => ({
      role: m.role === 'tutor' ? 'model' : 'user',
      parts: [{ text: m.content }]
    }));

    const response = await this.ai.models.generateContent({
      model: "gemini-3-flash-preview",
      contents: [
        ...chatHistory.slice(-6), // Send last 6 messages for context
        { text: `
          CONTEXT: You are a professional German tutor. 
          STUDENT ANSWER: "${userInput}"
          OFFICIAL ANSWER KEY: "${expectedAnswer}"
          LESSON CONTEXT: ${context}
          
          TASK: 
          1. Verify if the student's answer is correct. 
          2. If there are synonyms or variations that are grammatically correct but differ from the answer key, acknowledge them as correct.
          3. If there is an error (especially with strong verbs, case, or word order), explain the rule briefly and clearly in Russian.
          4. If incorrect, ask the student to write the correct version.
          5. Keep the tone supportive and academic.
          6. Your response should be in Russian, except for German examples.
        `}
      ],
      config: {
        systemInstruction: "You are a professional German language tutor named 'DeutschLehrer AI'. You strictly follow the provided lesson materials. You explain grammar clearly, focusing on verb conjugations and noun cases."
      }
    });

    return response.text;
  }
}
