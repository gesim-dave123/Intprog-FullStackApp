// data/user.data.js
const bcrypt = require("bcryptjs");

let users = [
  {
    id: 1,
    fullname: "Maria Labo",
    username: "System Admin",
    password: "qwerty",
    email: "admin@gmail.com",
    verified: true,
    role: "admin",
  },
  {
    id: 2,
    fullname: "Maria Labobo",
    username: "David",
    password: "adhdds",
    email: "user1@gmail.com",
    verified: true,
    role: "user",
  },
  {
    id: 3,
    fullname: "Maria Lababo",
    username: "Allourah",
    password: "xermobility",
    email: "user2@gmail.com",
    verified: true,
    role: "user",
  },
];

// Initial password hashing logic
if (!users[0].password.includes(`$2a$`)) {
  users[0].password = bcrypt.hashSync("AdminPassword", 10);
  users[1].password = bcrypt.hashSync("DavidPassword", 10);
  users[2].password = bcrypt.hashSync("AllourahPassword", 10);
}

module.exports = users;
