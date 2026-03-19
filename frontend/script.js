let currentUser = null;
let accountCache = [];
let employeeCache = [];
let departmentCache = [];

// Local cache — populated by render functions when fetching from the server
window.db = {
  accounts: [],
  departments: [],
  employees: [],
  requests: [],
};

// Shows a popup notification that disappears after 3 seconds.
function showToast(message, type = "error") {
  // Remove existing toast if any
  const existingToast = document.querySelector(".toast-message");
  if (existingToast) {
    existingToast.remove();
  }

  // Create toast element
  const toast = document.createElement("div");
  toast.className = `toast-message toast-${type}`;
  toast.textContent = message;

  // Add to body
  document.body.appendChild(toast);

  // Trigger animation
  setTimeout(() => {
    toast.classList.add("show");
  }, 10);

  // Remove after 3 seconds
  setTimeout(() => {
    toast.classList.remove("show");
    setTimeout(() => {
      toast.remove();
    }, 300);
  }, 3000);
}

// Changes the URL hash to navigate to a different page section
function navigateTo(hash) {
  window.location.hash = hash;
}

// Also handles access control — redirects unauthenticated or non-admin users.
function handleRouting() {
  const hash = window.location.hash || "#/";
  const route = hash.replace("#", "");
  const protectedRoutes = [
    "/profile",
    "/requests",
    "/departments",
    "/employees",
    "/accounts",
    "/dashboard",
  ];
  const adminRoutes = ["/accounts", "/departments", "/employees", "/dashboard"];

  const isAuth = !!currentUser;
  const isAdmin = currentUser?.role?.toLowerCase() === "admin";

  if (
    (protectedRoutes.includes(route) || adminRoutes.includes(route)) &&
    !isAuth
  ) {
    showToast("Please login to access this page.", "error");
    return navigateTo("#/login");
  }

  // Redirect logic: If authenticated but not admin tries to access admin routes
  if (adminRoutes.includes(route) && !isAdmin) {
    showToast("Access denied. Admins only.", "error");
    return navigateTo("#/profile");
  }
  // Hide all pages first
  document.querySelectorAll(".page").forEach((page) => {
    page.classList.remove("active");
  });

  // Map routes to their Section IDs
  const pageMap = {
    "/": "home-section",
    "/guest": "guest-content-section",
    "/login": "login-section",
    "/register": "register-section",
    "/verify-email": "verify-email-section",
    "/profile": "profile-section",
    "/accounts": "accounts-section",
    "/departments": "departments-section",
    "/employees": "employees-section",
    "/requests": "requests-section",
    "/dashboard": "dashboard-section",
  };

  const targetId = pageMap[route] || "home-section";
  const targetPage = document.getElementById(targetId);

  if (targetPage) {
    targetPage.classList.add("active");
  }

  if (route === "/profile" && isAuth) {
    renderProfile();
  }
  if (route === "/accounts" && isAdmin) {
    renderAccounts();
  }
  if (route === "/departments" && isAdmin) {
    renderDepartments();
  }
  if (route === "/employees" && isAdmin) {
    renderEmployees();
  }
  if (route === "/requests" && isAuth) {
    renderRequests();
  }
  if (route === "/dashboard" && isAuth) {
    renderDashboardData();
  }
  if (route === "/verify-email") {
    // Show the registered email on the verify-email page
    const savedEmail = localStorage.getItem("unverified_email");
    const emailDisplay = document.getElementById("verify-email-display");
    if (emailDisplay && savedEmail) emailDisplay.textContent = savedEmail;

    // Reset the verify button in case user navigates back
    const btn = document.getElementById("verify-btn");
    if (btn) btn.disabled = false;
    const verifyAlert = document.getElementById("verify-alert");
    if (verifyAlert) verifyAlert.classList.add("d-none");
  }
  if (route === "/guest") {
    renderGuestContent();
  }
}

function getAuthHeader() {
  const token = sessionStorage.getItem("authToken");
  return token ? { Authorization: `Bearer ${token}` } : {};
}

// Decodes the payload part of a JWT token without any external library.
// A JWT is 3 base64 parts separated by dots: header.payload.signature
function parseJwt(token) {
  try {
    const base64Payload = token.split(".")[1];
    const jsonPayload = atob(
      base64Payload.replace(/-/g, "+").replace(/_/g, "/"),
    );
    return JSON.parse(jsonPayload);
  } catch {
    return null;
  }
}

// Reads the token's expiry time (exp) and schedules an automatic logout
// exactly when the token is about to expire. Also clears all caches.
let autoLogoutTimer = null;
function scheduleAutoLogout(token) {
  if (autoLogoutTimer) clearTimeout(autoLogoutTimer);

  const payload = parseJwt(token);
  if (!payload?.exp) return;

  const expiresInMs = payload.exp * 1000 - Date.now();
  if (expiresInMs <= 0) {
    // Token already expired — log out immediately
    forceLogout("Your session has expired. Please log in again.");
    return;
  }

  autoLogoutTimer = setTimeout(() => {
    forceLogout("Your session has expired. Please log in again.");
  }, expiresInMs);
}

// Clears all caches, tokens, and forces the user back to the login page.
// Called either by the timer or when a 401/403 is received from the server.
function forceLogout(message = "You have been logged out.") {
  if (autoLogoutTimer) clearTimeout(autoLogoutTimer);
  autoLogoutTimer = null;

  // Clear in-memory caches
  currentUser = null;
  accountCache = [];
  employeeCache = [];
  departmentCache = [];
  window.db = { accounts: [], departments: [], employees: [], requests: [] };

  // Clear stored tokens and user
  localStorage.removeItem("authToken");
  localStorage.removeItem("currentUser");
  sessionStorage.removeItem("authToken");

  setAuthState(false);
  showToast(message, "error");
  navigateTo("#/login");
}

