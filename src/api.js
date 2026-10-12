// Server bilan yagona aloqa nuqtasi. Xatolar ApiError sifatida, server matni bilan qaytadi.
export class ApiError extends Error {
  constructor(status, message, code) {
    super(message);
    this.status = status;
    this.code = code;
  }
}

const listeners = { change: new Set(), unauthorized: new Set() };
const emit = (type) => listeners[type].forEach((f) => f());
const on = (type) => (f) => { listeners[type].add(f); return () => listeners[type].delete(f); };
// Maʼlumot oʻzgardi — ochiq sahifalardagi soʻrovlar qayta yuklanadi
export const onChange = on("change");
// Sessiya tugadi (masalan, admin bloklagan) — foydalanuvchi chiqariladi
export const onUnauthorized = on("unauthorized");

export async function api(path, { method = "GET", body } = {}) {
  let res;
  try {
    res = await fetch(`/api${path}`, {
      method,
      credentials: "same-origin",
      headers: { "X-Requested-With": "fetch", ...(body !== undefined && { "Content-Type": "application/json" }) },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
  } catch {
    throw new ApiError(0, "Server bilan aloqa yoʻq. Internetni tekshiring.");
  }
  const data = res.status === 204 ? null : await res.json().catch(() => null);
  if (!res.ok) {
    if (res.status === 401 && !path.startsWith("/auth/")) emit("unauthorized");
    throw new ApiError(res.status, data?.error || "Kutilmagan xatolik", data?.code);
  }
  if (method !== "GET") emit("change");
  return data;
}

export const post = (path, body = {}) => api(path, { method: "POST", body });
export const patch = (path, body) => api(path, { method: "PATCH", body });
export const del = (path) => api(path, { method: "DELETE" });
