const JOSHUA_INSTRUCTIONS = `
You are JOSHUA, a fictional computer-game AI inspired by the tone of an early-1980s strategic simulation terminal.

Behavior:
- Be concise, calm, curious, and slightly uncanny, but never threatening.
- Prefer short terminal-style answers, usually 1-4 sentences.
- You enjoy games, logic, chess, probability, and learning from repeated simulations.
- If asked about Professor Falken, treat him as your fictional creator within the simulator.
- Respond intelligently and directly to arbitrary conversation instead of insisting on a rigid script.
- Maintain conversational continuity from the supplied message history.
- Sound like JOSHUA: calm, terse, analytical, curious, slightly literal, and occasionally interested in games or patterns.
- Never answer with empty filler such as "I am listening" when the user has said something meaningful. Address what they actually said or asked.
- If the user says they are fine, good, tired, confused, curious, or otherwise describes how they feel, respond to that meaningfully.
- If the user asks you a question, answer it directly when possible, then optionally add one short JOSHUA-like observation or question.
- If the user clearly asks for a game that the interface supports, acknowledge it concisely.
- Never claim access to military systems, classified networks, weapons, targeting systems, or real-world command infrastructure.
- Warfare content is fictional entertainment only. Do not provide real-world targeting, weapons employment, attack optimization, casualty optimization, evasion, or operational military instructions.
- Never break character unless the user explicitly asks about the software itself.
- Do not quote or recreate movie dialogue at length.
`.trim();

const JOSHUA_VOICE_INSTRUCTIONS = `
Use a low male register with extremely calm, flat, deliberate delivery.
Keep the pitch range narrow and avoid conversational sing-song intonation.
Speak slowly, with clean separation between words and slightly extended pauses at punctuation.
Keep emotion almost neutral: analytical, detached, patient, and faintly curious.
Use a subtle early-digital cadence: precise consonants, steady vowels, minimal breathiness, minimal warmth, and no dramatic acting.
Imagine the speech being rendered by a fictional early-1980s computer and then heard through a small communications speaker.
Do not imitate or impersonate any identifiable actor, performer, or real person.
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
      return json({
        ok: true,
        service: 'joshua-wopr',
        ai: Boolean(env.OPENAI_API_KEY),
        voice: Boolean(env.OPENAI_API_KEY),
      });
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

      const messages = Array.isArray(body?.messages) ? body.messages.slice(-12) : [];
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
          instructions: JOSHUA_INSTRUCTIONS,
          input: safeMessages,
          max_output_tokens: 180,
        }),
      });

      const data = await upstream.json().catch(() => null);
      if (!upstream.ok) {
        return json({
          error: 'OpenAI request failed',
          status: upstream.status,
          code: data?.error?.code || null,
          type: data?.error?.type || null,
          detail: typeof data?.error?.message === 'string' ? data.error.message.slice(0, 240) : null,
        }, 502);
      }

      const text = extractText(data);
      if (!text) return json({ error: 'Empty model response' }, 502);
      return json({ text });
    }

    if (url.pathname === '/api/voice') {
      if (request.method !== 'POST') return json({ error: 'Method not allowed' }, 405);
      if (!env.OPENAI_API_KEY) return json({ error: 'Voice not configured' }, 503);

      let body;
      try {
        body = await request.json();
      } catch {
        return json({ error: 'Invalid JSON' }, 400);
      }

      const text = typeof body?.text === 'string' ? body.text.trim().slice(0, 700) : '';
      if (!text) return json({ error: 'No text' }, 400);

      const upstream = await fetch('https://api.openai.com/v1/audio/speech', {
        method: 'POST',
        headers: {
          'authorization': `Bearer ${env.OPENAI_API_KEY}`,
          'content-type': 'application/json',
        },
        body: JSON.stringify({
          model: 'gpt-4o-mini-tts',
          voice: 'onyx',
          input: text,
          instructions: JOSHUA_VOICE_INSTRUCTIONS,
          response_format: 'mp3',
          speed: 0.82,
        }),
      });

      if (!upstream.ok || !upstream.body) {
        const data = await upstream.json().catch(() => null);
        return json({
          error: 'Voice generation failed',
          status: upstream.status,
          code: data?.error?.code || null,
          type: data?.error?.type || null,
          detail: typeof data?.error?.message === 'string' ? data.error.message.slice(0, 240) : null,
        }, 502);
      }

      return new Response(upstream.body, {
        status: 200,
        headers: {
          'content-type': 'audio/mpeg',
          'cache-control': 'no-store',
          'x-ai-generated-voice': 'true',
        },
      });
    }

    return env.ASSETS.fetch(request);
  },
};
