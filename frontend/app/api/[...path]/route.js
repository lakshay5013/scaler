function getBackendBaseUrl() {
  const value = (
    process.env.BACKEND_API_URL ||
    process.env.NEXT_PUBLIC_API_BASE_URL ||
    "http://localhost:4000"
  );

  return value.startsWith("http://") || value.startsWith("https://") ? value : `https://${value}`;
}

async function proxyRequest(request, context) {
  let backendBaseUrl;

  try {
    backendBaseUrl = getBackendBaseUrl().replace(/\/+$/, "");
  } catch {
    return Response.json(
      { message: "Backend API URL is missing or invalid" },
      { status: 500 },
    );
  }

  const pathSegments = context.params?.path || [];
  const pathname = Array.isArray(pathSegments) ? pathSegments.join("/") : String(pathSegments || "");
  const targetUrl = new URL(`${backendBaseUrl}/api/${pathname}${request.nextUrl.search}`);

  const headers = new Headers(request.headers);
  headers.delete("host");

  const init = {
    method: request.method,
    headers,
    redirect: "manual",
  };

  if (request.method !== "GET" && request.method !== "HEAD") {
    init.body = await request.text();
  }

  const backendResponse = await fetch(targetUrl, init);
  const responseHeaders = new Headers(backendResponse.headers);
  responseHeaders.delete("content-encoding");
  responseHeaders.delete("transfer-encoding");
  responseHeaders.delete("content-length");

  return new Response(backendResponse.body, {
    status: backendResponse.status,
    headers: responseHeaders,
  });
}

export async function GET(request, context) {
  return proxyRequest(request, context);
}

export async function POST(request, context) {
  return proxyRequest(request, context);
}

export async function PUT(request, context) {
  return proxyRequest(request, context);
}

export async function PATCH(request, context) {
  return proxyRequest(request, context);
}

export async function DELETE(request, context) {
  return proxyRequest(request, context);
}

export async function OPTIONS(request, context) {
  return proxyRequest(request, context);
}