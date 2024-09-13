const express = require("express");
const router = express.Router();
const createError = require("http-errors");
const bcrypt = require("bcrypt");
const Organization = require("../models/Organization")
const orgUser = require('../models/Organization')
const Product = require('../models/Product')
const multer = require('multer')
const isLoggedIn = require('../middlewares/checkLogin')
const path = require('path')
const fs = require('fs')
const jwt = require('jsonwebtoken')

// Ensure that the uploads directory exists
const uploadsDir = path.join(__dirname, '../../uploads/');
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true });
}

// Multer configuration
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    console.log('Saving to:', uploadsDir); // Log the upload directory path
    cb(null, uploadsDir); // Use the directory created above
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    const extension = path.extname(file.originalname);
    const filename = file.fieldname + '-' + uniqueSuffix + extension;
    console.log('Generated filename:', filename); // Log the generated filename
    cb(null, filename);
  }
});

const upload = multer({ storage });
// const bcrypt = require('bcrypt');

router.post("/signup", async (req, res, next) => {
  try {
    let { orgName, orgEmail, orgPassword } = req.body;
    console.log({ orgName, orgEmail, orgPassword });

    // Validate input fields
    if (!orgName || !orgEmail || !orgPassword) {
      throw createError(401, "All fields are required");
    }

    // if (orgPassword.length < 3) {
    //   throw createError(400, "Password must be at least 3 characters long")
    // }

    // Check if the email is already in use
    const existingOrg = await Organization.findOne({ orgEmail });
    if (existingOrg) {
      throw createError(409, "Email is already registered");
    }
    // Hash the password
    const hashedPassword = await bcrypt.hash(orgPassword, 10);

    console.log("start")
    // Create a new user
    const newUser = new orgUser({
      organizationName: orgName,
      organizationEmail: orgEmail,
      password: hashedPassword,
      isOrg: true
    });
    await newUser.save();

    // Send a success response
    res.status(200).json({ message: "organization saved successfully" });
  } catch (err) {
    // Handle errors
    next(err);
  }
});

router.post('/addproduct', isLoggedIn, upload.single('image'), async (req, res, next) => {
  try {
    console.log("starting upload");

    const { name, description, price, organizationId } = req.body;
    const imageUrl = req.file ? req.file.filename : "defaultProductImage.jpg";
    console.log({ imageUrl });

    if (!name || !description || !price || !organizationId) {
      throw createError(401, "All fields are required");
    }

    const decodedToken = req.decodedToken;

    if (!decodedToken || req.decodedToken.userId !== organizationId) {
      throw createError.Unauthorized("Unauthorized access");
    }

    const organization = await Organization.findById(organizationId);
    if (!organization) {
      throw new createError(404, "Organization not found");
    }

    const existingProduct = await Product.findOne({
      name,
      organizationId: organization._id,
    });

    if (existingProduct) {
      throw new createError(409, "Product name already exists within this organization");
    }

    const newProduct = new Product({
      name,
      description,
      price,
      organizationId,
      imageUrl,
    });

    await newProduct.save();

    // Add the new product to the organization's products array
    organization.products.push(newProduct._id);
    await organization.save(); // Save the updated organization
    const token = jwt.sign({ userId: organization._id, user: organization }, process.env.SECRET, { expiresIn: '1h' });
    return res.status(200).json({ message: "Product added successfully", statusp: 'org', token, organization });
  } catch (err) {
    console.log(err);
    next(err);
  }
});

router.delete('/delete/:id', isLoggedIn, async (req, res, next) => {
  try {
    const productId = req.params.id;
    const decodedToken = req.decodedToken;

    console.log(productId);

    if (!productId) {
      throw new createError.BadRequest("Product ID is required");
    }

    // Find the product by ID
    const product = await Product.findOne({ _id: productId });
    if (!product) {
      throw new createError.NotFound("Product not found");
    }

    // Check if the product belongs to the user
    if (product.organizationId !== decodedToken.userId) {
      throw new createError.Unauthorized("You are not authorized to delete this product");
    }

    // Delete the product
    const result = await Product.deleteOne({ _id: productId });
    if (result.deletedCount === 0) {
      throw new createError.NotFound("Product not found or already deleted");
    }

    return res.status(200).json({ message: "Product successfully deleted" });
  } catch (err) {
    next(err);
  }
});
router.put('/edit/:id', isLoggedIn, upload.single('image'), async (req, res, next) => {
  try {
    const productId = req.params.id;
    const updateData = req.body;
    const decodedToken = req.decodedToken;

    console.log(productId);
    console.log(updateData);

    if (!productId) {
      throw new createError.BadRequest("Product ID is required");
    }

    if (!updateData || Object.keys(updateData).length === 0) {
      throw new createError.BadRequest("No data provided for update");
    }

    const product = await Product.findOne({ _id: productId });
    if (!product) {
      throw new createError.NotFound("Product not found");
    }

    if (product.organizationId !== decodedToken.userId) {
      throw new createError.Unauthorized("You are not authorized to edit this product");
    }

    const updatedProduct = await Product.findByIdAndUpdate(
      productId,
      updateData,
      { new: true, runValidators: true }
    );

    if (!updatedProduct) {
      throw new createError.NotFound("Product not found or already updated");
    }

    return res.status(200).json(updatedProduct);
  } catch (err) {
    next(err);
  }
});

module.exports = router;
