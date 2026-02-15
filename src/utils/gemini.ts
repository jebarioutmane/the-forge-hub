import { GoogleGenerativeAI } from "@google/generative-ai";

const genAI = new GoogleGenerativeAI(import.meta.env.VITE_GEMINI_API_KEY || "");

const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });

export async function generateChecklist(taskDescription: string): Promise<string> {
  const prompt = `Convert the following task description into a clear, actionable Markdown checklist with bullet points. Only return the checklist, no extra commentary.\n\nTask: ${taskDescription}`;
  const result = await model.generateContent(prompt);
  return result.response.text();
}

export async function draftFollowUpEmail(
  contractTitle: string,
  stakeholder: string,
  status: string
): Promise<string> {
  const prompt = `Write a polite, professional follow-up email regarding the contract titled "${contractTitle}" with stakeholder "${stakeholder}". The current contract status is "${status}". Keep it concise and action-oriented. Return only the email body.`;
  const result = await model.generateContent(prompt);
  return result.response.text();
}
