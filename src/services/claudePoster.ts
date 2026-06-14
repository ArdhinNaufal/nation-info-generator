// Anthropic (Claude) — generate the poster's landmark + facts JSON (specs/poster-mode.md §4).
// Called directly from the browser (the user supplies their own key), so we send the
// browser-access header Anthropic requires for direct client-side calls. On any failure or a
// malformed response we throw, and the caller degrades to field-based facts (§8).

const ENDPOINT = 'https://api.anthropic.com/v1/messages';
const MODEL = 'claude-sonnet-4-6';

export interface PosterContent {
  landmarkName: string;
  landmarkDescription: string;
  unsplashQuery: string;
  facts: string[];
}

interface ClaudeResponse {
  content?: Array<{ type?: string; text?: string }>;
}

function buildPrompt(nameCommon: string, alpha2: string): string {
  return (
    `Country: ${nameCommon} (${alpha2})\n\n` +
    'Return JSON with exactly these keys:\n' +
    '- landmark_name: string — the single most iconic landmark or tourist destination\n' +
    '- landmark_description: string — one sentence (max 120 chars) describing it and its location within the country\n' +
    '- unsplash_query: string — a specific Unsplash search query to find a striking photo of this landmark\n' +
    '- facts: string[] — exactly 7 interesting facts about the country, each 1-2 sentences, no bullet points'
  );
}

// The model is told to emit pure JSON, but strip a ```json fence defensively before parsing.
function extractJson(text: string): unknown {
  const trimmed = text.trim().replace(/^```(?:json)?\s*/i, '').replace(/```$/, '').trim();
  return JSON.parse(trimmed);
}

export async function fetchPosterContent(
  nameCommon: string,
  alpha2: string,
  key: string,
): Promise<PosterContent> {
  const res = await fetch(ENDPOINT, {
    method: 'POST',
    headers: {
      'x-api-key': key,
      'anthropic-version': '2023-06-01',
      'anthropic-dangerous-direct-browser-access': 'true',
      'content-type': 'application/json',
    },
    body: JSON.stringify({
      model: MODEL,
      max_tokens: 800,
      system:
        'You generate structured JSON content for a country info poster. Output valid JSON only — no markdown, no explanation.',
      messages: [{ role: 'user', content: buildPrompt(nameCommon, alpha2) }],
    }),
  });

  if (!res.ok) throw new Error(`Anthropic request failed: ${res.status}`);

  const data = (await res.json()) as ClaudeResponse;
  const text = data.content?.find((b) => b.type === 'text')?.text ?? data.content?.[0]?.text;
  if (!text) throw new Error('Anthropic response had no text content.');

  const parsed = extractJson(text) as Record<string, unknown>;
  const facts = Array.isArray(parsed.facts)
    ? (parsed.facts as unknown[]).filter((f): f is string => typeof f === 'string')
    : [];
  if (typeof parsed.landmark_name !== 'string' || facts.length === 0) {
    throw new Error('Anthropic response missing required keys.');
  }

  return {
    landmarkName: parsed.landmark_name,
    landmarkDescription: typeof parsed.landmark_description === 'string' ? parsed.landmark_description : '',
    unsplashQuery:
      typeof parsed.unsplash_query === 'string' && parsed.unsplash_query
        ? parsed.unsplash_query
        : `${nameCommon} landscape`,
    facts: facts.slice(0, 7),
  };
}
