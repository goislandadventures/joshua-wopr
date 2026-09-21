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
Use a small, youthful, gender-neutral synthetic computer voice.
The register should be light and compact, never deep, gravelly, sinister, breathy, warm, or theatrical.
Keep emotional range almost zero and intonation narrow.
Speak with precise consonants, steady vowels, and minimal natural prosody.
The result should sound machine-generated first and human-like second.
Do not imitate or impersonate any identifiable actor, performer, or real person.
`.trim();

const JOSHUA_WORD_VOICE_INSTRUCTIONS = `
Speak exactly one isolated English word as though it is stored in a 1983 computer speech database.
Do not give the word sentence intonation, emphasis, emotion, warmth, breathiness, or conversational rhythm.
Use a small, youthful, gender-neutral register with crisp consonants and a short steady vowel.
Begin immediately, end cleanly, and add no extra words or sounds.
The delivery must be flat, literal, compact, and synthetic.
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

const JOSHUA_MOVIE_BOARD_ID = 26218;
const JOSHUA_MOVIE_SOUND_IDS = new Set([
  259742, 259744, 259743, 259740, 259738, 259736,
  259734, 259735, 259737, 259741, 259739,
]);

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

    if (url.pathname === '/api/movie-sound') {
      if (request.method !== 'GET') return json({ error: 'Method not allowed' }, 405);

      const id = Number(url.searchParams.get('id'));
      if (!Number.isInteger(id) || !JOSHUA_MOVIE_SOUND_IDS.has(id)) {
        return json({ error: 'Unknown movie sound' }, 404);
      }

      const soundPages = {
        259742: 'https://www.101soundboards.com/sounds/259742-although-primary-goal-has-not-yet-been-achieved-solution-is-near',
        259744: 'https://www.101soundboards.com/sounds/259744-could-not-find-you-in-seattle-and-no-terminal-is-in-operation-at-your-classified-address',
        259743: 'https://www.101soundboards.com/sounds/259743-greetings-professor-falken',
        259740: 'https://www.101soundboards.com/sounds/259740-how-about-a-nice-game-of-chess',
        259738: 'https://www.101soundboards.com/sounds/259738-is-this-a-game-or-is-it-real-whats-the-difference',
        259736: 'https://www.101soundboards.com/sounds/259736-people-sometimes-make-mistakes-yes-they-do',
        259734: 'https://www.101soundboards.com/sounds/259734-shall-we-play-a-game',
        259735: 'https://www.101soundboards.com/sounds/259735-strange-game-the-only-winning-move-is-not-to-play',
        259737: 'https://www.101soundboards.com/sounds/259737-what-is-the-primary-goal-to-win-the-game',
        259741: 'https://www.101soundboards.com/sounds/259741-wouldnt-you-prefer-a-good-game-of-chess',
        259739: 'https://www.101soundboards.com/sounds/259739-you-are-a-hard-man-to-reach',
      };

      const fetchAudio = async (audioUrl) => {
        const response = await fetch(audioUrl, {
          headers: {
            'user-agent': 'Mozilla/5.0 (compatible; JOSHUA-WOPR/1.0)',
            'referer': 'https://www.101soundboards.com/',
            'accept': 'audio/mpeg,audio/*;q=0.9,*/*;q=0.1',
          },
          redirect: 'follow',
        });

        const type = response.headers.get('content-type') || '';
        if (!response.ok || !response.body || !type.toLowerCase().includes('audio')) {
          return null;
        }
        return response;
      };

      try {
        // Strategy 1: legacy/direct rendered-file path.
        const direct = await fetchAudio(
          `https://www.101soundboards.com/storage/board_sounds_rendered/${id}.mp3`
        );
        if (direct) {
          return new Response(direct.body, {
            headers: {
              'content-type': direct.headers.get('content-type') || 'audio/mpeg',
              'cache-control': 'public, max-age=1800',
              'x-joshua-audio-source': '101soundboards-direct',
              'x-joshua-sound-id': String(id),
            },
          });
        }

        // Strategy 2: individual sound page. Extract any current rendered MP3 URL.
        const pageUrl = soundPages[id];
        const pageResponse = await fetch(pageUrl, {
          headers: {
            'user-agent': 'Mozilla/5.0',
            'accept': 'text/html,application/xhtml+xml',
          },
          redirect: 'follow',
        });

        if (pageResponse.ok) {
          const html = await pageResponse.text();
          const decoded = html
            .replace(/&amp;/g, '&')
            .replace(/\\u0026/g, '&')
            .replace(/\\\//g, '/');

          const patterns = [
            /https:\/\/www\.101soundboards\.com\/storage\/board_sounds_rendered\/[^"'<>\\s]+?\.mp3[^"'<>\\s]*/i,
            /\/storage\/board_sounds_rendered\/[^"'<>\\s]+?\.mp3[^"'<>\\s]*/i,
            /"sound_file_url"\s*:\s*"([^"]+)"/i,
          ];

          let candidate = null;
          for (const pattern of patterns) {
            const match = decoded.match(pattern);
            if (!match) continue;
            candidate = match[1] || match[0];
            candidate = candidate.replace(/\\u0026/g, '&').replace(/\\\//g, '/');
            break;
          }

          if (candidate) {
            const resolved = new URL(candidate, 'https://www.101soundboards.com').toString();
            const pageAudio = await fetchAudio(resolved);
            if (pageAudio) {
              return new Response(pageAudio.body, {
                headers: {
                  'content-type': pageAudio.headers.get('content-type') || 'audio/mpeg',
                  'cache-control': 'public, max-age=1800',
                  'x-joshua-audio-source': '101soundboards-page',
                  'x-joshua-sound-id': String(id),
                },
              });
            }
          }
        }

        // Strategy 3: board metadata fallback.
        const boardResponse = await fetch(
          `https://www.101soundboards.com/api/v1/boards/${JOSHUA_MOVIE_BOARD_ID}`,
          {
            headers: {
              'user-agent': 'Mozilla/5.0',
              'accept': 'application/json,text/plain,*/*',
            },
            redirect: 'follow',
          }
        );

        if (boardResponse.ok) {
          const board = await boardResponse.json().catch(() => null);
          const sounds = Array.isArray(board?.sounds)
            ? board.sounds
            : Array.isArray(board?.data?.sounds)
              ? board.data.sounds
              : [];
          const sound = sounds.find(item => Number(item?.id) === id);
          const relativeUrl = sound?.sound_file_url;

          if (typeof relativeUrl === 'string' && relativeUrl) {
            const resolved = new URL(relativeUrl, 'https://www.101soundboards.com').toString();
            const boardAudio = await fetchAudio(resolved);
            if (boardAudio) {
              return new Response(boardAudio.body, {
                headers: {
                  'content-type': boardAudio.headers.get('content-type') || 'audio/mpeg',
                  'cache-control': 'public, max-age=1800',
                  'x-joshua-audio-source': '101soundboards-board-api',
                  'x-joshua-sound-id': String(id),
                },
              });
            }
          }
        }

        return json({
          error: 'Movie audio unavailable',
          sound_id: id,
          sound_page: soundPages[id],
        }, 502);
      } catch (error) {
        return json({
          error: 'Movie sound proxy failed',
          sound_id: id,
          detail: typeof error?.message === 'string' ? error.message.slice(0, 180) : null,
        }, 502);
      }
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

      const wordMode = body?.mode === 'word';
      const maxChars = wordMode ? 48 : 700;
      const text = typeof body?.text === 'string' ? body.text.trim().slice(0, maxChars) : '';
      if (!text) return json({ error: 'No text' }, 400);

      const speechRequest = async (payload) => {
        const response = await fetch('https://api.openai.com/v1/audio/speech', {
          method: 'POST',
          headers: {
            'authorization': `Bearer ${env.OPENAI_API_KEY}`,
            'content-type': 'application/json',
          },
          body: JSON.stringify(payload),
        });

        if (response.ok && response.body) return { response, error: null };

        const data = await response.json().catch(() => null);
        return { response, error: data?.error || null };
      };

      const primaryPayload = wordMode
        ? {
            model: 'gpt-4o-mini-tts',
            voice: 'alloy',
            input: text,
            instructions: JOSHUA_WORD_VOICE_INSTRUCTIONS,
            response_format: 'wav',
            speed: 0.58,
          }
        : {
            model: 'gpt-4o-mini-tts',
            voice: 'alloy',
            input: text,
            instructions: JOSHUA_VOICE_INSTRUCTIONS,
            response_format: 'wav',
            speed: 0.72,
          };

      let attempt = await speechRequest(primaryPayload);

      if (!attempt.response.ok && (attempt.response.status === 400 || attempt.response.status === 404)) {
        attempt = await speechRequest({
          model: 'tts-1',
          voice: 'alloy',
          input: text,
          response_format: 'wav',
          speed: wordMode ? 0.58 : 0.72,
        });
      }

      if (!attempt.response.ok || !attempt.response.body) {
        return json({
          error: 'Voice generation failed',
          status: attempt.response.status,
          code: attempt.error?.code || null,
          type: attempt.error?.type || null,
          detail: typeof attempt.error?.message === 'string' ? attempt.error.message.slice(0, 240) : null,
        }, 502);
      }

      return new Response(attempt.response.body, {
        status: 200,
        headers: {
          'content-type': 'audio/wav',
          'cache-control': wordMode ? 'public, max-age=86400' : 'no-store',
          'x-ai-generated-voice': 'true',
          'x-joshua-voice-mode': wordMode ? 'concatenative-word' : 'sentence',
        },
      });
    }

    return env.ASSETS.fetch(request);
  },
};
