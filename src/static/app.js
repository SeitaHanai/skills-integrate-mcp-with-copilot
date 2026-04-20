document.addEventListener("DOMContentLoaded", () => {
  const authTokenStorageKey = "adminAuthToken";

  const activitiesList = document.getElementById("activities-list");
  const activitySelect = document.getElementById("activity");
  const signupForm = document.getElementById("signup-form");
  const messageDiv = document.getElementById("message");
  const adminStatus = document.getElementById("admin-status");
  const userMenuButton = document.getElementById("user-menu-button");
  const authModal = document.getElementById("auth-modal");
  const closeAuthModalButton = document.getElementById("close-auth-modal");
  const loginForm = document.getElementById("login-form");

  let adminToken = localStorage.getItem(authTokenStorageKey);
  let adminUsername = "";

  function showMessage(text, type = "info") {
    messageDiv.textContent = text;
    messageDiv.className = type;
    messageDiv.classList.remove("hidden");

    setTimeout(() => {
      messageDiv.classList.add("hidden");
    }, 5000);
  }

  function updateAdminUiState() {
    const isLoggedIn = Boolean(adminToken);

    signupForm.querySelectorAll("input, select, button[type='submit']").forEach((element) => {
      element.disabled = !isLoggedIn;
    });

    if (isLoggedIn) {
      adminStatus.textContent = `Logged in as ${adminUsername || "teacher"}. You can register and unregister students.`;
      adminStatus.className = "success-text";
      userMenuButton.textContent = "Log Out";
    } else {
      adminStatus.textContent = "Please log in as a teacher to register or unregister students.";
      adminStatus.className = "info-text";
      userMenuButton.textContent = "👤";
    }
  }

  function closeAuthModal() {
    authModal.classList.add("hidden");
    loginForm.reset();
  }

  function openAuthModal() {
    authModal.classList.remove("hidden");
  }

  async function loadAdminSession() {
    if (!adminToken) {
      updateAdminUiState();
      return;
    }

    try {
      const response = await fetch("/auth/me", {
        headers: {
          "X-Admin-Token": adminToken,
        },
      });

      if (!response.ok) {
        throw new Error("Session expired");
      }

      const result = await response.json();
      adminUsername = result.username;
      updateAdminUiState();
    } catch (error) {
      localStorage.removeItem(authTokenStorageKey);
      adminToken = "";
      adminUsername = "";
      updateAdminUiState();
    }
  }

  // Function to fetch activities from API
  async function fetchActivities() {
    try {
      const response = await fetch("/activities");
      const activities = await response.json();

      // Clear loading message
      activitiesList.innerHTML = "";

      // Populate activities list
      Object.entries(activities).forEach(([name, details]) => {
        const activityCard = document.createElement("div");
        activityCard.className = "activity-card";

        const spotsLeft =
          details.max_participants - details.participants.length;

        // Create participants HTML with delete icons instead of bullet points
        const participantsHTML =
          details.participants.length > 0
            ? `<div class="participants-section">
              <h5>Participants:</h5>
              <ul class="participants-list">
                ${details.participants
                  .map(
                    (email) =>
                      `<li><span class="participant-email">${email}</span><button class="delete-btn" data-activity="${name}" data-email="${email}" ${adminToken ? "" : "disabled"}>❌</button></li>`
                  )
                  .join("")}
              </ul>
            </div>`
            : `<p><em>No participants yet</em></p>`;

        activityCard.innerHTML = `
          <h4>${name}</h4>
          <p>${details.description}</p>
          <p><strong>Schedule:</strong> ${details.schedule}</p>
          <p><strong>Availability:</strong> ${spotsLeft} spots left</p>
          <div class="participants-container">
            ${participantsHTML}
          </div>
        `;

        activitiesList.appendChild(activityCard);

        // Add option to select dropdown
        const option = document.createElement("option");
        option.value = name;
        option.textContent = name;
        activitySelect.appendChild(option);
      });

      // Add event listeners to delete buttons
      document.querySelectorAll(".delete-btn").forEach((button) => {
        button.addEventListener("click", handleUnregister);
      });
    } catch (error) {
      activitiesList.innerHTML =
        "<p>Failed to load activities. Please try again later.</p>";
      console.error("Error fetching activities:", error);
    }
  }

  // Handle unregister functionality
  async function handleUnregister(event) {
    if (!adminToken) {
      showMessage("Only logged-in teachers can unregister students.", "error");
      return;
    }

    const button = event.target;
    const activity = button.getAttribute("data-activity");
    const email = button.getAttribute("data-email");

    try {
      const response = await fetch(
        `/activities/${encodeURIComponent(
          activity
        )}/unregister?email=${encodeURIComponent(email)}`,
        {
          method: "DELETE",
          headers: {
            "X-Admin-Token": adminToken,
          },
        }
      );

      const result = await response.json();

      if (response.ok) {
        showMessage(result.message, "success");

        // Refresh activities list to show updated participants
        fetchActivities();
      } else {
        showMessage(result.detail || "An error occurred", "error");
      }
    } catch (error) {
      showMessage("Failed to unregister. Please try again.", "error");
      console.error("Error unregistering:", error);
    }
  }

  // Handle form submission
  signupForm.addEventListener("submit", async (event) => {
    event.preventDefault();

    const email = document.getElementById("email").value;
    const activity = document.getElementById("activity").value;

    if (!adminToken) {
      showMessage("Only logged-in teachers can register students.", "error");
      return;
    }

    try {
      const response = await fetch(
        `/activities/${encodeURIComponent(
          activity
        )}/signup?email=${encodeURIComponent(email)}`,
        {
          method: "POST",
          headers: {
            "X-Admin-Token": adminToken,
          },
        }
      );

      const result = await response.json();

      if (response.ok) {
        showMessage(result.message, "success");
        signupForm.reset();

        // Refresh activities list to show updated participants
        fetchActivities();
      } else {
        showMessage(result.detail || "An error occurred", "error");
      }
    } catch (error) {
      showMessage("Failed to sign up. Please try again.", "error");
      console.error("Error signing up:", error);
    }
  });

  userMenuButton.addEventListener("click", () => {
    if (adminToken) {
      localStorage.removeItem(authTokenStorageKey);
      adminToken = "";
      adminUsername = "";
      updateAdminUiState();
      fetchActivities();
      showMessage("Logged out.", "info");
      return;
    }

    openAuthModal();
  });

  closeAuthModalButton.addEventListener("click", closeAuthModal);

  authModal.addEventListener("click", (event) => {
    if (event.target === authModal) {
      closeAuthModal();
    }
  });

  loginForm.addEventListener("submit", async (event) => {
    event.preventDefault();

    const username = document.getElementById("username").value;
    const password = document.getElementById("password").value;

    try {
      const response = await fetch("/auth/login", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ username, password }),
      });

      const result = await response.json();

      if (!response.ok) {
        showMessage(result.detail || "Login failed.", "error");
        return;
      }

      adminToken = result.token;
      adminUsername = username;
      localStorage.setItem(authTokenStorageKey, adminToken);

      closeAuthModal();
      updateAdminUiState();
      fetchActivities();
      showMessage(result.message, "success");
    } catch (error) {
      showMessage("Failed to log in. Please try again.", "error");
      console.error("Error logging in:", error);
    }
  });

  // Initialize app
  loadAdminSession();
  fetchActivities();
});
