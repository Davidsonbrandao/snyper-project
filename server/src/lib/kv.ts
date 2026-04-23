import { deleteKvValue, getKvValue, setKvValue } from "./state.js";

export async function kvGet(key: string) {
  return getKvValue(key);
}

export async function kvSet(key: string, value: unknown) {
  await setKvValue(key, value);
}

export async function kvDel(key: string) {
  await deleteKvValue(key);
}
