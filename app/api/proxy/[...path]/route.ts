// app/api/proxy/[...path]/route.ts
import { NextRequest, NextResponse } from 'next/server';

const BACKEND_URL = 'http://91.135.156.173:8000';

export async function GET(
  request: NextRequest,
  context: { params: Promise<{ path: string[] }> }
) {
  const params = await context.params;
  const pathSegments = params.path || [];
  const apiPath = pathSegments.join('/');
  const searchParams = request.nextUrl.searchParams.toString();
  const url = `${BACKEND_URL}/api/${apiPath}${searchParams ? `?${searchParams}` : ''}`;

  console.log('[PROXY GET]', url);

  try {
    const backendResponse = await fetch(url, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
      },
    });

    const responseHeaders = new Headers(backendResponse.headers);
    responseHeaders.delete('transfer-encoding');
    responseHeaders.delete('content-encoding');

    // Явно передаём статус ответа от бэкенда
    return new NextResponse(backendResponse.body, {
      status: backendResponse.status,
      statusText: backendResponse.statusText,
      headers: responseHeaders,
    });
  } catch (error) {
    console.error('[PROXY ERROR]', error);
    return NextResponse.json(
      { error: 'Backend unreachable', details: String(error) },
      { status: 502 }
    );
  }
}

// app/api/proxy/[...path]/route.ts
export async function POST(
  request: NextRequest,
  context: { params: Promise<{ path: string[] }> }
) {
  const params = await context.params;
  const pathSegments = params.path || [];
  const apiPath = pathSegments.join('/');
  const url = `${BACKEND_URL}/api/${apiPath}`;

  console.log('[PROXY POST] Request to:', url);
  console.log('[PROXY POST] Request method:', request.method);
  console.log('[PROXY POST] Request headers:', Object.fromEntries(request.headers.entries()));

  try {
    const body = request.body ? await request.text() : undefined;

    const backendResponse = await fetch(url, {
      method: request.method, // Передаём метод из запроса
      headers: {
        'Content-Type': request.headers.get('Content-Type') || 'application/json',
        'Authorization': request.headers.get('Authorization') || '', // Если нужен авторизационный заголовок
      },
      body: body,
    });

    console.log('[PROXY POST] Backend response status:', backendResponse.status);

    const responseHeaders = new Headers(backendResponse.headers);
    responseHeaders.delete('transfer-encoding');
    responseHeaders.delete('content-encoding');

    return new NextResponse(backendResponse.body, {
      status: backendResponse.status,
      statusText: backendResponse.statusText,
      headers: responseHeaders,
    });
  } catch (error) {
    console.error('[PROXY ERROR]', error);
    return NextResponse.json(
      { error: 'Backend unreachable', details: String(error) },
      { status: 502 }
    );
  }
}


export const dynamic = 'force-dynamic';
