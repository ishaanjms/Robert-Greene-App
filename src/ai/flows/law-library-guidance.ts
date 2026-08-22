// src/ai/flows/law-library-guidance.ts

/**
 * @fileOverview A RAG-style chat flow grounded in the local Robert Greene markdown guides.
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
  question: z.string().describe('The user question or situation to analyze through the Greene Library.'),
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
  answer: z.string().describe('A concise answer grounded in retrieved Greene Library notes.'),
  sources: z.array(z.string()).describe('The retrieved guide sections used as reference.'),
});
export type LawLibraryGuidanceOutput = z.infer<typeof LawLibraryGuidanceOutputSchema>;

type LawSection = {
  id: string;
  book: string;
  title: string;
  subtitle: string;
  content: string;
  fields: {
    coreIdea: string;
    whenItApplies: string;
    signals: string;
    strategicAdvice: string;
    risks: string;
    examples: string;
  };
};

type SituationUnderstanding = {
  problem: string;
  emotionalState: string;
  underlyingBelief: string;
  objective: string;
  retrievalFocus: string;
};

type RetrievedSource = {
  title: string;
  subtitle: string;
  excerpt: string;
  confidence: number;
  evidence: string[];
};

const MARKDOWN_SOURCES = [
  {
    fileName: 'laws_of_human_nature_detailed_study_guide.md',
    book: 'The Laws of Human Nature',
    sectionPattern: /^# Law\s+(\d+)\s+—\s+(.+?)\n([\s\S]*?)(?=^# Law\s+\d+\s+—|^# Cross-Law Diagnostic Index|^# A Compact Analysis Template|^# Final Principle|(?![\s\S]))/gm,
    titlePrefix: 'Law',
    detailHeadingLevel: 2,
  },
  {
    fileName: 'the_33_strategies_of_war_detailed_study_guide.md',
    book: 'The 33 Strategies of War',
    sectionPattern: /^## Strategy\s+(\d+)\s+—\s+(.+?)\n([\s\S]*?)(?=^## Strategy\s+\d+\s+—|^# Part\s+|^# Quick Diagnostic Index|^# Five Meta-Principles|^# Reusable Strategic Situation Template|^# Final Note|(?![\s\S]))/gm,
    titlePrefix: 'Strategy',
    detailHeadingLevel: 3,
  },
];

const huggingFaceModelIds: Partial<Record<ChatbotModel, string>> = {
  'huggingface-openai-gpt-oss-120b': 'openai/gpt-oss-120b',
  'huggingface-deepseek-v4-pro': 'deepseek-ai/DeepSeek-V4-Pro',
  'huggingface-nvidia-nemotron-3-ultra-550b': 'nvidia/NVIDIA-Nemotron-3-Ultra-550B-A55B-NVFP4',
  'huggingface-meta-llama-3-1-405b-instruct': 'meta-llama/Llama-3.1-405B-Instruct',
};

let cachedSections: LawSection[] | null = null;

const escapeRegExp = (text: string) => text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

const extractSectionField = (body: string, headingLevel: number, heading: string) => {
  const hashes = '#'.repeat(headingLevel);
  const pattern = new RegExp(
    `^${hashes}\\s+${escapeRegExp(heading)}\\s*\\n([\\s\\S]*?)(?=^${hashes}\\s+|(?![\\s\\S]))`,
    'im'
  );

  return body.match(pattern)?.[1]?.trim() ?? '';
};

const buildFields = (body: string, headingLevel: number) => ({
  coreIdea: extractSectionField(body, headingLevel, 'Core Idea'),
  whenItApplies: extractSectionField(body, headingLevel, 'When It Applies'),
  signals: extractSectionField(body, headingLevel, 'Signals') || extractSectionField(body, headingLevel, 'Signals / Problem Pattern'),
  strategicAdvice: extractSectionField(body, headingLevel, 'Strategic Advice'),
  risks: extractSectionField(body, headingLevel, 'Risks / Misreadings') || extractSectionField(body, headingLevel, 'Risks / Reversal'),
  examples: extractSectionField(body, headingLevel, 'Example User Situations'),
});

const readLawSections = () => {
  if (cachedSections) return cachedSections;

  cachedSections = MARKDOWN_SOURCES.flatMap(source => {
    const filePath = path.join(process.cwd(), source.fileName);
    if (!fs.existsSync(filePath)) return [];

    const markdown = fs.readFileSync(filePath, 'utf8');
    const matches = Array.from(markdown.matchAll(source.sectionPattern));

    return matches.map(match => {
      const sectionNumber = match[1];
      const title = `${source.book}: ${source.titlePrefix} ${sectionNumber} — ${match[2].trim()}`;
      const body = match[3].trim();
      const subtitle = body.match(/^\*\*(.+?)\*\*/m)?.[1]?.trim() ?? '';

      return {
        id: `${source.titlePrefix.toLowerCase()}-${sectionNumber}`,
        book: source.book,
        title,
        subtitle,
        content: body,
        fields: buildFields(body, source.detailHeadingLevel),
      };
    });
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

