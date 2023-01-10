const { User } = require("../../models/User");
const { decodeJwtLongLived, decodeJwtShortLived } = require("../functions/AuthFunctions");


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