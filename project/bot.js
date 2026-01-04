import TelegramBot from "node-telegram-bot-api";
import crypto from "crypto";

const TOKEN = "PUT_YOUR_TELEGRAM_BOT_TOKEN_HERE";
const REPLIT_URL = "https://YOUR-REPLIT-URL"; // your deployed Mini App URL

const bot = new TelegramBot(TOKEN, { polling: true });

// Settings
const REWARD_SECONDS = 8 * 60;       // +8 minutes
const COOLDOWN_MS = 3 * 60 * 1000;   // 3-minute cooldown

const users = {}; // userId -> { lastEarn }
const codes = {}; // code -> { reward, used, expires }

// /earn command
bot.onText(/\/earn/, (msg) => {
  const userId = msg.from.id;
  const now = Date.now();

  // Check cooldown
  if (users[userId] && now - users[userId].lastEarn < COOLDOWN_MS) {
    const wait = Math.ceil((COOLDOWN_MS - (now - users[userId].lastEarn)) / 1000);
    return bot.sendMessage(msg.chat.id, `⏳ Cooldown active. Try again in ${wait} seconds.`);
  }

  // Generate one-time redeem code
  const code = crypto.randomBytes(3).toString("hex").toUpperCase();
  codes[code] = {
    reward: REWARD_SECONDS,
    used: false,
    expires: now + 10 * 60 * 1000 // expires in 10 minutes
  };

  users[userId] = { lastEarn: now };

  const monetagLink = `${REPLIT_URL}/monetag-miniapp.html?uid=${userId}`;

  bot.sendMessage(
    msg.chat.id,
    `🎬 Watch the ad to earn +8 minutes!\n\n` +
    `🔗 Click here: ${monetagLink}\n\n` +
    `✅ After watching, you will get a redeem code:\n` +
    `§ ${code} §\n\n` +
    `Use in Minecraft: /redeem ${code}\n` +
    `⏳ Cooldown: 3 minutes`
  );
});

// Optional admin command to mark code as used
bot.onText(/\/use (.+)/, (msg, match) => {
  const code = match[1].toUpperCase();
  const entry = codes[code];

  if (!entry) return bot.sendMessage(msg.chat.id, "❌ Invalid code");
  if (entry.used) return bot.sendMessage(msg.chat.id, "❌ Code already used");
  if (Date.now() > entry.expires) return bot.sendMessage(msg.chat.id, "❌ Code expired");

  entry.used = true;
  bot.sendMessage(msg.chat.id, "✅ Code marked as used");
});

console.log("Telegram bot running (8 min reward, 3 min cooldown, Monetag integrated)");
