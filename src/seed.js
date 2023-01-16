const mongoose = require('mongoose');
const {databaseConnector, databaseDisconnector} = require('./mongooseConnector');

const {User} = require('./models/User');

const dotenv = require('dotenv');
dotenv.config();

// During test, the test files have their own 
// database connection management process.
// So, we don't want to connect to the database here
// during any automated testing if NODE_ENV = test.
var databaseURL = "";
switch (process.env.NODE_ENV.toLowerCase()) {
    case "development":
        databaseURL = `mongodb://localhost:27017/${process.env.npm_package_name}-${process.env.NODE_ENV.toLowerCase()}`;
        break;
    case "production":
        databaseURL = process.env.DATABASE_URL;
        break;
    default:
        console.error("server.js will not connect to the database in the current NODE_ENV.");
        break;
}

// This functionality is a big promise-then chain.
// This is because it requires some async functionality,
// and that doesn't work without being wrapped in a function.
// Since .then(callback) lets us create functions as callbacks,
// we can just do stuff in a nice .then chain.
databaseConnector(databaseURL).then(() => {
    console.log("Database connected successfully!");
}).catch(error => {
    console.log(`
    Some error occurred connecting to the database! It was: 
    ${error}
    `);
    return error;
}).then(async () => {
    if (process.env.WIPE == "true"){
        // Get the names of all collections in the DB.
        const collections = await mongoose.connection.db.listCollections().toArray();

        // Empty the data and collections from the DB so that they no longer exist.
        collections.map((collection) => collection.name)
        .forEach(async (collectionName) => {
            mongoose.connection.db.dropCollection(collectionName);
            console.log("Dropped collection:" + collectionName);
        });
        console.log("Old DB data deleted.");
    }
}).then(async () => {
    // Users
    let users = [
        {
            email: "alex.holder@bigfootds.com",
            password: "SomePassword1",
            isEmailVerified: true
        }
    ];
    
    for (const user of users){
        await User.create(user);
    }
    let usersMade = await User.find().exec();
    console.log("Users seeded!\n" + JSON.stringify(usersMade));
    return usersMade;
}).then(async () => {
    // Disconnect from the database.
    await databaseDisconnector();
    console.log("DB seed connection closed.")
});