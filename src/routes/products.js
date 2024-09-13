const express = require('express');
const router = express.Router();
const isLoggedIn = require('../middlewares/checkLogin');
const Product = require('../models/Product');
const createError = require('http-errors')

router.get('/all', isLoggedIn, async (req, res, next) => {
    try {
        const products = await Product.find();
        return res.status(200).json({ products });
    }
    catch (err) {
        next(err)
    }
})
router.get('/getOne/:id', isLoggedIn, async (req, res, next) => {
    try {

        const productId = req.params.id;
        console.log(productId);

        if (!productId) {
            throw new createError.BadRequest("Product ID is required");
        }

        const product = await Product.findOne({ _id: productId });

        if (!product) {
            throw new createError.NotFound("Product not found");
        }
        const user = req.decodedToken
        return res.status(200).json({product,user});
    } catch (err) {
        console.log(err)
        next(err);
    }
});

router.get('/refresh', isLoggedIn, async (req, res, next) => {
    try {
        const { reference, product_Id } = req.query;

        if (!reference || !product_Id) {
            return res.status(400).json({ message: 'Missing reference or productId' });
        }

        // Verify payment and update user's information or token as needed
        const response = await axios.get(`https://api.paystack.co/transaction/verify/${reference}`, {
            headers: {
                Authorization: `Bearer ${process.env.PAYSTACK_SECRET_KEY}`,
            },
        });

        const paymentData = response.data.data;

        if (paymentData.status !== 'success') {
            return res.status(400).json({ message: 'Payment not successful' });
        }

        // Retrieve the productId from metadata
        const productId = paymentData.metadata.productId;

        // Find the user and update token or other information
        const user = await User.findOne({ email: paymentData.customer.email });
        if (!user) {
            return res.status(404).json({ message: 'User not found' });
        }

        // Update user's token or other information if necessary
        // For example, you might issue a new token here
        const token = generateNewToken(user); // Function to generate token

        // Update purchase history or other user data
        const newPurchase = {
            productId: productId,
            purchaseDate: Date.now(),
            quantity: 1, // Adjust if needed
        };

        user.purchaseHistory.push(newPurchase);
        await user.save();

        // Send response with token and message
        res.json({
            message: 'Payment verified and purchase history updated.',
            token, // Send new or updated token
        });
    } catch (error) {
        next(error);
    }
});

module.exports = router;