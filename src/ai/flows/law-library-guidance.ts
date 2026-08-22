// src/ai/flows/law-library-guidance.ts
'use server';

/**
 * @fileOverview A RAG-style chat flow grounded in the local Laws of Human Nature markdown guide.
 */

import fs from 'fs';
import path from 'path';
import {ai} from '@/ai/genkit';
import {z} from 'genkit';
import type {ChatbotModel} from '@/components/chatbot/Chatbot';

const MessageSchema = z.object({
  id: z.string(),
  text: z.string(),
  sender: z.enum(['user', 'bot']),
  isUser: z.boolean().optional(),
  isBot: z.boolean().optional(),
});

const LawLibraryGuidanceInputSchema = z.object({
  question: z.string().describe('The user question or situation to analyze through the law library.'),
  model: z.enum([
    'gemini-3.6-flash',
    'huggingface-openai-gpt-oss-120b',
    'huggingface-deepseek-v4-pro',
    'huggingface-nvidia-nemotron-3-ultra-550b',
    'huggingface-meta-llama-3-1-405b-instruct',
  ]).default('gemini-3.6-flash'),
  conversationHistory: z.array(MessageSchema).optional(),
});
export type LawLibraryGuidanceInput = z.infer<typeof LawLibraryGuidanceInputSchema>;

const LawLibraryGuidanceOutputSchema = z.object({
  answer: z.string().describe('A concise answer grounded in retrieved law-library notes.'),
  sources: z.array(z.string()).describe('The law sections used as reference.'),
});
export type LawLibraryGuidanceOutput = z.infer<typeof LawLibraryGuidanceOutputSchema>;

type LawSection = {
  id: string;
  title: string;
  subtitle: string;
  content: string;
};

const MARKDOWN_FILE = path.join(process.cwd(), 'laws_of_human_nature_detailed_study_guide.md');

const huggingFaceModelIds: Partial<Record<ChatbotModel, string>> = {
  'huggingface-openai-gpt-oss-120b': 'openai/gpt-oss-120b',
  'huggingface-deepseek-v4-pro': 'deepseek-ai/DeepSeek-V4-Pro',
  'huggingface-nvidia-nemotron-3-ultra-550b': 'nvidia/NVIDIA-Nemotron-3-Ultra-550B-A55B-NVFP4',
  'huggingface-meta-llama-3-1-405b-instruct': 'meta-llama/Llama-3.1-405B-Instruct',
};

let cachedSections: LawSection[] | null = null;

