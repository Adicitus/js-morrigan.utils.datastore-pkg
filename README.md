# Morrigan DataStore Utility (/morrigan.utils.datastore/)

Utility module to manage the connection to MongoDB and provides namespace based access-control to collections.

## Installation

Install using npm:

```
npm install @adicitus/morrigan.utils.datastore
```

## Usage

Start by requiring the module and initializing it:

```
const serverConnectionString = <Connection string to you MongoDB server>
const DataStore = require('@adicitus/morrigan.utils.datastore')
const rootDataStore = await DataStore(serverConnectionString)
```

The module exports a function that will initialize the module by connecting using the provided connection string.

If the initializaation succeeds it will return the root DataStore instance. You NEED to capture and store this object to use the utility.

Once you have the root DataStore object, you can use the `getDataStore` method to create create child dataStores for other components of the system:

```
let childStore = await rootDataStore.getDataStore('A')


console.log(rootStore.getNamespace()) // global
console.log(childStore.getNamespace()) // global.A

let collection1Name = 'coll1'
let collection2Name = 'coll2'

console.log((await rootStore.getCollection(collection1Name)).s.namespace.collection) // global.Coll1
console.log((await childStore.getCollection(collection2Name)).s.namespace.collection) // global.A.Coll1

```

Collections names are limited to the characters a-z (case sensitive), 0-9, '_' and '-'.

In this way, any given DataStore is unable to access collections belonging to any other DataStore.

## Scopes

You can limit the amount of functionality in a DataStore object by specifying a scope when creating it:

```
let childDataStore1 = aawait rootDataStore.getDataStore('child1', 'delegate')
let childDataStore2 = aawait rootDataStore.getDataStore('child2', 'collectionsOnly')

// This will work
let childDataStore1a = await childDataStore1.getDataStore('child1a')
console.log(childDataStore1a.getNamespace()) // global.child1.child1a

// This will throw an Error, as the 'collectionsOnly' scope means that the DataStore will be created without the `getDataStore` method:
let childDataStore2a = await childDataStore1.getDataStore('child2a')

```

The scopes available at the moment are:
    - 'delegate': Allows the creation of subsequent child DataStores (see: `DataStore.SCOPE_DELEGATE`)
    - 'collectionsOnly': Only provides access to collection methods (see: `DataStore.SCOPE_COLLECTIONSONLY`)
