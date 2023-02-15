const { MongoClient } = require('mongodb')

const defaultDbName = 'DataStore'

const moduleState = {
    initialized: false
}

const scopes = {
    delegate: 'delegate',
    collectionsOnly: 'collectionsOnly'
}

const namespaceFormat = /^[a-z0-9\-_]+$/i

/**
 * Generates a new DataStore API object that can be used to store data in an underlying MongoDB database.
 * @param {string} namespace Namespace that this DataStore should operate under.
 * @param {object} options Optional settings. Currently only options.scope is recognized. 
 * @returns New DataStore object.
 */
function DataStore(namespace, options) {

    let parentNameSpace = namespace

    this.getNamespace = () => {
        return parentNameSpace
    }

    /**
     * Returns a collection with the given name, under the current DataStore namespace.
     * 
     * This method will create a new collection if one does not exist.
     * 
     * See: https://mongodb.github.io/node-mongodb-native/5.0/classes/Db.html#collection
     * 
     * @param {string} name Name of the collection to create/retrieve
     * @returns A collection with the given name under the current namespace.
     */
    this.getCollection = (name) => {
        let collectionName = parentNameSpace + '.' + name
        return moduleState.database.collection(collectionName)
    }

    /**
     * Shorthand for getCollection
     */
    this.collection = this.getCollection

    /**
     * Explicitly creates a collection to the provided schema.
     * 
     * Throws an exception if the collection already exists.
     * 
     * See: https://mongodb.github.io/node-mongodb-native/5.0/classes/Db.html#createCollection
     * 
     * @param {string} name Name of the collection to create/retrieve
     * @param {object} schema Specification of how to generate the collection (see: )
     * @returns The newly created collection.
     */
    this.createCollection = async (name, schema) => {
        let collectionName = parentNameSpace + '.' + name
        return await moduleState.database.createCollection(collectionName, schema)
    }

    if (options.scope === 'delegate') {
        this.getDataStore = async (namespace, scope) => {

            if ( typeof scope === 'undefined' ) {
                scope = scopes.collectionsOnly
            }

            if (!namespaceFormat.test(namespace)) {
                throw `Invalid namespace name provided (should only contain characters a-z, 0-9, - and _): ${namespace}`
            }

            let allScopes = Object.keys(scopes)
            if (!allScopes.includes(scope)) {
                throw new Error(`Invalid scope '${scope}'. Valid scopes are: ${allScopes.join(', ')}`)
            }

            newNamespace = parentNameSpace + '.' + namespace
            return new DataStore(newNamespace, { scope })
        }
    }

    return this
}

/**
 * 
 * @param {obejct} options Optional settings. Recognizes options.dropDb, a boolean to determine if the DataStore DB should be dropped.  
 */
const resetModule = async (options) => {
    if (options && options.dropDb === true) {
        await moduleState.database.dropDatabase()
    }
    await moduleState.mongoClient.close()
    delete moduleState.mongoClient
    delete moduleState.database
    moduleState.initialized = false
}

/**
 * Initializes the module and returns the root DataStore API object that can be used to delegate access to the DB.
 * @param {string} connectionString MongoDB connection string to use when connecting to the MongoDB server.
 * @param {object} options Optional settigns. Currently only recognizes 'dbName':
 *   - dbName: Name of the database to use, deafults to 'morrigan.datastore'
 * @returns Top level DataStore forthe system. This object must be captured and stored to work with the DataStore API.
 * @throws A general exception if called more than once.
 */
module.exports = async (connectionString, options) => {
    if (moduleState.initialized) {
        throw 'Initialization call rejected: morrigan.utils.datastore has already been initialized!'
    }

    let dbName = defaultDbName
    if (options !== null && typeof options === 'object') {
        if (typeof options.dbName === 'string' && options.dbName.length >= 1) {
            dbName = options.dbName
        }
    }
    
    moduleState.mongoClient = new MongoClient(connectionString)
    await moduleState.mongoClient.connect()
    moduleState.database = await moduleState.mongoClient.db(dbName)
    moduleState.initialized = true

    // console.log((await moduleState.database.collections()))

    // Create and return root instance:
    let rootDataStore = new DataStore('global', {scope: 'delegate'})

    rootDataStore.discard = resetModule
    return rootDataStore
}

/**
 * Regular expression for valid namespace format.
 */
module.exports.VALID_NAMESPACE_FORMAT = namespaceFormat
/**
 * Scope that allows the cration of delegate DataStore objects.
 */
module.exports.SCOPE_DELEGATE = 'delegate'
/**
 * Scope that only allows the creation of collections.
 */
module.exports.SCOPE_COLLECTIONSONLY = 'collectionsOnly'
/**
 * Default name for the database to use.
 */
module.exports.DEFAULT_DBNAME = defaultDbName