// A wrapper around fetch() that automatically logs out the user if the
// server returns 401 (not authenticated) or 403 (forbidden/token expired).
async function apiFetch(url, options = {}) {
  options.headers = { ...getAuthHeader(), ...options.headers };
  const response = await fetch(url, options);

  if (response.status === 401 || response.status === 403) {
    forceLogout("Your session expired. Please log in again.");
    throw new Error("Session expired");
  }

  return response;
}

async function handleRegistration(event) {
  event.preventDefault();

  const firstName = document.getElementById("first-name").value.trim();
  const lastName = document.getElementById("last-name").value.trim();
  const email = document.getElementById("register-email").value.trim();
  const password = document.getElementById("register-password").value.trim();
  const username = document.getElementById("username").value.trim();
  const role = document.getElementById("register-role").value.trim();
  const fullname = firstName + " " + lastName;

  if (!firstName || !lastName || !email || !password || !role || !username) {
    showToast("Please fill in all fields", "error");
    return;
  }

  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(email)) {
    showToast("Please enter a valid email address", "error");
    return;
  }

  if (password.length <= 6) {
    showToast("Password must be at least 6 characters", "error");
    return;
  }

  const newUser = {
    fullname: fullname,
    username: username,
    password: password,
    email: email,
    role: role,
  };

  try {
    const response = await fetch(`http://localhost:3000/api/auth/register`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(newUser),
    });

    const data = await response.json();

    if (!response.ok) {
      showToast(data.error || "Registration failed", "error");
      return;
    }

    showToast("Registration successful! Please verify your email.", "success");

    // Save the registered email so the verify-email page can use it
    localStorage.setItem("unverified_email", email);

    document.getElementById("first-name").value = "";
    document.getElementById("last-name").value = "";
    document.getElementById("register-email").value = "";
    document.getElementById("register-password").value = "";

    setTimeout(() => {
      navigateTo("#/verify-email");
    }, 1500);
  } catch (error) {
    console.error("Registration error:", error);
    showToast("An unexpected error occurred. Please try again.", "error");
  }
}

// Rewrites the old localStorage-only verifyEmail.
// Now calls the backend to check the email and set verified = true.
async function verifyEmail(event) {
  event.preventDefault();

  const email = localStorage.getItem("unverified_email");

  if (!email) {
    showToast("No email to verify. Please register first.", "error");
    return;
  }

  // Disable the button to prevent double-clicks
  const btn = document.getElementById("verify-btn");
  if (btn) btn.disabled = true;

  try {
    const response = await fetch(
      "http://localhost:3000/api/auth/verify-email",
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      },
    );

    const data = await response.json();

    if (!response.ok) {
      showToast(data.error || "Verification failed", "error");
      if (btn) btn.disabled = false;
      return;
    }

    // Show success alert on the verify-email page
    const verifyAlert = document.getElementById("verify-alert");
    if (verifyAlert) verifyAlert.classList.remove("d-none");

    showToast("Email verified! Redirecting to login...", "success");
    localStorage.removeItem("unverified_email");

    setTimeout(() => {
      navigateTo("#/login");
    }, 2000);
  } catch (error) {
    console.error("verifyEmail error:", error);
    showToast("An error occurred during verification.", "error");
    if (btn) btn.disabled = false;
  }
}

function setAuthState(isAuthenticated, user = null) {
  // A function `setAuthState(isAuthenticated, user)` that updates the application's state based on whether the user is authenticated or not, including storing the JWT token in local storage, updating the UI (e.g., showing/hiding navbar links), and handling admin-specific UI changes.
  const navUnauthenticated = document.getElementById("nav-unauthenticated");
  const navAuthenticated = document.getElementById("nav-authenticated");

  if (isAuthenticated && user) {
    currentUser = user;

    // store only the user info locally; token is stored in sessionStorage at login
    localStorage.setItem("currentUser", JSON.stringify(user));

    document.body.classList.remove("not-authenticated");
    document.body.classList.add("authenticated");

    // Update navbar
    if (navUnauthenticated) navUnauthenticated.classList.add("d-none");
    if (navAuthenticated) navAuthenticated.classList.remove("d-none");

    if (user.role?.toLowerCase() === "admin") {
      document.body.classList.add("is-admin");
    }
  } else {
    currentUser = null;
    // Clear any stored tokens/user state
    localStorage.removeItem("authToken");
    localStorage.removeItem("currentUser");
    sessionStorage.removeItem("authToken");

    document.body.classList.remove("authenticated", "is-admin");
    document.body.classList.add("not-authenticated");

    // Update navbar
    if (navUnauthenticated) navUnauthenticated.classList.remove("d-none");
    if (navAuthenticated) navAuthenticated.classList.add("d-none");
  }
}
function handleLogout(event) {
  event.preventDefault();
  forceLogout("You have been logged out.");
  navigateTo("#/");
}

