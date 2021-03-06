export type Connectivity = "online" | "connecting" | "offline" | "crashed";

export type NetworkAdapter<Domain> = (params: {
  onChange: <K extends keyof Domain>(details: {
    kind: K;
    id: string;
    revision: string;
    value: Domain[K];
  }) => void;
  onConnectivityChange: (value: Connectivity) => void;
  onError: (error: Error) => void;
  onPushResult: <K extends keyof Domain>(
    pushId: string,
    result: PushResult<Domain[K]>
  ) => void;
}) => {
  getAndObserve: <K extends keyof Domain>(kind: K, id: string) => () => void;
  push: <K extends keyof Domain>(details: {
    kind: K;
    id: string;
    lastSeenRevision: string;
    pushId: string;
    value: Domain[K];
  }) => void;
};

export type PushResult<Kind> =
  | { newRevision: string; newValue: Kind }
  | "conflict"
  | "internalError";
