import type { BaseConfigsWithBuiltDependencies, Data } from './index.type';

/**
 * Core Utils
 */
export function mapObj<Key extends string, Value, UpdatedValue>(
  obj: Record<Key, Value>,
  fn: (value: Value, key: Key) => UpdatedValue,
): Record<Key, UpdatedValue> {
  const map: Partial<Record<Key, UpdatedValue>> = {};
  Object.entries<Value>(obj).forEach(([key, value]) => {
    map[key as Key] = fn(value, key as Key);
  });
  return map as Record<Key, UpdatedValue>;
}

export function filterObj<Key extends string, Value>(
  obj: Record<Key, Value>,
  fn: (value: Value, key: Key) => boolean,
): Record<Key, Value> {
  const filter: Partial<Record<Key, Value>> = {};
  Object.entries<Value>(obj).forEach(([key, value]) => {
    if (fn(value, key as Key)) {
      filter[key as Key] = value;
    }
  });
  return filter as Record<Key, Value>;
}

export function walkObj<Key extends string, Value>(
  obj: Record<Key, Value>,
  fn: (value: Value, key: Key) => void,
) {
  Object.entries<Value>(obj).forEach(([key, value]) => fn(value, key as Key));
}

export const identity = <T>(arg: T) => arg;

/**
 * Graph Utils
 */
export function buildDependencyMap(configMap: {
  [Key in keyof BaseConfigsWithBuiltDependencies]: Omit<
    BaseConfigsWithBuiltDependencies[Key],
    'type'
  >;
}) {
  const dependencyMap = mapObj(configMap, () => new Set<string>());

  walkObj(configMap, ({ dependencies }, key) => {
    dependencies?.forEach((dependency) => {
      dependency.keys.forEach((dependencyKey) => {
        dependencyMap[dependencyKey].add(key);
      });
    });
  });

  return dependencyMap;
}

/**
 * Merge Utils
 */
function getMergeValue(destinationValue: any, sourceValue: any) {
  if (Array.isArray(destinationValue) && Array.isArray(sourceValue)) {
    return mergeArray(destinationValue, sourceValue);
  }

  if (typeof destinationValue === 'object' && typeof sourceValue === 'object') {
    return mergeObj(destinationValue, sourceValue);
  }

  if (typeof sourceValue === 'undefined') {
    return destinationValue;
  }

  return sourceValue;
}

function mergeArray(destination: any[], source: any[]) {
  const mergedArray = [...destination];

  source.forEach((value, index) => {
    mergedArray[index] = getMergeValue(mergedArray[index], value);
  });

  return mergedArray;
}

function mergeObj(destination: Data | null, source: Data | null) {
  if (!destination || !source) return destination || source;

  const mergedObj = { ...destination };

  walkObj(source, (value, key) => {
    mergedObj[key] = getMergeValue(mergedObj[key], value);
  });

  return mergedObj;
}

export function merge(...sources: any[]) {
  return sources.reduce(getMergeValue);
}

/**
 * Deep Equals Utils
 */
export function deepEquals(a: any, b: any) {
  if (Array.isArray(a) && Array.isArray(b)) {
    if (a.length !== b.length) return false;

    for (let i = 0; i < a.length; i++) {
      if (!deepEquals(a[i], b[i])) return false;
    }

    return true;
  }

  if (typeof a === 'object' && typeof b === 'object') {
    const keysA = Object.keys(a);
    const keysB = Object.keys(b);

    if (keysA.length !== keysB.length) return false;
    if (keysA.some((key) => !keysB.includes(key))) return false;

    for (let i = 0; i < keysA.length; i++) {
      const key = keysA[i];
      if (!deepEquals(a[key], b[key])) return false;
    }

    return true;
  }

  if (Number.isNaN(a)) return Number.isNaN(b);

  return a === b;
}

/**
 * No op
 */
export function noop() {}
