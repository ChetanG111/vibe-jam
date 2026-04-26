export function loadJson(key: string): any {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return null;
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

export function saveJson(key: string, value: any) {
  localStorage.setItem(key, JSON.stringify(value));
}

