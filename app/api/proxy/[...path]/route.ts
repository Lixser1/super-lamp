// app/api/proxy/[...path]/route.ts
import { NextRequest, NextResponse } from 'next/server';

const BACKEND_URL = 'http://91.135.156.173:8000';

export async function GET(request: NextRequest) {
  // Извлекаем путь после /api/proxy/
  const urlPath = request.nextUrl.pathname.replace('/api/proxy/', '');
  const url = `${BACKEND_URL}/${urlPath}?${request.nextUrl.searchParams}`;

  try {
    const backendResponse = await fetch(url, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
      },
    });

    // Прокидываем ответ напрямую (поток)
    const responseHeaders = new Headers(backendResponse.headers);
    responseHeaders.delete('transfer-encoding');
    responseHeaders.delete('content-encoding');

    return new NextResponse(backendResponse.body, {
      status: backendResponse.status,
      statusText: backendResponse.statusText,
      headers: responseHeaders,
    });
  } catch (error) {
    console.error('Proxy error:', error);
    return NextResponse.json(
      { error: 'Backend unreachable', details: String(error) },
      { status: 502 }
    );
  }
}

export async function POST(request: NextRequest) {
  // Извлекаем путь после /api/proxy/
  const urlPath = request.nextUrl.pathname.replace('/api/proxy/', '');
  const url = `${BACKEND_URL}/${urlPath}`;

  try {
    // Клонируем тело запроса
    const body = request.body ? await new Response(request.body).arrayBuffer() : undefined;

    const backendResponse = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': request.headers.get('Content-Type') || 'application/json',
      },
      body: body ? Buffer.from(body) : undefined,
    });

    // Прокидываем ответ напрямую (поток)
    const responseHeaders = new Headers(backendResponse.headers);
    responseHeaders.delete('transfer-encoding');
    responseHeaders.delete('content-encoding'); 

    return new NextResponse(backendResponse.body, {
      status: backendResponse.status,
      statusText: backendResponse.statusText,
      headers: responseHeaders,
    });
  } catch (error) {
    console.error('Proxy error:', error);
    return NextResponse.json(
      { error: 'Backend unreachable', details: String(error) },
      { status: 502 }
    );
  }
}

// Важно: явно указываем, что роут динамический
export const dynamic = 'force-dynamic';

// Опционально: разрешаем только POST (но это не обязательно)
export const POST_METHOD = 'POST';