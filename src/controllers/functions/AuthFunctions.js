const { validationResult } = require('express-validator');
const jwt = require('jsonwebtoken');
const { Token } = require('../../models/Token');
const {User} = require('../../models/User');
const { createUser } = require('./UserFunctions');




/**
 * Creates a JWT with a 30-day expiry based on given user details.
 * @param {object} userDetails Object containing "_id", "isEmailVerified" and "email" keys with values that match a user.
 * @returns JWT as string.
 */
const generateJwtLongLived = function (userDetails){
    const body = { _id: userDetails._id, email: userDetails.email, isEmailVerified: userDetails.isEmailVerified};
    const token = jwt.sign({user: body, tokenType: "long"}, process.env.JWT_SECRET_LONGLIVED, {expiresIn: "30d"});
    return token;
}

/**
 * Creates a JWT with a 1-hour expiry based on given user details.
 * @param {object} userDetails Object containing "_id", "isEmailVerified" and "email" keys with values that match a user.
 * @returns JWT as string.
 */
const generateJwtShortLived = function (userDetails){
    const body = { _id: userDetails._id, email: userDetails.email, isEmailVerified: userDetails.isEmailVerified};
    const token = jwt.sign({user: body, tokenType: "short"}, process.env.JWT_SECRET_SHORTLIVED, {expiresIn: "1h"});
    return token;
}

/**
 * Creates a JWT with a 30-day expiry based on given user details.
 * Not really different to generateJwtLongLived, but makes code easier to read in complex functions.
 * @param {object} userDetails Object containing "_id", "isEmailVerified" and "email" keys with values that match a user.
 * @returns JWT as string.
 */  
const refreshJwtLongLived = function (userDetails) {
    const newToken = generateJwtLongLived(userDetails);
    return newToken;
}

/**
 * Creates a JWT with a 1-hour expiry based on given user details.
 * Not really different to generateJwtShortLived, but makes code easier to read in complex functions.
 * @param {object} userDetails Object containing "_id", "isEmailVerified" and "email" keys with values that match a user.
 * @returns JWT as string.
 */  
const refreshJwtShortLived = function (userDetails) {
    const newToken = generateJwtShortLived(userDetails);
    return newToken;
}

/**
 * Creates an object containing the two differently-expiring session JWTs about a given user. 
 * This function exists to simplify code in routes when making login/sign-up responses.
 * @param {object} userObj The Mongoose document representing the user that the tokens are being made for.
 * @returns An object containing a short-lived JWT and a long-lived JWT.
 */
const generateJwtsForUser = function (userObj){
    const tokenLL = generateJwtLongLived(userObj);
    const tokenSL = generateJwtShortLived(userObj);
    return {
        long: tokenLL, 
        short: tokenSL
    };
}



/**
 * Verifies and parses a given JWT to return its payload data as an object.
 * @param {string} userJwt A valid JWT representing a user.
 * @returns Object representing the JWT payload data.
 */
const decodeJwtLongLived = (userJwt) => {
    try {
        let decodedToken = jwt.verify(userJwt, process.env.JWT_SECRET_LONGLIVED);
        return decodedToken;
    } catch (error) {
        throw new Error("User token could not be verified. Please log in again.");
    }
}

/**
 * Verifies and parses a given JWT to return its payload data as an object.
 * @param {string} userJwt A valid JWT representing a user.
 * @returns Object representing the JWT payload data.
 */
const decodeJwtShortLived = (userJwt) => {
    try {
        let decodedToken = jwt.verify(userJwt, process.env.JWT_SECRET_SHORTLIVED);
        return decodedToken;
    } catch (error) {
        throw new Error("User token could not be verified. Please log in again.");
    }
}



const createTvLoginToken = async (request, response, next) => {
    if (!request.user){
        next(new Error("No user available to generate a TV token for."));
    }

    let newTvToken = await Token.create({userId: request.user._id, tokenType: 'tv-login'});
    console.log(`Created TV login token for user: ${JSON.stringify(newTvToken)}`);
    request.newTvCode = newTvToken.randomToken;
    next();
}

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
    generateJwtLongLived, generateJwtShortLived, generateJwtsForUser, 
    refreshJwtLongLived, refreshJwtShortLived,
    decodeJwtLongLived, decodeJwtShortLived,
    routeRequiresLongLivedJwtHeader, routeRequiresShortLivedJwtHeader,
    routeRequiresLongLivedJwtParam, routeRequiresShortLivedJwtParam,
    createTvLoginToken, verifyTvLoginToken
};