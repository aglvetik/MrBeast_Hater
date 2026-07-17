import { GatewayIntentBits } from "discord.js";

export const PINGGUARD_INTENTS = [
  GatewayIntentBits.Guilds,
  GatewayIntentBits.GuildMessages,
  GatewayIntentBits.MessageContent
] as const;