// Handle Login
async function handleLogin(event) {
  event.preventDefault();
  const emailOrUsername = document
    .getElementById("emailOrUsername")
    .value.trim();
  const password = document.getElementById("login-password").value.trim();

  if (!emailOrUsername || !password) {
    showToast("Please enter email and password", "error");
    return;
  }

  const loginData = {
    emailOrUsername: emailOrUsername,
    password: password,
  };

  try {
    const response = await fetch(`http://localhost:3000/api/auth/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(loginData),
    });
    const data = await response.json();

    if (response.ok) {
      // Store the token in both sessionStorage and localStorage so refreshes keep authenticated state
      sessionStorage.setItem("authToken", data.token);
      localStorage.setItem("authToken", data.token);

      // Schedule automatic logout when the token expires (1 hour)
      scheduleAutoLogout(data.token);

      showToast("Login successfully", "success");

      document.body.classList.remove("not-authenticated");
      document.body.classList.add("authenticated");

      if (data.user.role?.toLowerCase() === "admin") {
        document.body.classList.add("is-admin");
      }
      setTimeout(() => {
        setAuthState(true, data.user);
        if (data.user.role.toLowerCase() === "admin") {
          navigateTo("#/dashboard");
        } else {
          navigateTo("#/profile");
        }
      }, 1000);
    } else {
      showToast(data.error || data.message || "Login Failed", "error");
    }
  } catch (error) {
    console.error("Login Error");
    showToast("Login Error", "error");
  }
}

// Fetches public content from GET /api/content/guest — no login required
async function renderGuestContent() {
  const container = document.getElementById("guest-message");
  if (!container) return;

  // Show loading spinner
  container.innerHTML = `
    <div class="spinner-border text-primary" role="status">
      <span class="visually-hidden">Loading...</span>
    </div>
    <p class="mt-2 text-muted">Fetching content from server...</p>
  `;

  try {
    const response = await fetch("http://localhost:3000/api/content/guest");
    const data = await response.json();

    if (!response.ok) {
      container.innerHTML = `<p class="text-danger">Failed to load guest content.</p>`;
      return;
    }

    container.innerHTML = `
      <div class="alert alert-success mb-0" role="alert">
        <i class="bi bi-check-circle-fill me-2"></i>
        <strong>Server says:</strong> ${data.message}
      </div>
    `;
  } catch (error) {
    console.error("renderGuestContent error:", error);
    container.innerHTML = `
      <p class="text-danger"><i class="bi bi-exclamation-triangle me-1"></i> Could not reach the server. Make sure the backend is running.</p>
    `;
  }
}

async function renderDashboardData() {
  try {
    const response = await fetch(`http://localhost:3000/api/dashboard`, {
      method: "GET",
      headers: getAuthHeader(),
    });

    if (!response.ok) {
      const err = await response.json().catch(() => ({}));
      console.error("renderProfile failed:", response.status, err);
      return;
    }
    const data = await response.json();

    const setText = (id, value) => {
      const el = document.getElementById(id);
      if (el) el.innerText = value ?? 0;
    };

    setText("total-accounts", data.totalUsers);
    setText("total-employees", data.totalEmployees);
    setText("total-departments", data.totalDepartments);
    setText("total-requests", data.totalRequests);
    setText("total-pending-requests", data.pendingRequests);
    setText("total-approved-requests", data.approvedRequests);
  } catch (error) {
    console.error("Dashboard Error");
    showToast("Dashboard", "error");
  }
}

async function renderProfile() {
  try {
    const response = await fetch("http://localhost:3000/api/profile", {
      method: "GET",
      headers: getAuthHeader(),
    });

    if (!response.ok) {
      const err = await response.json().catch(() => ({}));
      console.error("renderProfile failed:", response.status, err);
      return;
    }

    const data = await response.json();
    document.getElementById("profile-name").value = data.user.name;
    document.getElementById("profile-role").value = data.user.role;
    document.getElementById("profile-email").value = data.user.email;
    document.getElementById("profile-username").value = data.user.username;
  } catch (error) {
    console.error("renderProfile error:", error);
  }

  // console.log("Rendering profile for user:", currentUser);
}
function addAccountModal() {
  // A function `addAccountModal()` that opens the account form modal in "add" mode, resetting all fields and setting the appropriate button actions for saving a new account.
  // Reset form fields
  document.getElementById("account-firstname").value = "";
  document.getElementById("account-lastname").value = "";
  document.getElementById("account-username").value = "";
  document.getElementById("account-email").value = "";
  document.getElementById("account-password").value = "";
  document.getElementById("account-role").value = "User";
  document.getElementById("account-verified").checked = false;

  // Enable all fields
  document.getElementById("account-password").disabled = false;
  document.getElementById("account-username").disabled = false;
  document.getElementById("account-email").disabled = false;
  document.getElementById("account-role").disabled = false;
  document.getElementById("account-verified").disabled = false;

  // Reset button to add mode
  document.getElementById("save-account-btn").onclick = addAccount;

  // Show form
  document.getElementById("account-form").classList.remove("d-none");
}
function closeAccountForm() {
  document.getElementById("account-form").classList.add("d-none");
}

function openAddDepartmentForm() {
  document.getElementById("department-name").value = "";
  document.getElementById("department-description").value = "";
  window.currentEditDepartmentId = null;

  document.getElementById("edit-department-btn").classList.add("d-none");
  document.getElementById("add-department-btn").classList.remove("d-none");
  document.getElementById("department-form").classList.remove("d-none");
}

function closeDepartmentForm() {
  document.getElementById("department-form").classList.add("d-none");
  document.getElementById("department-name").value = "";
  document.getElementById("department-description").value = "";
}

async function addDepartment(event) {
  event.preventDefault();
  const name = document.getElementById("department-name").value.trim();
  const description = document
    .getElementById("department-description")
    .value.trim();

  if (!name || !description) {
    showToast("Please fill in all fields", "error");
    return;
  }
  try {
    const response = await fetch("http://localhost:3000/api/departments", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...getAuthHeader(),
      },
      body: JSON.stringify({ name, description }),
    });

    const data = await response.json().catch(() => ({}));
    if (!response.ok) {
      showToast(data.message || "Failed to add department", "error");
      return;
    }

    showToast("Department added successfully!", "success");
    closeDepartmentForm();
    renderDepartments();
  } catch (error) {
    console.error("addDepartment error", error);
    showToast("Error adding department", "error");
  }
}

