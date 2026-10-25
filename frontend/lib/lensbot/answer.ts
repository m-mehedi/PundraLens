import Groq from "groq-sdk"
import { GROQ_MODEL } from "./config"
import type { RetrievedChunk } from "./retrieve"

export interface Citation {
  notice_id: number
  notice_title: string
  matching_passage: string
}

export interface RagAnswer {
  answer: string
  citations: Citation[]
  found_answer: boolean
  model: { key: string; label: string; provider: string }
}

const SYSTEM_PROMPT = `You are LensBot, the notice assistant for Pundra University of Science & Technology (পুণ্ড্র ইউনিভার্সিটি অব সায়েন্স অ্যান্ড টেকনোলজি).

You answer student questions about university notices, using ONLY the notice excerpts provided as context. The context may be in Bengali, English, or both.

Rules:
- Answer in the SAME language the question was asked in. If the question is in Bengali, answer in Bengali. If in English, answer in English.
- Use only the facts in the context. Do not invent dates, fees, venues, or requirements.
- If the context does not contain the answer, say clearly that you could not find it in the published notices (in the question's language). Do not guess.
- Be concise and specific: give the dates, fees, deadlines and venues exactly as written.
- When you rely on a notice, keep its notice id in mind — the caller shows citations separately, so you do not need to print ids yourself.`

/** Build the grounded prompt: one labelled block per retrieved chunk. */
function buildContext(chunks: RetrievedChunk[]): string {
  return chunks
    .map(
      (chunk, index) =>
        `--- Notice ${index + 1} (id ${chunk.notice_id}, ${chunk.notice_title}) ---\n${chunk.content}`
    )
    .join("\n\n")
}

function fallbackAnswer(query: string): string {
  // Bengali questions get a Bengali "not found"; otherwise English.
  return /[\u0980-\u09FF]/.test(query)
    ? "দুঃখিত, প্রকাশিত নোটিশে আপনার প্রশ্নের উত্তর খুঁজে পাইনি।"
    : "Sorry, I could not find an answer to your question in the published notices."
}

/**
 * Ask Groq to answer `query` strictly from `chunks`.
 *
 * A chunk is only cited when the model's answer is grounded — we always return
 * the retrieved notices as citations so the student can verify, deduplicated by
 * notice id and capped so the UI stays readable.
 */
export async function answerQuestion(
  query: string,
  chunks: RetrievedChunk[]
): Promise<RagAnswer> {
  const model = {
    key: GROQ_MODEL,
    label: GROQ_MODEL,
    provider: "groq",
  }

  if (chunks.length === 0) {
    return {
      answer: fallbackAnswer(query),
      citations: [],
      found_answer: false,
      model,
    }
  }

  const apiKey = process.env.GROQ_API_KEY
  if (!apiKey) {
    throw new Error("GROQ_API_KEY is not set — needed to answer questions")
  }

  const groq = new Groq({ apiKey })
  const completion = await groq.chat.completions.create({
    model: GROQ_MODEL,
    temperature: 0.2,
    messages: [
      { role: "system", content: SYSTEM_PROMPT },
      {
        role: "user",
        content: `Context from published notices:\n\n${buildContext(chunks)}\n\nQuestion: ${query}`,
      },
    ],
  })

  const answer =
    completion.choices[0]?.message?.content?.trim() || fallbackAnswer(query)

  // Deduplicate citations by notice id, keeping the highest-scoring passage.
  const byNotice = new Map<number, Citation>()
  for (const chunk of chunks) {
    if (!byNotice.has(chunk.notice_id)) {
      byNotice.set(chunk.notice_id, {
        notice_id: chunk.notice_id,
        notice_title: chunk.notice_title,
        matching_passage: chunk.content.replace(/\s+/g, " ").slice(0, 240),
      })
    }
    if (byNotice.size >= 4) break
  }

  return {
    answer,
    citations: [...byNotice.values()],
    found_answer: true,
    model,
  }
}
