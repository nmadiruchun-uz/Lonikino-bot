require('dotenv').config();
const TelegramBot = require('node-telegram-bot-api');
const path = require('path');
const fs = require('fs');
const express = require('express');
const mongoose = require('mongoose');

const MONGO_URI = process.env.MONGO_URI || "mongodb+srv://nmadiruchun88_db_user:NLDL6jtMQmc2O2Lt@cluster0.s6hkkc1.mongodb.net/kinobot_yangi?retryWrites=true&w=majority&appName=Cluster0";
mongoose.connect(MONGO_URI).then(() => console.log('✅ MongoDB bazasiga ulandi!')).catch(err => console.error('❌ MongoDB xatosi:', err));

const BotDataSchema = new mongoose.Schema({ key: { type: String, unique: true }, data: Object });
const BotData = mongoose.model('BotData', BotDataSchema);

const token = process.env.TELEGRAM_TOKEN;
const bot = new TelegramBot(token, { polling: true });
const ADMIN_ID = 6756534512; // Faqat siz uchun

// Render uchun dashboard
const app = express();
const PORT = process.env.PORT || 3001;
app.get('/', (req, res) => res.send('Kinobot is running 24/7!'));
app.listen(PORT, () => console.log(`Dashboard listening on port ${PORT}`));

console.log('🤖 Bot muvaffaqiyatli ishga tushdi!');

const userState = {};
const fileIdsPath = path.join(__dirname, 'file_ids.json');
const usersPath = path.join(__dirname, 'users.json');

function syncToCloud() {
    const fileIds = getData(fileIdsPath);
    const users = getData(usersPath);
    BotData.findOneAndUpdate({ key: 'kinobot_data' }, { data: { fileIds, users } }, { upsert: true }).catch(()=>{});
}

async function loadFromCloud() {
    try {
        const doc = await BotData.findOne({ key: 'kinobot_data' });
        if (doc && doc.data) {
            if (doc.data.fileIds && Object.keys(doc.data.fileIds).length > 0) fs.writeFileSync(fileIdsPath, JSON.stringify(doc.data.fileIds, null, 2));
            if (doc.data.users && Object.keys(doc.data.users).length > 0) fs.writeFileSync(usersPath, JSON.stringify(doc.data.users, null, 2));
        }
    } catch(e) {}
}
loadFromCloud().then(() => console.log("☁️ Bulutdan (MongoDB) barcha ma'lumotlar olindi"));

// Ma'lumotlarni yuklash va saqlash funksiyalari
function getData(filePath) {
    try {
        if (fs.existsSync(filePath)) {
            const content = fs.readFileSync(filePath, 'utf8');
            return content ? JSON.parse(content) : {};
        }
    } catch (e) { console.error(`${filePath} yuklashda xato:`, e.message); }
    return {};
}

function saveData(filePath, key, id) {
    try {
        const data = getData(filePath);
        data[key] = id;
        fs.writeFileSync(filePath, JSON.stringify(data, null, 2));
        syncToCloud();
    } catch (e) { console.error(`${filePath} saqlashda xato:`, e.message); }
}

const mainMenu = { reply_markup: { keyboard: [['1-mavsum', '2-mavsum']], resize_keyboard: true } };
const partsKeyboard = { 
    reply_markup: { 
        keyboard: [['1-qism', '2-qism'], ['3-qism', '4-qism'], ['5-qism', '6-qism'], ['⬅️ Orqaga']], 
        resize_keyboard: true 
    } 
};

