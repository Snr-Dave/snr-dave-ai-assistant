import { NextResponse } from "next/server"

export async function GET() {
  const headers: HeadersInit = {
    Accept: "application/vnd.github+json",
    "X-GitHub-Api-Version": "2022-11-28",
  }

  if (process.env.GITHUB_TOKEN) {
    headers["Authorization"] = `Bearer ${process.env.GITHUB_TOKEN}`
  }

  const res = await fetch(
    "https://api.github.com/users/Snr-Dave/events/public?per_page=10",
    { headers, next: { revalidate: 60 } }
  )

  if (!res.ok) {
    return NextResponse.json({ error: "Failed to fetch GitHub events" }, { status: res.status })
  }

  const data = await res.json()
  return NextResponse.json(data)
}