async function editDepartment(index) {
  const departmentId = Number(index);
  const department = departmentCache.find(
    (dept) => Number(dept.id) === departmentId,
  );
  if (!department) {
    showToast("Department not found", "error");
    return;
  }

  // Store the id for save/delete operations
  window.currentEditDepartmentId = departmentId;

  document.getElementById("department-name").value = department.name;
  document.getElementById("department-description").value =
    department.description;
  document.getElementById("department-form").classList.remove("d-none");
  document.getElementById("edit-department-btn").classList.remove("d-none");
  document.getElementById("add-department-btn").classList.add("d-none");
}

async function saveDepartment(event) {
  event.preventDefault();
  const departmentId = Number(window.currentEditDepartmentId);

  if (!Number.isFinite(departmentId)) {
    showToast("Department not found", "error");
    return;
  }

  const name = document.getElementById("department-name").value.trim();
  const description = document
    .getElementById("department-description")
    .value.trim();

  if (!name || !description) {
    showToast("Please fill in all fields", "error");
    return;
  }

  try {
    const response = await fetch(
      `http://localhost:3000/api/departments/${departmentId}`,
      {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          ...getAuthHeader(),
        },
        body: JSON.stringify({ name, description }),
      },
    );

    const data = await response.json().catch(() => ({}));
    if (!response.ok) {
      showToast(data.message || "Failed to update department", "error");
      return;
    }

    showToast("Department updated successfully!", "success");
    closeDepartmentForm();
    renderDepartments();
  } catch (error) {
    console.error("saveDepartment error", error);
    showToast("Error updating department", "error");
  }
}

async function deleteDepartment(event, index) {
  event.preventDefault();
  const departmentId = Number(index);

  const department = departmentCache.find(
    (dept) => Number(dept.id) === departmentId,
  );
  if (!department) {
    showToast("Department not found", "error");
    return;
  }

  if (
    confirm(
      `Are you sure you want to delete the "${department.name}" department?`,
    )
  ) {
    try {
      const response = await fetch(
        `http://localhost:3000/api/departments/${departmentId}`,
        {
          method: "DELETE",
          headers: getAuthHeader(),
        },
      );

      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        showToast(data.message || "Failed to delete department", "error");
        return;
      }

      showToast("Department deleted successfully!", "success");
      closeDepartmentForm();
      renderDepartments();
    } catch (error) {
      console.error("deleteDepartment error", error);
      showToast("Error deleting department", "error");
    }
  }
}
async function addAccount(event) {
  event.preventDefault();
  const firstName = document.getElementById("account-firstname").value.trim();
  const lastName = document.getElementById("account-lastname").value.trim();
  const username = document.getElementById("account-username").value.trim();
  const email = document.getElementById("account-email").value.trim();
  const password = document.getElementById("account-password").value.trim();
  const role = document.getElementById("account-role").value;

  if (!firstName || !username || !lastName || !email || !password || !role) {
    showToast("Please fill in all fields", "error");
    return;
  }
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(email)) {
    showToast("Please enter a valid email address", "error");
    return;
  }
  if (password.length <= 6) {
    showToast("Password must be at least 6 characters", "error");
    return;
  }
  const existingEmail = window.db.accounts.find((u) => u.email === email);
  if (existingEmail) {
    showToast(
      "Email already registered. Please use a different email.",
      "error",
    );
    return;
  }
  const fullname = firstName + " " + lastName;

  const newAccount = {
    fullname: fullname,
    username: username,
    password: password,
    email: email,
    verified: true, // Admin-created accounts are auto-verified
    role: role,
  };
  try {
    const response = await fetch(
      `http://localhost:3000/api/accounts/addAccount`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...getAuthHeader(),
        },
        body: JSON.stringify(newAccount),
      },
    );
    if (!response.ok) {
      const err = await response.json().catch(() => ({}));
      showToast(err.message || "Error in adding account", "error");
      console.error("addAccount failed:", response.status, err);
      return;
    }
  } catch (error) {
    console.error(error);
    showToast("Error in adding account", "error");
  }
  showToast("Account created successfully!", "success");
  document.getElementById("account-form").classList.add("d-none");
  renderAccounts();

  closeAccountForm();
}

async function saveAccount(event, index) {
  event.preventDefault();
  const accountId = Number(index);
  const firstName = document.getElementById("account-firstname").value.trim();
  const lastName = document.getElementById("account-lastname").value.trim();
  const email = document.getElementById("account-email").value.trim();
  const role = document.getElementById("account-role").value;
  const verified = document.getElementById("account-verified").checked;

  if (!firstName || !lastName || !email || !role) {
    showToast("Please fill in all fields", "error");
    return;
  }

  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(email)) {
    showToast("Please enter a valid email address", "error");
    return;
  }

  try {
    const response = await fetch(
      `http://localhost:3000/api/accounts/${accountId}`,
      {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          ...getAuthHeader(),
        },
        body: JSON.stringify({
          fullname: `${firstName} ${lastName}`,
          email,
          role: String(role).toLowerCase(),
          verified,
        }),
      },
    );

    const data = await response.json().catch(() => ({}));
    if (!response.ok) {
      showToast(data.message || "Failed to update account", "error");
      return;
    }

    showToast("Account updated successfully!", "success");
    document.getElementById("account-form").classList.add("d-none");
    closeAccountForm();
    renderAccounts();
  } catch (error) {
    console.error("saveAccount error:", error);
    showToast("Error updating account", "error");
  }
}

async function resetPassword(event, index) {
  event.preventDefault();
  const accountId = Number(index);
  const account = accountCache.find((acc) => Number(acc.id) === accountId);
  if (!account) {
    showToast("Account not found", "error");
    return;
  }
  const newPassword = prompt("Enter new password for " + account.email);
  if (!newPassword) {
    showToast("Password reset cancelled", "info");
    return;
  }
  if (newPassword.length <= 6) {
    showToast("Password must be at least 6 characters", "error");
    return;
  }

  try {
    const response = await fetch(
      `http://localhost:3000/api/accounts/${accountId}/reset-password`,
      {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          ...getAuthHeader(),
        },
        body: JSON.stringify({ password: newPassword }),
      },
    );

    const data = await response.json().catch(() => ({}));
    if (!response.ok) {
      showToast(data.message || "Failed to reset password", "error");
      return;
    }

    showToast("Password reset successfully!", "success");
  } catch (error) {
    console.error("resetPassword error:", error);
    showToast("Error resetting password", "error");
  }
}