bot.onText(/\/start/, (msg) => {
    const chatId = msg.chat.id;
    const from = msg.from;
    const users = getData(usersPath);
    
    if (!users[chatId]) {
        const dateNow = new Date();
        const dateString = `${String(dateNow.getDate()).padStart(2, '0')}/${String(dateNow.getMonth() + 1).padStart(2, '0')}/${dateNow.getFullYear()} ${String(dateNow.getHours()).padStart(2, '0')}:${String(dateNow.getMinutes()).padStart(2, '0')}`;
        
        users[chatId] = {
            id: chatId,
            first_name: from.first_name || '',
            username: from.username || '',
            joined: dateNow.toISOString()
        };
        fs.writeFileSync(usersPath, JSON.stringify(users, null, 2));
        syncToCloud();
        
        const adminMsg = `👤 Foydalanuvchi:\n\n🆔 <code>${chatId}</code>\n👤 ${from.first_name || "Yo'q"}\n🌐 ${from.username ? '@' + from.username : 'yoq'}\n📅 Sana: ${dateString}`;
        bot.sendMessage(ADMIN_ID, adminMsg, {
            parse_mode: 'HTML',
            reply_markup: {
                inline_keyboard: [[{ text: "👤 Profilni ko'rish", url: `tg://user?id=${chatId}` }]]
            }
        }).catch(() => {});
    }

    const userFirstName = from.first_name || 'Foydalanuvchi';
    
    // BU YERGA O'ZINGIZGA YOQQAN STIKER ID SINI QO'YASIZ
    const salomStiker = "CAACAgIAAxkBAAE..."; 
    bot.sendSticker(chatId, salomStiker).catch(() => {});

    if (chatId === ADMIN_ID) {
        const adminMenu = {
            reply_markup: {
                keyboard: [['1-mavsum', '2-mavsum'], ['📊 Statistika', '👥 Foydalanuvchilar'], ['📨 Xabar yuborish']],
                resize_keyboard: true
            }
        };
        bot.sendMessage(chatId, `👋🏻Assalomu alaykum, ${userFirstName}!\n\n🎬 Loki seriali botiga xush kelibsiz, Admin! Mavsumni tanlang:`, adminMenu);
    } else {
        bot.sendMessage(chatId, `👋🏻Assalomu alaykum, ${userFirstName}!\n\n🎬 Loki seriali botiga xush kelibsiz! Mavsumni tanlang:`, mainMenu);
    }
});

// Admin uchun video yoki hujjat yuborilganda uning FILE_ID sini saqlash
bot.on('video', (msg) => {
    if (msg.from.id !== ADMIN_ID) return; // Faqat admin uchun
    const fileId = msg.video.file_id;
    const thumbId = msg.video.thumbnail ? msg.video.thumbnail.file_id : null;
    const caption = msg.caption; // Masalan: s1q1
    if (caption && caption.match(/s\dq\d/)) {
        const dataToSave = { id: fileId, thumb: thumbId };
        saveData(fileIdsPath, `${caption}.mkv`, dataToSave);
        const shortId = fileId.substring(0, 10) + '...' + fileId.substring(fileId.length - 10);
        bot.sendMessage(msg.chat.id, `✅ **${caption}.mkv** saqlandi!\n🆔 Yangi ID: \`${shortId}\`\n🖼 Abloshka: ${thumbId ? 'Ha' : 'Yo\'q'}`, { parse_mode: 'HTML' });
    } else {
        bot.sendMessage(msg.chat.id, `✅ Video ID: \`${fileId}\`\n\nUni saqlash uchun captionga masalan \`s1q1\` deb yozib qayta yuboring.`, { parse_mode: 'HTML' });
    }
});

bot.on('document', (msg) => {
    if (msg.from.id !== ADMIN_ID) return; // Faqat admin uchun
    if (msg.document.mime_type && msg.document.mime_type.startsWith('video/')) {
        const fileId = msg.document.file_id;
        const thumbId = msg.document.thumbnail ? msg.document.thumbnail.file_id : null;
        const caption = msg.caption;
        if (caption && caption.match(/s\dq\d/)) {
            const dataToSave = { id: fileId, thumb: thumbId };
            saveData(fileIdsPath, `${caption}.mkv`, dataToSave);
            bot.sendMessage(msg.chat.id, `✅ **${caption}.mkv** ID si saqlandi!`, { parse_mode: 'HTML' });
        } else {
            bot.sendMessage(msg.chat.id, `✅ Hujjat ID: \`${fileId}\``, { parse_mode: 'HTML' });
        }
    }
});

// Admin stiker yuborsa, uning ID sini qaytarib berish uchun (Stiker ID olish oson bo'lishiga)
bot.on('sticker', (msg) => {
    if (msg.from.id === ADMIN_ID) {
        bot.sendMessage(msg.chat.id, `✅ <b>Stiker ID:</b>\n<code>${msg.sticker.file_id}</code>\n\nShu ID ni kodning 80-qatoriga (salomStiker = "..." ichiga) kiritib qo'ying!`, { parse_mode: 'HTML' });
    }
});