const fieldWeights = {
  whenItApplies: 3.25,
  signals: 3.25,
  coreIdea: 1.75,
  examples: 1.35,
  risks: 1.1,
  strategicAdvice: 0.9,
  title: 0.15,
};

const STRONG_CONFIDENCE_THRESHOLD = 0.65;
const SECONDARY_CONFIDENCE_THRESHOLD = 0.45;

const keywordsFor = (text: string) =>
  normalize(text)
    .split(' ')
    .filter(word => word.length > 2 && !stopWords.has(word))
    .map(word => {
      if (word.endsWith('ing') && word.length > 5) return word.slice(0, -3);
      if (word.endsWith('ed') && word.length > 4) return word.slice(0, -2);
      if (word.endsWith('s') && word.length > 4) return word.slice(0, -1);
      return word;
    });

const matchAny = (text: string, patterns: RegExp[]) => patterns.some(pattern => pattern.test(text));

const compactSentence = (text: string, fallback: string) => {
  const cleaned = text.replace(/\s+/g, ' ').trim();
  if (!cleaned) return fallback;
  return cleaned.length > 170 ? `${cleaned.slice(0, 167).trim()}...` : cleaned;
};

const analyzeSituation = (question: string): SituationUnderstanding => {
  const normalized = normalize(question);
  const clauses = question
    .split(/[.!?\n]+/)
    .map(clause => clause.trim())
    .filter(Boolean);

  const emotionalWords = [
    'sad', 'lonely', 'depressing', 'depressed', 'hurt', 'rejected', 'angry', 'afraid', 'scared',
    'anxious', 'worried', 'confused', 'lost', 'stuck', 'ashamed', 'jealous', 'humiliated',
  ];
  const emotionalState = emotionalWords.filter(word => normalized.includes(word)).join(', ');
  const beliefClause =
    clauses.find(clause => /\b(i can'?t|i cannot|i never|always|nothing|everything|no one|nobody|everyone)\b/i.test(clause)) ?? '';
  const objectiveClause =
    clauses.find(clause => /\b(what should|what do i|how do i|need to|want to|trying to|figure out|understand|respond|move on|feel better)\b/i.test(clause)) ?? '';
  const problemClause =
    clauses.find(clause => !/\b(sad|lonely|depress|i can'?t|i cannot|i never|everything|nothing)\b/i.test(clause)) ??
    clauses[0] ??
    question;

  const inferredConcepts: string[] = [];

  if (matchAny(normalized, [/\b(sad|lonely|depress|hurt|rejected|rejection|abandon|alone)\b/])) {
    inferredConcepts.push(
      'emotional distortion',
      'inflamed emotion',
      'broad conclusion from pain',
      'rejection',
      'depressive attitude',
      'setback defining identity'
    );
  }

  if (matchAny(normalized, [/\b(i can'?t|i cannot|i never|everything seems|nothing works|no one|nobody)\b/])) {
    inferredConcepts.push(
      'fixed belief',
      'self sabotage',
      'generalized conclusion',
      'negative expectation',
      'withdraw and interpret lack of connection as proof'
    );
  }

  if (matchAny(normalized, [/\b(stopped talking|distant|unavailable|ignored|ghosted|left on read|liked|crush)\b/])) {
    inferredConcepts.push(
      'unavailable person',
      'absence intensifies desire',
      'relationship ambiguity',
      'attachment to fantasy'
    );
  }

  if (matchAny(normalized, [/\b(manager|boss|coworker|colleague|team|office|work)\b/])) {
    inferredConcepts.push('workplace dynamic', 'status pressure', 'power relation', 'character pattern');
  }

  if (matchAny(normalized, [/\b(enemy|opponent|rival|conflict|fight|attack|defend|negotiate)\b/])) {
    inferredConcepts.push('conflict terrain', 'strategic position', 'opponent motive', 'defensive strategy');
  }

  return {
    problem: compactSentence(problemClause, question),
    emotionalState: emotionalState || 'not clearly stated',
    underlyingBelief: compactSentence(beliefClause, 'not clearly stated'),
    objective: compactSentence(objectiveClause, 'understand what is happening and choose the next move'),
    retrievalFocus: [
      problemClause,
      emotionalState,
      beliefClause,
      objectiveClause,
      inferredConcepts.join(' '),
    ].filter(Boolean).join(' '),
  };
};

const scoreText = (text: string, queryTerms: string[]) => {
  const normalizedText = normalize(text);
  if (!normalizedText || queryTerms.length === 0) return 0;

  const uniqueTerms = Array.from(new Set(queryTerms));
  const denominator = Math.min(uniqueTerms.length, 14);
  const matched = uniqueTerms.filter(term => normalizedText.includes(term)).length;

  return Math.min(1, matched / Math.max(denominator, 1));
};

const collectEvidence = (section: LawSection, queryTerms: string[]) => {
  const evidenceFields = [
    section.fields.whenItApplies,
    section.fields.signals,
    section.fields.coreIdea,
    section.fields.examples,
  ];

  return evidenceFields
    .flatMap(field => field.split('\n'))
    .map(line => line.replace(/^[-*]\s*/, '').trim())
    .filter(line => line && queryTerms.some(term => normalize(line).includes(term)))
    .slice(0, 3);
};

const scoreSection = (section: LawSection, queryTerms: string[]) => {
  const weightedScore =
    scoreText(section.fields.whenItApplies, queryTerms) * fieldWeights.whenItApplies +
    scoreText(section.fields.signals, queryTerms) * fieldWeights.signals +
    scoreText(section.fields.coreIdea, queryTerms) * fieldWeights.coreIdea +
    scoreText(section.fields.examples, queryTerms) * fieldWeights.examples +
    scoreText(section.fields.risks, queryTerms) * fieldWeights.risks +
    scoreText(section.fields.strategicAdvice, queryTerms) * fieldWeights.strategicAdvice +
    scoreText(`${section.title} ${section.subtitle}`, queryTerms) * fieldWeights.title;

  const maxScore = Object.values(fieldWeights).reduce((total, weight) => total + weight, 0);
  const confidence = Math.min(0.99, (weightedScore / maxScore) * 1.9);

  return {
    confidence,
    evidence: collectEvidence(section, queryTerms),
  };
};

const trimSection = (section: LawSection) => {
  const usefulLines = section.content
    .split('\n')
    .filter(line => {
      const trimmed = line.trim();
      return (
        trimmed &&
        !trimmed.startsWith('---') &&
        !/^#{2,3} Example User Situations/.test(trimmed) &&
        !/^#{2,3} Questions to Ask/.test(trimmed)
      );
    })
    .join('\n');

  return usefulLines.length > 3600 ? `${usefulLines.slice(0, 3600).trim()}...` : usefulLines;
};

const retrieveLawContext = (question: string, situation: SituationUnderstanding) => {
  const sections = readLawSections();
  const keywords = keywordsFor(situation.retrievalFocus);
  const ranked = sections
    .map(section => ({section, ...scoreSection(section, keywords)}))
    .sort((a, b) => b.confidence - a.confidence);

  const strongMatches = ranked.filter(item => item.confidence >= STRONG_CONFIDENCE_THRESHOLD);
  const selected = strongMatches.length
    ? [
        ...strongMatches.slice(0, 2),
        ...ranked.filter(item => item.confidence >= SECONDARY_CONFIDENCE_THRESHOLD && item.confidence < STRONG_CONFIDENCE_THRESHOLD).slice(0, 1),
      ]
    : ranked.slice(0, 2);

  return selected.map(({section, confidence, evidence}) => ({
    title: section.title,
    subtitle: section.subtitle,
    excerpt: trimSection(section),
    confidence,
    evidence,
  }));
};

const hasStrongGrounding = (sources: RetrievedSource[]) =>
  sources.some(source => source.confidence >= STRONG_CONFIDENCE_THRESHOLD);

const formatLawContext = (sources: RetrievedSource[]) =>
  sources
    .map(source => `Source: ${source.title}${source.subtitle ? ` (${source.subtitle})` : ''}
Retrieval confidence: ${source.confidence.toFixed(2)}
Evidence signals:
${source.evidence.length ? source.evidence.map(item => `- ${item}`).join('\n') : '- No direct evidence line captured; use cautiously.'}

${source.excerpt}`)
    .join('\n\n---\n\n');

const formatHistory = (history?: LawLibraryGuidanceInput['conversationHistory']) =>
  history?.length
    ? history
        .slice(-8)
        .map(message => `${message.sender === 'user' ? 'User' : 'Greene Library'}: ${message.text}`)
        .join('\n')
    : 'This is the beginning of the Greene Library conversation.';

const sanitizeAnswer = (answer: string, sources: string[]) => {
  const trimmed = answer.trim();
  if (!trimmed) {
    return `I found the strongest reference in ${sources[0] ?? 'the Greene Library'}, but the model returned an empty answer. Try asking again with one concrete scene.`;
  }

  return trimmed;
};

const buildSystemPrompt = (
  input: LawLibraryGuidanceInput,
  situation: SituationUnderstanding,
  lawContext: string,
  hasStrongMatch: boolean
) => `You are the Greene Library mode of Greene's Counsel.

You answer as a grounded RAG assistant. Use the supplied markdown study notes as your primary reference.

Conversation context:
${formatHistory(input.conversationHistory)}

Situation understanding:
- Problem: ${situation.problem}
- Emotional state: ${situation.emotionalState}
- Underlying belief: ${situation.underlyingBelief}
- Objective: ${situation.objective}

Retrieved law-library reference:
${lawContext}

Strong Greene match found: ${hasStrongMatch ? 'yes' : 'no'}

Rules:
- Ground the answer in the retrieved law notes. Do not pretend to have read material outside the supplied reference.
- If no strong Greene match was found, say you would not force a Greene framework and give humane general guidance.
- If a source is below strong confidence, mention it only as a possible secondary lens, not as the main doctrine.
- Run an internal grounding check before finalizing: every cited law or strategy must support the advice in the supplied source text.
- If the grounding check fails, revise the answer before returning it.
- Keep the answer practical and situation-aware.
- Do not make every sentence sound like Greene said it.
- Do not quote long passages. Paraphrase the notes.
- Respond to the human problem first, especially when the user expresses loneliness, sadness, fear, or distress.
- Start with a direct answer in 1-2 sentences.
- Use these headings: "### What Greene's Framework Suggests", "### What May Be Happening Here", and "### What You Could Do".
- End with one humane next move.
- Avoid generic intake questions when the user has already given enough context.`;

const getHuggingFaceLawGuidance = async (
  input: LawLibraryGuidanceInput,
  situation: SituationUnderstanding,
  lawContext: string,
  sources: string[],
  hasStrongMatch: boolean
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
          {role: 'system', content: buildSystemPrompt(input, situation, lawContext, hasStrongMatch)},
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
  const situation = analyzeSituation(parsedInput.question);
  const retrieved = retrieveLawContext(parsedInput.question, situation);
  const sources = retrieved.map(source => source.title);
  const stronglyGroundedSources = retrieved
    .filter(source => source.confidence >= STRONG_CONFIDENCE_THRESHOLD)
    .map(source => source.title);
  const lawContext = formatLawContext(retrieved);
  const hasStrongMatch = hasStrongGrounding(retrieved);

  if (parsedInput.model.startsWith('huggingface-')) {
    return getHuggingFaceLawGuidance(parsedInput, situation, lawContext, sources, hasStrongMatch);
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
      situationProblem: situation.problem,
      situationEmotionalState: situation.emotionalState,
      situationUnderlyingBelief: situation.underlyingBelief,
      situationObjective: situation.objective,
      lawContext,
      hasStrongMatch,
      sourceTitles: sources,
      stronglyGroundedSourceTitles: stronglyGroundedSources,
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
  situationProblem: z.string(),
  situationEmotionalState: z.string(),
  situationUnderlyingBelief: z.string(),
  situationObjective: z.string(),
  lawContext: z.string(),
  hasStrongMatch: z.boolean(),
  sourceTitles: z.array(z.string()),
  stronglyGroundedSourceTitles: z.array(z.string()),
  formattedHistory: z.string(),
});

const lawLibraryPrompt = ai.definePrompt({
  name: 'greeneLibraryPrompt',
  input: {schema: LawLibraryPromptInputSchema},
  output: {schema: LawLibraryGuidanceOutputSchema},
  prompt: `You are the Greene Library mode of Greene's Counsel.

You answer as a grounded RAG assistant. Use the supplied markdown study notes as your primary reference.

Conversation context:
{{{formattedHistory}}}

Situation understanding:
- Problem: {{{situationProblem}}}
- Emotional state: {{{situationEmotionalState}}}
- Underlying belief: {{{situationUnderlyingBelief}}}
- Objective: {{{situationObjective}}}

Retrieved law-library reference:
{{{lawContext}}}

Strong Greene match found: {{{hasStrongMatch}}}

User question:
{{{question}}}

Rules:
- Ground the answer in the retrieved law notes. Do not pretend to have read material outside the supplied reference.
- If no strong Greene match was found, say you would not force a Greene framework and give humane general guidance.
- If a source is below strong confidence, mention it only as a possible secondary lens, not as the main doctrine.
- Run an internal grounding check before finalizing: every cited law or strategy must support the advice in the supplied source text.
- If the grounding check fails, revise the answer before returning it.
- Keep the answer practical and situation-aware.
- Only cite these as strong sources:
{{#each stronglyGroundedSourceTitles}}
  - {{{this}}}
{{/each}}
- Do not make every sentence sound like Greene said it.
- Do not quote long passages. Paraphrase the notes.
- Respond to the human problem first, especially when the user expresses loneliness, sadness, fear, or distress.
- Start with a direct answer in 1-2 sentences.
- Use these headings exactly:
  - ### What Greene's Framework Suggests
  - ### What May Be Happening Here
  - ### What You Could Do
- End with one humane next move.
- Avoid generic intake questions when the user has already given enough context.

Return the answer and sources. Use these exact source titles:
{{#each sourceTitles}}
- {{{this}}}
{{/each}}`,
});
