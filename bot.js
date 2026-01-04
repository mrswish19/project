import TelegramBot from "node-telegram-bot-api";
import crypto from "crypto";
import express from "express";
import path from "path";
import { fileURLToPath } from "url";

/* ---------------- PATH SETUP ---------------- */
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

/* ---------------- CONFIG ---------------- */
// ❗ TOKEN IS HARD-CODED AS YOU REQUESTED
const TOKEN = "8569058694:AAGnF0HwzvkE10v40Fz8TpY0F9UInsHP8D0";

// Your Render service URL
const RENDER_URL = "https://metacoresrv.onrender.com";
const PORT = 3000;

/* ---------------- EXPRESS SERVER ---------------- */
const app = express();
app.use(express.static(path.join(__dirname, "public")));

app.get("/", (req, res) => {
  res.send("Telegram bot + Monetag server running");
});

app.listen(PORT, () => {
  console.log("🌐 Web server running on port", PORT);
});

/* ---------------- TELEGRAM BOT ---------------- */
const bot = new TelegramBot(TOKEN, { polling: true });
console.log("🤖 Telegram bot started");

/* ---------------- SETTINGS ---------------- */
const REWARD_SECONDS = 8 * 60;       // +8 minutes
const COOLDOWN_MS = 3 * 60 * 1000;   // 3 minutes

/* ---------------- STORAGE (MEMORY) ---------------- */
const users = {}; // userId -> { lastEarn }
const codes = {}; // code -> { used, expires }

/* ---------------- /earn COMMAND ---------------- */
bot.onText(/\/earn/, (msg) => {
  const chatId = msg.chat.id;
  const userId = msg.from.id;
  const now = Date.now();

  // cooldown check
  if (users[userId] && now - users[userId].lastEarn < COOLDOWN_MS) {
    const wait = Math.ceil(
      (COOLDOWN_MS - (now - users[userId].lastEarn)) / 1000
    );
    return bot.sendMessage(
      chatId,
      `⏳ Cooldown active. Try again in ${wait} seconds.`
    );
  }

  // generate redeem code
  const code = crypto.randomBytes(3).toString("hex").toUpperCase();

  codes[code] = {
    used: false,
    expires: now + 10 * 60 * 1000
  };

  users[userId] = { lastEarn: now };

  const monetagLink = `${RENDER_URL}/monetag-miniapp.html?uid=${userId}`;

  bot.sendMessage(
    chatId,
    `🎬 Watch an ad to earn *+8 minutes*\n\n` +
    `🔗 ${monetagLink}\n\n` +
    `🔑 Redeem code:\n\`${code}\`\n\n` +
    `➡ Use in Minecraft:\n/redeem ${code}\n\n` +
    `⏳ Cooldown: 3 minutes`,
    { parse_mode: "Markdown" }
  );
});

/* ---------------- DEBUG ---------------- */
bot.on("polling_error", console.log);
