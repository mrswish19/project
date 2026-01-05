import express from "express";
import TelegramBot from "node-telegram-bot-api";
import crypto from "crypto";
import path from "path";
import { fileURLToPath } from "url";

// ---------------- CONFIG ----------------
const TOKEN = "8569058694:AAGTcsW0BNmXF3VsoZ_VS9jn9ePZkiIGQY4"; // CHANGE TOKEN
const PORT = process.env.PORT || 3000;
const RENDER_URL = "https://project-yodb.onrender.com"; // YOUR render URL
const REWARD_SECONDS = 8 * 60;
const COOLDOWN_MS = 3 * 60 * 1000;
const MINIAPP_HTML = "monetag-miniapp.html";

// ---------------- PATH ----------------
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// ---------------- EXPRESS ----------------
const app = express();
app.use(express.json());
app.use(express.static(path.join(__dirname, "public")));

app.get("/", (req, res) => {
  res.send("Bot running (webhook mode)");
});

// ---------------- DATA ----------------
const users = {};
const codes = {};

// ---------------- TELEGRAM BOT (NO POLLING) ----------------
const bot = new TelegramBot(TOKEN);

// ---------------- WEBHOOK ----------------
bot.setWebHook(`${RENDER_URL}/bot${TOKEN}`);

app.post(`/bot${TOKEN}`, (req, res) => {
  bot.processUpdate(req.body);
  res.sendStatus(200);
});

// ---------------- COMMANDS ----------------
bot.setMyCommands([
  {
    command: "earn",
    description: "🎬 Watch Ad & Get Playtime"
  }
]);

bot.onText(/\/earn/, (msg) => {
  bot.sendMessage(
    msg.chat.id,
    "🎮 Get playtime by watching an ad:",
    {
      reply_markup: {
        inline_keyboard: [
          [{ text: "▶ Watch Ad & Get Playtime", callback_data: "watch_ad" }]
        ]
      }
    }
  );
});

bot.onText(/\/start/, (msg) => {
  bot.sendMessage(
    msg.chat.id,
    "🎮 Welcome!\n\nClick the button below to watch an ad and get playtime.",
    {
      reply_markup: {
        inline_keyboard: [
          [{ text: "▶ Watch Ad & Get Playtime", callback_data: "watch_ad" }]
        ]
      }
    }
  );
});

bot.on("callback_query", (q) => {
  if (q.data !== "watch_ad") return;

  const userId = q.from.id;
  const now = Date.now();

  if (users[userId] && now - users[userId] < COOLDOWN_MS) {
    return bot.answerCallbackQuery(q.id, {
      text: "⏳ Cooldown active. Try later.",
      show_alert: true
    });
  }

  const code = crypto.randomBytes(3).toString("hex").toUpperCase();

  codes[code] = {
    used: false,
    expires: now + 10 * 60 * 1000,
    reward: REWARD_SECONDS
  };

  users[userId] = now;

  const adLink = `${RENDER_URL}/${MINIAPP_HTML}?uid=${userId}`;

  bot.sendMessage(
    q.message.chat.id,
    `🎬 Watch the ad first:\n${adLink}\n\n` +
    `After watching, your redeem code will appear here.`,
  );
});

// ---------------- AD COMPLETE ----------------
app.post("/api/ad-complete", (req, res) => {
  const { uid } = req.body;
  if (!uid) return res.sendStatus(400);

  const code = Object.keys(codes).find(
    c => !codes[c].used && codes[c].expires > Date.now()
  );

  if (!code) return res.sendStatus(404);

  bot.sendMessage(
    uid,
    `✅ Ad completed!\n\n🔑 Redeem Code:\n§ ${code} §\n\nUse in Minecraft:\n/redeem ${code}`
  );

  res.sendStatus(200);
});

// ---------------- REDEEM API ----------------
app.post("/api/redeem", (req, res) => {
  const { code, player } = req.body;
  const entry = codes[code?.toUpperCase()];

  if (!entry) return res.json({ success: false });
  if (entry.used) return res.json({ success: false });
  if (Date.now() > entry.expires) return res.json({ success: false });

  entry.used = true;

  res.json({
    success: true,
    reward: entry.reward
  });
});

// ---------------- START ----------------
app.listen(PORT, () => {
  console.log("Server running (WEBHOOK MODE)");
});
