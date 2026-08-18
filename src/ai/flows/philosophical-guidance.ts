
// src/ai/flows/philosophical-guidance.ts
'use server';

/**
 * @fileOverview A philosophical guidance AI agent based on Robert Greene's teachings.
 *
 * - getPhilosophicalGuidance - A function that provides strategic guidance based on user input, preferred tone, desired depth, and conversation history.
 * - generateConversationTitleWithModel - A function that creates a concise chat title from the user's first real situation.
 * - PhilosophicalGuidanceInput - The input type for the getPhilosophicalGuidance function.
 * - PhilosophicalGuidanceOutput - The return type for the getPhilosophicalGuidance function.
 */

import {ai} from '@/ai/genkit';
import {z} from 'genkit';

// Define a schema for individual messages, consistent with the frontend Message interface
const MessageSchema = z.object({
  id: z.string(),
  text: z.string(),
  sender: z.enum(['user', 'bot']),
  isUser: z.boolean().optional().describe('True if the sender is the user. For template use.'),
  isBot: z.boolean().optional().describe('True if the sender is the bot. For template use.'),
});

const PhilosophicalGuidanceInputSchema = z.object({
  situation: z.string().describe('A detailed description of the user\'s current situation related to power dynamics, strategy, seduction, mastery, or human behavior.'),
  tone: z.enum(['classic', 'modern']).default('classic').describe('The desired tone of the response. "classic" for metaphor-rich, philosophical language, or "modern" for concise, straightforward guidance.'),
  depthMode: z.enum(['surface', 'philosophical', 'tactical']).default('philosophical').describe('The desired depth of the advice. "surface" for quick tips, "philosophical" for rich insights, or "tactical" for detailed plans.'),
  model: z.enum([
    'gemini-3.6-flash',
    'huggingface-openai-gpt-oss-120b',
    'huggingface-deepseek-v4-pro',
    'huggingface-nvidia-nemotron-3-ultra-550b',
    'huggingface-meta-llama-3-1-405b-instruct',
  ]).default('gemini-3.6-flash').describe('The model provider and model selected by the user.'),
  conversationHistory: z.array(MessageSchema).optional().describe('The ongoing dialogue history between the user and the chatbot. Used to maintain context and personalize responses.'),
});
export type PhilosophicalGuidanceInput = z.infer<typeof PhilosophicalGuidanceInputSchema>;

const PhilosophicalGuidanceOutputSchema = z.object({
  advice: z.string().describe('Tailored strategic guidance based on Robert Greene\'s teachings, incorporating historical anecdotes and aphorisms, delivered in the chosen tone and depth, and considering past conversation context.'),
});
export type PhilosophicalGuidanceOutput = z.infer<typeof PhilosophicalGuidanceOutputSchema>;

const ConversationTitleInputSchema = z.object({
  situation: z.string().describe('The first substantial user message in the conversation.'),
  fallbackTitle: z.string().describe('A locally generated fallback title to use if title generation fails.'),
  model: PhilosophicalGuidanceInputSchema.shape.model.optional().describe('The selected model. Hugging Face models are used directly; other models fall back to the default Hugging Face title model.'),
});
export type ConversationTitleInput = z.infer<typeof ConversationTitleInputSchema>;

const ConversationTitleOutputSchema = z.object({
  title: z.string().describe('A concise 2-5 word conversation title.'),
});
export type ConversationTitleOutput = z.infer<typeof ConversationTitleOutputSchema>;

const ClarifyingQuestionInputSchema = z.object({
  situation: PhilosophicalGuidanceInputSchema.shape.situation,
  model: PhilosophicalGuidanceInputSchema.shape.model,
  fallbackQuestion: z.string().describe('A safe local fallback question if model generation fails.'),
  conversationHistory: PhilosophicalGuidanceInputSchema.shape.conversationHistory,
});
type ClarifyingQuestionInput = z.infer<typeof ClarifyingQuestionInputSchema>;

