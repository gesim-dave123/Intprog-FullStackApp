const date = new Date().toISOString().split("T")[0];
let employees = [
  {
    id: 1,
    email: "admin@gmail.com",
    position: "Cashier",
    dept: "Engineering",
    hireDate: date,
    role: "admin",
  },
  {
    id: 2,
    email: "dad@gmail.com",
    position: "CEO",
    dept: "HR",
    hireDate: date,
    role: "admin",
  },
  {
    id: 1,
    email: "admin@gmail.com",
    position: "Cashier",
    dept: "IT",
    hireDate: date,
    role: "admin",
  },
];

module.exports = employees;
