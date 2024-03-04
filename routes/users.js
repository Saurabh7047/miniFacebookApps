const mongoose = require("mongoose");
const plm = require("passport-local-mongoose");
mongoose
  .connect(
    "mongodb+srv://saurabhrajput9460:saurabh12345@cluster0.1kctguu.mongodb.net/Cluster0?retryWrites=true&w=majority&appName=Cluster0"
  )
  .then(function (result) {
    console.log("connection is successfully");
  })
  .catch(function (err) {
    console.log(err);
  });

const userSchema = mongoose.Schema({
  username: String,
  image: String,
  email: String,
});

userSchema.plugin(plm);

module.exports = mongoose.model("user", userSchema);
