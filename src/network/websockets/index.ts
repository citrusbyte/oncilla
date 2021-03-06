import ReconnectingWebSocket from "reconnecting-websocket";
import type { NetworkAdapter } from "../types";
import { Serialization, jsonSerialization } from "./serialization";

type Params = {
  serialization?: Serialization;
  url: string;
  _socket?: ReconnectingWebSocket;
};

export * from "./memoryServer";
export { runWebsocketServer } from "./server";

export function makeWsProtocolAdapter(
  params: Params
): { adapter: NetworkAdapter<any>; auth: (token: string) => void } {
  const { url, _socket } = params;
  const serialization = params.serialization || jsonSerialization;
  const socket = _socket || new ReconnectingWebSocket(url);

  let pingTimer: ReturnType<typeof setTimeout>;
  let timeoutTimer: ReturnType<typeof setTimeout>;
  function restartPingMachine() {
    clearTimeout(pingTimer);
    clearTimeout(timeoutTimer);
    pingTimer = setTimeout(function () {
      send({ action: "ping" });
      timeoutTimer = setTimeout(() => socket.reconnect(), 15000);
    }, 15000);
  }
  restartPingMachine();

  const send = (input: {}) => {
    socket.send(JSON.stringify(input));
  };

  const messagesOnEveryReconnect: { [k: string]: any }[] = [];

  return {
    adapter: function ({
      onChange,
      onConnectivityChange,
      onError,
      onPushResult,
    }) {
      socket.onopen = () => {
        onConnectivityChange("online");
        restartPingMachine();
        messagesOnEveryReconnect.forEach(send);
      };
      socket.onclose = () => onConnectivityChange("offline");
      socket.onerror = () =>
        onError(
          new Error(
            "WebSocket error. We can’t retrieve details about the error because the browser does not provide them for security reasons."
          )
        );

      const handlers: { [action: string]: (msg: any) => void } = {
        clientError: (msg: any) => {
          onError(new Error(msg.message));
        },
        pong: () => {},
        pushResult: ({
          id,
          kind,
          newRevision,
          newValue,
          pushId,
          result,
        }: any) => {
          if (result === "success")
            onPushResult(pushId, {
              newRevision: newRevision,
              newValue: serialization.decode(newValue, { id, kind }),
            });
          else onPushResult(pushId, result);
        },
        update: ({ id, kind, revision, value }: any) =>
          onChange({
            kind,
            id,
            revision,
            value: serialization.decode(value, { id, kind }),
          }),
      };
      socket.onmessage = function (event) {
        restartPingMachine();
        const msg = JSON.parse(event.data);
        const action = msg.action;
        if (!action) return console.warn(`Unrecognized message`, msg);
        const handler = handlers[action];
        if (!handler) return console.warn(`Unrecognized message`, msg);
        handler(msg);
      };

      return {
        getAndObserve: (kind, id) => {
          const msg = { action: "subscribe", kind, id };
          if (socket.readyState === 1) send(msg);
          messagesOnEveryReconnect.push(msg);
          return () => {};
        },
        push: ({ kind, id, pushId, lastSeenRevision, value }) => {
          send({
            action: "push",
            kind,
            id,
            pushId,
            lastSeenRevision,
            value: serialization.encode(value, { id, kind: String(kind) }),
          });
        },
      };
    },
    auth: (token) => {
      const msg = { action: "auth", token };
      const currentIndex = messagesOnEveryReconnect.findIndex(
        (m) => m.action === "auth"
      );
      if (currentIndex === -1) messagesOnEveryReconnect.push(msg);
      else messagesOnEveryReconnect[currentIndex] = msg;
      if (socket.readyState === 1) send(msg);
    },
  };
}
