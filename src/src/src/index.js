import "dotenv/config";
import { Client, GatewayIntentBits } from "discord.js";
import { personas } from "./personas.js";
import { generateReply, resetHistory, getNextPersona } from "./conversation.js";

const CHANNEL_ID = process.env.DISCORD_CHANNEL_ID;
const INTERVAL_MS = parseInt(process.env.INTERVAL_SECONDS || "15") * 1000;

if (!CHANNEL_ID) {
  console.error("❌ DISCORD_CHANNEL_ID غير موجود في .env");
  process.exit(1);
}

if (!process.env.OPENAI_API_KEY) {
  console.error("❌ OPENAI_API_KEY غير موجود في .env");
  process.exit(1);
}

const bots = [];
let conversationTimer = null;
let lastBotId = null;
let isRunning = false;

async function createBot(persona) {
  const token = process.env[persona.tokenEnv];
  if (!token) {
    console.warn(`⚠️  توكن ${persona.name} (${persona.tokenEnv}) غير موجود — سيُتجاهل`);
    return null;
  }

  const client = new Client({
    intents: [
      GatewayIntentBits.Guilds,
      GatewayIntentBits.GuildMessages,
      GatewayIntentBits.MessageContent
    ]
  });

  await new Promise((resolve, reject) => {
    client.once("ready", () => {
      console.log(`✅ ${persona.name} متصل كـ ${client.user.tag}`);
      resolve();
    });
    client.once("error", reject);
    client.login(token).catch(reject);
  });

  return { client, persona };
}

async function sendMessage(bot, content) {
  try {
    const channel = await bot.client.channels.fetch(CHANNEL_ID);
    if (!channel?.isTextBased()) return;
    await channel.send(content);
    console.log(`💬 ${bot.persona.name}: ${content.slice(0, 60)}...`);
  } catch (err) {
    console.error(`❌ خطأ ${bot.persona.name}:`, err.message);
  }
}

async function conversationTick() {
  if (!isRunning || bots.length === 0) return;
  const nextPersona = getNextPersona(lastBotId);
  const bot = bots.find(b => b.persona.id === nextPersona.id);
  if (!bot) return;
  try {
    const reply = await generateReply(nextPersona, process.env.CONVERSATION_TOPIC || null);
    await sendMessage(bot, reply);
    lastBotId = nextPersona.id;
  } catch (err) {
    console.error("❌ خطأ في الرد:", err.message);
  }
}

async function main() {
  console.log("🤖 جاري تشغيل البوتات العراقية...\n");

  for (const persona of personas) {
    const bot = await createBot(persona);
    if (bot) bots.push(bot);
  }

  if (bots.length === 0) {
    console.error("❌ ما في ولا بوت متصل. تأكد من التوكنات في .env");
    process.exit(1);
  }

  console.log(`\n✅ ${bots.length} بوت جاهز\n`);

  resetHistory();
  isRunning = true;
  await conversationTick();
  conversationTimer = setInterval(conversationTick, INTERVAL_MS);

  const shutdown = () => {
    isRunning = false;
    clearInterval(conversationTimer);
    bots.forEach(b => b.client.destroy());
    process.exit(0);
  };
  process.on("SIGINT", shutdown);
  process.on("SIGTERM", shutdown);
}

main().catch(err => {
  console.error("❌ خطأ عام:", err);
  process.exit(1);
});
