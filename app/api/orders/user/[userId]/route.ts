// app/api/orders/user/[userId]/route.ts
import { NextRequest, NextResponse } from 'next/server';

const BACKEND_URL = 'http://91.135.156.173:8000';

export async function GET(
  request: NextRequest,
  context: { params: Promise<{ userId: string }> }
) {
  const params = await context.params;
  const userId = params.userId;
  const url = `${BACKEND_URL}/api/orders/user/${userId}`;

  console.log('[PROXY GET]', url);

  try {
    const backendResponse = await fetch(url, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
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