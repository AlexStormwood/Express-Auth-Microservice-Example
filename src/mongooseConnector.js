const mongoose = require('mongoose');

// Requiring a model in specific places can help it 
// be 'initialized' even when no documents exist.
// Kinda just useful for database statistics/logging.
const {User} = require('./models/User');
const {Token} = require('./models/Token');


async function databaseConnector(databaseURL){
    await mongoose.connect(databaseURL);
}

async function databaseDisconnector(){
    await mongoose.connection.close();
}

module.exports = {
    databaseConnector,
    databaseDisconnector
}