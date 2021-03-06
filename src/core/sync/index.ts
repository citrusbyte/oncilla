import type { NetworkAdapter, PushResult } from "../../network/types";
import type { Data, DataKindCollection } from "../types";
import { makeConnectivity } from "./connectivity";
import { makePush } from "./push";

function makeCounters() {
  const stringify = (a: string, b: string) => `${a}-${b}`;
  const data: {
    [k: string]: { count: number; cancel: () => void };
  } = {};
  return {
    add: function (a: string, b: string, f: () => () => void) {
      const kind = stringify(a, b);

      // Cancellation is still not in the protocol,
      // so this is stub logic for now that never cancels.
      if (!data[kind]) data[kind] = { count: 1, cancel: f() };
      return () => {};

      // if (!data[kind] || data[kind].count === 0) {
      //   data[kind] = { count: 0, cancel: f() };
      // }
      // data[kind].count += 1;
      // return function() {
      //   data[kind].count -= 1;
      //   if (data[kind].count === 0) {
      //     data[kind].cancel();
      //     data[kind].cancel = () => {
      //       throw new Error(`Assertion error`);
      //     };
      //   }
      // };
    },
  };
}

type Params<Domain> = {
  canonData: Data<Domain>;
  network: NetworkAdapter<Domain>;
  onChange: (kind: keyof Domain, id: string) => void;
  onConnectivityChange: () => void;
  onError: (err: Error) => void;
  shouldCrashWrites: () => boolean;
};

export function sync<Domain>(params: Params<Domain>) {
  const {
    canonData,
    network,
    onChange,
    onConnectivityChange,
    onError,
    shouldCrashWrites,
  } = params;

  const connectivity = makeConnectivity({
    onConnectivityChange,
  });

  const pushesInFlight: {
    [id: string]: (result: PushResult<any>) => void;
  } = {};

  const net = network({
    onChange: function ({ kind, id, revision, value }) {
      const kindCollection: DataKindCollection<Domain[typeof kind]> =
        canonData[kind];
      kindCollection[id] = { revision, value };
      onChange(kind, id);
    },
    onConnectivityChange: connectivity.set,
    onError,
    onPushResult: (pushId, result) => {
      if (!pushesInFlight[pushId]) return;
      pushesInFlight[pushId](result);
      delete pushesInFlight[pushId];
    },
  });

  const push = makePush({
    canonData,
    onError: (err) => {
      connectivity.set("crashed");
      throw err;
    },
    onNetPush: (pushParams) =>
      new Promise<PushResult<Domain[any]>>((resolve) => {
        pushesInFlight[pushParams.pushId] = resolve;
        net.push(pushParams);
      }),
    onUpdate: ({ kind, id, newValue, newRevision }) => {
      const kindCollection: DataKindCollection<Domain[typeof kind]> =
        canonData[kind];
      kindCollection[id] = {
        revision: newRevision,
        value: newValue,
      };
    },
    shouldCrashWrites,
  });

  const counters = makeCounters();
  return {
    connectivity: connectivity.get,
    observe: <K extends keyof Domain>(kind: K, id: string) => {
      return counters.add(kind as string, id, function () {
        return net.getAndObserve(kind, id);
      });
    },
    push,
  };
}