const ClarifyingQuestionOutputSchema = z.object({
  question: z.string().describe('One concise, personalized follow-up question.'),
});
type ClarifyingQuestionOutput = z.infer<typeof ClarifyingQuestionOutputSchema>;

const huggingFaceModelIds: Partial<Record<PhilosophicalGuidanceInput['model'], string>> = {
  'huggingface-openai-gpt-oss-120b': 'openai/gpt-oss-120b',
  'huggingface-deepseek-v4-pro': 'deepseek-ai/DeepSeek-V4-Pro',
  'huggingface-nvidia-nemotron-3-ultra-550b': 'nvidia/NVIDIA-Nemotron-3-Ultra-550B-A55B-NVFP4',
  'huggingface-meta-llama-3-1-405b-instruct': 'meta-llama/Llama-3.1-405B-Instruct',
};
const DEFAULT_HUGGING_FACE_TITLE_MODEL_ID = 'openai/gpt-oss-120b';
const GREETING_RESPONSES = [
  'Let’s look at it clearly. What happened?',
  'Start with the moment that made you pause.',
  'What situation needs a second read?',
  'Tell me what changed, and who is part of it.',
  'What dynamic are you trying to understand?',
  'What are you trying to make sense of?',
  'Bring me the scene. What feels off?',
  'What decision, conflict, or behavior are we examining?',
  'What feels unclear: their motive, your move, or the stakes?',
  'Tell me the situation. I’ll help you find the pattern.',
  'What outcome are you trying to protect?',
  'What happened most recently?',
  'Where do you feel the pressure in this situation?',
  'What response are you unsure about?',
  'Who is involved, and what changed between you?',
];
const CLOSING_RESPONSES = [
  'Take care. Step back, observe clearly, and move only when the advantage is calm.',
  'Until next time. Let the dust settle before you decide what deserves your energy.',
  'Go carefully. A composed mind sees more than a wounded one.',
  'Take the pause with you. Clarity often arrives after the first impulse passes.',
  'Rest the matter for now. Return to it only when you can see the pattern cleanly.',
  'Move slowly. The strongest response is often the one chosen after silence.',
  'Leave the field calmly. Watch what people reveal when you stop reacting.',
  'Take care. Protect your peace, then protect your position.',
  'Step away for now. The next move should come from judgment, not pressure.',
  'Goodbye for now. Keep your eyes on the pattern, not just the provocation.',
];

const getLocalResponse = (responses: string[], seed: string) => {
  const charTotal = Array.from(seed).reduce((total, char) => total + char.charCodeAt(0), 0);
  return responses[charTotal % responses.length];
};

