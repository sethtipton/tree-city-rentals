import { getResponsivePropertyImage } from '../lib/propertyImages';

export function PropertyImage({ src, alt, priority = false, eager = priority, sizes = '100vw', onError }) {
  if (!src) return null;

  return (
    <img
      {...getResponsivePropertyImage(src)}
      sizes={sizes}
      alt={alt}
      width="1024"
      height="768"
      loading={eager ? "eager" : "lazy"}
      fetchPriority={priority ? "high" : "auto"}
      decoding="async"
      onError={onError}
    />
  );
}
