
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
  model: z.enum(['gemini-3-flash', 'huggingface-openai-gpt-oss-120b']).default('gemini-3-flash').describe('The model provider and model selected by the user.'),
  conversationHistory: z.array(MessageSchema).optional().describe('The ongoing dialogue history between the user and the chatbot. Used to maintain context and personalize responses.'),
});
export type PhilosophicalGuidanceInput = z.infer<typeof PhilosophicalGuidanceInputSchema>;

const PhilosophicalGuidanceOutputSchema = z.object({
  advice: z.string().describe('Tailored strategic guidance based on Robert Greene\'s teachings, incorporating historical anecdotes and aphorisms, delivered in the chosen tone and depth, and considering past conversation context.'),
});
export type PhilosophicalGuidanceOutput = z.infer<typeof PhilosophicalGuidanceOutputSchema>;

export async function getPhilosophicalGuidance(input: PhilosophicalGuidanceInput): Promise<PhilosophicalGuidanceOutput> {
  if (input.model === 'huggingface-openai-gpt-oss-120b') {
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
        model: 'openai/gpt-oss-120b',
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
        advice: `I could not reach Hugging Face for this response. The selected model is \`openai/gpt-oss-120b\`, but the request failed with status ${response.status}. Check your Hugging Face token, provider access, quota, and Vercel environment variables.`,
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
