import React, {
  MutableRefObject,
  SetStateAction,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { useSyncExternalStoreWithSelector } from "use-sync-external-store/shim/with-selector";

export type Listener<State> = (state: State, previous: State) => void;

export type PromiseBox<T> = T | Promise<T>;

export type VoidFn<Fn extends (...any: any[]) => any> =
  ReturnType<Fn> extends Promise<any>
    ? (...a: Parameters<Fn>) => Promise<void>
    : (...a: Parameters<Fn>) => void;

export type Action<State, Props> = (
  ...args: any
) => PromiseBox<(state: State, Props: Props) => State>;

export type Dispatch<
  State,
  Props extends {},
  Fns extends { [key in keyof Fns]: Action<State, Props> },
> = {
  [R in keyof Fns]: (
    ...args: any[]
  ) => PromiseBox<(state: State, Props: Props) => State>;
};

export type MapReducers<
  State extends {},
  Props extends {},
  Reducers extends Dispatch<State, Props, Reducers>,
> = {
  [R in keyof Reducers]: VoidFn<Reducers[R]>;
};

export type ReducerArgs<State extends {}, Props extends object> = {
  state: () => State;
  props: () => Props;
  initialState: State;
  previousState: () => State;
};

export type FnMap<State> = {
  [k: string]: (...args: any[]) => PromiseBox<Partial<State>>;
};

export type MappedReducers<State extends {}, Fns extends FnMap<State>> = {
  [F in keyof Fns]: (...args: Parameters<Fns[F]>) => PromiseBox<Partial<State>>;
};

export type MapReducerReturn<State extends {}, Fns extends FnMap<State>> = {
  [F in keyof Fns]: VoidFn<Fns[F]>;
};

export type ReducerActions<State extends object, Props extends object> = (
  args: ReducerArgs<State, Props>,
) => MappedReducers<State, FnMap<State>>;

export type UseReducer<
  Selector,
  State extends {},
  Props extends {},
  Reducers extends ReducerActions<State, Props>,
> = readonly [
  state: Selector,
  dispatchers: MapReducerReturn<State, ReturnType<Reducers>>,
];

export type ReducerMiddleware<
  State extends object,
  Props extends object,
> = Array<(state: State, prev: State, debug: Debug<Props>) => State>;

export type Callback<T> = T | ((prev: T) => T);

export type DispatchCallback<T extends any> = Callback<T>;

export const isObject = <T>(obj: T) => obj && typeof obj === "object";

export const keys = Object.keys as <T>(t: T) => Array<keyof T>;

type MapArray<T, F> = { [K in keyof T]: [K, F] };
export const entries = <T extends {}, F>(t: T): MapArray<T[], F> =>
  Object.entries(t) as any;

export const isPromise = <T>(promise: any): promise is Promise<T> =>
  promise instanceof Promise;

export const isPrimitive = (a: any): a is string | number | boolean => {
  const type = typeof a;
  return (
    type === "string" ||
    type === "number" ||
    type === "bigint" ||
    type === "boolean" ||
    type === "undefined" ||
    type === null
  );
};

export const shallowCompare = (left: any, right: any): boolean => {
  if (left === right || Object.is(left, right)) return true;
  if (Array.isArray(left) && Array.isArray(right)) {
    if (left.length !== right.length) return false;
  }
  if (left && right && typeof left === "object" && typeof right === "object") {
    if (left.constructor !== right.constructor) return false;
    if (left.valueOf !== Object.prototype.valueOf)
      return left.valueOf() === right.valueOf();
    const keys = Object.keys(left);
    length = keys.length;
    if (length !== Object.keys(right).length) {
      return false;
    }
    let i = length;
    for (; i-- !== 0; ) {
      if (!Object.prototype.hasOwnProperty.call(right, keys[i])) {
        return false;
      }
    }
    i = length;
    for (let i = length; i-- !== 0; ) {
      const key = keys[i];
      if (
        !(
          isPrimitive(left[key]) &&
          isPrimitive(right[key]) &&
          right[key] === left[key]
        )
      )
        return false;
    }
    return true;
  }
  return left !== left && right !== right;
};

export const clone = <O>(instance: O) =>
  Object.assign(Object.create(Object.getPrototypeOf(instance)), instance);

export const useLegacyReducer = <
  State extends {},
  Reducers extends Dispatch<State, Props, Reducers>,
  Props extends {},
>(
  initialState: State,
  reducers: Reducers,
  props?: Props,
): [state: State, dispatch: MapReducers<State, Props, Reducers>] => {
  const [state, setState] = useState(initialState);
  const refProps = useMutable<Props>((props as never) ?? {});
  const getProps = useCallback(() => refProps.current, [refProps]);

  const dispatches = useMemo<any>(
    () =>
      entries<Reducers, Action<State, Props>>(reducers).reduce(
        (acc, [name, dispatch]) => ({
          ...acc,
          [name]: async (...params: unknown[]) => {
            const dispatcher = await dispatch(...params);
            return setState((previousState: State) =>
              dispatcher(previousState, getProps()),
            );
          },
        }),
        reducers,
      ),
    [reducers, getProps],
  );
  return [state, dispatches];
};

export const useMutable = <T extends {}>(state: T): MutableRefObject<T> => {
  const mutable = useRef(state ?? {});
  useEffect(() => void (mutable.current = state), [state]);
  return mutable;
};

export const dispatchCallback = <Prev extends any, T extends Callback<Prev>>(
  prev: Prev,
  setter: T,
) => (typeof setter === "function" ? setter(prev) : setter);

const reduce = <State extends {}>(state: State, prev: State) => {
  if (prev === state) return state;
  return state.constructor.name === Object.name ? { ...prev, ...state } : state;
};

function usePrevious<V>(value: V): V {
  const ref = useRef<V>();
  useEffect(() => {
    ref.current = value;
  }, [value]);
  return ref.current!;
}

const noopObject = {};

type Debug<Props extends object = {}> = {
  method: string;
  time: Date | number;
  props: Props;
};

const debugFunc =
  <State extends {}, Props extends object>(
    name: string,
    dispatch: (...args: any[]) => any,
    setState: React.Dispatch<SetStateAction<State>>,
    getProps: () => Props,
    debug: React.MutableRefObject<Debug<Props> | null>,
  ) =>
  (...params: any[]) => {
    const now = performance.now();
    const result = dispatch(...params);
    const set = (newState: State) => setState((prev) => reduce(newState, prev));
    if (isPromise<State>(result)) {
      return result.then((resolved) => {
        set(resolved);
        debug.current = {
          method: name,
          props: getProps(),
          time: performance.now() - now,
        };
      });
    }
    set(result);
    debug.current = {
      method: name,
      props: getProps(),
      time: performance.now() - now,
    };
  };

const optimizedFunc =
  <State extends {}, Props extends object>(
    name: string,
    dispatch: (...args: any[]) => any,
    setState: React.Dispatch<SetStateAction<State>>,
    getProps: () => Props,
    debug: React.MutableRefObject<Debug<Props> | null>,
  ) =>
  (...params: any[]) => {
    debug.current = { method: name, time: 0, props: getProps() };
    const result = dispatch(...params);
    const set = (newState: State) => setState((prev) => reduce(newState, prev));
    if (isPromise<State>(result)) {
      return result.then((resolved) => set(resolved));
    }
    return set(result);
  };

export const useReducer = <
  State extends {},
  Reducers extends ReducerActions<State, Props>,
  Props extends object,
  Middlewares extends ReducerMiddleware<State, Props>,
  UseDebug extends boolean,
>(
  initialState: State,
  reducer: Reducers,
  options?: Partial<{
    middlewares: Middlewares;
    props: Props;
    debug: UseDebug;
  }>,
): UseReducer<State, State, Props, Reducers> => {
  const [state, setState] = useState<State>(() => initialState);
  const mutableState = useMutable(state);
  const mutableProps = useMutable(options?.props ?? ({} as Props));
  const mutableReducer = useMutable(reducer);
  const middleware = useMutable<Middlewares>(
    options?.middlewares ?? ([] as unknown as Middlewares),
  );
  const savedInitialState = useRef(initialState);
  const previous = usePrevious(state);
  const previousRef = useMutable(previous);
  const debug = useRef<Debug<Props> | null>(null);

  useEffect(() => {
    if (debug.current === null) return;
    const d = debug.current!;
    middleware.current.forEach((middle) => {
      middle(state, previous, d);
    });
  }, [state, middleware, previous]);

  const [dispatchers] = useState<MapReducerReturn<State, ReturnType<Reducers>>>(
    () => {
      const getProps = () => mutableProps.current;
      const reducers = mutableReducer.current({
        props: getProps,
        state: () => mutableState.current,
        initialState: savedInitialState.current,
        previousState: () => previousRef.current,
      });
      return entries<string, any>(reducers as any).reduce(
        (acc, [name, dispatch]: any) => ({
          ...acc,
          [name]: options?.debug
            ? debugFunc(name, dispatch, setState, getProps, debug)
            : optimizedFunc(name, dispatch, setState, getProps, debug),
        }),
        {} as MapReducerReturn<State, ReturnType<Reducers>>,
      );
    },
  );
  return [state, dispatchers] as const;
};

export const createGlobalReducer = <
  State extends {},
  Reducers extends ReducerActions<State, {}>,
>(
  initialState: State,
  reducer: Reducers,
): (<
  Selector extends (state: State) => any,
  Middlewares extends ReducerMiddleware<State, {}>,
>(
  selector?: Selector,
  comparator?: (a: any, b: any) => boolean,
  middleware?: Middlewares,
) => UseReducer<
  Selector extends (state: State) => State ? State : ReturnType<Selector>,
  State,
  {},
  Reducers
>) & {
  dispatchers: MapReducerReturn<State, ReturnType<Reducers>>;
} => {
  let state = initialState;
  const getSnapshot = () => state;
  const listeners = new Set<Listener<State>>();
  const addListener = (listener: Listener<State>) => {
    listeners.add(listener);
    return () => listeners.delete(listener);
  };
  const setState = (callback: (arg: State) => State) => {
    const previousState = { ...state };
    const newState = callback(state);
    state = newState;
    listeners.forEach((exec) => exec(newState, previousState));
  };

  const args = {
    initialState,
    props: {} as any,
    state: getSnapshot,
    previousState: getSnapshot,
  };

  const dispatchers: MapReducerReturn<State, ReturnType<Reducers>> = entries(
    reducer(args),
  ).reduce<any>(
    (acc, [name, fn]: any) => ({
      ...acc,
      [name]: (...args: any[]) => {
        const result = fn(...args);
        const set = (newState: State) =>
          setState((prev) => reduce(newState, prev));
        return isPromise<State>(result) ? result.then(set) : set(result);
      },
    }),
    {},
  );

  const defaultSelector = (state: State) => state;

  return Object.assign(
    function useStore<
      Selector extends (state: State) => any,
      Middlewares extends ReducerMiddleware<State, {}>,
    >(
      selector?: Selector,
      comparator = shallowCompare,
      middleware?: Middlewares,
    ) {
      const state = useSyncExternalStoreWithSelector(
        addListener,
        getSnapshot,
        getSnapshot,
        selector || defaultSelector,
        comparator,
      );
      const previous = usePrevious(state);
      useEffect(() => {
        if (!middleware) return;
        middleware.forEach((middle) => {
          middle(state, previous, { method: "@globalState@", time: -1, props: {} });
        });
      }, [state, previous]);
      return [state, dispatchers] as const;
    },
    { dispatchers },
  );
};

export const logger =
  (groupName: string) =>
  <State, Props extends object>(
    state: State,
    prev: State,
    debug: Debug<Props>,
  ) => {
    console.group(groupName);
    console.info(
      `%cAction %c- "${debug.method}" ${debug.time}ms\n`,
      "color: gold",
      "color: white",
      prev,
    );
    console.info("%cPrevious state\n", "color: silver", prev);
    console.info("%cCurrent state\n", "color: green", state);
    console.info("Props\n", debug.props);
    console.groupEnd();
    return state;
  };

export const storage =
  (name: string, storage: typeof sessionStorage | typeof localStorage) =>
  <State>(state: State) => {
    storage.setItem(name, JSON.stringify(state));
    return state;
  };