async function deleteAccount(event, index) {
  event.preventDefault();
  const accountId = Number(
    index !== undefined ? index : window.currentEditIndex,
  );
  const targetAccount = accountCache.find(
    (acc) => Number(acc.id) === accountId,
  );

  if (!Number.isFinite(accountId)) {
    showToast("Account not found", "error");
    return;
  }
  if (targetAccount?.email === currentUser?.email) {
    showToast("You cannot delete your own account", "error");
    return;
  }

  if (confirm("Are you sure you want to delete this account?")) {
    try {
      const response = await fetch(
        `http://localhost:3000/api/accounts/${accountId}`,
        {
          method: "DELETE",
          headers: getAuthHeader(),
        },
      );

      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        showToast(data.message || "Failed to delete account", "error");
        return;
      }

      showToast("Account deleted successfully!", "success");
      document.getElementById("account-form").classList.add("d-none");
      closeAccountForm();
      renderAccounts();
    } catch (error) {
      console.error("deleteAccount error:", error);
      showToast("Error deleting account", "error");
    }
  }
}

async function editAccount(index) {
  addAccountModal();
  const accountId = Number(index);
  window.currentEditIndex = accountId;

  const account = accountCache.find((acc) => Number(acc.id) === accountId);
  if (!account) {
    showToast("Account not found", "error");
    return;
  }
  const nameParts = String(account.fullname || "")
    .trim()
    .split(/\s+/);
  const firstName = nameParts.shift() || "";
  const lastName = nameParts.join(" ");

  document.getElementById("account-firstname").value = firstName;
  document.getElementById("account-lastname").value = lastName;
  document.getElementById("account-username").value = account.username || "";
  document.getElementById("account-email").value = account.email;
  document.getElementById("account-role").value =
    String(account.role).toLowerCase() === "admin" ? "Admin" : "User";
  document.getElementById("account-password").value = ".........";
  document.getElementById("account-password").disabled = true;
  document.getElementById("account-username").disabled = true;
  document.getElementById("account-verified").checked = account.verified;
  document.getElementById("save-account-btn").onclick = (event) =>
    saveAccount(event, accountId);

  if (account.email === currentUser.email) {
    document.getElementById("account-email").disabled = true;
    document.getElementById("account-role").disabled = true;
    document.getElementById("account-verified").disabled = true;
  } else {
    document.getElementById("account-email").disabled = false;
    document.getElementById("account-role").disabled = false;
    document.getElementById("account-verified").disabled = false;
  }
}
async function renderAccounts() {
  const accountsTableBody = document.getElementById("accounts-table-body");
  accountsTableBody.innerHTML = "";

  try {
    const response = await fetch(`http://localhost:3000/api/accounts`, {
      method: "GET",
      headers: getAuthHeader(),
    });
    if (!response.ok) {
      const err = await response.json().catch(() => ({}));
      console.error("Render Accounts failed:", response.status, err);
      return;
    }

    const data = await response.json();
    console.log(data);

    const accountList = Array.isArray(data) ? data : data?.accounts || [];
    accountCache = accountList;
    window.db.accounts = accountList;

    accountList.forEach((account) => {
      const row = document.createElement("tr");
      row.innerHTML = `
          <td>${account.fullname || account.name || ""}</td>
          <td>${account.email}</td>
          <td>${account.role}</td>
          <td>${account.verified ? "Yes" : "No"}</td>
          <td>
            <button class="btn btn-sm btn-outline-primary edit-account-btn" data-id="${account.id}" onclick="editAccount(${account.id})">Edit</button>
            <button class="btn btn-sm btn-outline-warning reset-password-btn" data-id="${account.id}" onclick="resetPassword(event, ${account.id})">Reset Password</button>
            <button class="btn btn-sm btn-outline-danger delete-account-btn" data-id="${account.id}" onclick="deleteAccount(event, ${account.id})">Delete</button>
          </td>
        `;
      accountsTableBody.appendChild(row);
    });
  } catch (error) {}
}
async function renderDepartments() {
  const departmentsTableBody = document.getElementById(
    "departments-table-body",
  );
  departmentsTableBody.innerHTML = "";

  try {
    const response = await fetch(`http://localhost:3000/api/departments`, {
      method: "GET",
      headers: getAuthHeader(),
    });

    if (!response.ok) {
      const err = await response.json().catch(() => ({}));
      console.error("Render Departments failed:", response.status, err);
      return;
    }
    const data = await response.json();

    console.log(data);

    const departmentList = Array.isArray(data) ? data : data?.departments || [];
    departmentCache = departmentList;
    window.db.departments = departmentList;

    departmentList.forEach((department) => {
      const row = document.createElement("tr");
      row.innerHTML = `
      <td>${department.name}</td>
      <td>${department.description}</td>
      <td>
        <button class="btn btn-sm btn-outline-primary edit-department-btn" data-id="${department.id}" onclick="editDepartment(${department.id})">Edit</button>
        <button class="btn btn-sm btn-outline-danger delete-department-btn" data-id="${department.id}" onclick="deleteDepartment(event, ${department.id})">Delete</button>
      </td>
    `;
      departmentsTableBody.appendChild(row);
    });
  } catch (error) {
    console.error("Error in retureving data", error);
  }
}
// Helper function to populate User Email dropdown
async function renderAccountsList() {
  const emailSelect = document.getElementById("employee-email");
  emailSelect.innerHTML = '<option value="">-- Select User --</option>';

  try {
    const response = await fetch("http://localhost:3000/api/accounts", {
      method: "GET",
      headers: getAuthHeader(),
    });

    if (!response.ok) {
      const err = await response.json().catch(() => ({}));
      console.error("renderAccountsList failed:", response.status, err);
      return;
    }

    const data = await response.json();
    const accountList = Array.isArray(data) ? data : data?.accounts || [];
    window.db.accounts = accountList;

    accountList.forEach((account) => {
      if (String(account.role || "").toLowerCase() === "user") {
        const name =
          account.fullname ||
          `${account.firstName || ""} ${account.lastName || ""}`.trim();
        const option = document.createElement("option");
        option.value = account.email;
        option.textContent = `${name} (${account.email})`;
        emailSelect.appendChild(option);
      }
    });
  } catch (error) {
    console.error("Error in retrieving account list", error);
  }
}

