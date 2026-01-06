import express from "express";
import TelegramBot from "node-telegram-bot-api";
import path from "path";
import { fileURLToPath } from "url";
import fs from "fs";

// ---------------- CONFIG ----------------
const TOKEN = "7539395815:AAFL7RULmJoOBm1y697fmvJSF1VZcMuaR74"; 
const PORT = process.env.PORT || 3000;
const RENDER_URL = "https://project-yodb.onrender.com";
const REWARD_SECONDS = 20 * 60;       // 20 minutes reward
const COOLDOWN_MS = 1 * 60 * 1000;    // 1 minute cooldown
const MINIAPP_HTML = "monetag-miniapp.html";

// ---------------- PATH ----------------
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// ---------------- EXPRESS ----------------
const app = express();
app.use(express.json());
app.use(express.static(path.join(__dirname, "public")));

app.get("/", (req, res) => res.send("Bot running (webhook mode)"));

// ---------------- LOAD CODES ----------------
const CODE_POOL = JSON.parse(fs.readFileSync("codes.json")); // pre-made list of codes
let index = Number(fs.readFileSync("index.txt", "utf8") || 0);
const users = {}; // userId -> last earn timestamp
const codeUsage = {}; // code -> last used timestamp

function saveIndex() {
  fs.writeFileSync("index.txt", String(index));
}

// ---------------- TELEGRAM BOT ----------------
const bot = new TelegramBot(TOKEN);

// ---------------- WEBHOOK ----------------
bot.setWebHook(`${RENDER_URL}/bot${TOKEN}`);
app.post(`/bot${TOKEN}`, (req, res) => {
  bot.processUpdate(req.body);
  res.sendStatus(200);
});

// ---------------- COMMANDS ----------------
bot.setMyCommands([{ command: "earn", description: "🎬 Watch Ad & Get Playtime" }]);

bot.onText(/\/start|\/earn/, (msg) => {
  bot.sendMessage(msg.chat.id,
    "🎮 Click the button below to watch an ad and get playtime.",
    { reply_markup: { inline_keyboard: [[{ text: "▶ Watch Ad & Get Playtime", callback_data: "watch_ad" }]] } }
  );
});

// ---------------- CALLBACK ----------------
bot.on("callback_query", (q) => {
  if (q.data !== "watch_ad") return;

  const userId = q.from.id;
  const now = Date.now();

  if (users[userId] && now - users[userId].lastEarn < COOLDOWN_MS) {
    return bot.answerCallbackQuery(q.id, { text: "⏳ Cooldown active. Try later.", show_alert: true });
  }

  users[userId] = now;

  const adLink = `${RENDER_URL}/${MINIAPP_HTML}?uid=${userId}`;

  bot.sendMessage(q.message.chat.id,
    `🎬 Watch the ad first:\n${adLink}\n\n` +
    `After watching, your redeem code will appear here.`
  );
});

// ---------------- AD COMPLETE ----------------
app.post("/api/ad-complete", (req, res) => {
  const { uid } = req.body;
  if (!uid) return res.sendStatus(400);

  // Find the next available code (not used in last 24h)
  let attempts = 0;
  let code;
  while (attempts < CODE_POOL.length) {
    code = CODE_POOL[index];
    index = (index + 1) % CODE_POOL.length; // loop codes
    saveIndex();
    if (!codeUsage[code] || (Date.now() - codeUsage[code] >= 24*60*60*1000)) break;
    attempts++;
  }

  if (!code) return res.sendStatus(404);

  codeUsage[code] = Date.now();

  bot.sendMessage(
  uid,
  `✅ Ad completed!

🔑 Redeem Code:
${code}

Use in Minecraft with /function redeem_${code}`
);
                 );

  res.sendStatus(200);
});

// ---------------- REDEEM API ----------------
app.post("/api/redeem", (req, res) => {
  const { code, player } = req.body;
  if (!code || !player) return res.json({ success: false });

  res.json({ success: true, reward: REWARD_SECONDS });
});

// ---------------- START SERVER ----------------
app.listen(PORT, () => console.log("Server running (WEBHOOK MODE)"));
