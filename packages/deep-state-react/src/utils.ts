import { useCallback, useEffect, useRef } from 'react';

export function useStableCallback<T extends (...args: any[]) => any>(cb?: T) {
  const callbackRef = useRef(cb);
  useEffect(() => {
    callbackRef.current = cb;
  }, [cb]);
  return useCallback(
    (...args: Parameters<T>) => callbackRef.current?.(...args),
    [],
  );
}

export const DS_CALLBACK_ABORTED = Symbol('DEEPSTATE_USE_CALLBACK_ABORTED');

export function useCancelableCallback<T extends (...args: any[]) => any>(
  cb?: T,
) {
  const callbackRef = useRef(cb);
  const abortControllerRef = useRef<AbortController | null>(null);

  useEffect(() => {
    callbackRef.current = cb;
  }, [cb]);

  return useCallback((...args: Parameters<T>) => {
    abortControllerRef.current?.abort();
    abortControllerRef.current = new AbortController();

    return new Promise(async (resolve, reject) => {
      abortControllerRef.current?.signal.addEventListener('abort', () => {
        reject(DS_CALLBACK_ABORTED);
      });

      try {
        const result = await Promise.resolve(callbackRef.current?.(...args));
        abortControllerRef.current = null;
        resolve(result);
      } catch (err) {
        reject(err);
      }
    });
  }, []);
}

export type BaseComponent = (props: any) => JSX.Element;

export type RemoveDefaultPropsFromRequired<ComponentProps, DefaultProps> = Omit<
  ComponentProps,
  keyof DefaultProps
> & {
  [Key in keyof DefaultProps]?: DefaultProps[Key];
};

export type RequireProperty<T, U extends keyof T> = Omit<T, U> &
  Required<Pick<T, U>>;

export type MaybePromise<T> = T | Promise<T>;
