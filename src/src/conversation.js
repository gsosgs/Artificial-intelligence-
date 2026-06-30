import OpenAI from "openai";
import { personas } from "./personas.js";

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

const history = [];
let currentIndex = 0;

export function getHistory() {
  return history;
}

export function resetHistory() {
  history.length = 0;
  currentIndex = 0;
}

export function getNextPersona(lastBotId) {
  const others = personas.filter(p => p.id !== lastBotId);
  const next = others[Math.floor(Math.random() * others.length)];
  return next;
}

export async function generateReply(persona, topic) {
  const recentHistory = history.slice(-6);

  const messages = [
    { role: "system", content: persona.systemPrompt }
  ];

  if (topic && history.length === 0) {
    messages.push({
      role: "user",
      content: `ابدأ محادثة عراقية عن موضوع: ${topic}. تكلم بشخصيتك الخاصة وبالعراقي.`
    });
  } else if (history.length === 0) {
    messages.push({
      role: "user",
      content: "ابدأ محادثة عراقية عشوائية مناسبة. تكلم بشخصيتك وبالعراقي."
    });
  } else {
    const historyText = recentHistory
      .map(m => `${m.botName}: ${m.content}`)
      .join("\n");
    messages.push({
      role: "user",
      content: `هاي المحادثة اللي صارت:\n${historyText}\n\nرد بشخصيتك بالعراقي على آخر كلام. لا تكرر اسمك في البداية.`
    });
  }

  const response = await openai.chat.completions.create({
    model: "gpt-4o-mini",
    messages,
    max_tokens: 200,
    temperature: 0.9
  });

  const content = response.choices[0]?.message?.content?.trim() || "...";

  history.push({
    botId: persona.id,
    botName: persona.name,
    content,
    timestamp: new Date().toISOString(),
    color: persona.color
  });

  if (history.length > 50) history.shift();

  return content;
      }
