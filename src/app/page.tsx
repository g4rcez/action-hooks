"use client";
import { AppRouterInstance } from "next/dist/shared/lib/app-router-context.shared-runtime";
import { useRouter } from "next/navigation";
import { createGlobalReducer, useReducer } from "use-typed-reducer";
import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { stringify as toQueryString, parse as fromQs } from "qs";

type Counter = (c: number) => number;

const onChange = (e: React.ChangeEvent<HTMLInputElement>) => {
  const name = e.currentTarget.name;
  const value = e.currentTarget.value;
  return { [name]: value };
};

const fetcher = (url: string) => fetch(url).then((res) => res.json());

const API_URL = "https://restcountries.com/v3.1/all";

const getInitialState = () => {
  const qs = fromQs(window.location.search, {
    allowDots: true,
    comma: true,
    plainObjects: true,
    ignoreQueryPrefix: true,
  });
  return {
    countries: [] as any[],
    name: (qs.name as string) ?? "",
    count: qs ? Number(qs.count) : 0,
  };
};

const useComponentState = (router: AppRouterInstance) => {
  const query = useQuery({
    queryKey: ["countries"],
    queryFn: () => fetcher(API_URL),
  });
  const props = { router, countries: (query.data ?? []) as any[] };

  const [state, reducers] = useReducer(
    getInitialState(),
    (get) => {
      const fn = (op: Counter) => {
        const count = op(get.state().count);
        return { count };
      };
      return {
        onChange,
        dec: () => fn((x) => x - 1),
        inc: (_: React.MouseEvent<HTMLButtonElement>) => fn((x) => x + 1),
      };
    },
    {
      props,
      debug: true,
      middlewares: [
        (state) => {
          router.push(
            `/?${toQueryString(state, {
              allowDots: true,
              skipNulls: false,
              sort: (a, b) => a.toLowerCase().localeCompare(b.toLowerCase()),
            })}`,
          );
          return state;
        },
      ],
    },
  );
  return [state, reducers, props] as const;
};

const useGlobal = createGlobalReducer({ count: 0 }, (get) => {
  const fn = (op: Counter) => {
    const count = op(get.state().count);
    return { count };
  };
  return { inc: () => fn((c) => c + 1), dec: () => fn((c) => c - 1) };
});

const WithGlobalState = () => {
  const [state, dispatch] = useGlobal();
  const [render, setRender] = useState(0);

  useEffect(() => {
    setRender((p) => p + 1);
  }, [state]);

  return (
    <div>
      <span>Re-render: {render}</span>
      <button
        className="mx-4 px-4 py-2 border rounded-lg"
        onClick={dispatch.inc}
      >
        +1
      </button>
      <span>Total = {state.count}</span>
      <button
        className="mx-4 px-4 py-2 border rounded-lg"
        onClick={dispatch.dec}
      >
        -1
      </button>
    </div>
  );
};

export default function Local() {
  const [counter, setCounter] = useState(0);
  const [state, reducer, props] = useComponentState(useRouter());

  useEffect(() => {
    setCounter((c) => c + 1);
  }, [state]);

  return (
    <main className="flex flex-col gap-8 justify-between items-center p-8">
      <button
        className="border border-slate-400 p-4 rounded-lg"
        data-count={state.count}
        onClick={reducer.inc}
      >
        Increment = {state.count}
      </button>
      <button
        className="border border-slate-400 p-4 rounded-lg"
        data-count={state.count}
        onClick={reducer.dec}
      >
        Decrement = {state.count}
      </button>
      <input
        name="name"
        value={state.name}
        placeholder="Your name"
        onChange={reducer.onChange}
        className="border border-zinc-400 rounded-lg p-1 text-lg text-black"
      />
      <p>Countries: {props.countries.length}</p>
      <p>{counter}</p>
      <WithGlobalState />
    </main>
  );
}
