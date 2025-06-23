require('dotenv').config();
const { Telegraf, Markup } = require('telegraf');
const express = require('express');
const fetch = require('node-fetch');

const bot = new Telegraf(process.env.BOT_TOKEN);
const userState = {};

bot.start((ctx) => {
  userState[ctx.chat.id] = null;
  return ctx.reply(
    '👋 Welcome to MartialMoonCheck!\nWhat do you want to do?',
    Markup.inlineKeyboard([
      [Markup.button.callback('🔍 Analyze Token', 'analyze')],
    ])
  );
});

bot.action('analyze', (ctx) => {
  ctx.answerCbQuery();
  userState[ctx.chat.id] = 'awaiting_token_address';
  ctx.reply('📝 Send token or pair address to analyze (any chain supported by DexScreener):');
});

bot.on('text', async (ctx) => {
  const state = userState[ctx.chat.id];
  const input = ctx.message.text.trim();

  if (state !== 'awaiting_token_address') return;

  userState[ctx.chat.id] = null;
  ctx.reply(`🔍 Analyzing: ${input}...`);

  try {
    // Use DexScreener search endpoint
    const res = await fetch(`https://api.dexscreener.com/latest/dex/search?q=${input}`);
    const json = await res.json();
    const pair = json.pairs && json.pairs[0];

    if (!pair) {
      return ctx.reply('❌ Token/pair not found on DexScreener.');
    }

    // Extract core data
    const {
      chainId,
      url,
      priceUsd,
      priceChange,
      liquidity: { usd: liq },
      volume: { h24: vol24 },
      fdv,
      marketCap,
      pairCreatedAt,
      baseToken: { name, symbol },
    } = pair;

    // Format output
    const created = new Date(pairCreatedAt).toLocaleDateString();
    const msg = `
📊 *${name}* (${symbol}) on *${chainId}*
🔗 [View on DexScreener](${url})

💰 Price: $${Number(priceUsd).toFixed(6)}
📉 24h Change: ${Number(priceChange.h24).toFixed(2)}%
💧 Liquidity: $${Number(liq).toLocaleString()}
📈 Volume(24h): $${Number(vol24).toLocaleString()}
💵 Market Cap: $${Number(marketCap || fdv).toLocaleString()}
📅 Launch Date: ${created}

💡 *Advice:* ${scoreAdvice(vol24, liq, priceChange.h24)}
`;

    ctx.replyWithMarkdown(msg);
  } catch (err) {
    console.error(err);
    ctx.reply('❌ Error fetching data, please try again.');
  }
});

// Generate simple advice based on activity
function scoreAdvice(vol24, liq, change24) {
  if (vol24 > 100_000 && liq > 50_000 && change24 > 0) {
    return '🚀 Looks juicy — high activity and liquidity. DYOR.';
  }
  if (vol24 > 10_000 && liq > 10_000) {
    return '🤞 Some volume/liquidity here — proceed with caution.';
  }
  return '⚠️ Low liquidity or volume — high risk.';
}

// Start server and bot
bot.launch();
const app = express();
app.get('/', (_, res) => res.send('Bot is live.'));
app.listen(process.env.PORT || 3000);
