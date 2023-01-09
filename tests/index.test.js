// Supertest is basically Postman for your tests - get hyped!
const request = require('supertest');

// Import your app - note the destructuring syntax.
// That will pull "app" as a standalone variable out of 
// the "exports" object from our index.js file.
var {app} = require('../src/server');


// establish a connection to the database 
const {databaseConnector, databaseDisconnector} = require('../src/mongooseConnector');
const DATABASE_URI = process.env.DATABASE_URI || `mongodb://localhost:27017/${process.env.npm_package_name}-${process.env.NODE_ENV.toLowerCase()}`;

// set up before-tests and after-tests operations
beforeEach(async () => {
    await databaseConnector(DATABASE_URI);
});

afterEach(async () => {
    await databaseDisconnector();
});

// then we can write a tests 




// Homepage test.
describe('Home page route exists.', () => {
	test("Server 'homepage' can be viewed just fine.", async () => {
		
		const res = await request(app).get('/');
		
		expect(res.statusCode).toEqual(200);

	});
});