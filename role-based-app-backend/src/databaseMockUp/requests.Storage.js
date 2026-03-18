const date = new Date().toISOString().split("T")[0];
let requests = [
  {
    request_id: 1,
    type: "Equipment",
    items: [{ item_name: "Martilyo", quantity: 2 }],
    status: "Pending",
    date: date,
    employeeEmail: "chrsdas@gmail.com",
  },
  {
    request_id: 2,
    type: "Leave",
    items: [
      { item_name: "Martilyo", quantity: 2 },
      { item_name: "Chain Saw", quantity: 4 },
    ],
    status: "Pending",
    date: date,
    employeeEmail: "chrswewedas@gmail.com",
  },
];

module.exports = requests;
