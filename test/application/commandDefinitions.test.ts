import { describe, expect, it } from "vitest";
import { ApplicationCommandOptionType } from "discord.js";

import { buildApplicationCommands } from "../../src/discord/commands/definitions.js";

type CommandOption = {
  readonly name: string;
  readonly required?: boolean;
  readonly type: ApplicationCommandOptionType;
  readonly options?: readonly CommandOption[];
};

function collectRequiredOrderingViolations(
  options: readonly CommandOption[],
  path: string
): string[] {
  const violations: string[] = [];
  const containsLeafOptions = options.some(
    (option) =>
      option.type !== ApplicationCommandOptionType.Subcommand &&
      option.type !== ApplicationCommandOptionType.SubcommandGroup
  );

  if (containsLeafOptions) {
    let sawOptional = false;
    for (const option of options) {
      if (option.required === true) {
        if (sawOptional) {
          violations.push(`${path}.${option.name}`);
        }
      } else {
        sawOptional = true;
      }
    }
  }

  for (const option of options) {
    if (option.options && option.options.length > 0) {
      violations.push(
        ...collectRequiredOrderingViolations(option.options, `${path}.${option.name}`)
      );
    }
  }

  return violations;
}

describe("application command definitions", () => {
  it("places required options before optional options in every serialized command", () => {
    const violations = buildApplicationCommands().flatMap((command) =>
      collectRequiredOrderingViolations(
        (command.options as readonly CommandOption[] | undefined) ?? [],
        command.name
      )
    );

    expect(violations).toEqual([]);
  });
});
