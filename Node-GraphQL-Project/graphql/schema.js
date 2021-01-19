const { buildSchema } = require('graphql');

module.exports = buildSchema(`
  type Post {
    _id: ID!
    title: String!
    content: String!
    imageUrl: String!
    creator: User!
    createdAt: String!
    updatedAt: String!
  }

  type User {
    _id: ID!
    name: String!
    email: String!
    password: String!
    status: String!
    posts: [Post!]!
  }

  type postData {
    posts: [Post!]!
    totalPosts: Int!
  }

  input postInputData {
    title: String!
    imageUrl: String!
    content: String!
  }

  input userInputData {
    email: String!
    name: String!
    password: String!
  }

  type authData {
    token: String!
    expiresIn: String!
    refreshToken: String!
    userId: String!
  }

  type RootQuery {
    login(email: String! password: String!): authData!
    relogin(refreshToken: String!): authData!
    posts(page: Int): postData!
    singlePost(postId: ID!): Post!
    getStatus: User!
  }

  type RootMutation {
    createUser(userInput: userInputData): User!
    createPost(postInput: postInputData): Post!
    updatePost(id: ID!, postInput: postInputData!): Post!
    updateStatus(status: String!): User!
    deletePost(id: ID!): Boolean!
  }

  schema {
    query: RootQuery
    mutation: RootMutation
  }

`);
