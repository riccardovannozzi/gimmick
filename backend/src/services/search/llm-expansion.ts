/**
 * LLM-based Italian query expansion for the unified `find` tool.
 *
 * Pairs with the local synonyms dictionary: the dictionary catches the
 * common high-frequency cases for free, the LLM handles the long tail
 * (paraphrases, related concepts, less obvious synonyms).
 *
 * Cost / latency: ~$0.0001 + ~400ms with Claude Haiku.
 */
import Anthropic from '@anthropic-ai/sdk';

const anthropic = new Anthropic();

const HAIKU_MODEL = 'claude-haiku-4-5-20251001';

/**
 * Generate up to 3 Italian variants of the input query (synonyms,
 * rephrasings, related terms). Always returns the original query as the
 * first element. On any failure, returns just `[query]` so the caller's
 * pipeline keeps working.
 */
export async function expandWithLLM(query: string): Promise<string[]> {
  try {
    const response = await anthropic.messages.create({
      model: HAIKU_MODEL,
      max_tokens: 200,
      messages: [
        {
          role: 'user',
          content: `Genera 3 varianti italiane della seguente query di ricerca, includendo sinonimi, riformulazioni e termini correlati. Mantieni il significato. Rispondi SOLO con un array JSON di stringhe, senza preamboli.

Query: "${query}"

Esempio output: ["variante 1", "variante 2", "variante 3"]`,
        },
      ],
    });

    const text = response.content
      .filter((b) => b.type === 'text')
      .map((b) => (b as { text: string }).text)
      .join('');

    const cleaned = text.replace(/```json|```/g, '').trim();
    const parsed = JSON.parse(cleaned) as unknown;

    if (!Array.isArray(parsed)) {
      console.warn('[llm-expansion] non-array response:', cleaned);
      return [query];
    }

    const variants = parsed
      .filter((v): v is string => typeof v === 'string' && v.trim().length > 0)
      .slice(0, 3);

    return [query, ...variants];
  } catch (err) {
    console.error('[llm-expansion] failed, falling back to original query:', err);
    return [query];
  }
}
