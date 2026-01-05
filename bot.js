import express from "express";
import TelegramBot from "node-telegram-bot-api";
import crypto from "crypto";
import path from "path";
import { fileURLToPath } from "url";

// ------------------- CONFIG -------------------
const TOKEN = "8569058694:AAGnF0HwzvkE10v40Fz8TpY0F9UInsHP8D0"; // Telegram bot token
const PORT = process.env.PORT || 3000;
const REWARD_SECONDS = 8 * 60;       // +8 minutes
const COOLDOWN_MS = 3 * 60 * 1000;   // 3 minutes cooldown
const MINIAPP_HTML = "monetag-miniapp.html";
const RENDER_URL = "https://project-yodb.onrender.com"; // <-- Your Render URL here

// ------------------- PATH SETUP -------------------
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// ------------------- EXPRESS SERVER -------------------
const app = express();
app.use(express.json());
app.use(express.static(path.join(__dirname, "public"))); // serve Monetag HTML

app.get("/", (req, res) => {
  res.send("Telegram bot + Redeem API running!");
});

// ------------------- DATA STORAGE -------------------
const users = {}; // userId -> last earn timestamp
const codes = {}; // code -> { used, expires, reward }

// ------------------- TELEGRAM BOT -------------------
const bot = new TelegramBot(TOKEN, { polling: true });

// --- /earn command ---
bot.onText(/\/earn/, (msg) => {
  const userId = msg.from.id;
  const now = Date.now();

  // Cooldown check
  if (users[userId] && now - users[userId].lastEarn < COOLDOWN_MS) {
    const wait = Math.ceil((COOLDOWN_MS - (now - users[userId].lastEarn)) / 1000);
    return bot.sendMessage(msg.chat.id, `⏳ Cooldown active. Try again in ${wait}s`);
  }

  // Generate redeem code
  const code = crypto.randomBytes(3).toString("hex").toUpperCase();
  codes[code] = {
    used: false,
    expires: now + 10 * 60 * 1000, // 10 min expiry
    reward: REWARD_SECONDS
  };

  users[userId] = { lastEarn: now };

  // Monetag link with Render URL
  const monetagLink = `${RENDER_URL}/${MINIAPP_HTML}?uid=${userId}`;

  bot.sendMessage(
    msg.chat.id,
    `🎬 Watch an ad to earn +8 minutes!\n\n` +
    `🔗 Click here: ${monetagLink}\n\n` +
    `🔑 Your redeem code:\n§ ${code} §\n\n` +
    `Use in Minecraft: /redeem ${code}\n` +
    `⏳ Cooldown: 3 minutes`
  );
});

// ------------------- REDEEM API -------------------
app.post("/api/redeem", (req, res) => {
  const { code, player } = req.body;
  if (!code || !player) return res.status(400).json({ success: false, msg: "Missing code or player" });

  const entry = codes[code.toUpperCase()];
  if (!entry) return res.json({ success: false, msg: "Code not found" });
  if (entry.used) return res.json({ success: false, msg: "Code already used" });
  if (Date.now() > entry.expires) return res.json({ success: false, msg: "Code expired" });

  entry.used = true;

  res.json({
    success: true,
    reward: entry.reward,
    msg: `Code redeemed for ${player}`
  });

  console.log(`Redeemed code ${code} for player ${player} (+${entry.reward}s)`);
});

// ------------------- START SERVER -------------------
app.listen(PORT, () => {
  console.log(`Node.js server running on port ${PORT}`);
});

console.log("Telegram bot running with 8-min reward and 3-min cooldown");