// Helper function to populate Department dropdown
async function renderDepartmentsList() {
  const deptSelect = document.getElementById("employee-department");
  deptSelect.innerHTML = '<option value="">-- Select Department --</option>';

  try {
    const response = await fetch(`http://localhost:3000/api/departments`, {
      method: "GET",
      headers: getAuthHeader(),
    });

    if (!response.ok) {
      const err = await response.json().catch(() => ({}));
      console.error("render Departments failed:", response.status, err);
      return;
    }

    const data = await response.json();

    const departmentList = Array.isArray(data) ? data : data?.departments || [];

    departmentList.forEach((dept) => {
      const option = document.createElement("option");
      option.value = dept.name;
      option.textContent = dept.name;
      deptSelect.appendChild(option);
    });
  } catch (error) {
    console.error("Error in retrieving the department list", error);
  }
}

async function renderEmployees() {
  const employeesTableBody = document.getElementById("employees-table-body");
  employeesTableBody.innerHTML = "";

  try {
    const response = await fetch("http://localhost:3000/api/employees", {
      method: "GET",
      headers: getAuthHeader(),
    });

    if (!response.ok) {
      const err = await response.json().catch(() => ({}));
      console.error("render Employee failed:", response.status, err);
      return;
    }

    const data = await response.json();
    console.log(data);

    // The backend returns { employees: [...] }
    const employeesList = Array.isArray(data) ? data : data?.employees || [];
    employeeCache = employeesList;
    if (employeesList.length === 0) {
      employeesTableBody.innerHTML = `
          <tr>
            <td colspan="6" class="text-center text-muted">
              No employees.
            </td>
          </tr>
        `;
      return;
    }

    employeesList.forEach((employee) => {
      const row = document.createElement("tr");
      row.innerHTML = `
          <td>${employee.id}</td>
          <td>${employee.email}</td>
          <td>${employee.position}</td>
          <td>${employee.department || employee.dept || "N/A"}</td>
          <td>${employee.hireDate}</td>
          <td>
            <button class="btn btn-sm btn-outline-primary edit-employee-btn" data-id="${employee.id}" onclick="editEmployee(${employee.id})">Edit</button>
            <button class="btn btn-sm btn-outline-danger delete-employee-btn" data-id="${employee.id}" onclick="deleteEmployee(event, ${employee.id})">Delete</button>
          </td>
        `;
      employeesTableBody.appendChild(row);
    });
  } catch (error) {
    console.error("renderEmployees error", error);
  }
}

function openAddEmployeeForm() {
  // Reset form fields
  document.getElementById("employee-id").value = "";
  document.getElementById("employee-id").disabled = false;
  document.getElementById("employee-email").value = "";
  document.getElementById("employee-position").value = "";
  document.getElementById("employee-department").value = "";
  document.getElementById("employee-hire-date").value = "";

  // Reset button to add mode
  document.getElementById("save-employee-btn").onclick = addEmployee;
  document.getElementById("save-employee-btn").textContent = "Save";
  document.getElementById("delete-employee-btn").classList.add("d-none");

  // Populate dropdowns
  renderAccountsList();
  renderDepartmentsList();

  // Show form
  document.getElementById("employee-form").classList.remove("d-none");
}

function closeEmployeeForm() {
  document.getElementById("employee-form").classList.add("d-none");
}

async function addEmployee(event) {
  event.preventDefault();

  const id = document.getElementById("employee-id").value.trim();
  const userEmail = document.getElementById("employee-email").value.trim();
  const position = document.getElementById("employee-position").value.trim();
  const department = document.getElementById("employee-department").value;
  const hireDate = document.getElementById("employee-hire-date").value;

  if (!userEmail || !position || department === "" || !hireDate) {
    showToast("Please fill in all fields", "error");
    return;
  }

  // Validate that user email exists
  const userExists = window.db.accounts.find((acc) => acc.email === userEmail);
  if (!userExists) {
    showToast("User email does not exist in the system", "error");
    return;
  }

  // Check if employee ID already exists
  const existingId = id
    ? employeeCache.find((emp) => String(emp.id) === String(id))
    : null;
  if (existingId) {
    showToast(
      "Employee ID already exists. Please use a different ID.",
      "error",
    );
    return;
  }

  try {
    const response = await fetch("http://localhost:3000/api/employees", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...getAuthHeader(),
      },
      body: JSON.stringify({
        id: id || undefined,
        email: userEmail,
        position,
        department,
        hireDate,
      }),
    });

    const data = await response.json().catch(() => ({}));
    if (!response.ok) {
      showToast(data.message || "Failed to create employee", "error");
      return;
    }

    showToast("Employee created successfully!", "success");
  } catch (error) {
    console.error("addEmployee error", error);
    showToast("Error creating employee", "error");
    return;
  }

  closeEmployeeForm();
  renderEmployees();
}

