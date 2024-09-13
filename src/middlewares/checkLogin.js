const jwt = require('jsonwebtoken')
const createError = require("http-errors")
const createStatus = require('http-status')
const isLoggedIn = (req, res, next) => {
    try {
        const token = req.headers.authorization?.split(" ")[1];

        if (!token)
            throw new createError(401, 'Unauthorized')
        const decodetoken = jwt.verify(token, process.env.SECRET)
        if (!decodetoken)
    
            throw new createError(401, 'Unauthorized')
        req.decodedToken = decodetoken
        next()
    }
    catch (error) {
        // Handle token verification errors
        if (error.name === 'TokenExpiredError') {
            console.log("un auho");
            throw new createError(401, 'Token expired');
        } else if (error.name === 'JsonWebTokenError') {
            console.log("un auho");
            throw new createError(401, 'Invalid token');
        } else {
            throw new createError(500, 'empty token');
        }
    }
}
module.exports = isLoggedIn;