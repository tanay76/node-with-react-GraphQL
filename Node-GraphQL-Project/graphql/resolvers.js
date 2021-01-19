const bcrypt = require('bcryptjs');
const validator = require('validator');

const User = require('../models/user');
const Post = require('../models/post');
const { genAccessToken, genRefreshToken } = require('../helpers/jwt-helper');
const { clearImage } = require('../helpers/file');

module.exports = {
  createUser: async function ({ userInput }, req) {
    const errors = [];
    if (!validator.isEmail(userInput.email)) {
      errors.push({ message: 'Email is invalid!' });
    }
    if (validator.isEmpty(userInput.name)) {
      errors.push({ message: 'Name cannot be empty!' });
    }
    if (
      validator.isEmpty(userInput.password) ||
      !validator.isLength(userInput.password, { min: 5 })
    ) {
      errors.push({ message: 'Invalid Password!' });
    }
    if (errors.length > 0) {
      const error = new Error('Invalid Input!');
      error.data = errors;
      error.code = 422;
      throw error;
    }
    const existingUser = await User.findOne({ email: userInput.email });
    if (existingUser) {
      const error = new Error('User already exists!');
      error.code = 422;
      throw error;
    }
    const hashedPw = await bcrypt.hash(userInput.password, 12);
    const user = new User({
      name: userInput.name,
      email: userInput.email,
      password: hashedPw,
    });
    const newUser = await user.save();
    return { ...newUser._doc, _id: newUser._id.toString() };
  },
  login: async function ({ email, password }, req) {
    const tobeloggedinUser = await User.findOne({ email: email });
    if (!tobeloggedinUser) {
      const error = new Error('User not found!');
      error.code = 401;
      throw error;
    }
    const isEqual = await bcrypt.compare(password, tobeloggedinUser.password);
    if (!isEqual) {
      const error = new Error('Password is incorrect!');
      error.code = 401;
      throw error;
    }
    const token = await genAccessToken(tobeloggedinUser._id, tobeloggedinUser.email);
    const refreshToken = await genRefreshToken(tobeloggedinUser._id, tobeloggedinUser.email);
    tobeloggedinUser.refreshToken = refreshToken;
    const loggedInUser = await tobeloggedinUser.save();
    return {
      token: token,
      expiresIn: '1800s',
      refreshToken: refreshToken,
      userId: loggedInUser._id.toString(),
    };
  },
  relogin: async function ({ refreshToken }, req) {
    const reqdUser = await User.findOne({ refreshToken: refreshToken });
    if (!reqdUser) {
      const error = new Error('Authentication failed!');
      error.code = 401;
      throw error;
    }
    const token = await genAccessToken(reqdUser._id, reqdUser.email);
    const newrefreshToken = await genRefreshToken(reqdUser._id, reqdUser.email);
    reqdUser.refreshToken = newrefreshToken;
    const updatedUser = await reqdUser.save();
    return {
      token: token,
      expiresIn: '1800s',
      refreshToken: newrefreshToken,
      userId: updatedUser._id.toString(),
    };
  },
  createPost: async function ({ postInput }, req) {
    if (!req.isAuth) {
      const error = new Error('Not authenticated!');
      error.code = 401;
      throw error;
    }
    const errors = [];
    if (validator.isEmpty(postInput.title) || !validator.isLength(postInput.title, { min: 5 })) {
      errors.push({ message: 'Invalid title!' });
    }
    if (validator.isEmpty(postInput.imageUrl)) {
      errors.push({ message: 'Invalid imageUrl!' });
    }
    if (
      validator.isEmpty(postInput.content) ||
      !validator.isLength(postInput.content, { min: 5 })
    ) {
      errors.push({ message: 'Invalid content!' });
    }
    if (errors.length > 0) {
      const error = new Error('Invalid Input!');
      error.data = errors;
      error.code = 422;
      throw error;
    }
    const user = await User.findById(req.userId);
    const post = new Post({
      title: postInput.title,
      content: postInput.content,
      imageUrl: postInput.imageUrl,
      creator: user,
    });
    const newPost = await post.save();
    user.posts.push(newPost);
    await user.save();
    return {
      ...newPost._doc,
      _id: newPost._id.toString(),
      createdAt: newPost.createdAt.toISOString(),
      updatedAt: newPost.updatedAt.toISOString(),
    };
  },
  posts: async function ({ page }, req) {
    if (!req.isAuth) {
      const error = new Error('Not Authenticated!');
      error.code = 401;
      throw error;
    }
    const currentPage = +page;
    if (!currentPage) {
      currentPage = 1;
    }
    const perPage = 2;
    const totalPosts = await Post.find().countDocuments();
    const posts = await Post.find()
      .sort({ createdAt: -1 })
      .skip((currentPage - 1) * perPage)
      .limit(perPage)
      .populate('creator');
    return {
      posts: posts.map((p) => {
        return {
          ...p._doc,
          _id: p._id.toString(),
          createdAt: p.createdAt.toISOString(),
          updatedAt: p.updatedAt.toISOString(),
        };
      }),
      totalPosts: totalPosts,
    };
  },
  singlePost: async function ({ postId }, req) {
    if (!req.isAuth) {
      const error = new Error('Not Authenticated!');
      error.code = 401;
      throw error;
    }
    const post = await Post.findById(postId).populate('creator');
    if (!post) {
      const error = new Error('No such post found!');
      error.code = 401;
      throw error;
    }
    return {
      ...post._doc,
      _id: post._id.toString(),
      createdAt: post.createdAt.toISOString(),
      updatedAt: post.updatedAt.toISOString(),
    };
  },
  updatePost: async function ({ id, postInput }, req) {
    if (!req.isAuth) {
      const error = new Error('Not Authenticated!');
      error.code = 401;
      throw error;
    }
    const errors = [];
    if (validator.isEmpty(postInput.title) || !validator.isLength(postInput.title, { min: 5 })) {
      errors.push({ message: 'Invalid title!' });
    }
    if (validator.isEmpty(postInput.imageUrl)) {
      errors.push({ message: 'Invalid imageUrl!' });
    }
    if (
      validator.isEmpty(postInput.content) ||
      !validator.isLength(postInput.content, { min: 5 })
    ) {
      errors.push({ message: 'Invalid content!' });
    }
    if (errors.length > 0) {
      const error = new Error('Invalid Input!');
      error.data = errors;
      error.code = 422;
      throw error;
    }
    const post = await Post.findById(id).populate('creator');
    if (!post) {
      const error = new Error('Post not found!');
      error.code = 404;
      throw error;
    }
    if (post.creator._id.toString() !== req.userId.toString()) {
      const error = new Error('Not authorized!');
      error.code = 403;
      throw error;
    }
    post.title = postInput.title;
    if (postInput.imageUrl !== 'undefined') {
      post.imageUrl = postInput.imageUrl;
    }
    post.content = postInput.content;
    const updatedPost = await post.save();
    return {
      ...updatedPost._doc,
      _id: updatedPost._id.toString(),
      createdAt: updatedPost.createdAt.toISOString(),
      updatedAt: updatedPost.updatedAt.toISOString(),
    };
  },
  getStatus: async function (args, req) {
    if (!req.isAuth) {
      const error = new Error('Not Authenticated!');
      error.code = 401;
      throw error;
    }
    const user = await User.findById(req.userId);
    if (!user) {
      const error = new Error('User not found!');
      error.code = 404;
      throw error;
    }
    return { ...user._doc, _id: user._id.toString() };
  },
  updateStatus: async function ({ status }, req) {
    if (!req.isAuth) {
      const error = new Error('Not Authenticated!');
      error.code = 401;
      throw error;
    }
    const user = await User.findById(req.userId);
    if (!user) {
      const error = new Error('User not found!');
      error.code = 404;
      throw error;
    }
    user.status = status;
    await user.save();
    return { ...user._doc, _id: user._id.toString() };
  },
  deletePost: async function ({ id }, req) {
    if (!req.isAuth) {
      const error = new Error('Not Authenticated!');
      error.code = 401;
      throw error;
    }
    const post = await Post.findById(id);
    if (!post) {
      const error = new Error('Post not found!');
      error.code = 404;
      throw error;
    }
    if (post.creator.toString() !== req.userId.toString()) {
      const error = new Error('Not authorized!');
      error.code = 403;
      throw error;
    }
    await clearImage(post.imageUrl);
    await Post.findByIdAndRemove(id);
    const user = await User.findById(req.userId);
    user.posts.pull(id);
    await user.save();
    return true;
  },
};
