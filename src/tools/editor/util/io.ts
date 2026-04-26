export async function copyText(text: string) {
  await navigator.clipboard.writeText(text);
}

export function downloadTextFile(filename: string, text: string) {
  const blob = new Blob([text], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

export function safeJsonParse(text: string): { ok: true; value: any } | { ok: false; error: string } {
  try {
    const v = JSON.parse(text);
    return { ok: true, value: v };
  } catch (e: any) {
    return { ok: false, error: e?.message ? String(e.message) : "Invalid JSON" };
  }
}