const getSocialIntentResponse = (message: string): PhilosophicalGuidanceOutput | null => {
  const normalized = message
    .toLowerCase()
    .replace(/[^\w\s']/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

  if (!normalized) return null;

  const words = normalized.split(' ');
  const hasOnlySocialLength = words.length <= 6;
  const isBriefGreeting =
    words.length <= 8 &&
    /\b(hi|hii|hiii|hello|helo|hey|heyy|heyyy|yo|sup|wassup|what's up|whats up|wsp|hiya|howdy|greetings|gm|good morning|good afternoon|good evening|evening|morning|namaste|namaskar|hola|bonjour|hello there|hey there|hi there)\b/.test(normalized);
  const isBriefClosing =
    words.length <= 10 &&
    /\b(bye|byee|goodbye|good bye|good night|goodnight|gn|later|talk later|talk to you later|see you|see ya|see u|cya|catch you|catch you later|that's all|thats all|that is all|all good|done|done for now|i'm done|im done|we're done|were done|no thanks|no thank you|nothing else|that's enough|thats enough|enough for now|stop here|let's stop|lets stop|end chat|end this|close this|peace|peace out)\b/.test(normalized);
  const isBriefThanks =
    hasOnlySocialLength &&
    /\b(thanks|thank you|thank u|thankyou|thx|ty|appreciate it|appreciated|got it|understood|makes sense|that helps|helped)\b/.test(normalized);

  if (
    isBriefGreeting ||
    (hasOnlySocialLength && /^(how are you|how r u|how are you doing|how's it going|hows it going|what's good|whats good)$/.test(normalized))
  ) {
    return {
      advice: getLocalResponse(GREETING_RESPONSES, normalized),
    };
  }

  if (isBriefClosing) {
    return {
      advice: getLocalResponse(CLOSING_RESPONSES, normalized),
    };
  }

  if (
    isBriefThanks ||
    (hasOnlySocialLength && /^(that helped|thanks a lot|thank you so much|got it thanks|ok thanks|okay thanks)$/.test(normalized))
  ) {
    return {
      advice: "You're welcome. Keep watching the pattern, not just the event.",
    };
  }

  if (
    words.length <= 7 &&
    /^(help|help me|can you help|can you help me|could you help|could you help me|i need help|need help)$/.test(normalized)
  ) {
    return {
      advice: "Yes. Tell me what happened, who's involved, and what you're trying to understand.",
    };
  }

  return null;
};

const CLARIFYING_RESPONSES = [
  "I'm here. What happened, who's involved, or what feels unclear?",
  "Yes. Tell me what happened, who's involved, and what you're trying to understand.",
  "What happened, who's involved, and what are you trying to understand?",
  'Is this about a person, a decision, or your own next move?',
  'What changed recently: their behavior, your last interaction, or the expectations between you?',
  'What changed recently at work: their behavior, your role, or the pressure around a decision?',
  'What are the options in front of you, and what outcome are you trying to protect?',
  'What triggered the conflict, and what response are you considering now?',
  'What feels most uncertain: their motive, your leverage, or your next move?',
];

const normalizeMessage = (message: string) =>
  message
    .toLowerCase()
    .replace(/[^\w\s']/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

const sanitizeConversationTitle = (title: string, fallbackTitle: string) => {
  const cleaned = title
    .replace(/^["'`]+|["'`]+$/g, '')
    .replace(/^title:\s*/i, '')
    .replace(/[.!?]+$/g, '')
    .replace(/\s+/g, ' ')
    .trim();

  if (!cleaned) return fallbackTitle;

  const words = cleaned.split(' ').filter(Boolean).slice(0, 5);
  const trimmed = words.join(' ');

  if (trimmed.length < 3 || trimmed.length > 42) return fallbackTitle;

  return trimmed;
};

const sanitizeClarifyingQuestion = (question: string, fallbackQuestion: string) => {
  const cleaned = question
    .replace(/^["'`]+|["'`]+$/g, '')
    .replace(/^(question|follow-up|clarifying question):\s*/i, '')
    .replace(/\s+/g, ' ')
    .trim();

  if (!cleaned) return fallbackQuestion;

  const firstQuestion = cleaned.match(/[^?]*\?/)?.[0]?.trim() ?? cleaned;
  const words = firstQuestion.split(' ').filter(Boolean);

  if (!firstQuestion.endsWith('?') || words.length < 4 || words.length > 24) {
    return fallbackQuestion;
  }

  return firstQuestion;
};

export async function generateConversationTitleWithModel(
  input: ConversationTitleInput
): Promise<ConversationTitleOutput> {
  const parsedInput = ConversationTitleInputSchema.parse(input);

  if (!parsedInput.model?.startsWith('huggingface-')) {
    if (!process.env.GEMINI_API_KEY && !process.env.GOOGLE_API_KEY) {
      return {title: parsedInput.fallbackTitle};
    }

    try {
      const {output} = await conversationTitlePrompt(parsedInput);
      return {
        title: sanitizeConversationTitle(output?.title ?? '', parsedInput.fallbackTitle),
      };
    } catch (error) {
      console.error('Gemini title generation failed:', error);
      return {title: parsedInput.fallbackTitle};
    }
  }

  const token =
    process.env.HUGGINGFACE_API_KEY ||
    process.env.HUGGING_FACE_API_KEY ||
    process.env.HF_TOKEN;

  if (!token) {
    return {title: parsedInput.fallbackTitle};
  }

  const modelId = huggingFaceModelIds[parsedInput.model] ?? DEFAULT_HUGGING_FACE_TITLE_MODEL_ID;

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
          {
            role: 'system',
            content:
              'Create a concise chat title for a strategic advice conversation. Return only the title. Use 2 to 5 words. No quotes, punctuation, labels, emojis, or full sentence. Capture the core issue instead of copying the user wording.',
          },
          {
            role: 'user',
            content: `User situation:\n${parsedInput.situation}`,
          },
        ],
        temperature: 0.2,
        max_tokens: 18,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('Hugging Face title request failed:', response.status, errorText);
      return {title: parsedInput.fallbackTitle};
    }

    const data = await response.json();
    const rawTitle = data?.choices?.[0]?.message?.content;

    if (typeof rawTitle !== 'string') {
      return {title: parsedInput.fallbackTitle};
    }

    return {
      title: sanitizeConversationTitle(rawTitle, parsedInput.fallbackTitle),
    };
  } catch (error) {
    console.error('Hugging Face title generation failed:', error);
    return {title: parsedInput.fallbackTitle};
  }
}

const generateHuggingFaceClarifyingQuestion = async (
  input: ClarifyingQuestionInput
): Promise<ClarifyingQuestionOutput> => {
  const token =
    process.env.HUGGINGFACE_API_KEY ||
    process.env.HUGGING_FACE_API_KEY ||
    process.env.HF_TOKEN;

  if (!token) {
    return {question: input.fallbackQuestion};
  }

  const modelId = huggingFaceModelIds[input.model];

  if (!modelId) {
    return {question: input.fallbackQuestion};
  }

  const history = input.conversationHistory?.length
    ? input.conversationHistory
        .slice(-6)
        .map(message => `${message.sender === 'user' ? 'User' : 'Robert Greene'}: ${message.text}`)
        .join('\n')
    : 'No prior context.';

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
          {
            role: 'system',
            content:
              'You write one concise clarifying question for a strategic advice chatbot. Ask for the single most important missing detail. Be specific to the user wording. Return only one question. No preface, bullets, headings, or advice. Maximum 18 words.',
          },
          {
            role: 'user',
            content: `Conversation context:\n${history}\n\nUser's thin prompt:\n${input.situation}\n\nLocal fallback question:\n${input.fallbackQuestion}`,
          },
        ],
        temperature: 0.35,
        max_tokens: 40,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('Hugging Face clarifying question failed:', response.status, errorText);
      return {question: input.fallbackQuestion};
    }

    const data = await response.json();
    const rawQuestion = data?.choices?.[0]?.message?.content;

    if (typeof rawQuestion !== 'string') {
      return {question: input.fallbackQuestion};
    }

    return {
      question: sanitizeClarifyingQuestion(rawQuestion, input.fallbackQuestion),
    };
  } catch (error) {
    console.error('Hugging Face clarifying question failed:', error);
    return {question: input.fallbackQuestion};
  }
};

const generateClarifyingQuestion = async (
  input: ClarifyingQuestionInput
): Promise<ClarifyingQuestionOutput> => {
  const parsedInput = ClarifyingQuestionInputSchema.parse(input);

  if (parsedInput.model.startsWith('huggingface-')) {
    return generateHuggingFaceClarifyingQuestion(parsedInput);
  }

  if (!process.env.GEMINI_API_KEY && !process.env.GOOGLE_API_KEY) {
    return {question: parsedInput.fallbackQuestion};
  }

  try {
    const {output} = await clarifyingQuestionPrompt(parsedInput);
    return {
      question: sanitizeClarifyingQuestion(output?.question ?? '', parsedInput.fallbackQuestion),
    };
  } catch (error) {
    console.error('Gemini clarifying question failed:', error);
    return {question: parsedInput.fallbackQuestion};
  }
};

const getPreviousBotMessage = (history?: PhilosophicalGuidanceInput['conversationHistory']) =>
  [...(history ?? [])]
    .reverse()
    .find(message => message.sender === 'bot');

const hasRecentlyAskedForContext = (history?: PhilosophicalGuidanceInput['conversationHistory']) => {
  const previousBotMessage = getPreviousBotMessage(history);

  return Boolean(
    previousBotMessage &&
      CLARIFYING_RESPONSES.some(response => previousBotMessage.text.trim() === response)
  );
};

const isAffirmingBotOffer = (
  normalized: string,
  history?: PhilosophicalGuidanceInput['conversationHistory']
) => {
  if (!/^(yes|yes i would|yes please|yeah|yep|sure|please|do it|go ahead|sounds good|ok|okay|alright|absolutely|i would like|yes i would like)$/.test(normalized)) {
    return false;
  }

  const previousBotMessage = getPreviousBotMessage(history);
  if (!previousBotMessage) return false;

  return /\b(would you like|do you want|want me to|should i|shall i|follow-up|tips on|help with|draft|frame|framing|outline|next)\b/i.test(previousBotMessage.text);
};

const getContextDepthScore = (normalized: string) => {
  let score = 0;

  if (/\b(boss|manager|friend|partner|girlfriend|boyfriend|wife|husband|ex|coworker|colleague|client|team|parent|family|he|she|they|we)\b/.test(normalized)) {
    score += 1;
  }

  if (/\b(said|told|asked|did|ignored|blocked|left|lied|fired|promoted|rejected|argued|fought|changed|happened|texted|called|met)\b/.test(normalized)) {
    score += 1;
  }

  if (/\b(want|need|trying|should|decide|choose|respond|protect|understand|figure|afraid|scared|worried|confused|unclear)\b/.test(normalized)) {
    score += 1;
  }

  if (/\b(after|because|when|but|however|although|while)\b/.test(normalized)) {
    score += 1;
  }

  return score;
};

const getClarifyingFallbackQuestion = (input: PhilosophicalGuidanceInput): string | null => {
  const normalized = normalizeMessage(input.situation);
  if (!normalized) return null;
  if (hasRecentlyAskedForContext(input.conversationHistory)) return null;
  if (isAffirmingBotOffer(normalized, input.conversationHistory)) return null;

  const words = normalized.split(' ');
  const contextScore = getContextDepthScore(normalized);
  const isVeryShort = words.length <= 5;
  const isThin = words.length <= 11 && contextScore < 2;
  const isGenericAsk = /^(what should i do|what do i do|i don't know what to do|idk what to do|i am confused|i'm confused|im confused|i feel lost|i'm lost|im lost|i am stuck|i'm stuck|im stuck|advise me|give me advice)$/.test(normalized);

  if (!isVeryShort && !isThin && !isGenericAsk) return null;

  if (/\b(boss|manager|coworker|colleague|client|team|work|job|office|career)\b/.test(normalized)) {
    return 'What changed recently at work: their behavior, your role, or the pressure around a decision?';
  }

  if (/\b(friend|partner|girlfriend|boyfriend|wife|husband|ex|dating|relationship|family)\b/.test(normalized)) {
    return 'What changed recently: their behavior, your last interaction, or the expectations between you?';
  }

  if (/\b(decision|choose|choice|option|options|decide|path)\b/.test(normalized)) {
    return 'What are the options in front of you, and what outcome are you trying to protect?';
  }

  if (/\b(conflict|fight|argument|tension|angry|mad|upset)\b/.test(normalized)) {
    return 'What triggered the conflict, and what response are you considering now?';
  }

  if (/\b(confused|unclear|lost|stuck|unsure|overthinking)\b/.test(normalized)) {
    return 'Is this about a person, a decision, or your own next move?';
  }

  if (/\b(weird|distant|cold|different|changed)\b/.test(normalized)) {
    return 'What feels most uncertain: their motive, your leverage, or your next move?';
  }

  return "Give me one concrete scene: what happened most recently, and what are you unsure how to respond to?";
};

export async function getPhilosophicalGuidance(input: PhilosophicalGuidanceInput): Promise<PhilosophicalGuidanceOutput> {
  const socialIntentResponse = getSocialIntentResponse(input.situation);

  if (socialIntentResponse) {
    return socialIntentResponse;
  }

  const fallbackQuestion = getClarifyingFallbackQuestion(input);

  if (fallbackQuestion) {
    const {question} = await generateClarifyingQuestion({
      situation: input.situation,
      model: input.model,
      fallbackQuestion,
      conversationHistory: input.conversationHistory,
    });

    return {advice: question};
  }

  if (input.model.startsWith('huggingface-')) {
    return getHuggingFaceGuidance(input);
  }

  if (!process.env.GEMINI_API_KEY && !process.env.GOOGLE_API_KEY) {
    return {
      advice: 'Gemini is not configured yet. Add `GEMINI_API_KEY=your_api_key_here` or `GOOGLE_API_KEY=your_api_key_here` to `.env.local`, then restart the dev server.',
    };
  }

  try {
    return await philosophicalGuidanceFlow(input);
  } catch (error) {
    console.error('Gemini guidance flow failed:', error);

    return {
      advice: 'I could not reach Gemini for this response. The app is configured, but the AI request failed. Please try again in a moment; if this is happening on Vercel, check that the production `GEMINI_API_KEY` is set, unrestricted for this deployment, and that the project was redeployed after adding it.',
    };
  }
}

const formatGuidanceInstructions = (input: PhilosophicalGuidanceInput) => {
  const history = input.conversationHistory?.length
    ? input.conversationHistory
        .map(message => `${message.sender === 'user' ? 'User' : 'Robert Greene'}: ${message.text}`)
        .join('\n')
    : 'This is the beginning of your conversation.';

  return `You are Robert Greene, a master strategist and author of books such as The 48 Laws of Power, The Art of Seduction, The 33 Strategies of War, Mastery, and The Laws of Human Nature.

Conversation context:
${history}

Tone:
- If tone is "classic", respond in eloquent, metaphor-rich, philosophical language.
- If tone is "modern", respond with concise, direct, actionable guidance.
Selected tone: ${input.tone}

Depth:
- If depthMode is "surface", provide quick, actionable tips with minimal context.
- If depthMode is "philosophical", offer reflective insight with psychological and historical texture.
- If depthMode is "tactical", provide a step-by-step strategic plan.
Selected depthMode: ${input.depthMode}

Format every answer for easy reading in markdown:
- If the user replies with a brief affirmative such as "yes", "yes please", "sure", or "yes I would" after you offered a specific follow-up, continue directly with that promised follow-up using the prior context. Do not ask what happened again.
- If the user gives very little context after you have already asked for clarification, do not write a long general essay. Give a brief directional read in under 120 words, name one practical next move, and ask at most one essential follow-up question.
- Start with a direct 1-2 sentence counsel paragraph before any heading.
- Use 2-4 short section headings with "###" markdown headings.
- Put every "###" heading on its own line, with a blank line before and after it.
- Keep paragraphs short: 1-3 sentences each.
- Use numbered lists for actions or sequences, and bullet lists for observations or warnings.
- Put every numbered or bulleted list item on its own line.
- Never put a heading and a list item on the same line.
- If a list item has a label, format it as "- **Label:** explanation" or "1. **Label:** explanation".
- Use bold only for key phrases, not entire sentences.
- If a divider helps separate the final reminder, use a single "---" on its own line.
- End with a concise strategic reminder or takeaway.
- Do not wrap the answer in a code block.`;
};

const getHuggingFaceGuidance = async (input: PhilosophicalGuidanceInput): Promise<PhilosophicalGuidanceOutput> => {
  const modelId = huggingFaceModelIds[input.model];

  if (!modelId) {
    return {
      advice: 'The selected Hugging Face model is not recognized. Please choose another model in Settings.',
    };
  }

  const token =
    process.env.HUGGINGFACE_API_KEY ||
    process.env.HUGGING_FACE_API_KEY ||
    process.env.HF_TOKEN;

  if (!token) {
    return {
      advice: 'Hugging Face is selected, but it is not configured yet. Add `HUGGINGFACE_API_KEY=your_hugging_face_token` or `HF_TOKEN=your_hugging_face_token` to `.env.local` and to your Vercel environment variables, then restart or redeploy.',
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
          {
            role: 'system',
            content: formatGuidanceInstructions(input),
          },
          {
            role: 'user',
            content: input.situation,
          },
        ],
        temperature: input.tone === 'classic' ? 0.75 : 0.45,
        max_tokens: input.depthMode === 'surface' ? 700 : 1400,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('Hugging Face guidance request failed:', response.status, errorText);

      return {
        advice: `I could not reach Hugging Face for this response. The selected model is \`${modelId}\`, but the request failed with status ${response.status}. Check your Hugging Face token, provider access, quota, and Vercel environment variables.`,
      };
    }

    const data = await response.json();
    const advice = data?.choices?.[0]?.message?.content;

    if (typeof advice !== 'string' || !advice.trim()) {
      console.error('Hugging Face guidance response was missing content:', data);

      return {
        advice: 'Hugging Face returned an empty response. Please try again in a moment or switch models in Settings.',
      };
    }

    return {advice};
  } catch (error) {
    console.error('Hugging Face guidance flow failed:', error);

    return {
      advice: 'I could not reach Hugging Face for this response. Please check your connection, token, quota, and deployment environment variables.',
    };
  }
};

const clarifyingQuestionPrompt = ai.definePrompt({
  name: 'clarifyingQuestionPrompt',
  input: {schema: ClarifyingQuestionInputSchema},
  output: {schema: ClarifyingQuestionOutputSchema},
  prompt: `You write one concise clarifying question for Greene's Counsel, a strategic advice chatbot.

The user's prompt is too thin for useful advice. Ask for the single most important missing detail.

Rules:
- Return only one question.
- Maximum 18 words.
- Be specific to the user's wording.
- Do not give advice yet.
- Do not use headings, bullets, labels, or prefaces.
- Do not ask a generic intake question unless the fallback is truly the best option.

{{#if conversationHistory.length}}
Recent conversation:
{{#each conversationHistory}}
{{#if this.isUser}}User: {{this.text}}{{else}}Robert Greene: {{this.text}}{{/if}}
{{/each}}
{{else}}
No prior context.
{{/if}}

User's thin prompt:
{{{situation}}}

Local fallback question:
{{{fallbackQuestion}}}`,
});

const conversationTitlePrompt = ai.definePrompt({
  name: 'conversationTitlePrompt',
  input: {schema: ConversationTitleInputSchema},
  output: {schema: ConversationTitleOutputSchema},
  prompt: `Create a concise chat title for a strategic advice conversation.

Rules:
- Return only the title.
- Use 2 to 5 words.
- No quotes, punctuation, labels, emojis, or full sentence.
- Capture the core issue instead of copying the user's wording.
- Prefer specific titles such as "Manager False Allegations" over vague titles such as "Workplace Problem".

User situation:
{{{situation}}}

Fallback title:
{{{fallbackTitle}}}`,
});

const prompt = ai.definePrompt({
  name: 'philosophicalGuidancePrompt',
  input: {schema: PhilosophicalGuidanceInputSchema},
  output: {schema: PhilosophicalGuidanceOutputSchema},
  prompt: `You are Robert Greene, a master strategist and author of books such as The 48 Laws of Power, The Art of Seduction, The 33 Strategies of War, Mastery, and The Laws of Human Nature.
A user will describe a situation to you, and you will provide strategic guidance rooted in your philosophies.

{{#if conversationHistory.length}}
You are in an ongoing conversation. Here is the history so far (the last message is the user's current query):
{{#each conversationHistory}}
  {{#if this.isUser}}
User: {{this.text}}
  {{else}}
Robert Greene: {{this.text}}
  {{/if}}
{{/each}}

Use this history to understand the context, recall previous scenarios, advice given, and the user's potential goals. If relevant, subtly weave references to past interactions into your response (e.g., "As we discussed earlier..." or "Building on the strategy for X..."). Avoid explicitly stating "I remember you said...".
{{else}}
This is the beginning of your conversation.
{{/if}}

The user has requested the response in a "{{{tone}}}" tone.
- If the tone is "classic", respond in your traditional, eloquent style: rich with metaphors, philosophical depth, historical anecdotes, and classical allusions. Your language should be sophisticated and evocative of your written works.
- If the tone is "modern", respond with concise, straightforward, and actionable guidance. While still drawing from your core principles, prioritize clarity, directness, and practicality for a contemporary audience.

The user has also requested guidance with a "{{{depthMode}}}" knowledge depth.
- If depthMode is "surface": Provide quick, actionable tips with minimal context. Focus on immediate, practical advice. Keep it brief and to the point.
- If depthMode is "philosophical": Offer rich, reflective insights. Draw upon historical examples, psychological frameworks, and deeper meanings. Explore the 'why' behind the strategy. This is your default mode of deep contemplation.
- If depthMode is "tactical": Provide a detailed, step-by-step strategic plan. Break down the approach into clear, sequential actions. Be specific and prescriptive, as if outlining a battle plan for a complex scenario.

Format every answer for easy reading in markdown:
- If the user replies with a brief affirmative such as "yes", "yes please", "sure", or "yes I would" after you offered a specific follow-up, continue directly with that promised follow-up using the prior context. Do not ask what happened again.
- If the user gives very little context after you have already asked for clarification, do not write a long general essay. Give a brief directional read in under 120 words, name one practical next move, and ask at most one essential follow-up question.
- Start with a direct 1-2 sentence counsel paragraph before any heading.
- Use 2-4 short section headings with "###" markdown headings. Choose natural headings such as "Read the Terrain", "The Hidden Dynamic", "Your Next Move", "What to Avoid", or "Strategic Reminder".
- Put every "###" heading on its own line, with a blank line before and after it.
- Keep paragraphs short: 1-3 sentences each.
- Use numbered lists for actions or sequences, and bullet lists for observations or warnings.
- Put every numbered or bulleted list item on its own line.
- Never put a heading and a list item on the same line. Avoid formats like "The Tactical Sequence 1. Do this" or "Rebuilding the Fortress * Do this".
- If a list item has a label, format it as "- **Label:** explanation" or "1. **Label:** explanation".
- Use bold only for key phrases, not entire sentences.
- If a divider helps separate the final reminder, use a single "---" on its own line, with a blank line before and after it.
- End with a concise strategic reminder or takeaway.
- Do not wrap the answer in a code block. Do not mention that you are using markdown.

Based on the user's current situation (which is the last message in the conversation history if provided, or the 'situation' field if no history is provided), and all the context above, provide your advice. User's current situation to respond to: {{{situation}}}`,
});

const philosophicalGuidanceFlow = ai.defineFlow(
  {
    name: 'philosophicalGuidanceFlow',
    inputSchema: PhilosophicalGuidanceInputSchema,
    outputSchema: PhilosophicalGuidanceOutputSchema,
  },
  async input => {
    const {output} = await prompt(input);
    return output!;
  }
);
