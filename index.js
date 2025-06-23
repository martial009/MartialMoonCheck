require('dotenv').config();
const { Telegraf } = require('telegraf');
const express = require('express');
const fetch = require('node-fetch');

const bot = new Telegraf(process.env.BOT_TOKEN);

// Simple welcome message
bot.start((ctx) => ctx.reply('Welcome to Memecoin Analyzer! Send /analyze <token_address> to get started.'));

// Handle /analyze command
bot.command('analyze', async (ctx) => {
  const message = ctx.message.text;
  const parts = message.split(' ');
  const tokenAddress = parts[1];

  if (!tokenAddress) {
    return ctx.reply('❌ Please provide a token address.\nExample: /analyze 0x...');
  }

  ctx.reply(`🔍 Analyzing token ${tokenAddress}...`);

  try {
    // Fetch security details from GoPlus
    const goplus = await fetch(`https://api.gopluslabs.io/api/v1/token_security/1?contract_addresses=${tokenAddress}`);
    const goplusData = await goplus.json();

    const info = goplusData.result[tokenAddress];
    if (!info) {
      return ctx.reply('❌ Token not found or unsupported.');
    }

    const honeypot = info.is_honeypot === '1' ? '🚫 Honeypot' : '✅ Safe to trade';
    const ownerRenounced = info.owner_change_balance === '1' ? '❌ Owner can manipulate balance' : '✅ Owner renounced';
    const sellTax = info.sell_tax;
    const buyTax = info.buy_tax;
    const lockedLP = info.is_liquidity_locked === '1' ? '✅ Liquidity locked' : '❌ Liquidity NOT locked';

    const summary = `
🔎 Token Analysis:
- Honeypot: ${honeypot}
- Owner Renounced: ${ownerRenounced}
- Buy Tax: ${buyTax}%
- Sell Tax: ${sellTax}%
- Liquidity Lock: ${lockedLP}

💡 Advice: ${info.is_honeypot === '1' || info.owner_change_balance === '1' ? 'High risk. Avoid.' : 'Medium risk. DYOR.'}
    `;
    ctx.reply(summary);

  } catch (error) {
    console.error(error);
    ctx.reply('❌ Error fetching token info. Try again later.');
  }
});

// Launch bot
bot.launch();

// Keep-alive server (important for free hosting)
const app = express();
app.get('/', (req, res) => res.send('Bot is running.'));
app.listen(process.env.PORT, () => console.log(`Bot server running on port ${process.env.PORT}`));
