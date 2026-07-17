const SNOWFLAKE_PATTERN = /^\d{5,20}$/;

export function isSnowflake(value: string): boolean {
  return SNOWFLAKE_PATTERN.test(value);
}
