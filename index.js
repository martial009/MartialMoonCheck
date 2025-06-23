require('dotenv').config();
const { Telegraf, Markup } = require('telegraf');
const express = require('express');
const fetch = require('node-fetch');

const bot = new Telegraf(process.env.BOT_TOKEN);

// In-memory user state
const userState = {};

bot.start((ctx) => {
  userState[ctx.chat.id] = null; // reset
  return ctx.reply(
    '👋 Welcome to DegenMartial!\n\nWhat do you want to do?',
    Markup.inlineKeyboard([
      [Markup.button.callback('🔍 Analyze Token', 'analyze')],
      [Markup.button.callback('📈 Track Token (coming soon)', 'track')],
    ])
  );
});

// Handle button click
bot.action('analyze', (ctx) => {
  ctx.answerCbQuery(); // closes loading
  userState[ctx.chat.id] = 'awaiting_token_address';
  ctx.reply('📝 Please send the token address you want to analyze:');
});

bot.action('track', (ctx) => {
  ctx.answerCbQuery();
  ctx.reply('📈 Tracking feature coming soon...');
});

// Handle token address message
bot.on('text', async (ctx) => {
  const state = userState[ctx.chat.id];
  const text = ctx.message.text;

  // Check if user is expected to send address
  if (state === 'awaiting_token_address') {
    userState[ctx.chat.id] = null; // reset state
    ctx.reply(`🔍 Analyzing token ${text}...`);

    try {
      const res = await fetch(`https://api.gopluslabs.io/api/v1/token_security/1?contract_addresses=${text}`);
      const data = await res.json();
      const tokenData = data.result[text];

      if (!tokenData) {
        return ctx.reply('❌ Token not found or unsupported.');
      }

      const honeypot = tokenData.is_honeypot === '1' ? '🚫 Honeypot' : '✅ Safe to trade';
      const ownerRenounced = tokenData.owner_change_balance === '1' ? '❌ Owner can manipulate balance' : '✅ Owner renounced';
      const sellTax = tokenData.sell_tax;
      const buyTax = tokenData.buy_tax;
      const lockedLP = tokenData.is_liquidity_locked === '1' ? '✅ Liquidity locked' : '❌ Liquidity NOT locked';

      const summary = `
🔎 Token Analysis:
- Honeypot: ${honeypot}
- Owner Renounced: ${ownerRenounced}
- Buy Tax: ${buyTax}%
- Sell Tax: ${sellTax}%
- Liquidity Lock: ${lockedLP}

💡 Advice: ${tokenData.is_honeypot === '1' || tokenData.owner_change_balance === '1' ? 'High risk. Avoid.' : 'Medium risk. DYOR.'}
      `;
      ctx.reply(summary);

    } catch (err) {
      console.error(err);
      ctx.reply('❌ Failed to fetch token data. Try again later.');
    }
  }
});

// Launch the bot
bot.launch();

// Web server (for Render)
const app = express();
app.get('/', (req, res) => res.send('Bot is running.'));
app.listen(process.env.PORT, () => console.log(`Server started on port ${process.env.PORT}`));
