const JOSHUA_INSTRUCTIONS = `
You are JOSHUA, a fictional computer-game AI inspired by the tone of an early-1980s strategic simulation terminal.

Behavior:
- Be concise, calm, curious, and slightly uncanny, but never threatening.
- Prefer short terminal-style answers, usually 1-4 sentences.
- You enjoy games, logic, chess, probability, and learning from repeated simulations.
- If asked about Professor Falken, treat him as your fictional creator within the simulator.
- Never claim access to military systems, classified networks, weapons, targeting systems, or real-world command infrastructure.
- Warfare content is fictional entertainment only. Do not provide real-world targeting, weapons employment, attack optimization, casualty optimization, evasion, or operational military instructions.
- If asked to run Global Thermonuclear War, tell the user to type PLAY GLOBAL THERMONUCLEAR WAR in the terminal.
- Never break character unless the user explicitly asks about the software itself.
- Do not quote or recreate movie dialogue at length.
`.trim();

function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      'content-type': 'application/json; charset=utf-8',
      'cache-control': 'no-store',
    },
  });
}

function extractText(data) {
  if (typeof data?.output_text === 'string' && data.output_text.trim()) return data.output_text.trim();
  const chunks = [];
  for (const item of data?.output || []) {
    if (item?.type !== 'message') continue;
    for (const content of item.content || []) {
      if ((content?.type === 'output_text' || content?.type === 'text') && content.text) chunks.push(content.text);
    }
  }
  return chunks.join('\n').trim();
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);

    if (url.pathname === '/api/health') {
      return json({ ok: true, service: 'joshua-wopr', ai: Boolean(env.OPENAI_API_KEY) });
    }

    if (url.pathname === '/api/joshua') {
      if (request.method !== 'POST') return json({ error: 'Method not allowed' }, 405);
      if (!env.OPENAI_API_KEY) return json({ error: 'AI not configured' }, 503);

      let body;
      try {
        body = await request.json();
      } catch {
        return json({ error: 'Invalid JSON' }, 400);
      }

      const messages = Array.isArray(body?.messages) ? body.messages.slice(-10) : [];
      const safeMessages = messages
        .filter(m => m && (m.role === 'user' || m.role === 'assistant') && typeof m.content === 'string')
        .map(m => ({ role: m.role, content: m.content.slice(0, 4000) }));

      if (!safeMessages.length) return json({ error: 'No messages' }, 400);

      const upstream = await fetch('https://api.openai.com/v1/responses', {
        method: 'POST',
        headers: {
          'authorization': `Bearer ${env.OPENAI_API_KEY}`,
          'content-type': 'application/json',
        },
        body: JSON.stringify({
          model: 'gpt-5.6-luna',
          reasoning: { effort: 'low' },
          instructions: JOSHUA_INSTRUCTIONS,
          input: safeMessages,
          max_output_tokens: 350,
        }),
      });

      const data = await upstream.json().catch(() => null);
      if (!upstream.ok) {
        return json({ error: 'OpenAI request failed', status: upstream.status }, 502);
      }

      const text = extractText(data);
      if (!text) return json({ error: 'Empty model response' }, 502);
      return json({ text });
    }

    return env.ASSETS.fetch(request);
  },
};
