const mongoose = require("mongoose");
const validator = require("validator");

const orgSchema = new mongoose.Schema({
  organizationName: {
    type: String,
    required: true,
    minlength: 3,
    maxlength: 50,
    unique: true
  },
  organizationEmail: {
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
  isOrg: {
    type: Boolean,
    default: true
  },
  transactions: [
    {
      emails: {
        type: String,

        validate: [validator.isEmail, "Invalid email"],
      },
      amount: {
        type: Number,
        required: true
      },
      referenceId: {
        type: String,
        require: true
      },
      date: { type: Date },
    },
  ],
  products: [
    {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Product", // Reference to the Product model
    },
  ]
});

const Organization = mongoose.model("Organization", orgSchema);
module.exports = Organization;
