require('dotenv').config();
const { Telegraf, Markup } = require('telegraf');
const express = require('express');
const fetch = require('node-fetch');

const bot = new Telegraf(process.env.BOT_TOKEN);
const userState = {};

// Start command handler
bot.start((ctx) => {
  userState[ctx.chat.id] = null;
  return ctx.reply(
    '👋 Welcome to MartialMoonCheck!\n\nWhat do you want to do?',
    Markup.inlineKeyboard([
      [Markup.button.callback('🔍 Analyze Token', 'analyze')],
      [Markup.button.callback('📈 Track Token (coming soon)', 'track')],
    ])
  );
});

// Analyze button
bot.action('analyze', (ctx) => {
  ctx.answerCbQuery();
  userState[ctx.chat.id] = 'awaiting_token_address';
  ctx.reply('📝 Please send the token address you want to analyze:');
});

// Track button (coming soon)
bot.action('track', (ctx) => {
  ctx.answerCbQuery();
  ctx.reply('📈 Tracking feature coming soon...');
});

// Handle token address input
bot.on('text', async (ctx) => {
  const state = userState[ctx.chat.id];
  const text = ctx.message.text.trim();

  if (state !== 'awaiting_token_address') return;

  userState[ctx.chat.id] = null;
  ctx.reply(`🔍 Analyzing token ${text}...`);

  try {
    // 1. DEXScreener API
    const res = await fetch(`https://api.dexscreener.com/latest/dex/tokens/${text}`);
    const data = await res.json();

    if (!data.pairs || data.pairs.length === 0) {
      return ctx.reply('❌ Token not found or not supported on DEXScreener.');
    }

    const tokenData = data.pairs[0]; // Use first pair as fallback

    // 2. GoPlus Honeypot Check
    const honeypotRes = await fetch(`https://api.gopluslabs.io/api/v1/token_security/1?contract_addresses=${text}`);
    const honeypotJson = await honeypotRes.json();
    const tokenSecurity = honeypotJson.result?.[text] || {};

    const honeypot = tokenSecurity.is_honeypot === '1' ? '🚫 Honeypot' : '✅ Safe to buy';
    const buyTax = parseFloat(tokenSecurity.buy_tax) || 0;
    const sellTax = parseFloat(tokenSecurity.sell_tax) || 0;
    const liquidity = parseFloat(tokenData.liquidity?.usd || 0);
    const marketCap = parseFloat(tokenData.fdv || 0);
    const volume = parseFloat(tokenData.volume?.h24 || 0);
    const age = tokenSecurity.transfer_pausable === '1' ? 'Suspicious' : 'Unknown';
    const successProbability = calculateSuccessProbability(buyTax, sellTax, liquidity, marketCap, volume);

    const summary = `
*🔎 Token Analysis*
• Name: ${tokenData.baseToken.name} (${tokenData.baseToken.symbol})
• Honeypot: ${honeypot}
• Buy Tax: ${buyTax}%
• Sell Tax: ${sellTax}%
• Liquidity: $${liquidity.toLocaleString()}
• Market Cap: $${marketCap.toLocaleString()}
• 24h Volume: $${volume.toLocaleString()}
• Age Check: ${age}
• Success Probability: ${successProbability}

🔗 [View Chart](${tokenData.url})

💡 *Advice:* ${honeypot === '🚫 Honeypot' ? 'Avoid. High Risk.' : 'Proceed with caution. DYOR.'}
    `.trim();

    ctx.reply(summary, { parse_mode: 'Markdown' });

  } catch (err) {
    console.error('Error analyzing token:', err);
    ctx.reply('❌ Failed to fetch token data. Try again later.');
  }
});

// Probability logic
function calculateSuccessProbability(buyTax, sellTax, liquidity, marketCap, volume) {
  let score = 0;
  if (!isNaN(buyTax) && buyTax <= 5) score += 20;
  if (!isNaN(sellTax) && sellTax <= 5) score += 20;
  if (liquidity > 100000) score += 20;
  if (marketCap > 1000000) score += 20;
  if (volume > 50000) score += 20;

  if (score >= 80) return '🚀 High Potential';
  if (score >= 60) return '🤞 Possible';
  return '⚠️ Risky';
}

// Web server
const app = express();
app.get('/', (req, res) => res.send('Bot is running.'));
app.listen(process.env.PORT || 3000, () => console.log(`Server started on port ${process.env.PORT || 3000}`));

// Launch bot
bot.launch();
