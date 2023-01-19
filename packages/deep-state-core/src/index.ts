import {
  mapObj,
  filterObj,
  identity,
  buildDependencyMap,
  merge,
  deepEquals,
  walkObj,
} from './utils';
import type {
  BaseConfigs,
  BaseConfigsWithBuiltDependencies,
  Data,
  Graph,
  RecursivePartial,
  Subscribers,
  Store,
  StoreSnapshot,
  DataCollection,
} from './index.type';

function buildDependencies(
  config: BaseConfigs[string],
): BaseConfigsWithBuiltDependencies[string] {
  return { ...config, dependencies: config.dependencies?.(identity) ?? [] };
}

function buildGraphNode(
  config: BaseConfigsWithBuiltDependencies[string],
  nodeKey: string,
): Graph[string] {
  let currentDependencies = config.dependencies ?? [];
  let currentData = config.data ?? {};
  let prevMergedData: Data;
  let mergedData: Data;

  return {
    get data() {
      return mergedData || currentData;
    },
    calculateNextEffects(graph) {
      mergedData = currentData;

      currentDependencies.forEach((dependency, index) => {
        const filteredGraph = filterObj(graph, (_, key) =>
          dependency.keys.includes(key),
        );
        const dataCollection = mapObj(filteredGraph, (value) => value.data);
        const dataCollectionProxy = new Proxy(dataCollection, {
          get(collection, prop) {
            if (prop in collection) return collection[prop as string];
            throw new Error(
              `To access '${prop.toString()}' in dependency ${
                index + 1
              } of '${nodeKey}' add it to the 'keys' array`,
            );
          },
        });

        if (
          typeof dependency.cond === 'function'
            ? dependency.cond(dataCollectionProxy)
            : !!dependency.cond
        ) {
          const dependencyEffects =
            typeof dependency.effects === 'function'
              ? dependency.effects(dataCollectionProxy)
              : dependency.effects;
          mergedData = merge(mergedData, dependencyEffects);
        }
      });

      if (!deepEquals(mergedData, prevMergedData)) {
        prevMergedData = mergedData;
        return true;
      }

      return false;
    },
    resetData: (data) => {
      currentData = data ?? {};
      prevMergedData = {};
      mergedData = {};
    },
    resetDependencies: (dependencies) => {
      currentDependencies = dependencies ?? [];
    },
    setData: (updater) => {
      currentData =
        typeof updater === 'function' ? updater(currentData) : updater;
    },
  };
}

function baseCreateStore<Configs extends BaseConfigs>(
  configs: Configs,
): Store<Configs> {
  const configWithBuiltDependencies = mapObj(
    configs as BaseConfigs,
    buildDependencies,
  );
  const graph: Graph = mapObj(
    configWithBuiltDependencies as BaseConfigsWithBuiltDependencies,
    buildGraphNode,
  );
  const subscribers: Subscribers = new Set();
  let dependencyMap = buildDependencyMap(
    configWithBuiltDependencies as BaseConfigsWithBuiltDependencies,
  );

  /**
   * Dependencies
   */
  function calculateDependencies(
    changedKeys: Array<keyof typeof graph> = Object.keys(graph),
  ) {
    const dependentKeysToCalculate = new Set(changedKeys);

    while (dependentKeysToCalculate.size > 0) {
      const filteredGraph = filterObj(graph, (_, key) =>
        dependentKeysToCalculate.has(key),
      );
      // calculateNextEffects returns `true` if the calculation resulted in a new set of effects
      const results = mapObj(filteredGraph, (value) =>
        value.calculateNextEffects(graph),
      );
      // Only follow a dependency chain if it changed
      const filteredResults = filterObj(results, (value) => !!value);

      dependentKeysToCalculate.clear();
      walkObj(filteredResults, (_, key) => {
        for (const dependentKey of dependencyMap[key]) {
          dependentKeysToCalculate.add(dependentKey);
        }
      });
    }
  }

  let snapshot: StoreSnapshot<Configs>;
  function updateSnapshot() {
    snapshot = mapObj(graph, (value) => value.data) as StoreSnapshot<Configs>;
  }

  /**
   * Initialize
   */
  calculateDependencies();
  updateSnapshot();

  return {
    getSnapshot() {
      return snapshot;
    },
    reset(config, { data = true, dependencies = false } = {}) {
      const configWithBuiltDependencies = mapObj(
        config as any,
        buildDependencies,
      );
      walkObj(
        configWithBuiltDependencies as BaseConfigsWithBuiltDependencies,
        (value, key) => {
          data && graph[key].resetData(value.data);
          dependencies && graph[key].resetDependencies(value.dependencies);
        },
      );
      dependencyMap = buildDependencyMap(
        configWithBuiltDependencies as BaseConfigsWithBuiltDependencies,
      );
      calculateDependencies();
      updateSnapshot();
      subscribers.forEach((subscriber) => subscriber());
    },
    update(key, updater) {
      graph[key as keyof Graph].setData(updater);
      calculateDependencies([key as keyof Graph]);
      updateSnapshot();
      subscribers.forEach((subscriber) => subscriber());
    },
    subscribe(fn) {
      subscribers.add(fn);
      return () => {
        subscribers.delete(fn);
      };
    },
  };
}

export function configureStore<Collection extends DataCollection>() {
  function createStore<
    GraphTypes extends { [GraphKey in keyof GraphTypes]: keyof Collection },
  >(config: {
    keys: {
      [GraphKey in keyof GraphTypes]: {
        type: GraphTypes[GraphKey];
        data?: Collection[GraphTypes[GraphKey]];
        dependencies?: <
          Build extends {
            <DependencyKeys extends Array<keyof GraphTypes>>(dependency: {
              keys: DependencyKeys;
              cond:
                | true
                | ((data: {
                    [DependencyKey in DependencyKeys[number]]: Collection[GraphTypes[DependencyKey]];
                  }) => boolean);
              effects:
                | RecursivePartial<Collection[GraphTypes[GraphKey]]>
                | ((data: {
                    [DependencyKey in DependencyKeys[number]]: Collection[GraphTypes[DependencyKey]];
                  }) => RecursivePartial<Collection[GraphTypes[GraphKey]]>);
            }): typeof dependency;
          },
        >(
          build: Build,
        ) => Array<{
          keys: Array<keyof GraphTypes>;
          cond: true | ((data: any) => boolean);
          effects: Record<string, any> | ((data: any) => Record<string, any>);
        }>;
      };
    };
  }) {
    return baseCreateStore(config.keys);
  }

  return createStore;
}

/* Re-export utils */
export * from './utils';

/* Re-export types */
export type {
  BaseConfigs,
  Data,
  Graph,
  RecursivePartial,
  Store,
  StoreSnapshot,
  DataCollection,
  Updater,
} from './index.type';
