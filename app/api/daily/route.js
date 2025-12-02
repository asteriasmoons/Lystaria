// app/api/daily/route.js

export async function GET() {
  // For now, just return a simple message so we know it works
  return new Response("Asteria daily ritual API is alive ✨", {
    status: 200,
    headers: {
      "Content-Type": "text/plain",
    },
  });
}
