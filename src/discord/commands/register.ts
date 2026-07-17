import { REST, Routes } from "discord.js";

import { loadEnvConfig } from "../../config/env.js";
import { buildApplicationCommands } from "./definitions.js";

function resolveRegistrationMode(argv: readonly string[]): "dev" | "global" {
  if (argv.includes("--dev")) {
    return "dev";
  }

  if (argv.includes("--global")) {
    return "global";
  }

  throw new Error("Pass either --dev or --global.");
}

async function main(): Promise<void> {
  const env = loadEnvConfig();
  const mode = resolveRegistrationMode(process.argv.slice(2));
  const rest = new REST({ version: "10" }).setToken(env.DISCORD_TOKEN);
  const commands = buildApplicationCommands();

  if (mode === "dev") {
    if (!env.DISCORD_DEV_GUILD_ID) {
      throw new Error("DISCORD_DEV_GUILD_ID is required for --dev registration.");
    }

    await rest.put(
      Routes.applicationGuildCommands(env.DISCORD_APPLICATION_ID, env.DISCORD_DEV_GUILD_ID),
      { body: commands }
    );
    console.log(
      `Registered ${commands.length} dev commands for guild ${env.DISCORD_DEV_GUILD_ID}.`
    );
    return;
  }

  await rest.put(Routes.applicationCommands(env.DISCORD_APPLICATION_ID), { body: commands });
  console.log(`Registered ${commands.length} global commands.`);
}

void main();
