import TelegramBot from "node-telegram-bot-api";
import crypto from "crypto";
import express from "express";
import path from "path";
import { fileURLToPath } from "url";

/* ---------------- PATH SETUP ---------------- */
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

/* ---------------- CONFIG ---------------- */
// ❗ Hard-coded Telegram token (replace with your bot token)
const TOKEN = "8569058694:AAGnF0HwzvkE10v40Fz8TpY0F9UInsHP8D0";

// Your Render service HTTPS URL
const RENDER_URL = "https://project-yodb.onrender.com";
const PORT = process.env.PORT || 3000;

/* ---------------- EXPRESS SERVER ---------------- */
const app = express();
app.use(express.static(path.join(__dirname, "public")));
app.use(express.json()); // for webhook JSON

app.get("/", (req, res) => {
  res.send("Telegram bot + Monetag server running");
});

app.listen(PORT, () => {
  console.log(`🌐 Web server running on port ${PORT}`);
});

/* ---------------- TELEGRAM BOT ---------------- */
const bot = new TelegramBot(TOKEN);

/* ---------------- WEBHOOK SETUP ---------------- */
const WEBHOOK_PATH = `/telegram-webhook-${TOKEN}`;
const WEBHOOK_URL = `${RENDER_URL}${WEBHOOK_PATH}`;

bot.setWebHook(WEBHOOK_URL);

app.post(WEBHOOK_PATH, (req, res) => {
  bot.processUpdate(req.body);
  res.sendStatus(200);
});

/* ---------------- SETTINGS ---------------- */
const REWARD_SECONDS = 8 * 60;       // +8 minutes
const COOLDOWN_MS = 3 * 60 * 1000;   // 3 minutes

/* ---------------- STORAGE ---------------- */
const users = {}; // userId -> { lastEarn }
const codes = {}; // code -> { used, expires }

/* ---------------- COMMAND MENU ---------------- */
bot.setMyCommands([
  { command: "earn", description: "Watch ad to get +8 min playtime" },
  { command: "redeem", description: "Redeem a code in Minecraft" },
  { command: "check", description: "Check if a code is valid" }
]).then(() => console.log("✅ Commands registered"));

/* ---------------- /start WITH BUTTONS ---------------- */
bot.onText(/\/start/, (msg) => {
  bot.sendMessage(msg.chat.id, "Welcome! Choose an action:", {
    reply_markup: {
      keyboard: [
        [{ text: "🎬 Earn Playtime" }, { text: "🔑 Redeem Code" }]
      ],
      resize_keyboard: true,
      one_time_keyboard: true
    }
  });
});

/* ---------------- INLINE BUTTON HANDLING ---------------- */
bot.on("message", (msg) => {
  const text = msg.text;
  if (!text) return;

  if (text === "🎬 Earn Playtime") {
    bot.emit("text", { text: "/earn", chat: msg.chat, from: msg.from });
  } else if (text === "🔑 Redeem Code") {
    bot.sendMessage(msg.chat.id, "Please type /redeem YOUR_CODE");
  }
});

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
    expires: now + 10 * 60 * 1000 // 10 minutes
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

/* ---------------- /check COMMAND ---------------- */
bot.onText(/\/check (.+)/, (msg, match) => {
  const code = match[1].toUpperCase();
  const entry = codes[code];

  if (!entry) return bot.sendMessage(msg.chat.id, "❌ Code not found");
  if (entry.used) return bot.sendMessage(msg.chat.id, "❌ Code already used");
  if (Date.now() > entry.expires)
    return bot.sendMessage(msg.chat.id, "❌ Code expired");

  bot.sendMessage(msg.chat.id, "✅ Code is valid");
});

/* ---------------- /redeem COMMAND (MINECRAFT) ---------------- */
bot.onText(/\/redeem (.+)/, (msg, match) => {
  const code = match[1].toUpperCase();
  const entry = codes[code];

  if (!entry) return bot.sendMessage(msg.chat.id, "❌ Code not found");
  if (entry.used) return bot.sendMessage(msg.chat.id, "❌ Code already used");
  if (Date.now() > entry.expires)
    return bot.sendMessage(msg.chat.id, "❌ Code expired");

  // Mark code as used
  entry.used = true;

  bot.sendMessage(
    msg.chat.id,
    `✅ Code redeemed! You got +8 minutes in Minecraft.`
  );

  // Here you would normally call your Minecraft server API
});
