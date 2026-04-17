import { streamText, convertToModelMessages } from "ai"

export async function POST(req: Request) {
  const { messages } = await req.json()

  const result = streamText({
    model: "google/gemini-2.5-flash",
    system: `You are Snr-Dave's personal AI assistant, embedded in a Command Center dashboard. 
You help with coding questions, project management, and general tasks.
Be concise, technical when needed, and friendly. Use markdown formatting when helpful.
You have knowledge of the user's projects including the AI Assistant dashboard, portfolio website, code analyzer, and task automation suite.`,
    messages: await convertToModelMessages(messages),
  })

  return result.toUIMessageStreamResponse()
}
