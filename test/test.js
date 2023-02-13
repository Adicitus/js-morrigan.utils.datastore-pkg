const DataStore = require('../DataStore')
const assert = require('assert')
const { MongoClient } = require('mongodb')

describe('DataStore', () => {

    var MongoMemoryServer = null

    before(async () => {
        MongoMemoryServer = (await import('mongodb-memory-server')).MongoMemoryServer
    })

    describe('module', () => {

        describe('setup', () => {

            describe('Default options', () => {

                var server = null
                var rootDataStore = null
                var validationClient = null

                before(async () => {
                    server = await MongoMemoryServer.create()
                    validationClient = new MongoClient(server.getUri())
                    validationClient.connect()
                })

                it("Should return a 'root' DataStore object when initialization finishes.", async () => {

                    rootDataStore = await DataStore(server.getUri())

                    assert.ok(rootDataStore.getNamespace)
                    assert.ok(rootDataStore.getCollection)
                    assert.ok(rootDataStore.createCollection)
                    assert.ok(rootDataStore.getDataStore)
                    assert.ok(rootDataStore.discard)

                    assert.equal(rootDataStore.getNamespace(), 'global')
                })

                it("Should fail to initialize if it's already been initialized", async () => {
                    try {
                        await DataStore(server.getUri())
                    } catch {
                        return
                    }

                    assert.fail("Running 'DataStore()' should have failed once the module has been initialized, but it did not.")
                })

                it(`Should use a database called '${DataStore.DEFAULT_DBNAME}'`, async () => {
                    let collection = await rootDataStore.getCollection('validation')
                    assert.equal(collection.s.namespace.db, DataStore.DEFAULT_DBNAME)
                })

                after(async () => {
                    await validationClient.close()
                    await rootDataStore.discard({dropDb: true})
                    await server.stop()
                })
            })

            describe('Custom DB name', () => {

                const dbName = 'morrigan-datastore'
                var server = null
                var validationClient = null
                var rootDataStore = null

                before(async () => {
                    server = await MongoMemoryServer.create()
                    validationClient = new MongoClient(server.getUri())
                    await validationClient.connect()
                })

                it(`Should accept options.dbName to allow naming of the database ('${dbName}')`, async () => {
                    rootDataStore = await DataStore(server.getUri(), { dbName })
                    let collection = await rootDataStore.getCollection('validation')
                    assert.equal(collection.s.namespace.db, dbName)

                })

                after(async () => {
                    await validationClient.close()
                    await rootDataStore.discard({dropDb: true})
                    await server.stop()
                })
            })
        })
    })

    describe('DataStore', () => {
        var server = null
        var rootDataStore = null

        before(async () => {
            server = await MongoMemoryServer.create()
            rootDataStore = await DataStore(server.getUri())
        })

        describe('Root DataStore', () => {

            describe('getNamespace', () => {

                it("Should return namespace 'global'", () => {
                    assert.equal(rootDataStore.getNamespace(), 'global')
                })

            })

            describe('getCollection', () => {

                const testCollectionName = 'getCollection'
                var testCollectionFullname = ""
                var testCollection = null

                before(() => {
                    testCollectionFullname = `${rootDataStore.getNamespace()}.${testCollectionName}`
                })

                it('Should always return a MongoDB collection.', async () => {
                    testCollection = await rootDataStore.getCollection(testCollectionName)
                    assert.ok(testCollection)
                    await testCollection.insertOne({ v: 'getCollection' })
                })

                it(`Should prefix the returned collection name with it's namespace ('global.${testCollectionName}').`, async () => {
                    assert.equal(testCollection.s.namespace.collection, `${rootDataStore.getNamespace()}.${testCollectionName}`)
                })

                after(async () => {
                    await testCollection.drop()
                })
            })

            describe('createCollection', () => {
                const testCollectionName = 'createCollection'
                var testCollectionFullname = ""
                var testCollection = null

                before(async () => {
                    testCollectionFullname = `${rootDataStore.getNamespace()}.${testCollectionName}`
                })

                it('Should create a new collection and return it', async () => {
                    testCollection = await rootDataStore.createCollection(testCollectionName, {})
                    await testCollection.insertOne({ v: 'createCollection' })
                })

                it("Should succeed even if no 'spec' parameter is provided", async () => {
                    testCollection = await rootDataStore.createCollection(testCollectionName)
                    await testCollection.insertOne({ v: 'createCollection' })
                })

                it("Should fail to create a collection if it already exists.", async () => {
                    testCollection = await rootDataStore.createCollection(testCollectionName)
                    await testCollection.insertOne({ v: 'createCollection' })
                    try {
                        await rootDataStore.createCollection(testCollectionName)
                    } catch (e) {
                        assert.equal(e.codeName, 'NamespaceExists')
                        return
                    }

                    assert.fail('Managed to create collection even though it should already exist.')
                })

                afterEach(async () => {
                    if (testCollection !== null) {
                        await testCollection.drop()
                        testCollection = null
                    }
                })
            })

            describe('getDataStore', () => {

                const testCollectionName = 'getDataStore'
                var testCollection = null

                const defaultStoreName = 'defaultDataStore'
                const delegateStoreName = 'delegateDataStore'
                const collectionsOnlyStoreName = 'collectionsOnlyDataStore'

                it(`Should return a '${DataStore.SCOPE_COLLECTIONSONLY}' DataStore if no scope is specified`, async () => {
                    let store = await rootDataStore.getDataStore(defaultStoreName)

                    assert.ok(store.getNamespace)
                    assert.equal(store.getNamespace(), `${rootDataStore.getNamespace()}.${defaultStoreName}`)
                    assert.ok(store.getCollection)
                    assert.ok(store.createCollection)
                    assert.equal(store.getDataStore, undefined)

                    testCollection = await store.getCollection(testCollectionName)
                    await testCollection.insertOne({ v: defaultStoreName })
                    
                    assert.equal(testCollection.s.namespace.collection, `${store.getNamespace()}.${testCollectionName}`)
                })

                it(`Should return a '${DataStore.SCOPE_DELEGATE}' DataStore if '${DataStore.SCOPE_DELEGATE}' scope is specified`, async () => {
                    let store = await rootDataStore.getDataStore(delegateStoreName, DataStore.SCOPE_DELEGATE)

                    assert.ok(store.getNamespace)
                    assert.equal(store.getNamespace(), `${rootDataStore.getNamespace()}.${delegateStoreName}`)
                    assert.ok(store.getCollection)
                    assert.ok(store.createCollection)
                    assert.ok(store.getDataStore)
                    
                    testCollection = await store.getCollection(testCollectionName)
                    await testCollection.insertOne({ v: delegateStoreName })
                    
                    assert.equal(testCollection.s.namespace.collection, `${store.getNamespace()}.${testCollectionName}`)
                })
                

                it(`Should return a '${DataStore.SCOPE_COLLECTIONSONLY}' DataStore if '${DataStore.SCOPE_COLLECTIONSONLY}' scope is specified`, async () => {
                    let store = await rootDataStore.getDataStore(collectionsOnlyStoreName, DataStore.SCOPE_COLLECTIONSONLY)

                    assert.ok(store.getNamespace)
                    assert.equal(store.getNamespace(), `${rootDataStore.getNamespace()}.${collectionsOnlyStoreName}`)
                    assert.ok(store.getCollection)
                    assert.ok(store.createCollection)
                    assert.equal(store.getDataStore, undefined)
                    
                    testCollection = await store.getCollection(testCollectionName)
                    await testCollection.insertOne({ v: collectionsOnlyStoreName })
                    
                    assert.equal(testCollection.s.namespace.collection, `${store.getNamespace()}.${testCollectionName}`)
                })

                afterEach(async () => {
                    if (testCollection !== null) {
                        await testCollection.drop()
                        testCollection = null
                    }
                })
            })
        })

        describe('Delegate DataStore', () => {

            var testDataStoreName = 'delegateDataStore'
            var delegateDataStore = null

            before(async () => {
                delegateDataStore = await rootDataStore.getDataStore(testDataStoreName, DataStore.SCOPE_DELEGATE)
            })

            describe('getNamespace', () => {

                it(`Should return namespace 'global.${testDataStoreName}'`, () => {
                    assert.equal(delegateDataStore.getNamespace(), `global.${testDataStoreName}`)
                })

            })

            describe('getCollection', () => {

                const testCollectionName = 'getCollection'
                var testCollectionFullname = ""
                var testCollection = null

                before(() => {
                    testCollectionFullname = `${delegateDataStore.getNamespace()}.${testCollectionName}`
                })

                it('Should always return a MongoDB collection.', async () => {
                    testCollection = await delegateDataStore.getCollection(testCollectionName)
                    assert.ok(testCollection)
                    await testCollection.insertOne({ v: 'getCollection' })
                })

                it(`Should prefix the returned collection name with it's namespace ('global.${testDataStoreName}.${testCollectionName}').`, async () => {
                    assert.equal(testCollection.s.namespace.collection, `${delegateDataStore.getNamespace()}.${testCollectionName}`)
                })

                after(async () => {
                    await testCollection.drop()
                })
            })

            describe('createCollection', () => {
                const testCollectionName = 'createCollection'
                var testCollectionFullname = ""
                var testCollection = null

                before(async () => {
                    testCollectionFullname = `${delegateDataStore.getNamespace()}.${testCollectionName}`
                })

                it('Should create a new collection and return it', async () => {
                    testCollection = await delegateDataStore.createCollection(testCollectionName, {})
                    await testCollection.insertOne({ v: 'createCollection' })
                })

                it("Should succeed even if no 'spec' parameter is provided", async () => {
                    testCollection = await delegateDataStore.createCollection(testCollectionName)
                    await testCollection.insertOne({ v: 'createCollection' })
                })

                it("Should fail to create a collection if it already exists.", async () => {
                    testCollection = await delegateDataStore.createCollection(testCollectionName)
                    await testCollection.insertOne({ v: 'createCollection' })
                    try {
                        await delegateDataStore.createCollection(testCollectionName)
                    } catch (e) {
                        assert.equal(e.codeName, 'NamespaceExists')
                        return
                    }

                    assert.fail('Managed to create collection even though it should already exist.')
                })

                afterEach(async () => {
                    if (testCollection !== null) {
                        await testCollection.drop()
                        testCollection = null
                    }
                })
            })
        })

        describe('CollectionsOnly DataStore', () => {
            var testDataStoreName = 'collectionsOnlyDataStore'
            var collectionsOnlyDataStore = null

            before(async () => {
                collectionsOnlyDataStore = await rootDataStore.getDataStore(testDataStoreName, DataStore.SCOPE_DELEGATE)
            })

            describe('getNamespace', () => {

                it(`Should return namespace 'global.${testDataStoreName}'`, () => {
                    assert.equal(collectionsOnlyDataStore.getNamespace(), `global.${testDataStoreName}`)
                })

            })

            describe('getCollection', () => {

                const testCollectionName = 'getCollection'
                var testCollectionFullname = ""
                var testCollection = null

                before(() => {
                    testCollectionFullname = `${collectionsOnlyDataStore.getNamespace()}.${testCollectionName}`
                })

                it('Should always return a MongoDB collection.', async () => {
                    testCollection = await collectionsOnlyDataStore.getCollection(testCollectionName)
                    assert.ok(testCollection)
                    await testCollection.insertOne({ v: 'getCollection' })
                })

                it(`Should prefix the returned collection name with it's namespace ('global.${testDataStoreName}.${testCollectionName}').`, async () => {
                    assert.equal(testCollection.s.namespace.collection, `${collectionsOnlyDataStore.getNamespace()}.${testCollectionName}`)
                })

                after(async () => {
                    await testCollection.drop()
                })
            })

            describe('createCollection', () => {
                const testCollectionName = 'createCollection'
                var testCollectionFullname = ""
                var testCollection = null

                before(async () => {
                    testCollectionFullname = `${collectionsOnlyDataStore.getNamespace()}.${testCollectionName}`
                })

                it('Should create a new collection and return it', async () => {
                    testCollection = await collectionsOnlyDataStore.createCollection(testCollectionName, {})
                    await testCollection.insertOne({ v: 'createCollection' })
                })

                it("Should succeed even if no 'spec' parameter is provided", async () => {
                    testCollection = await collectionsOnlyDataStore.createCollection(testCollectionName)
                    await testCollection.insertOne({ v: 'createCollection' })
                })

                it("Should fail to create a collection if it already exists.", async () => {
                    testCollection = await collectionsOnlyDataStore.createCollection(testCollectionName)
                    await testCollection.insertOne({ v: 'createCollection' })
                    try {
                        await collectionsOnlyDataStore.createCollection(testCollectionName)
                    } catch (e) {
                        assert.equal(e.codeName, 'NamespaceExists')
                        return
                    }

                    assert.fail('Managed to create collection even though it should already exist.')
                })

                afterEach(async () => {
                    if (testCollection !== null) {
                        await testCollection.drop()
                        testCollection = null
                    }
                })
            })
        })

        after(async () => {
            await rootDataStore.discard({ dropDb: true })
            await server.stop()
        })
    })

})