import express from "express";
import TelegramBot from "node-telegram-bot-api";
import crypto from "crypto";
import path from "path";
import { fileURLToPath } from "url";

// ---------------- CONFIG ----------------
const TOKEN = "8569058694:AAGnF0HwzvkE10v40Fz8TpY0F9UInsHP8D0";
const PORT = process.env.PORT || 3000;
const REWARD_SECONDS = 8 * 60;
const COOLDOWN_MS = 3 * 60 * 1000;
const RENDER_URL = "https://project-yodb.onrender.com";

// ---------------- PATH SETUP ----------------
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// ---------------- EXPRESS ----------------
const app = express();
app.use(express.json());
app.use(express.static(path.join(__dirname, "public")));

app.get("/", (_, res) => res.send("Bot running"));

// ---------------- STORAGE ----------------
const users = {}; // userId -> lastEarn
const pending = {}; // userId -> waitingForAd
const codes = {}; // code -> data

// ---------------- TELEGRAM BOT ----------------
const bot = new TelegramBot(TOKEN, { polling: true });

// /start or /earn
bot.onText(/\/(start|earn)/, (msg) => {
  const userId = msg.from.id;
  const now = Date.now();

  if (users[userId] && now - users[userId] < COOLDOWN_MS) {
    const wait = Math.ceil((COOLDOWN_MS - (now - users[userId])) / 1000);
    return bot.sendMessage(msg.chat.id, `⏳ Cooldown active. Try again in ${wait}s`);
  }

  pending[userId] = true;

  bot.sendMessage(msg.chat.id,
    "🎬 Watch an ad to get **+8 minutes** playtime",
    {
      parse_mode: "Markdown",
      reply_markup: {
        inline_keyboard: [[
          {
            text: "🎬 Watch Ad & Get Playtime",
            url: `${RENDER_URL}/monetag-miniapp.html?uid=${userId}`
          }
        ]]
      }
    }
  );
});

// ---------------- AD COMPLETE CALLBACK ----------------
app.post("/api/ad-complete", (req, res) => {
  const { uid } = req.body;
  if (!uid || !pending[uid]) {
    return res.status(400).json({ success: false });
  }

  delete pending[uid];
  users[uid] = Date.now();

  const code = crypto.randomBytes(3).toString("hex").toUpperCase();

  codes[code] = {
    used: false,
    reward: REWARD_SECONDS,
    expires: Date.now() + 10 * 60 * 1000
  };

  bot.sendMessage(uid,
    `✅ Ad completed!\n\n` +
    `🔑 Your redeem code:\n§ ${code} §\n\n` +
    `Use in Minecraft:\n/redeem ${code}`
  );

  res.json({ success: true });
});

// ---------------- REDEEM API ----------------
app.post("/api/redeem", (req, res) => {
  const { code, player } = req.body;
  const entry = codes[code?.toUpperCase()];

  if (!entry) return res.json({ success: false, msg: "Invalid code" });
  if (entry.used) return res.json({ success: false, msg: "Already used" });
  if (Date.now() > entry.expires) return res.json({ success: false, msg: "Expired" });

  entry.used = true;

  res.json({ success: true, reward: entry.reward });
});

// ---------------- START ----------------
app.listen(PORT, () => console.log("Server running"));
