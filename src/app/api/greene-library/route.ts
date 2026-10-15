import {NextResponse} from 'next/server';
import {getLawLibraryGuidance} from '@/ai/flows/law-library-guidance';
import {getClientRequestKey, isRateLimited} from '@/lib/request-guard';

const MAX_REQUEST_BYTES = 32_000;

export async function POST(request: Request) {
  const rateLimit = isRateLimited(getClientRequestKey(request));
  if (rateLimit.limited) {
    return NextResponse.json(
      {error: 'Too many library requests. Please wait a moment and try again.'},
      {status: 429, headers: {'Retry-After': String(rateLimit.retryAfterSeconds)}}
    );
  }

  try {
    const contentLength = Number(request.headers.get('content-length') ?? '0');
    if (contentLength > MAX_REQUEST_BYTES) {
      return NextResponse.json({error: 'This library request is too large.'}, {status: 413});
    }

    const rawBody = await request.text();
    if (rawBody.length > MAX_REQUEST_BYTES) {
      return NextResponse.json({error: 'This library request is too large.'}, {status: 413});
    }

    let body: unknown;
    try {
      body = JSON.parse(rawBody);
    } catch {
      return NextResponse.json({error: 'The library request must be valid JSON.'}, {status: 400});
    }

    const response = await getLawLibraryGuidance(body);

    return NextResponse.json(response);
  } catch (error) {
    if (error instanceof Error && error.name === 'ZodError') {
      return NextResponse.json({error: 'The library request contains invalid or oversized fields.'}, {status: 400});
    }

    console.error('Greene Library API failed:', error);

    return NextResponse.json(
      {
        answer: 'The Greene Library could not process that request. Please try again in a moment.',
        sources: [],
      },
      {status: 500}
    );
  }
}
