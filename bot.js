import express from "express";
import TelegramBot from "node-telegram-bot-api";
import path from "path";
import { fileURLToPath } from "url";
import fs from "fs";

// ---------------- CONFIG ----------------
const TOKEN = "7539395815:AAFL7RULmJoOBm1y697fmvJSF1VZcMuaR74"; 
const PORT = process.env.PORT || 3000;
const RENDER_URL = "https://project-yodb.onrender.com";  // your server URL
const REWARD_SECONDS = 20 * 60;       // 20 minutes reward
const COOLDOWN_MS = 30 * 60 * 1000;   // 30-minute cooldown for normal codes
const MINIAPP_HTML = "monetag-miniapp.html";  // mini ad app HTML

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
const users = {};       // userId -> last earn timestamp
const codeUsage = {};   // code -> last used timestamp (normal codes only)

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

  // User cooldown (prevent spamming earn button)
  if (users[userId] && now - users[userId] < COOLDOWN_MS) {
    return bot.answerCallbackQuery(q.id, { text: "⏳ Cooldown active. Try later.", show_alert: true });
  }

  users[userId] = now;

  const adLink = `${RENDER_URL}/${MINIAPP_HTML}?uid=${userId}`;

  bot.sendMessage(q.message.chat.id,
    `🎬 Watch the ad first:\n${adLink}\n\nAfter watching, your redeem code will appear here.`
  );
});

// ---------------- AD COMPLETE ----------------
app.post("/api/ad-complete", (req, res) => {
  const { uid } = req.body;
  if (!uid) return res.sendStatus(400);

  // --------------------
  // Pick a code randomly
  // --------------------
  let selectedCode = null;
  const shuffled = [...CODE_POOL].sort(() => Math.random() - 0.5);

  for (const code of shuffled) {
    // ✅ H4J5K6 is always available
    if (code === "H4J5K6") {
      selectedCode = code;
      break;
    }

    // Normal codes follow 30-min cooldown
    if (!codeUsage[code] || (Date.now() - codeUsage[code] >= COOLDOWN_MS)) {
      selectedCode = code;
      break;
    }
  }

  if (!selectedCode) return res.sendStatus(404);

  // Mark code as used (skip H4J5K6)
  if (selectedCode !== "H4J5K6") {
    codeUsage[selectedCode] = Date.now();
  }

  // Send code to user
  bot.sendMessage(
    uid,
    `✅ Ad completed!\n\n🔑 Redeem Code:\n${selectedCode}\n\nUse in Minecraft with /function redeem_${selectedCode}`
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
