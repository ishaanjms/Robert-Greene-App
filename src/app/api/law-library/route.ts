import {NextResponse} from 'next/server';
import {getLawLibraryGuidance} from '@/ai/flows/law-library-guidance';

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const response = await getLawLibraryGuidance(body);

    return NextResponse.json(response);
  } catch (error) {
    console.error('Law Library API failed:', error);

    return NextResponse.json(
      {
        answer: 'The law library could not process that request. Please try again in a moment.',
        sources: [],
      },
      {status: 500}
    );
  }
}
