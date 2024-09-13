const mongoose = require("mongoose");
const validator = require("validator");

const userSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true,
    minlength: 3,
    maxlength: 50,
  },
  email: {
    type: String,
    required: true,
    unique: true,
    validate: {
      validator: (v) => validator.isEmail(v),
      message: (props) => `${props.value} is not a valid email!`,
    },
  },
  password: {
    type: String,
    required: true,
    minlength: 6,
    maxlength: 128,
  },
  address: {
    street: { type: String, maxlength: 100 },
    city: { type: String, maxlength: 50 },
    state: { type: String, maxlength: 50 },
    zipCode: { type: String, maxlength: 10 },
  },
  purchaseHistory: [
    {
      productId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "Product", // Reference to the Product model
      },
      purchaseDate: { type: Date, default: Date.now },
      quantity: { type: Number },
      referenceId: {
        type: String,
        require: true
      },
    },
  ],
});

const User = mongoose.model("User", userSchema);
module.exports = User;
