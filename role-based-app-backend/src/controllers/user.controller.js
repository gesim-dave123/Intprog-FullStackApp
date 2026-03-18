const users = require("../databaseMockUp/users.Storage.js");
const departments = require("../databaseMockUp/department.Storage.js");
const employees = require("../databaseMockUp/employees.Storage.js");
const requests = require("../databaseMockUp/requests.Storage.js");
const bcrypt = require("bcryptjs");

require("dotenv/config");

const normalizeRole = (role) => String(role || "").toLowerCase();

const getUserFromToken = (req) => {
  const userId = Number(req.user?.id);
  return users.find((u) => u.id === userId);
};

const mapRequestForClient = (request) => ({
  request_id: request.request_id,
  date: request.date,
  type: request.type,
  items: (request.items || []).map((item) => ({
    name: item.name || item.item_name || "",
    qty: Number(item.qty ?? item.quantity ?? 0),
  })),
  status: request.status,
  employeeEmail: request.employeeEmail,
});

const mapEmployeeForClient = (employee) => ({
  id: Number(employee.id),
  email: employee.email,
  position: employee.position,
  department: employee.department || employee.dept || "",
  hireDate: employee.hireDate,
  role: normalizeRole(employee.role),
});

const mapDepartmentForClient = (department) => ({
  id: Number(department.dept_id),
  name: department.dept_name,
  description: department.description,
});

