import NanoEvents from "nanoevents";
import WebSocket from "ws";
import { jsonSerialization } from "../serialization";
import { stringy, K, KV, Params, ValueContainer } from "./types";

export function runWebsocketServer(params: Params) {
  const { onAuthenticate, onChangeData, onRequestData } = params;
  const serialization = params.serialization || jsonSerialization;

  const events = new NanoEvents<{ change: KV }>();

  const latestCopies: { [stringy: string]: undefined | ValueContainer } = {};
  events.on("change", kv => {
    latestCopies[stringy(kv)] = kv.value;
  });

  const listeningTo: string[] = [];
  function getAndObserve(
    authz: string,
    k: K,
    f: (value: ValueContainer) => void
  ) {
    events.on("change", eventKV => {
      if (stringy(k) === stringy(eventKV)) f(eventKV.value);
    });
    if (listeningTo.includes(stringy(k))) {
      const last = latestCopies[stringy(k)];
      if (last) f(last);
      return;
    }
    listeningTo.push(stringy(k));
    onRequestData({
      authz,
      ...k,
      send: value => events.emit("change", { ...k, value })
    });
  }

  const server = new WebSocket.Server({
    port: params.port,
    server: params.server
  });

  server.on("connection", function(socket) {
    const send = (obj: {}) => {
      if (socket.readyState !== 1) return;
      socket.send(JSON.stringify(obj));
    };

    const handlers: { [action: string]: (msg: any) => void } = {
      ping: () => send({ action: "pong" }),
      auth: msg => authenticate(msg),
      push: msg => push(msg),
      subscribe: msg => subscribe(msg)
    };

    function authenticate(msg: any) {
      const { token } = msg;
      onAuthenticate({ token })
        .then(function(result) {
          send({
            action: "authResult",
            authz: result.authz,
            result: result.result
          });
        })
        .catch(function() {
          send({
            action: "authResult",
            result: "internalError"
          });
        });
    }

    function push(msg: any) {
      const { authz, kind, id, lastSeenRevision, value } = msg;
      onChangeData({
        authz,
        kind,
        lastSeenRevision,
        id,
        value: serialization.decode(value),
        send: v => events.emit("change", { kind, id, value: v })
      })
        .then(function(result) {
          send({
            action: "pushResult",
            pushId: msg.pushId,
            result: result
          });
        })
        .catch(function() {
          send({
            action: "pushResult",
            pushId: msg.pushId,
            result: "internalError"
          });
        });
    }

    function subscribe(msg: any) {
      const { authz, id, kind } = msg;
      getAndObserve(authz, { kind, id }, v =>
        send({
          action: "update",
          id,
          kind,
          revision: v.revision,
          value: serialization.encode(v.value)
        })
      );
    }

    socket.on("message", function(incomingBytes) {
      const msg = JSON.parse(incomingBytes.toString());
      const action = msg.action;
      const handler = handlers[action];
      if (!handler) return console.warn("Unrecognized message", msg);
      handler(msg);
    });
  });
}
