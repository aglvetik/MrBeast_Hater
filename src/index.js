const {
  Client,
  GatewayIntentBits,
  Partials,
} = require('discord.js');
const config = require('./config');
const database = require('./database');
const { isSafeChannel } = require('./channelSafety');
const { detectSpam } = require('./detector');
const { handleDetectedSpam } = require('./actions');

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
    GatewayIntentBits.GuildMembers,
  ],
  partials: [Partials.Channel],
});

client.once('clientReady', () => {
  console.log(`Logged in as ${client.user.tag}`);
});

client.on('messageCreate', async (message) => {
  try {
    if (message.author?.bot) {
      return;
    }

    if (!message.guild || !message.member) {
      return;
    }

    if (message.guild.ownerId === message.author.id) {
      return;
    }

    if (config.ignoredChannelIds.has(message.channelId)) {
      return;
    }

    const safety = await isSafeChannel(message, config);
    if (safety.safe) {
      return;
    }

    const hasBypassRole = message.member.roles.cache.some((role) => config.bypassRoleIds.has(role.id));
    if (hasBypassRole) {
      return;
    }

    const detection = await detectSpam(message, config);

    if (!detection.detected) {
      return;
    }

    await handleDetectedSpam(message, detection, {
      client,
      config,
      database,
    });
  } catch (error) {
    console.error(`Failed to process message ${message.id}:`, error);
  }
});

process.on('unhandledRejection', (error) => {
  console.error('Unhandled promise rejection:', error);
});

database.initDatabase();
client.login(config.discordToken);
