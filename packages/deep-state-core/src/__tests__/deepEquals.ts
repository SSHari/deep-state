import { deepEquals } from '../utils';

it.each([
  [1, 1, true],
  [1, 2, false],
  [1, '1', false],
  [0, false, false],
  [undefined, null, false],
])(
  'should handle doing a deep equals correctly for the primitives: %s | %s',
  (a, b, result) => {
    expect(deepEquals(a, b)).toBe(result);
  },
);

it.each([
  [[], [], true],
  [[1, 2, 3], [1, 2, 3], true],
  [[1, 2, 3], [1, 2], false],
  [[1, 2, 3], [1, 2, 4], false],
  [[1, 2, { name: 'test' }], [1, 2, { name: 'test' }], true],
  [[1, 2, { name: 'test' }], [1, 2, { name: 'test2' }], false],
  [[1, 2, { name: 'test' }], [1, 2, { age: 100 }], false],
  [[1, 2, [3, 4, 5]], [1, 2, [3, 4, 5]], true],
  [[1, 2, [3, 4, 5]], [1, 2, [3, 4]], false],
  [[[[[[]]]]], [[[[[]]]]], true],
  [[[[[[]]]]], [[[[[1]]]]], false],
])(
  'should handle doing a deep equals correctly for the arrays: %s | %s',
  (a, b, result) => {
    expect(deepEquals(a, b)).toBe(result);
  },
);

it.each([
  [{}, {}, true],
  [{ name: 'test' }, { name: 'test' }, true],
  [{ name: 'test' }, { name: 'test2' }, false],
  [{ name: 'test' }, { age: 100 }, false],
  [{ nums: [1, 2, 3] }, { nums: [1, 2, 3] }, true],
  [{ nums: [1, 2, 3] }, { nums: [1, 2] }, false],
  [
    { deep: { deep: { deep: { deep: 'test' } } } },
    { deep: { deep: { deep: { deep: 'test' } } } },
    true,
  ],
  [
    { deep: { deep: { deep: { deep: 'test' } } } },
    { deep: { deep: { deep: { deep: 'test2' } } } },
    false,
  ],
  [
    { deep: { deep: { deep: { deep: 'test' } } } },
    { deep: { deep: { deep: {} } } },
    false,
  ],
])(
  'should handle doing a deep equals correctly for the objects: %s | %s',
  (a, b, result) => {
    expect(deepEquals(a, b)).toBe(result);
  },
);

it.each([[NaN, NaN, true]])(
  'should handle doing a deep equals correctly for the exceptions: %s | %s',
  (a, b, result) => {
    expect(deepEquals(a, b)).toBe(result);
  },
);
