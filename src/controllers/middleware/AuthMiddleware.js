const { decodeJwtLongLived, decodeJwtShortLived } = require("../functions/AuthFunctions");
const { Token } = require('../../models/Token');
const { User } = require('../../models/User');
const { createUser } = require('../functions/UserFunctions');

/**
 * Middleware function that creates a new user based on provided request body data.
 * The request body should be raw JSON that includes an "email" and a "password" property.
 * This function attaches the new user document to the request, as well as a message for debugging.
 */
async function parseUserSignup(request, response, next) {
    const errors = validationResult(request);
    if (!errors.isEmpty()) {
        console.log('Signup body data errors:\n'+ JSON.stringify(errors.array()));
        let errorToReturn = new Error("Provided data was not suitable for account creation.");
        errorToReturn.status = 400;
        errorToReturn.errors = errors.array()
        next(errorToReturn);
    }

    console.log("signing up a new account now");
    try {
        const user = await createUser(email,password);
        request.message = 'New account created.';
        request.user = user;
        next();
    } catch (error) {
        next(new Error(`Signup error: ${error}`));
    }
}

/**
 * Middleware function that generates JWTs for a user based on provided request body data.
 * The request body should be raw JSON that includes an "email" and a "password" property.
 * This function attaches an object containing long-lived and short-lived JWTs to the request.
 */
async function parseUserLogin(request, response, next) {

}

/**
 * Middleware function that expects a JWT as an authorization header bearer token.
 * It verifies the JWT and generates a fresh one for further use in the middleware chain.
 */
const routeRequiresLongLivedJwtHeader = async function (request, response, next) {
    const errors = validationResult(request);
    if (!errors.isEmpty()) {
        console.log('Data errors:\n'+ JSON.stringify(errors.array()));
        let errorToReturn = new Error("Provided data was not suitable for account authentication.");
        errorToReturn.status = 403;
        errorToReturn.errors = errors.array()
        next(errorToReturn);
    }

    // Get JWT from Header
    // Split on the space so when a value given looks like:
    // "Bearer someJwtStringTokenValue"
    // You get ["Bearer", "someJwtStringTokenValue"]
    let rawJwt = request.headers.authorization.split(' ')[1];
    let decodedJwt = decodeJwtLongLived(rawJwt);

    // Get user doc matching decoded JWT user ID
    let decodedUser = await User.findById(decodedJwt._id).exec();
    
    if (!decodedUser) {
        let invalidUserError = new Error("Invalid session token, please try again later.");
        invalidUserError.status = 403;
        throw invalidUserError;
    }

    request.user = decodedUser;
    request.tokens = generateJwtsForUser(decodedUser);
    next();
}

/**
 * Middleware function that expects a JWT as an authorization header bearer token.
 * It verifies the JWT and generates a fresh one for further use in the middleware chain.
 */
const routeRequiresShortLivedJwtHeader = async function (request, response, next) {
    const errors = validationResult(request);
    if (!errors.isEmpty()) {
        console.log('Data errors:\n'+ JSON.stringify(errors.array()));
        let errorToReturn = new Error("Provided data was not suitable for account authentication.");
        errorToReturn.status = 403;
        errorToReturn.errors = errors.array()
        next(errorToReturn);
    }

    // Get JWT from Header
    // Split on the space so when a value given looks like:
    // "Bearer someJwtStringTokenValue"
    // You get ["Bearer", "someJwtStringTokenValue"]
    let rawJwt = request.headers.authorization.split(' ')[1];
    let decodedJwt = decodeJwtShortLived(rawJwt);

    // Get user doc matching decoded JWT user ID
    let decodedUser = await User.findById(decodedJwt._id).exec();
    
    if (!decodedUser) {
        let invalidUserError = new Error("Invalid session token, please try again later.");
        invalidUserError.status = 403;
        throw invalidUserError;
    }

    request.user = decodedUser;
    request.tokens = generateJwtsForUser(decodedUser);
    next();
}

/**
 * Middleware function that expects a JWT as route query param named "jwt".
 * It verifies the JWT and generates a fresh one for further use in the middleware chain.
 */
const routeRequiresLongLivedJwtParam = async function (request, response, next) {
    passport.authenticate('jwtLongLivedParam', {session: false}, (error, user, info, status) => {
        if (error) {
            let someAuthError = new Error("Something went wrong confirming your session in jwtParam, please try again later.");
            someAuthError.status = 403;
            throw someAuthError;
        }
        if (!user) {
            let invalidUserError = new Error("Invalid session token, please try again later.");
            invalidUserError.status = 403;
            throw invalidUserError;
        }

        request.user = user;
        request.tokens = generateJwtsForUser(user);
        next();
    })(request, response, next);
}

/**
 * Middleware function that expects a JWT as route query param named "jwt".
 * It verifies the JWT and generates a fresh one for further use in the middleware chain.
 */
const routeRequiresShortLivedJwtParam = function (request, response, next) {
    passport.authenticate('jwtShortLivedParam', {session: false}, (error, user, info, status) => {
        if (error) {
            let someAuthError = new Error("Something went wrong confirming your session in jwtParam, please try again later.");
            someAuthError.status = 403;
            throw someAuthError;
        }
        if (!user) {
            let invalidUserError = new Error("Invalid session token, please try again later.");
            invalidUserError.status = 403;
            throw invalidUserError;
        }

        request.user = user;
        request.tokens = generateJwtsForUser(user);
        next();
    })(request, response, next);
}

/**
 * Middleware function that should be used as the second step in a middleware chain.
 * Requires a user object to be attached to the request object, which should be handled by another middleware.
 * This function creates a new Token document based on the request.user and attaches that new Token to the request object.
 */
const createTvLoginToken = async (request, response, next) => {
    if (!request.user){
        next(new Error("No user available to generate a TV token for."));
    }

    let newTvToken = await Token.create({userId: request.user._id, tokenType: 'tv-login'});
    console.log(`Created TV login token for user: ${JSON.stringify(newTvToken)}`);
    request.newTvCode = newTvToken.randomToken;
    next();
}

/**
 * Middleware function to find a Token document matching the route param declared as ":code".
 * This function then generates JWTs for a matching user based on the found Token document.
 */
const verifyTvLoginToken = async (request, response, next) => {
    let providedTvCode = request.params.code;

    let matchingToken = await Token.findOneAndDelete({tokenType:'tv-login', randomToken: providedTvCode}).exec();
    if (!matchingToken) {
        next(new Error("Invalid code provided."));
    }

    let matchingUser = await User.findById(matchingToken.userId).exec();
    if (!matchingUser){
        next(new Error("No user found for that code."));
    }

    request.user = {
        "_id":matchingUser._id,
        "email":matchingUser.email,
        "isEmailVerified":matchingUser.isEmailVerified
    };
    request.tokens = generateJwtsForUser(matchingUser);
    next();
}

module.exports = {
	parseUserSignup, parseUserLogin,
	routeRequiresLongLivedJwtHeader, routeRequiresShortLivedJwtHeader,
	routeRequiresLongLivedJwtParam, routeRequiresShortLivedJwtParam,
    createTvLoginToken, verifyTvLoginToken
}