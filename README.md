# What is [Frost](https://frost.sami-mishal.online/)?
<div style="margin: auto 12rem; background-color: #236bfe; padding: 2rem; border-radius: 2rem">
<div style="border-radius: 100%; background-color: white; height: 13rem;width: 13rem; align-items: center; justify-content: center; display: flex; margin: auto; "><img style="height: 12rem; width: 12rem; " src="https://frost.sami-mishal.online/img/logo.svg"/></div></div>


[Frost](https://frost.sami-mishal.online/) is an [ORM](https://en.wikipedia.org/wiki/Object%E2%80%93relational_mapping) (Object Relational Mapping) Library that utilizes Typescript Decorators to simplify working with [Firebases's Realtime DB](https://firebase.google.com/products/realtime-database).
Frost Focuses on the relations between the database nodes and generates all the needed code for the developer to fetch these nodes with the ones related to them.
It also utilizes [ReactiveX](https://reactivex.io/) to provide the developer with observables that listen to the changes on theses nodes. And Of course provide the developer with the utilities to preform basic operations on the database.

[Full Documentation](https://frost.sami-mishal.online/docs)

## Getting Started

Before we head to defining the classes and the relations between them, we need to setup the project.

### What you'll need

- Decorators Support in your project. if you don't have it already **[follow this guide](https://frost.sami-mishal.online/docs/guides/decorators-support)**
- Firebase Database credentials to initialize the database client.

Finally you can follow the [installation guide](https://frost.sami-mishal.online/docs/guides/installation) and then go through the documentation or follow the [quick start guide](/docs/guides/quick-start)

## Installing the package

```bash
npm install @frost-orm/frost-web
```

## Setup

- Pass the firebase configuration object to [Frost.initialize](/api/classes/Frost#initialize) function instead of `initializeApp` function from firebase.
- Pass a map of the APIs you've defined (this explained in [Create A Node](/docs/fundamentals/create-a-node) section) as the second parameter. the key for each API should be the name that you want to access it by later on.
- This will initialize the Firebase Instance and Frost Instance along with the APIs.
- The initialize function will return an object with the properties:
  - firebaseApp: The instance returned by `initializeApp` function from Firebase Web SDK 9.
  - [keys used in the second parameter]: corresponding API instance.
  

***Frost uses Firebase Web SDK 9 internally. So the Firebase app instance is a SDK 9 instance.***


```typescript
const firebaseConfig = {
  apiKey: "...",
  authDomain: "...",
  databaseURL: "...",
  projectId: "...",
  messagingSenderId: "...",
  appId: "...",
  ...
};

export const FrostApp = Frost.initialize(firebaseConfig,{
  "users":UserApi,
  "posts":PostApi,
  "courses":CourseApi,
  "profiles":ProfileApi,
})

//highlight-start
/**
 * Shape of FrostApp
 * {
 *  firebaseApp: FirebaseApp,
 *  users: UserApi,
 *  posts: PostApi,
 *  courses: CourseApi,
 *  profiles: ProfileApi,
 * }
 * /
//highlight-end

```

To access the Firebase App Instance or the APIs Instances

```ts
import {FrostApp} from "src/database/frost.ts"
FrostApp.firebaseApp

FrostApp.users
FrostApp.posts
FrostApp.courses
FrostApp.profiles
```

or you can export each api individually

```ts
const firebaseConfig = {
  apiKey: "...",
  authDomain: "...",
  databaseURL: "...",
  projectId: "...",
  messagingSenderId: "...",
  appId: "...",
  ...
};

const FrostApp = Frost.initialize(firebaseConfig,{
  "users":UserApi,
  "posts":PostApi,
  "courses":CourseApi,
  "profiles":ProfileApi,
})
export {
  FrostApp.users as UserApi,
  FrostApp.posts as PostApi,
  FrostApp.courses as CourseApi,
  FrostApp.profiles as ProfileApi,
}
```