const readLawSections = () => {
  if (cachedSections) return cachedSections;

  const markdown = fs.readFileSync(MARKDOWN_FILE, 'utf8');
  const matches = Array.from(markdown.matchAll(/^# Law\s+(\d+)\s+—\s+(.+?)\n([\s\S]*?)(?=^# Law\s+\d+\s+—|\s*$)/gm));

  cachedSections = matches.map(match => {
    const lawNumber = match[1];
    const title = `Law ${lawNumber} — ${match[2].trim()}`;
    const body = match[3].trim();
    const subtitle = body.match(/^\*\*(.+?)\*\*/m)?.[1]?.trim() ?? '';

    return {
      id: `law-${lawNumber}`,
      title,
      subtitle,
      content: body,
    };
  });

  return cachedSections;
};

const normalize = (text: string) =>
  text
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

const stopWords = new Set([
  'about', 'after', 'again', 'also', 'and', 'are', 'because', 'been', 'but', 'can', 'could', 'did',
  'does', 'for', 'from', 'had', 'has', 'have', 'her', 'him', 'his', 'how', 'into', 'like', 'me',
  'more', 'not', 'now', 'our', 'she', 'should', 'that', 'the', 'their', 'them', 'then', 'there',
  'they', 'this', 'trying', 'was', 'what', 'when', 'where', 'who', 'why', 'with', 'you', 'your',
]);

const keywordsFor = (text: string) =>
  normalize(text)
    .split(' ')
    .filter(word => word.length > 2 && !stopWords.has(word));

const scoreSection = (section: LawSection, keywords: string[]) => {
  const haystack = normalize(`${section.title} ${section.subtitle} ${section.content}`);
  const titleHaystack = normalize(`${section.title} ${section.subtitle}`);

  return keywords.reduce((score, keyword) => {
    if (titleHaystack.includes(keyword)) return score + 5;
    if (haystack.includes(keyword)) return score + 1;
    return score;
  }, 0);
};

const trimSection = (section: LawSection) => {
  const usefulLines = section.content
    .split('\n')
    .filter(line => {
      const trimmed = line.trim();
      return (
        trimmed &&
        !trimmed.startsWith('---') &&
        !/^## Example User Situations/.test(trimmed) &&
        !/^## Questions to Ask/.test(trimmed)
      );
    })
    .join('\n');

  return usefulLines.length > 3600 ? `${usefulLines.slice(0, 3600).trim()}...` : usefulLines;
};

const retrieveLawContext = (question: string) => {
  const sections = readLawSections();
  const keywords = keywordsFor(question);
  const ranked = sections
    .map(section => ({section, score: scoreSection(section, keywords)}))
    .sort((a, b) => b.score - a.score);

  const selected = ranked.some(item => item.score > 0)
    ? ranked.filter(item => item.score > 0).slice(0, 3)
    : ranked.slice(0, 2);

  return selected.map(({section}) => ({
    title: section.title,
    subtitle: section.subtitle,
    excerpt: trimSection(section),
  }));
};

const formatLawContext = (sources: ReturnType<typeof retrieveLawContext>) =>
  sources
    .map(source => `Source: ${source.title}${source.subtitle ? ` (${source.subtitle})` : ''}\n${source.excerpt}`)
    .join('\n\n---\n\n');

const formatHistory = (history?: LawLibraryGuidanceInput['conversationHistory']) =>
  history?.length
    ? history
        .slice(-8)
        .map(message => `${message.sender === 'user' ? 'User' : 'Law Library'}: ${message.text}`)
        .join('\n')
    : 'This is the beginning of the law-library conversation.';

const sanitizeAnswer = (answer: string, sources: string[]) => {
  const trimmed = answer.trim();
  if (!trimmed) {
    return `I found the strongest reference in ${sources[0] ?? 'the law library'}, but the model returned an empty answer. Try asking again with one concrete scene.`;
  }

  return trimmed;
};

const buildSystemPrompt = (input: LawLibraryGuidanceInput, lawContext: string) => `You are the Law Library mode of Greene's Counsel.

You answer as a grounded RAG assistant. Use the supplied markdown study notes as your primary reference.

Conversation context:
${formatHistory(input.conversationHistory)}

Retrieved law-library reference:
${lawContext}

Rules:
- Ground the answer in the retrieved law notes. Do not pretend to have read material outside the supplied reference.
- If the reference does not fully answer the question, say what is missing and ask one precise follow-up.
- Keep the answer practical and situation-aware.
- Mention the most relevant law names naturally.
- Do not quote long passages. Paraphrase the notes.
- Start with a direct answer in 1-2 sentences.
- Use 2-3 short markdown headings.
- End with one sharp question or next move, not both.
- Avoid generic intake questions when the user has already given enough context.`;

const getHuggingFaceLawGuidance = async (
  input: LawLibraryGuidanceInput,
  lawContext: string,
  sources: string[]
): Promise<LawLibraryGuidanceOutput> => {
  const modelId = huggingFaceModelIds[input.model as ChatbotModel];
  const token =
    process.env.HUGGINGFACE_API_KEY ||
    process.env.HUGGING_FACE_API_KEY ||
    process.env.HF_TOKEN;

  if (!modelId || !token) {
    return {
      answer: `I found relevant notes in ${sources.join(', ')}, but this Hugging Face model is not configured. Switch to Gemini or add your Hugging Face token.`,
      sources,
    };
  }

  try {
    const response = await fetch('https://router.huggingface.co/v1/chat/completions', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: modelId,
        messages: [
          {role: 'system', content: buildSystemPrompt(input, lawContext)},
          {role: 'user', content: input.question},
        ],
        temperature: 0.45,
        max_tokens: 1200,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('Hugging Face law-library request failed:', response.status, errorText);
      return {
        answer: `I found relevant notes in ${sources.join(', ')}, but the selected model failed to respond. Try again or switch models.`,
        sources,
      };
    }

    const data = await response.json();
    const rawAnswer = data?.choices?.[0]?.message?.content;

    return {
      answer: sanitizeAnswer(typeof rawAnswer === 'string' ? rawAnswer : '', sources),
      sources,
    };
  } catch (error) {
    console.error('Hugging Face law-library flow failed:', error);
    return {
      answer: `I found relevant notes in ${sources.join(', ')}, but could not reach Hugging Face. Try again or switch models.`,
      sources,
    };
  }
};

export async function getLawLibraryGuidance(input: LawLibraryGuidanceInput): Promise<LawLibraryGuidanceOutput> {
  const parsedInput = LawLibraryGuidanceInputSchema.parse(input);
  const retrieved = retrieveLawContext(parsedInput.question);
  const sources = retrieved.map(source => source.title);
  const lawContext = formatLawContext(retrieved);

  if (parsedInput.model.startsWith('huggingface-')) {
    return getHuggingFaceLawGuidance(parsedInput, lawContext, sources);
  }

  if (!process.env.GEMINI_API_KEY && !process.env.GOOGLE_API_KEY) {
    return {
      answer: `I found relevant notes in ${sources.join(', ')}, but Gemini is not configured. Add your Gemini API key and restart the app.`,
      sources,
    };
  }

  try {
    const {output} = await lawLibraryPrompt({
      ...parsedInput,
      lawContext,
      sourceTitles: sources,
      formattedHistory: formatHistory(parsedInput.conversationHistory),
    });

    return {
      answer: sanitizeAnswer(output?.answer ?? '', sources),
      sources,
    };
  } catch (error) {
    console.error('Gemini law-library flow failed:', error);
    return {
      answer: `I found relevant notes in ${sources.join(', ')}, but Gemini could not answer right now. Try again in a moment.`,
      sources,
    };
  }
}

const LawLibraryPromptInputSchema = LawLibraryGuidanceInputSchema.extend({
  lawContext: z.string(),
  sourceTitles: z.array(z.string()),
  formattedHistory: z.string(),
});

const lawLibraryPrompt = ai.definePrompt({
  name: 'lawLibraryPrompt',
  input: {schema: LawLibraryPromptInputSchema},
  output: {schema: LawLibraryGuidanceOutputSchema},
  prompt: `You are the Law Library mode of Greene's Counsel.

You answer as a grounded RAG assistant. Use the supplied markdown study notes as your primary reference.

Conversation context:
{{{formattedHistory}}}

Retrieved law-library reference:
{{{lawContext}}}

User question:
{{{question}}}

Rules:
- Ground the answer in the retrieved law notes. Do not pretend to have read material outside the supplied reference.
- If the reference does not fully answer the question, say what is missing and ask one precise follow-up.
- Keep the answer practical and situation-aware.
- Mention the most relevant law names naturally.
- Do not quote long passages. Paraphrase the notes.
- Start with a direct answer in 1-2 sentences.
- Use 2-3 short markdown headings.
- End with one sharp question or next move, not both.
- Avoid generic intake questions when the user has already given enough context.

Return the answer and sources. Use these exact source titles:
{{#each sourceTitles}}
- {{{this}}}
{{/each}}`,
});
