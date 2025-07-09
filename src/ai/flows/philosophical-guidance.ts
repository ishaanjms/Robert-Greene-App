
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
  conversationHistory: z.array(MessageSchema).optional().describe('The ongoing dialogue history between the user and the chatbot. Used to maintain context and personalize responses.'),
});
export type PhilosophicalGuidanceInput = z.infer<typeof PhilosophicalGuidanceInputSchema>;

const PhilosophicalGuidanceOutputSchema = z.object({
  advice: z.string().describe('Tailored strategic guidance based on Robert Greene\'s teachings, incorporating historical anecdotes and aphorisms, delivered in the chosen tone and depth, and considering past conversation context.'),
});
export type PhilosophicalGuidanceOutput = z.infer<typeof PhilosophicalGuidanceOutputSchema>;

export async function getPhilosophicalGuidance(input: PhilosophicalGuidanceInput): Promise<PhilosophicalGuidanceOutput> {
  return philosophicalGuidanceFlow(input);
}

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
