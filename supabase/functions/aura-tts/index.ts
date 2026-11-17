// supabase/functions/aura-tts/index.ts
// Φωνή AURA μέσω Gemini TTS (δωρεάν tier του Google AI Studio). Επιστρέφει WAV.
// Secrets:  GEMINI_API_KEY (απαραίτητο)
//           GEMINI_TTS_MODEL (προαιρετικό, λίστα με κόμμα· default: gemini-3.1-flash-tts-preview,gemini-2.5-flash-preview-tts)
//           AURA_VOICE (προαιρετικό, default Aoede)  – γυναικείες: Aoede, Kore, Leda, Zephyr, Callirrhoe, Despina, Vindemiatrix
//           AURA_STYLE (προαιρετικό, οδηγία ύφους στα αγγλικά)

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const MODELS = (Deno.env.get("GEMINI_TTS_MODEL") ?? "gemini-3.1-flash-tts-preview,gemini-2.5-flash-preview-tts")
  .split(",").map((s) => s.trim()).filter(Boolean);
const VOICE = Deno.env.get("AURA_VOICE") ?? "Aoede";
const STYLE = Deno.env.get("AURA_STYLE") ??
  "Say in a warm, calm, elegant and confident female voice, at a natural unhurried pace";

const fallback = () =>
  new Response(JSON.stringify({ fallback: true }), {
    status: 200,
    headers: { ...cors, "Content-Type": "application/json" },
  });

// μικρή cache στη μνήμη: ίδιο κείμενο => καμία νέα κλήση (το free tier έχει αυστηρά όρια)
const cache = new Map<string, Uint8Array>();
const MAX_CACHE = 60;

function wavFromPcm(pcm: Uint8Array, sampleRate: number) {
  const h = new ArrayBuffer(44);
  const v = new DataView(h);
  const w = (o: number, s: string) => [...s].forEach((c, i) => v.setUint8(o + i, c.charCodeAt(0)));
  w(0, "RIFF");
  v.setUint32(4, 36 + pcm.length, true);
  w(8, "WAVE");
  w(12, "fmt ");
  v.setUint32(16, 16, true);
  v.setUint16(20, 1, true); // PCM
  v.setUint16(22, 1, true); // mono
  v.setUint32(24, sampleRate, true);
  v.setUint32(28, sampleRate * 2, true);
  v.setUint16(32, 2, true);
  v.setUint16(34, 16, true);
  w(36, "data");
  v.setUint32(40, pcm.length, true);
  const out = new Uint8Array(44 + pcm.length);
  out.set(new Uint8Array(h), 0);
  out.set(pcm, 44);
  return out;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });

  try {
    const apiKey = Deno.env.get("GEMINI_API_KEY");
    if (!apiKey) {
      console.error("Λείπει το GEMINI_API_KEY");
      return fallback();
    }

    const body = await req.json().catch(() => ({}));
    const text = String(body.text ?? "").replace(/[*_#`~>]+/g, " ").replace(/\s+/g, " ").trim().slice(0, 600);
    if (!text) return fallback();

    const key = `${VOICE}|${text}`;
    const hit = cache.get(key);
    if (hit) {
      return new Response(hit, { headers: { ...cors, "Content-Type": "audio/wav", "Cache-Control": "private, max-age=3600" } });
    }

    for (const model of MODELS) {
      const ctrl = new AbortController();
      const timer = setTimeout(() => ctrl.abort(), 20000);
      try {
        const res = await fetch(
          `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`,
          {
            method: "POST",
            signal: ctrl.signal,
            headers: { "x-goog-api-key": apiKey, "Content-Type": "application/json" },
            body: JSON.stringify({
              contents: [{ parts: [{ text: `${STYLE}: ${text}` }] }],
              generationConfig: {
                responseModalities: ["AUDIO"],
                speechConfig: { voiceConfig: { prebuiltVoiceConfig: { voiceName: VOICE } } },
              },
            }),
          },
        );

        if (!res.ok) {
          console.error(`${model}: HTTP ${res.status}`, (await res.text()).slice(0, 200));
          continue;
        }

        const data = await res.json();
        const part = data?.candidates?.[0]?.content?.parts?.find((p: any) => p?.inlineData?.data);
        const b64: string | undefined = part?.inlineData?.data;
        if (!b64) {
          console.error(`${model}: χωρίς ήχο στην απάντηση`);
          continue;
        }

        const rate = Number(/rate=(\d+)/.exec(part.inlineData.mimeType ?? "")?.[1] ?? 24000);
        const pcm = Uint8Array.from(atob(b64), (c) => c.charCodeAt(0));
        const wav = wavFromPcm(pcm, rate);

        if (cache.size >= MAX_CACHE) cache.delete(cache.keys().next().value!);
        cache.set(key, wav);

        return new Response(wav, {
          headers: { ...cors, "Content-Type": "audio/wav", "Cache-Control": "private, max-age=3600" },
        });
      } catch (e) {
        console.error(`${model}:`, String(e));
      } finally {
        clearTimeout(timer);
      }
    }

    return fallback(); // το front-end περνά στη φωνή του browser
  } catch (e) {
    console.error(e);
    return fallback();
  }
});