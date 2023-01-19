export type RecursivePartial<T> = {
  [P in keyof T]?: T[P] extends (infer U)[]
    ? RecursivePartial<U>[]
    : T[P] extends object
    ? RecursivePartial<T[P]>
    : T[P];
};

export type Data = Record<string, any>;

export type DataCollection = Record<string, Data>;

export type BaseConfigs = {
  [Key: string]: {
    type: any;
    data?: Data;
    dependencies?: (build: (dependency: any) => typeof dependency) => Array<{
      keys: Array<any>;
      cond?: (data: any) => boolean;
      effects: Data | ((data: any) => Data);
    }>;
  };
};

export type BaseConfigsWithBuiltDependencies = {
  [Key: string]: {
    type: any;
    data?: Data;
    dependencies?: Array<{
      keys: Array<any>;
      cond?: (data: any) => boolean;
      effects: Data | ((data: any) => Data);
    }>;
  };
};

export type Graph = {
  [x: string]: {
    readonly data: Record<string, any>;
    calculateNextEffects(graph: Graph): boolean;
    resetData: (data?: Data) => void;
    resetDependencies: (
      dependencies?: BaseConfigsWithBuiltDependencies[keyof BaseConfigsWithBuiltDependencies]['dependencies'],
    ) => void;
    setData: (updater: Updater<Data>) => void;
  };
};

export type Subscribers = Set<() => void>;

export type Updater<T extends any> = T | ((prev: T) => T);

export type StoreSnapshot<Configs extends BaseConfigs> = {
  [Key in keyof Configs]: Configs[Key]['data'];
};

export type Store<Configs extends BaseConfigs> = {
  getSnapshot(): StoreSnapshot<Configs>;
  reset(
    configs: { [Key in keyof Configs]: Omit<Configs[Key], 'type'> },
    options?: { data?: boolean; dependencies?: boolean },
  ): void;
  update<Key extends keyof Configs>(
    key: Key,
    updater: NonNullable<Updater<Configs[Key]['data']>>,
  ): void;
  subscribe(fn: () => void): () => void;
};