bot.on('message', async (msg) => {
    const chatId = msg.chat.id;
    const text = msg.text;
    
    // Admin foydalanuvchilarga xabar yuborayotgan bo'lsa
    if (chatId === ADMIN_ID && userState[chatId] === 'broadcasting') {
        if (text === '⬅️ Bekor qilish') {
            delete userState[chatId];
            const adminMenu = { reply_markup: { keyboard: [['1-mavsum', '2-mavsum'], ['📊 Statistika', '👥 Foydalanuvchilar'], ['📨 Xabar yuborish']], resize_keyboard: true } };
            bot.sendMessage(chatId, "❌ Xabar yuborish bekor qilindi.", adminMenu);
            return;
        }
        
        const users = getData(usersPath);
        let sent = 0;
        bot.sendMessage(chatId, "⏳ Xabar hammaga yuborilmoqda, kutib turing...");
        
        for (const userId of Object.keys(users)) {
            try {
                await bot.copyMessage(userId, chatId, msg.message_id);
                sent++;
            } catch (e) {
                // ignore failed sends
            }
        }
        
        const adminMenu = { reply_markup: { keyboard: [['1-mavsum', '2-mavsum'], ['📊 Statistika', '👥 Foydalanuvchilar'], ['📨 Xabar yuborish']], resize_keyboard: true } };
        bot.sendMessage(chatId, `✅ Xabar ${sent} ta foydalanuvchiga muvaffaqiyatli yetkazildi!`, adminMenu);
        delete userState[chatId];
        return;
    }

    if (!text || text.startsWith('/')) return;

    if (text === '1-mavsum' || text === '2-mavsum') {
        userState[chatId] = text.split('-')[0];
        bot.sendMessage(chatId, `${text} qismlarini tanlang:`, partsKeyboard);
    } 
    else if (text === '⬅️ Orqaga') {
        delete userState[chatId];
        if (chatId === ADMIN_ID) {
            const adminMenu = { reply_markup: { keyboard: [['1-mavsum', '2-mavsum'], ['📊 Statistika', '👥 Foydalanuvchilar'], ['📨 Xabar yuborish']], resize_keyboard: true } };
            bot.sendMessage(chatId, "Asosiy menyu:", adminMenu);
        } else {
            bot.sendMessage(chatId, "Asosiy menyu:", mainMenu);
        }
    } 
    else if (text === '📨 Xabar yuborish' && chatId === ADMIN_ID) {
        userState[chatId] = 'broadcasting';
        bot.sendMessage(chatId, "📝 Foydalanuvchilarga yubormoqchi bo'lgan xabaringizni yozing yoki rasm, video, stiker, link jo'nating.\n\nBekor qilish uchun pasdagi tugmani bosing.", {
            reply_markup: { keyboard: [['⬅️ Bekor qilish']], resize_keyboard: true }
        });
    }
    else if (text === '📊 Statistika' && chatId === ADMIN_ID) {
        const users = getData(usersPath);
        const count = Object.keys(users).length;
        bot.sendMessage(ADMIN_ID, `📊 Jami foydalanuvchilar: ${count} ta`);
    }
    else if (text === '👥 Foydalanuvchilar' && chatId === ADMIN_ID) {
        sendUsersPage(chatId, 1);
    }
    else if (text.includes('-qism')) {
        const qNum = text.split('-')[0];
        const season = userState[chatId]; 
        console.log(`--> So'rov: Mavsum ${season}, Qism ${qNum}`);
        
        if (season) {
            const fileName = `s${season}q${qNum}.mkv`;
            const fileIds = getData(fileIdsPath);
            const captionText = `🎬 <b>"LOKI"</b>\n🇺🇿 O'zbek tilida\n📹 Serialning ${season}-mavsum ${qNum}-qismi.\n\n🤖 @Loki_kinobot`;

            if (fileIds[fileName]) {
                console.log(`--> ID topildi, yuborilmoqda: ${fileName}`);
                const sentMsg = await bot.sendMessage(chatId, `🚀 ${season}-mavsum, ${qNum}-qism yuborilmoqda...`);
                
                const fileData = typeof fileIds[fileName] === 'string' ? { id: fileIds[fileName] } : fileIds[fileName];
                const options = { 
                    caption: captionText, 
                    parse_mode: 'HTML'
                };

                try {
                    await bot.sendVideo(chatId, fileData.id, options);
                } catch (err) {
                    console.log(`!!! sendVideo xatosi: ${err.message}`);
                    try {
                        await bot.sendDocument(chatId, fileData.id, options);
                    } catch (e) {
                        console.error(`!!! sendDocument xatosi: ${e.message}`);
                        bot.sendMessage(chatId, `❌ Xatolik: ${e.message}`);
                    }
                }
                bot.deleteMessage(chatId, sentMsg.message_id).catch(() => {});
            } else {
                console.log(`--> ID topilmadi, fayldan izlanmoqda: ${fileName}`);
                const filePath = path.join(__dirname, 'videos', fileName);
                if (fs.existsSync(filePath)) {
                    const sentMsg = await bot.sendMessage(chatId, `🎬 ${season}-mavsum, ${qNum}-qism yuklanmoqda...`);
                    const options = { 
                        caption: captionText, 
                        parse_mode: 'HTML'
                    };
                    bot.sendVideo(chatId, filePath, options)
                    .then((res) => {
                        if (res.video) {
                            const thumbId = res.video.thumbnail ? res.video.thumbnail.file_id : null;
                            saveData(fileIdsPath, fileName, { id: res.video.file_id, thumb: thumbId });
                        }
                        bot.deleteMessage(chatId, sentMsg.message_id).catch(() => {});
                    })
                    .catch((error) => {
                        bot.sendMessage(chatId, `❌ Xatolik: ${error.message}`);
                        bot.deleteMessage(chatId, sentMsg.message_id).catch(() => {});
                    });
                } else {
                    bot.sendMessage(chatId, `❌ Fayl topilmadi: ${fileName}`);
                }
            }
        } else {
            bot.sendMessage(chatId, "⚠️ Iltimos, avval mavsumni tanlang (1-mavsum yoki 2-mavsum).", mainMenu);
        }
    }
});

