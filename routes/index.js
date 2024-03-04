var express = require("express");
var router = express.Router();
var userModel = require("./users.js");
var postModel = require("./post.js");
const commentModel = require("./comment.js");
const passport = require("passport");
const localStrategy = require("passport-local");
var GoogleStrategy = require('passport-google-oidc');
require('dotenv').config();


passport.use(new localStrategy(userModel.authenticate()));

//oauth code
passport.use(new GoogleStrategy({
  clientID: process.env['GOOGLE_CLIENT_ID'],
  clientSecret: process.env['GOOGLE_CLIENT_SECRET'],
  callbackURL: '/oauth2/redirect/google',
  scope: [ "email","profile" ]
}, 
  async function verify(issuer, profile, cb) {
    try{
      let existingUser = await userModel.findOne({email:profile.emails[0].value})
      if(existingUser){
        return cb(null,existingUser);
      }
      else{
        let newUser = await userModel.create({username:profile.displayName,email:profile.emails[0].value,image:profile.image})
        return cb(null,newUser);
      }
    }catch(err){
      console.log(err);
      return err;
    }
}));

/* GET home page. */
  router.get('/', function(req, res, next) {
    if(req.user){

      res.render('profile');
    }else{
      res.redirect("/login");
    }
  });

  router.get('/login', function(req, res, next) {
    if(!req.user){

      res.render('login');
    }else{
      res.redirect('/profile')
    }
  });

//ends

router.get('/oauth2/redirect/google', passport.authenticate('google', {
  successRedirect: '/profile',
  failureRedirect: '/login'
}));



router.get("/", (req, res) => {
  res.render("login");
});

router.post("/register", (req, res) => {
  var newUser = new userModel({
    username: req.body.username,
    image: req.body.image,
    email: req.body.email,
  });
  userModel.register(newUser, req.body.password).then((result) => {
    passport.authenticate("local")(req, res, () => {
      res.redirect("/profile");
    });
  });
});
// login with google
router.get('/login/federated/google', passport.authenticate('google'));

router.get("/profile", isLoggedIn, (req, res) => {
  userModel
    .findOne({ username: req.session.passport.user })
    .then((loggedInUser) => {
      res.render("profile", { user: loggedInUser });
    });
});

router.get("/profile/:id", isLoggedIn, async (req, res, next) => {
  var userDetails = await userModel.findOne({
    _id: req.params.id,
  });
  res.render("profile", { user: userDetails });
});

router.get("/edit/:id", isLoggedIn, async (req, res, next) => {
  userModel
    .findOne({
      _id: req.params.id,
    })
    .then(function (user) {
      res.render("edit", { user: user });
    });
});

router.post("/update/:userid", isLoggedIn, async (req, res, next) => {
  userModel
    .findOneAndUpdate(
      {
        _id: req.params.userid,
      },
      {
        username: req.body.username,
        email: req.body.email,
        image: req.body.image,
      }
    )
    .then(function (user) {
      res.redirect("/allusers");
    });
});

router.post(
  "/login",
  passport.authenticate("local", {
    successRedirect: "/profile",
    failureRedirect: "/",
  }),
  function (req, res) {}
);

router.get("/login", (req, res) => {
  res.render("login");
});

function isLoggedIn(req, res, next) {
  if (req.isAuthenticated()) return next();
  else res.redirect("/login");
}

router.get("/logout", (req, res, next) => {
  if (req.isAuthenticated())
    req.logOut((err) => {
      if (err) res.send(err);
      else res.redirect("/");
    });
});

router.get("/allUsers", isLoggedIn, async (req, res, next) => {
  var allUsers = await userModel.find();
  res.render("allUsers", { users: allUsers });
});

router.get("/delete/:userId", isLoggedIn, (req, res) => {
  userModel
    .findOne({
      username: req.session.passport.user,
    })
    .then((loggedInUser) => {
      userModel
        .findOne({
          _id: req.params.userId,
        })
        .then((findUser) => {
          if (loggedInUser.username === findUser.username) {
            userModel
              .findByIdAndDelete({
                _id: req.params.userId,
              })
              .then((deletedUser) => {
                console.log(deletedUser);
                res.redirect("/login");
              });
          } else {
            // res.send("access denied")
            res.redirect("back");
          }
        });
    });
});

router.get("/createPost", isLoggedIn, (req, res) => {
  res.render("createPost");
});
router.post("/createPost", isLoggedIn, (req, res) => {
  userModel
    .findOne({
      username: req.session.passport.user,
    })
    .then((loggInUser) => {
      postModel
        .create({
          owner: loggInUser._id,
          image: req.body.image,
          caption: req.body.caption,
        })
        .then((post) => {
          console.log(post);
          res.redirect("/post");
        });
    });
});

router.get("/post", isLoggedIn, (req, res) => {
  postModel
    .find()
    .populate("owner")
    .populate("comments")
    .populate({ path: "comments", populate: "user" })
    .then((allpost) => {
      // console.log(allpost);
      res.render("post", { posts: allpost });
    });
});

router.get("/postlike/:postId", isLoggedIn, (req, res) => {
  postModel
    .findOne({
      _id: req.params.postId,
    })
    .then((post) => {
      userModel
        .findOne({
          username: req.session.passport.user,
        })
        .then((loggedInUser) => {
          var indexOfLoggedInUser = post.likes.indexOf(loggedInUser._id);
          if (indexOfLoggedInUser == -1) {
            post.likes.push(loggedInUser._id);
            post.save().then((post) => {
              res.redirect("back");
            });
          } else {
            post.likes.splice(indexOfLoggedInUser, 1);
            post.save().then((post) => {
              res.redirect("back");
            });
          }
        });
    });
});

router.post("/addComment/:post_id", isLoggedIn, async (req, res) => {
  var currentPost = await postModel.findOne({
    _id: req.params.post_id,
  });

  var loggedUser = await userModel.findOne({
    username: req.session.passport.user,
  });
  var newComment = await commentModel.create({
    user: loggedUser._id,
    data: req.body.data,
    time: `${Date.now()}`,
    post: currentPost._id,
  });
  currentPost.comments.push(newComment._id);
  await currentPost.save();
  res.redirect("back");
});

router.get("/deletecomment/:commentId", isLoggedIn, async (req, res) => {
  var loggedInUser = await userModel.findOne({
    username:req.session.passport.user
  })
  var currentComment = await commentModel.findOne({
    _id: req.params.commentId,
  }).populate('user')
  var currentPost = await postModel.findOne({
    _id: currentComment.post,
  }).populate('owner')
  if(currentComment.user.username == loggedInUser.username ||currentPost.owner.username == loggedInUser.username ){

    await commentModel.findOneAndDelete({
      _id: currentComment._id,
    });
    var indexOfCurrentComment = currentPost.comments.indexOf(currentComment._id);
    currentPost.comments.splice(indexOfCurrentComment, 1);
    await currentPost.save();
    res.redirect("back");
  }
  else{
    res.redirect('back')
  }
});











module.exports = router;
