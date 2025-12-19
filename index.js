const mineflayer = require('mineflayer');
const { GoogleGenerativeAI } = require("@google/generative-ai");
const http = require('http');
const { Server } = require("socket.io");

// --- 1. CONFIGURATION (Edit these) ---
const CONFIG = {
    mc_host: 'Hellofrinds.play.hosting', // e.g., 'my-server.aternos.me'
    bot_name: 'Geminiai_Bot',
    mc_version: '1.20.1',                   // Match your server
    gemini_key: 'AIzaSyDhnXw3xrungnRzmvtnqik2oHYbfOW6ifk',
    auth_type: 'offline'                     // 'offline' for cracked/crossplay
};

// --- 2. KEEP-ALIVE & DASHBOARD PORT ---
const server = http.createServer((req, res) => {
    res.write("Geminiai Bot is Online!");
    res.end();
});
const io = new Server(server, { cors: { origin: "*" } });
const PORT = process.env.PORT || 8080; // Uses port from host or 8080
server.listen(PORT, () => console.log(`Server listening on port ${PORT}`));

// --- 3. GEMINI AI SETUP ---
const genAI = new GoogleGenerativeAI(CONFIG.gemini_key);
const aiModel = genAI.getGenerativeModel({ model: "gemini-pro" });

// --- 4. MINEFLAYER BOT SETUP ---
let bot;
function startBot() {
    bot = mineflayer.createBot({
        host: CONFIG.mc_host,
        username: CONFIG.bot_name,
        version: CONFIG.mc_version,
        auth: CONFIG.auth_type
    });

    bot.on('spawn', () => {
        console.log("Bot spawned in Minecraft!");
        // Anti-AFK: Jump every 2 minutes
        setInterval(() => {
            bot.setControlState('jump', true);
            setTimeout(() => bot.setControlState('jump', false), 500);
        }, 120000);
    });

    // AI Chat Logic
    bot.on('chat', async (username, message) => {
        if (username === bot.username) return;
        if (message.toLowerCase().includes('geminiai')) {
            try {
                const prompt = `You are a Minecraft bot named Geminiai. Keep it short. ${username} says: ${message}`;
                const result = await aiModel.generateContent(prompt);
                bot.chat(result.response.text());
            } catch (err) { console.error("AI Error:", err); }
        }
    });

    // Auto-Reconnect
    bot.on('end', (reason) => {
        console.log(`Disconnected: ${reason}. Reconnecting in 30s...`);
        setTimeout(startBot, 30000);
    });
}

// --- 5. MOBILE APP LINK ---
io.on('connection', (socket) => {
    console.log("Mobile App Linked!");
    bot.on('message', (jsonMsg) => {
        socket.emit('chat', jsonMsg.toString()); // Sends MC chat to your phone
    });
});

startBot();
