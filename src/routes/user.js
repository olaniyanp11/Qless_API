const express = require("express");
const router = express.Router();
const createError = require("http-errors");
const bcrypt = require("bcrypt");
const User = require('../models/User')
const orgUser = require('../models/Organization')
const jwt = require('jsonwebtoken')
const Product = require('../models/Product');
const Organization = require("../models/Organization");
const axios = require('axios');
const Transactions = require('../models/Transactions')

router.post("/signup", async (req, res, next) => {
  try {
    console.log("started")
    let { name, email, password } = req.body;

    // Validate input fields
    if (!name || !email || !password) {
      return next(createError(400, "All fields are required"));
    }

    if (password.length < 3) {
      return next(
        createError(400, "Password must be at least 3 characters long")
      );
    }

    // Check if the email is already in use
    const existingUser = await User.findOne({ email });
    if (existingUser) {
      return next(createError(409, "Email is already registered"));
    }

    // Hash the password
    const hashedPassword = await bcrypt.hash(password, 10);
    // Create a new user
    const newUser = new User({ name, email, password: hashedPassword });
    await newUser.save();

    // Send a success response
    res.status(200).json({ message: "user saved successfully" });
  } catch (err) {
    // Handle errors
    next(err);
  }
});
router.post('/login', async (req, res, next) => {
  try {
    // Validate required fields
    const { email, password, isOrg } = req.body;
    console.log(email + password + isOrg);

    if (!email || !password) {
      next(createError(400, 'Email and password are required'));
    }
    let user, statusp;
    if (isOrg) {
      user = await orgUser.findOne({ organizationEmail: email })
      statusp = 'org'
    }
    else {
      user = await User.findOne({ email });
      statusp = 'user'
    }

    if (!user) {
      throw new createError(404, 'User not found');
    }
    const check = await bcrypt.compareSync(password, user.password)

    if (!check)
      throw new createError(401, "invalid password");

    // Generate and return a secure JWT

    const token = jwt.sign({ userId: user._id, user, statust: statusp }, process.env.SECRET, { expiresIn: '4d' });
    console.log(token)
    res.status(200).json({
      message: 'User logged in successfully',
      statusp, token
    });
  } catch (error) {
    next(error);
  }
});
router.post('/initialize-payment', async (req, res) => {
  try {
    const { productId, email } = req.query;


    // Find the product to get the organization ID
    const product = await Product.findById(productId);
    if (!product) {
      throw new Error('Product not found');
    }

    // Find the organization
    const organization = await Organization.findById(product.organizationId);
    if (!organization) {
      throw new Error('Organization not found');
    }
    const amount = product.price * 100
    let callback_url;
    if (process.env.HOSTP === 'production') {
      callback_url = process.env.CALLBACK_URL_PROD
    }
    else {
      callback_url = process.env.CALLBACK_URL_DEV
    }
    // Initialize payment with Paystack
    const response = await axios.post(
      `https://api.paystack.co/transaction/initialize`,
      {
        email,
        amount,
        callback_url
      },
      {
        headers: {
          Authorization: `Bearer ${process.env.PAYSTACK_SECRET_KEY}`,
          'Content-Type': 'application/json',
        },
      }
    );

    console.log(response.data)
    if (response.data.status && response.data.data.reference) {
      // Create a new transaction with the reference from Paystack
      const transaction = new Transactions({
        reference: response.data.data.reference, // Set the reference ID
        userEmail: email,
        productId: productId,
        status: 'pending', // Set initial status to 'pending'
      });

      // Save the transaction
      await transaction.save();
      console.log("trans");
      
      // Add a pending transaction entry to the organization
      
      organization.transactions.push({
        emails: email,
        amount: product.price, // Assuming the product's price is the transaction amount
        referenceId: transaction._id.toString(), // Use the transaction ID as the referenceId initially
        date: new Date(),
      });
      await organization.save();
      console.log(response.data.data.authorization_url);
      
      res.status(200).json({
        authorizationUrl: response.data.data.authorization_url
      });
    } else {
      throw new Error('Failed to get payment URL or reference');
    }
  } catch (error) {
    console.error('Payment initialization failed:', error);
    res.status(500).json({ message: 'Payment initialization failed' });
  }
});

router.get('/verify-payment', async (req, res, next) => {
  try {
    const { reference } = req.query;

    if (!reference) {
      throw createError.BadRequest('Missing payment reference');
    }

    // Verify the payment with Paystack
    const response = await axios.get(`https://api.paystack.co/transaction/verify/${reference}`, {
      headers: {
        Authorization: `Bearer ${process.env.PAYSTACK_SECRET_KEY}`,
      },
    });

    const paymentData = response.data.data;

    // Check if the payment was successful
    if (paymentData.status !== 'success') {
      throw createError.BadRequest('Payment not successful');
    }

    // Retrieve the corresponding transaction using the reference
    const transaction = await Transactions.findOne({ reference });
    if (!transaction) {
      throw createError.NotFound('Transaction not found');
    }

    // Find the product using the productId stored in the transaction
    const product = await Product.findById(transaction.productId);
    if (!product) {
      throw createError.NotFound('Product not found');
    }

    // Find the organization using the organizationId in the product
    const organization = await Organization.findById(product.organizationId);
    if (!organization) {
      throw createError.NotFound('Organization not found');
    }

    // Update user's purchase history
    const user = await User.findOne({ email: paymentData.customer.email });
    if (!user) {
      throw createError.NotFound('User not found');
    }

    const newPurchase = {
      productId: product._id,
      purchaseDate: Date.now(),
      quantity: 1, // Adjust if needed
      referenceId: transaction.reference // Add referenceId to purchase history
    };

    user.purchaseHistory.push(newPurchase);
    await user.save();

    // Update transaction status to completed
    transaction.status = 'completed';
    await transaction.save();

    // Update the organization's transactions
    const transactionIndex = organization.transactions.findIndex(tx => tx.referenceId === reference);
    if (transactionIndex !== -1) {
      organization.transactions[transactionIndex].status = 'completed';
      await organization.save();
    }

    // Redirect to a success page with reference and productId
    res.redirect(`${process.env.FRONT_DEV}/success?reference=${reference}&productId=${product._id}`);
  } catch (error) {
    next(error);
  }
});

module.exports = router;
