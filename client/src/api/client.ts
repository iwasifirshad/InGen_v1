async function handle<T>(res: Response): Promise<T> {
  if (!res.ok) {
    let msg = `HTTP ${res.status}`;
    try {
      const body = await res.json();
      msg = body.error || msg;
    } catch { /* ignore */ }
    throw new Error(msg);
  }
  if (res.status === 204) return undefined as T;
  return res.json();
}

export const api = {
  get: <T>(path: string) => fetch(path).then((r) => handle<T>(r)),
  post: <T>(path: string, body: unknown) =>
    fetch(path, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body)
    }).then((r) => handle<T>(r)),
  put: <T>(path: string, body: unknown) =>
    fetch(path, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body)
    }).then((r) => handle<T>(r)),
  del: (path: string) => fetch(path, { method: 'DELETE' }).then((r) => handle<void>(r)),
  upload: async (file: File): Promise<{ url: string }> => {
    const fd = new FormData();
    fd.append('image', file);
    const res = await fetch('/api/uploads', { method: 'POST', body: fd });
    return handle<{ url: string }>(res);
  }
};