const displayProfile = async (req, res) => {
  try {
    const userId = Number(req.user?.id);

    // Log for debugging: if userId is NaN or missing, profile lookup will fail
    console.log("displayProfile: decoded user from token:", req.user);

    const userRecord = users.find((u) => u.id === userId);

    if (!userRecord) {
      return res.status(404).json({ message: `User not found` });
    }
    console.log(userRecord);
    res.json({
      user: {
        username: userRecord.username,
        name: userRecord.fullname,
        email: userRecord.email,
        role: userRecord.role,
      },
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Server error when rendering profile" });
  }
};

const displayDashboardData = async (req, res) => {
  try {
    const totalUsers = users.length;
    const totalEmployees = employees.length;
    const totalDepartments = departments.length;
    const totalRequests = requests.length;
    const pendingRequests = requests.filter(
      (r) => String(r.status).toLowerCase() === "pending",
    ).length;
    const approvedRequests = requests.filter(
      (r) => String(r.status).toLowerCase() === "approved",
    ).length;
    console.log(totalUsers, totalEmployees);

    res.json({
      totalUsers,
      totalEmployees,
      totalDepartments,
      totalRequests,
      pendingRequests,
      approvedRequests,
    });
  } catch (error) {
    console.error(error);
    res
      .status(500)
      .json({ message: "Server error when retrieving dashboard data" });
  }
};

const displayEmployees = async (req, res) => {
  try {
    const employeesData = employees.map(mapEmployeeForClient);
    console.log(employeesData);

    return res.json({
      employees: employeesData,
    });
  } catch (error) {
    console.error("displayEmployees error", error);
    return res
      .status(500)
      .json({ message: "Server error retrieving employees" });
  }
};

const addEmployee = async (req, res) => {
  try {
    const { id, email, position, department, hireDate, role } = req.body;

    if (!email || !position || !department || !hireDate) {
      return res.status(400).json({ message: "Fields are required" });
    }

    const linkedUser = users.find(
      (u) => String(u.email).toLowerCase() === String(email).toLowerCase(),
    );
    if (!linkedUser) {
      return res
        .status(400)
        .json({ message: "Email is not linked to an account" });
    }

    const parsedId = id === undefined || id === "" ? null : Number(id);
    if (parsedId !== null && Number.isNaN(parsedId)) {
      return res.status(400).json({ message: "Employee ID must be a number" });
    }

    if (parsedId !== null) {
      const idExists = employees.some(
        (employee) => Number(employee.id) === parsedId,
      );
      if (idExists) {
        return res.status(409).json({ message: "Employee ID already exists" });
      }
    }

    const maxId = employees.reduce((max, employee) => {
      return Math.max(max, Number(employee.id) || 0);
    }, 0);

    const newEmployee = {
      id: parsedId ?? maxId + 1,
      email,
      position,
      dept: department,
      hireDate,
      role: normalizeRole(role || linkedUser.role || "user"),
    };

    employees.push(newEmployee);
    return res
      .status(201)
      .json({ employee: mapEmployeeForClient(newEmployee) });
  } catch (error) {
    console.error("addEmployee error", error);
    return res.status(500).json({ message: "Server error creating employee" });
  }
};

const editEmployee = async (req, res) => {
  try {
    const employeeId = Number(req.params.employeeId);
    const { email, position, department, hireDate, role } = req.body;

    if (Number.isNaN(employeeId)) {
      return res.status(400).json({ message: "Invalid employee ID" });
    }

    if (!email || !position || !department || !hireDate) {
      return res.status(400).json({ message: "Fields are required" });
    }

    const employee = employees.find((emp) => Number(emp.id) === employeeId);
    if (!employee) {
      return res.status(404).json({ message: "Employee not found" });
    }

    const linkedUser = users.find(
      (u) => String(u.email).toLowerCase() === String(email).toLowerCase(),
    );
    if (!linkedUser) {
      return res
        .status(400)
        .json({ message: "Email is not linked to an account" });
    }

    employee.email = email;
    employee.position = position;
    employee.dept = department;
    employee.hireDate = hireDate;
    employee.role = normalizeRole(role || linkedUser.role || employee.role);

    return res.json({ employee: mapEmployeeForClient(employee) });
  } catch (error) {
    console.error("editEmployee error", error);
    return res.status(500).json({ message: "Server error updating employee" });
  }
};

const deleteEmployee = async (req, res) => {
  try {
    const employeeId = Number(req.params.employeeId);
    if (Number.isNaN(employeeId)) {
      return res.status(400).json({ message: "Invalid employee ID" });
    }

    const employeeIndex = employees.findIndex(
      (employee) => Number(employee.id) === employeeId,
    );
    if (employeeIndex === -1) {
      return res.status(404).json({ message: "Employee not found" });
    }

    employees.splice(employeeIndex, 1);
    return res.json({ message: "Employee deleted successfully" });
  } catch (error) {
    console.error("deleteEmployee error", error);
    return res.status(500).json({ message: "Server error deleting employee" });
  }
};

const displayAccounts = async (req, res) => {
  try {
    const accountsData = users.map((user) => ({
      id: user.id,
      fullname: user.fullname,
      username: user.username,
      email: user.email,
      role: user.role,
      verified: user.verified,
    }));

    return res.json({
      accounts: accountsData,
    });
  } catch (error) {
    console.error("displayAccounts error", error);
    return res
      .status(500)
      .json({ message: "Server Error in fetching accounts" });
  }
};

const displayDepartments = async (req, res) => {
  try {
    const departmentsData = departments.map(mapDepartmentForClient);
    console.log(departmentsData);
    return res.json({
      departments: departmentsData,
    });
  } catch (error) {
    console.error("Error in getting the department list", error);
    return res
      .status(500)
      .json({ message: "Server Error in fetching departments" });
  }
};

const addDepartment = async (req, res) => {
  try {
    const { name, description } = req.body;

    if (!name || !description) {
      return res.status(400).json({ message: "Fields are required" });
    }

    const duplicateName = departments.find(
      (department) =>
        String(department.dept_name).toLowerCase() ===
        String(name).toLowerCase(),
    );

    if (duplicateName) {
      return res
        .status(409)
        .json({ message: "Department name already exists" });
    }

    const maxId = departments.reduce((max, department) => {
      return Math.max(max, Number(department.dept_id) || 0);
    }, 0);

    const newDepartment = {
      dept_id: maxId + 1,
      dept_name: name,
      description,
    };

    departments.push(newDepartment);
    return res
      .status(201)
      .json({ department: mapDepartmentForClient(newDepartment) });
  } catch (error) {
    console.error("Error adding department", error);
    return res.status(500).json({ message: "Server error adding department" });
  }
};

const editDepartment = async (req, res) => {
  try {
    const departmentId = Number(req.params.departmentId);
    const { name, description } = req.body;

    if (Number.isNaN(departmentId)) {
      return res.status(400).json({ message: "Invalid department ID" });
    }

    if (!name || !description) {
      return res.status(400).json({ message: "Fields are required" });
    }

    const targetDepartment = departments.find(
      (department) => Number(department.dept_id) === departmentId,
    );

    if (!targetDepartment) {
      return res.status(404).json({ message: "Department not found" });
    }

    const duplicateName = departments.find(
      (department) =>
        Number(department.dept_id) !== departmentId &&
        String(department.dept_name).toLowerCase() ===
          String(name).toLowerCase(),
    );

    if (duplicateName) {
      return res
        .status(409)
        .json({ message: "Department name already exists" });
    }

    targetDepartment.dept_name = name;
    targetDepartment.description = description;

    return res.json({ department: mapDepartmentForClient(targetDepartment) });
  } catch (error) {
    console.error("Error editing department", error);
    return res.status(500).json({ message: "Server error editing department" });
  }
};

const deleteDepartment = async (req, res) => {
  try {
    const departmentId = Number(req.params.departmentId);

    if (Number.isNaN(departmentId)) {
      return res.status(400).json({ message: "Invalid department ID" });
    }

    const departmentIndex = departments.findIndex(
      (department) => Number(department.dept_id) === departmentId,
    );

    if (departmentIndex === -1) {
      return res.status(404).json({ message: "Department not found" });
    }

    departments.splice(departmentIndex, 1);
    return res.json({ message: "Department deleted successfully" });
  } catch (error) {
    console.error("Error deleting department", error);
    return res
      .status(500)
      .json({ message: "Server error deleting department" });
  }
};

const displayRequests = async (req, res) => {
  try {
    const isAdmin = normalizeRole(req.user?.role) === "admin";
    const userId = Number(req.user?.id);
    const userRecord = users.find((u) => u.id === userId);

    if (!userRecord) {
      return res.status(404).json({ message: "User not found" });
    }

    const visibleRequests = isAdmin
      ? requests
      : requests.filter(
          (request) => request.employeeEmail === userRecord.email,
        );

    return res.json({
      requests: visibleRequests.map(mapRequestForClient),
    });
  } catch (error) {
    console.error("Error in fetching the requests", error);
    return res
      .status(500)
      .json({ message: "Server Error in fetching departments" });
  }
};

const createRequest = async (req, res) => {
  try {
    const { type, items } = req.body;
    const userId = Number(req.user?.id);
    const userRecord = users.find((u) => u.id === userId);

    if (!userRecord) {
      return res.status(404).json({ message: "User not found" });
    }

    if (!type) {
      return res.status(400).json({ message: "Request type is required" });
    }

    if (!Array.isArray(items) || items.length === 0) {
      return res.status(400).json({ message: "At least one item is required" });
    }

    const normalizedItems = items
      .map((item) => ({
        item_name: String(item?.name || item?.item_name || "").trim(),
        quantity: Number(item?.qty ?? item?.quantity ?? 0),
      }))
      .filter((item) => item.item_name && item.quantity > 0);

    if (normalizedItems.length === 0) {
      return res
        .status(400)
        .json({ message: "Items must include valid name and quantity" });
    }

    const maxId = requests.reduce((max, request) => {
      return Math.max(max, Number(request.request_id) || 0);
    }, 0);

    const newRequest = {
      request_id: maxId + 1,
      type,
      items: normalizedItems,
      status: "Pending",
      date: new Date().toISOString().split("T")[0],
      employeeEmail: userRecord.email,
    };

    requests.push(newRequest);
    return res.status(201).json({ request: mapRequestForClient(newRequest) });
  } catch (error) {
    console.error("Error creating request", error);
    return res
      .status(500)
      .json({ message: "Server error while creating request" });
  }
};

const updateRequestStatus = async (req, res) => {
  try {
    const requestId = Number(req.params.requestId);
    const { status } = req.body;
    const validStatuses = ["Pending", "Approved", "Rejected"];

    if (!validStatuses.includes(status)) {
      return res.status(400).json({ message: "Invalid status" });
    }

    const targetRequest = requests.find(
      (request) => Number(request.request_id) === requestId,
    );

    if (!targetRequest) {
      return res.status(404).json({ message: "Request not found" });
    }

    targetRequest.status = status;
    return res.json({ request: mapRequestForClient(targetRequest) });
  } catch (error) {
    console.error("Error updating request status", error);
    return res
      .status(500)
      .json({ message: "Server error while updating request" });
  }
};

const deleteRequest = async (req, res) => {
  try {
    const requestId = Number(req.params.requestId);
    const requestIndex = requests.findIndex(
      (request) => Number(request.request_id) === requestId,
    );

    if (requestIndex === -1) {
      return res.status(404).json({ message: "Request not found" });
    }

    const isAdmin = normalizeRole(req.user?.role) === "admin";
    const userId = Number(req.user?.id);
    const userRecord = users.find((u) => u.id === userId);

    if (!userRecord) {
      return res.status(404).json({ message: "User not found" });
    }

    const targetRequest = requests[requestIndex];
    const isOwner = targetRequest.employeeEmail === userRecord.email;

    if (!isAdmin && !isOwner) {
      return res
        .status(403)
        .json({ message: "Not allowed to delete this request" });
    }

    requests.splice(requestIndex, 1);
    return res.json({ message: "Request deleted successfully" });
  } catch (error) {
    console.error("Error deleting request", error);
    return res
      .status(500)
      .json({ message: "Server error while deleting request" });
  }
};

const addAccount = async (req, res) => {
  try {
    const { fullname, username, password, email, verified, role } = req.body;
    const normalizedRole = normalizeRole(role);

    if (
      !fullname ||
      !username ||
      !password ||
      !email ||
      typeof verified !== "boolean" ||
      !normalizedRole
    ) {
      console.log("Fields are required");
      return res.status(400).json({ message: "Fields are required!" });
    }

    if (password.length < 6) {
      return res
        .status(400)
        .json({ message: "Password should be at least 6 characters long" });
    }

    const usernameExists = users.find(
      (u) => u.username === username || u.fullname === fullname,
    );

    if (usernameExists) {
      return res.status(409).json({ message: "Username already exist" });
    }

    const fullnameExists = users.find((u) => u.fullname === fullname);
    if (fullnameExists) {
      return res.status(409).json({ message: "Fullname already exists" });
    }
    const emailExists = users.find((u) => u.email === email);

    if (emailExists) {
      return res.status(409).json({ message: "Email already exists" });
    }

    const hashedPassword = await bcrypt.hash(password, 10);

    const newUser = {
      id: users.length + 1,
      fullname: fullname,
      username: username,
      password: hashedPassword,
      email: email,
      verified,
      role: normalizedRole,
    };

    users.push(newUser);
    res
      .status(201)
      .json({ message: `User registered`, username, role: normalizedRole });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Server error during registration" });
  }
};

const editAccount = async (req, res) => {
  try {
    const accountId = Number(req.params.accountId);
    const { fullname, email, role, verified } = req.body;
    const normalizedRole = normalizeRole(role);

    if (
      !fullname ||
      !email ||
      !normalizedRole ||
      typeof verified !== "boolean"
    ) {
      return res.status(400).json({ message: "Fields are required" });
    }

    const targetUser = users.find((u) => u.id === accountId);
    if (!targetUser) {
      return res.status(404).json({ message: "Account not found" });
    }

    const actor = getUserFromToken(req);
    if (!actor) {
      return res.status(404).json({ message: "Authenticated user not found" });
    }

    if (actor.id === targetUser.id) {
      if (email !== targetUser.email || normalizedRole !== targetUser.role) {
        return res
          .status(403)
          .json({ message: "You cannot change your own role or email" });
      }
    }

    const duplicateEmail = users.find(
      (u) =>
        u.id !== targetUser.id &&
        String(u.email).toLowerCase() === String(email).toLowerCase(),
    );
    if (duplicateEmail) {
      return res.status(409).json({ message: "Email already exists" });
    }

    targetUser.fullname = fullname;
    targetUser.email = email;
    targetUser.role = normalizedRole;
    targetUser.verified = verified;

    return res.json({
      message: "Account updated successfully",
      account: {
        id: targetUser.id,
        fullname: targetUser.fullname,
        username: targetUser.username,
        email: targetUser.email,
        role: targetUser.role,
        verified: targetUser.verified,
      },
    });
  } catch (error) {
    console.error("Error updating account", error);
    return res
      .status(500)
      .json({ message: "Server error while updating account" });
  }
};

const resetAccountPassword = async (req, res) => {
  try {
    const accountId = Number(req.params.accountId);
    const { password } = req.body;

    if (!password || password.length < 6) {
      return res
        .status(400)
        .json({ message: "Password should be at least 6 characters long" });
    }

    const targetUser = users.find((u) => u.id === accountId);
    if (!targetUser) {
      return res.status(404).json({ message: "Account not found" });
    }

    targetUser.password = await bcrypt.hash(password, 10);
    return res.json({ message: "Password reset successfully" });
  } catch (error) {
    console.error("Error resetting account password", error);
    return res
      .status(500)
      .json({ message: "Server error while resetting password" });
  }
};

const deleteAccount = async (req, res) => {
  try {
    const accountId = Number(req.params.accountId);
    const actor = getUserFromToken(req);

    if (!actor) {
      return res.status(404).json({ message: "Authenticated user not found" });
    }

    if (actor.id === accountId) {
      return res
        .status(403)
        .json({ message: "You cannot delete your own account" });
    }

    const targetIndex = users.findIndex((u) => u.id === accountId);
    if (targetIndex === -1) {
      return res.status(404).json({ message: "Account not found" });
    }

    users.splice(targetIndex, 1);
    return res.json({ message: "Account deleted successfully" });
  } catch (error) {
    console.error("Error deleting account", error);
    return res
      .status(500)
      .json({ message: "Server error while deleting account" });
  }
};

module.exports = {
  displayProfile,
  displayDashboardData,
  displayEmployees,
  displayAccounts,
  displayDepartments,
  addDepartment,
  editDepartment,
  deleteDepartment,
  displayRequests,
  createRequest,
  updateRequestStatus,
  deleteRequest,
  addEmployee,
  editEmployee,
  deleteEmployee,
  addAccount,
  editAccount,
  resetAccountPassword,
  deleteAccount,
};
