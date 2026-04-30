import * as Crypto from 'expo-crypto';
import * as SecureStore from 'expo-secure-store';

export type LockKey = 'lumina' | 'archive';

const STORAGE_KEY: Record<LockKey, string> = {
  lumina: 'lumina_pin_hash_v1',
  archive: 'archive_pin_hash_v1',
};

const SALT = 'luminadiary.pin.v1';

async function hashPin(pin: string) {
  return Crypto.digestStringAsync(
    Crypto.CryptoDigestAlgorithm.SHA256,
    `${SALT}:${pin}`,
  );
}

export async function setPin(key: LockKey, pin: string) {
  const hash = await hashPin(pin);
  await SecureStore.setItemAsync(STORAGE_KEY[key], hash);
}

export async function removePin(key: LockKey) {
  await SecureStore.deleteItemAsync(STORAGE_KEY[key]);
}

export async function hasPin(key: LockKey) {
  return (await SecureStore.getItemAsync(STORAGE_KEY[key])) !== null;
}

export async function verifyPin(key: LockKey, pin: string) {
  const stored = await SecureStore.getItemAsync(STORAGE_KEY[key]);
  if (!stored) return false;
  const candidate = await hashPin(pin);
  return stored === candidate;
}

export async function clearAllPins() {
  await Promise.all(
    (Object.keys(STORAGE_KEY) as LockKey[]).map((k) => removePin(k)),
  );
}
