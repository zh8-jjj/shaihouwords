/**
 * AI Service to interact with the backend proxy for Gemini.
 * This keeps the API Key safe on the server.
 */

export async function generateAIContent(params: {
  prompt: string;
  systemInstruction?: string;
  jsonMode?: boolean;
}) {
  const response = await fetch("/api/ai/generate", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    credentials: "include",
    body: JSON.stringify(params),
  });

  if (!response.ok) {
    const errorData = await response.json();
    throw new Error(errorData.error || "Failed to generate AI content");
  }

  return await response.json();
}
