import React from 'react';
import ReactDOM from 'react-dom/client';
import { Updater } from 'deep-state-core';
import {
  BuildDeepState,
  useDeepState,
  useDeepStateUpdate,
  type InferDeepStateFromProps,
} from './index';
import './demo.css';

type Collection = {
  'text-field': { label: string };
  'select-field': { count: number };
};

const { DeepStateProvider, buildProps, useDeepStateProviderRef } =
  BuildDeepState<Collection>({
    defaults: {
      'text-field': { label: 'name' },
      'select-field': { count: 2 },
    },
  });

const props = buildProps({
  onChange: console.log,
  keys: {
    fieldA: {
      type: 'text-field',
      data: { label: '' },
    },
    fieldB: {
      type: 'select-field',
      data: { count: 2 },
      dependencies: (buildDependency) => [
        buildDependency({
          keys: ['fieldA', 'fieldB'],
          cond: (data) => data.fieldA.label === '',
          effects: (data) => ({
            count: parseInt(data.fieldA.label) + data.fieldB.count,
          }),
        }),
      ],
    },
  },
});

function DeepStateChild<Data extends any>(props: {
  stateKey: string;
  initialData?: Data;
  render: (
    data: Data | undefined,
    update: (updater: Updater<Data>) => void,
  ) => React.ReactNode;
}) {
  const data: Data = useDeepState({
    selector: (state) => state[props.stateKey],
  });
  const update = useDeepStateUpdate();

  return (
    <>
      {props.render(data ?? props.initialData, (updater) =>
        update(props.stateKey, updater as any),
      )}
    </>
  );
}

function App() {
  const deepStateRef =
    useDeepStateProviderRef<InferDeepStateFromProps<typeof props>>();

  return (
    <DeepStateProvider ref={deepStateRef} {...props}>
      <DeepStateChild
        stateKey="fieldB"
        initialData={props.keys.fieldB.data}
        render={(data, update) => {
          return (
            <>
              <div>Field B</div>
              <div>{JSON.stringify(data, null, 2)}</div>
              <button
                onClick={() =>
                  update({ count: Math.floor(Math.random() * 100) })
                }
              >
                Change
              </button>
              <label>
                Count
                <input
                  value={data?.count}
                  onChange={(event) =>
                    deepStateRef.current?.update('fieldB', {
                      count: +event.target.value,
                    })
                  }
                />
              </label>
            </>
          );
        }}
      />
    </DeepStateProvider>
  );
}

ReactDOM.createRoot(document.getElementById('root') as HTMLElement).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);