async function editEmployee(index) {
  const employeeId = Number(index);
  const employee = employeeCache.find((emp) => Number(emp.id) === employeeId);
  if (!employee) {
    showToast("Employee not found", "error");
    return;
  }

  // Store the ID for save/delete operations
  window.currentEditEmployeeId = employeeId;

  document.getElementById("employee-id").value = employee.id;
  document.getElementById("employee-id").disabled = true;
  document.getElementById("employee-email").value = employee.email;
  document.getElementById("employee-position").value = employee.position;
  document.getElementById("employee-department").value =
    employee.department || employee.dept || "";
  document.getElementById("employee-hire-date").value = employee.hireDate;

  // Populate dropdowns
  renderAccountsList();
  renderDepartmentsList();

  // Switch button to edit mode
  document.getElementById("save-employee-btn").onclick = (event) =>
    saveEmployee(event);
  document.getElementById("save-employee-btn").textContent = "Update";
  document.getElementById("delete-employee-btn").classList.remove("d-none");

  // Show form
  document.getElementById("employee-form").classList.remove("d-none");
}

async function saveEmployee(event) {
  event.preventDefault();

  const employeeId = Number(window.currentEditEmployeeId);
  if (!Number.isFinite(employeeId)) {
    showToast("Employee not found", "error");
    return;
  }

  const userEmail = document.getElementById("employee-email").value.trim();
  const position = document.getElementById("employee-position").value.trim();
  const department = document.getElementById("employee-department").value;
  const hireDate = document.getElementById("employee-hire-date").value;

  if (!userEmail || !position || department === "" || !hireDate) {
    showToast("Please fill in all fields", "error");
    return;
  }

  // Validate that user email exists
  const userExists = window.db.accounts.find((acc) => acc.email === userEmail);
  if (!userExists) {
    showToast("User email does not exist in the system", "error");
    return;
  }

  try {
    const response = await fetch(
      `http://localhost:3000/api/employees/${employeeId}`,
      {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          ...getAuthHeader(),
        },
        body: JSON.stringify({
          email: userEmail,
          position,
          department,
          hireDate,
        }),
      },
    );

    const data = await response.json().catch(() => ({}));
    if (!response.ok) {
      showToast(data.message || "Failed to update employee", "error");
      return;
    }

    showToast("Employee updated successfully!", "success");
  } catch (error) {
    console.error("saveEmployee error", error);
    showToast("Error updating employee", "error");
    return;
  }

  closeEmployeeForm();
  renderEmployees();
}

async function deleteEmployee(event, index) {
  event.preventDefault();

  const employeeId = Number(
    index !== undefined ? index : window.currentEditEmployeeId,
  );

  if (!Number.isFinite(employeeId)) {
    showToast("Employee not found", "error");
    return;
  }

  const employee = employeeCache.find((emp) => Number(emp.id) === employeeId);
  if (!employee) {
    showToast("Employee not found", "error");
    return;
  }

  if (confirm(`Are you sure you want to delete employee "${employee.id}"?`)) {
    try {
      const response = await fetch(
        `http://localhost:3000/api/employees/${employeeId}`,
        {
          method: "DELETE",
          headers: getAuthHeader(),
        },
      );

      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        showToast(data.message || "Failed to delete employee", "error");
        return;
      }

      showToast("Employee deleted successfully!", "success");
    } catch (error) {
      console.error("deleteEmployee error", error);
      showToast("Error deleting employee", "error");
      return;
    }

    closeEmployeeForm();
    renderEmployees();
  }
}

// ===== REQUESTS MANAGEMENT =====
function getStatusBadge(status) {
  const badges = {
    Pending: '<span class="badge bg-warning">Pending</span>',
    Approved: '<span class="badge bg-success">Approved</span>',
    Rejected: '<span class="badge bg-danger">Rejected</span>',
  };
  return badges[status] || '<span class="badge bg-secondary">Unknown</span>';
}

async function renderRequests() {
  const requestsTableBody = document.getElementById("requests-table-body");
  requestsTableBody.innerHTML = "";

  const isAdmin = currentUser?.role?.toLowerCase() === "admin";
  let requestsToDisplay = [];

  try {
    const response = await fetch("http://localhost:3000/api/requests", {
      method: "GET",
      headers: getAuthHeader(),
    });

    if (!response.ok) {
      const err = await response.json().catch(() => ({}));
      console.error("renderRequests failed:", response.status, err);
      showToast(err.message || "Failed to load requests", "error");
      return;
    }

    const data = await response.json();
    requestsToDisplay = Array.isArray(data) ? data : data?.requests || [];
  } catch (error) {
    console.error("renderRequests error:", error);
    showToast("Error loading requests", "error");
    return;
  }

  if (requestsToDisplay.length === 0) {
    const colspan = isAdmin ? 6 : 5;
    requestsTableBody.innerHTML = `
      <tr>
        <td colspan="${colspan}" class="text-center text-muted">
          No requests yet.
        </td>
      </tr>
    `;
    return;
  }

  requestsToDisplay.forEach((request) => {
    const itemsList = request.items
      .map((item) => item.name + " (" + item.qty + ")")
      .join(", ");

    const row = document.createElement("tr");

    let actionsHTML = "";
    if (isAdmin) {
      // Admin can update status or delete
      actionsHTML = `
        <button class="btn btn-sm btn-outline-success update-request-btn" onclick="updateRequestStatus(event, ${request.request_id}, 'Approved')">
          <i class="bi bi-check-circle"></i> Approve
        </button>
        <button class="btn btn-sm btn-outline-danger update-request-btn ms-2" onclick="updateRequestStatus(event, ${request.request_id}, 'Rejected')">
          <i class="bi bi-x-circle"></i> Reject
        </button>
        <button class="btn btn-sm btn-outline-danger delete-request-btn ms-2" onclick="deleteRequest(event, ${request.request_id})">Delete</button>
      `;
    } else {
      actionsHTML = `
        <button class="btn btn-sm btn-outline-danger delete-request-btn" onclick="deleteRequest(event, ${request.request_id})">Delete</button>
      `;
    }

    if (isAdmin) {
      row.innerHTML = `
        <td>${request.date}</td>
        <td>${request.type}</td>
        <td>${itemsList}</td>
        <td>${getStatusBadge(request.status)}</td>
        <td>${request.employeeEmail}</td>
        <td>${actionsHTML}</td>
      `;
    } else {
      row.innerHTML = `
        <td>${request.date}</td>
        <td>${request.type}</td>
        <td>${itemsList}</td>
        <td>${getStatusBadge(request.status)}</td>
        <td>${actionsHTML}</td>
      `;
    }
    requestsTableBody.appendChild(row);
  });
}

