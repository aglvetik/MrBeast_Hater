export interface ReadinessSnapshot {
  readonly discordReady: boolean;
  readonly databaseReady: boolean;
  readonly migrationsCurrent: boolean;
}

export class ReadinessState {
  private discordReady = false;
  private databaseReady = false;
  private migrationsCurrent = false;

  public markDiscordReady(ready: boolean): void {
    this.discordReady = ready;
  }

  public markDatabaseReady(ready: boolean): void {
    this.databaseReady = ready;
  }

  public markMigrationsCurrent(current: boolean): void {
    this.migrationsCurrent = current;
  }

  public snapshot(): ReadinessSnapshot {
    return {
      discordReady: this.discordReady,
      databaseReady: this.databaseReady,
      migrationsCurrent: this.migrationsCurrent
    };
  }

  public isReady(): boolean {
    const snapshot = this.snapshot();
    return snapshot.discordReady && snapshot.databaseReady && snapshot.migrationsCurrent;
  }
}
