const mineflayer = require('mineflayer');
const pathfinder = require('mineflayer-pathfinder').pathfinder;
const { Movements, goals } = require('mineflayer-pathfinder');
const pvp = require('mineflayer-pvp').plugin;
const autoeat = require('mineflayer-auto-eat').plugin;
const tool = require('mineflayer-tool').plugin;
const { GoogleGenerativeAI } = require("@google/generative-ai");
const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const vec3 = require('vec3');

// --- 1. CONFIGURATION ---
const app = express();
const server = http.createServer(app);
const io = new Server(server);
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
const aiModel = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });

app.get('/', (req, res) => res.sendFile(__dirname + '/index.html'));

// Security: Only these accounts can control the bot
const MASTER_ACCOUNTS = ['Blackhunt19020', '.Blackhunt19020'];

let bot;
let isConnected = false;
let farmingActive = false;

function createBot() {
    bot = mineflayer.createBot({
        host: process.env.SERVER_IP, 
        username: 'Geminiai',
        hideErrors: true
    });

    bot.loadPlugin(pathfinder);
    bot.loadPlugin(pvp);
    bot.loadPlugin(autoeat);
    bot.loadPlugin(tool);

    bot.on('spawn', () => {
        isConnected = true;
        const mcData = require('minecraft-data')(bot.version);
        const movements = new Movements(bot, mcData);
        movements.allowSprinting = true;
        movements.allowParkour = true;
        bot.pathfinder.setMovements(movements);
        console.log(`✅ Geminiai active on ${process.env.SERVER_IP}`);
    });

    // --- 2. COMMAND LOGIC ---
    bot.on('chat', async (username, message) => {
        if (username === bot.username || !MASTER_ACCOUNTS.includes(username)) return;

        // Command: Come to Master
        if (message === 'come') {
            const target = bot.players[username]?.entity;
            if (target) {
                bot.pathfinder.setGoal(new goals.GoalNear(target.position.x, target.position.y, target.position.z, 1));
            }
        }

        // Command: Start Farming
        if (message === 'start farming') {
            bot.chat("Understood, Master. Tending to the fields now.");
            farmingActive = true;
            runFarmLoop();
        }

        // Command: AI Chat
        if (message.includes('Geminiai')) {
            try {
                const result = await aiModel.generateContent(`Your master ${username} says: ${message}. Respond as Geminiai, an intelligent player.`);
                bot.chat(result.response.text());
            } catch (e) { console.log("AI Error"); }
        }
    });

    bot.on('end', () => {
        isConnected = false;
        setTimeout(createBot, 30000); // Auto-reconnect
    });
}

// --- 3. FARMING SYSTEM ---
async function runFarmLoop() {
    if (!farmingActive || !isConnected) return;

    const block = bot.findBlock({
        matching: (blk) => ['wheat', 'carrots', 'potatoes'].includes(blk.name) && blk.metadata === 7,
        maxDistance: 32
    });

    if (block) {
        try {
            await bot.pathfinder.setGoal(new goals.GoalLookAtBlock(block.position, bot.world));
            await bot.dig(block);
            const seed = bot.inventory.items().find(i => i.name.includes('seed') || ['carrot', 'potato'].includes(i.name));
            if (seed) {
                await bot.equip(seed, 'hand');
                await bot.placeBlock(bot.blockAt(block.position.offset(0, -1, 0)), new vec3(0, 1, 0));
            }
        } catch (e) { console.log("Farming action interrupted"); }
    }
    setTimeout(runFarmLoop, 10000); // Check every 10 seconds
}

// --- 4. DASHBOARD SYNC ---
setInterval(() => {
    if (isConnected && bot.entity) {
        io.emit('statusUpdate', {
            online: true,
            coords: bot.entity.position,
            health: bot.health,
            food: bot.food,
            inventory: bot.inventory.items().map(i => `${i.count}x ${i.name}`)
        });
    }
}, 1000);

io.on('connection', (socket) => {
    socket.on('sendToMc', (msg) => { if(isConnected) bot.chat(msg); });
});

createBot();
server.listen(process.env.PORT || 8080);
