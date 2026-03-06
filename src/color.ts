const enabled =
  process.env.NO_COLOR === undefined && process.env.TERM !== "dumb";

function wrap(code: string, text: string): string {
  return enabled ? `\x1b[${code}m${text}\x1b[0m` : text;
}

export const color = {
  green: (text: string) => wrap("32", text),
  red: (text: string) => wrap("31", text),
  blue: (text: string) => wrap("34", text),
  cyan: (text: string) => wrap("36", text),
  yellow: (text: string) => wrap("33", text),
  dim: (text: string) => wrap("2", text),
  bold: (text: string) => wrap("1", text),
};
