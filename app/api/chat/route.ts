import { streamText, convertToModelMessages } from "ai"

export async function POST(req: Request) {
  try {
    const { messages } = await req.json()
    
    console.log("[v0] Chat API called with", messages.length, "messages")

    const result = streamText({
      model: "google/gemini-2.5-flash",
      system: `You are Snr-Dave's personal AI assistant, embedded in a Command Center dashboard. 
You help with coding questions, project management, and general tasks.
Be concise, technical when needed, and friendly. Use markdown formatting when helpful.
You have knowledge of the user's projects and can help with development tasks.`,
      messages: await convertToModelMessages(messages),
    })

    console.log("[v0] Stream created successfully")
    return result.toUIMessageStreamResponse()
  } catch (error) {
    console.error("[v0] Chat API error:", error)
    return new Response(
      JSON.stringify({ error: "Failed to process chat request" }),
      { status: 500, headers: { "Content-Type": "application/json" } }
    )
  }
}

// Health check endpoint for system status
export async function GET() {
  try {
    console.log("[v0] Chat API health check")
    return new Response(
      JSON.stringify({ status: "ok", model: "google/gemini-2.5-flash" }),
      { status: 200, headers: { "Content-Type": "application/json" } }
    )
  } catch (error) {
    console.error("[v0] Health check error:", error)
    return new Response(
      JSON.stringify({ status: "error" }),
      { status: 500, headers: { "Content-Type": "application/json" } }
    )
  }
}
