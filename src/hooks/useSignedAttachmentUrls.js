import { useEffect, useMemo, useState } from "react";

// Both private attachment signers issue 30-minute URLs. Renew before expiry,
// retry transient failures, and refresh promptly after a suspended mobile tab.
export function useSignedAttachmentUrls(attachments, signUrl, { enabled = true } = {}) {
  const pathsKey = JSON.stringify([...new Set(attachments.map((attachment) => attachment.storage_path))].sort());
  const [cache, setCache] = useState({});
  useEffect(() => {
    const paths = JSON.parse(pathsKey);
    let active = true;
    let cacheForScope = {};
    const pending = new Set();
    setCache({});
    if (!enabled || paths.length === 0) return;

    async function refresh() {
      const now = Date.now();
      const missing = paths.filter((path) => !pending.has(path) && (!cacheForScope[path] || cacheForScope[path].retryAt <= now));
      await Promise.all(missing.map(async (path) => {
        pending.add(path);
        try {
          const url = await signUrl(path);
          if (!active) return;
          const issuedAt = Date.now();
          cacheForScope[path] = { url, expiresAt: issuedAt + 30 * 60_000, retryAt: issuedAt + 25 * 60_000 };
        } catch {
          if (!active) return;
          const previous = cacheForScope[path];
          cacheForScope[path] = { ...previous, url: previous?.expiresAt > Date.now() ? previous.url : undefined, retryAt: Date.now() + 30_000 };
        } finally {
          pending.delete(path);
          if (active) setCache({ ...cacheForScope });
        }
      }));
    }
    function refreshWhenVisible() {
      if (document.visibilityState !== "hidden") refresh();
    }
    refresh();
    const timer = window.setInterval(refreshWhenVisible, 30_000);
    window.addEventListener("focus", refreshWhenVisible);
    window.addEventListener("online", refreshWhenVisible);
    document.addEventListener("visibilitychange", refreshWhenVisible);
    return () => {
      active = false;
      window.clearInterval(timer);
      window.removeEventListener("focus", refreshWhenVisible);
      window.removeEventListener("online", refreshWhenVisible);
      document.removeEventListener("visibilitychange", refreshWhenVisible);
    };
  }, [pathsKey, signUrl, enabled]);
  return useMemo(() => Object.fromEntries(Object.entries(cache).filter(([, entry]) => entry.url).map(([path, entry]) => [path, entry.url])), [cache]);
}
