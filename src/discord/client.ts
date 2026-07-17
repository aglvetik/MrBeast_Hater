import { Client, Partials } from "discord.js";

import { PINGGUARD_INTENTS } from "./intents.js";

export function createDiscordClient(): Client {
  return new Client({
    intents: [...PINGGUARD_INTENTS],
    partials: [Partials.Channel, Partials.Message]
  });
}
