import { NextResponse } from "next/server"

/**
 * GitHub Project Engine
 *
 * Returns up to 100 repositories owned by the authenticated user, sorted by
 * most recent push first. Uses GITHUB_TOKEN from the environment (Replit
 * Secrets or .env via the in-app Environment Manager) so private repos are
 * included for the owner of the token.
 */
export async function GET() {
  const token = process.env.GITHUB_TOKEN
  if (!token) {
    return NextResponse.json(
      { error: "GITHUB_TOKEN is not set. Add it via Settings → Environment." },
      { status: 500 },
    )
  }

  const url = new URL("https://api.github.com/user/repos")
  url.searchParams.set("per_page",    "100")
  url.searchParams.set("sort",        "pushed")
  url.searchParams.set("direction",   "desc")
  url.searchParams.set("affiliation", "owner")

  const res = await fetch(url, {
    headers: {
      Accept:                 "application/vnd.github+json",
      "X-GitHub-Api-Version": "2022-11-28",
      Authorization:          `Bearer ${token}`,
      "User-Agent":           "snr-dave-command-center",
    },
    // Always go to GitHub on each call — the UI's Refresh button must be authoritative
    cache: "no-store",
  })

  if (!res.ok) {
    const detail = await res.text().catch(() => "")
    return NextResponse.json(
      { error: "Failed to fetch GitHub repos", status: res.status, detail: detail.slice(0, 500) },
      { status: res.status },
    )
  }

  const data = await res.json()
  return NextResponse.json(data, {
    headers: { "Cache-Control": "no-store" },
  })
}