function sendUsersPage(chatId, page, messageId = null) {
    const users = getData(usersPath);
    const userArray = Object.values(users).reverse();
    const totalUsers = userArray.length;
    const limit = 10;
    const totalPages = Math.ceil(totalUsers / limit) || 1;
    
    if (page < 1) page = 1;
    if (page > totalPages) page = totalPages;
    
    const start = (page - 1) * limit;
    const end = start + limit;
    const pageUsers = userArray.slice(start, end);
    
    const inline_keyboard = [];
    
    pageUsers.forEach(u => {
        inline_keyboard.push([{ text: `👤 ${u.first_name || 'Foydalanuvchi'}`, callback_data: `user_${u.id}` }]);
    });
    
    const paginationRow = [];
    if (page > 1) {
        paginationRow.push({ text: '⬅️ Oldingi', callback_data: `page_${page - 1}` });
    }
    paginationRow.push({ text: `📄 ${page}/${totalPages}`, callback_data: 'ignore' });
    if (page < totalPages) {
        paginationRow.push({ text: 'Keyingi ➡️', callback_data: `page_${page + 1}` });
    }
    inline_keyboard.push(paginationRow);
    
    const textStr = `👥 Bot foydalanuvchilari (${totalUsers} ta):\nSahifa: ${page} / ${totalPages}`;
    
    if (messageId) {
        bot.editMessageText(textStr, {
            chat_id: chatId,
            message_id: messageId,
            reply_markup: { inline_keyboard }
        }).catch(()=>{});
    } else {
        bot.sendMessage(chatId, textStr, {
            reply_markup: { inline_keyboard }
        });
    }
}

bot.on('callback_query', (query) => {
    const data = query.data;
    const chatId = query.message.chat.id;
    const messageId = query.message.message_id;
    
    if (chatId !== ADMIN_ID) return;
    
    if (data.startsWith('page_')) {
        const page = parseInt(data.split('_')[1]);
        sendUsersPage(chatId, page, messageId);
        bot.answerCallbackQuery(query.id).catch(()=>{});
    } 
    else if (data.startsWith('user_')) {
        const userId = data.split('_')[1];
        const users = getData(usersPath);
        const u = users[userId];
        
        if (u) {
            let joinDate = "Noma'lum";
            if (u.joined) {
                const d = new Date(u.joined);
                joinDate = `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}/${d.getFullYear()} ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
            }
            
            const adminMsg = `👤 Foydalanuvchi:\n\n🆔 <code>${u.id}</code>\n👤 ${u.first_name || "Yo'q"}\n🌐 ${u.username ? '@' + u.username : 'yoq'}\n📅 Sana: ${joinDate}`;
            bot.sendMessage(chatId, adminMsg, {
                parse_mode: 'HTML',
                reply_markup: {
                    inline_keyboard: [[{ text: "👤 Profilni ko'rish", url: `tg://user?id=${u.id}` }]]
                }
            }).catch(() => {});
        }
        bot.answerCallbackQuery(query.id).catch(()=>{});
    }
    else if (data === 'ignore') {
        bot.answerCallbackQuery(query.id).catch(()=>{});
    }
});

bot.on('polling_error', (error) => {
    // console.log('Polling xatolik:', error.code);
});
