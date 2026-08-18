
// src/ai/flows/philosophical-guidance.ts
'use server';

/**
 * @fileOverview A philosophical guidance AI agent based on Robert Greene's teachings.
 *
 * - getPhilosophicalGuidance - A function that provides strategic guidance based on user input, preferred tone, desired depth, and conversation history.
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
    'gemini-3-flash',
    'huggingface-openai-gpt-oss-120b',
    'huggingface-deepseek-v4-pro',
    'huggingface-nvidia-nemotron-3-ultra-550b',
    'huggingface-meta-llama-3-1-405b-instruct',
  ]).default('gemini-3-flash').describe('The model provider and model selected by the user.'),
  conversationHistory: z.array(MessageSchema).optional().describe('The ongoing dialogue history between the user and the chatbot. Used to maintain context and personalize responses.'),
});
export type PhilosophicalGuidanceInput = z.infer<typeof PhilosophicalGuidanceInputSchema>;

const PhilosophicalGuidanceOutputSchema = z.object({
  advice: z.string().describe('Tailored strategic guidance based on Robert Greene\'s teachings, incorporating historical anecdotes and aphorisms, delivered in the chosen tone and depth, and considering past conversation context.'),
});
export type PhilosophicalGuidanceOutput = z.infer<typeof PhilosophicalGuidanceOutputSchema>;

const huggingFaceModelIds: Partial<Record<PhilosophicalGuidanceInput['model'], string>> = {
  'huggingface-openai-gpt-oss-120b': 'openai/gpt-oss-120b',
  'huggingface-deepseek-v4-pro': 'deepseek-ai/DeepSeek-V4-Pro',
  'huggingface-nvidia-nemotron-3-ultra-550b': 'nvidia/NVIDIA-Nemotron-3-Ultra-550B-A55B-NVFP4',
  'huggingface-meta-llama-3-1-405b-instruct': 'meta-llama/Llama-3.1-405B-Instruct',
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

  if (
    hasOnlySocialLength &&
    /^(hi|hii|hello|hey|heyy|yo|sup|good morning|good afternoon|good evening)$/.test(normalized)
  ) {
    return {
      advice: "I'm here. What happened, who's involved, or what feels unclear?",
    };
  }

  if (
    hasOnlySocialLength &&
    /^(thanks|thank you|thank u|thx|ty|appreciate it|that helped|thanks a lot|thank you so much)$/.test(normalized)
  ) {
    return {
      advice: "You're welcome. Keep watching the pattern, not just the event.",
    };
  }

  if (
    hasOnlySocialLength &&
    /^(bye|goodbye|see you|see ya|talk later|good night|goodnight|gn|catch you later)$/.test(normalized)
  ) {
    return {
      advice: 'Until next time. Step back, observe, then move with intention.',
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

const getClarifyingResponse = (input: PhilosophicalGuidanceInput): PhilosophicalGuidanceOutput | null => {
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
    return {
      advice: 'What changed recently at work: their behavior, your role, or the pressure around a decision?',
    };
  }

  if (/\b(friend|partner|girlfriend|boyfriend|wife|husband|ex|dating|relationship|family)\b/.test(normalized)) {
    return {
      advice: 'What changed recently: their behavior, your last interaction, or the expectations between you?',
    };
  }

  if (/\b(decision|choose|choice|option|options|decide|path)\b/.test(normalized)) {
    return {
      advice: 'What are the options in front of you, and what outcome are you trying to protect?',
    };
  }

  if (/\b(conflict|fight|argument|tension|angry|mad|upset)\b/.test(normalized)) {
    return {
      advice: 'What triggered the conflict, and what response are you considering now?',
    };
  }

  if (/\b(confused|unclear|lost|stuck|unsure|overthinking)\b/.test(normalized)) {
    return {
      advice: 'Is this about a person, a decision, or your own next move?',
    };
  }

  if (/\b(weird|distant|cold|different|changed)\b/.test(normalized)) {
    return {
      advice: 'What feels most uncertain: their motive, your leverage, or your next move?',
    };
  }

  return {
    advice: "Give me one concrete scene: what happened most recently, and what are you unsure how to respond to?",
  };
};

export async function getPhilosophicalGuidance(input: PhilosophicalGuidanceInput): Promise<PhilosophicalGuidanceOutput> {
  const socialIntentResponse = getSocialIntentResponse(input.situation);

  if (socialIntentResponse) {
    return socialIntentResponse;
  }

  const clarifyingResponse = getClarifyingResponse(input);

  if (clarifyingResponse) {
    return clarifyingResponse;
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
