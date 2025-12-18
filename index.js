const bedrock = require('bedrock-protocol');
const brain = require('brain.js');
const fs = require('fs');
const axios = require('axios');
const express = require('express');

const app = express();
const DATA_FILE = './brain_state.json';
const API_URL = `https://panel.play.hosting/api/client/servers/${process.env.SERVER_ID}/power`;

// --- 🧠 NEURAL NETWORK SETUP ---
let net = new brain.NeuralNetwork();
let isTrained = false;

function loadBrain() {
    try {
        if (fs.existsSync(DATA_FILE)) {
            const raw = fs.readFileSync(DATA_FILE);
            net.fromJSON(JSON.parse(raw));
            isTrained = true;
            console.log("🧠 Brain loaded from disk.");
        }
    } catch (e) { console.log("🆕 Starting with a fresh brain."); }
}

function saveBrain() {
    fs.writeFileSync(DATA_FILE, JSON.stringify(net.toJSON()));
}

loadBrain();

// --- ⚡ PLAY.HOSTING API AUTO-REPAIR ---
async function manageServer(action) {
    console.log(`🔌 API Action: ${action.toUpperCase()} signal sent.`);
    try {
        await axios.post(API_URL, { signal: action }, {
            headers: { 
                'Authorization': `Bearer ${process.env.PANEL_API_KEY}`,
                'Accept': 'application/json' 
            }
        });
    } catch (e) { console.error("❌ API Error:", e.message); }
}

// --- 🎮 THE AUTOMATIC BOT ENGINE ---
function initBot() {
    console.log("🤖 Attempting to join Minecraft...");

    const client = bedrock.createClient({
        host: process.env.SERVER_IP,
        port: parseInt(process.env.SERVER_PORT),
        username: 'Geminiai_Auto',
        offline: true,
        connectTimeout: 15000
    });

    // If we can't connect in 20s, the server is likely in "Limbo"
    const limboTimer = setTimeout(() => {
        console.log("🚨 Connection Hang Detected! Force Restarting Server...");
        manageServer('restart');
    }, 20000);

    client.on('spawn', () => {
        clearTimeout(limboTimer);
        console.log("✅ Bot is inside the server.");
        
        // AI Learning Logic
        client.on('set_health', (packet) => {
            if (packet.health < 20) {
                // Self-training on the fly
                const data = [{ input: { hp: packet.health / 20 }, output: { safe: 0 } }];
                net.train(data, { iterations: 100 }); 
                saveBrain();
                console.log("📝 AI updated its danger model.");
            }
        });
    });

    // 🔄 AUTO-RECONNECT LOGIC
    client.on('close', () => {
        console.log("🔌 Disconnected. Re-trying in 15 seconds...");
        setTimeout(initBot, 15000);
    });

    client.on('error', (err) => {
        console.log(`⚠️ Socket Error: ${err.message}`);
        if (err.message.includes('ECONNREFUSED')) {
            manageServer('start'); // Server is asleep, wake it up
        }
    });
}

// --- 📡 DASHBOARD (Health Check) ---
app.get('/', (req, res) => {
    res.send(`<h1>Geminiai AI</h1><p>Brain Active: ${isTrained}</p>`);
});

app.listen(process.env.PORT || 3000, () => {
    console.log("🚀 Automation System Online.");
    initBot();
});
