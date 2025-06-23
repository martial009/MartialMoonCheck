require('dotenv').config();
const { Telegraf, Markup } = require('telegraf');
const express = require('express');
const fetch = require('node-fetch');

const bot = new Telegraf(process.env.BOT_TOKEN);

// In-memory user state
const userState = {};

// Start command handler
bot.start((ctx) => {
  userState[ctx.chat.id] = null; // reset
  return ctx.reply(
    '👋 Welcome to MartialMoonCheck!\n\nWhat do you want to do?',
    Markup.inlineKeyboard([
      [Markup.button.callback('🔍 Analyze Token', 'analyze')],
      [Markup.button.callback('📈 Track Token (coming soon)', 'track')],
    ])
  );
});

// Handle "Analyze Token" button click
bot.action('analyze', (ctx) => {
  ctx.answerCbQuery(); // closes loading
  userState[ctx.chat.id] = 'awaiting_token_address';
  ctx.reply('📝 Please send the token address you want to analyze:');
});

// Handle "Track Token" button click (Coming Soon)
bot.action('track', (ctx) => {
  ctx.answerCbQuery();
  ctx.reply('📈 Tracking feature coming soon...');
});

// Handle token address input
bot.on('text', async (ctx) => {
  const state = userState[ctx.chat.id];
  const text = ctx.message.text;

  if (state === 'awaiting_token_address') {
    userState[ctx.chat.id] = null; // reset state
    ctx.reply(`🔍 Analyzing token ${text}...`);

    try {
      // Call the DEXScreener API to get token info
      const res = await fetch(`https://api.dexscreener.com/latest/dex/tokens/${text}`);
      const data = await res.json();
      const tokenData = data.data;

      if (!tokenData) {
        return ctx.reply('❌ Token not found or unsupported.');
      }

      // Check if token is a honeypot using GoPlus API or honeypot.is
      const honeypotRes = await fetch(`https://api.gopluslabs.io/api/v1/token_security/1?contract_addresses=${text}`);
      const honeypotData = await honeypotRes.json();
      const tokenSecurity = honeypotData.result[text];
      const honeypot = tokenSecurity.is_honeypot === '1' ? '🚫 Honeypot' : '✅ Safe to buy';

      // Analyze token data
      const buyTax = tokenData.buyTax || 0;
      const sellTax = tokenData.sellTax || 0;
      const liquidity = tokenData.liquidity || 0;
      const marketCap = tokenData.marketCap || 0;
      const volume = tokenData.volume || 0;
      const age = tokenData.age || 'Unknown'; // Could use launch time to determine age
      const successProbability = calculateSuccessProbability(buyTax, sellTax, liquidity, marketCap, volume);

      // Generate summary message
      const summary = `
🔎 Token Analysis for ${text}:
- Honeypot: ${honeypot}
- Buy Tax: ${buyTax}%
- Sell Tax: ${sellTax}%
- Liquidity: $${liquidity}
- Market Cap: $${marketCap}
- 24h Volume: $${volume}
- Age: ${age} days
- Success Probability: ${successProbability}

💡 Advice: ${honeypot === '🚫 Honeypot' ? 'Avoid. High Risk.' : 'Proceed with caution. DYOR.'}
      `;
      ctx.reply(summary);
    } catch (err) {
      console.error(err);
      ctx.reply('❌ Failed to fetch token data. Try again later.');
    }
  }
});

// Calculate the success probability of the token based on different factors
function calculateSuccessProbability(buyTax, sellTax, liquidity, marketCap, volume) {
  let probability = 0;

  // Apply weights for each factor (adjust as needed)
  if (buyTax <= 5) probability += 20; // Lower buy tax is good
  if (sellTax <= 5) probability += 20; // Lower sell tax is good
  if (liquidity > 100000) probability += 20; // High liquidity is good
  if (marketCap > 1000000) probability += 20; // Higher market cap is generally more stable
  if (volume > 50000) probability += 20; // High volume indicates active trading

  // Return a probability range based on calculated score
  if (probability >= 80) {
    return '🚀 High potential';
  } else if (probability >= 60) {
    return '🤞 Possible';
  } else {
    return '⚠️ Risky';
  }
}

// Web server (for Render or other hosting)
const app = express();
app.get('/', (req, res) => res.send('Bot is running.'));
app.listen(process.env.PORT, () => console.log(`Server started on port ${process.env.PORT}`));

// Launch the bot
bot.launch();

