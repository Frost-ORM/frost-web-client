This is the Web Client for Frost
# What is [Frost](https://frost-orm.github.io/frost-web-docs/)?

<img src="https://frost-orm.github.io/frost-web-docs/img/icon_small.png"/>

Frost is an [ORM](https://en.wikipedia.org/wiki/Object%E2%80%93relational_mapping) (Object Relational Mapping) Library that utilizes Code generation to simplify working with [Firebases's Realtime DB](https://firebase.google.com/products/realtime-database).
Frost Focuses on the relations between the database nodes and generates all the needed code for the developer to fetch these nodes with the ones related to them.
It also utilizes [ReactiveX](https://reactivex.io/) to provide the developer with observables that listen to the changes on theses nodes. And Of course provide the developer with the utilities to preform basic operations on the database.

[Full Documentation](https://frost-orm.github.io/frost-web-docs)

## Getting Started

Before we head to defining the models and the relations between them, we need to setup the project.

### What you'll need

- Firebase Database credentials to initialize the database client.
- Install the frost client package and the frost cli.
- Define the database schema and use the frost cli to generate the code from the schema

Finally you can follow the [installation guide](https://frost-orm.github.io/frost-web-docs/docs/guides/installation) and then go through the documentation.
