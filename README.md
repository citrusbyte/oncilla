# ![Oncilla logo](docs/images/logo/combined.png)

Client-side database for real-time and optimistic UI.

[![ISC license](https://img.shields.io/badge/license-ISC-blue.svg?style=flat-square)](https://github.com/facebook/react/blob/master/LICENSE) [![npm version](https://img.shields.io/npm/v/oncilla.svg?style=flat-square)](https://www.npmjs.com/package/oncilla) ![npm bundle size](https://img.shields.io/bundlephobia/minzip/oncilla.svg?label=size&style=flat-square) ![Unpolished](https://img.shields.io/badge/stability-unpolished-yellow.svg?style=flat-square)

Oncilla DB sits between your UI logic (i.e. React components) and your server and synchronizes the data between the two. It rerenders your views when new data arrives, and sends updates to the server in the background, allowing your UI to stay responsive. No matter what happens, whether errors or network connectivity issues arise, Oncilla will work to keep the data between your UI and the server in sync.

![Diagram: Oncilla sits between React/Vue.js/Angular and a server database](docs/images/diagram.png)

**Great developer experience.** Oncilla DB takes on complexity so that your code is as simple as possible. In React components, accessing and changing the data is synchronous and almost as easy as React’s useState.

**Great user experience.** Oncilla DB also takes on complexity so that you need not choose between your velocity and the user experience. Great user experience is the default.

**Wide flexibility.** You can use Oncilla DB with any view and persistence tooling you want. It comes at a cost of a bit more initial configuration, but that is something you setup once and forget. At the moment the primary supported tooling is React for the view and WebSockets for the server, and you still need to implement your database queries.

**Stable, but unpolished.** Oncilla DB is stable and used in production. That said, it’s a passion project limited by practicality, so many corners are as of yet unpolished, expect to contribute whenever you hit some corner cases or find missing advanced functionality.

## Usage

See [the setup guide](docs/README.md) for initial configuration.

Access and modify data with Oncilla with synchronous access.

```jsx
const [task, updateTask] = useData("tasks", taskId);
if (task === "loading") return <Spinner />;
return (
  <div>
    <input
      value={task.title}
      onChange={e => updateTask(prev => ({ ...prev, title: e.target.value }))}
    />
  </div>
);
```

A preview of how you access the information about the status of the synchronization, like whether the user is offline and whether any changes are not saved yet:

```jsx
const connectivity = useConnectivity();
return (
  <div>
    {connectivity === "offline" && <div>Offline. Changes will be saved when you go online.}
    <MyView />
  </div>;
);
```

## Alternatives

Oncilla DB has been heavily inspired by PouchDB, CouchDB, and the Offline First thinking.

PouchDB brings a lot of battle-tested power to the table, but it relies on the CouchDB protocol for replication. Oncilla allows you to define your own replication protocol that will fit your API, or use a small Oncilla WebSocket protocol that is easy to implement in whichever backend.

Another solid option is Apollo Client 2.5 with React Apollo 3. At the time of writing React Apollo 3 is nearing the release. Although Apollo is very GraphQL-oriented, there are some features on the side that allow it to talk over non-GraphQL HTTP.

---

_The oncilla is a small tiger cat on the IUCN Red List._

![Photo of an Oncilla](docs/images/barranquilla.jpg)
