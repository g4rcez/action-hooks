"use client";
import { AppRouterInstance } from "next/dist/shared/lib/app-router-context.shared-runtime";
import { useRouter } from "next/navigation";
import { useReducer } from "../use-typed-reducer";
import { useEffect } from "react";
import useSWR from "swr";

type Counter = (c: number) => number;

const onChange = (e: React.ChangeEvent<HTMLInputElement>) => {
  const name = e.currentTarget.name;
  const value = e.currentTarget.value;
  return { [name]: value };
};

const loggerPlugin =
  (groupName: string) =>
  <State, Key, Prev extends State>(state: State, key: Key, prev: Prev) => {
    console.group(groupName);
    console.info("Update by", key);
    console.info("Previous state", prev);
    console.info(state);
    console.groupEnd();
    return state;
  };

const middleware = [loggerPlugin("useComponentState")];

const fetcher = (url: string) => fetch(url).then(res => res.json())

const useRequest = <T extends object>(url: string, initialShape: T) => {
  const { data } = useSWR(url, fetcher);
  return data || initialShape;
};

const useComponentState = (router: AppRouterInstance) => {
  const response = useRequest<any[]>(
    "https://restcountries.com/v3.1/all?fields",
    [],
  );
  const [state, reducer] = useReducer(
    { count: 0, name: "", countries: [] as any[] },
    (get) => {
      const fn = (op: Counter) => {
        const count = op(get.state().count);
        get.props().router.push(`/?count=${count}`);
        return { count };
      };

      return {
        onChange,
        countries: (countries: any[]) => ({ countries }),
        dec: () => fn((x) => x - 1),
        inc: (_: React.MouseEvent<HTMLButtonElement>) => fn((x) => x + 1),
      };
    },
    { router },
    middleware,
  );

  useEffect(() => {
    reducer.countries(response);
  }, [response]);

  return [state, reducer] as const;
};

export default function Local() {
  const [state, reducer] = useComponentState(useRouter());

  return (
    <main className="flex flex-col gap-8 justify-between items-center p-8">
      <button data-count={state.count} onClick={reducer.inc}>
        Increment = {state.count}
      </button>
      <button data-count={state.count} onClick={reducer.dec}>
        Decrement = {state.count}
      </button>
      <input
        className="border border-zinc-700 text-lg text-black"
        name="name"
        onChange={reducer.onChange}
        value={state.name}
      />
      <p>Countries: {state.countries.length}</p>
    </main>
  );
}
