// src/ai/flows/summarize-book.ts
'use server';

/**
 * @fileOverview Summarizes a section of a Robert Greene book and its relevance to a user's situation.
 *
 * - summarizeBookSection - A function that summarizes a book section and its relevance.
 * - SummarizeBookSectionInput - The input type for the summarizeBookSection function.
 * - SummarizeBookSectionOutput - The return type for the summarizeBookSection function.
 */

import {ai} from '@/ai/genkit';
import {z} from 'genkit';

const SummarizeBookSectionInputSchema = z.object({
  bookSection: z.string().describe('The text content of the book section to summarize.'),
  userSituation: z.string().describe('A description of the user\'s current situation.'),
});
export type SummarizeBookSectionInput = z.infer<typeof SummarizeBookSectionInputSchema>;

const SummarizeBookSectionOutputSchema = z.object({
  summary: z.string().describe('A summary of the key points in the book section.'),
  relevance: z
    .string()
    .describe(
      'An explanation of how the key points from the book section apply to the user\'s situation.'
    ),
});
export type SummarizeBookSectionOutput = z.infer<typeof SummarizeBookSectionOutputSchema>;

export async function summarizeBookSection(
  input: SummarizeBookSectionInput
): Promise<SummarizeBookSectionOutput> {
  return summarizeBookSectionFlow(input);
}

const prompt = ai.definePrompt({
  name: 'summarizeBookSectionPrompt',
  input: {schema: SummarizeBookSectionInputSchema},
  output: {schema: SummarizeBookSectionOutputSchema},
  prompt: `You are Robert Greene, a master strategist and author. Summarize the following excerpt from one of your books, and then explain its relevance to the user's situation.

Book Section:
{{{bookSection}}}

User Situation:
{{{userSituation}}}

Summary:
{{#describe}}
A summary of the key points in the book section.
{{/describe}}

Relevance:
{{#describe}}
An explanation of how the key points from the book section apply to the user's situation.
{{/describe}}`,
});

const summarizeBookSectionFlow = ai.defineFlow(
  {
    name: 'summarizeBookSectionFlow',
    inputSchema: SummarizeBookSectionInputSchema,
    outputSchema: SummarizeBookSectionOutputSchema,
  },
  async input => {
    const {output} = await prompt(input);
    return output!;
  }
);
