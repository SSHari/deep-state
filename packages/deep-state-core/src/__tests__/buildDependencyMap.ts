import { buildDependencyMap } from '../utils';

it('should handle building the dependency map correctly', () => {
  expect(
    buildDependencyMap({
      A: {
        data: {},
        dependencies: [{ keys: ['B'], cond: () => true, effects: {} }],
      },
      B: {
        data: {},
        dependencies: [{ keys: ['A', 'C'], cond: () => true, effects: {} }],
      },
      C: {
        data: {},
        dependencies: [
          { keys: ['A'], cond: () => true, effects: {} },
          { keys: ['B'], cond: () => true, effects: {} },
          { keys: ['B'], cond: () => true, effects: {} },
        ],
      },
      D: {
        data: {},
        dependencies: [{ keys: ['B'], cond: () => true, effects: {} }],
      },
    }),
  ).toEqual({
    A: new Set(['B', 'C']),
    B: new Set(['A', 'C', 'D']),
    C: new Set(['B']),
    D: new Set([]),
  });
});
