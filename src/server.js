// Make the .env data ready for use.
// Always do this ASAP in any project that needs environment variables.
// And make sure it's called before any code tries to read environment variables.
const dotenv = require('dotenv');
dotenv.config();

// If PORT is specified, use that. Otherwise choose a random port.
const PORT = process.env.PORT || 0;

// 0.0.0.0 is a variation of localhost (still equivalent to localhost)
// that works better in some niche cases such as on WSL machines.
const HOST = '0.0.0.0';

// Import the needed packages:
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const rateLimit = require('express-rate-limit')
const mongoose = require('mongoose');


// Debug error handling, triggers on stuff like mis-used promises.
// So it's handy for troubleshooting sometimes.
// This is not related to servers, this is useful for any NodeJS application.
void process.on('unhandledRejection', (reason, p) => {
	console.log(`Things got pretty major here! Big error:\n`+ JSON.stringify(p));
	console.log(`That error happened because of:\n` + reason);
});
//


// Create an instance of a server to start configuring
const app = express(); 


// Helpful thing that some may think is clogging up their terminal when the server runs.
// But trust me: when this is deployed, this is an amazing source of info on server issues.
// It just logs info on ALL requests that the server receives.
app.use(morgan(':date Method :method, URL :url, Status :status, \nResponseBytes :res[content-length], ResponseTime :response-time ms, Referrer :referrer,\nUserAgent :user-agent'));

// Configure request content types that can be accepted by the server
app.use(express.json()); // application/json (raw JSON body content)
app.use(express.urlencoded({extended:true})); // application/x-www-form-urlencoded (HTML form objects)
// In a perfect world we would all use JSON, but it's always nice to support HTML forms just in case.

// Enable some changes to response headers to help secure the server as per:
// https://helmetjs.github.io/
app.use(helmet());

// Configure and enable CORS across the server
// This may override some Helmet defaults, 
// so this should happen _after_ the Helmet stuff.
var corsOptions = {
    origin: true,
    credentials: true,
    preflightContinue: true,
    methods: ['GET', 'POST', 'PUT', 'PATCH' , 'DELETE', 'OPTIONS']
}
app.use(cors(corsOptions));
// Enable preflight requests on all routes that receive an OPTIONS request.
// Technically covered by the above CORS config but worth really specifying.
// Read up on HTTP OPTIONS and preflighting here:
// https://developer.mozilla.org/en-US/docs/Glossary/Preflight_request 
// It's an automatic thing that may happen when some clients use the API,
// so we should support it.
// No special routing needed.
app.options('*', cors(corsOptions));


// Apply the rate limiting middleware to all requests
const limiter = rateLimit({
	windowMs: 15 * 60 * 1000, // 15 minutes
	max: 100, // Limit each IP to 100 requests per `window` (here, per 15 minutes)
    message: 'Too many requests from this IP address recently, please wait a while and try again later.',
	standardHeaders: true, // Return rate limit info in the `RateLimit-*` headers
	legacyHeaders: false, // Disable the `X-RateLimit-*` headers
})
app.use(limiter)


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
const {databaseConnector} = require('./mongooseConnector');
if (process.env.NODE_ENV != 'test'){
    databaseConnector(databaseURL).then(() => {
        console.log("Database connected successfully!");
    }).catch(error => {
        console.log(`
        Some error occurred connecting to the database! It was: 
        ${error}
        `);
    });
}




// ----------------------------------------------------------------
// ----------------------------------------------------------------
// ----------------------------------------------------------------
// Config is done, start declaring or mounting routes.

app.get('/', (request, response) => {
	console.log('ExpressJS auth API homepage received a request.');
  
	const target = process.env.NODE_ENV || 'not-yet-set';
	response.json({
		env: target,
		host: HOST,
		port: PORT
	})

});

// Return a bunch of useful details from the database connection
// Dig into each property here:
// https://mongoosejs.com/docs/api/connection.html
app.get("/databaseHealth", (request, response) => {
    let databaseState = mongoose.connection.readyState;
    let databaseName = mongoose.connection.name;
    let databaseModels = mongoose.connection.modelNames();
    let databaseHost = mongoose.connection.host;

    response.json({
        readyState: databaseState,
        dbName: databaseName,
        dbModels: databaseModels,
        dbHost: databaseHost
    })
});


// Import and mount any routers:
const usersController = require('./controllers/UserRoutes');
app.use('/users', usersController);


// Handle errors.
// This assumes all routes are written as if they were middleware, 
// eg. (request, response, next)
// And any route written that way can just call 
// next(new Error("some message"))
// at any time and it'll jump straight to here
// and have the error handled here.
app.use((error, request, response, next) => {
    console.log("Error passed to server root: " + error)
    response.status(error.status || 500);
    response.json({
        status: error.status || 500, 
        error: error.message,
        errors: error.errors
    });
});


// Note that we are NOT calling app.listen() in here.
// This is a better app architecture for CICD.
// Configure the server in one file,
// run the server in specific other files.
// eg. index.js in dev/production
// and index.test.js in test.
module.exports = {
	app, PORT, HOST
}