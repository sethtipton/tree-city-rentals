// Old prefixes remain as compatibility aliases for saved links and printed QR codes.
const PROJECT_PATH_PREFIXES = ['/turnover-tracker', '/tree-city-rentals'];

export function normalizeProjectPath(path) {
  for (const prefix of PROJECT_PATH_PREFIXES) {
    if (path === prefix || path.startsWith(`${prefix}/`) || path.startsWith(`${prefix}?`) || path.startsWith(`${prefix}#`)) {
      const suffix = path.slice(prefix.length);
      return suffix.startsWith('/') ? suffix : `/${suffix}`;
    }
  }
  return path;
}
