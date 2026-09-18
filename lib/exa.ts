import Exa from "exa-js";

const EXA_API_KEY = process.env.EXA_API_KEY;

export function getExaClient(): Exa | null {
  if (!EXA_API_KEY) return null;
  return new Exa(EXA_API_KEY);
}