function addRequestItem() {
  const container = document.getElementById("itemsContainer");
  const itemCount = container.querySelectorAll(".item-row").length;

  const newRow = document.createElement("div");
  newRow.className = "row g-2 mb-2 align-items-center item-row";
  newRow.innerHTML = `
    <div class="col">
      <input type="text" class="form-control item-name" placeholder="Item name" required>
    </div>
    <div class="col-3">
      <input type="number" class="form-control item-qty" value="1" min="1" required>
    </div>
    <div class="col-auto">
      <button type="button" class="btn btn-sm btn-outline-danger remove-item-btn" onclick="removeRequestItem(this)">×</button>
    </div>
  `;

  container.appendChild(newRow);
}

function removeRequestItem(button) {
  const container = document.getElementById("itemsContainer");
  const itemRows = container.querySelectorAll(".item-row");

  // Don't allow removing the last item
  if (itemRows.length > 1) {
    button.closest(".item-row").remove();
  } else {
    showToast("You must have at least one item", "error");
  }
}

async function submitRequest(event) {
  event.preventDefault();

  const type = document.getElementById("request-type").value;

  if (!type) {
    showToast("Please select a request type", "error");
    return;
  }

  // Collect items
  const items = [];
  document.querySelectorAll(".item-row").forEach((row) => {
    const name = row.querySelector(".item-name").value.trim();
    const qty = parseInt(row.querySelector(".item-qty").value);

    if (name && qty > 0) {
      items.push({ name, qty });
    }
  });

  // Validate at least one item
  if (items.length === 0) {
    showToast("Please add at least one item to your request", "error");
    return;
  }

  try {
    const response = await fetch("http://localhost:3000/api/requests", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...getAuthHeader(),
      },
      body: JSON.stringify({ type, items }),
    });

    const data = await response.json().catch(() => ({}));
    if (!response.ok) {
      showToast(data.message || "Failed to submit request", "error");
      return;
    }

    showToast("Request submitted successfully!", "success");
  } catch (error) {
    console.error("submitRequest error:", error);
    showToast("Error submitting request", "error");
    return;
  }

  // Close modal and reset form
  const modal = bootstrap.Modal.getInstance(
    document.getElementById("requestModal"),
  );
  if (modal) {
    modal.hide();
  }
  document.getElementById("request-form").reset();

  // Reset items to single row
  const container = document.getElementById("itemsContainer");
  container.innerHTML = `
    <div class="row g-2 mb-2 align-items-center item-row">
      <div class="col">
        <input type="text" class="form-control item-name" placeholder="Item name" required>
      </div>
      <div class="col-3">
        <input type="number" class="form-control item-qty" value="1" min="1" required>
      </div>
      <div class="col-auto">
        <button type="button" class="btn btn-sm btn-outline-success add-item-btn" onclick="addRequestItem()">+</button>
      </div>
    </div>
  `;

  renderRequests();
}

async function deleteRequest(event, index) {
  event.preventDefault();

  if (!confirm("Are you sure you want to delete this request?")) {
    return;
  }

  try {
    const response = await fetch(
      `http://localhost:3000/api/requests/${index}`,
      {
        method: "DELETE",
        headers: getAuthHeader(),
      },
    );

    const data = await response.json().catch(() => ({}));
    if (!response.ok) {
      showToast(data.message || "Failed to delete request", "error");
      return;
    }

    showToast("Request deleted successfully!", "success");
    renderRequests();
  } catch (error) {
    console.error("deleteRequest error:", error);
    showToast("Error deleting request", "error");
  }
}

async function updateRequestStatus(event, index, newStatus) {
  event.preventDefault();

  const statusText = newStatus === "Approved" ? "approved" : "rejected";
  if (!confirm(`Are you sure you want to ${statusText} this request?`)) {
    return;
  }

  try {
    const response = await fetch(
      `http://localhost:3000/api/requests/${index}/status`,
      {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          ...getAuthHeader(),
        },
        body: JSON.stringify({ status: newStatus }),
      },
    );

    const data = await response.json().catch(() => ({}));
    if (!response.ok) {
      showToast(data.message || "Failed to update request", "error");
      return;
    }

    showToast(`Request ${statusText} successfully!`, "success");
    renderRequests();
  } catch (error) {
    console.error("updateRequestStatus error:", error);
    showToast("Error updating request", "error");
  }
}

window.addEventListener("hashchange", handleRouting);

document.addEventListener("DOMContentLoaded", async () => {
  const savedUser = localStorage.getItem("currentUser");
  const savedToken = localStorage.getItem("authToken");
  if (savedToken) {
    sessionStorage.setItem("authToken", savedToken);
    // Re-schedule auto logout based on remaining token lifetime after page reload
    scheduleAutoLogout(savedToken);
  }
  if (savedUser) {
    currentUser = JSON.parse(savedUser);
    setAuthState(true, currentUser);
  }

  handleRouting();
});
